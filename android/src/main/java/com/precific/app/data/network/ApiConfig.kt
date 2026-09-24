package com.precific.app.data.network

import android.os.Build

/**
 * Configurações de Conexão com o Backend Precific Ktor REST.
 */
object ApiConfig {
    /**
     * URL de Produção com HTTPS para o App Mobile (Hostinger VPS / Traefik SSL).
     */
    const val PROD_BASE_URL = "https://apiprecifiq.dcsys.info/"

    /**
     * IP para Emulador do Android Studio (10.0.2.2 mapeia para o localhost da máquina).
     */
    const val EMULATOR_BASE_URL = "http://10.0.2.2:8081/"

    /**
     * IP local da máquina na rede física (para desenvolvimento local na mesma rede Wi-Fi/Ethernet).
     */
    const val LOCAL_IP_BASE_URL = "http://10.100.111.116:8081/"

    @Volatile
    var customBaseUrl: String? = null

    val baseUrl: String
        get() {
            customBaseUrl?.let { return it }
            return PROD_BASE_URL
        }

    private fun isEmulator(): Boolean {
        return (Build.FINGERPRINT.startsWith("generic")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || Build.HARDWARE.contains("goldfish")
                || Build.HARDWARE.contains("ranchu"))
    }

    /**
     * Timeout padrão de conexões de rede em segundos.
     */
    const val TIMEOUT_SECONDS = 20L
}
