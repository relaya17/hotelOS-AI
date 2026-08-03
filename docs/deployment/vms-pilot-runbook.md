# VMS pilot runbook + תיקון 13 checklist

This is an **operations / compliance readiness** pack. It is not legal advice.
Engage counsel before live camera analytics in Israel.

## 1. What HotelOS already exposes

| Endpoint | Auth | Use |
|---|---|---|
| `POST /v1/public/security/ingest/:provider` | `Authorization: Bearer $SECURITY_INGEST_SECRET` or header `X-HotelOS-Security-Secret` | **Preferred for VMS** (no JWT) |
| `POST /v1/ops/security-events/ingest/:provider` | Staff JWT | Manual / internal tests |
| `POST /v1/ops/security-events` | Staff JWT | Canonical JSON body |

Providers: `generic` · `example_vms` · `milestone` · `genetec`

Map HotelOS `hotelId` (UUID) into the VMS site/custom field (`SiteId`).

### Milestone example

```http
POST /v1/public/security/ingest/milestone
Authorization: Bearer <SECURITY_INGEST_SECRET>
Content-Type: application/json

{
  "SiteId": "33333333-3333-4333-8333-333333333333",
  "Name": "Door forced open",
  "Description": "Lobby east door",
  "Priority": 3,
  "CameraId": "cam-12",
  "Guid": "alarm-guid-1",
  "Timestamp": "2026-08-03T12:00:00Z"
}
```

### Genetec example

```http
POST /v1/public/security/ingest/genetec
Authorization: Bearer <SECURITY_INGEST_SECRET>
Content-Type: application/json

{
  "SiteId": "33333333-3333-4333-8333-333333333333",
  "Name": "Intrusion",
  "Message": "Parking lot motion after hours",
  "Severity": "High",
  "CameraGuid": "cam-a",
  "Guid": "evt-1"
}
```

Result: `department_tasks` under **security** for that hotel.

## 2. Pilot wiring steps (hotel IT)

1. Set `SECURITY_INGEST_SECRET` on the API Vercel project (random 32+ chars).
2. Redeploy API after Hobby rate-limit window.
3. Confirm `GET https://<api>/v1/health` returns `ok`.
4. Map VMS site → HotelOS hotel UUID (demo TLV: `33333333-3333-4333-8333-333333333333`).
5. Point VMS webhook / Alarm Data Handler to  
   `https://<api>/v1/public/security/ingest/milestone` (or `genetec` / `generic`).
6. Send one test alarm; verify security task appears in Admin/Executive ops inbox.
7. Tune severity mapping with the hotel security manager.

## 3. תיקון 13 — operational checklist (before go-live)

Counsel must sign off. Product / ops prepare:

- [ ] Written camera policy (purpose = security only; retention period stated)
- [ ] Signage at every filmed area (Hebrew + English as needed)
- [ ] Staff acknowledgment of policy on file
- [ ] Guest-facing notice (website / check-in / house rules)
- [ ] No use of footage for employee performance monitoring without separate notice/consent path
- [ ] Access to recordings / event feeds limited to security roles
- [ ] DPIA / risk note updated for AI analytics if vendor adds face/behavior models
- [ ] Vendor DPA covers hosting region + subprocessors
- [ ] Incident response: who deletes / exports footage on request

Trusted Sources category `regulator` / Company Knowledge `policy` can host the approved policy text for `agent.security` / `agent.legal` citations — still not a substitute for counsel.

## 4. Explicit non-goals (PO)

- Smart locks: deferred
- Autonomous lock/camera control: never without human HITL
- Self-healing AIOps: out of scope
