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
  permissoes?: string;
}

export interface UsuarioGlobal {
  id: number;
  nome: string;
  email: string;
  isSuperuser: boolean;
  ativo: boolean;
  criadoEm?: string;
  fotoUrl?: string;
  empresas?: UsuarioEmpresaVinculo[];
}

interface AuthContextType {
  user: UsuarioGlobal | null;
  token: string | null;
  isAuthenticated: boolean;
  isSuperuser: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AUTH_USER_KEY = 'precific_auth_user';
const AUTH_TOKEN_KEY = 'precific_auth_token';

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

  // Sincroniza e valida a sessão real com o banco de dados na inicialização
  useEffect(() => {
    if (!token || !user?.email) return;

    let isMounted = true;
    const syncSession = async () => {
      try {
        const res = await fetch('/api/global/auth/me', {
          headers: {
            'X-User-Email': user.email,
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.usuario) {
            setUser(data.usuario);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.usuario));
          }
        } else if (res.status === 401 || res.status === 403) {
          if (isMounted) {
            logout();
          }
        }
      } catch (err) {
        console.warn('Não foi possível sincronizar sessão com o servidor:', err);
      }
    };

    syncSession();

    return () => {
      isMounted = false;
    };
  }, []);

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

      // Se o usuário possui empresa vinculada, define a primeira como empresa ativa
      if (data.usuario?.empresas && data.usuario.empresas.length > 0) {
        const first = data.usuario.empresas[0];
        const initialCompany = {
          id: first.empresaId,
          tipo: first.empresaTipo || 'MATRIZ',
          nomeFantasia: first.empresaNome,
          schemaName: first.schemaName,
          ativo: true
        };
        localStorage.setItem('precific_active_company', JSON.stringify(initialCompany));
      }

      window.dispatchEvent(new CustomEvent('authChanged'));

      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Erro ao conectar ao servidor' };
    }
  };

  const loginWithGoogle = async (credential: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/global/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha na autenticação via Google' }));
        return { success: false, error: err.error || 'Credencial do Google inválida ou expirada' };
      }

      const data = await res.json();
      setUser(data.usuario);
      setToken(data.token);

      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.usuario));
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);

      // Se o usuário possui empresa vinculada, define a primeira como empresa ativa
      if (data.usuario?.empresas && data.usuario.empresas.length > 0) {
        const first = data.usuario.empresas[0];
        const initialCompany = {
          id: first.empresaId,
          tipo: first.empresaTipo || 'MATRIZ',
          nomeFantasia: first.empresaNome,
          schemaName: first.schemaName,
          ativo: true
        };
        localStorage.setItem('precific_active_company', JSON.stringify(initialCompany));
      }

      window.dispatchEvent(new CustomEvent('authChanged'));

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
    localStorage.removeItem('precific_active_company');
    window.dispatchEvent(new CustomEvent('authChanged'));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isSuperuser: Boolean(user && user.isSuperuser === true),
        login,
        loginWithGoogle,
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
