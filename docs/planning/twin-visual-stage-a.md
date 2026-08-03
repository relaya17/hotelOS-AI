# Twin Visual — Stage A (2.5D)

**Status:** ✅ Shipped (Admin Digital Twin)  
**Goal:** Luxurious live hotel picture without a full 3D engine.

## What it is

- Building view grouped by **real floors / room counts** from Twin (`GET /v1/twin`)
- Status colors: vacant / occupied / dirty / maintenance
- Click room → live panel (status, related equipment, incidents/predictions)
- Auto-refresh every 30s in Admin Twin panel

## What it is not

- Not Unreal/Unity walkthrough
- Not a PMS replacement
- Stage B/C (enter-room immersive 3D) only after pilot ROI proof

## Where

- UI: `packages/features/src/twin-visual.tsx` → Admin `twin-panel.tsx`
- Data: Twin rooms (+ optional `floor`), equipment, overlays

## Next (Stage B)

Room detail as richer “live room” with Suggest→HITL actions, still 2.5D.
