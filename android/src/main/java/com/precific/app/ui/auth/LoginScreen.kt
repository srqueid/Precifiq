package com.precific.app.ui.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.precific.app.R
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.precific.app.data.network.ApiConfig
import com.precific.app.data.repository.PrecificRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class LoginViewModel(
    private val repository: PrecificRepository = PrecificRepository()
) : ViewModel() {

    private val _email = MutableStateFlow("admin@dcsys.com")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _senha = MutableStateFlow("")
    val senha: StateFlow<String> = _senha.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _baseUrl = MutableStateFlow(ApiConfig.baseUrl)
    val baseUrl: StateFlow<String> = _baseUrl.asStateFlow()

    fun updateEmail(value: String) {
        _email.value = value
        _errorMessage.value = null
    }

    fun updateSenha(value: String) {
        _senha.value = value
        _errorMessage.value = null
    }

    fun updateBaseUrl(value: String) {
        _baseUrl.value = value
        ApiConfig.customBaseUrl = value.ifBlank { null }
    }

    fun realizarLogin(onSuccess: () -> Unit) {
        val userEmail = _email.value.trim()
        val userPass = _senha.value.trim()

        if (userEmail.isBlank() || userPass.isBlank()) {
            _errorMessage.value = "Por favor, informe e-mail e senha."
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            val result = repository.login(userEmail, userPass)
            _isLoading.value = false

            result.onSuccess {
                onSuccess()
            }.onFailure { err ->
                val msg = err.message ?: "Erro ao realizar login."
                _errorMessage.value = if (msg.contains("401") || msg.contains("403")) {
                    "E-mail ou senha incorretos."
                } else if (msg.contains("ConnectException") || msg.contains("SocketTimeout")) {
                    "Não foi possível conectar ao servidor. Verifique se o backend está rodando em ${_baseUrl.value}"
                } else {
                    msg
                }
            }
        }
    }
}

@Composable
fun LoginScreen(
    viewModel: LoginViewModel = remember { LoginViewModel() },
    onLoginSuccess: () -> Unit = {}
) {
    val email by viewModel.email.collectAsState()
    val senha by viewModel.senha.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val baseUrl by viewModel.baseUrl.collectAsState()

    var passwordVisible by remember { mutableStateOf(false) }
    var showAdvancedConfig by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            elevation = CardDefaults.cardElevation(8.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header / Logo
                Surface(
                    modifier = Modifier.size(80.dp),
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 6.dp,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(10.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.logo_precifiq),
                            contentDescription = "Logo Precific",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    }
                }

                Text(
                    text = "Precific",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                Text(
                    text = "Acesse com sua conta do sistema Web",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Mensagem de Erro
                errorMessage?.let { msg ->
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = msg,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }

                // Campo de E-mail
                OutlinedTextField(
                    value = email,
                    onValueChange = viewModel::updateEmail,
                    label = { Text("E-mail") },
                    placeholder = { Text("seu.email@empresa.com") },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = "E-mail") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) }
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                // Campo de Senha
                OutlinedTextField(
                    value = senha,
                    onValueChange = viewModel::updateSenha,
                    label = { Text("Senha") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = "Senha") },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = if (passwordVisible) "Ocultar senha" else "Exibir senha"
                            )
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            focusManager.clearFocus()
                            viewModel.realizarLogin(onLoginSuccess)
                        }
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Botão de Login
                Button(
                    onClick = {
                        focusManager.clearFocus()
                        viewModel.realizarLogin(onLoginSuccess)
                    },
                    enabled = !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.5.dp
                        )
                    } else {
                        Text(
                            text = "ENTRAR NO SISTEMA",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Opção de Servidor Backend
                TextButton(
                    onClick = { showAdvancedConfig = !showAdvancedConfig }
                ) {
                    Text(
                        text = if (showAdvancedConfig) "Ocultar IP do Servidor" else "Configurar Servidor/IP Backend",
                        fontSize = 12.sp
                    )
                }

                if (showAdvancedConfig) {
                    OutlinedTextField(
                        value = baseUrl,
                        onValueChange = viewModel::updateBaseUrl,
                        label = { Text("URL Base do Servidor REST") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            }
        }
    }
}
