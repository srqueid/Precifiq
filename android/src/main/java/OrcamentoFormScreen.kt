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
fun OrcamentoFormScreen(
    orcamentoId: Int? = null,
    viewModel: OrcamentoFormViewModel = hiltViewModel(),
    onVoltar: () -> Unit = {},
    onSalvoSucesso: () -> Unit = {}
) {
    val formState by viewModel.formState.collectAsState()
    val itens by viewModel.itens.collectAsState()
    val total by viewModel.total.collectAsState()
    val isSaving by viewModel.isSaving.collectAsState()
    val saveMessage by viewModel.saveMessage.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (orcamentoId == null) "Novo Orçamento" else "Editar Orçamento") },
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.adicionarItem() }) {
                Icon(Icons.Default.Add, "Adicionar Insumo")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            saveMessage?.let { msg ->
                Surface(
                    color = if (msg.contains("sucesso", ignoreCase = true)) Color(0xFFD1FAE5) else Color(0xFFFEE2E2),
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = msg,
                        color = if (msg.contains("sucesso", ignoreCase = true)) Color(0xFF065F46) else Color(0xFF991B1B),
                        modifier = Modifier.padding(12.dp),
                        fontSize = 13.sp
                    )
                }
            }

            OutlinedTextField(
                value = formState.titulo,
                onValueChange = { viewModel.updateTitulo(it) },
                label = { Text("Título do Orçamento") },
                placeholder = { Text("Ex: Orçamento de Produção") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = formState.cliente,
                onValueChange = { viewModel.updateCliente(it) },
                label = { Text("Cliente / Projeto") },
                placeholder = { Text("Ex: Cliente João Silva") },
                modifier = Modifier.fillMaxWidth()
            )

            Text("Itens do Orçamento", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(top = 8.dp))

            if (itens.isEmpty()) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                ) {
                    Text(
                        "Nenhum item adicionado. Clique no botão + abaixo para adicionar um insumo.",
                        modifier = Modifier.padding(16.dp),
                        color = Color.Gray,
                        fontSize = 13.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                ) {
                    items(itens) { item ->
                        ItemOrcamentoEditable(
                            item = item,
                            onUpdate = viewModel::updateItem,
                            onDelete = viewModel::removerItem
                        )
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Row(
                    modifier = Modifier.padding(20.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Total Estimado", fontSize = 18.sp, fontWeight = FontWeight.Medium)
                    Text(
                        "R$ ${total.format(2)}",
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Button(
                onClick = {
                    viewModel.salvarEEnviarAprovacao(onSuccess = onSalvoSucesso)
                },
                enabled = !isSaving,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (isSaving) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("SALVAR E REGISTRAR ORÇAMENTO", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun ItemOrcamentoEditable(
    item: ItemOrcamento,
    onUpdate: (ItemOrcamento) -> Unit,
    onDelete: (Int) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            OutlinedTextField(
                value = item.insumoNome,
                onValueChange = { onUpdate(item.copy(insumoNome = it)) },
                label = { Text("Nome do Insumo / Produto") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = item.quantidade.toString(),
                    onValueChange = { onUpdate(item.copy(quantidade = it.toIntOrNull() ?: 1)) },
                    label = { Text("Qtd") },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = item.precoUnitario.toString(),
                    onValueChange = { onUpdate(item.copy(precoUnitario = it.toDoubleOrNull() ?: 0.0)) },
                    label = { Text("Preço Unit. (R$)") },
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Subtotal: R$ ${(item.quantidade * item.precoUnitario).format(2)}",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                IconButton(onClick = { onDelete(item.id) }) {
                    Icon(Icons.Default.Delete, contentDescription = "Remover", tint = Color.Red)
                }
            }
        }
    }
}
