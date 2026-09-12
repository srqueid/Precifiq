package org.example.routes

import io.ktor.server.routing.*
import org.example.repository.AppDatabase
import org.example.routes.orcamentosRouting
import org.example.routes.precificacaoRouting
import org.example.routes.produtosFinaisRouting
import org.example.services.compraRouting
import org.example.services.configuracoesRouting
import org.example.services.fornecedorRouting
import org.example.services.insumoRouting
import org.example.services.tipoInsumoRouting
import org.example.services.pedidoRouting
import org.example.services.unidadeMedidaRouting

// Wrappers que permitem chamar as rotas declaradas como `Application.xxxRouting(db)`
// a partir de um receiver `Route` (por exemplo dentro de `routing { this.xxxRouting(db) }`).

fun Route.fornecedorRouting(db: AppDatabase) = with(this.application) { fornecedorRouting(db) }
fun Route.insumoRouting(db: AppDatabase) = with(this.application) { insumoRouting(db) }
fun Route.tipoInsumoRouting(db: AppDatabase) = with(this.application) { tipoInsumoRouting(db) }
fun Route.unidadeMedidaRouting(db: AppDatabase) = with(this.application) { unidadeMedidaRouting(db) }
fun Route.precificacaoRouting(db: AppDatabase) = with(this.application) { precificacaoRouting(db) }
fun Route.orcamentosRouting(db: AppDatabase) = with(this.application) { orcamentosRouting(db) }
fun Route.produtosFinaisRouting(db: AppDatabase) = with(this.application) { produtosFinaisRouting(db) }
fun Route.configuracoesRouting(db: AppDatabase) = with(this.application) { configuracoesRouting(db) }
fun Route.compraRouting(db: AppDatabase) = with(this.application) { compraRouting(db) }
fun Route.pedidoRouting(db: AppDatabase) = with(this.application) { pedidoRouting(db) }
