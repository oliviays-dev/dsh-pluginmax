window.__ModuleLoader__.load({
  id: "dsh-collab-resource-market",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const react = require("react");
    const h = react.createElement;
    const TOKEN_KEY = "pluginmax.collab.token";

    const ICONS = {
      search: icon("M21 21l-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"),
      close: icon("M18 6 6 18M6 6l12 12"),
      store: icon("M3 9l2-5h14l2 5M4 9v11h16V9M9 20v-6h6v6"),
      plus: icon("M12 5v14M5 12h14"),
      arrow: icon("M5 12h14M13 6l6 6-6 6"),
      shield: icon("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"),
      check: icon("m5 12 4 4L19 6"),
      alert: icon("M12 9v4M12 17h.01M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"),
    };

    function icon(path) {
      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
        },
        h("path", { d: path }),
      );
    }

    const styles = `
.pmrm{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:calc(100vh - 36px);margin:-18px -20px -20px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);}
.pmrm *,.pmrm *::before,.pmrm *::after{box-sizing:border-box;}
.pmrm-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}
.pmrm-brand{display:flex;align-items:center;gap:9px;min-width:180px;}
.pmrm-brand-mark{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);}
.pmrm-brand-mark svg{width:17px;height:17px;}
.pmrm-brand strong{display:block;font-size:13px;}.pmrm-brand small{display:block;margin-top:1px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmrm-tabs{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-base);}
.pmrm-tabs button{min-height:28px;padding:3px 12px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;font-weight:650;cursor:pointer;}
.pmrm-tabs button.active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
.pmrm-search{width:min(340px,30vw);margin-left:auto;position:relative;}
.pmrm-search svg{position:absolute;left:10px;top:50%;width:14px;height:14px;transform:translateY(-50%);color:var(--dsw-alias-label-tertiary);}
.pmrm-search input{width:100%;height:34px;padding:5px 10px 5px 32px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;}
.pmrm-iconbtn,.pmrm-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer;}
.pmrm-iconbtn{width:32px;height:32px;padding:0;}.pmrm-btn{min-height:28px;padding:2px 10px;}
.pmrm-btn.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:650;}
.pmrm-btn:disabled{opacity:.5;cursor:not-allowed;}
.pmrm-iconbtn svg,.pmrm-btn svg{width:13px;height:13px;}
.pmrm-main{min-width:0;min-height:0;display:grid;grid-template-columns:180px minmax(0,1fr);overflow:hidden;}
.pmrm-side{padding:18px 10px;border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);overflow:auto;}
.pmrm-side-label{padding:0 8px 7px;color:var(--dsw-alias-label-tertiary);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;}
.pmrm-side button{width:100%;display:flex;align-items:center;gap:7px;min-height:32px;padding:4px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;text-align:left;cursor:pointer;}
.pmrm-side button:hover,.pmrm-side button.active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
.pmrm-side button svg{width:14px;height:14px;flex:none;}
.pmrm-content{min-width:0;overflow:auto;padding:20px 22px 32px;}
.pmrm-content-inner{max-width:1320px;margin:0 auto;}
.pmrm-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:13px;}
.pmrm-heading h1{margin:0;font-size:20px;line-height:1.25;}.pmrm-heading p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;}
.pmrm-subtabs{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-subtabs button{min-height:26px;padding:2px 10px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer;}
.pmrm-subtabs button.active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-weight:650;}
.pmrm-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 13px;}
.pmrm-chip{padding:3px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:9.5px;cursor:pointer;}
.pmrm-chip.active{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmrm-filterbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:-3px 0 13px;padding:8px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-filterbar label{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmrm-filterbar select{height:27px;padding:2px 22px 2px 7px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;}
.pmrm-filter-total{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:9.5px;white-space:nowrap;}
.pmrm-pager{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:14px;color:var(--dsw-alias-label-tertiary);font-size:10px;}
.pmrm-pager button{min-height:27px;padding:2px 9px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;cursor:pointer;}
.pmrm-pager button:disabled{opacity:.45;cursor:not-allowed;}
.pmrm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;}
.pmrm-card{min-width:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-card:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));}
.pmrm-preview{height:112px;display:grid;grid-template-columns:repeat(12,1fr);gap:5px;align-content:start;padding:12px;background:color-mix(in srgb,var(--template-color,#3f6ef3) 12%,var(--dsw-alias-bg-layer-2));border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmrm-block{grid-column:span var(--span,4);height:var(--height,26px);display:grid;gap:3px;padding:5px;border:1px solid color-mix(in srgb,var(--template-color,#3f6ef3) 24%,transparent);border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 82%,transparent);}
.pmrm-block i,.pmrm-block b{display:block;height:3px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent);}
.pmrm-block b{width:62%;}
.pmrm-card-body{padding:11px 12px 12px;}
.pmrm-card-title{display:flex;align-items:flex-start;gap:8px;}
.pmrm-mark{width:28px;height:28px;flex:none;display:grid;place-items:center;border-radius:7px;background:color-mix(in srgb,var(--asset-color,#3f6ef3) 15%,var(--dsw-alias-bg-layer-1));color:var(--asset-color,#3f6ef3);}
.pmrm-mark svg{width:14px;height:14px;}
.pmrm-card-title strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:11.5px;white-space:nowrap;}
.pmrm-card-title p{margin:3px 0 0;color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.pmrm-card-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
.pmrm-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmrm-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
.pmrm-resource{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:9px;padding:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-resource .pmrm-mark{width:36px;height:36px;}
.pmrm-resource h3{margin:0;font-size:11.5px;}.pmrm-resource p{margin:3px 0 0;color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.5;}
.pmrm-status{padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:8.5px;white-space:nowrap;}
.pmrm-status.ok{color:var(--dsw-alias-state-success-primary,#34d47e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 12%,transparent);}
.pmrm-status.warn{color:var(--dsw-alias-state-warning-primary,#e2a737);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 12%,transparent);}
.pmrm-detail{position:absolute;top:59px;right:0;bottom:0;z-index:4;width:min(390px,42vw);display:flex;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);box-shadow:-18px 0 40px rgba(0,0,0,.18);}
.pmrm-detail-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmrm-detail-body{min-height:0;flex:1;overflow:auto;padding:14px;}
.pmrm-detail-foot{padding:11px 14px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmrm-detail h2{margin:10px 0 0;font-size:17px;}
.pmrm-detail p{margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.6;}
.pmrm-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px;}
.pmrm-fact{padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-fact span{display:block;color:var(--dsw-alias-label-tertiary);font-size:8.5px;}.pmrm-fact strong{display:block;margin-top:3px;font-size:10.5px;}
.pmrm-section{margin-top:14px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmrm-section h3{margin:0 0 7px;font-size:11px;}
.pmrm-permission{display:grid;gap:5px;padding:9px;border:1px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 28%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.5;}
.pmrm-panel-row{display:flex;align-items:center;gap:7px;padding:7px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:10px;}
.pmrm-panel-row:last-child{border-bottom:0;}.pmrm-panel-row span{flex:1;}
.pmrm-empty{grid-column:1/-1;display:grid;place-items:center;min-height:260px;border:1px dashed var(--dsw-alias-border-l3);border-radius:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:center;}
.pmrm-error{padding:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 35%,transparent);border-radius:7px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10.5px;}
.pmrm-toast{position:fixed;left:50%;bottom:28px;z-index:80;transform:translateX(-50%);padding:8px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 12px 30px rgba(0,0,0,.24);font-size:11px;}
@media(max-width:1000px){.pmrm-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.pmrm-list{grid-template-columns:1fr;}}
@media(max-width:700px){.pmrm{margin:-14px;}.pmrm-main{grid-template-columns:1fr;}.pmrm-side{display:flex;gap:5px;overflow-x:auto;padding:8px;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2);}.pmrm-side-label{display:none;}.pmrm-side button{width:auto;flex:none;}.pmrm-content{padding:14px;}.pmrm-grid{grid-template-columns:1fr;}.pmrm-search{width:100%;order:5;margin:0;}.pmrm-detail{top:0;width:100vw;}.pmrm-brand small{display:none;}}
`;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY) ?? "";
    }

    async function request(path, options = {}) {
      const headers = {
        "cache-control": "no-store",
        ...options.headers,
      };
      if (token() !== "") headers.authorization = `Bearer ${token()}`;
      if (options.body !== undefined) headers["content-type"] = "application/json";
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      }
      return payload;
    }

    function actionKey(prefix) {
      const suffix =
        typeof window.crypto?.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return `${prefix}:${suffix}`;
    }

    function visibilityLabel(value) {
      return value === "team" ? "团队可见" : "私有";
    }

    function marketVisibilityLabel(value) {
      if (value === "official") return "官方";
      if (value === "public") return "公开";
      return "团队共享";
    }

    function templateBlocks(template) {
      const groups = template.panelPlan.slice(0, 7);
      return groups.map((panel, index) =>
        h("span", {
          className: "pmrm-block",
          key: panel.pluginId + index,
          style: {
            "--span": panel.span,
            "--height": `${22 + (index % 3) * 7}px`,
          },
        }, h("i"), h("b")),
      );
    }

    function sourceLabel(source) {
      return source === "provider" ? "治理服务" : "种子目录";
    }

    function assetStatusLabel(kind, status) {
      if (kind === "skill") {
        return status === "enabled" ? "已启用" : "可启用";
      }
      if (kind === "mcp") {
        if (status === "connected") return "已连接";
        if (status === "pending") return "待验证";
        return "未连接";
      }
      if (status === "enabled") return "已启用";
      if (status === "not_enabled") return "未启用";
      if (status === "not_packaged") return "未装配";
      if (status === "disabled") return "已禁用";
      return "不兼容";
    }

    function assetStatusClass(kind, status) {
      if (kind === "skill") return status === "enabled" ? " ok" : "";
      if (kind === "mcp") {
        if (status === "connected") return " ok";
        if (status === "pending") return " warn";
        return "";
      }
      if (status === "enabled") return " ok";
      if (["not_packaged", "disabled", "incompatible"].includes(status)) {
        return " warn";
      }
      return "";
    }

    function ResourceAssetCard({ kind, item, onOpen }) {
      const permissions = item.permissions ?? [];
      return h(
        "article",
        { className: "pmrm-resource" },
        h(
          "span",
          {
            className: "pmrm-mark",
            style: { "--asset-color": kind === "mcp" ? "#168a74" : "#4f8ef7" },
          },
          kind === "mcp" ? ICONS.store : ICONS.alert,
        ),
        h(
          "div",
          { style: { minWidth: 0 } },
          h("h3", null, item.name),
          h("p", null, item.description),
          h(
            "div",
            { className: "pmrm-card-meta" },
            h("span", null, item.publisher.name),
            h("span", null, `v${item.version}`),
            h("span", null, kind === "mcp" ? item.protocol : item.category),
            h("span", null, sourceLabel(item.source)),
          ),
          h(
            "div",
            { className: "pmrm-card-meta" },
            h("span", null, permissions.join(" · ") || "未声明额外数据权限"),
          ),
        ),
        h(
          "div",
          { style: { display: "grid", gap: "6px", justifyItems: "end" } },
          h(
            "span",
            {
              className: `pmrm-status${assetStatusClass(kind, item.status)}`,
            },
            assetStatusLabel(kind, item.status),
          ),
          h(
            "button",
            {
              type: "button",
              className: "pmrm-btn",
              onClick: () => onOpen(item),
            },
            "详情",
          ),
        ),
      );
    }

    function ResourceMarketPage(props) {
      const { useShellRoute } = props;
      const route = useShellRoute?.((state) => state.route);
      const [tab, setTab] = react.useState("skill");
      const [assetTab, setAssetTab] = react.useState("templates");
      const [category, setCategory] = react.useState("全部");
      const [publisher, setPublisher] = react.useState("all");
      const [compatibility, setCompatibility] = react.useState("all");
      const [sort, setSort] = react.useState("recommended");
      const [pagination, setPagination] = react.useState({
        page: 1,
        pageCount: 1,
        total: 0,
      });
      const [query, setQuery] = react.useState("");
      const [loading, setLoading] = react.useState(false);
      const [busy, setBusy] = react.useState(false);
      const [error, setError] = react.useState("");
      const [skills, setSkills] = react.useState([]);
      const [mcps, setMcps] = react.useState([]);
      const [templates, setTemplates] = react.useState([]);
      const [plugins, setPlugins] = react.useState([]);
      const [detail, setDetail] = react.useState(null);
      const [activeWorkbench, setActiveWorkbench] = react.useState(null);
      const [currentUserId, setCurrentUserId] = react.useState("");
      const [toast, setToast] = react.useState("");
      const timer = react.useRef(0);

      const showToast = (message) => {
        setToast(message);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setToast(""), 2500);
      };

      const loadSkills = react.useCallback(async (search = "") => {
        setLoading(true);
        try {
          const result = await request(
            `/api/collab/resources/skills?q=${encodeURIComponent(search)}`,
          );
          setSkills(result.skills ?? []);
          setError("");
        } catch (cause) {
          setError(cause.message);
        } finally {
          setLoading(false);
        }
      }, []);

      const loadMcps = react.useCallback(async (search = "") => {
        setLoading(true);
        try {
          const result = await request(
            `/api/collab/resources/mcps?q=${encodeURIComponent(search)}`,
          );
          setMcps(result.mcps ?? []);
          setError("");
        } catch (cause) {
          setError(cause.message);
        } finally {
          setLoading(false);
        }
      }, []);

      const loadWorkbenchContext = react.useCallback(async () => {
        try {
          const [listing, current] = await Promise.all([
            request("/api/collab/workbenches"),
            request("/api/collab/auth/me"),
          ]);
          const workbenches = listing.workbenches ?? [];
          const active =
            workbenches.find(
              (item) => item.id === listing.preference?.activeWorkbenchId,
            ) ?? workbenches[0] ?? null;
          setActiveWorkbench(active);
          setCurrentUserId(current?.user?.id ?? "");
        } catch {
          setActiveWorkbench(null);
          setCurrentUserId("");
        }
      }, []);

      const loadTemplates = react.useCallback(
        async (
          search = "",
          selectedCategory = "全部",
          selectedPublisher = "all",
          selectedCompatibility = "all",
          selectedSort = "recommended",
          page = 1,
        ) => {
          setLoading(true);
          try {
            const params = new URLSearchParams({
              q: search,
              category: selectedCategory,
              sort: selectedSort,
              page: String(page),
              pageSize: "24",
            });
            if (selectedPublisher !== "all") {
              params.set("publisher", selectedPublisher);
            }
            if (selectedCompatibility !== "all") {
              params.set("compatibility", selectedCompatibility);
            }
            const result = await request(
              `/api/collab/workbench-market/templates?${params.toString()}`,
            );
            setTemplates(result.templates ?? []);
            setPagination({
              page: result.page ?? 1,
              pageCount: result.pageCount ?? 1,
              total: result.total ?? result.templates?.length ?? 0,
            });
            setError("");
          } catch (cause) {
            setError(cause.message);
          } finally {
            setLoading(false);
          }
        },
        [],
      );

      const loadPlugins = react.useCallback(
        async (
          search = "",
          selectedCategory = "全部",
          selectedPublisher = "all",
          selectedCompatibility = "all",
          selectedSort = "recommended",
          page = 1,
        ) => {
          setLoading(true);
          try {
            const params = new URLSearchParams({
              q: search,
              category: selectedCategory,
              sort: selectedSort,
              page: String(page),
              pageSize: "24",
            });
            if (selectedPublisher !== "all") {
              params.set("publisher", selectedPublisher);
            }
            if (selectedCompatibility !== "all") {
              params.set("compatibility", selectedCompatibility);
            }
            const result = await request(
              `/api/collab/workbench-market/plugins?${params.toString()}`,
            );
            setPlugins(result.plugins ?? []);
            setPagination({
              page: result.page ?? 1,
              pageCount: result.pageCount ?? 1,
              total: result.total ?? result.plugins?.length ?? 0,
            });
            setError("");
          } catch (cause) {
            setError(cause.message);
          } finally {
            setLoading(false);
          }
        },
        [],
      );

      react.useEffect(() => {
        if (route !== "resource-market") return;
        setDetail(null);
        setCategory("全部");
        setPublisher("all");
        setCompatibility("all");
        setSort("recommended");
        setPagination({ page: 1, pageCount: 1, total: 0 });
        setQuery("");
        if (tab === "skill") void loadSkills();
        if (tab === "mcp") void loadMcps();
        if (tab === "workbench") {
          void loadWorkbenchContext();
          if (assetTab === "templates") void loadTemplates();
          else void loadPlugins();
        }
      }, [route, tab, assetTab]);

      react.useEffect(() => {
        if (route !== "resource-market") return undefined;
        const onKey = (event) => {
          if (event.key === "Escape") setDetail(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [route]);

      if (route !== "resource-market") return null;

      const updateSearch = (value) => {
        setQuery(value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          if (tab === "skill") void loadSkills(value);
          else if (tab === "mcp") void loadMcps(value);
          else if (assetTab === "templates") {
            void loadTemplates(
              value,
              category,
              publisher,
              compatibility,
              sort,
              1,
            );
          } else {
            void loadPlugins(
              value,
              category,
              publisher,
              compatibility,
              sort,
              1,
            );
          }
        }, 280);
      };

      const chooseCategory = (value) => {
        setCategory(value);
        setPagination((current) => ({ ...current, page: 1 }));
        if (tab === "workbench") {
          if (assetTab === "templates") {
            void loadTemplates(
              query,
              value,
              publisher,
              compatibility,
              sort,
              1,
            );
          } else {
            void loadPlugins(
              query,
              value,
              publisher,
              compatibility,
              sort,
              1,
            );
          }
        }
      };

      const choosePublisher = (value) => {
        setPublisher(value);
        if (assetTab === "templates") {
          void loadTemplates(query, category, value, compatibility, sort, 1);
        } else {
          void loadPlugins(query, category, value, compatibility, sort, 1);
        }
      };

      const chooseCompatibility = (value) => {
        setCompatibility(value);
        if (assetTab === "templates") {
          void loadTemplates(query, category, publisher, value, sort, 1);
        } else {
          void loadPlugins(query, category, publisher, value, sort, 1);
        }
      };

      const chooseSort = (value) => {
        setSort(value);
        if (assetTab === "templates") {
          void loadTemplates(query, category, publisher, compatibility, value, 1);
        } else {
          void loadPlugins(query, category, publisher, compatibility, value, 1);
        }
      };

      const changePage = (page) => {
        if (page < 1 || page > pagination.pageCount) return;
        if (assetTab === "templates") {
          void loadTemplates(
            query,
            category,
            publisher,
            compatibility,
            sort,
            page,
          );
        } else {
          void loadPlugins(
            query,
            category,
            publisher,
            compatibility,
            sort,
            page,
          );
        }
      };

      const switchTab = (value) => {
        setTab(value);
        setDetail(null);
        setQuery("");
        setCategory("全部");
        setPublisher("all");
        setCompatibility("all");
        setSort("recommended");
        setPagination({ page: 1, pageCount: 1, total: 0 });
        void loadWorkbenchContext();
      };

      const installSkill = async (skill) => {
        if (busy) return;
        setBusy(true);
        try {
          await request("/api/collab/resources/skills", {
            method: "POST",
            body: JSON.stringify({ skillId: skill.id }),
          });
          setSkills((items) =>
            items.map((item) =>
              item.id === skill.id ? { ...item, status: "enabled" } : item,
            ),
          );
          setDetail((current) =>
            current?.kind === "skill" && current.value.id === skill.id
              ? {
                  ...current,
                  value: { ...current.value, status: "enabled" },
                }
              : current,
          );
          showToast(`已启用「${skill.name}」`);
        } catch (cause) {
          showToast(cause.message);
        } finally {
          setBusy(false);
        }
      };

      const connectMcp = async (mcp) => {
        if (busy) return;
        setBusy(true);
        try {
          await request("/api/collab/resources/mcps/connect", {
            method: "POST",
            body: JSON.stringify({ mcpId: mcp.id }),
          });
          setMcps((items) =>
            items.map((item) =>
              item.id === mcp.id ? { ...item, status: "pending" } : item,
            ),
          );
          setDetail((current) =>
            current?.kind === "mcp" && current.value.id === mcp.id
              ? {
                  ...current,
                  value: { ...current.value, status: "pending" },
                }
              : current,
          );
          showToast(
            mcp.connectionMode === "provider"
              ? "已同步 MCP 连接状态"
              : "连接请求已登记为待验证，不会伪造已连接状态",
          );
        } catch (cause) {
          showToast(cause.message);
        } finally {
          setBusy(false);
        }
      };

      const copyTemplate = async (template) => {
        if (busy || template.compatibility === "incompatible") return;
        setBusy(true);
        try {
          const result = await request(
            "/api/collab/workbench-market/templates/install",
            {
              method: "POST",
              headers: {
                "idempotency-key": actionKey(`template-${template.id}`),
              },
              body: JSON.stringify({
                templateId: template.id,
                version: template.version,
              }),
            },
          );
          setDetail(null);
          showToast(`已复制「${result.workbench.name}」`);
          window.__pluginmaxShell?.setRoute("workbench-new");
        } catch (cause) {
          showToast(cause.message);
        } finally {
          setBusy(false);
        }
      };

      const enablePlugin = async (plugin) => {
        if (busy) return;
        if (
          activeWorkbench !== null &&
          activeWorkbench.ownerId !== currentUserId
        ) {
          showToast("只读工作台不能添加面板，请先复制");
          return;
        }
        if (
          ["not_packaged", "disabled", "incompatible"].includes(plugin.status)
        ) {
          showToast(
            plugin.status === "not_packaged"
              ? "该插件尚未装配到当前 DSH"
              : plugin.status === "disabled"
                ? "该插件已被管理员禁用"
                : "该插件与当前宿主不兼容",
          );
          return;
        }
        setBusy(true);
        try {
          const result = await request("/api/collab/workbenches/panels", {
            method: "POST",
            headers: {
              "idempotency-key": actionKey(`panel-${plugin.id}`),
            },
            body: JSON.stringify({
              pluginId: plugin.id,
              pluginVersion: plugin.version,
              span: plugin.defaultSpan,
              ...(activeWorkbench === null
                ? {}
                : {
                    workbenchId: activeWorkbench.id,
                    expectedRevision: activeWorkbench.revision,
                  }),
            }),
          });
          if (result.workbench !== undefined) {
            setActiveWorkbench(result.workbench);
          }
          setPlugins((items) =>
            items.map((item) =>
              item.id === plugin.id ? { ...item, status: "enabled" } : item,
            ),
          );
          setDetail(null);
          showToast(`已将「${plugin.name}」添加到当前工作台`);
        } catch (cause) {
          showToast(cause.message);
        } finally {
          setBusy(false);
        }
      };

      const openTemplate = async (template) => {
        setDetail({ kind: "template", value: template, loading: true });
        try {
          const result = await request(
            `/api/collab/workbench-market/templates/detail?id=${encodeURIComponent(template.id)}&version=${encodeURIComponent(template.version)}`,
          );
          setDetail({
            kind: "template",
            value: result.template ?? template,
            loading: false,
          });
        } catch (cause) {
          setDetail({
            kind: "template",
            value: template,
            loading: false,
            error: cause.message,
          });
          showToast(cause.message);
        }
      };

      const categories =
        tab === "workbench"
          ? assetTab === "templates"
            ? ["全部", "运营", "管理", "情报", "项目"]
            : ["全部", "AI", "任务", "数据", "流程", "协作", "供应链", "管理", "研究"]
          : [];

      const skillView = h(
        react.Fragment,
        null,
        h(
          "div",
          { className: "pmrm-heading" },
          h(
            "div",
            null,
            h("h1", null, "Skill 资源"),
            h("p", null, "当前工作区可用的技能能力，安装状态按账号保存。"),
          ),
        ),
        h(
          "div",
          { className: "pmrm-list" },
          ...skills.map((skill) =>
            h(ResourceAssetCard, {
              kind: "skill",
              item: skill,
              key: skill.id,
              onOpen: (item) => setDetail({ kind: "skill", value: item }),
            }),
          ),
          skills.length === 0 && !loading
            ? h("div", { className: "pmrm-empty" }, "没有匹配的 Skill")
            : null,
        ),
      );

      const mcpView = h(
        react.Fragment,
        null,
        h(
          "div",
          { className: "pmrm-heading" },
          h(
            "div",
            null,
            h("h1", null, "MCP 连接"),
            h("p", null, "连接业务系统并暴露受控工具；凭据由治理服务保存。"),
          ),
        ),
        h(
          "div",
          { className: "pmrm-list" },
          ...mcps.map((mcp) =>
            h(ResourceAssetCard, {
              kind: "mcp",
              item: mcp,
              key: mcp.id,
              onOpen: (item) => setDetail({ kind: "mcp", value: item }),
            }),
          ),
          mcps.length === 0 && !loading
            ? h("div", { className: "pmrm-empty" }, "没有匹配的 MCP")
            : null,
        ),
      );

      const templateCards = templates.map((template) =>
        h(
          "article",
          { className: "pmrm-card", key: template.id },
          h(
            "div",
            { className: "pmrm-preview", style: { "--template-color": template.color } },
            ...templateBlocks(template),
          ),
          h(
            "div",
            { className: "pmrm-card-body" },
            h(
              "div",
              { className: "pmrm-card-title" },
              h(
                "span",
                { className: "pmrm-mark", style: { "--asset-color": template.color } },
                ICONS.store,
              ),
              h(
                "div",
                { style: { minWidth: 0 } },
                h("strong", null, template.name),
                h("p", null, template.description),
              ),
            ),
            h(
              "div",
              { className: "pmrm-card-meta" },
              h("span", null, template.publisher.name),
              h("span", null, template.category),
              h("span", null, `v${template.version}`),
              h("span", null, `${template.panelPlan.length} 个面板`),
              h(
                "span",
                null,
                template.compatibility === "incompatible"
                  ? "不兼容"
                  : "当前宿主兼容",
              ),
            ),
            h(
              "div",
              { className: "pmrm-card-foot" },
              h("span", null, marketVisibilityLabel(template.visibility)),
              h(
                "button",
                {
                  type: "button",
                  className: "pmrm-btn",
                  onClick: () => void openTemplate(template),
                },
                "查看方案",
              ),
            ),
          ),
        ),
      );

      const pluginCards = plugins.map((plugin) =>
        h(
          "article",
          { className: "pmrm-resource", key: plugin.id },
          h("span", { className: "pmrm-mark", style: { "--asset-color": "#7057ca" } }, ICONS.plus),
          h(
            "div",
            null,
            h("h3", null, plugin.name),
            h("p", null, plugin.description),
            h(
              "div",
              { className: "pmrm-card-meta" },
              h("span", null, plugin.category),
              h("span", null, `v${plugin.version}`),
              h("span", null, plugin.publisher.name),
              h("span", null, sourceLabel(plugin.source)),
            ),
          ),
          h(
            "div",
            { style: { display: "grid", gap: "6px", justifyItems: "end" } },
            h(
              "span",
              {
                className: `pmrm-status${assetStatusClass("plugin", plugin.status)}`,
              },
              assetStatusLabel("plugin", plugin.status),
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmrm-btn",
                onClick: () => setDetail({ kind: "plugin", value: plugin }),
              },
              "详情",
            ),
          ),
        ),
      );

      const workbenchView = h(
        react.Fragment,
        null,
        h(
          "div",
          { className: "pmrm-heading" },
          h(
            "div",
            null,
            h("h1", null, "工作台市场"),
            h("p", null, "复制完整方案，或按能力扩展当前工作台。"),
          ),
          h(
            "div",
            { className: "pmrm-subtabs" },
            h(
              "button",
              {
                type: "button",
                className: assetTab === "templates" ? "active" : "",
                onClick: () => setAssetTab("templates"),
              },
              "工作台方案",
            ),
            h(
              "button",
              {
                type: "button",
                className: assetTab === "plugins" ? "active" : "",
                onClick: () => setAssetTab("plugins"),
              },
              "功能插件",
            ),
          ),
        ),
        h(
          "div",
          { className: "pmrm-chips" },
          ...categories.map((item) =>
            h(
              "button",
              {
                type: "button",
                key: item,
                className: `pmrm-chip${category === item ? " active" : ""}`,
                onClick: () => chooseCategory(item),
              },
              item,
            ),
          ),
        ),
        h(
          "div",
          { className: "pmrm-filterbar" },
          h(
            "label",
            null,
            "发布者",
            h(
              "select",
              {
                value: publisher,
                onChange: (event) => choosePublisher(event.target.value),
              },
              h("option", { value: "all" }, "全部发布者"),
              h("option", { value: "official" }, "官方"),
              h("option", { value: "certified" }, "认证团队"),
              h("option", { value: "community" }, "社区"),
            ),
          ),
          h(
            "label",
            null,
            "兼容性",
            h(
              "select",
              {
                value: compatibility,
                onChange: (event) => chooseCompatibility(event.target.value),
              },
              h("option", { value: "all" }, "全部兼容性"),
              h("option", { value: "compatible" }, "当前宿主兼容"),
              h("option", { value: "incompatible" }, "需要升级"),
            ),
          ),
          h(
            "label",
            null,
            "排序",
            h(
              "select",
              {
                value: sort,
                onChange: (event) => chooseSort(event.target.value),
              },
              h("option", { value: "recommended" }, "推荐"),
              h("option", { value: "updated" }, "最近更新"),
              h("option", { value: "name" }, "名称"),
            ),
          ),
          h("span", { className: "pmrm-filter-total" }, `${pagination.total} 项`),
        ),
        assetTab === "templates"
          ? h(
              "div",
              { className: "pmrm-grid" },
              ...templateCards,
              templateCards.length === 0 && !loading
                ? h("div", { className: "pmrm-empty" }, "没有匹配的工作台方案")
                : null,
            )
          : h(
              "div",
              { className: "pmrm-list" },
              ...pluginCards,
              pluginCards.length === 0 && !loading
                ? h("div", { className: "pmrm-empty" }, "没有匹配的功能插件")
                : null,
            ),
        pagination.pageCount > 1
          ? h(
              "div",
              { className: "pmrm-pager" },
              h(
                "button",
                {
                  type: "button",
                  disabled: pagination.page <= 1 || loading,
                  onClick: () => changePage(pagination.page - 1),
                },
                "上一页",
              ),
              h(
                "span",
                null,
                `第 ${pagination.page} / ${pagination.pageCount} 页`,
              ),
              h(
                "button",
                {
                  type: "button",
                  disabled: pagination.page >= pagination.pageCount || loading,
                  onClick: () => changePage(pagination.page + 1),
                },
                "下一页",
              ),
            )
          : null,
      );

      const content =
        tab === "skill" ? skillView : tab === "mcp" ? mcpView : workbenchView;

      const detailKindLabel =
        detail === null
          ? ""
          : detail.kind === "template"
            ? "工作台方案"
            : detail.kind === "plugin"
              ? "功能插件"
              : detail.kind === "skill"
                ? "Skill 详情"
                : "MCP 详情";
      const activeReadOnly =
        activeWorkbench !== null &&
        activeWorkbench.ownerId !== currentUserId;
      let actionLabel = "";
      let actionDisabled = busy;
      let action = () => {};
      if (detail?.kind === "template") {
        actionLabel =
          detail.loading === true
            ? "正在校验依赖…"
            : detail.value.compatibility === "incompatible"
              ? "依赖不可用，暂时无法复制"
              : "复制到我的工作台";
        actionDisabled ||=
          detail.loading === true ||
          detail.error !== undefined ||
          detail.value.compatibility === "incompatible";
        action = () => void copyTemplate(detail.value);
      } else if (detail?.kind === "skill") {
        actionLabel =
          detail.value.status === "enabled" ? "已启用" : "启用 Skill";
        actionDisabled ||= detail.value.status === "enabled";
        action = () => void installSkill(detail.value);
      } else if (detail?.kind === "mcp") {
        actionLabel =
          detail.value.status === "connected"
            ? "已连接"
            : detail.value.status === "pending"
              ? "等待治理验证"
              : detail.value.connectionMode === "provider"
                ? "发起连接"
                : "登记连接请求";
        actionDisabled ||= detail.value.status !== "off";
        action = () => void connectMcp(detail.value);
      } else if (detail?.kind === "plugin") {
        actionLabel = activeReadOnly
          ? "只读工作台：复制后可编辑"
          : detail.value.status === "enabled"
            ? "添加到当前工作台"
            : detail.value.status === "not_enabled"
              ? "启用并添加到当前工作台"
              : assetStatusLabel("plugin", detail.value.status);
        actionDisabled ||=
          activeReadOnly ||
          activeWorkbench === null ||
          ["not_packaged", "disabled", "incompatible"].includes(
            detail.value.status,
          );
        action = () => void enablePlugin(detail.value);
      }

      const detailBody =
        detail === null
          ? null
          : h(
              react.Fragment,
              null,
              detail.kind === "template"
                ? h(
                    "div",
                    {
                      className: "pmrm-preview",
                      style: {
                        "--template-color": detail.value.color,
                        height: "150px",
                        border: "1px solid var(--dsw-alias-border-l2)",
                        borderRadius: "7px",
                      },
                    },
                    ...templateBlocks(detail.value),
                  )
                : null,
              h(
                "div",
                { className: "pmrm-card-title", style: { marginTop: "12px" } },
                h(
                  "span",
                  {
                    className: "pmrm-mark",
                    style: {
                      "--asset-color":
                        detail.kind === "mcp"
                          ? "#168a74"
                          : detail.kind === "template"
                            ? detail.value.color
                            : detail.kind === "skill"
                              ? "#4f8ef7"
                              : "#7057ca",
                    },
                  },
                  detail.kind === "mcp"
                    ? ICONS.store
                    : detail.kind === "template"
                      ? ICONS.store
                      : detail.kind === "skill"
                        ? ICONS.alert
                        : ICONS.plus,
                ),
                h(
                  "div",
                  null,
                  h("strong", null, detail.value.name),
                  h(
                    "p",
                    null,
                    `${detail.value.publisher.name} · v${detail.value.version}`,
                  ),
                ),
              ),
              h("p", null, detail.value.description),
              h(
                "div",
                { className: "pmrm-facts" },
                detail.kind === "template"
                  ? [
                      h(
                        "div",
                        { className: "pmrm-fact", key: "version" },
                        h("span", null, "方案版本"),
                        h("strong", null, `v${detail.value.version}`),
                      ),
                      h(
                        "div",
                        { className: "pmrm-fact", key: "panels" },
                        h("span", null, "包含面板"),
                        h(
                          "strong",
                          null,
                          `${detail.value.panelPlan.length} 个`,
                        ),
                      ),
                      h(
                        "div",
                        { className: "pmrm-fact", key: "compatibility" },
                        h("span", null, "兼容性"),
                        h(
                          "strong",
                          null,
                          detail.value.compatibility === "incompatible"
                            ? "需要升级"
                            : "当前宿主兼容",
                        ),
                      ),
                      h(
                        "div",
                        { className: "pmrm-fact", key: "source" },
                        h("span", null, "来源"),
                        h("strong", null, sourceLabel(detail.value.source)),
                      ),
                    ]
                  : detail.kind === "plugin"
                    ? [
                        h(
                          "div",
                          { className: "pmrm-fact", key: "category" },
                          h("span", null, "分类"),
                          h("strong", null, detail.value.category),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "status" },
                          h("span", null, "用户状态"),
                          h(
                            "strong",
                            null,
                            assetStatusLabel("plugin", detail.value.status),
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "host" },
                          h("span", null, "兼容宿主"),
                          h("strong", null, detail.value.compatibleHost),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "runtime" },
                          h("span", null, "DSH 包"),
                          h(
                            "strong",
                            null,
                            detail.value.runtimeStatus === "packaged"
                              ? "已装配"
                              : "未装配",
                          ),
                        ),
                      ]
                    : [
                        h(
                          "div",
                          { className: "pmrm-fact", key: "category" },
                          h(
                            "span",
                            null,
                            detail.kind === "mcp" ? "协议" : "分类",
                          ),
                          h(
                            "strong",
                            null,
                            detail.kind === "mcp"
                              ? detail.value.protocol
                              : detail.value.category,
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "status" },
                          h("span", null, "状态"),
                          h(
                            "strong",
                            null,
                            assetStatusLabel(detail.kind, detail.value.status),
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "publisher" },
                          h("span", null, "发布者"),
                          h("strong", null, detail.value.publisher.name),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "source" },
                          h("span", null, "来源"),
                          h("strong", null, sourceLabel(detail.value.source)),
                        ),
                      ],
              ),
              detail.kind === "template"
                ? h(
                    react.Fragment,
                    null,
                    h(
                      "div",
                      { className: "pmrm-section" },
                      h("h3", null, "真实布局"),
                      ...(detail.value.panels ??
                        detail.value.panelPlan.map((panel) => ({
                          ...panel,
                          title: panel.pluginId.replace("pluginmax.", ""),
                        }))
                      ).map((panel) =>
                        h(
                          "div",
                          {
                            className: "pmrm-panel-row",
                            key: `${panel.pluginId}-${panel.order}`,
                          },
                          h("span", null, panel.title),
                          h("small", null, `${panel.span}/6`),
                          h("small", null, `v${panel.pluginVersion}`),
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmrm-section" },
                      h("h3", null, "必需插件与兼容性"),
                      detail.loading === true
                        ? h(
                            "div",
                            { className: "pmrm-permission" },
                            "正在读取插件装配和启用状态…",
                          )
                        : detail.error !== undefined
                          ? h(
                              "div",
                              { className: "pmrm-error" },
                              `依赖状态读取失败：${detail.error}`,
                            )
                        : h(
                            "div",
                            { className: "pmrm-dependency-list" },
                            ...(detail.value.dependencies ?? []).map((dependency) => {
                              const labels = {
                                enabled: "已启用",
                                not_enabled: "复制时启用",
                                not_packaged: "未装配",
                                disabled: "已禁用",
                                incompatible: "版本不兼容",
                                missing: "缺少插件",
                              };
                              return h(
                                "div",
                                {
                                  className: "pmrm-panel-row",
                                  key: dependency.id,
                                },
                                h("span", null, dependency.id),
                                h(
                                  "small",
                                  null,
                                  `${dependency.versionRange} · ${labels[dependency.status]}`,
                                ),
                              );
                            }),
                          ),
                    ),
                  )
                : []
              ,
              detail.kind === "mcp" && detail.value.connectionMode === "request_only"
                ? h(
                    "div",
                    { className: "pmrm-section" },
                    h("h3", null, "连接边界"),
                    h(
                      "div",
                      { className: "pmrm-permission" },
                      h("strong", null, "当前未接入 MCP 治理 provider"),
                      h(
                        "span",
                        null,
                        "操作只会登记待验证请求，不会生成凭据或伪造已连接状态。",
                      ),
                    ),
                  )
                : null,
              h(
                "div",
                { className: "pmrm-section" },
                h(
                  "h3",
                  null,
                  detail.kind === "template" ? "数据边界" : "权限与数据范围",
                ),
                h(
                  "div",
                  { className: "pmrm-permission" },
                  h(
                    "strong",
                    null,
                    detail.kind === "template"
                      ? "复制不会扩大你的数据权限"
                      : "市场启用不会扩大业务数据权限",
                  ),
                  ...(detail.value.permissions ?? detail.value.dataScopes ?? []).map(
                    (permission) =>
                      h("span", { key: permission }, `· ${permission}`),
                  ),
                ),
              ),
            );

      const detailView =
        detail === null
          ? null
          : h(
              "aside",
              { className: "pmrm-detail", "aria-label": "资源详情" },
              h(
                "div",
                { className: "pmrm-detail-head" },
                h("strong", null, detailKindLabel),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmrm-iconbtn",
                    onClick: () => setDetail(null),
                    "aria-label": "关闭详情",
                  },
                  ICONS.close,
                ),
              ),
              h("div", { className: "pmrm-detail-body" }, detailBody),
              h(
                "div",
                { className: "pmrm-detail-foot" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmrm-btn primary",
                    style: { width: "100%" },
                    disabled: actionDisabled,
                    onClick: action,
                  },
                  actionLabel,
                ),
              ),
            );

      return h(
        "section",
        { className: "pmrm", "data-resource-market-page": "true", style: { position: "relative" } },
        h("style", null, styles),
        h(
          "header",
          { className: "pmrm-top" },
          h(
            "div",
            { className: "pmrm-brand" },
            h("span", { className: "pmrm-brand-mark" }, ICONS.store),
            h(
              "span",
              null,
              h("strong", null, "资源市场"),
              h("small", null, "Skill、MCP 与工作台方案"),
            ),
          ),
          h(
            "div",
            { className: "pmrm-tabs", role: "tablist", "aria-label": "资源类型" },
            ...[
              ["skill", "Skill"],
              ["mcp", "MCP"],
              ["workbench", "工作台市场"],
            ].map(([key, label]) =>
              h(
                "button",
                {
                  type: "button",
                  key,
                  role: "tab",
                  "aria-selected": tab === key,
                  className: tab === key ? "active" : "",
                  onClick: () => switchTab(key),
                },
                label,
              ),
            ),
          ),
          h(
            "label",
            { className: "pmrm-search" },
            ICONS.search,
            h("input", {
              type: "search",
              value: query,
              placeholder: "搜索当前页签",
              "aria-label": "搜索资源市场",
              onChange: (event) => updateSearch(event.target.value),
            }),
          ),
          props.renderActions?.() ?? null,
          h(
            "button",
            {
              type: "button",
              className: "pmrm-iconbtn",
              onClick: () => window.__pluginmaxShell?.setRoute("workbench-new"),
              "aria-label": "关闭资源市场",
            },
            ICONS.close,
          ),
        ),
        h(
          "div",
          { className: "pmrm-main" },
          h(
            "nav",
            { className: "pmrm-side", "aria-label": "资源分类" },
            h("div", { className: "pmrm-side-label" }, "发现"),
            h(
              "button",
              {
                type: "button",
                className:
                  tab === "workbench" && category === "全部" ? "active" : "",
                onClick: () => {
                  setTab("workbench");
                  setAssetTab("templates");
                  chooseCategory("全部");
                },
              },
              ICONS.store,
              "编辑精选",
            ),
            ...["运营", "项目", "管理", "情报"].map((item) =>
              h(
                "button",
                {
                  type: "button",
                  key: item,
                  className: category === item ? "active" : "",
                  onClick: () => {
                    setTab("workbench");
                    setAssetTab("templates");
                    chooseCategory(item);
                  },
                },
                item,
              ),
            ),
          ),
          h(
            "main",
            { className: "pmrm-content" },
            h(
              "div",
              { className: "pmrm-content-inner" },
              error !== "" ? h("div", { className: "pmrm-error" }, error) : null,
              loading ? h("div", { style: { padding: "20px", color: "var(--dsw-alias-label-tertiary)", fontSize: "11px" } }, "正在加载…") : content,
            ),
          ),
        ),
        detailView,
        toast !== "" ? h("div", { className: "pmrm-toast", role: "status" }, toast) : null,
      );
    }

    exports.inject = ["slots"];
    exports.__test = { visibilityLabel, templateBlocks };
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global",
            id: "pluginmax-resource-market",
            order: 40,
          },
          ResourceMarketPage,
        ),
      );
    };

    return module.exports;
  },
});
