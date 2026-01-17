/**
 * Report Controller
 * Handles API requests for reports
 */

const { DailyDigest } = require("../services");
const { CsvExport, ExcelExport } = require("../services");
const { NotificationRouterInstance } = require("../services");
const { Analysis, Call } = require("../models");
const logger = require("../utils/logger");
const config = require("../config");
const path = require("path");
const fs = require("fs");

/**
 * GET /api/reports/daily
 * Get daily digest report
 */
async function getDailyReport(req, res) {
  try {
    const { date, includeDetails } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const digest = await DailyDigest.generateDigest(targetDate, {
      includeDetails: includeDetails === "true",
    });

    res.json({
      success: true,
      data: digest,
    });
  } catch (error) {
    logger.error("Error getting daily report", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to generate daily report",
      message: error.message,
    });
  }
}

/**
 * GET /api/reports/weekly
 * Get weekly summary report
 */
async function getWeeklyReport(req, res) {
  try {
    const { days = 7 } = req.query;

    const dailyDigests = await DailyDigest.generateMultiDayDigest(parseInt(days));
    const weeklySummary = DailyDigest.generateWeeklySummary(dailyDigests);

    res.json({
      success: true,
      data: weeklySummary,
    });
  } catch (error) {
    logger.error("Error getting weekly report", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to generate weekly report",
      message: error.message,
    });
  }
}

/**
 * GET /api/reports/trends
 * Get trend analysis comparing periods
 */
async function getTrends(req, res) {
  try {
    const { currentDays = 7, compareDays = 7 } = req.query;

    const trends = await DailyDigest.getTrendAnalysis(
      parseInt(currentDays),
      parseInt(compareDays)
    );

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    logger.error("Error getting trends", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to generate trend analysis",
      message: error.message,
    });
  }
}

/**
 * POST /api/reports/daily/send
 * Send daily digest via notification channels
 */
async function sendDailyDigest(req, res) {
  try {
    const { date, channels } = req.body;

    const targetDate = date ? new Date(date) : new Date();
    const digest = await DailyDigest.generateDigest(targetDate);

    if (digest.totalCalls === 0) {
      return res.json({
        success: true,
        message: "No calls to report for this date",
        data: digest,
      });
    }

    const results = await NotificationRouterInstance.sendDailyDigest(digest, {
      channels: channels || ["telegram", "console"],
    });

    res.json({
      success: true,
      data: {
        digest,
        notificationResults: results,
      },
    });
  } catch (error) {
    logger.error("Error sending daily digest", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to send daily digest",
      message: error.message,
    });
  }
}

/**
 * GET /api/reports/agent/:agentId
 * Get report for a specific agent
 */
async function getAgentReport(req, res) {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    // Get analyses for this agent within date range
    const db = Analysis.db;
    const sql = `
      SELECT a.*, c.duration_seconds, c.caller_number, c.callee_number
      FROM analyses a
      JOIN calls c ON a.call_id = c.id
      WHERE c.agent_id = ?
      AND a.created_at >= ? AND a.created_at <= ?
      ORDER BY a.created_at DESC
    `;

    const stmt = db.prepare(sql);
    const results = stmt.all(agentId, start, end);

    // Parse JSON fields and calculate stats
    const analyses = results.map((r) => {
      if (r.category_scores) {
        try { r.category_scores = JSON.parse(r.category_scores); } catch (e) {}
      }
      if (r.issues) {
        try { r.issues = JSON.parse(r.issues); } catch (e) {}
      }
      return r;
    });

    const scores = analyses.map((a) => a.overall_score).filter((s) => s != null);

    const report = {
      agentId,
      period: { start, end },
      totalCalls: analyses.length,
      avgScore: scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      excellentCalls: scores.filter((s) => s >= config.scoring.thresholds.excellent).length,
      goodCalls: scores.filter((s) => s >= config.scoring.thresholds.good).length,
      lowScoreCalls: scores.filter((s) => s < config.scoring.thresholds.alert).length,
      recentCalls: analyses.slice(0, 10).map((a) => ({
        callId: a.call_id,
        score: a.overall_score,
        sentiment: a.sentiment,
        createdAt: a.created_at,
      })),
    };

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error("Error getting agent report", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to generate agent report",
      message: error.message,
    });
  }
}

module.exports = {
  getDailyReport,
  getWeeklyReport,
  getTrends,
  sendDailyDigest,
  getAgentReport,
};
