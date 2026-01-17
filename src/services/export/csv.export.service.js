/**
 * CSV Export Service
 * Exports call analysis data to CSV format
 */

const { createObjectCsvWriter } = require("csv-writer");
const path = require("path");
const fs = require("fs");
const { format } = require("date-fns");
const logger = require("../../utils/logger");
const config = require("../../config");

class CsvExportService {
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
      logger.info("Created export directory", { path: this.exportDir });
    }
  }

  /**
   * Export analyses to CSV file
   * @param {Array} data - Array of analysis records with call data
   * @param {Object} options - Export options
   * @returns {Object} - Export result with file path
   */
  async exportAnalyses(data, options = {}) {
    const {
      filename = `call_analyses_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.csv`,
      includeRecommendations = false,
    } = options;

    const filePath = path.join(this.exportDir, filename);

    // Define CSV headers
    const headers = [
      { id: "call_id", title: "Call ID" },
      { id: "date", title: "Date" },
      { id: "time", title: "Time" },
      { id: "agent_id", title: "Agent ID" },
      { id: "duration", title: "Duration (mm:ss)" },
      { id: "overall_score", title: "Overall Score" },
      { id: "greeting", title: "Greeting Score" },
      { id: "need_discovery", title: "Need Discovery Score" },
      { id: "product_presentation", title: "Product Presentation Score" },
      { id: "objection_handling", title: "Objection Handling Score" },
      { id: "closing", title: "Closing Score" },
      { id: "sentiment", title: "Sentiment" },
      { id: "issues_count", title: "Issues Count" },
      { id: "top_issues", title: "Top Issues" },
    ];

    if (includeRecommendations) {
      headers.push({ id: "recommendations", title: "Recommendations" });
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers,
    });

    // Transform data for CSV
    const records = data.map((item) => this.transformRecordForCsv(item, includeRecommendations));

    await csvWriter.writeRecords(records);

    const stats = {
      totalRecords: records.length,
      filePath,
      filename,
      fileSize: fs.statSync(filePath).size,
      exportedAt: new Date().toISOString(),
    };

    logger.info("CSV export completed", stats);
    return stats;
  }

  /**
   * Transform analysis record for CSV export
   * @param {Object} record - Analysis record with call data
   * @param {boolean} includeRecommendations - Include recommendations
   * @returns {Object} - Transformed record
   */
  transformRecordForCsv(record, includeRecommendations = false) {
    const createdAt = new Date(record.created_at);
    const categoryScores = record.category_scores || {};
    const issues = record.issues || [];
    const recommendations = record.recommendations || [];

    const transformed = {
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
      top_issues: this.formatTopIssues(issues, 3),
    };

    if (includeRecommendations) {
      transformed.recommendations = this.formatRecommendations(recommendations, 3);
    }

    return transformed;
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
   * Format top issues for CSV
   * @param {Array} issues - Array of issues
   * @param {number} limit - Max issues to include
   * @returns {string} - Formatted issues string
   */
  formatTopIssues(issues, limit = 3) {
    if (!issues || issues.length === 0) return "None";

    return issues
      .slice(0, limit)
      .map((issue) => {
        const category = issue.category || "General";
        const description = issue.description || issue;
        return `[${category}] ${description}`;
      })
      .join("; ");
  }

  /**
   * Format recommendations for CSV
   * @param {Array} recommendations - Array of recommendations
   * @param {number} limit - Max recommendations to include
   * @returns {string} - Formatted recommendations string
   */
  formatRecommendations(recommendations, limit = 3) {
    if (!recommendations || recommendations.length === 0) return "None";

    return recommendations
      .slice(0, limit)
      .map((rec) => {
        const action = rec.action || rec;
        return action;
      })
      .join("; ");
  }

  /**
   * Export daily summary to CSV
   * @param {Object} summary - Daily summary data
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Object} - Export result
   */
  async exportDailySummary(summary, date) {
    const filename = `daily_summary_${date}.csv`;
    const filePath = path.join(this.exportDir, filename);

    const headers = [
      { id: "metric", title: "Metric" },
      { id: "value", title: "Value" },
    ];

    const records = [
      { metric: "Date", value: date },
      { metric: "Total Calls Analyzed", value: summary.totalCalls || 0 },
      { metric: "Average Score", value: summary.avgScore || 0 },
      { metric: "Highest Score", value: summary.maxScore || 0 },
      { metric: "Lowest Score", value: summary.minScore || 0 },
      { metric: "Calls Below Threshold", value: summary.lowScoreCalls || 0 },
      { metric: "Positive Sentiment", value: summary.positiveSentiment || 0 },
      { metric: "Negative Sentiment", value: summary.negativeSentiment || 0 },
    ];

    // Add top issues if present
    if (summary.topIssues && summary.topIssues.length > 0) {
      summary.topIssues.forEach((issue, idx) => {
        records.push({
          metric: `Top Issue #${idx + 1}`,
          value: `${issue.category}: ${issue.count} occurrences`,
        });
      });
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers,
    });

    await csvWriter.writeRecords(records);

    const stats = {
      filePath,
      filename,
      exportedAt: new Date().toISOString(),
    };

    logger.info("Daily summary CSV exported", stats);
    return stats;
  }

  /**
   * Stream large exports (for 1000+ rows)
   * @param {Function} dataGenerator - Generator function yielding records
   * @param {Object} options - Export options
   * @returns {Object} - Export result
   */
  async streamExport(dataGenerator, options = {}) {
    const {
      filename = `bulk_export_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.csv`,
      batchSize = 100,
    } = options;

    const filePath = path.join(this.exportDir, filename);

    const headers = [
      { id: "call_id", title: "Call ID" },
      { id: "date", title: "Date" },
      { id: "time", title: "Time" },
      { id: "agent_id", title: "Agent ID" },
      { id: "duration", title: "Duration (mm:ss)" },
      { id: "overall_score", title: "Overall Score" },
      { id: "greeting", title: "Greeting Score" },
      { id: "need_discovery", title: "Need Discovery Score" },
      { id: "product_presentation", title: "Product Presentation Score" },
      { id: "objection_handling", title: "Objection Handling Score" },
      { id: "closing", title: "Closing Score" },
      { id: "sentiment", title: "Sentiment" },
      { id: "issues_count", title: "Issues Count" },
      { id: "top_issues", title: "Top Issues" },
    ];

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers,
    });

    let totalRecords = 0;
    let batch = [];

    for await (const record of dataGenerator()) {
      batch.push(this.transformRecordForCsv(record));

      if (batch.length >= batchSize) {
        await csvWriter.writeRecords(batch);
        totalRecords += batch.length;
        batch = [];
        logger.debug(`Streamed ${totalRecords} records to CSV`);
      }
    }

    // Write remaining records
    if (batch.length > 0) {
      await csvWriter.writeRecords(batch);
      totalRecords += batch.length;
    }

    const stats = {
      totalRecords,
      filePath,
      filename,
      fileSize: fs.statSync(filePath).size,
      exportedAt: new Date().toISOString(),
    };

    logger.info("Bulk CSV export completed", stats);
    return stats;
  }

  /**
   * Get list of available export files
   * @returns {Array} - List of export files
   */
  getExportFiles() {
    const files = fs.readdirSync(this.exportDir);
    return files
      .filter((f) => f.endsWith(".csv"))
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

  /**
   * Delete an export file
   * @param {string} filename - File to delete
   * @returns {boolean} - Success status
   */
  deleteExportFile(filename) {
    const filePath = path.join(this.exportDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info("Export file deleted", { filename });
      return true;
    }
    return false;
  }
}

module.exports = CsvExportService;
