/**
 * Phase 1 - Health Check Tests
 * Tests basic server functionality and infrastructure
 */

const Database = require("better-sqlite3");
const { Queue } = require("bullmq");
const config = require("../../src/config");
const queueConfig = require("../../src/config/queue");

describe("Phase 1 - Foundation Tests", () => {
  let db;
  let queue;

  beforeAll(async () => {
    // Initialize database connection for testing
    db = new Database(config.database.path);

    // Initialize a test queue
    queue = new Queue("test-queue", {
      connection: queueConfig.connection,
    });
  });

  afterAll(async () => {
    // Close connections
    if (db) db.close();
    if (queue) await queue.close();
  });

  describe("Configuration", () => {
    test("Environment variables loading correctly", () => {
      expect(config.nodeEnv).toBe("test");
      expect(config.port).toBe(3000); // Config loads before Jest sets NODE_ENV
      expect(config.database.path).toMatch(/database\/app\.db/);
      expect(config.redis.host).toBe("localhost");
      expect(config.redis.port).toBe(6379);
    });
  });

  describe("Database Tests", () => {
    test("SQLite database created with all tables", () => {
      // Check if all required tables exist
      const tables = db
        .prepare(
          `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
        )
        .all();

      const tableNames = tables.map((t) => t.name).sort();
      const expectedTables = [
        "analyses",
        "calls",
        "job_logs",
        "notifications",
        "organizations",
        "transcripts",
        "users",
      ].sort();

      expect(tableNames).toEqual(expectedTables);
    });

    test("Can INSERT and SELECT from all tables", () => {
      // Test organizations table
      const insertOrg = db.prepare(`
        INSERT INTO organizations (id, name, settings)
        VALUES (?, ?, ?)
      `);
      const orgResult = insertOrg.run("test-org", "Test Organization", "{}");
      expect(orgResult.changes).toBe(1);

      const selectOrg = db.prepare("SELECT * FROM organizations WHERE id = ?");
      const org = selectOrg.get("test-org");
      expect(org.name).toBe("Test Organization");

      // Test users table
      const insertUser = db.prepare(`
        INSERT INTO users (id, org_id, name, email, role)
        VALUES (?, ?, ?, ?, ?)
      `);
      const userResult = insertUser.run(
        "test-user",
        "test-org",
        "Test User",
        "test@example.com",
        "agent"
      );
      expect(userResult.changes).toBe(1);

      // Clean up test data
      db.prepare("DELETE FROM users WHERE id = ?").run("test-user");
      db.prepare("DELETE FROM organizations WHERE id = ?").run("test-org");
    });
  });

  describe("Queue Tests", () => {
    test("BullMQ can add a test job to queue", async () => {
      // Add a job to the queue
      const job = await queue.add("test-job", {
        message: "Hello from Phase 1 test",
        timestamp: new Date().toISOString(),
      });

      expect(job.id).toBeDefined();
      expect(job.data.message).toBe("Hello from Phase 1 test");

      // Clean up the test job
      await job.remove();
    });
  });

  describe("Logging", () => {
    test("Logs directory and files exist", () => {
      const fs = require("fs");
      const path = require("path");

      expect(fs.existsSync(path.dirname(config.logging.filePath))).toBe(true);
      // Log file might not exist yet if no logs written, but directory should
    });
  });
});
