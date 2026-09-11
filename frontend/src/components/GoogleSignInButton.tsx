import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, CheckCircle2, X } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => Promise<void>;
  onError: (errorMessage: string) => void;
  isLoading?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  isLoading = false
}) => {
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [demoEmail, setDemoEmail] = useState('admin@dcsys.com');

  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID?.trim();
  const isConfigured = Boolean(clientId && !clientId.includes('seu-client-id'));

  // Detecta e inicializa o script do Google Identity Services
  useEffect(() => {
    let intervalId: any = null;

    const checkGis = () => {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);
        if (intervalId) clearInterval(intervalId);
      }
    };

    checkGis();

    if (!window.google?.accounts?.id) {
      intervalId = setInterval(checkGis, 300);
      const timer = setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
      }, 5000);
      return () => {
        clearInterval(intervalId);
        clearTimeout(timer);
      };
    }
  }, []);

  // Renderiza o botão oficial do Google caso o Client ID esteja configurado
  useEffect(() => {
    if (!gisLoaded || !isConfigured || !clientId || !googleBtnContainerRef.current) {
      return;
    }

    try {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (response?.credential) {
            try {
              await onSuccess(response.credential);
            } catch (err: any) {
              onError(err?.message || 'Falha ao autenticar com o Google');
            }
          } else {
            onError('Nenhuma credencial retornada pelo Google');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Limpa renderizações anteriores
      googleBtnContainerRef.current.innerHTML = '';

      window.google!.accounts.id.renderButton(googleBtnContainerRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: googleBtnContainerRef.current.clientWidth || 380,
        locale: 'pt-BR'
      });
    } catch (e: any) {
      console.warn('Falha ao renderizar botão oficial Google Identity Services:', e);
    }
  }, [gisLoaded, isConfigured, clientId, onSuccess, onError]);

  const handleCustomButtonClick = () => {
    if (isLoading) return;

    if (isConfigured && window.google?.accounts?.id) {
      // Se configurado, força o prompt do Google One-Tap
      window.google.accounts.id.prompt();
    } else {
      // Se não configurado, abre modal orientador de configuração / demonstração rápida
      setShowConfigModal(true);
    }
  };

  const handleDemoSignIn = async () => {
    setShowConfigModal(false);
    const mockToken = `demo_google_token:${demoEmail.trim().toLowerCase()}`;
    await onSuccess(mockToken);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Container para o botão oficial do Google quando o Client ID estiver presente */}
      {isConfigured && gisLoaded && (
        <div 
          ref={googleBtnContainerRef} 
          className="w-full flex justify-center min-h-[44px]"
        />
      )}

      {/* Botão com estilo customizado Google oficial (utilizado quando não configurado ou em fallback) */}
      {(!isConfigured || !gisLoaded) && (
        <button
          type="button"
          onClick={handleCustomButtonClick}
          disabled={isLoading}
          className="google-btn"
          title={isConfigured ? 'Entrar com o Google' : 'Configurar ou Testar Login com Google'}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin text-slate-600" />
              <span>Conectando ao Google...</span>
            </>
          ) : (
            <>
              {/* SVG Oficial Google G com 4 cores */}
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.99 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Entrar com o Google</span>
            </>
          )}
        </button>
      )}

      {/* Modal de Configuração / Demonstração do Google Sign-In */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-base">
                <Sparkles className="text-amber-500" size={20} />
                <span>Autenticação Google OAuth 2.0</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex flex-col gap-3">
              <p>
                O Precifiq suporta o <strong>Google Identity Services</strong> para login rápido e seguro.
              </p>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  Passo a passo para chave oficial:
                </span>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <li>Acesse o <strong>Google Cloud Console</strong> &gt; APIs e Serviços &gt; Credenciais.</li>
                  <li>Crie um <strong>ID do cliente OAuth</strong> para Aplicativo da Web.</li>
                  <li>Adicione sua URL nas origens autorizadas (ex: <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">http://localhost:5173</code>).</li>
                  <li>Defina no seu arquivo <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">.env</code>:
                    <div className="mt-1 font-mono text-[10px] bg-slate-900 text-emerald-400 p-1.5 rounded">
                      VITE_GOOGLE_CLIENT_ID=seu-id.apps.googleusercontent.com<br />
                      GOOGLE_CLIENT_ID=seu-id.apps.googleusercontent.com
                    </div>
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl">
                <span className="font-semibold text-blue-900 dark:text-blue-300 block mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Testar fluxo agora (Modo Desenvolvedor):
                </span>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mb-2">
                  Deseja validar o fluxo de autenticação e sessão com uma conta Google de teste imediatamente?
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleDemoSignIn}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow-sm transition"
                  >
                    Simular Login
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
