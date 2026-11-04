window.__ModuleLoader__.load({
  id: "dsh-collab-task",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;
    const Fragment = react.Fragment;

    const TOKEN_KEY = "pluginmax.collab.token";
    const STATUSES = [
      { key: "todo", label: "待处理" },
      { key: "progress", label: "进行中" },
      { key: "review", label: "待验收" },
      { key: "done", label: "已完成" },
      { key: "cancelled", label: "已取消" },
    ];
    const STATUS_LABEL = Object.fromEntries(
      STATUSES.map((status) => [status.key, status.label]),
    );
    /**
     * 任务优先级平移：存储仍是 P1–P3（兼容历史数据），产品口径统一显示为 P0–P2。
     * 存储 P1 = 显示 P0（最高档），P2 = P1，P3 = P2。
     */
    const PRIORITY_DISPLAY = { P1: "P0", P2: "P1", P3: "P2" };
    const priorityLabel = (value) => PRIORITY_DISPLAY[value] ?? value;
    const REASONING_EFFORT_OPTIONS = [
      { value: "minimal", label: "最低" },
      { value: "low", label: "低" },
      { value: "medium", label: "中" },
      { value: "high", label: "高" },
      { value: "xhigh", label: "极高" },
      { value: "max", label: "最大" },
    ];

    function buildExecutionPolicy(form) {
      const allowPublicWeb = form.allowPublicWeb === true;
      const runtimeId = String(form.runtimeId ?? "").trim();
      const model = String(form.model ?? "").trim();
      const reasoningEffort = String(form.reasoningEffort ?? "").trim();
      return {
        schemaVersion: 1,
        runtime: {
          selection: runtimeId === "" ? "recommended" : "user-selected",
          allowedRuntimeIds: runtimeId === "" ? [] : [runtimeId],
          requiredCapabilities: [],
          ...(model === "" ? {} : { model }),
          ...(reasoningEffort === "" ? {} : { reasoningEffort }),
        },
        sourcePolicy: {
          allow: [
            "workspace",
            "task-attachments",
            "project-memory",
            ...(allowPublicWeb ? ["public-web", "regulatory-filing"] : []),
          ],
          deny: ["private-local-data"],
          citation: allowPublicWeb ? "required-for-factual-claims" : "none",
          requirePublishedAt: allowPublicWeb,
          requireAccessedAt: allowPublicWeb,
        },
        toolPolicy: {
          allow: [],
          deny: [],
          requireApproval:
            form.requireToolApproval === false
              ? []
              : ["fs.write", "shell.execute", "external.publish"],
        },
        evidence: {
          requirePlan: true,
          requireToolEvents: form.requireToolEvents !== false,
          requireCitations: allowPublicWeb,
          requireStructuredSubagents: false,
        },
        humanGates: [],
        budget: {},
      };
    }

    function executionPolicyForm(task) {
      const policy = task.executionPolicy;
      if (policy === undefined || policy === null) {
        return {
          allowPublicWeb: false,
          requireToolApproval: false,
          requireToolEvents: false,
          runtimeId: "",
          model: "",
          reasoningEffort: "",
        };
      }
      return {
        allowPublicWeb:
          policy.sourcePolicy?.allow?.includes("public-web") === true,
        requireToolApproval:
          Array.isArray(policy.toolPolicy?.requireApproval) &&
          policy.toolPolicy.requireApproval.length > 0,
        requireToolEvents: policy.evidence?.requireToolEvents === true,
        runtimeId: policy.runtime?.allowedRuntimeIds?.[0] ?? "",
        model: policy.runtime?.model ?? "",
        reasoningEffort: policy.runtime?.reasoningEffort ?? "",
      };
    }

    /**
     * 「重置会话」入口开关：前期用户还不熟悉这个语义，先在界面上隐藏。
     * 服务端能力（/api/collab/tasks/session/reset）保留，需要时改回 true 即可。
     */
    const SHOW_SESSION_RESET = false;

    /*
     * 「仅看已加入 / 平台全量」是跨模块偏好：任务、会议、工作流、Teammate
     * 与工作台共用同一个 window store，点击跨模块跳转时沿用用户当前选择。
     * 这里幂等创建，谁先加载谁初始化。
     */
    function ensureScopeStore() {
      if (window.__pluginmaxScope) return window.__pluginmaxScope;
      let all = false;
      const listeners = new Set();
      window.__pluginmaxScope = {
        getSnapshot: () => all,
        setAll: (next) => {
          const value = next === true;
          if (value === all) return;
          all = value;
          for (const listener of listeners) listener();
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
      return window.__pluginmaxScope;
    }
    const scopeStore = ensureScopeStore();

    const styles = `
      /* 页面内边距由 shell 的 .pmx-page 提供，这里不再叠加，保持与工作台一致的内容宽度。 */
      /* 会议侧边栏展开时任务区会变窄：用容器查询按「可用宽度」而不是视口宽度响应。 */
      .pmtask{position:relative;z-index:0;isolation:isolate;min-width:0;max-width:100%;min-height:100%;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);container-type:inline-size;}
      .pmtask *{box-sizing:border-box;}
      .pmtask-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;}
      .pmtask-head h1{margin:0;font-size:19px;line-height:1.3;}
      .pmtask-sub{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtask-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .pmtask-iconbtn{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtask-iconbtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
      .pmtask-iconbtn svg{width:14px;height:14px;}
      .pmtask-select,.pmtask-input,.pmtask-area{height:34px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:0 9px;min-width:0;}
      .pmtask-area{height:auto;padding:8px 9px;resize:vertical;}
      .pmtask-btn{height:34px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:6px;padding:0 12px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;}
      .pmtask-btn.secondary{background:transparent;border:0.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);}
      .pmtask-btn.secondary:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l4);}
      .pmtask-btn-count{min-width:18px;height:18px;display:inline-grid;place-items:center;padding:0 4px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10.5px;font-variant-numeric:tabular-nums;line-height:1;}
      .pmtask-btn.danger{background:transparent;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 45%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-btn:disabled{opacity:.45;cursor:not-allowed;}
      .pmtask-icon-btn:disabled,.pmtask-tool-btn:disabled,.pmtask-assign-trigger:disabled,.pmtask-input:disabled,.pmtask-composer-input:disabled{opacity:.5;cursor:not-allowed;}
      .pmtask-locked-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;}
      .pmtask-filter{min-width:0;max-width:100%;display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:14px;padding:10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-notice{flex:none;min-height:38px;padding:8px 10px;}
      .pmtask-search{display:flex;align-items:center;gap:6px;flex:1 1 260px;min-width:220px;}
      .pmtask-search .pmtask-input{flex:1 1 auto;}
      .pmtask-token{height:28px;border:0;border-radius:6px;padding:0 9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
      .pmtask-token.active{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      /* 项目范围：两段式，高亮段 = 当前实际视图。 */
      .pmtask-scope-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-scope-seg .pmtask-token{height:24px;padding:0 8px;background:transparent;}
      .pmtask-scope-seg .pmtask-token:not(.active):hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtask-board{min-width:0;max-width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:stretch;flex:1;min-height:max(420px,calc(100vh - 255px));overflow-x:auto;overscroll-behavior-inline:contain;}
      .pmtask-column{min-width:0;min-height:100%;display:flex;flex-direction:column;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-column.drop-ready{border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 1px var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-column-head{display:grid;grid-template-columns:8px minmax(0,1fr) auto auto;align-items:center;gap:7px;padding:10px 10px 8px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
      .pmtask-column-head strong{font-size:12.5px;}
      .pmtask-column-count{color:var(--dsw-alias-label-tertiary);font-size:11px;}
      .pmtask-column-add{width:24px;height:24px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtask-column-add:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtask-column-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary);}
      .pmtask-column-dot.progress{background:#4f8ef7}.pmtask-column-dot.review{background:#e2a737}.pmtask-column-dot.done{background:#34d47e}.pmtask-column-dot.cancelled{background:var(--dsw-alias-state-error-primary,#e5534b)}
      .pmtask-cards{min-width:0;flex:1;display:grid;gap:7px;align-content:start;padding:8px;}
      .pmtask-card{min-width:0;display:grid;gap:7px;overflow:hidden;padding:10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;}
      .pmtask-card:hover{border-color:var(--dsw-alias-border-l4);}
      .pmtask-card.dragging{opacity:.55;}
      .pmtask-card.running{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 38%,transparent);}
      .pmtask-card.archived{opacity:.72;border-style:dashed;}
      .pmtask-card.highlighted{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 10%,var(--dsw-alias-bg-layer-2));}
      .pmtask-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:14px;}
      .pmtask-detail-btn{height:24px;padding:0 8px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer;}
      .pmtask-detail-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l4);}
      .pmtask-id{color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-spinner{width:14px;height:14px;flex:none;display:inline-block;border-radius:50%;border:2px solid color-mix(in srgb,var(--dsw-alias-label-tertiary) 38%,transparent);border-top-color:var(--dsw-alias-accent-primary,#4f8ef7);animation:pmtask-spin .8s linear infinite;}
      .pmtask-spinner.lg{width:16px;height:16px;}
      .pmtask-run-state{width:10px;height:10px;flex:none;display:inline-block;border-radius:50%;background:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmtask-run-state.cancelled{border-radius:2px;background:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-run-state.waiting,.pmtask-run-state.failed{background:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-run-state.interrupted{background:var(--dsw-alias-label-tertiary);}
      @keyframes pmtask-spin{to{transform:rotate(360deg);}}
      .pmtask-title{font-size:13px;font-weight:650;line-height:1.35;overflow-wrap:anywhere;}
      .pmtask-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.45;}
      .pmtask-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmtask-pill{display:inline-flex;align-items:center;height:20px;border-radius:6px;padding:0 6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-base));font-size:10.5px;line-height:1;white-space:nowrap;}
      .pmtask-pill.p1{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-pill.progress{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-pill.review{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 14%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-pill.done{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 14%,transparent);color:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmtask-pill.cancelled{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-pill.archived{background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 18%,transparent);color:var(--dsw-alias-label-secondary);}
      .pmtask-pill.workflow{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-pill.reassign{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 16%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-pill.consensus{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 14%,transparent);color:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmtask-workflow-meta{display:flex;align-items:center;gap:6px;min-width:0;}
      .pmtask-workflow-node{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-workflow-action{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:12px;padding:10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 28%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,transparent);}
      .pmtask-workflow-action-copy{display:grid;gap:4px;min-width:0;}
      .pmtask-workflow-action-copy strong{font-size:12.5px;}
      .pmtask-workflow-action-copy span{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5;}
      .pmtask-workflow-action-buttons{display:flex;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end;gap:6px;}
      .pmtask-workflow-notice{display:flex;align-items:center;gap:10px;padding:10px 12px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);}
      .pmtask-workflow-notice strong{flex:0 0 auto;color:var(--dsw-alias-label-primary);font-size:12.5px;}
      .pmtask-workflow-notice span{flex:1;font-size:11.5px;line-height:1.5;}
      .pmtask-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,36%);gap:14px;}
      .pmtask-detail-main,.pmtask-detail-side{min-width:0;display:grid;gap:12px;align-content:start;}
      .pmtask-panel{border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));padding:12px;}
      .pmtask-panel h2,.pmtask-panel h3{margin:0;}
      .pmtask-panel h2{font-size:18px;}
      .pmtask-panel h3{font-size:13px;}
      .pmtask-detail-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
      .pmtask-crumb{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .pmtask-crumb b{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:700;}
      .pmtask-detail-top .pmtask-assign-select{margin-left:0;}
      .pmtask-detail-top .pmtask-pill{height:auto;padding:2px 6px;border-radius:4px;font-size:10.5px;line-height:1.5;}
      .pmtask-intro{display:grid;gap:12px;margin-top:0;}
      .pmtask-intro-head{display:flex;align-items:flex-start;gap:10px;}
      .pmtask-intro-head h2{flex:1;min-width:0;margin:0;font-size:18px;line-height:1.35;overflow-wrap:anywhere;}
      .pmtask-intro p{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;}
      .pmtask-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px;}
      .pmtask-grid-demo{grid-template-columns:repeat(3,minmax(0,1fr));}
      .pmtask-grid-demo .pmtask-field{padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-field{display:grid;gap:4px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;}
      .pmtask-field strong{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:1.5;}
      .pmtask-dependency-picker{position:relative;display:grid;gap:5px;}
      .pmtask-dependency-label{color:var(--dsw-alias-label-secondary);font-size:11px;}
      .pmtask-dependency-selected{min-height:34px;display:flex;align-items:center;gap:8px;padding:5px 7px 5px 9px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);}
      .pmtask-dependency-selected>span{min-width:0;flex:1;display:grid;gap:1px;}
      .pmtask-dependency-selected strong,.pmtask-dependency-selected small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-dependency-selected strong{font-size:11.5px;}
      .pmtask-dependency-selected small{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmtask-dependency-selected button{width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;}
      .pmtask-dependency-selected button:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmtask-dependency-options{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:80;max-height:240px;overflow:auto;display:grid;gap:2px;padding:4px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 14px 34px rgba(0,0,0,.24);}
      .pmtask-dependency-option{min-width:0;display:grid;gap:3px;padding:7px 8px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;}
      .pmtask-dependency-option:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmtask-dependency-option strong,.pmtask-dependency-option small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-dependency-option strong{font-size:11.5px;}
      .pmtask-dependency-option small{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmtask-dependency-empty{padding:10px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;text-align:center;}
      .pmtask-review-config{align-content:start;}
      .pmtask-review-config .pmtask-check{align-items:flex-start;margin:0;color:var(--dsw-alias-label-primary);font-size:12.5px;}
      .pmtask-review-config .pmtask-check em{color:var(--dsw-alias-label-secondary);font-size:11px;}
      .pmtask-check{display:flex;align-items:flex-start;gap:7px;color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:1.5;cursor:pointer;}
      .pmtask-check input[type=checkbox]{flex:none;width:14px;height:14px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;}
      .pmtask-check[data-disabled=true]{color:var(--dsw-alias-label-tertiary);cursor:not-allowed;}
      .pmtask-check input[type=checkbox]:disabled{cursor:not-allowed;}
      .pmtask-check span{min-width:0;}
      .pmtask-check em{display:block;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:11px;font-style:normal;line-height:1.5;}
      .pmtask-edit-form{gap:10px;}
      .pmtask-edit-title-row{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:9px;align-items:end;}
      .pmtask-edit-grow,.pmtask-edit-priority{min-width:0;}
      .pmtask-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
      .pmtask-acceptance{display:grid;gap:8px;padding:12px 14px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-acceptance-head{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmtask-acceptance-head strong{color:var(--dsw-alias-label-primary);font-size:12.5px;}
      .pmtask-acceptance-head span{white-space:nowrap;font-variant-numeric:tabular-nums;}
      .pmtask-steps{display:grid;gap:6px;}
      .pmtask-step{display:flex;align-items:flex-start;gap:8px;border-radius:6px;padding:6px 7px;color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer;}
      .pmtask-step:hover{background:var(--dsw-alias-bg-layer-1);}
      .pmtask-step input{margin:2px 0 0;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-step.done{color:var(--dsw-alias-label-secondary);text-decoration:line-through;}
      .pmtask-step.disabled{cursor:default;opacity:.72;}
      .pmtask-step.disabled:hover{background:transparent;}
      .pmtask-messages{max-height:360px;overflow:auto;display:grid;gap:8px;padding:2px;}
      .pmtask-message{border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;padding:8px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-message.agent{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,transparent);}
      .pmtask-message.streaming{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 65%,transparent);}
      .pmtask-message-head{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--dsw-alias-label-secondary);}
      .pmtask-message-head strong{font-size:12.5px;font-weight:700;}
      .pmtask-run-role{flex:none;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:650;line-height:1.4;}
      .pmtask-run-role.owner{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-run-role.assist{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 14%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-run-role.fyi{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);}
      .pmtask-message-body{font-size:12.5px;line-height:1.55;white-space:pre-wrap;}
      .pmtask-stream-caret{display:inline-block;width:6px;height:13px;margin-left:4px;vertical-align:-2px;background:var(--dsw-alias-accent-primary,#4f8ef7);animation:pmtask-blink 1s steps(1) infinite;}
      @keyframes pmtask-blink{50%{opacity:0;}}
      .pmtask-comment{display:grid;gap:6px;padding:9px 0;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
      .pmtask-comment:last-child{border-bottom:0;}
      .pmtask-reply{margin-left:20px;padding:7px 8px;border-left:2px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);}
      .pmtask-compose{display:grid;gap:7px;margin-top:10px;}
      .pmtask-compose-toolbar{position:relative;display:flex;align-items:center;gap:6px;}
      .pmtask-icon-btn{width:30px;height:30px;display:inline-grid;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;cursor:pointer;}
      .pmtask-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtask-mention-menu{position:absolute;left:0;bottom:calc(100% + 6px);z-index:35;width:min(330px,100%);max-height:280px;overflow:auto;padding:6px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 14px 34px rgba(0,0,0,.18);}
      .pmtask-mention-group{padding:7px 8px 3px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:650;}
      .pmtask-mention-item{width:100%;display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:8px;border:0;border-radius:6px;padding:7px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;}
      .pmtask-mention-item:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmtask-mention-item strong,.pmtask-mention-item small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-mention-item strong{font-size:12px;}
      .pmtask-mention-item small{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-mention-empty{padding:14px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmtask-avatar{width:26px;height:26px;display:grid;place-items:center;border-radius:7px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;}
      .pmtask-avatar.agents{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-avatar.roles{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 14%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-ring{width:20px;height:20px;display:grid;place-items:center;padding:2px;border-radius:50%;flex:none;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.26);}
      .pmtask-ring.platform{background:#63b8ff;box-shadow:0 0 0 1px rgba(99,184,255,.55);}
      .pmtask-ring.lg{width:26px;height:26px;}
      .pmtask-avatar-art{width:100%;height:100%;display:block;overflow:hidden;border:2px solid var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));border-radius:50%;background:#20242a;object-fit:cover;}
      .pmtask-assignee{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:150px;color:var(--dsw-alias-label-secondary);}
      .pmtask-assignee-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;}
      .pmtask-attachments{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
      .pmtask-attachment{display:inline-flex;align-items:center;gap:5px;max-width:260px;height:24px;border-radius:6px;padding:0 6px 0 8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmtask-attachment>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-attachment button{width:18px;height:18px;display:grid;place-items:center;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer;}
      .pmtask-compose-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;}
      .pmtask-compose-hint{margin-right:auto;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
      .pmtask-mention{border-radius:4px;padding:0 3px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-timeline{display:grid;gap:7px;}
      .pmtask-event{display:grid;grid-template-columns:70px minmax(0,1fr);gap:7px;font-size:11px;color:var(--dsw-alias-label-secondary);}
      .pmtask-event.error{color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-link{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-menu{position:relative;}
      .pmtask-assign-trigger{height:auto;min-height:32px;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;padding:7px 9px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:400;cursor:pointer;}
      .pmtask-assign-trigger-content{min-width:0;display:flex;align-items:center;gap:7px;flex:1;}
      .pmtask-assign-trigger-copy{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-menu-list{position:absolute;right:auto;left:0;top:calc(100% + 5px);z-index:20;min-width:200px;max-height:300px;overflow-y:auto;display:grid;gap:2px;padding:4px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 14px 34px rgba(0,0,0,.28);}
      .pmtask-menu-list button{min-height:28px;text-align:left;border:0;border-radius:4px;padding:5px 7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;}
      .pmtask-menu-list button:hover{background:var(--dsw-alias-bg-layer-3);}
      .pmtask-receiver-option{display:flex;align-items:center;gap:8px;min-width:220px;}
      .pmtask-filter-menu{flex:none;}
      .pmtask-filter-trigger{width:156px;justify-content:flex-start;}
      .pmtask-filter-trigger-prefix{flex:none;white-space:nowrap;}
      .pmtask-filter-trigger-copy{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;}
      .pmtask-filter-chevron{width:16px;height:16px;flex:none;margin-left:auto;color:var(--dsw-alias-label-secondary);}
      .pmtask-filter-option{width:100%;display:flex;align-items:center;gap:8px;padding:6px 7px;}
      .pmtask-filter-option-copy{min-width:0;flex:1;display:grid;gap:1px;}
      .pmtask-filter-option-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-filter-option-meta{color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-filter-group{padding:8px 7px 2px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:650;}
      .pmtask-filter-symbol{width:20px;height:20px;flex:none;display:grid;place-items:center;border-radius:6px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;}
      .pmtask-filter-symbol.all{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 13%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-filter-symbol.p1{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-receiver-option-copy{min-width:0;display:grid;gap:1px;}
      .pmtask-receiver-option-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-receiver-option-meta{color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-receiver-option .pmtask-avatar,.pmtask-receiver-option .pmtask-ring{width:24px;height:24px;}
      .pmtask-detail{display:block;}
      .pmtask-detail-page,.pmtask-detail-page *{box-sizing:border-box;}
      .pmtask-detail-page{height:100%;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));font-size:14px;line-height:1.5;}
      .pmtask-detail-top{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent);margin-bottom:0;}
      .pmtask-back-btn{height:auto;min-height:30px;padding:4px 9px;font-size:11px;border-width:1px;}
      .pmtask-detail-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,36%);min-height:520px;}
      .pmtask-detail-main{min-width:0;display:block;padding:16px;border-right:1px solid var(--dsw-alias-border-l2);}
      .pmtask-detail-side{min-width:0;display:flex;flex-direction:column;gap:0;padding:0 18px 18px;background:transparent;}
      .pmtask-side-section{min-width:0;max-width:100%;margin-top:18px;padding:14px 0 0;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-side-section h3{margin:0 0 8px;font-size:13px;}
      .pmtask-assign-select{position:relative;flex:none;}
      .pmtask-assign-select .pmtask-assign-trigger{min-width:190px;max-width:270px;justify-content:space-between;}
      .pmtask-assign-trigger.pending{border-color:var(--dsw-alias-accent-primary,#4f8ef7);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-assign-actions{flex:none;display:flex;align-items:center;gap:5px;}
      .pmtask-confirm-btn{height:24px;padding:0 7px;font-size:11px;}
      .pmtask-detail-main .pmtask-intro{gap:12px;margin-top:0;margin-bottom:14px;}
      .pmtask-intro-head .pmtask-pill{height:auto;padding:2px 6px;border-radius:4px;font-size:10.5px;line-height:1.5;}
      .pmtask-intro-head .pmtask-icon-btn{flex:none;width:30px;height:30px;margin-top:-2px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-intro-head .pmtask-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmtask-intro-head .pmtask-icon-btn svg{width:15px;height:15px;}
      .pmtask-detail-main .pmtask-grid{margin-top:0;}
      .pmtask-detail-main .pmtask-actions{gap:7px;margin-top:0;}
      .pmtask-detail-main .pmtask-actions .pmtask-btn{height:auto;min-height:24px;padding:2px 7px;font-size:11px;font-weight:400;border-width:1px;}
      .pmtask-detail-page .pmtask-detail-layout{grid-template-columns:minmax(0,1.35fr) minmax(360px,.92fr);height:calc(100dvh - 100px);min-height:620px;overflow:hidden;}
      .pmtask-detail-page .pmtask-detail-main{min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden;padding:14px;}
      .pmtask-detail-page .pmtask-detail-side{min-height:0;height:100%;position:relative;display:flex;flex-direction:column;overflow:hidden;padding:0;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-detail-page .pmtask-detail-side-scroll{min-height:0;flex:1;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;}
      .pmtask-detail-page .pmtask-detail-side>.pmtask-edit-form{padding:14px 16px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro{display:none;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-edit-form{order:1;flex:none;margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-composer{order:4;flex:none;margin:0;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-detail-section{margin:0;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-detail-section.pmtask-detail-conversation{order:2;flex:1 1 160px;min-height:140px;overflow:auto;padding:0 4px 8px 0;border-top:0;scrollbar-gutter:stable;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-detail-comments{order:3;flex:none;max-height:190px;overflow:auto;padding:9px 0 0;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-detail-comments{display:none;}
      .pmtask-detail-page .pmtask-detail-comments>h3,.pmtask-detail-page .pmtask-detail-legacy-comment-list,.pmtask-detail-page .pmtask-detail-comments .pmtask-comment-guide,.pmtask-detail-page .pmtask-detail-comments .pmtask-comment-consensus em{display:none;}
      .pmtask-detail-page .pmtask-detail-comments .pmtask-comment-form{margin-top:0;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:5px;}
      .pmtask-detail-page .pmtask-detail-comments .pmtask-comment-consensus{grid-column:auto;padding:2px 5px;border:0;background:transparent;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-edit-form{display:none;}
      .pmtask-detail-requirement-label{width:max-content;display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);font-size:10px;font-weight:650;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro .pmtask-intro-head h2{font-size:14px;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro .pmtask-intro-head .pmtask-pill,
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro .pmtask-intro-head .pmtask-icon-btn,
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro>.pmtask-grid,
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro>.pmtask-locked-hint,
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro>.pmtask-workflow-action,
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro>.pmtask-actions{display:none;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-intro>.pmtask-acceptance{padding:9px 10px;}
      .pmtask-detail-page .pmtask-detail-conversation .pmtask-history{max-height:none;overflow:visible;gap:14px;padding:8px 0 2px;}
      .pmtask-detail-page .pmtask-detail-conversation .pmtask-history-head{display:none;}
      .pmtask-detail-page .pmtask-history-message{display:flex;align-items:flex-start;gap:9px;}
      .pmtask-detail-page .pmtask-history-message .pmtask-message-body{width:fit-content;min-width:0;max-width:min(72%,620px);display:flex;flex-direction:column;align-items:flex-start;}
      .pmtask-detail-page .pmtask-history-message.is-mine{flex-direction:row-reverse;}
      .pmtask-detail-page .pmtask-history-message.is-mine .pmtask-message-body{margin-left:auto;align-items:flex-end;}
      .pmtask-detail-page .pmtask-history-message.is-mine .pmtask-message-head{justify-content:flex-end;}
      .pmtask-detail-page .pmtask-history-message .pmtask-bubble{border:1px solid var(--dsw-alias-border-l2);border-radius:3px 8px 8px 8px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-detail-page .pmtask-history-message.is-mine .pmtask-bubble{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 38%,transparent);border-radius:8px 3px 8px 8px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,var(--dsw-alias-bg-layer-1));}
      .pmtask-detail-page .pmtask-history-message.is-mine .pmtask-attachments{justify-content:flex-end;}
      .pmtask-typing-row{display:flex;align-items:flex-start;gap:9px;padding:4px 0;}
      .pmtask-typing-bubble{display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:7px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:3px 8px 8px 8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmtask-typing-dots{display:inline-flex;align-items:center;gap:3px;height:12px;}
      .pmtask-typing-dots i{width:4px;height:4px;border-radius:50%;background:var(--dsw-alias-accent-primary,#4f8ef7);animation:pmtask-typing-dot 1.1s ease-in-out infinite;}
      .pmtask-typing-dots i:nth-child(2){animation-delay:.15s;}
      .pmtask-typing-dots i:nth-child(3){animation-delay:.3s;}
      @keyframes pmtask-typing-dot{0%,60%,100%{opacity:.25;transform:translateY(0);}30%{opacity:1;transform:translateY(-2px);}}
      .pmtask-message-run-state{display:inline-flex;align-items:center;gap:5px;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.4;}
      .pmtask-message-run-state::before{content:"";width:7px;height:7px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary);}
      .pmtask-message-run-state.cancelled{color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-message-run-state.cancelled::before{border-radius:1px;background:currentColor;}
      .pmtask-message-run-state.failed{color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-message-run-state.failed::before{background:currentColor;}
      .pmtask-detail-message-badge{flex:none;height:17px;display:inline-flex;align-items:center;padding:0 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:9px;font-weight:600;white-space:nowrap;}
      .pmtask-detail-message-badge.instruction{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 13%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-detail-message-badge.feedback{background:color-mix(in srgb,#a58bff 13%,transparent);color:#b7a1ff;}
      .pmtask-detail-message-badge.consensus{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 13%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmtask-detail-message-badge.collaboration{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 13%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-detail-message-badge.workflow-task,.pmtask-detail-message-badge.workflow-discussion{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-detail-message-badge.system{color:var(--dsw-alias-label-tertiary);}
      .pmtask-detail-page .pmtask-history-message .pmtask-run-role,.pmtask-detail-page .pmtask-history-message .pmtask-pill.consensus{display:none;}
      .pmtask-detail-page .pmtask-history-event{padding:3px 0;}
      .pmtask-detail-runtime{order:0;flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;}
      .pmtask-detail-runtime-trigger{width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
      .pmtask-detail-runtime-trigger:hover{background:var(--dsw-alias-bg-layer-3);}
      .pmtask-detail-runtime-live{width:7px;height:7px;flex:none;border-radius:50%;background:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 13%,transparent);}
      .pmtask-detail-runtime-live.idle{background:var(--dsw-alias-label-tertiary);box-shadow:none;}
      .pmtask-detail-runtime-copy{min-width:0;display:grid;gap:1px;}
      .pmtask-detail-runtime-copy strong,.pmtask-detail-runtime-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-detail-runtime-copy strong{font-size:11.5px;}
      .pmtask-detail-runtime-copy small{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmtask-detail-runtime-current{min-width:0;flex:1;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-detail-runtime-count{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;font-variant-numeric:tabular-nums;}
      .pmtask-detail-runtime-queue{flex:none;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:9.5px;white-space:nowrap;}
      .pmtask-detail-runtime-caret{width:7px;height:7px;flex:none;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);}
      .pmtask-detail-runtime-trigger[aria-expanded="true"] .pmtask-detail-runtime-caret{transform:rotate(225deg) translate(-2px,-2px);}
      .pmtask-detail-runtime-body{display:grid;gap:9px;padding:0 10px 10px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-detail-runtime-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:9px;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmtask-detail-runtime-track{height:5px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-layer-3);}
      .pmtask-detail-runtime-track span{display:block;height:100%;border-radius:inherit;background:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-detail-runtime-steps{display:grid;gap:4px;margin:0;padding:0;list-style:none;}
      .pmtask-detail-runtime-step{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:6px;align-items:start;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.45;}
      .pmtask-detail-runtime-dot{width:6px;height:6px;margin-top:5px;border-radius:50%;background:var(--dsw-alias-label-tertiary);}
      .pmtask-detail-runtime-step.active .pmtask-detail-runtime-dot{background:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-detail-runtime-step.completed .pmtask-detail-runtime-dot{background:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmtask-detail-runtime-step.failed .pmtask-detail-runtime-dot{background:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-detail-runtime-step small{color:var(--dsw-alias-label-tertiary);font-size:9.5px;white-space:nowrap;}
      .pmtask-detail-runtime-question{display:grid;gap:6px;padding:9px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 34%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 7%,transparent);}
      .pmtask-detail-runtime-question strong{font-size:11px;}
      .pmtask-detail-runtime-question p{margin:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.5;white-space:pre-wrap;}
      .pmtask-detail-runtime-answers{display:flex;gap:5px;flex-wrap:wrap;}
      .pmtask-detail-runtime-answer{padding:3px 7px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;cursor:pointer;}
      .pmtask-detail-runtime-answer:hover{background:var(--dsw-alias-bg-layer-3);}
      .pmtask-detail-runtime-queue-list{display:flex;gap:5px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmtask-detail-side-head{position:relative;z-index:5;flex:none;display:grid;gap:9px;padding:14px 16px 11px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-detail-extension-visible{flex:none;max-height:min(46vh,360px);overflow:auto;padding:12px 16px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);scrollbar-gutter:stable;}
      .pmtask-detail-extension-visible:empty{display:none;}
      .pmtask-detail-side-title{display:flex;align-items:flex-start;gap:8px;}
      .pmtask-detail-side-title h2{min-width:0;flex:1;margin:0;font-size:16px;line-height:1.35;overflow-wrap:anywhere;}
      .pmtask-detail-side-title .pmtask-icon-btn{flex:none;}
      .pmtask-detail-side-desc{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;}
      .pmtask-detail-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
      .pmtask-detail-session-link{flex:none;margin-left:auto;padding:2px 0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10.5px;white-space:nowrap;cursor:pointer;}
      .pmtask-detail-session-link:hover{color:var(--dsw-alias-label-primary);text-decoration:underline;text-underline-offset:3px;}
      .pmtask-detail-action{height:30px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 9px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;font-weight:500;white-space:nowrap;cursor:pointer;}
      .pmtask-detail-action svg{width:12px;height:12px;flex:none;}
      .pmtask-detail-action:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}
      .pmtask-detail-action.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);}
      .pmtask-detail-action.caution{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 42%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-detail-action.danger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 42%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-detail-action.neutral{color:var(--dsw-alias-label-secondary);}
      .pmtask-detail-action:disabled{opacity:.45;cursor:not-allowed;}
      .pmtask-detail-tabs{position:relative;z-index:4;flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-detail-tab{min-width:0;height:38px;padding:0 5px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer;white-space:nowrap;}
      .pmtask-detail-tab:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtask-detail-tab.active{border-bottom-color:var(--dsw-alias-accent-primary,#4f8ef7);color:var(--dsw-alias-label-primary);font-weight:600;}
      .pmtask-detail-tab-body{padding:14px 16px 18px;}
      .pmtask-detail-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .pmtask-detail-info{min-width:0;display:grid;gap:4px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-detail-info.wide{grid-column:1/-1;}
      .pmtask-detail-info>span{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmtask-detail-info>strong,.pmtask-detail-info>div{min-width:0;color:var(--dsw-alias-label-primary);font-size:11.5px;font-weight:500;overflow-wrap:anywhere;}
      .pmtask-detail-info .pmtask-assign-trigger{width:100%;min-height:30px;}
      .pmtask-detail-assignee-group{padding:7px 7px 3px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:650;}
      .pmtask-detail-strategy{display:flex;gap:4px;flex-wrap:wrap;}
      .pmtask-detail-strategy span{padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:9.5px;}
      .pmtask-detail-strategy span.on{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 12%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmtask-detail-basic-toolbar{display:flex;align-items:center;justify-content:flex-end;margin-top:10px;}
      .pmtask-detail-basic-toolbar button{height:25px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;cursor:pointer;}
      .pmtask-detail-basic-toolbar button:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtask-basic-editor{display:grid;gap:10px;padding:12px 16px 18px;}
      .pmtask-basic-editor .pmtask-check span em{display:inline;margin-left:3px;font-size:10px;}
      .pmtask-basic-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .pmtask-basic-edit-wide{grid-column:1/-1;}
      .pmtask-readonly-value{min-height:32px;display:flex;align-items:center;padding:6px 8px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;overflow-wrap:anywhere;}
      .pmtask-basic-edit-actions{display:flex;justify-content:flex-end;gap:6px;padding-top:2px;}
      .pmtask-content-editor{height:100%;min-height:0;overflow:auto;display:grid;align-content:start;gap:10px;padding:14px 16px 18px;}
      .pmtask-detail-doc-list{display:grid;gap:7px;}
      .pmtask-detail-doc{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-detail-doc-main{min-width:0;display:grid;gap:4px;}
      .pmtask-detail-doc-title{display:flex;align-items:center;gap:6px;min-width:0;}
      .pmtask-detail-doc-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;}
      .pmtask-detail-doc-meta{display:flex;align-items:center;gap:5px 8px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.45;}
      .pmtask-detail-doc-ai{padding:1px 4px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);font-size:8.5px;}
      .pmtask-detail-doc-download{width:28px;height:28px;display:grid;place-items:center;padding:0;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtask-detail-doc-download:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmtask-detail-doc-download svg{width:13px;height:13px;}
      .pmtask-detail-side-scroll>.pmtask-side-section{margin:0;padding:14px 16px 18px;border-top:0;}
      .pmtask-detail-side-scroll>.pmtask-detail-legacy-links{display:none;}
      .pmtask-detail-side-scroll>.pmtask-side-section>.pmtask-live-head{padding-bottom:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-detail-side-scroll>.pmtask-side-section>.pmtask-timeline{padding-top:2px;}
      .pmtask-detail-page .pmtask-detail-top .pmtask-assign-select,.pmtask-detail-page .pmtask-detail-top .pmtask-assign-actions{display:none;}
      .pmtask-detail-project-chip{height:22px;display:inline-flex;align-items:center;padding:0 7px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;white-space:nowrap;}
      .pmtask-detail-top-actions{flex:none;display:flex;align-items:center;margin-left:auto;}
      .pmtask-detail-top-actions>.pmda-action.workspace{margin-right:0;}
      .pmtask-detail-sync-list{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:7px 10px 0;color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-detail-sync-list{display:none;}
      .pmtask-detail-sync-chip{display:inline-flex;align-items:center;gap:4px;min-width:0;padding:2px 4px 2px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);}
      .pmtask-detail-sync-chip>span:first-of-type{max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-detail-sync-chip select{height:21px;max-width:66px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:9.5px;}
      .pmtask-detail-sync-chip button{width:16px;height:16px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;}
      .pmtask-detail-sync-chip button:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmtask-detail-page .pmtask-composer-footer .pmtask-compose-hint{max-width:none;}
      .pmtask-detail-page .pmtask-composer-footer .pmtask-btn{max-width:min(240px,52%);overflow:hidden;text-overflow:ellipsis;}
      .pmtask-detail-page .pmtask-composer-input{min-height:64px;height:70px;resize:none;}
      .pmtask-detail-composer-foot{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px 10px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-detail-intent-group{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);}
      .pmtask-detail-intent{height:25px;display:inline-flex;align-items:center;gap:4px;padding:0 7px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer;}
      .pmtask-detail-intent svg{width:11px;height:11px;}
      .pmtask-detail-intent.active{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmtask-detail-intent:disabled{opacity:.35;cursor:not-allowed;}
      .pmtask-detail-intent-group.workflow{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 24%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,var(--dsw-alias-bg-base));}
      .pmtask-detail-intent-group.workflow .pmtask-detail-intent.active{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 13%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-detail-effect{min-width:0;flex:1;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.4;}
      .pmtask-detail-effect.workflow{color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 78%,var(--dsw-alias-label-secondary));}
      .pmtask-detail-composer-actions{display:flex;align-items:center;gap:6px;margin-left:auto;}
      .pmtask-detail-composer-actions .pmtask-btn{height:30px;}
      .pmtask-detail-page .pmtask-detail-main>.pmtask-comments{display:none;}
      .pmtask-composer{position:relative;margin-top:0;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-2);overflow:visible;}
      .pmtask-composer-toolbar{position:relative;display:flex;align-items:center;gap:5px;padding:8px 10px 0;}
      .pmtask-tool-btn{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;cursor:pointer;}
      .pmtask-tool-btn:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmtask-tool-btn svg{width:15px;height:15px;}
      .pmtask-composer-input{width:100%;min-height:92px;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:1.5;padding:10px;resize:vertical;}
      .pmtask-composer-input:focus{outline:none;}
      .pmtask-composer .pmtask-attachments{padding:0 10px 7px;}
      .pmtask-composer-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px 10px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-composer-footer .pmtask-btn{height:32px;padding:0 12px;font-size:12px;}
      .pmtask-composer-footer .pmtask-btn.secondary{height:auto;min-height:24px;padding:2px 7px;font-size:11px;font-weight:400;border-width:1px;}
      .pmtask-composer .pmtask-mention-menu{left:72px;top:auto;bottom:calc(100% + 6px);width:min(320px,calc(100% - 84px));max-height:min(280px,calc(100dvh - 160px));}
      .pmtask-detail-section{margin-top:18px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}
      .pmtask-history-head h3{margin:0 0 8px;font-size:13px;}
      .pmtask-history-head span{color:var(--dsw-alias-label-tertiary);font-size:10.5px;white-space:nowrap;}
      .pmtask-history{display:grid;gap:12px;max-height:240px;overflow-y:auto;padding-right:3px;}
      .pmtask-history-message,.pmtask-history-event{display:grid;grid-template-columns:28px minmax(0,1fr);gap:9px;align-items:start;}
      .pmtask-history-message>*,.pmtask-history-event>*{min-width:0;}
      .pmtask-history-message .pmtask-avatar,.pmtask-history-message .pmtask-ring,.pmtask-history-event .pmtask-event-avatar{width:28px;height:28px;border-radius:50%;}
      .pmtask-history-comment .pmtask-avatar{width:22px;height:22px;border-radius:50%;font-size:9px;}
      .pmtask-reply-list .pmtask-avatar{width:20px;height:20px;border-radius:50%;font-size:9px;}
      .pmtask-avatar.human{background:#2f9e66;color:#fff;}
      .pmtask-avatar.agent{background:#6f53d6;color:#fff;}
      .pmtask-avatar.role{border-radius:5px;background:#37618f;color:#fff;}
      .pmtask-avatar.system{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);}
      .pmtask-event-avatar{width:28px;height:28px;flex:none;display:grid;place-items:center;border-radius:50%;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:10px;}
      .pmtask-event-copy{min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;padding-top:5px;overflow-wrap:anywhere;}
      .pmtask-event-copy time{display:block;color:var(--dsw-alias-label-tertiary);font-size:10px;margin-top:2px;}
      .pmtask-bubble{margin-top:4px;padding:10px 11px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;}
      .pmtask-run-summary{display:grid;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-run-summary-row{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;padding:7px 9px;border-bottom:0.5px solid var(--dsw-alias-border-l2);font-size:11px;line-height:1.5;}
      .pmtask-run-summary-row:last-child{border-bottom:0;}
      .pmtask-run-summary-row span{color:var(--dsw-alias-label-tertiary);}
      .pmtask-run-summary-row strong{min-width:0;color:var(--dsw-alias-label-primary);font-weight:500;overflow-wrap:anywhere;}
      .pmtask-run-summary-empty{padding:12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);font-size:11.5px;text-align:center;}
      .pmtask-run-summary-unavailable{display:grid;gap:6px;padding:12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;}
      .pmtask-run-summary-unavailable strong{color:var(--dsw-alias-label-primary);font-size:11.5px;}
      .pmtask-markdown{display:grid;gap:7px;min-width:0;overflow-wrap:anywhere;}
      .pmtask-md-heading{margin:0;font-weight:700;line-height:1.35;color:var(--dsw-alias-label-primary);}
      .pmtask-md-paragraph{margin:0;white-space:pre-wrap;}
      .pmtask-md-list{margin:0;padding-left:20px;display:grid;gap:4px;}
      .pmtask-md-list li{padding-left:1px;}
      .pmtask-md-code{padding:1px 4px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);font:0.92em/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
      .pmtask-md-pre{margin:0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);overflow-x:auto;}
      .pmtask-md-pre code{font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;}
      .pmtask-md-quote{margin:0;padding-left:9px;border-left:2px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);}
      .pmtask-md-hr{margin:3px 0;border:0;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-md-table-wrap{max-width:100%;overflow-x:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-md-table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;}
      .pmtask-md-table th,.pmtask-md-table td{padding:6px 9px;border-bottom:1px solid var(--dsw-alias-border-l2);border-right:1px solid var(--dsw-alias-border-l2);text-align:left;vertical-align:top;}
      .pmtask-md-table th{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:700;white-space:nowrap;}
      .pmtask-md-table tr:last-child td{border-bottom:0;}
      .pmtask-md-table th:last-child,.pmtask-md-table td:last-child{border-right:0;}
      .pmtask-comment-list{display:grid;gap:8px;margin-top:10px;}
      .pmtask-history-comment{padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-reply-list{display:grid;gap:7px;margin-top:8px;padding-left:10px;border-left:2px solid var(--dsw-alias-border-l2);}
      .pmtask-reply-form,.pmtask-comment-form{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;gap:6px;margin-top:8px;}
      .pmtask-comment-guide{grid-column:1/-1;margin:0 0 1px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;}
      .pmtask-comment-consensus{grid-column:1/-1;align-items:flex-start;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-comment-consensus>span{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;}
      .pmtask-comment-consensus em{display:inline;min-width:0;flex:1 1 140px;margin:0;}
      .pmtask-reply-form .pmtask-input,.pmtask-comment-form .pmtask-input{height:auto;padding:7px 9px;border-width:1px;line-height:1.5;}
      .pmtask-reply-form .pmtask-input{min-height:28px;font-size:11.5px;}
      .pmtask-comment-form{gap:7px;margin-top:9px;}
      .pmtask-comment-form .pmtask-input{font-size:14px;}
      .pmtask-reply-form .pmtask-btn,.pmtask-comment-form .pmtask-btn{height:auto;min-height:24px;padding:2px 7px;font-size:11px;font-weight:400;border-width:1px;}
      .pmtask-timeline{display:grid;gap:10px;}
      .pmtask-timeline-event{display:grid;grid-template-columns:82px minmax(0,1fr);gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtask-timeline-event time{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;}
      .pmtask-side-section .pmtask-link{padding:9px;border-radius:6px;}
      .pmtask-side-section .pmtask-link+.pmtask-link{margin-top:7px;}
      .pmtask-side-section .pmtask-btn{height:auto;min-height:24px;padding:2px 7px;font-size:11px;font-weight:400;border-width:1px;}
      .pmtask-side-empty{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;white-space:pre-wrap;}
      .pmtask-live-head{display:flex;align-items:center;gap:7px;margin-bottom:9px;}
      .pmtask-live-head h3{margin:0;font-size:13px;}
      .pmtask-execution-stop{margin-left:auto;padding:2px 7px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 45%,transparent);border-radius:5px;background:transparent;color:var(--dsw-alias-state-error-primary,#e5534b);font:inherit;font-size:10.5px;white-space:nowrap;cursor:pointer;}
      .pmtask-execution-stop:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 10%,transparent);}
      .pmtask-execution-stop:disabled{opacity:.5;cursor:wait;}
      .pmtask-live-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
      .pmtask-live-output{max-height:320px;overflow:auto;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.55;}
      .pmtask-doc-list{display:grid;gap:6px;max-height:260px;overflow:auto;padding-right:2px;}
      .pmtask-doc{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-doc-info{min-width:0;}
      .pmtask-doc-name{display:flex;align-items:center;gap:5px;max-width:100%;border:0;padding:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:600;text-align:left;cursor:pointer;}
      .pmtask-doc-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-doc-name:hover span{text-decoration:underline;}
      .pmtask-doc-name:disabled{cursor:default;color:var(--dsw-alias-label-secondary);}
      .pmtask-doc-name:disabled:hover span{text-decoration:none;}
      .pmtask-doc-meta{margin-top:3px;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-doc-kind{flex:none;border-radius:4px;padding:1px 5px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 18%,transparent);color:var(--dsw-alias-label-secondary);font-size:9.5px;font-weight:600;}
      .pmtask-doc-empty{padding:12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);font-size:11.5px;text-align:center;}
      .pmtask-execution-record{min-width:0;max-width:100%;overflow:hidden;}
      .pmtask-execution-runs{min-width:0;max-width:100%;display:grid;gap:6px;margin-bottom:8px;}
      .pmtask-execution-runs-label{color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-execution-round-picker{min-width:0;max-width:100%;display:grid;gap:6px;}
      .pmtask-execution-round-trigger{width:100%;max-width:100%;min-width:0;min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;padding:0 9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer;}
      .pmtask-execution-round-trigger:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));}
      .pmtask-execution-round-trigger span:first-child{min-width:0;max-width:100%;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-execution-round-trigger-time{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap;}
      .pmtask-round-caret{width:7px;height:7px;flex:none;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);}
      .pmtask-execution-round-trigger[aria-expanded="true"] .pmtask-round-caret{transform:rotate(225deg) translate(-2px,-2px);}
      .pmtask-execution-round-menu{width:100%;max-width:100%;min-width:0;display:grid;gap:7px;max-height:430px;overflow-x:hidden;overflow-y:auto;padding:2px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-execution-round-option{width:100%;max-width:100%;min-width:0;display:grid;gap:7px;overflow:visible;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;}
      .pmtask-execution-round-option.selected{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,var(--dsw-alias-bg-layer-2));}
      .pmtask-execution-round-option-head{width:100%;max-width:100%;min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;overflow-wrap:anywhere;border:0;padding:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;font-weight:650;line-height:1.45;text-align:left;white-space:normal;cursor:pointer;}
      .pmtask-execution-round-option-head:hover{color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-execution-round-option-title{min-width:0;overflow-wrap:anywhere;}
      .pmtask-execution-round-option-status{white-space:nowrap;}
      .pmtask-execution-round-option-time{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap;}
      .pmtask-round-instruction{width:100%;max-width:100%;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:4px;overflow:hidden;padding:8px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-round-instruction-label{color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:500;}
      .pmtask-round-instruction-text{display:-webkit-box;width:100%;min-width:0;max-width:100%;max-height:none;flex:0 0 auto;overflow:hidden;overflow-wrap:anywhere;word-break:break-word;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;white-space:pre-wrap;-webkit-box-orient:vertical;-webkit-line-clamp:3;}
      .pmtask-round-instruction.expanded .pmtask-round-instruction-text{display:block;overflow:visible;-webkit-line-clamp:unset;}
      .pmtask-round-instruction-toggle{flex:0 0 auto;justify-self:start;border:0;padding:0;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:10px;cursor:pointer;}
      .pmtask-execution-blocks{display:grid;gap:14px;margin-top:12px;}
      .pmtask-execution-block{display:grid;gap:8px;padding-top:13px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-execution-block:first-child{padding-top:0;border-top:0;}
      .pmtask-execution-block h4{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;color:var(--dsw-alias-label-primary);font-size:12px;font-weight:700;}
      .pmtask-execution-block h4 span{min-width:0;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:400;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-plan-list{display:grid;gap:6px;margin:0;padding:0;list-style:none;}
      .pmtask-plan-step{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:start;gap:7px;padding:7px 8px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);font-size:11.5px;line-height:1.45;}
      .pmtask-plan-step-dot{width:8px;height:8px;margin-top:4px;border-radius:50%;background:var(--dsw-alias-label-tertiary);}
      .pmtask-plan-step.active .pmtask-plan-step-dot{background:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-plan-step.completed .pmtask-plan-step-dot{background:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmtask-plan-step.failed .pmtask-plan-step-dot{background:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-plan-step-title{min-width:0;overflow-wrap:anywhere;}
      .pmtask-plan-step-status{color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-size:10.5px;}
      .pmtask-execution-events{display:grid;gap:5px;margin:0;padding:0;list-style:none;}
      .pmtask-execution-event{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:6px 7px;border-left:2px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45;}
      .pmtask-execution-event strong{min-width:0;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);font-weight:500;}
      .pmtask-execution-event time{color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
      .pmtask-gate{display:grid;gap:8px;padding:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 40%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 8%,transparent);}
      .pmtask-gate strong{font-size:12px;}
      .pmtask-gate p{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5;}
      .pmtask-gate-actions{display:flex;gap:7px;flex-wrap:wrap;}
      .pmtask-gate-actions .pmtask-btn{height:30px;padding:0 10px;font-size:11.5px;}
      .pmtask-comment-list>.pmtask-empty,.pmtask-history>.pmtask-empty{padding:36px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:13px;}
      .pmtask-detail-section>.pmtask-empty{padding:28px 10px;}
      .pmtask-mask{position:absolute;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.24);backdrop-filter:blur(2px);}
      .pmtask-modal{width:min(620px,calc(100vw - 40px));max-height:min(720px,calc(100vh - 40px));overflow:auto;display:grid;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 22px 54px rgba(0,0,0,.22);}
      .pmtask-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .pmtask-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
      .pmtask-execution-overrides{grid-column:1 / -1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;padding:10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-execution-runtime{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:34px;padding:0 9px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;overflow-wrap:anywhere;cursor:default;user-select:text;}
      .pmtask-readonly-badge{flex:none;padding:2px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.2;}
      .pmtask-span-2{grid-column:1 / -1;}
      .pmtask-modal.pmtask-confirm{width:min(440px,calc(100vw - 40px));gap:10px;}
      .pmtask-modal.pmtask-confirm h2{margin:0;font-size:15px;font-weight:700;}
      .pmtask-confirm-text{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.65;overflow-wrap:anywhere;}
      .pmtask-reject-note{min-height:112px;resize:vertical;line-height:1.6;}
      .pmtask-confirm-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;}
      .pmtask-confirm-actions .pmtask-btn{height:32px;padding:0 12px;font-size:12px;}
      .pmtask-acceptance-confirm{width:min(520px,calc(100vw - 40px));}
      .pmtask-acceptance-confirm-list{display:grid;gap:6px;max-height:min(46vh,360px);overflow:auto;padding:2px;}
      .pmtask-acceptance-confirm-item{display:flex;align-items:flex-start;gap:8px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.55;cursor:pointer;}
      .pmtask-acceptance-confirm-item.checked{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 35%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 8%,var(--dsw-alias-bg-layer-2));}
      .pmtask-acceptance-confirm-item input{width:15px;height:15px;flex:none;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary);}
      .pmtask-acceptance-confirm-item span{min-width:0;overflow-wrap:anywhere;}
      .pmtask-acceptance-confirm-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
      .pmtask-acceptance-confirm-tools button{padding:0;border:0;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:10.5px;cursor:pointer;}
      .pmtask-btn.danger-solid{background:var(--dsw-alias-state-error-primary,#e5534b);color:#fff;}
      .pmtask-empty{padding:46px 18px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12.5px;}
      @media(max-width:900px){.pmtask-detail-layout{grid-template-columns:1fr}.pmtask-detail-main{border-right:0;border-bottom:0.5px solid var(--dsw-alias-border-l2);}.pmtask-detail-top .pmtask-crumb{flex-basis:100%;order:3}.pmtask-grid-demo{grid-template-columns:repeat(2,minmax(0,1fr));}.pmtask-detail-page .pmtask-detail-layout{height:auto;min-height:0;overflow:visible;}.pmtask-detail-page .pmtask-detail-main{min-height:620px;overflow:visible;}.pmtask-detail-page .pmtask-detail-conversation{max-height:520px;}.pmtask-detail-page .pmtask-detail-side{display:block;overflow:visible;border-top:1px solid var(--dsw-alias-border-l2);}.pmtask-detail-page .pmtask-detail-side-scroll{overflow:visible;}.pmtask-detail-side-head,.pmtask-detail-tabs{position:static;}}
      @media(max-width:700px){.pmtask-head{flex-direction:column}.pmtask-modal-grid,.pmtask-execution-overrides{grid-template-columns:1fr}.pmtask-detail-page .pmtask-detail-layout{display:block}.pmtask-detail-page .pmtask-detail-main{min-height:0;padding:10px}.pmtask-detail-page .pmtask-detail-conversation{max-height:none;overflow:visible}.pmtask-detail-page .pmtask-detail-main>.pmtask-intro{padding:10px}.pmtask-detail-page .pmtask-history-message .pmtask-message-body{max-width:82%}.pmtask-detail-info-grid{grid-template-columns:1fr}.pmtask-detail-info.wide{grid-column:auto}.pmtask-detail-tab{font-size:10px}.pmtask-detail-actions{padding-bottom:2px}.pmtask-detail-runtime-current{display:none}}
      @media(max-width:700px){.pmtask-detail-composer-foot{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}.pmtask-detail-intent-group{grid-column:1;grid-row:1}.pmtask-detail-effect{grid-column:1/-1;grid-row:2;white-space:normal}.pmtask-detail-composer-actions{grid-column:2;grid-row:1;margin-left:0}.pmtask-detail-composer-actions .pmtask-btn{height:28px;padding:0 9px;font-size:11px}}
      @container (max-width:900px){.pmtask-board{grid-template-columns:repeat(4,220px);}}
      @container (max-width:980px){
        .pmtask-detail-page .pmtask-detail-layout{display:block;height:auto;min-height:0;overflow:visible;}
        .pmtask-detail-page .pmtask-detail-main{min-height:620px;overflow:visible;}
        .pmtask-detail-page .pmtask-detail-conversation{max-height:520px;}
        .pmtask-detail-page .pmtask-detail-side{display:block;overflow:visible;border-top:1px solid var(--dsw-alias-border-l2);}
        .pmtask-detail-page .pmtask-detail-side-scroll{overflow:visible;}
        .pmtask-detail-side-head,.pmtask-detail-tabs{position:static;}
      }
      @container (max-width:620px){
        .pmtask-detail-page .pmtask-detail-main{min-height:0;padding:10px;}
        .pmtask-detail-page .pmtask-detail-conversation{max-height:none;overflow:visible;}
        .pmtask-detail-page .pmtask-detail-main>.pmtask-intro{padding:10px;}
        .pmtask-detail-page .pmtask-history-message .pmtask-message-body{max-width:82%;}
        .pmtask-detail-info-grid{grid-template-columns:1fr;}
        .pmtask-detail-info.wide{grid-column:auto;}
        .pmtask-detail-tab{font-size:10px;}
        .pmtask-detail-runtime-current{display:none;}
        .pmtask-detail-composer-foot{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;}
        .pmtask-detail-intent-group{grid-column:1;grid-row:1;}
        .pmtask-detail-effect{grid-column:1/-1;grid-row:2;white-space:normal;}
        .pmtask-detail-composer-actions{grid-column:2;grid-row:1;margin-left:0;}
        .pmtask-detail-composer-actions .pmtask-btn{height:28px;padding:0 9px;font-size:11px;}
      }
    `;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const headers = { ...options.headers };
      const current = token();
      if (current !== null) headers.authorization = `Bearer ${current}`;
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
      const response = await fetch(path, {
        ...options,
        headers,
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(
          body?.error?.message ?? `HTTP ${response.status}`,
        );
        error.code = body?.error?.code;
        error.status = response.status;
        throw error;
      }
      return body;
    }

    function initials(value) {
      return String(value ?? "?")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }

    // 与 AI Teammates 页保持一致的头像：平台=纯蓝环，个人=炫彩环。
    const AVATAR_PRESETS = [
      {
        id: "sky",
        bg: "#d9efff",
        shirt: "#568fd8",
        skin: "#f1c5a3",
        hair: "#244d77",
        accent: "#ffd166",
        hairStyle: "wave",
        glasses: false,
      },
      {
        id: "sunset",
        bg: "#ffe5d8",
        shirt: "#db6d65",
        skin: "#d99a76",
        hair: "#743d2d",
        accent: "#ff8d7a",
        hairStyle: "bun",
        glasses: false,
      },
      {
        id: "forest",
        bg: "#def6e8",
        shirt: "#3f9d73",
        skin: "#e3b08d",
        hair: "#245543",
        accent: "#67d4a1",
        hairStyle: "side",
        glasses: false,
      },
      {
        id: "berry",
        bg: "#f1e2ff",
        shirt: "#7d59c6",
        skin: "#efb38f",
        hair: "#533275",
        accent: "#c06cff",
        hairStyle: "bob",
        glasses: false,
      },
      {
        id: "lemon",
        bg: "#fff3c9",
        shirt: "#d7a62e",
        skin: "#d49974",
        hair: "#414554",
        accent: "#f2cb45",
        hairStyle: "wave",
        glasses: true,
      },
      {
        id: "ocean",
        bg: "#d9f4ff",
        shirt: "#2f84a8",
        skin: "#ce9874",
        hair: "#164f6f",
        accent: "#4fc3e8",
        hairStyle: "bun",
        glasses: true,
      },
    ];

    function avatarHair(preset) {
      const fill = preset.hair;
      if (preset.hairStyle === "bun") {
        return [
          h("circle", { key: "bun", cx: 47, cy: 14, r: 6, fill }),
          h("path", {
            key: "bun-body",
            d: "M16 29c0-12 7-19 16-19 9 0 16 7 16 19-5-3-8-8-9-12-5 7-14 11-23 12Z",
            fill,
          }),
        ];
      }
      if (preset.hairStyle === "side") {
        return [
          h("path", {
            key: "side",
            d: "M17 27c1-11 8-17 17-17 8 0 14 5 15 15-7-1-11-5-14-10-4 6-11 10-18 12Z",
            fill,
          }),
        ];
      }
      if (preset.hairStyle === "bob") {
        return [
          h("path", {
            key: "bob",
            d: "M16 28c0-12 7-18 16-18s16 7 16 18v13h-6V30c-7 1-13-1-19-6-1 5-3 8-7 10Z",
            fill,
          }),
        ];
      }
      return [
        h("path", {
          key: "wave",
          d: "M16 29c0-12 7-19 17-19 10 0 16 7 16 19-4-2-7-6-9-10-5 6-14 9-24 10Z",
          fill,
        }),
      ];
    }

    function avatarArt(value, key) {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        return h("img", {
          key,
          className: "pmtask-avatar-art",
          src: value,
          alt: "",
        });
      }
      const preset =
        AVATAR_PRESETS.find((item) => item.id === value) ?? AVATAR_PRESETS[0];
      const children = [
        h("rect", { key: "bg", width: 64, height: 64, fill: preset.bg }),
        h("circle", {
          key: "a1",
          cx: 52,
          cy: 12,
          r: 10,
          fill: preset.accent,
          opacity: 0.28,
        }),
        h("circle", {
          key: "a2",
          cx: 10,
          cy: 52,
          r: 14,
          fill: preset.accent,
          opacity: 0.18,
        }),
        h("rect", {
          key: "neck",
          x: 28,
          y: 39,
          width: 8,
          height: 11,
          rx: 4,
          fill: preset.skin,
        }),
        h("path", {
          key: "shirt",
          d: "M9 64c2-13 11-20 23-20s21 7 23 20Z",
          fill: preset.shirt,
        }),
        h("circle", { key: "ear-l", cx: 18, cy: 30, r: 4, fill: preset.skin }),
        h("circle", { key: "ear-r", cx: 46, cy: 30, r: 4, fill: preset.skin }),
        h("circle", { key: "face", cx: 32, cy: 29, r: 16, fill: preset.skin }),
        ...avatarHair(preset),
        h("circle", {
          key: "eye-l",
          cx: 25.5,
          cy: 31,
          r: 1.8,
          fill: "#20232a",
        }),
        h("circle", {
          key: "eye-r",
          cx: 38.5,
          cy: 31,
          r: 1.8,
          fill: "#20232a",
        }),
        h("path", {
          key: "mouth",
          d: "M27 38c3 3 7 3 10 0",
          fill: "none",
          stroke: "#9a5c52",
          strokeWidth: 1.8,
          strokeLinecap: "round",
        }),
      ];
      if (preset.glasses) {
        children.push(
          h(
            "g",
            {
              key: "glasses",
              fill: "none",
              stroke: preset.hair,
              strokeWidth: 1.8,
            },
            [
              h("circle", { key: "g1", cx: 25.5, cy: 31, r: 4 }),
              h("circle", { key: "g2", cx: 38.5, cy: 31, r: 4 }),
              h("path", { key: "g3", d: "M29.5 31h5" }),
            ],
          ),
        );
      }
      children.push(
        h("circle", {
          key: "shine",
          cx: 42,
          cy: 24,
          r: 3,
          fill: "#fff",
          opacity: 0.2,
        }),
      );
      return h(
        "svg",
        {
          key,
          className: "pmtask-avatar-art",
          viewBox: "0 0 64 64",
          "aria-hidden": "true",
        },
        children,
      );
    }

    function ReceiverAvatar({ option, kind, name, className }) {
      if (kind === "agent") {
        const source = option?.source === "personal" ? "personal" : "platform";
        return h(
          "span",
          {
            className: `pmtask-ring ${source}${className === undefined ? "" : ` ${className}`}`,
            title: name,
            role: "img",
            "aria-label": name,
          },
          avatarArt(option?.avatar ?? "", "art"),
        );
      }
      return h(
        "span",
        {
          className: `pmtask-avatar ${kind === "role" ? "role" : "human"}${className === undefined ? "" : ` ${className}`}`,
          title: name,
        },
        kind === "role" ? "R" : initials(name),
      );
    }

    function localTime(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString([], {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function statusLabel(status) {
      return STATUS_LABEL[status] ?? status;
    }

    function planVisibilityLabel(value) {
      return (
        {
          structured: "结构化",
          summary: "摘要",
          opaque: "不透明",
        }[value] ??
        value ??
        "未知"
      );
    }

    function gateEnforcementLabel(value) {
      return (
        {
          blocking: "执行前阻断",
          cooperative: "协作式暂停",
          "observe-only": "仅执行后观察",
        }[value] ??
        value ??
        "未知"
      );
    }

    function executionMetaLabel(value) {
      if (typeof value === "boolean") return value ? "是" : "否";
      if (value === null) return "未知";
      const text = typeof value === "string" ? value.trim() : "";
      return text === "" || text === "unknown" ? "未采集" : text;
    }

    function RunExecutionSummary({ execution, state }) {
      if (execution === undefined || execution === null) {
        if (state === "loading" || state === "idle") {
          return h(
            "div",
            {
              className: "pmtask-run-summary-empty",
              role: "status",
            },
            "正在读取运行信息…",
          );
        }
        return h(
          "div",
          {
            className: "pmtask-run-summary-unavailable",
            role: "status",
          },
          h("strong", null, "该轮未记录运行元数据"),
          h(
            "span",
            null,
            "关联的 Agent Run 不存在，或该轮执行早于运行信息采集。任务结果和执行过程仍可查看。",
          ),
        );
      }
      return h(
        "div",
        { className: "pmtask-run-summary", "aria-label": "任务运行信息" },
        ...[
          ["Provider", execution.provider],
          ["模型", execution.model],
          ["推理强度", execution.reasoningEffort],
          ["Runtime", execution.runtime],
          ["版本", execution.runtimeVersion],
          ["认证", execution.authMode],
          ["沙箱", execution.sandbox],
          ["搜索启用", execution.searchEnabled],
          ["网络", execution.networkAccess],
          ["实际搜索", execution.searchUsed],
          ["计划", planVisibilityLabel(execution.planVisibility)],
          ["工具门禁", gateEnforcementLabel(execution.gateEnforcement)],
        ].map(([label, value]) =>
          h(
            "div",
            { className: "pmtask-run-summary-row", key: label },
            h("span", null, label),
            h("strong", null, executionMetaLabel(value)),
          ),
        ),
      );
    }

    function isSettledStatus(status) {
      return status === "done" || status === "cancelled";
    }

    const RUNNING_MESSAGE_STATES = ["queued", "running", "waiting_input"];
    const RUN_STATUS_LABEL = {
      pending: "待执行",
      active: "进行中",
      completed: "已完成",
      failed: "失败",
      queued: "排队中",
      running: "执行中",
      waiting_input: "待补充",
      succeeded: "已完成",
      timeout: "超时",
      cancelled: "已取消",
      interrupted: "已中断",
    };

    function runStatusLabel(status) {
      return RUN_STATUS_LABEL[status] ?? status ?? "未知";
    }

    function runRoleLabel(role) {
      if (role === "owner") return "主执行";
      if (role === "assist") return "协作";
      if (role === "fyi") return "FYI";
      return "参与";
    }

    function taskHasActiveRun(task) {
      return (task?.messages ?? []).some(
        (message) =>
          message?.runId !== undefined &&
          RUNNING_MESSAGE_STATES.includes(message.state),
      );
    }

    function latestAgentRunState(task) {
      return [...(task?.messages ?? [])]
        .reverse()
        .find(
          (message) =>
            message?.kind === "agent" && message?.runId !== undefined,
        )?.state;
    }

    function taskRunIndicator(task) {
      const active = [...(task?.messages ?? [])]
        .reverse()
        .find(
          (message) =>
            message?.runId !== undefined &&
            RUNNING_MESSAGE_STATES.includes(message.state),
        );
      const state = active?.state ?? latestAgentRunState(task);
      if (state === "queued" || state === "running") {
        return { kind: "active", label: "Agent 正在执行" };
      }
      if (state === "waiting_input") {
        return { kind: "waiting", label: "Agent 等待补充信息" };
      }
      if (state === "cancelled") {
        return { kind: "cancelled", label: "Agent 已停止" };
      }
      if (state === "interrupted") {
        return { kind: "interrupted", label: "Agent 执行已中断" };
      }
      if (state === "timeout") {
        return { kind: "failed", label: "Agent 执行超时" };
      }
      if (state === "failed") {
        return { kind: "failed", label: "Agent 执行失败" };
      }
      return undefined;
    }

    function messageRunFeedback(state) {
      if (state === "cancelled") return { kind: "cancelled", label: "已停止执行" };
      if (state === "interrupted") return { kind: "interrupted", label: "执行已中断" };
      if (state === "timeout") return { kind: "failed", label: "执行超时" };
      if (state === "failed") return { kind: "failed", label: "执行失败" };
      return undefined;
    }

    function workflowSourceLabel() {
      return "工作流";
    }

    function workflowReviewLabel(task) {
      if (task?.workflow?.approvalPolicy !== undefined) return "审批动作驱动";
      if (task?.autoApproveReview === true) return "提交后自动通过";
      return task?.workflow?.reviewRequired === false
        ? "无需 Review"
        : "需要人工 Review";
    }

    function isArchived(task) {
      const value = task?.archivedAt;
      return value !== undefined && value !== null && value !== "";
    }

    function readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? "");
          const separator = result.indexOf(",");
          resolve(separator === -1 ? result : result.slice(separator + 1));
        };
        reader.onerror = () =>
          reject(new Error(`读取附件失败：${file.name ?? "未知文件"}`));
        reader.readAsDataURL(file);
      });
    }

    /**
     * 执行身份挂在哪个用户名下。必须写出来：「责任人=我」的口径包含
     * 「指派给我的分身 / 我所在角色」，不显示归属，任务看起来就像别人的。
     */
    function agentOwnerLabel(item) {
      return item?.ownerName && item.ownerAuthUserId !== undefined
        ? `（${item.ownerName}）`
        : "";
    }

    function receiverDisplay(task, directory) {
      if (task.receiverState === "needs_reassignment") {
        const previous = task.previousReceiver?.name;
        return previous ? `需改派（原角色：${previous}）` : "需改派";
      }
      if (task.receiverType === "unassigned") return "待指派";
      if (task.receiverType === "role" && task.status === "todo") {
        return `角色待认领（${task.receiverName ?? task.receiverId ?? "角色"}）`;
      }
      const name = task.receiverName ?? task.receiverId ?? "待指派";
      const receiver =
        task.receiverType === "agent"
          ? directory?.agents.find(
              (item) =>
                item.id === task.receiverId ||
                (item.employeeId !== undefined &&
                  item.employeeId === task.receiverId),
            )
          : undefined;
      return `${name}${agentOwnerLabel(receiver)}`;
    }

    function receiverKindLabel(type) {
      return type === "agent"
        ? "AI伙伴 / 分身"
        : type === "role"
          ? "角色认领"
          : "人员";
    }

    function receiverOptionLabel(item) {
      const name = item?.name ?? "";
      return item?.type === "agent" ? `${name}${agentOwnerLabel(item)}` : name;
    }

    /**
     * 责任人命中口径。
     * scope="any"（默认）：指派给我本人、我的分身（DE / AI Teammate 实例），或我所在角色。
     * scope="self"：只认人类本人，分身和角色都不算。
     */
    function taskBelongsTo(task, currentUser, directory, scope = "any") {
      if (currentUser === null) return false;
      if (task.receiverType === "human") {
        if (task.receiverId === currentUser.id) return true;
      }
      const approverIds = task.workflow?.approverIds ?? [];
      if (approverIds.includes(currentUser.id)) return true;

      if (scope === "self") return false;
      if (task.receiverType === "agent") {
        // 老任务的责任人还是员工身份 id，目录里以 teammate 实例为准，需要按 employeeId 兜底匹配。
        const receiver = directory.agents.find(
          (item) =>
            item.id === task.receiverId ||
            (item.employeeId !== undefined &&
              item.employeeId === task.receiverId),
        );
        return receiver?.ownerAuthUserId === currentUser.id;
      }
      if (task.receiverType === "role") {
        return directory.roles.some(
          (role) =>
            role.id === task.receiverId &&
            (role.assignedUserIds ?? []).includes(currentUser.id),
        );
      }
      return false;
    }

    /**
     * 任务关注按钮由 dsh-collab-workbench 提供：服务端持久化、跨页面同步。
     * 该插件未安装时按钮不渲染，任务页保持原样。
     */
    function TaskFollowButton(props) {
      const [ready, setReady] = react.useState(
        () => typeof window.__pluginmaxFollow?.FollowButton === "function",
      );
      react.useEffect(() => {
        if (ready) return undefined;
        const onReady = () => setReady(true);
        window.addEventListener("pluginmax:follow-ready", onReady);
        return () =>
          window.removeEventListener("pluginmax:follow-ready", onReady);
      }, [ready]);
      const Button = window.__pluginmaxFollow?.FollowButton;
      if (!ready || typeof Button !== "function") return null;
      return h(Button, {
        type: "task",
        id: props.taskId,
        compact: props.compact !== false,
        workspaceId: props.workspaceId,
        workflowInstanceId: props.workflowInstanceId,
      });
    }

    function FilterDropdown({
      value,
      onChange,
      options,
      ariaLabel,
      width = 156,
    }) {
      const [open, setOpen] = react.useState(false);
      const menuRef = react.useRef(null);
      const selected = options.find((option) => option.value === value);

      react.useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
          if (menuRef.current?.contains(event.target)) return;
          setOpen(false);
        };
        const cancel = (event) => {
          if (event.key === "Escape") setOpen(false);
        };
        window.document.addEventListener("pointerdown", close);
        window.document.addEventListener("keydown", cancel);
        return () => {
          window.document.removeEventListener("pointerdown", close);
          window.document.removeEventListener("keydown", cancel);
        };
      }, [open]);

      let lastGroup = "";
      return h(
        "div",
        { className: "pmtask-menu pmtask-filter-menu", ref: menuRef },
        h(
          "button",
          {
            className: "pmtask-assign-trigger pmtask-filter-trigger",
            type: "button",
            style: { width },
            "aria-haspopup": "listbox",
            "aria-expanded": open,
            "aria-label": ariaLabel,
            onClick: () => setOpen(!open),
          },
          h(
            "span",
            { className: "pmtask-assign-trigger-content" },
            selected?.triggerPrefix
              ? h(
                  "span",
                  { className: "pmtask-filter-trigger-prefix" },
                  selected.triggerPrefix,
                )
              : null,
            h(
              "span",
              { className: "pmtask-filter-trigger-copy" },
              selected?.triggerLabel ?? selected?.label ?? "请选择",
            ),
            h(
              "svg",
              {
                className: "pmtask-filter-chevron",
                "aria-hidden": true,
                fill: "none",
                viewBox: "0 0 24 24",
              },
              h("path", {
                d: "m6 9 6 6 6-6",
                stroke: "currentColor",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 1.8,
              }),
            ),
          ),
        ),
        open
          ? h(
              "div",
              { className: "pmtask-menu-list", role: "listbox" },
              ...options.map((option, index) => {
                const group =
                  option.group !== undefined && option.group !== lastGroup
                    ? option.group
                    : "";
                lastGroup = option.group ?? lastGroup;
                return h(Fragment, { key: option.value }, [
                  group !== ""
                    ? h("div", { className: "pmtask-filter-group" }, group)
                    : null,
                  h(
                    "button",
                    {
                      className: "pmtask-filter-option",
                      type: "button",
                      role: "option",
                      "aria-selected": option.value === value,
                      onClick: () => {
                        onChange(option.value);
                        setOpen(false);
                      },
                    },
                    h(
                      "span",
                      { className: "pmtask-filter-option-copy" },
                      h(
                        "span",
                        { className: "pmtask-filter-option-name" },
                        option.label,
                      ),
                      option.description !== undefined
                        ? h(
                            "span",
                            { className: "pmtask-filter-option-meta" },
                            option.description,
                          )
                        : null,
                    ),
                  ),
                ]);
              }),
            )
          : null,
      );
    }

    function filterSymbol({ label, className = "", icon = null }) {
      return h(
        "span",
        { className: `pmtask-filter-symbol ${className}`.trim() },
        icon ?? label,
      );
    }

    function RichText({ text }) {
      const value = String(text ?? "");
      return h(
        Fragment,
        null,
        ...value
          .split(/(@[^\s，。,.!？?]+)/g)
          .filter((part) => part !== "")
          .map((part, index) =>
            part.startsWith("@")
              ? h("span", { className: "pmtask-mention", key: index }, part)
              : part,
          ),
      );
    }

    function renderInlineMarkdown(text) {
      const value = String(text ?? "");
      const nodes = [];
      const pattern =
        /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
      let cursor = 0;
      let match = pattern.exec(value);
      let index = 0;
      while (match !== null) {
        if (match.index > cursor) {
          nodes.push(
            h(RichText, {
              text: value.slice(cursor, match.index),
              key: `text-${index}`,
            }),
          );
        }
        const token = match[0];
        if (token.startsWith("`")) {
          nodes.push(
            h(
              "code",
              { className: "pmtask-md-code", key: `code-${index}` },
              token.slice(1, -1),
            ),
          );
        } else if (token.startsWith("**") || token.startsWith("__")) {
          nodes.push(
            h(
              "strong",
              { key: `strong-${index}` },
              ...renderInlineMarkdown(token.slice(2, -2)),
            ),
          );
        } else if (token.startsWith("~~")) {
          nodes.push(
            h(
              "del",
              { key: `del-${index}` },
              ...renderInlineMarkdown(token.slice(2, -2)),
            ),
          );
        } else if (token.startsWith("[")) {
          const separator = token.lastIndexOf("](");
          const label = token.slice(1, separator);
          const href = token.slice(separator + 2, -1);
          let safeHref = null;
          try {
            const url = new URL(href);
            if (url.protocol === "http:" || url.protocol === "https:")
              safeHref = url.href;
          } catch {
            safeHref = null;
          }
          nodes.push(
            safeHref === null
              ? label
              : h(
                  "a",
                  {
                    href: safeHref,
                    rel: "noopener noreferrer",
                    target: "_blank",
                    key: `link-${index}`,
                  },
                  label,
                ),
          );
        } else {
          nodes.push(
            h(
              "em",
              { key: `em-${index}` },
              ...renderInlineMarkdown(token.slice(1, -1)),
            ),
          );
        }
        cursor = match.index + token.length;
        index += 1;
        match = pattern.exec(value);
      }
      if (cursor < value.length) {
        nodes.push(
          h(RichText, { text: value.slice(cursor), key: `text-${index}` }),
        );
      }
      return nodes;
    }

    function splitTableRow(line) {
      let value = String(line ?? "").trim();
      if (value.startsWith("|")) value = value.slice(1);
      if (value.endsWith("|")) value = value.slice(0, -1);
      return value.split("|").map((cell) => cell.trim());
    }

    function isTableDelimiterRow(line) {
      if (!String(line ?? "").includes("-")) return false;
      const cells = splitTableRow(line);
      return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
    }

    function startsTable(lines, index) {
      return (
        lines[index].includes("|") &&
        index + 1 < lines.length &&
        isTableDelimiterRow(lines[index + 1])
      );
    }

    function MarkdownText({ text }) {
      const lines = String(text ?? "").split(/\r?\n/);
      const blocks = [];
      let index = 0;
      while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === "") {
          index += 1;
          continue;
        }
        if (startsTable(lines, index)) {
          const header = splitTableRow(line);
          const aligns = splitTableRow(lines[index + 1]).map((cell) =>
            cell.startsWith(":") && cell.endsWith(":")
              ? "center"
              : cell.endsWith(":")
                ? "right"
                : cell.startsWith(":")
                  ? "left"
                  : undefined,
          );
          index += 2;
          const rows = [];
          while (
            index < lines.length &&
            lines[index].trim() !== "" &&
            lines[index].includes("|")
          ) {
            rows.push(splitTableRow(lines[index]));
            index += 1;
          }
          const cellStyle = (column) =>
            aligns[column] === undefined
              ? undefined
              : { textAlign: aligns[column] };
          blocks.push(
            h(
              "div",
              {
                className: "pmtask-md-table-wrap",
                key: `table-${blocks.length}`,
              },
              h(
                "table",
                { className: "pmtask-md-table" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    ...header.map((cell, column) =>
                      h(
                        "th",
                        { key: `th-${column}`, style: cellStyle(column) },
                        ...renderInlineMarkdown(cell),
                      ),
                    ),
                  ),
                ),
                rows.length === 0
                  ? null
                  : h(
                      "tbody",
                      null,
                      ...rows.map((row, rowIndex) =>
                        h(
                          "tr",
                          { key: `tr-${rowIndex}` },
                          ...header.map((_, column) =>
                            h(
                              "td",
                              { key: `td-${column}`, style: cellStyle(column) },
                              ...renderInlineMarkdown(row[column] ?? ""),
                            ),
                          ),
                        ),
                      ),
                    ),
              ),
            ),
          );
          continue;
        }
        const fence = line.match(/^```(.*)$/);
        if (fence !== null) {
          const code = [];
          index += 1;
          while (index < lines.length && !/^```\s*$/.test(lines[index])) {
            code.push(lines[index]);
            index += 1;
          }
          index += 1;
          blocks.push(
            h(
              "pre",
              { className: "pmtask-md-pre", key: `pre-${blocks.length}` },
              h("code", null, code.join("\n")),
            ),
          );
          continue;
        }
        if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          blocks.push(
            h("hr", { className: "pmtask-md-hr", key: `hr-${blocks.length}` }),
          );
          index += 1;
          continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
        if (heading !== null) {
          const level = Math.min(6, heading[1].length + 2);
          blocks.push(
            h(
              `h${level}`,
              {
                className: "pmtask-md-heading",
                key: `heading-${blocks.length}`,
              },
              ...renderInlineMarkdown(heading[2]),
            ),
          );
          index += 1;
          continue;
        }
        const quote = line.match(/^>\s?(.*)$/);
        if (quote !== null) {
          const quoteLines = [quote[1]];
          index += 1;
          while (index < lines.length) {
            const next = lines[index].match(/^>\s?(.*)$/);
            if (next === null) break;
            quoteLines.push(next[1]);
            index += 1;
          }
          blocks.push(
            h(
              "blockquote",
              { className: "pmtask-md-quote", key: `quote-${blocks.length}` },
              ...renderInlineMarkdown(quoteLines.join("\n")),
            ),
          );
          continue;
        }
        const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
        if (unordered !== null) {
          const items = [];
          while (index < lines.length) {
            const item = lines[index].match(/^\s*[-*+]\s+(.*)$/);
            if (item === null) break;
            items.push(item[1]);
            index += 1;
          }
          blocks.push(
            h(
              "ul",
              { className: "pmtask-md-list", key: `ul-${blocks.length}` },
              ...items.map((item, itemIndex) =>
                h(
                  "li",
                  { key: `li-${itemIndex}` },
                  ...renderInlineMarkdown(item),
                ),
              ),
            ),
          );
          continue;
        }
        const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (ordered !== null) {
          const items = [];
          while (index < lines.length) {
            const item = lines[index].match(/^\s*\d+[.)]\s+(.*)$/);
            if (item === null) break;
            items.push(item[1]);
            index += 1;
          }
          blocks.push(
            h(
              "ol",
              { className: "pmtask-md-list", key: `ol-${blocks.length}` },
              ...items.map((item, itemIndex) =>
                h(
                  "li",
                  { key: `li-${itemIndex}` },
                  ...renderInlineMarkdown(item),
                ),
              ),
            ),
          );
          continue;
        }
        const paragraph = [line];
        index += 1;
        while (
          index < lines.length &&
          lines[index].trim() !== "" &&
          !/^(#{1,6})\s+/.test(lines[index]) &&
          !/^>\s?/.test(lines[index]) &&
          !/^\s*[-*+]\s+/.test(lines[index]) &&
          !/^\s*\d+[.)]\s+/.test(lines[index]) &&
          !startsTable(lines, index) &&
          !/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index]) &&
          !lines[index].startsWith("```")
        ) {
          paragraph.push(lines[index]);
          index += 1;
        }
        blocks.push(
          h(
            "p",
            { className: "pmtask-md-paragraph", key: `p-${blocks.length}` },
            paragraph.flatMap((item, itemIndex) =>
              itemIndex === 0
                ? renderInlineMarkdown(item)
                : [
                    h("br", { key: `br-${itemIndex}` }),
                    ...renderInlineMarkdown(item),
                  ],
            ),
          ),
        );
      }
      return h("div", { className: "pmtask-markdown" }, ...blocks);
    }

    function ExecutionRoundInstruction({
      instruction,
      expanded,
      onToggle,
      extraClassName = "",
    }) {
      const text = String(instruction ?? "").trim() || "未记录本轮指令";
      return h(
        "div",
        {
          className: `pmtask-round-instruction${expanded ? " expanded" : ""}${extraClassName === "" ? "" : ` ${extraClassName}`}`,
          title: text,
        },
        h("span", { className: "pmtask-round-instruction-label" }, "本轮指令"),
        h("span", { className: "pmtask-round-instruction-text" }, text),
        h(
          "button",
          {
            className: "pmtask-round-instruction-toggle",
            type: "button",
            "aria-expanded": expanded,
            onClick: (event) => {
              event.stopPropagation();
              onToggle();
            },
          },
          expanded ? "收起指令" : "展开完整指令",
        ),
      );
    }

    function MentionMenu({ directory, query, onPick }) {
      const keyword = query.trim().toLowerCase();
      const groups = [
        { key: "humans", label: "人员", items: directory.humans },
        { key: "agents", label: "DE / 分身", items: directory.agents },
        { key: "roles", label: "角色", items: directory.roles },
      ]
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              keyword === "" || item.name.toLowerCase().includes(keyword),
          ),
        }))
        .filter((group) => group.items.length > 0);
      return h(
        "div",
        { className: "pmtask-mention-menu", role: "listbox" },
        ...groups.flatMap((group) => [
          h(
            "div",
            { className: "pmtask-mention-group", key: `${group.key}:label` },
            group.label,
          ),
          ...group.items.map((item) =>
            h(
              "button",
              {
                type: "button",
                className: "pmtask-mention-item",
                key: `${group.key}:${item.id}`,
                onClick: () =>
                  onPick({
                    ...item,
                    type:
                      group.key === "agents"
                        ? "agent"
                        : group.key === "roles"
                          ? "role"
                          : "human",
                  }),
              },
              h("span", null),
              h(
                "span",
                null,
                h("strong", null, item.name),
                h(
                  "small",
                  null,
                  item.ownerName
                    ? `Owner ${item.ownerName}`
                    : item.personaId
                      ? `Persona ${item.personaId}`
                      : "可定向提及",
                ),
              ),
            ),
          ),
        ]),
        groups.length === 0
          ? h("div", { className: "pmtask-mention-empty" }, "没有匹配项。")
          : null,
      );
    }

    function DependencyPicker({
      tasks,
      workspaceId,
      currentTaskId,
      value,
      onChange,
    }) {
      const [query, setQuery] = react.useState("");
      const [open, setOpen] = react.useState(false);
      const selected = (tasks ?? []).find((task) => task.id === value);
      const normalize = (input) =>
        String(input ?? "")
          .toLowerCase()
          .replace(/\s+/g, "");
      const fuzzyMatch = (haystack, needle) => {
        const text = normalize(haystack);
        const target = normalize(needle);
        if (target === "" || text.includes(target)) return true;
        let index = 0;
        for (const character of text) {
          if (character === target[index]) index += 1;
          if (index === target.length) return true;
        }
        return false;
      };
      const candidates = (tasks ?? [])
        .filter(
          (task) =>
            task.workspaceId === workspaceId &&
            task.id !== currentTaskId &&
            task.archivedAt === undefined &&
            task.status !== "cancelled",
        )
        .filter(
          (task) =>
            fuzzyMatch(
              [
                task.title,
                task.id,
                task.receiverName,
                task.receiverId,
                statusLabel(task.status),
              ].join(" "),
              query,
            ),
        )
        .slice(0, 20);
      return h(
        "div",
        { className: "pmtask-dependency-picker" },
        h("span", { className: "pmtask-dependency-label" }, "前置任务"),
        selected === undefined
          ? h("input", {
              className: "pmtask-input",
              value: query,
              placeholder: "搜索任务名称、任务 ID 或负责人",
              "aria-label": "搜索前置任务",
              onFocus: () => setOpen(true),
              onChange: (event) => {
                setQuery(event.target.value);
                setOpen(true);
              },
              onKeyDown: (event) => {
                if (event.key === "Escape") setOpen(false);
              },
            })
          : h(
              "div",
              { className: "pmtask-dependency-selected" },
              h(
                "span",
                null,
                h("strong", null, selected.title),
                h(
                  "small",
                  null,
                  `${selected.id} · ${selected.receiverName ?? "待指派"} · ${statusLabel(selected.status)}`,
                ),
              ),
              h(
                "button",
                {
                  type: "button",
                  "aria-label": "清除前置任务",
                  onClick: () => {
                    onChange("");
                    setQuery("");
                    setOpen(true);
                  },
                },
                "×",
              ),
            ),
        selected === undefined && open
          ? h(
              "div",
              {
                className: "pmtask-dependency-options",
                role: "listbox",
                "aria-label": "前置任务候选",
              },
              ...(candidates.length === 0
                ? [
                    h(
                      "div",
                      { className: "pmtask-dependency-empty" },
                      "没有匹配的任务",
                    ),
                  ]
                : candidates.map((task) =>
                    h(
                      "button",
                      {
                        type: "button",
                        role: "option",
                        className: "pmtask-dependency-option",
                        key: task.id,
                        onClick: () => {
                          onChange(task.id);
                          setQuery("");
                          setOpen(false);
                        },
                      },
                      h("strong", null, task.title),
                      h(
                        "small",
                        null,
                        `${task.id} · ${task.receiverName ?? "待指派"} · ${statusLabel(task.status)}`,
                      ),
                    ),
                  )),
            )
          : null,
      );
    }

    function byId(items, id) {
      return items.find((item) => item.id === id);
    }

    function TaskGlobalPage(props) {
      const route = props.useShellRoute?.((state) => state.route);
      if (route !== "task") return null;
      return h(TaskWorkspace, props);
    }

    function TaskWorkspace(props) {
      const [workspaces, setWorkspaces] = react.useState([]);
      // 全部项目（用于标题解析）；workspaces 只放当前范围可见的下拉项。
      const [allWorkspaces, setAllWorkspaces] = react.useState([]);
      const [workspaceFilter, setWorkspaceFilter] = react.useState("");
      const [tasks, setTasks] = react.useState([]);
      const [externalRuntimes, setExternalRuntimes] = react.useState([]);
      const [reviewableTaskIds, setReviewableTaskIds] = react.useState([]);
      const [directory, setDirectory] = react.useState({
        humans: [],
        agents: [],
        roles: [],
      });
      const [currentUser, setCurrentUser] = react.useState(null);
      const [ownership, setOwnership] = react.useState("all");
      const [search, setSearch] = react.useState("");
      const [searchDraft, setSearchDraft] = react.useState("");
      const [priority, setPriority] = react.useState("");
      const [receiver, setReceiver] = react.useState("me");
      const [source, setSource] = react.useState("");
      const [selectedId, setSelectedId] = react.useState("");
      const [highlightedId, setHighlightedId] = react.useState("");
      const [taskView, setTaskView] = react.useState("board");
      const [archivedOnly, setArchivedOnly] = react.useState(false);
      const [createOpen, setCreateOpen] = react.useState(false);
      const [createStatus, setCreateStatus] = react.useState("todo");
      const [createSeed, setCreateSeed] = react.useState(null);
      const [assignOpen, setAssignOpen] = react.useState(false);
      const [pendingAssignee, setPendingAssignee] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [error, setError] = react.useState("");
      /**
       * 方案 B：项目清单默认只看"已加入"；平台管理员可切到全量视图。
       * 状态来自跨模块共享 store，跳转前后保持同一选择。
       */
      const showAllWorkspaces = react.useSyncExternalStore(
        scopeStore.subscribe,
        scopeStore.getSnapshot,
        scopeStore.getSnapshot,
      );
      const showAllWorkspacesRef = react.useRef(showAllWorkspaces);
      react.useEffect(() => {
        showAllWorkspacesRef.current = showAllWorkspaces;
      }, [showAllWorkspaces]);
      /**
       * 平台全量是管理员的数据范围视图，不应再被默认责任人过滤。
       * 切回默认范围时恢复“我 + 我的分身”，管理员仍可手动选回任意责任人。
       */
      react.useEffect(() => {
        setReceiver(showAllWorkspaces ? "all" : "me");
      }, [showAllWorkspaces]);
      const dragId = react.useRef("");
      const returnRef = react.useRef(null);
      const suppressOpenUntil = react.useRef(0);

      const notify = () => {
        setError("");
      };
      const fail = (cause, _options = {}) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
      };
      // 状态反馈条 3 秒后自动消失，避免过期提示常驻。
      react.useEffect(() => {
        if (error === "") return undefined;
        const timer = window.setTimeout(() => setError(""), 3_000);
        return () => window.clearTimeout(timer);
      }, [error]);

      const load = react.useCallback(
        async (silent = false) => {
          if (token() === null) {
            setError("请先在「账号与权限 → 登录账号」中登录。");
            setLoading(false);
            return;
          }
          try {
            if (!silent) setLoading(true);
            const [meResult, workspaceResult] = await Promise.all([
              request("/api/collab/auth/me"),
              request("/api/collab/team/workspaces"),
            ]);
            const options = workspaceResult.workspaces ?? [];
            const isAdmin = meResult.user?.role === "admin";
            const joinedOptions = options.filter(
              (workspace) => workspace.isMember === true,
            );
            // 项目下拉：默认只看已加入；平台管理员切到全量后列出全部项目。
            const accessibleOptions =
              isAdmin && showAllWorkspacesRef.current === true
                ? options
                : joinedOptions;
            setCurrentUser(meResult.user);
            setWorkspaces(accessibleOptions);
            setAllWorkspaces(options);
            const activeWorkspaceFilter = accessibleOptions.some(
              (workspace) => workspace.id === workspaceFilter,
            )
              ? workspaceFilter
              : "";
            if (activeWorkspaceFilter !== workspaceFilter) {
              setWorkspaceFilter(activeWorkspaceFilter);
            }
            /*
             * 取数范围与下拉范围分开：平台管理员即使停留在「仅看已加入」，也要
             * 把自己在未加入项目里的任务取回来，否则「我负责 / 我派出」的任务会
             * 整页消失；取回后再按 keepInScope 裁剪。普通成员只取已加入项目。
             */
            const fetchOptions = isAdmin ? options : joinedOptions;
            const requested = fetchOptions.filter(
              (workspace) =>
                activeWorkspaceFilter === "" ||
                workspace.id === activeWorkspaceFilter,
            );
            const target = requested.length === 0 ? fetchOptions : requested;
            const [results, runtimeResults] = await Promise.all([
              Promise.all(
                target.map((workspace) =>
                  request(
                    `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(workspace.id)}`,
                  ),
                ),
              ),
              Promise.all(
                target.map((workspace) =>
                  request(
                    `/api/collab/agent/external-runtimes?workspaceId=${encodeURIComponent(workspace.id)}`,
                  ).catch(() => ({ runtimes: [] })),
                ),
              ),
            ]);
            const mergedRuntimes = [];
            for (const result of runtimeResults) {
              const defaultModel = result?.defaultModel;
              const defaultModelName =
                typeof defaultModel?.model === "string"
                  ? defaultModel.model.trim()
                  : "";
              if (
                defaultModelName !== "" &&
                !mergedRuntimes.some(
                  (runtime) => runtime.id === "__builtin__",
                )
              ) {
                mergedRuntimes.push({
                  id: "__builtin__",
                  name: "内置执行",
                  provider:
                    typeof defaultModel?.provider === "string"
                      ? defaultModel.provider
                      : "platform",
                  protocol: "builtin",
                  status: "active",
                  supportedModels: [defaultModelName],
                  defaultModel: defaultModelName,
                  defaultReasoningEffort:
                    typeof defaultModel?.reasoningEffort === "string"
                      ? defaultModel.reasoningEffort
                      : undefined,
                });
              }
              for (const runtime of result.runtimes ?? []) {
                if (
                  !mergedRuntimes.some(
                    (candidate) => candidate.id === runtime.id,
                  )
                ) {
                  mergedRuntimes.push(runtime);
                }
              }
            }
            const mergedDirectory = {
              humans: [],
              agents: [],
              roles: [],
            };
            for (const result of results) {
              for (const key of ["humans", "agents", "roles"]) {
                for (const item of result.directory?.[key] ?? []) {
                  if (
                    !mergedDirectory[key].some(
                      (candidate) => candidate.id === item.id,
                    )
                  ) {
                    mergedDirectory[key].push(item);
                  }
                }
              }
            }
            const joinedIds = new Set(
              joinedOptions.map((workspace) => workspace.id),
            );
            // 默认范围＝已加入项目的全部任务 + 未加入项目里「我负责 / 我派出」的任务。
            const keepInScope = (task) => {
              if (isAdmin !== true) return true;
              if (showAllWorkspacesRef.current === true) return true;
              if (joinedIds.has(task.workspaceId)) return true;
              return (
                taskBelongsTo(task, meResult.user, mergedDirectory) ||
                task.createdBy === meResult.user.id
              );
            };
            const mergedTasks = results
              .flatMap((result) => result.tasks ?? [])
              .filter(keepInScope);
            setTasks(mergedTasks);
            setExternalRuntimes(mergedRuntimes);
            setReviewableTaskIds([
              ...new Set(
                results.flatMap((result) => result.reviewableTaskIds ?? []),
              ),
            ]);
            setDirectory(mergedDirectory);
            setError("");
            if (!silent) setLoading(false);
          } catch (cause) {
            setLoading(false);
            fail(cause, { global: true });
          }
        },
        // 共享范围切换后 load 需要重跑，任务列表才会跟随「仅看已加入 / 平台全量」。
        [workspaceFilter, showAllWorkspaces],
      );
      /** 方案 B：在"只看已加入"与"全量（管理员）"之间切换项目清单。 */
      const setShowAllProjects = (next) => {
        showAllWorkspacesRef.current = next;
        scopeStore.setAll(next);
        setWorkspaceFilter("");
      };

      react.useEffect(() => {
        void load();
      }, [load]);

      react.useEffect(() => {
        const synchronize = () => {
          setWorkspaces([]);
          setAllWorkspaces([]);
          setWorkspaceFilter("");
          setTasks([]);
          setReviewableTaskIds([]);
          setDirectory({ humans: [], agents: [], roles: [] });
          setCurrentUser(null);
          setOwnership("all");
          setReceiver("me");
          setPriority("");
          setSource("");
          setSearch("");
          setSearchDraft("");
          setArchivedOnly(false);
          setSelectedId("");
          setHighlightedId("");
          setCreateOpen(false);
          setAssignOpen(false);
          setPendingAssignee(null);
          setLoading(true);
          setError("");
          void load();
        };
        window.addEventListener("pluginmax:collab-token", synchronize);
        return () =>
          window.removeEventListener("pluginmax:collab-token", synchronize);
      }, [load]);

      react.useEffect(() => {
        const pending = window.__pluginmaxPendingTask;
        if (pending === null || typeof pending !== "object") return;
        window.__pluginmaxPendingTask = null;
        if (typeof pending.taskId !== "string" || pending.taskId === "") return;
        returnRef.current =
          pending.returnRoute === "teammates"
            ? {
                teammateId:
                  typeof pending.returnTeammateId === "string"
                    ? pending.returnTeammateId
                    : "",
                tab:
                  pending.returnTab === "definition" ? "definition" : "runtime",
              }
            : null;
        if (
          typeof pending.workspaceId === "string" &&
          pending.workspaceId !== ""
        ) {
          setWorkspaceFilter(pending.workspaceId);
        }
        setArchivedOnly(false);
        setSelectedId(pending.taskId);
        setHighlightedId(pending.taskId);
      }, []);

      react.useEffect(() => {
        const openCreate = (seed) => {
          if (seed === null || typeof seed !== "object") return;
          const workspaceId =
            typeof seed.workspaceId === "string" ? seed.workspaceId : "";
          if (workspaceId !== "") setWorkspaceFilter(workspaceId);
          setTaskView("board");
          setSelectedId("");
          setHighlightedId("");
          setCreateSeed(seed);
          setCreateStatus(
            typeof seed.status === "string" ? seed.status : "todo",
          );
          setCreateOpen(false);
        };
        const pending = window.__pluginmaxPendingTaskCreate;
        window.__pluginmaxPendingTaskCreate = null;
        if (pending !== null && typeof pending === "object") {
          openCreate(pending);
        }
        const receive = (event) => {
          const detail = event?.detail;
          if (detail === null || typeof detail !== "object") return;
          openCreate(detail);
        };
        window.addEventListener("pluginmax:task-create-open", receive);
        return () =>
          window.removeEventListener("pluginmax:task-create-open", receive);
      }, []);
      react.useEffect(() => {
        if (createSeed === null || loading) return;
        setCreateOpen(true);
      }, [createSeed, loading]);

      const mutate = async (path, body, message, options = {}) => {
        const result = await request(path, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (result.task !== undefined) {
          setReviewableTaskIds((current) =>
            current.includes(result.task.id) ||
            (result.task.createdBy !== currentUser?.id &&
              currentUser?.role !== "admin")
              ? current
              : [...current, result.task.id],
          );
          setTasks((current) => {
            const next = current.filter((task) => task.id !== result.task.id);
            return [result.task, ...next].sort((left, right) =>
              right.updatedAt.localeCompare(left.updatedAt),
            );
          });
        }
        if (options.silent !== true) notify(message);
        return result.task;
      };

      const visibleTasks = tasks.filter((task) => {
        const awaitingMyReview =
          currentUser !== null &&
          task.status === "review" &&
          reviewableTaskIds.includes(task.id);
        const belongsToMe =
          taskBelongsTo(task, currentUser, directory) || awaitingMyReview;
        const assignedToMeOnly =
          taskBelongsTo(task, currentUser, directory, "self") ||
          awaitingMyReview;
        const sentByMe =
          currentUser !== null && task.createdBy === currentUser.id;
        if (archivedOnly !== isArchived(task)) return false;
        if (ownership === "sent" && !sentByMe) return false;
        if (priority !== "" && task.priority !== priority) return false;
        if (receiver === "me" && !belongsToMe) return false;
        // 「我（本人）」：包含直接指派给我的任务，以及等待我验收的任务。
        if (receiver === "me-only" && !assignedToMeOnly) return false;
        if (receiver !== "me" && receiver !== "me-only" && receiver !== "all") {
          const separator = receiver.indexOf(":");
          const receiverType = receiver.slice(0, separator);
          const receiverId = receiver.slice(separator + 1);
          // 选中某个 Agent 时，同时兼容责任人仍是其员工身份 id 的老任务。
          const agentEntry =
            receiverType === "agent"
              ? directory.agents.find((item) => item.id === receiverId)
              : undefined;
          const matchesLegacyId =
            agentEntry?.employeeId !== undefined &&
            task.receiverId === agentEntry.employeeId;
          if (
            task.receiverType !== receiverType ||
            (task.receiverId !== receiverId && !matchesLegacyId)
          ) {
            return false;
          }
        }
        if (source === "workflow" && task.workflow === undefined) return false;
        if (source === "manual" && task.workflow !== undefined) return false;
        if (search.trim() !== "") {
          const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
          const haystack = [
            task.title,
            task.id,
            task.description,
            task.type,
            task.priority,
            receiverDisplay(task, directory),
            statusLabel(task.status),
          ]
            .join(" ")
            .toLowerCase();
          if (!terms.every((term) => haystack.includes(term))) return false;
        }
        return true;
      });

      const selected = byId(tasks, selectedId);
      /**
       * 「我（本人）」以外的部分：我的分身 / 我所在角色承接的任务。
       * Agent 跑完自动提交验收时任务仍挂在我的分身名下，这里必须提示，
       * 否则切到本人口径后验收入口看起来凭空消失了。
       */
      const myAvatarTaskCount = tasks.filter(
        (task) =>
          isArchived(task) === archivedOnly &&
          taskBelongsTo(task, currentUser, directory) &&
          !taskBelongsTo(task, currentUser, directory, "self"),
      ).length;
      const closeDetail = () => {
        setSelectedId("");
        setHighlightedId("");
        setPendingAssignee(null);
        setAssignOpen(false);
        const returnContext = returnRef.current;
        if (returnContext !== null) {
          returnRef.current = null;
          window.__pluginmaxPendingTeammate = returnContext;
          window.dispatchEvent(
            new CustomEvent("pluginmax:navigate", {
              detail: { route: "teammates" },
            }),
          );
        }
      };
      const anyTaskRunning = tasks.some((task) => taskHasActiveRun(task));
      react.useEffect(() => {
        if (!anyTaskRunning) return undefined;
        const timer = window.setInterval(() => void load(true), 2_500);
        return () => window.clearInterval(timer);
      }, [load, anyTaskRunning]);
      react.useEffect(() => {
        const onRouteSelect = (event) => {
          const route = event?.detail?.route;
          if (typeof route === "string" && route !== "task") return;
          setSelectedId("");
          setHighlightedId("");
          setPendingAssignee(null);
          setAssignOpen(false);
          setArchivedOnly(false);
          setTaskView("board");
        };
        window.addEventListener("pluginmax:route-select", onRouteSelect);
        return () =>
          window.removeEventListener("pluginmax:route-select", onRouteSelect);
      }, []);
      react.useEffect(() => {
        const openDrafts = (event) => {
          setTaskView("drafts");
          setSelectedId("");
          setHighlightedId("");
          const workspaceId = event?.detail?.workspaceId;
          if (typeof workspaceId === "string" && workspaceId !== "") {
            setWorkspaceFilter(workspaceId);
          }
        };
        window.addEventListener("pluginmax:task-capture-open", openDrafts);
        return () =>
          window.removeEventListener("pluginmax:task-capture-open", openDrafts);
      }, []);
      react.useEffect(() => {
        const refreshTasks = () => void load(true);
        window.addEventListener("pluginmax:task-capture-refresh", refreshTasks);
        return () =>
          window.removeEventListener(
            "pluginmax:task-capture-refresh",
            refreshTasks,
          );
      }, [load]);
      react.useEffect(() => {
        const workspaceId = workspaceFilter || workspaces[0]?.id || "";
        if (workspaceId !== "") {
          window.__pluginmaxTaskWorkspaceId = workspaceId;
        }
      }, [workspaceFilter, workspaces]);
      react.useEffect(() => {
        if (highlightedId === "" || selectedId !== "") return undefined;
        const frame = window.requestAnimationFrame(() => {
          window.document
            .querySelector(`[data-task-id="${highlightedId}"]`)
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
        const timer = window.setTimeout(() => setHighlightedId(""), 2400);
        return () => {
          window.cancelAnimationFrame(frame);
          window.clearTimeout(timer);
        };
      }, [highlightedId, selectedId]);
      const directoryOptions = [
        ...directory.humans.map((item) => ({ ...item, type: "human" })),
        ...directory.agents.map((item) => ({ ...item, type: "agent" })),
        ...directory.roles.map((item) => ({ ...item, type: "role" })),
      ];
      if (loading) {
        return h(
          "section",
          { className: "pmtask" },
          h("style", null, styles),
          h("div", { className: "pmtask-empty" }, "正在加载任务..."),
        );
      }

      if (taskView === "drafts") {
        return h(
          "section",
          { className: "pmtask", "data-task-management": true },
          h("style", null, styles),
          error !== ""
            ? h(
                "div",
                { className: "pmtask-filter pmtask-notice" },
                h(
                  "span",
                  {
                    style: {
                      color: "var(--dsw-alias-state-error-primary,#e5534b)",
                    },
                  },
                  error,
                ),
              )
            : null,
          props.renderSlot?.("pluginmax.task.draft-inbox", {
            projects: workspaces,
            directory,
            externalRuntimes,
            onBack: () => setTaskView("board"),
            onOpenTask: async (taskId, workspaceId) => {
              setTaskView("board");
              setWorkspaceFilter(workspaceId);
              setSelectedId(taskId);
              setHighlightedId(taskId);
              setOwnership("all");
              setReceiver("all");
              setArchivedOnly(false);
              try {
                const result = await request(
                  `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`,
                );
                setTasks((current) => {
                  const next = current.filter(
                    (task) => task.workspaceId !== workspaceId,
                  );
                  return [...(result.tasks ?? []), ...next];
                });
              } catch (cause) {
                fail(cause);
              }
            },
          }) ?? null,
        );
      }

      return h(
        "section",
        { className: "pmtask", "data-task-management": true },
        h("style", null, styles),
        error !== ""
          ? h(
              "div",
              { className: "pmtask-filter pmtask-notice" },
              h(
                "span",
                {
                  style: {
                    color: "var(--dsw-alias-state-error-primary,#e5534b)",
                  },
                },
                error,
              ),
            )
          : null,
        selectedId !== "" && selected !== undefined
          ? null
          : h(TaskPageHeader, {
              renderActions: props.renderActions,
              renderSlot: props.renderSlot,
              workspaces,
              workspaceFilter,
              setWorkspaceFilter,
              onRefresh: () => load(true),
              onOpenDrafts: () => setTaskView("drafts"),
              onCreate: (status = "todo") => {
                setCreateSeed(null);
                setCreateStatus(status);
                setCreateOpen(true);
              },
              currentUser,
              showAllWorkspaces,
              setShowAllProjects,
            }),
        selectedId !== "" && selected !== undefined
          ? h(TaskDetail, {
              task: selected,
              workspaceTitle:
                (
                  allWorkspaces.find(
                    (workspace) => workspace.id === selected.workspaceId,
                  ) ??
                  workspaces.find(
                    (workspace) => workspace.id === selected.workspaceId,
                  )
                )?.title ?? selected.workspaceId,
              directory,
              tasks,
              externalRuntimes,
              currentUser,
              reviewableTaskIds,
              pendingAssignee,
              setPendingAssignee,
              assignOpen,
              setAssignOpen,
              onBack: closeDetail,
              onRestored: () => {
                setArchivedOnly(false);
                closeDetail();
              },
              mutate,
              notify,
              fail,
              renderSlot: props.renderSlot,
              renderActions: props.renderActions,
            })
          : h(TaskBoard, {
              tasks: visibleTasks,
              currentUser,
              directory,
              myAvatarTaskCount,
              archivedOnly,
              archivedCount: tasks.filter((task) => isArchived(task)).length,
              setArchivedOnly,
              ownership,
              setOwnership,
              searchDraft,
              setSearchDraft,
              applySearch: () => setSearch(searchDraft.trim()),
              priority,
              setPriority,
              receiver,
              setReceiver,
              source,
              setSource,
              directoryOptions,
              onCreate: (status = "todo") => {
                setCreateSeed(null);
                setCreateStatus(status);
                setCreateOpen(true);
              },
              onOpen: (taskId) => {
                if (Date.now() < suppressOpenUntil.current) return;
                setSelectedId(taskId);
                setHighlightedId("");
                setPendingAssignee(null);
              },
              onDrop: async (taskId, status) => {
                try {
                  await mutate(
                    "/api/collab/tasks/status",
                    { taskId, status },
                    `已移动到「${statusLabel(status)}」`,
                    { silent: true },
                  );
                } catch (cause) {
                  fail(cause);
                }
              },
              dragId,
              onDragStart: () => {
                suppressOpenUntil.current = Date.now() + 500;
              },
              highlightedId,
            }),
        createOpen
          ? h(CreateTaskModal, {
              workspaces,
              directory,
              externalRuntimes,
              tasks,
              currentWorkspaceId: workspaceFilter,
              initialStatus: createStatus,
              seed: createSeed,
              onClose: () => {
                setCreateOpen(false);
                setCreateSeed(null);
              },
              onCreated: async (input) => {
                try {
                  const task = await mutate(
                    "/api/collab/tasks/create",
                    input,
                    "任务已派发",
                  );
                  setCreateOpen(false);
                  setCreateSeed(null);
                  setSelectedId("");
                  if (task?.id !== undefined) setHighlightedId(task.id);
                  if (task?.workspaceId !== undefined) {
                    setWorkspaceFilter(task.workspaceId);
                    setOwnership("sent");
                  }
                  // Agent tasks can hand off to the instance owner as soon as
                  // automatic review starts. Keep the creator-scoped task
                  // visible instead of retaining the pre-handoff assignee.
                  setReceiver("all");
                } catch (cause) {
                  fail(cause);
                }
              },
            })
          : null,
      );
    }

    function TaskPageHeader({
      renderActions,
      renderSlot,
      workspaces,
      workspaceFilter,
      setWorkspaceFilter,
      onRefresh,
      onOpenDrafts,
      onCreate,
      currentUser,
      showAllWorkspaces,
      setShowAllProjects,
    }) {
      return h(
        "header",
        { className: "pmtask-head" },
        h("div", null, h("h1", null, "任务")),
        h(
          "div",
          { className: "pmtask-head-actions" },
          currentUser?.role === "admin"
            ? h(
                "div",
                {
                  className: "pmtask-scope-seg",
                  role: "group",
                  "aria-label": "项目范围",
                },
                h(
                  "button",
                  {
                    type: "button",
                    className: `pmtask-token${showAllWorkspaces ? "" : " active"}`,
                    "aria-pressed": !showAllWorkspaces,
                    title: "只看我已加入的项目（默认视图）",
                    onClick: () => {
                      if (showAllWorkspaces) setShowAllProjects(false);
                    },
                  },
                  "仅看已加入",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: `pmtask-token${showAllWorkspaces ? " active" : ""}`,
                    "aria-pressed": showAllWorkspaces,
                    title:
                      "平台管理员全量视图：显示全部项目和任务，可继续手动筛选责任人",
                    onClick: () => {
                      if (!showAllWorkspaces) setShowAllProjects(true);
                    },
                  },
                  "平台全量",
                ),
              )
            : null,
          h(
            "select",
            {
              className: "pmtask-select",
              value: workspaceFilter,
              onChange: (event) => setWorkspaceFilter(event.target.value),
              "aria-label": "按项目筛选任务",
            },
            h("option", { value: "" }, "全部项目"),
            ...workspaces.map((workspace) =>
              h(
                "option",
                { value: workspace.id, key: workspace.id },
                workspace.title,
              ),
            ),
          ),
          renderSlot?.("pluginmax.task.capture-launcher", {
            workspaceIds: workspaces.map((workspace) => workspace.id),
            onOpenDrafts,
          }) ?? null,
          h(
            "button",
            {
              className: "pmtask-iconbtn",
              type: "button",
              "aria-label": "刷新任务列表",
              title: "刷新",
              onClick: onRefresh,
            },
            h(
              "svg",
              {
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 2,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": true,
              },
              h("path", { d: "M21 12a9 9 0 1 1-3-6.7" }),
              h("path", { d: "M21 3v6h-6" }),
            ),
          ),
          h(
            "button",
            {
              className: "pmtask-btn pmtask-create-task",
              type: "button",
              title: "新建任务",
              "aria-label": "新建任务",
              onClick: () => onCreate("todo"),
            },
            "新建任务",
          ),
          renderActions?.() ?? null,
        ),
      );
    }

    function TaskBoard(props) {
      const {
        tasks,
        archivedOnly,
        archivedCount,
        setArchivedOnly,
        ownership,
        setOwnership,
        searchDraft,
        setSearchDraft,
        applySearch,
        priority,
        setPriority,
        receiver,
        setReceiver,
        source,
        setSource,
        directory,
        myAvatarTaskCount,
        directoryOptions,
        currentUser,
        onCreate,
        onOpen,
        onDrop,
        dragId,
        onDragStart,
        highlightedId,
      } = props;
      const currentUserOption = directoryOptions.find(
        (item) => item.type === "human" && item.id === currentUser?.id,
      );
      const senderOptions = [
        {
          value: "all",
          label: "全部",
          description: "查看所有派出方创建的任务",
          triggerPrefix: "派出方：",
          triggerLabel: "全部",
          group: "范围",
        },
      ];
      if (currentUser !== null && currentUserOption !== undefined) {
        senderOptions.push({
          value: "sent",
          label: `我（${currentUser.name}）`,
          description: "只看我派出的任务",
          triggerPrefix: "派出方：",
          triggerLabel: `我（${currentUser.name}）`,
          group: "范围",
        });
      }
      const receiverOptions = [
        {
          value: "all",
          label: "全部",
          description: "查看所有责任人的任务",
          triggerPrefix: "责任人：",
          triggerLabel: "全部",
          group: "范围",
        },
      ];
      if (currentUser !== null) {
        receiverOptions.push({
          value: "me",
          label: "我 + 我的分身",
          description: `指派给 ${currentUser.name}、TA 的分身或 TA 所在角色（默认）`,
          triggerPrefix: "责任人：",
          triggerLabel: "我 + 我的分身",
          group: "常用",
        });
        receiverOptions.push({
          value: "me-only",
          label: "我（本人）",
          description: `只看直接指派给 ${currentUser.name} 本人的任务，不含分身与角色`,
          triggerPrefix: "责任人：",
          triggerLabel: "我（本人）",
          group: "常用",
        });
      }
      for (const item of directoryOptions) {
        receiverOptions.push({
          value: `${item.type}:${item.id}`,
          label: receiverOptionLabel(item),
          description: receiverKindLabel(item.type),
          triggerPrefix: "责任人：",
          triggerLabel: receiverOptionLabel(item),
          group: receiverKindLabel(item.type),
        });
      }
      const priorityOptions = [
        {
          value: "",
          label: "全部",
          description: "不按优先级过滤",
          triggerPrefix: "",
          triggerLabel: "全部优先级",
        },
        ...["P1", "P2", "P3"].map((item) => ({
          value: item,
          label: priorityLabel(item),
          description: item === "P1" ? "最高优先级" : undefined,
          triggerPrefix: "",
          triggerLabel: priorityLabel(item),
        })),
      ];
      return h(
        Fragment,
        null,
        h(
          "div",
          { className: "pmtask-filter", role: "search" },
          h(FilterDropdown, {
            value: ownership,
            onChange: setOwnership,
            options: senderOptions,
            ariaLabel: "按派出方筛选任务",
            width: 203,
          }),
          h(FilterDropdown, {
            value: receiver,
            onChange: setReceiver,
            options: receiverOptions,
            ariaLabel: "按责任人筛选任务",
            width: 203,
          }),
          h(FilterDropdown, {
            value: priority,
            onChange: setPriority,
            options: priorityOptions,
            ariaLabel: "按优先级筛选任务",
            width: 109,
          }),
          h(
            "select",
            {
              className: "pmtask-select",
              value: source,
              onChange: (event) => setSource(event.target.value),
              "aria-label": "按来源筛选任务",
            },
            h("option", { value: "" }, "全部来源"),
            h("option", { value: "workflow" }, "工作流"),
            h("option", { value: "manual" }, "手动"),
          ),
          h(
            "div",
            { className: "pmtask-search" },
            h("input", {
              className: "pmtask-input",
              value: searchDraft,
              onChange: (event) => setSearchDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") applySearch();
              },
              placeholder: "搜索任务标题、ID、描述或责任人",
            }),
            h(
              "button",
              {
                className: "pmtask-btn secondary",
                type: "button",
                onClick: applySearch,
              },
              "搜索",
            ),
          ),
          receiver === "me-only" && myAvatarTaskCount > 0
            ? h(
                "span",
                { className: "pmtask-compose-hint" },
                `另有 ${myAvatarTaskCount} 条由我的分身 / 角色承接，切到「我 + 我的分身」查看`,
              )
            : null,
          h(
            "button",
            {
              className: `pmtask-token${archivedOnly ? " active" : ""}`,
              type: "button",
              title: "在任务看板与归档视图之间切换",
              "aria-pressed": archivedOnly,
              style: { marginLeft: "auto" },
              onClick: () => {
                const next = !archivedOnly;
                setArchivedOnly(next);
                if (next) setOwnership("all");
              },
            },
            archivedOnly ? "返回任务看板" : `已归档 ${archivedCount}`,
          ),
        ),
        h(
          "div",
          { className: "pmtask-board" },
          ...STATUSES.filter((status) => status.key !== "cancelled").map(
            (status) =>
              h(TaskColumn, {
                key: status.key,
                status,
                readOnly: false,
                // 已取消不再单独成列：作为「已完成」里的历史记录展示，卡片上仍有「已取消」标记。
                tasks: tasks.filter((task) =>
                  status.key === "done"
                    ? task.status === "done" || task.status === "cancelled"
                    : task.status === status.key,
                ),
                onOpen,
                onCreate,
                onDrop,
                dragId,
                onDragStart,
                highlightedId,
                directory,
              }),
          ),
        ),
      );
    }

    function TaskRunStateIndicator({ task }) {
      const indicator = taskRunIndicator(task);
      if (indicator === undefined) return null;
      if (indicator.kind === "active") {
        return h("span", {
          className: "pmtask-spinner",
          role: "status",
          title: indicator.label,
          "aria-label": indicator.label,
        });
      }
      return h("span", {
        className: `pmtask-run-state ${indicator.kind}`,
        role: "status",
        title: indicator.label,
        "aria-label": indicator.label,
      });
    }

    function TaskColumn({
      status,
      readOnly,
      tasks,
      onOpen,
      onCreate,
      onDrop,
      dragId,
      onDragStart,
      highlightedId,
      directory,
    }) {
      const [dropReady, setDropReady] = react.useState(false);
      return h(
        "section",
        {
          className: `pmtask-column ${dropReady ? "drop-ready" : ""}`,
          onDragOver: (event) => {
            if (readOnly) return;
            event.preventDefault();
            setDropReady(true);
          },
          onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setDropReady(false);
          },
          onDrop: (event) => {
            event.preventDefault();
            setDropReady(false);
            if (readOnly) return;
            const taskId =
              event.dataTransfer.getData("text/plain") || dragId.current;
            if (taskId !== "") void onDrop(taskId, status.key);
          },
        },
        h(
          "header",
          { className: "pmtask-column-head" },
          h("span", { className: `pmtask-column-dot ${status.key}` }),
          h("strong", null, status.label),
          h("span", { className: "pmtask-column-count" }, String(tasks.length)),
          h(
            "button",
            {
              className: "pmtask-column-add",
              type: "button",
              hidden: readOnly,
              title: readOnly
                ? "已取消状态不接受新建任务"
                : `在${status.label}新建任务`,
              "aria-label": readOnly
                ? "已取消状态不接受新建任务"
                : `在${status.label}新建任务`,
              onClick: () => {
                if (readOnly) return;
                onCreate(status.key);
              },
            },
            "+",
          ),
        ),
        h(
          "div",
          { className: "pmtask-cards" },
          ...tasks.map((task) =>
            h(
              "article",
              {
                key: task.id,
                className: `pmtask-card${taskHasActiveRun(task) ? " running" : ""}${isArchived(task) ? " archived" : ""}${task.id === highlightedId ? " highlighted" : ""}`,
                "data-task-id": task.id,
                "data-workspace-id": task.workspaceId,
                "data-data-agent-exclude": "true",
                draggable:
                  !isArchived(task) &&
                  task.status !== "cancelled" &&
                  task.workflow === undefined,
                tabIndex: 0,
                role: "button",
                onClick: () => onOpen(task.id),
                onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " ")
                    onOpen(task.id);
                },
                onDragStart: (event) => {
                  if (isArchived(task) || task.status === "cancelled") return;
                  dragId.current = task.id;
                  onDragStart();
                  event.dataTransfer.setData("text/plain", task.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.currentTarget.classList.add("dragging");
                },
                onDragEnd: (event) =>
                  event.currentTarget.classList.remove("dragging"),
              },
              h(
                "div",
                { className: "pmtask-card-top" },
                h("span", { className: "pmtask-id" }, task.id),
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 6 } },
                  h(TaskRunStateIndicator, { task }),
                  h(TaskFollowButton, {
                    taskId: task.id,
                    workspaceId: task.workspaceId,
                    workflowInstanceId: task.workflow?.instanceId,
                  }),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtask-detail-btn",
                      title: `查看任务 ${task.id} 详情`,
                      "aria-label": `查看任务 ${task.id} 详情`,
                      onClick: (event) => {
                        event.stopPropagation();
                        onOpen(task.id);
                      },
                    },
                    "详情",
                  ),
                ),
              ),
              h("div", { className: "pmtask-title" }, task.title),
              task.workflow !== undefined
                ? h(
                    "div",
                    { className: "pmtask-workflow-meta" },
                    h(
                      "span",
                      { className: "pmtask-pill workflow" },
                      workflowSourceLabel(task),
                    ),
                    h(
                      "span",
                      { className: "pmtask-workflow-node" },
                      `${task.workflow.nodeName}${task.workflow.nodeAttempt === undefined ? "" : ` · 第 ${task.workflow.nodeAttempt} 轮`}`,
                    ),
                  )
                : null,
              h("div", { className: "pmtask-desc" }, task.description),
              h(
                "div",
                { className: "pmtask-meta" },
                h(
                  "span",
                  {
                    className: `pmtask-pill ${task.priority === "P1" ? "p1" : ""}`,
                  },
                  priorityLabel(task.priority),
                ),
                isArchived(task)
                  ? h("span", { className: "pmtask-pill archived" }, "已归档")
                  : null,
                // 已取消并到「已完成」列后，卡片上仍要能一眼区分出来。
                task.status === "cancelled"
                  ? h("span", { className: "pmtask-pill cancelled" }, "已取消")
                  : null,
                task.receiverState === "needs_reassignment"
                  ? h("span", { className: "pmtask-pill reassign" }, "需改派")
                  : task.receiverType === "unassigned"
                    ? h("span", { className: "pmtask-pill" }, "待指派")
                    : h(
                        "span",
                        { className: "pmtask-assignee" },
                        h(
                          "span",
                          { className: "pmtask-assignee-name" },
                          receiverDisplay(task, directory),
                        ),
                      ),
                h("span", null, task.due ? task.due.slice(5) : "不限"),
              ),
            ),
          ),
          tasks.length === 0
            ? h(
                "div",
                { className: "pmtask-empty", style: { padding: "20px 8px" } },
                "暂无任务",
              )
            : null,
        ),
      );
    }

    function ConfirmDialog({
      title,
      description,
      confirmLabel,
      cancelLabel,
      tone,
      onConfirm,
      onCancel,
    }) {
      react.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [onCancel]);
      return h(
        "div",
        {
          className: "pmtask-mask",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onCancel();
          },
        },
        h(
          "div",
          {
            className: "pmtask-modal pmtask-confirm",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": title,
          },
          h("div", { className: "pmtask-modal-head" }, h("h2", null, title)),
          h("p", { className: "pmtask-confirm-text" }, description),
          h(
            "div",
            { className: "pmtask-confirm-actions" },
            h(
              "button",
              {
                className: "pmtask-btn secondary",
                type: "button",
                onClick: onCancel,
              },
              cancelLabel ?? "取消",
            ),
            h(
              "button",
              {
                className: `pmtask-btn${tone === "danger" ? " danger-solid" : ""}`,
                type: "button",
                onClick: onConfirm,
              },
              confirmLabel ?? "确认",
            ),
          ),
        ),
      );
    }

    function SubmitAcceptanceDialog({
      steps,
      requireAll,
      onConfirm,
      onCancel,
    }) {
      const [checkedIds, setCheckedIds] = react.useState(() =>
        steps.filter((step) => step.done).map((step) => step.id),
      );
      react.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [onCancel]);
      const checked = new Set(checkedIds);
      const canSubmit = requireAll
        ? steps.every((step) => checked.has(step.id))
        : checkedIds.length > 0;
      return h(
        "div",
        {
          className: "pmtask-mask",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onCancel();
          },
        },
        h(
          "form",
          {
            className: "pmtask-modal pmtask-confirm pmtask-acceptance-confirm",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "确认验收标准并提交",
            onSubmit: (event) => {
              event.preventDefault();
              if (canSubmit) onConfirm(checkedIds);
            },
          },
          h(
            "div",
            { className: "pmtask-modal-head" },
            h("h2", null, "确认验收标准并提交"),
          ),
          h(
            "p",
            { className: "pmtask-confirm-text" },
            requireAll
              ? "该任务无需 Review，需要勾选全部验收标准后才能完成。"
              : "请确认本次已完成的验收标准；至少勾选一项后才能提交验收。",
          ),
          h(
            "div",
            { className: "pmtask-acceptance-confirm-list" },
            ...steps.map((step) =>
              h(
                "label",
                {
                  className: `pmtask-acceptance-confirm-item${checked.has(step.id) ? " checked" : ""}`,
                  key: step.id,
                },
                h("input", {
                  type: "checkbox",
                  checked: checked.has(step.id),
                  onChange: (event) =>
                    setCheckedIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, step.id])]
                        : current.filter((id) => id !== step.id),
                    ),
                }),
                h("span", null, step.label),
              ),
            ),
          ),
          h(
            "div",
            { className: "pmtask-acceptance-confirm-tools" },
            h(
              "button",
              {
                type: "button",
                onClick: () =>
                  setCheckedIds(steps.map((step) => step.id)),
              },
              "勾选全部",
            ),
            h(
              "span",
              null,
              `已勾选 ${checkedIds.length} / ${steps.length}`,
            ),
          ),
          h(
            "div",
            { className: "pmtask-confirm-actions" },
            h(
              "button",
              {
                className: "pmtask-btn secondary",
                type: "button",
                onClick: onCancel,
              },
              "取消",
            ),
            h(
              "button",
              {
                className: "pmtask-btn",
                type: "submit",
                disabled: !canSubmit,
              },
              "确认并提交",
            ),
          ),
        ),
      );
    }

    function RejectDialog({ title, onConfirm, onCancel }) {
      const [note, setNote] = react.useState("");
      react.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [onCancel]);
      return h(
        "div",
        {
          className: "pmtask-mask",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onCancel();
          },
        },
        h(
          "form",
          {
            className: "pmtask-modal pmtask-confirm",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": title,
            onSubmit: (event) => {
              event.preventDefault();
              const value = note.trim();
              if (value !== "") onConfirm(value);
            },
          },
          h("div", { className: "pmtask-modal-head" }, h("h2", null, title)),
          h(
            "p",
            { className: "pmtask-confirm-text" },
            "请填写退回原因和需要补充的内容。说明为必填项，提交后会保留在任务执行历史中。",
          ),
          h("textarea", {
            className: "pmtask-area pmtask-reject-note",
            value: note,
            required: true,
            autoFocus: true,
            maxLength: 8000,
            placeholder: "例如：缺少风险项，请补充风险及应对措施",
            "aria-label": "退回说明",
            onChange: (event) => setNote(event.target.value),
          }),
          h(
            "div",
            { className: "pmtask-confirm-actions" },
            h(
              "button",
              {
                className: "pmtask-btn secondary",
                type: "button",
                onClick: onCancel,
              },
              "取消",
            ),
            h(
              "button",
              {
                className: "pmtask-btn danger-solid",
                type: "submit",
                disabled: note.trim() === "",
              },
              "确认退回",
            ),
          ),
        ),
      );
    }

    function DetailActionButton({
      label,
      tone = "neutral",
      onClick,
      disabled = false,
      title,
    }) {
      return h(
        "button",
        {
          className: `pmtask-detail-action ${tone}`,
          type: "button",
          disabled,
          title: title ?? label,
          "aria-label": title ?? label,
          onClick,
        },
        h("span", null, label),
      );
    }

    function TaskContentEditForm({ task, onCancel, onSave }) {
      const [title, setTitle] = react.useState(task.title);
      const [description, setDescription] = react.useState(task.description);
      const [saving, setSaving] = react.useState(false);
      return h(
        "form",
        {
          className: "pmtask-content-editor",
          onSubmit: async (event) => {
            event.preventDefault();
            if (title.trim() === "" || description.trim() === "") return;
            setSaving(true);
            try {
              await onSave({
                title: title.trim(),
                description: description.trim(),
                priority: task.priority,
                acceptance: task.acceptance,
                due: task.due,
                autoSubmitReview: task.autoSubmitReview,
                executionPolicy: task.executionPolicy,
              });
            } catch {
              // 调用方负责展示保存错误；这里只恢复按钮状态。
            } finally {
              setSaving(false);
            }
          },
        },
        h(
          "label",
          { className: "pmtask-field" },
          "标题",
          h("input", {
            className: "pmtask-input",
            value: title,
            required: true,
            onChange: (event) => setTitle(event.target.value),
          }),
        ),
        h(
          "label",
          { className: "pmtask-field" },
          "描述",
          h("textarea", {
            className: "pmtask-area",
            rows: 8,
            value: description,
            required: true,
            onChange: (event) => setDescription(event.target.value),
          }),
        ),
        h(
          "div",
          { className: "pmtask-compose-actions" },
          h(
            "button",
            {
              className: "pmtask-btn secondary",
              type: "button",
              disabled: saving,
              onClick: onCancel,
            },
            "取消",
          ),
          h(
            "button",
            { className: "pmtask-btn", type: "submit", disabled: saving },
            saving ? "保存中…" : "保存",
          ),
        ),
      );
    }

    function reasoningEffortLabel(value) {
      const text = String(value ?? "").trim();
      if (text === "") return "";
      return (
        REASONING_EFFORT_OPTIONS.find((option) => option.value === text)
          ?.label ?? text
      );
    }

    function runtimeMetadataValue(value) {
      const text = String(value ?? "").trim();
      return text === "" || text === "unknown" ? "" : text;
    }

    function runtimeForAgent(agent, runtimeId, runtimes, runtimeName = "") {
      const matched = (runtimes ?? []).find(
        (candidate) =>
          candidate.id === runtimeId ||
          (runtimeName !== "" && candidate.name === runtimeName),
      );
      if (matched !== undefined) return matched;
      return agent?.execution === "external"
        ? undefined
        : (runtimes ?? []).find((candidate) => candidate.id === "__builtin__");
    }

    function taskRuntimeView(
      task,
      directory,
      externalRuntimes,
      selectedExecution,
      executionDetailState,
    ) {
      const policy = executionPolicyForm(task);
      const responsibleAgent =
        task.receiverType === "agent"
          ? (directory?.agents ?? []).find(
              (agent) => agent.id === task.receiverId,
            )
          : undefined;
      const executionRuntime = runtimeMetadataValue(selectedExecution?.runtime);
      const executionModel = runtimeMetadataValue(selectedExecution?.model);
      const executionReasoning = runtimeMetadataValue(
        selectedExecution?.reasoningEffort,
      );
      const runtimeId =
        policy.runtimeId !== ""
          ? policy.runtimeId
          : responsibleAgent?.execution === "external"
            ? (responsibleAgent.externalRuntimeId ?? "")
            : "";
      const runtime = runtimeForAgent(
        responsibleAgent,
        runtimeId,
        externalRuntimes,
        executionRuntime,
      );
      const runtimeLabel =
        executionRuntime !== ""
          ? executionRuntime
          : (runtime?.name ??
            (runtimeId !== ""
              ? runtimeId
              : responsibleAgent === undefined
                ? executionDetailState === "loading"
                  ? "加载中"
                  : "未采集"
                : responsibleAgent.execution === "external"
                  ? (responsibleAgent.externalRuntimeId ??
                    "外部 Runtime 未绑定")
                  : "内置执行"));
      const modelValue = executionModel !== "" ? executionModel : policy.model;
      const modelIsDefault =
        modelValue !== "" &&
        (policy.model === "" ||
          (runtime?.defaultModel !== undefined &&
            modelValue === runtime.defaultModel));
      const model =
        modelValue !== ""
          ? `${modelValue}${modelIsDefault ? "（默认）" : ""}`
          : runtime?.defaultModel
            ? `${runtime.defaultModel}（默认）`
            : executionDetailState === "loading"
              ? "加载中"
              : "未采集";
      const reasoningValue =
        executionReasoning !== "" ? executionReasoning : policy.reasoningEffort;
      const reasoning =
        reasoningValue !== ""
          ? `${reasoningEffortLabel(reasoningValue)}${
              policy.reasoningEffort === "" ? "（默认）" : ""
            }`
          : executionDetailState === "loading"
            ? "加载中"
            : "未采集";
      const modelParts = [model, reasoning].filter(
        (value) => value !== "未采集" && value !== "加载中",
      );
      const modelAndReasoning =
        modelParts.length > 0
          ? modelParts.join(" · ")
          : model === "加载中" || reasoning === "加载中"
            ? "加载中"
            : "未采集";
      return { runtimeLabel, model, reasoning, modelAndReasoning };
    }

    function ExecutionRuntimeFields({
      runtimeLabel,
      runtimeUnavailable,
      model,
      modelOptions,
      defaultModelLabel,
      modelPlaceholder,
      reasoningEffort,
      defaultReasoningLabel,
      onModelChange,
      onReasoningChange,
    }) {
      const supportedModels = (modelOptions ?? []).filter(
        (option) => String(option ?? "").trim() !== "",
      );
      const choices = [
        ...new Set([
          ...supportedModels,
          ...(String(model ?? "").trim() === "" ? [] : [model]),
        ]),
      ];
      return h(
        "div",
        { className: "pmtask-execution-overrides" },
        h(
          "div",
          { className: "pmtask-field" },
          "执行运行时",
          h(
            "div",
            {
              className: "pmtask-execution-runtime",
              role: "textbox",
              "aria-readonly": "true",
            },
            h("span", null, runtimeLabel),
            h("span", { className: "pmtask-readonly-badge" }, "只读"),
          ),
        ),
        h(
          "label",
          { className: "pmtask-field" },
          "本轮模型",
          supportedModels.length > 0
            ? h(
                "select",
                {
                  className: "pmtask-select",
                  value: model,
                  disabled: runtimeUnavailable,
                  "aria-label": "本轮模型",
                  onChange: (event) => onModelChange(event.target.value),
                },
                h(
                  "option",
                  { value: "" },
                  defaultModelLabel === undefined
                    ? "沿用 Runtime 默认模型"
                    : `${defaultModelLabel}（默认）`,
                ),
                ...choices
                  .filter((option) => option !== defaultModelLabel)
                  .map((option) =>
                    h("option", { value: option, key: option }, option),
                  ),
              )
            : h("input", {
                className: "pmtask-input",
                type: "text",
                value: model,
                placeholder: modelPlaceholder,
                "aria-label": "本轮模型",
                maxLength: 160,
                disabled: runtimeUnavailable,
                onChange: (event) => onModelChange(event.target.value),
              }),
        ),
        h(
          "label",
          { className: "pmtask-field" },
          "推理强度",
          h(
            "select",
            {
              className: "pmtask-select",
              value: reasoningEffort,
              disabled: runtimeUnavailable,
              "aria-label": "推理强度",
              onChange: (event) => onReasoningChange(event.target.value),
            },
            h("option", { value: "" }, defaultReasoningLabel),
            ...REASONING_EFFORT_OPTIONS.map((option) =>
              h(
                "option",
                { value: option.value, key: option.value },
                option.label,
              ),
            ),
          ),
        ),
      );
    }

    function BasicInfoEditForm({
      task,
      workspaceTitle,
      directory,
      tasks,
      externalRuntimes,
      selectedExecution,
      executionDetailState,
      onCancel,
      onSave,
    }) {
      const initialPolicy = executionPolicyForm(task);
      const initialPolicyModel = runtimeMetadataValue(initialPolicy.model);
      const initialPolicyReasoning = runtimeMetadataValue(
        initialPolicy.reasoningEffort,
      );
      const initialAgent =
        task.receiverType === "agent"
          ? (directory?.agents ?? []).find(
              (agent) => agent.id === task.receiverId,
            )
          : undefined;
      const initialRuntimeId =
        initialPolicy.runtimeId !== ""
          ? initialPolicy.runtimeId
          : initialAgent?.execution === "external"
            ? (initialAgent.externalRuntimeId ?? "")
            : "";
      const initialReceiverValue =
        task.receiverType === "unassigned"
          ? "unassigned:"
          : `${task.receiverType}:${task.receiverId ?? ""}`;
      const [receiverValue, setReceiverValue] =
        react.useState(initialReceiverValue);
      const [form, setForm] = react.useState({
        priority: task.priority,
        due: task.due ?? "",
        dependsOn: task.dependsOn?.[0] ?? "",
        autoSubmitReview: task.autoSubmitReview !== false,
        autoApproveReview: task.autoApproveReview === true,
        ...initialPolicy,
        runtimeId: initialRuntimeId,
        model: initialPolicyModel,
        reasoningEffort: initialPolicyReasoning,
      });
      const [saving, setSaving] = react.useState(false);
      const separator = receiverValue.indexOf(":");
      const receiverType = receiverValue.slice(0, separator);
      const receiverId = receiverValue.slice(separator + 1);
      const receiverItem =
        receiverType === "human"
          ? directory.humans.find((item) => item.id === receiverId)
          : receiverType === "agent"
            ? directory.agents.find((item) => item.id === receiverId)
            : receiverType === "role"
              ? directory.roles.find((item) => item.id === receiverId)
              : undefined;
      const executionRuntime = runtimeMetadataValue(selectedExecution?.runtime);
      const executionModel = runtimeMetadataValue(selectedExecution?.model);
      const executionReasoning = runtimeMetadataValue(
        selectedExecution?.reasoningEffort,
      );
      const selectedRuntime = runtimeForAgent(
        receiverItem,
        form.runtimeId,
        externalRuntimes,
        executionRuntime,
      );
      const runtimeLabel =
        executionRuntime !== ""
          ? executionRuntime
          : (selectedRuntime?.name ??
            (form.runtimeId !== ""
              ? form.runtimeId
              : receiverType === "agent"
                ? receiverItem?.execution === "external"
                  ? (receiverItem.externalRuntimeId ?? "外部 Runtime 未绑定")
                  : "内置执行"
                : executionDetailState === "loading"
                  ? "加载中"
                  : "未采集"));
      const defaultModelLabel =
        initialPolicyModel === ""
          ? (selectedRuntime?.defaultModel ??
            (executionModel === "" ? undefined : executionModel))
          : selectedRuntime?.defaultModel;
      const defaultReasoningLabel =
        executionReasoning === ""
          ? selectedRuntime === undefined
            ? "沿用平台默认值"
            : "沿用 Runtime 默认值"
          : `${reasoningEffortLabel(executionReasoning)}（默认）`;
      const externalRuntimeUnavailable =
        receiverType === "agent" &&
        receiverItem?.execution === "external" &&
        selectedRuntime?.status !== "active";
      const chooseReceiver = (value) => {
        const nextSeparator = value.indexOf(":");
        const nextType = value.slice(0, nextSeparator);
        const nextId = value.slice(nextSeparator + 1);
        const nextAgent =
          nextType === "agent"
            ? directory.agents.find((item) => item.id === nextId)
            : undefined;
        setReceiverValue(value);
        setForm((current) => ({
          ...current,
          runtimeId:
            nextAgent?.execution === "external"
              ? (nextAgent.externalRuntimeId ?? "")
              : "",
          model: "",
          reasoningEffort: "",
        }));
      };
      const autoApproveEditable =
        task.workflow !== undefined &&
        task.workflow.approvalPolicy === undefined;
      return h(
        "form",
        {
          className: "pmtask-basic-editor",
          onSubmit: async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              await onSave({
                receiverType,
                receiverId: receiverType === "unassigned" ? "" : receiverId,
                receiverName:
                  receiverType === "unassigned"
                    ? "待指派"
                    : (receiverItem?.name ?? receiverId),
                priority: form.priority,
                due: form.due || undefined,
                dependsOn:
                  form.dependsOn === "" ? [] : [form.dependsOn],
                autoSubmitReview: form.autoSubmitReview,
                autoApproveReview: form.autoApproveReview,
                ...(receiverType === "agent"
                  ? { executionPolicy: buildExecutionPolicy(form) }
                  : {}),
              });
            } catch {
              // 调用方负责展示保存错误；这里只恢复按钮状态。
            } finally {
              setSaving(false);
            }
          },
        },
        h(
          "div",
          { className: "pmtask-basic-edit-grid" },
          h(
            "label",
            { className: "pmtask-field" },
            "负责人",
            h(
              "select",
              {
                className: "pmtask-select",
                value: receiverValue,
                onChange: (event) => chooseReceiver(event.target.value),
              },
              h("option", { value: "unassigned:" }, "待指派"),
              directory.humans.length > 0
                ? h(
                    "optgroup",
                    { label: "人员" },
                    ...directory.humans.map((item) =>
                      h(
                        "option",
                        {
                          value: `human:${item.id}`,
                          key: `human:${item.id}`,
                        },
                        item.name,
                      ),
                    ),
                  )
                : null,
              directory.agents.length > 0
                ? h(
                    "optgroup",
                    { label: "AI伙伴" },
                    ...directory.agents.map((item) =>
                      h(
                        "option",
                        {
                          value: `agent:${item.id}`,
                          key: `agent:${item.id}`,
                        },
                        receiverOptionLabel({ ...item, type: "agent" }),
                      ),
                    ),
                  )
                : null,
              directory.roles.length > 0
                ? h(
                    "optgroup",
                    { label: "角色" },
                    ...directory.roles.map((item) =>
                      h(
                        "option",
                        {
                          value: `role:${item.id}`,
                          key: `role:${item.id}`,
                        },
                        item.name,
                      ),
                    ),
                  )
                : null,
            ),
          ),
          h(
            "label",
            { className: "pmtask-field" },
            "优先级",
            h(
              "select",
              {
                className: "pmtask-select",
                value: form.priority,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  })),
              },
              h("option", { value: "P1" }, "P0"),
              h("option", { value: "P2" }, "P1"),
              h("option", { value: "P3" }, "P2"),
            ),
          ),
          h(
            "div",
            { className: "pmtask-field pmtask-basic-edit-wide" },
            h(DependencyPicker, {
              tasks,
              workspaceId: task.workspaceId,
              currentTaskId: task.id,
              value: form.dependsOn,
              onChange: (dependsOn) =>
                setForm((current) => ({ ...current, dependsOn })),
            }),
          ),
          receiverType === "agent"
            ? h(ExecutionRuntimeFields, {
                runtimeLabel,
                runtimeUnavailable: externalRuntimeUnavailable,
                model: form.model,
                modelOptions: selectedRuntime?.supportedModels ?? [],
                defaultModelLabel:
                  selectedRuntime?.defaultModel ?? defaultModelLabel,
                modelPlaceholder:
                  selectedRuntime === undefined
                    ? "沿用平台默认模型"
                    : "沿用 Runtime 默认模型",
                reasoningEffort: form.reasoningEffort,
                defaultReasoningLabel,
                onModelChange: (model) =>
                  setForm((current) => ({ ...current, model })),
                onReasoningChange: (reasoningEffort) =>
                  setForm((current) => ({ ...current, reasoningEffort })),
              })
            : null,
          h(
            "div",
            { className: "pmtask-field" },
            "归属项目",
            h(
              "div",
              { className: "pmtask-readonly-value" },
              `${workspaceTitle || task.workspaceId}（不可变更）`,
            ),
          ),
          h(
            "div",
            { className: "pmtask-field" },
            "任务类型",
            h("div", { className: "pmtask-readonly-value" }, task.type),
          ),
          h(
            "label",
            { className: "pmtask-field" },
            "截止时间",
            h("input", {
              className: "pmtask-input",
              type: "date",
              value: form.due,
              onChange: (event) =>
                setForm((current) => ({
                  ...current,
                  due: event.target.value,
                })),
            }),
          ),
          h(
            "div",
            { className: "pmtask-field" },
            "创建人",
            h(
              "div",
              { className: "pmtask-readonly-value" },
              task.createdByName,
            ),
          ),
          h(
            "div",
            { className: "pmtask-field pmtask-basic-edit-wide" },
            "Review 设置",
            h(
              "label",
              { className: "pmtask-check" },
              h("input", {
                type: "checkbox",
                checked: form.autoSubmitReview,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    autoSubmitReview: event.target.checked,
                  })),
              }),
              h("span", null, "完成后自动提交 Review"),
            ),
            h(
              "label",
              { className: "pmtask-check" },
              h("input", {
                type: "checkbox",
                checked: form.autoApproveReview,
                disabled: !autoApproveEditable,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    autoApproveReview: event.target.checked,
                  })),
              }),
              h(
                "span",
                null,
                "Review 自动通过",
                h(
                  "em",
                  null,
                  autoApproveEditable
                    ? "（提交后自动通过 Review）"
                    : "（仅普通工作流执行任务可配置；审批任务须人工结论）",
                ),
              ),
            ),
          ),
          receiverType === "agent"
            ? h(
                "div",
                { className: "pmtask-field pmtask-basic-edit-wide" },
                "执行策略",
            h(
              "label",
              { className: "pmtask-check" },
              h("input", {
                type: "checkbox",
                checked: form.allowPublicWeb,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    allowPublicWeb: event.target.checked,
                  })),
              }),
              h("span", null, "允许公开网页与监管文件"),
            ),
            h(
              "label",
              { className: "pmtask-check" },
              h("input", {
                type: "checkbox",
                checked: form.requireToolApproval,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    requireToolApproval: event.target.checked,
                  })),
              }),
              h("span", null, "写文件、执行命令和外部发布前需要人工确认"),
            ),
            h(
              "label",
              { className: "pmtask-check" },
              h("input", {
                type: "checkbox",
                checked: form.requireToolEvents,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    requireToolEvents: event.target.checked,
                  })),
              }),
              h("span", null, "要求记录实际工具调用事件"),
            ),
            )
            : null,
        ),
        h(
          "div",
          { className: "pmtask-basic-edit-actions" },
          h(
            "button",
            {
              className: "pmtask-btn secondary",
              type: "button",
              disabled: saving,
              onClick: onCancel,
            },
            "取消",
          ),
          h(
            "button",
            {
              className: "pmtask-btn",
              type: "submit",
              disabled:
                saving ||
                (receiverType !== "unassigned" && receiverId === "") ||
                externalRuntimeUnavailable,
            },
            saving ? "保存中…" : "保存",
          ),
        ),
      );
    }

    function TaskDetailRuntimeDock({
      run,
      plan,
      status,
      question,
      onQuickAnswer,
      queueState,
      queueSeq,
      autoRunEligible,
      dependsOn,
    }) {
      const [open, setOpen] = react.useState(true);
      if (run === undefined && question === null) return null;
      const steps = plan?.steps ?? [];
      const completed = steps.filter(
        (step) => step.status === "completed",
      ).length;
      const current =
        steps.find((step) => step.status === "active") ??
        steps.find((step) => step.status === "pending") ??
        steps.at(-1);
      const percent = steps.length
        ? Math.round((completed / steps.length) * 100)
        : 0;
      const queueLabel =
        {
          idle: "队列空闲",
          blocked: "队列阻塞",
          paused: "队列暂停",
        }[queueState ?? "idle"] ?? "队列空闲";
      return h(
        "section",
        { className: "pmtask-detail-runtime", "aria-label": "当前 Runtime" },
        h(
          "button",
          {
            className: "pmtask-detail-runtime-trigger",
            type: "button",
            "aria-expanded": open,
            onClick: () => setOpen((value) => !value),
          },
          h("span", {
            className: `pmtask-detail-runtime-live${run === undefined ? " idle" : ""}`,
          }),
          h(
            "span",
            { className: "pmtask-detail-runtime-copy" },
            h("strong", null, run?.participantName ?? "Runtime"),
            h(
              "small",
              null,
              run
                ? `Run ${run.roundNumber ?? 1} · ${runStatusLabel(status)}`
                : "等待补充信息",
            ),
          ),
          h(
            "span",
            { className: "pmtask-detail-runtime-current" },
            current?.title ?? question ?? "暂无进行中的步骤",
          ),
          h(
            "span",
            { className: "pmtask-detail-runtime-count" },
            steps.length ? `${completed}/${steps.length}` : "",
          ),
          h("span", { className: "pmtask-detail-runtime-queue" }, queueLabel),
          h("span", {
            className: "pmtask-detail-runtime-caret",
            "aria-hidden": "true",
          }),
        ),
        open
          ? h(
              "div",
              { className: "pmtask-detail-runtime-body" },
              h(
                "div",
                { className: "pmtask-detail-runtime-head" },
                h("strong", null, "执行计划"),
                h(
                  "span",
                  null,
                  steps.length
                    ? `${percent}% · ${runStatusLabel(status)}`
                    : runStatusLabel(status),
                ),
              ),
              steps.length
                ? h(
                    "div",
                    { className: "pmtask-detail-runtime-track" },
                    h("span", { style: { width: `${percent}%` } }),
                  )
                : null,
              steps.length
                ? h(
                    "ol",
                    { className: "pmtask-detail-runtime-steps" },
                    ...steps.map((step) =>
                      h(
                        "li",
                        {
                          className: `pmtask-detail-runtime-step ${step.status}`,
                          key: step.id,
                        },
                        h("span", {
                          className: "pmtask-detail-runtime-dot",
                          "aria-hidden": "true",
                        }),
                        h(
                          "span",
                          null,
                          step.title,
                          step.detail
                            ? h("small", null, ` ${step.detail}`)
                            : null,
                        ),
                        h("small", null, runStatusLabel(step.status)),
                      ),
                    ),
                  )
                : h(
                    "div",
                    { className: "pmtask-detail-runtime-queue-list" },
                    "当前 Run 尚未产生执行计划",
                  ),
              question === null
                ? null
                : h(
                    "div",
                    { className: "pmtask-detail-runtime-question" },
                    h("strong", null, "Agent 需要补充信息"),
                    h("p", null, question),
                    h(
                      "div",
                      { className: "pmtask-detail-runtime-answers" },
                      ...["已补充，继续执行", "请采用默认方案继续"].map(
                        (answer) =>
                          h(
                            "button",
                            {
                              className: "pmtask-detail-runtime-answer",
                              type: "button",
                              key: answer,
                              onClick: () => onQuickAnswer(answer),
                            },
                            answer,
                          ),
                      ),
                    ),
                  ),
              h(
                "div",
                { className: "pmtask-detail-runtime-queue-list" },
                h("span", null, queueLabel),
                h(
                  "span",
                  null,
                  autoRunEligible === false ? "仅人工触发" : "允许自动执行",
                ),
                queueSeq === undefined
                  ? null
                  : h("span", null, `队列序号 ${queueSeq}`),
                dependsOn.length
                  ? h("span", null, `依赖 ${dependsOn.length} 项`)
                  : h("span", null, "无前置依赖"),
              ),
            )
          : null,
      );
    }

    function renderVisibleSlot(renderSlot, name, props) {
      const content = renderSlot?.(name, props);
      const isEmpty =
        content === undefined ||
        content === null ||
        content === false ||
        content === "" ||
        (Array.isArray(content) && content.length === 0);
      if (isEmpty) return null;
      return h(
        "div",
        {
          className: "pmtask-detail-extension-visible",
          "data-task-detail-slot": name,
        },
        content,
      );
    }

    function TaskDetail(props) {
      const {
        task,
        workspaceTitle,
        directory,
        tasks,
        externalRuntimes,
        currentUser,
        reviewableTaskIds,
        pendingAssignee,
        setPendingAssignee,
        assignOpen,
        setAssignOpen,
        onBack,
        onRestored,
        mutate,
        fail,
        renderSlot,
        renderActions,
      } = props;
      const receiverAgent =
        task.receiverType === "agent"
          ? directory.agents.find(
              (agent) =>
                agent.id === task.receiverId ||
                agent.employeeId === task.receiverId,
            )
          : undefined;
      const canCommand =
        currentUser !== null &&
        (task.receiverType === "human"
          ? task.receiverId === currentUser.id
          : task.receiverType === "agent"
            ? receiverAgent?.ownerAuthUserId === currentUser.id
            : false);
      const commandLockReason =
        task.receiverType === "agent"
          ? "只有负责该 AI 伙伴的 Owner 可以发起指令"
          : "只有任务负责人可以发起指令";
      const [editing, setEditing] = react.useState(false);
      const [basicEditing, setBasicEditing] = react.useState(false);
      const [message, setMessage] = react.useState("");
      const [attachments, setAttachments] = react.useState([]);
      const [composerIntent, setComposerIntent] = react.useState(
        canCommand &&
          task.workflow === undefined &&
          task.status === "progress" &&
          (task.receiverType === "human" || task.receiverType === "agent")
          ? "execution"
          : "discussion",
      );
      const [activeTab, setActiveTab] = react.useState(
        task.receiverType === "agent" ? "execution" : "basic",
      );
      const [mentionOpen, setMentionOpen] = react.useState(false);
      const [mentionQuery, setMentionQuery] = react.useState("");
      /** 从 @ 菜单里选中的目标（带 id），发送时作为结构化提及提交。 */
      const [pickedMentions, setPickedMentions] = react.useState([]);
      const [comment, setComment] = react.useState("");
      const [commentIsConsensus, setCommentIsConsensus] = react.useState(false);
      const [replyDrafts, setReplyDrafts] = react.useState({});
      const [executionLive, setExecutionLive] = react.useState(null);
      const [executionDetailState, setExecutionDetailState] =
        react.useState("idle");
      const [executionControl, setExecutionControl] = react.useState(null);
      const [taskRuns, setTaskRuns] = react.useState([]);
      const [selectedRunId, setSelectedRunId] = react.useState("");
      const [stoppingExecution, setStoppingExecution] = react.useState(false);
      const [roundMenuOpen, setRoundMenuOpen] = react.useState(false);
      const [expandedRoundInstructionIds, setExpandedRoundInstructionIds] =
        react.useState([]);
      const [confirmArchive, setConfirmArchive] = react.useState(false);
      const [rejectOpen, setRejectOpen] = react.useState(false);
      const [submitAcceptanceOpen, setSubmitAcceptanceOpen] =
        react.useState(false);
      const [documents, setDocuments] = react.useState([]);
      const [documentsReady, setDocumentsReady] = react.useState(true);
      const messageRef = react.useRef(null);
      const historyRef = react.useRef(null);
      const liveOutputRef = react.useRef(null);
      const directoryOptions = [
        ...directory.humans.map((item) => ({ ...item, type: "human" })),
        ...directory.agents.map((item) => ({ ...item, type: "agent" })),
        ...directory.roles.map((item) => ({ ...item, type: "role" })),
      ];
      const receiverMissingFromMentionDirectory =
        task.receiverType === "agent" &&
        task.receiverId !== undefined &&
        !directory.agents.some(
          (agent) =>
            agent.id === task.receiverId ||
            agent.employeeId === task.receiverId,
        );
      const mentionDirectory = {
        ...directory,
        agents: receiverMissingFromMentionDirectory
          ? [
              {
                id: task.receiverId,
                name: task.receiverName ?? task.receiverId,
                kind: "agent",
                avatar: "",
              },
              ...directory.agents,
            ]
          : directory.agents,
      };
      const mine = taskBelongsTo(task, currentUser, directory);
      const sent = currentUser !== null && task.createdBy === currentUser.id;
      const canReview = reviewableTaskIds.includes(task.id);
      const archived = isArchived(task);
      const readOnly = archived || task.status === "cancelled";
      const dependencyTask =
        task.dependsOn === undefined || task.dependsOn.length === 0
          ? undefined
          : (tasks ?? []).find(
              (candidate) => candidate.id === task.dependsOn[0],
            );
      const isWorkflowTask = task.workflow !== undefined;
      const isApprovalTask = task.workflow?.approvalPolicy !== undefined;
      const canClaim =
        task.receiverType === "role" && task.status === "todo" && mine;
      const canDiscuss =
        !archived && task.status !== "cancelled" && task.status !== "done";
      const canExecute =
        canCommand &&
        !archived &&
        task.status !== "cancelled" &&
        task.status !== "review" &&
        task.workflow === undefined &&
        task.receiverType !== "role" &&
        task.receiverType !== "unassigned";
      const composerIntentValue =
        composerIntent === "execution" && canExecute
          ? "execution"
          : canDiscuss
            ? "discussion"
            : "execution";
      const insertMention = (item) => {
        const name = item.name;
        setPickedMentions((current) =>
          current.some(
            (candidate) =>
              candidate.type === item.type && candidate.id === item.id,
          )
            ? current
            : [
                ...current,
                {
                  id: item.id,
                  name,
                  type: item.type,
                  intent:
                    item.type === "agent"
                      ? "collaborate"
                      : item.type === "human"
                        ? "ask"
                        : "collaborate",
                },
              ],
        );
        const input = messageRef.current;
        const cursor = input?.selectionStart ?? message.length;
        const before = message.slice(0, cursor);
        const after = message.slice(cursor);
        const token = before.match(/@[^@\s]*$/);
        const replacement = `@${name} `;
        const next =
          token === null
            ? `${before}${replacement}${after}`
            : `${before.slice(0, token.index)}${replacement}${after}`;
        const nextCursor = (token?.index ?? before.length) + replacement.length;
        setMessage(next);
        setMentionOpen(false);
        window.requestAnimationFrame(() => {
          input?.focus();
          input?.setSelectionRange(nextCursor, nextCursor);
        });
      };
      const uploadAttachment = async (file) => {
        const contentBase64 = await readFileAsBase64(file);
        const result = await request("/api/collab/tasks/document/upload", {
          method: "POST",
          body: JSON.stringify({
            taskId: task.id,
            name: file.name,
            ...(file.type === "" ? {} : { mimeType: file.type }),
            contentBase64,
          }),
        });
        return {
          name: file.name,
          size: file.size,
          ...(file.type === "" ? {} : { mimeType: file.type }),
          ...(result?.document?.relativePath === undefined
            ? {}
            : { storedPath: result.document.relativePath }),
        };
      };
      const mentionsForContent = (content) =>
        pickedMentions
          .filter((item) => content.includes(`@${item.name}`))
          .map((item) => ({
            kind: item.type,
            id: item.id,
            name: item.name,
          }));
      const sendMessage = async (options = {}) => {
        const source = options.content ?? message;
        const content =
          source.trim() === "" && attachments.length > 0
            ? `已上传附件：${attachments.map((file) => file.name).join("、")}`
            : source.trim();
        if (readOnly || content === "") return;
        if (composerIntentValue === "discussion") {
          if (!canDiscuss) return;
          if (attachments.length > 0) {
            fail(
              new Error(
                isWorkflowTask
                  ? "工作流讨论不支持上传；附件和交付物请在工作流节点提交。"
                  : "讨论发送暂不支持附件，请切换到指令发送。",
              ),
            );
            return;
          }
          try {
            const mentions = mentionsForContent(content);
            await mutate(
              "/api/collab/tasks/comment",
              {
                taskId: task.id,
                content,
                isKeyConsensus: false,
                mentions,
              },
              mentions.some((mention) => mention.kind === "agent")
                ? "讨论已发送，@ 的 AI 伙伴开始协作执行"
                : "讨论已发送",
            );
            setMessage("");
            setPickedMentions([]);
            setMentionOpen(false);
          } catch (cause) {
            fail(cause);
          }
          return;
        }
        try {
          const uploaded = [];
          for (const file of attachments) {
            uploaded.push(await uploadAttachment(file));
          }
          // 只提交正文里还留着的 @：用户删掉名字后不该再定向分发。
          const mentions = mentionsForContent(content);
          const addressesReceiver =
            mentions.length === 0 ||
            (task.receiverId !== undefined &&
              mentions.some((mention) => mention.id === task.receiverId));
          const mentionsCollaborator =
            task.receiverId !== undefined &&
            mentions.some((mention) => mention.id !== task.receiverId);
          const deliveryTarget =
            mentions.length === 0
              ? "receiver"
              : addressesReceiver && mentionsCollaborator
                ? "broadcast"
                : addressesReceiver
                  ? "receiver"
                  : "collaborators";
          const reopensTask =
            task.status === "done" && deliveryTarget !== "collaborators";
          const sentNotice =
            task.status === "done"
              ? reopensTask
                ? "已追加要求并重新开启，指令已发送"
                : "协作消息已发送，任务状态保持不变"
              : task.receiverType === "agent"
                ? "执行指令已发送"
                : `已发送给 ${receiverDisplay(task)}`;
          await mutate(
            "/api/collab/tasks/message",
            {
              taskId: task.id,
              content,
              attachments: uploaded,
              mentions,
              deliveryTarget,
            },
            sentNotice,
          );
          setMessage("");
          setAttachments([]);
          setPickedMentions([]);
          setMentionOpen(false);
        } catch (cause) {
          fail(cause);
        }
      };
      /**
       * 跳到这条任务对应的 Agent 执行会话。会话是懒落盘的：Agent 还没真正
       * 开始跑时 DSH 侧还没有这条会话，这里明确提示而不是让人以为丢了。
       */
      const openAgentSession = async () => {
        try {
          const result = await request(
            `/api/collab/tasks/session?taskId=${encodeURIComponent(task.id)}`,
          );
          const sessionId =
            typeof result?.sessionId === "string" ? result.sessionId : "";
          if (sessionId === "") {
            fail(
              new Error(
                "Agent 还没有真正开始执行，会话尚未创建；稍后重试即可。",
              ),
            );
            return;
          }
          if (window.__pluginmaxOpenSession?.(sessionId) !== true) {
            fail(
              new Error(
                `没能自动切到会话 ${sessionId}，可在左侧项目下查找它。`,
              ),
            );
          }
        } catch (cause) {
          fail(cause);
        }
      };
      const runListKey = task.agentRunIds.join("|");
      react.useEffect(() => {
        if (task.agentRunIds.length === 0) {
          setTaskRuns([]);
          return undefined;
        }
        let disposed = false;
        const loadRuns = async () => {
          try {
            const instanceId = task.workflow?.instanceId ?? task.id;
            const result = await request(
              `/api/collab/agent/runs?workspaceId=${encodeURIComponent(task.workspaceId)}&instanceId=${encodeURIComponent(instanceId)}`,
            );
            if (disposed) return;
            const allowed = new Set(task.agentRunIds);
            const runs = (result?.runs ?? []).filter((run) =>
              allowed.has(run.id),
            );
            runs.sort((left, right) =>
              String(left.createdAt ?? left.startedAt ?? "").localeCompare(
                String(right.createdAt ?? right.startedAt ?? ""),
              ),
            );
            setTaskRuns(runs);
          } catch {
            // Task history still provides a fallback participant list.
          }
        };
        void loadRuns();
        const timer = window.setInterval(() => void loadRuns(), 2_000);
        return () => {
          disposed = true;
          window.clearInterval(timer);
        };
      }, [runListKey, task.id, task.workspaceId, task.workflow?.instanceId]);
      react.useEffect(() => {
        setSelectedRunId(task.agentRunIds.at(-1) ?? "");
      }, [task.id, runListKey]);
      react.useEffect(() => {
        setRoundMenuOpen(false);
        setExpandedRoundInstructionIds([]);
        setStoppingExecution(false);
        setSubmitAcceptanceOpen(false);
        setEditing(false);
        setBasicEditing(false);
        setActiveTab(task.receiverType === "agent" ? "execution" : "basic");
        setComposerIntent(
          canCommand &&
            task.workflow === undefined &&
            task.status === "progress" &&
            (task.receiverType === "human" || task.receiverType === "agent")
            ? "execution"
            : "discussion",
        );
      }, [
        task.id,
        task.status,
        task.workflow?.instanceId,
        canCommand,
      ]);
      react.useEffect(() => {
        if (selectedRunId === "") {
          setExecutionLive(null);
          setExecutionControl(null);
          setExecutionDetailState("idle");
          return undefined;
        }
        setExecutionLive(null);
        setExecutionControl(null);
        setExecutionDetailState("loading");
        let disposed = false;
        const loadExecution = async () => {
          try {
            const [result, controlResult] = await Promise.all([
              request(
                `/api/collab/agent/runs/detail?workspaceId=${encodeURIComponent(task.workspaceId)}&runId=${encodeURIComponent(selectedRunId)}`,
              ),
              request(
                `/api/collab/agent/execution/detail?workspaceId=${encodeURIComponent(task.workspaceId)}&runId=${encodeURIComponent(selectedRunId)}`,
              ).catch(() => ({ execution: null })),
            ]);
            if (!disposed) {
              setExecutionLive(result);
              setExecutionControl(controlResult?.execution ?? null);
              setExecutionDetailState("ready");
            }
          } catch {
            // The task history and run list remain authoritative if live detail is unavailable.
            if (!disposed) setExecutionDetailState("error");
          }
        };
        void loadExecution();
        const timer = window.setInterval(() => void loadExecution(), 1_200);
        return () => {
          disposed = true;
          window.clearInterval(timer);
        };
      }, [selectedRunId, task.workspaceId]);
      const messageByRunId = new Map(
        task.messages
          .filter((item) => item.runId !== undefined)
          .map((item) => [item.runId, item]),
      );
      const messageById = new Map(task.messages.map((item) => [item.id, item]));
      const runById = new Map(taskRuns.map((run) => [run.id, run]));
      const participantMap = new Map();
      for (const runId of task.agentRunIds) {
        const run = runById.get(runId);
        const runMessage = messageByRunId.get(runId);
        if (run === undefined && runMessage === undefined) continue;
        const context = run?.payload?.context ?? {};
        const participantId =
          runMessage?.authorId ??
          context.taskReceiverId ??
          run?.principalId ??
          runId;
        const participantName =
          runMessage?.authorName ??
          context.employeeName ??
          run?.payload?.profileName ??
          "AI伙伴";
        const existing = participantMap.get(participantId) ?? {
          id: participantId,
          name: participantName,
          runs: [],
        };
        existing.runs.push({
          id: runId,
          run,
          message: runMessage,
          status: run?.status ?? runMessage?.state ?? "succeeded",
          role:
            runMessage?.runRole ??
            context.taskRunRole ??
            (runMessage === undefined ? "owner" : "owner"),
          at:
            run?.endedAt ??
            run?.startedAt ??
            run?.createdAt ??
            runMessage?.at ??
            "",
        });
        participantMap.set(participantId, existing);
      }
      const participants = [...participantMap.values()].map((participant) => {
        participant.runs.sort((left, right) =>
          String(left.at).localeCompare(String(right.at)),
        );
        return {
          ...participant,
          latest: participant.runs.at(-1),
          active: participant.runs.some((run) =>
            RUNNING_MESSAGE_STATES.includes(run.status),
          ),
        };
      });
      const executionRunOptions = participants
        .flatMap((participant) =>
          participant.runs.map((run) => {
            const triggerMessageId =
              run.run?.payload?.context?.triggerMessageId;
            const triggerMessage =
              typeof triggerMessageId === "string"
                ? messageById.get(triggerMessageId)
                : undefined;
            const runStartedAt = Date.parse(
              run.run?.startedAt ?? run.run?.createdAt ?? run.at,
            );
            const assignmentEvent = [...task.events].reverse().find((event) => {
              const eventAt = Date.parse(event.at);
              return (
                Number.isFinite(runStartedAt) &&
                Number.isFinite(eventAt) &&
                eventAt <= runStartedAt + 60_000 &&
                runStartedAt - eventAt <= 10 * 60_000 &&
                event.message.includes("调整责任人为")
              );
            });
            const instruction =
              triggerMessage?.content?.trim() ||
              assignmentEvent?.message ||
              task.description.trim();
            // Run 创建即 agent.dispatch 投递时刻，优先用它表示指令真正发送给 Agent 的时间。
            const instructionAt =
              run.run?.createdAt ?? run.run?.startedAt ?? run.at;
            return {
              ...run,
              participantId: participant.id,
              participantName: participant.name,
              instruction,
              instructionAt,
            };
          }),
        )
        .sort((left, right) => String(left.at).localeCompare(String(right.at)))
        .map((run, index) => ({ ...run, roundNumber: index + 1 }))
        .reverse();
      const selectedRun =
        selectedRunId === "" ? undefined : runById.get(selectedRunId);
      const selectedRunOption = executionRunOptions.find(
        (run) => run.id === selectedRunId,
      );
      const toggleRoundInstruction = (runId) => {
        setExpandedRoundInstructionIds((current) =>
          current.includes(runId)
            ? current.filter((id) => id !== runId)
            : [...current, runId],
        );
      };
      const selectedRunMessage =
        selectedRunId === "" ? undefined : messageByRunId.get(selectedRunId);
      const selectedParticipant = participants.find((participant) =>
        participant.runs.some((run) => run.id === selectedRunId),
      );
      const selectedExecutionBase =
        executionLive?.run?.execution ??
        selectedRun?.execution ??
        selectedRunMessage?.execution;
      const selectedExecutionSnapshot = executionControl?.snapshot;
      const selectedExecution =
        selectedExecutionSnapshot === undefined ||
        selectedExecutionSnapshot === null
          ? selectedExecutionBase
          : {
              ...(selectedExecutionBase ?? {}),
              provider: selectedExecutionSnapshot.provider,
              model: selectedExecutionSnapshot.model,
              reasoningEffort: selectedExecutionSnapshot.reasoningEffort,
              runtime: selectedExecutionSnapshot.runtimeName,
              runtimeVersion: selectedExecutionSnapshot.runtimeVersion,
              authMode: selectedExecutionSnapshot.authMode,
              sandbox: selectedExecutionSnapshot.sandbox,
              searchEnabled: selectedExecutionSnapshot.searchEnabled,
              networkAccess: selectedExecutionSnapshot.networkAccess,
              searchUsed: selectedExecutionSnapshot.searchUsed,
              planVisibility: selectedExecutionSnapshot.planVisibility,
              gateEnforcement: selectedExecutionSnapshot.gateEnforcement,
            };
      const executionSummaryState =
        selectedExecution !== undefined && selectedExecution !== null
          ? "ready"
          : selectedRunId === ""
            ? "idle"
            : executionDetailState === "ready" ||
                executionDetailState === "error"
              ? "unavailable"
              : "loading";
      const executionText =
        executionLive?.progress?.text?.trim() ||
        selectedRunMessage?.content ||
        selectedRun?.output?.summary ||
        "暂无执行输出";
      const executionStatus =
        executionLive?.run?.status ??
        selectedRun?.status ??
        selectedRunMessage?.state ??
        "idle";
      const executionRunning = RUNNING_MESSAGE_STATES.includes(executionStatus);
      const activeExecutionRuns = executionRunOptions.filter((run) =>
        RUNNING_MESSAGE_STATES.includes(run.status),
      );
      const typingParticipants =
        task.status === "cancelled"
          ? []
          : [
              ...new Map(
                activeExecutionRuns.map((run) => [
                  run.participantId,
                  run,
                ]),
              ).values(),
            ];
      const canStopAllExecution =
        (canCommand || canReview) &&
        activeExecutionRuns.length > 0 &&
        !stoppingExecution;
      const stopAllExecution = async () => {
        if (!canStopAllExecution) return;
        setStoppingExecution(true);
        try {
          await mutate(
            "/api/collab/tasks/execution/stop",
            { taskId: task.id },
            `已停止任务中的 ${activeExecutionRuns.length} 个 AI 执行`,
          );
          const stoppedIds = new Set(activeExecutionRuns.map((run) => run.id));
          setTaskRuns((current) =>
            current.map((run) =>
              stoppedIds.has(run.id)
                ? { ...run, status: "cancelled" }
                : run,
            ),
          );
        } catch (cause) {
          fail(cause);
        } finally {
          setStoppingExecution(false);
        }
      };
      const selectedPlan = executionControl?.plan ?? null;
      const selectedExecutionEvents = Array.isArray(executionControl?.events)
        ? executionControl.events.slice(-12).reverse()
        : [];
      const pendingExecutionGates = Array.isArray(executionControl?.gates)
        ? executionControl.gates.filter((gate) => gate.status === "pending")
        : [];
      const decideExecutionGate = async (gateId, decision) => {
        try {
          await request("/api/collab/tasks/execution/gates/decide", {
            method: "POST",
            body: JSON.stringify({
              taskId: task.id,
              gateId,
              decision,
            }),
          });
          setExecutionControl((current) =>
            current === null || !Array.isArray(current.gates)
              ? current
              : {
                  ...current,
                  gates: current.gates.map((gate) =>
                    gate.id === gateId
                      ? {
                          ...gate,
                          status: decision,
                          decidedAt: new Date().toISOString(),
                        }
                      : gate,
                  ),
                },
          );
        } catch (cause) {
          fail(cause);
        }
      };
      const selectedRunDocuments = documents.filter(
        (document) => document.runId === selectedRunId,
      );
      const latestRunId = task.agentRunIds.at(-1);
      const taskLevelDocuments = documents.filter(
        (document) =>
          document.runId === undefined && selectedRunId === latestRunId,
      );
      const visibleRunDocuments = [
        ...selectedRunDocuments,
        ...taskLevelDocuments,
      ];
      const documentSignature = `${task.id}:${task.messages.length}:${executionStatus}`;
      react.useEffect(() => {
        let disposed = false;
        const loadDocuments = async () => {
          try {
            const result = await request(
              `/api/collab/tasks/documents?taskId=${encodeURIComponent(task.id)}`,
            );
            if (disposed) return;
            setDocuments(result?.documents ?? []);
            setDocumentsReady(result?.workspaceReady !== false);
          } catch {
            if (disposed) return;
            setDocumentsReady(false);
          }
        };
        void loadDocuments();
        // 子代理可能在主运行 settle 之后才写完文件，所以详情打开期间持续刷新，
        // 而不是运行一结束就停止轮询。
        const timer = window.setInterval(() => void loadDocuments(), 8_000);
        return () => {
          disposed = true;
          if (timer !== undefined) window.clearInterval(timer);
        };
      }, [documentSignature, executionRunning]);
      react.useEffect(() => {
        const node = liveOutputRef.current;
        if (node === null) return undefined;
        const frame = window.requestAnimationFrame(() => {
          node.scrollTop = node.scrollHeight;
        });
        return () => window.cancelAnimationFrame(frame);
      }, [executionText]);
      const action = async (name, label, extra = {}) => {
        try {
          const endpoint =
            name === "claim"
              ? "/api/collab/tasks/claim"
              : "/api/collab/tasks/action";
          await mutate(
            endpoint,
            name === "claim"
              ? { taskId: task.id }
              : { taskId: task.id, action: name, ...extra },
            label,
          );
        } catch (cause) {
          fail(cause);
        }
      };
      const requestSubmitAcceptance = () => {
        if (task.steps.length === 0) {
          void action("submit", "已提交验收");
          return;
        }
        setSubmitAcceptanceOpen(true);
      };

      const cancelTask = async () => {
        const activeHint = taskHasActiveRun(task)
          ? "任务中正在运行的 AI 执行也会立即停止。"
          : "";
        if (
          !window.confirm(
            `取消后任务不可恢复为进行中。${activeHint}确认取消当前任务？`,
          )
        ) {
          return;
        }
        try {
          await mutate(
            "/api/collab/tasks/status",
            { taskId: task.id, status: "cancelled" },
            "任务已取消",
          );
        } catch (cause) {
          fail(cause);
        }
      };

      const resetSession = async () => {
        if (readOnly) return;
        if (
          !window.confirm(
            "重置执行会话会另起一条新会话，下一次执行重新注入完整任务上下文；旧会话保留为只读。确认继续？",
          )
        ) {
          return;
        }
        try {
          await mutate(
            "/api/collab/tasks/session/reset",
            { taskId: task.id },
            "已重置执行会话",
          );
        } catch (cause) {
          fail(cause);
        }
      };
      const lockedTip = archived
        ? "任务已归档，复原后可操作"
        : task.status === "cancelled"
          ? "任务已取消，仅可查看历史或归档"
          : undefined;
      const archiveTask = async () => {
        try {
          await mutate(
            "/api/collab/tasks/action",
            { taskId: task.id, action: "archive" },
            "任务已归档",
          );
          onBack();
        } catch (cause) {
          fail(cause);
        }
      };
      const restoreTask = async () => {
        try {
          await mutate(
            "/api/collab/tasks/action",
            { taskId: task.id, action: "restore" },
            "任务已复原",
          );
          onRestored?.();
        } catch (cause) {
          fail(cause);
        }
      };
      const downloadDocument = async (document) => {
        try {
          const current = token();
          const response = await fetch(
            `/api/collab/tasks/document/content?taskId=${encodeURIComponent(task.id)}&path=${encodeURIComponent(document.relativePath)}`,
            {
              headers:
                current === null ? {} : { authorization: `Bearer ${current}` },
              cache: "no-store",
            },
          );
          if (!response.ok) {
            throw new Error(`下载失败（HTTP ${response.status}）`);
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const anchor = window.document.createElement("a");
          anchor.href = url;
          anchor.download = document.name;
          window.document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
        } catch (cause) {
          fail(cause);
        }
      };
      const revealDocument = async (document) => {
        try {
          await mutate(
            "/api/collab/tasks/document/reveal",
            { taskId: task.id, path: document.relativePath },
            "已在本地文件夹中打开",
          );
        } catch (cause) {
          fail(cause);
        }
      };
      const chooseAssignee = (type, id) => {
        const item = directoryOptions.find(
          (candidate) => candidate.type === type && candidate.id === id,
        );
        setPendingAssignee({
          type,
          id: type === "unassigned" ? "" : id,
          name: type === "unassigned" ? "待指派" : (item?.name ?? id),
          option: type === "unassigned" ? undefined : item,
        });
        setAssignOpen(false);
      };
      const confirmAssignee = async () => {
        if (pendingAssignee === null) return;
        try {
          await mutate(
            "/api/collab/tasks/assign",
            {
              taskId: task.id,
              receiverType: pendingAssignee.type,
              receiverId: pendingAssignee.id,
              receiverName: pendingAssignee.name,
            },
            pendingAssignee.type === "unassigned"
              ? "责任人已恢复为待指派"
              : task.status === "done"
                ? `已重新开启任务并指派给 ${pendingAssignee.name}`
                : `已确认指派给 ${pendingAssignee.name}`,
          );
          setPendingAssignee(null);
        } catch (cause) {
          fail(cause);
        }
      };

      const openWorkflow = () => {
        const workflowLink = task.links.find(
          (link) => link.type === "workflow",
        );
        const instanceId = task.workflow?.instanceId ?? workflowLink?.id;
        if (!instanceId) return;
        window.__pluginmaxShell?.setRoute("workflow");
        window.dispatchEvent(
          new CustomEvent("pluginmax:collab-navigate", {
            detail: {
              plugin: "workflow",
              instanceId,
              workspaceId: task.workspaceId,
            },
          }),
        );
      };
      const workflowActionCopy = (() => {
        if (task.status === "cancelled") {
          return "工作流节点已取消；此任务保留执行记录，其他操作已锁定，可从任务管理归档。";
        }
        if (isApprovalTask) {
          return task.status === "review"
            ? "当前审批待处理，可以在下方直接给出结论，或进入工作流查看完整审批记录。"
            : "审批结论由工作流控制，请进入工作流查看当前状态。";
        }
        if (task.receiverType === "agent") {
          const latestRun = [...task.messages]
            .reverse()
            .find((item) => item.kind === "agent");
          return ["failed", "timeout", "cancelled", "interrupted"].includes(
            latestRun?.state,
          )
            ? "Agent 最近一次运行未完成；请进入工作流详情查看结果、重试或人工代交。"
            : task.status === "progress"
              ? "Agent 正在执行工作流节点；派发、取消、重试和交付物处理请在工作流详情完成。"
              : "工作流 Agent 产出由工作流节点控制，请进入工作流查看和执行后续动作。";
        }
        if (task.status === "review") {
          return "节点产出已提交，请在工作流详情执行 Review 或使用下方结论操作。";
        }
        return task.workflow?.reviewRequired === false
          ? "请在工作流详情完成节点；任务状态会随工作流自动同步。"
          : "请在工作流详情提交交付物并完成节点；任务状态会随工作流自动同步。";
      })();

      const previewTask =
        pendingAssignee === null
          ? task
          : {
              ...task,
              receiverType: pendingAssignee.type,
              receiverId: pendingAssignee.id,
              receiverName: pendingAssignee.name,
            };
      const receiverPreview = receiverDisplay(previewTask);
      const previewOption =
        pendingAssignee?.option ??
        (task.receiverType === "human"
          ? directory.humans.find((item) => item.id === task.receiverId)
          : task.receiverType === "agent"
            ? directory.agents.find((item) => item.id === task.receiverId)
            : task.receiverType === "role"
              ? directory.roles.find((item) => item.id === task.receiverId)
              : undefined);
      const previewKind = pendingAssignee?.type ?? task.receiverType;
      const previewLabel =
        previewKind === "unassigned"
          ? "待指派"
          : receiverOptionLabel({
              ...(previewOption ?? {}),
              type: previewKind,
              name: receiverPreview,
            });
      const workflowDiscussionHint = isApprovalTask
        ? "可分析方案、准备材料；审批与提交请前往工作流节点。"
        : "可讨论分析、准备材料；节点推进与提交请前往工作流节点。";
      const composerHint = archived
        ? "任务已归档 · 复原后可继续发送指令"
        : task.status === "cancelled"
          ? "任务已取消 · 仅可查看历史或归档"
          : !canCommand
            ? `${commandLockReason}；可在讨论中 @ AI 伙伴发起协作执行`
            : isWorkflowTask
              ? workflowDiscussionHint
              : task.receiverType === "unassigned"
                ? "暂无责任人 · 任务待指派"
                : task.status === "done"
                  ? `任务已完成 · 发送指令会追加要求并在同一条会话重开一轮（${receiverDisplay(task)}）`
                  : task.receiverType === "agent"
                    ? `发送给 ${receiverDisplay(task)}${task.status === "progress" && taskHasActiveRun(task) ? " · Agent 执行中" : task.status === "progress" ? " · 最近一次 Agent 运行未完成" : ""}`
                    : `发送给 ${receiverDisplay(task)}`;
      const discussionMentionsAgent =
        composerIntentValue === "discussion" &&
        pickedMentions.some(
          (item) =>
            item.type === "agent" && message.includes(`@${item.name}`),
        );
      const composerEffectText = isWorkflowTask
        ? discussionMentionsAgent
          ? "将向 @ 的 AI 伙伴发起一轮协作执行；其余内容仅记录"
          : workflowDiscussionHint
        : composerIntentValue === "discussion"
          ? discussionMentionsAgent
            ? "将向 @ 的 AI 伙伴发起一轮协作执行；其余内容仅记录"
            : canCommand
              ? "仅记录讨论，不进入本次执行上下文"
              : `仅记录讨论 · ${commandLockReason}`
          : task.status === "done"
            ? "将追加要求、重新开启任务，并同步之前关键共识"
            : task.receiverType === "agent"
              ? "将触发一次 Agent Run，并同步之前关键共识"
              : "将通知负责人，并同步之前关键共识";
      const composerPlaceholder = isWorkflowTask
        ? isApprovalTask
          ? "询问审批依据、方案风险或需要准备的材料"
          : "讨论节点方案、风险或需要准备的交付物"
        : composerIntentValue === "discussion"
          ? canCommand
            ? "参与讨论；未 @ AI 时仅记录，@ AI 伙伴会发起协作执行"
            : `参与讨论；${commandLockReason}，@ AI 伙伴可发起协作执行`
          : task.status === "done"
            ? "补充新的执行要求；发送后会重新开启任务，并同步之前关键共识"
            : "补充要求或推进说明，发送后将交给任务负责人，并通知到 @ 的人员 / AI 伙伴";
      const composerLocked = archived || task.status === "cancelled";
      const executionPolicyView = executionPolicyForm(task);
      const runtimeView = taskRuntimeView(
        task,
        directory,
        externalRuntimes,
        selectedExecution,
        executionDetailState,
      );
      const commentPlaceholder = archived
        ? "任务已归档，复原后可评论"
        : task.status === "cancelled"
          ? "任务已取消，评论已锁定"
          : "未 @ AI 伙伴时仅记录；@ AI 伙伴会发起协作执行";
      react.useEffect(() => {
        setComment("");
        setCommentIsConsensus(false);
        setReplyDrafts({});
      }, [task.id]);
      const history = [
        {
          kind: "message",
          at: task.createdAt,
          item: {
            id: `${task.id}:initial-request`,
            at: task.createdAt,
            authorId: task.createdBy,
            authorName: task.createdByName,
            kind: "human",
            content: task.description,
            attachments: [],
            mentions: [],
            messageType: isWorkflowTask ? "workflow-task" : "instruction",
          },
        },
        ...task.messages.map((item) => ({
          kind: "message",
          at: item.at,
          item: {
            ...item,
            attachments: item.attachments ?? [],
            messageType:
              item.kind === "agent"
                ? "feedback"
                : item.kind === "system"
                  ? "system"
                  : "instruction",
          },
        })),
        ...task.comments.flatMap((item) => [
          {
            kind: "message",
            at: item.at,
            item: {
              ...item,
              attachments: [],
              commentId: item.id,
              messageType: item.mentions?.some(
                (mention) => mention.kind === "agent",
              )
                ? "collaboration"
                : item.isKeyConsensus
                ? "consensus"
                : isWorkflowTask
                  ? "workflow-discussion"
                  : "discussion",
            },
          },
          ...item.replies.map((reply) => ({
            kind: "message",
            at: reply.at,
            item: {
              ...reply,
              attachments: [],
              replyToCommentId: item.id,
              replyToAuthorName: item.authorName,
              messageType: isWorkflowTask
                ? "workflow-discussion"
                : "discussion",
            },
          })),
        ]),
        ...task.events
          .filter(
            (event) =>
              event.kind !== "message" &&
              event.kind !== "created" &&
              event.kind !== "comment" &&
              event.kind !== "reply",
          )
          .map((event) => ({ kind: "event", at: event.at, event })),
      ].sort(
        (left, right) =>
          left.at.localeCompare(right.at) ||
          (left.kind === right.kind ? 0 : left.kind === "message" ? -1 : 1),
      );
      react.useEffect(() => {
        const node = historyRef.current;
        if (node === null) return undefined;
        const frame = window.requestAnimationFrame(() => {
          node.scrollTop = node.scrollHeight;
        });
        return () => window.cancelAnimationFrame(frame);
      }, [
        task.id,
        task.messages.length,
        task.events.length,
        task.comments.length,
      ]);
      const historyAvatar = (item) => {
        const kind = item.kind === "agent" ? "agent" : "human";
        const options = kind === "agent" ? directory.agents : directory.humans;
        const option = options.find(
          (candidate) => candidate.id === item.authorId,
        );
        return h(ReceiverAvatar, { option, kind, name: item.authorName });
      };
      const detailActions = [];
      if (
        !archived &&
        activeExecutionRuns.length > 0 &&
        (canCommand || canReview) &&
        !stoppingExecution
      ) {
        detailActions.push(
          h(DetailActionButton, {
            key: "stop-execution",
            label: "停止执行",
            tone: "caution",
            title: `停止当前任务中 ${activeExecutionRuns.length} 个正在运行的 AI 伙伴`,
            onClick: () => void stopAllExecution(),
          }),
        );
      }
      if (archived) {
        detailActions.push(
          h(DetailActionButton, {
            key: "restore",
            label: "复原",
            icon: "restore",
            tone: "primary",
            onClick: () => void restoreTask(),
          }),
        );
      } else if (isWorkflowTask) {
        detailActions.push(
          h(DetailActionButton, {
            key: "workflow",
            label: "打开工作流节点",
            icon: "workflow",
            tone: "primary",
            onClick: openWorkflow,
          }),
        );
        if (isApprovalTask && canReview && task.status === "review") {
          detailActions.push(
            h(DetailActionButton, {
              key: "approve",
              label: "通过审批",
              icon: "approve",
              tone: "primary",
              disabled: readOnly,
              onClick: () => void action("approve", "审批已通过"),
            }),
            h(DetailActionButton, {
              key: "reject",
              label: "退回审批",
              icon: "reject",
              tone: "caution",
              disabled: readOnly,
              onClick: () => setRejectOpen(true),
            }),
          );
        }
        if (["done", "cancelled"].includes(task.status)) {
          detailActions.push(
            h(DetailActionButton, {
              key: "archive",
              label: "归档",
              icon: "archive",
              tone: "neutral",
              onClick: () => setConfirmArchive(true),
            }),
          );
        }
      } else {
        if (canClaim) {
          detailActions.push(
            h(DetailActionButton, {
              key: "claim",
              label: "认领",
              icon: "claim",
              tone: "primary",
              disabled: readOnly,
              onClick: () => void action("claim", "已认领任务"),
            }),
          );
        }
        if (mine && task.receiverType === "human" && task.status === "todo") {
          detailActions.push(
            h(DetailActionButton, {
              key: "start",
              label: "开始",
              icon: "start",
              tone: "primary",
              disabled: readOnly,
              onClick: () => void action("start", "任务已开始"),
            }),
          );
        }
        if (mine && task.status === "progress" && !isApprovalTask) {
          detailActions.push(
            h(DetailActionButton, {
              key: "submit",
              label: "提交验收",
              icon: "submit",
              tone: "primary",
              disabled: readOnly,
              onClick: requestSubmitAcceptance,
            }),
          );
        }
        if (canReview && task.status === "review") {
          detailActions.push(
            h(DetailActionButton, {
              key: "approve",
              label: "通过",
              icon: "approve",
              tone: "primary",
              disabled: readOnly,
              onClick: () => void action("approve", "任务已完成"),
            }),
            h(DetailActionButton, {
              key: "reject",
              label: "退回",
              icon: "reject",
              tone: "caution",
              disabled: readOnly,
              onClick: () => setRejectOpen(true),
            }),
          );
        }
        if (
          sent &&
          task.receiverType === "human" &&
          task.receiverId !== currentUser?.id &&
          !isSettledStatus(task.status)
        ) {
          detailActions.push(
            h(DetailActionButton, {
              key: "nudge",
              label: "催办",
              icon: "nudge",
              tone: "neutral",
              disabled: readOnly,
              onClick: () => void action("nudge", "已提醒责任人"),
            }),
          );
        }
        if (sent && !isSettledStatus(task.status)) {
          detailActions.push(
            h(DetailActionButton, {
              key: "cancel",
              label: "取消任务",
              icon: "cancel",
              tone: "danger",
              disabled: readOnly,
              onClick: () => void cancelTask(),
            }),
          );
        }
        if (isSettledStatus(task.status)) {
          detailActions.push(
            h(DetailActionButton, {
              key: "archive",
              label: "归档",
              icon: "archive",
              tone: "neutral",
              onClick: () => setConfirmArchive(true),
            }),
          );
        }
      }
      const showOpenSession =
        task.receiverType === "agent" || task.agentRunIds.length > 0;
      const selectDetailTab = (tab) => {
        if (tab !== "basic") setBasicEditing(false);
        setActiveTab(tab);
      };
      const saveBasicInfo = async (input) => {
        try {
          await mutate(
            "/api/collab/tasks/update",
            {
              taskId: task.id,
              title: task.title,
              description: task.description,
              acceptance: task.acceptance,
              priority: input.priority,
              due: input.due,
              dependsOn: input.dependsOn,
              autoSubmitReview: input.autoSubmitReview,
              executionPolicy: input.executionPolicy,
            },
            "基础信息已更新",
          );
          if (
            task.workflow !== undefined &&
            task.workflow.approvalPolicy === undefined &&
            input.autoApproveReview !== task.autoApproveReview
          ) {
            await mutate(
              "/api/collab/tasks/review/approval",
              {
                taskId: task.id,
                autoApproveReview: input.autoApproveReview,
              },
              input.autoApproveReview
                ? "提交后将自动通过 Review"
                : "提交后将等待人工 Review",
              { silent: true },
            );
          }
          if (
            input.receiverType !== task.receiverType ||
            input.receiverId !== (task.receiverId ?? "")
          ) {
            await mutate(
              "/api/collab/tasks/assign",
              {
                taskId: task.id,
                receiverType: input.receiverType,
                receiverId: input.receiverId || undefined,
                receiverName:
                  input.receiverType === "unassigned"
                    ? undefined
                    : input.receiverName,
              },
              "负责人已更新",
              { silent: true },
            );
          }
          setBasicEditing(false);
        } catch (cause) {
          fail(cause);
          throw cause;
        }
      };

      const basicPane = basicEditing
        ? h(BasicInfoEditForm, {
            task,
            workspaceTitle,
            directory,
            tasks,
            externalRuntimes,
            selectedExecution,
            executionDetailState,
            onCancel: () => setBasicEditing(false),
            onSave: saveBasicInfo,
          })
        : h(
            "div",
            {
              className: "pmtask-detail-tab-body",
              "data-detail-tab": "basic",
            },
            h(
              "div",
              { className: "pmtask-detail-info-grid" },
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "负责人"),
                h(
                  "strong",
                  { className: "pmtask-assignee" },
                  h(ReceiverAvatar, {
                    option: previewOption,
                    kind: task.receiverType,
                    name: previewLabel,
                  }),
                  h(
                    "span",
                    { className: "pmtask-assignee-name" },
                    previewLabel,
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "归属项目"),
                h("strong", null, workspaceTitle || task.workspaceId),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "前置任务"),
                h(
                  "strong",
                  null,
                  dependencyTask === undefined
                    ? task.dependsOn?.[0] || "无"
                    : `${dependencyTask.id} · ${dependencyTask.title} · ${statusLabel(dependencyTask.status)}`,
                ),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "任务类型"),
                h("strong", null, task.type),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "优先级"),
                h("strong", null, priorityLabel(task.priority)),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "截止时间"),
                h("strong", null, task.due || "不限"),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "创建人"),
                h("strong", null, task.createdByName),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "完成后自动提交 Review"),
                h(
                  "strong",
                  null,
                  task.autoSubmitReview === false ? "关闭" : "开启",
                ),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "Review 自动通过"),
                h(
                  "strong",
                  null,
                  task.autoApproveReview === true ? "开启" : "关闭",
                ),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "执行运行时"),
                h("strong", null, runtimeView.runtimeLabel),
              ),
              h(
                "div",
                { className: "pmtask-detail-info" },
                h("span", null, "模型 / 推理强度"),
                h("strong", null, runtimeView.modelAndReasoning),
              ),
              h(
                "div",
                { className: "pmtask-detail-info wide" },
                h("span", null, "执行策略"),
                h(
                  "div",
                  { className: "pmtask-detail-strategy" },
                  h(
                    "span",
                    {
                      className: executionPolicyView.allowPublicWeb ? "on" : "",
                    },
                    `公开网页 ${executionPolicyView.allowPublicWeb ? "允许" : "禁止"}`,
                  ),
                  h(
                    "span",
                    {
                      className: executionPolicyView.requireToolApproval
                        ? "on"
                        : "",
                    },
                    `工具确认 ${executionPolicyView.requireToolApproval ? "开启" : "关闭"}`,
                  ),
                  h(
                    "span",
                    {
                      className: executionPolicyView.requireToolEvents
                        ? "on"
                        : "",
                    },
                    `工具事件 ${executionPolicyView.requireToolEvents ? "记录" : "不记录"}`,
                  ),
                ),
              ),
            ),
            h(
              "div",
              { className: "pmtask-detail-basic-toolbar" },
              h(
                "button",
                {
                  type: "button",
                  disabled: readOnly,
                  onClick: () => {
                    setEditing(false);
                    setBasicEditing(true);
                  },
                },
                "编辑",
              ),
            ),
          );

      const runsById = new Map(executionRunOptions.map((run) => [run.id, run]));
      const latestDocumentsByName = new Map();
      for (const document of documents) {
        const key = String(document.name ?? "").trim();
        if (key === "") continue;
        const current = latestDocumentsByName.get(key);
        const currentTime = Date.parse(current?.document.updatedAt ?? "");
        const nextTime = Date.parse(document.updatedAt ?? "");
        if (
          current === undefined ||
          (Number.isFinite(nextTime) &&
            (!Number.isFinite(currentTime) || nextTime > currentTime))
        ) {
          latestDocumentsByName.set(key, {
            document,
            hiddenVersions:
              current === undefined ? 0 : current.hiddenVersions + 1,
          });
        } else {
          current.hiddenVersions += 1;
        }
      }
      const latestDocuments = [...latestDocumentsByName.values()].sort(
        (left, right) =>
          String(right.document.updatedAt ?? "").localeCompare(
            String(left.document.updatedAt ?? ""),
          ),
      );
      const documentsPane = h(
        "div",
        {
          className: "pmtask-detail-tab-body",
          "data-detail-tab": "documents",
        },
        documentsReady
          ? null
          : h(
              "div",
              { className: "pmtask-side-empty" },
              "任务工作区不可用，暂时无法读取产出文档。",
            ),
        latestDocuments.length === 0
          ? h(
              "div",
              { className: "pmtask-detail-doc-list" },
              h(
                "div",
                { className: "pmtask-side-empty" },
                documentsReady ? "当前任务还没有产出文档。" : "暂无可用文档。",
              ),
            )
          : h(
              "div",
              { className: "pmtask-detail-doc-list" },
              ...latestDocuments.map(({ document, hiddenVersions }) => {
                const run = document.runId
                  ? runsById.get(document.runId)
                  : undefined;
                const producer = document.updatedBy || "AI伙伴";
                return h(
                  "article",
                  {
                    className: "pmtask-detail-doc",
                    key: document.id,
                  },
                  h(
                    "div",
                    { className: "pmtask-detail-doc-main" },
                    h(
                      "div",
                      { className: "pmtask-detail-doc-title" },
                      h("strong", { title: document.name }, document.name),
                      h(
                        "span",
                        { className: "pmtask-doc-kind" },
                        hiddenVersions > 0
                          ? `v${hiddenVersions + 1}`
                          : document.kind === "uploaded"
                            ? "上传"
                            : "产出",
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmtask-detail-doc-meta" },
                      h("span", null, producer),
                      run !== undefined || document.kind !== "uploaded"
                        ? h("span", { className: "pmtask-detail-doc-ai" }, "AI")
                        : null,
                      h("span", null, localTime(document.updatedAt)),
                      h(
                        "span",
                        null,
                        run
                          ? `第 ${run.roundNumber} 轮 · ${run.id}`
                          : document.runId || "任务级文档",
                      ),
                    ),
                  ),
                  h(
                    "button",
                    {
                      className: "pmtask-detail-doc-download",
                      type: "button",
                      disabled: !document.available,
                      title: document.available
                        ? `下载 ${document.name}`
                        : "该附件未存储到工作区",
                      "aria-label": `下载 ${document.name}`,
                      onClick: () => void downloadDocument(document),
                    },
                    h(
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
                      h("path", { d: "M12 3v12" }),
                      h("path", { d: "m7 10 5 5 5-5" }),
                      h("path", { d: "M5 21h14" }),
                    ),
                  ),
                );
              }),
              latestDocuments.reduce(
                (total, item) => total + item.hiddenVersions,
                0,
              ) > 0
                ? h(
                    "div",
                    { className: "pmtask-side-empty" },
                    `已合并 ${latestDocuments.reduce(
                      (total, item) => total + item.hiddenVersions,
                      0,
                    )} 个旧版本`,
                  )
                : null,
            ),
      );
      return h(
        "div",
        { className: "pmtask-detail" },
        h(
          "section",
          {
            className: "pmtask-detail-page",
            "data-data-agent-text-surface": "task-detail",
          },
          h(
            "div",
            { className: "pmtask-detail-top" },
            h(
              "button",
              {
                className: "pmtask-btn secondary pmtask-back-btn",
                type: "button",
                onClick: onBack,
              },
              "← 看板",
            ),
            h(
              "span",
              { className: "pmtask-crumb" },
              "任务 / ",
              h("b", null, `${task.id} ${task.title}`),
            ),
            h(
              "span",
              { className: "pmtask-detail-project-chip" },
              `项目 · ${workspaceTitle || task.workspaceId}`,
            ),
            h(TaskFollowButton, {
              taskId: task.id,
              compact: true,
              workspaceId: task.workspaceId,
              workflowInstanceId: task.workflow?.instanceId,
            }),
            h(
              "div",
              { className: "pmtask-detail-top-actions" },
              renderActions?.() ?? null,
            ),
            h(
              "div",
              { className: "pmtask-menu pmtask-assign-select" },
              h(
                "button",
                {
                  className: `pmtask-assign-trigger${pendingAssignee === null ? "" : " pending"}`,
                  type: "button",
                  disabled: readOnly,
                  title: archived
                    ? "任务已归档，复原后可调整责任人"
                    : task.status === "cancelled"
                      ? "任务已取消，不可调整责任人"
                      : "调整责任人",
                  "aria-haspopup": "listbox",
                  "aria-expanded": assignOpen,
                  onClick: () => {
                    if (readOnly) return;
                    setAssignOpen(!assignOpen);
                  },
                },
                h(
                  "span",
                  { className: "pmtask-assign-trigger-content" },
                  h(
                    "span",
                    { className: "pmtask-assign-trigger-copy" },
                    `${previewLabel}${pendingAssignee === null ? "" : "（待确认）"}`,
                  ),
                ),
                h("span", { "aria-hidden": "true" }, "⌄"),
              ),
              assignOpen && !readOnly
                ? h(
                    "div",
                    { className: "pmtask-menu-list" },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmtask-receiver-option",
                        onClick: () => chooseAssignee("unassigned", ""),
                      },
                      h(
                        "span",
                        { className: "pmtask-receiver-option-copy" },
                        h(
                          "span",
                          { className: "pmtask-receiver-option-name" },
                          "待指派",
                        ),
                      ),
                    ),
                    ...directoryOptions.map((item) =>
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pmtask-receiver-option",
                          key: `${item.type}:${item.id}`,
                          onClick: () => chooseAssignee(item.type, item.id),
                        },
                        h(
                          "span",
                          { className: "pmtask-receiver-option-copy" },
                          h(
                            "span",
                            { className: "pmtask-receiver-option-name" },
                            receiverOptionLabel(item),
                          ),
                          h(
                            "span",
                            { className: "pmtask-receiver-option-meta" },
                            receiverKindLabel(item.type),
                          ),
                        ),
                      ),
                    ),
                  )
                : null,
            ),
            h(
              "div",
              { className: "pmtask-assign-actions" },
              pendingAssignee !== null
                ? h(
                    "button",
                    {
                      className: "pmtask-btn pmtask-confirm-btn",
                      type: "button",
                      onClick: confirmAssignee,
                    },
                    "确认",
                  )
                : null,
            ),
          ),
          h(
            "div",
            { className: "pmtask-detail-layout" },
            h(
              "div",
              { className: "pmtask-detail-main" },
              editing
                ? null
                : h(
                    "div",
                    { className: "pmtask-intro", hidden: true },
                    h(
                      "span",
                      { className: "pmtask-detail-requirement-label" },
                      "任务要求",
                    ),
                    h(
                      "div",
                      { className: "pmtask-intro-head" },
                      h("h2", null, task.title),
                      h(
                        "span",
                        {
                          className: `pmtask-pill ${task.priority === "P1" ? "p1" : ""}`,
                        },
                        priorityLabel(task.priority),
                      ),
                      task.workflow !== undefined
                        ? h(
                            "span",
                            { className: "pmtask-pill workflow" },
                            workflowSourceLabel(task),
                          )
                        : null,
                      h(
                        "button",
                        {
                          className: "pmtask-icon-btn",
                          type: "button",
                          hidden: task.workflow !== undefined,
                          disabled: readOnly,
                          title: lockedTip ?? "编辑标题、优先级和描述",
                          "aria-label": lockedTip ?? "编辑标题、优先级和描述",
                          onClick: () => setEditing(true),
                        },
                        h(
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
                          h("path", { d: "M12 20h9" }),
                          h("path", {
                            d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
                          }),
                        ),
                      ),
                    ),
                    h("p", null, task.description),
                    h(
                      "div",
                      { className: "pmtask-grid pmtask-grid-demo" },
                      h(
                        "div",
                        { className: "pmtask-field" },
                        "归属项目",
                        h("strong", null, workspaceTitle || task.workspaceId),
                      ),
                      h(
                        "div",
                        { className: "pmtask-field" },
                        "责任人",
                        h(
                          "strong",
                          { className: "pmtask-assignee" },
                          h(
                            "span",
                            { className: "pmtask-assignee-name" },
                            receiverDisplay(task, directory),
                          ),
                        ),
                      ),
                      h(
                        "div",
                        { className: "pmtask-field" },
                        "创建人/创建时间",
                        h(
                          "strong",
                          { className: "pmtask-assignee" },
                          h(
                            "span",
                            { className: "pmtask-assignee-name" },
                            `${task.createdByName} · ${localTime(task.createdAt)}`,
                          ),
                        ),
                      ),
                      h(
                        "div",
                        { className: "pmtask-field" },
                        "优先级/到期时间",
                        h(
                          "strong",
                          null,
                          `${priorityLabel(task.priority)} · ${task.due || "不限"}`,
                        ),
                      ),
                      task.workflow?.approvalPolicy !== undefined
                        ? h(
                            "div",
                            { className: "pmtask-field" },
                            "审批规则",
                            h(
                              "strong",
                              null,
                              task.workflow.approvalPolicy === "any"
                                ? "或签（任一审批人通过即可）"
                                : "并签（全部审批人通过后才完成）",
                            ),
                          )
                        : null,
                      task.workflow !== undefined
                        ? h(
                            "div",
                            { className: "pmtask-field" },
                            "Review 策略",
                            h("strong", null, workflowReviewLabel(task)),
                          )
                        : task.receiverType === "agent"
                          ? h(
                              "div",
                              { className: "pmtask-field" },
                              "完成后自动提交Review",
                              h(
                                "strong",
                                null,
                                task.autoSubmitReview !== false
                                  ? "已开启"
                                  : "已关闭",
                              ),
                            )
                          : null,
                      task.workflow !== undefined
                        ? h(
                            "div",
                            { className: "pmtask-field" },
                            "工作流节点",
                            h(
                              "strong",
                              null,
                              `${task.workflow.nodeName}${task.workflow.nodeAttempt === undefined ? "" : ` · 第 ${task.workflow.nodeAttempt} 轮`}`,
                            ),
                          )
                        : null,
                      task.workflow?.outcome !== undefined
                        ? h(
                            "div",
                            { className: "pmtask-field" },
                            "工作流结论",
                            h(
                              "strong",
                              null,
                              {
                                approved: "已通过",
                                rejected: "已退回",
                                cancelled: "已取消",
                                superseded: "已被新一轮替代",
                              }[task.workflow.outcome] ?? task.workflow.outcome,
                            ),
                          )
                        : null,
                      task.workflow !== undefined &&
                        task.workflow.approvalPolicy === undefined
                        ? h(
                            "div",
                            { className: "pmtask-field pmtask-review-config" },
                            h(
                              "label",
                              { className: "pmtask-check" },
                              h("input", {
                                type: "checkbox",
                                checked: task.autoApproveReview === true,
                                disabled: readOnly || archived,
                                onChange: (event) => {
                                  const enabled = event.target.checked;
                                  void mutate(
                                    "/api/collab/tasks/review/approval",
                                    {
                                      taskId: task.id,
                                      autoApproveReview: enabled,
                                    },
                                    enabled
                                      ? "提交后将自动通过 Review"
                                      : "提交后将等待人工 Review",
                                  ).catch(fail);
                                },
                              }),
                              h(
                                "span",
                                null,
                                "提交后自动通过 Review",
                                h(
                                  "em",
                                  null,
                                  "适用于执行任务；审批任务必须保留明确结论。",
                                ),
                              ),
                            ),
                          )
                        : null,
                    ),
                    task.steps.length > 0
                      ? h(
                          "div",
                          { className: "pmtask-acceptance" },
                          h(
                            "div",
                            { className: "pmtask-acceptance-head" },
                            h("strong", null, "验收标准"),
                            h(
                              "span",
                              null,
                              `${task.steps.filter((step) => step.done).length} / ${task.steps.length} 已完成`,
                            ),
                          ),
                          h(
                            "div",
                            { className: "pmtask-steps" },
                            ...task.steps.map((step) => {
                              const locked =
                                readOnly || task.workflow !== undefined;
                              return h(
                                "label",
                                {
                                  className: `pmtask-step${step.done ? " done" : ""}${locked ? " disabled" : ""}`,
                                  key: step.id,
                                },
                                h("input", {
                                  type: "checkbox",
                                  checked: step.done,
                                  disabled: locked,
                                  onChange: (event) => {
                                    const done = event.target.checked;
                                    void mutate(
                                      "/api/collab/tasks/step",
                                      {
                                        taskId: task.id,
                                        stepId: step.id,
                                        done,
                                      },
                                      done ? "验收项已勾选" : "验收项已取消",
                                    ).catch(fail);
                                  },
                                }),
                                h("span", null, step.label),
                              );
                            }),
                          ),
                        )
                      : null,
                    archived
                      ? h(
                          "p",
                          { className: "pmtask-locked-hint" },
                          "任务已归档：内容、状态、回复与执行指令均已锁定，点「复原」后可继续操作。",
                        )
                      : task.status === "cancelled"
                        ? h(
                            "p",
                            { className: "pmtask-locked-hint" },
                            "任务已取消：内容、状态、回复与执行指令均已锁定；如需从看板收起，可执行「归档」。",
                          )
                        : null,
                    task.workflow !== undefined
                      ? h(
                          "div",
                          { className: "pmtask-workflow-action" },
                          h(
                            "div",
                            { className: "pmtask-workflow-action-copy" },
                            h("strong", null, "由工作流节点驱动"),
                            h("span", null, workflowActionCopy),
                          ),
                          h(
                            "div",
                            { className: "pmtask-workflow-action-buttons" },
                            h(
                              "button",
                              {
                                className: "pmtask-btn",
                                type: "button",
                                onClick: openWorkflow,
                              },
                              "打开工作流节点",
                            ),
                            isApprovalTask &&
                              canReview &&
                              task.status === "review"
                              ? h(
                                  "button",
                                  {
                                    className: "pmtask-btn secondary",
                                    type: "button",
                                    onClick: () =>
                                      void action("approve", "审批已通过"),
                                  },
                                  "通过审批",
                                )
                              : null,
                            isApprovalTask &&
                              canReview &&
                              task.status === "review"
                              ? h(
                                  "button",
                                  {
                                    className: "pmtask-btn secondary",
                                    type: "button",
                                    onClick: () => setRejectOpen(true),
                                  },
                                  "退回审批",
                                )
                              : null,
                            !archived && task.status === "cancelled"
                              ? h(
                                  "button",
                                  {
                                    className: "pmtask-btn secondary",
                                    type: "button",
                                    onClick: () => setConfirmArchive(true),
                                  },
                                  "归档",
                                )
                              : null,
                            archived
                              ? h(
                                  "button",
                                  {
                                    className: "pmtask-btn secondary",
                                    type: "button",
                                    onClick: () => void restoreTask(),
                                  },
                                  "复原",
                                )
                              : null,
                          ),
                        )
                      : h(
                          "div",
                          { className: "pmtask-actions" },
                          canClaim
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  disabled: readOnly,
                                  title: lockedTip,
                                  onClick: () =>
                                    void action("claim", "已认领任务"),
                                },
                                "认领",
                              )
                            : null,
                          mine &&
                            task.receiverType !== "role" &&
                            task.status === "todo"
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  disabled: readOnly,
                                  title: lockedTip,
                                  onClick: () =>
                                    void action("start", "任务已开始"),
                                },
                                "开始",
                              )
                            : null,
                          mine &&
                            task.status === "progress" &&
                            task.workflow?.approvalPolicy === undefined
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  disabled: readOnly,
                                  title: lockedTip,
                                  onClick: requestSubmitAcceptance,
                                },
                                "提交验收",
                              )
                            : null,
                          canReview &&
                            (task.status === "review" ||
                              (task.workflow?.approvalPolicy !== undefined &&
                                task.status === "progress"))
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  disabled: readOnly,
                                  title: lockedTip,
                                  onClick: () =>
                                    void action("approve", "任务已完成"),
                                },
                                isApprovalTask ? "通过审批" : "通过",
                              )
                            : null,
                          canReview &&
                            (task.status === "review" ||
                              (task.workflow?.approvalPolicy !== undefined &&
                                task.status === "progress"))
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  disabled: readOnly,
                                  title: lockedTip,
                                  onClick: () => setRejectOpen(true),
                                },
                                isApprovalTask ? "退回审批" : "退回",
                              )
                            : null,
                          canCommand &&
                            !isSettledStatus(task.status) &&
                            // 催办只针对「指派给人类」的任务：Agent 的推进靠指令/改派。
                            task.receiverType === "human"
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  disabled: readOnly,
                                  title: lockedTip,
                                  onClick: () =>
                                    void action("nudge", "已提醒责任人"),
                                },
                                "催办",
                              )
                            : null,
                          // 「重置会话」入口先隐藏：前期用户还不熟这个语义，
                          // 需要时把下面这个开关改回 true 即可（服务端能力保留）。
                          SHOW_SESSION_RESET &&
                            task.receiverType === "agent" &&
                            !readOnly
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  title:
                                    "另起一条新会话并重新注入完整任务上下文；旧会话保留为只读",
                                  onClick: () => void resetSession(),
                                },
                                "重置会话",
                              )
                            : null,
                          task.receiverType === "agent" ||
                            task.agentRunIds.length > 0
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  title:
                                    "打开这条任务对应的 Agent 执行会话（左侧项目下的那条会话）",
                                  onClick: () => void openAgentSession(),
                                },
                                "打开会话",
                              )
                            : null,
                          archived
                            ? h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  onClick: () => void restoreTask(),
                                },
                                "复原",
                              )
                            : h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  onClick: () => setConfirmArchive(true),
                                },
                                "归档",
                              ),
                        ),
                  ),
              composerLocked
                ? null
                : h(
                    "div",
                    { className: "pmtask-composer" },
                    h(
                      "div",
                      { className: "pmtask-composer-toolbar" },
                      h(
                        "button",
                        {
                          className: "pmtask-tool-btn",
                          type: "button",
                          disabled: composerLocked,
                          title: lockedTip ?? "插入表情",
                          "aria-label": "插入表情",
                          onClick: () => setMessage((current) => `${current}☺`),
                        },
                        "☺",
                      ),
                      h(
                        "label",
                        {
                          className: "pmtask-tool-btn",
                          title: isWorkflowTask
                            ? "讨论不支持上传；附件和交付物请在工作流节点提交"
                            : (lockedTip ?? "上传附件"),
                          style:
                            composerLocked ||
                            composerIntentValue === "discussion"
                              ? { opacity: 0.5, pointerEvents: "none" }
                              : undefined,
                          "aria-label": "上传附件",
                        },
                        h(
                          "svg",
                          {
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: 2,
                            strokeLinecap: "round",
                            "aria-hidden": "true",
                          },
                          h("path", {
                            d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48",
                          }),
                        ),
                        h("input", {
                          type: "file",
                          multiple: true,
                          hidden: true,
                          disabled:
                            composerLocked ||
                            composerIntentValue === "discussion",
                          onChange: (event) => {
                            const picked = Array.from(event.target.files ?? []);
                            event.target.value = "";
                            if (picked.length === 0) return;
                            setAttachments((current) => [
                              ...current,
                              ...picked,
                            ]);
                          },
                        }),
                      ),
                      h(
                        "button",
                        {
                          className: "pmtask-tool-btn",
                          type: "button",
                          disabled: composerLocked,
                          title: lockedTip ?? "插入 @ 提及",
                          "aria-haspopup": "listbox",
                          "aria-expanded": mentionOpen,
                          onClick: () => {
                            if (composerLocked) return;
                            setMentionQuery("");
                            setMentionOpen((value) => !value);
                          },
                        },
                        "@",
                      ),
                      mentionOpen
                        ? h(MentionMenu, {
                            directory: mentionDirectory,
                            query: mentionQuery,
                            onPick: insertMention,
                          })
                        : null,
                    ),
                    pickedMentions.length > 0
                      ? h(
                          "div",
                          { className: "pmtask-detail-sync-list" },
                          h("span", null, "同步"),
                          ...pickedMentions.map((item) =>
                            h(
                              "span",
                              {
                                className: "pmtask-detail-sync-chip",
                                key: `${item.type}:${item.id}`,
                              },
                              h("span", null, `@${item.name}`),
                              h(
                                "select",
                                {
                                  value: item.intent,
                                  disabled: readOnly,
                                  "aria-label": `${item.name} 的同步用途`,
                                  onChange: (event) =>
                                    setPickedMentions((current) =>
                                      current.map((candidate) =>
                                        candidate.type === item.type &&
                                        candidate.id === item.id
                                          ? {
                                              ...candidate,
                                              intent: event.target.value,
                                            }
                                          : candidate,
                                      ),
                                    ),
                                },
                                h("option", { value: "ask" }, "问询"),
                                h("option", { value: "notice" }, "周知"),
                                h("option", { value: "collaborate" }, "协作"),
                              ),
                              h(
                                "button",
                                {
                                  type: "button",
                                  disabled: readOnly,
                                  "aria-label": `移除同步 ${item.name}`,
                                  onClick: () =>
                                    setPickedMentions((current) =>
                                      current.filter(
                                        (candidate) =>
                                          candidate.type !== item.type ||
                                          candidate.id !== item.id,
                                      ),
                                    ),
                                },
                                "×",
                              ),
                            ),
                          ),
                        )
                      : null,
                    h("textarea", {
                      ref: messageRef,
                      className: "pmtask-composer-input",
                      rows: 4,
                      value: message,
                      readOnly: composerLocked,
                      placeholder: composerPlaceholder,
                      onChange: (event) => {
                        const value = event.target.value;
                        setMessage(value);
                        const cursor =
                          event.target.selectionStart ?? value.length;
                        const token = value
                          .slice(0, cursor)
                          .match(/@([^@\s]*)$/);
                        setMentionOpen(token !== null);
                        setMentionQuery(token?.[1] ?? "");
                      },
                      onKeyDown: (event) => {
                        if (
                          event.key === "Enter" &&
                          (event.metaKey || event.ctrlKey)
                        ) {
                          event.preventDefault();
                          void sendMessage();
                        }
                        if (event.key === "Escape") setMentionOpen(false);
                      },
                    }),
                    attachments.length > 0
                      ? h(
                          "div",
                          { className: "pmtask-attachments" },
                          ...attachments.map((file, index) =>
                            h(
                              "span",
                              {
                                className: "pmtask-attachment",
                                key: `${file.name}:${index}`,
                              },
                              "📎 ",
                              h("span", null, file.name),
                              h(
                                "button",
                                {
                                  type: "button",
                                  "aria-label": `移除附件 ${file.name}`,
                                  onClick: () =>
                                    setAttachments((current) =>
                                      current.filter(
                                        (_candidate, candidateIndex) =>
                                          candidateIndex !== index,
                                      ),
                                    ),
                                },
                                "×",
                              ),
                            ),
                          ),
                        )
                      : null,
                    h(
                      "div",
                      { className: "pmtask-detail-composer-foot" },
                      h(
                        "div",
                        {
                          className: `pmtask-detail-intent-group${isWorkflowTask ? " workflow" : ""}`,
                          role: "group",
                          "aria-label": "发送目的",
                        },
                        h(
                          "button",
                          {
                            className: `pmtask-detail-intent${composerIntentValue === "discussion" ? " active" : ""}`,
                            type: "button",
                            disabled: !canDiscuss,
                            onClick: () => setComposerIntent("discussion"),
                          },
                          h(
                            "svg",
                            {
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: 1.8,
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                              "aria-hidden": "true",
                            },
                            h("path", {
                              d: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-4-1L3 21l2-5a8.5 8.5 0 1 1 16-4.5Z",
                            }),
                          ),
                          "讨论",
                        ),
                        isWorkflowTask
                          ? null
                          : h(
                              "button",
                              {
                                className: `pmtask-detail-intent${composerIntentValue === "execution" ? " active" : ""}`,
                                type: "button",
                                disabled: !canExecute,
                                title: canExecute
                                  ? "发起指令并驱动任务推进"
                                  : commandLockReason,
                                onClick: () => {
                                  if (!canExecute) return;
                                  setComposerIntent("execution");
                                  setMentionOpen(false);
                                },
                              },
                              h(
                                "svg",
                                {
                                  viewBox: "0 0 24 24",
                                  fill: "none",
                                  stroke: "currentColor",
                                  strokeWidth: 1.8,
                                  strokeLinecap: "round",
                                  strokeLinejoin: "round",
                                  "aria-hidden": "true",
                                },
                                h("path", { d: "m22 2-7 20-4-9-9-4Z" }),
                                h("path", { d: "M22 2 11 13" }),
                              ),
                              "指令",
                            ),
                      ),
                      h(
                        "span",
                        {
                          className: `pmtask-detail-effect${isWorkflowTask ? " workflow" : ""}`,
                          "aria-live": "polite",
                        },
                        composerEffectText,
                      ),
                      h(
                        "div",
                        { className: "pmtask-detail-composer-actions" },
                        h(
                          "button",
                          {
                            className: "pmtask-btn secondary",
                            type: "button",
                            onClick: () => {
                              setMessage("");
                              setAttachments([]);
                              setPickedMentions([]);
                              setMentionOpen(false);
                            },
                          },
                          "清空",
                        ),
                        h(
                          "button",
                          {
                            className: "pmtask-btn",
                            type: "button",
                            disabled:
                              composerLocked ||
                              (message.trim() === "" &&
                                attachments.length === 0) ||
                              (composerIntentValue === "execution" &&
                                (task.receiverType === "unassigned" ||
                                  task.receiverType === "role")) ||
                              (composerIntentValue === "discussion" &&
                                attachments.length > 0) ||
                              (composerIntentValue === "discussion" &&
                                !canDiscuss) ||
                              pendingAssignee !== null,
                            title: composerHint,
                            onClick: () => void sendMessage(),
                          },
                          "发送",
                        ),
                      ),
                    ),
                  ),
              h(
                "div",
                {
                  className: "pmtask-detail-section pmtask-detail-conversation",
                  ref: historyRef,
                },
                h(
                  "div",
                  { className: "pmtask-history-head" },
                  h("h3", null, "执行历史"),
                  h(
                    "span",
                    null,
                    `${task.messages.length} 条交互记录 · 当前负责人 ${receiverDisplay(task, directory)}`,
                  ),
                ),
                h(
                  "div",
                  { className: "pmtask-history" },
                  ...history.map((entry) =>
                    entry.kind === "message"
                      ? h(
                          "article",
                          {
                            className: `pmtask-history-message${
                              entry.item.kind === "human" &&
                              entry.item.authorId === currentUser?.id
                                ? " is-mine"
                                : ""
                            }`,
                            key: `message:${entry.item.id}`,
                          },
                          historyAvatar(entry.item),
                          h(
                            "div",
                            { className: "pmtask-message-body" },
                            h(
                              "div",
                              { className: "pmtask-message-head" },
                              h(
                                "strong",
                                null,
                                entry.item.kind === "human" &&
                                  entry.item.authorId === currentUser?.id
                                  ? "我"
                                  : entry.item.authorName,
                              ),
                              entry.item.kind === "agent" &&
                                entry.item.runRole !== undefined
                                ? h(
                                    "span",
                                    {
                                      className: `pmtask-run-role ${entry.item.runRole}`,
                                    },
                                    runRoleLabel(entry.item.runRole),
                                  )
                                : null,
                              h(
                                "span",
                                null,
                                `${localTime(entry.item.at)}${entry.item.kind === "agent" ? " · Agent" : ""}${entry.item.replyToAuthorName ? ` · 回复 ${entry.item.replyToAuthorName}` : ""}`,
                              ),
                              entry.item.messageType === undefined
                                ? null
                                : h(
                                    "span",
                                    {
                                      className: `pmtask-detail-message-badge ${entry.item.messageType}`,
                                    },
                                    {
                                      instruction: "指令 · 驱动执行",
                                      feedback: "执行反馈",
                                      discussion: "讨论 · 仅记录",
                                      collaboration: "讨论 · @ AI 协作执行",
                                      "workflow-task": "工作流 · 节点任务",
                                      "workflow-discussion": "讨论",
                                      consensus: "关键共识 · 下轮同步",
                                      system: "系统",
                                    }[entry.item.messageType],
                                  ),
                              entry.item.isKeyConsensus
                                ? h(
                                    "span",
                                    { className: "pmtask-pill consensus" },
                                    "关键共识",
                                  )
                                : null,
                            ),
                            h(
                              "div",
                              { className: "pmtask-bubble" },
                              h(MarkdownText, { text: entry.item.content }),
                              ["queued", "running", "waiting_input"].includes(
                                entry.item.state,
                              )
                                ? h("span", {
                                    className: "pmtask-stream-caret",
                                  })
                                : null,
                            ),
                            entry.item.kind === "agent" &&
                            messageRunFeedback(entry.item.state) !== undefined
                              ? h(
                                  "span",
                                  {
                                    className: `pmtask-message-run-state ${messageRunFeedback(entry.item.state).kind}`,
                                  },
                                  messageRunFeedback(entry.item.state).label,
                                )
                              : null,
                            entry.item.attachments.length > 0
                              ? h(
                                  "div",
                                  { className: "pmtask-attachments" },
                                  ...entry.item.attachments.map((file) =>
                                    h(
                                      "span",
                                      {
                                        className: "pmtask-attachment",
                                        key: file.name,
                                      },
                                      "📎 ",
                                      h("span", null, file.name),
                                    ),
                                  ),
                                )
                              : null,
                          ),
                        )
                      : h(
                          "article",
                          {
                            className: "pmtask-history-event",
                            key: `event:${entry.event.id}`,
                          },
                          h("span", { className: "pmtask-event-avatar" }, "◉"),
                          h(
                            "div",
                            { className: "pmtask-event-copy" },
                            entry.event.kind === "workflow"
                              ? `${entry.event.actorName} ${entry.event.message}`
                              : entry.event.message,
                            h("time", null, localTime(entry.event.at)),
                          ),
                        ),
                  ),
                  ...typingParticipants.map((run) =>
                    h(
                      "div",
                      {
                        className: "pmtask-typing-row",
                        key: `typing:${run.participantId}`,
                        role: "status",
                        "aria-live": "polite",
                      },
                      historyAvatar({
                        kind: "agent",
                        authorId: run.participantId,
                        authorName: run.participantName,
                      }),
                      h(
                        "div",
                        { className: "pmtask-typing-bubble" },
                        h(
                          "span",
                          null,
                          run.status === "queued"
                            ? `${run.participantName} 已接收任务，准备执行`
                            : run.status === "waiting_input"
                              ? `${run.participantName} 等待补充信息`
                              : `${run.participantName} 正在输入`,
                        ),
                        h(
                          "span",
                          {
                            className: "pmtask-typing-dots",
                            "aria-hidden": "true",
                          },
                          h("i"),
                          h("i"),
                          h("i"),
                        ),
                      ),
                    ),
                  ),
                  history.length === 0
                    ? h(
                        "div",
                        { className: "pmtask-empty" },
                        "任务还没有回复记录。",
                      )
                    : null,
                ),
              ),
              h(
                "div",
                {
                  className: "pmtask-detail-section pmtask-detail-comments",
                },
                h("h3", null, "评论与回复"),
                h(
                  "div",
                  {
                    className:
                      "pmtask-comment-list pmtask-detail-legacy-comment-list",
                  },
                  ...task.comments.map((item) =>
                    h(
                      "article",
                      { className: "pmtask-history-comment", key: item.id },
                      h(
                        "div",
                        { className: "pmtask-message-head" },
                        h("strong", null, item.authorName),
                        h("span", null, localTime(item.at)),
                        item.isKeyConsensus
                          ? h(
                              "span",
                              { className: "pmtask-pill consensus" },
                              "关键共识",
                            )
                          : null,
                      ),
                      h("div", { className: "pmtask-bubble" }, item.content),
                      item.replies.length > 0
                        ? h(
                            "div",
                            { className: "pmtask-reply-list" },
                            ...item.replies.map((reply) =>
                              h(
                                "div",
                                { key: reply.id },
                                h(
                                  "div",
                                  { className: "pmtask-message-head" },
                                  h("strong", null, reply.authorName),
                                  h("span", null, localTime(reply.at)),
                                ),
                                h(
                                  "div",
                                  { className: "pmtask-bubble" },
                                  reply.content,
                                ),
                              ),
                            ),
                          )
                        : null,
                      h(
                        "form",
                        {
                          className: "pmtask-reply-form",
                          onSubmit: async (event) => {
                            event.preventDefault();
                            if (readOnly) return;
                            const content = (replyDrafts[item.id] ?? "").trim();
                            if (content === "") return;
                            try {
                              await mutate(
                                "/api/collab/tasks/comment/reply",
                                {
                                  taskId: task.id,
                                  commentId: item.id,
                                  content,
                                },
                                "回复已发送",
                              );
                              setReplyDrafts((current) => ({
                                ...current,
                                [item.id]: "",
                              }));
                            } catch (cause) {
                              fail(cause);
                            }
                          },
                        },
                        h("input", {
                          className: "pmtask-input",
                          value: replyDrafts[item.id] ?? "",
                          disabled: readOnly,
                          placeholder: `回复 ${item.authorName}（仅讨论，不触发执行）`,
                          onChange: (event) =>
                            setReplyDrafts((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            })),
                        }),
                        h(
                          "button",
                          {
                            className: "pmtask-btn secondary",
                            type: "submit",
                            disabled:
                              readOnly ||
                              (replyDrafts[item.id] ?? "").trim() === "",
                          },
                          "回复",
                        ),
                      ),
                    ),
                  ),
                  task.comments.length === 0
                    ? h("div", { className: "pmtask-empty" }, "还没有评论。")
                    : null,
                ),
                h(
                  "form",
                  {
                    className: "pmtask-comment-form",
                    onSubmit: async (event) => {
                      event.preventDefault();
                      if (readOnly) return;
                      const content = comment.trim();
                      if (content === "") return;
                      try {
                        await mutate(
                          "/api/collab/tasks/comment",
                          {
                            taskId: task.id,
                            content,
                            isKeyConsensus: commentIsConsensus,
                          },
                          "评论已添加",
                        );
                        setComment("");
                        setCommentIsConsensus(false);
                      } catch (cause) {
                        fail(cause);
                      }
                    },
                  },
                  h(
                    "p",
                    { className: "pmtask-comment-guide" },
                    "评论用于协作讨论，不会立即触发任务执行。勾选「关键共识」后，将在下次向 Agent 发送执行反馈时作为背景增量同步；普通评论和回复不会进入执行上下文。",
                  ),
                  h("input", {
                    className: "pmtask-input",
                    value: comment,
                    disabled: readOnly,
                    placeholder: commentPlaceholder,
                    onChange: (event) => setComment(event.target.value),
                  }),
                  h(
                    "button",
                    {
                      className: "pmtask-btn secondary",
                      type: "submit",
                      disabled: readOnly || comment.trim() === "",
                    },
                    "评论",
                  ),
                  h(
                    "label",
                    {
                      className: "pmtask-check pmtask-comment-consensus",
                      "data-disabled": readOnly,
                    },
                    h("input", {
                      type: "checkbox",
                      checked: commentIsConsensus,
                      disabled: readOnly,
                      "aria-label": "标记为关键共识",
                      onChange: (event) =>
                        setCommentIsConsensus(event.target.checked),
                    }),
                    h(
                      "span",
                      { className: "pmtask-comment-consensus-copy" },
                      h("span", null, "关键共识"),
                      h(
                        "em",
                        null,
                        "仅标记已经确认的决策、约束或结论，不标记个人提议。",
                      ),
                    ),
                  ),
                ),
              ),
            ),
            h(
              "aside",
              { className: "pmtask-detail-side" },
              renderVisibleSlot(renderSlot, "pluginmax.task.detail.extension", {
                taskId: task.id,
                workspaceId: task.workspaceId,
              }),
              h(
                "div",
                { className: "pmtask-detail-extension", hidden: true },
                renderSlot?.("pluginmax.task.detail.capture-origin", {
                  taskId: task.id,
                  workspaceId: task.workspaceId,
                }) ?? null,
              ),
              editing
                ? h(TaskContentEditForm, {
                    task,
                    onCancel: () => setEditing(false),
                    onSave: async (input) => {
                      try {
                        await mutate(
                          "/api/collab/tasks/update",
                          { taskId: task.id, ...input },
                          task.status === "done"
                            ? "已追加要求并重新开启任务"
                            : "任务内容已更新",
                        );
                        setEditing(false);
                      } catch (cause) {
                        fail(cause);
                      }
                    },
                  })
                : h(
                    "header",
                    { className: "pmtask-detail-side-head" },
                    h(
                      "div",
                      { className: "pmtask-detail-side-title" },
                      h("h2", null, task.title),
                      h(
                        "span",
                        { className: `pmtask-pill ${task.status}` },
                        statusLabel(task.status),
                      ),
                      h(
                        "button",
                        {
                          className: "pmtask-icon-btn",
                          type: "button",
                          hidden: task.workflow !== undefined,
                          disabled: readOnly,
                          title: lockedTip ?? "编辑任务名称和描述",
                          "aria-label": lockedTip ?? "编辑任务名称和描述",
                          onClick: () => {
                            setBasicEditing(false);
                            setEditing(true);
                          },
                        },
                        h(
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
                          h("path", { d: "M12 20h9" }),
                          h("path", {
                            d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
                          }),
                        ),
                      ),
                    ),
                    h(
                      "p",
                      { className: "pmtask-detail-side-desc" },
                      task.description,
                    ),
                    detailActions.length === 0 && !showOpenSession
                      ? null
                      : h(
                          "div",
                          { className: "pmtask-detail-actions" },
                          ...detailActions,
                          showOpenSession
                            ? h(
                                "button",
                                {
                                  className: "pmtask-detail-session-link",
                                  type: "button",
                                  onClick: () => void openAgentSession(),
                                },
                                "打开会话",
                              )
                            : null,
                        ),
                  ),
              editing
                ? null
                : h(
                    "div",
                    {
                      className: "pmtask-detail-tabs",
                      role: "tablist",
                      "aria-label": "任务信息视图",
                    },
                    ...[
                      ["basic", "基础信息"],
                      ["execution", "AI执行记录"],
                      ["documents", "产出文档"],
                      ["activity", "任务动态"],
                    ].map(([key, label]) =>
                      h(
                        "button",
                        {
                          className: `pmtask-detail-tab${activeTab === key ? " active" : ""}`,
                          type: "button",
                          role: "tab",
                          key,
                          "aria-selected": activeTab === key,
                          onClick: () => selectDetailTab(key),
                        },
                        label,
                      ),
                    ),
                  ),
              editing
                ? null
                : h(
                    "div",
                    { className: "pmtask-detail-side-scroll" },
                    activeTab === "basic" ? basicPane : null,
                    activeTab === "documents" ? documentsPane : null,
                    h(
                      "div",
                      {
                        className:
                          "pmtask-side-section pmtask-detail-legacy-links",
                      },
                      h("h3", null, "关联事项"),
                      ...(task.links.length === 0
                        ? [
                            h(
                              "div",
                              { className: "pmtask-side-empty" },
                              "未关联会议或工作流。",
                            ),
                          ]
                        : task.links.map((link) =>
                            h(
                              "div",
                              {
                                className: "pmtask-link",
                                key: `${link.type}:${link.id}`,
                              },
                              h(
                                "div",
                                null,
                                h(
                                  "small",
                                  null,
                                  link.type === "meeting" ? "会议" : "工作流",
                                ),
                                h("div", null, h("strong", null, link.label)),
                              ),
                              h(
                                "button",
                                {
                                  className: "pmtask-btn secondary",
                                  type: "button",
                                  onClick: () => {
                                    window.__pluginmaxShell?.setRoute(
                                      link.type === "meeting"
                                        ? "meeting"
                                        : "workflow",
                                    );
                                    window.dispatchEvent(
                                      new CustomEvent(
                                        "pluginmax:collab-navigate",
                                        {
                                          detail:
                                            link.type === "meeting"
                                              ? {
                                                  plugin: "meeting",
                                                  meetingId: link.id,
                                                  workspaceId: task.workspaceId,
                                                }
                                              : {
                                                  plugin: "workflow",
                                                  instanceId: link.id,
                                                  workspaceId: task.workspaceId,
                                                },
                                        },
                                      ),
                                    );
                                  },
                                },
                                link.type === "meeting"
                                  ? "打开会议"
                                  : "打开工作流",
                              ),
                            ),
                          )),
                    ),
                    activeTab === "execution"
                      ? h(
                          "div",
                          {
                            className:
                              "pmtask-side-section pmtask-execution-record",
                          },
                          h(
                            "div",
                            { className: "pmtask-live-head" },
                            executionRunning
                              ? h("span", {
                                  className: "pmtask-spinner",
                                  role: "status",
                                  "aria-label": "正在执行",
                                })
                              : executionStatus === "cancelled"
                                ? h("span", {
                                    className: "pmtask-run-state cancelled",
                                    role: "status",
                                    title: "执行已停止",
                                    "aria-label": "执行已停止",
                                  })
                                : ["failed", "timeout"].includes(
                                      executionStatus,
                                    )
                                  ? h("span", {
                                      className: "pmtask-run-state failed",
                                      role: "status",
                                      title: "执行未完成",
                                      "aria-label": "执行未完成",
                                    })
                                  : executionStatus === "interrupted"
                                    ? h("span", {
                                        className:
                                          "pmtask-run-state interrupted",
                                        role: "status",
                                        title: "执行已中断",
                                        "aria-label": "执行已中断",
                                      })
                              : h("span", { className: "pmtask-live-dot" }),
                            h("h3", null, "AI执行记录"),
                            h(
                              "span",
                              { className: "pmtask-side-empty" },
                              executionRunOptions.length === 0
                                ? "暂无"
                                : `${executionRunOptions.length} 轮`,
                            ),
                            (canCommand || canReview) &&
                            activeExecutionRuns.length > 0
                              ? h(
                                  "button",
                                  {
                                    className: "pmtask-execution-stop",
                                    type: "button",
                                    disabled: stoppingExecution,
                                    title: `停止当前任务中 ${activeExecutionRuns.length} 个正在执行的 AI 伙伴`,
                                    onClick: () => void stopAllExecution(),
                                  },
                                  stoppingExecution
                                    ? "停止中…"
                                    : "停止执行",
                                )
                              : null,
                          ),
                          executionRunOptions.length === 0
                            ? h(
                                "div",
                                { className: "pmtask-side-empty" },
                                "暂无执行记录",
                              )
                            : [
                                h(
                                  "div",
                                  {
                                    className: "pmtask-execution-runs",
                                  },
                                  h(
                                    "div",
                                    {
                                      className:
                                        "pmtask-execution-round-picker",
                                    },
                                    h(
                                      "button",
                                      {
                                        className:
                                          "pmtask-execution-round-trigger",
                                        type: "button",
                                        "aria-expanded": roundMenuOpen,
                                        "aria-controls": `pmtask-round-menu-${task.id}`,
                                        onClick: () =>
                                          setRoundMenuOpen(
                                            (current) => !current,
                                          ),
                                        onKeyDown: (event) => {
                                          if (event.key === "Escape") {
                                            setRoundMenuOpen(false);
                                          }
                                        },
                                      },
                                      h(
                                        "span",
                                        null,
                                        `第 ${selectedRunOption?.roundNumber ?? 1} 轮 · ${selectedRunOption?.participantName ?? "AI伙伴"} · ${runStatusLabel(executionStatus)}`,
                                      ),
                                      selectedRunOption === undefined
                                        ? null
                                        : h(
                                            "time",
                                            {
                                              className:
                                                "pmtask-execution-round-trigger-time",
                                              dateTime:
                                                selectedRunOption.instructionAt,
                                              title: "指令发送时间",
                                            },
                                            localTime(
                                              selectedRunOption.instructionAt,
                                            ),
                                          ),
                                      h("span", {
                                        className: "pmtask-round-caret",
                                        "aria-hidden": "true",
                                      }),
                                    ),
                                    roundMenuOpen
                                      ? h(
                                          "div",
                                          {
                                            id: `pmtask-round-menu-${task.id}`,
                                            className:
                                              "pmtask-execution-round-menu",
                                            role: "group",
                                            "aria-label": "轮次与指令",
                                          },
                                          ...executionRunOptions.map((run) => {
                                            const selected =
                                              run.id === selectedRunId;
                                            const instructionExpanded =
                                              expandedRoundInstructionIds.includes(
                                                run.id,
                                              );
                                            const selectRun = () => {
                                              setSelectedRunId(run.id);
                                              setRoundMenuOpen(false);
                                            };
                                            return h(
                                              "div",
                                              {
                                                className: `pmtask-execution-round-option${selected ? " selected" : ""}`,
                                                key: run.id,
                                                onClick: selectRun,
                                              },
                                              h(
                                                "button",
                                                {
                                                  className:
                                                    "pmtask-execution-round-option-head",
                                                  type: "button",
                                                  "data-run-id": run.id,
                                                  "aria-pressed": selected,
                                                  onClick: (event) => {
                                                    event.stopPropagation();
                                                    selectRun();
                                                  },
                                                },
                                                h(
                                                  "span",
                                                  {
                                                    className:
                                                      "pmtask-execution-round-option-title",
                                                  },
                                                  `第 ${run.roundNumber} 轮 · ${run.participantName}`,
                                                  h(
                                                    "span",
                                                    {
                                                      className:
                                                        "pmtask-execution-round-option-status",
                                                    },
                                                    ` · ${runStatusLabel(run.status)}`,
                                                  ),
                                                ),
                                                h(
                                                  "time",
                                                  {
                                                    className:
                                                      "pmtask-execution-round-option-time",
                                                    dateTime: run.instructionAt,
                                                    title: "指令发送时间",
                                                  },
                                                  localTime(run.instructionAt),
                                                ),
                                              ),
                                              h(ExecutionRoundInstruction, {
                                                instruction: run.instruction,
                                                expanded: instructionExpanded,
                                                onToggle: () =>
                                                  toggleRoundInstruction(
                                                    run.id,
                                                  ),
                                              }),
                                            );
                                          }),
                                        )
                                      : null,
                                    !roundMenuOpen &&
                                      selectedRunOption !== undefined
                                      ? h(ExecutionRoundInstruction, {
                                          instruction:
                                            selectedRunOption.instruction,
                                          expanded:
                                            expandedRoundInstructionIds.includes(
                                              selectedRunOption.id,
                                            ),
                                          onToggle: () =>
                                            toggleRoundInstruction(
                                              selectedRunOption.id,
                                            ),
                                          extraClassName:
                                            "pmtask-selected-round-instruction",
                                        })
                                      : null,
                                  ),
                                ),
                                h(
                                  "div",
                                  { className: "pmtask-execution-blocks" },
                                  h(
                                    "section",
                                    { className: "pmtask-execution-block" },
                                    h(
                                      "h4",
                                      null,
                                      "产出物",
                                      h(
                                        "span",
                                        null,
                                        visibleRunDocuments.length === 0
                                          ? ""
                                          : `${visibleRunDocuments.length}`,
                                      ),
                                    ),
                                    visibleRunDocuments.length === 0
                                      ? h(
                                          "div",
                                          { className: "pmtask-doc-empty" },
                                          documentsReady
                                            ? "本轮暂无产出物"
                                            : "任务工作区不可用",
                                        )
                                      : h(
                                          "div",
                                          { className: "pmtask-doc-list" },
                                          ...visibleRunDocuments.map(
                                            (document) =>
                                              h(
                                                "div",
                                                {
                                                  className: "pmtask-doc",
                                                  key: document.id,
                                                },
                                                h(
                                                  "div",
                                                  {
                                                    className:
                                                      "pmtask-doc-info",
                                                  },
                                                  h(
                                                    "button",
                                                    {
                                                      className:
                                                        "pmtask-doc-name",
                                                      type: "button",
                                                      disabled:
                                                        !document.available,
                                                      title: document.available
                                                        ? `下载 ${document.name}`
                                                        : "该附件未存储到工作区",
                                                      onClick: () =>
                                                        void downloadDocument(
                                                          document,
                                                        ),
                                                    },
                                                    h(
                                                      "span",
                                                      {
                                                        className:
                                                          "pmtask-doc-kind",
                                                      },
                                                      document.kind ===
                                                        "uploaded"
                                                        ? "上传"
                                                        : "产出",
                                                    ),
                                                    h(
                                                      "span",
                                                      null,
                                                      document.name,
                                                    ),
                                                  ),
                                                  h(
                                                    "div",
                                                    {
                                                      className:
                                                        "pmtask-doc-meta",
                                                    },
                                                    `${document.updatedBy} · ${localTime(document.updatedAt)}`,
                                                  ),
                                                ),
                                                document.available
                                                  ? h(
                                                      "button",
                                                      {
                                                        className:
                                                          "pmtask-tool-btn",
                                                        type: "button",
                                                        title:
                                                          "在本地文件夹中显示",
                                                        "aria-label":
                                                          "在本地文件夹中显示",
                                                        onClick: () =>
                                                          void revealDocument(
                                                            document,
                                                          ),
                                                      },
                                                      h(
                                                        "svg",
                                                        {
                                                          viewBox: "0 0 24 24",
                                                          fill: "none",
                                                          stroke:
                                                            "currentColor",
                                                          strokeWidth: 2,
                                                          strokeLinecap:
                                                            "round",
                                                          strokeLinejoin:
                                                            "round",
                                                          "aria-hidden": "true",
                                                        },
                                                        h("path", {
                                                          d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
                                                        }),
                                                      ),
                                                    )
                                                  : null,
                                              ),
                                          ),
                                        ),
                                  ),
                                  h(
                                    "section",
                                    { className: "pmtask-execution-block" },
                                    h(
                                      "h4",
                                      null,
                                      "执行过程",
                                      h(
                                        "span",
                                        null,
                                        runStatusLabel(executionStatus),
                                      ),
                                    ),
                                    h(
                                      "div",
                                      {
                                        className: "pmtask-live-output",
                                        ref: liveOutputRef,
                                      },
                                      h(MarkdownText, { text: executionText }),
                                    ),
                                  ),
                                  h(
                                    "section",
                                    { className: "pmtask-execution-block" },
                                    h("h4", null, "Agent 执行计划"),
                                    selectedExecution?.gateEnforcement ===
                                      "observe-only"
                                      ? h(
                                          "p",
                                          { className: "pmtask-locked-hint" },
                                          "仅执行后观察：Runtime 只能记录已执行动作，无法事前阻断。",
                                        )
                                      : null,
                                    pendingExecutionGates.length === 0
                                      ? null
                                      : h(
                                          "div",
                                          { className: "pmtask-gate" },
                                          h("strong", null, "等待执行授权"),
                                          h(
                                            "p",
                                            null,
                                            pendingExecutionGates[0].reason,
                                          ),
                                          h(
                                            "div",
                                            {
                                              className: "pmtask-gate-actions",
                                            },
                                            h(
                                              "button",
                                              {
                                                className: "pmtask-btn",
                                                type: "button",
                                                onClick: () =>
                                                  void decideExecutionGate(
                                                    pendingExecutionGates[0].id,
                                                    "approved",
                                                  ),
                                              },
                                              "批准",
                                            ),
                                            h(
                                              "button",
                                              {
                                                className:
                                                  "pmtask-btn secondary danger",
                                                type: "button",
                                                onClick: () =>
                                                  void decideExecutionGate(
                                                    pendingExecutionGates[0].id,
                                                    "denied",
                                                  ),
                                              },
                                              "拒绝",
                                            ),
                                          ),
                                        ),
                                    selectedPlan === null
                                      ? h(
                                          "div",
                                          { className: "pmtask-side-empty" },
                                          "当前 Run 尚未产生 Agent Execution Plan。",
                                        )
                                      : [
                                          h(
                                            "ol",
                                            { className: "pmtask-plan-list" },
                                            ...(selectedPlan.steps ?? []).map(
                                              (step) =>
                                                h(
                                                  "li",
                                                  {
                                                    className: `pmtask-plan-step ${step.status}`,
                                                    key: step.id,
                                                  },
                                                  h("span", {
                                                    className:
                                                      "pmtask-plan-step-dot",
                                                    "aria-hidden": "true",
                                                  }),
                                                  h(
                                                    "span",
                                                    {
                                                      className:
                                                        "pmtask-plan-step-title",
                                                    },
                                                    step.title,
                                                    step.detail
                                                      ? h(
                                                          "small",
                                                          null,
                                                          step.detail,
                                                        )
                                                      : null,
                                                  ),
                                                  h(
                                                    "span",
                                                    {
                                                      className:
                                                        "pmtask-plan-step-status",
                                                    },
                                                    runStatusLabel(step.status),
                                                  ),
                                                ),
                                            ),
                                          ),
                                          selectedExecutionEvents.length === 0
                                            ? null
                                            : h(
                                                "ul",
                                                {
                                                  className:
                                                    "pmtask-execution-events",
                                                },
                                                ...selectedExecutionEvents.map(
                                                  (item) =>
                                                    h(
                                                      "li",
                                                      {
                                                        className:
                                                          "pmtask-execution-event",
                                                        key: item.id,
                                                      },
                                                      h(
                                                        "strong",
                                                        null,
                                                        item.summary,
                                                      ),
                                                      h(
                                                        "time",
                                                        {
                                                          dateTime:
                                                            item.createdAt,
                                                        },
                                                        localTime(
                                                          item.createdAt,
                                                        ),
                                                      ),
                                                    ),
                                                ),
                                              ),
                                        ],
                                  ),
                                  h(
                                    "section",
                                    { className: "pmtask-execution-block" },
                                    h(
                                      "h4",
                                      null,
                                      "运行信息",
                                      h(
                                        "span",
                                        null,
                                        selectedParticipant?.name ?? "AI伙伴",
                                      ),
                                    ),
                                    h(RunExecutionSummary, {
                                      execution: selectedExecution,
                                      state: executionSummaryState,
                                    }),
                                  ),
                                ),
                              ],
                        )
                      : null,
                    activeTab === "activity"
                      ? h(
                          "div",
                          { className: "pmtask-side-section" },
                          h("h3", null, "任务动态"),
                          h(
                            "div",
                            { className: "pmtask-timeline" },
                            ...task.events
                              .slice()
                              .reverse()
                              .map((event) =>
                                h(
                                  "div",
                                  {
                                    className: "pmtask-timeline-event",
                                    key: event.id,
                                  },
                                  h("time", null, localTime(event.at)),
                                  h("span", null, event.message),
                                ),
                              ),
                          ),
                        )
                      : null,
                  ),
            ),
          ),
          submitAcceptanceOpen
            ? h(SubmitAcceptanceDialog, {
                steps: task.steps,
                requireAll: task.autoSubmitReview === false,
                onCancel: () => setSubmitAcceptanceOpen(false),
                onConfirm: (completedStepIds) => {
                  setSubmitAcceptanceOpen(false);
                  void action("submit", "已提交验收", {
                    completedStepIds,
                  });
                },
              })
            : null,
          confirmArchive
            ? h(ConfirmDialog, {
                title: "归档该任务？",
                description: `归档后「${task.title}」将从任务看板移入归档视图，执行历史、评论与验收记录都会保留，之后可以随时复原。`,
                confirmLabel: "确认归档",
                tone: "danger",
                onCancel: () => setConfirmArchive(false),
                onConfirm: () => {
                  setConfirmArchive(false);
                  void archiveTask();
                },
              })
            : null,
          rejectOpen
            ? h(RejectDialog, {
                title: isApprovalTask ? "退回审批" : "退回任务",
                onCancel: () => setRejectOpen(false),
                onConfirm: (note) => {
                  setRejectOpen(false);
                  void action(
                    "reject",
                    isApprovalTask ? "审批已退回" : "已退回",
                    { note },
                  );
                },
              })
            : null,
        ),
      );
    }

    function EditTaskForm({
      task,
      workspaceTitle,
      directory,
      externalRuntimes,
      onCancel,
      onSave,
    }) {
      const initialPolicy = executionPolicyForm(task);
      const responsibleAgent =
        task.receiverType === "agent"
          ? (directory?.agents ?? []).find(
              (agent) => agent.id === task.receiverId,
            )
          : undefined;
      const boundRuntimeId =
        initialPolicy.runtimeId !== ""
          ? initialPolicy.runtimeId
          : responsibleAgent?.execution === "external"
            ? (responsibleAgent.externalRuntimeId ?? "")
            : "";
      const [form, setForm] = react.useState({
        title: task.title,
        priority: task.priority,
        description: task.description,
        acceptance: task.acceptance.join("\n"),
        due: task.due ?? "",
        autoSubmitReview: task.autoSubmitReview !== false,
        ...initialPolicy,
        runtimeId: boundRuntimeId,
        model: boundRuntimeId === "" ? "" : initialPolicy.model,
        reasoningEffort:
          boundRuntimeId === "" ? "" : initialPolicy.reasoningEffort,
      });
      const selectedRuntime = runtimeForAgent(
        responsibleAgent,
        form.runtimeId,
        externalRuntimes,
      );
      const runtimeDisplayValue =
        selectedRuntime?.name ??
        (boundRuntimeId !== ""
          ? boundRuntimeId
          : responsibleAgent === undefined
            ? "未指派 AI伙伴"
            : responsibleAgent.execution === "external"
              ? (responsibleAgent.externalRuntimeId ?? "外部 Runtime 未绑定")
              : "内置执行");
      const runtimeDisplayHint =
        selectedRuntime?.status === "active"
          ? "来自任务执行 AI伙伴定义，任务内不可修改。"
          : selectedRuntime !== undefined
            ? "该 Runtime 当前不可用。"
            : boundRuntimeId !== ""
              ? "该 Runtime 不存在或已归档。"
              : responsibleAgent === undefined
                ? "运行时会随责任 AI伙伴自动确定。"
                : "来自 AI伙伴定义，任务内不可修改。";
      const modelChoices = [
        ...new Set([
          ...(selectedRuntime?.supportedModels ?? []),
          ...(selectedRuntime?.defaultModel === undefined
            ? []
            : [selectedRuntime.defaultModel]),
        ]),
      ];
      return h(
        "form",
        {
          className: "pmtask-intro pmtask-edit-form",
          onSubmit: (event) => {
            event.preventDefault();
            void onSave({
              title: form.title.trim(),
              priority: form.priority,
              description: form.description.trim(),
              acceptance: form.acceptance
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
              due: form.due || undefined,
              executionPolicy: buildExecutionPolicy(form),
              ...(task.receiverType === "agent" || task.workflow !== undefined
                ? { autoSubmitReview: form.autoSubmitReview }
                : {}),
            });
          },
        },
        // 归属项目在这里只读展示：任务创建后不允许变更项目。
        h(
          "div",
          { className: "pmtask-field pmtask-edit-locked" },
          "归属项目",
          h(
            "strong",
            null,
            `${workspaceTitle || task.workspaceId}（创建后不可变更）`,
          ),
        ),
        h(
          "div",
          { className: "pmtask-edit-title-row" },
          h(
            "label",
            { className: "pmtask-field pmtask-edit-grow" },
            "标题",
            h("input", {
              className: "pmtask-input",
              value: form.title,
              required: true,
              onChange: (event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                })),
            }),
          ),
          h(
            "label",
            { className: "pmtask-field pmtask-edit-priority" },
            "优先级",
            h(
              "select",
              {
                className: "pmtask-select",
                value: form.priority,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  })),
              },
              h("option", { value: "P1" }, "P0"),
              h("option", { value: "P2" }, "P1"),
              h("option", { value: "P3" }, "P2"),
            ),
          ),
        ),
        h(
          "label",
          { className: "pmtask-field" },
          "描述",
          h("textarea", {
            className: "pmtask-area",
            rows: 5,
            value: form.description,
            required: true,
            placeholder: "补充背景、期望结果、边界和风险。",
            onChange: (event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              })),
          }),
        ),
        h(
          "label",
          { className: "pmtask-field" },
          "验收标准（每行一条）",
          h("textarea", {
            className: "pmtask-area",
            rows: 4,
            value: form.acceptance,
            placeholder: "例如：必须有 md 文档输出",
            onChange: (event) =>
              setForm((current) => ({
                ...current,
                acceptance: event.target.value,
              })),
          }),
        ),
        h(
          "label",
          { className: "pmtask-field" },
          "到期时间",
          h("input", {
            className: "pmtask-input",
            type: "date",
            value: form.due,
            onChange: (event) =>
              setForm((current) => ({ ...current, due: event.target.value })),
          }),
        ),
        h(
          "div",
          { className: "pmtask-field" },
          "执行策略",
          h(
            "label",
            { className: "pmtask-check" },
            h("input", {
              type: "checkbox",
              checked: form.allowPublicWeb,
              onChange: (event) =>
                setForm((current) => ({
                  ...current,
                  allowPublicWeb: event.target.checked,
                })),
            }),
            h(
              "span",
              null,
              "允许公开网页与监管文件",
              h(
                "em",
                null,
                "启用后要求事实性结论记录来源、发布日期和访问时间。",
              ),
            ),
          ),
          h(
            "label",
            { className: "pmtask-check" },
            h("input", {
              type: "checkbox",
              checked: form.requireToolApproval,
              onChange: (event) =>
                setForm((current) => ({
                  ...current,
                  requireToolApproval: event.target.checked,
                })),
            }),
            h("span", null, "写文件、执行命令和外部发布前需要人工确认"),
          ),
          h(
            "label",
            { className: "pmtask-check" },
            h("input", {
              type: "checkbox",
              checked: form.requireToolEvents,
              onChange: (event) =>
                setForm((current) => ({
                  ...current,
                  requireToolEvents: event.target.checked,
                })),
            }),
            h("span", null, "要求记录实际工具调用事件"),
          ),
          h(
            "div",
            { className: "pmtask-execution-overrides" },
            h(
              "div",
              { className: "pmtask-field" },
              "执行运行时（只读）",
              h(
                "div",
                {
                  className: "pmtask-execution-runtime",
                  role: "textbox",
                  "aria-readonly": "true",
                },
                h("span", null, runtimeDisplayValue),
                h("span", { className: "pmtask-readonly-badge" }, "只读"),
              ),
              h(
                "span",
                { className: "pmtask-locked-hint" },
                runtimeDisplayHint,
              ),
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "本轮模型",
              h(
                "select",
                {
                  className: "pmtask-select",
                  value: form.model,
                  disabled:
                    selectedRuntime === undefined ||
                    selectedRuntime.status !== "active",
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      model: event.target.value,
                    })),
                },
                h(
                  "option",
                  { value: "" },
                  selectedRuntime?.defaultModel
                    ? `Runtime 默认（${selectedRuntime.defaultModel}）`
                    : "沿用 Runtime 默认模型",
                ),
                ...modelChoices.map((model) =>
                  h("option", { value: model, key: model }, model),
                ),
              ),
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "推理强度",
              h(
                "select",
                {
                  className: "pmtask-select",
                  value: form.reasoningEffort,
                  disabled:
                    selectedRuntime === undefined ||
                    selectedRuntime.status !== "active",
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      reasoningEffort: event.target.value,
                    })),
                },
                h("option", { value: "" }, "沿用 Runtime 默认值"),
                ...REASONING_EFFORT_OPTIONS.map((option) =>
                  h(
                    "option",
                    { value: option.value, key: option.value },
                    option.label,
                  ),
                ),
              ),
            ),
          ),
        ),
        task.receiverType === "agent" && task.workflow === undefined
          ? h(
              "label",
              { className: "pmtask-check" },
              h("input", {
                type: "checkbox",
                checked: form.autoSubmitReview,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    autoSubmitReview: event.target.checked,
                  })),
              }),
              h(
                "span",
                null,
                "Agent 完成指定产出物后，自动将任务状态调整为「待Review」",
                h(
                  "em",
                  null,
                  "默认勾选：完成后即提交 review。取消勾选则保留在执行中，由人工手动提交验收。",
                ),
              ),
            )
          : null,
        h(
          "div",
          { className: "pmtask-compose-actions" },
          h(
            "button",
            {
              className: "pmtask-btn secondary",
              type: "button",
              onClick: onCancel,
            },
            "取消",
          ),
          h(
            "button",
            {
              className: "pmtask-btn",
              type: "submit",
              disabled:
                responsibleAgent?.execution === "external" &&
                selectedRuntime?.status !== "active",
            },
            "保存内容",
          ),
        ),
      );
    }

    function CreateTaskModal({
      workspaces,
      directory,
      externalRuntimes,
      tasks,
      currentWorkspaceId,
      initialStatus,
      seed,
      onClose,
      onCreated,
    }) {
      const initialReceiverType =
        directory.humans.length > 0
          ? "human"
          : directory.agents.length > 0
            ? "agent"
            : directory.roles.length > 0
              ? "role"
              : "unassigned";
      const initialReceiver =
        initialReceiverType === "human"
          ? directory.humans[0]
          : initialReceiverType === "agent"
            ? directory.agents[0]
            : initialReceiverType === "role"
              ? directory.roles[0]
              : undefined;
      const initialRuntimeId =
        initialReceiverType === "agent" &&
        initialReceiver?.execution === "external"
          ? (initialReceiver.externalRuntimeId ?? "")
          : "";
      const seedReceiverType =
        seed?.receiverType === "human" ||
        seed?.receiverType === "agent" ||
        seed?.receiverType === "role" ||
        seed?.receiverType === "unassigned"
          ? seed.receiverType
          : undefined;
      const seedReceiverId =
        typeof seed?.receiverId === "string" ? seed.receiverId : "";
      const seedReceiver =
        seedReceiverType === "human"
          ? directory.humans.find((item) => item.id === seedReceiverId)
          : seedReceiverType === "agent"
            ? directory.agents.find((item) => item.id === seedReceiverId)
            : seedReceiverType === "role"
              ? directory.roles.find((item) => item.id === seedReceiverId)
              : undefined;
      const [form, setForm] = react.useState({
        workspaceId:
          seed?.workspaceId ||
          currentWorkspaceId ||
          workspaces[0]?.id ||
          "",
        title: typeof seed?.title === "string" ? seed.title : "",
        type: "任务",
        priority:
          seed?.priority === "P1" ||
          seed?.priority === "P2" ||
          seed?.priority === "P3"
            ? seed.priority
            : "P2",
        status: seed?.status || initialStatus || "todo",
        receiverType: seedReceiverType ?? initialReceiverType,
        receiverId:
          seedReceiverType === "unassigned"
            ? ""
            : (seedReceiver?.id ?? seedReceiverId ?? initialReceiver?.id ?? ""),
        receiverName:
          seedReceiverType === "unassigned"
            ? "待指派"
            : (seed?.receiverName ??
              seedReceiver?.name ??
              initialReceiver?.name ??
              ""),
        description:
          typeof seed?.description === "string" ? seed.description : "",
        dependsOn: Array.isArray(seed?.dependsOn)
          ? (seed.dependsOn[0] ?? "")
          : "",
        acceptance: Array.isArray(seed?.acceptance)
          ? seed.acceptance.join("\n")
          : "",
        due: typeof seed?.due === "string" ? seed.due : "",
        autoSubmitReview: true,
        allowPublicWeb: false,
        requireToolApproval: true,
        requireToolEvents: false,
        runtimeId: initialRuntimeId,
        model: "",
        reasoningEffort: "",
      });
      const receiverValue =
        form.receiverType === "unassigned"
          ? "unassigned:"
          : `${form.receiverType}:${form.receiverId}`;
      const chooseReceiver = (value) => {
        const separator = value.indexOf(":");
        const type = value.slice(0, separator);
        const id = value.slice(separator + 1);
        const item =
          type === "human"
            ? directory.humans.find((candidate) => candidate.id === id)
            : type === "agent"
              ? directory.agents.find((candidate) => candidate.id === id)
              : type === "role"
                ? directory.roles.find((candidate) => candidate.id === id)
                : undefined;
        setForm((current) => ({
          ...current,
          receiverType: type,
          receiverId: id,
          receiverName: item?.name ?? "",
          runtimeId:
            type === "agent" && item?.execution === "external"
              ? (item.externalRuntimeId ?? "")
              : "",
          model: "",
          reasoningEffort: "",
        }));
      };
      const selectedAgent =
        form.receiverType === "agent"
          ? directory.agents.find((item) => item.id === form.receiverId)
          : undefined;
      const selectedRuntime = runtimeForAgent(
        selectedAgent,
        form.runtimeId,
        externalRuntimes,
      );
      const externalRuntimeUnavailable =
        form.receiverType === "agent" &&
        selectedAgent?.execution === "external" &&
        selectedRuntime?.status !== "active";
      const runtimeLabel =
        selectedAgent === undefined
          ? "未指派 AI伙伴"
          : selectedAgent.execution === "external"
            ? (selectedRuntime?.name ??
              selectedAgent.externalRuntimeId ??
              "外部 Runtime 未绑定")
            : "内置执行";
      return h(
        "div",
        {
          className: "pmtask-mask",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          "form",
          {
            className: "pmtask-modal",
            onSubmit: (event) => {
              event.preventDefault();
              const acceptance = form.acceptance
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean);
              void onCreated({
                ...form,
                title: form.title.trim(),
                description: form.description.trim(),
                acceptance: acceptance.length
                  ? acceptance
                  : ["按描述完成并自查"],
                receiverId:
                  form.receiverType === "unassigned"
                    ? undefined
                    : form.receiverId,
                receiverName:
                  form.receiverType === "unassigned"
                    ? undefined
                    : form.receiverName,
                dependsOn: form.dependsOn === "" ? [] : [form.dependsOn],
                executionPolicy: buildExecutionPolicy(form),
              });
            },
          },
          h(
            "div",
            { className: "pmtask-modal-head" },
            h("h2", null, "派发任务 / Issue"),
            h(
              "button",
              {
                className: "pmtask-btn secondary",
                type: "button",
                onClick: onClose,
              },
              "关闭",
            ),
          ),
          h(
            "div",
            { className: "pmtask-modal-grid" },
            h(
              "label",
              { className: "pmtask-field" },
              "标题",
              h("input", {
                className: "pmtask-input",
                value: form.title,
                required: true,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  })),
              }),
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "类型",
              h(
                "select",
                {
                  className: "pmtask-select",
                  value: form.type,
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value,
                    })),
                },
                h("option", null, "任务"),
                h("option", null, "缺陷"),
                h("option", null, "评审"),
              ),
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "项目（必填）",
              h(
                "select",
                {
                  className: "pmtask-select",
                  value: form.workspaceId,
                  required: true,
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      workspaceId: event.target.value,
                    })),
                },
                h(
                  "option",
                  { value: "" },
                  workspaces.length === 0 ? "暂无可用项目" : "请选择项目",
                ),
                ...workspaces.map((workspace) =>
                  h(
                    "option",
                    { value: workspace.id, key: workspace.id },
                    workspace.title,
                  ),
                ),
              ),
              workspaces.length === 0
                ? h(
                    "span",
                    { className: "pmtask-locked-hint" },
                    "任务必须归属到一个项目。请先在左侧栏「项目」区域点击 + 新建项目，再回来派发。",
                  )
                : null,
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "优先级",
              h(
                "select",
                {
                  className: "pmtask-select",
                  value: form.priority,
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    })),
                },
                h("option", { value: "P1" }, "P0"),
                h("option", { value: "P2" }, "P1"),
                h("option", { value: "P3" }, "P2"),
              ),
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "初始状态",
              h(
                "select",
                {
                  className: "pmtask-select",
                  value: form.status,
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value,
                    })),
                },
                ...STATUSES.filter((status) => status.key !== "cancelled").map(
                  (status) =>
                    h(
                      "option",
                      { value: status.key, key: status.key },
                      status.label,
                    ),
                ),
              ),
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "到期时间",
              h("input", {
                className: "pmtask-input",
                type: "date",
                value: form.due,
                onChange: (event) =>
                  setForm((current) => ({
                    ...current,
                    due: event.target.value,
                  })),
              }),
            ),
            h(
              "label",
              { className: "pmtask-field" },
              "责任人",
              h(
                "select",
                {
                  className: "pmtask-select",
                  value: receiverValue,
                  onChange: (event) => chooseReceiver(event.target.value),
                },
                h("option", { value: "unassigned:" }, "待指派"),
                directory.humans.length > 0
                  ? h(
                      "optgroup",
                      { label: "人员" },
                      ...directory.humans.map((item) =>
                        h(
                          "option",
                          {
                            value: `human:${item.id}`,
                            key: `human:${item.id}`,
                          },
                          item.name,
                        ),
                      ),
                    )
                  : null,
                directory.agents.length > 0
                  ? h(
                      "optgroup",
                      { label: "DE / 分身" },
                      ...directory.agents.map((item) =>
                        h(
                          "option",
                          {
                            value: `agent:${item.id}`,
                            key: `agent:${item.id}`,
                          },
                          item.ownerName
                            ? receiverOptionLabel({ ...item, type: "agent" })
                            : item.name,
                        ),
                      ),
                    )
                  : null,
                directory.roles.length > 0
                  ? h(
                      "optgroup",
                      { label: "角色" },
                      ...directory.roles.map((item) =>
                        h(
                          "option",
                          { value: `role:${item.id}`, key: `role:${item.id}` },
                          item.name,
                        ),
                      ),
                    )
                  : null,
              ),
            ),
            h(
              "div",
              { className: "pmtask-field pmtask-span-2" },
              h(DependencyPicker, {
                tasks,
                workspaceId: form.workspaceId,
                currentTaskId: "",
                value: form.dependsOn,
                onChange: (dependsOn) =>
                  setForm((current) => ({ ...current, dependsOn })),
              }),
            ),
            form.receiverType === "agent"
              ? h(
                  Fragment,
                  null,
                  h(ExecutionRuntimeFields, {
                    runtimeLabel,
                    runtimeUnavailable: externalRuntimeUnavailable,
                    model: form.model,
                    modelOptions: selectedRuntime?.supportedModels ?? [],
                    defaultModelLabel: selectedRuntime?.defaultModel,
                    modelPlaceholder:
                      selectedRuntime === undefined
                        ? "沿用平台默认模型"
                        : "沿用 Runtime 默认模型",
                    reasoningEffort: form.reasoningEffort,
                    defaultReasoningLabel:
                      selectedRuntime === undefined
                        ? "沿用平台默认值"
                        : "沿用 Runtime 默认值",
                    onModelChange: (model) =>
                      setForm((current) => ({ ...current, model })),
                    onReasoningChange: (reasoningEffort) =>
                      setForm((current) => ({
                        ...current,
                        reasoningEffort,
                      })),
                  }),
                  h(
                    "div",
                    { className: "pmtask-field pmtask-span-2" },
                    "Review 设置",
                    h(
                      "label",
                      { className: "pmtask-check" },
                      h("input", {
                        type: "checkbox",
                        checked: form.autoSubmitReview,
                        onChange: (event) =>
                          setForm((current) => ({
                            ...current,
                            autoSubmitReview: event.target.checked,
                          })),
                      }),
                      h("span", null, "完成后自动提交 Review"),
                    ),
                    h(
                      "label",
                      { className: "pmtask-check" },
                      h("input", {
                        type: "checkbox",
                        checked: false,
                        disabled: true,
                      }),
                      h(
                        "span",
                        null,
                        "Review 自动通过",
                        h(
                          "em",
                          null,
                          "（仅普通工作流执行任务可配置；审批任务须人工结论）",
                        ),
                      ),
                    ),
                  ),
                )
              : null,
            h(
              "div",
              { className: "pmtask-field pmtask-span-2" },
              "执行策略",
              h(
                "label",
                { className: "pmtask-check" },
                h("input", {
                  type: "checkbox",
                  checked: form.allowPublicWeb,
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      allowPublicWeb: event.target.checked,
                    })),
                }),
                h(
                  "span",
                  null,
                  "允许公开网页与监管文件",
                  h(
                    "em",
                    null,
                    "研究类任务建议开启；事实性结论将要求来源、发布日期和访问时间。",
                  ),
                ),
              ),
              h(
                "label",
                { className: "pmtask-check" },
                h("input", {
                  type: "checkbox",
                  checked: form.requireToolApproval,
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      requireToolApproval: event.target.checked,
                    })),
                }),
                h("span", null, "写文件、执行命令和外部发布前需要人工确认"),
              ),
              h(
                "label",
                { className: "pmtask-check" },
                h("input", {
                  type: "checkbox",
                  checked: form.requireToolEvents,
                  onChange: (event) =>
                    setForm((current) => ({
                      ...current,
                      requireToolEvents: event.target.checked,
                    })),
                }),
                h("span", null, "要求记录实际工具调用事件"),
              ),
            ),
          ),
          h(
            "label",
            { className: "pmtask-field" },
            "描述",
            h("textarea", {
              className: "pmtask-area",
              rows: 4,
              value: form.description,
              required: true,
              placeholder: "补充背景、期望结果、边界和风险。",
              onChange: (event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                })),
            }),
          ),
          h(
            "label",
            { className: "pmtask-field" },
            "验收标准（每行一条）",
            h("textarea", {
              className: "pmtask-area",
              rows: 4,
              value: form.acceptance,
              placeholder: "例如：失败任务能在 3 次内自动重试",
              onChange: (event) =>
                setForm((current) => ({
                  ...current,
                  acceptance: event.target.value,
                })),
            }),
          ),
          h(
            "div",
            { className: "pmtask-compose-actions" },
            h(
              "button",
              {
                className: "pmtask-btn secondary",
                type: "button",
                onClick: onClose,
              },
              "取消",
            ),
            h(
              "button",
              {
                className: "pmtask-btn",
                type: "submit",
                disabled:
                  form.title.trim() === "" ||
                  form.description.trim() === "" ||
                  form.workspaceId === "" ||
                  (form.receiverType !== "unassigned" &&
                    form.receiverId === "") ||
                  (form.receiverType === "agent" &&
                    selectedAgent?.execution === "external" &&
                    selectedRuntime?.status !== "active"),
              },
              "派发",
            ),
          ),
        ),
      );
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      /**
       * 打开任务对应的 Agent 执行会话：走 DSH 的会话控制器切到那条会话，
       * 再把 shell 切到会话视图。DSH 侧会隐藏「空会话」，所以这里只负责
       * 打开，查找失败由调用方提示。
       */
      window.__pluginmaxOpenSession = (sessionId) => {
        if (typeof sessionId !== "string" || sessionId === "") return false;
        const sessions =
          typeof ctx.get === "function" ? ctx.get("sessions") : undefined;
        if (sessions === undefined || typeof sessions.open !== "function") {
          return false;
        }
        try {
          sessions.open(sessionId);
        } catch {
          return false;
        }
        window.__pluginmaxShell?.setRoute?.("session");
        return true;
      };
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global",
            id: "pluginmax-task",
            order: 25,
            children: {
              "pluginmax.task.capture-launcher": {
                kind: "single",
                scope: "root",
              },
              "pluginmax.task.draft-inbox": {
                kind: "single",
                scope: "root",
              },
              "pluginmax.task.detail.capture-origin": {
                kind: "single",
                scope: "root",
              },
              "pluginmax.task.detail.extension": {
                kind: "single",
                scope: "root",
              },
            },
          },
          TaskGlobalPage,
        ),
      );
    };

    return module.exports;
  },
});
