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
import io.ktor.server.request.*
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
            allowHeader("X-User-Email")
            allowHeader("X-Company-Id")
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
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro Interno", "detalhe" to cause.message))
            }
        }

        // Interceptor Multi-Tenant Estrito: Valida permissões e bloqueia acesso cruzado não autorizado
        intercept(ApplicationCallPipeline.Plugins) {
            val uri = call.request.uri
            val path = uri.substringBefore("?")

            // Rotas isentas de validação de tenant operacional:
            // 1. Healthcheck do container
            // 2. Autenticação global (login, google)
            // 3. Arquivos estáticos do frontend (não iniciados com /api/)
            if (path == "/api/health" || path.startsWith("/api/global/auth/") || !path.startsWith("/api/")) {
                proceed()
                return@intercept
            }

            val callerEmail = call.request.headers["X-User-Email"]?.trim()?.lowercase()
            val schemaHeader = call.request.headers["X-Company-Schema"]?.trim()?.lowercase()

            // Rotas de governança central (/api/global/...): tratam segurança em nível de endpoint
            if (path.startsWith("/api/global/")) {
                if (!schemaHeader.isNullOrBlank() && TenantContext.isValidSchema(schemaHeader)) {
                    TenantContext.setCurrentSchema(schemaHeader)
                }
                proceed()
                return@intercept
            }

            // Rotas operacionais do negócio (/api/insumos, /api/produtos, /api/pedidos, etc.):
            // Requerem usuário autenticado e permissão explícita para o schema solicitado
            if (callerEmail.isNullOrBlank()) {
                call.respond(
                    HttpStatusCode.Unauthorized, 
                    mapOf("error" to "Autenticação obrigatória: cabeçalho X-User-Email ausente.")
                )
                finish()
                return@intercept
            }

            val schemaToUse = if (!schemaHeader.isNullOrBlank() && TenantContext.isValidSchema(schemaHeader)) {
                schemaHeader
            } else {
                obterSchemaPadraoUsuario(callerEmail) ?: "controle"
            }

            if (!isUserAuthorizedForSchema(callerEmail, schemaToUse)) {
                call.respond(
                    HttpStatusCode.Forbidden,
                    mapOf(
                        "error" to "Acesso negado: O usuário '$callerEmail' não possui permissão para acessar a empresa/unidade de schema '$schemaToUse'."
                    )
                )
                finish()
                return@intercept
            }

            TenantContext.setCurrentSchema(schemaToUse)
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
    tipoInsumoRouting(db)
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
                            "unidadeSigla" to it.getOrNull(UnidadesMedidaTable.sigla).orEmpty(),
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

                // Compras Aguardando: pedidos de compra com status PENDENTE
                val comprasPendentes = PedidosCompraTable
                    .select { PedidosCompraTable.status eq "PENDENTE" }
                    .map { row ->
                        mapOf<String, Any?>(
                            "id" to row[PedidosCompraTable.id],
                            "dataCriacao" to LocalDateTime.ofInstant(row[PedidosCompraTable.dataCriacao], ZoneId.systemDefault()).toString(),
                            "fornecedorId" to row[PedidosCompraTable.fornecedorId],
                            "valorTotal" to row[PedidosCompraTable.valorTotal],
                            "status" to row[PedidosCompraTable.status]
                        )
                    }

                // Orçamentos em Elaboração: status EM_DIGITACAO, EM_ORCAMENTO, ABERTO ou PEDIDO_PARCIAL
                val orcamentosEmElaboracao = OrcamentosCompraTable
                    .select { OrcamentosCompraTable.status inList listOf(StatusOrcamento.EM_DIGITACAO.name, StatusOrcamento.EM_ORCAMENTO.name, StatusOrcamento.ABERTO.name, StatusOrcamento.PEDIDO_PARCIAL.name) }
                    .count()

                // Orçamentos Aprovados: status ORCAMENTO_APROVADO, COMPRA_APROVADA
                val orcamentosAprovados = OrcamentosCompraTable
                    .select { OrcamentosCompraTable.status inList listOf(StatusOrcamento.ORCAMENTO_APROVADO.name, StatusOrcamento.COMPRA_APROVADA.name) }
                    .count()

                // Compras do Mês: soma dos pedidos confirmados/concluídos ou compras criadas no mês atual
                val now = LocalDateTime.now()
                val inicioMes = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
                val comprasDoMes = PedidosCompraTable
                    .select { PedidosCompraTable.dataCriacao greaterEq inicioMes.atZone(ZoneId.systemDefault()).toInstant() }
                    .sumOf { row: org.jetbrains.exposed.sql.ResultRow -> row[PedidosCompraTable.valorFinalConfirmado] }

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

                // Indicadores de Vendas e Lucro Realizado (Módulo Comercial)
                val pedidos = try {
                    (PedidosTable leftJoin ClientesTable).selectAll().toList()
                } catch (e: Exception) {
                    PedidosTable.selectAll().toList()
                }
                val vendasTotalMes = pedidos.sumOf { it[PedidosTable.valor] ?: 0.0 }
                val vendasCustoMes = pedidos.sumOf { it[PedidosTable.valorCustoTotal] }
                val lucroBrutoMes = if (vendasTotalMes > 0.0) (vendasTotalMes - vendasCustoMes) else 0.0
                val margemLucroRealizada = if (vendasTotalMes > 0.0) (lucroBrutoMes / vendasTotalMes) * 100.0 else 0.0
                val pedidosCount = pedidos.size

                // Pedidos Pendentes de Entrega (entregue == false)
                val pedidosPendentesEntrega = pedidos.filter { !it[PedidosTable.entregue] }
                val pedidosPendentesEntregaCount = pedidosPendentesEntrega.size
                val pedidosPendentesEntregaTotal = pedidosPendentesEntrega.sumOf { it[PedidosTable.valor] ?: 0.0 }
                val pedidosPendentesEntregaList = pedidosPendentesEntrega.take(15).map { row ->
                    val dpStr = row[PedidosTable.dataPagamento]
                    mapOf<String, Any?>(
                        "id" to row[PedidosTable.id],
                        "clienteNome" to (row.getOrNull(ClientesTable.nome) ?: "Sem cliente"),
                        "valorTotal" to (row[PedidosTable.valor] ?: 0.0),
                        "valorFrete" to row[PedidosTable.valorFrete],
                        "tipoEnvio" to row[PedidosTable.tipoEnvio],
                        "prazoEnvio" to row[PedidosTable.prazoEnvio],
                        "formaPagamento" to row[PedidosTable.formaPagamento],
                        "dataPagamento" to dpStr,
                        "pago" to !dpStr.isNullOrBlank(),
                        "entregue" to row[PedidosTable.entregue]
                    )
                }

                // Pedidos Pendentes de Pagamento (dataPagamento nulo ou vazio)
                val pedidosPendentesPagamento = pedidos.filter { row ->
                    row[PedidosTable.dataPagamento].isNullOrBlank()
                }
                val pedidosPendentesPagamentoCount = pedidosPendentesPagamento.size
                val pedidosPendentesPagamentoTotal = pedidosPendentesPagamento.sumOf { it[PedidosTable.valor] ?: 0.0 }
                val pedidosPendentesPagamentoList = pedidosPendentesPagamento.take(15).map { row ->
                    val dpStr = row[PedidosTable.dataPagamento]
                    mapOf<String, Any?>(
                        "id" to row[PedidosTable.id],
                        "clienteNome" to (row.getOrNull(ClientesTable.nome) ?: "Sem cliente"),
                        "valorTotal" to (row[PedidosTable.valor] ?: 0.0),
                        "valorFrete" to row[PedidosTable.valorFrete],
                        "tipoEnvio" to row[PedidosTable.tipoEnvio],
                        "prazoEnvio" to row[PedidosTable.prazoEnvio],
                        "formaPagamento" to row[PedidosTable.formaPagamento],
                        "dataPagamento" to dpStr,
                        "pago" to false,
                        "entregue" to row[PedidosTable.entregue]
                    )
                }

                // Indicadores de Giro de Estoque (Turnover Ratio)
                val estoqueTotalCusto = valorEstoqueInsumos + valorEstoqueProdutosCusto
                val giroEstoque = if (estoqueTotalCusto > 0.0 && vendasCustoMes > 0.0) {
                    (vendasCustoMes / estoqueTotalCusto)
                } else if (estoqueTotalCusto > 0.0 && vendasTotalMes > 0.0) {
                    ((vendasTotalMes * 0.4) / estoqueTotalCusto)
                } else 0.0

                val diasGiroEstoque = if (giroEstoque > 0.0) {
                    (30.0 / giroEstoque).coerceAtMost(365.0)
                } else 0.0

                // Indicadores de Validade de Insumos
                val hoje = LocalDate.now()
                val daqui30Dias = hoje.plusDays(30)
                var insumosVencidosCount = 0
                var insumosAVencerCount = 0
                val insumosValidadeCritica = mutableListOf<Map<String, Any?>>()

                InsumosTable.selectAll().forEach { row ->
                    val validade = row[InsumosTable.dataValidade]
                    val est = row[InsumosTable.estoque] ?: 0.0
                    if (validade != null && est > 0.0) {
                        if (validade.isBefore(hoje)) {
                            insumosVencidosCount++
                            if (insumosValidadeCritica.size < 8) {
                                insumosValidadeCritica.add(mapOf(
                                    "id" to row[InsumosTable.id],
                                    "nome" to row[InsumosTable.nome],
                                    "estoque" to est,
                                    "lote" to row[InsumosTable.lote],
                                    "dataValidade" to validade.toString(),
                                    "status" to "VENCIDO"
                                ))
                            }
                        } else if (!validade.isAfter(daqui30Dias)) {
                            insumosAVencerCount++
                            if (insumosValidadeCritica.size < 8) {
                                insumosValidadeCritica.add(mapOf(
                                    "id" to row[InsumosTable.id],
                                    "nome" to row[InsumosTable.nome],
                                    "estoque" to est,
                                    "lote" to row[InsumosTable.lote],
                                    "dataValidade" to validade.toString(),
                                    "status" to "A_VENCER"
                                ))
                            }
                        }
                    }
                }

                // Ranking dos Produtos Mais Vendidos
                val topProdutosVendidos = try {
                    PedidoItensTable.selectAll()
                        .groupBy { it[PedidoItensTable.nomeProduto] }
                        .map { (nome, itens) ->
                            val qtdTotal = itens.sumOf { it[PedidoItensTable.quantidade] }
                            val receitaTotal = itens.sumOf { it[PedidoItensTable.precoUnitario] * it[PedidoItensTable.quantidade] }
                            val custoTotal = itens.sumOf { it[PedidoItensTable.custoUnitario] * it[PedidoItensTable.quantidade] }
                            val lucroTotal = receitaTotal - custoTotal
                            mapOf(
                                "nome" to nome,
                                "quantidade" to qtdTotal,
                                "receitaTotal" to receitaTotal,
                                "custoTotal" to custoTotal,
                                "lucroTotal" to lucroTotal
                            )
                        }
                        .sortedByDescending { (it["quantidade"] as? Number)?.toDouble() ?: 0.0 }
                        .take(5)
                } catch (e: Exception) {
                    emptyList<Map<String, Any?>>()
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
                    "ticketMedio" to ticketMedio,
                    // Novos indicadores de Vendas & Lucro
                    "vendasTotalMes" to vendasTotalMes,
                    "vendasCustoMes" to vendasCustoMes,
                    "lucroBrutoMes" to lucroBrutoMes,
                    "margemLucroRealizada" to margemLucroRealizada,
                    "pedidosCount" to pedidosCount,
                    // Indicadores de Giro de Estoque
                    "giroEstoque" to giroEstoque,
                    "diasGiroEstoque" to diasGiroEstoque,
                    // Indicadores de Validade de Insumos
                    "insumosVencidosCount" to insumosVencidosCount,
                    "insumosAVencerCount" to insumosAVencerCount,
                    // Indicadores de Pedidos Pendentes de Entrega e Pagamento
                    "pedidosPendentesEntregaCount" to pedidosPendentesEntregaCount,
                    "pedidosPendentesEntregaTotal" to pedidosPendentesEntregaTotal,
                    "pedidosPendentesEntregaList" to pedidosPendentesEntregaList,
                    "pedidosPendentesPagamentoCount" to pedidosPendentesPagamentoCount,
                    "pedidosPendentesPagamentoTotal" to pedidosPendentesPagamentoTotal,
                    "pedidosPendentesPagamentoList" to pedidosPendentesPagamentoList,
                    "topProdutosVendidos" to topProdutosVendidos
                )
           }

           respond(dashboardData)
       }

       suspend fun ApplicationCall.lookupBarcode(codigoRaw: String) {
           val codigo = codigoRaw.trim()
           if (codigo.isBlank()) {
               respond(HttpStatusCode.BadRequest, mapOf("error" to "Código de barras inválido"))
               return
           }
           val resultado = transaction {
               // 1. Procurar em ProdutoVariacoesTable
               val varRow = (ProdutoVariacoesTable innerJoin ProdutosFinaisTable)
                   .select { ProdutoVariacoesTable.codigoBarras eq codigo }
                   .firstOrNull()

               if (varRow != null) {
                   val varId = varRow[ProdutoVariacoesTable.id]
                   val est = EstoqueVariacaoAuxTable.select { EstoqueVariacaoAuxTable.variacaoId eq varId }
                       .singleOrNull()?.get(EstoqueVariacaoAuxTable.estoque) ?: 0.0
                   return@transaction mapOf(
                       "encontrado" to true,
                       "tipo" to "PRODUTO",
                       "id" to varId,
                       "produtoId" to varRow[ProdutoVariacoesTable.produtoId],
                       "nome" to "${varRow[ProdutosFinaisTable.nome]} - ${varRow[ProdutoVariacoesTable.nomeTamanho]}",
                       "produtoNome" to varRow[ProdutosFinaisTable.nome],
                       "nomeTamanho" to varRow[ProdutoVariacoesTable.nomeTamanho],
                       "precoVenda" to varRow[ProdutoVariacoesTable.precoVenda],
                       "custoUnitario" to varRow[ProdutoVariacoesTable.custoUnitarioCalculado],
                       "estoque" to est,
                       "codigoBarras" to codigo
                   )
               }

               // 2. Procurar em KitsTable (por codigoBarras ou codigo)
               val kitRow = KitsTable.select { (KitsTable.codigoBarras eq codigo) or (KitsTable.codigo eq codigo) }
                   .firstOrNull()

               if (kitRow != null) {
                   val kitId = kitRow[KitsTable.id]
                   return@transaction mapOf(
                       "encontrado" to true,
                       "tipo" to "KIT",
                       "id" to kitId,
                       "nome" to kitRow[KitsTable.nome],
                       "precoVenda" to kitRow[KitsTable.precoVenda],
                       "custoUnitario" to kitRow[KitsTable.custoTotalCalculado],
                       "estoque" to 999.0,
                       "codigoBarras" to codigo
                   )
               }

               // 3. Procurar em InsumosTable
               val insumoRow = (InsumosTable leftJoin UnidadesMedidaTable)
                   .select { InsumosTable.codigoBarras eq codigo }
                   .firstOrNull()

               if (insumoRow != null) {
                   return@transaction mapOf(
                       "encontrado" to true,
                       "tipo" to "INSUMO",
                       "id" to insumoRow[InsumosTable.id],
                       "nome" to insumoRow[InsumosTable.nome],
                       "precoVenda" to insumoRow[InsumosTable.preco],
                       "custoUnitario" to insumoRow[InsumosTable.preco],
                       "estoque" to (insumoRow[InsumosTable.estoque] ?: 0.0),
                       "unidadeSigla" to insumoRow.getOrNull(UnidadesMedidaTable.sigla).orEmpty(),
                       "dataValidade" to insumoRow[InsumosTable.dataValidade]?.toString(),
                       "lote" to insumoRow[InsumosTable.lote],
                       "codigoBarras" to codigo
                   )
               }

               // 4. Procurar em UnidadesCompraInsumoTable
               val embRow = (UnidadesCompraInsumoTable innerJoin InsumosTable)
                   .select { UnidadesCompraInsumoTable.codigoBarras eq codigo }
                   .firstOrNull()

               if (embRow != null) {
                   return@transaction mapOf(
                       "encontrado" to true,
                       "tipo" to "INSUMO_EMBALAGEM",
                       "id" to embRow[InsumosTable.id],
                       "nome" to "${embRow[InsumosTable.nome]} - ${embRow[UnidadesCompraInsumoTable.nomeEmbalagem]}",
                       "precoVenda" to (embRow[UnidadesCompraInsumoTable.precoEmbalagem] ?: embRow[InsumosTable.preco]),
                       "custoUnitario" to (embRow[UnidadesCompraInsumoTable.precoEmbalagem] ?: embRow[InsumosTable.preco]),
                       "estoque" to (embRow[InsumosTable.estoque] ?: 0.0),
                       "codigoBarras" to codigo
                   )
               }

               mapOf("encontrado" to false, "mensagem" to "Nenhum produto ou insumo com o código '$codigo'")
           }

           respond(resultado)
       }

       suspend fun ApplicationCall.respondInsumosValidade() {
           val hoje = LocalDate.now()
           val daqui30 = hoje.plusDays(30)
           val resultado = transaction {
               val todos = (InsumosTable leftJoin UnidadesMedidaTable).selectAll().map {
                   val validade = it[InsumosTable.dataValidade]
                   val est = it[InsumosTable.estoque] ?: 0.0
                   val status = when {
                       validade == null -> "SEM_VALIDADE"
                       validade.isBefore(hoje) -> "VENCIDO"
                       !validade.isAfter(daqui30) -> "A_VENCER"
                       else -> "EM_DIA"
                   }
                   mapOf(
                       "id" to it[InsumosTable.id],
                       "nome" to it[InsumosTable.nome],
                       "estoque" to est,
                       "unidadeSigla" to it.getOrNull(UnidadesMedidaTable.sigla).orEmpty(),
                       "dataValidade" to validade?.toString(),
                       "lote" to it[InsumosTable.lote],
                       "codigoBarras" to it[InsumosTable.codigoBarras],
                       "status" to status
                   )
               }
               val vencidos = todos.filter { it["status"] == "VENCIDO" && ((it["estoque"] as? Number)?.toDouble() ?: 0.0) > 0 }
               val aVencer = todos.filter { it["status"] == "A_VENCER" && ((it["estoque"] as? Number)?.toDouble() ?: 0.0) > 0 }
               mapOf(
                   "totalVencidos" to vencidos.size,
                   "totalAVencer" to aVencer.size,
                   "vencidos" to vencidos,
                   "aVencer" to aVencer,
                   "todos" to todos
               )
           }
           respond(resultado)
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
            get("/codigo-barras/{codigo}") {
                val codigo = call.parameters["codigo"] ?: ""
                call.lookupBarcode(codigo)
            }
            get("/insumos/validade") {
                call.respondInsumosValidade()
            }
        }

        get("/health") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        }

        get("/dashboard/json") {
            call.respondDashboardJson()
        }

        get("/codigo-barras/{codigo}") {
            val codigo = call.parameters["codigo"] ?: ""
            call.lookupBarcode(codigo)
        }

        get("/insumos/validade") {
            call.respondInsumosValidade()
        }

        if (frontendDistExists) {
            staticFiles("/assets", File(frontendDir, "dist/assets"))
            get("{...}") {
                val path = call.request.uri.substringBefore('?').removePrefix("/")
                val candidateFile = File(frontendDir, "dist/$path")
                if (path.isNotEmpty() && candidateFile.exists() && candidateFile.isFile) {
                    call.respondFile(candidateFile)
                } else {
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
}
