# Deploy na Hostinger VPS com Docker

Este guia explica como fazer o deploy da aplicação em uma VPS Hostinger usando Docker.

## Pré-requisitos na VPS

1. **Docker** instalado
2. **Docker Compose** instalado
3. **Git** instalado
4. Portas **80** e **443** liberadas no firewall
5. (Opcional) Domínio configurado apontando para a VPS

## Passo 1: Preparar o Ambiente

```bash
# Atualizar o sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Adicionar usuário ao grupo docker (opcional, para não usar sudo)
sudo usermod -aG docker $USER
newgrp docker
```

## Passo 2: Clonar o Repositório

```bash
git clone https://github.com/srqueid/precifiq.git /opt/precifiq
cd /opt/precifiq
```

## Passo 3: Configurar Variáveis de Ambiente

```bash
# Copiar o arquivo de exemplo
cp .env.production.example .env

# Editar com suas configurações
nano .env
```

Configure pelo menos:
- `DB_PASSWORD` - Senha segura para o banco de dados
- (Opcional) Altere `DB_HOST` se usar banco externo (NeonDB, etc.)

## Passo 4: Deploy da Aplicação (Backend e Frontend)

O processo de deploy (`./deploy.sh` ou GitHub Actions) possui proteção automática:
- **No 1º Deploy:** Detecta a ausência da trava `.migration_completed`, sobe o banco de dados PostgreSQL (`controle-silvia-postgres-1`), aplica a migration inicial no schema `controle` (com fornecedores, insumos e unidades) e cria a trava `.migration_completed`.
- **Nos próximos Deploys:** Detecta a trava `.migration_completed` e **pula automaticamente a migration**, atualizando apenas os containers da aplicação (`backend` e `frontend`) sem tocar no banco de dados e sem apagar nenhum dado.

```bash
# Tornar os scripts executáveis
chmod +x deploy.sh deploy-db.sh run_migration_docker.sh

# Executar deploy da aplicação
./deploy.sh
```

Ou manualmente via Docker Compose:

```bash
# Build das imagens de backend e frontend
docker compose build backend frontend

# Subir/atualizar apenas os containers da aplicação
docker compose up -d backend frontend
```

## Passo 5: Gerenciamento do Banco de Dados

### Opção A: Banco Externo (NeonDB, AWS RDS, Supabase, etc.) - Padrão
1. Apenas configure as variáveis de conexão no `.env`:
   ```
   DB_HOST=seu-host-externo.neon.tech
   DB_NAME=neondb
   DB_USER=seu-usuario
   DB_PASSWORD=sua-senha
   DB_SSLMODE=require
   ```
2. O deploy da aplicação (`./deploy.sh` ou CI/CD GitHub Actions) conectará diretamente ao banco externo sem subir nenhum container local de banco.

### Opção B: PostgreSQL em Container Local (Isolado)
O serviço `postgres` está configurado com o profile `db`, garantindo que ele **não seja afetado** pelos deploys da aplicação.

Para gerenciar o container PostgreSQL local:
```bash
# Iniciar o banco de dados
./deploy-db.sh start
# ou: docker compose --profile db up -d postgres

# Parar o banco de dados
./deploy-db.sh stop

# Ver logs do banco
./deploy-db.sh logs

# Acessar o console do banco
docker compose --profile db exec postgres psql -U controle_user -d controle_silvia
```

## Passo 6: Verificar Integridade

```bash
# Verificar status dos containers da aplicação
docker compose ps

# Ver logs da aplicação
docker compose logs -f backend frontend

# Testar saúde do backend
curl http://localhost:8081/api/health

# Testar frontend
curl http://localhost
```

## SSL/HTTPS e Roteamento com Traefik

A aplicação está configurada para roteamento automático via **Traefik** com TLS automático Let's Encrypt para o domínio `precifiq.dcsys.info`:

- **Rede Compartilhada:** O Traefik e a aplicação se comunicam através da rede Docker `app-network`.
  ```bash
  # Criar a rede caso ainda não exista na VPS
  docker network create app-network 2>/dev/null || true
  ```

- **Roteamento Configurado:**
  - `https://precifiq.dcsys.info/api/*` -> Encaminhado para o container `backend` (porta interna `8081`).
  - `https://precifiq.dcsys.info/*` -> Encaminhado para o container `frontend` (porta interna `80`).
  - Certificado SSL obtido automaticamente pelo `certresolver=letsencrypt`.

- **DNS Necessário:**
  - Crie uma entrada DNS **Tipo A** no seu gerenciador de domínio:
    - Host: `precifiq.dcsys.info` (ou subdomínio desejado)
    - Valor: IP público da sua VPS Hostinger

## Comandos Úteis

```bash
# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend

# Parar todos os serviços
docker-compose down

# Reiniciar um serviço
docker-compose restart backend

# Ver status
docker-compose ps

# Executar comando no container
docker-compose exec backend sh

# Backup do banco de dados
docker-compose exec postgres pg_dump -U controle_user controle_silvia > backup.sql

# Restaurar backup
docker-compose exec -T postgres psql -U controle_user -d controle_silvia < backup.sql
```

## Atualizações

Para atualizar a aplicação:

```bash
cd /opt/precifiq
git pull
./deploy.sh
```

## Solução de Problemas

### Backend não inicia
```bash
docker-compose logs backend
```

### Frontend não carrega
```bash
docker-compose logs frontend
```

### Problemas com banco de dados
```bash
docker-compose logs postgres
docker-compose exec postgres pg_isready -U controle_user
```

### Porta já em uso
Verifique se outra aplicação está usando a porta 80 ou 8081:
```bash
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :8081
```

## Estrutura dos Arquivos Docker

```
.
├── backend/
│   ├── Dockerfile          # Build do backend Kotlin/Ktor
│   └── .dockerignore       # Arquivos ignorados no build
├── frontend/
│   ├── Dockerfile          # Build do frontend + Nginx
│   ├── nginx.conf          # Configuração do Nginx
│   └── .dockerignore       # Arquivos ignorados no build
├── docker-compose.yml      # Orquestração dos serviços
├── .env.example            # Exemplo de variáveis de ambiente
├── .env.production.example # Configuração de produção
└── deploy.sh               # Script de deploy automatizado
```
