package org.example

import io.github.cdimascio.dotenv.dotenv
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction
import java.sql.Connection

object DatabaseConfig {

    private val dotenv = dotenv {
        val curDir = System.getProperty("user.dir")
        val envInCur = java.io.File(curDir, ".env")
        val envInParent = java.io.File(curDir, "../.env")
        val envInBackend = java.io.File(curDir, "backend/.env")

        directory = when {
            envInCur.exists() -> curDir
            envInParent.exists() -> java.io.File(curDir, "..").canonicalPath
            envInBackend.exists() -> java.io.File(curDir, "backend").canonicalPath
            else -> curDir
        }
        filename = ".env"
        ignoreIfMissing = true
    }

    fun env(key: String): String? {
        val sysVal = System.getenv(key)
        if (!sysVal.isNullOrBlank()) return sysVal
        val dotVal = dotenv[key]
        if (!dotVal.isNullOrBlank()) return dotVal
        return null
    }

    fun connect() {
        val jdbcUrl = env("JDBC_DATABASE_URL")
        val host = env("DB_HOST") ?: "ep-winter-wildflower-ap91sljr-pooler.c-7.us-east-1.aws.neon.tech"
        val port = env("DB_PORT") ?: "5432"
        val dbName = env("DB_NAME") ?: "neondb"
        val user = env("DB_USER") ?: env("JDBC_DATABASE_USERNAME") ?: "neondb_owner"
        val password = env("DB_PASSWORD") ?: env("JDBC_DATABASE_PASSWORD") ?: "npg_OnP97uVYqigX"
        val sslMode = env("DB_SSLMODE") ?: if (host == "postgres" || host == "localhost" || host == "127.0.0.1") "disable" else "require"
        val schema = env("DB_SCHEMA") ?: "controle"

        var url = if (!jdbcUrl.isNullOrBlank()) {
            var u = jdbcUrl.trim()
            if (!u.startsWith("jdbc:")) {
                u = "jdbc:$u"
            }
            if (!u.contains("currentSchema=") && schema.isNotBlank()) {
                val sep = if (u.contains("?")) "&" else "?"
                u += "${sep}currentSchema=$schema"
            }
            if (!u.contains("sslmode=") && sslMode.isNotBlank()) {
                val sep = if (u.contains("?")) "&" else "?"
                u += "${sep}sslmode=$sslMode"
            }
            u
        } else {
            "jdbc:postgresql://$host:$port/$dbName?sslmode=$sslMode&currentSchema=$schema"
        }

        // Adiciona parâmetros específicos para o NeonDB apenas se o host for do NeonDB
        if (url.contains("neon.tech")) {
            url += if (url.contains("?")) "&channel_binding=require" else "?channel_binding=require"
        }

        println("INFO: Connecting to database with URL: $url")

        val pgDataSource = org.postgresql.ds.PGSimpleDataSource().apply {
            setURL(url)
            this.user = user
            this.password = password
        }

        val multiTenantDataSource = MultiTenantDataSource(pgDataSource)

        Database.connect(multiTenantDataSource)

        val maxAttempts = 15
        var attempt = 0
        var connected = false

        while (!connected && attempt < maxAttempts) {
            attempt++
            try {
                println("INFO: Tentativa $attempt de $maxAttempts de conexão com o banco de dados...")
                testConnection()
                initGlobalCatalog()
                initDefaultTenantSchema(schema)
                connected = true
                println("INFO: Conexão com o banco de dados estabelecida com sucesso!")

                // Executa migrações estruturais legadas em background para não bloquear a inicialização do Netty
                Thread {
                    try {
                        executarMigrationsLegadas()
                    } catch (e: Exception) {
                        System.err.println("WARN: Migrações legadas em background: ${e.message}")
                    }
                }.start()
            } catch (e: Exception) {
                if (attempt >= maxAttempts) {
                    println("ERROR: Falha definitiva ao conectar ao banco após $maxAttempts tentativas: ${e.message}")
                    throw e
                }
                println("WARN: Banco ainda não disponível (${e.message}). Aguardando 3s antes da próxima tentativa...")
                try {
                    Thread.sleep(3000)
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                }
            }
        }
    }

    private fun initDefaultTenantSchema(schemaName: String) {
        try {
            var tablesCount = 0
            transaction {
                exec("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$schemaName'") { rs ->
                    if (rs.next()) {
                        tablesCount = rs.getInt(1)
                    }
                }
            }
            if (tablesCount >= 10) {
                println("INFO: Schema padrão '$schemaName' já existe e possui $tablesCount tabelas operacionais. Pulando DDL inicial.")
                return
            }
            println("INFO: Schema padrão '$schemaName' não encontrado ou incompleto ($tablesCount tabelas). Executando provisionamento inicial...")
            val provisioningService = org.example.services.TenantProvisioningService()
            provisioningService.provisionarTenant(schemaName)
            println("INFO: Schema padrão '$schemaName' verificado/provisionado com sucesso.")
        } catch (e: Exception) {
            println("WARN: Auto-provisionamento do schema '$schemaName': ${e.message}")
        }
    }

    private fun initGlobalCatalog() {
        try {
            transaction {
                connection.transactionIsolation = Connection.TRANSACTION_READ_COMMITTED
                exec("CREATE SCHEMA IF NOT EXISTS global;")
                exec("""
                    CREATE TABLE IF NOT EXISTS global.empresa (
                        id SERIAL PRIMARY KEY,
                        tipo VARCHAR(20) NOT NULL DEFAULT 'MATRIZ',
                        matriz_id INTEGER REFERENCES global.empresa(id) ON DELETE SET NULL,
                        nome_fantasia VARCHAR(150) NOT NULL,
                        razao_social VARCHAR(255),
                        cnpj VARCHAR(20) UNIQUE,
                        schema_name VARCHAR(63) UNIQUE NOT NULL,
                        banco_dados VARCHAR(100) NOT NULL DEFAULT 'bd_controle',
                        ativo BOOLEAN NOT NULL DEFAULT TRUE,
                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE global.empresa ADD COLUMN IF NOT EXISTS banco_dados VARCHAR(100) DEFAULT 'bd_controle';

                    CREATE OR REPLACE FUNCTION global.trg_clean_empresa_numeric_fields()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF NEW.cnpj IS NOT NULL THEN
                            NEW.cnpj := NULLIF(regexp_replace(NEW.cnpj, '\D', '', 'g'), '');
                        END IF;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;

                    DROP TRIGGER IF EXISTS trg_clean_empresa_fields ON global.empresa;
                    CREATE TRIGGER trg_clean_empresa_fields
                    BEFORE INSERT OR UPDATE ON global.empresa
                    FOR EACH ROW
                    EXECUTE FUNCTION global.trg_clean_empresa_numeric_fields();
                """.trimIndent())

                exec("""
                    CREATE TABLE IF NOT EXISTS global.perfil (
                        id SERIAL PRIMARY KEY,
                        codigo VARCHAR(50) UNIQUE NOT NULL,
                        nome VARCHAR(100) NOT NULL,
                        descricao TEXT,
                        permissoes TEXT
                    );
                """.trimIndent())

                exec("""
                    CREATE TABLE IF NOT EXISTS global.usuario (
                        id SERIAL PRIMARY KEY,
                        nome VARCHAR(150) NOT NULL,
                        email VARCHAR(150) UNIQUE NOT NULL,
                        senha_hash VARCHAR(255) NOT NULL,
                        is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
                        ativo BOOLEAN NOT NULL DEFAULT TRUE,
                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE global.usuario ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500);
                    ALTER TABLE global.usuario ADD COLUMN IF NOT EXISTS google_id VARCHAR(100);
                    ALTER TABLE global.usuario ADD COLUMN IF NOT EXISTS reset_token VARCHAR(100);
                    ALTER TABLE global.usuario ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMP WITHOUT TIME ZONE;
                """.trimIndent())

                exec("""
                    CREATE TABLE IF NOT EXISTS global.usuario_empresa (
                        id SERIAL PRIMARY KEY,
                        usuario_id INTEGER NOT NULL REFERENCES global.usuario(id) ON DELETE CASCADE,
                        empresa_id INTEGER NOT NULL REFERENCES global.empresa(id) ON DELETE CASCADE,
                        perfil_id INTEGER NOT NULL REFERENCES global.perfil(id) ON DELETE RESTRICT,
                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (usuario_id, empresa_id)
                    );
                """.trimIndent())

                exec("""
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
                """.trimIndent())

                // Seeds de Perfis RBAC Oficiais
                exec("""
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
                    DO $$ BEGIN
                        PERFORM setval('global.perfil_id_seq', (SELECT GREATEST(MAX(id), 4) FROM global.perfil));
                    END $$;
                """.trimIndent())

                // Seed da Matriz Inicial (schema controle)
                exec("""
                    INSERT INTO global.empresa (id, tipo, matriz_id, nome_fantasia, razao_social, cnpj, schema_name, ativo)
                    VALUES (1, 'MATRIZ', NULL, 'Controle Silvia (Matriz)', 'Silvia Artes & Cosméticos Ltda', '12.345.678/0001-90', 'controle', TRUE)
                    ON CONFLICT (id) DO UPDATE SET 
                        tipo = EXCLUDED.tipo,
                        schema_name = EXCLUDED.schema_name;
                    DO $$ BEGIN
                        PERFORM setval('global.empresa_id_seq', (SELECT GREATEST(MAX(id), 1) FROM global.empresa));
                    END $$;
                """.trimIndent())

                // Seed do Superusuário DcSys inicial (admin@dcsys.com / admin123)
                exec("""
                    INSERT INTO global.usuario (nome, email, senha_hash, is_superuser, ativo)
                    VALUES ('Superusuário DcSys', 'admin@dcsys.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE, TRUE)
                    ON CONFLICT (email) DO NOTHING;
                """.trimIndent())

                // Vínculo inicial do Superusuário DcSys com Matriz padrão
                exec("""
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

                    -- Seed do Administrador da Empresa padrão (silvia@empresa.com / 123456 - is_superuser = FALSE)
                    INSERT INTO global.usuario (nome, email, senha_hash, is_superuser, ativo)
                    VALUES ('Silvia Administradora', 'silvia@empresa.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', FALSE, TRUE)
                    ON CONFLICT (email) DO UPDATE SET is_superuser = FALSE;

                    DO $$
                    DECLARE
                        v_user_id INTEGER;
                        v_perfil_id INTEGER;
                        v_empresa_id INTEGER;
                    BEGIN
                        SELECT id INTO v_user_id FROM global.usuario WHERE email = 'silvia@empresa.com' LIMIT 1;
                        SELECT id INTO v_perfil_id FROM global.perfil WHERE codigo = 'ADMIN_MATRIZ' LIMIT 1;
                        SELECT id INTO v_empresa_id FROM global.empresa WHERE id = 1 LIMIT 1;

                        IF v_user_id IS NOT NULL AND v_perfil_id IS NOT NULL AND v_empresa_id IS NOT NULL THEN
                            INSERT INTO global.usuario_empresa (usuario_id, empresa_id, perfil_id)
                            VALUES (v_user_id, v_empresa_id, v_perfil_id)
                            ON CONFLICT (usuario_id, empresa_id) DO NOTHING;
                        END IF;
                    END $$;
                """.trimIndent())

                println("INFO: Catálogo global e governança inicializados com sucesso.")
            }
        } catch (e: Exception) {
            System.err.println("WARN: Não foi possível inicializar catálogo global (verifique se o DB está acessível): ${e.message}")
        }
    }

    private fun testConnection() {
        try {
            transaction {
                exec("SELECT 1;")
            }
            println("INFO: Conexão com o banco de dados testada com sucesso (SELECT 1).")
        } catch (e: Exception) {
            System.err.println("WARN: Falha no teste de conexão: ${e.message}")
            throw e
        }
    }

    private fun executarMigrationsLegadas() {
        val schema = env("DB_SCHEMA") ?: "controle"
        try {
            transaction {
                connection.transactionIsolation = Connection.TRANSACTION_READ_COMMITTED
                exec("SET search_path TO \"$schema\", public;")

                exec("""
                    CREATE TABLE IF NOT EXISTS estoque_variacao_aux (
                        variacao_id INTEGER PRIMARY KEY,
                        estoque DOUBLE PRECISION DEFAULT 0.0
                    );

                    CREATE TABLE IF NOT EXISTS estoque_minimo_insumo_aux (
                        insumo_id INTEGER PRIMARY KEY,
                        estoque_minimo DOUBLE PRECISION DEFAULT 0.0
                    );

                    CREATE TABLE IF NOT EXISTS unidade_compra_insumo (
                        id SERIAL PRIMARY KEY,
                        insumo_id INTEGER NOT NULL REFERENCES insumo(id) ON DELETE CASCADE,
                        nome_embalagem VARCHAR(100) NOT NULL,
                        fator_conversao DOUBLE PRECISION NOT NULL,
                        preco_embalagem DOUBLE PRECISION,
                        codigo_barras VARCHAR(50),
                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS movimento_estoque_insumo (
                        id SERIAL PRIMARY KEY,
                        insumo_id INTEGER NOT NULL REFERENCES insumo(id) ON DELETE RESTRICT,
                        tipo VARCHAR(30) NOT NULL,
                        quantidade DOUBLE PRECISION NOT NULL,
                        saldo_anterior DOUBLE PRECISION NOT NULL,
                        saldo_posterior DOUBLE PRECISION NOT NULL,
                        origem_referencia VARCHAR(50),
                        referencia_id INTEGER,
                        motivo TEXT,
                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        criado_por INTEGER REFERENCES funcionario(id) ON DELETE SET NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_mov_estoque_insumo ON movimento_estoque_insumo(insumo_id);
                    CREATE INDEX IF NOT EXISTS idx_mov_estoque_tipo ON movimento_estoque_insumo(tipo);
                    CREATE INDEX IF NOT EXISTS idx_mov_estoque_data ON movimento_estoque_insumo(criado_em);
                    CREATE INDEX IF NOT EXISTS idx_unidade_compra_insumo ON unidade_compra_insumo(insumo_id);

                    CREATE TABLE IF NOT EXISTS variacao_material (
                        id SERIAL PRIMARY KEY,
                        variacao_id INTEGER NOT NULL REFERENCES produto_variacao(id) ON DELETE CASCADE,
                        insumo_id INTEGER NOT NULL REFERENCES insumo(id) ON DELETE RESTRICT,
                        quantidade DOUBLE PRECISION NOT NULL DEFAULT 1.0
                    );

                    CREATE INDEX IF NOT EXISTS idx_variacao_material_var ON variacao_material(variacao_id);

                    -- Tipos de Insumo
                    CREATE TABLE IF NOT EXISTS tipo_insumo (
                        id SERIAL PRIMARY KEY,
                        nome VARCHAR(100) NOT NULL,
                        descricao VARCHAR(255),
                        is_embalagem BOOLEAN DEFAULT FALSE,
                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    INSERT INTO tipo_insumo (id, nome, descricao, is_embalagem) VALUES
                        (1, 'Matéria-prima', 'Insumos que compõem a receita ou formulação do produto', FALSE),
                        (2, 'Embalagem', 'Frascos, caixas, tampas, rótulos e embalagens', TRUE)
                    ON CONFLICT (id) DO NOTHING;
                    SELECT setval('tipo_insumo_id_seq', (SELECT COALESCE(MAX(id), 1) FROM tipo_insumo));

                    ALTER TABLE insumo ADD COLUMN IF NOT EXISTS tipo_insumo_id INTEGER REFERENCES tipo_insumo(id) ON DELETE SET NULL;
                    CREATE INDEX IF NOT EXISTS idx_insumo_tipo_insumo ON insumo(tipo_insumo_id);
                    UPDATE insumo SET tipo_insumo_id = CASE WHEN is_embalagem = TRUE THEN 2 ELSE 1 END WHERE tipo_insumo_id IS NULL;

                    -- Evoluções: Validade, Código de Barras e Integração de Vendas
                    ALTER TABLE insumo ADD COLUMN IF NOT EXISTS data_validade DATE;
                    ALTER TABLE insumo ADD COLUMN IF NOT EXISTS lote VARCHAR(50);
                    ALTER TABLE insumo ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);

                    ALTER TABLE movimento_estoque_insumo ADD COLUMN IF NOT EXISTS data_validade DATE;
                    ALTER TABLE movimento_estoque_insumo ADD COLUMN IF NOT EXISTS lote VARCHAR(50);

                    -- Produto Final: Rendimento e Rótulo
                    ALTER TABLE produto_final ADD COLUMN IF NOT EXISTS rendimento_receita_base DOUBLE PRECISION DEFAULT 1.0;
                    ALTER TABLE produto_final ADD COLUMN IF NOT EXISTS rendimento DOUBLE PRECISION DEFAULT 1.0;
                    ALTER TABLE produto_final ADD COLUMN IF NOT EXISTS rotulo TEXT;
                    DO $$ BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'produto_final' AND column_name = 'rendimento') THEN
                            ALTER TABLE produto_final ALTER COLUMN rendimento DROP NOT NULL;
                            ALTER TABLE produto_final ALTER COLUMN rendimento SET DEFAULT 1.0;
                            UPDATE produto_final SET rendimento_receita_base = COALESCE(rendimento, 1.0) WHERE rendimento_receita_base IS NULL;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'produto_final' AND column_name = 'rendimento_receita_base') THEN
                            UPDATE produto_final SET rendimento = COALESCE(rendimento_receita_base, 1.0) WHERE rendimento IS NULL;
                        END IF;
                    END $$;

                    CREATE OR REPLACE FUNCTION trg_sync_rendimento_func()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF NEW.rendimento_receita_base IS NOT NULL AND NEW.rendimento IS NULL THEN
                            NEW.rendimento := NEW.rendimento_receita_base;
                        ELSIF NEW.rendimento IS NOT NULL AND NEW.rendimento_receita_base IS NULL THEN
                            NEW.rendimento_receita_base := NEW.rendimento;
                        END IF;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;

                    DROP TRIGGER IF EXISTS trg_sync_rendimento ON produto_final;
                    CREATE TRIGGER trg_sync_rendimento
                    BEFORE INSERT OR UPDATE ON produto_final
                    FOR EACH ROW
                    EXECUTE FUNCTION trg_sync_rendimento_func();


                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS tamanho_medida DOUBLE PRECISION DEFAULT 1.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS unidade_medida_tamanho_id INTEGER REFERENCES unidade_medida(id);
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS embalagem_insumo_id INTEGER REFERENCES insumo(id);
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS tempo_producao_minutos DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS preco_venda DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS custo_unitario_calculado DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS estoque DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS multiplicador_receita DOUBLE PRECISION DEFAULT 1.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS tempo_producao_segundos DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS custo_fixo_rateado DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS peso_g DOUBLE PRECISION;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS preco_venda_manual DOUBLE PRECISION;
                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS descricao_visual TEXT;

                    DO $$ BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'produto_variacao' AND column_name = 'multiplicador_receita') THEN
                            ALTER TABLE produto_variacao ALTER COLUMN multiplicador_receita DROP NOT NULL;
                            ALTER TABLE produto_variacao ALTER COLUMN multiplicador_receita SET DEFAULT 1.0;
                            UPDATE produto_variacao SET multiplicador_receita = 1.0 WHERE multiplicador_receita IS NULL;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'produto_variacao' AND column_name = 'tempo_producao_segundos') THEN
                            ALTER TABLE produto_variacao ALTER COLUMN tempo_producao_segundos DROP NOT NULL;
                            ALTER TABLE produto_variacao ALTER COLUMN tempo_producao_segundos SET DEFAULT 0.0;
                            UPDATE produto_variacao SET tempo_producao_segundos = 0.0 WHERE tempo_producao_segundos IS NULL;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'produto_variacao' AND column_name = 'custo_fixo_rateado') THEN
                            ALTER TABLE produto_variacao ALTER COLUMN custo_fixo_rateado DROP NOT NULL;
                            ALTER TABLE produto_variacao ALTER COLUMN custo_fixo_rateado SET DEFAULT 0.0;
                            UPDATE produto_variacao SET custo_fixo_rateado = 0.0 WHERE custo_fixo_rateado IS NULL;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'produto_variacao' AND column_name = 'margem_lucro') THEN
                            ALTER TABLE produto_variacao ALTER COLUMN margem_lucro DROP NOT NULL;
                            ALTER TABLE produto_variacao ALTER COLUMN margem_lucro SET DEFAULT 0.0;
                            UPDATE produto_variacao SET margem_lucro = 0.0 WHERE margem_lucro IS NULL;
                        END IF;
                    END $$;

                    -- Funcionario e Configuração Global
                    ALTER TABLE funcionario ADD COLUMN IF NOT EXISTS salario_bruto DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE configuracao_global ADD COLUMN IF NOT EXISTS horas_trabalhadas_por_semana DOUBLE PRECISION DEFAULT 44.0;
                    ALTER TABLE configuracao_global ADD COLUMN IF NOT EXISTS total_salarios DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE configuracao_global ADD COLUMN IF NOT EXISTS total_despesas_fixas DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE configuracao_global ADD COLUMN IF NOT EXISTS custo_minuto_trabalho DOUBLE PRECISION DEFAULT 0.0;


                    ALTER TABLE pedido ADD COLUMN IF NOT EXISTS valor DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE pedido ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(50) DEFAULT 'OUTROS';
                    ALTER TABLE pedido ADD COLUMN IF NOT EXISTS data_pagamento VARCHAR(20);
                    ALTER TABLE pedido ADD COLUMN IF NOT EXISTS entregue BOOLEAN DEFAULT FALSE;

                    ALTER TABLE pedido_item ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'PRODUTO';
                    ALTER TABLE pedido_item ADD COLUMN IF NOT EXISTS nome_produto VARCHAR(255);

                    ALTER TABLE orcamento_compra ADD COLUMN IF NOT EXISTS titulo VARCHAR(200) DEFAULT '';
                    ALTER TABLE orcamento_compra ADD COLUMN IF NOT EXISTS observacoes TEXT;
                    ALTER TABLE orcamento_compra ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
                    ALTER TABLE orcamento_compra ADD COLUMN IF NOT EXISTS frete DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE orcamento_compra ADD COLUMN IF NOT EXISTS desconto DOUBLE PRECISION DEFAULT 0.0;

                    ALTER TABLE item_orcamento ADD COLUMN IF NOT EXISTS quantidade DOUBLE PRECISION DEFAULT 1.0;
                    ALTER TABLE item_orcamento ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
                    ALTER TABLE item_orcamento ADD COLUMN IF NOT EXISTS quantidade_recebida DOUBLE PRECISION;
                    ALTER TABLE item_orcamento ADD COLUMN IF NOT EXISTS preco_unitario_recebido DOUBLE PRECISION;
                    ALTER TABLE item_orcamento ADD COLUMN IF NOT EXISTS valor_final_item DOUBLE PRECISION;

                    DO $$ BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'item_orcamento' AND column_name = 'quantidade_solicitada') THEN
                            ALTER TABLE item_orcamento ALTER COLUMN quantidade_solicitada DROP NOT NULL;
                            ALTER TABLE item_orcamento ALTER COLUMN quantidade_solicitada SET DEFAULT 1.0;
                            UPDATE item_orcamento SET quantidade_solicitada = COALESCE(quantidade, 1.0) WHERE quantidade_solicitada IS NULL;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'item_orcamento' AND column_name = 'quantidade') THEN
                            UPDATE item_orcamento SET quantidade = COALESCE(quantidade_solicitada, 1.0) WHERE quantidade IS NULL;
                        END IF;
                    END $$;

                    CREATE OR REPLACE FUNCTION trg_sync_item_orcamento_qtd_func()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF NEW.quantidade IS NOT NULL AND NEW.quantidade_solicitada IS NULL THEN
                            NEW.quantidade_solicitada := NEW.quantidade;
                        ELSIF NEW.quantidade_solicitada IS NOT NULL AND NEW.quantidade IS NULL THEN
                            NEW.quantidade := NEW.quantidade_solicitada;
                        ELSIF NEW.quantidade IS NOT NULL AND NEW.quantidade_solicitada IS NOT NULL THEN
                            NEW.quantidade_solicitada := NEW.quantidade;
                        END IF;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;

                    DROP TRIGGER IF EXISTS trg_sync_item_orcamento_qtd ON item_orcamento;
                    CREATE TRIGGER trg_sync_item_orcamento_qtd
                    BEFORE INSERT OR UPDATE ON item_orcamento
                    FOR EACH ROW
                    EXECUTE FUNCTION trg_sync_item_orcamento_qtd_func();

                    ALTER TABLE cotacao_fornecedor ADD COLUMN IF NOT EXISTS preco_unitario DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE cotacao_fornecedor ADD COLUMN IF NOT EXISTS preco_cotado DOUBLE PRECISION DEFAULT 0.0;
                    DO $$ BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'cotacao_fornecedor' AND column_name = 'preco_cotado') THEN
                            ALTER TABLE cotacao_fornecedor ALTER COLUMN preco_cotado DROP NOT NULL;
                            ALTER TABLE cotacao_fornecedor ALTER COLUMN preco_cotado SET DEFAULT 0.0;
                            UPDATE cotacao_fornecedor SET preco_cotado = COALESCE(preco_unitario, 0.0) WHERE preco_cotado IS NULL;
                            UPDATE cotacao_fornecedor SET preco_unitario = COALESCE(preco_cotado, 0.0) WHERE preco_unitario IS NULL;
                        END IF;
                    END $$;

                    CREATE OR REPLACE FUNCTION trg_sync_cotacao_preco_func()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF NEW.preco_cotado IS NULL AND NEW.preco_unitario IS NOT NULL THEN
                            NEW.preco_cotado := NEW.preco_unitario;
                        ELSIF NEW.preco_unitario IS NULL AND NEW.preco_cotado IS NOT NULL THEN
                            NEW.preco_unitario := NEW.preco_cotado;
                        ELSIF NEW.preco_cotado IS NULL AND NEW.preco_unitario IS NULL THEN
                            NEW.preco_cotado := 0.0;
                            NEW.preco_unitario := 0.0;
                        END IF;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;

                    DROP TRIGGER IF EXISTS trg_sync_cotacao_preco ON cotacao_fornecedor;
                    CREATE TRIGGER trg_sync_cotacao_preco
                    BEFORE INSERT OR UPDATE ON cotacao_fornecedor
                    FOR EACH ROW
                    EXECUTE FUNCTION trg_sync_cotacao_preco_func();

                    ALTER TABLE pedido_compra ADD COLUMN IF NOT EXISTS data_confirmacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                    ALTER TABLE pedido_compra ADD COLUMN IF NOT EXISTS valor_total_itens DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE pedido_compra ADD COLUMN IF NOT EXISTS valor_frete DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE pedido_compra ADD COLUMN IF NOT EXISTS valor_final_confirmado DOUBLE PRECISION DEFAULT 0.0;

                    ALTER TABLE pedido_compra_item ADD COLUMN IF NOT EXISTS item_orcamento_id INTEGER;

                    ALTER TABLE compra ADD COLUMN IF NOT EXISTS orcamento_id INTEGER;
                    ALTER TABLE compra ADD COLUMN IF NOT EXISTS justificativa VARCHAR(500);
                    ALTER TABLE compra ADD COLUMN IF NOT EXISTS data_prevista TIMESTAMP WITHOUT TIME ZONE;
                    ALTER TABLE compra ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                    ALTER TABLE compra ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDENTE';
                    ALTER TABLE compra ADD COLUMN IF NOT EXISTS valor_total DOUBLE PRECISION DEFAULT 0.0;
                    DO $$ BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'compra' AND column_name = 'fornecedor_id') THEN
                            ALTER TABLE compra ALTER COLUMN fornecedor_id DROP NOT NULL;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'fornecedor' AND column_name = 'cnpj_cpf') THEN
                            ALTER TABLE fornecedor ALTER COLUMN cnpj_cpf DROP NOT NULL;
                        END IF;
                    END $$;

                    CREATE OR REPLACE FUNCTION trg_clean_fornecedor_numeric_fields()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF NEW.cnpj_cpf IS NOT NULL THEN
                            NEW.cnpj_cpf := NULLIF(regexp_replace(NEW.cnpj_cpf, '\D', '', 'g'), '');
                        END IF;
                        IF NEW.telefones IS NOT NULL THEN
                            NEW.telefones := NULLIF(regexp_replace(NEW.telefones, '\D', '', 'g'), '');
                        END IF;
                        IF NEW.cep IS NOT NULL THEN
                            NEW.cep := NULLIF(regexp_replace(NEW.cep, '\D', '', 'g'), '');
                        END IF;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;

                    DROP TRIGGER IF EXISTS trg_clean_fornecedor_fields ON fornecedor;
                    CREATE TRIGGER trg_clean_fornecedor_fields
                    BEFORE INSERT OR UPDATE ON fornecedor
                    FOR EACH ROW
                    EXECUTE FUNCTION trg_clean_fornecedor_numeric_fields();

                    CREATE OR REPLACE FUNCTION trg_clean_cliente_numeric_fields()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF NEW.telefone IS NOT NULL THEN
                            NEW.telefone := NULLIF(regexp_replace(NEW.telefone, '\D', '', 'g'), '');
                        END IF;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;

                    DO $$ BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'cliente') THEN
                            DROP TRIGGER IF EXISTS trg_clean_cliente_fields ON cliente;
                            CREATE TRIGGER trg_clean_cliente_fields
                            BEFORE INSERT OR UPDATE ON cliente
                            FOR EACH ROW
                            EXECUTE FUNCTION trg_clean_cliente_numeric_fields();
                        END IF;
                    END $$;

                    ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS item_orcamento_id INTEGER;
                    ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS quantidade_solicitada DOUBLE PRECISION DEFAULT 1.0;
                    ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS quantidade_comprada DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS quantidade_recebida DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS preco_unitario DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS fornecedor_sugerido_id INTEGER;
                    ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
                    DO $$ BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'item_compra' AND column_name = 'quantidade') THEN
                            ALTER TABLE item_compra ALTER COLUMN quantidade DROP NOT NULL;
                            ALTER TABLE item_compra ALTER COLUMN quantidade SET DEFAULT 1.0;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'item_compra' AND column_name = 'valor_total') THEN
                            ALTER TABLE item_compra ALTER COLUMN valor_total DROP NOT NULL;
                            ALTER TABLE item_compra ALTER COLUMN valor_total SET DEFAULT 0.0;
                        END IF;
                    END $$;


                    CREATE TABLE IF NOT EXISTS kits (
                        id SERIAL PRIMARY KEY,
                        nome VARCHAR(255) NOT NULL,
                        codigo VARCHAR(100),
                        codigo_barras VARCHAR(50),
                        descricao TEXT,
                        margem_lucro DOUBLE PRECISION DEFAULT 0.0,
                        custo_total_calculado DOUBLE PRECISION DEFAULT 0.0,
                        preco_venda DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                        ativo BOOLEAN NOT NULL DEFAULT TRUE,
                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    ALTER TABLE kits ADD COLUMN IF NOT EXISTS codigo VARCHAR(100);
                    ALTER TABLE kits ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);
                    ALTER TABLE kits ADD COLUMN IF NOT EXISTS descricao TEXT;
                    ALTER TABLE kits ADD COLUMN IF NOT EXISTS margem_lucro DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE kits ADD COLUMN IF NOT EXISTS custo_total_calculado DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE kits ADD COLUMN IF NOT EXISTS preco_venda DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE kits ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

                    CREATE TABLE IF NOT EXISTS kit_itens (
                        id SERIAL PRIMARY KEY,
                        kit_id INTEGER NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
                        produto_variacao_id INTEGER NOT NULL REFERENCES produto_variacao(id) ON DELETE RESTRICT,
                        quantidade INTEGER NOT NULL DEFAULT 1
                    );
                    ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS kit_id INTEGER;
                    ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS produto_variacao_id INTEGER;
                    ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1;

                    DO $$ 
                    BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kit_itens' AND column_name='variacao_id') 
                           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kit_itens' AND column_name='produto_variacao_id') THEN
                            ALTER TABLE kit_itens RENAME COLUMN variacao_id TO produto_variacao_id;
                        END IF;
                    END $$;

                    DO $$ 
                    BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'pedido') THEN
                            ALTER TABLE pedido ADD COLUMN IF NOT EXISTS valor_custo_total DOUBLE PRECISION DEFAULT 0.0;
                            ALTER TABLE pedido ADD COLUMN IF NOT EXISTS lucro_bruto DOUBLE PRECISION DEFAULT 0.0;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'pedido_item') THEN
                            ALTER TABLE pedido_item ADD COLUMN IF NOT EXISTS kit_id INTEGER;
                            ALTER TABLE pedido_item ADD COLUMN IF NOT EXISTS custo_unitario DOUBLE PRECISION DEFAULT 0.0;
                        END IF;
                    END $$;

                    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
                        id SERIAL PRIMARY KEY,
                        variacao_id INTEGER REFERENCES produto_variacao(id) ON DELETE CASCADE,
                        tipo VARCHAR(30) NOT NULL,
                        quantidade DOUBLE PRECISION NOT NULL,
                        motivo VARCHAR(255),
                        origem VARCHAR(100),
                        data_movimentacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE INDEX IF NOT EXISTS idx_insumo_cod_barras ON insumo(codigo_barras);
                    CREATE INDEX IF NOT EXISTS idx_insumo_validade ON insumo(data_validade);
                    CREATE INDEX IF NOT EXISTS idx_prod_var_cod_barras ON produto_variacao(codigo_barras);
                    CREATE INDEX IF NOT EXISTS idx_kits_cod_barras ON kits(codigo_barras);
                """.trimIndent())
                
                // Unificação de Medida Base: converter L para ml e kg para g
                exec("""
                    DO $$ 
                    DECLARE
                        id_l INTEGER;
                        id_ml INTEGER;
                        id_kg INTEGER;
                        id_g INTEGER;
                    BEGIN
                        SELECT id INTO id_l FROM unidade_medida WHERE LOWER(sigla) = 'l' OR LOWER(nome) = 'litro' LIMIT 1;
                        SELECT id INTO id_ml FROM unidade_medida WHERE LOWER(sigla) = 'ml' OR LOWER(nome) = 'mililitro' LIMIT 1;
                        SELECT id INTO id_kg FROM unidade_medida WHERE LOWER(sigla) = 'kg' OR LOWER(nome) = 'quilograma' LIMIT 1;
                        SELECT id INTO id_g FROM unidade_medida WHERE LOWER(sigla) = 'g' OR LOWER(nome) = 'grama' LIMIT 1;

                        IF id_l IS NOT NULL AND id_ml IS NOT NULL THEN
                            UPDATE insumo 
                            SET quantidade_por_embalagem = CASE 
                                    WHEN quantidade_por_embalagem IS NOT NULL AND quantidade_por_embalagem <= 500 THEN quantidade_por_embalagem * 1000 
                                    ELSE quantidade_por_embalagem 
                                END,
                                estoque = CASE 
                                    WHEN estoque IS NOT NULL AND estoque <= 500 THEN estoque * 1000 
                                    ELSE estoque 
                                END,
                                unidade_medida_id = id_ml
                            WHERE unidade_medida_id = id_l;
                        END IF;

                        IF id_kg IS NOT NULL AND id_g IS NOT NULL THEN
                            UPDATE insumo 
                            SET quantidade_por_embalagem = CASE 
                                    WHEN quantidade_por_embalagem IS NOT NULL AND quantidade_por_embalagem <= 500 THEN quantidade_por_embalagem * 1000 
                                    ELSE quantidade_por_embalagem 
                                END,
                                estoque = CASE 
                                    WHEN estoque IS NOT NULL AND estoque <= 500 THEN estoque * 1000 
                                    ELSE estoque 
                                END,
                                unidade_medida_id = id_g
                            WHERE unidade_medida_id = id_kg;
                        END IF;
                    END $$;
                """.trimIndent())

                // Migração universal para todos os schemas de empresas cadastrados em global.empresa
                try {
                    val tenantSchemas = mutableListOf<String>()
                    exec("SELECT schema_name FROM global.empresa WHERE schema_name IS NOT NULL") { rs ->
                        while (rs.next()) {
                            tenantSchemas.add(rs.getString("schema_name"))
                        }
                    }
                    for (tSchema in tenantSchemas.distinct()) {
                        exec("""
                            DO $$ 
                            BEGIN
                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'produto_final') THEN
                                    ALTER TABLE "$tSchema".produto_final ADD COLUMN IF NOT EXISTS rendimento_receita_base DOUBLE PRECISION DEFAULT 1.0;
                                    ALTER TABLE "$tSchema".produto_final ADD COLUMN IF NOT EXISTS rendimento DOUBLE PRECISION DEFAULT 1.0;
                                    ALTER TABLE "$tSchema".produto_final ADD COLUMN IF NOT EXISTS rotulo TEXT;

                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'produto_final' AND column_name = 'rendimento') THEN
                                        ALTER TABLE "$tSchema".produto_final ALTER COLUMN rendimento DROP NOT NULL;
                                        ALTER TABLE "$tSchema".produto_final ALTER COLUMN rendimento SET DEFAULT 1.0;
                                        UPDATE "$tSchema".produto_final SET rendimento_receita_base = COALESCE(rendimento, 1.0) WHERE rendimento_receita_base IS NULL;
                                    END IF;
                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'produto_final' AND column_name = 'rendimento_receita_base') THEN
                                        UPDATE "$tSchema".produto_final SET rendimento = COALESCE(rendimento_receita_base, 1.0) WHERE rendimento IS NULL;
                                    END IF;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'compra') THEN
                                    ALTER TABLE "$tSchema".compra ADD COLUMN IF NOT EXISTS orcamento_id INTEGER;
                                    ALTER TABLE "$tSchema".compra ADD COLUMN IF NOT EXISTS justificativa VARCHAR(500);
                                    ALTER TABLE "$tSchema".compra ADD COLUMN IF NOT EXISTS data_prevista TIMESTAMP WITHOUT TIME ZONE;
                                    ALTER TABLE "$tSchema".compra ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                                    ALTER TABLE "$tSchema".compra ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDENTE';
                                    ALTER TABLE "$tSchema".compra ADD COLUMN IF NOT EXISTS valor_total DOUBLE PRECISION DEFAULT 0.0;
                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'compra' AND column_name = 'fornecedor_id') THEN
                                        ALTER TABLE "$tSchema".compra ALTER COLUMN fornecedor_id DROP NOT NULL;
                                    END IF;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'item_compra') THEN
                                    ALTER TABLE "$tSchema".item_compra ADD COLUMN IF NOT EXISTS item_orcamento_id INTEGER;
                                    ALTER TABLE "$tSchema".item_compra ADD COLUMN IF NOT EXISTS quantidade_solicitada DOUBLE PRECISION DEFAULT 1.0;
                                    ALTER TABLE "$tSchema".item_compra ADD COLUMN IF NOT EXISTS quantidade_comprada DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".item_compra ADD COLUMN IF NOT EXISTS quantidade_recebida DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".item_compra ADD COLUMN IF NOT EXISTS preco_unitario DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".item_compra ADD COLUMN IF NOT EXISTS fornecedor_sugerido_id INTEGER;
                                    ALTER TABLE "$tSchema".item_compra ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'item_compra' AND column_name = 'quantidade') THEN
                                        ALTER TABLE "$tSchema".item_compra ALTER COLUMN quantidade DROP NOT NULL;
                                        ALTER TABLE "$tSchema".item_compra ALTER COLUMN quantidade SET DEFAULT 1.0;
                                    END IF;
                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'item_compra' AND column_name = 'valor_total') THEN
                                        ALTER TABLE "$tSchema".item_compra ALTER COLUMN valor_total DROP NOT NULL;
                                        ALTER TABLE "$tSchema".item_compra ALTER COLUMN valor_total SET DEFAULT 0.0;
                                    END IF;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'cotacao_fornecedor') THEN
                                    ALTER TABLE "$tSchema".cotacao_fornecedor ADD COLUMN IF NOT EXISTS preco_unitario DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".cotacao_fornecedor ADD COLUMN IF NOT EXISTS preco_cotado DOUBLE PRECISION DEFAULT 0.0;
                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'cotacao_fornecedor' AND column_name = 'preco_cotado') THEN
                                        ALTER TABLE "$tSchema".cotacao_fornecedor ALTER COLUMN preco_cotado DROP NOT NULL;
                                        ALTER TABLE "$tSchema".cotacao_fornecedor ALTER COLUMN preco_cotado SET DEFAULT 0.0;
                                        UPDATE "$tSchema".cotacao_fornecedor SET preco_cotado = COALESCE(preco_unitario, 0.0) WHERE preco_cotado IS NULL;
                                        UPDATE "$tSchema".cotacao_fornecedor SET preco_unitario = COALESCE(preco_cotado, 0.0) WHERE preco_unitario IS NULL;
                                    END IF;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'item_orcamento') THEN
                                    ALTER TABLE "$tSchema".item_orcamento ADD COLUMN IF NOT EXISTS quantidade DOUBLE PRECISION DEFAULT 1.0;
                                    ALTER TABLE "$tSchema".item_orcamento ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
                                    ALTER TABLE "$tSchema".item_orcamento ADD COLUMN IF NOT EXISTS quantidade_recebida DOUBLE PRECISION;
                                    ALTER TABLE "$tSchema".item_orcamento ADD COLUMN IF NOT EXISTS preco_unitario_recebido DOUBLE PRECISION;
                                    ALTER TABLE "$tSchema".item_orcamento ADD COLUMN IF NOT EXISTS valor_final_item DOUBLE PRECISION;
                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'item_orcamento' AND column_name = 'quantidade_solicitada') THEN
                                        ALTER TABLE "$tSchema".item_orcamento ALTER COLUMN quantidade_solicitada DROP NOT NULL;
                                        ALTER TABLE "$tSchema".item_orcamento ALTER COLUMN quantidade_solicitada SET DEFAULT 1.0;
                                        UPDATE "$tSchema".item_orcamento SET quantidade_solicitada = COALESCE(quantidade, 1.0) WHERE quantidade_solicitada IS NULL;
                                    END IF;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'produto_variacao') THEN
                                    ALTER TABLE "$tSchema".produto_variacao ADD COLUMN IF NOT EXISTS multiplicador_receita DOUBLE PRECISION DEFAULT 1.0;
                                    ALTER TABLE "$tSchema".produto_variacao ADD COLUMN IF NOT EXISTS tempo_producao_segundos DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".produto_variacao ADD COLUMN IF NOT EXISTS custo_fixo_rateado DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".produto_variacao ADD COLUMN IF NOT EXISTS peso_g DOUBLE PRECISION;
                                    ALTER TABLE "$tSchema".produto_variacao ADD COLUMN IF NOT EXISTS preco_venda_manual DOUBLE PRECISION;
                                    ALTER TABLE "$tSchema".produto_variacao ADD COLUMN IF NOT EXISTS descricao_visual TEXT;

                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN multiplicador_receita DROP NOT NULL;
                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN multiplicador_receita SET DEFAULT 1.0;
                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN tempo_producao_segundos DROP NOT NULL;
                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN tempo_producao_segundos SET DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN custo_fixo_rateado DROP NOT NULL;
                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN custo_fixo_rateado SET DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN margem_lucro DROP NOT NULL;
                                    ALTER TABLE "$tSchema".produto_variacao ALTER COLUMN margem_lucro SET DEFAULT 0.0;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'fornecedor') THEN
                                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = '$tSchema' AND table_name = 'fornecedor' AND column_name = 'cnpj_cpf') THEN
                                        ALTER TABLE "$tSchema".fornecedor ALTER COLUMN cnpj_cpf DROP NOT NULL;
                                    END IF;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'funcionario') THEN
                                    ALTER TABLE "$tSchema".funcionario ADD COLUMN IF NOT EXISTS salario_bruto DOUBLE PRECISION DEFAULT 0.0;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'configuracao_global') THEN
                                    ALTER TABLE "$tSchema".configuracao_global ADD COLUMN IF NOT EXISTS horas_trabalhadas_por_semana DOUBLE PRECISION DEFAULT 44.0;
                                    ALTER TABLE "$tSchema".configuracao_global ADD COLUMN IF NOT EXISTS total_salarios DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".configuracao_global ADD COLUMN IF NOT EXISTS total_despesas_fixas DOUBLE PRECISION DEFAULT 0.0;
                                    ALTER TABLE "$tSchema".configuracao_global ADD COLUMN IF NOT EXISTS custo_minuto_trabalho DOUBLE PRECISION DEFAULT 0.0;
                                END IF;

                                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '$tSchema' AND table_name = 'insumo') THEN
                                    CREATE TABLE IF NOT EXISTS "$tSchema".tipo_insumo (
                                        id SERIAL PRIMARY KEY,
                                        nome VARCHAR(100) NOT NULL,
                                        descricao VARCHAR(255),
                                        is_embalagem BOOLEAN DEFAULT FALSE,
                                        criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                                    );

                                    INSERT INTO "$tSchema".tipo_insumo (id, nome, descricao, is_embalagem) VALUES
                                        (1, 'Matéria-prima', 'Insumos que compõem a receita ou formulação do produto', FALSE),
                                        (2, 'Embalagem', 'Frascos, caixas, tampas, rótulos e embalagens', TRUE)
                                    ON CONFLICT (id) DO NOTHING;
                                    PERFORM setval('"$tSchema".tipo_insumo_id_seq', (SELECT COALESCE(MAX(id), 1) FROM "$tSchema".tipo_insumo));

                                    ALTER TABLE "$tSchema".insumo ADD COLUMN IF NOT EXISTS tipo_insumo_id INTEGER REFERENCES "$tSchema".tipo_insumo(id) ON DELETE SET NULL;
                                    UPDATE "$tSchema".insumo SET tipo_insumo_id = CASE WHEN is_embalagem = TRUE THEN 2 ELSE 1 END WHERE tipo_insumo_id IS NULL;
                                END IF;
                            END $$;
                        """.trimIndent())

                        try {
                            exec("""
                                CREATE OR REPLACE FUNCTION "$tSchema".trg_clean_fornecedor_numeric_fields()
                                RETURNS TRIGGER AS $$
                                BEGIN
                                    IF NEW.cnpj_cpf IS NOT NULL THEN
                                        NEW.cnpj_cpf := NULLIF(regexp_replace(NEW.cnpj_cpf, '\D', '', 'g'), '');
                                    END IF;
                                    IF NEW.telefones IS NOT NULL THEN
                                        NEW.telefones := NULLIF(regexp_replace(NEW.telefones, '\D', '', 'g'), '');
                                    END IF;
                                    IF NEW.cep IS NOT NULL THEN
                                        NEW.cep := NULLIF(regexp_replace(NEW.cep, '\D', '', 'g'), '');
                                    END IF;
                                    RETURN NEW;
                                END;
                                $$ LANGUAGE plpgsql;

                                DROP TRIGGER IF EXISTS trg_clean_fornecedor_fields ON "$tSchema".fornecedor;
                                CREATE TRIGGER trg_clean_fornecedor_fields
                                BEFORE INSERT OR UPDATE ON "$tSchema".fornecedor
                                FOR EACH ROW
                                EXECUTE FUNCTION "$tSchema".trg_clean_fornecedor_numeric_fields();
                            """.trimIndent())
                        } catch (_: Exception) {}
                    }
                } catch (e: Exception) {
                    System.err.println("WARN: Não foi possível aplicar migrações nos schemas de tenants adicionais: ${e.message}")
                }

                println("Database connection and base unit unification successful.")

            }
        } catch (e: Exception) {
            println("ERROR: Database connection failed. ${e.message}")
            throw IllegalStateException("Could not connect to the database.", e)
        }
    }
}
