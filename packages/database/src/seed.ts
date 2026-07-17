import { eq } from "drizzle-orm";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "./client.js";
import { createAgentRepository } from "./repositories/agent-repository.js";
import { createBriefingRepository } from "./repositories/briefing-repository.js";
import { createTurboRepository } from "./repositories/turbo-repository.js";
import {
  bookings,
  departments,
  hotelChains,
  hotels,
  rooms,
  tenants,
  users,
} from "./schema/tenancy.js";

export type SeedPasswordHasher = (password: string) => Promise<string>;

export const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_CHAIN_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_HOTEL_TLV_ID = "33333333-3333-4333-8333-333333333333";
export const DEMO_HOTEL_EILAT_ID = "66666666-6666-4666-8666-666666666666";
export const DEMO_USER_EMAIL = "admin@demo.hotelos.local";
export const DEMO_USER_PASSWORD = "HotelOS-Demo-ChangeMe1!";

export async function seedDemoTenant(
  db: HotelOsDb,
  hashPassword: SeedPasswordHasher,
): Promise<void> {
  const now = new Date().toISOString();
  const departmentId = "44444444-4444-4444-8444-444444444444";
  const userId = "55555555-5555-4555-8555-555555555555";

  const existingTenant = db
    .select()
    .from(tenants)
    .where(eq(tenants.id, DEMO_TENANT_ID))
    .get();

  if (!existingTenant) {
    db.insert(tenants)
      .values({
        id: DEMO_TENANT_ID,
        name: "Demo Hospitality Group",
        slug: "demo",
        createdAt: now,
      })
      .run();
  }

  const existingChain = db
    .select()
    .from(hotelChains)
    .where(eq(hotelChains.id, DEMO_CHAIN_ID))
    .get();

  if (!existingChain) {
    db.insert(hotelChains)
      .values({
        id: DEMO_CHAIN_ID,
        tenantId: DEMO_TENANT_ID,
        name: "Demo Chain Israel",
        createdAt: now,
      })
      .run();
  }

  ensureHotel(db, {
    id: DEMO_HOTEL_TLV_ID,
    name: "Demo Hotel Tel Aviv",
    timezone: "Asia/Jerusalem",
    currency: "ILS",
    createdAt: now,
  });

  ensureHotel(db, {
    id: DEMO_HOTEL_EILAT_ID,
    name: "Demo Hotel Eilat",
    timezone: "Asia/Jerusalem",
    currency: "ILS",
    createdAt: now,
  });

  ensureDemoRooms(db, DEMO_HOTEL_TLV_ID, now, [
    { id: "70000000-0000-4000-8000-000000000101", number: "101", floor: "1", roomType: "standard", status: "vacant" },
    { id: "70000000-0000-4000-8000-000000000102", number: "102", floor: "1", roomType: "standard", status: "dirty" },
    { id: "70000000-0000-4000-8000-000000000201", number: "201", floor: "2", roomType: "suite", status: "occupied" },
    { id: "70000000-0000-4000-8000-000000000301", number: "301", floor: "3", roomType: "deluxe", status: "maintenance" },
  ]);

  ensureDemoRooms(db, DEMO_HOTEL_EILAT_ID, now, [
    { id: "70000000-0000-4000-8000-000000000401", number: "401", floor: "4", roomType: "standard", status: "vacant" },
    { id: "70000000-0000-4000-8000-000000000402", number: "402", floor: "4", roomType: "sea_view", status: "occupied" },
    { id: "70000000-0000-4000-8000-000000000501", number: "501", floor: "5", roomType: "suite", status: "dirty" },
  ]);

  ensureDemoBookings(db, now, [
    {
      id: "80000000-0000-4000-8000-000000000001",
      hotelId: DEMO_HOTEL_TLV_ID,
      roomId: "70000000-0000-4000-8000-000000000201",
      guestName: "נועה כהן",
      guestEmail: "noa@example.com",
      checkInDate: "2026-07-16",
      checkOutDate: "2026-07-19",
      status: "checked_in",
    },
    {
      id: "80000000-0000-4000-8000-000000000002",
      hotelId: DEMO_HOTEL_TLV_ID,
      roomId: "70000000-0000-4000-8000-000000000101",
      guestName: "David Levi",
      guestEmail: "david@example.com",
      checkInDate: "2026-07-20",
      checkOutDate: "2026-07-23",
      status: "confirmed",
    },
    {
      id: "80000000-0000-4000-8000-000000000003",
      hotelId: DEMO_HOTEL_EILAT_ID,
      roomId: "70000000-0000-4000-8000-000000000402",
      guestName: "Maya Azulay",
      guestEmail: "maya@example.com",
      checkInDate: "2026-07-15",
      checkOutDate: "2026-07-18",
      status: "checked_in",
    },
  ]);

  const existingDepartment = db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .get();

  if (!existingDepartment) {
    db.insert(departments)
      .values({
        id: departmentId,
        tenantId: DEMO_TENANT_ID,
        hotelId: DEMO_HOTEL_TLV_ID,
        code: "ADMIN",
        name: "Administration",
        createdAt: now,
      })
      .run();
  }

  const existingUser = db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!existingUser) {
    const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
    db.insert(users)
      .values({
        id: userId,
        tenantId: DEMO_TENANT_ID,
        chainId: DEMO_CHAIN_ID,
        hotelId: DEMO_HOTEL_TLV_ID,
        departmentId,
        email: DEMO_USER_EMAIL,
        displayName: "Demo Admin",
        passwordHash,
        rolesJson: JSON.stringify(["admin", "executive"]),
        createdAt: now,
      })
      .run();
  }

  const agents = createAgentRepository(db);
  await agents.ensureCatalog();

  const briefing = createBriefingRepository(db);
  await briefing.ensureDemoFinanceRoom({
    tenantId: Ids.tenant(DEMO_TENANT_ID),
    chainId: Ids.chain(DEMO_CHAIN_ID),
    hostUserId: Ids.user(userId),
  });

  const turbo = createTurboRepository(db);
  await turbo.ensureDemo({
    tenantId: Ids.tenant(DEMO_TENANT_ID),
    hostUserId: Ids.user(userId),
    hotelTlvId: DEMO_HOTEL_TLV_ID,
    hotelEilatId: DEMO_HOTEL_EILAT_ID,
  });
}

function ensureHotel(
  db: HotelOsDb,
  input: {
    id: string;
    name: string;
    timezone: string;
    currency: string;
    createdAt: string;
  },
): void {
  const existing = db
    .select()
    .from(hotels)
    .where(eq(hotels.id, input.id))
    .get();
  if (existing) {
    return;
  }

  db.insert(hotels)
    .values({
      id: input.id,
      tenantId: DEMO_TENANT_ID,
      chainId: DEMO_CHAIN_ID,
      name: input.name,
      timezone: input.timezone,
      currency: input.currency,
      createdAt: input.createdAt,
    })
    .run();
}

function ensureDemoRooms(
  db: HotelOsDb,
  hotelId: string,
  createdAt: string,
  items: readonly {
    id: string;
    number: string;
    floor: string;
    roomType: string;
    status: string;
  }[],
): void {
  for (const item of items) {
    const existing = db
      .select()
      .from(rooms)
      .where(eq(rooms.id, item.id))
      .get();
    if (existing) {
      continue;
    }
    db.insert(rooms)
      .values({
        id: item.id,
        tenantId: DEMO_TENANT_ID,
        hotelId,
        number: item.number,
        floor: item.floor,
        roomType: item.roomType,
        status: item.status,
        createdAt,
      })
      .run();
  }
}

function ensureDemoBookings(
  db: HotelOsDb,
  createdAt: string,
  items: readonly {
    id: string;
    hotelId: string;
    roomId: string;
    guestName: string;
    guestEmail: string;
    checkInDate: string;
    checkOutDate: string;
    status: string;
  }[],
): void {
  for (const item of items) {
    const existing = db
      .select()
      .from(bookings)
      .where(eq(bookings.id, item.id))
      .get();
    if (existing) {
      continue;
    }
    db.insert(bookings)
      .values({
        id: item.id,
        tenantId: DEMO_TENANT_ID,
        hotelId: item.hotelId,
        roomId: item.roomId,
        guestName: item.guestName,
        guestEmail: item.guestEmail,
        checkInDate: item.checkInDate,
        checkOutDate: item.checkOutDate,
        status: item.status,
        createdAt,
      })
      .run();
  }
}
