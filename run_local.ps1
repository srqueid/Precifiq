<#
.SYNOPSIS
    Script de automação para compilar e executar o projeto Precifiq localmente.

.DESCRIPTION
    Valida os pré-requisitos (Java, Maven, Node, PostgreSQL/Docker),
    compila o backend (Kotlin/Maven), instala/valida o frontend (React/Vite),
    inicia ambos os serviços em janelas dedicadas e abre a aplicação no navegador.

.PARAMETER BuildOnly
    Apenas compila o backend e frontend, sem iniciar os servidores.

.PARAMETER SkipCompile
    Inicia os servidores diretamente sem recompilar o backend.

.PARAMETER WithTests
    Executa os testes unitários durante a compilação do backend.

.PARAMETER NoBrowser
    Não abre o navegador automaticamente após iniciar os serviços.

.PARAMETER Stop
    Encerra os processos do backend (porta 8081) e frontend (porta 5173).

.PARAMETER Restart
    Encerra instâncias anteriores em execução e inicia novamente.

.PARAMETER BackendPort
    Porta do servidor backend Ktor (padrão: 8081).

.PARAMETER FrontendPort
    Porta do servidor frontend Vite (padrão: 5173).

.EXAMPLE
    .\run_local.ps1
    Compila o projeto e inicia backend e frontend abrindo o navegador.

.EXAMPLE
    .\run_local.ps1 -BuildOnly
    Apenas valida a compilação do backend e frontend.

.EXAMPLE
    .\run_local.ps1 -Stop
    Para os servidores que estiverem rodando nas portas 8081 e 5173.

.EXAMPLE
    .\run_local.ps1 -Restart
    Reinicia os servidores.
#>

[CmdletBinding()]
param (
    [switch]$BuildOnly,
    [switch]$SkipCompile,
    [switch]$WithTests,
    [switch]$NoBrowser,
    [switch]$Stop,
    [switch]$Restart,
    [int]$BackendPort = 8081,
    [int]$FrontendPort = 5173
)

# Configura encoding do console para UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = (Get-Location).Path
}
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " [PRECIFI-Q] AMBIENTE DE DESENVOLVIMENTO LOCAL" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# Função utilitária para parar processos nas portas especificadas
# -----------------------------------------------------------------------------
function Stop-PortProcesses {
    param([int[]]$Ports)
    foreach ($p in $Ports) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
            if ($connections) {
                $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
                foreach ($pidToKill in $processIds) {
                    if ($pidToKill -gt 4) {
                        $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
                        $procName = if ($proc) { $proc.ProcessName } else { "PID " + $pidToKill }
                        Write-Host "Encerrando processo $procName (PID $pidToKill) na porta $p..." -ForegroundColor Yellow
                        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                    }
                }
                Write-Host "Porta $p liberada com sucesso." -ForegroundColor Green
            } else {
                Write-Host "Nenhum processo ativo encontrado na porta $p." -ForegroundColor Gray
            }
        } catch {
            $errDetail = $_.ToString()
            Write-Warning "Falha ao verificar a porta ${p}: $errDetail"
        }
    }
}

# Se solicitado -Stop ou -Restart
if ($Stop -or $Restart) {
    Write-Host "`nVerificando processos nas portas $BackendPort e $FrontendPort..." -ForegroundColor Cyan
    Stop-PortProcesses -Ports @($BackendPort, $FrontendPort)
    if ($Stop -and -not $Restart) {
        Write-Host "`nServicos finalizados com sucesso." -ForegroundColor Green
        exit 0
    }
    Start-Sleep -Seconds 1
}

# -----------------------------------------------------------------------------
# 1. Validação de Pré-requisitos
# -----------------------------------------------------------------------------
Write-Host "`nVerificando pre-requisitos do ambiente..." -ForegroundColor Cyan

# Java
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCmd) {
    Write-Host "Java nao encontrado no PATH! Instale o JDK 17 ou 21." -ForegroundColor Red
    exit 1
}
$javaVersion = & java -version 2>&1 | Select-Object -First 1
Write-Host "  [OK] Java: $javaVersion" -ForegroundColor Green

# Maven
$mvnCmd = Get-Command mvn -ErrorAction SilentlyContinue
if (-not $mvnCmd) {
    Write-Host "Maven (mvn) nao encontrado no PATH!" -ForegroundColor Red
    exit 1
}
$mvnVersion = & mvn -v 2>&1 | Select-Object -First 1
Write-Host "  [OK] Maven: $mvnVersion" -ForegroundColor Green

# Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "Node.js nao encontrado no PATH! Instale o Node.js v18+." -ForegroundColor Red
    exit 1
}
$nodeVersion = & node -v
Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor Green

# npm
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Host "npm nao encontrado no PATH!" -ForegroundColor Red
    exit 1
}
$npmVersion = & npm -v
Write-Host "  [OK] npm: v$npmVersion" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. Verificação do Banco de Dados (PostgreSQL)
# -----------------------------------------------------------------------------
Write-Host "`nVerificando conectividade com o Banco de Dados (porta 5432)..." -ForegroundColor Cyan
$dbConnection = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($dbConnection) {
    Write-Host "  [OK] PostgreSQL ativo e respondendo na porta 5432." -ForegroundColor Green
} else {
    Write-Host "  [AVISO] Porta 5432 nao respondeu localmente." -ForegroundColor Yellow
    
    # Verifica se Docker está disponível para subir o container
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    $dockerRunning = $false
    if ($dockerCmd) {
        $null = & docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerRunning = $true
        }
    }

    if ($dockerRunning) {
        Write-Host "  Tentando iniciar o container PostgreSQL via Docker..." -ForegroundColor Yellow
        & docker compose --profile db up -d postgres 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        $dbConnectionRetry = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($dbConnectionRetry) {
            Write-Host "  [OK] Container PostgreSQL iniciado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "  [INFO] Container foi iniciado; aguardando inicializacao do servico." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [INFO] Para usar Postgres local com Docker, inicie o Docker Desktop ou './deploy-db.sh start'." -ForegroundColor Gray
        Write-Host "  [INFO] Caso utilize banco em nuvem (NeonDB), verifique as credenciais no 'backend/.env'." -ForegroundColor Gray
    }
}

# -----------------------------------------------------------------------------
# 3. Sincronização e Validação do arquivo .env
# -----------------------------------------------------------------------------
$backendEnv = Join-Path $backendDir ".env"
$rootEnv = Join-Path $rootDir ".env"

if (-not (Test-Path $backendEnv)) {
    $backendEnvExample = Join-Path $backendDir ".env.example"
    if (Test-Path $backendEnvExample) {
        Write-Host "`nArquivo '$backendEnv' ausente. Criando a partir de .env.example..." -ForegroundColor Yellow
        Copy-Item -Path $backendEnvExample -Destination $backendEnv
    } else {
        Write-Host "Aviso: '$backendEnv' nao existe. O backend utilizara variaveis de ambiente do sistema." -ForegroundColor Yellow
    }
}

if ((Test-Path $backendEnv) -and (-not (Test-Path $rootEnv))) {
    Copy-Item -Path $backendEnv -Destination $rootEnv -Force
}

# -----------------------------------------------------------------------------
# 4. Compilação do Backend (Kotlin / Maven)
# -----------------------------------------------------------------------------
if (-not $SkipCompile) {
    Write-Host "`n[1/2] Compilando Backend (Kotlin + Maven)..." -ForegroundColor Cyan
    Push-Location $backendDir
    try {
        if ($WithTests) {
            Write-Host "  Executando compilacao com testes unitarios..." -ForegroundColor Gray
            & mvn -B clean test-compile
        } else {
            Write-Host "  Executando compilacao rapida..." -ForegroundColor Gray
            & mvn -B clean compile -DskipTests
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Host "`n[ERRO] Falha na compilacao do Backend! Verifique os logs acima." -ForegroundColor Red
            Pop-Location
            exit $LASTEXITCODE
        }
        Write-Host "  [OK] Backend compilado com sucesso!" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[INFO] Compilacao do Backend ignorada (-SkipCompile)." -ForegroundColor Gray
}

# -----------------------------------------------------------------------------
# 5. Dependências e Compilação do Frontend (Vite / React)
# -----------------------------------------------------------------------------
Write-Host "`n[2/2] Verificando Frontend (React + Vite)..." -ForegroundColor Cyan
$frontendNodeModules = Join-Path $frontendDir "node_modules"

Push-Location $frontendDir
try {
    if (-not (Test-Path $frontendNodeModules)) {
        Write-Host "  Dependencias do Frontend ausentes. Executando 'npm install'..." -ForegroundColor Yellow
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERRO] Falha ao instalar dependencias do Frontend!" -ForegroundColor Red
            Pop-Location
            exit $LASTEXITCODE
        }
        Write-Host "  [OK] Dependencias do Frontend instaladas!" -ForegroundColor Green
    } else {
        Write-Host "  [OK] node_modules presente." -ForegroundColor Green
    }

    if ($BuildOnly) {
        Write-Host "  Executando build de producao do Frontend (-BuildOnly)..." -ForegroundColor Gray
        & npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERRO] Falha no build do Frontend!" -ForegroundColor Red
            Pop-Location
            exit $LASTEXITCODE
        }
        Write-Host "  [OK] Frontend compilado com sucesso!" -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# Se for apenas compilação (-BuildOnly), encerra com sucesso
if ($BuildOnly) {
    Write-Host "`n================================================================" -ForegroundColor Green
    Write-Host " COMPILACAO CONCLUIDA COM SUCESSO! (-BuildOnly)" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    exit 0
}

# -----------------------------------------------------------------------------
# 6. Inicialização dos Serviços em Janelas Dedicadas
# -----------------------------------------------------------------------------
Write-Host "`nIniciando servidores locais..." -ForegroundColor Cyan

# Detecta shell para inicialização
$psExe = if (Get-Command pwsh.exe -ErrorAction SilentlyContinue) { "pwsh.exe" } else { "powershell.exe" }

# Comando do Backend
Write-Host "  [>] Iniciando Backend Ktor na porta $BackendPort..." -ForegroundColor Yellow
$backendCmd = "`$Host.UI.RawUI.WindowTitle = 'Precifiq - Backend (Porta $BackendPort)'; Set-Location '$backendDir'; Write-Host '===================================================' -ForegroundColor Green; Write-Host ' PRECIFIFQ - BACKEND (KTOR :$BackendPort)' -ForegroundColor Green; Write-Host ' Pressione Ctrl+C para encerrar o backend.' -ForegroundColor Gray; Write-Host '===================================================' -ForegroundColor Green; mvn exec:java"
Start-Process -FilePath $psExe -ArgumentList @("-NoExit", "-Command", $backendCmd)

# Comando do Frontend
Write-Host "  [>] Iniciando Frontend Vite na porta $FrontendPort..." -ForegroundColor Cyan
$frontendCmd = "`$Host.UI.RawUI.WindowTitle = 'Precifiq - Frontend (Porta $FrontendPort)'; Set-Location '$frontendDir'; Write-Host '===================================================' -ForegroundColor Cyan; Write-Host ' PRECIFIFQ - FRONTEND (VITE :$FrontendPort)' -ForegroundColor Cyan; Write-Host ' Pressione Ctrl+C para encerrar o frontend.' -ForegroundColor Gray; Write-Host '===================================================' -ForegroundColor Cyan; npm run dev"
Start-Process -FilePath $psExe -ArgumentList @("-NoExit", "-Command", $frontendCmd)

# -----------------------------------------------------------------------------
# 7. Aguarda inicialização e Healthcheck
# -----------------------------------------------------------------------------
Write-Host "`nAguardando servicos responderem..." -ForegroundColor Gray
$backendReady = $false
$maxAttempts = 15

for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/health" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($response -and $response.status -eq "ok") {
            $backendReady = $true
            break
        }
    } catch {
        # Aguarda próxima tentativa
    }
}

if ($backendReady) {
    Write-Host "  [OK] Backend respondendo em http://localhost:$BackendPort" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Backend esta em processo de inicializacao." -ForegroundColor Yellow
}

# Abre o navegador
if (-not $NoBrowser) {
    Start-Sleep -Seconds 1
    Write-Host "`nAbrindo aplicacao no navegador padrao (http://localhost:$FrontendPort)..." -ForegroundColor Green
    Start-Process "http://localhost:$FrontendPort"
}

# -----------------------------------------------------------------------------
# 8. Painel Resumo
# -----------------------------------------------------------------------------
Write-Host "`n================================================================" -ForegroundColor Green
Write-Host " APLICACAO PRECIFIFQ INICIADA COM SUCESSO!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  Frontend (Web):      http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  Backend (API Ktor):  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  Healthcheck:         http://localhost:$BackendPort/api/health" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  Dicas uteis:" -ForegroundColor Cyan
Write-Host "   - Os logs em tempo real estao nas janelas abertas de cada servico." -ForegroundColor Gray
Write-Host "   - Para parar ambos os servicos a qualquer momento, execute:" -ForegroundColor Gray
Write-Host "     .\run_local.ps1 -Stop" -ForegroundColor Yellow
Write-Host "   - Para reiniciar os servicos:" -ForegroundColor Gray
Write-Host "     .\run_local.ps1 -Restart" -ForegroundColor Yellow
Write-Host "================================================================`n" -ForegroundColor Green
