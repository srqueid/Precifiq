package org.example

import org.jetbrains.exposed.sql.Table

/**
 * Tabela para armazenar os Kits de produtos.
 * Um Kit é um agrupamento de múltiplos 'ProdutoVariacao' para venda.
 */
object KitsTable : Table("kits") {
    val id = integer("id").autoIncrement()
    val nome = varchar("nome", 255)
    val codigo = varchar("codigo", 100).nullable()
    val codigoBarras = varchar("codigo_barras", 50).nullable()
    val descricao = text("descricao").nullable()
    val margemLucro = double("margem_lucro") // Percentual de lucro definido pelo usuário (ex: 50.0 para 50%)
    val custoTotalCalculado = double("custo_total_calculado") // Soma dos custos dos itens do kit
    val precoVenda = double("preco_venda") // Preço final de venda do kit
    override val primaryKey = PrimaryKey(id)
}

/**
 * Tabela de associação para ligar os Produtos (ProdutoVariacao) a um Kit.
 */
object KitItensTable : Table("kit_itens") {
    val id = integer("id").autoIncrement()
    val kitId = integer("kit_id").references(KitsTable.id)
    val produtoVariacaoId = integer("produto_variacao_id").references(ProdutoVariacoesTable.id)
    val quantidade = integer("quantidade") // Quantidade de um produto específico dentro do kit
    override val primaryKey = PrimaryKey(id)
}
