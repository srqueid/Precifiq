package org.example.repository

import org.example.InsumosTable
import org.example.MovimentoEstoqueInsumo
import org.example.MovimentosEstoqueInsumoTable
import org.example.UnidadesMedidaTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

class MovimentoEstoqueRepository {

    fun registrarMovimento(movimento: MovimentoEstoqueInsumo): Int = transaction {
        MovimentosEstoqueInsumoTable.insert {
            it[insumoId] = movimento.insumoId
            it[tipo] = movimento.tipo
            it[quantidade] = movimento.quantidade
            it[saldoAnterior] = movimento.saldoAnterior
            it[saldoPosterior] = movimento.saldoPosterior
            it[origemReferencia] = movimento.origemReferencia
            it[referenciaId] = movimento.referenciaId
            it[motivo] = movimento.motivo
            it[criadoEm] = movimento.criadoEm
            it[criadoPor] = movimento.criadoPor
        } get MovimentosEstoqueInsumoTable.id
    }

    fun listarPorInsumo(insumoId: Int, limit: Int = 100): List<MovimentoEstoqueInsumo> = transaction {
        MovimentosEstoqueInsumoTable
            .join(InsumosTable, JoinType.INNER, MovimentosEstoqueInsumoTable.insumoId, InsumosTable.id)
            .join(UnidadesMedidaTable, JoinType.LEFT, InsumosTable.unidadeMedidaId, UnidadesMedidaTable.id)
            .select { MovimentosEstoqueInsumoTable.insumoId eq insumoId }
            .orderBy(MovimentosEstoqueInsumoTable.criadoEm to SortOrder.DESC)
            .limit(limit)
            .map {
                MovimentoEstoqueInsumo(
                    id = it[MovimentosEstoqueInsumoTable.id],
                    insumoId = it[MovimentosEstoqueInsumoTable.insumoId],
                    tipo = it[MovimentosEstoqueInsumoTable.tipo],
                    quantidade = it[MovimentosEstoqueInsumoTable.quantidade],
                    saldoAnterior = it[MovimentosEstoqueInsumoTable.saldoAnterior],
                    saldoPosterior = it[MovimentosEstoqueInsumoTable.saldoPosterior],
                    origemReferencia = it[MovimentosEstoqueInsumoTable.origemReferencia],
                    referenciaId = it[MovimentosEstoqueInsumoTable.referenciaId],
                    motivo = it[MovimentosEstoqueInsumoTable.motivo],
                    criadoEm = it[MovimentosEstoqueInsumoTable.criadoEm],
                    criadoPor = it[MovimentosEstoqueInsumoTable.criadoPor],
                    insumoNome = it[InsumosTable.nome],
                    unidadeSigla = it.getOrNull(UnidadesMedidaTable.sigla)
                )
            }
    }

    fun listarTodos(limit: Int = 200): List<MovimentoEstoqueInsumo> = transaction {
        MovimentosEstoqueInsumoTable
            .join(InsumosTable, JoinType.INNER, MovimentosEstoqueInsumoTable.insumoId, InsumosTable.id)
            .join(UnidadesMedidaTable, JoinType.LEFT, InsumosTable.unidadeMedidaId, UnidadesMedidaTable.id)
            .selectAll()
            .orderBy(MovimentosEstoqueInsumoTable.criadoEm to SortOrder.DESC)
            .limit(limit)
            .map {
                MovimentoEstoqueInsumo(
                    id = it[MovimentosEstoqueInsumoTable.id],
                    insumoId = it[MovimentosEstoqueInsumoTable.insumoId],
                    tipo = it[MovimentosEstoqueInsumoTable.tipo],
                    quantidade = it[MovimentosEstoqueInsumoTable.quantidade],
                    saldoAnterior = it[MovimentosEstoqueInsumoTable.saldoAnterior],
                    saldoPosterior = it[MovimentosEstoqueInsumoTable.saldoPosterior],
                    origemReferencia = it[MovimentosEstoqueInsumoTable.origemReferencia],
                    referenciaId = it[MovimentosEstoqueInsumoTable.referenciaId],
                    motivo = it[MovimentosEstoqueInsumoTable.motivo],
                    criadoEm = it[MovimentosEstoqueInsumoTable.criadoEm],
                    criadoPor = it[MovimentosEstoqueInsumoTable.criadoPor],
                    insumoNome = it[InsumosTable.nome],
                    unidadeSigla = it.getOrNull(UnidadesMedidaTable.sigla)
                )
            }
    }
}
