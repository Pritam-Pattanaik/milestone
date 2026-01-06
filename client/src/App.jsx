import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layouts (load immediately)
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'

// Login loads immediately (first page users see)
import Login from './pages/auth/Login'

// Components (frequently used)
import ProtectedRoute from './components/auth/ProtectedRoute'
import FloatingBlockerButton from './components/common/FloatingBlockerButton'

// Lazy-load pages for code splitting (reduces initial bundle size)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const MyStandups = lazy(() => import('./pages/employee/MyStandups'))
const MyBlockers = lazy(() => import('./pages/employee/MyBlockers'))
const StandupHistory = lazy(() => import('./pages/employee/StandupHistory'))
const PendingReviews = lazy(() => import('./pages/manager/PendingReviews'))
const TeamOverview = lazy(() => import('./pages/manager/TeamOverview'))
const BlockerManagement = lazy(() => import('./pages/manager/BlockerManagement'))
const Analytics = lazy(() => import('./pages/admin/Analytics'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const AttendanceReport = lazy(() => import('./pages/admin/AttendanceReport'))

// Loading spinner for lazy-loaded pages
const PageLoader = () => (
    <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
)

function App() {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400">Loading Milestone...</p>
                </div>
            </div>
        )
    }

    return (
        <>
            <Routes>
                {/* Auth routes */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={
                        user ? <Navigate to="/dashboard" replace /> : <Login />
                    } />
                </Route>

                {/* Protected routes */}
                <Route element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }>
                    {/* Common routes */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={
                        <Suspense fallback={<PageLoader />}>
                            <Dashboard />
                        </Suspense>
                    } />
                    <Route path="/profile" element={
                        <Suspense fallback={<PageLoader />}>
                            <Profile />
                        </Suspense>
                    } />
                    <Route path="/settings" element={
                        <Suspense fallback={<PageLoader />}>
                            <Settings />
                        </Suspense>
                    } />
                    <Route path="/history" element={
                        <Suspense fallback={<PageLoader />}>
                            <StandupHistory />
                        </Suspense>
                    } />

                    {/* Employee routes */}
                    <Route path="/my-standups" element={
                        <Suspense fallback={<PageLoader />}>
                            <MyStandups />
                        </Suspense>
                    } />
                    <Route path="/my-blockers" element={
                        <Suspense fallback={<PageLoader />}>
                            <MyBlockers />
                        </Suspense>
                    } />

                    {/* Manager routes */}
                    <Route path="/reviews" element={
                        <ProtectedRoute requiredRole={['MANAGER', 'ADMIN']}>
                            <Suspense fallback={<PageLoader />}>
                                <PendingReviews />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/team" element={
                        <ProtectedRoute requiredRole={['MANAGER', 'ADMIN']}>
                            <Suspense fallback={<PageLoader />}>
                                <TeamOverview />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/blockers" element={
                        <ProtectedRoute requiredRole={['MANAGER', 'ADMIN']}>
                            <Suspense fallback={<PageLoader />}>
                                <BlockerManagement />
                            </Suspense>
                        </ProtectedRoute>
                    } />

                    {/* Admin routes */}
                    <Route path="/analytics" element={
                        <ProtectedRoute requiredRole={['ADMIN']}>
                            <Suspense fallback={<PageLoader />}>
                                <Analytics />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/users" element={
                        <ProtectedRoute requiredRole={['ADMIN']}>
                            <Suspense fallback={<PageLoader />}>
                                <UserManagement />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/attendance" element={
                        <ProtectedRoute requiredRole={['ADMIN']}>
                            <Suspense fallback={<PageLoader />}>
                                <AttendanceReport />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                </Route>

                {/* 404 */}
                <Route path="*" element={
                    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                        <div className="text-center">
                            <h1 className="text-6xl font-bold text-slate-600 mb-4">404</h1>
                            <p className="text-slate-400 mb-6">Page not found</p>
                            <a href="/dashboard" className="btn-primary">Go to Dashboard</a>
                        </div>
                    </div>
                } />
            </Routes>

            {/* Floating blocker button - always visible when logged in */}
            {user && <FloatingBlockerButton />}
        </>
    )
}

export default App
