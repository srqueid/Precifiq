package com.precific.app.data.network

import com.precific.app.data.session.SessionManager
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Interceptador OkHttp responsável por injetar:
 * 1. O schema do banco de dados isolado da empresa ativa (Multi-Tenancy: X-Company-Schema).
 * 2. O token de autorização JWT (Authorization: Bearer ...).
 * 3. Cabeçalhos padrões de conteúdo JSON.
 */
class TenantInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val requestBuilder = originalRequest.newBuilder()

        // 1. Injeta o Schema Ativo da Empresa
        val currentSchema = SessionManager.getSchema()
        requestBuilder.header("X-Company-Schema", currentSchema)

        // 2. Injeta o Token de Autorização se logado
        SessionManager.getToken()?.let { token ->
            requestBuilder.header("Authorization", "Bearer $token")
        }

        // 3. Injeta email do usuário autenticado para rastreabilidade
        SessionManager.currentUser.value?.email?.let { email ->
            requestBuilder.header("X-User-Email", email)
        }

        requestBuilder.header("Accept", "application/json")

        return chain.proceed(requestBuilder.build())
    }
}
