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

    if (!this.botToken) {
      logger.warn("Telegram bot token not configured - messages will not be sent");
    } else {
      logger.info("Telegram service initialized", {
        chatId: this.defaultChatId,
        hasToken: !!this.botToken
      });
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
    const lines = [
      "🚨 LOW SCORE ALERT",
      "─────────────────────────",
      "",
      `👤 Agent: ${call.agent_id || "Unknown"}`,
      `📞 Call: ${analysis.call_id}`,
      `⏱️ Duration: ${this.formatDuration(call.duration_seconds)}`,
      `📊 Score: ${this.formatScore(analysis.overall_score)}`,
      `😐 Sentiment: ${analysis.sentiment || 'neutral'}`,
      "",
    ];

    // Add category scores breakdown
    const categoryScores = typeof analysis.category_scores === 'string'
      ? JSON.parse(analysis.category_scores)
      : (analysis.category_scores || {});

    if (Object.keys(categoryScores).length > 0) {
      lines.push("📋 Category Breakdown:");
      const categories = [
        { key: "greeting_rapport", label: "Greeting" },
        { key: "greeting", label: "Greeting" },
        { key: "requirement_discovery", label: "Requirements" },
        { key: "need_discovery", label: "Needs" },
        { key: "needDiscovery", label: "Needs" },
        { key: "product_knowledge", label: "Product" },
        { key: "product_presentation", label: "Presentation" },
        { key: "productPresentation", label: "Presentation" },
        { key: "objection_handling", label: "Objections" },
        { key: "objectionHandling", label: "Objections" },
        { key: "closing_next_steps", label: "Closing" },
        { key: "closing", label: "Closing" },
      ];

      const addedCategories = new Set();
      for (const { key, label} of categories) {
        if (categoryScores[key] != null && !addedCategories.has(label)) {
          // Extract score value - handle both number and object {score: number}
          const scoreValue = typeof categoryScores[key] === 'object'
            ? categoryScores[key].score
            : categoryScores[key];

          // Add emoji indicator
          let emoji = '🔴';
          if (scoreValue >= 85) emoji = '🟢';
          else if (scoreValue >= 70) emoji = '🟡';
          else if (scoreValue >= 50) emoji = '🟠';

          lines.push(`  ${emoji} ${label}: ${scoreValue}`);
          addedCategories.add(label);
        }
      }
      lines.push("");
    }

    // Parse and format issues properly
    const issues = analysis.issues || [];
    if (issues.length > 0) {
      lines.push("⚠️ Key Issues:");
      const topIssues = issues.slice(0, 3);

      for (const issue of topIssues) {
        // Extract detail from nested structure
        let detail = '';
        if (typeof issue === 'object') {
          detail = issue.detail || issue.description || '';

          // Add severity indicator
          const severity = (issue.severity || '').toLowerCase();
          const severityEmoji = severity === 'high' || severity === 'critical' ? '🔴' :
                               severity === 'medium' ? '🟠' : '🟡';

          if (detail) {
            // Truncate if too long
            const truncated = detail.length > 100 ? detail.substring(0, 100) + '...' : detail;
            lines.push(`  ${severityEmoji} ${truncated}`);
          }
        }
      }
      lines.push("");
    }

    // Summary
    if (analysis.summary) {
      lines.push("📝 Summary:");
      const summary = analysis.summary.length > 250
        ? analysis.summary.substring(0, 250) + "..."
        : analysis.summary;
      lines.push(summary);
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
      parseMode = null, // Disable Markdown by default to avoid parsing errors
      disableNotification = false,
    } = options;

    if (!this.botToken) {
      logger.warn("Telegram message not sent - bot token not configured", {
        chatId,
        messagePreview: message.substring(0, 100)
      });
      return {
        success: false,
        error: "Bot token not configured",
        chatId,
      };
    }

    if (!chatId) {
      logger.error("Telegram message not sent - chat ID is required");
      return {
        success: false,
        error: "Chat ID is required",
      };
    }

    try {
      const payload = {
        chat_id: chatId,
        text: message,
        disable_notification: disableNotification,
      };

      // Only include parse_mode if specified
      if (parseMode) {
        payload.parse_mode = parseMode;
      }

      const response = await axios.post(`${this.baseUrl}/sendMessage`, payload);

      const result = {
        success: true,
        messageId: response.data.result?.message_id,
        chatId,
        sentAt: new Date().toISOString(),
      };

      logger.info("Telegram message sent successfully", result);
      return result;
    } catch (error) {
      logger.error("Failed to send Telegram message", {
        error: error.message,
        response: error.response?.data,
        chatId,
      });
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
        chatId,
      };
    }
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
    if (!this.botToken) {
      return {
        success: false,
        error: "Bot token not configured",
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
    if (!this.botToken) {
      return {
        success: false,
        error: "Bot token not configured",
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
        details: error.response?.data,
      };
    }
  }
}

module.exports = TelegramService;
