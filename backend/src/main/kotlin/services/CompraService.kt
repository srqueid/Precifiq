package org.example.services

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.html.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.FormaPagamento
import org.example.ReceberCompraRequest
import org.example.repository.AppDatabase
import org.example.services.gerarHtmlPedidoCompra
import org.example.services.gerarHtmlCompra
import java.time.format.DateTimeFormatter

fun Application.compraRouting(db: AppDatabase) {
    val database = db

    routing {
        route("/compras") {
            get {
                call.respond(database.compras.lerTodas())
            }

            post("/manual") {
                val request = try {
                    call.receive<org.example.CriarCompraManualRequest>()
                } catch (e: Exception) {
                    e.printStackTrace()
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Dados inválidos para compra manual", "detalhe" to (e.message ?: e.javaClass.simpleName)))
                }

                if (request.itens.isEmpty()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "A compra deve conter ao menos um item"))
                }

                if (request.valorFrete < 0) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O valor do frete não pode ser negativo"))
                }

                val compraId = database.compras.criarCompraManual(request)
                call.respond(HttpStatusCode.Created, mapOf(
                    "success" to true,
                    "compraId" to compraId,
                    "mensagem" to "Compra manual #$compraId registrada com sucesso!"
                ))
            }

            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val compra = database.compras.lerPorId(id) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Compra não encontrada"))
                call.respond(mapOf("compra" to compra, "itens" to database.compras.lerItensComInsumo(id)))
            }

            post("/{id}/receber") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val request = runCatching { call.receive<ReceberCompraRequest>() }
                    .getOrElse { return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Informe os itens recebidos")) }

                if (request.valorFreteFinal < 0) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O valor do frete não pode ser negativo"))
                }

                val recebeu = database.compras.receberCompra(id, request.valorFreteFinal, request.itens)
                if (!recebeu) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Informe todos os itens da compra e quantidades válidas"))
                }

                call.respond(mapOf("status" to "success"))
            }

            get("/{id}/relatorio") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val relatorio = database.compras.lerRelatorioCompra(id)
                if (relatorio == null) {
                    return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Compra não encontrada"))
                }
                call.respond(relatorio)
            }

            get("/{id}/imprimir") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val dados = database.compras.lerParaImpressaoCompra(id)
                if (dados == null) {
                    return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Compra não encontrada"))
                }
                call.respondHtml(HttpStatusCode.OK) {
                    gerarHtmlCompra(dados)
                }
            }
        }

        route("/pedidos") {
            get("/json") {
                call.respond(mapOf("pedidos" to database.pedidosCompra.lerTodosComMeta()))
            }

            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val pedido = database.pedidosCompra.lerComFornecedor(id) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Pedido não encontrado"))
                call.respond(pedido)
            }

            post("/{id}/frete") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val frete = call.receiveParameters()["frete"]?.toDoubleOrNull() ?: 0.0
                database.pedidosCompra.atualizarFrete(id, frete)
                call.respond(mapOf("status" to "success"))
            }

            post("/{id}/retornar-orcamento") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.pedidosCompra.retornarParaOrcamento(id)
                call.respond(mapOf("status" to "success"))
            }

            post("/{id}/converter-compra") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val p = call.receiveParameters()
                val formaPagamento = p["formaPagamento"]?.let { parseFormaPagamento(it) } ?: FormaPagamento.PIX
                val prazoRecebimento = p["prazoRecebimento"]?.ifBlank { null }
                database.pedidosCompra.converterParaCompra(id, formaPagamento, prazoRecebimento)
                call.respond(mapOf("status" to "success"))
            }

            get("/{id}/relatorio") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val relatorio = database.pedidosCompra.lerRelatorioPedido(id)
                if (relatorio == null) {
                    return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Pedido não encontrado"))
                }
                call.respond(relatorio)
            }

            get("/{id}/imprimir") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val dados = database.pedidosCompra.lerParaImpressaoPedido(id)
                if (dados == null) {
                    return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Pedido não encontrado"))
                }
                call.respondHtml(HttpStatusCode.OK) {
                    gerarHtmlPedidoCompra(dados)
                }
            }
        }
    }
}

private fun parseFormaPagamento(value: String): FormaPagamento {
    val normalized = value
        .trim()
        .uppercase()
        .replace("Á", "A")
        .replace("Ã", "A")
        .replace("Ç", "C")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")

    return when (normalized) {
        "PIX" -> FormaPagamento.PIX
        "BOLETO", "DEPOSITO", "DEPÓSITO" -> FormaPagamento.DEPOSITO
        "CARTAO", "CARTÃO", "CARTAO DE CREDITO", "CARTÃO DE CRÉDITO" -> FormaPagamento.CARTAO
        "DEBITO", "DÉBITO", "CARTAO DE DEBITO", "CARTÃO DE DÉBITO" -> FormaPagamento.DEBITO
        else -> FormaPagamento.PIX
    }
}
