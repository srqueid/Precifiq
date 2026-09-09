import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UsuarioEmpresaVinculo {
  id: number;
  empresaId: number;
  empresaNome: string;
  empresaTipo: string;
  schemaName: string;
  perfilId: number;
  perfilCodigo: string;
  perfilNome: string;
}

export interface UsuarioGlobal {
  id: number;
  nome: string;
  email: string;
  isSuperuser: boolean;
  ativo: boolean;
  criadoEm?: string;
  empresas?: UsuarioEmpresaVinculo[];
}

interface AuthContextType {
  user: UsuarioGlobal | null;
  token: string | null;
  isAuthenticated: boolean;
  isSuperuser: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AUTH_USER_KEY = 'precific_auth_user';
const AUTH_TOKEN_KEY = 'precific_auth_token';

// Usuário padrão de desenvolvimento / sessão inicial
const DEFAULT_USER: UsuarioGlobal = {
  id: 1,
  nome: 'Administrador DCSYS',
  email: 'admin@dcsys.com',
  isSuperuser: true,
  ativo: true
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UsuarioGlobal | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignora erro
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY) || null;
  });

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/global/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: pass })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha na autenticação' }));
        return { success: false, error: err.error || 'Credenciais inválidas' };
      }

      const data = await res.json();
      setUser(data.usuario);
      setToken(data.token);

      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.usuario));
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);

      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Erro ao conectar ao servidor' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isSuperuser: !!user?.isSuperuser,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
};
