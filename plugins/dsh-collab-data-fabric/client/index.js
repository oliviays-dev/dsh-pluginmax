window.__ModuleLoader__.load({
  id: "dsh-collab-data-fabric",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";

    async function request(path, init) {
      const token = window.localStorage.getItem(TOKEN_KEY) ?? "";
      const response = await fetch(path, {
        ...init,
        headers: {
          ...(init?.body === undefined
            ? {}
            : { "content-type": "application/json" }),
          ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
          ...init?.headers,
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        throw new Error(body.error?.message ?? `请求失败 (${response.status})`);
      }
      return body;
    }

    function formatTime(value) {
      const time = new Date(value);
      return Number.isNaN(time.getTime())
        ? String(value)
        : time.toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
    }

    function DataFabricSection() {
      const [workspaces, setWorkspaces] = react.useState([]);
      const [workspaceId, setWorkspaceId] = react.useState("");
      const [state, setState] = react.useState({
        phase: "loading",
        capabilities: null,
        catalog: [],
        queryRuns: [],
        error: "",
      });

      react.useEffect(() => {
        let disposed = false;
        void request("/api/collab/team/workspaces")
          .then((result) => {
            if (disposed) return;
            const all = result.workspaces ?? [];
            const memberships = all.filter(
              (workspace) => workspace.isMember !== false,
            );
            const list = memberships.length > 0 ? memberships : all;
            setWorkspaces(list);
            setWorkspaceId((current) => current || list[0]?.id || "");
          })
          .catch((cause) => {
            if (!disposed) {
              setState((current) => ({
                ...current,
                phase: "error",
                error: cause.message,
              }));
            }
          });
        return () => {
          disposed = true;
        };
      }, []);

      react.useEffect(() => {
        if (workspaceId === "") return undefined;
        let disposed = false;
        setState((current) => ({ ...current, phase: "loading", error: "" }));
        void request(
          `/api/collab/data-fabric/bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`,
        )
          .then((result) => {
            if (disposed) return;
            setState({
              phase: "ready",
              capabilities: result.capabilities,
              catalog: result.catalog ?? [],
              queryRuns: result.queryRuns ?? [],
              error: "",
            });
          })
          .catch((cause) => {
            if (!disposed) {
              setState((current) => ({
                ...current,
                phase: "error",
                error: cause.message,
              }));
            }
          });
        return () => {
          disposed = true;
        };
      }, [workspaceId]);

      const styles = {
        section: { display: "grid", gap: 14 },
        toolbar: {
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        },
        select: {
          minHeight: 32,
          padding: "0 9px",
          border: "1px solid var(--dsw-alias-border-l2)",
          borderRadius: 6,
          background: "var(--dsw-alias-bg-layer-1)",
          color: "inherit",
        },
        summary: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          gap: 8,
        },
        stat: {
          display: "grid",
          gap: 3,
          padding: 10,
          border: "1px solid var(--dsw-alias-border-l2)",
          borderRadius: 7,
          background: "var(--dsw-alias-bg-layer-1)",
        },
        card: {
          display: "grid",
          gap: 6,
          padding: 11,
          border: "1px solid var(--dsw-alias-border-l2)",
          borderRadius: 7,
          background: "var(--dsw-alias-bg-layer-1)",
        },
        meta: {
          color: "var(--dsw-alias-label-secondary)",
          fontSize: 11,
          lineHeight: 1.6,
        },
        chips: { display: "flex", flexWrap: "wrap", gap: 5 },
        chip: {
          padding: "1px 6px",
          borderRadius: 4,
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-secondary)",
          fontSize: 10,
        },
      };

      const capabilities = state.capabilities;
      return h("section", { style: styles.section, "data-data-fabric": true }, [
        h("div", { key: "head", style: { display: "grid", gap: 3 } }, [
          h("h2", { key: "title", style: { margin: 0 } }, "Data Fabric"),
          h(
            "div",
            { key: "desc", style: styles.meta },
            "只读数据目录、语义指标和查询审计。第一阶段仅启用 Fixture Connector。",
          ),
        ]),
        h("div", { key: "toolbar", style: styles.toolbar }, [
          h(
            "select",
            {
              key: "workspace",
              style: styles.select,
              value: workspaceId,
              "aria-label": "Data Fabric 工作区",
              onChange: (event) => setWorkspaceId(event.target.value),
            },
            ...workspaces.map((workspace) =>
              h(
                "option",
                { key: workspace.id, value: workspace.id },
                workspace.title ?? workspace.path ?? workspace.id,
              ),
            ),
          ),
          h(
            "span",
            { key: "status", style: styles.meta },
            state.phase === "loading"
              ? "正在加载…"
              : state.phase === "error"
                ? `加载失败：${state.error}`
                : capabilities?.dataQueryAvailable
                  ? "查询能力可用"
                  : "查询能力不可用",
          ),
        ]),
        capabilities === null
          ? null
          : h("div", { key: "summary", style: styles.summary }, [
              h("div", { key: "connections", style: styles.stat }, [
                h("strong", { key: "value" }, capabilities.connectionCount),
                h("span", { key: "label", style: styles.meta }, "只读连接"),
              ]),
              h("div", { key: "datasets", style: styles.stat }, [
                h("strong", { key: "value" }, capabilities.datasetCount),
                h("span", { key: "label", style: styles.meta }, "可发现数据集"),
              ]),
              h("div", { key: "metrics", style: styles.stat }, [
                h("strong", { key: "value" }, capabilities.metricCount),
                h("span", { key: "label", style: styles.meta }, "认证指标"),
              ]),
              h("div", { key: "mode", style: styles.stat }, [
                h(
                  "strong",
                  { key: "value" },
                  capabilities.fixtureOnly ? "Fixture" : "Connector",
                ),
                h("span", { key: "label", style: styles.meta }, "数据来源模式"),
              ]),
            ]),
        h("div", { key: "catalog-title", style: { display: "grid", gap: 3 } }, [
          h("h3", { key: "title", style: { margin: 0 } }, "可发现数据集"),
          h(
            "div",
            { key: "desc", style: styles.meta },
            "仅展示当前工作区有权发现的数据集与认证指标。",
          ),
        ]),
        ...state.catalog.map((dataset) =>
          h("article", { key: dataset.datasetId, style: styles.card }, [
            h("strong", { key: "name" }, dataset.name),
            h("div", { key: "desc", style: styles.meta }, dataset.description),
            h(
              "div",
              { key: "metrics", style: styles.chips },
              ...dataset.metrics.map((metric) =>
                h("span", { key: metric.id, style: styles.chip }, metric.name),
              ),
            ),
            h(
              "div",
              { key: "meta", style: styles.meta },
              `${dataset.dimensions.length} 个维度 · 新鲜度 ${dataset.freshness}${
                dataset.isFixture ? " · Fixture" : ""
              }`,
            ),
          ]),
        ),
        h("div", { key: "runs-title", style: { display: "grid", gap: 3 } }, [
          h("h3", { key: "title", style: { margin: 0 } }, "最近查询"),
          h(
            "div",
            { key: "desc", style: styles.meta },
            "QueryRun 记录数据集、指标版本、权限摘要和执行结果。",
          ),
        ]),
        state.queryRuns.length === 0
          ? h("div", { key: "empty", style: styles.meta }, "当前没有查询记录。")
          : h(
              "div",
              { key: "runs", style: { display: "grid", gap: 6 } },
              ...state.queryRuns.map((run) =>
                h("article", { key: run.id, style: styles.card }, [
                  h(
                    "div",
                    {
                      key: "head",
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      },
                    },
                    h("strong", { key: "id" }, run.id),
                    h("span", { key: "status", style: styles.meta }, run.status),
                  ),
                  h("div", { key: "intent", style: styles.meta }, run.intentSummary),
                  h(
                    "div",
                    { key: "meta", style: styles.meta },
                    `${formatTime(run.createdAt)} · ${run.scannedRows ?? 0} 行扫描 · ${
                      run.durationMs ?? 0
                    }ms`,
                  ),
                ]),
              ),
            ),
      ]);
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) =>
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "pluginmax-data-fabric",
            order: 79,
            label: () => "Data Fabric",
            inject: () => ({}),
          },
          () => h(DataFabricSection),
        ),
      );

    return module.exports;
  },
});
