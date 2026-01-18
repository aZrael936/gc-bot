#!/usr/bin/env node

/**
 * End-to-End Pipeline Test
 * Tests the complete call processing flow:
 * Call Receive → Transcribe → Analyze → Notify
 *
 * Usage:
 *   node tests/phase6/e2e-pipeline.test.js [audio-file-path]
 *
 * Example:
 *   node tests/phase6/e2e-pipeline.test.js /path/to/sample-audio.mp3
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");

// Test configuration
const TEST_CONFIG = {
  audioPath: process.argv[2] || process.env.TEST_AUDIO_PATH || null,
  timeout: 300000, // 5 minutes max for full pipeline
  skipNotification: process.env.SKIP_NOTIFICATION === "true",
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Utility functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (num, msg) =>
    console.log(
      `\n${colors.cyan}${colors.bright}[Step ${num}]${colors.reset} ${msg}`
    ),
  section: (msg) =>
    console.log(
      `\n${"=".repeat(60)}\n${colors.magenta}${colors.bright}${msg}${colors.reset}\n${"=".repeat(60)}`
    ),
  data: (label, value) =>
    console.log(`  ${colors.dim}${label}:${colors.reset} ${value}`),
};

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
};

/**
 * End-to-End Pipeline Test Runner
 */
class E2EPipelineTest {
  constructor(audioPath) {
    this.audioPath = audioPath;
    this.callId = null;
    this.transcriptId = null;
    this.analysisId = null;
    this.results = {
      steps: [],
      totalTime: 0,
      success: false,
    };
  }

  /**
   * Initialize services and database
   */
  async initialize() {
    log.step(0, "Initializing test environment");
    const startTime = Date.now();

    try {
      // Initialize database
      log.info("Checking database...");
      const { Call, Transcript, Analysis } = require("../../src/models");
      this.models = { Call, Transcript, Analysis };

      // Initialize services
      log.info("Loading services...");
      const {
        Call: CallService,
        Transcription,
        Analysis: AnalysisService,
        Console: ConsoleNotification,
        NotificationRouterInstance,
      } = require("../../src/services");

      this.services = {
        Call: CallService,
        Transcription,
        Analysis: AnalysisService,
        Console: ConsoleNotification,
        NotificationRouter: NotificationRouterInstance,
      };

      // Validate audio file
      if (!fs.existsSync(this.audioPath)) {
        throw new Error(`Audio file not found: ${this.audioPath}`);
      }

      const stats = fs.statSync(this.audioPath);
      log.data("Audio file", this.audioPath);
      log.data("File size", `${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

      // Check required services
      if (!this.services.Transcription.isAvailable()) {
        log.warn("Transcription service not configured (ELEVENLABS_API_KEY missing)");
        log.warn("Test will use mock transcription");
        this.useMockTranscription = true;
      } else {
        log.success("Transcription service available (ElevenLabs)");
      }

      if (!this.services.Analysis.isAvailable()) {
        log.warn("Analysis service not configured (OPENROUTER_API_KEY missing)");
        log.warn("Test will use mock analysis");
        this.useMockAnalysis = true;
      } else {
        log.success("Analysis service available (OpenRouter)");
      }

      const elapsed = Date.now() - startTime;
      log.success(`Initialization completed in ${formatDuration(elapsed)}`);

      this.recordStep("Initialize", true, elapsed);
      return true;
    } catch (error) {
      log.error(`Initialization failed: ${error.message}`);
      this.recordStep("Initialize", false, Date.now() - startTime, error.message);
      return false;
    }
  }

  /**
   * Step 1: Create call record
   */
  async createCallRecord() {
    log.step(1, "Creating call record");
    const startTime = Date.now();

    try {
      const callSid = `e2e_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const callData = {
        org_id: "default",
        agent_id: "agent_001",
        exotel_call_sid: callSid,
        recording_url: `file://${this.audioPath}`,
        local_audio_path: this.audioPath,
        duration_seconds: 0, // Will be updated after transcription
        call_type: "e2e-test",
        caller_number: "+919876543210",
        callee_number: "+911234567890",
        direction: "outgoing",
        status: "downloaded", // Skip download step since audio is local
      };

      const call = await this.services.Call.createCall(callData);
      this.callId = call.id;

      log.data("Call ID", call.id);
      log.data("Call SID", call.exotel_call_sid);
      log.data("Status", call.status);

      const elapsed = Date.now() - startTime;
      log.success(`Call record created in ${formatDuration(elapsed)}`);

      this.recordStep("Create Call", true, elapsed);
      return true;
    } catch (error) {
      log.error(`Failed to create call: ${error.message}`);
      this.recordStep("Create Call", false, Date.now() - startTime, error.message);
      return false;
    }
  }

  /**
   * Step 2: Transcribe audio
   */
  async transcribeAudio() {
    log.step(2, "Transcribing audio");
    const startTime = Date.now();

    try {
      let result;

      if (this.useMockTranscription) {
        log.info("Using mock transcription...");
        result = this.generateMockTranscription();
      } else {
        log.info("Calling ElevenLabs Scribe v2 API...");
        result = await this.services.Transcription.transcribe(this.audioPath);
      }

      // Save transcript to database
      const { Transcript } = require("../../src/models");

      const transcript = Transcript.create({
        call_id: this.callId,
        content: result.text,
        language: result.language,
        speaker_segments: result.segments,
        word_count: result.wordCount,
        stt_provider: result.provider || "mock",
        processing_time_ms: Date.now() - startTime,
      });

      this.transcriptId = transcript.id;

      // Update call status
      await this.services.Call.updateCallStatus(this.callId, "transcribed");

      // Update call duration if available
      if (result.duration) {
        const { Call } = require("../../src/models");
        Call.update(this.callId, { duration_seconds: Math.round(result.duration) });
      }

      log.data("Transcript ID", transcript.id);
      log.data("Language", result.language);
      log.data("Word count", result.wordCount);
      log.data("Duration", result.duration ? `${result.duration.toFixed(2)}s` : "N/A");

      // Show transcript preview
      const preview = result.text.substring(0, 200);
      log.info(`Transcript preview: "${preview}${result.text.length > 200 ? '...' : ''}"`);

      const elapsed = Date.now() - startTime;
      log.success(`Transcription completed in ${formatDuration(elapsed)}`);

      this.recordStep("Transcribe", true, elapsed, null, {
        language: result.language,
        wordCount: result.wordCount,
        duration: result.duration,
      });

      return true;
    } catch (error) {
      log.error(`Transcription failed: ${error.message}`);
      await this.services.Call.updateCallStatus(this.callId, "transcription_failed");
      this.recordStep("Transcribe", false, Date.now() - startTime, error.message);
      return false;
    }
  }

  /**
   * Step 3: Analyze transcript
   */
  async analyzeTranscript() {
    log.step(3, "Analyzing transcript with AI");
    const startTime = Date.now();

    try {
      let analysis;

      if (this.useMockAnalysis) {
        log.info("Using mock analysis...");
        analysis = await this.generateMockAnalysis();
      } else {
        log.info("Calling OpenRouter LLM API...");
        analysis = await this.services.Analysis.analyzeCall(this.callId);
      }

      this.analysisId = analysis.id;
      this.analysis = analysis;

      // Update call status
      await this.services.Call.updateCallStatus(this.callId, "analyzed");

      log.data("Analysis ID", analysis.id);
      log.data("Overall Score", `${analysis.overall_score}/100`);
      log.data("Sentiment", analysis.sentiment);
      log.data("Alert Triggered", analysis.alert_triggered ? "Yes" : "No");

      // Show category scores
      if (analysis.category_scores) {
        log.info("Category Scores:");
        const categories = typeof analysis.category_scores === "string"
          ? JSON.parse(analysis.category_scores)
          : analysis.category_scores;

        for (const [category, data] of Object.entries(categories)) {
          const score = data.score || data;
          log.data(`  ${category}`, `${score}/100`);
        }
      }

      // Show summary
      log.info(`Summary: "${analysis.summary}"`);

      const elapsed = Date.now() - startTime;
      log.success(`Analysis completed in ${formatDuration(elapsed)}`);

      this.recordStep("Analyze", true, elapsed, null, {
        overallScore: analysis.overall_score,
        sentiment: analysis.sentiment,
        alertTriggered: analysis.alert_triggered,
      });

      return true;
    } catch (error) {
      log.error(`Analysis failed: ${error.message}`);
      await this.services.Call.updateCallStatus(this.callId, "analysis_failed");
      this.recordStep("Analyze", false, Date.now() - startTime, error.message);
      return false;
    }
  }

  /**
   * Step 4: Send notification (if alert triggered)
   */
  async sendNotification() {
    log.step(4, "Processing notification");
    const startTime = Date.now();

    try {
      if (TEST_CONFIG.skipNotification) {
        log.info("Notification skipped (SKIP_NOTIFICATION=true)");
        this.recordStep("Notify", true, Date.now() - startTime, null, { skipped: true });
        return true;
      }

      const analysis = this.analysis;
      const alertNeeded = analysis.alert_triggered || analysis.overall_score < 50;

      if (!alertNeeded) {
        log.info("No alert needed - score is acceptable");
        this.recordStep("Notify", true, Date.now() - startTime, null, { noAlert: true });
        return true;
      }

      log.info("Low score detected - sending notification...");

      // Send console notification
      const result = await this.services.Console.sendLowScoreAlert({
        callId: this.callId,
        score: analysis.overall_score,
        summary: analysis.summary,
        issues: analysis.issues,
      });

      log.data("Notification sent", "console");
      log.data("Result", result.status || "success");

      const elapsed = Date.now() - startTime;
      log.success(`Notification processed in ${formatDuration(elapsed)}`);

      this.recordStep("Notify", true, elapsed);
      return true;
    } catch (error) {
      log.error(`Notification failed: ${error.message}`);
      this.recordStep("Notify", false, Date.now() - startTime, error.message);
      return false;
    }
  }

  /**
   * Step 5: Verify results in database
   */
  async verifyResults() {
    log.step(5, "Verifying results in database");
    const startTime = Date.now();

    try {
      const { Call, Transcript, Analysis } = require("../../src/models");

      // Verify call
      const call = Call.findById(this.callId);
      if (!call) {
        throw new Error("Call not found in database");
      }
      log.data("Call status", call.status);

      // Verify transcript
      const transcript = Transcript.findByCallId(this.callId);
      if (!transcript) {
        throw new Error("Transcript not found in database");
      }
      log.data("Transcript exists", "Yes");
      log.data("Transcript word count", transcript.word_count);

      // Verify analysis
      const analysis = Analysis.findByCallId(this.callId);
      if (!analysis) {
        throw new Error("Analysis not found in database");
      }
      log.data("Analysis exists", "Yes");
      log.data("Analysis score", analysis.overall_score);

      const elapsed = Date.now() - startTime;
      log.success(`Verification completed in ${formatDuration(elapsed)}`);

      this.recordStep("Verify", true, elapsed);
      return true;
    } catch (error) {
      log.error(`Verification failed: ${error.message}`);
      this.recordStep("Verify", false, Date.now() - startTime, error.message);
      return false;
    }
  }

  /**
   * Generate mock transcription for testing without API
   */
  generateMockTranscription() {
    return {
      text: `Hello, this is a sales call. How can I help you today?
      I'm interested in learning more about your product.
      Great! Let me tell you about our features.
      We offer competitive pricing and excellent customer support.
      That sounds good. What are the pricing options?
      We have three tiers: Basic at $29, Pro at $79, and Enterprise at custom pricing.
      I think the Pro plan might work for us. Can we schedule a demo?
      Absolutely! I'll send you a calendar link. Is there anything else you'd like to know?
      No, that covers it. Thank you for your time.
      Thank you! I look forward to the demo. Have a great day!`,
      language: "en",
      duration: 180.5,
      segments: [
        { id: 0, start: 0, end: 5, text: "Hello, this is a sales call.", speaker: "agent" },
        { id: 1, start: 5, end: 12, text: "I'm interested in learning more about your product.", speaker: "customer" },
      ],
      wordCount: 85,
      provider: "mock",
    };
  }

  /**
   * Generate mock analysis for testing without API
   */
  async generateMockAnalysis() {
    const { Analysis } = require("../../src/models");

    const mockResult = {
      overall_score: 72,
      category_scores: {
        greeting: { score: 85, feedback: "Good opening" },
        need_discovery: { score: 70, feedback: "Could ask more questions" },
        product_presentation: { score: 75, feedback: "Clear explanation" },
        objection_handling: { score: 65, feedback: "No objections to handle" },
        closing: { score: 80, feedback: "Good call-to-action" },
      },
      issues: [
        { severity: "low", description: "Could have asked more discovery questions" },
      ],
      recommendations: [
        "Ask more open-ended questions",
        "Discuss customer pain points before presenting solution",
      ],
      summary: "Good sales call with clear product presentation. Customer showed interest and scheduled a demo.",
      sentiment: "positive",
    };

    const savedAnalysis = Analysis.create({
      call_id: this.callId,
      overall_score: mockResult.overall_score,
      category_scores: mockResult.category_scores,
      issues: mockResult.issues,
      recommendations: mockResult.recommendations,
      summary: mockResult.summary,
      sentiment: mockResult.sentiment,
      llm_model: "mock",
      prompt_tokens: 0,
      completion_tokens: 0,
      processing_time_ms: 100,
    });

    return {
      ...savedAnalysis,
      category_scores: mockResult.category_scores,
      issues: mockResult.issues,
      recommendations: mockResult.recommendations,
      alert_triggered: mockResult.overall_score < 50,
    };
  }

  /**
   * Record step result
   */
  recordStep(name, success, duration, error = null, data = null) {
    this.results.steps.push({
      name,
      success,
      duration,
      error,
      data,
    });
  }

  /**
   * Print final summary
   */
  printSummary() {
    log.section("E2E TEST SUMMARY");

    const totalTime = this.results.steps.reduce((acc, step) => acc + step.duration, 0);
    this.results.totalTime = totalTime;

    console.log("\nStep Results:");
    console.log("─".repeat(60));

    for (const step of this.results.steps) {
      const status = step.success
        ? `${colors.green}PASS${colors.reset}`
        : `${colors.red}FAIL${colors.reset}`;
      const time = formatDuration(step.duration);
      console.log(`  ${step.name.padEnd(20)} ${status.padEnd(20)} ${time}`);
      if (step.error) {
        console.log(`    ${colors.red}Error: ${step.error}${colors.reset}`);
      }
    }

    console.log("─".repeat(60));
    console.log(`\n  Total Time: ${formatDuration(totalTime)}`);

    const allPassed = this.results.steps.every((s) => s.success);
    this.results.success = allPassed;

    if (allPassed) {
      console.log(`\n${colors.green}${colors.bright}✓ ALL STEPS PASSED${colors.reset}`);
    } else {
      console.log(`\n${colors.red}${colors.bright}✗ SOME STEPS FAILED${colors.reset}`);
    }

    if (this.callId) {
      console.log(`\n${colors.dim}Call ID: ${this.callId}${colors.reset}`);
    }

    if (this.analysisId && this.analysis) {
      console.log(`${colors.dim}Analysis Score: ${this.analysis.overall_score}/100${colors.reset}`);
    }

    return allPassed;
  }

  /**
   * Run the complete E2E test
   */
  async run() {
    log.section("SALES CALL QC - END-TO-END PIPELINE TEST");

    const steps = [
      () => this.initialize(),
      () => this.createCallRecord(),
      () => this.transcribeAudio(),
      () => this.analyzeTranscript(),
      () => this.sendNotification(),
      () => this.verifyResults(),
    ];

    for (const step of steps) {
      const success = await step();
      if (!success) {
        log.error("Pipeline stopped due to failure");
        break;
      }
    }

    return this.printSummary();
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          SALES CALL QC - END-TO-END PIPELINE TEST             ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Validate audio path
  if (!TEST_CONFIG.audioPath) {
    console.log(`${colors.red}Error: No audio file specified${colors.reset}`);
    console.log(`
Usage:
  node tests/phase6/e2e-pipeline.test.js <audio-file-path>

Example:
  node tests/phase6/e2e-pipeline.test.js /path/to/sample-audio.mp3

Environment Variables:
  TEST_AUDIO_PATH      - Default audio file path
  SKIP_NOTIFICATION    - Skip notification step (true/false)
  ELEVENLABS_API_KEY   - For real transcription (optional)
  OPENROUTER_API_KEY   - For real analysis (optional)
`);
    process.exit(1);
  }

  // Run test
  const test = new E2EPipelineTest(TEST_CONFIG.audioPath);
  const success = await test.run();

  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { E2EPipelineTest, TEST_CONFIG };
