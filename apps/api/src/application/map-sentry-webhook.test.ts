import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapSentryWebhook } from "./map-sentry-webhook.js";

const hotelId = "11111111-1111-4111-8111-111111111111";

describe("mapSentryWebhook", () => {
  it("accepts the canonical generic payload", () => {
    const event = mapSentryWebhook({
      hotelId,
      title: "Unhandled API error",
      description: "500 on /v1/ops/dashboard",
      priority: "high",
      source: "manual",
    });
    assert.ok(event);
    assert.equal(event?.priority, "high");
  });

  it("maps Sentry issue.created webhook with default hotel id", () => {
    const event = mapSentryWebhook(
      {
        action: "created",
        data: {
          issue: {
            id: "1170820242",
            shortId: "API-1",
            title: "ZeroDivisionError: division by zero",
            culprit: "api.views in get",
            level: "error",
            permalink: "https://example.sentry.io/issues/1170820242/",
            project: { slug: "hotelos-api" },
          },
        },
      },
      { defaultHotelId: hotelId },
    );
    assert.ok(event);
    assert.equal(event?.hotelId, hotelId);
    assert.equal(event?.priority, "high");
    assert.equal(event?.app, "hotelos-api");
    assert.equal(event?.externalEventId, "1170820242");
    assert.match(event?.description ?? "", /example\.sentry\.io/);
  });

  it("skips issue resolved webhooks", () => {
    const event = mapSentryWebhook(
      {
        action: "resolved",
        data: {
          issue: {
            title: "Fixed error",
            level: "error",
          },
        },
      },
      { defaultHotelId: hotelId },
    );
    assert.equal(event, null);
  });

  it("maps alert rule event with hotelId tag", () => {
    const event = mapSentryWebhook({
      action: "triggered",
      data: {
        event: {
          event_id: "e4874d664c3540c1a32eab185f12c5ab",
          title: "ReferenceError: heck is not defined",
          level: "fatal",
          environment: "production",
          tags: [
            ["hotelId", hotelId],
            ["browser", "Chrome"],
          ],
          project: "hotelos-admin",
          web_url:
            "https://sentry.io/organizations/test-org/issues/111/events/e4874/",
        },
      },
    });
    assert.ok(event);
    assert.equal(event?.hotelId, hotelId);
    assert.equal(event?.priority, "urgent");
    assert.equal(event?.app, "hotelos-admin");
  });
});
