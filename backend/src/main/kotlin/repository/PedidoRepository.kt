package org.example.repository

import org.example.Cliente
import org.example.Pedido
import org.example.PedidoItem
import org.example.PedidosTable
import org.example.PedidoItensTable
import org.example.ClientesTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.JoinType

class PedidoRepository {

    fun listarTodos(): List<Pedido> = transaction {
        (PedidosTable leftJoin ClientesTable).selectAll().map { row ->
            val pedidoId = row[PedidosTable.id]
            Pedido(
                id = pedidoId,
                clienteId = row[PedidosTable.clienteId],
                clienteNome = row.getOrNull(ClientesTable.nome) ?: "Sem cliente",
                valor = row[PedidosTable.valor],
                formaPagamento = row[PedidosTable.formaPagamento],
                dataPagamento = row[PedidosTable.dataPagamento],
                entregue = row[PedidosTable.entregue],
                itens = listarItens(pedidoId)
            )
        }
    }

    fun buscarPorId(id: Int): Pedido? = transaction {
        (PedidosTable leftJoin ClientesTable).select { PedidosTable.id eq id }.singleOrNull()?.let { row ->
            val pedidoId = row[PedidosTable.id]
            Pedido(
                id = pedidoId,
                clienteId = row[PedidosTable.clienteId],
                clienteNome = row.getOrNull(ClientesTable.nome) ?: "Sem cliente",
                valor = row[PedidosTable.valor],
                formaPagamento = row[PedidosTable.formaPagamento],
                dataPagamento = row[PedidosTable.dataPagamento],
                entregue = row[PedidosTable.entregue],
                itens = listarItens(pedidoId)
            )
        }
    }

    fun criar(pedido: Pedido): Pedido = transaction {
        val novoPedidoId = PedidosTable.insert {
            it[clienteId] = pedido.clienteId
            it[valor] = pedido.valor
            it[formaPagamento] = pedido.formaPagamento
            it[dataPagamento] = pedido.dataPagamento
            it[entregue] = pedido.entregue
        } get PedidosTable.id

        pedido.itens.forEach { item ->
            PedidoItensTable.insert {
                it[PedidoItensTable.pedidoId] = novoPedidoId
                it[PedidoItensTable.nomeProduto] = item.nome
                it[PedidoItensTable.quantidade] = item.qtd
                it[PedidoItensTable.precoUnitario] = item.preco
            }
        }

        buscarPorId(novoPedidoId.toInt()) ?: pedido.copy(id = novoPedidoId.toInt())
    }

    fun atualizarEntrega(id: Int, entregue: Boolean) = transaction {
        PedidosTable.update({ PedidosTable.id eq id }) {
            it[this.entregue] = entregue
        }
    }

    fun listarPorCliente(clienteId: Int): List<Pedido> = transaction {
        (PedidosTable leftJoin ClientesTable).select { PedidosTable.clienteId eq clienteId }.map { row ->
            val pedidoId = row[PedidosTable.id]
            Pedido(
                id = pedidoId,
                clienteId = row[PedidosTable.clienteId],
                clienteNome = row.getOrNull(ClientesTable.nome) ?: "Sem cliente",
                valor = row[PedidosTable.valor],
                formaPagamento = row[PedidosTable.formaPagamento],
                dataPagamento = row[PedidosTable.dataPagamento],
                entregue = row[PedidosTable.entregue],
                itens = listarItens(pedidoId)
            )
        }
    }

    private fun listarItens(pedidoId: Int): List<PedidoItem> = transaction {
        PedidoItensTable.select { PedidoItensTable.pedidoId eq pedidoId }.map { row ->
            PedidoItem(
                id = row[PedidoItensTable.id],
                pedidoId = row[PedidoItensTable.pedidoId],
                nome = row[PedidoItensTable.nomeProduto],
                qtd = row[PedidoItensTable.quantidade],
                preco = row[PedidoItensTable.precoUnitario]
            )
        }
    }

    fun atualizar(id: Int, pedido: Pedido): Boolean = transaction {
        val updated = PedidosTable.update({ PedidosTable.id eq id }) {
            it[clienteId] = pedido.clienteId
            it[valor] = pedido.valor
            it[formaPagamento] = pedido.formaPagamento
            it[dataPagamento] = pedido.dataPagamento
            it[entregue] = pedido.entregue
        }

        if (updated > 0) {
            PedidoItensTable.deleteWhere { PedidoItensTable.pedidoId eq id }
            pedido.itens.forEach { item ->
                PedidoItensTable.insert {
                    it[PedidoItensTable.pedidoId] = id
                    it[PedidoItensTable.nomeProduto] = item.nome
                    it[PedidoItensTable.quantidade] = item.qtd
                    it[PedidoItensTable.precoUnitario] = item.preco
                }
            }
            true
        } else false
    }

    fun deletar(id: Int): Boolean = transaction {
        PedidoItensTable.deleteWhere { PedidoItensTable.pedidoId eq id }
        val count = PedidosTable.deleteWhere { PedidosTable.id eq id }
        count > 0
    }
}

