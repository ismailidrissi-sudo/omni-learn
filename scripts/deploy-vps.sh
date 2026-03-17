#!/usr/bin/env bash
# omnilearn.space — Deploy on VPS (pull, build, migrate, restart)
# Run on the VPS from the app directory after initial setup (deploy-init.sh).
# Usage: ./scripts/deploy-vps.sh   OR   bash scripts/deploy-vps.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/omnilearn}"
COMPOSE_FILE="docker-compose.prod.yml"

cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull origin master

echo "==> Building and starting services..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> Running database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

echo "==> Restarting backend to pick up migrations..."
docker compose -f "$COMPOSE_FILE" restart backend

echo ""
echo "==> Deploy complete. App is running."
echo "    Logs: docker compose -f $COMPOSE_FILE logs -f"
