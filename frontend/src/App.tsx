import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';

// Importando os provedores de contexto
import { TenantProvider } from './contexts/TenantContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Importando os componentes
import Sidebar from './Sidebar';
import { CopilotModal } from './components/CopilotModal';

// Importando as páginas
import DashboardPage from './pages/DashboardPage';
import FornecedoresPage from './pages/Fornecedores';
import InsumosPage from './pages/InsumosPage';
import UnidadesMedidaPage from './pages/UnidadesMedidaPage';
import ProdutosFinaisPage from './pages/ProdutosFinaisPage';
import OrcamentosPage from './pages/OrcamentosPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';
import PedidoCompraPage from './pages/PedidoCompraPage';
import ComprasPage from './pages/ComprasPage';
import PedidoComprasPage from './pages/PedidoComprasPage';
import PedidoPage from './pages/PedidoPage';
import EstoquePage from './pages/EstoquePage';
import KitsPage from './pages/KitsPage';
import GestaoGlobalPage from './pages/GestaoGlobalPage';
import SuperAdminPage from './pages/SuperAdminPage';
import { LoginPage } from './pages/LoginPage';

import { usePermissions } from './hooks/usePermissions';

const AppContent: React.FC = () => {
  const { isAuthenticated, isSuperuser } = useAuth();
  const { hasPermission } = usePermissions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const location = useLocation();

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
  };

  // Listener global de teclado para o atalho Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (hasPermission('copilot')) {
          setIsCopilotOpen(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPermission]);

  // Se não estiver autenticado: index (/) ou qualquer rota exibe a tela de login
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Se estiver autenticado e tentar acessar /login, direciona para o index (Dashboard)
  if (location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar 
        isOpen={isMenuOpen}
        onToggle={handleMenuToggle}
        onClose={handleMenuClose}
        onOpenCopilot={() => hasPermission('copilot') && setIsCopilotOpen(true)}
      />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/fornecedores" element={hasPermission('fornecedores') ? <FornecedoresPage /> : <Navigate to="/" replace />} />
          <Route path="/insumos" element={hasPermission('insumos') ? <InsumosPage /> : <Navigate to="/" replace />} />
          <Route path="/unidades" element={hasPermission('unidades_medida') ? <UnidadesMedidaPage /> : <Navigate to="/" replace />} />
          <Route path="/produtos" element={hasPermission('produtos') ? <ProdutosFinaisPage /> : <Navigate to="/" replace />} />
          <Route path="/kits" element={hasPermission('kits') ? <KitsPage /> : <Navigate to="/" replace />} />
          <Route path="/orcamentos" element={hasPermission('orcamentos') ? <OrcamentosPage /> : <Navigate to="/" replace />} />
          <Route path="/pedido-compra/:id" element={hasPermission('pedidos_compra') ? <PedidoCompraPage /> : <Navigate to="/" replace />} />
          <Route path="/configuracoes" element={hasPermission('configuracoes') ? <ConfiguracoesPage /> : <Navigate to="/" replace />} />
          <Route path="/pedidos" element={hasPermission('pedidos_compra') ? <PedidoComprasPage /> : <Navigate to="/" replace />} />
          <Route path="/pedido" element={hasPermission('pedidos_clientes') ? <PedidoPage /> : <Navigate to="/" replace />} />
          <Route path="/compras" element={hasPermission('compras') ? <ComprasPage /> : <Navigate to="/" replace />} />
          <Route path="/estoque" element={hasPermission('estoque_produtos') ? <EstoquePage /> : <Navigate to="/" replace />} />
          <Route path="/gestao-global" element={isSuperuser ? <GestaoGlobalPage /> : <Navigate to="/" replace />} />
          <Route path="/superadmin" element={isSuperuser ? <SuperAdminPage /> : <Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Modal Global do Copilot Operacional com Text-to-SQL (Spotlight Ctrl+K) */}
      {hasPermission('copilot') && (
        <CopilotModal 
          isOpen={isCopilotOpen} 
          onClose={() => setIsCopilotOpen(false)} 
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <TenantProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TenantProvider>
    </AuthProvider>
  );
};

export default App;