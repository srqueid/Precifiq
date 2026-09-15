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
                try {
                    val pedidos = database.pedidos.listarTodos()
                    call.respond(mapOf("pedidos" to pedidos))
                } catch (e: Exception) {
                    call.application.environment.log.error("Erro ao listar pedidos operacionais (/json)", e)
                    call.respond(HttpStatusCode.InternalServerError, mapOf("erro" to (e.message ?: "Erro ao listar pedidos"), "pedidos" to emptyList<Any>()))
                }
            }

            get {
                try {
                    val pedidos = database.pedidos.listarTodos()
                    call.respond(pedidos)
                } catch (e: Exception) {
                    call.application.environment.log.error("Erro ao listar pedidos operacionais", e)
                    call.respond(HttpStatusCode.InternalServerError, mapOf("erro" to (e.message ?: "Erro ao listar pedidos")))
                }
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
                try {
                    val pedido = call.receive<Pedido>()
                    val criado = database.pedidos.criar(pedido)
                    call.respond(HttpStatusCode.Created, criado)
                } catch (e: Exception) {
                    call.application.environment.log.error("Erro ao registrar pedido", e)
                    call.respond(HttpStatusCode.InternalServerError, mapOf("erro" to (e.message ?: "Erro ao registrar pedido")))
                }
            }

            patch("/{id}/entregue") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@patch
                }
                try {
                    val body = call.receive<Map<String, Boolean>>()
                    val entregue = body["entregue"] ?: false
                    database.pedidos.atualizarEntrega(id, entregue)
                    call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Status de entrega atualizado"))
                } catch (e: Exception) {
                    call.application.environment.log.error("Erro ao atualizar entrega", e)
                    call.respond(HttpStatusCode.InternalServerError, mapOf("erro" to (e.message ?: "Erro ao atualizar entrega")))
                }
            }

            patch("/{id}/pagamento") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@patch
                }
                try {
                    val body = call.receive<Map<String, String?>>()
                    val dataPagamento = body["dataPagamento"]
                    database.pedidos.atualizarPagamento(id, dataPagamento)
                    call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Status de pagamento atualizado"))
                } catch (e: Exception) {
                    call.application.environment.log.error("Erro ao atualizar pagamento", e)
                    call.respond(HttpStatusCode.InternalServerError, mapOf("erro" to (e.message ?: "Erro ao atualizar pagamento")))
                }
            }

            put("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@put
                }
                try {
                    val pedido = call.receive<Pedido>()
                    val sucesso = database.pedidos.atualizar(id, pedido)
                    if (sucesso) {
                        call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Pedido atualizado com sucesso"))
                    } else {
                        call.respond(HttpStatusCode.NotFound, mapOf("erro" to "Pedido não encontrado"))
                    }
                } catch (e: Exception) {
                    call.application.environment.log.error("Erro ao atualizar pedido", e)
                    call.respond(HttpStatusCode.InternalServerError, mapOf("erro" to (e.message ?: "Erro ao atualizar pedido")))
                }
            }

            delete("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("erro" to "ID inválido"))
                    return@delete
                }
                try {
                    val sucesso = database.pedidos.deletar(id)
                    if (sucesso) {
                        call.respond(HttpStatusCode.OK, mapOf("mensagem" to "Pedido excluído com sucesso"))
                    } else {
                        call.respond(HttpStatusCode.NotFound, mapOf("erro" to "Pedido não encontrado"))
                    }
                } catch (e: Exception) {
                    call.application.environment.log.error("Erro ao deletar pedido", e)
                    call.respond(HttpStatusCode.InternalServerError, mapOf("erro" to (e.message ?: "Erro ao deletar pedido")))
                }
            }
        }

        route("/pedidos-operacionais", registerPedidoEndpoints)
        route("/pedidos", registerPedidoEndpoints)
        route("/api/pedidos-operacionais", registerPedidoEndpoints)
        route("/api/pedidos", registerPedidoEndpoints)
    }
}
