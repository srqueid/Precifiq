package org.example.services

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.github.cdimascio.dotenv.dotenv
import org.example.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.*

class GeminiService {
    private val gson = Gson()
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(20))
        .build()

    private val dotenv = dotenv {
        directory = System.getProperty("user.dir")
        filename = ".env"
        ignoreIfMissing = true
    }

    private fun getApiKey(): String {
        return System.getenv("GEMINI_API_KEY") 
            ?: dotenv["GEMINI_API_KEY"] 
            ?: System.getProperty("GEMINI_API_KEY") 
            ?: ""
    }

    fun isConfigured(): Boolean {
        return getApiKey().isNotBlank()
    }

    /**
     * Extrai dados de uma Nota Fiscal em formato PDF ou Imagem utilizando o Gemini 1.5 Flash Multimodal.
     */
    fun extrairDadosDocumento(bytes: ByteArray, mimeType: String): NfeDadosExtraidos {
        val apiKey = getApiKey()
        if (apiKey.isBlank()) {
            println("AVISO: GEMINI_API_KEY não configurada. Usando parser de contingência.")
            return NfeDadosExtraidos(
                numeroNota = "000000",
                valorTotalNota = 0.0,
                itens = emptyList()
            )
        }

        val base64Data = Base64.getEncoder().encodeToString(bytes)
        val prompt = """
            Você é um assistente especialista em extração de dados de Documentos Fiscais brasileiros (NF-e, DANFE, NFS-e).
            Analise com extrema precisão o documento em anexo e extraia as informações estruturadas em JSON.
            
            Retorne ESTRITAMENTE um objeto JSON válido no seguinte formato:
            {
              "chaveAcesso": "chave de 44 dígitos se houver",
              "numeroNota": "número da nota fiscal",
              "serie": "série da nota",
              "dataEmissao": "AAAA-MM-DD",
              "valorTotalProdutos": 0.00,
              "valorFrete": 0.00,
              "valorDesconto": 0.00,
              "valorTotalNota": 0.00,
              "fornecedor": {
                "cnpj": "XX.XXX.XXX/XXXX-XX",
                "razaoSocial": "Razão Social do Emitente",
                "nomeFantasia": "Nome Fantasia se houver",
                "endereco": "Logradouro, número, bairro",
                "uf": "UF",
                "telefone": "Telefone se houver",
                "email": "Email se houver"
              },
              "itens": [
                {
                  "numeroItem": 1,
                  "codigoProdutoFornecedor": "código se houver",
                  "descricao": "Descrição exata do produto/insumo",
                  "ncm": "NCM se houver",
                  "cfop": "CFOP se houver",
                  "unidadeComercial": "UN, L, ML, KG, G, CX, etc.",
                  "quantidade": 1.0,
                  "valorUnitario": 0.00,
                  "valorTotal": 0.00
                }
              ]
            }
            Importante:
            - Converta todos os valores numéricos e monetários para Double com ponto decimal (ex: 1250.50).
            - Não inclua markdown extra, apenas o JSON puro.
        """.trimIndent()

        val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"

        val partText = JsonObject().apply { addProperty("text", prompt) }
        val inlineData = JsonObject().apply {
            addProperty("mime_type", mimeType)
            addProperty("data", base64Data)
        }
        val partMedia = JsonObject().apply { add("inline_data", inlineData) }

        val partsArray = JsonArray().apply {
            add(partText)
            add(partMedia)
        }

        val contentObj = JsonObject().apply { add("parts", partsArray) }
        val contentsArray = JsonArray().apply { add(contentObj) }

        val generationConfig = JsonObject().apply {
            addProperty("responseMimeType", "application/json")
            addProperty("temperature", 0.1)
        }

        val requestBody = JsonObject().apply {
            add("contents", contentsArray)
            add("generationConfig", generationConfig)
        }

        val httpRequest = HttpRequest.newBuilder()
            .uri(URI.create(endpoint))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(45))
            .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
            .build()

        val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())

        if (response.statusCode() !in 200..299) {
            println("ERRO Gemini API (${response.statusCode()}): ${response.body()}")
            throw RuntimeException("Falha na extração de documento via Gemini API: HTTP ${response.statusCode()}")
        }

        val responseJson = JsonParser.parseString(response.body()).asJsonObject
        val rawText = responseJson.getAsJsonArray("candidates")
            .get(0).asJsonObject
            .getAsJsonObject("content")
            .getAsJsonArray("parts")
            .get(0).asJsonObject
            .get("text").asString

        return parseNfeDadosFromJson(rawText)
    }

    /**
     * Utiliza o Gemini para realizar o casamento semântico (Fuzzy Matching) entre as descrições
     * dos itens da nota fiscal e os insumos cadastrados no ERP.
     */
    fun conciliarItensSemanticamente(
        itensNfe: List<NfeItemExtraido>,
        insumosCadastrados: List<InsumoResumoDTO>
    ): Map<Int, ItemConciliacaoSugestao> {
        val apiKey = getApiKey()
        if (apiKey.isBlank() || insumosCadastrados.isEmpty() || itensNfe.isEmpty()) {
            return fallbackConciliacao(itensNfe, insumosCadastrados)
        }

        val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"

        val itensNfeJson = gson.toJson(itensNfe.map {
            mapOf(
                "numeroItem" to it.numeroItem,
                "descricaoNota" to it.descricao,
                "unidade" to it.unidadeComercial,
                "quantidade" to it.quantidade,
                "valorUnitario" to it.valorUnitario
            )
        })

        val insumosJson = gson.toJson(insumosCadastrados.map {
            mapOf(
                "id" to it.id,
                "nome" to it.nome,
                "unidadeSigla" to it.unidadeSigla,
                "isEmbalagem" to it.isEmbalagem,
                "precoAtual" to it.precoAtual
            )
        })

        val prompt = """
            Você é um assistente de almoxarifado e controle de estoque de uma indústria de cosméticos, perfumaria e aromatizantes.
            Sua missão é associar os ITENS DA NOTA FISCAL aos INSUMOS CADASTRADOS no sistema.
            
            ITENS DA NOTA FISCAL:
            $itensNfeJson
            
            INSUMOS CADASTRADOS NO SISTEMA:
            $insumosJson
            
            Diretrizes de conciliação:
            - Compare variações de nomes, sinônimos comerciais, abreviações e unidades.
              Exemplos comuns:
              * "ALCOOL ETILICO NEUTRO 96 GL 1L" -> "Álcool de Cereais" (score 0.95)
              * "FRASCO PET CILINDRICO AMBAR 250ML" -> "Frasco Âmbar 250ml" (score 0.98)
              * "VALVULA SPRAY DOURADA 28/410" -> "Válvula Spray Luxo Dourada" (score 0.92)
              * "ESSENCIA FLOR DE LARANJEIRA 500G" -> "Essência Flor de Laranjeira" (score 0.99)
            - Se um item não tiver nenhuma correspondência plausível com os insumos existentes (score < 0.50), marque "novoInsumoSugerido": true e "insumoIdSugerido": null.
            
            Retorne ESTRITAMENTE um JSON com o array "conciliacoes":
            {
              "conciliacoes": [
                {
                  "numeroItem": 1,
                  "insumoIdSugerido": 14,
                  "scoreConfianca": 0.95,
                  "justificativa": "Mesmo insumo (sinônimo comercial de Álcool de Cereais)",
                  "novoInsumoSugerido": false
                }
              ]
            }
        """.trimIndent()

        val partText = JsonObject().apply { addProperty("text", prompt) }
        val contentObj = JsonObject().apply {
            add("parts", JsonArray().apply { add(partText) })
        }
        val requestBody = JsonObject().apply {
            add("contents", JsonArray().apply { add(contentObj) })
            add("generationConfig", JsonObject().apply {
                addProperty("responseMimeType", "application/json")
                addProperty("temperature", 0.1)
            })
        }

        try {
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build()

            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() in 200..299) {
                val responseJson = JsonParser.parseString(response.body()).asJsonObject
                val rawText = responseJson.getAsJsonArray("candidates")
                    .get(0).asJsonObject
                    .getAsJsonObject("content")
                    .getAsJsonArray("parts")
                    .get(0).asJsonObject
                    .get("text").asString

                val parsed = JsonParser.parseString(rawText).asJsonObject
                val conciliacoesArray = parsed.getAsJsonArray("conciliacoes")

                val insumosMap = insumosCadastrados.associateBy { it.id }
                val resultado = mutableMapOf<Int, ItemConciliacaoSugestao>()

                for (elem in conciliacoesArray) {
                    val obj = elem.asJsonObject
                    val numItem = obj.get("numeroItem").asInt
                    val insumoId = if (obj.has("insumoIdSugerido") && !obj.get("insumoIdSugerido").isJsonNull) {
                        obj.get("insumoIdSugerido").asInt
                    } else null
                    val score = obj.get("scoreConfianca")?.asDouble ?: 0.0
                    val justificativa = obj.get("justificativa")?.asString
                    val novoInsumo = obj.get("novoInsumoSugerido")?.asBoolean ?: (insumoId == null)

                    val itemNfe = itensNfe.find { it.numeroItem == numItem }
                    if (itemNfe != null) {
                        val insumo = insumoId?.let { insumosMap[it] }
                        resultado[numItem] = ItemConciliacaoSugestao(
                            itemNfe = itemNfe,
                            insumoIdSugerido = insumo?.id,
                            insumoNomeSugerido = insumo?.nome,
                            unidadeSiglaSugerida = insumo?.unidadeSigla,
                            scoreConfianca = score,
                            justificativa = justificativa,
                            novoInsumoSugerido = novoInsumo || insumo == null
                        )
                    }
                }

                // Preenche itens que porventura não tenham vindo no retorno do Gemini
                for (item in itensNfe) {
                    if (!resultado.containsKey(item.numeroItem)) {
                        resultado[item.numeroItem] = fallbackItemConciliacao(item, insumosCadastrados)
                    }
                }

                return resultado
            }
        } catch (e: Exception) {
            println("AVISO: Falha ao chamar conciliação via Gemini (${e.message}). Aplicando fallback.")
        }

        return fallbackConciliacao(itensNfe, insumosCadastrados)
    }

    private fun parseNfeDadosFromJson(rawJson: String): NfeDadosExtraidos {
        val root = JsonParser.parseString(rawJson).asJsonObject
        
        val fornecedorObj = if (root.has("fornecedor") && root.get("fornecedor").isJsonObject) {
            val f = root.getAsJsonObject("fornecedor")
            NfeFornecedorExtraido(
                cnpj = f.get("cnpj")?.asString,
                razaoSocial = f.get("razaoSocial")?.asString,
                nomeFantasia = f.get("nomeFantasia")?.asString,
                endereco = f.get("endereco")?.asString,
                uf = f.get("uf")?.asString,
                telefone = f.get("telefone")?.asString,
                email = f.get("email")?.asString
            )
        } else null

        val itensList = mutableListOf<NfeItemExtraido>()
        if (root.has("itens") && root.get("itens").isJsonArray) {
            val itensArr = root.getAsJsonArray("itens")
            var idx = 1
            for (elem in itensArr) {
                val itemObj = elem.asJsonObject
                itensList.add(
                    NfeItemExtraido(
                        numeroItem = itemObj.get("numeroItem")?.asInt ?: idx,
                        codigoProdutoFornecedor = itemObj.get("codigoProdutoFornecedor")?.asString,
                        descricao = itemObj.get("descricao")?.asString ?: "Item sem descrição",
                        ncm = itemObj.get("ncm")?.asString,
                        cfop = itemObj.get("cfop")?.asString,
                        unidadeComercial = itemObj.get("unidadeComercial")?.asString ?: "UN",
                        quantidade = itemObj.get("quantidade")?.asDouble ?: 1.0,
                        valorUnitario = itemObj.get("valorUnitario")?.asDouble ?: 0.0,
                        valorTotal = itemObj.get("valorTotal")?.asDouble ?: 0.0
                    )
                )
                idx++
            }
        }

        return NfeDadosExtraidos(
            chaveAcesso = root.get("chaveAcesso")?.asString,
            numeroNota = root.get("numeroNota")?.asString,
            serie = root.get("serie")?.asString,
            dataEmissao = root.get("dataEmissao")?.asString,
            valorTotalProdutos = root.get("valorTotalProdutos")?.asDouble ?: 0.0,
            valorFrete = root.get("valorFrete")?.asDouble ?: 0.0,
            valorDesconto = root.get("valorDesconto")?.asDouble ?: 0.0,
            valorTotalNota = root.get("valorTotalNota")?.asDouble ?: 0.0,
            fornecedor = fornecedorObj,
            itens = itensList
        )
    }

    /**
     * Fallback determinístico baseado em similaridade de strings (Levenshtein e Jaccard).
     */
    private fun fallbackConciliacao(
        itensNfe: List<NfeItemExtraido>,
        insumosCadastrados: List<InsumoResumoDTO>
    ): Map<Int, ItemConciliacaoSugestao> {
        return itensNfe.associate { item ->
            item.numeroItem to fallbackItemConciliacao(item, insumosCadastrados)
        }
    }

    private fun fallbackItemConciliacao(
        item: NfeItemExtraido,
        insumosCadastrados: List<InsumoResumoDTO>
    ): ItemConciliacaoSugestao {
        if (insumosCadastrados.isEmpty()) {
            return ItemConciliacaoSugestao(
                itemNfe = item,
                insumoIdSugerido = null,
                scoreConfianca = 0.0,
                justificativa = "Nenhum insumo cadastrado na base",
                novoInsumoSugerido = true
            )
        }

        val descNormalized = normalize(item.descricao)
        var bestScore = 0.0
        var bestInsumo: InsumoResumoDTO? = null

        for (insumo in insumosCadastrados) {
            val insumoNormalized = normalize(insumo.nome)
            val score = calculateSimilarity(descNormalized, insumoNormalized)
            if (score > bestScore) {
                bestScore = score
                bestInsumo = insumo
            }
        }

        return if (bestScore >= 0.55 && bestInsumo != null) {
            ItemConciliacaoSugestao(
                itemNfe = item,
                insumoIdSugerido = bestInsumo.id,
                insumoNomeSugerido = bestInsumo.nome,
                unidadeSiglaSugerida = bestInsumo.unidadeSigla,
                scoreConfianca = (bestScore * 100).toInt() / 100.0,
                justificativa = "Correspondência por similaridade de texto",
                novoInsumoSugerido = false
            )
        } else {
            ItemConciliacaoSugestao(
                itemNfe = item,
                insumoIdSugerido = null,
                scoreConfianca = 0.0,
                justificativa = "Insumo não encontrado no cadastro atual",
                novoInsumoSugerido = true
            )
        }
    }

    private fun normalize(str: String): String {
        return str.lowercase(Locale.ROOT)
            .replace(Regex("[^a-z0-9 ]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun calculateSimilarity(s1: String, s2: String): Double {
        if (s1 == s2) return 1.0
        if (s1.contains(s2) || s2.contains(s1)) return 0.85

        val tokens1 = s1.split(" ").filter { it.isNotBlank() }.toSet()
        val tokens2 = s2.split(" ").filter { it.isNotBlank() }.toSet()
        val intersection = tokens1.intersect(tokens2).size
        val union = tokens1.union(tokens2).size

        return if (union == 0) 0.0 else intersection.toDouble() / union.toDouble()
    }

    /**
     * Gera um resumo executivo inteligente e recomendações estratégicas sobre
     * insumos com risco iminente de ruptura e produtos com margem de lucro comprimida.
     */
    fun gerarInsightsEstrategicos(
        itensRuptura: List<ItemPrevisaoRupturaDTO>,
        alertasMargem: List<AlertaMargemDTO>,
        totalInsumos: Int,
        totalProdutos: Int
    ): String {
        val criticos = itensRuptura.filter { it.nivelRisco == "CRITICO" }
        val alertas = itensRuptura.filter { it.nivelRisco == "ALERTA" }
        val prejuizo = alertasMargem.filter { it.impacto == "PREJUIZO" }
        val margemBaixa = alertasMargem.filter { it.impacto == "MARGEM_BAIXA" }

        val apiKey = getApiKey()
        if (apiKey.isBlank() || (criticos.isEmpty() && alertas.isEmpty() && alertasMargem.isEmpty())) {
            return fallbackInsights(criticos, alertas, prejuizo, margemBaixa, totalInsumos)
        }

        val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"

        val dadosJson = JsonObject().apply {
            addProperty("totalInsumos", totalInsumos)
            addProperty("totalProdutos", totalProdutos)
            add("insumosCriticos", gson.toJsonTree(criticos.map {
                mapOf(
                    "nome" to it.insumoNome,
                    "saldoAtual" to "${it.estoqueAtual} ${it.unidadeSigla}",
                    "consumoDiario" to "${it.consumoMedioDiario} ${it.unidadeSigla}/dia",
                    "diasAteRuptura" to it.diasAteRuptura,
                    "compraSugerida" to "${it.quantidadeSugeridaCompra} ${it.unidadeSigla}",
                    "fornecedor" to (it.fornecedorSugeridoNome ?: "Não definido")
                )
            }))
            add("produtosMargemComprimida", gson.toJsonTree((prejuizo + margemBaixa).take(5).map {
                mapOf(
                    "produto" to "${it.produtoNome} (${it.nomeTamanho})",
                    "custoUnitario" to "R$ ${"%.2f".format(Locale.US, it.custoUnitario)}",
                    "precoVendaAtual" to "R$ ${"%.2f".format(Locale.US, it.precoVenda)}",
                    "margemAtual" to "${"%.1f".format(Locale.US, it.margemAtual)}%",
                    "precoSugerido" to "R$ ${"%.2f".format(Locale.US, it.precoSugerido)}"
                )
            }))
        }

        val prompt = """
            Você é o Copilot Estratégico de Operações e Precificação de uma indústria de aromatizantes, perfumaria e cosméticos (ERP Controle).
            Analise os dados consolidados do estoque e catálogo abaixo e redija um Resumo Executivo em 2 ou 3 parágrafos diretos e acionáveis para o gestor:
            
            DADOS ATUAIS:
            $dadosJson
            
            Diretrizes:
            - Seja direto, claro e analítico, com foco em prevenção de parada de produção e proteção de caixa/margem.
            - Destaque os insumos que requerem compra imediata (em risco nas próximas 24-72h).
            - Mencione as oportunidades de reajuste nos produtos onde a margem foi mais comprimida pelo aumento de insumos.
            - Não use saudações formais ou enrolações. Escreva direto o insight.
        """.trimIndent()

        val partText = JsonObject().apply { addProperty("text", prompt) }
        val contentObj = JsonObject().apply { add("parts", JsonArray().apply { add(partText) }) }
        val requestBody = JsonObject().apply {
            add("contents", JsonArray().apply { add(contentObj) })
            add("generationConfig", JsonObject().apply {
                addProperty("temperature", 0.2)
            })
        }

        return try {
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build()

            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() in 200..299) {
                val responseJson = JsonParser.parseString(response.body()).asJsonObject
                responseJson.getAsJsonArray("candidates")
                    .get(0).asJsonObject
                    .getAsJsonObject("content")
                    .getAsJsonArray("parts")
                    .get(0).asJsonObject
                    .get("text").asString.trim()
            } else {
                fallbackInsights(criticos, alertas, prejuizo, margemBaixa, totalInsumos)
            }
        } catch (e: Exception) {
            fallbackInsights(criticos, alertas, prejuizo, margemBaixa, totalInsumos)
        }
    }

    private fun fallbackInsights(
        criticos: List<ItemPrevisaoRupturaDTO>,
        alertas: List<ItemPrevisaoRupturaDTO>,
        prejuizo: List<AlertaMargemDTO>,
        margemBaixa: List<AlertaMargemDTO>,
        totalInsumos: Int
    ): String {
        val partes = mutableListOf<String>()

        if (criticos.isNotEmpty()) {
            val nomes = criticos.take(3).joinToString(", ") { "'${it.insumoNome}'" }
            partes.add("⚠️ **Atenção Imediata**: ${criticos.size} insumo(s) crítico(s) ($nomes) possuem menos de 7 dias de cobertura com base na velocidade de consumo. Recomenda-se disparar pedido de reposição.")
        } else if (alertas.isNotEmpty()) {
            partes.add("ℹ️ **Monitoramento de Estoque**: ${alertas.size} insumo(s) em estado de atenção (cobertura entre 7 e 15 dias). O estoque geral está operando com estabilidade.")
        } else {
            partes.add("✅ **Estoque Estável**: Todos os insumos analisados possuem níveis seguros de saldo em relação ao consumo e estoque mínimo cadastrado.")
        }

        if (prejuizo.isNotEmpty()) {
            val prod = prejuizo.first()
            partes.add("🚨 **Alerta de Margem Negativa**: O produto '${prod.produtoNome} (${prod.nomeTamanho})' está operando com custo unitário superior ao preço de venda. Ajuste recomendado para ${fmtBrl(prod.precoSugerido)}.")
        } else if (margemBaixa.isNotEmpty()) {
            partes.add("💡 **Oportunidade de Reprecificação**: ${margemBaixa.size} produto(s) estão operando com margem abaixo da meta de 30% devido a custos de insumos recentes. Um ajuste médio pode recuperar a rentabilidade.")
        }

        return partes.joinToString("\n\n")
    }

    private fun fmtBrl(valor: Double): String {
        return "R$ ${"%.2f".format(Locale.forLanguageTag("pt-BR"), valor)}"
    }

    /**
     * Traduz uma pergunta em linguagem natural para uma consulta SQL SELECT válida no PostgreSQL.
     */
    fun traduzirPerguntaParaSql(pergunta: String): String {
        val apiKey = getApiKey()
        if (apiKey.isBlank()) {
            return fallbackPerguntaParaSql(pergunta)
        }

        val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"

        val schemaDdl = """
            -- ESQUEMA DO BANCO DE DADOS POSTGRESQL (ERP CONTROLE)
            TABLE insumo (
                id INT PRIMARY KEY,
                nome VARCHAR(255),
                unidade_medida_id INT REFERENCES unidade_medida(id),
                quantidade_por_embalagem NUMERIC, -- Tamanho/volume da embalagem de compra na unidade base (ex: 5000 para 5L/5000ml)
                preco NUMERIC, -- Preço total pago pela embalagem de compra
                is_embalagem BOOLEAN,
                estoque NUMERIC, -- Saldo físico na unidade base (ex: ml, g ou unidades)
                estoque_minimo NUMERIC,
                fornecedor_id INT REFERENCES fornecedor(id)
            );
            -- REGRA DE CÁLCULO DE VALOR EM ESTOQUE DE INSUMOS:
            -- Custo unitário base = preco / COALESCE(NULLIF(quantidade_por_embalagem, 0), 1.0)
            -- Valor financeiro total em estoque = estoque * (preco / COALESCE(NULLIF(quantidade_por_embalagem, 0), 1.0))
            TABLE unidade_medida (
                id INT PRIMARY KEY,
                nome VARCHAR(100),
                sigla VARCHAR(20)
            );
            TABLE fornecedor (
                id INT PRIMARY KEY,
                nome VARCHAR(255),
                nome_fantasia VARCHAR(255),
                cnpj_cpf VARCHAR(20),
                categoria VARCHAR(50),
                uf VARCHAR(2)
            );
            TABLE produto_final (
                id INT PRIMARY KEY,
                nome VARCHAR(200),
                descricao TEXT,
                rendimento_receita_base NUMERIC
            );
            TABLE produto_variacao (
                id INT PRIMARY KEY,
                produto_id INT REFERENCES produto_final(id),
                nome_tamanho VARCHAR(100),
                preco_venda NUMERIC,
                custo_unitario_calculado NUMERIC,
                margem_lucro NUMERIC,
                estoque NUMERIC
            );
            TABLE compra (
                id INT PRIMARY KEY,
                fornecedor_id INT REFERENCES fornecedor(id),
                status VARCHAR(50), -- PENDENTE, APROVADO, CONCLUIDO, CANCELADO
                valor_total NUMERIC,
                data_criacao TIMESTAMP
            );
            TABLE item_compra (
                id INT PRIMARY KEY,
                compra_id INT REFERENCES compra(id),
                insumo_id INT REFERENCES insumo(id),
                quantidade_comprada NUMERIC,
                preco_unitario NUMERIC
            );
            TABLE orcamento_compra (
                id INT PRIMARY KEY,
                titulo VARCHAR(200),
                status VARCHAR(50), -- EM_DIGITACAO, EM_ORCAMENTO, ORCAMENTO_APROVADO, CANCELADO
                frete NUMERIC,
                desconto NUMERIC,
                data_criacao TIMESTAMP
            );
            TABLE item_orcamento (
                id INT PRIMARY KEY,
                orcamento_id INT REFERENCES orcamento_compra(id),
                insumo_id INT REFERENCES insumo(id),
                quantidade NUMERIC
            );
            TABLE pedido (
                id INT PRIMARY KEY,
                cliente_id INT REFERENCES cliente(id),
                valor NUMERIC,
                forma_pagamento VARCHAR(50),
                entregue BOOLEAN
            );
            TABLE pedido_item (
                id INT PRIMARY KEY,
                pedido_id INT REFERENCES pedido(id),
                nome_produto VARCHAR(255),
                quantidade INT,
                preco_unitario NUMERIC
            );
            TABLE movimento_estoque_insumo (
                id INT PRIMARY KEY,
                insumo_id INT REFERENCES insumo(id),
                tipo VARCHAR(30), -- ENTRADA_COMPRA, SAIDA_PRODUCAO, AJUSTE_INVENTARIO, PERDA, ESTORNO
                quantidade NUMERIC,
                saldo_anterior NUMERIC,
                saldo_posterior NUMERIC,
                criado_em TIMESTAMP
            );
        """.trimIndent()

        val prompt = """
            Você é um especialista em PostgreSQL para o ERP industrial 'Controle'.
            Sua tarefa é traduzir a pergunta do usuário para uma consulta SQL PostgreSQL estritamente de leitura (SELECT).

            ESQUEMA DISPONÍVEL:
            $schemaDdl

            PERGUNTA DO USUÁRIO:
            "$pergunta"

            REGRAS OBRIGATÓRIAS:
            1. Gere APENAS uma consulta SQL SELECT (ou WITH ... SELECT).
            2. NUNCA gere instruções mutativas (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, etc.).
            3. Use apelidos descritivos para as colunas calculadas.
            4. Sempre inclua JOINs adequados para exibir nomes legíveis em vez de apenas chaves estrangeiras (ex: junte insumo com unidade_medida para mostrar u.sigla).
            5. Para comparações de texto use ILIKE.
            6. Termine sempre com LIMIT 50 no máximo.
            7. Responda ESTRITAMENTE em formato JSON:
            {
               "sql": "SELECT ... LIMIT 50;"
            }
        """.trimIndent()

        val partText = JsonObject().apply { addProperty("text", prompt) }
        val contentObj = JsonObject().apply { add("parts", JsonArray().apply { add(partText) }) }
        val requestBody = JsonObject().apply {
            add("contents", JsonArray().apply { add(contentObj) })
            add("generationConfig", JsonObject().apply {
                addProperty("responseMimeType", "application/json")
                addProperty("temperature", 0.0)
            })
        }

        return try {
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build()

            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() in 200..299) {
                val responseJson = JsonParser.parseString(response.body()).asJsonObject
                val rawText = responseJson.getAsJsonArray("candidates")
                    .get(0).asJsonObject
                    .getAsJsonObject("content")
                    .getAsJsonArray("parts")
                    .get(0).asJsonObject
                    .get("text").asString.trim()

                val parsed = JsonParser.parseString(rawText).asJsonObject
                parsed.get("sql")?.asString?.trim() ?: fallbackPerguntaParaSql(pergunta)
            } else {
                fallbackPerguntaParaSql(pergunta)
            }
        } catch (e: Exception) {
            fallbackPerguntaParaSql(pergunta)
        }
    }

    /**
     * Gera uma síntese explicativa e amigável em linguagem natural e Markdown dos resultados retornados pelo banco de dados.
     */
    fun sintetizarRespostaCopilot(
        pergunta: String,
        sql: String,
        colunas: List<String>,
        dados: List<Map<String, Any?>>
    ): String {
        if (dados.isEmpty()) {
            return "Nenhum registro encontrado no banco de dados para a sua consulta."
        }

        val apiKey = getApiKey()
        if (apiKey.isBlank()) {
            return fallbackSinteseCopilot(colunas, dados)
        }

        val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"

        val dadosAmostra = dados.take(15)
        val prompt = """
            Você é o Copilot de Operações e Finanças do ERP Controle.
            O usuário fez uma pergunta e a consulta SQL abaixo foi executada com sucesso.

            PERGUNTA DO USUÁRIO: "$pergunta"
            SQL EXECUTADO: $sql
            DADOS RETORNADOS (primeiros registros):
            ${gson.toJson(dadosAmostra)}
            TOTAL DE REGISTROS RETORNADOS: ${dados.size}

            Instruções:
            - Escreva uma resposta direta, profissional e elegante em português.
            - Responda diretamente à dúvida do usuário destacando os números principais em negrito.
            - Se for conveniente, comente conclusões rápidas ou pontos de atenção (ex: estoque crítico, margem baixa).
            - Não liste todos os itens manualmente no texto se forem muitos; os dados já serão renderizados na tabela pelo sistema.
        """.trimIndent()

        val partText = JsonObject().apply { addProperty("text", prompt) }
        val contentObj = JsonObject().apply { add("parts", JsonArray().apply { add(partText) }) }
        val requestBody = JsonObject().apply {
            add("contents", JsonArray().apply { add(contentObj) })
            add("generationConfig", JsonObject().apply {
                addProperty("temperature", 0.2)
            })
        }

        return try {
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build()

            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() in 200..299) {
                val responseJson = JsonParser.parseString(response.body()).asJsonObject
                responseJson.getAsJsonArray("candidates")
                    .get(0).asJsonObject
                    .getAsJsonObject("content")
                    .getAsJsonArray("parts")
                    .get(0).asJsonObject
                    .get("text").asString.trim()
            } else {
                fallbackSinteseCopilot(colunas, dados)
            }
        } catch (e: Exception) {
            fallbackSinteseCopilot(colunas, dados)
        }
    }

    private fun fallbackPerguntaParaSql(pergunta: String): String {
        val p = pergunta.lowercase(Locale.ROOT)
        return when {
            p.contains("estoque") && (p.contains("baixo") || p.contains("critico") || p.contains("ruptura") || p.contains("falta")) -> {
                "SELECT i.id, i.nome AS insumo, i.estoque AS saldo_atual, i.estoque_minimo, u.sigla AS unidade FROM insumo i LEFT JOIN unidade_medida u ON i.unidade_medida_id = u.id WHERE i.estoque <= i.estoque_minimo ORDER BY i.estoque ASC LIMIT 50;"
            }
            p.contains("lucr") || p.contains("margem") -> {
                "SELECT pf.nome AS produto, pv.nome_tamanho AS variacao, pv.custo_unitario_calculado AS custo, pv.preco_venda, pv.margem_lucro AS margem_percentual FROM produto_variacao pv JOIN produto_final pf ON pv.produto_id = pf.id ORDER BY pv.margem_lucro DESC LIMIT 50;"
            }
            p.contains("compra") && (p.contains("pendente") || p.contains("aguardando")) -> {
                "SELECT c.id, f.nome AS fornecedor, c.valor_total, c.data_criacao, c.status FROM compra c LEFT JOIN fornecedor f ON c.fornecedor_id = f.id WHERE c.status = 'PENDENTE' ORDER BY c.data_criacao DESC LIMIT 50;"
            }
            p.contains("fornecedor") -> {
                "SELECT id, nome, nome_fantasia, cnpj_cpf, uf FROM fornecedor ORDER BY nome ASC LIMIT 50;"
            }
            p.contains("produto") -> {
                "SELECT pf.id, pf.nome, COUNT(pv.id) AS total_variacoes FROM produto_final pf LEFT JOIN produto_variacao pv ON pf.id = pv.produto_id GROUP BY pf.id, pf.nome ORDER BY pf.nome ASC LIMIT 50;"
            }
            else -> {
                "SELECT i.id, i.nome AS insumo, i.estoque AS saldo, u.sigla, i.preco AS custo_unitario FROM insumo i LEFT JOIN unidade_medida u ON i.unidade_medida_id = u.id ORDER BY i.nome ASC LIMIT 50;"
            }
        }
    }

    private fun fallbackSinteseCopilot(colunas: List<String>, dados: List<Map<String, Any?>>): String {
        return "Foram encontrados **${dados.size} registro(s)** para a sua solicitação. Os detalhes estão apresentados na tabela abaixo."
    }

    /**
     * Analisa insumos faltantes em uma ordem de produção e sugere formulações alternativas com insumos em estoque.
     */
    fun sugerirSubstitutosFormulacao(
        produtoNome: String,
        itensFaltantes: List<ItemInsumoFaltanteDTO>,
        insumosDisponiveis: List<InsumoResumoDTO>
    ): Pair<String, List<SubstituicaoSugeridaDTO>> {
        val apiKey = getApiKey()
        if (apiKey.isBlank() || insumosDisponiveis.isEmpty() || itensFaltantes.isEmpty()) {
            return fallbackSubstitutos(itensFaltantes, insumosDisponiveis)
        }

        val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"

        val itensFaltantesJson = gson.toJson(itensFaltantes.map {
            mapOf(
                "insumoId" to it.insumoId,
                "nome" to it.insumoNome,
                "unidade" to it.unidadeSigla,
                "quantidadeNecessaria" to it.quantidadeNecessaria,
                "saldoAtual" to it.saldoAtual,
                "deficit" to it.deficit,
                "isEmbalagem" to it.isEmbalagem
            )
        })

        // Apenas insumos com saldo positivo e que não são os próprios faltantes
        val faltantesIds = itensFaltantes.map { it.insumoId }.toSet()
        val candidatos = insumosDisponiveis
            .filter { it.estoqueAtual > 0.0 && it.id !in faltantesIds }
            .take(60)

        val candidatosJson = gson.toJson(candidatos.map {
            mapOf(
                "id" to it.id,
                "nome" to it.nome,
                "unidade" to it.unidadeSigla,
                "estoqueDisponivel" to it.estoqueAtual,
                "isEmbalagem" to it.isEmbalagem,
                "preco" to it.precoAtual
            )
        })

        val prompt = """
            Você é um mestre perfumista e químico industrial formulador de cosméticos e aromatizantes para o ERP Controle.
            Uma Ordem de Produção do produto '$produtoNome' precisa ser executada, mas faltam insumos essenciais em estoque.
            
            Sua missão é sugerir INSUMOS SUBSTITUTOS DISPONÍVEIS EM ESTOQUE para permitir a fabricação imediata da batelada sem perda de qualidade sensorial ou funcional.
            
            INSUMOS FALTANTES:
            $itensFaltantesJson
            
            INSUMOS DISPONÍVEIS COM SALDO EM ESTOQUE:
            $candidatosJson
            
            DIRETRIZES DE FORMULAÇÃO ALTERNATIVA:
            1. Compatibilidade por Grupo Funcional e Família:
               - Veículos/Solventes: Álcool de Cereais pode ser substituído por Álcool Neutro 96, Dipropilenoglicol (DPG) ou Solvente Aromatizante.
               - Fragrâncias/Essências: Buscar aromas com perfil olfativo próximo (ex: Lavanda por Lavandim, Capim-Limão por Lemongrass/Citronela, etc.).
               - Embalagens: Substituir por embalagens de mesma capacidade (ex: Frasco Âmbar 250ml por Frasco Cristal/Transparente 250ml ou similar).
            2. Calcular a proporção recomendada (fatorEquivalencia, padrão 1.0) e a quantidadeSugerida no insumo substituto.
            3. Atribuir um scoreCompatibilidade de 0.0 a 1.0 (ex: 0.95 = 95%).
            4. Se não houver nenhum substituto aceitável para um item específico, omita a sugestão para ele.
            
            Retorne ESTRITAMENTE o JSON no formato:
            {
              "parecerGeralIa": "Parecer técnico resumido sobre a viabilidade da produção alternativa...",
              "sugestoes": [
                {
                  "insumoFaltanteId": 1,
                  "insumoFaltanteNome": "Álcool de Cereais",
                  "quantidadeFaltante": 500.0,
                  "insumoSubstitutoId": 14,
                  "insumoSubstitutoNome": "Álcool Etílico Neutro 96",
                  "estoqueSubstituto": 3500.0,
                  "unidadeSubstituto": "ml",
                  "quantidadeSugerida": 500.0,
                  "fatorEquivalencia": 1.0,
                  "scoreCompatibilidade": 0.95,
                  "justificativaTecnica": "Propriedades físicas e organolépticas equivalentes como veículo.",
                  "impactoCusto": "Variação de custo desprezível."
                }
              ]
            }
        """.trimIndent()

        val partText = JsonObject().apply { addProperty("text", prompt) }
        val contentObj = JsonObject().apply { add("parts", JsonArray().apply { add(partText) }) }
        val requestBody = JsonObject().apply {
            add("contents", JsonArray().apply { add(contentObj) })
            add("generationConfig", JsonObject().apply {
                addProperty("responseMimeType", "application/json")
                addProperty("temperature", 0.1)
            })
        }

        return try {
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(20))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build()

            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() in 200..299) {
                val responseJson = JsonParser.parseString(response.body()).asJsonObject
                val rawText = responseJson.getAsJsonArray("candidates")
                    .get(0).asJsonObject
                    .getAsJsonObject("content")
                    .getAsJsonArray("parts")
                    .get(0).asJsonObject
                    .get("text").asString.trim()

                val parsed = JsonParser.parseString(rawText).asJsonObject
                val parecer = parsed.get("parecerGeralIa")?.asString ?: "Substituições identificadas para viabilizar a produção."
                val sugestoesArray = parsed.getAsJsonArray("sugestoes")

                val sugestoes = mutableListOf<SubstituicaoSugeridaDTO>()
                for (elem in sugestoesArray) {
                    val obj = elem.asJsonObject
                    sugestoes.add(
                        SubstituicaoSugeridaDTO(
                            insumoFaltanteId = obj.get("insumoFaltanteId").asInt,
                            insumoFaltanteNome = obj.get("insumoFaltanteNome").asString,
                            quantidadeFaltante = obj.get("quantidadeFaltante").asDouble,
                            insumoSubstitutoId = obj.get("insumoSubstitutoId").asInt,
                            insumoSubstitutoNome = obj.get("insumoSubstitutoNome").asString,
                            estoqueSubstituto = obj.get("estoqueSubstituto").asDouble,
                            unidadeSubstituto = obj.get("unidadeSubstituto").asString,
                            quantidadeSugerida = obj.get("quantidadeSugerida").asDouble,
                            fatorEquivalencia = obj.get("fatorEquivalencia")?.asDouble ?: 1.0,
                            scoreCompatibilidade = obj.get("scoreCompatibilidade")?.asDouble ?: 0.85,
                            justificativaTecnica = obj.get("justificativaTecnica")?.asString ?: "Insumo compatível",
                            impactoCusto = obj.get("impactoCusto")?.asString ?: "Custo equivalente"
                        )
                    )
                }

                Pair(parecer, sugestoes)
            } else {
                fallbackSubstitutos(itensFaltantes, insumosDisponiveis)
            }
        } catch (e: Exception) {
            fallbackSubstitutos(itensFaltantes, insumosDisponiveis)
        }
    }

    private fun fallbackSubstitutos(
        itensFaltantes: List<ItemInsumoFaltanteDTO>,
        insumosDisponiveis: List<InsumoResumoDTO>
    ): Pair<String, List<SubstituicaoSugeridaDTO>> {
        val sugestoes = mutableListOf<SubstituicaoSugeridaDTO>()
        val faltantesIds = itensFaltantes.map { it.insumoId }.toSet()

        for (faltante in itensFaltantes) {
            // Busca insumo disponível com mesma unidade e tipo de embalagem
            val candidato = insumosDisponiveis
                .filter { it.id !in faltantesIds && it.estoqueAtual >= faltante.deficit && it.isEmbalagem == faltante.isEmbalagem }
                .maxByOrNull { calculateSimilarity(normalize(it.nome), normalize(faltante.insumoNome)) }

            if (candidato != null) {
                val score = calculateSimilarity(normalize(candidato.nome), normalize(faltante.insumoNome))
                if (score >= 0.25 || candidato.isEmbalagem == faltante.isEmbalagem) {
                    sugestoes.add(
                        SubstituicaoSugeridaDTO(
                            insumoFaltanteId = faltante.insumoId,
                            insumoFaltanteNome = faltante.insumoNome,
                            quantidadeFaltante = faltante.deficit,
                            insumoSubstitutoId = candidato.id,
                            insumoSubstitutoNome = candidato.nome,
                            estoqueSubstituto = candidato.estoqueAtual,
                            unidadeSubstituto = candidato.unidadeSigla,
                            quantidadeSugerida = faltante.deficit,
                            fatorEquivalencia = 1.0,
                            scoreCompatibilidade = if (score > 0.4) 0.90 else 0.75,
                            justificativaTecnica = "Insumo alternativo com saldo em estoque disponível (${candidato.estoqueAtual} ${candidato.unidadeSigla}).",
                            impactoCusto = "Manutenção do custo base."
                        )
                    )
                }
            }
        }

        val parecer = if (sugestoes.isNotEmpty()) {
            "Foram identificados insumos alternativos em estoque para substituir os itens com déficit e viabilizar a conversão da Ordem de Produção."
        } else {
            "Nenhum substituto direto com estoque suficiente foi encontrado na base de dados."
        }

        return Pair(parecer, sugestoes)
    }

    /**
     * Gera texto profissional para o rótulo de um produto final atendendo às diretrizes:
     * - Materiais utilizados SEM quantidades;
     * - Características do produto e quantidade por embalagem;
     * - Modo de uso detalhado e precauções.
     */
    fun gerarRotuloProduto(
        nomeProduto: String,
        descricao: String?,
        embalagens: List<String>,
        materiais: List<String>
    ): String? {
        val apiKey = getApiKey()
        if (apiKey.isBlank()) return null

        val prompt = """
            Você é um especialista em rotulagem de produtos artesanais, cosméticos e perfumaria para ambientes.
            Gere o texto completo, elegante e profissional para o RÓTULO do seguinte produto:
            
            PRODUTO: $nomeProduto
            DESCRIÇÃO/CARACTERÍSTICAS INICIAIS: ${descricao ?: "Não informada"}
            VOLUMES / EMBALAGENS DISPONÍVEIS: ${if (embalagens.isNotEmpty()) embalagens.joinToString(", ") else "Conforme embalagem de envase"}
            MATERIAIS / INGREDIENTES: ${materiais.joinToString(", ")}
            
            REGRAS OBRIGATÓRIAS:
            1. NÃO inclua quantidades, dosagens ou porcentagens dos materiais/ingredientes. Liste apenas o nome dos materiais utilizados.
            2. Inclua uma seção clara de CARACTERÍSTICAS do produto (descrição sensorial, propósito e notas olfativas se aplicável).
            3. Inclua a QUANTIDADE POR EMBALAGEM / CONTEÚDO (listando os tamanhos/embalagens disponíveis).
            4. Inclua o MODO DE USO específico e prático para o tipo deste produto (passo a passo para o consumidor).
            5. Inclua PRECAUÇÕES E CUIDADOS adequados.
            
            Formate de maneira limpa em texto estruturado com títulos em caixa alta. Não use formatações markdown excessivas, use apenas texto legível para impressão direta de etiqueta/rótulo.
        """.trimIndent()

        return try {
            val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"
            val partText = JsonObject().apply { addProperty("text", prompt) }
            val partsArray = JsonArray().apply { add(partText) }
            val contentObj = JsonObject().apply { add("parts", partsArray) }
            val contentsArray = JsonArray().apply { add(contentObj) }
            val generationConfig = JsonObject().apply { addProperty("temperature", 0.4) }
            val requestBody = JsonObject().apply {
                add("contents", contentsArray)
                add("generationConfig", generationConfig)
            }

            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                .build()

            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() in 200..299) {
                val responseJson = JsonParser.parseString(response.body()).asJsonObject
                responseJson.getAsJsonArray("candidates")
                    ?.get(0)?.asJsonObject
                    ?.getAsJsonObject("content")
                    ?.getAsJsonArray("parts")
                    ?.get(0)?.asJsonObject
                    ?.get("text")?.asString?.trim()
            } else {
                null
            }
        } catch (e: Exception) {
            println("Aviso: Falha ao chamar Gemini para rótulo (${e.message}). Usando gerador determinístico.")
            null
        }
    }
}
