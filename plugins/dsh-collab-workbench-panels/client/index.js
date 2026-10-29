window.__ModuleLoader__.load({
  id: "dsh-collab-workbench-panels",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";
    const TZ_OFFSET = -new Date().getTimezoneOffset();

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

    const styles = `
.pmwb2-panel{display:grid;gap:9px;min-height:80px;color:var(--dsw-alias-label-primary);}
.pmwb2-panel *{box-sizing:border-box;}
.pmwb2-skeleton{height:16px;border-radius:5px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-2),var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2)),var(--dsw-alias-bg-layer-2));background-size:200% 100%;animation:pmwb2-shimmer 1.3s linear infinite;}
.pmwb2-skeleton:nth-child(2){width:82%;}.pmwb2-skeleton:nth-child(3){width:64%;}
@keyframes pmwb2-shimmer{to{background-position:-200% 0}}
.pmwb2-error{display:grid;gap:7px;padding:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 35%,transparent);border-radius:7px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:11px;line-height:1.5;}
.pmwb2-error button{justify-self:start;padding:3px 8px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer;}
.pmwb2-list{display:grid;gap:6px;}
.pmwb2-ai-load{display:grid;gap:8px;}
.pmwb2-ai-load-summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;}
.pmwb2-ai-load-summary strong{color:var(--dsw-alias-label-primary);font-size:11px;}
.pmwb2-ai-load-row{display:grid;grid-template-columns:minmax(118px,1.05fr) minmax(0,2fr);gap:9px;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-ai-load-person{display:flex;align-items:flex-start;gap:7px;min-width:0;}
.pmwb2-ai-load-person img,.pmwb2-ai-load-avatar{width:28px;height:28px;flex:none;border-radius:50%;object-fit:cover;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 18%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-accent-primary,#4f8ef7);display:grid;place-items:center;font-size:9px;font-weight:700;}
.pmwb2-ai-load-person strong{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;line-height:1.45;}
.pmwb2-ai-load-person small{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1.4;}
.pmwb2-ai-load-windows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;min-width:0;}
.pmwb2-ai-load-window{padding:6px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);}
.pmwb2-ai-load-window>strong{display:block;margin-bottom:4px;color:var(--dsw-alias-label-tertiary);font-size:8.5px;font-weight:650;}
.pmwb2-ai-load-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 6px;}
.pmwb2-ai-load-metrics span{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:8.5px;white-space:nowrap;}
.pmwb2-ai-load-metrics b{display:block;color:var(--dsw-alias-label-primary);font-size:10.5px;font-weight:650;}
.pmwb2-ai-load-blocker{grid-column:1/-1;padding:6px 8px;border-left:2px solid var(--dsw-alias-state-warning-primary,#e2a737);border-radius:0 5px 5px 0;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 9%,transparent);color:var(--dsw-alias-label-secondary);font-size:9px;line-height:1.45;}
.pmwb2-ai-load-blocker b{color:var(--dsw-alias-state-warning-primary,#e2a737);}
.pmwb2-ai-load-inactive{border:1px dashed var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmwb2-ai-load-inactive summary{padding:7px 9px;color:var(--dsw-alias-label-secondary);font-size:9.5px;cursor:pointer;}
.pmwb2-ai-load-inactive p{margin:0;padding:0 9px 8px;color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1.5;}
@media(max-width:640px){.pmwb2-ai-load-row{grid-template-columns:1fr;}.pmwb2-ai-load-windows{grid-template-columns:1fr;}}
.pmwb2-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 9px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-row strong{min-width:0;font-size:11.5px;line-height:1.45;overflow-wrap:anywhere;}
.pmwb2-row small{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.45;}
.pmwb2-row .pmwb2-row-note{grid-column:1/-1;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.5;}
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
.pmwb-item:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));}
.pmwb-item.read{opacity:1;}.pmwb-item.read:hover{opacity:1;}
.pmwb-item.meeting{grid-template-areas:"name actions" "meta time" "sub sub" "owner owner";}
.pmwb-item-name{grid-area:name;color:var(--dsw-alias-label-primary) !important;font-size:12.5px;font-weight:650;line-height:1.45;overflow-wrap:anywhere;}
.pmwb-item-id{grid-area:id;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;}
.pmwb-item-note{grid-area:note;min-width:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5;overflow-wrap:anywhere;}
.pmwb-note-status{color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.pmwb-note-status.accent{color:var(--dsw-alias-accent-primary,#4f8ef7);}.pmwb-note-status.warn{color:var(--dsw-alias-state-warning-primary,#e2a737);}.pmwb-note-status.ok{color:var(--dsw-alias-state-success-primary,#34d47e);}.pmwb-note-status.high{color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-note-divider{margin:0 4px;color:var(--dsw-alias-label-tertiary);}.pmwb-note-latest{color:var(--dsw-alias-label-secondary);}.pmwb-note-latest b{color:var(--dsw-alias-label-primary);font-weight:600;}
.pmwb-item-meta{grid-area:meta;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:var(--dsw-alias-label-secondary);}
.pmwb-item-owner{grid-area:owner;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:11px;}
.pmwb-item-trailing{grid-area:actions;display:flex;align-items:center;gap:6px;justify-self:end;flex-wrap:wrap;justify-content:flex-end;}
.pmwb-item-time{grid-area:time;justify-self:end;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;white-space:nowrap;}
.pmwb-item-sub{grid-area:sub;display:block;width:100%;margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;overflow-wrap:anywhere;}
.pmwb-item-sub b{color:var(--dsw-alias-label-primary);}.pmwb-item-sub.placeholder{color:var(--dsw-alias-label-tertiary);}
.pmwb-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:26px;padding:2px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap;}
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
.pmwb-metric{min-width:132px;flex:1 1 0;padding:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-metric-label{display:flex;align-items:center;gap:6px;justify-content:space-between;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
.pmwb-metric-trend{font-size:10.5px;font-weight:650;}.pmwb-metric-trend.up{color:var(--dsw-alias-state-success-primary,#3fb950);}.pmwb-metric-trend.down{color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-metric-value{margin-top:6px;font-size:22px;line-height:1.15;font-weight:650;letter-spacing:0;}.pmwb-metric-value small{margin-left:2px;font-size:11.5px;font-weight:500;color:var(--dsw-alias-label-secondary);}
.pmwb-metric-target{margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.5;}
.pmwb-spark{display:flex;align-items:flex-end;gap:2px;height:26px;margin-top:9px;}.pmwb-spark span{flex:1;min-width:2px;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,transparent);}.pmwb-spark span.strong{background:var(--dsw-alias-accent-primary,#4f8ef7);}.pmwb-spark span.warn{background:var(--dsw-alias-state-error-primary,#e5534b);}
.pmwb-severity{flex:none;display:grid;place-items:center;width:34px;min-height:24px;padding:2px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:650;}
.pmwb-severity.high{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);}.pmwb-severity.medium{color:var(--dsw-alias-state-warning-primary,#d29922);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d29922) 16%,transparent);}.pmwb-severity.watch{color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);}
.pmwb-control-item{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
.pmwb-control-item strong{display:block;font-size:12.5px;line-height:1.45;}.pmwb-control-item p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55;}.pmwb-control-item small{display:block;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
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
      if (typeof value !== "string" || value === "") return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "—";
      const pad = (number) => String(number).padStart(2, "0");
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function formatDate(value) {
      if (typeof value !== "string" || value.trim() === "") return "—";
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      return match ? `${match[2]}-${match[3]}` : formatTime(value);
    }

    function readStates() {
      try {
        const raw = JSON.parse(
          window.localStorage.getItem("dsh-workbench-read-state-v1") ?? "{}",
        );
        return raw !== null && typeof raw === "object" && !Array.isArray(raw)
          ? raw
          : {};
      } catch {
        return {};
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
        window.__pluginmaxPendingMeeting = {
          meetingId: link.refId,
          workspaceId: link.workspaceId ?? "",
        };
        window.__pluginmaxShell?.setRoute("meetings");
        window.dispatchEvent(
          new CustomEvent("pluginmax:collab-navigate", {
            detail: {
              plugin: "meeting",
              meetingId: link.refId,
              workspaceId: link.workspaceId ?? "",
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

    function renderOwnerRow(item, ctx, variant) {
      const isFocus = variant === "focus";
      const moduleId = isFocus ? "focus" : "todo";
      const read = ctx.isRead(moduleId, item);
      const openItem = () => {
        ctx.markRead(moduleId, item);
        navigateTo(item.deepLink);
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
      return h(
        "article",
        {
          key: item.id,
          className: `pmwb-item${isFocus ? " pmwb-item-focus" : ""}${read ? " read" : ""}`,
          role: "button",
          tabIndex: 0,
          onClick: openItem,
          onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openItem();
            }
          },
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
          navigateTo(item.deepLink);
        };
        return h(
          "article",
          {
            key: item.id,
            className: `pmwb-item meeting${read ? " read" : ""}`,
            role: "button",
            tabIndex: 0,
            onClick: openItem,
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openItem();
              }
            },
          },
          h("div", { className: "pmwb-item-name" }, item.title),
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
              item.title ?? item.name ?? item.summary ?? item.displayId ?? "未命名事项",
            ),
            h(
              "span",
              { className: `pmwb2-tag ${tagClass(item.statusLabel ?? item.status ?? item.level)}` },
              item.statusLabel ?? item.status ?? item.level ?? item.priorityLabel ?? "查看",
            ),
            h(
              "small",
              null,
              item.source ?? item.category ?? item.ownerName ?? item.role ?? "",
            ),
            item.note ?? item.description ?? item.summaryText ?? item.conclusion
              ? h(
                  "span",
                  { className: "pmwb2-row-note" },
                  item.note ?? item.description ?? item.summaryText ?? item.conclusion,
                )
              : null,
          ),
        ),
      );
    }

    function LegacyMetricsBody({ payload }) {
      const data = payload.data ?? {};
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
        { className: "pmwb-metrics" },
        ...items.map((metric) =>
          h(
            "article",
            {
              className: "pmwb-metric",
              key: metric.id,
              "data-metric-id": metric.id,
              "data-data-agent-title": `${metric.label} ${metric.value}${metric.unit ?? ""}`,
              "data-data-agent-excerpt": `${metric.target ?? ""} ${metric.trend ?? ""}`.trim(),
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

    function BriefBody({
      payload,
      view,
      expanded,
      textExpanded,
      onToggleSuggestion,
      onToggleText,
      onOpen,
    }) {
      const data = payload?.data ?? {};
      const items =
        view === "unread"
          ? (data.views?.unread ?? [])
          : (data.views?.all ?? []);
      return h(
        "div",
        { className: "pmwb-legacy" },
        items.length === 0
          ? h(
              "div",
              { className: "pmwb-empty" },
              view === "unread"
                ? "当前没有未读简报条目。"
                : "当前周期没有新增简报。",
            )
          : h(
              "ul",
              { className: "pmwb-brief-points" },
              ...items.map((item) => {
                const isExpanded = Boolean(expanded[item.itemId]);
                const isTextExpanded = Boolean(textExpanded[item.itemId]);
                const longText =
                  typeof item.conclusion === "string" &&
                  item.conclusion.length > 320;
                return h(
                  "li",
                  {
                    key: item.itemId,
                    className: `${item.tag}${item.readState === "read" ? " read" : ""}`,
                    role: "button",
                    tabIndex: 0,
                    onClick: () => onOpen(item),
                    onKeyDown: (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(item);
                      }
                    },
                  },
                  h(
                    "div",
                    { className: "pmwb-brief-copy" },
                    h("div", { className: "pmwb-brief-title" }, item.title),
                    item.conclusion
                      ? h(
                          "div",
                          {
                            className: `pmwb-brief-text${longText && !isTextExpanded ? " clamped" : ""}`,
                          },
                          renderBriefMarkdown(item.conclusion),
                        )
                      : null,
                    longText
                      ? h(
                          "button",
                          {
                            type: "button",
                            className: "pmwb-brief-more",
                            onClick: (event) => {
                              event.stopPropagation();
                              onToggleText(item.itemId);
                            },
                          },
                          isTextExpanded ? "收起" : "展开全文",
                        )
                      : null,
                    item.reason
                      ? h(
                          "div",
                          { className: "pmwb-brief-reason" },
                          item.reason,
                        )
                      : null,
                    item.suggestion && isExpanded
                      ? h(
                          "div",
                          { className: "pmwb-decision" },
                          h("strong", null, item.suggestion.headline),
                          item.suggestion.body,
                        )
                      : null,
                  ),
                  h(
                    "span",
                    { className: `pmwb-tag ${item.tag}` },
                    briefTagLabel(item.tag),
                  ),
                  h(
                    "div",
                    { className: "pmwb-brief-actions" },
                    item.suggestion
                      ? h(
                          "button",
                          {
                            type: "button",
                            className: "pmwb-btn",
                            onClick: (event) => {
                              event.stopPropagation();
                              onToggleSuggestion(item.itemId);
                            },
                          },
                          isExpanded ? "收起建议" : "AI建议",
                        )
                      : null,
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmwb-btn primary",
                        onClick: (event) => {
                          event.stopPropagation();
                          onOpen(item);
                        },
                      },
                      item.actionLabel || "查看明细",
                    ),
                  ),
                );
              }),
            ),
        h(
          "p",
          { className: "pmwb-brief-meta" },
          `离开窗口 ${formatTime(data.awayWindow?.from)} - ${formatTime(data.awayWindow?.to)} · 最近生成 ${formatTime(payload.updatedAt)}`,
        ),
      );
    }

    function formatTokenCount(value) {
      const count = Number(value ?? 0);
      if (!Number.isFinite(count) || count <= 0) return "0";
      if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
      if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
      return String(Math.round(count));
    }

    function workloadWindow(workload, label) {
      const stats = workload ?? {};
      return h(
        "div",
        { className: "pmwb2-ai-load-window" },
        h("strong", null, label),
        h(
          "div",
          { className: "pmwb2-ai-load-metrics" },
          h("span", null, "会议", h("b", null, stats.meetingCount ?? 0)),
          h("span", null, "任务", h("b", null, stats.taskCount ?? 0)),
          h(
            "span",
            null,
            "Token",
            h("b", null, formatTokenCount(stats.outputTokens)),
          ),
          h(
            "span",
            null,
            "运行",
            h(
              "b",
              null,
              `${Number(stats.runtimeHours ?? 0).toFixed(1)}h`,
            ),
          ),
        ),
      );
    }

    function AiPartnerLoadBody({ snapshot }) {
      const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
      const active = items.filter((item) => item.hasRunIn72h === true);
      const inactive = items.filter((item) => item.hasRunIn72h !== true);
      if (snapshot?.unavailable === true) {
        return h(
          "div",
          { className: "pmwb2-empty" },
          "AI伙伴运行数据暂不可用",
        );
      }
      return h(
        "div",
        { className: "pmwb2-ai-load" },
        h(
          "div",
          { className: "pmwb2-ai-load-summary" },
          h("strong", null, `${active.length} 个 AI伙伴有运行记录`),
          h(
            "span",
            null,
            active.some(
              (item) => (item.last72h?.blockedTaskCount ?? 0) > 0,
            )
              ? "存在阻塞"
              : "运行正常",
          ),
        ),
        active.length === 0
          ? h(
              "div",
              { className: "pmwb2-empty" },
              "过去 72 小时暂无 AI伙伴运行记录",
            )
          : null,
        ...active.map((item) =>
          h(
            "article",
            { className: "pmwb2-ai-load-row", key: item.teammateId },
            h(
              "div",
              { className: "pmwb2-ai-load-person" },
              /^data:image\//.test(item.avatar ?? "")
                ? h("img", { src: item.avatar, alt: "" })
                : h(
                    "span",
                    { className: "pmwb2-ai-load-avatar" },
                    String(item.name ?? "AI").slice(0, 1),
                  ),
              h(
                "div",
                { style: { minWidth: 0 } },
                h("strong", null, item.name ?? "AI伙伴"),
                h("small", null, item.role || "AI伙伴"),
                h(
                  "small",
                  null,
                  item.lastActivityAt
                    ? `最近运行 ${formatTime(item.lastActivityAt)}`
                    : "刚刚运行",
                ),
              ),
            ),
            h(
              "div",
              { className: "pmwb2-ai-load-windows" },
              workloadWindow(item.last24h, "过去 24 小时"),
              workloadWindow(item.last72h, "过去 72 小时"),
            ),
            ...(item.blockers ?? []).slice(0, 4).map((blocker) =>
              h(
                "div",
                {
                  className: "pmwb2-ai-load-blocker",
                  key: `${item.teammateId}-${blocker.taskId}`,
                },
                h("b", null, blocker.title),
                ` · ${blocker.reason} · ${formatTime(blocker.updatedAt)}`,
              ),
            ),
            (item.blockers?.length ?? 0) > 4
              ? h(
                  "div",
                  { className: "pmwb2-ai-load-blocker" },
                  `另有 ${item.blockers.length - 4} 个阻塞任务`,
                )
              : null,
          ),
        ),
        inactive.length > 0
          ? h(
              "details",
              { className: "pmwb2-ai-load-inactive" },
              h(
                "summary",
                null,
                `其余 ${inactive.length} 个 AI伙伴过去 72 小时无运行记录`,
              ),
              h("p", null, inactive.map((item) => item.name).join("、")),
            )
          : null,
      );
    }

    function NewPanelBody({ pluginId, payload }) {
      const items = payload?.data?.items ?? [];
      if (pluginId === "pluginmax.data-agent") {
        return h(
          "div",
          { className: "pmwb2-list" },
          h(
            "div",
            { className: "pmwb2-row" },
            h("strong", null, "Data Agent · 平台内置"),
            h("span", { className: "pmwb2-tag ok" }, "只读分析"),
            h(
              "small",
              null,
              payload?.data?.workspaceName ?? "当前工作区",
            ),
            h(
              "span",
              { className: "pmwb2-row-note" },
              `${payload?.data?.conversationCount ?? 0} 个会话 · ${payload?.data?.dataConnectionCount ?? 0} 个只读连接 · revision ${payload?.data?.configRevision ?? 1}`,
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmwb-btn",
                style: { gridColumn: "1/-1", justifySelf: "start" },
                onClick: () => window.__pluginmaxSidePanel?.openTab("data-agent"),
              },
              "打开 Data Agent",
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
              h("span", { className: `pmwb2-tag ${tagClass(item.status)}` }, item.status),
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
        return h(AiPartnerLoadBody, { snapshot: payload?.data ?? {} });
      }
      return h(GenericList, { items });
    }

    function LegacyReadableBody({ pluginId, items, read, view, onRead }) {
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
            isRead: read,
            markRead: onRead,
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
              isRead: read,
              markRead: onRead,
            },
            pluginId === "pluginmax.following" ? "focus" : "todo",
          ),
        ),
      );
    }

    function PanelView(props) {
      const [state, setState] = react.useState({ status: "loading" });
      const [view, setView] = react.useState("unread");
      const [currentUserId, setCurrentUserId] = react.useState("");
      const [readState, setReadState] = react.useState(readStates);
      const [followTick, setFollowTick] = react.useState(0);
      const [expanded, setExpanded] = react.useState({});
      const [briefTextExpanded, setBriefTextExpanded] = react.useState({});
      const load = react.useCallback(async () => {
        setState((previous) => ({
          status: previous.payload === undefined ? "loading" : "refreshing",
          ...(previous.payload === undefined ? {} : { payload: previous.payload }),
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
            const workspaceResult = await request("/api/collab/team/workspaces");
            const workspace =
              (workspaceResult.workspaces ?? []).find(
                (item) => item.isMember !== false,
              ) ?? null;
            if (workspace === null) {
              throw new Error("当前账号还没有可用项目");
            }
            const [bootstrap, conversations] = await Promise.all([
              request(
                `/api/collab/data-agent?workspaceId=${encodeURIComponent(workspace.id)}`,
              ),
              request(
                `/api/collab/data-agent/conversations?workspaceId=${encodeURIComponent(workspace.id)}`,
              ),
            ]);
            payload = {
              id: pluginId,
              pluginId,
              title: "Data Agent",
              updatedAt: bootstrap.workspaceConfig?.updatedAt,
              source: "live",
              refreshable: true,
              data: {
                workspaceName: workspace.title ?? workspace.path ?? workspace.id,
                conversationCount: conversations.conversations?.length ?? 0,
                configRevision: bootstrap.workspaceConfig?.revision ?? 1,
                dataConnectionCount:
                  bootstrap.workspaceConfig?.dataConnectionIds?.length ?? 0,
              },
            };
          } else if (legacy) {
            payload = (
              await request(
                `/api/collab/workbench/module?moduleId=${encodeURIComponent(legacy)}&tzOffset=${TZ_OFFSET}${scope}`,
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
      }, [props.pluginId]);

      react.useEffect(() => {
        void load();
        const refresh = (event) => {
          if (event?.detail?.instanceId === props.instanceId) void load();
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
        return followStore.subscribe(() =>
          setFollowTick((value) => value + 1),
        );
      }, []);

      const read = react.useCallback(
        (moduleId, item) =>
          currentUserId !== "" &&
          Boolean(readState[currentUserId]?.[moduleId]?.[itemSignature(item)]),
        [currentUserId, readState],
      );

      const markRead = react.useCallback(
        (moduleId, item) => {
          if (currentUserId === "") return;
          setReadState((previous) => {
            const signature = itemSignature(item);
            if (previous[currentUserId]?.[moduleId]?.[signature]) {
              return previous;
            }
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
            try {
              window.localStorage.setItem(
                "dsh-workbench-read-state-v1",
                JSON.stringify(next),
              );
            } catch {
              // Keep the in-memory read state when storage is unavailable.
            }
            window.dispatchEvent(
              new CustomEvent("pluginmax:workbench-toast", {
                detail: { message: "已标记为已读" },
              }),
            );
            return next;
          });
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
        (item) => !read(
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
      const briefCounts = {
        unread:
          legacyPayload.data?.unreadCount ??
          legacyPayload.data?.views?.unread?.length ??
          0,
        all: legacyPayload.data?.views?.all?.length ?? 0,
      };
      const titleActions = readable
        ? h(
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
          )
        : isBrief
          ? h(
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
            )
          : null;

      react.useEffect(() => {
        props.onRuntime?.({
          status: state.status,
          updatedAt: state.payload?.updatedAt,
          source: state.payload?.source,
          titleActions,
          ...(isBrief
            ? { briefSettings: legacyPayload.data?.settings }
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
        isBrief,
        followTick,
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
              payload,
              view,
              expanded,
              textExpanded: briefTextExpanded,
              onToggleSuggestion: (itemId) =>
                setExpanded((current) => ({
                  ...current,
                  [itemId]: !current[itemId],
                })),
              onToggleText: (itemId) =>
                setBriefTextExpanded((current) => ({
                  ...current,
                  [itemId]: !current[itemId],
                })),
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
                  onRead: (item) =>
                    markRead(
                      props.pluginId === "pluginmax.meeting-insights"
                        ? "meeting-minutes"
                        : props.pluginId === "pluginmax.following"
                          ? "focus"
                          : "todo",
                      item,
                    ),
                })
            : h(NewPanelBody, { pluginId: props.pluginId, payload });
      return h(
        "div",
        { className: "pmwb2-panel", "data-plugin-id": props.pluginId },
        h("style", null, styles),
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
