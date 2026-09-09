package com.precific.app.data.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Interface Retrofit que mapeia todos os endpoints REST expostos pelo Ktor.
 */
interface PrecificApiService {

    // 1. Autenticação Global & Empresas
    @POST("api/global/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @GET("api/global/empresas")
    suspend fun getEmpresas(): Response<List<EmpresaHierarquiaDTO>>

    // 2. Dashboard & Indicadores de Gestão
    @GET("dashboard/json")
    suspend fun getDashboard(): Response<DashboardResponse>

    // 3. Estoque de Insumos & Validade
    @GET("insumos")
    suspend fun getInsumos(): Response<List<InsumoDTO>>

    // 4. Fornecedores
    @GET("fornecedores")
    suspend fun getFornecedores(): Response<List<FornecedorDTO>>

    // 5. Orçamentos
    @GET("orcamentos")
    suspend fun getOrcamentos(): Response<List<OrcamentoDTO>>

    @POST("orcamentos")
    suspend fun criarOrcamento(
        @Body request: CriarOrcamentoRequest
    ): Response<Map<String, Any>>

    // 6. Consulta de Código de Barras Unificada (Scanner com Câmera Mobile)
    @GET("api/codigo-barras/{codigo}")
    suspend fun consultarCodigoBarras(
        @Path("codigo") codigo: String
    ): Response<CodigoBarrasResultadoDTO>
}
