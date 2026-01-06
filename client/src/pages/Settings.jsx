import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { useNotifications } from '../context/NotificationContext'
import api from '../lib/api'
import toast from 'react-hot-toast'
import {
    Moon,
    Sun,
    Bell,
    BellOff,
    Lock,
    Eye,
    EyeOff,
    Save,
    Loader2,
    Globe,
    Palette
} from 'lucide-react'

export default function Settings() {
    const { darkMode, toggleDarkMode } = useTheme()
    const { settings: notifSettings, updateSettings: updateNotifSettings } = useNotifications()

    const [showPasswordForm, setShowPasswordForm] = useState(false)
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    })
    const [language, setLanguage] = useState('en')

    const changePassword = useMutation({
        mutationFn: (data) => api.post('/auth/change-password', data),
        onSuccess: () => {
            toast.success('Password changed successfully!')
            setShowPasswordForm(false)
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to change password')
        }
    })

    const handlePasswordChange = () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Passwords do not match!')
            return
        }
        if (passwordData.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters!')
            return
        }
        changePassword.mutate({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
        })
    }

    const handleThemeToggle = () => {
        toggleDarkMode()
        toast.success(`Switched to ${darkMode ? 'light' : 'dark'} mode!`, {
            icon: darkMode ? '☀️' : '🌙'
        })
    }

    const handleNotificationToggle = (key) => {
        updateNotifSettings({ [key]: !notifSettings[key] })
        toast.success('Setting updated!', { icon: '⚙️' })
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className={`text-2xl font-heading font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Settings</h1>
                <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>Manage your preferences and account settings</p>
            </div>

            {/* Appearance */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-500/20 rounded-lg">
                        <Palette className="w-5 h-5 text-primary-400" />
                    </div>
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Appearance</h3>
                </div>

                <div className="space-y-4">
                    {/* Dark Mode Toggle */}
                    <div className={`flex items-center justify-between p-4 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                        <div className="flex items-center gap-3">
                            {darkMode ? (
                                <Moon className="w-5 h-5 text-primary-400" />
                            ) : (
                                <Sun className="w-5 h-5 text-warning-400" />
                            )}
                            <div>
                                <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>Dark Mode</p>
                                <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>Use dark theme for the interface</p>
                            </div>
                        </div>
                        <button
                            onClick={handleThemeToggle}
                            className={`relative w-14 h-7 rounded-full transition-colors ${darkMode ? 'bg-primary-500' : 'bg-slate-300'
                                }`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${darkMode ? 'left-8' : 'left-1'
                                }`} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-success-500/20 rounded-lg">
                        <Bell className="w-5 h-5 text-success-400" />
                    </div>
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Notifications</h3>
                </div>

                <div className="space-y-4">
                    {/* Push Notifications */}
                    <div className={`flex items-center justify-between p-4 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                        <div className="flex items-center gap-3">
                            {notifSettings.enabled ? (
                                <Bell className="w-5 h-5 text-success-400" />
                            ) : (
                                <BellOff className="w-5 h-5 text-slate-500" />
                            )}
                            <div>
                                <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>Push Notifications</p>
                                <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>Receive in-app notifications</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleNotificationToggle('enabled')}
                            className={`relative w-14 h-7 rounded-full transition-colors ${notifSettings.enabled ? 'bg-success-500' : 'bg-slate-300'
                                }`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notifSettings.enabled ? 'left-8' : 'left-1'
                                }`} />
                        </button>
                    </div>

                    {/* Email Notifications */}
                    <div className={`flex items-center justify-between p-4 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                        <div>
                            <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>Email Notifications</p>
                            <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>Receive email updates for important events</p>
                        </div>
                        <button
                            onClick={() => handleNotificationToggle('email')}
                            className={`relative w-14 h-7 rounded-full transition-colors ${notifSettings.email ? 'bg-success-500' : 'bg-slate-300'
                                }`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notifSettings.email ? 'left-8' : 'left-1'
                                }`} />
                        </button>
                    </div>

                    {/* Sound */}
                    <div className={`flex items-center justify-between p-4 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                        <div>
                            <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>Sound Effects</p>
                            <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>Play sounds for notifications</p>
                        </div>
                        <button
                            onClick={() => handleNotificationToggle('sound')}
                            className={`relative w-14 h-7 rounded-full transition-colors ${notifSettings.sound ? 'bg-success-500' : 'bg-slate-300'
                                }`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notifSettings.sound ? 'left-8' : 'left-1'
                                }`} />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Security */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-danger-500/20 rounded-lg">
                        <Lock className="w-5 h-5 text-danger-400" />
                    </div>
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Security</h3>
                </div>

                {!showPasswordForm ? (
                    <button
                        onClick={() => setShowPasswordForm(true)}
                        className="btn-ghost w-full justify-start"
                    >
                        <Lock className="w-4 h-4" />
                        Change Password
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="label">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showPasswords.current ? 'text' : 'password'}
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                    className="input pr-10"
                                    placeholder="Enter current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="label">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPasswords.new ? 'text' : 'password'}
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                    className="input pr-10"
                                    placeholder="Enter new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="label">Confirm New Password</label>
                            <div className="relative">
                                <input
                                    type={showPasswords.confirm ? 'text' : 'password'}
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    className="input pr-10"
                                    placeholder="Confirm new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setShowPasswordForm(false)
                                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                                }}
                                className="btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordChange}
                                disabled={changePassword.isPending}
                                className="btn-primary"
                            >
                                {changePassword.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Update Password
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Language */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-warning-500/20 rounded-lg">
                        <Globe className="w-5 h-5 text-warning-400" />
                    </div>
                    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Language & Region</h3>
                </div>

                <div className={`flex items-center justify-between p-4 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'} rounded-xl`}>
                    <div>
                        <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>Language</p>
                        <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>Select your preferred language</p>
                    </div>
                    <select
                        value={language}
                        onChange={(e) => {
                            setLanguage(e.target.value)
                            toast.success('Language preference saved!', { icon: '🌐' })
                        }}
                        className="input w-auto"
                    >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="hi">हिंदी</option>
                    </select>
                </div>
            </motion.div>
        </div>
    )
}
