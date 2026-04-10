#!/usr/bin/env bash
# Runs on the VPS from /opt/omnilearn after git pull. Expects .env present.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/omnilearn}"
cd "$APP_DIR"

mkdir -p video-proxy/cookies

echo "==> Building images (old containers keep running)..."
docker compose -f docker-compose.prod.yml build

echo "==> Rolling update: infrastructure..."
docker compose -f docker-compose.prod.yml up -d --no-deps --no-build postgres redis
sleep 5

echo "==> Rolling update: backend services (entrypoint runs migrations automatically)..."
docker compose -f docker-compose.prod.yml up -d --no-deps --no-build backend video-proxy recommendations
sleep 5

echo "==> Rolling update: frontend..."
docker compose -f docker-compose.prod.yml up -d --no-deps --no-build frontend
sleep 5

echo "==> Reloading nginx..."
docker compose -f docker-compose.prod.yml up -d --no-deps --no-build nginx
docker compose -f docker-compose.prod.yml restart nginx

echo "==> Container status..."
docker compose -f docker-compose.prod.yml ps

echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Deploy complete!"
