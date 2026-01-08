const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, authorize, hasMinimumRole } = require('../middleware/auth');
const { analyzeStandup } = require('../services/gemini');
const { sendSubmissionNotification } = require('../services/teams');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/v1/standup/goal
 * Set today's goal (morning)
 */
router.post('/goal',
    authenticate,
    [
        body('todayGoal')
            .isLength({ min: 50 }).withMessage('Goal must be at least 50 characters')
            .isLength({ max: 2000 }).withMessage('Goal cannot exceed 2000 characters'),
        body('clickupTaskIds').optional().isArray(),
        body('standupId').optional().isString() // Optional: update existing standup
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

        const { todayGoal, clickupTaskIds = [], standupId } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let standup;

        if (standupId) {
            // Update existing standup
            standup = await prisma.standup.findUnique({
                where: { id: standupId }
            });

            if (!standup || standup.userId !== req.user.id) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Standup not found'
                    }
                });
            }

            if (standup.status !== 'PENDING') {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'GOAL_ALREADY_SET',
                        message: 'Goal already set for this standup.'
                    }
                });
            }

            standup = await prisma.standup.update({
                where: { id: standupId },
                data: {
                    todayGoal,
                    goalSetTime: new Date(),
                    clickupTaskIds,
                    status: 'GOAL_SET'
                },
                include: {
                    user: {
                        select: { id: true, name: true, email: true, department: true }
                    }
                }
            });
        } else {
            // Create new standup with auto-incremented sequence
            const existingStandups = await prisma.standup.findMany({
                where: {
                    userId: req.user.id,
                    date: today
                },
                orderBy: { sequence: 'desc' },
                take: 1
            });

            const nextSequence = existingStandups.length > 0
                ? existingStandups[0].sequence + 1
                : 1;

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
                include: {
                    user: {
                        select: { id: true, name: true, email: true, department: true }
                    }
                }
            });
        }

        res.status(201).json({
            success: true,
            message: `Goal set successfully for Standup #${standup.sequence}! Have a productive day! 🎯`,
            data: { standup }
        });
    })
);

/**
 * POST /api/v1/standup/submit
 * Submit end-of-day achievement
 */
router.post('/submit',
    authenticate,
    [
        body('standupId').isString().withMessage('Standup ID is required'),
        body('achievementTitle')
            .isLength({ min: 1, max: 100 }).withMessage('Title is required (max 100 characters)'),
        body('achievementDesc')
            .isLength({ min: 100 }).withMessage('Description must be at least 100 characters')
            .isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters'),
        body('goalStatus')
            .isIn(['ACHIEVED', 'PARTIALLY_ACHIEVED', 'NOT_ACHIEVED'])
            .withMessage('Goal status is required'),
        body('completionPercentage')
            .optional()
            .isInt({ min: 0, max: 100 }).withMessage('Completion must be 0-100'),
        body('notAchievedReason')
            .if(body('goalStatus').isIn(['PARTIALLY_ACHIEVED', 'NOT_ACHIEVED']))
            .isLength({ min: 50 }).withMessage('Reason must be at least 50 characters when goal not fully achieved')
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

        const {
            standupId,
            achievementTitle,
            achievementDesc,
            goalStatus,
            completionPercentage,
            notAchievedReason
        } = req.body;

        // Find the specific standup
        let standup = await prisma.standup.findUnique({
            where: { id: standupId }
        });

        // Check if can submit
        if (!standup || standup.userId !== req.user.id) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Standup not found'
                }
            });
        }

        if (standup.status === 'PENDING') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_GOAL_SET',
                    message: 'Please set a goal before submitting your achievement.'
                }
            });
        }

        if (standup.status === 'SUBMITTED' || standup.status === 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'ALREADY_SUBMITTED',
                    message: 'This standup has already been submitted.'
                }
            });
        }

        // Check if late submission (after 7 PM)
        const now = new Date();
        const isLateSubmission = now.getHours() >= 19;

        // Update standup with submission
        const submissionTime = new Date();
        standup = await prisma.standup.update({
            where: { id: standup.id },
            data: {
                achievementTitle,
                achievementDesc,
                goalStatus,
                completionPercentage: completionPercentage || (goalStatus === 'ACHIEVED' ? 100 : null),
                notAchievedReason,
                submissionTime,
                status: 'SUBMITTED',
                isLateSubmission
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                },
                uploadedFiles: true
            }
        });

        // Update attendance logout time
        await prisma.attendance.update({
            where: {
                userId_date: {
                    userId: req.user.id,
                    date: today
                }
            },
            data: {
                logoutTime: submissionTime,
                hoursWorked: await calculateHoursWorked(req.user.id, today, submissionTime)
            }
        });

        // Run AI analysis (async, don't block response)
        analyzeStandupAsync(standup);

        // Send Teams notification (async)
        sendSubmissionNotificationAsync(standup);

        res.json({
            success: true,
            message: 'Achievement submitted successfully! Great work today! 🎉',
            data: { standup }
        });
    })
);

/**
 * GET /api/v1/standup/today
 * Get all standups for today for current user
 */
router.get('/today',
    authenticate,
    asyncHandler(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const standups = await prisma.standup.findMany({
            where: {
                userId: req.user.id,
                date: today
            },
            include: {
                uploadedFiles: true,
                blockers: {
                    where: { status: { not: 'RESOLVED' } }
                }
            },
            orderBy: { sequence: 'asc' }
        });

        res.json({
            success: true,
            data: { standups }
        });
    })
);

/**
 * POST /api/v1/standup/create
 * Create a new standup for today (allows multiple per day)
 */
router.post('/create',
    authenticate,
    asyncHandler(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get next sequence number
        const existingStandups = await prisma.standup.findMany({
            where: {
                userId: req.user.id,
                date: today
            },
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
            include: {
                uploadedFiles: true,
                blockers: true
            }
        });

        res.status(201).json({
            success: true,
            message: `Standup #${nextSequence} created! Set your goal to get started.`,
            data: { standup }
        });
    })
);

/**
 * GET /api/v1/standup/history
 * Get standup history (own or others for managers)
 */
router.get('/history',
    authenticate,
    [
        query('userId').optional().isString(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 })
    ],
    asyncHandler(async (req, res) => {
        const { userId, startDate, endDate, limit = 30, offset = 0 } = req.query;

        // Employees can only view their own history
        let targetUserId = req.user.id;
        if (userId && userId !== req.user.id) {
            if (req.user.role === 'EMPLOYEE') {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You can only view your own history.'
                    }
                });
            }
            targetUserId = userId;
        }

        const where = {
            userId: targetUserId
        };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        const [standups, total] = await Promise.all([
            prisma.standup.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, name: true, department: true }
                    },
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
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + standups.length < total
                }
            }
        });
    })
);

/**
 * GET /api/v1/standup/pending-reviews
 * Get all pending submissions for manager review
 */
router.get('/pending-reviews',
    authenticate,
    hasMinimumRole('MANAGER'),
    asyncHandler(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pendingStandups = await prisma.standup.findMany({
            where: {
                status: 'SUBMITTED',
                date: {
                    gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true, role: true }
                },
                uploadedFiles: true,
                blockers: true
            },
            orderBy: { submissionTime: 'desc' }
        });

        res.json({
            success: true,
            data: { standups: pendingStandups }
        });
    })
);

/**
 * PUT /api/v1/standup/:id/review
 * Manager approves or adds feedback to submission
 */
router.put('/:id/review',
    authenticate,
    hasMinimumRole('MANAGER'),
    [
        body('action').isIn(['approve', 'feedback', 'needs_attention']),
        body('feedback').optional().isLength({ max: 1000 })
    ],
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { action, feedback } = req.body;

        const standup = await prisma.standup.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        if (!standup) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Standup not found'
                }
            });
        }

        if (standup.status !== 'SUBMITTED') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_STATUS',
                    message: 'This standup is not in a reviewable state.'
                }
            });
        }

        let newStatus;
        switch (action) {
            case 'approve':
                newStatus = 'APPROVED';
                break;
            case 'needs_attention':
                newStatus = 'NEEDS_ATTENTION';
                break;
            default:
                newStatus = 'SUBMITTED'; // Just adding feedback
        }

        const updatedStandup = await prisma.standup.update({
            where: { id },
            data: {
                status: newStatus,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                managerFeedback: feedback || standup.managerFeedback
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                },
                uploadedFiles: true
            }
        });

        // TODO: Send Teams notification to employee about review

        res.json({
            success: true,
            message: action === 'approve' ? 'Submission approved! ✅' : 'Feedback added successfully.',
            data: { standup: updatedStandup }
        });
    })
);

/**
 * GET /api/v1/standup/team-overview
 * Get team standup overview for managers
 */
router.get('/team-overview',
    authenticate,
    hasMinimumRole('MANAGER'),
    asyncHandler(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all employees (for manager) or all users (for admin)
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: req.user.role === 'ADMIN' ? undefined : 'EMPLOYEE'
            },
            select: { id: true, name: true, department: true }
        });

        // Get today's standups
        const standups = await prisma.standup.findMany({
            where: {
                date: today,
                userId: { in: users.map(u => u.id) }
            },
            include: {
                user: {
                    select: { id: true, name: true, department: true }
                }
            }
        });

        const standupMap = new Map(standups.map(s => [s.userId, s]));

        const overview = users.map(user => ({
            user,
            standup: standupMap.get(user.id) || null,
            status: standupMap.get(user.id)?.status || 'NO_STANDUP'
        }));

        const stats = {
            total: users.length,
            goalsSet: standups.filter(s => s.status !== 'PENDING').length,
            submitted: standups.filter(s => ['SUBMITTED', 'APPROVED', 'NEEDS_ATTENTION'].includes(s.status)).length,
            approved: standups.filter(s => s.status === 'APPROVED').length,
            pending: standups.filter(s => s.status === 'SUBMITTED').length
        };

        res.json({
            success: true,
            data: { overview, stats }
        });
    })
);

// Helper functions
async function calculateHoursWorked(userId, date, logoutTime) {
    const attendance = await prisma.attendance.findUnique({
        where: {
            userId_date: { userId, date }
        }
    });

    if (!attendance?.loginTime) return null;

    const hours = (logoutTime - attendance.loginTime) / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
}

async function analyzeStandupAsync(standup) {
    try {
        const aiInsights = await analyzeStandup(standup);
        if (aiInsights) {
            await prisma.standup.update({
                where: { id: standup.id },
                data: { aiInsights }
            });
        }
    } catch (error) {
        console.error('AI analysis failed:', error.message);
    }
}

async function sendSubmissionNotificationAsync(standup) {
    try {
        await sendSubmissionNotification(standup);
    } catch (error) {
        console.error('Teams notification failed:', error.message);
    }
}

module.exports = router;
