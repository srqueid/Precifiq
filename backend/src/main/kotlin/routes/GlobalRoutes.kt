package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.*
import org.example.services.TenantProvisioningService
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import java.util.UUID

fun Route.globalRoutes() {
    val provisioningService = TenantProvisioningService()

    route("/api/global") {

        // 1. Autenticação e Login Central
        post("/auth/login") {
            try {
                val req = call.receive<LoginRequest>()
                val user = transaction {
                    UsuariosTable.select { UsuariosTable.email eq req.email.trim() }
                        .singleOrNull()
                }

                if (user == null) {
                    call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Credenciais inválidas"))
                    return@post
                }

                val senhaCorreta = PasswordUtils.verify(req.senha, user[UsuariosTable.senhaHash]) ||
                        req.senha == user[UsuariosTable.senhaHash] // Suporte temporário a texto plano em dev

                if (!senhaCorreta) {
                    call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Credenciais inválidas"))
                    return@post
                }

                if (!user[UsuariosTable.ativo]) {
                    call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Usuário desativado"))
                    return@post
                }

                val userId = user[UsuariosTable.id]
                val isSuperuser = user[UsuariosTable.isSuperuser]

                // Buscar empresas do usuário e hierarquia
                val (vinculos, hierarquia) = transaction {
                    val vinculosRows = (UsuarioEmpresasTable innerJoin EmpresasTable innerJoin PerfisTable)
                        .select { UsuarioEmpresasTable.usuarioId eq userId }
                        .map { row ->
                            UsuarioEmpresaVinculoDTO(
                                id = row[UsuarioEmpresasTable.id],
                                empresaId = row[EmpresasTable.id],
                                empresaNome = row[EmpresasTable.nomeFantasia],
                                empresaTipo = row[EmpresasTable.tipo],
                                schemaName = row[EmpresasTable.schemaName],
                                perfilId = row[PerfisTable.id],
                                perfilCodigo = row[PerfisTable.codigo],
                                perfilNome = row[PerfisTable.nome]
                            )
                        }

                    val todasEmpresas = EmpresasTable.selectAll().map { row ->
                        EmpresaDTO(
                            id = row[EmpresasTable.id],
                            tipo = row[EmpresasTable.tipo],
                            matrizId = row[EmpresasTable.matrizId],
                            nomeFantasia = row[EmpresasTable.nomeFantasia],
                            razaoSocial = row[EmpresasTable.razaoSocial],
                            cnpj = row[EmpresasTable.cnpj],
                            schemaName = row[EmpresasTable.schemaName],
                            ativo = row[EmpresasTable.ativo],
                            criadoEm = row[EmpresasTable.criadoEm].toString()
                        )
                    }

                    // Se for superusuário, tem acesso a todas. Caso contrário, apenas às vinculadas.
                    val permitidas = if (isSuperuser) todasEmpresas else {
                        val idsPermitidos = vinculosRows.map { it.empresaId }.toSet()
                        todasEmpresas.filter { it.id in idsPermitidos }
                    }

                    val matrizes = permitidas.filter { it.tipo.equals("MATRIZ", ignoreCase = true) }
                    val filiais = permitidas.filter { it.tipo.equals("FILIAL", ignoreCase = true) }

                    val hierarquiaTree = matrizes.map { m ->
                        EmpresaHierarquiaDTO(
                            id = m.id,
                            tipo = m.tipo,
                            nomeFantasia = m.nomeFantasia,
                            razaoSocial = m.razaoSocial,
                            cnpj = m.cnpj,
                            schemaName = m.schemaName,
                            ativo = m.ativo,
                            filiais = filiais.filter { it.matrizId == m.id }
                        )
                    }

                    Pair(vinculosRows, hierarquiaTree)
                }

                val usuarioDTO = UsuarioGlobalDTO(
                    id = userId,
                    nome = user[UsuariosTable.nome],
                    email = user[UsuariosTable.email],
                    isSuperuser = isSuperuser,
                    ativo = user[UsuariosTable.ativo],
                    criadoEm = user[UsuariosTable.criadoEm].toString(),
                    empresas = vinculos
                )

                // Gera token de sessão opaco
                val token = "jwt_" + UUID.randomUUID().toString().replace("-", "")

                call.respond(
                    LoginResponse(
                        token = token,
                        usuario = usuarioDTO,
                        empresasHierarquia = hierarquia
                    )
                )
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro no login")))
            }
        }

        // 2. Listagem de Empresas (Hierarquia Matriz e Filiais)
        get("/empresas") {
            try {
                val hierarquia = transaction {
                    val todas = EmpresasTable.selectAll().map { row ->
                        EmpresaDTO(
                            id = row[EmpresasTable.id],
                            tipo = row[EmpresasTable.tipo],
                            matrizId = row[EmpresasTable.matrizId],
                            nomeFantasia = row[EmpresasTable.nomeFantasia],
                            razaoSocial = row[EmpresasTable.razaoSocial],
                            cnpj = row[EmpresasTable.cnpj],
                            schemaName = row[EmpresasTable.schemaName],
                            ativo = row[EmpresasTable.ativo],
                            criadoEm = row[EmpresasTable.criadoEm].toString()
                        )
                    }

                    val matrizes = todas.filter { it.tipo.equals("MATRIZ", ignoreCase = true) }
                    val filiais = todas.filter { it.tipo.equals("FILIAL", ignoreCase = true) }

                    matrizes.map { m ->
                        EmpresaHierarquiaDTO(
                            id = m.id,
                            tipo = m.tipo,
                            nomeFantasia = m.nomeFantasia,
                            razaoSocial = m.razaoSocial,
                            cnpj = m.cnpj,
                            schemaName = m.schemaName,
                            ativo = m.ativo,
                            filiais = filiais.filter { it.matrizId == m.id }
                        )
                    }
                }
                call.respond(hierarquia)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao buscar empresas")))
            }
        }

        // 3. Cadastro de Nova Empresa (Matriz ou Filial) com Provisionamento Automático
        post("/empresas") {
            try {
                val req = call.receive<CriarEmpresaRequest>()
                val tipo = req.tipo.uppercase()
                if (tipo !in listOf("MATRIZ", "FILIAL")) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Tipo deve ser 'MATRIZ' ou 'FILIAL'"))
                    return@post
                }

                if (tipo == "FILIAL" && req.matrizId == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Uma filial deve ter um matrizId associado"))
                    return@post
                }

                // Determina o schema da empresa
                val finalSchema = if (!req.schemaName.isNullOrBlank()) {
                    req.schemaName.trim().lowercase()
                } else {
                    TenantContext.generateTenantSchema(req.nomeFantasia)
                }

                if (!TenantContext.isValidSchema(finalSchema)) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Schema '$finalSchema' é inválido"))
                    return@post
                }

                // Inserir registro no catálogo central
                val empresaCriada = transaction {
                    val schemaExiste = EmpresasTable.select { EmpresasTable.schemaName eq finalSchema }.count() > 0
                    if (schemaExiste) {
                        throw IllegalArgumentException("Já existe uma empresa cadastrada com o schema '$finalSchema'")
                    }

                    val newId = EmpresasTable.insert {
                        it[nomeFantasia] = req.nomeFantasia.trim()
                        it[razaoSocial] = req.razaoSocial?.trim()
                        it[cnpj] = req.cnpj?.trim()
                        it[EmpresasTable.tipo] = tipo
                        it[matrizId] = if (tipo == "FILIAL") req.matrizId else null
                        it[schemaName] = finalSchema
                        it[ativo] = true
                    } get EmpresasTable.id

                    EmpresaDTO(
                        id = newId,
                        tipo = tipo,
                        matrizId = if (tipo == "FILIAL") req.matrizId else null,
                        nomeFantasia = req.nomeFantasia.trim(),
                        razaoSocial = req.razaoSocial?.trim(),
                        cnpj = req.cnpj?.trim(),
                        schemaName = finalSchema,
                        ativo = true
                    )
                }

                // Provisionar schema PostgreSQL isolado para a nova empresa
                provisioningService.provisionarTenant(finalSchema)

                call.respond(HttpStatusCode.Created, empresaCriada)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao criar empresa")))
            }
        }

        // 4. Listar Usuários Globais e seus Vínculos
        get("/usuarios") {
            try {
                val usuarios = transaction {
                    val todosUsuarios = UsuariosTable.selectAll().map { uRow ->
                        val uId = uRow[UsuariosTable.id]
                        val vinculos = (UsuarioEmpresasTable innerJoin EmpresasTable innerJoin PerfisTable)
                            .select { UsuarioEmpresasTable.usuarioId eq uId }
                            .map { row ->
                                UsuarioEmpresaVinculoDTO(
                                    id = row[UsuarioEmpresasTable.id],
                                    empresaId = row[EmpresasTable.id],
                                    empresaNome = row[EmpresasTable.nomeFantasia],
                                    empresaTipo = row[EmpresasTable.tipo],
                                    schemaName = row[EmpresasTable.schemaName],
                                    perfilId = row[PerfisTable.id],
                                    perfilCodigo = row[PerfisTable.codigo],
                                    perfilNome = row[PerfisTable.nome]
                                )
                            }

                        UsuarioGlobalDTO(
                            id = uId,
                            nome = uRow[UsuariosTable.nome],
                            email = uRow[UsuariosTable.email],
                            isSuperuser = uRow[UsuariosTable.isSuperuser],
                            ativo = uRow[UsuariosTable.ativo],
                            criadoEm = uRow[UsuariosTable.criadoEm].toString(),
                            empresas = vinculos
                        )
                    }
                    todosUsuarios
                }
                call.respond(usuarios)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao listar usuários")))
            }
        }

        // 5. Criar Novo Usuário Global
        post("/usuarios") {
            try {
                val req = call.receive<CriarUsuarioRequest>()
                if (req.nome.isBlank() || req.email.isBlank() || req.senha.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Nome, e-mail e senha são obrigatórios"))
                    return@post
                }

                val usuarioCriado = transaction {
                    val existe = UsuariosTable.select { UsuariosTable.email eq req.email.trim() }.count() > 0
                    if (existe) {
                        throw IllegalArgumentException("Já existe um usuário com o e-mail '${req.email}'")
                    }

                    val uId = UsuariosTable.insert {
                        it[nome] = req.nome.trim()
                        it[email] = req.email.trim().lowercase()
                        it[senhaHash] = PasswordUtils.hash(req.senha)
                        it[isSuperuser] = req.isSuperuser
                        it[ativo] = true
                    } get UsuariosTable.id

                    // Se vinculou diretamente a uma empresa com perfil
                    if (req.empresaId != null && req.perfilId != null) {
                        UsuarioEmpresasTable.insert {
                            it[usuarioId] = uId
                            it[empresaId] = req.empresaId
                            it[perfilId] = req.perfilId
                        }
                    }

                    UsuarioGlobalDTO(
                        id = uId,
                        nome = req.nome.trim(),
                        email = req.email.trim().lowercase(),
                        isSuperuser = req.isSuperuser,
                        ativo = true
                    )
                }

                call.respond(HttpStatusCode.Created, usuarioCriado)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao criar usuário")))
            }
        }

        // 6. Atribuir Vínculo Usuário x Empresa x Perfil
        post("/usuarios/atribuir-empresa") {
            try {
                val req = call.receive<AtribuirEmpresaUsuarioRequest>()
                transaction {
                    // Remove vínculo anterior se existir para essa mesma empresa
                    UsuarioEmpresasTable.deleteWhere {
                        (UsuarioEmpresasTable.usuarioId eq req.usuarioId) and (UsuarioEmpresasTable.empresaId eq req.empresaId)
                    }

                    UsuarioEmpresasTable.insert {
                        it[usuarioId] = req.usuarioId
                        it[empresaId] = req.empresaId
                        it[perfilId] = req.perfilId
                    }
                }
                call.respond(HttpStatusCode.OK, mapOf("message" to "Vínculo atribuído com sucesso"))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao atribuir empresa")))
            }
        }

        // 7. Desvincular Usuário de Empresa
        delete("/usuarios/desvincular-empresa") {
            try {
                val req = call.receive<DesvincularEmpresaUsuarioRequest>()
                transaction {
                    UsuarioEmpresasTable.deleteWhere {
                        (UsuarioEmpresasTable.usuarioId eq req.usuarioId) and (UsuarioEmpresasTable.empresaId eq req.empresaId)
                    }
                }
                call.respond(HttpStatusCode.OK, mapOf("message" to "Vínculo removido com sucesso"))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao desvincular empresa")))
            }
        }

        // 8. Listar Perfis de Acesso RBAC
        get("/perfis") {
            try {
                val perfis = transaction {
                    PerfisTable.selectAll().map { row ->
                        PerfilDTO(
                            id = row[PerfisTable.id],
                            codigo = row[PerfisTable.codigo],
                            nome = row[PerfisTable.nome],
                            descricao = row[PerfisTable.descricao],
                            permissoes = row[PerfisTable.permissoes]
                        )
                    }
                }
                call.respond(perfis)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao listar perfis")))
            }
        }
    }
}
