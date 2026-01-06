import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileIcon } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FileUpload({
    files,
    setFiles,
    maxFiles = 5,
    maxSize = 10 * 1024 * 1024,
    accept = {
        'image/*': ['.png', '.jpg', '.jpeg'],
        'application/pdf': ['.pdf'],
        'application/msword': ['.doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        'application/zip': ['.zip']
    }
}) {
    const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
        // Handle rejected files
        if (rejectedFiles.length > 0) {
            rejectedFiles.forEach(({ file, errors }) => {
                errors.forEach(error => {
                    if (error.code === 'file-too-large') {
                        toast.error(`${file.name} is too large. Max size is 10MB.`)
                    } else if (error.code === 'file-invalid-type') {
                        toast.error(`${file.name} has an invalid file type.`)
                    } else if (error.code === 'too-many-files') {
                        toast.error(`Maximum ${maxFiles} files allowed.`)
                    }
                })
            })
        }

        // Check total file count
        if (files.length + acceptedFiles.length > maxFiles) {
            toast.error(`Maximum ${maxFiles} files allowed.`)
            return
        }

        // Add accepted files
        setFiles(prev => [...prev, ...acceptedFiles])
    }, [files, maxFiles, setFiles])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxSize,
        maxFiles: maxFiles - files.length,
        disabled: files.length >= maxFiles
    })

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    return (
        <div
            {...getRootProps()}
            className={`
        relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
        transition-all duration-200
        ${isDragActive
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                }
        ${files.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
      `}
        >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center gap-3">
                <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center
          ${isDragActive ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-700/50 text-slate-400'}
        `}>
                    <Upload className="w-6 h-6" />
                </div>

                {isDragActive ? (
                    <p className="text-primary-400 font-medium">Drop files here...</p>
                ) : files.length >= maxFiles ? (
                    <p className="text-slate-500">Maximum files reached</p>
                ) : (
                    <>
                        <p className="text-slate-300">
                            <span className="text-primary-400 font-medium">Click to upload</span>
                            {' '}or drag and drop
                        </p>
                        <p className="text-xs text-slate-500">
                            PDF, DOC, DOCX, PNG, JPG, ZIP (max 10MB each, up to {maxFiles} files)
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
