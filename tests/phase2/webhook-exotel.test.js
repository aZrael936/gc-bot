/**
 * Phase 2 Tests - Exotel Webhook Integration
 * Tests for webhook endpoint with correct Exotel payload structure
 */

const request = require("supertest");
const app = require("../../src/index");

describe("Phase 2 - Exotel Webhook Integration", () => {
  describe("POST /webhook/exotel", () => {
    it("should accept valid Exotel webhook with completed call and recording", async () => {
      const payload = {
        call_sid: "test_call_123",
        transaction_id: "conn_456",
        from: "09876543210",
        to: "08012345678",
        direction: "incoming",
        start_time: "2025-01-08 10:30:00",
        current_time: "2025-01-08 10:34:00",
        dial_call_duration: 245,
        on_call_duration: 240,
        recording_url:
          "https://s3.amazonaws.com/exotelrecordings/test/recording.mp3",
        call_type: "completed",
        dial_call_status: "completed",
      };

      const response = await request(app)
        .post("/webhook/exotel")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("status", "processed");
      expect(response.body).toHaveProperty("call_id");
      expect(response.body).toHaveProperty("job_id");
    });

    it("should ignore webhook without recording_url", async () => {
      const payload = {
        call_sid: "test_call_no_recording",
        from: "09876543210",
        to: "08012345678",
        direction: "incoming",
        call_type: "completed",
        // No recording_url
      };

      const response = await request(app)
        .post("/webhook/exotel")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("status", "ignored");
    });

    it("should ignore webhook with non-completed call_type", async () => {
      const payload = {
        call_sid: "test_call_incomplete",
        from: "09876543210",
        to: "08012345678",
        direction: "incoming",
        call_type: "incomplete",
        recording_url: "https://example.com/recording.mp3",
      };

      const response = await request(app)
        .post("/webhook/exotel")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("status", "ignored");
    });

    it("should reject webhook without call_sid", async () => {
      const payload = {
        from: "09876543210",
        to: "08012345678",
        recording_url: "https://example.com/recording.mp3",
        call_type: "completed",
        // Missing call_sid
      };

      const response = await request(app)
        .post("/webhook/exotel")
        .send(payload)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should handle duplicate call_sid gracefully", async () => {
      const payload = {
        call_sid: "test_duplicate_call",
        from: "09876543210",
        to: "08012345678",
        direction: "incoming",
        on_call_duration: 120,
        recording_url: "https://example.com/recording.mp3",
        call_type: "completed",
      };

      // First call
      const response1 = await request(app)
        .post("/webhook/exotel")
        .send(payload)
        .expect(200);

      expect(response1.body).toHaveProperty("status", "processed");
      const firstCallId = response1.body.call_id;

      // Duplicate call with same call_sid
      const response2 = await request(app)
        .post("/webhook/exotel")
        .send(payload)
        .expect(200);

      expect(response2.body).toHaveProperty("status", "processed");
      // Should return same call_id for duplicate
      expect(response2.body.call_id).toBe(firstCallId);
    });
  });

  describe("POST /webhook/exotel/mock", () => {
    it("should accept mock webhook with minimal payload", async () => {
      const response = await request(app)
        .post("/webhook/exotel/mock")
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty("status", "processed");
      expect(response.body).toHaveProperty("call_id");
      expect(response.body).toHaveProperty("job_id");
      expect(response.body).toHaveProperty("mock", true);
    });

    it("should accept mock webhook with custom data", async () => {
      const payload = {
        call_sid: "custom_mock_123",
        from: "01234567890",
        to: "09876543210",
        on_call_duration: 300,
      };

      const response = await request(app)
        .post("/webhook/exotel/mock")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("status", "processed");
      expect(response.body).toHaveProperty("mock", true);
    });
  });
});
