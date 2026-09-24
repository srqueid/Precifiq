package com.precific.app.data.session

import android.content.Context
import android.content.SharedPreferences
import com.precific.app.Screen
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Gerenciador de Recarregamento Automático (30s) para o App Android.
 * Permite ao usuário escolher quais telas serão recarregadas automaticamente a cada 30 segundos.
 */
object AutoReloadManager {

    private const val PREFS_NAME = "precifiq_auto_reload_prefs"
    private const val KEY_ENABLED = "key_auto_reload_enabled"
    private const val KEY_SCREENS = "key_auto_reload_screens"
    const val INTERVAL_SECONDS = 30

    val SELECTABLE_SCREENS = listOf(
        Screen.DASHBOARD,
        Screen.PEDIDOS_OPERACOES,
        Screen.ORCAMENTOS,
        Screen.INSUMOS,
        Screen.FORNECEDORES,
        Screen.RECEBIMENTO_MATERIAIS
    )

    private var prefs: SharedPreferences? = null

    private val _isEnabled = MutableStateFlow(false)
    val isEnabled: StateFlow<Boolean> = _isEnabled.asStateFlow()

    private val _selectedScreens = MutableStateFlow<Set<Screen>>(
        setOf(
            Screen.DASHBOARD,
            Screen.PEDIDOS_OPERACOES,
            Screen.ORCAMENTOS,
            Screen.INSUMOS,
            Screen.RECEBIMENTO_MATERIAIS
        )
    )
    val selectedScreens: StateFlow<Set<Screen>> = _selectedScreens.asStateFlow()

    private val _isPaused = MutableStateFlow(false)
    val isPaused: StateFlow<Boolean> = _isPaused.asStateFlow()

    private val _remainingSeconds = MutableStateFlow(INTERVAL_SECONDS)
    val remainingSeconds: StateFlow<Int> = _remainingSeconds.asStateFlow()

    fun init(context: Context) {
        if (prefs == null) {
            prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val savedEnabled = prefs?.getBoolean(KEY_ENABLED, false) ?: false
            val savedScreens = prefs?.getStringSet(KEY_SCREENS, null)

            _isEnabled.value = savedEnabled

            if (savedScreens != null) {
                val screens = savedScreens.mapNotNull { name ->
                    try {
                        Screen.valueOf(name)
                    } catch (_: Exception) {
                        null
                    }
                }.toSet()
                _selectedScreens.value = screens
            }
        }
    }

    fun setEnabled(enabled: Boolean) {
        _isEnabled.value = enabled
        if (enabled) {
            _isPaused.value = false
            _remainingSeconds.value = INTERVAL_SECONDS
        }
        prefs?.edit()?.putBoolean(KEY_ENABLED, enabled)?.apply()
    }

    fun toggleScreen(screen: Screen) {
        val current = _selectedScreens.value.toMutableSet()
        if (current.contains(screen)) {
            current.remove(screen)
        } else {
            current.add(screen)
        }
        _selectedScreens.value = current
        saveScreens()
    }

    fun selectAll(select: Boolean) {
        if (select) {
            _selectedScreens.value = SELECTABLE_SCREENS.toSet()
        } else {
            _selectedScreens.value = emptySet()
        }
        saveScreens()
    }

    fun togglePause() {
        _isPaused.value = !_isPaused.value
    }

    fun resetSeconds() {
        _remainingSeconds.value = INTERVAL_SECONDS
    }

    /**
     * Decrementa 1 segundo. Retorna true se deve disparar o reload (atingiu 0).
     */
    fun decrementSecond(): Boolean {
        if (_remainingSeconds.value <= 1) {
            _remainingSeconds.value = INTERVAL_SECONDS
            return true
        } else {
            _remainingSeconds.value = _remainingSeconds.value - 1
            return false
        }
    }

    private fun saveScreens() {
        val names = _selectedScreens.value.map { it.name }.toSet()
        prefs?.edit()?.putStringSet(KEY_SCREENS, names)?.apply()
    }
}
