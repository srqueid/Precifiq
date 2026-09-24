package com.precific.app.ui.dashboard

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.precific.app.R
import com.precific.app.data.network.EmpresaDTO
import com.precific.app.data.network.UsuarioDTO
import com.precific.app.data.network.UsuarioVinculoEmpresaDTO
import com.precific.app.data.session.SessionManager
import com.precific.app.domain.*
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onNavigateToOrcamentos: () -> Unit = {},
    onNavigateToNovoOrcamento: () -> Unit = {},
    onNavigateToNovoPedidoCliente: () -> Unit = {},
    onNavigateToInsumos: () -> Unit = {},
    onNavigateToFornecedores: () -> Unit = {},
    onNavigateToPedidosOperacionais: () -> Unit = {},
    onNavigateToRecebimento: () -> Unit = {}
) {
    val dashboardData by viewModel.dashboardData.collectAsState()
    val pedidos by viewModel.pedidos.collectAsState()
    val kpisFromApi by viewModel.kpis.collectAsState()
    val insumosFromApi by viewModel.insumosCriticos.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    // Métricas dinâmicas de entregas e vendas operacionais
    val pedidosEntregues = pedidos.filter { it.entregue }
    val pedidosPendentesEntrega = pedidos.filter { !it.entregue }

    val vendasTotalMes = if (pedidosEntregues.isNotEmpty()) {
        pedidosEntregues.sumOf { it.valor ?: 0.0 }
    } else {
        dashboardData?.vendasTotalMes ?: 0.0
    }
    val vendasCount = if (pedidosEntregues.isNotEmpty()) pedidosEntregues.size else 0

    val pendentesEntregaCount = pedidosPendentesEntrega.size
    val pendentesEntregaTotal = pedidosPendentesEntrega.sumOf { it.valor ?: 0.0 }

    val currentUser by SessionManager.currentUser.collectAsState()
    val currentEmpresa by SessionManager.currentEmpresa.collectAsState()
    val activeSchema by SessionManager.activeSchema.collectAsState()

    val defaultKpis = remember {
        listOf(
            DashboardKPIData(
                title = "Valor em Estoque",
                value = "R$ 0,00",
                trendText = "Sincronizando...",
                isPositiveTrend = true,
                icon = Icons.Default.Inventory,
                accentColor = Color(0xFF2563EB)
            ),
            DashboardKPIData(
                title = "Orçamentos Aprovados",
                value = "0",
                trendText = "Sincronizando...",
                isPositiveTrend = true,
                icon = Icons.Default.CheckCircle,
                accentColor = Color(0xFF10B981)
            ),
            DashboardKPIData(
                title = "Compras em Andamento",
                value = "0",
                trendText = "Sincronizando...",
                isPositiveTrend = true,
                icon = Icons.Default.ShoppingCart,
                accentColor = Color(0xFFF59E0B)
            ),
            DashboardKPIData(
                title = "Insumos Críticos",
                value = "0",
                trendText = "Sincronizando...",
                isPositiveTrend = false,
                icon = Icons.Default.Warning,
                accentColor = Color(0xFFEF4444)
            )
        )
    }

    val kpis = if (kpisFromApi.isNotEmpty()) kpisFromApi else defaultKpis

    val custosSemana by viewModel.custosSemana.collectAsState()
    val orcamentosRecentes by viewModel.orcamentosRecentes.collectAsState()
    val insumosCriticos by viewModel.insumosCriticos.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    Surface(
                        modifier = Modifier
                            .padding(start = 12.dp, end = 8.dp)
                            .size(38.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        shadowElevation = 2.dp
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(4.dp)
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.logo_precifiq),
                                contentDescription = "Logo Precific",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Fit
                            )
                        }
                    }
                },
                title = {
                    Column {
                        Text("Precific", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            "Visão Geral & Indicadores",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = Color.White
                ),
                actions = {
                    IconButton(onClick = { /* Notificações */ }) {
                        BadgedBox(badge = { Badge { Text("3") } }) {
                            Icon(
                                Icons.Default.Notifications,
                                contentDescription = "Notificações",
                                tint = Color.White
                            )
                        }
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Seção 0: Informações do Usuário e Empresa Vinculada
            item {
                UserCompanyCard(
                    usuario = currentUser,
                    empresa = currentEmpresa,
                    activeSchema = activeSchema,
                    onTrocarEmpresa = { vinculo ->
                        SessionManager.selecionarEmpresaSchema(vinculo.schemaName, vinculo.empresaNome)
                        viewModel.carregarDashboard()
                    },
                    onLogout = {
                        SessionManager.limparSessao()
                    }
                )
            }

            // Seção 1: Quick Actions (Ações Rápidas)
            item {
                QuickActionsSection(
                    onNovoPedidoCliente = onNavigateToNovoPedidoCliente,
                    onVerOrcamentos = onNavigateToOrcamentos,
                    onInsumos = onNavigateToInsumos,
                    onFornecedores = onNavigateToFornecedores,
                    onReceberMateriais = onNavigateToRecebimento
                )
            }

            // Seção 2: Cards de Indicadores de Gestão (Clicáveis)
            item {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Indicadores de Gestão",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        TextButton(onClick = { viewModel.carregarDashboard() }) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(if (isLoading) "Atualizando..." else "Atualizar", fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    DashboardKpiCards(
                        vendasMesVal = "R$ ${vendasTotalMes.format(2)}",
                        vendasMesSub = "$vendasCount pedido(s) faturados/entregues",
                        pendentesEntregaVal = "$pendentesEntregaCount pedido(s)",
                        pendentesEntregaSub = "Total: R$ ${pendentesEntregaTotal.format(2)} a expedir",
                        comprasAguardandoVal = "0",
                        orcamentosAtivosVal = (dashboardData?.orcamentosPendentes ?: 0).toString(),
                        orcamentosAprovadosVal = (dashboardData?.orcamentosAprovados ?: 0).toString(),
                        produtosCadastradosVal = (dashboardData?.totalProdutos?.takeIf { it > 0 } ?: 2).toString(),
                        onNavigateToOrcamentos = onNavigateToOrcamentos,
                        onNavigateToInsumos = onNavigateToInsumos,
                        onNavigateToPedidosOperacionais = onNavigateToPedidosOperacionais,
                        onNavigateToRecebimento = onNavigateToRecebimento
                    )
                }
            }

            // Seção 3: Gráfico de Evolução de Custos em Compose Nativo
            item {
                CostChartCard(custos = custosSemana)
            }

            // Seção 4: Insumos em Baixo Estoque (Alerta Crítico)
            item {
                InsumosCriticosSection(
                    insumos = insumosCriticos,
                    onVerTodos = onNavigateToInsumos
                )
            }

            // Seção 5: Orçamentos Recentes
            item {
                RecentOrcamentosSection(
                    orcamentos = orcamentosRecentes,
                    onVerTodos = onNavigateToOrcamentos
                )
            }
        }
    }
}

@Composable
fun QuickActionsSection(
    onNovoPedidoCliente: () -> Unit,
    onVerOrcamentos: () -> Unit,
    onInsumos: () -> Unit,
    onFornecedores: () -> Unit,
    onReceberMateriais: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                "Ações Rápidas",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                QuickActionButton(
                    label = "Novo Pedido",
                    icon = Icons.Default.AddCircle,
                    color = MaterialTheme.colorScheme.primary,
                    onClick = onNovoPedidoCliente
                )
                QuickActionButton(
                    label = "Orçamentos",
                    icon = Icons.Default.ReceiptLong,
                    color = Color(0xFF10B981),
                    onClick = onVerOrcamentos
                )
                QuickActionButton(
                    label = "Receber",
                    icon = Icons.Default.QrCodeScanner,
                    color = Color(0xFFD97706),
                    onClick = onReceberMateriais
                )
                QuickActionButton(
                    label = "Insumos",
                    icon = Icons.Default.Category,
                    color = Color(0xFF8B5CF6),
                    onClick = onInsumos
                )
                QuickActionButton(
                    label = "Fornecedores",
                    icon = Icons.Default.Business,
                    color = Color(0xFF2563EB),
                    onClick = onFornecedores
                )
            }
        }
    }
}

@Composable
fun QuickActionButton(
    label: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(color.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = label, tint = color, modifier = Modifier.size(24.dp))
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun DashboardKpiCards(
    vendasMesVal: String,
    vendasMesSub: String,
    pendentesEntregaVal: String,
    pendentesEntregaSub: String,
    comprasAguardandoVal: String,
    orcamentosAtivosVal: String,
    orcamentosAprovadosVal: String,
    produtosCadastradosVal: String,
    onNavigateToOrcamentos: () -> Unit,
    onNavigateToInsumos: () -> Unit,
    onNavigateToPedidosOperacionais: () -> Unit,
    onNavigateToRecebimento: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // 1. VENDAS REALIZADAS (MÊS) -> Ir direto para Gestão Operacional de Pedidos
        SingleKpiCard(
            title = "VENDAS REALIZADAS (MÊS)",
            value = vendasMesVal,
            subtitle = vendasMesSub,
            icon = Icons.Default.ShoppingCart,
            iconTint = Color(0xFF10B981),
            iconBg = Color(0xFFDCFCE7),
            valueColor = Color(0xFF10B981),
            onClick = onNavigateToPedidosOperacionais
        )

        // 2. PENDENTES DE ENTREGA -> Ir direto para Gestão Operacional de Pedidos
        SingleKpiCard(
            title = "PENDENTES DE ENTREGA",
            value = pendentesEntregaVal,
            subtitle = pendentesEntregaSub,
            icon = Icons.Default.LocalShipping,
            iconTint = Color(0xFF2563EB),
            iconBg = Color(0xFFDBEAFE),
            valueColor = Color(0xFF2563EB),
            onClick = onNavigateToPedidosOperacionais
        )

        // 3. COMPRAS AGUARDANDO -> Ir direto para Recebimento de Materiais Comprados
        SingleKpiCard(
            title = "COMPRAS AGUARDANDO",
            value = comprasAguardandoVal,
            subtitle = "Aguardando confirmação de recebimento",
            icon = Icons.Default.ShoppingCart,
            iconTint = Color(0xFFD97706),
            iconBg = Color(0xFFFEF3C7),
            valueColor = Color(0xFFD97706),
            onClick = onNavigateToRecebimento
        )

        // 4. ORÇAMENTOS ATIVOS -> Ir direto para Orçamentos
        SingleKpiCard(
            title = "ORÇAMENTOS ATIVOS",
            value = orcamentosAtivosVal,
            subtitle = "Em cotação com fornecedores",
            icon = Icons.Default.Description,
            iconTint = Color(0xFF2563EB),
            iconBg = Color(0xFFDBEAFE),
            valueColor = Color(0xFF2563EB),
            onClick = onNavigateToOrcamentos
        )

        // 5. ORÇAMENTOS APROVADOS -> Ir direto para Orçamentos
        SingleKpiCard(
            title = "ORÇAMENTOS APROVADOS",
            value = orcamentosAprovadosVal,
            subtitle = "Prontos para conversão em compra",
            icon = Icons.Default.CheckCircle,
            iconTint = Color(0xFF10B981),
            iconBg = Color(0xFFDCFCE7),
            valueColor = Color(0xFF10B981),
            onClick = onNavigateToOrcamentos
        )

        // 6. PRODUTOS CADASTRADOS -> Ir direto para Insumos / Produtos
        SingleKpiCard(
            title = "PRODUTOS CADASTRADOS",
            value = produtosCadastradosVal,
            subtitle = "Fórmulas e receitas base",
            icon = Icons.Default.Layers,
            iconTint = Color(0xFF2563EB),
            iconBg = Color(0xFFDBEAFE),
            valueColor = Color(0xFF2563EB),
            onClick = onNavigateToInsumos
        )
    }
}

@Composable
fun SingleKpiCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    valueColor: Color = Color.Unspecified,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Color(0xFF3B82F6).copy(alpha = 0.5f)),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(iconBg, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = iconTint,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF475569),
                    letterSpacing = 0.5.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = value,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = valueColor
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = Color(0xFF64748B)
                )
            }
        }
    }
}

@Composable
fun CostChartCard(custos: List<CustoPonto>) {
    var selectedPoint by remember { mutableStateOf<CustoPonto?>(null) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Evolução de Custos (Última Semana)", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(
                        selectedPoint?.let { "${it.dia}: R$ %.2f".format(Locale.getDefault(), it.valor) } ?: "Toque na barra para ver o valor",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.Bottom
            ) {
                custos.forEach { ponto ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { selectedPoint = ponto }
                    ) {
                        val maxVal = custos.maxOfOrNull { it.valor }?.takeIf { it > 0f } ?: 1f
                        val rawFraction = if (maxVal > 0f) ponto.valor / maxVal else 0.1f
                        val heightFraction = if (rawFraction.isNaN()) 0.1f else rawFraction.coerceIn(0.1f, 1.0f)
                        Box(
                            modifier = Modifier
                                .fillMaxHeight(heightFraction)
                                .width(20.dp)
                                .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                .background(if (selectedPoint == ponto) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(ponto.dia, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
fun InsumosCriticosSection(
    insumos: List<InsumoCritico>,
    onVerTodos: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = if (insumos.isEmpty()) Color(0xFFF0FDF4) else Color(0xFFFEF2F2)),
        border = BorderStroke(1.dp, if (insumos.isEmpty()) Color(0xFF86EFAC) else Color(0xFFFCA5A5))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (insumos.isEmpty()) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = null,
                        tint = if (insumos.isEmpty()) Color(0xFF166534) else Color(0xFFDC2626),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Insumos em Baixo Estoque",
                        fontWeight = FontWeight.Bold,
                        color = if (insumos.isEmpty()) Color(0xFF166534) else Color(0xFF991B1B),
                        fontSize = 16.sp
                    )
                }
                TextButton(onClick = onVerTodos) {
                    Text("Gerenciar", color = if (insumos.isEmpty()) Color(0xFF166534) else Color(0xFFDC2626), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            if (insumos.isEmpty()) {
                Text(
                    text = "Nenhum insumo em nível crítico de estoque.",
                    color = Color(0xFF15803D),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            } else {
                insumos.take(4).forEachIndexed { index, insumo ->
                    InsumoCriticoItem(insumo = insumo)
                    if (index < insumos.size - 1) {
                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 8.dp),
                            color = Color(0xFFFCA5A5).copy(alpha = 0.5f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun InsumoCriticoItem(insumo: InsumoCritico) {
    val rawProgress = if (insumo.estoqueMinimo > 0.0) insumo.estoqueAtual / insumo.estoqueMinimo else 0.0
    val progress = if (rawProgress.isNaN()) 0f else rawProgress.coerceIn(0.0, 1.0).toFloat()

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(insumo.nome, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color(0xFF7F1D1D))
                Text(insumo.categoria, fontSize = 11.sp, color = Color(0xFF991B1B).copy(alpha = 0.8f))
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${insumo.estoqueAtual} / Mín: ${insumo.estoqueMinimo} ${insumo.unidade}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Color(0xFFDC2626)
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = Color(0xFFEF4444),
            trackColor = Color(0xFFFEE2E2)
        )
    }
}

@Composable
fun RecentOrcamentosSection(
    orcamentos: List<OrcamentoResumo>,
    onVerTodos: () -> Unit
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Orçamentos Recentes", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            TextButton(onClick = onVerTodos) {
                Text("Ver todos", fontSize = 13.sp)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (orcamentos.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            ) {
                Text(
                    text = "Nenhum orçamento cadastrado no momento.",
                    color = Color.Gray,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(16.dp)
                )
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                orcamentos.forEach { orcamento ->
                    OrcamentoResumoCard(orcamento = orcamento)
                }
            }
        }
    }
}

@Composable
fun OrcamentoResumoCard(orcamento: OrcamentoResumo) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("#${orcamento.id}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(orcamento.data, fontSize = 12.sp, color = Color.Gray)
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(orcamento.titulo, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(orcamento.cliente, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "R$ %.2f".format(Locale.getDefault(), orcamento.valor),
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                DashboardStatusChip(status = orcamento.status)
            }
        }
    }
}

@Composable
fun DashboardStatusChip(status: String) {
    val (bgColor, textColor, label) = when (status) {
        "APROVADO" -> Triple(Color(0xFFD1FAE5), Color(0xFF065F46), "Aprovado")
        "PENDENTE" -> Triple(Color(0xFFFEF3C7), Color(0xFF92400E), "Pendente")
        else -> Triple(Color(0xFFF3F4F6), Color(0xFF374151), "Rascunho")
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
        )
    }
}

@Composable
fun UserCompanyCard(
    usuario: UsuarioDTO?,
    empresa: EmpresaDTO?,
    activeSchema: String,
    onTrocarEmpresa: (UsuarioVinculoEmpresaDTO) -> Unit,
    onLogout: () -> Unit
) {
    var showEmpresasMenu by remember { mutableStateOf(false) }
    val empresasVinculadas = usuario?.empresas ?: emptyList()

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Business,
                        contentDescription = "Empresa",
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = empresa?.nomeFantasia ?: "Empresa (${activeSchema.ifBlank { "Padrão" }})",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Text(
                            text = usuario?.email ?: "Usuário Conectado",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                        )
                    }
                }

                // Botão de Logout
                IconButton(onClick = onLogout) {
                    Icon(
                        imageVector = Icons.Default.ExitToApp,
                        contentDescription = "Sair da conta",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            if (empresasVinculadas.size > 1) {
                Spacer(modifier = Modifier.height(12.dp))
                Box {
                    OutlinedButton(
                        onClick = { showEmpresasMenu = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Empresa Ativa: ${empresasVinculadas.find { it.schemaName == activeSchema }?.empresaNome ?: activeSchema}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                        }
                    }

                    DropdownMenu(
                        expanded = showEmpresasMenu,
                        onDismissRequest = { showEmpresasMenu = false }
                    ) {
                        empresasVinculadas.forEach { vinculo ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(
                                            text = vinculo.empresaNome,
                                            fontWeight = if (vinculo.schemaName == activeSchema) FontWeight.Bold else FontWeight.Normal
                                        )
                                        Text(
                                            text = "Perfil: ${vinculo.perfilNome} | Schema: ${vinculo.schemaName}",
                                            fontSize = 11.sp,
                                            color = Color.Gray
                                        )
                                    }
                                },
                                onClick = {
                                    showEmpresasMenu = false
                                    onTrocarEmpresa(vinculo)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
