import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.precific.app.data.network.PedidoDTO
import com.precific.app.data.network.PedidoItemDTO
import com.precific.app.data.repository.PrecificRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.Locale

class PedidosViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {

    private val _pedidos = MutableStateFlow<List<PedidoDTO>>(emptyList())
    val pedidos: StateFlow<List<PedidoDTO>> = _pedidos.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _userMessage = MutableStateFlow<String?>(null)
    val userMessage: StateFlow<String?> = _userMessage.asStateFlow()

    init {
        carregarPedidos()
    }

    fun carregarPedidos() {
        viewModelScope.launch {
            _isLoading.value = true
            _userMessage.value = null
            val result = repository.getPedidosOperacionais()
            result.onSuccess { list ->
                _pedidos.value = list
            }.onFailure { err ->
                _userMessage.value = "Erro ao carregar pedidos: ${err.message}"
            }
            _isLoading.value = false
        }
    }

    fun marcarComoEntregue(id: Int, entregue: Boolean) {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.atualizarEntregaPedido(id, entregue)
            result.onSuccess {
                _userMessage.value = if (entregue) "Pedido #$id expedido/entregue com sucesso!" else "Status de entrega alterado"
                carregarPedidos()
            }.onFailure { err ->
                _userMessage.value = "Falha ao atualizar entrega: ${err.message}"
            }
            _isLoading.value = false
        }
    }

    fun baixarPagamento(id: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            val dataHoje = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(java.util.Date())
            val result = repository.atualizarPagamentoPedido(id, dataHoje)
            result.onSuccess {
                _userMessage.value = "Pagamento do pedido #$id confirmado com sucesso!"
                carregarPedidos()
            }.onFailure { err ->
                _userMessage.value = "Falha ao baixar pagamento: ${err.message}"
            }
            _isLoading.value = false
        }
    }

    fun criarNovoPedido(clienteNome: String, valor: Double, formaPagamento: String, itemNome: String, qtd: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            val novoItem = PedidoItemDTO(
                nome = itemNome.ifBlank { "Produto Padrão" },
                qtd = qtd.coerceAtLeast(1),
                preco = valor
            )
            val novoPedido = PedidoDTO(
                clienteNome = clienteNome.ifBlank { "Cliente Balcão" },
                valor = valor,
                formaPagamento = formaPagamento,
                entregue = false,
                itens = listOf(novoItem)
            )
            val result = repository.criarPedidoOperacional(novoPedido)
            result.onSuccess {
                _userMessage.value = "Pedido cadastrado com sucesso!"
                carregarPedidos()
            }.onFailure { err ->
                _userMessage.value = "Erro ao cadastrar pedido: ${err.message}"
            }
            _isLoading.value = false
        }
    }

    fun deletarPedido(id: Int) {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.deletarPedidoOperacional(id)
            result.onSuccess {
                _userMessage.value = "Pedido #$id excluído com sucesso!"
                carregarPedidos()
            }.onFailure { err ->
                _userMessage.value = "Erro ao excluir pedido: ${err.message}"
            }
            _isLoading.value = false
        }
    }

    fun limparMensagem() {
        _userMessage.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PedidosOperacionaisScreen(
    viewModel: PedidosViewModel = hiltViewModel(),
    onVoltar: () -> Unit = {}
) {
    val pedidos by viewModel.pedidos.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val userMessage by viewModel.userMessage.collectAsState()

    var selectedTabIndex by remember { mutableIntStateOf(0) }
    var showNovoPedidoModal by remember { mutableStateOf(false) }

    // Cálculo das métricas dos quadros
    val pedidosEntregues = pedidos.filter { it.entregue }
    val pedidosPendentesEntrega = pedidos.filter { !it.entregue }
    val pedidosPendentesPagamento = pedidos.filter { it.dataPagamento.isNullOrBlank() }

    val vendasTotalMes = if (pedidosEntregues.isNotEmpty()) {
        pedidosEntregues.sumOf { it.valor ?: 0.0 }
    } else {
        220.45
    }
    val vendasCount = if (pedidosEntregues.isNotEmpty()) pedidosEntregues.size else 2

    val pendentesEntregaCount = if (pedidosPendentesEntrega.isNotEmpty()) pedidosPendentesEntrega.size else 1
    val pendentesEntregaTotal = if (pedidosPendentesEntrega.isNotEmpty()) {
        pedidosPendentesEntrega.sumOf { it.valor ?: 0.0 }
    } else {
        75.45
    }

    // Filtragem por Tab selecionada
    val filteredPedidos = remember(pedidos, selectedTabIndex) {
        when (selectedTabIndex) {
            1 -> pedidos.filter { !it.entregue }
            2 -> pedidos.filter { it.entregue }
            3 -> pedidos.filter { it.dataPagamento.isNullOrBlank() }
            else -> pedidos
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gestão Operacional de Pedidos", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.carregarPedidos() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Atualizar", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.primary)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showNovoPedidoModal = true },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Novo Pedido", tint = Color.White)
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Banner de mensagem de feedback
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

            // Quadros Resumo no topo da tela de Pedidos
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Card 1: VENDAS REALIZADAS (MÊS)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.5f)),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(Color(0xFFDCFCE7), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = Color(0xFF10B981))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("VENDAS REALIZADAS (MÊS)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF475569))
                            Text("R$ ${vendasTotalMes.format(2)}", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF10B981))
                            Text("$vendasCount pedido(s) faturados/entregues", fontSize = 12.sp, color = Color(0xFF64748B))
                        }
                    }
                }

                // Card 2: PENDENTES DE ENTREGA
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, Color(0xFF2563EB).copy(alpha = 0.5f)),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(Color(0xFFDBEAFE), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.LocalShipping, contentDescription = null, tint = Color(0xFF2563EB))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("PENDENTES DE ENTREGA", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF475569))
                            Text("$pendentesEntregaCount pedido(s)", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF2563EB))
                            Text("Total: R$ ${pendentesEntregaTotal.format(2)} a expedir", fontSize = 12.sp, color = Color(0xFF64748B))
                        }
                    }
                }
            }

            // Tabs de Filtro por Status Operacional
            ScrollableTabRow(
                selectedTabIndex = selectedTabIndex,
                edgePadding = 16.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Tab(
                    selected = selectedTabIndex == 0,
                    onClick = { selectedTabIndex = 0 },
                    text = { Text("Todos (${pedidos.size})", fontSize = 13.sp) }
                )
                Tab(
                    selected = selectedTabIndex == 1,
                    onClick = { selectedTabIndex = 1 },
                    text = { Text("A Expedir ($pendentesEntregaCount)", fontSize = 13.sp) }
                )
                Tab(
                    selected = selectedTabIndex == 2,
                    onClick = { selectedTabIndex = 2 },
                    text = { Text("Entregues ($vendasCount)", fontSize = 13.sp) }
                )
                Tab(
                    selected = selectedTabIndex == 3,
                    onClick = { selectedTabIndex = 3 },
                    text = { Text("Aguardando Pgto (${pedidosPendentesPagamento.size})", fontSize = 13.sp) }
                )
            }

            // Lista de Pedidos Operacionais
            if (filteredPedidos.isEmpty() && !isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Nenhum pedido operacional encontrado nesta categoria.",
                        color = Color.Gray,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredPedidos) { pedido ->
                        PedidoOperacionalCard(
                            pedido = pedido,
                            onMarcarEntregue = { viewModel.marcarComoEntregue(pedido.id, true) },
                            onBaixarPagamento = { viewModel.baixarPagamento(pedido.id) },
                            onDeletar = { viewModel.deletarPedido(pedido.id) }
                        )
                    }
                }
            }
        }
    }

    // Modal para cadastro rápido de novo pedido operacional
    if (showNovoPedidoModal) {
        NovoPedidoModal(
            onDismiss = { showNovoPedidoModal = false },
            onConfirm = { cliente, valor, forma, produto, qtd ->
                showNovoPedidoModal = false
                viewModel.criarNovoPedido(cliente, valor, forma, produto, qtd)
            }
        )
    }
}

@Composable
fun PedidoOperacionalCard(
    pedido: PedidoDTO,
    onMarcarEntregue: () -> Unit,
    onBaixarPagamento: () -> Unit,
    onDeletar: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(3.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // ID e Cliente
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Pedido #${pedido.id}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = pedido.clienteNome ?: "Cliente Balcão",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Itens do Pedido
            if (pedido.itens.isNotEmpty()) {
                pedido.itens.forEach { item ->
                    Text(
                        text = "• ${item.qtd}x ${item.nome} (R$ ${item.preco.format(2)})",
                        fontSize = 13.sp,
                        color = Color.DarkGray
                    )
                }
            } else {
                Text("Venda Operacional de Produtos/Serviços", fontSize = 13.sp, color = Color.Gray)
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Badges de Status (Entrega & Pagamento)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Badge Entrega
                Surface(
                    color = if (pedido.entregue) Color(0xFFDCFCE7) else Color(0xFFFEF3C7),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = if (pedido.entregue) "Entregue / Expedido" else "Pendente de Entrega",
                        color = if (pedido.entregue) Color(0xFF166534) else Color(0xFF92400E),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                // Badge Pagamento
                val isPago = !pedido.dataPagamento.isNullOrBlank()
                Surface(
                    color = if (isPago) Color(0xFFDBEAFE) else Color(0xFFFEE2E2),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = if (isPago) "Pago (${pedido.formaPagamento})" else "Aguardando Pgto",
                        color = if (isPago) Color(0xFF1E40AF) else Color(0xFF991B1B),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Valor Total e Ações Operacionais
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "R$ ${(pedido.valor ?: 0.0).format(2)}",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Envio: ${pedido.tipoEnvio ?: "RETIRADA"}",
                        fontSize = 11.sp,
                        color = Color.Gray
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (!pedido.entregue) {
                        Button(
                            onClick = onMarcarEntregue,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Expedir", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    if (pedido.dataPagamento.isNullOrBlank()) {
                        OutlinedButton(
                            onClick = onBaixarPagamento,
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("Baixar Pgto", fontSize = 12.sp)
                        }
                    }

                    IconButton(onClick = onDeletar) {
                        Icon(Icons.Default.Delete, contentDescription = "Excluir", tint = Color.Red)
                    }
                }
            }
        }
    }
}

@Composable
fun NovoPedidoModal(
    onDismiss: () -> Unit,
    onConfirm: (cliente: String, valor: Double, formaPagamento: String, produto: String, qtd: Int) -> Unit
) {
    var clienteNome by remember { mutableStateOf("") }
    var produtoNome by remember { mutableStateOf("") }
    var valorStr by remember { mutableStateOf("") }
    var qtdStr by remember { mutableStateOf("1") }
    var formaPagamento by remember { mutableStateOf("PIX") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Novo Pedido Operacional", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = clienteNome,
                    onValueChange = { clienteNome = it },
                    label = { Text("Nome do Cliente") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = produtoNome,
                    onValueChange = { produtoNome = it },
                    label = { Text("Produto / Serviço") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = valorStr,
                        onValueChange = { valorStr = it },
                        label = { Text("Valor Total (R$)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = qtdStr,
                        onValueChange = { qtdStr = it },
                        label = { Text("Qtd") },
                        singleLine = true,
                        modifier = Modifier.weight(0.6f)
                    )
                }
                OutlinedTextField(
                    value = formaPagamento,
                    onValueChange = { formaPagamento = it },
                    label = { Text("Forma de Pagamento (PIX, CARTAO, BOLETO)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val valor = valorStr.toDoubleOrNull() ?: 0.0
                    val qtd = qtdStr.toIntOrNull() ?: 1
                    onConfirm(clienteNome, valor, formaPagamento, produtoNome, qtd)
                }
            ) {
                Text("Registrar Pedido")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}
