package org.example.repository

import org.example.Cliente
import org.example.Pedido
import org.example.PedidoItem
import org.example.PedidosTable
import org.example.PedidoItensTable
import org.example.ClientesTable
import org.example.ProdutoVariacoesTable
import org.example.EstoqueVariacaoAuxTable
import org.example.KitsTable
import org.example.KitItensTable
import org.example.MovimentosEstoqueVariacaoTable
import org.example.PedidosFinanceiroTable
import org.example.TransacoesFinanceirasTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

class PedidoRepository {

    fun listarTodos(): List<Pedido> = transaction {
        (PedidosTable leftJoin ClientesTable).selectAll().map { row ->
            val pedidoId = row[PedidosTable.id]
            Pedido(
                id = pedidoId,
                clienteId = row[PedidosTable.clienteId],
                clienteNome = row.getOrNull(ClientesTable.nome) ?: "Sem cliente",
                valor = row[PedidosTable.valor],
                valorCustoTotal = row[PedidosTable.valorCustoTotal],
                lucroBruto = row[PedidosTable.lucroBruto],
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
                valorCustoTotal = row[PedidosTable.valorCustoTotal],
                lucroBruto = row[PedidosTable.lucroBruto],
                formaPagamento = row[PedidosTable.formaPagamento],
                dataPagamento = row[PedidosTable.dataPagamento],
                entregue = row[PedidosTable.entregue],
                itens = listarItens(pedidoId)
            )
        }
    }

    fun criar(pedido: Pedido): Pedido = transaction {
        // 1. Resolver itens, calcular custos unitários e verificar disponibilidade de estoque
        var somaCustoTotal = 0.0

        val itensResolvidos = pedido.itens.map { item ->
            var resolvedVarId = item.variacaoId
            var resolvedKitId = item.kitId
            var resolvedTipo = item.tipo ?: "PRODUTO"
            var custoUnit = item.custoUnitario ?: 0.0

            // Se não tiver ID explícito, tentar resolver por nome
            if (resolvedVarId == null && resolvedKitId == null && item.nome.isNotBlank()) {
                val varRow = ProdutoVariacoesTable.select { ProdutoVariacoesTable.nomeTamanho eq item.nome }.firstOrNull()
                if (varRow != null) {
                    resolvedVarId = varRow[ProdutoVariacoesTable.id]
                    resolvedTipo = "PRODUTO"
                    custoUnit = varRow[ProdutoVariacoesTable.custoUnitarioCalculado]
                } else {
                    val kitRow = KitsTable.select { KitsTable.nome eq item.nome }.firstOrNull()
                    if (kitRow != null) {
                        resolvedKitId = kitRow[KitsTable.id]
                        resolvedTipo = "KIT"
                        custoUnit = kitRow[KitsTable.custoTotalCalculado]
                    }
                }
            } else if (resolvedVarId != null && custoUnit == 0.0) {
                val varRow = ProdutoVariacoesTable.select { ProdutoVariacoesTable.id eq resolvedVarId }.firstOrNull()
                if (varRow != null) {
                    custoUnit = varRow[ProdutoVariacoesTable.custoUnitarioCalculado]
                }
            } else if (resolvedKitId != null && custoUnit == 0.0) {
                val kitRow = KitsTable.select { KitsTable.id eq resolvedKitId }.firstOrNull()
                if (kitRow != null) {
                    custoUnit = kitRow[KitsTable.custoTotalCalculado]
                }
            }

            somaCustoTotal += (custoUnit * item.qtd)

            item.copy(
                variacaoId = resolvedVarId,
                kitId = resolvedKitId,
                tipo = resolvedTipo,
                custoUnitario = custoUnit
            )
        }

        val valorVenda = pedido.valor ?: itensResolvidos.sumOf { it.preco * it.qtd }
        val lucroCalculado = valorVenda - somaCustoTotal

        // 2. Gravar o Pedido no banco
        val novoPedidoId = PedidosTable.insert {
            it[clienteId] = pedido.clienteId
            it[valor] = valorVenda
            it[valorCustoTotal] = somaCustoTotal
            it[lucroBruto] = lucroCalculado
            it[formaPagamento] = pedido.formaPagamento
            it[dataPagamento] = pedido.dataPagamento
            it[entregue] = pedido.entregue
        } get PedidosTable.id

        // 3. Gravar Itens do Pedido e Executar Baixa de Estoque
        itensResolvidos.forEach { item ->
            PedidoItensTable.insert {
                it[PedidoItensTable.pedidoId] = novoPedidoId
                it[PedidoItensTable.variacaoId] = item.variacaoId
                it[PedidoItensTable.kitId] = item.kitId
                it[PedidoItensTable.tipo] = item.tipo ?: "PRODUTO"
                it[PedidoItensTable.nomeProduto] = item.nome
                it[PedidoItensTable.quantidade] = item.qtd
                it[PedidoItensTable.precoUnitario] = item.preco
                it[PedidoItensTable.custoUnitario] = item.custoUnitario ?: 0.0
            }

            // Baixa automática de estoque de produto acabado
            if (item.variacaoId != null) {
                val varId = item.variacaoId!!
                val estoqueAtual = EstoqueVariacaoAuxTable.select { EstoqueVariacaoAuxTable.variacaoId eq varId }
                    .singleOrNull()?.get(EstoqueVariacaoAuxTable.estoque) ?: 0.0

                val novoEstoque = (estoqueAtual - item.qtd).coerceAtLeast(0.0)

                ProdutoVariacoesTable.update({ ProdutoVariacoesTable.id eq varId }) {
                    it[estoque] = novoEstoque
                }

                EstoqueVariacaoAuxTable.deleteWhere { EstoqueVariacaoAuxTable.variacaoId eq varId }
                EstoqueVariacaoAuxTable.insert {
                    it[variacaoId] = varId
                    it[estoque] = novoEstoque
                }

                try {
                    MovimentosEstoqueVariacaoTable.insert {
                        it[variacaoId] = varId
                        it[tipo] = "SAIDA_VENDA"
                        it[quantidade] = item.qtd.toDouble()
                        it[motivo] = "Venda no Pedido #$novoPedidoId"
                        it[origem] = "PEDIDO_VENDA"
                    }
                } catch (e: Exception) {}
            }

            // Baixa automática de estoque de kits (baixa em cada componente)
            if (item.kitId != null) {
                val componentes = KitItensTable.select { KitItensTable.kitId eq item.kitId!! }.toList()
                for (comp in componentes) {
                    val compVarId = comp[KitItensTable.produtoVariacaoId]
                    val qtdNecessaria = comp[KitItensTable.quantidade] * item.qtd

                    val estAtual = EstoqueVariacaoAuxTable.select { EstoqueVariacaoAuxTable.variacaoId eq compVarId }
                        .singleOrNull()?.get(EstoqueVariacaoAuxTable.estoque) ?: 0.0

                    val novoEst = (estAtual - qtdNecessaria).coerceAtLeast(0.0)

                    ProdutoVariacoesTable.update({ ProdutoVariacoesTable.id eq compVarId }) {
                        it[estoque] = novoEst
                    }

                    EstoqueVariacaoAuxTable.deleteWhere { EstoqueVariacaoAuxTable.variacaoId eq compVarId }
                    EstoqueVariacaoAuxTable.insert {
                        it[variacaoId] = compVarId
                        it[estoque] = novoEst
                    }

                    try {
                        MovimentosEstoqueVariacaoTable.insert {
                            it[variacaoId] = compVarId
                            it[tipo] = "SAIDA_VENDA_KIT"
                            it[quantidade] = qtdNecessaria.toDouble()
                            it[motivo] = "Venda Kit '${item.nome}' no Pedido #$novoPedidoId"
                            it[origem] = "PEDIDO_VENDA_KIT"
                        }
                    } catch (e: Exception) {}
                }
            }
        }

        // 4. Integração Financeira Automática
        if (pedido.clienteId != null && valorVenda > 0.0) {
            try {
                val statusFin = if (pedido.entregue || !pedido.dataPagamento.isNullOrBlank()) "PAGO" else "PENDENTE"
                val novoPedFinId = PedidosFinanceiroTable.insert {
                    it[clienteId] = pedido.clienteId!!
                    it[valorTotal] = valorVenda
                    it[status] = statusFin
                } get PedidosFinanceiroTable.id

                if (statusFin == "PAGO") {
                    TransacoesFinanceirasTable.insert {
                        it[pedidoId] = novoPedFinId
                        it[tipo] = "RECEBIMENTO"
                        it[valor] = valorVenda
                        it[valorLiquido] = valorVenda
                        it[formaPagamento] = pedido.formaPagamento
                        it[descricao] = "Recebimento Venda Pedido #$novoPedidoId"
                    }
                }
            } catch (e: Exception) {
                // Tabela financeira pode ser opcional em determinados tenants
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
                valorCustoTotal = row[PedidosTable.valorCustoTotal],
                lucroBruto = row[PedidosTable.lucroBruto],
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
                preco = row[PedidoItensTable.precoUnitario],
                variacaoId = row[PedidoItensTable.variacaoId],
                kitId = row[PedidoItensTable.kitId],
                tipo = row[PedidoItensTable.tipo],
                custoUnitario = row[PedidoItensTable.custoUnitario]
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
                    it[PedidoItensTable.variacaoId] = item.variacaoId
                    it[PedidoItensTable.kitId] = item.kitId
                    it[PedidoItensTable.tipo] = item.tipo ?: "PRODUTO"
                    it[PedidoItensTable.nomeProduto] = item.nome
                    it[PedidoItensTable.quantidade] = item.qtd
                    it[PedidoItensTable.precoUnitario] = item.preco
                    it[PedidoItensTable.custoUnitario] = item.custoUnitario ?: 0.0
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

