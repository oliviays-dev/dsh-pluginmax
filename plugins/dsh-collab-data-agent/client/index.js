window.__ModuleLoader__.load({
  id: "dsh-collab-data-agent",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";
    const WORKSPACE_KEY = "pluginmax.dataAgent.workspaceId";
    const CONVERSATION_PREFIX = "pluginmax.dataAgent.conversation.";
    const API = "/api/collab/data-agent";

    const ENTITY_LABELS = {
      task: "任务",
      workflow: "工作流",
      workflow_node: "工作流节点",
      meeting: "会议",
      metric_card: "指标",
      text: "选中文本",
      chart: "图表",
      media: "图片",
      component: "页面内容",
      record: "业务记录",
    };

    function icon(paths, size = 15) {
      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.9,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
        },
        ...paths.map((path, index) => h("path", { key: index, d: path })),
      );
    }

    const ICONS = {
      spark: icon([
        "m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z",
        "M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z",
      ]),
      message: icon([
        "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z",
      ]),
      close: icon(["M18 6 6 18", "M6 6l12 12"], 12),
      expand: icon(["M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"], 14),
      collapse: icon(["M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"], 14),
      settings: icon([
        "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z",
        "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z",
      ]),
      send: icon(["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"], 13),
      file: icon([
        "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z",
        "M14 2v6h6M8 13h8M8 17h6",
      ]),
      chart: icon(["M4 20V10M10 20V4M16 20v-7M22 20H2"]),
      selection: icon([
        "M4 4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
        "m10 9 5 2-2 1-1 2Z",
      ]),
      chevron: icon(["m6 9 6 6 6-6"], 12),
      reset: icon(["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"]),
      download: icon(["M12 3v12M7 10l5 5 5-5M4 21h16"]),
      shield: icon(["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-5"]),
      plus: icon(["M12 5v14M5 12h14"], 12),
    };

    const styles = `
.pmda-action{width:32px;height:32px;flex:none;display:grid;place-items:center;padding:0;border:0.5px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 44%,var(--dsw-alias-border-l3));border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-agent-primary,#8b7bf7);cursor:pointer;position:relative;}
.pmda-action:hover,.pmda-action.active{background:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 12%,var(--dsw-alias-bg-layer-1));}
.pmda-action svg{width:15px;height:15px;}
.pmda-action-dot{position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-agent-primary,#8b7bf7);}
.pmda-selectable{transition:box-shadow .12s ease,border-color .12s ease;}
.pmda-selectable:hover{box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,transparent);}
.pmda-selected{box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 78%,transparent),0 0 0 5px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 10%,transparent)!important;}
.pmda-selection-action{position:fixed;z-index:1200;display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 58%,transparent);border-radius:6px;background:var(--dsw-alias-agent-primary,#8b7bf7);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.24);font:inherit;font-size:11px;font-weight:600;cursor:pointer;transform:translate(-50%,-100%);}
.pmda-selection-action svg{width:13px;height:13px;}
.pmda-panel-root{position:absolute;inset:0;z-index:21;display:flex;justify-content:flex-end;overflow:hidden;pointer-events:none;}
.pmda-panel{position:relative;width:min(500px,100%);min-width:0;height:100%;display:flex;flex-direction:column;pointer-events:auto;overflow:hidden;border-left:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);}
.pmda-panel *{box-sizing:border-box;}
.pmda-tabs{display:flex;align-items:stretch;flex:none;gap:2px;min-height:38px;padding:4px 6px 0;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
.pmda-tab{position:relative;display:inline-flex;align-items:center;height:33px;border-bottom:2px solid transparent;color:var(--dsw-alias-label-secondary);}
.pmda-tab.active{color:var(--dsw-alias-agent-primary,#8b7bf7);border-bottom-color:var(--dsw-alias-agent-primary,#8b7bf7);background:var(--dsw-alias-bg-layer-1);}
.pmda-tab-main{display:inline-flex;align-items:center;gap:5px;height:100%;padding:0 4px 0 9px;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer;}
.pmda-tab svg{width:13px;height:13px;}
.pmda-tab-close{width:18px;height:18px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
.pmda-head{display:flex;align-items:center;gap:8px;flex:none;min-height:58px;padding:10px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
.pmda-avatar{width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:9px;background:linear-gradient(145deg,#a78bfa,#6d5df2 58%,#4f8ef7);color:#fff;font-size:10px;font-weight:800;}
.pmda-title{min-width:0;flex:1;}
.pmda-title strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:13px;white-space:nowrap;}
.pmda-title small{display:block;overflow:hidden;text-overflow:ellipsis;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:10px;white-space:nowrap;}
.pmda-chip{flex:none;display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 14%,transparent);color:var(--dsw-alias-agent-primary,#8b7bf7);font-size:9px;white-space:nowrap;}
.pmda-iconbtn{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;}
.pmda-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmda-iconbtn svg{width:13px;height:13px;}
.pmda-head-actions{display:flex;align-items:center;gap:4px;}
.pmda-context{display:flex;align-items:center;gap:6px;flex:none;padding:6px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:10px;}
.pmda-context select{max-width:180px;height:25px;min-width:0;padding:0 6px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;}
.pmda-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;}
.pmda-chat{min-height:0;flex:1;overflow:auto;padding:14px 12px 18px;scroll-behavior:auto;}
.pmda-empty{min-height:100%;display:grid;align-content:center;justify-items:center;padding:22px;text-align:center;}
.pmda-empty-mark{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 13%,transparent);color:var(--dsw-alias-agent-primary,#8b7bf7);}
.pmda-empty-mark svg{width:22px;height:22px;}
.pmda-empty h2{margin:12px 0 0;font-size:15px;}
.pmda-empty p{max-width:320px;margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.65;}
.pmda-suggestions{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:14px;}
.pmda-suggestion{height:27px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:999px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;cursor:pointer;}
.pmda-suggestion:hover{border-color:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 42%,transparent);color:var(--dsw-alias-label-primary);}
.pmda-message{display:grid;gap:5px;margin-bottom:14px;}
.pmda-message.user{justify-items:end;}
.pmda-message-meta{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
.pmda-bubble{max-width:92%;padding:9px 10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;}
.pmda-message.user .pmda-bubble{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 24%,transparent);}
.pmda-attachments{display:grid;gap:5px;width:100%;margin-bottom:5px;}
.pmda-attachment{display:grid;gap:3px;padding:7px 8px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 25%,var(--dsw-alias-border-l2));border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmda-attachment-head{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
.pmda-attachment strong{font-size:10.5px;}
.pmda-attachment p{max-height:42px;overflow:hidden;margin:0;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.45;}
.pmda-remove{width:18px;height:18px;margin-left:auto;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
.pmda-composer{flex:none;padding:9px 10px 8px;border-top:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}
.pmda-composer-box{display:grid;grid-template-columns:minmax(0,1fr) 30px;align-items:end;gap:6px;padding:6px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);}
.pmda-composer textarea{width:100%;min-height:42px;max-height:140px;resize:none;padding:3px 4px;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;line-height:1.55;}
.pmda-send{width:30px;height:30px;display:grid;place-items:center;padding:0;border:0;border-radius:6px;background:var(--dsw-alias-agent-primary,#8b7bf7);color:#fff;cursor:pointer;}
.pmda-send:disabled{opacity:.45;cursor:not-allowed;}
.pmda-note{display:flex;justify-content:space-between;gap:8px;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
.pmda-progress{display:flex;align-items:center;gap:8px;padding:9px 10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 24%,var(--dsw-alias-border-l2));border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 7%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-secondary);font-size:10.5px;}
.pmda-spinner{width:13px;height:13px;flex:none;border:2px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 25%,transparent);border-top-color:var(--dsw-alias-agent-primary,#8b7bf7);border-radius:50%;animation:pmda-spin .9s linear infinite;}
@keyframes pmda-spin{to{transform:rotate(360deg)}}
.pmda-error{padding:9px 10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 38%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 8%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10.5px;line-height:1.55;}
.pmda-report-card{display:grid;gap:10px;padding:11px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 28%,var(--dsw-alias-border-l2));border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmda-report-head{display:flex;gap:9px;}
.pmda-report-icon{width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 12%,transparent);color:var(--dsw-alias-agent-primary,#8b7bf7);}
.pmda-report-head h3{margin:0;font-size:12px;line-height:1.4;}
.pmda-report-head p{margin:3px 0 0;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.55;}
.pmda-report-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}
.pmda-report-tags span{padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
.pmda-report-actions{display:flex;flex-wrap:wrap;gap:5px;}
.pmda-btn{height:28px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;cursor:pointer;white-space:nowrap;}
.pmda-btn.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:600;}
.pmda-btn.agent{border-color:transparent;background:var(--dsw-alias-agent-primary,#8b7bf7);color:#fff;}
.pmda-btn:disabled{opacity:.45;cursor:not-allowed;}
.pmda-report{min-height:0;flex:1;overflow:auto;padding:12px 14px 32px;}
.pmda-report-toolbar{position:sticky;top:-12px;z-index:2;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:-12px -14px 10px;padding:9px 14px;border-bottom:0.5px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-base) 94%,transparent);backdrop-filter:blur(10px);}
.pmda-report-doc{max-width:900px;margin:0 auto;font-size:11px;line-height:1.75;overflow-wrap:anywhere;}
.pmda-report-doc h1{font-size:20px;line-height:1.35;margin:4px 0 10px;}
.pmda-report-doc h2{font-size:15px;margin:20px 0 8px;}
.pmda-report-doc h3{font-size:13px;margin:14px 0 6px;}
.pmda-report-doc p{margin:6px 0;color:var(--dsw-alias-label-secondary);}
.pmda-report-doc img{display:block;max-width:100%;height:auto;margin:10px 0;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);}
.pmda-report-doc ul,.pmda-report-doc ol{margin:6px 0;padding-left:20px;color:var(--dsw-alias-label-secondary);}
.pmda-report-doc table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10px;}
.pmda-report-doc th,.pmda-report-doc td{padding:6px 7px;border:0.5px solid var(--dsw-alias-border-l2);text-align:left;vertical-align:top;}
.pmda-report-doc th{background:var(--dsw-alias-bg-layer-2);}
.pmda-report-doc code{padding:1px 4px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.pmda-report-doc pre{overflow:auto;padding:9px;border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmda-loading{padding:30px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:11px;}
.pmda-mask{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.48);}
.pmda-modal{width:min(520px,100%);max-height:min(82vh,680px);display:flex;flex-direction:column;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l3);border-radius:9px;background:var(--dsw-alias-bg-base);box-shadow:0 24px 70px rgba(0,0,0,.36);}
.pmda-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
.pmda-modal-head h2{margin:0;font-size:15px;}
.pmda-modal-body{min-height:0;overflow:auto;padding:14px 16px;}
.pmda-modal-foot{display:flex;justify-content:flex-end;gap:7px;padding:11px 16px;border-top:0.5px solid var(--dsw-alias-border-l2);}
.pmda-field{display:grid;gap:5px;margin-bottom:11px;}
.pmda-field label{color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:600;}
.pmda-input,.pmda-select{width:100%;height:32px;padding:0 8px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;}
.pmda-scope{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.pmda-scope div{padding:9px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmda-scope strong{display:block;font-size:10.5px;}.pmda-scope li{color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.6;}
.pmda-toast{position:fixed;left:50%;bottom:26px;z-index:1400;transform:translateX(-50%);padding:8px 12px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 12px 30px rgba(0,0,0,.24);font-size:11px;}
@media(max-width:640px){.pmda-panel{width:100%;}.pmda-selection-action{max-width:calc(100vw - 24px);}.pmda-head{padding:9px 10px;}.pmda-report{padding:10px;}.pmda-report-toolbar{margin:-10px -10px 10px;padding:8px 10px;}}
`;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY) ?? "";
    }

    async function request(path, options = {}) {
      const headers = { "cache-control": "no-store" };
      const value = token();
      if (value !== "") headers.authorization = `Bearer ${value}`;
      if (options.body !== undefined) headers["content-type"] = "application/json";
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const error = new Error(payload?.error?.message ?? `HTTP ${response.status}`);
        error.code = payload?.error?.code;
        throw error;
      }
      return payload;
    }

    function compact(value, max = 260) {
      const text = String(value ?? "").replace(/\s+/g, " ").trim();
      return text.length > max ? `${text.slice(0, max)}…` : text;
    }

    function pageFromRoute(route) {
      if (route === "task") return "task";
      if (route === "workflow") return "workflow";
      if (route === "meetings" || route === "meeting") return "meeting";
      if (route === "projects" || route === "project") return "project";
      return "workbench";
    }

    function workspaceIdFor(element) {
      const explicit = element?.closest?.("[data-workspace-id]")?.dataset?.workspaceId;
      return (
        explicit ||
        window.localStorage.getItem(WORKSPACE_KEY) ||
        window.__pluginmaxDataAgentWorkspaceId ||
        window.__pluginmaxSelectionContext?.workspaceId ||
        ""
      );
    }

    function titleOf(element) {
      return compact(
        element?.dataset?.dataAgentTitle ||
          element?.getAttribute?.("data-data-agent-title") ||
          element?.querySelector?.("h1,h2,h3,strong,.pmtask-title,.pmwf-title-line strong")?.textContent ||
          element?.textContent ||
          "页面内容",
        90,
      );
    }

    function excerptOf(element) {
      return compact(
        element?.dataset?.dataAgentExcerpt ||
          element?.getAttribute?.("data-data-agent-excerpt") ||
          element?.innerText ||
          element?.textContent ||
          titleOf(element),
        420,
      );
    }

    function createSelectionRegistry() {
      const adapters = new Map();
      const registry = {
        register(adapter) {
          if (
            adapter === null ||
            typeof adapter !== "object" ||
            typeof adapter.entityType !== "string" ||
            typeof adapter.selector !== "string" ||
            typeof adapter.resolve !== "function"
          ) {
            throw new Error("invalid data-agent entity adapter");
          }
          adapters.set(adapter.entityType, adapter);
          return () => adapters.delete(adapter.entityType);
        },
        unregister(entityType) {
          adapters.delete(entityType);
        },
        list() {
          return [...adapters.values()];
        },
        resolve(element) {
          for (const adapter of adapters.values()) {
            const match = element?.closest?.(adapter.selector);
            if (match === null || match === undefined) continue;
            return adapter.resolve(match);
          }
          return undefined;
        },
        async resolveServer(selection) {
          return request(`${API}/selection/resolve`, {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selection.source.workspaceId,
              selection,
            }),
          });
        },
      };
      window.__pluginmaxDataAgentEntityRegistry = registry;
      return registry;
    }

    function registerBuiltInAdapters(registry) {
      registry.register({
        entityType: "task",
        schemaVersion: "task-selection-v1",
        selector: "[data-task-id]",
        resolve(element) {
          return {
            kind: "record",
            entityType: "task",
            entityId: element.dataset.taskId,
            title: titleOf(element),
            excerpt: excerptOf(element),
            source: {
              workspaceId: workspaceIdFor(element),
              page: "task",
              entityRef: `/task/${element.dataset.taskId}`,
            },
            snapshot: {
              text: excerptOf(element),
              values: { taskId: element.dataset.taskId },
            },
          };
        },
      });
      registry.register({
        entityType: "workflow",
        schemaVersion: "workflow-selection-v1",
        selector: "[data-workflow-id]",
        resolve(element) {
          return {
            kind: "record",
            entityType: "workflow",
            entityId: element.getAttribute("data-workflow-id"),
            title: titleOf(element),
            excerpt: excerptOf(element),
            source: {
              workspaceId: workspaceIdFor(element),
              page: "workflow",
              entityRef: `/workflow/${element.getAttribute("data-workflow-id")}`,
            },
            snapshot: {
              text: excerptOf(element),
              values: {
                workflowId: element.getAttribute("data-workflow-id"),
              },
            },
          };
        },
      });
      registry.register({
        entityType: "workflow_node",
        schemaVersion: "workflow-node-selection-v1",
        selector: "[data-workflow-node-id]",
        resolve(element) {
          return {
            kind: "record",
            entityType: "workflow_node",
            entityId: element.getAttribute("data-workflow-node-id"),
            title: titleOf(element),
            excerpt: excerptOf(element),
            source: {
              workspaceId: workspaceIdFor(element),
              page: "workflow",
              entityRef: `/workflow/${element.getAttribute("data-workflow-id") || ""}/node/${element.getAttribute("data-workflow-node-id") || ""}`,
            },
            snapshot: {
              text: excerptOf(element),
              values: {
                workflowId: element.getAttribute("data-workflow-id"),
                nodeId: element.getAttribute("data-workflow-node-id"),
              },
            },
          };
        },
      });
      registry.register({
        entityType: "meeting",
        schemaVersion: "meeting-selection-v1",
        selector: "[data-data-agent-entity='meeting']",
        resolve(element) {
          return {
            kind: "record",
            entityType: "meeting",
            entityId: element.getAttribute("data-data-agent-id"),
            title: titleOf(element),
            excerpt: excerptOf(element),
            source: {
              workspaceId: workspaceIdFor(element),
              page: "meeting",
              entityRef: `/meeting/${element.getAttribute("data-data-agent-id")}`,
            },
            snapshot: {
              text: excerptOf(element),
              values: { meetingId: element.getAttribute("data-data-agent-id") },
            },
          };
        },
      });
      registry.register({
        entityType: "metric_card",
        schemaVersion: "metric-card-selection-v1",
        selector: "[data-metric-id]",
        resolve(element) {
          return {
            kind: "metric",
            entityType: "metric_card",
            entityId: element.getAttribute("data-metric-id"),
            title: titleOf(element),
            excerpt: excerptOf(element),
            source: {
              workspaceId: workspaceIdFor(element),
              page: "workbench",
              entityRef: `/metric/${element.getAttribute("data-metric-id")}`,
            },
            snapshot: {
              text: excerptOf(element),
              values: { metricId: element.getAttribute("data-metric-id") },
              componentSchemaVersion: "metric-card-v1",
            },
          };
        },
      });
      registry.register({
        entityType: "chart",
        schemaVersion: "chart-selection-v1",
        selector:
          "svg[data-chart], svg.sparkline, svg.insight-chart, .pmwf-overview",
        resolve(element) {
          return {
            kind: "chart",
            title: titleOf(element.closest?.("[data-data-agent-title]") ?? element),
            excerpt: excerptOf(element.closest?.("[data-data-agent-title]") ?? element),
            source: {
              workspaceId: workspaceIdFor(element),
              page: pageFromRoute(window.__pluginmaxShell?.router?.state?.route),
            },
            snapshot: {
              text: excerptOf(element),
              componentSchemaVersion: "chart-selection-v1",
            },
          };
        },
      });
      registry.register({
        entityType: "media",
        schemaVersion: "media-selection-v1",
        selector: "main img",
        resolve(element) {
          return {
            kind: "media",
            title: element.alt || "页面图片",
            excerpt: element.alt || element.title || "页面图片快照",
            source: {
              workspaceId: workspaceIdFor(element),
              page: pageFromRoute(window.__pluginmaxShell?.router?.state?.route),
            },
            snapshot: {
              text: element.alt || element.title || "页面图片",
              imageRef: element.currentSrc || element.src,
              componentSchemaVersion: "media-selection-v1",
            },
          };
        },
      });
    }

    const entityRegistry = createSelectionRegistry();
    registerBuiltInAdapters(entityRegistry);
    const ambientWorkspacePromise = request("/api/collab/team/workspaces")
      .then((result) => {
        const workspace = (result.workspaces ?? []).find(
          (item) => item.isMember !== false,
        );
        if (workspace?.id !== undefined) {
          window.__pluginmaxDataAgentWorkspaceId = workspace.id;
        }
        return workspace?.id ?? "";
      })
      .catch(() => "");

    function SelectionLayer() {
      const [selection, setSelection] = react.useState(null);
      const [position, setPosition] = react.useState(null);
      const selectedElement = react.useRef(null);
      const actionRef = react.useRef(null);

      const clear = react.useCallback(() => {
        selectedElement.current?.classList.remove("pmda-selected");
        selectedElement.current = null;
        setSelection(null);
        setPosition(null);
      }, []);

      const show = react.useCallback((next, rect, element) => {
        selectedElement.current?.classList.remove("pmda-selected");
        selectedElement.current = element ?? null;
        selectedElement.current?.classList.add("pmda-selected");
        setSelection(next);
        setPosition({
          left: Math.max(100, Math.min(window.innerWidth - 100, rect.left + rect.width / 2)),
          top: Math.max(42, rect.top - 6),
        });
      }, []);

      react.useEffect(() => {
        void ambientWorkspacePromise;
        const markSelectable = () => {
          for (const adapter of entityRegistry.list()) {
            for (const node of document.querySelectorAll(adapter.selector)) {
              if (!node.closest(".pmda-panel") && !node.closest("[data-data-agent-exclude]")) {
                node.classList.add("pmda-selectable");
              }
            }
          }
        };
        markSelectable();
        const observer = new MutationObserver(markSelectable);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      }, []);

      react.useEffect(() => {
        const pointerUp = (event) => {
          if (
            event.target.closest?.(
              ".pmda-panel, .pmda-selection-action, button, input, textarea, select, a, [role='button'][data-control], [data-data-agent-exclude]",
            )
          ) {
            return;
          }
          window.setTimeout(() => {
            const textSelection = window.getSelection();
            const text = textSelection?.toString().trim() ?? "";
            if (text.length >= 2) {
              const anchor = textSelection?.anchorNode;
              const node =
                anchor?.nodeType === Node.ELEMENT_NODE
                  ? anchor
                  : anchor?.parentElement;
              if (
                node?.closest?.(
                  ".pmda-panel, textarea, input, button, a, select, [contenteditable='true']",
                )
              ) {
                return;
              }
              const range = textSelection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) return;
              const route = pageFromRoute(window.__pluginmaxShell?.router?.state?.route);
              show(
                {
                  kind: "text",
                  title: "选中文本",
                  excerpt: compact(text, 1200),
                  source: {
                    workspaceId: workspaceIdFor(node),
                    page: route === "meeting" ? "meeting" : route,
                  },
                  snapshot: { text: compact(text, 8000) },
                },
                rect,
                null,
              );
            }
          }, 0);
        };
        const click = (event) => {
          if (
            event.target.closest?.(
              ".pmda-selection-action, .pmda-panel, button, input, textarea, select, a, [data-data-agent-exclude]",
            )
          ) {
            return;
          }
          if (window.getSelection()?.toString().trim()) return;
          const resolved = entityRegistry.resolve(event.target);
          if (resolved === undefined) {
            if (!event.target.closest?.("[data-data-agent-entity]")) clear();
            return;
          }
          if (!resolved.source.workspaceId) {
            clear();
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const host =
            event.target.closest(
              "[data-task-id],[data-workflow-id],[data-workflow-node-id],[data-data-agent-entity='meeting'],[data-metric-id],svg[data-chart],svg.sparkline,svg.insight-chart,.pmwf-overview,main img",
            ) ?? event.target;
          show(resolved, host.getBoundingClientRect(), host);
        };
        const keydown = (event) => {
          if (event.key === "Escape") clear();
        };
        const reposition = () => {
          if (selectedElement.current === null) return;
          const rect = selectedElement.current.getBoundingClientRect();
          setPosition({
            left: Math.max(100, Math.min(window.innerWidth - 100, rect.left + rect.width / 2)),
            top: Math.max(42, rect.top - 6),
          });
        };
        document.addEventListener("pointerup", pointerUp, true);
        document.addEventListener("click", click, true);
        document.addEventListener("keydown", keydown);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        return () => {
          document.removeEventListener("pointerup", pointerUp, true);
          document.removeEventListener("click", click, true);
          document.removeEventListener("keydown", keydown);
          window.removeEventListener("resize", reposition);
          window.removeEventListener("scroll", reposition, true);
        };
      }, [clear, show]);

      if (selection === null || position === null) return null;
      return h(
        "button",
        {
          ref: actionRef,
          type: "button",
          className: "pmda-selection-action",
          style: position,
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.__pluginmaxSidePanel?.openTab("data-agent");
            window.dispatchEvent(
              new CustomEvent("pluginmax:data-agent-selection", {
                detail: { selection },
              }),
            );
            clear();
            window.getSelection()?.removeAllRanges();
          },
        },
        ICONS.selection,
        "让DataAgent分析",
      );
    }

    function useSidePanel() {
      return react.useSyncExternalStore(
        (listener) =>
          window.__pluginmaxSidePanel?.subscribe?.(() => listener()) ??
          (() => {}),
        () =>
          window.__pluginmaxSidePanel?.getSnapshot?.() ?? {
            open: false,
            openTabs: [],
            activeTab: undefined,
            expanded: false,
          },
        () =>
          window.__pluginmaxSidePanel?.getSnapshot?.() ?? {
            open: false,
            openTabs: [],
            activeTab: undefined,
            expanded: false,
          },
      );
    }

    function SidePanelTabs() {
      const snapshot = useSidePanel();
      const tabs = snapshot.openTabs ?? [];
      if (tabs.length === 0) return null;
      const labels = {
        "data-agent": ["Data Agent", "spark"],
        communication: ["沟通", "message"],
      };
      return h(
        "div",
        { role: "tablist", "aria-label": "侧边工作区", className: "pmda-tabs" },
        ...tabs.map((tab) => {
          const active = snapshot.activeTab === tab;
          const [label, iconName] = labels[tab] ?? [tab, "message"];
          return h(
            "div",
            {
              key: tab,
              className: `pmda-tab${active ? " active" : ""}`,
            },
            h(
              "button",
              {
                type: "button",
                role: "tab",
                "aria-selected": active,
                className: "pmda-tab-main",
                onClick: () => window.__pluginmaxSidePanel?.openTab(tab),
              },
              ICONS[iconName],
              h("span", null, label),
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmda-tab-close",
                "aria-label": `关闭${label}`,
                title: `关闭${label}`,
                onClick: () => {
                  window.__pluginmaxSidePanel?.closeTab(tab);
                },
              },
              ICONS.close,
            ),
          );
        }),
      );
    }

    function GlobalDataAgentAction(props = {}) {
      const snapshot = useSidePanel();
      const active =
        snapshot.open === true && snapshot.activeTab === "data-agent";
      const dataAgent = h(
        "button",
        {
          type: "button",
          className: `pmda-action${active ? " active" : ""}`,
          title: "Data Agent",
          "aria-label": "打开 Data Agent",
          "aria-pressed": active,
          onClick: () => window.__pluginmaxSidePanel?.openTab("data-agent"),
        },
        ICONS.spark,
        active ? h("span", { className: "pmda-action-dot" }) : null,
      );
      if (props.includeCommunication !== true) return dataAgent;
      const communicationActive =
        snapshot.open === true && snapshot.activeTab === "communication";
      return h(
        react.Fragment,
        null,
        dataAgent,
        h(
          "button",
          {
            type: "button",
            className: `pmda-action${communicationActive ? " active" : ""}`,
            title: "沟通",
            "aria-label": "打开沟通",
            "aria-pressed": communicationActive,
            onClick: () => window.__pluginmaxSidePanel?.openTab("communication"),
          },
          ICONS.message,
        ),
      );
    }

    function inlineMarkdown(text, keyBase) {
      const nodes = [];
      const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
      let cursor = 0;
      let index = 0;
      let match = pattern.exec(text);
      while (match !== null) {
        if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
        if (match[2] !== undefined) {
          nodes.push(h("strong", { key: `${keyBase}-b-${index}` }, match[2]));
        } else {
          nodes.push(h("code", { key: `${keyBase}-c-${index}` }, match[3]));
        }
        cursor = match.index + match[0].length;
        index += 1;
        match = pattern.exec(text);
      }
      if (cursor < text.length) nodes.push(text.slice(cursor));
      return nodes;
    }

    function reportImageData(report, name) {
      const image = report?.images?.find((item) => item.name === name);
      if (image === undefined) return undefined;
      const bytes = new TextEncoder().encode(image.content);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `data:${image.mediaType};base64,${window.btoa(binary)}`;
    }

    function renderReportMarkdown(report) {
      const lines = String(report?.markdown ?? "").replace(/\r/g, "").split("\n");
      const blocks = [];
      let unordered = [];
      let ordered = [];
      const flush = () => {
        if (unordered.length > 0) {
          blocks.push(
            h(
              "ul",
              { key: `ul-${blocks.length}` },
              ...unordered.map((item, index) =>
                h(
                  "li",
                  { key: `uli-${blocks.length}-${index}` },
                  ...inlineMarkdown(item, `uli-${blocks.length}-${index}`),
                ),
              ),
            ),
          );
          unordered = [];
        }
        if (ordered.length > 0) {
          blocks.push(
            h(
              "ol",
              { key: `ol-${blocks.length}` },
              ...ordered.map((item, index) =>
                h(
                  "li",
                  { key: `oli-${blocks.length}-${index}` },
                  ...inlineMarkdown(item, `oli-${blocks.length}-${index}`),
                ),
              ),
            ),
          );
          ordered = [];
        }
      };
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (line.startsWith("```")) {
          flush();
          const code = [];
          index += 1;
          while (index < lines.length && !lines[index].startsWith("```")) {
            code.push(lines[index]);
            index += 1;
          }
          blocks.push(
            h("pre", { key: `pre-${blocks.length}` }, h("code", null, code.join("\n"))),
          );
          continue;
        }
        const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
        if (imageMatch !== null) {
          flush();
          const name = imageMatch[2].replace(/^\.\/assets\//, "");
          const src = reportImageData(report, name);
          if (src !== undefined) {
            blocks.push(
              h("img", {
                key: `img-${blocks.length}`,
                src,
                alt: imageMatch[1],
              }),
            );
          }
          continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading !== null) {
          flush();
          const Tag = `h${Math.min(6, heading[1].length)}`;
          blocks.push(
            h(
              Tag,
              { key: `h-${blocks.length}` },
              ...inlineMarkdown(heading[2] ?? "", `h-${blocks.length}`),
            ),
          );
          continue;
        }
        if (
          line.trim().startsWith("|") &&
          /^\s*\|?\s*:?-{2,}/.test(lines[index + 1] ?? "")
        ) {
          flush();
          const cells = (value) =>
            value
              .trim()
              .replace(/^\|/, "")
              .replace(/\|$/, "")
              .split("|")
              .map((cell) => cell.trim());
          const header = cells(line);
          const rows = [];
          index += 2;
          while (index < lines.length && lines[index].trim().startsWith("|")) {
            rows.push(cells(lines[index]));
            index += 1;
          }
          index -= 1;
          blocks.push(
            h(
              "table",
              { key: `table-${blocks.length}` },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  ...header.map((cell, cellIndex) =>
                    h(
                      "th",
                      { key: `th-${cellIndex}` },
                      ...inlineMarkdown(cell, `th-${cellIndex}`),
                    ),
                  ),
                ),
              ),
              h(
                "tbody",
                null,
                ...rows.map((row, rowIndex) =>
                  h(
                    "tr",
                    { key: `tr-${rowIndex}` },
                    ...header.map((_, cellIndex) =>
                      h(
                        "td",
                        { key: `td-${rowIndex}-${cellIndex}` },
                        ...inlineMarkdown(
                          row[cellIndex] ?? "",
                          `td-${rowIndex}-${cellIndex}`,
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
        const unorderedMatch = /^\s*[-*+]\s+(.*)$/.exec(line);
        if (unorderedMatch !== null) {
          if (ordered.length > 0) flush();
          unordered.push(unorderedMatch[1]);
          continue;
        }
        const orderedMatch = /^\s*\d+[.)]\s+(.*)$/.exec(line);
        if (orderedMatch !== null) {
          if (unordered.length > 0) flush();
          ordered.push(orderedMatch[1]);
          continue;
        }
        if (line.trim() === "") {
          flush();
          continue;
        }
        flush();
        blocks.push(
          h(
            "p",
            { key: `p-${blocks.length}` },
            ...inlineMarkdown(line, `p-${blocks.length}`),
          ),
        );
      }
      flush();
      return h("div", { className: "pmda-report-doc" }, ...blocks);
    }

    async function downloadReport(report, format) {
      const response = await fetch(
        `${API}/download?reportId=${encodeURIComponent(report.id)}&format=${encodeURIComponent(format)}`,
        {
          headers: {
            authorization: `Bearer ${token()}`,
          },
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${report.title}.${format === "html" ? "html" : "md"}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }

    function AttachmentCard({ attachment, removable, onRemove }) {
      return h(
        "article",
        { className: "pmda-attachment" },
        h(
          "div",
          { className: "pmda-attachment-head" },
          ICONS[attachment.entityType === "metric_card" ? "chart" : "file"],
          h(
            "span",
            null,
            ENTITY_LABELS[attachment.entityType ?? attachment.kind] ??
              attachment.kind,
          ),
          h("span", null, "·"),
          h("span", null, attachment.sourcePage ?? attachment.source?.page ?? ""),
          removable
            ? h(
                "button",
                {
                  type: "button",
                  className: "pmda-remove",
                  title: "移除选中内容",
                  "aria-label": "移除选中内容",
                  onClick: onRemove,
                },
                ICONS.close,
              )
            : null,
        ),
        h("strong", null, attachment.title),
        h("p", null, attachment.excerpt),
      );
    }

    function ReportCard({ report, onOpen, onGenerateHtml, onDownload }) {
      return h(
        "article",
        { className: "pmda-report-card" },
        h(
          "div",
          { className: "pmda-report-head" },
          h("div", { className: "pmda-report-icon" }, ICONS.file),
          h(
            "div",
            null,
            h("h3", null, report.title),
            h("p", null, report.summary),
            h(
              "div",
              { className: "pmda-report-tags" },
              h("span", null, `Markdown + ${report.images?.length ?? 0} 张图`),
              h("span", null, `数据截止 ${new Date(report.dataCutoffAt).toLocaleString("zh-CN")}`),
              h("span", null, "只读数据"),
            ),
          ),
        ),
        h(
          "div",
          { className: "pmda-report-actions" },
          h(
            "button",
            { type: "button", className: "pmda-btn agent", onClick: () => onOpen(report) },
            "浏览报告",
          ),
          h(
            "button",
            { type: "button", className: "pmda-btn", onClick: () => onDownload(report, "md") },
            "下载 Markdown",
          ),
          report.html
            ? h(
                "button",
                {
                  type: "button",
                  className: "pmda-btn",
                  onClick: () => onDownload(report, "html"),
                },
                "下载 HTML",
              )
            : h(
                "button",
                {
                  type: "button",
                  className: "pmda-btn",
                  onClick: () => onGenerateHtml(report),
                },
                "生成 HTML 版",
              ),
        ),
      );
    }

    function DataAgentPanel(props) {
      const sidePanel = useSidePanel();
      const route = props?.useShellRoute?.((state) => state.route) ?? "workbench-new";
      const page = pageFromRoute(route);
      const [workspaceId, setWorkspaceId] = react.useState(
        () => window.localStorage.getItem(WORKSPACE_KEY) ?? "",
      );
      const [workspaces, setWorkspaces] = react.useState([]);
      const [identity, setIdentity] = react.useState(null);
      const [config, setConfig] = react.useState(null);
      const [access, setAccess] = react.useState(null);
      const [conversationId, setConversationId] = react.useState("");
      const [conversations, setConversations] = react.useState([]);
      const [payload, setPayload] = react.useState(null);
      const [pendingSelections, setPendingSelections] = react.useState([]);
      const [draft, setDraft] = react.useState("");
      const [view, setView] = react.useState("chat");
      const [activeReport, setActiveReport] = react.useState(null);
      const [status, setStatus] = react.useState("idle");
      const [error, setError] = react.useState("");
      const [toast, setToast] = react.useState("");
      const [settingsOpen, setSettingsOpen] = react.useState(false);
      const [resetConfirm, setResetConfirm] = react.useState(false);
      const [externalRuntimeId, setExternalRuntimeId] = react.useState("");
      const [defaultTimeRange, setDefaultTimeRange] = react.useState("7d");
      const [externalRuntimes, setExternalRuntimes] = react.useState([]);
      const chatRef = react.useRef(null);
      const reportRef = react.useRef(null);
      const reportScroll = react.useRef(0);
      const inputRef = react.useRef(null);
      const lastWorkspaceRef = react.useRef("");
      const loadingConversation = react.useRef("");
      const active = sidePanel.open && sidePanel.activeTab === "data-agent";

      const showToast = react.useCallback((message) => {
        setToast(message);
        window.setTimeout(() => setToast(""), 2600);
      }, []);

      const loadConversation = react.useCallback(async (id) => {
        if (id === "" || loadingConversation.current === id) return;
        loadingConversation.current = id;
        try {
          const result = await request(
            `${API}/conversation?id=${encodeURIComponent(id)}`,
          );
          setConversationId(result.conversation.id);
          setPayload(result);
          if (
            result.conversation.workspaceId !== workspaceId &&
            result.conversation.workspaceId !== ""
          ) {
            setWorkspaceId(result.conversation.workspaceId);
          }
          setError("");
        } catch (cause) {
          if (cause.code !== "not_found") setError(cause.message);
          setConversationId("");
          setPayload(null);
        } finally {
          loadingConversation.current = "";
        }
      }, [workspaceId]);

      const loadWorkspaceData = react.useCallback(async () => {
        if (workspaceId === "") return;
        setStatus("loading");
        try {
          const [bootstrap, identityResult, conversationResult, runtimeResult] = await Promise.all([
            request(`${API}?workspaceId=${encodeURIComponent(workspaceId)}`),
            request(`/api/collab/teammates/detail?teammateId=data-agent`).catch(
              () => ({ teammate: null }),
            ),
            request(
              `${API}/conversations?workspaceId=${encodeURIComponent(workspaceId)}`,
            ),
            request(
              `/api/collab/agent/external-runtimes?workspaceId=${encodeURIComponent(workspaceId)}`,
            ).catch(() => ({ runtimes: [] })),
          ]);
          setIdentity(identityResult.teammate ?? bootstrap.identity);
          setConfig(bootstrap.workspaceConfig);
          setAccess(bootstrap.access);
          setExternalRuntimeId(bootstrap.workspaceConfig.externalRuntimeId ?? "");
          setDefaultTimeRange(bootstrap.workspaceConfig.defaultTimeRange ?? "7d");
          setConversations(conversationResult.conversations ?? []);
          setExternalRuntimes(
            (runtimeResult.runtimes ?? []).filter(
              (runtime) => runtime.status === "active",
            ),
          );
          const stored = window.localStorage.getItem(
            `${CONVERSATION_PREFIX}${workspaceId}`,
          );
          const preferred =
            conversationResult.conversations?.some(
              (item) => item.id === conversationId,
            )
              ? conversationId
              : conversationResult.conversations?.some(
                    (item) => item.id === stored,
                  )
                ? stored
                : conversationResult.conversations?.[0]?.id;
          if (preferred) {
            await loadConversation(preferred);
          } else {
            setConversationId("");
            setPayload(null);
          }
          setStatus("ready");
          setError("");
          window.localStorage.setItem(WORKSPACE_KEY, workspaceId);
        } catch (cause) {
          setStatus("error");
          setError(cause.message);
        }
      }, [conversationId, loadConversation, workspaceId]);

      react.useEffect(() => {
        let disposed = false;
        void Promise.all([
          request("/api/collab/team/workspaces"),
          request("/api/collab/auth/me").catch(() => ({ user: null })),
        ])
          .then(([workspaceResult]) => {
            if (disposed) return;
            const memberships = (workspaceResult.workspaces ?? []).filter(
              (workspace) => workspace.isMember !== false,
            );
            setWorkspaces(memberships);
          if (memberships[0]?.id !== undefined) {
            window.__pluginmaxDataAgentWorkspaceId = memberships[0].id;
          }
            setWorkspaceId((current) => {
              const preferred =
                current ||
                window.localStorage.getItem(WORKSPACE_KEY) ||
                memberships[0]?.id ||
                "";
              return memberships.some((workspace) => workspace.id === preferred)
                ? preferred
                : (memberships[0]?.id ?? "");
            });
          })
          .catch((cause) => setError(cause.message));
        return () => {
          disposed = true;
        };
      }, []);

      react.useEffect(() => {
        if (!active || workspaceId === "" || lastWorkspaceRef.current === workspaceId) {
          return;
        }
        lastWorkspaceRef.current = workspaceId;
        void loadWorkspaceData();
      }, [active, loadWorkspaceData, workspaceId]);

      react.useEffect(() => {
        const receiveSelection = (event) => {
          const selection = event?.detail?.selection;
          if (!selection) return;
          if (
            selection.source?.workspaceId &&
            selection.source.workspaceId !== workspaceId
          ) {
            setWorkspaceId(selection.source.workspaceId);
            setConversationId("");
            setPayload(null);
          }
          setPendingSelections((current) => {
            const signature = `${selection.entityType ?? selection.kind}:${selection.entityId ?? selection.title}`;
            return current.some(
              (item) =>
                `${item.entityType ?? item.kind}:${item.entityId ?? item.title}` ===
                signature,
            )
              ? current
              : [...current, selection];
          });
          setView("chat");
          window.requestAnimationFrame(() => inputRef.current?.focus());
        };
        window.addEventListener("pluginmax:data-agent-selection", receiveSelection);
        return () =>
          window.removeEventListener(
            "pluginmax:data-agent-selection",
            receiveSelection,
          );
      }, [workspaceId]);

      const activeRun = payload?.runs?.find((run) =>
        ["queued", "running", "waiting_input"].includes(run.status),
      );
      const latestReports = payload?.reports ?? [];
      const conversation =
        payload?.conversation ??
        conversations.find((item) => item.id === conversationId);

      react.useEffect(() => {
        if (!active || conversationId === "") return undefined;
        const timer = window.setInterval(() => {
          void loadConversation(conversationId);
          void request(
            `${API}/conversations?workspaceId=${encodeURIComponent(workspaceId)}`,
          )
            .then((result) => setConversations(result.conversations ?? []))
            .catch(() => undefined);
        }, 2200);
        return () => window.clearInterval(timer);
      }, [active, conversationId, loadConversation, workspaceId]);

      react.useEffect(() => {
        if (view === "chat" && chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
      }, [payload?.messages?.length, activeRun?.status, view]);

      react.useEffect(() => {
        setActiveReport((current) => {
          if (current === null) return current;
          return latestReports.find((item) => item.id === current.id) ?? current;
        });
      }, [payload?.reports]);

      react.useEffect(() => {
        if (conversationId !== "" && workspaceId !== "") {
          window.localStorage.setItem(
            `${CONVERSATION_PREFIX}${workspaceId}`,
            conversationId,
          );
        }
      }, [conversationId, workspaceId]);

      const send = async () => {
        if (status === "sending") return;
        if (draft.trim() === "" && pendingSelections.length === 0) return;
        const prompt = draft.trim();
        const targetReport = activeReport ?? latestReports[0];
        if (/生成\s*HTML\s*版/i.test(prompt) && targetReport !== undefined) {
          setDraft("");
          setView("report");
          await renderHtml(targetReport);
          return;
        }
        const selections = pendingSelections;
        setStatus("sending");
        setError("");
        try {
          const result = await request(`${API}/query`, {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              ...(conversationId === "" ? {} : { conversationId }),
              ...(conversation?.projectId === undefined
                ? {}
                : { projectId: conversation.projectId }),
              ...(conversation?.meetingId === undefined
                ? {}
                : { meetingId: conversation.meetingId }),
              page,
              prompt,
              selections,
            }),
          });
          setConversationId(result.conversation.id);
          setDraft("");
          setPendingSelections([]);
          setView("chat");
          await loadConversation(result.conversation.id);
          showToast("已发送给 Data Agent");
        } catch (cause) {
          setError(cause.message);
        } finally {
          setStatus("ready");
        }
      };

      const openReport = (report) => {
        if (view === "report" && reportRef.current) {
          reportScroll.current = reportRef.current.scrollTop;
        }
        setActiveReport(report);
        setView("report");
        window.requestAnimationFrame(() => {
          if (reportRef.current) {
            reportRef.current.scrollTop = reportScroll.current;
          }
        });
      };

      const renderHtml = async (report) => {
        try {
          const result = await request(`${API}/render-html`, {
            method: "POST",
            body: JSON.stringify({
              reportId: report.id,
              reportVersion: report.version,
            }),
          });
          const nextReports = latestReports.map((item) =>
            item.id === report.id ? { ...item, html: result.html } : item,
          );
          setPayload((current) =>
            current === null ? current : { ...current, reports: nextReports },
          );
          setActiveReport((current) =>
            current?.id === report.id
              ? { ...current, html: result.html }
              : current,
          );
          showToast("HTML 版已基于当前报告快照生成");
        } catch (cause) {
          setError(cause.message);
        }
      };

      const saveSettings = async () => {
        setStatus("saving");
        try {
          const result = await request(`${API}/config`, {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              defaultTimeRange,
              externalRuntimeId:
                externalRuntimeId.trim() === "" ? null : externalRuntimeId.trim(),
            }),
          });
          setConfig(result.workspaceConfig);
          setSettingsOpen(false);
          showToast("Data Agent 配置已保存");
        } catch (cause) {
          setError(cause.message);
        } finally {
          setStatus("ready");
        }
      };

      const reset = async () => {
        setStatus("resetting");
        try {
          const result = await request(`${API}/reset`, {
            method: "POST",
            body: JSON.stringify({ workspaceId }),
          });
          setConfig(result.workspaceConfig);
          setExternalRuntimeId(result.workspaceConfig.externalRuntimeId ?? "");
          setDefaultTimeRange(result.workspaceConfig.defaultTimeRange);
          setResetConfirm(false);
          setSettingsOpen(false);
          showToast("Data Agent 已恢复当前工作区默认配置");
        } catch (cause) {
          setError(cause.message);
        } finally {
          setStatus("ready");
        }
      };

      const createConversation = () => {
        setConversationId("");
        setPayload(null);
        setPendingSelections([]);
        setDraft("");
        setView("chat");
        window.requestAnimationFrame(() => inputRef.current?.focus());
      };

      const messages = payload?.messages ?? [];
      const attachments = payload?.attachments ?? [];
      let body = null;
      if (status === "loading" && payload === null) {
        body = h("div", { className: "pmda-loading" }, "正在加载 Data Agent…");
      } else if (workspaceId === "") {
        body = h(
          "div",
          { className: "pmda-empty" },
          h("div", { className: "pmda-empty-mark" }, ICONS.spark),
          h("h2", null, "当前没有可用的工作区"),
          h("p", null, "加入工作区后，Data Agent 会在授权范围内提供只读分析。"),
        );
      } else if (view === "report" && activeReport) {
        body = h(
          "div",
          { ref: reportRef, className: "pmda-report" },
          h(
            "div",
            { className: "pmda-report-toolbar" },
            h(
              "button",
              {
                type: "button",
                className: "pmda-btn",
                onClick: () => {
                  reportScroll.current = reportRef.current?.scrollTop ?? 0;
                  setView("chat");
                },
              },
              ICONS.chevron,
              "返回对话",
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmda-btn",
                onClick: () =>
                  void downloadReport(activeReport, "md").catch((cause) =>
                    setError(cause.message),
                  ),
              },
              ICONS.download,
              "下载 Markdown",
            ),
            activeReport.html
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pmda-btn",
                    onClick: () =>
                      void downloadReport(activeReport, "html").catch((cause) =>
                        setError(cause.message),
                      ),
                  },
                  "下载 HTML",
                )
              : h(
                  "button",
                  {
                    type: "button",
                    className: "pmda-btn agent",
                    onClick: () => void renderHtml(activeReport),
                  },
                  "生成 HTML 版",
                ),
          ),
          renderReportMarkdown(activeReport),
        );
      } else {
        const reportsById = new Map(
          latestReports.map((report) => [report.id, report]),
        );
        const attachmentsByMessage = new Map();
        for (const attachment of attachments) {
          const list =
            attachmentsByMessage.get(attachment.messageId) ?? [];
          list.push(attachment);
          attachmentsByMessage.set(attachment.messageId, list);
        }
        body = h(
          react.Fragment,
          null,
          h(
            "div",
            { ref: chatRef, className: "pmda-chat" },
            messages.length === 0 ? h(
              "div",
              { className: "pmda-empty" },
              h("div", { className: "pmda-empty-mark" }, ICONS.spark),
              h(
                "h2",
                null,
                pendingSelections.length > 0
                  ? "已载入你选中的内容"
                  : "从一个数据问题开始",
              ),
              h(
                "p",
                null,
                pendingSelections.length > 0
                  ? "可以补充分析目标、时间范围或关注指标，也可以直接发送。"
                  : "可以直接提问，也可以先选中页面中的任务、工作流、会议、指标或文字。",
              ),
              h(
                "div",
                { className: "pmda-suggestions" },
                ...(
                  pendingSelections.length > 0
                    ? ["找出主要原因", "与上一周期对比", "生成分析报告"]
                    : ["查看今日异常", "生成本周工作简报", "解释当前指标口径"]
                ).map((label) =>
                  h(
                    "button",
                    {
                      key: label,
                      type: "button",
                      className: "pmda-suggestion",
                      onClick: () => {
                        setDraft(label);
                        inputRef.current?.focus();
                      },
                    },
                    label,
                  ),
                ),
              ),
            ) : null,
            h(
              "div",
              { className: "pmda-messages" },
              ...messages.map((message) => {
                const user = message.senderType === "user";
                const report =
                  message.reportId === undefined
                    ? undefined
                    : reportsById.get(message.reportId);
                return h(
                  "article",
                  {
                    key: message.id,
                    className: `pmda-message${user ? " user" : ""}`,
                  },
                  h(
                    "div",
                    { className: "pmda-message-meta" },
                    h("strong", null, user ? "你" : "Data Agent"),
                    h(
                      "span",
                      null,
                      new Date(message.createdAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    ),
                  ),
                  user &&
                  (attachmentsByMessage.get(message.id) ?? []).length > 0
                    ? h(
                        "div",
                        { className: "pmda-attachments" },
                        ...(attachmentsByMessage.get(message.id) ?? []).map(
                          (attachment) =>
                            h(AttachmentCard, {
                              key: attachment.id,
                              attachment,
                            }),
                        ),
                      )
                    : null,
                  report
                    ? h(ReportCard, {
                        report,
                        onOpen: openReport,
                        onGenerateHtml: (item) => void renderHtml(item),
                        onDownload: (item, format) =>
                          void downloadReport(item, format).catch((cause) =>
                            setError(cause.message),
                          ),
                      })
                    : h("div", { className: "pmda-bubble" }, message.content),
                );
              }),
              activeRun
                ? h(
                    "div",
                    { className: "pmda-progress" },
                    h("span", { className: "pmda-spinner" }),
                    h(
                      "span",
                      null,
                      activeRun.status === "queued"
                        ? "正在校验权限并准备分析…"
                        : activeRun.status === "waiting_input"
                          ? "等待补充输入…"
                          : "正在查询授权数据并生成 Markdown 报告…",
                    ),
                  )
                : null,
            ),
          ),
          h(
            "div",
            { className: "pmda-composer" },
            pendingSelections.length > 0
              ? h(
                  "div",
                  { className: "pmda-attachments" },
                  ...pendingSelections.map((selection, index) =>
                    h(AttachmentCard, {
                      key: `${selection.entityId ?? selection.title}-${index}`,
                      attachment: selection,
                      removable: true,
                      onRemove: () =>
                        setPendingSelections((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        ),
                    }),
                  ),
                )
              : null,
            h(
              "form",
              {
                className: "pmda-composer-box",
                onSubmit: (event) => {
                  event.preventDefault();
                  void send();
                },
              },
              h("textarea", {
                ref: inputRef,
                value: draft,
                rows: 2,
                placeholder: "补充你想分析的问题，例如：找出主要原因并说明证据…",
                "aria-label": "向 Data Agent 提问",
                onChange: (event) => setDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                },
              }),
              h(
                "button",
                {
                  type: "submit",
                  className: "pmda-send",
                  disabled:
                    status === "sending" ||
                    (draft.trim() === "" && pendingSelections.length === 0),
                  title: "发送",
                  "aria-label": "发送",
                },
                status === "sending"
                  ? h("span", { className: "pmda-spinner" })
                  : ICONS.send,
              ),
            ),
            h(
              "div",
              { className: "pmda-note" },
              h("span", null, "只读查询 · 行级权限校验"),
              h("span", null, config?.defaultTimeRange ?? "7d"),
            ),
          ),
        );
      }

      return h(
        react.Fragment,
        null,
        h("style", null, styles),
        h(
          "div",
          {
            className: "pmda-panel-root",
            style: active ? undefined : { display: "none" },
            "data-data-agent-panel": "true",
          },
          h(
            "aside",
            { className: "pmda-panel", "aria-label": "Data Agent" },
            h(SidePanelTabs),
            h(
              "header",
              { className: "pmda-head" },
              h("div", { className: "pmda-avatar" }, "DA"),
              h(
                "div",
                { className: "pmda-title" },
                h("strong", null, "Data Agent"),
                h(
                  "small",
                  null,
                  `${config?.timezone ?? "Asia/Shanghai"} · ${page} · ${identity?.roleLabel ?? "平台内置"}`,
                ),
              ),
              h(
                "span",
                { className: "pmda-chip" },
                ICONS.shield,
                "受保护",
              ),
              h(
                "div",
                { className: "pmda-head-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmda-iconbtn",
                    title: "Data Agent 设置",
                    "aria-label": "Data Agent 设置",
                    onClick: () => setSettingsOpen(true),
                  },
                  ICONS.settings,
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmda-iconbtn",
                    title: sidePanel.expanded ? "还原侧边栏" : "展开侧边栏",
                    "aria-label": sidePanel.expanded ? "还原侧边栏" : "展开侧边栏",
                    onClick: () => window.__pluginmaxSidePanel?.toggleExpanded(),
                  },
                  sidePanel.expanded ? ICONS.collapse : ICONS.expand,
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmda-iconbtn",
                    title: "关闭侧边栏",
                    "aria-label": "关闭侧边栏",
                    onClick: () => window.__pluginmaxSidePanel?.closeAll(),
                  },
                  ICONS.close,
                ),
              ),
            ),
            h(
              "div",
              { className: "pmda-context" },
              h("span", null, "工作区"),
              h(
                "select",
                {
                  value: workspaceId,
                  "aria-label": "选择工作区",
                  onChange: (event) => {
                    const next = event.target.value;
                    setWorkspaceId(next);
                    setConversationId("");
                    setPayload(null);
                    lastWorkspaceRef.current = "";
                  },
                },
                ...workspaces.map((workspace) =>
                  h(
                    "option",
                    { key: workspace.id, value: workspace.id },
                    workspace.title ?? workspace.path ?? workspace.id,
                  ),
                ),
              ),
              conversations.length > 0
                ? h(
                    "select",
                    {
                      value: conversationId,
                      "aria-label": "切换 Data Agent 会话",
                      onChange: (event) => {
                        const id = event.target.value;
                        if (id === "__new__") createConversation();
                        else void loadConversation(id);
                      },
                    },
                    h("option", { value: "__new__" }, "新会话"),
                    ...conversations.map((item) =>
                      h(
                        "option",
                        { key: item.id, value: item.id },
                        item.title,
                      ),
                    ),
                  )
                : null,
              h(
                "button",
                {
                  type: "button",
                  className: "pmda-btn",
                  onClick: createConversation,
                },
                ICONS.plus,
                "新会话",
              ),
            ),
            error !== ""
              ? h(
                  "div",
                  { style: { padding: "8px 10px 0" } },
                  h("div", { className: "pmda-error" }, error),
                )
              : null,
            h("div", { className: "pmda-body" }, body),
          ),
        ),
        settingsOpen
          ? h(
              "div",
              {
                className: "pmda-mask",
                onClick: (event) => {
                  if (event.target === event.currentTarget) setSettingsOpen(false);
                },
              },
              h(
                "section",
                {
                  className: "pmda-modal",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": "Data Agent 设置",
                },
                h(
                  "div",
                  { className: "pmda-modal-head" },
                  h("h2", null, resetConfirm ? "恢复 Data Agent 默认配置" : "Data Agent 设置"),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmda-iconbtn",
                      "aria-label": "关闭",
                      onClick: () => {
                        setResetConfirm(false);
                        setSettingsOpen(false);
                      },
                    },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmda-modal-body" },
                  resetConfirm
                    ? h(
                        react.Fragment,
                        null,
                        h(
                          "p",
                          { style: { margin: "0 0 12px", color: "var(--dsw-alias-label-secondary)", fontSize: 11, lineHeight: 1.65 } },
                          "仅重置当前工作区中的可恢复配置，不删除数据连接、历史报告、Agent Run、任务或审计记录。",
                        ),
                        h(
                          "div",
                          { className: "pmda-scope" },
                          h(
                            "div",
                            null,
                            h("strong", null, "将重置"),
                            h("ul", null, ...[
                              "补充指令与默认偏好",
                              "项目、指标与数据源优先级",
                              "洞察阈值与通知偏好",
                              "缓存的分析记忆",
                            ].map((item) => h("li", { key: item }, item))),
                          ),
                          h(
                            "div",
                            null,
                            h("strong", null, "将保留"),
                            h("ul", null, ...[
                              "数据连接与授权",
                              "历史报告与 Agent Run",
                              "已创建任务和文件",
                              "工作区指标 Skill 版本",
                            ].map((item) => h("li", { key: item }, item))),
                          ),
                        ),
                      )
                    : h(
                        react.Fragment,
                        null,
                        h(
                          "div",
                          { className: "pmda-field" },
                          h("label", null, "默认时间范围"),
                          h(
                            "select",
                            {
                              className: "pmda-select",
                              value: defaultTimeRange,
                              onChange: (event) => setDefaultTimeRange(event.target.value),
                            },
                            h("option", { value: "today" }, "今天"),
                            h("option", { value: "7d" }, "过去 7 天"),
                            h("option", { value: "30d" }, "过去 30 天"),
                            h("option", { value: "month" }, "本月"),
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmda-field" },
                          h("label", null, "Codex / Codebuddy 外部运行时 ID"),
                          h(
                            "select",
                            {
                              className: "pmda-select",
                              value: externalRuntimeId,
                              onChange: (event) =>
                                setExternalRuntimeId(event.target.value),
                            },
                            h("option", { value: "" }, "平台内置运行时"),
                            ...externalRuntimes.map((runtime) =>
                              h(
                                "option",
                                { key: runtime.id, value: runtime.id },
                                `${runtime.name} · ${runtime.provider}`,
                              ),
                            ),
                          ),
                          h(
                            "small",
                            { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 9.5, lineHeight: 1.5 } },
                            "外部运行时沿用平台 Runtime Profile、工具白名单与 Action Ticket；不会绕过只读策略。",
                          ),
                        ),
                        config
                          ? h(
                              "div",
                              { className: "pmda-note", style: { color: "var(--dsw-alias-label-tertiary)" } },
                              h("span", null, `工作区 revision ${config.revision}`),
                              h("span", null, `${config.dataConnectionIds?.length ?? 0} 个只读连接`),
                            )
                          : null,
                      ),
                ),
                h(
                  "div",
                  { className: "pmda-modal-foot" },
                  resetConfirm
                    ? h(
                        react.Fragment,
                        null,
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmda-btn",
                            onClick: () => setResetConfirm(false),
                          },
                          "取消",
                        ),
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmda-btn agent",
                            disabled: status === "resetting",
                            onClick: () => void reset(),
                          },
                          status === "resetting" ? "恢复中…" : "恢复默认",
                        ),
                      )
                    : h(
                        react.Fragment,
                        null,
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmda-btn",
                            disabled: access?.canManage !== true,
                            onClick: () => setResetConfirm(true),
                          },
                          ICONS.reset,
                          "恢复默认",
                        ),
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmda-btn",
                            onClick: () => setSettingsOpen(false),
                          },
                          "取消",
                        ),
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmda-btn primary",
                            disabled: status === "saving" || access?.canManage !== true,
                            onClick: () => void saveSettings(),
                          },
                          status === "saving" ? "保存中…" : "保存配置",
                        ),
                      ),
                ),
              ),
            )
          : null,
        toast !== "" ? h("div", { className: "pmda-toast", role: "status" }, toast) : null,
      );
    }

    exports.inject = ["slots"];
    exports.__test = {
      ENTITY_LABELS,
      createSelectionRegistry,
      pageFromRoute,
    };
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.global.actions", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global.actions",
            id: "pluginmax-data-agent-action",
            order: 10,
          },
          GlobalDataAgentAction,
        ),
      );
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: "pluginmax-data-agent-selection",
            order: 8,
          },
          SelectionLayer,
        ),
      );
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: "pluginmax-data-agent-panel",
            order: 30,
          },
          DataAgentPanel,
        ),
      );
    };

    return module.exports;
  },
});
