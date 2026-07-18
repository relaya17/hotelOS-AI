import type { OverviewRepository } from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

/** Context packs for P2 agents (Revenue / Housekeeping) — no invented facts. */
export async function buildOpsContextPack(
  overview: OverviewRepository,
  tenantId: TenantId,
  agentId: string,
): Promise<string> {
  const chain = await overview.getChainOverview(tenantId);
  if (!chain) {
    return "אין נתוני רשת זמינים.";
  }

  const lines = chain.hotels.map((hotel) => {
    const occ =
      hotel.rooms.total === 0
        ? 0
        : Math.round((hotel.rooms.occupied / hotel.rooms.total) * 100);
    return `• ${hotel.name}: תפוסה ${occ}% · dirty ${hotel.rooms.dirty} · maintenance ${hotel.rooms.maintenance} · הזמנות פעילות ${hotel.bookings.active}`;
  });

  const totals = chain.hotels.reduce(
    (acc, hotel) => ({
      rooms: acc.rooms + hotel.rooms.total,
      occupied: acc.occupied + hotel.rooms.occupied,
      dirty: acc.dirty + hotel.rooms.dirty,
      maintenance: acc.maintenance + hotel.rooms.maintenance,
    }),
    { rooms: 0, occupied: 0, dirty: 0, maintenance: 0 },
  );
  const chainOcc =
    totals.rooms === 0
      ? 0
      : Math.round((totals.occupied / totals.rooms) * 100);

  if (agentId === "agent.revenue") {
    return [
      "Context pack — Revenue Agent",
      `רשת ${chain.tenantName} · תפוסה ${chainOcc}%`,
      "התמקד בתמחור/תפוסה בלבד. אל תבצע שינוי מחיר — Suggest בלבד.",
      ...lines,
    ].join("\n");
  }

  if (agentId === "agent.housekeeping") {
    return [
      "Context pack — Housekeeping Agent",
      `רשת ${chain.tenantName} · חדרים dirty: ${totals.dirty} · תחזוקה: ${totals.maintenance}`,
      "תעדף ניקיון לפי dirty וזמינות צוות. אל תשנה סטטוס חדר בלי אישור.",
      ...lines,
    ].join("\n");
  }

  return [
    `Context pack — ${agentId}`,
    `רשת ${chain.tenantName} · תפוסה ${chainOcc}%`,
    ...lines,
  ].join("\n");
}
