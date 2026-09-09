import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
    val total: Double
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
    val tipo: Tipo,
    val precoUltCompra: Double,
    val estoqueAtual: Double,
    val estoqueMinimo: Double,
    val unidade: String
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

// Mock helper function replacing hiltViewModel for standalone compilability
@Composable
inline fun <reified T : ViewModel> hiltViewModel(): T {
    return when (T::class) {
        OrcamentosViewModel::class -> OrcamentosViewModel() as T
        InsumosViewModel::class -> InsumosViewModel() as T
        FornecedoresViewModel::class -> FornecedoresViewModel() as T
        OrcamentoFormViewModel::class -> OrcamentoFormViewModel() as T
        else -> error("ViewModel ${T::class} não mapeado")
    }
}

class OrcamentosViewModel : ViewModel() {
    private val _orcamentos = MutableStateFlow(
        listOf(
            Orcamento(101, "Mesa Madeira", "08/09/2026", Status.APROVADO, 3450.0),
            Orcamento(102, "Armário Cozinha", "07/09/2026", Status.PENDENTE, 8900.0)
        )
    )
    val orcamentos: StateFlow<List<Orcamento>> = _orcamentos.asStateFlow()

    private val _uiState = MutableStateFlow("OK")
    val uiState: StateFlow<String> = _uiState.asStateFlow()
}

class InsumosViewModel : ViewModel() {
    private val _insumos = MutableStateFlow(
        listOf(
            Insumo(1, "MDF 15mm", Tipo.MP, 180.0, 3.0, 10.0, "chapas"),
            Insumo(2, "Cola Contato", Tipo.CONSUMIVEL, 45.0, 1.0, 5.0, "galões")
        )
    )
    val insumos: StateFlow<List<Insumo>> = _insumos.asStateFlow()
}

class FornecedoresViewModel : ViewModel() {
    private val _fornecedores = MutableStateFlow(
        listOf(
            Fornecedor(1, "Madeiras Brasil LTDA", "Madeiras Brasil", "São Paulo/SP", "contato@madeirasbrasil.com", "(11) 9999-8888")
        )
    )
    val fornecedores: StateFlow<List<Fornecedor>> = _fornecedores.asStateFlow()
}

class OrcamentoFormViewModel : ViewModel() {
    private val _formState = MutableStateFlow(OrcamentoFormState())
    val formState: StateFlow<OrcamentoFormState> = _formState.asStateFlow()

    private val _itens = MutableStateFlow<List<ItemOrcamento>>(emptyList())
    val itens: StateFlow<List<ItemOrcamento>> = _itens.asStateFlow()

    private val _total = MutableStateFlow(0.0)
    val total: StateFlow<Double> = _total.asStateFlow()

    fun updateTitulo(titulo: String) {
        _formState.value = _formState.value.copy(titulo = titulo)
    }

    fun updateCliente(cliente: String) {
        _formState.value = _formState.value.copy(cliente = cliente)
    }

    fun adicionarItem() {
        _itens.value = _itens.value + ItemOrcamento(id = _itens.value.size + 1)
    }

    fun updateItem(item: ItemOrcamento) {
        _itens.value = _itens.value.map { if (it.id == item.id) item else it }
    }

    fun removerItem(id: Int) {
        _itens.value = _itens.value.filterNot { it.id == id }
    }

    fun salvarEEnviarAprovacao() {}
}
