#!/bin/bash

# Database Management Script (PostgreSQL Container)
# Usage: ./deploy-db.sh [start|stop|restart|logs|status|migrate]

set -e

ACTION="${1:-start}"

# Determine docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Load .env variables if present
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

DB_PORT_VAL="${DB_PORT:-5444}"
DB_USER_VAL="${DB_USER:-precifiq_user}"
DB_NAME_VAL="${DB_NAME:-precifiq_db}"

case "$ACTION" in
    start)
        echo "🐘 Starting PostgreSQL container..."
        $DOCKER_COMPOSE up -d postgres
        echo "⏳ Waiting for PostgreSQL to be ready..."
        for i in {1..30}; do
            if $DOCKER_COMPOSE exec -T postgres pg_isready -p "$DB_PORT_VAL" -U "$DB_USER_VAL" -d "$DB_NAME_VAL" > /dev/null 2>&1; then
                echo "✅ PostgreSQL is running and ready on port $DB_PORT_VAL!"
                break
            fi
            sleep 2
        done
        ;;
    stop)
        echo "🛑 Stopping PostgreSQL container..."
        $DOCKER_COMPOSE stop postgres
        echo "✅ PostgreSQL stopped."
        ;;
    restart)
        echo "🔄 Restarting PostgreSQL container..."
        $DOCKER_COMPOSE restart postgres
        echo "✅ PostgreSQL restarted."
        ;;
    status)
        $DOCKER_COMPOSE ps postgres
        ;;
    logs)
        $DOCKER_COMPOSE logs -f postgres
        ;;
    migrate)
        echo "🚀 Executando migration no container PostgreSQL (schema: controle)..."
        $DOCKER_COMPOSE exec -T postgres sh -c 'psql -p "$PGPORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql'
        touch .migration_completed
        echo "✅ Migration executada com sucesso no container e trava .migration_completed atualizada!"
        ;;
    *)
        echo "Usage: $0 [start|stop|restart|logs|status|migrate]"
        exit 1
        ;;
esac
