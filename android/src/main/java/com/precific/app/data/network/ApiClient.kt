package com.precific.app.data.network

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Provedor Singleton do Cliente Retrofit e da API REST do Precific.
 */
object ApiClient {

    private val loggingInterceptor by lazy {
        HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
    }

    private val okHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(TenantInterceptor())
            .addInterceptor(loggingInterceptor)
            .connectTimeout(ApiConfig.TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(ApiConfig.TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(ApiConfig.TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
    }

    @Volatile
    private var cachedService: PrecificApiService? = null
    private var lastBaseUrl: String? = null

    val apiService: PrecificApiService
        get() {
            val currentUrl = ApiConfig.baseUrl
            if (cachedService == null || lastBaseUrl != currentUrl) {
                synchronized(this) {
                    if (cachedService == null || lastBaseUrl != currentUrl) {
                        lastBaseUrl = currentUrl
                        val retrofit = Retrofit.Builder()
                            .baseUrl(currentUrl)
                            .client(okHttpClient)
                            .addConverterFactory(GsonConverterFactory.create())
                            .build()
                        cachedService = retrofit.create(PrecificApiService::class.java)
                    }
                }
            }
            return cachedService!!
        }
}
