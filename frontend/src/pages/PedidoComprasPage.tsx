import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, Calendar, DollarSign, Truck, Edit, RotateCcw, CheckCircle, X, Printer, Eye } from 'lucide-react';

interface PedidoCompraView {
  id: number;
  orcamentoId: number;
  orcamentoTitulo: string;
  fornecedorId: number;
  fornecedorNome: string;
  dataConfirmacao: string;
  valorTotalItens: number;
  valorFrete: number;
  valorFinalConfirmado: number;
  formaPagamento: string;
}

const PedidoComprasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orcamentoIdFilter = searchParams.get('orcamentoId');
  const [search, setSearch] = useState('');
  const [editingFrete, setEditingFrete] = useState<number | null>(null);
  const [freteValue, setFreteValue] = useState<string>('');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoCompraView | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX');
  const [prazoRecebimento, setPrazoRecebimento] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailPedido, setDetailPedido] = useState<PedidoCompraView | null>(null);

  const { data: pedidos = [], isLoading } = useQuery<PedidoCompraView[]>({
    queryKey: ['pedidos-compra'],
    queryFn: async () => {
      const res = await fetch('/pedidos-compra/json');
      if (!res.ok) throw new Error('Erro ao buscar pedidos de compra');
      const data = await res.json();
      return data.pedidos || [];
    }
  });

  const updateFreteMutation = useMutation({
    mutationFn: async ({ id, frete }: { id: number, frete: number }) => {
      const res = await fetch(`/pedidos-compra/${id}/frete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ frete: frete.toString() })
      });
      if (!res.ok) throw new Error('Falha ao atualizar frete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
      setEditingFrete(null);
    }
  });

  const returnToOrcamentoMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/pedidos-compra/${id}/retornar-orcamento`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao retornar para orçamento');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    }
  });

  const convertToCompraMutation = useMutation({
    mutationFn: async ({ id, formaPagamento, prazoRecebimento }: { id: number, formaPagamento: string, prazoRecebimento: string }) => {
      const res = await fetch(`/pedidos-compra/${id}/converter-compra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ formaPagamento, prazoRecebimento })
      });
      if (!res.ok) throw new Error('Falha ao converter para compra');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      setShowConvertModal(false);
    }
  });

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['pedido-compra-detalhe', detailPedido?.id],
    queryFn: async () => {
      if (!detailPedido) return null;
      const res = await fetch(`/pedidos-compra/${detailPedido.id}/relatorio`);
      if (!res.ok) throw new Error('Erro ao buscar detalhes do pedido');
      return res.json();
    },
    enabled: !!detailPedido && showDetailModal
  });

  const handleEditFrete = (pedido: PedidoCompraView) => {
    setEditingFrete(pedido.id);
    setFreteValue(pedido.valorFrete.toString());
  };

  const handleSaveFrete = (id: number) => {
    updateFreteMutation.mutate({ id, frete: Number(freteValue) });
  };

  const handleReturn = (pedido: PedidoCompraView) => {
    if (window.confirm(`Deseja retornar o pedido #${pedido.id} para o orçamento? Os itens voltarão a ficar ativos.`)) {
      returnToOrcamentoMutation.mutate(pedido.id);
    }
  };

  const handleConvertClick = (pedido: PedidoCompraView) => {
    setSelectedPedido(pedido);
    setFormaPagamento('PIX');
    setPrazoRecebimento('');
    setShowConvertModal(true);
  };

  const handleViewDetail = (pedido: PedidoCompraView) => {
    setDetailPedido(pedido);
    setShowDetailModal(true);
  };

  const handleConfirmConvert = () => {
    if (selectedPedido) {
      convertToCompraMutation.mutate({
        id: selectedPedido.id,
        formaPagamento,
        prazoRecebimento
      });
    }
  };

  const filteredPedidos = pedidos.filter(p => {
    const term = search.toLowerCase();
    const matchesSearch = (p.fornecedorNome?.toLowerCase() || '').includes(term) || 
           (p.orcamentoTitulo?.toLowerCase() || '').includes(term) || 
           p.id.toString().includes(term);

    return matchesSearch && (!orcamentoIdFilter || p.orcamentoId.toString() === orcamentoIdFilter);
  });

  const getStatusBadge = (formaPagamento: string) => {
    switch (formaPagamento) {
      case 'PIX': return <span className="badge badge-green">PIX</span>;
      case 'Boleto': return <span className="badge badge-blue">Boleto</span>;
      case 'Cartão': return <span className="badge badge-purple">Cartão</span>;
      case 'A Combinar': return <span className="badge badge-gray">A Combinar</span>;
      default: return <span className="badge badge-gray">{formaPagamento}</span>;
    }
  };

  // Loading skeleton
  const renderTableSkeleton = () => (
    <div className="table-wrapper">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['ID', 'Fornecedor', 'Orçamento', 'Data', 'Forma Pgto', 'Valor Total', 'Ações'].map((h, i) => (
                <th key={i} className="px-6 py-4 text-left">
                  <div className="skeleton skeleton-text" style={{ width: i === 1 ? '150px' : i === 5 ? '100px' : '80px' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {Array(7).fill(0).map((_, j) => (
                  <td key={j} className="px-6 py-4">
                    <div className="skeleton skeleton-text" style={{ width: j === 1 ? '150px' : j === 5 ? '100px' : '80px' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="page pedidos-compra-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h1 className="page-title">Pedidos de Compra</h1>
            <p className="page-subtitle">Gerenciamento de pedidos gerados a partir de orçamentos convertidos</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações e filtros de pedidos de compra">
          <div className="search-input-wrapper">
            <label htmlFor="pedidoCompraSearch" className="sr-only">Buscar pedidos de compra</label>
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              id="pedidoCompraSearch"
              type="text"
              placeholder="Buscar por fornecedor, orçamento ou ID do pedido..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar pedidos de compra"
            />
          </div>
        </div>
      </section>

      {orcamentoIdFilter && (
        <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 border border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-emerald-800">Exibindo pedidos do orçamento #{orcamentoIdFilter}</span>
            <button onClick={() => navigate('/pedidos')} className="text-sm font-medium text-emerald-600 hover:underline">Ver todos os pedidos</button>
          </div>
        </div>
      )}

        {isLoading && renderTableSkeleton()}

      {!isLoading && (
        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell">ID</th>
                  <th className="table-cell">Fornecedor</th>
                  <th className="table-cell">Orçamento</th>
                  <th className="table-cell">Data</th>
                  <th className="table-cell">Forma Pgto</th>
                  <th className="table-cell text-right">Valor Total</th>
                  <th className="table-cell text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <ShoppingCart className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="empty-state-title">
                          {search ? 'Nenhum pedido encontrado' : 'Nenhum pedido de compra encontrado'}
                        </h3>
                        <p className="empty-state-description">
                          {search 
                            ? 'Tente ajustar os termos da busca para encontrar o que procura.'
                            : 'Vá em Orçamentos e converta cotações para gerar pedidos.'
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPedidos.map(pedido => (
                    <tr key={pedido.id}>
                      <td className="table-cell font-medium text-gray-500">#{pedido.id}</td>
                      <td className="table-cell font-medium">{pedido.fornecedorNome}</td>
                      <td className="table-cell text-gray-600">
                        <span className="text-sm">#{pedido.orcamentoId}</span>
                        <span className="text-gray-400 mx-1">-</span>
                        <span className="truncate max-w-[200px] inline-block align-bottom" title={pedido.orcamentoTitulo}>{pedido.orcamentoTitulo}</span>
                      </td>
                      <td className="table-cell text-gray-600">
                        <span className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {pedido.dataConfirmacao}
                        </span>
                      </td>
                      <td className="table-cell">{getStatusBadge(pedido.formaPagamento)}</td>
                      <td className="table-cell text-right">
                        <div>
                          <span className="font-medium td-mono">R$ {pedido.valorFinalConfirmado.toFixed(2)}</span>
                          {editingFrete === pedido.id ? (
                            <div className="flex items-center gap-1 mt-1">
                              <input 
                                type="number" 
                                step="0.01"
                                value={freteValue} 
                                onChange={e => setFreteValue(e.target.value)} 
                                className="w-20 text-right border-b border-emerald-500 focus:outline-none td-mono text-sm" 
                              />
                              <button 
                                onClick={() => handleSaveFrete(pedido.id)} 
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                aria-label="Salvar frete"
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button 
                                onClick={() => setEditingFrete(null)} 
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                aria-label="Cancelar edição"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Truck size={12} /> Frete: R$ {pedido.valorFrete.toFixed(2)}
                              <button 
                                onClick={() => handleEditFrete(pedido)} 
                                className="p-0.5 text-gray-400 hover:text-gray-600"
                                aria-label="Editar frete"
                              >
                                <Edit size={12} />
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="action-buttons justify-center">
                          <button
                            onClick={() => window.open(`/pedidos-compra/${pedido.id}/imprimir`, '_blank')}
                            className="btn btn-ghost btn-sm"
                            aria-label="Imprimir"
                            title="Imprimir Pedido"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            onClick={() => handleViewDetail(pedido)}
                            className="btn btn-ghost btn-sm"
                            aria-label="Ver detalhes"
                            title="Ver Detalhes"
                          >
                            <Eye size={16} /> Detalhes
                          </button>
                          <button
                            onClick={() => handleReturn(pedido)}
                            className="btn btn-ghost btn-sm text-orange-600 hover:bg-orange-50"
                            disabled={returnToOrcamentoMutation.isPending}
                            aria-label="Retornar para orçamento"
                            title="Retornar para orçamento"
                          >
                            <RotateCcw size={16} /> Retornar
                          </button>
                          <button
                            onClick={() => handleConvertClick(pedido)}
                            className="btn btn-success btn-sm"
                            disabled={convertToCompraMutation.isPending}
                            aria-label="Converter para compra"
                            title="Converter para compra"
                          >
                            <CheckCircle size={16} /> Converter
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Pedido */}
      {showDetailModal && detailPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Pedido de Compra #{detailPedido.id}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`/pedidos-compra/${detailPedido.id}/imprimir`, '_blank')}
                    className="btn btn-ghost btn-sm"
                    title="Imprimir pedido"
                  >
                    <Printer size={16} /> Imprimir
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {isLoadingDetail ? (
                <div className="space-y-4">
                  <div className="skeleton skeleton-text h-4"></div>
                  <div className="skeleton skeleton-text h-4 w-3/4"></div>
                </div>
              ) : detailData ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="text-sm text-gray-500">Orçamento</label>
                      <p className="font-medium">#{detailData.orcamentoId} - {detailData.orcamentoTitulo}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Fornecedor</label>
                      <p className="font-medium">{detailData.fornecedorNome}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Data de Confirmação</label>
                      <p className="font-medium">{detailData.dataConfirmacao}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Forma de Pagamento</label>
                      <p className="font-medium">{detailData.formaPagamento}</p>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-3">Itens do Pedido</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2">Item</th>
                          <th className="text-left py-2">Insumo</th>
                          <th className="text-right py-2">Qtd</th>
                          <th className="text-right py-2">Preço Unit.</th>
                          <th className="text-right py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.itens.map((item: any, idx: number) => (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-2">{idx + 1}</td>
                            <td className="py-2 font-medium">{item.insumoNome}</td>
                            <td className="py-2 text-right">{item.quantidade}</td>
                            <td className="py-2 text-right td-mono">R$ {item.precoUnitario.toFixed(2)}</td>
                            <td className="py-2 text-right font-medium td-mono">R$ {item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal dos Itens</span>
                      <span className="font-medium td-mono">R$ {detailData.valorTotalItens.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Frete</span>
                      <span className="font-medium td-mono">R$ {detailData.valorFrete.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="font-bold">Valor Final</span>
                      <span className="font-bold td-mono text-emerald-600">R$ {detailData.valorFinalConfirmado.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-gray-500">Erro ao carregar detalhes.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for conversion */}
      {showConvertModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Converter Pedido #{selectedPedido.id}
                </h2>
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma de Pagamento
                </label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500"
                >
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão">Cartão</option>
                  <option value="A Combinar">A Combinar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prazo de Recebimento
                </label>
                <input
                  type="text"
                  value={prazoRecebimento}
                  onChange={(e) => setPrazoRecebimento(e.target.value)}
                  placeholder="Ex: 15 dias, 30 dias, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmConvert}
                  disabled={convertToCompraMutation.isPending}
                  className="btn btn-success"
                >
                  <CheckCircle size={16} />
                  Confirmar Conversão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidoComprasPage;
