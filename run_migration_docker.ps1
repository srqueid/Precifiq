# Script para rodar a migration diretamente no container Docker
param (
    [switch]$Force
)

$lockFile = ".migration_completed"

if ((Test-Path $lockFile) -and (-not $Force)) {
    Write-Host "⚠️ ATENÇÃO: A migration já foi executada anteriormente (arquivo '$lockFile' presente)." -ForegroundColor Yellow
    Write-Host "Para proteger seus dados existentes de serem apagados, a migration foi ignorada." -ForegroundColor Yellow
    Write-Host "Caso deseje forçar a recriação do banco, use: .\run_migration_docker.ps1 -Force" -ForegroundColor Cyan
    exit 0
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "🚀 EXECUTANDO MIGRATION NO CONTAINER 'precifiq-postgres-1'" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$containerName = "precifiq-postgres-1"

# Verifica se o container está rodando
$running = docker ps --filter "name=$containerName" --format "{{.Names}}"
if (-not $running) {
    $containerName = "postgres"
    $running = docker ps --filter "name=postgres" --format "{{.Names}}"
}

if (-not $running) {
    Write-Host "❌ Container PostgreSQL não encontrado ou não está rodando!" -ForegroundColor Red
    Write-Host "Inicie com: ./deploy-db.sh start ou docker compose --profile db up -d postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host "Conectando ao container: $containerName..." -ForegroundColor Green
docker exec -i $containerName sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/init.sql'

Write-Host "`n🔍 Validando contagem de registros no schema 'controle':" -ForegroundColor Cyan
docker exec -i $containerName sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) AS total_unidades FROM controle.unidade_medida; SELECT COUNT(*) AS total_fornecedores FROM controle.fornecedor; SELECT COUNT(*) AS total_insumos FROM controle.insumo;"'

# Cria o arquivo de trava
New-Item -ItemType File -Name $lockFile -Force | Out-Null
Write-Host "`n🔒 Trava '$lockFile' criada! Migration desabilitada para execuções automáticas futuras." -ForegroundColor Green
Write-Host "`n🎉 MIGRATION EXECUTADA COM SUCESSO NO DOCKER!" -ForegroundColor Green
