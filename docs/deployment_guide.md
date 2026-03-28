# HelmOS Deployment Guide

This guide prepares HelmOS for production deployment in AWS for the `helm-os.ai` domain.

## Deployment approach

HelmOS is deployed as a mixed static-site and serverless-container platform:

- The Angular frontend is built as static assets and served from Amazon S3 through CloudFront.
- The Node control-plane API runs on Amazon ECS Fargate behind an Application Load Balancer.
- The FastAPI agent gateway runs on Amazon ECS Fargate behind the same ALB and is routed by path.
- LiteLLM runs as a private ECS Fargate service so the agent gateway can keep using its current OpenAI-compatible contract.
- PostgreSQL runs on Amazon RDS for Prisma and application state.
- Redis runs on Amazon ElastiCache for agent runtime coordination.
- Amazon S3 stores generated application artifacts.
- Route 53 and ACM manage `helm-os.ai`, `www.helm-os.ai`, and `api.helm-os.ai`.

This keeps the browser on same-origin routes for `/api` and `/api/v1` through CloudFront, while still providing a direct `api.helm-os.ai` endpoint for operational checks and debugging.

## AWS topology

- `https://helm-os.ai` and `https://www.helm-os.ai` point to CloudFront.
- CloudFront serves static assets from the private site bucket.
- CloudFront forwards `/api/*` to the ALB and the Node API target group.
- CloudFront forwards `/api/v1/*` to the ALB and the FastAPI agent-gateway target group.
- `https://api.helm-os.ai` points directly to the ALB.
- ECS service discovery provides:
  - `agent-gateway.helmos.local`
  - `litellm.helmos.local`

## Technology choices

- Infrastructure as code: AWS CloudFormation
- Container registry: Amazon ECR
- Runtime: Amazon ECS Fargate
- TLS: AWS Certificate Manager
- DNS: Amazon Route 53
- CDN and edge caching: Amazon CloudFront
- Datastores: Amazon RDS PostgreSQL and Amazon ElastiCache Redis
- Artifact storage: Amazon S3
- Deployment transport: AWS CLI and Docker

## Files added for deployment

- Build scripts: [/Users/ralfe/Dev/HelmOS/cicd/build](/Users/ralfe/Dev/HelmOS/cicd/build)
- AWS templates and deploy automation: [/Users/ralfe/Dev/HelmOS/cicd/serverless](/Users/ralfe/Dev/HelmOS/cicd/serverless)

## Prerequisites

Before deploying, make sure you have:

- An AWS account with permissions for CloudFormation, ECS, ECR, ACM, Route 53, CloudFront, RDS, ElastiCache, S3, IAM, and Secrets Manager
- A public Route 53 hosted zone for `helm-os.ai`
- Docker installed locally or in CI
- Docker Buildx installed locally or in CI
- AWS CLI v2 configured
- Node.js and npm available for the frontend build

You should also create these Secrets Manager secrets and export their ARNs before deployment:

The bootstrap stack now creates these Secrets Manager secrets for you:

- `helmos/prod/life2-jwt-secret`
- `helmos/prod/life2-jwt-public-key`
- `helmos/prod/openai-api-key`
- `helmos/prod/anthropic-api-key`
- `helmos/prod/litellm-master-key`
- `helmos/prod/langsmith-api-key`

Populate them manually in the AWS Console after bootstrap and before the services deployment. Each secret is stored as JSON with a `value` field.

## Build artifacts

The build stage creates:

- `dist/deployment/webapp.tar.gz`
- `dist/deployment/node-api-<tag>.tar`
- `dist/deployment/agent-gateway-<tag>.tar`
- `dist/deployment/litellm-<tag>.tar`
- `dist/deployment/build.env`

`build.env` is sourced by the deployment script so image tags and artifact locations stay aligned.

The image build scripts prefer `docker buildx build --load`. If Buildx is missing they fall back to legacy `docker build`, but Docker now warns that the legacy builder is deprecated, so installing Buildx is strongly recommended.

## Build commands

Build everything:

```bash
./cicd/build/build_all.sh
```

Build individual artifacts:

```bash
./cicd/build/build_marketing_site.sh
./cicd/build/build_webapp.sh
./cicd/build/build_node_api_image.sh
./cicd/build/build_agent_gateway_image.sh
./cicd/build/build_litellm_image.sh
```

If you want a specific immutable image tag in CI, export it first:

```bash
export IMAGE_TAG="$(git rev-parse --short HEAD)"
./cicd/build/build_all.sh
```

## Deployment workflow

The deploy script runs in this order:

1. Deploy the edge certificate stack in `us-east-1` for CloudFront.
2. Deploy the regional foundation stack in `AWS_REGION`.
3. Push the built container images to the ECR repositories created by the foundation stack.
4. Upload the marketing site to `/` and the Angular application bundle to `/app` in the site bucket.
5. Deploy the ECS services stack with the Node API desired count temporarily set to `0`, plus the image URIs and secret ARNs.
6. Create the dedicated PostgreSQL schema `helmos` if it does not yet exist, then run `prisma migrate deploy` as a one-off ECS task.
7. Scale the Node API service to its steady-state desired count.
8. Invalidate CloudFront.

## Required deployment environment variables

At minimum:

```bash
export AWS_REGION=eu-west-1
export HOSTED_ZONE_ID=Z1234567890ABC
```

Usually you will also set:

```bash
export ROOT_DOMAIN=helm-os.ai
export WWW_DOMAIN=www.helm-os.ai
export API_DOMAIN=api.helm-os.ai
export LIFE2_JWT_SECRET_ARN=arn:aws:secretsmanager:...
export LIFE2_JWT_PUBLIC_KEY_SECRET_ARN=arn:aws:secretsmanager:...
export OPENAI_API_KEY_SECRET_ARN=arn:aws:secretsmanager:...
export ANTHROPIC_API_KEY_SECRET_ARN=arn:aws:secretsmanager:...
export LITELLM_MASTER_KEY_SECRET_ARN=arn:aws:secretsmanager:...
export LANGSMITH_API_KEY_SECRET_ARN=arn:aws:secretsmanager:...
export HELMOS_LANGSMITH_ENABLED=false
export FRONTEND_AUTH_SERVICE_SIGN_IN_URL=https://auth.life-sqrd.com/
export FRONTEND_AUTH_SERVICE_APPLICATION_ID=helmos-web
export FRONTEND_AUTH_SERVICE_SIGN_OUT_URL=https://auth.life-sqrd.com/logout
export FRONTEND_APP_BASE_URL=https://helm-os.ai/app/
export FRONTEND_API_BASE_URL=https://api.helm-os.ai
```

Optional overrides:

- `DEPLOYMENT_STAGE`
- `FOUNDATION_STACK_NAME`
- `SERVICES_STACK_NAME`
- `EDGE_STACK_NAME`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `HELMOS_LOG_LEVEL`
- `HELMOS_DEFAULT_MODEL`
- `HELMOS_SUPERVISOR_MODEL`

## Bootstrap command

Run this first to create certificates, networking, AWS resources, and the Secrets Manager entries:

```bash
export AWS_REGION=eu-west-1
export HOSTED_ZONE_ID=Z1234567890ABC
./cicd/serverless/bootstrap.sh
```

After that, open the created secrets in the AWS Console and populate their `value` fields.

## Deploy command

```bash
./cicd/serverless/deploy.sh
```

## Operational notes

- `deploy.sh` now assumes the foundation stack already exists and will stop early if the OpenAI or LiteLLM master key secrets are still empty.
- The Node API now accepts production browser origins through `CORS_ALLOWED_ORIGINS`, which the ECS service injects as `https://helm-os.ai,https://www.helm-os.ai,https://api.helm-os.ai`.
- The FastAPI service already supports configurable CORS through `HELMOS_CORS_ALLOWED_ORIGINS`.
- Because CloudFront fronts both the SPA and API routes, most browser traffic remains same-origin at `helm-os.ai`.
- The RDS instance is created with deletion protection enabled; if you need ephemeral environments, disable that in the template for non-production stages.
- The current Redis template uses a single-node ElastiCache cluster to keep the initial production setup straightforward. Scale or replace it with a more resilient topology as traffic grows.

## Rollback

- Re-run the deploy with a previous `IMAGE_TAG` to roll the application containers back.
- Restore a previous frontend asset version from the site bucket if the web bundle needs to be reverted independently.
- Use CloudFormation stack rollback or change sets for infrastructure-level recovery.
