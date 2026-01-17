/**
 * Analysis Routes
 * API endpoints for call quality analysis
 */

const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis.controller");

// =======================
// Call-specific analysis endpoints
// =======================

/**
 * GET /api/calls/:callId/analysis
 * Get analysis for a specific call
 */
router.get("/calls/:callId/analysis", analysisController.getCallAnalysis);

/**
 * POST /api/calls/:callId/analyze
 * Trigger analysis for a call
 * Body: { model?: string, async?: boolean }
 */
router.post("/calls/:callId/analyze", analysisController.analyzeCall);

/**
 * POST /api/calls/:callId/reanalyze
 * Re-analyze a call with different model/settings
 * Body: { model?: string, async?: boolean }
 */
router.post("/calls/:callId/reanalyze", analysisController.reanalyzeCall);

/**
 * GET /api/calls/:callId/report
 * Get formatted analysis report for a call
 */
router.get("/calls/:callId/report", analysisController.getCallReport);

// =======================
// Analysis collection endpoints
// =======================

/**
 * GET /api/analyses
 * Get all analyses with pagination
 * Query: { page?: number, limit?: number, minScore?: number, maxScore?: number, sentiment?: string }
 */
router.get("/analyses", analysisController.getAnalyses);

/**
 * GET /api/analyses/alerts
 * Get low-scoring calls that need attention
 * Query: { threshold?: number, page?: number, limit?: number }
 */
router.get("/analyses/alerts", analysisController.getAlerts);

/**
 * GET /api/analyses/statistics
 * Get analysis statistics
 * Query: { orgId?: string, startDate?: string, endDate?: string }
 */
router.get("/analyses/statistics", analysisController.getStatistics);

/**
 * GET /api/analyses/models
 * Get available and recommended models
 */
router.get("/analyses/models", analysisController.getModels);

/**
 * GET /api/analyses/:analysisId
 * Get a specific analysis by ID
 */
router.get("/analyses/:analysisId", analysisController.getAnalysisById);

module.exports = router;
