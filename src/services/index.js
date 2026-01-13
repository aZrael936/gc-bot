/**
 * Services Index
 * Export all business logic services
 */

const CallService = require("./call.service");
const StorageService = require("./storage.service");
const TranscriptionService = require("./transcription.service");

module.exports = {
  CallService,
  StorageService,
  TranscriptionService,
  Call: new CallService(),
  Storage: new StorageService(),
  Transcription: new TranscriptionService(),
};
