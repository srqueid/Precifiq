import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.precific.app.data.network.CriarOrcamentoRequest
import com.precific.app.data.network.ItemOrcamentoDTO
import com.precific.app.data.repository.PrecificRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale

fun Double.format(digits: Int): String {
    return String.format(Locale.getDefault(), "%.${digits}f", this)
}

enum class Status {
    PENDENTE, APROVADO, REJEITADO, RASCUNHO
}

enum class Tipo {
    MP, CONSUMIVEL, FERRAGEM, ACABAMENTO
}

data class Orcamento(
    val id: Int,
    val titulo: String,
    val data: String,
    val status: Status,
    val total: Double,
    val clienteNome: String? = null
)

data class ItemOrcamento(
    val id: Int = 0,
    val insumoId: Int = 0,
    val insumo: String = "",
    val insumoNome: String = "",
    val quantidade: Int = 1,
    val unidade: String = "unid",
    val precoUnitario: Double = 0.0,
    val subtotal: Double = 0.0
)

data class Insumo(
    val id: Int,
    val nome: String,
    val tipo: Tipo = Tipo.MP,
    val precoUltCompra: Double = 0.0,
    val estoqueAtual: Double = 0.0,
    val estoqueMinimo: Double = 0.0,
    val unidade: String = "unid",
    val dataValidade: String? = null,
    val lote: String? = null,
    val codigoBarras: String? = null
)

data class Fornecedor(
    val id: Int,
    val razaoSocial: String,
    val nomeFantasia: String,
    val cidadeUf: String,
    val email: String,
    val telefone: String
)

data class OrcamentoFormState(
    val titulo: String = "",
    val cliente: String = ""
)

@Composable
fun StatusChip(status: Status) {
    val (bgColor, textColor, label) = when (status) {
        Status.APROVADO -> Triple(Color(0xFFD1FAE5), Color(0xFF065F46), "Aprovado")
        Status.PENDENTE -> Triple(Color(0xFFFEF3C7), Color(0xFF92400E), "Pendente")
        Status.REJEITADO -> Triple(Color(0xFFFEE2E2), Color(0xFF991B1B), "Rejeitado")
        Status.RASCUNHO -> Triple(Color(0xFFF3F4F6), Color(0xFF374151), "Rascunho")
    }

    Surface(
        color = bgColor,
        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
        )
    }
}

// Injeção de dependência e factory para os ViewModels conectados à API
@Composable
inline fun <reified T : ViewModel> hiltViewModel(): T {
    return when (T::class) {
        OrcamentosViewModel::class -> remember { OrcamentosViewModel() } as T
        InsumosViewModel::class -> remember { InsumosViewModel() } as T
        FornecedoresViewModel::class -> remember { FornecedoresViewModel() } as T
        OrcamentoFormViewModel::class -> remember { OrcamentoFormViewModel() } as T
        DashboardViewModel::class -> remember { DashboardViewModel() } as T
        else -> error("ViewModel ${T::class} não mapeado")
    }
}

class DashboardViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {

    private val _kpis = MutableStateFlow<List<DashboardKPIData>>(emptyList())
    val kpis: StateFlow<List<DashboardKPIData>> = _kpis.asStateFlow()

    private val _insumosCriticos = MutableStateFlow<List<InsumoCritico>>(emptyList())
    val insumosCriticos: StateFlow<List<InsumoCritico>> = _insumosCriticos.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        carregarDashboard()
    }

    fun carregarDashboard() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = repository.getDashboard()
            result.onSuccess { data ->
                _kpis.value = listOf(
                    DashboardKPIData(
                        title = "Valor em Estoque",
                        value = "R$ " + data.totalEstoqueEstimado.format(2),
                        trendText = "Giro: " + data.giroEstoque.format(1) + "x/mês",
                        isPositiveTrend = true,
                        icon = Icons.Default.Inventory,
                        accentColor = Color(0xFF2563EB)
                    ),
                    DashboardKPIData(
                        title = "Vendas Realizadas",
                        value = "R$ " + data.vendasTotalMes.format(2),
                        trendText = "Lucro: R$ " + data.lucroBrutoMes.format(2),
                        isPositiveTrend = data.lucroBrutoMes >= 0,
                        icon = Icons.Default.TrendingUp,
                        accentColor = Color(0xFF10B981)
                    ),
                    DashboardKPIData(
                        title = "Orçamentos Aprovados",
                        value = data.orcamentosAprovados.toString(),
                        trendText = data.orcamentosPendentes.toString() + " pendentes",
                        isPositiveTrend = true,
                        icon = Icons.Default.CheckCircle,
                        accentColor = Color(0xFFF59E0B)
                    ),
                    DashboardKPIData(
                        title = "Validade Crítica",
                        value = data.insumosValidadeCritica.size.toString(),
                        trendText = "Itens demandando atenção",
                        isPositiveTrend = data.insumosValidadeCritica.isEmpty(),
                        icon = Icons.Default.Warning,
                        accentColor = Color(0xFFEF4444)
                    )
                )

                _insumosCriticos.value = data.insumosValidadeCritica.map { item ->
                    InsumoCritico(
                        id = item.id,
                        nome = item.nome,
                        categoria = item.lote?.let { "Lote: $it" } ?: "Insumo",
                        estoqueAtual = item.estoque,
                        estoqueMinimo = 1.0,
                        unidade = item.unidade ?: "unid"
                    )
                }
            }.onFailure { err ->
                _errorMessage.value = err.message ?: "Erro ao carregar dashboard"
            }
            _isLoading.value = false
        }
    }
}

class InsumosViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {
    private val _insumos = MutableStateFlow<List<Insumo>>(emptyList())
    val insumos: StateFlow<List<Insumo>> = _insumos.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        carregarInsumos()
    }

    fun carregarInsumos() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = repository.getInsumos()
            result.onSuccess { dtoList ->
                _insumos.value = dtoList.map { dto ->
                    Insumo(
                        id = dto.id,
                        nome = dto.nome,
                        tipo = when (dto.categoria?.uppercase()) {
                            "CONSUMIVEL", "CONSUMÍVEIS" -> Tipo.CONSUMIVEL
                            "FERRAGEM", "FERRAGENS" -> Tipo.FERRAGEM
                            "ACABAMENTO" -> Tipo.ACABAMENTO
                            else -> Tipo.MP
                        },
                        precoUltCompra = dto.preco,
                        estoqueAtual = dto.estoque,
                        estoqueMinimo = dto.estoqueMinimo,
                        unidade = dto.unidadeMedida ?: "unid",
                        dataValidade = dto.dataValidade,
                        lote = dto.lote,
                        codigoBarras = dto.codigoBarras
                    )
                }
            }.onFailure { err ->
                _errorMessage.value = err.message ?: "Erro ao carregar insumos"
            }
            _isLoading.value = false
        }
    }
}

class FornecedoresViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {
    private val _fornecedores = MutableStateFlow<List<Fornecedor>>(emptyList())
    val fornecedores: StateFlow<List<Fornecedor>> = _fornecedores.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        carregarFornecedores()
    }

    fun carregarFornecedores() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = repository.getFornecedores()
            result.onSuccess { dtoList ->
                _fornecedores.value = dtoList.map { dto ->
                    Fornecedor(
                        id = dto.id,
                        razaoSocial = dto.nome,
                        nomeFantasia = dto.nomeFantasia ?: dto.nome,
                        cidadeUf = listOfNotNull(dto.cidade, dto.uf).joinToString("/").ifBlank { "Não informado" },
                        email = dto.email ?: "",
                        telefone = dto.telefones ?: ""
                    )
                }
            }.onFailure { err ->
                _errorMessage.value = err.message ?: "Erro ao carregar fornecedores"
            }
            _isLoading.value = false
        }
    }
}

class OrcamentosViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {
    private val _orcamentos = MutableStateFlow<List<Orcamento>>(emptyList())
    val orcamentos: StateFlow<List<Orcamento>> = _orcamentos.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        carregarOrcamentos()
    }

    fun carregarOrcamentos() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = repository.getOrcamentos()
            result.onSuccess { dtoList ->
                _orcamentos.value = dtoList.map { dto ->
                    Orcamento(
                        id = dto.id,
                        titulo = dto.titulo,
                        data = dto.dataCriacao ?: "Recente",
                        status = when (dto.status.uppercase()) {
                            "APROVADO" -> Status.APROVADO
                            "REJEITADO" -> Status.REJEITADO
                            "RASCUNHO" -> Status.RASCUNHO
                            else -> Status.PENDENTE
                        },
                        total = dto.total,
                        clienteNome = dto.clienteNome
                    )
                }
            }.onFailure { err ->
                _errorMessage.value = err.message ?: "Erro ao carregar orçamentos"
            }
            _isLoading.value = false
        }
    }
}

class OrcamentoFormViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {
    private val _formState = MutableStateFlow(OrcamentoFormState())
    val formState: StateFlow<OrcamentoFormState> = _formState.asStateFlow()

    private val _itens = MutableStateFlow<List<ItemOrcamento>>(emptyList())
    val itens: StateFlow<List<ItemOrcamento>> = _itens.asStateFlow()

    private val _total = MutableStateFlow(0.0)
    val total: StateFlow<Double> = _total.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _saveMessage = MutableStateFlow<String?>(null)
    val saveMessage: StateFlow<String?> = _saveMessage.asStateFlow()

    fun updateTitulo(titulo: String) {
        _formState.value = _formState.value.copy(titulo = titulo)
    }

    fun updateCliente(cliente: String) {
        _formState.value = _formState.value.copy(cliente = cliente)
    }

    fun adicionarItem() {
        _itens.value = _itens.value + ItemOrcamento(id = _itens.value.size + 1)
        recalcularTotal()
    }

    fun updateItem(item: ItemOrcamento) {
        _itens.value = _itens.value.map { if (it.id == item.id) item else it }
        recalcularTotal()
    }

    fun removerItem(id: Int) {
        _itens.value = _itens.value.filterNot { it.id == id }
        recalcularTotal()
    }

    private fun recalcularTotal() {
        _total.value = _itens.value.sumOf { it.quantidade * it.precoUnitario }
    }

    fun salvarEEnviarAprovacao(onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isSaving.value = true
            _saveMessage.value = null
            val request = CriarOrcamentoRequest(
                titulo = _formState.value.titulo.ifBlank { "Orçamento Mobile" },
                clienteNome = _formState.value.cliente,
                margemLucro = 25.0,
                itens = _itens.value.map {
                    ItemOrcamentoDTO(
                        insumoId = it.insumoId.takeIf { id -> id > 0 },
                        nome = it.insumoNome.ifBlank { it.insumo },
                        quantidade = it.quantidade.toDouble(),
                        precoUnitario = it.precoUnitario,
                        subtotal = it.quantidade * it.precoUnitario
                    )
                }
            )
            val result = repository.criarOrcamento(request)
            _isSaving.value = false
            result.onSuccess {
                _saveMessage.value = "Orçamento criado com sucesso!"
                onSuccess()
            }.onFailure { err ->
                _saveMessage.value = "Falha ao salvar: ${err.message}"
            }
        }
    }
}
