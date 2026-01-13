#!/usr/bin/env node

/**
 * Multi-Provider Transcription Comparison Script
 * Compares transcription quality across 5 STT services
 *
 * Usage:
 *   node scripts/compare-transcription-services.js [audio-file-path] [language]
 *
 * Examples:
 *   node scripts/compare-transcription-services.js sample-audio/test.mp3 ml
 *   node scripts/compare-transcription-services.js /path/to/audio.wav hi
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const { TranscriptionManager } = require("../src/services/transcription");

// Parse command line arguments
const SAMPLE_AUDIO_PATH = process.argv[2] || path.join(
  __dirname,
  "..",
  "sample-audio",
  "harvard.wav"
);
const LANGUAGE = process.argv[3] || "ml"; // Default to Malayalam

// ANSI color codes for terminal output
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

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log("=".repeat(80), "cyan");
  log(title, "bright");
  log("=".repeat(80), "cyan");
}

function logSubsection(title) {
  console.log();
  log("-".repeat(80), "dim");
  log(title, "yellow");
  log("-".repeat(80), "dim");
}

async function main() {
  logSection("MULTI-PROVIDER TRANSCRIPTION COMPARISON");

  log(`Audio file: ${SAMPLE_AUDIO_PATH}`);
  log(`Language: ${LANGUAGE}`);
  log(`Timestamp: ${new Date().toISOString()}`);

  // Check if file exists
  if (!fs.existsSync(SAMPLE_AUDIO_PATH)) {
    log(`\n❌ Error: Audio file not found at ${SAMPLE_AUDIO_PATH}`, "red");
    console.log();
    log("Usage: node scripts/compare-transcription-services.js [audio-file-path] [language]", "yellow");
    console.log();
    log("Examples:", "dim");
    log("  node scripts/compare-transcription-services.js sample-audio/test.mp3 ml", "dim");
    log("  node scripts/compare-transcription-services.js /path/to/audio.wav hi", "dim");
    process.exit(1);
  }

  // Get file stats
  const stats = fs.statSync(SAMPLE_AUDIO_PATH);
  const fileSizeKB = (stats.size / 1024).toFixed(2);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  log(`File size: ${fileSizeKB} KB (${fileSizeMB} MB)`);

  // Initialize transcription manager
  logSubsection("INITIALIZING PROVIDERS");

  const manager = new TranscriptionManager();
  const availableProviders = manager.getAvailableProviders();

  if (availableProviders.length === 0) {
    log("\n❌ No transcription providers available!", "red");
    console.log();
    log("Please set at least one API key in your .env file:", "yellow");
    log("  - GROQ_API_KEY", "dim");
    log("  - ELEVENLABS_API_KEY", "dim");
    log("  - SARVAM_API_KEY", "dim");
    log("  - GOOGLE_APPLICATION_CREDENTIALS + GOOGLE_CLOUD_PROJECT", "dim");
    log("  - AZURE_SPEECH_KEY + AZURE_SPEECH_REGION", "dim");
    process.exit(1);
  }

  log(`\nAvailable providers: ${availableProviders.length}`, "green");
  availableProviders.forEach((name) => {
    log(`  ✓ ${name}`, "green");
  });

  // Show unavailable providers
  const allProviders = ["groq", "elevenlabs", "sarvam", "google", "azure"];
  const unavailable = allProviders.filter((p) => !availableProviders.includes(p));
  if (unavailable.length > 0) {
    log(`\nUnavailable providers: ${unavailable.length}`, "yellow");
    unavailable.forEach((name) => {
      log(`  ✗ ${name} (missing API key or dependencies)`, "dim");
    });
  }

  // Estimate costs
  logSubsection("COST ESTIMATES");

  const costs = await manager.estimateCosts(SAMPLE_AUDIO_PATH);
  Object.entries(costs.byProvider).forEach(([provider, cost]) => {
    if (cost !== null) {
      log(`  ${provider}: $${cost.toFixed(4)}`, "dim");
    }
  });
  log(`  Total: $${costs.total.toFixed(4)}`, "cyan");

  // Run transcription with all providers
  logSubsection("RUNNING TRANSCRIPTIONS IN PARALLEL");

  log(`\nStarting parallel transcription...`);
  const startTime = Date.now();

  const allResults = await manager.transcribeWithAll(SAMPLE_AUDIO_PATH, {
    language: LANGUAGE,
    diarize: true,
    timestamps: true,
  });

  const totalTime = Date.now() - startTime;
  log(`\n✓ Parallel execution completed in ${totalTime}ms`, "green");

  // Display individual results
  logSection("INDIVIDUAL RESULTS");

  Object.entries(allResults.results).forEach(([provider, result]) => {
    logSubsection(`${provider.toUpperCase()}`);

    if (result.success && result.data) {
      const data = result.data;
      log(`✅ Status: Success`, "green");
      log(`Language detected: ${data.language}`);
      log(`Duration: ${data.duration?.toFixed(2) || "N/A"}s`);
      log(`Processing time: ${data.processingTimeMs}ms`);
      log(`Word count: ${data.wordCount}`);
      log(`Confidence: ${data.confidence ? (data.confidence * 100).toFixed(1) + "%" : "N/A"}`);
      log(`Segments: ${data.segments?.length || 0}`);

      console.log();
      log("Transcript:", "cyan");
      log("-".repeat(40), "dim");

      // Wrap text at 78 characters for readability
      const text = data.text || "";
      const lines = [];
      let currentLine = "";
      text.split(" ").forEach((word) => {
        if (currentLine.length + word.length + 1 <= 78) {
          currentLine += (currentLine ? " " : "") + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      lines.forEach((line) => log(line));

      if (data.segments && data.segments.length > 0) {
        console.log();
        log("First 3 segments with timestamps:", "cyan");
        data.segments.slice(0, 3).forEach((seg) => {
          log(`  [${seg.start?.toFixed(2) || 0}s - ${seg.end?.toFixed(2) || 0}s] ${seg.text}`, "dim");
        });
      }
    } else {
      log(`❌ Status: Failed`, "red");
      log(`Error: ${result.error}`, "red");
    }
  });

  // Comparison analysis
  logSection("COMPARISON ANALYSIS");

  const comparison = manager.compareResults(allResults);

  if (comparison.error) {
    log(`\n❌ ${comparison.error}`, "red");
    if (comparison.failedProviders) {
      comparison.failedProviders.forEach((f) => {
        log(`  - ${f.name}: ${f.error}`, "dim");
      });
    }
  } else {
    // Summary
    logSubsection("SUMMARY");
    log(`Total providers: ${comparison.summary.totalProviders}`);
    log(`Successful: ${comparison.summary.successfulProviders}`, "green");
    log(`Failed: ${comparison.summary.failedProviders}`, comparison.summary.failedProviders > 0 ? "red" : "dim");
    log(`Total time: ${comparison.summary.totalProcessingTimeMs}ms`);

    // Performance
    logSubsection("PERFORMANCE");
    log(`🏃 Fastest: ${comparison.fastest.provider} (${comparison.fastest.timeMs}ms)`, "green");
    log(`🐢 Slowest: ${comparison.slowest.provider} (${comparison.slowest.timeMs}ms)`, "yellow");

    if (comparison.highestConfidence) {
      log(`🎯 Highest confidence: ${comparison.highestConfidence.provider} (${(comparison.highestConfidence.confidence * 100).toFixed(1)}%)`, "cyan");
    }

    // Word count comparison
    logSubsection("WORD COUNT COMPARISON");
    log(`Average word count: ${comparison.textAnalysis.averageWordCount}`);
    console.log();
    comparison.textAnalysis.textLengths.forEach((t) => {
      const bar = "█".repeat(Math.min(Math.round(t.wordCount / 5), 40));
      log(`  ${t.provider.padEnd(12)} ${String(t.wordCount).padStart(4)} words ${bar}`, "dim");
    });

    if (comparison.textAnalysis.outliers) {
      console.log();
      log("⚠️  Outliers detected (>50% deviation from average):", "yellow");
      comparison.textAnalysis.outliers.forEach((o) => {
        log(`    - ${o.provider}: ${o.wordCount} words`, "yellow");
      });
    }

    // Failed providers
    if (comparison.failed.length > 0) {
      logSubsection("FAILED PROVIDERS");
      comparison.failed.forEach((f) => {
        log(`  ❌ ${f.provider}: ${f.error}`, "red");
      });
    }

    // Full transcription comparison (side by side)
    logSubsection("TRANSCRIPTION COMPARISON");

    comparison.transcriptions.forEach((t) => {
      console.log();
      log(`--- ${t.provider.toUpperCase()} (${t.model}) ---`, "cyan");
      log(`Words: ${t.wordCount} | Time: ${t.processingTimeMs}ms | Confidence: ${t.confidence ? (t.confidence * 100).toFixed(1) + "%" : "N/A"}`, "dim");
      console.log();

      // Print full text
      const text = t.text || "";
      const lines = [];
      let currentLine = "";
      text.split(" ").forEach((word) => {
        if (currentLine.length + word.length + 1 <= 76) {
          currentLine += (currentLine ? " " : "") + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      lines.forEach((line) => log(`  ${line}`));
    });
  }

  // Save results to file
  logSection("SAVING RESULTS");

  const outputPath = path.join(__dirname, "..", "transcription-comparison-results.json");
  const outputData = {
    ...allResults,
    comparison,
    metadata: {
      audioFile: SAMPLE_AUDIO_PATH,
      language: LANGUAGE,
      fileSize: stats.size,
      totalTime,
      timestamp: new Date().toISOString(),
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  log(`\n✅ Full results saved to: ${outputPath}`, "green");

  // Recommendation
  if (!comparison.error && comparison.transcriptions.length > 0) {
    logSection("RECOMMENDATION");

    const best = manager.getBestResult(allResults, "confidence");
    if (best) {
      log(`\n🏆 Recommended provider: ${best.provider.toUpperCase()}`, "green");
      log(`   Model: ${best.model}`);
      log(`   Word count: ${best.wordCount}`);
      log(`   Processing time: ${best.processingTimeMs}ms`);
      if (best.confidence) {
        log(`   Confidence: ${(best.confidence * 100).toFixed(1)}%`);
      }
    }

    console.log();
    log("Note: Manual review of Malayalam transcription quality is recommended", "yellow");
    log("to verify accuracy, as automated metrics may not capture linguistic nuances.", "yellow");
  }

  logSection("COMPARISON COMPLETE");

  console.log();
  log(`Total execution time: ${totalTime}ms`);
  console.log();

  return allResults;
}

// Run main function
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log(`\n❌ Comparison failed: ${error.message}`, "red");
    console.error(error.stack);
    process.exit(1);
  });
