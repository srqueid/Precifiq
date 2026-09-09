import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrcamentoDetalhesScreen(
    orcamentoId: Int,
    onVoltar: () -> Unit = {},
    onConverterParaCompra: () -> Unit = {}
) {
    val orcamento = remember { Orcamento(orcamentoId, "Mesa Madeira Maciça", "21/05/2026", Status.APROVADO, 3450.0) }
    val itens = remember {
        listOf(
            ItemOrcamento(1, 1, "MDF 15mm 2.75x1.85m", "MDF 15mm", 3, "chapas", 180.0, 540.0),
            ItemOrcamento(2, 2, "Cola de Contato 2.8kg", "Cola Contato", 1, "galões", 45.0, 45.0)
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Orçamento #${orcamentoId}") },
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
        ) {
            // Cabeçalho
            Card(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Text("Orçamento #${orcamentoId}", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    Text(orcamento.titulo, color = Color.White.copy(alpha = 0.9f))
                    
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total", color = Color.White.copy(alpha = 0.8f))
                        Text(
                            "R$ ${orcamento.total.format(2)}",
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            InfoRow(title = "Cliente / Projeto", value = "Produção Interna")
            InfoRow(title = "Data", value = "21/05/2026")
            InfoRow(title = "Validade", value = "20/06/2026")

            Text(
                "Itens do Orçamento",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )

            LazyColumn(modifier = Modifier.height(300.dp)) {
                items(itens) { item ->
                    ItemOrcamentoRow(item)
                }
            }

            if (orcamento.status == Status.APROVADO) {
                Button(
                    onClick = onConverterParaCompra,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    contentPadding = PaddingValues(16.dp)
                ) {
                    Text("Converter em Pedido de Compra", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun InfoRow(title: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(title, color = Color.Gray, fontSize = 14.sp)
        Text(value, fontWeight = FontWeight.Medium, fontSize = 14.sp)
    }
}

@Composable
fun ItemOrcamentoRow(item: ItemOrcamento) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(item.insumo.ifEmpty { item.insumoNome }, fontWeight = FontWeight.Medium)
                Text("${item.quantidade} ${item.unidade}", color = Color.Gray)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("R$ ${item.precoUnitario.format(2)}", fontWeight = FontWeight.SemiBold)
                Text("R$ ${(item.quantidade * item.precoUnitario).format(2)}", color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
