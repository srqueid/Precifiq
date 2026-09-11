import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, 
  Lock, 
  Mail, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Server
} from 'lucide-react';
import { toast } from '../js/app';
import precifiqLogo from '../assets/precifiq.png';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      const msg = 'Por favor, informe e-mail e senha.';
      setErroMsg(msg);
      toast(msg, 'error');
      return;
    }

    setIsLoading(true);
    setErroMsg(null);

    const result = await login(email.trim(), senha.trim());
    setIsLoading(false);

    if (result.success) {
      toast('Login realizado com sucesso! Redirecionando...', 'success');
      navigate('/');
    } else {
      const msg = result.error || 'Credenciais inválidas. Verifique seu e-mail e senha.';
      setErroMsg(msg);
      toast(msg, 'error');
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setIsLoading(true);
    setErroMsg(null);

    const result = await loginWithGoogle(credential);
    setIsLoading(false);

    if (result.success) {
      toast('Login com o Google realizado com sucesso!', 'success');
      navigate('/');
    } else {
      const msg = result.error || 'Falha ao autenticar com o Google.';
      setErroMsg(msg);
      toast(msg, 'error');
    }
  };

  const handleGoogleError = (err: string) => {
    setErroMsg(err);
    toast(err, 'error');
  };

  const handleQuickLogin = (quickEmail: string, quickSenha: string) => {
    setEmail(quickEmail);
    setSenha(quickSenha);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Topo / Logotipo Oficial Precifiq */}
        <div className="text-center flex flex-col items-center">
          <div className="login-logo-box">
            <img 
              src={precifiqLogo} 
              alt="Logomarca Precifiq" 
              className="login-logo-img"
            />
          </div>
          <h1 className="login-title">
            Precifiq ERP
          </h1>
          <p className="login-subtitle">
            Sistema de Gestão, Precificação & Governança Multiempresas
          </p>
        </div>

        {/* Mensagem de Erro */}
        {erroMsg && (
          <div className="login-error">
            <AlertCircle size={18} className="shrink-0" />
            <span>{erroMsg}</span>
          </div>
        )}

        {/* Autenticação com Google (Ocultada a pedido) */}
        {/* <div className="flex flex-col gap-3">
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            isLoading={isLoading}
          />

          <div className="login-divider">
            <span>ou acesse com e-mail</span>
          </div>
        </div> */}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="login-label">
              E-mail de Acesso
            </label>
            <div className="login-input-wrapper">
              <Mail size={18} className="login-input-icon" />
              <input
                type="email"
                required
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="login-label m-0">
                Senha
              </label>
            </div>
            <div className="login-input-wrapper">
              <Lock size={18} className="login-input-icon" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="login-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="login-btn"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Atalhos Rápidos para Acesso de Teste / Apresentação */}
        <div className="login-demo-section">
          <div className="login-demo-title">
            Acesso Rápido para Demonstração
          </div>

          <div className="flex flex-col gap-2">
            {/* Superusuário DcSys */}
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@dcsys.com', 'admin123')}
              className="login-demo-btn"
            >
              <div className="flex items-center gap-2.5">
                <div className="login-demo-icon-box bg-purple-700">
                  <Server size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-purple-900">
                    Superusuário (DcSys)
                  </div>
                  <div className="text-[11px] text-purple-700">
                    admin@dcsys.com • Infraestrutura & Bancos
                  </div>
                </div>
              </div>
              <span className="login-demo-badge bg-purple-100 text-purple-900">
                Preencher
              </span>
            </button>

            {/* Administrador da Matriz */}
            <button
              type="button"
              onClick={() => handleQuickLogin('silvia@empresa.com', '123456')}
              className="login-demo-btn"
            >
              <div className="flex items-center gap-2.5">
                <div className="login-demo-icon-box bg-blue-600">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Administrador da Empresa
                  </div>
                  <div className="text-[11px] text-slate-600">
                    silvia@empresa.com • Operação ERP
                  </div>
                </div>
              </div>
              <span className="login-demo-badge bg-slate-200 text-slate-700">
                Preencher
              </span>
            </button>
          </div>
        </div>

        {/* Rodapé Informativo */}
        <div className="text-center text-[11px] text-slate-400">
          DcSys Tecnologia • Plataforma Precifiq v1.0.0
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
