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
    val ativo = bool("ativo").default(true)
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
    val ativo: Boolean,
    val criadoEm: String? = null
)

data class EmpresaHierarquiaDTO(
    val id: Int,
    val tipo: String,
    val nomeFantasia: String,
    val razaoSocial: String?,
    val cnpj: String?,
    val schemaName: String,
    val ativo: Boolean,
    val filiais: List<EmpresaDTO> = emptyList(),
    val totalProdutos: Long = 0,
    val totalInsumos: Long = 0
)

data class CriarEmpresaRequest(
    val nomeFantasia: String,
    val razaoSocial: String? = null,
    val cnpj: String? = null,
    val tipo: String = "MATRIZ", // 'MATRIZ' ou 'FILIAL'
    val matrizId: Int? = null,
    val schemaName: String? = null // Se omitido, será gerado automaticamente
)

data class PerfilDTO(
    val id: Int,
    val codigo: String,
    val nome: String,
    val descricao: String?,
    val permissoes: String?
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
    val empresas: List<UsuarioEmpresaVinculoDTO> = emptyList()
)

data class CriarUsuarioRequest(
    val nome: String,
    val email: String,
    val senha: String,
    val isSuperuser: Boolean = false,
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

data class LoginResponse(
    val token: String,
    val usuario: UsuarioGlobalDTO,
    val empresasHierarquia: List<EmpresaHierarquiaDTO>
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
