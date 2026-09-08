package org.example.services

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import org.example.UnidadeMedida
import org.example.repository.AppDatabase

fun Application.unidadeMedidaRouting(db: AppDatabase) {
    val database = db

    routing {
        route("/unidades-medida") {
            get("/json") {
                call.respond(database.unidadesMedida.lerTodos())
            }

            get {
                call.respond(database.unidadesMedida.lerTodos())
            }

            post {
                val p = call.receiveParameters()
                val unidade = UnidadeMedida(
                    id = 0,
                    nome = p["nome"] ?: "",
                    sigla = p["sigla"] ?: ""
                )
                database.unidadesMedida.criar(unidade)
                call.respond(mapOf("status" to "success"))
            }

            post("/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val p = call.receiveParameters()
                database.unidadesMedida.atualizar(
                    id,
                    p["nome"] ?: "",
                    p["sigla"] ?: ""
                )
                call.respond(mapOf("status" to "success"))
            }

            get("/deletar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.unidadesMedida.deletar(id)
                call.respond(mapOf("status" to "success"))
            }
        }
    }
}
