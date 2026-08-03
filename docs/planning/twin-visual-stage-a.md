# Twin Visual — Stage A (2.5D)

**Status:** ✅ Stage A shipped · ✅ Stage B HITL room actions  
**Goal:** Luxurious live hotel picture without a full 3D engine.

## What it is

- Building view grouped by **real floors / room counts** from Twin (`GET /v1/twin`)
- Status colors: vacant / occupied / dirty / maintenance
- Click room → live panel (status, related equipment, incidents/predictions)
- Auto-refresh every 30s in Admin Twin panel
- **Stage B:** from selected room → Suggest ניקיון (dirty + roomId) / Suggest תחזוקה → pending AI approval (Approve→Act in Approvals inbox)

## What it is not

- Not Unreal/Unity walkthrough
- Not a PMS replacement
- Stage C (enter-room immersive 3D) only after pilot ROI proof

## Where

- UI: `packages/features/src/twin-visual.tsx` → Admin `twin-panel.tsx`
- Data: Twin rooms (+ optional `floor`, `roomId`), equipment, overlays
- HITL: existing `/v1/autonomy/suggest-dirty-rooms` + `/v1/autonomy/suggest` (`department_task`)

## Next (Stage C)

Immersive 3D only after measured pilot ROI — not before.
