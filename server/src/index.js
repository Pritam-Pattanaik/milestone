require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const standupRoutes = require('./routes/standup');
const blockerRoutes = require('./routes/blocker');
const uploadRoutes = require('./routes/upload');
const attendanceRoutes = require('./routes/attendance');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const aiRoutes = require('./routes/ai');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logger');

// Import scheduled tasks
const { initScheduledTasks } = require('./services/scheduler');

// Initialize Express app
const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Response compression (gzip)
app.use(compression({
    level: 6, // Balance between speed and compression ratio
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting (relaxed for better UX, with stricter auth limits)
const baseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 minutes
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health' // Don't rate limit health checks
});
app.use(baseLimiter);

// Static file serving for uploads (development)
if (process.env.FILE_STORAGE_TYPE === 'local') {
    app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));
}

// =============================================================================
// ROUTES
// =============================================================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Milestone API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/standup', standupRoutes);
app.use('/api/v1/blocker', blockerRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ai', aiRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
});

// Error handler (must be last)
app.use(errorHandler);

// =============================================================================
// SERVER START (only in non-serverless environments)
// =============================================================================

const PORT = process.env.PORT || 5000;

// Only start server if not running as a Vercel serverless function
if (process.env.VERCEL !== '1' && require.main === module) {
    const startServer = async () => {
        try {
            // Initialize scheduled tasks (cron jobs)
            if (process.env.NODE_ENV !== 'test') {
                initScheduledTasks();
            }

            app.listen(PORT, () => {
                console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎯 MILESTONE API SERVER                                 ║
║   "Every day is a milestone"                              ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(12)}                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    };

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    startServer();
}

// Export for Vercel serverless and testing
module.exports = app;

