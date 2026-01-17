/**
 * Notification Services Index
 * Exports all notification-related services
 */

const TelegramService = require("./telegram.service");
const ConsoleNotificationService = require("./console.service");
const NotificationRouter = require("./notification.router");

module.exports = {
  TelegramService,
  ConsoleNotificationService,
  NotificationRouter,
  Telegram: new TelegramService(),
  Console: new ConsoleNotificationService(),
  Router: new NotificationRouter(),
};
