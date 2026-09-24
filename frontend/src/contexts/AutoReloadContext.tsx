import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export interface ReloadPageOption {
  path: string;
  label: string;
  description: string;
}

export const AVAILABLE_RELOAD_PAGES: ReloadPageOption[] = [
  { path: '/', label: 'Dashboard', description: 'Visão geral, indicadores e faturamento' },
  { path: '/pedido', label: 'Pedidos de Clientes', description: 'Fluxo operacional de pedidos e expedição' },
  { path: '/pedidos', label: 'Pedidos de Compra', description: 'Ordens de compras e cotações' },
  { path: '/estoque', label: 'Estoque de Produtos', description: 'Saldos de estoque e movimentações' },
  { path: '/insumos', label: 'Estoque de Insumos', description: 'Matérias-primas e insumos em estoque' },
  { path: '/compras', label: 'Compras', description: 'Entrada de notas fiscais e compras' },
  { path: '/orcamentos', label: 'Orçamentos', description: 'Listagem de orçamentos gerados' },
  { path: '/produtos', label: 'Produtos Finais', description: 'Catálogo e precificação de produtos' },
  { path: '/kits', label: 'Kits', description: 'Combos e kits promocionais' },
  { path: '/fornecedores', label: 'Fornecedores', description: 'Cadastro e contatos de fornecedores' },
];

const STORAGE_KEY = 'precifiq_auto_reload_config';
const INTERVAL_SECONDS = 30;

interface AutoReloadConfig {
  enabled: boolean;
  selectedPages: string[];
}

interface AutoReloadContextType {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  selectedPages: string[];
  togglePage: (path: string) => void;
  selectAllPages: (select: boolean) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  remainingSeconds: number;
  isCurrentPageSelected: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  intervalSeconds: number;
}

const AutoReloadContext = createContext<AutoReloadContextType | undefined>(undefined);

export const AutoReloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  // Carrega configuração salva
  const [config, setConfig] = useState<AutoReloadConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Erro ao ler configuração de auto reload:', e);
    }
    return {
      enabled: false,
      selectedPages: ['/', '/pedido', '/estoque', '/pedidos'],
    };
  });

  const [isPaused, setIsPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(INTERVAL_SECONDS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Salva alterações no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Erro ao salvar configuração de auto reload:', e);
    }
  }, [config]);

  // Normaliza rota atual
  const currentPath = location.pathname;
  const isCurrentPageSelected = config.selectedPages.some((p) => {
    if (p === '/') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    return currentPath === p || currentPath.startsWith(p + '/');
  });

  // Reseta contador ao mudar de rota
  useEffect(() => {
    setRemainingSeconds(INTERVAL_SECONDS);
  }, [currentPath]);

  // Timer de 30 segundos com contagem regressiva
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!config.enabled || !isCurrentPageSelected || isPaused) {
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Executa o reload completo da página conforme solicitado
          window.location.reload();
          return INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [config.enabled, isCurrentPageSelected, isPaused]);

  const setEnabled = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabled }));
    if (enabled) {
      setRemainingSeconds(INTERVAL_SECONDS);
      setIsPaused(false);
    }
  };

  const togglePage = (path: string) => {
    setConfig((prev) => {
      const exists = prev.selectedPages.includes(path);
      const newPages = exists
        ? prev.selectedPages.filter((p) => p !== path)
        : [...prev.selectedPages, path];
      return { ...prev, selectedPages: newPages };
    });
  };

  const selectAllPages = (select: boolean) => {
    setConfig((prev) => ({
      ...prev,
      selectedPages: select ? AVAILABLE_RELOAD_PAGES.map((p) => p.path) : [],
    }));
  };

  return (
    <AutoReloadContext.Provider
      value={{
        enabled: config.enabled,
        setEnabled,
        selectedPages: config.selectedPages,
        togglePage,
        selectAllPages,
        isPaused,
        setIsPaused,
        remainingSeconds,
        isCurrentPageSelected,
        isModalOpen,
        openModal: () => setIsModalOpen(true),
        closeModal: () => setIsModalOpen(false),
        intervalSeconds: INTERVAL_SECONDS,
      }}
    >
      {children}
    </AutoReloadContext.Provider>
  );
};

export const useAutoReload = () => {
  const context = useContext(AutoReloadContext);
  if (!context) {
    throw new Error('useAutoReload deve ser usado dentro de um AutoReloadProvider');
  }
  return context;
};
