import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { standupAPI } from '../../lib/api'
import { format } from 'date-fns'
import {
    Calendar,
    CheckCircle2,
    Target,
    Clock,
    Loader2,
    FileText,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { useState } from 'react'

export default function StandupHistory() {
    const [expandedId, setExpandedId] = useState(null)

    const { data, isLoading } = useQuery({
        queryKey: ['standup-history'],
        queryFn: () => standupAPI.getHistory({ limit: 30 }).then(res => res.data.data)
    })

    const standups = data?.standups || []

    const getStatusBadge = (status) => {
        const config = {
            PENDING: { class: 'status-pending', label: 'Pending' },
            GOAL_SET: { class: 'status-goal-set', label: 'Goal Set' },
            SUBMITTED: { class: 'status-submitted', label: 'Submitted' },
            APPROVED: { class: 'status-approved', label: 'Approved' },
            NEEDS_ATTENTION: { class: 'status-needs-attention', label: 'Needs Attention' }
        }
        return config[status] || config.PENDING
    }

    const getGoalStatusIcon = (status) => {
        if (status === 'ACHIEVED') return <CheckCircle2 className="w-4 h-4 text-success-400" />
        if (status === 'PARTIALLY_ACHIEVED') return <Clock className="w-4 h-4 text-warning-400" />
        return <Target className="w-4 h-4 text-danger-400" />
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
            <div>
                <h1 className="text-2xl font-heading font-bold text-white">Standup History</h1>
                <p className="text-slate-400">View your past goals and achievements</p>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Total Standups</span>
                    <p className="stat-value text-primary-400">{data?.pagination?.total || 0}</p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Goals Achieved</span>
                    <p className="stat-value text-success-400">
                        {standups.filter(s => s.goalStatus === 'ACHIEVED').length}
                    </p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Partially Achieved</span>
                    <p className="stat-value text-warning-400">
                        {standups.filter(s => s.goalStatus === 'PARTIALLY_ACHIEVED').length}
                    </p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Completion Rate</span>
                    <p className="stat-value text-primary-400">
                        {standups.filter(s => s.goalStatus).length > 0
                            ? Math.round((standups.filter(s => s.goalStatus === 'ACHIEVED').length /
                                standups.filter(s => s.goalStatus).length) * 100)
                            : 0}%
                    </p>
                </div>
            </div>

            {/* History list */}
            <div className="space-y-3">
                {standups.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-400 mb-2">No history yet</h3>
                        <p className="text-slate-500">Start setting goals and your history will appear here.</p>
                    </div>
                ) : (
                    standups.map((standup, index) => {
                        const statusBadge = getStatusBadge(standup.status)
                        const isExpanded = expandedId === standup.id

                        return (
                            <motion.div
                                key={standup.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="card overflow-hidden"
                            >
                                {/* Header row */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : standup.id)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-white">
                                                {format(new Date(standup.date), 'd')}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {format(new Date(standup.date), 'MMM')}
                                            </p>
                                        </div>
                                        <div className="h-10 w-px bg-slate-700" />
                                        <div className="text-left">
                                            <p className="font-medium text-white">
                                                {standup.achievementTitle || standup.todayGoal?.substring(0, 50) + '...' || 'No goal set'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`badge text-xs ${statusBadge.class}`}>
                                                    {statusBadge.label}
                                                </span>
                                                {standup.goalStatus && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                                        {getGoalStatusIcon(standup.goalStatus)}
                                                        {standup.goalStatus.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {standup.aiInsights?.score && (
                                            <span className="text-sm text-primary-400 font-medium">
                                                Score: {standup.aiInsights.score}/10
                                            </span>
                                        )}
                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-4 pb-4 border-t border-slate-800"
                                    >
                                        <div className="pt-4 space-y-4">
                                            {/* Goal */}
                                            {standup.todayGoal && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Goal</p>
                                                    <p className="text-slate-300">{standup.todayGoal}</p>
                                                    {standup.goalSetTime && (
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Set at {format(new Date(standup.goalSetTime), 'h:mm a')}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Achievement */}
                                            {standup.achievementDesc && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Achievement</p>
                                                    <p className="text-slate-300">{standup.achievementDesc}</p>
                                                    {standup.submissionTime && (
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Submitted at {format(new Date(standup.submissionTime), 'h:mm a')}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Reason if not achieved */}
                                            {standup.notAchievedReason && (
                                                <div className="p-3 bg-warning-500/10 rounded-lg">
                                                    <p className="text-xs text-warning-400 font-medium mb-1">Reason:</p>
                                                    <p className="text-sm text-slate-300">{standup.notAchievedReason}</p>
                                                </div>
                                            )}

                                            {/* Files */}
                                            {standup.uploadedFiles?.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Attachments</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {standup.uploadedFiles.map(file => (
                                                            <span
                                                                key={file.id}
                                                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 rounded-lg text-xs text-slate-300"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                                {file.originalName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Manager feedback */}
                                            {standup.managerFeedback && (
                                                <div className="p-3 bg-success-500/10 rounded-lg">
                                                    <p className="text-xs text-success-400 font-medium mb-1">Manager Feedback:</p>
                                                    <p className="text-sm text-slate-300">{standup.managerFeedback}</p>
                                                </div>
                                            )}

                                            {/* AI insights */}
                                            {standup.aiInsights && (
                                                <div className="p-3 bg-primary-500/10 rounded-lg">
                                                    <p className="text-xs text-primary-400 font-medium mb-1">AI Analysis:</p>
                                                    <p className="text-sm text-slate-300">{standup.aiInsights.feedback}</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )
                    })
                )}
            </div>

            {/* Load more */}
            {data?.pagination?.hasMore && (
                <div className="text-center">
                    <button className="btn-ghost">
                        Load More
                    </button>
                </div>
            )}
        </div>
    )
}
