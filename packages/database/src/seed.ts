import { eq } from "drizzle-orm";
import type { HotelOsDb } from "./client.js";
import {
  departments,
  hotelChains,
  hotels,
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
