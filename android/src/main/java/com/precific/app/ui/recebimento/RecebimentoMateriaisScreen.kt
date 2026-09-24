package com.precific.app.ui.recebimento

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.precific.app.data.network.InsumoDTO
import com.precific.app.data.repository.PrecificRepository
import com.precific.app.domain.format
import com.precific.app.domain.hiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RecebimentoViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {

    private val _codigoBarras = MutableStateFlow("")
    val codigoBarras: StateFlow<String> = _codigoBarras.asStateFlow()

    private val _insumosDisponiveis = MutableStateFlow<List<InsumoDTO>>(emptyList())
    val insumosDisponiveis: StateFlow<List<InsumoDTO>> = _insumosDisponiveis.asStateFlow()

    private val _insumoSelecionado = MutableStateFlow<InsumoDTO?>(null)
    val insumoSelecionado: StateFlow<InsumoDTO?> = _insumoSelecionado.asStateFlow()

    private val _quantidade = MutableStateFlow("1")
    val quantidade: StateFlow<String> = _quantidade.asStateFlow()

    private val _motivo = MutableStateFlow("Recebimento de materiais comprados")
    val motivo: StateFlow<String> = _motivo.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _userMessage = MutableStateFlow<String?>(null)
    val userMessage: StateFlow<String?> = _userMessage.asStateFlow()

    init {
        carregarInsumos()
    }

    fun carregarInsumos() {
        viewModelScope.launch {
            _isLoading.value = true
            val result = repository.getInsumos()
            result.onSuccess { list ->
                _insumosDisponiveis.value = list
            }.onFailure { err ->
                _userMessage.value = "Erro ao carregar insumos: ${err.message}"
            }
            _isLoading.value = false
        }
    }

    fun updateCodigoBarras(codigo: String) {
        _codigoBarras.value = codigo
        _userMessage.value = null
        if (codigo.length >= 3) {
            buscarPorCodigo(codigo)
        }
    }

    fun updateQuantidade(qtd: String) {
        _quantidade.value = qtd
        _userMessage.value = null
    }

    fun updateMotivo(m: String) {
        _motivo.value = m
    }

    fun selecionarInsumo(insumo: InsumoDTO) {
        _insumoSelecionado.value = insumo
        _codigoBarras.value = insumo.codigoBarras ?: ""
        _userMessage.value = null
    }

    fun buscarPorCodigo(codigo: String) {
        val cod = codigo.trim()
        if (cod.isBlank()) return

        // Procura primeiro localmente na lista de insumos pelo código de barras ou nome
        val localMatch = _insumosDisponiveis.value.find {
            (it.codigoBarras != null && it.codigoBarras.equals(cod, ignoreCase = true)) ||
            it.id.toString() == cod
        }

        if (localMatch != null) {
            _insumoSelecionado.value = localMatch
        } else {
            // Tenta consultar a API de código de barras
            viewModelScope.launch {
                val res = repository.consultarCodigoBarras(cod)
                res.onSuccess { dto ->
                    val matchInsumo = _insumosDisponiveis.value.find { it.id == dto.id || it.nome.contains(dto.nome, ignoreCase = true) }
                    if (matchInsumo != null) {
                        _insumoSelecionado.value = matchInsumo
                    } else {
                        _userMessage.value = "Item identificado via EAN: ${dto.nome}. Selecione o insumo correspondente na lista abaixo."
                    }
                }.onFailure {
                    // Sem erro impeditivo, apenas aguarda seleção do insumo
                }
            }
        }
    }

    fun confirmarRecebimento() {
        val insumo = _insumoSelecionado.value
        if (insumo == null) {
            _userMessage.value = "Selecione ou bip o código de barras de um material/insumo."
            return
        }

        val qtdAdicionar = _quantidade.value.toDoubleOrNull()
        if (qtdAdicionar == null || qtdAdicionar <= 0) {
            _userMessage.value = "Informe uma quantidade válida para o recebimento."
            return
        }

        val estoqueAtual = insumo.estoque
        val novoEstoqueTotal = estoqueAtual + qtdAdicionar
        val motivoEntrada = _motivo.value.ifBlank { "Recebimento de materiais comprados" }

        viewModelScope.launch {
            _isLoading.value = true
            _userMessage.value = null

            val result = repository.darRecebimentoMaterial(insumo.id, novoEstoqueTotal, motivoEntrada)
            _isLoading.value = false

            result.onSuccess {
                val und = insumo.unidadeMedida ?: "unid"
                _userMessage.value = "Recebimento confirmado! Entrada de $qtdAdicionar $und para '${insumo.nome}' registrada no estoque."
                _insumoSelecionado.value = insumo.copy(estoque = novoEstoqueTotal)
                carregarInsumos()
            }.onFailure { err ->
                _userMessage.value = "Erro ao registrar recebimento: ${err.message}"
            }
        }
    }

    fun limparMensagem() {
        _userMessage.value = null
    }

    fun limparSelecao() {
        _insumoSelecionado.value = null
        _codigoBarras.value = ""
        _quantidade.value = "1"
        _userMessage.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecebimentoMateriaisScreen(
    viewModel: RecebimentoViewModel = hiltViewModel(),
    onVoltar: () -> Unit = {}
) {
    val codigoBarras by viewModel.codigoBarras.collectAsState()
    val insumoSelecionado by viewModel.insumoSelecionado.collectAsState()
    val insumosDisponiveis by viewModel.insumosDisponiveis.collectAsState()
    val quantidade by viewModel.quantidade.collectAsState()
    val motivo by viewModel.motivo.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val userMessage by viewModel.userMessage.collectAsState()

    val focusManager = LocalFocusManager.current
    var searchQuery by remember { mutableStateOf("") }

    val filteredInsumos = insumosDisponiveis.filter {
        it.nome.contains(searchQuery, ignoreCase = true) ||
        (it.codigoBarras != null && it.codigoBarras.contains(searchQuery, ignoreCase = true))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Recebimento de Materiais", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.carregarInsumos() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Atualizar Insumos", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.primary)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Feedback User Message Banner
            userMessage?.let { msg ->
                Surface(
                    color = if (msg.contains("confirmado", ignoreCase = true) || msg.contains("sucesso", ignoreCase = true)) Color(0xFFD1FAE5) else Color(0xFFFEF3C7),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = msg,
                            color = if (msg.contains("confirmado", ignoreCase = true) || msg.contains("sucesso", ignoreCase = true)) Color(0xFF065F46) else Color(0xFF92400E),
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

            // Card 1: Leitura de Código de Barras / Leitor óptico
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                elevation = CardDefaults.cardElevation(2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(
                            text = "Leitura de Código de Barras",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }

                    OutlinedTextField(
                        value = codigoBarras,
                        onValueChange = { viewModel.updateCodigoBarras(it) },
                        label = { Text("Bip ou Digite o Código de Barras / EAN") },
                        placeholder = { Text("Ex: 7891234567890") },
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (codigoBarras.isNotBlank()) {
                                IconButton(onClick = { viewModel.limparSelecao() }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Limpar")
                                }
                            }
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number,
                            imeAction = ImeAction.Search
                        ),
                        keyboardActions = KeyboardActions(
                            onSearch = {
                                focusManager.clearFocus()
                                viewModel.buscarPorCodigo(codigoBarras)
                            }
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            }

            // Card 2: Material Identificado & Inserção da Quantidade
            insumoSelecionado?.let { insumo ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFF10B981)),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                    elevation = CardDefaults.cardElevation(4.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981))
                                Text(
                                    text = "Material Identificado",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = Color(0xFF065F46)
                                )
                            }
                            TextButton(onClick = { viewModel.limparSelecao() }) {
                                Text("Trocar Material", fontSize = 12.sp)
                            }
                        }

                        Text(
                            text = insumo.nome,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                            color = Color(0xFF1E293B)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Estoque Atual", fontSize = 12.sp, color = Color.Gray)
                                Text(
                                    text = "${insumo.estoque} ${insumo.unidadeMedida ?: "unid"}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Preço Unitário", fontSize = 12.sp, color = Color.Gray)
                                Text(
                                    text = "R$ ${insumo.preco.format(2)}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                            }
                        }

                        HorizontalDivider(color = Color(0xFFBBF7D0))

                        // Inserção da Quantidade Comprada / Recebida
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = quantidade,
                                onValueChange = { viewModel.updateQuantidade(it) },
                                label = { Text("Quantidade Recebida") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            )

                            OutlinedTextField(
                                value = insumo.unidadeMedida ?: "unid",
                                onValueChange = {},
                                label = { Text("Unidade") },
                                readOnly = true,
                                modifier = Modifier.weight(0.6f),
                                shape = RoundedCornerShape(12.dp)
                            )
                        }

                        OutlinedTextField(
                            value = motivo,
                            onValueChange = { viewModel.updateMotivo(it) },
                            label = { Text("Motivo / Referência") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )

                        // Botão de Confirmação de Entrada
                        Button(
                            onClick = {
                                focusManager.clearFocus()
                                viewModel.confirmarRecebimento()
                            },
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Inventory2, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "CONFIRMAR RECEBIMENTO E DAR ENTRADA",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }

            // Card 3: Seleção Manual de Insumos da Lista
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Ou Selecione o Material na Lista",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )

                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        label = { Text("Filtrar por nome do material") },
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.FilterList, contentDescription = null) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(260.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredInsumos) { item ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { viewModel.selecionarInsumo(item) },
                                colors = CardDefaults.cardColors(
                                    containerColor = if (insumoSelecionado?.id == item.id) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                ),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(item.nome, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                        Text("EAN: ${item.codigoBarras ?: "Não cadastrado"}", fontSize = 11.sp, color = Color.Gray)
                                    }
                                    Text(
                                        "${item.estoque} ${item.unidadeMedida ?: "unid"}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
