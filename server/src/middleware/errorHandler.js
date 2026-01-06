/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // Prisma errors
    if (err.code === 'P2002') {
        return res.status(409).json({
            success: false,
            error: {
                code: 'DUPLICATE_ENTRY',
                message: 'A record with this value already exists.',
                details: err.meta?.target
            }
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found.'
            }
        });
    }

    // Multer errors (file upload)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            error: {
                code: 'FILE_TOO_LARGE',
                message: `File size exceeds the limit of ${process.env.MAX_FILE_SIZE / 1024 / 1024}MB.`
            }
        });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'TOO_MANY_FILES',
                message: 'Maximum 5 files allowed per upload.'
            }
        });
    }

    if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_FILE_TYPE',
                message: err.message || 'Invalid file type. Allowed: PDF, DOC, DOCX, PNG, JPG, JPEG, ZIP'
            }
        });
    }

    // Validation errors (express-validator)
    if (err.array && typeof err.array === 'function') {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed.',
                details: err.array()
            }
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid authentication token.'
            }
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Authentication token has expired.'
            }
        });
    }

    // Syntax errors in JSON body
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_JSON',
                message: 'Invalid JSON in request body.'
            }
        });
    }

    // Default server error
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        success: false,
        error: {
            code: err.code || 'SERVER_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred.'
                : err.message
        }
    });
};

/**
 * Async handler wrapper - Catches promise rejections
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create custom error with status code
 */
class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    errorHandler,
    asyncHandler,
    AppError
};
