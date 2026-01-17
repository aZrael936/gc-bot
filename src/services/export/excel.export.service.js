/**
 * Excel Export Service
 * Exports call analysis data to Excel format with styling
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const { format } = require("date-fns");
const logger = require("../../utils/logger");
const config = require("../../config");

class ExcelExportService {
  constructor() {
    this.exportDir = path.join(config.storage.path, "exports");
    this.ensureExportDir();
  }

  /**
   * Ensure export directory exists
   */
  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Get score color based on thresholds
   * @param {number} score - Score value
   * @returns {Object} - ExcelJS fill object
   */
  getScoreColor(score) {
    const { alert, good, excellent } = config.scoring.thresholds;

    if (score >= excellent) {
      return { type: "pattern", pattern: "solid", fgColor: { argb: "FF90EE90" } }; // Light green
    } else if (score >= good) {
      return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFE0" } }; // Light yellow
    } else if (score >= alert) {
      return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFA500" } }; // Orange
    } else {
      return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF6B6B" } }; // Light red
    }
  }

  /**
   * Export analyses to Excel file
   * @param {Array} data - Array of analysis records with call data
   * @param {Object} options - Export options
   * @returns {Object} - Export result with file path
   */
  async exportAnalyses(data, options = {}) {
    const {
      filename = `call_analyses_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.xlsx`,
      includeCharts = true,
      includeSummary = true,
    } = options;

    const filePath = path.join(this.exportDir, filename);
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Sales Call QC System";
    workbook.created = new Date();

    // Add Summary sheet if requested
    if (includeSummary && data.length > 0) {
      this.addSummarySheet(workbook, data);
    }

    // Add main data sheet
    this.addDataSheet(workbook, data);

    // Add issues breakdown sheet
    this.addIssuesSheet(workbook, data);

    // Save workbook
    await workbook.xlsx.writeFile(filePath);

    const stats = {
      totalRecords: data.length,
      filePath,
      filename,
      fileSize: fs.statSync(filePath).size,
      exportedAt: new Date().toISOString(),
      sheets: workbook.worksheets.map((ws) => ws.name),
    };

    logger.info("Excel export completed", stats);
    return stats;
  }

  /**
   * Add summary sheet with statistics
   * @param {ExcelJS.Workbook} workbook - Workbook instance
   * @param {Array} data - Analysis data
   */
  addSummarySheet(workbook, data) {
    const sheet = workbook.addWorksheet("Summary", {
      properties: { tabColor: { argb: "FF4472C4" } },
    });

    // Calculate statistics
    const scores = data.map((d) => d.overall_score).filter((s) => s != null);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const { alert, good, excellent } = config.scoring.thresholds;

    const belowAlert = scores.filter((s) => s < alert).length;
    const goodCalls = scores.filter((s) => s >= good && s < excellent).length;
    const excellentCalls = scores.filter((s) => s >= excellent).length;

    // Title
    sheet.mergeCells("A1:D1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "Call Analysis Summary Report";
    titleCell.font = { bold: true, size: 16, color: { argb: "FF4472C4" } };
    titleCell.alignment = { horizontal: "center" };

    // Date range
    sheet.mergeCells("A2:D2");
    const dateCell = sheet.getCell("A2");
    dateCell.value = `Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`;
    dateCell.font = { italic: true, size: 10 };
    dateCell.alignment = { horizontal: "center" };

    // Statistics section
    const statsData = [
      ["", ""],
      ["OVERALL STATISTICS", ""],
      ["Total Calls Analyzed", data.length],
      ["Average Score", Math.round(avgScore * 10) / 10],
      ["Highest Score", maxScore],
      ["Lowest Score", minScore],
      ["", ""],
      ["PERFORMANCE BREAKDOWN", ""],
      [`Excellent (≥${excellent})`, excellentCalls],
      [`Good (${good}-${excellent - 1})`, goodCalls],
      [`Below Alert (<${alert})`, belowAlert],
    ];

    let rowNum = 4;
    for (const [label, value] of statsData) {
      if (label.includes("STATISTICS") || label.includes("BREAKDOWN")) {
        sheet.mergeCells(`A${rowNum}:B${rowNum}`);
        const cell = sheet.getCell(`A${rowNum}`);
        cell.value = label;
        cell.font = { bold: true, size: 12 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
      } else if (label) {
        sheet.getCell(`A${rowNum}`).value = label;
        const valueCell = sheet.getCell(`B${rowNum}`);
        valueCell.value = value;
        valueCell.alignment = { horizontal: "right" };

        // Color code performance rows
        if (label.includes("Excellent")) {
          valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF90EE90" } };
        } else if (label.includes("Below Alert")) {
          valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF6B6B" } };
        }
      }
      rowNum++;
    }

    // Sentiment breakdown
    const sentiments = {
      positive: data.filter((d) => d.sentiment === "positive").length,
      neutral: data.filter((d) => d.sentiment === "neutral").length,
      negative: data.filter((d) => d.sentiment === "negative").length,
    };

    rowNum++;
    sheet.mergeCells(`A${rowNum}:B${rowNum}`);
    sheet.getCell(`A${rowNum}`).value = "SENTIMENT ANALYSIS";
    sheet.getCell(`A${rowNum}`).font = { bold: true, size: 12 };
    sheet.getCell(`A${rowNum}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
    rowNum++;

    sheet.getCell(`A${rowNum}`).value = "Positive";
    sheet.getCell(`B${rowNum}`).value = sentiments.positive;
    rowNum++;
    sheet.getCell(`A${rowNum}`).value = "Neutral";
    sheet.getCell(`B${rowNum}`).value = sentiments.neutral;
    rowNum++;
    sheet.getCell(`A${rowNum}`).value = "Negative";
    sheet.getCell(`B${rowNum}`).value = sentiments.negative;

    // Set column widths
    sheet.getColumn("A").width = 25;
    sheet.getColumn("B").width = 15;
  }

  /**
   * Add main data sheet with call analyses
   * @param {ExcelJS.Workbook} workbook - Workbook instance
   * @param {Array} data - Analysis data
   */
  addDataSheet(workbook, data) {
    const sheet = workbook.addWorksheet("Call Analyses", {
      properties: { tabColor: { argb: "FF70AD47" } },
    });

    // Define columns
    sheet.columns = [
      { header: "Call ID", key: "call_id", width: 20 },
      { header: "Date", key: "date", width: 12 },
      { header: "Time", key: "time", width: 10 },
      { header: "Agent ID", key: "agent_id", width: 15 },
      { header: "Duration", key: "duration", width: 10 },
      { header: "Overall Score", key: "overall_score", width: 14 },
      { header: "Greeting", key: "greeting", width: 10 },
      { header: "Need Discovery", key: "need_discovery", width: 14 },
      { header: "Product Presentation", key: "product_presentation", width: 18 },
      { header: "Objection Handling", key: "objection_handling", width: 17 },
      { header: "Closing", key: "closing", width: 10 },
      { header: "Sentiment", key: "sentiment", width: 12 },
      { header: "Issues Count", key: "issues_count", width: 12 },
      { header: "Summary", key: "summary", width: 40 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;

    // Add data rows
    for (const record of data) {
      const createdAt = new Date(record.created_at);
      const categoryScores = record.category_scores || {};
      const issues = record.issues || [];

      const row = sheet.addRow({
        call_id: record.call_id,
        date: format(createdAt, "yyyy-MM-dd"),
        time: format(createdAt, "HH:mm:ss"),
        agent_id: record.agent_id || "N/A",
        duration: this.formatDuration(record.duration_seconds),
        overall_score: record.overall_score,
        greeting: categoryScores.greeting || 0,
        need_discovery: categoryScores.need_discovery || categoryScores.needDiscovery || 0,
        product_presentation: categoryScores.product_presentation || categoryScores.productPresentation || 0,
        objection_handling: categoryScores.objection_handling || categoryScores.objectionHandling || 0,
        closing: categoryScores.closing || 0,
        sentiment: record.sentiment || "N/A",
        issues_count: issues.length,
        summary: record.summary ? record.summary.substring(0, 200) : "",
      });

      // Color code the overall score cell
      const scoreCell = row.getCell("overall_score");
      scoreCell.fill = this.getScoreColor(record.overall_score);
      scoreCell.alignment = { horizontal: "center" };

      // Color code category score cells
      const scoreCells = ["greeting", "need_discovery", "product_presentation", "objection_handling", "closing"];
      for (const col of scoreCells) {
        const cell = row.getCell(col);
        const score = cell.value;
        if (score != null) {
          cell.fill = this.getScoreColor(score);
          cell.alignment = { horizontal: "center" };
        }
      }
    }

    // Add filters
    sheet.autoFilter = {
      from: "A1",
      to: `N${data.length + 1}`,
    };

    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  /**
   * Add issues breakdown sheet
   * @param {ExcelJS.Workbook} workbook - Workbook instance
   * @param {Array} data - Analysis data
   */
  addIssuesSheet(workbook, data) {
    const sheet = workbook.addWorksheet("Issues Breakdown", {
      properties: { tabColor: { argb: "FFED7D31" } },
    });

    // Aggregate issues by category
    const issuesByCategory = {};

    for (const record of data) {
      const issues = record.issues || [];
      for (const issue of issues) {
        const category = issue.category || "General";
        const severity = issue.severity || "medium";

        if (!issuesByCategory[category]) {
          issuesByCategory[category] = { total: 0, high: 0, medium: 0, low: 0, examples: [] };
        }

        issuesByCategory[category].total++;
        issuesByCategory[category][severity]++;

        if (issuesByCategory[category].examples.length < 3 && issue.description) {
          issuesByCategory[category].examples.push(issue.description);
        }
      }
    }

    // Define columns
    sheet.columns = [
      { header: "Category", key: "category", width: 25 },
      { header: "Total Issues", key: "total", width: 12 },
      { header: "High Severity", key: "high", width: 14 },
      { header: "Medium Severity", key: "medium", width: 16 },
      { header: "Low Severity", key: "low", width: 13 },
      { header: "Example Issues", key: "examples", width: 60 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFED7D31" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;

    // Add data rows sorted by total issues
    const sortedCategories = Object.entries(issuesByCategory)
      .sort(([, a], [, b]) => b.total - a.total);

    for (const [category, stats] of sortedCategories) {
      const row = sheet.addRow({
        category,
        total: stats.total,
        high: stats.high,
        medium: stats.medium,
        low: stats.low,
        examples: stats.examples.join("; "),
      });

      // Color code severity columns
      if (stats.high > 0) {
        row.getCell("high").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF6B6B" } };
      }
    }

    // Freeze header row
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  /**
   * Format duration in mm:ss format
   * @param {number} seconds - Duration in seconds
   * @returns {string} - Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Export daily report to Excel
   * @param {Object} reportData - Daily report data
   * @param {string} date - Date string
   * @returns {Object} - Export result
   */
  async exportDailyReport(reportData, date) {
    const filename = `daily_report_${date}.xlsx`;
    const filePath = path.join(this.exportDir, filename);
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Sales Call QC System";
    workbook.created = new Date();

    // Add summary sheet
    const summarySheet = workbook.addWorksheet("Daily Summary");

    // Title
    summarySheet.mergeCells("A1:C1");
    const titleCell = summarySheet.getCell("A1");
    titleCell.value = `Daily Report - ${date}`;
    titleCell.font = { bold: true, size: 16, color: { argb: "FF4472C4" } };
    titleCell.alignment = { horizontal: "center" };

    // Statistics
    const statsData = [
      ["", ""],
      ["Total Calls", reportData.totalCalls || 0],
      ["Average Score", reportData.avgScore || 0],
      ["Highest Score", reportData.maxScore || 0],
      ["Lowest Score", reportData.minScore || 0],
      ["Alerts Generated", reportData.alertCount || 0],
    ];

    let rowNum = 3;
    for (const [label, value] of statsData) {
      if (label) {
        summarySheet.getCell(`A${rowNum}`).value = label;
        summarySheet.getCell(`B${rowNum}`).value = value;
      }
      rowNum++;
    }

    summarySheet.getColumn("A").width = 20;
    summarySheet.getColumn("B").width = 15;

    // Add call details if present
    if (reportData.calls && reportData.calls.length > 0) {
      this.addDataSheet(workbook, reportData.calls);
    }

    await workbook.xlsx.writeFile(filePath);

    const stats = {
      filePath,
      filename,
      fileSize: fs.statSync(filePath).size,
      exportedAt: new Date().toISOString(),
    };

    logger.info("Daily Excel report exported", stats);
    return stats;
  }

  /**
   * Get list of available export files
   * @returns {Array} - List of export files
   */
  getExportFiles() {
    const files = fs.readdirSync(this.exportDir);
    return files
      .filter((f) => f.endsWith(".xlsx"))
      .map((f) => {
        const filePath = path.join(this.exportDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = ExcelExportService;
