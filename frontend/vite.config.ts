import { defineConfig, ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// Helper para criar regras de proxy para o backend (porta 8081).
// Quando a requisição for de navegação de página no navegador (ex: recarregar a tela com F5,
// digitar a URL diretamente na barra de endereço ou navegação direta HTML), NÃO repassa para o backend,
// mas retorna '/index.html' para que o Vite sirva a aplicação React SPA com toda a estilização e componentes.
const createSpaProxy = (target = 'http://localhost:8081'): ProxyOptions => ({
  target,
  changeOrigin: true,
  bypass: (req) => {
    const isHtmlNavigation = 
      req.headers?.accept?.includes('text/html') || 
      req.headers?.['sec-fetch-dest'] === 'document';

    // Páginas de impressão/relatório do backend devem passar direto para o backend
    const isPrintOrReport = 
      req.url?.includes('/imprimir') || 
      req.url?.includes('/relatorio');

    if (isHtmlNavigation && !isPrintOrReport) {
      return '/index.html';
    }
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': createSpaProxy(),
      '/insumos': createSpaProxy(),
      '/produtos-finais': createSpaProxy(),
      '/unidades-medida': createSpaProxy(),
      '/fornecedores': createSpaProxy(),
      '/orcamentos': createSpaProxy(),
      '/pedidos-compra': createSpaProxy(),
      '/pedidos-operacionais': createSpaProxy(),
      '/pedidos': createSpaProxy(),
      '/compras': createSpaProxy(),
      '/clientes': createSpaProxy(),
      '/configuracoes': createSpaProxy(),
      '/precificacao': createSpaProxy(),
      '/dashboard': createSpaProxy(),
      '/estoque': createSpaProxy(),
      '/producao': createSpaProxy(),
      '/relatorio': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/relatorios': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/nfe': createSpaProxy(),
      '/ai': createSpaProxy(),
    }
  }
})
