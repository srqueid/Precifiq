package org.example

import java.text.Normalizer
import java.util.Locale

object TenantContext {
    private const val DEFAULT_SCHEMA = "controle"
    private val schemaThreadLocal = ThreadLocal<String>()
    private val SCHEMA_REGEX = Regex("^[a-zA-Z0-9_]{2,63}$")

    fun getCurrentSchema(): String {
        return schemaThreadLocal.get() ?: DEFAULT_SCHEMA
    }

    fun setCurrentSchema(schema: String?) {
        if (schema.isNullOrBlank()) {
            schemaThreadLocal.remove()
        } else {
            val normalized = schema.trim().lowercase(Locale.ROOT)
            if (isValidSchema(normalized)) {
                schemaThreadLocal.set(normalized)
            } else {
                throw IllegalArgumentException("Identificador de schema inválido: '$schema'. Deve conter apenas letras, números e sublinhado (2-63 caracteres).")
            }
        }
    }

    fun clear() {
        schemaThreadLocal.remove()
    }

    fun isValidSchema(schema: String): Boolean {
        return SCHEMA_REGEX.matches(schema)
    }

    fun generateTenantSchema(nome: String, tipo: String = "FILIAL"): String {
        val normalized = Normalizer.normalize(nome, Normalizer.Form.NFD)
            .replace(Regex("[\\p{InCombiningDiacriticalMarks}]"), "")
            .lowercase(Locale.ROOT)
            .replace(Regex("[^a-z0-9]"), "_")
            .replace(Regex("_+"), "_")
            .trim('_')

        val base = if (tipo.equals("MATRIZ", ignoreCase = true)) {
            if (normalized == "matriz" || normalized.startsWith("matriz_")) normalized else "matriz"
        } else {
            if (normalized.startsWith("filial_")) normalized else "filial_$normalized"
        }
        return if (base.length > 60) base.substring(0, 60) else base
    }

    fun generateDatabaseName(nomeEmpresa: String): String {
        val normalized = Normalizer.normalize(nomeEmpresa, Normalizer.Form.NFD)
            .replace(Regex("[\\p{InCombiningDiacriticalMarks}]"), "")
            .lowercase(Locale.ROOT)
            .replace(Regex("[^a-z0-9]"), "_")
            .replace(Regex("_+"), "_")
            .trim('_')

        val base = if (normalized.startsWith("bd_")) normalized else "bd_$normalized"
        return if (base.length > 60) base.substring(0, 60) else base
    }

    fun <T> withSchema(schema: String, block: () -> T): T {
        val previous = schemaThreadLocal.get()
        return try {
            setCurrentSchema(schema)
            block()
        } finally {
            if (previous != null) {
                schemaThreadLocal.set(previous)
            } else {
                schemaThreadLocal.remove()
            }
        }
    }
}
