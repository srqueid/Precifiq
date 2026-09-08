package org.example.services

import org.example.*
import org.example.repository.AppDatabase
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

class PrevisaoService(
    private val appDb: AppDatabase,
    private val geminiService: GeminiService
) {
    fun analisarPrevisaoDashboard(): PrevisaoDashboardResponse = transaction {
        val insumos = appDb.insumos.lerTodos()
        val unidadesMap = appDb.unidadesMedida.lerTodos().associateBy { it.id }
        val fornecedoresMap = appDb.fornecedores.lerTodos().associateBy { it.id }

        // 1. Busca consumo diário dos últimos 30 dias na tabela de movimentos
        val dataLimite = LocalDateTime.now().minusDays(30)
        val movimentosConsumo = MovimentosEstoqueInsumoTable
            .select { 
                (MovimentosEstoqueInsumoTable.tipo eq TipoMovimentoEstoque.SAIDA_PRODUCAO.valor) and
                (MovimentosEstoqueInsumoTable.criadoEm greaterEq dataLimite)
            }
            .toList()

        val consumoPorInsumo = movimentosConsumo
            .groupBy { it[MovimentosEstoqueInsumoTable.insumoId] }
            .mapValues { (_, rows) -> rows.sumOf { it[MovimentosEstoqueInsumoTable.quantidade] } }

        val diasAnalise = 30.0

        val itensRuptura = mutableListOf<ItemPrevisaoRupturaDTO>()

        for (insumo in insumos) {
            val unidade = unidadesMap[insumo.unidadeMedidaId]
            val sigla = unidade?.sigla ?: "UN"
            val fornecedor = fornecedoresMap[insumo.fornecedorId]

            val estoqueAtual = insumo.estoque ?: 0.0
            val estoqueMinimo = if ((insumo.estoqueMinimo ?: 0.0) > 0.0) insumo.estoqueMinimo!! else 5.0
            
            // Consumo diário apurado
            val totalConsumo30d = consumoPorInsumo[insumo.id] ?: 0.0
            val consumoMedioDiario = totalConsumo30d / diasAnalise

            val diasAteRuptura: Int?
            val nivelRisco: String
            val dataEstimada: String?

            if (estoqueAtual <= 0.0) {
                diasAteRuptura = 0
                nivelRisco = "CRITICO"
                dataEstimada = "Imediata (Esgotado)"
            } else if (consumoMedioDiario > 0.0) {
                val dias = (estoqueAtual / consumoMedioDiario).toInt()
                diasAteRuptura = dias
                nivelRisco = when {
                    dias <= 7 -> "CRITICO"
                    dias <= 15 -> "ALERTA"
                    else -> "NORMAL"
                }
                dataEstimada = LocalDate.now().plusDays(dias.toLong()).format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
            } else {
                // Sem consumo nos últimos 30 dias: avalia pelo estoque mínimo cadastrado
                if (estoqueAtual <= estoqueMinimo) {
                    diasAteRuptura = 0
                    nivelRisco = "CRITICO"
                    dataEstimada = "Abaixo do Mínimo"
                } else if (estoqueAtual <= estoqueMinimo * 1.5) {
                    diasAteRuptura = 14
                    nivelRisco = "ALERTA"
                    dataEstimada = "Próximo ao Mínimo"
                } else {
                    diasAteRuptura = null
                    nivelRisco = "NORMAL"
                    dataEstimada = null
                }
            }

            // Quantidade sugerida para compra: cobertura para 30 dias acima do estoque mínimo
            val qtdNecessaria = maxOf(estoqueMinimo * 2.0, consumoMedioDiario * 30.0 + estoqueMinimo) - estoqueAtual
            val qtdSugeridaBase = if (qtdNecessaria > 0) qtdNecessaria else (estoqueMinimo * 2.0)
            
            // Arredonda para múltiplo do tamanho da embalagem se cadastrado
            val qtdEmbalagem = insumo.quantidadePorEmbalagem ?: 1.0
            val embalagens = if (qtdEmbalagem > 0) Math.ceil(qtdSugeridaBase / qtdEmbalagem) else 1.0
            val quantidadeSugerida = if (qtdEmbalagem > 0) (embalagens * qtdEmbalagem) else qtdSugeridaBase

            if (nivelRisco != "NORMAL") {
                itensRuptura.add(
                    ItemPrevisaoRupturaDTO(
                        insumoId = insumo.id,
                        insumoNome = insumo.nome,
                        unidadeSigla = sigla,
                        estoqueAtual = estoqueAtual,
                        estoqueMinimo = estoqueMinimo,
                        consumoMedioDiario = (consumoMedioDiario * 100).toInt() / 100.0,
                        diasAteRuptura = diasAteRuptura,
                        dataEstimadaRuptura = dataEstimada,
                        nivelRisco = nivelRisco,
                        quantidadeSugeridaCompra = quantidadeSugerida,
                        fornecedorSugeridoId = fornecedor?.id,
                        fornecedorSugeridoNome = fornecedor?.nome,
                        justificativaIa = if (diasAteRuptura != null && diasAteRuptura <= 7) {
                            "Risco crítico de interrupção da produção em ${maxOf(1, diasAteRuptura)} dia(s)."
                        } else {
                            "Saldo de segurança em nível de atenção."
                        }
                    )
                )
            }
        }

        // Ordena por criticidade: CRITICO primeiro, depois menor número de dias
        itensRuptura.sortWith(compareBy<ItemPrevisaoRupturaDTO> { if (it.nivelRisco == "CRITICO") 0 else 1 }
            .thenBy { it.diasAteRuptura ?: 999 })

        // 2. Análise de Margens Comprimidas nos Produtos Finais
        val produtos = appDb.produtosFinais.lerTodos().associateBy { it.id }
        val variacoes = appDb.produtosFinais.lerTodasVariacoes()
        val alertasMargem = mutableListOf<AlertaMargemDTO>()

        for (v in variacoes) {
            val p = produtos[v.produtoId] ?: continue
            val custo = v.custoUnitarioCalculado
            val preco = v.precoVenda
            val margemAtual = v.margemLucro
            val margemAlvo = 30.0

            val precoSugerido = if (custo > 0.0) {
                custo / (1.0 - (margemAlvo / 100.0))
            } else preco

            if (preco < custo) {
                alertasMargem.add(
                    AlertaMargemDTO(
                        variacaoId = v.id,
                        produtoId = p.id,
                        produtoNome = p.nome,
                        nomeTamanho = v.nomeTamanho,
                        custoUnitario = custo,
                        precoVenda = preco,
                        margemAtual = margemAtual,
                        margemAlvo = margemAlvo,
                        precoSugerido = (precoSugerido * 100).toInt() / 100.0,
                        impacto = "PREJUIZO",
                        justificativa = "Custo unitário (R$ ${"%.2f".format(Locale.US, custo)}) excede o preço de venda atual (R$ ${"%.2f".format(Locale.US, preco)})."
                    )
                )
            } else if (margemAtual < margemAlvo && custo > 0.0) {
                alertasMargem.add(
                    AlertaMargemDTO(
                        variacaoId = v.id,
                        produtoId = p.id,
                        produtoNome = p.nome,
                        nomeTamanho = v.nomeTamanho,
                        custoUnitario = custo,
                        precoVenda = preco,
                        margemAtual = margemAtual,
                        margemAlvo = margemAlvo,
                        precoSugerido = (precoSugerido * 100).toInt() / 100.0,
                        impacto = "MARGEM_BAIXA",
                        justificativa = "Margem de ${"%.1f".format(Locale.US, margemAtual)}% abaixo da meta de rentabilidade de 30%."
                    )
                )
            }
        }

        // Ordena alertas de margem: PREJUIZO primeiro, depois menor margem
        alertasMargem.sortWith(compareBy<AlertaMargemDTO> { if (it.impacto == "PREJUIZO") 0 else 1 }
            .thenBy { it.margemAtual })

        // 3. Resumo Executivo da IA
        val resumoIa = geminiService.gerarInsightsEstrategicos(
            itensRuptura = itensRuptura,
            alertasMargem = alertasMargem,
            totalInsumos = insumos.size,
            totalProdutos = variacoes.size
        )

        PrevisaoDashboardResponse(
            geradoEm = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")),
            totalItensCriticos = itensRuptura.count { it.nivelRisco == "CRITICO" },
            totalItensAlerta = itensRuptura.count { it.nivelRisco == "ALERTA" },
            totalProdutosMargemBaixa = alertasMargem.size,
            resumoExecutivoIa = resumoIa,
            itensRuptura = itensRuptura,
            alertasMargem = alertasMargem
        )
    }

    fun gerarOrcamentoCompraParaItensCriticos(insumoIds: List<Int>? = null): GerarOrcamentoPrevisaoResponse = transaction {
        val analise = analisarPrevisaoDashboard()
        val itensAlvo = if (!insumoIds.isNullOrEmpty()) {
            analise.itensRuptura.filter { it.insumoId in insumoIds }
        } else {
            analise.itensRuptura.filter { it.nivelRisco in listOf("CRITICO", "ALERTA") }
        }

        if (itensAlvo.isEmpty()) {
            return@transaction GerarOrcamentoPrevisaoResponse(
                success = false,
                orcamentoId = null,
                itensAdicionados = 0,
                message = "Nenhum insumo em estado crítico ou de alerta foi encontrado para reposição."
            )
        }

        val novoOrcamento = appDb.orcamentos.criarOrcamento(
            OrcamentoCompra(
                id = 0,
                titulo = "Reposição IA - ${LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))}",
                dataCriacao = LocalDateTime.now(),
                status = StatusOrcamento.EM_DIGITACAO,
                observacoes = "Orçamento gerado automaticamente pelo Assistente Preditivo da IA para prevenir ruptura de estoque."
            )
        )

        for (item in itensAlvo) {
            appDb.orcamentos.adicionarItem(
                orcamentoId = novoOrcamento.id,
                insumoId = item.insumoId,
                quantidade = item.quantidadeSugeridaCompra
            )
        }

        GerarOrcamentoPrevisaoResponse(
            success = true,
            orcamentoId = novoOrcamento.id,
            itensAdicionados = itensAlvo.size,
            message = "Orçamento #${novoOrcamento.id} gerado com sucesso com ${itensAlvo.size} insumo(s) crítico(s)!"
        )
    }
}
