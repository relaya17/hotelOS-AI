import { z } from "@hotelos/validation";

export const roomIdSchema = z.string().uuid();
export const roomKindSchema = z.enum(["committee", "training", "all_hands"]);

export const createRoomSchema = z.object({
  title: z.string().trim().min(3).max(160),
  purpose: z.string().trim().min(2).max(80),
  roomKind: roomKindSchema.default("committee"),
  participants: z
    .array(
      z.object({
        displayName: z.string().trim().min(2).max(120),
        roleLabel: z.string().trim().min(2).max(120),
      }),
    )
    .max(20)
    .default([]),
});

export const joinRoomSchema = z.object({
  inviteToken: z.string().uuid(),
});

export const recordingConsentSchema = z.object({
  accepted: z.literal(true),
});

export const createGoalSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).default(""),
  ownerDisplayName: z.string().trim().min(2).max(120).optional(),
  ownerUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateGoalStatusSchema = z.object({
  status: z.enum(["open", "done", "cancelled"]),
});

export const shareAgentSchema = z.object({
  agentId: z.string().min(3).max(80),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const consultSchema = z.object({
  prompt: z.string().trim().max(500).optional(),
});
