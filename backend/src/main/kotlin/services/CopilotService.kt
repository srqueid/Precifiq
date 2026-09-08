package org.example.services

import org.example.CopilotRespostaResponse
import org.example.CopilotSugestaoDTO
import org.jetbrains.exposed.sql.transactions.transaction
import java.sql.Connection

class CopilotService(
    private val geminiService: GeminiService
) {

    /**
     * Processa a pergunta do usuário através do pipeline seguro de Text-to-SQL:
     * Pergunta -> Gemini -> Validador de Segurança -> Execução Read-Only -> Síntese Executiva
     */
    fun processarPergunta(pergunta: String): CopilotRespostaResponse {
        val inicio = System.currentTimeMillis()
        val perguntaLimpa = pergunta.trim()

        if (perguntaLimpa.isBlank()) {
            return CopilotRespostaResponse(
                sucesso = false,
                pergunta = pergunta,
                respostaMarkdown = "Por favor, digite uma pergunta sobre o estoque, compras, produtos ou operações.",
                erro = "Pergunta vazia."
            )
        }

        // 1. Tradução da linguagem natural para SQL pelo Gemini
        val sqlGerado = try {
            geminiService.traduzirPerguntaParaSql(perguntaLimpa)
        } catch (e: Exception) {
            return CopilotRespostaResponse(
                sucesso = false,
                pergunta = perguntaLimpa,
                respostaMarkdown = "Não foi possível interpretar a pergunta no momento.",
                erro = e.message,
                tempoExecucaoMs = System.currentTimeMillis() - inicio
            )
        }

        // 2. Validação Rigorosa de Segurança (Defesa em Profundidade)
        val validacao = SqlSecurityValidator.validar(sqlGerado)
        if (validacao is SqlSecurityValidator.ValidacaoResultado.Invalido) {
            return CopilotRespostaResponse(
                sucesso = false,
                pergunta = perguntaLimpa,
                respostaMarkdown = "⚠️ **Consulta bloqueada pelo sistema de segurança**: ${validacao.motivo}",
                sqlExecutado = sqlGerado,
                erro = validacao.motivo,
                tempoExecucaoMs = System.currentTimeMillis() - inicio
            )
        }

        val sqlSanitizado = (validacao as SqlSecurityValidator.ValidacaoResultado.Valido).sqlSanitizado

        // 3. Execução segura no PostgreSQL com transação Read-Only e timeout
        val (colunas, linhas) = try {
            executarSqlSeguro(sqlSanitizado)
        } catch (e: Exception) {
            return CopilotRespostaResponse(
                sucesso = false,
                pergunta = perguntaLimpa,
                respostaMarkdown = "Ocorreu um erro ao consultar o banco de dados para responder à sua pergunta.",
                sqlExecutado = sqlSanitizado,
                erro = e.message,
                tempoExecucaoMs = System.currentTimeMillis() - inicio
            )
        }

        // 4. Síntese executiva dos dados retornados
        val sinteseMarkdown = try {
            geminiService.sintetizarRespostaCopilot(perguntaLimpa, sqlSanitizado, colunas, linhas)
        } catch (e: Exception) {
            "Foram localizados **${linhas.size} registro(s)** para a sua pergunta."
        }

        val duracao = System.currentTimeMillis() - inicio

        return CopilotRespostaResponse(
            sucesso = true,
            pergunta = perguntaLimpa,
            respostaMarkdown = sinteseMarkdown,
            sqlExecutado = sqlSanitizado,
            colunas = colunas,
            linhas = linhas,
            totalRegistros = linhas.size,
            tempoExecucaoMs = duracao
        )
    }

    private fun executarSqlSeguro(sql: String): Pair<List<String>, List<Map<String, Any?>>> {
        return transaction {
            val rawConnection = (this.connection.connection as? Connection)
                ?: throw IllegalStateException("Conexão JDBC nativa não disponível.")

            rawConnection.isReadOnly = true

            rawConnection.prepareStatement(sql).use { statement ->
                statement.queryTimeout = 5 // Limite rígido de 5 segundos

                statement.executeQuery().use { rs ->
                    val metaData = rs.metaData
                    val count = metaData.columnCount
                    val colunas = (1..count).map { metaData.getColumnLabel(it) }

                    val linhas = mutableListOf<Map<String, Any?>>()
                    while (rs.next()) {
                        val rowMap = mutableMapOf<String, Any?>()
                        for (i in 1..count) {
                            val colName = colunas[i - 1]
                            val colVal = rs.getObject(i)
                            rowMap[colName] = when (colVal) {
                                is java.sql.Timestamp -> colVal.toLocalDateTime().toString().replace("T", " ")
                                is java.sql.Date -> colVal.toLocalDate().toString()
                                else -> colVal
                            }
                        }
                        linhas.add(rowMap)
                    }

                    Pair(colunas, linhas)
                }
            }
        }
    }

    fun obterSugestoes(): List<CopilotSugestaoDTO> {
        return listOf(
            CopilotSugestaoDTO(
                id = "sug-1",
                categoria = "Estoque",
                pergunta = "Quais insumos estão com estoque abaixo do mínimo?"
            ),
            CopilotSugestaoDTO(
                id = "sug-2",
                categoria = "Produtos & Margem",
                pergunta = "Quais são os 5 produtos com maior margem de lucro?"
            ),
            CopilotSugestaoDTO(
                id = "sug-3",
                categoria = "Produtos & Margem",
                pergunta = "Existe algum produto operando com margem de lucro negativa ou abaixo de 20%?"
            ),
            CopilotSugestaoDTO(
                id = "sug-4",
                categoria = "Compras",
                pergunta = "Quais compras estão com status pendente aguardando recebimento?"
            ),
            CopilotSugestaoDTO(
                id = "sug-5",
                categoria = "Estoque",
                pergunta = "Qual o valor financeiro total imobilizado em estoque de matérias-primas?"
            ),
            CopilotSugestaoDTO(
                id = "sug-6",
                categoria = "Fornecedores",
                pergunta = "Quantos fornecedores cadastrados temos em cada estado (UF)?"
            )
        )
    }
}
