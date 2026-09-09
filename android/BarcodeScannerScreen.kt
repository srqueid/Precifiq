import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.precific.app.data.network.CodigoBarrasResultadoDTO
import com.precific.app.data.repository.PrecificRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BarcodeScannerScreen(
    onBack: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val repository = remember { PrecificRepository() }

    var codigoInput by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var resultado by remember { mutableStateOf<CodigoBarrasResultadoDTO?>(null) }
    var erroMsg by remember { mutableStateOf<String?>(null) }

    fun buscarCodigo(cod: String) {
        if (cod.isBlank()) return
        coroutineScope.launch {
            isLoading = true
            erroMsg = null
            resultado = null
            val res = repository.consultarCodigoBarras(cod.trim())
            isLoading = false
            res.onSuccess {
                resultado = it
            }.onFailure {
                erroMsg = it.message ?: "Código de barras não encontrado"
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scanner de Código de Barras") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Card de Entrada do Scanner
            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Leitor de Código de Barras (API REST)",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Text(
                        text = "Bipe com o leitor óptico, câmera ou digite o código de barras do insumo, variação ou kit:",
                        fontSize = 13.sp,
                        color = Color.Gray
                    )

                    OutlinedTextField(
                        value = codigoInput,
                        onValueChange = {
                            codigoInput = it
                            if (it.length >= 8) {
                                buscarCodigo(it)
                            }
                        },
                        label = { Text("Código de Barras (EAN)") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.QrCodeScanner, contentDescription = null) },
                        trailingIcon = {
                            if (isLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else if (codigoInput.isNotBlank()) {
                                IconButton(onClick = { codigoInput = ""; resultado = null; erroMsg = null }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Limpar")
                                }
                            }
                        },
                        singleLine = true
                    )

                    Button(
                        onClick = { buscarCodigo(codigoInput) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = codigoInput.isNotBlank() && !isLoading
                    ) {
                        Icon(Icons.Default.Search, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Consultar na API")
                    }
                }
            }

            // Exibição do Resultado Encontrado
            resultado?.let { item ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                    elevation = CardDefaults.cardElevation(6.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Surface(
                                color = Color(0xFF22C55E),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = item.tipo,
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                            Text(
                                text = "EAN: ${item.codigoBarras}",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 12.sp,
                                color = Color(0xFF15803D)
                            )
                        }

                        Text(
                            text = item.nome,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color(0xFF0F172A)
                        )

                        item.detalhes?.let {
                            Text(text = it, fontSize = 13.sp, color = Color(0xFF64748B))
                        }

                        Divider(modifier = Modifier.padding(vertical = 4.dp))

                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column {
                                Text("Preço Unitário", fontSize = 12.sp, color = Color(0xFF64748B))
                                Text(
                                    text = "R$ ${item.preco.format(2)}",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF15803D)
                                )
                            }

                            item.estoque?.let { est ->
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Estoque Físico", fontSize = 12.sp, color = Color(0xFF64748B))
                                    Text(
                                        text = "$est ${item.unidade ?: "unid"}",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFF0F172A)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Exibição de Erro
            erroMsg?.let { msg ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFDC2626))
                        Text(text = msg, color = Color(0xFFDC2626), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
