#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

AWS_REGION="${AWS_REGION:-eu-west-1}"
EDGE_REGION="us-east-1"
DEPLOYMENT_STAGE="${DEPLOYMENT_STAGE:-prod}"
ROOT_DOMAIN="${ROOT_DOMAIN:-helm-os.ai}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${ROOT_DOMAIN}}"
API_DOMAIN="${API_DOMAIN:-api.${ROOT_DOMAIN}}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
FOUNDATION_STACK_NAME="${FOUNDATION_STACK_NAME:-helmos-foundation}"
EDGE_STACK_NAME="${EDGE_STACK_NAME:-helmos-edge-certificates}"
DATABASE_NAME="${DATABASE_NAME:-helmos}"
DATABASE_USERNAME="${DATABASE_USERNAME:-helmos}"

if [[ -z "${HOSTED_ZONE_ID}" ]]; then
  printf 'HOSTED_ZONE_ID must be set.\n' >&2
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

printf 'Deploying edge certificate stack in %s...\n' "${EDGE_REGION}"
aws cloudformation deploy \
  --region "${EDGE_REGION}" \
  --stack-name "${EDGE_STACK_NAME}" \
  --template-file "${ROOT_DIR}/cicd/serverless/edge-certificates.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    RootDomain="${ROOT_DOMAIN}" \
    WwwDomain="${WWW_DOMAIN}" \
    HostedZoneId="${HOSTED_ZONE_ID}"

EDGE_CERTIFICATE_ARN="$(stack_output "${EDGE_REGION}" "${EDGE_STACK_NAME}" "EdgeCertificateArn")"

printf 'Deploying foundation stack in %s...\n' "${AWS_REGION}"
aws cloudformation deploy \
  --region "${AWS_REGION}" \
  --stack-name "${FOUNDATION_STACK_NAME}" \
  --template-file "${ROOT_DIR}/cicd/serverless/foundation.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    DeploymentStage="${DEPLOYMENT_STAGE}" \
    RootDomain="${ROOT_DOMAIN}" \
    WwwDomain="${WWW_DOMAIN}" \
    ApiDomain="${API_DOMAIN}" \
    HostedZoneId="${HOSTED_ZONE_ID}" \
    EdgeCertificateArn="${EDGE_CERTIFICATE_ARN}" \
    DatabaseName="${DATABASE_NAME}" \
    DatabaseUsername="${DATABASE_USERNAME}"

printf '\nPopulate these Secrets Manager entries before deploying services:\n'
printf '  LIFE2 JWT secret:      %s\n' "$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "Life2JwtSecretArn")"
printf '  LIFE2 JWT public key:  %s\n' "$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "Life2JwtPublicKeySecretArn")"
printf '  OpenAI API key:        %s\n' "$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "OpenAiApiKeySecretArn")"
printf '  Anthropic API key:     %s\n' "$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "AnthropicApiKeySecretArn")"
printf '  LiteLLM master key:    %s\n' "$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "LiteLlmMasterKeySecretArn")"
printf '  LangSmith API key:     %s\n' "$(stack_output "${AWS_REGION}" "${FOUNDATION_STACK_NAME}" "LangsmithApiKeySecretArn")"
