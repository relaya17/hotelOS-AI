import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_HOTEL_TLV_ID } from "@hotelos/database";
import { mapReputationReview } from "./map-reputation-review.js";

describe("mapReputationReview", () => {
  it("maps a Google payload to canonical shape", () => {
    const mapped = mapReputationReview("google", {
      hotel_id: DEMO_HOTEL_TLV_ID,
      review_id: "g-123",
      star_rating: "2",
      comment: "Dirty bathroom",
      reviewer_display_name: "Alex",
      create_time: "2026-01-15T10:00:00.000Z",
    });
    assert.equal(mapped.hotelId, DEMO_HOTEL_TLV_ID);
    assert.equal(mapped.externalId, "g-123");
    assert.equal(mapped.rating, 2);
    assert.equal(mapped.authorName, "Alex");
  });

  it("maps Booking 1–10 score to 1–5 stars", () => {
    const mapped = mapReputationReview("booking", {
      property_id: DEMO_HOTEL_TLV_ID,
      review_id: "b-99",
      score: 8,
      text: "Good breakfast",
      date: "2026-02-01",
    });
    assert.equal(mapped.rating, 4);
  });

  it("accepts generic canonical payloads", () => {
    const mapped = mapReputationReview("generic", {
      hotelId: DEMO_HOTEL_TLV_ID,
      externalId: "x-1",
      rating: 1,
      body: "Never again",
      reviewedAt: "2026-03-01T08:00:00.000Z",
    });
    assert.equal(mapped.rating, 1);
    assert.equal(mapped.body, "Never again");
  });
});
