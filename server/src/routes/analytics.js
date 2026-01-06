const express = require('express');
const { query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, hasMinimumRole, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/analytics/overview
 * Dashboard overview metrics (Admin)
 */
router.get('/overview',
    authenticate,
    hasMinimumRole('ADMIN'),
    asyncHandler(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Today's stats
        const [
            totalEmployees,
            todayStandups,
            activeBlockers,
            todayAttendance
        ] = await Promise.all([
            prisma.user.count({ where: { isActive: true, role: 'EMPLOYEE' } }),
            prisma.standup.findMany({ where: { date: today } }),
            prisma.blocker.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } } }),
            prisma.attendance.findMany({ where: { date: today } })
        ]);

        // 30-day stats
        const [
            monthlyStandups,
            monthlyBlockers
        ] = await Promise.all([
            prisma.standup.findMany({
                where: { date: { gte: thirtyDaysAgo } },
                select: { status: true, goalStatus: true, date: true }
            }),
            prisma.blocker.findMany({
                where: { createdAt: { gte: thirtyDaysAgo } },
                select: { severity: true, status: true, createdAt: true, resolvedAt: true }
            })
        ]);

        // Calculate metrics
        const submittedToday = todayStandups.filter(s =>
            ['SUBMITTED', 'APPROVED', 'NEEDS_ATTENTION'].includes(s.status)
        ).length;

        const goalsSet = todayStandups.filter(s => s.status !== 'PENDING').length;

        const criticalBlockers = await prisma.blocker.count({
            where: { severity: 'CRITICAL', status: { not: 'RESOLVED' } }
        });

        // Completion rate (30 days)
        const completedGoals = monthlyStandups.filter(s => s.goalStatus === 'ACHIEVED').length;
        const totalSubmissions = monthlyStandups.filter(s => s.goalStatus != null).length;
        const completionRate = totalSubmissions > 0
            ? Math.round((completedGoals / totalSubmissions) * 100)
            : 0;

        // Average hours worked today
        const hoursRecords = todayAttendance.filter(a => a.hoursWorked != null);
        const avgHoursWorked = hoursRecords.length > 0
            ? Math.round(hoursRecords.reduce((sum, a) => sum + a.hoursWorked, 0) / hoursRecords.length * 10) / 10
            : 0;

        // Attendance rate today
        const loggedInToday = todayAttendance.filter(a => a.loginTime != null).length;
        const attendanceRate = totalEmployees > 0
            ? Math.round((loggedInToday / totalEmployees) * 100)
            : 0;

        res.json({
            success: true,
            data: {
                today: {
                    date: today.toISOString(),
                    totalEmployees,
                    goalsSet,
                    submissionsCount: submittedToday,
                    submissionRate: totalEmployees > 0 ? Math.round((submittedToday / totalEmployees) * 100) : 0,
                    activeBlockers,
                    criticalBlockers,
                    loggedIn: loggedInToday,
                    attendanceRate,
                    avgHoursWorked
                },
                thirtyDay: {
                    completionRate,
                    totalStandups: monthlyStandups.length,
                    totalBlockers: monthlyBlockers.length,
                    resolvedBlockers: monthlyBlockers.filter(b => b.status === 'RESOLVED').length
                }
            }
        });
    })
);

/**
 * GET /api/v1/analytics/department/:dept
 * Department-specific stats
 */
router.get('/department/:dept',
    authenticate,
    hasMinimumRole('MANAGER'),
    asyncHandler(async (req, res) => {
        const { dept } = req.params;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Get department users
        const users = await prisma.user.findMany({
            where: { department: dept, isActive: true },
            select: { id: true, name: true, email: true, role: true }
        });

        const userIds = users.map(u => u.id);

        // Get stats
        const [standups, blockers, attendance] = await Promise.all([
            prisma.standup.findMany({
                where: {
                    userId: { in: userIds },
                    date: { gte: thirtyDaysAgo }
                }
            }),
            prisma.blocker.findMany({
                where: {
                    userId: { in: userIds },
                    createdAt: { gte: thirtyDaysAgo }
                }
            }),
            prisma.attendance.findMany({
                where: {
                    userId: { in: userIds },
                    date: { gte: thirtyDaysAgo }
                }
            })
        ]);

        // Calculate
        const completedGoals = standups.filter(s => s.goalStatus === 'ACHIEVED').length;
        const totalGoals = standups.filter(s => s.goalStatus != null).length;
        const avgHours = attendance.filter(a => a.hoursWorked != null);

        res.json({
            success: true,
            data: {
                department: dept,
                employees: users.length,
                period: '30 days',
                metrics: {
                    totalStandups: standups.length,
                    submissionRate: users.length > 0
                        ? Math.round((standups.filter(s => s.status !== 'PENDING').length / (users.length * 30)) * 100)
                        : 0,
                    completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
                    totalBlockers: blockers.length,
                    activeBlockers: blockers.filter(b => b.status !== 'RESOLVED').length,
                    avgHoursWorked: avgHours.length > 0
                        ? Math.round(avgHours.reduce((sum, a) => sum + a.hoursWorked, 0) / avgHours.length * 10) / 10

                        : 0
                },
                employees: users
            }
        });
    })
);

/**
 * GET /api/v1/analytics/productivity-trends
 * Productivity trends over time (Admin)
 */
router.get('/productivity-trends',
    authenticate,
    authorize('ADMIN'),
    [
        query('period').optional().isIn(['7d', '30d', '90d']).withMessage('Valid period: 7d, 30d, 90d')
    ],
    asyncHandler(async (req, res) => {
        const period = req.query.period || '30d';
        const days = parseInt(period);

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);

        // Get all standups in period
        const standups = await prisma.standup.findMany({
            where: {
                date: { gte: startDate, lte: endDate }
            },
            select: {
                date: true,
                status: true,
                goalStatus: true
            }
        });

        // Get total employees for rate calculation
        const totalEmployees = await prisma.user.count({
            where: { isActive: true, role: 'EMPLOYEE' }
        });

        // Group by date
        const trendData = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayStandups = standups.filter(s =>
                s.date.toISOString().split('T')[0] === dateStr
            );

            const submitted = dayStandups.filter(s =>
                ['SUBMITTED', 'APPROVED', 'NEEDS_ATTENTION'].includes(s.status)
            ).length;

            const achieved = dayStandups.filter(s => s.goalStatus === 'ACHIEVED').length;
            const totalGoals = dayStandups.filter(s => s.goalStatus != null).length;

            trendData.push({
                date: dateStr,
                submissions: submitted,
                submissionRate: totalEmployees > 0 ? Math.round((submitted / totalEmployees) * 100) : 0,
                completionRate: totalGoals > 0 ? Math.round((achieved / totalGoals) * 100) : 0
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json({
            success: true,
            data: {
                period,
                trends: trendData,
                summary: {
                    avgSubmissionRate: Math.round(
                        trendData.reduce((sum, d) => sum + d.submissionRate, 0) / trendData.length
                    ),
                    avgCompletionRate: Math.round(
                        trendData.reduce((sum, d) => sum + d.completionRate, 0) / trendData.length
                    )
                }
            }
        });
    })
);

/**
 * GET /api/v1/analytics/export
 * Export analytics data (Admin)
 */
router.get('/export',
    authenticate,
    authorize('ADMIN'),
    [
        query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('type').optional().isIn(['standups', 'blockers', 'attendance', 'all'])
    ],
    asyncHandler(async (req, res) => {
        const { format = 'json', startDate, endDate, type = 'all' } = req.query;

        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        const data = {};

        // Fetch requested data
        if (type === 'all' || type === 'standups') {
            data.standups = await prisma.standup.findMany({
                where: { date: { gte: start, lte: end } },
                include: {
                    user: { select: { name: true, email: true, department: true } }
                }
            });
        }

        if (type === 'all' || type === 'blockers') {
            data.blockers = await prisma.blocker.findMany({
                where: { createdAt: { gte: start, lte: end } },
                include: {
                    user: { select: { name: true, email: true, department: true } }
                }
            });
        }

        if (type === 'all' || type === 'attendance') {
            data.attendance = await prisma.attendance.findMany({
                where: { date: { gte: start, lte: end } },
                include: {
                    user: { select: { name: true, email: true, department: true } }
                }
            });
        }

        if (format === 'csv') {
            // Convert to CSV (simplified - first data type only for now)
            let csvData = '';
            const dataType = type === 'all' ? 'standups' : type;
            const records = data[dataType] || [];

            if (records.length > 0) {
                // Headers
                const headers = Object.keys(records[0]).filter(k => k !== 'user').concat(['userName', 'userEmail', 'department']);
                csvData = headers.join(',') + '\n';

                // Rows
                for (const record of records) {
                    const row = headers.map(h => {
                        if (h === 'userName') return record.user?.name || '';
                        if (h === 'userEmail') return record.user?.email || '';
                        if (h === 'department') return record.user?.department || '';
                        const val = record[h];
                        if (val === null || val === undefined) return '';
                        if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';');
                        return String(val).replace(/,/g, ';');
                    });
                    csvData += row.join(',') + '\n';
                }
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="milestone-export-${dataType}-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.send(csvData);
        }

        res.json({
            success: true,
            data: {
                ...data,
                exportedAt: new Date().toISOString(),
                period: { start: start.toISOString(), end: end.toISOString() }
            }
        });
    })
);

module.exports = router;
