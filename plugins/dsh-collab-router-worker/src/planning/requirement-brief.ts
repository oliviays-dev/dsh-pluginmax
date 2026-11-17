import { z } from "zod";
import { factsLedgerSchema, requirementBriefSchema } from "./models.js";

export const planningRequirementBriefInputSchema = requirementBriefSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  taskRevision: true,
  version: true,
  createdAt: true,
});

export const planningUnderstandingToolInputSchema = z.object({
  brief: planningRequirementBriefInputSchema,
  facts: factsLedgerSchema.omit({
    id: true,
    workspaceId: true,
    planningRunId: true,
    taskRevision: true,
    version: true,
    createdAt: true,
  }),
});
