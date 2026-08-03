import type {
  PmsConnector,
  PmsHotelInventory,
  PmsReservationSnapshot,
  PmsRoomSnapshot,
  PmsRoomStatus,
} from "../types.js";

export type MewsHttpConfig = {
  readonly clientToken: string;
  readonly accessToken: string;
  readonly platformUrl?: string;
  readonly clientName?: string;
  readonly fetchImpl?: typeof fetch;
};

type MewsResource = {
  readonly Id?: string;
  readonly Name?: string;
  readonly State?: string;
  readonly ParentResourceId?: string | null;
};

type MewsReservation = {
  readonly Id?: string;
  readonly Number?: string;
  readonly State?: string;
  readonly AccountId?: string | null;
  readonly AssignedResourceId?: string | null;
  readonly StartUtc?: string | null;
  readonly EndUtc?: string | null;
  readonly ScheduledStartUtc?: string | null;
  readonly ScheduledEndUtc?: string | null;
};

function mapRoomState(state: string | undefined): PmsRoomStatus {
  switch ((state ?? "").toLowerCase()) {
    case "dirty":
      return "dirty";
    case "outoforder":
    case "outofservice":
      return "maintenance";
    case "clean":
    case "inspected":
      return "vacant";
    default:
      return "unknown";
  }
}

function mapReservationState(
  state: string | undefined,
): PmsReservationSnapshot["status"] {
  switch ((state ?? "").toLowerCase()) {
    case "started":
      return "in_house";
    case "processed":
      return "checked_out";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "confirmed":
    case "optional":
    default:
      return "confirmed";
  }
}

function toDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

async function mewsPost<T>(
  fetchImpl: typeof fetch,
  platformUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${platformUrl.replace(/\/$/, "")}${path}`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Mews API ${path} failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * Live Mews Connector API adapter (resources + reservations).
 * Requires ClientToken + AccessToken from Mews partner onboarding.
 */
export function createMewsHttpPmsConnector(
  config: MewsHttpConfig,
): PmsConnector {
  const clientToken = config.clientToken.trim();
  const accessToken = config.accessToken.trim();
  if (!clientToken || !accessToken) {
    throw new Error(
      "MEWS_CLIENT_TOKEN and MEWS_ACCESS_TOKEN are required when PMS_PROVIDER=mews",
    );
  }

  const platformUrl = (
    config.platformUrl?.trim() || "https://api.mews-demo.com"
  ).replace(/\/$/, "");
  const clientName = config.clientName?.trim() || "HotelOS AI 1.0";
  const fetchImpl = config.fetchImpl ?? fetch;

  const auth = {
    ClientToken: clientToken,
    AccessToken: accessToken,
    Client: clientName,
  };

  return {
    providerId: "mews",
    async fetchInventory(externalHotelId) {
      const fetchedAt = new Date().toISOString();
      const day = fetchedAt.slice(0, 10);
      const end = new Date(`${day}T12:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 14);

      const resourcesPayload = await mewsPost<{
        Resources?: MewsResource[];
      }>(fetchImpl, platformUrl, "/api/connector/v1/resources/getAll", {
        ...auth,
        Extent: {
          Resources: true,
          ResourceCategories: false,
          ResourceCategoryAssignments: false,
          ResourceCategoryImageAssignments: false,
          ResourceFeatures: false,
          ResourceFeatureAssignments: false,
          Inactive: false,
        },
      });

      const resources = resourcesPayload.Resources ?? [];
      const rooms: PmsRoomSnapshot[] = resources
        .filter((resource) => resource.Id && resource.Name)
        .map((resource) => ({
          externalRoomId: String(resource.Id),
          roomNumber: String(resource.Name),
          status: mapRoomState(resource.State),
        }));

      const byResourceId = new Map(
        rooms.map((room) => [room.externalRoomId, room.roomNumber]),
      );

      const reservationsPayload = await mewsPost<{
        Reservations?: MewsReservation[];
      }>(
        fetchImpl,
        platformUrl,
        "/api/connector/v1/reservations/getAll/2023-06-06",
        {
          ...auth,
          CollidingUtc: {
            StartUtc: `${day}T00:00:00Z`,
            EndUtc: end.toISOString(),
          },
          States: ["Confirmed", "Started", "Processed"],
          Limitation: { Count: 200 },
          Extent: {
            Reservations: true,
            ReservationGroups: false,
            Customer: false,
          },
        },
      );

      const reservations: PmsReservationSnapshot[] = (
        reservationsPayload.Reservations ?? []
      )
        .filter((reservation) => reservation.Id)
        .map((reservation) => {
          const resourceId = reservation.AssignedResourceId ?? null;
          const roomNumber = resourceId
            ? (byResourceId.get(resourceId) ?? null)
            : null;
          const status = mapReservationState(reservation.State);
          // If Mews says Started, prefer occupied on the assigned room snapshot.
          if (status === "in_house" && roomNumber) {
            const idx = rooms.findIndex((room) => room.roomNumber === roomNumber);
            if (idx >= 0) {
              const current = rooms[idx];
              if (current) {
                rooms[idx] = {
                  ...current,
                  status: "occupied",
                };
              }
            }
          }
          return {
            externalReservationId: String(reservation.Id),
            guestName: reservation.Number
              ? `אורח Mews ${reservation.Number}`
              : "אורח Mews",
            roomNumber,
            checkInDate: toDate(
              reservation.ScheduledStartUtc ?? reservation.StartUtc,
            ),
            checkOutDate: toDate(
              reservation.ScheduledEndUtc ?? reservation.EndUtc,
            ),
            status,
          };
        });

      const inventory: PmsHotelInventory = {
        providerId: "mews",
        externalHotelId,
        fetchedAt,
        rooms,
        reservations,
      };
      return inventory;
    },
  };
}
