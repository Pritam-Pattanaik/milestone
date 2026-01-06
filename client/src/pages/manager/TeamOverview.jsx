import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { standupAPI } from '../../lib/api'
import {
    Users,
    CheckCircle2,
    Target,
    Clock,
    Loader2,
    UserCheck,
    UserX
} from 'lucide-react'

export default function TeamOverview() {
    const { data, isLoading } = useQuery({
        queryKey: ['team-overview'],
        queryFn: () => standupAPI.getTeamOverview().then(res => res.data.data)
    })

    const overview = data?.overview || []
    const stats = data?.stats || {}

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
        )
    }

    const getStatusInfo = (status) => {
        const config = {
            NO_STANDUP: { icon: UserX, color: 'text-slate-400', bg: 'bg-slate-700/50', label: 'Not Started' },
            PENDING: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-700/50', label: 'Pending' },
            GOAL_SET: { icon: Target, color: 'text-primary-400', bg: 'bg-primary-500/20', label: 'Goal Set' },
            SUBMITTED: { icon: Clock, color: 'text-warning-400', bg: 'bg-warning-500/20', label: 'Submitted' },
            APPROVED: { icon: CheckCircle2, color: 'text-success-400', bg: 'bg-success-500/20', label: 'Approved' },
            NEEDS_ATTENTION: { icon: Clock, color: 'text-danger-400', bg: 'bg-danger-500/20', label: 'Needs Attention' }
        }
        return config[status] || config.NO_STANDUP
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-heading font-bold text-white">Team Overview</h1>
                <p className="text-slate-400">Monitor your team's daily standup progress</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Total Team</span>
                        <Users className="w-5 h-5 text-primary-400" />
                    </div>
                    <p className="stat-value text-primary-400">{stats.total || 0}</p>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Goals Set</span>
                        <Target className="w-5 h-5 text-warning-400" />
                    </div>
                    <p className="stat-value text-warning-400">{stats.goalsSet || 0}</p>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Submitted</span>
                        <UserCheck className="w-5 h-5 text-success-400" />
                    </div>
                    <p className="stat-value text-success-400">{stats.submitted || 0}</p>
                </div>
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Pending Review</span>
                        <Clock className="w-5 h-5 text-warning-400" />
                    </div>
                    <p className="stat-value text-warning-400">{stats.pending || 0}</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-400">Today's Progress</span>
                    <span className="text-white font-semibold">
                        {stats.submitted || 0}/{stats.total || 0} submitted
                    </span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-fill bg-gradient-to-r from-primary-500 to-success-500"
                        style={{ width: `${stats.total ? (stats.submitted / stats.total) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Team grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overview.map((item, index) => {
                    const statusInfo = getStatusInfo(item.status)
                    const StatusIcon = statusInfo.icon

                    return (
                        <motion.div
                            key={item.user.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="card p-4 card-hover"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-lg">
                                    {item.user.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{item.user.name}</p>
                                    <p className="text-sm text-slate-500">{item.user.department}</p>
                                </div>
                                <div className={`p-2 rounded-lg ${statusInfo.bg}`}>
                                    <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                                </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-800">
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                    {item.standup?.goalStatus && (
                                        <span className={`text-xs ${item.standup.goalStatus === 'ACHIEVED' ? 'text-success-400' :
                                                item.standup.goalStatus === 'PARTIALLY_ACHIEVED' ? 'text-warning-400' :
                                                    'text-danger-400'
                                            }`}>
                                            {item.standup.goalStatus.replace('_', ' ')}
                                        </span>
                                    )}
                                </div>

                                {item.standup?.todayGoal && (
                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                        Goal: {item.standup.todayGoal}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
