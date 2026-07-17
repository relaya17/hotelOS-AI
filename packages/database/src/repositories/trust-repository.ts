import { and, desc, eq } from "drizzle-orm";
import type { TenantId, UserId } from "@hotelos/shared";
import { createHash, randomBytes } from "node:crypto";
import type { HotelOsDb } from "../client.js";
import {
  attendanceEvents,
  authChallenges,
  cookieConsents,
  digitalSignatures,
  oauthIdentities,
  paymentIntents,
  voiceEnrollments,
  webauthnCredentials,
} from "../schema/trust.js";

export type TrustRepository = {
  saveCookieConsent: (input: {
    readonly id: string;
    readonly tenantId: TenantId | null;
    readonly subjectKey: string;
    readonly necessary: boolean;
    readonly functional: boolean;
    readonly policyVersion: string;
    readonly createdAt: string;
  }) => Promise<void>;
  createPaymentIntent: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly hotelId: string | null;
    readonly amountMinor: number;
    readonly currency: string;
    readonly description: string;
    readonly payerEmail: string | null;
    readonly createdAt: string;
  }) => Promise<{
    readonly id: string;
    readonly status: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly description: string;
    readonly provider: string;
  }>;
  confirmPaymentIntent: (
    tenantId: TenantId,
    paymentId: string,
  ) => Promise<{
    readonly id: string;
    readonly status: string;
    readonly confirmedAt: string;
  } | null>;
  listPayments: (tenantId: TenantId) => Promise<
    readonly {
      readonly id: string;
      readonly amountMinor: number;
      readonly currency: string;
      readonly status: string;
      readonly description: string;
      readonly provider: string;
      readonly createdAt: string;
      readonly confirmedAt: string | null;
    }[]
  >;
  createSignature: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly subjectType: string;
    readonly subjectId: string;
    readonly signerName: string;
    readonly signerUserId: UserId | null;
    readonly purpose: string;
    readonly imageDataUrl: string;
    readonly createdAt: string;
  }) => Promise<{
    readonly id: string;
    readonly contentHash: string;
    readonly purpose: string;
    readonly createdAt: string;
  }>;
  createChallenge: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly userId: UserId | null;
    readonly purpose: string;
    readonly ttlSeconds: number;
  }) => Promise<{ readonly id: string; readonly challenge: string; readonly expiresAt: string }>;
  consumeChallenge: (
    tenantId: TenantId,
    challenge: string,
    purpose: string,
  ) => Promise<{ readonly id: string; readonly userId: string | null } | null>;
  saveWebAuthnCredential: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly credentialId: string;
    readonly publicKeyJwkJson: string;
    readonly deviceLabel: string;
    readonly createdAt: string;
  }) => Promise<void>;
  listWebAuthnCredentials: (
    tenantId: TenantId,
    userId: UserId,
  ) => Promise<readonly { readonly credentialId: string; readonly deviceLabel: string }[]>;
  findWebAuthnCredential: (
    credentialId: string,
  ) => Promise<{
    readonly userId: string;
    readonly tenantId: string;
    readonly publicKeyJwkJson: string;
  } | null>;
  linkOAuthIdentity: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly provider: string;
    readonly providerSubject: string;
    readonly email: string;
    readonly createdAt: string;
  }) => Promise<void>;
  findOAuthIdentity: (
    provider: string,
    providerSubject: string,
  ) => Promise<{ readonly userId: string; readonly tenantId: string; readonly email: string } | null>;
  enrollVoice: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly phrase: string;
    readonly sampleHash: string;
    readonly createdAt: string;
  }) => Promise<void>;
  verifyVoice: (
    tenantId: TenantId,
    userId: UserId,
    sampleHash: string,
  ) => Promise<boolean>;
  recordAttendance: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly hotelId: string;
    readonly employeeId: string;
    readonly userId: UserId | null;
    readonly eventType: "clock_in" | "clock_out";
    readonly occurredAt: string;
    readonly latitude: number | null;
    readonly longitude: number | null;
    readonly accuracyMeters: number | null;
    readonly deviceLabel: string;
    readonly signatureId: string | null;
    readonly voiceVerified: boolean;
    readonly webauthnVerified: boolean;
    readonly note: string | null;
    readonly createdAt: string;
  }) => Promise<{
    readonly id: string;
    readonly eventType: string;
    readonly occurredAt: string;
    readonly employeeId: string;
    readonly hotelId: string;
  }>;
  listAttendance: (
    tenantId: TenantId,
  ) => Promise<
    readonly {
      readonly id: string;
      readonly employeeId: string;
      readonly hotelId: string;
      readonly eventType: string;
      readonly occurredAt: string;
      readonly latitude: number | null;
      readonly longitude: number | null;
      readonly deviceLabel: string;
      readonly voiceVerified: boolean;
      readonly webauthnVerified: boolean;
      readonly note: string | null;
    }[]
  >;
};

function hashSignature(imageDataUrl: string): string {
  return createHash("sha256").update(imageDataUrl).digest("hex");
}

export function createTrustRepository(db: HotelOsDb): TrustRepository {
  return {
    async saveCookieConsent(input) {
      await db.insert(cookieConsents)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          subjectKey: input.subjectKey,
          necessary: input.necessary ? "1" : "0",
          functional: input.functional ? "1" : "0",
          policyVersion: input.policyVersion,
          createdAt: input.createdAt,
        })
        .run();
    },

    async createPaymentIntent(input) {
      await db.insert(paymentIntents)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          amountMinor: String(input.amountMinor),
          currency: input.currency,
          status: "requires_confirmation",
          description: input.description,
          payerEmail: input.payerEmail,
          provider: "hotelos.payments",
          createdAt: input.createdAt,
          confirmedAt: null,
        })
        .run();
      return {
        id: input.id,
        status: "requires_confirmation",
        amountMinor: input.amountMinor,
        currency: input.currency,
        description: input.description,
        provider: "hotelos.payments",
      };
    },

    async confirmPaymentIntent(tenantId, paymentId) {
      const row = await db
        .select()
        .from(paymentIntents)
        .where(
          and(
            eq(paymentIntents.id, paymentId),
            eq(paymentIntents.tenantId, tenantId),
          ),
        )
        .get();
      if (!row || row.status === "succeeded") {
        return row
          ? {
              id: row.id,
              status: row.status,
              confirmedAt: row.confirmedAt ?? row.createdAt,
            }
          : null;
      }
      const confirmedAt = new Date().toISOString();
      await db.update(paymentIntents)
        .set({ status: "succeeded", confirmedAt })
        .where(eq(paymentIntents.id, paymentId))
        .run();
      return { id: paymentId, status: "succeeded", confirmedAt };
    },

    async listPayments(tenantId) {
      const rows = await db
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.tenantId, tenantId))
        .orderBy(desc(paymentIntents.createdAt))
        .all();
      return rows.map((row) => ({
        id: row.id,
        amountMinor: Number(row.amountMinor),
        currency: row.currency,
        status: row.status,
        description: row.description,
        provider: row.provider,
        createdAt: row.createdAt,
        confirmedAt: row.confirmedAt,
      }));
    },

    async createSignature(input) {
      const contentHash = hashSignature(input.imageDataUrl);
      await db.insert(digitalSignatures)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          signerName: input.signerName,
          signerUserId: input.signerUserId,
          purpose: input.purpose,
          imageDataUrl: input.imageDataUrl,
          contentHash,
          createdAt: input.createdAt,
        })
        .run();
      return {
        id: input.id,
        contentHash,
        purpose: input.purpose,
        createdAt: input.createdAt,
      };
    },

    async createChallenge(input) {
      const challenge = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        Date.now() + input.ttlSeconds * 1000,
      ).toISOString();
      const createdAt = new Date().toISOString();
      await db.insert(authChallenges)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          userId: input.userId,
          purpose: input.purpose,
          challenge,
          expiresAt,
          consumedAt: null,
          createdAt,
        })
        .run();
      return { id: input.id, challenge, expiresAt };
    },

    async consumeChallenge(tenantId, challenge, purpose) {
      const row = await db
        .select()
        .from(authChallenges)
        .where(
          and(
            eq(authChallenges.tenantId, tenantId),
            eq(authChallenges.challenge, challenge),
            eq(authChallenges.purpose, purpose),
          ),
        )
        .get();
      if (!row || row.consumedAt !== null) return null;
      if (new Date(row.expiresAt).getTime() < Date.now()) return null;
      await db.update(authChallenges)
        .set({ consumedAt: new Date().toISOString() })
        .where(eq(authChallenges.id, row.id))
        .run();
      return { id: row.id, userId: row.userId };
    },

    async saveWebAuthnCredential(input) {
      await db.insert(webauthnCredentials)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          userId: input.userId,
          credentialId: input.credentialId,
          publicKeyJwkJson: input.publicKeyJwkJson,
          deviceLabel: input.deviceLabel,
          createdAt: input.createdAt,
        })
        .run();
    },

    async listWebAuthnCredentials(tenantId, userId) {
      const rows = await db
        .select()
        .from(webauthnCredentials)
        .where(
          and(
            eq(webauthnCredentials.tenantId, tenantId),
            eq(webauthnCredentials.userId, userId),
          ),
        )
        .all();
      return rows.map((row) => ({
        credentialId: row.credentialId,
        deviceLabel: row.deviceLabel,
      }));
    },

    async findWebAuthnCredential(credentialId) {
      const row = await db
        .select()
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.credentialId, credentialId))
        .get();
      if (!row) return null;
      return {
        userId: row.userId,
        tenantId: row.tenantId,
        publicKeyJwkJson: row.publicKeyJwkJson,
      };
    },

    async linkOAuthIdentity(input) {
      const existing = await db
        .select()
        .from(oauthIdentities)
        .where(
          and(
            eq(oauthIdentities.provider, input.provider),
            eq(oauthIdentities.providerSubject, input.providerSubject),
          ),
        )
        .get();
      if (existing) return;
      await db.insert(oauthIdentities)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          userId: input.userId,
          provider: input.provider,
          providerSubject: input.providerSubject,
          email: input.email,
          createdAt: input.createdAt,
        })
        .run();
    },

    async findOAuthIdentity(provider, providerSubject) {
      const row = await db
        .select()
        .from(oauthIdentities)
        .where(
          and(
            eq(oauthIdentities.provider, provider),
            eq(oauthIdentities.providerSubject, providerSubject),
          ),
        )
        .get();
      if (!row) return null;
      return {
        userId: row.userId,
        tenantId: row.tenantId,
        email: row.email,
      };
    },

    async enrollVoice(input) {
      await db.insert(voiceEnrollments)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          userId: input.userId,
          phrase: input.phrase,
          sampleHash: input.sampleHash,
          createdAt: input.createdAt,
        })
        .run();
    },

    async verifyVoice(tenantId, userId, sampleHash) {
      const row = await db
        .select()
        .from(voiceEnrollments)
        .where(
          and(
            eq(voiceEnrollments.tenantId, tenantId),
            eq(voiceEnrollments.userId, userId),
          ),
        )
        .orderBy(desc(voiceEnrollments.createdAt))
        .get();
      return row !== undefined && row.sampleHash === sampleHash;
    },

    async recordAttendance(input) {
      await db.insert(attendanceEvents)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          employeeId: input.employeeId,
          userId: input.userId,
          eventType: input.eventType,
          occurredAt: input.occurredAt,
          latitude:
            input.latitude === null ? null : String(input.latitude),
          longitude:
            input.longitude === null ? null : String(input.longitude),
          accuracyMeters:
            input.accuracyMeters === null
              ? null
              : String(input.accuracyMeters),
          deviceLabel: input.deviceLabel,
          signatureId: input.signatureId,
          voiceVerified: input.voiceVerified ? "1" : "0",
          webauthnVerified: input.webauthnVerified ? "1" : "0",
          note: input.note,
          createdAt: input.createdAt,
        })
        .run();
      return {
        id: input.id,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        employeeId: input.employeeId,
        hotelId: input.hotelId,
      };
    },

    async listAttendance(tenantId) {
      const rows = await db
        .select()
        .from(attendanceEvents)
        .where(eq(attendanceEvents.tenantId, tenantId))
        .orderBy(desc(attendanceEvents.occurredAt))
        .all();
      return rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        hotelId: row.hotelId,
        eventType: row.eventType,
        occurredAt: row.occurredAt,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        deviceLabel: row.deviceLabel,
        voiceVerified: row.voiceVerified === "1",
        webauthnVerified: row.webauthnVerified === "1",
        note: row.note,
      }));
    },
  };
}

export function hashVoiceSample(base64Audio: string): string {
  return createHash("sha256").update(base64Audio).digest("hex");
}
