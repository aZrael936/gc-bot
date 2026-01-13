#!/usr/bin/env node

/**
 * Transcription Test Script
 * Tests the Groq Whisper transcription service with sample audio
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const TranscriptionService = require("../src/services/transcription.service");

const SAMPLE_AUDIO_PATH = path.join(__dirname, "..", "sample-audio", "harvard.wav");

async function testTranscription() {
  console.log("=".repeat(60));
  console.log("Transcription Service Test");
  console.log("=".repeat(60));

  // Check API key
  if (!process.env.GROQ_API_KEY) {
    console.error("\n❌ Error: GROQ_API_KEY environment variable not set");
    console.log("\nTo set up:");
    console.log("1. Get your API key from https://console.groq.com/keys");
    console.log("2. Create a .env file: cp env.example .env");
    console.log("3. Add your key: GROQ_API_KEY=your_key_here");
    process.exit(1);
  }

  console.log("\n✓ GROQ_API_KEY is set");

  // Check sample audio file
  if (!fs.existsSync(SAMPLE_AUDIO_PATH)) {
    console.error(`\n❌ Error: Sample audio not found at ${SAMPLE_AUDIO_PATH}`);
    process.exit(1);
  }

  const stats = fs.statSync(SAMPLE_AUDIO_PATH);
  console.log(`✓ Sample audio found: ${SAMPLE_AUDIO_PATH}`);
  console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);

  // Initialize service
  const transcription = new TranscriptionService();

  console.log("\n--- Testing Service Availability ---");
  console.log(`Available: ${transcription.isAvailable()}`);
  console.log(`Valid format: ${transcription.isValidFormat(SAMPLE_AUDIO_PATH)}`);
  console.log(`Supported formats: ${transcription.getSupportedFormats().join(", ")}`);

  // Run transcription
  console.log("\n--- Running Transcription ---");
  console.log("Processing audio file... (this may take a few seconds)\n");

  try {
    const startTime = Date.now();
    const result = await transcription.transcribe(SAMPLE_AUDIO_PATH);
    const totalTime = Date.now() - startTime;

    console.log("✅ Transcription Successful!\n");
    console.log("--- Results ---");
    console.log(`Language: ${result.language}`);
    console.log(`Duration: ${result.duration?.toFixed(2) || "N/A"} seconds`);
    console.log(`Word Count: ${result.wordCount}`);
    console.log(`Processing Time: ${result.processingTimeMs}ms`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Model: ${result.model}`);
    console.log(`Provider: ${result.provider}`);

    console.log("\n--- Transcript ---");
    console.log(result.text);

    if (result.segments && result.segments.length > 0) {
      console.log("\n--- Segments (first 5) ---");
      result.segments.slice(0, 5).forEach((seg) => {
        console.log(`[${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s] ${seg.text}`);
      });

      if (result.segments.length > 5) {
        console.log(`... and ${result.segments.length - 5} more segments`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ All tests passed! Transcription service is working.");
    console.log("=".repeat(60));

    return result;
  } catch (error) {
    console.error("\n❌ Transcription Failed!");
    console.error("Error:", error.message);

    if (error.message.includes("401") || error.message.includes("Invalid")) {
      console.error("\nPossible fix: Check your GROQ_API_KEY is correct");
    } else if (error.message.includes("429")) {
      console.error("\nPossible fix: Wait a moment and try again (rate limit)");
    }

    process.exit(1);
  }
}

// Run the test
testTranscription();
