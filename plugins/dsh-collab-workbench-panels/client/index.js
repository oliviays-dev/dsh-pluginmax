window.__ModuleLoader__.load({
  id: "dsh-collab-workbench-panels",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const react = require("react");
    const h = react.createElement;
    const ICONS = {
      gear: h(
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
          d: "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z",
        }),
      ),
      info: h(
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
        h("circle", { cx: 12, cy: 12, r: 9 }),
        h("path", { d: "M12 10.5V16.5M12 7.7h.01" }),
      ),
      sparkle: h(
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
          d: "m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z",
        }),
        h("path", {
          d: "m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
        }),
      ),
      chevron: h(
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
        h("path", { d: "m9 18 6-6-6-6" }),
      ),
      close: h(
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
        h("path", { d: "M18 6 6 18M6 6l12 12" }),
      ),
    };

    const TOKEN_KEY = "pluginmax.collab.token";
    const TZ_OFFSET = -new Date().getTimezoneOffset();
    const TODO_SCOPE_KEY = "dsh-workbench-todo-scope-v1";
    const READ_STATE_KEY = "dsh-workbench-read-state-v1";

    const LEGACY_MODULE = {
      "pluginmax.kpi-overview": "metrics",
      "pluginmax.daily-brief": "brief",
      "pluginmax.task-focus": "todo",
      "pluginmax.following": "focus",
      "pluginmax.meeting-insights": "meeting-minutes",
      "pluginmax.supply-exceptions": "control",
      "pluginmax.supplier-risk": "supplier",
    };

    const PANELS = [
      ["pluginmax.daily-brief", "每日简报"],
      ["pluginmax.task-focus", "我的待办"],
      ["pluginmax.kpi-overview", "核心指标"],
      ["pluginmax.following", "重点关注"],
      ["pluginmax.meeting-insights", "会议纪要"],
      ["pluginmax.supply-exceptions", "供给例外"],
      ["pluginmax.supplier-risk", "供应商风险"],
      ["pluginmax.workflow-runs", "工作流运行"],
      ["pluginmax.team-load", "AI伙伴负载"],
      ["pluginmax.industry-radar", "行业雷达"],
      ["pluginmax.data-agent", "Data Agent"],
    ];

    const AI_LOAD_AVATAR_PRESETS = [
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

    const styles = `
.pmwb2-panel{display:grid;gap:9px;min-height:80px;color:var(--dsw-alias-label-primary);--pmwb2-text-title:12.5px;--pmwb2-text-body:11.5px;--pmwb2-text-meta:11px;--pmwb2-text-caption:10px;--pmwb2-title-line:1.45;--pmwb2-body-line:1.55;}
.pmwb2-panel *{box-sizing:border-box;}
.pmwb2-skeleton{height:16px;border-radius:5px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-2),var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2)),var(--dsw-alias-bg-layer-2));background-size:200% 100%;animation:pmwb2-shimmer 1.3s linear infinite;}
.pmwb2-skeleton:nth-child(2){width:82%;}.pmwb2-skeleton:nth-child(3){width:64%;}
@keyframes pmwb2-shimmer{to{background-position:-200% 0}}
.pmwb2-error{display:grid;gap:7px;padding:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 35%,transparent);border-radius:7px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:11px;line-height:1.5;}
.pmwb2-error button{justify-self:start;padding:3px 8px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer;}
.pmwb2-list{display:grid;gap:6px;}
.pmwb-todo-scope-settings{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-todo-scope-settings > span{color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-meta);}
.pmwb-todo-scope-settings .pmwb-seg{flex:none;}
      .pmwb2-ai-load{display:grid;gap:9px;}
      .pmwb2-ai-load-table{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;overflow:auto;background:var(--dsw-alias-bg-layer-2);scrollbar-width:thin;}
      .pmwb2-ai-load-head,.pmwb2-ai-load-row{display:grid;grid-template-columns:20px minmax(96px,1.22fr) minmax(0,2fr);align-items:center;gap:6px;padding:7px 8px;}
      .pmwb2-ai-load-head{min-height:30px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;}
      .pmwb2-ai-load-head>span:first-child{text-align:center;}
      .pmwb2-ai-load-head-data{display:grid;gap:4px;min-width:0;}
      .pmwb2-ai-load-head-data span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;}
      .pmwb2-ai-load-head-data span:last-child{justify-self:end;text-align:right;}
      .pmwb2-ai-load-row{position:relative;min-height:42px;border-top:1px solid var(--dsw-alias-border-l2);background:transparent;}
      .pmwb2-ai-load-row:first-child{border-top:0;}
      .pmwb2-ai-load-row{cursor:pointer;transition:background-color .12s ease;}
      .pmwb2-ai-load-row:hover{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 6%,var(--dsw-alias-bg-layer-2));}
      .pmwb2-ai-load-row:focus-visible{outline:1px solid var(--dsw-alias-accent-primary,#4f8ef7);outline-offset:-1px;}
      .pmwb2-ai-load-row.leader{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 4%,transparent);}
      .pmwb2-ai-load-row.inactive{background:var(--dsw-alias-bg-base);}
      .pmwb2-ai-load-row.inactive:hover{background:var(--dsw-alias-bg-layer-1);}
      .pmwb2-ai-load-row.inactive .pmwb2-ai-avatar{opacity:.62;filter:saturate(.55);}
      .pmwb2-ai-load-row.inactive .pmwb2-ai-load-person strong{color:var(--dsw-alias-label-tertiary);font-weight:500;}
      .pmwb2-ai-load-row.inactive .pmwb2-ai-load-person small,
      .pmwb2-ai-load-row.inactive .pmwb2-ai-load-cell,
      .pmwb2-ai-load-row.inactive .pmwb2-ai-load-cell.primary{color:var(--dsw-alias-label-tertiary);font-weight:500;}
      .pmwb2-ai-load-rank{display:grid;place-items:center;width:20px;height:20px;border-radius:4px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:700;line-height:1.4;font-variant-numeric:tabular-nums;}
      .pmwb2-ai-load-row.leader .pmwb2-ai-load-rank{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,var(--dsw-alias-bg-layer-1));}
      .pmwb2-ai-load-person{display:flex;align-items:center;gap:5px;min-width:0;}
      .pmwb2-ai-avatar{display:grid;place-items:center;width:26px;height:26px;flex:none;padding:1px;border-radius:50%;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.2);}
      .pmwb2-ai-avatar.platform{background:#63b8ff;box-shadow:0 0 0 1px rgba(99,184,255,.45);}
      .pmwb2-ai-avatar-art{display:block;width:100%;height:100%;overflow:hidden;border:1px solid var(--dsw-alias-bg-layer-1);border-radius:50%;object-fit:cover;}
      .pmwb2-ai-load-person-copy{min-width:0;}
      .pmwb2-ai-load-person strong{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.5;}
      .pmwb2-ai-load-person small{display:block;min-width:0;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;}
      .pmwb2-ai-load-data{display:grid;gap:4px;min-width:0;}
      .pmwb2-ai-load-cell{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;text-align:right;font-variant-numeric:tabular-nums;}
      .pmwb2-ai-load-cell.primary{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:650;}
      .pmwb2-ai-load-cell.time{display:grid;justify-items:end;align-content:center;gap:0;justify-self:end;text-align:right;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.35;}
      .pmwb2-ai-load-runtime{display:flex;flex-direction:column;align-items:flex-end;gap:0;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.35;text-align:right;font-weight:650;}
      .pmwb2-ai-load-runtime-trend{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.4;font-weight:600;white-space:nowrap;}
      .pmwb2-ai-load-runtime-trend.up{color:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmwb2-ai-load-runtime-trend.down{color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmwb2-ai-load-row.inactive .pmwb2-ai-load-runtime-trend{color:var(--dsw-alias-label-tertiary);}
      .pmwb2-ai-load-warning{flex:none;color:var(--dsw-alias-state-warning-primary,#e2a737);font-size:10px;}
      .pmwb2-ai-load-divider{display:flex;align-items:center;gap:6px;padding:6px 8px;border-top:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;}
      .pmwb2-ai-load-divider::before,.pmwb2-ai-load-divider::after{content:"";height:1px;flex:1;background:var(--dsw-alias-border-l2);}
      @media(max-width:420px){.pmwb2-ai-load-head,.pmwb2-ai-load-row{grid-template-columns:20px minmax(88px,1fr) minmax(0,2fr);padding-inline:6px;gap:4px;}}
.pmwb2-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 9px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-row strong{min-width:0;font-size:var(--pmwb2-text-title);font-weight:650;line-height:var(--pmwb2-title-line);overflow-wrap:anywhere;}
.pmwb2-row small{color:var(--dsw-alias-label-tertiary);font-size:var(--pmwb2-text-caption);line-height:1.45;}
.pmwb2-row .pmwb2-row-note{grid-column:1/-1;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line);}
.pmwb2-data-agent-sessions{display:grid;gap:8px;}
.pmwb2-data-agent-session{min-width:0;display:grid;gap:5px;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;}
.pmwb2-data-agent-session:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));}
.pmwb2-data-agent-session-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-width:0;}
.pmwb2-data-agent-session-title{min-width:0;flex:1 1 auto;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:var(--pmwb2-text-title);font-weight:650;line-height:var(--pmwb2-title-line);text-overflow:ellipsis;white-space:nowrap;}
.pmwb2-data-agent-session-actions{flex:none;display:flex;align-items:center;gap:5px;}
.pmwb2-data-agent-session-project{color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-meta);line-height:1.45;overflow-wrap:anywhere;}
.pmwb2-data-agent-session-preview{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line);overflow-wrap:anywhere;}
.pmwb2-data-agent-session-preview.placeholder{color:var(--dsw-alias-label-tertiary);}
.pmwb2-pill,.pmwb2-tag{padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.7;white-space:nowrap;}
.pmwb2-tag{justify-self:end;border-radius:4px;}
.pmwb2-tag.warn,.pmwb2-tag.high{color:var(--dsw-alias-state-warning-primary,#e2a737);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 13%,transparent);}
.pmwb2-tag.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 13%,transparent);}
.pmwb2-tag.ok{color:var(--dsw-alias-state-success-primary,#34d47e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 13%,transparent);}
.pmwb2-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
.pmwb2-metric{padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-metric span{display:block;color:var(--dsw-alias-label-secondary);font-size:10px;}
.pmwb2-metric strong{display:block;margin-top:3px;font-size:18px;line-height:1.2;}
.pmwb2-metric small{margin-left:3px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:500;}
.pmwb2-progress{height:3px;margin-top:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
.pmwb2-progress > span{display:block;height:100%;background:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-brief{padding:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 32%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,var(--dsw-alias-bg-layer-2));}
.pmwb2-brief h3{margin:0;font-size:13px;line-height:1.45;}
.pmwb2-brief p{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.55;}
.pmwb2-empty{display:grid;place-items:center;min-height:90px;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:center;}
.pmwb2-source{color:var(--dsw-alias-label-tertiary);font-size:9.5px;text-align:right;}
.pmwb2-legacy-toolbar{display:flex;align-items:center;gap:7px;margin-bottom:8px;}
.pmwb-legacy{display:grid;gap:8px;}
.pmwb-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);}
.pmwb-seg button{min-height:22px;padding:1px 8px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;}
.pmwb-seg button.active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-weight:600;}
.pmwb-stack{display:grid;gap:8px;}
.pmwb-empty{padding:18px 10px;color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center;}
.pmwb-item{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name actions" "id time" "note note" "meta meta" "owner owner";column-gap:10px;row-gap:4px;align-items:start;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;}
.pmwb-item.pmwb-item-focus{grid-template-areas:"name actions" "id time" "note note" "owner owner";}
.pmwb-item.pmwb-item-todo{grid-template-areas:"name actions" "project project" "desc desc" "meta meta";column-gap:12px;row-gap:5px;align-items:start;padding:10px;}
.pmwb-todo-actions{grid-area:actions;display:grid;gap:6px;justify-items:end;align-content:start;}
.pmwb-todo-actions-main{display:flex;align-items:center;gap:6px;}
.pmwb-todo-name{grid-area:name;color:var(--dsw-alias-label-primary);font-size:var(--pmwb2-text-title);font-weight:650;line-height:var(--pmwb2-title-line);overflow-wrap:anywhere;}
.pmwb-todo-project{grid-area:project;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-meta);line-height:1.45;overflow-wrap:anywhere;}
.pmwb-todo-description{grid-area:desc;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line);white-space:pre-wrap;overflow-wrap:anywhere;}
.pmwb-todo-meta{grid-area:meta;display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-meta);line-height:1.5;}
.pmwb-todo-due{margin-left:auto;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
.pmwb-item.pmwb-item-todo.no-description{grid-template-areas:"name actions" "project project" "meta meta";}
.pmwb-item-todo .pmwb-read-action{min-height:26px;padding:2px 9px;font-size:12px;}
.pmwb2-card[data-plugin-id="pluginmax.task-focus"]{container-type:inline-size;}
@container (max-width:280px){
  .pmwb-item.pmwb-item-todo{grid-template-columns:minmax(0,1fr);grid-template-areas:"name" "actions" "project" "desc" "meta";}
  .pmwb-item.pmwb-item-todo.no-description{grid-template-areas:"name" "actions" "project" "meta";}
  .pmwb-todo-actions{justify-items:start;}
  .pmwb-todo-due{margin-left:0;}
}
.pmwb-item:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));}
.pmwb-item.read{opacity:1;}.pmwb-item.read:hover{opacity:1;}
.pmwb-item.meeting{grid-template-areas:"name actions" "context context" "meta meta" "sub sub" "owner owner";}
.pmwb-meeting-title{grid-area:name;display:flex;align-items:baseline;gap:8px;min-width:0;flex-wrap:wrap;}
.pmwb-meeting-title .pmwb-item-name{min-width:0;}
.pmwb-meeting-actions{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap;}
.pmwb-meeting-context{grid-area:context;display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;}
.pmwb-meeting-time{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.4;text-align:right;white-space:nowrap;}
.pmwb-meeting-project{min-width:0;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-meta);line-height:1.45;text-overflow:ellipsis;white-space:nowrap;}
.pmwb-item-name{grid-area:name;color:var(--dsw-alias-label-primary) !important;font-size:var(--pmwb2-text-title);font-weight:650;line-height:var(--pmwb2-title-line);overflow-wrap:anywhere;}
.pmwb-item-id{grid-area:id;color:var(--dsw-alias-label-tertiary);font-size:var(--pmwb2-text-meta);line-height:1.4;}
.pmwb-item-note{grid-area:note;min-width:0;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line);overflow-wrap:anywhere;}
.pmwb-note-status{color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.pmwb-note-status.accent{color:var(--dsw-alias-accent-primary,#4f8ef7);}.pmwb-note-status.warn{color:var(--dsw-alias-state-warning-primary,#e2a737);}.pmwb-note-status.ok{color:var(--dsw-alias-state-success-primary,#34d47e);}.pmwb-note-status.high{color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-note-divider{margin:0 4px;color:var(--dsw-alias-label-tertiary);}.pmwb-note-latest{color:var(--dsw-alias-label-secondary);}.pmwb-note-latest b{color:var(--dsw-alias-label-primary);font-weight:600;}
.pmwb-item-meta{grid-area:meta;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:var(--pmwb2-text-meta);color:var(--dsw-alias-label-secondary);}
.pmwb-item-owner{grid-area:owner;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-meta);}
.pmwb-item-trailing{grid-area:actions;display:flex;align-items:center;gap:6px;justify-self:end;flex-wrap:wrap;justify-content:flex-end;}
.pmwb-item-time{grid-area:time;justify-self:end;color:var(--dsw-alias-label-tertiary);font-size:var(--pmwb2-text-meta);line-height:1.4;white-space:nowrap;}
.pmwb-item-sub{grid-area:sub;display:block;width:100%;margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line);overflow-wrap:anywhere;}
.pmwb-item-sub b{color:var(--dsw-alias-label-primary);}.pmwb-item-sub.placeholder{color:var(--dsw-alias-label-tertiary);}
.pmwb-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:28px;padding:2px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;}
.pmwb-btn:hover{background:var(--dsw-alias-bg-layer-2);}
.pmwb-pill{flex:none;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6;white-space:nowrap;}
.pmwb-pill.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-pill.progress{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
.pmwb-pill.review{color:var(--dsw-alias-state-warning-primary,#e2a737);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 14%,transparent);}
.pmwb-pill.done,.pmwb-pill.ok{color:var(--dsw-alias-state-success-primary,#34d47e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 14%,transparent);}
.pmwb-pill.cancelled{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-follow-btn{display:inline-flex;align-items:center;justify-content:center;padding:3px;border:1px solid var(--dsw-alias-border-l3);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
.pmwb-follow-btn[aria-pressed="true"]{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
.pmwb-avatar{display:grid;place-items:center;width:18px;height:18px;flex:none;border-radius:50%;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:9px;font-weight:700;}
.pmwb-avatar.human{background:#2f9e66;color:#fff;}.pmwb-avatar.role{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 18%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}.pmwb-avatar.agent{width:14px;height:14px;font-size:8px;background:#6f53d6;color:#fff;}
.pmwb-avatar-ring{display:grid;place-items:center;width:20px;height:20px;flex:none;padding:2px;border-radius:50%;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.26);}
.pmwb-owner{display:inline-flex;align-items:center;gap:5px;min-width:0;}.pmwb-owner-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb-participants{display:flex;align-items:center;flex-wrap:wrap;gap:5px 6px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:11px;}
.pmwb-participants-label{flex:none;color:var(--dsw-alias-label-tertiary);}.pmwb-participant-separator{color:var(--dsw-alias-label-tertiary);}
.pmwb-meeting-meta{display:grid;gap:4px;margin-top:3px;font-size:11px;color:var(--dsw-alias-label-secondary);}.pmwb-meeting-line{display:flex;align-items:center;gap:6px;min-width:0;}
.pmwb-minutes-badge{display:inline-block;margin-right:4px;padding:0 5px;border-radius:4px;font-size:10px;line-height:16px;vertical-align:1px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 18%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
.pmwb-minutes-badge.confirmed{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 16%,transparent);color:var(--dsw-alias-state-success-primary,#34d47e);}
.pmwb-item-meta.pmwb-meeting-status{margin-top:0;}
.pmwb-read-state{display:inline-flex;align-items:center;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.8;white-space:nowrap;}
.pmwb-read-action{height:26px;padding:2px 8px;font-size:10.5px;color:var(--dsw-alias-label-secondary);}
.pmwb-metrics{display:flex;gap:10px;min-width:0;overflow-x:auto;padding-bottom:2px;}
.pmwb-metric-source{display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:4px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.45;}
.pmwb-metric-source b{color:var(--dsw-alias-label-secondary);font-weight:650;}
.pmwb-metric-source span{min-width:0;flex:1;overflow-wrap:anywhere;}
.pmwb-metric{min-width:132px;flex:1 1 0;padding:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-metric-label{display:flex;align-items:center;gap:6px;justify-content:space-between;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
.pmwb-metric-trend{font-size:10.5px;font-weight:650;}.pmwb-metric-trend.up{color:var(--dsw-alias-state-success-primary,#3fb950);}.pmwb-metric-trend.down{color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-metric-value{margin-top:6px;font-size:22px;line-height:1.15;font-weight:650;letter-spacing:0;}.pmwb-metric-value small{margin-left:2px;font-size:11.5px;font-weight:500;color:var(--dsw-alias-label-secondary);}
.pmwb-metric-target{margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.5;}
.pmwb-spark{display:flex;align-items:flex-end;gap:2px;height:26px;margin-top:9px;}.pmwb-spark span{flex:1;min-width:2px;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,transparent);}.pmwb-spark span.strong{background:var(--dsw-alias-accent-primary,#4f8ef7);}.pmwb-spark span.warn{background:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb2-kpi-panel{--pmwb2-kpi-padding:9px;--pmwb2-kpi-gap:5px;--pmwb2-kpi-label-size:12px;--pmwb2-kpi-value-size:26px;--pmwb2-kpi-target-size:10.5px;--pmwb2-kpi-spark-height:30px;--pmwb2-kpi-card-min-height:168px;display:grid;grid-template-rows:minmax(0,1fr);gap:9px;height:auto;min-height:0;}
.pmwb2-card[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-card-body{min-height:0;display:flex;flex-direction:column;overflow:hidden;}
.pmwb2-card[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-card-body .pmwb2-panel{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;}
.pmwb2-card[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-kpi-panel{flex:1 1 auto;}
.pmwb2-card.has-height[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-kpi-panel{height:100%;}
.pmwb2-kpi-panel.no-source{grid-template-rows:minmax(0,1fr);}
.pmwb2-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));grid-auto-rows:minmax(0,1fr);gap:var(--pmwb2-kpi-gap);min-height:0;height:auto;overflow:visible;}
.pmwb2-card.has-height[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-kpi-grid{height:100%;}
.pmwb2-kpi-card{display:flex;flex-direction:column;justify-content:space-between;gap:var(--pmwb2-kpi-gap);min-width:0;min-height:var(--pmwb2-kpi-card-min-height);overflow:hidden;padding:var(--pmwb2-kpi-padding);border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 24%,var(--dsw-alias-border-l2));background:linear-gradient(145deg,color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,var(--dsw-alias-bg-layer-2)),var(--dsw-alias-bg-layer-2));}
.pmwb2-card.has-height[data-plugin-id="pluginmax.kpi-overview"] .pmwb2-kpi-card{min-height:0;}
      .pmwb2-kpi-card:only-child{width:100%;max-width:360px;min-height:174px;justify-self:start;}
.pmwb2-kpi-card.no-spark{justify-content:space-between;}
.pmwb2-kpi-card .pmwb-metric-label{font-size:var(--pmwb2-kpi-label-size);}
.pmwb2-kpi-card .pmwb-metric-label,.pmwb2-kpi-card .pmwb-metric-value,.pmwb2-kpi-card .pmwb-metric-target{flex:0 0 auto;min-height:0;}
.pmwb2-kpi-card .pmwb-metric-value{margin-top:0;font-size:var(--pmwb2-kpi-value-size);line-height:1;font-weight:680;font-variant-numeric:tabular-nums;}
.pmwb2-kpi-card:only-child .pmwb-metric-value{margin-top:14px;font-size:34px;}
.pmwb2-kpi-card .pmwb-metric-value small{margin-left:4px;font-size:14px;}
.pmwb2-kpi-card .pmwb-metric-target{margin-top:0;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-kpi-target-size);}
.pmwb2-kpi-card .pmwb-spark{flex:1 1 0;height:auto;min-height:6px;max-height:var(--pmwb2-kpi-spark-height);margin-top:0;overflow:hidden;}
.pmwb-severity{flex:none;display:grid;place-items:center;width:34px;min-height:24px;padding:2px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:650;}
.pmwb-severity.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}.pmwb-severity.medium{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}.pmwb-severity.watch{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
.pmwb-control-item{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-control-item strong{display:block;font-size:var(--pmwb2-text-title);line-height:var(--pmwb2-title-line);}.pmwb-control-item p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line);}.pmwb-control-item small{display:block;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:var(--pmwb2-text-caption);}
.pmwb-control-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;}
.pmwb-coverage{display:grid;gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb-coverage-item{display:grid;grid-template-columns:96px minmax(0,1fr) 54px;gap:8px;align-items:center;font-size:11px;}.pmwb-coverage-item b{font-weight:500;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.pmwb-coverage-item span:last-child{text-align:right;color:var(--dsw-alias-label-secondary);}
.pmwb-coverage-track{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));overflow:hidden;}.pmwb-coverage-track span{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-accent-primary,#4f8ef7);}.pmwb-coverage-track span.risk{background:var(--dsw-alias-state-error-primary,#e5534b);}.pmwb-coverage-track span.safe{background:var(--dsw-alias-state-success-primary,#3fb950);}
.pmwb-note{margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;}.pmwb-note b{color:var(--dsw-alias-label-primary);}
.pmwb-brief-points{display:grid;gap:8px;margin:0;padding:0;list-style:none;}
.pmwb-brief-points > li{display:grid;grid-template-columns:minmax(0,1fr) 58px 84px;align-items:start;gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);font-size:12px;line-height:1.5;cursor:pointer;}
.pmwb-brief-points > li.read{opacity:.68;}
.pmwb-brief-copy{min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;}.pmwb-brief-copy b{color:var(--dsw-alias-label-primary);}
.pmwb-brief-title{color:var(--dsw-alias-label-primary);font-size:12.5px;font-weight:650;line-height:1.45;}
.pmwb-brief-text{margin-top:3px;line-height:1.55;}.pmwb-brief-text.clamped{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:6;max-height:10.4em;overflow:hidden;}
.pmwb-brief-md{display:grid;gap:5px;}.pmwb-brief-md p{margin:0;}.pmwb-brief-md h5{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-primary);}
.pmwb-brief-md ul,.pmwb-brief-md ol{margin:0;padding-left:16px;display:grid;gap:3px;}.pmwb-brief-md pre{margin:0;padding:7px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;}
.pmwb-brief-md table{border-collapse:collapse;width:100%;font-size:11px;}.pmwb-brief-md th,.pmwb-brief-md td{border:0.5px solid var(--dsw-alias-border-l2);padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere;}.pmwb-brief-md th{background:var(--dsw-alias-bg-layer-1);font-weight:600;}
.pmwb-brief-more{margin-top:4px;border:0;padding:0;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:11px;cursor:pointer;}.pmwb-brief-reason{margin-top:6px;padding-top:6px;border-top:0.5px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.5;}
.pmwb-tag{width:58px;min-height:20px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10.5px;text-align:center;white-space:nowrap;}
.pmwb-tag.data{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}.pmwb-tag.progress{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}.pmwb-tag.conclusion{color:var(--dsw-alias-state-success-primary,#3fb950);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent);}.pmwb-tag.decision{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}.pmwb-tag.review{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}.pmwb-tag.nudge{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb-brief-actions{display:grid;gap:6px;width:84px;justify-items:stretch;}.pmwb-brief-actions .pmwb-btn{width:100%;justify-content:center;}
.pmwb-decision{margin-top:7px;padding:8px 10px;border-left:2px solid var(--dsw-alias-accent-primary,#4f8ef7);border-radius:0 6px 6px 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,transparent);font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);}.pmwb-decision strong{display:block;margin-bottom:3px;color:var(--dsw-alias-label-primary);}
.pmwb-brief-meta{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;}
.pmwb2-brief-panel{display:grid;gap:0;min-width:0;}
.pmwb2-brief-section{position:relative;padding-top:12px;}
.pmwb2-brief-section:first-child{padding-top:0;}
.pmwb2-brief-section-head{display:flex;align-items:center;gap:6px;min-height:22px;margin-bottom:4px;}
.pmwb2-brief-section-title{display:flex;align-items:center;gap:5px;margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:680;line-height:1.3;}
.pmwb2-brief-section-count{padding:0 5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:17px;}
.pmwb2-brief-section-actions{display:flex;align-items:center;gap:3px;margin-left:auto;}
.pmwb2-brief-help-btn{width:21px;height:21px;display:grid;place-items:center;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
.pmwb2-brief-help-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);}.pmwb2-brief-help-btn svg{width:12px;height:12px;}
.pmwb2-brief-help{position:absolute;top:37px;left:0;z-index:8;width:min(310px,calc(100% - 8px));padding:9px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));box-shadow:0 12px 28px rgba(0,0,0,.3);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.55;}
.pmwb2-brief-help strong{display:block;margin-bottom:2px;color:var(--dsw-alias-label-primary);font-size:11px;}
.pmwb2-brief-linkbtn{display:inline-flex;align-items:center;gap:2px;min-height:22px;padding:0 4px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer;white-space:nowrap;}
.pmwb2-brief-linkbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}.pmwb2-brief-linkbtn svg{width:11px;height:11px;}
.pmwb2-brief-list{overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-brief-project-list{display:grid;gap:7px;}
.pmwb2-brief-project{--pmwb2-project-tone:var(--dsw-alias-accent-primary,#4f8ef7);min-width:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-brief-project.state-danger{--pmwb2-project-tone:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb2-brief-project.state-warning{--pmwb2-project-tone:var(--dsw-alias-state-warning-primary,#d29922);}
.pmwb2-brief-project.state-accent{--pmwb2-project-tone:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-brief-project.state-success{--pmwb2-project-tone:var(--dsw-alias-state-success-primary,#3fb950);}
.pmwb2-brief-project-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px 0;}
.pmwb2-brief-project-heading{min-width:0;flex:1 1 auto;}
.pmwb2-brief-project-title{margin:0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:680;line-height:1.4;overflow-wrap:anywhere;}
.pmwb2-brief-project-metrics{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.4;}
.pmwb2-brief-project-metrics span+span::before{content:"";display:inline-block;width:2px;height:2px;margin:0 5px 2px 0;border-radius:50%;background:currentColor;vertical-align:middle;}
.pmwb2-brief-project-actions{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex:none;margin-left:auto;}
.pmwb2-brief-project-state{flex:none;display:inline-flex;align-items:center;gap:5px;height:21px;padding:0 7px;border-radius:5px;background:color-mix(in srgb,var(--pmwb2-project-tone) 14%,transparent);color:var(--pmwb2-project-tone);font-size:9.5px;font-weight:700;white-space:nowrap;}
.pmwb2-brief-project-state.state-danger{--pmwb2-project-tone:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb2-brief-project-state.state-warning{--pmwb2-project-tone:var(--dsw-alias-state-warning-primary,#d29922);}
.pmwb2-brief-project-state.state-accent{--pmwb2-project-tone:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-brief-project-state.state-success{--pmwb2-project-tone:var(--dsw-alias-state-success-primary,#3fb950);}
.pmwb2-brief-project-state::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 12%,transparent);}
.pmwb2-brief-project-summary-wrap{padding:8px 11px 7px;}
.pmwb2-brief-project-summary{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:var(--pmwb2-body-line);overflow-wrap:anywhere;}
.pmwb2-brief-project-summary.full{display:block;overflow:visible;-webkit-line-clamp:unset;}
.pmwb2-brief-project-summary-line{display:block;min-width:0;}
.pmwb2-brief-project-summary-line b{color:var(--dsw-alias-label-primary);font-weight:650;}
.pmwb2-brief-project-drawer-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.45;}
.pmwb2-brief-project-drawer-meta>span+span::before{content:"";display:inline-block;width:2px;height:2px;margin:0 6px 2px 0;border-radius:50%;background:currentColor;vertical-align:middle;}
.pmwb2-brief-project-items{display:grid;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-brief-project-item{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 12px;align-items:center;gap:7px;min-height:38px;padding:6px 8px;border:0;border-top:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer;}
.pmwb2-brief-project-item:first-child{border-top:0;}
.pmwb2-brief-project-item:hover{background:var(--dsw-alias-bg-layer-1);}
.pmwb2-brief-project-item-copy{min-width:0;}
.pmwb2-brief-project-item-title{display:block;min-width:0;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:10.5px;font-weight:620;line-height:1.45;text-overflow:ellipsis;white-space:nowrap;}
.pmwb2-brief-project-item-sub{display:block;min-width:0;margin-top:1px;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.45;text-overflow:ellipsis;white-space:nowrap;}
.pmwb2-brief-project-item-status{display:inline-flex;align-items:center;height:18px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:8.5px;font-weight:650;white-space:nowrap;}
.pmwb2-brief-project-item-status.danger{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 13%,transparent);}
.pmwb2-brief-project-item-status.warning{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 14%,transparent);}
.pmwb2-brief-project-item-status.accent{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);}
.pmwb2-brief-project-item>svg{width:11px;height:11px;color:var(--dsw-alias-label-tertiary);}
.pmwb2-brief-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:9px;min-height:46px;padding:7px 10px;border:0;border-top:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;text-align:left;cursor:pointer;}
.pmwb2-brief-row:first-child{border-top:0;}.pmwb2-brief-row:hover{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 6%,var(--dsw-alias-bg-layer-2));}.pmwb2-brief-row.read{opacity:.62;}
.pmwb2-brief-row-main{min-width:0;}.pmwb2-brief-row-titleline{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap;}
.pmwb2-brief-row-title{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:var(--pmwb2-text-title);font-weight:650;line-height:var(--pmwb2-title-line);}
.pmwb2-brief-row-source{flex:none;padding:0 5px;border-radius:3px;font-size:9px;font-weight:650;line-height:16px;white-space:nowrap;}
.pmwb2-brief-row-source.task{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);}
.pmwb2-brief-row-source.workflow{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 14%,transparent);}
.pmwb2-brief-row-kind{flex:none;padding:0 5px;border-radius:3px;font-size:9px;line-height:16px;font-weight:650;}
.pmwb2-brief-row-kind.anomaly{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb2-brief-row-kind.attention{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
.pmwb2-brief-row-sub{display:block;min-width:0;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:var(--pmwb2-text-body);line-height:1.5;}
.pmwb2-brief-row-trailing{display:flex;flex-direction:column;align-items:flex-end;gap:4px;justify-self:end;white-space:nowrap;}
.pmwb2-brief-row-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
.pmwb2-brief-status{display:inline-flex;align-items:center;height:19px;padding:0 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font-size:9.5px;font-weight:650;}
.pmwb2-brief-status.ok{color:var(--dsw-alias-state-success-primary,#3fb950);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent);}
.pmwb2-brief-status.warn{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}
.pmwb2-brief-status.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}
.pmwb2-brief-empty{padding:14px 10px;border:1px dashed var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:center;}
.pmwb2-brief-read-action{height:24px;padding:1px 7px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;white-space:nowrap;cursor:pointer;}
.pmwb2-brief-read-action:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);}
.pmwb2-brief-detail-action{height:24px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;white-space:nowrap;cursor:pointer;}
.pmwb2-brief-detail-action:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmwb2-brief-detail-row{display:flex;align-items:center;justify-content:flex-end;gap:5px;}
.pmwb-btn.pmwb2-card-action{height:24px;min-height:24px;padding:1px 8px;border-radius:5px;background:var(--dsw-alias-bg-layer-1);font-size:10px;line-height:1.2;}
.pmwb-project-filter{position:relative;flex:none;min-width:0;}
.pmwb-project-filter-trigger{height:25px;max-width:132px;display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;white-space:nowrap;cursor:pointer;}
.pmwb-project-filter-trigger:hover,.pmwb-project-filter-trigger.open{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmwb-project-filter-trigger>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;}
.pmwb-project-filter-trigger svg{width:11px;height:11px;flex:none;transform:rotate(90deg);transition:transform .14s ease;}
.pmwb-project-filter-trigger.open svg{transform:rotate(-90deg);}
.pmwb-project-filter-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:45;width:220px;max-width:calc(100vw - 24px);display:grid;gap:6px;padding:7px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 14px 34px rgba(0,0,0,.3);}
.pmwb-project-filter-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px;}
.pmwb-project-filter-head strong{font-size:10.5px;color:var(--dsw-alias-label-primary);}
.pmwb-project-filter-head button{padding:1px 4px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:9.5px;cursor:pointer;}
.pmwb-project-filter-head button:hover{background:var(--dsw-alias-bg-layer-2);}
.pmwb-project-filter-list{max-height:220px;overflow:auto;display:grid;gap:2px;}
.pmwb-project-filter-option{display:flex;align-items:center;gap:7px;min-width:0;padding:5px 6px;border-radius:5px;color:var(--dsw-alias-label-secondary);font-size:10.5px;cursor:pointer;}
.pmwb-project-filter-option:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmwb-project-filter-option input{width:13px;height:13px;flex:none;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb-project-filter-option span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb2-brief-needs{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 13%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10px;font-weight:650;white-space:nowrap;}
.pmwb2-brief-needs::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;}
.pmwb2-brief-drawer-mask{position:fixed;inset:0;z-index:76;display:flex;justify-content:flex-end;background:rgba(0,0,0,.38);backdrop-filter:blur(2px);}
.pmwb2-brief-drawer{width:min(430px,100vw);height:100%;display:flex;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:-20px 0 54px rgba(0,0,0,.3);animation:pmwb2-brief-drawer-in .18s ease-out;}
@keyframes pmwb2-brief-drawer-in{from{transform:translateX(18px);opacity:.6;}to{transform:translateX(0);opacity:1;}}
.pmwb2-brief-drawer-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);}.pmwb2-brief-drawer-head h2{flex:1;min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;}
.pmwb2-brief-drawer-body{flex:1;min-height:0;display:grid;align-content:start;gap:13px;padding:14px;overflow:auto;}
.pmwb2-brief-drawer-kicker{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:10px;}.pmwb2-brief-drawer-kicker::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-warning-primary,#d29922);}
.pmwb2-brief-drawer-title{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;line-height:1.42;}.pmwb2-brief-drawer-text{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.65;overflow-wrap:anywhere;}
.pmwb2-brief-drawer-block{display:grid;gap:6px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l2);}.pmwb2-brief-drawer-block h3{margin:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:680;}
.pmwb2-brief-facts{display:grid;grid-template-columns:74px minmax(0,1fr);gap:5px 9px;margin:0;font-size:10.5px;}.pmwb2-brief-facts dt{color:var(--dsw-alias-label-tertiary);}.pmwb2-brief-facts dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;}
.pmwb2-brief-evidence{width:100%;display:flex;align-items:center;gap:7px;padding:8px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);text-align:left;font:inherit;font-size:10.5px;cursor:pointer;}
.pmwb2-brief-evidence:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));color:var(--dsw-alias-label-primary);}.pmwb2-brief-evidence span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.pmwb2-brief-evidence svg{width:13px;height:13px;color:var(--dsw-alias-label-tertiary);}
.pmwb2-brief-recommend{padding:9px 10px;border-left:2px solid var(--dsw-alias-accent-primary,#4f8ef7);border-radius:0 6px 6px 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6;}.pmwb2-brief-recommend strong{display:block;margin-bottom:2px;color:var(--dsw-alias-label-primary);}
.pmwb2-brief-drawer-foot{display:flex;justify-content:flex-end;gap:7px;padding:10px 14px 12px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb2-brief-task{display:grid;gap:0;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;}
.pmwb2-brief-task-toggle{width:100%;display:grid;grid-template-columns:14px minmax(0,1fr) auto;align-items:center;gap:7px;padding:8px 9px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);text-align:left;font:inherit;font-size:10.5px;cursor:pointer;}
.pmwb2-brief-task-toggle:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);}
.pmwb2-brief-task-toggle svg{width:12px;height:12px;transition:transform .14s ease;}
.pmwb2-brief-task.open .pmwb2-brief-task-toggle svg{transform:rotate(90deg);}
.pmwb2-brief-task-toggle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb2-brief-task-toggle small{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmwb2-brief-task-body{display:grid;gap:9px;padding:9px 10px 11px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb2-brief-task-title{margin:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.5;}
.pmwb2-brief-task-description{margin:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;}
.pmwb2-brief-task-grid{display:grid;grid-template-columns:52px minmax(0,1fr);gap:4px 8px;margin:0;font-size:10.5px;}
.pmwb2-brief-task-grid dt{color:var(--dsw-alias-label-tertiary);}
.pmwb2-brief-task-grid dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;}
.pmwb2-brief-task-summary{padding:8px 9px;border-left:2px solid var(--dsw-alias-accent-primary,#4f8ef7);border-radius:0 5px 5px 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,transparent);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.6;}
.pmwb2-brief-task-summary strong{display:block;margin-bottom:3px;color:var(--dsw-alias-label-primary);font-size:10px;}
.pmwb2-brief-task-state{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.5;}
.pmwb2-brief-task-state.error{display:flex;align-items:center;gap:7px;color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb2-brief-task-state.error span{flex:1;min-width:0;overflow-wrap:anywhere;}
@media(max-width:520px){.pmwb2-brief-project-head{flex-wrap:wrap;padding:9px 9px 0;}.pmwb2-brief-project-heading{flex-basis:100%;}.pmwb2-brief-project-actions{width:100%;justify-content:flex-end;margin-left:0;}.pmwb2-brief-project-title{font-size:12.5px;}.pmwb2-brief-project-state{height:20px;padding:0 6px;}.pmwb2-brief-project-summary-wrap{padding:7px 9px 6px;}.pmwb2-brief-project-item{grid-template-columns:minmax(0,1fr) auto 10px;padding:6px 7px;}.pmwb2-brief-row{grid-template-columns:minmax(0,1fr);padding:8px 9px;}.pmwb2-brief-row-trailing{grid-column:1;grid-row:2;align-items:flex-start;justify-self:start;margin-top:3px;}.pmwb2-brief-row-meta{justify-content:flex-start;}.pmwb2-brief-row-sub{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}.pmwb2-brief-drawer{width:100%;}}
`;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY) ?? "";
    }

    async function request(path, options = {}) {
      const headers = { "cache-control": "no-store" };
      const value = token();
      if (value !== "") headers.authorization = `Bearer ${value}`;
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      }
      return payload;
    }

    const followStore = {
      snapshot: { items: new Set(), version: 0 },
      listeners: new Set(),
      loading: undefined,
      subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
      getSnapshot() {
        return this.snapshot;
      },
      commit(items) {
        this.snapshot = { items, version: this.snapshot.version + 1 };
        for (const listener of this.listeners) listener();
        window.dispatchEvent(new CustomEvent("pluginmax:follow-change"));
      },
      ensure() {
        if (this.loading !== undefined) return this.loading;
        this.loading = request("/api/collab/workbench/follows")
          .then((result) => {
            this.commit(
              new Set(
                (result.follows ?? []).map(
                  (item) => `${item.type}:${item.targetId}`,
                ),
              ),
            );
          })
          .finally(() => {
            this.loading = undefined;
          });
        return this.loading;
      },
      async toggle(type, id) {
        const result = await request("/api/collab/workbench/follows/toggle", {
          method: "POST",
          body: JSON.stringify({ type, targetId: id }),
        });
        const items = new Set(this.snapshot.items);
        if (result.followed) items.add(`${type}:${id}`);
        else items.delete(`${type}:${id}`);
        this.commit(items);
        return result.followed;
      },
      isFollowed(type, id) {
        return this.snapshot.items.has(`${type}:${id}`);
      },
    };

    function tagClass(value) {
      const text = String(value ?? "");
      if (/高|阻塞|风险|逾期/.test(text)) return "high";
      if (/等待|待|中/.test(text)) return "warn";
      if (/完成|正常|成功/.test(text)) return "ok";
      return "";
    }

    function formatTime(value) {
      const parts = dateTimeParts(value);
      return parts === null ? "—" : `${parts.date} ${parts.time}`;
    }

    function dateTimeParts(value) {
      if (typeof value !== "string" || value === "") return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      const pad = (number) => String(number).padStart(2, "0");
      return {
        date: `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
      };
    }

    function formatDate(value) {
      if (typeof value !== "string" || value.trim() === "") return "—";
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      return match ? `${match[2]}-${match[3]}` : formatTime(value);
    }

    function readStates() {
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

    const readStateStore = {
      snapshot: readStates(),
      listeners: new Set(),
      getSnapshot() {
        return this.snapshot;
      },
      subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
      commit(next) {
        this.snapshot = next;
        try {
          window.localStorage.setItem(
            READ_STATE_KEY,
            JSON.stringify(this.snapshot),
          );
        } catch {
          // Keep the shared in-memory state when storage is unavailable.
        }
        for (const listener of this.listeners) listener();
      },
    };
    function readTodoScope() {
      try {
        return window.localStorage.getItem(TODO_SCOPE_KEY) === "me_and_ai"
          ? "me_and_ai"
          : "me";
      } catch {
        return "me";
      }
    }

    function readCurrentUserId() {
      try {
        return window.localStorage.getItem("pluginmax.collab.userId") ?? "";
      } catch {
        return "";
      }
    }

    function saveTodoScope(scope) {
      try {
        window.localStorage.setItem(TODO_SCOPE_KEY, scope);
      } catch {
        // The active in-memory scope remains usable when storage is unavailable.
      }
    }

    function itemSignature(item) {
      return `${item?.kind ?? "item"}:${item?.id ?? ""}:${item?.updatedAt ?? ""}`;
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

    function initialsOf(name) {
      return String(name ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }

    function OwnerAvatar({ name = "", kind }) {
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

    function navigateTo(link) {
      if (link?.route === "task") {
        window.__pluginmaxPendingTask = {
          taskId: link.refId,
          workspaceId: link.workspaceId ?? "",
        };
        window.__pluginmaxShell?.setRoute("task");
        return;
      }
      if (link?.route === "workflow") {
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
      if (link?.route === "meeting") {
        const tab = link.tab === "minutes" ? "minutes" : undefined;
        window.__pluginmaxPendingMeeting = {
          meetingId: link.refId,
          workspaceId: link.workspaceId ?? "",
          ...(tab === undefined ? {} : { tab }),
        };
        window.__pluginmaxShell?.setRoute("meetings");
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
      }
    }

    function statusPill(value, label) {
      return h("span", { className: statusPillClass(value) }, label ?? value);
    }

    function FollowButton(props) {
      const snapshot = react.useSyncExternalStore(
        followStore.subscribe.bind(followStore),
        followStore.getSnapshot.bind(followStore),
        followStore.getSnapshot.bind(followStore),
      );
      react.useEffect(() => {
        void followStore.ensure();
      }, []);
      const direct = snapshot.items.has(`${props.type}:${props.id}`);
      const coveringRef = (props.coveredBy ?? []).find((ref) =>
        snapshot.items.has(`${ref.type}:${ref.id}`),
      );
      const followed = direct || coveringRef !== undefined;
      const coveredOnly = followed && !direct;
      const coveringLabel =
        coveringRef?.type === "project"
          ? "项目"
          : coveringRef?.type === "workflow"
            ? "工作流"
            : "";
      const subjectLabel = props.subjectLabel ?? "";
      const [busy, setBusy] = react.useState(false);
      const title = coveredOnly
        ? coveringRef === undefined
          ? "已关注：由工作流或项目覆盖"
          : `取消关注${coveringLabel}（该条目由它覆盖）`
        : followed
          ? `取消关注${subjectLabel}`
          : `关注${subjectLabel}`;
      return h(
        "button",
        {
          type: "button",
          className: "pmwb-follow-btn",
          disabled: busy || (coveredOnly && coveringRef === undefined),
          "aria-pressed": followed,
          title,
          "aria-label": title,
          onClick: async (event) => {
            event.stopPropagation();
            if (busy) return;
            setBusy(true);
            try {
              if (coveredOnly && coveringRef !== undefined) {
                await followStore.toggle(coveringRef.type, coveringRef.id);
              } else {
                await followStore.toggle(props.type, props.id);
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
        h(
          "svg",
          {
            viewBox: "0 0 24 24",
            width: 13,
            height: 13,
            fill: followed ? "currentColor" : "none",
            stroke: "currentColor",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
          },
          h("path", {
            d: "m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.1 6.4 20l1.2-6.2L3 9.5l6.3-.8L12 3Z",
          }),
        ),
      );
    }

    function isFollowed(type, id) {
      return followStore.isFollowed(type, id);
    }

    function focusItemFollowed(item) {
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

    function briefDataAgentSelection(item) {
      const workspaceId = item?.deepLink?.workspaceId ?? item?.workspaceId;
      const detail = [
        item?.statusLabel ? `状态：${item.statusLabel}` : "",
        item?.conclusion ? `内容：${item.conclusion}` : "",
        item?.reason ? `入选原因：${item.reason}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        kind: "component",
        title: item?.title ?? "每日简报",
        excerpt: detail.slice(0, 4_000),
        source: {
          workspaceId,
          page: "workbench",
          ...(item?.deepLink?.route === undefined ||
          item?.deepLink?.refId === undefined
            ? {}
            : {
                entityRef: `${item.deepLink.route}:${item.deepLink.refId}`,
              }),
        },
        snapshot: {
          text: detail.slice(0, 8_000),
          values: {
            briefItemId: item?.itemId,
            statusLabel: item?.statusLabel,
            reason: item?.reason,
            sourceId: item?.sourceId,
          },
        },
      };
    }

    function openBriefItemInDataAgent(item) {
      window.__pluginmaxSidePanel?.openTab("data-agent");
      window.dispatchEvent(
        new CustomEvent("pluginmax:data-agent-selection", {
          detail: {
            selection: briefDataAgentSelection(item),
            prompt: item?.actionLabel ?? "分析原因",
          },
        }),
      );
    }

    function openDataAgentConversation(session) {
      if (typeof session?.id !== "string" || session.id === "") return;
      const pending = {
        conversationId: session.id,
        workspaceId: session.workspaceId ?? "",
      };
      window.__pluginmaxPendingDataAgentConversation = pending;
      window.__pluginmaxSidePanel?.openTab("data-agent");
      window.dispatchEvent(
        new CustomEvent("pluginmax:data-agent-open-conversation", {
          detail: pending,
        }),
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
      return h(
        "div",
        { className: "pmwb-meeting-line" },
        h("span", { className: "pmwb-participants-label" }, "参会："),
        meetingParticipantGroup(item),
      );
    }

    function renderOwnerRow(item, ctx, variant) {
      const isFocus = variant === "focus";
      const moduleId = isFocus ? "focus" : "todo";
      const read = ctx.isRead(moduleId, item);
      const openItem = () => {
        ctx.markRead(moduleId, item);
        window.setTimeout(() => navigateTo(item.deepLink), 0);
      };
      const coverage =
        isFocus && Array.isArray(item.coveredBy)
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
        ? statusPill(item.priority, item.priorityLabel ?? item.priority)
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
      const receiverLabel =
        item.receiverOwnerName === undefined
          ? item.receiverName
          : `${item.receiverName}（${item.receiverOwnerName}）`;
      const description =
        typeof item.description === "string" ? item.description.trim() : "";
      if (!isFocus) {
        return h(
          "article",
          {
            key: item.id,
            className: `pmwb-item pmwb-item-todo${
              description === "" ? " no-description" : ""
            }${read ? " read" : ""}`,
            ...dataAgentEntityAttributes(item),
          },
          h("div", { className: "pmwb-todo-name" }, item.title),
          h(
            "div",
            { className: "pmwb-todo-actions" },
            h(
              "div",
              { className: "pmwb-todo-actions-main" },
              h(FollowButton, {
                type: item.kind ?? "task",
                id: item.id,
                compact: true,
                coveredBy: item.coveredBy,
              }),
              h(
                "button",
                {
                  type: "button",
                  className: "pmwb-btn pmwb2-card-action",
                  onClick: openItem,
                },
                "详情",
              ),
            ),
            ctx.showUnreadAction === true && read
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb-btn pmwb-read-action pmwb2-card-action",
                    onClick: (event) => {
                      event.stopPropagation();
                      ctx.markUnread(moduleId, item);
                    },
                  },
                  "标为未读",
                )
              : null,
          ),
          item.workspaceName
            ? h("div", { className: "pmwb-todo-project" }, item.workspaceName)
            : null,
          description === ""
            ? null
            : h("div", { className: "pmwb-todo-description" }, description),
          h(
            "div",
            { className: "pmwb-todo-meta" },
            priorityPill,
            h("span", null, receiverLabel),
            h(
              "span",
              { className: "pmwb-todo-due" },
              item.due ? formatDate(item.due) : "不限",
            ),
          ),
        );
      }
      return h(
        "article",
        {
          key: item.id,
          className: `pmwb-item${isFocus ? " pmwb-item-focus" : ""}${read ? " read" : ""}`,
          ...dataAgentEntityAttributes(item),
        },
        h("div", { className: "pmwb-item-id" }, item.displayId ?? item.id),
        h("div", { className: "pmwb-item-name" }, item.title),
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
        h(
          "div",
          { className: "pmwb-item-trailing" },
          ctx.showUnreadAction === true && read
            ? h(
                "button",
                {
                  type: "button",
                  className: "pmwb-btn pmwb-read-action pmwb2-card-action",
                  onClick: (event) => {
                    event.stopPropagation();
                    ctx.markUnread(moduleId, item);
                  },
                },
                "标为未读",
              )
            : null,
          h(
            "button",
            {
              type: "button",
              className: "pmwb-btn pmwb2-card-action",
              onClick: (event) => {
                event.stopPropagation();
                openItem();
              },
            },
            "详情",
          ),
          h(FollowButton, {
            type: item.kind ?? "task",
            id: item.id,
            compact: true,
            coveredBy: item.coveredBy,
          }),
        ),
        item.due
          ? h("span", { className: "pmwb-item-time" }, formatDate(item.due))
          : null,
      );
    }

    function renderMeetingRows(items, ctx) {
      return items.map((item) => {
        const read = ctx.isRead("meeting-minutes", item);
        const openItem = () => {
          ctx.markRead("meeting-minutes", item);
          window.setTimeout(
            () => navigateTo({ ...item.deepLink, tab: "minutes" }),
            0,
          );
        };
        return h(
          "article",
          {
            key: item.id,
            className: `pmwb-item meeting${read ? " read" : ""}`,
            ...dataAgentEntityAttributes({ ...item, kind: "meeting" }),
          },
          h(
            "div",
            { className: "pmwb-meeting-title" },
            h("span", { className: "pmwb-item-name" }, item.title),
          ),
          h(
            "div",
            { className: "pmwb-meeting-context" },
            item.workspaceName
              ? h(
                  "span",
                  { className: "pmwb-meeting-project" },
                  item.workspaceName,
                )
              : h("span"),
            h(
              "span",
              { className: "pmwb-meeting-time" },
              formatTime(item.updatedAt),
            ),
          ),
          h(
            "div",
            { className: "pmwb-item-meta pmwb-meeting-status" },
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
            {
              className: "pmwb-item-trailing pmwb-meeting-actions",
            },
            ctx.showUnreadAction === true && read
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb-btn pmwb-read-action pmwb2-card-action",
                    onClick: (event) => {
                      event.stopPropagation();
                      ctx.markUnread("meeting-minutes", item);
                    },
                  },
                  "标为未读",
                )
              : null,
            h(FollowButton, { type: "meeting", id: item.id, compact: true }),
            h(
              "button",
              {
                type: "button",
                className: "pmwb-btn pmwb2-card-action",
                onClick: (event) => {
                  event.stopPropagation();
                  openItem();
                },
              },
              "详情",
            ),
          ),
          h("div", { className: "pmwb-item-owner" }, meetingParticipants(item)),
        );
      });
    }

    function GenericList({ items }) {
      if (!Array.isArray(items) || items.length === 0) {
        return h("div", { className: "pmwb2-empty" }, "暂无可展示事项");
      }
      return h(
        "div",
        { className: "pmwb2-list" },
        ...items.slice(0, 8).map((item, index) =>
          h(
            "div",
            { className: "pmwb2-row", key: item.id ?? index },
            h(
              "strong",
              null,
              item.title ??
                item.name ??
                item.summary ??
                item.displayId ??
                "未命名事项",
            ),
            h(
              "span",
              {
                className: `pmwb2-tag ${tagClass(item.statusLabel ?? item.status ?? item.level)}`,
              },
              item.statusLabel ??
                item.status ??
                item.level ??
                item.priorityLabel ??
                "查看",
            ),
            h(
              "small",
              null,
              item.source ?? item.category ?? item.ownerName ?? item.role ?? "",
            ),
            (item.note ??
              item.description ??
              item.summaryText ??
              item.conclusion)
              ? h(
                  "span",
                  { className: "pmwb2-row-note" },
                  item.note ??
                    item.description ??
                    item.summaryText ??
                    item.conclusion,
                )
              : null,
          ),
        ),
      );
    }

    function LegacyMetricsBody({ payload }) {
      const panelRef = react.useRef(null);
      const data = payload.data ?? {};
      const selected = new Set(data.selected ?? []);
      const items = (data.items ?? []).filter((metric) =>
        selected.has(metric.id),
      );
      react.useEffect(() => {
        const node = panelRef.current;
        if (node === null || typeof ResizeObserver !== "function") {
          return undefined;
        }
        let frame = 0;
        const resize = () => {
          window.cancelAnimationFrame(frame);
          frame = window.requestAnimationFrame(() => {
            const rect = node.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const grid = node.querySelector(".pmwb2-kpi-grid");
            const columns = Math.max(
              1,
              grid === null
                ? 1
                : getComputedStyle(grid)
                    .gridTemplateColumns.split(" ")
                    .filter(Boolean).length,
            );
            const gap =
              grid === null
                ? 8
                : Number.parseFloat(getComputedStyle(grid).columnGap) || 8;
            const cardWidth =
              (rect.width - gap * Math.max(0, columns - 1)) / columns;
            const widthScale = cardWidth / 240;
            // 高度会随列数变化，不能参与字号计算，否则侧边栏挤压宽度后会
            // 触发「变窄 -> 单列 -> 变高 -> 字号放大」的反馈循环。
            const scale = Math.max(0.68, Math.min(1, widthScale));
            node.style.setProperty(
              "--pmwb2-kpi-padding",
              `${Math.round(9 * scale)}px`,
            );
            node.style.setProperty(
              "--pmwb2-kpi-gap",
              `${Math.round(5 * scale)}px`,
            );
            node.style.setProperty(
              "--pmwb2-kpi-label-size",
              `${(12 * scale).toFixed(1)}px`,
            );
            node.style.setProperty(
              "--pmwb2-kpi-value-size",
              `${(26 * scale).toFixed(1)}px`,
            );
            node.style.setProperty(
              "--pmwb2-kpi-target-size",
              `${(10.5 * scale).toFixed(1)}px`,
            );
            node.style.setProperty(
              "--pmwb2-kpi-spark-height",
              `${Math.round(30 * scale)}px`,
            );
            node.style.setProperty(
              "--pmwb2-kpi-card-min-height",
              `${Math.round(150 * scale)}px`,
            );
          });
        };
        const observer = new ResizeObserver(resize);
        const owner = node.closest('[data-plugin-id="pluginmax.kpi-overview"]');
        const mutationObserver =
          owner === null ? null : new MutationObserver(resize);
        observer.observe(node);
        mutationObserver?.observe(owner, {
          attributes: true,
          attributeFilter: ["class", "style"],
        });
        resize();
        const timer = window.setTimeout(resize, 120);
        return () => {
          window.cancelAnimationFrame(frame);
          window.clearTimeout(timer);
          observer.disconnect();
          mutationObserver?.disconnect();
        };
      }, [items.length]);
      if (items.length === 0) {
        return h(
          "div",
          { className: "pmwb-empty" },
          "未选择核心指标，点击右上角设置选择 1-5 项。",
        );
      }
      return h(
        "div",
        {
          className: "pmwb2-kpi-panel no-source",
          ref: panelRef,
        },
        h(
          "div",
          { className: "pmwb-metrics pmwb2-kpi-grid" },
          ...items.map((metric) => {
            const spark = metric.spark ?? [];
            return h(
              "article",
              {
                className: `pmwb-metric pmwb2-kpi-card${spark.length === 0 ? " no-spark" : ""}`,
                key: metric.id,
                "data-metric-id": metric.id,
                "data-data-agent-title": `${metric.label} ${metric.value}${metric.unit ?? ""}`,
                "data-data-agent-excerpt":
                  `${metric.target ?? ""} ${metric.trend ?? ""}`.trim(),
              },
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
              spark.length > 0
                ? h(
                    "div",
                    { className: "pmwb-spark", "aria-hidden": "true" },
                    ...spark.map((height, index) =>
                      h("span", {
                        key: `${metric.id}-${index}`,
                        className:
                          height >= 62 ? "strong" : height <= 36 ? "warn" : "",
                        style: { height: `${height}%` },
                      }),
                    ),
                  )
                : null,
            );
          }),
        ),
      );
    }

    function LegacyControlBody({ payload }) {
      const data = payload.data ?? {};
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
                              navigateTo({
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

    function LegacySupplierBody({ payload }) {
      const data = payload.data ?? {};
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

    function briefInlineNodes(text, keyBase) {
      const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
      const nodes = [];
      let cursor = 0;
      let index = 0;
      let match = pattern.exec(text);
      while (match !== null) {
        if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
        nodes.push(
          match[2] !== undefined
            ? h("strong", { key: `${keyBase}-b-${index}` }, match[2])
            : h("code", { key: `${keyBase}-c-${index}` }, match[3]),
        );
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

    /** 业务标签描述“这条简报是什么类型”，不是来源对象当前的处理状态。 */
    function briefTagLabel(tag) {
      return (
        {
          progress: "进展",
          data: "数据异常",
          conclusion: "结论",
          decision: "待决策",
          review: "待我验收",
          nudge: "被催办",
        }[tag] ?? "动态"
      );
    }

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

    function briefKindOf(item) {
      if (item?.section === "risk") return "anomaly";
      if (item?.section === "escalation") return "attention";
      return "progress";
    }

    function groupBriefItems(items) {
      const groups = { progress: [], anomaly: [], attention: [] };
      for (const item of items ?? []) groups[briefKindOf(item)].push(item);
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

    function briefSourceLabel(item) {
      if (item?.sourceDomain === "workflow") return "工作流";
      if (item?.sourceDomain === "agent-run") return "执行记录";
      return "任务";
    }

    const PROJECT_NAME_MAX_CHARS = 8;

    function briefProjectNames(items) {
      return [
        ...new Set(
          (items ?? [])
            .map((item) => String(item?.workspaceName ?? "").trim())
            .filter(Boolean),
        ),
      ];
    }

    function truncateProjectName(value) {
      const characters = Array.from(String(value ?? "").trim());
      return characters.length > PROJECT_NAME_MAX_CHARS
        ? `${characters.slice(0, PROJECT_NAME_MAX_CHARS).join("")}…`
        : characters.join("");
    }

    const BRIEF_PROJECT_STATE_FALLBACK = {
      blocked: {
        key: "blocked",
        label: "推进受阻",
        tone: "danger",
        priority: 5,
        reason: "项目关键流程已阻塞或执行已中断，需要立即介入。",
      },
      needs_action: {
        key: "needs_action",
        label: "需优先处置",
        tone: "danger",
        priority: 4,
        reason: "项目存在尚未解除的业务异常或推进风险。",
      },
      needs_decision: {
        key: "needs_decision",
        label: "等待决策",
        tone: "warning",
        priority: 3,
        reason: "项目存在需要人工决定或协调后才能继续的事项。",
      },
      needs_review: {
        key: "needs_review",
        label: "等待确认",
        tone: "accent",
        priority: 2,
        reason: "项目结果已经形成，正在等待复核、确认或验收。",
      },
      advancing: {
        key: "advancing",
        label: "正常推进",
        tone: "accent",
        priority: 1,
        reason: "项目有有效进展，且没有阻塞或待决策事项。",
      },
      settled: {
        key: "settled",
        label: "已收敛",
        tone: "success",
        priority: 0,
        reason: "当前没有需要继续关注的项目信号。",
      },
    };

    function briefProjectKey(item) {
      return String(item?.workspaceId || item?.workspaceName || "unassigned");
    }

    function briefProjectFallbackState(items) {
      const active = (items ?? []).filter((item) => item?.resolved !== true);
      if (
        active.some(
          (item) =>
            item?.section === "risk" &&
            (item?.condition?.kind === "workflow-blocked" ||
              /阻塞|中断|失败|越权|预算耗尽/u.test(
                `${item?.statusLabel ?? ""} ${item?.title ?? ""}`,
              )),
        )
      ) {
        return BRIEF_PROJECT_STATE_FALLBACK.blocked;
      }
      if (active.some((item) => item?.section === "risk")) {
        return BRIEF_PROJECT_STATE_FALLBACK.needs_action;
      }
      if (active.some((item) => item?.section === "escalation")) {
        return BRIEF_PROJECT_STATE_FALLBACK.needs_decision;
      }
      if (
        active.some(
          (item) =>
            item?.tag === "review" ||
            /待复核|待确认|待验收|待处理|待评估/u.test(item?.statusLabel ?? ""),
        )
      ) {
        return BRIEF_PROJECT_STATE_FALLBACK.needs_review;
      }
      return active.length > 0
        ? BRIEF_PROJECT_STATE_FALLBACK.advancing
        : BRIEF_PROJECT_STATE_FALLBACK.settled;
    }

    function briefProjectFallbackLines(items) {
      const active = (items ?? []).filter((item) => item?.resolved !== true);
      const progress = active.filter((item) => item?.section === "conclusion");
      const risks = active.filter((item) => item?.section === "risk");
      const escalations = active.filter(
        (item) => item?.section === "escalation",
      );
      const state = briefProjectFallbackState(active);
      const progressText =
        progress.length === 0
          ? "本期暂无已确认结果。"
          : `${progress
              .slice(0, 2)
              .map((item) => briefPlainText(item.title))
              .join("、")}${
              progress.length > 2 ? `等 ${progress.length} 项` : ""
            }已形成阶段性结果。`;
      const attentionCounts = [
        risks.length > 0 ? `${risks.length} 项异常` : "",
        escalations.length > 0 ? `${escalations.length} 项待处理` : "",
      ].filter(Boolean);
      const lead = risks[0] ?? escalations[0];
      const attentionText =
        lead === undefined
          ? "当前没有新增异常或待决策事项。"
          : `${attentionCounts.join("、")}，优先关注「${briefPlainText(
              lead.title,
            )}」。`;
      const nextText =
        state.key === "blocked" || state.key === "needs_action"
          ? `先${risks[0]?.actionLabel || "处置"}「${briefPlainText(
              risks[0]?.title ?? lead?.title ?? "",
            )}」。`
          : state.key === "needs_decision"
            ? `先确认「${briefPlainText(
                escalations[0]?.title ?? lead?.title ?? "",
              )}」。`
            : state.key === "needs_review"
              ? "完成复核或验收后再关闭当前事项。"
              : state.key === "advancing"
                ? "当前无新增风险，按既定计划继续推进。"
                : "当前进展已收敛，无需额外操作。";
      return [
        { kind: "progress", label: "关键进展", text: progressText },
        { kind: "attention", label: "需要关注", text: attentionText },
        { kind: "next", label: "建议", text: nextText },
      ];
    }

    function briefProjectCards(progressItems, allItems, digests) {
      const digestByKey = new Map();
      for (const digest of digests ?? []) {
        if (digest?.workspaceId) digestByKey.set(digest.workspaceId, digest);
        if (digest?.workspaceName) {
          digestByKey.set(digest.workspaceName, digest);
        }
      }
      const itemsByProject = new Map();
      for (const item of allItems ?? []) {
        const key = briefProjectKey(item);
        const current = itemsByProject.get(key) ?? [];
        current.push(item);
        itemsByProject.set(key, current);
      }
      const progressByProject = new Map();
      for (const item of progressItems ?? []) {
        const key = briefProjectKey(item);
        const current = progressByProject.get(key) ?? [];
        current.push(item);
        progressByProject.set(key, current);
      }
      return [...progressByProject.entries()]
        .map(([key, projectProgress]) => {
          const projectItems = itemsByProject.get(key) ?? projectProgress;
          const digest =
            digestByKey.get(key) ??
            digestByKey.get(String(projectItems[0]?.workspaceId ?? "")) ??
            digestByKey.get(String(projectItems[0]?.workspaceName ?? ""));
          return {
            key,
            workspaceId:
              digest?.workspaceId ?? projectItems[0]?.workspaceId ?? key,
            name:
              digest?.workspaceName ||
              projectItems.find(
                (item) => String(item?.workspaceName ?? "").trim() !== "",
              )?.workspaceName ||
              "未归属项目",
            state: digest?.state ?? briefProjectFallbackState(projectItems),
            lines: digest?.lines ?? briefProjectFallbackLines(projectItems),
            items: projectItems,
            progress: projectItems.filter(
              (item) => item?.section === "conclusion",
            ),
            attention: projectItems.filter(
              (item) =>
                item?.section === "risk" || item?.section === "escalation",
            ),
          };
        })
        .sort(
          (left, right) =>
            right.state.priority - left.state.priority ||
            left.name.localeCompare(right.name, "zh-CN"),
        );
    }

    function briefProjectItemTone(item) {
      if (item?.section === "risk") return "danger";
      if (item?.section === "escalation") return "warning";
      if (/待复核|待确认|待验收|待处理|待评估/u.test(item?.statusLabel ?? "")) {
        return "accent";
      }
      return "";
    }

    /** 来源标签只区分需要强调的异常归属：任务或工作流。 */
    function briefSourceTag(item) {
      if (item?.sourceDomain === "task" || item?.deepLink?.route === "task") {
        return { label: "任务", kind: "task" };
      }
      if (
        item?.sourceDomain === "workflow" ||
        item?.deepLink?.route === "workflow"
      ) {
        return { label: "工作流", kind: "workflow" };
      }
      return null;
    }

    function briefFollowTarget(item) {
      const route = item?.deepLink?.route;
      if (item?.sourceDomain === "task" || route === "task") {
        return { type: "brief", id: item.itemId };
      }
      if (item?.sourceDomain === "workflow" || route === "workflow") {
        return { type: "brief", id: item.itemId };
      }
      return null;
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

    /** 状态总结只回答“现在到哪了、最近发生了什么、是否还需动作”。 */
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
      return sentences.filter((sentence) => sentence !== "。").slice(0, 3);
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
        { className: `pmwb2-brief-task${open ? " open" : ""}` },
        h(
          "button",
          {
            type: "button",
            className: "pmwb2-brief-task-toggle",
            "aria-expanded": open,
            "aria-controls": `pmwb2-brief-task-${taskId}`,
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
                id: `pmwb2-brief-task-${taskId}`,
                className: "pmwb2-brief-task-body",
              },
              loading
                ? h(
                    "div",
                    {
                      className: "pmwb2-brief-task-state",
                      role: "status",
                    },
                    "正在读取任务信息…",
                  )
                : error !== ""
                  ? h(
                      "div",
                      {
                        className: "pmwb2-brief-task-state error",
                        role: "alert",
                      },
                      h("span", null, `任务信息加载失败：${error}`),
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pmwb2-brief-linkbtn",
                          onClick: () => void load(),
                        },
                        "重试",
                      ),
                    )
                  : task !== null
                    ? [
                        h(
                          "h4",
                          { className: "pmwb2-brief-task-title" },
                          task.title,
                        ),
                        task.description
                          ? h(
                              "p",
                              { className: "pmwb2-brief-task-description" },
                              task.description,
                            )
                          : null,
                        h(
                          "dl",
                          { className: "pmwb2-brief-task-grid" },
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
                          { className: "pmwb2-brief-task-summary" },
                          h("strong", null, "当前状态"),
                          taskStateSummary(task).join(" "),
                        ),
                      ]
                    : h(
                        "div",
                        { className: "pmwb2-brief-task-state" },
                        "任务信息暂不可用。",
                      ),
            )
          : null,
      );
    }

    function BriefProjectDetailRow({ item, onDetail }) {
      const tone = briefProjectItemTone(item);
      return h(
        "button",
        {
          type: "button",
          className: "pmwb2-brief-project-item",
          "aria-label": `查看 ${item.title} 详情`,
          onClick: (event) => {
            event.stopPropagation();
            onDetail(item);
          },
        },
        h(
          "span",
          { className: "pmwb2-brief-project-item-copy" },
          h(
            "strong",
            { className: "pmwb2-brief-project-item-title" },
            item.title,
          ),
          h(
            "span",
            { className: "pmwb2-brief-project-item-sub" },
            briefPlainText(item.conclusion || item.reason || item.statusLabel),
          ),
        ),
        item.statusLabel
          ? h(
              "span",
              {
                className: `pmwb2-brief-project-item-status${tone ? ` ${tone}` : ""}`,
                title: `当前状态：${item.statusLabel}`,
              },
              item.statusLabel,
            )
          : null,
        ICONS.chevron,
      );
    }

    function BriefProjectCard({ project, onDetail }) {
      const state = project.state ?? BRIEF_PROJECT_STATE_FALLBACK.settled;
      const metrics = [
        `${project.progress.length} 项进展`,
        project.attention.length > 0
          ? `${project.attention.length} 项关注`
          : "",
      ].filter(Boolean);
      return h(
        "article",
        {
          className: `pmwb2-brief-project state-${state.tone}`,
          "data-workspace-id": project.workspaceId,
          "data-data-agent-exclude": "true",
        },
        h(
          "header",
          { className: "pmwb2-brief-project-head" },
          h(
            "div",
            { className: "pmwb2-brief-project-heading" },
            h("h4", { className: "pmwb2-brief-project-title" }, project.name),
            h(
              "div",
              { className: "pmwb2-brief-project-metrics" },
              ...metrics.map((metric) => h("span", { key: metric }, metric)),
            ),
          ),
          h(
            "div",
            { className: "pmwb2-brief-project-actions" },
            h(
              "span",
              {
                className: "pmwb2-brief-project-state",
                title: state.reason,
              },
              state.label,
            ),
            h(FollowButton, {
              type: "project",
              id: project.workspaceId,
              subjectLabel: "项目",
              compact: true,
            }),
            h(
              "button",
              {
                type: "button",
                className: "pmwb-btn pmwb2-card-action",
                "aria-label": `查看 ${project.name} 项目详情`,
                onClick: () => onDetail(project),
              },
              "详情",
            ),
          ),
        ),
        h(
          "div",
          { className: "pmwb2-brief-project-summary-wrap" },
          h(
            "div",
            {
              id: `pmwb2-brief-project-summary-${project.key}`,
              className: "pmwb2-brief-project-summary",
            },
            ...project.lines.map((line, index) =>
              h(
                "span",
                {
                  key: `${line.kind}-${index}`,
                  className: `pmwb2-brief-project-summary-line ${line.kind}`,
                },
                h("b", null, `${line.label}：`),
                line.text,
              ),
            ),
          ),
        ),
      );
    }

    function BriefProjectDrawer({ project, onClose, onItemDetail }) {
      const state = project.state ?? BRIEF_PROJECT_STATE_FALLBACK.settled;
      return h(
        "div",
        {
          className: "pmwb2-brief-drawer-mask",
          role: "presentation",
          onClick: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          "aside",
          {
            className: "pmwb2-brief-drawer",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": `${project.name}项目详情`,
          },
          h(
            "header",
            { className: "pmwb2-brief-drawer-head" },
            h("h2", null, "项目详情"),
            h(
              "button",
              {
                type: "button",
                className: "pmwb2-iconbtn",
                "aria-label": "关闭项目详情",
                title: "关闭",
                onClick: onClose,
              },
              ICONS.close,
            ),
          ),
          h(
            "div",
            { className: "pmwb2-brief-drawer-body" },
            h(
              "div",
              null,
              h(
                "div",
                { className: "pmwb2-brief-drawer-kicker" },
                "每日简报 · 项目概览",
              ),
              h("h3", { className: "pmwb2-brief-drawer-title" }, project.name),
              h(
                "div",
                { className: "pmwb2-brief-project-drawer-meta" },
                h(
                  "span",
                  {
                    className: `pmwb2-brief-project-state state-${state.tone}`,
                    title: state.reason,
                  },
                  state.label,
                ),
                h("span", null, `${project.progress.length} 项进展`),
                h("span", null, `${project.attention.length} 项关注`),
              ),
            ),
            h(
              "section",
              { className: "pmwb2-brief-drawer-block" },
              h("h3", null, "项目概览"),
              h(
                "div",
                { className: "pmwb2-brief-project-summary full" },
                ...project.lines.map((line, index) =>
                  h(
                    "span",
                    {
                      key: `${line.kind}-${index}`,
                      className: `pmwb2-brief-project-summary-line ${line.kind}`,
                    },
                    h("b", null, `${line.label}：`),
                    line.text,
                  ),
                ),
              ),
            ),
            project.progress.length > 0
              ? h(
                  "section",
                  { className: "pmwb2-brief-drawer-block" },
                  h("h3", null, `关键进展 · ${project.progress.length}`),
                  h(
                    "div",
                    { className: "pmwb2-brief-project-items" },
                    ...project.progress.map((item) =>
                      h(BriefProjectDetailRow, {
                        key: item.itemId,
                        item,
                        onDetail: onItemDetail,
                      }),
                    ),
                  ),
                )
              : null,
            project.attention.length > 0
              ? h(
                  "section",
                  { className: "pmwb2-brief-drawer-block" },
                  h("h3", null, `需要关注 · ${project.attention.length}`),
                  h(
                    "div",
                    { className: "pmwb2-brief-project-items" },
                    ...project.attention.map((item) =>
                      h(BriefProjectDetailRow, {
                        key: item.itemId,
                        item,
                        onDetail: onItemDetail,
                      }),
                    ),
                  ),
                )
              : null,
          ),
          h(
            "footer",
            { className: "pmwb2-brief-drawer-foot" },
            h(FollowButton, {
              type: "project",
              id: project.workspaceId,
              subjectLabel: "项目",
              compact: true,
            }),
            h(
              "button",
              {
                type: "button",
                className: "pmwb-btn",
                onClick: onClose,
              },
              "关闭",
            ),
          ),
        ),
      );
    }

    function BriefProjectFilter({ projects, selected, onChange }) {
      const [open, setOpen] = react.useState(false);
      const rootRef = react.useRef(null);
      const allSelected =
        projects.length > 0 &&
        projects.every((project) => selected.includes(project));
      const label = allSelected
        ? "全部项目"
        : selected.length === 0
          ? "未选项目"
          : selected.length === 1
            ? truncateProjectName(selected[0])
            : `已选 ${selected.length} 项`;

      react.useEffect(() => {
        if (!open) return undefined;
        const closeOnOutside = (event) => {
          if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => {
          if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutside, true);
        window.addEventListener("keydown", closeOnEscape);
        return () => {
          document.removeEventListener("pointerdown", closeOnOutside, true);
          window.removeEventListener("keydown", closeOnEscape);
        };
      }, [open]);

      const toggleProject = (project) => {
        onChange(
          selected.includes(project)
            ? selected.filter((item) => item !== project)
            : [...selected, project],
        );
      };

      return h(
        "div",
        { className: "pmwb-project-filter", ref: rootRef },
        h(
          "button",
          {
            type: "button",
            className: `pmwb-project-filter-trigger${open ? " open" : ""}`,
            "aria-expanded": open,
            "aria-haspopup": "dialog",
            title: allSelected
              ? "全部项目"
              : selected.join("、") || "未选择项目",
            onClick: () => setOpen((current) => !current),
          },
          h("span", null, label),
          ICONS.chevron,
        ),
        open
          ? h(
              "div",
              {
                className: "pmwb-project-filter-menu",
                role: "dialog",
                "aria-label": "项目筛选",
              },
              h(
                "div",
                { className: "pmwb-project-filter-head" },
                h("strong", null, "项目筛选"),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => onChange(allSelected ? [] : [...projects]),
                  },
                  allSelected ? "清空" : "全选",
                ),
              ),
              h(
                "div",
                { className: "pmwb-project-filter-list" },
                ...projects.map((project) =>
                  h(
                    "label",
                    {
                      className: "pmwb-project-filter-option",
                      key: project,
                      title: project,
                    },
                    h("input", {
                      type: "checkbox",
                      checked: selected.includes(project),
                      onChange: () => toggleProject(project),
                    }),
                    h("span", null, project),
                  ),
                ),
              ),
            )
          : null,
      );
    }

    function BriefBody({
      payload,
      view,
      onOpen,
      onAnalyze,
      onUnread,
      onDetail,
    }) {
      const data = payload?.data ?? {};
      const items =
        view === "unread"
          ? (data.views?.unread ?? [])
          : (data.views?.all ?? []);
      const groups = groupBriefItems(items);
      const [expandedSections, setExpandedSections] = react.useState({});
      const [helpSection, setHelpSection] = react.useState(null);
      const [detailItem, setDetailItem] = react.useState(null);
      const [detailProject, setDetailProject] = react.useState(null);

      react.useEffect(() => {
        if (detailItem === null && detailProject === null) return undefined;
        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            setDetailItem(null);
            setDetailProject(null);
          }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [detailItem, detailProject]);

      const openDetail = (item) => {
        setHelpSection(null);
        setDetailProject(null);
        setDetailItem(item);
        void onDetail?.(item);
      };
      const openProjectDetail = (project) => {
        setHelpSection(null);
        setDetailItem(null);
        setDetailProject(project);
      };

      const runPrimary = (item) => {
        setDetailItem(null);
        if (
          typeof item.actionLabel === "string" &&
          item.actionLabel.includes("分析")
        ) {
          void onAnalyze(item);
        } else {
          void onOpen(item);
        }
      };

      const renderSection = (kind) => {
        const sectionItems = groups[kind];
        if (sectionItems.length === 0) return null;
        const meta = BRIEF_SECTION_META[kind];
        const expanded = Boolean(expandedSections[kind]);
        const projectDigests =
          view === "unread"
            ? data.projectDigests?.unread
            : data.projectDigests?.all;
        const projectCards =
          kind === "progress"
            ? briefProjectCards(sectionItems, items, projectDigests)
            : [];
        const sectionEntries =
          kind === "progress" ? projectCards : sectionItems;
        const visibleEntries = expanded
          ? sectionEntries
          : sectionEntries.slice(0, meta.limit);
        const hiddenCount = Math.max(
          0,
          sectionEntries.length - visibleEntries.length,
        );
        return h(
          "section",
          { className: "pmwb2-brief-section", key: kind },
          h(
            "div",
            { className: "pmwb2-brief-section-head" },
            h(
              "h3",
              { className: "pmwb2-brief-section-title" },
              meta.title,
              h(
                "span",
                { className: "pmwb2-brief-section-count" },
                sectionEntries.length,
              ),
            ),
            h(
              "div",
              { className: "pmwb2-brief-section-actions" },
              h(
                "button",
                {
                  type: "button",
                  className: "pmwb2-brief-help-btn",
                  "aria-label": `${meta.title}说明`,
                  title: `${meta.title}说明`,
                  "aria-expanded": helpSection === kind,
                  onClick: () =>
                    setHelpSection((current) =>
                      current === kind ? null : kind,
                    ),
                },
                ICONS.info,
              ),
              sectionEntries.length > meta.limit
                ? h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-brief-linkbtn",
                      onClick: () =>
                        setExpandedSections((current) => ({
                          ...current,
                          [kind]: !current[kind],
                        })),
                    },
                    expanded
                      ? "收起"
                      : kind === "progress"
                        ? `查看全部 ${sectionEntries.length} 个项目`
                        : `其它 ${hiddenCount} 条`,
                    ICONS.chevron,
                  )
                : null,
            ),
            helpSection === kind
              ? h(
                  "div",
                  { className: "pmwb2-brief-help", role: "note" },
                  h("strong", null, meta.title),
                  meta.help,
                )
              : null,
          ),
          h(
            "div",
            {
              className:
                kind === "progress"
                  ? "pmwb2-brief-project-list"
                  : "pmwb2-brief-list",
            },
            ...(kind === "progress"
              ? visibleEntries.map((project) =>
                  h(BriefProjectCard, {
                    key: project.key,
                    project,
                    onDetail: openProjectDetail,
                  }),
                )
              : visibleEntries.map((item) => {
                  const businessTag =
                    briefTagLabel(item.tag) ||
                    (kind === "anomaly" ? "异常" : "待处理");
                  const sourceTag =
                    kind === "anomaly" ? briefSourceTag(item) : null;
                  const followTarget = briefFollowTarget(item);
                  return h(
                    "article",
                    {
                      key: item.itemId,
                      className: `pmwb2-brief-row${item.readState === "read" ? " read" : ""}`,
                      ...dataAgentBriefAttributes(item),
                    },
                    h(
                      "span",
                      { className: "pmwb2-brief-row-main" },
                      h(
                        "span",
                        { className: "pmwb2-brief-row-titleline" },
                        h(
                          "span",
                          { className: "pmwb2-brief-row-title" },
                          item.title,
                        ),
                        sourceTag
                          ? h(
                              "span",
                              {
                                className: `pmwb2-brief-row-source ${sourceTag.kind}`,
                                title: `来源：${sourceTag.label}`,
                              },
                              sourceTag.label,
                            )
                          : null,
                      ),
                      h(
                        "span",
                        { className: "pmwb2-brief-row-sub" },
                        briefPlainText(
                          item.conclusion || item.reason || item.statusLabel,
                        ),
                      ),
                    ),
                    h(
                      "span",
                      { className: "pmwb2-brief-row-trailing" },
                      h(
                        "span",
                        { className: "pmwb2-brief-detail-row" },
                        followTarget
                          ? h(FollowButton, {
                              type: followTarget.type,
                              id: followTarget.id,
                              compact: true,
                            })
                          : null,
                        view === "all" && item.readState === "read"
                          ? h(
                              "button",
                              {
                                type: "button",
                                className: "pmwb2-brief-read-action",
                                onClick: (event) => {
                                  event.stopPropagation();
                                  void onUnread(item);
                                },
                              },
                              "标为未读",
                            )
                          : null,
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmwb2-brief-detail-action",
                            onClick: (event) => {
                              event.stopPropagation();
                              openDetail(item);
                            },
                          },
                          "详情",
                        ),
                      ),
                      h(
                        "span",
                        { className: "pmwb2-brief-row-meta" },
                        businessTag
                          ? h(
                              "span",
                              {
                                className: `pmwb2-brief-row-kind ${kind}`,
                                title: `业务类型：${businessTag}`,
                              },
                              businessTag,
                            )
                          : null,
                        item.statusLabel
                          ? h(
                              "span",
                              {
                                className: `pmwb2-brief-status ${briefStatusClass(item)}`,
                                title: `当前状态：${item.statusLabel}`,
                              },
                              item.statusLabel,
                            )
                          : null,
                      ),
                    ),
                  );
                })),
          ),
        );
      };

      const itemDetail =
        detailItem === null
          ? null
          : h(
              "div",
              {
                className: "pmwb2-brief-drawer-mask",
                role: "presentation",
                onClick: (event) => {
                  if (event.target === event.currentTarget) setDetailItem(null);
                },
              },
              h(
                "aside",
                {
                  className: "pmwb2-brief-drawer",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": detailItem.title,
                },
                h(
                  "header",
                  { className: "pmwb2-brief-drawer-head" },
                  h("h2", null, detailItem.title),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-iconbtn",
                      "aria-label": "关闭简报详情",
                      title: "关闭",
                      onClick: () => setDetailItem(null),
                    },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-brief-drawer-body" },
                  h(
                    "div",
                    null,
                    h(
                      "div",
                      { className: "pmwb2-brief-drawer-kicker" },
                      `${briefSourceLabel(detailItem)} · ${
                        briefTagLabel(detailItem.tag) || "简报"
                      }`,
                    ),
                    h(
                      "h3",
                      { className: "pmwb2-brief-drawer-title" },
                      detailItem.title,
                    ),
                    detailItem.conclusion
                      ? h(
                          "div",
                          { className: "pmwb2-brief-drawer-text" },
                          renderBriefMarkdown(detailItem.conclusion),
                        )
                      : null,
                  ),
                  h(
                    "section",
                    { className: "pmwb2-brief-drawer-block" },
                    h("h3", null, "关键事实"),
                    h(
                      "dl",
                      { className: "pmwb2-brief-facts" },
                      ...[
                        [
                          "状态",
                          detailItem.statusLabel ||
                            briefTagLabel(detailItem.tag) ||
                            "待处理",
                        ],
                        ...(detailItem.executorName
                          ? [
                              [
                                "责任",
                                `${detailItem.executorName}${
                                  detailItem.executorRole
                                    ? ` · ${detailItem.executorRole}`
                                    : ""
                                }`,
                              ],
                            ]
                          : []),
                        ["时间", formatTime(detailItem.occurredAt)],
                        ...(detailItem.deadline
                          ? [["截止", formatDate(detailItem.deadline)]]
                          : []),
                        ...(detailItem.workspaceName
                          ? [["项目", detailItem.workspaceName]]
                          : []),
                      ].flatMap(([label, value]) => [
                        h("dt", { key: `dt-${label}` }, label),
                        h("dd", { key: `dd-${label}` }, value),
                      ]),
                    ),
                  ),
                  detailItem.reason
                    ? h(
                        "section",
                        { className: "pmwb2-brief-drawer-block" },
                        h("h3", null, "为什么看到这条"),
                        h(
                          "div",
                          { className: "pmwb2-brief-drawer-text" },
                          detailItem.reason,
                        ),
                      )
                    : null,
                  h(
                    "section",
                    { className: "pmwb2-brief-drawer-block" },
                    h("h3", null, "证据与来源"),
                    detailItem.deepLink?.route === "task" &&
                      detailItem.deepLink?.refId
                      ? h(BriefTaskBasicInfo, {
                          key: detailItem.deepLink.refId,
                          taskId: detailItem.deepLink.refId,
                        })
                      : h(
                          "button",
                          {
                            type: "button",
                            className: "pmwb2-brief-evidence",
                            onClick: () => {
                              setDetailItem(null);
                              void onOpen(detailItem);
                            },
                          },
                          ICONS.chevron,
                          h(
                            "span",
                            null,
                            `${briefSourceLabel(detailItem)} · ${detailItem.sourceId}`,
                          ),
                          ICONS.chevron,
                        ),
                  ),
                  detailItem.suggestion
                    ? h(
                        "section",
                        { className: "pmwb2-brief-drawer-block" },
                        h("h3", null, "建议下一步"),
                        h(
                          "div",
                          { className: "pmwb2-brief-recommend" },
                          h("strong", null, detailItem.suggestion.headline),
                          detailItem.suggestion.body,
                        ),
                      )
                    : null,
                ),
                h(
                  "footer",
                  { className: "pmwb2-brief-drawer-foot" },
                  view === "all" && detailItem.readState === "read"
                    ? h(
                        "button",
                        {
                          type: "button",
                          className: "pmwb2-btn",
                          onClick: async () => {
                            await onUnread(detailItem);
                            setDetailItem(null);
                          },
                        },
                        "标为未读",
                      )
                    : null,
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn",
                      onClick: () => setDetailItem(null),
                    },
                    "关闭",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn primary",
                      onClick: () => runPrimary(detailItem),
                    },
                    detailItem.actionLabel || "前往处理",
                    ICONS.chevron,
                  ),
                ),
              ),
            );

      const projectDetail =
        detailProject === null
          ? null
          : h(BriefProjectDrawer, {
              key: `project-${detailProject.workspaceId}`,
              project: detailProject,
              onClose: () => setDetailProject(null),
              onItemDetail: openDetail,
            });

      const detail = h(react.Fragment, null, projectDetail, itemDetail);

      return h(
        "div",
        { className: "pmwb2-brief-panel" },
        items.length === 0
          ? h(
              "div",
              { className: "pmwb2-brief-empty" },
              view === "unread"
                ? "当前没有未读简报条目。"
                : "当前周期没有新增简报。",
            )
          : [
              renderSection("progress"),
              renderSection("anomaly"),
              renderSection("attention"),
            ],
        detail,
      );
    }

    function formatTokenCount(value) {
      const count = Number(value ?? 0);
      if (!Number.isFinite(count) || count <= 0) return "0";
      if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
      if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
      return String(Math.round(count));
    }

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

    function AiPartnerAvatar({ item }) {
      const avatar = item?.avatar;
      const art =
        typeof avatar === "string" && avatar.startsWith("data:image/")
          ? h("img", {
              className: "pmwb2-ai-avatar-art",
              src: avatar,
              alt: "",
            })
          : (() => {
              const preset =
                AI_LOAD_AVATAR_PRESETS.find((entry) => entry.id === avatar) ??
                AI_LOAD_AVATAR_PRESETS[0];
              const children = [
                h("rect", {
                  key: "bg",
                  width: 64,
                  height: 64,
                  fill: preset.bg,
                }),
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
                h("circle", {
                  key: "ear-l",
                  cx: 18,
                  cy: 30,
                  r: 4,
                  fill: preset.skin,
                }),
                h("circle", {
                  key: "ear-r",
                  cx: 46,
                  cy: 30,
                  r: 4,
                  fill: preset.skin,
                }),
                h("circle", {
                  key: "face",
                  cx: 32,
                  cy: 29,
                  r: 16,
                  fill: preset.skin,
                }),
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
                    h("circle", { key: "g1", cx: 25.5, cy: 31, r: 4 }),
                    h("circle", { key: "g2", cx: 38.5, cy: 31, r: 4 }),
                    h("path", { key: "g3", d: "M29.5 31h5" }),
                  ),
                );
              }
              return h(
                "svg",
                {
                  className: "pmwb2-ai-avatar-art",
                  viewBox: "0 0 64 64",
                  "aria-hidden": "true",
                },
                children,
              );
            })();
      return h(
        "span",
        {
          className: `pmwb2-ai-avatar${item?.source === "platform" ? " platform" : ""}`,
          role: "img",
          "aria-label": `${item?.name ?? "AI伙伴"} 的头像`,
        },
        art,
      );
    }

    function formatRuntimeHours(value) {
      const hours = Number(value ?? 0);
      const seconds = Math.max(0, hours * 3_600);
      if (seconds > 0 && seconds < 60) {
        return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
      }
      if (seconds >= 60 && seconds < 3_600) {
        return `${Math.round(seconds / 60)}m`;
      }
      return `${hours.toFixed(1)}h`;
    }

    const AI_LOAD_COLUMN_LABELS = {
      runtime: "时长",
      task: "任务数",
      token: "Token",
      lastActivity: "最近",
    };
    const AI_LOAD_METRIC_LABELS = {
      runtime: "运行时长",
      task: "任务数",
      token: "Token",
    };
    const AI_LOAD_DEFAULT_COLUMNS = [
      "runtime",
      "task",
      "token",
      "lastActivity",
    ];

    function normalizeAiLoadConfig(value) {
      const source = value !== null && typeof value === "object" ? value : {};
      const valid = new Set(AI_LOAD_DEFAULT_COLUMNS);
      const requested = Array.isArray(source.columns)
        ? source.columns.filter(
            (item) =>
              item !== null && typeof item === "object" && valid.has(item.key),
          )
        : [];
      const seen = new Set();
      const columns = [];
      for (const item of requested) {
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        columns.push({ key: item.key, visible: item.visible !== false });
      }
      for (const key of AI_LOAD_DEFAULT_COLUMNS) {
        if (!seen.has(key)) columns.push({ key, visible: true });
      }
      return {
        primaryMetric: Object.hasOwn(
          AI_LOAD_METRIC_LABELS,
          source.primaryMetric,
        )
          ? source.primaryMetric
          : "runtime",
        columns,
      };
    }

    function workloadMetricValue(workload, metric) {
      const stats = workload ?? {};
      if (metric === "task") return Number(stats.taskCount ?? 0);
      if (metric === "token") return Number(stats.outputTokens ?? 0);
      return Number(stats.runtimeHours ?? 0);
    }

    function workloadMetricDisplay(workload, metric) {
      const value = workloadMetricValue(workload, metric);
      if (metric === "runtime") return formatRuntimeHours(value);
      if (metric === "token") return formatTokenCount(value);
      return String(Math.round(value));
    }

    function AiPartnerLoadBody({ snapshot, config, windowKey }) {
      const items = Array.isArray(snapshot?.items)
        ? snapshot.items.filter((item) => item?.state !== "archived")
        : [];
      const settings = normalizeAiLoadConfig(config);
      const visibleColumns = settings.columns.filter(
        (column) => column.visible,
      );
      const primaryMetric = settings.primaryMetric;
      const views = {
        last24h: { label: "24 小时", hours: 24 },
        last72h: { label: "72 小时", hours: 72 },
      };
      const view = views[windowKey] ?? views.last24h;
      const generatedAt = new Date(
        snapshot?.generatedAt ?? Date.now(),
      ).getTime();
      const cutoff = generatedAt - view.hours * 60 * 60 * 1_000;
      const statsOf = (item) => item?.[windowKey] ?? {};
      const activeInWindow = (item) => {
        if (item.hasRunIn72h !== true) return false;
        if (windowKey === "last72h") return true;
        const lastActivityAt = new Date(item.lastActivityAt ?? "").getTime();
        if (Number.isFinite(lastActivityAt)) return lastActivityAt >= cutoff;
        const stats = statsOf(item);
        return (
          Number(stats.meetingCount ?? 0) > 0 ||
          Number(stats.taskCount ?? 0) > 0 ||
          Number(stats.outputTokens ?? 0) > 0 ||
          Number(stats.runtimeHours ?? 0) > 0
        );
      };
      const active = items.filter(activeInWindow);
      const inactive = items.filter((item) => !activeInWindow(item));
      const sorted = [...active].sort((left, right) => {
        const metricDelta =
          workloadMetricValue(statsOf(right), primaryMetric) -
          workloadMetricValue(statsOf(left), primaryMetric);
        const recentDelta = String(right.lastActivityAt ?? "").localeCompare(
          String(left.lastActivityAt ?? ""),
        );
        return (
          metricDelta ||
          recentDelta ||
          String(left.name ?? "").localeCompare(
            String(right.name ?? ""),
            "zh-Hans-CN",
          )
        );
      });
      const inactiveSorted = [...inactive].sort(
        (left, right) =>
          String(right.lastActivityAt ?? "").localeCompare(
            String(left.lastActivityAt ?? ""),
          ) ||
          String(left.name ?? "").localeCompare(
            String(right.name ?? ""),
            "zh-Hans-CN",
          ),
      );
      const columnTemplate = visibleColumns
        .map((column) => {
          if (column.key === "lastActivity") return "minmax(38px,0.72fr)";
          if (column.key === "runtime") return "minmax(52px,1.15fr)";
          if (column.key === "task") return "minmax(44px,0.62fr)";
          if (column.key === "token") return "minmax(32px,0.55fr)";
          return "minmax(40px,0.6fr)";
        })
        .join(" ");
      const runtimeTrendOf = (item) => {
        const current = workloadMetricValue(item.last24h, "runtime");
        const previous = Math.max(
          0,
          workloadMetricValue(item.last72h, "runtime") - current,
        );
        const delta = current - previous;
        const percent =
          previous > 0
            ? Math.round((Math.abs(delta) / previous) * 100)
            : current > 0
              ? 100
              : 0;
        return {
          direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
          percent,
        };
      };
      const openTeammate = (item) => {
        if (item?.teammateId === undefined) return;
        window.__pluginmaxPendingTeammate = {
          teammateId: item.teammateId,
          tab: "runtime",
          returnRuntimeTab: "current",
        };
        window.dispatchEvent(
          new CustomEvent("pluginmax:navigate", {
            detail: { route: "teammates" },
          }),
        );
      };
      const renderRow = (item, index, inactive = false) => {
        const stats = statsOf(item);
        const itemBlockers = (item.blockers ?? []).filter(
          (blocker) =>
            windowKey === "last72h" ||
            new Date(blocker.updatedAt).getTime() >= cutoff,
        );
        const runtimeTrend = runtimeTrendOf(item);
        return h(
          "article",
          {
            className: `pmwb2-ai-load-row${
              index === 0 && !inactive ? " leader" : ""
            }${inactive ? " inactive" : ""}`,
            key: item.teammateId,
            "data-data-agent-card": "true",
            "data-workspace-id": item.workspaceId,
            "data-data-agent-title": item.name ?? "AI伙伴",
            "data-data-agent-excerpt": item.role ?? "AI伙伴运行负载",
            role: "button",
            tabIndex: 0,
            "aria-label": `打开 ${item.name ?? "AI伙伴"} 详情`,
            onClick: () => openTeammate(item),
            onKeyDown: (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              openTeammate(item);
            },
          },
          h(
            "span",
            { className: "pmwb2-ai-load-rank" },
            inactive ? "—" : String(index + 1).padStart(2, "0"),
          ),
          h(
            "div",
            { className: "pmwb2-ai-load-person" },
            h(AiPartnerAvatar, { item }),
            h(
              "div",
              { className: "pmwb2-ai-load-person-copy" },
              h(
                "strong",
                { title: item.role || "AI伙伴" },
                item.name ?? "AI伙伴",
                itemBlockers.length > 0
                  ? h(
                      "span",
                      {
                        className: "pmwb2-ai-load-warning",
                        title: itemBlockers
                          .map((blocker) => blocker.reason)
                          .join("；"),
                      },
                      " !",
                    )
                  : null,
              ),
              h("small", null, item.role || "AI伙伴"),
            ),
          ),
          h(
            "div",
            {
              className: "pmwb2-ai-load-data",
              style: { gridTemplateColumns: columnTemplate },
            },
            ...visibleColumns.map((column) => {
              if (column.key === "lastActivity") {
                const activity = dateTimeParts(item.lastActivityAt);
                return h(
                  "span",
                  {
                    className: "pmwb2-ai-load-cell time",
                    key: column.key,
                    title: item.lastActivityAt
                      ? formatTime(item.lastActivityAt)
                      : "暂无记录",
                  },
                  activity === null
                    ? "暂无"
                    : h(
                        react.Fragment,
                        null,
                        h("span", null, activity.date),
                        h("span", null, activity.time),
                      ),
                );
              }
              if (column.key === "runtime") {
                return h(
                  "span",
                  {
                    className: "pmwb2-ai-load-cell pmwb2-ai-load-runtime",
                    key: column.key,
                    title: "运行时长，括号为近 24 小时相对前 24 小时的变化",
                  },
                  workloadMetricDisplay(stats, "runtime"),
                  h(
                    "small",
                    {
                      className: `pmwb2-ai-load-runtime-trend ${runtimeTrend.direction}`,
                    },
                    `${
                      runtimeTrend.direction === "up"
                        ? "↑"
                        : runtimeTrend.direction === "down"
                          ? "↓"
                          : "→"
                    } ${runtimeTrend.percent}%`,
                  ),
                );
              }
              return h(
                "span",
                {
                  className: `pmwb2-ai-load-cell${
                    column.key === primaryMetric ? " primary" : ""
                  }`,
                  key: column.key,
                  title: AI_LOAD_COLUMN_LABELS[column.key],
                },
                workloadMetricDisplay(stats, column.key),
              );
            }),
          ),
        );
      };
      if (snapshot?.unavailable === true) {
        return h("div", { className: "pmwb2-empty" }, "AI伙伴运行数据暂不可用");
      }
      return h(
        "div",
        { className: "pmwb2-ai-load" },
        active.length === 0 && inactive.length === 0
          ? h(
              "div",
              { className: "pmwb2-empty" },
              `过去 ${view.label}暂无 AI伙伴运行记录`,
            )
          : null,
        h(
          "div",
          { className: "pmwb2-ai-load-table" },
          h(
            "div",
            { className: "pmwb2-ai-load-head" },
            h("span", null, "#"),
            h("span", null, "AI伙伴"),
            h(
              "div",
              {
                className: "pmwb2-ai-load-head-data",
                style: { gridTemplateColumns: columnTemplate },
              },
              ...visibleColumns.map((column) =>
                h(
                  "span",
                  {
                    key: column.key,
                    title:
                      column.key === primaryMetric
                        ? "当前主排序指标"
                        : undefined,
                  },
                  `${AI_LOAD_COLUMN_LABELS[column.key]}${
                    column.key === primaryMetric ? " ↓" : ""
                  }`,
                ),
              ),
            ),
          ),
          ...sorted.map((item, index) => renderRow(item, index)),
          sorted.length > 0 && inactiveSorted.length > 0
            ? h(
                "div",
                { className: "pmwb2-ai-load-divider" },
                h("span", null, `无${view.label}运行记录`),
              )
            : null,
          ...inactiveSorted.map((item, index) => renderRow(item, index, true)),
        ),
      );
    }

    function NewPanelBody({ pluginId, payload, config, windowKey }) {
      const items = payload?.data?.items ?? [];
      if (pluginId === "pluginmax.data-agent") {
        const sessions = payload?.data?.sessions ?? [];
        if (sessions.length === 0) {
          return h(
            "div",
            { className: "pmwb2-empty" },
            "当前还没有 Data Agent 会话。",
          );
        }
        return h(
          "div",
          { className: "pmwb2-data-agent-sessions" },
          ...sessions.map((session) =>
            h(
              "article",
              {
                key: session.id,
                className: "pmwb2-data-agent-session",
                "data-data-agent-exclude": "true",
                "data-data-agent-conversation-id": session.id,
                role: "button",
                tabIndex: 0,
                onClick: () => openDataAgentConversation(session),
                onKeyDown: (event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  openDataAgentConversation(session);
                },
              },
              h(
                "div",
                { className: "pmwb2-data-agent-session-head" },
                h(
                  "span",
                  { className: "pmwb2-data-agent-session-title" },
                  session.title,
                ),
                h(
                  "span",
                  { className: "pmwb2-data-agent-session-actions" },
                  h(FollowButton, {
                    type: "data-agent",
                    id: session.id,
                    compact: true,
                  }),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb-btn pmwb2-card-action",
                      onClick: (event) => {
                        event.stopPropagation();
                        openDataAgentConversation(session);
                      },
                    },
                    "详情",
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmwb2-data-agent-session-project" },
                session.projectName || "未归属项目",
              ),
              h(
                "p",
                {
                  className: `pmwb2-data-agent-session-preview${
                    session.preview ? "" : " placeholder"
                  }`,
                  title: session.preview || undefined,
                },
                session.preview || "暂无 AI 反馈",
              ),
            ),
          ),
        );
      }
      if (pluginId === "pluginmax.workflow-runs") {
        return h(
          "div",
          { className: "pmwb2-list" },
          ...items.map((item) =>
            h(
              "div",
              { className: "pmwb2-row", key: item.id },
              h("strong", null, item.title),
              h(
                "span",
                { className: `pmwb2-tag ${tagClass(item.status)}` },
                item.status,
              ),
              h("small", null, item.id),
              h("span", { className: "pmwb2-row-note" }, item.note),
              h(
                "span",
                { className: "pmwb2-progress", style: { gridColumn: "1/-1" } },
                h("span", { style: { width: `${item.progress}%` } }),
              ),
            ),
          ),
        );
      }
      if (pluginId === "pluginmax.team-load") {
        return h(AiPartnerLoadBody, {
          snapshot: payload?.data ?? {},
          config: config?.aiLoad,
          windowKey,
        });
      }
      return h(GenericList, { items });
    }

    function LegacyReadableBody({
      pluginId,
      items,
      read,
      isRead,
      view,
      markRead,
      markUnread,
    }) {
      const visible =
        view === "unread" ? items.filter((item) => !read(item)) : items;
      if (visible.length === 0) {
        return h(
          "div",
          { className: "pmwb-empty" },
          view === "unread"
            ? pluginId === "pluginmax.meeting-insights"
              ? "暂无未读会议纪要。"
              : pluginId === "pluginmax.following"
                ? "没有未读重点关注。"
                : "没有未读待办事项。"
            : pluginId === "pluginmax.meeting-insights"
              ? "暂无会议纪要。"
              : pluginId === "pluginmax.following"
                ? "还没有关注的任务、工作流、会议或项目。"
                : "没有待处理或待验收的任务。",
        );
      }
      if (pluginId === "pluginmax.meeting-insights") {
        return h(
          "div",
          { className: "pmwb-stack" },
          ...renderMeetingRows(visible, {
            isRead,
            markRead,
            markUnread,
            showUnreadAction: view === "all",
          }),
        );
      }
      return h(
        "div",
        { className: "pmwb-stack" },
        ...visible.map((item) =>
          renderOwnerRow(
            item,
            {
              isRead,
              markRead,
              markUnread,
              showUnreadAction: view === "all",
            },
            pluginId === "pluginmax.following" ? "focus" : "todo",
          ),
        ),
      );
    }

    function PanelView(props) {
      const [state, setState] = react.useState({ status: "loading" });
      const [view, setView] = react.useState("unread");
      const [briefSelectedProjects, setBriefSelectedProjects] =
        react.useState(null);
      const [currentUserId, setCurrentUserId] =
        react.useState(readCurrentUserId);
      const [, setReadRevision] = react.useState(0);
      const readState = react.useSyncExternalStore(
        readStateStore.subscribe.bind(readStateStore),
        readStateStore.getSnapshot.bind(readStateStore),
        readStateStore.getSnapshot.bind(readStateStore),
      );
      const [followTick, setFollowTick] = react.useState(0);
      const [aiLoadWindow, setAiLoadWindow] = react.useState("last24h");
      const [todoScope, setTodoScope] = react.useState(readTodoScope);
      const [todoSettingsOpen, setTodoSettingsOpen] = react.useState(false);
      const load = react.useCallback(async () => {
        setState((previous) => ({
          status: previous.payload === undefined ? "loading" : "refreshing",
          ...(previous.payload === undefined
            ? {}
            : { payload: previous.payload }),
        }));
        try {
          const pluginId = props.pluginId;
          const legacy = LEGACY_MODULE[pluginId];
          const scope =
            window.__pluginmaxScope?.getSnapshot?.() === true
              ? "&scope=all"
              : "";
          let payload;
          if (pluginId === "pluginmax.data-agent") {
            const [workspaceResult, conversations] = await Promise.all([
              request("/api/collab/team/workspaces"),
              request("/api/collab/data-agent/conversations"),
            ]);
            const workspaces = (workspaceResult.workspaces ?? []).filter(
              (item) => item.isMember !== false,
            );
            const workspacesById = new Map(
              workspaces.map((workspace) => [workspace.id, workspace]),
            );
            const conversationItems = conversations.conversations ?? [];
            const fallbackPreviews = new Map(
              await Promise.all(
                conversationItems
                  .filter(
                    (conversation) =>
                      conversation.latestAiMessage?.content === undefined,
                  )
                  .slice(0, 12)
                  .map(async (conversation) => {
                    try {
                      const detail = await request(
                        `/api/collab/data-agent/conversation?id=${encodeURIComponent(conversation.id)}`,
                      );
                      const latest = [...(detail.messages ?? [])]
                        .reverse()
                        .find((message) => message.senderType === "ai-partner");
                      return [
                        conversation.id,
                        latest
                          ? briefPlainText(latest.content).slice(0, 500)
                          : "",
                      ];
                    } catch {
                      return [conversation.id, ""];
                    }
                  }),
              ),
            );
            const sessions = conversationItems.map((conversation) => {
              const workspace = workspacesById.get(conversation.workspaceId);
              return {
                id: conversation.id,
                title: conversation.title,
                workspaceId: conversation.workspaceId,
                projectId: conversation.projectId ?? conversation.workspaceId,
                projectName:
                  workspace?.title ??
                  workspace?.path ??
                  conversation.projectId ??
                  conversation.workspaceId ??
                  "未归属项目",
                preview:
                  briefPlainText(conversation.latestAiMessage?.content ?? "") ||
                  fallbackPreviews.get(conversation.id) ||
                  "",
                updatedAt:
                  conversation.latestAiMessage?.createdAt ??
                  conversation.updatedAt,
              };
            });
            payload = {
              id: pluginId,
              pluginId,
              title: "Data Agent",
              updatedAt:
                sessions
                  .map((session) => session.updatedAt)
                  .filter(Boolean)
                  .sort()
                  .at(-1) ?? null,
              source: "live",
              refreshable: true,
              data: {
                conversationCount: sessions.length,
                sessions,
              },
            };
          } else if (legacy) {
            const todoScopeQuery =
              pluginId === "pluginmax.task-focus"
                ? `&todoScope=${encodeURIComponent(todoScope)}`
                : "";
            payload = (
              await request(
                `/api/collab/workbench/module?moduleId=${encodeURIComponent(legacy)}&tzOffset=${TZ_OFFSET}${scope}${todoScopeQuery}`,
              )
            ).module;
          } else {
            payload = (
              await request(
                `/api/collab/workbench-v2/panel?pluginId=${encodeURIComponent(pluginId)}${scope}`,
              )
            ).panel;
          }
          setState({ status: "ready", payload });
        } catch (error) {
          setState({ status: "error", error: error.message });
        }
      }, [props.pluginId, todoScope]);

      react.useEffect(() => {
        void load();
        const refresh = (event) => {
          const target = event?.detail?.instanceId;
          if (target === undefined || target === props.instanceId) void load();
        };
        window.addEventListener("pluginmax:workbench-v2-refresh", refresh);
        return () =>
          window.removeEventListener("pluginmax:workbench-v2-refresh", refresh);
      }, [load, props.instanceId]);

      react.useEffect(() => {
        const scope = window.__pluginmaxScope;
        if (scope === undefined) return undefined;
        return scope.subscribe(() => void load());
      }, [load]);

      react.useEffect(() => {
        void request("/api/collab/auth/me")
          .then((result) => setCurrentUserId(result?.user?.id ?? ""))
          .catch(() => setCurrentUserId(""));
      }, []);

      react.useEffect(() => {
        void followStore.ensure();
        return followStore.subscribe(() => setFollowTick((value) => value + 1));
      }, []);

      const read = react.useCallback(
        (moduleId, item) => {
          if (currentUserId === "") return false;
          const current = readStateStore.getSnapshot();
          return Boolean(
            current[currentUserId]?.[moduleId]?.[itemSignature(item)],
          );
        },
        [currentUserId, readState],
      );

      const markRead = react.useCallback(
        (moduleId, item) => {
          if (currentUserId === "") return;
          const previous = readStateStore.getSnapshot();
          const signature = itemSignature(item);
          if (previous[currentUserId]?.[moduleId]?.[signature]) return;
          const next = {
            ...previous,
            [currentUserId]: {
              ...previous[currentUserId],
              [moduleId]: {
                ...previous[currentUserId]?.[moduleId],
                [signature]: true,
              },
            },
          };
          readStateStore.commit(next);
          setReadRevision((revision) => revision + 1);
          window.dispatchEvent(
            new CustomEvent("pluginmax:workbench-toast", {
              detail: { message: "已标记为已读" },
            }),
          );
        },
        [currentUserId],
      );

      const markUnread = react.useCallback(
        (moduleId, item) => {
          if (currentUserId === "") return;
          const previous = readStateStore.getSnapshot();
          const signature = itemSignature(item);
          if (!previous[currentUserId]?.[moduleId]?.[signature]) return;
          const moduleState = {
            ...previous[currentUserId]?.[moduleId],
          };
          delete moduleState[signature];
          const next = {
            ...previous,
            [currentUserId]: {
              ...previous[currentUserId],
              [moduleId]: moduleState,
            },
          };
          readStateStore.commit(next);
          setReadRevision((revision) => revision + 1);
          window.dispatchEvent(
            new CustomEvent("pluginmax:workbench-toast", {
              detail: { message: "已标记为未读" },
            }),
          );
        },
        [currentUserId],
      );

      const legacyPayload = state.payload ?? {};
      const isBrief = props.pluginId === "pluginmax.daily-brief";
      const legacyItems =
        props.pluginId === "pluginmax.following"
          ? (legacyPayload.data?.items ?? []).filter(focusItemFollowed)
          : (legacyPayload.data?.items ?? []);
      const allCount = legacyItems.length;
      const unreadCount = legacyItems.filter(
        (item) =>
          !read(
            props.pluginId === "pluginmax.meeting-insights"
              ? "meeting-minutes"
              : props.pluginId === "pluginmax.following"
                ? "focus"
                : "todo",
            item,
          ),
      ).length;
      const readable =
        props.pluginId === "pluginmax.task-focus" ||
        props.pluginId === "pluginmax.following" ||
        props.pluginId === "pluginmax.meeting-insights";
      const briefProjects = isBrief
        ? briefProjectNames(legacyPayload.data?.views?.all ?? [])
        : [];
      const briefProjectsKey = briefProjects.join("\u0000");
      const effectiveBriefProjects =
        briefSelectedProjects === null
          ? briefProjects
          : briefSelectedProjects.filter((project) =>
              briefProjects.includes(project),
            );
      react.useEffect(() => {
        setBriefSelectedProjects((current) => {
          if (briefProjects.length === 0) return current;
          if (current === null) return [...briefProjects];
          const next = current.filter((project) =>
            briefProjects.includes(project),
          );
          return next.length === current.length ? current : next;
        });
      }, [briefProjectsKey]);
      const filterBriefItems = (items) =>
        briefProjects.length === 0
          ? items
          : items.filter((item) =>
              effectiveBriefProjects.includes(
                String(item?.workspaceName ?? "").trim(),
              ),
            );
      const briefUnreadItems = filterBriefItems(
        legacyPayload.data?.views?.unread ?? [],
      );
      const briefAllItems = filterBriefItems(
        legacyPayload.data?.views?.all ?? [],
      );
      const briefCounts = {
        unread: briefUnreadItems.length,
        all: briefAllItems.length,
      };
      const briefAttentionCount =
        groupBriefItems(briefUnreadItems).attention.length;
      const briefCoverageSuffix =
        legacyPayload.data?.awayWindow?.from &&
        legacyPayload.data?.awayWindow?.to
          ? `覆盖 ${formatTime(legacyPayload.data.awayWindow.from)} - ${formatTime(legacyPayload.data.awayWindow.to)}`
          : "";
      const filteredBriefPayload = isBrief
        ? {
            ...state.payload,
            data: {
              ...legacyPayload.data,
              views: {
                unread: briefUnreadItems,
                all: briefAllItems,
              },
            },
          }
        : state.payload;
      const titleActions =
        props.pluginId === "pluginmax.team-load"
          ? h(
              "div",
              {
                className: "pmwb-seg",
                role: "group",
                "aria-label": "AI伙伴时间范围",
              },
              h(
                "button",
                {
                  type: "button",
                  className: aiLoadWindow === "last24h" ? "active" : "",
                  "aria-pressed": aiLoadWindow === "last24h",
                  onClick: () => setAiLoadWindow("last24h"),
                },
                "24 小时",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: aiLoadWindow === "last72h" ? "active" : "",
                  "aria-pressed": aiLoadWindow === "last72h",
                  onClick: () => setAiLoadWindow("last72h"),
                },
                "72 小时",
              ),
            )
          : readable
            ? h(
                react.Fragment,
                null,
                h(
                  "div",
                  {
                    className: "pmwb-seg",
                    role: "group",
                    "aria-label": "面板视图",
                  },
                  h(
                    "button",
                    {
                      type: "button",
                      className: view === "unread" ? "active" : "",
                      "aria-pressed": view === "unread",
                      onClick: () => setView("unread"),
                    },
                    `未读 ${unreadCount}`,
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: view === "all" ? "active" : "",
                      "aria-pressed": view === "all",
                      onClick: () => setView("all"),
                    },
                    `全部 ${allCount}`,
                  ),
                ),
                props.pluginId === "pluginmax.task-focus"
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: `pmwb2-iconbtn${
                          todoSettingsOpen ? " active" : ""
                        }`,
                        "aria-label": "设置待办范围",
                        title: "设置待办范围",
                        "aria-expanded": todoSettingsOpen,
                        "aria-controls": `pmwb-todo-scope-settings-${props.instanceId}`,
                        onClick: () =>
                          setTodoSettingsOpen((current) => !current),
                      },
                      ICONS.gear,
                    )
                  : null,
              )
            : isBrief
              ? h(
                  react.Fragment,
                  null,
                  briefAttentionCount > 0
                    ? h(
                        "span",
                        { className: "pmwb2-brief-needs" },
                        `${briefAttentionCount} 项需处理`,
                      )
                    : null,
                  briefProjects.length > 0
                    ? h(BriefProjectFilter, {
                        projects: briefProjects,
                        selected: effectiveBriefProjects,
                        onChange: setBriefSelectedProjects,
                      })
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
                        className: view === "unread" ? "active" : "",
                        "aria-pressed": view === "unread",
                        onClick: () => setView("unread"),
                      },
                      `未读 ${briefCounts.unread}`,
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: view === "all" ? "active" : "",
                        "aria-pressed": view === "all",
                        onClick: () => setView("all"),
                      },
                      `全部 ${briefCounts.all}`,
                    ),
                  ),
                )
              : null;

      react.useEffect(() => {
        props.onRuntime?.({
          status: state.status,
          updatedAt: state.payload?.updatedAt,
          source: state.payload?.source,
          titleActions,
          ...(isBrief
            ? {
                briefSettings: legacyPayload.data?.settings,
                ...(briefCoverageSuffix === ""
                  ? {}
                  : {
                      metaSuffix: briefCoverageSuffix,
                      metaSuffixTitle: briefCoverageSuffix,
                    }),
              }
            : {}),
        });
      }, [
        state.status,
        state.payload?.updatedAt,
        state.payload?.source,
        view,
        unreadCount,
        allCount,
        briefCounts.unread,
        briefCounts.all,
        briefAttentionCount,
        briefProjectsKey,
        briefSelectedProjects,
        briefCoverageSuffix,
        isBrief,
        followTick,
        aiLoadWindow,
        todoSettingsOpen,
      ]);

      if (state.status === "loading") {
        return h(
          "div",
          { className: "pmwb2-panel" },
          h("style", null, styles),
          h("div", { className: "pmwb2-skeleton" }),
          h("div", { className: "pmwb2-skeleton" }),
          h("div", { className: "pmwb2-skeleton" }),
        );
      }
      if (state.status === "error") {
        return h(
          "div",
          { className: "pmwb2-panel" },
          h("style", null, styles),
          h(
            "div",
            { className: "pmwb2-error" },
            h("span", null, state.error),
            h("button", { type: "button", onClick: () => void load() }, "重试"),
          ),
        );
      }
      const payload = state.payload;
      if (payload?.error) {
        return h(
          "div",
          { className: "pmwb2-panel" },
          h("style", null, styles),
          h("div", { className: "pmwb2-error" }, payload.error),
        );
      }
      const body =
        props.pluginId === "pluginmax.daily-brief"
          ? h(BriefBody, {
              payload: filteredBriefPayload,
              view,
              onDetail: async (item) => {
                if (item.readState !== "unread") return;
                try {
                  const result = await request(
                    "/api/collab/workbench/brief/read",
                    {
                      method: "POST",
                      body: JSON.stringify({
                        itemId: item.itemId,
                        tzOffset: TZ_OFFSET,
                      }),
                    },
                  );
                  setState({ status: "ready", payload: result.module });
                } catch {
                  // Detail remains available when read-state persistence fails.
                }
              },
              onAnalyze: async (item) => {
                if (item.readState === "unread") {
                  try {
                    const result = await request(
                      "/api/collab/workbench/brief/read",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          itemId: item.itemId,
                          tzOffset: TZ_OFFSET,
                        }),
                      },
                    );
                    setState({ status: "ready", payload: result.module });
                  } catch {
                    // Analysis remains available when read-state persistence fails.
                  }
                }
                openBriefItemInDataAgent(item);
              },
              onUnread: async (item) => {
                try {
                  const result = await request(
                    "/api/collab/workbench/brief/unread",
                    {
                      method: "POST",
                      body: JSON.stringify({
                        itemId: item.itemId,
                        tzOffset: TZ_OFFSET,
                      }),
                    },
                  );
                  setState({ status: "ready", payload: result.module });
                  window.dispatchEvent(
                    new CustomEvent("pluginmax:workbench-toast", {
                      detail: { message: "已标记为未读" },
                    }),
                  );
                } catch (error) {
                  window.dispatchEvent(
                    new CustomEvent("pluginmax:workbench-toast", {
                      detail: {
                        message: `标记未读失败：${error?.message ?? "未知错误"}`,
                      },
                    }),
                  );
                }
              },
              onOpen: async (item) => {
                if (item.readState === "unread") {
                  try {
                    const result = await request(
                      "/api/collab/workbench/brief/read",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          itemId: item.itemId,
                          tzOffset: TZ_OFFSET,
                        }),
                      },
                    );
                    setState({ status: "ready", payload: result.module });
                  } catch {
                    // Navigation remains available when read-state persistence fails.
                  }
                }
                navigateTo(item.deepLink);
              },
            })
          : props.pluginId === "pluginmax.kpi-overview"
            ? h(LegacyMetricsBody, { payload })
            : props.pluginId === "pluginmax.supply-exceptions"
              ? h(LegacyControlBody, { payload })
              : props.pluginId === "pluginmax.supplier-risk"
                ? h(LegacySupplierBody, { payload })
                : readable
                  ? h(LegacyReadableBody, {
                      pluginId: props.pluginId,
                      items: legacyItems,
                      read: (item) =>
                        read(
                          props.pluginId === "pluginmax.meeting-insights"
                            ? "meeting-minutes"
                            : props.pluginId === "pluginmax.following"
                              ? "focus"
                              : "todo",
                          item,
                        ),
                      view,
                      isRead: read,
                      markRead,
                      markUnread,
                    })
                  : h(NewPanelBody, {
                      pluginId: props.pluginId,
                      payload,
                      config: props.config,
                      windowKey: aiLoadWindow,
                    });
      return h(
        "div",
        { className: "pmwb2-panel", "data-plugin-id": props.pluginId },
        h("style", null, styles),
        props.pluginId === "pluginmax.task-focus" && todoSettingsOpen
          ? h(
              "div",
              {
                id: `pmwb-todo-scope-settings-${props.instanceId}`,
                className: "pmwb-todo-scope-settings",
              },
              h("span", null, "待办范围"),
              h(
                "div",
                {
                  className: "pmwb-seg",
                  role: "group",
                  "aria-label": "待办范围",
                },
                h(
                  "button",
                  {
                    type: "button",
                    className: todoScope === "me" ? "active" : "",
                    "aria-pressed": todoScope === "me",
                    onClick: () => {
                      setTodoScope("me");
                      saveTodoScope("me");
                    },
                  },
                  "我的",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: todoScope === "me_and_ai" ? "active" : "",
                    "aria-pressed": todoScope === "me_and_ai",
                    onClick: () => {
                      setTodoScope("me_and_ai");
                      saveTodoScope("me_and_ai");
                    },
                  },
                  "我和我的 AI 伙伴",
                ),
              ),
            )
          : null,
        state.status === "refreshing"
          ? h("div", { className: "pmwb2-skeleton" })
          : null,
        body,
      );
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      for (const [pluginId, label] of PANELS) {
        ctx.slots.inject("workbench.canvas.panel", () =>
          ctx.slots.register(
            {
              name: "workbench.canvas.panel",
              key: pluginId,
            },
            (props) =>
              h(PanelView, {
                ...props,
                pluginId,
                label,
              }),
          ),
        );
      }
    };

    return module.exports;
  },
});
