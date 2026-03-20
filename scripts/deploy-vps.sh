#!/usr/bin/env bash
# omnilearn.space — Deploy on VPS (pull, build, migrate, restart)
# Run on the VPS from the app directory after initial setup.
# Usage: ./scripts/deploy-vps.sh   OR   bash scripts/deploy-vps.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/omnilearn}"
COMPOSE_FILE="docker-compose.prod.yml"

cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull origin master

mkdir -p video-proxy/cookies

echo "==> Building images (old containers keep running)..."
docker compose -f "$COMPOSE_FILE" build

echo "==> Rolling update: infrastructure..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --no-build postgres redis
sleep 5

echo "==> Rolling update: backend services..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --no-build backend video-proxy recommendations
sleep 10

echo "==> Rolling update: frontend..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --no-build frontend
sleep 10

echo "==> Reloading nginx (force restart to pick up new container IPs)..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --no-build nginx
docker compose -f "$COMPOSE_FILE" restart nginx

echo "==> Running database schema sync..."
docker compose -f "$COMPOSE_FILE" exec -T backend node node_modules/prisma/build/index.js db push --skip-generate || true

echo "==> Container status..."
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "==> Deploy complete. App is running."
echo "    Logs: docker compose -f $COMPOSE_FILE logs -f"
