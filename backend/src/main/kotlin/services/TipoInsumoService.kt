package org.example.services

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import org.example.TipoInsumo
import org.example.repository.AppDatabase

fun Application.tipoInsumoRouting(db: AppDatabase) {
    val database = db

    routing {
        // Rotas canônicas: /tipos-insumo e /insumos/tipos
        val routeHandlers: Route.() -> Unit = {
            get("/json") {
                call.respond(database.tiposInsumo.lerTodos())
            }

            get {
                call.respond(database.tiposInsumo.lerTodos())
            }

            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val tipo = database.tiposInsumo.lerPorId(id)
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Tipo de insumo não encontrado"))
                call.respond(tipo)
            }

            post {
                try {
                    val p = call.receiveParameters()
                    val nome = p["nome"]?.trim().orEmpty()
                    if (nome.isBlank()) {
                        return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do tipo de insumo é obrigatório"))
                    }
                    val descricao = p["descricao"]?.trim()?.takeIf { it.isNotBlank() }
                    val isEmbalagem = p["isEmbalagem"]?.toBooleanStrictOrNull() ?: false

                    val novoTipo = TipoInsumo(
                        id = 0,
                        nome = nome,
                        descricao = descricao,
                        isEmbalagem = isEmbalagem
                    )
                    val id = database.tiposInsumo.criar(novoTipo)
                    call.respond(HttpStatusCode.Created, mapOf("status" to "success", "id" to id))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao criar tipo de insumo")))
                }
            }

            post("/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                try {
                    val p = call.receiveParameters()
                    val nome = p["nome"]?.trim().orEmpty()
                    if (nome.isBlank()) {
                        return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do tipo de insumo é obrigatório"))
                    }
                    val descricao = p["descricao"]?.trim()?.takeIf { it.isNotBlank() }
                    val isEmbalagem = p["isEmbalagem"]?.toBooleanStrictOrNull() ?: false

                    database.tiposInsumo.atualizar(id, nome, descricao, isEmbalagem)
                    call.respond(mapOf("status" to "success"))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao atualizar tipo de insumo")))
                }
            }

            put("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                try {
                    val p = call.receiveParameters()
                    val nome = p["nome"]?.trim().orEmpty()
                    if (nome.isBlank()) {
                        return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do tipo de insumo é obrigatório"))
                    }
                    val descricao = p["descricao"]?.trim()?.takeIf { it.isNotBlank() }
                    val isEmbalagem = p["isEmbalagem"]?.toBooleanStrictOrNull() ?: false

                    database.tiposInsumo.atualizar(id, nome, descricao, isEmbalagem)
                    call.respond(mapOf("status" to "success"))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao atualizar tipo de insumo")))
                }
            }

            get("/deletar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                try {
                    database.tiposInsumo.deletar(id)
                    call.respond(mapOf("status" to "success"))
                } catch (e: IllegalStateException) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao excluir tipo de insumo")))
                }
            }

            delete("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                try {
                    database.tiposInsumo.deletar(id)
                    call.respond(mapOf("status" to "success"))
                } catch (e: IllegalStateException) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao excluir tipo de insumo")))
                }
            }
        }

        route("/tipos-insumo", routeHandlers)
        route("/insumos/tipos", routeHandlers)
        route("/api/tipos-insumo", routeHandlers)
    }
}
