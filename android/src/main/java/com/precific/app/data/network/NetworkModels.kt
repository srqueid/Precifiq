package com.precific.app.data.network

import com.google.gson.annotations.SerializedName

// ============================================================================
// 1. Modelos de Autenticação & Multi-Tenancy
// ============================================================================

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("senha") val senha: String
)

data class UsuarioVinculoEmpresaDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("empresaId") val empresaId: Int,
    @SerializedName("empresaNome") val empresaNome: String,
    @SerializedName("empresaTipo") val empresaTipo: String,
    @SerializedName("schemaName") val schemaName: String,
    @SerializedName("perfilId") val perfilId: Int,
    @SerializedName("perfilCodigo") val perfilCodigo: String,
    @SerializedName("perfilNome") val perfilNome: String
)

data class UsuarioDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("nome") val nome: String,
    @SerializedName("email") val email: String,
    @SerializedName("isSuperuser") val isSuperuser: Boolean,
    @SerializedName("ativo") val ativo: Boolean,
    @SerializedName("empresas") val empresas: List<UsuarioVinculoEmpresaDTO>? = null
)

data class EmpresaDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("tipo") val tipo: String, // "MATRIZ" ou "FILIAL"
    @SerializedName("matrizId") val matrizId: Int? = null,
    @SerializedName("nomeFantasia") val nomeFantasia: String,
    @SerializedName("razaoSocial") val razaoSocial: String? = null,
    @SerializedName("cnpj") val cnpj: String? = null,
    @SerializedName("schemaName") val schemaName: String,
    @SerializedName("ativo") val ativo: Boolean
)

data class EmpresaHierarquiaDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("tipo") val tipo: String,
    @SerializedName("nomeFantasia") val nomeFantasia: String,
    @SerializedName("razaoSocial") val razaoSocial: String? = null,
    @SerializedName("cnpj") val cnpj: String? = null,
    @SerializedName("schemaName") val schemaName: String,
    @SerializedName("ativo") val ativo: Boolean,
    @SerializedName("filiais") val filiais: List<EmpresaDTO>? = null
)

data class LoginResponse(
    @SerializedName("token") val token: String,
    @SerializedName("usuario") val usuario: UsuarioDTO,
    @SerializedName("empresasHierarquia") val empresasHierarquia: List<EmpresaHierarquiaDTO>? = null
)

// ============================================================================
// 2. Modelos de Dashboard e KPIs
// ============================================================================

data class TopProdutoDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("nome") val nome: String,
    @SerializedName("quantidadeVendida") val quantidadeVendida: Double,
    @SerializedName("valorTotal") val valorTotal: Double,
    @SerializedName("lucroBruto") val lucroBruto: Double
)

data class DashboardInsumoCriticoDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("nome") val nome: String,
    @SerializedName("lote") val lote: String? = null,
    @SerializedName("dataValidade") val dataValidade: String? = null,
    @SerializedName("diasRestantes") val diasRestantes: Long? = null,
    @SerializedName("status") val status: String? = null, // "VENCIDO" ou "A_VENCER"
    @SerializedName("estoque") val estoque: Double = 0.0,
    @SerializedName("unidade") val unidade: String? = null
)

data class DashboardResponse(
    @SerializedName("totalProdutos") val totalProdutos: Long = 0,
    @SerializedName("totalInsumos") val totalInsumos: Long = 0,
    @SerializedName("totalOrcamentos") val totalOrcamentos: Long = 0,
    @SerializedName("orcamentosAprovados") val orcamentosAprovados: Long = 0,
    @SerializedName("orcamentosPendentes") val orcamentosPendentes: Long = 0,
    @SerializedName("faturamentoAprovado") val faturamentoAprovado: Double = 0.0,
    @SerializedName("totalEstoqueEstimado") val totalEstoqueEstimado: Double = 0.0,
    @SerializedName("vendasTotalMes") val vendasTotalMes: Double = 0.0,
    @SerializedName("vendasCustoMes") val vendasCustoMes: Double = 0.0,
    @SerializedName("lucroBrutoMes") val lucroBrutoMes: Double = 0.0,
    @SerializedName("margemLucroRealizada") val margemLucroRealizada: Double = 0.0,
    @SerializedName("giroEstoque") val giroEstoque: Double = 0.0,
    @SerializedName("diasGiroEstoque") val diasGiroEstoque: Double = 0.0,
    @SerializedName("topProdutosVendidos") val topProdutosVendidos: List<TopProdutoDTO> = emptyList(),
    @SerializedName("insumosValidadeCritica") val insumosValidadeCritica: List<DashboardInsumoCriticoDTO> = emptyList()
)

// ============================================================================
// 3. Modelos de Insumo & Estoque
// ============================================================================

data class InsumoDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("nome") val nome: String,
    @SerializedName("categoria") val categoria: String? = null,
    @SerializedName("estoque") val estoque: Double = 0.0,
    @SerializedName("estoqueMinimo") val estoqueMinimo: Double = 0.0,
    @SerializedName("preco") val preco: Double = 0.0,
    @SerializedName("unidadeMedida") val unidadeMedida: String? = null,
    @SerializedName("dataValidade") val dataValidade: String? = null,
    @SerializedName("lote") val lote: String? = null,
    @SerializedName("codigoBarras") val codigoBarras: String? = null
)

// ============================================================================
// 4. Modelos de Fornecedor
// ============================================================================

data class FornecedorDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("nome") val nome: String,
    @SerializedName("nomeFantasia") val nomeFantasia: String? = null,
    @SerializedName("cnpjCpf") val cnpjCpf: String? = null,
    @SerializedName("email") val email: String? = null,
    @SerializedName("telefones") val telefones: String? = null,
    @SerializedName("cidade") val cidade: String? = null,
    @SerializedName("uf") val uf: String? = null
)

// ============================================================================
// 5. Modelos de Orçamento
// ============================================================================

data class ItemOrcamentoDTO(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("insumoId") val insumoId: Int? = null,
    @SerializedName("produtoId") val produtoId: Int? = null,
    @SerializedName("nome") val nome: String = "",
    @SerializedName("quantidade") val quantidade: Double = 1.0,
    @SerializedName("unidade") val unidade: String = "unid",
    @SerializedName("precoUnitario") val precoUnitario: Double = 0.0,
    @SerializedName("subtotal") val subtotal: Double = 0.0
)

data class OrcamentoDTO(
    @SerializedName("id") val id: Int,
    @SerializedName("titulo") val titulo: String,
    @SerializedName("clienteNome") val clienteNome: String? = null,
    @SerializedName("status") val status: String, // "APROVADO", "PENDENTE", "REJEITADO", "RASCUNHO"
    @SerializedName("total") val total: Double = 0.0,
    @SerializedName("dataCriacao") val dataCriacao: String? = null,
    @SerializedName("itens") val itens: List<ItemOrcamentoDTO>? = null
)

data class CriarOrcamentoRequest(
    @SerializedName("titulo") val titulo: String,
    @SerializedName("clienteNome") val clienteNome: String? = null,
    @SerializedName("margemLucro") val margemLucro: Double = 0.0,
    @SerializedName("itens") val itens: List<ItemOrcamentoDTO> = emptyList()
)

// ============================================================================
// 6. Consulta de Código de Barras Unificada (Câmera / Scanner Android)
// ============================================================================

data class CodigoBarrasResultadoDTO(
    @SerializedName("tipo") val tipo: String, // "PRODUTO_VARIACAO", "KIT", "INSUMO"
    @SerializedName("id") val id: Int,
    @SerializedName("nome") val nome: String,
    @SerializedName("codigoBarras") val codigoBarras: String,
    @SerializedName("preco") val preco: Double = 0.0,
    @SerializedName("estoque") val estoque: Double? = null,
    @SerializedName("unidade") val unidade: String? = null,
    @SerializedName("detalhes") val detalhes: String? = null
)

// ============================================================================
// 7. Modelos de Pedidos Operacionais
// ============================================================================

data class PedidoItemDTO(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("pedidoId") val pedidoId: Int = 0,
    @SerializedName("nome") val nome: String = "",
    @SerializedName("qtd") val qtd: Int = 1,
    @SerializedName("preco") val preco: Double = 0.0,
    @SerializedName("tipo") val tipo: String? = "PRODUTO",
    @SerializedName("custoUnitario") val custoUnitario: Double? = 0.0
)

data class PedidoDTO(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("clienteId") val clienteId: Int? = null,
    @SerializedName("clienteNome") val clienteNome: String? = null,
    @SerializedName("valor") val valor: Double? = 0.0,
    @SerializedName("valorFrete") val valorFrete: Double? = 0.0,
    @SerializedName("tipoEnvio") val tipoEnvio: String? = "RETIRADA",
    @SerializedName("prazoEnvio") val prazoEnvio: String? = null,
    @SerializedName("valorCustoTotal") val valorCustoTotal: Double? = 0.0,
    @SerializedName("lucroBruto") val lucroBruto: Double? = 0.0,
    @SerializedName("formaPagamento") val formaPagamento: String = "PIX",
    @SerializedName("dataPagamento") val dataPagamento: String? = null,
    @SerializedName("entregue") val entregue: Boolean = false,
    @SerializedName("itens") val itens: List<PedidoItemDTO> = emptyList()
)
