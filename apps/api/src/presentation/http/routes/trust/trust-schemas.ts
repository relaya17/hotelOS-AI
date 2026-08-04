import { z } from "@hotelos/validation";

export const cookieSchema = z.object({
  subjectKey: z.string().trim().min(8).max(120),
  necessary: z.boolean(),
  functional: z.boolean(),
  tenantId: z.string().uuid().optional(),
});

export const paymentSchema = z.object({
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.string().length(3).default("ILS"),
  description: z.string().trim().min(2).max(200),
  hotelId: z.string().uuid().optional(),
  payerEmail: z.string().email().optional(),
});

export const signatureSchema = z.object({
  subjectType: z.enum(["attendance", "booking", "payment", "document"]),
  subjectId: z.string().trim().min(2).max(80),
  signerName: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(2).max(160),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,/)
    .max(1_500_000),
});

export const webauthnRegisterSchema = z.object({
  credentialId: z.string().min(8).max(512),
  publicKeyJwkJson: z.string().min(2).max(8000),
  deviceLabel: z.string().trim().min(2).max(80).default("Platform authenticator"),
  challenge: z.string().min(16).max(200),
});

export const webauthnAssertSchema = z.object({
  tenantId: z.string().uuid(),
  credentialId: z.string().min(8).max(512),
  challenge: z.string().min(16).max(200),
  clientDataJSON: z.string().min(8).max(4000),
  authenticatorData: z.string().min(8).max(8000),
  signature: z.string().min(8).max(8000),
});

export const webauthnLoginChallengeSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
});

export const voiceSchema = z.object({
  phrase: z.string().trim().min(2).max(120).default("HotelOS attendance"),
  sampleBase64: z.string().min(16).max(2_000_000),
});

export const attendanceSchema = z.object({
  employeeId: z.string().uuid(),
  hotelId: z.string().uuid(),
  eventType: z.enum(["clock_in", "clock_out"]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().positive().max(5000).optional(),
  deviceLabel: z.string().trim().min(2).max(80).default("mobile"),
  signatureId: z.string().uuid().optional(),
  voiceSampleBase64: z.string().min(16).max(2_000_000).optional(),
  webauthnCredentialId: z.string().min(8).max(512).optional(),
  webauthnChallenge: z.string().min(16).max(200).optional(),
  webauthnClientDataJSON: z.string().min(8).max(4000).optional(),
  webauthnAuthenticatorData: z.string().min(8).max(8000).optional(),
  webauthnSignature: z.string().min(8).max(8000).optional(),
  note: z.string().trim().max(240).optional(),
});

export const googleDemoSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email().default("admin@demo.hotelos.local"),
});
