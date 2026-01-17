/**
 * Daily Digest Report Service
 * Generates daily summary reports for call analyses
 */

const { format, startOfDay, endOfDay, subDays } = require("date-fns");
const { Analysis, Call, Notification } = require("../../models");
const logger = require("../../utils/logger");
const config = require("../../config");

class DailyDigestService {
  constructor() {
    this.thresholds = config.scoring.thresholds;
  }

  /**
   * Generate daily digest for a specific date
   * @param {Date|string} date - Date to generate digest for
   * @param {Object} options - Generation options
   * @returns {Object} - Daily digest data
   */
  async generateDigest(date = new Date(), options = {}) {
    const targetDate = typeof date === "string" ? new Date(date) : date;
    const dateStr = format(targetDate, "yyyy-MM-dd");

    const startDate = startOfDay(targetDate).toISOString();
    const endDate = endOfDay(targetDate).toISOString();

    logger.info("Generating daily digest", { date: dateStr });

    // Get all analyses for the date
    const analyses = this.getAnalysesForDateRange(startDate, endDate);

    if (analyses.length === 0) {
      return {
        date: dateStr,
        totalCalls: 0,
        message: "No calls analyzed for this date",
        generatedAt: new Date().toISOString(),
      };
    }

    // Calculate statistics
    const stats = this.calculateStatistics(analyses);

    // Get top issues
    const topIssues = this.aggregateIssues(analyses);

    // Get agent performance (if agents are assigned)
    const agentPerformance = this.calculateAgentPerformance(analyses);

    // Get alerts generated for this date
    const alertsCount = this.getAlertsCount(startDate, endDate);

    // Build digest object
    const digest = {
      date: dateStr,
      generatedAt: new Date().toISOString(),

      // Overall statistics
      totalCalls: analyses.length,
      avgScore: stats.avgScore,
      minScore: stats.minScore,
      maxScore: stats.maxScore,
      medianScore: stats.medianScore,

      // Performance breakdown
      excellentCalls: stats.excellentCalls,
      goodCalls: stats.goodCalls,
      lowScoreCalls: stats.lowScoreCalls,

      // Sentiment analysis
      positiveSentiment: stats.positiveSentiment,
      neutralSentiment: stats.neutralSentiment,
      negativeSentiment: stats.negativeSentiment,

      // Category averages
      categoryAverages: stats.categoryAverages,

      // Top issues
      topIssues: topIssues.slice(0, 10),
      totalIssues: topIssues.reduce((sum, i) => sum + i.count, 0),

      // Agent performance
      agentPerformance: agentPerformance.slice(0, 10),
      topPerformer: agentPerformance[0] || null,
      needsImprovement: agentPerformance.filter((a) => a.avgScore < this.thresholds.alert),

      // Alerts
      alertsCount,

      // Thresholds used
      thresholds: this.thresholds,
    };

    // Include call details if requested
    if (options.includeDetails) {
      digest.calls = analyses.map((a) => ({
        callId: a.call_id,
        agentId: a.agent_id,
        score: a.overall_score,
        sentiment: a.sentiment,
        issuesCount: (a.issues || []).length,
      }));
    }

    logger.info("Daily digest generated", {
      date: dateStr,
      totalCalls: digest.totalCalls,
      avgScore: digest.avgScore,
    });

    return digest;
  }

  /**
   * Get analyses for date range (synchronous database call)
   * @param {string} startDate - Start date ISO string
   * @param {string} endDate - End date ISO string
   * @returns {Array} - Analysis records
   */
  getAnalysesForDateRange(startDate, endDate) {
    // Using the model's findAll with date filtering
    // Since the model doesn't have date filters, we'll use raw SQL approach
    const db = Analysis.db;

    const sql = `
      SELECT a.*, c.agent_id, c.duration_seconds, c.caller_number, c.callee_number
      FROM analyses a
      LEFT JOIN calls c ON a.call_id = c.id
      WHERE a.created_at >= ? AND a.created_at <= ?
      ORDER BY a.created_at DESC
    `;

    const stmt = db.prepare(sql);
    const results = stmt.all(startDate, endDate);

    // Parse JSON fields
    return results.map((r) => {
      if (r.category_scores) {
        try {
          r.category_scores = JSON.parse(r.category_scores);
        } catch (e) {}
      }
      if (r.issues) {
        try {
          r.issues = JSON.parse(r.issues);
        } catch (e) {}
      }
      if (r.recommendations) {
        try {
          r.recommendations = JSON.parse(r.recommendations);
        } catch (e) {}
      }
      return r;
    });
  }

  /**
   * Calculate statistics from analyses
   * @param {Array} analyses - Analysis records
   * @returns {Object} - Statistics
   */
  calculateStatistics(analyses) {
    const scores = analyses.map((a) => a.overall_score).filter((s) => s != null);

    if (scores.length === 0) {
      return {
        avgScore: 0,
        minScore: 0,
        maxScore: 0,
        medianScore: 0,
        excellentCalls: 0,
        goodCalls: 0,
        lowScoreCalls: 0,
        positiveSentiment: 0,
        neutralSentiment: 0,
        negativeSentiment: 0,
        categoryAverages: {},
      };
    }

    // Sort scores for median calculation
    const sortedScores = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sortedScores.length / 2);
    const medianScore = sortedScores.length % 2 === 0
      ? (sortedScores[mid - 1] + sortedScores[mid]) / 2
      : sortedScores[mid];

    // Calculate category averages
    const categoryTotals = {};
    const categoryCounts = {};

    for (const analysis of analyses) {
      const categoryScores = analysis.category_scores || {};
      for (const [key, value] of Object.entries(categoryScores)) {
        if (value != null) {
          categoryTotals[key] = (categoryTotals[key] || 0) + value;
          categoryCounts[key] = (categoryCounts[key] || 0) + 1;
        }
      }
    }

    const categoryAverages = {};
    for (const key of Object.keys(categoryTotals)) {
      categoryAverages[key] = Math.round((categoryTotals[key] / categoryCounts[key]) * 10) / 10;
    }

    return {
      avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      medianScore: Math.round(medianScore * 10) / 10,
      excellentCalls: scores.filter((s) => s >= this.thresholds.excellent).length,
      goodCalls: scores.filter((s) => s >= this.thresholds.good && s < this.thresholds.excellent).length,
      lowScoreCalls: scores.filter((s) => s < this.thresholds.alert).length,
      positiveSentiment: analyses.filter((a) => a.sentiment === "positive").length,
      neutralSentiment: analyses.filter((a) => a.sentiment === "neutral").length,
      negativeSentiment: analyses.filter((a) => a.sentiment === "negative").length,
      categoryAverages,
    };
  }

  /**
   * Aggregate issues from all analyses
   * @param {Array} analyses - Analysis records
   * @returns {Array} - Aggregated issues sorted by count
   */
  aggregateIssues(analyses) {
    const issueMap = {};

    for (const analysis of analyses) {
      const issues = analysis.issues || [];
      for (const issue of issues) {
        const category = issue.category || "General";
        const severity = issue.severity || "medium";
        const key = `${category}|${severity}`;

        if (!issueMap[key]) {
          issueMap[key] = {
            category,
            severity,
            count: 0,
            examples: [],
          };
        }

        issueMap[key].count++;

        if (issue.description && issueMap[key].examples.length < 3) {
          issueMap[key].examples.push(issue.description);
        }
      }
    }

    // Sort by count descending
    return Object.values(issueMap).sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate agent performance
   * @param {Array} analyses - Analysis records
   * @returns {Array} - Agent performance sorted by average score
   */
  calculateAgentPerformance(analyses) {
    const agentMap = {};

    for (const analysis of analyses) {
      const agentId = analysis.agent_id || "unassigned";

      if (!agentMap[agentId]) {
        agentMap[agentId] = {
          agentId,
          totalCalls: 0,
          totalScore: 0,
          scores: [],
          sentiments: { positive: 0, neutral: 0, negative: 0 },
        };
      }

      agentMap[agentId].totalCalls++;
      if (analysis.overall_score != null) {
        agentMap[agentId].totalScore += analysis.overall_score;
        agentMap[agentId].scores.push(analysis.overall_score);
      }
      if (analysis.sentiment) {
        agentMap[agentId].sentiments[analysis.sentiment]++;
      }
    }

    // Calculate averages and sort
    return Object.values(agentMap)
      .map((agent) => ({
        agentId: agent.agentId,
        totalCalls: agent.totalCalls,
        avgScore: agent.scores.length > 0
          ? Math.round((agent.totalScore / agent.scores.length) * 10) / 10
          : 0,
        minScore: agent.scores.length > 0 ? Math.min(...agent.scores) : 0,
        maxScore: agent.scores.length > 0 ? Math.max(...agent.scores) : 0,
        sentiments: agent.sentiments,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  /**
   * Get alerts count for date range
   * @param {string} startDate - Start date ISO string
   * @param {string} endDate - End date ISO string
   * @returns {number} - Alert count
   */
  getAlertsCount(startDate, endDate) {
    try {
      const db = Notification.db;
      const sql = `
        SELECT COUNT(*) as count
        FROM notifications
        WHERE type = 'low_score_alert'
        AND created_at >= ? AND created_at <= ?
      `;
      const stmt = db.prepare(sql);
      const result = stmt.get(startDate, endDate);
      return result?.count || 0;
    } catch (error) {
      logger.warn("Could not get alerts count", { error: error.message });
      return 0;
    }
  }

  /**
   * Generate digest for the past N days
   * @param {number} days - Number of days
   * @param {Object} options - Generation options
   * @returns {Array} - Array of daily digests
   */
  async generateMultiDayDigest(days = 7, options = {}) {
    const digests = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const targetDate = subDays(today, i);
      const digest = await this.generateDigest(targetDate, options);
      digests.push(digest);
    }

    return digests;
  }

  /**
   * Generate weekly summary from daily digests
   * @param {Array} dailyDigests - Array of daily digests
   * @returns {Object} - Weekly summary
   */
  generateWeeklySummary(dailyDigests) {
    const nonEmptyDigests = dailyDigests.filter((d) => d.totalCalls > 0);

    if (nonEmptyDigests.length === 0) {
      return {
        totalCalls: 0,
        message: "No calls analyzed this week",
      };
    }

    const totalCalls = nonEmptyDigests.reduce((sum, d) => sum + d.totalCalls, 0);
    const totalScore = nonEmptyDigests.reduce((sum, d) => sum + (d.avgScore * d.totalCalls), 0);
    const avgScore = Math.round((totalScore / totalCalls) * 10) / 10;

    // Aggregate all issues
    const allIssues = {};
    for (const digest of nonEmptyDigests) {
      for (const issue of (digest.topIssues || [])) {
        const key = `${issue.category}|${issue.severity}`;
        if (!allIssues[key]) {
          allIssues[key] = { ...issue, count: 0 };
        }
        allIssues[key].count += issue.count;
      }
    }

    return {
      period: `${format(subDays(new Date(), 6), "yyyy-MM-dd")} to ${format(new Date(), "yyyy-MM-dd")}`,
      totalCalls,
      avgScore,
      excellentCalls: nonEmptyDigests.reduce((sum, d) => sum + (d.excellentCalls || 0), 0),
      goodCalls: nonEmptyDigests.reduce((sum, d) => sum + (d.goodCalls || 0), 0),
      lowScoreCalls: nonEmptyDigests.reduce((sum, d) => sum + (d.lowScoreCalls || 0), 0),
      alertsCount: nonEmptyDigests.reduce((sum, d) => sum + (d.alertsCount || 0), 0),
      topIssues: Object.values(allIssues).sort((a, b) => b.count - a.count).slice(0, 10),
      dailyBreakdown: nonEmptyDigests.map((d) => ({
        date: d.date,
        totalCalls: d.totalCalls,
        avgScore: d.avgScore,
      })),
    };
  }

  /**
   * Get trend analysis comparing periods
   * @param {number} currentDays - Days to analyze
   * @param {number} compareDays - Previous period to compare
   * @returns {Object} - Trend analysis
   */
  async getTrendAnalysis(currentDays = 7, compareDays = 7) {
    const currentDigests = await this.generateMultiDayDigest(currentDays);
    const currentSummary = this.generateWeeklySummary(currentDigests);

    // Generate previous period digests
    const previousDigests = [];
    const startOffset = currentDays;
    for (let i = startOffset; i < startOffset + compareDays; i++) {
      const targetDate = subDays(new Date(), i);
      const digest = await this.generateDigest(targetDate);
      previousDigests.push(digest);
    }
    const previousSummary = this.generateWeeklySummary(previousDigests);

    // Calculate trends
    const trend = {
      current: currentSummary,
      previous: previousSummary,
      changes: {
        totalCalls: currentSummary.totalCalls - previousSummary.totalCalls,
        avgScore: Math.round((currentSummary.avgScore - previousSummary.avgScore) * 10) / 10,
        lowScoreCalls: currentSummary.lowScoreCalls - previousSummary.lowScoreCalls,
      },
    };

    // Determine overall trend direction
    if (trend.changes.avgScore > 2) {
      trend.direction = "improving";
    } else if (trend.changes.avgScore < -2) {
      trend.direction = "declining";
    } else {
      trend.direction = "stable";
    }

    return trend;
  }
}

module.exports = DailyDigestService;
