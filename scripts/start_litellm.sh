#!/bin/bash

cd ../src/backend
docker compose -f docker-compose.litellm.yml up -d
