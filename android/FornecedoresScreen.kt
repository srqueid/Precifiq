@Composable
fun FornecedoresScreen(
    viewModel: FornecedoresViewModel = hiltViewModel()
) {
    val fornecedores by viewModel.fornecedores.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    val filteredFornecedores = fornecedores.filter {
        it.razaoSocial.contains(searchQuery, ignoreCase = true) ||
        it.nomeFantasia.contains(searchQuery, ignoreCase = true)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Fornecedores") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = Color.White
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* Abrir tela de cadastro */ }) {
                Icon(Icons.Default.Add, contentDescription = "Novo Fornecedor")
            }
        }
    ) { paddingValues ->
        Column(modifier = Modifier.padding(paddingValues)) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Buscar fornecedor...") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
            )

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredFornecedores) { fornecedor ->
                    FornecedorCard(fornecedor = fornecedor)
                }
            }
        }
    }
}

@Composable
fun FornecedorCard(fornecedor: Fornecedor) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(6.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "#${fornecedor.id} - ${fornecedor.razaoSocial}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Text(
                        text = fornecedor.nomeFantasia,
                        color = Color.Gray
                    )
                }
                Text(
                    text = fornecedor.cidadeUf,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Email, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(fornecedor.email, color = Color.DarkGray)
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(fornecedor.telefone, color = Color.DarkGray)
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = { /* Editar */ }) {
                    Text("Editar")
                }
                TextButton(
                    onClick = { /* Excluir */ },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color.Red)
                ) {
                    Text("Excluir")
                }
            }
        }
    }
}