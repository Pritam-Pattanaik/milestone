const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Allowed file types
const ALLOWED_TYPES = process.env.ALLOWED_FILE_TYPES?.split(',') ||
    ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'zip'];

const ALLOWED_MIMES = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'zip': 'application/zip'
};

// Configure multer for local storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', '..', '..', 'uploads');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);

    if (!ALLOWED_TYPES.includes(ext)) {
        const error = new Error(`Invalid file type: ${ext}. Allowed: ${ALLOWED_TYPES.join(', ')}`);
        error.code = 'INVALID_FILE_TYPE';
        return cb(error, false);
    }

    cb(null, true);
};

// Multer instance
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
        files: 5 // Max 5 files per request
    }
});

/**
 * POST /api/v1/upload/standup/:id
 * Upload files to a standup
 */
router.post('/standup/:id',
    authenticate,
    upload.array('files', 5),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Verify standup exists and belongs to user
        const standup = await prisma.standup.findUnique({
            where: { id }
        });

        if (!standup) {
            // Clean up uploaded files
            for (const file of req.files || []) {
                fs.unlinkSync(file.path);
            }
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Standup not found'
                }
            });
        }

        if (standup.userId !== req.user.id) {
            // Clean up uploaded files
            for (const file of req.files || []) {
                fs.unlinkSync(file.path);
            }
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only upload files to your own standup.'
                }
            });
        }

        // Check if standup is still editable (not submitted)
        if (['SUBMITTED', 'APPROVED'].includes(standup.status)) {
            // Clean up uploaded files
            for (const file of req.files || []) {
                fs.unlinkSync(file.path);
            }
            return res.status(400).json({
                success: false,
                error: {
                    code: 'STANDUP_LOCKED',
                    message: 'Cannot add files to a submitted standup.'
                }
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILES',
                    message: 'No files provided'
                }
            });
        }

        // Create file records
        const files = await Promise.all(
            req.files.map(file =>
                prisma.file.create({
                    data: {
                        filename: file.filename,
                        originalName: file.originalname,
                        filepath: file.path,
                        filesize: file.size,
                        mimetype: file.mimetype,
                        standupId: id
                    }
                })
            )
        );

        res.status(201).json({
            success: true,
            message: `${files.length} file(s) uploaded successfully`,
            data: { files }
        });
    })
);

/**
 * POST /api/v1/upload/blocker/:id
 * Upload files to a blocker
 */
router.post('/blocker/:id',
    authenticate,
    upload.array('files', 5),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Verify blocker exists and belongs to user
        const blocker = await prisma.blocker.findUnique({
            where: { id }
        });

        if (!blocker) {
            // Clean up uploaded files
            for (const file of req.files || []) {
                fs.unlinkSync(file.path);
            }
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Blocker not found'
                }
            });
        }

        if (blocker.userId !== req.user.id && req.user.role === 'EMPLOYEE') {
            // Clean up uploaded files
            for (const file of req.files || []) {
                fs.unlinkSync(file.path);
            }
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only upload files to your own blockers.'
                }
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILES',
                    message: 'No files provided'
                }
            });
        }

        // Create file records
        const files = await Promise.all(
            req.files.map(file =>
                prisma.file.create({
                    data: {
                        filename: file.filename,
                        originalName: file.originalname,
                        filepath: file.path,
                        filesize: file.size,
                        mimetype: file.mimetype,
                        blockerId: id
                    }
                })
            )
        );

        res.status(201).json({
            success: true,
            message: `${files.length} file(s) uploaded successfully`,
            data: { files }
        });
    })
);

/**
 * GET /api/v1/upload/:fileId
 * Download/view a file
 */
router.get('/:fileId',
    authenticate,
    asyncHandler(async (req, res) => {
        const { fileId } = req.params;

        const file = await prisma.file.findUnique({
            where: { id: fileId },
            include: {
                standup: { select: { userId: true } },
                blocker: { select: { userId: true } }
            }
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'File not found'
                }
            });
        }

        // Check access (owner or manager+)
        const ownerId = file.standup?.userId || file.blocker?.userId;
        if (req.user.role === 'EMPLOYEE' && ownerId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Access denied'
                }
            });
        }

        // Check if file exists on disk
        if (!fs.existsSync(file.filepath)) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'FILE_NOT_FOUND',
                    message: 'File not found on disk'
                }
            });
        }

        // Set content headers
        res.setHeader('Content-Type', file.mimetype);
        res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
        res.setHeader('Content-Length', file.filesize);

        // Stream file
        const fileStream = fs.createReadStream(file.filepath);
        fileStream.pipe(res);
    })
);

/**
 * DELETE /api/v1/upload/:fileId
 * Delete a file (only before submission)
 */
router.delete('/:fileId',
    authenticate,
    asyncHandler(async (req, res) => {
        const { fileId } = req.params;

        const file = await prisma.file.findUnique({
            where: { id: fileId },
            include: {
                standup: { select: { userId: true, status: true } },
                blocker: { select: { userId: true, status: true } }
            }
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'File not found'
                }
            });
        }

        // Check ownership
        const ownerId = file.standup?.userId || file.blocker?.userId;
        if (ownerId !== req.user.id && req.user.role === 'EMPLOYEE') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only delete your own files.'
                }
            });
        }

        // Check if standup is locked
        if (file.standup && ['SUBMITTED', 'APPROVED'].includes(file.standup.status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'FILE_LOCKED',
                    message: 'Cannot delete files from a submitted standup.'
                }
            });
        }

        // Delete from disk
        if (fs.existsSync(file.filepath)) {
            fs.unlinkSync(file.filepath);
        }

        // Delete from database
        await prisma.file.delete({ where: { id: fileId } });

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    })
);

// Error handler for multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                error: {
                    code: 'FILE_TOO_LARGE',
                    message: `File size exceeds the limit of ${(parseInt(process.env.MAX_FILE_SIZE) || 10485760) / 1024 / 1024}MB.`
                }
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'TOO_MANY_FILES',
                    message: 'Maximum 5 files allowed per upload.'
                }
            });
        }
    }

    if (error.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_FILE_TYPE',
                message: error.message
            }
        });
    }

    next(error);
});

module.exports = router;
