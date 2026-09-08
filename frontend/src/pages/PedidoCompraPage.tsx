import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart, FileText, Save, Truck, CreditCard, Calendar, RefreshCw, Package, Printer } from 'lucide-react';

// Tipagens
interface OrcamentoItem {
  id: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface PedidoCompra {
  id: number;
  nome: string;
  status: 'ORCAMENTO' | 'COMPRA' | 'FINALIZADO';
  fornecedorNome: string;
  valorTotalItens: number;
  valorFrete: number;
  metodoPagamento?: string;
  prazoRecebimento?: string;
  itens: OrcamentoItem[];
}

const fetchPedido = async (id: string): Promise<PedidoCompra> => {
  const res = await fetch(`/pedidos/${id}`);
  if (!res.ok) {
    throw new Error('Erro ao buscar dados do pedido.');
  }
  const data = await res.json();
  return {
    id: data.id,
    nome: `Pedido #${data.id}`,
    status: data.status === 'PENDENTE' ? 'COMPRA' : 'FINALIZADO',
    fornecedorNome: data.fornecedor?.nomeEmpresa || data.fornecedor?.nome || 'Desconhecido',
    valorTotalItens: data.valorTotalItens || 0,
    valorFrete: data.valorFrete || 0,
    metodoPagamento: data.formaPagamento,
    prazoRecebimento: '',
    itens: (data.itens || []).map((item: any) => ({
      id: item.id,
      descricao: item.insumoNome || `Insumo #${item.insumoId}`,
      quantidade: item.quantidade || 0,
      valorUnitario: item.precoUnitario || 0,
      valorTotal: item.total || (item.quantidade || 0) * (item.precoUnitario || 0),
    })),
  };
};

const PedidoCompraPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pedido, isLoading, error } = useQuery({
    queryKey: ['pedidoCompra', id],
    queryFn: () => fetchPedido(id!),
    enabled: !!id,
  });

  const [frete, setFrete] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [prazoRecebimento, setPrazoRecebimento] = useState('');

  useEffect(() => {
    if (pedido) {
      setFrete(pedido.valorFrete.toString());
      setMetodoPagamento(pedido.metodoPagamento || '');
      setPrazoRecebimento(pedido.prazoRecebimento || '');
    }
  }, [pedido]);

  const showSuccess = (message: string) => {
    alert(message);
    queryClient.invalidateQueries({ queryKey: ['pedidoCompra', id] });
    queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
  };

  const showError = (err: Error) => {
    alert(`Erro: ${err.message}`);
  };

  const freteMutation = useMutation({
    mutationFn: (newFrete: number) => fetch(`/pedidos/${id}/frete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ frete: newFrete.toString() }),
    }),
    onSuccess: () => showSuccess('Valor do frete atualizado.'),
    onError: showError,
  });

  const retornarOrcamentoMutation = useMutation({
    mutationFn: () => fetch(`/pedidos/${id}/retornar-orcamento`, { method: 'POST' }),
    onSuccess: () => {
      alert('Pedido retornado para orçamento.');
      navigate('/orcamentos');
    },
    onError: showError,
  });

  const converterCompraMutation = useMutation({
    mutationFn: () => fetch(`/pedidos/${id}/converter-compra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ formaPagamento: metodoPagamento, prazoRecebimento }),
    }),
    onSuccess: () => showSuccess('Pedido convertido em compra!'),
    onError: showError,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="skeleton skeleton-title mx-auto mb-4" style={{ width: '200px' }} />
        <p className="text-gray-500">Carregando pedido...</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="card text-center">
        <p className="text-red-600">Erro: {error.message}</p>
      </div>
    </div>
  );
  if (!pedido) return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="empty-state">
        <div className="empty-state-icon">
          <Package className="w-16 h-16 mx-auto" />
        </div>
        <h3 className="empty-state-title">Pedido não encontrado</h3>
        <p className="empty-state-description">O pedido solicitado não existe ou foi removido.</p>
      </div>
    </div>
  );

  const valorTotalCalculado = pedido.valorTotalItens + Number(frete || 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPRA': return <span className="badge badge-green">Compra</span>;
      case 'FINALIZADO': return <span className="badge badge-blue">Finalizado</span>;
      case 'ORCAMENTO': return <span className="badge badge-gray">Orçamento</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/orcamentos')}
            className="btn btn-ghost"
          >
            <ArrowLeft size={20} /> Voltar para Orçamentos
          </button>
          <button
            onClick={() => window.open(`/pedidos/${id}/imprimir`, '_blank')}
            className="btn btn-ghost"
            title="Imprimir pedido"
          >
            <Printer size={18} /> Imprimir
          </button>
        </div>

        <div className="card mb-6">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{pedido.nome}</h1>
              <p className="text-gray-600 mt-1">Fornecedor: <span className="font-medium">{pedido.fornecedorNome}</span></p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(pedido.status)}
              <span className="text-sm text-gray-500 td-mono">#{pedido.id}</span>
            </div>
          </div>

          {/* Itens do Pedido */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-gray-400" />
              Itens do Pedido
            </h2>
            <div className="table-wrapper">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-right">Qtd</th>
                      <th className="px-4 py-3 text-right">Valor Unit.</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.itens.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium">{item.descricao}</td>
                        <td className="px-4 py-3 text-right td-mono">{item.quantidade}</td>
                        <td className="px-4 py-3 text-right td-mono">R$ {item.valorUnitario.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium td-mono">R$ {item.valorTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                    {pedido.itens.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-500">
                          Nenhum item no pedido.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <div className="text-right">
                <p className="text-sm text-gray-500">Subtotal dos Itens</p>
                <p className="text-xl font-bold text-gray-900 td-mono">R$ {pedido.valorTotalItens.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detalhes da Compra */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Truck size={18} className="text-emerald-600" />
            Detalhes da Compra
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="form-group">
              <label htmlFor="frete" className="flex items-center gap-2">
                <Truck size={16} className="text-gray-400" />
                Valor do Frete (R$)
              </label>
              <input
                id="frete"
                type="number"
                step="0.01"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                className="w-full"
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label htmlFor="metodoPagamento" className="flex items-center gap-2">
                <CreditCard size={16} className="text-gray-400" />
                Método de Pagamento
              </label>
              <input
                id="metodoPagamento"
                type="text"
                value={metodoPagamento}
                onChange={(e) => setMetodoPagamento(e.target.value)}
                className="w-full"
                placeholder="Ex: Boleto 30/60/90"
              />
            </div>
            <div className="form-group">
              <label htmlFor="prazoRecebimento" className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" />
                Prazo de Recebimento
              </label>
              <input
                id="prazoRecebimento"
                type="text"
                value={prazoRecebimento}
                onChange={(e) => setPrazoRecebimento(e.target.value)}
                className="w-full"
                placeholder="Ex: 15 dias úteis"
              />
            </div>
            <div className="form-group">
              <label className="text-sm text-gray-500">Valor Final Calculado</label>
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-2xl font-bold text-emerald-600 td-mono">R$ {valorTotalCalculado.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Itens + Frete</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col md:flex-row justify-end gap-3">
          <button 
            onClick={() => retornarOrcamentoMutation.mutate()} 
            className="btn btn-ghost flex items-center justify-center gap-2 text-orange-600 hover:bg-orange-50"
            disabled={retornarOrcamentoMutation.isPending}
          >
            <RefreshCw size={18}/> Retornar para Orçamento
          </button>
          <button 
            onClick={() => converterCompraMutation.mutate()} 
            className="btn btn-success flex items-center justify-center gap-2"
            disabled={converterCompraMutation.isPending}
          >
            <ShoppingCart size={18}/> Converter em Compra
          </button>
        </div>
      </div>
    </div>
  );
};

export default PedidoCompraPage;