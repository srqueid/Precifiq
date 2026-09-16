package org.example

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class AuthSuperuserRoleTest {

    @Test
    fun `deve instanciar superusuario com flag isSuperuser verdadeira`() {
        val superuser = UsuarioGlobalDTO(
            id = 1,
            nome = "Superusuário DcSys",
            email = "admin@dcsys.com",
            isSuperuser = true,
            ativo = true,
            empresas = emptyList()
        )

        assertEquals(1, superuser.id)
        assertEquals("admin@dcsys.com", superuser.email)
        assertTrue(superuser.isSuperuser)
        assertTrue(superuser.ativo)
    }

    @Test
    fun `deve instanciar usuario comum com flag isSuperuser falsa`() {
        val usuarioComum = UsuarioGlobalDTO(
            id = 2,
            nome = "Silvia Administradora",
            email = "silvia@empresa.com",
            isSuperuser = false,
            ativo = true,
            empresas = listOf(
                UsuarioEmpresaVinculoDTO(
                    id = 10,
                    empresaId = 1,
                    empresaNome = "Controle Silvia (Matriz)",
                    empresaTipo = "MATRIZ",
                    schemaName = "controle",
                    perfilId = 2,
                    perfilCodigo = "ADMIN_MATRIZ",
                    perfilNome = "Administrador da Matriz"
                )
            )
        )

        assertEquals(2, usuarioComum.id)
        assertEquals("silvia@empresa.com", usuarioComum.email)
        assertFalse(usuarioComum.isSuperuser)
        assertTrue(usuarioComum.ativo)
        assertEquals(1, usuarioComum.empresas?.size)
        assertEquals("ADMIN_MATRIZ", usuarioComum.empresas?.first()?.perfilCodigo)
    }

    @Test
    fun `perfil de usuario comum nao deve possuir flag de superusuario`() {
        val claudio = UsuarioGlobalDTO(
            id = 3,
            nome = "Claudio Henrique Ferrera",
            email = "claudio@galeriavagalume.com.br",
            isSuperuser = false,
            ativo = true
        )

        assertFalse(claudio.isSuperuser)
    }

    @Test
    fun `deve validar email de superadmin em maiusculas ou minusculas com espacos`() {
        assertTrue(org.example.routes.isSuperadminEmail("admin@dcsys.com"))
        assertTrue(org.example.routes.isSuperadminEmail("  ADMIN@DCSYS.COM  "))
        assertFalse(org.example.routes.isSuperadminEmail("outro@empresa.com"))
        assertFalse(org.example.routes.isSuperadminEmail(null))
    }

    @Test
    fun `deve validar senha padrao do superadmin`() {
        assertTrue(org.example.routes.verifySuperadminPassword("admin123"))
        assertFalse(org.example.routes.verifySuperadminPassword("senha_errada"))
    }

    @Test
    fun `deve gerar sessao superadmin offline valida mesmo sem banco de dados`() {
        val sessao = org.example.routes.montarSessaoSuperadminOffline("admin@dcsys.com")
        
        assertNotNull(sessao.token)
        assertTrue(sessao.token.startsWith("jwt_superadmin_"))
        assertEquals("admin@dcsys.com", sessao.usuario.email)
        assertTrue(sessao.usuario.isSuperuser)
        assertTrue(sessao.usuario.ativo)
        assertFalse(sessao.empresasHierarquia.isEmpty())
        assertEquals("controle", sessao.empresasHierarquia.first().schemaName)
    }

    @Test
    fun `deve autorizar superadmin para qualquer schema mesmo com banco desconectado`() {
        assertTrue(org.example.routes.isUserAuthorizedForSchema("admin@dcsys.com", "qualquer_schema"))
        assertTrue(org.example.routes.isUserAuthorizedForSchema("ADMIN@DCSYS.COM", "schema_inexistente"))
        assertEquals("controle", org.example.routes.obterSchemaPadraoUsuario("admin@dcsys.com"))
    }
}
