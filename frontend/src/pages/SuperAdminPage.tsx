import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  LogOut,
  Sliders,
  ChevronRight,
  Eye,
  UserMinus,
  Check,
  FileText,
  HelpCircle,
  FolderTree,
  Shield,
  Briefcase,
  RotateCcw,
  XCircle
} from 'lucide-react';
import { useTenant, EmpresaHierarquia, EmpresaItem } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { toast, fmt } from '../js/app';

interface Perfil {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  permissoes: string;
  ativo?: boolean;
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
}

// Catálogo de Módulos & Permissões Exatamente como nas Telas de Referência
interface PermissaoItem {
  key: string;
  label: string;
}

interface ModuloPermissoes {
  titulo: string;
  icone: string;
  permissoes: PermissaoItem[];
}

const MODULOS_RBAC: ModuloPermissoes[] = [
  {
    titulo: 'Módulo: Dashboard',
    icone: '📊',
    permissoes: [
      { key: 'Dashboard_Financeiro', label: 'Dashboard_Financeiro' },
      { key: 'Dashboard_Operacional', label: 'Dashboard_Operacional' },
      { key: 'Dashboard_Vendas', label: 'Dashboard_Vendas' }
    ]
  },
  {
    titulo: 'Módulo: Usuários & Perfis (RBAC)',
    icone: '👥',
    permissoes: [
      { key: 'RBAC_View_Profiles', label: 'RBAC_View_Profiles' },
      { key: 'RBAC_Manage_Profiles', label: 'RBAC_Manage_Profiles' },
      { key: 'RBAC_View_Users', label: 'RBAC_View_Users' },
      { key: 'RBAC_Manage_Users', label: 'RBAC_Manage_Users' }
    ]
  },
  {
    titulo: 'Módulo: Cadastro e Estrutura',
    icone: '🏢',
    permissoes: [
      { key: 'Cad_Matriz_View', label: 'Cad_Matriz_View' },
      { key: 'Cad_Filial_View', label: 'Cad_Filial_View' },
      { key: 'Cad_Filial_Create/Edit', label: 'Cad_Filial_Create/Edit' },
      { key: 'Cad_Filial_Delete', label: 'Cad_Filial_Delete' }
    ]
  },
  {
    titulo: 'Módulo: Estoque',
    icone: '📦',
    permissoes: [
      { key: 'Estoque_View', label: 'Estoque_View' },
      { key: 'Estoque_Ajuste', label: 'Estoque_Ajuste' },
      { key: 'Estoque_Inventario', label: 'Estoque_Inventário' }
    ]
  },
  {
    titulo: 'Módulo: Vendas',
    icone: '🛒',
    permissoes: [
      { key: 'Vendas_View', label: 'Vendas_View' },
      { key: 'Vendas_Create/Edit', label: 'Vendas_Create/Edit' },
      { key: 'Vendas_Relatorios', label: 'Vendas_Relatórios' }
    ]
  },
  {
    titulo: 'Módulo: Relatórios',
    icone: '📈',
    permissoes: [
      { key: 'Relatorios_View', label: 'Relatórios_View' },
      { key: 'Relatorios_Create/Edit', label: 'Relatórios_Create/Edit' },
      { key: 'Relatorios_Vendas', label: 'Relatórios_Vendas' }
    ]
  }
];

export const SuperAdminPage: React.FC = () => {
  const { user, isSuperuser, logout } = useAuth();
  const { activeCompany, empresasHierarquia, selectCompany, refreshEmpresas, isLoadingEmpresas } = useTenant();
  const navigate = useNavigate();

  // Abas: Empresas (Img 2), Perfis RBAC (Img 3), Administradores (Img 1)
  const [activeTab, setActiveTab] = useState<'empresas' | 'perfis' | 'administradores'>('empresas');

  // Dados
  const [usuarios, setUsuarios] = useState<UsuarioGlobal[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(false);
  const [isLoadingPerfis, setIsLoadingPerfis] = useState(false);

  // Status de Bancos Isolados
  const [bancoStatusMap, setBancoStatusMap] = useState<Record<number, BancoStatusInfo>>({});
  const [verificandoBancoId, setVerificandoBancoId] = useState<number | null>(null);
  const [reprovisionandoId, setReprovisionandoId] = useState<number | null>(null);

  // Empresa selecionada para detalhe de banco (Imagem 2)
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState<number | null>(null);

  // Modais de Empresa (Imagem 2)
  const [isModalNovaMatrizOpen, setIsModalNovaMatrizOpen] = useState(false);
  const [isModalNovaFilialOpen, setIsModalNovaFilialOpen] = useState(false);
  const [isSavingEmpresa, setIsSavingEmpresa] = useState(false);

  // Modais de Perfil RBAC (Imagem 3)
  const [isModalPerfilOpen, setIsModalPerfilOpen] = useState(false);
  const [modalPerfilTab, setModalPerfilTab] = useState<'geral' | 'permissoes'>('permissoes');
  const [editingPerfilId, setEditingPerfilId] = useState<number | null>(null);
  const [isSavingPerfil, setIsSavingPerfil] = useState(false);
  const [formPerfil, setFormPerfil] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    permissoesSelecionadas: new Set<string>()
  });

  // Modais de Administrador de Empresa (Imagem 1)
  const [isModalNovoAdminOpen, setIsModalNovoAdminOpen] = useState(false);
  const [isModalConcederFiliaisOpen, setIsModalConcederFiliaisOpen] = useState(false);
  const [adminSelecionado, setAdminSelecionado] = useState<UsuarioGlobal | null>(null);
  const [filiaisParaConceder, setFiliaisParaConceder] = useState<number[]>([]);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

  // Filtros de Administradores (Imagem 1)
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('');
  const [filtroFilial, setFiltroFilial] = useState<string>('');
  const [filtroPerfil, setFiltroPerfil] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState<string>('');

  // Formulários de Empresa
  const [formMatriz, setFormMatriz] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    bancoDados: '',
    schemaName: '',
    limiteProdutos: '',
    adminNome: '',
    adminEmail: '',
    adminSenha: ''
  });

  const [formFilial, setFormFilial] = useState({
    matrizId: 1,
    nomeFilial: '',
    cnpj: '',
    schemaName: '',
    limiteProdutos: '',
    provisionarAuto: true,
    adminVinculadoId: 0,
    adminNome: '',
    adminEmail: '',
    adminSenha: ''
  });

  // Estado para Edição de Empresa / Filial (CRUD Superusuário)
  const [empresaParaEditar, setEmpresaParaEditar] = useState<{
    id: number;
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
    tipo: string;
    schemaName: string;
    bancoDados: string;
    ativo: boolean;
    limiteProdutos: string;
  } | null>(null);
  const [isSalvandoEdicaoEmpresa, setIsSalvandoEdicaoEmpresa] = useState(false);

  // Estado para Edição de Usuário / Perfil (CRUD Superusuário)
  const [usuarioParaEditar, setUsuarioParaEditar] = useState<{
    id: number;
    nome: string;
    email: string;
    senha: string;
    isSuperuser: boolean;
    ativo: boolean;
    empresaId: number;
    perfilId: number;
  } | null>(null);
  const [isSalvandoUsuario, setIsSalvandoUsuario] = useState(false);

  // Formulário Novo Administrador (Imagem 1)
  const [formNovoAdmin, setFormNovoAdmin] = useState({
    nome: '',
    email: '',
    senha: '',
    empresaId: 1,
    perfilId: 4 // Padrão: OPERADOR
  });

  const [msgFeedback, setMsgFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const showFeedback = (tipo: 'success' | 'error', texto: string) => {
    setMsgFeedback({ tipo, texto });
    toast(texto, tipo);
    setTimeout(() => setMsgFeedback(null), 5000);
  };

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

  // Selecionar primeira empresa por padrão para visualização de banco
  useEffect(() => {
    if (empresasHierarquia.length > 0 && !empresaSelecionadaId) {
      const primeiraFilial = empresasHierarquia[0].filiais?.[0];
      setEmpresaSelecionadaId(primeiraFilial ? primeiraFilial.id : empresasHierarquia[0].id);
    }
  }, [empresasHierarquia]);

  // Aplanar todas as empresas para listas e seleções
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

  // Identificar empresa atualmente selecionada no painel de integridade
  const empresaSelecionada = todasEmpresasLista.find(e => e.id === empresaSelecionadaId) || todasEmpresasLista[0];

  // Ações de Diagnóstico e Reprovisionamento
  const verificarStatusBanco = async (empresaId: number) => {
    setVerificandoBancoId(empresaId);
    try {
      const res = await fetch(`/api/global/empresas/${empresaId}/banco-status`);
      if (res.ok) {
        const data: BancoStatusInfo = await res.json();
        setBancoStatusMap(prev => ({ ...prev, [empresaId]: data }));
        showFeedback('success', `Schema '${data.schemaName}': ${data.tabelasTotal}/${data.tabelasEsperadas} tabelas validadas.`);
      }
    } catch (e) {
      showFeedback('error', 'Falha ao consultar integridade do schema.');
    } finally {
      setVerificandoBancoId(null);
    }
  };

  const reprovisionarBanco = async (empresaId: number, nome: string) => {
    if (!window.confirm(`Deseja reprovisionar/reparar o schema da empresa "${nome}"?`)) return;

    setReprovisionandoId(empresaId);
    try {
      const res = await fetch(`/api/global/empresas/${empresaId}/reprovisionar`, { method: 'POST' });
      if (res.ok) {
        showFeedback('success', `Estrutura de tabelas e DDL de "${nome}" reparada com sucesso!`);
        verificarStatusBanco(empresaId);
      } else {
        const err = await res.json();
        showFeedback('error', err.error || 'Erro ao reprovisionar schema');
      }
    } catch (e) {
      showFeedback('error', 'Erro ao conectar ao servidor de provisionamento.');
    } finally {
      setReprovisionandoId(null);
    }
  };

  // Salvar Matriz (Nova Empresa e Banco de Dados)
  const handleCriarMatriz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMatriz.nomeFantasia.trim()) return;

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
          nomeFantasia: formMatriz.nomeFantasia.trim(),
          razaoSocial: formMatriz.razaoSocial.trim() || formMatriz.nomeFantasia.trim(),
          cnpj: onlyNumbers(formMatriz.cnpj) || null,
          bancoDados: dbAuto,
          schemaName: schemaAuto,
          limiteProdutos: formMatriz.limiteProdutos ? parseInt(formMatriz.limiteProdutos, 10) : null,
          adminNome: formMatriz.adminNome.trim() || null,
          adminEmail: formMatriz.adminEmail.trim() || null,
          adminSenha: formMatriz.adminSenha.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar Matriz');
      }

      showFeedback('success', `Nova Matriz provisionada no banco '${dbAuto}' com schema '${schemaAuto}' e governança 'global'!`);
      setIsModalNovaMatrizOpen(false);
      setFormMatriz({ nomeFantasia: '', razaoSocial: '', cnpj: '', bancoDados: '', schemaName: '', limiteProdutos: '', adminNome: '', adminEmail: '', adminSenha: '' });
      await refreshEmpresas();
      await carregarUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao provisionar Matriz');
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  // Salvar Filial (Modal Imagem 2)
  const handleCriarFilial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFilial.nomeFilial.trim()) return;

    setIsSavingEmpresa(true);
    try {
      const matrizPai = empresasHierarquia.find(m => m.id === Number(formFilial.matrizId));
      const clean = formFilial.nomeFilial.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const schemaAuto = formFilial.schemaName.trim() && !formFilial.schemaName.trim().startsWith('filial_')
        ? formFilial.schemaName.trim()
        : (`db_${clean}` || 'db_filial');

      const res = await fetch('/api/global/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'FILIAL',
          matrizId: Number(formFilial.matrizId),
          nomeFantasia: formFilial.nomeFilial.trim(),
          razaoSocial: formFilial.nomeFilial.trim(),
          cnpj: onlyNumbers(formFilial.cnpj) || null,
          bancoDados: matrizPai?.bancoDados || 'bd_controle',
          schemaName: schemaAuto,
          limiteProdutos: formFilial.limiteProdutos ? parseInt(formFilial.limiteProdutos, 10) : null,
          adminNome: formFilial.adminNome.trim() || null,
          adminEmail: formFilial.adminEmail.trim() || null,
          adminSenha: formFilial.adminSenha.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar Filial');
      }

      showFeedback('success', `Nova Filial provisionada com schema '${schemaAuto}' dentro do banco '${matrizPai?.bancoDados || 'bd_controle'}'!`);
      setIsModalNovaFilialOpen(false);
      setFormFilial({
        matrizId: empresasHierarquia[0]?.id || 1,
        nomeFilial: '',
        cnpj: '',
        schemaName: '',
        limiteProdutos: '',
        provisionarAuto: true,
        adminVinculadoId: 0,
        adminNome: '',
        adminEmail: '',
        adminSenha: ''
      });
      await refreshEmpresas();
      await carregarUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao provisionar Filial');
    } finally {
      setIsSavingEmpresa(false);
    }
  };

  // Handlers CRUD Superusuário para Empresas (Editar, Exclusão Lógica e Reativar)
  const handleSalvarEdicaoEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaParaEditar) return;
    setIsSalvandoEdicaoEmpresa(true);
    try {
      const res = await fetch(`/api/global/empresas/${empresaParaEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeFantasia: empresaParaEditar.nomeFantasia.trim(),
          razaoSocial: empresaParaEditar.razaoSocial.trim() || empresaParaEditar.nomeFantasia.trim(),
          cnpj: onlyNumbers(empresaParaEditar.cnpj) || null,
          ativo: empresaParaEditar.ativo,
          limiteProdutos: empresaParaEditar.limiteProdutos ? parseInt(empresaParaEditar.limiteProdutos, 10) : 0
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao atualizar' }));
        throw new Error(err.error || 'Erro ao atualizar empresa');
      }
      showFeedback('success', `Empresa '${empresaParaEditar.nomeFantasia}' atualizada com sucesso!`);
      setEmpresaParaEditar(null);
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao atualizar empresa');
    } finally {
      setIsSalvandoEdicaoEmpresa(false);
    }
  };

  const handleExcluirLogicoEmpresa = async (id: number, nome: string, tipo: string) => {
    const isMatriz = tipo.toUpperCase() === 'MATRIZ';
    const msg = isMatriz
      ? `ATENÇÃO: A exclusão lógica da Matriz "${nome}" inativará automaticamente TODAS as suas filiais vinculadas em cascata.\n\nOs bancos e dados das empresas serão PRESERVADOS.\n\nDeseja confirmar a exclusão lógica?`
      : `Deseja realmente excluir logicamente a filial "${nome}"?\n\nOs dados operacionais serão preservados e poderão ser reativados a qualquer momento.`;

    if (!window.confirm(msg)) return;

    try {
      const res = await fetch(`/api/global/empresas/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao excluir logicamente' }));
        throw new Error(err.error || 'Erro ao excluir logicamente');
      }
      const data = await res.json();
      showFeedback('success', data.message || 'Exclusão lógica realizada com sucesso!');
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao excluir logicamente empresa');
    }
  };

  const handleReativarEmpresa = async (id: number, nome: string) => {
    if (!window.confirm(`Deseja reativar a empresa "${nome}" no sistema?`)) return;
    try {
      const res = await fetch(`/api/global/empresas/${id}/reativar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao reativar' }));
        throw new Error(err.error || 'Erro ao reativar');
      }
      const data = await res.json();
      showFeedback('success', data.message || 'Empresa reativada com sucesso!');
      await refreshEmpresas();
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao reativar empresa');
    }
  };

  // Ações de Perfis RBAC (Modal Imagem 3)
  const handleOpenNovoPerfil = () => {
    setEditingPerfilId(null);
    setFormPerfil({
      codigo: '',
      nome: '',
      descricao: '',
      permissoesSelecionadas: new Set<string>()
    });
    setModalPerfilTab('permissoes');
    setIsModalPerfilOpen(true);
  };

  const handleOpenEditarPerfil = (p: Perfil) => {
    setEditingPerfilId(p.id);
    const perms = new Set<string>(p.permissoes ? p.permissoes.split(',').map(s => s.trim()) : []);
    setFormPerfil({
      codigo: p.codigo,
      nome: p.nome,
      descricao: p.descricao || '',
      permissoesSelecionadas: perms
    });
    setModalPerfilTab('permissoes');
    setIsModalPerfilOpen(true);
  };

  const handleTogglePermissao = (permKey: string) => {
    setFormPerfil(prev => {
      const next = new Set(prev.permissoesSelecionadas);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return { ...prev, permissoesSelecionadas: next };
    });
  };

  const handleMarcarTodas = () => {
    const all = new Set<string>();
    MODULOS_RBAC.forEach(m => m.permissoes.forEach(p => all.add(p.key)));
    setFormPerfil(prev => ({ ...prev, permissoesSelecionadas: all }));
  };

  const handleLimparTodas = () => {
    setFormPerfil(prev => ({ ...prev, permissoesSelecionadas: new Set() }));
  };

  const handlePresetOperador = () => {
    const preset = new Set<string>([
      'Dashboard_Operacional',
      'Estoque_View',
      'Estoque_Ajuste',
      'Vendas_View',
      'Vendas_Create/Edit',
      'Relatorios_View'
    ]);
    setFormPerfil(prev => ({ ...prev, permissoesSelecionadas: preset }));
  };

  const handleSalvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPerfil.nome.trim()) {
      showFeedback('error', 'Nome do perfil é obrigatório');
      return;
    }

    setIsSavingPerfil(true);
    const permsStr = Array.from(formPerfil.permissoesSelecionadas).join(',');
    const cod = formPerfil.codigo.trim() || formPerfil.nome.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');

    try {
      if (editingPerfilId) {
        const res = await fetch(`/api/global/perfis/${editingPerfilId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: formPerfil.nome.trim(),
            descricao: formPerfil.descricao.trim(),
            permissoes: permsStr
          })
        });
        if (!res.ok) throw new Error('Erro ao atualizar perfil');
        showFeedback('success', 'Perfil de acesso atualizado com sucesso!');
      } else {
        const res = await fetch('/api/global/perfis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo: cod,
            nome: formPerfil.nome.trim(),
            descricao: formPerfil.descricao.trim(),
            permissoes: permsStr
          })
        });
        if (!res.ok) throw new Error('Erro ao cadastrar novo perfil');
        showFeedback('success', 'Novo perfil de acesso criado com sucesso!');
      }
      setIsModalPerfilOpen(false);
      await carregarPerfis();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao salvar perfil');
    } finally {
      setIsSavingPerfil(false);
    }
  };

  const handleExcluirPerfil = async (id: number, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o perfil "${nome}"?`)) return;
    try {
      const res = await fetch(`/api/global/perfis/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showFeedback('success', 'Perfil excluído com sucesso!');
        await carregarPerfis();
      } else {
        showFeedback('error', 'Não é permitido excluir perfis fundamentais do sistema.');
      }
    } catch {
      showFeedback('error', 'Erro ao excluir perfil');
    }
  };

  // Ações de Administradores (Modal Imagem 1)
  const handleSalvarNovoAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNovoAdmin.nome.trim() || !formNovoAdmin.email.trim() || !formNovoAdmin.senha.trim()) {
      showFeedback('error', 'Preencha todos os campos obrigatórios');
      return;
    }

    setIsSavingAdmin(true);
    try {
      const res = await fetch('/api/global/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formNovoAdmin.nome.trim(),
          email: formNovoAdmin.email.trim().toLowerCase(),
          senha: formNovoAdmin.senha.trim(),
          isSuperuser: false,
          empresaId: Number(formNovoAdmin.empresaId),
          perfilId: Number(formNovoAdmin.perfilId)
        })
      });

      if (!res.ok) throw new Error('Falha ao cadastrar administrador');

      showFeedback('success', 'Administrador cadastrado e vinculado com sucesso!');
      setIsModalNovoAdminOpen(false);
      setFormNovoAdmin({ nome: '', email: '', senha: '', empresaId: 1, perfilId: 4 });
      await carregarUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao criar administrador');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  // Conceder Acesso a Filiais Adicionais (Modal Imagem 1)
  const handleOpenConcederFiliais = (admin: UsuarioGlobal) => {
    setAdminSelecionado(admin);
    setFiliaisParaConceder([]);
    setIsModalConcederFiliaisOpen(true);
  };

  const handleToggleFilialParaConceder = (empresaId: number) => {
    setFiliaisParaConceder(prev => 
      prev.includes(empresaId) ? prev.filter(id => id !== empresaId) : [...prev, empresaId]
    );
  };

  const handleSalvarAcessosAdicionais = async () => {
    if (!adminSelecionado || filiaisParaConceder.length === 0) {
      setIsModalConcederFiliaisOpen(false);
      return;
    }

    setIsSavingAdmin(true);
    try {
      for (const empId of filiaisParaConceder) {
        await fetch('/api/global/usuarios/atribuir-empresa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuarioId: adminSelecionado.id,
            empresaId: empId,
            perfilId: 3 // GERENTE_FILIAL
          })
        });
      }
      showFeedback('success', 'Acessos adicionais concedidos com sucesso!');
      setIsModalConcederFiliaisOpen(false);
      await carregarUsuarios();
    } catch {
      showFeedback('error', 'Erro ao atribuir filiais');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleRevogarEmpresa = async (usuarioId: number, empresaId: number, empresaNome: string) => {
    if (!window.confirm(`Deseja revogar o acesso à unidade "${empresaNome}"?`)) return;

    try {
      const res = await fetch('/api/global/usuarios/desvincular-empresa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, empresaId })
      });
      if (res.ok) {
        showFeedback('success', `Acesso a "${empresaNome}" revogado com sucesso!`);
        await carregarUsuarios();
      }
    } catch {
      showFeedback('error', 'Falha ao revogar acesso');
    }
  };

  const handleRevogarTudo = async (usuario: UsuarioGlobal) => {
    if (!usuario.empresas || usuario.empresas.length === 0) return;
    if (!window.confirm(`Deseja revogar TODOS os acessos corporativos de ${usuario.nome}?`)) return;

    try {
      for (const vinculo of usuario.empresas) {
        await fetch('/api/global/usuarios/desvincular-empresa', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuarioId: usuario.id, empresaId: vinculo.empresaId })
        });
      }
      showFeedback('success', `Todos os acessos corporativos de ${usuario.nome} foram revogados.`);
      await carregarUsuarios();
    } catch {
      showFeedback('error', 'Falha ao revogar acessos');
    }
  };

  // Handlers para Edição Completa de Usuário & Perfil
  const handleOpenEditarUsuario = (u: UsuarioGlobal) => {
    const vinculo = u.empresas?.[0];
    setUsuarioParaEditar({
      id: u.id,
      nome: u.nome,
      email: u.email,
      senha: '',
      isSuperuser: u.isSuperuser || false,
      ativo: u.ativo !== false,
      empresaId: vinculo?.empresaId || empresasHierarquia[0]?.id || 1,
      perfilId: vinculo?.perfilId || 4
    });
  };

  const handleSalvarEdicaoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioParaEditar) return;
    setIsSalvandoUsuario(true);

    try {
      const res = await fetch(`/api/global/usuarios/${usuarioParaEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: usuarioParaEditar.nome.trim(),
          email: usuarioParaEditar.email.trim(),
          senha: usuarioParaEditar.senha.trim() ? usuarioParaEditar.senha.trim() : undefined,
          isSuperuser: usuarioParaEditar.isSuperuser,
          ativo: usuarioParaEditar.ativo,
          empresaId: usuarioParaEditar.empresaId,
          perfilId: usuarioParaEditar.perfilId
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar dados do usuário');
      }

      showFeedback('success', 'Usuário e perfil de acesso atualizados com sucesso!');
      setUsuarioParaEditar(null);
      await carregarUsuarios();
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao salvar edição do usuário');
    } finally {
      setIsSalvandoUsuario(false);
    }
  };

  // Listagem de Usuários / Gestores Cadastrados
  const administradores = usuarios;

  const administradoresFiltrados = administradores.filter(u => {
    if (filtroBusca.trim()) {
      const b = filtroBusca.toLowerCase();
      const match = u.nome.toLowerCase().includes(b) || u.email.toLowerCase().includes(b);
      if (!match) return false;
    }
    if (filtroEmpresa) {
      const tem = u.empresas?.some(e => e.empresaNome.toLowerCase().includes(filtroEmpresa.toLowerCase()));
      if (!tem) return false;
    }
    if (filtroPerfil) {
      const tem = u.empresas?.some(e => e.perfilNome.toLowerCase().includes(filtroPerfil.toLowerCase()) || e.perfilCodigo.toLowerCase().includes(filtroPerfil.toLowerCase()));
      if (!tem) return false;
    }
    return true;
  });

  // Usuários com acessos múltiplos / corporativos revogáveis (Seção inferior Imagem 1)
  const usuariosComAcessosCorporativos = administradores.filter(u => u.empresas && u.empresas.length > 0);

  // Se não for superusuário, bloqueia
  if (!isSuperuser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Acesso Restrito ao Superusuário (DcSys)</h1>
          <p className="text-xs text-slate-500 mb-6">
            Esta área é de gestão exclusiva da equipe de engenharia e infraestrutura DcSys.
          </p>
          <button
            type="button"
            onClick={() => { logout(); navigate('/'); }}
            className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Fazer Login com Conta DcSys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Topo / Banner Superior DcSys */}
      <div className="p-4 rounded-xl bg-[#1e293b] text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
            <img src="/precifiq.png" alt="Precifiq" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight m-0 text-white">Console DcSys Superadmin</h1>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-purple-900/60 text-purple-200 border border-purple-500/30">
                Governança & Multi-Tenant
              </span>
            </div>
            <p className="text-xs text-slate-400 m-0">
              Superusuário: <strong className="text-slate-200">{user?.nome || 'DcSys Admin'}</strong> ({user?.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => { refreshEmpresas(); carregarUsuarios(); carregarPerfis(); }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-semibold flex items-center gap-1.5 text-slate-200"
          >
            <RefreshCw size={13} className={isLoadingEmpresas || isLoadingUsuarios ? 'animate-spin' : ''} />
            <span>Sincronizar</span>
          </button>

          <Link
            to="/"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold flex items-center gap-1.5 text-white no-underline shadow-sm"
          >
            <ExternalLink size={13} />
            <span>Acessar Dashboard ERP</span>
          </Link>

          <button
            onClick={() => { logout(); navigate('/'); }}
            className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-700/50 rounded text-xs font-semibold flex items-center gap-1.5 text-red-200"
          >
            <LogOut size={13} />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {msgFeedback && (
        <div className={`p-3.5 rounded-lg flex items-center gap-2.5 text-xs font-semibold shadow-sm ${
          msgFeedback.tipo === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {msgFeedback.tipo === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
          <span>{msgFeedback.texto}</span>
        </div>
      )}

      {/* Abas Superadmin Principais (Exatamente os 3 títulos das imagens) */}
      <div className="flex border-b border-slate-300 gap-8">
        <button
          onClick={() => setActiveTab('empresas')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'empresas' ? 'border-[#1e293b] text-[#0f172a]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 size={17} />
          <span>Empresas & Estrutura de Banco de Dados</span>
        </button>

        <button
          onClick={() => setActiveTab('perfis')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'perfis' ? 'border-[#1e293b] text-[#0f172a]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck size={17} />
          <span>Perfis de Acesso & Matriz de Funcionalidades (RBAC)</span>
        </button>

        <button
          onClick={() => setActiveTab('administradores')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'administradores' ? 'border-[#1e293b] text-[#0f172a]' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={17} />
          <span>Administradores das Empresas: Visão Geral e Gestão de Acessos</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: EMPRESAS & ESTRUTURA DE BANCO DE DADOS (IMAGEM 2) */}
      {/* ========================================================================= */}
      {activeTab === 'empresas' && (
        <div className="space-y-6">
          {/* Card Superior: Estrutura de Matrizes e Filiais (Hierarquia) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800 m-0">Estrutura de Matrizes e Filiais (Hierarquia)</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalNovaMatrizOpen(true)}
                  className="px-3.5 py-1.5 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold flex items-center gap-1.5 uppercase transition-colors"
                >
                  <Plus size={14} />
                  <span>+ Nova Matriz</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalNovaFilialOpen(true)}
                  disabled={empresasHierarquia.length === 0}
                  className="px-3.5 py-1.5 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold flex items-center gap-1.5 uppercase transition-colors disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>+ Nova Filial</span>
                </button>
              </div>
            </div>

            {/* Tabela Hierárquica */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Estrutura / Nome</th>
                    <th className="py-3 px-4">Banco de Dados</th>
                    <th className="py-3 px-4">Schema</th>
                    <th className="py-3 px-4">Governança</th>
                    <th className="py-3 px-4">CNPJ</th>
                    <th className="py-3 px-4 text-center">Limite Produtos</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {empresasHierarquia.map((matriz) => {
                    const isSelected = empresaSelecionada?.id === matriz.id;

                    return (
                      <React.Fragment key={matriz.id}>
                        {/* Linha da Matriz */}
                        <tr 
                          onClick={() => setEmpresaSelecionadaId(matriz.id)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/80 font-semibold' : 'hover:bg-slate-50'}`}
                        >
                          <td className="py-3 px-4 flex items-center gap-2">
                            <FolderTree size={16} className="text-indigo-700" />
                            <div>
                              <span className="font-bold text-slate-800">{matriz.nomeFantasia}</span>
                              <span className="ml-1.5 text-[11px] text-slate-500 font-normal">(Matriz)</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {matriz.bancoDados || 'bd_controle'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-medium">
                              {matriz.schemaName}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                              global ({matriz.bancoDados || 'bd_controle'})
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{matriz.cnpj || '—'}</td>
                          <td className="py-3 px-4 text-center">
                            {matriz.limiteProdutos && matriz.limiteProdutos > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                {matriz.limiteProdutos} produtos
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-medium">Ilimitado</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {matriz.ativo ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 size={12} /> Ativa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <XCircle size={12} /> Inativa
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setEmpresaParaEditar({
                                  id: matriz.id,
                                  nomeFantasia: matriz.nomeFantasia,
                                  razaoSocial: matriz.razaoSocial || '',
                                  cnpj: matriz.cnpj || '',
                                  tipo: 'MATRIZ',
                                  schemaName: matriz.schemaName,
                                  bancoDados: matriz.bancoDados || 'bd_controle',
                                  ativo: matriz.ativo,
                                  limiteProdutos: matriz.limiteProdutos != null ? String(matriz.limiteProdutos) : ''
                                })}
                                className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Editar Matriz"
                              >
                                <Edit2 size={14} />
                              </button>
                              {matriz.ativo ? (
                                <button
                                  onClick={() => handleExcluirLogicoEmpresa(matriz.id, matriz.nomeFantasia, 'MATRIZ')}
                                  className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Exclusão Lógica da Matriz (inativa também as filiais em cascata)"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReativarEmpresa(matriz.id, matriz.nomeFantasia)}
                                  className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  title="Reativar Matriz"
                                >
                                  <RotateCcw size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Linhas das Filiais da Matriz */}
                        {matriz.filiais && matriz.filiais.map((filial) => {
                          const isFilialSelected = empresaSelecionada?.id === filial.id;

                          return (
                            <tr
                              key={filial.id}
                              onClick={() => setEmpresaSelecionadaId(filial.id)}
                              className={`cursor-pointer transition-colors ${isFilialSelected ? 'bg-indigo-100/60 font-semibold' : 'hover:bg-slate-50'}`}
                            >
                              <td className="py-2.5 px-4 pl-8 flex items-center gap-2 text-slate-700">
                                <span className="text-slate-400 font-mono">└─</span>
                                <Building2 size={14} className="text-slate-500" />
                                <span>{filial.nomeFantasia}</span>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                  {filial.bancoDados || matriz.bancoDados || 'bd_controle'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="font-mono text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                  {filial.schemaName}
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-[11px] text-slate-400 italic">
                                  global ({filial.bancoDados || matriz.bancoDados || 'bd_controle'})
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">{filial.cnpj || matriz.cnpj || '—'}</td>
                              <td className="py-2.5 px-4 text-center">
                                {filial.limiteProdutos && filial.limiteProdutos > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                    {filial.limiteProdutos} produtos
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Ilimitado</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                {filial.ativo ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <CheckCircle2 size={11} /> Ativa
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                    <XCircle size={11} /> Inativa
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setEmpresaParaEditar({
                                      id: filial.id,
                                      nomeFantasia: filial.nomeFantasia,
                                      razaoSocial: filial.razaoSocial || '',
                                      cnpj: filial.cnpj || '',
                                      tipo: 'FILIAL',
                                      schemaName: filial.schemaName,
                                      bancoDados: filial.bancoDados || matriz.bancoDados || 'bd_controle',
                                      ativo: filial.ativo,
                                      limiteProdutos: filial.limiteProdutos != null ? String(filial.limiteProdutos) : ''
                                    })}
                                    className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    title="Editar Filial"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  {filial.ativo ? (
                                    <button
                                      onClick={() => handleExcluirLogicoEmpresa(filial.id, filial.nomeFantasia, 'FILIAL')}
                                      className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                      title="Exclusão Lógica da Filial"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleReativarEmpresa(filial.id, filial.nomeFantasia)}
                                      className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                      title="Reativar Filial"
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção Inferior: Detalhes do Banco de Dados & Integridade (Imagem 2) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <Building2 size={18} className="text-slate-700" />
                  <span>{empresaSelecionada?.nomeFantasia || 'Empresa'}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {empresaSelecionada?.tipo || 'MATRIZ'}
                  </span>
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-2">
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <Database size={12} /> Banco: {empresaSelecionada?.bancoDados || 'bd_controle'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Schema: {empresaSelecionada?.schemaName}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Schema Governança: global (em {empresaSelecionada?.bancoDados || 'bd_controle'})
                  </span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Status: Concluído
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => empresaSelecionada && verificarStatusBanco(empresaSelecionada.id)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 uppercase"
                >
                  <Wrench size={12} />
                  <span>Reparar DDL</span>
                </button>
                <button
                  type="button"
                  onClick={() => empresaSelecionada && reprovisionarBanco(empresaSelecionada.id, empresaSelecionada.nomeFantasia)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 uppercase"
                >
                  <RefreshCw size={12} className={reprovisionandoId === empresaSelecionada?.id ? 'animate-spin' : ''} />
                  <span>Reprovisionar</span>
                </button>
                <button
                  type="button"
                  onClick={() => empresaSelecionada && verificarStatusBanco(empresaSelecionada.id)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 uppercase"
                >
                  <FileText size={12} />
                  <span>Logs de Criação</span>
                </button>
              </div>
            </div>

            {/* Grid 4 Quadrantes / Cards de Diagnóstico */}
            <div className="kpi-grid-4 pt-2">
              {/* Card 1: Tabelas Operacionais (16/16) */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 mb-2">Tabelas Operacionais (16/16)</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Vendas</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Compras</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Estoque</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Configurações</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Clientes</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Índices</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Orçamentos</div>
                  <div className="flex items-center gap-1 text-emerald-700 font-medium"><Check size={12} /> Razão Físico</div>
                </div>
              </div>

              {/* Card 2: Views, Sequences, Índices */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 mb-2">Views, Sequences, Índices</div>
                <div className="text-xs text-slate-600">
                  Status: <strong className="text-emerald-700">Concluídos</strong>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  (total counts shown: 0 sequences pendentes)
                </div>
              </div>

              {/* Card 3: Administrador Vinculado */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 mb-1">Administrador Vinculado</div>
                {usuarios.filter(u => u.empresas?.some(e => e.empresaId === empresaSelecionada?.id))[0] ? (
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {usuarios.filter(u => u.empresas?.some(e => e.empresaId === empresaSelecionada?.id))[0].nome}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {usuarios.filter(u => u.empresas?.some(e => e.empresaId === empresaSelecionada?.id))[0].email}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Nenhum administrador direto</div>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalNovoAdminOpen(true)}
                  className="mt-2 text-[11px] text-blue-600 hover:text-blue-800 underline font-semibold block"
                >
                  Vincular novo administrador
                </button>
              </div>

              {/* Card 4: Diagnóstico de Integridade */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 mb-1">Diagnóstico de Integridade</div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                  <CheckCircle2 size={15} />
                  <span>Status: Íntegro</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  (16/16 tabelas e objetos validados)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: PERFIS DE ACESSO & MATRIZ DE FUNCIONALIDADES RBAC (IMAGEM 3) */}
      {/* ========================================================================= */}
      {activeTab === 'perfis' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800 m-0">Perfis de Acesso Existentes</h2>
              <button
                type="button"
                onClick={handleOpenNovoPerfil}
                className="px-3.5 py-1.5 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold flex items-center gap-1.5 uppercase transition-colors"
              >
                <Plus size={14} />
                <span>+ Criar Novo Perfil</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nome do Perfil</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Nível de Acesso</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perfis.map((p) => {
                    const isFundamental = p.id <= 4;
                    const nivelAcesso = p.codigo === 'ADMIN' ? 'Total' :
                                        p.codigo === 'ADMIN_MATRIZ' ? 'Total (Matriz)' :
                                        p.codigo === 'GERENTE_FILIAL' ? 'Parcial (Filial)' :
                                        p.codigo === 'OPERADOR' ? 'Restrito' : 'Personalizado';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          {isFundamental ? (
                            <div className="p-1 rounded bg-slate-800 text-white">
                              <Lock size={12} />
                            </div>
                          ) : (
                            <div className="p-1 rounded bg-slate-700 text-white">
                              <Briefcase size={12} />
                            </div>
                          )}
                          <span>{p.nome}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Ativo
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {nivelAcesso}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditarPerfil(p)}
                              className="px-2.5 py-1 text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Editar permissões e dados deste perfil"
                            >
                              <Edit2 size={12} />
                              <span>Editar</span>
                            </button>
                            {isFundamental ? (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-semibold" title="Perfil fundamental do sistema: protegido contra exclusão">
                                Protegido
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleExcluirPerfil(p.id, p.nome)}
                                className="px-2 py-1 text-red-600 hover:bg-red-100 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Excluir perfil customizado"
                              >
                                <Trash2 size={12} />
                                <span>Excluir</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: ADMINISTRADORES DAS EMPRESAS (IMAGEM 1) */}
      {/* ========================================================================= */}
      {activeTab === 'administradores' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header da Tabela com Botões */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800 m-0">
                  Gestores Cadastrados - Tabela Filtrável por Empresa/Filial
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalNovoAdminOpen(true)}
                  className="px-3.5 py-1.5 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold flex items-center gap-1.5 uppercase transition-colors"
                >
                  <Plus size={14} />
                  <span>+ Cadastrar Novo Administrador</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (administradoresFiltrados[0]) handleOpenConcederFiliais(administradoresFiltrados[0]);
                    else setIsModalNovoAdminOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold flex items-center gap-1.5 uppercase transition-colors"
                >
                  <span>Conceder Acesso a Filiais Adicionais</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtros Múltiplos (Imagem 1) */}
            <div className="p-3 bg-slate-50/70 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Empresa</label>
                <input
                  type="text"
                  placeholder="Filtrar por Empresa: [Matriz, Filial SP...]"
                  value={filtroEmpresa}
                  onChange={(e) => setFiltroEmpresa(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs focus:ring-1 focus:ring-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filial</label>
                <input
                  type="text"
                  placeholder="Filtrar por Filial"
                  value={filtroFilial}
                  onChange={(e) => setFiltroFilial(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs focus:ring-1 focus:ring-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Perfil</label>
                <input
                  type="text"
                  placeholder="Nome/Perfil"
                  value={filtroPerfil}
                  onChange={(e) => setFiltroPerfil(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs focus:ring-1 focus:ring-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nome/Email</label>
                <input
                  type="text"
                  placeholder="Buscar por Nome ou Email"
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs focus:ring-1 focus:ring-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tabela de Gestores Cadastrados */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 text-center">Foto</th>
                    <th className="py-3 px-4">Nome Completo</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Empresa Principal</th>
                    <th className="py-3 px-4">Filial Principal</th>
                    <th className="py-3 px-4">Perfil de Acesso</th>
                    <th className="py-3 px-3 text-center">Acessos Corporativos</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {administradoresFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-500">
                        Nenhum administrador encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    administradoresFiltrados.map((admin) => {
                      const vinculoPrincipal = admin.empresas?.[0];
                      const outrosVinculos = admin.empresas?.slice(1) || [];

                      return (
                        <tr key={admin.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center">
                            <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center mx-auto text-xs">
                              {admin.nome.charAt(0).toUpperCase()}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{admin.nome}</td>
                          <td className="py-2.5 px-4 text-slate-600">{admin.email}</td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {vinculoPrincipal ? vinculoPrincipal.empresaNome : 'Matriz'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {vinculoPrincipal?.empresaTipo === 'FILIAL' ? vinculoPrincipal.empresaNome : 'Filial SP'}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span>{vinculoPrincipal?.perfilNome || vinculoPrincipal?.perfilCodigo || 'ADMIN_MATRIZ'}</span>
                              {admin.isSuperuser && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800" title="Superusuário DcSys">
                                  Super
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenConcederFiliais(admin)}
                              title="Gerenciar Filiais Corporativas"
                              className="p-1 rounded text-slate-700 hover:bg-slate-200 inline-block"
                            >
                              <Users size={15} />
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${admin.ativo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              {admin.ativo !== false ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenConcederFiliais(admin)}
                                className="p-1 rounded text-slate-600 hover:bg-slate-200"
                                title="Ver Detalhes de Filiais"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditarUsuario(admin)}
                                className="p-1 rounded text-blue-600 hover:bg-blue-100"
                                title="Editar Usuário e Perfil"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevogarTudo(admin)}
                                className="p-1 rounded text-red-600 hover:bg-red-100"
                                title="Revogar Acessos Corporativos"
                              >
                                <UserMinus size={14} />
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

          {/* Seção Inferior: Acessos Corporativos Revogáveis (Imagem 1) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 m-0">Acessos Corporativos Revogáveis</h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Usuários com múltiplos acessos e permissões delegadas entre empresas do grupo.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Foto</th>
                    <th className="py-2.5 px-4">Nome Completo</th>
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">Empresa Principal</th>
                    <th className="py-2.5 px-4">Perfil de Acesso</th>
                    <th className="py-2.5 px-3 text-center">Acessos Corporativos</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuariosComAcessosCorporativos.map((adm) => (
                    <tr key={adm.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-7 h-7 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center mx-auto text-xs">
                          {adm.nome.charAt(0).toUpperCase()}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{adm.nome}</td>
                      <td className="py-2.5 px-4 text-slate-600">{adm.email}</td>
                      <td className="py-2.5 px-4 text-slate-700">{adm.empresas?.[0]?.empresaNome || 'Matriz'}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{adm.empresas?.[0]?.perfilCodigo || 'ADMIN_MATRIZ'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Users size={14} className="text-slate-600 inline" />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Ativo
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRevogarTudo(adm)}
                          className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-[11px] font-bold uppercase transition-colors"
                        >
                          Revogar Tudo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR USUÁRIO & PERFIL DE ACESSO (CRUD SUPERUSUÁRIO) */}
      {/* ========================================================================= */}
      {usuarioParaEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-[#2b394e] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold">
                  Editar Usuário & Perfil: {usuarioParaEditar.nome}
                </h3>
              </div>
              <button
                onClick={() => setUsuarioParaEditar(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoUsuario} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={usuarioParaEditar.nome}
                  onChange={(e) => setUsuarioParaEditar({ ...usuarioParaEditar, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email de Acesso *</label>
                <input
                  type="email"
                  required
                  value={usuarioParaEditar.email}
                  onChange={(e) => setUsuarioParaEditar({ ...usuarioParaEditar, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Redefinir Senha <span className="font-normal text-slate-400 text-[11px]">(deixe em branco para manter a atual)</span>
                </label>
                <input
                  type="password"
                  placeholder="Nova senha (mínimo 4 caracteres)"
                  value={usuarioParaEditar.senha}
                  onChange={(e) => setUsuarioParaEditar({ ...usuarioParaEditar, senha: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Perfil de Acesso *</label>
                  <select
                    value={usuarioParaEditar.perfilId}
                    onChange={(e) => setUsuarioParaEditar({ ...usuarioParaEditar, perfilId: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                  >
                    {perfis.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Unidade / Empresa *</label>
                  <select
                    value={usuarioParaEditar.empresaId}
                    onChange={(e) => setUsuarioParaEditar({ ...usuarioParaEditar, empresaId: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                  >
                    {empresasHierarquia.flatMap(m => [
                      <option key={`m_${m.id}`} value={m.id}>
                        {m.nomeFantasia} (Matriz)
                      </option>,
                      ...(m.filiais || []).map(f => (
                        <option key={`f_${f.id}`} value={f.id}>
                          &nbsp;&nbsp;↳ {f.nomeFantasia} (Filial)
                        </option>
                      ))
                    ])}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border rounded-lg">
                  <input
                    type="checkbox"
                    id="chkEditAtivo"
                    checked={usuarioParaEditar.ativo}
                    onChange={(e) => setUsuarioParaEditar({ ...usuarioParaEditar, ativo: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <label htmlFor="chkEditAtivo" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Usuário Ativo (acesso liberado ao sistema)
                  </label>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="chkEditSuper"
                    checked={usuarioParaEditar.isSuperuser}
                    onChange={(e) => setUsuarioParaEditar({ ...usuarioParaEditar, isSuperuser: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <label htmlFor="chkEditSuper" className="text-xs font-bold text-purple-900 cursor-pointer">
                    Superusuário DcSys (Acesso irrestrito à governança global)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setUsuarioParaEditar(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSalvandoUsuario}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {isSalvandoUsuario ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Salvar Usuário & Perfil</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR PERFIL RBAC (IMAGEM 3) */}
      {/* ========================================================================= */}
      {isModalPerfilOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            {/* Topo Dark Slate */}
            <div className="p-4 bg-[#2b394e] text-white flex justify-between items-center">
              <h3 className="text-sm font-bold m-0">Criar / Editar Perfil de Acesso (RBAC)</h3>
              <button onClick={() => setIsModalPerfilOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarPerfil} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Perfil Name</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Financeiro"
                  value={formPerfil.nome}
                  onChange={(e) => setFormPerfil(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-medium"
                />
              </div>

              {/* Abas Internas: Geral | Permissões */}
              <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setModalPerfilTab('geral')}
                  className={`pb-2 border-b-2 ${modalPerfilTab === 'geral' ? 'border-[#2b394e] text-slate-900' : 'border-transparent text-slate-400'}`}
                >
                  Geral
                </button>
                <button
                  type="button"
                  onClick={() => setModalPerfilTab('permissoes')}
                  className={`pb-2 border-b-2 ${modalPerfilTab === 'permissoes' ? 'border-[#2b394e] text-slate-900' : 'border-transparent text-slate-400'}`}
                >
                  Permissões
                </button>

                {/* Botões de Ação em Lote */}
                <div className="ml-auto flex gap-1.5 pb-1">
                  <button
                    type="button"
                    onClick={handleMarcarTodas}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[10px] font-bold"
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    onClick={handleLimparTodas}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[10px] font-bold"
                  >
                    Limpar Todas
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetOperador}
                    title="Automatically selects a logical set of OPERADOR-level"
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[10px] font-bold"
                  >
                    Preset Operacional Padrão
                  </button>
                </div>
              </div>

              {/* Grid 2 Colunas com Caixas Modulares (Imagem 3) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {MODULOS_RBAC.map((mod) => (
                  <div key={mod.titulo} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50">
                    <div className="font-bold text-slate-800 text-[11px] mb-2 flex items-center gap-1.5">
                      <span>{mod.icone}</span>
                      <span>{mod.titulo}</span>
                    </div>

                    <div className="space-y-1.5">
                      {mod.permissoes.map((p) => {
                        const isChecked = formPerfil.permissoesSelecionadas.has(p.key);

                        return (
                          <label key={p.key} className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermissao(p.key)}
                              className="w-3.5 h-3.5 rounded text-blue-600"
                            />
                            <span>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSavingPerfil}
                  className="px-4 py-2 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold uppercase transition-colors"
                >
                  Salvar Alterações
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalPerfilOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CADASTRAR NOVO ADMINISTRADOR (IMAGEM 1) */}
      {/* ========================================================================= */}
      {isModalNovoAdminOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden">
            {/* Topo Dark Slate */}
            <div className="p-4 bg-[#2b394e] text-white flex justify-between items-center">
              <h3 className="text-sm font-bold m-0">Cadastrar Novo Administrador</h3>
              <button onClick={() => setIsModalNovoAdminOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoAdmin} className="p-5 space-y-4 text-xs">
              {/* Bloco 1: Dados do Gestor */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 border-b pb-1">
                  <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px]">1</span>
                  <span>Dados do Gestor</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Nome"
                      value={formNovoAdmin.nome}
                      onChange={(e) => setFormNovoAdmin(prev => ({ ...prev, nome: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      value={formNovoAdmin.email}
                      onChange={(e) => setFormNovoAdmin(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="password"
                    required
                    placeholder="Senha"
                    value={formNovoAdmin.senha}
                    onChange={(e) => setFormNovoAdmin(prev => ({ ...prev, senha: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Bloco 2: Empresa & Perfil */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 border-b pb-1">
                  <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px]">2</span>
                  <span>Empresa & Perfil</span>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Empresa/Filial</label>
                  <select
                    value={formNovoAdmin.empresaId}
                    onChange={(e) => setFormNovoAdmin(prev => ({ ...prev, empresaId: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white"
                  >
                    {todasEmpresasLista.map(e => (
                      <option key={e.id} value={e.id}>{e.nomeFantasia} ({e.tipo})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Perfil</label>
                  <select
                    value={formNovoAdmin.perfilId}
                    onChange={(e) => setFormNovoAdmin(prev => ({ ...prev, perfilId: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white"
                  >
                    {perfis.map(p => (
                      <option key={p.id} value={p.id}>{p.nome} ({p.codigo})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalNovoAdminOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdmin}
                  className="px-4 py-2 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
                >
                  {isSavingAdmin ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Concluir Cadastro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONCEDER ACESSO A FILIAIS ADICIONAIS (IMAGEM 1) */}
      {/* ========================================================================= */}
      {isModalConcederFiliaisOpen && adminSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden">
            {/* Topo Dark Slate */}
            <div className="p-4 bg-[#2b394e] text-white flex justify-between items-center">
              <h3 className="text-sm font-bold m-0">Conceder Acesso a Filiais Adicionais</h3>
              <button onClick={() => setIsModalConcederFiliaisOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-2.5 bg-slate-100 rounded border border-slate-200">
                <div className="font-bold text-slate-800">Usuário: {adminSelecionado.nome}</div>
                <div className="text-[11px] text-slate-500">{adminSelecionado.email}</div>
              </div>

              {/* Bloco 1: Selecionar Filiais para Conceder Acesso */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Selecionar Filiais para Conceder Acesso
                </label>
                <div className="border border-slate-200 rounded p-2 max-h-32 overflow-y-auto space-y-1.5 bg-slate-50/50">
                  {todasEmpresasLista.map(emp => {
                    const jaTem = adminSelecionado.empresas?.some(v => v.empresaId === emp.id);
                    const isChecked = filiaisParaConceder.includes(emp.id);

                    return (
                      <label 
                        key={emp.id} 
                        className={`flex items-center gap-2 text-xs cursor-pointer p-1 rounded ${jaTem ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-100'}`}
                      >
                        <input
                          type="checkbox"
                          disabled={jaTem}
                          checked={isChecked || jaTem}
                          onChange={() => handleToggleFilialParaConceder(emp.id)}
                          className="w-3.5 h-3.5 rounded text-blue-600"
                        />
                        <span>{emp.nomeFantasia} ({emp.tipo})</span>
                        {jaTem && <span className="ml-auto text-[10px] text-slate-400">Já atribuída</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Bloco 2: Filiais com Acesso Atual */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Filiais com Acesso Atual
                </label>
                <div className="border border-slate-200 rounded p-2 max-h-32 overflow-y-auto space-y-1.5 bg-slate-50/50">
                  {adminSelecionado.empresas && adminSelecionado.empresas.length > 0 ? (
                    adminSelecionado.empresas.map(vinculo => (
                      <div key={vinculo.empresaId} className="flex items-center justify-between text-xs p-1 rounded hover:bg-slate-100">
                        <div className="flex items-center gap-2">
                          <CheckSquare size={13} className="text-slate-600" />
                          <span>{vinculo.empresaNome}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevogarEmpresa(adminSelecionado.id, vinculo.empresaId, vinculo.empresaNome)}
                          title="Revogar Acesso desta Filial"
                          className="text-red-600 hover:text-red-800 p-0.5"
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400 py-1 text-center">Nenhum acesso ativo no momento.</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalConcederFiliaisOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarAcessosAdicionais}
                  disabled={isSavingAdmin || filiaisParaConceder.length === 0}
                  className="px-4 py-2 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold uppercase transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingAdmin ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Salvar Acessos Adicionais</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRAR NOVA MATRIZ (BANCO DE DADOS DEDICADO) */}
      {/* ========================================================================= */}
      {isModalNovaMatrizOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 bg-[#2b394e] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-blue-300" />
                <h3 className="text-sm font-bold m-0">Cadastrar Nova Matriz (Banco Dedicado)</h3>
              </div>
              <button onClick={() => setIsModalNovaMatrizOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCriarMatriz} className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Banner Informativo sobre Arquitetura de Banco e Schema */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-[11px]">
                  <Database size={13} className="text-blue-700" />
                  <span>Arquitetura de Banco & Governança DcSys</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed m-0">
                  O nome da empresa define o <strong>banco de dados PostgreSQL</strong> (ex.: <code>bd_controle</code>).
                  A Matriz opera no schema <code>matriz</code> (ou <code>controle</code>), e o schema <code>global</code> de governança/autenticação é criado dentro deste mesmo banco.
                </p>
              </div>

              {/* Bloco 1: Dados da Empresa */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 border-b pb-1">
                  <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px]">1</span>
                  <span>Identificação da Empresa Matriz</span>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-bold block mb-1">Nome Fantasia da Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Controle Silvia"
                    value={formMatriz.nomeFantasia}
                    onChange={(e) => {
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
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Razão Social</label>
                    <input
                      type="text"
                      placeholder="Razão Social Ltda"
                      value={formMatriz.razaoSocial}
                      onChange={(e) => setFormMatriz(prev => ({ ...prev, razaoSocial: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">CNPJ</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={formMatriz.cnpj}
                      onChange={(e) => setFormMatriz(prev => ({ ...prev, cnpj: (e.target.value = maskCnpj(e.target.value)) }))}
                      maxLength={18}
                      inputMode="numeric"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">
                      Limite Produtos <span className="font-normal text-slate-400">(vazio=ilimitado)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ex: 50"
                      value={formMatriz.limiteProdutos}
                      onChange={(e) => setFormMatriz(prev => ({ ...prev, limiteProdutos: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Bloco 2: Banco de Dados e Schemas */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 border-b pb-1">
                  <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px]">2</span>
                  <span>Configuração do Banco e Schemas</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Nome do Banco de Dados</label>
                    <input
                      type="text"
                      required
                      value={formMatriz.bancoDados}
                      onChange={(e) => setFormMatriz(prev => ({ ...prev, bancoDados: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono bg-slate-50 font-bold text-blue-700"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Convenção: bd_&lt;empresa&gt;</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Schema da Matriz</label>
                    <input
                      type="text"
                      required
                      value={formMatriz.schemaName}
                      onChange={(e) => setFormMatriz(prev => ({ ...prev, schemaName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono bg-slate-50 font-bold text-purple-700"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Padrão: db_&lt;empresa&gt; (ex.: db_galeriavagalume)</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                  <Shield size={14} className="text-amber-700 shrink-0" />
                  <span><strong>Schema de Governança:</strong> O schema <code>global</code> ficará hospedado no banco <code>{formMatriz.bancoDados || 'bd_controle'}</code>.</span>
                </div>
              </div>

              {/* Bloco 3: Administrador Inicial */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 border-b pb-1">
                  <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px]">3</span>
                  <span>Administrador Inicial da Matriz</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Nome do Gestor</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Gerente"
                      value={formMatriz.adminNome}
                      onChange={(e) => setFormMatriz(prev => ({ ...prev, adminNome: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="carlos@empresa.com"
                      value={formMatriz.adminEmail}
                      onChange={(e) => setFormMatriz(prev => ({ ...prev, adminEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-bold block mb-1">Senha Provisória</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formMatriz.adminSenha}
                    onChange={(e) => setFormMatriz(prev => ({ ...prev, adminSenha: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalNovaMatrizOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmpresa}
                  className="px-4 py-2 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
                >
                  {isSavingEmpresa ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Provisionar Matriz</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRAR NOVA FILIAL (SCHEMA ISOLADO NO BANCO DA MATRIZ) */}
      {/* ========================================================================= */}
      {isModalNovaFilialOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 bg-[#2b394e] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-teal-300" />
                <h3 className="text-sm font-bold m-0">Cadastrar Nova Filial (Schema Isolado)</h3>
              </div>
              <button onClick={() => setIsModalNovaFilialOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCriarFilial} className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Informação sobre Arquitetura de Filial */}
              {(() => {
                const matrizPai = empresasHierarquia.find(m => m.id === Number(formFilial.matrizId)) || empresasHierarquia[0];
                const dbPai = matrizPai?.bancoDados || 'bd_controle';

                return (
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-[11px]">
                      <Server size={13} className="text-teal-700" />
                      <span>Hospedagem no Banco da Empresa Matriz</span>
                    </div>
                    <p className="text-[11px] text-teal-800 leading-relaxed m-0">
                      A filial é criada no banco <strong>{dbPai}</strong> sob o schema dedicado (ex.: <code>filial_shopping</code>).
                      A governança global e autenticação continuam centralizadas no schema <code>global</code> deste banco.
                    </p>
                  </div>
                );
              })()}

              {/* Bloco 1: Matriz e Nome da Filial */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 border-b pb-1">
                  <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px]">1</span>
                  <span>Matriz e Identificação da Filial</span>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-bold block mb-1">Matriz Controladora *</label>
                  <select
                    value={formFilial.matrizId}
                    onChange={(e) => setFormFilial(prev => ({ ...prev, matrizId: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs bg-white"
                  >
                    {empresasHierarquia.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nomeFantasia} (Banco: {m.bancoDados || 'bd_controle'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-bold block mb-1">Nome Fantasia da Filial *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Filial Shopping Teste"
                    value={formFilial.nomeFilial}
                    onChange={(e) => {
                      const val = e.target.value;
                      const clean = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                      setFormFilial(prev => ({
                        ...prev,
                        nomeFilial: val,
                        schemaName: clean ? `db_${clean}` : ''
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Schema da Filial (PostgreSQL)</label>
                    <input
                      type="text"
                      required
                      placeholder="db_filialshopping"
                      value={formFilial.schemaName}
                      onChange={(e) => setFormFilial(prev => ({ ...prev, schemaName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono bg-slate-50 font-bold text-teal-700"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Convenção: db_&lt;nome&gt;</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">CNPJ da Filial</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0002-00"
                      value={formFilial.cnpj}
                      onChange={(e) => setFormFilial(prev => ({ ...prev, cnpj: (e.target.value = maskCnpj(e.target.value)) }))}
                      maxLength={18}
                      inputMode="numeric"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-bold block mb-1">
                    Limite de Produtos <span className="font-normal text-slate-400">(vazio=ilimitado)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ex: 50 (ou deixe vazio para ilimitado)"
                    value={formFilial.limiteProdutos}
                    onChange={(e) => setFormFilial(prev => ({ ...prev, limiteProdutos: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Bloco 2: Administrador da Filial (Opcional) */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 border-b pb-1">
                  <span className="w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px]">2</span>
                  <span>Gestor da Filial (Opcional)</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Nome do Gestor</label>
                    <input
                      type="text"
                      placeholder="Ex: Mariana Gerente"
                      value={formFilial.adminNome}
                      onChange={(e) => setFormFilial(prev => ({ ...prev, adminNome: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="mariana@empresa.com"
                      value={formFilial.adminEmail}
                      onChange={(e) => setFormFilial(prev => ({ ...prev, adminEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-600 font-bold block mb-1">Senha Provisória</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formFilial.adminSenha}
                    onChange={(e) => setFormFilial(prev => ({ ...prev, adminSenha: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalNovaFilialOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmpresa}
                  className="px-4 py-2 bg-[#2b394e] hover:bg-[#1e293b] text-white rounded text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
                >
                  {isSavingEmpresa ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Provisionar Filial</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Empresa / Filial (CRUD Superusuário) */}
      {empresaParaEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-[#2b394e] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold">
                  Editar {empresaParaEditar.tipo === 'MATRIZ' ? 'Matriz' : 'Filial'}: {empresaParaEditar.nomeFantasia}
                </h3>
              </div>
              <button
                onClick={() => setEmpresaParaEditar(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoEmpresa} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  value={empresaParaEditar.nomeFantasia}
                  onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, nomeFantasia: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Razão Social</label>
                  <input
                    type="text"
                    value={empresaParaEditar.razaoSocial}
                    onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, razaoSocial: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={empresaParaEditar.cnpj}
                    onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, cnpj: maskCnpj(e.target.value) })}
                    maxLength={18}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Limite de Cadastro de Produtos <span className="font-normal text-slate-400 text-[11px]">(deixe vazio ou 0 para ilimitado)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Ex: 50 (vazio = ilimitado)"
                  value={empresaParaEditar.limiteProdutos}
                  onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, limiteProdutos: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Define a cota máxima de produtos que esta empresa pode cadastrar. Apenas o Superusuário pode alterar.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Schema PostgreSQL (Isolado)</label>
                  <span className="font-mono text-xs text-purple-800 font-bold">{empresaParaEditar.schemaName}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Banco de Dados</label>
                  <span className="font-mono text-xs text-blue-800 font-bold">{empresaParaEditar.bancoDados}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 border rounded-lg">
                <input
                  type="checkbox"
                  id="chkAtivoEmpresa"
                  checked={empresaParaEditar.ativo}
                  onChange={(e) => setEmpresaParaEditar({ ...empresaParaEditar, ativo: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="chkAtivoEmpresa" className="text-xs font-bold text-slate-800 cursor-pointer">
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
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors"
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

export default SuperAdminPage;
