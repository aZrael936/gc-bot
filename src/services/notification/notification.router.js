/**
 * Notification Router
 * Routes notifications to appropriate channels based on analysis results and configuration
 */

const TelegramService = require("./telegram.service");
const ConsoleNotificationService = require("./console.service");
const logger = require("../../utils/logger");
const config = require("../../config");

class NotificationRouter {
  constructor() {
    this.telegram = new TelegramService();
    this.console = new ConsoleNotificationService();

    // Get thresholds from config
    this.thresholds = config.scoring.thresholds;

    // Default notification settings
    this.settings = {
      enableTelegram: !!config.telegram?.botToken || config.nodeEnv === "development",
      enableConsole: config.nodeEnv === "development",
      alertOnLowScore: true,
      alertOnCriticalIssue: true,
      lowScoreThreshold: this.thresholds.alert,
      criticalSeverities: ["high", "critical"],
    };

    logger.info("Notification router initialized", {
      telegram: this.settings.enableTelegram,
      console: this.settings.enableConsole,
      lowScoreThreshold: this.settings.lowScoreThreshold,
    });
  }

  /**
   * Update notification settings
   * @param {Object} newSettings - Settings to update
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    logger.info("Notification settings updated", this.settings);
  }

  /**
   * Process analysis result and route notifications
   * @param {Object} analysis - Analysis record
   * @param {Object} call - Call record
   * @param {Object} options - Routing options
   * @returns {Object} - Routing result with sent notifications
   */
  async processAnalysis(analysis, call = {}, options = {}) {
    const results = {
      callId: analysis.call_id,
      overallScore: analysis.overall_score,
      notificationsSent: [],
      errors: [],
    };

    try {
      // Check for low score alert
      if (this.shouldAlertLowScore(analysis)) {
        const alertResults = await this.sendLowScoreAlert(analysis, call, options);
        results.notificationsSent.push(...alertResults);
      }

      // Check for critical issues
      const criticalIssues = this.findCriticalIssues(analysis);
      if (criticalIssues.length > 0 && this.settings.alertOnCriticalIssue) {
        for (const issue of criticalIssues) {
          const issueResults = await this.sendCriticalIssueAlert(analysis, issue, call, options);
          results.notificationsSent.push(...issueResults);
        }
      }

      logger.info("Analysis processed for notifications", {
        callId: analysis.call_id,
        notificationCount: results.notificationsSent.length,
      });
    } catch (error) {
      logger.error("Error processing analysis for notifications", {
        callId: analysis.call_id,
        error: error.message,
      });
      results.errors.push(error.message);
    }

    return results;
  }

  /**
   * Check if analysis should trigger low score alert
   * @param {Object} analysis - Analysis record
   * @returns {boolean}
   */
  shouldAlertLowScore(analysis) {
    if (!this.settings.alertOnLowScore) return false;
    return analysis.overall_score < this.settings.lowScoreThreshold;
  }

  /**
   * Find critical issues in analysis
   * @param {Object} analysis - Analysis record
   * @returns {Array} - Critical issues
   */
  findCriticalIssues(analysis) {
    const issues = analysis.issues || [];
    return issues.filter((issue) =>
      this.settings.criticalSeverities.includes(issue.severity?.toLowerCase())
    );
  }

  /**
   * Send low score alert through all enabled channels
   * @param {Object} analysis - Analysis record
   * @param {Object} call - Call record
   * @param {Object} options - Send options
   * @returns {Array} - Results from each channel
   */
  async sendLowScoreAlert(analysis, call = {}, options = {}) {
    const results = [];

    // Console notification (development)
    if (this.settings.enableConsole) {
      try {
        const consoleResult = this.console.sendLowScoreAlert(analysis, call);
        results.push({
          channel: "console",
          type: "low_score_alert",
          success: consoleResult.success,
        });
      } catch (error) {
        results.push({
          channel: "console",
          type: "low_score_alert",
          success: false,
          error: error.message,
        });
      }
    }

    // Telegram notification
    if (this.settings.enableTelegram) {
      try {
        const telegramResult = await this.telegram.sendLowScoreAlert(
          analysis,
          call,
          options.telegram || {}
        );
        results.push({
          channel: "telegram",
          type: "low_score_alert",
          success: telegramResult.success,
          messageId: telegramResult.messageId,
          mock: telegramResult.mock,
        });
      } catch (error) {
        results.push({
          channel: "telegram",
          type: "low_score_alert",
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Send critical issue alert through all enabled channels
   * @param {Object} analysis - Analysis record
   * @param {Object} issue - Critical issue
   * @param {Object} call - Call record
   * @param {Object} options - Send options
   * @returns {Array} - Results from each channel
   */
  async sendCriticalIssueAlert(analysis, issue, call = {}, options = {}) {
    const results = [];

    // Console notification
    if (this.settings.enableConsole) {
      try {
        const consoleResult = this.console.sendCriticalIssueAlert(analysis, issue, call);
        results.push({
          channel: "console",
          type: "critical_issue",
          category: issue.category,
          success: consoleResult.success,
        });
      } catch (error) {
        results.push({
          channel: "console",
          type: "critical_issue",
          success: false,
          error: error.message,
        });
      }
    }

    // Telegram notification
    if (this.settings.enableTelegram) {
      try {
        const telegramResult = await this.telegram.sendCriticalIssueAlert(
          analysis,
          issue,
          call,
          options.telegram || {}
        );
        results.push({
          channel: "telegram",
          type: "critical_issue",
          category: issue.category,
          success: telegramResult.success,
          messageId: telegramResult.messageId,
          mock: telegramResult.mock,
        });
      } catch (error) {
        results.push({
          channel: "telegram",
          type: "critical_issue",
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Send daily digest through all enabled channels
   * @param {Object} digest - Digest data
   * @param {Object} options - Send options
   * @returns {Array} - Results from each channel
   */
  async sendDailyDigest(digest, options = {}) {
    const results = [];

    // Console notification
    if (this.settings.enableConsole) {
      try {
        const consoleResult = this.console.sendDailyDigest(digest);
        results.push({
          channel: "console",
          type: "daily_digest",
          success: consoleResult.success,
        });
      } catch (error) {
        results.push({
          channel: "console",
          type: "daily_digest",
          success: false,
          error: error.message,
        });
      }
    }

    // Telegram notification
    if (this.settings.enableTelegram) {
      try {
        const telegramResult = await this.telegram.sendDailyDigest(
          digest,
          options.telegram || {}
        );
        results.push({
          channel: "telegram",
          type: "daily_digest",
          success: telegramResult.success,
          messageId: telegramResult.messageId,
          mock: telegramResult.mock,
        });
      } catch (error) {
        results.push({
          channel: "telegram",
          type: "daily_digest",
          success: false,
          error: error.message,
        });
      }
    }

    logger.info("Daily digest sent", {
      date: digest.date,
      channels: results.map((r) => r.channel),
    });

    return results;
  }

  /**
   * Send custom notification through specified channels
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} options - Send options
   * @returns {Array} - Results from each channel
   */
  async sendCustomNotification(title, message, options = {}) {
    const results = [];
    const channels = options.channels || ["console", "telegram"];

    if (channels.includes("console") && this.settings.enableConsole) {
      try {
        const consoleResult = this.console.sendNotification(title, message);
        results.push({
          channel: "console",
          type: "custom",
          success: consoleResult.success,
        });
      } catch (error) {
        results.push({
          channel: "console",
          type: "custom",
          success: false,
          error: error.message,
        });
      }
    }

    if (channels.includes("telegram") && this.settings.enableTelegram) {
      try {
        const formattedMessage = `*${title}*\n${"─".repeat(20)}\n\n${message}`;
        const telegramResult = await this.telegram.sendMessage(
          formattedMessage,
          options.telegram || {}
        );
        results.push({
          channel: "telegram",
          type: "custom",
          success: telegramResult.success,
          messageId: telegramResult.messageId,
          mock: telegramResult.mock,
        });
      } catch (error) {
        results.push({
          channel: "telegram",
          type: "custom",
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Test all notification channels
   * @returns {Object} - Test results for each channel
   */
  async testChannels() {
    const results = {
      console: { enabled: this.settings.enableConsole },
      telegram: { enabled: this.settings.enableTelegram },
    };

    if (this.settings.enableConsole) {
      results.console.status = "ok";
      results.console.message = "Console notifications are working";
    }

    if (this.settings.enableTelegram) {
      const telegramTest = await this.telegram.testConnection();
      results.telegram = {
        ...results.telegram,
        ...telegramTest,
      };
    }

    return results;
  }

  /**
   * Get current notification settings
   * @returns {Object} - Current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get notification channel status
   * @returns {Object} - Channel status
   */
  getChannelStatus() {
    return {
      telegram: {
        enabled: this.settings.enableTelegram,
        configured: !!config.telegram?.botToken,
        mockMode: !config.telegram?.botToken || config.nodeEnv === "development",
      },
      console: {
        enabled: this.settings.enableConsole,
        environment: config.nodeEnv,
      },
    };
  }
}

module.exports = NotificationRouter;
