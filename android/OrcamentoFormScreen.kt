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
    viewModel: OrcamentoFormViewModel = hiltViewModel()
) {
    val formState by viewModel.formState.collectAsState()
    val itens by viewModel.itens.collectAsState()
    val total by viewModel.total.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (orcamentoId == null) "Novo Orçamento" else "Editar Orçamento") }
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
                .padding(16.dp)
        ) {
            OutlinedTextField(
                value = formState.titulo,
                onValueChange = { viewModel.updateTitulo(it) },
                label = { Text("Título do Orçamento") },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = formState.cliente,
                onValueChange = { viewModel.updateCliente(it) },
                label = { Text("Cliente / Projeto") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
            )

            Text("Itens", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(top = 16.dp))

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
            ) {
                items(itens) { item ->
                    ItemOrcamentoEditable(
                        item = item,
                        onUpdate = viewModel::updateItem,
                        onDelete = viewModel::removerItem
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Row(
                    modifier = Modifier.padding(20.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Total do Orçamento", fontSize = 18.sp)
                    Text(
                        "R$ ${total.format(2)}",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = { /* Salvar Rascunho */ },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Gray)
                ) {
                    Text("Salvar Rascunho")
                }
                Button(
                    onClick = { viewModel.salvarEEnviarAprovacao() },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Salvar e Enviar")
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
                label = { Text("Insumo") },
                modifier = Modifier.fillMaxWidth()
            )

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
                    label = { Text("Preço Unit.") },
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Subtotal: R$ ${(item.quantidade * item.precoUnitario).format(2)}",
                    fontWeight = FontWeight.Medium
                )
                IconButton(onClick = { onDelete(item.id) }) {
                    Icon(Icons.Default.Delete, contentDescription = "Remover", tint = Color.Red)
                }
            }
        }
    }
}
