package org.example.repository

import org.example.EstoqueMinimoInsumoAuxTable
import org.example.Insumo
import org.example.InsumosTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

class InsumoRepository {
    fun lerTodos(): List<Insumo> = transaction {
        val minMap = try {
            EstoqueMinimoInsumoAuxTable.selectAll().associate {
                it[EstoqueMinimoInsumoAuxTable.insumoId] to it[EstoqueMinimoInsumoAuxTable.estoqueMinimo]
            }
        } catch (e: Exception) {
            emptyMap()
        }

        InsumosTable.selectAll().map {
            Insumo(
                id = it[InsumosTable.id],
                nome = it[InsumosTable.nome],
                unidadeMedidaId = it[InsumosTable.unidadeMedidaId],
                quantidadePorEmbalagem = it[InsumosTable.quantidadePorEmbalagem],
                unidadeEmbalagemId = it[InsumosTable.unidadeEmbalagemId],
                fornecedorId = it[InsumosTable.fornecedorId],
                preco = it[InsumosTable.preco],
                isEmbalagem = it[InsumosTable.isEmbalagem],
                estoque = it[InsumosTable.estoque],
                estoqueMinimo = minMap[it[InsumosTable.id]] ?: 0.0,
                dataValidade = it[InsumosTable.dataValidade]?.toString(),
                lote = it[InsumosTable.lote],
                codigoBarras = it[InsumosTable.codigoBarras]
            )
        }
    }

    fun lerPorId(id: Int): Insumo? = transaction {
        val min = try {
            EstoqueMinimoInsumoAuxTable.select { EstoqueMinimoInsumoAuxTable.insumoId eq id }
                .singleOrNull()?.get(EstoqueMinimoInsumoAuxTable.estoqueMinimo) ?: 0.0
        } catch (e: Exception) {
            0.0
        }

        InsumosTable.select { InsumosTable.id eq id }.singleOrNull()?.let {
            Insumo(
                id = it[InsumosTable.id],
                nome = it[InsumosTable.nome],
                unidadeMedidaId = it[InsumosTable.unidadeMedidaId],
                quantidadePorEmbalagem = it[InsumosTable.quantidadePorEmbalagem],
                unidadeEmbalagemId = it[InsumosTable.unidadeEmbalagemId],
                fornecedorId = it[InsumosTable.fornecedorId],
                preco = it[InsumosTable.preco],
                isEmbalagem = it[InsumosTable.isEmbalagem],
                estoque = it[InsumosTable.estoque],
                estoqueMinimo = min,
                dataValidade = it[InsumosTable.dataValidade]?.toString(),
                lote = it[InsumosTable.lote],
                codigoBarras = it[InsumosTable.codigoBarras]
            )
        }
    }

    fun criar(i: Insumo) = transaction {
        val parsedValidade = try {
            i.dataValidade?.takeIf { it.isNotBlank() }?.let { java.time.LocalDate.parse(it.trim()) }
        } catch (e: Exception) {
            null
        }

        val novoId = InsumosTable.insert {
            it[nome] = i.nome
            it[unidadeMedidaId] = i.unidadeMedidaId
            it[quantidadePorEmbalagem] = i.quantidadePorEmbalagem
            it[unidadeEmbalagemId] = i.unidadeEmbalagemId
            it[fornecedorId] = i.fornecedorId
            it[preco] = i.preco
            it[isEmbalagem] = i.isEmbalagem
            it[estoque] = i.estoque
            it[dataValidade] = parsedValidade
            it[lote] = i.lote?.takeIf { l -> l.isNotBlank() }
            it[codigoBarras] = i.codigoBarras?.takeIf { c -> c.isNotBlank() }
        } get InsumosTable.id

        if (i.estoqueMinimo != null && i.estoqueMinimo!! > 0) {
            try {
                EstoqueMinimoInsumoAuxTable.insert {
                    it[insumoId] = novoId
                    it[estoqueMinimo] = i.estoqueMinimo!!
                }
            } catch (e: Exception) {}
        }
    }

    fun atualizar(id: Int, i: Insumo) = transaction {
        val parsedValidade = try {
            i.dataValidade?.takeIf { it.isNotBlank() }?.let { java.time.LocalDate.parse(it.trim()) }
        } catch (e: Exception) {
            null
        }

        InsumosTable.update({ InsumosTable.id eq id }) {
            it[nome] = i.nome
            it[unidadeMedidaId] = i.unidadeMedidaId
            it[quantidadePorEmbalagem] = i.quantidadePorEmbalagem
            it[unidadeEmbalagemId] = i.unidadeEmbalagemId
            it[fornecedorId] = i.fornecedorId
            it[preco] = i.preco
            it[isEmbalagem] = i.isEmbalagem
            it[estoque] = i.estoque
            it[dataValidade] = parsedValidade
            it[lote] = i.lote?.takeIf { l -> l.isNotBlank() }
            it[codigoBarras] = i.codigoBarras?.takeIf { c -> c.isNotBlank() }
        }
        if (i.estoqueMinimo != null) {
            try {
                EstoqueMinimoInsumoAuxTable.deleteWhere { EstoqueMinimoInsumoAuxTable.insumoId eq id }
                EstoqueMinimoInsumoAuxTable.insert {
                    it[insumoId] = id
                    it[estoqueMinimo] = i.estoqueMinimo!!
                }
            } catch (e: Exception) {}
        }
    }

    fun atualizarEstoque(id: Int, novoEstoque: Double) = transaction {
        InsumosTable.update({ InsumosTable.id eq id }) {
            it[estoque] = novoEstoque
        }
    }

    fun deletar(id: Int) = transaction {
        InsumosTable.deleteWhere { SqlExpressionBuilder.run { InsumosTable.id eq id } }
    }
}
