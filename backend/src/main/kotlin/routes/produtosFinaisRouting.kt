package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.ProdutoFinal
import org.example.repository.AppDatabase
import org.example.ReceitaInsumo
import org.example.ProdutoVariacao
import org.example.VariacaoMaterial
import org.example.EmpresasTable
import org.example.TenantContext
import org.jetbrains.exposed.sql.select
import org.jetbrains.exposed.sql.transactions.transaction

data class RotuloRequest(
    val rotulo: String?
)

fun obterStatusLimiteProdutos(db: AppDatabase): Map<String, Any?> {
    val schema = TenantContext.getCurrentSchema()
    val limite = try {
        transaction {
            EmpresasTable.select { EmpresasTable.schemaName eq schema }
                .firstOrNull()?.get(EmpresasTable.limiteProdutos)
        }
    } catch (_: Exception) {
        null
    }
    val total = try { db.produtosFinais.lerTodos().size } catch (_: Exception) { 0 }
    val atingido = limite != null && limite > 0 && total >= limite
    val disponivel = if (limite != null && limite > 0) maxOf(0, limite - total) else null
    return mapOf(
        "total" to total,
        "limite" to limite,
        "atingido" to atingido,
        "disponivel" to disponivel
    )
}

// Funcao auxiliar para recalcular o custo das variações de um produto (CPV Fracionado)
fun recalcularCustos(produtoId: Int, db: AppDatabase) {
    val produto = db.produtosFinais.lerPorId(produtoId) ?: return
    val receita = db.produtosFinais.lerInsumosDaReceita(produtoId)
    val variacoes = db.produtosFinais.lerVariacoesDoProduto(produtoId)

    // 1. Custo total da receita base
    var custoReceitaBase = 0.0
    for ((_, _, insumoId, quantidadeUsada) in receita) {
        val insumo = db.insumos.lerPorId(insumoId)
        if (insumo != null) {
            val qtdBase = if (insumo.quantidadePorEmbalagem != null && insumo.quantidadePorEmbalagem!! > 0) {
                insumo.quantidadePorEmbalagem!!
            } else {
                1.0
            }
            // Custo por mililitro ou grama: preco / quantidadePorEmbalagem (ex: R$ 61,27 / 5000ml = R$ 0,012254/ml)
            val custoPorUnidadeBase = insumo.preco / qtdBase
            // Custo do insumo na receita = quantidadeUsada * custoPorUnidadeBase (ex: 700ml * 0,012254 = R$ 8,58)
            custoReceitaBase += custoPorUnidadeBase * quantidadeUsada
        }
    }

    // Custo por unidade de medida da receita (ex: Custo por 1 ml, se o rendimento base for 1000 ml)
    val custoPorUnidadeMedidaBase = if (produto.rendimentoReceitaBase > 0) custoReceitaBase / produto.rendimentoReceitaBase else custoReceitaBase

    // 2. Atualizar o custo calculado de cada variação
    for (v in variacoes) {
        // Custo do conteúdo líquido/massa = Custo por unidade base * Tamanho da variação
        val custoConteudo = custoPorUnidadeMedidaBase * v.tamanhoMedida
        var custoMateriais = 0.0

        val materiais = db.produtosFinais.lerMateriaisDaVariacao(v.id)
        if (materiais.isNotEmpty()) {
            custoMateriais = materiais.sumOf { it.custoUnitario }
        } else if (v.embalagemInsumoId != null) {
            val embalagem = db.insumos.lerPorId(v.embalagemInsumoId!!)
            if (embalagem != null) {
                val qtdEmb = if (embalagem.quantidadePorEmbalagem != null && embalagem.quantidadePorEmbalagem!! > 0) {
                    embalagem.quantidadePorEmbalagem!!
                } else {
                    1.0
                }
                custoMateriais = embalagem.preco / qtdEmb
            }
        }

        val custoCalculado = custoConteudo + custoMateriais

        val margem = if (v.margemLucro > 0.0) v.margemLucro else 300.0
        val precoVenda = if (v.precoVenda <= 0.0 || v.margemLucro > 0.0) {
            custoCalculado * (1.0 + margem / 100.0)
        } else {
            v.precoVenda
        }

        db.produtosFinais.atualizarVariacao(v.id, v.copy(
            custoUnitarioCalculado = custoCalculado,
            margemLucro = margem,
            precoVenda = precoVenda
        ))
    }
}

/**
 * Gera texto profissional para o rótulo de um produto final atendendo às diretrizes:
 * - Materiais utilizados SEM quantidades;
 * - Características do produto e quantidade por embalagem;
 * - Modo de uso detalhado e precauções.
 */
fun gerarRotuloCompleto(produto: ProdutoFinal, db: AppDatabase, gemini: org.example.services.GeminiService): String {
    val receita = db.produtosFinais.lerInsumosDaReceita(produto.id)
    val variacoes = db.produtosFinais.lerVariacoesDoProduto(produto.id)

    // 1. Materiais da receita + materiais das variações sem quantidades (limpar números/unidades de compra)
    val matsVariacoes = variacoes.flatMap { db.produtosFinais.lerMateriaisDaVariacao(it.id) }
        .mapNotNull { it.insumoNome }
        .filter { it.isNotBlank() && it != "Insumo não encontrado" }

    val materiais = (receita.mapNotNull { it.insumoNome } + matsVariacoes)
        .filter { it.isNotBlank() && it != "Insumo não encontrado" }
        .map { nome ->
            nome.replace(Regex("""\s+\d+([.,]\d+)?\s*(ml|l|g|kg|un|m|litros?|gramas?)\b""", RegexOption.IGNORE_CASE), "").trim()
        }
        .distinct()

    // 2. Quantidade por embalagem / Variações cadastradas com todos os seus componentes
    val embalagensFormatadas = if (variacoes.isNotEmpty()) {
        variacoes.map { v ->
            val unidade = db.unidadesMedida.lerPorId(v.unidadeMedidaTamanhoId)?.sigla ?: "ml"
            val mats = db.produtosFinais.lerMateriaisDaVariacao(v.id)
            val descMats = if (mats.isNotEmpty()) {
                mats.joinToString(", ") { m ->
                    val q = if (m.quantidade % 1.0 == 0.0) m.quantidade.toInt().toString() else m.quantidade.toString()
                    val u = m.unidadeSigla ?: ""
                    "${m.insumoNome ?: "Item"} ($q $u)"
                }
            } else {
                val embInsumo = if (v.embalagemInsumoId != null) db.insumos.lerPorId(v.embalagemInsumoId!!) else null
                embInsumo?.nome ?: v.nomeTamanho
            }
            val tamanhoStr = if (v.tamanhoMedida % 1.0 == 0.0) v.tamanhoMedida.toInt().toString() else v.tamanhoMedida.toString()
            "$tamanhoStr $unidade ($descMats)"
        }
    } else {
        val rendimento = if (produto.rendimentoReceitaBase % 1.0 == 0.0) produto.rendimentoReceitaBase.toInt().toString() else produto.rendimentoReceitaBase.toString()
        listOf("Conteúdo Nominal: $rendimento ml")
    }

    // Tenta enriquecer via Gemini se API estiver configurada
    val rotuloIa = try {
        if (gemini.isConfigured()) {
            gemini.gerarRotuloProduto(
                nomeProduto = produto.nome,
                descricao = produto.descricao,
                embalagens = embalagensFormatadas,
                materiais = materiais
            )
        } else null
    } catch (e: Exception) {
        null
    }

    if (!rotuloIa.isNullOrBlank()) {
        return rotuloIa
    }

    // Geração determinística padronizada e profissional
    val caracteristicasTexto = if (produto.descricao.isNotBlank()) {
        produto.descricao.trim()
    } else {
        "Fragrância exclusiva elaborada com matérias-primas nobres para proporcionar uma experiência olfativa marcante, elegante e duradoura ao seu espaço."
    }

    val composicaoTexto = if (materiais.isNotEmpty()) {
        materiais.joinToString(", ")
    } else {
        "Matérias-primas e fragrâncias selecionadas."
    }

    val embalagensTexto = embalagensFormatadas.joinToString("\n") { "• $it" }

    val combined = "${produto.nome} ${produto.descricao}".lowercase()
    val modoDeUso = when {
        combined.contains("difusor") || combined.contains("vareta") -> {
            "1. Retire a tampa externa e remova o batoque de vedação do frasco.\n" +
            "2. Recoloque a tampa com orifício e insira as varetas condutoras no líquido aromatizador.\n" +
            "3. Aguarde cerca de 30 minutos para que as varetas absorvam o produto e vire-as.\n" +
            "4. Inverta a posição das varetas a cada 2 ou 3 dias para garantir a difusão contínua da fragrância.\n" +
            "5. Mantenha o frasco em local com circulação de ar natural, ao abrigo de luz solar direta e correntes de ar excessivas."
        }
        combined.contains("spray") || combined.contains("home spray") || combined.contains("lençol") || combined.contains("tecido") -> {
            "1. Destrave a trava de proteção presente no gatilho ou válvula borrifadora.\n" +
            "2. Pulverize no ar do ambiente ou sobre superfícies de tecido (como almofadas, cortinas, estofados e roupas de cama) a uma distância média de 30 cm a 40 cm.\n" +
            "3. Para tecidos finos, delicados ou coloridos, recomenda-se realizar teste prévio em área oculta."
        }
        combined.contains("vela") -> {
            "1. Posicione a vela sobre uma superfície plana, rígida e resistente ao calor.\n" +
            "2. Acenda o pavio e deixe a cera derreter até atingir a borda do recipiente em todas as queimas, promovendo queima uniforme e sem acúmulo nas laterais.\n" +
            "3. Não deixe acesa sem supervisão nem por períodos superiores a 3 horas consecutivas.\n" +
            "4. Antes de reacender, apare o pavio deixando aproximadamente 5 mm de comprimento."
        }
        combined.contains("sabonete") || combined.contains("gel") -> {
            "1. Aplique uma pequena quantidade nas mãos ou sobre o corpo previamente umedecido.\n" +
            "2. Massageie delicadamente até a formação de espuma cremosa e perfumada.\n" +
            "3. Enxágue com água em abundância."
        }
        combined.contains("hidratante") || combined.contains("creme") || combined.contains("loção") -> {
            "1. Aplique quantidade suficiente sobre a pele limpa e seca.\n" +
            "2. Espalhe realizando movimentos suaves e circulares até a absorção completa.\n" +
            "3. Indicado para uso diário."
        }
        else -> {
            "1. Aplique o produto na quantidade adequada ao ambiente ou superfície indicada.\n" +
            "2. Reaplique sempre que desejar intensificar o aroma ou efeito desejado.\n" +
            "3. Guarde o frasco devidamente fechado após o uso."
        }
    }

    val precaucoes = "USO EXTERNO. Mantenha fora do alcance de crianças e de animais domésticos. Não ingerir. Não inalar diretamente. Evite contato com os olhos; se ocorrer, lave com água em abundância. Não aplicar sobre a pele irritada ou lesionada. Em caso de sensibilização ou irritação, suspenda o uso e procure orientação médica. Conserve a embalagem bem fechada, em local fresco, arejado e protegido da incidência solar direta e fontes de calor."

    return buildString {
        appendLine("PRODUTO: ${produto.nome.uppercase()}")
        appendLine()
        appendLine("CARACTERÍSTICAS:")
        appendLine(caracteristicasTexto)
        appendLine()
        appendLine("QUANTIDADE POR EMBALAGEM:")
        appendLine(embalagensTexto)
        appendLine()
        appendLine("COMPOSIÇÃO / MATERIAIS:")
        appendLine(composicaoTexto)
        appendLine()
        appendLine("MODO DE USO:")
        appendLine(modoDeUso)
        appendLine()
        appendLine("PRECAUÇÕES E CUIDADOS:")
        appendLine(precaucoes)
    }.trim()
}

fun Application.produtosFinaisRouting(db: AppDatabase) {
    val gemini = org.example.services.GeminiService()
    routing {
        route("/produtos-finais") {
            get("/json") {
                val produtos = db.produtosFinais.lerTodos()
                val cota = obterStatusLimiteProdutos(db)
                call.respond(mapOf(
                    "produtos" to produtos,
                    "cota" to cota
                ))
            }
            get("/limite") {
                val cota = obterStatusLimiteProdutos(db)
                call.respond(cota)
            }
            get("/estoque/json") {
                val unidades = db.unidadesMedida.lerTodos()
                val produtos = db.produtosFinais.lerTodos()
                val variacoes = db.produtosFinais.lerTodasVariacoes()

                val lista = variacoes.map { v ->
                    val prod = produtos.find { it.id == v.produtoId }
                    val un = unidades.find { it.id == v.unidadeMedidaTamanhoId }
                    mapOf(
                        "id" to v.id,
                        "produtoId" to v.produtoId,
                        "produtoNome" to (prod?.nome ?: "Produto Desconhecido"),
                        "nomeTamanho" to v.nomeTamanho,
                        "tamanhoMedida" to v.tamanhoMedida,
                        "unidadeSigla" to (un?.sigla ?: ""),
                        "unidadeNome" to (un?.nome ?: ""),
                        "custoUnitarioCalculado" to v.custoUnitarioCalculado,
                        "precoVenda" to v.precoVenda,
                        "margemLucro" to v.margemLucro,
                        "tempoProducaoMinutos" to v.tempoProducaoMinutos,
                        "estoque" to v.estoque
                    )
                }
                call.respond(mapOf("produtos" to lista, "produtosBase" to produtos))
            }
            post("/ajustar-estoque/{variacaoId}") {
                val variacaoId = call.parameters["variacaoId"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val params = call.receiveParameters()
                val novoEstoque = params["estoque"]?.toDoubleOrNull() ?: 0.0
                db.produtosFinais.atualizarEstoqueVariacao(variacaoId, novoEstoque)
                call.respond(mapOf("status" to "success"))
            }
            get {
                val produtos = db.produtosFinais.lerTodos()
                call.respond(produtos)
            }
            post {
                val produto = call.receive<ProdutoFinal>()

                // Limitador e validação dos campos do cadastro
                val nomeLimpo = produto.nome.trim()
                if (nomeLimpo.isBlank()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do produto é obrigatório."))
                }
                if (nomeLimpo.length > 150) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do produto não pode exceder 150 caracteres."))
                }
                val descLimpa = produto.descricao.trim()
                if (descLimpa.length > 1000) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "A descrição do produto não pode exceder 1000 caracteres."))
                }
                if (produto.rendimentoReceitaBase <= 0.0) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O rendimento da receita base deve ser maior que zero."))
                }

                // Limitador de cota máxima de produtos cadastrados (definido pelo Superusuário)
                val cota = obterStatusLimiteProdutos(db)
                val atingido = cota["atingido"] as? Boolean ?: false
                val limite = cota["limite"] as? Int
                val total = cota["total"] as? Int ?: 0

                if (atingido && limite != null) {
                    return@post call.respond(
                        HttpStatusCode.Forbidden,
                        mapOf("error" to "Limite de cadastro de produtos atingido ($total de $limite permitidos). Apenas o superusuário pode alterar o limite desta empresa.")
                    )
                }

                db.produtosFinais.criar(produto.copy(nome = nomeLimpo, descricao = descLimpa))
                call.respond(HttpStatusCode.Created, mapOf("status" to "success"))
            }
            get("/editar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val prod = db.produtosFinais.lerPorId(id) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Produto não encontrado"))
                call.respond(prod)
            }
            post("/atualizar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val produto = call.receive<ProdutoFinal>()

                val nomeLimpo = produto.nome.trim()
                if (nomeLimpo.isBlank()) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do produto é obrigatório."))
                }
                if (nomeLimpo.length > 150) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do produto não pode exceder 150 caracteres."))
                }
                val descLimpa = produto.descricao.trim()
                if (descLimpa.length > 1000) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "A descrição do produto não pode exceder 1000 caracteres."))
                }
                if (produto.rendimentoReceitaBase <= 0.0) {
                    return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O rendimento da receita base deve ser maior que zero."))
                }

                db.produtosFinais.atualizarProdutoBase(id, nomeLimpo, descLimpa, produto.rendimentoReceitaBase)

                // Recalcular custos sempre que o rendimento mudar
                recalcularCustos(id, db)

                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
            get("/deletar/{id}") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                db.produtosFinais.deletarProdutoBase(id)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
        }

        // --- FICHA TÉCNICA MASTER ---
        route("/produtos-finais/{id}/receita") {
            get {
                try {
                    val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                    val produto = db.produtosFinais.lerPorId(id) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Produto não encontrado"))
                    val receitaBase = db.produtosFinais.lerInsumosDaReceita(id).map {
                        val insumo = db.insumos.lerPorId(it.insumoId)
                        it.copy(insumoNome = insumo?.nome ?: "Insumo não encontrado")
                    }
                    call.respond(mapOf("produto" to produto, "receita" to receitaBase))
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to e.message))
                }
            }
            post {
                val produtoId = call.parameters["id"]?.toIntOrNull() ?: 0
                val item = call.receive<ReceitaInsumo>()
                db.produtosFinais.adicionarInsumoNaReceita(produtoId, item.insumoId, item.quantidadeUsada)
                recalcularCustos(produtoId, db)
                call.respond(HttpStatusCode.Created, mapOf("status" to "success"))
            }
            get("/deletar/{receitaId}") {
                val produtoId = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val receitaId = call.parameters["receitaId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                db.produtosFinais.removerInsumoDaReceita(receitaId)
                recalcularCustos(produtoId, db)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
            post("/atualizar/{receitaId}") {
                val produtoId = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val receitaId = call.parameters["receitaId"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val params = call.receive<Map<String, Double>>()
                val novaQuantidade = params["quantidadeUsada"] ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Quantidade inválida"))
                db.produtosFinais.atualizarInsumoNaReceita(receitaId, novaQuantidade)
                recalcularCustos(produtoId, db)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
        }

        // --- Rótulo do Produto ---
        route("/produtos-finais/{id}/rotulo") {
            get {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val produto = db.produtosFinais.lerPorId(id) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Produto não encontrado"))
                call.respond(mapOf("rotulo" to produto.rotulo))
            }
            post {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val request = call.receive<RotuloRequest>()
                db.produtosFinais.atualizarRotulo(id, request.rotulo)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
            post("/gerar") {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val produto = db.produtosFinais.lerPorId(id) ?: return@post call.respond(HttpStatusCode.NotFound, mapOf("error" to "Produto não encontrado"))
                
                val rotuloGerado = gerarRotuloCompleto(produto, db, gemini)
                db.produtosFinais.atualizarRotulo(id, rotuloGerado)
                call.respond(mapOf("rotulo" to rotuloGerado, "status" to "success"))
            }
        }

        // --- Tamanhos e Preços ---
        route("/produtos-finais/{id}/tamanhos") {
            get {
                val id = call.parameters["id"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val produto = db.produtosFinais.lerPorId(id) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Produto não encontrado"))
                val variacoes = db.produtosFinais.lerVariacoesDoProduto(id)
                call.respond(mapOf("produto" to produto, "variacoes" to variacoes))
            }
            post {
                val id = call.parameters["id"]?.toIntOrNull() ?: 0
                val variacao = call.receive<ProdutoVariacao>()
                val margem = if (variacao.margemLucro > 0.0) variacao.margemLucro else 300.0
                db.produtosFinais.criarVariacao(variacao.copy(produtoId = id, margemLucro = margem))
                recalcularCustos(id, db)
                call.respond(HttpStatusCode.Created, mapOf("status" to "success"))
            }
            get("/deletar/{variacaoId}") {
                val variacaoId = call.parameters["variacaoId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                db.produtosFinais.deletarVariacao(variacaoId)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
            get("/editar/{variacaoId}") {
                val variacaoId = call.parameters["variacaoId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val v = db.produtosFinais.lerVariacaoPorId(variacaoId) ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Variação não encontrada"))
                call.respond(v)
            }
            post("/atualizar/{variacaoId}") {
                val produtoId = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val variacaoId = call.parameters["variacaoId"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val variacao = call.receive<ProdutoVariacao>()
                db.produtosFinais.atualizarVariacao(variacaoId, variacao)
                recalcularCustos(produtoId, db)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
            get("/{variacaoId}/materiais") {
                val variacaoId = call.parameters["variacaoId"]?.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val materiais = db.produtosFinais.lerMateriaisDaVariacao(variacaoId)
                call.respond(materiais)
            }
            post("/{variacaoId}/materiais") {
                val produtoId = call.parameters["id"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val variacaoId = call.parameters["variacaoId"]?.toIntOrNull() ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido"))
                val materiais = call.receive<List<VariacaoMaterial>>()
                db.produtosFinais.salvarMateriaisDaVariacao(variacaoId, materiais)
                recalcularCustos(produtoId, db)
                call.respond(HttpStatusCode.OK, mapOf("status" to "success"))
            }
        }
    }
}