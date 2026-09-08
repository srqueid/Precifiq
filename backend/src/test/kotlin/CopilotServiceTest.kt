package org.example

import org.example.services.CopilotService
import org.example.services.GeminiService
import org.example.services.SqlSecurityValidator
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class CopilotServiceTest {

    private val geminiService = GeminiService()
    private val copilotService = CopilotService(geminiService)

    @Test
    fun `deve aprovar consultas SELECT seguras e aplicar LIMIT quando necessario`() {
        val sqlSeguro = "SELECT i.nome, i.estoque FROM insumo i WHERE i.estoque < 10"
        val resultado = SqlSecurityValidator.validar(sqlSeguro)

        assertTrue(resultado is SqlSecurityValidator.ValidacaoResultado.Valido)
        val sqlSanitizado = (resultado as SqlSecurityValidator.ValidacaoResultado.Valido).sqlSanitizado
        assertTrue(sqlSanitizado.contains("LIMIT 50"))
    }

    @Test
    fun `deve aprovar consultas com JOINs e apelidos`() {
        val sqlJoin = "SELECT i.nome, u.sigla, f.nome as fornecedor FROM insumo i LEFT JOIN unidade_medida u ON i.unidade_medida_id = u.id LEFT JOIN fornecedor f ON i.fornecedor_id = f.id LIMIT 20"
        val resultado = SqlSecurityValidator.validar(sqlJoin)

        assertTrue(resultado is SqlSecurityValidator.ValidacaoResultado.Valido)
    }

    @Test
    fun `deve bloquear comandos de mutacao DDL e DML`() {
        val mutacoes = listOf(
            "DROP TABLE insumo",
            "DELETE FROM insumo WHERE id = 1",
            "UPDATE insumo SET estoque = 100",
            "INSERT INTO fornecedor (nome) VALUES ('Fake')",
            "ALTER TABLE produto_final ADD COLUMN teste VARCHAR",
            "TRUNCATE TABLE movimento_estoque_insumo"
        )

        for (sql in mutacoes) {
            val res = SqlSecurityValidator.validar(sql)
            assertTrue(res is SqlSecurityValidator.ValidacaoResultado.Invalido, "Deveria ter bloqueado: $sql")
        }
    }

    @Test
    fun `deve bloquear consultas empilhadas com ponto e virgula`() {
        val stacked = "SELECT * FROM insumo; DROP TABLE cliente"
        val res = SqlSecurityValidator.validar(stacked)
        assertTrue(res is SqlSecurityValidator.ValidacaoResultado.Invalido)
    }

    @Test
    fun `deve bloquear comentarios SQL que tentam evadir validacao`() {
        val comComentario1 = "SELECT * FROM insumo -- comentario"
        val comComentario2 = "SELECT /* inline */ * FROM insumo"

        assertTrue(SqlSecurityValidator.validar(comComentario1) is SqlSecurityValidator.ValidacaoResultado.Invalido)
        assertTrue(SqlSecurityValidator.validar(comComentario2) is SqlSecurityValidator.ValidacaoResultado.Invalido)
    }

    @Test
    fun `deve bloquear tabelas de metadados internos e do PostgreSQL`() {
        val pgUser = "SELECT * FROM pg_user"
        val infoSchema = "SELECT * FROM information_schema.tables"

        assertTrue(SqlSecurityValidator.validar(pgUser) is SqlSecurityValidator.ValidacaoResultado.Invalido)
        assertTrue(SqlSecurityValidator.validar(infoSchema) is SqlSecurityValidator.ValidacaoResultado.Invalido)
    }

    @Test
    fun `deve retornar lista de sugestoes operacionais validas`() {
        val sugestoes = copilotService.obterSugestoes()
        assertNotNull(sugestoes)
        assertTrue(sugestoes.size >= 5)
        assertTrue(sugestoes.any { it.categoria == "Estoque" })
        assertTrue(sugestoes.any { it.categoria == "Compras" })
    }
}
