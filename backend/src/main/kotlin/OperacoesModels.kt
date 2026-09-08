package org.example

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
import java.time.LocalDateTime

/**
 * Tabela unificada para todos os itens em estoque, sejam insumos ou produtos acabados.
 * RF08, RF09, RF10: Centraliza o controle de estoque.
 */
object ItensEstoqueTable : Table("itens_estoque") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 255)
    val tipo = varchar("tipo", 50) // INSUMO, PRODUTO_ACABADO
    val unidadeMedida = varchar("unidade_medida", 20) // ml, g, unidade
    val quantidade = double("quantidade").default(0.0)
    val custoUnitario = double("custo_unitario").default(0.0)
    val estoqueMinimo = double("estoque_minimo").default(0.0)
    override val primaryKey = PrimaryKey(id)
}

/**
 * Tabela para registrar todas as movimentações de entrada e saída do estoque.
 * Garante rastreabilidade total.
 */
object MovimentacoesEstoqueTable : Table("movimentacoes_estoque") {
    val id = integer("id").autoIncrement()
    val itemId = integer("item_id").references(ItensEstoqueTable.id)
    val tipo = varchar("tipo", 50) // ENTRADA_COMPRA, SAIDA_PRODUCAO, ENTRADA_PRODUCAO, AJUSTE_MANUAL
    val quantidade = double("quantidade")
    val dataMovimentacao = datetime("data_movimentacao").clientDefault { LocalDateTime.now() }
    val custoUnitarioNaMovimentacao = double("custo_unitario_na_movimentacao")
    val observacao = text("observacao").nullable()
    override val primaryKey = PrimaryKey(id)
}

/**
 * Tabela para controlar as ordens de produção.
 * RF11: Orquestra a conversão de insumos em produtos acabados.
 */
object OrdensProducaoTable : Table("ordens_producao") {
    val id = integer("id").autoIncrement()
    val produtoAcabadoId = integer("produto_acabado_id").references(ItensEstoqueTable.id)
    val quantidadeProduzida = double("quantidade_produzida")
    val dataOrdem = datetime("data_ordem").clientDefault { LocalDateTime.now() }
    val status = varchar("status", 50).default("PENDENTE") // PENDENTE, CONCLUIDA, CANCELADA
    val custoTotalCalculado = double("custo_total_calculado").nullable()
    override val primaryKey = PrimaryKey(id)
}
