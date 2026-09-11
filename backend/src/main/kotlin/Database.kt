package org.example

import io.github.cdimascio.dotenv.dotenv
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction
import java.sql.Connection

object DatabaseConfig {

    private val dotenv = dotenv {
        directory = System.getProperty("user.dir")
        filename = ".env"
        ignoreIfMissing = true
    }

    private fun env(key: String): String? {
        val sysVal = System.getenv(key)
        if (!sysVal.isNullOrBlank()) return sysVal
        val dotVal = dotenv[key]
        if (!dotVal.isNullOrBlank()) return dotVal
        return null
    }

    fun connect() {
        val host = env("DB_HOST") ?: "postgres"
        val port = env("DB_PORT") ?: "5444"
        val dbName = env("DB_NAME") ?: "precifiq_db"
        val user = env("DB_USER") ?: "precifiq_user"
        val password = env("DB_PASSWORD") ?: "p2QL+2Svy&3cQUaM"
        val sslMode = env("DB_SSLMODE") ?: if (host == "postgres" || host == "localhost" || host == "127.0.0.1") "disable" else "require"
        val schema = env("DB_SCHEMA") ?: "controle"

        // Monta a URL base
        var url = "jdbc:postgresql://$host:$port/$dbName?sslmode=$sslMode&currentSchema=$schema"

        // Adiciona parâmetros específicos para o NeonDB apenas se o host for do NeonDB
        if (host.contains("neon.tech")) {
            url += "&channel_binding=require"
        }

        println("INFO: Connecting to database with URL: $url")

        val pgDataSource = org.postgresql.ds.PGSimpleDataSource().apply {
            setURL(url)
            this.user = user
            this.password = password
        }

        val multiTenantDataSource = MultiTenantDataSource(pgDataSource)

        Database.connect(multiTenantDataSource)

        initGlobalCatalog()
        testConnection()
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
                    DO ${'$'}${'$'} BEGIN
                        PERFORM setval('global.perfil_id_seq', (SELECT GREATEST(MAX(id), 4) FROM global.perfil));
                    END ${'$'}${'$'};
                """.trimIndent())

                // Seed da Matriz Inicial (schema controle)
                exec("""
                    INSERT INTO global.empresa (id, tipo, matriz_id, nome_fantasia, razao_social, cnpj, schema_name, ativo)
                    VALUES (1, 'MATRIZ', NULL, 'Controle Silvia (Matriz)', 'Silvia Artes & Cosméticos Ltda', '12.345.678/0001-90', 'controle', TRUE)
                    ON CONFLICT (id) DO UPDATE SET 
                        tipo = EXCLUDED.tipo,
                        schema_name = EXCLUDED.schema_name;
                    DO ${'$'}${'$'} BEGIN
                        PERFORM setval('global.empresa_id_seq', (SELECT GREATEST(MAX(id), 1) FROM global.empresa));
                    END ${'$'}${'$'};
                """.trimIndent())

                // Seed do Superusuário DcSys inicial (admin@dcsys.com / admin123)
                exec("""
                    INSERT INTO global.usuario (nome, email, senha_hash, is_superuser, ativo)
                    VALUES ('Superusuário DcSys', 'admin@dcsys.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE, TRUE)
                    ON CONFLICT (email) DO NOTHING;
                """.trimIndent())

                // Vínculo inicial do Superusuário DcSys com Matriz padrão
                exec("""
                    DO ${'$'}${'$'}
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
                    END ${'$'}${'$'};
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
                connection.transactionIsolation = Connection.TRANSACTION_READ_COMMITTED

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

                    -- Evoluções: Validade, Código de Barras e Integração de Vendas
                    ALTER TABLE insumo ADD COLUMN IF NOT EXISTS data_validade DATE;
                    ALTER TABLE insumo ADD COLUMN IF NOT EXISTS lote VARCHAR(50);
                    ALTER TABLE insumo ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);

                    ALTER TABLE movimento_estoque_insumo ADD COLUMN IF NOT EXISTS data_validade DATE;
                    ALTER TABLE movimento_estoque_insumo ADD COLUMN IF NOT EXISTS lote VARCHAR(50);

                    ALTER TABLE produto_variacao ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);

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

                    ALTER TABLE pedido ADD COLUMN IF NOT EXISTS valor_custo_total DOUBLE PRECISION DEFAULT 0.0;
                    ALTER TABLE pedido ADD COLUMN IF NOT EXISTS lucro_bruto DOUBLE PRECISION DEFAULT 0.0;

                    ALTER TABLE pedido_item ADD COLUMN IF NOT EXISTS kit_id INTEGER;
                    ALTER TABLE pedido_item ADD COLUMN IF NOT EXISTS custo_unitario DOUBLE PRECISION DEFAULT 0.0;

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

                println("Database connection and base unit unification successful.")
            }
        } catch (e: Exception) {
            println("ERROR: Database connection failed. ${e.message}")
            throw IllegalStateException("Could not connect to the database.", e)
        }
    }
}
