/**
 * Export Routes
 * API endpoints for data exports
 */

const express = require("express");
const router = express.Router();
const exportController = require("../controllers/export.controller");

// =======================
// Export Endpoints
// =======================

/**
 * POST /api/export/csv
 * Export analyses to CSV file
 * Body: { startDate?, endDate?, minScore?, maxScore?, agentId?, includeRecommendations? }
 */
router.post("/csv", exportController.exportToCsv);

/**
 * POST /api/export/excel
 * Export analyses to Excel file
 * Body: { startDate?, endDate?, minScore?, maxScore?, agentId?, includeCharts?, includeSummary? }
 */
router.post("/excel", exportController.exportToExcel);

/**
 * POST /api/export/daily-report
 * Export daily report to Excel
 * Body: { date?: string }
 */
router.post("/daily-report", exportController.exportDailyReport);

/**
 * GET /api/export/download/:filename
 * Download an export file
 */
router.get("/download/:filename", exportController.downloadExport);

/**
 * GET /api/export/files
 * List available export files
 */
router.get("/files", exportController.listExportFiles);

/**
 * DELETE /api/export/files/:filename
 * Delete an export file
 */
router.delete("/files/:filename", exportController.deleteExportFile);

module.exports = router;
