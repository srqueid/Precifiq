import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  PackagePlus, 
  Plus, 
  Edit2,
  Trash2, 
  Search, 
  X, 
  Package, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  Layers
} from 'lucide-react';

interface KitItemDto {
  id: number;
  kitId: number;
  produtoVariacaoId: number;
  quantidade: number;
  produtoNome: string;
  variacaoNome: string;
  custoUnitarioCalculado: number;
  precoVendaVariacao: number;
}

interface KitDto {
  id: number;
  nome: string;
  descricao: string | null;
  margemLucro: number;
  custoTotalCalculado: number;
  precoVenda: number;
  itens: KitItemDto[];
}

interface ProdutoDisponivel {
  id: number;
  produtoNome: string;
  nomeTamanho: string;
  custoUnitarioCalculado: number;
  precoVenda: number;
  margemLucro: number;
}

interface ItemFormRow {
  produtoVariacaoId: number;
  quantidade: number;
}

const fmtBrl = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const KitsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKitId, setEditingKitId] = useState<number | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [margemLucro, setMargemLucro] = useState<number>(50);
  const [itensForm, setItensForm] = useState<ItemFormRow[]>([]);
  const [selectedVariacaoId, setSelectedVariacaoId] = useState<string>('');
  const [itemQuantidade, setItemQuantidade] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Query Kits
  const { data: kits = [], isLoading, error } = useQuery<KitDto[]>({
    queryKey: ['kits'],
    queryFn: async () => {
      const res = await fetch('/api/kits');
      if (!res.ok) throw new Error('Erro ao carregar kits');
      return res.json();
    }
  });

  // Query Produtos Disponíveis
  const { data: produtosDisponiveis = [] } = useQuery<ProdutoDisponivel[]>({
    queryKey: ['produtosDisponiveisKits'],
    queryFn: async () => {
      const res = await fetch('/api/kits/produtos-disponiveis');
      if (!res.ok) throw new Error('Erro ao carregar produtos para kit');
      return res.json();
    }
  });

  // Mutations
  const createKitMutation = useMutation({
    mutationFn: async (payload: { nome: string; descricao: string; margemLucro: number; itens: { produtoVariacaoId: number; quantidade: number }[] }) => {
      const res = await fetch('/api/kits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar kit');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Erro ao salvar kit.');
    }
  });

  const updateKitMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: { nome: string; descricao: string; margemLucro: number; itens: { produtoVariacaoId: number; quantidade: number }[] } }) => {
      const res = await fetch(`/api/kits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar kit');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Erro ao salvar kit.');
    }
  });

  const deleteKitMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/kits/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir kit');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kits'] });
    }
  });

  // Handlers
  const handleOpenModal = (kit?: KitDto) => {
    if (kit) {
      setEditingKitId(kit.id);
      setNome(kit.nome);
      setDescricao(kit.descricao || '');
      setMargemLucro(kit.margemLucro || 50);
      setItensForm(
        (kit.itens || []).map(i => ({
          produtoVariacaoId: i.produtoVariacaoId,
          quantidade: i.quantidade
        }))
      );
    } else {
      setEditingKitId(null);
      setNome('');
      setDescricao('');
      setMargemLucro(50);
      setItensForm([]);
    }
    setSelectedVariacaoId('');
    setItemQuantidade(1);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleAddItem = () => {
    const vId = Number(selectedVariacaoId);
    if (!vId) {
      setFormError('Selecione um produto para adicionar.');
      return;
    }
    if (itemQuantidade <= 0) {
      setFormError('A quantidade deve ser de pelo menos 1.');
      return;
    }

    setFormError(null);
    const existingIndex = itensForm.findIndex(i => i.produtoVariacaoId === vId);
    if (existingIndex >= 0) {
      const updated = [...itensForm];
      updated[existingIndex].quantidade += itemQuantidade;
      setItensForm(updated);
    } else {
      setItensForm([...itensForm, { produtoVariacaoId: vId, quantidade: itemQuantidade }]);
    }
    setSelectedVariacaoId('');
    setItemQuantidade(1);
  };

  const handleRemoveItem = (index: number) => {
    setItensForm(itensForm.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nome.trim()) {
      setFormError('O nome do kit é obrigatório.');
      return;
    }
    if (margemLucro < 50) {
      setFormError('A margem de lucro mínima é de 50%.');
      return;
    }
    if (itensForm.length === 0) {
      setFormError('Adicione pelo menos um item ao kit.');
      return;
    }

    if (editingKitId) {
      updateKitMutation.mutate({
        id: editingKitId,
        payload: {
          nome: nome.trim(),
          descricao: descricao.trim(),
          margemLucro: Number(margemLucro),
          itens: itensForm
        }
      });
    } else {
      createKitMutation.mutate({
        nome: nome.trim(),
        descricao: descricao.trim(),
        margemLucro: Number(margemLucro),
        itens: itensForm
      });
    }
  };

  const handleDeleteKit = (kit: KitDto) => {
    if (window.confirm(`Deseja realmente excluir o kit "${kit.nome}"?`)) {
      deleteKitMutation.mutate(kit.id);
    }
  };

  // Cálculos dinâmicos no Modal
  const modalCustoTotal = useMemo(() => {
    return itensForm.reduce((acc, item) => {
      const prod = produtosDisponiveis.find(p => p.id === item.produtoVariacaoId);
      const custoUnit = prod?.custoUnitarioCalculado || 0;
      return acc + custoUnit * item.quantidade;
    }, 0);
  }, [itensForm, produtosDisponiveis]);

  const modalPrecoVenda = useMemo(() => {
    return modalCustoTotal * (1 + (margemLucro / 100));
  }, [modalCustoTotal, margemLucro]);

  // Filtro de Kits
  const filteredKits = useMemo(() => {
    return kits.filter(k => 
      k.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (k.descricao && k.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [kits, searchTerm]);

  // Estatísticas para os KPIs
  const totalKits = kits.length;
  const valorTotalVendaKits = kits.reduce((acc, k) => acc + (k.precoVenda || 0), 0);
  const custoTotalKits = kits.reduce((acc, k) => acc + (k.custoTotalCalculado || 0), 0);
  const margemMedia = totalKits > 0 
    ? kits.reduce((acc, k) => acc + (k.margemLucro || 0), 0) / totalKits 
    : 0;

  return (
    <div className="page kits-page">
      {/* Top Toolbar */}
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <PackagePlus size={24} />
          </div>
          <div>
            <h1 className="page-title">Kits de Produtos</h1>
            <p className="page-subtitle">Crie, precifique e gerencie pacotes promocionais e kits para venda</p>
          </div>
        </div>

        <div className="toolbar-actions">
          <button onClick={() => handleOpenModal()} className="btn btn-primary btn-lg">
            <Plus size={20} />
            <span>Criar Novo Kit</span>
          </button>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Package size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Total de Kits Criados</div>
            <div className="kpi-value blue">{totalKits}</div>
            <div className="kpi-trend text-muted">Pacotes ativos para venda</div>
          </div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Soma Preço de Venda</div>
            <div className="kpi-value green" title={fmtBrl(valorTotalVendaKits)}>{fmtBrl(valorTotalVendaKits)}</div>
            <div className="kpi-trend text-muted">Total dos kits cadastrados</div>
          </div>
        </div>
        <div className="kpi-card yellow">
          <div className="kpi-icon yellow"><Layers size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Custo Médio dos Kits</div>
            <div className="kpi-value yellow" title={totalKits > 0 ? fmtBrl(custoTotalKits / totalKits) : 'R$ 0,00'}>
              {totalKits > 0 ? fmtBrl(custoTotalKits / totalKits) : 'R$ 0,00'}
            </div>
            <div className="kpi-trend text-muted">Baseado nos custos calculados</div>
          </div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><TrendingUp size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Margem Média</div>
            <div className="kpi-value blue">{margemMedia.toFixed(1)}%</div>
            <div className="kpi-trend text-muted">Mínimo permitido: 50%</div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="section-title">Pesquisar Kits</div>
        <div className="form-row" style={{ marginBottom: '0' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar kit por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Kits */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {isLoading ? (
          <div className="empty-state p-12 text-center">Carregando kits de produtos...</div>
        ) : error ? (
          <div className="empty-state p-12 text-center text-red-500">Erro ao carregar kits cadastrados.</div>
        ) : filteredKits.length === 0 ? (
          <div className="empty-state p-12">
            <div className="empty-state-icon">
              <PackagePlus className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="empty-state-title">
              {searchTerm ? 'Nenhum kit encontrado' : 'Nenhum kit criado ainda'}
            </h3>
            <p className="empty-state-description">
              {searchTerm 
                ? 'Tente ajustar os termos da busca para encontrar o pacote desejado.' 
                : 'Clique no botão "Criar Novo Kit" para agrupar produtos e calcular o preço automaticamente.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell">Nome do Kit</th>
                  <th className="table-cell">Itens Inclusos</th>
                  <th className="table-cell text-right" style={{ width: '140px' }}>Custo Total</th>
                  <th className="table-cell text-right" style={{ width: '110px' }}>Margem</th>
                  <th className="table-cell text-right" style={{ width: '150px' }}>Preço de Venda</th>
                  <th className="table-cell text-center" style={{ width: '100px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredKits.map((kit) => (
                  <tr key={kit.id}>
                    {/* Nome & Descrição */}
                    <td className="table-cell">
                      <strong>{kit.nome}</strong>
                      {kit.descricao && (
                        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                          {kit.descricao}
                        </div>
                      )}
                    </td>

                    {/* Itens Inclusos */}
                    <td className="table-cell">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {kit.itens && kit.itens.length > 0 ? (
                          kit.itens.map((item, idx) => (
                            <div key={idx} style={{ fontSize: '13px' }}>
                              <span className="badge badge-gray" style={{ marginRight: '6px', fontWeight: 600 }}>
                                {item.quantidade}x
                              </span>
                              <span>{item.produtoNome} ({item.variacaoNome})</span>
                            </div>
                          ))
                        ) : (
                          <span className="td-muted">Sem itens vinculados</span>
                        )}
                      </div>
                    </td>

                    {/* Custo Total */}
                    <td className="table-cell text-right td-mono">
                      {fmtBrl(kit.custoTotalCalculado)}
                    </td>

                    {/* Margem */}
                    <td className="table-cell text-right td-mono">
                      <span className="badge badge-green font-medium">
                        {kit.margemLucro}%
                      </span>
                    </td>

                    {/* Preço de Venda */}
                    <td className="table-cell text-right td-mono td-blue" style={{ fontSize: '15px' }}>
                      {fmtBrl(kit.precoVenda)}
                    </td>

                    {/* Ações */}
                    <td className="table-cell table-cell-actions text-center">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleOpenModal(kit)}
                          className="btn btn-action btn-icon"
                          title="Editar Kit"
                          aria-label={`Editar kit ${kit.nome}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteKit(kit)}
                          className="btn btn-action-danger btn-icon"
                          title="Excluir Kit"
                          aria-label={`Excluir kit ${kit.nome}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar Novo Kit */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <div className="modal-content" style={{ maxWidth: '640px' }} role="dialog" aria-modal="true" aria-labelledby="modal-kit-title">
            <div className="modal-header">
              <h2 id="modal-kit-title" className="modal-title">
                {editingKitId ? 'Editar Kit de Produtos' : 'Criar Novo Kit de Produtos'}
              </h2>
              <button onClick={handleCloseModal} className="modal-close" aria-label="Fechar modal">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
                {formError && (
                  <div style={{ background: 'var(--red-dim)', color: 'var(--red)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-4" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
                  {/* Nome do Kit */}
                  <div className="form-group">
                    <label htmlFor="kit-nome" className="required">Nome do Kit</label>
                    <input
                      id="kit-nome"
                      type="text"
                      required
                      placeholder="Ex: Kit Dia das Mães Completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>

                  {/* Descrição */}
                  <div className="form-group">
                    <label htmlFor="kit-desc">Descrição / Observações (opcional)</label>
                    <input
                      id="kit-desc"
                      type="text"
                      placeholder="Ex: Inclui 1 Difusor 200ml e 1 Sabonete Líquido 250ml"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                    />
                  </div>

                  {/* Margem de Lucro */}
                  <div className="form-group">
                    <label htmlFor="kit-margem" className="required">Margem de Lucro (%) - Mínimo 50%</label>
                    <input
                      id="kit-margem"
                      type="number"
                      min="50"
                      step="1"
                      required
                      value={margemLucro}
                      onChange={(e) => setMargemLucro(Number(e.target.value))}
                    />
                  </div>

                  {/* Seção Adicionar Itens ao Kit */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px', width: '100%', maxWidth: '100%' }}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '10px' }}>
                      Adicionar Produtos ao Kit
                    </label>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
                      <div className="form-group" style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <label htmlFor="select-produto-kit">Selecione o Produto / Tamanho</label>
                        <select
                          id="select-produto-kit"
                          style={{ width: '100%', maxWidth: '100%' }}
                          value={selectedVariacaoId}
                          onChange={(e) => setSelectedVariacaoId(e.target.value)}
                        >
                          <option value="">Selecione um produto...</option>
                          {produtosDisponiveis.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.produtoNome} - {p.nomeTamanho} (Custo: {fmtBrl(p.custoUnitarioCalculado)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ width: '80px', minWidth: '70px', flex: '0 0 auto' }}>
                        <label htmlFor="input-qtd-kit">Qtd</label>
                        <input
                          id="input-qtd-kit"
                          type="number"
                          min="1"
                          style={{ width: '100%' }}
                          value={itemQuantidade}
                          onChange={(e) => setItemQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="btn btn-secondary"
                        style={{ height: '38px', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <Plus size={16} />
                        Adicionar
                      </button>
                    </div>

                    {/* Tabela de Itens Selecionados */}
                    {itensForm.length === 0 ? (
                      <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--muted)' }}>
                        Nenhum produto adicionado ao kit ainda.
                      </div>
                    ) : (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
                        <table style={{ width: '100%', minWidth: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px 12px' }}>Produto</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qtd</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Custo Unit.</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Remover</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itensForm.map((item, idx) => {
                              const prod = produtosDisponiveis.find(p => p.id === item.produtoVariacaoId);
                              const custoUnit = prod?.custoUnitarioCalculado || 0;
                              const subtotal = custoUnit * item.quantidade;

                              return (
                                <tr key={idx}>
                                  <td style={{ padding: '8px 12px' }}>
                                    <strong>{prod?.produtoNome || 'Produto'}</strong> ({prod?.nomeTamanho || '-'})
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center' }} className="td-mono font-medium">
                                    {item.quantidade}x
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right' }} className="td-mono">
                                    {fmtBrl(custoUnit)}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right' }} className="td-mono font-medium">
                                    {fmtBrl(subtotal)}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItem(idx)}
                                      className="btn btn-action-danger btn-icon"
                                      title="Remover Item"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Resumo dos Valores do Kit */}
                  <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 'var(--radius-lg)', marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', textAlign: 'center', width: '100%', maxWidth: '100%' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Custo dos Itens</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--mono)', marginTop: '4px' }}>
                        {fmtBrl(modalCustoTotal)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Margem de Lucro</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--green)', marginTop: '4px' }}>
                        +{margemLucro}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Preço Final de Venda</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)', marginTop: '4px' }}>
                        {fmtBrl(modalPrecoVenda)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createKitMutation.isPending || updateKitMutation.isPending || itensForm.length === 0}
                >
                  {createKitMutation.isPending || updateKitMutation.isPending 
                    ? 'Salvando...' 
                    : editingKitId ? 'Atualizar Kit' : 'Salvar Kit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitsPage;
