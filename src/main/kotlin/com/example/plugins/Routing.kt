package com.example.plugins

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

fun Route.configureRouting() {
    route("/kits") {
        post {
            try {
                val payload = call.receive<KitPayload>()
                var custoTotalCalculado = 0.0

                for (item in payload.itens) {
                    val produto = transaction {
                        ProdutoVariacoesTable.select { ProdutoVariacoesTable.id eq item.produtoVariacaoId }
                            .firstOrNull()
                    } ?: throw IllegalArgumentException("Produto com ID ${item.produtoVariacaoId} não encontrado.")

                    custoTotalCalculado += produto[ProdutoVariacoesTable.custoUnitarioCalculado] * item.quantidade
                }

                val precoDeVenda = custoTotalCalculado * (1 + (payload.margemLucro / 100.0))

                val novoKitId = transaction {
                    if (KitsTable.select { KitsTable.nome eq payload.nome }.any()) {
                        throw IllegalStateException("Já existe um kit com o nome '${payload.nome}'.")
                    }

                    val resultRow = KitsTable.insert {
                        it[nome] = payload.nome
                        it[descricao] = payload.descricao
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
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Erro ao criar o kit")))
            }
        }
    }
}
