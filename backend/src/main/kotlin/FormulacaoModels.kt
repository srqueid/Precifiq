package org.example

data class ItemInsumoFaltanteDTO(
    val insumoId: Int,
    val insumoNome: String,
    val quantidadeNecessaria: Double,
    val saldoAtual: Double,
    val deficit: Double,
    val unidadeSigla: String,
    val isEmbalagem: Boolean
)

data class SugerirSubstitutosRequest(
    val produtoId: Int,
    val produtoNome: String? = null,
    val quantidadeProduzir: Double = 1.0,
    val itensFaltantes: List<ItemInsumoFaltanteDTO>? = null
)

data class SubstituicaoSugeridaDTO(
    val insumoFaltanteId: Int,
    val insumoFaltanteNome: String,
    val quantidadeFaltante: Double,
    val insumoSubstitutoId: Int,
    val insumoSubstitutoNome: String,
    val estoqueSubstituto: Double,
    val unidadeSubstituto: String,
    val quantidadeSugerida: Double,
    val fatorEquivalencia: Double,
    val scoreCompatibilidade: Double, // 0.0 a 1.0 (ex: 0.95 = 95%)
    val justificativaTecnica: String,
    val impactoCusto: String
)

data class SugerirSubstitutosResponse(
    val sucesso: Boolean,
    val parecerGeralIa: String,
    val sugestoes: List<SubstituicaoSugeridaDTO>
)

data class SubstituicaoProducaoItem(
    val insumoOriginalId: Int,
    val insumoSubstitutoId: Int,
    val quantidadeSubstituta: Double
)

data class ConversaoProducaoComSubstitutosRequest(
    val produtoId: Int,
    val variacaoId: Int?,
    val quantidade: Double,
    val substituicoes: List<SubstituicaoProducaoItem>
)

data class ConversaoProducaoComSubstitutosResponse(
    val status: String,
    val message: String,
    val produtoNome: String,
    val variacaoNome: String,
    val quantidadeProduzida: Double,
    val novoEstoqueProduto: Double?,
    val insumosDebitados: List<Any?>
)
