import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { standupAPI, aiAPI, uploadAPI } from '../../lib/api'
import toast from 'react-hot-toast'
import FileUpload from '../../components/common/FileUpload'
import {
    Target,
    CheckCircle2,
    Sparkles,
    Loader2,
    Calendar,
    Clock,
    Upload,
    Trash2,
    AlertCircle,
    FileText,
    Plus
} from 'lucide-react'
import { format } from 'date-fns'

export default function MyStandups() {
    const [files, setFiles] = useState([])
    const [showAiSuggestions, setShowAiSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const queryClient = useQueryClient()

    // Fetch today's standups (array)
    const { data: standups = [], isLoading } = useQuery({
        queryKey: ['today-standups'],
        queryFn: () => standupAPI.getToday().then(res => res.data.data.standups)
    })

    // Currently selected standup
    const standup = standups[selectedIndex] || null

    // Goal form
    const goalForm = useForm({
        defaultValues: { todayGoal: '' }
    })

    // Submission form
    const submitForm = useForm({
        defaultValues: {
            achievementTitle: '',
            achievementDesc: '',
            goalStatus: '',
            completionPercentage: 100,
            notAchievedReason: ''
        }
    })

    const goalStatus = submitForm.watch('goalStatus')

    // Create new standup mutation
    const createStandup = useMutation({
        mutationFn: () => standupAPI.create(),
        onSuccess: (response) => {
            toast.success(response.data.message || 'New standup created!')
            queryClient.invalidateQueries(['today-standups'])
            // Select the new standup
            setSelectedIndex(standups.length)
            goalForm.reset()
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to create standup')
        }
    })

    // Set goal mutation
    const setGoal = useMutation({
        mutationFn: (data) => standupAPI.setGoal({ ...data, standupId: standup?.id }),
        onSuccess: () => {
            toast.success(`🎯 Goal set for Standup #${standup?.sequence || 1}!`)
            queryClient.invalidateQueries(['today-standups'])
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to set goal')
        }
    })

    // Submit achievement mutation
    const submitAchievement = useMutation({
        mutationFn: async (data) => {
            const response = await standupAPI.submit({ ...data, standupId: standup?.id })
            const standupId = response.data.data.standup.id

            // Upload files if any
            if (files.length > 0) {
                await uploadAPI.uploadToStandup(standupId, files)
            }

            return response.data
        },
        onSuccess: () => {
            toast.success(`🎉 Standup #${standup?.sequence || 1} submitted! Great work!`)
            queryClient.invalidateQueries(['today-standups'])
            setFiles([])
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to submit')
        }
    })

    // AI suggestions
    const { data: aiSuggestions, isLoading: aiLoading, refetch: fetchSuggestions } = useQuery({
        queryKey: ['ai-suggestions'],
        queryFn: () => aiAPI.suggestGoals().then(res => res.data.data.suggestions),
        enabled: false
    })

    const handleGetSuggestions = async () => {
        setShowAiSuggestions(true)
        fetchSuggestions()
    }

    const useSuggestion = (suggestion) => {
        goalForm.setValue('todayGoal', suggestion)
        setShowAiSuggestions(false)
    }

    const onSubmitGoal = (data) => {
        setGoal.mutate(data)
    }

    const onSubmitAchievement = (data) => {
        if (!window.confirm('⚠️ Are you sure? Submissions cannot be edited after submit.')) {
            return
        }
        submitAchievement.mutate(data)
    }

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
        )
    }

    // Determine current state for selected standup
    const isGoalSet = standup?.status !== 'PENDING' && standup?.todayGoal
    const isSubmitted = ['SUBMITTED', 'APPROVED', 'NEEDS_ATTENTION'].includes(standup?.status)

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-white">Today's Standups</h1>
                    <p className="text-slate-400">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                </div>
                <button
                    onClick={() => createStandup.mutate()}
                    disabled={createStandup.isPending}
                    className="btn-primary"
                >
                    {createStandup.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    Add Standup
                </button>
            </div>

            {/* Standup Selector Tabs */}
            {standups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {standups.map((s, index) => (
                        <button
                            key={s.id}
                            onClick={() => setSelectedIndex(index)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedIndex === index
                                ? 'bg-primary-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            Standup #{s.sequence}
                            <span className={`ml-2 text-xs ${['SUBMITTED', 'APPROVED'].includes(s.status) ? 'text-success-400' :
                                s.status === 'GOAL_SET' ? 'text-warning-400' : 'text-slate-500'
                                }`}>
                                {s.status === 'SUBMITTED' || s.status === 'APPROVED' ? '✓' :
                                    s.status === 'GOAL_SET' ? '◐' : '○'}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* No standups message */}
            {standups.length === 0 && (
                <div className="card p-8 text-center">
                    <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-primary-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">No Standups Yet</h2>
                    <p className="text-slate-400 mb-4">Click "Add Standup" to create your first standup for today.</p>
                </div>
            )}

            {/* Selected Standup Badge */}
            {standup && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                        Viewing: Standup #{standup.sequence}
                    </span>
                    <div className={`badge ${isSubmitted ? 'badge-success' :
                        isGoalSet ? 'badge-warning' : 'badge-neutral'
                        }`}>
                        {isSubmitted ? 'Submitted' : isGoalSet ? 'Goal Set' : 'Not Started'}
                    </div>
                </div>
            )}

            {/* Goal Section - only show when standup is selected */}
            {standup && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-xl ${isGoalSet ? 'bg-success-500/20' : 'bg-primary-500/20'}`}>
                            <Target className={`w-5 h-5 ${isGoalSet ? 'text-success-400' : 'text-primary-400'}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Goal for Standup #{standup.sequence}</h2>
                            <p className="text-sm text-slate-400">What will you achieve?</p>
                        </div>
                    </div>

                    {isGoalSet ? (
                        // Display set goal
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                                <Clock className="w-4 h-4" />
                                Set at {standup.goalSetTime ? format(new Date(standup.goalSetTime), 'h:mm a') : 'N/A'}
                            </div>
                            <p className="text-slate-200">{standup.todayGoal}</p>
                        </div>
                    ) : (
                        // Goal form
                        <form onSubmit={goalForm.handleSubmit(onSubmitGoal)} className="space-y-4">
                            {/* AI Suggestions button */}
                            <button
                                type="button"
                                onClick={handleGetSuggestions}
                                className="btn-ghost w-full justify-center"
                                disabled={aiLoading}
                            >
                                {aiLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4 text-primary-400" />
                                )}
                                Get AI Suggestions
                            </button>

                            {/* AI Suggestions panel */}
                            {showAiSuggestions && aiSuggestions && (
                                <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/30 space-y-2">
                                    <p className="text-sm text-primary-400 font-medium mb-2">✨ AI-Powered Suggestions:</p>
                                    {aiSuggestions.map((suggestion, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => useSuggestion(suggestion)}
                                            className="w-full text-left p-3 bg-slate-800/50 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div>
                                <textarea
                                    {...goalForm.register('todayGoal', {
                                        required: 'Goal is required',
                                        minLength: { value: 50, message: 'Goal must be at least 50 characters' }
                                    })}
                                    className={`input min-h-[120px] ${goalForm.formState.errors.todayGoal ? 'input-error' : ''}`}
                                    placeholder="Describe your goal for today in detail. Be specific about what you want to accomplish..."
                                />
                                <div className="flex items-center justify-between mt-1">
                                    {goalForm.formState.errors.todayGoal && (
                                        <p className="text-sm text-danger-400">{goalForm.formState.errors.todayGoal.message}</p>
                                    )}
                                    <span className="text-xs text-slate-500 ml-auto">
                                        {goalForm.watch('todayGoal')?.length || 0}/50 min characters
                                    </span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={setGoal.isPending}
                                className="btn-primary w-full"
                            >
                                {setGoal.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Setting Goal...
                                    </>
                                ) : (
                                    <>
                                        <Target className="w-4 h-4" />
                                        Set Today's Goal
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </motion.div>
            )}

            {/* Submission Section */}
            {isGoalSet && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card p-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-xl ${isSubmitted ? 'bg-success-500/20' : 'bg-warning-500/20'}`}>
                            <CheckCircle2 className={`w-5 h-5 ${isSubmitted ? 'text-success-400' : 'text-warning-400'}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">End of Day Submission</h2>
                            <p className="text-sm text-slate-400">Record your achievement</p>
                        </div>
                    </div>

                    {isSubmitted ? (
                        // Display submission
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-800/50 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-white">{standup.achievementTitle}</span>
                                    <span className={`badge ${standup.goalStatus === 'ACHIEVED' ? 'badge-success' :
                                        standup.goalStatus === 'PARTIALLY_ACHIEVED' ? 'badge-warning' :
                                            'badge-danger'
                                        }`}>
                                        {standup.goalStatus?.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-slate-300 text-sm">{standup.achievementDesc}</p>

                                {standup.notAchievedReason && (
                                    <div className="mt-3 p-3 bg-warning-500/10 rounded-lg">
                                        <p className="text-xs text-warning-400 font-medium mb-1">Reason:</p>
                                        <p className="text-sm text-slate-300">{standup.notAchievedReason}</p>
                                    </div>
                                )}

                                {standup.uploadedFiles?.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-xs text-slate-400 mb-2">Attachments:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {standup.uploadedFiles.map(file => (
                                                <a
                                                    key={file.id}
                                                    href={uploadAPI.getDownloadUrl(file.id)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-600"
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    {file.originalName}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* AI Insights */}
                            {standup.aiInsights && (
                                <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="w-4 h-4 text-primary-400" />
                                        <span className="text-sm font-medium text-primary-400">AI Analysis</span>
                                    </div>
                                    <p className="text-sm text-slate-300">{standup.aiInsights.feedback}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs text-slate-400">Quality Score:</span>
                                        <span className="text-sm font-semibold text-primary-400">
                                            {standup.aiInsights.score}/10
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Manager feedback */}
                            {standup.managerFeedback && (
                                <div className="p-4 bg-success-500/10 rounded-xl border border-success-500/30">
                                    <p className="text-xs text-success-400 font-medium mb-1">Manager Feedback:</p>
                                    <p className="text-sm text-slate-300">{standup.managerFeedback}</p>
                                </div>
                            )}

                            {/* Locked notice */}
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <AlertCircle className="w-4 h-4" />
                                This submission is locked and cannot be edited.
                            </div>
                        </div>
                    ) : (
                        // Submission form
                        <form onSubmit={submitForm.handleSubmit(onSubmitAchievement)} className="space-y-5">
                            {/* Achievement Title */}
                            <div>
                                <label className="label">
                                    Achievement Title <span className="text-danger-400">*</span>
                                </label>
                                <input
                                    {...submitForm.register('achievementTitle', {
                                        required: 'Title is required',
                                        maxLength: { value: 100, message: 'Max 100 characters' }
                                    })}
                                    className={`input ${submitForm.formState.errors.achievementTitle ? 'input-error' : ''}`}
                                    placeholder="Brief title of what you achieved today"
                                    maxLength={100}
                                />
                                {submitForm.formState.errors.achievementTitle && (
                                    <p className="mt-1 text-sm text-danger-400">
                                        {submitForm.formState.errors.achievementTitle.message}
                                    </p>
                                )}
                            </div>

                            {/* Achievement Description */}
                            <div>
                                <label className="label">
                                    Description <span className="text-danger-400">*</span>
                                    <span className="text-slate-500 font-normal"> (min 100 characters)</span>
                                </label>
                                <textarea
                                    {...submitForm.register('achievementDesc', {
                                        required: 'Description is required',
                                        minLength: { value: 100, message: 'Minimum 100 characters required' }
                                    })}
                                    className={`input min-h-[150px] ${submitForm.formState.errors.achievementDesc ? 'input-error' : ''}`}
                                    placeholder="Describe in detail what you accomplished today. Include specifics, outcomes, and any relevant metrics..."
                                />
                                <div className="flex justify-between mt-1">
                                    {submitForm.formState.errors.achievementDesc && (
                                        <p className="text-sm text-danger-400">
                                            {submitForm.formState.errors.achievementDesc.message}
                                        </p>
                                    )}
                                    <span className="text-xs text-slate-500 ml-auto">
                                        {submitForm.watch('achievementDesc')?.length || 0}/100 min characters
                                    </span>
                                </div>
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="label">
                                    Attachments <span className="text-slate-500 font-normal">(optional)</span>
                                </label>
                                <FileUpload files={files} setFiles={setFiles} />

                                {files.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {files.map((file, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                                            >
                                                <span className="text-sm text-slate-300 truncate flex-1">
                                                    {file.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(index)}
                                                    className="p-1 text-slate-500 hover:text-danger-400"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Goal Status */}
                            <div>
                                <label className="label">
                                    Goal Status <span className="text-danger-400">*</span>
                                </label>
                                <select
                                    {...submitForm.register('goalStatus', { required: 'Goal status is required' })}
                                    className={`input ${submitForm.formState.errors.goalStatus ? 'input-error' : ''}`}
                                >
                                    <option value="">Select status</option>
                                    <option value="ACHIEVED">✅ Achieved - Completed as planned</option>
                                    <option value="PARTIALLY_ACHIEVED">🔄 Partially Achieved</option>
                                    <option value="NOT_ACHIEVED">❌ Not Achieved</option>
                                </select>
                                {submitForm.formState.errors.goalStatus && (
                                    <p className="mt-1 text-sm text-danger-400">
                                        {submitForm.formState.errors.goalStatus.message}
                                    </p>
                                )}
                            </div>

                            {/* Reason for partial/not achieved */}
                            {(goalStatus === 'PARTIALLY_ACHIEVED' || goalStatus === 'NOT_ACHIEVED') && (
                                <>
                                    {goalStatus === 'PARTIALLY_ACHIEVED' && (
                                        <div>
                                            <label className="label">Completion Percentage</label>
                                            <input
                                                type="number"
                                                {...submitForm.register('completionPercentage', { min: 0, max: 99 })}
                                                className="input"
                                                placeholder="Enter percentage (0-99)"
                                                min="0"
                                                max="99"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="label">
                                            Reason <span className="text-danger-400">*</span>
                                            <span className="text-slate-500 font-normal"> (min 50 characters)</span>
                                        </label>
                                        <textarea
                                            {...submitForm.register('notAchievedReason', {
                                                required: 'Reason is required when goal is not fully achieved',
                                                minLength: { value: 50, message: 'Minimum 50 characters required' }
                                            })}
                                            className={`input min-h-[100px] ${submitForm.formState.errors.notAchievedReason ? 'input-error' : ''}`}
                                            placeholder="Explain what prevented you from fully achieving your goal..."
                                        />
                                        {submitForm.formState.errors.notAchievedReason && (
                                            <p className="mt-1 text-sm text-danger-400">
                                                {submitForm.formState.errors.notAchievedReason.message}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Warning */}
                            <div className="p-4 bg-warning-500/10 rounded-xl border border-warning-500/30">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-warning-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-warning-400">Important</p>
                                        <p className="text-sm text-slate-300">
                                            Once submitted, you cannot edit this achievement. Make sure all information is correct.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={submitAchievement.isPending}
                                className="btn-success w-full"
                            >
                                {submitAchievement.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Submit Achievement
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </motion.div>
            )}
        </div>
    )
}
