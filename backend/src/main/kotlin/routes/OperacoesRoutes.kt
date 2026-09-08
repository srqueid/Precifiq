package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.repository.AppDatabase
import org.jetbrains.exposed.sql.transactions.transaction

data class ConversaoProducaoPayload(
    val produtoId: Int,
    val variacaoId: Int? = null,
    val quantidade: Double = 1.0
)

fun Route.operacoesRoutes(db: AppDatabase) {
    route("/api/operacoes") {

        // Preview da Conversão de Produção (Verificar insumos necessários e saldos)
        get("/producao/preview") {
            try {
                val produtoId = call.request.queryParameters["produtoId"]?.toIntOrNull()
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "produtoId é obrigatório"))
                val variacaoId = call.request.queryParameters["variacaoId"]?.toIntOrNull()
                val quantidade = call.request.queryParameters["quantidade"]?.toDoubleOrNull() ?: 1.0

                val produto = db.produtosFinais.lerPorId(produtoId)
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Produto não encontrado"))
                val receita = db.produtosFinais.lerInsumosDaReceita(produtoId)
                val variacao = if (variacaoId != null) db.produtosFinais.lerVariacaoPorId(variacaoId) else null

                val fator = if (variacao != null) {
                    val rendimento = if (produto.rendimentoReceitaBase > 0) produto.rendimentoReceitaBase else variacao.tamanhoMedida
                    (quantidade * variacao.tamanhoMedida) / rendimento
                } else {
                    quantidade
                }

                val insumosPreview = mutableListOf<Map<String, Any?>>()
                var estoqueInsuficiente = false

                for (item in receita) {
                    val insumo = db.insumos.lerPorId(item.insumoId)
                    if (insumo != null) {
                        val qtdNecessaria = item.quantidadeUsada * fator
                        val estoqueAtual = insumo.estoque ?: 0.0
                        val saldoApos = estoqueAtual - qtdNecessaria
                        val unidade = db.unidadesMedida.lerPorId(insumo.unidadeMedidaId)
                        val disponivel = estoqueAtual >= qtdNecessaria

                        if (!disponivel) estoqueInsuficiente = true

                        insumosPreview.add(mapOf(
                            "insumoId" to insumo.id,
                            "insumoNome" to insumo.nome,
                            "quantidadeNecessaria" to qtdNecessaria,
                            "unidadeSigla" to (unidade?.sigla ?: "ml"),
                            "estoqueAtual" to estoqueAtual,
                            "saldoApos" to saldoApos,
                            "disponivel" to disponivel
                        ))
                    }
                }

                if (variacao?.embalagemInsumoId != null) {
                    val embalagem = db.insumos.lerPorId(variacao.embalagemInsumoId!!)
                    if (embalagem != null) {
                        val estoqueAtual = embalagem.estoque ?: 0.0
                        val saldoApos = estoqueAtual - quantidade
                        val unidade = db.unidadesMedida.lerPorId(embalagem.unidadeMedidaId)
                        val disponivel = estoqueAtual >= quantidade

                        if (!disponivel) estoqueInsuficiente = true

                        insumosPreview.add(mapOf(
                            "insumoId" to embalagem.id,
                            "insumoNome" to embalagem.nome,
                            "quantidadeNecessaria" to quantidade,
                            "unidadeSigla" to (unidade?.sigla ?: "un"),
                            "estoqueAtual" to estoqueAtual,
                            "saldoApos" to saldoApos,
                            "disponivel" to disponivel,
                            "isEmbalagem" to true
                        ))
                    }
                }

                call.respond(mapOf(
                    "produtoNome" to produto.nome,
                    "variacaoNome" to (variacao?.nomeTamanho ?: "Batelada"),
                    "quantidade" to quantidade,
                    "estoqueInsuficiente" to estoqueInsuficiente,
                    "insumos" to insumosPreview
                ))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao gerar preview: ${e.message}"))
            }
        }

        // RF11: Executa a Ordem de Produção / Conversão de Insumos em Produto Acabado
        post("/producao/converter") {
            try {
                val payload = call.receive<ConversaoProducaoPayload>()
                val produtoId = payload.produtoId
                val variacaoId = payload.variacaoId
                val quantidade = if (payload.quantidade <= 0) 1.0 else payload.quantidade

                val produto = db.produtosFinais.lerPorId(produtoId)
                    ?: return@post call.respond(HttpStatusCode.NotFound, mapOf("error" to "Produto base não encontrado."))
                val receita = db.produtosFinais.lerInsumosDaReceita(produtoId)

                if (receita.isEmpty()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O produto '${produto.nome}' não possui insumos na Ficha Técnica."))
                }

                val variacao = if (variacaoId != null) db.produtosFinais.lerVariacaoPorId(variacaoId) else null

                // Fator de proporção da receita
                val fator = if (variacao != null) {
                    val rendimento = if (produto.rendimentoReceitaBase > 0) produto.rendimentoReceitaBase else variacao.tamanhoMedida
                    (quantidade * variacao.tamanhoMedida) / rendimento
                } else {
                    quantidade
                }

                // Monta lista de itens para consumo atômico
                val itensConsumo = mutableListOf<org.example.services.ItemConsumoProducao>()
                for (item in receita) {
                    val qtdDebitar = item.quantidadeUsada * fator
                    itensConsumo.add(org.example.services.ItemConsumoProducao(item.insumoId, qtdDebitar, isEmbalagem = false))
                }

                if (variacao != null) {
                    val materiais = db.produtosFinais.lerMateriaisDaVariacao(variacao.id)
                    if (materiais.isNotEmpty()) {
                        for (mat in materiais) {
                            val qtdDebitar = mat.quantidade * quantidade
                            itensConsumo.add(org.example.services.ItemConsumoProducao(mat.insumoId, qtdDebitar, isEmbalagem = true))
                        }
                    } else if (variacao.embalagemInsumoId != null) {
                        itensConsumo.add(org.example.services.ItemConsumoProducao(variacao.embalagemInsumoId!!, quantidade, isEmbalagem = true))
                    }
                }

                var novoEstoqueProduto: Double? = null

                // Executa a baixa atômica com locks FOR UPDATE e gravação no ledger
                val debitados = transaction {
                    val resultados = db.estoque.consumirInsumosParaProducao(
                        itens = itensConsumo,
                        ordemProducaoId = produtoId,
                        motivo = "Produção de ${quantidade}x '${variacao?.nomeTamanho ?: produto.nome}'"
                    )

                    // Creditar saldo do produto acabado
                    if (variacao != null) {
                        val estoqueAtualProd = variacao.estoque
                        novoEstoqueProduto = estoqueAtualProd + quantidade
                        db.produtosFinais.atualizarEstoqueVariacao(variacao.id, novoEstoqueProduto!!)
                    }

                    resultados
                }

                call.respond(HttpStatusCode.OK, mapOf(
                    "status" to "success",
                    "message" to "Conversão de produção executada com sucesso!",
                    "produtoNome" to produto.nome,
                    "variacaoNome" to (variacao?.nomeTamanho ?: "Batelada"),
                    "quantidadeProduzida" to quantidade,
                    "novoEstoqueProduto" to novoEstoqueProduto,
                    "insumosDebitados" to debitados
                ))

            } catch (e: IllegalStateException) {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Saldo de insumo insuficiente.")))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao converter produção: ${e.message}"))
            }
        }

        // RF10: Retorna a lista de insumos abaixo do estoque mínimo
        get("/estoque/alertas") {
            try {
                val insumos = db.insumos.lerTodos()
                val unidades = db.unidadesMedida.lerTodos().associateBy { it.id }
                val alertas = insumos.filter { i ->
                    val min = if ((i.estoqueMinimo ?: 0.0) > 0.0) i.estoqueMinimo!! else 5.0
                    (i.estoque ?: 0.0) <= min
                }.map { i ->
                    val min = if ((i.estoqueMinimo ?: 0.0) > 0.0) i.estoqueMinimo!! else 5.0
                    mapOf(
                        "id" to i.id,
                        "nome" to i.nome,
                        "estoque" to (i.estoque ?: 0.0),
                        "estoqueMinimo" to min,
                        "unidadeSigla" to (unidades[i.unidadeMedidaId]?.sigla ?: ""),
                        "isEmbalagem" to i.isEmbalagem,
                        "status" to if ((i.estoque ?: 0.0) == 0.0) "ZERADO" else "BAIXO"
                    )
                }
                call.respond(mapOf("alertas" to alertas))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao buscar alertas: ${e.message}"))
            }
        }
    }
}
