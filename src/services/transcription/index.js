/**
 * Transcription Module Index
 * Exports transcription services and manager
 */

const BaseTranscriptionService = require("./base.transcription.service");
const TranscriptionManager = require("./transcription.manager");
const {
  GroqProvider,
  ElevenLabsProvider,
  SarvamProvider,
  GoogleProvider,
  AzureProvider,
} = require("./providers");

module.exports = {
  // Main orchestrator
  TranscriptionManager,

  // Base class for custom providers
  BaseTranscriptionService,

  // Individual providers
  providers: {
    GroqProvider,
    ElevenLabsProvider,
    SarvamProvider,
    GoogleProvider,
    AzureProvider,
  },
};
