window.__ModuleLoader__.load({
  id: "dsh-collab-data-orders",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;
    const TOKEN_KEY = "pluginmax.collab.token";

    async function request(path) {
      const token = window.localStorage.getItem(TOKEN_KEY) ?? "";
      const response = await fetch(path, {
        headers: token === "" ? {} : { authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        throw new Error(body.error?.message ?? `请求失败 (${response.status})`);
      }
      return body;
    }

    function OrderSourceSection() {
      const [state, setState] = react.useState({
        phase: "loading",
        workspaceId: "",
        data: null,
        error: "",
      });

      react.useEffect(() => {
        let disposed = false;
        void request("/api/collab/team/workspaces")
          .then((result) => {
            if (disposed) return;
            const workspaces = (result.workspaces ?? []).filter(
              (workspace) => workspace.isMember !== false,
            );
            const workspaceId = workspaces[0]?.id ?? "";
            if (workspaceId === "") {
              setState({
                phase: "error",
                workspaceId,
                data: null,
                error: "当前账号没有可访问工作区",
              });
              return;
            }
            return request(
              `/api/collab/data-orders/bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`,
            ).then((payload) => {
              if (disposed) return;
              setState({
                phase: "ready",
                workspaceId,
                data: payload,
                error: "",
              });
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
      }, []);

      if (state.phase === "loading") {
        return h("p", null, "正在读取订单数据源…");
      }
      if (state.error !== "") {
        return h(
          "div",
          { role: "alert", style: { color: "var(--dsw-alias-state-error-primary)" } },
          state.error,
        );
      }
      const status = state.data?.status;
      const config = status?.config;
      const demo = config?.mode === "demo";
      return h(
        "section",
        { style: { display: "grid", gap: 10 } },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8 } },
          h("strong", null, "订单只读数据源"),
          h(
            "span",
            {
              style: {
                padding: "1px 6px",
                borderRadius: 4,
                background: demo
                  ? "color-mix(in srgb, var(--dsw-alias-state-warning-primary) 16%, transparent)"
                  : "color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent)",
                color: demo
                  ? "var(--dsw-alias-state-warning-primary)"
                  : "var(--dsw-alias-state-success-primary)",
                fontSize: 10,
              },
            },
            demo ? "演示数据 · 非生产" : "生产只读",
          ),
        ),
        h(
          "p",
          { style: { margin: 0, color: "var(--dsw-alias-label-secondary)" } },
          `Connector manifest ${status?.manifest?.version ?? "-"} · transport ${config?.transport ?? "-"} · revision ${config?.revision ?? "-"}`,
        ),
        config?.transport === "mcp"
          ? h(
              "p",
              { style: { margin: 0, color: "var(--dsw-alias-label-secondary)" } },
              `资源市场 MCP：${config.mcpAssetId ?? "-"} · tool ${config.mcpToolName ?? "-"}`,
            )
          : null,
        h(
          "p",
          { style: { margin: 0, color: "var(--dsw-alias-label-tertiary)" } },
          "订单异常 v1 = 支付失败 + 取消 + 履约超时；退款和金额异常不进入默认口径。",
        ),
        demo
          ? h(
              "p",
              { style: { margin: 0, color: "var(--dsw-alias-label-tertiary)" } },
              "当前通过资源市场连接第三方 Mock OMS MCP。连接状态和工具清单以资源市场 MCP 页为准。",
            )
          : h(
              "p",
              { style: { margin: 0, color: "var(--dsw-alias-label-tertiary)" } },
              "生产凭据只保存环境引用，不写入前端、日志或 QueryRun。",
            ),
      );
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) =>
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "pluginmax-data-orders",
            order: 80,
            label: () => "订单数据",
            inject: () => ({}),
          },
          () => h(OrderSourceSection),
        ),
      );

    return module.exports;
  },
});
