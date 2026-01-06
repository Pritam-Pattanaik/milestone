import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    LayoutDashboard,
    Target,
    AlertTriangle,
    History,
    Users,
    ClipboardCheck,
    BarChart3,
    UserCog,
    Calendar,
    Flag,
    Sparkles
} from 'lucide-react'

export default function Sidebar() {
    const { user, isManager, isAdmin } = useAuth()
    const location = useLocation()

    const employeeLinks = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/my-standups', icon: Target, label: 'Today\'s Standup' },
        { to: '/my-blockers', icon: AlertTriangle, label: 'My Blockers' },
        { to: '/history', icon: History, label: 'History' }
    ]

    const managerLinks = [
        { to: '/reviews', icon: ClipboardCheck, label: 'Pending Reviews' },
        { to: '/team', icon: Users, label: 'Team Overview' },
        { to: '/blockers', icon: AlertTriangle, label: 'Blocker Management' }
    ]

    const adminLinks = [
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/users', icon: UserCog, label: 'User Management' },
        { to: '/attendance', icon: Calendar, label: 'Attendance Report' }
    ]

    const getLinkClass = (isActive) => {
        return `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                ? 'bg-primary-500/10 text-primary-400 border-l-2 border-primary-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`
    }

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/50 flex flex-col z-40">
            {/* Logo */}
            <div className="p-6 border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                        <Flag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-heading font-bold text-xl text-white">Milestone</h1>
                        <p className="text-xs text-slate-500">Every day is a milestone</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {/* Employee links - visible to all */}
                <div className="mb-6">
                    <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        My Workspace
                    </p>
                    {employeeLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => getLinkClass(isActive)}
                        >
                            <link.icon className="w-5 h-5" />
                            <span>{link.label}</span>
                        </NavLink>
                    ))}
                </div>

                {/* Manager links */}
                {isManager && (
                    <div className="mb-6">
                        <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Team Management
                        </p>
                        {managerLinks.map(link => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) => getLinkClass(isActive)}
                            >
                                <link.icon className="w-5 h-5" />
                                <span>{link.label}</span>
                            </NavLink>
                        ))}
                    </div>
                )}

                {/* Admin links */}
                {isAdmin && (
                    <div className="mb-6">
                        <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Administration
                        </p>
                        {adminLinks.map(link => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) => getLinkClass(isActive)}
                            >
                                <link.icon className="w-5 h-5" />
                                <span>{link.label}</span>
                            </NavLink>
                        ))}
                    </div>
                )}
            </nav>

            {/* User info */}
            <div className="p-4 border-t border-slate-800/50">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.department}</p>
                    </div>
                    <span className={`badge ${user?.role === 'ADMIN' ? 'badge-danger' :
                            user?.role === 'MANAGER' ? 'badge-warning' :
                                'badge-primary'
                        }`}>
                        {user?.role}
                    </span>
                </div>
            </div>

            {/* Powered by AI badge */}
            <div className="p-4 pt-0">
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Sparkles className="w-3 h-3 text-primary-400" />
                    <span>Powered by Gemini AI</span>
                </div>
            </div>
        </aside>
    )
}
