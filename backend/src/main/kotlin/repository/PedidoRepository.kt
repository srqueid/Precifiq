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
import org.example.ProdutosFinaisTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

class PedidoRepository {

    private fun resolverItem(item: PedidoItem): PedidoItem {
        var resolvedVarId = item.variacaoId
        var resolvedKitId = item.kitId
        var resolvedTipo = item.tipo ?: "PRODUTO"
        var custoUnit = item.custoUnitario ?: 0.0

        if (resolvedVarId == null && resolvedKitId == null && item.nome.isNotBlank()) {
            val varRow = ProdutoVariacoesTable.select { ProdutoVariacoesTable.nomeTamanho eq item.nome }.firstOrNull()
            if (varRow != null) {
                resolvedVarId = varRow[ProdutoVariacoesTable.id]
                resolvedTipo = "PRODUTO"
                if (custoUnit == 0.0) custoUnit = varRow[ProdutoVariacoesTable.custoUnitarioCalculado]
            } else {
                val allVars = (ProdutoVariacoesTable innerJoin ProdutosFinaisTable).selectAll().toList()
                val matchVar = allVars.firstOrNull { r ->
                    val pNome = r[ProdutosFinaisTable.nome]
                    val tNome = r[ProdutoVariacoesTable.nomeTamanho]
                    item.nome.contains(pNome, ignoreCase = true) && (item.nome.contains(tNome, ignoreCase = true) || tNome.equals("Padrão", ignoreCase = true))
                }
                if (matchVar != null) {
                    resolvedVarId = matchVar[ProdutoVariacoesTable.id]
                    resolvedTipo = "PRODUTO"
                    if (custoUnit == 0.0) custoUnit = matchVar[ProdutoVariacoesTable.custoUnitarioCalculado]
                } else {
                    val kitRow = KitsTable.select { KitsTable.nome eq item.nome }.firstOrNull()
                        ?: KitsTable.selectAll().firstOrNull { item.nome.contains(it[KitsTable.nome], ignoreCase = true) }
                    if (kitRow != null) {
                        resolvedKitId = kitRow[KitsTable.id]
                        resolvedTipo = "KIT"
                        if (custoUnit == 0.0) custoUnit = kitRow[KitsTable.custoTotalCalculado]
                    }
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

        return item.copy(
            variacaoId = resolvedVarId,
            kitId = resolvedKitId,
            tipo = resolvedTipo,
            custoUnitario = custoUnit
        )
    }

    fun listarTodos(): List<Pedido> = transaction {
        (PedidosTable leftJoin ClientesTable).selectAll().map { row ->
            val pedidoId = row[PedidosTable.id]
            Pedido(
                id = pedidoId,
                clienteId = row[PedidosTable.clienteId],
                clienteNome = row.getOrNull(ClientesTable.nome) ?: "Sem cliente",
                valor = row[PedidosTable.valor],
                valorFrete = row[PedidosTable.valorFrete],
                tipoEnvio = row[PedidosTable.tipoEnvio],
                cepDestino = row[PedidosTable.cepDestino],
                prazoEnvio = row[PedidosTable.prazoEnvio],
                comprimentoCm = row[PedidosTable.comprimentoCm],
                larguraCm = row[PedidosTable.larguraCm],
                alturaCm = row[PedidosTable.alturaCm],
                pesoKg = row[PedidosTable.pesoKg],
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
                valorFrete = row[PedidosTable.valorFrete],
                tipoEnvio = row[PedidosTable.tipoEnvio],
                cepDestino = row[PedidosTable.cepDestino],
                prazoEnvio = row[PedidosTable.prazoEnvio],
                comprimentoCm = row[PedidosTable.comprimentoCm],
                larguraCm = row[PedidosTable.larguraCm],
                alturaCm = row[PedidosTable.alturaCm],
                pesoKg = row[PedidosTable.pesoKg],
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
        val itensResolvidos = pedido.itens.map { resolverItem(it) }
        val somaCustoTotal = itensResolvidos.sumOf { (it.custoUnitario ?: 0.0) * it.qtd }
        val valorItens = itensResolvidos.sumOf { it.preco * it.qtd }
        val valorFrete = pedido.valorFrete ?: 0.0
        val valorFinal = pedido.valor ?: (valorItens + valorFrete)
        val lucroCalculado = valorItens - somaCustoTotal

        // 2. Gravar o Pedido no banco
        val novoPedidoId = PedidosTable.insert {
            it[clienteId] = pedido.clienteId
            it[valor] = valorFinal
            it[valorTotal] = valorFinal
            it[PedidosTable.valorFrete] = valorFrete
            it[PedidosTable.tipoEnvio] = pedido.tipoEnvio ?: "RETIRADA"
            it[PedidosTable.cepDestino] = pedido.cepDestino
            it[PedidosTable.prazoEnvio] = pedido.prazoEnvio
            it[PedidosTable.comprimentoCm] = pedido.comprimentoCm ?: 20.0
            it[PedidosTable.larguraCm] = pedido.larguraCm ?: 15.0
            it[PedidosTable.alturaCm] = pedido.alturaCm ?: 10.0
            it[PedidosTable.pesoKg] = pedido.pesoKg ?: 0.5
            it[status] = if (pedido.entregue) "ENTREGUE" else "PENDENTE"
            it[valorCustoTotal] = somaCustoTotal
            it[lucroBruto] = lucroCalculado
            it[formaPagamento] = pedido.formaPagamento
            it[dataPagamento] = pedido.dataPagamento
            it[entregue] = pedido.entregue
        } get PedidosTable.id

        // 3. Gravar Itens do Pedido e Executar Baixa de Estoque
        itensResolvidos.forEach { item ->
            val vTotal = item.preco * item.qtd
            PedidoItensTable.insert {
                it[PedidoItensTable.pedidoId] = novoPedidoId
                it[PedidoItensTable.variacaoId] = item.variacaoId
                it[PedidoItensTable.kitId] = item.kitId
                it[PedidoItensTable.tipo] = item.tipo ?: "PRODUTO"
                it[PedidoItensTable.nomeProduto] = item.nome
                it[PedidoItensTable.produtoNome] = item.nome
                it[PedidoItensTable.quantidade] = item.qtd
                it[PedidoItensTable.precoUnitario] = item.preco
                it[PedidoItensTable.valorTotal] = vTotal
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
        if (pedido.clienteId != null && valorFinal > 0.0) {
            try {
                val statusFin = if (pedido.entregue || !pedido.dataPagamento.isNullOrBlank()) "PAGO" else "PENDENTE"
                val novoPedFinId = PedidosFinanceiroTable.insert {
                    it[clienteId] = pedido.clienteId!!
                    it[valorTotal] = valorFinal
                    it[status] = statusFin
                } get PedidosFinanceiroTable.id

                if (statusFin == "PAGO") {
                    TransacoesFinanceirasTable.insert {
                        it[pedidoId] = novoPedFinId
                        it[tipo] = "RECEBIMENTO"
                        it[valor] = valorFinal
                        it[valorLiquido] = valorFinal
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
            it[this.status] = if (entregue) "ENTREGUE" else "PENDENTE"
        }
    }

    fun atualizarPagamento(id: Int, dataPagamento: String?) = transaction {
        PedidosTable.update({ PedidosTable.id eq id }) {
            it[this.dataPagamento] = dataPagamento
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
                valorFrete = row[PedidosTable.valorFrete],
                tipoEnvio = row[PedidosTable.tipoEnvio],
                cepDestino = row[PedidosTable.cepDestino],
                prazoEnvio = row[PedidosTable.prazoEnvio],
                comprimentoCm = row[PedidosTable.comprimentoCm],
                larguraCm = row[PedidosTable.larguraCm],
                alturaCm = row[PedidosTable.alturaCm],
                pesoKg = row[PedidosTable.pesoKg],
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
        val itensResolvidos = pedido.itens.map { resolverItem(it) }
        val somaCustoTotal = itensResolvidos.sumOf { (it.custoUnitario ?: 0.0) * it.qtd }
        val valorItens = itensResolvidos.sumOf { it.preco * it.qtd }
        val valorFrete = pedido.valorFrete ?: 0.0
        val valorFinal = pedido.valor ?: (valorItens + valorFrete)
        val lucroCalculado = valorItens - somaCustoTotal

        val updated = PedidosTable.update({ PedidosTable.id eq id }) {
            it[clienteId] = pedido.clienteId
            it[valor] = valorFinal
            it[valorTotal] = valorFinal
            it[PedidosTable.valorFrete] = valorFrete
            it[PedidosTable.tipoEnvio] = pedido.tipoEnvio ?: "RETIRADA"
            it[PedidosTable.cepDestino] = pedido.cepDestino
            it[PedidosTable.prazoEnvio] = pedido.prazoEnvio
            it[PedidosTable.comprimentoCm] = pedido.comprimentoCm ?: 20.0
            it[PedidosTable.larguraCm] = pedido.larguraCm ?: 15.0
            it[PedidosTable.alturaCm] = pedido.alturaCm ?: 10.0
            it[PedidosTable.pesoKg] = pedido.pesoKg ?: 0.5
            it[valorCustoTotal] = somaCustoTotal
            it[lucroBruto] = lucroCalculado
            it[status] = if (pedido.entregue) "ENTREGUE" else "PENDENTE"
            it[formaPagamento] = pedido.formaPagamento
            it[dataPagamento] = pedido.dataPagamento
            it[entregue] = pedido.entregue
        }

        if (updated > 0) {
            PedidoItensTable.deleteWhere { PedidoItensTable.pedidoId eq id }
            itensResolvidos.forEach { item ->
                val vTotal = item.preco * item.qtd
                PedidoItensTable.insert {
                    it[PedidoItensTable.pedidoId] = id
                    it[PedidoItensTable.variacaoId] = item.variacaoId
                    it[PedidoItensTable.kitId] = item.kitId
                    it[PedidoItensTable.tipo] = item.tipo ?: "PRODUTO"
                    it[PedidoItensTable.nomeProduto] = item.nome
                    it[PedidoItensTable.produtoNome] = item.nome
                    it[PedidoItensTable.quantidade] = item.qtd
                    it[PedidoItensTable.precoUnitario] = item.preco
                    it[PedidoItensTable.valorTotal] = vTotal
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

