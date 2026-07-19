import { eq } from "drizzle-orm";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "./client.js";
import { createAgentRepository } from "./repositories/agent-repository.js";
import { createBriefingRepository } from "./repositories/briefing-repository.js";
import { createFeedbackRepository } from "./repositories/feedback-repository.js";
import { createKashrutRepository } from "./repositories/kashrut-repository.js";
import { createMaintenanceRepository } from "./repositories/maintenance-repository.js";
import { createOpsRepository } from "./repositories/ops-repository.js";
import { createOrgCommsRepository } from "./repositories/org-comms-repository.js";
import { createTrustedSourcesRepository } from "./repositories/trusted-sources-repository.js";
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

  const existingTenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, DEMO_TENANT_ID))
    .get();

  if (!existingTenant) {
    await db.insert(tenants)
      .values({
        id: DEMO_TENANT_ID,
        name: "Demo Hospitality Group",
        slug: "demo",
        createdAt: now,
      })
      .run();
  }

  const existingChain = await db
    .select()
    .from(hotelChains)
    .where(eq(hotelChains.id, DEMO_CHAIN_ID))
    .get();

  if (!existingChain) {
    await db.insert(hotelChains)
      .values({
        id: DEMO_CHAIN_ID,
        tenantId: DEMO_TENANT_ID,
        name: "Demo Chain Israel",
        createdAt: now,
      })
      .run();
  }

  await ensureHotel(db, {
    id: DEMO_HOTEL_TLV_ID,
    name: "Demo Hotel Tel Aviv",
    timezone: "Asia/Jerusalem",
    currency: "ILS",
    kashrutEnabled: true,
    createdAt: now,
  });

  await ensureHotel(db, {
    id: DEMO_HOTEL_EILAT_ID,
    name: "Demo Hotel Eilat",
    timezone: "Asia/Jerusalem",
    currency: "ILS",
    kashrutEnabled: false,
    createdAt: now,
  });

  await ensureDemoRooms(db, DEMO_HOTEL_TLV_ID, now, [
    { id: "70000000-0000-4000-8000-000000000101", number: "101", floor: "1", roomType: "standard", status: "vacant" },
    { id: "70000000-0000-4000-8000-000000000102", number: "102", floor: "1", roomType: "standard", status: "dirty" },
    { id: "70000000-0000-4000-8000-000000000201", number: "201", floor: "2", roomType: "suite", status: "occupied" },
    { id: "70000000-0000-4000-8000-000000000301", number: "301", floor: "3", roomType: "deluxe", status: "maintenance" },
  ]);

  await ensureDemoRooms(db, DEMO_HOTEL_EILAT_ID, now, [
    { id: "70000000-0000-4000-8000-000000000401", number: "401", floor: "4", roomType: "standard", status: "vacant" },
    { id: "70000000-0000-4000-8000-000000000402", number: "402", floor: "4", roomType: "sea_view", status: "occupied" },
    { id: "70000000-0000-4000-8000-000000000501", number: "501", floor: "5", roomType: "suite", status: "dirty" },
  ]);

  await ensureDemoBookings(db, now, [
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

  const existingDepartment = await db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .get();

  if (!existingDepartment) {
    await db.insert(departments)
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

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!existingUser) {
    const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
    await db.insert(users)
      .values({
        id: userId,
        tenantId: DEMO_TENANT_ID,
        chainId: DEMO_CHAIN_ID,
        hotelId: DEMO_HOTEL_TLV_ID,
        departmentId,
        email: DEMO_USER_EMAIL,
        displayName: "Demo Admin",
        passwordHash,
        // Includes dedicated `hr` so local demo can review תעודת יושר (PO: not admin alone).
        rolesJson: JSON.stringify(["admin", "executive", "hr"]),
        createdAt: now,
      })
      .run();
  } else {
    const roles = parseRolesJson(existingUser.rolesJson);
    if (!roles.includes("hr")) {
      await db
        .update(users)
        .set({ rolesJson: JSON.stringify([...roles, "hr"]) })
        .where(eq(users.id, userId))
        .run();
    }
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

  await ensureOpsDemoData(db, now, userId);
  await ensureCioDemoData(db, now, userId);
}

async function ensureHotel(
  db: HotelOsDb,
  input: {
    id: string;
    name: string;
    timezone: string;
    currency: string;
    kashrutEnabled: boolean;
    createdAt: string;
  },
): Promise<void> {
  const existing = await db
    .select()
    .from(hotels)
    .where(eq(hotels.id, input.id))
    .get();
  if (existing) {
    return;
  }

  await db.insert(hotels)
    .values({
      id: input.id,
      tenantId: DEMO_TENANT_ID,
      chainId: DEMO_CHAIN_ID,
      name: input.name,
      timezone: input.timezone,
      currency: input.currency,
      kashrutEnabled: input.kashrutEnabled ? 1 : 0,
      createdAt: input.createdAt,
    })
    .run();
}

async function ensureDemoRooms(
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
): Promise<void> {
  for (const item of items) {
    const existing = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, item.id))
      .get();
    if (existing) {
      continue;
    }
    await db.insert(rooms)
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

async function ensureDemoBookings(
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
): Promise<void> {
  for (const item of items) {
    const existing = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, item.id))
      .get();
    if (existing) {
      continue;
    }
    await db.insert(bookings)
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

async function ensureOpsDemoData(
  db: HotelOsDb,
  now: string,
  userId: string,
): Promise<void> {
  const tenantId = Ids.tenant(DEMO_TENANT_ID);
  const hotelTlv = Ids.hotel(DEMO_HOTEL_TLV_ID);
  const hotelEilat = Ids.hotel(DEMO_HOTEL_EILAT_ID);

  const ops = createOpsRepository(db);
  await ops.ensureStandardDepartments(tenantId, hotelTlv, now);
  await ops.ensureStandardDepartments(tenantId, hotelEilat, now);

  const maintenanceDept = await ops.findDepartmentByCode(
    tenantId,
    hotelTlv,
    "maintenance",
  );
  const housekeepingDept = await ops.findDepartmentByCode(
    tenantId,
    hotelTlv,
    "housekeeping",
  );

  if (housekeepingDept) {
    const existingTasks = await ops.listTasksByDepartment(
      tenantId,
      hotelTlv,
      housekeepingDept.id,
    );
    if (existingTasks.length === 0) {
      await ops.createTask({
        id: "90000000-0000-4000-8000-000000000001",
        tenantId,
        hotelId: hotelTlv,
        departmentId: housekeepingDept.id,
        taskType: "linen_shortage",
        title: "מחסור במגבות בקומה 2",
        description: "יש להשלים מלאי מגבות בחדרי הקומה השנייה.",
        priority: "medium",
        createdByUserId: userId,
        createdAt: now,
      });
    }
  }

  const maintenance = createMaintenanceRepository(db);
  const existingRequests = await maintenance.listByHotel(tenantId, hotelTlv);
  if (existingRequests.length === 0) {
    await maintenance.createRequest({
      id: "90000000-0000-4000-8000-000000000002",
      tenantId,
      hotelId: hotelTlv,
      category: "pool",
      title: "בעיית סינון בבריכה",
      description: "משאבת הסינון בבריכה משמיעה רעש חריג, דורש בדיקת קבלן.",
      priority: "high",
      createdByUserId: userId,
      createdAt: now,
    });

    const vendor = await maintenance.createVendor({
      id: "90000000-0000-4000-8000-000000000003",
      tenantId,
      hotelId: hotelTlv,
      name: "פתרונות בריכה בע\"מ",
      category: "contractor",
      contactName: "יוסי מזרחי",
      phone: "050-1234567",
      createdAt: now,
    });

    await maintenance.addQuote({
      id: "90000000-0000-4000-8000-000000000004",
      tenantId,
      maintenanceRequestId: "90000000-0000-4000-8000-000000000002",
      vendorId: vendor.id,
      amount: 2400,
      currency: "ILS",
      submittedAt: now,
    });
  }

  const feedback = createFeedbackRepository(db);
  const existingFeedback = await feedback.listByHotel(tenantId, hotelTlv);
  if (existingFeedback.length === 0) {
    await feedback.submit({
      id: "90000000-0000-4000-8000-000000000005",
      tenantId,
      hotelId: hotelTlv,
      rating: 4,
      categories: ["pool", "service"],
      comment: "השהייה הייתה נהדרת, רק הבריכה הייתה קצת רועשת.",
      source: "guest_app_survey",
      submittedAt: now,
    });
  }

  void maintenanceDept;
}

/** ADR 0007 — org comms channels, trusted knowledge sources, sample kashrut note. */
async function ensureCioDemoData(
  db: HotelOsDb,
  now: string,
  userId: string,
): Promise<void> {
  const tenantId = Ids.tenant(DEMO_TENANT_ID);
  const chainId = Ids.chain(DEMO_CHAIN_ID);
  const hotelTlv = Ids.hotel(DEMO_HOTEL_TLV_ID);

  const orgComms = createOrgCommsRepository(db);
  const chainWideChannels: readonly { key: string; nameHe: string }[] = [
    { key: "owner_ceo", nameHe: "בעלים ↔ מנכ״ל" },
    { key: "ceo_pr", nameHe: "מנכ״ל ↔ יחסי ציבור" },
    { key: "ceo_hr", nameHe: "מנכ״ל ↔ משאבי אנוש" },
    { key: "ceo_fb", nameHe: "מנכ״ל ↔ מזון ומשקאות" },
    { key: "ceo_rooms_hk", nameHe: "מנכ״ל ↔ חדרים ומשק בית" },
    { key: "ceo_reception", nameHe: "מנכ״ל ↔ קבלה" },
    { key: "ceo_maintenance", nameHe: "מנכ״ל ↔ תחזוקה" },
    { key: "ceo_security", nameHe: "מנכ״ל ↔ אבטחה" },
    { key: "ceo_finance", nameHe: "מנכ״ל ↔ כספים" },
  ];
  for (const [index, channel] of chainWideChannels.entries()) {
    await orgComms.ensureChannel({
      id: `92000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      tenantId,
      chainId,
      channelKey: channel.key,
      nameHe: channel.nameHe,
      createdAt: now,
    });
  }

  const kashrutFbChannel = await orgComms.ensureChannel({
    id: "92000000-0000-4000-8000-000000000010",
    tenantId,
    chainId,
    hotelId: hotelTlv,
    channelKey: "kashrut_fb",
    nameHe: "משגיח כשרות ↔ מנהל F&B (ת״א)",
    createdAt: now,
  });

  const existingKashrutMessages = await orgComms.listMessages(
    tenantId,
    kashrutFbChannel.id,
  );
  if (existingKashrutMessages.length === 0) {
    await orgComms.addMessage({
      id: "93000000-0000-4000-8000-000000000001",
      tenantId,
      channelId: kashrutFbChannel.id,
      fromRole: "kashrut",
      body: "בדקתי את תפריט השבת הקרוב — הכל תקין, אין חריגות.",
      createdAt: now,
    });
  }

  const trustedSources = createTrustedSourcesRepository(db);
  const existingSources = await trustedSources.list(tenantId);
  if (existingSources.length === 0) {
    const seedSources: readonly {
      id: string;
      title: string;
      url: string;
      category: string;
    }[] = [
      {
        id: "94000000-0000-4000-8000-000000000001",
        title: "בנק ישראל — נתוני מקרו ומדיניות מוניטרית",
        url: "https://www.boi.org.il",
        category: "regulator",
      },
      {
        id: "94000000-0000-4000-8000-000000000002",
        title: "רשות המסים בישראל",
        url: "https://www.gov.il/he/departments/israel_tax_authority",
        category: "regulator",
      },
      {
        id: "94000000-0000-4000-8000-000000000003",
        title: "הטכניון — הפקולטה לניהול (מחקר תיירות ואירוח)",
        url: "https://social-sciences.technion.ac.il",
        category: "university",
      },
      {
        id: "94000000-0000-4000-8000-000000000004",
        title: "IFRS Foundation — International Financial Reporting Standards",
        url: "https://www.ifrs.org",
        category: "accounting_standard",
      },
      {
        id: "94000000-0000-4000-8000-000000000005",
        title: "רשות המסים — מדריכים וטפסים (מע״מ / ניכויים)",
        url: "https://www.gov.il/he/departments/israel_tax_authority/govil-landing-page",
        category: "accounting_standard",
      },
    ];
    for (const source of seedSources) {
      await trustedSources.create({
        id: source.id,
        tenantId,
        title: source.title,
        url: source.url,
        category: source.category,
        approvedByUserId: userId,
        createdAt: now,
      });
    }
  } else if (
    !existingSources.some((source) => source.category === "accounting_standard")
  ) {
    // Idempotent upgrade for tenants seeded before stage ז׳ allowlist.
    const accountingSources: readonly {
      id: string;
      title: string;
      url: string;
    }[] = [
      {
        id: "94000000-0000-4000-8000-000000000004",
        title: "IFRS Foundation — International Financial Reporting Standards",
        url: "https://www.ifrs.org",
      },
      {
        id: "94000000-0000-4000-8000-000000000005",
        title: "רשות המסים — מדריכים וטפסים (מע״מ / ניכויים)",
        url: "https://www.gov.il/he/departments/israel_tax_authority/govil-landing-page",
      },
    ];
    for (const source of accountingSources) {
      await trustedSources.create({
        id: source.id,
        tenantId,
        title: source.title,
        url: source.url,
        category: "accounting_standard",
        approvedByUserId: userId,
        createdAt: now,
      });
    }
  }

  const kashrut = createKashrutRepository(db);
  const existingAnnotations = await kashrut.listByHotel(tenantId, hotelTlv);
  if (existingAnnotations.length === 0) {
    await kashrut.create({
      id: "95000000-0000-4000-8000-000000000001",
      tenantId,
      hotelId: hotelTlv,
      targetKind: "menu",
      targetId: "weekly-shabbat-menu",
      status: "note",
      message: "תפריט שבת אושר — יש להקפיד על הפרדת כלים לבשר/חלב במטבח האירועים.",
      createdByUserId: userId,
      createdAt: now,
    });
  }
}

function parseRolesJson(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((role): role is string => typeof role === "string");
  } catch {
    return [];
  }
}
