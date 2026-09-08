package org.example.services

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import org.example.Cliente
import org.example.repository.AppDatabase

fun Application.clienteRouting(db: AppDatabase) {
    val database = db

    routing {
        route("/clientes") {
            get {
                val clientes = database.clientes.listarTodos()
                call.respond(mapOf("clientes" to clientes))
            }

            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@get
                }
                val cliente = database.clientes.buscarPorId(id)
                if (cliente == null) {
                    call.respond(HttpStatusCode.NotFound, mapOf("erro" to "Cliente não encontrado"))
                } else {
                    call.respond(cliente)
                }
            }

            get("/buscar") {
                val nome = call.request.queryParameters["nome"]
                if (nome.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "Parâmetro nome é obrigatório"))
                    return@get
                }
                val clientes = database.clientes.buscarPorNome(nome)
                call.respond(mapOf("clientes" to clientes))
            }

            post {
                val cliente = call.receive<Cliente>()
                val criado = database.clientes.criar(cliente)
                call.respond(HttpStatusCode.Created, criado)
            }

            put("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@put
                }
                val cliente = call.receive<Cliente>()
                database.clientes.atualizar(id, cliente)
                call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Cliente atualizado com sucesso"))
            }

            delete("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@delete
                }
                database.clientes.deletar(id)
                call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Cliente removido com sucesso"))
            }
        }
    }
}
