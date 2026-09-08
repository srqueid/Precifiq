package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.CopilotPerguntaRequest
import org.example.services.CopilotService

fun Route.copilotRoutes(copilotService: CopilotService) {
    listOf("/api/ai/copilot", "/ai/copilot").forEach { prefix ->
        route(prefix) {

            // 1. Processar pergunta em linguagem natural com Text-to-SQL seguro
            post("/perguntar") {
                try {
                    val request = call.receive<CopilotPerguntaRequest>()
                    val resultado = copilotService.processarPergunta(request.pergunta)
                    call.respond(HttpStatusCode.OK, resultado)
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf(
                            "sucesso" to false,
                            "respostaMarkdown" to "Erro ao processar consulta: ${e.message}",
                            "erro" to (e.message ?: "Erro desconhecido")
                        )
                    )
                }
            }

            // 2. Obter sugestões de perguntas rápidas
            get("/sugestoes") {
                try {
                    val sugestoes = copilotService.obterSugestoes()
                    call.respond(HttpStatusCode.OK, mapOf("sugestoes" to sugestoes))
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf("error" to "Falha ao obter sugestões do Copilot")
                    )
                }
            }
        }
    }
}
