/**
 * Azure Speech Provider
 * Transcription using Azure Cognitive Services Speech-to-Text
 *
 * Microsoft ecosystem integration, decent Malayalam support
 * Features: Real-time and batch processing, fast transcription
 */

const BaseTranscriptionService = require("../base.transcription.service");
const fs = require("fs");
const path = require("path");
const logger = require("../../../utils/logger");

class AzureProvider extends BaseTranscriptionService {
  constructor(config = {}) {
    super(config);
    this.providerName = "azure";
    this.model = "default";
    this.speechConfig = null;
    this.region = null;
  }

  /**
   * Initialize Azure Speech client
   * @returns {boolean} Success status
   */
  initialize() {
    this.apiKey = process.env.AZURE_SPEECH_KEY;
    this.region = process.env.AZURE_SPEECH_REGION || "centralindia";

    if (!this.apiKey) {
      logger.warn("AZURE_SPEECH_KEY not set - Azure provider unavailable");
      return false;
    }

    try {
      // Dynamic import to avoid errors if not installed
      const sdk = require("microsoft-cognitiveservices-speech-sdk");
      this.speechConfig = sdk.SpeechConfig.fromSubscription(this.apiKey, this.region);
      this.sdk = sdk;
      logger.info("Azure Speech transcription provider initialized", { region: this.region });
      return true;
    } catch (error) {
      logger.warn(`Failed to initialize Azure Speech: ${error.message}`);
      logger.warn("Install with: npm install microsoft-cognitiveservices-speech-sdk");
      return false;
    }
  }

  /**
   * Transcribe audio file using Azure Speech
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<TranscriptionResult>}
   */
  async transcribe(audioPath, options = {}) {
    const startTime = Date.now();

    // Ensure client is initialized
    if (!this.speechConfig) {
      if (!this.initialize()) {
        throw new Error("Azure provider not configured - check AZURE_SPEECH_KEY");
      }
    }

    // Validate file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Validate format
    if (!this.isValidFormat(audioPath)) {
      throw new Error(`Unsupported format: ${path.extname(audioPath)}`);
    }

    const fileStats = fs.statSync(audioPath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    // Map language code to Azure format
    const languageCode = this.mapLanguageCode(options.language);

    logger.info("Starting Azure Speech transcription", {
      audioPath,
      fileSizeMB: fileSizeMB.toFixed(2),
      language: languageCode,
      region: this.region,
    });

    try {
      // Set recognition language
      this.speechConfig.speechRecognitionLanguage = languageCode;

      // Enable detailed output
      this.speechConfig.outputFormat = this.sdk.OutputFormat.Detailed;

      // Read audio file
      const audioBuffer = fs.readFileSync(audioPath);

      // Create audio config from buffer
      const audioConfig = this.createAudioConfigFromBuffer(audioBuffer, audioPath);

      // Create recognizer
      const recognizer = new this.sdk.SpeechRecognizer(this.speechConfig, audioConfig);

      // Perform continuous recognition for full transcription
      const result = await this.performContinuousRecognition(recognizer, languageCode);

      const processingTime = Date.now() - startTime;
      result.processingTimeMs = processingTime;
      result.model = this.model;
      result.provider = this.providerName;

      logger.info("Azure Speech transcription completed", {
        language: result.language,
        duration: result.duration,
        wordCount: result.wordCount,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("Azure Speech transcription failed", {
        audioPath,
        error: error.message,
        processingTimeMs: processingTime,
      });

      // Handle specific errors
      if (error.message?.includes("401")) {
        throw new Error("Invalid AZURE_SPEECH_KEY");
      }
      if (error.message?.includes("quota")) {
        throw new Error("Azure Speech API quota exceeded");
      }

      throw error;
    }
  }

  /**
   * Create audio config from buffer
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} audioPath - Path to audio file (for format detection)
   * @returns {AudioConfig}
   */
  createAudioConfigFromBuffer(audioBuffer, audioPath) {
    const ext = path.extname(audioPath).toLowerCase();

    // Azure SDK works best with WAV files
    // For other formats, we'll use push stream
    if (ext === ".wav") {
      // Create from WAV file directly
      return this.sdk.AudioConfig.fromWavFileInput(audioBuffer);
    }

    // For non-WAV files, create push stream
    const pushStream = this.sdk.AudioInputStream.createPushStream();
    pushStream.write(audioBuffer);
    pushStream.close();

    return this.sdk.AudioConfig.fromStreamInput(pushStream);
  }

  /**
   * Perform continuous recognition to get full transcript
   * @param {SpeechRecognizer} recognizer - Azure recognizer
   * @param {string} languageCode - Language code
   * @returns {Promise<TranscriptionResult>}
   */
  performContinuousRecognition(recognizer, languageCode) {
    return new Promise((resolve, reject) => {
      const results = [];
      const segments = [];
      let segmentId = 0;

      recognizer.recognized = (s, e) => {
        if (e.result.reason === this.sdk.ResultReason.RecognizedSpeech) {
          results.push(e.result.text);

          // Try to extract detailed results if available
          try {
            const detailed = JSON.parse(e.result.json);
            if (detailed?.NBest?.[0]?.Words) {
              detailed.NBest[0].Words.forEach((word) => {
                segments.push({
                  id: segmentId++,
                  start: word.Offset / 10000000, // Convert from 100ns to seconds
                  end: (word.Offset + word.Duration) / 10000000,
                  text: word.Word,
                  confidence: word.Confidence || null,
                });
              });
            }
          } catch (e) {
            // JSON parsing failed, continue without detailed segments
          }
        }
      };

      recognizer.canceled = (s, e) => {
        if (e.reason === this.sdk.CancellationReason.Error) {
          recognizer.close();
          reject(new Error(`Azure recognition error: ${e.errorDetails}`));
        }
      };

      recognizer.sessionStopped = (s, e) => {
        recognizer.close();

        const text = results.join(" ").trim();
        const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;

        resolve({
          text,
          language: languageCode,
          duration,
          segments,
          wordCount: this.countWords(text),
          confidence: null, // Azure doesn't provide overall confidence
          raw: { results, segments },
        });
      };

      // Start continuous recognition
      recognizer.startContinuousRecognitionAsync(
        () => {
          // Recognition started
        },
        (error) => {
          recognizer.close();
          reject(new Error(`Failed to start recognition: ${error}`));
        }
      );

      // Stop after audio is processed (timeout as fallback)
      setTimeout(() => {
        recognizer.stopContinuousRecognitionAsync();
      }, 300000); // 5 minute timeout
    });
  }

  /**
   * Map language code to Azure format
   * @param {string} language - Short language code
   * @returns {string} Azure language code
   */
  mapLanguageCode(language) {
    const languageMap = {
      ml: "ml-IN",     // Malayalam
      hi: "hi-IN",     // Hindi
      ta: "ta-IN",     // Tamil
      te: "te-IN",     // Telugu
      gu: "gu-IN",     // Gujarati
      kn: "kn-IN",     // Kannada
      bn: "bn-IN",     // Bengali
      mr: "mr-IN",     // Marathi
      pa: "pa-IN",     // Punjabi
      en: "en-US",     // English (US)
    };

    if (!language) {
      return "ml-IN"; // Default to Malayalam
    }

    return languageMap[language] || languageMap[language.split("-")[0]] || "ml-IN";
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>}
   */
  getSupportedFormats() {
    return ["wav", "mp3", "ogg", "flac"];
  }

  /**
   * Get supported languages
   * @returns {Array<string>}
   */
  getSupportedLanguages() {
    return [
      "ml", "hi", "ta", "te", "gu", "kn", "bn", "mr", "pa",
      "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh", "ar",
    ];
  }

  /**
   * Estimate cost for transcription (~$1.00 per hour)
   * @param {string} audioPath
   * @returns {Promise<number>} Estimated cost in USD
   */
  async estimateCost(audioPath) {
    const stats = fs.statSync(audioPath);
    const durationEstimate = stats.size / (128000 / 8);
    const hours = durationEstimate / 3600;
    return hours * 1.00; // ~$1.00 per hour
  }
}

module.exports = AzureProvider;
