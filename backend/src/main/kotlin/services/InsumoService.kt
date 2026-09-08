package org.example.services

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import org.example.Insumo
import org.example.repository.AppDatabase

fun Application.insumoRouting(db: AppDatabase) {
    val database = db

    routing {
        route("/insumos") {
            get("/json") {
                val insumos = database.insumos.lerTodos()
                val unidades = database.unidadesMedida.lerTodos()
                call.respond(mapOf("insumos" to insumos, "unidades" to unidades))
            }

            get {
                call.respond(database.insumos.lerTodos())
            }

            post {
                val insumo = call.insumoFromParameters(database)
                database.insumos.criar(insumo)
                call.respond(mapOf("status" to "success"))
            }

            post("/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.insumos.atualizar(id, call.insumoFromParameters(database))
                call.respond(mapOf("status" to "success"))
            }

            post("/ajustar-estoque/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val params = call.receiveParameters()
                val novoEstoque = params["estoque"]?.toDoubleOrNull() ?: 0.0
                val motivo = params["motivo"] ?: "Ajuste de inventário físico"
                val res = database.estoque.ajustarSaldoInventario(id, novoEstoque, motivo = motivo)
                call.respond(mapOf("status" to "success", "movimento" to res))
            }

            get("/{id}/movimentos") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 100
                val movimentos = database.movimentosEstoque.listarPorInsumo(id, limit)
                call.respond(movimentos)
            }

            get("/movimentos/recentes") {
                val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 100
                val movimentos = database.movimentosEstoque.listarTodos(limit)
                call.respond(movimentos)
            }

            get("/{id}/unidades-compra") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val unidades = database.unidadesCompra.listarPorInsumo(id)
                call.respond(unidades)
            }

            post("/{id}/unidades-compra") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val params = call.receiveParameters()
                val nomeEmbalagem = params["nomeEmbalagem"] ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Nome da embalagem é obrigatório"))
                val fatorConversao = params["fatorConversao"]?.toDoubleOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Fator de conversão inválido"))
                val precoEmbalagem = params["precoEmbalagem"]?.toDoubleOrNull()
                val codigoBarras = params["codigoBarras"]
                val novaUnidade = org.example.UnidadeCompraInsumo(
                    id = 0,
                    insumoId = id,
                    nomeEmbalagem = nomeEmbalagem,
                    fatorConversao = fatorConversao,
                    precoEmbalagem = precoEmbalagem,
                    codigoBarras = codigoBarras
                )
                val novoId = database.unidadesCompra.criar(novaUnidade)
                call.respond(mapOf("status" to "success", "id" to novoId))
            }

            delete("/unidades-compra/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.unidadesCompra.deletar(id)
                call.respond(mapOf("status" to "success"))
            }

            post("/perda") {
                val params = call.receiveParameters()
                val insumoId = params["insumoId"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID do insumo é obrigatório"))
                val quantidade = params["quantidade"]?.toDoubleOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Quantidade inválida"))
                val motivo = params["motivo"] ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Motivo da perda é obrigatório"))
                val res = database.estoque.registrarPerda(insumoId, quantidade, motivo = motivo)
                call.respond(mapOf("status" to "success", "movimento" to res))
            }

            post("/estorno") {
                val params = call.receiveParameters()
                val movimentoId = params["movimentoId"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID do movimento é obrigatório"))
                val motivo = params["motivo"] ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Motivo do estorno é obrigatório"))
                val res = database.estoque.estornarMovimento(movimentoId, motivoEstorno = motivo)
                call.respond(mapOf("status" to "success", "movimento" to res))
            }

            post("/sincronizar-estoque-embalagem") {
                val insumos = database.insumos.lerTodos()
                var count = 0
                for (insumo in insumos) {
                    if ((insumo.estoque ?: 0.0) == 0.0 && (insumo.quantidadePorEmbalagem ?: 0.0) > 0.0) {
                        database.estoque.ajustarSaldoInventario(insumo.id, insumo.quantidadePorEmbalagem!!, motivo = "Sincronização inicial com tamanho da embalagem")
                        count++
                    }
                }
                call.respond(mapOf("status" to "success", "atualizados" to count))
            }

            get("/deletar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.insumos.deletar(id)
                call.respond(mapOf("status" to "success"))
            }
        }
    }
}

private suspend fun ApplicationCall.insumoFromParameters(db: AppDatabase): Insumo {
    val p = receiveParameters()
    var unidadeId = p["unidadeMedidaId"]?.toIntOrNull() ?: 1
    var qtdEmbalagem = p["quantidadePorEmbalagem"]?.toDoubleOrNull()
    var estoque = p["estoque"]?.toDoubleOrNull() ?: 0.0
    var estoqueMinimo = p["estoqueMinimo"]?.toDoubleOrNull() ?: 0.0
    val preco = p["preco"]?.toDoubleOrNull() ?: 0.0
    val isEmbalagem = p["isEmbalagem"]?.toBooleanStrictOrNull() ?: false

    val unidade = db.unidadesMedida.lerPorId(unidadeId)
    val sigla = unidade?.sigla?.lowercase() ?: ""
    val nome = unidade?.nome?.lowercase() ?: ""

    // Unificação de Medida Base: Litros -> Mililitros (ml) e Quilos -> Gramas (g)
    if (sigla == "l" || sigla == "lt" || nome.contains("litro")) {
        val mlUnidade = db.unidadesMedida.lerTodos().find { it.sigla.lowercase() == "ml" }
        if (mlUnidade != null) {
            unidadeId = mlUnidade.id
            if (qtdEmbalagem != null && qtdEmbalagem > 0) {
                qtdEmbalagem *= 1000.0
            }
            if (estoque > 0) {
                estoque *= 1000.0
            }
            if (estoqueMinimo > 0) {
                estoqueMinimo *= 1000.0
            }
        }
    } else if (sigla == "kg" || sigla == "kilo" || nome.contains("quilo")) {
        val gUnidade = db.unidadesMedida.lerTodos().find { it.sigla.lowercase() == "g" }
        if (gUnidade != null) {
            unidadeId = gUnidade.id
            if (qtdEmbalagem != null && qtdEmbalagem > 0) {
                qtdEmbalagem *= 1000.0
            }
            if (estoque > 0) {
                estoque *= 1000.0
            }
            if (estoqueMinimo > 0) {
                estoqueMinimo *= 1000.0
            }
        }
    }

    return Insumo(
        id = 0,
        nome = p["nome"] ?: "",
        unidadeMedidaId = unidadeId,
        quantidadePorEmbalagem = qtdEmbalagem,
        unidadeEmbalagemId = p["unidadeEmbalagemId"]?.toIntOrNull(),
        fornecedorId = p["fornecedorId"]?.toIntOrNull(),
        preco = preco,
        isEmbalagem = isEmbalagem,
        estoque = estoque,
        estoqueMinimo = estoqueMinimo
    )
}

