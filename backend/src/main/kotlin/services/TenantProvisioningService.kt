package org.example.services

import org.example.TenantContext
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.io.File
import java.sql.Connection

class TenantProvisioningService {

    /**
     * Provisiona um schema operacional isolado para uma nova empresa/filial.
     * Cria o schema, executa a DDL de todas as tabelas operacionais e insere os registros base.
     */
    fun provisionarTenant(schemaName: String) {
        if (!TenantContext.isValidSchema(schemaName)) {
            throw IllegalArgumentException("Nome de schema inválido: $schemaName")
        }

        val ddlContent = carregarTemplateDdl(schemaName)

        // 1. Cria o schema explicitamente
        transaction {
            try {
                exec("CREATE SCHEMA IF NOT EXISTS \"$schemaName\";")
            } catch (e: Exception) {
                System.err.println("Erro ao criar schema $schemaName: ${e.message}")
            }
        }

        val cleanDdl = ddlContent.lines()
            .filterNot { it.trim().startsWith("--") }
            .joinToString("\n")

        val statements = cleanDdl.split(";")
            .map { it.trim() }
            .filter { it.isNotBlank() }

        // 2. Executa cada instrução DDL em sua própria transação para não abortar todo o bloco
        for (stmt in statements) {
            try {
                transaction {
                    exec(stmt)
                }
            } catch (e: Exception) {
                if (e.message?.contains("already exists", ignoreCase = true) == false) {
                    System.err.println("Aviso ao executar instrução DDL no schema $schemaName: ${e.message}")
                }
            }
        }

        println("INFO: Schema '$schemaName' provisionado com sucesso com isolamento total.")
    }

    /**
     * Função para deploy de migration automatizada: aplica atualizações DDL e DML em todos os schemas cadastrados.
     * Retorna a lista com o status da execução em cada schema.
     */
    fun executarMigrationTodosTenants(): List<Map<String, Any>> {
        val resultados = mutableListOf<Map<String, Any>>()

        val schemas = transaction {
            org.example.EmpresasTable.selectAll().map { row ->
                row[org.example.EmpresasTable.schemaName]
            }.distinct()
        }

        for (schema in schemas) {
            try {
                provisionarTenant(schema)
                resultados.add(
                    mapOf(
                        "schema" to schema,
                        "status" to "SUCESSO",
                        "mensagem" to "Migration e DDL aplicadas com sucesso no schema '$schema'."
                    )
                )
            } catch (e: Exception) {
                resultados.add(
                    mapOf(
                        "schema" to schema,
                        "status" to "ERRO",
                        "mensagem" to (e.message ?: "Erro ao executar migration no schema '$schema'")
                    )
                )
            }
        }

        return resultados
    }

    /**
     * Carrega o arquivo de template DDL do disco ou usa o fallback embutido.
     */
    private fun carregarTemplateDdl(schemaName: String): String {
        val userDir = System.getProperty("user.dir")
        val possiblePaths = listOf(
            File(userDir, "tenant_schema_template.sql"),
            File(userDir, "../tenant_schema_template.sql"),
            File(userDir, "Controle/tenant_schema_template.sql")
        )

        for (file in possiblePaths) {
            if (file.exists() && file.isFile) {
                val raw = file.readText(Charsets.UTF_8)
                return raw.replace("%SCHEMA%", schemaName)
            }
        }

        // Fallback robusto caso o arquivo não seja encontrado no filesystem
        return gerarFallbackDdl(schemaName)
    }

    private fun gerarFallbackDdl(s: String): String {
        return """
            CREATE SCHEMA IF NOT EXISTS $s;

            CREATE TABLE IF NOT EXISTS $s.unidade_medida (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(100) UNIQUE NOT NULL,
                sigla VARCHAR(20) UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS $s.fornecedor (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                nome_fantasia VARCHAR(255),
                cnpj_cpf VARCHAR(20) UNIQUE NOT NULL,
                mnemonico VARCHAR(50),
                endereco_completo VARCHAR(255),
                cep VARCHAR(10),
                uf VARCHAR(2),
                email VARCHAR(100),
                telefones VARCHAR(100),
                banco VARCHAR(100),
                agencia VARCHAR(20),
                conta_corrente VARCHAR(30),
                chave_pix VARCHAR(100),
                categoria VARCHAR(50),
                prazo_pagamento_padrao VARCHAR(50),
                historico_atendimento TEXT,
                nome_empresa VARCHAR(200)
            );

            CREATE TABLE IF NOT EXISTS $s.cliente (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                telefone VARCHAR(20),
                email VARCHAR(100),
                endereco VARCHAR(255)
            );

            CREATE TABLE IF NOT EXISTS $s.insumo (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                unidade_medida_id INTEGER NOT NULL REFERENCES $s.unidade_medida(id),
                quantidade_por_embalagem DOUBLE PRECISION,
                unidade_embalagem_id INTEGER REFERENCES $s.unidade_medida(id),
                fornecedor_id INTEGER REFERENCES $s.fornecedor(id),
                preco DOUBLE PRECISION NOT NULL,
                is_embalagem BOOLEAN NOT NULL DEFAULT FALSE,
                estoque DOUBLE PRECISION DEFAULT 0.0,
                estoque_minimo DOUBLE PRECISION DEFAULT 0.0
            );

            CREATE TABLE IF NOT EXISTS $s.estoque_minimo_insumo_aux (
                insumo_id INTEGER PRIMARY KEY,
                estoque_minimo DOUBLE PRECISION DEFAULT 0.0
            );

            CREATE TABLE IF NOT EXISTS $s.estoque_variacao_aux (
                variacao_id INTEGER PRIMARY KEY,
                estoque DOUBLE PRECISION DEFAULT 0.0
            );

            CREATE TABLE IF NOT EXISTS $s.unidade_compra_insumo (
                id SERIAL PRIMARY KEY,
                insumo_id INTEGER NOT NULL REFERENCES $s.insumo(id) ON DELETE CASCADE,
                nome_embalagem VARCHAR(100) NOT NULL,
                fator_conversao DOUBLE PRECISION NOT NULL,
                preco_embalagem DOUBLE PRECISION,
                codigo_barras VARCHAR(50),
                criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS $s.movimento_estoque_insumo (
                id SERIAL PRIMARY KEY,
                insumo_id INTEGER NOT NULL REFERENCES $s.insumo(id) ON DELETE RESTRICT,
                tipo VARCHAR(30) NOT NULL,
                quantidade DOUBLE PRECISION NOT NULL,
                saldo_anterior DOUBLE PRECISION NOT NULL,
                saldo_posterior DOUBLE PRECISION NOT NULL,
                origem_referencia VARCHAR(50),
                referencia_id INTEGER,
                motivo TEXT,
                criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                criado_por INTEGER
            );

            CREATE TABLE IF NOT EXISTS $s.produto_final (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                descricao TEXT,
                rendimento_receita_base DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                rendimento DOUBLE PRECISION DEFAULT 1.0,
                rotulo VARCHAR(255)
            );

            ALTER TABLE $s.produto_final ADD COLUMN IF NOT EXISTS rendimento_receita_base DOUBLE PRECISION DEFAULT 1.0;
            ALTER TABLE $s.produto_final ADD COLUMN IF NOT EXISTS rendimento DOUBLE PRECISION DEFAULT 1.0;
            ALTER TABLE $s.produto_final ADD COLUMN IF NOT EXISTS rotulo VARCHAR(255);
            ALTER TABLE $s.produto_final ALTER COLUMN rendimento DROP NOT NULL;
            ALTER TABLE $s.produto_final ALTER COLUMN rendimento SET DEFAULT 1.0;



            CREATE TABLE IF NOT EXISTS $s.produto_variacao (
                id SERIAL PRIMARY KEY,
                produto_id INTEGER NOT NULL REFERENCES $s.produto_final(id) ON DELETE CASCADE,
                nome_tamanho VARCHAR(255) NOT NULL,
                tamanho_medida DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                unidade_medida_tamanho_id INTEGER REFERENCES $s.unidade_medida(id),
                embalagem_insumo_id INTEGER REFERENCES $s.insumo(id),
                tempo_producao_minutos DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                margem_lucro DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                preco_venda DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                custo_unitario_calculado DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                estoque DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                codigo_barras VARCHAR(50),
                multiplicador_receita DOUBLE PRECISION DEFAULT 1.0,
                tempo_producao_segundos DOUBLE PRECISION DEFAULT 0.0,
                custo_fixo_rateado DOUBLE PRECISION DEFAULT 0.0,
                peso_g DOUBLE PRECISION,
                preco_venda_manual DOUBLE PRECISION,
                descricao_visual TEXT
            );

            CREATE TABLE IF NOT EXISTS $s.variacao_material (
                id SERIAL PRIMARY KEY,
                variacao_id INTEGER NOT NULL REFERENCES $s.produto_variacao(id) ON DELETE CASCADE,
                insumo_id INTEGER NOT NULL REFERENCES $s.insumo(id) ON DELETE RESTRICT,
                quantidade DOUBLE PRECISION NOT NULL DEFAULT 1.0
            );

            CREATE TABLE IF NOT EXISTS $s.receita_insumo (
                id SERIAL PRIMARY KEY,
                produto_id INTEGER NOT NULL REFERENCES $s.produto_final(id) ON DELETE CASCADE,
                insumo_id INTEGER NOT NULL REFERENCES $s.insumo(id),
                quantidade_usada DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS $s.funcionario (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                salario_base DOUBLE PRECISION NOT NULL,
                dias_trabalhados_mes INTEGER NOT NULL,
                horas_trabalhadas_dia DOUBLE PRECISION NOT NULL,
                produtividade_estimada DOUBLE PRECISION NOT NULL,
                custo_hora DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS $s.despesa_fixa (
                id SERIAL PRIMARY KEY,
                descricao VARCHAR(255) NOT NULL,
                valor_mensal DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS $s.configuracao_global (
                id SERIAL PRIMARY KEY,
                horas_totais_trabalhadas_mes DOUBLE PRECISION NOT NULL,
                custo_hora_fabrica DOUBLE PRECISION NOT NULL,
                custo_fixo_minuto DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                custo_operacional_total_mes DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                markup_padrao DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                ultima_atualizacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS $s.orcamento_compra (
                id SERIAL PRIMARY KEY,
                data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) NOT NULL,
                solicitante VARCHAR(100),
                observacao TEXT
            );

            CREATE TABLE IF NOT EXISTS $s.item_orcamento (
                id SERIAL PRIMARY KEY,
                orcamento_id INTEGER NOT NULL REFERENCES $s.orcamento_compra(id) ON DELETE CASCADE,
                insumo_id INTEGER NOT NULL REFERENCES $s.insumo(id),
                quantidade_solicitada DOUBLE PRECISION DEFAULT 1.0,
                quantidade DOUBLE PRECISION DEFAULT 1.0,
                ativo BOOLEAN DEFAULT TRUE,
                quantidade_recebida DOUBLE PRECISION,
                preco_unitario_recebido DOUBLE PRECISION,
                valor_final_item DOUBLE PRECISION
            );

            CREATE TABLE IF NOT EXISTS $s.cotacao_fornecedor (
                id SERIAL PRIMARY KEY,
                item_orcamento_id INTEGER NOT NULL REFERENCES $s.item_orcamento(id) ON DELETE CASCADE,
                fornecedor_id INTEGER NOT NULL REFERENCES $s.fornecedor(id),
                preco_cotado DOUBLE PRECISION DEFAULT 0.0,
                preco_unitario DOUBLE PRECISION DEFAULT 0.0,
                prazo_entrega_dias INTEGER,
                condicoes_pagamento VARCHAR(100),
                selecionada BOOLEAN DEFAULT FALSE,
                observacao TEXT
            );

            CREATE TABLE IF NOT EXISTS $s.pedido_compra (
                id SERIAL PRIMARY KEY,
                data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                fornecedor_id INTEGER NOT NULL REFERENCES $s.fornecedor(id),
                orcamento_id INTEGER REFERENCES $s.orcamento_compra(id),
                status VARCHAR(50) NOT NULL,
                valor_total DOUBLE PRECISION NOT NULL,
                prazo_entrega_acordado TIMESTAMP WITHOUT TIME ZONE,
                forma_pagamento VARCHAR(100),
                observacao TEXT
            );

            CREATE TABLE IF NOT EXISTS $s.pedido_compra_item (
                id SERIAL PRIMARY KEY,
                pedido_compra_id INTEGER NOT NULL REFERENCES $s.pedido_compra(id) ON DELETE CASCADE,
                insumo_id INTEGER NOT NULL REFERENCES $s.insumo(id),
                quantidade DOUBLE PRECISION NOT NULL,
                preco_unitario DOUBLE PRECISION NOT NULL,
                valor_total DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS $s.compra (
                id SERIAL PRIMARY KEY,
                orcamento_id INTEGER,
                fornecedor_id INTEGER REFERENCES $s.fornecedor(id),
                justificativa VARCHAR(500),
                data_prevista TIMESTAMP WITHOUT TIME ZONE,
                data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
                valor_total DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                data_entrega TIMESTAMP WITHOUT TIME ZONE,
                nota_fiscal VARCHAR(100),
                observacao TEXT
            );

            ALTER TABLE $s.compra ADD COLUMN IF NOT EXISTS orcamento_id INTEGER;
            ALTER TABLE $s.compra ADD COLUMN IF NOT EXISTS justificativa VARCHAR(500);
            ALTER TABLE $s.compra ADD COLUMN IF NOT EXISTS data_prevista TIMESTAMP WITHOUT TIME ZONE;
            ALTER TABLE $s.compra ADD COLUMN IF NOT EXISTS valor_total DOUBLE PRECISION DEFAULT 0.0;
            ALTER TABLE $s.compra ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDENTE';

            CREATE TABLE IF NOT EXISTS $s.item_compra (
                id SERIAL PRIMARY KEY,
                compra_id INTEGER NOT NULL REFERENCES $s.compra(id) ON DELETE CASCADE,
                item_orcamento_id INTEGER,
                insumo_id INTEGER NOT NULL REFERENCES $s.insumo(id),
                quantidade_solicitada DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                quantidade_comprada DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                quantidade_recebida DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                preco_unitario DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                fornecedor_sugerido_id INTEGER,
                ativo BOOLEAN NOT NULL DEFAULT TRUE,
                quantidade DOUBLE PRECISION DEFAULT 1.0,
                valor_total DOUBLE PRECISION DEFAULT 0.0
            );

            ALTER TABLE $s.item_compra ADD COLUMN IF NOT EXISTS item_orcamento_id INTEGER;
            ALTER TABLE $s.item_compra ADD COLUMN IF NOT EXISTS quantidade_solicitada DOUBLE PRECISION DEFAULT 1.0;
            ALTER TABLE $s.item_compra ADD COLUMN IF NOT EXISTS quantidade_comprada DOUBLE PRECISION DEFAULT 0.0;
            ALTER TABLE $s.item_compra ADD COLUMN IF NOT EXISTS quantidade_recebida DOUBLE PRECISION DEFAULT 0.0;
            ALTER TABLE $s.item_compra ADD COLUMN IF NOT EXISTS preco_unitario DOUBLE PRECISION DEFAULT 0.0;
            ALTER TABLE $s.item_compra ADD COLUMN IF NOT EXISTS fornecedor_sugerido_id INTEGER;
            ALTER TABLE $s.item_compra ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;


            CREATE TABLE IF NOT EXISTS $s.pedido (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER REFERENCES $s.cliente(id),
                data_pedido TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) NOT NULL,
                valor_total DOUBLE PRECISION NOT NULL,
                canal_venda VARCHAR(50),
                observacoes TEXT
            );

            CREATE TABLE IF NOT EXISTS $s.pedido_item (
                id SERIAL PRIMARY KEY,
                pedido_id INTEGER NOT NULL REFERENCES $s.pedido(id) ON DELETE CASCADE,
                variacao_id INTEGER REFERENCES $s.produto_variacao(id),
                produto_nome VARCHAR(255),
                tamanho VARCHAR(255),
                quantidade INTEGER NOT NULL,
                preco_unitario DOUBLE PRECISION NOT NULL,
                valor_total DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS $s.itens_estoque (
                id SERIAL PRIMARY KEY,
                variacao_id INTEGER NOT NULL REFERENCES $s.produto_variacao(id) ON DELETE CASCADE,
                localizacao VARCHAR(100) NOT NULL DEFAULT 'Geral',
                quantidade_atual DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                quantidade_minima DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                lote VARCHAR(50),
                data_validade DATE,
                atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS $s.movimentacoes_estoque (
                id SERIAL PRIMARY KEY,
                variacao_id INTEGER NOT NULL REFERENCES $s.produto_variacao(id) ON DELETE CASCADE,
                tipo VARCHAR(30) NOT NULL,
                quantidade DOUBLE PRECISION NOT NULL,
                motivo VARCHAR(255),
                origem VARCHAR(100),
                data_movimentacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                usuario_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS $s.ordens_producao (
                id SERIAL PRIMARY KEY,
                variacao_id INTEGER NOT NULL REFERENCES $s.produto_variacao(id) ON DELETE RESTRICT,
                quantidade_planejada DOUBLE PRECISION NOT NULL,
                quantidade_produzida DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                status VARCHAR(50) NOT NULL DEFAULT 'PLANEJADA',
                data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                data_conclusao TIMESTAMP WITHOUT TIME ZONE,
                responsavel VARCHAR(100),
                observacoes TEXT
            );

            CREATE TABLE IF NOT EXISTS $s.kits (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                codigo VARCHAR(100) UNIQUE,
                codigo_barras VARCHAR(50),
                descricao TEXT,
                margem_lucro DOUBLE PRECISION DEFAULT 0.0,
                custo_total_calculado DOUBLE PRECISION DEFAULT 0.0,
                preco_venda DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                ativo BOOLEAN NOT NULL DEFAULT TRUE,
                criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS $s.kit_itens (
                id SERIAL PRIMARY KEY,
                kit_id INTEGER NOT NULL REFERENCES $s.kits(id) ON DELETE CASCADE,
                produto_variacao_id INTEGER NOT NULL REFERENCES $s.produto_variacao(id) ON DELETE RESTRICT,
                quantidade INTEGER NOT NULL DEFAULT 1,
                desconto_percentual DOUBLE PRECISION NOT NULL DEFAULT 0.0
            );

            CREATE TABLE IF NOT EXISTS $s.pedidos_financeiro (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER NOT NULL REFERENCES $s.cliente(id),
                data_emissao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                data_vencimento TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                valor_total DOUBLE PRECISION NOT NULL,
                status_financeiro VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
                forma_pagamento VARCHAR(50) NOT NULL,
                observacoes TEXT
            );

            CREATE TABLE IF NOT EXISTS $s.transacoes_financeiras (
                id SERIAL PRIMARY KEY,
                pedido_financeiro_id INTEGER NOT NULL REFERENCES $s.pedidos_financeiro(id) ON DELETE CASCADE,
                valor_pago DOUBLE PRECISION NOT NULL,
                data_pagamento TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                forma_pagamento VARCHAR(50) NOT NULL,
                comprovante_identificador VARCHAR(100),
                usuario_responsavel VARCHAR(100)
            );

            CREATE TABLE IF NOT EXISTS $s.historico_cobranca (
                id SERIAL PRIMARY KEY,
                pedido_financeiro_id INTEGER NOT NULL REFERENCES $s.pedidos_financeiro(id) ON DELETE CASCADE,
                data_contato TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                tipo_contato VARCHAR(50) NOT NULL,
                mensagem TEXT,
                resposta_cliente TEXT,
                usuario VARCHAR(100)
            );

            INSERT INTO $s.unidade_medida (nome, sigla) VALUES
                ('Unidade', 'un'),
                ('Quilograma', 'kg'),
                ('Grama', 'g'),
                ('Litro', 'l'),
                ('Mililitro', 'ml'),
                ('Metro', 'm'),
                ('Centímetro', 'cm'),
                ('Caixa', 'cx')
            ON CONFLICT (sigla) DO NOTHING;
        """.trimIndent()
    }
}
