const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

const model = genAI?.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Generate goal suggestions based on recent history
 * @param {Array} recentStandups - Last 7 days of standups
 * @param {string} department - User's department
 * @returns {Array} Array of goal suggestions
 */
async function suggestGoals(recentStandups, department) {
    if (!model) {
        return getDefaultSuggestions(department);
    }

    try {
        const historyText = recentStandups.map(s =>
            `Date: ${s.date.toDateString()}\nGoal: ${s.todayGoal}\nAchievement: ${s.achievementTitle || 'Not submitted'}\nStatus: ${s.goalStatus || 'Pending'}`
        ).join('\n\n');

        const prompt = `You are a productivity assistant for a workplace standup system.

Analyze the following 7 days of work history for an employee in the ${department} department:

${historyText || 'No recent history available.'}

Based on this pattern, suggest 3-5 specific, actionable, and achievable goals for today. 
Goals should:
- Be concrete and measurable
- Build on previous work or address incomplete items
- Be realistic for a single workday
- Be relevant to the ${department} department

Return ONLY a JSON array of strings with the goal suggestions. No explanation needed.
Example: ["Complete the API documentation for user authentication module", "Review and merge 3 pending pull requests", "Set up automated testing for the login flow"]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parse JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return getDefaultSuggestions(department);
    } catch (error) {
        console.error('Gemini suggestGoals error:', error.message);
        return getDefaultSuggestions(department);
    }
}

/**
 * Analyze a standup submission for quality
 * @param {Object} standup - Standup record with user and files
 * @returns {Object} Analysis results
 */
async function analyzeStandup(standup) {
    if (!model) {
        return getDefaultStandupAnalysis();
    }

    try {
        const prompt = `You are a productivity analyst evaluating a daily standup submission.

Goal Set: "${standup.todayGoal || 'No goal set'}"

Achievement Submitted:
- Title: "${standup.achievementTitle}"
- Description: "${standup.achievementDesc}"
- Status: ${standup.goalStatus}
${standup.notAchievedReason ? `- Reason for incomplete: "${standup.notAchievedReason}"` : ''}
- Files attached: ${standup.uploadedFiles?.length || 0}

Analyze this submission and return a JSON object with:
{
  "score": (1-10 quality score),
  "isSpecific": (boolean - is the achievement description specific and detailed?),
  "alignsWithGoal": (boolean - does the achievement align with the stated goal?),
  "reasonQuality": ("excellent" | "good" | "fair" | "poor" - quality of reason if goal not achieved),
  "feedback": (one constructive sentence for the employee),
  "highlights": (array of 1-3 positive points),
  "improvements": (array of 0-2 suggestions for improvement)
}

Return ONLY the JSON object.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return getDefaultStandupAnalysis();
    } catch (error) {
        console.error('Gemini analyzeStandup error:', error.message);
        return getDefaultStandupAnalysis();
    }
}

/**
 * Analyze a blocker and suggest resolutions
 * @param {Object} blocker - Blocker record
 * @param {Array} similarBlockers - Similar resolved blockers
 * @returns {Object} Analysis and recommendations
 */
async function analyzeBlocker(blocker, similarBlockers = []) {
    if (!model) {
        return getDefaultBlockerAnalysis();
    }

    try {
        const similarText = similarBlockers.map(b =>
            `Title: ${b.title}\nResolution: ${b.resolutionNotes}`
        ).join('\n\n');

        const prompt = `You are a technical support analyst helping resolve workplace blockers.

New Blocker:
- Title: "${blocker.title}"
- Description: "${blocker.description}"
- Category: ${blocker.category}
- Severity: ${blocker.severity}
- Support Required: ${blocker.supportRequired}

${similarBlockers.length > 0 ? `Similar Past Blockers (Resolved):\n${similarText}` : 'No similar past blockers found.'}

Analyze this blocker and return a JSON object with:
{
  "suggestedCategory": (confirm or suggest better category),
  "severityAppropriate": (boolean - is the severity level appropriate?),
  "suggestedSeverity": (if not appropriate, suggest correct level),
  "estimatedResolutionTime": (e.g., "2-4 hours", "1-2 days"),
  "similarResolutions": (array of 1-3 suggested approaches based on similar issues),
  "recommendedAction": (immediate next step to take),
  "requiresEscalation": (boolean - should this be escalated?),
  "escalationReason": (if requires escalation, explain why)
}

Return ONLY the JSON object.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return getDefaultBlockerAnalysis();
    } catch (error) {
        console.error('Gemini analyzeBlocker error:', error.message);
        return getDefaultBlockerAnalysis();
    }
}

/**
 * Generate weekly insights report
 * @param {Object} metrics - Weekly metrics data
 * @returns {Object} Report with insights and recommendations
 */
async function generateWeeklyReport(metrics) {
    if (!model) {
        return getDefaultWeeklyReport(metrics);
    }

    try {
        const prompt = `You are an executive productivity analyst generating a weekly team report.

Weekly Metrics:
- Total Standups: ${metrics.totalStandups}
- Submission Rate: ${metrics.submissionRate}%
- Goal Completion Rate: ${metrics.completionRate}%
- Total Blockers: ${metrics.blockerCount}
- Critical Blockers: ${metrics.blockersBySeverity?.critical || 0}
- High Blockers: ${metrics.blockersBySeverity?.high || 0}
- Resolved Blockers: ${metrics.resolvedBlockers}

Department Breakdown:
${metrics.byDepartment?.map(d => `- ${d.department}: ${d.standups} standups, ${d.blockers} blockers`).join('\n') || 'No department data'}

Generate an executive summary and return a JSON object with:
{
  "executiveSummary": (3-4 sentence overview for leadership),
  "concerns": (array of 1-3 items that need attention),
  "positives": (array of 1-3 positive observations),
  "recommendations": (array of 2-3 actionable recommendations),
  "focusAreas": (array of departments or areas needing focus),
  "trend": ("improving" | "stable" | "declining")
}

Return ONLY the JSON object.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return getDefaultWeeklyReport(metrics);
    } catch (error) {
        console.error('Gemini generateWeeklyReport error:', error.message);
        return getDefaultWeeklyReport(metrics);
    }
}

/**
 * Analyze sentiment of text for burnout detection
 * @param {string} text - Text to analyze
 * @returns {Object} Sentiment analysis
 */
async function analyzeSentiment(text) {
    if (!model) {
        return getDefaultSentimentAnalysis();
    }

    try {
        const prompt = `You are a workplace wellness analyst detecting signs of stress or burnout.

Analyze the following text from a daily standup submission:
"${text}"

Return a JSON object with:
{
  "sentiment": ("POSITIVE" | "NEUTRAL" | "NEGATIVE" | "FRUSTRATED"),
  "engagementLevel": ("HIGH" | "MEDIUM" | "LOW"),
  "burnoutIndicators": {
    "detected": (boolean),
    "reason": (explanation if detected, null otherwise)
  },
  "needsAttention": (boolean - should a manager be alerted?),
  "supportSuggestion": (null or suggestion for how to support this employee)
}

Return ONLY the JSON object.`;

        const result = await model.generateContent(prompt);
        const text_r = result.response.text();

        const jsonMatch = text_r.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return getDefaultSentimentAnalysis();
    } catch (error) {
        console.error('Gemini analyzeSentiment error:', error.message);
        return getDefaultSentimentAnalysis();
    }
}

// Default responses when Gemini is not available
function getDefaultSuggestions(department) {
    const suggestions = {
        Engineering: [
            "Complete code review for pending pull requests",
            "Document recent feature implementations",
            "Fix high-priority bugs from the backlog"
        ],
        Design: [
            "Finalize mockups for the current sprint",
            "Conduct user research review",
            "Update design system components"
        ],
        Marketing: [
            "Review campaign performance metrics",
            "Draft content for upcoming launch",
            "Coordinate with sales on lead generation"
        ],
        default: [
            "Complete pending tasks from yesterday",
            "Attend scheduled meetings and follow up on action items",
            "Document progress and update relevant stakeholders"
        ]
    };
    return suggestions[department] || suggestions.default;
}

function getDefaultStandupAnalysis() {
    return {
        score: 7,
        isSpecific: true,
        alignsWithGoal: true,
        reasonQuality: "good",
        feedback: "Good submission! Consider adding more specific metrics or outcomes.",
        highlights: ["Completed on time"],
        improvements: ["Add more quantifiable results"]
    };
}

function getDefaultBlockerAnalysis() {
    return {
        suggestedCategory: "TECHNICAL",
        severityAppropriate: true,
        estimatedResolutionTime: "4-8 hours",
        similarResolutions: ["Contact the relevant team lead for guidance"],
        recommendedAction: "Escalate to manager if not resolved within 24 hours",
        requiresEscalation: false
    };
}

function getDefaultWeeklyReport(metrics) {
    return {
        executiveSummary: `This week saw ${metrics.totalStandups} standups with a ${metrics.submissionRate}% submission rate. Goal completion rate was ${metrics.completionRate}%. There were ${metrics.blockerCount} blockers raised.`,
        concerns: metrics.blockersBySeverity?.critical > 0 ? ["Critical blockers need immediate attention"] : [],
        positives: metrics.submissionRate > 80 ? ["Strong submission compliance"] : ["Team is actively participating"],
        recommendations: ["Continue monitoring blocker resolution times", "Encourage detailed goal setting"],
        focusAreas: [],
        trend: metrics.completionRate > 80 ? "improving" : "stable"
    };
}

function getDefaultSentimentAnalysis() {
    return {
        sentiment: "NEUTRAL",
        engagementLevel: "MEDIUM",
        burnoutIndicators: { detected: false, reason: null },
        needsAttention: false,
        supportSuggestion: null
    };
}

module.exports = {
    suggestGoals,
    analyzeStandup,
    analyzeBlocker,
    generateWeeklyReport,
    analyzeSentiment
};
