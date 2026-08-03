import type {
  BookingRepository,
  EquipmentRepository,
  GuestProfileRepository,
  HotelRepository,
  OpsRepository,
  PersistedBooking,
  PersistedEquipmentAsset,
  PersistedMaintenancePrediction,
  PersistedRoom,
  RoomRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import { buildIncidentCenter } from "./build-incident-center.js";

export const OPS_KG_MAX_NODES = 40;
export const OPS_KG_MAX_EDGES = 80;
export const OPS_KG_MAX_ROOMS = 8;
export const OPS_KG_MAX_BOOKINGS = 8;
export const OPS_KG_MAX_GUESTS = 8;
export const OPS_KG_MAX_INCIDENTS = 6;
export const OPS_KG_MAX_EQUIPMENT = 6;
export const OPS_KG_MAX_PREDICTIONS = 6;

export type KnowledgeGraphNode = {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly meta?: Record<string, string | number | boolean | null>;
};

export type KnowledgeGraphEdge = {
  readonly from: string;
  readonly to: string;
  readonly type: string;
};

export type OpsKnowledgeGraph = {
  readonly generatedAt: string;
  readonly nodes: readonly KnowledgeGraphNode[];
  readonly edges: readonly KnowledgeGraphEdge[];
};

export type BuildOpsKnowledgeGraphDeps = {
  readonly hotels: HotelRepository;
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly guestProfiles: GuestProfileRepository;
  readonly ops: OpsRepository;
  readonly equipment: EquipmentRepository;
  readonly maintenance: import("@hotelos/database").MaintenanceRepository;
};

export type BuildOpsKnowledgeGraphInput = {
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
};

type GraphBuilder = {
  readonly nodes: KnowledgeGraphNode[];
  readonly edges: KnowledgeGraphEdge[];
  readonly nodeIds: Set<string>;
};

function createGraphBuilder(): GraphBuilder {
  return { nodes: [], edges: [], nodeIds: new Set() };
}

function canAddNode(builder: GraphBuilder): boolean {
  return builder.nodes.length < OPS_KG_MAX_NODES;
}

function canAddEdge(builder: GraphBuilder): boolean {
  return builder.edges.length < OPS_KG_MAX_EDGES;
}

function addNode(
  builder: GraphBuilder,
  node: KnowledgeGraphNode,
  force = false,
): boolean {
  if (builder.nodeIds.has(node.id)) {
    return true;
  }
  if (!force && !canAddNode(builder)) {
    return false;
  }
  builder.nodes.push(node);
  builder.nodeIds.add(node.id);
  return true;
}

function addEdge(
  builder: GraphBuilder,
  edge: KnowledgeGraphEdge,
): boolean {
  if (!canAddEdge(builder)) {
    return false;
  }
  if (
    builder.edges.some(
      (existing) =>
        existing.from === edge.from &&
        existing.to === edge.to &&
        existing.type === edge.type,
    )
  ) {
    return true;
  }
  builder.edges.push(edge);
  return true;
}

function guestNodeId(email: string): string {
  return `guest:${email.trim().toLowerCase()}`;
}

function sortBookingsRecent(
  rows: readonly PersistedBooking[],
): readonly PersistedBooking[] {
  return [...rows].sort(
    (a, b) =>
      b.checkInDate.localeCompare(a.checkInDate) ||
      b.checkOutDate.localeCompare(a.checkOutDate),
  );
}

function sortRoomsTop(rows: readonly PersistedRoom[]): readonly PersistedRoom[] {
  return [...rows].sort((a, b) => a.number.localeCompare(b.number, "he"));
}

function sortPredictionsByRisk(
  rows: readonly PersistedMaintenancePrediction[],
): readonly PersistedMaintenancePrediction[] {
  return [...rows].sort(
    (a, b) =>
      b.riskScore - a.riskScore || b.createdAt.localeCompare(a.createdAt),
  );
}

function sortAssetsTop(
  rows: readonly PersistedEquipmentAsset[],
): readonly PersistedEquipmentAsset[] {
  return [...rows].sort((a, b) => a.code.localeCompare(b.code, "he"));
}

/**
 * Assembles an explicit operational knowledge graph from domain repositories —
 * no graph DB, no LLM. Synced from source-of-truth data per Vol 5 §5.5.
 */
export async function buildOpsKnowledgeGraph(
  deps: BuildOpsKnowledgeGraphDeps,
  input: BuildOpsKnowledgeGraphInput,
): Promise<OpsKnowledgeGraph | null> {
  const hotel = await deps.hotels.findById(input.hotelId);
  if (!hotel || hotel.tenantId !== input.tenantId) {
    return null;
  }

  const hotelNodeId = `hotel:${input.hotelId}`;
  const builder = createGraphBuilder();

  const [roomRows, bookingRows, incidentCenter, predictions, assets] =
    await Promise.all([
      deps.rooms.listByHotel(input.tenantId, input.hotelId),
      deps.bookings.listByHotel(input.tenantId, input.hotelId),
      buildIncidentCenter(
        {
          ops: deps.ops,
          maintenance: deps.maintenance,
          hotels: deps.hotels,
        },
        input.tenantId,
        [input.hotelId],
      ),
      deps.equipment.listOpenPredictionsByHotel(input.tenantId, input.hotelId),
      deps.equipment.listAssetsByHotel(input.tenantId, input.hotelId),
    ]);

  addNode(
    builder,
    {
      id: hotelNodeId,
      type: "hotel",
      label: hotel.name,
      meta: { timezone: hotel.timezone, currency: hotel.currency },
    },
    true,
  );

  const rooms = sortRoomsTop(roomRows).slice(0, OPS_KG_MAX_ROOMS);
  for (const room of rooms) {
    const roomNodeId = `room:${room.id}`;
    if (
      !addNode(builder, {
        id: roomNodeId,
        type: "room",
        label: `חדר ${room.number}`,
        meta: { status: room.status, floor: room.floor },
      })
    ) {
      break;
    }
    addEdge(builder, { from: hotelNodeId, to: roomNodeId, type: "has_room" });
  }

  const bookings = sortBookingsRecent(bookingRows).slice(0, OPS_KG_MAX_BOOKINGS);
  const guestEmails = new Set<string>();

  for (const booking of bookings) {
    const bookingNodeId = `booking:${booking.id}`;
    if (
      !addNode(builder, {
        id: bookingNodeId,
        type: "booking",
        label: booking.guestName,
        meta: {
          status: booking.status,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
        },
      })
    ) {
      break;
    }
    addEdge(builder, {
      from: hotelNodeId,
      to: bookingNodeId,
      type: "has_booking",
    });

    const roomNodeId = `room:${booking.roomId}`;
    if (builder.nodeIds.has(roomNodeId)) {
      addEdge(builder, {
        from: bookingNodeId,
        to: roomNodeId,
        type: "assigned_to",
      });
    }

    const email = booking.guestEmail.trim().toLowerCase();
    guestEmails.add(email);
    const guestId = guestNodeId(email);
    if (
      addNode(builder, {
        id: guestId,
        type: "guest",
        label: booking.guestName,
        meta: { email },
      })
    ) {
      addEdge(builder, {
        from: bookingNodeId,
        to: guestId,
        type: "booked_by",
      });
      addEdge(builder, {
        from: guestId,
        to: hotelNodeId,
        type: "stays_at",
      });
    }
  }

  const profileLookups = [...guestEmails]
    .slice(0, OPS_KG_MAX_GUESTS)
    .map((email) => deps.guestProfiles.findByEmail(input.tenantId, email));
  const profiles = await Promise.all(profileLookups);
  for (const profile of profiles) {
    if (!profile) {
      continue;
    }
    const guestId = guestNodeId(profile.email);
    if (!builder.nodeIds.has(guestId)) {
      continue;
    }
    const guestIndex = builder.nodes.findIndex((item) => item.id === guestId);
    if (guestIndex >= 0 && profile.displayName.trim()) {
      const existing = builder.nodes[guestIndex]!;
      builder.nodes[guestIndex] = {
        ...existing,
        meta: {
          ...existing.meta,
          profileName: profile.displayName,
          stayCount: profile.stayCount,
        },
      };
    }
  }

  const incidents = incidentCenter.incidents.slice(0, OPS_KG_MAX_INCIDENTS);
  for (const incident of incidents) {
    const incidentNodeId = `incident:${incident.id}`;
    if (
      !addNode(builder, {
        id: incidentNodeId,
        type: "incident",
        label: incident.title,
        meta: {
          department: incident.department,
          severity: incident.severity,
          status: incident.status,
        },
      })
    ) {
      break;
    }
    addEdge(builder, {
      from: hotelNodeId,
      to: incidentNodeId,
      type: "open_incident",
    });
    if (incident.taskId) {
      const taskNodeId = `task:${incident.taskId}`;
      if (
        addNode(builder, {
          id: taskNodeId,
          type: "task",
          label: incident.title,
          meta: { source: incident.source },
        })
      ) {
        addEdge(builder, {
          from: incidentNodeId,
          to: taskNodeId,
          type: "linked_task",
        });
      }
    }
  }

  const equipmentRows = sortAssetsTop(assets).slice(0, OPS_KG_MAX_EQUIPMENT);
  const assetIdByNode = new Map<string, string>();
  for (const asset of equipmentRows) {
    const equipmentNodeId = `equipment:${asset.id}`;
    assetIdByNode.set(asset.id, equipmentNodeId);
    if (
      !addNode(builder, {
        id: equipmentNodeId,
        type: "equipment",
        label: asset.nameHe,
        meta: { code: asset.code, category: asset.category },
      })
    ) {
      break;
    }
    addEdge(builder, {
      from: equipmentNodeId,
      to: hotelNodeId,
      type: "equipment_at",
    });
  }

  const sortedPredictions = sortPredictionsByRisk(predictions).slice(
    0,
    OPS_KG_MAX_PREDICTIONS,
  );
  for (const prediction of sortedPredictions) {
    const predictionNodeId = `prediction:${prediction.id}`;
    if (
      !addNode(builder, {
        id: predictionNodeId,
        type: "prediction",
        label: prediction.rationaleHe,
        meta: { riskScore: prediction.riskScore, status: prediction.status },
      })
    ) {
      break;
    }
    const equipmentNodeId = assetIdByNode.get(prediction.assetId);
    if (equipmentNodeId) {
      addEdge(builder, {
        from: predictionNodeId,
        to: equipmentNodeId,
        type: "predicts_on",
      });
    } else {
      addEdge(builder, {
        from: predictionNodeId,
        to: hotelNodeId,
        type: "predicts_at",
      });
    }
    if (prediction.taskId) {
      const taskNodeId = `task:${prediction.taskId}`;
      if (
        addNode(builder, {
          id: taskNodeId,
          type: "task",
          label: prediction.recommendedActionHe,
          meta: { source: "predictive_maintenance" },
        })
      ) {
        addEdge(builder, {
          from: predictionNodeId,
          to: taskNodeId,
          type: "linked_task",
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    nodes: builder.nodes,
    edges: builder.edges,
  };
}
