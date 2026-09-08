@Composable
fun OrcamentoDetalhesScreen(
    orcamentoId: Int,
    onVoltar: () -> Unit,
    onConverterParaCompra: () -> Unit
) {
    val orcamento = remember { /* buscar do ViewModel */ }

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

            // Informações
            InfoSection(title = "Cliente/Projeto", value = "Produção Interna")
            InfoSection(title = "Data", value = "21/05/2026")
            InfoSection(title = "Validade", value = "20/06/2026")

            // Itens
            Text(
                "Itens do Orçamento",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )

            LazyColumn(modifier = Modifier.height(400.dp)) {
                items(itens) { item ->
                    ItemOrcamentoRow(item)
                }
            }

            // Botão de Conversão
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
                Text(item.insumo, fontWeight = FontWeight.Medium)
                Text("${item.quantidade} ${item.unidade}", color = Color.Gray)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("R$ ${item.precoUnitario.format(2)}", fontWeight = FontWeight.SemiBold)
                Text("R$ ${(item.subtotal/1000).format(2)}", color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}