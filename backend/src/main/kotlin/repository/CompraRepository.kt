package org.example.repository

import org.example.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class CompraRepository {
    fun lerTodas(): List<Compra> = transaction {
        ComprasTable.selectAll().map {
            Compra(
                id = it[ComprasTable.id],
                orcamentoId = it[ComprasTable.orcamentoId],
                fornecedorId = it[ComprasTable.fornecedorId],
                justificativa = it[ComprasTable.justificativa],
                dataPrevistaNecessidade = it[ComprasTable.dataPrevistaNecessidade]?.let { instant -> LocalDateTime.ofInstant(instant, ZoneId.systemDefault()) },
                dataCriacao = LocalDateTime.ofInstant(it[ComprasTable.dataCriacao], ZoneId.systemDefault()),
                status = StatusCompra.valueOf(it[ComprasTable.status]),
                valorTotal = it[ComprasTable.valorTotal]
            )
        }
    }

    fun criarCompraManual(req: CriarCompraManualRequest): Int = transaction {
        val totalItens = req.itens.sumOf { it.quantidade * it.precoUnitario }
        val valorTotalFinal = totalItens + req.valorFrete

        val dataNecessidadeInstant = req.dataPrevistaNecessidade?.let { raw ->
            runCatching {
                val normalized = raw.trim().replace(' ', 'T')
                val ldt = runCatching {
                    LocalDateTime.parse(normalized, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                }.getOrElse {
                    LocalDateTime.parse("${normalized}T00:00:00", DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                }
                ldt.atZone(ZoneId.systemDefault()).toInstant()
            }.getOrNull()
        }

        val statusInicial = if (req.receberImediatamente) StatusCompra.RECEBIDO else StatusCompra.PENDENTE

        val compraId = ComprasTable.insert {
            it[fornecedorId] = req.fornecedorId
            it[justificativa] = req.justificativa?.ifBlank { "Compra manual" } ?: "Compra manual"
            it[status] = statusInicial.name
            it[valorTotal] = valorTotalFinal
            it[dataPrevistaNecessidade] = dataNecessidadeInstant
            it[dataCriacao] = java.time.Instant.now()
        } get ComprasTable.id

        req.itens.forEach { itemReq ->
            val rateioFrete = if (totalItens > 0 && req.itens.isNotEmpty()) {
                (itemReq.precoUnitario * itemReq.quantidade / totalItens) * req.valorFrete
            } else 0.0

            val precoComFrete = itemReq.precoUnitario + if (itemReq.quantidade > 0) {
                rateioFrete / itemReq.quantidade
            } else 0.0

            val qtdRecebida = if (req.receberImediatamente) itemReq.quantidade else 0.0

            ItensCompraTable.insert {
                it[this.compraId] = compraId
                it[insumoId] = itemReq.insumoId
                it[quantidadeSolicitada] = itemReq.quantidade
                it[quantidadeComprada] = itemReq.quantidade
                it[quantidadeRecebida] = qtdRecebida
                it[precoUnitario] = if (req.receberImediatamente) precoComFrete else itemReq.precoUnitario
                it[fornecedorSugeridoId] = req.fornecedorId
                it[ativo] = true
            }

            if (req.receberImediatamente) {
                AppDatabase.default.estoque.registrarEntradaCompra(
                    insumoId = itemReq.insumoId,
                    quantidadeEmbalagens = itemReq.quantidade,
                    compraId = compraId,
                    motivo = "Entrada manual compra #$compraId"
                )

                InsumosTable.update({ InsumosTable.id eq itemReq.insumoId }) {
                    it[preco] = precoComFrete
                    if (req.fornecedorId != null) {
                        it[this.fornecedorId] = req.fornecedorId
                    }
                }
            }
        }

        compraId
    }

    fun lerPorId(id: Int): Compra? = transaction {
        ComprasTable.select { ComprasTable.id eq id }.singleOrNull()?.let {
            Compra(
                id = it[ComprasTable.id],
                orcamentoId = it[ComprasTable.orcamentoId],
                fornecedorId = it[ComprasTable.fornecedorId],
                justificativa = it[ComprasTable.justificativa],
                dataPrevistaNecessidade = it[ComprasTable.dataPrevistaNecessidade]?.let { instant -> LocalDateTime.ofInstant(instant, ZoneId.systemDefault()) },
                dataCriacao = LocalDateTime.ofInstant(it[ComprasTable.dataCriacao], ZoneId.systemDefault()),
                status = StatusCompra.valueOf(it[ComprasTable.status]),
                valorTotal = it[ComprasTable.valorTotal]
            )
        }
    }

    fun lerItens(compraId: Int): List<ItemCompra> = transaction {
            ItensCompraTable.select { ItensCompraTable.compraId eq compraId }.map {
                ItemCompra(
                    id = it[ItensCompraTable.id],
                    compraId = it[ItensCompraTable.compraId],
                    itemOrcamentoId = it[ItensCompraTable.itemOrcamentoId],
                    insumoId = it[ItensCompraTable.insumoId],
                    quantidadeSolicitada = it[ItensCompraTable.quantidadeSolicitada],
                    quantidadeComprada = it[ItensCompraTable.quantidadeComprada],
                    quantidadeRecebida = it[ItensCompraTable.quantidadeRecebida],
                    precoUnitario = it[ItensCompraTable.precoUnitario],
                    fornecedorSugeridoId = it[ItensCompraTable.fornecedorSugeridoId],
                    ativo = it[ItensCompraTable.ativo]
                )
            }
        }

    fun lerItensComInsumo(compraId: Int): List<ItemCompraComInsumoDTO> = transaction {
        val itemRows = ItensCompraTable
            .select { ItensCompraTable.compraId eq compraId }
            .orderBy(ItensCompraTable.id)
            .toList()

        val insumoIds = itemRows.map { it[ItensCompraTable.insumoId] }
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

        itemRows.map { item ->
            val insumo = insumosById[item[ItensCompraTable.insumoId]]
            val unidade = insumo?.let { unidadesById[it[InsumosTable.unidadeMedidaId]] }

            ItemCompraComInsumoDTO(
                id = item[ItensCompraTable.id],
                compraId = item[ItensCompraTable.compraId],
                itemOrcamentoId = item[ItensCompraTable.itemOrcamentoId],
                insumoId = item[ItensCompraTable.insumoId],
                insumoNome = insumo?.get(InsumosTable.nome) ?: "Insumo #${item[ItensCompraTable.insumoId]}",
                unidadeSigla = unidade?.get(UnidadesMedidaTable.sigla),
                quantidadeSolicitada = item[ItensCompraTable.quantidadeSolicitada],
                quantidadeComprada = item[ItensCompraTable.quantidadeComprada],
                quantidadeRecebida = item[ItensCompraTable.quantidadeRecebida],
                precoUnitario = item[ItensCompraTable.precoUnitario],
                fornecedorSugeridoId = item[ItensCompraTable.fornecedorSugeridoId],
                ativo = item[ItensCompraTable.ativo]
            )
        }
    }

    fun atualizarStatus(id: Int, status: StatusCompra) = transaction {
        ComprasTable.update({ ComprasTable.id eq id }) {
            it[ComprasTable.status] = status.name
        }
    }

    fun receberCompra(compraId: Int, valorFreteFinal: Double, itensRecebidos: List<ReceberItemCompraRequest>): Boolean = transaction {
        // Busca a compra
        val compra = ComprasTable.select { ComprasTable.id eq compraId }.singleOrNull() ?: return@transaction false

        // Busca todos os itens da compra
        val itens = ItensCompraTable.select { ItensCompraTable.compraId eq compraId }.toList()

        if (itens.isEmpty() || itensRecebidos.size != itens.size || itensRecebidos.map { it.id }.distinct().size != itens.size) return@transaction false

        // Calcula o total dos itens (sem frete)
        val totalItens = itens.sumOf { it[ItensCompraTable.precoUnitario] * it[ItensCompraTable.quantidadeSolicitada] }
        val itensById = itens.associateBy { it[ItensCompraTable.id] }

        // Valida todos os itens antes de aplicar qualquer atualização
        itensRecebidos.forEach { itemRecebido ->
            val itemRow = itensById[itemRecebido.id] ?: return@transaction false
            val quantidadeSolicitada = itemRow[ItensCompraTable.quantidadeSolicitada]
            val quantidadeRecebida = itemRecebido.quantidadeRecebida

            if (quantidadeRecebida <= 0 || quantidadeRecebida > quantidadeSolicitada) {
                return@transaction false
            }
        }

        // Rateia o frete proporcionalmente entre os itens
        itensRecebidos.forEach { itemRecebido ->
            val itemRow = itensById[itemRecebido.id] ?: return@transaction false
            val quantidadeSolicitada = itemRow[ItensCompraTable.quantidadeSolicitada]
            val quantidadeRecebida = itemRecebido.quantidadeRecebida
            val precoUnitarioOriginal = itemRow[ItensCompraTable.precoUnitario]
            val itemId = itemRow[ItensCompraTable.id]

            // Calcula o rateio do frete para este item
            val rateioFrete = if (totalItens > 0 && quantidadeSolicitada > 0) {
                (precoUnitarioOriginal * quantidadeSolicitada / totalItens) * valorFreteFinal
            } else 0.0

            // Atualiza o preço unitário com o rateio do frete
            val precoUnitarioComFrete = precoUnitarioOriginal + if (quantidadeSolicitada > 0) {
                rateioFrete / quantidadeSolicitada
            } else {
                0.0
            }

            // Atualiza o item de compra
            ItensCompraTable.update({ ItensCompraTable.id eq itemId }) {
                it[ItensCompraTable.quantidadeRecebida] = quantidadeRecebida
                it[ItensCompraTable.precoUnitario] = precoUnitarioComFrete
            }

            // Atualiza o estoque e o fornecedor_id do insumo com lock e registro no ledger
            val insumoId = itemRow[ItensCompraTable.insumoId]
            val insumoLinha = InsumosTable.select { InsumosTable.id eq insumoId }.forUpdate().singleOrNull()
            val estoqueAtual = insumoLinha?.get(InsumosTable.estoque) ?: 0.0
            val fator = if (insumoLinha?.get(InsumosTable.quantidadePorEmbalagem) != null && insumoLinha[InsumosTable.quantidadePorEmbalagem]!! > 0) {
                insumoLinha[InsumosTable.quantidadePorEmbalagem]!!
            } else 1.0
            val quantidadeBase = quantidadeRecebida * fator
            val novoEstoque = estoqueAtual + quantidadeBase

            InsumosTable.update({ InsumosTable.id eq insumoId }) {
                it[InsumosTable.estoque] = novoEstoque
                it[InsumosTable.preco] = precoUnitarioComFrete
                // Atualiza o fornecedor_id do insumo com o fornecedor da compra
                it[InsumosTable.fornecedorId] = compra[ComprasTable.fornecedorId] ?: itemRow[ItensCompraTable.fornecedorSugeridoId]
            }

            // Registra no ledger de movimentações
            MovimentosEstoqueInsumoTable.insert {
                it[MovimentosEstoqueInsumoTable.insumoId] = insumoId
                it[tipo] = TipoMovimentoEstoque.ENTRADA_COMPRA.valor
                it[quantidade] = quantidadeBase
                it[saldoAnterior] = estoqueAtual
                it[saldoPosterior] = novoEstoque
                it[origemReferencia] = "COMPRA"
                it[referenciaId] = compraId
                it[motivo] = "Recebimento Compra #$compraId ($quantidadeRecebida emb(s) x $fator)"
                it[criadoEm] = LocalDateTime.now()
            }
        }

        // Atualiza o status da compra para RECEBIDO
        ComprasTable.update({ ComprasTable.id eq compraId }) {
            it[ComprasTable.status] = StatusCompra.RECEBIDO.name
        }

        true
    }

    fun deletar(id: Int) = transaction {
        ComprasTable.deleteWhere { Op.build { ComprasTable.id eq id } }
    }

    fun lerRelatorioCompra(id: Int): CompraRelatorio? = transaction {
        val compraRow = (ComprasTable leftJoin FornecedoresTable)
            .select { ComprasTable.id eq id }
            .singleOrNull() ?: return@transaction null

        val itensRows = ItensCompraTable
            .select { ItensCompraTable.compraId eq id }
            .orderBy(ItensCompraTable.id)
            .toList()

        val insumoIds = itensRows.map { it[ItensCompraTable.insumoId] }.distinct()
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

        val itensRelatorio = itensRows.map { item ->
            val insumo = insumosById[item[ItensCompraTable.insumoId]]
            val unidade = insumo?.let { unidadesById[it[InsumosTable.unidadeMedidaId]] }

            ItemCompraComInsumoDTO(
                id = item[ItensCompraTable.id],
                compraId = item[ItensCompraTable.compraId],
                itemOrcamentoId = item[ItensCompraTable.itemOrcamentoId],
                insumoId = item[ItensCompraTable.insumoId],
                insumoNome = insumo?.get(InsumosTable.nome) ?: "Insumo #${item[ItensCompraTable.insumoId]}",
                unidadeSigla = unidade?.get(UnidadesMedidaTable.sigla),
                quantidadeSolicitada = item[ItensCompraTable.quantidadeSolicitada],
                quantidadeComprada = item[ItensCompraTable.quantidadeComprada],
                quantidadeRecebida = item[ItensCompraTable.quantidadeRecebida],
                precoUnitario = item[ItensCompraTable.precoUnitario],
                fornecedorSugeridoId = item[ItensCompraTable.fornecedorSugeridoId],
                ativo = item[ItensCompraTable.ativo]
            )
        }

        CompraRelatorio(
            id = compraRow[ComprasTable.id],
            orcamentoId = compraRow[ComprasTable.orcamentoId],
            fornecedorId = compraRow[ComprasTable.fornecedorId],
            fornecedorNome = compraRow[FornecedoresTable.nome],
            justificativa = compraRow[ComprasTable.justificativa],
            dataPrevistaNecessidade = compraRow[ComprasTable.dataPrevistaNecessidade]?.let { instant ->
                LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
            },
            dataCriacao = LocalDateTime.ofInstant(compraRow[ComprasTable.dataCriacao], ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")),
            status = compraRow[ComprasTable.status],
            valorTotal = compraRow[ComprasTable.valorTotal],
            itens = itensRelatorio
        )
    }

    fun lerParaImpressaoCompra(id: Int): Map<String, Any>? = transaction {
        val relatorio = lerRelatorioCompra(id) ?: return@transaction null

        mapOf(
            "compra" to relatorio,
            "dataImpressao" to LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
        )
    }
}
