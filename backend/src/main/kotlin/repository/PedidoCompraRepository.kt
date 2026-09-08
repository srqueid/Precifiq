package org.example.repository

import org.example.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class ItemNovoPedidoDTO(
    val itemOrcamentoId: Int,
    val insumoId: Int?,
    val quantidade: Double,
    val precoUnitario: Double
)

data class NovoPedidoCompraDTO(
    val fornecedorId: Int,
    val formaPagamento: FormaPagamento,
    val valorFrete: Double,
    val itens: List<ItemNovoPedidoDTO>
)

class PedidoCompraRepository {
    private fun parsePrazoRecebimento(raw: String): LocalDateTime {
        val normalized = raw.trim()
        if (normalized.isBlank()) return LocalDateTime.now()

        val dateTimeValue = normalized.replace(' ', 'T')
        return try {
            LocalDateTime.parse(dateTimeValue, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        } catch (_: Exception) {
            try {
                LocalDateTime.parse("${normalized}T00:00:00", DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            } catch (_: Exception) {
                Regex("""\d+""")
                    .find(normalized)
                    ?.value
                    ?.toIntOrNull()
                    ?.let { days -> LocalDateTime.now().plusDays(days.toLong()) }
                    ?: LocalDateTime.now()
            }
        }
    }

    fun criarPedidosDeCompra(orcamentoId: Int, pedidos: List<NovoPedidoCompraDTO>): List<Int> = transaction {
        val pedidosIds = mutableListOf<Int>()

        // Itera sobre a lista gerando um pedido isolado para cada fornecedor selecionado
        for (pedido in pedidos) {
            val valorTotalItens = pedido.itens.sumOf { it.quantidade * it.precoUnitario }
            val valorFinalConfirmado = valorTotalItens + pedido.valorFrete

            val pedidoId = PedidosCompraTable.insert {
                it[PedidosCompraTable.orcamentoId] = orcamentoId
                it[PedidosCompraTable.fornecedorId] = pedido.fornecedorId
                it[PedidosCompraTable.dataConfirmacao] = LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()
                it[PedidosCompraTable.valorTotalItens] = valorTotalItens
                it[PedidosCompraTable.valorFrete] = pedido.valorFrete
                it[PedidosCompraTable.valorFinalConfirmado] = valorFinalConfirmado
                it[PedidosCompraTable.formaPagamento] = pedido.formaPagamento.name
            }[PedidosCompraTable.id]

            // Insere os itens vinculados apenas a este fornecedor
            for (item in pedido.itens) {
                PedidoCompraItensTable.insert {
                    it[PedidoCompraItensTable.pedidoCompraId] = pedidoId
                    it[PedidoCompraItensTable.itemOrcamentoId] = item.itemOrcamentoId
                    it[PedidoCompraItensTable.insumoId] = item.insumoId
                    it[PedidoCompraItensTable.quantidade] = item.quantidade
                    it[PedidoCompraItensTable.precoUnitario] = item.precoUnitario
                }

                // Marca o item do orçamento como inativo para "retirar" ele da lista de itens pendentes de compra.
                ItensOrcamentoTable.update({ ItensOrcamentoTable.id eq item.itemOrcamentoId }) {
                    it[ItensOrcamentoTable.ativo] = false
                }
            }

            pedidosIds.add(pedidoId)
        }

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

        pedidosIds
    }

    fun lerTodos(): List<PedidoCompra> = transaction {
        PedidosCompraTable.selectAll().map {
            PedidoCompra(
                id = it[PedidosCompraTable.id],
                orcamentoId = it[PedidosCompraTable.orcamentoId],
                fornecedorId = it[PedidosCompraTable.fornecedorId],
                dataConfirmacao = LocalDateTime.ofInstant(it[PedidosCompraTable.dataConfirmacao], ZoneId.systemDefault()),
                valorTotalItens = it[PedidosCompraTable.valorTotalItens],
                valorFrete = it[PedidosCompraTable.valorFrete],
                valorFinalConfirmado = it[PedidosCompraTable.valorFinalConfirmado],
                formaPagamento = FormaPagamento.valueOf(it[PedidosCompraTable.formaPagamento])
            )
        }
    }

    fun lerComFornecedor(id: Int): PedidoCompraComFornecedorDTO? = transaction {
        val pedidoRow = (PedidosCompraTable innerJoin FornecedoresTable)
            .select { PedidosCompraTable.id eq id }
            .singleOrNull()
            ?: return@transaction null

        val itensPedidoRows = PedidoCompraItensTable
            .select { PedidoCompraItensTable.pedidoCompraId eq id }
            .orderBy(PedidoCompraItensTable.id)
            .toList()
        val insumoIds = itensPedidoRows.mapNotNull { it[PedidoCompraItensTable.insumoId] }
        val insumosById = if (insumoIds.isEmpty()) {
            emptyMap<Int, ResultRow>()
        } else {
            InsumosTable
                .select { InsumosTable.id inList insumoIds }
                .associateBy { it[InsumosTable.id] }
        }
        val itensPedido = itensPedidoRows.map { row ->
            val quantidade = row[PedidoCompraItensTable.quantidade]
            val precoUnitario = row[PedidoCompraItensTable.precoUnitario]
            val insumoId = row[PedidoCompraItensTable.insumoId] ?: 0

            PedidoCompraItemDTO(
                id = row[PedidoCompraItensTable.id],
                itemOrcamentoId = row[PedidoCompraItensTable.itemOrcamentoId],
                insumoId = insumoId,
                insumoNome = insumosById[insumoId]?.get(InsumosTable.nome),
                quantidade = quantidade,
                precoUnitario = precoUnitario,
                total = quantidade * precoUnitario
            )
        }

        PedidoCompraComFornecedorDTO(
            id = pedidoRow[PedidosCompraTable.id],
            orcamentoId = pedidoRow[PedidosCompraTable.orcamentoId],
            fornecedor = FornecedorPedidoDTO(
                id = pedidoRow[FornecedoresTable.id],
                nome = pedidoRow[FornecedoresTable.nome],
                nomeFantasia = pedidoRow[FornecedoresTable.nomeFantasia],
                cnpjCpf = pedidoRow[FornecedoresTable.cnpjCpf],
                mnemonico = pedidoRow[FornecedoresTable.mnemonico],
                enderecoCompleto = pedidoRow[FornecedoresTable.enderecoCompleto],
                cep = pedidoRow[FornecedoresTable.cep],
                uf = pedidoRow[FornecedoresTable.uf],
                email = pedidoRow[FornecedoresTable.email],
                telefones = pedidoRow[FornecedoresTable.telefones],
                banco = pedidoRow[FornecedoresTable.banco],
                agencia = pedidoRow[FornecedoresTable.agencia],
                contaCorrente = pedidoRow[FornecedoresTable.contaCorrente],
                chavePix = pedidoRow[FornecedoresTable.chavePix],
                categoria = pedidoRow[FornecedoresTable.categoria],
                prazoPagamentoPadrao = pedidoRow[FornecedoresTable.prazoPagamentoPadrao],
                historicoAtendimento = pedidoRow[FornecedoresTable.historicoAtendimento],
                nomeEmpresa = pedidoRow[FornecedoresTable.nomeEmpresa]
            ),
            dataConfirmacao = LocalDateTime.ofInstant(pedidoRow[PedidosCompraTable.dataConfirmacao], ZoneId.systemDefault()),
            valorTotalItens = pedidoRow[PedidosCompraTable.valorTotalItens],
            valorFrete = pedidoRow[PedidosCompraTable.valorFrete],
            valorFinalConfirmado = pedidoRow[PedidosCompraTable.valorFinalConfirmado],
            formaPagamento = FormaPagamento.valueOf(pedidoRow[PedidosCompraTable.formaPagamento]),
            itens = itensPedido
        )
    }

    fun lerTodosComMeta(): List<PedidoCompraView> = transaction {
        (PedidosCompraTable innerJoin OrcamentosCompraTable leftJoin FornecedoresTable)
            .selectAll()
            .map {
                PedidoCompraView(
                    id = it[PedidosCompraTable.id],
                    orcamentoId = it[PedidosCompraTable.orcamentoId],
                    orcamentoTitulo = it[OrcamentosCompraTable.titulo],
                    fornecedorId = it[PedidosCompraTable.fornecedorId],
                    fornecedorNome = it[FornecedoresTable.nome] ?: "",
                    dataConfirmacao = LocalDateTime.ofInstant(it[PedidosCompraTable.dataConfirmacao], ZoneId.systemDefault()),
                    valorTotalItens = it[PedidosCompraTable.valorTotalItens],
                    valorFrete = it[PedidosCompraTable.valorFrete],
                    valorFinalConfirmado = it[PedidosCompraTable.valorFinalConfirmado],
                    formaPagamento = FormaPagamento.valueOf(it[PedidosCompraTable.formaPagamento])
                )
            }
    }

    fun atualizarFrete(id: Int, novoFrete: Double) = transaction {
        val pedido = PedidosCompraTable.select { PedidosCompraTable.id eq id }.singleOrNull() ?: return@transaction
        val valorItens = pedido[PedidosCompraTable.valorTotalItens]
        
        PedidosCompraTable.update({ PedidosCompraTable.id eq id }) {
            it[PedidosCompraTable.valorFrete] = novoFrete
            it[PedidosCompraTable.valorFinalConfirmado] = valorItens + novoFrete
        }
    }

    fun retornarParaOrcamento(pedidoId: Int) = transaction {
        val pedido = PedidosCompraTable.select { PedidosCompraTable.id eq pedidoId }.singleOrNull() ?: return@transaction
        val orcamentoId = pedido[PedidosCompraTable.orcamentoId]
        val itensDoPedido = PedidoCompraItensTable
            .select { PedidoCompraItensTable.pedidoCompraId eq pedidoId }
            .map { it[PedidoCompraItensTable.itemOrcamentoId] }

        PedidosCompraTable.deleteWhere { Op.build { PedidosCompraTable.id eq pedidoId } }

        itensDoPedido.forEach { itemId ->
            ItensOrcamentoTable.update({ ItensOrcamentoTable.id eq itemId }) {
                it[ItensOrcamentoTable.ativo] = true
            }
        }

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

    fun converterParaCompra(pedidoId: Int, formaPagamento: FormaPagamento, prazoRecebimento: String?) = transaction {
        val pedido = PedidosCompraTable.select { PedidosCompraTable.id eq pedidoId }.singleOrNull() ?: return@transaction
        val orcamentoId = pedido[PedidosCompraTable.orcamentoId]
        val fornecedorId = pedido[PedidosCompraTable.fornecedorId]
        val valorTotalItens = pedido[PedidosCompraTable.valorTotalItens]
        val valorFrete = pedido[PedidosCompraTable.valorFrete]
        val valorFinalConfirmado = pedido[PedidosCompraTable.valorFinalConfirmado]

        val compraId = ComprasTable.insert {
            it[ComprasTable.orcamentoId] = orcamentoId
            it[ComprasTable.fornecedorId] = fornecedorId
            it[ComprasTable.justificativa] = "Convertido do pedido #$pedidoId"
            it[ComprasTable.dataPrevistaNecessidade] = prazoRecebimento?.let { raw ->
                parsePrazoRecebimento(raw).atZone(ZoneId.systemDefault()).toInstant()
            }
            it[ComprasTable.dataCriacao] = LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()
            it[ComprasTable.status] = StatusCompra.PENDENTE.name
            it[ComprasTable.valorTotal] = valorFinalConfirmado
        }[ComprasTable.id]

        val itensPedido = PedidoCompraItensTable.select { PedidoCompraItensTable.pedidoCompraId eq pedidoId }.toList()

        for (itemPedido in itensPedido) {
            val itemOrcamentoId = itemPedido[PedidoCompraItensTable.itemOrcamentoId]
            val itemOrcamento = ItensOrcamentoTable.select { ItensOrcamentoTable.id eq itemOrcamentoId }.singleOrNull()
            val insumoId = itemPedido[PedidoCompraItensTable.insumoId]
                ?: itemOrcamento?.get(ItensOrcamentoTable.insumoId)
                ?: throw Exception("Insumo não informado no pedido #$pedidoId")

            ItensCompraTable.insert {
                it[ItensCompraTable.compraId] = compraId
                it[ItensCompraTable.itemOrcamentoId] = itemOrcamentoId
                it[ItensCompraTable.insumoId] = insumoId
                it[ItensCompraTable.quantidadeSolicitada] = itemPedido[PedidoCompraItensTable.quantidade]
                it[ItensCompraTable.quantidadeComprada] = 0.0
                it[ItensCompraTable.quantidadeRecebida] = 0.0
                it[ItensCompraTable.precoUnitario] = itemPedido[PedidoCompraItensTable.precoUnitario]
                it[ItensCompraTable.fornecedorSugeridoId] = fornecedorId
            }
        }

        PedidoCompraItensTable.deleteWhere { Op.build { PedidoCompraItensTable.pedidoCompraId eq pedidoId } }
        PedidosCompraTable.deleteWhere { Op.build { PedidosCompraTable.id eq pedidoId } }

        val itensAtivos = ItensOrcamentoTable.select { (ItensOrcamentoTable.orcamentoId eq orcamentoId) and (ItensOrcamentoTable.ativo eq true) }.toList()
        val pedidosExistentes = PedidosCompraTable.select { PedidosCompraTable.orcamentoId eq orcamentoId }.toList()
        val novoStatus = when {
            itensAtivos.isNotEmpty() && pedidosExistentes.isNotEmpty() -> StatusOrcamento.PEDIDO_PARCIAL
            itensAtivos.isNotEmpty() -> StatusOrcamento.EM_ORCAMENTO
            pedidosExistentes.isNotEmpty() -> StatusOrcamento.COMPRA_APROVADA
            else -> StatusOrcamento.COMPRA_APROVADA
        }

        OrcamentosCompraTable.update({ OrcamentosCompraTable.id eq orcamentoId }) {
            it[OrcamentosCompraTable.status] = novoStatus.name
        }
    }

    fun lerRelatorioPedido(id: Int): PedidoCompraRelatorio? = transaction {
        val pedidoRow = (PedidosCompraTable innerJoin OrcamentosCompraTable innerJoin FornecedoresTable)
            .select { PedidosCompraTable.id eq id }
            .singleOrNull() ?: return@transaction null

        val itensPedidoRows = PedidoCompraItensTable
            .select { PedidoCompraItensTable.pedidoCompraId eq id }
            .orderBy(PedidoCompraItensTable.id)
            .toList()

        val insumoIds = itensPedidoRows.mapNotNull { it[PedidoCompraItensTable.insumoId] }
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

        val itensRelatorio = itensPedidoRows.map { row ->
            val insumoId = row[PedidoCompraItensTable.insumoId] ?: 0
            val insumo = insumosById[insumoId]
            val unidade = insumo?.let { unidadesById[it[InsumosTable.unidadeMedidaId]] }

            PedidoCompraItemDTO(
                id = row[PedidoCompraItensTable.id],
                itemOrcamentoId = row[PedidoCompraItensTable.itemOrcamentoId],
                insumoId = insumoId,
                insumoNome = insumo?.get(InsumosTable.nome) ?: "Insumo #$insumoId",
                quantidade = row[PedidoCompraItensTable.quantidade],
                precoUnitario = row[PedidoCompraItensTable.precoUnitario],
                total = row[PedidoCompraItensTable.quantidade] * row[PedidoCompraItensTable.precoUnitario]
            )
        }

        PedidoCompraRelatorio(
            id = pedidoRow[PedidosCompraTable.id],
            orcamentoId = pedidoRow[PedidosCompraTable.orcamentoId],
            orcamentoTitulo = pedidoRow[OrcamentosCompraTable.titulo],
            fornecedorId = pedidoRow[PedidosCompraTable.fornecedorId],
            fornecedorNome = pedidoRow[FornecedoresTable.nome],
            fornecedorDados = FornecedorPedidoDTO(
                id = pedidoRow[FornecedoresTable.id],
                nome = pedidoRow[FornecedoresTable.nome],
                nomeFantasia = pedidoRow[FornecedoresTable.nomeFantasia],
                cnpjCpf = pedidoRow[FornecedoresTable.cnpjCpf],
                mnemonico = pedidoRow[FornecedoresTable.mnemonico],
                enderecoCompleto = pedidoRow[FornecedoresTable.enderecoCompleto],
                cep = pedidoRow[FornecedoresTable.cep],
                uf = pedidoRow[FornecedoresTable.uf],
                email = pedidoRow[FornecedoresTable.email],
                telefones = pedidoRow[FornecedoresTable.telefones],
                banco = pedidoRow[FornecedoresTable.banco],
                agencia = pedidoRow[FornecedoresTable.agencia],
                contaCorrente = pedidoRow[FornecedoresTable.contaCorrente],
                chavePix = pedidoRow[FornecedoresTable.chavePix],
                categoria = pedidoRow[FornecedoresTable.categoria],
                prazoPagamentoPadrao = pedidoRow[FornecedoresTable.prazoPagamentoPadrao],
                historicoAtendimento = pedidoRow[FornecedoresTable.historicoAtendimento],
                nomeEmpresa = pedidoRow[FornecedoresTable.nomeEmpresa]
            ),
            dataConfirmacao = LocalDateTime.ofInstant(pedidoRow[PedidosCompraTable.dataConfirmacao], ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")),
            valorTotalItens = pedidoRow[PedidosCompraTable.valorTotalItens],
            valorFrete = pedidoRow[PedidosCompraTable.valorFrete],
            valorFinalConfirmado = pedidoRow[PedidosCompraTable.valorFinalConfirmado],
            formaPagamento = pedidoRow[PedidosCompraTable.formaPagamento],
            itens = itensRelatorio
        )
    }

    fun lerParaImpressaoPedido(id: Int): Map<String, Any>? = transaction {
        val relatorio = lerRelatorioPedido(id) ?: return@transaction null

        mapOf(
            "pedido" to relatorio,
            "dataImpressao" to LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
        )
    }
}
