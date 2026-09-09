import androidx.compose.animation.animateContentSize
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

// Models de dados para visualização do Dashboard
data class DashboardKPIData(
    val title: String,
    val value: String,
    val trendText: String,
    val isPositiveTrend: Boolean,
    val icon: ImageVector,
    val accentColor: Color
)

data class OrcamentoResumo(
    val id: Int,
    val titulo: String,
    val cliente: String,
    val valor: Double,
    val status: String, // "APROVADO", "PENDENTE", "RASCUNHO"
    val data: String
)

data class InsumoCritico(
    val id: Int,
    val nome: String,
    val categoria: String,
    val estoqueAtual: Double,
    val estoqueMinimo: Double,
    val unidade: String
)

data class CustoPonto(
    val dia: String,
    val valor: Float
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToOrcamentos: () -> Unit = {},
    onNavigateToNovoOrcamento: () -> Unit = {},
    onNavigateToInsumos: () -> Unit = {},
    onNavigateToFornecedores: () -> Unit = {}
) {
    // Dados de exemplo para o Dashboard
    val kpis = remember {
        listOf(
            DashboardKPIData(
                title = "Valor em Estoque",
                value = "R$ 8.942,50",
                trendText = "+5.2% este mês",
                isPositiveTrend = true,
                icon = Icons.Default.Inventory,
                accentColor = Color(0xFF2563EB)
            ),
            DashboardKPIData(
                title = "Orçamentos Aprovados",
                value = "14",
                trendText = "+3 nesta semana",
                isPositiveTrend = true,
                icon = Icons.Default.CheckCircle,
                accentColor = Color(0xFF10B981)
            ),
            DashboardKPIData(
                title = "Compras em Andamento",
                value = "7",
                trendText = "2 aguardando entrega",
                isPositiveTrend = true,
                icon = Icons.Default.ShoppingCart,
                accentColor = Color(0xFFF59E0B)
            ),
            DashboardKPIData(
                title = "Insumos Críticos",
                value = "9",
                trendText = "Abaixo do estoque mín.",
                isPositiveTrend = false,
                icon = Icons.Default.Warning,
                accentColor = Color(0xFFEF4444)
            )
        )
    }

    val custosSemana = remember {
        listOf(
            CustoPonto("Seg", 1200f),
            CustoPonto("Ter", 850f),
            CustoPonto("Qua", 2100f),
            CustoPonto("Qui", 1600f),
            CustoPonto("Sex", 2900f),
            CustoPonto("Sáb", 450f),
            CustoPonto("Dom", 200f)
        )
    }

    val orcamentosRecentes = remember {
        listOf(
            OrcamentoResumo(104, "Mesa de Jantar Madeira Maciça", "Cliente João Silva", 3450.00, "APROVADO", "08/09/2026"),
            OrcamentoResumo(103, "Conjunto de Armários Embutidos", "Arquitetura & Design Ltda", 8900.00, "PENDENTE", "07/09/2026"),
            OrcamentoResumo(102, "Prateleiras Industriais Aço", "Oficina Mecânica Central", 1850.50, "RASCUNHO", "05/09/2026")
        )
    }

    val insumosCriticos = remember {
        listOf(
            InsumoCritico(1, "MDF Cru 15mm 2.75x1.85m", "Matéria Prima", 3.0, 10.0, "chapas"),
            InsumoCritico(2, "Cola de Contato 2.8kg", "Consumíveis", 1.0, 5.0, "galões"),
            InsumoCritico(3, "Parafuso Chipboard 4x40mm", "Ferragens", 150.0, 500.0, "unid"),
            InsumoCritico(4, "Verniz PU Fosco 3.6L", "Acabamento", 0.5, 3.0, "galões")
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Dashboard", fontWeight = FontWeight.Bold, fontSize = 20.sp)
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
            // Seção 1: Quick Actions (Ações Rápidas)
            item {
                QuickActionsSection(
                    onNovoOrcamento = onNavigateToNovoOrcamento,
                    onVerOrcamentos = onNavigateToOrcamentos,
                    onInsumos = onNavigateToInsumos,
                    onFornecedores = onNavigateToFornecedores
                )
            }

            // Seção 2: Cards de KPIs Principais
            item {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Indicadores Principais",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        TextButton(onClick = { /* Atualizar dados */ }) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Atualizado", fontSize = 12.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(vertical = 4.dp)
                    ) {
                        items(kpis) { kpi ->
                            KPICardItem(kpi = kpi)
                        }
                    }
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
    onNovoOrcamento: () -> Unit,
    onVerOrcamentos: () -> Unit,
    onInsumos: () -> Unit,
    onFornecedores: () -> Unit
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
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                QuickActionButton(
                    label = "Novo Orçamento",
                    icon = Icons.Default.AddCircle,
                    color = MaterialTheme.colorScheme.primary,
                    onClick = onNovoOrcamento
                )
                QuickActionButton(
                    label = "Orçamentos",
                    icon = Icons.Default.ReceiptLong,
                    color = Color(0xFF10B981),
                    onClick = onVerOrcamentos
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
                    color = Color(0xFFF59E0B),
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
fun KPICardItem(kpi: DashboardKPIData) {
    Card(
        modifier = Modifier.width(180.dp),
        elevation = CardDefaults.cardElevation(4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(kpi.accentColor.copy(alpha = 0.15f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(kpi.icon, contentDescription = null, tint = kpi.accentColor, modifier = Modifier.size(20.dp))
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(kpi.title, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(kpi.value, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                kpi.trendText,
                fontSize = 11.sp,
                color = if (kpi.isPositiveTrend) Color(0xFF10B981) else Color(0xFFEF4444),
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
fun CostChartCard(custos: List<CustoPonto>) {
    var selectedPoint by remember { mutableStateOf<CustoPonto?>(null) }
    val maxValor = remember(custos) { custos.maxOfOrNull { it.valor } ?: 1f }

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
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Text(
                        "Total: R$ %.2f".format(Locale.getDefault(), custos.sumOf { it.valor.toDouble() }),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Gráfico em formato de colunas Compose Nativo
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                custos.forEach { ponto ->
                    val ratio = (ponto.valor / maxValor).coerceIn(0.05f, 1.0f)
                    val isSelected = selectedPoint?.dia == ponto.dia

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { selectedPoint = if (isSelected) null else ponto }
                    ) {
                        Box(
                            modifier = Modifier
                                .width(20.dp)
                                .fillMaxHeight(ratio)
                                .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                                .background(
                                    if (isSelected) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary
                                )
                                .animateContentSize()
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = ponto.dia,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
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
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFFCA5A5)))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFEF4444))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Insumos em Baixo Estoque",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = Color(0xFF991B1B)
                    )
                }
                TextButton(onClick = onVerTodos) {
                    Text("Gerenciar", color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            insumos.forEachIndexed { index, insumo ->
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

@Composable
fun InsumoCriticoItem(insumo: InsumoCritico) {
    val progress = (insumo.estoqueAtual / insumo.estoqueMinimo).coerceIn(0.0, 1.0).toFloat()

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

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            orcamentos.forEach { orcamento ->
                OrcamentoResumoCard(orcamento = orcamento)
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
