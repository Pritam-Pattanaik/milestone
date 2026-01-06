import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    AlertTriangle,
    X,
    Upload,
    Trash2,
    Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { blockerAPI, uploadAPI } from '../../lib/api'
import FileUpload from './FileUpload'

export default function FloatingBlockerButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [files, setFiles] = useState([])
    const queryClient = useQueryClient()

    const { register, handleSubmit, reset, formState: { errors } } = useForm()

    const createBlocker = useMutation({
        mutationFn: async (data) => {
            const response = await blockerAPI.create(data)
            const blocker = response.data.data.blocker

            // Upload files if any
            if (files.length > 0) {
                await uploadAPI.uploadToBlocker(blocker.id, files)
            }

            return blocker
        },
        onSuccess: () => {
            toast.success('🚨 Blocker raised! Your manager has been notified.')
            queryClient.invalidateQueries(['my-blockers'])
            queryClient.invalidateQueries(['active-blockers'])
            reset()
            setFiles([])
            setIsOpen(false)
        },
        onError: (error) => {
            toast.error(error.response?.data?.error?.message || 'Failed to raise blocker')
        }
    })

    const onSubmit = (data) => {
        createBlocker.mutate(data)
    }

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <>
            {/* Floating Action Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className="fab"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
                <AlertTriangle className="w-5 h-5" />
                <span className="hidden sm:inline">Raise Blocker</span>
            </motion.button>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed inset-x-4 top-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 max-h-[90vh] overflow-y-auto"
                        >
                            <div className="card p-6">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-danger-500/20 rounded-xl flex items-center justify-center">
                                            <AlertTriangle className="w-5 h-5 text-danger-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-white">Raise a Blocker</h2>
                                            <p className="text-sm text-slate-400">Get help from your team</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="btn-icon btn-ghost"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                    {/* Title */}
                                    <div>
                                        <label className="label">
                                            Blocker Title <span className="text-danger-400">*</span>
                                        </label>
                                        <input
                                            {...register('title', {
                                                required: 'Title is required',
                                                maxLength: { value: 100, message: 'Max 100 characters' }
                                            })}
                                            className={`input ${errors.title ? 'input-error' : ''}`}
                                            placeholder="Brief title describing the blocker"
                                            maxLength={100}
                                        />
                                        {errors.title && (
                                            <p className="mt-1 text-sm text-danger-400">{errors.title.message}</p>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="label">
                                            Description <span className="text-danger-400">*</span>
                                            <span className="text-slate-500 font-normal"> (min 100 characters)</span>
                                        </label>
                                        <textarea
                                            {...register('description', {
                                                required: 'Description is required',
                                                minLength: { value: 100, message: 'Minimum 100 characters required' }
                                            })}
                                            className={`input min-h-[120px] ${errors.description ? 'input-error' : ''}`}
                                            placeholder="Describe the blocker in detail. What's blocking you? What have you tried? What help do you need?"
                                        />
                                        {errors.description && (
                                            <p className="mt-1 text-sm text-danger-400">{errors.description.message}</p>
                                        )}
                                    </div>

                                    {/* Category and Severity */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">
                                                Category <span className="text-danger-400">*</span>
                                            </label>
                                            <select
                                                {...register('category', { required: 'Category is required' })}
                                                className={`input ${errors.category ? 'input-error' : ''}`}
                                            >
                                                <option value="">Select category</option>
                                                <option value="TECHNICAL">Technical</option>
                                                <option value="RESOURCE">Resource</option>
                                                <option value="COMMUNICATION">Communication</option>
                                                <option value="EXTERNAL">External</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                            {errors.category && (
                                                <p className="mt-1 text-sm text-danger-400">{errors.category.message}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="label">
                                                Severity <span className="text-danger-400">*</span>
                                            </label>
                                            <select
                                                {...register('severity', { required: 'Severity is required' })}
                                                className={`input ${errors.severity ? 'input-error' : ''}`}
                                            >
                                                <option value="">Select severity</option>
                                                <option value="LOW">Low - Can work around</option>
                                                <option value="MEDIUM">Medium - Slowing progress</option>
                                                <option value="HIGH">High - Blocking progress</option>
                                                <option value="CRITICAL">Critical - Complete stop</option>
                                            </select>
                                            {errors.severity && (
                                                <p className="mt-1 text-sm text-danger-400">{errors.severity.message}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Support Required */}
                                    <div>
                                        <label className="label">
                                            Support Required From <span className="text-danger-400">*</span>
                                        </label>
                                        <input
                                            {...register('supportRequired', { required: 'This field is required' })}
                                            className={`input ${errors.supportRequired ? 'input-error' : ''}`}
                                            placeholder="e.g., Tech Lead, HR, DevOps Team, Manager"
                                        />
                                        {errors.supportRequired && (
                                            <p className="mt-1 text-sm text-danger-400">{errors.supportRequired.message}</p>
                                        )}
                                    </div>

                                    {/* File Upload */}
                                    <div>
                                        <label className="label">
                                            Attachments <span className="text-slate-500 font-normal">(optional, max 5 files)</span>
                                        </label>
                                        <FileUpload
                                            files={files}
                                            setFiles={setFiles}
                                            maxFiles={5}
                                            accept={{
                                                'image/*': ['.png', '.jpg', '.jpeg'],
                                                'application/pdf': ['.pdf'],
                                                'application/msword': ['.doc'],
                                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                                                'application/zip': ['.zip']
                                            }}
                                        />

                                        {/* File list */}
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
                                                            className="p-1 text-slate-500 hover:text-danger-400 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Submit */}
                                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setIsOpen(false)}
                                            className="btn-ghost"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={createBlocker.isPending}
                                            className="btn-danger"
                                        >
                                            {createBlocker.isPending ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Raise Blocker
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
