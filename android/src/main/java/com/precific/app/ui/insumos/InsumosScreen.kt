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
import com.precific.app.domain.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InsumosScreen(
    viewModel: InsumosViewModel = hiltViewModel(),
    onVoltar: () -> Unit = {}
) {
    val insumos by viewModel.insumos.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    val filteredInsumos = insumos.filter {
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                )
            }

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
