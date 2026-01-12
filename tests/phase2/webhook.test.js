/**
 * Phase 2 - Webhook Integration Tests
 * Tests Exotel webhook handling and signature validation
 */

const crypto = require("crypto");
const config = require("../../src/config");
const {
  validateExotelSignature,
} = require("../../src/controllers/webhook.controller");

describe("Phase 2 - Webhook Integration", () => {
  describe("Exotel Signature Validation", () => {
    const testApiKey = "test_api_key";
    const testBody = JSON.stringify({
      event: "call.hangup",
      data: {
        CallSid: "test-call-123",
        RecordingUrl: "https://example.com/recording.wav",
      },
    });

    beforeAll(() => {
      // Mock config for testing
      config.exotel.apiKey = testApiKey;
      config.exotel.signatureValidation = true;
    });

    test("Valid signature should pass validation", () => {
      const expectedSignature = crypto
        .createHmac("sha1", testApiKey)
        .update(testBody, "utf8")
        .digest("hex");

      const isValid = validateExotelSignature(testBody, expectedSignature);
      expect(isValid).toBe(true);
    });

    test("Invalid signature should fail validation", () => {
      const invalidSignature = "invalid_signature";
      const isValid = validateExotelSignature(testBody, invalidSignature);
      expect(isValid).toBe(false);
    });

    test("Signature validation disabled should always pass", () => {
      config.exotel.signatureValidation = false;
      const isValid = validateExotelSignature(testBody, "any_signature");
      expect(isValid).toBe(true);
      config.exotel.signatureValidation = true; // Reset
    });

    test("Missing API key should fail validation", () => {
      const originalApiKey = config.exotel.apiKey;
      config.exotel.apiKey = null;

      const isValid = validateExotelSignature(testBody, "any_signature");
      expect(isValid).toBe(false);

      config.exotel.apiKey = originalApiKey; // Reset
    });
  });

  describe("Webhook Payload Processing", () => {
    // Integration tests would go here, but require full app setup
    // These will be tested in e2e tests
    test("Placeholder for webhook payload tests", () => {
      expect(true).toBe(true);
    });
  });
});
