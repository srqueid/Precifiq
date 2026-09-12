import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Ruler, 
  ShoppingBag, 
  ClipboardList, 
  Settings, 
  Moon, 
  Sun, 
  Monitor, 
  Menu, 
  X, 
  ShoppingCart, 
  Warehouse, 
  FileText, 
  Truck, 
  LucideIcon, 
  PackagePlus, 
  Sparkles, 
  Building2, 
  ChevronDown, 
  Check, 
  GitFork, 
  ShieldCheck, 
  LogOut,
  KeyRound 
} from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import { useTenant, EmpresaItem } from './contexts/TenantContext';
import { useAuth } from './contexts/AuthContext';
import AlterarSenhaModal from './components/AlterarSenhaModal';
import packageJson from '../package.json';
import precifiqLogo from './assets/precifiq.png';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenCopilot?: () => void;
}

interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

// Error Boundary local para evitar que falhas em contextos ocultem a barra de navegação
class SidebarErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Sidebar error boundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <aside className="sidebar" style={{ padding: '16px', color: 'var(--text)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <img src={precifiqLogo} alt="Precifiq" style={{ width: '28px', height: '28px' }} />
            <span style={{ fontWeight: 800 }}>Precifiq</span>
          </div>
          <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>
            Ocorreu uma instabilidade visual na barra lateral.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            Recarregar Navegação
          </button>
        </aside>
      );
    }
    return this.props.children;
  }
}

const SidebarInner: React.FC<SidebarProps> = ({ isOpen, onToggle, onClose, onOpenCopilot }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { activeCompany, empresasHierarquia, selectCompany } = useTenant();
  const { user, isSuperuser, logout } = useAuth();
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isAlterarSenhaOpen, setIsAlterarSenhaOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const appVersion = packageJson?.version || '0.1.0';

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActivePath = (path: string) => {
    if (location.pathname === path) return true;
    if (path === '/pedido') {
      return location.pathname === '/pedido' || location.pathname.startsWith('/pedido/');
    }
    return false;
  };

  // Garante array válido mesmo em caso de erro na resposta do backend
  const safeHierarquia = Array.isArray(empresasHierarquia) ? empresasHierarquia : [];

  // 1. Visão Geral / Principal
  const overviewItems: MenuItem[] = [
    ...(isSuperuser ? [{ path: '/superadmin', label: 'Superadmin DcSys', icon: ShieldCheck }] : []),
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  ];

  // 2. Grupo de PRODUTOS (EM DESTAQUE) - Sequência solicitada pelo usuário:
  // 1 - Pedido de clientes
  // 2 - produtos
  // 3 - Kits
  // 4 - Estoque de produtos
  const productItems: MenuItem[] = [
    { path: '/pedido', label: 'Pedido de clientes', icon: FileText },
    { path: '/produtos', label: 'Produtos', icon: ShoppingBag },
    { path: '/kits', label: 'Kits', icon: PackagePlus },
    { path: '/estoque', label: 'Estoque de produtos', icon: Warehouse },
  ];

  // 3. Suprimentos & Compras
  const supplyItems: MenuItem[] = [
    { path: '/insumos', label: 'Estoque de Insumos', icon: Package },
    { path: '/pedidos', label: 'Pedidos de Compra', icon: Truck },
    { path: '/compras', label: 'Compras', icon: ShoppingCart },
    { path: '/fornecedores', label: 'Fornecedores', icon: Users },
    { path: '/orcamentos', label: 'Orçamentos', icon: ClipboardList },
  ];

  // 4. Cadastros & Governança
  const systemItems: MenuItem[] = [
    { path: '/unidades', label: 'Unidades de Medida', icon: Ruler },
    ...(isSuperuser ? [{ path: '/gestao-global', label: 'Gestão Global', icon: Building2 }] : []),
    { path: '/configuracoes', label: 'Configurações', icon: Settings },
  ];

  // Renderiza um link padrão da navegação
  const renderStandardLink = (item: MenuItem, isMobile = false) => {
    const Icon = item.icon;
    const isActive = isActivePath(item.path);
    const isGestaoGlobal = item.path === '/gestao-global';
    const isSuperadmin = item.path === '/superadmin';

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onClose}
        className={`sidebar-link ${isActive ? 'active' : ''}`}
        role={isMobile ? 'menuitem' : undefined}
        aria-current={isActive ? 'page' : undefined}
        style={isSuperadmin ? {
          background: isActive ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.22) 0%, rgba(79, 70, 229, 0.22) 100%)' : 'rgba(124, 58, 237, 0.08)',
          border: '1px solid rgba(124, 58, 237, 0.25)',
          color: '#7c3aed',
          fontWeight: 700
        } : undefined}
      >
        <Icon size={isMobile ? 20 : 18} style={isSuperadmin ? { color: '#7c3aed' } : undefined} />
        <span>{item.label}</span>
        {isSuperadmin && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '9px',
            fontWeight: 800,
            background: '#7c3aed',
            color: '#ffffff',
            padding: '2px 6px',
            borderRadius: '4px',
            letterSpacing: '0.4px'
          }}>
            ROOT
          </span>
        )}
        {isGestaoGlobal && isSuperuser && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '9px',
            fontWeight: 700,
            background: 'rgba(147, 51, 234, 0.15)',
            color: '#7c3aed',
            padding: '2px 5px',
            borderRadius: '4px',
            letterSpacing: '0.4px'
          }}>
            DCSYS
          </span>
        )}
      </Link>
    );
  };

  // Renderiza o grupo de destaque com as 4 funções de produtos na sequência requerida
  const renderProductHighlightGroup = (isMobile = false) => {
    return (
      <div className="sidebar-products-group" role="region" aria-label="Gestão de Produtos">
        <div className="sidebar-products-header">
          <div className="sidebar-products-header-title">
            <Sparkles size={12} />
            <span>Produtos & Operação</span>
          </div>
          <span className="sidebar-products-badge">Destaque</span>
        </div>

        {productItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`sidebar-products-link ${isActive ? 'active' : ''}`}
              role={isMobile ? 'menuitem' : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="sidebar-products-link-icon-box">
                <Icon size={isMobile ? 18 : 16} />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
      {/* Topo / Header com Logotipo */}
      <div className="sidebar-header">
        <button
          className="sidebar-menu-button"
          onClick={onToggle}
          aria-label="Alternar Menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="sidebar-brand" aria-label="Precifiq - Sistema de Gestão e Precificação" title="Precifiq - Sistema de Gestão e Precificação">
          <div className="sidebar-logo-container" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src={precifiqLogo} 
              alt="Logo Precifiq" 
              style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <div className="sidebar-title" style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2 }}>Precifiq</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, lineHeight: 1.2 }}>
              Sistema de Gestão e Precificação
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar-body">
        {/* Seletor Corporativo de Empresa (Company Switcher) */}
        <div className="sidebar-company-switcher-wrapper" ref={dropdownRef} style={{ padding: '8px 12px', position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2, rgba(0,0,0,0.03))',
              color: 'var(--text)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            title="Alternar entre Matriz e Filiais"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div style={{
                padding: '4px',
                borderRadius: '6px',
                background: activeCompany?.tipo === 'MATRIZ' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: activeCompany?.tipo === 'MATRIZ' ? '#2563eb' : '#059669',
                display: 'flex'
              }}>
                {activeCompany?.tipo === 'MATRIZ' ? <Building2 size={16} /> : <GitFork size={16} />}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '140px' }}>
                    {activeCompany?.nomeFantasia || 'Selecione uma empresa'}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary, #64748b)', fontFamily: 'monospace' }}>
                  {activeCompany ? `${activeCompany.tipo === 'MATRIZ' ? 'MATRIZ' : 'FILIAL'} • ${activeCompany.schemaName || 'default'}` : 'Nenhuma empresa ativa'}
                </div>
              </div>
            </div>
            <ChevronDown size={14} style={{ opacity: 0.7, transform: isCompanyDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </button>

          {/* Menu Dropdown de Seleção de Filiais */}
          {isCompanyDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '12px',
              right: '12px',
              zIndex: 100,
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '6px 0'
            }}>
              <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #94a3b8)', letterSpacing: '0.5px' }}>
                Organização & Unidades
              </div>

              {safeHierarquia.map((matriz) => {
                const isSelectedMatriz = activeCompany?.id === matriz.id && activeCompany?.tipo === 'MATRIZ';
                const filiais = Array.isArray(matriz.filiais) ? matriz.filiais : [];

                return (
                  <div key={matriz.id} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        selectCompany({
                          id: matriz.id,
                          tipo: matriz.tipo,
                          nomeFantasia: matriz.nomeFantasia,
                          razaoSocial: matriz.razaoSocial,
                          cnpj: matriz.cnpj,
                          schemaName: matriz.schemaName,
                          ativo: matriz.ativo
                        });
                        setIsCompanyDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isSelectedMatriz ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: isSelectedMatriz ? '#2563eb' : 'inherit',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={13} style={{ color: '#2563eb' }} />
                        <span>{matriz.nomeFantasia}</span>
                        <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>MATRIZ</span>
                      </div>
                      {isSelectedMatriz && <Check size={14} style={{ color: '#2563eb' }} />}
                    </button>

                    {/* Filiais */}
                    {filiais.map(filial => {
                      const isSelectedFilial = activeCompany?.id === filial.id && activeCompany?.tipo === 'FILIAL';

                      return (
                        <button
                          key={filial.id}
                          type="button"
                          onClick={() => {
                            selectCompany(filial);
                            setIsCompanyDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '5px 12px 5px 26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isSelectedFilial ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: isSelectedFilial ? '#059669' : 'inherit',
                            textAlign: 'left',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <GitFork size={12} style={{ color: '#059669' }} />
                            <span>{filial.nomeFantasia}</span>
                            <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>FILIAL</span>
                          </div>
                          {isSelectedFilial && <Check size={13} style={{ color: '#059669' }} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {isSuperuser && (
                <div style={{ padding: '6px 12px 2px', borderTop: '1px solid var(--border)' }}>
                  <Link
                    to="/superadmin"
                    onClick={() => { setIsCompanyDropdownOpen(false); onClose(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#7c3aed',
                      textDecoration: 'none',
                      padding: '4px 0'
                    }}
                  >
                    <ShieldCheck size={12} style={{ color: '#7c3aed' }} />
                    <span>Console Superadmin (DcSys)</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botão de Destaque para o Copilot IA (Spotlight) */}
        <div className="sidebar-copilot-wrapper">
          <button
            type="button"
            onClick={onOpenCopilot}
            className="sidebar-copilot-btn"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} />
              <span>Copilot IA</span>
            </div>
            <kbd className="sidebar-copilot-kbd">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Navegação Desktop com Seções & Destaque Especial */}
        <nav className="sidebar-nav" aria-label="Menu principal">
          {/* 1. Visão Geral / Principal */}
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Principal</span>
          </div>
          {overviewItems.map((item) => renderStandardLink(item))}

          {/* 2. Produtos & Operação (DESTAQUE DA SEQUENCIA PEDIDA) */}
          {renderProductHighlightGroup()}

          {/* 3. Suprimentos & Compras */}
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Suprimentos & Compras</span>
          </div>
          {supplyItems.map((item) => renderStandardLink(item))}

          {/* 4. Cadastros & Sistema */}
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Cadastros & Sistema</span>
          </div>
          {systemItems.map((item) => renderStandardLink(item))}
        </nav>

        {/* Card do Usuário Logado & Botão Sair / Trocar Conta */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginTop: 'auto',
          background: 'var(--surface, rgba(0,0,0,0.02))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            {user?.fotoUrl ? (
              <img
                src={user.fotoUrl}
                alt={user?.nome || 'Usuário'}
                referrerPolicy="no-referrer"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  flexShrink: 0
                }}
              />
            ) : (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: isSuperuser ? '#7c3aed' : '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0
              }}>
                {user?.nome ? user.nome.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
              </div>
            )}
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.nome || 'Usuário'}
              </div>
              <div style={{ fontSize: '9px', color: isSuperuser ? '#7c3aed' : 'var(--text-secondary, #64748b)', fontWeight: isSuperuser ? 700 : 500 }}>
                {isSuperuser ? 'Superusuário DcSys' : (user?.email || 'Colaborador')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setIsAlterarSenhaOpen(true)}
              title="Alterar Senha"
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary, #64748b)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <KeyRound size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sair / Trocar Conta"
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary, #64748b)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* Rodapé com Seletor de Tema */}
        <div className="sidebar-footer" role="group" aria-label="Seletor de tema">
          <div className="sidebar-version-tag">v{appVersion}</div>
          <div className="theme-buttons-wrapper">
            <button
              onClick={() => setTheme('light')}
              className={`sidebar-theme-button ${theme === 'light' ? 'active' : ''}`}
              title="Modo Claro"
              aria-label="Modo claro"
              aria-pressed={theme === 'light'}
            >
              <Sun size={16} />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`sidebar-theme-button ${theme === 'dark' ? 'active' : ''}`}
              title="Modo Escuro"
              aria-label="Modo escuro"
              aria-pressed={theme === 'dark'}
            >
              <Moon size={16} />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`sidebar-theme-button ${theme === 'system' ? 'active' : ''}`}
              title="Automático (Sistema)"
              aria-label="Tema automático do sistema"
              aria-pressed={theme === 'system'}
            >
              <Monitor size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      <div className="sidebar-mobile-menu" role="menu" aria-label="Menu mobile">
        <nav className="sidebar-mobile-menu-inner" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* 1. Visão Geral */}
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Principal</span>
          </div>
          {overviewItems.map((item) => renderStandardLink(item, true))}

          {/* 2. Produtos & Operação (DESTAQUE) */}
          {renderProductHighlightGroup(true)}

          {/* 3. Suprimentos & Compras */}
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Suprimentos & Compras</span>
          </div>
          {supplyItems.map((item) => renderStandardLink(item, true))}

          {/* 4. Cadastros & Sistema */}
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Cadastros & Sistema</span>
          </div>
          {systemItems.map((item) => renderStandardLink(item, true))}
        </nav>

        {/* Rodapé do Usuário & Logout no Mobile */}
        {user && (
          <div style={{
            marginTop: 'auto',
            padding: '12px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            backgroundColor: 'var(--surface-2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isSuperuser ? '#7c3aed' : 'var(--accent)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0
              }}>
                {user?.nome ? user.nome.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user?.nome || 'Usuário'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {isSuperuser ? 'Superusuário DcSys' : (user?.email || 'Colaborador')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsAlterarSenhaOpen(true);
                }}
                title="Alterar Senha"
                style={{
                  padding: '6px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <KeyRound size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                  navigate('/login');
                }}
                title="Sair / Trocar Conta"
                className="btn-action-danger"
                style={{
                  padding: '6px',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Modal de Alteração de Senha */}
      <AlterarSenhaModal isOpen={isAlterarSenhaOpen} onClose={() => setIsAlterarSenhaOpen(false)} />
    </aside>
  );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  return (
    <SidebarErrorBoundary>
      <SidebarInner {...props} />
    </SidebarErrorBoundary>
  );
};

export default Sidebar;