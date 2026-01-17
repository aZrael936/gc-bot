/**
 * Phase 5 Tests - Export Services
 * Tests for CSV and Excel export functionality
 */

const path = require("path");
const fs = require("fs");

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
  logging: {
    level: "error",
    filePath: "./test-storage/logs/test.log",
  },
}));

const CsvExportService = require("../../src/services/export/csv.export.service");
const ExcelExportService = require("../../src/services/export/excel.export.service");

describe("Phase 5 - Export Services", () => {
  let csvExport;
  let excelExport;
  const testExportDir = "./test-storage/exports";

  // Sample analysis data for testing
  const sampleAnalyses = [
    {
      call_id: "call_001",
      agent_id: "agent_001",
      overall_score: 85,
      category_scores: {
        greeting: 90,
        need_discovery: 80,
        product_presentation: 85,
        objection_handling: 82,
        closing: 88,
      },
      issues: [
        { category: "Closing", severity: "low", description: "Could be more assertive" },
      ],
      recommendations: [
        { action: "Practice closing techniques", priority: "medium" },
      ],
      summary: "Good call with strong greeting and product knowledge",
      sentiment: "positive",
      duration_seconds: 320,
      created_at: new Date().toISOString(),
    },
    {
      call_id: "call_002",
      agent_id: "agent_002",
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
        { action: "Study product training materials", priority: "high" },
      ],
      summary: "Call needs significant improvement in discovery and presentation",
      sentiment: "negative",
      duration_seconds: 180,
      created_at: new Date().toISOString(),
    },
    {
      call_id: "call_003",
      agent_id: "agent_001",
      overall_score: 72,
      category_scores: {
        greeting: 75,
        need_discovery: 70,
        product_presentation: 75,
        objection_handling: 68,
        closing: 72,
      },
      issues: [
        { category: "Objection Handling", severity: "medium", description: "Missed opportunity to address price concern" },
      ],
      recommendations: [
        { action: "Review objection handling scripts", priority: "medium" },
      ],
      summary: "Solid performance with room for improvement in objection handling",
      sentiment: "neutral",
      duration_seconds: 420,
      created_at: new Date().toISOString(),
    },
  ];

  beforeAll(() => {
    // Create test export directory
    if (!fs.existsSync(testExportDir)) {
      fs.mkdirSync(testExportDir, { recursive: true });
    }

    csvExport = new CsvExportService();
    excelExport = new ExcelExportService();
  });

  afterAll(() => {
    // Cleanup test files
    if (fs.existsSync(testExportDir)) {
      const files = fs.readdirSync(testExportDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testExportDir, file));
      }
    }
  });

  describe("CsvExportService", () => {
    test("should export analyses to CSV file", async () => {
      const result = await csvExport.exportAnalyses(sampleAnalyses);

      expect(result).toBeDefined();
      expect(result.totalRecords).toBe(3);
      expect(result.filename).toMatch(/\.csv$/);
      expect(result.filePath).toBeDefined();
      expect(fs.existsSync(result.filePath)).toBe(true);
    });

    test("should include all required columns", async () => {
      const result = await csvExport.exportAnalyses(sampleAnalyses);
      const content = fs.readFileSync(result.filePath, "utf-8");

      expect(content).toContain("Call ID");
      expect(content).toContain("Date");
      expect(content).toContain("Overall Score");
      expect(content).toContain("Greeting Score");
      expect(content).toContain("Need Discovery Score");
      expect(content).toContain("Product Presentation Score");
      expect(content).toContain("Objection Handling Score");
      expect(content).toContain("Closing Score");
      expect(content).toContain("Sentiment");
      expect(content).toContain("Issues Count");
    });

    test("should include recommendations when requested", async () => {
      const result = await csvExport.exportAnalyses(sampleAnalyses, {
        includeRecommendations: true,
      });
      const content = fs.readFileSync(result.filePath, "utf-8");

      expect(content).toContain("Recommendations");
    });

    test("should format duration correctly", () => {
      expect(csvExport.formatDuration(0)).toBe("0:00");
      expect(csvExport.formatDuration(65)).toBe("1:05");
      expect(csvExport.formatDuration(320)).toBe("5:20");
      expect(csvExport.formatDuration(null)).toBe("0:00");
    });

    test("should format top issues correctly", () => {
      const issues = [
        { category: "Closing", description: "Issue 1" },
        { category: "Greeting", description: "Issue 2" },
        { category: "Discovery", description: "Issue 3" },
        { category: "Extra", description: "Issue 4" },
      ];

      const formatted = csvExport.formatTopIssues(issues, 3);
      expect(formatted).toContain("[Closing] Issue 1");
      expect(formatted).toContain("[Greeting] Issue 2");
      expect(formatted).toContain("[Discovery] Issue 3");
      expect(formatted).not.toContain("Issue 4");
    });

    test("should handle empty issues list", () => {
      expect(csvExport.formatTopIssues([])).toBe("None");
      expect(csvExport.formatTopIssues(null)).toBe("None");
    });

    test("should list export files", async () => {
      await csvExport.exportAnalyses(sampleAnalyses);
      const files = csvExport.getExportFiles();

      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toHaveProperty("filename");
      expect(files[0]).toHaveProperty("size");
      expect(files[0]).toHaveProperty("createdAt");
    });
  });

  describe("ExcelExportService", () => {
    test("should export analyses to Excel file", async () => {
      const result = await excelExport.exportAnalyses(sampleAnalyses);

      expect(result).toBeDefined();
      expect(result.totalRecords).toBe(3);
      expect(result.filename).toMatch(/\.xlsx$/);
      expect(result.filePath).toBeDefined();
      expect(fs.existsSync(result.filePath)).toBe(true);
    });

    test("should include multiple sheets", async () => {
      const result = await excelExport.exportAnalyses(sampleAnalyses, {
        includeSummary: true,
      });

      expect(result.sheets).toBeDefined();
      expect(result.sheets).toContain("Summary");
      expect(result.sheets).toContain("Call Analyses");
      expect(result.sheets).toContain("Issues Breakdown");
    });

    test("should get correct score color", () => {
      const excellent = excelExport.getScoreColor(90);
      expect(excellent.fgColor.argb).toBe("FF90EE90"); // Light green

      const good = excelExport.getScoreColor(75);
      expect(good.fgColor.argb).toBe("FFFFFFE0"); // Light yellow

      const warning = excelExport.getScoreColor(55);
      expect(warning.fgColor.argb).toBe("FFFFA500"); // Orange

      const alert = excelExport.getScoreColor(40);
      expect(alert.fgColor.argb).toBe("FFFF6B6B"); // Light red
    });

    test("should format duration correctly", () => {
      expect(excelExport.formatDuration(0)).toBe("0:00");
      expect(excelExport.formatDuration(125)).toBe("2:05");
      expect(excelExport.formatDuration(null)).toBe("0:00");
    });

    test("should list export files", async () => {
      await excelExport.exportAnalyses(sampleAnalyses);
      const files = excelExport.getExportFiles();

      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0].filename).toMatch(/\.xlsx$/);
    });
  });

  describe("Large Export Handling", () => {
    test("should handle large datasets", async () => {
      // Generate 100 sample records
      const largeDataset = [];
      for (let i = 0; i < 100; i++) {
        largeDataset.push({
          ...sampleAnalyses[i % 3],
          call_id: `call_${i.toString().padStart(4, "0")}`,
          created_at: new Date(Date.now() - i * 60000).toISOString(),
        });
      }

      const csvResult = await csvExport.exportAnalyses(largeDataset);
      expect(csvResult.totalRecords).toBe(100);

      const excelResult = await excelExport.exportAnalyses(largeDataset);
      expect(excelResult.totalRecords).toBe(100);
    });
  });
});
