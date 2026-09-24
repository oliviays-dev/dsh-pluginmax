import { z } from "zod";

export const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
export const idSchema = z.string().trim().regex(idPattern);
export const isoTimeSchema = z.string().datetime({ precision: 3 });
export const versionSchema = z
  .string()
  .trim()
  .regex(/^v\d+\.\d+$/)
  .max(20);

export const TEAMMATE_SOURCES = ["personal", "platform"] as const;
export const TEAMMATE_STATES = [
  "draft",
  "active",
  "paused",
  "inactive",
  "archived",
] as const;
export const TEAMMATE_EVENT_KINDS = [
  "created",
  "updated",
  "state",
  "archived",
] as const;

export const teammateSourceSchema = z.enum(TEAMMATE_SOURCES);
export const teammateStateSchema = z.enum(TEAMMATE_STATES);
export const teammateEventKindSchema = z.enum(TEAMMATE_EVENT_KINDS);

const ruleSchema = z.string().trim().min(1).max(500);

export const teammateSchema = z.object({
  id: idSchema,
  source: teammateSourceSchema,
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).default(""),
  ownerUserId: idSchema,
  ownerName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4_000).default(""),
  soul: z.string().max(200_000).default(""),
  scenarios: z.array(ruleSchema).max(50).default([]),
  goals: z.array(ruleSchema).max(50).default([]),
  avatar: z.string().max(400_000).default(""),
  state: teammateStateSchema,
  version: versionSchema,
  personaId: idSchema.optional(),
  employeeId: idSchema.optional(),
  createdBy: z.string().min(1).max(160),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export const teammateEventSchema = z.object({
  id: z.string().min(1).max(160),
  teammateId: idSchema,
  seq: z.number().int().nonnegative(),
  at: isoTimeSchema,
  actorUserId: z.string().min(1).max(160),
  actorName: z.string().min(1).max(160),
  kind: teammateEventKindSchema,
  message: z.string().trim().min(1).max(500),
});

export type TeammateSource = z.infer<typeof teammateSourceSchema>;
export type TeammateState = z.infer<typeof teammateStateSchema>;
export type Teammate = z.infer<typeof teammateSchema>;
export type TeammateEvent = z.infer<typeof teammateEventSchema>;
