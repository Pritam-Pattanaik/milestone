const express = require('express');
const { body } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const {
    suggestGoals,
    analyzeStandup,
    analyzeBlocker,
    generateWeeklyReport,
    analyzeSentiment
} = require('../services/gemini');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/v1/ai/suggest-goals
 * Get AI-powered goal suggestions based on history
 */
router.post('/suggest-goals',
    authenticate,
    asyncHandler(async (req, res) => {
        // Get last 7 days of standups
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentStandups = await prisma.standup.findMany({
            where: {
                userId: req.user.id,
                date: { gte: sevenDaysAgo },
                todayGoal: { not: null }
            },
            orderBy: { date: 'desc' },
            select: {
                date: true,
                todayGoal: true,
                achievementTitle: true,
                achievementDesc: true,
                goalStatus: true
            }
        });

        const suggestions = await suggestGoals(recentStandups, req.user.department);

        res.json({
            success: true,
            data: { suggestions }
        });
    })
);

/**
 * POST /api/v1/ai/analyze-standup
 * Analyze a standup submission (usually auto-triggered)
 */
router.post('/analyze-standup',
    authenticate,
    [
        body('standupId').notEmpty().withMessage('Standup ID is required')
    ],
    asyncHandler(async (req, res) => {
        const { standupId } = req.body;

        const standup = await prisma.standup.findUnique({
            where: { id: standupId },
            include: {
                user: { select: { id: true, name: true, department: true } },
                uploadedFiles: true
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

        // Only owner or manager+ can trigger analysis
        if (standup.userId !== req.user.id && req.user.role === 'EMPLOYEE') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Access denied'
                }
            });
        }

        const analysis = await analyzeStandup(standup);

        // Save analysis
        await prisma.standup.update({
            where: { id: standupId },
            data: { aiInsights: analysis }
        });

        res.json({
            success: true,
            data: { analysis }
        });
    })
);

/**
 * POST /api/v1/ai/analyze-blocker
 * Analyze a blocker and suggest resolutions
 */
router.post('/analyze-blocker',
    authenticate,
    [
        body('blockerId').notEmpty().withMessage('Blocker ID is required')
    ],
    asyncHandler(async (req, res) => {
        const { blockerId } = req.body;

        const blocker = await prisma.blocker.findUnique({
            where: { id: blockerId },
            include: {
                user: { select: { id: true, name: true, department: true } }
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

        // Get similar past blockers
        const similarBlockers = await prisma.blocker.findMany({
            where: {
                id: { not: blockerId },
                category: blocker.category,
                status: 'RESOLVED'
            },
            take: 5,
            orderBy: { resolvedAt: 'desc' },
            select: {
                title: true,
                description: true,
                resolutionNotes: true,
                severity: true
            }
        });

        const analysis = await analyzeBlocker(blocker, similarBlockers);

        // Save analysis
        await prisma.blocker.update({
            where: { id: blockerId },
            data: { aiAnalysis: analysis }
        });

        res.json({
            success: true,
            data: { analysis }
        });
    })
);

/**
 * GET /api/v1/ai/weekly-report
 * Generate weekly AI insights report (Admin)
 */
router.get('/weekly-report',
    authenticate,
    authorize('ADMIN'),
    asyncHandler(async (req, res) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Gather weekly data
        const [standups, blockers, users] = await Promise.all([
            prisma.standup.findMany({
                where: { date: { gte: sevenDaysAgo } },
                include: { user: { select: { department: true } } }
            }),
            prisma.blocker.findMany({
                where: { createdAt: { gte: sevenDaysAgo } },
                include: { user: { select: { department: true } } }
            }),
            prisma.user.count({ where: { isActive: true, role: 'EMPLOYEE' } })
        ]);

        // Calculate metrics
        const metrics = {
            totalStandups: standups.length,
            submissionRate: users > 0 ? Math.round((standups.filter(s => s.status !== 'PENDING').length / (users * 7)) * 100) : 0,
            completionRate: standups.filter(s => s.goalStatus != null).length > 0
                ? Math.round((standups.filter(s => s.goalStatus === 'ACHIEVED').length / standups.filter(s => s.goalStatus != null).length) * 100)
                : 0,
            blockerCount: blockers.length,
            blockersBySeverity: {
                critical: blockers.filter(b => b.severity === 'CRITICAL').length,
                high: blockers.filter(b => b.severity === 'HIGH').length,
                medium: blockers.filter(b => b.severity === 'MEDIUM').length,
                low: blockers.filter(b => b.severity === 'LOW').length
            },
            resolvedBlockers: blockers.filter(b => b.status === 'RESOLVED').length
        };

        // Group by department
        const departments = [...new Set(standups.map(s => s.user.department))];
        metrics.byDepartment = departments.map(dept => ({
            department: dept,
            standups: standups.filter(s => s.user.department === dept).length,
            blockers: blockers.filter(b => b.user.department === dept).length
        }));

        const report = await generateWeeklyReport(metrics);

        res.json({
            success: true,
            data: {
                report,
                metrics,
                generatedAt: new Date().toISOString(),
                period: {
                    start: sevenDaysAgo.toISOString(),
                    end: new Date().toISOString()
                }
            }
        });
    })
);

/**
 * POST /api/v1/ai/sentiment
 * Analyze sentiment of text (used for detecting burnout)
 */
router.post('/sentiment',
    authenticate,
    [
        body('text').isLength({ min: 10 }).withMessage('Text must be at least 10 characters')
    ],
    asyncHandler(async (req, res) => {
        const { text } = req.body;
        const analysis = await analyzeSentiment(text);

        res.json({
            success: true,
            data: { analysis }
        });
    })
);

module.exports = router;
