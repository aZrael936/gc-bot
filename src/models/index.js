/**
 * Models Index
 * Export all database models
 */

const CallModel = require("./call.model");
const TranscriptModel = require("./transcript.model");
const AnalysisModel = require("./analysis.model");

module.exports = {
  CallModel,
  TranscriptModel,
  AnalysisModel,
  Call: new CallModel(),
  Transcript: new TranscriptModel(),
  Analysis: new AnalysisModel(),
};
