#!/bin/bash

# Deploy script for Hostinger VPS
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.production.example to .env and configure it."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Determine docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Migration check: executa apenas no primeiro deploy e desabilita para os próximos
MIGRATION_LOCK_FILE=".migration_completed"
if [ ! -f "$MIGRATION_LOCK_FILE" ] || [ "$FORCE_MIGRATION" = "true" ]; then
    echo "🚀 [PRIMEIRO DEPLOY DETECTADO] Inicializando banco e executando migration no schema 'controle'..."
    $DOCKER_COMPOSE up -d postgres
    
    echo "⏳ Aguardando PostgreSQL ficar pronto..."
    for i in {1..30}; do
        if $DOCKER_COMPOSE exec -T postgres pg_isready -U "${DB_USER:-precifiq_user}" -d "${DB_NAME:-precifiq_db}" > /dev/null 2>&1; then
            echo "✅ PostgreSQL pronto!"
            break
        fi
        sleep 2
    done
    
    echo "⚙️ Aplicando migration (schema 'controle', tabelas e dados iniciais)..."
    $DOCKER_COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql'
    
    touch "$MIGRATION_LOCK_FILE"
    echo "🔒 Trava $MIGRATION_LOCK_FILE criada com sucesso! Migration desabilitada para os próximos deploys."
else
    echo "ℹ️ Migration inicial já executada anteriormente ($MIGRATION_LOCK_FILE presente). Pulando para preservar os dados."
fi

echo "📦 Building application images (backend & frontend)..."
$DOCKER_COMPOSE build backend frontend

echo "🚀 Starting/updating application containers..."
$DOCKER_COMPOSE up -d backend frontend

echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check if backend is healthy
echo "🔍 Checking backend health..."
for i in {1..30}; do
    if curl -f -s http://localhost:8081/api/health > /dev/null || curl -f -s http://localhost:8081/api/dashboard/json > /dev/null; then
        echo "✅ Backend is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Backend health check timeout. Check logs with: $DOCKER_COMPOSE logs backend"
    fi
    sleep 2
done

# Check if frontend is accessible
echo "🔍 Checking frontend..."
if curl -f -s http://localhost > /dev/null; then
    echo "✅ Frontend is accessible!"
else
    echo "⚠️  Frontend check failed. Check logs with: $DOCKER_COMPOSE logs frontend"
fi

echo ""
echo "🎉 Deployment complete! (Database was not touched/recreated)"
echo ""
echo "Services running:"
echo "  - Frontend: http://localhost (or your domain)"
echo "  - Backend API: http://localhost:8081"
echo ""
echo "Database management (optional local DB):"
echo "  - Start local DB: ./deploy-db.sh (or $DOCKER_COMPOSE --profile db up -d postgres)"
echo "  - Stop local DB:  $DOCKER_COMPOSE --profile db stop postgres"
echo ""
echo "Useful commands:"
echo "  - View logs: $DOCKER_COMPOSE logs -f backend frontend"
echo "  - Restart app: $DOCKER_COMPOSE restart backend frontend"
echo "  - Check status: $DOCKER_COMPOSE ps"

