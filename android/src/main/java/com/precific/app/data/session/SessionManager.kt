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

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _activeSchema = MutableStateFlow("")
    val activeSchema: StateFlow<String> = _activeSchema.asStateFlow()

    private val _currentUser = MutableStateFlow<UsuarioDTO?>(null)
    val currentUser: StateFlow<UsuarioDTO?> = _currentUser.asStateFlow()

    private val _currentEmpresa = MutableStateFlow<EmpresaDTO?>(null)
    val currentEmpresa: StateFlow<EmpresaDTO?> = _currentEmpresa.asStateFlow()

    /**
     * Retorna o token síncrono para o OkHttp Interceptor.
     */
    fun getToken(): String? = _token.value

    /**
     * Retorna o schema ativo síncrono para o cabeçalho X-Company-Schema.
     */
    fun getSchema(): String = _activeSchema.value

    /**
     * Salva a sessão após o login bem-sucedido, vinculando a empresa do usuário.
     */
    fun salvarSessao(response: LoginResponse) {
        _token.value = response.token
        _currentUser.value = response.usuario

        // Seleciona a primeira empresa vinculada ao cadastro do usuário
        val vinculoEmpresa = response.usuario.empresas?.firstOrNull()

        if (vinculoEmpresa != null) {
            _activeSchema.value = vinculoEmpresa.schemaName
            _currentEmpresa.value = EmpresaDTO(
                id = vinculoEmpresa.empresaId,
                tipo = vinculoEmpresa.empresaTipo,
                nomeFantasia = vinculoEmpresa.empresaNome,
                schemaName = vinculoEmpresa.schemaName,
                ativo = true
            )
        } else {
            // Fallback para hierarquia global de empresas, se disponível
            val primeiraHierarquia = response.empresasHierarquia?.firstOrNull()
            if (primeiraHierarquia != null) {
                _activeSchema.value = primeiraHierarquia.schemaName
                _currentEmpresa.value = EmpresaDTO(
                    id = primeiraHierarquia.id,
                    tipo = primeiraHierarquia.tipo,
                    nomeFantasia = primeiraHierarquia.nomeFantasia,
                    schemaName = primeiraHierarquia.schemaName,
                    ativo = primeiraHierarquia.ativo
                )
            } else {
                _activeSchema.value = "controle"
                _currentEmpresa.value = EmpresaDTO(
                    id = 1,
                    tipo = "MATRIZ",
                    nomeFantasia = "Empresa Padrão",
                    schemaName = "controle",
                    ativo = true
                )
            }
        }
    }

    /**
     * Altera a empresa ativa no contexto Multi-Tenancy do aplicativo.
     */
    fun selecionarEmpresaSchema(schemaName: String, nomeEmpresa: String) {
        _activeSchema.value = schemaName
        _currentEmpresa.value = EmpresaDTO(
            id = 0,
            tipo = "VINCULO",
            nomeFantasia = nomeEmpresa,
            schemaName = schemaName,
            ativo = true
        )
    }

    fun selecionarEmpresa(empresa: EmpresaDTO) {
        _currentEmpresa.value = empresa
        _activeSchema.value = empresa.schemaName
    }

    fun limparSessao() {
        _token.value = null
        _currentUser.value = null
        _currentEmpresa.value = null
        _activeSchema.value = ""
    }

    fun isAutenticado(): Boolean = !_token.value.isNullOrBlank()
}
