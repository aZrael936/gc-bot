/**
 * Notification Controller
 * Handles API requests for notifications
 */

const { NotificationRouterInstance, Telegram } = require("../services");
const { Notification, UserPreferences } = require("../models");
const logger = require("../utils/logger");

/**
 * GET /api/notifications
 * Get notifications with pagination
 */
async function getNotifications(req, res) {
  try {
    const { page = 1, limit = 20, status, channel, type, startDate, endDate } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const notifications = Notification.findAll({
      limit: parseInt(limit),
      offset,
      status,
      channel,
      type,
      startDate,
      endDate,
    });

    const total = Notification.count({ status, channel, type });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    logger.error("Error getting notifications", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to get notifications",
      message: error.message,
    });
  }
}

/**
 * GET /api/notifications/statistics
 * Get notification statistics
 */
async function getStatistics(req, res) {
  try {
    const { startDate, endDate, channel } = req.query;

    const stats = Notification.getStatistics({ startDate, endDate, channel });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Error getting notification statistics", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to get statistics",
      message: error.message,
    });
  }
}

/**
 * GET /api/notifications/channels
 * Get notification channel status
 */
async function getChannelStatus(req, res) {
  try {
    const status = NotificationRouterInstance.getChannelStatus();
    const settings = NotificationRouterInstance.getSettings();

    res.json({
      success: true,
      data: {
        channels: status,
        settings: {
          lowScoreThreshold: settings.lowScoreThreshold,
          alertOnLowScore: settings.alertOnLowScore,
          alertOnCriticalIssue: settings.alertOnCriticalIssue,
        },
      },
    });
  } catch (error) {
    logger.error("Error getting channel status", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to get channel status",
      message: error.message,
    });
  }
}

/**
 * POST /api/notifications/test
 * Test notification channels
 */
async function testChannels(req, res) {
  try {
    const results = await NotificationRouterInstance.testChannels();

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error("Error testing channels", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to test channels",
      message: error.message,
    });
  }
}

/**
 * POST /api/notifications/send
 * Send a custom notification
 */
async function sendNotification(req, res) {
  try {
    const { title, message, channels } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: "Title and message are required",
      });
    }

    const results = await NotificationRouterInstance.sendCustomNotification(
      title,
      message,
      { channels }
    );

    // Log notification to database
    for (const result of results) {
      Notification.create({
        channel: result.channel,
        type: "custom",
        message: `${title}: ${message}`,
        status: result.success ? "sent" : "failed",
        metadata: result,
        sent_at: result.success ? new Date().toISOString() : null,
      });
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error("Error sending notification", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to send notification",
      message: error.message,
    });
  }
}

/**
 * PUT /api/notifications/settings
 * Update notification settings
 */
async function updateSettings(req, res) {
  try {
    const {
      enableTelegram,
      enableConsole,
      alertOnLowScore,
      alertOnCriticalIssue,
      lowScoreThreshold,
    } = req.body;

    const updates = {};
    if (enableTelegram !== undefined) updates.enableTelegram = enableTelegram;
    if (enableConsole !== undefined) updates.enableConsole = enableConsole;
    if (alertOnLowScore !== undefined) updates.alertOnLowScore = alertOnLowScore;
    if (alertOnCriticalIssue !== undefined) updates.alertOnCriticalIssue = alertOnCriticalIssue;
    if (lowScoreThreshold !== undefined) updates.lowScoreThreshold = lowScoreThreshold;

    NotificationRouterInstance.updateSettings(updates);

    res.json({
      success: true,
      data: NotificationRouterInstance.getSettings(),
    });
  } catch (error) {
    logger.error("Error updating settings", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to update settings",
      message: error.message,
    });
  }
}

/**
 * GET /api/notifications/preferences/:userId
 * Get user notification preferences
 */
async function getUserPreferences(req, res) {
  try {
    const { userId } = req.params;

    let preferences = UserPreferences.findByUserId(userId);

    if (!preferences) {
      // Return defaults if no preferences set
      preferences = {
        userId,
        ...UserPreferences.getDefaults(),
        isDefault: true,
      };
    }

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error("Error getting user preferences", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to get preferences",
      message: error.message,
    });
  }
}

/**
 * PUT /api/notifications/preferences/:userId
 * Update user notification preferences
 */
async function updateUserPreferences(req, res) {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    const updated = UserPreferences.upsert(userId, preferences);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error("Error updating user preferences", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to update preferences",
      message: error.message,
    });
  }
}

/**
 * POST /api/notifications/telegram/test
 * Test Telegram connection
 */
async function testTelegram(req, res) {
  try {
    const result = await Telegram.testConnection();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Error testing Telegram", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to test Telegram connection",
      message: error.message,
    });
  }
}

/**
 * DELETE /api/notifications/old
 * Delete old notifications
 */
async function deleteOldNotifications(req, res) {
  try {
    const { daysOld = 30 } = req.query;

    const deletedCount = Notification.deleteOld(parseInt(daysOld));

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Deleted ${deletedCount} notifications older than ${daysOld} days`,
      },
    });
  } catch (error) {
    logger.error("Error deleting old notifications", { error: error.message });
    res.status(500).json({
      success: false,
      error: "Failed to delete old notifications",
      message: error.message,
    });
  }
}

module.exports = {
  getNotifications,
  getStatistics,
  getChannelStatus,
  testChannels,
  sendNotification,
  updateSettings,
  getUserPreferences,
  updateUserPreferences,
  testTelegram,
  deleteOldNotifications,
};
