/**
 * Transcription Providers Index
 * Exports all available transcription providers
 */

const GroqProvider = require("./groq.provider");
const ElevenLabsProvider = require("./elevenlabs.provider");
const SarvamProvider = require("./sarvam.provider");
const GoogleProvider = require("./google.provider");
const AzureProvider = require("./azure.provider");

module.exports = {
  GroqProvider,
  ElevenLabsProvider,
  SarvamProvider,
  GoogleProvider,
  AzureProvider,
};
