package org.example.repository

import org.example.Cliente
import org.example.ClientesTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

class ClienteRepository {
    fun listarTodos(): List<Cliente> = transaction {
        ClientesTable.selectAll().map {
            Cliente(
                id = it[ClientesTable.id],
                nome = it[ClientesTable.nome],
                telefone = it[ClientesTable.telefone],
                email = it[ClientesTable.email],
                endereco = it[ClientesTable.endereco]
            )
        }
    }

    fun buscarPorId(id: Int): Cliente? = transaction {
        ClientesTable.select { ClientesTable.id eq id }.singleOrNull()?.let {
            Cliente(
                id = it[ClientesTable.id],
                nome = it[ClientesTable.nome],
                telefone = it[ClientesTable.telefone],
                email = it[ClientesTable.email],
                endereco = it[ClientesTable.endereco]
            )
        }
    }

    fun buscarPorNome(nome: String): List<Cliente> = transaction {
        ClientesTable.select { ClientesTable.nome like "%${nome.replace("%", "\\%")}%" }.map {
            Cliente(
                id = it[ClientesTable.id],
                nome = it[ClientesTable.nome],
                telefone = it[ClientesTable.telefone],
                email = it[ClientesTable.email],
                endereco = it[ClientesTable.endereco]
            )
        }
    }

    fun criar(cliente: Cliente): Cliente = transaction {
        val id = ClientesTable.insert {
            it[nome] = cliente.nome
            it[telefone] = cliente.telefone
            it[email] = cliente.email
            it[endereco] = cliente.endereco
        } get ClientesTable.id

        Cliente(
            id = id,
            nome = cliente.nome,
            telefone = cliente.telefone,
            email = cliente.email,
            endereco = cliente.endereco
        )
    }

    fun atualizar(id: Int, cliente: Cliente) = transaction {
        ClientesTable.update({ ClientesTable.id eq id }) {
            it[nome] = cliente.nome
            it[telefone] = cliente.telefone
            it[email] = cliente.email
            it[endereco] = cliente.endereco
        }
    }

    fun deletar(id: Int) = transaction {
        ClientesTable.deleteWhere { Op.build { ClientesTable.id eq id } }
    }
}
