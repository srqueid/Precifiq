import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { installGlobalFetchInterceptor } from '../setupFetchInterceptor';

export interface EmpresaItem {
  id: number;
  tipo: 'MATRIZ' | 'FILIAL';
  matrizId?: number | null;
  nomeFantasia: string;
  razaoSocial?: string;
  cnpj?: string;
  schemaName: string;
  bancoDados?: string;
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
  bancoDados?: string;
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
  isDemo: boolean;
}

const STORAGE_KEY = 'precific_active_company';

const DEFAULT_COMPANY: EmpresaItem = {
  id: 1,
  tipo: 'MATRIZ',
  matrizId: null,
  nomeFantasia: 'Controle Silvia (Produção)',
  razaoSocial: 'Silvia Artes & Cosméticos Ltda',
  cnpj: '12.345.678/0001-90',
  schemaName: 'controle',
  bancoDados: 'bd_controle',
  ativo: true
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCompany, setActiveCompanyState] = useState<EmpresaItem>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.schemaName) return parsed;
      }
      // Se não há empresa salva, mas há usuário logado com vínculo:
      const authSaved = localStorage.getItem('precific_auth_user');
      if (authSaved) {
        const parsedUser = JSON.parse(authSaved);
        if (parsedUser?.empresas && parsedUser.empresas.length > 0) {
          const first = parsedUser.empresas[0];
          return {
            id: first.empresaId,
            tipo: first.empresaTipo || 'MATRIZ',
            nomeFantasia: first.empresaNome,
            schemaName: first.schemaName,
            ativo: true
          };
        }
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

  // Garante que o interceptador global de fetch esteja ativo
  useEffect(() => {
    installGlobalFetchInterceptor();
  }, []);

  const refreshEmpresas = async () => {
    try {
      setIsLoadingEmpresas(true);
      const res = await fetch('/api/global/empresas');
      if (res.ok) {
        const data: EmpresaHierarquia[] = await res.json();
        setEmpresasHierarquia(data);

        // Se a empresa ativa não pertencer às empresas permitidas pelo backend, ajusta imediatamente
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

          const currentStillAuthorized = allCompanies.some(
            c => c.schemaName === activeCompanyRef.current?.schemaName && c.ativo
          );

          if (!currentStillAuthorized && allCompanies.length > 0) {
            const firstActive = allCompanies.find(c => c.ativo) || allCompanies[0];
            selectCompany(firstActive);
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

    const handleAuthChanged = () => {
      refreshEmpresas();
    };

    window.addEventListener('authChanged', handleAuthChanged);
    return () => window.removeEventListener('authChanged', handleAuthChanged);
  }, []);

  const selectCompany = (empresa: EmpresaItem) => {
    // Validação de Segurança: o usuário só pode alternar para empresas pertencentes à sua hierarquia permitida
    if (empresasHierarquia.length > 0) {
      const allCompanies: EmpresaItem[] = [];
      empresasHierarquia.forEach(m => {
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

      const isAllowed = allCompanies.some(c => c.id === empresa.id);
      if (!isAllowed) {
        console.warn(`Tentativa de alternar para empresa não autorizada ID ${empresa.id} (${empresa.nomeFantasia}). Ação bloqueada.`);
        return;
      }
    }

    setActiveCompanyState(empresa);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(empresa));
    } catch (e) {
      console.error('Falha ao salvar empresa ativa:', e);
    }
    // Dispara evento customizado para componentes escutarem a troca se necessário
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: empresa }));
  };

  const isDemo = Boolean(
    activeCompany?.schemaName === 'db_demo' ||
    activeCompany?.nomeFantasia?.toLowerCase().includes('demo')
  );

  return (
    <TenantContext.Provider
      value={{
        activeCompany,
        empresasHierarquia,
        isLoadingEmpresas,
        selectCompany,
        refreshEmpresas,
        isDemo
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
