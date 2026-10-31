window.__ModuleLoader__.load({
  id: "dsh-collab-demo-phone-tablet-order",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";

    const styles = `
.pmptoa{display:grid;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
.pmptoa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.pmptoa-title{display:grid;gap:2px;min-width:0;}
.pmptoa-title strong{font-size:13px;line-height:1.4;color:var(--dsw-alias-label-primary);}
.pmptoa-title span{font-size:10.5px;line-height:1.4;color:var(--dsw-alias-label-tertiary);}
.pmptoa-status{flex:none;padding:2px 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d2a737) 14%,transparent);color:var(--dsw-alias-state-warning-primary,#d2a737);font-size:10.5px;line-height:1.6;}
.pmptoa-status.done{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950);}
.pmptoa-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
.pmptoa-metric{display:grid;gap:2px;padding:8px 9px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
.pmptoa-metric span{font-size:10.5px;color:var(--dsw-alias-label-tertiary);}
.pmptoa-metric b{font-size:14px;line-height:1.3;color:var(--dsw-alias-label-primary);}
.pmptoa-actions{display:flex;gap:6px;flex-wrap:wrap;}
.pmptoa-btn{display:inline-flex;align-items:center;justify-content:center;min-height:27px;padding:2px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;cursor:pointer;}
.pmptoa-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}
.pmptoa-btn.primary{border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:600;}
.pmptoa-btn:disabled{opacity:.55;cursor:not-allowed;}
.pmptoa-draft{display:grid;gap:6px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l2);font-size:11px;line-height:1.55;color:var(--dsw-alias-label-secondary);}
.pmptoa-draft dl{display:grid;grid-template-columns:82px minmax(0,1fr);gap:5px 8px;margin:0;}
.pmptoa-draft dt{color:var(--dsw-alias-label-tertiary);}
.pmptoa-draft dd{margin:0;min-width:0;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);}
.pmptoa-success{display:grid;gap:3px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 36%,var(--dsw-alias-border-l2));border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 7%,var(--dsw-alias-bg-layer-1));font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);}
.pmptoa-success strong{font-size:12.5px;color:var(--dsw-alias-state-success-primary,#3fb950);}
.pmptoa-error{padding:8px 9px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 9%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-size:11px;line-height:1.5;}
.pmptoa-loading{height:66px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);opacity:.7;}
`;

    function token() {
      try {
        return window.localStorage.getItem(TOKEN_KEY) ?? "";
      } catch {
        return "";
      }
    }

    async function request(path, options = {}) {
      const current = token();
      if (current === "") throw new Error("登录状态不可用");
      const response = await fetch(path, {
        ...options,
        headers: {
          authorization: `Bearer ${current}`,
          ...(options.body === undefined
            ? {}
            : { "content-type": "application/json" }),
          ...options.headers,
        },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true) {
        throw new Error(
          payload?.error?.message ?? `HTTP ${response.status}`,
        );
      }
      return payload;
    }

    function money(value) {
      return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        maximumFractionDigits: 0,
      }).format(Number(value) || 0);
    }

    function TaskActionCard(props) {
      const taskId = props?.taskId;
      const [state, setState] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [submitting, setSubmitting] = react.useState(false);
      const [expanded, setExpanded] = react.useState(false);
      const [error, setError] = react.useState("");

      react.useEffect(() => {
        let disposed = false;
        if (typeof taskId !== "string" || taskId === "") {
          setLoading(false);
          return undefined;
        }
        setLoading(true);
        request(
          `/api/collab/demo-phone-tablet-order/task-action?taskId=${encodeURIComponent(taskId)}`,
        )
          .then((payload) => {
            if (!disposed) setState(payload);
          })
          .catch(() => {
            if (!disposed) setState(null);
          })
          .finally(() => {
            if (!disposed) setLoading(false);
          });
        return () => {
          disposed = true;
        };
      }, [taskId]);

      if (loading) {
        return h(
          "div",
          { className: "pmptoa", "data-phone-tablet-action": "loading" },
          h("style", null, styles),
          h("div", { className: "pmptoa-loading" }),
        );
      }
      if (state === null) return null;

      const action = state.action ?? {};
      const receipt = state.receipt;
      const created = receipt !== null && receipt !== undefined;
      const confirm = async () => {
        setSubmitting(true);
        setError("");
        try {
          const result = await request(
            "/api/collab/demo-phone-tablet-order/task-action/confirm",
            {
              method: "POST",
              body: JSON.stringify({ taskId }),
            },
          );
          setState((previous) => ({
            ...previous,
            receipt: result.receipt,
            wms: {
              status: "recovered",
              workOrder: result.workOrder,
            },
          }));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "创建失败");
        } finally {
          setSubmitting(false);
        }
      };

      return h(
        "section",
        {
          className: "pmptoa",
          "data-phone-tablet-action": created ? "created" : "draft",
        },
        h("style", null, styles),
        h(
          "div",
          { className: "pmptoa-head" },
          h(
            "div",
            { className: "pmptoa-title" },
            h("strong", null, action.title ?? "成品仓订单再平衡工单"),
            h("span", null, "Mock WMS · MCP · 演示动作 · 非生产"),
          ),
          h(
            "span",
            { className: `pmptoa-status${created ? " done" : ""}` },
            created ? "已创建" : action.statusLabel ?? "草稿",
          ),
        ),
        h(
          "div",
          { className: "pmptoa-metrics" },
          h(
            "div",
            { className: "pmptoa-metric" },
            h("span", null, "订单范围"),
            h("b", null, `${action.orderCount ?? 0} 单`),
          ),
          h(
            "div",
            { className: "pmptoa-metric" },
            h("span", null, "预计影响金额"),
            h("b", null, money(action.orderAmount)),
          ),
        ),
        created
          ? h(
              "div",
              { className: "pmptoa-success" },
              h("strong", null, `${receipt.workOrderId} 创建成功`),
              h("span", null, "Mock WMS · MCP · 演示动作 · 非生产"),
              h("span", null, `确认人：${receipt.confirmedByName}`),
              h("span", null, `操作者：${receipt.operatorName}`),
              h("span", null, `审计引用：${receipt.actionTicketId}`),
              state.wms?.status === "unavailable"
                ? h(
                    "span",
                    null,
                    `Mock WMS 读取：${state.wms.message}`,
                  )
                : null,
            )
          : h(
              "div",
              { className: "pmptoa-actions" },
              h(
                "button",
                {
                  type: "button",
                  className: "pmptoa-btn",
                  "aria-expanded": expanded,
                  onClick: () => setExpanded((value) => !value),
                },
                expanded ? "收起工单草稿" : "查看工单草稿",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pmptoa-btn primary",
                  disabled: submitting,
                  onClick: confirm,
                },
                submitting ? "创建中…" : "确认并创建",
              ),
            ),
        expanded && !created
          ? h(
              "div",
              { className: "pmptoa-draft" },
              h(
                "dl",
                null,
                h("dt", null, "来源仓"),
                h("dd", null, action.sourceWarehouse || "-"),
                h("dt", null, "目标仓"),
                h("dd", null, action.targetWarehouse || "-"),
                h("dt", null, "完成时点"),
                h("dd", null, action.cutoff || "-"),
                h("dt", null, "SKU 范围"),
                h("dd", null, (action.skuScope ?? []).join("、") || "-"),
                h("dt", null, "序列号"),
                h(
                  "dd",
                  null,
                  action.serialBindingRequired
                    ? "出库前绑定 IMEI/SN"
                    : "无需绑定",
                ),
                h("dt", null, "库存归属"),
                h(
                  "dd",
                  null,
                  action.inventoryOwnershipChangeRequired
                    ? "需要变更并审核"
                    : "无需变更",
                ),
                h("dt", null, "确认人"),
                h("dd", null, action.approverName || "-"),
              ),
            )
          : null,
        error !== "" ? h("div", { className: "pmptoa-error" }, error) : null,
      );
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.task.detail.extension", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.detail.extension",
            id: "phone-tablet-order-task-action",
            order: 20,
          },
          TaskActionCard,
        ),
      );
    };

    return module.exports;
  },
});
