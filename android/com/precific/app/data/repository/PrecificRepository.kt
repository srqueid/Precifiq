package com.precific.app.data.repository

import com.precific.app.data.network.*
import com.precific.app.data.session.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Repositório Central de Dados para o App Android do Precific.
 * Encapsula chamadas de rede da API REST do Ktor com tratamento de erros.
 */
class PrecificRepository(
    private val api: PrecificApiService = ApiClient.apiService
) {

    /**
     * Realiza login no backend e salva token e dados de multi-tenancy.
     */
    suspend fun login(email: String, pass: String): Result<LoginResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.login(LoginRequest(email.trim(), pass.trim()))
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                SessionManager.salvarSessao(body)
                Result.success(body)
            } else {
                val err = response.errorBody()?.string() ?: "Falha ao autenticar (${response.code()})"
                Result.failure(Exception(err))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Carrega os indicadores consolidados do Dashboard.
     */
    suspend fun getDashboard(): Result<DashboardResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.getDashboard()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao buscar dashboard: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Carrega a lista de insumos cadastrados no schema da empresa ativa.
     */
    suspend fun getInsumos(): Result<List<InsumoDTO>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getInsumos()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao buscar insumos: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Carrega a lista de fornecedores.
     */
    suspend fun getFornecedores(): Result<List<FornecedorDTO>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getFornecedores()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao buscar fornecedores: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Carrega os orçamentos da empresa ativa.
     */
    suspend fun getOrcamentos(): Result<List<OrcamentoDTO>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getOrcamentos()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao buscar orçamentos: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cadastra um novo orçamento.
     */
    suspend fun criarOrcamento(request: CriarOrcamentoRequest): Result<Map<String, Any>> = withContext(Dispatchers.IO) {
        try {
            val response = api.criarOrcamento(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao criar orçamento: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Consulta um código de barras bipado pela câmera ou leitor físico no celular.
     */
    suspend fun consultarCodigoBarras(codigo: String): Result<CodigoBarrasResultadoDTO> = withContext(Dispatchers.IO) {
        try {
            val response = api.consultarCodigoBarras(codigo)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Código de barras não localizado: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
