package org.example

import com.google.gson.JsonDeserializer
import com.google.gson.JsonPrimitive
import com.google.gson.JsonSerializer
import io.ktor.http.*
import io.ktor.serialization.gson.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.forwardedheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.runBlocking
import org.example.repository.AppDatabase
import org.example.routes.*
import org.example.services.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

fun main(args: Array<String>) {
    DatabaseConfig.connect()
    val appDatabase = AppDatabase()
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8081

    embeddedServer(Netty, port = port, host = "0.0.0.0") {
        install(XForwardedHeaders)
        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.ContentType)
            allowHeader(HttpHeaders.Authorization)
            allowHeader("X-Company-Schema")
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Patch)
            allowMethod(HttpMethod.Delete)
            allowMethod(HttpMethod.Options)
        }
        
        install(StatusPages) {
            exception<Throwable> { call, cause ->
                cause.printStackTrace()
                runBlocking {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro Interno", "detalhe" to cause.message))
                }
            }
        }

        // Interceptor Multi-Tenant: extrai e valida o header X-Company-Schema
        intercept(ApplicationCallPipeline.Plugins) {
            val schemaHeader = call.request.headers["X-Company-Schema"]
            val schema = if (!schemaHeader.isNullOrBlank() && TenantContext.isValidSchema(schemaHeader.trim())) {
                schemaHeader.trim()
            } else {
                "controle"
            }
            TenantContext.setCurrentSchema(schema)
            proceed()
        }

        install(ContentNegotiation) {
            gson {
                registerTypeAdapter(LocalDateTime::class.java, JsonSerializer<LocalDateTime> { src, _, _ -> 
                    if (src == null) JsonPrimitive("") else JsonPrimitive(src.toString()) 
                })
                registerTypeAdapter(LocalDateTime::class.java, JsonDeserializer<LocalDateTime> { json, _, _ -> 
                    if (json.asString.isNullOrEmpty()) null else LocalDateTime.parse(json.asString) 
                })
                registerTypeAdapter(Instant::class.java, JsonSerializer<Instant> { src, _, _ -> JsonPrimitive(src.toString()) })
                registerTypeAdapter(Instant::class.java, JsonDeserializer<Instant> { json, _, _ -> Instant.parse(json.asString) })
                registerTypeAdapter(LocalDate::class.java, JsonSerializer<LocalDate> { src, _, _ -> JsonPrimitive(src.toString()) })
                registerTypeAdapter(LocalDate::class.java, JsonDeserializer<LocalDate> { json, _, _ -> LocalDate.parse(json.asString) })
            }
        }
        configureRouting(appDatabase)
    }.start(wait = true)
}

fun Application.configureRouting(db: AppDatabase) {
    fornecedorRouting(db)
    clienteRouting(db)
    insumoRouting(db)
    unidadeMedidaRouting(db)
    configuracoesRouting(db)
    produtosFinaisRouting(db)
    orcamentosRouting(db)
    precificacaoRouting(db)
    compraRouting(db)
    pedidoRouting(db)
    routing {
        // --- ROTAS DA API ---
        globalRoutes()

        val geminiService = GeminiService()
        val nfeService = NfeService(geminiService)
        nfeRoutes(nfeService)

        val previsaoService = PrevisaoService(db, geminiService)
        previsaoRoutes(previsaoService)

        val copilotService = CopilotService(geminiService)
        copilotRoutes(copilotService)

        val formulacaoService = FormulacaoIaService(db, geminiService)
        formulacaoRoutes(formulacaoService)

        financeiroRoutes()
        operacoesRoutes(db)
        kitsRoutes()

        // --- SERVIR O FRONTEND ---
        val basePath = System.getProperty("user.dir")
        val frontendDir = if (basePath.endsWith("backend")) {
            File(basePath, "../frontend")
        } else {
            File(basePath, "Controle/frontend")
        }
        val frontendDistExists = File(frontendDir, "dist").exists()

       suspend fun ApplicationCall.respondDashboardJson() {
           val dashboardData = transaction {
               val precos = (ProdutoVariacoesTable innerJoin ProdutosFinaisTable)
                   .selectAll()
                   .map {
                       mapOf<String, Any?>(
                           "produtoNome" to it[ProdutosFinaisTable.nome],
                           "nomeTamanho" to it[ProdutoVariacoesTable.nomeTamanho],
                           "custoUnitarioCalculado" to it[ProdutoVariacoesTable.custoUnitarioCalculado],
                           "precoVenda" to it[ProdutoVariacoesTable.precoVenda],
                           "margemLucro" to it[ProdutoVariacoesTable.margemLucro]
                       )
                   }

                val estoqueMinimoMap = try {
                    EstoqueMinimoInsumoAuxTable.selectAll().associate {
                        it[EstoqueMinimoInsumoAuxTable.insumoId] to it[EstoqueMinimoInsumoAuxTable.estoqueMinimo]
                    }
                } catch (e: Exception) {
                    emptyMap()
                }

                val estoque = InsumosTable.join(UnidadesMedidaTable, JoinType.LEFT, InsumosTable.unidadeMedidaId, UnidadesMedidaTable.id)
                    .selectAll()
                    .map {
                        val insumoId = it[InsumosTable.id]
                        mapOf<String, Any?>(
                            "id" to insumoId,
                            "nome" to it[InsumosTable.nome],
                            "tipo" to if (it[InsumosTable.isEmbalagem]) "Embalagem" else "Matéria-prima",
                            "isEmbalagem" to it[InsumosTable.isEmbalagem],
                            "unidadeSigla" to it[UnidadesMedidaTable.sigla].orEmpty(),
                            "estoque" to (it[InsumosTable.estoque] ?: 0.0),
                            "estoqueMinimo" to (estoqueMinimoMap[insumoId] ?: 0.0),
                            "quantidadePorEmbalagem" to it[InsumosTable.quantidadePorEmbalagem],
                            "preco" to it[InsumosTable.preco]
                        )
                    }

                // Cálculo exato do valor financeiro de insumos em estoque considerando o fracionamento (preço / quantidadePorEmbalagem)
                var valorEstoqueInsumos = 0.0
                InsumosTable.selectAll().forEach { row ->
                    val est = row[InsumosTable.estoque] ?: 0.0
                    val pr = row[InsumosTable.preco]
                    val qtdRaw = row[InsumosTable.quantidadePorEmbalagem]
                    val qtdEmb = if (qtdRaw != null && qtdRaw > 0.0) qtdRaw else 1.0
                    valorEstoqueInsumos += (est * (pr / qtdEmb))
                }

                // Compras Aguardando: compras com status PENDENTE
                val comprasPendentes = ComprasTable
                    .select { ComprasTable.status eq StatusCompra.PENDENTE.name }
                    .map { row ->
                        mapOf<String, Any?>(
                            "id" to row[ComprasTable.id],
                            "dataCriacao" to LocalDateTime.ofInstant(row[ComprasTable.dataCriacao], ZoneId.systemDefault()).toString(),
                            "fornecedorId" to row[ComprasTable.fornecedorId],
                            "valorTotal" to row[ComprasTable.valorTotal],
                            "status" to row[ComprasTable.status]
                        )
                    }

                // Orçamentos em Elaboração: status EM_DIGITACAO ou EM_ORCAMENTO
                val orcamentosEmElaboracao = OrcamentosCompraTable
                    .select { OrcamentosCompraTable.status inList listOf(StatusOrcamento.EM_DIGITACAO.name, StatusOrcamento.EM_ORCAMENTO.name) }
                    .count()

                // Orçamentos Aprovados: status ORCAMENTO_APROVADO
                val orcamentosAprovados = OrcamentosCompraTable
                    .select { OrcamentosCompraTable.status eq StatusOrcamento.ORCAMENTO_APROVADO.name }
                    .count()

                // Compras do Mês: soma das compras criadas no mês atual
                val now = LocalDateTime.now()
                val inicioMes = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
                val comprasDoMes = ComprasTable
                    .select { ComprasTable.dataCriacao greaterEq inicioMes.atZone(ZoneId.systemDefault()).toInstant() }
                    .sumOf { row: org.jetbrains.exposed.sql.ResultRow -> row[ComprasTable.valorTotal] }

                // Métricas de Produtos Finais e Estoque de Acabados
                val totalProdutos = ProdutosFinaisTable.selectAll().count()
                val totalVariacoes = ProdutoVariacoesTable.selectAll().count()
                val margemMedia = if (precos.isNotEmpty()) precos.mapNotNull { (it["margemLucro"] as? Number)?.toDouble() }.average() else 0.0
                val ticketMedio = if (precos.isNotEmpty()) precos.mapNotNull { (it["precoVenda"] as? Number)?.toDouble() }.average() else 0.0

                val estoqueVariacoesMap = try {
                    EstoqueVariacaoAuxTable.selectAll().associate {
                        it[EstoqueVariacaoAuxTable.variacaoId] to it[EstoqueVariacaoAuxTable.estoque]
                    }
                } catch (e: Exception) {
                    emptyMap()
                }

                var valorEstoqueProdutosCusto = 0.0
                var valorEstoqueProdutosVenda = 0.0
                var totalUnidadesProdutosEstoque = 0.0
                ProdutoVariacoesTable.selectAll().forEach { row ->
                    val varId = row[ProdutoVariacoesTable.id]
                    val est = estoqueVariacoesMap[varId] ?: 0.0
                    val custoUnit = row[ProdutoVariacoesTable.custoUnitarioCalculado]
                    val precoVenda = row[ProdutoVariacoesTable.precoVenda]
                    valorEstoqueProdutosCusto += (est * custoUnit)
                    valorEstoqueProdutosVenda += (est * precoVenda)
                    totalUnidadesProdutosEstoque += est
                }

                mapOf(
                    "precos" to precos,
                    "estoque" to estoque,
                    "valorEstoqueInsumos" to valorEstoqueInsumos,
                    "valorEstoqueProdutosVenda" to valorEstoqueProdutosVenda,
                    "valorEstoqueProdutosCusto" to valorEstoqueProdutosCusto,
                    "totalUnidadesProdutosEstoque" to totalUnidadesProdutosEstoque,
                    "comprasPendentes" to comprasPendentes,
                    "comprasPendentesCount" to comprasPendentes.size,
                    "orcamentosCount" to orcamentosEmElaboracao,
                    "aprovadosCount" to orcamentosAprovados,
                    "comprasTotal" to comprasDoMes,
                    "totalProdutos" to totalProdutos,
                    "totalVariacoes" to totalVariacoes,
                    "margemMedia" to margemMedia,
                    "ticketMedio" to ticketMedio
                )
           }

           respond(dashboardData)
       }

        // --- ROTAS DA API ---
        route("/api") {
            get("/health") {
                call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
            }
            // Rota de Dashboard para chamadas diretas ao backend
            get("/dashboard/json") {
                call.respondDashboardJson()
            }
        }

        get("/health") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        // Rota usada pelo Vite, porque o proxy remove o prefixo /api antes de encaminhar
        get("/dashboard/json") {
            call.respondDashboardJson()
        }

        if (frontendDistExists) {
            staticFiles("/assets", File(frontendDir, "dist/assets"))
            get("{...}") {
                val file = File(frontendDir, "dist/index.html")
                if (file.exists()) {
                    call.respondFile(file)
                } else {
                    call.respondText("index.html not found", status = HttpStatusCode.NotFound)
                }
            }
        }
    }
}
