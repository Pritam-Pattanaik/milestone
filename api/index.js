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
            where: { email: email.toLowerCase() },
            include: { department: true }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
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
                    department: user.department?.name || 'Unassigned',
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
            where: { id: decoded.userId },
            include: { department: true }
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
                    department: user.department?.name || 'Unassigned',
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

// Catch-all for unimplemented routes
app.all('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
    });
});

// Export for Vercel
module.exports = app;
