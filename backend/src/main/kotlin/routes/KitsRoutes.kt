package org.example.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.KitItensTable
import org.example.KitsTable
import org.example.ProdutoVariacoesTable
import org.example.ProdutosFinaisTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction

data class KitPayload(
    val nome: String,
    val descricao: String?,
    val margemLucro: Double,
    val codigoBarras: String? = null,
    val itens: List<KitItemPayload>
)

data class KitItemPayload(
    val produtoVariacaoId: Int,
    val quantidade: Int
)

data class KitItemDto(
    val id: Int,
    val kitId: Int,
    val produtoVariacaoId: Int,
    val quantidade: Int,
    val produtoNome: String?,
    val variacaoNome: String?,
    val custoUnitarioCalculado: Double,
    val precoVendaVariacao: Double
)

data class KitDto(
    val id: Int,
    val nome: String,
    val descricao: String?,
    val margemLucro: Double,
    val custoTotalCalculado: Double,
    val precoVenda: Double,
    val codigoBarras: String? = null,
    val itens: List<KitItemDto>
)

private const val MARGEM_LUCRO_MINIMA = 50.0

fun Route.kitsRoutes() {
    route("/api/kits") {
        get {
            try {
                val kits = transaction {
                    KitsTable.selectAll().map { row ->
                        val kitId = row[KitsTable.id]
                        val items = (KitItensTable innerJoin ProdutoVariacoesTable innerJoin ProdutosFinaisTable)
                            .select { KitItensTable.kitId eq kitId }
                            .map { itemRow ->
                                KitItemDto(
                                    id = itemRow[KitItensTable.id],
                                    kitId = itemRow[KitItensTable.kitId],
                                    produtoVariacaoId = itemRow[KitItensTable.produtoVariacaoId],
                                    quantidade = itemRow[KitItensTable.quantidade],
                                    produtoNome = itemRow[ProdutosFinaisTable.nome],
                                    variacaoNome = itemRow[ProdutoVariacoesTable.nomeTamanho],
                                    custoUnitarioCalculado = itemRow[ProdutoVariacoesTable.custoUnitarioCalculado],
                                    precoVendaVariacao = itemRow[ProdutoVariacoesTable.precoVenda]
                                )
                            }

                        KitDto(
                            id = kitId,
                            nome = row[KitsTable.nome],
                            descricao = row[KitsTable.descricao],
                            margemLucro = row[KitsTable.margemLucro],
                            custoTotalCalculado = row[KitsTable.custoTotalCalculado],
                            precoVenda = row[KitsTable.precoVenda],
                            codigoBarras = row[KitsTable.codigoBarras],
                            itens = items
                        )
                    }
                }
                call.respond(kits)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao buscar kits: ${e.message}"))
            }
        }

        get("/produtos-disponiveis") {
            try {
                val variacoes = transaction {
                    (ProdutoVariacoesTable innerJoin ProdutosFinaisTable)
                        .selectAll()
                        .map {
                            mapOf(
                                "id" to it[ProdutoVariacoesTable.id],
                                "produtoNome" to it[ProdutosFinaisTable.nome],
                                "nomeTamanho" to it[ProdutoVariacoesTable.nomeTamanho],
                                "custoUnitarioCalculado" to it[ProdutoVariacoesTable.custoUnitarioCalculado],
                                "precoVenda" to it[ProdutoVariacoesTable.precoVenda],
                                "margemLucro" to it[ProdutoVariacoesTable.margemLucro]
                            )
                        }
                }
                call.respond(variacoes)
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao buscar produtos disponíveis: ${e.message}"))
            }
        }

        post {
            try {
                val payload = call.receive<KitPayload>()

                if (payload.nome.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do kit é obrigatório."))
                    return@post
                }
                if (payload.margemLucro < MARGEM_LUCRO_MINIMA) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "A margem de lucro não pode ser menor que ${MARGEM_LUCRO_MINIMA}%."))
                    return@post
                }
                if (payload.itens.isEmpty()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O kit deve conter pelo menos um item."))
                    return@post
                }
                if (payload.itens.any { it.quantidade <= 0 }) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "A quantidade de cada item deve ser maior que zero."))
                    return@post
                }

                var custoTotalCalculado = 0.0
                for (item in payload.itens) {
                    val produto = transaction {
                        ProdutoVariacoesTable
                            .select { ProdutoVariacoesTable.id eq item.produtoVariacaoId }
                            .firstOrNull()
                    } ?: throw Exception("Produto com ID ${item.produtoVariacaoId} não encontrado.")
                    
                    custoTotalCalculado += produto[ProdutoVariacoesTable.custoUnitarioCalculado] * item.quantidade
                }

                val precoDeVenda = custoTotalCalculado * (1 + (payload.margemLucro / 100.0))

                val novoKitId = transaction {
                    val resultRow = KitsTable.insert {
                        it[nome] = payload.nome
                        it[descricao] = payload.descricao
                        it[codigoBarras] = payload.codigoBarras?.takeIf { c -> c.isNotBlank() }
                        it[margemLucro] = payload.margemLucro
                        it[this.custoTotalCalculado] = custoTotalCalculado
                        it[precoVenda] = precoDeVenda
                    }
                    
                    val generatedId = resultRow[KitsTable.id]

                    KitItensTable.batchInsert(payload.itens) { item ->
                        this[KitItensTable.kitId] = generatedId
                        this[KitItensTable.produtoVariacaoId] = item.produtoVariacaoId
                        this[KitItensTable.quantidade] = item.quantidade
                    }
                    
                    generatedId
                }
                call.respond(HttpStatusCode.Created, mapOf("message" to "Kit criado com sucesso!", "id" to novoKitId))

            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao criar o kit: ${e.message}"))
            }
        }

        put("/{id}") {
            try {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido."))
                    return@put
                }
                val payload = call.receive<KitPayload>()

                if (payload.nome.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O nome do kit é obrigatório."))
                    return@put
                }
                if (payload.margemLucro < MARGEM_LUCRO_MINIMA) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "A margem de lucro não pode ser menor que ${MARGEM_LUCRO_MINIMA}%."))
                    return@put
                }
                if (payload.itens.isEmpty()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "O kit deve conter pelo menos um item."))
                    return@put
                }
                if (payload.itens.any { it.quantidade <= 0 }) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "A quantidade de cada item deve ser maior que zero."))
                    return@put
                }

                var custoTotalCalculado = 0.0
                for (item in payload.itens) {
                    val produto = transaction {
                        ProdutoVariacoesTable
                            .select { ProdutoVariacoesTable.id eq item.produtoVariacaoId }
                            .firstOrNull()
                    } ?: throw Exception("Produto com ID ${item.produtoVariacaoId} não encontrado.")
                    
                    custoTotalCalculado += produto[ProdutoVariacoesTable.custoUnitarioCalculado] * item.quantidade
                }

                val precoDeVenda = custoTotalCalculado * (1 + (payload.margemLucro / 100.0))

                val updated = transaction {
                    val count = KitsTable.update({ KitsTable.id eq id }) {
                        it[nome] = payload.nome
                        it[descricao] = payload.descricao
                        it[codigoBarras] = payload.codigoBarras?.takeIf { c -> c.isNotBlank() }
                        it[margemLucro] = payload.margemLucro
                        it[this.custoTotalCalculado] = custoTotalCalculado
                        it[precoVenda] = precoDeVenda
                    }

                    if (count > 0) {
                        KitItensTable.deleteWhere { KitItensTable.kitId eq id }
                        KitItensTable.batchInsert(payload.itens) { item ->
                            this[KitItensTable.kitId] = id
                            this[KitItensTable.produtoVariacaoId] = item.produtoVariacaoId
                            this[KitItensTable.quantidade] = item.quantidade
                        }
                    }
                    count
                }

                if (updated > 0) {
                    call.respond(HttpStatusCode.OK, mapOf("message" to "Kit atualizado com sucesso!"))
                } else {
                    call.respond(HttpStatusCode.NotFound, mapOf("error" to "Kit não encontrado."))
                }

            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao atualizar o kit: ${e.message}"))
            }
        }

        delete("/{id}") {
            try {
                val id = call.parameters["id"]?.toIntOrNull()
                if (id == null) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "ID inválido."))
                    return@delete
                }

                val deleted = transaction {
                    KitItensTable.deleteWhere { KitItensTable.kitId eq id }
                    KitsTable.deleteWhere { KitsTable.id eq id }
                }

                if (deleted > 0) {
                    call.respond(HttpStatusCode.OK, mapOf("message" to "Kit excluído com sucesso!"))
                } else {
                    call.respond(HttpStatusCode.NotFound, mapOf("error" to "Kit não encontrado."))
                }
            } catch (e: Exception) {
                e.printStackTrace()
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Erro ao excluir o kit: ${e.message}"))
            }
        }
    }
}
