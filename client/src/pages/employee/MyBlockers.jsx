import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { blockerAPI } from '../../lib/api'
import { format } from 'date-fns'
import {
    AlertTriangle,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    Loader2,
    Filter
} from 'lucide-react'
import { useState } from 'react'

export default function MyBlockers() {
    const [statusFilter, setStatusFilter] = useState('all')

    const { data, isLoading } = useQuery({
        queryKey: ['my-blockers', statusFilter],
        queryFn: () => blockerAPI.getMyBlockers({ status: statusFilter }).then(res => res.data.data)
    })

    const blockers = data?.blockers || []
    const counts = data?.counts || {}

    const getSeverityClass = (severity) => {
        const classes = {
            LOW: 'severity-low',
            MEDIUM: 'severity-medium',
            HIGH: 'severity-high',
            CRITICAL: 'severity-critical'
        }
        return classes[severity] || 'badge-neutral'
    }

    const getStatusBadge = (status) => {
        const config = {
            OPEN: { class: 'badge-danger', icon: AlertTriangle, label: 'Open' },
            IN_PROGRESS: { class: 'badge-warning', icon: Clock, label: 'In Progress' },
            ESCALATED: { class: 'badge-primary', icon: ArrowUpRight, label: 'Escalated' },
            RESOLVED: { class: 'badge-success', icon: CheckCircle2, label: 'Resolved' }
        }
        return config[status] || config.OPEN
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
                    <h1 className="text-2xl font-heading font-bold text-white">My Blockers</h1>
                    <p className="text-slate-400">Track and manage your reported blockers</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">Open</span>
                    <p className="stat-value text-danger-400">{counts.open || 0}</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">In Progress</span>
                    <p className="stat-value text-warning-400">{counts.inProgress || 0}</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">Escalated</span>
                    <p className="stat-value text-primary-400">{counts.escalated || 0}</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="stat-card"
                >
                    <span className="text-slate-400 text-sm">Resolved</span>
                    <p className="stat-value text-success-400">{counts.resolved || 0}</p>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input w-auto py-2"
                >
                    <option value="all">All Status</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ESCALATED">Escalated</option>
                    <option value="RESOLVED">Resolved</option>
                </select>
            </div>

            {/* Blockers list */}
            <div className="space-y-4">
                {blockers.length === 0 ? (
                    <div className="card p-12 text-center">
                        <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-400 mb-2">No blockers found</h3>
                        <p className="text-slate-500">
                            {statusFilter === 'all'
                                ? "You haven't reported any blockers yet."
                                : `No ${statusFilter.toLowerCase().replace('_', ' ')} blockers.`}
                        </p>
                    </div>
                ) : (
                    blockers.map((blocker, index) => {
                        const statusConfig = getStatusBadge(blocker.status)
                        const StatusIcon = statusConfig.icon

                        return (
                            <motion.div
                                key={blocker.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="card p-6 card-hover"
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`badge ${getSeverityClass(blocker.severity)}`}>
                                                {blocker.severity}
                                            </span>
                                            <span className="badge badge-neutral">{blocker.category}</span>
                                            <span className={`badge ${statusConfig.class}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold text-white mb-2">{blocker.title}</h3>
                                        <p className="text-slate-400 text-sm line-clamp-2">{blocker.description}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        <span>Support: {blocker.supportRequired}</span>
                                        <span>•</span>
                                        <span>Created {format(new Date(blocker.createdAt), 'MMM d, h:mm a')}</span>
                                    </div>
                                    {blocker.uploadedFiles?.length > 0 && (
                                        <span className="text-xs text-slate-500">
                                            {blocker.uploadedFiles.length} file(s) attached
                                        </span>
                                    )}
                                </div>

                                {/* Resolution notes */}
                                {blocker.status === 'RESOLVED' && blocker.resolutionNotes && (
                                    <div className="mt-4 p-3 bg-success-500/10 rounded-lg border border-success-500/30">
                                        <p className="text-xs text-success-400 font-medium mb-1">Resolution:</p>
                                        <p className="text-sm text-slate-300">{blocker.resolutionNotes}</p>
                                        {blocker.resolvedAt && (
                                            <p className="text-xs text-slate-500 mt-2">
                                                Resolved on {format(new Date(blocker.resolvedAt), 'MMM d, yyyy')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Escalation info */}
                                {blocker.status === 'ESCALATED' && (
                                    <div className="mt-4 p-3 bg-primary-500/10 rounded-lg border border-primary-500/30">
                                        <p className="text-xs text-primary-400 font-medium mb-1">Escalated to:</p>
                                        <p className="text-sm text-slate-300">{blocker.escalatedTo}</p>
                                        {blocker.escalationDeadline && (
                                            <p className="text-xs text-slate-500 mt-2">
                                                Deadline: {format(new Date(blocker.escalationDeadline), 'MMM d, yyyy')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* AI Analysis */}
                                {blocker.aiAnalysis && (
                                    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                                        <p className="text-xs text-slate-400 font-medium mb-2">AI Recommendation:</p>
                                        <p className="text-sm text-slate-300">{blocker.aiAnalysis.recommendedAction}</p>
                                    </div>
                                )}
                            </motion.div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
