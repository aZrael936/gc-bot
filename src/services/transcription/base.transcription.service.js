/**
 * Base Transcription Service
 * Abstract base class for all transcription providers
 */

const path = require("path");

/**
 * @typedef {Object} TranscriptionResult
 * @property {string} text - Full transcription text
 * @property {string} language - Detected language code
 * @property {number} duration - Audio duration in seconds
 * @property {number} processingTimeMs - Processing time in milliseconds
 * @property {number} wordCount - Number of words
 * @property {Array<Segment>} segments - Timestamped segments
 * @property {number|null} confidence - Overall confidence score (0-1)
 * @property {string} provider - Service provider name
 * @property {string} model - Model used
 * @property {Object} raw - Raw response from provider
 */

/**
 * @typedef {Object} Segment
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Segment text
 * @property {number} [confidence] - Segment confidence
 * @property {string} [speaker] - Speaker ID (if diarization enabled)
 */

/**
 * @typedef {Object} TranscriptionOptions
 * @property {string} [language] - Language code (e.g., 'ml' for Malayalam)
 * @property {boolean} [diarize] - Enable speaker diarization
 * @property {boolean} [timestamps] - Include word-level timestamps
 * @property {number} [temperature] - Model temperature (0-1)
 */

class BaseTranscriptionService {
  constructor(config = {}) {
    this.config = config;
    this.providerName = "base";
    this.apiKey = null;
    this.model = null;
  }

  /**
   * Initialize the service
   * @returns {boolean} Success status
   */
  initialize() {
    throw new Error("initialize() must be implemented by provider");
  }

  /**
   * Transcribe audio file
   * @param {string} audioPath - Path to audio file
   * @param {TranscriptionOptions} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioPath, options = {}) {
    throw new Error("transcribe() must be implemented by provider");
  }

  /**
   * Check if service is available
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Get supported languages
   * @returns {Array<string>} Language codes
   */
  getSupportedLanguages() {
    return [];
  }

  /**
   * Validate audio file format
   * @param {string} audioPath
   * @returns {boolean}
   */
  isValidFormat(audioPath) {
    const ext = path.extname(audioPath).toLowerCase().slice(1);
    return this.getSupportedFormats().includes(ext);
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>}
   */
  getSupportedFormats() {
    return ["mp3", "wav", "flac", "m4a", "ogg"];
  }

  /**
   * Estimate cost for transcription
   * @param {string} audioPath
   * @returns {Promise<number>} Estimated cost in USD
   */
  async estimateCost(audioPath) {
    return 0;
  }

  /**
   * Format provider response to standard format
   * @param {Object} rawResponse
   * @param {number} processingTime
   * @returns {TranscriptionResult}
   */
  formatResponse(rawResponse, processingTime) {
    throw new Error("formatResponse() must be implemented by provider");
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number} - Word count
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getProviderName() {
    return this.providerName;
  }

  /**
   * Get model name
   * @returns {string}
   */
  getModelName() {
    return this.model;
  }
}

module.exports = BaseTranscriptionService;
