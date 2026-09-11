#!/bin/bash
set -e

LOCK_FILE=".migration_completed"

if [ -f "$LOCK_FILE" ] && [ "$1" != "--force" ]; then
    echo "⚠️ ATENÇÃO: A migration já foi executada anteriormente (arquivo '$LOCK_FILE' presente)."
    echo "Para proteger seus dados existentes de serem apagados, a migration foi ignorada."
    echo "Caso deseje forçar a recriação do banco, execute: ./run_migration_docker.sh --force"
    exit 0
fi

CONTAINER_NAME="precifiq-postgres-1"

# Verifica se o container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    CONTAINER_NAME="postgres"
fi

if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container PostgreSQL não encontrado ou não está rodando!"
    echo "Inicie com: ./deploy-db.sh start ou docker compose --profile db up -d postgres"
    exit 1
fi

echo "================================================================="
echo "🚀 EXECUTANDO MIGRATION NO CONTAINER '$CONTAINER_NAME'"
echo "================================================================="

docker exec -i "$CONTAINER_NAME" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql'

echo ""
echo "🔍 Validando contagem de registros no schema 'controle':"
docker exec -i "$CONTAINER_NAME" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) AS total_unidades FROM controle.unidade_medida; SELECT COUNT(*) AS total_fornecedores FROM controle.fornecedor; SELECT COUNT(*) AS total_insumos FROM controle.insumo;"'

touch "$LOCK_FILE"
echo ""
echo "🔒 Trava '$LOCK_FILE' criada! Migration desabilitada para execuções automáticas futuras."
echo ""
echo "🎉 MIGRATION EXECUTADA COM SUCESSO NO DOCKER!"
