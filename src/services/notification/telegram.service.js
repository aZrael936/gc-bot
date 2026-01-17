/**
 * Telegram Notification Service
 * Sends notifications via Telegram Bot API
 *
 * Supports both mock mode (for development) and real Telegram API
 */

const axios = require("axios");
const logger = require("../../utils/logger");
const config = require("../../config");

class TelegramService {
  constructor() {
    this.botToken = config.telegram?.botToken;
    this.defaultChatId = config.telegram?.defaultChatId;
    this.baseUrl = this.botToken
      ? `https://api.telegram.org/bot${this.botToken}`
      : null;
    this.mockMode = !this.botToken || config.nodeEnv === "development";

    if (this.mockMode) {
      logger.info("Telegram service running in MOCK mode");
    } else {
      logger.info("Telegram service configured with bot token");
    }
  }

  /**
   * Format score with emoji indicator
   * @param {number} score - Score value
   * @returns {string} - Formatted score with emoji
   */
  formatScore(score) {
    const { alert, good, excellent } = config.scoring.thresholds;

    if (score >= excellent) {
      return `${score}/100 🟢`;
    } else if (score >= good) {
      return `${score}/100 🟡`;
    } else if (score >= alert) {
      return `${score}/100 🟠`;
    } else {
      return `${score}/100 🔴`;
    }
  }

  /**
   * Build alert message for low-scoring call
   * @param {Object} analysis - Analysis record
   * @param {Object} call - Call record
   * @returns {string} - Formatted message
   */
  buildAlertMessage(analysis, call = {}) {
    const issues = analysis.issues || [];
    const topIssues = issues.slice(0, 3).map((issue) => {
      const category = issue.category || "General";
      const description = issue.description || issue;
      return `• ${category}: ${description}`;
    });

    const lines = [
      "🚨 *Low Score Alert*",
      "────────────────────",
      "",
      `👤 *Agent:* ${call.agent_id || "Unknown"}`,
      `📞 *Call ID:* \`${analysis.call_id}\``,
      `⏱ *Duration:* ${this.formatDuration(call.duration_seconds)}`,
      `📊 *Score:* ${this.formatScore(analysis.overall_score)}`,
      "",
    ];

    if (topIssues.length > 0) {
      lines.push("*Issues:*");
      lines.push(...topIssues);
      lines.push("");
    }

    if (analysis.summary) {
      const shortSummary = analysis.summary.length > 100
        ? analysis.summary.substring(0, 100) + "..."
        : analysis.summary;
      lines.push(`📝 *Summary:* ${shortSummary}`);
      lines.push("");
    }

    // Add category scores breakdown
    const categoryScores = analysis.category_scores || {};
    if (Object.keys(categoryScores).length > 0) {
      lines.push("*Category Scores:*");
      const categories = [
        { key: "greeting", label: "Greeting" },
        { key: "need_discovery", label: "Need Discovery" },
        { key: "needDiscovery", label: "Need Discovery" },
        { key: "product_presentation", label: "Product Pres." },
        { key: "productPresentation", label: "Product Pres." },
        { key: "objection_handling", label: "Objection Hand." },
        { key: "objectionHandling", label: "Objection Hand." },
        { key: "closing", label: "Closing" },
      ];

      const addedCategories = new Set();
      for (const { key, label } of categories) {
        if (categoryScores[key] != null && !addedCategories.has(label)) {
          lines.push(`• ${label}: ${categoryScores[key]}`);
          addedCategories.add(label);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Build daily digest message
   * @param {Object} digest - Daily digest data
   * @returns {string} - Formatted message
   */
  buildDigestMessage(digest) {
    const lines = [
      "📊 *Daily Digest Report*",
      "────────────────────",
      "",
      `📅 *Date:* ${digest.date}`,
      "",
      "*Statistics:*",
      `• Total Calls: ${digest.totalCalls}`,
      `• Average Score: ${Math.round(digest.avgScore * 10) / 10}`,
      `• Highest Score: ${digest.maxScore}`,
      `• Lowest Score: ${digest.minScore}`,
      "",
      "*Performance:*",
      `• 🟢 Excellent: ${digest.excellentCalls || 0}`,
      `• 🟡 Good: ${digest.goodCalls || 0}`,
      `• 🔴 Below Threshold: ${digest.lowScoreCalls || 0}`,
      "",
    ];

    if (digest.topIssues && digest.topIssues.length > 0) {
      lines.push("*Top Issues:*");
      for (const issue of digest.topIssues.slice(0, 5)) {
        lines.push(`• ${issue.category}: ${issue.count} occurrences`);
      }
      lines.push("");
    }

    if (digest.alertsCount > 0) {
      lines.push(`⚠️ *Alerts Generated:* ${digest.alertsCount}`);
    }

    return lines.join("\n");
  }

  /**
   * Build critical issue alert message
   * @param {Object} analysis - Analysis record
   * @param {Object} issue - Critical issue
   * @param {Object} call - Call record
   * @returns {string} - Formatted message
   */
  buildCriticalIssueMessage(analysis, issue, call = {}) {
    const lines = [
      "⚠️ *Critical Issue Detected*",
      "────────────────────",
      "",
      `👤 *Agent:* ${call.agent_id || "Unknown"}`,
      `📞 *Call ID:* \`${analysis.call_id}\``,
      `📊 *Overall Score:* ${this.formatScore(analysis.overall_score)}`,
      "",
      `🔴 *Category:* ${issue.category}`,
      `📝 *Issue:* ${issue.description}`,
      `⚡ *Severity:* ${issue.severity?.toUpperCase() || "HIGH"}`,
      "",
    ];

    if (issue.examples && issue.examples.length > 0) {
      lines.push("*Examples:*");
      for (const example of issue.examples.slice(0, 2)) {
        lines.push(`• "${example}"`);
      }
    }

    return lines.join("\n");
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

  /**
   * Send message via Telegram
   * @param {string} message - Message text
   * @param {Object} options - Send options
   * @returns {Object} - Send result
   */
  async sendMessage(message, options = {}) {
    const {
      chatId = this.defaultChatId,
      parseMode = "Markdown",
      disableNotification = false,
    } = options;

    if (this.mockMode) {
      return this.mockSend(message, { chatId, parseMode });
    }

    if (!chatId) {
      throw new Error("Telegram chat ID is required");
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_notification: disableNotification,
      });

      const result = {
        success: true,
        messageId: response.data.result?.message_id,
        chatId,
        sentAt: new Date().toISOString(),
      };

      logger.info("Telegram message sent", result);
      return result;
    } catch (error) {
      logger.error("Failed to send Telegram message", {
        error: error.message,
        chatId,
      });
      throw error;
    }
  }

  /**
   * Mock send for development
   * @param {string} message - Message text
   * @param {Object} options - Options
   * @returns {Object} - Mock result
   */
  mockSend(message, options = {}) {
    const mockResult = {
      success: true,
      mock: true,
      messageId: `mock_${Date.now()}`,
      chatId: options.chatId || "mock_chat",
      sentAt: new Date().toISOString(),
    };

    // Log the message to console for development visibility
    console.log("\n" + "═".repeat(60));
    console.log("📱 TELEGRAM NOTIFICATION (MOCK MODE)");
    console.log("═".repeat(60));
    console.log(`Chat ID: ${options.chatId || "default"}`);
    console.log("─".repeat(60));
    // Convert markdown to console-friendly format
    const consoleMessage = message
      .replace(/\*/g, "")
      .replace(/`/g, "");
    console.log(consoleMessage);
    console.log("═".repeat(60) + "\n");

    logger.info("Telegram message sent (mock)", mockResult);
    return mockResult;
  }

  /**
   * Send low score alert
   * @param {Object} analysis - Analysis record
   * @param {Object} call - Call record
   * @param {Object} options - Send options
   * @returns {Object} - Send result
   */
  async sendLowScoreAlert(analysis, call = {}, options = {}) {
    const message = this.buildAlertMessage(analysis, call);
    return this.sendMessage(message, options);
  }

  /**
   * Send daily digest
   * @param {Object} digest - Digest data
   * @param {Object} options - Send options
   * @returns {Object} - Send result
   */
  async sendDailyDigest(digest, options = {}) {
    const message = this.buildDigestMessage(digest);
    return this.sendMessage(message, options);
  }

  /**
   * Send critical issue alert
   * @param {Object} analysis - Analysis record
   * @param {Object} issue - Critical issue
   * @param {Object} call - Call record
   * @param {Object} options - Send options
   * @returns {Object} - Send result
   */
  async sendCriticalIssueAlert(analysis, issue, call = {}, options = {}) {
    const message = this.buildCriticalIssueMessage(analysis, issue, call);
    return this.sendMessage(message, options);
  }

  /**
   * Test the Telegram connection
   * @returns {Object} - Test result
   */
  async testConnection() {
    if (this.mockMode) {
      return {
        success: true,
        mock: true,
        message: "Telegram service is in mock mode",
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      return {
        success: true,
        botInfo: response.data.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get chat info (for setup verification)
   * @param {string} chatId - Chat ID to check
   * @returns {Object} - Chat info
   */
  async getChatInfo(chatId) {
    if (this.mockMode) {
      return {
        success: true,
        mock: true,
        chatId,
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/getChat`, {
        params: { chat_id: chatId },
      });
      return {
        success: true,
        chat: response.data.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = TelegramService;
