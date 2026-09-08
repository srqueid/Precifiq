import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Package, Ruler, ShoppingBag, ClipboardList, Settings, Moon, Sun, Monitor, Menu, X, ShoppingCart, Warehouse, FileText, Truck, Landmark, LucideIcon, PackagePlus, Sparkles, Building2, ChevronDown, Check, GitFork } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import { useTenant, EmpresaItem } from './contexts/TenantContext';
import packageJson from '../package.json';

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

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onClose, onOpenCopilot }) => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { activeCompany, empresasHierarquia, selectCompany } = useTenant();
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const appVersion = packageJson.version;

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
    if (path === '/pedido') return location.pathname.startsWith('/pedido');
    return false;
  };

  const menuItems: MenuItem[] = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/fornecedores', label: 'Fornecedores', icon: Users },
    { path: '/insumos', label: 'Estoque de Insumos', icon: Package },
    { path: '/estoque', label: 'Estoque de Produtos', icon: Warehouse },
    { path: '/unidades', label: 'Unidades de Medida', icon: Ruler },
    { path: '/produtos', label: 'Produtos', icon: ShoppingBag },
    { path: '/kits', label: 'Kits', icon: PackagePlus },
    { path: '/orcamentos', label: 'Orçamentos', icon: ClipboardList },
    { path: '/pedido', label: 'Pedidos de Clientes', icon: FileText },
    { path: '/pedidos', label: 'Pedidos de Compra', icon: Truck },
    { path: '/compras', label: 'Compras', icon: ShoppingCart },
    { path: '/gestao-global', label: 'Gestão Global', icon: Building2 },
    { path: '/configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
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
          <div className="sidebar-logo" aria-hidden="true">PQ</div>
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
                    {activeCompany?.nomeFantasia || 'Selecione...'}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary, #64748b)', fontFamily: 'monospace' }}>
                  {activeCompany?.tipo === 'MATRIZ' ? 'MATRIZ' : 'FILIAL'} • {activeCompany?.schemaName}
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

              {empresasHierarquia.map((matriz) => {
                const isSelectedMatriz = activeCompany?.id === matriz.id && activeCompany?.tipo === 'MATRIZ';

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
                    {matriz.filiais && matriz.filiais.map(filial => {
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

              <div style={{ padding: '6px 12px 2px', borderTop: '1px solid var(--border)' }}>
                <Link
                  to="/gestao-global"
                  onClick={() => { setIsCompanyDropdownOpen(false); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#2563eb',
                    textDecoration: 'none',
                    padding: '4px 0'
                  }}
                >
                  <Settings size={12} />
                  <span>Gerenciar Matrizes & Filiais</span>
                </Link>
              </div>
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

        <nav className="sidebar-nav" aria-label="Menu principal">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

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

      <div className="sidebar-mobile-menu" role="menu" aria-label="Menu mobile">
        <nav className="sidebar-mobile-menu-inner">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                role="menuitem"
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;