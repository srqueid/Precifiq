import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  ChevronLeft,
  Save,
  PackageOpen,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lock,
  ArrowRight,
  Sparkles,
  DollarSign,
  Percent,
  Copy,
  Barcode
} from 'lucide-react';
import { toast } from '../js/app';

interface ProdutoFinal {
  id: number;
  nome: string;
  descricao: string;
  rendimentoReceitaBase: number;
  rotulo: string | null;
}

interface CotaProdutos {
  total: number;
  limite: number | null;
  atingido: boolean;
  disponivel: number | null;
}

const fmtBrl = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtUnit = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return '0,00';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
};

const ProdutosFinaisPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId) {
    return <ProdutoDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return <ProdutoList onSelect={setSelectedId} />;
};

const ProdutoList: React.FC<{ onSelect: (id: number) => void }> = ({ onSelect }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ nome: '', descricao: '', rendimentoReceitaBase: '1000' });

  const { data: produtosResponse, isLoading } = useQuery({
    queryKey: ['produtosFinais'],
    queryFn: async () => {
      const res = await fetch('/produtos-finais/json');
      if (!res.ok) throw new Error('Erro ao buscar produtos');
      const json = await res.json();
      return {
        produtos: (json.produtos || []) as ProdutoFinal[],
        cota: (json.cota || { total: (json.produtos || []).length, limite: null, atingido: false, disponivel: null }) as CotaProdutos
      };
    }
  });

  const produtos: ProdutoFinal[] = produtosResponse?.produtos || [];
  const cota: CotaProdutos = produtosResponse?.cota || {
    total: produtos.length,
    limite: null,
    atingido: false,
    disponivel: null
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/produtos-finais/deletar/${id}`);
      if (!res.ok) throw new Error('Falha ao excluir');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtosFinais'] });
      toast('Produto excluído com sucesso!', 'success');
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (cota.atingido) {
        throw new Error(`Limite de cadastro atingido (${cota.total}/${cota.limite} produtos). Apenas o superusuário pode alterar o limite desta empresa.`);
      }
      const res = await fetch('/produtos-finais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 0,
          nome: formData.nome.trim(),
          descricao: formData.descricao.trim(),
          rendimentoReceitaBase: Number(formData.rendimentoReceitaBase) || 1000,
          rotulo: null
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao criar produto');
      }
      return res.json();
    },
    onSuccess: () => {
      setIsModalOpen(false);
      setFormData({ nome: '', descricao: '', rendimentoReceitaBase: '1000' });
      toast('Produto cadastrado com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['produtosFinais'] });
    },
    onError: (err: any) => {
      toast(err.message || 'Erro ao cadastrar produto', 'error');
    }
  });

  const filtered = produtos.filter((p: ProdutoFinal) =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.descricao && p.descricao.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page produtos-page">
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <PackageOpen size={24} />
          </div>
          <div>
            <h1 className="page-title">Produtos Finais</h1>
            <p className="page-subtitle">Fichas técnicas, formulações e custos de produtos acabados</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações e filtros de produtos">
          {/* Badge Indicador de Cota / Limitador de Produtos */}
          <div
            className={`quota-indicator-badge ${
              cota.atingido
                ? 'quota-danger'
                : (cota.limite && cota.total / cota.limite >= 0.8)
                ? 'quota-warning'
                : 'quota-normal'
            }`}
            title={
              cota.atingido
                ? `Limite máximo atingido (${cota.total} de ${cota.limite} produtos permitidos). Apenas o superusuário pode alterar.`
                : cota.limite
                ? `${cota.total} produtos cadastrados de um limite de ${cota.limite}`
                : 'Empresa com cadastro de produtos ilimitado'
            }
          >
            {cota.atingido ? <Lock size={15} className="quota-icon" /> : <PackageOpen size={15} className="quota-icon" />}
            <span className="quota-label">
              {cota.limite ? (
                <>
                  <strong>{cota.total}</strong> / {cota.limite} produtos
                  {cota.atingido && <span className="quota-pill-alert">Esgotado</span>}
                </>
              ) : (
                <>
                  <strong>{cota.total}</strong> produtos <span className="quota-pill-unlimited">Ilimitado</span>
                </>
              )}
            </span>
          </div>

          <div className="search-input-wrapper">
            <label htmlFor="produtoSearch" className="sr-only">Buscar produtos</label>
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              id="produtoSearch"
              type="text"
              placeholder="Buscar produto..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar produtos"
            />
          </div>
          <button
            onClick={() => {
              if (cota.atingido) {
                toast(`Limite de cadastro atingido (${cota.total}/${cota.limite} produtos). Apenas o superusuário pode alterar o limite desta empresa.`, 'error');
                return;
              }
              setIsModalOpen(true);
            }}
            className={`btn btn-primary btn-lg ${cota.atingido ? 'btn-disabled opacity-60 cursor-not-allowed' : ''}`}
            disabled={cota.atingido}
            title={cota.atingido ? `Limite de ${cota.limite} produtos atingido. Apenas o superusuário pode alterar.` : 'Novo Produto'}
          >
            {cota.atingido ? <Lock size={18} /> : <Plus size={20} />}
            Novo Produto
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="p-12 text-center text-muted">Carregando catálogo de produtos...</div>
      ) : (
        <section className="table-wrapper produtos-table-wrapper" aria-label="Lista de produtos">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell text-center" style={{ width: '80px' }}>ID</th>
                  <th className="table-cell">Nome do Produto</th>
                  <th className="table-cell text-right" style={{ width: '180px' }}>Rendimento Base</th>
                  <th className="table-cell">Descrição</th>
                  <th className="table-cell text-center" style={{ width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <PackageOpen className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="empty-state-title">
                          {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                        </h3>
                        <p className="empty-state-description">
                          {search
                            ? 'Tente ajustar os termos da busca para encontrar o que procura.'
                            : 'Comece cadastrando seu primeiro produto clicando no botão acima.'
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => onSelect(p.id)}
                    >
                      <td className="table-cell text-center td-mono">#{p.id}</td>
                      <td className="table-cell font-medium">
                        <strong>{p.nome}</strong>
                      </td>
                      <td className="table-cell text-right td-mono">
                        {p.rendimentoReceitaBase}
                      </td>
                      <td className="table-cell td-muted">{p.descricao || 'Sem descrição'}</td>
                      <td className="table-cell table-cell-actions text-center" onClick={e => e.stopPropagation()}>
                        <div className="action-buttons justify-center">
                          <button
                            onClick={() => onSelect(p.id)}
                            className="btn btn-action btn-icon"
                            aria-label={`Editar ${p.nome}`}
                            title="Editar Ficha Técnica"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`Deseja excluir "${p.nome}"?`)) deleteMutation.mutate(p.id); }}
                            className="btn btn-danger btn-icon"
                            aria-label={`Excluir ${p.nome}`}
                            title="Excluir Produto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal Criar Produto */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Produto Final</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }}>
              <div className="modal-body">
                {cota.atingido && (
                  <div className="p-3 mb-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                    <Lock size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Limite de cadastro atingido ({cota.total}/{cota.limite})</strong>
                      <span className="text-rose-700">Esta empresa atingiu a cota máxima de produtos cadastrados. Apenas o superusuário pode alterar essa configuração.</span>
                    </div>
                  </div>
                )}
                {cota.limite && !cota.atingido && (cota.total / cota.limite >= 0.8) && (
                  <div className="p-2.5 mb-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>Atenção: restam <strong>{cota.disponivel}</strong> vaga(s) para cadastro de novos produtos nesta empresa.</span>
                  </div>
                )}

                <div className="form-group">
                  <div className="flex justify-between items-baseline mb-1">
                    <label htmlFor="prod-nome" className="required mb-0">Nome do Produto</label>
                    <span className={`text-[11px] font-mono ${formData.nome.length >= 140 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {formData.nome.length}/150
                    </span>
                  </div>
                  <input
                    id="prod-nome"
                    required
                    maxLength={150}
                    placeholder="Ex: Água de Lençóis, Sabonete Líquido..."
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    autoFocus
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '2px', display: 'block', fontSize: '11px' }}>
                    Limitador: máximo de 150 caracteres.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="prod-rendimento" className="required">
                    Rendimento da Receita Base (medida)
                  </label>
                  <input
                    id="prod-rendimento"
                    required
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Ex: 1000 para 1 Litro / 1000ml"
                    value={formData.rendimentoReceitaBase}
                    onChange={e => setFormData({ ...formData, rendimentoReceitaBase: e.target.value })}
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block', fontSize: '11px' }}>
                    Defina o volume/peso base da formulação (ex: 1000 ml para 1L de Água de Lençóis).
                  </small>
                </div>

                <div className="form-group">
                  <div className="flex justify-between items-baseline mb-1">
                    <label htmlFor="prod-desc" className="mb-0">Descrição / Observações</label>
                    <span className={`text-[11px] font-mono ${formData.descricao.length >= 950 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {formData.descricao.length}/1000
                    </span>
                  </div>
                  <textarea
                    id="prod-desc"
                    rows={2}
                    maxLength={1000}
                    placeholder="Descrição do produto..."
                    value={formData.descricao}
                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '2px', display: 'block', fontSize: '11px' }}>
                    Limitador: máximo de 1000 caracteres.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saveMutation.isPending || cota.atingido || !formData.nome.trim() || formData.nome.length > 150 || formData.descricao.length > 1000}
                >
                  {saveMutation.isPending ? 'Salvando...' : 'Criar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProdutoDetail: React.FC<{ id: number; onBack: () => void }> = ({ id, onBack }) => {
  const queryClient = useQueryClient();

  const { data: receitaData } = useQuery({
    queryKey: ['produtoReceita', id],
    queryFn: async () => {
      const res = await fetch(`/produtos-finais/${id}/receita`);
      if (!res.ok) throw new Error('Erro ao buscar receita');
      return res.json();
    }
  });

  const { data: tamanhosData } = useQuery({
    queryKey: ['produtoTamanhos', id],
    queryFn: async () => {
      const res = await fetch(`/produtos-finais/${id}/tamanhos`);
      if (!res.ok) throw new Error('Erro ao buscar tamanhos');
      return res.json();
    }
  });

  const { data: insumoData } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const res = await fetch('/insumos/json');
      if (!res.ok) throw new Error('Erro ao buscar insumos');
      return res.json();
    }
  });

  const { data: rotuloData } = useQuery({
    queryKey: ['produtoRotulo', id],
    queryFn: async () => {
      const res = await fetch(`/produtos-finais/${id}/rotulo`);
      if (!res.ok) throw new Error('Erro ao buscar rótulo');
      return res.json();
    }
  });

  const produto = receitaData?.produto || tamanhosData?.produto;
  const receita = receitaData?.receita || [];
  const variacoes = tamanhosData?.variacoes || [];
  const insumos = insumoData?.insumos || [];
  const unidades = insumoData?.unidades || [];
  const rotulo = rotuloData?.rotulo || '';

  const [prodForm, setProdForm] = useState({ nome: '', descricao: '', rendimentoReceitaBase: '1000' });
  const [rotuloText, setRotuloText] = useState('');

  // Modal Ordem de Produção (Conversão)
  const [isProducaoModalOpen, setIsProducaoModalOpen] = useState(false);
  const [selectedVariacaoId, setSelectedVariacaoId] = useState<string>('');
  const [qtdProduzir, setQtdProduzir] = useState<string>('1');
  const [producaoSuccess, setProducaoSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (produto) {
      setProdForm({
        nome: produto.nome,
        descricao: produto.descricao || '',
        rendimentoReceitaBase: (produto.rendimentoReceitaBase || 1000).toString()
      });
    }
  }, [produto]);

  useEffect(() => {
    setRotuloText(rotulo || '');
  }, [rotulo]);

  useEffect(() => {
    if (variacoes.length > 0 && !selectedVariacaoId) {
      setSelectedVariacaoId(variacoes[0].id.toString());
    }
  }, [variacoes]);

  const updateProduto = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/produtos-finais/atualizar/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id,
          nome: prodForm.nome,
          descricao: prodForm.descricao,
          rendimentoReceitaBase: Number(prodForm.rendimentoReceitaBase) || 1000
        })
      });
      if (!res.ok) throw new Error('Falha ao atualizar produto');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtoReceita', id] });
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['produtosFinais'] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      alert('Produto e custos atualizados com sucesso!');
    }
  });

  const [insumoId, setInsumoId] = useState('');
  const [quantidadeUsada, setQuantidadeUsada] = useState('');

  const addReceita = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/produtos-finais/${id}/receita`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 0,
          produtoId: id,
          insumoId: Number(insumoId),
          quantidadeUsada: Number(quantidadeUsada)
        })
      });
      if (!res.ok) throw new Error('Falha ao adicionar ingrediente');
      return res.json();
    },
    onSuccess: () => {
      setInsumoId('');
      setQuantidadeUsada('');
      queryClient.invalidateQueries({ queryKey: ['produtoReceita', id] });
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
    }
  });

  const delReceita = useMutation({
    mutationFn: async (receitaId: number) => {
      const res = await fetch(`/produtos-finais/${id}/receita/deletar/${receitaId}`);
      if (!res.ok) throw new Error('Falha ao remover ingrediente');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtoReceita', id] });
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
    }
  });

  const updateReceita = useMutation({
    mutationFn: async ({ receitaId, quantidadeUsada }: { receitaId: number; quantidadeUsada: number }) => {
      const res = await fetch(`/produtos-finais/${id}/receita/atualizar/${receitaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidadeUsada })
      });
      if (!res.ok) throw new Error('Falha ao atualizar quantidade');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtoReceita', id] });
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
    }
  });

  const [nomeTamanho, setNomeTamanho] = useState('');
  const [tamanhoMedida, setTamanhoMedida] = useState('');
  const [unidadeMedidaTamanhoId, setUnidadeMedidaTamanhoId] = useState('');
  const [margemLucro, setMargemLucro] = useState<string>('300');
  const [novoVarCodigoBarras, setNovoVarCodigoBarras] = useState('');

  // Materiais da nova variação sendo criada
  const [novosMateriais, setNovosMateriais] = useState<Array<{ insumoId: number; quantidade: number }>>([]);
  const [novoMaterialInsumoId, setNovoMaterialInsumoId] = useState('');
  const [novoMaterialQtd, setNovoMaterialQtd] = useState('1');

  // Estado para Edição Completa da Variação
  const [editingVariacao, setEditingVariacao] = useState<any | null>(null);
  const [modalEditVariacaoOpen, setModalEditVariacaoOpen] = useState(false);
  const [editVarNome, setEditVarNome] = useState('');
  const [editVarMedida, setEditVarMedida] = useState('');
  const [editVarUnidadeId, setEditVarUnidadeId] = useState('');
  const [editVarMargem, setEditVarMargem] = useState('300');
  const [editVarCodigoBarras, setEditVarCodigoBarras] = useState('');
  const [editVarMateriais, setEditVarMateriais] = useState<Array<{ id?: number; insumoId: number; quantidade: number; insumoNome?: string; unidadeSigla?: string; custoUnitario?: number }>>([]);
  const [editMaterialInsumoId, setEditMaterialInsumoId] = useState('');
  const [editMaterialQtd, setEditMaterialQtd] = useState('1');

  // Modal para visualização e gerenciamento rápido de materiais de uma variação
  const [modalMateriaisOpen, setModalMateriaisOpen] = useState(false);
  const [variacaoParaMateriais, setVariacaoParaMateriais] = useState<any | null>(null);
  const [gerenciarMateriaisLista, setGerenciarMateriaisLista] = useState<Array<{ id?: number; insumoId: number; quantidade: number; insumoNome?: string; unidadeSigla?: string; custoUnitario?: number }>>([]);
  const [gerenciarInsumoId, setGerenciarInsumoId] = useState('');
  const [gerenciarQtd, setGerenciarQtd] = useState('1');

  const getCustoInsumoUnitario = (insId: number, qtd: number) => {
    const ins = insumos.find((i: any) => i.id === insId);
    if (!ins) return 0;
    const qtdEmb = ins.quantidadePorEmbalagem && ins.quantidadePorEmbalagem > 0 ? ins.quantidadePorEmbalagem : 1;
    return (ins.preco / qtdEmb) * qtd;
  };

  const updateVariacaoMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/produtos-finais/${id}/tamanhos/atualizar/${payload.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          codigoBarras: editVarCodigoBarras.trim() || null,
          materiais: editVarMateriais
        })
      });
      if (!res.ok) throw new Error('Falha ao atualizar variação');
      return res.json();
    },
    onSuccess: () => {
      setModalEditVariacaoOpen(false);
      setEditingVariacao(null);
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const salvarMateriaisVariacaoMutation = useMutation({
    mutationFn: async ({ variacaoId, materiais }: { variacaoId: number; materiais: any[] }) => {
      const res = await fetch(`/produtos-finais/${id}/tamanhos/${variacaoId}/materiais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materiais)
      });
      if (!res.ok) throw new Error('Falha ao salvar materiais da variação');
      return res.json();
    },
    onSuccess: () => {
      setModalMateriaisOpen(false);
      setVariacaoParaMateriais(null);
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const handleOpenEditVariacao = (v: any) => {
    setEditingVariacao(v);
    setEditVarNome(v.nomeTamanho || '');
    setEditVarMedida(String(v.tamanhoMedida || ''));
    setEditVarUnidadeId(String(v.unidadeMedidaTamanhoId || ''));
    setEditVarMargem(String(v.margemLucro !== undefined && v.margemLucro !== null ? v.margemLucro : 300));
    setEditVarCodigoBarras(v.codigoBarras || '');
    setEditVarMateriais(v.materiais && v.materiais.length > 0 ? [...v.materiais] : (v.embalagemInsumoId ? [{ insumoId: v.embalagemInsumoId, quantidade: 1 }] : []));
    setEditMaterialInsumoId('');
    setEditMaterialQtd('1');
    setModalEditVariacaoOpen(true);
  };

  const handleOpenGerenciarMateriais = (v: any) => {
    setVariacaoParaMateriais(v);
    setGerenciarMateriaisLista(v.materiais && v.materiais.length > 0 ? [...v.materiais] : (v.embalagemInsumoId ? [{ insumoId: v.embalagemInsumoId, quantidade: 1 }] : []));
    setGerenciarInsumoId('');
    setGerenciarQtd('1');
    setModalMateriaisOpen(true);
  };

  const addVariacao = useMutation({
    mutationFn: async () => {
      const margem = parseFloat(margemLucro) || 300;
      const res = await fetch(`/produtos-finais/${id}/tamanhos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 0,
          produtoId: id,
          nomeTamanho,
          tamanhoMedida: Number(tamanhoMedida),
          unidadeMedidaTamanhoId: Number(unidadeMedidaTamanhoId),
          embalagemInsumoId: novosMateriais.length > 0 ? novosMateriais[0].insumoId : null,
          codigoBarras: novoVarCodigoBarras.trim() || null,
          tempoProducaoMinutos: 0,
          margemLucro: margem,
          precoVenda: 0,
          custoUnitarioCalculado: 0,
          materiais: novosMateriais
        })
      });
      if (!res.ok) throw new Error('Falha ao adicionar variação');
      return res.json();
    },
    onSuccess: () => {
      setNomeTamanho('');
      setTamanhoMedida('');
      setUnidadeMedidaTamanhoId('');
      setMargemLucro('300');
      setNovoVarCodigoBarras('');
      setNovosMateriais([]);
      setNovoMaterialInsumoId('');
      setNovoMaterialQtd('1');
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const updateVariacaoMargemMutation = useMutation({
    mutationFn: async ({ variacao, novaMargem }: { variacao: any; novaMargem: number }) => {
      const custo = variacao.custoUnitarioCalculado || 0;
      const novoPreco = custo * (1 + novaMargem / 100);
      const res = await fetch(`/produtos-finais/${id}/tamanhos/atualizar/${variacao.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...variacao,
          margemLucro: novaMargem,
          precoVenda: novoPreco
        })
      });
      if (!res.ok) throw new Error('Falha ao atualizar margem');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const delVariacao = useMutation({
    mutationFn: async (varId: number) => {
      const res = await fetch(`/produtos-finais/${id}/tamanhos/deletar/${varId}`);
      if (!res.ok) throw new Error('Falha ao remover variação');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
    }
  });

  const gerarRotulo = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/produtos-finais/${id}/rotulo/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Falha ao gerar rótulo');
      return res.json();
    },
    onSuccess: (data) => {
      setRotuloText(data.rotulo || '');
      queryClient.invalidateQueries({ queryKey: ['produtoRotulo', id] });
    }
  });

  const salvarRotulo = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/produtos-finais/${id}/rotulo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotulo: rotuloText })
      });
      if (!res.ok) throw new Error('Falha ao salvar rótulo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtoRotulo', id] });
      alert('Rótulo salvo com sucesso!');
    }
  });

  // Mutação para Executar Ordem de Produção (Conversão e Baixa de Insumos)
  const executarProducaoMutation = useMutation({
    mutationFn: async ({ varId, qtd }: { varId: number | null; qtd: number }) => {
      const res = await fetch('/api/operacoes/producao/converter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: id,
          variacaoId: varId,
          quantidade: qtd
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao executar ordem de produção');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setProducaoSuccess(data.message || 'Ordem de produção executada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
    }
  });

  // Estados da Formulação Alternativa com IA (Fase 4)
  const [sugestoesIa, setSugestoesIa] = useState<any[] | null>(null);
  const [parecerIa, setParecerIa] = useState<string | null>(null);
  const [substituicoesSelecionadas, setSubstituicoesSelecionadas] = useState<Record<number, boolean>>({});
  const [isAnalisandoIa, setIsAnalisandoIa] = useState(false);

  // Mutação para sugerir insumos substitutos com IA
  const sugerirSubstitutosMutation = useMutation({
    mutationFn: async (itensFaltantesPayload: any[]) => {
      setIsAnalisandoIa(true);
      const res = await fetch('/api/ai/formulacao/sugerir-substitutos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: id,
          produtoNome: produto?.nome,
          quantidadeProduzir: parseFloat(qtdProduzir) || 1,
          itensFaltantes: itensFaltantesPayload
        })
      });
      if (!res.ok) {
        const fallback = await fetch('/ai/formulacao/sugerir-substitutos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produtoId: id,
            produtoNome: produto?.nome,
            quantidadeProduzir: parseFloat(qtdProduzir) || 1,
            itensFaltantes: itensFaltantesPayload
          })
        });
        if (!fallback.ok) throw new Error('Falha ao analisar substitutos via IA');
        return fallback.json();
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsAnalisandoIa(false);
      setParecerIa(data.parecerGeralIa);
      setSugestoesIa(data.sugestoes || []);
      const selecionadas: Record<number, boolean> = {};
      (data.sugestoes || []).forEach((s: any) => {
        selecionadas[s.insumoFaltanteId] = true;
      });
      setSubstituicoesSelecionadas(selecionadas);
    },
    onError: (err: any) => {
      setIsAnalisandoIa(false);
      alert('Erro na análise da IA: ' + err.message);
    }
  });

  // Mutação para executar produção com substitutos aprovados
  const executarProducaoComSubstitutosMutation = useMutation({
    mutationFn: async () => {
      if (!sugestoesIa || sugestoesIa.length === 0) return;
      const subItems = sugestoesIa
        .filter(s => substituicoesSelecionadas[s.insumoFaltanteId])
        .map(s => ({
          insumoOriginalId: s.insumoFaltanteId,
          insumoSubstitutoId: s.insumoSubstitutoId,
          quantidadeSubstituta: s.quantidadeSugerida
        }));

      const qtdNum = parseFloat(qtdProduzir) || 1;
      const res = await fetch('/api/ai/formulacao/produzir-com-substitutos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: id,
          variacaoId: selectedVariacaoId ? parseInt(selectedVariacaoId) : null,
          quantidade: qtdNum,
          substituicoes: subItems
        })
      });
      if (!res.ok) {
        const fallback = await fetch('/ai/formulacao/produzir-com-substitutos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produtoId: id,
            variacaoId: selectedVariacaoId ? parseInt(selectedVariacaoId) : null,
            quantidade: qtdNum,
            substituicoes: subItems
          })
        });
        if (!fallback.ok) {
          const err = await fallback.json();
          throw new Error(err.error || 'Falha ao executar produção com fórmula alternativa');
        }
        return fallback.json();
      }
      return res.json();
    },
    onSuccess: (data) => {
      setProducaoSuccess(data.message || 'Ordem de produção executada com fórmula adaptada!');
      setSugestoesIa(null);
      setParecerIa(null);
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoqueProdutos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['produtoTamanhos', id] });
    },
    onError: (err: any) => {
      alert('Erro na produção com substitutos: ' + err.message);
    }
  });

  if (!produto) return (
    <div className="p-12 text-center text-muted">Carregando detalhes da ficha técnica...</div>
  );

  // Cálculos em tempo real da Receita Base (CPV Fracionado)
  const rendimentoBase = Number(prodForm.rendimentoReceitaBase) || 1000;
  let custoTotalReceitaBase = 0;

  const itensCalculados = receita.map((r: any) => {
    const insumo = insumos.find((i: any) => i.id === r.insumoId);
    const un = unidades.find((u: any) => u.id === insumo?.unidadeMedidaId);
    const qtdEmbalagem = (insumo?.quantidadePorEmbalagem && insumo.quantidadePorEmbalagem > 0)
      ? insumo.quantidadePorEmbalagem
      : 1;
    // Custo por mililitro ou grama: preco ÷ tamanho da embalagem
    const custoPorUnidade = (insumo?.preco || 0) / qtdEmbalagem;
    const custoItem = custoPorUnidade * r.quantidadeUsada;
    custoTotalReceitaBase += custoItem;

    return {
      ...r,
      insumoNome: insumo?.nome || 'Insumo não encontrado',
      unidadeSigla: un?.sigla || '',
      precoEmbalagem: insumo?.preco || 0,
      tamanhoEmbalagem: qtdEmbalagem,
      custoPorUnidade,
      custoItem
    };
  });

  const custoPorMlBase = rendimentoBase > 0 ? custoTotalReceitaBase / rendimentoBase : 0;

  // Cálculos para o preview da Ordem de Produção
  const selectedVar = variacoes.find((v: any) => v.id.toString() === selectedVariacaoId);
  const qtdProdNum = parseFloat(qtdProduzir) || 1;
  const fatorProducao = selectedVar
    ? (qtdProdNum * selectedVar.tamanhoMedida) / rendimentoBase
    : qtdProdNum;

  // Detectar insumos com déficit para a Ordem de Produção atual
  const itensFaltantes: any[] = [];
  itensCalculados.forEach((item: any) => {
    const debito = item.quantidadeUsada * fatorProducao;
    const insumoDb = insumos.find((i: any) => i.id === item.insumoId);
    const estoqueAtual = insumoDb?.estoque ?? 0;
    if (estoqueAtual < debito) {
      itensFaltantes.push({
        insumoId: item.insumoId,
        insumoNome: item.insumoNome,
        quantidadeNecessaria: debito,
        saldoAtual: estoqueAtual,
        deficit: debito - estoqueAtual,
        unidadeSigla: item.unidadeSigla,
        isEmbalagem: false
      });
    }
  });

  if (selectedVar?.embalagemInsumoId) {
    const emb = insumos.find((i: any) => i.id === selectedVar.embalagemInsumoId);
    const estoqueAtual = emb?.estoque ?? 0;
    if (estoqueAtual < qtdProdNum) {
      itensFaltantes.push({
        insumoId: selectedVar.embalagemInsumoId,
        insumoNome: emb?.nome || 'Embalagem',
        quantidadeNecessaria: qtdProdNum,
        saldoAtual: estoqueAtual,
        deficit: qtdProdNum - estoqueAtual,
        unidadeSigla: 'un',
        isEmbalagem: true
      });
    }
  }

  const temInsumosFaltantes = itensFaltantes.length > 0;

  return (
    <div className="page produtos-detail-page">
      <div className="max-w-6xl mx-auto">
        {/* Toolbar Superior */}
        <section className="page-toolbar card" style={{ marginBottom: '24px' }}>
          <div className="page-heading">
            <button onClick={onBack} className="btn btn-secondary btn-icon" title="Voltar ao catálogo">
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="page-title">{produto.nome}</h1>
              <p className="page-subtitle">Ficha Técnica Master & Gestão de Formulação</p>
            </div>
          </div>

          <div className="toolbar-actions">
            <button
              onClick={() => {
                setProducaoSuccess(null);
                setIsProducaoModalOpen(true);
              }}
              className="btn btn-success btn-lg"
              title="Executar conversão e debitar insumos do estoque"
            >
              <Boxes size={18} />
              <span>Ordem de Produção (Converter)</span>
            </button>
            <button
              onClick={() => updateProduto.mutate()}
              className="btn btn-primary btn-lg"
              disabled={updateProduto.isPending}
            >
              <Save size={18} />
              <span>{updateProduto.isPending ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </section>

        {/* Informações do Produto Base */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="section-title">Informações do Produto Base</div>
          <div className="form-row" style={{ marginBottom: '0' }}>
            <div className="form-group" style={{ flex: 2 }}>
              <div className="flex justify-between items-baseline mb-1">
                <label htmlFor="edit-nome" className="required mb-0">Nome do Produto</label>
                <span className={`text-[11px] font-mono ${(prodForm.nome || '').length >= 140 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                  {(prodForm.nome || '').length}/150
                </span>
              </div>
              <input
                id="edit-nome"
                maxLength={150}
                value={prodForm.nome}
                onChange={e => setProdForm({ ...prodForm, nome: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="edit-rendimento" className="required">
                Rendimento Base (quantidade de produtos resultante)
              </label>
              <input
                id="edit-rendimento"
                type="number"
                step="1"
                min="1"
                value={prodForm.rendimentoReceitaBase}
                onChange={e => setProdForm({ ...prodForm, rendimentoReceitaBase: e.target.value })}
              />
              <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                Ex: 1000 para 1 Litro / 1000ml de formulação base.
              </small>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '16px', marginBottom: '0' }}>
            <div className="flex justify-between items-baseline mb-1">
              <label htmlFor="edit-descricao" className="mb-0">Descrição da Formulação</label>
              <span className={`text-[11px] font-mono ${(prodForm.descricao || '').length >= 950 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                {(prodForm.descricao || '').length}/1000
              </span>
            </div>
            <textarea
              id="edit-descricao"
              maxLength={1000}
              value={prodForm.descricao}
              onChange={e => setProdForm({ ...prodForm, descricao: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        {/* Ficha Técnica / Receita com Custo Fracionado (CPV) */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <div>
              <div className="section-title" style={{ marginBottom: '2px' }}>Ficha Técnica Master (Ingredientes)</div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Cálculo do Custo de Produto Vendido (CPV) com baixa fracionada.
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Custo Total da Receita Base:</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>
                {fmtBrl(custoTotalReceitaBase)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                (R$ {custoPorMlBase.toFixed(5)} por unidade)
              </div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); addReceita.mutate(); }} className="form-row" style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
            <div className="form-group" style={{ flex: 3, marginBottom: 0 }}>
              <label htmlFor="rec-insumo">Selecionar Insumo / Matéria-Prima</label>
              <select
                id="rec-insumo"
                required
                value={insumoId}
                onChange={e => setInsumoId(e.target.value)}
              >
                <option value="">Selecione um Insumo...</option>
                {insumos.map((i: any) => {
                  const un = unidades.find((u: any) => u.id === i.unidadeMedidaId)?.sigla || '';
                  return (
                    <option key={i.id} value={i.id}>
                      {i.nome} ({i.quantidadePorEmbalagem || 1} {un} - {fmtBrl(i.preco)})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label htmlFor="rec-qtd">Qtd. Usada (unidade)</label>
              <input
                id="rec-qtd"
                required
                type="number"
                step="0.01"
                placeholder="Ex: 700"
                value={quantidadeUsada}
                onChange={e => setQuantidadeUsada(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, alignSelf: 'flex-end' }}>
              <button
                type="submit"
                disabled={addReceita.isPending}
                className="btn btn-primary"
              >
                <Plus size={18} /> Adicionar Insumo
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell">Insumo</th>
                  <th className="table-cell text-right" style={{ width: '150px' }}>Qtd. Usada</th>
                  <th className="table-cell text-right" style={{ width: '180px' }}>Custo Base (R$/fração)</th>
                  <th className="table-cell text-right" style={{ width: '160px' }}>Custo na Receita</th>
                  <th className="table-cell text-center" style={{ width: '80px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {itensCalculados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted">
                      Nenhum ingrediente adicionado à receita base.
                    </td>
                  </tr>
                ) : (
                  itensCalculados.map((r: any) => (
                    <tr key={r.id}>
                      <td className="table-cell">
                        <strong>{r.insumoNome}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          Embalagem: {r.tamanhoEmbalagem} {r.unidadeSigla} por {fmtBrl(r.precoEmbalagem)}
                        </div>
                      </td>
                      <td className="table-cell text-right td-mono font-medium">
                        {r.quantidadeUsada} {r.unidadeSigla}
                      </td>
                      <td className="table-cell text-right td-mono td-muted">
                        R$ {r.custoPorUnidade.toFixed(5)} / {r.unidadeSigla}
                      </td>
                      <td className="table-cell text-right td-mono font-medium td-blue">
                        {fmtBrl(r.custoItem)}
                      </td>
                      <td className="table-cell table-cell-actions text-center">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const promptVal = window.prompt(
                                `Nova quantidade usada para "${r.insumoNome}" (${r.unidadeSigla}):`,
                                String(r.quantidadeUsada)
                              );
                              if (promptVal !== null) {
                                const novaQtd = parseFloat(promptVal.replace(',', '.'));
                                if (!isNaN(novaQtd) && novaQtd > 0) {
                                  updateReceita.mutate({ receitaId: r.id, quantidadeUsada: novaQtd });
                                } else {
                                  alert('Quantidade inválida.');
                                }
                              }
                            }}
                            className="btn btn-secondary btn-icon"
                            aria-label="Editar quantidade"
                            title="Editar quantidade usada"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (window.confirm('Remover ingrediente da receita?')) delReceita.mutate(r.id); }}
                            className="btn btn-danger btn-icon"
                            aria-label="Remover ingrediente"
                            title="Remover"
                          >
                            <Trash2 size={15} />
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

        {/* Variações / Tamanhos e Custos Finais */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <div>
              <div className="section-title" style={{ marginBottom: '2px' }}>Variações & Tamanhos de Venda</div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Custos calculados automaticamente somando o conteúdo líquido + embalagem.
              </p>
            </div>
            <span className="badge badge-gray">{variacoes.length} variações</span>
          </div>

          {(() => {
            const medidaNum = parseFloat(tamanhoMedida) || 0;
            const custoConteudoPrev = custoPorMlBase * medidaNum;
            const custoMateriaisPrev = novosMateriais.reduce((acc, m) => acc + getCustoInsumoUnitario(m.insumoId, m.quantidade), 0);
            const custoTotalPrev = custoConteudoPrev + custoMateriaisPrev;
            const margemNum = parseFloat(margemLucro) || 300;
            const precoVendaPrev = custoTotalPrev * (1 + margemNum / 100);

            const handleAddNovoMaterial = () => {
              if (!novoMaterialInsumoId) return;
              const insId = Number(novoMaterialInsumoId);
              const qtd = parseFloat(novoMaterialQtd) || 1;
              if (qtd <= 0) return;

              const jaExisteIdx = novosMateriais.findIndex(m => m.insumoId === insId);
              if (jaExisteIdx >= 0) {
                const updated = [...novosMateriais];
                updated[jaExisteIdx].quantidade += qtd;
                setNovosMateriais(updated);
              } else {
                setNovosMateriais([...novosMateriais, { insumoId: insId, quantidade: qtd }]);
              }
              setNovoMaterialInsumoId('');
              setNovoMaterialQtd('1');
            };

            const handleRemoverNovoMaterial = (index: number) => {
              setNovosMateriais(novosMateriais.filter((_, idx) => idx !== index));
            };

            return (
              <form onSubmit={(e) => { e.preventDefault(); addVariacao.mutate(); }} style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
                <div className="form-row" style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ flex: 2, minWidth: '160px', marginBottom: 0 }}>
                    <label htmlFor="var-nome">Nome da Variação</label>
                    <input
                      id="var-nome"
                      required
                      placeholder="Ex: 250ml Difusor Vidro Luxo..."
                      value={nomeTamanho}
                      onChange={e => setNomeTamanho(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '90px', marginBottom: 0 }}>
                    <label htmlFor="var-medida">Medida</label>
                    <input
                      id="var-medida"
                      required
                      type="number"
                      step="1"
                      placeholder="Ex: 250"
                      value={tamanhoMedida}
                      onChange={e => setTamanhoMedida(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '100px', marginBottom: 0 }}>
                    <label htmlFor="var-unidade">Unidade</label>
                    <select
                      id="var-unidade"
                      required
                      value={unidadeMedidaTamanhoId}
                      onChange={e => setUnidadeMedidaTamanhoId(e.target.value)}
                    >
                      <option value="">Unidade...</option>
                      {unidades.map((u: any) => <option key={u.id} value={u.id}>{u.sigla} ({u.nome})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '120px', marginBottom: 0 }}>
                    <label htmlFor="var-margem">Margem Lucro</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="var-margem"
                        required
                        type="number"
                        step="1"
                        min="0"
                        placeholder="300"
                        value={margemLucro}
                        onChange={e => setMargemLucro(e.target.value)}
                        style={{ paddingRight: '26px' }}
                      />
                      <span style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600, fontSize: '13px' }}>
                        %
                      </span>
                    </div>
                  </div>
                  <div className="form-group" style={{ flex: 1.5, minWidth: '130px', marginBottom: 0 }}>
                    <label htmlFor="var-barcode">Cód. Barras (EAN)</label>
                    <input
                      id="var-barcode"
                      placeholder="Ex: 789123456789"
                      value={novoVarCodigoBarras}
                      onChange={e => setNovoVarCodigoBarras(e.target.value)}
                    />
                  </div>
                </div>

                {/* Materiais e Componentes da Variação (Frasco, Tampas, Pérolas, Fitas, etc.) */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      Materiais & Componentes da Variação (insumos utilizados diferentes a composição do produto ex.: adornos):
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {novosMateriais.length} componente(s) adicionado(s)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center" style={{ marginBottom: '10px' }}>
                    <div style={{ flex: 3, minWidth: '220px' }}>
                      <select
                        value={novoMaterialInsumoId}
                        onChange={e => setNovoMaterialInsumoId(e.target.value)}
                        style={{ width: '100%', fontSize: '13px' }}
                      >
                        <option value="">Selecione o material / componente...</option>
                        {insumos.map((i: any) => (
                          <option key={i.id} value={i.id}>
                            {i.nome} ({fmtBrl(i.preco)} / {i.quantidadePorEmbalagem || 1} {i.unidadeSigla})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '90px' }}>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="Qtd usada"
                        value={novoMaterialQtd}
                        onChange={e => setNovoMaterialQtd(e.target.value)}
                        style={{ width: '100%', fontSize: '13px' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNovoMaterial}
                      disabled={!novoMaterialInsumoId}
                      className="btn btn-secondary btn-sm"
                      style={{ height: '38px' }}
                    >
                      <Plus size={15} /> Incluir Material
                    </button>
                  </div>

                  {/* Lista de materiais incluídos */}
                  {novosMateriais.length > 0 ? (
                    <div className="flex flex-wrap gap-2" style={{ marginBottom: '12px' }}>
                      {novosMateriais.map((m, idx) => {
                        const ins = insumos.find((i: any) => i.id === m.insumoId);
                        const custo = getCustoInsumoUnitario(m.insumoId, m.quantidade);
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '12px'
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{m.quantidade} {ins?.unidadeSigla || 'un'}</span>
                            <span>{ins?.nome || 'Insumo'}</span>
                            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>({fmtBrl(custo)})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoverNovoMaterial(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}
                              title="Remover material"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', marginBottom: '12px' }}>
                      Nenhum componente vinculado. Adicione os itens desta variação (ex: 1 Frasco 250ml, 10 Pérolas, 15cm Fita).
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                    <div className="flex flex-wrap items-center gap-4" style={{ fontSize: '13px' }}>
                      <span>Líquido: <strong className="td-mono">{fmtBrl(custoConteudoPrev)}</strong></span>
                      <span>+ Materiais: <strong className="td-mono">{fmtBrl(custoMateriaisPrev)}</strong></span>
                      <span>= Custo Total (CPV): <strong className="td-mono td-blue">{fmtBrl(custoTotalPrev)}</strong></span>
                      <span>Preço Venda ({margemNum}%): <strong className="td-mono" style={{ color: '#059669', fontSize: '14px' }}>{fmtBrl(precoVendaPrev)}</strong></span>
                    </div>
                    <button
                      type="submit"
                      disabled={addVariacao.isPending || !nomeTamanho || !tamanhoMedida || !unidadeMedidaTamanhoId}
                      className="btn btn-primary"
                    >
                      <Plus size={18} /> {addVariacao.isPending ? 'Cadastrando...' : 'Cadastrar Variação'}
                    </button>
                  </div>
                </div>
              </form>
            );
          })()}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-cell">Variação</th>
                  <th className="table-cell text-right" style={{ width: '100px' }}>Tamanho</th>
                  <th className="table-cell">Materiais Usados (Frascos, Embalagens, Fitas...)</th>
                  <th className="table-cell text-right" style={{ width: '110px' }}>Custo Líquido</th>
                  <th className="table-cell text-right" style={{ width: '110px' }}>Custo Materiais</th>
                  <th className="table-cell text-right" style={{ width: '120px' }}>Custo Total (CPV)</th>
                  <th className="table-cell text-right" style={{ width: '110px' }}>Margem Lucro</th>
                  <th className="table-cell text-right" style={{ width: '120px' }}>Preço Venda</th>
                  <th className="table-cell text-center" style={{ width: '130px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {variacoes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted">
                      Nenhuma variação cadastrada para este produto.
                    </td>
                  </tr>
                ) : (
                  variacoes.map((v: any) => {
                    const un = unidades.find((u: any) => u.id === v.unidadeMedidaTamanhoId)?.sigla || '';
                    const custoConteudo = custoPorMlBase * (v.tamanhoMedida || 0);

                    const mats: any[] = v.materiais || [];
                    const custoMateriais = mats.length > 0
                      ? mats.reduce((acc: number, m: any) => acc + (m.custoUnitario || getCustoInsumoUnitario(m.insumoId, m.quantidade)), 0)
                      : (v.embalagemInsumoId ? (() => {
                        const emb = insumos.find((i: any) => i.id === v.embalagemInsumoId);
                        return emb ? (emb.preco / (emb.quantidadePorEmbalagem || 1)) : 0;
                      })() : 0);

                    const custoTotal = custoConteudo + custoMateriais;
                    const margemEfetiva = v.margemLucro !== undefined && v.margemLucro !== null && v.margemLucro > 0 ? v.margemLucro : 300;
                    const precoCalculado = v.precoVenda > 0 ? v.precoVenda : (custoTotal * (1 + margemEfetiva / 100));

                    return (
                      <tr key={v.id}>
                        <td className="table-cell font-medium">
                          <strong>{v.nomeTamanho}</strong>
                          {v.codigoBarras && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--muted)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: '4px', marginTop: '3px' }}>
                              <Barcode size={12} /> {v.codigoBarras}
                            </div>
                          )}
                        </td>
                        <td className="table-cell text-right td-mono">
                          {v.tamanhoMedida} {un}
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-1 items-center">
                            {mats.length > 0 ? (
                              mats.map((m: any, mIdx: number) => {
                                const ins = insumos.find((i: any) => i.id === m.insumoId);
                                const sigla = m.unidadeSigla || ins?.unidadeSigla || 'un';
                                return (
                                  <span key={mIdx} className="badge badge-gray" style={{ fontSize: '11px' }}>
                                    {m.quantidade} {sigla} {m.insumoNome || ins?.nome}
                                  </span>
                                );
                              })
                            ) : (
                              v.embalagemInsumoId ? (() => {
                                const emb = insumos.find((i: any) => i.id === v.embalagemInsumoId);
                                return <span className="badge badge-gray" style={{ fontSize: '11px' }}>1 un {emb?.nome || 'Embalagem'}</span>;
                              })() : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Sem materiais</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenGerenciarMateriais(v)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '1px 6px', fontSize: '11px', height: 'auto' }}
                              title="Gerenciar lista de materiais desta variação"
                            >
                              + Materiais
                            </button>
                          </div>
                        </td>
                        <td className="table-cell text-right td-mono td-muted">
                          {fmtBrl(custoConteudo)}
                        </td>
                        <td className="table-cell text-right td-mono td-muted">
                          {fmtBrl(custoMateriais)}
                        </td>
                        <td className="table-cell text-right td-mono font-medium td-blue">
                          {fmtBrl(v.custoUnitarioCalculado || custoTotal)}
                        </td>
                        <td className="table-cell text-right td-mono" style={{ color: '#059669', fontWeight: 600 }}>
                          {margemEfetiva}%
                        </td>
                        <td className="table-cell text-right td-mono font-medium" style={{ fontSize: '14px', fontWeight: 700 }}>
                          {fmtBrl(precoCalculado)}
                        </td>
                        <td className="table-cell table-cell-actions text-center">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditVariacao(v)}
                              className="btn btn-action btn-icon"
                              aria-label="Editar Variação"
                              title="Editar Variação Completa e Materiais"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenGerenciarMateriais(v)}
                              className="btn btn-secondary btn-icon"
                              aria-label="Gerenciar Materiais"
                              title="Gerenciar Materiais Usados"
                            >
                              <PackageOpen size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const novaMargemStr = window.prompt(
                                  `Definir novo percentual de lucro (%) para "${v.nomeTamanho}":`,
                                  margemEfetiva.toString()
                                );
                                if (novaMargemStr === null) return;
                                const novaMargem = parseFloat(novaMargemStr);
                                if (isNaN(novaMargem) || novaMargem < 0) {
                                  alert('Por favor, informe uma porcentagem válida.');
                                  return;
                                }
                                updateVariacaoMargemMutation.mutate({ variacao: v, novaMargem });
                              }}
                              className="btn btn-secondary btn-icon"
                              aria-label="Editar Margem"
                              title="Ajustar Margem de Lucro (%)"
                            >
                              <Percent size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm('Remover esta variação?')) delVariacao.mutate(v.id); }}
                              className="btn btn-danger btn-icon"
                              aria-label="Remover variação"
                              title="Remover"
                            >
                              <Trash2 size={15} />
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
        </div>

        {/* Modal Editar Variação Completa com Materiais */}
        {modalEditVariacaoOpen && editingVariacao && (
          <div className="modal-overlay active" onClick={(e) => {
            if (e.target === e.currentTarget) setModalEditVariacaoOpen(false);
          }}>
            <div className="modal-content" style={{ maxWidth: '640px' }}>
              <div className="modal-header">
                <h3>Editar Variação & Materiais</h3>
                <button className="modal-close" onClick={() => setModalEditVariacaoOpen(false)}>&times;</button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                updateVariacaoMutation.mutate({
                  id: editingVariacao.id,
                  produtoId: id,
                  nomeTamanho: editVarNome,
                  tamanhoMedida: Number(editVarMedida),
                  unidadeMedidaTamanhoId: Number(editVarUnidadeId),
                  embalagemInsumoId: editVarMateriais.length > 0 ? editVarMateriais[0].insumoId : null,
                  tempoProducaoMinutos: editingVariacao.tempoProducaoMinutos || 0.0,
                  margemLucro: Number(editVarMargem),
                  precoVenda: 0.0,
                  custoUnitarioCalculado: 0.0
                });
              }}>
                <div className="form-row" style={{ marginBottom: '14px' }}>
                  <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                    <label className="required">Nome do Tamanho / Variação</label>
                    <input
                      type="text"
                      required
                      value={editVarNome}
                      onChange={e => setEditVarNome(e.target.value)}
                      placeholder="Ex: 250ml Frasco Vidro"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1.2, marginBottom: 0 }}>
                    <label>Cód. Barras (EAN)</label>
                    <input
                      type="text"
                      value={editVarCodigoBarras}
                      onChange={e => setEditVarCodigoBarras(e.target.value)}
                      placeholder="Ex: 789123456789"
                    />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: '14px' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="required">Medida Líquida</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editVarMedida}
                      onChange={e => setEditVarMedida(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="required">Unidade</label>
                    <select
                      required
                      value={editVarUnidadeId}
                      onChange={e => setEditVarUnidadeId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {unidades.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.sigla} ({u.nome})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="required">Margem de Lucro (%)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        value={editVarMargem}
                        onChange={e => setEditVarMargem(e.target.value)}
                        style={{ paddingRight: '26px' }}
                      />
                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>%</span>
                    </div>
                  </div>
                </div>

                {/* Seção de Materiais na Edição */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                    Materiais Usados nesta Variação (Frasco, Tampas, Pérolas, Fitas, etc.):
                  </div>

                  <div className="flex flex-wrap gap-2 items-center" style={{ marginBottom: '10px' }}>
                    <div style={{ flex: 3, minWidth: '220px' }}>
                      <select
                        value={editMaterialInsumoId}
                        onChange={e => setEditMaterialInsumoId(e.target.value)}
                        style={{ width: '100%', fontSize: '13px' }}
                      >
                        <option value="">Selecione o insumo / material...</option>
                        {insumos.map((i: any) => (
                          <option key={i.id} value={i.id}>
                            {i.nome} ({fmtBrl(i.preco)} / {i.quantidadePorEmbalagem || 1} {i.unidadeSigla})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '90px' }}>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="Qtd"
                        value={editMaterialQtd}
                        onChange={e => setEditMaterialQtd(e.target.value)}
                        style={{ width: '100%', fontSize: '13px' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editMaterialInsumoId) return;
                        const insId = Number(editMaterialInsumoId);
                        const qtd = parseFloat(editMaterialQtd) || 1;
                        if (qtd <= 0) return;
                        const ins = insumos.find((i: any) => i.id === insId);
                        const custo = getCustoInsumoUnitario(insId, qtd);

                        const jaExisteIdx = editVarMateriais.findIndex(m => m.insumoId === insId);
                        if (jaExisteIdx >= 0) {
                          const updated = [...editVarMateriais];
                          updated[jaExisteIdx].quantidade += qtd;
                          updated[jaExisteIdx].custoUnitario = getCustoInsumoUnitario(insId, updated[jaExisteIdx].quantidade);
                          setEditVarMateriais(updated);
                        } else {
                          setEditVarMateriais([
                            ...editVarMateriais,
                            {
                              insumoId: insId,
                              quantidade: qtd,
                              insumoNome: ins?.nome,
                              unidadeSigla: ins?.unidadeSigla,
                              custoUnitario: custo
                            }
                          ]);
                        }
                        setEditMaterialInsumoId('');
                        setEditMaterialQtd('1');
                      }}
                      disabled={!editMaterialInsumoId}
                      className="btn btn-secondary btn-sm"
                      style={{ height: '38px' }}
                    >
                      <Plus size={15} /> Adicionar
                    </button>
                  </div>

                  <div className="table-wrapper" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="w-full" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th className="table-cell">Material</th>
                          <th className="table-cell text-right">Qtd Usada</th>
                          <th className="table-cell text-right">Custo Proporcional</th>
                          <th className="table-cell text-center" style={{ width: '50px' }}>Remover</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editVarMateriais.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-3 text-center text-muted">
                              Nenhum componente vinculado a esta variação.
                            </td>
                          </tr>
                        ) : (
                          editVarMateriais.map((m, idx) => {
                            const ins = insumos.find((i: any) => i.id === m.insumoId);
                            const custo = m.custoUnitario || getCustoInsumoUnitario(m.insumoId, m.quantidade);
                            const sigla = m.unidadeSigla || ins?.unidadeSigla || 'un';
                            return (
                              <tr key={idx}>
                                <td className="table-cell font-medium">
                                  {m.insumoNome || ins?.nome}
                                </td>
                                <td className="table-cell text-right td-mono font-medium">
                                  {m.quantidade} {sigla}
                                </td>
                                <td className="table-cell text-right td-mono td-blue font-medium">
                                  {fmtBrl(custo)}
                                </td>
                                <td className="table-cell text-center">
                                  <button
                                    type="button"
                                    onClick={() => setEditVarMateriais(editVarMateriais.filter((_, i) => i !== idx))}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}
                                    title="Remover"
                                  >
                                    <X size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalEditVariacaoOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={updateVariacaoMutation.isPending} className="btn btn-primary">
                    {updateVariacaoMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Gerenciar Materiais da Variação */}
        {modalMateriaisOpen && variacaoParaMateriais && (
          <div className="modal-overlay active" onClick={(e) => {
            if (e.target === e.currentTarget) setModalMateriaisOpen(false);
          }}>
            <div className="modal-content" style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Materiais Usados na Variação</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                    {variacaoParaMateriais.nomeTamanho} ({variacaoParaMateriais.tamanhoMedida} {unidades.find((u: any) => u.id === variacaoParaMateriais.unidadeMedidaTamanhoId)?.sigla || ''})
                  </p>
                </div>
                <button className="modal-close" onClick={() => setModalMateriaisOpen(false)}>&times;</button>
              </div>

              <div style={{ padding: '16px 0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Incluir material usado (ex: Frasco 250ml, 10 pérolas, 15cm de fita...):
                </div>
                <div className="flex flex-wrap gap-2 items-center" style={{ marginBottom: '14px' }}>
                  <div style={{ flex: 3, minWidth: '220px' }}>
                    <select
                      value={gerenciarInsumoId}
                      onChange={e => setGerenciarInsumoId(e.target.value)}
                      style={{ width: '100%', fontSize: '13px' }}
                    >
                      <option value="">Selecione o insumo / material...</option>
                      {insumos.map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.nome} ({fmtBrl(i.preco)} / {i.quantidadePorEmbalagem || 1} {i.unidadeSigla})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '90px' }}>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="Qtd"
                      value={gerenciarQtd}
                      onChange={e => setGerenciarQtd(e.target.value)}
                      style={{ width: '100%', fontSize: '13px' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!gerenciarInsumoId) return;
                      const insId = Number(gerenciarInsumoId);
                      const qtd = parseFloat(gerenciarQtd) || 1;
                      if (qtd <= 0) return;
                      const ins = insumos.find((i: any) => i.id === insId);
                      const custo = getCustoInsumoUnitario(insId, qtd);

                      const jaExisteIdx = gerenciarMateriaisLista.findIndex(m => m.insumoId === insId);
                      if (jaExisteIdx >= 0) {
                        const updated = [...gerenciarMateriaisLista];
                        updated[jaExisteIdx].quantidade += qtd;
                        updated[jaExisteIdx].custoUnitario = getCustoInsumoUnitario(insId, updated[jaExisteIdx].quantidade);
                        setGerenciarMateriaisLista(updated);
                      } else {
                        setGerenciarMateriaisLista([
                          ...gerenciarMateriaisLista,
                          {
                            insumoId: insId,
                            quantidade: qtd,
                            insumoNome: ins?.nome,
                            unidadeSigla: ins?.unidadeSigla,
                            custoUnitario: custo
                          }
                        ]);
                      }
                      setGerenciarInsumoId('');
                      setGerenciarQtd('1');
                    }}
                    disabled={!gerenciarInsumoId}
                    className="btn btn-secondary btn-sm"
                    style={{ height: '38px' }}
                  >
                    <Plus size={15} /> Adicionar
                  </button>
                </div>

                <div className="table-wrapper" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  <table className="w-full" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th className="table-cell">Material</th>
                        <th className="table-cell text-right">Qtd Usada</th>
                        <th className="table-cell text-right">Custo Proporcional</th>
                        <th className="table-cell text-center" style={{ width: '50px' }}>Remover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gerenciarMateriaisLista.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-muted">
                            Nenhum material adicionado a esta variação.
                          </td>
                        </tr>
                      ) : (
                        gerenciarMateriaisLista.map((m, idx) => {
                          const ins = insumos.find((i: any) => i.id === m.insumoId);
                          const custo = m.custoUnitario || getCustoInsumoUnitario(m.insumoId, m.quantidade);
                          const sigla = m.unidadeSigla || ins?.unidadeSigla || 'un';
                          return (
                            <tr key={idx}>
                              <td className="table-cell font-medium">
                                {m.insumoNome || ins?.nome}
                              </td>
                              <td className="table-cell text-right td-mono font-medium">
                                {m.quantidade} {sigla}
                              </td>
                              <td className="table-cell text-right td-mono td-blue font-medium">
                                {fmtBrl(custo)}
                              </td>
                              <td className="table-cell text-center">
                                <button
                                  type="button"
                                  onClick={() => setGerenciarMateriaisLista(gerenciarMateriaisLista.filter((_, i) => i !== idx))}
                                  className="btn btn-danger btn-icon btn-sm"
                                  title="Remover"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '13px' }}>
                  Total Custo Materiais: <strong className="td-mono td-blue" style={{ fontSize: '15px' }}>
                    {fmtBrl(gerenciarMateriaisLista.reduce((acc, m) => acc + (m.custoUnitario || getCustoInsumoUnitario(m.insumoId, m.quantidade)), 0))}
                  </strong>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalMateriaisOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvarMateriaisVariacaoMutation.isPending}
                  onClick={() => {
                    salvarMateriaisVariacaoMutation.mutate({
                      variacaoId: variacaoParaMateriais.id,
                      materiais: gerenciarMateriaisLista
                    });
                  }}
                  className="btn btn-primary"
                >
                  {salvarMateriaisVariacaoMutation.isPending ? 'Salvando...' : 'Salvar Materiais'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rótulo do Produto */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ marginBottom: '16px' }}>
            <div>
              <div className="section-title" style={{ marginBottom: '2px' }}>Rótulo do Produto</div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Texto de rotulagem com características, quantidade por embalagem, materiais (sem quantidades) e modo de uso.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (rotuloText) {
                    navigator.clipboard.writeText(rotuloText);
                    alert('Texto do rótulo copiado para a área de transferência!');
                  }
                }}
                disabled={!rotuloText}
                className="btn btn-secondary btn-sm"
                title="Copiar texto do rótulo"
              >
                <Copy size={16} /> Copiar
              </button>
              <button
                type="button"
                onClick={() => gerarRotulo.mutate()}
                disabled={gerarRotulo.isPending}
                className="btn btn-secondary btn-sm"
              >
                <Sparkles size={16} /> {gerarRotulo.isPending ? 'Gerando...' : 'Gerar Rótulo Automático'}
              </button>
              <button
                type="button"
                onClick={() => salvarRotulo.mutate()}
                disabled={salvarRotulo.isPending}
                className="btn btn-primary btn-sm"
              >
                <Save size={16} /> {salvarRotulo.isPending ? 'Salvando...' : 'Salvar Rótulo'}
              </button>
            </div>
          </div>
          <textarea
            value={rotuloText}
            onChange={(e) => setRotuloText(e.target.value)}
            className="w-full resize-y font-mono text-sm"
            rows={14}
            placeholder="Clique em 'Gerar Rótulo Automático' para gerar o texto do rótulo completo com materiais (sem quantidades), características, embalagens e modo de uso..."
            style={{ lineHeight: 1.5, padding: '12px', borderRadius: '8px' }}
          />
        </div>
      </div>

      {/* Modal Ordem de Produção (Conversão & Baixa de Insumos) */}
      {isProducaoModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsProducaoModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Boxes size={22} style={{ color: 'var(--accent)' }} />
                <h2 className="modal-title">Executar Ordem de Produção</h2>
              </div>
              <button onClick={() => setIsProducaoModalOpen(false)} className="modal-close">
                <X size={20} />
              </button>
            </div>

            {producaoSuccess ? (
              <div className="modal-body" style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ color: 'var(--success)', display: 'inline-flex', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', marginBottom: '16px' }}>
                  <CheckCircle2 size={48} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                  Produção Convertida com Sucesso!
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
                  Os insumos foram debitados proporcionalmente do Estoque Geral e o saldo do produto acabado foi atualizado.
                </p>
                <button
                  type="button"
                  onClick={() => setIsProducaoModalOpen(false)}
                  className="btn btn-primary"
                >
                  Concluir e Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={e => {
                e.preventDefault();
                executarProducaoMutation.mutate({
                  varId: selectedVariacaoId ? parseInt(selectedVariacaoId) : null,
                  qtd: qtdProdNum
                });
              }}>
                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label htmlFor="prod-var-select">Variação a Produzir</label>
                      <select
                        id="prod-var-select"
                        value={selectedVariacaoId}
                        onChange={e => setSelectedVariacaoId(e.target.value)}
                      >
                        {variacoes.map((v: any) => (
                          <option key={v.id} value={v.id.toString()}>
                            {v.nomeTamanho} ({v.tamanhoMedida} {unidades.find((u: any) => u.id === v.unidadeMedidaTamanhoId)?.sigla || ''})
                          </option>
                        ))}
                        <option value="">Receita Base Completa ({rendimentoBase} {unidades.find((u: any) => u.id === variacoes[0]?.unidadeMedidaTamanhoId)?.sigla || ''})</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label htmlFor="prod-qtd-input" className="required">Qtd. a Produzir</label>
                      <input
                        id="prod-qtd-input"
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={qtdProduzir}
                        onChange={e => setQtdProduzir(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Tabela de Baixa Direta de Insumos */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                      Insumos que serão baixados do Estoque Geral:
                    </div>
                    <div className="table-wrapper" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      <table className="w-full" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th className="table-cell">Insumo</th>
                            <th className="table-cell text-right">Qtd. Baixar</th>
                            <th className="table-cell text-right">Estoque Atual</th>
                            <th className="table-cell text-right">Saldo Após</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensCalculados.map((item: any) => {
                            const debito = item.quantidadeUsada * fatorProducao;
                            const insumoDb = insumos.find((i: any) => i.id === item.insumoId);
                            const estoqueAtual = insumoDb?.estoque ?? 0;
                            const saldoApos = estoqueAtual - debito;
                            const insuficiente = saldoApos < 0;

                            return (
                              <tr key={item.id}>
                                <td className="table-cell font-medium">
                                  {item.insumoNome}
                                </td>
                                <td className="table-cell text-right td-mono font-medium td-red">
                                  - {debito.toFixed(1)} {item.unidadeSigla}
                                </td>
                                <td className="table-cell text-right td-mono td-muted">
                                  {estoqueAtual} {item.unidadeSigla}
                                </td>
                                <td className="table-cell text-right td-mono" style={{ color: insuficiente ? 'var(--danger)' : 'var(--success)' }}>
                                  {saldoApos.toFixed(1)} {item.unidadeSigla}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Materiais e Componentes da Variação (Frasco, Tampas, Pérolas, Fitas, etc.) */}
                          {selectedVar?.materiais && selectedVar.materiais.length > 0 ? (
                            selectedVar.materiais.map((mat: any) => {
                              const insumoDb = insumos.find((i: any) => i.id === mat.insumoId);
                              const debito = mat.quantidade * qtdProdNum;
                              const estoqueAtual = insumoDb?.estoque ?? 0;
                              const saldoApos = estoqueAtual - debito;
                              const insuficiente = saldoApos < 0;
                              const sigla = mat.unidadeSigla || insumoDb?.unidadeSigla || 'un';

                              return (
                                <tr key={`mat-${mat.id || mat.insumoId}`} style={{ background: 'var(--surface-2)' }}>
                                  <td className="table-cell font-medium">
                                    📦 {mat.insumoNome || insumoDb?.nome || 'Componente'}
                                  </td>
                                  <td className="table-cell text-right td-mono font-medium td-red">
                                    - {debito.toFixed(1)} {sigla}
                                  </td>
                                  <td className="table-cell text-right td-mono td-muted">
                                    {estoqueAtual} {sigla}
                                  </td>
                                  <td className="table-cell text-right td-mono" style={{ color: insuficiente ? 'var(--danger)' : 'var(--success)' }}>
                                    {saldoApos.toFixed(1)} {sigla}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            selectedVar?.embalagemInsumoId ? (
                              (() => {
                                const emb = insumos.find((i: any) => i.id === selectedVar.embalagemInsumoId);
                                const estoqueAtual = emb?.estoque ?? 0;
                                const saldoApos = estoqueAtual - qtdProdNum;
                                const insuficiente = saldoApos < 0;

                                return (
                                  <tr style={{ background: 'var(--surface-2)' }}>
                                    <td className="table-cell font-medium">
                                      📦 {emb?.nome || 'Embalagem'}
                                    </td>
                                    <td className="table-cell text-right td-mono font-medium td-red">
                                      - {qtdProdNum} un
                                    </td>
                                    <td className="table-cell text-right td-mono td-muted">
                                      {estoqueAtual} un
                                    </td>
                                    <td className="table-cell text-right td-mono" style={{ color: insuficiente ? 'var(--danger)' : 'var(--success)' }}>
                                      {saldoApos} un
                                    </td>
                                  </tr>
                                );
                              })()
                            ) : null
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Banner de Formulação Alternativa com IA (Fase 4) */}
                  {temInsumosFaltantes && !sugestoesIa && (
                    <div style={{
                      marginTop: '16px',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--accent-ring)',
                      background: 'var(--accent-dim)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--accent)', fontSize: '13px' }}>
                          <Sparkles size={16} />
                          <span>{itensFaltantes.length} insumo(s) com saldo insuficiente para esta Ordem de Produção!</span>
                        </div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                          O Gemini 1.5 Flash pode analisar seu estoque em tempo real e sugerir substitutos compatíveis para não paralisar a produção.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => sugerirSubstitutosMutation.mutate(itensFaltantes)}
                        disabled={isAnalisandoIa}
                        className="btn btn-primary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <Sparkles size={14} />
                        {isAnalisandoIa ? 'Analisando com IA...' : 'Sugerir Formulação com IA'}
                      </button>
                    </div>
                  )}

                  {/* Painel de Formulação Alternativa Sugerida pela IA (Fase 4) */}
                  {sugestoesIa && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface-2)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                          <strong style={{ fontSize: '14px', color: 'var(--text)' }}>
                            Formulação Alternativa Sugerida pela IA
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSugestoesIa(null); setParecerIa(null); }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                          Descartar Sugestões
                        </button>
                      </div>

                      {parecerIa && (
                        <div style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '12px', lineHeight: '1.5', padding: '10px', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          💡 <strong>Parecer Técnico:</strong> {parecerIa}
                        </div>
                      )}

                      {sugestoesIa.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '12px', textAlign: 'center' }}>
                          Nenhum insumo alternativo com estoque suficiente foi localizado no momento.
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '6px 10px', textAlign: 'center', width: '40px' }}>Usar</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Insumo Faltante</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Substituto Sugerido</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Disponível</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Qtd. Adaptada</th>
                                <th style={{ padding: '6px 10px', textAlign: 'center' }}>Compatibilidade</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Justificativa Técnica</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sugestoesIa.map((s: any) => {
                                const isSelected = !!substituicoesSelecionadas[s.insumoFaltanteId];
                                return (
                                  <tr key={s.insumoFaltanteId} style={{ backgroundColor: isSelected ? 'var(--surface)' : 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ textAlign: 'center', padding: '8px' }}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          setSubstituicoesSelecionadas(prev => ({
                                            ...prev,
                                            [s.insumoFaltanteId]: e.target.checked
                                          }));
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                      <span style={{ textDecoration: isSelected ? 'line-through' : 'none', color: 'var(--muted)' }}>
                                        {s.insumoFaltanteNome}
                                      </span>
                                      <div style={{ fontSize: '10px', color: 'var(--red)' }}>
                                        Faltam {s.quantidadeFaltante.toFixed(1)} {s.unidadeSubstituto}
                                      </div>
                                    </td>
                                    <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--accent)' }}>
                                      ✨ {s.insumoSubstitutoNome}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                      {s.estoqueSubstituto.toFixed(1)} {s.unidadeSubstituto}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                      {s.quantidadeSugerida.toFixed(1)} {s.unidadeSubstituto}
                                    </td>
                                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                      <span className={`badge ${s.scoreCompatibilidade >= 0.85 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '11px', fontWeight: 700 }}>
                                        {(s.scoreCompatibilidade * 100).toFixed(0)}%
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      {s.justificativaTecnica}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {sugestoesIa.length > 0 && (
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => executarProducaoComSubstitutosMutation.mutate()}
                            disabled={executarProducaoComSubstitutosMutation.isPending || Object.values(substituicoesSelecionadas).every(v => !v)}
                            style={{
                              background: 'linear-gradient(135deg, #059669, #10b981)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 18px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Boxes size={16} />
                            {executarProducaoComSubstitutosMutation.isPending ? 'Executando Baixa com IA...' : 'Confirmar Produção com Substitutos Aprovados'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {executarProducaoMutation.isError && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 'var(--radius)', fontSize: '13px' }}>
                      {executarProducaoMutation.error?.message}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setIsProducaoModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={executarProducaoMutation.isPending || temInsumosFaltantes}
                    title={temInsumosFaltantes ? 'Utilize a sugestão de substitutos da IA ou reabasteça o estoque antes de converter' : 'Converter e debitar insumos'}
                  >
                    {executarProducaoMutation.isPending ? 'Executando Baixa...' : 'Confirmar Conversão & Baixar Insumos'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProdutosFinaisPage;
