package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.*
import org.example.services.TenantProvisioningService
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import com.google.gson.Gson
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.UUID

private fun registrarAuditoriaGlobal(
    usuario: String?,
    funcao: String,
    atividadeRealizada: String,
    tabela: String? = null,
    registroId: Int? = null,
    ipOrigem: String? = null
) {
    try {
        val userIdent = if (!usuario.isNullOrBlank()) usuario.trim() else "superusuario"
        val safeUser = userIdent.replace("'", "''")
        val safeFuncao = funcao.replace("'", "''")
        val safeAtiv = atividadeRealizada.replace("'", "''")
        val safeTabela = if (tabela != null) "'${tabela.replace("'", "''")}'" else "NULL"
        val safeRegId = registroId?.toString() ?: "NULL"
        val safeIp = if (ipOrigem != null) "'${ipOrigem.replace("'", "''")}'" else "NULL"

        transaction {
            exec("""
                INSERT INTO global.log_auditoria (usuario, funcao, atividade_realizada, tabela, registro_id, ip_origem, data_hora)
                VALUES ('$safeUser', '$safeFuncao', '$safeAtiv', $safeTabela, $safeRegId, $safeIp, CURRENT_TIMESTAMP)
            """.trimIndent())
        }
    } catch (e: Exception) {
        println("WARN: Falha ao registrar log de auditoria global: ${e.message}")
    }
}

private fun ApplicationCall.getCallerIp(): String {
    return request.headers["X-Forwarded-For"]?.split(",")?.firstOrNull()?.trim()
        ?: request.local.remoteHost
}

private fun ApplicationCall.checkSuperuser(): Pair<Boolean, String?> {
    val callerEmail = request.headers["X-User-Email"]?.trim()
    val isSuper = transaction {
        if (callerEmail.isNullOrBlank()) {
            true // Ambiente de desenvolvimento / requisições diretas
        } else {
            val u = UsuariosTable.select { UsuariosTable.email eq callerEmail }.firstOrNull()
            u?.get(UsuariosTable.isSuperuser) == true
        }
    }
    return Pair(isSuper, callerEmail)
}

private fun montarSessaoUsuario(user: ResultRow, ipOrigem: String?, metodoAuth: String = "SENHA"): LoginResponse {
    val userId = user[UsuariosTable.id]
    val isSuperuser = user[UsuariosTable.isSuperuser]
    val userEmail = user[UsuariosTable.email]

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
                bancoDados = row[EmpresasTable.bancoDados],
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
        email = userEmail,
        isSuperuser = isSuperuser,
        ativo = user[UsuariosTable.ativo],
        criadoEm = user[UsuariosTable.criadoEm].toString(),
        fotoUrl = user[UsuariosTable.fotoUrl],
        empresas = vinculos
    )

    // Gera token de sessão opaco
    val token = "jwt_" + UUID.randomUUID().toString().replace("-", "")

    // Registro no log de auditoria
    registrarAuditoriaGlobal(
        usuario = userEmail,
        funcao = if (isSuperuser) "SUPERUSER" else "AUTENTICACAO",
        atividadeRealizada = "Login realizado com sucesso no sistema (Método: $metodoAuth)",
        tabela = "usuario",
        registroId = userId,
        ipOrigem = ipOrigem
    )

    return LoginResponse(
        token = token,
        usuario = usuarioDTO,
        empresasHierarquia = hierarquia
    )
}

private fun verificarTokenGoogle(idToken: String): GoogleTokenPayload? {
    try {
        // Suporte a token de demonstração / testes locais
        if (idToken.startsWith("demo_google_token") || idToken.startsWith("mock_google_token")) {
            val emailParam = if (idToken.contains(":")) idToken.substringAfter(":") else "admin@dcsys.com"
            val nomeParam = if (emailParam.contains("@")) {
                emailParam.substringBefore("@")
                    .replace(".", " ")
                    .split(" ")
                    .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
            } else "Usuário Google"
            return GoogleTokenPayload(
                email = emailParam,
                email_verified = "true",
                name = nomeParam,
                picture = "https://lh3.googleusercontent.com/a/default-user",
                sub = "demo_google_sub_12345"
            )
        }

        val client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build()
        val encodedToken = URLEncoder.encode(idToken, StandardCharsets.UTF_8)
        val uri = URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=$encodedToken")
        val req = HttpRequest.newBuilder()
            .uri(uri)
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build()
        val resp = client.send(req, HttpResponse.BodyHandlers.ofString())
        if (resp.statusCode() != 200) {
            println("WARN: Tokeninfo do Google retornou HTTP ${resp.statusCode()}: ${resp.body()}")
            return null
        }
        val gson = Gson()
        val payload = gson.fromJson(resp.body(), GoogleTokenPayload::class.java)

        if (payload?.email.isNullOrBlank()) {
            return null
        }

        val isVerified = payload.email_verified.equals("true", ignoreCase = true)
        if (!isVerified) {
            println("WARN: Google email_verified é falso para ${payload.email}")
            return null
        }

        val expectedClientId = org.example.DatabaseConfig.env("GOOGLE_CLIENT_ID")
            ?: System.getenv("GOOGLE_CLIENT_ID")
            ?: System.getProperty("GOOGLE_CLIENT_ID")
        if (!expectedClientId.isNullOrBlank() && !payload.aud.isNullOrBlank() && payload.aud != expectedClientId) {
            println("WARN: Client ID mismatch no token Google. Esperado: $expectedClientId, recebido: ${payload.aud}")
            return null
        }

        return payload
    } catch (e: Exception) {
        println("ERRO ao validar token do Google: ${e.message}")
        return null
    }
}

fun Route.globalRoutes() {
    val provisioningService = TenantProvisioningService()

    route("/api/global") {

        // 1. Autenticação Tradicional (E-mail e Senha)
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

                val sessao = montarSessaoUsuario(
                    user = user,
                    ipOrigem = call.getCallerIp(),
                    metodoAuth = "CREDENCIAIS"
                )

                call.respond(sessao)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro no login")))
            }
        }

        // 1.1 Autenticação Google OAuth 2.0 (Google Identity Services)
        post("/auth/google") {
            try {
                val rawText = call.receiveText()
                val credential = try {
                    val gson = Gson()
                    val map = gson.fromJson(rawText, Map::class.java)
                    map?.get("credential")?.toString() ?: ""
                } catch (_: Exception) {
                    ""
                }

                if (credential.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Credencial do Google não informada"))
                    return@post
                }

                val googleUser = verificarTokenGoogle(credential.trim())
                if (googleUser == null) {
                    call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Credencial do Google inválida ou expirada"))
                    return@post
                }

                val targetEmail = googleUser.email.trim().lowercase()
                val user = transaction {
                    UsuariosTable.select { UsuariosTable.email eq targetEmail }.firstOrNull()
                }

                val userId: Int

                if (user != null) {
                    if (!user[UsuariosTable.ativo]) {
                        call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Usuário desativado no sistema"))
                        return@post
                    }
                    userId = user[UsuariosTable.id]

                    // Atualiza foto e google_id se informados
                    transaction {
                        UsuariosTable.update({ UsuariosTable.id eq userId }) {
                            if (!googleUser.picture.isNullOrBlank()) {
                                it[UsuariosTable.fotoUrl] = googleUser.picture
                            }
                            if (!googleUser.sub.isNullOrBlank()) {
                                it[UsuariosTable.googleId] = googleUser.sub
                            }
                        }
                    }
                } else {
                    // Auto-provisionamento de usuário registrado via Google
                    val createdUserId = transaction {
                        val totalUsuarios = UsuariosTable.selectAll().count()
                        val shouldBeSuper = (totalUsuarios == 0L)
                        val nomeFinal = googleUser.name?.trim()?.ifBlank { null }
                            ?: targetEmail.substringBefore("@")
                                .replace(".", " ")
                                .split(" ")
                                .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

                        val uId = UsuariosTable.insert {
                            it[UsuariosTable.nome] = nomeFinal
                            it[UsuariosTable.email] = targetEmail
                            it[UsuariosTable.senhaHash] = PasswordUtils.hash(UUID.randomUUID().toString())
                            it[UsuariosTable.isSuperuser] = shouldBeSuper
                            it[UsuariosTable.ativo] = true
                            it[UsuariosTable.fotoUrl] = googleUser.picture
                            it[UsuariosTable.googleId] = googleUser.sub
                        } get UsuariosTable.id

                        // Vincula à primeira Matriz se existir
                        val primeiraMatriz = EmpresasTable.select { EmpresasTable.tipo eq "MATRIZ" }.firstOrNull()
                            ?: EmpresasTable.selectAll().firstOrNull()

                        if (primeiraMatriz != null) {
                            val defaultPerfil = if (shouldBeSuper) 1 else 4 // 1=ADMIN, 4=OPERADOR
                            UsuarioEmpresasTable.insert {
                                it[usuarioId] = uId
                                it[empresaId] = primeiraMatriz[EmpresasTable.id]
                                it[perfilId] = defaultPerfil
                            }
                        }

                        uId
                    }
                    userId = createdUserId
                }

                val finalUserRow = transaction {
                    UsuariosTable.select { UsuariosTable.id eq userId }.first()
                }

                val sessao = montarSessaoUsuario(
                    user = finalUserRow,
                    ipOrigem = call.getCallerIp(),
                    metodoAuth = "GOOGLE_OAUTH"
                )

                call.respond(sessao)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao autenticar com Google")))
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
                            bancoDados = row[EmpresasTable.bancoDados],
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
                            bancoDados = m.bancoDados,
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

        // 3. Cadastro de Nova Empresa (Matriz ou Filial) com Provisionamento de Banco de Dados Isolado
        // Acesso exclusivo do Superusuário (DcSys)
        post("/empresas") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
                if (!isSuper) {
                    call.respond(
                        HttpStatusCode.Forbidden,
                        mapOf("error" to "Acesso restrito: Apenas o Superusuário (DcSys) possui acesso técnico e de infraestrutura para criar novas empresas e provisionar novos bancos de dados.")
                    )
                    return@post
                }

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

                // Determina o schema da empresa (matriz ou filial_<slug>)
                val finalSchema = if (!req.schemaName.isNullOrBlank()) {
                    req.schemaName.trim().lowercase()
                } else {
                    TenantContext.generateTenantSchema(req.nomeFantasia, tipo)
                }

                // Determina o banco de dados da empresa (ex.: bd_controle)
                val finalBancoDados = if (!req.bancoDados.isNullOrBlank()) {
                    req.bancoDados.trim().lowercase()
                } else if (tipo == "FILIAL") {
                    val matrizBanco = transaction {
                        EmpresasTable.select { EmpresasTable.id eq req.matrizId!! }.firstOrNull()?.get(EmpresasTable.bancoDados)
                    }
                    matrizBanco ?: "bd_controle"
                } else {
                    TenantContext.generateDatabaseName(req.nomeFantasia)
                }

                if (!TenantContext.isValidSchema(finalSchema)) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Identificador de banco/schema '$finalSchema' é inválido."))
                    return@post
                }

                // Inserir registro no catálogo central e vincular Superusuário e Admin
                val empresaCriada = transaction {
                    val schemaExiste = EmpresasTable.select { EmpresasTable.schemaName eq finalSchema }.count() > 0
                    if (schemaExiste) {
                        throw IllegalArgumentException("Já existe uma empresa cadastrada com o schema '$finalSchema'")
                    }

                    val newId = EmpresasTable.insert {
                        it[nomeFantasia] = req.nomeFantasia.trim()
                        it[razaoSocial] = req.razaoSocial?.trim()
                        it[cnpj] = req.cnpj?.replace(Regex("\\D"), "")?.takeIf { it.isNotBlank() }
                        it[EmpresasTable.tipo] = tipo
                        it[matrizId] = if (tipo == "FILIAL") req.matrizId else null
                        it[schemaName] = finalSchema
                        it[bancoDados] = finalBancoDados
                        it[ativo] = true
                    } get EmpresasTable.id

                    // 1. Vincula automaticamente o Superusuário DcSys à nova empresa com perfil ADMIN (id 1)
                    val superusers = UsuariosTable.select { UsuariosTable.isSuperuser eq true }.map { it[UsuariosTable.id] }
                    for (suId in superusers) {
                        val vinculoJaExiste = UsuarioEmpresasTable.select {
                            (UsuarioEmpresasTable.usuarioId eq suId) and (UsuarioEmpresasTable.empresaId eq newId)
                        }.count() > 0

                        if (!vinculoJaExiste) {
                            UsuarioEmpresasTable.insert {
                                it[usuarioId] = suId
                                it[empresaId] = newId
                                it[perfilId] = 1 // ADMIN geral da plataforma
                            }
                        }
                    }

                    // 2. Se fornecido administrador inicial da empresa, cria o usuário e vincula
                    if (!req.adminEmail.isNullOrBlank()) {
                        val targetAdminEmail = req.adminEmail.trim().lowercase()
                        val existingUser = UsuariosTable.select { UsuariosTable.email eq targetAdminEmail }.firstOrNull()
                        val adminUserId = if (existingUser != null) {
                            existingUser[UsuariosTable.id]
                        } else {
                            val senhaPlana = if (!req.adminSenha.isNullOrBlank()) req.adminSenha.trim() else "123456"
                            UsuariosTable.insert {
                                it[UsuariosTable.nome] = if (!req.adminNome.isNullOrBlank()) req.adminNome.trim() else "Administrador ${req.nomeFantasia.trim()}"
                                it[UsuariosTable.email] = targetAdminEmail
                                it[UsuariosTable.senhaHash] = PasswordUtils.hash(senhaPlana)
                                it[UsuariosTable.isSuperuser] = false
                                it[UsuariosTable.ativo] = true
                            } get UsuariosTable.id
                        }

                        val perfilEmpresa = if (tipo == "MATRIZ") 2 else 3 // ADMIN_MATRIZ ou GERENTE_FILIAL
                        val adminVinculoExiste = UsuarioEmpresasTable.select {
                            (UsuarioEmpresasTable.usuarioId eq adminUserId) and (UsuarioEmpresasTable.empresaId eq newId)
                        }.count() > 0

                        if (!adminVinculoExiste) {
                            UsuarioEmpresasTable.insert {
                                it[usuarioId] = adminUserId
                                it[empresaId] = newId
                                it[perfilId] = perfilEmpresa
                            }
                        }
                    }

                    EmpresaDTO(
                        id = newId,
                        tipo = tipo,
                        matrizId = if (tipo == "FILIAL") req.matrizId else null,
                        nomeFantasia = req.nomeFantasia.trim(),
                        razaoSocial = req.razaoSocial?.trim(),
                        cnpj = req.cnpj?.replace(Regex("\\D"), "")?.takeIf { it.isNotBlank() },
                        schemaName = finalSchema,
                        ativo = true
                    )
                }

                // Provisionar banco de dados / schema PostgreSQL isolado com DDL completo e carga inicial
                provisioningService.provisionarTenant(finalSchema)

                // Registro no log de auditoria
                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = "SUPERUSER",
                    atividadeRealizada = "Criada $tipo '${empresaCriada.nomeFantasia}' (schema: '$finalSchema') com provisionamento de banco",
                    tabela = "empresa",
                    registroId = empresaCriada.id,
                    ipOrigem = call.getCallerIp()
                )

                call.respond(HttpStatusCode.Created, empresaCriada)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao criar empresa")))
            }
        }

        // 3.1 Status de Saúde do Banco de Dados da Empresa (Exclusivo Superusuário DcSys)
        get("/empresas/{id}/banco-status") {
            try {
                val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("ID inválido")
                val empresa = transaction {
                    EmpresasTable.select { EmpresasTable.id eq id }.firstOrNull()
                } ?: throw IllegalArgumentException("Empresa não encontrada")

                val schema = empresa[EmpresasTable.schemaName]

                val status = transaction {
                    var schemaExists = false
                    exec("SELECT 1 FROM information_schema.schemata WHERE schema_name = '$schema'") { rs ->
                        schemaExists = rs.next()
                    }

                    if (!schemaExists) {
                        mapOf(
                            "schemaName" to schema,
                            "exists" to false,
                            "status" to "NAO_PROVISIONADO",
                            "tabelasCount" to 0,
                            "totalInsumos" to 0L,
                            "totalProdutos" to 0L
                        )
                    } else {
                        var countTabelas = 0
                        exec("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$schema'") { rs ->
                            if (rs.next()) countTabelas = rs.getInt(1)
                        }

                        var totalInsumos = 0L
                        var totalProdutos = 0L
                        try {
                            exec("SELECT COUNT(*) FROM \"$schema\".insumo") { rs -> if (rs.next()) totalInsumos = rs.getLong(1) }
                            exec("SELECT COUNT(*) FROM \"$schema\".produto_final") { rs -> if (rs.next()) totalProdutos = rs.getLong(1) }
                        } catch (_: Exception) {}

                        mapOf(
                            "schemaName" to schema,
                            "exists" to true,
                            "status" to "ATIVO",
                            "tabelasCount" to countTabelas,
                            "totalInsumos" to totalInsumos,
                            "totalProdutos" to totalProdutos
                        )
                    }
                }
                call.respond(status)
            } catch (e: Exception) {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao verificar banco")))
            }
        }

        // 3.2 Reprovisionar Banco de Dados da Empresa (Exclusivo Superusuário DcSys)
        post("/empresas/{id}/reprovisionar") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
                if (!isSuper) {
                    call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Acesso restrito: Apenas o Superusuário (DcSys) pode reprovisionar bancos de dados."))
                    return@post
                }

                val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("ID inválido")
                val schema = transaction {
                    EmpresasTable.select { EmpresasTable.id eq id }.firstOrNull()?.get(EmpresasTable.schemaName)
                } ?: throw IllegalArgumentException("Empresa não encontrada")

                provisioningService.provisionarTenant(schema)

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = "SUPERUSER",
                    atividadeRealizada = "Reprovisionado banco/schema '$schema' da empresa ID $id",
                    tabela = "empresa",
                    registroId = id,
                    ipOrigem = call.getCallerIp()
                )

                call.respond(HttpStatusCode.OK, mapOf("message" to "Banco de dados/schema '$schema' reprovisionado com sucesso!"))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao reprovisionar")))
            }
        }

        // 3.3 Exclusão de Empresa ou Filial (Exclusivo Superusuário DcSys)
        delete("/empresas/{id}") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
                if (!isSuper) {
                    call.respond(
                        HttpStatusCode.Forbidden,
                        mapOf("error" to "Acesso restrito: Apenas o Superusuário (DcSys) possui permissão para excluir empresas e filiais.")
                    )
                    return@delete
                }

                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID de empresa inválido"))
                    return@delete
                }

                val empresa = transaction {
                    EmpresasTable.select { EmpresasTable.id eq id }.firstOrNull()
                }

                if (empresa == null) {
                    call.respond(HttpStatusCode.NotFound, mapOf("error" to "Empresa não encontrada"))
                    return@delete
                }

                val tipo = empresa[EmpresasTable.tipo]
                val nome = empresa[EmpresasTable.nomeFantasia]
                val schema = empresa[EmpresasTable.schemaName]
                val ip = call.getCallerIp()

                if (tipo.equals("MATRIZ", ignoreCase = true)) {
                    val filiais = transaction {
                        EmpresasTable.select { EmpresasTable.matrizId eq id }.map { row ->
                            Triple(row[EmpresasTable.id], row[EmpresasTable.nomeFantasia], row[EmpresasTable.schemaName])
                        }
                    }

                    for ((fId, fNome, fSchema) in filiais) {
                        transaction {
                            UsuarioEmpresasTable.deleteWhere { UsuarioEmpresasTable.empresaId eq fId }
                            EmpresasTable.deleteWhere { EmpresasTable.id eq fId }
                            try {
                                exec("DROP SCHEMA IF EXISTS \"$fSchema\" CASCADE;")
                            } catch (_: Exception) {}
                        }
                        registrarAuditoriaGlobal(
                            usuario = callerEmail,
                            funcao = "SUPERUSER",
                            atividadeRealizada = "Excluída Filial '$fNome' (schema: $fSchema) em cascata com a Matriz ID $id",
                            tabela = "empresa",
                            registroId = fId,
                            ipOrigem = ip
                        )
                    }

                    transaction {
                        UsuarioEmpresasTable.deleteWhere { UsuarioEmpresasTable.empresaId eq id }
                        EmpresasTable.deleteWhere { EmpresasTable.id eq id }
                        try {
                            exec("DROP SCHEMA IF EXISTS \"$schema\" CASCADE;")
                        } catch (_: Exception) {}
                    }

                    registrarAuditoriaGlobal(
                        usuario = callerEmail,
                        funcao = "SUPERUSER",
                        atividadeRealizada = "Excluída Matriz '$nome' (schema: $schema) e todas as suas filiais vinculadas",
                        tabela = "empresa",
                        registroId = id,
                        ipOrigem = ip
                    )

                    call.respond(
                        HttpStatusCode.OK,
                        mapOf("message" to "Matriz '$nome' e suas filiais vinculadas foram excluídas com sucesso.")
                    )
                } else {
                    transaction {
                        UsuarioEmpresasTable.deleteWhere { UsuarioEmpresasTable.empresaId eq id }
                        EmpresasTable.deleteWhere { EmpresasTable.id eq id }
                        try {
                            exec("DROP SCHEMA IF EXISTS \"$schema\" CASCADE;")
                        } catch (_: Exception) {}
                    }

                    registrarAuditoriaGlobal(
                        usuario = callerEmail,
                        funcao = "SUPERUSER",
                        atividadeRealizada = "Excluída Filial '$nome' (schema: $schema)",
                        tabela = "empresa",
                        registroId = id,
                        ipOrigem = ip
                    )

                    call.respond(
                        HttpStatusCode.OK,
                        mapOf("message" to "Filial '$nome' foi excluída com sucesso.")
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao excluir empresa/filial")))
            }
        }

        // 3.4 Execução Automatizada de Migration no Banco de Dados (Exclusivo Superusuário DcSys)
        post("/migration/executar") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
                if (!isSuper) {
                    call.respond(
                        HttpStatusCode.Forbidden,
                        mapOf("error" to "Acesso restrito: Apenas o Superusuário (DcSys) possui permissão para executar migrations no banco de dados.")
                    )
                    return@post
                }

                val resultados = provisioningService.executarMigrationTodosTenants()

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = "SUPERUSER",
                    atividadeRealizada = "Executado deploy de migration em massa para todos os schemas do banco (${resultados.size} schemas processados)",
                    tabela = "empresa",
                    ipOrigem = call.getCallerIp()
                )

                call.respond(
                    HttpStatusCode.OK,
                    mapOf(
                        "message" to "Deploy de migration executado com sucesso.",
                        "totalSchemasProcessados" to resultados.size,
                        "detalhes" to resultados
                    )
                )
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(
                    HttpStatusCode.InternalServerError,
                    mapOf("error" to (e.message ?: "Erro ao executar migration nos bancos de dados"))
                )
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
                            fotoUrl = uRow[UsuariosTable.fotoUrl],
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
                val (isSuper, callerEmail) = call.checkSuperuser()
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

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = if (isSuper) "SUPERUSER" else "ADMINISTRACAO",
                    atividadeRealizada = "Criado usuário '${usuarioCriado.email}' (isSuperuser=${usuarioCriado.isSuperuser})",
                    tabela = "usuario",
                    registroId = usuarioCriado.id,
                    ipOrigem = call.getCallerIp()
                )

                call.respond(HttpStatusCode.Created, usuarioCriado)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao criar usuário")))
            }
        }

        // 6. Atribuir Vínculo Usuário x Empresa x Perfil
        post("/usuarios/atribuir-empresa") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
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

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = if (isSuper) "SUPERUSER" else "ADMINISTRACAO",
                    atividadeRealizada = "Atribuída Empresa ID ${req.empresaId} com Perfil ID ${req.perfilId} ao Usuário ID ${req.usuarioId}",
                    tabela = "usuario_empresa",
                    registroId = req.usuarioId,
                    ipOrigem = call.getCallerIp()
                )

                call.respond(HttpStatusCode.OK, mapOf("message" to "Vínculo atribuído com sucesso"))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao atribuir empresa")))
            }
        }

        // 7. Desvincular Usuário de Empresa
        delete("/usuarios/desvincular-empresa") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
                val req = call.receive<DesvincularEmpresaUsuarioRequest>()
                transaction {
                    UsuarioEmpresasTable.deleteWhere {
                        (UsuarioEmpresasTable.usuarioId eq req.usuarioId) and (UsuarioEmpresasTable.empresaId eq req.empresaId)
                    }
                }

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = if (isSuper) "SUPERUSER" else "ADMINISTRACAO",
                    atividadeRealizada = "Desvinculada Empresa ID ${req.empresaId} do Usuário ID ${req.usuarioId}",
                    tabela = "usuario_empresa",
                    registroId = req.usuarioId,
                    ipOrigem = call.getCallerIp()
                )

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
                    PerfisTable.selectAll().orderBy(PerfisTable.id to SortOrder.ASC).map { row ->
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

        // 9. Criar Perfil de Acesso Customizado (Superusuário DcSys)
        post("/perfis") {
            try {
                val (isCallerSuperuser, callerEmail) = call.checkSuperuser()
                if (!isCallerSuperuser) {
                    call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Acesso restrito: Apenas o Superusuário DcSys pode criar novos perfis de acesso."))
                    return@post
                }

                val req = call.receive<CriarPerfilRequest>()
                val codSanitizado = req.codigo.trim().uppercase().replace(" ", "_")
                if (codSanitizado.isBlank() || req.nome.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Código e Nome do perfil são obrigatórios"))
                    return@post
                }

                val perfilCriado = transaction {
                    val existe = PerfisTable.select { PerfisTable.codigo eq codSanitizado }.count() > 0
                    if (existe) {
                        throw IllegalArgumentException("Já existe um perfil com o código '$codSanitizado'")
                    }

                    val newId = PerfisTable.insert {
                        it[codigo] = codSanitizado
                        it[nome] = req.nome.trim()
                        it[descricao] = req.descricao?.trim()
                        it[permissoes] = req.permissoes?.trim()
                    } get PerfisTable.id

                    PerfilDTO(
                        id = newId,
                        codigo = codSanitizado,
                        nome = req.nome.trim(),
                        descricao = req.descricao?.trim(),
                        permissoes = req.permissoes?.trim()
                    )
                }

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = "SUPERUSER",
                    atividadeRealizada = "Criado novo perfil de acesso RBAC '${perfilCriado.codigo}' (${perfilCriado.nome})",
                    tabela = "perfil",
                    registroId = perfilCriado.id,
                    ipOrigem = call.getCallerIp()
                )

                call.respond(HttpStatusCode.Created, perfilCriado)
            } catch (e: IllegalArgumentException) {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao criar perfil")))
            }
        }

        // 10. Atualizar Perfil de Acesso (Superusuário DcSys)
        put("/perfis/{id}") {
            try {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID do perfil inválido"))
                    return@put
                }

                val (isCallerSuperuser, callerEmail) = call.checkSuperuser()
                if (!isCallerSuperuser) {
                    call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Acesso restrito: Apenas o Superusuário DcSys pode editar perfis de acesso."))
                    return@put
                }

                val req = call.receive<AtualizarPerfilRequest>()
                val perfilAtualizado = transaction {
                    PerfisTable.update({ PerfisTable.id eq id }) {
                        if (req.nome != null) it[nome] = req.nome.trim()
                        if (req.descricao != null) it[descricao] = req.descricao.trim()
                        if (req.permissoes != null) it[permissoes] = req.permissoes.trim()
                    }

                    PerfisTable.select { PerfisTable.id eq id }.singleOrNull()?.let { row ->
                        PerfilDTO(
                            id = row[PerfisTable.id],
                            codigo = row[PerfisTable.codigo],
                            nome = row[PerfisTable.nome],
                            descricao = row[PerfisTable.descricao],
                            permissoes = row[PerfisTable.permissoes]
                        )
                    }
                }

                if (perfilAtualizado == null) {
                    call.respond(HttpStatusCode.NotFound, mapOf("error" to "Perfil não encontrado"))
                } else {
                    registrarAuditoriaGlobal(
                        usuario = callerEmail,
                        funcao = "SUPERUSER",
                        atividadeRealizada = "Atualizado perfil de acesso ID $id (${perfilAtualizado.codigo})",
                        tabela = "perfil",
                        registroId = id,
                        ipOrigem = call.getCallerIp()
                    )
                    call.respond(perfilAtualizado)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao atualizar perfil")))
            }
        }

        // 11. Excluir Perfil de Acesso (Superusuário DcSys)
        delete("/perfis/{id}") {
            try {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID do perfil inválido"))
                    return@delete
                }

                // Proteção para não excluir perfis vitais do sistema
                if (id in listOf(1, 2, 3, 4)) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Perfis padrão do sistema (ADMIN, ADMIN_MATRIZ, GERENTE_FILIAL, OPERADOR) são protegidos e não podem ser excluídos."))
                    return@delete
                }

                val (isCallerSuperuser, callerEmail) = call.checkSuperuser()
                if (!isCallerSuperuser) {
                    call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Acesso restrito ao Superusuário DcSys"))
                    return@delete
                }

                val deletado = transaction {
                    val vinculos = UsuarioEmpresasTable.select { UsuarioEmpresasTable.perfilId eq id }.count()
                    if (vinculos > 0) {
                        throw IllegalArgumentException("Não é possível excluir o perfil pois existem $vinculos colaborador(es) vinculado(s) a ele.")
                    }
                    PerfisTable.deleteWhere { PerfisTable.id eq id } > 0
                }

                if (deletado) {
                    registrarAuditoriaGlobal(
                        usuario = callerEmail,
                        funcao = "SUPERUSER",
                        atividadeRealizada = "Excluído perfil de acesso ID $id",
                        tabela = "perfil",
                        registroId = id,
                        ipOrigem = call.getCallerIp()
                    )
                    call.respond(HttpStatusCode.OK, mapOf("message" to "Perfil excluído com sucesso"))
                } else {
                    call.respond(HttpStatusCode.NotFound, mapOf("error" to "Perfil não encontrado"))
                }
            } catch (e: IllegalArgumentException) {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao excluir perfil")))
            }
        }

        // 12. Consultar Log de Auditoria Central da Plataforma (Exclusivo Superusuário DcSys)
        get("/auditoria") {
            try {
                val (isSuper, _) = call.checkSuperuser()
                if (!isSuper) {
                    call.respond(
                        HttpStatusCode.Forbidden,
                        mapOf("error" to "Acesso negado: Os dados de auditoria são confidenciais e estão disponíveis exclusivamente para o Superusuário.")
                    )
                    return@get
                }

                val logs = transaction {
                    val list = mutableListOf<LogAuditoriaGlobalDTO>()
                    exec("SELECT id, usuario, funcao, atividade_realizada, tabela, registro_id, ip_origem, data_hora FROM global.log_auditoria ORDER BY id DESC LIMIT 300") { rs ->
                        while (rs.next()) {
                            list.add(
                                LogAuditoriaGlobalDTO(
                                    id = rs.getInt("id"),
                                    usuario = rs.getString("usuario"),
                                    funcao = rs.getString("funcao"),
                                    atividadeRealizada = rs.getString("atividade_realizada"),
                                    tabela = rs.getString("tabela"),
                                    registroId = rs.getObject("registro_id") as? Int,
                                    ipOrigem = rs.getString("ip_origem"),
                                    dataHora = rs.getTimestamp("data_hora").toString()
                                )
                            )
                        }
                    }
                    list
                }
                call.respond(logs)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao buscar logs de auditoria")))
            }
        }
    }
}
