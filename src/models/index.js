/**
 * Models Index
 * Export all database models
 */

const CallModel = require("./call.model");
const TranscriptModel = require("./transcript.model");
const AnalysisModel = require("./analysis.model");
const NotificationModel = require("./notification.model");
const UserPreferencesModel = require("./user-preferences.model");

module.exports = {
  CallModel,
  TranscriptModel,
  AnalysisModel,
  NotificationModel,
  UserPreferencesModel,
  Call: new CallModel(),
  Transcript: new TranscriptModel(),
  Analysis: new AnalysisModel(),
  Notification: new NotificationModel(),
  UserPreferences: new UserPreferencesModel(),
};
