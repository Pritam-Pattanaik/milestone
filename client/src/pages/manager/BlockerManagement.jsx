import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { blockerAPI } from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
    AlertTriangle,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    Loader2,
    X,
    Filter
} from 'lucide-react'

export default function BlockerManagement() {
    const [selectedBlocker, setSelectedBlocker] = useState(null)
    const [action, setAction] = useState(null) // 'escalate' | 'resolve'
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [escalationData, setEscalationData] = useState({ to: '', notes: '', deadline: '' })
    const [severityFilter, setSeverityFilter] = useState('all')
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['active-blockers', severityFilter],
        queryFn: () => blockerAPI.getActive({ severity: severityFilter }).then(res => res.data.data)
    })

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }) => blockerAPI.updateStatus(id, { status }),
        onSuccess: () => {
            toast.success('Status updated!')
            queryClient.invalidateQueries(['active-blockers'])
        }
    })

    const escalateMutation = useMutation({
        mutationFn: ({ id, data }) => blockerAPI.escalate(id, data),
        onSuccess: () => {
            toast.success('Blocker escalated!')
            queryClient.invalidateQueries(['active-blockers'])
            closeModal()
        }
    })

    const resolveMutation = useMutation({
        mutationFn: ({ id, resolutionNotes }) => blockerAPI.resolve(id, { resolutionNotes }),
        onSuccess: () => {
            toast.success('Blocker resolved! ✅')
            queryClient.invalidateQueries(['active-blockers'])
            closeModal()
        }
    })

    const blockers = data?.blockers || []
    const counts = data?.counts || {}

    const closeModal = () => {
        setSelectedBlocker(null)
        setAction(null)
        setResolutionNotes('')
        setEscalationData({ to: '', notes: '', deadline: '' })
    }

    const handleEscalate = () => {
        if (!escalationData.to) {
            toast.error('Please specify who to escalate to')
            return
        }
        escalateMutation.mutate({
            id: selectedBlocker.id,
            data: {
                escalatedTo: escalationData.to,
                escalationNotes: escalationData.notes,
                escalationDeadline: escalationData.deadline || undefined
            }
        })
    }

    const handleResolve = () => {
        if (resolutionNotes.length < 20) {
            toast.error('Resolution notes must be at least 20 characters')
            return
        }
        resolveMutation.mutate({ id: selectedBlocker.id, resolutionNotes })
    }

    const getSeverityClass = (severity) => {
        const classes = {
            LOW: 'bg-success-500/20 text-success-400 border-success-500/30',
            MEDIUM: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
            HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            CRITICAL: 'bg-danger-500/20 text-danger-400 border-danger-500/30 animate-pulse'
        }
        return classes[severity] || classes.MEDIUM
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white">Blocker Management</h1>
                    <p className="text-slate-400">Manage and resolve team blockers</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Critical</span>
                    <p className="stat-value text-danger-400">{counts.critical || 0}</p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">High</span>
                    <p className="stat-value text-orange-400">{counts.high || 0}</p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Medium</span>
                    <p className="stat-value text-warning-400">{counts.medium || 0}</p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Low</span>
                    <p className="stat-value text-success-400">{counts.low || 0}</p>
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="input w-auto py-2"
                >
                    <option value="all">All Severity</option>
                    <option value="CRITICAL">Critical Only</option>
                    <option value="HIGH">High Only</option>
                    <option value="MEDIUM">Medium Only</option>
                    <option value="LOW">Low Only</option>
                </select>
            </div>

            {/* Blockers table */}
            {blockers.length === 0 ? (
                <div className="card p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-success-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No active blockers!</h3>
                    <p className="text-slate-400">All blockers have been resolved.</p>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Blocker</th>
                                <th>Raised By</th>
                                <th>Severity</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {blockers.map((blocker) => (
                                <tr key={blocker.id}>
                                    <td>
                                        <div>
                                            <p className="font-medium text-white">{blocker.title}</p>
                                            <p className="text-sm text-slate-500 line-clamp-1">{blocker.description}</p>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-medium">
                                                {blocker.user?.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm text-white">{blocker.user?.name}</p>
                                                <p className="text-xs text-slate-500">{blocker.user?.department}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${getSeverityClass(blocker.severity)}`}>
                                            {blocker.severity}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${blocker.status === 'OPEN' ? 'badge-danger' :
                                                blocker.status === 'IN_PROGRESS' ? 'badge-warning' :
                                                    'badge-primary'
                                            }`}>
                                            {blocker.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="text-sm text-slate-400">
                                        {format(new Date(blocker.createdAt), 'MMM d, h:mm a')}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            {blocker.status === 'OPEN' && (
                                                <button
                                                    onClick={() => updateStatusMutation.mutate({ id: blocker.id, status: 'IN_PROGRESS' })}
                                                    className="btn-ghost text-xs px-2 py-1"
                                                >
                                                    <Clock className="w-3 h-3" />
                                                    Start
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setSelectedBlocker(blocker); setAction('escalate'); }}
                                                className="btn-ghost text-xs px-2 py-1"
                                            >
                                                <ArrowUpRight className="w-3 h-3" />
                                                Escalate
                                            </button>
                                            <button
                                                onClick={() => { setSelectedBlocker(blocker); setAction('resolve'); }}
                                                className="btn-success text-xs px-2 py-1"
                                            >
                                                <CheckCircle2 className="w-3 h-3" />
                                                Resolve
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Action Modal */}
            {selectedBlocker && action && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={closeModal}
                    />
                    <div className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="card p-6"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">
                                    {action === 'escalate' ? 'Escalate Blocker' : 'Resolve Blocker'}
                                </h3>
                                <button onClick={closeModal} className="btn-icon btn-ghost">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                                <p className="font-medium text-white">{selectedBlocker.title}</p>
                                <p className="text-sm text-slate-500">{selectedBlocker.user?.name}</p>
                            </div>

                            {action === 'escalate' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="label">Escalate To *</label>
                                        <input
                                            value={escalationData.to}
                                            onChange={(e) => setEscalationData(prev => ({ ...prev, to: e.target.value }))}
                                            className="input"
                                            placeholder="e.g., CTO, HR Head, DevOps Lead"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Notes (optional)</label>
                                        <textarea
                                            value={escalationData.notes}
                                            onChange={(e) => setEscalationData(prev => ({ ...prev, notes: e.target.value }))}
                                            className="input min-h-[80px]"
                                            placeholder="Add context for escalation..."
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Deadline (optional)</label>
                                        <input
                                            type="date"
                                            value={escalationData.deadline}
                                            onChange={(e) => setEscalationData(prev => ({ ...prev, deadline: e.target.value }))}
                                            className="input"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="label">Resolution Notes * (min 20 chars)</label>
                                    <textarea
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                        className="input min-h-[120px]"
                                        placeholder="Describe how this blocker was resolved..."
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-3 mt-6">
                                <button onClick={closeModal} className="btn-ghost flex-1">Cancel</button>
                                <button
                                    onClick={action === 'escalate' ? handleEscalate : handleResolve}
                                    disabled={escalateMutation.isPending || resolveMutation.isPending}
                                    className={action === 'escalate' ? 'btn-primary flex-1' : 'btn-success flex-1'}
                                >
                                    {(escalateMutation.isPending || resolveMutation.isPending) ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : action === 'escalate' ? (
                                        <>
                                            <ArrowUpRight className="w-4 h-4" />
                                            Escalate
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Resolve
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    )
}
