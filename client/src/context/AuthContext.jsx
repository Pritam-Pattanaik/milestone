import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const navigate = useNavigate()

    // Check for existing session on mount
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('accessToken')

            if (!token) {
                setIsLoading(false)
                return
            }

            try {
                const response = await api.get('/auth/me')
                setUser(response.data.data.user)
            } catch (error) {
                // Token invalid or expired
                localStorage.removeItem('accessToken')
                localStorage.removeItem('refreshToken')
            } finally {
                setIsLoading(false)
            }
        }

        checkAuth()
    }, [])

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password })
            const { user, accessToken, refreshToken } = response.data.data

            localStorage.setItem('accessToken', accessToken)
            localStorage.setItem('refreshToken', refreshToken)
            setUser(user)

            toast.success(`Welcome back, ${user.name}! 🎯`)
            navigate('/dashboard')

            return { success: true }
        } catch (error) {
            const message = error.response?.data?.error?.message || 'Login failed'
            toast.error(message)
            return { success: false, error: message }
        }
    }

    const logout = async () => {
        try {
            await api.post('/auth/logout')
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            setUser(null)
            navigate('/login')
            toast.success('Logged out successfully')
        }
    }

    const refreshToken = async () => {
        try {
            const refresh = localStorage.getItem('refreshToken')
            if (!refresh) throw new Error('No refresh token')

            const response = await api.post('/auth/refresh', { refreshToken: refresh })
            const { accessToken } = response.data.data

            localStorage.setItem('accessToken', accessToken)
            return accessToken
        } catch (error) {
            logout()
            return null
        }
    }

    const value = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshToken,
        isEmployee: user?.role === 'EMPLOYEE',
        isManager: user?.role === 'MANAGER' || user?.role === 'ADMIN',
        isAdmin: user?.role === 'ADMIN'
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export default AuthContext
