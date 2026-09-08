#!/bin/bash

# Database Management Script (PostgreSQL Container)
# Usage: ./deploy-db.sh [start|stop|restart|logs|status]

set -e

ACTION="${1:-start}"

# Determine docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

case "$ACTION" in
    start)
        echo "🐘 Starting PostgreSQL container (profile: db)..."
        $DOCKER_COMPOSE --profile db up -d postgres
        echo "⏳ Waiting for PostgreSQL to be ready..."
        $DOCKER_COMPOSE --profile db exec -T postgres pg_isready -U "${DB_USER:-controle_user}" -d "${DB_NAME:-controle_silvia}" || true
        echo "✅ PostgreSQL is running!"
        ;;
    stop)
        echo "🛑 Stopping PostgreSQL container..."
        $DOCKER_COMPOSE --profile db stop postgres
        echo "✅ PostgreSQL stopped."
        ;;
    restart)
        echo "🔄 Restarting PostgreSQL container..."
        $DOCKER_COMPOSE --profile db restart postgres
        echo "✅ PostgreSQL restarted."
        ;;
    logs)
        $DOCKER_COMPOSE --profile db logs -f postgres
        ;;
    migrate)
        echo "🚀 Executando migration no container PostgreSQL (schema: controle)..."
        $DOCKER_COMPOSE --profile db exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql'
        echo "✅ Migration executada com sucesso no container!"
        ;;
    *)
        echo "Usage: $0 [start|stop|restart|logs|status|migrate]"
        exit 1
        ;;
esac
