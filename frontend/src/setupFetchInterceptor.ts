/**
 * Interceptador global transparente para window.fetch
 * Executa imediatamente na inicialização da aplicação (antes do React e do React Query montarem),
 * garantindo que mesmo as primeiras requisições de useQuery enviem X-User-Email, X-Company-Schema e Authorization.
 */

let isInstalled = false;

export function installGlobalFetchInterceptor() {
  if (typeof window === 'undefined' || isInstalled) return;
  isInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlString = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.href : (input as Request).url || '');

    // Verifica se é uma requisição interna do sistema
    const isInternal = !urlString.startsWith('http://') && !urlString.startsWith('https://')
      || (typeof window !== 'undefined' && urlString.startsWith(window.location.origin));

    // Se for requisição externa (ex: ViaCEP), não injeta headers internos para não violar CORS
    if (!isInternal) {
      return originalFetch(input, init);
    }

    const modifiedInit: RequestInit = { ...init };
    const headers = new Headers(modifiedInit.headers || {});

    // 1. Injeta X-Company-Schema (schema tenant ativo)
    if (!headers.has('X-Company-Schema')) {
      try {
        const savedCompany = localStorage.getItem('precific_active_company');
        if (savedCompany) {
          const parsed = JSON.parse(savedCompany);
          if (parsed?.schemaName) {
            headers.set('X-Company-Schema', parsed.schemaName);
          }
        }
      } catch {
        // Ignora erro
      }

      if (!headers.has('X-Company-Schema')) {
        headers.set('X-Company-Schema', 'controle');
      }
    }

    // 2. Injeta X-User-Email (identificação do usuário autenticado)
    if (!headers.has('X-User-Email')) {
      try {
        const authSaved = localStorage.getItem('precific_auth_user');
        if (authSaved) {
          const parsed = JSON.parse(authSaved);
          if (parsed?.email) {
            headers.set('X-User-Email', parsed.email);
          }
        }
      } catch {
        // Ignora erro
      }
    }

    // 3. Injeta Authorization Bearer Token
    if (!headers.has('Authorization')) {
      try {
        const token = localStorage.getItem('precific_auth_token');
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      } catch {
        // Ignora erro
      }
    }

    modifiedInit.headers = headers;
    return originalFetch(input, modifiedInit);
  };
}
