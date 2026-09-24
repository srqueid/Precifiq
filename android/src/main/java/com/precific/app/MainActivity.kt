package com.precific.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.precific.app.data.session.SessionManager
import com.precific.app.ui.auth.LoginScreen
import com.precific.app.ui.dashboard.DashboardScreen
import com.precific.app.ui.fornecedores.FornecedoresScreen
import com.precific.app.ui.insumos.InsumosScreen
import com.precific.app.ui.orcamentos.OrcamentoDetalhesScreen
import com.precific.app.ui.orcamentos.OrcamentoFormScreen
import com.precific.app.ui.orcamentos.OrcamentosScreen
import com.precific.app.ui.pedidos.PedidosOperacionaisScreen
import com.precific.app.ui.recebimento.RecebimentoMateriaisScreen

enum class Screen {
    DASHBOARD,
    ORCAMENTOS,
    NOVO_ORCAMENTO,
    ORCAMENTO_DETALHES,
    INSUMOS,
    FORNECEDORES,
    PEDIDOS_OPERACOES,
    RECEBIMENTO_MATERIAIS
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
                    var abrirModalNovoPedido by remember { mutableStateOf(false) }

                    if (token.isNullOrBlank()) {
                        LoginScreen()
                    } else {
                        when (currentScreen) {
                            Screen.DASHBOARD -> DashboardScreen(
                                onNavigateToOrcamentos = { currentScreen = Screen.ORCAMENTOS },
                                onNavigateToNovoOrcamento = { currentScreen = Screen.NOVO_ORCAMENTO },
                                onNavigateToNovoPedidoCliente = {
                                    abrirModalNovoPedido = true
                                    currentScreen = Screen.PEDIDOS_OPERACOES
                                },
                                onNavigateToInsumos = { currentScreen = Screen.INSUMOS },
                                onNavigateToFornecedores = { currentScreen = Screen.FORNECEDORES },
                                onNavigateToPedidosOperacionais = {
                                    abrirModalNovoPedido = false
                                    currentScreen = Screen.PEDIDOS_OPERACOES
                                },
                                onNavigateToRecebimento = { currentScreen = Screen.RECEBIMENTO_MATERIAIS }
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
                                abrirModalInicial = abrirModalNovoPedido,
                                onVoltar = {
                                    abrirModalNovoPedido = false
                                    currentScreen = Screen.DASHBOARD
                                }
                            )

                            Screen.RECEBIMENTO_MATERIAIS -> RecebimentoMateriaisScreen(
                                onVoltar = { currentScreen = Screen.DASHBOARD }
                            )
                        }
                    }
                }
            }
        }
    }
}
