package org.example

// --- DTOs para Extração e Conciliação de NF-e (IA / Document AI / Gemini) ---

data class NfeFornecedorExtraido(
    val cnpj: String? = null,
    val razaoSocial: String? = null,
    val nomeFantasia: String? = null,
    val endereco: String? = null,
    val uf: String? = null,
    val telefone: String? = null,
    val email: String? = null
)

data class NfeItemExtraido(
    val numeroItem: Int,
    val codigoProdutoFornecedor: String? = null,
    val descricao: String,
    val ncm: String? = null,
    val cfop: String? = null,
    val unidadeComercial: String = "UN",
    val quantidade: Double,
    val valorUnitario: Double,
    val valorTotal: Double
)

data class NfeDadosExtraidos(
    val chaveAcesso: String? = null,
    val numeroNota: String? = null,
    val serie: String? = null,
    val dataEmissao: String? = null,
    val valorTotalProdutos: Double = 0.0,
    val valorFrete: Double = 0.0,
    val valorDesconto: Double = 0.0,
    val valorTotalNota: Double = 0.0,
    val fornecedor: NfeFornecedorExtraido? = null,
    val itens: List<NfeItemExtraido> = emptyList()
)

data class ItemConciliacaoSugestao(
    val itemNfe: NfeItemExtraido,
    val insumoIdSugerido: Int? = null,
    val insumoNomeSugerido: String? = null,
    val unidadeSiglaSugerida: String? = null,
    val scoreConfianca: Double = 0.0, // 0.0 a 1.0 (ex: 0.95 = 95%)
    val justificativa: String? = null,
    val novoInsumoSugerido: Boolean = false
)

data class InsumoResumoDTO(
    val id: Int,
    val nome: String,
    val unidadeMedidaId: Int,
    val unidadeSigla: String,
    val precoAtual: Double,
    val estoqueAtual: Double,
    val isEmbalagem: Boolean
)

data class NfeAnaliseCompletaResponse(
    val dadosNota: NfeDadosExtraidos,
    val fornecedorExistenteId: Int? = null,
    val fornecedorExistenteNome: String? = null,
    val itensConciliados: List<ItemConciliacaoSugestao> = emptyList(),
    val insumosDisponiveis: List<InsumoResumoDTO> = emptyList(),
    val unidadesDisponiveis: List<UnidadeMedida> = emptyList()
)

data class ItemConfirmacaoEntrada(
    val numeroItem: Int,
    val insumoId: Int? = null,
    val criarNovoInsumo: Boolean = false,
    val novoInsumoNome: String? = null,
    val novoInsumoUnidadeId: Int? = null,
    val novoInsumoIsEmbalagem: Boolean = false,
    val quantidade: Double,
    val precoUnitario: Double,
    val valorTotal: Double
)

data class ConfirmarEntradaNfeRequest(
    val numeroNota: String? = null,
    val chaveAcesso: String? = null,
    val fornecedorCnpj: String? = null,
    val fornecedorNome: String? = null,
    val fornecedorId: Int? = null,
    val valorFrete: Double = 0.0,
    val valorDesconto: Double = 0.0,
    val valorTotalNota: Double = 0.0,
    val dataEmissao: String? = null,
    val itens: List<ItemConfirmacaoEntrada> = emptyList()
)

data class ConfirmarEntradaNfeResponse(
    val success: Boolean,
    val compraId: Int,
    val itensProcessados: Int,
    val novosInsumosCriados: Int,
    val mensagem: String
)
