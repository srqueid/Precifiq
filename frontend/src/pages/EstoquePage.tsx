import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Warehouse, 
  Search, 
  SlidersHorizontal, 
  X, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ShoppingBag,
  ExternalLink,
  DollarSign,
  AlertTriangle,
  Layers,
  Barcode
} from 'lucide-react';

interface ProdutoEstoque {
  id: number; // ID da variação
  produtoId: number;
  produtoNome: string;
  nomeTamanho: string;
  tamanhoMedida: number;
  unidadeSigla: string;
  unidadeNome?: string;
  custoUnitarioCalculado: number;
  precoVenda: number;
  margemLucro: number;
  tempoProducaoMinutos: number;
  estoque: number;
  codigoBarras?: string;
}

interface ProdutoBase {
  id: number;
  nome: string;
  descricao: string;
}

type SortField = 'produto' | 'tamanho' | 'estoque' | 'custo' | 'margem' | 'precoVenda' | 'valorTotal';
type SortDirection = 'asc' | 'desc';

const fmtBrl = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const removeAccents = (str: string) => {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const EstoquePage: React.FC = () => {
  const queryClient = useQueryClient();

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProdutoBase, setFilterProdutoBase] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'NORMAL' | 'BAIXO' | 'ZERADO'>('TODOS');

  // Estados de Ordenação
  const [sortField, setSortField] = useState<SortField>('produto');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal de Ajuste Rápido de Saldo
  const [editingItem, setEditingItem] = useState<ProdutoEstoque | null>(null);
  const [novoEstoque, setNovoEstoque] = useState<string>('0');

  // Query Estoque de Produtos
  const { data, isLoading, error } = useQuery<{ produtos: ProdutoEstoque[]; produtosBase: ProdutoBase[] }>({
    queryKey: ['estoqueProdutos'],
    queryFn: async () => {
      const res = await fetch('/produtos-finais/estoque/json');
      if (!res.ok) throw new Error('Erro ao buscar estoque de produtos');
      return res.json();
    }
  });

  const produtos: ProdutoEstoque[] = data?.produtos || [];
  const produtosBase: ProdutoBase[] = data?.produtosBase || [];

  // Mutation para atualizar saldo de estoque do produto acabado
  const updateEstoqueMutation = useMutation({
    mutationFn: async ({ id, estoque }: { id: number; estoque: number }) => {
      const form = new URLSearchParams();
      form.append('estoque', estoque.toString());
      const res = await fetch(`/produtos-finais/ajustar-estoque/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
      if (!res.ok) throw new Error('Falha ao atualizar estoque do produto');
      return res.json();
    },
    onSuccess: () => {
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['produtosFinais'] });
    }
  });

  // Estatísticas para os KPIs
  const totalVariacoes = produtos.length;
  const totalProdutosBase = produtosBase.length;
  const estoqueBaixo = produtos.filter(p => (p.estoque ?? 0) > 0 && (p.estoque ?? 0) < 5).length;
  const estoqueZerado = produtos.filter(p => (p.estoque ?? 0) === 0).length;
  const valorTotalEstoque = produtos.reduce((acc, p) => acc + (p.estoque || 0) * (p.precoVenda || 0), 0);
  const custoTotalEstoque = produtos.reduce((acc, p) => acc + (p.estoque || 0) * (p.custoUnitarioCalculado || 0), 0);

  // Manipulação de Ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="th-sort-icon" aria-hidden="true" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="th-sort-icon" aria-hidden="true" />
    ) : (
      <ArrowDown size={14} className="th-sort-icon" aria-hidden="true" />
    );
  };

  // Filtragem e Ordenação
  const filteredAndSortedProdutos = useMemo(() => {
    const filtered = produtos.filter(p => {
      const termo = removeAccents(searchTerm.toLowerCase().trim());
      const nomeCompleto = removeAccents(`${p.produtoNome} ${p.nomeTamanho}`.toLowerCase());
      const barcodeMatch = Boolean(p.codigoBarras && p.codigoBarras.toLowerCase().includes(termo));
      const matchSearch = termo === '' || nomeCompleto.includes(termo) || barcodeMatch;

      const matchBase =
        filterProdutoBase === 'TODOS'
          ? true
          : p.produtoId.toString() === filterProdutoBase;

      const matchStatus =
        filterStatus === 'TODOS'
          ? true
          : filterStatus === 'ZERADO'
          ? (p.estoque ?? 0) === 0
          : filterStatus === 'BAIXO'
          ? (p.estoque ?? 0) > 0 && (p.estoque ?? 0) < 5
          : filterStatus === 'NORMAL'
          ? (p.estoque ?? 0) >= 5
          : true;

      return matchSearch && matchBase && matchStatus;
    });

    return [...filtered].sort((a, b) => {
      if (!sortField) return 0;

      let result = 0;
      switch (sortField) {
        case 'produto': {
          const nomeA = `${a.produtoNome} ${a.nomeTamanho}`;
          const nomeB = `${b.produtoNome} ${b.nomeTamanho}`;
          result = nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base', numeric: true });
          break;
        }
        case 'tamanho': {
          const tamA = a.tamanhoMedida ?? 0;
          const tamB = b.tamanhoMedida ?? 0;
          result = tamA - tamB;
          break;
        }
        case 'estoque': {
          const estA = a.estoque ?? 0;
          const estB = b.estoque ?? 0;
          result = estA - estB;
          break;
        }
        case 'custo': {
          const custoA = a.custoUnitarioCalculado ?? 0;
          const custoB = b.custoUnitarioCalculado ?? 0;
          result = custoA - custoB;
          break;
        }
        case 'margem': {
          const marA = a.margemLucro ?? 0;
          const marB = b.margemLucro ?? 0;
          result = marA - marB;
          break;
        }
        case 'precoVenda': {
          const precoA = a.precoVenda ?? 0;
          const precoB = b.precoVenda ?? 0;
          result = precoA - precoB;
          break;
        }
        case 'valorTotal': {
          const valA = (a.estoque ?? 0) * (a.precoVenda ?? 0);
          const valB = (b.estoque ?? 0) * (b.precoVenda ?? 0);
          result = valA - valB;
          break;
        }
        default:
          result = 0;
      }

      return sortDirection === 'asc' ? result : -result;
    });
  }, [produtos, searchTerm, filterProdutoBase, filterStatus, sortField, sortDirection]);

  // Handlers do Modal de Ajuste
  const handleOpenAjuste = (item: ProdutoEstoque) => {
    setEditingItem(item);
    setNovoEstoque((item.estoque ?? 0).toString());
  };

  const handleSaveAjuste = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingItem) return;
    updateEstoqueMutation.mutate({
      id: editingItem.id,
      estoque: parseFloat(novoEstoque) || 0
    });
  };

  return (
    <div className="page estoque-page">
      {/* Top Toolbar */}
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <Warehouse size={24} />
          </div>
          <div>
            <h1 className="page-title">Estoque de Produtos</h1>
            <p className="page-subtitle">Controle de saldos físicos de produtos acabados, custos e preços de venda</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações de estoque de produtos">
          <Link to="/produtos" className="btn btn-secondary btn-lg" title="Acessar cadastro de produtos e fichas técnicas">
            <ShoppingBag size={18} />
            <span>Gerenciar Produtos</span>
          </Link>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Warehouse size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Produtos & Variações</div>
            <div className="kpi-value blue">{totalVariacoes}</div>
            <div className="kpi-trend text-muted">{totalProdutosBase} produtos base cadastrados</div>
          </div>
        </div>
        <div className="kpi-card yellow">
          <div className="kpi-icon yellow"><AlertTriangle size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Estoque Baixo</div>
            <div className="kpi-value yellow">{estoqueBaixo}</div>
            <div className="kpi-trend down">Abaixo de 5 unidades</div>
          </div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><ShoppingBag size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Estoque Zerado</div>
            <div className="kpi-value red">{estoqueZerado}</div>
            <div className="kpi-trend text-muted">Sem unidades em estoque</div>
          </div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Valor Total em Estoque</div>
            <div className="kpi-value green" title={fmtBrl(valorTotalEstoque)}>{fmtBrl(valorTotalEstoque)}</div>
            <div className="kpi-trend text-muted">Custo total: {fmtBrl(custoTotalEstoque)}</div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="section-title">Filtros e Pesquisa</div>
        <div className="form-row" style={{ marginBottom: '0' }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="busca-produto">Buscar Produto ou Tamanho</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                id="busca-produto"
                type="text"
                placeholder="Ex: Sabonete Líquido, 200ml ou código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '38px' }}
                aria-label="Buscar produto, tamanho ou código de barras"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="filtro-produto-base">Produto Base</label>
            <select
              id="filtro-produto-base"
              value={filterProdutoBase}
              onChange={(e) => setFilterProdutoBase(e.target.value)}
            >
              <option value="TODOS">Todos os Produtos</option>
              {produtosBase.map((pb) => (
                <option key={pb.id} value={pb.id.toString()}>
                  {pb.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="filtro-status-produto">Status do Estoque</label>
            <select
              id="filtro-status-produto"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'TODOS' | 'NORMAL' | 'BAIXO' | 'ZERADO')}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="NORMAL">Normal (≥ 5)</option>
              <option value="BAIXO">Estoque Baixo (&lt; 5)</option>
              <option value="ZERADO">Estoque Zerado (0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Estoque de Produtos */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {isLoading ? (
          <div className="empty-state p-12 text-center">Carregando estoque de produtos acabados...</div>
        ) : error ? (
          <div className="empty-state p-12 text-center text-red-500">Erro ao carregar estoque de produtos.</div>
        ) : filteredAndSortedProdutos.length === 0 ? (
          <div className="empty-state p-12">
            <div className="empty-state-icon">
              <Warehouse className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="empty-state-title">
              {searchTerm || filterProdutoBase !== 'TODOS' || filterStatus !== 'TODOS'
                ? 'Nenhum produto encontrado'
                : 'Nenhum produto cadastrado com variações'}
            </h3>
            <p className="empty-state-description">
              {searchTerm || filterProdutoBase !== 'TODOS' || filterStatus !== 'TODOS'
                ? 'Tente ajustar os filtros ou termos da busca.'
                : 'Cadastre produtos finais e suas variações na aba "Produtos" para controlar o estoque.'}
            </p>
            {!searchTerm && filterProdutoBase === 'TODOS' && (
              <div style={{ marginTop: '16px' }}>
                <Link to="/produtos" className="btn btn-primary">
                  <ShoppingBag size={18} />
                  <span>Ir para Produtos</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {/* Produto / Variação */}
                  <th className="table-cell">
                    <button
                      type="button"
                      onClick={() => handleSort('produto')}
                      className={`th-sort-button ${sortField === 'produto' ? 'active' : ''}`}
                      title="Ordenar por Nome do Produto"
                    >
                      <span>Produto / Variação</span>
                      {renderSortIcon('produto')}
                    </button>
                  </th>

                  {/* Tamanho / Medida */}
                  <th className="table-cell" style={{ width: '130px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('tamanho')}
                      className={`th-sort-button ${sortField === 'tamanho' ? 'active' : ''}`}
                      title="Ordenar por Tamanho"
                    >
                      <span>Tamanho</span>
                      {renderSortIcon('tamanho')}
                    </button>
                  </th>

                  {/* Qtd. em Estoque */}
                  <th className="table-cell text-right" style={{ width: '140px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('estoque')}
                      className={`th-sort-button justify-end ${sortField === 'estoque' ? 'active' : ''}`}
                      title="Ordenar por Quantidade em Estoque"
                    >
                      <span>Qtd. Estoque</span>
                      {renderSortIcon('estoque')}
                    </button>
                  </th>

                  {/* Custo Unitário */}
                  <th className="table-cell text-right" style={{ width: '130px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('custo')}
                      className={`th-sort-button justify-end ${sortField === 'custo' ? 'active' : ''}`}
                      title="Ordenar por Custo Unitário"
                    >
                      <span>Custo Unit.</span>
                      {renderSortIcon('custo')}
                    </button>
                  </th>

                  {/* Margem */}
                  <th className="table-cell text-right" style={{ width: '110px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('margem')}
                      className={`th-sort-button justify-end ${sortField === 'margem' ? 'active' : ''}`}
                      title="Ordenar por Margem de Lucro"
                    >
                      <span>Margem</span>
                      {renderSortIcon('margem')}
                    </button>
                  </th>

                  {/* Preço de Venda */}
                  <th className="table-cell text-right" style={{ width: '130px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('precoVenda')}
                      className={`th-sort-button justify-end ${sortField === 'precoVenda' ? 'active' : ''}`}
                      title="Ordenar por Preço de Venda"
                    >
                      <span>Preço Venda</span>
                      {renderSortIcon('precoVenda')}
                    </button>
                  </th>

                  {/* Valor Total */}
                  <th className="table-cell text-right" style={{ width: '140px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('valorTotal')}
                      className={`th-sort-button justify-end ${sortField === 'valorTotal' ? 'active' : ''}`}
                      title="Ordenar por Valor Total em Estoque"
                    >
                      <span>Valor Total</span>
                      {renderSortIcon('valorTotal')}
                    </button>
                  </th>

                  {/* Status */}
                  <th className="table-cell" style={{ width: '100px' }}>
                    <span>Status</span>
                  </th>

                  {/* Ações */}
                  <th className="table-cell text-center" style={{ width: '100px' }}>
                    <span>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedProdutos.map((p) => {
                  const qtd = p.estoque ?? 0;
                  const valorTotal = qtd * (p.precoVenda ?? 0);

                  return (
                    <tr key={p.id}>
                      {/* Produto & Tamanho */}
                      <td className="table-cell">
                        <strong>{p.produtoNome}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>Variação: {p.nomeTamanho}</span>
                          {p.codigoBarras && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>
                              <Barcode size={12} /> {p.codigoBarras}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tamanho / Medida */}
                      <td className="table-cell td-muted font-medium">
                        {p.tamanhoMedida} {p.unidadeSigla}
                      </td>

                      {/* Qtd. Estoque */}
                      <td className="table-cell text-right td-mono font-medium">
                        {qtd} un
                      </td>

                      {/* Custo Unitário */}
                      <td className="table-cell text-right td-mono td-muted">
                        {fmtBrl(p.custoUnitarioCalculado)}
                      </td>

                      {/* Margem */}
                      <td className="table-cell text-right td-mono">
                        <span className="badge badge-gray font-medium">
                          {p.margemLucro}%
                        </span>
                      </td>

                      {/* Preço de Venda */}
                      <td className="table-cell text-right td-mono">
                        {fmtBrl(p.precoVenda)}
                      </td>

                      {/* Valor Total */}
                      <td className="table-cell text-right td-mono td-blue" style={{ fontSize: '15px' }}>
                        {fmtBrl(valorTotal)}
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <span
                          className={
                            qtd === 0
                              ? 'badge badge-red'
                              : qtd < 5
                              ? 'badge badge-yellow'
                              : 'badge badge-green'
                          }
                        >
                          {qtd === 0 ? 'Zerado' : qtd < 5 ? 'Baixo' : 'Normal'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="table-cell table-cell-actions text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenAjuste(p)}
                          className="btn btn-action btn-icon"
                          title="Ajustar saldo físico em estoque"
                          aria-label={`Ajustar estoque de ${p.produtoNome} ${p.nomeTamanho}`}
                        >
                          <SlidersHorizontal size={16} />
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

      {/* Modal Ajuste Rápido de Estoque de Produto */}
      {editingItem && (
        <div className="modal-overlay" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && setEditingItem(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} role="dialog" aria-modal="true" aria-labelledby="modal-title-estoque-produto">
            <div className="modal-header">
              <h2 id="modal-title-estoque-produto" className="modal-title">Ajustar Saldo de Produto</h2>
              <button 
                onClick={() => setEditingItem(null)} 
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveAjuste}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', background: 'var(--surface-2)', padding: '12px', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                    {editingItem.produtoNome}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                    Tamanho: {editingItem.nomeTamanho} ({editingItem.tamanhoMedida} {editingItem.unidadeSigla})
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--accent)', marginTop: '4px', fontWeight: 600 }}>
                    Preço de Venda: {fmtBrl(editingItem.precoVenda)}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="modal-novo-estoque-produto" className="required">Quantidade Física em Estoque (Unidades)</label>
                  <input
                    id="modal-novo-estoque-produto"
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={novoEstoque}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovoEstoque(e.target.value)}
                    className="w-full"
                    autoFocus
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
                    Informe a contagem física atual de unidades acabadas prontas para venda.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateEstoqueMutation.isPending}
                >
                  {updateEstoqueMutation.isPending ? 'Salvando...' : 'Salvar Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoquePage;