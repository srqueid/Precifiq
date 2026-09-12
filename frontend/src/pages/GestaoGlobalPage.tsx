import React, { useState, useEffect } from 'react';
import { maskCnpj, onlyNumbers } from '../utils/masks';
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
  AlertCircle,
  Server,
  HardDrive,
  Wrench,
  Lock,
  ShieldAlert,
  AlertTriangle,
  Edit2,
  Trash2,
  RotateCcw,
  XCircle
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

interface BancoStatusInfo {
  empresaId: number;
  nomeFantasia: string;
  schemaName: string;
  tabelasTotal: number;
  tabelasEsperadas: number;
  status: 'PROVISIONADO' | 'INCOMPLETO' | 'FALHA';
  insumosTotal?: number;
  unidadesMedidaTotal?: number;
  mensagem?: string;
  erro?: string;
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

  // Status de Bancos Isolados (DcSys Diagnóstico)
  const [bancoStatusMap, setBancoStatusMap] = useState<Record<number, BancoStatusInfo>>({});
  const [verificandoBancoId, setVerificandoBancoId] = useState<number | null>(null);
  const [reprovisionandoId, setReprovisionandoId] = useState<number | null>(null);

  // Modais de Empresa
  const [isModalNovaMatrizOpen, setIsModalNovaMatrizOpen] = useState(false);
  const [isModalNovaFilialOpen, setIsModalNovaFilialOpen] = useState(false);
  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);
  const [empresaParaEditar, setEmpresaParaEditar] = useState<EmpresaItem | null>(null);
  const [isSalvandoEdicaoEmpresa, setIsSalvandoEdicaoEmpresa] = useState(false);

  // Modais de Usuário
  const [isModalNovoUsuarioOpen, setIsModalNovoUsuarioOpen] = useState(false);
  const [isModalVincularOpen, setIsModalVincularOpen] = useState(false);
  const [isSavingUsuario, setIsSavingUsuario] = useState(false);

  // Forms
  const [formMatriz, setFormMatriz] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    bancoDados: '',
    schemaName: '',
    adminNome: '',
    adminEmail: '',
    adminSenha: ''
  });

  const [formFilial, setFormFilial] = useState({
    matrizId: 1,
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    schemaName: '',
    adminNome: '',
    adminEmail: '',
    adminSenha: ''
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

  // Diagnóstico de Banco de Dados Isolado (DcSys Suporte & Infraestrutura)
  const verificarStatusBanco = async (empresaId: number) => {
    try {
      setVerificandoBancoId(empresaId);
      const res = await fetch(`/api/global/empresas/${empresaId}/banco-status`);
      if (res.ok) {
        const data: BancoStatusInfo = await res.json();
        setBancoStatusMap(prev => ({ ...prev, [empresaId]: data }));
        showFeedback('success', `Banco [${data.schemaName}]: ${data.status} (${data.tabelasTotal}/${data.tabelasEsperadas} tabelas).`);
      } else {
        const err = await res.json().catch(() => ({ error: 'Erro ao verificar banco' }));
        showFeedback('error', err.error || 'Erro ao consultar status do banco');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Falha ao conectar com o banco de dados');
    } finally {
      setVerificandoBancoId(null);
    }
  };

  const reprovisionarBanco = async (empresaId: number, nomeFantasia: string) => {
    if (!window.confirm(`[DcSys Manutenção] Deseja reparar/reprovisionar a estrutura de tabelas e módulos para "${nomeFantasia}"?`)) {
      return;
    }

    try {
      setReprovisionandoId(empresaId);
      const res = await fetch(`/api/global/empresas/${empresaId}/reprovisionar`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        showFeedback('success', data.message || 'Banco de dados reprovisionado com sucesso!');
        await verificarStatusBanco(empresaId);
      } else {
        const err = await res.json().catch(() => ({ error: 'Falha ao reprovisionar' }));
        showFeedback('error', err.error || 'Erro ao reprovisionar banco de dados');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Falha na requisição de reprovisionamento');
    } finally {
      setReprovisionandoId(null);
    }
  };

  // Handler para criar Matriz
  const handleCriarMatriz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatriz.nomeFantasia.trim()) {
      showFeedback('error', 'Nome Fantasia é obrigatório');
      return;
    }

    setIsSavingEmpresa(true);
    try {
      const clean = formMatriz.nomeFantasia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const dbAuto = (formMatriz.bancoDados.trim() && formMatriz.bancoDados.trim() !== 'bd_controle')
        ? formMatriz.bancoDados.trim()
        : (`bd_${clean}` || 'bd_empresa');
      const schemaAuto = (formMatriz.schemaName.trim() && formMatriz.schemaName.trim() !== 'matriz')
        ? formMatriz.schemaName.trim()
        : (`db_${clean}` || 'db_empresa');

      const res = await fetch('/api/global/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'MATRIZ',
          matrizId: null,
          nomeFantasia: formMatriz.nomeFantasia.trim(),
          razaoSocial: formMatriz.razaoSocial.trim() || formMatriz.nomeFantasia.trim(),
          cnpj: onlyNumbers(formMatriz.cnpj) || null,
          bancoDados: dbAuto,
          schemaName: schemaAuto,
          adminNome: formMatriz.adminNome.trim() || null,
          adminEmail: formMatriz.adminEmail.trim() || null,
          adminSenha: formMatriz.adminSenha.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao cadastrar Matriz' }));
        throw new Error(err.error || 'Erro ao cadastrar Matriz');
      }

      showFeedback('success', `Matriz cadastrada no banco '${dbAuto}' com schema '${schemaAuto}' e governança 'global'!`);
      setIsModalNovaMatrizOpen(false);
      setFormMatriz({ nomeFantasia: '', razaoSocial: '', cnpj: '', bancoDados: '', schemaName: '', adminNome: '', adminEmail: '', adminSenha: '' });
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
      const matrizPai = empresasHierarquia.find(m => m.id === Number(formFilial.matrizId));
      const clean = formFilial.nomeFantasia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const schemaAuto = formFilial.schemaName.trim() && !formFilial.schemaName.trim().startsWith('filial_')
        ? formFilial.schemaName.trim()
        : (`db_${clean}` || 'db_filial');

      const res = await fetch('/api/global/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'FILIAL',
          matrizId: Number(formFilial.matrizId),
          nomeFantasia: formFilial.nomeFantasia.trim(),
          razaoSocial: formFilial.razaoSocial.trim() || formFilial.nomeFantasia.trim(),
          cnpj: onlyNumbers(formFilial.cnpj) || null,
          bancoDados: matrizPai?.bancoDados || 'bd_controle',
          schemaName: schemaAuto,
          adminNome: formFilial.adminNome.trim() || null,
          adminEmail: formFilial.adminEmail.trim() || null,
          adminSenha: formFilial.adminSenha.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao cadastrar Filial' }));
        throw new Error(err.error || 'Erro ao cadastrar Filial');
      }

      showFeedback('success', `Filial cadastrada no schema '${schemaAuto}' dentro do banco '${matrizPai?.bancoDados || 'bd_controle'}'!`);
      setIsModalNovaFilialOpen(false);
      setFormFilial({ matrizId: empresasHierarquia[0]?.id || 1, nomeFantasia: '', razaoSocial: '', cnpj: '', schemaName: '', adminNome: '', adminEmail: '', adminSenha: '' });
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro inesperado ao criar filial');
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  // Handlers de CRUD de Empresas (Superusuário DcSys)
  const handleSalvarEdicaoEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaParaEditar) return;
    setIsSalvandoEdicaoEmpresa(true);
    try {
      const res = await fetch(`/api/global/empresas/${empresaParaEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeFantasia: empresaParaEditar.nomeFantasia,
          razaoSocial: empresaParaEditar.razaoSocial,
          cnpj: onlyNumbers(empresaParaEditar.cnpj || ''),
          ativo: empresaParaEditar.ativo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar empresa');
      showFeedback('success', data.mensagem || 'Empresa atualizada com sucesso!');
      setEmpresaParaEditar(null);
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao atualizar empresa');
    } finally {
      setIsSalvandoEdicaoEmpresa(false);
    }
  };

  const handleExcluirLogicoEmpresa = async (empresa: { id: number; nomeFantasia: string; tipo: string }) => {
    const isMatriz = empresa.tipo === 'MATRIZ';
    const msg = isMatriz
      ? `ATENÇÃO: Deseja realmente excluir/inativar a Matriz "${empresa.nomeFantasia}"?\n\nTodas as filiais vinculadas a esta matriz serão AUTOMATICAMENTE EXCLUÍDAS/INATIVADAS logicamente em cascata!`
      : `Deseja realmente excluir/inativar a Filial "${empresa.nomeFantasia}" logicamente?`;

    if (!window.confirm(msg)) return;

    try {
      const res = await fetch(`/api/global/empresas/${empresa.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao inativar empresa');
      showFeedback('success', data.message || 'Empresa excluída logicamente com sucesso!');
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao excluir logicamente');
    }
  };

  const handleReativarEmpresa = async (empresa: { id: number; nomeFantasia: string; tipo: string }) => {
    if (!window.confirm(`Deseja reativar a ${empresa.tipo === 'MATRIZ' ? 'Matriz' : 'Filial'} "${empresa.nomeFantasia}"?`)) return;

    try {
      const res = await fetch(`/api/global/empresas/${empresa.id}/reativar`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reativar empresa');
      showFeedback('success', data.message || 'Empresa reativada com sucesso!');
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao reativar empresa');
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
      bancoDados: m.bancoDados || 'bd_controle',
      schemaName: m.schemaName,
      ativo: m.ativo
    });
    m.filiais?.forEach(f => todasEmpresasLista.push({
      ...f,
      bancoDados: f.bancoDados || m.bancoDados || 'bd_controle'
    }));
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

      {/* Banner de Infraestrutura e Autorização Técnica DcSys */}
      {isSuperuser ? (
        <div className="p-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 flex items-start justify-between gap-4 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-purple-600 text-white shadow-sm mt-0.5">
              <Server size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-purple-950 m-0">Console Técnico de Infraestrutura • DcSys</h2>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-200 text-purple-900 uppercase tracking-wide flex items-center gap-1">
                  <ShieldCheck size={12} />
                  Superusuário Ativo
                </span>
              </div>
              <p className="text-xs text-purple-800 mt-1 max-w-3xl leading-relaxed m-0">
                Acesso técnico exclusivo da equipe <strong>DcSys</strong>: manutenção preventiva, diagnóstico de integridade de schemas e <strong>provisionamento automatizado de novos bancos de dados PostgreSQL para cada empresa cadastrada</strong>.
              </p>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end justify-center text-right shrink-0">
            <span className="text-xs font-semibold text-purple-900">Provisionamento PostgreSQL</span>
            <span className="text-[11px] text-purple-600 font-mono">16 tabelas isoladas / tenant</span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/90 flex items-start gap-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 m-0">Provisionamento de Banco de Dados Restrito à Equipe DcSys</h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed m-0">
              O cadastro de novas empresas e a criação de novos bancos de dados PostgreSQL isolados é uma atribuição exclusiva do <strong>Superusuário (DcSys)</strong> para suporte e governança de infraestrutura.
            </p>
          </div>
        </div>
      )}

      {/* Cards de Métricas e Status Corporativo */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card has-icon blue">
          <div className="kpi-icon blue">
            <Building2 size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Matrizes</div>
            <div className="kpi-value blue">{totalMatrizes}</div>
            <div className="kpi-trend">Sedes principais cadastradas</div>
          </div>
        </div>

        <div className="kpi-card has-icon green">
          <div className="kpi-icon green">
            <GitFork size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Filiais Ativas</div>
            <div className="kpi-value green">{totalFiliais}</div>
            <div className="kpi-trend">Unidades operacionais</div>
          </div>
        </div>

        <div className="kpi-card has-icon yellow">
          <div className="kpi-icon yellow">
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Usuários Centrais</div>
            <div className="kpi-value yellow">{totalUsuarios}</div>
            <div className="kpi-trend">Gestores e operadores</div>
          </div>
        </div>

        <div className="kpi-card has-icon blue">
          <div className="kpi-icon blue">
            <Database size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Base Ativa no Navegador</div>
            <div className="kpi-value" style={{ fontSize: '15px', fontWeight: 700 }} title={activeCompany?.nomeFantasia}>
              {activeCompany?.nomeFantasia || 'Carregando...'}
            </div>
            <div className="kpi-trend" style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              schema: {activeCompany?.schemaName}
            </div>
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
                onClick={() => {
                  if (!isSuperuser) {
                    showFeedback('error', 'Apenas o Superusuário DcSys possui permissão para provisionar novas empresas e criar novos bancos de dados.');
                    return;
                  }
                  setIsModalNovaMatrizOpen(true);
                }}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors ${
                  isSuperuser 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                }`}
                title={isSuperuser ? 'Provisionar nova Matriz com banco de dados isolado (DcSys)' : 'Ação restrita ao Superusuário DcSys'}
              >
                {isSuperuser ? <Plus size={16} /> : <Lock size={15} />}
                <span>Nova Matriz</span>
                {isSuperuser && <span className="text-[10px] px-1.5 py-0.5 bg-purple-700 rounded text-purple-100 font-bold">DCSYS</span>}
              </button>

              <button
                onClick={() => {
                  if (!isSuperuser) {
                    showFeedback('error', 'Apenas o Superusuário DcSys possui permissão para provisionar novas filiais e criar novos bancos de dados.');
                    return;
                  }
                  setIsModalNovaFilialOpen(true);
                }}
                disabled={empresasHierarquia.length === 0}
                className={`px-3.5 py-2 border rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  isSuperuser
                    ? 'border-green-600 text-green-700 hover:bg-green-50'
                    : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                } disabled:opacity-50`}
                title={isSuperuser ? 'Provisionar nova Filial com banco de dados isolado (DcSys)' : 'Ação restrita ao Superusuário DcSys'}
              >
                {isSuperuser ? <GitFork size={16} /> : <Lock size={15} />}
                <span>Nova Filial</span>
                {isSuperuser && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 rounded text-green-800 font-bold">DCSYS</span>}
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
                const statusMatriz = bancoStatusMap[matriz.id];

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
                            {matriz.ativo ? (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                                Ativa
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                                <XCircle size={12} />
                                Inativa (Excluída)
                              </span>
                            )}
                            {isMatrizAtiva && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Empresa Ativa
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            {matriz.razaoSocial && <span>Razão: {matriz.razaoSocial}</span>}
                            {matriz.cnpj && <span>CNPJ: {matriz.cnpj}</span>}
                            <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Banco: <strong>{matriz.bancoDados || 'bd_controle'}</strong>
                            </span>
                            <span className="font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              Schema Matriz: <strong>{matriz.schemaName}</strong>
                            </span>
                            <span className="font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Governança: <strong>global ({matriz.bancoDados || 'bd_controle'})</strong>
                            </span>

                            {/* Ferramentas de Diagnóstico e Reparo do Banco Isolado */}
                            <button
                              type="button"
                              onClick={() => verificarStatusBanco(matriz.id)}
                              disabled={verificandoBancoId === matriz.id}
                              className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50 flex items-center gap-1 transition-colors"
                              title="Diagnosticar integridade do banco de dados PostgreSQL isolado"
                            >
                              {verificandoBancoId === matriz.id ? <Loader2 size={11} className="animate-spin" /> : <HardDrive size={11} />}
                              <span>Status Banco</span>
                            </button>

                            {isSuperuser && (
                              <button
                                type="button"
                                onClick={() => reprovisionarBanco(matriz.id, matriz.nomeFantasia)}
                                disabled={reprovisionandoId === matriz.id}
                                className="px-2 py-0.5 text-xs text-purple-700 hover:text-purple-900 border border-purple-200 rounded hover:bg-purple-50 flex items-center gap-1 transition-colors"
                                title="Reprovisionar/Reparar tabelas e módulos da Matriz (DcSys)"
                              >
                                {reprovisionandoId === matriz.id ? <Loader2 size={11} className="animate-spin" /> : <Wrench size={11} />}
                                <span>Reparar DDL</span>
                              </button>
                            )}

                            {statusMatriz && (
                              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full flex items-center gap-1 ${
                                statusMatriz.status === 'PROVISIONADO' 
                                   ? 'bg-emerald-100 text-emerald-800' 
                                   : 'bg-amber-100 text-amber-800'
                              }`}>
                                <Server size={11} />
                                <span>{statusMatriz.tabelasTotal}/16 tabelas ({statusMatriz.status})</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Ações Administrativas de CRUD (Superusuário DcSys) */}
                        {isSuperuser && (
                          <div className="flex items-center gap-1.5 mr-2 border-r pr-2 border-gray-300">
                            <button
                              type="button"
                              onClick={() => setEmpresaParaEditar({
                                id: matriz.id,
                                nomeFantasia: matriz.nomeFantasia,
                                razaoSocial: matriz.razaoSocial || '',
                                cnpj: matriz.cnpj || '',
                                tipo: 'MATRIZ',
                                schemaName: matriz.schemaName,
                                bancoDados: matriz.bancoDados || 'bd_controle',
                                ativo: matriz.ativo
                              })}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1 transition-colors shadow-sm"
                              title="Editar Informações da Matriz"
                            >
                              <Edit2 size={13} className="text-blue-600" />
                              <span>Editar</span>
                            </button>

                            {matriz.ativo ? (
                              <button
                                type="button"
                                onClick={() => handleExcluirLogicoEmpresa(matriz)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 flex items-center gap-1 transition-colors shadow-sm"
                                title="Excluir logicamente a Matriz e todas as suas filiais em cascata"
                              >
                                <Trash2 size={13} />
                                <span>Inativar</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReativarEmpresa(matriz)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 flex items-center gap-1 transition-colors shadow-sm"
                                title="Reativar Matriz"
                              >
                                <RotateCcw size={13} />
                                <span>Reativar</span>
                              </button>
                            )}
                          </div>
                        )}

                        {!isMatrizAtiva && matriz.ativo && (
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
                            if (!isSuperuser) {
                              showFeedback('error', 'Apenas o Superusuário DcSys possui permissão para provisionar novas filiais e criar novos bancos de dados.');
                              return;
                            }
                            setFormFilial(prev => ({ ...prev, matrizId: matriz.id }));
                            setIsModalNovaFilialOpen(true);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold bg-white border rounded-md flex items-center gap-1 transition-colors ${
                            isSuperuser ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed opacity-60'
                          }`}
                          title={isSuperuser ? 'Adicionar nova filial com banco próprio (DcSys)' : 'Apenas Superusuário DcSys pode criar filiais'}
                        >
                          {isSuperuser ? <Plus size={14} /> : <Lock size={12} />}
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
                          Nenhuma filial vinculada a esta Matriz. {isSuperuser ? 'Clique em "Adicionar Filial" para provisionar a primeira filial com banco próprio.' : 'Solicite ao Superusuário DcSys para provisionar filiais.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {matriz.filiais.map((filial) => {
                            const isFilialAtiva = activeCompany?.id === filial.id && activeCompany.tipo === 'FILIAL';
                            const statusFilial = bancoStatusMap[filial.id];

                            return (
                              <div
                                key={filial.id}
                                className={`p-4 rounded-lg border transition-all ${
                                  !filial.ativo
                                    ? 'bg-rose-50/30 border-rose-200 opacity-80'
                                    : isFilialAtiva 
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
                                      {filial.ativo ? (
                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-800">
                                          Ativa
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-rose-100 text-rose-800 flex items-center gap-0.5">
                                          <XCircle size={10} />
                                          Inativa
                                        </span>
                                      )}
                                      {isFilialAtiva && (
                                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                                          <CheckCircle2 size={12} />
                                          Ativa
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                                      {filial.cnpj && <div>CNPJ: {filial.cnpj}</div>}
                                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                        <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                          Banco: <strong>{filial.bancoDados || matriz.bancoDados || 'bd_controle'}</strong>
                                        </span>
                                        <span className="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[11px]">
                                          Schema: <strong>{filial.schemaName}</strong>
                                        </span>

                                        <button
                                          type="button"
                                          onClick={() => verificarStatusBanco(filial.id)}
                                          disabled={verificandoBancoId === filial.id}
                                          className="text-[11px] text-blue-600 hover:text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-50 inline-flex items-center gap-1"
                                          title="Verificar integridade do banco de dados isolado da filial"
                                        >
                                          {verificandoBancoId === filial.id ? <Loader2 size={10} className="animate-spin" /> : <HardDrive size={10} />}
                                          <span>Status</span>
                                        </button>

                                        {isSuperuser && (
                                          <button
                                            type="button"
                                            onClick={() => reprovisionarBanco(filial.id, filial.nomeFantasia)}
                                            disabled={reprovisionandoId === filial.id}
                                            className="text-[11px] text-purple-700 hover:text-purple-900 border border-purple-200 px-1.5 py-0.5 rounded hover:bg-purple-50 inline-flex items-center gap-1"
                                            title="Reprovisionar/Reparar tabelas da filial (DcSys)"
                                          >
                                            {reprovisionandoId === filial.id ? <Loader2 size={10} className="animate-spin" /> : <Wrench size={10} />}
                                            <span>Reparar</span>
                                          </button>
                                        )}

                                        {statusFilial && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                            statusFilial.status === 'PROVISIONADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {statusFilial.tabelasTotal}/16 tabelas
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {/* Ações CRUD para Filiais (Superusuário DcSys) */}
                                    {isSuperuser && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => setEmpresaParaEditar({
                                            id: filial.id,
                                            nomeFantasia: filial.nomeFantasia,
                                            razaoSocial: filial.razaoSocial || '',
                                            cnpj: filial.cnpj || '',
                                            tipo: 'FILIAL',
                                            schemaName: filial.schemaName,
                                            bancoDados: filial.bancoDados || matriz.bancoDados || 'bd_controle',
                                            ativo: filial.ativo
                                          })}
                                          className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-200"
                                          title="Editar Filial"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        {filial.ativo ? (
                                          <button
                                            type="button"
                                            onClick={() => handleExcluirLogicoEmpresa(filial)}
                                            className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200"
                                            title="Excluir logicamente esta filial"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleReativarEmpresa(filial)}
                                            className="p-1.5 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200"
                                            title="Reativar filial"
                                          >
                                            <RotateCcw size={13} />
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {!isFilialAtiva && filial.ativo && (
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
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="text-purple-600" size={20} />
                <h3 className="text-base font-bold text-gray-900 m-0">Provisionar Nova Matriz (DcSys)</h3>
              </div>
              <button onClick={() => setIsModalNovaMatrizOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Banner de Infraestrutura DcSys no Modal */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2.5 text-xs text-purple-900">
              <Server size={18} className="text-purple-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>Arquitetura de Banco & Governança DcSys</span>
                </div>
                <p className="text-purple-800 leading-relaxed m-0 text-[11px]">
                  O nome da empresa define o <strong>banco de dados PostgreSQL</strong> (ex.: <code>bd_controle</code>).
                  A Matriz opera no schema <code>matriz</code> (ou <code>controle</code>), e o schema <code>global</code> de governança corporativa fica hospedado neste mesmo banco.
                </p>
              </div>
            </div>

            <form onSubmit={handleCriarMatriz} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Nome Fantasia da Matriz *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Grupo Silvia Cosméticos"
                  value={formMatriz.nomeFantasia}
                  onChange={e => {
                    const val = e.target.value;
                    const clean = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                    setFormMatriz(prev => ({
                      ...prev,
                      nomeFantasia: val,
                      razaoSocial: prev.razaoSocial || val,
                      bancoDados: clean ? `bd_${clean}` : '',
                      schemaName: clean ? `db_${clean}` : ''
                    }));
                  }}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Razão Social</label>
                  <input
                    type="text"
                    placeholder="Ex: Silvia Cosméticos Ltda"
                    value={formMatriz.razaoSocial}
                    onChange={e => setFormMatriz({ ...formMatriz, razaoSocial: e.target.value })}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={formMatriz.cnpj}
                    onChange={e => setFormMatriz({ ...formMatriz, cnpj: (e.target.value = maskCnpj(e.target.value)) })}
                    maxLength={18}
                    inputMode="numeric"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Banco de Dados PostgreSQL</label>
                  <input
                    type="text"
                    required
                    value={formMatriz.bancoDados}
                    onChange={e => setFormMatriz({ ...formMatriz, bancoDados: e.target.value })}
                    className="w-full p-2 border rounded-md font-mono text-xs focus:ring-2 focus:ring-purple-500 font-bold text-blue-700 bg-slate-50"
                  />
                  <span className="text-xs text-gray-400 mt-0.5 block">Convenção: bd_&lt;empresa&gt;</span>
                </div>
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Schema da Matriz</label>
                  <input
                    type="text"
                    required
                    value={formMatriz.schemaName}
                    onChange={e => setFormMatriz({ ...formMatriz, schemaName: e.target.value })}
                    className="w-full p-2 border rounded-md font-mono text-xs focus:ring-2 focus:ring-purple-500 font-bold text-purple-700 bg-slate-50"
                  />
                  <span className="text-xs text-gray-400 mt-0.5 block">Padrão: db_&lt;empresa&gt; (ex.: db_galeriavagalume)</span>
                </div>
              </div>

              {/* Administrador Inicial da Empresa */}
              <div className="p-3 bg-gray-50 border rounded-lg space-y-2.5">
                <div className="font-semibold text-xs text-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-purple-600" />
                    <span>Administrador Inicial da Empresa (Acesso do Cliente)</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-normal">Opcional</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Nome do Administrador</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Gerente"
                      value={formMatriz.adminNome}
                      onChange={e => setFormMatriz({ ...formMatriz, adminNome: e.target.value })}
                      className="w-full p-2 border rounded-md text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">E-mail de Acesso</label>
                    <input
                      type="email"
                      placeholder="carlos@empresa.com"
                      value={formMatriz.adminEmail}
                      onChange={e => setFormMatriz({ ...formMatriz, adminEmail: e.target.value })}
                      className="w-full p-2 border rounded-md text-xs bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Senha Temporária de Acesso</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formMatriz.adminSenha}
                    onChange={e => setFormMatriz({ ...formMatriz, adminSenha: e.target.value })}
                    className="w-full p-2 border rounded-md text-xs bg-white"
                  />
                </div>
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEmpresa && <Loader2 size={16} className="animate-spin" />}
                  <span>Provisionar Banco e Matriz</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA FILIAL */}
      {isModalNovaFilialOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <GitFork className="text-green-600" size={20} />
                <h3 className="text-base font-bold text-gray-900 m-0">Provisionar Nova Filial (DcSys)</h3>
              </div>
              <button onClick={() => setIsModalNovaFilialOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Banner de Infraestrutura DcSys no Modal */}
            {(() => {
              const matrizPai = empresasHierarquia.find(m => m.id === Number(formFilial.matrizId)) || empresasHierarquia[0];
              const dbPai = matrizPai?.bancoDados || 'bd_controle';

              return (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2.5 text-xs text-green-900">
                  <Server size={18} className="text-green-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>Hospedagem no Banco da Matriz ({dbPai})</span>
                      <span className="px-1.5 py-0.2 bg-green-200 text-green-900 text-[10px] rounded font-mono">16 tabelas</span>
                    </div>
                    <p className="text-green-800 leading-relaxed m-0 text-[11px]">
                      A filial será criada no banco <strong>{dbPai}</strong> sob o schema dedicado (ex.: <code>filial_shopping</code>).
                      A governança corporativa e autenticação global continuam centralizadas no schema <code>global</code> deste banco.
                    </p>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleCriarFilial} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Matriz Controladora *</label>
                <select
                  value={formFilial.matrizId}
                  onChange={e => setFormFilial({ ...formFilial, matrizId: Number(e.target.value) })}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {empresasHierarquia.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nomeFantasia} (Banco: {m.bancoDados || 'bd_controle'})
                    </option>
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
                  onChange={e => {
                    const val = e.target.value;
                    const clean = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                    setFormFilial(prev => ({
                      ...prev,
                      nomeFantasia: val,
                      schemaName: clean ? `db_${clean}` : ''
                    }));
                  }}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Razão Social</label>
                  <input
                    type="text"
                    placeholder="Ex: Silvia Artes Filial 02 Ltda"
                    value={formFilial.razaoSocial}
                    onChange={e => setFormFilial({ ...formFilial, razaoSocial: e.target.value })}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">CNPJ da Filial</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0002-00"
                    value={formFilial.cnpj}
                    onChange={e => setFormFilial({ ...formFilial, cnpj: (e.target.value = maskCnpj(e.target.value)) })}
                    maxLength={18}
                    inputMode="numeric"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Schema da Filial (PostgreSQL)</label>
                <input
                  type="text"
                  placeholder="db_filialshopping"
                  value={formFilial.schemaName}
                  onChange={e => setFormFilial({ ...formFilial, schemaName: e.target.value })}
                  className="w-full p-2 border rounded-md font-mono text-xs focus:ring-2 focus:ring-green-500 font-bold text-teal-700 bg-slate-50"
                />
                <span className="text-xs text-gray-400 mt-0.5 block">Convenção: db_&lt;nome&gt;. Criado no banco de dados da Matriz.</span>
              </div>

              {/* Administrador Inicial da Filial */}
              <div className="p-3 bg-gray-50 border rounded-lg space-y-2.5">
                <div className="font-semibold text-xs text-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-green-600" />
                    <span>Administrador Inicial da Filial (Acesso do Cliente)</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-normal">Opcional</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Nome do Administrador</label>
                    <input
                      type="text"
                      placeholder="Ex: Amanda Gerente Filial"
                      value={formFilial.adminNome}
                      onChange={e => setFormFilial({ ...formFilial, adminNome: e.target.value })}
                      className="w-full p-2 border rounded-md text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">E-mail de Acesso</label>
                    <input
                      type="email"
                      placeholder="amanda@filial.com"
                      value={formFilial.adminEmail}
                      onChange={e => setFormFilial({ ...formFilial, adminEmail: e.target.value })}
                      className="w-full p-2 border rounded-md text-xs bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Senha Temporária de Acesso</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formFilial.adminSenha}
                    onChange={e => setFormFilial({ ...formFilial, adminSenha: e.target.value })}
                    className="w-full p-2 border rounded-md text-xs bg-white"
                  />
                </div>
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
                  <span>Provisionar Banco e Filial</span>
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

      {/* MODAL: EDITAR EMPRESA / FILIAL (CRUD SUPERUSUÁRIO DCSYS) */}
      {empresaParaEditar && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold m-0">
                  Editar {empresaParaEditar.tipo === 'MATRIZ' ? 'Matriz' : 'Filial'}: {empresaParaEditar.nomeFantasia}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmpresaParaEditar(null)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoEmpresa} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  value={empresaParaEditar.nomeFantasia}
                  onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, nomeFantasia: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Razão Social</label>
                  <input
                    type="text"
                    value={empresaParaEditar.razaoSocial || ''}
                    onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, razaoSocial: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={empresaParaEditar.cnpj || ''}
                    onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, cnpj: maskCnpj(e.target.value) })}
                    maxLength={18}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Schema PostgreSQL</label>
                  <span className="font-mono text-xs text-purple-800 font-bold">{empresaParaEditar.schemaName}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Banco de Dados</label>
                  <span className="font-mono text-xs text-blue-800 font-bold">{empresaParaEditar.bancoDados || 'bd_controle'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg">
                <input
                  type="checkbox"
                  id="chkAtivoEmpresaGlobal"
                  checked={empresaParaEditar.ativo}
                  onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, ativo: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="chkAtivoEmpresaGlobal" className="text-xs font-bold text-gray-800 cursor-pointer">
                  Empresa Ativa no Sistema
                </label>
              </div>

              {empresaParaEditar.tipo === 'MATRIZ' && !empresaParaEditar.ativo && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Atenção:</strong> Ao inativar uma Matriz, todas as suas filiais vinculadas serão inativadas automaticamente em cascata.
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEmpresaParaEditar(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSalvandoEdicaoEmpresa}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {isSalvandoEdicaoEmpresa ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Salvar Alterações</span>
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
