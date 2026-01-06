import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { standupAPI, blockerAPI, attendanceAPI, analyticsAPI } from '../lib/api'
import {
    Target,
    CheckCircle2,
    AlertTriangle,
    Clock,
    TrendingUp,
    Users,
    Calendar,
    ArrowRight,
    Sparkles,
    Trophy,
    Flame
} from 'lucide-react'
import { format } from 'date-fns'

export default function Dashboard() {
    const { user, isManager, isAdmin } = useAuth()

    // Fetch today's standup
    const { data: standupData, isLoading: standupLoading } = useQuery({
        queryKey: ['today-standup'],
        queryFn: () => standupAPI.getToday().then(res => res.data.data.standup)
    })

    // Fetch my blockers
    const { data: blockersData } = useQuery({
        queryKey: ['my-blockers'],
        queryFn: () => blockerAPI.getMyBlockers({ status: 'all' }).then(res => res.data.data)
    })

    // Fetch attendance
    const { data: attendanceData } = useQuery({
        queryKey: ['my-attendance'],
        queryFn: () => attendanceAPI.getToday().then(res => res.data.data.attendance)
    })

    // Admin analytics
    const { data: analyticsData } = useQuery({
        queryKey: ['analytics-overview'],
        queryFn: () => analyticsAPI.getOverview().then(res => res.data.data),
        enabled: isAdmin
    })

    // Team overview for managers
    const { data: teamData } = useQuery({
        queryKey: ['team-overview'],
        queryFn: () => standupAPI.getTeamOverview().then(res => res.data.data),
        enabled: isManager
    })

    const standup = standupData
    const myBlockers = blockersData?.counts || { open: 0, inProgress: 0, total: 0 }

    // Determine standup status
    const getStandupStatus = () => {
        if (!standup || standup.status === 'PENDING') return 'NO_GOAL'
        if (standup.status === 'GOAL_SET') return 'GOAL_SET'
        if (['SUBMITTED', 'APPROVED', 'NEEDS_ATTENTION'].includes(standup.status)) return 'SUBMITTED'
        return 'PENDING'
    }

    const standupStatus = getStandupStatus()

    return (
        <div className="space-y-6">
            {/* Welcome banner */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6 bg-gradient-to-r from-primary-600/20 to-success-600/20 border-primary-500/20"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-white mb-2">
                            Welcome back, {user?.name?.split(' ')[0]}! 🎯
                        </h1>
                        <p className="text-slate-300">
                            {standupStatus === 'NO_GOAL' && "Start your day by setting a goal. What will you achieve today?"}
                            {standupStatus === 'GOAL_SET' && "Your goal is set! Keep pushing towards it."}
                            {standupStatus === 'SUBMITTED' && "Great job! You've submitted your achievement for today."}
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(), 'EEEE, MMMM d')}
                    </div>
                </div>
            </motion.div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Today's Goal Status */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Today's Status</span>
                        <div className={`p-2 rounded-lg ${standupStatus === 'SUBMITTED' ? 'bg-success-500/20' :
                                standupStatus === 'GOAL_SET' ? 'bg-warning-500/20' :
                                    'bg-slate-700/50'
                            }`}>
                            {standupStatus === 'SUBMITTED' ? (
                                <CheckCircle2 className="w-5 h-5 text-success-400" />
                            ) : standupStatus === 'GOAL_SET' ? (
                                <Target className="w-5 h-5 text-warning-400" />
                            ) : (
                                <Target className="w-5 h-5 text-slate-400" />
                            )}
                        </div>
                    </div>
                    <p className={`stat-value ${standupStatus === 'SUBMITTED' ? 'text-success-400' :
                            standupStatus === 'GOAL_SET' ? 'text-warning-400' :
                                'text-slate-400'
                        }`}>
                        {standupStatus === 'SUBMITTED' ? 'Submitted' :
                            standupStatus === 'GOAL_SET' ? 'In Progress' :
                                'Not Started'}
                    </p>
                    <Link to="/my-standups" className="text-sm text-primary-400 hover:text-primary-300 inline-flex items-center gap-1">
                        {standupStatus === 'NO_GOAL' ? 'Set your goal' : 'View details'}
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                </motion.div>

                {/* Active Blockers */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Active Blockers</span>
                        <div className={`p-2 rounded-lg ${myBlockers.open > 0 ? 'bg-danger-500/20' : 'bg-success-500/20'
                            }`}>
                            <AlertTriangle className={`w-5 h-5 ${myBlockers.open > 0 ? 'text-danger-400' : 'text-success-400'
                                }`} />
                        </div>
                    </div>
                    <p className={`stat-value ${myBlockers.open > 0 ? 'text-danger-400' : 'text-success-400'
                        }`}>
                        {myBlockers.open}
                    </p>
                    <Link to="/my-blockers" className="text-sm text-primary-400 hover:text-primary-300 inline-flex items-center gap-1">
                        View blockers
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                </motion.div>

                {/* Time logged */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Today's Hours</span>
                        <div className="p-2 rounded-lg bg-primary-500/20">
                            <Clock className="w-5 h-5 text-primary-400" />
                        </div>
                    </div>
                    <p className="stat-value text-primary-400">
                        {attendanceData?.hoursWorked
                            ? `${attendanceData.hoursWorked.toFixed(1)}h`
                            : attendanceData?.loginTime
                                ? 'Active'
                                : '0h'}
                    </p>
                    <span className="text-sm text-slate-500">
                        {attendanceData?.loginTime
                            ? `Logged in at ${format(new Date(attendanceData.loginTime), 'h:mm a')}`
                            : 'Not logged in yet'}
                    </span>
                </motion.div>

                {/* Streak / Achievement */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">This Week</span>
                        <div className="p-2 rounded-lg bg-warning-500/20">
                            <Flame className="w-5 h-5 text-warning-400" />
                        </div>
                    </div>
                    <p className="stat-value text-warning-400">
                        5 🔥
                    </p>
                    <span className="text-sm text-slate-500">Day streak</span>
                </motion.div>
            </div>

            {/* Manager / Admin section */}
            {isManager && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary-400" />
                        Team Overview
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="stat-card">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Submissions Today</span>
                                <CheckCircle2 className="w-5 h-5 text-success-400" />
                            </div>
                            <p className="stat-value text-success-400">
                                {teamData?.stats?.submitted || 0}/{teamData?.stats?.total || 0}
                            </p>
                            <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
                                <div
                                    className="bg-success-500 h-2 rounded-full transition-all"
                                    style={{
                                        width: `${teamData?.stats?.total
                                            ? (teamData.stats.submitted / teamData.stats.total) * 100
                                            : 0}%`
                                    }}
                                />
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Pending Reviews</span>
                                <Clock className="w-5 h-5 text-warning-400" />
                            </div>
                            <p className="stat-value text-warning-400">
                                {teamData?.stats?.pending || 0}
                            </p>
                            <Link to="/reviews" className="text-sm text-primary-400 hover:text-primary-300 inline-flex items-center gap-1">
                                Review now
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-sm">Active Blockers</span>
                                <AlertTriangle className="w-5 h-5 text-danger-400" />
                            </div>
                            <p className="stat-value text-danger-400">
                                {analyticsData?.today?.activeBlockers || 0}
                            </p>
                            <Link to="/blockers" className="text-sm text-primary-400 hover:text-primary-300 inline-flex items-center gap-1">
                                Manage blockers
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Admin analytics preview */}
            {isAdmin && analyticsData && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary-400" />
                        Company Overview
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <span className="text-slate-400 text-sm">Submission Rate</span>
                            <p className="stat-value text-primary-400">
                                {analyticsData.today?.submissionRate || 0}%
                            </p>
                        </div>
                        <div className="stat-card">
                            <span className="text-slate-400 text-sm">Attendance Rate</span>
                            <p className="stat-value text-success-400">
                                {analyticsData.today?.attendanceRate || 0}%
                            </p>
                        </div>
                        <div className="stat-card">
                            <span className="text-slate-400 text-sm">Avg Hours</span>
                            <p className="stat-value text-warning-400">
                                {analyticsData.today?.avgHoursWorked || 0}h
                            </p>
                        </div>
                        <div className="stat-card">
                            <span className="text-slate-400 text-sm">30-Day Completion</span>
                            <p className="stat-value text-primary-400">
                                {analyticsData.thirtyDay?.completionRate || 0}%
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Quick actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="card p-6"
            >
                <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {standupStatus === 'NO_GOAL' && (
                        <Link
                            to="/my-standups"
                            className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/30 hover:bg-primary-500/20 transition-colors group"
                        >
                            <Target className="w-8 h-8 text-primary-400 mb-2" />
                            <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                                Set Today's Goal
                            </h3>
                            <p className="text-sm text-slate-400">Start your day with a clear objective</p>
                        </Link>
                    )}

                    {standupStatus === 'GOAL_SET' && (
                        <Link
                            to="/my-standups"
                            className="p-4 rounded-xl bg-success-500/10 border border-success-500/30 hover:bg-success-500/20 transition-colors group"
                        >
                            <CheckCircle2 className="w-8 h-8 text-success-400 mb-2" />
                            <h3 className="font-semibold text-white group-hover:text-success-400 transition-colors">
                                Submit Achievement
                            </h3>
                            <p className="text-sm text-slate-400">Record what you accomplished today</p>
                        </Link>
                    )}

                    <Link
                        to="/history"
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors group"
                    >
                        <Trophy className="w-8 h-8 text-warning-400 mb-2" />
                        <h3 className="font-semibold text-white group-hover:text-warning-400 transition-colors">
                            View History
                        </h3>
                        <p className="text-sm text-slate-400">See your past achievements</p>
                    </Link>

                    <div
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-primary-500/30 transition-colors group cursor-pointer"
                        onClick={() => { }} // AI suggestions would go here
                    >
                        <Sparkles className="w-8 h-8 text-primary-400 mb-2" />
                        <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                            AI Suggestions
                        </h3>
                        <p className="text-sm text-slate-400">Get personalized goal recommendations</p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
