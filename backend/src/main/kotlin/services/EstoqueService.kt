package org.example.services

import org.example.*
import org.example.repository.AppDatabase
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

data class ItemConsumoProducao(
    val insumoId: Int,
    val quantidadeNecessariaBase: Double,
    val isEmbalagem: Boolean = false
)

data class ResultadoMovimentacao(
    val movimentoId: Int,
    val insumoId: Int,
    val insumoNome: String,
    val tipo: String,
    val quantidade: Double,
    val saldoAnterior: Double,
    val novoSaldo: Double,
    val unidadeSigla: String? = null
)

class EstoqueService(private val appDb: AppDatabase) {

    /**
     * Dá baixa de estoque de forma atômica para uma Ordem de Produção ou Produção de Lote.
     * Trava cada insumo com SELECT ... FOR UPDATE, valida saldos e se qualquer um faltar,
     * lança IllegalStateException cancelando toda a transação com rollback.
     */
    fun consumirInsumosParaProducao(
        itens: List<ItemConsumoProducao>,
        ordemProducaoId: Int?,
        usuarioId: Int? = null,
        motivo: String? = null
    ): List<ResultadoMovimentacao> {
        if (itens.isEmpty()) return emptyList()

        return transaction {
            // Ordena os IDs dos insumos para evitar deadlocks caso haja requisições concorrentes
            val itensOrdenados = itens.sortedBy { it.insumoId }
            val resultados = mutableListOf<ResultadoMovimentacao>()

            // 1. Passo de validação com row-level lock (SELECT ... FOR UPDATE)
            for (item in itensOrdenados) {
                val linhaInsumo = InsumosTable
                    .select { InsumosTable.id eq item.insumoId }
                    .forUpdate()
                    .singleOrNull() ?: throw NoSuchElementException("Insumo com ID ${item.insumoId} não foi encontrado.")

                val nomeInsumo = linhaInsumo[InsumosTable.nome]
                val saldoAtual = linhaInsumo[InsumosTable.estoque] ?: 0.0

                if (saldoAtual < item.quantidadeNecessariaBase) {
                    val unidade = appDb.unidadesMedida.lerPorId(linhaInsumo[InsumosTable.unidadeMedidaId])
                    val sigla = unidade?.sigla ?: "un"
                    throw IllegalStateException(
                        "Saldo insuficiente para o insumo '$nomeInsumo'. Disponível: $saldoAtual $sigla, Necessário: ${item.quantidadeNecessariaBase} $sigla"
                    )
                }
            }

            // 2. Passo de débito e gravação no ledger (tudo dentro da mesma transação)
            for (item in itensOrdenados) {
                val linhaInsumo = InsumosTable
                    .select { InsumosTable.id eq item.insumoId }
                    .single()

                val nomeInsumo = linhaInsumo[InsumosTable.nome]
                val saldoAtual = linhaInsumo[InsumosTable.estoque] ?: 0.0
                val novoSaldo = saldoAtual - item.quantidadeNecessariaBase
                val unidade = appDb.unidadesMedida.lerPorId(linhaInsumo[InsumosTable.unidadeMedidaId])

                // Atualiza o saldo desnormalizado
                InsumosTable.update({ InsumosTable.id eq item.insumoId }) {
                    it[estoque] = novoSaldo
                }

                // Registra o movimento na tabela de auditoria
                val movId = MovimentosEstoqueInsumoTable.insert {
                    it[insumoId] = item.insumoId
                    it[tipo] = TipoMovimentoEstoque.SAIDA_PRODUCAO.valor
                    it[quantidade] = item.quantidadeNecessariaBase
                    it[saldoAnterior] = saldoAtual
                    it[saldoPosterior] = novoSaldo
                    it[origemReferencia] = "ORDEM_PRODUCAO"
                    it[referenciaId] = ordemProducaoId
                    it[this.motivo] = motivo ?: if (item.isEmbalagem) "Consumo de Embalagem na Produção" else "Consumo de Receita na Produção"
                    it[criadoEm] = LocalDateTime.now()
                    it[criadoPor] = usuarioId
                } get MovimentosEstoqueInsumoTable.id

                resultados.add(
                    ResultadoMovimentacao(
                        movimentoId = movId,
                        insumoId = item.insumoId,
                        insumoNome = nomeInsumo,
                        tipo = TipoMovimentoEstoque.SAIDA_PRODUCAO.valor,
                        quantidade = item.quantidadeNecessariaBase,
                        saldoAnterior = saldoAtual,
                        novoSaldo = novoSaldo,
                        unidadeSigla = unidade?.sigla
                    )
                )
            }

            resultados
        }
    }

    /**
     * Registra entrada de compra com conversão para a unidade-base (ml, g, un).
     * O fator de conversão é obtido da tabela unidade_compra_insumo, do insumo ou informado manualmente.
     */
    fun registrarEntradaCompra(
        insumoId: Int,
        quantidadeEmbalagens: Double,
        unidadeCompraId: Int? = null,
        fatorManual: Double? = null,
        compraId: Int? = null,
        usuarioId: Int? = null,
        motivo: String? = null
    ): ResultadoMovimentacao {
        require(quantidadeEmbalagens > 0) { "Quantidade de embalagens deve ser maior que zero." }

        return transaction {
            val linhaInsumo = InsumosTable
                .select { InsumosTable.id eq insumoId }
                .forUpdate()
                .singleOrNull() ?: throw NoSuchElementException("Insumo $insumoId não encontrado.")

            // Determinar o fator de conversão
            val fator = when {
                unidadeCompraId != null -> {
                    val uc = UnidadesCompraInsumoTable
                        .select { UnidadesCompraInsumoTable.id eq unidadeCompraId }
                        .singleOrNull()
                    uc?.get(UnidadesCompraInsumoTable.fatorConversao) ?: 1.0
                }
                fatorManual != null && fatorManual > 0 -> fatorManual
                linhaInsumo[InsumosTable.quantidadePorEmbalagem] != null && linhaInsumo[InsumosTable.quantidadePorEmbalagem]!! > 0 -> {
                    linhaInsumo[InsumosTable.quantidadePorEmbalagem]!!
                }
                else -> 1.0
            }

            val quantidadeBase = quantidadeEmbalagens * fator
            val saldoAtual = linhaInsumo[InsumosTable.estoque] ?: 0.0
            val novoSaldo = saldoAtual + quantidadeBase
            val unidade = appDb.unidadesMedida.lerPorId(linhaInsumo[InsumosTable.unidadeMedidaId])

            InsumosTable.update({ InsumosTable.id eq insumoId }) {
                it[estoque] = novoSaldo
            }

            val descMotivo = motivo ?: "Entrada Compra: $quantidadeEmbalagens emb(s) x $fator ${unidade?.sigla ?: "un"}"

            val movId = MovimentosEstoqueInsumoTable.insert {
                it[MovimentosEstoqueInsumoTable.insumoId] = insumoId
                it[tipo] = TipoMovimentoEstoque.ENTRADA_COMPRA.valor
                it[quantidade] = quantidadeBase
                it[saldoAnterior] = saldoAtual
                it[saldoPosterior] = novoSaldo
                it[origemReferencia] = "COMPRA"
                it[referenciaId] = compraId
                it[this.motivo] = descMotivo
                it[criadoEm] = LocalDateTime.now()
                it[criadoPor] = usuarioId
            } get MovimentosEstoqueInsumoTable.id

            ResultadoMovimentacao(
                movimentoId = movId,
                insumoId = insumoId,
                insumoNome = linhaInsumo[InsumosTable.nome],
                tipo = TipoMovimentoEstoque.ENTRADA_COMPRA.valor,
                quantidade = quantidadeBase,
                saldoAnterior = saldoAtual,
                novoSaldo = novoSaldo,
                unidadeSigla = unidade?.sigla
            )
        }
    }

    /**
     * Ajuste de inventário manual (balanço físico / contagem).
     * Registra AJUSTE_INVENTARIO no histórico com a diferença apurada.
     */
    fun ajustarSaldoInventario(
        insumoId: Int,
        novoSaldoFisico: Double,
        usuarioId: Int? = null,
        motivo: String? = null
    ): ResultadoMovimentacao {
        require(novoSaldoFisico >= 0) { "O saldo físico não pode ser negativo." }

        return transaction {
            val linhaInsumo = InsumosTable
                .select { InsumosTable.id eq insumoId }
                .forUpdate()
                .singleOrNull() ?: throw NoSuchElementException("Insumo $insumoId não encontrado.")

            val saldoAtual = linhaInsumo[InsumosTable.estoque] ?: 0.0
            val diferenca = novoSaldoFisico - saldoAtual
            val unidade = appDb.unidadesMedida.lerPorId(linhaInsumo[InsumosTable.unidadeMedidaId])

            InsumosTable.update({ InsumosTable.id eq insumoId }) {
                it[estoque] = novoSaldoFisico
            }

            val descMotivo = motivo ?: "Ajuste de inventário físico: de $saldoAtual para $novoSaldoFisico ${unidade?.sigla ?: "un"}"

            val movId = MovimentosEstoqueInsumoTable.insert {
                it[MovimentosEstoqueInsumoTable.insumoId] = insumoId
                it[tipo] = TipoMovimentoEstoque.AJUSTE_INVENTARIO.valor
                it[quantidade] = Math.abs(diferenca)
                it[saldoAnterior] = saldoAtual
                it[saldoPosterior] = novoSaldoFisico
                it[origemReferencia] = "INVENTARIO"
                it[this.motivo] = descMotivo
                it[criadoEm] = LocalDateTime.now()
                it[criadoPor] = usuarioId
            } get MovimentosEstoqueInsumoTable.id

            ResultadoMovimentacao(
                movimentoId = movId,
                insumoId = insumoId,
                insumoNome = linhaInsumo[InsumosTable.nome],
                tipo = TipoMovimentoEstoque.AJUSTE_INVENTARIO.valor,
                quantidade = Math.abs(diferenca),
                saldoAnterior = saldoAtual,
                novoSaldo = novoSaldoFisico,
                unidadeSigla = unidade?.sigla
            )
        }
    }

    /**
     * Registra perda (quebra de frasco, evaporação, vencimento, contaminação).
     */
    fun registrarPerda(
        insumoId: Int,
        quantidadePerdidaBase: Double,
        usuarioId: Int? = null,
        motivo: String
    ): ResultadoMovimentacao {
        require(quantidadePerdidaBase > 0) { "Quantidade de perda deve ser maior que zero." }
        require(motivo.isNotBlank()) { "O motivo da perda é obrigatório." }

        return transaction {
            val linhaInsumo = InsumosTable
                .select { InsumosTable.id eq insumoId }
                .forUpdate()
                .singleOrNull() ?: throw NoSuchElementException("Insumo $insumoId não encontrado.")

            val saldoAtual = linhaInsumo[InsumosTable.estoque] ?: 0.0
            if (saldoAtual < quantidadePerdidaBase) {
                throw IllegalStateException("Saldo insuficiente para registrar perda de $quantidadePerdidaBase. Saldo atual: $saldoAtual")
            }

            val novoSaldo = saldoAtual - quantidadePerdidaBase
            val unidade = appDb.unidadesMedida.lerPorId(linhaInsumo[InsumosTable.unidadeMedidaId])

            InsumosTable.update({ InsumosTable.id eq insumoId }) {
                it[estoque] = novoSaldo
            }

            val movId = MovimentosEstoqueInsumoTable.insert {
                it[MovimentosEstoqueInsumoTable.insumoId] = insumoId
                it[tipo] = TipoMovimentoEstoque.PERDA.valor
                it[quantidade] = quantidadePerdidaBase
                it[saldoAnterior] = saldoAtual
                it[saldoPosterior] = novoSaldo
                it[origemReferencia] = "PERDA_AVARIA"
                it[this.motivo] = motivo
                it[criadoEm] = LocalDateTime.now()
                it[criadoPor] = usuarioId
            } get MovimentosEstoqueInsumoTable.id

            ResultadoMovimentacao(
                movimentoId = movId,
                insumoId = insumoId,
                insumoNome = linhaInsumo[InsumosTable.nome],
                tipo = TipoMovimentoEstoque.PERDA.valor,
                quantidade = quantidadePerdidaBase,
                saldoAnterior = saldoAtual,
                novoSaldo = novoSaldo,
                unidadeSigla = unidade?.sigla
            )
        }
    }

    /**
     * Estorna um movimento anterior gerando uma contrapartida compensatória (nunca deleta histórico).
     */
    fun estornarMovimento(
        movimentoId: Int,
        usuarioId: Int? = null,
        motivoEstorno: String
    ): ResultadoMovimentacao {
        require(motivoEstorno.isNotBlank()) { "O motivo do estorno é obrigatório." }

        return transaction {
            val movOriginal = MovimentosEstoqueInsumoTable
                .select { MovimentosEstoqueInsumoTable.id eq movimentoId }
                .singleOrNull() ?: throw NoSuchElementException("Movimentação $movimentoId não encontrada.")

            val insumoId = movOriginal[MovimentosEstoqueInsumoTable.insumoId]
            val tipoOriginal = movOriginal[MovimentosEstoqueInsumoTable.tipo]
            val qtdOriginal = movOriginal[MovimentosEstoqueInsumoTable.quantidade]

            val linhaInsumo = InsumosTable
                .select { InsumosTable.id eq insumoId }
                .forUpdate()
                .singleOrNull() ?: throw NoSuchElementException("Insumo $insumoId não encontrado.")

            val saldoAtual = linhaInsumo[InsumosTable.estoque] ?: 0.0
            val unidade = appDb.unidadesMedida.lerPorId(linhaInsumo[InsumosTable.unidadeMedidaId])

            // Se o movimento original foi uma saída (SAIDA_PRODUCAO ou PERDA), o estorno devolve saldo (+)
            // Se foi uma entrada (ENTRADA_COMPRA), o estorno retira saldo (-)
            val novoSaldo = when (tipoOriginal) {
                TipoMovimentoEstoque.SAIDA_PRODUCAO.valor, TipoMovimentoEstoque.PERDA.valor -> saldoAtual + qtdOriginal
                TipoMovimentoEstoque.ENTRADA_COMPRA.valor -> {
                    if (saldoAtual < qtdOriginal) {
                        throw IllegalStateException("Não é possível estornar a entrada: saldo atual ($saldoAtual) é menor que a quantidade da entrada ($qtdOriginal).")
                    }
                    saldoAtual - qtdOriginal
                }
                else -> throw IllegalArgumentException("Movimento do tipo '$tipoOriginal' não pode ser estornado automaticamente.")
            }

            InsumosTable.update({ InsumosTable.id eq insumoId }) {
                it[estoque] = novoSaldo
            }

            val movId = MovimentosEstoqueInsumoTable.insert {
                it[MovimentosEstoqueInsumoTable.insumoId] = insumoId
                it[tipo] = TipoMovimentoEstoque.ESTORNO.valor
                it[quantidade] = qtdOriginal
                it[saldoAnterior] = saldoAtual
                it[saldoPosterior] = novoSaldo
                it[origemReferencia] = "ESTORNO_MOVIMENTO_$movimentoId"
                it[referenciaId] = movimentoId
                it[this.motivo] = "Estorno do movimento #$movimentoId ($tipoOriginal): $motivoEstorno"
                it[criadoEm] = LocalDateTime.now()
                it[criadoPor] = usuarioId
            } get MovimentosEstoqueInsumoTable.id

            ResultadoMovimentacao(
                movimentoId = movId,
                insumoId = insumoId,
                insumoNome = linhaInsumo[InsumosTable.nome],
                tipo = TipoMovimentoEstoque.ESTORNO.valor,
                quantidade = qtdOriginal,
                saldoAnterior = saldoAtual,
                novoSaldo = novoSaldo,
                unidadeSigla = unidade?.sigla
            )
        }
    }
}
