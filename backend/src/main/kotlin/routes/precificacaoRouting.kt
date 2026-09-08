package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.repository.AppDatabase

fun Application.precificacaoRouting(db: AppDatabase) {
    val database = db

    routing {
        route("/precificacao") {
            get("/json") {
                val produtosMap = database.produtosFinais.lerTodos().associateBy { it.id }
                val variacoes = database.produtosFinais.lerTodasVariacoes()

                val items = variacoes.mapNotNull { v ->
                    val p = produtosMap[v.produtoId] ?: return@mapNotNull null
                    mapOf(
                        "variacaoId" to v.id,
                        "produtoNome" to p.nome,
                        "nomeTamanho" to v.nomeTamanho,
                        "custoUnitarioCalculado" to v.custoUnitarioCalculado,
                        "precoVenda" to v.precoVenda,
                        "margemLucro" to v.margemLucro
                    )
                }
                call.respond(mapOf("items" to items))
            }

            post("/atualizar") {
                val params = call.receiveParameters()
                val variacaoId = params["variacaoId"]?.toIntOrNull()
                val precoVenda = params["precoVenda"]?.toDoubleOrNull()
                val margemLucro = params["margemLucro"]?.toDoubleOrNull()

                if (variacaoId != null && precoVenda != null && margemLucro != null) {
                    val variacao = database.produtosFinais.lerVariacaoPorId(variacaoId)
                    if (variacao != null) {
                        database.produtosFinais.atualizarVariacao(variacaoId, variacao.copy(precoVenda = precoVenda, margemLucro = margemLucro))
                        call.respondText("OK")
                    } else {
                        call.respondText("Variação não encontrada", status = HttpStatusCode.NotFound)
                    }
                } else {
                    call.respondText("Parâmetros inválidos", status = HttpStatusCode.BadRequest)
                }
            }
        }
    }
}
