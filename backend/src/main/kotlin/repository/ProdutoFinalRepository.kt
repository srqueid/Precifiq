package org.example.repository

import org.example.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

class ProdutoFinalRepository {
    fun lerTodos(): List<ProdutoFinal> = transaction {
        ProdutosFinaisTable.selectAll().map {
            ProdutoFinal(
                id = it[ProdutosFinaisTable.id],
                nome = it[ProdutosFinaisTable.nome],
                descricao = it[ProdutosFinaisTable.descricao],
                rendimentoReceitaBase = it[ProdutosFinaisTable.rendimentoReceitaBase],
                rotulo = it[ProdutosFinaisTable.rotulo]
            )
        }
    }

    fun lerPorId(id: Int): ProdutoFinal? = transaction {
        ProdutosFinaisTable.select { ProdutosFinaisTable.id eq id }.singleOrNull()?.let {
            ProdutoFinal(
                id = it[ProdutosFinaisTable.id],
                nome = it[ProdutosFinaisTable.nome],
                descricao = it[ProdutosFinaisTable.descricao],
                rendimentoReceitaBase = it[ProdutosFinaisTable.rendimentoReceitaBase],
                rotulo = it[ProdutosFinaisTable.rotulo]
            )
        }
    }

    fun criar(p: ProdutoFinal) = transaction {
        val produtoId = ProdutosFinaisTable.insert {
            it[nome] = p.nome
            it[descricao] = p.descricao
            it[rendimentoReceitaBase] = p.rendimentoReceitaBase
            it[rotulo] = p.rotulo
        }[ProdutosFinaisTable.id]

        // Busca o ID da unidade "un" ou usa 1 como fallback
        val unidadeId = UnidadesMedidaTable.select { UnidadesMedidaTable.sigla eq "un" }
            .singleOrNull()?.get(UnidadesMedidaTable.id) ?: 1

        // Cria uma variação padrão
        ProdutoVariacoesTable.insert {
            it[ProdutoVariacoesTable.produtoId] = produtoId
            it[nomeTamanho] = "Padrão"
            it[tamanhoMedida] = 1.0
            it[unidadeMedidaTamanhoId] = unidadeId
            it[precoVenda] = 0.0
        }
    }

    fun atualizarProdutoBase(id: Int, nome: String, descricao: String, rendimento: Double) = transaction {
        ProdutosFinaisTable.update({ ProdutosFinaisTable.id eq id }) {
            it[ProdutosFinaisTable.nome] = nome
            it[ProdutosFinaisTable.descricao] = descricao
            it[ProdutosFinaisTable.rendimentoReceitaBase] = rendimento
        }
    }

    fun atualizarRotulo(id: Int, rotulo: String?) = transaction {
        ProdutosFinaisTable.update({ ProdutosFinaisTable.id eq id }) {
            it[ProdutosFinaisTable.rotulo] = rotulo
        }
    }

    fun deletarProdutoBase(id: Int) = transaction {
        ProdutosFinaisTable.deleteWhere { Op.build { ProdutosFinaisTable.id eq id } }
    }

    fun lerInsumosDaReceita(produtoId: Int): List<ReceitaInsumo> = transaction {
        (ReceitaInsumosTable innerJoin InsumosTable)
            .select { ReceitaInsumosTable.produtoId eq produtoId }
            .map {
                ReceitaInsumo(
                    id = it[ReceitaInsumosTable.id],
                    produtoId = it[ReceitaInsumosTable.produtoId],
                    insumoId = it[ReceitaInsumosTable.insumoId],
                    quantidadeUsada = it[ReceitaInsumosTable.quantidadeUsada],
                    insumoNome = it[InsumosTable.nome]
                )
            }
    }

    fun adicionarInsumoNaReceita(produtoId: Int, insumoId: Int, quantidadeUsada: Double) = transaction {
        ReceitaInsumosTable.insert {
            it[ReceitaInsumosTable.produtoId] = produtoId
            it[ReceitaInsumosTable.insumoId] = insumoId
            it[ReceitaInsumosTable.quantidadeUsada] = quantidadeUsada
        }
    }

    fun removerInsumoDaReceita(id: Int) = transaction {
        ReceitaInsumosTable.deleteWhere { Op.build { ReceitaInsumosTable.id eq id } }
    }

    fun atualizarInsumoNaReceita(id: Int, quantidadeUsada: Double) = transaction {
        ReceitaInsumosTable.update({ ReceitaInsumosTable.id eq id }) {
            it[ReceitaInsumosTable.quantidadeUsada] = quantidadeUsada
        }
    }

    fun lerTodasVariacoes(): List<ProdutoVariacao> = transaction {
        val estoqueMap = try {
            org.example.EstoqueVariacaoAuxTable.selectAll().associate {
                it[org.example.EstoqueVariacaoAuxTable.variacaoId] to it[org.example.EstoqueVariacaoAuxTable.estoque]
            }
        } catch (e: Exception) {
            emptyMap()
        }

        ProdutoVariacoesTable.selectAll().map {
            val varId = it[ProdutoVariacoesTable.id]
            ProdutoVariacao(
                id = varId,
                produtoId = it[ProdutoVariacoesTable.produtoId],
                nomeTamanho = it[ProdutoVariacoesTable.nomeTamanho],
                tamanhoMedida = it[ProdutoVariacoesTable.tamanhoMedida],
                unidadeMedidaTamanhoId = it[ProdutoVariacoesTable.unidadeMedidaTamanhoId],
                embalagemInsumoId = it[ProdutoVariacoesTable.embalagemInsumoId],
                tempoProducaoMinutos = it[ProdutoVariacoesTable.tempoProducaoMinutos],
                margemLucro = it[ProdutoVariacoesTable.margemLucro],
                precoVenda = it[ProdutoVariacoesTable.precoVenda],
                custoUnitarioCalculado = it[ProdutoVariacoesTable.custoUnitarioCalculado],
                estoque = estoqueMap[varId] ?: 0.0,
                codigoBarras = it[ProdutoVariacoesTable.codigoBarras],
                materiais = lerMateriaisDaVariacao(varId)
            )
        }
    }

    fun lerVariacoesDoProduto(produtoId: Int): List<ProdutoVariacao> = transaction {
        val estoqueMap = try {
            org.example.EstoqueVariacaoAuxTable.selectAll().associate {
                it[org.example.EstoqueVariacaoAuxTable.variacaoId] to it[org.example.EstoqueVariacaoAuxTable.estoque]
            }
        } catch (e: Exception) {
            emptyMap()
        }

        ProdutoVariacoesTable.select { ProdutoVariacoesTable.produtoId eq produtoId }.map {
            val varId = it[ProdutoVariacoesTable.id]
            ProdutoVariacao(
                id = varId,
                produtoId = it[ProdutoVariacoesTable.produtoId],
                nomeTamanho = it[ProdutoVariacoesTable.nomeTamanho],
                tamanhoMedida = it[ProdutoVariacoesTable.tamanhoMedida],
                unidadeMedidaTamanhoId = it[ProdutoVariacoesTable.unidadeMedidaTamanhoId],
                embalagemInsumoId = it[ProdutoVariacoesTable.embalagemInsumoId],
                tempoProducaoMinutos = it[ProdutoVariacoesTable.tempoProducaoMinutos],
                margemLucro = it[ProdutoVariacoesTable.margemLucro],
                precoVenda = it[ProdutoVariacoesTable.precoVenda],
                custoUnitarioCalculado = it[ProdutoVariacoesTable.custoUnitarioCalculado],
                estoque = estoqueMap[varId] ?: 0.0,
                codigoBarras = it[ProdutoVariacoesTable.codigoBarras],
                materiais = lerMateriaisDaVariacao(varId)
            )
        }
    }

    fun lerVariacaoPorId(id: Int): ProdutoVariacao? = transaction {
        val estoqueVal = try {
            org.example.EstoqueVariacaoAuxTable.select { org.example.EstoqueVariacaoAuxTable.variacaoId eq id }
                .singleOrNull()?.get(org.example.EstoqueVariacaoAuxTable.estoque) ?: 0.0
        } catch (e: Exception) {
            0.0
        }

        ProdutoVariacoesTable.select { ProdutoVariacoesTable.id eq id }.singleOrNull()?.let {
            ProdutoVariacao(
                id = it[ProdutoVariacoesTable.id],
                produtoId = it[ProdutoVariacoesTable.produtoId],
                nomeTamanho = it[ProdutoVariacoesTable.nomeTamanho],
                tamanhoMedida = it[ProdutoVariacoesTable.tamanhoMedida],
                unidadeMedidaTamanhoId = it[ProdutoVariacoesTable.unidadeMedidaTamanhoId],
                embalagemInsumoId = it[ProdutoVariacoesTable.embalagemInsumoId],
                tempoProducaoMinutos = it[ProdutoVariacoesTable.tempoProducaoMinutos],
                margemLucro = it[ProdutoVariacoesTable.margemLucro],
                precoVenda = it[ProdutoVariacoesTable.precoVenda],
                custoUnitarioCalculado = it[ProdutoVariacoesTable.custoUnitarioCalculado],
                estoque = estoqueVal,
                codigoBarras = it[ProdutoVariacoesTable.codigoBarras],
                materiais = lerMateriaisDaVariacao(id)
            )
        }
    }

    fun lerMateriaisDaVariacao(variacaoId: Int): List<VariacaoMaterial> = transaction {
        try {
            val rows = VariacaoMateriaisTable
                .innerJoin(InsumosTable, { VariacaoMateriaisTable.insumoId }, { InsumosTable.id })
                .select { VariacaoMateriaisTable.variacaoId eq variacaoId }
                .toList()

            val unidadeIds = rows.map { it[InsumosTable.unidadeMedidaId] }.distinct()
            val unidadesMap = if (unidadeIds.isNotEmpty()) {
                UnidadesMedidaTable
                    .select { UnidadesMedidaTable.id inList unidadeIds }
                    .associate { it[UnidadesMedidaTable.id] to it[UnidadesMedidaTable.sigla] }
            } else emptyMap()

            val lista = rows.map {
                val preco = it[InsumosTable.preco]
                val qtdEmb = it[InsumosTable.quantidadePorEmbalagem]?.takeIf { q -> q > 0 } ?: 1.0
                val qtdUsada = it[VariacaoMateriaisTable.quantidade]
                val custoUnitario = (preco / qtdEmb) * qtdUsada
                val uId = it[InsumosTable.unidadeMedidaId]
                VariacaoMaterial(
                    id = it[VariacaoMateriaisTable.id],
                    variacaoId = it[VariacaoMateriaisTable.variacaoId],
                    insumoId = it[VariacaoMateriaisTable.insumoId],
                    quantidade = qtdUsada,
                    insumoNome = it[InsumosTable.nome],
                    unidadeSigla = unidadesMap[uId] ?: "un",
                    custoUnitario = custoUnitario
                )
            }

            if (lista.isNotEmpty()) {
                lista
            } else {
                // Compatibilidade com embalagem legada única se houver
                val v = ProdutoVariacoesTable.select { ProdutoVariacoesTable.id eq variacaoId }.singleOrNull()
                val embId = v?.get(ProdutoVariacoesTable.embalagemInsumoId)
                if (embId != null) {
                    val insumo = InsumosTable.select { InsumosTable.id eq embId }.singleOrNull()
                    if (insumo != null) {
                        val preco = insumo[InsumosTable.preco]
                        val qtdEmb = insumo[InsumosTable.quantidadePorEmbalagem]?.takeIf { q -> q > 0 } ?: 1.0
                        val uId = insumo[InsumosTable.unidadeMedidaId]
                        val sigla = UnidadesMedidaTable.select { UnidadesMedidaTable.id eq uId }.singleOrNull()?.get(UnidadesMedidaTable.sigla) ?: "un"
                        listOf(
                            VariacaoMaterial(
                                id = 0,
                                variacaoId = variacaoId,
                                insumoId = embId,
                                quantidade = 1.0,
                                insumoNome = insumo[InsumosTable.nome],
                                unidadeSigla = sigla,
                                custoUnitario = preco / qtdEmb
                            )
                        )
                    } else emptyList()
                } else emptyList()
            }
        } catch (e: Exception) {
            println("Erro ao ler materiais da variação $variacaoId: ${e.message}")
            emptyList()
        }
    }

    fun salvarMateriaisDaVariacao(variacaoId: Int, materiais: List<VariacaoMaterial>) = transaction {
        try {
            VariacaoMateriaisTable.deleteWhere { Op.build { VariacaoMateriaisTable.variacaoId eq variacaoId } }
            for (m in materiais) {
                if (m.insumoId > 0 && m.quantidade > 0) {
                    VariacaoMateriaisTable.insert {
                        it[VariacaoMateriaisTable.variacaoId] = variacaoId
                        it[VariacaoMateriaisTable.insumoId] = m.insumoId
                        it[VariacaoMateriaisTable.quantidade] = m.quantidade
                    }
                }
            }
        } catch (e: Exception) {
            println("Aviso ao salvar materiais da variação $variacaoId: ${e.message}")
        }
    }

    fun criarVariacao(v: ProdutoVariacao): Int = transaction {
        val novoId = ProdutoVariacoesTable.insert {
            it[produtoId] = v.produtoId
            it[nomeTamanho] = v.nomeTamanho
            it[tamanhoMedida] = v.tamanhoMedida
            it[unidadeMedidaTamanhoId] = v.unidadeMedidaTamanhoId
            it[embalagemInsumoId] = v.embalagemInsumoId
            it[tempoProducaoMinutos] = v.tempoProducaoMinutos
            it[margemLucro] = v.margemLucro
            it[precoVenda] = v.precoVenda
            it[custoUnitarioCalculado] = v.custoUnitarioCalculado
            it[codigoBarras] = v.codigoBarras?.takeIf { c -> c.isNotBlank() }
        } get ProdutoVariacoesTable.id

        if (v.materiais.isNotEmpty()) {
            salvarMateriaisDaVariacao(novoId, v.materiais)
        }

        if (v.estoque > 0.0) {
            try {
                org.example.EstoqueVariacaoAuxTable.insert {
                    it[variacaoId] = novoId
                    it[estoque] = v.estoque
                }
            } catch (e: Exception) {}
        }

        novoId
    }

    fun atualizarVariacao(id: Int, v: ProdutoVariacao) = transaction {
        ProdutoVariacoesTable.update({ ProdutoVariacoesTable.id eq id }) {
            it[nomeTamanho] = v.nomeTamanho
            it[tamanhoMedida] = v.tamanhoMedida
            it[unidadeMedidaTamanhoId] = v.unidadeMedidaTamanhoId
            it[embalagemInsumoId] = v.embalagemInsumoId
            it[tempoProducaoMinutos] = v.tempoProducaoMinutos
            it[margemLucro] = v.margemLucro
            it[precoVenda] = v.precoVenda
            it[custoUnitarioCalculado] = v.custoUnitarioCalculado
            it[estoque] = v.estoque
            it[codigoBarras] = v.codigoBarras?.takeIf { c -> c.isNotBlank() }
        }
        if (v.materiais.isNotEmpty()) {
            salvarMateriaisDaVariacao(id, v.materiais)
        }
        try {
            org.example.EstoqueVariacaoAuxTable.deleteWhere { org.example.EstoqueVariacaoAuxTable.variacaoId eq id }
            org.example.EstoqueVariacaoAuxTable.insert {
                it[variacaoId] = id
                it[estoque] = v.estoque
            }
        } catch (e: Exception) {}
    }

    fun atualizarEstoqueVariacao(id: Int, novoEstoque: Double) = transaction {
        ProdutoVariacoesTable.update({ ProdutoVariacoesTable.id eq id }) {
            it[estoque] = novoEstoque
        }
        try {
            org.example.EstoqueVariacaoAuxTable.deleteWhere { org.example.EstoqueVariacaoAuxTable.variacaoId eq id }
            org.example.EstoqueVariacaoAuxTable.insert {
                it[variacaoId] = id
                it[estoque] = novoEstoque
            }
        } catch (e: Exception) {}
    }

    fun deletarVariacao(id: Int) = transaction {
        try {
            org.example.EstoqueVariacaoAuxTable.deleteWhere { org.example.EstoqueVariacaoAuxTable.variacaoId eq id }
        } catch (e: Exception) {}
        ProdutoVariacoesTable.deleteWhere { Op.build { ProdutoVariacoesTable.id eq id } }
    }
}
