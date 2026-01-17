/**
 * Services Index
 * Export all business logic services
 */

const CallService = require("./call.service");
const StorageService = require("./storage.service");
const TranscriptionService = require("./transcription.service");

// New multi-provider transcription module
const {
  TranscriptionManager,
  BaseTranscriptionService,
  providers: transcriptionProviders,
} = require("./transcription");

// Analysis services (Phase 4)
const {
  AnalysisService,
  OpenRouterService,
  Analysis: AnalysisInstance,
  OpenRouter: OpenRouterInstance,
} = require("./analysis");

// Export services (Phase 5)
const {
  CsvExportService,
  ExcelExportService,
  CsvExport: CsvExportInstance,
  ExcelExport: ExcelExportInstance,
} = require("./export");

// Notification services (Phase 5)
const {
  TelegramService,
  ConsoleNotificationService,
  NotificationRouter,
  Telegram: TelegramInstance,
  Console: ConsoleInstance,
  Router: NotificationRouterInstance,
} = require("./notification");

// Report services (Phase 5)
const {
  DailyDigestService,
  DailyDigest: DailyDigestInstance,
} = require("./report");

module.exports = {
  // Original services
  CallService,
  StorageService,
  TranscriptionService,

  // Singleton instances (backward compatible)
  Call: new CallService(),
  Storage: new StorageService(),
  Transcription: new TranscriptionService(),

  // New transcription framework
  TranscriptionManager,
  BaseTranscriptionService,
  transcriptionProviders,

  // Analysis services (Phase 4)
  AnalysisService,
  OpenRouterService,
  Analysis: AnalysisInstance,
  OpenRouter: OpenRouterInstance,

  // Export services (Phase 5)
  CsvExportService,
  ExcelExportService,
  CsvExport: CsvExportInstance,
  ExcelExport: ExcelExportInstance,

  // Notification services (Phase 5)
  TelegramService,
  ConsoleNotificationService,
  NotificationRouter,
  Telegram: TelegramInstance,
  Console: ConsoleInstance,
  NotificationRouterInstance,

  // Report services (Phase 5)
  DailyDigestService,
  DailyDigest: DailyDigestInstance,
};
