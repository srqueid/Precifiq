package org.example.repository

class AppDatabase {
    val unidadesMedida = UnidadesMedidaRepository()
    val fornecedores = FornecedorRepository()
    val clientes = ClienteRepository()
    val insumos = InsumoRepository()
    val produtosFinais = ProdutoFinalRepository()
    val custosOperacionais = CustosOperacionaisRepository()
    val orcamentos = OrcamentoRepository()
    val pedidosCompra = PedidoCompraRepository()
    val compras = CompraRepository()
    val pedidos = PedidoRepository()
    val movimentosEstoque = MovimentoEstoqueRepository()
    val unidadesCompra = UnidadeCompraInsumoRepository()
    val estoque by lazy { org.example.services.EstoqueService(this) }

    companion object {
        val default = AppDatabase() // I'll keep the companion object for now to avoid breaking too much code at once, but will address point 5 later.
    }
}
