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

const AppContent: React.FC = () => {
  const { isAuthenticated, isSuperuser } = useAuth();
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
        setIsCopilotOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/fornecedores" element={<FornecedoresPage />} />
          <Route path="/insumos" element={<InsumosPage />} />
          <Route path="/unidades" element={<UnidadesMedidaPage />} />
          <Route path="/produtos" element={<ProdutosFinaisPage />} />
          <Route path="/kits" element={<KitsPage />} />
          <Route path="/orcamentos" element={<OrcamentosPage />} />
          <Route path="/pedido-compra/:id" element={<PedidoCompraPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="/pedidos" element={<PedidoComprasPage />} />
          <Route path="/pedido" element={<PedidoPage />} />
          <Route path="/compras" element={<ComprasPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/gestao-global" element={isSuperuser ? <GestaoGlobalPage /> : <Navigate to="/" replace />} />
          <Route path="/superadmin" element={isSuperuser ? <SuperAdminPage /> : <Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Modal Global do Copilot Operacional com Text-to-SQL (Spotlight Ctrl+K) */}
      <CopilotModal 
        isOpen={isCopilotOpen} 
        onClose={() => setIsCopilotOpen(false)} 
      />
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