@Composable
fun OrcamentosScreen(
    viewModel: OrcamentosViewModel = hiltViewModel()
) {
    val orcamentos by viewModel.orcamentos.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Orçamentos & Compras") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.primary)
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* Novo Orçamento */ }) {
                Icon(Icons.Default.Add, contentDescription = "Novo")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Cards de Resumo
            LazyRow(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Adicionar cards de resumo aqui
            }

            // Tabela / Lista
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(orcamentos) { item ->
                    OrcamentoCard(
                        orcamento = item,
                        onVerDetalhes = { /* navegar */ },
                        onConverterCompra = { if (item.status == Status.APROVADO) /* converter */ }
                    )
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

            Text(orcamento.titulo, modifier = Modifier.padding(vertical = 8.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusChip(status = orcamento.status)
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    "R$ ${orcamento.total.format(2)}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 18.sp
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onVerDetalhes) {
                    Text("Detalhes")
                }
                if (orcamento.status == Status.APROVADO) {
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
}