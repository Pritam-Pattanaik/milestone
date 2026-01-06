const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/v1/auth/login
 * User login - Returns access and refresh tokens
 */
router.post('/login',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input',
                    details: errors.array()
                }
            });
        }

        const { email, password } = req.body;

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_FAILED',
                    message: 'Invalid email or password'
                }
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'USER_INACTIVE',
                    message: 'Your account has been deactivated. Please contact an administrator.'
                }
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_FAILED',
                    message: 'Invalid email or password'
                }
            });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        // Record login for attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.attendance.upsert({
            where: {
                userId_date: {
                    userId: user.id,
                    date: today
                }
            },
            update: {
                // Don't overwrite if already logged in today
            },
            create: {
                userId: user.id,
                date: today,
                loginTime: new Date(),
                status: 'PRESENT'
            }
        });

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            data: {
                user: userWithoutPassword,
                accessToken,
                refreshToken
            }
        });
    })
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
    [
        body('refreshToken').notEmpty().withMessage('Refresh token is required')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Refresh token is required'
                }
            });
        }

        const { refreshToken } = req.body;

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

            // Verify user still exists and is active
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, role: true, isActive: true }
            });

            if (!user || !user.isActive) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'INVALID_REFRESH_TOKEN',
                        message: 'Invalid refresh token'
                    }
                });
            }

            // Generate new access token
            const accessToken = jwt.sign(
                { userId: user.id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
            );

            res.json({
                success: true,
                data: { accessToken }
            });
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_REFRESH_TOKEN',
                    message: 'Invalid or expired refresh token'
                }
            });
        }
    })
);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
router.get('/me',
    authenticate,
    asyncHandler(async (req, res) => {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                department: true,
                avatar: true,
                isActive: true,
                createdAt: true
            }
        });

        res.json({
            success: true,
            data: { user }
        });
    })
);

/**
 * POST /api/v1/auth/logout
 * Logout user (client-side token removal, server logs logout time)
 */
router.post('/logout',
    authenticate,
    asyncHandler(async (req, res) => {
        // Update attendance with logout time if there's a submission today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId: req.user.id,
                    date: today
                }
            }
        });

        if (attendance && !attendance.logoutTime) {
            const logoutTime = new Date();
            let hoursWorked = null;

            if (attendance.loginTime) {
                hoursWorked = (logoutTime - attendance.loginTime) / (1000 * 60 * 60);
                hoursWorked = Math.round(hoursWorked * 100) / 100; // Round to 2 decimals
            }

            await prisma.attendance.update({
                where: { id: attendance.id },
                data: {
                    logoutTime,
                    hoursWorked
                }
            });
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    })
);

/**
 * PUT /api/v1/auth/change-password
 * Change user password
 */
router.put('/change-password',
    authenticate,
    [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number')
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input',
                    details: errors.array()
                }
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PASSWORD',
                    message: 'Current password is incorrect'
                }
            });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    })
);

module.exports = router;
