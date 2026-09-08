package org.example

import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.transactions.TransactionManager

fun main() {
    println("Connecting to the database to apply migrations...")
    DatabaseConfig.connect()
    println("Connection successful. Applying migrations...")

    // 1. O bloco 'transaction' é OBRIGATÓRIO no Exposed para executar comandos no banco
    transaction {

        // 1. Convert legacy varchar date columns to timestamp only when needed.
        exec("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'orcamento_compra'
                      AND column_name = 'data_criacao'
                      AND data_type IN ('character', 'character varying')
                ) THEN
                    ALTER TABLE orcamento_compra
                    ALTER COLUMN data_criacao TYPE TIMESTAMP
                    USING TO_TIMESTAMP(data_criacao, 'DD/MM/YYYY HH24:MI');
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'pedido_compra'
                      AND column_name = 'data_confirmacao'
                      AND data_type IN ('character', 'character varying')
                ) THEN
                    ALTER TABLE pedido_compra
                    ALTER COLUMN data_confirmacao TYPE TIMESTAMP
                    USING TO_TIMESTAMP(data_confirmacao, 'DD/MM/YYYY HH24:MI');
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'compra'
                      AND column_name = 'data_criacao'
                      AND data_type IN ('character', 'character varying')
                ) THEN
                    ALTER TABLE compra
                    ALTER COLUMN data_criacao TYPE TIMESTAMP
                    USING TO_TIMESTAMP(data_criacao, 'DD/MM/YYYY HH24:MI');
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'compra'
                      AND column_name = 'data_prevista'
                ) THEN
                    UPDATE compra
                    SET data_prevista = NULL
                    WHERE data_prevista IS NOT NULL
                      AND data_prevista !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}( [0-9]{2}:[0-9]{2})?$';
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'compra'
                      AND column_name = 'data_prevista'
                      AND data_type IN ('character', 'character varying')
                ) THEN
                    ALTER TABLE compra
                    ALTER COLUMN data_prevista TYPE TIMESTAMP
                    USING CASE
                        WHEN data_prevista ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}( [0-9]{2}:[0-9]{2})?$'
                        THEN TO_TIMESTAMP(data_prevista, 'DD/MM/YYYY HH24:MI')
                        ELSE NULL
                    END;
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'log_auditoria'
                      AND column_name = 'data_hora'
                      AND data_type IN ('character', 'character varying')
                ) THEN
                    ALTER TABLE log_auditoria
                    ALTER COLUMN data_hora TYPE TIMESTAMP
                    USING TO_TIMESTAMP(data_hora, 'DD/MM/YYYY HH24:MI');
                END IF;
            END $$;
        """.trimIndent())

        // 2. Remove duplicate pedido_id column from pedido_compra_item
        exec("""
            ALTER TABLE pedido_compra_item
            DROP COLUMN IF EXISTS pedido_id;
        """.trimIndent())

        // 3. Add CHECK constraints for status fields if they do not already exist
        exec("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orcamento_status') THEN
                    ALTER TABLE orcamento_compra
                    ADD CONSTRAINT chk_orcamento_status
                    CHECK (status IN (
                        'EM_DIGITACAO', 'EM_ORCAMENTO', 'ORCAMENTO_APROVADO',
                        'AGUARDANDO_ENTREGA', 'COMPRA_APROVADA', 'CONCLUIDO',
                        'CONVERTIDO', 'ABERTO', 'RECEBIDO'
                    ));
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compra_status') THEN
                    ALTER TABLE compra
                    ADD CONSTRAINT chk_compra_status
                    CHECK (status IN ('PENDENTE', 'RECEBIDO'));
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pedido_forma_pagamento') THEN
                    ALTER TABLE pedido_compra
                    ADD CONSTRAINT chk_pedido_forma_pagamento
                    CHECK (forma_pagamento IN ('PIX', 'CARTAO', 'DEBITO', 'DEPOSITO'));
                END IF;
            END $$;
        """.trimIndent())

        // 4. Add singleton protection for configuracao_global
        exec("""
            UPDATE configuracao_global SET id = 1 WHERE id != 1 OR id IS NULL;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracao_global_pkey') THEN
                    ALTER TABLE configuracao_global
                    ADD CONSTRAINT configuracao_global_pkey PRIMARY KEY (id);
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_configuracao_global_singleton') THEN
                    ALTER TABLE configuracao_global
                    ADD CONSTRAINT chk_configuracao_global_singleton
                    CHECK (id = 1);
                END IF;
            END $$;
        """.trimIndent())

        exec("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
                    WHERE t.relname = 'item_compra'
                      AND a.attname = 'insumo_id'
                      AND c.contype = 'f'
                ) THEN
                    ALTER TABLE item_compra
                    ADD CONSTRAINT fk_item_compra_insumo_id
                    FOREIGN KEY (insumo_id) REFERENCES insumo(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
                END IF;
            END $$;
        """.trimIndent())

        // 5. Add missing FK indexes
        exec("CREATE INDEX IF NOT EXISTS idx_insumo_unidade_medida_id ON insumo(unidade_medida_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_insumo_unidade_embalagem_id ON insumo(unidade_embalagem_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_insumo_fornecedor_id ON insumo(fornecedor_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_produto_variacao_produto_id ON produto_variacao(produto_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_produto_variacao_embalagem_insumo_id ON produto_variacao(embalagem_insumo_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_produto_variacao_unidade_medida_tamanho_id ON produto_variacao(unidade_medida_tamanho_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_receita_insumo_produto_id ON receita_insumo(produto_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_receita_insumo_insumo_id ON receita_insumo(insumo_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_item_orcamento_orcamento_id ON item_orcamento(orcamento_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_item_orcamento_insumo_id ON item_orcamento(insumo_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_cotacao_fornecedor_item_orcamento_id ON cotacao_fornecedor(item_orcamento_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_cotacao_fornecedor_fornecedor_id ON cotacao_fornecedor(fornecedor_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_compra_orcamento_id ON pedido_compra(orcamento_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_compra_fornecedor_id ON pedido_compra(fornecedor_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_compra_item_pedido_compra_id ON pedido_compra_item(pedido_compra_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_compra_item_item_orcamento_id ON pedido_compra_item(item_orcamento_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_compra_item_insumo_id ON pedido_compra_item(insumo_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_compra_orcamento_id ON compra(orcamento_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_compra_fornecedor_id ON compra(fornecedor_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_item_compra_compra_id ON item_compra(compra_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_item_compra_insumo_id ON item_compra(insumo_id);")

        // 6. Add composite indexes for common queries
        exec("CREATE INDEX IF NOT EXISTS idx_item_orcamento_orcamento_ativo ON item_orcamento(orcamento_id, ativo);")
        exec("CREATE INDEX IF NOT EXISTS idx_compra_status_data ON compra(status, data_criacao);")
        exec("CREATE INDEX IF NOT EXISTS idx_orcamento_ativo_data ON orcamento_compra(ativo, data_criacao);")
        exec("CREATE INDEX IF NOT EXISTS idx_cotacao_item_preco ON cotacao_fornecedor(item_orcamento_id, preco_unitario);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_orcamento ON pedido_compra(orcamento_id);")

        // 7. Add missing columns required by the current schema
        exec("ALTER TABLE item_compra ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;")

        // 8. Add single columns indexes
        exec("CREATE INDEX IF NOT EXISTS idx_auditoria_data_hora ON log_auditoria(data_hora);")
        exec("CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON log_auditoria(usuario_id);")
        exec("CREATE INDEX IF NOT EXISTS idx_item_compra_ativo ON item_compra(ativo);")
        exec("CREATE INDEX IF NOT EXISTS idx_orcamento_status ON orcamento_compra(status);")
        exec("CREATE INDEX IF NOT EXISTS idx_compra_status ON compra(status);")

        // 8. Recreate the materialized view used by the pricing dashboard.
        exec("DROP MATERIALIZED VIEW IF EXISTS mv_precos_produtos;")
        exec("""
             CREATE MATERIALIZED VIEW mv_precos_produtos AS
             SELECT pv.id AS variacao_id,
                 pf.nome AS produto_nome,
                 pv.nome_tamanho,
                 pv.tamanho_medida,
                 um.sigla AS unidade_tamanho,
                 pv.custo_unitario_calculado,
                 pv.preco_venda,
                 pv.margem_lucro
             FROM produto_variacao pv
                 JOIN produto_final pf ON pv.produto_id = pf.id
                 JOIN unidade_medida um ON pv.unidade_medida_tamanho_id = um.id
             ORDER BY pf.nome, pv.nome_tamanho;
        """.trimIndent())

        // Create unique index on materialized view
        exec("""
             DO $$ BEGIN
                 IF NOT EXISTS (
                     SELECT 1 FROM pg_indexes
                     WHERE schemaname = 'public'
                       AND tablename = 'mv_precos_produtos'
                       AND indexname = 'idx_mv_precos_produtos_variacao_id'
                 ) THEN
                     CREATE UNIQUE INDEX idx_mv_precos_produtos_variacao_id
                     ON mv_precos_produtos(variacao_id);
                 END IF;
             END $$;
        """.trimIndent())

        // 9. Add trigger function to refresh materialized view on data changes
        exec("""
             CREATE OR REPLACE FUNCTION refresh_mv_precos_produtos()
             RETURNS TRIGGER AS $$
             BEGIN
                 REFRESH MATERIALIZED VIEW mv_precos_produtos;
                 RETURN NULL;
             END;
             $$ LANGUAGE plpgsql;
        """.trimIndent())

        exec("DROP TRIGGER IF EXISTS trg_refresh_mv_precos_produtos_pv ON produto_variacao;")
        exec("DROP TRIGGER IF EXISTS trg_refresh_mv_precos_produtos_pf ON produto_final;")
        exec("DROP TRIGGER IF EXISTS trg_refresh_mv_precos_produtos_um ON unidade_medida;")

        exec("""
            CREATE TRIGGER trg_refresh_mv_precos_produtos_pv
            AFTER INSERT OR UPDATE OR DELETE ON produto_variacao
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_precos_produtos();
        """.trimIndent())

        exec("""
            CREATE TRIGGER trg_refresh_mv_precos_produtos_pf
            AFTER INSERT OR UPDATE OR DELETE ON produto_final
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_precos_produtos();
        """.trimIndent())

        exec("""
            CREATE TRIGGER trg_refresh_mv_precos_produtos_um
            AFTER INSERT OR UPDATE OR DELETE ON unidade_medida
            FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_precos_produtos();
        """.trimIndent())

        // 10. Particionamento real de log_auditoria
        exec("""
            DO $$ 
            BEGIN
                -- Verifica se a tabela já é particionada para evitar falhas em execuções repetidas
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_class 
                    WHERE relname = 'log_auditoria' AND relkind = 'p'
                ) THEN
                    -- Cria a estrutura da tabela particionada
                    CREATE TABLE IF NOT EXISTS log_auditoria_partitioned (
                        id SERIAL,
                        usuario_id INT NOT NULL,
                        data_hora TIMESTAMP NOT NULL,
                        operacao VARCHAR(50) NOT NULL,
                        tabela VARCHAR(100) NOT NULL,
                        registro_id INT NOT NULL,
                        dados_antigos TEXT,
                        dados_novos TEXT,
                        PRIMARY KEY (id, data_hora)
                    ) PARTITION BY RANGE (data_hora);

                    -- Cria uma partição default para absorver dados antigos ou que caiam fora das mensais
                    CREATE TABLE IF NOT EXISTS log_auditoria_default 
                    PARTITION OF log_auditoria_partitioned DEFAULT;

                    -- Migra os dados se a tabela antiga existir
                    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'log_auditoria') THEN
                        INSERT INTO log_auditoria_partitioned (id, usuario_id, data_hora, operacao, tabela, registro_id, dados_antigos, dados_novos)
                        SELECT id, usuario_id, data_hora, operacao, tabela, registro_id, dados_antigos, dados_novos FROM log_auditoria;
                        
                        -- Substitui a tabela antiga pela nova
                        DROP TABLE log_auditoria CASCADE;
                    END IF;

                    ALTER TABLE log_auditoria_partitioned RENAME TO log_auditoria;
                END IF;
            END $$;
        """.trimIndent())

        // 11. Add trigger function to update calculated fields in produto_variacao
        exec("""
            CREATE OR REPLACE FUNCTION update_calculated_fields()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Recalcula APENAS para os produtos afetados no contexto atual
                WITH variation_costs AS (
                    SELECT
                        pv.id AS variacao_id,
                        COALESCE(SUM(i.preco * COALESCE(ri.quantidade_usada, 0.0)), 0.0)
                        + COALESCE((
                            SELECT i.preco
                            FROM insumo i
                            WHERE i.id = pv.embalagem_insumo_id
                        ), 0.0) AS total_custo
                    FROM produto_variacao pv
                    LEFT JOIN receita_insumo ri ON ri.produto_id = pv.produto_id
                    LEFT JOIN insumo i ON i.id = ri.insumo_id
                    GROUP BY pv.id, pv.embalagem_insumo_id
                )
                UPDATE produto_variacao pv
                SET custo_unitario_calculado = vc.total_custo,
                    preco_venda = vc.total_custo * (1 + pv.margem_lucro / 100.0)
                FROM variation_costs vc
                WHERE pv.id = vc.variacao_id;

                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
        """.trimIndent())

        exec("DROP TRIGGER IF EXISTS trg_update_calculated_fields ON receita_insumo;")
        exec("""
            CREATE TRIGGER trg_update_calculated_fields
            AFTER INSERT OR UPDATE OR DELETE ON receita_insumo
            FOR EACH STATEMENT EXECUTE FUNCTION update_calculated_fields();
        """.trimIndent())

        exec("DROP TRIGGER IF EXISTS trg_update_calculated_fields_insumo ON insumo;")
        exec("""
            CREATE TRIGGER trg_update_calculated_fields_insumo
            AFTER UPDATE ON insumo
            FOR EACH STATEMENT EXECUTE FUNCTION update_calculated_fields();
        """.trimIndent())

        // 12. Add index on fornecedor.categoria for filtering
        exec("CREATE INDEX IF NOT EXISTS idx_fornecedor_categoria ON fornecedor(categoria);")

        // 13. Add index on insumo.is_embalagem for filtering
        exec("CREATE INDEX IF NOT EXISTS idx_insumo_is_embalagem ON insumo(is_embalagem);")

        // 14. Add index on orcamento_compra.titulo for search
        exec("CREATE INDEX IF NOT EXISTS idx_orcamento_titulo ON orcamento_compra(titulo);")

        // 15. Add trigger to update valor_total in compra when items change
        exec("""
            CREATE OR REPLACE FUNCTION update_compra_valor_total()
            RETURNS TRIGGER AS $$
            BEGIN
                UPDATE compra
                SET valor_total = (
                    SELECT COALESCE(SUM(quantidade_solicitada * preco_unitario), 0.0)
                    FROM item_compra
                    WHERE compra_id = COALESCE(NEW.compra_id, OLD.compra_id)
                )
                WHERE id = COALESCE(NEW.compra_id, OLD.compra_id);
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
        """.trimIndent())

        exec("DROP TRIGGER IF EXISTS trg_update_compra_valor_total ON item_compra;")
        exec("""
            CREATE TRIGGER trg_update_compra_valor_total
            AFTER INSERT OR UPDATE OR DELETE ON item_compra
            FOR EACH ROW EXECUTE FUNCTION update_compra_valor_total();
        """.trimIndent())

        // 16. Create pedido and pedido_item tables for operational orders
        exec("""
            CREATE TABLE IF NOT EXISTS pedido (
                id SERIAL PRIMARY KEY,
                cliente VARCHAR(255) NOT NULL,
                valor DOUBLE PRECISION NOT NULL,
                forma_pagamento VARCHAR(50) NOT NULL,
                data_pagamento VARCHAR(20),
                entregue BOOLEAN DEFAULT FALSE
            );
        """.trimIndent())

        exec("""
            CREATE TABLE IF NOT EXISTS pedido_item (
                id SERIAL PRIMARY KEY,
                pedido_id INTEGER NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
                nome_produto VARCHAR(255) NOT NULL,
                quantidade INTEGER NOT NULL,
                preco_unitario DOUBLE PRECISION NOT NULL
            );
        """.trimIndent())

        exec("CREATE INDEX IF NOT EXISTS idx_pedido_cliente ON pedido(cliente);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_entregue ON pedido(entregue);")
        exec("CREATE INDEX IF NOT EXISTS idx_pedido_item_pedido_id ON pedido_item(pedido_id);")

    } // Fim do transaction block

    println("Migrations complete.")
}