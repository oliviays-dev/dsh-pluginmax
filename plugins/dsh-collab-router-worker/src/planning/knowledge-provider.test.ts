import { describe, expect, it } from "vitest";
import {
  planningKnowledgeReceiptInput,
  planningKnowledgeSections,
} from "./knowledge-provider.js";

describe("planning knowledge provider contract", () => {
  it("maps policy and reference contributions to context sections and receipts", () => {
    const contributions = [
      {
        id: "policy-1",
        title: "采购异常审批",
        text: "金额超过阈值必须人工审批",
        authority: "policy" as const,
        version: "3",
        sourceRefs: [{ type: "document" as const, id: "sop-1", version: "3" }],
        confidence: "high" as const,
      },
      {
        id: "fact-1",
        title: "供应商等级",
        text: "供应商 A 为战略供应商",
        authority: "reference" as const,
        version: "1",
        sourceRefs: [{ type: "document" as const, id: "supplier-a" }],
        confidence: "medium" as const,
      },
    ];
    expect(planningKnowledgeSections(contributions)).toMatchObject([
      {
        id: "planning-knowledge:policy-1@3",
        type: "mode-policy",
        authority: "instruction",
        compression: "extracted",
      },
      {
        id: "planning-knowledge:fact-1@1",
        type: "shared-object-context",
        authority: "evidence",
      },
    ]);
    expect(
      planningKnowledgeReceiptInput({
        providerId: "kb",
        contextPackId: "pack-1",
        contributions,
        excluded: [{ id: "private", reason: "permission" }],
      }),
    ).toMatchObject({
      providerId: "kb",
      contextPackId: "pack-1",
      contributions: [{ id: "policy-1" }, { id: "fact-1" }],
      excluded: [{ id: "private", reason: "permission" }],
    });
  });
});
