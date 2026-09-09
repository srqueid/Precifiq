package com.precific.app.data.network

/**
 * Configurações de Conexão com o Backend Precific Ktor REST.
 */
object ApiConfig {
    /**
     * IP padrão para o Emulador Oficial do Android Studio:
     * 10.0.2.2 mapeia diretamente para o localhost (127.0.0.1) da máquina de desenvolvimento.
     */
    const val EMULATOR_BASE_URL = "http://10.0.2.2:8081/"

    /**
     * URL ativa que pode ser alterada em tempo de execução
     * (por exemplo, ao conectar um celular físico na mesma rede Wi-Fi).
     */
    @Volatile
    var customBaseUrl: String? = null

    val baseUrl: String
        get() = customBaseUrl ?: EMULATOR_BASE_URL

    /**
     * Timeout padrão de conexões de rede em segundos.
     */
    const val TIMEOUT_SECONDS = 20L
}
