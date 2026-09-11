package org.example.services

import io.ktor.server.application.*
import io.ktor.server.html.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import kotlinx.html.*
import org.example.Fornecedor
import org.example.repository.AppDatabase

fun Application.fornecedorRouting(db: AppDatabase) {
    val database = db

    routing {
        route("/fornecedores") {
            get("/json") {
                call.respond(database.fornecedores.lerTodos())
            }

            get {
                val lista = database.fornecedores.lerTodos()
                call.respondHtml {
                    layout("Fornecedores") {
                        h2 { text("Gestão de Fornecedores") }

                        form(action = "/fornecedores", method = FormMethod.post) {
                            h3 { text("Novo Fornecedor") }
                            div { label { text("Razão Social: ") }; textInput(name = "nome") { required = true } }
                            div { label { text("Nome da Empresa: ") }; textInput(name = "nomeEmpresa") }
                            div { label { text("Nome Fantasia: ") }; textInput(name = "nomeFantasia") }
                            div { label { text("CNPJ/CPF: ") }; textInput(name = "cnpjCpf") { required = true } }
                            div { label { text("Mnemônico (Apelido): ") }; textInput(name = "mnemonico") }
                            div { label { text("E-mail: ") }; textInput(name = "email") }
                            div { label { text("Telefones: ") }; textInput(name = "telefones") }
                            div { label { text("Endereço Completo: ") }; textInput(name = "enderecoCompleto") }
                            div { label { text("CEP: ") }; textInput(name = "cep") }
                            div { label { text("UF: ") }; textInput(name = "uf") { maxLength = "2" } }
                            div { label { text("Banco: ") }; textInput(name = "banco") }
                            div { label { text("Agência: ") }; textInput(name = "agencia") }
                            div { label { text("Conta Corrente: ") }; textInput(name = "contaCorrente") }
                            div { label { text("Chave PIX: ") }; textInput(name = "chavePix") }
                            div { label { text("Categoria: ") }; textInput(name = "categoria") }
                            div { label { text("Prazo Pagto Padrão: ") }; textInput(name = "prazoPagamentoPadrao") }
                            div { label { text("Histórico: ") }; textArea { name = "historicoAtendimento" } }
                            submitInput { value = "Cadastrar Fornecedor" }
                        }

                        table {
                            tr {
                                th { text("ID") }; th { text("Razão Social") }; th { text("CNPJ/CPF") }; th { text("Cidade/UF") }; th { text("Ações") }
                            }
                            lista.forEach { f ->
                                tr {
                                    td { text(f.id.toString()) }
                                    td { text(f.nomeEmpresa ?: f.nome) }
                                    td { text(f.cnpjCpf ?: "") }
                                    td { text(f.uf ?: "") }
                                    td {
                                        a(href = "/fornecedores/editar/${f.id}") { text("[Editar]") }
                                        text(" ")
                                        a(href = "/fornecedores/deletar/${f.id}") {
                                            style = "color: red;"
                                            attributes["onclick"] = "return confirm('Deseja excluir ${f.nomeEmpresa ?: f.nome}?')"
                                            text("[Excluir]")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            post {
                val contentType = call.request.headers[io.ktor.http.HttpHeaders.ContentType] ?: ""
                val novo = if (contentType.contains("application/json")) {
                    call.receive<Fornecedor>()
                } else {
                    val p = call.receiveParameters()
                    val nome = p["nome"] ?: ""
                    val nomeEmpresa = p["nomeEmpresa"]
                    Fornecedor(
                        id = 0,
                        nome = nome,
                        nomeEmpresa = nomeEmpresa,
                        nomeFantasia = p["nomeFantasia"],
                        cnpjCpf = p["cnpjCpf"]?.takeIf { it.isNotBlank() },
                        mnemonico = p["mnemonico"],
                        enderecoCompleto = p["enderecoCompleto"],
                        cep = p["cep"],
                        uf = p["uf"],
                        email = p["email"],
                        telefones = p["telefones"],
                        banco = p["banco"],
                        agencia = p["agencia"],
                        contaCorrente = p["contaCorrente"],
                        chavePix = p["chavePix"],
                        categoria = p["categoria"],
                        prazoPagamentoPadrao = p["prazoPagamentoPadrao"],
                        historicoAtendimento = p["historicoAtendimento"]
                    )
                }
                val novoId = database.fornecedores.criar(novo)
                val fornecedorCriado = novo.copy(id = novoId)
                call.respond(HttpStatusCode.Created, mapOf(
                    "status" to "success",
                    "id" to novoId,
                    "fornecedor" to fornecedorCriado
                ))
            }

            get("/editar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respondRedirect("/fornecedores")
                val f = database.fornecedores.lerPorId(id) ?: return@get call.respondRedirect("/fornecedores")

                call.respondHtml {
                    layout("Editar Fornecedor") {
                        h2 { text("Editando: ${f.nomeEmpresa ?: f.nome}") }
                        form(action = "/fornecedores/atualizar/${f.id}", method = FormMethod.post) {
                            div { label { text("Razão Social: ") }; textInput(name = "nome") { value = f.nome } }
                            div { label { text("Nome da Empresa: ") }; textInput(name = "nomeEmpresa") { value = f.nomeEmpresa ?: "" } }
                            div { label { text("Nome Fantasia: ") }; textInput(name = "nomeFantasia") { value = f.nomeFantasia ?: "" } }
                            div { label { text("CNPJ/CPF: ") }; textInput(name = "cnpjCpf") { value = f.cnpjCpf ?: "" } }
                            div { label { text("Mnemônico: ") }; textInput(name = "mnemonico") { value = f.mnemonico ?: "" } }
                            div { label { text("E-mail: ") }; textInput(name = "email") { value = f.email ?: "" } }
                            div { label { text("Telefones: ") }; textInput(name = "telefones") { value = f.telefones ?: "" } }
                            div { label { text("Endereço: ") }; textInput(name = "enderecoCompleto") { value = f.enderecoCompleto ?: "" } }
                            div { label { text("CEP: ") }; textInput(name = "cep") { value = f.cep ?: "" } }
                            div { label { text("UF: ") }; textInput(name = "uf") { maxLength = "2"; value = f.uf ?: "" } }
                            div { label { text("Banco: ") }; textInput(name = "banco") { value = f.banco ?: "" } }
                            div { label { text("Agência: ") }; textInput(name = "agencia") { value = f.agencia ?: "" } }
                            div { label { text("Conta: ") }; textInput(name = "contaCorrente") { value = f.contaCorrente ?: "" } }
                            div { label { text("PIX: ") }; textInput(name = "chavePix") { value = f.chavePix ?: "" } }
                            div { label { text("Categoria: ") }; textInput(name = "categoria") { value = f.categoria ?: "" } }
                            div { label { text("Prazo Pagto: ") }; textInput(name = "prazoPagamentoPadrao") { value = f.prazoPagamentoPadrao ?: "" } }
                            div { label { text("Histórico: ") }; textArea { name = "historicoAtendimento"; text(f.historicoAtendimento ?: "") } }

                            submitInput { value = "Salvar Alterações" }
                        }
                        br(); a(href = "/fornecedores") { text("Cancelar") }
                    }
                }
            }

            post("/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val p = call.receiveParameters()
                val nome = p["nome"] ?: ""
                val nomeEmpresa = p["nomeEmpresa"]
                val fornecedorEditado = Fornecedor(
                    id = id,
                    nome = nome,
                    nomeEmpresa = nomeEmpresa,
                    nomeFantasia = p["nomeFantasia"],
                    cnpjCpf = p["cnpjCpf"] ?: "",
                    mnemonico = p["mnemonico"],
                    enderecoCompleto = p["enderecoCompleto"],
                    cep = p["cep"],
                    uf = p["uf"],
                    email = p["email"],
                    telefones = p["telefones"],
                    banco = p["banco"],
                    agencia = p["agencia"],
                    contaCorrente = p["contaCorrente"],
                    chavePix = p["chavePix"],
                    categoria = p["categoria"],
                    prazoPagamentoPadrao = p["prazoPagamentoPadrao"],
                    historicoAtendimento = p["historicoAtendimento"]
                )
                database.fornecedores.atualizar(id, fornecedorEditado)
                call.respond(mapOf("status" to "success"))
            }

            get("/deletar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                database.fornecedores.deletar(id)
                call.respond(mapOf("status" to "success"))
            }
        }
    }
}
