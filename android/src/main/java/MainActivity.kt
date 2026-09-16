package com.precific.app

import DashboardScreen
import FornecedoresScreen
import InsumosScreen
import LoginScreen
import OrcamentoDetalhesScreen
import OrcamentoFormScreen
import OrcamentosScreen
import PedidosOperacionaisScreen
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.precific.app.data.session.SessionManager

enum class Screen {
    DASHBOARD,
    ORCAMENTOS,
    NOVO_ORCAMENTO,
    ORCAMENTO_DETALHES,
    INSUMOS,
    FORNECEDORES,
    PEDIDOS_OPERACOES
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val token by SessionManager.token.collectAsState()
                    var currentScreen by remember { mutableStateOf(Screen.DASHBOARD) }
                    var selectedOrcamentoId by remember { mutableStateOf(1) }

                    if (token.isNullOrBlank()) {
                        LoginScreen()
                    } else {
                        when (currentScreen) {
                            Screen.DASHBOARD -> DashboardScreen(
                                onNavigateToOrcamentos = { currentScreen = Screen.ORCAMENTOS },
                                onNavigateToNovoOrcamento = { currentScreen = Screen.NOVO_ORCAMENTO },
                                onNavigateToInsumos = { currentScreen = Screen.INSUMOS },
                                onNavigateToFornecedores = { currentScreen = Screen.FORNECEDORES },
                                onNavigateToPedidosOperacionais = { currentScreen = Screen.PEDIDOS_OPERACOES }
                            )

                            Screen.ORCAMENTOS -> OrcamentosScreen(
                                onVoltar = { currentScreen = Screen.DASHBOARD },
                                onNovoOrcamento = { currentScreen = Screen.NOVO_ORCAMENTO },
                                onVerDetalhes = { id ->
                                    selectedOrcamentoId = id
                                    currentScreen = Screen.ORCAMENTO_DETALHES
                                }
                            )

                            Screen.NOVO_ORCAMENTO -> OrcamentoFormScreen(
                                onVoltar = { currentScreen = Screen.ORCAMENTOS },
                                onSalvoSucesso = { currentScreen = Screen.ORCAMENTOS }
                            )

                            Screen.ORCAMENTO_DETALHES -> OrcamentoDetalhesScreen(
                                orcamentoId = selectedOrcamentoId,
                                onVoltar = { currentScreen = Screen.ORCAMENTOS }
                            )

                            Screen.INSUMOS -> InsumosScreen(
                                onVoltar = { currentScreen = Screen.DASHBOARD }
                            )

                            Screen.FORNECEDORES -> FornecedoresScreen(
                                onVoltar = { currentScreen = Screen.DASHBOARD }
                            )

                            Screen.PEDIDOS_OPERACOES -> PedidosOperacionaisScreen(
                                onVoltar = { currentScreen = Screen.DASHBOARD }
                            )
                        }
                    }
                }
            }
        }
    }
}
