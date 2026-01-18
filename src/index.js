#!/usr/bin/env node

/**
 * AI Sales Call QC - Main Application Server
 * Express.js server with middleware and routes
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const config = require("./config");
const logger = require("./utils/logger");
const { expressErrorHandler, NotFoundError } = require("./utils/error-handler");

// Create Express application
const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com"] // Add your production domains
        : true, // Allow all in development
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
} else {
  app.use(logger.request);
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: require("../package.json").version,
  });
});

// Detailed health check
app.get("/health/detailed", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {},
  };

  try {
    // Check database connection
    const Database = require("better-sqlite3");
    const db = new Database(config.database.path, { readonly: true });
    db.exec("SELECT 1");
    db.close();
    health.services.database = "ok";
  } catch (error) {
    health.services.database = "error";
    health.status = "degraded";
    logger.error("Database health check failed:", error);
  }

  try {
    // Check Redis connection
    const Redis = require("ioredis");
    const redis = new Redis(config.redis);
    await redis.ping();
    await redis.quit();
    health.services.redis = "ok";
  } catch (error) {
    health.services.redis = "error";
    health.status = "degraded";
    logger.error("Redis health check failed:", error);
  }

  // Check OpenRouter (analysis) service
  try {
    const { Analysis } = require("./services");
    health.services.openrouter = Analysis.isAvailable() ? "ok" : "not_configured";
    if (!Analysis.isAvailable()) {
      health.warnings = health.warnings || [];
      health.warnings.push("OpenRouter API not configured - analysis service unavailable");
    }
  } catch (error) {
    health.services.openrouter = "error";
    logger.error("OpenRouter health check failed:", error);
  }

  // Set HTTP status based on overall health
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Webhook routes
app.use("/webhook", require("./routes/webhook.routes"));

// Analysis routes (Phase 4)
app.use("/api", require("./routes/analysis.routes"));

// Phase 5 routes - Output & Notification Layer
app.use("/api/reports", require("./routes/report.routes"));
app.use("/api/export", require("./routes/export.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));

// API routes info
app.get("/api", (req, res) => {
  res.json({
    message: "AI Sales Call QC API - Sports Infrastructure Sales",
    version: require("../package.json").version,
    endpoints: {
      health: "/health",
      detailedHealth: "/health/detailed",
      webhooks: {
        exotel: "/webhook/exotel",
        mockWebhook: "/webhook/exotel/mock",
      },
      analysis: {
        getAnalysis: "GET /api/calls/:callId/analysis",
        triggerAnalysis: "POST /api/calls/:callId/analyze",
        reanalyze: "POST /api/calls/:callId/reanalyze",
        report: "GET /api/calls/:callId/report",
        listAll: "GET /api/analyses",
        alerts: "GET /api/analyses/alerts",
        statistics: "GET /api/analyses/statistics",
        models: "GET /api/analyses/models",
      },
      reports: {
        daily: "GET /api/reports/daily",
        weekly: "GET /api/reports/weekly",
        trends: "GET /api/reports/trends",
        sendDigest: "POST /api/reports/daily/send",
        agentReport: "GET /api/reports/agent/:agentId",
      },
      export: {
        csv: "POST /api/export/csv",
        excel: "POST /api/export/excel",
        dailyReport: "POST /api/export/daily-report",
        download: "GET /api/export/download/:filename",
        listFiles: "GET /api/export/files",
        deleteFile: "DELETE /api/export/files/:filename",
      },
      notifications: {
        list: "GET /api/notifications",
        statistics: "GET /api/notifications/statistics",
        channels: "GET /api/notifications/channels",
        test: "POST /api/notifications/test",
        send: "POST /api/notifications/send",
        settings: "PUT /api/notifications/settings",
        preferences: "GET/PUT /api/notifications/preferences/:userId",
      },
    },
  });
});

// Serve API documentation
app.use("/api-docs", express.static(path.join(__dirname, "..", "docs")));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Serve frontend for root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Dashboard route alias
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// 404 handler
app.use((req, res, next) => {
  next(new NotFoundError("Route", `${req.method} ${req.path}`));
});

// Global error handler - uses centralized error handling
app.use(expressErrorHandler);

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start server
const server = app.listen(config.port, config.host, () => {
  logger.info(`🚀 Server running on http://${config.host}:${config.port}`);
  logger.info(`📊 Environment: ${config.nodeEnv}`);
  logger.info(`📈 Dashboard: http://${config.host}:${config.port}/dashboard`);
  logger.info(`🏥 Health check: http://${config.host}:${config.port}/health`);
  logger.info(`📋 API info: http://${config.host}:${config.port}/api`);
  logger.info(`📚 API docs: http://${config.host}:${config.port}/api-docs/api-docs.html`);
});

// Handle server errors
server.on("error", (error) => {
  logger.error("Server failed to start:", error);
  process.exit(1);
});

module.exports = app;
