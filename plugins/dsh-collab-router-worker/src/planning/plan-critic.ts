import { planCriticReportSchema } from "./models.js";

export const planningPlanCriticInputSchema = planCriticReportSchema.omit({
  id: true,
  workspaceId: true,
  planningRunId: true,
  version: true,
  createdAt: true,
});
