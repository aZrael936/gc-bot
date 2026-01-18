#!/usr/bin/env node

/**
 * Simple E2E Test Runner
 * Runs the complete pipeline synchronously without queue system
 *
 * Usage:
 *   node scripts/run-e2e-test.js <audio-file-path>
 *
 * Example:
 *   node scripts/run-e2e-test.js /path/to/sample-audio.mp3
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

// Colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = (msg) => console.log(msg);
const info = (msg) => log(`${c.blue}ℹ${c.reset} ${msg}`);
const success = (msg) => log(`${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => log(`${c.yellow}⚠${c.reset} ${msg}`);
const error = (msg) => log(`${c.red}✗${c.reset} ${msg}`);
const step = (n, msg) => log(`\n${c.cyan}${c.bold}[Step ${n}]${c.reset} ${msg}`);
const divider = () => log(`${"─".repeat(60)}`);

async function runE2ETest(audioPath) {
  log(`
╔════════════════════════════════════════════════════════════════╗
║              SALES CALL QC - E2E PIPELINE TEST                 ║
╚════════════════════════════════════════════════════════════════╝
`);

  const startTime = Date.now();
  let callId, transcriptId, analysisId;

  try {
    // ========================================
    // STEP 0: Validate environment
    // ========================================
    step(0, "Validating environment");

    if (!audioPath) {
      throw new Error("No audio file path provided");
    }

    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const audioStats = fs.statSync(audioPath);
    info(`Audio file: ${audioPath}`);
    info(`File size: ${(audioStats.size / (1024 * 1024)).toFixed(2)} MB`);

    // Check API keys
    const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    if (hasElevenLabs) {
      success("ElevenLabs API key found");
    } else {
      warn("ElevenLabs API key not found - will use mock transcription");
    }

    if (hasOpenRouter) {
      success("OpenRouter API key found");
    } else {
      warn("OpenRouter API key not found - will use mock analysis");
    }

    success("Environment validated");

    // ========================================
    // STEP 1: Create call record
    // ========================================
    step(1, "Creating call record in database");

    const { Call: CallModel } = require("../src/models");

    const callSid = `e2e_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const call = CallModel.create({
      org_id: "default",
      agent_id: "test_agent",
      exotel_call_sid: callSid,
      recording_url: `file://${path.resolve(audioPath)}`,
      local_audio_path: path.resolve(audioPath),
      duration_seconds: 0,
      call_type: "e2e-test",
      caller_number: "+919999999999",
      callee_number: "+918888888888",
      direction: "outgoing",
      status: "downloaded",
    });

    callId = call.id;
    info(`Call ID: ${callId}`);
    info(`Call SID: ${callSid}`);
    success("Call record created");

    // ========================================
    // STEP 2: Transcribe audio
    // ========================================
    step(2, "Transcribing audio");

    const { Transcript: TranscriptModel } = require("../src/models");
    let transcriptionResult;

    if (hasElevenLabs) {
      info("Calling ElevenLabs Scribe v2 API...");
      const { Transcription } = require("../src/services");

      const transcribeStart = Date.now();
      transcriptionResult = await Transcription.transcribe(audioPath);
      const transcribeTime = Date.now() - transcribeStart;

      info(`Transcription completed in ${(transcribeTime / 1000).toFixed(1)}s`);
    } else {
      info("Using mock transcription...");
      transcriptionResult = {
        text: `[Mock Transcription]
Agent: Hello, thank you for calling our sales team. How can I help you today?
Customer: Hi, I'm interested in learning about your enterprise solutions.
Agent: Great! We offer comprehensive packages that can scale with your business needs.
Customer: What kind of pricing options do you have?
Agent: We have flexible pricing tiers starting at $99 per month for basic, $299 for professional, and custom pricing for enterprise.
Customer: The professional tier sounds interesting. Can you tell me more about the features?
Agent: Of course! It includes advanced analytics, priority support, and integration capabilities with major platforms.
Customer: That sounds good. I'd like to schedule a demo to see it in action.
Agent: Perfect! I can set that up for you. What day works best for you this week?
Customer: How about Thursday afternoon?
Agent: Thursday at 2 PM works great. I'll send you a calendar invite.
Customer: Thank you so much for your help!
Agent: You're welcome! Looking forward to the demo. Have a great day!`,
        language: "en",
        duration: 195.5,
        segments: [
          { speaker: "agent", start: 0, end: 10 },
          { speaker: "customer", start: 10, end: 20 },
        ],
        wordCount: 150,
        provider: "mock",
        processingTimeMs: 100,
      };
    }

    // Save transcript
    const transcript = TranscriptModel.create({
      call_id: callId,
      content: transcriptionResult.text,
      language: transcriptionResult.language,
      speaker_segments: transcriptionResult.segments,
      word_count: transcriptionResult.wordCount,
      stt_provider: transcriptionResult.provider || "elevenlabs",
      processing_time_ms: transcriptionResult.processingTimeMs || 0,
    });

    transcriptId = transcript.id;

    // Update call with duration
    if (transcriptionResult.duration) {
      CallModel.update(callId, {
        duration_seconds: Math.round(transcriptionResult.duration),
        status: "transcribed",
      });
    } else {
      CallModel.update(callId, { status: "transcribed" });
    }

    info(`Transcript ID: ${transcriptId}`);
    info(`Language: ${transcriptionResult.language}`);
    info(`Word count: ${transcriptionResult.wordCount}`);
    info(`Duration: ${transcriptionResult.duration?.toFixed(1) || "N/A"}s`);

    // Show preview
    const preview = transcriptionResult.text.substring(0, 150);
    log(`\n${c.dim}Transcript preview:${c.reset}`);
    log(`${c.dim}"${preview}..."${c.reset}`);

    success("Transcription completed");

    // ========================================
    // STEP 3: Analyze with AI
    // ========================================
    step(3, "Analyzing transcript with AI");

    const { Analysis: AnalysisModel } = require("../src/models");
    let analysisResult;

    if (hasOpenRouter) {
      info("Calling OpenRouter LLM API...");
      const { Analysis } = require("../src/services");

      const analyzeStart = Date.now();
      analysisResult = await Analysis.analyzeCall(callId);
      const analyzeTime = Date.now() - analyzeStart;

      info(`Analysis completed in ${(analyzeTime / 1000).toFixed(1)}s`);
    } else {
      info("Using mock analysis...");

      // Generate mock analysis
      analysisResult = {
        overall_score: 78,
        category_scores: {
          greeting: { score: 85, feedback: "Professional and warm opening" },
          need_discovery: { score: 75, feedback: "Asked about customer needs" },
          product_presentation: {
            score: 80,
            feedback: "Clear explanation of features and pricing",
          },
          objection_handling: {
            score: 70,
            feedback: "No major objections to handle",
          },
          closing: { score: 82, feedback: "Successfully scheduled a demo" },
        },
        issues: [
          {
            severity: "low",
            category: "need_discovery",
            description: "Could have asked more probing questions about current challenges",
          },
        ],
        recommendations: [
          "Ask more open-ended questions about customer pain points",
          "Discuss ROI and success stories before presenting pricing",
        ],
        summary:
          "Good sales call with effective demo scheduling. The agent was professional and responsive. Could improve discovery phase by asking more about specific business challenges.",
        sentiment: "positive",
      };

      // Save to database
      const savedAnalysis = AnalysisModel.create({
        call_id: callId,
        overall_score: analysisResult.overall_score,
        category_scores: analysisResult.category_scores,
        issues: analysisResult.issues,
        recommendations: analysisResult.recommendations,
        summary: analysisResult.summary,
        sentiment: analysisResult.sentiment,
        llm_model: "mock",
        prompt_tokens: 0,
        completion_tokens: 0,
        processing_time_ms: 100,
      });

      analysisResult.id = savedAnalysis.id;
    }

    analysisId = analysisResult.id;

    // Update call status
    CallModel.update(callId, { status: "analyzed" });

    info(`Analysis ID: ${analysisId}`);
    info(`Overall Score: ${analysisResult.overall_score}/100`);
    info(`Sentiment: ${analysisResult.sentiment}`);

    // Show category scores
    log(`\n${c.dim}Category Scores:${c.reset}`);
    const categories =
      typeof analysisResult.category_scores === "string"
        ? JSON.parse(analysisResult.category_scores)
        : analysisResult.category_scores;

    for (const [cat, data] of Object.entries(categories)) {
      const score = data.score || data;
      const scoreColor = score >= 70 ? c.green : score >= 50 ? c.yellow : c.red;
      log(`  ${cat.padEnd(20)} ${scoreColor}${score}${c.reset}/100`);
    }

    log(`\n${c.dim}Summary:${c.reset}`);
    log(`${c.dim}"${analysisResult.summary}"${c.reset}`);

    success("Analysis completed");

    // ========================================
    // STEP 4: Send notification (if needed)
    // ========================================
    step(4, "Processing notifications");

    const config = require("../src/config");
    const alertThreshold = config.scoring.thresholds.alert;
    const score = analysisResult.overall_score;

    if (score < alertThreshold) {
      warn(`Score ${score} is below alert threshold ${alertThreshold}`);
      info("Sending low score alert...");

      const { Console: ConsoleNotification } = require("../src/services");

      ConsoleNotification.sendLowScoreAlert(
        {
          call_id: callId,
          overall_score: score,
          category_scores: categories,
          issues: analysisResult.issues,
          summary: analysisResult.summary,
          sentiment: analysisResult.sentiment,
        },
        {
          agent_id: "test_agent",
          duration_seconds: Math.round(transcriptionResult.duration || 0),
        }
      );

      success("Low score alert sent");
    } else {
      info(`Score ${score} is above alert threshold ${alertThreshold}`);
      success("No alert needed");
    }

    // ========================================
    // STEP 5: Verify database records
    // ========================================
    step(5, "Verifying database records");

    const verifyCall = CallModel.findById(callId);
    const verifyTranscript = TranscriptModel.findByCallId(callId);
    const verifyAnalysis = AnalysisModel.findByCallId(callId);

    if (!verifyCall) throw new Error("Call not found in database");
    if (!verifyTranscript) throw new Error("Transcript not found in database");
    if (!verifyAnalysis) throw new Error("Analysis not found in database");

    info(`Call status: ${verifyCall.status}`);
    info(`Transcript word count: ${verifyTranscript.word_count}`);
    info(`Analysis score: ${verifyAnalysis.overall_score}`);

    success("All database records verified");

    // ========================================
    // SUMMARY
    // ========================================
    const totalTime = Date.now() - startTime;

    log(`
${"═".repeat(60)}
${c.green}${c.bold}✓ E2E PIPELINE TEST PASSED${c.reset}
${"═".repeat(60)}

${c.bold}Results:${c.reset}
  Call ID:       ${callId}
  Transcript ID: ${transcriptId}
  Analysis ID:   ${analysisId}
  Final Score:   ${score}/100
  Final Status:  ${verifyCall.status}

${c.bold}Timing:${c.reset}
  Total Time:    ${(totalTime / 1000).toFixed(2)}s

${c.dim}View in dashboard: http://localhost:3000/dashboard${c.reset}
${c.dim}API endpoint: GET http://localhost:3000/api/calls/${callId}/analysis${c.reset}
`);

    return {
      success: true,
      callId,
      transcriptId,
      analysisId,
      score,
      totalTime,
    };
  } catch (err) {
    const totalTime = Date.now() - startTime;

    log(`
${"═".repeat(60)}
${c.red}${c.bold}✗ E2E PIPELINE TEST FAILED${c.reset}
${"═".repeat(60)}

${c.red}Error: ${err.message}${c.reset}

${c.dim}Stack trace:${c.reset}
${c.dim}${err.stack}${c.reset}

${c.bold}Partial Results:${c.reset}
  Call ID:       ${callId || "N/A"}
  Transcript ID: ${transcriptId || "N/A"}
  Analysis ID:   ${analysisId || "N/A"}
  Total Time:    ${(totalTime / 1000).toFixed(2)}s
`);

    return {
      success: false,
      error: err.message,
      callId,
      transcriptId,
      analysisId,
      totalTime,
    };
  }
}

// Main
const audioPath = process.argv[2];

if (!audioPath) {
  console.log(`
${c.yellow}Usage:${c.reset}
  node scripts/run-e2e-test.js <audio-file-path>

${c.yellow}Example:${c.reset}
  node scripts/run-e2e-test.js /path/to/sample-audio.mp3

${c.yellow}Environment Variables:${c.reset}
  ELEVENLABS_API_KEY  - For real transcription (optional, uses mock if not set)
  OPENROUTER_API_KEY  - For real AI analysis (optional, uses mock if not set)
`);
  process.exit(1);
}

runE2ETest(audioPath)
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((err) => {
    console.error(`${c.red}Fatal error: ${err.message}${c.reset}`);
    process.exit(1);
  });
