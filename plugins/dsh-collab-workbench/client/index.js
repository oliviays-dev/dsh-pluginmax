window.__ModuleLoader__.load({
  id: "dsh-collab-workbench",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";
    const LAYOUT_KEY = "dsh-workbench-layouts-v1";
    const READ_STATE_KEY = "dsh-workbench-read-state-v1";
    const TZ_OFFSET = -new Date().getTimezoneOffset();
    const GRID_GAP = 14;
    const MIN_HEIGHT = 190;
    const MAX_HEIGHT = 900;
    const WIDTH_COLS = [1, 2, 3, 4, 5, 6];

    const MODULE_META = {
      metrics: { id: "metrics", title: "核心指标", defaultCols: 6 },
      brief: { id: "brief", title: "每日简报", defaultCols: 6 },
      todo: { id: "todo", title: "我的待办", defaultCols: 4 },
      focus: { id: "focus", title: "重点关注", defaultCols: 2 },
      "meeting-minutes": {
        id: "meeting-minutes",
        title: "会议纪要",
        defaultCols: 4,
      },
      control: { id: "control", title: "供给例外", defaultCols: 2 },
      supplier: { id: "supplier", title: "供应商风险", defaultCols: 4 },
    };
    const FACTORY_ORDER = [
      "metrics",
      "brief",
      "todo",
      "focus",
      "meeting-minutes",
      "control",
      "supplier",
    ];
    const MODULE_ORDER = FACTORY_ORDER;
    const READ_MODULES = new Set(["todo", "focus", "meeting-minutes"]);
    const BRIEF_INCLUDE_OPTIONS = [
      { id: "task_review", label: "待我验收" },
      { id: "task_escalation", label: "任务升级" },
      { id: "task_nudge", label: "被催办" },
      { id: "run_terminal", label: "执行异常" },
      { id: "workflow_blocked", label: "流程阻塞" },
      { id: "workflow_approval", label: "审批等待" },
    ];
    const BRIEF_SECTION_META = {
      progress: {
        title: "项目关键进展",
        limit: 3,
        help: "只展示已确认的结果、决策或业务影响。普通任务动作、执行次数和打开页面不进入首屏。",
      },
      anomaly: {
        title: "异常提醒",
        limit: 2,
        help: "只展示命中阈值或状态规则的任务、工作流和运行异常。同一事项会合并为一条。",
      },
      attention: {
        title: "待你处理",
        limit: 1,
        help: "只保留需要你决定、验收、授权或协调的事项；普通待办不进入这里。",
      },
    };

    function itemReadSignature(item) {
      return `${item?.kind ?? "item"}:${item?.id ?? ""}:${item?.updatedAt ?? ""}`;
    }

    function filterUnreadItems(items, view, isRead) {
      return view === "unread" ? items.filter((item) => !isRead(item)) : items;
    }

    function readReadStates() {
      try {
        const raw = JSON.parse(
          window.localStorage.getItem(READ_STATE_KEY) ?? "{}",
        );
        return raw !== null && typeof raw === "object" && !Array.isArray(raw)
          ? raw
          : {};
      } catch {
        return {};
      }
    }

    /*
     * 方案 B 的项目范围开关：两段式，选中段 = 当前实际视图。
     * 样式与任务管理页的 `.pmtask-scope-seg` 保持严格一致。
     */
    const SCOPE_BUTTON_STYLES = `
.pmwb-scope-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
.pmwb-scope-seg > button{height:24px;border:0;border-radius:6px;padding:0 8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
.pmwb-scope-seg > button:not(.active):hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
.pmwb-scope-seg > button.active{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
`;

    const styles = `
.pmwb{display:grid;gap:14px;min-height:100%;margin-top:-4px;color:var(--dsw-alias-label-primary);}
.pmwb *,.pmwb *::before,.pmwb *::after{box-sizing:border-box;}
.pmwb-head{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:-18px -20px 14px;padding:14px 20px 10px;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l2);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);}
.pmwb-tabs{display:inline-flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
.pmwb-tab{min-height:28px;padding:4px 12px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;font-weight:600;white-space:nowrap;cursor:pointer;}
.pmwb-tab.active{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);}
.pmwb-tab:not(.active):hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
${SCOPE_BUTTON_STYLES}
.pmwb-head-actions{display:flex;align-items:center;gap:7px;margin-left:auto;}
.pmwb-iconbtn{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);cursor:pointer;}
.pmwb-iconbtn:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
.pmwb-iconbtn:disabled{opacity:.5;cursor:not-allowed;}
.pmwb-iconbtn svg{width:14px;height:14px;}
.pmwb-iconbtn.active{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 50%,transparent);}
.pmwb-iconbtn.spinning svg{animation:pmwb-spin .9s linear infinite;}
@keyframes pmwb-spin{to{transform:rotate(360deg);}}
.pmwb-canvas{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;align-items:start;}
.pmwb-card{position:relative;grid-column:span var(--pmwb-cols,2);min-width:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
.pmwb-card.dragging{opacity:.48;border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 18px 38px rgba(0,0,0,.24);z-index:4;}
.pmwb-card.drop-target{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base)));}
.pmwb-card-head{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;padding:11px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);cursor:grab;touch-action:none;}
.pmwb-card.dragging .pmwb-card-head{cursor:grabbing;}
.pmwb-card-head button,.pmwb-card-head a,.pmwb-card-head input,.pmwb-card-head select{ cursor:pointer;}
.pmwb-title{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;}
.pmwb-title h2{flex:none;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:14px;line-height:1.3;white-space:nowrap;}
.pmwb-count{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:500;line-height:1.2;}
.pmwb-count.badge{padding:1px 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);font-weight:650;}
.pmwb-card[data-module="brief"] .pmwb-title h2{flex:0 1 auto;}
.pmwb-title > .pmwb-seg{flex:none;margin-left:2px;}
.pmwb-actions{display:flex;align-items:center;gap:6px;margin-left:auto;flex:0 1 auto;min-width:0;flex-wrap:nowrap;justify-content:flex-end;}
.pmwb-pill{flex:none;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6;white-space:nowrap;}
.pmwb-pill.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-pill.progress{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
.pmwb-pill.review{color:var(--dsw-alias-state-warning-primary,#e2a737);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 14%,transparent);}
.pmwb-pill.done{color:var(--dsw-alias-state-success-primary,#34d47e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 14%,transparent);}
.pmwb-pill.cancelled{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-pill.warn{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
.pmwb-pill.ok{color:var(--dsw-alias-state-success-primary,#3fb950);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent);}
.pmwb-pill.accent{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
.pmwb-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);}
.pmwb-seg button{min-height:22px;padding:1px 8px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;}
.pmwb-seg button.active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-weight:600;}
.pmwb-meta{min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;text-align:right;}
.pmwb-card-body{flex:1;min-height:0;padding:12px 14px 14px;overflow:auto;}
.pmwb-card.resized .pmwb-card-body{overscroll-behavior:contain;}
.pmwb-resize-height{position:absolute;left:0;right:16px;bottom:0;z-index:3;height:12px;border:0;background:transparent;cursor:ns-resize;touch-action:none;}
.pmwb-resize-height::before{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--dsw-alias-accent-primary,#4f8ef7);opacity:.14;transition:opacity .15s;}
.pmwb-resize-height:hover::before,.pmwb-card.resizing .pmwb-resize-height::before{opacity:.9;}
.pmwb-card.resizing .pmwb-resize-height{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,transparent);}
.pmwb-resize-width{position:absolute;top:0;right:0;bottom:22px;z-index:3;width:14px;border:0;background:transparent;cursor:ew-resize;touch-action:none;}
.pmwb-resize-width::before{content:"";position:absolute;top:0;right:0;bottom:0;width:3px;background:var(--dsw-alias-accent-primary,#4f8ef7);opacity:.14;transition:opacity .15s;}
.pmwb-resize-width:hover::before{opacity:.9;}
.pmwb-stack{display:grid;gap:8px;}
.pmwb-empty{padding:18px 10px;color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center;}
.pmwb-error{display:grid;gap:8px;justify-items:start;padding:12px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 32%,transparent);border-radius:8px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:12px;line-height:1.5;}
.pmwb-loading{display:grid;gap:8px;}
.pmwb-skeleton{height:34px;border-radius:6px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-2),var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base)),var(--dsw-alias-bg-layer-2));background-size:200% 100%;animation:pmwb-shimmer 1.4s linear infinite;}
@keyframes pmwb-shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.pmwb-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:26px;padding:2px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap;}
.pmwb-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}
.pmwb-btn.primary{border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:600;}
.pmwb-btn:disabled{opacity:.5;cursor:not-allowed;}
.pmwb-item{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name actions" "id time" "note note" "meta meta" "owner owner";column-gap:10px;row-gap:4px;align-items:start;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;}
.pmwb-item.pmwb-item-focus{grid-template-areas:"name actions" "id time" "note note" "owner owner";}
.pmwb-item:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));}
.pmwb-item.read{opacity:.7;}
.pmwb-item.read:hover{opacity:.86;}
.pmwb-item.meeting{grid-template-areas:"name actions" "meta time" "sub sub" "owner owner";}
.pmwb-item-title{display:flex;align-items:baseline;gap:7px;min-width:0;flex-wrap:wrap;}
.pmwb-item-title .id{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;}
.pmwb-item-title strong{min-width:0;font-size:12.5px;line-height:1.45;}
.pmwb-item-id{grid-area:id;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;}
.pmwb-item-name{grid-area:name;color:var(--dsw-alias-label-primary);font-size:12.5px;font-weight:650;line-height:1.45;overflow-wrap:anywhere;}
.pmwb-item-status{grid-area:status;display:grid;justify-items:end;align-content:start;text-align:right;color:var(--dsw-alias-state-success-primary,#34d47e);font-size:11.5px;line-height:1.45;}
.pmwb-item-status span{max-width:100%;overflow-wrap:anywhere;}
.pmwb-item-note{grid-area:note;min-width:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5;overflow-wrap:anywhere;}
.pmwb-note-status{color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.pmwb-note-status.accent{color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb-note-status.warn{color:var(--dsw-alias-state-warning-primary,#e2a737);}
.pmwb-note-status.ok{color:var(--dsw-alias-state-success-primary,#34d47e);}
.pmwb-note-status.high{color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-note-divider{margin:0 4px;color:var(--dsw-alias-label-tertiary);}
.pmwb-note-latest{color:var(--dsw-alias-label-secondary);}
.pmwb-note-latest b{color:var(--dsw-alias-label-primary);font-weight:600;}
.pmwb-item-owner{grid-area:owner;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:11px;}
.pmwb-owner{display:inline-flex;align-items:center;gap:5px;min-width:0;}
.pmwb-owner-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb-owner.is-left{color:var(--dsw-alias-label-tertiary);}
.pmwb-owner.is-left .pmwb-avatar{opacity:.55;}
.pmwb-owner.is-pending{color:var(--dsw-alias-label-secondary);}
.pmwb-participants{display:flex;align-items:center;flex-wrap:wrap;gap:5px 6px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:11px;}
.pmwb-participants-label{flex:none;color:var(--dsw-alias-label-tertiary);}
.pmwb-participant-separator{color:var(--dsw-alias-label-tertiary);}
.pmwb-meeting-meta{display:grid;gap:4px;margin-top:3px;font-size:11px;color:var(--dsw-alias-label-secondary);}
.pmwb-meeting-line{display:flex;align-items:center;gap:6px;min-width:0;}
.pmwb-meeting-line .pmwb-participants{flex:1 1 auto;gap:5px;}
.pmwb-avatar{display:grid;place-items:center;width:18px;height:18px;flex:none;border-radius:50%;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:9px;font-weight:700;}
.pmwb-avatar.human{background:#2f9e66;color:#fff;}
.pmwb-avatar.role{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 18%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
.pmwb-avatar.agent{width:14px;height:14px;font-size:8px;background:#6f53d6;color:#fff;}
.pmwb-avatar-ring{display:grid;place-items:center;width:20px;height:20px;flex:none;padding:2px;border-radius:50%;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.26);}
.pmwb-item-sub{grid-area:sub;display:block;width:100%;margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;overflow-wrap:anywhere;}
.pmwb-item-sub b{color:var(--dsw-alias-label-primary);}
.pmwb-item-sub.placeholder{color:var(--dsw-alias-label-tertiary);}
.pmwb-minutes-badge{display:inline-block;margin-right:4px;padding:0 5px;border-radius:4px;font-size:10px;line-height:16px;vertical-align:1px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 18%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
.pmwb-minutes-badge.confirmed{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 16%,transparent);color:var(--dsw-alias-state-success-primary,#34d47e);}
.pmwb-item-meta{grid-area:meta;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:var(--dsw-alias-label-secondary);}
.pmwb-item-meta .ws{color:var(--dsw-alias-label-tertiary);}
.pmwb-item-trailing{grid-area:actions;display:flex;align-items:center;gap:6px;justify-self:end;flex-wrap:wrap;justify-content:flex-end;}
.pmwb-item-time{grid-area:time;justify-self:end;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;white-space:nowrap;}
.pmwb-read-state{display:inline-flex;align-items:center;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.8;white-space:nowrap;}
.pmwb-read-action{height:26px;padding:2px 8px;font-size:10.5px;color:var(--dsw-alias-label-secondary);}
.pmwb-brief{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 40%,var(--dsw-alias-border-l2));}
.pmwb-brief-points{display:grid;gap:8px;margin:11px 0 0;padding:0;list-style:none;}
/* 只作用于简报条目本身：结论里渲染出的 Markdown 列表 li 不能被三列栅格命中。 */
.pmwb-brief-points > li{display:grid;grid-template-columns:minmax(0,1fr) 58px 84px;align-items:start;gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);font-size:12px;line-height:1.5;cursor:pointer;}
.pmwb-brief-points > li.read{opacity:.68;}
.pmwb-brief-copy{min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;}
.pmwb-brief-copy b{color:var(--dsw-alias-label-primary);}
.pmwb-brief-title{color:var(--dsw-alias-label-primary);font-size:12.5px;font-weight:650;line-height:1.45;}
.pmwb-brief-text{margin-top:3px;line-height:1.55;}
      /* 结论里会夹带表格等块级内容，line-clamp 不生效，这里用高度裁切保证「展开全文」可见地折叠。 */
      .pmwb-brief-text.clamped{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:6;max-height:10.4em;overflow:hidden;}
      .pmwb-brief-md{display:grid;gap:5px;}
      .pmwb-brief-md p{margin:0;}
      .pmwb-brief-md h5{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-primary);}
      .pmwb-brief-md ul,.pmwb-brief-md ol{margin:0;padding-left:16px;display:grid;gap:3px;}
      .pmwb-brief-md pre{margin:0;padding:7px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;}
      .pmwb-brief-md table{border-collapse:collapse;width:100%;font-size:11px;}
      .pmwb-brief-md th,.pmwb-brief-md td{border:0.5px solid var(--dsw-alias-border-l2);padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere;}
      .pmwb-brief-md th{background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));font-weight:600;}
      .pmwb-brief-md blockquote{margin:0;padding-left:8px;border-left:2px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-tertiary);}
      .pmwb-brief-more{margin-top:4px;border:0;padding:0;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:11px;cursor:pointer;}
      .pmwb-brief-more:hover{text-decoration:underline;}
      .pmwb-brief-reason{margin-top:6px;padding-top:6px;border-top:0.5px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.5;}
.pmwb-tag{width:58px;min-height:20px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10.5px;text-align:center;white-space:nowrap;}
.pmwb-tag.data{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-tag.progress{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
.pmwb-tag.conclusion{color:var(--dsw-alias-state-success-primary,#3fb950);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent);}
.pmwb-tag.decision{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
      /* 「待我验收」沿用任务管理页待验收的琥珀色，语义与右侧「前往验收」按钮一致。 */
      .pmwb-tag.review{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
      /* 「被催办」：有人等我交付，用警示色区分于普通「待决策」。 */
      .pmwb-tag.nudge{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-brief-actions{display:grid;gap:6px;width:84px;justify-items:stretch;}
.pmwb-brief-actions .pmwb-btn{width:100%;justify-content:center;}
.pmwb-decision{margin-top:7px;padding:8px 10px;border-left:2px solid var(--dsw-alias-accent-primary,#4f8ef7);border-radius:0 6px 6px 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,transparent);font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);}
.pmwb-decision strong{display:block;margin-bottom:3px;color:var(--dsw-alias-label-primary);}
.pmwb-brief-meta{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;}
.pmwb-brief-v2{display:grid;gap:0;min-width:0;}
.pmwb-brief-section{position:relative;padding-top:12px;}
.pmwb-brief-section-head{display:flex;align-items:center;gap:6px;min-height:24px;margin-bottom:5px;}
.pmwb-brief-section-title{display:flex;align-items:center;gap:5px;margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:680;line-height:1.3;}
.pmwb-brief-section-count{padding:0 5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:17px;}
.pmwb-brief-section-actions{display:flex;align-items:center;gap:3px;margin-left:auto;}
.pmwb-brief-help-btn{width:21px;height:21px;display:grid;place-items:center;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
.pmwb-brief-help-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);}
.pmwb-brief-help-btn svg{width:12px;height:12px;}
.pmwb-brief-help{position:absolute;top:37px;left:0;z-index:8;width:min(310px,calc(100% - 8px));padding:9px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));box-shadow:0 12px 28px rgba(0,0,0,.3);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.55;}
.pmwb-brief-help strong{display:block;margin-bottom:2px;color:var(--dsw-alias-label-primary);font-size:11px;}
.pmwb-brief-linkbtn{display:inline-flex;align-items:center;gap:2px;min-height:22px;padding:0 4px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer;}
.pmwb-brief-linkbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmwb-brief-linkbtn svg{width:11px;height:11px;}
.pmwb-brief-list{overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-brief-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 14px;align-items:center;gap:9px;min-height:46px;padding:7px 10px;border:0;border-top:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;text-align:left;cursor:pointer;}
.pmwb-brief-row:first-child{border-top:0;}
.pmwb-brief-row:hover{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 6%,var(--dsw-alias-bg-layer-2));}
.pmwb-brief-row.read{opacity:.62;}
.pmwb-brief-row-main{min-width:0;}
.pmwb-brief-row-titleline{display:flex;align-items:center;gap:6px;min-width:0;}
.pmwb-brief-row-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:11.8px;font-weight:640;line-height:1.42;}
.pmwb-brief-row-kind{flex:none;padding:0 5px;border-radius:3px;font-size:9px;line-height:16px;font-weight:650;}
.pmwb-brief-row-kind.anomaly{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-brief-row-kind.attention{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
.pmwb-brief-row-sub{display:block;min-width:0;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.45;}
.pmwb-brief-row-trailing{display:flex;align-items:center;gap:6px;justify-self:end;white-space:nowrap;}
.pmwb-brief-status{display:inline-flex;align-items:center;height:19px;padding:0 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font-size:9.5px;font-weight:650;}
.pmwb-brief-status.ok{color:var(--dsw-alias-state-success-primary,#3fb950);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent);}
.pmwb-brief-status.warn{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
.pmwb-brief-status.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-brief-row-time{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmwb-brief-chevron{width:14px;height:14px;color:var(--dsw-alias-label-tertiary);transition:transform .14s ease,color .14s ease;}
.pmwb-brief-row:hover .pmwb-brief-chevron{color:var(--dsw-alias-label-primary);transform:translateX(1px);}
.pmwb-brief-empty{padding:14px 10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:center;}
.pmwb-brief-footer{display:flex;align-items:center;gap:7px;margin-top:10px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:10px;}
.pmwb-brief-footer span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb-brief-footer .pmwb-brief-linkbtn{margin-left:auto;flex:none;}
.pmwb-brief-needs{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 13%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10px;font-weight:650;white-space:nowrap;}
.pmwb-brief-needs::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;}
.pmwb-brief-drawer-mask{display:flex;justify-content:flex-end;padding:0;background:rgba(0,0,0,.38);backdrop-filter:blur(2px);}
.pmwb-brief-drawer{width:min(430px,100vw);height:100%;display:flex;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:-20px 0 54px rgba(0,0,0,.3);animation:pmwb-brief-drawer-in .18s ease-out;}
@keyframes pmwb-brief-drawer-in{from{transform:translateX(18px);opacity:.6;}to{transform:translateX(0);opacity:1;}}
.pmwb-brief-drawer-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmwb-brief-drawer-head h2{flex:1;min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;}
.pmwb-brief-drawer-body{flex:1;min-height:0;display:grid;align-content:start;gap:13px;padding:14px;overflow:auto;}
.pmwb-brief-drawer-kicker{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:10px;}
.pmwb-brief-drawer-kicker::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-warning-primary,#d29922);}
.pmwb-brief-drawer-title{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;line-height:1.42;}
.pmwb-brief-drawer-text{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.65;overflow-wrap:anywhere;}
.pmwb-brief-drawer-block{display:grid;gap:6px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb-brief-drawer-block h3{margin:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:680;}
.pmwb-brief-facts{display:grid;grid-template-columns:74px minmax(0,1fr);gap:5px 9px;margin:0;font-size:10.5px;}
.pmwb-brief-facts dt{color:var(--dsw-alias-label-tertiary);}
.pmwb-brief-facts dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;}
.pmwb-brief-evidence{width:100%;display:flex;align-items:center;gap:7px;padding:8px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);text-align:left;font:inherit;font-size:10.5px;cursor:pointer;}
.pmwb-brief-evidence:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));color:var(--dsw-alias-label-primary);}
.pmwb-brief-evidence span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb-brief-evidence svg{width:13px;height:13px;color:var(--dsw-alias-label-tertiary);}
.pmwb-brief-task{display:grid;gap:0;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;}
.pmwb-brief-task-toggle{width:100%;display:grid;grid-template-columns:14px minmax(0,1fr) auto;align-items:center;gap:7px;padding:8px 9px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);text-align:left;font:inherit;font-size:10.5px;cursor:pointer;}
.pmwb-brief-task-toggle:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);}
.pmwb-brief-task-toggle svg{width:12px;height:12px;transition:transform .14s ease;}
.pmwb-brief-task.open .pmwb-brief-task-toggle svg{transform:rotate(90deg);}
.pmwb-brief-task-toggle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb-brief-task-toggle small{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmwb-brief-task-body{display:grid;gap:9px;padding:9px 10px 11px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb-brief-task-title{margin:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.5;}
.pmwb-brief-task-description{margin:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;}
.pmwb-brief-task-grid{display:grid;grid-template-columns:52px minmax(0,1fr);gap:4px 8px;margin:0;font-size:10.5px;}
.pmwb-brief-task-grid dt{color:var(--dsw-alias-label-tertiary);}
.pmwb-brief-task-grid dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;}
.pmwb-brief-task-summary{padding:8px 9px;border-left:2px solid var(--dsw-alias-accent-primary,#4f8ef7);border-radius:0 5px 5px 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,transparent);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.6;}
.pmwb-brief-task-summary strong{display:block;margin-bottom:3px;color:var(--dsw-alias-label-primary);font-size:10px;}
.pmwb-brief-task-state{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.5;}
.pmwb-brief-task-state.error{display:flex;align-items:center;gap:7px;color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-brief-task-state.error span{flex:1;min-width:0;overflow-wrap:anywhere;}
.pmwb-brief-recommend{padding:9px 10px;border-left:2px solid var(--dsw-alias-accent-primary,#4f8ef7);border-radius:0 6px 6px 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6;}
.pmwb-brief-recommend strong{display:block;margin-bottom:2px;color:var(--dsw-alias-label-primary);}
.pmwb-brief-drawer-foot{display:flex;justify-content:flex-end;gap:7px;padding:10px 14px 12px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb-brief-settings{width:min(680px,100%);}
.pmwb-brief-tabs{display:flex;gap:14px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmwb-brief-tab{position:relative;height:34px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer;}
.pmwb-brief-tab.active{color:var(--dsw-alias-label-primary);}
.pmwb-brief-tab.active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb-brief-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
.pmwb-brief-config-option{display:flex;align-items:center;gap:7px;min-height:30px;padding:5px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);font-size:11px;cursor:pointer;}
.pmwb-brief-config-option input{margin:0;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb-brief-rule{display:grid;gap:6px;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-brief-rule-head{display:flex;align-items:center;gap:7px;}
.pmwb-brief-rule-head .pmwb-input{flex:1;}
.pmwb-brief-rule textarea{width:100%;min-height:70px;resize:vertical;padding:7px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:1.55;}
.pmwb-brief-settings-section{display:grid;gap:7px;}
.pmwb-brief-settings-label{margin:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:680;}
.pmwb-metrics{display:flex;gap:10px;min-width:0;overflow-x:auto;padding-bottom:2px;}
.pmwb-metric-source{display:flex;gap:6px;align-items:center;margin-bottom:8px;padding:4px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.45;}
.pmwb-metric-source b{color:var(--dsw-alias-label-secondary);font-weight:650;}
.pmwb-metric-source span{min-width:0;flex:1;overflow-wrap:anywhere;}
.pmwb-metric{min-width:132px;flex:1 1 0;padding:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-metric-label{display:flex;align-items:center;gap:6px;justify-content:space-between;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
.pmwb-metric-trend{font-size:10.5px;font-weight:650;}
.pmwb-metric-trend.up{color:var(--dsw-alias-state-success-primary,#3fb950);}
.pmwb-metric-trend.down{color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-metric-value{margin-top:6px;font-size:22px;line-height:1.15;font-weight:650;letter-spacing:0;}
.pmwb-metric-value small{margin-left:2px;font-size:11.5px;font-weight:500;color:var(--dsw-alias-label-secondary);}
.pmwb-metric-target{margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.5;}
.pmwb-spark{display:flex;align-items:flex-end;gap:2px;height:26px;margin-top:9px;}
.pmwb-spark span{flex:1;min-width:2px;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,transparent);}
.pmwb-spark span.strong{background:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb-spark span.warn{background:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-severity{flex:none;display:grid;place-items:center;width:34px;min-height:24px;padding:2px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:650;}
.pmwb-severity.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-severity.medium{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
.pmwb-severity.watch{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
.pmwb-control-item{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-control-item strong{display:block;font-size:12.5px;line-height:1.45;}
.pmwb-control-item p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;}
.pmwb-control-item small{display:block;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
.pmwb-control-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;}
.pmwb-coverage{display:grid;gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb-coverage-item{display:grid;grid-template-columns:96px minmax(0,1fr) 54px;gap:8px;align-items:center;font-size:11px;}
.pmwb-coverage-item b{font-weight:500;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pmwb-coverage-item span:last-child{text-align:right;color:var(--dsw-alias-label-secondary);}
.pmwb-coverage-track{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));overflow:hidden;}
.pmwb-coverage-track span{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb-coverage-track span.risk{background:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-coverage-track span.safe{background:var(--dsw-alias-state-success-primary,#3fb950);}
.pmwb-note{margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;}
.pmwb-note b{color:var(--dsw-alias-label-primary);}
.pmwb-cockpit{min-height:420px;display:grid;place-items:center;padding:32px;border:1px dashed var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
.pmwb-cockpit-copy{max-width:520px;text-align:center;}
.pmwb-cockpit-copy .eyebrow{display:block;margin-bottom:4px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;}
.pmwb-cockpit-copy h2{margin:0;font-size:17px;}
.pmwb-cockpit-copy p{margin:8px 0 0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.65;}
.pmwb-mask{position:fixed;inset:0;z-index:60;display:none;place-items:center;padding:24px;background:rgba(0,0,0,.42);}
.pmwb-mask.open{display:grid;}
.pmwb-modal{width:min(520px,100%);max-height:82vh;overflow:auto;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 24px 60px rgba(0,0,0,.35);}
.pmwb-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmwb-modal-head h2{margin:0;font-size:15px;}
.pmwb-modal-body{display:grid;gap:11px;padding:14px 15px 16px;}
.pmwb-modal-foot{display:flex;justify-content:flex-end;gap:8px;}
.pmwb-input{width:100%;min-width:0;height:32px;padding:0 9px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;}
.pmwb-save-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;}
.pmwb-layout-list{display:grid;gap:8px;}
.pmwb-layout-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-layout-item.active{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,var(--dsw-alias-bg-layer-2));}
.pmwb-layout-copy{min-width:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;}
.pmwb-layout-copy strong{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--dsw-alias-label-primary);}
.pmwb-layout-copy span{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
.pmwb-layout-badge{padding:0 5px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 16%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950);font-size:10px;font-weight:650;}
.pmwb-layout-actions{display:flex;gap:5px;flex:none;}
.pmwb-help{margin:0;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.6;}
.pmwb-radio-row{display:flex;align-items:center;gap:8px;min-height:28px;color:var(--dsw-alias-label-primary);font-size:12px;}
.pmwb-radio-row input{margin:0;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb-rule-list{display:grid;gap:5px;margin:0;padding-left:18px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.6;}
.pmwb-metric-option{display:flex;align-items:flex-start;gap:8px;padding:8px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;}
.pmwb-metric-option span{display:grid;gap:2px;}
.pmwb-metric-option strong{font-size:12.5px;}
.pmwb-metric-option small{color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
.pmwb-toast{position:fixed;left:50%;bottom:26px;z-index:70;transform:translateX(-50%);padding:9px 14px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 14px 34px rgba(0,0,0,.28);color:var(--dsw-alias-label-primary);font-size:12px;}
@media (max-width:1180px){
  .pmwb-canvas{grid-template-columns:repeat(2,minmax(0,1fr));}
  .pmwb-canvas .pmwb-card{grid-column:span 2;}
}
@media (max-width:820px){
  .pmwb-canvas{grid-template-columns:minmax(0,1fr);}
  .pmwb-canvas .pmwb-card{grid-column:span 1;}
  .pmwb-brief-points > li{grid-template-columns:minmax(0,1fr) 62px;}
  .pmwb-brief-actions{grid-column:1 / -1;justify-items:end;}
}
`;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const headers = { "cache-control": "no-store" };
      const current = token();
      if (current !== null) headers.authorization = `Bearer ${current}`;
      if (options.body !== undefined) {
        headers["content-type"] = "application/json";
      }
      const response = await fetch(path, {
        method: options.method ?? "GET",
        headers,
        cache: "no-store",
        ...(options.body === undefined ? {} : { body: options.body }),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        const rawMessage = payload?.error?.message;
        const unauthorized =
          response.status === 401 &&
          (rawMessage === "invalid or expired token" ||
            rawMessage === "bearer token is required");
        const message = unauthorized
          ? "登录状态已失效，请重新登录。"
          : (rawMessage ??
            (response.status === 401
              ? "请先登录协作账号"
              : `HTTP ${response.status}`));
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    function formatTime(value) {
      if (typeof value !== "string" || value === "") return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      const pad = (number) => String(number).padStart(2, "0");
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /** 纯日期字段（yyyy-mm-dd）没有时刻信息，只按月-日展示，避免补出假时间。 */
    function formatDate(value) {
      if (typeof value !== "string" || value.trim() === "") return "—";
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      return match ? `${match[2]}-${match[3]}` : formatTime(value);
    }

    function isoToLocalInput(value) {
      if (typeof value !== "string" || value === "") return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const pad = (number) => String(number).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function localInputToIso(value) {
      if (typeof value !== "string" || value === "") return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }

    function formatWindow(windowRange) {
      if (!windowRange) return "";
      return `${formatTime(windowRange.from)} - ${formatTime(windowRange.to)}`;
    }

    function briefTagLabel(tag) {
      return (
        {
          progress: "进展",
          data: "数据异常",
          conclusion: "结论",
          decision: "待决策",
          review: "待我验收",
          nudge: "被催办",
        }[tag] ?? tag
      );
    }

    function navigateTo(link) {
      if (!link || typeof link !== "object") return;
      if (link.route === "task") {
        window.__pluginmaxPendingTask = {
          taskId: link.refId,
          workspaceId: link.workspaceId ?? "",
        };
        /*
         * `pluginmax:navigate` 会触发任务页的 route-select 重置逻辑，
         * 把即将打开的 pending task 清成列表态。深链必须直接切路由。
         */
        if (typeof window.__pluginmaxShell?.setRoute === "function") {
          window.__pluginmaxShell.setRoute("task");
        } else {
          window.dispatchEvent(
            new CustomEvent("pluginmax:navigate", {
              detail: { route: "task" },
            }),
          );
        }
        return;
      }
      if (link.route === "workflow") {
        window.__pluginmaxShell?.setRoute("workflow");
        window.dispatchEvent(
          new CustomEvent("pluginmax:collab-navigate", {
            detail: {
              plugin: "workflow",
              instanceId: link.refId,
              workspaceId: link.workspaceId ?? "",
            },
          }),
        );
        return;
      }
      if (link.route === "meeting") {
        const tab = link.tab === "minutes" ? "minutes" : undefined;
        window.__pluginmaxPendingMeeting = {
          meetingId: link.refId,
          workspaceId: link.workspaceId ?? "",
          ...(tab === undefined ? {} : { tab }),
        };
        if (typeof window.__pluginmaxShell?.setRoute === "function") {
          window.__pluginmaxShell.setRoute("meetings");
        } else {
          window.dispatchEvent(
            new CustomEvent("pluginmax:navigate", {
              detail: { route: "meetings" },
            }),
          );
        }
        window.dispatchEvent(
          new CustomEvent("pluginmax:collab-navigate", {
            detail: {
              plugin: "meeting",
              meetingId: link.refId,
              workspaceId: link.workspaceId ?? "",
              ...(tab === undefined ? {} : { tab }),
            },
          }),
        );
        return;
      }
    }

    // ------------------------------------------------------------ follow store
    // 任务 / 工作流 / 会议 / 项目的关注状态由服务端持久化；其他插件页面通过
    // window.__pluginmaxFollow 复用同一个 store 与按钮组件，保证跨页面状态同步。
    const followStore = {
      items: new Map(),
      /*
       * useSyncExternalStore 要求 snapshot 在数据变化时换新引用；
       * 这里用带版本号的快照对象，保证关注状态变化会触发重渲染。
       */
      snapshot: { version: 0, items: new Map() },
      listeners: new Set(),
      loading: null,
      loaded: false,
      getSnapshot() {
        return this.snapshot;
      },
      subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
      notify() {
        for (const listener of this.listeners) listener();
      },
      commit(items) {
        this.items = items;
        this.snapshot = { version: this.snapshot.version + 1, items };
        this.notify();
      },
      key(type, id) {
        return `${type}:${id}`;
      },
      isFollowed(type, id) {
        return this.items.has(this.key(type, id));
      },
      ensure() {
        if (this.loaded || this.loading !== null) return this.loading;
        this.loading = request("/api/collab/workbench/follows")
          .then((result) => {
            this.commit(
              new Map(
                (result?.follows ?? []).map((record) => [
                  this.key(record.type, record.targetId),
                  record,
                ]),
              ),
            );
            this.loaded = true;
          })
          .catch(() => undefined)
          .finally(() => {
            this.loading = null;
          });
        return this.loading;
      },
      async toggle(type, id) {
        const result = await request("/api/collab/workbench/follows/toggle", {
          method: "POST",
          body: JSON.stringify({ type, targetId: id }),
        });
        const key = this.key(type, id);
        const items = new Map(this.items);
        if (result.followed) {
          items.set(key, {
            type,
            targetId: id,
            createdAt: new Date().toISOString(),
          });
        } else {
          items.delete(key);
        }
        this.loaded = true;
        this.commit(items);
        return result.followed;
      },
    };

    /*
     * 方案 B：工作台默认只聚合"已加入"的工作区；平台管理员可在页头显式打开
     * "全量项目"视图。该开关由卡片、项目页与简报长连接共享，请求时以
     * `scope=all` 透传给服务端（服务端对非管理员会忽略该参数）。
     * 同时它也是跨模块偏好：跳转到任务、会议、工作流或 Teammate 时沿用选择。
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
    const sharedScope = ensureScopeStore();
    const scopeStore = {
      getSnapshot: sharedScope.getSnapshot,
      subscribe: sharedScope.subscribe,
      set: (next) => sharedScope.setAll(next),
      /** 追加到已有 query 之后；没有开关时返回空串。 */
      query() {
        return sharedScope.getSnapshot() ? "&scope=all" : "";
      },
      /** 以 `?scope=all` 开头，用于没有其他参数的接口。 */
      leading() {
        return sharedScope.getSnapshot() ? "?scope=all" : "";
      },
    };

    const followIcon = (filled) =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 13,
          height: 13,
          fill: filled ? "currentColor" : "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
        },
        h("path", {
          d: "m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.1 6.4 20l1.2-6.2L3 9.5l6.3-.8L12 3Z",
        }),
      );

    /** 重点关注条目是否仍被关注：直接关注，或工作流 / 项目覆盖仍在。 */
    function focusItemFollowed(item, isFollowed) {
      const refs =
        Array.isArray(item?.coveredBy) && item.coveredBy.length > 0
          ? item.coveredBy
          : [{ type: item?.kind ?? "task", id: item?.id }];
      return refs.some((ref) => isFollowed(ref.type, ref.id));
    }

    function dataAgentCardAttributes(item) {
      return {
        "data-data-agent-card": "true",
        "data-workspace-id": item?.workspaceId,
        "data-data-agent-title": item?.title,
        "data-data-agent-excerpt":
          item?.summary ?? item?.summaryText ?? item?.statusLabel,
      };
    }

    function dataAgentEntityAttributes(item) {
      const common = {
        "data-workspace-id": item?.workspaceId,
        "data-data-agent-title": item?.title,
        "data-data-agent-excerpt":
          item?.summary ?? item?.summaryText ?? item?.statusLabel,
      };
      if (item?.kind === "workflow") {
        return { ...common, "data-workflow-id": item.id };
      }
      if (item?.kind === "meeting") {
        return {
          ...common,
          "data-data-agent-entity": "meeting",
          "data-data-agent-id": item.id,
        };
      }
      if (item?.kind === "task" || item?.kind === undefined) {
        return { ...common, "data-task-id": item.id };
      }
      return dataAgentCardAttributes(item);
    }

    function dataAgentBriefAttributes(item) {
      const route = item?.deepLink?.route;
      const entityId =
        typeof item?.deepLink?.refId === "string"
          ? item.deepLink.refId
          : item?.sourceId;
      if (
        (route === "task" || route === "workflow" || route === "meeting") &&
        typeof entityId === "string" &&
        entityId !== ""
      ) {
        return dataAgentEntityAttributes({
          ...item,
          kind: route,
          id: entityId,
          workspaceId: item.deepLink?.workspaceId ?? item.workspaceId,
          summary: item.conclusion ?? item.statusLabel,
        });
      }
      return dataAgentCardAttributes(item);
    }

    /*
     * 覆盖语义：任务被关注的工作流覆盖，任务 / 工作流被关注的项目覆盖。
     * 详情页传入 workspaceId / workflowInstanceId 后，被覆盖的条目同样显示
     * 「已关注」态；此时按钮只做展示，取消要回到覆盖来源。
     */
    function FollowButton(props) {
      // 全局按钮统一为纯图标；文案只保留在 title / aria-label 中。
      const {
        type,
        id,
        compact,
        iconOnly = true,
        workspaceId,
        workflowInstanceId,
        coveredBy,
      } = props;
      const snapshot = react.useSyncExternalStore(
        followStore.subscribe.bind(followStore),
        followStore.getSnapshot.bind(followStore),
        followStore.getSnapshot.bind(followStore),
      );
      react.useEffect(() => {
        void followStore.ensure();
      }, []);
      const direct = snapshot.items.has(`${type}:${id}`);
      const coveredByFollowed = (coveredBy ?? []).some((ref) =>
        snapshot.items.has(`${ref.type}:${ref.id}`),
      );
      const covered =
        direct ||
        coveredByFollowed ||
        (type === "task" &&
          workflowInstanceId !== undefined &&
          workflowInstanceId !== "" &&
          snapshot.items.has(`workflow:${workflowInstanceId}`)) ||
        (workspaceId !== undefined &&
          workspaceId !== "" &&
          snapshot.items.has(`project:${workspaceId}`));
      const followed = direct || covered;
      const coveredOnly = followed && !direct;
      // 被覆盖的关注：点击星标改为取消「来源」关注，否则按钮点了没反应。
      const coveringRef = coveredOnly
        ? ((coveredBy ?? []).find((ref) =>
            snapshot.items.has(`${ref.type}:${ref.id}`),
          ) ??
          (type === "task" &&
          workflowInstanceId !== undefined &&
          workflowInstanceId !== "" &&
          snapshot.items.has(`workflow:${workflowInstanceId}`)
            ? { type: "workflow", id: workflowInstanceId }
            : undefined) ??
          (workspaceId !== undefined &&
          workspaceId !== "" &&
          snapshot.items.has(`project:${workspaceId}`)
            ? { type: "project", id: workspaceId }
            : undefined))
        : undefined;
      const coveringLabel =
        coveringRef?.type === "project"
          ? "项目"
          : coveringRef?.type === "workflow"
            ? "工作流"
            : "";
      const clickable = !coveredOnly || coveringRef !== undefined;
      const [busy, setBusy] = react.useState(false);
      const title = coveredOnly
        ? coveringRef === undefined
          ? "已关注：由工作流或项目覆盖"
          : `取消关注${coveringLabel}（该条目由它覆盖）`
        : followed
          ? "取消关注"
          : "关注";
      return h(
        "button",
        {
          type: "button",
          className: "pmwb-follow-btn",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: iconOnly
              ? compact
                ? "3px"
                : "5px"
              : compact
                ? "2px 7px"
                : "4px 10px",
            border: "1px solid var(--dsw-alias-border-l3)",
            borderRadius: 999,
            background: followed
              ? "color-mix(in srgb, var(--dsw-alias-accent-primary,#4f8ef7) 14%, transparent)"
              : "transparent",
            color: followed
              ? "var(--dsw-alias-accent-primary,#4f8ef7)"
              : "var(--dsw-alias-label-secondary)",
            font: "inherit",
            fontSize: compact ? 10.5 : 11.5,
            fontWeight: 600,
            cursor: clickable ? "pointer" : "default",
            whiteSpace: "nowrap",
          },
          disabled: busy || !clickable,
          "aria-pressed": followed,
          title,
          "aria-label": title,
          onClick: !clickable
            ? undefined
            : async (event) => {
                event.stopPropagation();
                if (busy) return;
                setBusy(true);
                try {
                  if (coveredOnly && coveringRef !== undefined) {
                    await followStore.toggle(coveringRef.type, coveringRef.id);
                    window.dispatchEvent(
                      new CustomEvent("pluginmax:workbench-toast", {
                        detail: {
                          message: `已取消关注${coveringLabel}，该条目移出重点关注。`,
                        },
                      }),
                    );
                  } else {
                    await followStore.toggle(type, id);
                  }
                } catch (error) {
                  window.dispatchEvent(
                    new CustomEvent("pluginmax:workbench-toast", {
                      detail: {
                        message: `关注操作失败：${error?.message ?? "未知错误"}`,
                      },
                    }),
                  );
                } finally {
                  setBusy(false);
                }
              },
        },
        followIcon(followed),
        iconOnly ? null : h("span", null, followed ? "已关注" : "关注"),
      );
    }

    window.__pluginmaxFollow = {
      FollowButton,
      ensure: () => followStore.ensure(),
      subscribe: (listener) => followStore.subscribe(listener),
      getSnapshot: () => followStore.getSnapshot(),
      isFollowed: (type, id) => followStore.isFollowed(type, id),
      toggle: (type, id) => followStore.toggle(type, id),
    };

    /*
     * Workspace 行菜单由底层组件渲染；这里通过它的通用操作扩展点注入项目关注。
     * 底层提供 workspace id，因此不需要按标题反查项目。
     */
    window.__pluginmaxWorkspaceMenuActions = {
      getVersion: () => followStore.snapshot.version,
      subscribe: (listener) => followStore.subscribe(listener),
      actions: (workspace) => [
        {
          id: "pluginmax:project-follow",
          label: "关注",
          icon: followIcon(followStore.isFollowed("project", workspace.id)),
          disabled: false,
        },
      ],
      onSelect: async (workspace) => {
        try {
          const followed = await followStore.toggle("project", workspace.id);
          window.dispatchEvent(
            new CustomEvent("pluginmax:workbench-toast", {
              detail: {
                message: followed
                  ? `已关注项目「${workspace.title}」`
                  : `已取消关注项目「${workspace.title}」`,
              },
            }),
          );
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("pluginmax:workbench-toast", {
              detail: {
                message: `项目关注失败：${error?.message ?? "未知错误"}`,
              },
            }),
          );
        }
      },
    };
    window.dispatchEvent(new CustomEvent("pluginmax:follow-ready"));

    // ------------------------------------------------------------ layout store

    function defaultModules() {
      const modules = {};
      for (const id of MODULE_ORDER) {
        modules[id] = { cols: MODULE_META[id].defaultCols, height: null };
      }
      return modules;
    }

    function createFactoryLayouts() {
      return {
        layouts: [
          {
            id: "factory-default",
            name: "默认工作台",
            order: [...MODULE_ORDER],
            modules: defaultModules(),
          },
        ],
        defaultId: "factory-default",
        activeId: "factory-default",
        current: null,
      };
    }

    function closestCols(value) {
      return WIDTH_COLS.reduce((closest, current) =>
        Math.abs(current - value) < Math.abs(closest - value)
          ? current
          : closest,
      );
    }

    function normalizeModules(raw) {
      const modules = defaultModules();
      if (raw && typeof raw === "object") {
        for (const [id, value] of Object.entries(raw)) {
          if (!MODULE_ORDER.includes(id)) continue;
          const cols = closestCols(
            Number(value?.cols) || MODULE_META[id].defaultCols,
          );
          const height = Number(value?.height);
          modules[id] = {
            cols,
            height: Number.isFinite(height)
              ? Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(height)))
              : null,
          };
        }
      }
      return modules;
    }

    function normalizeLayout(raw, id, name) {
      const savedOrder = Array.isArray(raw?.order) ? raw.order : [];
      const order = [
        ...new Set(savedOrder.filter((item) => MODULE_ORDER.includes(item))),
        ...MODULE_ORDER.filter((item) => !savedOrder.includes(item)),
      ];
      return {
        id,
        name,
        order,
        modules: normalizeModules(raw?.modules),
      };
    }

    function readLayouts() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? "");
        const layouts = Array.isArray(raw?.layouts)
          ? raw.layouts
              .filter((item) => item && item.id && item.name)
              .map((item) =>
                normalizeLayout(item, String(item.id), String(item.name)),
              )
          : [];
        if (layouts.length === 0) return createFactoryLayouts();
        const defaultId = layouts.some((item) => item.id === raw.defaultId)
          ? raw.defaultId
          : layouts[0].id;
        const activeId = layouts.some((item) => item.id === raw.activeId)
          ? raw.activeId
          : defaultId;
        const current = raw.current
          ? {
              order: normalizeLayout(raw.current, "__runtime__", "当前布局")
                .order,
              modules: normalizeModules(raw.current?.modules),
            }
          : null;
        return { layouts, defaultId, activeId, current };
      } catch {
        return createFactoryLayouts();
      }
    }

    function activeLayoutOf(state) {
      return (
        state.layouts.find((item) => item.id === state.activeId) ??
        state.layouts[0]
      );
    }

    function defaultLayoutOf(state) {
      return (
        state.layouts.find((item) => item.id === state.defaultId) ??
        state.layouts[0]
      );
    }

    function layoutView(state) {
      const active = activeLayoutOf(state);
      const source =
        active.id === state.defaultId && state.current
          ? state.current
          : { order: active.order, modules: active.modules };
      return {
        order: [...source.order],
        modules: normalizeModules(source.modules),
      };
    }

    function layoutSummary(layout) {
      return layout.order
        .map(
          (id) =>
            `${MODULE_META[id]?.title ?? id} ${layout.modules[id]?.cols ?? 6}/6`,
        )
        .join(" · ");
    }

    // ------------------------------------------------------------ page helpers

    const ICONS = {
      refresh: h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        h("path", { d: "M21 12a9 9 0 1 1-3-6.7" }),
        h("path", { d: "M21 3v6h-6" }),
      ),
      grid: h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        h("rect", { x: 3, y: 3, width: 7, height: 7 }),
        h("rect", { x: 14, y: 3, width: 7, height: 7 }),
        h("rect", { x: 3, y: 14, width: 7, height: 7 }),
        h("rect", { x: 14, y: 14, width: 7, height: 7 }),
      ),
      info: h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        h("circle", { cx: 12, cy: 12, r: 9 }),
        h("path", { d: "M12 10.5V16.5M12 7.7h.01" }),
      ),
      gear: h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        h("circle", { cx: 12, cy: 12, r: 3 }),
        h("path", {
          d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.4l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
        }),
      ),
      meeting: h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        h("path", { d: "m22 8-6 4 6 4V8Z" }),
        h("rect", { x: 2, y: 6, width: 14, height: 12, rx: 2 }),
      ),
      close: h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        h("path", { d: "M18 6 6 18M6 6l12 12" }),
      ),
      chevron: h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        h("path", { d: "m9 18 6-6-6-6" }),
      ),
    };

    const scrollMemory = { value: 0 };

    function stageElement() {
      return window.document.querySelector(".pmx-stage");
    }

    // ------------------------------------------------------------ module bodies

    function LoadingBlock() {
      return h(
        "div",
        { className: "pmwb-loading" },
        h("div", { className: "pmwb-skeleton", style: { height: 40 } }),
        h("div", { className: "pmwb-skeleton", style: { height: 52 } }),
        h("div", { className: "pmwb-skeleton", style: { height: 34 } }),
      );
    }

    function ErrorBlock({ message, onRetry }) {
      return h(
        "div",
        { className: "pmwb-error" },
        h("span", null, message || "模块加载失败"),
        h(
          "button",
          { type: "button", className: "pmwb-btn", onClick: onRetry },
          "重试",
        ),
      );
    }

    function statusPillClass(value) {
      if (value === "high" || value === "P0" || value === "P1")
        return "pmwb-pill high";
      if (value === "medium") return "pmwb-pill warn";
      if (value === "watch") return "pmwb-pill accent";
      return "pmwb-pill";
    }

    function recordStatusClass(value) {
      if (["progress", "running"].includes(value)) return "accent";
      if (["review", "waiting"].includes(value)) return "warn";
      if (["done", "completed"].includes(value)) return "ok";
      if (["cancelled", "blocked", "failed"].includes(value)) return "high";
      return "";
    }

    function recordStatusPillClass(value) {
      const tone = recordStatusClass(value);
      return tone === "" ? "pmwb-pill" : `pmwb-pill ${tone}`;
    }

    function renderMetricsBody(modulePayload) {
      const data = modulePayload.data ?? {};
      const selected = new Set(data.selected ?? []);
      const items = (data.items ?? []).filter((metric) =>
        selected.has(metric.id),
      );
      if (items.length === 0) {
        return h(
          "div",
          { className: "pmwb-empty" },
          "未选择核心指标，点击右上角设置选择 1-5 项。",
        );
      }
      return h(
        "div",
        null,
        data.sourceNote
          ? h(
              "div",
              {
                className: "pmwb-metric-source",
                "data-data-mode": data.dataMode,
              },
              h(
                "b",
                null,
                data.dataMode === "unavailable" ? "数据不可用" : "数据来源",
              ),
              h("span", null, data.sourceNote),
            )
          : null,
        h(
          "div",
          { className: "pmwb-metrics" },
          ...items.map((metric) =>
            h(
              "article",
              { className: "pmwb-metric", key: metric.id },
              h(
                "div",
                { className: "pmwb-metric-label" },
                h("span", null, metric.label),
                metric.trend
                  ? h(
                      "span",
                      { className: `pmwb-metric-trend ${metric.trendClass}` },
                      metric.trend,
                    )
                  : null,
              ),
              h(
                "div",
                { className: "pmwb-metric-value" },
                metric.value,
                metric.unit ? h("small", null, metric.unit) : null,
              ),
              h("div", { className: "pmwb-metric-target" }, metric.target),
              h(
                "div",
                { className: "pmwb-spark", "aria-hidden": "true" },
                ...(metric.spark ?? []).map((height, index) =>
                  h("span", {
                    key: `${metric.id}-${index}`,
                    className:
                      height >= 62 ? "strong" : height <= 36 ? "warn" : "",
                    style: { height: `${height}%` },
                  }),
                ),
              ),
            ),
          ),
        ),
      );
    }

    /** 简报正文的轻量 Markdown 渲染：标题 / 列表 / 表格 / 代码块 / 粗体 / 行内代码。 */
    function briefInlineNodes(text, keyBase) {
      const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
      const nodes = [];
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

    function briefTableCells(line) {
      return line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
    }

    function isBriefTableSeparator(line) {
      return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(
        line ?? "",
      );
    }

    function renderBriefMarkdown(text) {
      const source = String(text ?? "").trim();
      if (source === "") return null;
      const lines = source.split(/\r?\n/);
      const blocks = [];
      let index = 0;
      while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === "") {
          index += 1;
          continue;
        }
        if (line.startsWith("```")) {
          const code = [];
          index += 1;
          while (index < lines.length && !lines[index].startsWith("```")) {
            code.push(lines[index]);
            index += 1;
          }
          index += 1;
          blocks.push(
            h("pre", { key: `code-${blocks.length}` }, code.join("\n")),
          );
          continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading !== null) {
          blocks.push(
            h(
              "h5",
              { key: `h-${blocks.length}` },
              ...briefInlineNodes(heading[2], `h-${blocks.length}`),
            ),
          );
          index += 1;
          continue;
        }
        if (
          line.includes("|") &&
          index + 1 < lines.length &&
          isBriefTableSeparator(lines[index + 1])
        ) {
          const header = briefTableCells(line);
          const rows = [];
          index += 2;
          while (
            index < lines.length &&
            lines[index].includes("|") &&
            lines[index].trim() !== ""
          ) {
            rows.push(briefTableCells(lines[index]));
            index += 1;
          }
          const tableKey = `table-${blocks.length}`;
          blocks.push(
            h(
              "table",
              { key: tableKey },
              h(
                "thead",
                null,
                h(
                  "tr",
                  null,
                  ...header.map((cell, cellIndex) =>
                    h(
                      "th",
                      { key: `${tableKey}-th-${cellIndex}` },
                      ...briefInlineNodes(cell, `${tableKey}-th-${cellIndex}`),
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
                    { key: `${tableKey}-tr-${rowIndex}` },
                    ...header.map((_, cellIndex) =>
                      h(
                        "td",
                        { key: `${tableKey}-td-${rowIndex}-${cellIndex}` },
                        ...briefInlineNodes(
                          row[cellIndex] ?? "",
                          `${tableKey}-td-${rowIndex}-${cellIndex}`,
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
              { key: `ul-${blocks.length}` },
              ...items.map((item, itemIndex) =>
                h(
                  "li",
                  { key: `ul-${blocks.length}-${itemIndex}` },
                  ...briefInlineNodes(item, `ul-${blocks.length}-${itemIndex}`),
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
              { key: `ol-${blocks.length}` },
              ...items.map((item, itemIndex) =>
                h(
                  "li",
                  { key: `ol-${blocks.length}-${itemIndex}` },
                  ...briefInlineNodes(item, `ol-${blocks.length}-${itemIndex}`),
                ),
              ),
            ),
          );
          continue;
        }
        if (/^>\s?/.test(line)) {
          const quoted = [];
          while (index < lines.length && /^>\s?/.test(lines[index])) {
            quoted.push(lines[index].replace(/^>\s?/, ""));
            index += 1;
          }
          blocks.push(
            h(
              "blockquote",
              { key: `quote-${blocks.length}` },
              ...briefInlineNodes(quoted.join(" "), `quote-${blocks.length}`),
            ),
          );
          continue;
        }
        const paragraph = [line];
        index += 1;
        while (
          index < lines.length &&
          lines[index].trim() !== "" &&
          !lines[index].startsWith("```") &&
          !/^(#{1,6})\s+/.test(lines[index]) &&
          !/^\s*[-*+]\s+/.test(lines[index]) &&
          !/^\s*\d+[.)]\s+/.test(lines[index]) &&
          !/^>\s?/.test(lines[index]) &&
          !(
            lines[index].includes("|") &&
            isBriefTableSeparator(lines[index + 1])
          )
        ) {
          paragraph.push(lines[index]);
          index += 1;
        }
        blocks.push(
          h(
            "p",
            { key: `p-${blocks.length}` },
            ...paragraph.flatMap((part, partIndex) =>
              partIndex === 0
                ? briefInlineNodes(part, `p-${blocks.length}`)
                : [
                    " ",
                    ...briefInlineNodes(
                      part,
                      `p-${blocks.length}-${partIndex}`,
                    ),
                  ],
            ),
          ),
        );
      }
      return h("div", { className: "pmwb-brief-md" }, ...blocks);
    }

    function briefKindOf(item) {
      if (item?.section === "risk") return "anomaly";
      if (item?.section === "escalation") return "attention";
      return "progress";
    }

    function groupBriefItems(items) {
      const groups = {
        progress: [],
        anomaly: [],
        attention: [],
      };
      for (const item of items ?? []) {
        groups[briefKindOf(item)].push(item);
      }
      return groups;
    }

    function briefPlainText(value) {
      return String(value ?? "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/^#{1,6}\s*/gm, "")
        .replace(/^\s*[-*+]\s*/gm, "")
        .replace(/^\s*\d+[.)]\s*/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*~]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function briefStatusClass(item) {
      const kind = briefKindOf(item);
      if (kind === "anomaly") return "high";
      if (kind === "attention") return "warn";
      return /验收|待确认|待处理/u.test(item?.statusLabel ?? "")
        ? "warn"
        : "ok";
    }

    function briefTimeLabel(item) {
      if (typeof item?.deadline === "string" && item.deadline !== "") {
        return `截止 ${formatDate(item.deadline)}`;
      }
      return formatTime(item?.occurredAt);
    }

    function briefSourceLabel(item) {
      if (item?.sourceDomain === "workflow") return "工作流";
      if (item?.sourceDomain === "agent-run") return "执行记录";
      return "任务";
    }

    const TASK_STATUS_LABELS = {
      todo: "待开始",
      progress: "进行中",
      abnormal: "异常",
      review: "待验收",
      done: "已完成",
      cancelled: "已取消",
    };
    const TASK_PRIORITY_LABELS = { P1: "P0", P2: "P1", P3: "P2" };

    function taskEventText(value) {
      return briefPlainText(value)
        .replace(/\btodo\b/gi, "待开始")
        .replace(/\bprogress\b/gi, "进行中")
        .replace(/\babnormal\b/gi, "异常")
        .replace(/\breview\b/gi, "待验收")
        .replace(/\bdone\b/gi, "已完成")
        .replace(/\bcancelled\b/gi, "已取消")
        .replace(/[。！？.!?]+$/u, "");
    }

    function taskStateSummary(task) {
      if (task === null || task === undefined) return [];
      const status = TASK_STATUS_LABELS[task.status] ?? task.status ?? "未知";
      const progress = Number.isFinite(task.progress)
        ? `，进度 ${task.progress}%`
        : "";
      const sentences = [`任务当前为${status}${progress}。`];
      if (task.executionAnomaly?.message) {
        sentences.push(
          `执行异常：${taskEventText(task.executionAnomaly.message)}。`,
        );
      } else if (task.needsInput) {
        sentences.push("任务正在等待补充信息。");
      }
      const events = [...(task.events ?? [])].sort((left, right) =>
        String(right?.at ?? "").localeCompare(String(left?.at ?? "")),
      );
      const latestEvent =
        events.find((event) =>
          ["status", "closed", "workflow", "nudge"].includes(event.kind),
        ) ?? events.find((event) => event.kind !== "archived");
      if (latestEvent?.message) {
        const message = taskEventText(latestEvent.message);
        const actor =
          latestEvent.actorName && !message.includes(latestEvent.actorName)
            ? `${latestEvent.actorName}：`
            : "";
        sentences.push(`最近更新：${actor}${message}。`);
      }
      if (task.archivedAt) {
        sentences.push("任务已归档，仅保留历史记录。");
      }
      return sentences.slice(0, 3);
    }

    function BriefTaskBasicInfo({ taskId }) {
      const [open, setOpen] = react.useState(true);
      const [task, setTask] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [error, setError] = react.useState("");
      const mounted = react.useRef(true);
      const autoLoaded = react.useRef(false);

      react.useEffect(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);

      const load = react.useCallback(async () => {
        if (!taskId) return;
        setLoading(true);
        setError("");
        try {
          const payload = await request(
            `/api/collab/tasks/detail?taskId=${encodeURIComponent(taskId)}`,
          );
          if (mounted.current) setTask(payload?.task ?? null);
        } catch (cause) {
          if (mounted.current) {
            setError(cause instanceof Error ? cause.message : "读取任务失败");
          }
        } finally {
          if (mounted.current) setLoading(false);
        }
      }, [taskId]);

      react.useEffect(() => {
        if (!taskId || autoLoaded.current) return;
        autoLoaded.current = true;
        void load();
      }, [load, taskId]);

      if (!taskId) return null;
      const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next && task === null && !loading) void load();
      };
      return h(
        "div",
        { className: `pmwb-brief-task${open ? " open" : ""}` },
        h(
          "button",
          {
            type: "button",
            className: "pmwb-brief-task-toggle",
            "aria-expanded": open,
            "aria-controls": `pmwb-brief-task-${taskId}`,
            onClick: toggle,
          },
          ICONS.chevron,
          h("span", null, `任务 · ${taskId}`),
          h("small", null, open ? "收起" : "展开"),
        ),
        open
          ? h(
              "div",
              {
                id: `pmwb-brief-task-${taskId}`,
                className: "pmwb-brief-task-body",
              },
              loading
                ? h(
                    "div",
                    {
                      className: "pmwb-brief-task-state",
                      role: "status",
                    },
                    "正在读取任务信息…",
                  )
                : error !== ""
                  ? h(
                      "div",
                      {
                        className: "pmwb-brief-task-state error",
                        role: "alert",
                      },
                      h("span", null, `任务信息加载失败：${error}`),
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pmwb-brief-linkbtn",
                          onClick: () => void load(),
                        },
                        "重试",
                      ),
                    )
                  : task !== null
                    ? [
                        h(
                          "h4",
                          { className: "pmwb-brief-task-title" },
                          task.title,
                        ),
                        task.description
                          ? h(
                              "p",
                              { className: "pmwb-brief-task-description" },
                              task.description,
                            )
                          : null,
                        h(
                          "dl",
                          { className: "pmwb-brief-task-grid" },
                          h("dt", null, "负责人"),
                          h(
                            "dd",
                            null,
                            task.receiverName || task.receiverId || "待指派",
                          ),
                          h("dt", null, "优先级"),
                          h(
                            "dd",
                            null,
                            TASK_PRIORITY_LABELS[task.priority] ??
                              task.priority,
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmwb-brief-task-summary" },
                          h("strong", null, "当前状态"),
                          taskStateSummary(task).join(" "),
                        ),
                      ]
                    : h(
                        "div",
                        { className: "pmwb-brief-task-state" },
                        "任务信息暂不可用。",
                      ),
            )
          : null,
      );
    }

    function renderBriefDetailDrawer(item, ctx) {
      if (item === null || item === undefined) return null;
      const facts = [
        ["状态", item.statusLabel || briefTagLabel(item.tag) || "待处理"],
        ...(item.executorName
          ? [
              [
                item.executorRole === "审批人" ? "审批人" : "责任",
                `${item.executorName}${item.executorRole ? ` · ${item.executorRole}` : ""}`,
              ],
            ]
          : []),
        ["时间", formatTime(item.occurredAt)],
        ...(item.deadline ? [["截止", formatDate(item.deadline)]] : []),
        ...(item.workspaceName ? [["项目", item.workspaceName]] : []),
      ];
      return h(
        "div",
        {
          className: "pmwb-mask open pmwb-brief-drawer-mask",
          role: "presentation",
          onClick: (event) => {
            if (event.target === event.currentTarget) ctx.closeBriefDetail();
          },
        },
        h(
          "aside",
          {
            className: "pmwb-brief-drawer",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "pmwb-brief-detail-title",
          },
          h(
            "header",
            { className: "pmwb-brief-drawer-head" },
            h("h2", { id: "pmwb-brief-detail-title" }, item.title),
            h(
              "button",
              {
                type: "button",
                className: "pmwb-iconbtn",
                "aria-label": "关闭简报详情",
                title: "关闭",
                onClick: ctx.closeBriefDetail,
              },
              ICONS.close,
            ),
          ),
          h(
            "div",
            { className: "pmwb-brief-drawer-body" },
            h(
              "div",
              null,
              h(
                "div",
                { className: "pmwb-brief-drawer-kicker" },
                `${briefSourceLabel(item)} · ${briefTagLabel(item.tag) || "简报"}`,
              ),
              h("h3", { className: "pmwb-brief-drawer-title" }, item.title),
              item.conclusion
                ? h(
                    "div",
                    { className: "pmwb-brief-drawer-text" },
                    renderBriefMarkdown(item.conclusion),
                  )
                : null,
            ),
            h(
              "section",
              { className: "pmwb-brief-drawer-block" },
              h("h3", null, "关键事实"),
              h(
                "dl",
                { className: "pmwb-brief-facts" },
                ...facts.flatMap(([label, value]) => [
                  h("dt", { key: `dt-${label}` }, label),
                  h("dd", { key: `dd-${label}` }, value),
                ]),
              ),
            ),
            item.reason
              ? h(
                  "section",
                  { className: "pmwb-brief-drawer-block" },
                  h("h3", null, "为什么看到这条"),
                  h(
                    "div",
                    { className: "pmwb-brief-drawer-text" },
                    item.reason,
                  ),
                )
              : null,
            h(
              "section",
              { className: "pmwb-brief-drawer-block" },
              h("h3", null, "证据与来源"),
              item.deepLink?.route === "task" && item.deepLink?.refId
                ? h(BriefTaskBasicInfo, {
                    key: item.deepLink.refId,
                    taskId: item.deepLink.refId,
                  })
                : h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-brief-evidence",
                      onClick: ctx.navigateBriefItem,
                    },
                    ICONS.chevron,
                    h(
                      "span",
                      null,
                      `${briefSourceLabel(item)} · ${item.sourceId}`,
                    ),
                    ICONS.chevron,
                  ),
            ),
            item.suggestion
              ? h(
                  "section",
                  { className: "pmwb-brief-drawer-block" },
                  h("h3", null, "建议下一步"),
                  h(
                    "div",
                    { className: "pmwb-brief-recommend" },
                    h("strong", null, item.suggestion.headline),
                    item.suggestion.body,
                  ),
                )
              : null,
          ),
          h(
            "footer",
            { className: "pmwb-brief-drawer-foot" },
            h(
              "button",
              {
                type: "button",
                className: "pmwb-btn",
                onClick: ctx.closeBriefDetail,
              },
              "关闭",
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmwb-btn primary",
                onClick: ctx.navigateBriefItem,
              },
              item.actionLabel || "前往处理",
              ICONS.chevron,
            ),
          ),
        ),
      );
    }

    function renderBriefSection(kind, items, ctx) {
      const meta = BRIEF_SECTION_META[kind];
      const expanded = Boolean(ctx.briefExpandedSections?.[kind]);
      const visible = expanded ? items : items.slice(0, meta.limit);
      const hiddenCount = Math.max(0, items.length - visible.length);
      const helpOpen = ctx.briefHelpSection === kind;
      return h(
        "section",
        { className: "pmwb-brief-section", key: kind },
        h(
          "div",
          { className: "pmwb-brief-section-head" },
          h(
            "h3",
            { className: "pmwb-brief-section-title" },
            meta.title,
            h("span", { className: "pmwb-brief-section-count" }, items.length),
          ),
          h(
            "div",
            { className: "pmwb-brief-section-actions" },
            h(
              "button",
              {
                type: "button",
                className: "pmwb-brief-help-btn",
                "aria-label": `${meta.title}说明`,
                title: `${meta.title}说明`,
                "aria-expanded": helpOpen,
                onClick: (event) => {
                  event.stopPropagation();
                  ctx.toggleBriefHelp(kind);
                },
              },
              ICONS.info,
            ),
            items.length > meta.limit
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb-brief-linkbtn",
                    onClick: (event) => {
                      event.stopPropagation();
                      ctx.toggleBriefSection(kind);
                    },
                  },
                  expanded
                    ? "收起"
                    : kind === "progress"
                      ? `查看全部 ${items.length}`
                      : `其它 ${hiddenCount} 条`,
                  ICONS.chevron,
                )
              : null,
          ),
          helpOpen
            ? h(
                "div",
                { className: "pmwb-brief-help", role: "note" },
                h("strong", null, meta.title),
                meta.help,
              )
            : null,
        ),
        h(
          "div",
          { className: "pmwb-brief-list" },
          ...visible.map((item) => {
            const kindLabel =
              kind === "progress"
                ? null
                : briefTagLabel(item.tag) ||
                  (kind === "anomaly" ? "异常" : "待处理");
            return h(
              "button",
              {
                key: item.itemId,
                type: "button",
                className: `pmwb-brief-row${item.readState === "read" ? " read" : ""}`,
                ...dataAgentBriefAttributes(item),
                onClick: () => ctx.openBriefDetail(item),
              },
              h(
                "span",
                { className: "pmwb-brief-row-main" },
                h(
                  "span",
                  { className: "pmwb-brief-row-titleline" },
                  h("span", { className: "pmwb-brief-row-title" }, item.title),
                  kindLabel
                    ? h(
                        "span",
                        { className: `pmwb-brief-row-kind ${kind}` },
                        kindLabel,
                      )
                    : null,
                ),
                h(
                  "span",
                  { className: "pmwb-brief-row-sub" },
                  briefPlainText(
                    item.conclusion || item.reason || item.statusLabel,
                  ),
                ),
              ),
              h(
                "span",
                { className: "pmwb-brief-row-trailing" },
                item.statusLabel
                  ? h(
                      "span",
                      {
                        className: `pmwb-brief-status ${briefStatusClass(item)}`,
                      },
                      item.statusLabel,
                    )
                  : null,
                h(
                  "span",
                  { className: "pmwb-brief-row-time" },
                  briefTimeLabel(item),
                ),
              ),
              h(
                "span",
                { className: "pmwb-brief-chevron", "aria-hidden": "true" },
                ICONS.chevron,
              ),
            );
          }),
        ),
      );
    }

    function renderBriefBody(modulePayload, ctx) {
      const data = modulePayload.data ?? {};
      const items =
        ctx.briefView === "unread"
          ? (data.views?.unread ?? [])
          : (data.views?.all ?? []);
      const groups = groupBriefItems(items);
      return h(
        "div",
        { className: "pmwb-brief-v2" },
        items.length === 0
          ? h(
              "div",
              { className: "pmwb-brief-empty" },
              ctx.briefView === "unread"
                ? "当前没有未读简报条目。"
                : "当前周期没有新增简报。",
            )
          : [
              groups.progress.length > 0
                ? renderBriefSection("progress", groups.progress, ctx)
                : null,
              groups.anomaly.length > 0
                ? renderBriefSection("anomaly", groups.anomaly, ctx)
                : null,
              groups.attention.length > 0
                ? renderBriefSection("attention", groups.attention, ctx)
                : null,
            ],
        h(
          "footer",
          { className: "pmwb-brief-footer" },
          h(
            "span",
            null,
            `覆盖 ${formatWindow(data.awayWindow)} · 更新 ${formatTime(modulePayload.updatedAt)}`,
          ),
          h(
            "button",
            {
              type: "button",
              className: "pmwb-brief-linkbtn",
              onClick: () => ctx.openBriefSettings(),
            },
            "简报设置",
            ICONS.chevron,
          ),
        ),
      );
    }

    function renderTodoRow(item, ctx) {
      return renderOwnerRow(item, ctx, "todo");
    }

    function initialsOf(name) {
      return String(name ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }

    /** 负责人头像：AI Teammate（agent）用外框环区分，人类/角色用底色区分。 */
    function OwnerAvatar(props) {
      const name = props.name ?? "";
      const kind = props.kind;
      const label = initialsOf(name) || "?";
      if (kind === "agent") {
        return h(
          "span",
          {
            className: "pmwb-avatar-ring",
            role: "img",
            title: `${name}（AI伙伴）`,
            "aria-label": `${name}（AI伙伴）`,
          },
          h("span", { className: "pmwb-avatar agent" }, label),
        );
      }
      return h(
        "span",
        {
          className: `pmwb-avatar ${kind === "role" ? "role" : "human"}`,
          role: "img",
          title: name,
          "aria-label": name,
        },
        kind === "role" ? "R" : label,
      );
    }

    function meetingParticipantGroup(item) {
      const agents = item.agents ?? [];
      const seen = new Set();
      const visible = agents.filter((agent) => {
        if (!agent.owned) return false;
        const key = agent.name
          .normalize("NFKC")
          .replace(/[\u200B-\u200D\uFEFF]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return h(
        "div",
        { className: "pmwb-participants" },
        visible.length === 0 && item.otherParticipantCount === 0
          ? h("span", null, "暂无参会人")
          : null,
        ...visible.map((agent, index) =>
          h(
            react.Fragment,
            { key: `${agent.refId || agent.name}:${agent.name}:${index}` },
            h(
              "span",
              {
                className: `pmwb-owner${
                  agent.status === "left"
                    ? " is-left"
                    : agent.status === "pending"
                      ? " is-pending"
                      : ""
                }`,
              },
              h(OwnerAvatar, { name: agent.name, kind: agent.kind }),
              h("span", { className: "pmwb-owner-name" }, agent.name),
            ),
            index < visible.length - 1
              ? h("span", { className: "pmwb-participant-separator" }, ",")
              : null,
          ),
        ),
        item.otherParticipantCount > 0
          ? h("span", { className: "ws" }, `等${item.otherParticipantCount}人`)
          : null,
      );
    }

    function meetingParticipants(item) {
      return [
        h(
          "div",
          { className: "pmwb-meeting-line" },
          h("span", { className: "pmwb-participants-label" }, "项目："),
          h("span", { className: "ws" }, item.workspaceName || "未命名项目"),
        ),
        h(
          "div",
          { className: "pmwb-meeting-line" },
          h("span", { className: "pmwb-participants-label" }, "参会："),
          meetingParticipantGroup(item),
        ),
      ];
    }

    /**
     * 待办 / 重点关注共用的行结构：
     * 第一行仅任务编号（右侧为期限与操作），第二行任务名称，
     * 第三行项目名称 + 负责人（负责人前带头像）。
     */
    function renderOwnerRow(item, ctx, variant) {
      const isFocus = variant === "focus";
      const moduleId = isFocus ? "focus" : "todo";
      const read = ctx.isItemRead(moduleId, item);
      const openItem = () => {
        ctx.markItemRead(moduleId, item);
        ctx.openLink(item.deepLink);
      };
      const coverage =
        isFocus === true && Array.isArray(item.coveredBy)
          ? item.coveredBy.find(
              (ref) => !(ref.type === item.kind && ref.id === item.id),
            )
          : undefined;
      const coverageLabel =
        coverage === undefined
          ? ""
          : coverage.type === "project"
            ? "项目关注"
            : coverage.type === "workflow"
              ? "工作流关注"
              : "";
      const priorityPill = item.priority
        ? h(
            "span",
            { className: statusPillClass(item.priority) },
            item.priorityLabel ?? item.priority,
          )
        : null;
      const owner = item.receiverName
        ? h(
            "span",
            { className: "pmwb-owner" },
            h(OwnerAvatar, {
              name: item.receiverName,
              kind: item.receiverType,
            }),
            h("span", { className: "pmwb-owner-name" }, item.receiverName),
          )
        : null;
      const focusStatusText = [item.statusLabel, item.currentNodeLabel]
        .filter(Boolean)
        .join(" · ");
      const focusStatusTone = recordStatusClass(item.status);
      return h(
        "article",
        {
          key: item.id,
          className: `pmwb-item${isFocus ? " pmwb-item-focus" : ""}${read ? " read" : ""}`,
          ...dataAgentEntityAttributes(item),
        },
        h(
          react.Fragment,
          null,
          h("div", { className: "pmwb-item-id" }, item.displayId ?? item.id),
          h("div", { className: "pmwb-item-name" }, item.title),
          // 重点关注：状态只在信息行显示一次，颜色与任务管理状态一致。
          isFocus
            ? h(
                "div",
                { className: "pmwb-item-note" },
                priorityPill,
                h(
                  "span",
                  {
                    className: `pmwb-note-status${
                      focusStatusTone === "" ? "" : ` ${focusStatusTone}`
                    }`,
                  },
                  focusStatusText,
                ),
                coverageLabel === ""
                  ? null
                  : h("span", { className: "pmwb-pill" }, coverageLabel),
                h("span", { className: "pmwb-note-divider" }, "·"),
                h(
                  "span",
                  { className: "pmwb-note-latest" },
                  h("b", null, "最新"),
                  item.summary ? ` ${item.summary}` : " —",
                ),
              )
            : h(
                "div",
                { className: "pmwb-item-meta" },
                priorityPill,
                h(
                  "span",
                  { className: recordStatusPillClass(item.status) },
                  item.statusLabel,
                ),
                h(
                  "span",
                  { className: "pmwb-pill" },
                  item.source === "workflow" ? "工作流生成" : "人工创建",
                ),
              ),
          h(
            "div",
            { className: "pmwb-item-owner" },
            item.workspaceName
              ? h("span", { className: "ws" }, item.workspaceName)
              : null,
            owner,
          ),
        ),
        h(
          "div",
          { className: "pmwb-item-trailing" },
          h(
            "button",
            {
              type: "button",
              className: "pmwb-btn",
              onClick: (event) => {
                event.stopPropagation();
                openItem();
              },
            },
            "详情",
          ),
          read
            ? h("span", { className: "pmwb-read-state" }, "已读")
            : h(
                "button",
                {
                  type: "button",
                  className: "pmwb-btn pmwb-read-action",
                  onClick: (event) => {
                    event.stopPropagation();
                    ctx.markItemRead(moduleId, item);
                  },
                },
                "标为已读",
              ),
          isFocus
            ? h(FollowButton, {
                // 关注类型直接用条目自身 kind（task / workflow / meeting），
                // 否则会议条目会被当成 task，星标显示成「由它覆盖」。
                type: item.kind ?? "task",
                id: item.id,
                compact: true,
                coveredBy: item.coveredBy,
              })
            : null,
        ),
        item.due
          ? h("span", { className: "pmwb-item-time" }, formatDate(item.due))
          : null,
      );
    }

    function renderTodoBody(modulePayload, ctx) {
      const view = ctx.moduleView("todo");
      const items = filterUnreadItems(
        modulePayload.data?.items ?? [],
        view,
        (item) => ctx.isItemRead("todo", item),
      );
      if (items.length === 0) {
        return h(
          "div",
          { className: "pmwb-empty" },
          view === "unread"
            ? "没有未读待办事项。"
            : "没有待处理或待验收的任务。",
        );
      }
      return h(
        "div",
        { className: "pmwb-stack" },
        ...items.map((item) => renderTodoRow(item, ctx)),
      );
    }

    function renderFocusBody(modulePayload, ctx) {
      // coveredBy 记录这条为什么算已关注：直接关注，或工作流 / 项目覆盖。
      const view = ctx.moduleView("focus");
      const eligible = (modulePayload.data?.items ?? []).filter((item) =>
        focusItemFollowed(item, ctx.isFollowed),
      );
      const items = filterUnreadItems(eligible, view, (item) =>
        ctx.isItemRead("focus", item),
      );
      if (items.length === 0) {
        return h(
          "div",
          { className: "pmwb-empty" },
          view === "unread"
            ? "没有未读重点关注。"
            : "还没有关注的任务、工作流、会议或项目。",
        );
      }
      return h(
        "div",
        { className: "pmwb-stack" },
        ...items.map((item) => renderOwnerRow(item, ctx, "focus")),
      );
    }

    function renderMeetingBody(modulePayload, ctx) {
      const view = ctx.moduleView("meeting-minutes");
      const items = filterUnreadItems(
        modulePayload.data?.items ?? [],
        view,
        (item) => ctx.isItemRead("meeting-minutes", item),
      );
      if (items.length === 0) {
        return h(
          "div",
          { className: "pmwb-empty" },
          view === "unread" ? "暂无未读会议纪要。" : "暂无会议纪要。",
        );
      }
      return h(
        "div",
        { className: "pmwb-stack" },
        ...items.map((item) => {
          const read = ctx.isItemRead("meeting-minutes", item);
          const openItem = () => {
            ctx.markItemRead("meeting-minutes", item);
            ctx.openLink({ ...item.deepLink, tab: "minutes" });
          };
          return h(
            "article",
            {
              key: item.id,
              className: `pmwb-item meeting${read ? " read" : ""}`,
              ...dataAgentEntityAttributes({ ...item, kind: "meeting" }),
            },
            h("div", { className: "pmwb-item-name" }, item.title),
            h(
              "div",
              {
                className: "pmwb-item-meta pmwb-meeting-status",
              },
              item.minutesPending
                ? h("span", { className: "pmwb-minutes-badge" }, "待确认")
                : item.minutesSource === "confirmed"
                  ? h(
                      "span",
                      { className: "pmwb-minutes-badge confirmed" },
                      "已确认纪要",
                    )
                  : null,
            ),
            h(
              "div",
              {
                className: `pmwb-item-sub${item.summaryText ? "" : " placeholder"}`,
              },
              item.summaryText || "暂无对话记录",
            ),
            h(
              "div",
              { className: "pmwb-item-trailing" },
              h(
                "button",
                {
                  type: "button",
                  className: "pmwb-btn",
                  onClick: (event) => {
                    event.stopPropagation();
                    openItem();
                  },
                },
                "详情",
              ),
              read
                ? h("span", { className: "pmwb-read-state" }, "已读")
                : h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn pmwb-read-action",
                      onClick: (event) => {
                        event.stopPropagation();
                        ctx.markItemRead("meeting-minutes", item);
                      },
                    },
                    "标为已读",
                  ),
              h(FollowButton, { type: "meeting", id: item.id, compact: true }),
            ),
            h(
              "div",
              { className: "pmwb-item-owner" },
              item.workspaceName
                ? h("span", { className: "ws" }, item.workspaceName)
                : null,
              ...meetingParticipants(item),
            ),
            h(
              "span",
              { className: "pmwb-item-time" },
              formatTime(item.updatedAt),
            ),
          );
        }),
      );
    }

    function renderControlBody(modulePayload, ctx) {
      const data = modulePayload.data ?? {};
      const items = data.items ?? [];
      const coverage = data.coverage ?? [];
      return h(
        "div",
        null,
        h(
          "div",
          { className: "pmwb-stack" },
          ...items.map((item) =>
            h(
              "article",
              { className: "pmwb-control-item", key: item.id },
              h(
                "span",
                { className: `pmwb-severity ${item.severity}` },
                item.severity === "high"
                  ? "高"
                  : item.severity === "medium"
                    ? "中"
                    : "关注",
              ),
              h(
                "div",
                null,
                h("strong", null, item.title),
                h("p", null, `建议：${item.recommendation}`),
                h(
                  "small",
                  null,
                  `Owner ${item.owner} · ${item.deadline} · ${item.impact}`,
                ),
                (item.related ?? []).length > 0
                  ? h(
                      "div",
                      { className: "pmwb-control-actions" },
                      ...item.related.map((related) =>
                        h(
                          "button",
                          {
                            key: `${item.id}-${related.refId}`,
                            type: "button",
                            className: "pmwb-btn",
                            onClick: () =>
                              ctx.openLink({
                                route: related.route,
                                refId: related.refId,
                              }),
                          },
                          related.label,
                        ),
                      ),
                    )
                  : null,
              ),
            ),
          ),
        ),
        coverage.length > 0
          ? h(
              "div",
              { className: "pmwb-coverage", "aria-label": "关键物料覆盖天数" },
              ...coverage.map((item) =>
                h(
                  "div",
                  { className: "pmwb-coverage-item", key: item.material },
                  h("b", null, item.material),
                  h(
                    "div",
                    { className: "pmwb-coverage-track" },
                    h("span", {
                      className:
                        item.days < item.safeDays
                          ? "risk"
                          : item.days > item.safeDays * 1.6
                            ? "safe"
                            : "",
                      style: {
                        width: `${Math.max(6, Math.min(100, (item.days / (item.safeDays * 2)) * 100))}%`,
                      },
                    }),
                  ),
                  h("span", null, `${item.days}天`),
                ),
              ),
            )
          : null,
      );
    }

    function renderSupplierBody(modulePayload) {
      const data = modulePayload.data ?? {};
      const items = data.items ?? [];
      return h(
        "div",
        null,
        h(
          "div",
          { className: "pmwb-stack" },
          ...items.map((item) =>
            h(
              "article",
              { className: "pmwb-control-item", key: item.id },
              h(
                "span",
                { className: `pmwb-severity ${item.level}` },
                item.score,
              ),
              h(
                "div",
                null,
                h("strong", null, `${item.name} · ${item.riskType}`),
                h("p", null, item.metric),
                h(
                  "small",
                  null,
                  `${item.share} · 建议：${item.recommendation}`,
                ),
              ),
            ),
          ),
        ),
        data.note
          ? h(
              "div",
              { className: "pmwb-note" },
              h("b", null, "采购韧性："),
              data.note,
            )
          : null,
      );
    }

    function renderModuleBody(moduleId, modulePayload, ctx) {
      switch (moduleId) {
        case "metrics":
          return renderMetricsBody(modulePayload);
        case "brief":
          return renderBriefBody(modulePayload, ctx);
        case "todo":
          return renderTodoBody(modulePayload, ctx);
        case "focus":
          return renderFocusBody(modulePayload, ctx);
        case "meeting-minutes":
          return renderMeetingBody(modulePayload, ctx);
        case "control":
          return renderControlBody(modulePayload, ctx);
        case "supplier":
          return renderSupplierBody(modulePayload);
        default:
          return h("div", { className: "pmwb-empty" }, "未知模块。");
      }
    }

    function moduleCount(moduleId, modulePayload, briefView) {
      const data = modulePayload?.data;
      if (!data) return "";
      switch (moduleId) {
        case "brief": {
          const unread = data.unreadCount ?? data.views?.unread?.length ?? 0;
          void briefView;
          void unread;
          return "";
        }
        case "todo":
          return `${data.items?.length ?? 0} 项`;
        case "focus":
          return `${data.items?.length ?? 0} 项`;
        case "meeting-minutes":
          return `${data.items?.length ?? 0} 场`;
        case "control":
          return data.pendingCount > 0 ? `${data.pendingCount} 需处置` : "";
        case "supplier":
          return `${data.items?.length ?? 0} 家`;
        default:
          return "";
      }
    }

    // ------------------------------------------------------------------- cards

    function WorkbenchCard(props) {
      const {
        id,
        title,
        count,
        countBadge,
        titleActions,
        meta,
        extraActions,
        refreshing,
        onRefresh,
        cardRef,
        cols,
        height,
        resized,
        dragging,
        dropTarget,
        transform,
        onHeadPointerDown,
        onHeadPointerMove,
        onHeadPointerUp,
        onHeightPointerDown,
        onHeightPointerMove,
        onHeightPointerUp,
        onWidthPointerDown,
        onWidthPointerMove,
        onWidthPointerUp,
        children,
      } = props;
      return h(
        "section",
        {
          ref: cardRef,
          className: [
            "pmwb-card",
            dragging ? "dragging" : "",
            dropTarget ? "drop-target" : "",
            resized ? "resized" : "",
          ]
            .filter(Boolean)
            .join(" "),
          "data-module": id,
          "data-cols": String(cols),
          style: {
            "--pmwb-cols": String(cols),
            // 拖拽出来的高度是上限：内容更矮时卡片自适应收缩，超出才滚动。
            ...(height ? { maxHeight: `${Math.round(height)}px` } : {}),
            ...(transform ? { transform } : {}),
          },
        },
        h(
          "div",
          {
            className: "pmwb-card-head",
            onPointerDown: onHeadPointerDown,
            onPointerMove: onHeadPointerMove,
            onPointerUp: onHeadPointerUp,
            onPointerCancel: onHeadPointerUp,
          },
          h(
            "div",
            { className: "pmwb-title" },
            h("h2", null, title),
            count
              ? h(
                  "span",
                  {
                    className: `pmwb-count${countBadge ? " badge" : ""}`,
                  },
                  count,
                )
              : null,
            titleActions,
          ),
          h(
            "div",
            { className: "pmwb-actions" },
            meta,
            extraActions,
            h(
              "button",
              {
                type: "button",
                className: `pmwb-iconbtn${refreshing ? " spinning" : ""}`,
                disabled: refreshing || typeof onRefresh !== "function",
                onClick: onRefresh,
                "aria-label": `刷新${title}`,
                "aria-busy": refreshing,
                title: refreshing ? "刷新中" : "刷新",
              },
              ICONS.refresh,
            ),
          ),
        ),
        h("div", { className: "pmwb-card-body" }, children),
        h("span", {
          className: "pmwb-resize-height",
          "aria-hidden": "true",
          onPointerDown: onHeightPointerDown,
          onPointerMove: onHeightPointerMove,
          onPointerUp: onHeightPointerUp,
          onPointerCancel: onHeightPointerUp,
        }),
        h("button", {
          type: "button",
          className: "pmwb-resize-width",
          "aria-label": `拖拽调整${title}宽度，可选 1/6、1/3、1/2、2/3、5/6 或 1`,
          onPointerDown: onWidthPointerDown,
          onPointerMove: onWidthPointerMove,
          onPointerUp: onWidthPointerUp,
          onPointerCancel: onWidthPointerUp,
        }),
      );
    }

    // -------------------------------------------------------------------- page

    function WorkbenchPage(props) {
      const [mode, setMode] = react.useState("personal");
      const [modules, setModules] = react.useState({});
      const [visibleModules, setVisibleModules] = react.useState(FACTORY_ORDER);
      const [states, setStates] = react.useState({});
      const [globalError, setGlobalError] = react.useState("");
      const [loading, setLoading] = react.useState(true);
      const [layoutState, setLayoutState] = react.useState(readLayouts);
      const [briefView, setBriefView] = react.useState("unread");
      const [expanded, setExpanded] = react.useState({});
      const [briefTextExpanded, setBriefTextExpanded] = react.useState({});
      const [toast, setToast] = react.useState("");
      const [briefPushed, setBriefPushed] = react.useState(false);
      const [metricOpen, setMetricOpen] = react.useState(false);
      const [briefSettingsOpen, setBriefSettingsOpen] = react.useState(false);
      const [briefMode, setBriefMode] = react.useState("lastLeave");
      const [briefWindowFrom, setBriefWindowFrom] = react.useState("");
      const [briefDetailItem, setBriefDetailItem] = react.useState(null);
      const [briefExpandedSections, setBriefExpandedSections] = react.useState(
        {},
      );
      const [briefHelpSection, setBriefHelpSection] = react.useState(null);
      const [briefSettingsTab, setBriefSettingsTab] = react.useState("content");
      const [briefIncludeTypes, setBriefIncludeTypes] = react.useState(
        BRIEF_INCLUDE_OPTIONS.map((option) => option.id),
      );
      const [briefCustomRules, setBriefCustomRules] = react.useState([]);
      const [briefSettingsSaving, setBriefSettingsSaving] =
        react.useState(false);
      const [metricSelection, setMetricSelection] = react.useState([]);
      const [metricSaving, setMetricSaving] = react.useState(false);
      const [layoutOpen, setLayoutOpen] = react.useState(false);
      const [layoutName, setLayoutName] = react.useState("");
      const [dragVisual, setDragVisual] = react.useState(null);
      const [preview, setPreview] = react.useState(null);
      /** 方案 B：平台管理员的"全量项目"开关；其他角色不渲染入口。 */
      const [currentRole, setCurrentRole] = react.useState(null);
      const [currentUserId, setCurrentUserId] = react.useState("");
      const [readState, setReadState] = react.useState(readReadStates);
      const [moduleViews, setModuleViews] = react.useState({
        todo: "unread",
        focus: "unread",
        "meeting-minutes": "unread",
      });
      const readStateRef = react.useRef(readState);
      const scopeAll = react.useSyncExternalStore(
        scopeStore.subscribe.bind(scopeStore),
        scopeStore.getSnapshot.bind(scopeStore),
        scopeStore.getSnapshot.bind(scopeStore),
      );

      const dragRef = react.useRef(null);
      const resizeRef = react.useRef(null);
      const previewRef = react.useRef(null);
      const dragVisualRef = react.useRef(null);
      const cardRefs = react.useRef(new Map());
      const toastTimer = react.useRef(0);
      const firstLoad = react.useRef(true);

      const followSnapshot = react.useSyncExternalStore(
        followStore.subscribe.bind(followStore),
        followStore.getSnapshot.bind(followStore),
        followStore.getSnapshot.bind(followStore),
      );
      const followCount = followSnapshot.items.size;
      const previousFollowCount = react.useRef(followCount);

      react.useEffect(() => {
        previewRef.current = preview;
      }, [preview]);
      react.useEffect(() => {
        dragVisualRef.current = dragVisual;
      }, [dragVisual]);
      react.useEffect(() => {
        readStateRef.current = readState;
      }, [readState]);

      const showToast = react.useCallback((message) => {
        setToast(message);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(""), 2600);
      }, []);

      const isItemRead = react.useCallback(
        (moduleId, item) => {
          if (currentUserId === "") return false;
          const signature = itemReadSignature(item);
          return Boolean(readState[currentUserId]?.[moduleId]?.[signature]);
        },
        [currentUserId, readState],
      );

      const markItemRead = react.useCallback(
        (moduleId, item) => {
          if (currentUserId === "") return;
          const signature = itemReadSignature(item);
          if (readStateRef.current[currentUserId]?.[moduleId]?.[signature]) {
            return;
          }
          const next = {
            ...readStateRef.current,
            [currentUserId]: {
              ...readStateRef.current[currentUserId],
              [moduleId]: {
                ...readStateRef.current[currentUserId]?.[moduleId],
                [signature]: true,
              },
            },
          };
          readStateRef.current = next;
          setReadState(next);
          try {
            window.localStorage.setItem(READ_STATE_KEY, JSON.stringify(next));
          } catch {
            // 存储不可用时仍保留当前会话状态。
          }
          showToast("已标记为已读");
        },
        [currentUserId, showToast],
      );

      const moduleView = (moduleId) => moduleViews[moduleId] ?? "unread";
      const setModuleView = (moduleId, view) => {
        setModuleViews((prev) => ({ ...prev, [moduleId]: view }));
      };

      const loadSummary = react.useCallback(async (options = {}) => {
        if (!options.silent) setLoading(true);
        try {
          const result = await request(
            `/api/collab/workbench/summary?tzOffset=${TZ_OFFSET}${scopeStore.query()}`,
          );
          setModules(result.modules ?? {});
          const profileModules = Array.isArray(result.display?.visibleModules)
            ? result.display.visibleModules.filter((id) =>
                MODULE_ORDER.includes(id),
              )
            : [];
          setVisibleModules(
            profileModules.length > 0 ? profileModules : MODULE_ORDER,
          );
          if (typeof result.userId === "string" && result.userId !== "") {
            setCurrentUserId(result.userId);
          }
          const nextStates = {};
          for (const id of MODULE_ORDER) {
            const payload = result.modules?.[id];
            nextStates[id] = payload?.error
              ? { status: "error", error: payload.error }
              : { status: "ready" };
          }
          setStates(nextStates);
          setGlobalError("");
        } catch (error) {
          setGlobalError(error.message);
        } finally {
          setLoading(false);
        }
      }, []);

      const refreshModule = react.useCallback(
        async (id, options = {}) => {
          setStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], status: "refreshing" },
          }));
          try {
            const result = await request(
              `/api/collab/workbench/module?moduleId=${encodeURIComponent(id)}&tzOffset=${TZ_OFFSET}${scopeStore.query()}`,
            );
            const payload = result.module;
            setModules((prev) => ({ ...prev, [id]: payload }));
            setStates((prev) => ({
              ...prev,
              [id]: payload?.error
                ? { status: "error", error: payload.error }
                : { status: "ready" },
            }));
            if (!options.silent) {
              showToast(`${MODULE_META[id].title}已刷新`);
            }
          } catch (error) {
            setStates((prev) => ({
              ...prev,
              [id]: { status: "error", error: error.message },
            }));
            showToast(`${MODULE_META[id].title}刷新失败：${error.message}`);
          }
        },
        [showToast],
      );

      react.useEffect(() => {
        void loadSummary();
      }, [loadSummary]);

      react.useEffect(() => {
        void followStore.ensure();
      }, []);

      react.useEffect(() => {
        let disposed = false;
        const loadCurrentUser = () => {
          void request("/api/collab/auth/me")
            .then((result) => {
              if (disposed) return;
              setCurrentRole(result?.user?.role ?? null);
              setCurrentUserId(result?.user?.id ?? "");
            })
            .catch(() => undefined);
        };
        loadCurrentUser();
        window.addEventListener("pluginmax:collab-token", loadCurrentUser);
        return () => {
          disposed = true;
          window.removeEventListener("pluginmax:collab-token", loadCurrentUser);
        };
      }, []);

      /*
       * 切换"全量项目"范围后重新拉取聚合数据；首次挂载由上面的
       * loadSummary 负责，这里用 ref 跳过第一轮避免重复请求。
       */
      const scopeEffectFirst = react.useRef(true);
      react.useEffect(() => {
        if (scopeEffectFirst.current) {
          scopeEffectFirst.current = false;
          return;
        }
        void loadSummary({ silent: true });
      }, [scopeAll, loadSummary]);

      react.useEffect(() => {
        if (previousFollowCount.current === followCount) return;
        previousFollowCount.current = followCount;
        void refreshModule("focus", { silent: true });
      }, [followCount, refreshModule]);

      /*
       * 简报事件驱动推送：只有工作台页面打开时才建立 SSE 长连接
       * （页面未打开不做任何触达），服务端在领域事件后重算增量合并并推 diff。
       */
      react.useEffect(() => {
        let disposed = false;
        let controller = null;
        let retry = 0;
        let retryTimer = 0;
        let flashTimer = 0;

        const applyBrief = (payload) => {
          if (!payload || typeof payload !== "object") return;
          const modulePayload = payload.module;
          if (!modulePayload) return;
          setModules((prev) => ({ ...prev, brief: modulePayload }));
          setStates((prev) => ({ ...prev, brief: { status: "ready" } }));
          if (payload.type !== "brief") return;
          const diff = payload.diff ?? {};
          const changed =
            (diff.added?.length ?? 0) +
              (diff.updated?.length ?? 0) +
              (diff.removed?.length ?? 0) >
            0;
          if (!changed) return;
          setBriefPushed(true);
          window.clearTimeout(flashTimer);
          flashTimer = window.setTimeout(() => setBriefPushed(false), 2600);
        };

        const connect = async () => {
          const current = token();
          if (current === null) return;
          const nextController = new AbortController();
          controller = nextController;
          try {
            const response = await fetch(
              `/api/collab/workbench/brief/stream?tzOffset=${TZ_OFFSET}${scopeStore.query()}`,
              {
                headers: {
                  authorization: `Bearer ${current}`,
                  accept: "text/event-stream",
                  "cache-control": "no-store",
                },
                signal: nextController.signal,
              },
            );
            if (!response.ok || response.body === null) {
              throw new Error(`HTTP ${response.status}`);
            }
            retry = 0;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (!disposed) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let separator = buffer.indexOf("\n\n");
              while (separator >= 0) {
                const chunk = buffer.slice(0, separator);
                buffer = buffer.slice(separator + 2);
                for (const line of chunk.split("\n")) {
                  if (!line.startsWith("data:")) continue;
                  try {
                    applyBrief(JSON.parse(line.slice(5).trim()));
                  } catch {
                    // Ignore malformed frames; the next delta or refresh recovers.
                  }
                }
                separator = buffer.indexOf("\n\n");
              }
            }
          } catch (error) {
            if (disposed || error?.name === "AbortError") return;
          }
          if (disposed) return;
          retry += 1;
          retryTimer = window.setTimeout(
            () => void connect(),
            Math.min(15_000, 1_200 * retry),
          );
        };

        const onTokenChange = () => {
          controller?.abort();
          controller = null;
          window.clearTimeout(retryTimer);
          retry = 0;
          void connect();
        };
        /* 范围切换后服务端按新 principal 重算，长连接需要重连以保持一致。 */
        const onScopeChange = () => {
          controller?.abort();
          controller = null;
          window.clearTimeout(retryTimer);
          retry = 0;
          void connect();
        };
        const unsubscribeScope = scopeStore.subscribe(onScopeChange);
        window.addEventListener("pluginmax:collab-token", onTokenChange);
        void connect();
        return () => {
          disposed = true;
          unsubscribeScope();
          window.removeEventListener("pluginmax:collab-token", onTokenChange);
          window.clearTimeout(retryTimer);
          window.clearTimeout(flashTimer);
          controller?.abort();
        };
      }, []);

      react.useEffect(() => {
        const synchronizeFollows = () => {
          followStore.loaded = false;
          void followStore
            .ensure()
            .then(() => refreshModule("focus", { silent: true }));
        };
        const onTokenChange = () => {
          followStore.loaded = false;
          followStore.commit(new Map());
          void loadSummary();
        };
        const onToast = (event) => {
          const message = event?.detail?.message;
          if (typeof message === "string" && message !== "") showToast(message);
        };
        window.addEventListener("pluginmax:follow-change", synchronizeFollows);
        window.addEventListener("pluginmax:collab-token", onTokenChange);
        window.addEventListener("pluginmax:workbench-toast", onToast);
        return () => {
          window.removeEventListener(
            "pluginmax:follow-change",
            synchronizeFollows,
          );
          window.removeEventListener("pluginmax:collab-token", onTokenChange);
          window.removeEventListener("pluginmax:workbench-toast", onToast);
        };
      }, [loadSummary, showToast]);

      react.useEffect(() => {
        try {
          window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutState));
        } catch {
          // 布局是 UI 偏好，本地存储不可用时仅保留运行时状态。
        }
      }, [layoutState]);

      react.useEffect(() => {
        if (currentUserId === "") return;
        try {
          window.localStorage.setItem(
            READ_STATE_KEY,
            JSON.stringify(readState),
          );
        } catch {
          // 已读状态是本地 UI 偏好，存储不可用时仅保留当前会话状态。
        }
      }, [currentUserId, readState]);

      react.useEffect(() => {
        if (briefDetailItem === null && !briefSettingsOpen) return;
        const onKeyDown = (event) => {
          if (event.key !== "Escape") return;
          if (briefDetailItem !== null) setBriefDetailItem(null);
          else if (briefSettingsOpen) setBriefSettingsOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [briefDetailItem, briefSettingsOpen]);

      react.useEffect(() => {
        const stage = stageElement();
        if (stage !== null && firstLoad.current) {
          firstLoad.current = false;
          stage.scrollTop = scrollMemory.value;
        }
        return () => {
          const element = stageElement();
          if (element !== null) scrollMemory.value = element.scrollTop;
        };
      }, []);

      const view = layoutView(layoutState);

      const openLink = react.useCallback((link) => {
        navigateTo(link);
      }, []);

      const markBriefItemRead = react.useCallback(
        async (item) => {
          if (item?.readState !== "unread") return;
          try {
            const result = await request(
              `/api/collab/workbench/brief/read${scopeStore.leading()}`,
              {
                method: "POST",
                body: JSON.stringify({
                  itemId: item.itemId,
                  tzOffset: TZ_OFFSET,
                }),
              },
            );
            setModules((prev) => ({ ...prev, brief: result.module }));
            setStates((prev) => ({
              ...prev,
              brief: { status: "ready" },
            }));
            setBriefDetailItem((prev) =>
              prev?.itemId === item.itemId
                ? { ...prev, readState: "read" }
                : prev,
            );
          } catch (error) {
            showToast(`简报状态更新失败：${error.message}`);
          }
        },
        [showToast],
      );

      const openBriefDetail = react.useCallback(
        (item) => {
          setBriefHelpSection(null);
          setBriefDetailItem(item);
          void markBriefItemRead(item);
        },
        [markBriefItemRead],
      );

      const openBriefItem = react.useCallback((item) => {
        setBriefDetailItem(null);
        navigateTo(item.deepLink);
      }, []);

      const closeBriefDetail = react.useCallback(() => {
        setBriefDetailItem(null);
      }, []);

      const navigateBriefItem = react.useCallback(() => {
        const item = briefDetailItem;
        setBriefDetailItem(null);
        if (item?.deepLink !== undefined) navigateTo(item.deepLink);
      }, [briefDetailItem]);

      const toggleBriefSection = react.useCallback((kind) => {
        setBriefExpandedSections((prev) => ({
          ...prev,
          [kind]: !prev[kind],
        }));
      }, []);

      const toggleBriefHelp = react.useCallback((kind) => {
        setBriefHelpSection((prev) => (prev === kind ? null : kind));
      }, []);

      const toggleSuggestion = react.useCallback((itemId) => {
        setExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
      }, []);

      const toggleBriefText = react.useCallback((itemId) => {
        setBriefTextExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
      }, []);

      const commitLayout = react.useCallback((order, moduleSizes) => {
        setLayoutState((prev) => {
          const layouts = prev.layouts.map((layout) => ({
            ...layout,
            order: [...layout.order],
            modules: { ...layout.modules },
          }));
          const active =
            layouts.find((layout) => layout.id === prev.activeId) ?? layouts[0];
          const snapshot = {
            order: [...order],
            modules: JSON.parse(JSON.stringify(moduleSizes)),
          };
          if (active.id === prev.defaultId) {
            return { ...prev, layouts, current: snapshot };
          }
          if (active !== undefined) {
            active.order = snapshot.order;
            active.modules = snapshot.modules;
          }
          return { ...prev, layouts };
        });
      }, []);

      const moveInArray = (list, id, targetId, after) => {
        const without = list.filter((item) => item !== id);
        const index = without.indexOf(targetId);
        if (index === -1) return list;
        without.splice(after ? index + 1 : index, 0, id);
        return without;
      };

      const findDropTarget = (x, y, draggedId) => {
        for (const [id, card] of cardRefs.current.entries()) {
          if (id === draggedId || !card) continue;
          const rect = card.getBoundingClientRect();
          if (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
          ) {
            return { id, after: y > rect.top + rect.height / 2 };
          }
        }
        return null;
      };

      const isInteractive = (target) =>
        Boolean(
          target?.closest?.(
            "button, a, input, select, textarea, [role='button'], [data-no-drag='true']",
          ),
        );

      const beginDrag = (event, id) => {
        if (event.button !== 0) return;
        if (isInteractive(event.target)) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragRef.current = {
          id,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
        };
      };

      const moveDrag = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.active) {
          if (Math.abs(dx) + Math.abs(dy) < 5) return;
          drag.active = true;
        }
        const target = findDropTarget(event.clientX, event.clientY, drag.id);
        setDragVisual({
          id: drag.id,
          dx,
          dy,
          targetId: target?.id ?? null,
          after: target?.after ?? false,
        });
      };

      const endDrag = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const visual = dragVisualRef.current;
        dragRef.current = null;
        setDragVisual(null);
        if (!drag.active || !visual?.targetId) return;
        const nextOrder = moveInArray(
          view.order,
          drag.id,
          visual.targetId,
          visual.after,
        );
        if (nextOrder.join("|") !== view.order.join("|")) {
          commitLayout(nextOrder, view.modules);
        }
      };

      const beginWidthResize = (event, id) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const card = cardRefs.current.get(id);
        if (!card) return;
        const cols = view.modules[id].cols;
        const startWidth = card.offsetWidth;
        const columnWidth = (startWidth - (cols - 1) * GRID_GAP) / cols;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        resizeRef.current = {
          kind: "width",
          id,
          startX: event.clientX,
          startY: 0,
          startCols: cols,
          startHeight: 0,
          step: columnWidth + GRID_GAP,
        };
        setPreview({ id, cols, height: null });
      };

      const beginHeightResize = (event, id) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const card = cardRefs.current.get(id);
        if (!card) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        resizeRef.current = {
          kind: "height",
          id,
          startX: 0,
          startY: event.clientY,
          startCols: view.modules[id].cols,
          startHeight: card.offsetHeight,
          previousHeight: view.modules[id].height ?? null,
          step: 0,
        };
        setPreview({
          id,
          cols: view.modules[id].cols,
          height: card.offsetHeight,
        });
      };

      const moveResize = (event) => {
        const resize = resizeRef.current;
        if (!resize) return;
        if (resize.kind === "width") {
          const raw =
            resize.startCols + (event.clientX - resize.startX) / resize.step;
          const next = WIDTH_COLS.reduce((closest, current) =>
            Math.abs(current - raw) < Math.abs(closest - raw)
              ? current
              : closest,
          );
          setPreview({ id: resize.id, cols: next, height: null });
          return;
        }
        const nextHeight = Math.max(
          MIN_HEIGHT,
          Math.min(
            MAX_HEIGHT,
            Math.round(resize.startHeight + (event.clientY - resize.startY)),
          ),
        );
        setPreview({
          id: resize.id,
          cols: resize.startCols,
          height: nextHeight,
        });
      };

      const endResize = (event) => {
        const resize = resizeRef.current;
        if (!resize) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const value = previewRef.current;
        resizeRef.current = null;
        setPreview(null);
        if (!value || value.id !== resize.id) return;
        const moduleSizes = JSON.parse(JSON.stringify(view.modules));
        // 拖动起点是「可见高度」，只是点一下手柄不应改写原来的最大高度。
        const height =
          resize.kind === "height" && value.height === resize.startHeight
            ? resize.previousHeight
            : (value.height ?? null);
        moduleSizes[resize.id] = {
          cols: value.cols ?? moduleSizes[resize.id].cols,
          height,
        };
        commitLayout(view.order, moduleSizes);
      };

      const openMetricSettings = () => {
        setMetricSelection(modules.metrics?.data?.selected ?? []);
        setMetricOpen(true);
      };

      const toggleMetricSelection = (id) => {
        setMetricSelection((prev) =>
          prev.includes(id)
            ? prev.filter((item) => item !== id)
            : prev.length >= 5
              ? prev
              : [...prev, id],
        );
      };

      const saveMetricSettings = async () => {
        if (metricSelection.length === 0) {
          showToast("至少选择 1 项核心指标");
          return;
        }
        setMetricSaving(true);
        try {
          const result = await request(
            `/api/collab/workbench/metrics${scopeStore.leading()}`,
            {
              method: "PUT",
              body: JSON.stringify({ selected: metricSelection }),
            },
          );
          setModules((prev) => ({ ...prev, metrics: result.module }));
          setStates((prev) => ({ ...prev, metrics: { status: "ready" } }));
          setMetricOpen(false);
          showToast("核心指标已更新");
        } catch (error) {
          showToast(`指标配置保存失败：${error.message}`);
        } finally {
          setMetricSaving(false);
        }
      };

      const openBriefSettings = () => {
        const settings = modules.brief?.data?.settings;
        setBriefMode(settings?.mode ?? "lastLeave");
        setBriefWindowFrom(isoToLocalInput(settings?.manualWindowFrom));
        setBriefIncludeTypes(
          settings?.includeTypes?.length > 0
            ? [...settings.includeTypes]
            : BRIEF_INCLUDE_OPTIONS.map((option) => option.id),
        );
        setBriefCustomRules(
          (settings?.customRules ?? []).map((rule) => ({ ...rule })),
        );
        setBriefSettingsTab("content");
        setBriefSettingsOpen(true);
      };

      const toggleBriefIncludeType = (id) => {
        setBriefIncludeTypes((prev) =>
          prev.includes(id)
            ? prev.filter((item) => item !== id)
            : [...prev, id],
        );
      };

      const addBriefCustomRule = () => {
        setBriefCustomRules((prev) => [
          ...prev,
          {
            id: `brief-rule-${Date.now().toString(36)}`,
            name: "自定义关注",
            prompt: "",
            enabled: true,
          },
        ]);
      };

      const updateBriefCustomRule = (id, patch) => {
        setBriefCustomRules((prev) =>
          prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
        );
      };

      const removeBriefCustomRule = (id) => {
        setBriefCustomRules((prev) => prev.filter((rule) => rule.id !== id));
      };

      const saveBriefSettings = async () => {
        const manualWindowFrom =
          briefMode === "manual" ? localInputToIso(briefWindowFrom) : undefined;
        if (briefMode === "manual" && manualWindowFrom === undefined) {
          showToast("请选择手动时间窗口的开始时间");
          return;
        }
        if (briefIncludeTypes.length === 0) {
          showToast("至少保留一种简报内容类型");
          return;
        }
        const customRules = briefCustomRules.map((rule) => ({
          ...rule,
          name: String(rule.name ?? "").trim() || "自定义关注",
          prompt: String(rule.prompt ?? "").trim(),
        }));
        if (customRules.some((rule) => rule.prompt === "")) {
          showToast("请填写自定义关注规则，或删除未完成的规则");
          return;
        }
        setBriefSettingsSaving(true);
        try {
          const result = await request(
            `/api/collab/workbench/brief/settings?tzOffset=${TZ_OFFSET}${scopeStore.query()}`,
            {
              method: "PUT",
              body: JSON.stringify({
                mode: briefMode,
                ...(briefMode === "manual" ? { manualWindowFrom } : {}),
                includeTypes: briefIncludeTypes,
                customRules,
              }),
            },
          );
          setModules((prev) => ({ ...prev, brief: result.module }));
          setStates((prev) => ({ ...prev, brief: { status: "ready" } }));
          setBriefSettingsOpen(false);
          showToast("简报生成规则已更新");
        } catch (error) {
          showToast(`简报规则保存失败：${error.message}`);
        } finally {
          setBriefSettingsSaving(false);
        }
      };

      const saveLayout = () => {
        const name = layoutName.trim();
        if (name === "") {
          showToast("请输入布局名称");
          return;
        }
        if (layoutState.layouts.some((layout) => layout.name === name)) {
          showToast("布局名称已存在，请换个名称");
          return;
        }
        const id = `layout-${Date.now()}`;
        const layout = {
          id,
          name,
          order: [...view.order],
          modules: JSON.parse(JSON.stringify(view.modules)),
        };
        setLayoutState((prev) => ({
          ...prev,
          layouts: [...prev.layouts, layout],
          activeId: id,
          current: null,
        }));
        setLayoutName("");
        showToast(`已保存布局「${name}」`);
      };

      const selectLayout = (id) => {
        setLayoutState((prev) => {
          if (!prev.layouts.some((layout) => layout.id === id)) return prev;
          return { ...prev, activeId: id, current: null };
        });
      };

      const setDefaultLayout = (id) => {
        setLayoutState((prev) =>
          prev.layouts.some((layout) => layout.id === id)
            ? { ...prev, defaultId: id }
            : prev,
        );
        showToast("已设为默认布局");
      };

      const deleteLayout = (id) => {
        const layout = layoutState.layouts.find((item) => item.id === id);
        if (!layout || id === layoutState.defaultId) return;
        if (!window.confirm(`删除布局「${layout.name}」？`)) return;
        setLayoutState((prev) => {
          const layouts = prev.layouts.filter((item) => item.id !== id);
          return {
            ...prev,
            layouts,
            activeId: prev.activeId === id ? prev.defaultId : prev.activeId,
            current: prev.activeId === id ? null : prev.current,
          };
        });
        showToast(`已删除布局「${layout.name}」`);
      };

      const resetLayout = () => {
        setLayoutState((prev) => ({
          ...prev,
          activeId: prev.defaultId,
          current: null,
        }));
        showToast("已恢复默认布局");
      };

      const ctx = {
        briefView,
        briefExpandedSections,
        briefHelpSection,
        expanded,
        briefTextExpanded,
        openBriefDetail,
        openBriefItem,
        toggleBriefSection,
        toggleBriefHelp,
        openBriefSettings,
        toggleSuggestion,
        toggleBriefText,
        openLink,
        isFollowed: (type, id) => followSnapshot.items.has(`${type}:${id}`),
        moduleView,
        isItemRead,
        markItemRead,
      };

      const eligibleItemsFor = (moduleId) => {
        const items = modules[moduleId]?.data?.items ?? [];
        if (moduleId !== "focus") return items;
        return items.filter((item) =>
          focusItemFollowed(item, (type, id) =>
            followSnapshot.items.has(`${type}:${id}`),
          ),
        );
      };

      const readCountsFor = (moduleId) => {
        const items = eligibleItemsFor(moduleId);
        return {
          all: items.length,
          unread: items.filter((item) => !isItemRead(moduleId, item)).length,
        };
      };

      const briefData = modules.brief?.data;
      const briefUnreadCount =
        briefData?.unreadCount ?? briefData?.views?.unread?.length ?? 0;
      const briefAllCount = briefData?.views?.all?.length ?? 0;
      const briefAttentionCount = groupBriefItems(
        briefData?.views?.unread ?? [],
      ).attention.length;

      const cards = view.order
        .filter((id) => visibleModules.includes(id))
        .map((id) => {
          const payload = modules[id];
          const state = states[id] ?? {
            status: loading && payload === undefined ? "loading" : "ready",
          };
          const size = view.modules[id];
          const previewValue = preview?.id === id ? preview : null;
          const cols = previewValue?.cols ?? size.cols;
          const height = previewValue?.height ?? size.height;
          const dragging = dragVisual?.id === id;
          const dropTarget =
            dragVisual !== null && dragVisual.targetId === id && !dragging;
          const meta = h(
            "span",
            { className: "pmwb-pill" },
            `更新 ${formatTime(payload?.updatedAt ?? "")}`,
          );
          // 简报与三组可读卡片都使用标题旁的未读/全部切换。
          const readTracked = READ_MODULES.has(id);
          const readCounts = readTracked ? readCountsFor(id) : null;
          const readView = readTracked ? moduleView(id) : "all";
          const titleActions =
            id === "brief"
              ? h(
                  react.Fragment,
                  null,
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-iconbtn",
                      "aria-label": "简报生成规则",
                      title:
                        "1、只汇总所选时间窗口内与你相关的任务、工作流和 Agent 运行。\n2、默认从上次离开时间开始，最多回看 24 小时。\n3、未读条目保留；状态闭环后自动移除。",
                      onClick: openBriefSettings,
                    },
                    ICONS.info,
                  ),
                  briefAttentionCount > 0
                    ? h(
                        "span",
                        { className: "pmwb-brief-needs" },
                        `${briefAttentionCount} 项需处理`,
                      )
                    : null,
                  h(
                    "div",
                    {
                      className: "pmwb-seg",
                      role: "group",
                      "aria-label": "简报视图",
                    },
                    h(
                      "button",
                      {
                        type: "button",
                        className:
                          briefView === "unread" ? "active" : undefined,
                        "aria-pressed": briefView === "unread",
                        onClick: () => setBriefView("unread"),
                      },
                      `未读 ${briefUnreadCount}`,
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: briefView === "all" ? "active" : undefined,
                        "aria-pressed": briefView === "all",
                        onClick: () => setBriefView("all"),
                      },
                      `全部 ${briefAllCount}`,
                    ),
                  ),
                )
              : readTracked
                ? h(
                    "div",
                    {
                      className: "pmwb-seg",
                      role: "group",
                      "aria-label": `${MODULE_META[id].title}视图`,
                    },
                    h(
                      "button",
                      {
                        type: "button",
                        className: readView === "unread" ? "active" : undefined,
                        "aria-pressed": readView === "unread",
                        onClick: () => setModuleView(id, "unread"),
                      },
                      `未读 ${readCounts?.unread ?? 0}`,
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: readView === "all" ? "active" : undefined,
                        "aria-pressed": readView === "all",
                        onClick: () => setModuleView(id, "all"),
                      },
                      `全部 ${readCounts?.all ?? 0}`,
                    ),
                  )
                : null;
          const extraActions =
            id === "brief"
              ? h(
                  react.Fragment,
                  null,
                  meta,
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-iconbtn",
                      "aria-label": "编辑简报生成规则",
                      title: "编辑简报生成规则",
                      "aria-haspopup": "dialog",
                      onClick: openBriefSettings,
                    },
                    ICONS.gear,
                  ),
                  briefPushed
                    ? h(
                        "span",
                        { className: "pmwb-pill accent", role: "status" },
                        "已更新",
                      )
                    : null,
                )
              : id === "metrics"
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-iconbtn",
                      "aria-label": "配置核心指标",
                      title: "配置核心指标",
                      onClick: openMetricSettings,
                    },
                    ICONS.gear,
                  )
                : null;
          const body =
            payload === undefined
              ? LoadingBlock()
              : payload.error
                ? h(ErrorBlock, {
                    message: payload.error,
                    onRetry: () => refreshModule(id),
                  })
                : state.status === "error" && payload.data === undefined
                  ? h(ErrorBlock, {
                      message: state.error,
                      onRetry: () => refreshModule(id),
                    })
                  : renderModuleBody(id, payload, ctx);
          return h(
            WorkbenchCard,
            {
              key: id,
              id,
              title: MODULE_META[id].title,
              count: readTracked ? "" : moduleCount(id, payload, briefView),
              countBadge: false,
              titleActions,
              meta: id === "brief" ? null : meta,
              extraActions,
              refreshing: state.status === "refreshing",
              onRefresh: () => refreshModule(id),
              cardRef: (element) => {
                if (element === null) cardRefs.current.delete(id);
                else cardRefs.current.set(id, element);
              },
              cols,
              height,
              resized: height !== null && height !== undefined,
              dragging,
              dropTarget,
              transform: dragging
                ? `translate(${dragVisual.dx}px, ${dragVisual.dy}px)`
                : undefined,
              onHeadPointerDown: (event) => beginDrag(event, id),
              onHeadPointerMove: moveDrag,
              onHeadPointerUp: endDrag,
              onHeightPointerDown: (event) => beginHeightResize(event, id),
              onHeightPointerMove: moveResize,
              onHeightPointerUp: endResize,
              onWidthPointerDown: (event) => beginWidthResize(event, id),
              onWidthPointerMove: moveResize,
              onWidthPointerUp: endResize,
            },
            body,
          );
        });

      const personal =
        mode !== "personal"
          ? null
          : h(
              "div",
              { className: "pmwb-canvas", "data-workbench-canvas": true },
              globalError !== ""
                ? h(
                    "div",
                    {
                      className: "pmwb-error",
                      style: { gridColumn: "span 6" },
                    },
                    h("span", null, globalError),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmwb-btn",
                        onClick: () => loadSummary(),
                      },
                      "重试",
                    ),
                  )
                : null,
              ...cards,
            );

      const cockpit =
        mode !== "cockpit"
          ? null
          : h(
              "section",
              { className: "pmwb-cockpit", "aria-label": "管理驾驶舱" },
              h(
                "div",
                { className: "pmwb-cockpit-copy" },
                h("span", { className: "eyebrow" }, "Management Cockpit"),
                h("h2", null, "管理驾驶舱预留入口"),
                h(
                  "p",
                  null,
                  "后续将沉淀项目健康度、资源负载、流程 SLA、成本达成和组织风险的全局视图。当前先保留模式入口，不影响我的工作台。",
                ),
              ),
            );

      const metricModal = !metricOpen
        ? null
        : h(
            "div",
            {
              className: "pmwb-mask open",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "配置核心指标",
              onClick: (event) => {
                if (event.target === event.currentTarget) setMetricOpen(false);
              },
            },
            h(
              "div",
              { className: "pmwb-modal" },
              h(
                "div",
                { className: "pmwb-modal-head" },
                h("h2", null, "配置核心指标"),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb-iconbtn",
                    "aria-label": "关闭",
                    onClick: () => setMetricOpen(false),
                  },
                  ICONS.close,
                ),
              ),
              h(
                "div",
                { className: "pmwb-modal-body" },
                ...(modules.metrics?.data?.items ?? []).map((metric) =>
                  h(
                    "label",
                    { className: "pmwb-metric-option", key: metric.id },
                    h("input", {
                      type: "checkbox",
                      checked: metricSelection.includes(metric.id),
                      disabled:
                        !metricSelection.includes(metric.id) &&
                        metricSelection.length >= 5,
                      onChange: () => toggleMetricSelection(metric.id),
                    }),
                    h(
                      "span",
                      null,
                      h("strong", null, metric.label),
                      h("small", null, metric.description),
                    ),
                  ),
                ),
                h(
                  "p",
                  { className: "pmwb-help" },
                  "最多选择 5 项，至少 1 项；保存后立即刷新核心指标模块。",
                ),
                h(
                  "div",
                  { className: "pmwb-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn",
                      onClick: () => setMetricOpen(false),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn primary",
                      disabled: metricSaving,
                      onClick: () => void saveMetricSettings(),
                    },
                    metricSaving ? "保存中…" : "保存配置",
                  ),
                ),
              ),
            ),
          );

      const briefSettingsModal = !briefSettingsOpen
        ? null
        : h(
            "div",
            {
              className: "pmwb-mask open",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "编辑简报生成规则",
              onClick: (event) => {
                if (event.target === event.currentTarget) {
                  setBriefSettingsOpen(false);
                }
              },
            },
            h(
              "div",
              { className: "pmwb-modal pmwb-brief-settings" },
              h(
                "div",
                { className: "pmwb-modal-head" },
                h("h2", null, "简报设置"),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb-iconbtn",
                    "aria-label": "关闭",
                    onClick: () => setBriefSettingsOpen(false),
                  },
                  ICONS.close,
                ),
              ),
              h(
                "div",
                {
                  className: "pmwb-brief-tabs",
                  role: "tablist",
                  "aria-label": "简报设置分类",
                },
                h(
                  "button",
                  {
                    type: "button",
                    className: `pmwb-brief-tab${briefSettingsTab === "content" ? " active" : ""}`,
                    role: "tab",
                    "aria-selected": briefSettingsTab === "content",
                    onClick: () => setBriefSettingsTab("content"),
                  },
                  "内容",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: `pmwb-brief-tab${briefSettingsTab === "rules" ? " active" : ""}`,
                    role: "tab",
                    "aria-selected": briefSettingsTab === "rules",
                    onClick: () => setBriefSettingsTab("rules"),
                  },
                  "自定义关注",
                ),
              ),
              h(
                "div",
                { className: "pmwb-modal-body" },
                briefSettingsTab === "content"
                  ? [
                      h(
                        "section",
                        {
                          className: "pmwb-brief-settings-section",
                          key: "brief-window",
                        },
                        h(
                          "p",
                          { className: "pmwb-brief-settings-label" },
                          "时间窗口",
                        ),
                        h(
                          "label",
                          { className: "pmwb-radio-row" },
                          h("input", {
                            type: "radio",
                            name: "brief-window-mode",
                            checked: briefMode === "lastLeave",
                            onChange: () => setBriefMode("lastLeave"),
                          }),
                          h("span", null, "根据上一次离开时间自动生成"),
                        ),
                        h(
                          "label",
                          { className: "pmwb-radio-row" },
                          h("input", {
                            type: "radio",
                            name: "brief-window-mode",
                            checked: briefMode === "manual",
                            onChange: () => setBriefMode("manual"),
                          }),
                          h("span", null, "手动指定时间窗口"),
                        ),
                        h("input", {
                          className: "pmwb-input",
                          type: "datetime-local",
                          value: briefWindowFrom,
                          disabled: briefMode !== "manual",
                          "aria-label": "时间窗口开始时间",
                          onChange: (event) =>
                            setBriefWindowFrom(event.target.value),
                        }),
                      ),
                      h(
                        "section",
                        {
                          className: "pmwb-brief-settings-section",
                          key: "brief-types",
                        },
                        h(
                          "p",
                          { className: "pmwb-brief-settings-label" },
                          "内容类型",
                        ),
                        h(
                          "div",
                          { className: "pmwb-brief-config-grid" },
                          ...BRIEF_INCLUDE_OPTIONS.map((option) =>
                            h(
                              "label",
                              {
                                className: "pmwb-brief-config-option",
                                key: option.id,
                              },
                              h("input", {
                                type: "checkbox",
                                checked: briefIncludeTypes.includes(option.id),
                                onChange: () =>
                                  toggleBriefIncludeType(option.id),
                              }),
                              h("span", null, option.label),
                            ),
                          ),
                        ),
                        h(
                          "p",
                          { className: "pmwb-help" },
                          "至少保留一种内容类型；关闭后对应候选不会进入简报。",
                        ),
                      ),
                      h(
                        "ol",
                        {
                          className: "pmwb-rule-list",
                          key: "brief-rules",
                        },
                        h(
                          "li",
                          null,
                          "只汇总所选时间窗口内与你相关的任务、工作流和 Agent 运行。",
                        ),
                        h(
                          "li",
                          null,
                          "默认从上次离开时间开始，最多回看 24 小时。",
                        ),
                        h(
                          "li",
                          null,
                          "未读条目保留；状态闭环后自动从简报移除。",
                        ),
                      ),
                    ]
                  : [
                      h(
                        "section",
                        {
                          className: "pmwb-brief-settings-section",
                          key: "brief-custom-rules",
                        },
                        h(
                          "p",
                          { className: "pmwb-brief-settings-label" },
                          "关注规则",
                        ),
                        briefCustomRules.length === 0
                          ? h(
                              "p",
                              { className: "pmwb-help" },
                              "还没有自定义关注规则。规则可以使用关键词、来源和对象名称，把已有候选收拢成一个关注项。",
                            )
                          : null,
                        ...briefCustomRules.map((rule) =>
                          h(
                            "div",
                            {
                              className: "pmwb-brief-rule",
                              key: rule.id,
                            },
                            h(
                              "div",
                              { className: "pmwb-brief-rule-head" },
                              h("input", {
                                className: "pmwb-input",
                                value: rule.name,
                                "aria-label": "关注规则名称",
                                placeholder: "规则名称",
                                onChange: (event) =>
                                  updateBriefCustomRule(rule.id, {
                                    name: event.target.value,
                                  }),
                              }),
                              h(
                                "label",
                                { className: "pmwb-radio-row" },
                                h("input", {
                                  type: "checkbox",
                                  checked: rule.enabled !== false,
                                  onChange: (event) =>
                                    updateBriefCustomRule(rule.id, {
                                      enabled: event.target.checked,
                                    }),
                                }),
                                h("span", null, "启用"),
                              ),
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "pmwb-iconbtn",
                                  "aria-label": "删除关注规则",
                                  title: "删除规则",
                                  onClick: () => removeBriefCustomRule(rule.id),
                                },
                                ICONS.close,
                              ),
                            ),
                            h("textarea", {
                              value: rule.prompt,
                              "aria-label": "关注规则内容",
                              placeholder:
                                "例如：关键词：华东、库存；只看风险与升级事项。",
                              onChange: (event) =>
                                updateBriefCustomRule(rule.id, {
                                  prompt: event.target.value,
                                }),
                            }),
                          ),
                        ),
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmwb-btn",
                            onClick: addBriefCustomRule,
                          },
                          "新增关注规则",
                        ),
                        h(
                          "p",
                          { className: "pmwb-help" },
                          "自定义关注规则只重排和聚合已有候选，不具备额外数据权限，也不会补造事实。",
                        ),
                      ),
                    ],
                h(
                  "div",
                  { className: "pmwb-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn",
                      onClick: () => setBriefSettingsOpen(false),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn primary",
                      disabled: briefSettingsSaving,
                      onClick: () => void saveBriefSettings(),
                    },
                    briefSettingsSaving ? "保存中…" : "保存规则",
                  ),
                ),
              ),
            ),
          );

      const layoutModal = !layoutOpen
        ? null
        : h(
            "div",
            {
              className: "pmwb-mask open",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "布局管理",
              onClick: (event) => {
                if (event.target === event.currentTarget) setLayoutOpen(false);
              },
            },
            h(
              "div",
              { className: "pmwb-modal" },
              h(
                "div",
                { className: "pmwb-modal-head" },
                h("h2", null, "布局管理"),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb-iconbtn",
                    "aria-label": "关闭",
                    onClick: () => setLayoutOpen(false),
                  },
                  ICONS.close,
                ),
              ),
              h(
                "div",
                { className: "pmwb-modal-body" },
                h(
                  "div",
                  { className: "pmwb-save-row" },
                  h("input", {
                    className: "pmwb-input",
                    value: layoutName,
                    maxLength: 24,
                    placeholder: "输入布局名称，例如：上午专注",
                    "aria-label": "布局名称",
                    onChange: (event) => setLayoutName(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === "Enter") saveLayout();
                    },
                  }),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn primary",
                      onClick: saveLayout,
                    },
                    "保存当前布局",
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb-layout-list" },
                  ...layoutState.layouts.map((layout) =>
                    h(
                      "div",
                      {
                        key: layout.id,
                        className: `pmwb-layout-item${layout.id === layoutState.activeId ? " active" : ""}`,
                      },
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pmwb-layout-copy",
                          "aria-pressed": layout.id === layoutState.activeId,
                          onClick: () => selectLayout(layout.id),
                        },
                        h(
                          "strong",
                          null,
                          layout.name,
                          layout.id === layoutState.defaultId
                            ? h(
                                "span",
                                { className: "pmwb-layout-badge" },
                                "默认",
                              )
                            : null,
                        ),
                        h("span", null, layoutSummary(layout)),
                      ),
                      h(
                        "div",
                        { className: "pmwb-layout-actions" },
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmwb-btn",
                            disabled: layout.id === layoutState.defaultId,
                            onClick: () => setDefaultLayout(layout.id),
                          },
                          "设为默认",
                        ),
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmwb-btn",
                            disabled: layout.id === layoutState.defaultId,
                            onClick: () => deleteLayout(layout.id),
                          },
                          "删除",
                        ),
                      ),
                    ),
                  ),
                ),
                h(
                  "p",
                  { className: "pmwb-help" },
                  "拖拽和调整宽度后的模块会自动保存到当前布局。默认布局用于工作台头部的恢复操作。",
                ),
                h(
                  "div",
                  { className: "pmwb-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn",
                      onClick: () => setLayoutOpen(false),
                    },
                    "关闭",
                  ),
                ),
              ),
            ),
          );

      const briefDetailDrawer = renderBriefDetailDrawer(briefDetailItem, {
        closeBriefDetail,
        navigateBriefItem,
      });

      return h(
        "div",
        { className: "pmwb", "data-workbench-page": true },
        h("style", null, styles),
        h(
          "div",
          { className: "pmwb-head" },
          h(
            "nav",
            { className: "pmwb-tabs", "aria-label": "工作台模式" },
            h(
              "button",
              {
                type: "button",
                className: `pmwb-tab${mode === "personal" ? " active" : ""}`,
                "aria-pressed": mode === "personal",
                onClick: () => setMode("personal"),
              },
              "我的工作台",
            ),
            h(
              "button",
              {
                type: "button",
                className: `pmwb-tab${mode === "cockpit" ? " active" : ""}`,
                "aria-pressed": mode === "cockpit",
                onClick: () => setMode("cockpit"),
              },
              "管理驾驶舱",
            ),
          ),
          h(
            "div",
            { className: "pmwb-head-actions" },
            currentRole === "admin"
              ? h(
                  "div",
                  {
                    className: "pmwb-scope-seg",
                    role: "group",
                    "aria-label": "项目范围",
                  },
                  h(
                    "button",
                    {
                      type: "button",
                      className: scopeAll ? "" : "active",
                      "aria-pressed": !scopeAll,
                      title: "只聚合我已加入的项目（默认视图）",
                      onClick: () => scopeStore.set(false),
                    },
                    "仅看已加入",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: scopeAll ? "active" : "",
                      "aria-pressed": scopeAll,
                      title: "平台管理员全量视图：聚合全部宿主机项目",
                      onClick: () => scopeStore.set(true),
                    },
                    "平台全量",
                  ),
                )
              : null,
            h(
              "button",
              {
                type: "button",
                className: "pmwb-iconbtn",
                "aria-label": "切换布局",
                title: "布局管理",
                "aria-haspopup": "dialog",
                onClick: () => setLayoutOpen(true),
              },
              ICONS.grid,
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmwb-iconbtn",
                "aria-label": "恢复默认布局",
                title: `恢复「${defaultLayoutOf(layoutState).name}」`,
                onClick: resetLayout,
              },
              ICONS.refresh,
            ),
            props.renderActions?.() ?? null,
          ),
        ),
        personal,
        cockpit,
        metricModal,
        briefSettingsModal,
        briefDetailDrawer,
        layoutModal,
        toast !== ""
          ? h("div", { className: "pmwb-toast", role: "status" }, toast)
          : null,
      );
    }

    /*
     * 「项目管理」全局路由由 dsh-collab-project 承接（含项目清单、成员权限、
     * 任务/工作流/日报与项目模版）。工作台只保留项目聚合数据接口
     * /api/collab/workbench/projects 与项目关注按钮，不再注册同名页面。
     */
    function WorkbenchGlobalPage(props) {
      const useShellRoute = props?.useShellRoute;
      const route = useShellRoute?.((state) => state.route);
      if (route !== "workbench") return null;
      return h(WorkbenchPage, props);
    }

    exports.__test = {
      navigateTo,
      itemReadSignature,
      filterUnreadItems,
      dataAgentBriefAttributes,
      groupBriefItems,
      briefPlainText,
    };
    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global",
            id: "pluginmax-workbench",
            order: 20,
          },
          WorkbenchGlobalPage,
        ),
      );
    };

    return module.exports;
  },
});
