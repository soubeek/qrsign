#!/bin/bash
set -e

echo "=== CheckFlow Production Deployment ==="

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found."
  echo "  cp .env.production.example .env"
  echo "  Then fill in the values."
  exit 1
fi

source .env

if [ -z "$DOMAIN" ]; then
  echo "ERROR: DOMAIN not set in .env"
  exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "CHANGE_ME_STRONG_PASSWORD_HERE" ]; then
  echo "ERROR: POSTGRES_PASSWORD not configured in .env"
  exit 1
fi

echo "Domain: $DOMAIN"

# Ensure web network exists (for Traefik)
docker network inspect web >/dev/null 2>&1 || docker network create web

# Build and start
echo ""
echo "1/3 Building containers..."
docker compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "2/3 Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "3/3 Checking health..."
sleep 5
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Deployment complete ==="
echo ""
echo "  Public:  https://$DOMAIN/"
echo "  Admin:   https://$DOMAIN/admin/"
echo "  API:     https://$DOMAIN/api/"
echo "  Health:  https://$DOMAIN/health"
echo ""
echo "First deploy? Seed the database:"
echo "  docker compose -f docker-compose.prod.yml exec api npx prisma db seed"
echo ""
echo "View logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Backup database:"
echo "  ./scripts/backup.sh"
