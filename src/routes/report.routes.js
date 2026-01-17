/**
 * Report Routes
 * API endpoints for reports
 */

const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");

// =======================
// Daily and Weekly Reports
// =======================

/**
 * GET /api/reports/daily
 * Get daily digest report
 * Query: { date?: string, includeDetails?: boolean }
 */
router.get("/daily", reportController.getDailyReport);

/**
 * GET /api/reports/weekly
 * Get weekly summary report
 * Query: { days?: number }
 */
router.get("/weekly", reportController.getWeeklyReport);

/**
 * GET /api/reports/trends
 * Get trend analysis comparing periods
 * Query: { currentDays?: number, compareDays?: number }
 */
router.get("/trends", reportController.getTrends);

/**
 * POST /api/reports/daily/send
 * Send daily digest via notification channels
 * Body: { date?: string, channels?: string[] }
 */
router.post("/daily/send", reportController.sendDailyDigest);

/**
 * GET /api/reports/agent/:agentId
 * Get report for a specific agent
 * Query: { startDate?: string, endDate?: string }
 */
router.get("/agent/:agentId", reportController.getAgentReport);

module.exports = router;
