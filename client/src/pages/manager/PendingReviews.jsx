import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { standupAPI, uploadAPI } from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
    CheckCircle2,
    Clock,
    Target,
    Loader2,
    FileText,
    Sparkles,
    MessageSquare,
    X,
    AlertTriangle
} from 'lucide-react'

export default function PendingReviews() {
    const [selectedStandup, setSelectedStandup] = useState(null)
    const [feedback, setFeedback] = useState('')
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['pending-reviews'],
        queryFn: () => standupAPI.getPendingReviews().then(res => res.data.data.standups)
    })

    const reviewMutation = useMutation({
        mutationFn: ({ id, action, feedback }) => standupAPI.review(id, { action, feedback }),
        onSuccess: (_, variables) => {
            toast.success(variables.action === 'approve' ? 'Submission approved! ✅' : 'Feedback added!')
            queryClient.invalidateQueries(['pending-reviews'])
            setSelectedStandup(null)
            setFeedback('')
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to review')
        }
    })

    const standups = data || []

    const getGoalStatusColor = (status) => {
        if (status === 'ACHIEVED') return 'text-success-400'
        if (status === 'PARTIALLY_ACHIEVED') return 'text-warning-400'
        return 'text-danger-400'
    }

    const handleApprove = (id) => {
        reviewMutation.mutate({ id, action: 'approve', feedback })
    }

    const handleAddFeedback = (id) => {
        if (!feedback.trim()) {
            toast.error('Please enter feedback')
            return
        }
        reviewMutation.mutate({ id, action: 'feedback', feedback })
    }

    if (isLoading) {
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
                    <h1 className="text-2xl font-heading font-bold text-white">Pending Reviews</h1>
                    <p className="text-slate-400">Review and approve team submissions</p>
                </div>
                <div className="badge badge-warning text-lg px-4 py-2">
                    {standups.length} pending
                </div>
            </div>

            {/* Submissions grid */}
            {standups.length === 0 ? (
                <div className="card p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-success-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">All caught up!</h3>
                    <p className="text-slate-400">No pending submissions to review.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {standups.map((standup, index) => (
                        <motion.div
                            key={standup.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="card p-6 card-hover"
                        >
                            {/* User info */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                                        {standup.user?.name?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{standup.user?.name}</p>
                                        <p className="text-sm text-slate-500">{standup.user?.department}</p>
                                    </div>
                                </div>
                                <span className="text-sm text-slate-500">
                                    {format(new Date(standup.submissionTime), 'MMM d, h:mm a')}
                                </span>
                            </div>

                            {/* Goal */}
                            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                    <Target className="w-3 h-3" />
                                    Today's Goal
                                </div>
                                <p className="text-sm text-slate-300">{standup.todayGoal}</p>
                            </div>

                            {/* Achievement */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-white">{standup.achievementTitle}</h3>
                                    <span className={`text-sm font-medium ${getGoalStatusColor(standup.goalStatus)}`}>
                                        {standup.goalStatus?.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 line-clamp-3">{standup.achievementDesc}</p>
                            </div>

                            {/* Reason if not fully achieved */}
                            {standup.notAchievedReason && (
                                <div className="mb-4 p-3 bg-warning-500/10 rounded-lg">
                                    <p className="text-xs text-warning-400 font-medium mb-1">Reason:</p>
                                    <p className="text-sm text-slate-300">{standup.notAchievedReason}</p>
                                </div>
                            )}

                            {/* Files */}
                            {standup.uploadedFiles?.length > 0 && (
                                <div className="mb-4 flex flex-wrap gap-2">
                                    {standup.uploadedFiles.map(file => (
                                        <a
                                            key={file.id}
                                            href={uploadAPI.getDownloadUrl(file.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 hover:bg-slate-700"
                                        >
                                            <FileText className="w-3 h-3" />
                                            {file.originalName}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* AI Score */}
                            {standup.aiInsights && (
                                <div className="mb-4 p-3 bg-primary-500/10 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary-400" />
                                        <span className="text-sm text-primary-400">AI Score</span>
                                    </div>
                                    <span className="text-lg font-bold text-primary-400">
                                        {standup.aiInsights.score}/10
                                    </span>
                                </div>
                            )}

                            {/* Time info */}
                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Login: {standup.user?.attendance?.loginTime
                                        ? format(new Date(standup.user.attendance.loginTime), 'h:mm a')
                                        : 'N/A'}
                                </span>
                                {standup.isLateSubmission && (
                                    <span className="text-warning-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Late submission
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
                                <button
                                    onClick={() => handleApprove(standup.id)}
                                    disabled={reviewMutation.isPending}
                                    className="btn-success flex-1"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Approve
                                </button>
                                <button
                                    onClick={() => setSelectedStandup(standup)}
                                    className="btn-ghost flex-1"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Feedback
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Feedback Modal */}
            {selectedStandup && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedStandup(null)}
                    />
                    <div className="fixed inset-x-4 top-[20%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="card p-6"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Add Feedback</h3>
                                <button
                                    onClick={() => setSelectedStandup(null)}
                                    className="btn-icon btn-ghost"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-slate-400">
                                    Feedback for <span className="text-white">{selectedStandup.user?.name}</span>
                                </p>
                                <p className="text-xs text-slate-500">
                                    {selectedStandup.achievementTitle}
                                </p>
                            </div>

                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="input min-h-[120px] mb-4"
                                placeholder="Enter your feedback..."
                            />

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedStandup(null)}
                                    className="btn-ghost flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAddFeedback(selectedStandup.id)}
                                    disabled={reviewMutation.isPending}
                                    className="btn-primary flex-1"
                                >
                                    {reviewMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'Send Feedback'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    )
}
