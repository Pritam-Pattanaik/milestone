const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, hasMinimumRole } = require('../middleware/auth');
const { analyzeBlocker } = require('../services/gemini');
const { sendBlockerAlert } = require('../services/teams');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/v1/blocker
 * Raise a new blocker (available ANYTIME)
 */
router.post('/',
    authenticate,
    [
        body('title')
            .isLength({ min: 1, max: 100 }).withMessage('Title is required (max 100 characters)'),
        body('description')
            .isLength({ min: 100 }).withMessage('Description must be at least 100 characters')
            .isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters'),
        body('category')
            .isIn(['TECHNICAL', 'RESOURCE', 'COMMUNICATION', 'EXTERNAL', 'OTHER'])
            .withMessage('Valid category is required'),
        body('severity')
            .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
            .withMessage('Valid severity is required'),
        body('supportRequired')
            .notEmpty().withMessage('Support required field is required')
            .isLength({ max: 200 }).withMessage('Support required cannot exceed 200 characters')
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

        const { title, description, category, severity, supportRequired } = req.body;

        // Get today's standup (optional link)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const standup = await prisma.standup.findUnique({
            where: {
                userId_date: {
                    userId: req.user.id,
                    date: today
                }
            }
        });

        // Create blocker
        const blocker = await prisma.blocker.create({
            data: {
                userId: req.user.id,
                standupId: standup?.id || null,
                title,
                description,
                category,
                severity,
                supportRequired,
                status: 'OPEN'
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                },
                uploadedFiles: true
            }
        });

        // Run AI analysis (async)
        analyzeBlockerAsync(blocker);

        // Send Teams notification (async) - instant for HIGH/CRITICAL
        sendBlockerAlertAsync(blocker);

        res.status(201).json({
            success: true,
            message: '🚨 Blocker raised successfully! Your manager has been notified.',
            data: { blocker }
        });
    })
);

/**
 * GET /api/v1/blocker/my-blockers
 * Get current user's blockers
 */
router.get('/my-blockers',
    authenticate,
    [
        query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'all'])
    ],
    asyncHandler(async (req, res) => {
        const { status } = req.query;

        const where = {
            userId: req.user.id
        };

        if (status && status !== 'all') {
            where.status = status;
        }

        const blockers = await prisma.blocker.findMany({
            where,
            include: {
                uploadedFiles: true,
                standup: {
                    select: { id: true, date: true }
                }
            },
            orderBy: [
                { status: 'asc' }, // Open first
                { severity: 'desc' }, // Critical first
                { createdAt: 'desc' }
            ]
        });

        // Group by status
        const grouped = {
            open: blockers.filter(b => b.status === 'OPEN'),
            inProgress: blockers.filter(b => b.status === 'IN_PROGRESS'),
            escalated: blockers.filter(b => b.status === 'ESCALATED'),
            resolved: blockers.filter(b => b.status === 'RESOLVED')
        };

        res.json({
            success: true,
            data: {
                blockers,
                grouped,
                counts: {
                    open: grouped.open.length,
                    inProgress: grouped.inProgress.length,
                    escalated: grouped.escalated.length,
                    resolved: grouped.resolved.length,
                    total: blockers.length
                }
            }
        });
    })
);

/**
 * GET /api/v1/blocker/active
 * Get all active blockers (Manager+)
 */
router.get('/active',
    authenticate,
    hasMinimumRole('MANAGER'),
    [
        query('severity').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'all']),
        query('category').optional(),
        query('department').optional()
    ],
    asyncHandler(async (req, res) => {
        const { severity, category, department } = req.query;

        const where = {
            status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] }
        };

        if (severity && severity !== 'all') {
            where.severity = severity;
        }

        if (category) {
            where.category = category;
        }

        if (department) {
            where.user = { department };
        }

        const blockers = await prisma.blocker.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                },
                uploadedFiles: true
            },
            orderBy: [
                { severity: 'desc' }, // Critical first
                { createdAt: 'asc' }  // Oldest first
            ]
        });

        // Severity breakdown
        const bySeverity = {
            critical: blockers.filter(b => b.severity === 'CRITICAL'),
            high: blockers.filter(b => b.severity === 'HIGH'),
            medium: blockers.filter(b => b.severity === 'MEDIUM'),
            low: blockers.filter(b => b.severity === 'LOW')
        };

        res.json({
            success: true,
            data: {
                blockers,
                bySeverity,
                counts: {
                    critical: bySeverity.critical.length,
                    high: bySeverity.high.length,
                    medium: bySeverity.medium.length,
                    low: bySeverity.low.length,
                    total: blockers.length
                }
            }
        });
    })
);

/**
 * GET /api/v1/blocker/:id
 * Get single blocker details
 */
router.get('/:id',
    authenticate,
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const blocker = await prisma.blocker.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                },
                uploadedFiles: true,
                standup: {
                    select: { id: true, date: true, todayGoal: true }
                }
            }
        });

        if (!blocker) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Blocker not found'
                }
            });
        }

        // Employees can only view their own blockers
        if (req.user.role === 'EMPLOYEE' && blocker.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only view your own blockers.'
                }
            });
        }

        res.json({
            success: true,
            data: { blocker }
        });
    })
);

/**
 * PUT /api/v1/blocker/:id/status
 * Update blocker status (Manager+)
 */
router.put('/:id/status',
    authenticate,
    hasMinimumRole('MANAGER'),
    [
        body('status').isIn(['IN_PROGRESS', 'OPEN']).withMessage('Valid status required')
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;

        const blocker = await prisma.blocker.findUnique({ where: { id } });

        if (!blocker) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Blocker not found'
                }
            });
        }

        if (blocker.status === 'RESOLVED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: 'Cannot change status of a resolved blocker.'
                }
            });
        }

        const updatedBlocker = await prisma.blocker.update({
            where: { id },
            data: { status },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        res.json({
            success: true,
            message: `Blocker marked as ${status.replace('_', ' ').toLowerCase()}`,
            data: { blocker: updatedBlocker }
        });
    })
);

/**
 * POST /api/v1/blocker/:id/escalate
 * Escalate blocker (Manager+)
 */
router.post('/:id/escalate',
    authenticate,
    hasMinimumRole('MANAGER'),
    [
        body('escalatedTo').notEmpty().withMessage('Escalation target is required'),
        body('escalationNotes').optional().isLength({ max: 1000 }),
        body('escalationDeadline').optional().isISO8601()
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { escalatedTo, escalationNotes, escalationDeadline } = req.body;

        const blocker = await prisma.blocker.findUnique({ where: { id } });

        if (!blocker) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Blocker not found'
                }
            });
        }

        if (blocker.status === 'RESOLVED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: 'Cannot escalate a resolved blocker.'
                }
            });
        }

        const updatedBlocker = await prisma.blocker.update({
            where: { id },
            data: {
                status: 'ESCALATED',
                escalatedTo,
                escalationNotes,
                escalationDeadline: escalationDeadline ? new Date(escalationDeadline) : null
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                }
            }
        });

        // TODO: Send escalation notification via Teams

        res.json({
            success: true,
            message: `Blocker escalated to ${escalatedTo}`,
            data: { blocker: updatedBlocker }
        });
    })
);

/**
 * PUT /api/v1/blocker/:id/resolve
 * Resolve blocker (Manager+)
 */
router.put('/:id/resolve',
    authenticate,
    hasMinimumRole('MANAGER'),
    [
        body('resolutionNotes')
            .isLength({ min: 20 }).withMessage('Resolution notes must be at least 20 characters')
            .isLength({ max: 2000 }).withMessage('Resolution notes cannot exceed 2000 characters')
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

        const { id } = req.params;
        const { resolutionNotes } = req.body;

        const blocker = await prisma.blocker.findUnique({ where: { id } });

        if (!blocker) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Blocker not found'
                }
            });
        }

        if (blocker.status === 'RESOLVED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'ALREADY_RESOLVED',
                    message: 'This blocker is already resolved.'
                }
            });
        }

        const updatedBlocker = await prisma.blocker.update({
            where: { id },
            data: {
                status: 'RESOLVED',
                resolutionNotes,
                resolvedAt: new Date(),
                resolvedBy: req.user.id
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                }
            }
        });

        // TODO: Send resolution notification to employee via Teams

        res.json({
            success: true,
            message: '✅ Blocker resolved successfully!',
            data: { blocker: updatedBlocker }
        });
    })
);

/**
 * GET /api/v1/blocker/analytics
 * Blocker analytics (Admin only)
 */
router.get('/analytics/overview',
    authenticate,
    hasMinimumRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get all blockers from last 30 days
        const blockers = await prisma.blocker.findMany({
            where: {
                createdAt: { gte: thirtyDaysAgo }
            },
            include: {
                user: {
                    select: { department: true }
                }
            }
        });

        // Calculate stats
        const stats = {
            total: blockers.length,
            open: blockers.filter(b => b.status === 'OPEN').length,
            inProgress: blockers.filter(b => b.status === 'IN_PROGRESS').length,
            escalated: blockers.filter(b => b.status === 'ESCALATED').length,
            resolved: blockers.filter(b => b.status === 'RESOLVED').length,
            bySeverity: {
                critical: blockers.filter(b => b.severity === 'CRITICAL').length,
                high: blockers.filter(b => b.severity === 'HIGH').length,
                medium: blockers.filter(b => b.severity === 'MEDIUM').length,
                low: blockers.filter(b => b.severity === 'LOW').length
            },
            byCategory: {
                technical: blockers.filter(b => b.category === 'TECHNICAL').length,
                resource: blockers.filter(b => b.category === 'RESOURCE').length,
                communication: blockers.filter(b => b.category === 'COMMUNICATION').length,
                external: blockers.filter(b => b.category === 'EXTERNAL').length,
                other: blockers.filter(b => b.category === 'OTHER').length
            }
        };

        // Average resolution time
        const resolved = blockers.filter(b => b.status === 'RESOLVED' && b.resolvedAt);
        if (resolved.length > 0) {
            const totalHours = resolved.reduce((sum, b) => {
                return sum + (b.resolvedAt - b.createdAt) / (1000 * 60 * 60);
            }, 0);
            stats.avgResolutionTimeHours = Math.round(totalHours / resolved.length * 10) / 10;
        } else {
            stats.avgResolutionTimeHours = null;
        }

        // By department
        const departments = [...new Set(blockers.map(b => b.user.department))];
        stats.byDepartment = departments.map(dept => ({
            department: dept,
            count: blockers.filter(b => b.user.department === dept).length
        }));

        res.json({
            success: true,
            data: { stats, period: '30 days' }
        });
    })
);

// Helper functions
async function analyzeBlockerAsync(blocker) {
    try {
        const aiAnalysis = await analyzeBlocker(blocker);
        if (aiAnalysis) {
            await prisma.blocker.update({
                where: { id: blocker.id },
                data: { aiAnalysis }
            });
        }
    } catch (error) {
        console.error('Blocker AI analysis failed:', error.message);
    }
}

async function sendBlockerAlertAsync(blocker) {
    try {
        await sendBlockerAlert(blocker);
    } catch (error) {
        console.error('Blocker Teams notification failed:', error.message);
    }
}

module.exports = router;
