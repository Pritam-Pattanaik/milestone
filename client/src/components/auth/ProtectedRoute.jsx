import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
    const { user, isAuthenticated, isLoading } = useAuth()
    const location = useLocation()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Check role requirements
    if (requiredRole) {
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
        if (!roles.includes(user.role)) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="card p-8 text-center max-w-md">
                        <div className="w-16 h-16 mx-auto mb-4 bg-danger-500/20 rounded-full flex items-center justify-center">
                            <span className="text-4xl">🚫</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                        <p className="text-slate-400 mb-6">
                            You don't have permission to access this page.
                            Required role: {roles.join(' or ')}
                        </p>
                        <a href="/dashboard" className="btn-primary">
                            Go to Dashboard
                        </a>
                    </div>
                </div>
            )
        }
    }

    return children
}
