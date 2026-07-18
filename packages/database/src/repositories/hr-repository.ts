import { and, desc, eq, like } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { users } from "../schema/tenancy.js";
import { employeeProfiles } from "../schema/turbo.js";
import { employeeDocuments, employeeInvites } from "../schema/hr.js";

export type PersistedEmployeeInvite = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly departmentId: string | null;
  readonly email: string;
  readonly displayNameHint: string;
  readonly roleHint: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly createdAt: string;
  /** Present only when the invite is freshly created (plaintext token). */
  readonly token?: string;
};

export type PersistedHrEmployee = {
  readonly id: string;
  readonly userId: string | null;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly preferredLocale: string;
  readonly hotelId: string | null;
  readonly employeeCode: string | null;
  readonly phone: string | null;
  readonly status: string;
  readonly departmentId: string | null;
  readonly createdAt: string;
};

export type CompleteInviteInput = {
  readonly displayName: string;
  readonly phone?: string;
  readonly nationalId?: string;
  readonly address?: string;
  readonly emergencyContactName?: string;
  readonly emergencyContactPhone?: string;
  readonly preferredLocale: string;
  readonly passwordHash: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type HrRepository = {
  createInvite: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly departmentId?: string;
    readonly email: string;
    readonly displayNameHint: string;
    readonly roleHint: string;
    readonly createdByUserId: UserId;
    readonly expiresAt: string;
    readonly createdAt: string;
  }) => Promise<PersistedEmployeeInvite>;
  findInviteByToken: (token: string) => Promise<PersistedEmployeeInvite | null>;
  listInvites: (tenantId: TenantId, hotelId: HotelId) => Promise<readonly PersistedEmployeeInvite[]>;
  completeInvite: (
    token: string,
    input: CompleteInviteInput,
  ) => Promise<
    | { readonly ok: true; readonly employee: PersistedHrEmployee; readonly userId: string }
    | {
        readonly ok: false;
        readonly reason:
          | "NOT_FOUND"
          | "EXPIRED"
          | "CONSUMED"
          | "EMAIL_TAKEN";
      }
  >;
  listEmployees: (
    tenantId: TenantId,
    hotelId?: HotelId,
  ) => Promise<readonly PersistedHrEmployee[]>;
  getEmployee: (
    tenantId: TenantId,
    employeeId: string,
  ) => Promise<PersistedHrEmployee | null>;
  registerDocumentFlag: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly employeeId: string;
    readonly docType: string;
    readonly contentHash?: string;
    readonly issuingAuthority?: string;
    readonly issuedAt?: string;
    readonly expiresAt?: string;
    readonly notes?: string;
    readonly uploadedAt: string;
  }) => Promise<void>;
  listDocuments: (
    tenantId: TenantId,
    employeeId: string,
  ) => Promise<
    readonly {
      readonly id: string;
      readonly docType: string;
      readonly status: string;
      readonly issuingAuthority: string | null;
      readonly expiresAt: string | null;
      readonly uploadedAt: string;
    }[]
  >;
};

function mapInvite(
  row: typeof employeeInvites.$inferSelect,
  token?: string,
): PersistedEmployeeInvite {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId,
    departmentId: row.departmentId ?? null,
    email: row.email,
    displayNameHint: row.displayNameHint,
    roleHint: row.roleHint,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt ?? null,
    createdAt: row.createdAt,
    ...(token !== undefined ? { token } : {}),
  };
}

function mapEmployee(row: typeof employeeProfiles.$inferSelect): PersistedHrEmployee {
  return {
    id: row.id,
    userId: row.userId ?? null,
    displayName: row.displayName,
    roleLabel: row.roleLabel,
    preferredLocale: row.preferredLocale,
    hotelId: row.hotelId ?? null,
    employeeCode: row.employeeCode ?? null,
    phone: row.phone ?? null,
    status: row.status ?? "active",
    departmentId: row.departmentId ?? null,
    createdAt: row.createdAt,
  };
}

export function createHrRepository(db: HotelOsDb): HrRepository {
  return {
    async createInvite(input) {
      const token = randomBytes(24).toString("base64url");
      await db
        .insert(employeeInvites)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          departmentId: input.departmentId ?? null,
          email: input.email.trim().toLowerCase(),
          displayNameHint: input.displayNameHint,
          roleHint: input.roleHint,
          inviteTokenHash: hashToken(token),
          createdByUserId: input.createdByUserId,
          expiresAt: input.expiresAt,
          consumedAt: null,
          createdAt: input.createdAt,
        })
        .run();
      const row = await db
        .select()
        .from(employeeInvites)
        .where(eq(employeeInvites.id, input.id))
        .get();
      if (!row) throw new Error("INVITE_CREATE_FAILED");
      return mapInvite(row, token);
    },

    async findInviteByToken(token) {
      const row = await db
        .select()
        .from(employeeInvites)
        .where(eq(employeeInvites.inviteTokenHash, hashToken(token)))
        .get();
      return row ? mapInvite(row) : null;
    },

    async listInvites(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(employeeInvites)
        .where(
          and(
            eq(employeeInvites.tenantId, tenantId),
            eq(employeeInvites.hotelId, hotelId),
          ),
        )
        .orderBy(desc(employeeInvites.createdAt))
        .all();
      return rows.map((row) => mapInvite(row));
    },

    async completeInvite(token, input) {
      const invite = await db
        .select()
        .from(employeeInvites)
        .where(eq(employeeInvites.inviteTokenHash, hashToken(token)))
        .get();
      if (!invite) return { ok: false, reason: "NOT_FOUND" };
      if (invite.consumedAt) return { ok: false, reason: "CONSUMED" };
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        return { ok: false, reason: "EXPIRED" };
      }

      const email = invite.email.trim().toLowerCase();
      const existing = await db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, invite.tenantId), eq(users.email, email)))
        .get();
      if (existing) return { ok: false, reason: "EMAIL_TAKEN" };

      const year = new Date().getFullYear();
      const prefix = `EMP-${year}-`;
      const latest = await db
        .select({ code: employeeProfiles.employeeCode })
        .from(employeeProfiles)
        .where(
          and(
            eq(employeeProfiles.tenantId, invite.tenantId),
            like(employeeProfiles.employeeCode, `${prefix}%`),
          ),
        )
        .all();
      let maxSeq = 0;
      for (const row of latest) {
        const raw = row.code ?? "";
        const seq = Number(raw.slice(prefix.length));
        if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
      }
      const employeeCode = `${prefix}${String(maxSeq + 1).padStart(5, "0")}`;

      const userId = crypto.randomUUID();
      const employeeId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db
        .insert(users)
        .values({
          id: userId,
          tenantId: invite.tenantId,
          chainId: null,
          hotelId: invite.hotelId,
          departmentId: invite.departmentId,
          email,
          displayName: input.displayName.trim(),
          passwordHash: input.passwordHash,
          rolesJson: JSON.stringify(["employee"]),
          createdAt: now,
        })
        .run();

      await db
        .insert(employeeProfiles)
        .values({
          id: employeeId,
          tenantId: invite.tenantId,
          userId,
          displayName: input.displayName.trim(),
          roleLabel: invite.roleHint,
          preferredLocale: input.preferredLocale,
          hotelId: invite.hotelId,
          employeeCode,
          phone: input.phone ?? null,
          nationalId: input.nationalId ?? null,
          address: input.address ?? null,
          emergencyContactName: input.emergencyContactName ?? null,
          emergencyContactPhone: input.emergencyContactPhone ?? null,
          status: "active",
          departmentId: invite.departmentId,
          createdAt: now,
        })
        .run();

      await db
        .update(employeeInvites)
        .set({ consumedAt: now })
        .where(eq(employeeInvites.id, invite.id))
        .run();

      const employee = await db
        .select()
        .from(employeeProfiles)
        .where(eq(employeeProfiles.id, employeeId))
        .get();
      if (!employee) throw new Error("EMPLOYEE_CREATE_FAILED");
      return { ok: true, employee: mapEmployee(employee), userId };
    },

    async listEmployees(tenantId, hotelId) {
      const rows = hotelId
        ? await db
            .select()
            .from(employeeProfiles)
            .where(
              and(
                eq(employeeProfiles.tenantId, tenantId),
                eq(employeeProfiles.hotelId, hotelId),
              ),
            )
            .orderBy(desc(employeeProfiles.createdAt))
            .all()
        : await db
            .select()
            .from(employeeProfiles)
            .where(eq(employeeProfiles.tenantId, tenantId))
            .orderBy(desc(employeeProfiles.createdAt))
            .all();
      return rows.map(mapEmployee);
    },

    async getEmployee(tenantId, employeeId) {
      const row = await db
        .select()
        .from(employeeProfiles)
        .where(
          and(
            eq(employeeProfiles.tenantId, tenantId),
            eq(employeeProfiles.id, employeeId),
          ),
        )
        .get();
      return row ? mapEmployee(row) : null;
    },

    async registerDocumentFlag(input) {
      await db
        .insert(employeeDocuments)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          docType: input.docType,
          contentHash: input.contentHash ?? null,
          issuingAuthority: input.issuingAuthority ?? null,
          issuedAt: input.issuedAt ?? null,
          expiresAt: input.expiresAt ?? null,
          status: "pending_review",
          reviewedByUserId: null,
          reviewedAt: null,
          notes: input.notes ?? null,
          uploadedAt: input.uploadedAt,
          createdAt: input.uploadedAt,
        })
        .run();
    },

    async listDocuments(tenantId, employeeId) {
      const rows = await db
        .select()
        .from(employeeDocuments)
        .where(
          and(
            eq(employeeDocuments.tenantId, tenantId),
            eq(employeeDocuments.employeeId, employeeId),
          ),
        )
        .orderBy(desc(employeeDocuments.createdAt))
        .all();
      return rows.map((row) => ({
        id: row.id,
        docType: row.docType,
        status: row.status,
        issuingAuthority: row.issuingAuthority ?? null,
        expiresAt: row.expiresAt ?? null,
        uploadedAt: row.uploadedAt,
      }));
    },
  };
}
