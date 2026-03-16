#!/usr/bin/env bash
# omnilearn.space — One-time VPS setup script
# Run on a fresh Hostinger VPS (Ubuntu 22.04+):
#   curl -fsSL https://raw.githubusercontent.com/ismailidrissi-sudo/omni-learn/master/scripts/deploy-init.sh | bash
#
# Prerequisites: SSH into your VPS as root

set -euo pipefail

DOMAIN="omnilearn.space"
APP_DIR="/opt/omnilearn"
REPO_URL="https://github.com/ismailidrissi-sudo/omni-learn.git"

echo "==> Updating system packages..."
apt-get update && apt-get upgrade -y

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "==> Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

echo "==> Installing Certbot..."
apt-get install -y certbot

echo "==> Creating app directory..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "==> Cloning repository..."
if [ -d ".git" ]; then
  echo "    Repo already cloned, pulling latest..."
  git pull origin master
else
  git clone "$REPO_URL" .
fi

echo "==> Obtaining SSL certificate..."
echo "    Make sure DNS A record for $DOMAIN points to this server's IP."
certbot certonly --standalone \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email admin@"$DOMAIN" \
  --preferred-challenges http

echo "==> Setting up Certbot auto-renewal cron..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f $APP_DIR/docker-compose.prod.yml restart nginx") | crontab -

echo ""
echo "==> Initial setup complete!"
echo ""
echo "Next steps:"
echo "  1. Create the production .env file:"
echo "     cp $APP_DIR/.env.example $APP_DIR/.env"
echo "     nano $APP_DIR/.env"
echo ""
echo "  2. Fill in all required values (POSTGRES_PASSWORD, JWT_SECRET, etc.)"
echo ""
echo "  3. Start all services:"
echo "     cd $APP_DIR"
echo "     docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "  4. Run database migrations:"
echo "     docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy"
echo ""
echo "  5. (Optional) Seed the database:"
echo "     docker compose -f docker-compose.prod.yml exec backend npx prisma db seed"
echo ""
echo "Your site will be live at https://$DOMAIN"
