import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import toast from 'react-hot-toast'
import {
    User,
    Mail,
    Building2,
    Shield,
    Calendar,
    Clock,
    Save,
    Loader2,
    Camera
} from 'lucide-react'
import { format } from 'date-fns'

export default function Profile() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [isEditing, setIsEditing] = useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm({
        defaultValues: {
            name: user?.name || '',
            email: user?.email || ''
        }
    })

    // Get user stats
    const { data: stats } = useQuery({
        queryKey: ['user-stats'],
        queryFn: async () => {
            const [standups, blockers] = await Promise.all([
                api.get('/standup/history?limit=30'),
                api.get('/blocker/my-blockers')
            ])
            return {
                totalStandups: standups.data.data.pagination?.total || 0,
                completionRate: Math.round(
                    (standups.data.data.standups?.filter(s => s.goalStatus === 'ACHIEVED').length /
                        standups.data.data.standups?.filter(s => s.goalStatus).length || 0) * 100
                ),
                totalBlockers: blockers.data.data.counts?.total || 0,
                resolvedBlockers: blockers.data.data.counts?.resolved || 0
            }
        }
    })

    const updateProfile = useMutation({
        mutationFn: (data) => api.put('/auth/profile', data),
        onSuccess: () => {
            toast.success('Profile updated successfully!')
            setIsEditing(false)
            queryClient.invalidateQueries(['user'])
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to update profile')
        }
    })

    const onSubmit = (data) => {
        updateProfile.mutate(data)
    }

    const getRoleBadgeClass = (role) => {
        if (role === 'ADMIN') return 'badge-danger'
        if (role === 'MANAGER') return 'badge-warning'
        return 'badge-primary'
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-heading font-bold text-white">My Profile</h1>
                <p className="text-slate-400">View and manage your account information</p>
            </div>

            {/* Profile Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6"
            >
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-primary-500/25">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <button className="absolute -bottom-2 -right-2 p-2 bg-slate-800 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors">
                            <Camera className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
                            <span className={`badge ${getRoleBadgeClass(user?.role)}`}>
                                {user?.role}
                            </span>
                        </div>
                        <p className="text-slate-400 mb-4">{user?.email}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                                <Building2 className="w-4 h-4" />
                                {user?.department}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Joined {user?.createdAt ? format(new Date(user.createdAt), 'MMM yyyy') : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">Total Standups</span>
                    <p className="stat-value text-primary-400">{stats?.totalStandups || 0}</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">Completion Rate</span>
                    <p className="stat-value text-success-400">{stats?.completionRate || 0}%</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">Total Blockers</span>
                    <p className="stat-value text-warning-400">{stats?.totalBlockers || 0}</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">Resolved</span>
                    <p className="stat-value text-success-400">{stats?.resolvedBlockers || 0}</p>
                </motion.div>
            </div>

            {/* Edit Profile Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Account Information</h3>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="btn-ghost text-sm"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    {...register('name', { required: 'Name is required' })}
                                    disabled={!isEditing}
                                    className={`input pl-10 ${!isEditing ? 'opacity-60' : ''}`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    {...register('email')}
                                    disabled
                                    className="input pl-10 opacity-60"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Department</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    value={user?.department || ''}
                                    disabled
                                    className="input pl-10 opacity-60"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label">Role</label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    value={user?.role || ''}
                                    disabled
                                    className="input pl-10 opacity-60"
                                />
                            </div>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="flex items-center gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updateProfile.isPending}
                                className="btn-primary"
                            >
                                {updateProfile.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </motion.div>
        </div>
    )
}
