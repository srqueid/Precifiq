package org.example.repository

import org.example.UnidadeMedida
import org.example.UnidadesMedidaTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

class UnidadesMedidaRepository {
    fun lerTodos(): List<UnidadeMedida> = transaction {
        UnidadesMedidaTable.selectAll().map {
            UnidadeMedida(
                id = it[UnidadesMedidaTable.id],
                nome = it[UnidadesMedidaTable.nome],
                sigla = it[UnidadesMedidaTable.sigla]
            )
        }
    }

    fun lerPorId(id: Int): UnidadeMedida? = transaction {
        UnidadesMedidaTable.select { UnidadesMedidaTable.id eq id }.singleOrNull()?.let {
            UnidadeMedida(
                id = it[UnidadesMedidaTable.id],
                nome = it[UnidadesMedidaTable.nome],
                sigla = it[UnidadesMedidaTable.sigla]
            )
        }
    }

    fun criar(u: UnidadeMedida) = transaction {
        UnidadesMedidaTable.insert {
            it[nome] = u.nome
            it[sigla] = u.sigla
        }
    }

    fun atualizar(id: Int, nome: String, sigla: String) = transaction {
        UnidadesMedidaTable.update({ UnidadesMedidaTable.id eq id }) {
            it[UnidadesMedidaTable.nome] = nome
            it[UnidadesMedidaTable.sigla] = sigla
        }
    }

    fun deletar(id: Int) = transaction {
        UnidadesMedidaTable.deleteWhere { Op.build { UnidadesMedidaTable.id eq id } }
    }
}
