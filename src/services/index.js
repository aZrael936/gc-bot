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
};
