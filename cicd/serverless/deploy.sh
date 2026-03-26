#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/dist/deployment"
METADATA_FILE="${ARTIFACT_DIR}/build.env"
TMP_DIR="${ARTIFACT_DIR}/tmp"

AWS_REGION="${AWS_REGION:-eu-west-1}"
ROOT_DOMAIN="${ROOT_DOMAIN:-helm-os.ai}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${ROOT_DOMAIN}}"
API_DOMAIN="${API_DOMAIN:-api.${ROOT_DOMAIN}}"
FOUNDATION_STACK_NAME="${FOUNDATION_STACK_NAME:-helmos-foundation}"
SERVICES_STACK_NAME="${SERVICES_STACK_NAME:-helmos-services}"
HELMOS_LOG_LEVEL="${HELMOS_LOG_LEVEL:-INFO}"
HELMOS_DEFAULT_MODEL="${HELMOS_DEFAULT_MODEL:-helmos-default}"
HELMOS_SUPERVISOR_MODEL="${HELMOS_SUPERVISOR_MODEL:-helmos-supervisor}"
HELMOS_LANGSMITH_ENABLED="${HELMOS_LANGSMITH_ENABLED:-false}"

if [[ ! -f "${METADATA_FILE}" ]]; then
  printf 'Build metadata file not found: %s\nRun ./cicd/build/build_all.sh first.\n' "${METADATA_FILE}" >&2
  exit 1
fi

source "${METADATA_FILE}"

mkdir -p "${TMP_DIR}"

require_value() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "${value}" ]]; then
    printf 'Required build metadata variable %s is missing.\n' "${name}" >&2
    exit 1
  fi
}

require_value "WEBAPP_ARCHIVE"
require_value "NODE_API_IMAGE_NAME"
require_value "NODE_API_IMAGE_TAG"
require_value "NODE_API_IMAGE_TAR"
require_value "AGENT_GATEWAY_IMAGE_NAME"
require_value "AGENT_GATEWAY_IMAGE_TAG"
require_value "AGENT_GATEWAY_IMAGE_TAR"
require_value "LITELLM_IMAGE_NAME"
require_value "LITELLM_IMAGE_TAG"
require_value "LITELLM_IMAGE_TAR"
require_value "BUILD_METADATA_COMPLETE"

if [[ "${BUILD_METADATA_COMPLETE}" != "1" ]]; then
  printf 'Build metadata file is incomplete. Run ./cicd/build/build_all.sh again before deploy.\n' >&2
  exit 1
fi

stack_output() {
  local region="$1"
  local stack="$2"
  local output_key="$3"
  aws cloudformation describe-stacks \
    --region "${region}" \
    --stack-name "${stack}" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
    --output text
}

secret_value() {
  local region="$1"
  local secret_arn="$2"
  aws secretsmanager get-secret-value \
    --region "${region}" \
    --secret-id "${secret_arn}" \
    --query 'SecretString' \
    --output text | node -e 'const fs = require("node:fs"); const raw = fs.readFileSync(0, "utf8").trim(); const parsed = JSON.parse(raw); process.stdout.write((parsed.value ?? "").toString());'
}

ensure_image_loaded() {
  local image_name="$1"
  local image_tag="$2"
  local image_tar="$3"

  if ! docker image inspect "${image_name}:${image_tag}" >/dev/null 2>&1; then
    docker load -i "${image_tar}" >/dev/null
  fi
}

push_image() {
  local region="$1"
  local repository_uri="$2"
  local local_image="$3"
  local image_tag="$4"

  aws ecr get-login-password --region "${region}" | docker login --username AWS --password-stdin "$(cut -d/ -f1 <<<"${repository_uri}")" >/dev/null
  docker tag "${local_image}:${image_tag}" "${repository_uri}:${image_tag}"
  docker push "${repository_uri}:${image_tag}" >/dev/null
}

NODE_API_REPOSITORY_URI="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "NodeApiRepositoryUri")"
AGENT_GATEWAY_REPOSITORY_URI="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "AgentGatewayRepositoryUri")"
LITELLM_REPOSITORY_URI="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "LiteLlmRepositoryUri")"
SITE_BUCKET_NAME="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "SiteBucketName")"
CLOUDFRONT_DISTRIBUTION_ID="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "CloudFrontDistributionId")"
OPENAI_SECRET_ARN="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "OpenAiApiKeySecretArn")"
LITELLM_MASTER_KEY_SECRET_ARN="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "LiteLlmMasterKeySecretArn")"

if [[ -z "${NODE_API_REPOSITORY_URI}" || "${NODE_API_REPOSITORY_URI}" == "None" ]]; then
  printf 'Foundation stack %s was not found or is missing outputs.\nRun ./cicd/serverless/bootstrap.sh first.\n' "${FOUNDATION_STACK_NAME}" >&2
  exit 1
fi

if [[ -z "$(secret_value "${AWS_REGION}" "${OPENAI_SECRET_ARN}")" ]]; then
  printf 'OpenAI secret is still empty. Populate it in AWS Secrets Manager, then rerun deploy.\n' >&2
  exit 1
fi

if [[ -z "$(secret_value "${AWS_REGION}" "${LITELLM_MASTER_KEY_SECRET_ARN}")" ]]; then
  printf 'LiteLLM master key secret is still empty. Populate it in AWS Secrets Manager, then rerun deploy.\n' >&2
  exit 1
fi

ensure_image_loaded "${NODE_API_IMAGE_NAME}" "${NODE_API_IMAGE_TAG}" "${NODE_API_IMAGE_TAR}"
ensure_image_loaded "${AGENT_GATEWAY_IMAGE_NAME}" "${AGENT_GATEWAY_IMAGE_TAG}" "${AGENT_GATEWAY_IMAGE_TAR}"
ensure_image_loaded "${LITELLM_IMAGE_NAME}" "${LITELLM_IMAGE_TAG}" "${LITELLM_IMAGE_TAR}"

printf 'Pushing container images to ECR...\n'
push_image "${AWS_REGION}" "${NODE_API_REPOSITORY_URI}" "${NODE_API_IMAGE_NAME}" "${NODE_API_IMAGE_TAG}"
push_image "${AWS_REGION}" "${AGENT_GATEWAY_REPOSITORY_URI}" "${AGENT_GATEWAY_IMAGE_NAME}" "${AGENT_GATEWAY_IMAGE_TAG}"
push_image "${AWS_REGION}" "${LITELLM_REPOSITORY_URI}" "${LITELLM_IMAGE_NAME}" "${LITELLM_IMAGE_TAG}"

WEB_ROOT="${TMP_DIR}/webapp"
rm -rf "${WEB_ROOT}"
mkdir -p "${WEB_ROOT}"
tar -xzf "${WEBAPP_ARCHIVE}" -C "${WEB_ROOT}"

printf 'Uploading static web bundle to s3://%s ...\n' "${SITE_BUCKET_NAME}"
aws s3 sync "${WEB_ROOT}" "s3://${SITE_BUCKET_NAME}/" --delete

printf 'Deploying ECS services...\n'
aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --stack-name "${SERVICES_STACK_NAME}" \
  --template-file "${ROOT_DIR}/cicd/serverless/services.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FoundationStackName="${FOUNDATION_STACK_NAME}" \
    RootDomain="${ROOT_DOMAIN}" \
    WwwDomain="${WWW_DOMAIN}" \
    ApiDomain="${API_DOMAIN}" \
    NodeApiImageUri="${NODE_API_REPOSITORY_URI}:${NODE_API_IMAGE_TAG}" \
    AgentGatewayImageUri="${AGENT_GATEWAY_REPOSITORY_URI}:${AGENT_GATEWAY_IMAGE_TAG}" \
    LiteLlmImageUri="${LITELLM_REPOSITORY_URI}:${LITELLM_IMAGE_TAG}" \
    HelmOsLogLevel="${HELMOS_LOG_LEVEL}" \
    HelmOsDefaultModel="${HELMOS_DEFAULT_MODEL}" \
    HelmOsSupervisorModel="${HELMOS_SUPERVISOR_MODEL}" \
    HelmOsLangsmithEnabled="${HELMOS_LANGSMITH_ENABLED}"

CLUSTER_NAME="$(stack_output "${AWS_REGION}" "${SERVICES_STACK_NAME}" "ClusterName")"
NODE_API_TASK_DEFINITION_ARN="$(stack_output "${AWS_REGION}" "${SERVICES_STACK_NAME}" "NodeApiTaskDefinitionArn")"
PUBLIC_SUBNETS="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "PublicSubnetIds")"
TASK_SECURITY_GROUP="$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "EcsTaskSecurityGroupId")"

printf 'Running Prisma migrations...\n'
RUN_TASK_ARN="$(
  aws ecs run-task \
    --region "${AWS_REGION}" \
    --cluster "${CLUSTER_NAME}" \
    --launch-type FARGATE \
    --task-definition "${NODE_API_TASK_DEFINITION_ARN}" \
    --network-configuration "awsvpcConfiguration={subnets=[${PUBLIC_SUBNETS}],securityGroups=[${TASK_SECURITY_GROUP}],assignPublicIp=ENABLED}" \
    --overrides '{"containerOverrides":[{"name":"node-api","command":["npx","prisma","migrate","deploy"]}]}' \
    --query 'tasks[0].taskArn' \
    --output text
)"

aws ecs wait tasks-stopped --region "${AWS_REGION}" --cluster "${CLUSTER_NAME}" --tasks "${RUN_TASK_ARN}"

MIGRATION_EXIT_CODE="$(
  aws ecs describe-tasks \
    --region "${AWS_REGION}" \
    --cluster "${CLUSTER_NAME}" \
    --tasks "${RUN_TASK_ARN}" \
    --query 'tasks[0].containers[?name==`node-api`].exitCode' \
    --output text
)"

if [[ "${MIGRATION_EXIT_CODE}" != "0" ]]; then
  printf 'Prisma migration task failed with exit code %s\n' "${MIGRATION_EXIT_CODE}" >&2
  exit 1
fi

printf 'Invalidating CloudFront distribution %s...\n' "${CLOUDFRONT_DISTRIBUTION_ID}"
aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --paths "/*" >/dev/null

printf 'Deployment completed for %s in %s\n' "${ROOT_DOMAIN}" "${AWS_REGION}"
