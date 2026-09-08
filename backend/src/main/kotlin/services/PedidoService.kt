package org.example.services

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import org.example.Pedido
import org.example.repository.AppDatabase

fun Application.pedidoRouting(db: AppDatabase) {
    val database = db

    routing {
        val registerPedidoEndpoints: Route.() -> Unit = {
            get("/json") {
                val pedidos = database.pedidos.listarTodos()
                call.respond(mapOf("pedidos" to pedidos))
            }

            get {
                val pedidos = database.pedidos.listarTodos()
                call.respond(pedidos)
            }

            get("/cliente/{clienteId}") {
                val clienteIdParam = call.parameters["clienteId"]?.toIntOrNull()
                if (clienteIdParam == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID do cliente inválido"))
                    return@get
                }
                val pedidos = database.pedidos.listarPorCliente(clienteIdParam)
                call.respond(mapOf("pedidos" to pedidos))
            }

            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@get
                }
                val pedido = database.pedidos.buscarPorId(id)
                if (pedido == null) {
                    call.respond(HttpStatusCode.NotFound, mapOf("erro" to "Pedido não encontrado"))
                } else {
                    call.respond(pedido)
                }
            }

            post {
                val pedido = call.receive<Pedido>()
                val criado = database.pedidos.criar(pedido)
                call.respond(HttpStatusCode.Created, criado)
            }

            patch("/{id}/entregue") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@patch
                }
                val body = call.receive<Map<String, Boolean>>()
                val entregue = body["entregue"] ?: false
                database.pedidos.atualizarEntrega(id, entregue)
                call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Status de entrega atualizado"))
            }

            put("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@put
                }
                val pedido = call.receive<Pedido>()
                val sucesso = database.pedidos.atualizar(id, pedido)
                if (sucesso) {
                    call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Pedido atualizado com sucesso"))
                } else {
                    call.respond(HttpStatusCode.NotFound, mapOf("erro" to "Pedido não encontrado"))
                }
            }

            delete("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@delete
                }
                val sucesso = database.pedidos.deletar(id)
                if (sucesso) {
                    call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Pedido excluído com sucesso"))
                } else {
                    call.respond(HttpStatusCode.NotFound, mapOf("erro" to "Pedido não encontrado"))
                }
            }
        }

        route("/pedidos-operacionais", registerPedidoEndpoints)
        route("/pedidos", registerPedidoEndpoints)
    }
}
