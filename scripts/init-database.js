#!/usr/bin/env node

/**
 * Database Initialization Script
 * Creates all required tables for the Sales Call QC system
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Get database path from environment or default
const dbPath =
  process.env.DATABASE_PATH || path.join(__dirname, "..", "database", "app.db");

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Initializing database at: ${dbPath}`);

try {
  // Create database connection
  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Create tables in order (respecting foreign key constraints)

  // Organizations (multi-tenant ready)
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Users (agents and managers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT CHECK(role IN ('agent', 'manager', 'admin')) DEFAULT 'agent',
      whatsapp_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id)
    );
  `);

  // Calls
  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      agent_id TEXT,
      exotel_call_sid TEXT UNIQUE,
      recording_url TEXT,
      local_audio_path TEXT,
      duration_seconds INTEGER,
      call_type TEXT,
      caller_number TEXT,
      callee_number TEXT,
      direction TEXT CHECK(direction IN ('incoming', 'outgoing', 'outgoing-dial', 'inbound', 'outbound')),
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id),
      FOREIGN KEY (agent_id) REFERENCES users(id)
    );
  `);

  // Transcripts
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL UNIQUE,
      content TEXT,
      language TEXT,
      speaker_segments TEXT,
      word_count INTEGER,
      stt_provider TEXT,
      processing_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (call_id) REFERENCES calls(id)
    );
  `);

  // Analyses
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL UNIQUE,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (call_id) REFERENCES calls(id)
    );
  `);

  // Notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      call_id TEXT,
      user_id TEXT,
      channel TEXT CHECK(channel IN ('whatsapp', 'email', 'console')),
      message TEXT,
      status TEXT DEFAULT 'pending',
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (call_id) REFERENCES calls(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Job logs for debugging
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_logs (
      id TEXT PRIMARY KEY,
      job_type TEXT,
      job_id TEXT,
      status TEXT,
      input_data TEXT,
      output_data TEXT,
      error_message TEXT,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
    CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
    CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_call_id ON analyses(call_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_overall_score ON analyses(overall_score);
  `);

  // Insert default organization if it doesn't exist
  const defaultOrg = db
    .prepare(
      `
    INSERT OR IGNORE INTO organizations (id, name, settings)
    VALUES (?, ?, ?)
  `
    )
    .run(
      "default",
      "Default Organization",
      JSON.stringify({
        timezone: "Asia/Kolkata",
        scoring_weights: {
          greeting: 0.15,
          need_discovery: 0.25,
          product_presentation: 0.2,
          objection_handling: 0.2,
          closing: 0.2,
        },
      })
    );

  if (defaultOrg.changes > 0) {
    console.log("✓ Created default organization");
  }

  // Insert sample users if they don't exist
  const sampleUsers = [
    {
      id: "agent_001",
      name: "John Doe",
      email: "john@example.com",
      role: "agent",
      whatsapp: "+919876543210",
    },
    {
      id: "manager_001",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "manager",
      whatsapp: "+919876543211",
    },
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, org_id, name, email, role, whatsapp_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const user of sampleUsers) {
    const result = insertUser.run(
      user.id,
      "default",
      user.name,
      user.email,
      user.role,
      user.whatsapp
    );
    if (result.changes > 0) {
      console.log(`✓ Created sample user: ${user.name}`);
    }
  }

  // Close database connection
  db.close();

  console.log("✅ Database initialized successfully!");
  console.log(
    "📊 Tables created: organizations, users, calls, transcripts, analyses, notifications, job_logs"
  );
  console.log("🔍 Indexes created for optimal query performance");
} catch (error) {
  console.error("❌ Database initialization failed:", error.message);
  process.exit(1);
}
