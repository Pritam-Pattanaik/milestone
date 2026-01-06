const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendDailyReminder, sendWeeklySummary } = require('./teams');
const { generateWeeklyReport } = require('./gemini');

const prisma = new PrismaClient();

/**
 * Initialize all scheduled tasks
 */
function initScheduledTasks() {
    console.log('📅 Initializing scheduled tasks...');

    // Daily reminder at 6 PM (18:00)
    cron.schedule('0 18 * * 1-5', async () => {
        console.log('⏰ Running daily reminder task...');
        await sendDailyReminders();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata' // Adjust timezone as needed
    });

    // Weekly report on Monday at 9 AM
    cron.schedule('0 9 * * 1', async () => {
        console.log('📊 Running weekly report task...');
        await generateAndSendWeeklyReport();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });

    // Mark absent users at end of day (11:59 PM)
    cron.schedule('59 23 * * 1-5', async () => {
        console.log('📋 Running attendance cleanup task...');
        await markAbsentUsers();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });

    // Check for late users at 10 AM
    cron.schedule('0 10 * * 1-5', async () => {
        console.log('🕐 Checking for late logins...');
        await markLateUsers();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });

    console.log('✅ Scheduled tasks initialized');
}

/**
 * Send reminders to users who haven't submitted today
 */
async function sendDailyReminders() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active employees
        const employees = await prisma.user.findMany({
            where: { isActive: true, role: 'EMPLOYEE' },
            select: { id: true, name: true, email: true }
        });

        // Get today's submitted standups
        const submittedStandups = await prisma.standup.findMany({
            where: {
                date: today,
                status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_ATTENTION'] }
            },
            select: { userId: true }
        });

        const submittedUserIds = new Set(submittedStandups.map(s => s.userId));

        // Find users who haven't submitted
        const pendingUsers = employees.filter(e => !submittedUserIds.has(e.id));

        console.log(`📢 Sending reminders to ${pendingUsers.length} users`);

        // Send individual reminders (batched for Teams)
        for (const user of pendingUsers) {
            try {
                await sendDailyReminder(user);
            } catch (error) {
                console.error(`Failed to send reminder to ${user.name}:`, error.message);
            }
        }

        console.log('✅ Daily reminders sent');
    } catch (error) {
        console.error('Daily reminder task failed:', error);
    }
}

/**
 * Generate and send weekly report to admin
 */
async function generateAndSendWeeklyReport() {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Gather metrics
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

        const metrics = {
            totalStandups: standups.length,
            submissionRate: users > 0
                ? Math.round((standups.filter(s => s.status !== 'PENDING').length / (users * 7)) * 100)
                : 0,
            completionRate: standups.filter(s => s.goalStatus != null).length > 0
                ? Math.round(
                    (standups.filter(s => s.goalStatus === 'ACHIEVED').length /
                        standups.filter(s => s.goalStatus != null).length) * 100
                )
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

        // Generate AI report
        const report = await generateWeeklyReport(metrics);
        report.submissionRate = metrics.submissionRate;
        report.completionRate = metrics.completionRate;
        report.blockerCount = metrics.blockerCount;

        // Send to Teams
        await sendWeeklySummary(report);

        console.log('✅ Weekly report generated and sent');
    } catch (error) {
        console.error('Weekly report task failed:', error);
    }
}

/**
 * Mark users as absent if they didn't log in today
 */
async function markAbsentUsers() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active employees
        const employees = await prisma.user.findMany({
            where: { isActive: true, role: 'EMPLOYEE' },
            select: { id: true }
        });

        // Get today's attendance records
        const attendance = await prisma.attendance.findMany({
            where: { date: today },
            select: { userId: true }
        });

        const attendedUserIds = new Set(attendance.map(a => a.userId));

        // Find users with no attendance record
        const absentUsers = employees.filter(e => !attendedUserIds.has(e.id));

        // Create absent records
        for (const user of absentUsers) {
            await prisma.attendance.upsert({
                where: {
                    userId_date: {
                        userId: user.id,
                        date: today
                    }
                },
                update: {
                    status: 'ABSENT'
                },
                create: {
                    userId: user.id,
                    date: today,
                    status: 'ABSENT'
                }
            });
        }

        console.log(`✅ Marked ${absentUsers.length} users as absent`);
    } catch (error) {
        console.error('Mark absent task failed:', error);
    }
}

/**
 * Mark users who logged in after 10 AM as late
 */
async function markLateUsers() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tenAM = new Date(today);
        tenAM.setHours(10, 0, 0, 0);

        // Find today's attendance records with late login
        const lateAttendance = await prisma.attendance.findMany({
            where: {
                date: today,
                loginTime: { gt: tenAM },
                status: 'PRESENT'
            }
        });

        // Update status to LATE
        for (const record of lateAttendance) {
            await prisma.attendance.update({
                where: { id: record.id },
                data: { status: 'LATE' }
            });
        }

        console.log(`✅ Marked ${lateAttendance.length} users as late`);
    } catch (error) {
        console.error('Mark late task failed:', error);
    }
}

module.exports = {
    initScheduledTasks,
    sendDailyReminders,
    generateAndSendWeeklyReport,
    markAbsentUsers,
    markLateUsers
};
