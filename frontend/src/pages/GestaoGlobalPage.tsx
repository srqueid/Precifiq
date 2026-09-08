import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  Plus, 
  GitFork, 
  CheckCircle2, 
  ExternalLink, 
  Database, 
  Layers, 
  KeyRound, 
  Briefcase, 
  Search,
  X,
  Loader2,
  RefreshCw,
  UserPlus,
  Link2,
  AlertCircle
} from 'lucide-react';
import { useTenant, EmpresaHierarquia, EmpresaItem } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';

interface Perfil {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  permissoes: string;
}

interface UsuarioEmpresaVinculo {
  id: number;
  empresaId: number;
  empresaNome: string;
  empresaTipo: string;
  schemaName: string;
  perfilId: number;
  perfilCodigo: string;
  perfilNome: string;
}

interface UsuarioGlobal {
  id: number;
  nome: string;
  email: string;
  isSuperuser: boolean;
  ativo: boolean;
  criadoEm?: string;
  empresas?: UsuarioEmpresaVinculo[];
}

export const GestaoGlobalPage: React.FC = () => {
  const { activeCompany, empresasHierarquia, selectCompany, refreshEmpresas, isLoadingEmpresas } = useTenant();
  const { isSuperuser } = useAuth();

  const [activeTab, setActiveTab] = useState<'empresas' | 'usuarios' | 'perfis'>('empresas');

  // Estados de dados
  const [usuarios, setUsuarios] = useState<UsuarioGlobal[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(false);
  const [isLoadingPerfis, setIsLoadingPerfis] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  // Modais de Empresa
  const [isModalNovaMatrizOpen, setIsModalNovaMatrizOpen] = useState(false);
  const [isModalNovaFilialOpen, setIsModalNovaFilialOpen] = useState(false);
  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);

  // Modais de Usuário
  const [isModalNovoUsuarioOpen, setIsModalNovoUsuarioOpen] = useState(false);
  const [isModalVincularOpen, setIsModalVincularOpen] = useState(false);
  const [isSavingUsuario, setIsSavingUsuario] = useState(false);

  // Forms
  const [formMatriz, setFormMatriz] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    schemaName: ''
  });

  const [formFilial, setFormFilial] = useState({
    matrizId: 1,
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    schemaName: ''
  });

  const [formUsuario, setFormUsuario] = useState({
    nome: '',
    email: '',
    senha: '',
    isSuperuser: false,
    empresaId: 1,
    perfilId: 4
  });

  const [formVinculo, setFormVinculo] = useState({
    usuarioId: 0,
    empresaId: 1,
    perfilId: 4
  });

  const [msgFeedback, setMsgFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const showFeedback = (tipo: 'success' | 'error', texto: string) => {
    setMsgFeedback({ tipo, texto });
    setTimeout(() => setMsgFeedback(null), 5000);
  };

  // Carregar usuários
  const carregarUsuarios = async () => {
    setIsLoadingUsuarios(true);
    try {
      const res = await fetch('/api/global/usuarios');
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      }
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    } finally {
      setIsLoadingUsuarios(false);
    }
  };

  // Carregar perfis
  const carregarPerfis = async () => {
    setIsLoadingPerfis(true);
    try {
      const res = await fetch('/api/global/perfis');
      if (res.ok) {
        const data = await res.json();
        setPerfis(data);
      }
    } catch (e) {
      console.error('Erro ao carregar perfis:', e);
    } finally {
      setIsLoadingPerfis(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
    carregarPerfis();
  }, []);

  // Handler para criar Matriz
  const handleCriarMatriz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatriz.nomeFantasia.trim()) {
      showFeedback('error', 'Nome Fantasia é obrigatório');
      return;
    }

    setIsSavingEmpresa(true);
    try {
      const res = await fetch('/api/global/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formMatriz,
          tipo: 'MATRIZ',
          matrizId: null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao cadastrar Matriz' }));
        throw new Error(err.error || 'Erro ao cadastrar Matriz');
      }

      showFeedback('success', 'Matriz cadastrada e banco isolado provisionado com sucesso!');
      setIsModalNovaMatrizOpen(false);
      setFormMatriz({ nomeFantasia: '', razaoSocial: '', cnpj: '', schemaName: '' });
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro inesperado ao criar matriz');
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  // Handler para criar Filial
  const handleCriarFilial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFilial.nomeFantasia.trim()) {
      showFeedback('error', 'Nome Fantasia da Filial é obrigatório');
      return;
    }

    setIsSavingEmpresa(true);
    try {
      const res = await fetch('/api/global/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formFilial,
          tipo: 'FILIAL',
          matrizId: Number(formFilial.matrizId)
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao cadastrar Filial' }));
        throw new Error(err.error || 'Erro ao cadastrar Filial');
      }

      showFeedback('success', 'Filial cadastrada e base isolada provisionada com sucesso!');
      setIsModalNovaFilialOpen(false);
      setFormFilial({ matrizId: empresasHierarquia[0]?.id || 1, nomeFantasia: '', razaoSocial: '', cnpj: '', schemaName: '' });
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro inesperado ao criar filial');
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  // Handler para criar Usuário
  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsuario.nome.trim() || !formUsuario.email.trim() || !formUsuario.senha.trim()) {
      showFeedback('error', 'Nome, e-mail e senha são obrigatórios');
      return;
    }

    setIsSavingUsuario(true);
    try {
      const res = await fetch('/api/global/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formUsuario)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao cadastrar usuário' }));
        throw new Error(err.error || 'Erro ao cadastrar usuário');
      }

      showFeedback('success', 'Usuário global cadastrado com sucesso!');
      setIsModalNovoUsuarioOpen(false);
      setFormUsuario({ nome: '', email: '', senha: '', isSuperuser: false, empresaId: 1, perfilId: 4 });
      await carregarUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao criar usuário');
    } finally {
      setIsSavingUsuario(false);
    }
  };

  // Handler para vincular Usuário à Empresa/Filial
  const handleVincularUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVinculo.usuarioId) {
      showFeedback('error', 'Selecione um usuário');
      return;
    }

    setIsSavingUsuario(true);
    try {
      const res = await fetch('/api/global/usuarios/atribuir-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: Number(formVinculo.usuarioId),
          empresaId: Number(formVinculo.empresaId),
          perfilId: Number(formVinculo.perfilId)
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao vincular empresa' }));
        throw new Error(err.error || 'Erro ao vincular empresa');
      }

      showFeedback('success', 'Acesso da empresa concedido com sucesso ao usuário!');
      setIsModalVincularOpen(false);
      await carregarUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao vincular empresa');
    } finally {
      setIsSavingUsuario(false);
    }
  };

  // Handler para desvincular
  const handleDesvincular = async (usuarioId: number, empresaId: number, empresaNome: string) => {
    if (!window.confirm(`Deseja realmente remover o acesso deste usuário à empresa "${empresaNome}"?`)) return;

    try {
      const res = await fetch('/api/global/usuarios/desvincular-empresa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, empresaId })
      });

      if (res.ok) {
        showFeedback('success', 'Vínculo removido com sucesso');
        carregarUsuarios();
      }
    } catch (err) {
      console.error('Erro ao desvincular:', err);
    }
  };

  // Totalizadores
  const totalMatrizes = empresasHierarquia.length;
  const totalFiliais = empresasHierarquia.reduce((acc, m) => acc + (m.filiais?.length || 0), 0);
  const totalUsuarios = usuarios.length;

  const todasEmpresasLista: EmpresaItem[] = [];
  empresasHierarquia.forEach(m => {
    todasEmpresasLista.push({
      id: m.id,
      tipo: m.tipo,
      nomeFantasia: m.nomeFantasia,
      razaoSocial: m.razaoSocial,
      cnpj: m.cnpj,
      schemaName: m.schemaName,
      ativo: m.ativo
    });
    m.filiais?.forEach(f => todasEmpresasLista.push(f));
  });

  const usuariosFiltrados = usuarios.filter(u => 
    u.nome.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Building2 size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 m-0">Gestão Global & Governança Corporativa</h1>
              <p className="text-sm text-gray-500 m-0">
                Arquitetura Multiempresas com base isolada por filial/matriz, hierarquia e catálogo unificado de acessos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { refreshEmpresas(); carregarUsuarios(); carregarPerfis(); }}
            className="px-3 py-2 border rounded-md text-sm font-medium flex items-center gap-1.5 hover:bg-gray-100 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw size={16} className={isLoadingEmpresas || isLoadingUsuarios ? 'animate-spin' : ''} />
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {msgFeedback && (
        <div 
          className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${
            msgFeedback.tipo === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {msgFeedback.tipo === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{msgFeedback.texto}</span>
        </div>
      )}

      {/* Cards de Métricas e Status Corporativo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <Building2 size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Matrizes</div>
            <div className="text-2xl font-bold text-gray-900">{totalMatrizes}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-50 text-green-600">
            <GitFork size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Filiais Ativas</div>
            <div className="text-2xl font-bold text-gray-900">{totalFiliais}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-50 text-yellow-600">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Usuários Centrais</div>
            <div className="text-2xl font-bold text-gray-900">{totalUsuarios}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-50 text-indigo-600">
            <Database size={24} />
          </div>
          <div className="overflow-hidden">
            <div className="text-xs text-gray-500 font-medium">Base Ativa no Navegador</div>
            <div className="text-sm font-bold text-gray-900 truncate" title={activeCompany?.nomeFantasia}>
              {activeCompany?.nomeFantasia || 'Carregando...'}
            </div>
            <span className="text-xs text-blue-600 font-mono">
              schema: {activeCompany?.schemaName}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Navegação de Abas */}
      <div className="flex border-b border-gray-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('empresas')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'empresas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 size={18} />
          <span>Estrutura Corporativa (Matriz & Filiais)</span>
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'usuarios'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={18} />
          <span>Usuários & Acessos Globais</span>
        </button>

        <button
          onClick={() => setActiveTab('perfis')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'perfis'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck size={18} />
          <span>Perfis de Acesso (RBAC)</span>
        </button>
      </div>

      {/* ABA 1: ESTRUTURA CORPORATIVA (MATRIZ & FILIAIS) */}
      {activeTab === 'empresas' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 m-0">Árvore de Empresas e Bases de Dados</h2>
              <p className="text-xs text-gray-500 m-0">Cada empresa/filial possui isolamento total com schema próprio no PostgreSQL.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsModalNovaMatrizOpen(true)}
                className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus size={16} />
                <span>Nova Matriz</span>
              </button>
              <button
                onClick={() => setIsModalNovaFilialOpen(true)}
                disabled={empresasHierarquia.length === 0}
                className="px-3.5 py-2 border border-green-600 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <GitFork size={16} />
                <span>Nova Filial</span>
              </button>
            </div>
          </div>

          {isLoadingEmpresas ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <span>Carregando árvore de empresas...</span>
            </div>
          ) : empresasHierarquia.length === 0 ? (
            <div className="p-8 border border-dashed rounded-xl text-center text-gray-500">
              Nenhuma empresa cadastrada. Cadastre a primeira Matriz para começar.
            </div>
          ) : (
            <div className="space-y-6">
              {empresasHierarquia.map((matriz) => {
                const isMatrizAtiva = activeCompany?.id === matriz.id && activeCompany.tipo === 'MATRIZ';

                return (
                  <div key={matriz.id} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    {/* Cabeçalho da Matriz */}
                    <div className="p-5 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-gray-900 m-0">{matriz.nomeFantasia}</h3>
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 uppercase">
                              Matriz
                            </span>
                            {isMatrizAtiva && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Empresa Ativa
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            {matriz.razaoSocial && <span>Razão: {matriz.razaoSocial}</span>}
                            {matriz.cnpj && <span>CNPJ: {matriz.cnpj}</span>}
                            <span className="font-mono text-gray-600">Base/Schema: <strong>{matriz.schemaName}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isMatrizAtiva && (
                          <button
                            onClick={() => selectCompany({
                              id: matriz.id,
                              tipo: matriz.tipo,
                              nomeFantasia: matriz.nomeFantasia,
                              razaoSocial: matriz.razaoSocial,
                              cnpj: matriz.cnpj,
                              schemaName: matriz.schemaName,
                              ativo: matriz.ativo
                            })}
                            className="px-3 py-1.5 text-xs font-semibold bg-white border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 flex items-center gap-1.5 transition-colors"
                          >
                            <ExternalLink size={14} />
                            <span>Entrar na Matriz</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setFormFilial(prev => ({ ...prev, matrizId: matriz.id }));
                            setIsModalNovaFilialOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-white border text-gray-700 rounded-md hover:bg-gray-100 flex items-center gap-1 transition-colors"
                        >
                          <Plus size={14} />
                          <span>Adicionar Filial</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de Filiais Aninhadas */}
                    <div className="p-5">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <GitFork size={14} />
                        <span>Filiais Vinculadas ({matriz.filiais?.length || 0})</span>
                      </div>

                      {(!matriz.filiais || matriz.filiais.length === 0) ? (
                        <div className="p-4 bg-gray-50 border border-dashed rounded-lg text-center text-xs text-gray-500">
                          Nenhuma filial vinculada a esta Matriz. Clique em "Adicionar Filial" para provisionar a primeira filial com banco próprio.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {matriz.filiais.map((filial) => {
                            const isFilialAtiva = activeCompany?.id === filial.id && activeCompany.tipo === 'FILIAL';

                            return (
                              <div
                                key={filial.id}
                                className={`p-4 rounded-lg border transition-all ${
                                  isFilialAtiva 
                                    ? 'bg-green-50/50 border-green-300 ring-1 ring-green-300' 
                                    : 'bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm text-gray-900">{filial.nomeFantasia}</span>
                                      <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-800 font-medium">
                                        Filial
                                      </span>
                                      {isFilialAtiva && (
                                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                                          <CheckCircle2 size={12} />
                                          Ativa
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {filial.cnpj && <div>CNPJ: {filial.cnpj}</div>}
                                      <div className="font-mono text-gray-600 mt-0.5">
                                        Schema isolado: <strong>{filial.schemaName}</strong>
                                      </div>
                                    </div>
                                  </div>

                                  {!isFilialAtiva && (
                                    <button
                                      onClick={() => selectCompany(filial)}
                                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-green-600 text-green-700 rounded hover:bg-green-50 flex items-center gap-1 transition-colors"
                                      title="Alternar todo o sistema para operar nesta filial"
                                    >
                                      <ExternalLink size={12} />
                                      <span>Acessar</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: USUÁRIOS & ACESSOS GLOBAIS */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 m-0">Controle Centralizado de Usuários e Permissões</h2>
              <p className="text-xs text-gray-500 m-0">Cada usuário pode ter acessos específicos a uma ou múltiplas filiais com diferentes perfis.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={searchUser}
                  onChange={e => setSearchUser(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setIsModalNovoUsuarioOpen(true)}
                className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
              >
                <UserPlus size={16} />
                <span>Novo Usuário</span>
              </button>
            </div>
          </div>

          <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="p-4 font-semibold">Colaborador / E-mail</th>
                  <th className="p-4 font-semibold">Tipo Global</th>
                  <th className="p-4 font-semibold">Empresas & Perfis Liberados</th>
                  <th className="p-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoadingUsuarios ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      <Loader2 size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
                      Carregando colaboradores...
                    </td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{u.nome}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="p-4">
                        {u.isSuperuser ? (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 inline-flex items-center gap-1" title="Perfil técnico exclusivo da equipe DcSys">
                            <span>🛡️</span>
                            <span>Superusuário (DcSys)</span>
                          </span>
                        ) : u.empresas?.some(v => v.perfilCodigo === 'ADMIN') ? (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 inline-flex items-center gap-1" title="Administrador Global da Empresa">
                            <span>🏢</span>
                            <span>Administrador Global</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                            Colaborador
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {u.isSuperuser ? (
                          <span className="text-xs text-purple-700 font-medium italic">
                            Equipe Técnica DcSys (Acesso irrestrito a schemas, infraestrutura e governança central)
                          </span>
                        ) : (!u.empresas || u.empresas.length === 0) ? (
                          <span className="text-xs text-red-500 font-medium">Nenhum acesso liberado</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {u.empresas.map((v) => (
                              <span
                                key={v.id}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border ${
                                  v.perfilCodigo === 'ADMIN' ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold' : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                <strong>{v.empresaNome}</strong>
                                <span className="text-gray-400">|</span>
                                <span className={v.perfilCodigo === 'ADMIN' ? 'text-indigo-700' : 'text-blue-600 font-medium'}>
                                  {v.perfilNome || v.perfilCodigo}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDesvincular(u.id, v.empresaId, v.empresaNome)}
                                  className="text-gray-400 hover:text-red-600 ml-1"
                                  title="Remover acesso a esta empresa"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setFormVinculo({
                              usuarioId: u.id,
                              empresaId: empresasHierarquia[0]?.id || 1,
                              perfilId: 4
                            });
                            setIsModalVincularOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-medium border rounded text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
                        >
                          <Link2 size={12} />
                          <span>Atribuir Filial</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: PERFIS DE ACESSO (RBAC) */}
      {activeTab === 'perfis' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 m-0">Matriz de Perfis e Permissões (RBAC)</h2>
            <p className="text-xs text-gray-500 m-0">Papéis e níveis de autorização definidos na governança do sistema Precific.</p>
          </div>

          {/* Banner de Governança de Acesso */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mt-0.5">
              <ShieldCheck size={20} />
            </div>
            <div className="text-xs text-blue-950 space-y-1">
              <div className="font-bold text-sm text-blue-900">Modelo de Governança e Hierarquia:</div>
              <p className="leading-relaxed">
                • <strong>Superusuário (DcSys)</strong>: Acesso técnico e de infraestrutura exclusivo da equipe DcSys (manutenção, provisionamento e suporte à plataforma).<br />
                • <strong>Administrador (Global da Empresa)</strong>: Acesso irrestrito a todas as matrizes, filiais, usuários e configurações globais. Usuário responsável pelas configurações e parametrizações para a empresa começar a operar.<br />
                • <strong>Administrador da Matriz</strong>: Gestão completa da matriz e supervisão de todas as suas filiais vinculadas.<br />
                • <strong>Gerente de Filial</strong>: Gestão operacional, financeira e de estoque restrita à sua filial.<br />
                • <strong>Operador Padrão</strong>: Lançamento de pedidos, produtos, insumos e orçamentos na sua unidade.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {perfis.map((p) => {
              const isAdminGlobal = p.codigo === 'ADMIN' || p.codigo === 'SUPERUSER';
              const isAdminMatriz = p.codigo === 'ADMIN_MATRIZ';
              const isGerente = p.codigo === 'GERENTE_FILIAL';

              return (
                <div key={p.id} className={`p-5 rounded-xl border bg-white shadow-sm space-y-3 ${isAdminGlobal ? 'border-indigo-300 ring-1 ring-indigo-200' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${
                        isAdminGlobal ? 'bg-indigo-100 text-indigo-700' :
                        isAdminMatriz ? 'bg-blue-100 text-blue-700' :
                        isGerente ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 m-0">{p.nome}</h3>
                          {isAdminGlobal && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded">
                              EMPRESA GLOBAL
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-gray-500">{p.codigo}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 m-0 leading-relaxed">{p.descricao}</p>

                  <div className="pt-2 border-t text-xs text-gray-500 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-gray-700">Ações Permitidas: </span>
                      <span className="font-mono text-blue-700 font-medium">{p.permissoes || 'PADRÃO'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: NOVA MATRIZ */}
      {isModalNovaMatrizOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="text-blue-600" size={20} />
                <h3 className="text-base font-bold text-gray-900 m-0">Cadastrar Nova Matriz</h3>
              </div>
              <button onClick={() => setIsModalNovaMatrizOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCriarMatriz} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Grupo Silvia Cosméticos"
                  value={formMatriz.nomeFantasia}
                  onChange={e => setFormMatriz({ ...formMatriz, nomeFantasia: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Razão Social</label>
                <input
                  type="text"
                  placeholder="Ex: Silvia Artes e Perfumaria Ltda"
                  value={formMatriz.razaoSocial}
                  onChange={e => setFormMatriz({ ...formMatriz, razaoSocial: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={formMatriz.cnpj}
                  onChange={e => setFormMatriz({ ...formMatriz, cnpj: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Identificador do Schema (Opcional)</label>
                <input
                  type="text"
                  placeholder="Automático (ex: emp_grupo_silvia)"
                  value={formMatriz.schemaName}
                  onChange={e => setFormMatriz({ ...formMatriz, schemaName: e.target.value })}
                  className="w-full p-2 border rounded-md font-mono text-xs focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 mt-0.5 block">Se deixar em branco, o banco gerará com base no nome.</span>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalNovaMatrizOpen(false)}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmpresa}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEmpresa && <Loader2 size={16} className="animate-spin" />}
                  <span>Provisionar Matriz</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA FILIAL */}
      {isModalNovaFilialOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <GitFork className="text-green-600" size={20} />
                <h3 className="text-base font-bold text-gray-900 m-0">Cadastrar Nova Filial</h3>
              </div>
              <button onClick={() => setIsModalNovaFilialOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCriarFilial} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Matriz Controladora *</label>
                <select
                  value={formFilial.matrizId}
                  onChange={e => setFormFilial({ ...formFilial, matrizId: Number(e.target.value) })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {empresasHierarquia.map(m => (
                    <option key={m.id} value={m.id}>{m.nomeFantasia} (ID: {m.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Nome Fantasia da Filial *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Filial Shopping Sul"
                  value={formFilial.nomeFantasia}
                  onChange={e => setFormFilial({ ...formFilial, nomeFantasia: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Razão Social</label>
                <input
                  type="text"
                  placeholder="Ex: Silvia Artes Filial 02 Ltda"
                  value={formFilial.razaoSocial}
                  onChange={e => setFormFilial({ ...formFilial, razaoSocial: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">CNPJ da Filial</label>
                <input
                  type="text"
                  placeholder="00.000.000/0002-00"
                  value={formFilial.cnpj}
                  onChange={e => setFormFilial({ ...formFilial, cnpj: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Identificador do Schema (Opcional)</label>
                <input
                  type="text"
                  placeholder="Automático (ex: emp_filial_shopping_sul)"
                  value={formFilial.schemaName}
                  onChange={e => setFormFilial({ ...formFilial, schemaName: e.target.value })}
                  className="w-full p-2 border rounded-md font-mono text-xs focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 mt-0.5 block">Um schema isolado será criado automaticamente no PostgreSQL.</span>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalNovaFilialOpen(false)}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmpresa}
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEmpresa && <Loader2 size={16} className="animate-spin" />}
                  <span>Provisionar Filial</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO USUÁRIO */}
      {isModalNovoUsuarioOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="text-blue-600" size={20} />
                <h3 className="text-base font-bold text-gray-900 m-0">Cadastrar Usuário Global</h3>
              </div>
              <button onClick={() => setIsModalNovoUsuarioOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCriarUsuario} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={formUsuario.nome}
                  onChange={e => setFormUsuario({ ...formUsuario, nome: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">E-mail de Login *</label>
                <input
                  type="email"
                  required
                  placeholder="joao@empresa.com"
                  value={formUsuario.email}
                  onChange={e => setFormUsuario({ ...formUsuario, email: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Senha Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formUsuario.senha}
                  onChange={e => setFormUsuario({ ...formUsuario, senha: e.target.value })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formUsuario.isSuperuser}
                    onChange={e => setFormUsuario({ ...formUsuario, isSuperuser: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-gray-800">Superusuário DcSys</span>
                    <span className="block text-xs text-gray-500">Perfil técnico exclusivo da equipe DcSys (Infraestrutura/Manutenção)</span>
                  </div>
                </label>
              </div>

              {!formUsuario.isSuperuser && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Empresa Inicial</label>
                    <select
                      value={formUsuario.empresaId}
                      onChange={e => setFormUsuario({ ...formUsuario, empresaId: Number(e.target.value) })}
                      className="w-full p-1.5 border rounded text-xs bg-white"
                    >
                      {todasEmpresasLista.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.nomeFantasia}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Perfil na Empresa</label>
                    <select
                      value={formUsuario.perfilId}
                      onChange={e => setFormUsuario({ ...formUsuario, perfilId: Number(e.target.value) })}
                      className="w-full p-1.5 border rounded text-xs bg-white"
                    >
                      {perfis.map(p => (
                        <option key={p.id} value={p.id}>{p.nome} ({p.codigo})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalNovoUsuarioOpen(false)}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUsuario}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingUsuario && <Loader2 size={16} className="animate-spin" />}
                  <span>Salvar Usuário</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATRIBUIR EMPRESA A USUÁRIO */}
      {isModalVincularOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="text-blue-600" size={20} />
                <h3 className="text-base font-bold text-gray-900 m-0">Atribuir Empresa a Usuário</h3>
              </div>
              <button onClick={() => setIsModalVincularOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleVincularUsuario} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Usuário *</label>
                <select
                  value={formVinculo.usuarioId}
                  onChange={e => setFormVinculo({ ...formVinculo, usuarioId: Number(e.target.value) })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={0}>Selecione um usuário...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Empresa / Filial *</label>
                <select
                  value={formVinculo.empresaId}
                  onChange={e => setFormVinculo({ ...formVinculo, empresaId: Number(e.target.value) })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {todasEmpresasLista.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      [{emp.tipo}] {emp.nomeFantasia}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Perfil de Acesso na Unidade *</label>
                <select
                  value={formVinculo.perfilId}
                  onChange={e => setFormVinculo({ ...formVinculo, perfilId: Number(e.target.value) })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {perfis.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.codigo})</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalVincularOpen(false)}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUsuario}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingUsuario && <Loader2 size={16} className="animate-spin" />}
                  <span>Conceder Acesso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoGlobalPage;
