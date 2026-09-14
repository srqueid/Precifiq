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
                    val input = call.receiveTipoInsumoInput()
                    if (input.nome.isBlank()) {
                        return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do tipo de insumo é obrigatório"))
                    }

                    val novoTipo = TipoInsumo(
                        id = 0,
                        nome = input.nome,
                        descricao = input.descricao,
                        isEmbalagem = input.isEmbalagem
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
                    val input = call.receiveTipoInsumoInput()
                    if (input.nome.isBlank()) {
                        return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do tipo de insumo é obrigatório"))
                    }

                    database.tiposInsumo.atualizar(id, input.nome, input.descricao, input.isEmbalagem)
                    call.respond(mapOf("status" to "success"))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao atualizar tipo de insumo")))
                }
            }

            put("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                try {
                    val input = call.receiveTipoInsumoInput()
                    if (input.nome.isBlank()) {
                        return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do tipo de insumo é obrigatório"))
                    }

                    database.tiposInsumo.atualizar(id, input.nome, input.descricao, input.isEmbalagem)
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

data class TipoInsumoInput(
    val nome: String,
    val descricao: String?,
    val isEmbalagem: Boolean
)

private suspend fun ApplicationCall.receiveTipoInsumoInput(): TipoInsumoInput {
    val ct = request.contentType()
    if (ct.match(io.ktor.http.ContentType.Application.Json)) {
        val map = runCatching { receive<Map<String, Any?>>() }.getOrElse { emptyMap() }
        val nome = (map["nome"] as? String)?.trim().orEmpty()
        val descricao = (map["descricao"] as? String)?.trim()?.takeIf { it.isNotBlank() }
        val isEmbalagem = (map["isEmbalagem"] as? Boolean)
            ?: (map["isEmbalagem"]?.toString()?.toBooleanStrictOrNull())
            ?: nome.contains("embalagem", ignoreCase = true)
        return TipoInsumoInput(nome, descricao, isEmbalagem)
    } else {
        val p = receiveParameters()
        val nome = p["nome"]?.trim().orEmpty()
        val descricao = p["descricao"]?.trim()?.takeIf { it.isNotBlank() }
        val isEmbalagem = p["isEmbalagem"]?.toBooleanStrictOrNull()
            ?: nome.contains("embalagem", ignoreCase = true)
        return TipoInsumoInput(nome, descricao, isEmbalagem)
    }
}
