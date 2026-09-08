package org.example.repository

import org.example.*
import org.example.StatusCompra
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class OrcamentoRepository {
    fun lerTodosOrcamentos(): List<OrcamentoCompra> = transaction {
        OrcamentosCompraTable.selectAll().map {
            OrcamentoCompra(
                id = it[OrcamentosCompraTable.id],
                titulo = it[OrcamentosCompraTable.titulo],
                dataCriacao = it[OrcamentosCompraTable.dataCriacao].let { instant ->
                    LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault())
                },
                status = StatusOrcamento.valueOf(it[OrcamentosCompraTable.status]),
                observacoes = it[OrcamentosCompraTable.observacoes],
                ativo = it[OrcamentosCompraTable.ativo],
                frete = it[OrcamentosCompraTable.frete],
                desconto = it[OrcamentosCompraTable.desconto]
            )
        }
    }

    fun criarOrcamento(o: OrcamentoCompra): OrcamentoCompra = transaction {
        val dataCriacaoValor = o.dataCriacao ?: LocalDateTime.now()
        val id = OrcamentosCompraTable.insert {
            it[OrcamentosCompraTable.titulo] = o.titulo
            it[OrcamentosCompraTable.dataCriacao] = dataCriacaoValor.atZone(java.time.ZoneId.systemDefault()).toInstant()
            it[OrcamentosCompraTable.status] = o.status.name
            it[OrcamentosCompraTable.observacoes] = o.observacoes
            it[OrcamentosCompraTable.ativo] = o.ativo
            it[OrcamentosCompraTable.frete] = o.frete
            it[OrcamentosCompraTable.desconto] = o.desconto
        }[OrcamentosCompraTable.id]
        o.copy(id = id, dataCriacao = dataCriacaoValor)
    }

    fun lerOrcamentoPorId(id: Int): OrcamentoCompra? = transaction {
        OrcamentosCompraTable.select { OrcamentosCompraTable.id eq id }.singleOrNull()?.let {
            OrcamentoCompra(
                id = it[OrcamentosCompraTable.id],
                titulo = it[OrcamentosCompraTable.titulo],
                dataCriacao = it[OrcamentosCompraTable.dataCriacao].let { instant ->
                    LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault())
                },
                status = StatusOrcamento.valueOf(it[OrcamentosCompraTable.status]),
                observacoes = it[OrcamentosCompraTable.observacoes],
                ativo = it[OrcamentosCompraTable.ativo],
                frete = it[OrcamentosCompraTable.frete],
                desconto = it[OrcamentosCompraTable.desconto]
            )
        }
    }

    fun lerItens(orcamentoId: Int): List<ItemOrcamento> = transaction {
        ItensOrcamentoTable.select { ItensOrcamentoTable.orcamentoId eq orcamentoId }.map {
            ItemOrcamento(
                id = it[ItensOrcamentoTable.id],
                orcamentoId = it[ItensOrcamentoTable.orcamentoId],
                insumoId = it[ItensOrcamentoTable.insumoId],
                quantidade = it[ItensOrcamentoTable.quantidade],
                ativo = it[ItensOrcamentoTable.ativo],
                quantidadeRecebida = it[ItensOrcamentoTable.quantidadeRecebida],
                precoUnitarioRecebido = it[ItensOrcamentoTable.precoUnitarioRecebido],
                valorFinalItem = it[ItensOrcamentoTable.valorFinalItem]
            )
        }
    }

    fun adicionarItem(orcamentoId: Int, insumoId: Int, quantidade: Double) = transaction {
        ItensOrcamentoTable.insert {
            it[ItensOrcamentoTable.orcamentoId] = orcamentoId
            it[ItensOrcamentoTable.insumoId] = insumoId
            it[ItensOrcamentoTable.quantidade] = quantidade
            it[ItensOrcamentoTable.ativo] = true
        }
    }

    fun deletarItem(id: Int) = transaction {
        ItensOrcamentoTable.deleteWhere { Op.build { ItensOrcamentoTable.id eq id } }
    }

    fun lerCotacoesDoItem(itemId: Int): List<CotacaoFornecedor> = transaction {
        CotacoesFornecedorTable.select { CotacoesFornecedorTable.itemOrcamentoId eq itemId }.map {
            CotacaoFornecedor(
                id = it[CotacoesFornecedorTable.id],
                itemOrcamentoId = it[CotacoesFornecedorTable.itemOrcamentoId],
                fornecedorId = it[CotacoesFornecedorTable.fornecedorId],
                precoUnitario = it[CotacoesFornecedorTable.precoUnitario]
            )
        }
    }

    fun adicionarCotacao(itemId: Int, fornecedorId: Int, precoUnitario: Double) = transaction {
        CotacoesFornecedorTable.insert {
            it[CotacoesFornecedorTable.itemOrcamentoId] = itemId
            it[CotacoesFornecedorTable.fornecedorId] = fornecedorId
            it[CotacoesFornecedorTable.precoUnitario] = precoUnitario
        }
    }

    fun deletarCotacao(id: Int) = transaction {
        CotacoesFornecedorTable.deleteWhere { Op.build { CotacoesFornecedorTable.id eq id } }
    }

    fun atualizarValores(id: Int, frete: Double, desconto: Double, observacoes: String?) = transaction {
        OrcamentosCompraTable.update({ OrcamentosCompraTable.id eq id }) {
            it[OrcamentosCompraTable.frete] = frete
            it[OrcamentosCompraTable.desconto] = desconto
            if (observacoes != null) it[OrcamentosCompraTable.observacoes] = observacoes
        }
    }

    fun atualizarTitulo(id: Int, titulo: String) = transaction {
        OrcamentosCompraTable.update({ OrcamentosCompraTable.id eq id }) {
            it[OrcamentosCompraTable.titulo] = titulo
        }
    }

    fun atualizarStatus(id: Int, status: StatusOrcamento) = transaction {
        OrcamentosCompraTable.update({ OrcamentosCompraTable.id eq id }) {
            it[OrcamentosCompraTable.status] = status.name
        }
    }

    fun deletarOrcamento(id: Int) = transaction {
        OrcamentosCompraTable.deleteWhere { Op.build { OrcamentosCompraTable.id eq id } }
    }

    data class SugestaoCompra(val itemOrcamentoId: Int? = null, val insumoId: Int, val quantidade: Double, val precoUnitario: Double, val total: Double)

    data class PedidoAprovacao(val fornecedorId: Int, val itens: List<SugestaoCompra>, val frete: Double = 0.0, val formaPagamento: String = "PIX")

    fun sugerirMelhoresCompras(orcamentoId: Int): Map<Int, List<SugestaoCompra>> = transaction {
        val itens = lerItens(orcamentoId).filter { it.ativo }
        val sugestoes = mutableListOf<Pair<Int, SugestaoCompra>>()

        for (item in itens) {
            val cotacaoMaisBarata = CotacoesFornecedorTable
                .select { CotacoesFornecedorTable.itemOrcamentoId eq item.id }
                .minByOrNull { it[CotacoesFornecedorTable.precoUnitario] }

            if (cotacaoMaisBarata != null) {
                val fornId = cotacaoMaisBarata[CotacoesFornecedorTable.fornecedorId]
                val preco = cotacaoMaisBarata[CotacoesFornecedorTable.precoUnitario]
                sugestoes.add(Pair(fornId, SugestaoCompra(item.id, item.insumoId, item.quantidade, preco, preco * item.quantidade)))
            }
        }

        sugestoes.groupBy({ (fornId, _) -> fornId }, { (_, sugestao) -> sugestao })
    }

    fun sugerirTodosPrecos(orcamentoId: Int): List<Map<String, Any?>> = transaction {
        val itens = lerItens(orcamentoId).filter { it.ativo }
        val resultado = mutableListOf<Map<String, Any?>>()

        for (item in itens) {
            val cotacoes = CotacoesFornecedorTable
                .select { CotacoesFornecedorTable.itemOrcamentoId eq item.id }
                .toList()

            val precos = cotacoes.map { row ->
                val precoUnitario = row[CotacoesFornecedorTable.precoUnitario]
                mapOf(
                    "fornecedorId" to row[CotacoesFornecedorTable.fornecedorId],
                    "precoUnitario" to precoUnitario,
                    "total" to precoUnitario * item.quantidade
                )
            }

            resultado.add(
                mapOf(
                    "itemId" to item.id,
                    "itemOrcamentoId" to item.id,
                    "insumoId" to item.insumoId,
                    "quantidade" to item.quantidade,
                    "ativo" to item.ativo,
                    "cotacoes" to precos
                )
            )
        }

        resultado
    }

    fun gerarPedido(orcamentoId: Int, fornecedorId: Int, itens: List<SugestaoCompra>, frete: Double, formaPagamento: FormaPagamento): Int = transaction {
        criarPedido(orcamentoId, fornecedorId, itens, frete, formaPagamento).also {
            atualizarStatusAposAlteracao(orcamentoId)
        }
    }

    fun gerarPedidos(orcamentoId: Int, pedidos: List<PedidoAprovacao>, formaPagamento: FormaPagamento): List<Int> = transaction {
        OrcamentosCompraTable.select { OrcamentosCompraTable.id eq orcamentoId }
            .singleOrNull()
            ?: throw Exception("Orçamento com id $orcamentoId não encontrado")

        val novosPedidoIds = pedidos
            .filter { it.fornecedorId > 0 && it.itens.isNotEmpty() }
            .groupBy { it.fornecedorId }
            .map { (fornecedorId, pedidosDoFornecedor) ->
                val frete = pedidosDoFornecedor.sumOf { it.frete }
                val itens = pedidosDoFornecedor.flatMap { it.itens }
                criarPedido(orcamentoId, fornecedorId, itens, frete, formaPagamento)
            }

        if (novosPedidoIds.isNotEmpty()) {
            atualizarStatusAposAlteracao(orcamentoId)
        }

        novosPedidoIds
    }

    private fun atualizarStatusAposAlteracao(orcamentoId: Int) {
        val itensAtivos = ItensOrcamentoTable.select { (ItensOrcamentoTable.orcamentoId eq orcamentoId) and (ItensOrcamentoTable.ativo eq true) }.toList()
        val pedidosExistentes = PedidosCompraTable.select { PedidosCompraTable.orcamentoId eq orcamentoId }.toList()
        val novoStatus = when {
            itensAtivos.isNotEmpty() && pedidosExistentes.isNotEmpty() -> StatusOrcamento.PEDIDO_PARCIAL
            itensAtivos.isNotEmpty() -> StatusOrcamento.EM_ORCAMENTO
            pedidosExistentes.isNotEmpty() -> StatusOrcamento.COMPRA_APROVADA
            else -> StatusOrcamento.EM_ORCAMENTO
        }

        OrcamentosCompraTable.update({ OrcamentosCompraTable.id eq orcamentoId }) {
            it[OrcamentosCompraTable.status] = novoStatus.name
        }
    }

    private fun criarPedido(orcamentoId: Int, fornecedorId: Int, itens: List<SugestaoCompra>, frete: Double, formaPagamento: FormaPagamento): Int {
        val itensVinculadosIds = mutableSetOf<Int>()
        val itensDisponiveis = mutableListOf<SugestaoCompra>()

        itens.forEach { item ->
            val itemOrcamentoId = item.itemOrcamentoId ?: ItensOrcamentoTable
                .select { (ItensOrcamentoTable.orcamentoId eq orcamentoId) and (ItensOrcamentoTable.insumoId eq item.insumoId) }
                .orderBy(ItensOrcamentoTable.id)
                .toList()
                .firstOrNull { it[ItensOrcamentoTable.ativo] }
                ?.get(ItensOrcamentoTable.id)

            if (itemOrcamentoId == null) return@forEach

            val itemOrcamento = ItensOrcamentoTable.select { ItensOrcamentoTable.id eq itemOrcamentoId }.singleOrNull()
            require(itemOrcamento != null && itemOrcamento[ItensOrcamentoTable.orcamentoId] == orcamentoId && itemOrcamento[ItensOrcamentoTable.ativo]) {
                "Item de orçamento #$itemOrcamentoId não está disponível para compra"
            }

            if (!itensVinculadosIds.add(itemOrcamentoId)) return@forEach

            itensDisponiveis.add(item.copy(itemOrcamentoId = itemOrcamentoId))
        }

        require(itensVinculadosIds.isNotEmpty()) {
            "Nenhum item disponível para gerar pedido"
        }

        val valorItens = itensDisponiveis.sumOf { it.quantidade * it.precoUnitario }

        val pedidoId = PedidosCompraTable.insert {
            it[PedidosCompraTable.orcamentoId] = orcamentoId
            it[PedidosCompraTable.fornecedorId] = fornecedorId
            it[PedidosCompraTable.dataConfirmacao] = LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()
            it[PedidosCompraTable.valorTotalItens] = valorItens
            it[PedidosCompraTable.valorFrete] = frete
            it[PedidosCompraTable.valorFinalConfirmado] = valorItens + frete
            it[PedidosCompraTable.formaPagamento] = formaPagamento.name
        }[PedidosCompraTable.id]

        itensDisponiveis.forEach { item ->
            val itemOrcamentoId = item.itemOrcamentoId ?: return@forEach

            PedidoCompraItensTable.insert {
                it[PedidoCompraItensTable.pedidoCompraId] = pedidoId
                it[PedidoCompraItensTable.itemOrcamentoId] = itemOrcamentoId
                it[PedidoCompraItensTable.insumoId] = item.insumoId
                it[PedidoCompraItensTable.quantidade] = item.quantidade
                it[PedidoCompraItensTable.precoUnitario] = item.precoUnitario
            }
        }

        itensVinculadosIds.forEach { itemId ->
            ItensOrcamentoTable.update({ ItensOrcamentoTable.id eq itemId }) {
                it[ItensOrcamentoTable.ativo] = false
            }
        }

        return pedidoId
    }

    fun atualizarItemRecebido(itemId: Int, quantidadeRecebida: Double, precoUnitarioRecebido: Double) = transaction {
        val valorFinal = quantidadeRecebida * precoUnitarioRecebido
        ItensOrcamentoTable.update({ ItensOrcamentoTable.id eq itemId }) {
            it[ItensOrcamentoTable.quantidadeRecebida] = quantidadeRecebida
            it[ItensOrcamentoTable.precoUnitarioRecebido] = precoUnitarioRecebido
            it[ItensOrcamentoTable.valorFinalItem] = valorFinal
        }
    }

    fun verificarTodosItensRecebidos(orcamentoId: Int): Boolean = transaction {
        val itens = lerItens(orcamentoId)
        if (itens.isEmpty()) return@transaction false
        itens.all { it.quantidadeRecebida != null && it.precoUnitarioRecebido != null }
    }

    fun lerPedidosCompra(): List<PedidoCompraView> = transaction {
        PedidosCompraTable
            .innerJoin(OrcamentosCompraTable)
            .innerJoin(FornecedoresTable)
            .selectAll()
            .orderBy(PedidosCompraTable.id)
            .map { row ->
                PedidoCompraView(
                    id = row[PedidosCompraTable.id],
                    orcamentoId = row[PedidosCompraTable.orcamentoId],
                    orcamentoTitulo = row[OrcamentosCompraTable.titulo],
                    fornecedorId = row[PedidosCompraTable.fornecedorId],
                    fornecedorNome = row[FornecedoresTable.nome],
                    dataConfirmacao = LocalDateTime.ofInstant(row[PedidosCompraTable.dataConfirmacao], ZoneId.systemDefault()),
                    valorTotalItens = row[PedidosCompraTable.valorTotalItens],
                    valorFrete = row[PedidosCompraTable.valorFrete],
                    valorFinalConfirmado = row[PedidosCompraTable.valorFinalConfirmado],
                    formaPagamento = FormaPagamento.valueOf(row[PedidosCompraTable.formaPagamento])
                )
            }
    }

    fun atualizarFretePedido(pedidoId: Int, frete: Double) = transaction {
        val valorTotalItens = PedidosCompraTable
            .select { PedidosCompraTable.id eq pedidoId }
            .singleOrNull()
            ?.let { it[PedidosCompraTable.valorTotalItens] }
            ?: return@transaction

        PedidosCompraTable.update({ PedidosCompraTable.id eq pedidoId }) {
            it[PedidosCompraTable.valorFrete] = frete
            it[PedidosCompraTable.valorFinalConfirmado] = valorTotalItens + frete
        }
    }

    fun retornarPedidoParaOrcamento(pedidoId: Int) = transaction {
        // Get the orcamentoId for this pedido
        val orcamentoId = PedidosCompraTable.select { PedidosCompraTable.id eq pedidoId }
            .singleOrNull()
            ?.get(PedidosCompraTable.orcamentoId)
            ?: return@transaction

        // Re-activate the items
        val itemIds = PedidoCompraItensTable
            .select { PedidoCompraItensTable.pedidoCompraId eq pedidoId }
            .map { it[PedidoCompraItensTable.itemOrcamentoId] }

        itemIds.forEach { itemId ->
            ItensOrcamentoTable.update({ ItensOrcamentoTable.id eq itemId }) {
                it[ItensOrcamentoTable.ativo] = true
            }
        }

        // Delete the pedido
        PedidosCompraTable.deleteWhere { Op.build { PedidosCompraTable.id eq pedidoId } }

        // Update orcamento status
        atualizarStatusAposAlteracao(orcamentoId)
    }

    fun converterPedidoParaCompra(pedidoId: Int, formaPagamento: FormaPagamento, prazoRecebimento: String?) = transaction {
        // Get the pedido details
        val pedido = PedidosCompraTable
            .select { PedidosCompraTable.id eq pedidoId }
            .singleOrNull()
            ?: return@transaction

        val orcamentoId = pedido[PedidosCompraTable.orcamentoId]
        val fornecedorId = pedido[PedidosCompraTable.fornecedorId]
        val valorTotal = pedido[PedidosCompraTable.valorFinalConfirmado]

        // Create a compra
        val compraId = ComprasTable.insert {
            it[ComprasTable.orcamentoId] = orcamentoId
            it[ComprasTable.fornecedorId] = fornecedorId
            it[ComprasTable.dataPrevistaNecessidade] = if (prazoRecebimento != null) {
                // Simple parsing: "15 dias" -> add 15 days to now
                val dias = prazoRecebimento.split(" ").firstOrNull()?.toIntOrNull()
                if (dias != null) {
                    LocalDateTime.now().plusDays(dias.toLong()).atZone(ZoneId.systemDefault()).toInstant()
                } else {
                    LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()
                }
            } else {
                LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()
            }
            it[ComprasTable.dataCriacao] = LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()
            it[ComprasTable.status] = StatusCompra.PENDENTE.name
            it[ComprasTable.valorTotal] = valorTotal
        }[ComprasTable.id]

        // Get items from the pedido
        val itensPedido = PedidoCompraItensTable
            .select { PedidoCompraItensTable.pedidoCompraId eq pedidoId }
            .toList()

        // Create compra items
        itensPedido.forEach { row ->
            val insumoId = row[PedidoCompraItensTable.insumoId] ?: return@forEach

            ItensCompraTable.insert {
                it[ItensCompraTable.compraId] = compraId
                it[ItensCompraTable.itemOrcamentoId] = row[PedidoCompraItensTable.itemOrcamentoId]
                it[ItensCompraTable.insumoId] = insumoId
                it[ItensCompraTable.quantidadeSolicitada] = row[PedidoCompraItensTable.quantidade]
                it[ItensCompraTable.quantidadeComprada] = row[PedidoCompraItensTable.quantidade]
                it[ItensCompraTable.precoUnitario] = row[PedidoCompraItensTable.precoUnitario]
                it[ItensCompraTable.ativo] = true
            }
        }

        // Delete the pedido
        PedidosCompraTable.deleteWhere { Op.build { PedidosCompraTable.id eq pedidoId } }

        // Update orcamento status
        atualizarStatusAposAlteracao(orcamentoId)
    }

    fun lerRelatorioOrcamento(id: Int): OrcamentoRelatorio? = transaction {
        val orcamentoRow = OrcamentosCompraTable.select { OrcamentosCompraTable.id eq id }.singleOrNull() ?: return@transaction null

        val itensRows = ItensOrcamentoTable
            .select { ItensOrcamentoTable.orcamentoId eq id }
            .orderBy(ItensOrcamentoTable.id)
            .toList()

        val insumoIds = itensRows.map { it[ItensOrcamentoTable.insumoId] }.distinct()
        val insumosById = if (insumoIds.isEmpty()) {
            emptyMap<Int, ResultRow>()
        } else {
            InsumosTable
                .select { InsumosTable.id inList insumoIds }
                .associateBy { it[InsumosTable.id] }
        }

        val unidadeIds = insumosById.values.map { it[InsumosTable.unidadeMedidaId] }.distinct()
        val unidadesById = if (unidadeIds.isEmpty()) {
            emptyMap<Int, ResultRow>()
        } else {
            UnidadesMedidaTable
                .select { UnidadesMedidaTable.id inList unidadeIds }
                .associateBy { it[UnidadesMedidaTable.id] }
        }

        val itensRelatorio = itensRows.map { row ->
            val insumoId = row[ItensOrcamentoTable.insumoId]
            val insumo = insumosById[insumoId]
            val unidade = insumo?.let { unidadesById[it[InsumosTable.unidadeMedidaId]] }

            val cotacoesRows = CotacoesFornecedorTable
                .select { CotacoesFornecedorTable.itemOrcamentoId eq row[ItensOrcamentoTable.id] }
                .toList()

            val fornecedorIds = cotacoesRows.map { it[CotacoesFornecedorTable.fornecedorId] }.distinct()
            val fornecedoresById = if (fornecedorIds.isEmpty()) {
                emptyMap<Int, ResultRow>()
            } else {
                FornecedoresTable
                    .select { FornecedoresTable.id inList fornecedorIds }
                    .associateBy { it[FornecedoresTable.id] }
            }

            val cotacoesRelatorio = cotacoesRows.map { cotRow ->
                val fornId = cotRow[CotacoesFornecedorTable.fornecedorId]
                val precoUnitario = cotRow[CotacoesFornecedorTable.precoUnitario]
                CotacaoFornecedorRelatorio(
                    id = cotRow[CotacoesFornecedorTable.id],
                    fornecedorId = fornId,
                    fornecedorNome = fornecedoresById[fornId]?.get(FornecedoresTable.nome) ?: "Desconhecido",
                    precoUnitario = precoUnitario,
                    total = precoUnitario * row[ItensOrcamentoTable.quantidade]
                )
            }

            val valorTotalCotacoes = cotacoesRelatorio.sumOf { it.total }

            ItemOrcamentoRelatorio(
                id = row[ItensOrcamentoTable.id],
                insumoId = insumoId,
                insumoNome = insumo?.get(InsumosTable.nome) ?: "Insumo #$insumoId",
                unidadeSigla = unidade?.get(UnidadesMedidaTable.sigla),
                quantidade = row[ItensOrcamentoTable.quantidade],
                ativo = row[ItensOrcamentoTable.ativo],
                quantidadeRecebida = row[ItensOrcamentoTable.quantidadeRecebida],
                precoUnitarioRecebido = row[ItensOrcamentoTable.precoUnitarioRecebido],
                valorFinalItem = row[ItensOrcamentoTable.valorFinalItem],
                cotacoes = cotacoesRelatorio
            )
        }

        val valorTotalItens = itensRelatorio.sumOf { it.quantidade * (it.cotacoes.minOfOrNull { it.precoUnitario } ?: 0.0) }
        val valorTotalCotacoes = itensRelatorio.sumOf { it.cotacoes.sumOf { c -> c.precoUnitario * it.quantidade } }
        val valorFinal = valorTotalItens + orcamentoRow[OrcamentosCompraTable.frete] - orcamentoRow[OrcamentosCompraTable.desconto]

        OrcamentoRelatorio(
            id = orcamentoRow[OrcamentosCompraTable.id],
            titulo = orcamentoRow[OrcamentosCompraTable.titulo],
            dataCriacao = LocalDateTime.ofInstant(orcamentoRow[OrcamentosCompraTable.dataCriacao], ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")),
            status = orcamentoRow[OrcamentosCompraTable.status],
            observacoes = orcamentoRow[OrcamentosCompraTable.observacoes],
            frete = orcamentoRow[OrcamentosCompraTable.frete],
            desconto = orcamentoRow[OrcamentosCompraTable.desconto],
            valorTotalItens = valorTotalItens,
            valorTotalCotacoes = valorTotalCotacoes,
            valorFinal = valorFinal,
            itens = itensRelatorio
        )
    }

    fun lerParaImpressaoOrcamento(id: Int): Map<String, Any>? = transaction {
        val relatorio = lerRelatorioOrcamento(id) ?: return@transaction null

        val pedidos = PedidosCompraTable
            .select { PedidosCompraTable.orcamentoId eq id }
            .map { row ->
                mapOf(
                    "id" to row[PedidosCompraTable.id],
                    "fornecedorId" to row[PedidosCompraTable.fornecedorId],
                    "dataConfirmacao" to LocalDateTime.ofInstant(row[PedidosCompraTable.dataConfirmacao], ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")),
                    "valorTotalItens" to row[PedidosCompraTable.valorTotalItens],
                    "valorFrete" to row[PedidosCompraTable.valorFrete],
                    "valorFinalConfirmado" to row[PedidosCompraTable.valorFinalConfirmado],
                    "formaPagamento" to row[PedidosCompraTable.formaPagamento]
                )
            }

        mapOf(
            "orcamento" to relatorio,
            "pedidos" to pedidos,
            "dataImpressao" to LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
        )
    }
}
