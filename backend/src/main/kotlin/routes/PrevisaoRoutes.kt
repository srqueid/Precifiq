package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.GerarOrcamentoPrevisaoRequest
import org.example.services.PrevisaoService

fun Route.previsaoRoutes(previsaoService: PrevisaoService) {
    listOf("/api/ai/previsao", "/ai/previsao").forEach { prefix ->
        route(prefix) {

            // 1. Consulta consolidada da previsão de ruptura e assistente de margem
            get("/dashboard") {
                try {
                    val resultado = previsaoService.analisarPrevisaoDashboard()
                    call.respond(HttpStatusCode.OK, resultado)
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf("error" to "Falha ao analisar previsão de estoque: ${e.message}")
                    )
                }
            }

            // 2. Ação direta: Gerar orçamento de compra pré-preenchido para os insumos em risco
            post("/gerar-orcamento") {
                try {
                    val req = runCatching { call.receive<GerarOrcamentoPrevisaoRequest>() }.getOrNull()
                    val resultado = previsaoService.gerarOrcamentoCompraParaItensCriticos(req?.insumoIds)
                    if (resultado.success) {
                        call.respond(HttpStatusCode.OK, resultado)
                    } else {
                        call.respond(HttpStatusCode.BadRequest, resultado)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf("error" to "Falha ao gerar orçamento automático: ${e.message}")
                    )
                }
            }
        }
    }
}
