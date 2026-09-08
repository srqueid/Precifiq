package org.example.repository

import org.example.UnidadeCompraInsumo
import org.example.UnidadesCompraInsumoTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

class UnidadeCompraInsumoRepository {

    fun listarPorInsumo(insumoId: Int): List<UnidadeCompraInsumo> = transaction {
        UnidadesCompraInsumoTable
            .select { UnidadesCompraInsumoTable.insumoId eq insumoId }
            .orderBy(UnidadesCompraInsumoTable.criadoEm to SortOrder.ASC)
            .map {
                UnidadeCompraInsumo(
                    id = it[UnidadesCompraInsumoTable.id],
                    insumoId = it[UnidadesCompraInsumoTable.insumoId],
                    nomeEmbalagem = it[UnidadesCompraInsumoTable.nomeEmbalagem],
                    fatorConversao = it[UnidadesCompraInsumoTable.fatorConversao],
                    precoEmbalagem = it[UnidadesCompraInsumoTable.precoEmbalagem],
                    codigoBarras = it[UnidadesCompraInsumoTable.codigoBarras],
                    criadoEm = it[UnidadesCompraInsumoTable.criadoEm]
                )
            }
    }

    fun lerPorId(id: Int): UnidadeCompraInsumo? = transaction {
        UnidadesCompraInsumoTable
            .select { UnidadesCompraInsumoTable.id eq id }
            .singleOrNull()
            ?.let {
                UnidadeCompraInsumo(
                    id = it[UnidadesCompraInsumoTable.id],
                    insumoId = it[UnidadesCompraInsumoTable.insumoId],
                    nomeEmbalagem = it[UnidadesCompraInsumoTable.nomeEmbalagem],
                    fatorConversao = it[UnidadesCompraInsumoTable.fatorConversao],
                    precoEmbalagem = it[UnidadesCompraInsumoTable.precoEmbalagem],
                    codigoBarras = it[UnidadesCompraInsumoTable.codigoBarras],
                    criadoEm = it[UnidadesCompraInsumoTable.criadoEm]
                )
            }
    }

    fun criar(u: UnidadeCompraInsumo): Int = transaction {
        UnidadesCompraInsumoTable.insert {
            it[insumoId] = u.insumoId
            it[nomeEmbalagem] = u.nomeEmbalagem
            it[fatorConversao] = u.fatorConversao
            it[precoEmbalagem] = u.precoEmbalagem
            it[codigoBarras] = u.codigoBarras
            it[criadoEm] = u.criadoEm
        } get UnidadesCompraInsumoTable.id
    }

    fun atualizar(id: Int, u: UnidadeCompraInsumo) = transaction {
        UnidadesCompraInsumoTable.update({ UnidadesCompraInsumoTable.id eq id }) {
            it[nomeEmbalagem] = u.nomeEmbalagem
            it[fatorConversao] = u.fatorConversao
            it[precoEmbalagem] = u.precoEmbalagem
            it[codigoBarras] = u.codigoBarras
        }
    }

    fun deletar(id: Int) = transaction {
        UnidadesCompraInsumoTable.deleteWhere { UnidadesCompraInsumoTable.id eq id }
    }
}
