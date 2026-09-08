@Composable
fun OrcamentoFormScreen(
    orcamentoId: Int? = null, // null = novo
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
            // Dados Gerais
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

            // Lista de Itens
            Text("Itens", fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(top = 16.dp))

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(420.dp)
            ) {
                items(itens) { item ->
                    ItemOrcamentoEditable(
                        item = item,
                        onUpdate = viewModel::updateItem,
                        onDelete = viewModel::removerItem
                    )
                }
            }

            // Total
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

            // Botões de Ação
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
                    Text("Salvar e Enviar para Aprovação")
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