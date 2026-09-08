package org.example.services

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import org.example.DespesaFixa
import org.example.Funcionario
import org.example.repository.AppDatabase

fun Application.configuracoesRouting(db: AppDatabase) {
    val database = db

    routing {
        route("/configuracoes") {
            get("/json") {
                call.respond(database.configuracoesResumo())
            }

            post("/horas") {
                val horas = call.receiveParameters()["horasSemana"]?.toDoubleOrNull()
                if (horas == null || horas <= 0) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Horas inválidas"))
                }
                database.custosOperacionais.atualizarHorasSemanais(horas)
                call.respond(mapOf("status" to "success"))
            }

            route("/funcionarios") {
                post {
                    val funcionario = call.funcionarioFromParameters()
                    database.custosOperacionais.criarFuncionario(funcionario)
                    call.respond(mapOf("status" to "success"))
                }

                post("/atualizar/{id}") {
                    val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                    val p = call.receiveParameters()
                    database.custosOperacionais.atualizarFuncionario(
                        id,
                        p["nome"] ?: "",
                        p["salarioBruto"]?.toDoubleOrNull() ?: 0.0
                    )
                    call.respond(mapOf("status" to "success"))
                }

                get("/{id}/deletar") {
                    val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                    database.custosOperacionais.deletarFuncionario(id)
                    call.respond(mapOf("status" to "success"))
                }
            }

            route("/despesas") {
                post {
                    val despesa = call.despesaFromParameters()
                    database.custosOperacionais.criarDespesa(despesa)
                    call.respond(mapOf("status" to "success"))
                }

                post("/atualizar/{id}") {
                    val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                    val p = call.receiveParameters()
                    database.custosOperacionais.atualizarDespesa(
                        id,
                        p["descricao"] ?: "",
                        p["valorMensal"]?.toDoubleOrNull() ?: 0.0
                    )
                    call.respond(mapOf("status" to "success"))
                }

                get("/{id}/deletar") {
                    val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                    database.custosOperacionais.deletarDespesa(id)
                    call.respond(mapOf("status" to "success"))
                }
            }
        }
    }
}

private suspend fun ApplicationCall.funcionarioFromParameters(): Funcionario {
    val p = receiveParameters()
    return Funcionario(
        id = 0,
        nome = p["nome"] ?: "",
        salarioBruto = p["salarioBruto"]?.toDoubleOrNull() ?: 0.0
    )
}

private suspend fun ApplicationCall.despesaFromParameters(): DespesaFixa {
    val p = receiveParameters()
    return DespesaFixa(
        id = 0,
        descricao = p["descricao"] ?: "",
        valorMensal = p["valorMensal"]?.toDoubleOrNull() ?: 0.0
    )
}

private fun AppDatabase.configuracoesResumo(): Map<String, Any> {
    val config = custosOperacionais.getConfiguracoesGlobais()
    val funcionarios = custosOperacionais.lerFuncionarios()
    val despesas = custosOperacionais.lerDespesas()
    val totalSalarios = funcionarios.sumOf { it.salarioBruto }
    val totalDespesasFixas = despesas.sumOf { it.valorMensal }
    val custoMinutoTrabalho = if (config.horasTrabalhadasPorSemana > 0) {
        (totalSalarios + totalDespesasFixas) / (config.horasTrabalhadasPorSemana * 60.0)
    } else {
        0.0
    }

    return mapOf(
        "config" to config.copy(
            totalSalarios = totalSalarios,
            totalDespesasFixas = totalDespesasFixas,
            custoMinutoTrabalho = custoMinutoTrabalho
        ),
        "funcionarios" to funcionarios,
        "despesas" to despesas
    )
}
