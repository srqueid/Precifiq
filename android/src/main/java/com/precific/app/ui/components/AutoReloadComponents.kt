package com.precific.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.precific.app.Screen
import com.precific.app.data.session.AutoReloadManager

/**
 * Indicador flutuante discreto de Auto-Reload para telas do Android.
 */
@Composable
fun AutoReloadFloatingIndicator(
    currentScreen: Screen,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isEnabled by AutoReloadManager.isEnabled.collectAsState()
    val isPaused by AutoReloadManager.isPaused.collectAsState()
    val remainingSeconds by AutoReloadManager.remainingSeconds.collectAsState()
    val selectedScreens by AutoReloadManager.selectedScreens.collectAsState()

    val isCurrentScreenSelected = selectedScreens.contains(currentScreen)

    AnimatedVisibility(
        visible = isEnabled,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = modifier
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(
                width = 1.5.dp,
                color = if (isCurrentScreenSelected) {
                    if (isPaused) Color(0xFFF59E0B) else Color(0xFF2563EB)
                } else {
                    Color(0xFFCBD5E1)
                }
            ),
            shadowElevation = 6.dp,
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(
                            if (isCurrentScreenSelected) {
                                if (isPaused) Color(0x26F59E0B) else Color(0x262563EB)
                            } else {
                                Color(0x2664748B)
                            }
                        )
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Recarregar",
                        tint = if (isCurrentScreenSelected) {
                            if (isPaused) Color(0xFFD97706) else Color(0xFF2563EB)
                        } else {
                            Color(0xFF64748B)
                        },
                        modifier = Modifier.size(16.dp)
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Column {
                    if (isCurrentScreenSelected) {
                        Text(
                            text = if (isPaused) "Reload pausado" else "Reload em ${remainingSeconds}s",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isPaused) Color(0xFFD97706) else Color(0xFF2563EB)
                        )
                        Text(
                            text = "A cada 30 segundos",
                            fontSize = 10.sp,
                            color = Color.Gray
                        )
                    } else {
                        Text(
                            text = "Auto-reload inativo nesta tela",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Gray
                        )
                    }
                }

                Spacer(modifier = Modifier.width(6.dp))

                if (isCurrentScreenSelected) {
                    IconButton(
                        onClick = { AutoReloadManager.togglePause() },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = if (isPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                            contentDescription = if (isPaused) "Retomar" else "Pausar",
                            tint = if (isPaused) Color(0xFF16A34A) else Color(0xFFD97706),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                IconButton(
                    onClick = onOpenSettings,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = "Configurar",
                        tint = Color(0xFF475569),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

/**
 * Diálogo modal para selecionar telas com reload a cada 30 segundos no Android.
 */
@Composable
fun AutoReloadSettingsDialog(
    isOpen: Boolean,
    onClose: () -> Unit
) {
    if (!isOpen) return

    val isEnabled by AutoReloadManager.isEnabled.collectAsState()
    val isPaused by AutoReloadManager.isPaused.collectAsState()
    val selectedScreens by AutoReloadManager.selectedScreens.collectAsState()

    Dialog(onDismissRequest = onClose) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                // Cabeçalho
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0x1F2563EB))
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = null,
                                tint = Color(0xFF2563EB),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Auto-Reload (30s)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                            Text(
                                text = "Recarregar telas a cada 30 segundos",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }
                    }

                    IconButton(onClick = onClose) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Fechar")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Card de status geral com Switch
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (isEnabled) Color(0x0F2563EB) else Color(0x0F64748B)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (isEnabled) "Recarregamento Ativo" else "Recarregamento Desativado",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = if (isEnabled) Color(0xFF2563EB) else Color(0xFF475569)
                            )
                            Text(
                                text = "Recarrega os dados das telas marcadas abaixo a cada 30s",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }
                        Switch(
                            checked = isEnabled,
                            onCheckedChange = { AutoReloadManager.setEnabled(it) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Ações rápidas: Marcar todas / Desmarcar todas
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Telas Selecionadas (${selectedScreens.size}/${AutoReloadManager.SELECTABLE_SCREENS.size})",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = Color(0xFF475569)
                    )

                    Row {
                        Text(
                            text = "Marcar Todas",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF2563EB),
                            modifier = Modifier
                                .clickable { AutoReloadManager.selectAll(true) }
                                .padding(4.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "|",
                            color = Color.LightGray,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Limpar",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.Gray,
                            modifier = Modifier
                                .clickable { AutoReloadManager.selectAll(false) }
                                .padding(4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Lista de Telas Selecionáveis
                AutoReloadManager.SELECTABLE_SCREENS.forEach { screen ->
                    val isChecked = selectedScreens.contains(screen)
                    val (nome, descricao) = when (screen) {
                        Screen.DASHBOARD -> Pair("Dashboard", "Indicadores, faturamento e gráficos")
                        Screen.PEDIDOS_OPERACOES -> Pair("Pedidos Operacionais", "Ordens de venda e expedição")
                        Screen.ORCAMENTOS -> Pair("Orçamentos", "Lista e status de orçamentos")
                        Screen.INSUMOS -> Pair("Insumos & Estoque", "Saldos de materiais e preços")
                        Screen.FORNECEDORES -> Pair("Fornecedores", "Lista de fornecedores cadastrados")
                        Screen.RECEBIMENTO_MATERIAIS -> Pair("Recebimento de Materiais", "Entrada e conferência de insumos")
                        else -> Pair(screen.name, "")
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .border(
                                width = 1.dp,
                                color = if (isChecked) Color(0x4D2563EB) else Color(0xFFE2E8F0),
                                shape = RoundedCornerShape(8.dp)
                            )
                            .clickable { AutoReloadManager.toggleScreen(screen) }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = nome,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                            if (descricao.isNotBlank()) {
                                Text(
                                    text = descricao,
                                    fontSize = 11.sp,
                                    color = Color.Gray
                                )
                            }
                        }
                        Checkbox(
                            checked = isChecked,
                            onCheckedChange = { AutoReloadManager.toggleScreen(screen) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Botão Concluir
                Button(
                    onClick = onClose,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Concluir e Salvar", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
