package com.precific.app.ui.insumos

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.precific.app.data.network.ProdutoFinalDTO
import com.precific.app.domain.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InsumosScreen(
    viewModel: InsumosViewModel = hiltViewModel(),
    onVoltar: () -> Unit = {}
) {
    val insumos by viewModel.insumos.collectAsState()
    val produtosEKits by viewModel.produtosEKits.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) } // 0 = Insumos, 1 = Produtos & Kits
    var searchQuery by remember { mutableStateOf("") }

    val filteredInsumos = insumos.filter {
        it.nome.contains(searchQuery, ignoreCase = true) ||
        (!it.codigoBarras.isNullOrBlank() && it.codigoBarras.contains(searchQuery, ignoreCase = true))
    }

    val filteredProdutos = produtosEKits.filter {
        it.nomeExibicao.contains(searchQuery, ignoreCase = true) ||
        (!it.descricao.isNullOrBlank() && it.descricao.contains(searchQuery, ignoreCase = true))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Catálogo de Insumos e Produtos") },
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.carregarInsumosEProdutos() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Atualizar Catálogo")
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Tabs de Alternância entre Insumos x Produtos Finais & Kits
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Insumos (${insumos.size})", fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                    icon = { Icon(Icons.Default.Category, contentDescription = null, modifier = Modifier.size(18.dp)) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Produtos & Kits (${produtosEKits.size})", fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                    icon = { Icon(Icons.Default.Layers, contentDescription = null, modifier = Modifier.size(18.dp)) }
                )
            }

            // Search Bar
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    label = { Text(if (selectedTab == 0) "Buscar insumo ou cód. barras" else "Buscar produto ou kit") },
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
            }

            if (isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            if (selectedTab == 0) {
                // Lista de Insumos da Web
                if (filteredInsumos.isEmpty() && !isLoading) {
                    Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("Nenhum insumo encontrado para este filtro.", color = Color.Gray)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredInsumos) { insumo ->
                            InsumoCard(insumo = insumo)
                        }
                    }
                }
            } else {
                // Lista de Produtos Finais e Kits da Web
                if (filteredProdutos.isEmpty() && !isLoading) {
                    Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("Nenhum produto final ou kit cadastrado na Web.", color = Color.Gray)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredProdutos) { produto ->
                            ProdutoFinalCard(
                                produto = produto,
                                onAjustarEstoque = { novoSaldo ->
                                    viewModel.ajustarEstoqueProduto(produto.id, novoSaldo)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun InsumoCard(insumo: Insumo) {
    val isLowStock = insumo.estoqueAtual < insumo.estoqueMinimo

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(4.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isLowStock) Color(0xFFFFF7ED) else Color.White
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(text = insumo.nome, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    text = insumo.tipo.name,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (insumo.tipo == Tipo.MP) Color(0xFF8B5CF6) else Color(0xFFD97706)
                )
            }

            // Badges de Rastreabilidade (Código de Barras, Lote e Validade)
            if (!insumo.codigoBarras.isNullOrBlank() || !insumo.dataValidade.isNullOrBlank()) {
                Row(
                    modifier = Modifier.padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (!insumo.codigoBarras.isNullOrBlank()) {
                        Surface(
                            color = Color(0xFFF1F5F9),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "EAN: ${insumo.codigoBarras}",
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                color = Color(0xFF475569),
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                    if (!insumo.dataValidade.isNullOrBlank()) {
                        Surface(
                            color = Color(0xFFFEF3C7),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "Val: ${insumo.dataValidade}",
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                color = Color(0xFF92400E),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text("R$ ${insumo.precoUltCompra.format(2)}", fontWeight = FontWeight.SemiBold)
                    Text("Custo Unit.", style = MaterialTheme.typography.bodySmall)
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "${insumo.estoqueAtual} ${insumo.unidade}",
                        fontWeight = FontWeight.Bold,
                        color = if (isLowStock) Color.Red else Color.Black
                    )
                    Text("Mín: ${insumo.estoqueMinimo}", style = MaterialTheme.typography.bodySmall)
                }
            }

            if (isLowStock) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = Color.Red, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Abaixo do estoque mínimo", color = Color.Red, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
fun ProdutoFinalCard(
    produto: ProdutoFinalDTO,
    onAjustarEstoque: (novoEstoque: Double) -> Unit = {}
) {
    var showDialogAjuste by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(3.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = produto.nomeExibicao,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.weight(1f)
                )

                Surface(
                    color = if (produto.tipo == "KIT") Color(0xFFFEF3C7) else Color(0xFFDBEAFE),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = if (produto.tipo == "KIT") "📦 KIT" else "🏷️ PRODUTO",
                        color = if (produto.tipo == "KIT") Color(0xFF92400E) else Color(0xFF1E40AF),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            if (!produto.descricao.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = produto.descricao,
                    fontSize = 12.sp,
                    color = Color.DarkGray
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Linha de Preço & Custo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Preço de Venda", fontSize = 11.sp, color = Color.Gray)
                    Text(
                        text = "R$ ${produto.precoFinal.format(2)}",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        color = Color(0xFF10B981)
                    )
                }

                if (produto.custoCalculado > 0) {
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Custo Estimado", fontSize = 11.sp, color = Color.Gray)
                        Text(
                            text = "R$ ${produto.custoCalculado.format(2)}",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))

            // Linha de Saldo de Estoque & Ação de Ajuste
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Inventory2,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Column {
                        Text("Estoque em Saldo", fontSize = 11.sp, color = Color.Gray)
                        Text(
                            text = "${produto.estoque.toInt()} unid",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = if (produto.estoque <= 0) Color(0xFFDC2626) else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }

                OutlinedButton(
                    onClick = { showDialogAjuste = true },
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Tune, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Ajustar Saldo", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    if (showDialogAjuste) {
        AjustarEstoqueProdutoDialog(
            produto = produto,
            onDismiss = { showDialogAjuste = false },
            onConfirm = { novoSaldo ->
                showDialogAjuste = false
                onAjustarEstoque(novoSaldo)
            }
        )
    }
}

@Composable
fun AjustarEstoqueProdutoDialog(
    produto: ProdutoFinalDTO,
    onDismiss: () -> Unit,
    onConfirm: (novoSaldo: Double) -> Unit
) {
    var estoqueStr by remember { mutableStateOf(produto.estoque.toInt().toString()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Inventory, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Ajustar Saldo de Estoque", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = produto.nomeExibicao,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
                Text(
                    text = "Saldo Atual: ${produto.estoque.toInt()} unid",
                    fontSize = 12.sp,
                    color = Color.Gray
                )

                OutlinedTextField(
                    value = estoqueStr,
                    onValueChange = { estoqueStr = it },
                    label = { Text("Novo Saldo de Estoque") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedButton(
                        onClick = {
                            val cur = estoqueStr.toIntOrNull() ?: 0
                            if (cur > 0) estoqueStr = (cur - 1).toString()
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("- 1")
                    }

                    OutlinedButton(
                        onClick = {
                            val cur = estoqueStr.toIntOrNull() ?: 0
                            estoqueStr = (cur + 1).toString()
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("+ 1")
                    }

                    OutlinedButton(
                        onClick = {
                            val cur = estoqueStr.toIntOrNull() ?: 0
                            estoqueStr = (cur + 10).toString()
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("+ 10")
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val novo = estoqueStr.toDoubleOrNull() ?: 0.0
                    onConfirm(novo)
                }
            ) {
                Text("Salvar Saldo")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}
