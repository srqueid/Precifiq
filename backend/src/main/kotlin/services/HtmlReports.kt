package org.example.services

import io.ktor.server.html.*
import kotlinx.html.*
import java.time.format.DateTimeFormatter

fun HTML.gerarHtmlOrcamento(dados: Map<String, Any>) {
    val orcamento = dados["orcamento"] as org.example.OrcamentoRelatorio
    @Suppress("UNCHECKED_CAST")
    val pedidos = dados["pedidos"] as List<Map<String, Any>>
    val dataImpressao = dados["dataImpressao"] as String

    head {
        meta { charset = "utf-8" }
        title("Orçamento #${orcamento.id} - ${orcamento.titulo}")
        style {
            unsafe {
                raw(
                    """
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 30px; font-size: 18px; }
            .info { margin: 10px 0; }
            .info span { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .total { font-weight: bold; font-size: 16px; text-align: right; margin-top: 10px; }
            .footer { margin-top: 40px; font-size: 12px; color: #777; text-align: center; }
            @media print {
                body { margin: 20px; }
                .no-print { display: none; }
            }
            """.trimIndent()
                )
            }
        }
    }
    body {
        div {
            h1 { text("Orçamento #${orcamento.id}") }
            div { text("Título: ${orcamento.titulo}") }
            div { text("Data de Criação: ${orcamento.dataCriacao}") }
            div { text("Status: ${orcamento.status}") }
            if (orcamento.observacoes != null) {
                div { text("Observações: ${orcamento.observacoes}") }
            }
        }

        h2 { text("Itens do Orçamento") }
        table {
            thead {
                tr {
                    th { text("Item") }
                    th { text("Insumo") }
                    th { text("Qtd") }
                    th { text("Unidade") }
                    th { text("Preço Unit. (Menor Cotação)") }
                    th { text("Subtotal") }
                }
            }
            tbody {
                orcamento.itens.forEachIndexed { index, item ->
                    tr {
                        td { text("${index + 1}") }
                        td { text(item.insumoNome) }
                        td { text(item.quantidade.toString()) }
                        td { text(item.unidadeSigla ?: "-") }
                        val menorPreco = item.cotacoes.minOfOrNull { it.precoUnitario } ?: 0.0
                        td { text("R$ ${menorPreco.formatBrazilianCurrency()}") }
                        td { text("R$ ${(item.quantidade * menorPreco).formatBrazilianCurrency()}") }
                    }
                }
            }
        }

        div {
            p { text("Subtotal dos Itens: R$ ${orcamento.valorTotalItens.formatBrazilianCurrency()}") }
            p { text("Frete: R$ ${orcamento.frete.formatBrazilianCurrency()}") }
            p { text("Desconto: R$ ${orcamento.desconto.formatBrazilianCurrency()}") }
            p { text("Valor Final: R$ ${orcamento.valorFinal.formatBrazilianCurrency()}") }
        }

        if (pedidos.isNotEmpty()) {
            h2 { text("Pedidos de Compra Gerados") }
            table {
                thead {
                    tr {
                        th { text("Pedido #") }
                        th { text("Fornecedor") }
                        th { text("Data") }
                        th { text("Forma Pgto") }
                        th { text("Valor Final") }
                    }
                }
                tbody {
                    pedidos.forEach { pedido ->
                        tr {
                            td { text("#${pedido["id"]}") }
                            val fornId = pedido["fornecedorId"] as Int
                            td { text("Fornecedor #$fornId") }
                            td { text("${pedido["dataConfirmacao"] as String}") }
                            td { text("${pedido["formaPagamento"] as String}") }
                            td { text("R$ ${(pedido["valorFinalConfirmado"] as Double).formatBrazilianCurrency()}") }
                        }
                    }
                }
            }
        }

        div {
            p { text("Data de Impressão: $dataImpressao") }
        }
    }
}

fun HTML.gerarHtmlPedidoCompra(dados: Map<String, Any>) {
    val pedido = dados["pedido"] as org.example.PedidoCompraRelatorio
    val dataImpressao = dados["dataImpressao"] as String

    head {
        meta { charset = "utf-8" }
        title("Pedido de Compra #${pedido.id}")
        style {
            unsafe {
                raw(
                    """
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 30px; font-size: 18px; }
            .info { margin: 10px 0; }
            .info span { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .total { font-weight: bold; font-size: 16px; text-align: right; margin-top: 10px; }
            .footer { margin-top: 40px; font-size: 12px; color: #777; text-align: center; }
            @media print {
                body { margin: 20px; }
                .no-print { display: none; }
            }
            """.trimIndent()
                )
            }
        }
    }
    body {
        div {
            h1 { text("Pedido de Compra #${pedido.id}") }
            div { text("Orçamento: #${pedido.orcamentoId} - ${pedido.orcamentoTitulo}") }
            div { text("Fornecedor: ${pedido.fornecedorNome}") }
            if (pedido.fornecedorDados != null) {
                val f = pedido.fornecedorDados
                if (!f.cnpjCpf.isNullOrBlank()) div { text("CNPJ/CPF: ${f.cnpjCpf}") }
                if (!f.enderecoCompleto.isNullOrBlank()) div { text("Endereço: ${f.enderecoCompleto}") }
                if (!f.telefones.isNullOrBlank()) div { text("Telefone: ${f.telefones}") }
                if (!f.email.isNullOrBlank()) div { text("E-mail: ${f.email}") }
            }
            div { text("Data de Confirmação: ${pedido.dataConfirmacao}") }
            div { text("Forma de Pagamento: ${pedido.formaPagamento}") }
        }

        h2 { text("Itens do Pedido") }
        table {
            thead {
                tr {
                    th { text("Item") }
                    th { text("Insumo") }
                    th { text("Qtd") }
                    th { text("Preço Unit.") }
                    th { text("Total") }
                }
            }
            tbody {
                pedido.itens.forEachIndexed { index, item ->
                    tr {
                        td { text("${index + 1}") }
                        td { text("${item.insumoNome ?: "Insumo #${item.insumoId}"}") }
                        td { text(item.quantidade.toString()) }
                        td { text("R$ ${item.precoUnitario.formatBrazilianCurrency()}") }
                        td { text("R$ ${item.total.formatBrazilianCurrency()}") }
                    }
                }
            }
        }

        div {
            p { text("Subtotal dos Itens: R$ ${pedido.valorTotalItens.formatBrazilianCurrency()}") }
            p { text("Frete: R$ ${pedido.valorFrete.formatBrazilianCurrency()}") }
            p { text("Valor Final Confirmado: R$ ${pedido.valorFinalConfirmado.formatBrazilianCurrency()}") }
        }

        div {
            p { text("Data de Impressão: $dataImpressao") }
        }
    }
}

fun HTML.gerarHtmlCompra(dados: Map<String, Any>) {
    val compra = dados["compra"] as org.example.CompraRelatorio
    val dataImpressao = dados["dataImpressao"] as String

    head {
        meta { charset = "utf-8" }
        title("Compra #${compra.id}")
        style {
            unsafe {
                raw(
                    """
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 30px; font-size: 18px; }
            .info { margin: 10px 0; }
            .info span { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .total { font-weight: bold; font-size: 16px; text-align: right; margin-top: 10px; }
            .footer { margin-top: 40px; font-size: 12px; color: #777; text-align: center; }
            @media print {
                body { margin: 20px; }
                .no-print { display: none; }
            }
            """.trimIndent()
                )
            }
        }
    }
    body {
        div {
            h1 { text("Compra #${compra.id}") }
            if (compra.orcamentoId != null) {
                div { text("Orçamento: #${compra.orcamentoId}") }
            }
            if (compra.fornecedorNome != null) {
                div { text("Fornecedor: ${compra.fornecedorNome}") }
            }
            if (compra.justificativa != null) {
                div { text("Justificativa: ${compra.justificativa}") }
            }
            div { text("Data de Criação: ${compra.dataCriacao}") }
            if (compra.dataPrevistaNecessidade != null) {
                div { text("Prazo de Recebimento: ${compra.dataPrevistaNecessidade}") }
            }
            div { text("Status: ${compra.status}") }
        }

        h2 { text("Itens da Compra") }
        table {
            thead {
                tr {
                    th { text("Item") }
                    th { text("Insumo") }
                    th { text("Unidade") }
                    th { text("Qtd Solicitada") }
                    th { text("Qtd Comprada") }
                    th { text("Qtd Recebida") }
                    th { text("Preço Unit.") }
                }
            }
            tbody {
                compra.itens.forEachIndexed { index, item ->
                    tr {
                        td { text("${index + 1}") }
                        td { text(item.insumoNome) }
                        td { text(item.unidadeSigla ?: "-") }
                        td { text(item.quantidadeSolicitada.toString()) }
                        td { text(item.quantidadeComprada.toString()) }
                        td { text(item.quantidadeRecebida.toString()) }
                        td { text("R$ ${item.precoUnitario.formatBrazilianCurrency()}") }
                    }
                }
            }
        }

        div {
            p { text("Valor Total: R$ ${compra.valorTotal.formatBrazilianCurrency()}") }
        }

        div {
            p { text("Data de Impressão: $dataImpressao") }
        }
    }
}

fun Double.formatBrazilianCurrency(): String = String.format("%.2f", this)
