import { motion, AnimatePresence } from 'framer-motion'
import { useNotifications } from '../../context/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import {
    Bell,
    X,
    AlertTriangle,
    Target,
    MessageSquare,
    Clock,
    Trash2
} from 'lucide-react'

const iconMap = {
    AlertTriangle,
    Target,
    MessageSquare,
    Clock
}

export default function NotificationPanel({ isOpen, onClose }) {
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll
    } = useNotifications()

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-80 md:w-96 card p-0 z-50 overflow-hidden max-h-[80vh] flex flex-col"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary-400" />
                        <h3 className="font-semibold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="badge badge-primary text-xs">{unreadCount}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-primary-400 hover:text-primary-300"
                            >
                                Mark all read
                            </button>
                        )}
                        <button onClick={onClose} className="btn-icon btn-ghost p-1">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500">No notifications</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {notifications.map((notif) => {
                                const NotifIcon = iconMap[notif.icon] || Bell

                                return (
                                    <motion.div
                                        key={notif.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`p-4 hover:bg-slate-800/50 transition-colors cursor-pointer ${!notif.read ? 'bg-primary-500/5' : ''
                                            }`}
                                        onClick={() => markAsRead(notif.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${!notif.read ? 'bg-primary-500/20' : 'bg-slate-800'
                                                }`}>
                                                <NotifIcon className={`w-4 h-4 ${notif.color}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`font-medium text-sm ${!notif.read ? 'text-white' : 'text-slate-400'
                                                        }`}>
                                                        {notif.title}
                                                    </p>
                                                    {!notif.read && (
                                                        <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                                                    {notif.message}
                                                </p>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-3 border-t border-slate-800">
                        <button
                            onClick={clearAll}
                            className="w-full btn-ghost text-sm text-slate-500 hover:text-danger-400"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear all notifications
                        </button>
                    </div>
                )}
            </motion.div>
        </>
    )
}
