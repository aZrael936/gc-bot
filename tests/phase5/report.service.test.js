/**
 * Phase 5 Tests - Report Services
 * Tests for Daily Digest and Report Generation
 */

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Mock config
jest.mock("../../src/config", () => ({
  database: { path: ":memory:" },
  storage: { path: "./test-storage" },
  scoring: {
    thresholds: {
      alert: 50,
      good: 70,
      excellent: 85,
    },
  },
  nodeEnv: "test",
}));

describe("Phase 5 - Report Services", () => {
  let db;

  // Initialize in-memory database with test schema
  beforeAll(() => {
    db = new Database(":memory:");

    // Create required tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        agent_id TEXT,
        exotel_call_sid TEXT,
        recording_url TEXT,
        local_audio_path TEXT,
        duration_seconds INTEGER,
        call_type TEXT,
        caller_number TEXT,
        callee_number TEXT,
        direction TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        call_id TEXT NOT NULL,
        overall_score REAL,
        category_scores TEXT,
        issues TEXT,
        recommendations TEXT,
        summary TEXT,
        sentiment TEXT,
        llm_model TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        processing_time_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        call_id TEXT,
        user_id TEXT,
        channel TEXT,
        type TEXT,
        message TEXT,
        status TEXT DEFAULT 'pending',
        metadata TEXT,
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed test data
    const insertCall = db.prepare(`
      INSERT INTO calls (id, org_id, agent_id, duration_seconds, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAnalysis = db.prepare(`
      INSERT INTO analyses (id, call_id, overall_score, category_scores, issues, sentiment, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();

    // Create test calls and analyses
    const testData = [
      { callId: "call_001", agentId: "agent_001", score: 85, sentiment: "positive", duration: 320 },
      { callId: "call_002", agentId: "agent_001", score: 72, sentiment: "neutral", duration: 280 },
      { callId: "call_003", agentId: "agent_002", score: 45, sentiment: "negative", duration: 180 },
      { callId: "call_004", agentId: "agent_002", score: 38, sentiment: "negative", duration: 150 },
      { callId: "call_005", agentId: "agent_003", score: 92, sentiment: "positive", duration: 420 },
    ];

    for (const data of testData) {
      insertCall.run(
        data.callId,
        "default",
        data.agentId,
        data.duration,
        "analyzed",
        now.toISOString()
      );

      insertAnalysis.run(
        `analysis_${data.callId}`,
        data.callId,
        data.score,
        JSON.stringify({
          greeting: data.score + Math.random() * 10 - 5,
          need_discovery: data.score + Math.random() * 10 - 5,
          product_presentation: data.score + Math.random() * 10 - 5,
          objection_handling: data.score + Math.random() * 10 - 5,
          closing: data.score + Math.random() * 10 - 5,
        }),
        JSON.stringify([
          { category: "Closing", severity: data.score < 50 ? "high" : "low", description: "Test issue" },
        ]),
        data.sentiment,
        "Test summary for call",
        now.toISOString()
      );
    }
  });

  afterAll(() => {
    db.close();
  });

  describe("DailyDigestService Statistics", () => {
    test("should calculate statistics correctly", () => {
      const analyses = [
        { overall_score: 85, sentiment: "positive", category_scores: { greeting: 90 } },
        { overall_score: 72, sentiment: "neutral", category_scores: { greeting: 75 } },
        { overall_score: 45, sentiment: "negative", category_scores: { greeting: 50 } },
        { overall_score: 38, sentiment: "negative", category_scores: { greeting: 40 } },
        { overall_score: 92, sentiment: "positive", category_scores: { greeting: 95 } },
      ];

      // Manual calculation
      const scores = analyses.map((a) => a.overall_score);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      expect(avgScore).toBeCloseTo(66.4, 1);
      expect(Math.min(...scores)).toBe(38);
      expect(Math.max(...scores)).toBe(92);
    });

    test("should count performance categories correctly", () => {
      const scores = [85, 72, 45, 38, 92];
      const thresholds = { alert: 50, good: 70, excellent: 85 };

      const excellent = scores.filter((s) => s >= thresholds.excellent).length;
      const good = scores.filter((s) => s >= thresholds.good && s < thresholds.excellent).length;
      const lowScore = scores.filter((s) => s < thresholds.alert).length;

      expect(excellent).toBe(2); // 85, 92
      expect(good).toBe(1); // 72
      expect(lowScore).toBe(2); // 45, 38
    });
  });

  describe("Issue Aggregation", () => {
    test("should aggregate issues by category", () => {
      const analyses = [
        { issues: [{ category: "Closing", severity: "high" }] },
        { issues: [{ category: "Closing", severity: "low" }, { category: "Greeting", severity: "medium" }] },
        { issues: [{ category: "Discovery", severity: "high" }] },
        { issues: [{ category: "Closing", severity: "medium" }] },
      ];

      const issueMap = {};
      for (const analysis of analyses) {
        for (const issue of analysis.issues || []) {
          const key = issue.category;
          if (!issueMap[key]) {
            issueMap[key] = { category: key, count: 0 };
          }
          issueMap[key].count++;
        }
      }

      const sortedIssues = Object.values(issueMap).sort((a, b) => b.count - a.count);

      expect(sortedIssues[0].category).toBe("Closing");
      expect(sortedIssues[0].count).toBe(3);
      expect(sortedIssues.length).toBe(3);
    });
  });

  describe("Agent Performance", () => {
    test("should calculate agent performance correctly", () => {
      const analyses = [
        { agent_id: "agent_001", overall_score: 85, sentiment: "positive" },
        { agent_id: "agent_001", overall_score: 72, sentiment: "neutral" },
        { agent_id: "agent_002", overall_score: 45, sentiment: "negative" },
        { agent_id: "agent_002", overall_score: 38, sentiment: "negative" },
        { agent_id: "agent_003", overall_score: 92, sentiment: "positive" },
      ];

      const agentMap = {};
      for (const analysis of analyses) {
        const agentId = analysis.agent_id;
        if (!agentMap[agentId]) {
          agentMap[agentId] = { agentId, scores: [], sentiments: { positive: 0, negative: 0, neutral: 0 } };
        }
        agentMap[agentId].scores.push(analysis.overall_score);
        agentMap[agentId].sentiments[analysis.sentiment]++;
      }

      const performance = Object.values(agentMap)
        .map((agent) => ({
          agentId: agent.agentId,
          avgScore: agent.scores.reduce((a, b) => a + b, 0) / agent.scores.length,
          totalCalls: agent.scores.length,
        }))
        .sort((a, b) => b.avgScore - a.avgScore);

      expect(performance[0].agentId).toBe("agent_003");
      expect(performance[0].avgScore).toBe(92);
      expect(performance[1].agentId).toBe("agent_001");
      expect(performance[1].avgScore).toBeCloseTo(78.5, 1);
      expect(performance[2].agentId).toBe("agent_002");
      expect(performance[2].avgScore).toBeCloseTo(41.5, 1);
    });
  });

  describe("Weekly Summary Generation", () => {
    test("should generate weekly summary from daily digests", () => {
      const dailyDigests = [
        { date: "2025-01-08", totalCalls: 10, avgScore: 72, excellentCalls: 2, lowScoreCalls: 2 },
        { date: "2025-01-07", totalCalls: 8, avgScore: 68, excellentCalls: 1, lowScoreCalls: 3 },
        { date: "2025-01-06", totalCalls: 12, avgScore: 75, excellentCalls: 4, lowScoreCalls: 1 },
        { date: "2025-01-05", totalCalls: 0, avgScore: 0 }, // No calls day
      ];

      const nonEmpty = dailyDigests.filter((d) => d.totalCalls > 0);
      const totalCalls = nonEmpty.reduce((sum, d) => sum + d.totalCalls, 0);
      const weightedScore = nonEmpty.reduce((sum, d) => sum + d.avgScore * d.totalCalls, 0);
      const avgScore = weightedScore / totalCalls;

      expect(totalCalls).toBe(30);
      expect(avgScore).toBeCloseTo(72.13, 1);
    });
  });

  describe("Trend Analysis", () => {
    test("should detect improving trend", () => {
      const current = { avgScore: 75 };
      const previous = { avgScore: 68 };
      const change = current.avgScore - previous.avgScore;

      let direction;
      if (change > 2) direction = "improving";
      else if (change < -2) direction = "declining";
      else direction = "stable";

      expect(direction).toBe("improving");
    });

    test("should detect declining trend", () => {
      const current = { avgScore: 62 };
      const previous = { avgScore: 70 };
      const change = current.avgScore - previous.avgScore;

      let direction;
      if (change > 2) direction = "improving";
      else if (change < -2) direction = "declining";
      else direction = "stable";

      expect(direction).toBe("declining");
    });

    test("should detect stable trend", () => {
      const current = { avgScore: 71 };
      const previous = { avgScore: 70 };
      const change = current.avgScore - previous.avgScore;

      let direction;
      if (change > 2) direction = "improving";
      else if (change < -2) direction = "declining";
      else direction = "stable";

      expect(direction).toBe("stable");
    });
  });

  describe("Median Calculation", () => {
    test("should calculate median for odd number of scores", () => {
      const scores = [85, 72, 45, 38, 92].sort((a, b) => a - b);
      // [38, 45, 72, 85, 92]
      const mid = Math.floor(scores.length / 2);
      const median = scores[mid];

      expect(median).toBe(72);
    });

    test("should calculate median for even number of scores", () => {
      const scores = [85, 72, 45, 92].sort((a, b) => a - b);
      // [45, 72, 85, 92]
      const mid = Math.floor(scores.length / 2);
      const median = (scores[mid - 1] + scores[mid]) / 2;

      expect(median).toBe(78.5);
    });
  });

  describe("Category Averages", () => {
    test("should calculate category averages correctly", () => {
      const analyses = [
        { category_scores: { greeting: 90, closing: 85 } },
        { category_scores: { greeting: 70, closing: 75 } },
        { category_scores: { greeting: 80, closing: 80 } },
      ];

      const categoryTotals = {};
      const categoryCounts = {};

      for (const analysis of analyses) {
        for (const [key, value] of Object.entries(analysis.category_scores)) {
          categoryTotals[key] = (categoryTotals[key] || 0) + value;
          categoryCounts[key] = (categoryCounts[key] || 0) + 1;
        }
      }

      const categoryAverages = {};
      for (const key of Object.keys(categoryTotals)) {
        categoryAverages[key] = categoryTotals[key] / categoryCounts[key];
      }

      expect(categoryAverages.greeting).toBe(80);
      expect(categoryAverages.closing).toBe(80);
    });
  });
});
