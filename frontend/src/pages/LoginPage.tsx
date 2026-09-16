import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, 
  Lock, 
  Mail, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Server,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { toast } from '../js/app';
import precifiqLogo from '../assets/precifiq.png';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { RecuperarSenhaModal } from '../components/RecuperarSenhaModal';

export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [isRecuperarModalOpen, setIsRecuperarModalOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('demo') === 'true' || params.get('demo') === '1';
    }
    return false;
  });

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
              <button
                type="button"
                onClick={() => setIsRecuperarModalOpen(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline bg-transparent border-0 cursor-pointer p-0"
              >
                Esqueceu sua senha?
              </button>
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

        {/* Link para Demonstração ("demo") */}
        <div className="flex justify-center pt-1 pb-1">
          <button
            type="button"
            onClick={() => setShowDemo(prev => !prev)}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-0 py-1 px-2.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            title={showDemo ? 'Ocultar credenciais de demonstração' : 'Exibir credenciais de demonstração'}
          >
            <Sparkles size={13} className={showDemo ? 'text-indigo-600' : 'text-slate-400'} />
            <span>{showDemo ? 'Ocultar demonstração' : 'Acesso para demonstração ("demo")'}</span>
            <ChevronDown 
              size={13} 
              className={`transition-transform duration-200 ${showDemo ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`} 
            />
          </button>
        </div>

        {/* Atalhos Rápidos para Acesso de Teste / Apresentação (exibido apenas ao clicar no link de demonstração) */}
        {showDemo && (
          <div className="login-demo-section animate-in fade-in duration-200">
            <div className="login-demo-title flex items-center justify-center gap-1.5">
              <Sparkles size={12} className="text-indigo-500" />
              <span>Acesso Rápido para Demonstração (Demo)</span>
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

              {/* Ambiente de Demonstração (Demo) */}
              <button
                type="button"
                onClick={() => {
                  handleQuickLogin('demo@empresa.com', '123456');
                  try {
                    localStorage.setItem('precific_active_company', JSON.stringify({
                      id: 99,
                      tipo: 'MATRIZ',
                      nomeFantasia: 'Demonstração (Demo)',
                      schemaName: 'db_demo',
                      ativo: true
                    }));
                  } catch {}
                }}
                className="login-demo-btn"
              >
                <div className="flex items-center gap-2.5">
                  <div className="login-demo-icon-box bg-amber-500">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Ambiente de Demonstração</span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded">🟡 DEMO</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      demo@empresa.com • Insumos, Produtos e Pedidos Simulados
                    </div>
                  </div>
                </div>
                <span className="login-demo-badge bg-amber-100 text-amber-800">
                  Preencher
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Rodapé Informativo */}
        <div className="text-center text-[11px] text-slate-400 flex flex-col items-center gap-1.5 mt-2">
          <div className="flex items-center gap-2.5 text-[11px]">
            <Link to="/manual" className="hover:text-blue-600 transition-colors text-slate-500 font-medium">
              Manual do Sistema
            </Link>
            <span className="text-slate-300">•</span>
            <Link to="/sobre" className="hover:text-blue-600 transition-colors text-slate-500 font-medium">
              Sobre o Precifiq
            </Link>
            <span className="text-slate-300">•</span>
            <Link to="/privacidade" className="hover:text-blue-600 transition-colors text-slate-500 font-medium">
              Privacidade
            </Link>
          </div>
          <div>
            DcSys Tecnologia • Plataforma Precifiq v1.0.0
          </div>
        </div>
      </div>

      {/* Modal de Recuperação de Senha por E-mail */}
      <RecuperarSenhaModal
        isOpen={isRecuperarModalOpen}
        onClose={() => setIsRecuperarModalOpen(false)}
        initialEmail={email}
        onSenhaRedefinida={(emailRedefinido) => {
          setEmail(emailRedefinido);
          setSenha('');
        }}
      />
    </div>
  );
};

export default LoginPage;
