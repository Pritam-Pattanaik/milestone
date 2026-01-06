import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Request interceptor - Add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

// Response interceptor - Handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            try {
                const refreshToken = localStorage.getItem('refreshToken')
                if (!refreshToken) {
                    throw new Error('No refresh token')
                }

                // Try to refresh
                const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refreshToken
                })

                const { accessToken } = response.data.data
                localStorage.setItem('accessToken', accessToken)

                // Retry original request
                originalRequest.headers.Authorization = `Bearer ${accessToken}`
                return api(originalRequest)
            } catch (refreshError) {
                // Refresh failed, clear tokens
                localStorage.removeItem('accessToken')
                localStorage.removeItem('refreshToken')
                window.location.href = '/login'
                return Promise.reject(refreshError)
            }
        }

        return Promise.reject(error)
    }
)

export default api

// API helper functions
export const authAPI = {
    login: (data) => api.post('/auth/login', data),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
    refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
    changePassword: (data) => api.put('/auth/change-password', data)
}

export const standupAPI = {
    getToday: () => api.get('/standup/today'),
    setGoal: (data) => api.post('/standup/goal', data),
    submit: (data) => api.post('/standup/submit', data),
    getHistory: (params) => api.get('/standup/history', { params }),
    getPendingReviews: () => api.get('/standup/pending-reviews'),
    review: (id, data) => api.put(`/standup/${id}/review`, data),
    getTeamOverview: () => api.get('/standup/team-overview')
}

export const blockerAPI = {
    create: (data) => api.post('/blocker', data),
    getMyBlockers: (params) => api.get('/blocker/my-blockers', { params }),
    getActive: (params) => api.get('/blocker/active', { params }),
    getById: (id) => api.get(`/blocker/${id}`),
    updateStatus: (id, data) => api.put(`/blocker/${id}/status`, data),
    escalate: (id, data) => api.post(`/blocker/${id}/escalate`, data),
    resolve: (id, data) => api.put(`/blocker/${id}/resolve`, data),
    getAnalytics: () => api.get('/blocker/analytics/overview')
}

export const uploadAPI = {
    uploadToStandup: (standupId, files) => {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        return api.post(`/upload/standup/${standupId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
    },
    uploadToBlocker: (blockerId, files) => {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        return api.post(`/upload/blocker/${blockerId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
    },
    delete: (fileId) => api.delete(`/upload/${fileId}`),
    getDownloadUrl: (fileId) => `${API_BASE_URL}/upload/${fileId}`
}

export const attendanceAPI = {
    getMy: (params) => api.get('/attendance/my', { params }),
    getToday: () => api.get('/attendance/today'),
    getUser: (userId, params) => api.get(`/attendance/user/${userId}`, { params }),
    getReport: (params) => api.get('/attendance/report', { params }),
    getTeamToday: () => api.get('/attendance/team-today')
}

export const userAPI = {
    getAll: (params) => api.get('/users', { params }),
    getById: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
    reactivate: (id) => api.post(`/users/${id}/reactivate`)
}

export const analyticsAPI = {
    getOverview: () => api.get('/analytics/overview'),
    getDepartment: (dept) => api.get(`/analytics/department/${dept}`),
    getProductivityTrends: (params) => api.get('/analytics/productivity-trends', { params }),
    export: (params) => api.get('/analytics/export', { params })
}

export const aiAPI = {
    suggestGoals: () => api.post('/ai/suggest-goals'),
    analyzeStandup: (standupId) => api.post('/ai/analyze-standup', { standupId }),
    analyzeBlocker: (blockerId) => api.post('/ai/analyze-blocker', { blockerId }),
    getWeeklyReport: () => api.get('/ai/weekly-report'),
    analyzeSentiment: (text) => api.post('/ai/sentiment', { text })
}
