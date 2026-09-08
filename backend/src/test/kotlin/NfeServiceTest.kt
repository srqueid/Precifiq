package org.example

import org.example.services.GeminiService
import org.example.services.NfeService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.nio.charset.StandardCharsets

class NfeServiceTest {

    private val geminiService = GeminiService()
    private val nfeService = NfeService(geminiService)

    @Test
    fun `deve fazer o parse correto de XML padrao SEFAZ`() {
        val xmlExemplo = """
            <?xml version="1.0" encoding="UTF-8"?>
            <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
              <NFe>
                <infNFe Id="NFe35210812345678000190550010000148201234567890" versao="4.00">
                  <ide>
                    <nNF>14820</nNF>
                    <serie>1</serie>
                    <dhEmi>2026-08-30T10:15:00-03:00</dhEmi>
                  </ide>
                  <emit>
                    <CNPJ>12345678000190</CNPJ>
                    <xNome>DISTRIBUIDORA QUIMICA BRASIL LTDA</xNome>
                    <xFant>QUIMICA BRASIL</xFant>
                    <enderEmit>
                      <xLgr>Av Industrial</xLgr>
                      <nro>1500</nro>
                      <xBairro>Distrito Industrial</xBairro>
                      <xMun>Campinas</xMun>
                      <UF>SP</UF>
                      <fone>1932001122</fone>
                    </enderEmit>
                  </emit>
                  <det nItem="1">
                    <prod>
                      <cProd>ALC-001</cProd>
                      <xProd>ALCOOL ETILICO NEUTRO 96 GL 1L</xProd>
                      <NCM>22071090</NCM>
                      <CFOP>5102</CFOP>
                      <uCom>UN</uCom>
                      <qCom>10.0000</qCom>
                      <vUnCom>18.5000</vUnCom>
                      <vProd>185.00</vProd>
                    </prod>
                  </det>
                  <det nItem="2">
                    <prod>
                      <cProd>ESS-042</cProd>
                      <xProd>ESSENCIA NATURAL DE LAVANDA 500ML</xProd>
                      <NCM>33029019</NCM>
                      <CFOP>5102</CFOP>
                      <uCom>UN</uCom>
                      <qCom>4.0000</qCom>
                      <vUnCom>65.0000</vUnCom>
                      <vProd>260.00</vProd>
                    </prod>
                  </det>
                  <total>
                    <ICMSTot>
                      <vProd>445.00</vProd>
                      <vFrete>35.00</vFrete>
                      <vDesc>0.00</vDesc>
                      <vNF>480.00</vNF>
                    </ICMSTot>
                  </total>
                </infNFe>
              </NFe>
            </nfeProc>
        """.trimIndent()

        val bytes = xmlExemplo.toByteArray(StandardCharsets.UTF_8)
        
        // Chamada direta do parser XML SEFAZ
        val dados = nfeService.parseXmlNfe(bytes)

        assertEquals("14820", dados.numeroNota)
        assertEquals("1", dados.serie)
        assertEquals("2026-08-30", dados.dataEmissao)
        assertEquals(445.0, dados.valorTotalProdutos)
        assertEquals(35.0, dados.valorFrete)
        assertEquals(480.0, dados.valorTotalNota)
        
        assertNotNull(dados.fornecedor)
        assertEquals("12.345.678/0001-90", dados.fornecedor?.cnpj)
        assertEquals("DISTRIBUIDORA QUIMICA BRASIL LTDA", dados.fornecedor?.razaoSocial)

        assertEquals(2, dados.itens.size)
        
        val item1 = dados.itens[0]
        assertEquals(1, item1.numeroItem)
        assertEquals("ALCOOL ETILICO NEUTRO 96 GL 1L", item1.descricao)
        assertEquals(10.0, item1.quantidade)
        assertEquals(18.5, item1.valorUnitario)
        assertEquals(185.0, item1.valorTotal)

        val item2 = dados.itens[1]
        assertEquals(2, item2.numeroItem)
        assertEquals("ESSENCIA NATURAL DE LAVANDA 500ML", item2.descricao)
        assertEquals(4.0, item2.quantidade)
        assertEquals(65.0, item2.valorUnitario)
        assertEquals(260.0, item2.valorTotal)
    }
}
