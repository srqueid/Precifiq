# Separação Frontend / Backend

## Estrutura gerada

```
projeto/
├── frontend/                    ← arquivos estáticos (servidos na :8080)
│   ├── css/
│   │   └── app.css              ← tema global (variáveis, cards, tabelas, botões…)
│   ├── js/
│   │   └── app.js               ← utilitários: apiFetch, toast, fmt, helpers
│   └── pages/
│       ├── dashboard.html
│       ├── insumos.html
│       ├── produtos.html
│       ├── precificacao.html
│       ├── configuracoes.html
│       ├── orcamentos.html
│       └── orcamento-detalhe.html
│
└── backend/
    └── Application.kt           ← servidor Ktor limpo, só rotas JSON
```

---

## Como funciona

| Porta | Responsabilidade |
|-------|-----------------|
| **:8080** | Serve os arquivos estáticos do frontend (`staticFiles`) |
| **:8089** | API JSON (CORS liberado para `*`) |

O frontend nunca renderiza HTML no Kotlin. Cada página HTML faz `fetch`
para a API em `:8089` e renderiza os dados no browser.

---

## Configurar o Ktor para servir arquivos estáticos

Adicione a dependência no `build.gradle.kts`:

```kotlin
implementation("io.ktor:ktor-server-static-content:$ktor_version")
```

E coloque a pasta `frontend/` na raiz do projeto (ao lado do `src/`).
O bloco no `Application.kt` já está configurado:

```kotlin
staticFiles("/", File("frontend")) {
    default("pages/dashboard.html")
}
```

---

## app.js — utilitários disponíveis em todas as páginas

```javascript
// Requisição GET para a API
const data = await apiFetch('/insumos/json');

// Requisição POST com JSON
await apiPost('/insumos', { id: 0, nome: 'Farinha', ... });

// Requisição POST com form-urlencoded
await apiPostForm('/precificacao/atualizar', { variacaoId: '1', precoVenda: '10.50' });

// Formatação
fmt.brl(12.5)   // → "R$ 12.50"
fmt.pct(0.25)   // → "25%"
fmt.num(3.1416) // → "3.14"

// Notificações
toast('Salvo com sucesso');
toast('Algo deu errado', 'error');

// Helpers de tabela
clearTable('tb-insumos');
appendRow('tb-insumos', `<td>...</td>`);
```

---

## O que foi removido do Kotlin

Antes, cada rota `GET /pagina` retornava centenas de linhas de HTML
como string Kotlin. Agora:

- ✅ Rotas `GET /pagina` → **removidas** (frontend cuida disso)
- ✅ `call.respondHtml { }` e `call.respondText(html, …)` → **removidos**
- ✅ `layout()` helper → **removido**
- ✅ Todo CSS/JS inline → **removido**
- ✅ Rotas de redirect (`/insumos/deletar/{id}` → redirect) →
  substituídas por respostas JSON `{"ok": true}`

O backend ficou ~60% menor e agora é testável de forma independente.
