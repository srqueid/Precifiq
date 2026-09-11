-- ==============================================================================
-- SCHEMA DE GOVERNANÇA GLOBAL E CATÁLOGO MULTIEMPRESAS
-- ==============================================================================
-- Compatível com: PostgreSQL Local (Docker), Hostinger VPS e NeonDB (Cloud).
-- Schema alvo: global
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS global;

-- Conceder permissões no schema global
GRANT ALL ON SCHEMA global TO CURRENT_USER;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'public') THEN
        GRANT ALL ON SCHEMA global TO public;
    END IF;
END $$;

-- 1. Empresas (Estrutura Hierárquica Matriz / Filiais)
CREATE TABLE IF NOT EXISTS global.empresa (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL DEFAULT 'MATRIZ', -- 'MATRIZ' ou 'FILIAL'
    matriz_id INTEGER REFERENCES global.empresa(id) ON DELETE SET NULL,
    nome_fantasia VARCHAR(150) NOT NULL,
    razao_social VARCHAR(255),
    cnpj VARCHAR(20) UNIQUE,
    schema_name VARCHAR(63) UNIQUE NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_empresa_matriz ON global.empresa(matriz_id);
CREATE INDEX IF NOT EXISTS idx_empresa_schema ON global.empresa(schema_name);
CREATE INDEX IF NOT EXISTS idx_empresa_tipo ON global.empresa(tipo);

-- 2. Perfis de Acesso (RBAC)
CREATE TABLE IF NOT EXISTS global.perfil (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL, -- 'SUPERUSER', 'ADMIN_MATRIZ', 'GERENTE_FILIAL', 'OPERADOR'
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    permissoes TEXT
);

-- 3. Usuários Globais
CREATE TABLE IF NOT EXISTS global.usuario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuario_email ON global.usuario(email);

-- 4. Associação Usuário x Empresa x Perfil
CREATE TABLE IF NOT EXISTS global.usuario_empresa (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES global.usuario(id) ON DELETE CASCADE,
    empresa_id INTEGER NOT NULL REFERENCES global.empresa(id) ON DELETE CASCADE,
    perfil_id INTEGER NOT NULL REFERENCES global.perfil(id) ON DELETE RESTRICT,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_ue_usuario ON global.usuario_empresa(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ue_empresa ON global.usuario_empresa(empresa_id);

-- 5. Log de Auditoria Central
CREATE TABLE IF NOT EXISTS global.log_auditoria (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(150) NOT NULL,
    funcao VARCHAR(100) NOT NULL DEFAULT 'GERAL',
    atividade_realizada TEXT NOT NULL,
    tabela VARCHAR(100),
    registro_id INTEGER,
    ip_origem VARCHAR(45),
    data_hora TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ga_data_hora ON global.log_auditoria(data_hora);
CREATE INDEX IF NOT EXISTS idx_ga_usuario ON global.log_auditoria(usuario);

-- ==============================================================================
-- CARGA INICIAL (SEEDS)
-- ==============================================================================

-- Perfis Padrão RBAC
INSERT INTO global.perfil (id, codigo, nome, descricao, permissoes)
VALUES 
    (1, 'ADMIN', 'Administrador', 'Acesso irrestrito a todas as matrizes, filiais, usuários e configurações globais', 'GLOBAL_ALL,CONFIG_ALL'),
    (2, 'ADMIN_MATRIZ', 'Administrador da Matriz', 'Gestão completa da matriz e supervisão de todas as suas filiais vinculadas', 'MATRIZ_ALL,FILIAIS_VIEW'),
    (3, 'GERENTE_FILIAL', 'Gerente de Filial', 'Gestão operacional, financeira e de estoque restrita à sua filial', 'FILIAL_ALL'),
    (4, 'OPERADOR', 'Operador Padrão', 'Lançamento de pedidos, produtos, insumos e orçamentos na sua unidade', 'OPERACIONAL_BASIC')
ON CONFLICT (id) DO UPDATE SET
    codigo = EXCLUDED.codigo,
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    permissoes = EXCLUDED.permissoes;

-- Matriz Padrão Inicial (aponta para o schema existente 'controle')
INSERT INTO global.empresa (id, tipo, matriz_id, nome_fantasia, razao_social, cnpj, schema_name, ativo)
VALUES 
    (1, 'MATRIZ', NULL, 'Controle Silvia (Matriz)', 'Silvia Artes & Cosméticos Ltda', '12.345.678/0001-90', 'controle', TRUE)
ON CONFLICT (id) DO UPDATE SET 
    tipo = EXCLUDED.tipo,
    schema_name = EXCLUDED.schema_name;

-- Atualizar sequence se necessário
SELECT setval('global.empresa_id_seq', (SELECT GREATEST(MAX(id), 1) FROM global.empresa));

-- Usuário Superusuário da DcSys Inicial (admin@dcsys.com / admin123 - SHA-256)
-- Hash SHA-256 de 'admin123': 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
INSERT INTO global.usuario (nome, email, senha_hash, is_superuser, ativo)
VALUES 
    ('Superusuário DcSys', 'admin@dcsys.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Vincular Admin à Matriz Padrão com perfil ADMIN
DO $$
DECLARE
    v_user_id INTEGER;
    v_perfil_id INTEGER;
    v_empresa_id INTEGER;
BEGIN
    SELECT id INTO v_user_id FROM global.usuario WHERE email = 'admin@dcsys.com' LIMIT 1;
    SELECT id INTO v_perfil_id FROM global.perfil WHERE codigo = 'ADMIN' LIMIT 1;
    SELECT id INTO v_empresa_id FROM global.empresa WHERE id = 1 LIMIT 1;

    IF v_user_id IS NOT NULL AND v_perfil_id IS NOT NULL AND v_empresa_id IS NOT NULL THEN
        INSERT INTO global.usuario_empresa (usuario_id, empresa_id, perfil_id)
        VALUES (v_user_id, v_empresa_id, v_perfil_id)
        ON CONFLICT (usuario_id, empresa_id) DO NOTHING;
    END IF;
END $$;
