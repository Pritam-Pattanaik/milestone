import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { analyticsAPI, aiAPI } from '../../lib/api'
import {
    BarChart3,
    TrendingUp,
    Users,
    Target,
    AlertTriangle,
    Clock,
    Calendar,
    Download,
    Sparkles,
    Loader2
} from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend
} from 'recharts'
import { useState } from 'react'

export default function Analytics() {
    const [dateRange, setDateRange] = useState('30')

    const { data: overview, isLoading: overviewLoading } = useQuery({
        queryKey: ['analytics-overview'],
        queryFn: () => analyticsAPI.getOverview().then(res => res.data.data)
    })

    const { data: trends, isLoading: trendsLoading } = useQuery({
        queryKey: ['productivity-trends', dateRange],
        queryFn: () => analyticsAPI.getProductivityTrends({ days: parseInt(dateRange) }).then(res => res.data.data.trends)
    })

    const { data: aiReport } = useQuery({
        queryKey: ['ai-weekly-report'],
        queryFn: () => aiAPI.getWeeklyReport().then(res => res.data.data.report)
    })

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444']

    const goalStatusData = overview?.thirtyDay ? [
        { name: 'Achieved', value: overview.thirtyDay.achieved || 0 },
        { name: 'Partial', value: overview.thirtyDay.partial || 0 },
        { name: 'Not Achieved', value: overview.thirtyDay.notAchieved || 0 }
    ] : []

    const blockerData = overview?.thirtyDay?.blockersByCategory
        ? Object.entries(overview.thirtyDay.blockersByCategory).map(([key, value]) => ({
            name: key,
            count: value
        }))
        : []

    if (overviewLoading) {
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
                    <h1 className="text-2xl font-heading font-bold text-white">Analytics Dashboard</h1>
                    <p className="text-slate-400">Company-wide productivity insights</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="input w-auto py-2"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                    <button className="btn-ghost">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Today's Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Submission Rate</span>
                        <Target className="w-5 h-5 text-primary-400" />
                    </div>
                    <p className="stat-value text-primary-400">{overview?.today?.submissionRate || 0}%</p>
                    <span className="text-xs text-slate-500">Today</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Attendance Rate</span>
                        <Users className="w-5 h-5 text-success-400" />
                    </div>
                    <p className="stat-value text-success-400">{overview?.today?.attendanceRate || 0}%</p>
                    <span className="text-xs text-slate-500">Today</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Active Blockers</span>
                        <AlertTriangle className="w-5 h-5 text-danger-400" />
                    </div>
                    <p className="stat-value text-danger-400">{overview?.today?.activeBlockers || 0}</p>
                    <span className="text-xs text-slate-500">Unresolved</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Avg Hours</span>
                        <Clock className="w-5 h-5 text-warning-400" />
                    </div>
                    <p className="stat-value text-warning-400">{overview?.today?.avgHoursWorked || 0}h</p>
                    <span className="text-xs text-slate-500">Today</span>
                </motion.div>
            </div>

            {/* 30-Day Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">30-Day Completion Rate</span>
                    <p className="stat-value text-primary-400">{overview?.thirtyDay?.completionRate || 0}%</p>
                    <div className="progress-bar mt-2">
                        <div
                            className="progress-fill bg-primary-500"
                            style={{ width: `${overview?.thirtyDay?.completionRate || 0}%` }}
                        />
                    </div>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Total Standups</span>
                    <p className="stat-value text-success-400">{overview?.thirtyDay?.totalStandups || 0}</p>
                </div>
                <div className="stat-card">
                    <span className="text-slate-400 text-sm">Total Blockers</span>
                    <p className="stat-value text-danger-400">{overview?.thirtyDay?.blockerCount || 0}</p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Productivity Trend */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="card p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary-400" />
                        Productivity Trend
                    </h3>
                    <div className="h-64">
                        {trendsLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trends || []}>
                                    <defs>
                                        <linearGradient id="colorSubmission" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                    <YAxis stroke="#64748b" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid #334155',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="submissionRate"
                                        stroke="#6366f1"
                                        fillOpacity={1}
                                        fill="url(#colorSubmission)"
                                        name="Submission Rate"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Goal Status Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="card p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary-400" />
                        Goal Status Distribution
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={goalStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {goalStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Blockers by Category */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="card p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-danger-400" />
                        Blockers by Category
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={blockerData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#64748b" fontSize={12} />
                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={100} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* AI Weekly Report */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="card p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary-400" />
                        AI Weekly Insights
                    </h3>
                    {aiReport ? (
                        <div className="space-y-4">
                            <p className="text-slate-300 text-sm">{aiReport.executiveSummary}</p>

                            {aiReport.concerns?.length > 0 && (
                                <div className="p-3 bg-warning-500/10 rounded-lg">
                                    <p className="text-xs text-warning-400 font-medium mb-2">⚠️ Concerns</p>
                                    <ul className="text-sm text-slate-300 space-y-1">
                                        {aiReport.concerns.map((c, i) => (
                                            <li key={i}>• {c}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {aiReport.recommendations?.length > 0 && (
                                <div className="p-3 bg-primary-500/10 rounded-lg">
                                    <p className="text-xs text-primary-400 font-medium mb-2">💡 Recommendations</p>
                                    <ul className="text-sm text-slate-300 space-y-1">
                                        {aiReport.recommendations.map((r, i) => (
                                            <li key={i}>• {r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                                <span className="text-xs text-slate-500">Trend:</span>
                                <span className={`badge ${aiReport.trend === 'improving' ? 'badge-success' :
                                        aiReport.trend === 'declining' ? 'badge-danger' :
                                            'badge-neutral'
                                    }`}>
                                    {aiReport.trend || 'stable'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-slate-500">
                            No AI report available yet
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Department Breakdown */}
            {overview?.byDepartment && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="card p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary-400" />
                        Department Breakdown
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Department</th>
                                    <th>Employees</th>
                                    <th>Submission Rate</th>
                                    <th>Completion Rate</th>
                                    <th>Active Blockers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overview.byDepartment.map((dept) => (
                                    <tr key={dept.department}>
                                        <td className="font-medium text-white">{dept.department}</td>
                                        <td>{dept.employees}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary-500 rounded-full"
                                                        style={{ width: `${dept.submissionRate}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-slate-400">{dept.submissionRate}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-success-500 rounded-full"
                                                        style={{ width: `${dept.completionRate}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-slate-400">{dept.completionRate}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={dept.blockers > 0 ? 'text-danger-400' : 'text-success-400'}>
                                                {dept.blockers}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
