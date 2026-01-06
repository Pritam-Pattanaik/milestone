import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

const NotificationContext = createContext(null)

// Helper to check if user is authenticated
const isAuthenticated = () => !!localStorage.getItem('accessToken')

export function NotificationProvider({ children }) {
    const queryClient = useQueryClient()

    // Load notification settings from localStorage
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('milestone-settings')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                return {
                    enabled: parsed.notifications ?? true,
                    email: parsed.emailNotifications ?? true,
                    sound: parsed.soundEnabled ?? true
                }
            } catch {
                return { enabled: true, email: true, sound: true }
            }
        }
        return { enabled: true, email: true, sound: true }
    })

    // Store read notification IDs in localStorage
    const [readIds, setReadIds] = useState(() => {
        const saved = localStorage.getItem('milestone-read-notifications')
        if (saved) {
            try {
                return new Set(JSON.parse(saved))
            } catch {
                return new Set()
            }
        }
        return new Set()
    })

    // Clear all flag
    const [cleared, setCleared] = useState(false)

    // Save read IDs to localStorage
    useEffect(() => {
        localStorage.setItem('milestone-read-notifications', JSON.stringify([...readIds]))
    }, [readIds])

    // Fetch notifications
    const { data: rawNotifications = [], refetch } = useQuery({
        queryKey: ['notifications-raw'],
        queryFn: async () => {
            if (!settings.enabled || cleared) {
                return []
            }

            try {
                const [blockers, standups] = await Promise.all([
                    api.get('/blocker/my-blockers?limit=5'),
                    api.get('/standup/history?limit=5')
                ])

                const blockerNotifs = (blockers.data.data.blockers || [])
                    .filter(b => b.status === 'RESOLVED' || b.status === 'ESCALATED')
                    .map(b => ({
                        id: `blocker-${b.id}`,
                        type: 'blocker',
                        title: b.status === 'RESOLVED' ? 'Blocker Resolved' : 'Blocker Escalated',
                        message: b.title,
                        timestamp: b.updatedAt || b.createdAt,
                        icon: 'AlertTriangle',
                        color: b.status === 'RESOLVED' ? 'text-success-400' : 'text-warning-400'
                    }))

                const standupNotifs = (standups.data.data.standups || [])
                    .filter(s => s.managerFeedback)
                    .map(s => ({
                        id: `standup-${s.id}`,
                        type: 'feedback',
                        title: 'Manager Feedback',
                        message: s.managerFeedback?.substring(0, 50) + '...',
                        timestamp: s.updatedAt,
                        icon: 'MessageSquare',
                        color: 'text-primary-400'
                    }))

                // Static notifications
                const staticNotifs = [
                    {
                        id: 'welcome',
                        type: 'system',
                        title: 'Welcome to Milestone!',
                        message: 'Your daily standup portal is ready.',
                        timestamp: new Date().toISOString(),
                        icon: 'Target',
                        color: 'text-primary-400'
                    },
                    {
                        id: 'reminder',
                        type: 'reminder',
                        title: 'Daily Goal Reminder',
                        message: "Don't forget to set your goal for today!",
                        timestamp: new Date().toISOString(),
                        icon: 'Clock',
                        color: 'text-warning-400'
                    }
                ]

                return [...blockerNotifs, ...standupNotifs, ...staticNotifs].slice(0, 10)
            } catch {
                return []
            }
        },
        refetchInterval: settings.enabled && isAuthenticated() ? 30000 : false,
        enabled: settings.enabled && !cleared && isAuthenticated()
    })

    // Apply read status to notifications
    const notifications = rawNotifications.map(n => ({
        ...n,
        read: readIds.has(n.id)
    }))

    const unreadCount = settings.enabled && !cleared
        ? notifications.filter(n => !n.read).length
        : 0

    const markAsRead = useCallback((id) => {
        setReadIds(prev => {
            const next = new Set(prev)
            next.add(id)
            return next
        })
    }, [])

    const markAllAsRead = useCallback(() => {
        setReadIds(prev => {
            const next = new Set(prev)
            notifications.forEach(n => next.add(n.id))
            return next
        })
    }, [notifications])

    const clearAll = useCallback(() => {
        setCleared(true)
        setReadIds(new Set())
    }, [])

    const resetNotifications = useCallback(() => {
        setCleared(false)
        setReadIds(new Set())
        refetch()
    }, [refetch])

    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }))

        // Persist to localStorage
        const saved = JSON.parse(localStorage.getItem('milestone-settings') || '{}')
        if (newSettings.enabled !== undefined) saved.notifications = newSettings.enabled
        if (newSettings.email !== undefined) saved.emailNotifications = newSettings.email
        if (newSettings.sound !== undefined) saved.soundEnabled = newSettings.sound
        localStorage.setItem('milestone-settings', JSON.stringify(saved))

        // Reset cleared state if enabling
        if (newSettings.enabled) {
            setCleared(false)
            refetch()
        }
    }, [refetch])

    const value = {
        notifications: cleared ? [] : notifications,
        unreadCount: cleared ? 0 : unreadCount,
        settings,
        updateSettings,
        markAsRead,
        markAllAsRead,
        clearAll,
        resetNotifications,
        refetch
    }

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    )
}

export function useNotifications() {
    const context = useContext(NotificationContext)
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider')
    }
    return context
}

export default NotificationContext
