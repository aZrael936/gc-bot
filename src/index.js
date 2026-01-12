#!/usr/bin/env node

/**
 * AI Sales Call QC - Main Application Server
 * Express.js server with middleware and routes
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const config = require("./config");
const logger = require("./utils/logger");

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

  // Set HTTP status based on overall health
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Webhook routes
app.use("/webhook", require("./routes/webhook.routes"));

// API routes placeholder
app.get("/api", (req, res) => {
  res.json({
    message: "AI Sales Call QC API",
    version: require("../package.json").version,
    endpoints: {
      health: "/health",
      detailedHealth: "/health/detailed",
      calls: "/api/calls (coming in Phase 2)",
      webhooks: "/webhook/exotel",
      mockWebhook: "/webhook/exotel/mock",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);

  // Don't leak error details in production
  const isDevelopment = config.nodeEnv === "development";

  res.status(error.status || 500).json({
    error: error.name || "InternalServerError",
    message: isDevelopment ? error.message : "An unexpected error occurred",
    ...(isDevelopment && { stack: error.stack }),
    timestamp: new Date().toISOString(),
  });
});

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
  logger.info(`🏥 Health check: http://${config.host}:${config.port}/health`);
  logger.info(`📋 API info: http://${config.host}:${config.port}/api`);
});

// Handle server errors
server.on("error", (error) => {
  logger.error("Server failed to start:", error);
  process.exit(1);
});

module.exports = app;
