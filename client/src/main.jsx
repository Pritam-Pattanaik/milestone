import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import './index.css'

// Create React Query client with optimized cache settings
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 10, // 10 minutes - data stays fresh longer
            gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache longer
            refetchOnWindowFocus: false,
            refetchOnMount: false, // Don't refetch on component mount if data exists
            retry: 1,
            retryDelay: 1000
        },
        mutations: {
            retry: 0 // Don't retry mutations
        }
    }
})

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AuthProvider>
                    <ThemeProvider>
                        <NotificationProvider>
                            <App />
                            <Toaster
                                position="top-right"
                                toastOptions={{
                                    duration: 4000,
                                    style: {
                                        background: '#1e293b',
                                        color: '#f1f5f9',
                                        borderRadius: '12px',
                                        border: '1px solid #334155',
                                        padding: '16px'
                                    },
                                    success: {
                                        iconTheme: {
                                            primary: '#10b981',
                                            secondary: '#f1f5f9'
                                        }
                                    },
                                    error: {
                                        iconTheme: {
                                            primary: '#ef4444',
                                            secondary: '#f1f5f9'
                                        }
                                    }
                                }}
                            />
                        </NotificationProvider>
                    </ThemeProvider>
                </AuthProvider>
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>
)

