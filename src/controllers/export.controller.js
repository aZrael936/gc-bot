/**
 * Export Controller
 * Handles API requests for data exports
 */

const { CsvExport, ExcelExport } = require("../services");
const { Analysis, Call } = require("../models");
const logger = require("../utils/logger");
const path = require("path");
const fs = require("fs");

/**
 * Get analyses with call data for export
 * @param {Object} filters - Query filters
 * @returns {Array} - Analysis records with call data
 */
function getAnalysesForExport(filters = {}) {
  const { startDate, endDate, minScore, maxScore, agentId, limit = 1000 } = filters;

  const db = Analysis.db;
  let sql = `
    SELECT a.*, c.agent_id, c.duration_seconds, c.caller_number, c.callee_number, c.direction
    FROM analyses a
    LEFT JOIN calls c ON a.call_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    sql += ` AND a.created_at >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND a.created_at <= ?`;
    params.push(endDate);
  }

  if (minScore !== undefined) {
    sql += ` AND a.overall_score >= ?`;
    params.push(minScore);
  }

  if (maxScore !== undefined) {
    sql += ` AND a.overall_score <= ?`;
    params.push(maxScore);
  }

  if (agentId) {
    sql += ` AND c.agent_id = ?`;
    params.push(agentId);
  }

  sql += ` ORDER BY a.created_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql);
  const results = stmt.all(...params);

  // Parse JSON fields
  return results.map((r) => {
    if (r.category_scores) {
      try { r.category_scores = JSON.parse(r.category_scores); } catch (e) {}
    }
    if (r.issues) {
      try { r.issues = JSON.parse(r.issues); } catch (e) {}
    }
    if (r.recommendations) {
      try { r.recommendations = JSON.parse(r.recommendations); } catch (e) {}
    }
    return r;
  });
}

/**
 * POST /api/export/csv
 * Export analyses to CSV file
 */
async function exportToCsv(req, res) {
  try {
    const { startDate, endDate, minScore, maxScore, agentId, includeRecommendations } = req.body;

    const analyses = getAnalysesForExport({
      startDate,
      endDate,
      minScore,
      maxScore,
      agentId,
    });

    if (analyses.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No analyses found matching the criteria",
      });
    }

    const result = await CsvExport.exportAnalyses(analyses, {
      includeRecommendations: includeRecommendations === true,
    });

    res.json({
      success: true,
      data: {
        filename: result.filename,
        totalRecords: result.totalRecords,
        fileSize: result.fileSize,
        downloadUrl: `/api/export/download/${result.filename}`,
        exportedAt: result.exportedAt,
      },
    });
  } catch (error) {
    logger.error("Error exporting to CSV", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to export to CSV",
      message: error.message,
    });
  }
}

/**
 * POST /api/export/excel
 * Export analyses to Excel file
 */
async function exportToExcel(req, res) {
  try {
    const { startDate, endDate, minScore, maxScore, agentId, includeCharts, includeSummary } = req.body;

    const analyses = getAnalysesForExport({
      startDate,
      endDate,
      minScore,
      maxScore,
      agentId,
    });

    if (analyses.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No analyses found matching the criteria",
      });
    }

    const result = await ExcelExport.exportAnalyses(analyses, {
      includeCharts: includeCharts !== false,
      includeSummary: includeSummary !== false,
    });

    res.json({
      success: true,
      data: {
        filename: result.filename,
        totalRecords: result.totalRecords,
        fileSize: result.fileSize,
        sheets: result.sheets,
        downloadUrl: `/api/export/download/${result.filename}`,
        exportedAt: result.exportedAt,
      },
    });
  } catch (error) {
    logger.error("Error exporting to Excel", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to export to Excel",
      message: error.message,
    });
  }
}

/**
 * GET /api/export/download/:filename
 * Download an export file
 */
async function downloadExport(req, res) {
  try {
    const { filename } = req.params;

    // Validate filename to prevent path traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({
        success: false,
        error: "Invalid filename",
      });
    }

    const exportDir = path.join(process.cwd(), "storage", "exports");
    const filePath = path.join(exportDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Export file not found",
      });
    }

    // Set appropriate content type
    let contentType = "application/octet-stream";
    if (filename.endsWith(".csv")) {
      contentType = "text/csv";
    } else if (filename.endsWith(".xlsx")) {
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error("Error downloading export", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to download export",
      message: error.message,
    });
  }
}

/**
 * GET /api/export/files
 * List available export files
 */
async function listExportFiles(req, res) {
  try {
    const csvFiles = CsvExport.getExportFiles();
    const excelFiles = ExcelExport.getExportFiles();

    const files = [
      ...csvFiles.map((f) => ({ ...f, type: "csv" })),
      ...excelFiles.map((f) => ({ ...f, type: "excel" })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: {
        files,
        totalFiles: files.length,
      },
    });
  } catch (error) {
    logger.error("Error listing export files", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to list export files",
      message: error.message,
    });
  }
}

/**
 * DELETE /api/export/files/:filename
 * Delete an export file
 */
async function deleteExportFile(req, res) {
  try {
    const { filename } = req.params;

    // Validate filename
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({
        success: false,
        error: "Invalid filename",
      });
    }

    let deleted = false;

    if (filename.endsWith(".csv")) {
      deleted = CsvExport.deleteExportFile(filename);
    } else if (filename.endsWith(".xlsx")) {
      // Add delete method to Excel export
      const exportDir = path.join(process.cwd(), "storage", "exports");
      const filePath = path.join(exportDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
      }
    }

    if (deleted) {
      res.json({
        success: true,
        message: `File ${filename} deleted successfully`,
      });
    } else {
      res.status(404).json({
        success: false,
        error: "File not found",
      });
    }
  } catch (error) {
    logger.error("Error deleting export file", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to delete export file",
      message: error.message,
    });
  }
}

/**
 * POST /api/export/daily-report
 * Export daily report to Excel
 */
async function exportDailyReport(req, res) {
  try {
    const { date } = req.body;
    const { DailyDigest } = require("../services");

    const targetDate = date ? new Date(date) : new Date();
    const digest = await DailyDigest.generateDigest(targetDate, { includeDetails: true });

    if (digest.totalCalls === 0) {
      return res.status(404).json({
        success: false,
        error: "No calls found for this date",
      });
    }

    const dateStr = targetDate.toISOString().split("T")[0];
    const result = await ExcelExport.exportDailyReport(digest, dateStr);

    res.json({
      success: true,
      data: {
        filename: result.filename,
        fileSize: result.fileSize,
        downloadUrl: `/api/export/download/${result.filename}`,
        exportedAt: result.exportedAt,
        summary: {
          date: dateStr,
          totalCalls: digest.totalCalls,
          avgScore: digest.avgScore,
        },
      },
    });
  } catch (error) {
    logger.error("Error exporting daily report", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to export daily report",
      message: error.message,
    });
  }
}

module.exports = {
  exportToCsv,
  exportToExcel,
  downloadExport,
  listExportFiles,
  deleteExportFile,
  exportDailyReport,
};
