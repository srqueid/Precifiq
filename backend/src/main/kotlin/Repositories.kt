package org.example

import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.javatime.timestamp
import org.jetbrains.exposed.sql.javatime.CurrentTimestamp
import org.jetbrains.exposed.sql.javatime.datetime
import org.jetbrains.exposed.sql.javatime.date
import java.time.LocalDateTime
import java.time.LocalDate

// --- Unidades de Medida ---
object UnidadesMedidaTable : Table("unidade_medida") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 100).uniqueIndex()
    val sigla = varchar("sigla", 20).uniqueIndex()
    override val primaryKey = PrimaryKey(id)
}

// --- Fornecedores ---
object FornecedoresTable : Table("fornecedor") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 255)
    val nomeFantasia = varchar("nome_fantasia", 255).nullable()
    val cnpjCpf = varchar("cnpj_cpf", 20).uniqueIndex().nullable()
    val mnemonico = varchar("mnemonico", 50).nullable()
    val enderecoCompleto = varchar("endereco_completo", 255).nullable()
    val cep = varchar("cep", 10).nullable()
    val uf = varchar("uf", 2).nullable()
    val email = varchar("email", 100).nullable()
    val telefones = varchar("telefones", 100).nullable()
    val banco = varchar("banco", 100).nullable()
    val agencia = varchar("agencia", 20).nullable()
    val contaCorrente = varchar("conta_corrente", 30).nullable()
    val chavePix = varchar("chave_pix", 100).nullable()
    val categoria = varchar("categoria", 50).nullable()
    val prazoPagamentoPadrao = varchar("prazo_pagamento_padrao", 50).nullable()
    val historicoAtendimento = text("historico_atendimento").nullable()
    val nomeEmpresa = varchar("nome_empresa", 200).nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Clientes ---
object ClientesTable : Table("cliente") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 255)
    val telefone = varchar("telefone", 20).nullable()
    val email = varchar("email", 100).nullable()
    val endereco = varchar("endereco", 255).nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Tipos de Insumo ---
object TiposInsumoTable : Table("tipo_insumo") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 100)
    val descricao = varchar("descricao", 255).nullable()
    val isEmbalagem = bool("is_embalagem").default(false)
    override val primaryKey = PrimaryKey(id)
}

// --- Insumos ---
object InsumosTable : Table("insumo") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 255)
    val unidadeMedidaId = integer("unidade_medida_id").references(UnidadesMedidaTable.id)
    val quantidadePorEmbalagem = double("quantidade_por_embalagem").nullable()
    val unidadeEmbalagemId = integer("unidade_embalagem_id").references(UnidadesMedidaTable.id).nullable()
    val fornecedorId = integer("fornecedor_id").references(FornecedoresTable.id).nullable()
    val preco = double("preco")
    val isEmbalagem = bool("is_embalagem").default(false)
    val estoque = double("estoque").nullable()
    val dataValidade = date("data_validade").nullable()
    val lote = varchar("lote", 50).nullable()
    val codigoBarras = varchar("codigo_barras", 50).nullable()
    val tipoInsumoId = integer("tipo_insumo_id").references(TiposInsumoTable.id).nullable()
    override val primaryKey = PrimaryKey(id)
}

object EstoqueMinimoInsumoAuxTable : Table("estoque_minimo_insumo_aux") {
    val insumoId = integer("insumo_id")
    val estoqueMinimo = double("estoque_minimo").default(0.0)
    override val primaryKey = PrimaryKey(insumoId)
}

object EstoqueVariacaoAuxTable : Table("estoque_variacao_aux") {
    val variacaoId = integer("variacao_id")
    val estoque = double("estoque").default(0.0)
    override val primaryKey = PrimaryKey(variacaoId)
}

// --- Unidades de Compra / Fatores de Conversão de Embalagem ---
object UnidadesCompraInsumoTable : Table("unidade_compra_insumo") {
    val id = integer("id").autoIncrement()
    val insumoId = integer("insumo_id").references(InsumosTable.id)
    val nomeEmbalagem = varchar("nome_embalagem", 100)
    val fatorConversao = double("fator_conversao")
    val precoEmbalagem = double("preco_embalagem").nullable()
    val codigoBarras = varchar("codigo_barras", 50).nullable()
    val criadoEm = datetime("criado_em").clientDefault { LocalDateTime.now() }
    override val primaryKey = PrimaryKey(id)
}

// --- Movimentos de Estoque (Ledger / Auditoria) ---
object MovimentosEstoqueInsumoTable : Table("movimento_estoque_insumo") {
    val id = integer("id").autoIncrement()
    val insumoId = integer("insumo_id").references(InsumosTable.id)
    val tipo = varchar("tipo", 30) // ENTRADA_COMPRA, SAIDA_PRODUCAO, SAIDA_VENDA, SAIDA_VENDA_KIT, AJUSTE_INVENTARIO, PERDA, ESTORNO
    val quantidade = double("quantidade")
    val saldoAnterior = double("saldo_anterior")
    val saldoPosterior = double("saldo_posterior")
    val origemReferencia = varchar("origem_referencia", 50).nullable()
    val referenciaId = integer("referencia_id").nullable()
    val motivo = text("motivo").nullable()
    val dataValidade = date("data_validade").nullable()
    val lote = varchar("lote", 50).nullable()
    val criadoEm = datetime("criado_em").clientDefault { LocalDateTime.now() }
    val criadoPor = integer("criado_por").references(FuncionariosTable.id).nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Produtos Finais ---
object ProdutosFinaisTable : Table("produto_final") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 200)
    val descricao = text("descricao")
    val rendimentoReceitaBase = double("rendimento_receita_base").default(1.0)
    val rotulo = text("rotulo").nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Produto Variacoes ---
object ProdutoVariacoesTable : Table("produto_variacao") {
    val id = integer("id").autoIncrement()
    val produtoId = integer("produto_id").references(ProdutosFinaisTable.id)
    val nomeTamanho = varchar("nome_tamanho", 100)
    val tamanhoMedida = double("tamanho_medida").default(0.0)
    val unidadeMedidaTamanhoId = integer("unidade_medida_tamanho_id").references(UnidadesMedidaTable.id).nullable()
    val embalagemInsumoId = integer("embalagem_insumo_id").references(InsumosTable.id).nullable()
    val tempoProducaoMinutos = double("tempo_producao_minutos").default(0.0)
    val margemLucro = double("margem_lucro").default(0.0)
    val precoVenda = double("preco_venda").default(0.0)
    val custoUnitarioCalculado = double("custo_unitario_calculado").default(0.0)
    val estoque = double("estoque").default(0.0)
    val codigoBarras = varchar("codigo_barras", 50).nullable()
    val multiplicadorReceita = double("multiplicador_receita").default(1.0)
    val tempoProducaoSegundos = double("tempo_producao_segundos").default(0.0)
    val custoFixoRateado = double("custo_fixo_rateado").default(0.0)
    val pesoG = double("peso_g").nullable()
    val precoVendaManual = double("preco_venda_manual").nullable()
    val descricaoVisual = text("descricao_visual").nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Movimentos de Estoque de Produtos Acabados ---
object MovimentosEstoqueVariacaoTable : Table("movimentacoes_estoque") {
    val id = integer("id").autoIncrement()
    val variacaoId = integer("variacao_id").references(ProdutoVariacoesTable.id)
    val tipo = varchar("tipo", 30) // SAIDA_VENDA, SAIDA_VENDA_KIT, ENTRADA_PRODUCAO, AJUSTE_MANUAL
    val quantidade = double("quantidade")
    val motivo = varchar("motivo", 255).nullable()
    val origem = varchar("origem", 100).nullable()
    val dataMovimentacao = datetime("data_movimentacao").clientDefault { LocalDateTime.now() }
    override val primaryKey = PrimaryKey(id)
}

// --- Materiais da Variacao (Frascos, fitas, perolas, tampas, etc.) ---
object VariacaoMateriaisTable : Table("variacao_material") {
    val id = integer("id").autoIncrement()
    val variacaoId = integer("variacao_id").references(ProdutoVariacoesTable.id)
    val insumoId = integer("insumo_id").references(InsumosTable.id)
    val quantidade = double("quantidade").default(1.0)
    override val primaryKey = PrimaryKey(id)
}

// --- Receita Insumos ---
object ReceitaInsumosTable : Table("receita_insumo") {
    val id = integer("id").autoIncrement()
    val produtoId = integer("produto_id").references(ProdutosFinaisTable.id)
    val insumoId = integer("insumo_id").references(InsumosTable.id)
    val quantidadeUsada = double("quantidade_usada")
    override val primaryKey = PrimaryKey(id)
}

// --- Funcionarios ---
object FuncionariosTable : Table("funcionario") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 200)
    val salarioBruto = double("salario_bruto")
    override val primaryKey = PrimaryKey(id)
}

// --- Despesas Fixas ---
object DespesasFixasTable : Table("despesa_fixa") {
    val id = integer("id").autoIncrement()
    val descricao = varchar("descricao", 200)
    val valorMensal = double("valor_mensal")
    override val primaryKey = PrimaryKey(id)
}

// --- Configuracoes Globais ---
object ConfiguracoesGlobaisTable : Table("configuracao_global") {
    val id = integer("id").default(1)
    val horasTrabalhadasPorSemana = double("horas_trabalhadas_por_semana").default(44.0)
    val totalSalarios = double("total_salarios").default(0.0)
    val totalDespesasFixas = double("total_despesas_fixas").default(0.0)
    val custoMinutoTrabalho = double("custo_minuto_trabalho").default(0.0)
    override val primaryKey = PrimaryKey(id)
}

// --- Auditoria ---
object AuditoriaTable : Table("log_auditoria") {
    val id = integer("id").autoIncrement()
    val usuarioId = integer("usuario_id")
    val dataHora = timestamp("data_hora").defaultExpression(CurrentTimestamp())
    val operacao = varchar("operacao", 50)
    val tabela = varchar("tabela", 100)
    val registroId = integer("registro_id")
    val dadosAntigos = text("dados_antigos").nullable()
    val dadosNovos = text("dados_novos").nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Orcamentos Compra ---
object OrcamentosCompraTable : Table("orcamento_compra") {
    val id = integer("id").autoIncrement()
    val titulo = varchar("titulo", 200)
    val dataCriacao = timestamp("data_criacao").defaultExpression(CurrentTimestamp())
    val status = varchar("status", 50)
    val observacoes = text("observacoes").nullable()
    val ativo = bool("ativo").default(true)
    val frete = double("frete").default(0.0)
    val desconto = double("desconto").default(0.0)
    override val primaryKey = PrimaryKey(id)
}

// --- Itens Orcamento ---
object ItensOrcamentoTable : Table("item_orcamento") {
    val id = integer("id").autoIncrement()
    val orcamentoId = integer("orcamento_id").references(OrcamentosCompraTable.id)
    val insumoId = integer("insumo_id").references(InsumosTable.id)
    val quantidade = double("quantidade").default(1.0)
    val quantidadeSolicitada = double("quantidade_solicitada").default(1.0)
    val ativo = bool("ativo").default(true)
    val quantidadeRecebida = double("quantidade_recebida").nullable()
    val precoUnitarioRecebido = double("preco_unitario_recebido").nullable()
    val valorFinalItem = double("valor_final_item").nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Cotacoes Fornecedor ---
object CotacoesFornecedorTable : Table("cotacao_fornecedor") {
    val id = integer("id").autoIncrement()
    val itemOrcamentoId = integer("item_orcamento_id").references(ItensOrcamentoTable.id)
    val fornecedorId = integer("fornecedor_id").references(FornecedoresTable.id)
    val precoUnitario = double("preco_unitario").default(0.0)
    val precoCotado = double("preco_cotado").default(0.0)
    override val primaryKey = PrimaryKey(id)
}

// --- Pedidos Compra ---
object PedidosCompraTable : Table("pedido_compra") {
    val id = integer("id").autoIncrement()
    val orcamentoId = integer("orcamento_id").references(OrcamentosCompraTable.id)
    val fornecedorId = integer("fornecedor_id").references(FornecedoresTable.id)
    val dataCriacao = timestamp("data_criacao").defaultExpression(CurrentTimestamp())
    val dataConfirmacao = timestamp("data_confirmacao").defaultExpression(CurrentTimestamp())
    val status = varchar("status", 50).default("PENDENTE")
    val valorTotal = double("valor_total").default(0.0)
    val valorTotalItens = double("valor_total_itens").default(0.0)
    val valorFrete = double("valor_frete").default(0.0)
    val valorFinalConfirmado = double("valor_final_confirmado").default(0.0)
    val prazoEntregaAcordado = timestamp("prazo_entrega_acordado").nullable()
    val formaPagamento = varchar("forma_pagamento", 100)
    val observacao = text("observacao").nullable()
    override val primaryKey = PrimaryKey(id)
}

// --- Itens Pedido Compra ---
object PedidoCompraItensTable : Table("pedido_compra_item") {
    val id = integer("id").autoIncrement()
    val pedidoCompraId = integer("pedido_compra_id").references(PedidosCompraTable.id)
    val itemOrcamentoId = integer("item_orcamento_id").references(ItensOrcamentoTable.id)
    val insumoId = integer("insumo_id").references(InsumosTable.id).nullable()
    val quantidade = double("quantidade")
    val precoUnitario = double("preco_unitario")
    val valorTotal = double("valor_total").default(0.0)
    override val primaryKey = PrimaryKey(id)
}

// --- Compras ---
object ComprasTable : Table("compra") {
    val id = integer("id").autoIncrement()
    val orcamentoId = integer("orcamento_id").references(OrcamentosCompraTable.id).nullable()
    val fornecedorId = integer("fornecedor_id").references(FornecedoresTable.id).nullable()
    val justificativa = varchar("justificativa", 500).nullable()
    val dataPrevistaNecessidade = timestamp("data_prevista").nullable()
    val dataCriacao = timestamp("data_criacao").defaultExpression(CurrentTimestamp())
    val status = varchar("status", 50)
    val valorTotal = double("valor_total").default(0.0)
    override val primaryKey = PrimaryKey(id)
}

// --- Itens Compra ---
object ItensCompraTable : Table("item_compra") {
    val id = integer("id").autoIncrement()
    val compraId = integer("compra_id").references(ComprasTable.id)
    val itemOrcamentoId = integer("item_orcamento_id").nullable()
    val insumoId = integer("insumo_id").references(InsumosTable.id)
    val quantidadeSolicitada = double("quantidade_solicitada")
    val quantidadeComprada = double("quantidade_comprada").default(0.0)
    val quantidadeRecebida = double("quantidade_recebida").default(0.0)
    val precoUnitario = double("preco_unitario").default(0.0)
    val fornecedorSugeridoId = integer("fornecedor_sugerido_id").nullable()
    val ativo = bool("ativo").default(true)
    override val primaryKey = PrimaryKey(id)
}

// --- Pedidos Operacionais ---
object PedidosTable : Table("pedido") {
    val id = integer("id").autoIncrement()
    val clienteId = integer("cliente_id").references(ClientesTable.id).nullable()
    val valor = double("valor").nullable()
    val valorTotal = double("valor_total").default(0.0)
    val status = varchar("status", 50).default("PENDENTE")
    val valorCustoTotal = double("valor_custo_total").default(0.0)
    val lucroBruto = double("lucro_bruto").default(0.0)
    val valorFrete = double("valor_frete").default(0.0)
    val tipoEnvio = varchar("tipo_envio", 50).default("RETIRADA")
    val cepDestino = varchar("cep_destino", 10).nullable()
    val prazoEnvio = varchar("prazo_envio", 50).nullable()
    val comprimentoCm = double("comprimento_cm").default(20.0)
    val larguraCm = double("largura_cm").default(15.0)
    val alturaCm = double("altura_cm").default(10.0)
    val pesoKg = double("peso_kg").default(0.5)
    val formaPagamento = varchar("forma_pagamento", 50)
    val dataPagamento = varchar("data_pagamento", 50).nullable()
    val entregue = bool("entregue").default(false)
    override val primaryKey = PrimaryKey(id)
}

object PedidoItensTable : Table("pedido_item") {
    val id = integer("id").autoIncrement()
    val pedidoId = integer("pedido_id").references(PedidosTable.id)
    val variacaoId = integer("variacao_id").nullable()
    val kitId = integer("kit_id").nullable()
    val tipo = varchar("tipo", 20).default("PRODUTO")
    val nomeProduto = varchar("nome_produto", 255)
    val produtoNome = varchar("produto_nome", 255).nullable()
    val quantidade = integer("quantidade")
    val precoUnitario = double("preco_unitario")
    val valorTotal = double("valor_total").default(0.0)
    val custoUnitario = double("custo_unitario").default(0.0)
    override val primaryKey = PrimaryKey(id)
}
