package org.example

data class ItemPrevisaoRupturaDTO(
    val insumoId: Int,
    val insumoNome: String,
    val unidadeSigla: String,
    val estoqueAtual: Double,
    val estoqueMinimo: Double,
    val consumoMedioDiario: Double,
    val diasAteRuptura: Int?,
    val dataEstimadaRuptura: String?,
    val nivelRisco: String, // "CRITICO", "ALERTA", "NORMAL"
    val quantidadeSugeridaCompra: Double,
    val fornecedorSugeridoId: Int? = null,
    val fornecedorSugeridoNome: String? = null,
    val justificativaIa: String? = null
)

data class AlertaMargemDTO(
    val variacaoId: Int,
    val produtoId: Int,
    val produtoNome: String,
    val nomeTamanho: String,
    val custoUnitario: Double,
    val precoVenda: Double,
    val margemAtual: Double,
    val margemAlvo: Double = 30.0,
    val precoSugerido: Double,
    val impacto: String, // "PREJUIZO", "MARGEM_BAIXA", "SAUDAVEL"
    val justificativa: String
)

data class PrevisaoDashboardResponse(
    val geradoEm: String,
    val totalItensCriticos: Int,
    val totalItensAlerta: Int,
    val totalProdutosMargemBaixa: Int,
    val resumoExecutivoIa: String,
    val itensRuptura: List<ItemPrevisaoRupturaDTO>,
    val alertasMargem: List<AlertaMargemDTO>
)

data class GerarOrcamentoPrevisaoRequest(
    val insumoIds: List<Int>? = null // se null ou vazio, gera para todos os itens em risco (CRITICO + ALERTA)
)

data class GerarOrcamentoPrevisaoResponse(
    val success: Boolean,
    val orcamentoId: Int?,
    val itensAdicionados: Int,
    val message: String
)
