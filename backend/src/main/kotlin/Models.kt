package org.example

import java.time.LocalDateTime

//Unidades de Medida
data class UnidadeMedida(
    val id: Int,
    var nome: String,
    var sigla: String
)

// Fornecedores
data class Fornecedor(
    val id: Int = 0,
    var nome: String = "",
    var nomeFantasia: String? = null,
    var cnpjCpf: String? = null,
    var mnemonico: String? = null,
    var enderecoCompleto: String? = null,
    var cep: String? = null,
    var uf: String? = null,
    var email: String? = null,
    var telefones: String? = null,
    var banco: String? = null,
    var agencia: String? = null,
    var contaCorrente: String? = null,
    var chavePix: String? = null,
    var categoria: String? = null,
    var prazoPagamentoPadrao: String? = null,
    var historicoAtendimento: String? = null,
    var nomeEmpresa: String? = null
)

// Clientes
data class Cliente(
    val id: Int,
    var nome: String,
    var telefone: String?,
    var email: String?,
    var endereco: String?
)

// DTO usado para gerar JSON de pedido de compra com informações completas do fornecedor
data class FornecedorPedidoDTO(
    val id: Int,
    val nome: String?,
    val nomeFantasia: String?,
    val cnpjCpf: String?,
    val mnemonico: String?,
    val enderecoCompleto: String?,
    val cep: String?,
    val uf: String?,
    val email: String?,
    val telefones: String?,
    val banco: String?,
    val agencia: String?,
    val contaCorrente: String?,
    val chavePix: String?,
    val categoria: String?,
    val prazoPagamentoPadrao: String?,
    val historicoAtendimento: String?,
    val nomeEmpresa: String?
)

data class PedidoCompraComFornecedorDTO(
    val id: Int,
    val orcamentoId: Int,
    val fornecedor: FornecedorPedidoDTO?,
    val dataConfirmacao: LocalDateTime,
    val valorTotalItens: Double,
    val valorFrete: Double,
    val valorFinalConfirmado: Double,
    val formaPagamento: FormaPagamento,
    val itens: List<PedidoCompraItemDTO> = emptyList()
)

data class PedidoCompraView(
    val id: Int,
    val orcamentoId: Int?,
    val orcamentoTitulo: String?,
    val fornecedorId: Int?,
    val fornecedorNome: String,
    val dataConfirmacao: LocalDateTime,
    val valorTotalItens: Double,
    val valorFrete: Double,
    val valorFinalConfirmado: Double,
    val formaPagamento: FormaPagamento
)

// Tipos de Insumo
data class TipoInsumo(
    val id: Int = 0,
    var nome: String,
    var descricao: String? = null,
    var isEmbalagem: Boolean = false,
    var insumosVinculadosCount: Long = 0
)

// Insumos
data class Insumo(
    val id: Int,
    var nome: String,
    var unidadeMedidaId: Int,
    var quantidadePorEmbalagem: Double?,
    var unidadeEmbalagemId: Int?,
    var fornecedorId: Int?, // Agora é opcional (nullable), atualizado na última compra
    var preco: Double, // Preço da última compra
    var isEmbalagem: Boolean = false,
    var estoque: Double? = 0.0,
    var estoqueMinimo: Double? = 0.0,
    var dataValidade: String? = null,
    var lote: String? = null,
    var codigoBarras: String? = null,
    var tipoInsumoId: Int? = null,
    var tipoInsumoNome: String? = null
)

// Unidade de Compra / Fator de Conversão de Embalagem
data class UnidadeCompraInsumo(
    val id: Int,
    val insumoId: Int,
    val nomeEmbalagem: String,
    val fatorConversao: Double,
    val precoEmbalagem: Double? = null,
    val codigoBarras: String? = null,
    val criadoEm: LocalDateTime = LocalDateTime.now()
)

// Tipos de Movimentação de Estoque para Auditoria / Ledger
enum class TipoMovimentoEstoque(val valor: String) {
    ENTRADA_COMPRA("ENTRADA_COMPRA"),
    SAIDA_PRODUCAO("SAIDA_PRODUCAO"),
    SAIDA_VENDA("SAIDA_VENDA"),
    SAIDA_VENDA_KIT("SAIDA_VENDA_KIT"),
    AJUSTE_INVENTARIO("AJUSTE_INVENTARIO"),
    PERDA("PERDA"),
    ESTORNO("ESTORNO")
}

// Registro no Ledger / Auditoria de Movimentação
data class MovimentoEstoqueInsumo(
    val id: Int,
    val insumoId: Int,
    val tipo: String,
    val quantidade: Double,
    val saldoAnterior: Double,
    val saldoPosterior: Double,
    val origemReferencia: String? = null,
    val referenciaId: Int? = null,
    val motivo: String? = null,
    val dataValidade: String? = null,
    val lote: String? = null,
    val criadoEm: LocalDateTime = LocalDateTime.now(),
    val criadoPor: Int? = null,
    val insumoNome: String? = null,
    val unidadeSigla: String? = null
)

// Produto Base
data class ProdutoFinal(
    val id: Int,
    var nome: String, // Ex: Sabonete Líquido de Lavanda
    var descricao: String,
    var rendimentoReceitaBase: Double = 1.0, // Ex: 1.0 (para 1 Litro da receita base)
    var rotulo: String? = null // Rótulo do produto com ingredientes e modo de usar
)

// Insumo vinculado a Produto Base (Ficha Técnica Master)
data class ReceitaInsumo(
    val id: Int,
    val produtoId: Int, 
    val insumoId: Int,
    val quantidadeUsada: Double,
    val insumoNome: String? = null
)

// Material ou Componente vinculado à Variação (Frasco, Pérolas, Fita, Tampa, etc.)
data class VariacaoMaterial(
    val id: Int = 0,
    val variacaoId: Int = 0,
    val insumoId: Int,
    val quantidade: Double = 1.0,
    val insumoNome: String? = null,
    val unidadeSigla: String? = null,
    val custoUnitario: Double = 0.0
)

// Variações de Tamanho de um Produto Final
data class ProdutoVariacao(
    val id: Int = 0,
    val produtoId: Int = 0,
    var nomeTamanho: String = "", // Ex: "200ml" ou "Sabonete 500g"
    var tamanhoMedida: Double = 0.0, // Ex: 200 (para 200ml)
    var unidadeMedidaTamanhoId: Int = 1, // ID da Unidade de Medida do Tamanho (ml, g, unidade)
    var embalagemInsumoId: Int? = null, // Qual frasco/embalagem usar (Puxa o custo unitário do insumo)
    var tempoProducaoMinutos: Double = 0.0,
    var margemLucro: Double = 300.0,
    var precoVenda: Double = 0.0,
    var custoUnitarioCalculado: Double = 0.0,
    var estoque: Double = 0.0,
    var codigoBarras: String? = null,
    var materiais: List<VariacaoMaterial> = emptyList()
)

// --- MÃO DE OBRA E CUSTOS FIXOS DINÂMICOS ---

data class Funcionario(
    val id: Int,
    var nome: String,
    var salarioBruto: Double
)

data class DespesaFixa(
    val id: Int,
    var descricao: String,
    var valorMensal: Double
)

data class ConfiguracaoGlobal(
    val id: Int,
    var horasTrabalhadasPorSemana: Double,
    var totalSalarios: Double = 0.0,
    var totalDespesasFixas: Double = 0.0,
    var custoMinutoTrabalho: Double = 0.0
)

// --- ORÇAMENTOS E COMPRAS (NOVO FLUXO) ---

enum class StatusOrcamento {
    EM_DIGITACAO, EM_ORCAMENTO, ORCAMENTO_APROVADO, AGUARDANDO_ENTREGA, COMPRA_APROVADA, PEDIDO_PARCIAL, CONCLUIDO, CONVERTIDO, ABERTO, RECEBIDO
}

enum class StatusCompra {
    PENDENTE, RECEBIDO
}

enum class FormaPagamento {
    PIX, CARTAO, DEBITO, DEPOSITO
}

data class LogAuditoria(
    val id: Int,
    val usuarioId: Int,
    val dataHora: LocalDateTime,
    val operacao: String,
    val tabela: String,
    val registroId: Int,
    val dadosAntigos: String?,
    val dadosNovos: String?
)

data class OrcamentoCompra(
    val id: Int,
    var titulo: String,
    var dataCriacao: LocalDateTime? = null,
    var status: StatusOrcamento,
    var observacoes: String? = null,
    var ativo: Boolean = true,
    var frete: Double = 0.0,
    var desconto: Double = 0.0
)

data class ItemOrcamento(
    val id: Int,
    val orcamentoId: Int,
    val insumoId: Int,
    var quantidade: Double,
    var ativo: Boolean = true,
    var quantidadeRecebida: Double? = null,
    var precoUnitarioRecebido: Double? = null,
    var valorFinalItem: Double? = null
)

data class CotacaoFornecedor(
    val id: Int,
    val itemOrcamentoId: Int,
    val fornecedorId: Int,
    var precoUnitario: Double
)

data class PedidoCompra(
    val id: Int,
    val orcamentoId: Int,
    val fornecedorId: Int,
    var dataConfirmacao: LocalDateTime,
    var valorTotalItens: Double,
    var valorFrete: Double,
    var valorFinalConfirmado: Double,
    var formaPagamento: FormaPagamento
)

data class PedidoCompraItemDTO(
    val id: Int,
    val itemOrcamentoId: Int,
    val insumoId: Int,
    val insumoNome: String?,
    val quantidade: Double,
    val precoUnitario: Double,
    val total: Double
)

data class Compra(
    val id: Int,
    val orcamentoId: Int?,
    val fornecedorId: Int?,
    val justificativa: String?,
    val dataPrevistaNecessidade: LocalDateTime?,
    val dataCriacao: LocalDateTime,
    val status: StatusCompra,
    val valorTotal: Double
)

data class ItemCompra(
    val id: Int,
    val compraId: Int,
    val itemOrcamentoId: Int?,
    val insumoId: Int,
    val quantidadeSolicitada: Double,
    val quantidadeComprada: Double,
    val quantidadeRecebida: Double,
    val precoUnitario: Double,
    val fornecedorSugeridoId: Int?,
    var ativo: Boolean = true
)

data class ItemCompraComInsumoDTO(
    val id: Int,
    val compraId: Int,
    val itemOrcamentoId: Int?,
    val insumoId: Int,
    val insumoNome: String,
    val unidadeSigla: String?,
    val quantidadeSolicitada: Double,
    val quantidadeComprada: Double,
    val quantidadeRecebida: Double,
    val precoUnitario: Double,
    val fornecedorSugeridoId: Int?,
    val ativo: Boolean
)

data class ReceberItemCompraRequest(
    val id: Int,
    val quantidadeRecebida: Double
)

data class ReceberCompraRequest(
    val valorFreteFinal: Double = 0.0,
    val itens: List<ReceberItemCompraRequest> = emptyList()
)

data class CriarCompraManualItemRequest(
    val insumoId: Int,
    val quantidade: Double,
    val precoUnitario: Double
)

data class CriarCompraManualRequest(
    val fornecedorId: Int? = null,
    val justificativa: String? = null,
    val valorFrete: Double = 0.0,
    val dataPrevistaNecessidade: String? = null,
    val receberImediatamente: Boolean = true,
    val itens: List<CriarCompraManualItemRequest> = emptyList()
)

// --- DTOs para Relatórios e Impressão ---

data class ItemOrcamentoRelatorio(
    val id: Int,
    val insumoId: Int,
    val insumoNome: String,
    val unidadeSigla: String?,
    val quantidade: Double,
    val ativo: Boolean,
    val quantidadeRecebida: Double?,
    val precoUnitarioRecebido: Double?,
    val valorFinalItem: Double?,
    val cotacoes: List<CotacaoFornecedorRelatorio> = emptyList()
)

data class CotacaoFornecedorRelatorio(
    val id: Int,
    val fornecedorId: Int,
    val fornecedorNome: String,
    val precoUnitario: Double,
    val total: Double
)

data class OrcamentoRelatorio(
    val id: Int,
    val titulo: String,
    val dataCriacao: String,
    val status: String,
    val observacoes: String?,
    val frete: Double,
    val desconto: Double,
    val valorTotalItens: Double,
    val valorTotalCotacoes: Double,
    val valorFinal: Double,
    val itens: List<ItemOrcamentoRelatorio>
)

data class PedidoCompraRelatorio(
    val id: Int,
    val orcamentoId: Int,
    val orcamentoTitulo: String,
    val fornecedorId: Int,
    val fornecedorNome: String,
    val fornecedorDados: FornecedorPedidoDTO?,
    val dataConfirmacao: String,
    val valorTotalItens: Double,
    val valorFrete: Double,
    val valorFinalConfirmado: Double,
    val formaPagamento: String,
    val itens: List<PedidoCompraItemDTO>
)

data class CompraRelatorio(
    val id: Int,
    val orcamentoId: Int?,
    val fornecedorId: Int?,
    val fornecedorNome: String?,
    val justificativa: String?,
    val dataPrevistaNecessidade: String?,
    val dataCriacao: String,
    val status: String,
    val valorTotal: Double,
    val itens: List<ItemCompraComInsumoDTO>
)

// --- Pedidos Operacionais (Nova página) ---
data class Pedido(
    val id: Int = 0,
    var clienteId: Int? = null,
    var clienteNome: String? = null,
    var valor: Double? = null,
    var valorFrete: Double? = 0.0,
    var tipoEnvio: String? = "RETIRADA",
    var cepDestino: String? = null,
    var prazoEnvio: String? = null,
    var comprimentoCm: Double? = 20.0,
    var larguraCm: Double? = 15.0,
    var alturaCm: Double? = 10.0,
    var pesoKg: Double? = 0.5,
    var valorCustoTotal: Double? = 0.0,
    var lucroBruto: Double? = 0.0,
    var formaPagamento: String = "",
    var dataPagamento: String? = null,
    var entregue: Boolean = false,
    var itens: List<PedidoItem> = emptyList()
)

data class PedidoItem(
    val id: Int = 0,
    val pedidoId: Int = 0,
    var nome: String = "",
    var qtd: Int = 0,
    var preco: Double = 0.0,
    var variacaoId: Int? = null,
    var kitId: Int? = null,
    var tipo: String? = null, // "PRODUTO", "KIT", "OUTRO"
    var custoUnitario: Double? = 0.0
)
