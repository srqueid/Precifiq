import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Package, Calendar, CheckCircle, Eye, X, Printer, Sparkles, Plus } from 'lucide-react';
import { NfeImportModal } from '../components/NfeImportModal';
import { ManualCompraModal } from '../components/ManualCompraModal';

interface Compra {
  id: number;
  orcamentoId: number | null;
  fornecedorId: number | null;
  justificativa: string | null;
  dataPrevistaNecessidade: string | null;
  dataCriacao: string;
  status: string;
  valorTotal: number;
}

interface ItemCompra {
  id: number;
  compraId: number;
  itemOrcamentoId: number | null;
  insumoId: number;
  insumoNome: string;
  unidadeSigla: string | null;
  quantidadeSolicitada: number;
  quantidadeComprada: number;
  quantidadeRecebida: number;
  precoUnitario: number;
  fornecedorSugeridoId: number | null;
  ativo: boolean;
}

type ReceberItemPayload = {
  id: number;
  quantidadeRecebida: number;
};

const parseNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ComprasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNfeModal, setShowNfeModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [freteValue, setFreteValue] = useState<string>('');
  const [recebimentoItens, setRecebimentoItens] = useState<Record<number, { checked: boolean; quantidade: string }>>({});

  const { data: compras = [], isLoading } = useQuery<Compra[]>({
    queryKey: ['compras'],
    queryFn: async () => {
      const res = await fetch('/compras');
      if (!res.ok) throw new Error('Erro ao buscar compras');
      return res.json();
    }
  });

  const receberCompraMutation = useMutation({
    mutationFn: async ({ id, valorFreteFinal, itens }: { id: number, valorFreteFinal: number, itens: ReceberItemPayload[] }) => {
      const res = await fetch(`/compras/${id}/receber`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valorFreteFinal, itens })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || 'Falha ao receber compra');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] });
      if (selectedCompra) {
        queryClient.invalidateQueries({ queryKey: ['compra', selectedCompra.id] });
      }
      setShowDetailsModal(false);
    },
    onError: (error: Error) => {
      alert(error.message || 'Não foi possível confirmar o recebimento da compra.');
    }
  });

  const handleViewDetails = (compra: Compra) => {
    setSelectedCompra(compra);
    setFreteValue(compra.valorTotal.toString());
    setShowDetailsModal(true);
  };

  const getRecebimentoItem = (item: ItemCompra) => recebimentoItens[item.id] ?? { checked: false, quantidade: '' };

  const updateRecebimentoItem = (itemId: number, updates: Partial<{ checked: boolean; quantidade: string }>) => {
    setRecebimentoItens(previous => ({
      ...previous,
      [itemId]: {
        checked: previous[itemId]?.checked ?? false,
        quantidade: previous[itemId]?.quantidade ?? '',
        ...updates
      }
    }));
  };

  const { data: compraDetails, isLoading: isLoadingDetails } = useQuery<{ compra: Compra, itens: ItemCompra[] } | null>({
    queryKey: ['compra', selectedCompra?.id],
    queryFn: async () => {
      if (!selectedCompra) return null;
      const res = await fetch(`/compras/${selectedCompra.id}`);
      if (!res.ok) throw new Error('Erro ao buscar detalhes da compra');
      return res.json();
    },
    enabled: !!selectedCompra && showDetailsModal
  });

  const itensParaReceber = compraDetails?.itens ?? [];
  const canConfirmarRecebimento = selectedCompra?.status === 'PENDENTE'
    && itensParaReceber.length > 0
    && itensParaReceber.every(item => {
      const recebimento = getRecebimentoItem(item);
      const quantidade = parseNumber(recebimento.quantidade);
      return recebimento.checked && Number.isFinite(quantidade) && quantidade > 0 && quantidade <= item.quantidadeSolicitada;
    });

  const handleConfirmarRecebimento = () => {
    if (!selectedCompra || !compraDetails) return;

    if (!canConfirmarRecebimento) {
      alert('Marque todos os produtos e informe a quantidade entregue de cada um antes de confirmar o recebimento.');
      return;
    }

    receberCompraMutation.mutate({
      id: selectedCompra.id,
      valorFreteFinal: parseNumber(freteValue),
      itens: itensParaReceber.map(item => ({
        id: item.id,
        quantidadeRecebida: parseNumber(getRecebimentoItem(item).quantidade)
      }))
    });
  };

  useEffect(() => {
    setRecebimentoItens({});
    if (selectedCompra) {
      setFreteValue(selectedCompra.valorTotal.toString());
    }
  }, [selectedCompra?.id, selectedCompra?.valorTotal]);

  const filteredCompras = compras.filter(c => {
    const term = search.toLowerCase();
    return c.id.toString().includes(term) ||
           (c.dataPrevistaNecessidade?.toLowerCase() || '').includes(term) ||
           (c.justificativa?.toLowerCase() || '').includes(term);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDENTE': return <span className="badge badge-yellow">Pendente</span>;
      case 'RECEBIDO': return <span className="badge badge-green">Recebido</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  // Loading skeleton
  const renderTableSkeleton = () => (
    <div className="table-wrapper">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['ID', 'Data Criação', 'Prazo', 'Status', 'Valor Total', 'Ações'].map((h, i) => (
                <th key={i} className="table-cell">
                  <div className="skeleton skeleton-text" style={{ width: i === 1 ? '120px' : i === 4 ? '100px' : '80px' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {Array(6).fill(0).map((_, j) => (
                  <td key={j} className="table-cell">
                    <div className="skeleton skeleton-text" style={{ width: j === 1 ? '120px' : j === 4 ? '100px' : '80px' }} />
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
    <div className="page compras-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <Package size={24} />
          </div>
          <div>
            <h1 className="page-title">Compras</h1>
            <p className="page-subtitle">Gerenciamento de compras recebidas e pendentes</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações e filtros de compras" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowManualModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={18} />
            Nova Compra Manual
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowNfeModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1.1rem',
              fontWeight: '600',
              fontSize: '0.875rem',
              boxShadow: '0 2px 10px rgba(168, 85, 247, 0.3)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Sparkles size={17} />
            Importar NF-e (IA)
          </button>

          <div className="search-input-wrapper">
            <label htmlFor="compraSearch" className="sr-only">Buscar compras</label>
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              id="compraSearch"
              type="text"
              placeholder="Buscar por ID, prazo ou justificativa..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar compras"
            />
          </div>
        </div>
      </section>

        {isLoading && renderTableSkeleton()}

      {!isLoading && (
        <div className="table-wrapper">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell text-center">ID</th>
                  <th className="table-cell">Data Criação</th>
                  <th className="table-cell">Prazo</th>
                  <th className="table-cell">Status</th>
                  <th className="table-cell text-right">Valor Total</th>
                  <th className="table-cell text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompras.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Package className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="empty-state-title">
                          {search ? 'Nenhuma compra encontrada' : 'Nenhuma compra encontrada'}
                        </h3>
                        <p className="empty-state-description">
                          {search
                            ? 'Tente ajustar os termos da busca para encontrar o que procura.'
                            : 'Vá em Pedidos de Compra e converta-os para gerar compras.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCompras.map(compra => (
                    <tr key={compra.id}>
                      <td className="table-cell font-medium text-gray-500">#{compra.id}</td>
                      <td className="table-cell text-gray-600">
                        <span className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          {compra.dataCriacao}
                        </span>
                      </td>
                      <td className="table-cell text-gray-600">{compra.dataPrevistaNecessidade || '-'}</td>
                      <td className="table-cell">{getStatusBadge(compra.status)}</td>
                      <td className="table-cell text-right">
                        <span className="font-medium td-mono">R$ {compra.valorTotal.toFixed(2)}</span>
                      </td>
                      <td className="table-cell">
                        <div className="action-buttons justify-center">
                          <button
                            onClick={() => window.open(`/compras/${compra.id}/imprimir`, '_blank')}
                            className="btn btn-ghost btn-sm"
                            aria-label="Imprimir"
                            title="Imprimir Compra"
                          >
                            <Printer size={16} />
                          </button>
                          {compra.status === 'PENDENTE' && (
                            <button
                              onClick={() => handleViewDetails(compra)}
                              className="btn btn-success btn-sm"
                              aria-label="Confirmar recebimento"
                              title="Confirmar recebimento"
                            >
                              <CheckCircle size={16} /> Receber
                            </button>
                          )}
                          {compra.status === 'RECEBIDO' && (
                            <button
                              onClick={() => handleViewDetails(compra)}
                              className="btn btn-ghost btn-sm"
                              aria-label="Ver detalhes"
                              title="Ver detalhes"
                            >
                              <Eye size={16} /> Detalhes
                            </button>
                          )}
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

      {/* Modal de Detalhes da Compra */}
      {showDetailsModal && selectedCompra && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Detalhes da Compra #{selectedCompra.id}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`/compras/${selectedCompra.id}/imprimir`, '_blank')}
                    className="btn btn-ghost btn-sm"
                    title="Imprimir compra"
                  >
                    <Printer size={16} /> Imprimir
                  </button>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {isLoadingDetails ? (
                <div className="space-y-4">
                  <div className="skeleton skeleton-text h-4"></div>
                  <div className="skeleton skeleton-text h-4 w-3/4"></div>
                </div>
              ) : compraDetails && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="text-sm text-gray-500">Data Criação</label>
                      <p className="font-medium">{compraDetails.compra.dataCriacao}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Prazo de Recebimento</label>
                      <p className="font-medium">{compraDetails.compra.dataPrevistaNecessidade || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Status</label>
                      <p className="font-medium">{getStatusBadge(compraDetails.compra.status)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Valor Total</label>
                      <p className="font-medium td-mono">R$ {compraDetails.compra.valorTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-3">Itens da Compra</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2">Produto</th>
                          <th className="text-right py-2">Qtd Solicitada</th>
                          <th className="text-center py-2">Receber</th>
                          <th className="text-right py-2">Qtd Entregue</th>
                          <th className="text-right py-2">Qtd Recebida</th>
                          <th className="text-right py-2">Preço Unitário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compraDetails.itens.map(item => {
                          const recebimento = getRecebimentoItem(item);
                          return (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="py-2">
                                <div className="font-medium text-gray-900">{item.insumoNome || `Insumo #${item.insumoId}`}</div>
                                <div className="text-xs text-gray-500">
                                  ID #{item.insumoId}{item.unidadeSigla ? ` · ${item.unidadeSigla}` : ''}
                                </div>
                              </td>
                              <td className="text-right py-2">{item.quantidadeSolicitada}</td>
                              <td className="text-center py-2">
                                <input
                                  type="checkbox"
                                  checked={recebimento.checked}
                                  disabled={compraDetails.compra.status !== 'PENDENTE'}
                                  onChange={(e) => updateRecebimentoItem(item.id, { checked: e.target.checked, quantidade: e.target.checked ? recebimento.quantidade : '' })}
                                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  aria-label={`Receber ${item.insumoNome || `Insumo #${item.insumoId}`}`}
                                />
                              </td>
                              <td className="text-right py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.quantidadeSolicitada}
                                  step="0.001"
                                  value={recebimento.quantidade}
                                  disabled={!recebimento.checked || compraDetails.compra.status !== 'PENDENTE'}
                                  onChange={(e) => updateRecebimentoItem(item.id, { quantidade: e.target.value })}
                                  className="w-28 px-2 py-1 text-right border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-gray-100 disabled:text-gray-400"
                                  placeholder="0"
                                />
                              </td>
                              <td className="text-right py-2">{item.quantidadeRecebida}</td>
                              <td className="text-right py-2 td-mono">R$ {item.precoUnitario.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {compraDetails.compra.status === 'PENDENTE' && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 mb-4">
                        Marque cada produto e informe a quantidade entregue. A compra só será recebida quando todos os itens forem marcados.
                      </div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor Final do Frete
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={freteValue}
                        onChange={(e) => setFreteValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-500"
                        placeholder="Informe o valor do frete"
                      />
                      <div className="flex justify-end gap-3 mt-4">
                        <button
                          onClick={() => setShowDetailsModal(false)}
                          className="btn btn-ghost"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleConfirmarRecebimento}
                          disabled={!canConfirmarRecebimento || receberCompraMutation.isPending}
                          className="btn btn-success"
                          title={!canConfirmarRecebimento ? 'Marque todos os produtos e informe as quantidades entregues' : undefined}
                        >
                          <CheckCircle size={16} />
                          {receberCompraMutation.isPending ? 'Recebendo...' : 'Confirmar Recebimento'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação Inteligente de NF-e (IA) */}
      <NfeImportModal
        isOpen={showNfeModal}
        onClose={() => setShowNfeModal(false)}
        onSuccess={(compraId) => {
          setShowNfeModal(false);
          queryClient.invalidateQueries({ queryKey: ['compras'] });
        }}
      />

      {/* Modal de Inserção Manual de Compra */}
      <ManualCompraModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSuccess={(compraId) => {
          setShowManualModal(false);
          queryClient.invalidateQueries({ queryKey: ['compras'] });
        }}
      />
    </div>
  );
};

export default ComprasPage;
