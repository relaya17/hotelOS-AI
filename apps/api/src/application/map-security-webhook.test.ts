import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapSecurityWebhook } from "./map-security-webhook.js";

describe("mapSecurityWebhook", () => {
  it("accepts the canonical generic payload", () => {
    const event = mapSecurityWebhook("generic", {
      hotelId: "11111111-1111-4111-8111-111111111111",
      title: "חדירה לאזור מוגבל",
      description: "זוהתה תנועה בחניון שירות",
      priority: "urgent",
      source: "pilot-vms",
    });
    assert.equal(event.priority, "urgent");
    assert.equal(event.title, "חדירה לאזור מוגבל");
  });

  it("maps example_vms severity into HotelOS priority", () => {
    const event = mapSecurityWebhook("example_vms", {
      site_id: "11111111-1111-4111-8111-111111111111",
      alarm_name: "Abandoned bag",
      alarm_text: "Object left in lobby",
      severity: "critical",
      camera_id: "CAM-12",
      event_id: "evt-99",
      timestamp: "2026-07-19T10:00:00Z",
    });
    assert.equal(event.priority, "high");
    assert.equal(event.source, "example_vms");
    assert.match(event.description, /CAM-12/);
    assert.equal(event.externalEventId, "evt-99");
  });

  it("maps milestone XProtect alarms into HotelOS priority", () => {
    const event = mapSecurityWebhook("milestone", {
      SiteId: "11111111-1111-4111-8111-111111111111",
      Name: "Motion in restricted area",
      Description: "Movement detected in service parking",
      Priority: 3,
      CameraId: "CAM-07",
      Guid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      Timestamp: "2026-07-19T10:00:00Z",
    });
    assert.equal(event.priority, "urgent");
    assert.equal(event.source, "milestone");
    assert.match(event.description, /CAM-07/);
    assert.equal(event.externalEventId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("maps low-priority milestone alarms without optional fields", () => {
    const event = mapSecurityWebhook("milestone", {
      SiteId: "11111111-1111-4111-8111-111111111111",
      Name: "Door held open",
      Description: "Service door open longer than 60s",
      Priority: 0,
    });
    assert.equal(event.priority, "low");
    assert.equal(event.externalEventId, undefined);
  });

  it("maps genetec Security Center alarms", () => {
    const event = mapSecurityWebhook("genetec", {
      SiteId: "11111111-1111-4111-8111-111111111111",
      Name: "Intrusion",
      Message: "Parking lot after hours",
      Severity: "Critical",
      CameraGuid: "cam-9",
      Guid: "evt-gen-1",
    });
    assert.equal(event.priority, "urgent");
    assert.equal(event.source, "genetec");
    assert.match(event.description, /cam-9/);
    assert.equal(event.externalEventId, "evt-gen-1");
  });
});
