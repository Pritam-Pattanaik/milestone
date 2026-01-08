// Vercel Serverless API Handler
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// JWT helper
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
    const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
    return { accessToken, refreshToken };
};

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' }
            });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
            });
        }

        const tokens = generateTokens(user);

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        // Create attendance record
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.attendance.upsert({
            where: {
                userId_date: { userId: user.id, date: today }
            },
            create: {
                userId: user.id,
                date: today,
                loginTime: new Date(),
                status: 'PRESENT'
            },
            update: {
                loginTime: new Date(),
                status: 'PRESENT'
            }
        });

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department || 'Unassigned',
                    avatar: user.avatar
                },
                ...tokens
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// Get current user
app.get('/api/v1/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'No token provided' }
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department || 'Unassigned',
                    avatar: user.avatar
                }
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
        });
    }
});

// Refresh token
app.post('/api/v1/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Refresh token required' }
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret');
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' }
            });
        }

        const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'dev-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
        );

        res.json({ success: true, data: { accessToken } });
    } catch (error) {
        res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' }
        });
    }
});

// Logout
app.post('/api/v1/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// =============================================
// AUTH MIDDLEWARE
// =============================================
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'No token provided' }
            });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'User not found' }
            });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
        });
    }
};

// =============================================
// STANDUP ROUTES
// =============================================

// GET /api/v1/standup/today - Get all standups for today
app.get('/api/v1/standup/today', authenticate, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const standups = await prisma.standup.findMany({
            where: {
                userId: req.user.id,
                date: today
            },
            include: {
                uploadedFiles: true,
                blockers: { where: { status: { not: 'RESOLVED' } } }
            },
            orderBy: { sequence: 'asc' }
        });

        res.json({ success: true, data: { standups } });
    } catch (error) {
        console.error('Get today standups error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// POST /api/v1/standup/create - Create a new standup
app.post('/api/v1/standup/create', authenticate, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get next sequence number
        const existingStandups = await prisma.standup.findMany({
            where: { userId: req.user.id, date: today },
            orderBy: { sequence: 'desc' },
            take: 1
        });

        const nextSequence = existingStandups.length > 0
            ? existingStandups[0].sequence + 1
            : 1;

        const standup = await prisma.standup.create({
            data: {
                userId: req.user.id,
                date: today,
                sequence: nextSequence,
                status: 'PENDING'
            },
            include: { uploadedFiles: true, blockers: true }
        });

        res.status(201).json({
            success: true,
            message: `Standup #${nextSequence} created! Set your goal to get started.`,
            data: { standup }
        });
    } catch (error) {
        console.error('Create standup error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// POST /api/v1/standup/goal - Set goal for a standup
app.post('/api/v1/standup/goal', authenticate, async (req, res) => {
    try {
        const { todayGoal, standupId, clickupTaskIds = [] } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!todayGoal || todayGoal.length < 50) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Goal must be at least 50 characters' }
            });
        }

        let standup;

        if (standupId) {
            // Update existing standup
            standup = await prisma.standup.findUnique({ where: { id: standupId } });
            if (!standup || standup.userId !== req.user.id) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Standup not found' }
                });
            }
            if (standup.status !== 'PENDING') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'GOAL_ALREADY_SET', message: 'Goal already set for this standup.' }
                });
            }
            standup = await prisma.standup.update({
                where: { id: standupId },
                data: { todayGoal, goalSetTime: new Date(), clickupTaskIds, status: 'GOAL_SET' },
                include: { user: { select: { id: true, name: true, email: true, department: true } } }
            });
        } else {
            // Create new standup with goal
            const existingStandups = await prisma.standup.findMany({
                where: { userId: req.user.id, date: today },
                orderBy: { sequence: 'desc' },
                take: 1
            });
            const nextSequence = existingStandups.length > 0 ? existingStandups[0].sequence + 1 : 1;

            standup = await prisma.standup.create({
                data: {
                    userId: req.user.id,
                    date: today,
                    sequence: nextSequence,
                    todayGoal,
                    goalSetTime: new Date(),
                    clickupTaskIds,
                    status: 'GOAL_SET'
                },
                include: { user: { select: { id: true, name: true, email: true, department: true } } }
            });
        }

        res.status(201).json({
            success: true,
            message: `Goal set successfully for Standup #${standup.sequence}! 🎯`,
            data: { standup }
        });
    } catch (error) {
        console.error('Set goal error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// POST /api/v1/standup/submit - Submit achievement
app.post('/api/v1/standup/submit', authenticate, async (req, res) => {
    try {
        const { standupId, achievementTitle, achievementDesc, goalStatus, completionPercentage, notAchievedReason } = req.body;

        if (!standupId) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Standup ID is required' }
            });
        }

        let standup = await prisma.standup.findUnique({ where: { id: standupId } });

        if (!standup || standup.userId !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Standup not found' }
            });
        }

        if (standup.status === 'PENDING') {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_GOAL_SET', message: 'Please set a goal before submitting.' }
            });
        }

        if (['SUBMITTED', 'APPROVED'].includes(standup.status)) {
            return res.status(400).json({
                success: false,
                error: { code: 'ALREADY_SUBMITTED', message: 'This standup has already been submitted.' }
            });
        }

        const isLateSubmission = new Date().getHours() >= 19;

        standup = await prisma.standup.update({
            where: { id: standupId },
            data: {
                achievementTitle,
                achievementDesc,
                goalStatus,
                completionPercentage: completionPercentage || (goalStatus === 'ACHIEVED' ? 100 : null),
                notAchievedReason,
                submissionTime: new Date(),
                status: 'SUBMITTED',
                isLateSubmission
            },
            include: {
                user: { select: { id: true, name: true, email: true, department: true } },
                uploadedFiles: true
            }
        });

        res.json({
            success: true,
            message: `Standup #${standup.sequence} submitted! Great work! 🎉`,
            data: { standup }
        });
    } catch (error) {
        console.error('Submit error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// Catch-all for unimplemented routes
app.all('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
    });
});

// Export for Vercel
module.exports = app;
