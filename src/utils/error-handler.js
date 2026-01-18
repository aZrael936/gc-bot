/**
 * Global Error Handler
 * Centralized error handling and classification for the application
 */

const logger = require("./logger");

/**
 * Application-specific error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Distinguishes operational errors from programming errors

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp,
      },
    };
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

class NotFoundError extends AppError {
  constructor(resource, identifier = null) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(message, 404, "NOT_FOUND", { resource, identifier });
    this.name = "NotFoundError";
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service, reason = null) {
    const message = reason
      ? `Service unavailable: ${service} - ${reason}`
      : `Service unavailable: ${service}`;
    super(message, 503, "SERVICE_UNAVAILABLE", { service, reason });
    this.name = "ServiceUnavailableError";
  }
}

class ExternalAPIError extends AppError {
  constructor(service, originalError, statusCode = 502) {
    const message = `External API error from ${service}: ${originalError.message}`;
    super(message, statusCode, "EXTERNAL_API_ERROR", {
      service,
      originalMessage: originalError.message,
      originalCode: originalError.code,
    });
    this.name = "ExternalAPIError";
    this.originalError = originalError;
  }
}

class RetryableError extends AppError {
  constructor(message, retryAfter = null, maxRetries = 3) {
    super(message, 503, "RETRYABLE_ERROR", { retryAfter, maxRetries });
    this.name = "RetryableError";
    this.retryAfter = retryAfter;
    this.maxRetries = maxRetries;
  }
}

class RateLimitError extends RetryableError {
  constructor(service, retryAfter = 60) {
    super(`Rate limit exceeded for ${service}`, retryAfter, 3);
    this.name = "RateLimitError";
    this.code = "RATE_LIMIT_EXCEEDED";
    this.details = { service, retryAfter };
  }
}

/**
 * Error classification utilities
 */
const ErrorClassifier = {
  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    // Explicit retryable error
    if (error instanceof RetryableError) return true;

    // Network errors
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") return true;
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") return true;

    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    // Check for rate limit indicators in message
    const rateLimitKeywords = ["rate limit", "too many requests", "throttle"];
    if (rateLimitKeywords.some((kw) => error.message?.toLowerCase().includes(kw))) {
      return true;
    }

    return false;
  },

  /**
   * Check if error is operational (vs programming error)
   */
  isOperational(error) {
    if (error.isOperational !== undefined) return error.isOperational;

    // Known operational error types
    if (error instanceof AppError) return true;
    if (error.name === "ValidationError") return true;

    return false;
  },

  /**
   * Get HTTP status code for error
   */
  getStatusCode(error) {
    if (error.statusCode) return error.statusCode;

    switch (error.name) {
      case "ValidationError":
        return 400;
      case "NotFoundError":
        return 404;
      case "UnauthorizedError":
        return 401;
      case "ForbiddenError":
        return 403;
      case "RateLimitError":
        return 429;
      default:
        return 500;
    }
  },

  /**
   * Classify error by service
   */
  classifyByService(error) {
    const message = error.message?.toLowerCase() || "";

    if (message.includes("elevenlabs") || message.includes("transcription")) {
      return "transcription";
    }
    if (message.includes("openrouter") || message.includes("llm") || message.includes("analysis")) {
      return "analysis";
    }
    if (message.includes("telegram") || message.includes("notification")) {
      return "notification";
    }
    if (message.includes("database") || message.includes("sqlite")) {
      return "database";
    }
    if (message.includes("redis") || message.includes("queue")) {
      return "queue";
    }

    return "unknown";
  },
};

/**
 * Retry logic with exponential backoff
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry = null,
    shouldRetry = ErrorClassifier.isRetryable,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with jitter
      const jitter = Math.random() * 0.3 * delay;
      const actualDelay = Math.min(delay + jitter, maxDelay);

      // Handle rate limit specific delay
      if (error.retryAfter) {
        delay = error.retryAfter * 1000;
      }

      logger.warn(`Retry attempt ${attempt}/${maxRetries}`, {
        error: error.message,
        nextRetryIn: `${actualDelay}ms`,
      });

      if (onRetry) {
        await onRetry(error, attempt, actualDelay);
      }

      await sleep(actualDelay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Express error handling middleware
 */
function expressErrorHandler(err, req, res, next) {
  // Log error
  const errorInfo = {
    message: err.message,
    code: err.code,
    statusCode: ErrorClassifier.getStatusCode(err),
    path: req.path,
    method: req.method,
    service: ErrorClassifier.classifyByService(err),
    isOperational: ErrorClassifier.isOperational(err),
  };

  if (ErrorClassifier.isOperational(err)) {
    logger.warn("Operational error", errorInfo);
  } else {
    logger.error("Unexpected error", { ...errorInfo, stack: err.stack });
  }

  // Send response
  const statusCode = ErrorClassifier.getStatusCode(err);

  res.status(statusCode).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production" && !ErrorClassifier.isOperational(err)
          ? "An unexpected error occurred"
          : err.message,
      details: err.details || null,
      requestId: req.id,
    },
  });
}

/**
 * Async handler wrapper for Express routes
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Worker job error handler
 */
function handleWorkerError(error, jobName, jobData) {
  const errorInfo = {
    job: jobName,
    data: jobData,
    message: error.message,
    code: error.code,
    service: ErrorClassifier.classifyByService(error),
    isRetryable: ErrorClassifier.isRetryable(error),
    isOperational: ErrorClassifier.isOperational(error),
  };

  if (ErrorClassifier.isOperational(error)) {
    logger.warn("Worker job failed (operational)", errorInfo);
  } else {
    logger.error("Worker job failed (unexpected)", { ...errorInfo, stack: error.stack });
  }

  return errorInfo;
}

/**
 * Circuit breaker for external services
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        throw new ServiceUnavailableError("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();

      if (this.state === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= 3) {
          this.state = "CLOSED";
          this.failures = 0;
        }
      } else {
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = "OPEN";
        logger.warn("Circuit breaker opened", {
          failures: this.failures,
          threshold: this.failureThreshold,
        });
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = "CLOSED";
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
}

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
  ExternalAPIError,
  RetryableError,
  RateLimitError,

  // Utilities
  ErrorClassifier,
  withRetry,
  sleep,

  // Middleware
  expressErrorHandler,
  asyncHandler,

  // Worker helpers
  handleWorkerError,

  // Circuit breaker
  CircuitBreaker,
};
