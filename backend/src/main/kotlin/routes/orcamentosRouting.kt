package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.html.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.CotacaoFornecedor
import org.example.FormaPagamento
import org.example.ItemOrcamento
import org.example.OrcamentoCompra
import org.example.StatusOrcamento
import org.example.repository.AppDatabase
import org.example.repository.OrcamentoRepository.PedidoAprovacao
import org.example.repository.OrcamentoRepository.SugestaoCompra
import org.example.services.gerarHtmlOrcamento
import org.example.services.gerarHtmlPedidoCompra
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

typealias AprovarPedidoRequest = PedidoAprovacao

data class AprovarPedidosRequest(
    val pedidos: List<PedidoAprovacao>
)

fun Application.orcamentosRouting(db: AppDatabase) {
    val database = db
    routing {
        // --- ORÇAMENTOS ---
        route("/orcamentos") {
            get("/json") {
                val orcamentos = database.orcamentos.lerTodosOrcamentos()
                call.respond(mapOf("orcamentos" to orcamentos))
            }
            get {
                val orcamentos = database.orcamentos.lerTodosOrcamentos()
                call.respond(orcamentos)
            }

            post("/novo") {
                val orcamento = call.receive<OrcamentoCompra>()
                val orc = database.orcamentos.criarOrcamento(orcamento.copy(status = StatusOrcamento.EM_DIGITACAO))
                call.respond(orc)
            }

            get("/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val orc = database.orcamentos.lerOrcamentoPorId(id) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Orçamento não encontrado"))
                val itens = database.orcamentos.lerItens(id)
                call.respond(mapOf("orcamento" to orc, "itens" to itens))
            }

            post("/{id}/status") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val params = call.receiveParameters()
                val statusStr = params["status"]
                try {
                    if (statusStr != null) {
                        val novoStatus = StatusOrcamento.valueOf(statusStr)
                        database.orcamentos.atualizarStatus(id, novoStatus)
                        call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
                    } else {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Status não informado"))
                    }
                } catch (e: Exception) {
                     call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Status inválido"))
                }
            }

            post("/{id}/valores") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val p = call.receiveParameters()
                database.orcamentos.atualizarValores(
                    id,
                    p["frete"]?.toDoubleOrNull() ?: 0.0,
                    p["desconto"]?.toDoubleOrNull() ?: 0.0,
                    p["obs"]
                )
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            post("/{id}/atualizar") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val p = call.receiveParameters()
                val novoTitulo = p["titulo"] ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Título não informado"))
                database.orcamentos.atualizarTitulo(id, novoTitulo)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            get("/{id}/itens/{itemId}/cotacoes") {
                val itemId = call.parameters["itemId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val cotacoes = database.orcamentos.lerCotacoesDoItem(itemId)
                call.respond(mapOf("cotacoes" to cotacoes))
            }

            post("/{id}/itens") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val item = call.receive<ItemOrcamento>()
                database.orcamentos.adicionarItem(id, item.insumoId, item.quantidade)
                call.respond(HttpStatusCode.Created, mapOf("status" to "success"))
            }

            get("/{id}/itens/{itemId}/deletar") {
                val itemId = call.parameters["itemId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.orcamentos.deletarItem(itemId)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            post("/{id}/itens/{itemId}/cotacoes") {
                val itemId = call.parameters["itemId"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val cotacao = call.receive<CotacaoFornecedor>()
                database.orcamentos.adicionarCotacao(itemId, cotacao.fornecedorId, cotacao.precoUnitario)
                call.respond(HttpStatusCode.Created, mapOf("status" to "success"))
            }

            get("/{id}/itens/{itemId}/cotacoes/{cotacaoId}/deletar") {
                val cotacaoId = call.parameters["cotacaoId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.orcamentos.deletarCotacao(cotacaoId)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            get("/{id}/sugestoes") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val sugestoes = database.orcamentos.sugerirMelhoresCompras(id)
                call.respond(mapOf("sugestoes" to sugestoes))
            }

            get("/{id}/todas-cotacoes") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val todasCotacoes = database.orcamentos.sugerirTodosPrecos(id)
                call.respond(mapOf("itens" to todasCotacoes))
            }

            post("/{id}/aprovar") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val request = call.receive<AprovarPedidoRequest>()
                val formaPagamento = parseFormaPagamento(request.formaPagamento)

                val novosPedidoIds = database.orcamentos.gerarPedidos(id, listOf(request), formaPagamento)
                if (novosPedidoIds.isEmpty()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Nenhum fornecedor/item selecionado"))
                }

                call.respond(HttpStatusCode.OK, mapOf(
                    "status" to "success",
                    "novoPedidoId" to novosPedidoIds.first(),
                    "novosPedidoIds" to novosPedidoIds
                ))
            }

            post("/{id}/aprovar-pedidos") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val request = call.receive<AprovarPedidosRequest>()
                if (request.pedidos.isEmpty()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Nenhum fornecedor informado"))
                }

                val formaPagamento = parseFormaPagamento(request.pedidos.first().formaPagamento)
                val novosPedidoIds = database.orcamentos.gerarPedidos(id, request.pedidos, formaPagamento)
                if (novosPedidoIds.isEmpty()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Nenhum fornecedor/item selecionado"))
                }

                call.respond(HttpStatusCode.OK, mapOf(
                    "status" to "success",
                    "novoPedidoId" to novosPedidoIds.first(),
                    "novosPedidoIds" to novosPedidoIds
                ))
            }

            post("/{id}/concluir") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.orcamentos.atualizarStatus(id, StatusOrcamento.CONCLUIDO)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            get("/deletar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.orcamentos.deletarOrcamento(id)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            get("/{id}/relatorio") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val relatorio = database.orcamentos.lerRelatorioOrcamento(id)
                if (relatorio == null) {
                    return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Orçamento não encontrado"))
                }
                call.respond(relatorio)
            }

            get("/{id}/imprimir") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val dados = database.orcamentos.lerParaImpressaoOrcamento(id)
                if (dados == null) {
                    return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Orçamento não encontrado"))
                }
                call.respondHtml(HttpStatusCode.OK) {
                    gerarHtmlOrcamento(dados)
                }
            }
        }

        // --- PEDIDOS DE COMPRA (standalone routes) ---
        route("/pedidos-compra") {
            get("/json") {
                val pedidos = database.orcamentos.lerPedidosCompra()
                call.respond(mapOf("pedidos" to pedidos))
            }

            post("/{id}/frete") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val params = call.receiveParameters()
                val frete = params["frete"]?.toDoubleOrNull() ?: 0.0
                database.orcamentos.atualizarFretePedido(id, frete)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            post("/{id}/retornar-orcamento") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.orcamentos.retornarPedidoParaOrcamento(id)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            post("/{id}/converter-compra") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val params = call.receiveParameters()
                val formaPagamento = parseFormaPagamento(params["formaPagamento"] ?: "PIX")
                val prazoRecebimento = params["prazoRecebimento"]
                database.orcamentos.converterPedidoParaCompra(id, formaPagamento, prazoRecebimento)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }

            get("/{id}/relatorio") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val relatorio = database.orcamentos.lerPedidosCompra().find { it.id == id }?.let { pedidoView ->
                    database.pedidosCompra.lerRelatorioPedido(id)
                }
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
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")

    return when (normalized) {
        "PIX" -> FormaPagamento.PIX
        "CARTAO", "CARTÃO", "CARTAO DE CREDITO", "CARTÃO DE CRÉDITO" -> FormaPagamento.CARTAO
        "DEBITO", "DÉBITO", "CARTAO DE DEBITO", "CARTÃO DE DÉBITO" -> FormaPagamento.DEBITO
        "DEPOSITO", "DEPÓSITO", "BOLETO" -> FormaPagamento.DEPOSITO
        else -> FormaPagamento.PIX
    }
}
