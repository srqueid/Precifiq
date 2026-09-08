package org.example

import org.example.services.GeminiService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class PrevisaoServiceTest {

    private val geminiService = GeminiService()

    @Test
    fun `deve gerar insights estrategicos de estoque e margem corretamente`() {
        val itensRuptura = listOf(
            ItemPrevisaoRupturaDTO(
                insumoId = 1,
                insumoNome = "Álcool de Cereais",
                unidadeSigla = "ml",
                estoqueAtual = 1200.0,
                estoqueMinimo = 5000.0,
                consumoMedioDiario = 850.0,
                diasAteRuptura = 1,
                dataEstimadaRuptura = "03/09/2026",
                nivelRisco = "CRITICO",
                quantidadeSugeridaCompra = 25000.0,
                fornecedorSugeridoId = 1,
                fornecedorSugeridoNome = "Distribuidora Química Brasil",
                justificativaIa = "Risco crítico de interrupção da produção em 1 dia(s)."
            ),
            ItemPrevisaoRupturaDTO(
                insumoId = 2,
                insumoNome = "Frasco Âmbar 250ml",
                unidadeSigla = "un",
                estoqueAtual = 25.0,
                estoqueMinimo = 50.0,
                consumoMedioDiario = 5.0,
                diasAteRuptura = 5,
                dataEstimadaRuptura = "07/09/2026",
                nivelRisco = "ALERTA",
                quantidadeSugeridaCompra = 100.0,
                fornecedorSugeridoId = 2,
                fornecedorSugeridoNome = "Vidraria Nacional",
                justificativaIa = "Saldo de segurança em nível de atenção."
            )
        )

        val alertasMargem = listOf(
            AlertaMargemDTO(
                variacaoId = 10,
                produtoId = 2,
                produtoNome = "Difusor Lavanda Francesa",
                nomeTamanho = "250ml",
                custoUnitario = 28.50,
                precoVenda = 25.00,
                margemAtual = -14.0,
                margemAlvo = 30.0,
                precoSugerido = 40.71,
                impacto = "PREJUIZO",
                justificativa = "Custo unitário excede o preço de venda atual."
            )
        )

        val insights = geminiService.gerarInsightsEstrategicos(
            itensRuptura = itensRuptura,
            alertasMargem = alertasMargem,
            totalInsumos = 50,
            totalProdutos = 15
        )

        assertNotNull(insights)
        assertTrue(insights.isNotBlank())
        assertTrue(insights.contains("Álcool de Cereais") || insights.contains("crítico") || insights.contains("Atenção"))
        assertTrue(insights.contains("Difusor Lavanda Francesa") || insights.contains("Margem") || insights.contains("Prejuízo"))
    }
}
