import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT = resolve(import.meta.dirname, "../client/index.js");

interface SidePanelService {
  registerType(definition: {
    type: string;
    defaultTitle: string;
    newTabTitle?: (ordinal: number) => string;
    singleton?: boolean;
  }): () => void;
  openNewTab(type: string): string;
  getSnapshot(): {
    open: boolean;
    openTabs: string[];
    activeTab?: string;
    tabMeta: Record<string, { type: string; title: string }>;
  };
  describeTab(tab: string): { type: string; title: string };
}

function loadService(): SidePanelService {
  let uuid = 0;
  let exports: Record<string, unknown> = {};
  const windowStub = {
    crypto: {
      randomUUID: () => `uuid-${++uuid}`,
    },
    __pluginmaxShell: {},
    __ModuleLoader__: {
      load: (definition: {
        factory: (require: (id: string) => unknown) => Record<string, unknown>;
      }) => {
        exports = definition.factory((id: string) => {
          throw new Error(`unexpected module: ${id}`);
        });
      },
    },
  };
  const source = readFileSync(CLIENT, "utf8");
  new Function("window", source)(windowStub);
  expect(exports.apply).toBeTypeOf("function");
  return (
    windowStub as unknown as { __pluginmaxSidePanel: SidePanelService }
  ).__pluginmaxSidePanel;
}

describe("shared side-panel service", () => {
  it("registers tab types and owns singleton behavior", () => {
    const service = loadService();
    service.registerType({
      type: "communication",
      defaultTitle: "沟通",
      newTabTitle: (ordinal) => `新沟通 ${ordinal}`,
    });
    service.registerType({
      type: "data-agent",
      defaultTitle: "数据洞察",
      newTabTitle: (ordinal) => `新数据洞察 ${ordinal}`,
    });
    service.registerType({
      type: "task-drafts",
      defaultTitle: "任务草稿",
      singleton: true,
    });

    const communication = service.openNewTab("communication");
    const dataAgent = service.openNewTab("data-agent");
    const taskDraft = service.openNewTab("task-drafts");
    const taskDraftAgain = service.openNewTab("task-drafts");

    expect(communication).toMatch(/^communication:uuid-/);
    expect(dataAgent).toMatch(/^data-agent:uuid-/);
    expect(taskDraft).toBe("task-drafts");
    expect(taskDraftAgain).toBe(taskDraft);
    expect(service.describeTab(communication).title).toBe("新沟通 1");
    expect(service.describeTab(dataAgent).title).toBe("新数据洞察 1");
    expect(service.getSnapshot()).toMatchObject({
      open: true,
      activeTab: "task-drafts",
    });
  });
});
