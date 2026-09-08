package org.example

import org.example.services.GeminiService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class FormulacaoIaServiceTest {

    private val geminiService = GeminiService()

    @Test
    fun `deve sugerir substituto de insumo compativel quando houver deficit na OP`() {
        val itensFaltantes = listOf(
            ItemInsumoFaltanteDTO(
                insumoId = 1,
                insumoNome = "Álcool de Cereais",
                quantidadeNecessaria = 1000.0,
                saldoAtual = 200.0,
                deficit = 800.0,
                unidadeSigla = "ml",
                isEmbalagem = false
            )
        )

        val insumosDisponiveis = listOf(
            InsumoResumoDTO(
                id = 14,
                nome = "Álcool Etílico Neutro 96",
                unidadeMedidaId = 1,
                unidadeSigla = "ml",
                precoAtual = 18.0,
                estoqueAtual = 5000.0,
                isEmbalagem = false
            ),
            InsumoResumoDTO(
                id = 20,
                nome = "Frasco Vidro Âmbar 250ml",
                unidadeMedidaId = 2,
                unidadeSigla = "un",
                precoAtual = 3.50,
                estoqueAtual = 150.0,
                isEmbalagem = true
            )
        )

        val (parecer, sugestoes) = geminiService.sugerirSubstitutosFormulacao(
            produtoNome = "Difusor de Aromas Bamboo",
            itensFaltantes = itensFaltantes,
            insumosDisponiveis = insumosDisponiveis
        )

        assertNotNull(parecer)
        assertTrue(parecer.isNotBlank())
        assertNotNull(sugestoes)
        assertTrue(sugestoes.isNotEmpty())

        val sub = sugestoes.first()
        assertEquals(1, sub.insumoFaltanteId)
        assertEquals(14, sub.insumoSubstitutoId)
        assertTrue(sub.scoreCompatibilidade > 0.5)
        assertNotNull(sub.justificativaTecnica)
    }
}
