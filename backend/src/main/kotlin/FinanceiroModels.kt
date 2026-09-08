package org.example

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
import java.time.LocalDateTime

/**
 * Tabela para registrar os pedidos dos clientes.
 * RF01: Registra um novo pedido.
 */
object PedidosFinanceiroTable : Table("pedidos_financeiro") {
    val id = integer("id").autoIncrement()
    val clienteId = integer("cliente_id").references(ClientesTable.id)
    val dataPedido = datetime("data_pedido").clientDefault { LocalDateTime.now() }
    val valorTotal = double("valor_total")
    val status = varchar("status", 50).default("PENDENTE") // PENDENTE, PAGO, CANCELADO
    override val primaryKey = PrimaryKey(id)
}

/**
 * Tabela de Tesouraria para registrar todas as transações monetárias (entradas e saídas).
 * RF02, RF05, RF06: Garante a imutabilidade e o registro de todas as movimentações.
 */
object TransacoesFinanceirasTable : Table("transacoes_financeiras") {
    val id = integer("id").autoIncrement()
    val pedidoId = integer("pedido_id").references(PedidosFinanceiroTable.id).nullable()
    val tipo = varchar("tipo", 20) // RECEBIMENTO, ESTORNO, DESPESA
    val valor = double("valor")
    val dataTransacao = datetime("data_transacao").clientDefault { LocalDateTime.now() }
    val formaPagamento = varchar("forma_pagamento", 50).nullable() // PIX, CARTAO, etc.
    val taxas = double("taxas").default(0.0)
    val valorLiquido = double("valor_liquido")
    val descricao = text("descricao").nullable()
    override val primaryKey = PrimaryKey(id)
}

/**
 * Tabela para rastrear tentativas de cobrança e comunicação com o cliente.
 */
object HistoricoCobrancaTable : Table("historico_cobranca") {
    val id = integer("id").autoIncrement()
    val pedidoId = integer("pedido_id").references(PedidosFinanceiroTable.id)
    val dataCobranca = datetime("data_cobranca").clientDefault { LocalDateTime.now() }
    val mensagem = text("mensagem")
    val status = varchar("status", 50) // ENVIADO, FALHOU, VISUALIZADO
    override val primaryKey = PrimaryKey(id)
}
