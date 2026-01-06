import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { attendanceAPI } from '../../lib/api'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import {
    Calendar,
    Clock,
    Download,
    Filter,
    Loader2,
    UserCheck,
    UserX,
    AlertTriangle
} from 'lucide-react'

export default function AttendanceReport() {
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

    const { data, isLoading } = useQuery({
        queryKey: ['attendance-report', selectedMonth],
        queryFn: () => {
            const [year, month] = selectedMonth.split('-')
            const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1))
            const endDate = endOfMonth(startDate)
            return attendanceAPI.getReport({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            }).then(res => res.data.data)
        }
    })

    const report = data?.report || []
    const summary = data?.summary || {}

    const getStatusBadge = (status) => {
        const config = {
            PRESENT: { class: 'badge-success', icon: UserCheck, label: 'Present' },
            ABSENT: { class: 'badge-danger', icon: UserX, label: 'Absent' },
            LATE: { class: 'badge-warning', icon: AlertTriangle, label: 'Late' },
            HALF_DAY: { class: 'badge-primary', icon: Clock, label: 'Half Day' }
        }
        return config[status] || config.PRESENT
    }

    const calculateAttendanceRate = (present, total) => {
        if (total === 0) return 0
        return Math.round((present / total) * 100)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white">Attendance Report</h1>
                    <p className="text-slate-400">Track employee attendance and work hours</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="input w-auto"
                    />
                    <button className="btn-ghost">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Avg Attendance</span>
                        <Calendar className="w-5 h-5 text-primary-400" />
                    </div>
                    <p className="stat-value text-primary-400">{summary.avgAttendanceRate || 0}%</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Avg Hours/Day</span>
                        <Clock className="w-5 h-5 text-success-400" />
                    </div>
                    <p className="stat-value text-success-400">{summary.avgHoursWorked || 0}h</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Late Arrivals</span>
                        <AlertTriangle className="w-5 h-5 text-warning-400" />
                    </div>
                    <p className="stat-value text-warning-400">{summary.totalLateArrivals || 0}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="stat-card"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Absences</span>
                        <UserX className="w-5 h-5 text-danger-400" />
                    </div>
                    <p className="stat-value text-danger-400">{summary.totalAbsences || 0}</p>
                </motion.div>
            </div>

            {/* Attendance Table */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                </div>
            ) : report.length === 0 ? (
                <div className="card p-12 text-center">
                    <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-400 mb-2">No Data Available</h3>
                    <p className="text-slate-500">No attendance records found for this period.</p>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Department</th>
                                <th>Present</th>
                                <th>Absent</th>
                                <th>Late</th>
                                <th>Attendance Rate</th>
                                <th>Avg Hours</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.map((record, index) => {
                                const attendanceRate = calculateAttendanceRate(
                                    record.presentDays,
                                    record.presentDays + record.absentDays
                                )

                                return (
                                    <motion.tr
                                        key={record.user?.id || index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                    >
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                                                    {record.user?.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{record.user?.name}</p>
                                                    <p className="text-sm text-slate-500">{record.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-slate-400">{record.user?.department}</td>
                                        <td>
                                            <span className="text-success-400 font-medium">{record.presentDays}</span>
                                        </td>
                                        <td>
                                            <span className={record.absentDays > 0 ? 'text-danger-400' : 'text-slate-400'}>
                                                {record.absentDays}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={record.lateDays > 0 ? 'text-warning-400' : 'text-slate-400'}>
                                                {record.lateDays}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${attendanceRate >= 90 ? 'bg-success-500' :
                                                                attendanceRate >= 70 ? 'bg-warning-500' :
                                                                    'bg-danger-500'
                                                            }`}
                                                        style={{ width: `${attendanceRate}%` }}
                                                    />
                                                </div>
                                                <span className={`text-sm font-medium ${attendanceRate >= 90 ? 'text-success-400' :
                                                        attendanceRate >= 70 ? 'text-warning-400' :
                                                            'text-danger-400'
                                                    }`}>
                                                    {attendanceRate}%
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="text-slate-300">{record.avgHoursWorked?.toFixed(1) || 0}h</span>
                                        </td>
                                    </motion.tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Daily Breakdown */}
            {data?.dailyBreakdown && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="card p-6"
                >
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary-400" />
                        Daily Breakdown
                    </h3>
                    <div className="grid grid-cols-7 gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="text-center text-xs text-slate-500 font-medium py-2">
                                {day}
                            </div>
                        ))}
                        {data.dailyBreakdown.map((day, index) => (
                            <div
                                key={index}
                                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium ${day.attendanceRate >= 90 ? 'bg-success-500/20 text-success-400' :
                                        day.attendanceRate >= 70 ? 'bg-warning-500/20 text-warning-400' :
                                            day.attendanceRate > 0 ? 'bg-danger-500/20 text-danger-400' :
                                                'bg-slate-800/50 text-slate-600'
                                    }`}
                                title={`${day.date}: ${day.attendanceRate}%`}
                            >
                                {new Date(day.date).getDate()}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-success-500/20" />
                            ≥90%
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-warning-500/20" />
                            70-89%
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-danger-500/20" />
                            &lt;70%
                        </span>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
