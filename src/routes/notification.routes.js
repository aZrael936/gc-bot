/**
 * Notification Routes
 * API endpoints for notifications
 */

const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");

// =======================
// Notification Endpoints
// =======================

/**
 * GET /api/notifications
 * Get notifications with pagination
 * Query: { page?, limit?, status?, channel?, type?, startDate?, endDate? }
 */
router.get("/", notificationController.getNotifications);

/**
 * GET /api/notifications/statistics
 * Get notification statistics
 * Query: { startDate?, endDate?, channel? }
 */
router.get("/statistics", notificationController.getStatistics);

/**
 * GET /api/notifications/channels
 * Get notification channel status
 */
router.get("/channels", notificationController.getChannelStatus);

/**
 * POST /api/notifications/test
 * Test notification channels
 */
router.post("/test", notificationController.testChannels);

/**
 * POST /api/notifications/send
 * Send a custom notification
 * Body: { title: string, message: string, channels?: string[] }
 */
router.post("/send", notificationController.sendNotification);

/**
 * PUT /api/notifications/settings
 * Update notification settings
 * Body: { enableTelegram?, enableConsole?, alertOnLowScore?, alertOnCriticalIssue?, lowScoreThreshold? }
 */
router.put("/settings", notificationController.updateSettings);

/**
 * POST /api/notifications/telegram/test
 * Test Telegram connection
 */
router.post("/telegram/test", notificationController.testTelegram);

/**
 * DELETE /api/notifications/old
 * Delete old notifications
 * Query: { daysOld?: number }
 */
router.delete("/old", notificationController.deleteOldNotifications);

// =======================
// User Preferences
// =======================

/**
 * GET /api/notifications/preferences/:userId
 * Get user notification preferences
 */
router.get("/preferences/:userId", notificationController.getUserPreferences);

/**
 * PUT /api/notifications/preferences/:userId
 * Update user notification preferences
 * Body: { telegram_enabled?, telegram_chat_id?, ... }
 */
router.put("/preferences/:userId", notificationController.updateUserPreferences);

module.exports = router;
