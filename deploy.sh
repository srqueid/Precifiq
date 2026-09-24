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

# Load .env variables (exporting DB configuration)
set -a
# shellcheck disable=SC1091
source .env
set +a

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

# Ensure the external docker network exists
docker network inspect precifiq-app-network >/dev/null 2>&1 || docker network create precifiq-app-network

# ==============================================================================
# BANCO DE DADOS: DEPLOY AUTOMÁTICO APENAS NA 1ª VEZ (PULAR SE JÁ EXISTIR)
# ==============================================================================
MIGRATION_LOCK_FILE=".migration_completed"
DB_HOST_VAL="${DB_HOST:-ep-winter-wildflower-ap91sljr-pooler.c-7.us-east-1.aws.neon.tech}"
DB_PORT_VAL="${DB_PORT:-5432}"
DB_USER_VAL="${DB_USER:-neondb_owner}"
DB_NAME_VAL="${DB_NAME:-neondb}"

if [ "$DB_HOST_VAL" = "postgres" ] || [ "$DB_HOST_VAL" = "localhost" ] || [ "$DB_HOST_VAL" = "127.0.0.1" ]; then
    echo "🐘 Gerenciando container PostgreSQL local..."
    
    # Inicia o container PostgreSQL (se já estiver rodando, docker compose apenas mantém ativo)
    $DOCKER_COMPOSE --profile db up -d postgres

    echo "⏳ Aguardando PostgreSQL ficar pronto..."
    for i in {1..30}; do
        if $DOCKER_COMPOSE exec -T postgres pg_isready -p "$DB_PORT_VAL" -U "$DB_USER_VAL" -d "$DB_NAME_VAL" > /dev/null 2>&1; then
            echo "✅ PostgreSQL está pronto e respondendo!"
            break
        fi
        if [ "$i" -eq 30 ]; then
            echo "⚠️ Timeout aguardando PostgreSQL. Verifique os logs com: $DOCKER_COMPOSE logs postgres"
        fi
        sleep 2
    done

    # Verifica se o banco já existe (por trava ou por checagem do schema)
    DB_ALREADY_INITIALIZED=false
    if [ -f "$MIGRATION_LOCK_FILE" ]; then
        DB_ALREADY_INITIALIZED=true
    else
        # Se a trava não existir, checa diretamente no banco se o schema 'controle' já existe
        if $DOCKER_COMPOSE exec -T postgres psql -p "$DB_PORT_VAL" -U "$DB_USER_VAL" -d "$DB_NAME_VAL" -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'controle';" 2>/dev/null | grep -q 1; then
            echo "ℹ️ Schema 'controle' já existente detectado no PostgreSQL."
            touch "$MIGRATION_LOCK_FILE"
            DB_ALREADY_INITIALIZED=true
        fi
    fi

    if [ "$DB_ALREADY_INITIALIZED" = "true" ] && [ "$FORCE_MIGRATION" != "true" ]; then
        echo "ℹ️ Banco de dados já existente ($MIGRATION_LOCK_FILE presente). Pulando deploy/migration do banco para preservar todos os dados."
    else
        echo "🚀 [PRIMEIRO DEPLOY DETECTADO] Executando carga e estrutura inicial do banco de dados (init.sql)..."
        $DOCKER_COMPOSE exec -T postgres sh -c 'psql -p "$PGPORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql'
        touch "$MIGRATION_LOCK_FILE"
        echo "🔒 Trava $MIGRATION_LOCK_FILE criada com sucesso! Nas próximas execuções, o deploy do banco será pulado."
    fi
else
    echo "ℹ️ Banco externo configurado ($DB_HOST_VAL). Pulando deploy do container local do PostgreSQL."
fi

# ==============================================================================
# APLICAÇÃO (BACKEND E FRONTEND)
# ==============================================================================
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
    if [ "$i" -eq 30 ]; then
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
echo "🎉 Deployment complete! (Database was preserved)"
echo ""
echo "Services running:"
echo "  - Frontend Web: https://${DOMAIN:-precifiq.dcsys.info} (ou http://localhost)"
echo "  - Backend Web API: https://${DOMAIN:-precifiq.dcsys.info}/api"
echo "  - Mobile App API: https://${API_DOMAIN:-apiprecifiq.dcsys.info}"
echo "  - Backend Local: http://localhost:8081"
if [ "$DB_HOST_VAL" = "postgres" ] || [ "$DB_HOST_VAL" = "localhost" ] || [ "$DB_HOST_VAL" = "127.0.0.1" ]; then
    echo "  - PostgreSQL: localhost:$DB_PORT_VAL (local Docker)"
else
    echo "  - PostgreSQL: $DB_HOST_VAL (NeonDB Cloud)"
fi
echo ""
echo "Database management commands:"
echo "  - Status DB:  ./deploy-db.sh status"
echo "  - Logs DB:    ./deploy-db.sh logs"
echo "  - Restart DB: ./deploy-db.sh restart"
echo "  - Stop DB:    ./deploy-db.sh stop"
echo ""
echo "Useful commands:"
echo "  - View logs: $DOCKER_COMPOSE logs -f backend frontend"
echo "  - Restart app: $DOCKER_COMPOSE restart backend frontend"
echo "  - Check status: $DOCKER_COMPOSE ps"
