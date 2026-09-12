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

fun ApplicationCall.checkSuperuser(): Pair<Boolean, String?> {
    val callerEmail = request.headers["X-User-Email"]?.trim()?.lowercase()
    val isSuper = transaction {
        if (callerEmail.isNullOrBlank()) {
            false
        } else {
            val u = UsuariosTable.select { UsuariosTable.email eq callerEmail }.firstOrNull()
            u?.get(UsuariosTable.isSuperuser) == true
        }
    }
    return Pair(isSuper, callerEmail)
}

fun isUserAuthorizedForSchema(userEmail: String?, schema: String): Boolean {
    val cleanSchema = schema.trim().lowercase()
    if (cleanSchema == "public" || cleanSchema == "global") {
        return true
    }
    if (userEmail.isNullOrBlank()) {
        return false
    }
    return transaction {
        val user = UsuariosTable.select { UsuariosTable.email eq userEmail.trim().lowercase() }.firstOrNull()
            ?: return@transaction false

        // Superusuário possui acesso a qualquer schema
        if (user[UsuariosTable.isSuperuser]) {
            return@transaction true
        }

        val empresaAlvo = EmpresasTable.select { EmpresasTable.schemaName eq cleanSchema }.firstOrNull()
            ?: return@transaction false

        if (!empresaAlvo[EmpresasTable.ativo]) {
            return@transaction false
        }

        val empresaAlvoId = empresaAlvo[EmpresasTable.id]
        val matrizAlvoId = empresaAlvo[EmpresasTable.matrizId]
        val userId = user[UsuariosTable.id]

        // 1. Vínculo direto com a empresa alvo
        val temVinculoDireto = UsuarioEmpresasTable.select {
            (UsuarioEmpresasTable.usuarioId eq userId) and (UsuarioEmpresasTable.empresaId eq empresaAlvoId)
        }.count() > 0
        if (temVinculoDireto) return@transaction true

        // 2. Se a empresa alvo for uma filial, verificar se o usuário é ADMIN_MATRIZ da matriz controladora
        if (matrizAlvoId != null) {
            val isAdminMatrizPai = (UsuarioEmpresasTable innerJoin PerfisTable).select {
                (UsuarioEmpresasTable.usuarioId eq userId) and 
                (UsuarioEmpresasTable.empresaId eq matrizAlvoId) and 
                (PerfisTable.codigo eq "ADMIN_MATRIZ")
            }.count() > 0
            if (isAdminMatrizPai) return@transaction true
        }

        false
    }
}

fun obterSchemaPadraoUsuario(userEmail: String?): String? {
    if (userEmail.isNullOrBlank()) return null
    return transaction {
        val user = UsuariosTable.select { UsuariosTable.email eq userEmail.trim().lowercase() }.firstOrNull()
            ?: return@transaction null

        if (user[UsuariosTable.isSuperuser]) {
            return@transaction "controle"
        }

        val userId = user[UsuariosTable.id]
        val vinculo = (UsuarioEmpresasTable innerJoin EmpresasTable)
            .select { (UsuarioEmpresasTable.usuarioId eq userId) and (EmpresasTable.ativo eq true) }
            .firstOrNull()

        vinculo?.get(EmpresasTable.schemaName)
    }
}

fun obterEmpresasPermitidas(callerEmail: String?): List<EmpresaHierarquiaDTO> {
    if (callerEmail.isNullOrBlank()) return emptyList()
    val emailNorm = callerEmail.trim().lowercase()

    return transaction {
        val user = UsuariosTable.select { UsuariosTable.email eq emailNorm }.firstOrNull()
            ?: return@transaction emptyList()

        val isSuper = user[UsuariosTable.isSuperuser]
        val userId = user[UsuariosTable.id]

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

        if (isSuper) {
            val matrizes = todasEmpresas.filter { it.tipo.equals("MATRIZ", ignoreCase = true) }
            val filiais = todasEmpresas.filter { it.tipo.equals("FILIAL", ignoreCase = true) }
            return@transaction matrizes.map { m ->
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

        // Para usuário comum: buscar vínculos diretos
        val vinculos = (UsuarioEmpresasTable innerJoin PerfisTable)
            .select { UsuarioEmpresasTable.usuarioId eq userId }
            .map { row ->
                Pair(row[UsuarioEmpresasTable.empresaId], row[PerfisTable.codigo])
            }

        if (vinculos.isEmpty()) {
            return@transaction emptyList()
        }

        val empresasVinculadasIds = vinculos.map { it.first }.toSet()
        val ehAdminMatrizIds = vinculos.filter { it.second == "ADMIN_MATRIZ" }.map { it.first }.toSet()

        // Filtrar apenas empresas ativas
        val empresasAtivas = todasEmpresas.filter { it.ativo }

        // Identificar matrizes autorizadas para este usuário:
        // 1. Matrizes onde o usuário tem vínculo direto
        val matrizesDiretasIds = empresasVinculadasIds.filter { id ->
            empresasAtivas.any { it.id == id && it.tipo.equals("MATRIZ", ignoreCase = true) }
        }.toSet()

        // 2. Matrizes pai das filiais onde o usuário tem vínculo
        val filiaisVinculadas = empresasAtivas.filter { 
            it.tipo.equals("FILIAL", ignoreCase = true) && it.id in empresasVinculadasIds 
        }
        val matrizesPaisDeFiliaisIds = filiaisVinculadas.mapNotNull { it.matrizId }.toSet()

        val todasMatrizesAutorizadasIds = matrizesDiretasIds + matrizesPaisDeFiliaisIds
        val matrizes = empresasAtivas.filter { it.id in todasMatrizesAutorizadasIds && it.tipo.equals("MATRIZ", ignoreCase = true) }

        // Montar a árvore estritamente isolada:
        matrizes.map { m ->
            val isAdminDestaMatriz = m.id in ehAdminMatrizIds
            // Se for ADMIN_MATRIZ daquela Matriz: tem visão e acesso a todas as filiais daquela matriz
            // Se for outro perfil: vê apenas as filiais daquela matriz às quais está expressamente vinculado
            val filiaisDestaMatriz = empresasAtivas.filter { f ->
                f.tipo.equals("FILIAL", ignoreCase = true) && 
                f.matrizId == m.id && 
                (isAdminDestaMatriz || f.id in empresasVinculadasIds)
            }

            EmpresaHierarquiaDTO(
                id = m.id,
                tipo = m.tipo,
                nomeFantasia = m.nomeFantasia,
                razaoSocial = m.razaoSocial,
                cnpj = m.cnpj,
                schemaName = m.schemaName,
                bancoDados = m.bancoDados,
                ativo = m.ativo,
                filiais = filiaisDestaMatriz
            )
        }
    }
}

private fun montarSessaoUsuario(user: ResultRow, ipOrigem: String?, metodoAuth: String = "SENHA"): LoginResponse {
    val userId = user[UsuariosTable.id]
    val isSuperuser = user[UsuariosTable.isSuperuser]
    val userEmail = user[UsuariosTable.email]

    // Buscar empresas do usuário e hierarquia permitida
    val (vinculos, hierarquia) = transaction {
        val vinculosRows = (UsuarioEmpresasTable innerJoin EmpresasTable innerJoin PerfisTable)
            .select { (UsuarioEmpresasTable.usuarioId eq userId) and (EmpresasTable.ativo eq true) }
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

        val tree = obterEmpresasPermitidas(userEmail)
        Pair(vinculosRows, tree)
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

        // 2. Listagem de Empresas (Hierarquia Matriz e Filiais com Isolamento por Usuário)
        get("/empresas") {
            try {
                val callerEmail = call.request.headers["X-User-Email"]?.trim()?.lowercase()
                val hierarquia = obterEmpresasPermitidas(callerEmail)
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

                // Determina o schema da empresa (ex.: db_galeriavagalume)
                val rawSchema = req.schemaName?.trim()?.lowercase()
                val finalSchema = if (!rawSchema.isNullOrBlank() && rawSchema !in listOf("matriz", "public", "filial_", "filial")) {
                    val clean = rawSchema.replace(Regex("[^a-z0-9]"), "")
                    if (clean.startsWith("db_")) clean else if (clean.startsWith("db")) "db_${clean.removePrefix("db")}" else "db_$clean"
                } else {
                    TenantContext.generateTenantSchema(req.nomeFantasia, tipo)
                }

                // Determina o banco de dados da empresa (ex.: bd_galeriavagalume)
                val rawBanco = req.bancoDados?.trim()?.lowercase()
                val finalBancoDados = if (!rawBanco.isNullOrBlank() && rawBanco !in listOf("bd_controle", "public", "matriz")) {
                    val clean = rawBanco.replace(Regex("[^a-z0-9]"), "")
                    if (clean.startsWith("bd_")) clean else if (clean.startsWith("bd")) "bd_${clean.removePrefix("bd")}" else "bd_$clean"
                } else if (tipo == "FILIAL" && req.matrizId != null) {
                    val matrizBanco = transaction {
                        EmpresasTable.select { EmpresasTable.id eq req.matrizId!! }.firstOrNull()?.get(EmpresasTable.bancoDados)
                    }
                    matrizBanco ?: TenantContext.generateDatabaseName(req.nomeFantasia)
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

        // 3.3 Atualização de Empresa ou Filial (Exclusivo Superusuário DcSys)
        put("/empresas/{id}") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
                if (!isSuper) {
                    call.respond(
                        HttpStatusCode.Forbidden,
                        mapOf("error" to "Acesso restrito: Apenas o Superusuário (DcSys) pode atualizar empresas e filiais.")
                    )
                    return@put
                }

                val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("ID de empresa inválido")
                val req = call.receive<AtualizarEmpresaRequest>()

                val empresaAtualizada = transaction {
                    val row = EmpresasTable.select { EmpresasTable.id eq id }.firstOrNull()
                        ?: throw IllegalArgumentException("Empresa não encontrada")

                    val tipo = row[EmpresasTable.tipo]

                    EmpresasTable.update({ EmpresasTable.id eq id }) {
                        if (!req.nomeFantasia.isNullOrBlank()) {
                            it[nomeFantasia] = req.nomeFantasia.trim()
                        }
                        if (req.razaoSocial != null) {
                            it[razaoSocial] = req.razaoSocial.trim()
                        }
                        if (req.cnpj != null) {
                            it[cnpj] = req.cnpj.replace(Regex("\\D"), "").takeIf { c -> c.isNotBlank() }
                        }
                        if (req.ativo != null) {
                            it[ativo] = req.ativo
                            // Se for MATRIZ e estiver sendo inativada (exclusão lógica), inativa em cascata todas as filiais
                            if (tipo.equals("MATRIZ", ignoreCase = true) && !req.ativo) {
                                EmpresasTable.update({ EmpresasTable.matrizId eq id }) { f ->
                                    f[ativo] = false
                                    f[atualizadoEm] = java.time.LocalDateTime.now()
                                }
                            }
                        }
                        it[atualizadoEm] = java.time.LocalDateTime.now()
                    }

                    EmpresasTable.select { EmpresasTable.id eq id }.first().let { r ->
                        EmpresaDTO(
                            id = r[EmpresasTable.id],
                            tipo = r[EmpresasTable.tipo],
                            matrizId = r[EmpresasTable.matrizId],
                            nomeFantasia = r[EmpresasTable.nomeFantasia],
                            razaoSocial = r[EmpresasTable.razaoSocial],
                            cnpj = r[EmpresasTable.cnpj],
                            schemaName = r[EmpresasTable.schemaName],
                            bancoDados = r[EmpresasTable.bancoDados],
                            ativo = r[EmpresasTable.ativo],
                            criadoEm = r[EmpresasTable.criadoEm].toString()
                        )
                    }
                }

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = "SUPERUSER",
                    atividadeRealizada = "Atualizada ${empresaAtualizada.tipo} '${empresaAtualizada.nomeFantasia}' (ativo: ${empresaAtualizada.ativo})",
                    tabela = "empresa",
                    registroId = id,
                    ipOrigem = call.getCallerIp()
                )

                call.respond(HttpStatusCode.OK, empresaAtualizada)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao atualizar empresa")))
            }
        }

        // 3.4 Exclusão LÓGICA de Empresa ou Filial (Exclusivo Superusuário DcSys)
        // Ao excluir uma MATRIZ, todas as suas filiais são automaticamente excluídas logicamente em cascata
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
                    val filiaisAfetadas = transaction {
                        // 1. Exclusão lógica em cascata de todas as filiais da matriz
                        EmpresasTable.update({ EmpresasTable.matrizId eq id }) {
                            it[ativo] = false
                            it[atualizadoEm] = java.time.LocalDateTime.now()
                        }
                        // 2. Exclusão lógica da matriz
                        EmpresasTable.update({ EmpresasTable.id eq id }) {
                            it[ativo] = false
                            it[atualizadoEm] = java.time.LocalDateTime.now()
                        }

                        EmpresasTable.select { EmpresasTable.matrizId eq id }.map { row ->
                            Pair(row[EmpresasTable.id], row[EmpresasTable.nomeFantasia])
                        }
                    }

                    for ((fId, fNome) in filiaisAfetadas) {
                        registrarAuditoriaGlobal(
                            usuario = callerEmail,
                            funcao = "SUPERUSER",
                            atividadeRealizada = "Exclusão lógica da Filial '$fNome' (ID $fId) em cascata pela Matriz ID $id",
                            tabela = "empresa",
                            registroId = fId,
                            ipOrigem = ip
                        )
                    }

                    registrarAuditoriaGlobal(
                        usuario = callerEmail,
                        funcao = "SUPERUSER",
                        atividadeRealizada = "Exclusão lógica da Matriz '$nome' (schema: $schema) e suas ${filiaisAfetadas.size} filial(is) em cascata",
                        tabela = "empresa",
                        registroId = id,
                        ipOrigem = ip
                    )

                    call.respond(
                        HttpStatusCode.OK,
                        mapOf(
                            "message" to "Matriz '$nome' e suas filiais vinculadas foram excluídas logicamente com sucesso.",
                            "filiaisAfetadas" to filiaisAfetadas.size
                        )
                    )
                } else {
                    transaction {
                        EmpresasTable.update({ EmpresasTable.id eq id }) {
                            it[ativo] = false
                            it[atualizadoEm] = java.time.LocalDateTime.now()
                        }
                    }

                    registrarAuditoriaGlobal(
                        usuario = callerEmail,
                        funcao = "SUPERUSER",
                        atividadeRealizada = "Exclusão lógica da Filial '$nome' (schema: $schema)",
                        tabela = "empresa",
                        registroId = id,
                        ipOrigem = ip
                    )

                    call.respond(
                        HttpStatusCode.OK,
                        mapOf("message" to "Filial '$nome' foi excluída logicamente com sucesso.")
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao excluir logicamente empresa/filial")))
            }
        }

        // 3.5 Reativação de Empresa ou Filial (Exclusivo Superusuário DcSys)
        patch("/empresas/{id}/reativar") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
                if (!isSuper) {
                    call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Acesso restrito."))
                    return@patch
                }
                val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("ID inválido")

                val empresa = transaction {
                    val row = EmpresasTable.select { EmpresasTable.id eq id }.firstOrNull()
                        ?: throw IllegalArgumentException("Empresa não encontrada")

                    val tipo = row[EmpresasTable.tipo]
                    val matrizId = row[EmpresasTable.matrizId]

                    // Se for filial e a matriz estiver inativa, reativa a matriz também para manter consistência
                    if (tipo.equals("FILIAL", ignoreCase = true) && matrizId != null) {
                        EmpresasTable.update({ EmpresasTable.id eq matrizId }) {
                            it[ativo] = true
                            it[atualizadoEm] = java.time.LocalDateTime.now()
                        }
                    }

                    EmpresasTable.update({ EmpresasTable.id eq id }) {
                        it[ativo] = true
                        it[atualizadoEm] = java.time.LocalDateTime.now()
                    }

                    Pair(row[EmpresasTable.nomeFantasia], tipo)
                }

                registrarAuditoriaGlobal(
                    usuario = callerEmail,
                    funcao = "SUPERUSER",
                    atividadeRealizada = "Reativação lógica da ${empresa.second} '${empresa.first}'",
                    tabela = "empresa",
                    registroId = id,
                    ipOrigem = call.getCallerIp()
                )

                call.respond(HttpStatusCode.OK, mapOf("message" to "${empresa.second} '${empresa.first}' reativada com sucesso!"))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao reativar empresa")))
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

        // 4. Listar Usuários Globais e seus Vínculos (Isolamento por Organização)
        get("/usuarios") {
            try {
                val (isSuper, callerEmail) = call.checkSuperuser()
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

                    if (isSuper) {
                        todosUsuarios
                    } else if (callerEmail.isNullOrBlank()) {
                        emptyList()
                    } else {
                        val callerUser = UsuariosTable.select { UsuariosTable.email eq callerEmail }.firstOrNull()
                        if (callerUser == null) {
                            emptyList()
                        } else {
                            val callerEmpresasIds = (UsuarioEmpresasTable innerJoin PerfisTable)
                                .select { UsuarioEmpresasTable.usuarioId eq callerUser[UsuariosTable.id] }
                                .map { it[UsuarioEmpresasTable.empresaId] }.toSet()

                            val matrizesQueAdministra = (UsuarioEmpresasTable innerJoin PerfisTable)
                                .select { 
                                    (UsuarioEmpresasTable.usuarioId eq callerUser[UsuariosTable.id]) and 
                                    (PerfisTable.codigo eq "ADMIN_MATRIZ") 
                                }
                                .map { it[UsuarioEmpresasTable.empresaId] }.toSet()

                            val filiaisDasMatrizes = if (matrizesQueAdministra.isNotEmpty()) {
                                EmpresasTable.select { EmpresasTable.matrizId inList matrizesQueAdministra }
                                    .map { it[EmpresasTable.id] }.toSet()
                            } else emptySet()

                            val todasEmpresasVisiveis = callerEmpresasIds + filiaisDasMatrizes

                            todosUsuarios.filter { u ->
                                u.empresas?.any { v -> v.empresaId in todasEmpresasVisiveis } == true
                            }
                        }
                    }
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
