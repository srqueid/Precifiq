package org.example.repository

import org.example.InsumosTable
import org.example.TipoInsumo
import org.example.TiposInsumoTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

class TipoInsumoRepository {

    fun lerTodos(): List<TipoInsumo> = transaction {
        val counts = try {
            InsumosTable.selectAll()
                .groupBy { it[InsumosTable.tipoInsumoId] }
                .mapValues { it.value.size.toLong() }
        } catch (e: Exception) {
            emptyMap()
        }

        TiposInsumoTable.selectAll().orderBy(TiposInsumoTable.id to SortOrder.ASC).map {
            val id = it[TiposInsumoTable.id]
            TipoInsumo(
                id = id,
                nome = it[TiposInsumoTable.nome],
                descricao = it[TiposInsumoTable.descricao],
                isEmbalagem = it[TiposInsumoTable.isEmbalagem],
                insumosVinculadosCount = counts[id] ?: 0L
            )
        }
    }

    fun lerPorId(id: Int): TipoInsumo? = transaction {
        val count = try {
            InsumosTable.select { InsumosTable.tipoInsumoId eq id }.count()
        } catch (e: Exception) {
            0L
        }

        TiposInsumoTable.select { TiposInsumoTable.id eq id }.singleOrNull()?.let {
            TipoInsumo(
                id = it[TiposInsumoTable.id],
                nome = it[TiposInsumoTable.nome],
                descricao = it[TiposInsumoTable.descricao],
                isEmbalagem = it[TiposInsumoTable.isEmbalagem],
                insumosVinculadosCount = count
            )
        }
    }

    fun criar(tipo: TipoInsumo): Int = transaction {
        TiposInsumoTable.insert {
            it[nome] = tipo.nome.trim()
            it[descricao] = tipo.descricao?.trim()?.takeIf { d -> d.isNotBlank() }
            it[isEmbalagem] = tipo.isEmbalagem
        } get TiposInsumoTable.id
    }

    fun atualizar(id: Int, nome: String, descricao: String?, isEmbalagem: Boolean) = transaction {
        TiposInsumoTable.update({ TiposInsumoTable.id eq id }) {
            it[TiposInsumoTable.nome] = nome.trim()
            it[TiposInsumoTable.descricao] = descricao?.trim()?.takeIf { d -> d.isNotBlank() }
            it[TiposInsumoTable.isEmbalagem] = isEmbalagem
        }
        // Opcional: manter insumos vinculados alinhados caso a natureza de embalagem mude
        InsumosTable.update({ InsumosTable.tipoInsumoId eq id }) {
            it[InsumosTable.isEmbalagem] = isEmbalagem
        }
    }

    fun contarInsumosVinculados(id: Int): Long = transaction {
        InsumosTable.select { InsumosTable.tipoInsumoId eq id }.count()
    }

    fun deletar(id: Int): Boolean = transaction {
        val vinculados = contarInsumosVinculados(id)
        if (vinculados > 0) {
            throw IllegalStateException("Não é possível excluir o tipo pois existem $vinculados insumo(s) vinculado(s) a ele.")
        }
        val affected = TiposInsumoTable.deleteWhere { TiposInsumoTable.id eq id }
        affected > 0
    }
}
