import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  History,
  Layers,
  AlertCircle,
  Sparkles,
  AlertTriangle,
  Archive,
  DollarSign,
  CheckCircle,
  Percent,
  ShoppingBag,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Barcode,
  Clock
} from 'lucide-react';

interface Insumo {
  id: number;
  nome: string;
  unidadeMedidaId: number;
  quantidadePorEmbalagem?: number;
  fornecedorId?: number;
  preco: number;
  isEmbalagem: boolean;
  estoque?: number;
  estoqueMinimo?: number;
  unidadeSigla?: string;
  dataValidade?: string;
  lote?: string;
  codigoBarras?: string;
}

interface MovimentoEstoque {
  id: number;
  insumoId: number;
  tipo: string;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  origemReferencia?: string;
  referenciaId?: number;
  motivo?: string;
  criadoEm: string;
  insumoNome?: string;
  unidadeSigla?: string;
}

interface UnidadeCompra {
  id: number;
  insumoId: number;
  nomeEmbalagem: string;
  fatorConversao: number;
  precoEmbalagem?: number;
  codigoBarras?: string;
}

interface UnidadeMedida {
  id: number;
  nome: string;
  sigla: string;
}

interface Fornecedor {
  id: number;
  nome: string;
}

interface ItemRupturaPrevisao {
  insumoId: number;
  insumoNome: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  consumoMedioDiario: number;
  diasAteRuptura: number;
  quantidadeSugeridaCompra: number;
  unidadeSigla: string;
  fornecedorSugeridoId?: number;
  fornecedorSugeridoNome?: string;
  motivoRisco: string;
}

interface AlertaMargemPrevisao {
  variacaoId: number;
  produtoNome: string;
  nomeTamanho: string;
  custoUnitario: number;
  precoVenda: number;
  margemAtual: number;
  margemAlvo: number;
  precoSugerido: number;
  impacto: string;
  justificativa: string;
}

interface PrevisaoDashboardResponse {
  totalItensCriticos: number;
  totalProdutosMargemBaixa: number;
  itensRuptura: ItemRupturaPrevisao[];
  alertasMargem: AlertaMargemPrevisao[];
  resumoExecutivoIa: string;
  geradoEm: string;
}

type SortField = 'nome' | 'tipo' | 'unidade' | 'estoque' | 'quantidadePorEmbalagem' | 'preco' | 'valorTotal';
type SortDirection = 'asc' | 'desc';

const initialForm = {
  nome: '',
  unidadeMedidaId: '',
  quantidadePorEmbalagem: '',
  fornecedorId: '',
  preco: '0.00',
  isEmbalagem: 'false',
  estoque: '0',
  estoqueMinimo: '0',
  dataValidade: '',
  lote: '',
  codigoBarras: ''
};

export interface ValidadeInfo {
  status: 'SEM_VALIDADE' | 'VENCIDO' | 'A_VENCER' | 'VALIDO';
  label: string;
  diffDays: number | null;
  badgeClass: string;
}

export const getValidadeInfo = (dataValidade?: string): ValidadeInfo => {
  if (!dataValidade) {
    return { status: 'SEM_VALIDADE', label: 'Não informada', diffDays: null, badgeClass: 'badge-gray' };
  }
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [year, month, day] = dataValidade.split('-').map(Number);
    const val = new Date(year, month - 1, day);
    val.setHours(0, 0, 0, 0);
    const diffMs = val.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const dataFmt = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

    if (diffDays < 0) {
      return {
        status: 'VENCIDO',
        label: `Vencido há ${Math.abs(diffDays)}d (${dataFmt})`,
        diffDays,
        badgeClass: 'badge-red'
      };
    } else if (diffDays <= 30) {
      return {
        status: 'A_VENCER',
        label: diffDays === 0 ? `Vence hoje (${dataFmt})` : `Vence em ${diffDays}d (${dataFmt})`,
        diffDays,
        badgeClass: 'badge-yellow'
      };
    } else {
      return {
        status: 'VALIDO',
        label: `Válido até ${dataFmt}`,
        diffDays,
        badgeClass: 'badge-green'
      };
    }
  } catch {
    return { status: 'SEM_VALIDADE', label: dataValidade, diffDays: null, badgeClass: 'badge-gray' };
  }
};

const fmtBrl = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const removeAccents = (str: string) => {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const formatarDataHora = (isoStr: string) => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
};

const getTipoBadge = (tipo: string) => {
  switch (tipo) {
    case 'ENTRADA_COMPRA':
      return <span className="badge badge-green">Entrada Compra</span>;
    case 'SAIDA_PRODUCAO':
      return <span className="badge badge-blue">Saída Produção</span>;
    case 'AJUSTE_INVENTARIO':
      return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>Ajuste</span>;
    case 'PERDA':
      return <span className="badge badge-red">Perda</span>;
    case 'ESTORNO':
      return <span className="badge badge-yellow">Estorno</span>;
    default:
      return <span className="badge">{tipo}</span>;
  }
};

const InsumosPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Estados do Copilot IA
  const [tabAi, setTabAi] = useState<'ruptura' | 'margem'>('ruptura');
  const [mensagemSucessoOrcamento, setMensagemSucessoOrcamento] = useState<string | null>(null);
  const [isAiMinimized, setIsAiMinimized] = useState(true);

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'TODOS' | 'Matéria-prima' | 'Embalagem'>('TODOS');
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'NORMAL' | 'BAIXO' | 'ZERADO'>('TODOS');
  const [filterValidade, setFilterValidade] = useState<'TODOS' | 'VENCIDOS' | 'A_VENCER' | 'VALIDOS'>('TODOS');

  // Estados de Ordenação
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Estados de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);

  // Modal de Ajuste Rápido de Estoque
  const [editingEstoqueItem, setEditingEstoqueItem] = useState<Insumo | null>(null);
  const [novoEstoque, setNovoEstoque] = useState<string>('0');
  const [motivoAjuste, setMotivoAjuste] = useState<string>('');

  // Modal de Extrato de Movimentações (Ledger)
  const [extratoInsumo, setExtratoInsumo] = useState<Insumo | null>(null);

  // Modal de Embalagens de Compra (Fatores de Conversão)
  const [embalagensInsumo, setEmbalagensInsumo] = useState<Insumo | null>(null);
  const [novaEmbalagemNome, setNovaEmbalagemNome] = useState('');
  const [novoFatorConversao, setNovoFatorConversao] = useState('');
  const [novoPrecoEmbalagem, setNovoPrecoEmbalagem] = useState('');

  // Query de Previsão Preditiva de IA (Copilot)
  const { data: aiData, isLoading: loadAi, refetch: refetchAi } = useQuery<PrevisaoDashboardResponse>({
    queryKey: ['ai-previsao-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/ai/previsao/dashboard');
      if (!res.ok) {
        const fallback = await fetch('/ai/previsao/dashboard');
        if (!fallback.ok) throw new Error('Falha ao carregar previsões de IA');
        return fallback.json();
      }
      return res.json();
    },
    staleTime: 120_000
  });

  // Mutação para geração automática de orçamento de compra
  const gerarOrcamentoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ai/previsao/gerar-orcamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const fallback = await fetch('/ai/previsao/gerar-orcamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (!fallback.ok) throw new Error('Falha ao gerar orçamento');
        return fallback.json();
      }
      return res.json() as Promise<{ success: boolean; orcamentoId: number; message: string }>;
    },
    onSuccess: (data) => {
      setMensagemSucessoOrcamento(data.message);
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['ai-previsao-dashboard'] });
    },
    onError: (err: any) => {
      alert('Erro ao gerar orçamento: ' + err.message);
    }
  });

  // Queries
  const { data: insumoData, isLoading: loadInsumos, error: errorInsumos } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const res = await fetch('/insumos/json');
      if (!res.ok) throw new Error('Erro ao buscar insumos');
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

  // Query de Movimentações para o Insumo Selecionado
  const { data: movimentos = [], isLoading: loadMovimentos } = useQuery<MovimentoEstoque[]>({
    queryKey: ['movimentos', extratoInsumo?.id],
    queryFn: async () => {
      if (!extratoInsumo) return [];
      const res = await fetch(`/insumos/${extratoInsumo.id}/movimentos`);
      if (!res.ok) throw new Error('Erro ao buscar movimentações');
      return res.json();
    },
    enabled: !!extratoInsumo
  });

  // Query de Unidades de Compra para o Insumo Selecionado
  const { data: unidadesCompra = [], isLoading: loadUnidadesCompra } = useQuery<UnidadeCompra[]>({
    queryKey: ['unidadesCompra', embalagensInsumo?.id],
    queryFn: async () => {
      if (!embalagensInsumo) return [];
      const res = await fetch(`/insumos/${embalagensInsumo.id}/unidades-compra`);
      if (!res.ok) throw new Error('Erro ao buscar embalagens de compra');
      return res.json();
    },
    enabled: !!embalagensInsumo
  });

  const fornecedores: Fornecedor[] = Array.isArray(fornecedoresData)
    ? fornecedoresData
    : (Array.isArray(fornecedoresData.fornecedores) ? fornecedoresData.fornecedores : []);

  const insumos: Insumo[] = insumoData?.insumos || [];
  const unidades: UnidadeMedida[] = insumoData?.unidades || [];

  const getUnidadeSigla = (id: number) => unidades.find((u) => u.id === id)?.sigla || '—';
  const getFornecedorNome = (id?: number) => fornecedores.find((f) => f.id === id)?.nome || '—';

  // Helper de Formatação Visual de Medida Base
  const formatarEstoqueVisual = (qtd: number, sigla: string) => {
    const s = (sigla || '').toLowerCase().trim();
    if (s === 'ml' && qtd >= 1000) {
      const litros = (qtd / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
      return (
        <div title={`${qtd.toLocaleString('pt-BR')} ml`}>
          <span style={{ fontWeight: 600 }}>{litros} L</span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
            {qtd.toLocaleString('pt-BR')} ml
          </span>
        </div>
      );
    }
    if (s === 'g' && qtd >= 1000) {
      const kg = (qtd / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
      return (
        <div title={`${qtd.toLocaleString('pt-BR')} g`}>
          <span style={{ fontWeight: 600 }}>{kg} kg</span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
            {qtd.toLocaleString('pt-BR')} g
          </span>
        </div>
      );
    }
    return (
      <div>
        <span style={{ fontWeight: 600 }}>{qtd.toLocaleString('pt-BR')}</span>
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '4px' }}>{sigla}</span>
      </div>
    );
  };

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/insumos/deletar/${id}`);
      if (!res.ok) throw new Error('Falha ao excluir insumo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editingId ? `/insumos/atualizar/${editingId}` : `/insumos`;
      const data = new URLSearchParams(formData as any);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      });
      if (!res.ok) throw new Error('Falha ao salvar insumo');
      return res.json();
    },
    onSuccess: () => {
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const updateEstoqueMutation = useMutation({
    mutationFn: async ({ id, estoque, motivo }: { id: number; estoque: number; motivo?: string }) => {
      const form = new URLSearchParams();
      form.append('estoque', estoque.toString());
      if (motivo) form.append('motivo', motivo);
      const res = await fetch(`/insumos/ajustar-estoque/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
      if (!res.ok) throw new Error('Falha ao atualizar estoque');
      return res.json();
    },
    onSuccess: () => {
      setEditingEstoqueItem(null);
      setMotivoAjuste('');
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const addUnidadeCompraMutation = useMutation({
    mutationFn: async ({ insumoId, nomeEmbalagem, fatorConversao, precoEmbalagem }: { insumoId: number; nomeEmbalagem: string; fatorConversao: number; precoEmbalagem?: number }) => {
      const form = new URLSearchParams();
      form.append('nomeEmbalagem', nomeEmbalagem);
      form.append('fatorConversao', fatorConversao.toString());
      if (precoEmbalagem) form.append('precoEmbalagem', precoEmbalagem.toString());
      const res = await fetch(`/insumos/${insumoId}/unidades-compra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
      if (!res.ok) throw new Error('Falha ao cadastrar embalagem de compra');
      return res.json();
    },
    onSuccess: () => {
      setNovaEmbalagemNome('');
      setNovoFatorConversao('');
      setNovoPrecoEmbalagem('');
      queryClient.invalidateQueries({ queryKey: ['unidadesCompra', embalagensInsumo?.id] });
    }
  });

  const deleteUnidadeCompraMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/insumos/unidades-compra/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao remover embalagem de compra');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidadesCompra', embalagensInsumo?.id] });
    }
  });

  const syncEstoqueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/insumos/sincronizar-estoque-embalagem', {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Falha ao sincronizar estoque');
      return res.json() as Promise<{ status: string; atualizados?: number }>;
    },
    onSuccess: (data) => {
      alert(`Estoque sincronizado com sucesso! ${data.atualizados || 0} insumos foram atualizados com base no tamanho/quantidade da embalagem.`);
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  // Helper para cálculo correto do custo unitário base e valor total em estoque
  const getCustoUnitarioInsumo = (i: Insumo): number => {
    const qtdEmb = (i.quantidadePorEmbalagem && i.quantidadePorEmbalagem > 0) ? i.quantidadePorEmbalagem : 1;
    return (i.preco || 0) / qtdEmb;
  };

  const getValorTotalInsumo = (i: Insumo): number => {
    return (i.estoque || 0) * getCustoUnitarioInsumo(i);
  };

  // Estatísticas para os Cards de KPI
  const totalInsumos = insumos.length;
  const materiasPrimas = insumos.filter(i => !i.isEmbalagem).length;
  const embalagens = insumos.filter(i => i.isEmbalagem).length;
  const estoqueBaixo = insumos.filter(i => {
    const min = (i.estoqueMinimo !== undefined && i.estoqueMinimo !== null && i.estoqueMinimo > 0) ? i.estoqueMinimo : 5;
    const est = i.estoque ?? 0;
    return est > 0 && est <= min;
  }).length;
  const estoqueZerado = insumos.filter(i => (i.estoque ?? 0) === 0).length;
  const valorTotalEstoque = insumos.reduce((acc, i) => acc + getValorTotalInsumo(i), 0);

  // Estatísticas de Validade
  const insumosVencidos = insumos.filter(i => getValidadeInfo(i.dataValidade).status === 'VENCIDO').length;
  const insumosAVencer = insumos.filter(i => getValidadeInfo(i.dataValidade).status === 'A_VENCER').length;

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
  const filteredAndSortedInsumos = useMemo(() => {
    const filtered = insumos.filter(i => {
      const termo = removeAccents(searchTerm.trim().toLowerCase());
      const nomeMatch = removeAccents(i.nome.toLowerCase()).includes(termo);
      const codigoMatch = Boolean(i.codigoBarras && i.codigoBarras.toLowerCase().includes(termo));
      const loteMatch = Boolean(i.lote && removeAccents(i.lote.toLowerCase()).includes(termo));
      const matchSearch = termo === '' || nomeMatch || codigoMatch || loteMatch;

      const matchTipo =
        filterTipo === 'TODOS'
          ? true
          : filterTipo === 'Matéria-prima'
            ? !i.isEmbalagem
            : i.isEmbalagem;

      const min = (i.estoqueMinimo !== undefined && i.estoqueMinimo !== null && i.estoqueMinimo > 0) ? i.estoqueMinimo : 5;
      const matchStatus =
        filterStatus === 'TODOS'
          ? true
          : filterStatus === 'ZERADO'
            ? (i.estoque ?? 0) === 0
            : filterStatus === 'BAIXO'
              ? (i.estoque ?? 0) > 0 && (i.estoque ?? 0) <= min
              : filterStatus === 'NORMAL'
                ? (i.estoque ?? 0) > min
                : true;

      const valInfo = getValidadeInfo(i.dataValidade);
      const matchValidade =
        filterValidade === 'TODOS'
          ? true
          : filterValidade === 'VENCIDOS'
            ? valInfo.status === 'VENCIDO'
            : filterValidade === 'A_VENCER'
              ? valInfo.status === 'A_VENCER'
              : valInfo.status === 'VALIDO';

      return matchSearch && matchTipo && matchStatus && matchValidade;
    });

    return [...filtered].sort((a, b) => {
      if (!sortField) return 0;

      let result = 0;
      switch (sortField) {
        case 'nome': {
          const nomeA = a.nome || '';
          const nomeB = b.nome || '';
          result = nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base', numeric: true });
          break;
        }
        case 'tipo': {
          const tipoA = a.isEmbalagem ? 'Embalagem' : 'Matéria-Prima';
          const tipoB = b.isEmbalagem ? 'Embalagem' : 'Matéria-Prima';
          result = tipoA.localeCompare(tipoB, 'pt-BR');
          break;
        }
        case 'unidade': {
          const siglaA = getUnidadeSigla(a.unidadeMedidaId);
          const siglaB = getUnidadeSigla(b.unidadeMedidaId);
          result = siglaA.localeCompare(siglaB, 'pt-BR');
          break;
        }
        case 'estoque': {
          const estA = a.estoque ?? 0;
          const estB = b.estoque ?? 0;
          result = estA - estB;
          break;
        }
        case 'quantidadePorEmbalagem': {
          const qtdA = a.quantidadePorEmbalagem ?? 0;
          const qtdB = b.quantidadePorEmbalagem ?? 0;
          result = qtdA - qtdB;
          break;
        }
        case 'preco': {
          const precoA = a.preco ?? 0;
          const precoB = b.preco ?? 0;
          result = precoA - precoB;
          break;
        }
        case 'valorTotal': {
          const valA = getValorTotalInsumo(a);
          const valB = getValorTotalInsumo(b);
          result = valA - valB;
          break;
        }
        default:
          result = 0;
      }

      return sortDirection === 'asc' ? result : -result;
    });
  }, [insumos, searchTerm, filterTipo, filterStatus, filterValidade, sortField, sortDirection, unidades]);

  // Handlers de Modais
  const handleOpenCadastroModal = (i?: Insumo) => {
    if (i) {
      setEditingId(i.id);
      setFormData({
        nome: i.nome,
        unidadeMedidaId: i.unidadeMedidaId.toString(),
        quantidadePorEmbalagem: i.quantidadePorEmbalagem !== undefined && i.quantidadePorEmbalagem !== null ? i.quantidadePorEmbalagem.toString() : '',
        fornecedorId: i.fornecedorId ? i.fornecedorId.toString() : '',
        preco: i.preco !== undefined && i.preco !== null ? i.preco.toString() : '0.00',
        isEmbalagem: i.isEmbalagem ? 'true' : 'false',
        estoque: i.estoque !== undefined && i.estoque !== null ? i.estoque.toString() : '0',
        estoqueMinimo: i.estoqueMinimo !== undefined && i.estoqueMinimo !== null ? i.estoqueMinimo.toString() : '0',
        dataValidade: i.dataValidade || '',
        lote: i.lote || '',
        codigoBarras: i.codigoBarras || ''
      });
    } else {
      setEditingId(null);
      setFormData(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleOpenAjusteEstoque = (item: Insumo) => {
    setEditingEstoqueItem(item);
    setNovoEstoque((item.estoque ?? 0).toString());
    setMotivoAjuste('Ajuste de inventário físico');
  };

  const handleSaveAjusteEstoque = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEstoqueItem) return;
    updateEstoqueMutation.mutate({
      id: editingEstoqueItem.id,
      estoque: parseFloat(novoEstoque) || 0,
      motivo: motivoAjuste || 'Ajuste de inventário físico'
    });
  };

  const handleDelete = (id: number, nome: string) => {
    if (window.confirm(`Deseja realmente excluir o insumo "${nome}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Loading skeleton
  const renderTableSkeleton = () => (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['Insumo', 'Tipo', 'Unid.', 'Qtd. em Estoque', 'Tamanho da Embalagem', 'Preço Un.', 'Valor Total', 'Status', 'Ações'].map((h, i) => (
                <th key={i} className="table-cell">
                  <div className="skeleton skeleton-text" style={{ width: i === 0 ? '140px' : '90px' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <tr key={i}>
                {Array(9).fill(0).map((_, j) => (
                  <td key={j} className="table-cell">
                    <div className="skeleton skeleton-text" style={{ width: j === 0 ? '160px' : '80px' }} />
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
    <div className="page insumos-page">
      {/* Top Toolbar */}
      <section className="page-toolbar card">
        <div className="page-heading">
          <div className="page-heading-icon">
            <Package size={24} />
          </div>
          <div>
            <h1 className="page-title">Estoque de Insumos</h1>
            <p className="page-subtitle">Gestão de saldos físicos, matérias-primas, embalagens e custos</p>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="Ações de insumos e estoque">
          <button
            onClick={() => {
              if (window.confirm('Deseja preencher o estoque dos insumos zerados utilizando o valor de Qtd / Embalagem?')) {
                syncEstoqueMutation.mutate();
              }
            }}
            className="btn btn-secondary"
            title="Copiar Qtd / Embalagem para o saldo de estoque nos itens zerados"
            disabled={syncEstoqueMutation.isPending}
          >
            <RefreshCw size={18} className={syncEstoqueMutation.isPending ? 'animate-spin' : ''} />
            {syncEstoqueMutation.isPending ? 'Sincronizando...' : 'Preencher Saldo com Qtd/Embalagem'}
          </button>
          <button
            onClick={() => handleOpenCadastroModal()}
            className="btn btn-primary btn-lg"
          >
            <Plus size={20} />
            Novo Insumo
          </button>
        </div>
      </section>

      {/* Banner de Alerta de Validade Expirada */}
      {insumosVencidos > 0 && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: 'var(--radius)',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            color: '#991b1b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={24} color="#dc2626" />
            <div>
              <strong style={{ display: 'block', fontSize: '15px' }}>
                Atenção Crítica: {insumosVencidos} insumo(s) com validade vencida!
              </strong>
              <span style={{ fontSize: '13px', color: '#b91c1c' }}>
                Insumos vencidos não devem ser utilizados na fabricação de novos produtos para assegurar a integridade e segurança das fórmulas.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: '#dc2626', color: '#fff', border: 'none', whiteSpace: 'nowrap', fontWeight: 600, padding: '8px 14px' }}
            onClick={() => setFilterValidade('VENCIDOS')}
          >
            Ver Apenas Vencidos ({insumosVencidos})
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-icon blue"><Package size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Total de Insumos</div>
            <div className="kpi-value blue">{totalInsumos}</div>
            <div className="kpi-trend">{materiasPrimas} matérias-primas • {embalagens} embalagens</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon yellow"><AlertTriangle size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Estoque Baixo</div>
            <div className="kpi-value yellow">{estoqueBaixo}</div>
            <div className="kpi-trend">Abaixo do estoque mínimo</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red"><Archive size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Estoque Zerado</div>
            <div className="kpi-value red">{estoqueZerado}</div>
            <div className="kpi-trend">Sem unidades em estoque</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><DollarSign size={20} /></div>
          <div className="kpi-content">
            <div className="kpi-label">Valor Total em Estoque</div>
            <div className="kpi-value green">{fmtBrl(valorTotalEstoque)}</div>
            <div className="kpi-trend">Custo real proporcional fracionado</div>
          </div>
        </div>
        <div className="kpi-card">
          <div
            className="kpi-icon"
            style={{
              backgroundColor: insumosVencidos > 0 ? '#fee2e2' : insumosAVencer > 0 ? '#fef3c7' : '#dcfce7',
              color: insumosVencidos > 0 ? '#ef4444' : insumosAVencer > 0 ? '#d97706' : '#16a34a'
            }}
          >
            <Calendar size={20} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Controle de Validade</div>
            <div
              className="kpi-value"
              style={{
                color: insumosVencidos > 0 ? '#ef4444' : insumosAVencer > 0 ? '#d97706' : '#16a34a',
                fontSize: insumosVencidos > 0 ? '19px' : undefined
              }}
            >
              {insumosVencidos > 0
                ? `${insumosVencidos} Vencido(s)`
                : insumosAVencer > 0
                  ? `${insumosAVencer} A Vencer`
                  : 'Validade 100% OK'}
            </div>
            <div className="kpi-trend">
              {insumosVencidos > 0
                ? `${insumosAVencer} a vencer nos próx. 30 dias`
                : insumosAVencer > 0
                  ? 'Atenção nos próximos 30 dias'
                  : 'Nenhum insumo crítico'}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="section-title">Filtros e Pesquisa</div>
        <div className="form-row" style={{ marginBottom: '0' }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor="busca-insumo">Buscar Insumo</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                id="busca-insumo"
                type="text"
                placeholder="Buscar por nome, código de barras ou lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '38px' }}
                aria-label="Buscar insumo por nome, código de barras ou lote"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="filtro-tipo">Filtrar por Tipo</label>
            <select
              id="filtro-tipo"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as 'TODOS' | 'Matéria-prima' | 'Embalagem')}
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="Matéria-prima">Matérias-primas</option>
              <option value="Embalagem">Embalagens</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="filtro-status">Status do Estoque</label>
            <select
              id="filtro-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'TODOS' | 'NORMAL' | 'BAIXO' | 'ZERADO')}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="NORMAL">Normal (≥ 5)</option>
              <option value="BAIXO">Estoque Baixo (&lt; 5)</option>
              <option value="ZERADO">Estoque Zerado (0)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="filtro-validade">Controle de Validade</label>
            <select
              id="filtro-validade"
              value={filterValidade}
              onChange={(e) => setFilterValidade(e.target.value as any)}
            >
              <option value="TODOS">Todas as Validades</option>
              <option value="VENCIDOS">🔴 Vencidos</option>
              <option value="A_VENCER">🟡 A Vencer (≤ 30 dias)</option>
              <option value="VALIDOS">🟢 Válidos (&gt; 30 dias)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Insumos com Ordenação Interativa */}
      {loadInsumos && renderTableSkeleton()}

      {errorInsumos && (
        <div className="card p-6 text-center text-red-500">
          <p>Erro ao carregar dados dos insumos. Por favor, recarregue a página.</p>
        </div>
      )}

      {!loadInsumos && !errorInsumos && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {/* Insumo */}
                  <th className="table-cell">
                    <button
                      type="button"
                      onClick={() => handleSort('nome')}
                      className={`th-sort-button ${sortField === 'nome' ? 'active' : ''}`}
                      title="Ordenar por Nome do Insumo"
                    >
                      <span>Insumo</span>
                      {renderSortIcon('nome')}
                    </button>
                  </th>

                  {/* Tipo */}
                  <th className="table-cell" style={{ width: '130px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('tipo')}
                      className={`th-sort-button ${sortField === 'tipo' ? 'active' : ''}`}
                      title="Ordenar por Tipo"
                    >
                      <span>Tipo</span>
                      {renderSortIcon('tipo')}
                    </button>
                  </th>

                  {/* Unid. */}
                  <th className="table-cell" style={{ width: '80px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('unidade')}
                      className={`th-sort-button ${sortField === 'unidade' ? 'active' : ''}`}
                      title="Ordenar por Unidade"
                    >
                      <span>Unid.</span>
                      {renderSortIcon('unidade')}
                    </button>
                  </th>

                  {/* Qtd. em Estoque */}
                  <th className="table-cell text-right" style={{ width: '150px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('estoque')}
                      className={`th-sort-button justify-end ${sortField === 'estoque' ? 'active' : ''}`}
                      title="Ordenar por Quantidade em Estoque"
                    >
                      <span>Qtd. em Estoque</span>
                      {renderSortIcon('estoque')}
                    </button>
                  </th>

                  {/* Tamanho da Embalagem */}
                  <th className="table-cell text-right" style={{ width: '180px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('quantidadePorEmbalagem')}
                      className={`th-sort-button justify-end ${sortField === 'quantidadePorEmbalagem' ? 'active' : ''}`}
                      title="Ordenar por Tamanho da Embalagem"
                    >
                      <span>Tamanho da Embalagem</span>
                      {renderSortIcon('quantidadePorEmbalagem')}
                    </button>
                  </th>

                  {/* Preço Embalagem / Custo */}
                  <th className="table-cell text-right" style={{ width: '150px' }}>
                    <button
                      type="button"
                      onClick={() => handleSort('preco')}
                      className={`th-sort-button justify-end ${sortField === 'preco' ? 'active' : ''}`}
                      title="Ordenar por Preço da Embalagem"
                    >
                      <span>Preço / Custo</span>
                      {renderSortIcon('preco')}
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

                  {/* Validade & Lote */}
                  <th className="table-cell" style={{ width: '160px' }}>
                    <span>Validade & Lote</span>
                  </th>

                  {/* Status */}
                  <th className="table-cell" style={{ width: '100px' }}>
                    <span>Status</span>
                  </th>

                  {/* Ações */}
                  <th className="table-cell text-center" style={{ width: '190px' }}>
                    <span>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedInsumos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12">
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Package className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="empty-state-title">
                          {searchTerm || filterTipo !== 'TODOS' || filterStatus !== 'TODOS' || filterValidade !== 'TODOS'
                            ? 'Nenhum insumo encontrado'
                            : 'Nenhum insumo cadastrado'}
                        </h3>
                        <p className="empty-state-description">
                          {searchTerm || filterTipo !== 'TODOS' || filterStatus !== 'TODOS' || filterValidade !== 'TODOS'
                            ? 'Tente ajustar os filtros ou termos da busca para encontrar o item desejado.'
                            : 'Comece cadastrando seu primeiro insumo clicando no botão "Novo Insumo".'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedInsumos.map((i) => {
                    const qtd = i.estoque ?? 0;
                    const precoEmbalagem = i.preco ?? 0;
                    const qtdEmbalagem = (i.quantidadePorEmbalagem && i.quantidadePorEmbalagem > 0) ? i.quantidadePorEmbalagem : 1;
                    const custoUnitario = precoEmbalagem / qtdEmbalagem;
                    const valorTotal = qtd * custoUnitario;
                    const sigla = i.unidadeSigla || getUnidadeSigla(i.unidadeMedidaId);
                    const min = (i.estoqueMinimo !== undefined && i.estoqueMinimo !== null && i.estoqueMinimo > 0) ? i.estoqueMinimo : 5;
                    const isZerado = qtd === 0;
                    const isBaixo = qtd > 0 && qtd <= min;

                    return (
                      <tr key={i.id}>
                        {/* Insumo */}
                        <td className="table-cell">
                          <strong>{i.nome}</strong>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--muted)', marginTop: '2px', alignItems: 'center' }}>
                            {i.fornecedorId && (
                              <span>Forn: {getFornecedorNome(i.fornecedorId)}</span>
                            )}
                            {i.codigoBarras && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: '4px' }}>
                                <Barcode size={12} /> {i.codigoBarras}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="table-cell">
                          <span className={`badge ${i.isEmbalagem ? 'badge-blue' : 'badge-green'}`}>
                            {i.isEmbalagem ? 'Embalagem' : 'Matéria-Prima'}
                          </span>
                        </td>

                        {/* Unid. */}
                        <td className="table-cell td-muted">{sigla}</td>

                        {/* Qtd. em Estoque (Visual Inteligente) */}
                        <td className="table-cell text-right td-mono font-medium">
                          {formatarEstoqueVisual(qtd, sigla)}
                          {isBaixo && (
                            <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                              Mín: {min} {sigla}
                            </div>
                          )}
                        </td>

                        {/* Tamanho da Embalagem */}
                        <td className="table-cell text-right td-muted font-medium">
                          {i.quantidadePorEmbalagem ? `${i.quantidadePorEmbalagem.toLocaleString('pt-BR')} ${sigla}` : '—'}
                        </td>

                        {/* Preço Embalagem / Custo Base */}
                        <td className="table-cell text-right td-mono">
                          <div title={`Preço total da embalagem (${qtdEmbalagem.toLocaleString('pt-BR')} ${sigla}): ${fmtBrl(precoEmbalagem)}`}>
                            <span style={{ fontWeight: 500 }}>{fmtBrl(precoEmbalagem)}</span>
                            {i.quantidadePorEmbalagem && i.quantidadePorEmbalagem > 1 && (
                              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                {custoUnitario < 0.01
                                  ? `R$ ${custoUnitario.toFixed(5)}/${sigla}`
                                  : `${fmtBrl(custoUnitario)}/${sigla}`}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Valor Total em Estoque */}
                        <td className="table-cell text-right td-mono td-blue" style={{ fontWeight: 600 }}>
                          {fmtBrl(valorTotal)}
                        </td>

                        {/* Validade & Lote */}
                        <td className="table-cell">
                          {(() => {
                            const val = getValidadeInfo(i.dataValidade);
                            return (
                              <div>
                                <span className={`badge ${val.badgeClass}`} style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {val.status === 'VENCIDO' && <Clock size={11} />}
                                  {val.label}
                                </span>
                                {i.lote && (
                                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                                    Lote: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{i.lote}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Status */}
                        <td className="table-cell">
                          <span
                            className={
                              isZerado
                                ? 'badge badge-red'
                                : isBaixo
                                  ? 'badge badge-yellow'
                                  : 'badge badge-green'
                            }
                          >
                            {isZerado ? 'Zerado' : isBaixo ? 'Baixo' : 'Normal'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="table-cell table-cell-actions text-center">
                          <div className="action-buttons" style={{ justifyContent: 'center', gap: '5px' }}>
                            {/* Extrato / Histórico de Movimentações */}
                            <button
                              type="button"
                              onClick={() => setExtratoInsumo(i)}
                              className="btn btn-action btn-icon"
                              aria-label={`Extrato de movimentações de ${i.nome}`}
                              title="Extrato / Histórico de Movimentações"
                            >
                              <History size={16} />
                            </button>

                            {/* Embalagens de Compra e Fatores de Conversão */}
                            <button
                              type="button"
                              onClick={() => setEmbalagensInsumo(i)}
                              className="btn btn-action btn-icon"
                              aria-label={`Gerenciar embalagens de compra de ${i.nome}`}
                              title="Embalagens de Compra (Conversão)"
                            >
                              <Layers size={16} />
                            </button>

                            {/* Ajuste Rápido de Estoque */}
                            <button
                              type="button"
                              onClick={() => handleOpenAjusteEstoque(i)}
                              className="btn btn-action btn-icon"
                              aria-label={`Ajustar saldo em estoque de ${i.nome}`}
                              title="Ajustar saldo em estoque"
                            >
                              <SlidersHorizontal size={16} />
                            </button>

                            {/* Editar Cadastro Completo */}
                            <button
                              type="button"
                              onClick={() => handleOpenCadastroModal(i)}
                              className="btn btn-action btn-icon"
                              aria-label={`Editar cadastro de ${i.nome}`}
                              title="Editar cadastro"
                            >
                              <Edit2 size={16} />
                            </button>

                            {/* Excluir Insumo */}
                            <button
                              type="button"
                              onClick={() => handleDelete(i.id, i.nome)}
                              className="btn btn-action-danger btn-icon"
                              aria-label={`Excluir ${i.nome}`}
                              title="Excluir insumo"
                            >
                              <Trash2 size={16} />
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
      )}

      {/* Card de Insights Estratégicos com IA (Previsão de Demanda e Risco de Ruptura) - Posição Inferior com Minimização */}
      <div className="card" style={{ marginTop: '24px', marginBottom: '24px', border: '1px solid var(--accent-ring)' }}>
        <div
          onClick={() => setIsAiMinimized(!isAiMinimized)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none',
            paddingBottom: isAiMinimized ? '0' : '16px',
            borderBottom: isAiMinimized ? 'none' : '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '8px', borderRadius: '10px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Copilot Estratégico com IA
                <span className="badge badge-blue" style={{ fontSize: '11px', fontWeight: 600 }}>
                  Gemini 1.5 Flash
                </span>
                {aiData?.totalItensCriticos ? (
                  <span className="badge badge-red" style={{ fontSize: '11px', fontWeight: 600 }}>
                    {aiData.totalItensCriticos} insumo(s) em risco
                  </span>
                ) : null}
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                {isAiMinimized
                  ? 'Clique para expandir a previsão de demanda, dias até ruptura e reposição inteligente'
                  : `Previsão de demanda, dias até ruptura e reposição inteligente • ${aiData?.geradoEm ? `Atualizado em ${aiData.geradoEm}` : 'Em tempo real'}`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => refetchAi()}
              disabled={loadAi}
              title="Recalcular previsões em tempo real"
            >
              <RefreshCw size={14} className={loadAi ? 'animate-spin' : ''} />
              {loadAi ? 'Analisando...' : 'Atualizar Análise'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => gerarOrcamentoMutation.mutate()}
              disabled={gerarOrcamentoMutation.isPending || !aiData?.itensRuptura?.length}
              title="Cria automaticamente um orçamento de compra com fornecedores e quantidades sugeridas"
            >
              <ShoppingBag size={14} />
              {gerarOrcamentoMutation.isPending ? 'Criando Orçamento...' : 'Gerar Orçamento de Reposição (1-Click)'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAiMinimized(!isAiMinimized)}
              title={isAiMinimized ? 'Expandir análise com IA' : 'Minimizar painel'}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px' }}
            >
              {isAiMinimized ? (
                <>
                  <ChevronDown size={16} />
                  <span>Expandir</span>
                </>
              ) : (
                <>
                  <ChevronUp size={16} />
                  <span>Minimizar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Conteúdo Expansível do Copilot IA */}
        {!isAiMinimized && (
          <div style={{ marginTop: '16px' }}>
            {/* Mensagem de sucesso após geração de orçamento */}
            {mensagemSucessoOrcamento && (
              <div style={{ backgroundColor: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)', padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                  <CheckCircle size={18} />
                  {mensagemSucessoOrcamento}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => navigate('/orcamentos')}
                  style={{ fontSize: '12px' }}
                >
                  Ver Orçamentos <ArrowRight size={13} style={{ marginLeft: '4px' }} />
                </button>
              </div>
            )}

            {/* Resumo Executivo em Linguagem Natural */}
            {aiData?.resumoExecutivoIa && (
              <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '18px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text)' }}>
                {aiData.resumoExecutivoIa.split('\n\n').map((paragrafo, idx) => (
                  <p key={idx} style={{ margin: idx === 0 ? 0 : '10px 0 0 0' }}>
                    {paragrafo}
                  </p>
                ))}
              </div>
            )}

            {/* Abas de Navegação dos Insights */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setTabAi('ruptura')}
                style={{
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: tabAi === 'ruptura' ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tabAi === 'ruptura' ? 'var(--accent)' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <AlertTriangle size={15} style={{ color: tabAi === 'ruptura' ? 'var(--red)' : 'inherit' }} />
                Risco de Ruptura de Estoque
                {aiData?.itensRuptura && (
                  <span className={`badge ${aiData.totalItensCriticos > 0 ? 'badge-red' : 'badge-gray'}`} style={{ fontSize: '11px', padding: '1px 6px', fontWeight: 700 }}>
                    {aiData.itensRuptura.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTabAi('margem')}
                style={{
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: tabAi === 'margem' ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tabAi === 'margem' ? 'var(--accent)' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Percent size={15} style={{ color: tabAi === 'margem' ? 'var(--green)' : 'inherit' }} />
                Assistente de Margem & Precificação
                {aiData?.alertasMargem && (
                  <span className={`badge ${aiData.totalProdutosMargemBaixa > 0 ? 'badge-yellow' : 'badge-gray'}`} style={{ fontSize: '11px', padding: '1px 6px', fontWeight: 700 }}>
                    {aiData.alertasMargem.length}
                  </span>
                )}
              </button>
            </div>

            {/* Conteúdo Aba Ruptura */}
            {tabAi === 'ruptura' && (
              <div>
                {loadAi ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>Analisando velocidade de consumo e cobertura de estoque com IA...</div>
                ) : !aiData?.itensRuptura || aiData.itensRuptura.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                    <CheckCircle size={32} style={{ color: '#16a34a', margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>Nenhum insumo em risco iminente de ruptura encontrado!</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Insumo</th>
                          <th className="text-right">Estoque Atual</th>
                          <th className="text-right">Mínimo</th>
                          <th className="text-right">Consumo Diário</th>
                          <th className="text-center">Dias até Ruptura</th>
                          <th className="text-right">Compra Sugerida</th>
                          <th>Fornecedor Sugerido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiData.itensRuptura.map((item) => {
                          const isEsgotado = item.diasAteRuptura === 0;
                          return (
                            <tr key={item.insumoId}>
                              <td>
                                <strong>{item.insumoNome}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.motivoRisco}</div>
                              </td>
                              <td className="text-right td-mono font-medium">
                                {item.estoqueAtual.toLocaleString('pt-BR')} {item.unidadeSigla}
                              </td>
                              <td className="text-right td-mono td-muted">
                                {item.estoqueMinimo.toLocaleString('pt-BR')} {item.unidadeSigla}
                              </td>
                              <td className="text-right td-mono td-muted">
                                {item.consumoMedioDiario > 0 ? `${item.consumoMedioDiario.toFixed(1)} ${item.unidadeSigla}/dia` : '—'}
                              </td>
                              <td className="text-center">
                                {isEsgotado ? (
                                  <span className="badge badge-red font-medium">
                                    Esgotado
                                    <span style={{ display: 'block', fontSize: '9px', opacity: 0.8 }}>Abaixo do Mínimo</span>
                                  </span>
                                ) : (
                                  <span className={`badge ${item.diasAteRuptura <= 7 ? 'badge-yellow' : 'badge-green'}`}>
                                    ~{item.diasAteRuptura} dias
                                  </span>
                                )}
                              </td>
                              <td className="text-right td-mono font-medium td-blue">
                                {item.quantidadeSugeridaCompra.toLocaleString('pt-BR')} {item.unidadeSigla}
                              </td>
                              <td className="td-muted">
                                {item.fornecedorSugeridoNome || 'Nenhum associado'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo Aba Margem */}
            {tabAi === 'margem' && (
              <div>
                {loadAi ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>Calculando impacto de margem...</div>
                ) : !aiData?.alertasMargem || aiData.alertasMargem.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                    <CheckCircle size={32} style={{ color: '#16a34a', margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>Todas as margens de produtos estão saudáveis (acima de 30%)!</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Produto / Tamanho</th>
                          <th className="text-right">Custo Unitário</th>
                          <th className="text-right">Preço Atual</th>
                          <th className="text-center">Margem Atual</th>
                          <th className="text-right">Preço Recomendado IA</th>
                          <th>Diagnóstico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiData.alertasMargem.map((m) => {
                          const isPrejuizo = m.impacto === 'PREJUIZO';
                          return (
                            <tr key={m.variacaoId}>
                              <td>
                                <strong>{m.produtoNome}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{m.nomeTamanho}</div>
                              </td>
                              <td className="text-right td-mono td-muted">
                                {m.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="text-right td-mono font-medium">
                                {m.precoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="text-center">
                                <span className={`badge ${isPrejuizo ? 'badge-red' : 'badge-yellow'}`}>
                                  {m.margemAtual.toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-right td-mono font-medium td-green">
                                {m.precoSugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                <span style={{ display: 'block', fontSize: '10px', color: 'var(--muted)' }}>
                                  Meta: {m.margemAlvo}% margem
                                </span>
                              </td>
                              <td style={{ fontSize: '12px' }}>
                                {m.justificativa}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal CRUD Cadastro Completo de Insumos */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title-insumo">
            <div className="modal-header">
              <h2 id="modal-title-insumo" className="modal-title">
                {editingId ? 'Editar Insumo' : 'Novo Insumo'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <form id="insumoForm" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-group md:col-span-2">
                  <label htmlFor="nome" className="required">Nome do Insumo</label>
                  <input
                    required
                    id="nome"
                    name="nome"
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full"
                    placeholder="Ex: Frasco Pet Cilíndrico 60ml Spray"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="isEmbalagem">Tipo</label>
                  <select
                    id="isEmbalagem"
                    name="isEmbalagem"
                    value={formData.isEmbalagem}
                    onChange={e => setFormData({ ...formData, isEmbalagem: e.target.value })}
                    className="w-full"
                  >
                    <option value="false">Matéria-Prima</option>
                    <option value="true">Embalagem</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="unidadeMedidaId" className="required">Unidade de Medida</label>
                  <select
                    required
                    id="unidadeMedidaId"
                    name="unidadeMedidaId"
                    value={formData.unidadeMedidaId}
                    onChange={e => setFormData({ ...formData, unidadeMedidaId: e.target.value })}
                    className="w-full"
                  >
                    <option value="">Selecione a Unidade...</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.sigla} - {u.nome}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    Utilize a medida base: <strong>ml</strong> para líquidos e <strong>g</strong> para pós/sólidos.
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="quantidadePorEmbalagem">Tamanho / Qtd. da Embalagem</label>
                  <input
                    type="number"
                    step="0.01"
                    id="quantidadePorEmbalagem"
                    name="quantidadePorEmbalagem"
                    value={formData.quantidadePorEmbalagem}
                    onChange={e => setFormData({ ...formData, quantidadePorEmbalagem: e.target.value })}
                    className="w-full"
                    placeholder="Ex: 5000 para 5L, 1000 para 1kg, 1 para frasco"
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    Ex: Bombona de 5L = <strong>5000</strong> (ml); Pacote de 1kg = <strong>1000</strong> (g).
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="estoque">Estoque Atual (Saldo Físico)</label>
                  <input
                    type="number"
                    step="0.01"
                    id="estoque"
                    name="estoque"
                    value={formData.estoque}
                    onChange={e => setFormData({ ...formData, estoque: e.target.value })}
                    className="w-full"
                    placeholder="Ex: 5000"
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    Saldo total na unidade base (ml, g ou unidades).
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="estoqueMinimo">Estoque Mínimo (Ponto de Reposição)</label>
                  <input
                    type="number"
                    step="0.01"
                    id="estoqueMinimo"
                    name="estoqueMinimo"
                    value={formData.estoqueMinimo}
                    onChange={e => setFormData({ ...formData, estoqueMinimo: e.target.value })}
                    className="w-full"
                    placeholder="Ex: 1000 para alertar quando restar 1000 ml"
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    Alerta de estoque baixo quando o saldo físico for menor ou igual a esse valor.
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="fornecedorId">Fornecedor Padrão (opcional)</label>
                  <select
                    id="fornecedorId"
                    name="fornecedorId"
                    value={formData.fornecedorId}
                    onChange={e => setFormData({ ...formData, fornecedorId: e.target.value })}
                    className="w-full"
                  >
                    <option value="">Nenhum / Diversos</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="preco" className="required">Preço Total da Embalagem (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    id="preco"
                    name="preco"
                    value={formData.preco}
                    onChange={e => setFormData({ ...formData, preco: e.target.value })}
                    className="w-full"
                    placeholder="Ex: 61.27"
                  />
                  {formData.preco && formData.quantidadePorEmbalagem && parseFloat(formData.quantidadePorEmbalagem) > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                      Custo Unitário Base: R$ {(parseFloat(formData.preco) / parseFloat(formData.quantidadePorEmbalagem)).toFixed(5)} por {getUnidadeSigla(parseInt(formData.unidadeMedidaId)) || 'un'}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="codigoBarras">Código de Barras (EAN / Barcode)</label>
                  <input
                    type="text"
                    id="codigoBarras"
                    name="codigoBarras"
                    value={formData.codigoBarras}
                    onChange={e => setFormData({ ...formData, codigoBarras: e.target.value })}
                    className="w-full"
                    placeholder="Ex: 7891234567890"
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    Código de barras do fabricante para leitura por leitor óptico.
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="lote">Lote de Fabricação / Fornecedor</label>
                  <input
                    type="text"
                    id="lote"
                    name="lote"
                    value={formData.lote}
                    onChange={e => setFormData({ ...formData, lote: e.target.value })}
                    className="w-full"
                    placeholder="Ex: LOT-2026-X1"
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    Rastreabilidade em caso de recolhimento ou auditoria.
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="dataValidade">Data de Validade</label>
                  <input
                    type="date"
                    id="dataValidade"
                    name="dataValidade"
                    value={formData.dataValidade}
                    onChange={e => setFormData({ ...formData, dataValidade: e.target.value })}
                    className="w-full"
                  />
                  <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    O sistema alertará com antecedência quando estiver a 30 dias do vencimento.
                  </small>
                </div>
              </form>
            </div>
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
                form="insumoForm"
                className="btn btn-primary"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar Insumo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajuste Rápido de Saldo em Estoque */}
      {editingEstoqueItem && (
        <div className="modal-overlay" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && setEditingEstoqueItem(null)}>
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Ajustar Saldo em Estoque</h2>
              <button
                onClick={() => setEditingEstoqueItem(null)}
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveAjusteEstoque}>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                  Ajustando saldo de: <strong>{editingEstoqueItem.nome}</strong> ({editingEstoqueItem.unidadeSigla || getUnidadeSigla(editingEstoqueItem.unidadeMedidaId)})
                </p>
                <div className="form-group">
                  <label htmlFor="modal-novo-estoque" className="required">Quantidade Física Atual</label>
                  <input
                    id="modal-novo-estoque"
                    type="number"
                    step="0.01"
                    required
                    value={novoEstoque}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNovoEstoque(e.target.value)}
                    className="w-full"
                    autoFocus
                  />
                  {editingEstoqueItem.quantidadePorEmbalagem && (
                    <small style={{ color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
                      Tamanho / Qtd por embalagem cadastrada: {editingEstoqueItem.quantidadePorEmbalagem} {editingEstoqueItem.unidadeSigla || getUnidadeSigla(editingEstoqueItem.unidadeMedidaId)}
                    </small>
                  )}
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label htmlFor="modal-motivo-ajuste">Motivo do Ajuste (Auditoria)</label>
                  <input
                    id="modal-motivo-ajuste"
                    type="text"
                    value={motivoAjuste}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMotivoAjuste(e.target.value)}
                    className="w-full"
                    placeholder="Ex: Contagem física de balanço, correção..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditingEstoqueItem(null)}
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

      {/* Modal Extrato / Ledger de Movimentações */}
      {extratoInsumo && (
        <div className="modal-overlay" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && setExtratoInsumo(null)}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} style={{ color: 'var(--accent)' }} />
                  Extrato de Movimentações: {extratoInsumo.nome}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Saldo atual: <strong>{extratoInsumo.estoque ?? 0} {extratoInsumo.unidadeSigla || getUnidadeSigla(extratoInsumo.unidadeMedidaId)}</strong>
                  {extratoInsumo.estoqueMinimo !== undefined && (
                    <span> • Estoque Mínimo: {extratoInsumo.estoqueMinimo} {extratoInsumo.unidadeSigla || getUnidadeSigla(extratoInsumo.unidadeMedidaId)}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setExtratoInsumo(null)}
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {loadMovimentos ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                  Carregando histórico de movimentações...
                </div>
              ) : movimentos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                  <History size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                  <p style={{ fontWeight: 500, margin: 0 }}>Nenhuma movimentação registrada ainda para este insumo.</p>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>As movimentações de produção, compras e ajustes aparecerão aqui em tempo real.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th className="table-cell" style={{ width: '130px' }}>Data/Hora</th>
                        <th className="table-cell" style={{ width: '130px' }}>Tipo</th>
                        <th className="table-cell text-right" style={{ width: '110px' }}>Qtd</th>
                        <th className="table-cell text-right" style={{ width: '160px' }}>Saldo Ant. → Novo</th>
                        <th className="table-cell">Origem / Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimentos.map((m) => {
                        const sigla = extratoInsumo.unidadeSigla || getUnidadeSigla(extratoInsumo.unidadeMedidaId);
                        const isEntrada = m.tipo === 'ENTRADA_COMPRA' || (m.tipo === 'AJUSTE_INVENTARIO' && m.saldoPosterior > m.saldoAnterior);
                        return (
                          <tr key={m.id}>
                            <td className="table-cell td-muted" style={{ whiteSpace: 'nowrap' }}>
                              {formatarDataHora(m.criadoEm)}
                            </td>
                            <td className="table-cell">
                              {getTipoBadge(m.tipo)}
                            </td>
                            <td className="table-cell text-right td-mono font-medium" style={{ color: isEntrada ? '#16a34a' : '#dc2626' }}>
                              {isEntrada ? '+' : '-'}{m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {sigla}
                            </td>
                            <td className="table-cell text-right td-mono td-muted">
                              {m.saldoAnterior.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} → <strong>{m.saldoPosterior.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong>
                            </td>
                            <td className="table-cell">
                              <div>{m.motivo || '—'}</div>
                              {m.origemReferencia && (
                                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                  Ref: {m.origemReferencia} {m.referenciaId ? `#${m.referenciaId}` : ''}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setExtratoInsumo(null)}
                className="btn btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Embalagens de Compra / Fatores de Conversão */}
      {embalagensInsumo && (
        <div className="modal-overlay" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && setEmbalagensInsumo(null)}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={20} style={{ color: 'var(--accent)' }} />
                  Embalagens de Compra: {embalagensInsumo.nome}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Unidade Base no Estoque: <strong>{embalagensInsumo.unidadeSigla || getUnidadeSigla(embalagensInsumo.unidadeMedidaId)}</strong>
                </p>
              </div>
              <button
                onClick={() => setEmbalagensInsumo(null)}
                className="modal-close"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {/* Formulário para adicionar nova embalagem */}
              <div style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Cadastrar Nova Embalagem de Compra</h4>
                <div className="form-row" style={{ marginBottom: '10px' }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label style={{ fontSize: '12px' }}>Nome da Embalagem</label>
                    <input
                      type="text"
                      placeholder="Ex: Galão 5L, Saco 25kg, Fardo 12un"
                      value={novaEmbalagemNome}
                      onChange={(e) => setNovaEmbalagemNome(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '12px' }}>Fator de Conversão ({embalagensInsumo.unidadeSigla || getUnidadeSigla(embalagensInsumo.unidadeMedidaId)})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 5000"
                      value={novoFatorConversao}
                      onChange={(e) => setNovoFatorConversao(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '12px' }}>Preço Padrão da Embalagem (opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 75.00"
                      value={novoPrecoEmbalagem}
                      onChange={(e) => setNovoPrecoEmbalagem(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      disabled={!novaEmbalagemNome.trim() || !novoFatorConversao || parseFloat(novoFatorConversao) <= 0 || addUnidadeCompraMutation.isPending}
                      onClick={() => {
                        addUnidadeCompraMutation.mutate({
                          insumoId: embalagensInsumo.id,
                          nomeEmbalagem: novaEmbalagemNome.trim(),
                          fatorConversao: parseFloat(novoFatorConversao),
                          precoEmbalagem: novoPrecoEmbalagem ? parseFloat(novoPrecoEmbalagem) : undefined
                        });
                      }}
                    >
                      {addUnidadeCompraMutation.isPending ? 'Salvando...' : 'Adicionar'}
                    </button>
                  </div>
                </div>
                <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>
                  💡 Exemplo: Se você compra em Galão de 5 Litros e sua base é <strong>ml</strong>, o fator é <strong>5000</strong>. Ao comprar 2 galões, o estoque creditará automaticamente 10.000 ml.
                </small>
              </div>

              {/* Lista de Embalagens Cadastradas */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Embalagens Cadastradas</h4>
                {loadUnidadesCompra ? (
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Carregando embalagens...</p>
                ) : unidadesCompra.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '13px', fontStyle: 'italic' }}>
                    Nenhuma embalagem alternativa cadastrada. O insumo utiliza o tamanho padrão de {embalagensInsumo.quantidadePorEmbalagem || 1} {embalagensInsumo.unidadeSigla || getUnidadeSigla(embalagensInsumo.unidadeMedidaId)}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th className="table-cell">Embalagem</th>
                          <th className="table-cell text-right">Fator de Conversão</th>
                          <th className="table-cell text-right">Preço</th>
                          <th className="table-cell text-center" style={{ width: '60px' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unidadesCompra.map((u) => {
                          const sigla = embalagensInsumo.unidadeSigla || getUnidadeSigla(embalagensInsumo.unidadeMedidaId);
                          return (
                            <tr key={u.id}>
                              <td className="table-cell font-medium">{u.nomeEmbalagem}</td>
                              <td className="table-cell text-right td-mono">
                                1 un = <strong>{u.fatorConversao.toLocaleString('pt-BR')} {sigla}</strong>
                              </td>
                              <td className="table-cell text-right td-mono">
                                {u.precoEmbalagem ? fmtBrl(u.precoEmbalagem) : '—'}
                              </td>
                              <td className="table-cell text-center">
                                <button
                                  type="button"
                                  onClick={() => deleteUnidadeCompraMutation.mutate(u.id)}
                                  className="btn btn-action-danger btn-icon"
                                  title="Remover embalagem"
                                  disabled={deleteUnidadeCompraMutation.isPending}
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
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setEmbalagensInsumo(null)}
                className="btn btn-secondary"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsumosPage;
