import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface EmpresaItem {
  id: number;
  tipo: 'MATRIZ' | 'FILIAL';
  matrizId?: number | null;
  nomeFantasia: string;
  razaoSocial?: string;
  cnpj?: string;
  schemaName: string;
  ativo: boolean;
  criadoEm?: string;
}

export interface EmpresaHierarquia {
  id: number;
  tipo: 'MATRIZ';
  nomeFantasia: string;
  razaoSocial?: string;
  cnpj?: string;
  schemaName: string;
  ativo: boolean;
  filiais: EmpresaItem[];
  totalProdutos?: number;
  totalInsumos?: number;
}

interface TenantContextType {
  activeCompany: EmpresaItem | null;
  empresasHierarquia: EmpresaHierarquia[];
  isLoadingEmpresas: boolean;
  selectCompany: (empresa: EmpresaItem) => void;
  refreshEmpresas: () => Promise<void>;
}

const STORAGE_KEY = 'precific_active_company';

const DEFAULT_COMPANY: EmpresaItem = {
  id: 1,
  tipo: 'MATRIZ',
  matrizId: null,
  nomeFantasia: 'Controle Silvia (Matriz)',
  razaoSocial: 'Silvia Artes & Cosméticos Ltda',
  cnpj: '12.345.678/0001-90',
  schemaName: 'controle',
  ativo: true
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCompany, setActiveCompanyState] = useState<EmpresaItem>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignora erro de JSON
    }
    return DEFAULT_COMPANY;
  });

  const [empresasHierarquia, setEmpresasHierarquia] = useState<EmpresaHierarquia[]>([]);
  const [isLoadingEmpresas, setIsLoadingEmpresas] = useState(true);

  // Referência atualizada para o interceptador de fetch acessar de forma síncrona
  const activeCompanyRef = useRef<EmpresaItem>(activeCompany);
  activeCompanyRef.current = activeCompany;

  // Interceptador global transparente para window.fetch
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const currentSchema = activeCompanyRef.current?.schemaName || 'controle';
      const modifiedInit: RequestInit = { ...init };
      const headers = new Headers(modifiedInit.headers || {});

      if (!headers.has('X-Company-Schema')) {
        headers.set('X-Company-Schema', currentSchema);
      }

      modifiedInit.headers = headers;
      return originalFetch(input, modifiedInit);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const refreshEmpresas = async () => {
    try {
      setIsLoadingEmpresas(true);
      const res = await fetch('/api/global/empresas');
      if (res.ok) {
        const data: EmpresaHierarquia[] = await res.json();
        setEmpresasHierarquia(data);

        // Se a empresa ativa não existir na lista ou for nula, garante uma válida
        if (data.length > 0) {
          const allCompanies: EmpresaItem[] = [];
          data.forEach(m => {
            allCompanies.push({
              id: m.id,
              tipo: m.tipo,
              nomeFantasia: m.nomeFantasia,
              razaoSocial: m.razaoSocial,
              cnpj: m.cnpj,
              schemaName: m.schemaName,
              ativo: m.ativo
            });
            m.filiais?.forEach(f => allCompanies.push(f));
          });

          const currentStillExists = allCompanies.some(c => c.schemaName === activeCompanyRef.current?.schemaName);
          if (!currentStillExists && allCompanies.length > 0) {
            selectCompany(allCompanies[0]);
          }
        }
      }
    } catch (e) {
      console.error('Falha ao carregar catálogo de empresas:', e);
    } finally {
      setIsLoadingEmpresas(false);
    }
  };

  useEffect(() => {
    refreshEmpresas();
  }, []);

  const selectCompany = (empresa: EmpresaItem) => {
    setActiveCompanyState(empresa);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empresa));
    } catch (e) {
      console.error('Falha ao salvar empresa ativa:', e);
    }
    // Dispara evento customizado para componentes escutarem a troca se necessário
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: empresa }));
  };

  return (
    <TenantContext.Provider
      value={{
        activeCompany,
        empresasHierarquia,
        isLoadingEmpresas,
        selectCompany,
        refreshEmpresas
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant deve ser usado dentro de um TenantProvider');
  }
  return ctx;
};
