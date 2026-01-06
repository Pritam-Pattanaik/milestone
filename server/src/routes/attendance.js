const express = require('express');
const { query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, hasMinimumRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/attendance/my
 * Get current user's attendance for a month
 */
router.get('/my',
    authenticate,
    [
        query('month').optional().isInt({ min: 1, max: 12 }),
        query('year').optional().isInt({ min: 2020, max: 2100 })
    ],
    asyncHandler(async (req, res) => {
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month

        const attendance = await prisma.attendance.findMany({
            where: {
                userId: req.user.id,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { date: 'asc' }
        });

        // Calculate stats
        const stats = {
            totalDays: attendance.length,
            present: attendance.filter(a => a.status === 'PRESENT').length,
            absent: attendance.filter(a => a.status === 'ABSENT').length,
            late: attendance.filter(a => a.status === 'LATE').length,
            halfDay: attendance.filter(a => a.status === 'HALF_DAY').length,
            avgHoursWorked: 0
        };

        const hoursRecords = attendance.filter(a => a.hoursWorked != null);
        if (hoursRecords.length > 0) {
            stats.avgHoursWorked = hoursRecords.reduce((sum, a) => sum + a.hoursWorked, 0) / hoursRecords.length;
            stats.avgHoursWorked = Math.round(stats.avgHoursWorked * 100) / 100;
        }

        res.json({
            success: true,
            data: {
                attendance,
                stats,
                period: { month, year }
            }
        });
    })
);

/**
 * GET /api/v1/attendance/today
 * Get current user's attendance for today
 */
router.get('/today',
    authenticate,
    asyncHandler(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let attendance = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId: req.user.id,
                    date: today
                }
            }
        });

        res.json({
            success: true,
            data: { attendance }
        });
    })
);

/**
 * GET /api/v1/attendance/user/:userId
 * Get specific user's attendance (Manager+)
 */
router.get('/user/:userId',
    authenticate,
    hasMinimumRole('MANAGER'),
    [
        query('month').optional().isInt({ min: 1, max: 12 }),
        query('year').optional().isInt({ min: 2020, max: 2100 })
    ],
    asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, department: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const attendance = await prisma.attendance.findMany({
            where: {
                userId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { date: 'asc' }
        });

        // Calculate stats
        const stats = {
            totalDays: attendance.length,
            present: attendance.filter(a => a.status === 'PRESENT').length,
            absent: attendance.filter(a => a.status === 'ABSENT').length,
            late: attendance.filter(a => a.status === 'LATE').length,
            halfDay: attendance.filter(a => a.status === 'HALF_DAY').length,
            avgHoursWorked: 0
        };

        const hoursRecords = attendance.filter(a => a.hoursWorked != null);
        if (hoursRecords.length > 0) {
            stats.avgHoursWorked = hoursRecords.reduce((sum, a) => sum + a.hoursWorked, 0) / hoursRecords.length;
            stats.avgHoursWorked = Math.round(stats.avgHoursWorked * 100) / 100;
        }

        res.json({
            success: true,
            data: {
                user,
                attendance,
                stats,
                period: { month, year }
            }
        });
    })
);

/**
 * GET /api/v1/attendance/report
 * Get attendance report for all employees (Admin)
 */
router.get('/report',
    authenticate,
    hasMinimumRole('ADMIN'),
    [
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('department').optional()
    ],
    asyncHandler(async (req, res) => {
        const { startDate, endDate, department } = req.query;

        // Default to last 30 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Get all users
        const userWhere = {
            isActive: true,
            role: 'EMPLOYEE'
        };
        if (department) {
            userWhere.department = department;
        }

        const users = await prisma.user.findMany({
            where: userWhere,
            select: { id: true, name: true, email: true, department: true }
        });

        // Get attendance for all users in the period
        const attendance = await prisma.attendance.findMany({
            where: {
                userId: { in: users.map(u => u.id) },
                date: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                user: {
                    select: { id: true, name: true, department: true }
                }
            },
            orderBy: [
                { date: 'desc' },
                { user: { name: 'asc' } }
            ]
        });

        // Build user report
        const report = users.map(user => {
            const userAttendance = attendance.filter(a => a.userId === user.id);
            const hoursRecords = userAttendance.filter(a => a.hoursWorked != null);

            return {
                user,
                stats: {
                    totalDays: userAttendance.length,
                    present: userAttendance.filter(a => a.status === 'PRESENT').length,
                    absent: userAttendance.filter(a => a.status === 'ABSENT').length,
                    late: userAttendance.filter(a => a.status === 'LATE').length,
                    halfDay: userAttendance.filter(a => a.status === 'HALF_DAY').length,
                    avgHoursWorked: hoursRecords.length > 0
                        ? Math.round(hoursRecords.reduce((sum, a) => sum + a.hoursWorked, 0) / hoursRecords.length * 100) / 100
                        : 0,
                    totalHoursWorked: Math.round(hoursRecords.reduce((sum, a) => sum + a.hoursWorked, 0) * 100) / 100
                }
            };
        });

        // Summary
        const summary = {
            totalEmployees: users.length,
            totalRecords: attendance.length,
            overallStats: {
                present: attendance.filter(a => a.status === 'PRESENT').length,
                absent: attendance.filter(a => a.status === 'ABSENT').length,
                late: attendance.filter(a => a.status === 'LATE').length,
                halfDay: attendance.filter(a => a.status === 'HALF_DAY').length
            },
            byDepartment: {}
        };

        // Group by department
        const departments = [...new Set(users.map(u => u.department))];
        for (const dept of departments) {
            const deptUsers = users.filter(u => u.department === dept);
            const deptAttendance = attendance.filter(a => deptUsers.some(u => u.id === a.userId));
            const deptHours = deptAttendance.filter(a => a.hoursWorked != null);

            summary.byDepartment[dept] = {
                employees: deptUsers.length,
                present: deptAttendance.filter(a => a.status === 'PRESENT').length,
                avgHoursWorked: deptHours.length > 0
                    ? Math.round(deptHours.reduce((sum, a) => sum + a.hoursWorked, 0) / deptHours.length * 100) / 100
                    : 0
            };
        }

        res.json({
            success: true,
            data: {
                report,
                summary,
                period: {
                    startDate: start.toISOString(),
                    endDate: end.toISOString()
                }
            }
        });
    })
);

/**
 * GET /api/v1/attendance/team-today
 * Get today's attendance for all team members (Manager+)
 */
router.get('/team-today',
    authenticate,
    hasMinimumRole('MANAGER'),
    asyncHandler(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active users
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, department: true, role: true }
        });

        // Get today's attendance
        const attendance = await prisma.attendance.findMany({
            where: {
                date: today
            },
            include: {
                user: {
                    select: { id: true, name: true, department: true }
                }
            }
        });

        const attendanceMap = new Map(attendance.map(a => [a.userId, a]));

        const teamStatus = users.map(user => ({
            user,
            attendance: attendanceMap.get(user.id) || null,
            isLoggedIn: !!attendanceMap.get(user.id)?.loginTime,
            hasSubmitted: !!attendanceMap.get(user.id)?.logoutTime
        }));

        const stats = {
            total: users.length,
            loggedIn: teamStatus.filter(t => t.isLoggedIn).length,
            submitted: teamStatus.filter(t => t.hasSubmitted).length,
            notLoggedIn: teamStatus.filter(t => !t.isLoggedIn).length
        };

        res.json({
            success: true,
            data: {
                teamStatus,
                stats
            }
        });
    })
);

module.exports = router;
