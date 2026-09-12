package org.example

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class TipoInsumoTest {

    @Test
    fun `deve instanciar TipoInsumo com valores corretos e defaults esperados`() {
        val tipoMateriaPrima = TipoInsumo(
            id = 1,
            nome = "Matéria-prima",
            descricao = "Insumos da formulação base",
            isEmbalagem = false,
            insumosVinculadosCount = 10
        )

        assertEquals(1, tipoMateriaPrima.id)
        assertEquals("Matéria-prima", tipoMateriaPrima.nome)
        assertEquals("Insumos da formulação base", tipoMateriaPrima.descricao)
        assertFalse(tipoMateriaPrima.isEmbalagem)
        assertEquals(10L, tipoMateriaPrima.insumosVinculadosCount)

        val tipoEmbalagem = TipoInsumo(
            id = 2,
            nome = "Frascos e Potes",
            isEmbalagem = true
        )

        assertEquals(2, tipoEmbalagem.id)
        assertEquals("Frascos e Potes", tipoEmbalagem.nome)
        assertNull(tipoEmbalagem.descricao)
        assertTrue(tipoEmbalagem.isEmbalagem)
        assertEquals(0L, tipoEmbalagem.insumosVinculadosCount)
    }

    @Test
    fun `deve associar Insumo a TipoInsumo preservando compatibilidade retroativa com isEmbalagem`() {
        val insumo = Insumo(
            id = 101,
            nome = "Fragrância Lavanda Francesa",
            unidadeMedidaId = 3, // ml
            quantidadePorEmbalagem = 1000.0,
            unidadeEmbalagemId = null,
            fornecedorId = 5,
            preco = 145.0,
            isEmbalagem = false,
            estoque = 3500.0,
            estoqueMinimo = 500.0,
            tipoInsumoId = 3,
            tipoInsumoNome = "Fragrâncias e Essências"
        )

        assertEquals(101, insumo.id)
        assertEquals(3, insumo.tipoInsumoId)
        assertEquals("Fragrâncias e Essências", insumo.tipoInsumoNome)
        assertFalse(insumo.isEmbalagem)
    }

    @Test
    fun `deve filtrar e agrupar insumos por tipo corretamente`() {
        val tipo1 = TipoInsumo(id = 1, nome = "Matéria-prima", isEmbalagem = false)
        val tipo2 = TipoInsumo(id = 2, nome = "Embalagem", isEmbalagem = true)
        val tipo3 = TipoInsumo(id = 3, nome = "Rótulos e Etiquetas", isEmbalagem = true)

        val insumos = listOf(
            Insumo(1, "Álcool de Cereais", 1, 1000.0, null, 1, 15.0, isEmbalagem = false, tipoInsumoId = 1, tipoInsumoNome = "Matéria-prima"),
            Insumo(2, "Frasco Âmbar 100ml", 2, 1.0, null, 2, 2.50, isEmbalagem = true, tipoInsumoId = 2, tipoInsumoNome = "Embalagem"),
            Insumo(3, "Etiqueta Adesiva Vinil", 2, 100.0, null, 3, 40.0, isEmbalagem = true, tipoInsumoId = 3, tipoInsumoNome = "Rótulos e Etiquetas")
        )

        val filtradosPorTipo3 = insumos.filter { it.tipoInsumoId == 3 }
        assertEquals(1, filtradosPorTipo3.size)
        assertEquals("Etiqueta Adesiva Vinil", filtradosPorTipo3.first().nome)

        val apenasEmbalagens = insumos.filter { it.isEmbalagem }
        assertEquals(2, apenasEmbalagens.size)
        assertTrue(apenasEmbalagens.any { it.tipoInsumoId == 2 })
        assertTrue(apenasEmbalagens.any { it.tipoInsumoId == 3 })
    }
}
