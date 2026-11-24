import { factsLedgerSchema } from "./models.js";

export const planningFactsLedgerInputSchema = factsLedgerSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  taskRevision: true,
  version: true,
  createdAt: true,
});
