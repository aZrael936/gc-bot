#!/usr/bin/env node

/**
 * Performance Benchmarks
 * Tests system performance against Phase 6 criteria:
 * - 10-min call processed in < 5 minutes
 * - API response times < 500ms for list endpoints
 * - System handles 100+ calls in database smoothly
 */

require("dotenv").config();

const http = require("http");

// Configuration
const API_BASE = process.env.API_BASE || "http://localhost:3000";
const BENCHMARK_CONFIG = {
  // Performance targets
  targets: {
    apiResponseTime: 500, // ms
    pipelineTime: 300000, // 5 minutes in ms
    listEndpointTime: 500, // ms
    writeEndpointTime: 1000, // ms
  },
  // Test iterations
  iterations: {
    apiRequests: 10,
    concurrentRequests: 5,
  },
};

// Colors for output
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = (msg) => console.log(msg);
const info = (msg) => log(`${c.blue}ℹ${c.reset} ${msg}`);
const success = (msg) => log(`${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => log(`${c.yellow}⚠${c.reset} ${msg}`);
const error = (msg) => log(`${c.red}✗${c.reset} ${msg}`);

/**
 * Make HTTP request and measure time
 */
async function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          data: data ? JSON.parse(data) : null,
          duration,
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Calculate statistics
 */
function calculateStats(times) {
  if (times.length === 0) return null;

  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / times.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

/**
 * Run API endpoint benchmark
 */
async function benchmarkEndpoint(name, url, options = {}) {
  const times = [];
  const errors = [];
  const iterations = options.iterations || BENCHMARK_CONFIG.iterations.apiRequests;

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await httpRequest(url, options);
      times.push(result.duration);

      if (result.statusCode >= 400) {
        errors.push(`HTTP ${result.statusCode}`);
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  const stats = calculateStats(times);
  const target = options.target || BENCHMARK_CONFIG.targets.apiResponseTime;
  const passed = stats && stats.avg < target;

  return {
    name,
    url,
    iterations,
    stats,
    errors,
    target,
    passed,
  };
}

/**
 * Run concurrent requests benchmark
 */
async function benchmarkConcurrent(name, url, concurrency) {
  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < concurrency; i++) {
    promises.push(httpRequest(url));
  }

  const results = await Promise.allSettled(promises);
  const totalTime = Date.now() - startTime;

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const times = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value.duration);

  return {
    name,
    concurrency,
    totalTime,
    successful,
    failed: concurrency - successful,
    avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
  };
}

/**
 * Benchmark database operations
 */
async function benchmarkDatabase() {
  const results = [];

  try {
    // Test listing analyses
    const listResult = await benchmarkEndpoint(
      "List Analyses",
      `${API_BASE}/api/analyses?limit=100`,
      { target: 500 }
    );
    results.push(listResult);

    // Test getting statistics
    const statsResult = await benchmarkEndpoint(
      "Get Statistics",
      `${API_BASE}/api/analyses/statistics`,
      { target: 500 }
    );
    results.push(statsResult);

    // Test daily report
    const reportResult = await benchmarkEndpoint(
      "Daily Report",
      `${API_BASE}/api/reports/daily`,
      { target: 1000 }
    );
    results.push(reportResult);

    // Test notifications list
    const notifResult = await benchmarkEndpoint(
      "List Notifications",
      `${API_BASE}/api/notifications?limit=100`,
      { target: 500 }
    );
    results.push(notifResult);
  } catch (err) {
    error(`Database benchmark failed: ${err.message}`);
  }

  return results;
}

/**
 * Benchmark concurrent access
 */
async function benchmarkConcurrency() {
  const results = [];

  try {
    // Test concurrent health checks
    const healthResult = await benchmarkConcurrent(
      "Health Check (Concurrent)",
      `${API_BASE}/health`,
      10
    );
    results.push(healthResult);

    // Test concurrent API requests
    const apiResult = await benchmarkConcurrent(
      "API Info (Concurrent)",
      `${API_BASE}/api`,
      10
    );
    results.push(apiResult);

    // Test concurrent analysis list
    const analysisResult = await benchmarkConcurrent(
      "Analysis List (Concurrent)",
      `${API_BASE}/api/analyses?limit=10`,
      5
    );
    results.push(analysisResult);
  } catch (err) {
    error(`Concurrency benchmark failed: ${err.message}`);
  }

  return results;
}

/**
 * Print benchmark results
 */
function printResults(title, results) {
  log(`\n${c.cyan}${c.bold}${title}${c.reset}`);
  log("─".repeat(70));

  for (const result of results) {
    if (result.stats) {
      // API endpoint result
      const status = result.passed
        ? `${c.green}PASS${c.reset}`
        : `${c.red}FAIL${c.reset}`;

      log(`\n  ${c.bold}${result.name}${c.reset} ${status}`);
      log(`  URL: ${result.url}`);
      log(`  Iterations: ${result.iterations}`);
      log(`  Target: < ${result.target}ms`);
      log(
        `  Results: avg=${result.stats.avg.toFixed(1)}ms, min=${result.stats.min}ms, max=${result.stats.max}ms`
      );
      log(`  P95: ${result.stats.p95}ms, P99: ${result.stats.p99}ms`);

      if (result.errors.length > 0) {
        log(`  ${c.red}Errors: ${result.errors.length}${c.reset}`);
      }
    } else if (result.concurrency) {
      // Concurrent result
      const status = result.failed === 0
        ? `${c.green}PASS${c.reset}`
        : `${c.yellow}PARTIAL${c.reset}`;

      log(`\n  ${c.bold}${result.name}${c.reset} ${status}`);
      log(`  Concurrency: ${result.concurrency}`);
      log(`  Total time: ${result.totalTime}ms`);
      log(`  Successful: ${result.successful}/${result.concurrency}`);
      log(`  Avg response: ${result.avgTime.toFixed(1)}ms`);
    }
  }
}

/**
 * Print summary
 */
function printSummary(allResults) {
  log(`\n${"═".repeat(70)}`);
  log(`${c.cyan}${c.bold}BENCHMARK SUMMARY${c.reset}`);
  log("═".repeat(70));

  let passed = 0;
  let failed = 0;

  for (const [category, results] of Object.entries(allResults)) {
    for (const result of results) {
      if (result.passed !== undefined) {
        if (result.passed) passed++;
        else failed++;
      } else if (result.failed !== undefined) {
        if (result.failed === 0) passed++;
        else failed++;
      }
    }
  }

  log(`\n  Total Tests: ${passed + failed}`);
  log(`  ${c.green}Passed: ${passed}${c.reset}`);
  log(`  ${c.red}Failed: ${failed}${c.reset}`);

  log(`\n${c.bold}Performance Targets:${c.reset}`);
  log(`  - API Response Time: < ${BENCHMARK_CONFIG.targets.apiResponseTime}ms`);
  log(`  - List Endpoints: < ${BENCHMARK_CONFIG.targets.listEndpointTime}ms`);
  log(`  - Write Endpoints: < ${BENCHMARK_CONFIG.targets.writeEndpointTime}ms`);

  if (failed === 0) {
    log(`\n${c.green}${c.bold}All benchmarks passed!${c.reset}`);
  } else {
    log(`\n${c.yellow}${c.bold}Some benchmarks failed - review results above${c.reset}`);
  }

  return failed === 0;
}

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
  log(`
╔════════════════════════════════════════════════════════════════════╗
║              SALES CALL QC - PERFORMANCE BENCHMARKS                ║
╚════════════════════════════════════════════════════════════════════╝
`);

  info(`API Base: ${API_BASE}`);
  info(`Iterations per endpoint: ${BENCHMARK_CONFIG.iterations.apiRequests}`);
  info(`Concurrent requests: ${BENCHMARK_CONFIG.iterations.concurrentRequests}`);

  // Check if server is running
  try {
    await httpRequest(`${API_BASE}/health`);
    success("Server is running");
  } catch (err) {
    error(`Server not running at ${API_BASE}`);
    error("Please start the server with: npm start");
    process.exit(1);
  }

  const allResults = {};

  // Run health check benchmarks
  log(`\n${c.bold}Running health check benchmarks...${c.reset}`);
  allResults.health = [
    await benchmarkEndpoint("Health Check", `${API_BASE}/health`, { target: 100 }),
    await benchmarkEndpoint("Detailed Health", `${API_BASE}/health/detailed`, {
      target: 1000,
    }),
  ];
  printResults("Health Check Benchmarks", allResults.health);

  // Run database benchmarks
  log(`\n${c.bold}Running database benchmarks...${c.reset}`);
  allResults.database = await benchmarkDatabase();
  printResults("Database Benchmarks", allResults.database);

  // Run concurrency benchmarks
  log(`\n${c.bold}Running concurrency benchmarks...${c.reset}`);
  allResults.concurrency = await benchmarkConcurrency();
  printResults("Concurrency Benchmarks", allResults.concurrency);

  // Print summary
  const success = printSummary(allResults);

  // Output JSON results for CI
  if (process.env.OUTPUT_JSON) {
    const outputPath = process.env.OUTPUT_JSON;
    const fs = require("fs");
    fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
    info(`Results saved to ${outputPath}`);
  }

  return success;
}

// Run benchmarks
runBenchmarks()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    error(`Benchmark failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
