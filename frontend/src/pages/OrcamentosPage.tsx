import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, ChevronLeft, ShoppingCart, CheckCircle, ClipboardList, Printer, X, Eye, UserPlus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { onlyNumbers, maskCnpjCpf, maskPhone } from '../utils/masks';

interface Orcamento {
  id: number;
  titulo: string;
  dataCriacao: string;
  status: string;
}

interface Fornecedor {
  id: number;
  nome: string;
  nomeEmpresa?: string;
  nomeFantasia?: string;
  cnpjCpf?: string;
  telefones?: string;
  email?: string;
}

const statusConfig: { [key: string]: { text: string; className: string } } = {
  EM_DIGITACAO: { text: 'Em Digitação', className: 'badge-gray' },
  EM_ORCAMENTO: { text: 'Em Orçamento', className: 'badge-gray' },
  PEDIDO_PARCIAL: { text: 'Pedido Parcial', className: 'badge-yellow' },
  COMPRA_APROVADA: { text: 'Compra Aprovada', className: 'badge-green' },
  CONCLUIDO: { text: 'Concluído', className: 'badge-blue' },
  COMPRA: { text: 'Pedido', className: 'badge-green' },
  CANCELADO: { text: 'Cancelado', className: 'badge-red' },
  FINALIZADO: { text: 'Finalizado', className: 'badge-purple' },
};

const getStatusBadge = (status: string) => {
  const config = statusConfig[status] || { text: status, className: 'badge-gray' };
  return <span className={`badge ${config.className}`}>{config.text}</span>;
};

const OrcamentosPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId) {
    return <OrcamentoDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return <OrcamentoList onSelect={setSelectedId} />;
};

const OrcamentoList: React.FC<{ onSelect: (id: number) => void }> = ({ onSelect }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [titulo, setTitulo] = useState("");

  const { data: orcamentos = [], isLoading } = useQuery<Orcamento[]>({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const res = await fetch('/orcamentos/json');
      if (!res.ok) throw new Error('Erro ao buscar orçamentos');
      const json = await res.json();
      return json.orcamentos || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/orcamentos/deletar/${id}`);
      if (!res.ok) throw new Error('Falha ao excluir');
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/orcamentos/novo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 0, titulo, dataCriacao: '', status: 'EM_DIGITACAO', ativo: true })
      });
      if (!res.ok) throw new Error('Falha ao criar');
      return res.json();
    },
    onSuccess: async (novoOrcamento) => {
      setIsModalOpen(false);
      setTitulo("");
      await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      onSelect(novoOrcamento.id);
    },
  });

  const filtered = orcamentos.filter(o => o.titulo.toLowerCase().includes(search.toLowerCase()));

  const updateTituloMutation = useMutation({
    mutationFn: async ({ id, novoTitulo }: { id: number; novoTitulo: string }) => {
      const res = await fetch(`/orcamentos/${id}/atualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ titulo: novoTitulo })
      });
      if (!res.ok) throw new Error('Falha ao atualizar título');
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    }
  });

  const handleEditTitulo = (e: React.MouseEvent, o: Orcamento) => {
    e.stopPropagation();
    const novo = window.prompt(`Editar título do orçamento #${o.id}:`, o.titulo);
    if (novo && novo.trim() && novo.trim() !== o.titulo) {
      updateTituloMutation.mutate({ id: o.id, novoTitulo: novo.trim() });
    }
  };

  const handleDelete = (id: number, titulo: string) => {
    if (window.confirm(`Deseja realmente excluir o orçamento "${titulo}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Loading skeleton
  const renderTableSkeleton = () => (
    <div className="table-wrapper">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['ID', 'Título', 'Data de Criação', 'Status', 'Ações'].map((h, i) => (
                <th key={i} className="table-cell">
                  <div className="skeleton skeleton-text" style={{ width: i === 1 ? '150px' : '80px' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map(i => (
              <tr key={i}>
                {Array(5).fill(0).map((_, j) => (
                  <td key={j} className="table-cell">
                    <div className="skeleton skeleton-text" style={{ width: j === 1 ? '150px' : '80px' }} />
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
    <div className="page orcamentos-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="page-title">Orçamentos & Compras</h1>
            <p className="page-subtitle">Cotações, planejamento e pedidos de aquisições</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações e filtros de orçamentos">
          <div className="search-input-wrapper">
            <label htmlFor="orcamentoSearch" className="sr-only">Buscar orçamentos</label>
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              id="orcamentoSearch"
              type="text"
              placeholder="Buscar orçamentos..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar orçamentos"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-lg"
          >
            <Plus size={20} />
            Novo Orçamento
          </button>
        </div>
      </section>

        {isLoading && renderTableSkeleton()}

        {isLoading && renderTableSkeleton()}

      {!isLoading && (
        <section className="table-wrapper orcamentos-table-wrapper" aria-label="Lista de orçamentos">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell text-center">ID</th>
                  <th className="table-cell">Título</th>
                  <th className="table-cell">Data de Criação</th>
                  <th className="table-cell">Status</th>
                  <th className="table-cell text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <ClipboardList className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="empty-state-title">
                          {search ? 'Nenhum orçamento encontrado' : 'Nenhum orçamento cadastrado'}
                        </h3>
                        <p className="empty-state-description">
                          {search 
                            ? 'Tente ajustar os termos da busca para encontrar o que procura.'
                            : 'Comece criando um novo orçamento clicando no botão acima.'
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const hasPedidos = o.status === 'PEDIDO_PARCIAL' || o.status === 'COMPRA_APROVADA';
                    const shouldOpenPedidos = o.status === 'COMPRA_APROVADA';

                    return (
                      <tr 
                        key={o.id} 
                        className="cursor-pointer"
                        onClick={() => shouldOpenPedidos ? navigate(`/pedidos?orcamentoId=${o.id}`) : onSelect(o.id)}
                      >
                        <td className="table-cell text-center td-mono">#{o.id}</td>
                        <td className="table-cell font-medium">{o.titulo}</td>
                        <td className="table-cell td-muted">{o.dataCriacao}</td>
                        <td className="table-cell">{getStatusBadge(o.status)}</td>
                        <td className="table-cell table-cell-actions">
                          <div className="action-buttons">
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(`/orcamentos/${o.id}/imprimir`, '_blank'); }}
                              className="btn btn-action btn-icon"
                              aria-label="Imprimir"
                              title="Imprimir Orçamento"
                            >
                              <Printer size={18} />
                            </button>
                            <button
                              onClick={(e) => handleEditTitulo(e, o)}
                              className="btn btn-action btn-icon"
                              aria-label="Editar Título"
                              title="Editar Título"
                            >
                              <Edit2 size={18} />
                            </button>
                            {hasPedidos && (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/pedidos?orcamentoId=${o.id}`); }}
                                className="btn btn-action btn-icon"
                                aria-label="Ver pedidos"
                                title="Ver Pedidos"
                              >
                                <ShoppingCart size={18} />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelect(o.id); }}
                              className="btn btn-action btn-icon"
                              aria-label="Ver Detalhes"
                              title="Ver Detalhes e Cotações"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(o.id, o.titulo); }}
                              className="btn btn-action-danger btn-icon"
                              aria-label="Excluir"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title-orcamento">
            <div className="modal-header">
              <h2 id="modal-title-orcamento" className="modal-title">Novo Orçamento</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <form id="orcamentoForm" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="modal-body">
              <div className="form-group">
                <label htmlFor="titulo" className="required">Título / Motivo</label>
                <input 
                  required 
                  id="titulo"
                  value={titulo} 
                  onChange={e => setTitulo(e.target.value)} 
                  className="w-full" 
                  placeholder="Ex: Compra de embalagens de Março"
                />
              </div>
            </form>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="orcamentoForm"
                className="btn btn-primary"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Criando...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OrcamentoDetail: React.FC<{ id: number, onBack: () => void }> = ({ id, onBack }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [insumoId, setInsumoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [cotacaoModalItem, setCotacaoModalItem] = useState<any>(null);
  const [sugestoesModalOpen, setSugestoesModalOpen] = useState(false);

  const { data: orcData } = useQuery({
    queryKey: ['orcamento', id],
    queryFn: async () => {
      const res = await fetch(`/orcamentos/${id}`);
      if (!res.ok) throw new Error('Erro ao buscar orçamento');
      return res.json();
    }
  });

  const { data: fornecedoresData = [] } = useQuery<Fornecedor[] | { fornecedores?: Fornecedor[] }>({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const res = await fetch('/fornecedores/json');
      if (!res.ok) throw new Error('Erro ao buscar fornecedores');
      const json = await res.json() as Fornecedor[] | { fornecedores?: Fornecedor[] };
      return Array.isArray(json) ? json : (Array.isArray(json.fornecedores) ? json.fornecedores : []);
    }
  });
  const { data: insumosData } = useQuery({ queryKey: ['insumos'], queryFn: async () => (await fetch('/insumos/json')).json() });

  const orcamento = orcData?.orcamento;
  const itens = orcData?.itens?.filter((i: any) => i.ativo) || [];
  const fornecedores = Array.isArray(fornecedoresData) ? fornecedoresData : (Array.isArray(fornecedoresData.fornecedores) ? fornecedoresData.fornecedores : []);
  const insumos = insumosData?.insumos || [];
  const canEditarOrcamento = orcamento && !['COMPRA_APROVADA', 'CONCLUIDO'].includes(orcamento.status);
  const hasPedidos = orcamento && ['PEDIDO_PARCIAL', 'COMPRA_APROVADA'].includes(orcamento.status);

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/orcamentos/${id}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 0, orcamentoId: id, insumoId: Number(insumoId), quantidade: Number(quantidade), ativo: true })
      });
      if (!res.ok) throw new Error('Falha ao adicionar item');
      return res.json();
    },
    onSuccess: async () => {
      setInsumoId(''); setQuantidade('');
      await queryClient.invalidateQueries({ queryKey: ['orcamento', id] });
    },
  });

  const delItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(`/orcamentos/${id}/itens/${itemId}/deletar`);
      if (!res.ok) throw new Error('Falha ao deletar item');
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orcamento', id] });
    },
  });

  const updateTituloDetailMutation = useMutation({
    mutationFn: async (novoTitulo: string) => {
      const res = await fetch(`/orcamentos/${id}/atualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ titulo: novoTitulo })
      });
      if (!res.ok) throw new Error('Falha ao atualizar título');
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orcamento', id] });
      await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    }
  });

  const getInsumoNome = (iId: number) => insumos.find((i: any) => i.id === iId)?.nome || 'Desconhecido';

  if (!orcamento) return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg">Carregando detalhes...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <button
            onClick={onBack}
            className="btn btn-ghost"
          >
            <ChevronLeft size={20} /> Voltar
          </button>
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <button
                onClick={() => window.open(`/orcamentos/${id}/imprimir`, '_blank')}
                className="btn btn-ghost"
                title="Imprimir orçamento"
              >
                <Printer size={18} /> Imprimir
              </button>
              {hasPedidos && (
                <button
                  onClick={() => navigate(`/pedidos?orcamentoId=${id}`)}
                  className="btn btn-ghost"
                >
                  <ShoppingCart size={18} /> Ver Pedidos
                </button>
              )}
              {canEditarOrcamento && (
                <button
                  onClick={() => setSugestoesModalOpen(true)}
                  className="btn btn-success"
                >
                  <CheckCircle size={18} /> Finalizar e Gerar Pedidos
                </button>
              )}
              {getStatusBadge(orcamento.status)}
            </div>
        </div>

        {/* Cabeçalho do Orçamento */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{orcamento.titulo}</h2>
                <button
                  onClick={() => {
                    const novo = window.prompt('Editar título do orçamento:', orcamento.titulo);
                    if (novo && novo.trim() && novo.trim() !== orcamento.titulo) {
                      updateTituloDetailMutation.mutate(novo.trim());
                    }
                  }}
                  className="btn btn-action btn-icon btn-sm"
                  title="Editar Título"
                  aria-label="Editar título do orçamento"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              <p className="text-gray-500 mt-1 text-sm">Criado em: {orcamento.dataCriacao}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium">ID:</span>
              <span className="td-mono">#{orcamento.id}</span>
            </div>
          </div>
        </div>

        {/* Itens do Orçamento */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart size={20} className="text-emerald-600" />
              Itens para Cotação
            </h2>
            <span className="text-sm text-gray-500">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
          </div>
          
          {canEditarOrcamento && (
            <form onSubmit={(e) => { e.preventDefault(); addItemMutation.mutate(); }} className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <select 
                required 
                value={insumoId} 
                onChange={e => setInsumoId(e.target.value)} 
                className="flex-1 min-w-[200px]"
              >
                <option value="">Selecione um Insumo...</option>
                {insumos.map((i: any) => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
              <input 
                required 
                type="number" 
                step="0.01" 
                placeholder="Qtd" 
                value={quantidade} 
                onChange={e => setQuantidade(e.target.value)} 
                className="w-28" 
              />
              <button 
                type="submit" 
                disabled={addItemMutation.isPending} 
                className="btn btn-primary"
              >
                <Plus size={18}/> Adicionar
              </button>
            </form>
          )}

          <div className="table-wrapper">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Insumo</th>
                    <th className="px-4 py-3 text-right">Quantidade</th>
                    <th className="px-4 py-3 text-center">Cotações</th>
                    <th className="px-4 py-3 text-center w-24">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        Nenhum insumo incluído neste orçamento ainda.
                      </td>
                    </tr>
                  ) : (
                    itens.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium">{getInsumoNome(item.insumoId)}</td>
                        <td className="px-4 py-3 text-right td-mono">{item.quantidade}</td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => setCotacaoModalItem(item)} 
                            className="btn btn-secondary btn-sm"
                          >
                            Gerenciar Preços
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="actions justify-center">
                            <button 
                              onClick={() => { if(window.confirm('Remover insumo do orçamento?')) delItemMutation.mutate(item.id); }} 
                              className="btn btn-danger btn-icon"
                              aria-label="Remover item"
                              title="Remover"
                            >
                              <Trash2 size={18}/>
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
        </div>
      </div>

      {cotacaoModalItem && (
        <CotacoesModal 
          orcamentoId={id} 
          item={cotacaoModalItem} 
          insumoNome={getInsumoNome(cotacaoModalItem.insumoId)}
          fornecedores={fornecedores}
          onClose={() => setCotacaoModalItem(null)} 
        />
      )}

      {sugestoesModalOpen && (
        <SugestoesModal
           orcamentoId={id}
           fornecedores={fornecedores}
           insumos={insumos}
           onClose={() => setSugestoesModalOpen(false)}
           onSuccess={() => {
             setSugestoesModalOpen(false);
             navigate(`/pedidos?orcamentoId=${orcamento.id}`);
           }}
        />
      )}
    </div>
  );
};

// Modal de Cotações
const CotacoesModal: React.FC<{ orcamentoId: number, item: any, insumoNome: string, fornecedores: any[], onClose: () => void }> = ({ orcamentoId, item, insumoNome, fornecedores, onClose }) => {
  const queryClient = useQueryClient();
  const [fornId, setFornId] = useState('');
  const [preco, setPreco] = useState('');
  const [showPreCadastro, setShowPreCadastro] = useState(false);
  const [novoForn, setNovoForn] = useState({
    nome: '',
    nomeFantasia: '',
    cnpjCpf: '',
    telefones: '',
    email: '',
  });

  const { data: fornecedoresData } = useQuery<Fornecedor[] | { fornecedores?: Fornecedor[] }>({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const res = await fetch('/fornecedores/json');
      if (!res.ok) throw new Error('Erro ao buscar fornecedores');
      const json = await res.json() as Fornecedor[] | { fornecedores?: Fornecedor[] };
      return Array.isArray(json) ? json : (Array.isArray(json.fornecedores) ? json.fornecedores : []);
    },
    initialData: fornecedores
  });
  const listFornecedores = Array.isArray(fornecedoresData) 
    ? fornecedoresData 
    : (Array.isArray(fornecedoresData?.fornecedores) ? fornecedoresData.fornecedores : fornecedores);

  const { data: cotacoesData, isLoading } = useQuery({
    queryKey: ['cotacoes', item.id],
    queryFn: async () => {
      const res = await fetch(`/orcamentos/${orcamentoId}/itens/${item.id}/cotacoes`);
      if (!res.ok) throw new Error('Erro ao buscar cotações');
      return res.json();
    }
  });

  const cadastrarFornMutation = useMutation({
    mutationFn: async () => {
      if (!novoForn.nome.trim()) throw new Error('O nome do fornecedor é obrigatório');
      const res = await fetch('/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoForn.nome.trim(),
          nomeFantasia: novoForn.nomeFantasia.trim() || null,
          cnpjCpf: onlyNumbers(novoForn.cnpjCpf) || null,
          telefones: onlyNumbers(novoForn.telefones) || null,
          email: novoForn.email.trim() || null,
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao cadastrar fornecedor');
      }
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      if (data?.id) {
        setFornId(String(data.id));
      }
      setShowPreCadastro(false);
      setNovoForn({ nome: '', nomeFantasia: '', cnpjCpf: '', telefones: '', email: '' });
    },
    onError: (err: any) => {
      alert(`Erro ao cadastrar fornecedor: ${err.message}`);
    }
  });

  const addCotacaoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/orcamentos/${orcamentoId}/itens/${item.id}/cotacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 0, itemOrcamentoId: item.id, fornecedorId: Number(fornId), precoUnitario: Number(preco) })
      });
      if (!res.ok) throw new Error('Falha ao adicionar cotação');
      return res.json();
    },
    onSuccess: async () => {
      setFornId(''); setPreco('');
      await queryClient.invalidateQueries({ queryKey: ['cotacoes', item.id] });
    },
  });

  const delCotacaoMutation = useMutation({
    mutationFn: async (cotacaoId: number) => {
      const res = await fetch(`/orcamentos/${orcamentoId}/itens/${item.id}/cotacoes/${cotacaoId}/deletar`);
      if (!res.ok) throw new Error('Falha ao deletar cotação');
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cotacoes', item.id] });
    },
  });

  const getFornNome = (id: number) => listFornecedores.find(f => f.id === id)?.nome || 'Desconhecido';
  const cotacoes = cotacoesData?.cotacoes || [];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '640px' }} role="dialog" aria-modal="true" aria-labelledby="modal-title-cotacoes">
        <div className="modal-header">
          <div>
            <h2 id="modal-title-cotacoes" className="modal-title">Cotações</h2>
            <p className="text-sm text-gray-500 mt-0.5">{insumoNome} (Qtd: {item.quantidade})</p>
          </div>
          <button 
            onClick={onClose} 
            className="modal-close"
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
          <form onSubmit={(e) => { e.preventDefault(); addCotacaoMutation.mutate(); }}>
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="flex-1 min-w-[200px] flex items-center gap-1.5">
                <select 
                  required 
                  value={fornId} 
                  onChange={e => {
                    if (e.target.value === '__NOVO__') {
                      setShowPreCadastro(true);
                    } else {
                      setFornId(e.target.value);
                    }
                  }} 
                  className="flex-1"
                >
                  <option value="">Selecione o Fornecedor...</option>
                  {listFornecedores.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nomeEmpresa || f.nome} {f.cnpjCpf ? `(${f.cnpjCpf})` : ''}
                    </option>
                  ))}
                  <option value="__NOVO__">➕ + Pré-cadastrar Novo Fornecedor...</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowPreCadastro(prev => !prev)}
                  className={`btn btn-sm ${showPreCadastro ? 'btn-primary' : 'btn-secondary'} whitespace-nowrap flex items-center gap-1 px-2.5`}
                  title="Pré-cadastrar novo fornecedor"
                >
                  <UserPlus size={15} />
                  <span className="text-xs">{showPreCadastro ? 'Fechar' : 'Novo'}</span>
                </button>
              </div>

              <input 
                required 
                type="number" 
                step="0.01" 
                placeholder="Preço Unit. (R$)" 
                value={preco} 
                onChange={e => setPreco(e.target.value)} 
                className="w-32" 
              />
              <button 
                type="submit" 
                disabled={addCotacaoMutation.isPending || !fornId} 
                className="btn btn-primary whitespace-nowrap"
              >
                <Plus size={16}/> Adicionar
              </button>
            </div>
          </form>

          {showPreCadastro && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="p-3.5 bg-white rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-blue-700 font-medium text-xs">
                    <UserPlus size={16} />
                    <span>Pré-Cadastro Rápido de Fornecedor</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreCadastro(false)}
                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                    title="Fechar formulário"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      Nome / Razão Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Distribuidora Alvorada Ltda"
                      value={novoForn.nome}
                      onChange={e => setNovoForn({ ...novoForn, nome: e.target.value })}
                      className="w-full text-xs py-1.5 px-2.5 rounded border border-gray-300"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      Nome Fantasia / Apelido
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Alvorada"
                      value={novoForn.nomeFantasia}
                      onChange={e => setNovoForn({ ...novoForn, nomeFantasia: e.target.value })}
                      className="w-full text-xs py-1.5 px-2.5 rounded border border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      CNPJ / CPF (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={novoForn.cnpjCpf}
                      onChange={e => setNovoForn({ ...novoForn, cnpjCpf: (e.target.value = maskCnpjCpf(e.target.value)) })}
                      maxLength={18}
                      inputMode="numeric"
                      className="w-full text-xs py-1.5 px-2.5 rounded border border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={novoForn.telefones}
                      onChange={e => setNovoForn({ ...novoForn, telefones: (e.target.value = maskPhone(e.target.value)) })}
                      maxLength={15}
                      inputMode="numeric"
                      className="w-full text-xs py-1.5 px-2.5 rounded border border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                      E-mail
                    </label>
                    <input
                      type="email"
                      placeholder="vendas@fornecedor.com"
                      value={novoForn.email}
                      onChange={e => setNovoForn({ ...novoForn, email: e.target.value })}
                      className="w-full text-xs py-1.5 px-2.5 rounded border border-gray-300"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowPreCadastro(false)}
                    className="btn btn-secondary btn-sm text-xs py-1 px-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={cadastrarFornMutation.isPending || !novoForn.nome.trim()}
                    onClick={() => cadastrarFornMutation.mutate()}
                    className="btn btn-primary btn-sm text-xs py-1 px-3 flex items-center gap-1.5"
                  >
                    {cadastrarFornMutation.isPending ? 'Salvando...' : (
                      <>
                        <Check size={14} /> Salvar Fornecedor
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="table-wrapper">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Carregando cotações...</div>
            ) : cotacoes.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Nenhuma cotação registrada.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Fornecedor</th>
                    <th className="px-4 py-3 text-right">Preço Unit.</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    <th className="px-4 py-3 text-center w-16">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {cotacoes.map((c: any) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium">{getFornNome(c.fornecedorId)}</td>
                      <td className="px-4 py-3 text-right td-mono">R$ {c.precoUnitario.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">R$ {(c.precoUnitario * item.quantidade).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="actions justify-center">
                          <button 
                            onClick={() => delCotacaoMutation.mutate(c.id)} 
                            className="btn btn-danger btn-icon"
                            aria-label="Excluir cotação"
                            title="Excluir"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal de Sugestões / Geração de Pedido
interface SugestoesModalProps {
  orcamentoId: number;
  fornecedores: any[];
  insumos: any[];
  onClose: () => void;
  onSuccess: (novoPedidoId?: number) => void;
}

const SugestoesModal: React.FC<SugestoesModalProps> = ({ orcamentoId, fornecedores, insumos, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [selectedSuppliers, setSelectedSuppliers] = useState<{ [itemOrcamentoId: number]: number | null }>({});
  
  const { data, isLoading } = useQuery({
    queryKey: ['todas_cotacoes', orcamentoId],
    queryFn: async () => {
      const res = await fetch(`/orcamentos/${orcamentoId}/todas-cotacoes`);
      if (!res.ok) throw new Error('Erro ao buscar cotações');
      return res.json();
    }
  });

  const itens = (data?.itens || []) as any[];

  React.useEffect(() => {
    if (itens.length > 0) {
      const initialSelection: { [id: number]: number | null } = {};
      itens.forEach(item => {
        if (item.cotacoes.length > 0) {
           const cheapest = item.cotacoes.reduce((min: any, curr: any) => curr.precoUnitario < min.precoUnitario ? curr : min, item.cotacoes[0]);
           initialSelection[item.itemOrcamentoId] = cheapest.fornecedorId;
        } else {
           initialSelection[item.itemOrcamentoId] = null;
        }
      });
      setSelectedSuppliers(initialSelection);
    }
  }, [data]);

  const handleSupplierChange = (itemOrcamentoId: number, fornecedorId: number | null) => {
    setSelectedSuppliers(prev => ({ ...prev, [itemOrcamentoId]: fornecedorId }));
  };

  const gerarPedidoMutation = useMutation({
    mutationFn: async (dadosPedido: any) => {
      const res = await fetch(`/orcamentos/${orcamentoId}/aprovar-pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pedidos: dadosPedido.pedidos
        })
      });
      if (!res.ok) throw new Error('Falha ao gerar pedidos');
      return res.json();
    },
    onSuccess: async (data) => {
        await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
        await queryClient.invalidateQueries({ queryKey: ['orcamento', orcamentoId] });
        return data.novoPedidoId;
    }
  });

  const handleGerarPedidos = async () => {
    const itemsBySupplier: { [fornId: number]: any[] } = {};

    itens.forEach(item => {
        const fornId = selectedSuppliers[item.itemOrcamentoId];
        if (fornId) {
            if (!itemsBySupplier[fornId]) itemsBySupplier[fornId] = [];
            const cotacao = item.cotacoes.find((c:any) => c.fornecedorId === fornId);
            if (cotacao) {
                itemsBySupplier[fornId].push({
                    itemOrcamentoId: item.itemOrcamentoId,
                    insumoId: item.insumoId,
                    quantidade: item.quantidade,
                    precoUnitario: cotacao.precoUnitario,
                    total: cotacao.total
                });
            }
        }
    });

    const pedidos = Object.keys(itemsBySupplier).map(fornIdStr => ({
      fornecedorId: Number(fornIdStr),
      itens: itemsBySupplier[Number(fornIdStr)],
      frete: 0.0,
      formaPagamento: 'A Combinar'
    }));

    if (pedidos.length === 0) {
        alert("Selecione pelo menos um item.");
        return;
    }

    try {
      const result = await gerarPedidoMutation.mutateAsync({ pedidos });
      alert('Pedidos gerados com sucesso!');
      onSuccess(result);
    } catch (e) {
      alert('Erro ao gerar pedidos.');
    }
  };

  const getFornNome = (id: string | number) => fornecedores.find(f => f.id === Number(id))?.nome || 'Desconhecido';
  const getInsumoNome = (id: number) => insumos.find((i: any) => i.id === id)?.nome || 'Desconhecido';

  if (isLoading) return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '900px' }}>
        <div className="p-8 text-center">
          <div className="skeleton skeleton-title mx-auto mb-4" style={{ width: '200px' }} />
          <div className="space-y-3">
            <div className="skeleton skeleton-text long" />
            <div className="skeleton skeleton-text medium" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '900px' }} role="dialog" aria-modal="true" aria-labelledby="modal-title-sugestoes">
        <div className="modal-header">
          <div>
            <h2 id="modal-title-sugestoes" className="modal-title">Gerar Pedidos de Compra</h2>
            <p className="text-sm text-gray-500 mt-1">Selecione o fornecedor desejado para cada item. Itens selecionados serão movidos para pedidos; itens marcados como “Não comprar agora” permanecem no orçamento para uma nova cotação.</p>
          </div>
          <button 
            onClick={onClose} 
            className="modal-close"
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="table-wrapper">
            <div className="overflow-x-auto">
              {itens.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Nenhum produto orçado disponível com cotação.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left">Produto</th>
                      <th className="px-4 py-3 text-right">Qtd</th>
                      <th className="px-4 py-3 text-left">Fornecedor</th>
                      <th className="px-4 py-3 text-right">Preço Un.</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item: any) => {
                        const selectedFornId = selectedSuppliers[item.itemOrcamentoId];
                        const selectedCotacao = selectedFornId ? item.cotacoes.find((c:any) => c.fornecedorId === selectedFornId) : null;
                        
                        return (
                            <tr key={item.itemOrcamentoId} className={!selectedFornId ? 'opacity-50' : ''}>
                                <td className="px-4 py-3 font-medium">{getInsumoNome(item.insumoId)}</td>
                                <td className="px-4 py-3 text-right td-mono">{item.quantidade}</td>
                                <td className="px-4 py-3">
                                    <select 
                                        className="w-full"
                                        value={selectedFornId || ''}
                                        onChange={(e) => handleSupplierChange(item.itemOrcamentoId, e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">-- Não comprar agora --</option>
                                        {[...item.cotacoes].sort((a:any,b:any) => a.precoUnitario - b.precoUnitario).map((cot:any) => (
                                            <option key={cot.fornecedorId} value={cot.fornecedorId}>
                                                {getFornNome(cot.fornecedorId)} (R$ {cot.precoUnitario.toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-4 py-3 text-right td-mono">{selectedCotacao ? `R$ ${selectedCotacao.precoUnitario.toFixed(2)}` : '-'}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{selectedCotacao ? `R$ ${selectedCotacao.total.toFixed(2)}` : '-'}</td>
                            </tr>
                        );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            onClick={onClose} 
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button 
            onClick={handleGerarPedidos} 
            disabled={itens.length === 0 || gerarPedidoMutation.isPending || Object.values(selectedSuppliers).every(id => id === null)} 
            className="btn btn-success"
          >
            {gerarPedidoMutation.isPending ? 'Gerando...' : 'Gerar Pedidos'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrcamentosPage;
