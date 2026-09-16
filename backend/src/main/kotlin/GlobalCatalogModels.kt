package org.example

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
import org.jetbrains.exposed.sql.javatime.CurrentDateTime
import java.security.MessageDigest
import java.time.LocalDateTime

// ==============================================================================
// TABELAS DO CATÁLOGO GLOBAL (Schema: global)
// ==============================================================================

object EmpresasTable : Table("empresa") {
    val id = integer("id").autoIncrement()
    val tipo = varchar("tipo", 20).default("MATRIZ") // 'MATRIZ' ou 'FILIAL'
    val matrizId = integer("matriz_id").references(EmpresasTable.id).nullable()
    val nomeFantasia = varchar("nome_fantasia", 150)
    val razaoSocial = varchar("razao_social", 255).nullable()
    val cnpj = varchar("cnpj", 20).nullable().uniqueIndex()
    val schemaName = varchar("schema_name", 63).uniqueIndex()
    val bancoDados = varchar("banco_dados", 100).default("bd_controle")
    val ativo = bool("ativo").default(true)
    val limiteProdutos = integer("limite_produtos").nullable()
    val criadoEm = datetime("criado_em").defaultExpression(CurrentDateTime)
    val atualizadoEm = datetime("atualizado_em").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id)
}

object PerfisTable : Table("perfil") {
    val id = integer("id").autoIncrement()
    val codigo = varchar("codigo", 50).uniqueIndex() // 'SUPERUSER', 'ADMIN_MATRIZ', 'GERENTE_FILIAL', 'OPERADOR'
    val nome = varchar("nome", 100)
    val descricao = text("descricao").nullable()
    val permissoes = text("permissoes").nullable()

    override val primaryKey = PrimaryKey(id)
}

object UsuariosTable : Table("usuario") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 150)
    val email = varchar("email", 150).uniqueIndex()
    val senhaHash = varchar("senha_hash", 255)
    val isSuperuser = bool("is_superuser").default(false)
    val ativo = bool("ativo").default(true)
    val criadoEm = datetime("criado_em").defaultExpression(CurrentDateTime)
    val fotoUrl = varchar("foto_url", 500).nullable()
    val googleId = varchar("google_id", 100).nullable()
    val resetToken = varchar("reset_token", 100).nullable()
    val resetTokenExpira = datetime("reset_token_expira").nullable()

    override val primaryKey = PrimaryKey(id)
}

object UsuarioEmpresasTable : Table("usuario_empresa") {
    val id = integer("id").autoIncrement()
    val usuarioId = integer("usuario_id").references(UsuariosTable.id)
    val empresaId = integer("empresa_id").references(EmpresasTable.id)
    val perfilId = integer("perfil_id").references(PerfisTable.id)
    val criadoEm = datetime("criado_em").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(usuarioId, empresaId)
    }
}

object GlobalAuditoriaTable : Table("log_auditoria") {
    val id = integer("id").autoIncrement()
    val usuario = varchar("usuario", 150)
    val funcao = varchar("funcao", 100).default("GERAL")
    val atividadeRealizada = text("atividade_realizada")
    val tabela = varchar("tabela", 100).nullable()
    val registroId = integer("registro_id").nullable()
    val ipOrigem = varchar("ip_origem", 45).nullable()
    val dataHora = datetime("data_hora").defaultExpression(CurrentDateTime)

    override val primaryKey = PrimaryKey(id)
}

// ==============================================================================
// DTOs & MODELOS DE DOMÍNIO
// ==============================================================================

data class EmpresaDTO(
    val id: Int,
    val tipo: String,
    val matrizId: Int?,
    val nomeFantasia: String,
    val razaoSocial: String?,
    val cnpj: String?,
    val schemaName: String,
    val bancoDados: String = "bd_controle",
    val ativo: Boolean,
    val limiteProdutos: Int? = null,
    val criadoEm: String? = null
)

data class EmpresaHierarquiaDTO(
    val id: Int,
    val tipo: String,
    val nomeFantasia: String,
    val razaoSocial: String?,
    val cnpj: String?,
    val schemaName: String,
    val bancoDados: String = "bd_controle",
    val ativo: Boolean,
    val filiais: List<EmpresaDTO> = emptyList(),
    val totalProdutos: Long = 0,
    val totalInsumos: Long = 0,
    val limiteProdutos: Int? = null
)

data class CriarEmpresaRequest(
    val nomeFantasia: String,
    val razaoSocial: String? = null,
    val cnpj: String? = null,
    val tipo: String = "MATRIZ", // 'MATRIZ' ou 'FILIAL'
    val matrizId: Int? = null,
    val schemaName: String? = null, // Se omitido, será gerado automaticamente (ex: matriz ou filial_shopping)
    val bancoDados: String? = null, // Se omitido, será gerado (ex: bd_controle)
    val adminNome: String? = null,
    val adminEmail: String? = null,
    val adminSenha: String? = null,
    val limiteProdutos: Int? = null
)

data class AtualizarEmpresaRequest(
    val nomeFantasia: String? = null,
    val razaoSocial: String? = null,
    val cnpj: String? = null,
    val ativo: Boolean? = null,
    val limiteProdutos: Int? = null
)

data class PerfilDTO(
    val id: Int,
    val codigo: String,
    val nome: String,
    val descricao: String?,
    val permissoes: String?
)

data class CriarPerfilRequest(
    val codigo: String,
    val nome: String,
    val descricao: String? = null,
    val permissoes: String? = null
)

data class AtualizarPerfilRequest(
    val nome: String? = null,
    val descricao: String? = null,
    val permissoes: String? = null
)

data class UsuarioEmpresaVinculoDTO(
    val id: Int,
    val empresaId: Int,
    val empresaNome: String,
    val empresaTipo: String,
    val schemaName: String,
    val perfilId: Int,
    val perfilCodigo: String,
    val perfilNome: String
)

data class UsuarioGlobalDTO(
    val id: Int,
    val nome: String,
    val email: String,
    val isSuperuser: Boolean,
    val ativo: Boolean,
    val criadoEm: String? = null,
    val fotoUrl: String? = null,
    val empresas: List<UsuarioEmpresaVinculoDTO> = emptyList()
)

data class GoogleAuthRequest(
    val credential: String = ""
)

data class GoogleTokenPayload(
    val email: String,
    val email_verified: String? = null,
    val name: String? = null,
    val picture: String? = null,
    val sub: String? = null,
    val aud: String? = null
)

data class CriarUsuarioRequest(
    val nome: String,
    val email: String,
    val senha: String,
    val isSuperuser: Boolean = false,
    val empresaId: Int? = null,
    val perfilId: Int? = null
)

data class AtualizarUsuarioRequest(
    val nome: String? = null,
    val email: String? = null,
    val senha: String? = null,
    val isSuperuser: Boolean? = null,
    val ativo: Boolean? = null,
    val empresaId: Int? = null,
    val perfilId: Int? = null
)

data class AtribuirEmpresaUsuarioRequest(
    val usuarioId: Int,
    val empresaId: Int,
    val perfilId: Int
)

data class DesvincularEmpresaUsuarioRequest(
    val usuarioId: Int,
    val empresaId: Int
)

data class LoginRequest(
    val email: String,
    val senha: String
)

data class TrocarSenhaRequest(
    val senhaAtual: String,
    val novaSenha: String
)

data class EsqueciSenhaRequest(
    val email: String
)

data class RedefinirSenhaRequest(
    val email: String,
    val token: String,
    val novaSenha: String
)

data class TestarEmailRequest(
    val emailDestino: String
)

data class LoginResponse(
    val token: String,
    val usuario: UsuarioGlobalDTO,
    val empresasHierarquia: List<EmpresaHierarquiaDTO>
)

data class LogAuditoriaGlobalDTO(
    val id: Int,
    val usuario: String,
    val funcao: String,
    val atividadeRealizada: String,
    val tabela: String?,
    val registroId: Int?,
    val ipOrigem: String?,
    val dataHora: String
)

object PasswordUtils {
    fun hash(raw: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(raw.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    fun verify(raw: String, hash: String): Boolean {
        return hash(raw).equals(hash, ignoreCase = true)
    }
}
