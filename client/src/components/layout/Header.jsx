import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNotifications } from '../../context/NotificationContext'
import { format } from 'date-fns'
import NotificationPanel from '../common/NotificationPanel'
import {
    Bell,
    LogOut,
    Settings,
    User,
    ChevronDown,
    Moon,
    Sun
} from 'lucide-react'

export default function Header() {
    const { user, logout } = useAuth()
    const { darkMode, toggleDarkMode } = useTheme()
    const { unreadCount } = useNotifications()
    const navigate = useNavigate()
    const [showDropdown, setShowDropdown] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)

    const today = new Date()
    const greeting = getGreeting()

    function getGreeting() {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 17) return 'Good afternoon'
        return 'Good evening'
    }

    const handleProfile = () => {
        setShowDropdown(false)
        navigate('/profile')
    }

    const handleSettings = () => {
        setShowDropdown(false)
        navigate('/settings')
    }

    const handleLogout = () => {
        setShowDropdown(false)
        logout()
    }

    return (
        <header className={`h-16 border-b ${darkMode ? 'border-slate-800/50 bg-slate-900/50' : 'border-slate-200 bg-white/80'} backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30`}>
            {/* Left side - Greeting */}
            <div>
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {greeting}, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>! 👋
                </h2>
                <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    {format(today, "EEEE, MMMM d, yyyy")}
                </p>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-3">
                {/* Theme toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="btn-icon btn-ghost"
                    title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {darkMode ? (
                        <Moon className="w-5 h-5 text-primary-400" />
                    ) : (
                        <Sun className="w-5 h-5 text-warning-400" />
                    )}
                </button>

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="btn-icon btn-ghost relative"
                    >
                        <Bell className="w-5 h-5" />
                        {/* Notification badge */}
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-danger-500 text-white text-xs font-bold rounded-full px-1">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Panel */}
                    <NotificationPanel
                        isOpen={showNotifications}
                        onClose={() => setShowNotifications(false)}
                    />
                </div>

                {/* User dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className={`flex items-center gap-2 p-2 rounded-xl ${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-200'} transition-colors`}
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-semibold">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <ChevronDown className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'} transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown menu */}
                    {showDropdown && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-56 card p-2 z-50 animate-slide-down">
                                <div className={`px-3 py-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} mb-2`}>
                                    <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{user?.name}</p>
                                    <p className="text-xs text-slate-500">{user?.email}</p>
                                </div>

                                <button
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'} transition-colors`}
                                    onClick={handleProfile}
                                >
                                    <User className="w-4 h-4" />
                                    <span>Profile</span>
                                </button>

                                <button
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'} transition-colors`}
                                    onClick={handleSettings}
                                >
                                    <Settings className="w-4 h-4" />
                                    <span>Settings</span>
                                </button>

                                <div className={`border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'} my-2`} />

                                <button
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-danger-400 hover:bg-danger-500/10 transition-colors"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Sign out</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
