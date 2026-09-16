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
     * Converte um orçamento em pedido de compra.
     */
    suspend fun converterOrcamentoEmCompra(id: Int): Result<Map<String, Any>> = withContext(Dispatchers.IO) {
        try {
            val response = api.converterOrcamentoEmCompra(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao converter orçamento em compra: ${response.code()}"))
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

    /**
     * Carrega a lista de pedidos operacionais da empresa ativa.
     */
    suspend fun getPedidosOperacionais(): Result<List<PedidoDTO>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getPedidosOperacionais()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao buscar pedidos: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cadastra um novo pedido operacional.
     */
    suspend fun criarPedidoOperacional(pedido: PedidoDTO): Result<PedidoDTO> = withContext(Dispatchers.IO) {
        try {
            val response = api.criarPedidoOperacional(pedido)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Erro ao registrar pedido: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Atualiza o status de entrega (Expedido / Entregue).
     */
    suspend fun atualizarEntregaPedido(id: Int, entregue: Boolean): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.atualizarEntregaPedido(id, mapOf("entregue" to entregue))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Erro ao atualizar entrega: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Baixa o pagamento de um pedido.
     */
    suspend fun atualizarPagamentoPedido(id: Int, dataPagamento: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.atualizarPagamentoPedido(id, mapOf("dataPagamento" to dataPagamento))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Erro ao atualizar pagamento: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Exclui um pedido operacional.
     */
    suspend fun deletarPedidoOperacional(id: Int): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.deletarPedidoOperacional(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Erro ao deletar pedido: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
