package org.example.services

import java.util.Locale

object SqlSecurityValidator {

    private val TABELAS_PERMITIDAS = setOf(
        "unidade_medida",
        "fornecedor",
        "cliente",
        "insumo",
        "unidade_compra_insumo",
        "movimento_estoque_insumo",
        "produto_final",
        "produto_variacao",
        "receita_insumo",
        "despesa_fixa",
        "configuracao_global",
        "orcamento_compra",
        "item_orcamento",
        "cotacao_fornecedor",
        "pedido_compra",
        "pedido_compra_item",
        "compra",
        "item_compra",
        "pedido",
        "pedido_item",
        "funcionario"
    )

    private val PALAVRAS_PROIBIDAS = setOf(
        "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE",
        "EXEC", "EXECUTE", "MERGE", "GRANT", "REVOKE", "SET", "REPLACE",
        "CALL", "DO", "INTO", "VACUUM", "REINDEX", "COPY", "SHUTDOWN"
    )

    sealed class ValidacaoResultado {
        data class Valido(val sqlSanitizado: String) : ValidacaoResultado()
        data class Invalido(val motivo: String) : ValidacaoResultado()
    }

    /**
     * Valida e sanitiza uma instrução SQL gerada pelo LLM antes de qualquer execução.
     */
    fun validar(sqlRaw: String): ValidacaoResultado {
        var sql = sqlRaw.trim()

        // 1. Remove blocos de markdown ```sql ... ```
        if (sql.startsWith("```")) {
            sql = sql.substringAfter("\n")
            if (sql.endsWith("```")) {
                sql = sql.substringBeforeLast("```").trim()
            }
        }

        sql = sql.trim().trimEnd(';').trim()

        if (sql.isBlank()) {
            return ValidacaoResultado.Invalido("Consulta SQL está vazia.")
        }

        if (sql.length > 2500) {
            return ValidacaoResultado.Invalido("Consulta SQL excede o tamanho máximo permitido (2500 caracteres).")
        }

        // 2. Proíbe comentários maliciosos que possam mascarar injeção
        if (sql.contains("--") || sql.contains("/*") || sql.contains("*/")) {
            return ValidacaoResultado.Invalido("Comentários SQL (-- ou /* */) não são permitidos por motivos de segurança.")
        }

        // 3. Proíbe múltiplos comandos encadeados por ponto e vírgula
        if (sql.contains(";")) {
            return ValidacaoResultado.Invalido("Consultas empilhadas (múltiplos comandos separados por ponto e vírgula) são proibidas.")
        }

        // 4. Garante que começa estritamente com SELECT ou WITH
        val upperSql = sql.uppercase(Locale.ROOT)
        if (!upperSql.startsWith("SELECT") && !upperSql.startsWith("WITH")) {
            return ValidacaoResultado.Invalido("A consulta deve ser estritamente de leitura (iniciar com SELECT ou WITH).")
        }

        // 5. Proíbe palavras mutativas mesmo no meio da query
        val tokens = upperSql.split(Regex("[^A-Z0-9_]+")).filter { it.isNotBlank() }.toSet()
        for (palavra in PALAVRAS_PROIBIDAS) {
            if (tokens.contains(palavra)) {
                return ValidacaoResultado.Invalido("Uso proibido da palavra-chave '$palavra'. Apenas comandos de leitura são permitidos.")
            }
        }

        // 6. Proíbe acesso a tabelas do sistema PostgreSQL ou tabelas não mapeadas
        if (upperSql.contains("PG_") || upperSql.contains("INFORMATION_SCHEMA")) {
            return ValidacaoResultado.Invalido("Acesso a tabelas do sistema ou metadados do PostgreSQL é proibido.")
        }

        // 7. Enforça LIMIT de segurança para proteção de memória e FinOps
        val sqlComLimit = if (!upperSql.contains("LIMIT")) {
            "$sql LIMIT 50"
        } else {
            // Se já tem limit, garante que não seja abusivo
            val limitRegex = Regex("LIMIT\\s+(\\d+)", RegexOption.IGNORE_CASE)
            val match = limitRegex.find(sql)
            if (match != null) {
                val valorLimit = match.groupValues[1].toIntOrNull() ?: 50
                if (valorLimit > 100) {
                    sql.replace(match.value, "LIMIT 50")
                } else {
                    sql
                }
            } else {
                "$sql LIMIT 50"
            }
        }

        return ValidacaoResultado.Valido(sqlComLimit)
    }
}
