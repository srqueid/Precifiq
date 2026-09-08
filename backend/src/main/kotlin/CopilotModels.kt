package org.example

data class CopilotPerguntaRequest(
    val pergunta: String,
    val contextoPagina: String? = null
)

data class CopilotRespostaResponse(
    val sucesso: Boolean,
    val pergunta: String,
    val respostaMarkdown: String,
    val sqlExecutado: String? = null,
    val colunas: List<String> = emptyList(),
    val linhas: List<Map<String, Any?>> = emptyList(),
    val totalRegistros: Int = 0,
    val tempoExecucaoMs: Long = 0,
    val erro: String? = null
)

data class CopilotSugestaoDTO(
    val id: String,
    val categoria: String, // "Estoque", "Financeiro", "Produtos", "Compras"
    val pergunta: String
)
