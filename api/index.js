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

// GET /api/v1/standup/history - Get standup history
app.get('/api/v1/standup/history', authenticate, async (req, res) => {
    try {
        const { limit = 30, offset = 0, startDate, endDate } = req.query;

        const where = { userId: req.user.id };
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        const [standups, total] = await Promise.all([
            prisma.standup.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, department: true } },
                    uploadedFiles: true,
                    blockers: true
                },
                orderBy: { date: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.standup.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                standups,
                pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasMore: parseInt(offset) + standups.length < total }
            }
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// GET /api/v1/blocker/my-blockers - Get user's blockers
app.get('/api/v1/blocker/my-blockers', authenticate, async (req, res) => {
    try {
        const { limit = 20, offset = 0, status } = req.query;

        const where = { userId: req.user.id };
        if (status && status !== 'all') where.status = status;

        const [blockers, total] = await Promise.all([
            prisma.blocker.findMany({
                where,
                include: {
                    standup: { select: { id: true, date: true, sequence: true } },
                    user: { select: { id: true, name: true, department: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.blocker.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                blockers,
                pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasMore: parseInt(offset) + blockers.length < total }
            }
        });
    } catch (error) {
        console.error('Get blockers error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// GET /api/v1/attendance/today - Get today's attendance
app.get('/api/v1/attendance/today', authenticate, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let attendance = await prisma.attendance.findUnique({
            where: {
                userId_date: { userId: req.user.id, date: today }
            }
        });

        // Create if not exists
        if (!attendance) {
            attendance = await prisma.attendance.create({
                data: {
                    userId: req.user.id,
                    date: today,
                    loginTime: new Date(),
                    status: 'PRESENT'
                }
            });
        }

        res.json({ success: true, data: { attendance } });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// POST /api/v1/ai/suggest-goals - Get AI goal suggestions (mock for now)
app.post('/api/v1/ai/suggest-goals', authenticate, async (req, res) => {
    try {
        // Return mock suggestions for now (can integrate with Gemini later)
        const suggestions = [
            'Complete the pending code review for the authentication module and provide detailed feedback',
            'Implement unit tests for the new API endpoints to ensure code quality and reliability',
            'Document the recent feature changes and update the technical documentation accordingly'
        ];

        res.json({
            success: true,
            data: { suggestions }
        });
    } catch (error) {
        console.error('AI suggest error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// =============================================
// USER MANAGEMENT ROUTES
// =============================================

// GET /api/v1/users - Get all users (admin/manager only)
app.get('/api/v1/users', authenticate, async (req, res) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
            });
        }

        const { role, department, isActive, limit = 50, offset = 0 } = req.query;
        const where = {};
        if (role) where.role = role;
        if (department) where.department = department;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true, email: true, name: true, role: true,
                    department: true, avatar: true, isActive: true,
                    lastLoginAt: true, createdAt: true
                },
                orderBy: { name: 'asc' },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            success: true,
            data: { users, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// GET /api/v1/users/:id - Get user by ID
app.get('/api/v1/users/:id', authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, email: true, name: true, role: true,
                department: true, avatar: true, isActive: true,
                lastLoginAt: true, createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        res.json({ success: true, data: { user } });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// POST /api/v1/users - Create new user (admin/manager only)
app.post('/api/v1/users', authenticate, async (req, res) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only admins and managers can create users' }
            });
        }

        const { email, password, name, role = 'EMPLOYEE', department } = req.body;

        // Validation
        if (!email || !password || !name || !department) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Email, password, name, and department are required' }
            });
        }

        // Check if email exists
        const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) {
            return res.status(400).json({
                success: false,
                error: { code: 'EMAIL_EXISTS', message: 'Email already registered' }
            });
        }

        // Managers can only create employees
        if (req.user.role === 'MANAGER' && role !== 'EMPLOYEE') {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Managers can only create employee accounts' }
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name,
                role,
                department
            },
            select: {
                id: true, email: true, name: true, role: true,
                department: true, isActive: true, createdAt: true
            }
        });

        res.status(201).json({
            success: true,
            message: `User ${name} created successfully!`,
            data: { user }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// PUT /api/v1/users/:id - Update user (admin/manager only)
app.put('/api/v1/users/:id', authenticate, async (req, res) => {
    try {
        if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
            });
        }

        const { name, role, department, isActive, password } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (role) updateData.role = role;
        if (department) updateData.department = department;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (password) updateData.password = await bcrypt.hash(password, 12);

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true, email: true, name: true, role: true,
                department: true, isActive: true, createdAt: true
            }
        });

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user }
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// DELETE /api/v1/users/:id - Deactivate user (admin only)
app.delete('/api/v1/users/:id', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only admins can delete users' }
            });
        }

        // Soft delete - just deactivate
        await prisma.user.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal server error' }
        });
    }
});

// POST /api/v1/users/:id/reactivate - Reactivate user (admin only)
app.post('/api/v1/users/:id/reactivate', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only admins can reactivate users' }
            });
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { isActive: true },
            select: { id: true, email: true, name: true, isActive: true }
        });

        res.json({
            success: true,
            message: 'User reactivated successfully',
            data: { user }
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }
        console.error('Reactivate user error:', error);
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
