import { and, desc, eq } from "drizzle-orm";
import type { BookingId, HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { upsellOffers } from "../schema/ops.js";
import { bookings, hotels, rooms } from "../schema/tenancy.js";

export type UpsellOfferType =
  | "room_upgrade"
  | "spa"
  | "dinner"
  | "late_checkout"
  | "other";

export type UpsellOfferStatus =
  | "suggested"
  | "accepted"
  | "declined"
  | "expired";

export type UpsellOfferSource = "rules" | "agent.guest";

export type PersistedUpsellOffer = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly bookingId: string | null;
  readonly guestEmail: string | null;
  readonly offerType: UpsellOfferType;
  readonly titleHe: string;
  readonly descriptionHe: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly status: UpsellOfferStatus;
  readonly source: UpsellOfferSource;
  readonly suggestedAt: string;
  readonly decidedAt: string | null;
  readonly createdAt: string;
};

export type BookingUpsellContext = {
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly bookingId: BookingId;
  readonly guestEmail: string;
  readonly guestName: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
  readonly roomType: string;
  readonly currency: string;
};

export type CreateUpsellOfferInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly bookingId: BookingId;
  readonly guestEmail: string;
  readonly offerType: UpsellOfferType;
  readonly titleHe: string;
  readonly descriptionHe: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly source: UpsellOfferSource;
  readonly suggestedAt: string;
  readonly createdAt: string;
};

const offerTypes: readonly UpsellOfferType[] = [
  "room_upgrade",
  "spa",
  "dinner",
  "late_checkout",
  "other",
];

const offerStatuses: readonly UpsellOfferStatus[] = [
  "suggested",
  "accepted",
  "declined",
  "expired",
];

const offerSources: readonly UpsellOfferSource[] = ["rules", "agent.guest"];

function asOfferType(value: string): UpsellOfferType {
  if ((offerTypes as readonly string[]).includes(value)) {
    return value as UpsellOfferType;
  }
  throw new Error("INVALID_UPSELL_OFFER_TYPE");
}

function asOfferStatus(value: string): UpsellOfferStatus {
  if ((offerStatuses as readonly string[]).includes(value)) {
    return value as UpsellOfferStatus;
  }
  throw new Error("INVALID_UPSELL_OFFER_STATUS");
}

function asOfferSource(value: string): UpsellOfferSource {
  if ((offerSources as readonly string[]).includes(value)) {
    return value as UpsellOfferSource;
  }
  throw new Error("INVALID_UPSELL_OFFER_SOURCE");
}

function mapOffer(row: typeof upsellOffers.$inferSelect): PersistedUpsellOffer {
  return {
    id: row.id,
    tenantId: row.tenantId as TenantId,
    hotelId: row.hotelId as HotelId,
    bookingId: row.bookingId ?? null,
    guestEmail: row.guestEmail ?? null,
    offerType: asOfferType(row.offerType),
    titleHe: row.titleHe,
    descriptionHe: row.descriptionHe,
    priceAmount: row.priceAmount,
    currency: row.currency,
    status: asOfferStatus(row.status),
    source: asOfferSource(row.source),
    suggestedAt: row.suggestedAt,
    decidedAt: row.decidedAt ?? null,
    createdAt: row.createdAt,
  };
}

export type UpsellRepository = {
  loadBookingContext: (
    tenantId: TenantId,
    hotelId: HotelId,
    bookingId: BookingId,
  ) => Promise<BookingUpsellContext | null>;
  findSuggestedByBookingAndType: (
    tenantId: TenantId,
    hotelId: HotelId,
    bookingId: BookingId,
    offerType: UpsellOfferType,
  ) => Promise<PersistedUpsellOffer | null>;
  createSuggested: (input: CreateUpsellOfferInput) => Promise<PersistedUpsellOffer>;
  listByBooking: (
    tenantId: TenantId,
    hotelId: HotelId,
    bookingId: BookingId,
  ) => Promise<readonly PersistedUpsellOffer[]>;
  listSuggestedForGuest: (
    bookingId: BookingId,
    guestEmail: string,
  ) => Promise<readonly PersistedUpsellOffer[]>;
  findByIdInHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    offerId: string,
  ) => Promise<PersistedUpsellOffer | null>;
  decide: (
    tenantId: TenantId,
    hotelId: HotelId,
    offerId: string,
    status: "accepted" | "declined",
    decidedAt: string,
  ) => Promise<PersistedUpsellOffer | null>;
};

export function createUpsellRepository(db: HotelOsDb): UpsellRepository {
  return {
    async loadBookingContext(tenantId, hotelId, bookingId) {
      const row = await db
        .select({
          tenantId: bookings.tenantId,
          hotelId: bookings.hotelId,
          bookingId: bookings.id,
          guestEmail: bookings.guestEmail,
          guestName: bookings.guestName,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
          roomType: rooms.roomType,
          currency: hotels.currency,
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.tenantId, tenantId),
          ),
        )
        .get();

      if (!row) {
        return null;
      }

      return {
        tenantId: row.tenantId as TenantId,
        hotelId: row.hotelId as HotelId,
        bookingId: row.bookingId as BookingId,
        guestEmail: row.guestEmail,
        guestName: row.guestName,
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
        status: row.status,
        roomType: row.roomType,
        currency: row.currency,
      };
    },

    async findSuggestedByBookingAndType(tenantId, hotelId, bookingId, offerType) {
      const row = await db
        .select()
        .from(upsellOffers)
        .where(
          and(
            eq(upsellOffers.tenantId, tenantId),
            eq(upsellOffers.hotelId, hotelId),
            eq(upsellOffers.bookingId, bookingId),
            eq(upsellOffers.offerType, offerType),
            eq(upsellOffers.status, "suggested"),
          ),
        )
        .get();
      return row ? mapOffer(row) : null;
    },

    async createSuggested(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        bookingId: input.bookingId,
        guestEmail: input.guestEmail,
        offerType: input.offerType,
        titleHe: input.titleHe,
        descriptionHe: input.descriptionHe,
        priceAmount: input.priceAmount,
        currency: input.currency,
        status: "suggested",
        source: input.source,
        suggestedAt: input.suggestedAt,
        decidedAt: null,
        createdAt: input.createdAt,
      };
      await db.insert(upsellOffers).values(row).run();
      return mapOffer(row);
    },

    async listByBooking(tenantId, hotelId, bookingId) {
      const rows = await db
        .select()
        .from(upsellOffers)
        .where(
          and(
            eq(upsellOffers.tenantId, tenantId),
            eq(upsellOffers.hotelId, hotelId),
            eq(upsellOffers.bookingId, bookingId),
          ),
        )
        .orderBy(desc(upsellOffers.suggestedAt))
        .all();
      return rows.map(mapOffer);
    },

    async listSuggestedForGuest(bookingId, guestEmail) {
      const normalized = guestEmail.trim().toLowerCase();
      const rows = await db
        .select()
        .from(upsellOffers)
        .where(
          and(
            eq(upsellOffers.bookingId, bookingId),
            eq(upsellOffers.guestEmail, normalized),
            eq(upsellOffers.status, "suggested"),
          ),
        )
        .orderBy(desc(upsellOffers.suggestedAt))
        .all();
      return rows.map(mapOffer);
    },

    async findByIdInHotel(tenantId, hotelId, offerId) {
      const row = await db
        .select()
        .from(upsellOffers)
        .where(
          and(
            eq(upsellOffers.id, offerId),
            eq(upsellOffers.tenantId, tenantId),
            eq(upsellOffers.hotelId, hotelId),
          ),
        )
        .get();
      return row ? mapOffer(row) : null;
    },

    async decide(tenantId, hotelId, offerId, status, decidedAt) {
      await db
        .update(upsellOffers)
        .set({ status, decidedAt })
        .where(
          and(
            eq(upsellOffers.id, offerId),
            eq(upsellOffers.tenantId, tenantId),
            eq(upsellOffers.hotelId, hotelId),
            eq(upsellOffers.status, "suggested"),
          ),
        )
        .run();

      const row = await db
        .select()
        .from(upsellOffers)
        .where(
          and(
            eq(upsellOffers.id, offerId),
            eq(upsellOffers.tenantId, tenantId),
            eq(upsellOffers.hotelId, hotelId),
          ),
        )
        .get();
      return row ? mapOffer(row) : null;
    },
  };
}
