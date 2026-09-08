@Composable
fun DashboardScreen() {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dashboard") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.primary)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // KPI Cards
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(4) {
                        KPICard(
                            title = when (it) {
                                0 -> "Valor em Estoque"
                                1 -> "Orçamentos Aprovados"
                                2 -> "Compras em Andamento"
                                else -> "Insumos Críticos"
                            },
                            value = when (it) {
                                0 -> "R$ 8.942"
                                1 -> "14"
                                2 -> "7"
                                else -> "9"
                            },
                            icon = when (it) {
                                0 -> Icons.Default.Inventory
                                1 -> Icons.Default.AttachMoney
                                2 -> Icons.Default.ShoppingCart
                                else -> Icons.Default.Warning
                            },
                            color = when (it) {
                                3 -> Color.Red
                                else -> MaterialTheme.colorScheme.primary
                            }
                        )
                    }
                }
            }

            // Gráfico
            item {
                Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(8.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Evolução de Custos (30 dias)", fontWeight = FontWeight.Bold)
                        // Substitua por AndroidView com MPAndroidChart ou Compose Chart
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                                .background(Color.LightGray, RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Gráfico aqui", color = Color.Gray)
                        }
                    }
                }
            }

            // Orçamentos Recentes
            item {
                Text("Orçamentos Recentes", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(modifier = Modifier.height(8.dp))
                // Lista de cards de orçamentos
            }

            // Insumos Críticos
            item {
                Text("Insumos em Baixo Estoque", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.Red)
                // LazyRow ou LazyColumn com itens críticos
            }
        }
    }
}

@Composable
fun KPICard(title: String, value: String, icon: ImageVector, color: Color) {
    Card(
        modifier = Modifier.width(180.dp),
        elevation = CardDefaults.cardElevation(6.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(32.dp))
            Spacer(modifier = Modifier.height(12.dp))
            Text(title, fontSize = 14.sp, color = Color.Gray)
            Text(value, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        }
    }
}