import React from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import './styles.css'
import './css/app.css'
import './js/app'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {ThemeProvider} from './contexts/ThemeContext'
import {installGlobalFetchInterceptor} from './setupFetchInterceptor'

// Instala imediatamente o interceptador antes de qualquer montagem ou query do React
installGlobalFetchInterceptor()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 segundos de cache antes de considerar obsoleto
      gcTime: 1000 * 60 * 5, // 5 minutos de coleta de lixo de dados em cache
      refetchOnWindowFocus: false, // Evita disparar 8+ requisições simultâneas ao alternar abas/janelas
      retry: 1,
    },
  },
})

const root = document.getElementById('root')!
createRoot(root).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <App/>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>
)