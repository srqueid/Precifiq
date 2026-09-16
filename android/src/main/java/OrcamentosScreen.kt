import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
fun OrcamentosScreen(
    viewModel: OrcamentosViewModel = hiltViewModel(),
    onVoltar: () -> Unit = {},
    onNovoOrcamento: () -> Unit = {},
    onVerDetalhes: (Int) -> Unit = {}
) {
    val orcamentos by viewModel.orcamentos.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val userMessage by viewModel.userMessage.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Orçamentos & Vendas", color = Color.White) },
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.carregarOrcamentos() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Atualizar", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.primary)
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNovoOrcamento) {
                Icon(Icons.Default.Add, contentDescription = "Novo Orçamento")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            userMessage?.let { msg ->
                Surface(
                    color = if (msg.contains("sucesso", ignoreCase = true)) Color(0xFFD1FAE5) else Color(0xFFFEE2E2),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = msg,
                            color = if (msg.contains("sucesso", ignoreCase = true)) Color(0xFF065F46) else Color(0xFF991B1B),
                            fontSize = 13.sp,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = { viewModel.limparMensagem() }) {
                            Icon(Icons.Default.Close, contentDescription = "Fechar")
                        }
                    }
                }
            }

            if (isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            if (orcamentos.isEmpty() && !isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Nenhum orçamento encontrado. Clique no botão + para criar um novo.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color.Gray
                    )
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(orcamentos) { item ->
                        OrcamentoCard(
                            orcamento = item,
                            onVerDetalhes = { onVerDetalhes(item.id) },
                            onConverterCompra = { viewModel.converterParaCompra(item.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun OrcamentoCard(
    orcamento: Orcamento,
    onVerDetalhes: () -> Unit,
    onConverterCompra: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Orçamento #${orcamento.id}", fontWeight = FontWeight.Bold)
                Text(orcamento.data, color = Color.Gray, fontSize = 14.sp)
            }

            Text(orcamento.titulo, modifier = Modifier.padding(vertical = 8.dp), fontWeight = FontWeight.SemiBold)

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusChip(status = orcamento.status)
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    "R$ ${orcamento.total.format(2)}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onVerDetalhes) {
                    Text("Detalhes")
                }
                
                Button(
                    onClick = onConverterCompra,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Text("Converter em Compra")
                }
            }
        }
    }
}
