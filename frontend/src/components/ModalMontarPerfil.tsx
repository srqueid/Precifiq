import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  LayoutDashboard,
  FileText,
  ShoppingBag,
  PackagePlus,
  Warehouse,
  Package,
  Truck,
  ShoppingCart,
  Users,
  ClipboardList,
  Ruler,
  Settings,
  Factory,
  Briefcase,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  CATALOGO_FUNCIONALIDADES,
  CATEGORIAS_LISTA,
  FuncionalidadeItem,
  FuncionalidadeKey,
  PRESETS_PERFIS,
  CategoriaFuncionalidade
} from '../types/permissoes';

interface PerfilData {
  id?: number;
  codigo: string;
  nome: string;
  descricao?: string;
  permissoes?: string;
}

interface ModalMontarPerfilProps {
  isOpen: boolean;
  onClose: () => void;
  perfilParaEditar?: PerfilData | null;
  onSalvarSucesso: () => void;
}

// Mapeamento de ícones do catálogo
const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  LayoutDashboard,
  FileText,
  ShoppingBag,
  PackagePlus,
  Warehouse,
  Package,
  Truck,
  ShoppingCart,
  Users,
  ClipboardList,
  Ruler,
  Settings,
  Sparkles,
  ShieldCheck,
  Factory,
  Briefcase
};

export const ModalMontarPerfil: React.FC<ModalMontarPerfilProps> = ({
  isOpen,
  onClose,
  perfilParaEditar,
  onSalvarSucesso
}) => {
  const isEditing = Boolean(perfilParaEditar?.id);

  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<Set<FuncionalidadeKey>>(new Set());
  const [busca, setBusca] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  // Inicializa os dados quando o modal abre ou perfilParaEditar muda
  useEffect(() => {
    if (!isOpen) return;

    setFeedback(null);
    setBusca('');

    if (perfilParaEditar) {
      setNome(perfilParaEditar.nome || '');
      setCodigo(perfilParaEditar.codigo || '');
      setDescricao(perfilParaEditar.descricao || '');

      const permsRaw = perfilParaEditar.permissoes || '';
      const upper = permsRaw.toUpperCase();

      if (upper.includes('GLOBAL_ALL') || upper.includes('MATRIZ_ALL') || upper.includes('*') || upper.includes('ALL')) {
        setPermissoesSelecionadas(new Set(CATALOGO_FUNCIONALIDADES.map(f => f.key)));
      } else {
        const permsList = permsRaw
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean) as FuncionalidadeKey[];

        setPermissoesSelecionadas(new Set(permsList));
      }
    } else {
      setNome('');
      setCodigo('');
      setDescricao('');
      // Para novo perfil, inicializa com preset Operacional padrão por conveniência
      setPermissoesSelecionadas(new Set(PRESETS_PERFIS.OPERACIONAL.funcionalidades));
    }
  }, [isOpen, perfilParaEditar]);

  // Atualiza código automaticamente ao digitar o nome (se estiver criando)
  const handleNomeChange = (val: string) => {
    setNome(val);
    if (!isEditing) {
      const slug = val
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      setCodigo(slug);
    }
  };

  // Alterna uma funcionalidade específica
  const handleToggleFuncionalidade = (key: FuncionalidadeKey) => {
    setPermissoesSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Aplica um preset completo
  const handleAplicarPreset = (presetKey: string) => {
    const preset = PRESETS_PERFIS[presetKey];
    if (preset) {
      setPermissoesSelecionadas(new Set(preset.funcionalidades));
    }
  };

  // Limpa todas as permissões
  const handleLimparTodas = () => {
    setPermissoesSelecionadas(new Set());
  };

  // Alterna todas as funcionalidades de uma categoria específica
  const handleToggleCategoria = (cat: CategoriaFuncionalidade) => {
    const itensCat = CATALOGO_FUNCIONALIDADES.filter(f => f.categoria === cat);
    const todasMarcadas = itensCat.every(f => permissoesSelecionadas.has(f.key));

    setPermissoesSelecionadas(prev => {
      const next = new Set(prev);
      if (todasMarcadas) {
        itensCat.forEach(f => next.delete(f.key));
      } else {
        itensCat.forEach(f => next.add(f.key));
      }
      return next;
    });
  };

  // Filtra itens com base na busca
  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return CATALOGO_FUNCIONALIDADES;
    const term = busca.toLowerCase();
    return CATALOGO_FUNCIONALIDADES.filter(
      f =>
        f.nome.toLowerCase().includes(term) ||
        f.descricao.toLowerCase().includes(term) ||
        f.categoria.toLowerCase().includes(term) ||
        f.key.toLowerCase().includes(term)
    );
  }, [busca]);

  const totalSelecionadas = permissoesSelecionadas.size;
  const totalGeral = CATALOGO_FUNCIONALIDADES.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      setFeedback({ tipo: 'erro', msg: 'Informe o nome do perfil de acesso.' });
      return;
    }

    const codFinal = (codigo || nome)
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '_');

    if (!codFinal) {
      setFeedback({ tipo: 'erro', msg: 'Código do perfil inválido.' });
      return;
    }

    if (permissoesSelecionadas.size === 0) {
      setFeedback({ tipo: 'erro', msg: 'Selecione ao menos 1 funcionalidade para o perfil.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const permissoesStr = Array.from(permissoesSelecionadas).join(',');

    try {
      if (isEditing && perfilParaEditar?.id) {
        const res = await fetch(`/api/global/perfis/${perfilParaEditar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: nome.trim(),
            descricao: descricao.trim(),
            permissoes: permissoesStr
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro ao atualizar o perfil.');
        }
      } else {
        const res = await fetch('/api/global/perfis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: codFinal,
            nome: nome.trim(),
            descricao: descricao.trim(),
            permissoes: permissoesStr
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro ao criar o perfil.');
        }
      }

      onSalvarSucesso();
      onClose();
    } catch (err: any) {
      setFeedback({ tipo: 'erro', msg: err.message || 'Falha ao salvar o perfil de acesso.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200"
        style={{ color: '#0f172a' }}
      >
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#1e293b] via-[#24334a] to-[#1e293b] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight m-0 text-white">
                {isEditing ? `Montar / Editar Perfil: ${perfilParaEditar?.nome}` : 'Montar Novo Perfil de Acesso (RBAC)'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 m-0">
                Selecione as funcionalidades do Precifiq autorizadas para este perfil
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto flex-1 space-y-5">
            {/* Bloco 1: Dados Básicos do Perfil */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="sm:col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Perfil <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Comprador Técnico"
                  value={nome}
                  onChange={e => handleNomeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Código Identificador <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  placeholder="Ex: COMPRADOR"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold outline-none ${
                    isEditing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Gestão de compras e estoque"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Bloco 2: Barra de Ações Rápidas & Presets */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Matriz de Funcionalidades do Sistema
                  </span>
                  <div className="text-[11px] text-slate-500">
                    Clique nas caixas ou use presets para marcar em lote
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden sm:inline">Presets:</span>

                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('TOTAL')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                    title="Marcar todas as 13 funcionalidades"
                  >
                    <ShieldCheck size={13} />
                    <span>Acesso Total</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('OPERACIONAL')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                    title="Operação e Produção (Produtos, Insumos, Estoque)"
                  >
                    <Factory size={13} />
                    <span>Operação</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('COMPRAS')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                    title="Compras, NF-e, Pedidos e Fornecedores"
                  >
                    <ShoppingCart size={13} />
                    <span>Compras</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAplicarPreset('COMERCIAL')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-1"
                    title="Vendas, Pedidos de Clientes e Orçamentos"
                  >
                    <Briefcase size={13} />
                    <span>Comercial</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLimparTodas}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    title="Desmarcar todas"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Campo de Busca Rápida */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Filtrar funcionalidades por nome, descrição ou rota..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Bloco 3: Grid de Categorias e Funcionalidades */}
            <div className="space-y-4">
              {CATEGORIAS_LISTA.map(categoria => {
                const itensCat = itensFiltrados.filter(f => f.categoria === categoria);
                if (itensCat.length === 0) return null;

                const totalNaCat = CATALOGO_FUNCIONALIDADES.filter(f => f.categoria === categoria).length;
                const marcadasNaCat = CATALOGO_FUNCIONALIDADES.filter(
                  f => f.categoria === categoria && permissoesSelecionadas.has(f.key)
                ).length;
                const todasMarcadas = marcadasNaCat === totalNaCat;

                return (
                  <div key={categoria} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    {/* Topo da Categoria */}
                    <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{categoria}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            marcadasNaCat > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {marcadasNaCat} de {totalNaCat}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleCategoria(categoria)}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 transition-colors flex items-center gap-1"
                      >
                        {todasMarcadas ? 'Desmarcar Grupo' : 'Marcar Todos'}
                      </button>
                    </div>

                    {/* Cards de Funcionalidade */}
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {itensCat.map(func => {
                        const isChecked = permissoesSelecionadas.has(func.key);
                        const IconComponent = ICON_MAP[func.icone] || LayoutDashboard;

                        return (
                          <div
                            key={func.key}
                            onClick={() => handleToggleFuncionalidade(func.key)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                              isChecked
                                ? 'bg-blue-50/50 border-blue-300 shadow-sm ring-1 ring-blue-400/30'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  isChecked
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <IconComponent size={16} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span
                                    className={`text-xs font-bold leading-tight truncate ${
                                      isChecked ? 'text-blue-950' : 'text-slate-800'
                                    }`}
                                  >
                                    {func.nome}
                                  </span>
                                  {isChecked ? (
                                    <CheckSquare size={16} className="text-blue-600 shrink-0" />
                                  ) : (
                                    <Square size={16} className="text-slate-400 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug m-0 line-clamp-2">
                                  {func.descricao}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                              <span className="font-mono text-slate-400">{func.key}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                {func.rota}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.tipo === 'sucesso'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-red-50 text-red-900 border border-red-200'
                }`}
              >
                {feedback.tipo === 'sucesso' ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : (
                  <AlertCircle size={16} className="shrink-0" />
                )}
                <span>{feedback.msg}</span>
              </div>
            )}
          </div>

          {/* Rodapé com Contador e Botões */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Total Selecionado:</span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  totalSelecionadas > 0
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {totalSelecionadas} de {totalGeral} funcionalidades
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>{isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Perfil'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalMontarPerfil;
