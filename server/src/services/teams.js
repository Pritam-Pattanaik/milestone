const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Severity color mapping for Teams cards
const SEVERITY_COLORS = {
    CRITICAL: 'C1121F',
    HIGH: 'F97316',
    MEDIUM: 'EAB308',
    LOW: '22C55E'
};

// Goal status emojis
const STATUS_EMOJI = {
    ACHIEVED: '✅',
    PARTIALLY_ACHIEVED: '🔄',
    NOT_ACHIEVED: '❌'
};

/**
 * Send a message card to Microsoft Teams
 * @param {string} webhookUrl - Teams webhook URL
 * @param {Object} card - Message card payload
 */
async function sendTeamsMessage(webhookUrl, card) {
    if (!webhookUrl) {
        console.warn('Teams webhook URL not configured');
        return false;
    }

    try {
        await axios.post(webhookUrl, card, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Log notification
        await prisma.notificationLog.create({
            data: {
                type: card.notificationType || 'BLOCKER_ALERT',
                recipient: webhookUrl.substring(0, 50) + '...',
                payload: card,
                status: 'sent'
            }
        });

        return true;
    } catch (error) {
        console.error('Teams notification failed:', error.message);

        await prisma.notificationLog.create({
            data: {
                type: card.notificationType || 'BLOCKER_ALERT',
                recipient: webhookUrl.substring(0, 50) + '...',
                payload: card,
                status: 'failed',
                error: error.message
            }
        });

        return false;
    }
}

/**
 * Send blocker alert to Teams (instant notification)
 * @param {Object} blocker - Blocker with user relation
 */
async function sendBlockerAlert(blocker) {
    const webhookUrl = process.env.TEAMS_MANAGER_WEBHOOK_URL;
    const adminWebhookUrl = process.env.TEAMS_ADMIN_WEBHOOK_URL;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        notificationType: 'BLOCKER_ALERT',
        themeColor: SEVERITY_COLORS[blocker.severity],
        summary: `New ${blocker.severity} blocker from ${blocker.user?.name || 'Unknown'}`,
        sections: [
            {
                activityTitle: `🚨 New ${blocker.severity} Blocker`,
                activitySubtitle: `${blocker.user?.name || 'Unknown'} - ${blocker.user?.department || 'Unknown Dept'}`,
                facts: [
                    { name: 'Title:', value: blocker.title },
                    { name: 'Severity:', value: blocker.severity },
                    { name: 'Category:', value: blocker.category },
                    { name: 'Support Required:', value: blocker.supportRequired },
                    {
                        name: 'Description:',
                        value: blocker.description.length > 200
                            ? blocker.description.substring(0, 200) + '...'
                            : blocker.description
                    },
                    { name: 'Files Attached:', value: `${blocker.uploadedFiles?.length || 0}` },
                    { name: 'Raised At:', value: new Date().toLocaleString() }
                ],
                markdown: true
            }
        ],
        potentialAction: [
            {
                '@type': 'OpenUri',
                name: 'View Blocker',
                targets: [
                    { os: 'default', uri: `${frontendUrl}/blockers/${blocker.id}` }
                ]
            }
        ]
    };

    // Send to manager webhook
    await sendTeamsMessage(webhookUrl, card);

    // Also send to admin webhook for CRITICAL blockers
    if (blocker.severity === 'CRITICAL' && adminWebhookUrl) {
        card.sections[0].activityTitle = '🔴 CRITICAL Blocker - Immediate Attention Required';
        await sendTeamsMessage(adminWebhookUrl, card);
    }

    return true;
}

/**
 * Send standup submission notification to Teams
 * @param {Object} standup - Standup with user relation
 */
async function sendSubmissionNotification(standup) {
    const webhookUrl = process.env.TEAMS_MANAGER_WEBHOOK_URL;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        notificationType: 'SUBMISSION_NOTIFICATION',
        themeColor: '6366F1', // Milestone primary color
        summary: `${standup.user?.name || 'Employee'} submitted daily standup`,
        sections: [
            {
                activityTitle: '📊 New Standup Submission',
                activitySubtitle: `${standup.user?.name || 'Unknown'} - ${standup.user?.department || 'Unknown Dept'}`,
                facts: [
                    { name: 'Achievement:', value: standup.achievementTitle },
                    {
                        name: 'Goal Status:',
                        value: `${STATUS_EMOJI[standup.goalStatus] || '❓'} ${standup.goalStatus?.replace('_', ' ') || 'Unknown'}`
                    },
                    { name: 'Files:', value: `${standup.uploadedFiles?.length || 0} attached` },
                    { name: 'Submitted At:', value: new Date(standup.submissionTime).toLocaleString() },
                    { name: 'Late Submission:', value: standup.isLateSubmission ? '⚠️ Yes' : '✓ No' }
                ],
                markdown: true
            }
        ],
        potentialAction: [
            {
                '@type': 'OpenUri',
                name: 'Review Now',
                targets: [
                    { os: 'default', uri: `${frontendUrl}/standups/${standup.id}` }
                ]
            }
        ]
    };

    return sendTeamsMessage(webhookUrl, card);
}

/**
 * Send daily reminder to submit standup
 * @param {Object} user - User to remind
 */
async function sendDailyReminder(user) {
    // For individual reminders, we'd need per-user webhooks or email
    // This is a simplified version that could be adapted
    const webhookUrl = process.env.TEAMS_MANAGER_WEBHOOK_URL;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        notificationType: 'DAILY_REMINDER',
        themeColor: 'F59E0B', // Warning color
        summary: `Reminder: ${user.name} has not submitted today's standup`,
        sections: [
            {
                activityTitle: '⏰ Standup Reminder',
                activitySubtitle: user.name,
                text: `${user.name} has not submitted their daily achievement yet.`,
                markdown: true
            }
        ],
        potentialAction: [
            {
                '@type': 'OpenUri',
                name: 'View Dashboard',
                targets: [
                    { os: 'default', uri: `${frontendUrl}/dashboard` }
                ]
            }
        ]
    };

    return sendTeamsMessage(webhookUrl, card);
}

/**
 * Send approval notification to employee
 * @param {Object} standup - Approved standup
 * @param {string} feedback - Optional manager feedback
 */
async function sendApprovalNotification(standup, feedback) {
    // This would typically go to the employee directly
    // Using manager webhook as a log for now
    const webhookUrl = process.env.TEAMS_MANAGER_WEBHOOK_URL;

    const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        notificationType: 'APPROVAL_NOTIFICATION',
        themeColor: '10B981', // Success color
        summary: `Standup approved for ${standup.user?.name}`,
        sections: [
            {
                activityTitle: '✅ Standup Approved',
                activitySubtitle: standup.user?.name,
                facts: [
                    { name: 'Date:', value: new Date(standup.date).toLocaleDateString() },
                    { name: 'Achievement:', value: standup.achievementTitle },
                    ...(feedback ? [{ name: 'Feedback:', value: feedback }] : [])
                ],
                markdown: true
            }
        ]
    };

    return sendTeamsMessage(webhookUrl, card);
}

/**
 * Send weekly summary report to admin
 * @param {Object} report - Weekly report data
 */
async function sendWeeklySummary(report) {
    const webhookUrl = process.env.TEAMS_ADMIN_WEBHOOK_URL;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!webhookUrl) {
        console.warn('Admin Teams webhook not configured for weekly summary');
        return false;
    }

    const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        notificationType: 'WEEKLY_REPORT',
        themeColor: '6366F1',
        summary: 'Milestone Weekly Summary Report',
        sections: [
            {
                activityTitle: '📈 Weekly Summary Report',
                activitySubtitle: `Week ending ${new Date().toLocaleDateString()}`,
                text: report.executiveSummary,
                markdown: true
            },
            {
                facts: [
                    { name: 'Submission Rate:', value: `${report.submissionRate || 0}%` },
                    { name: 'Completion Rate:', value: `${report.completionRate || 0}%` },
                    { name: 'Total Blockers:', value: `${report.blockerCount || 0}` },
                    { name: 'Trend:', value: report.trend || 'stable' }
                ]
            },
            ...(report.concerns?.length > 0 ? [{
                title: '⚠️ Concerns',
                text: report.concerns.map(c => `• ${c}`).join('\n')
            }] : []),
            ...(report.recommendations?.length > 0 ? [{
                title: '💡 Recommendations',
                text: report.recommendations.map(r => `• ${r}`).join('\n')
            }] : [])
        ],
        potentialAction: [
            {
                '@type': 'OpenUri',
                name: 'View Full Report',
                targets: [
                    { os: 'default', uri: `${frontendUrl}/admin/analytics` }
                ]
            }
        ]
    };

    return sendTeamsMessage(webhookUrl, card);
}

/**
 * Send blocker resolution notification
 * @param {Object} blocker - Resolved blocker
 */
async function sendBlockerResolution(blocker) {
    const webhookUrl = process.env.TEAMS_MANAGER_WEBHOOK_URL;

    const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        notificationType: 'BLOCKER_ALERT',
        themeColor: '10B981',
        summary: `Blocker resolved: ${blocker.title}`,
        sections: [
            {
                activityTitle: '✅ Blocker Resolved',
                facts: [
                    { name: 'Title:', value: blocker.title },
                    { name: 'Originally Raised By:', value: blocker.user?.name || 'Unknown' },
                    { name: 'Resolution:', value: blocker.resolutionNotes || 'No notes provided' },
                    { name: 'Resolved At:', value: new Date().toLocaleString() }
                ],
                markdown: true
            }
        ]
    };

    return sendTeamsMessage(webhookUrl, card);
}

module.exports = {
    sendTeamsMessage,
    sendBlockerAlert,
    sendSubmissionNotification,
    sendDailyReminder,
    sendApprovalNotification,
    sendWeeklySummary,
    sendBlockerResolution
};
