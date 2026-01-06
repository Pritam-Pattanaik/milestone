// Vercel Serverless Function - Express API
require('dotenv').config({ path: './server/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Import routes from server
const authRoutes = require('../server/src/routes/auth');
const standupRoutes = require('../server/src/routes/standup');
const blockerRoutes = require('../server/src/routes/blocker');
const uploadRoutes = require('../server/src/routes/upload');
const attendanceRoutes = require('../server/src/routes/attendance');
const userRoutes = require('../server/src/routes/users');
const analyticsRoutes = require('../server/src/routes/analytics');
const aiRoutes = require('../server/src/routes/ai');

// Import middleware
const { errorHandler } = require('../server/src/middleware/errorHandler');

// Initialize Express app
const app = express();

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));

// CORS configuration - allow all origins in production for Vercel
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Milestone API is running on Vercel',
        timestamp: new Date().toISOString()
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

// 404 handler for API routes
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `API Route ${req.method} ${req.path} not found`
        }
    });
});

// Error handler
app.use(errorHandler);

// Export for Vercel
module.exports = app;
