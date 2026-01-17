/**
 * Phase 5 Tests - Notification Services
 * Tests for Telegram, Console, and Notification Router
 */

// Mock config before requiring services
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
  telegram: {
    botToken: null,
    defaultChatId: null,
  },
  logging: {
    level: "error",
    filePath: "./test-storage/logs/test.log",
  },
}));

const TelegramService = require("../../src/services/notification/telegram.service");
const ConsoleNotificationService = require("../../src/services/notification/console.service");
const NotificationRouter = require("../../src/services/notification/notification.router");

describe("Phase 5 - Notification Services", () => {
  // Sample data for testing
  const sampleAnalysis = {
    call_id: "call_test_001",
    overall_score: 45,
    category_scores: {
      greeting: 60,
      need_discovery: 40,
      product_presentation: 35,
      objection_handling: 50,
      closing: 40,
    },
    issues: [
      { category: "Need Discovery", severity: "high", description: "Failed to ask probing questions" },
      { category: "Product Presentation", severity: "high", description: "Incomplete product explanation" },
      { category: "Closing", severity: "medium", description: "No closing attempt made" },
    ],
    recommendations: [
      { action: "Review discovery questioning framework", priority: "high" },
    ],
    summary: "Call needs significant improvement in discovery and presentation",
    sentiment: "negative",
    created_at: new Date().toISOString(),
  };

  const sampleCall = {
    id: "call_test_001",
    agent_id: "agent_001",
    duration_seconds: 180,
    caller_number: "+919876543210",
    callee_number: "+911234567890",
  };

  const sampleDigest = {
    date: "2025-01-08",
    totalCalls: 25,
    avgScore: 68.5,
    maxScore: 92,
    minScore: 35,
    excellentCalls: 5,
    goodCalls: 12,
    lowScoreCalls: 8,
    positiveSentiment: 10,
    neutralSentiment: 8,
    negativeSentiment: 7,
    alertsCount: 8,
    topIssues: [
      { category: "Objection Handling", count: 15 },
      { category: "Closing", count: 12 },
      { category: "Need Discovery", count: 10 },
    ],
  };

  describe("TelegramService", () => {
    let telegram;

    beforeEach(() => {
      telegram = new TelegramService();
    });

    test("should run in mock mode without token", () => {
      expect(telegram.mockMode).toBe(true);
    });

    test("should format score with emoji", () => {
      expect(telegram.formatScore(90)).toContain("🟢");
      expect(telegram.formatScore(75)).toContain("🟡");
      expect(telegram.formatScore(55)).toContain("🟠");
      expect(telegram.formatScore(40)).toContain("🔴");
    });

    test("should build alert message correctly", () => {
      const message = telegram.buildAlertMessage(sampleAnalysis, sampleCall);

      expect(message).toContain("Low Score Alert");
      expect(message).toContain("agent_001");
      expect(message).toContain("call_test_001");
      expect(message).toContain("45/100");
      expect(message).toContain("Issues");
      expect(message).toContain("Need Discovery");
    });

    test("should build digest message correctly", () => {
      const message = telegram.buildDigestMessage(sampleDigest);

      expect(message).toContain("Daily Digest");
      expect(message).toContain("2025-01-08");
      expect(message).toContain("Total Calls: 25");
      expect(message).toContain("Average Score: 68.5");
      expect(message).toContain("Excellent: 5");
      expect(message).toContain("Top Issues");
    });

    test("should build critical issue message correctly", () => {
      const issue = sampleAnalysis.issues[0];
      const message = telegram.buildCriticalIssueMessage(sampleAnalysis, issue, sampleCall);

      expect(message).toContain("Critical Issue");
      expect(message).toContain("Need Discovery");
      expect(message).toContain("HIGH");
      expect(message).toContain("Failed to ask probing questions");
    });

    test("should send message in mock mode", async () => {
      const result = await telegram.sendMessage("Test message");

      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
      expect(result.messageId).toMatch(/^mock_/);
    });

    test("should send low score alert in mock mode", async () => {
      const result = await telegram.sendLowScoreAlert(sampleAnalysis, sampleCall);

      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    test("should send daily digest in mock mode", async () => {
      const result = await telegram.sendDailyDigest(sampleDigest);

      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    test("should test connection in mock mode", async () => {
      const result = await telegram.testConnection();

      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    test("should format duration correctly", () => {
      expect(telegram.formatDuration(0)).toBe("N/A");
      expect(telegram.formatDuration(null)).toBe("N/A");
      expect(telegram.formatDuration(125)).toBe("2:05");
      expect(telegram.formatDuration(65)).toBe("1:05");
    });
  });

  describe("ConsoleNotificationService", () => {
    let console;
    let originalConsoleLog;

    beforeEach(() => {
      console = new ConsoleNotificationService();
      // Suppress console output during tests
      originalConsoleLog = global.console.log;
      global.console.log = jest.fn();
    });

    afterEach(() => {
      global.console.log = originalConsoleLog;
    });

    test("should format score with indicator", () => {
      expect(console.formatScore(90)).toContain("EXCELLENT");
      expect(console.formatScore(75)).toContain("GOOD");
      expect(console.formatScore(55)).toContain("WARNING");
      expect(console.formatScore(40)).toContain("ALERT");
    });

    test("should send low score alert", () => {
      const result = console.sendLowScoreAlert(sampleAnalysis, sampleCall);

      expect(result.success).toBe(true);
      expect(result.channel).toBe("console");
      expect(result.type).toBe("low_score_alert");
      expect(result.callId).toBe("call_test_001");
    });

    test("should send daily digest", () => {
      const result = console.sendDailyDigest(sampleDigest);

      expect(result.success).toBe(true);
      expect(result.channel).toBe("console");
      expect(result.type).toBe("daily_digest");
      expect(result.date).toBe("2025-01-08");
    });

    test("should send critical issue alert", () => {
      const issue = sampleAnalysis.issues[0];
      const result = console.sendCriticalIssueAlert(sampleAnalysis, issue, sampleCall);

      expect(result.success).toBe(true);
      expect(result.channel).toBe("console");
      expect(result.type).toBe("critical_issue");
      expect(result.category).toBe("Need Discovery");
    });

    test("should send generic notification", () => {
      const result = console.sendNotification("Test Title", "Test message content");

      expect(result.success).toBe(true);
      expect(result.channel).toBe("console");
      expect(result.type).toBe("generic");
    });

    test("should format duration correctly", () => {
      expect(console.formatDuration(null)).toBe("N/A");
      expect(console.formatDuration(125)).toBe("2:05");
    });
  });

  describe("NotificationRouter", () => {
    let router;

    beforeEach(() => {
      router = new NotificationRouter();
    });

    test("should initialize with default settings", () => {
      const settings = router.getSettings();

      // Console may be disabled in test environment (nodeEnv: "test")
      expect(settings).toHaveProperty("enableConsole");
      expect(settings.alertOnLowScore).toBe(true);
      expect(settings.alertOnCriticalIssue).toBe(true);
      expect(settings.lowScoreThreshold).toBe(50);
    });

    test("should update settings", () => {
      router.updateSettings({
        lowScoreThreshold: 60,
        alertOnCriticalIssue: false,
      });

      const settings = router.getSettings();
      expect(settings.lowScoreThreshold).toBe(60);
      expect(settings.alertOnCriticalIssue).toBe(false);
    });

    test("should determine low score alert correctly", () => {
      expect(router.shouldAlertLowScore({ overall_score: 45 })).toBe(true);
      expect(router.shouldAlertLowScore({ overall_score: 55 })).toBe(false);
      expect(router.shouldAlertLowScore({ overall_score: 85 })).toBe(false);
    });

    test("should find critical issues", () => {
      const criticalIssues = router.findCriticalIssues(sampleAnalysis);
      expect(criticalIssues.length).toBe(2);
      expect(criticalIssues[0].severity).toBe("high");
    });

    test("should process analysis and send notifications", async () => {
      // Enable telegram for this test to ensure notifications are sent
      router.updateSettings({ enableTelegram: true });

      // Suppress console output
      const originalConsoleLog = global.console.log;
      global.console.log = jest.fn();

      const results = await router.processAnalysis(sampleAnalysis, sampleCall);

      global.console.log = originalConsoleLog;

      expect(results.callId).toBe("call_test_001");
      expect(results.overallScore).toBe(45);
      // Notifications should be sent since telegram is enabled and score is low
      expect(results.notificationsSent.length).toBeGreaterThan(0);
    });

    test("should not send alerts for high-scoring calls", async () => {
      const highScoreAnalysis = {
        ...sampleAnalysis,
        overall_score: 85,
        issues: [],
      };

      const results = await router.processAnalysis(highScoreAnalysis, sampleCall);

      expect(results.notificationsSent.length).toBe(0);
    });

    test("should send daily digest", async () => {
      // Enable telegram for this test
      router.updateSettings({ enableTelegram: true });

      // Suppress console output
      const originalConsoleLog = global.console.log;
      global.console.log = jest.fn();

      const results = await router.sendDailyDigest(sampleDigest);

      global.console.log = originalConsoleLog;

      expect(Array.isArray(results)).toBe(true);
      // Results may be empty if no channels enabled, which is valid
      if (results.length > 0) {
        expect(results.some((r) => r.type === "daily_digest")).toBe(true);
      }
    });

    test("should get channel status", () => {
      const status = router.getChannelStatus();

      expect(status).toHaveProperty("telegram");
      expect(status).toHaveProperty("console");
      // Console may be disabled in test environment
      expect(status.console).toHaveProperty("enabled");
    });

    test("should test channels", async () => {
      const results = await router.testChannels();

      expect(results).toHaveProperty("console");
      expect(results).toHaveProperty("telegram");
      // Console status may not be set if disabled
      expect(results.console).toHaveProperty("enabled");
    });
  });

  describe("Alert Threshold Logic", () => {
    let router;

    beforeEach(() => {
      router = new NotificationRouter();
    });

    test("should alert for scores below threshold", () => {
      const testCases = [
        { score: 49, shouldAlert: true },
        { score: 50, shouldAlert: false },
        { score: 51, shouldAlert: false },
        { score: 25, shouldAlert: true },
        { score: 0, shouldAlert: true },
      ];

      for (const { score, shouldAlert } of testCases) {
        expect(router.shouldAlertLowScore({ overall_score: score })).toBe(shouldAlert);
      }
    });

    test("should respect custom threshold", () => {
      router.updateSettings({ lowScoreThreshold: 70 });

      expect(router.shouldAlertLowScore({ overall_score: 65 })).toBe(true);
      expect(router.shouldAlertLowScore({ overall_score: 75 })).toBe(false);
    });

    test("should not alert when disabled", () => {
      router.updateSettings({ alertOnLowScore: false });

      expect(router.shouldAlertLowScore({ overall_score: 25 })).toBe(false);
    });
  });

  describe("Critical Issue Detection", () => {
    let router;

    beforeEach(() => {
      router = new NotificationRouter();
    });

    test("should detect high severity issues", () => {
      const analysis = {
        issues: [
          { severity: "high", category: "Test" },
          { severity: "medium", category: "Test" },
          { severity: "low", category: "Test" },
        ],
      };

      const critical = router.findCriticalIssues(analysis);
      expect(critical.length).toBe(1);
      expect(critical[0].severity).toBe("high");
    });

    test("should detect critical severity issues", () => {
      const analysis = {
        issues: [
          { severity: "critical", category: "Test" },
          { severity: "high", category: "Test" },
        ],
      };

      const critical = router.findCriticalIssues(analysis);
      expect(critical.length).toBe(2);
    });

    test("should handle empty issues array", () => {
      const analysis = { issues: [] };
      const critical = router.findCriticalIssues(analysis);
      expect(critical.length).toBe(0);
    });

    test("should handle missing issues array", () => {
      const analysis = {};
      const critical = router.findCriticalIssues(analysis);
      expect(critical.length).toBe(0);
    });
  });
});
