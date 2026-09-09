# Precifiq - Sistema de Precificação e Gestão

Sistema completo de precificação, controle de insumos, fichas técnicas, compras, estoque e vendas.

- **Backend**: Kotlin 2.1 + Ktor 2.3 + Netty + Exposed + PostgreSQL
- **Frontend**: React 18 + Vite + TypeScript + Lucide Icons + TanStack Query

---

## 🚀 Execução Local Rápida (Windows PowerShell)

O projeto possui um script de automação [`run_local.ps1`](./run_local.ps1) que valida pré-requisitos, compila o backend e frontend, inicia ambos os serviços em janelas dedicadas e abre o navegador.

### 1. Iniciar Aplicação (Compila e Roda)
```powershell
.\run_local.ps1
```
> O backend iniciará em `http://localhost:8081` e o frontend em `http://localhost:5173`. O navegador abrirá automaticamente.

### 2. Apenas Compilar e Validar (Sem Iniciar)
```powershell
.\run_local.ps1 -BuildOnly
```

### 3. Iniciar Rapidamente (Pulando Recompilação)
```powershell
.\run_local.ps1 -SkipCompile
```

### 4. Encerrar Servidores em Execução
```powershell
.\run_local.ps1 -Stop
```

### 5. Reiniciar Servidores
```powershell
.\run_local.ps1 -Restart
```

### 6. Executar Compilação com Testes Unitários
```powershell
.\run_local.ps1 -WithTests
```

---

## 🐘 Banco de Dados (PostgreSQL)

- O backend conecta por padrão no PostgreSQL em `localhost:5432` conforme configurado em `backend/.env`.
- Para subir o banco via Docker:
  ```powershell
  docker compose --profile db up -d postgres
  # ou no Linux/WSL:
  ./deploy-db.sh start
  ```
- Para rodar as migrations iniciais de seed:
  ```powershell
  .\run_migration_docker.ps1
  ```

---

## 🛠️ Portas e Endpoints

| Serviço | URL Local | Descrição |
| :--- | :--- | :--- |
| **Frontend Web** | `http://localhost:5173` | Aplicação React SPA |
| **Backend API** | `http://localhost:8081` | Servidor Ktor / API REST |
| **Healthcheck** | `http://localhost:8081/api/health` | Status da API |
