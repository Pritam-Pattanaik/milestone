import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { Eye, EyeOff, Flag, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
    const { login } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [loginError, setLoginError] = useState('')

    const { register, handleSubmit, formState: { errors } } = useForm()

    const onSubmit = async (data) => {
        setIsLoading(true)
        setLoginError('')

        try {
            const result = await login(data.email, data.password)
            if (!result.success) {
                const errorMessage = result.error || 'Invalid email or password'
                setLoginError(errorMessage)
                toast.error(errorMessage, {
                    icon: '🚫',
                    duration: 4000
                })
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error?.message || 'Login failed. Please try again.'
            setLoginError(errorMessage)
            toast.error(errorMessage, {
                icon: '🚫',
                duration: 4000
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8"
        >
            {/* Logo */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg shadow-primary-500/25 mb-4">
                    <Flag className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-heading font-bold text-white mb-1">
                    Welcome to Milestone
                </h1>
                <p className="text-slate-400">Every day is a milestone</p>
            </div>

            {/* Error Alert */}
            {loginError && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-danger-500/10 border border-danger-500/30 flex items-start gap-3"
                >
                    <AlertCircle className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-danger-400">Login Failed</p>
                        <p className="text-sm text-danger-400/80">{loginError}</p>
                    </div>
                </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                    <label className="label">Email Address</label>
                    <input
                        {...register('email', {
                            required: 'Email is required',
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: 'Invalid email address'
                            }
                        })}
                        type="email"
                        className={`input ${errors.email || loginError ? 'input-error' : ''}`}
                        placeholder="you@company.com"
                        autoComplete="email"
                        onChange={() => setLoginError('')}
                    />
                    {errors.email && (
                        <p className="mt-1 text-sm text-danger-400">{errors.email.message}</p>
                    )}
                </div>

                <div>
                    <label className="label">Password</label>
                    <div className="relative">
                        <input
                            {...register('password', { required: 'Password is required' })}
                            type={showPassword ? 'text' : 'password'}
                            className={`input pr-12 ${errors.password || loginError ? 'input-error' : ''}`}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            onChange={() => setLoginError('')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="mt-1 text-sm text-danger-400">{errors.password.message}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full py-3"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        'Sign In'
                    )}
                </button>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-2">Demo Credentials:</p>
                <div className="space-y-1 text-xs text-slate-400">
                    <p>Admin: <span className="text-slate-300">admin@milestone.com</span> / Admin@123</p>
                    <p>Manager: <span className="text-slate-300">manager@milestone.com</span> / Manager@123</p>
                    <p>Employee: <span className="text-slate-300">john.doe@milestone.com</span> / Employee@123</p>
                </div>
            </div>
        </motion.div>
    )
}

