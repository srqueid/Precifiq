package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.ClientesTable
import org.example.PedidosFinanceiroTable
import org.example.TransacoesFinanceirasTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

fun Route.financeiroRoutes() {
    route("/api/financeiro") {

        get("/dashboard") {
            val dashboardData = transaction {
                val contasAReceber = PedidosFinanceiroTable
                    .slice(PedidosFinanceiroTable.valorTotal.sum())
                    .select { PedidosFinanceiroTable.status eq "PENDENTE" }
                    .firstOrNull()?.get(PedidosFinanceiroTable.valorTotal.sum()) ?: 0.0

                val caixa = TransacoesFinanceirasTable
                    .slice(TransacoesFinanceirasTable.valorLiquido.sum())
                    .selectAll()
                    .firstOrNull()?.get(TransacoesFinanceirasTable.valorLiquido.sum()) ?: 0.0

                val projecao = contasAReceber
                val inadimplencia = 0.0

                mapOf(
                    "contasAReceber" to contasAReceber,
                    "caixa" to caixa,
                    "projecao" to projecao,
                    "inadimplencia" to inadimplencia
                )
            }
            call.respond(dashboardData)
        }
        
        post("/pedidos") {
            try {
                val pedido = call.receive<Map<String, Any>>()
                
                val clienteId = (pedido["clienteId"] as? Number)?.toInt()
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "clienteId inválido ou ausente."))
                val valorTotal = (pedido["valorTotal"] as? Number)?.toDouble()
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "valorTotal inválido ou ausente."))

                val id = transaction {
                    val clienteExiste = ClientesTable.select { ClientesTable.id eq clienteId }.count() > 0
                    if (!clienteExiste) {
                        throw Exception("Cliente com ID $clienteId não encontrado.")
                    }

                    PedidosFinanceiroTable.insert {
                        it[this.clienteId] = clienteId
                        it[this.valorTotal] = valorTotal
                    } get PedidosFinanceiroTable.id
                }
                call.respond(HttpStatusCode.Created, mapOf("message" to "Pedido registrado com sucesso", "id" to id))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao registrar pedido: ${e.message}"))
            }
        }

        put("/pedidos/{id}/baixar") {
            try {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@put call.respond(HttpStatusCode.BadRequest, "ID do pedido inválido")
                
                val baixaInfo = call.receive<Map<String, Any>>()
                val formaPagamento = baixaInfo["formaPagamento"] as? String ?: "N/A"
                val taxas = (baixaInfo["taxas"] as? Number)?.toDouble() ?: 0.0

                transaction {
                    val pedido = PedidosFinanceiroTable.select { PedidosFinanceiroTable.id eq id }.firstOrNull()
                        ?: throw Exception("Pedido com ID $id não encontrado.")

                    if (pedido[PedidosFinanceiroTable.status] != "PENDENTE") {
                        throw Exception("O pedido não está com o status PENDENTE.")
                    }

                    val valorTotal = pedido[PedidosFinanceiroTable.valorTotal]
                    val valorLiquido = valorTotal - taxas

                    PedidosFinanceiroTable.update({ PedidosFinanceiroTable.id eq id }) {
                        it[status] = "PAGO"
                    }

                    TransacoesFinanceirasTable.insert {
                        it[pedidoId] = id
                        it[tipo] = "RECEBIMENTO"
                        it[valor] = valorTotal
                        it[dataTransacao] = LocalDateTime.now()
                        it[this.formaPagamento] = formaPagamento
                        it[this.taxas] = taxas
                        it[this.valorLiquido] = valorLiquido
                        it[descricao] = "Recebimento do pedido #$id"
                    }
                }
                call.respond(HttpStatusCode.OK, mapOf("message" to "Pedido $id baixado com sucesso."))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao baixar pedido: ${e.message}"))
            }
        }

        get("/projecao") {
            val projecaoData = transaction {
                PedidosFinanceiroTable
                    .slice(PedidosFinanceiroTable.valorTotal.sum())
                    .select { PedidosFinanceiroTable.status eq "PENDENTE" }
                    .firstOrNull()?.get(PedidosFinanceiroTable.valorTotal.sum()) ?: 0.0
            }
            call.respond(mapOf("total" to projecaoData))
        }
    }
}
