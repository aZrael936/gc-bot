/**
 * Console Notification Service
 * Outputs notifications to console for development/debugging
 */

const logger = require("../../utils/logger");
const config = require("../../config");

class ConsoleNotificationService {
  constructor() {
    this.enabled = config.nodeEnv === "development" || config.nodeEnv === "test";
  }

  /**
   * Format score with visual indicator
   * @param {number} score - Score value
   * @returns {string} - Formatted score
   */
  formatScore(score) {
    const { alert, good, excellent } = config.scoring.thresholds;

    let indicator;
    if (score >= excellent) {
      indicator = "EXCELLENT";
    } else if (score >= good) {
      indicator = "GOOD";
    } else if (score >= alert) {
      indicator = "WARNING";
    } else {
      indicator = "ALERT";
    }

    return `${score}/100 [${indicator}]`;
  }

  /**
   * Print a box around text
   * @param {string} title - Box title
   * @param {Array} lines - Content lines
   */
  printBox(title, lines) {
    const width = 70;
    const border = "═".repeat(width);
    const thinBorder = "─".repeat(width);

    console.log("");
    console.log(`╔${border}╗`);
    console.log(`║ ${title.padEnd(width - 1)}║`);
    console.log(`╠${border}╣`);

    for (const line of lines) {
      const truncated = line.length > width - 2 ? line.substring(0, width - 5) + "..." : line;
      console.log(`║ ${truncated.padEnd(width - 1)}║`);
    }

    console.log(`╚${border}╝`);
    console.log("");
  }

  /**
   * Send low score alert to console
   * @param {Object} analysis - Analysis record
   * @param {Object} call - Call record
   * @returns {Object} - Result
   */
  sendLowScoreAlert(analysis, call = {}) {
    const issues = analysis.issues || [];
    const categoryScores = analysis.category_scores || {};

    const lines = [
      "",
      `Agent:     ${call.agent_id || "Unknown"}`,
      `Call ID:   ${analysis.call_id}`,
      `Duration:  ${this.formatDuration(call.duration_seconds)}`,
      `Score:     ${this.formatScore(analysis.overall_score)}`,
      `Sentiment: ${analysis.sentiment || "N/A"}`,
      "",
      "Category Scores:",
    ];

    // Add category scores
    const categories = {
      greeting: "Greeting",
      need_discovery: "Need Discovery",
      needDiscovery: "Need Discovery",
      product_presentation: "Product Presentation",
      productPresentation: "Product Presentation",
      objection_handling: "Objection Handling",
      objectionHandling: "Objection Handling",
      closing: "Closing",
    };

    const addedCategories = new Set();
    for (const [key, label] of Object.entries(categories)) {
      if (categoryScores[key] != null && !addedCategories.has(label)) {
        lines.push(`  - ${label}: ${categoryScores[key]}`);
        addedCategories.add(label);
      }
    }

    if (issues.length > 0) {
      lines.push("");
      lines.push("Issues:");
      for (const issue of issues.slice(0, 5)) {
        const category = issue.category || "General";
        const description = issue.description || issue;
        const severity = issue.severity ? `[${issue.severity.toUpperCase()}]` : "";
        lines.push(`  - ${category} ${severity}: ${description}`);
      }
    }

    if (analysis.summary) {
      lines.push("");
      lines.push("Summary:");
      // Word wrap summary
      const words = analysis.summary.split(" ");
      let currentLine = "  ";
      for (const word of words) {
        if (currentLine.length + word.length > 65) {
          lines.push(currentLine);
          currentLine = "  " + word + " ";
        } else {
          currentLine += word + " ";
        }
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
    }

    this.printBox("LOW SCORE ALERT", lines);

    const result = {
      success: true,
      channel: "console",
      type: "low_score_alert",
      callId: analysis.call_id,
      sentAt: new Date().toISOString(),
    };

    logger.info("Console notification sent", result);
    return result;
  }

  /**
   * Send daily digest to console
   * @param {Object} digest - Digest data
   * @returns {Object} - Result
   */
  sendDailyDigest(digest) {
    const lines = [
      "",
      `Date: ${digest.date}`,
      "",
      "Statistics:",
      `  - Total Calls:    ${digest.totalCalls}`,
      `  - Average Score:  ${Math.round(digest.avgScore * 10) / 10}`,
      `  - Highest Score:  ${digest.maxScore}`,
      `  - Lowest Score:   ${digest.minScore}`,
      "",
      "Performance Breakdown:",
      `  - Excellent:      ${digest.excellentCalls || 0}`,
      `  - Good:           ${digest.goodCalls || 0}`,
      `  - Below Alert:    ${digest.lowScoreCalls || 0}`,
      "",
      "Sentiment Analysis:",
      `  - Positive:       ${digest.positiveSentiment || 0}`,
      `  - Neutral:        ${digest.neutralSentiment || 0}`,
      `  - Negative:       ${digest.negativeSentiment || 0}`,
    ];

    if (digest.topIssues && digest.topIssues.length > 0) {
      lines.push("");
      lines.push("Top Issues:");
      for (const issue of digest.topIssues.slice(0, 5)) {
        lines.push(`  - ${issue.category}: ${issue.count} occurrences`);
      }
    }

    if (digest.alertsCount > 0) {
      lines.push("");
      lines.push(`Alerts Generated: ${digest.alertsCount}`);
    }

    this.printBox("DAILY DIGEST REPORT", lines);

    const result = {
      success: true,
      channel: "console",
      type: "daily_digest",
      date: digest.date,
      sentAt: new Date().toISOString(),
    };

    logger.info("Console digest sent", result);
    return result;
  }

  /**
   * Send critical issue alert to console
   * @param {Object} analysis - Analysis record
   * @param {Object} issue - Critical issue
   * @param {Object} call - Call record
   * @returns {Object} - Result
   */
  sendCriticalIssueAlert(analysis, issue, call = {}) {
    const lines = [
      "",
      `Agent:    ${call.agent_id || "Unknown"}`,
      `Call ID:  ${analysis.call_id}`,
      `Score:    ${this.formatScore(analysis.overall_score)}`,
      "",
      `Category: ${issue.category}`,
      `Severity: ${issue.severity?.toUpperCase() || "HIGH"}`,
      "",
      "Description:",
      `  ${issue.description}`,
    ];

    if (issue.examples && issue.examples.length > 0) {
      lines.push("");
      lines.push("Examples:");
      for (const example of issue.examples.slice(0, 3)) {
        lines.push(`  - "${example}"`);
      }
    }

    this.printBox("CRITICAL ISSUE DETECTED", lines);

    const result = {
      success: true,
      channel: "console",
      type: "critical_issue",
      callId: analysis.call_id,
      category: issue.category,
      sentAt: new Date().toISOString(),
    };

    logger.info("Console critical issue alert sent", result);
    return result;
  }

  /**
   * Send generic notification to console
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @returns {Object} - Result
   */
  sendNotification(title, message) {
    const lines = message.split("\n");
    this.printBox(title, lines);

    return {
      success: true,
      channel: "console",
      type: "generic",
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Format duration in mm:ss format
   * @param {number} seconds - Duration in seconds
   * @returns {string} - Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

module.exports = ConsoleNotificationService;
