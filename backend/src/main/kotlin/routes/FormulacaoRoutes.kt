package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.ConversaoProducaoComSubstitutosRequest
import org.example.SugerirSubstitutosRequest
import org.example.services.FormulacaoIaService

fun Route.formulacaoRoutes(formulacaoService: FormulacaoIaService) {
    listOf("/api/ai/formulacao", "/ai/formulacao").forEach { prefix ->
        route(prefix) {

            // 1. Sugerir substitutos técnicos de formulação quando houver insumos faltantes
            post("/sugerir-substitutos") {
                try {
                    val req = call.receive<SugerirSubstitutosRequest>()
                    val resultado = formulacaoService.sugerirSubstitutos(req)
                    call.respond(HttpStatusCode.OK, resultado)
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf(
                            "sucesso" to false,
                            "parecerGeralIa" to "Erro ao analisar substitutos: ${e.message}",
                            "sugestoes" to emptyList<Any>()
                        )
                    )
                }
            }

            // 2. Executar Ordem de Produção com Ficha Adaptada (debitando insumos substitutos)
            post("/produzir-com-substitutos") {
                try {
                    val req = call.receive<ConversaoProducaoComSubstitutosRequest>()
                    val resultado = formulacaoService.executarProducaoComSubstitutos(req)
                    call.respond(HttpStatusCode.OK, resultado)
                } catch (e: IllegalStateException) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Saldo insuficiente.")))
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf("error" to "Falha ao executar conversão adaptada: ${e.message}")
                    )
                }
            }
        }
    }
}
