import React from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import './styles.css'
import './css/app.css'
import './js/app.js'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {ThemeProvider} from './contexts/ThemeContext'

const queryClient = new QueryClient()

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