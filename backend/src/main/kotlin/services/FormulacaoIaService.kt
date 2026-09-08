package org.example.services

import org.example.*
import org.example.repository.AppDatabase
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

class FormulacaoIaService(
    private val appDb: AppDatabase,
    private val geminiService: GeminiService
) {

    /**
     * Identifica os insumos com estoque positivo no sistema e consulta o Gemini para sugerir
     * formulações e substituições compatíveis para os itens com déficit.
     */
    fun sugerirSubstitutos(req: SugerirSubstitutosRequest): SugerirSubstitutosResponse = transaction {
        val produto = appDb.produtosFinais.lerPorId(req.produtoId)
        val produtoNome = req.produtoNome ?: produto?.nome ?: "Produto #${req.produtoId}"

        val faltantes = if (!req.itensFaltantes.isNullOrEmpty()) {
            req.itensFaltantes
        } else {
            val receita: List<ReceitaInsumo> = appDb.produtosFinais.lerInsumosDaReceita(req.produtoId)
            val todosInsumos = appDb.insumos.lerTodos().associateBy { it.id }
            val unidades = appDb.unidadesMedida.lerTodos().associateBy { it.id }
            val qtdProduzir = if (req.quantidadeProduzir > 0.0) req.quantidadeProduzir else 1.0

            receita.mapNotNull { item: ReceitaInsumo ->
                val insumo = todosInsumos[item.insumoId]
                if (insumo != null) {
                    val qtdNecessaria = item.quantidadeUsada * qtdProduzir
                    val saldoAtual = insumo.estoque ?: 0.0
                    val deficit = qtdNecessaria - saldoAtual
                    if (deficit > 0.001) {
                        ItemInsumoFaltanteDTO(
                            insumoId = insumo.id,
                            insumoNome = insumo.nome,
                            quantidadeNecessaria = qtdNecessaria,
                            saldoAtual = saldoAtual,
                            deficit = deficit,
                            unidadeSigla = unidades[insumo.unidadeMedidaId]?.sigla ?: "un",
                            isEmbalagem = insumo.isEmbalagem
                        )
                    } else null
                } else null
            }
        }

        val rows = InsumosTable.join(
            UnidadesMedidaTable,
            JoinType.LEFT,
            InsumosTable.unidadeMedidaId,
            UnidadesMedidaTable.id
        ).select { (InsumosTable.estoque greater 0.0) }
         .toList()

        val insumosDisponiveis = rows.map { r ->
            InsumoResumoDTO(
                id = r[InsumosTable.id],
                nome = r[InsumosTable.nome],
                unidadeMedidaId = r[InsumosTable.unidadeMedidaId],
                unidadeSigla = r.getOrNull(UnidadesMedidaTable.sigla) ?: "un",
                precoAtual = r[InsumosTable.preco],
                estoqueAtual = r[InsumosTable.estoque] ?: 0.0,
                isEmbalagem = r[InsumosTable.isEmbalagem]
            )
        }

        val (parecer, sugestoes) = geminiService.sugerirSubstitutosFormulacao(
            produtoNome = produtoNome,
            itensFaltantes = faltantes,
            insumosDisponiveis = insumosDisponiveis
        )

        SugerirSubstitutosResponse(
            sucesso = true,
            parecerGeralIa = parecer,
            sugestoes = sugestoes
        )
    }

    /**
     * Executa a conversão de produção debitando os insumos substitutos aprovados pelo operador,
     * sem alterar a receita master cadastrada no banco de dados.
     */
    fun executarProducaoComSubstitutos(
        req: ConversaoProducaoComSubstitutosRequest,
        usuarioId: Int? = null
    ): ConversaoProducaoComSubstitutosResponse = transaction {
        val produto = appDb.produtosFinais.lerPorId(req.produtoId)
            ?: throw NoSuchElementException("Produto #${req.produtoId} não encontrado.")

        val receita = appDb.produtosFinais.lerInsumosDaReceita(req.produtoId)
        if (receita.isEmpty()) {
            throw IllegalStateException("O produto '${produto.nome}' não possui insumos cadastrados na Ficha Técnica.")
        }

        val variacao = if (req.variacaoId != null) appDb.produtosFinais.lerVariacaoPorId(req.variacaoId) else null
        val quantidade = if (req.quantidade <= 0) 1.0 else req.quantidade

        // Fator de escala da receita
        val fator = if (variacao != null) {
            val rendimento = if (produto.rendimentoReceitaBase > 0) produto.rendimentoReceitaBase else variacao.tamanhoMedida
            (quantidade * variacao.tamanhoMedida) / rendimento
        } else {
            quantidade
        }

        val mapaSubstituicoes = req.substituicoes.associateBy { it.insumoOriginalId }

        // Monta lista de consumo adaptada
        val itensConsumo = mutableListOf<ItemConsumoProducao>()
        val nomesSubstitutosUsados = mutableListOf<String>()

        for (item in receita) {
            val substituicao = mapaSubstituicoes[item.insumoId]
            if (substituicao != null) {
                // Usa o insumo substituto
                itensConsumo.add(
                    ItemConsumoProducao(
                        insumoId = substituicao.insumoSubstitutoId,
                        quantidadeNecessariaBase = substituicao.quantidadeSubstituta,
                        isEmbalagem = false
                    )
                )
                val insumoOrig = appDb.insumos.lerPorId(item.insumoId)
                val insumoSub = appDb.insumos.lerPorId(substituicao.insumoSubstitutoId)
                nomesSubstitutosUsados.add("'${insumoOrig?.nome}' ➔ '${insumoSub?.nome}'")
            } else {
                // Mantém o insumo original da receita
                val qtdDebitar = item.quantidadeUsada * fator
                itensConsumo.add(
                    ItemConsumoProducao(
                        insumoId = item.insumoId,
                        quantidadeNecessariaBase = qtdDebitar,
                        isEmbalagem = false
                    )
                )
            }
        }

        // Se houver embalagem fracionada
        if (variacao?.embalagemInsumoId != null) {
            val subEmb = mapaSubstituicoes[variacao.embalagemInsumoId]
            if (subEmb != null) {
                itensConsumo.add(
                    ItemConsumoProducao(
                        insumoId = subEmb.insumoSubstitutoId,
                        quantidadeNecessariaBase = subEmb.quantidadeSubstituta,
                        isEmbalagem = true
                    )
                )
                val embOrig = appDb.insumos.lerPorId(variacao.embalagemInsumoId!!)
                val embSub = appDb.insumos.lerPorId(subEmb.insumoSubstitutoId)
                nomesSubstitutosUsados.add("Embalagem: '${embOrig?.nome}' ➔ '${embSub?.nome}'")
            } else {
                itensConsumo.add(
                    ItemConsumoProducao(
                        insumoId = variacao.embalagemInsumoId!!,
                        quantidadeNecessariaBase = quantidade,
                        isEmbalagem = true
                    )
                )
            }
        }

        val motivoAuditoria = if (nomesSubstitutosUsados.isNotEmpty()) {
            "Produção de ${quantidade}x '${variacao?.nomeTamanho ?: produto.nome}' com Substituição IA: ${nomesSubstitutosUsados.joinToString(", ")}"
        } else {
            "Produção de ${quantidade}x '${variacao?.nomeTamanho ?: produto.nome}'"
        }

        // Executa a baixa atômica
        val debitados = appDb.estoque.consumirInsumosParaProducao(
            itens = itensConsumo,
            ordemProducaoId = produto.id,
            usuarioId = usuarioId,
            motivo = motivoAuditoria
        )

        // Credita saldo do produto acabado
        var novoEstoqueProduto: Double? = null
        if (variacao != null) {
            val estoqueAtual = variacao.estoque
            novoEstoqueProduto = estoqueAtual + quantidade
            appDb.produtosFinais.atualizarEstoqueVariacao(variacao.id, novoEstoqueProduto)
        }

        ConversaoProducaoComSubstitutosResponse(
            status = "success",
            message = "Ordem de Produção concluída com sucesso utilizando a formulação adaptada pela IA!",
            produtoNome = produto.nome,
            variacaoNome = variacao?.nomeTamanho ?: "Batelada",
            quantidadeProduzida = quantidade,
            novoEstoqueProduto = novoEstoqueProduto,
            insumosDebitados = debitados
        )
    }
}
