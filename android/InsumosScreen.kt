@Composable
fun InsumosScreen(viewModel: InsumosViewModel = hiltViewModel()) {
    val insumos by viewModel.insumos.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var filtroTipo by remember { mutableStateOf("Todos") }

    val filteredInsumos = insumos.filter {
        (it.nome.contains(searchQuery, ignoreCase = true)) &&
        (filtroTipo == "Todos" || it.tipo.name == filtroTipo)
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Gestão de Insumos") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* Novo Insumo */ }) {
                Icon(Icons.Default.Add, contentDescription = "Novo Insumo")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Search + Filter
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    label = { Text("Buscar insumo") },
                    modifier = Modifier.weight(1f),
                    leadingIcon = { Icon(Icons.Default.Search, null) }
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Filtro Tipo
                ExposedDropdownMenuBox(...) // ou Simple Dropdown
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
        elevation = CardDefaults.cardElevation(6.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isLowStock) Color(0xFFFFF3E0) else Color.White
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(text = insumo.nome, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text(
                    text = insumo.tipo.name,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (insumo.tipo == Tipo.MP) Color(0xFF8B5CF6) else Color(0xFFD97706)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text("R$ ${insumo.precoUltCompra.format(2)}", fontWeight = FontWeight.SemiBold)
                    Text("Últ. Compra", style = MaterialTheme.typography.bodySmall)
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
                    Icon(Icons.Default.Warning, contentDescription = null, tint = Color.Red)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Estoque Baixo!", color = Color.Red, fontWeight = FontWeight.Medium)
                }
            }

            Row(modifier = Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { /* Editar */ }) { Text("Editar") }
                TextButton(onClick = { /* Excluir */ }, colors = ButtonDefaults.textButtonColors(contentColor = Color.Red)) {
                    Text("Excluir")
                }
            }
        }
    }
}