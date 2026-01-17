#!/usr/bin/env node

/**
 * Analysis Service Test Script
 * Tests the OpenRouter integration and analysis pipeline
 *
 * Usage: npm run analysis:test
 */

require("dotenv").config();

const { Analysis, OpenRouter } = require("../src/services");
const { Analysis: AnalysisModel, Transcript: TranscriptModel } = require("../src/models");
const logger = require("../src/utils/logger");

// Sample transcripts for testing
const sampleTranscripts = {
  // Good quality call - sports turf inquiry
  goodCall: `
Agent: Good morning! Thank you for calling GameChanger Sports Infrastructure. This is Rahul speaking. How may I assist you today?

Customer: Hi Rahul. I'm calling from Delhi Public School, Greater Noida. We're looking to set up a football turf for our school.

Agent: That's wonderful! I'm glad you reached out to us. We have extensive experience setting up sports turfs for schools across India. Could you tell me a bit more about your requirements? What's the approximate area you're considering?

Customer: We have about 3000 square meters available. It's currently an empty ground.

Agent: Perfect, 3000 square meters is a good size. That would accommodate a standard 5-a-side or 7-a-side football pitch comfortably. May I ask - is this for regular PE classes, or are you also looking at hosting tournaments?

Customer: Both actually. We want it for daily use by students, but also for inter-school competitions.

Agent: Excellent! In that case, I'd recommend our FIFA Quality certified synthetic turf. It's designed for heavy usage - can handle up to 80 hours of play per week. The turf has proper drainage systems which is essential given Delhi's monsoon season.

Customer: What about the cost?

Agent: For a 3000 sqm FIFA certified installation, you're looking at approximately 35-45 lakhs, depending on the exact specifications. This includes the base preparation, turf installation, goal posts, and line markings. We also provide a 8-year warranty on the turf.

Customer: That's within our budget. What's the installation timeline?

Agent: From site survey to completion, typically 45-60 days. We can start with a site visit next week if you're available. Would Tuesday or Wednesday work for you?

Customer: Wednesday afternoon would be perfect.

Agent: Great! I'll schedule our technical team to visit on Wednesday at 2 PM. I'll send you a confirmation email with all the details. May I have your email address?

Customer: Sure, it's principal@dpsgn.edu.in

Agent: Thank you! I'll also include our school project portfolio so you can see similar installations we've done. Is there anything else you'd like to know?

Customer: No, that covers everything for now.

Agent: Perfect! Thank you for considering GameChanger. I'll follow up with the email shortly. Have a great day!
`,

  // Poor quality call - missed opportunities
  poorCall: `
Agent: Hello?

Customer: Hi, I'm calling about getting a basketball court installed.

Agent: Okay. What do you need?

Customer: We're a residential society in Bangalore. We have some space and want to build a basketball court.

Agent: Sure. How much space?

Customer: I think around 600 square meters.

Agent: Okay, that's enough for a basketball court.

Customer: What would it cost?

Agent: It depends. Maybe 15-20 lakhs.

Customer: That seems expensive. Is there any cheaper option?

Agent: We can use different materials I guess.

Customer: What materials do you recommend?

Agent: Acrylic is standard. Or you can go with concrete.

Customer: How long would it take?

Agent: Few weeks probably.

Customer: Can you send me a quote?

Agent: Sure. What's your email?

Customer: info@parkview.com

Agent: Okay, I'll send it.

Customer: When can I expect it?

Agent: Maybe in a day or two.

Customer: Alright, thanks.

Agent: Okay bye.
`,

  // Medium quality call - some room for improvement
  mediumCall: `
Agent: Hello, GameChanger Sports. Priya speaking.

Customer: Hi, I'm from a sports academy in Chennai. We need a multi-sport facility.

Agent: Sure, I can help with that. What sports are you looking at?

Customer: Mainly badminton and table tennis. Maybe volleyball too.

Agent: Okay. For badminton, we typically recommend wooden flooring or synthetic courts. For table tennis, we can set up dedicated rooms with proper flooring. What's your total area?

Customer: We have about 5000 square feet indoor.

Agent: That's a decent size. You could fit maybe 4 badminton courts and a separate area for table tennis. For volleyball, you'd need outdoor space or a higher ceiling area.

Customer: What would be the approximate cost?

Agent: For 4 badminton courts with BWF certified flooring, you're looking at around 25-30 lakhs. Table tennis setup would be additional, maybe 5-8 lakhs depending on the number of tables.

Customer: That's quite a lot. Can you give us a discount?

Agent: We can definitely discuss pricing when we understand the full scope. I'd suggest we schedule a site visit first. Our team can assess the space and give you a detailed proposal.

Customer: Okay, that makes sense.

Agent: Would next week work for you? I can have our Chennai team come over.

Customer: Sure, any day works.

Agent: Great. I'll coordinate with the team and get back to you with a specific date. Can I have your contact number?

Customer: 9876543210

Agent: Perfect. I'll call you back by tomorrow evening to confirm the visit. Thanks for calling.
`,
};

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(60));
  log(title, "bright");
  console.log("=".repeat(60));
}

async function testOpenRouterConnection() {
  logSection("1. Testing OpenRouter API Connection");

  if (!process.env.OPENROUTER_API_KEY) {
    log("ERROR: OPENROUTER_API_KEY not set in environment", "red");
    log("Please add your OpenRouter API key to .env file", "yellow");
    return false;
  }

  log("API Key found: " + process.env.OPENROUTER_API_KEY.substring(0, 10) + "...", "green");

  try {
    const openRouter = OpenRouter;
    const isAvailable = openRouter.isAvailable();
    log(`Service available: ${isAvailable}`, isAvailable ? "green" : "red");

    if (!isAvailable) {
      return false;
    }

    // Test with a simple prompt
    log("\nTesting API with simple prompt...", "cyan");
    const testResult = await openRouter.analyzeTranscript(
      "Agent: Hello\nCustomer: Hi, I need a basketball court.\nAgent: Sure, we can help.",
      { model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat" }
    );

    log("API Response received successfully!", "green");
    log(`Model used: ${testResult.metadata?.model}`, "cyan");
    log(`Tokens used: ${testResult.metadata?.usage?.totalTokens}`, "cyan");
    log(`Cost: $${testResult.metadata?.cost?.totalCostUSD}`, "cyan");

    return true;
  } catch (error) {
    log(`ERROR: ${error.message}`, "red");
    return false;
  }
}

async function testAnalysisQuality() {
  logSection("2. Testing Analysis Quality");

  const openRouter = OpenRouter;
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

  // Test good call
  log("\n--- Testing GOOD CALL transcript ---", "cyan");
  try {
    const goodResult = await openRouter.analyzeTranscript(sampleTranscripts.goodCall, { model });
    displayAnalysisResult("Good Call", goodResult);

    if (goodResult.overall_score < 70) {
      log("WARNING: Good call scored lower than expected", "yellow");
    } else {
      log("Score is appropriate for a good call", "green");
    }
  } catch (error) {
    log(`ERROR analyzing good call: ${error.message}`, "red");
  }

  // Test poor call
  log("\n--- Testing POOR CALL transcript ---", "cyan");
  try {
    const poorResult = await openRouter.analyzeTranscript(sampleTranscripts.poorCall, { model });
    displayAnalysisResult("Poor Call", poorResult);

    if (poorResult.overall_score > 50) {
      log("WARNING: Poor call scored higher than expected", "yellow");
    } else {
      log("Score is appropriate for a poor call", "green");
    }
  } catch (error) {
    log(`ERROR analyzing poor call: ${error.message}`, "red");
  }

  // Test medium call
  log("\n--- Testing MEDIUM CALL transcript ---", "cyan");
  try {
    const mediumResult = await openRouter.analyzeTranscript(sampleTranscripts.mediumCall, { model });
    displayAnalysisResult("Medium Call", mediumResult);

    if (mediumResult.overall_score >= 50 && mediumResult.overall_score <= 75) {
      log("Score is appropriate for a medium quality call", "green");
    } else {
      log("Score may not reflect call quality accurately", "yellow");
    }
  } catch (error) {
    log(`ERROR analyzing medium call: ${error.message}`, "red");
  }
}

function displayAnalysisResult(label, result) {
  log(`\n${label} Analysis:`, "bright");
  log(`  Overall Score: ${result.overall_score}/100`, result.overall_score >= 70 ? "green" : result.overall_score >= 50 ? "yellow" : "red");
  log(`  Sentiment: ${result.sentiment}`, "cyan");
  log(`  Customer Interest: ${result.customer_interest_level || "N/A"}`, "cyan");
  log(`  Follow-up Priority: ${result.follow_up_priority || "N/A"}`, "cyan");

  if (result.category_scores) {
    log("\n  Category Scores:", "bright");
    for (const [category, data] of Object.entries(result.category_scores)) {
      const score = data.score || data;
      const scoreColor = score >= 70 ? "green" : score >= 50 ? "yellow" : "red";
      log(`    ${category}: ${score}/100`, scoreColor);
    }
  }

  if (result.issues && result.issues.length > 0) {
    log(`\n  Issues Found: ${result.issues.length}`, "yellow");
    result.issues.slice(0, 3).forEach((issue, i) => {
      log(`    ${i + 1}. [${issue.severity}] ${issue.type}: ${issue.detail}`, "yellow");
    });
  }

  if (result.recommendations && result.recommendations.length > 0) {
    log(`\n  Top Recommendations:`, "cyan");
    result.recommendations.slice(0, 3).forEach((rec, i) => {
      log(`    ${i + 1}. ${rec}`, "cyan");
    });
  }

  log(`\n  Summary: ${result.summary}`, "blue");

  if (result.detected_requirements) {
    log("\n  Detected Requirements:", "bright");
    const reqs = result.detected_requirements;
    if (reqs.facility_type) log(`    Facility: ${reqs.facility_type}`, "cyan");
    if (reqs.budget_mentioned) log(`    Budget: ${reqs.budget_mentioned}`, "cyan");
    if (reqs.timeline) log(`    Timeline: ${reqs.timeline}`, "cyan");
    if (reqs.location) log(`    Location: ${reqs.location}`, "cyan");
  }
}

async function testModels() {
  logSection("3. Testing Model Selection");

  const recommended = Analysis.getRecommendedModels();

  log("\nRecommended Models:", "bright");

  log("\n  FREE TIER:", "green");
  recommended.free.forEach((m) => {
    log(`    - ${m.id}: ${m.description}`, "cyan");
  });

  log("\n  BUDGET TIER:", "yellow");
  recommended.budget.forEach((m) => {
    log(`    - ${m.id}: ${m.description}`, "cyan");
  });

  log("\n  PREMIUM TIER:", "red");
  recommended.premium.forEach((m) => {
    log(`    - ${m.id}: ${m.description}`, "cyan");
  });

  log(`\nCurrent model: ${process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat"}`, "bright");
}

async function testScoreThresholds() {
  logSection("4. Testing Score Thresholds");

  const config = require("../src/config");
  const thresholds = config.scoring.thresholds;

  log("\nConfigured Thresholds:", "bright");
  log(`  Alert (poor): < ${thresholds.alert}`, "red");
  log(`  Good: >= ${thresholds.good}`, "green");
  log(`  Excellent: >= ${thresholds.excellent}`, "cyan");

  // Test classification
  const testScores = [30, 50, 65, 75, 90];
  log("\nScore Classifications:", "bright");
  testScores.forEach((score) => {
    const classification = Analysis.getScoreClassification(score);
    const color = classification === "excellent" ? "cyan" : classification === "good" ? "green" : classification === "needs_improvement" ? "yellow" : "red";
    log(`  Score ${score} → ${classification}`, color);
  });
}

async function runTests() {
  log("\n" + "=".repeat(60), "bright");
  log("    AI ANALYSIS ENGINE - TEST SUITE", "bright");
  log("    Sports Infrastructure Sales Call QC", "cyan");
  log("=".repeat(60) + "\n", "bright");

  // Run tests
  const connectionOk = await testOpenRouterConnection();

  if (!connectionOk) {
    log("\nSkipping further tests due to connection failure", "red");
    log("\nTo run tests:", "yellow");
    log("  1. Sign up at https://openrouter.ai", "cyan");
    log("  2. Get your API key from https://openrouter.ai/keys", "cyan");
    log("  3. Add to .env: OPENROUTER_API_KEY=your_key_here", "cyan");
    log("  4. Run: npm run analysis:test", "cyan");
    return;
  }

  await testModels();
  await testScoreThresholds();
  await testAnalysisQuality();

  logSection("TEST SUMMARY");
  log("\nAll tests completed!", "green");
  log("\nNext steps:", "bright");
  log("  1. Test with real call recordings", "cyan");
  log("  2. Adjust scoring thresholds as needed", "cyan");
  log("  3. Fine-tune prompts for your specific use case", "cyan");
}

// Run the tests
runTests().catch(console.error);
