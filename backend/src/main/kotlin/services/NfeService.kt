package org.example.services

import org.example.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.w3c.dom.Element
import org.w3c.dom.Node
import java.io.ByteArrayInputStream
import java.time.Instant
import java.time.LocalDateTime
import javax.xml.parsers.DocumentBuilderFactory

class NfeService(private val geminiService: GeminiService) {

    /**
     * Processa um arquivo enviado (XML, PDF ou Imagem), extrai seus dados e executa a
     * conciliação semântica com os insumos e fornecedores do banco de dados.
     */
    fun processarDocumento(
        bytes: ByteArray,
        fileName: String,
        mimeType: String
    ): NfeAnaliseCompletaResponse {
        val isXml = fileName.endsWith(".xml", ignoreCase = true) || mimeType.contains("xml")
        
        val dadosNota: NfeDadosExtraidos = if (isXml) {
            parseXmlNfe(bytes)
        } else {
            geminiService.extrairDadosDocumento(bytes, mimeType)
        }

        return transaction {
            // 1. Busca todos os insumos cadastrados com suas unidades de medida
            val insumosRows = InsumosTable.join(
                UnidadesMedidaTable,
                JoinType.LEFT,
                InsumosTable.unidadeMedidaId,
                UnidadesMedidaTable.id
            ).selectAll().toList()

            val insumosDisponiveis = insumosRows.map { row ->
                InsumoResumoDTO(
                    id = row[InsumosTable.id],
                    nome = row[InsumosTable.nome],
                    unidadeMedidaId = row[InsumosTable.unidadeMedidaId],
                    unidadeSigla = row.getOrNull(UnidadesMedidaTable.sigla) ?: "UN",
                    precoAtual = row[InsumosTable.preco],
                    estoqueAtual = row[InsumosTable.estoque] ?: 0.0,
                    isEmbalagem = row[InsumosTable.isEmbalagem]
                )
            }

            // 2. Busca todas as unidades de medida cadastradas
            val unidadesDisponiveis = UnidadesMedidaTable.selectAll().map { row ->
                UnidadeMedida(
                    id = row[UnidadesMedidaTable.id],
                    nome = row[UnidadesMedidaTable.nome],
                    sigla = row[UnidadesMedidaTable.sigla]
                )
            }

            // 3. Verifica se o fornecedor já existe pelo CNPJ
            val cnpjFormatado = dadosNota.fornecedor?.cnpj?.let { formatarCnpj(it) }
            val cnpjDigitos = dadosNota.fornecedor?.cnpj?.replace(Regex("[^0-9]"), "")

            var fornecedorExistenteId: Int? = null
            var fornecedorExistenteNome: String? = null

            if (!cnpjDigitos.isNullOrBlank()) {
                val fornecedorRow = FornecedoresTable.selectAll()
                    .firstOrNull { row ->
                        val dbCnpj = row[FornecedoresTable.cnpjCpf].replace(Regex("[^0-9]"), "")
                        dbCnpj == cnpjDigitos
                    }

                if (fornecedorRow != null) {
                    fornecedorExistenteId = fornecedorRow[FornecedoresTable.id]
                    fornecedorExistenteNome = fornecedorRow[FornecedoresTable.nome]
                }
            }

            // 4. Executa a conciliação semântica com o Gemini (ou fallback determinístico)
            val conciliacoesMap = geminiService.conciliarItensSemanticamente(
                dadosNota.itens,
                insumosDisponiveis
            )

            val itensConciliados = dadosNota.itens.map { item ->
                conciliacoesMap[item.numeroItem] ?: ItemConciliacaoSugestao(
                    itemNfe = item,
                    insumoIdSugerido = null,
                    scoreConfianca = 0.0,
                    justificativa = "Item não conciliado",
                    novoInsumoSugerido = true
                )
            }

            NfeAnaliseCompletaResponse(
                dadosNota = dadosNota,
                fornecedorExistenteId = fornecedorExistenteId,
                fornecedorExistenteNome = fornecedorExistenteNome,
                itensConciliados = itensConciliados,
                insumosDisponiveis = insumosDisponiveis,
                unidadesDisponiveis = unidadesDisponiveis
            )
        }
    }

    /**
     * Confirma a entrada da NF-e no sistema:
     * - Cria/associa Fornecedor
     * - Cria Compra com status RECEBIDO
     * - Cria Itens da Compra
     * - Cadastra novos Insumos (se solicitado)
     * - Atualiza Saldo de Estoque e Preço de Custo dos Insumos
     */
    fun confirmarEntradaNfe(req: ConfirmarEntradaNfeRequest): ConfirmarEntradaNfeResponse = transaction {
        var novosInsumosCriados = 0

        // 1. Identificar ou Criar Fornecedor
        var fornecedorId = req.fornecedorId
        val cnpjLimpo = req.fornecedorCnpj?.replace(Regex("[^0-9]"), "") ?: ""

        if (fornecedorId == null || fornecedorId <= 0) {
            if (cnpjLimpo.isNotBlank()) {
                val fornExistente = FornecedoresTable.selectAll()
                    .firstOrNull { row ->
                        row[FornecedoresTable.cnpjCpf].replace(Regex("[^0-9]"), "") == cnpjLimpo
                    }

                if (fornExistente != null) {
                    fornecedorId = fornExistente[FornecedoresTable.id]
                } else {
                    // Cadastra fornecedor novo
                    val novoNome = req.fornecedorNome?.ifBlank { "Fornecedor CNPJ $cnpjLimpo" } ?: "Fornecedor $cnpjLimpo"
                    fornecedorId = FornecedoresTable.insert {
                        it[nome] = novoNome
                        it[cnpjCpf] = if (req.fornecedorCnpj.isNullOrBlank()) cnpjLimpo else req.fornecedorCnpj
                        it[nomeFantasia] = req.fornecedorNome
                    } get FornecedoresTable.id
                }
            }
        }

        // 2. Criar registro de Compra
        val justificativaNota = "Entrada automática de NF-e ${req.numeroNota ?: ""} - Fornecedor: ${req.fornecedorNome ?: "N/D"}"
        val compraId = ComprasTable.insert {
            it[this.fornecedorId] = fornecedorId
            it[justificativa] = justificativaNota
            it[status] = StatusCompra.RECEBIDO.name
            it[valorTotal] = req.valorTotalNota
            it[dataCriacao] = Instant.now()
        } get ComprasTable.id

        // 3. Buscar unidade padrão ("UN") para fallback
        val unidadePadraoId = UnidadesMedidaTable.selectAll()
            .firstOrNull { it[UnidadesMedidaTable.sigla].equals("UN", ignoreCase = true) }
            ?.get(UnidadesMedidaTable.id)
            ?: UnidadesMedidaTable.selectAll().firstOrNull()?.get(UnidadesMedidaTable.id)
            ?: 1

        // 4. Processar cada item da nota
        req.itens.forEach { itemReq ->
            var finalInsumoId = itemReq.insumoId

            if (itemReq.criarNovoInsumo || finalInsumoId == null || finalInsumoId <= 0) {
                // Cadastra novo Insumo
                val nomeNovo = itemReq.novoInsumoNome?.ifBlank { "Insumo NF ${itemReq.numeroItem}" } ?: "Insumo NF ${itemReq.numeroItem}"
                val unidadeId = itemReq.novoInsumoUnidadeId ?: unidadePadraoId

                finalInsumoId = InsumosTable.insert {
                    it[nome] = nomeNovo
                    it[unidadeMedidaId] = unidadeId
                    it[this.fornecedorId] = fornecedorId
                    it[preco] = itemReq.precoUnitario
                    it[isEmbalagem] = itemReq.novoInsumoIsEmbalagem
                    it[estoque] = 0.0
                } get InsumosTable.id

                novosInsumosCriados++

                // Registra entrada inicial no estoque e no ledger via EstoqueService
                org.example.repository.AppDatabase.default.estoque.registrarEntradaCompra(
                    insumoId = finalInsumoId,
                    quantidadeEmbalagens = itemReq.quantidade,
                    compraId = compraId,
                    motivo = "Entrada automática NF-e nº ${req.numeroNota ?: ""}"
                )
            } else {
                // Atualiza estoque via serviço centralizado com conversão e registro no ledger
                org.example.repository.AppDatabase.default.estoque.registrarEntradaCompra(
                    insumoId = finalInsumoId,
                    quantidadeEmbalagens = itemReq.quantidade,
                    compraId = compraId,
                    motivo = "Entrada automática NF-e nº ${req.numeroNota ?: ""}"
                )

                // Atualiza preço de custo da última compra e fornecedor
                InsumosTable.update({ InsumosTable.id eq finalInsumoId }) {
                    it[preco] = itemReq.precoUnitario
                    if (fornecedorId != null) {
                        it[this.fornecedorId] = fornecedorId
                    }
                }
            }

            // Inserir Item da Compra
            ItensCompraTable.insert {
                it[this.compraId] = compraId
                it[insumoId] = finalInsumoId
                it[quantidadeSolicitada] = itemReq.quantidade
                it[quantidadeComprada] = itemReq.quantidade
                it[quantidadeRecebida] = itemReq.quantidade
                it[precoUnitario] = itemReq.precoUnitario
                it[fornecedorSugeridoId] = fornecedorId
                it[ativo] = true
            }
        }

        ConfirmarEntradaNfeResponse(
            success = true,
            compraId = compraId,
            itensProcessados = req.itens.size,
            novosInsumosCriados = novosInsumosCriados,
            mensagem = "Nota Fiscal importada com sucesso! Compra #$compraId registrada e estoques atualizados."
        )
    }

    /**
     * Parser XML nativo para NF-e padrão SEFAZ Brasil.
     */
    fun parseXmlNfe(xmlBytes: ByteArray): NfeDadosExtraidos {
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = true
        val builder = factory.newDocumentBuilder()
        val doc = builder.parse(ByteArrayInputStream(xmlBytes))
        doc.documentElement.normalize()

        // 1. Chave de acesso e Identificação
        val infNFe = doc.getElementsByTagName("infNFe").item(0) as? Element
        val chaveAcesso = infNFe?.getAttribute("Id")?.replace("NFe", "")

        val ide = doc.getElementsByTagName("ide").item(0) as? Element
        val numeroNota = getTagValue(ide, "nNF")
        val serie = getTagValue(ide, "serie")
        val dataEmissaoRaw = getTagValue(ide, "dhEmi") ?: getTagValue(ide, "dEmi")
        val dataEmissao = dataEmissaoRaw?.take(10) // YYYY-MM-DD

        // 2. Emitente (Fornecedor)
        val emit = doc.getElementsByTagName("emit").item(0) as? Element
        val cnpjEmit = getTagValue(emit, "CNPJ") ?: getTagValue(emit, "CPF")
        val razaoSocialEmit = getTagValue(emit, "xNome")
        val nomeFantasiaEmit = getTagValue(emit, "xFant")

        val enderEmit = doc.getElementsByTagName("enderEmit").item(0) as? Element
        val logradouro = getTagValue(enderEmit, "xLgr")
        val numero = getTagValue(enderEmit, "nro")
        val bairro = getTagValue(enderEmit, "xBairro")
        val municipio = getTagValue(enderEmit, "xMun")
        val uf = getTagValue(enderEmit, "UF")
        val fone = getTagValue(enderEmit, "fone")
        val enderecoCompleto = listOfNotNull(logradouro, numero, bairro, municipio).joinToString(", ")

        val fornecedor = NfeFornecedorExtraido(
            cnpj = formatarCnpj(cnpjEmit),
            razaoSocial = razaoSocialEmit,
            nomeFantasia = nomeFantasiaEmit,
            endereco = enderecoCompleto.ifBlank { null },
            uf = uf,
            telefone = fone
        )

        // 3. Totais
        val totalIcm = doc.getElementsByTagName("ICMSTot").item(0) as? Element
        val vProd = parseDouble(getTagValue(totalIcm, "vProd"))
        val vFrete = parseDouble(getTagValue(totalIcm, "vFrete"))
        val vDesc = parseDouble(getTagValue(totalIcm, "vDesc"))
        val vNF = parseDouble(getTagValue(totalIcm, "vNF"))

        // 4. Detalhes dos Itens
        val detList = doc.getElementsByTagName("det")
        val itens = mutableListOf<NfeItemExtraido>()

        for (i in 0 until detList.length) {
            val detElem = detList.item(i) as? Element ?: continue
            val nItem = detElem.getAttribute("nItem").toIntOrNull() ?: (i + 1)
            val prodElem = detElem.getElementsByTagName("prod").item(0) as? Element ?: continue

            val cProd = getTagValue(prodElem, "cProd")
            val xProd = getTagValue(prodElem, "xProd") ?: "Item $nItem"
            val ncm = getTagValue(prodElem, "NCM")
            val cfop = getTagValue(prodElem, "CFOP")
            val uCom = getTagValue(prodElem, "uCom") ?: "UN"
            val qCom = parseDouble(getTagValue(prodElem, "qCom"))
            val vUnCom = parseDouble(getTagValue(prodElem, "vUnCom"))
            val vProdItem = parseDouble(getTagValue(prodElem, "vProd"))

            itens.add(
                NfeItemExtraido(
                    numeroItem = nItem,
                    codigoProdutoFornecedor = cProd,
                    descricao = xProd,
                    ncm = ncm,
                    cfop = cfop,
                    unidadeComercial = uCom.uppercase(),
                    quantidade = if (qCom <= 0.0) 1.0 else qCom,
                    valorUnitario = if (vUnCom <= 0.0 && qCom > 0) vProdItem / qCom else vUnCom,
                    valorTotal = if (vProdItem <= 0.0) vUnCom * qCom else vProdItem
                )
            )
        }

        return NfeDadosExtraidos(
            chaveAcesso = chaveAcesso,
            numeroNota = numeroNota,
            serie = serie,
            dataEmissao = dataEmissao,
            valorTotalProdutos = vProd,
            valorFrete = vFrete,
            valorDesconto = vDesc,
            valorTotalNota = if (vNF > 0.0) vNF else vProd + vFrete - vDesc,
            fornecedor = fornecedor,
            itens = itens
        )
    }

    private fun getTagValue(parent: Element?, tagName: String): String? {
        if (parent == null) return null
        val list = parent.getElementsByTagName(tagName)
        if (list.length == 0) return null
        val node = list.item(0) ?: return null
        return node.textContent?.trim()
    }

    private fun parseDouble(value: String?): Double {
        if (value.isNullOrBlank()) return 0.0
        return value.replace(",", ".").toDoubleOrNull() ?: 0.0
    }

    private fun formatarCnpj(cnpj: String?): String? {
        if (cnpj.isNullOrBlank()) return null
        val digits = cnpj.replace(Regex("[^0-9]"), "")
        if (digits.length == 14) {
            return "${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12, 14)}"
        }
        return cnpj
    }
}
