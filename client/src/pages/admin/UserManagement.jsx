import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { userAPI } from '../../lib/api'
import toast from 'react-hot-toast'
import {
    Users,
    Plus,
    Search,
    Edit,
    Trash2,
    RefreshCw,
    X,
    Loader2,
    UserCheck,
    UserX
} from 'lucide-react'

export default function UserManagement() {
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['users', searchQuery, roleFilter],
        queryFn: () => userAPI.getAll({
            search: searchQuery || undefined,
            role: roleFilter !== 'all' ? roleFilter : undefined
        }).then(res => res.data.data)
    })

    const createMutation = useMutation({
        mutationFn: (data) => userAPI.create(data),
        onSuccess: () => {
            toast.success('User created successfully!')
            queryClient.invalidateQueries(['users'])
            setShowCreateModal(false)
            createForm.reset()
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to create user')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => userAPI.update(id, data),
        onSuccess: () => {
            toast.success('User updated successfully!')
            queryClient.invalidateQueries(['users'])
            setEditingUser(null)
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to update user')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => userAPI.delete(id),
        onSuccess: () => {
            toast.success('User deactivated!')
            queryClient.invalidateQueries(['users'])
        }
    })

    const reactivateMutation = useMutation({
        mutationFn: (id) => userAPI.reactivate(id),
        onSuccess: () => {
            toast.success('User reactivated!')
            queryClient.invalidateQueries(['users'])
        }
    })

    const createForm = useForm({
        defaultValues: {
            name: '',
            email: '',
            password: '',
            role: 'EMPLOYEE',
            department: ''
        }
    })

    const editForm = useForm()

    const users = data?.users || []

    const openEditModal = (user) => {
        setEditingUser(user)
        editForm.reset({
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department
        })
    }

    const handleCreate = (data) => {
        createMutation.mutate(data)
    }

    const handleUpdate = (data) => {
        updateMutation.mutate({ id: editingUser.id, data })
    }

    const handleDelete = (user) => {
        if (window.confirm(`Are you sure you want to deactivate ${user.name}?`)) {
            deleteMutation.mutate(user.id)
        }
    }

    const handleReactivate = (user) => {
        reactivateMutation.mutate(user.id)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white">User Management</h1>
                    <p className="text-slate-400">Manage employee accounts and permissions</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                >
                    <Plus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Total Users</span>
                    <p className="stat-value text-primary-400">{data?.pagination?.total || 0}</p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Active</span>
                    <p className="stat-value text-success-400">
                        {users.filter(u => u.isActive).length}
                    </p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Managers</span>
                    <p className="stat-value text-warning-400">
                        {users.filter(u => u.role === 'MANAGER').length}
                    </p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Admins</span>
                    <p className="stat-value text-danger-400">
                        {users.filter(u => u.role === 'ADMIN').length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                        placeholder="Search by name or email..."
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="input w-auto"
                >
                    <option value="all">All Roles</option>
                    <option value="EMPLOYEE">Employees</option>
                    <option value="MANAGER">Managers</option>
                    <option value="ADMIN">Admins</option>
                </select>
            </div>

            {/* Users Table */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{user.name}</p>
                                                <p className="text-sm text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${user.role === 'ADMIN' ? 'badge-danger' :
                                                user.role === 'MANAGER' ? 'badge-warning' :
                                                    'badge-primary'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="text-slate-400">{user.department}</td>
                                    <td>
                                        {user.isActive ? (
                                            <span className="flex items-center gap-1 text-success-400 text-sm">
                                                <UserCheck className="w-4 h-4" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-slate-500 text-sm">
                                                <UserX className="w-4 h-4" />
                                                Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-sm text-slate-500">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="btn-icon btn-ghost"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            {user.isActive ? (
                                                <button
                                                    onClick={() => handleDelete(user)}
                                                    className="btn-icon btn-ghost text-danger-400 hover:bg-danger-500/10"
                                                    title="Deactivate"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleReactivate(user)}
                                                    className="btn-icon btn-ghost text-success-400 hover:bg-success-500/10"
                                                    title="Reactivate"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowCreateModal(false)}
                    />
                    <div className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="card p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Create New User</h3>
                                <button onClick={() => setShowCreateModal(false)} className="btn-icon btn-ghost">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                                <div>
                                    <label className="label">Full Name *</label>
                                    <input
                                        {...createForm.register('name', { required: true })}
                                        className="input"
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div>
                                    <label className="label">Email *</label>
                                    <input
                                        {...createForm.register('email', { required: true })}
                                        type="email"
                                        className="input"
                                        placeholder="john@milestone.com"
                                    />
                                </div>

                                <div>
                                    <label className="label">Password *</label>
                                    <input
                                        {...createForm.register('password', { required: true, minLength: 6 })}
                                        type="password"
                                        className="input"
                                        placeholder="Min 6 characters"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Role *</label>
                                        <select {...createForm.register('role')} className="input">
                                            <option value="EMPLOYEE">Employee</option>
                                            <option value="MANAGER">Manager</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Department *</label>
                                        <input
                                            {...createForm.register('department', { required: true })}
                                            className="input"
                                            placeholder="Engineering"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="btn-ghost flex-1"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createMutation.isPending}
                                        className="btn-primary flex-1"
                                    >
                                        {createMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4" />
                                                Create User
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={() => setEditingUser(null)}
                    />
                    <div className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="card p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Edit User</h3>
                                <button onClick={() => setEditingUser(null)} className="btn-icon btn-ghost">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                                <div>
                                    <label className="label">Full Name *</label>
                                    <input
                                        {...editForm.register('name', { required: true })}
                                        className="input"
                                    />
                                </div>

                                <div>
                                    <label className="label">Email *</label>
                                    <input
                                        {...editForm.register('email', { required: true })}
                                        type="email"
                                        className="input"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Role *</label>
                                        <select {...editForm.register('role')} className="input">
                                            <option value="EMPLOYEE">Employee</option>
                                            <option value="MANAGER">Manager</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Department *</label>
                                        <input
                                            {...editForm.register('department', { required: true })}
                                            className="input"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        className="btn-ghost flex-1"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={updateMutation.isPending}
                                        className="btn-primary flex-1"
                                    >
                                        {updateMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    )
}
