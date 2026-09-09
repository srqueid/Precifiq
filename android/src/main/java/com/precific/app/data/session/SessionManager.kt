package com.precific.app.data.session

import com.precific.app.data.network.EmpresaDTO
import com.precific.app.data.network.LoginResponse
import com.precific.app.data.network.UsuarioDTO
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Gerenciador de Sessão e Contexto do Tenant (Multi-Tenancy) no Android.
 */
object SessionManager {

    private val _token = MutableStateFlow<String?>("jwt_dev_session")
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _activeSchema = MutableStateFlow("controle")
    val activeSchema: StateFlow<String> = _activeSchema.asStateFlow()

    private val _currentUser = MutableStateFlow<UsuarioDTO?>(
        UsuarioDTO(
            id = 1,
            nome = "Administrador DcSys",
            email = "admin@dcsys.com",
            isSuperuser = true,
            ativo = true
        )
    )
    val currentUser: StateFlow<UsuarioDTO?> = _currentUser.asStateFlow()

    private val _currentEmpresa = MutableStateFlow<EmpresaDTO?>(
        EmpresaDTO(
            id = 1,
            tipo = "MATRIZ",
            nomeFantasia = "Controle Silvia (Matriz)",
            schemaName = "controle",
            ativo = true
        )
    )
    val currentEmpresa: StateFlow<EmpresaDTO?> = _currentEmpresa.asStateFlow()

    /**
     * Retorna o token síncrono para o OkHttp Interceptor.
     */
    fun getToken(): String? = _token.value

    /**
     * Retorna o schema ativo síncrono para o cabeçalho X-Company-Schema.
     */
    fun getSchema(): String = _activeSchema.value

    fun salvarSessao(response: LoginResponse) {
        _token.value = response.token
        _currentUser.value = response.usuario

        // Seleciona a Matriz padrão (ex: 'controle') ou o primeiro vínculo disponível
        val schemaSelecionado = response.usuario.empresas?.firstOrNull { it.schemaName == "controle" }?.schemaName
            ?: response.usuario.empresas?.firstOrNull()?.schemaName
            ?: "controle"
        _activeSchema.value = schemaSelecionado
    }

    fun selecionarEmpresa(empresa: EmpresaDTO) {
        _currentEmpresa.value = empresa
        _activeSchema.value = empresa.schemaName
    }

    fun limparSessao() {
        _token.value = null
        _currentUser.value = null
        _currentEmpresa.value = null
        _activeSchema.value = "controle"
    }

    fun isAutenticado(): Boolean = _token.value != null
}
