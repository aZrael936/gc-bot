/**
 * Models Index
 * Export all database models
 */

const CallModel = require("./call.model");
const TranscriptModel = require("./transcript.model");

module.exports = {
  CallModel,
  TranscriptModel,
  Call: new CallModel(),
  Transcript: new TranscriptModel(),
};
