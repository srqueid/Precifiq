package org.example

import io.ktor.http.*
import io.ktor.serialization.gson.gson
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.plugins.staticcontent.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.services.compras.compraRouting
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

// ── DTOs ──────────────────────────────────────────────────────────────────────

data class ProdutoPrecoDTO(
    val produtoNome: String,
    val nomeTamanho: String,
    val custoUnitarioCalculado: Double,
    val precoVenda: Double,
    val margemLucro: Double,
)

data class InsumoEstoqueDTO(
    val nome: String,
    val tipo: String,
    val unidadeSigla: String,
    val estoque: Double,
    val preco: Double,
)

// ── Ponto de entrada ──────────────────────────────────────────────────────────

fun main() {
    DatabaseConfig.connect()

    // ── Servidor de frontend estático — :8080 ────────────────────────────────
    // Sirva a pasta /frontend gerada pelo build, ou aponte para o diretório
    // onde os arquivos HTML/CSS/JS foram colocados.
    val webServer = embeddedServer(Netty, port = 8080, host = "0.0.0.0") {
        routing {
            // Redireciona raiz para o dashboard
            get("/") { call.respondRedirect("/pages/dashboard.html") }

            // Serve todos os arquivos estáticos da pasta frontend/
            staticFiles("/", File("frontend")) {
                default("pages/dashboard.html")
            }
        }
    }
    webServer.start(wait = false)

    // ── Servidor de API JSON — :8089 ─────────────────────────────────────────
    embeddedServer(Netty, port = 8089, host = "0.0.0.0") {
        install(CORS) {
            anyHost()
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowHeader(HttpHeaders.ContentType)
            allowNonSimpleContentTypes = true
        }
        install(ContentNegotiation) { gson { setPrettyPrinting() } }
        configureApiRouting()
    }.start(wait = true)
}

// ── Rotas de API ──────────────────────────────────────────────────────────────

fun Application.configureApiRouting() {
    val db = AppDatabase.default

    routing {

        // ── Dashboard ─────────────────────────────────────────────────────────
        get("/") {
            val precos = db.produtosFinais.lerTodos().flatMap { p ->
                db.produtosFinais.lerVariacoesDoProduto(p.id).map { v ->
                    ProdutoPrecoDTO(p.nome, v.nomeTamanho, v.custoUnitarioCalculado, v.precoVenda, v.margemLucro)
                }
            }

            val unidadesMap = db.unidadesMedida.lerTodos().associateBy { it.id }
            val estoque = db.insumos.lerTodos().map { i ->
                InsumoEstoqueDTO(
                    nome         = i.nome,
                    tipo         = if (i.isEmbalagem) "Embalagem" else "Matéria-prima",
                    unidadeSigla = unidadesMap[i.unidadeMedidaId]?.sigla ?: "",
                    estoque      = 0.0,
                    preco        = i.preco,
                )
            }

            val todosOrcamentos     = db.orcamentos.lerTodosOrcamentos()
            val orcamentosCount     = todosOrcamentos.size
            val aprovadosCount      = todosOrcamentos.count { it.status == StatusOrcamento.ORCAMENTO_APROVADO }
            val comprasTotal        = db.pedidosCompra.lerTodos().sumOf { it.valorFinalConfirmado }
            val comprasPendentes    = db.compras.lerTodas()
                .filter { it.status == StatusCompra.PENDENTE }
                .map { c ->
                    mapOf(
                        "id"           to c.id,
                        "dataCriacao"  to c.dataCriacao,
                        "fornecedorId" to c.fornecedorId,
                        "valorTotal"   to c.valorTotal,
                        "status"       to c.status.name,
                    )
                }

            call.respond(
                mapOf(
                    "precos"                to precos,
                    "estoque"               to estoque,
                    "orcamentosCount"       to orcamentosCount,
                    "aprovadosCount"        to aprovadosCount,
                    "comprasTotal"          to comprasTotal,
                    "comprasPendentesCount" to comprasPendentes.size,
                    "comprasPendentes"      to comprasPendentes,
                )
            )
        }

        // ── Insumos ───────────────────────────────────────────────────────────
        route("/insumos") {
            get("/json") {
                runCatching {
                    call.respond(mapOf("insumos" to db.insumos.lerTodos(), "unidades" to db.unidadesMedida.lerTodos()))
                }.onFailure { call.respond(mapOf("error" to it.message)) }
            }
            post {
                val insumo    = call.receive<Insumo>()
                val resultado = db.insumos.criar(insumo)
                if (resultado.isSuccess) call.respond(mapOf("ok" to true))
                else call.respond(mapOf("error" to (resultado.exceptionOrNull()?.message ?: "Erro")))
            }
            post("/atualizar/{id}") {
                val id     = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(mapOf("error" to "invalid id"))
                val insumo = call.receive<Insumo>()
                runCatching { db.insumos.atualizar(id, insumo) }
                    .fold({ call.respond(mapOf("ok" to true)) }, { call.respond(mapOf("error" to it.message)) })
            }
            get("/deletar/{id}") {
                call.parameters["id"]?.toIntOrNull()?.let { db.insumos.deletar(it) }
                call.respond(mapOf("ok" to true))
            }
        }

        // ── Produtos finais ───────────────────────────────────────────────────
        route("/produtos-finais") {
            get("/json") {
                runCatching { call.respond(mapOf("produtos" to db.produtosFinais.lerTodos())) }
                    .onFailure { call.respond(mapOf("error" to it.message)) }
            }
            post {
                val produto = call.receive<ProdutoFinal>()
                db.produtosFinais.criar(produto)
                call.respond(mapOf("ok" to true))
            }
            post("/atualizar/{id}") {
                val id      = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(mapOf("error" to "invalid id"))
                val produto = call.receive<ProdutoFinal>()
                db.produtosFinais.atualizarProdutoBase(id, produto.nome, produto.descricao, produto.rendimentoReceitaBase)
                call.respond(mapOf("ok" to true))
            }
            get("/deletar/{id}") {
                call.parameters["id"]?.toIntOrNull()?.let { db.produtosFinais.deletarProdutoBase(it) }
                call.respond(mapOf("ok" to true))
            }
        }

        // ── Precificação ──────────────────────────────────────────────────────
        route("/precificacao") {
            get("/json") {
                runCatching {
                    val items = db.produtosFinais.lerTodos().flatMap { p ->
                        db.produtosFinais.lerVariacoesDoProduto(p.id).map { v ->
                            mapOf(
                                "variacaoId"              to v.id,
                                "produtoNome"             to p.nome,
                                "nomeTamanho"             to v.nomeTamanho,
                                "custoUnitarioCalculado"  to v.custoUnitarioCalculado,
                                "precoVenda"              to v.precoVenda,
                                "margemLucro"             to v.margemLucro,
                            )
                        }
                    }
                    call.respond(mapOf("items" to items))
                }.onFailure { call.respond(mapOf("error" to it.message)) }
            }
            post("/atualizar") {
                val p          = call.receiveParameters()
                val variacaoId = p["variacaoId"]?.toIntOrNull() ?: return@post call.respond(mapOf("error" to "invalid id"))
                val precoVenda = p["precoVenda"]?.toDoubleOrNull() ?: 0.0
                val margem     = p["margemLucro"]?.toDoubleOrNull() ?: 0.0
                val v          = db.produtosFinais.lerVariacaoPorId(variacaoId) ?: return@post call.respond(mapOf("error" to "variacao not found"))
                db.produtosFinais.atualizarVariacao(variacaoId, v.copy(precoVenda = precoVenda, margemLucro = margem))
                call.respond(mapOf("ok" to true))
            }
        }

        // ── Configurações ─────────────────────────────────────────────────────
        route("/configuracoes") {
            get("/json") {
                runCatching {
                    call.respond(
                        mapOf(
                            "config"       to db.custosOperacionais.getConfiguracoesGlobais(),
                            "funcionarios" to db.custosOperacionais.lerFuncionarios(),
                            "despesas"     to db.custosOperacionais.lerDespesas(),
                        )
                    )
                }.onFailure { call.respond(mapOf("error" to it.message)) }
            }
            post("/horas") {
                val horas = call.receiveParameters()["horasSemana"]?.toDoubleOrNull() ?: 44.0
                db.custosOperacionais.atualizarHorasSemanais(horas)
                call.respond(mapOf("ok" to true))
            }

            // Funcionários
            post("/funcionarios") {
                val f = call.receive<Funcionario>()
                if (f.nome.isNotBlank()) db.custosOperacionais.criarFuncionario(f)
                call.respond(mapOf("ok" to true))
            }
            post("/funcionarios/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(mapOf("error" to "invalid id"))
                val f  = call.receive<Funcionario>()
                db.custosOperacionais.atualizarFuncionario(id, f.nome, f.salarioBruto)
                call.respond(mapOf("ok" to true))
            }
            get("/funcionarios/{id}/deletar") {
                call.parameters["id"]?.toIntOrNull()?.let { db.custosOperacionais.deletarFuncionario(it) }
                call.respond(mapOf("ok" to true))
            }

            // Despesas
            post("/despesas") {
                val d = call.receive<DespesaFixa>()
                if (d.descricao.isNotBlank()) db.custosOperacionais.criarDespesa(d)
                call.respond(mapOf("ok" to true))
            }
            post("/despesas/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(mapOf("error" to "invalid id"))
                val d  = call.receive<DespesaFixa>()
                db.custosOperacionais.atualizarDespesa(id, d.descricao, d.valorMensal)
                call.respond(mapOf("ok" to true))
            }
            get("/despesas/{id}/deletar") {
                call.parameters["id"]?.toIntOrNull()?.let { db.custosOperacionais.deletarDespesa(it) }
                call.respond(mapOf("ok" to true))
            }
        }

        // ── Orçamentos ────────────────────────────────────────────────────────
        route("/orcamentos") {
            get("/json") {
                runCatching { call.respond(mapOf("orcamentos" to db.orcamentos.lerTodosOrcamentos())) }
                    .onFailure { call.respond(mapOf("error" to it.message)) }
            }
            post("/novo") {
                val orc  = call.receive<OrcamentoCompra>()
                val data = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                val novo = db.orcamentos.criarOrcamento(orc.copy(dataCriacao = data, status = StatusOrcamento.EM_DIGITACAO))
                call.respond(mapOf("ok" to true, "orc" to novo))
            }
            get("/{id}") {
                val id  = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(mapOf("error" to "invalid id"))
                val orc = db.orcamentos.lerOrcamentoPorId(id)  ?: return@get call.respond(mapOf("error" to "not found"))
                call.respond(mapOf("orcamento" to orc, "itens" to db.orcamentos.lerItens(id)))
            }
            post("/{id}/itens") {
                val id   = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(mapOf("error" to "invalid id"))
                val item = call.receive<ItemOrcamento>()
                db.orcamentos.adicionarItem(id, item.insumoId, item.quantidade)
                call.respond(mapOf("ok" to true))
            }
            get("/{id}/itens/{itemId}/deletar") {
                val id     = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(mapOf("error" to "invalid id"))
                val itemId = call.parameters["itemId"]?.toIntOrNull()
                itemId?.let { db.orcamentos.deletarItem(it) }
                call.respond(mapOf("ok" to true))
            }
            get("/deletar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(mapOf("error" to "invalid id"))
                db.orcamentos.deletarOrcamento(id)
                call.respond(mapOf("ok" to true))
            }
        }

        // ── Fornecedores ──────────────────────────────────────────────────────
        route("/fornecedores") {
            get("/json") {
                runCatching { call.respond(mapOf("fornecedores" to db.fornecedores.lerTodos())) }
                    .onFailure { call.respond(mapOf("error" to it.message)) }
            }
            post {
                val f = call.receive<Fornecedor>()
                db.fornecedores.criar(f)
                call.respond(mapOf("ok" to true))
            }
            post("/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(mapOf("error" to "invalid id"))
                val f  = call.receive<Fornecedor>()
                db.fornecedores.atualizar(id, f)
                call.respond(mapOf("ok" to true))
            }
            get("/deletar/{id}") {
                call.parameters["id"]?.toIntOrNull()?.let { db.fornecedores.deletar(it) }
                call.respond(mapOf("ok" to true))
            }
        }

        // ── Compras (rotas adicionais do módulo) ──────────────────────────────
        compraRouting()
    }
}
