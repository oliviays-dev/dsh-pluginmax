window.__ModuleLoader__.load({
  id: "dsh-collab-workbench-v2",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";
    const PLUGIN_NAMES = {
      "pluginmax.kpi-overview": "核心指标",
      "pluginmax.daily-brief": "每日简报",
      "pluginmax.task-focus": "我的待办",
      "pluginmax.following": "重点关注",
      "pluginmax.meeting-insights": "会议纪要",
      "pluginmax.supply-exceptions": "供给例外",
      "pluginmax.supplier-risk": "供应商风险",
      "pluginmax.workflow-runs": "工作流运行",
      "pluginmax.team-load": "AI伙伴负载",
      "pluginmax.industry-radar": "行业雷达",
      "pluginmax.data-agent": "Data Agent",
    };

    const BRIEF_INCLUDE_OPTIONS = [
      ["run_terminal", "Agent 执行异常"],
      ["workflow_blocked", "工作流阻塞"],
      ["task_escalation", "任务逾期/升级"],
      ["task_nudge", "被催办"],
      ["workflow_approval", "审批等待"],
      ["task_review", "待我验收"],
    ];
    const DEFAULT_BRIEF_INCLUDE_TYPES = BRIEF_INCLUDE_OPTIONS.map(
      ([id]) => id,
    );
    const BRIEF_RULE_TEMPLATE = `请将同时满足以下条件的事项纳入每日简报：
1. 在本次 Brief 时间窗口内发生变化
2. 事项标题、结论或原因包含关键词：交付风险、验收、供应商
3. 仅纳入风险或升级类事项
请说明命中原因，并保留来源事项的详情链接。`;

    const ICONS = {
      plus: pathIcon("M12 5v14M5 12h14"),
      edit: pathIcon("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"),
      market: pathIcon("M3 9l2-5h14l2 5M4 9v11h16V9M9 20v-6h6v6"),
      refresh: pathIcon("M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"),
      meeting: pathIcon("M22 8l-6 4 6 4V8ZM2 6h14v12H2z"),
      close: pathIcon("M18 6 6 18M6 6l12 12"),
      trash: pathIcon("M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"),
      undo: pathIcon("M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6"),
      grip: pathIcon("M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"),
      gear: pathIcon(
        "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z",
      ),
      chevron: pathIcon("m6 9 6 6 6-6"),
      check: pathIcon("m5 12 4 4L19 6"),
      star: pathIcon("m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.1 6.4 20l1.2-6.2L3 9.5l6.3-.8L12 3Z"),
      grid: pathIcon("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"),
    };

    function pathIcon(path) {
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
.pmwb2{display:grid;gap:14px;min-height:100%;margin-top:-4px;color:var(--dsw-alias-label-primary);}
.pmwb2 *,.pmwb2 *::before,.pmwb2 *::after{box-sizing:border-box;}
.pmwb2-head{position:sticky;top:0;z-index:22;display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:-18px -20px 0;padding:14px 20px 12px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 94%,transparent);border-bottom:1px solid var(--dsw-alias-border-l2);backdrop-filter:blur(16px);}
.pmwb2-head-copy{min-width:0;}
.pmwb2-head h1{margin:0;overflow:hidden;text-overflow:ellipsis;font-size:22px;line-height:1.25;white-space:nowrap;}
.pmwb2-title-trigger{display:flex;align-items:center;gap:7px;max-width:min(430px,42vw);padding:0;border:0;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;}
.pmwb2-title-trigger h1{min-width:0;}
.pmwb2-title-trigger svg{width:15px;height:15px;flex:none;color:var(--dsw-alias-label-tertiary);}
.pmwb2-head p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5;}
.pmwb2-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
.pmwb2-scope{display:inline-flex;align-items:center;gap:2px;padding:2px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmwb2-scope button{height:24px;border:0;border-radius:6px;padding:0 8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
.pmwb2-scope button.active{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-btn,.pmwb2-iconbtn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:29px;padding:2px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap;}
.pmwb2-btn:hover:not(:disabled),.pmwb2-iconbtn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}
.pmwb2-btn.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:650;}
.pmwb2-btn.ghost{border-color:transparent;background:transparent;}
.pmwb2-btn:disabled,.pmwb2-iconbtn:disabled{opacity:.5;cursor:not-allowed;}
.pmwb2-iconbtn{width:29px;padding:0;}
.pmwb2-btn svg,.pmwb2-iconbtn svg{width:13px;height:13px;flex:none;}
.pmwb2-editbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 11px;border:1px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 32%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,var(--dsw-alias-bg-layer-1));}
.pmwb2-editbar strong{font-size:11.5px;}.pmwb2-editbar span{color:var(--dsw-alias-label-secondary);font-size:10.5px;}
.pmwb2-editbar-actions{display:flex;gap:5px;margin-left:auto;flex-wrap:wrap;}
.pmwb2-canvas{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;align-items:start;}
.pmwb2-card{position:relative;grid-column:span var(--cols,3);min-width:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
.pmwb2-card.dragging{opacity:.5;border-color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-card.edit{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 32%,var(--dsw-alias-border-l2));}
.pmwb2-card-head{display:grid;gap:7px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmwb2-card-head-main{display:flex;align-items:center;gap:8px;min-width:0;}
.pmwb2-card.edit .pmwb2-card-head{cursor:grab;}
.pmwb2-card-title{min-width:0;flex:1;}
.pmwb2-card-title strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:13px;white-space:nowrap;}
.pmwb2-card-title small{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmwb2-card-tools{display:flex;align-items:center;gap:4px;flex:none;min-width:0;}
.pmwb2-card-tools > button{width:25px;height:25px;display:grid;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
.pmwb2-card-tools > button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
.pmwb2-card-tools > button.danger:hover{color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 12%,transparent);}
.pmwb2-card-tools > button > svg{width:13px;height:13px;}
.pmwb2-card-tools > button.spinning > svg{animation:pmwb2-spin .9s linear infinite;}
@keyframes pmwb2-spin{to{transform:rotate(360deg);}}
.pmwb2-card-body{padding:12px;max-height:360px;overflow:auto;}
.pmwb2-grip{color:var(--dsw-alias-label-tertiary);}
.pmwb2-grip svg{width:13px;height:13px;}
.pmwb2-resize-width{position:absolute;top:0;right:0;bottom:20px;z-index:5;width:12px;cursor:ew-resize;touch-action:none;}
.pmwb2-resize-width::before{content:"";position:absolute;top:0;right:0;bottom:0;width:3px;background:var(--dsw-alias-accent-primary,#4f8ef7);opacity:.16;}
.pmwb2-resize-width:hover::before{opacity:.8;}
.pmwb2-resize-height{position:absolute;left:0;right:12px;bottom:0;z-index:5;height:12px;cursor:ns-resize;touch-action:none;}
.pmwb2-resize-height::before{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--dsw-alias-accent-primary,#4f8ef7);opacity:.16;}
.pmwb2-resize-height:hover::before{opacity:.8;}
.pmwb2-empty{display:grid;place-items:center;min-height:360px;padding:28px;border:1px dashed var(--dsw-alias-border-l3);border-radius:8px;text-align:center;}
.pmwb2-empty-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-empty-icon svg{width:22px;height:22px;}
.pmwb2-empty h2{margin:11px 0 0;font-size:16px;}.pmwb2-empty p{max-width:430px;margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;}
.pmwb2-empty-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin-top:14px;}
.pmwb2-fallback{padding:20px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;text-align:center;}
.pmwb2-loading{padding:30px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:12px;}
.pmwb2-error{padding:12px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 34%,transparent);border-radius:7px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:11.5px;line-height:1.55;}
.pmwb2-mask{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.48);}
.pmwb2-modal{width:min(560px,100%);max-height:min(80vh,720px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-base);box-shadow:0 24px 70px rgba(0,0,0,.36);}
.pmwb2-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmwb2-modal-head h2{margin:0;font-size:15px;}
.pmwb2-modal-body{min-height:0;overflow:auto;padding:14px 16px;}
.pmwb2-modal-foot{display:flex;justify-content:flex-end;gap:7px;padding:11px 16px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmwb2-field{display:grid;gap:5px;margin-bottom:11px;}
.pmwb2-field label,.pmwb2-label{color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:600;}
.pmwb2-input,.pmwb2-select{width:100%;min-height:32px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;}
.pmwb2-textarea{width:100%;min-height:92px;resize:vertical;padding:8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:1.6;}
.pmwb2-field-hint{margin:0;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.55;}
.pmwb2-form-section{display:grid;gap:9px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmwb2-form-section:last-child{margin-bottom:0;padding-bottom:0;border-bottom:0;}
.pmwb2-section-title{margin:0;font-size:11.5px;line-height:1.45;}
.pmwb2-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
.pmwb2-check{display:flex;align-items:center;gap:7px;min-width:0;padding:7px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10.5px;cursor:pointer;}
.pmwb2-check input{width:14px;height:14px;flex:none;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-brief-rule-list{display:grid;gap:8px;}
.pmwb2-brief-rule{display:grid;gap:8px;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmwb2-brief-rule-head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:7px;}
.pmwb2-brief-rule-head .pmwb2-input{min-width:0;}
.pmwb2-inline-check{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:10px;white-space:nowrap;}
.pmwb2-inline-check input{accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-add-rule{justify-self:start;}
.pmwb2-seg{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmwb2-seg button{min-height:25px;padding:2px 9px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer;}
.pmwb2-seg button.active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-weight:650;}
.pmwb2-list{display:grid;gap:7px;}
.pmwb2-list-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmwb2-list-row strong{min-width:0;font-size:11.5px;}.pmwb2-list-row small{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.45;}
.pmwb2-name-row{display:flex;align-items:center;gap:5px;min-width:0;}
.pmwb2-name-row strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmwb2-star{width:22px;height:22px;flex:none;display:grid;place-items:center;color:var(--dsw-alias-state-warning-primary,#e2a737);}
.pmwb2-star svg{width:13px;height:13px;}
.pmwb2-list-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;}
.pmwb2-list-actions .pmwb2-btn{min-height:24px;padding:1px 7px;font-size:10px;}
.pmwb2-starter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
.pmwb2-starter{display:grid;gap:5px;min-height:95px;padding:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;}
.pmwb2-starter.active{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,var(--dsw-alias-bg-layer-1));}
.pmwb2-starter strong{font-size:11.5px;}.pmwb2-starter span{color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.5;}
.pmwb2-switcher{position:fixed;z-index:68;width:310px;max-width:calc(100vw - 24px);max-height:min(80vh,560px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l3);border-radius:9px;background:var(--dsw-alias-bg-base);box-shadow:0 20px 52px rgba(0,0,0,.34);}
.pmwb2-switcher-list{min-height:0;overflow:auto;padding:7px;}
.pmwb2-switcher-item{width:100%;display:grid;grid-template-columns:28px minmax(0,1fr) 16px;gap:8px;align-items:center;padding:8px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
.pmwb2-switcher-item:hover,.pmwb2-switcher-item.active{background:var(--dsw-alias-bg-layer-2);}
.pmwb2-switcher-mark{width:28px;height:28px;display:grid;place-items:center;border-radius:7px;background:color-mix(in srgb,var(--wb-color,#3f6ef3) 18%,var(--dsw-alias-bg-layer-1));color:var(--wb-color,#3f6ef3);}
.pmwb2-switcher-item strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:11px;white-space:nowrap;}.pmwb2-switcher-item small{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
.pmwb2-drawer{position:fixed;top:0;right:0;bottom:0;z-index:68;width:min(360px,92vw);display:flex;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);box-shadow:-18px 0 50px rgba(0,0,0,.24);}
.pmwb2-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmwb2-drawer-body{min-height:0;flex:1;overflow:auto;padding:12px;}
.pmwb2-plugin-hint{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.5;}
.pmwb2-plugin-card{display:grid;gap:9px;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmwb2-plugin-card-top{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px;}
.pmwb2-plugin-card-copy{min-width:0;}
.pmwb2-plugin-card-copy strong{display:block;font-size:11.5px;}
.pmwb2-plugin-card-copy small{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.45;}
.pmwb2-plugin-actions{display:grid;justify-items:end;gap:5px;}
.pmwb2-plugin-status{padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:8.5px;white-space:nowrap;}
.pmwb2-plugin-status.enabled{color:var(--dsw-alias-state-success-primary,#34d47e);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 12%,transparent);}
.pmwb2-plugin-status.warn{color:var(--dsw-alias-state-warning-primary,#e2a737);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 12%,transparent);}
.pmwb2-plugin-preview{display:grid;gap:6px;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);}
.pmwb2-preview-label{display:flex;align-items:center;justify-content:space-between;color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
.pmwb2-preview-badge{padding:1px 5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);}
.pmwb2-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;}
.pmwb2-preview-cell{padding:6px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);}
.pmwb2-preview-cell span{display:block;color:var(--dsw-alias-label-tertiary);font-size:8px;}
.pmwb2-preview-cell strong{display:block;margin-top:2px;font-size:13px;}
.pmwb2-preview-row{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);font-size:9px;}
.pmwb2-preview-row b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;}
.pmwb2-preview-row span{flex:none;color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
.pmwb2-preview-copy{color:var(--dsw-alias-label-secondary);font-size:9px;line-height:1.5;}
.pmwb2-preview-bars{display:grid;gap:5px;}
.pmwb2-preview-load{display:grid;grid-template-columns:54px minmax(0,1fr) 24px;align-items:center;gap:5px;font-size:8.5px;color:var(--dsw-alias-label-secondary);}
.pmwb2-preview-load i{height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;}
.pmwb2-preview-load i span{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-preview-progress{height:3px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;}
.pmwb2-preview-progress span{display:block;height:100%;background:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmwb2-toast{position:fixed;left:50%;bottom:28px;z-index:90;transform:translateX(-50%);padding:8px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 12px 30px rgba(0,0,0,.24);color:var(--dsw-alias-label-primary);font-size:11.5px;}
@media(max-width:900px){.pmwb2-canvas{grid-template-columns:repeat(2,minmax(0,1fr));}.pmwb2-card{grid-column:span min(var(--cols,2),2);}}
@media(max-width:640px){.pmwb2-canvas{grid-template-columns:1fr;}.pmwb2-card{grid-column:span 1;}.pmwb2-head h1{white-space:normal;}.pmwb2-actions{width:100%;justify-content:flex-start;}.pmwb2-starter-grid{grid-template-columns:1fr;}.pmwb2-head{margin:-14px -14px 0;padding:12px 14px;}.pmwb2-card-body{max-height:none;}}
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

    function actionKey(prefix) {
      const suffix =
        typeof window.crypto?.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return `${prefix}:${suffix}`;
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function visibilityLabel(value) {
      return value === "team" ? "团队可见" : "仅自己";
    }

    function formatTime(value) {
      if (!value) return "刚刚";
      return new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function toLocalDateTime(value) {
      const date = value ? new Date(value) : new Date(Date.now() - 3_600_000);
      if (!Number.isFinite(date.getTime())) return "";
      const local = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
      );
      return local.toISOString().slice(0, 16);
    }

    function toIsoDateTime(value) {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : "";
    }

    function briefRuleId() {
      return typeof window.crypto?.randomUUID === "function"
        ? `brief-rule-${window.crypto.randomUUID()}`
        : `brief-rule-${Date.now().toString(36)}`;
    }

    function defaultBriefSettings() {
      return {
        mode: "lastLeave",
        manualWindowFrom: "",
        includeTypes: [...DEFAULT_BRIEF_INCLUDE_TYPES],
        customRules: [],
      };
    }

    function navigate(route) {
      window.dispatchEvent(
        new CustomEvent("pluginmax:navigate", { detail: { route } }),
      );
    }

    function WorkbenchSwitcher({
      workbenches,
      activeId,
      anchor,
      onSwitch,
    }) {
      const position = anchor
        ? {
            left: `${Math.max(12, anchor.left)}px`,
            top: `${Math.min(window.innerHeight - 260, anchor.bottom + 8)}px`,
          }
        : { left: "12px", top: "80px" };
      return h(
        "section",
        {
          className: "pmwb2-switcher",
          style: position,
          "aria-label": "切换工作台",
          "data-workbench-switcher": "true",
        },
        h(
          "div",
          { className: "pmwb2-switcher-list" },
          ...workbenches.map((workbench) =>
            h(
              "button",
              {
                type: "button",
                key: workbench.id,
                className: `pmwb2-switcher-item${workbench.id === activeId ? " active" : ""}`,
                onClick: () => onSwitch(workbench.id),
              },
              h(
                "span",
                {
                  className: "pmwb2-switcher-mark",
                  style: { "--wb-color": workbench.color },
                },
                ICONS.grid,
              ),
              h(
                "span",
                null,
                h("strong", null, workbench.name),
                h(
                  "small",
                  null,
                  `${visibilityLabel(workbench.visibility)} · ${workbench.panels.length} 个插件 · 更新 ${formatTime(workbench.updatedAt)}`,
                ),
              ),
              workbench.id === activeId ? ICONS.check : null,
            ),
          ),
        ),
      );
    }

    function PreviewRow({ title, value }) {
      return h(
        "div",
        { className: "pmwb2-preview-row" },
        h("b", null, title),
        h("span", null, value),
      );
    }

    function PluginPreview({ pluginId }) {
      let body = null;
      switch (pluginId) {
        case "pluginmax.daily-brief":
          body = h(
            react.Fragment,
            null,
            h(
              "div",
              { className: "pmwb2-preview-copy" },
              "今天有 3 件事会影响交付承诺",
            ),
            h(PreviewRow, { title: "关键连接器缺料", value: "风险" }),
            h(PreviewRow, { title: "客户验收窗口提前", value: "待决策" }),
            h(PreviewRow, { title: "供应商加急排产", value: "进展" }),
          );
          break;
        case "pluginmax.task-focus":
          body = h(
            react.Fragment,
            null,
            h(PreviewRow, { title: "确认替代供应商质检窗口", value: "P0 · 今天" }),
            h(PreviewRow, { title: "回复客户验收范围", value: "P1 · 今天" }),
            h(PreviewRow, { title: "补齐供应商例会材料", value: "P2 · 明天" }),
          );
          break;
        case "pluginmax.kpi-overview":
          body = h(
            "div",
            { className: "pmwb2-preview-grid" },
            ...[
              ["OTIF", "96.4%"],
              ["库存天数", "18.2天"],
              ["准时交付", "93.7%"],
              ["风险指数", "2.6"],
            ].map(([label, value]) =>
              h(
                "div",
                { className: "pmwb2-preview-cell", key: label },
                h("span", null, label),
                h("strong", null, value),
              ),
            ),
          );
          break;
        case "pluginmax.following":
          body = h(
            react.Fragment,
            null,
            h(PreviewRow, { title: "华南仓缺料处置闭环", value: "工作流" }),
            h(PreviewRow, { title: "供应商 B 产能恢复", value: "进行中" }),
            h(PreviewRow, { title: "Q4 采购价格复盘", value: "关注" }),
          );
          break;
        case "pluginmax.meeting-insights":
          body = h(
            react.Fragment,
            null,
            h("div", { className: "pmwb2-preview-copy" }, "供应商协同会 · 核心结论"),
            h(PreviewRow, { title: "加急排产与到仓窗口", value: "已确认" }),
            h(PreviewRow, { title: "8D 报告复核责任人", value: "待确认" }),
            h(PreviewRow, { title: "同步客户验收范围", value: "下一步" }),
          );
          break;
        case "pluginmax.supply-exceptions":
          body = h(
            react.Fragment,
            null,
            h(PreviewRow, { title: "关键连接器缺料", value: "高 · 88" }),
            h(PreviewRow, { title: "供应商 B 质量复核", value: "高 · 82" }),
            h(PreviewRow, { title: "替代产能价格上浮", value: "中 · 58" }),
          );
          break;
        case "pluginmax.supplier-risk":
          body = h(
            react.Fragment,
            null,
            h(PreviewRow, { title: "苏州汇川 · 产能受限", value: "72" }),
            h(PreviewRow, { title: "宁波精工 · 交付波动", value: "watch" }),
          );
          break;
        case "pluginmax.workflow-runs":
          body = h(
            "div",
            { className: "pmwb2-preview-bars" },
            ...[
              ["缺料处置", 67],
              ["验收准备", 42],
              ["质量复核", 28],
            ].map(([label, value]) =>
              h(
                "div",
                { className: "pmwb2-preview-cell", key: label },
                h(
                  "span",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                    },
                  },
                  h("b", null, label),
                  h("i", null, `${value}%`),
                ),
                h(
                  "div",
                  { className: "pmwb2-preview-progress" },
                  h("span", { style: { width: `${value}%` } }),
                ),
              ),
            ),
          );
          break;
        case "pluginmax.team-load":
          body = h(
            "div",
            { className: "pmwb2-preview-bars" },
            ...[
              ["会议", 12],
              ["任务", 28],
              ["Token", 64],
              ["阻塞", 2],
            ].map(([label, value]) =>
              h(
                "div",
                { className: "pmwb2-preview-load", key: label },
                h("span", null, label),
                h("i", null, h("span", { style: { width: `${value}%` } })),
                h("b", null, `${value}%`),
              ),
            ),
          );
          break;
        case "pluginmax.industry-radar":
          body = h(
            react.Fragment,
            null,
            h(PreviewRow, { title: "连接器现货价格连续上行", value: "中影响" }),
            h(PreviewRow, { title: "区域仓新增临时运力", value: "机会" }),
            h(PreviewRow, { title: "竞品缩短交付承诺", value: "竞品" }),
          );
          break;
        default:
          body = h(
            "div",
            { className: "pmwb2-preview-copy" },
            "该插件已提供标准能力预览。",
          );
      }
      return h(
        "div",
        { className: "pmwb2-plugin-preview" },
        h(
          "div",
          { className: "pmwb2-preview-label" },
          h("span", null, "示例预览"),
          h("span", { className: "pmwb2-preview-badge" }, "Sample"),
        ),
        body,
      );
    }

    function WorkbenchPage(props) {
      const [phase, setPhase] = react.useState("loading");
      const [workbenches, setWorkbenches] = react.useState([]);
      const [preference, setPreference] = react.useState(null);
      const [error, setError] = react.useState("");
      const [editing, setEditing] = react.useState(false);
      const [dirty, setDirty] = react.useState(false);
      const [draftPanels, setDraftPanels] = react.useState([]);
      const [history, setHistory] = react.useState([]);
      const [switcherOpen, setSwitcherOpen] = react.useState(false);
      const [switcherAnchor, setSwitcherAnchor] = react.useState(null);
      const [createOpen, setCreateOpen] = react.useState(false);
      const [starter, setStarter] = react.useState("blank");
      const [createName, setCreateName] = react.useState("");
      const [copySourceId, setCopySourceId] = react.useState("");
      const [createVisibility, setCreateVisibility] = react.useState("private");
      const [createWorkspaceId, setCreateWorkspaceId] = react.useState("");
      const [workspaces, setWorkspaces] = react.useState([]);
      const [currentUserId, setCurrentUserId] = react.useState("");
      const [currentRole, setCurrentRole] = react.useState(null);
      const [scopeAll, setScopeAll] = react.useState(false);
      const [meetingOpen, setMeetingOpen] = react.useState(false);
      const [runtimeMeta, setRuntimeMeta] = react.useState({});
      const [managerOpen, setManagerOpen] = react.useState(false);
      const [renameTarget, setRenameTarget] = react.useState(null);
      const [renameValue, setRenameValue] = react.useState("");
      const [libraryOpen, setLibraryOpen] = react.useState(false);
      const [plugins, setPlugins] = react.useState([]);
      const [pluginQuery, setPluginQuery] = react.useState("");
      const [panelSettings, setPanelSettings] = react.useState(null);
      const [briefSettings, setBriefSettings] = react.useState(null);
      const [leavePrompt, setLeavePrompt] = react.useState(null);
      const [busy, setBusy] = react.useState(false);
      const [toast, setToast] = react.useState("");
      const leaveResolver = react.useRef(null);
      const toastTimer = react.useRef(0);
      const dragId = react.useRef("");
      const resizeRef = react.useRef(null);

      const active =
        workbenches.find((item) => item.id === preference?.activeWorkbenchId) ??
        workbenches[0];
      const copySource =
        workbenches.find((item) => item.id === copySourceId) ?? active;
      const panels = editing ? draftPanels : active?.panels ?? [];

      const showToast = react.useCallback((message) => {
        setToast(message);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(""), 2400);
      }, []);

      const load = react.useCallback(async () => {
        setPhase("loading");
        try {
          const result = await request("/api/collab/workbenches");
          setWorkbenches(result.workbenches ?? []);
          setPreference(result.preference ?? null);
          setError("");
          setPhase("ready");
        } catch (cause) {
          setError(cause.message);
          setPhase("error");
        }
      }, []);

      react.useEffect(() => {
        void load();
      }, [load]);

      react.useEffect(() => {
        void request("/api/collab/auth/me")
          .then((result) => {
            setCurrentUserId(result?.user?.id ?? "");
            setCurrentRole(result?.user?.role ?? null);
          })
          .catch(() => {
            setCurrentUserId("");
            setCurrentRole(null);
          });
        void request("/api/collab/team/workspaces")
          .then((result) => {
            const memberships = (result?.workspaces ?? []).filter(
              (workspace) => workspace.isMember,
            );
            setWorkspaces(memberships);
            setCreateWorkspaceId((current) => current || memberships[0]?.id || "");
          })
          .catch(() => setWorkspaces([]));
      }, []);

      react.useEffect(() => {
        const scope = window.__pluginmaxScope;
        if (scope === undefined) return undefined;
        setScopeAll(scope.getSnapshot());
        return scope.subscribe(() => setScopeAll(scope.getSnapshot()));
      }, []);

      react.useEffect(() => {
        const meeting = window.__pluginmaxMeeting;
        if (meeting === undefined) return undefined;
        setMeetingOpen(Boolean(meeting.open));
        return meeting.subscribe((open) => setMeetingOpen(Boolean(open)));
      }, []);

      const commit = react.useCallback(
        (nextPanels) => {
          setDraftPanels((previous) => {
            setHistory((items) => [...items.slice(-19), clone(previous)]);
            setDirty(true);
            return nextPanels.map((panel, index) => ({ ...panel, order: index }));
          });
        },
        [],
      );

      const startEdit = () => {
        if (active === undefined) return;
        setDraftPanels(clone(active.panels));
        setHistory([]);
        setEditing(true);
        setDirty(false);
      };

      const undo = () => {
        setHistory((items) => {
          if (items.length === 0) return items;
          const previous = items[items.length - 1];
          setDraftPanels(previous);
          setDirty(true);
          return items.slice(0, -1);
        });
      };

      const resetDraft = () => {
        if (active === undefined) return;
        setDraftPanels(clone(active.panels));
        setHistory([]);
        setDirty(false);
        showToast("已重置到最近保存版本");
      };

      const cancelEdit = () => {
        if (dirty) {
          setLeavePrompt({
            title: "放弃未保存修改？",
            message: "当前工作台的布局修改尚未保存。",
            confirm: "放弃修改",
            action: "cancel-edit",
          });
          return;
        }
        setEditing(false);
        setDraftPanels([]);
      };

      const saveEdit = async (leaveAfter = false) => {
        if (active === undefined) return;
        setBusy(true);
        try {
          const result = await request("/api/collab/workbenches/draft", {
            method: "PUT",
            body: JSON.stringify({
              workbenchId: active.id,
              expectedRevision: active.revision,
              panels: draftPanels,
            }),
          });
          setWorkbenches((items) =>
            items.map((item) =>
              item.id === result.workbench.id ? result.workbench : item,
            ),
          );
          setEditing(false);
          setDirty(false);
          setHistory([]);
          showToast("布局已保存");
          if (leaveAfter) {
            leaveResolver.current?.(true);
            leaveResolver.current = null;
            setLeavePrompt(null);
          }
        } catch (cause) {
          showToast(`保存失败：${cause.message}`);
          if (leaveAfter) {
            leaveResolver.current?.(false);
            leaveResolver.current = null;
            setLeavePrompt(null);
          }
        } finally {
          setBusy(false);
        }
      };

      react.useEffect(() => {
        const guard = () =>
          new Promise((resolve) => {
            if (!editing || !dirty) {
              resolve(true);
              return;
            }
            leaveResolver.current = resolve;
            setLeavePrompt({
              title: "离开当前工作台？",
              message: "当前布局尚未保存。保存后离开，或放弃本次修改。",
              action: "navigate",
            });
          });
        window.__pluginmaxWorkbenchV2Guard = guard;
        return () => {
          if (window.__pluginmaxWorkbenchV2Guard === guard) {
            delete window.__pluginmaxWorkbenchV2Guard;
          }
        };
      }, [editing, dirty]);

      react.useEffect(() => {
        if (!switcherOpen) return undefined;
        const closeOnOutside = (event) => {
          if (
            event.target.closest?.("[data-workbench-switcher]") ||
            event.target.closest?.("[data-workbench-switcher-trigger]")
          ) {
            return;
          }
          setSwitcherOpen(false);
        };
        const closeOnEscape = (event) => {
          if (event.key === "Escape") setSwitcherOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutside, true);
        window.addEventListener("keydown", closeOnEscape);
        return () => {
          document.removeEventListener("pointerdown", closeOnOutside, true);
          window.removeEventListener("keydown", closeOnEscape);
        };
      }, [switcherOpen]);

      const switchWorkbench = async (id) => {
        if (id === active?.id) {
          setSwitcherOpen(false);
          return;
        }
        if (editing && dirty) {
          showToast("请先保存或取消当前编辑");
          return;
        }
        setBusy(true);
        try {
          const result = await request("/api/collab/workbenches/preference", {
            method: "PUT",
            body: JSON.stringify({ activeWorkbenchId: id }),
          });
          setPreference(result.preference);
          setSwitcherOpen(false);
          showToast("已切换工作台");
        } catch (cause) {
          showToast(`切换失败：${cause.message}`);
        } finally {
          setBusy(false);
        }
      };

      const createWorkbench = async () => {
        if (createName.trim() === "") {
          showToast("请输入工作台名称");
          return;
        }
        if (createVisibility === "team" && createWorkspaceId === "") {
          showToast("请选择要共享的工作区");
          return;
        }
        setBusy(true);
        try {
          await request("/api/collab/workbenches", {
            method: "POST",
            body: JSON.stringify({
              name: createName.trim(),
              visibility: createVisibility,
              sharedWorkspaceIds:
                createVisibility === "team" && createWorkspaceId !== ""
                  ? [createWorkspaceId]
                  : [],
              ...(starter === "copy" && copySource !== undefined
                ? {
                    description: copySource.description,
                    icon: copySource.icon,
                    color: copySource.color,
                    panels: copySource.panels,
                  }
                : {}),
            }),
          });
          const listing = await request("/api/collab/workbenches");
          setWorkbenches(listing.workbenches ?? []);
          setPreference(listing.preference ?? null);
          setCreateOpen(false);
          setCreateName("");
          showToast(starter === "copy" ? "已复制工作台" : "工作台已创建");
        } catch (cause) {
          showToast(`创建失败：${cause.message}`);
        } finally {
          setBusy(false);
        }
      };

      const updatePreference = async (patch) => {
        try {
          const result = await request("/api/collab/workbenches/preference", {
            method: "PUT",
            body: JSON.stringify(patch),
          });
          setPreference(result.preference);
          return true;
        } catch (cause) {
          showToast(cause.message);
          return false;
        }
      };

      const renameWorkbench = async () => {
        if (renameTarget === null || renameValue.trim() === "") return;
        try {
          const result = await request("/api/collab/workbenches/update", {
            method: "PATCH",
            body: JSON.stringify({
              workbenchId: renameTarget,
              name: renameValue.trim(),
            }),
          });
          setWorkbenches((items) =>
            items.map((item) =>
              item.id === result.workbench.id ? result.workbench : item,
            ),
          );
          setRenameTarget(null);
          showToast("名称已更新");
        } catch (cause) {
          showToast(cause.message);
        }
      };

      const duplicateWorkbench = async (id) => {
        try {
          await request("/api/collab/workbenches/duplicate", {
            method: "POST",
            body: JSON.stringify({ workbenchId: id }),
          });
          const listing = await request("/api/collab/workbenches");
          setWorkbenches(listing.workbenches ?? []);
          setPreference(listing.preference ?? null);
          showToast("已复制工作台");
        } catch (cause) {
          showToast(cause.message);
        }
      };

      const deleteWorkbench = async (id) => {
        const target = workbenches.find((item) => item.id === id);
        if (!window.confirm(`删除工作台「${target?.name ?? ""}」？此操作不可撤销。`)) {
          return;
        }
        try {
          const result = await request("/api/collab/workbenches/delete", {
            method: "POST",
            body: JSON.stringify({ workbenchId: id }),
          });
          setWorkbenches(result.workbenches ?? []);
          setPreference(result.preference ?? null);
          showToast("工作台已删除");
        } catch (cause) {
          showToast(cause.message);
        }
      };

      const openLibrary = async () => {
        setLibraryOpen(true);
        try {
          const result = await request("/api/collab/workbench-market/plugins");
          setPlugins(result.plugins ?? []);
        } catch (cause) {
          showToast(cause.message);
        }
      };

      const addPlugin = async (plugin) => {
        if (active === undefined || busy) return;
        if (active.ownerId !== currentUserId) {
          showToast("只读工作台不能添加面板，请先复制");
          return;
        }
        setBusy(true);
        try {
          if (
            ["not_packaged", "disabled", "incompatible"].includes(
              plugin.status,
            )
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
          const result = await request("/api/collab/workbenches/panels", {
            method: "POST",
            headers: {
              "idempotency-key": actionKey(`panel-${plugin.id}`),
            },
            body: JSON.stringify({
              workbenchId: active.id,
              expectedRevision: active.revision,
              pluginId: plugin.id,
              pluginVersion: plugin.version,
              span: plugin.defaultSpan,
            }),
          });
          setWorkbenches((items) =>
            items.map((item) =>
              item.id === result.workbench.id ? result.workbench : item,
            ),
          );
          if (editing) {
            const existingIds = new Set(
              (active?.panels ?? []).map((panel) => panel.id),
            );
            const addedPanels = result.workbench.panels.filter(
              (panel) => !existingIds.has(panel.id),
            );
            if (addedPanels.length > 0) {
              setDraftPanels((current) => [
                ...current,
                ...addedPanels,
              ].map((panel, index) => ({ ...panel, order: index })));
              setHistory((current) => [
                ...current.slice(-19),
                clone(draftPanels),
              ]);
              setDirty(true);
              window.requestAnimationFrame(() => {
                document
                  .querySelector(
                    `[data-panel-instance-id="${addedPanels[0]?.id ?? ""}"]`,
                  )
                  ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              });
            }
          }
          setPlugins((items) =>
            items.map((item) =>
              item.id === plugin.id ? { ...item, status: "enabled" } : item,
            ),
          );
          setLibraryOpen(false);
          showToast(`已添加「${plugin.name}」`);
        } catch (cause) {
          showToast(`添加失败：${cause.message}`);
        } finally {
          setBusy(false);
        }
      };

      const removePanel = (panelId) => {
        const panel = draftPanels.find((item) => item.id === panelId);
        if (!window.confirm(`移除「${panel?.title ?? "该面板"}」？`)) return;
        commit(draftPanels.filter((item) => item.id !== panelId));
      };

      const reportRuntime = react.useCallback((instanceId, meta) => {
        setRuntimeMeta((previous) => ({
          ...previous,
          [instanceId]: { ...previous[instanceId], ...meta },
        }));
      }, []);

      const openPanelSettings = (panel) => {
        if (panel.pluginId !== "pluginmax.daily-brief") {
          setPanelSettings({
            id: panel.id,
            title: panel.title || pluginName(plugins, panel.pluginId),
            span: panel.span,
          });
          return;
        }
        const current =
          runtimeMeta[panel.id]?.briefSettings ?? defaultBriefSettings();
        setBriefSettings({
          instanceId: panel.id,
          title: panel.title || pluginName(plugins, panel.pluginId),
          mode: current.mode ?? "lastLeave",
          manualWindowFrom: toLocalDateTime(current.manualWindowFrom),
          includeTypes:
            current.includeTypes?.length > 0
              ? [...current.includeTypes]
              : [...DEFAULT_BRIEF_INCLUDE_TYPES],
          customRules: clone(current.customRules ?? []),
        });
      };

      const toggleBriefIncludeType = (type) => {
        setBriefSettings((current) => {
          if (current === null) return current;
          const selected = current.includeTypes.includes(type);
          if (selected && current.includeTypes.length === 1) return current;
          return {
            ...current,
            includeTypes: selected
              ? current.includeTypes.filter((item) => item !== type)
              : [...current.includeTypes, type],
          };
        });
      };

      const updateBriefRule = (ruleId, patch) => {
        setBriefSettings((current) =>
          current === null
            ? current
            : {
                ...current,
                customRules: current.customRules.map((rule) =>
                  rule.id === ruleId ? { ...rule, ...patch } : rule,
                ),
              },
        );
      };

      const addBriefRule = () => {
        setBriefSettings((current) => {
          if (current === null) return current;
          return {
            ...current,
            customRules: [
              ...current.customRules,
              {
                id: briefRuleId(),
                name: `自定义 Brief 项 ${current.customRules.length + 1}`,
                prompt: BRIEF_RULE_TEMPLATE,
                enabled: true,
              },
            ],
          };
        });
      };

      const removeBriefRule = (ruleId) => {
        setBriefSettings((current) =>
          current === null
            ? current
            : {
                ...current,
                customRules: current.customRules.filter(
                  (rule) => rule.id !== ruleId,
                ),
              },
        );
      };

      const saveBriefSettings = async () => {
        if (briefSettings === null) return;
        if (briefSettings.includeTypes.length === 0) {
          showToast("请至少选择一种纳入 Brief 的类型");
          return;
        }
        const manualWindowFrom =
          briefSettings.mode === "manual"
            ? toIsoDateTime(briefSettings.manualWindowFrom)
            : "";
        if (briefSettings.mode === "manual" && manualWindowFrom === "") {
          showToast("请选择 Brief 时间窗口的起点");
          return;
        }
        const invalidRule = briefSettings.customRules.find(
          (rule) => rule.name.trim() === "" || rule.prompt.trim() === "",
        );
        if (invalidRule !== undefined) {
          showToast("自定义 Brief 项的名称和说明不能为空");
          return;
        }
        setBusy(true);
        try {
          const tzOffset = -new Date().getTimezoneOffset();
          const result = await request(
            `/api/collab/workbench/brief/settings?tzOffset=${tzOffset}`,
            {
              method: "PUT",
              body: JSON.stringify({
                mode: briefSettings.mode,
                ...(briefSettings.mode === "manual"
                  ? { manualWindowFrom }
                  : {}),
                includeTypes: briefSettings.includeTypes,
                customRules: briefSettings.customRules.map((rule) => ({
                  id: rule.id,
                  name: rule.name.trim(),
                  prompt: rule.prompt.trim(),
                  enabled: rule.enabled !== false,
                })),
              }),
            },
          );
          const instanceId = briefSettings.instanceId;
          setRuntimeMeta((previous) => ({
            ...previous,
            [instanceId]: {
              ...previous[instanceId],
              status: "ready",
              updatedAt: result.module?.updatedAt,
              source: result.module?.source,
              briefSettings: result.settings,
            },
          }));
          setBriefSettings(null);
          window.dispatchEvent(
            new CustomEvent("pluginmax:workbench-v2-refresh", {
              detail: { instanceId },
            }),
          );
          showToast("Brief 设置已保存");
        } catch (cause) {
          showToast(`保存失败：${cause.message}`);
        } finally {
          setBusy(false);
        }
      };

      const applyPanelSettings = () => {
        if (panelSettings === null) return;
        commit(
          draftPanels.map((panel) =>
            panel.id === panelSettings.id
              ? {
                  ...panel,
                  title: panelSettings.title.trim(),
                  span: panelSettings.span,
                }
              : panel,
          ),
        );
        setPanelSettings(null);
      };

      const beginPanelResize = (event, panel, axis) => {
        if (!editing || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const canvas =
          event.currentTarget.closest("[data-workbench-v2-canvas]");
        const card = event.currentTarget.closest("article");
        if (canvas === null || card === null) return;
        setHistory((items) => [...items.slice(-19), clone(draftPanels)]);
        resizeRef.current = {
          panelId: panel.id,
          axis,
          startX: event.clientX,
          startY: event.clientY,
          startSpan: panel.span,
          startHeight: card.getBoundingClientRect().height,
          canvasWidth: canvas.getBoundingClientRect().width,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      };

      const movePanelResize = (event) => {
        const resize = resizeRef.current;
        if (resize === null) return;
        event.preventDefault();
        if (resize.axis === "width" || resize.axis === "both") {
          const column = (resize.canvasWidth - 14 * 5) / 6;
          const nextSpan = Math.max(
            1,
            Math.min(
              6,
              Math.round(
                resize.startSpan + (event.clientX - resize.startX) / (column + 14),
              ),
            ),
          );
          setDraftPanels((panels) =>
            panels.map((panel) =>
              panel.id === resize.panelId
                ? { ...panel, span: nextSpan }
                : panel,
            ),
          );
        }
        if (resize.axis === "height" || resize.axis === "both") {
          const nextHeight = Math.max(
            180,
            Math.min(900, resize.startHeight + event.clientY - resize.startY),
          );
          setDraftPanels((panels) =>
            panels.map((panel) =>
              panel.id === resize.panelId
                ? { ...panel, height: Math.round(nextHeight) }
                : panel,
            ),
          );
        }
        setDirty(true);
      };

      const endPanelResize = () => {
        resizeRef.current = null;
      };

      const onDrop = (targetId) => {
        const sourceId = dragId.current;
        dragId.current = "";
        if (sourceId === "" || sourceId === targetId) return;
        const next = [...draftPanels];
        const sourceIndex = next.findIndex((item) => item.id === sourceId);
        const targetIndex = next.findIndex((item) => item.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);
        commit(next);
      };

      const resolveLeave = (allow) => {
        leaveResolver.current?.(allow);
        leaveResolver.current = null;
        setLeavePrompt(null);
      };

      const visiblePlugins = plugins.filter((plugin) => {
        const query = pluginQuery.trim().toLowerCase();
        return (
          query === "" ||
          `${plugin.name} ${plugin.description} ${plugin.category}`
            .toLowerCase()
            .includes(query)
        );
      });

      const canvas = h(
        "div",
        { className: "pmwb2-canvas", "data-workbench-v2-canvas": "true" },
        ...panels.map((panel) => {
          const meta = runtimeMeta[panel.id];
          return h(
            "article",
            {
              key: panel.id,
              "data-panel-instance-id": panel.id,
              className: `pmwb2-card${editing ? " edit" : ""}`,
              style: {
                "--cols": panel.span,
                ...(panel.height ? { maxHeight: `${panel.height}px` } : {}),
              },
              draggable: editing,
              onDragStart: () => {
                dragId.current = panel.id;
              },
              onDragOver: (event) => {
                if (editing) event.preventDefault();
              },
              onDrop: () => onDrop(panel.id),
            },
            h(
              "header",
              { className: "pmwb2-card-head" },
              h(
                "div",
                { className: "pmwb2-card-head-main" },
                editing ? h("span", { className: "pmwb2-grip" }, ICONS.grip) : null,
                h(
                  "div",
                  { className: "pmwb2-card-title" },
                  h(
                    "strong",
                    null,
                    panel.title || pluginName(plugins, panel.pluginId),
                  ),
                  h(
                    "small",
                    null,
                    `更新 ${meta?.updatedAt ? formatTime(meta.updatedAt) : "--"}`,
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-card-tools" },
                meta?.titleActions ?? null,
                  h(
                    "button",
                    {
                      type: "button",
                      className:
                        meta?.status === "refreshing" ? "spinning" : undefined,
                      title: "刷新",
                      "aria-label": "刷新面板",
                      onClick: () =>
                        window.dispatchEvent(
                          new CustomEvent("pluginmax:workbench-v2-refresh", {
                            detail: { instanceId: panel.id },
                          }),
                        ),
                    },
                    ICONS.refresh,
                  ),
                  editing
                    ? h(
                        "button",
                        {
                          type: "button",
                          title: "配置面板",
                          "aria-label": "配置面板",
                          onClick: () => openPanelSettings(panel),
                        },
                        ICONS.gear,
                      )
                    : null,
                  editing
                    ? h(
                        "button",
                        {
                          type: "button",
                          className: "danger",
                          title: "删除面板",
                          "aria-label": "删除面板",
                          onClick: () => removePanel(panel.id),
                        },
                        ICONS.trash,
                      )
                    : null,
                ),
              ),
            ),
            h(
              "div",
              {
                className: "pmwb2-card-body",
                style: panel.height
                  ? { maxHeight: `${Math.max(120, panel.height - 43)}px` }
                  : undefined,
              },
              typeof props.renderSlot === "function"
                ? props.renderSlot(
                    "workbench.canvas.panel",
                    {
                      workbenchId: active.id,
                      instanceId: panel.id,
                      pluginId: panel.pluginId,
                      pluginVersion: panel.pluginVersion,
                      config: panel.config,
                      editing,
                      readOnly: active.ownerId !== currentUserId,
                      onRuntime: (next) => reportRuntime(panel.id, next),
                    },
                    {
                      entryKey: panel.pluginId,
                      fallback: h(
                        "div",
                        { className: "pmwb2-fallback" },
                        "该面板插件未装配、已禁用或版本不兼容。",
                      ),
                    },
                  )
                : h(
                    "div",
                    { className: "pmwb2-fallback" },
                    "面板插槽暂不可用。",
                  ),
            ),
            editing
              ? h(
                  react.Fragment,
                  null,
                  h("span", {
                    className: "pmwb2-resize-width",
                    role: "presentation",
                    onPointerDown: (event) =>
                      beginPanelResize(event, panel, "width"),
                    onPointerMove: movePanelResize,
                    onPointerUp: endPanelResize,
                    onPointerCancel: endPanelResize,
                  }),
                  h("span", {
                    className: "pmwb2-resize-height",
                    role: "presentation",
                    onPointerDown: (event) =>
                      beginPanelResize(event, panel, "height"),
                    onPointerMove: movePanelResize,
                    onPointerUp: endPanelResize,
                    onPointerCancel: endPanelResize,
                  }),
                )
              : null,
          );
        }),
      );

      return h(
        "section",
        { className: "pmwb2", "data-workbench-v2-page": "true" },
        h("style", null, styles),
        h(
          "div",
          { className: "pmwb2-head" },
          h(
            "div",
            { className: "pmwb2-head-copy" },
            h(
              "button",
              {
                type: "button",
                className: "pmwb2-title-trigger",
                "aria-haspopup": "dialog",
                "aria-expanded": switcherOpen,
                "data-workbench-switcher-trigger": "true",
                onClick: (event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setSwitcherAnchor({
                    left: Math.min(rect.left, window.innerWidth - 334),
                    bottom: rect.bottom,
                  });
                  setSwitcherOpen((open) => !open);
                },
              },
              h("h1", null, active?.name ?? "工作台"),
              ICONS.chevron,
            ),
          ),
          h(
            "div",
            { className: "pmwb2-actions" },
            currentRole === "admin"
              ? h(
                  "div",
                  {
                    className: "pmwb2-scope",
                    role: "group",
                    "aria-label": "项目范围",
                  },
                  h(
                    "button",
                    {
                      type: "button",
                      className: scopeAll ? "" : "active",
                      "aria-pressed": !scopeAll,
                      onClick: () => window.__pluginmaxScope?.setAll?.(false),
                    },
                    "仅看已加入",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: scopeAll ? "active" : "",
                      "aria-pressed": scopeAll,
                      onClick: () => window.__pluginmaxScope?.setAll?.(true),
                    },
                    "平台全量",
                  ),
                )
              : null,
            editing
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb2-btn",
                    onClick: () => void openLibrary(),
                  },
                  ICONS.plus,
                  "添加插件",
                )
              : h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb2-btn",
                    onClick: startEdit,
                    disabled: active === undefined,
                  },
                  ICONS.edit,
                  "编辑工作台",
                ),
            h(
              "button",
              {
                type: "button",
                className: "pmwb2-iconbtn",
                title: "刷新",
                onClick: () => void load(),
              },
              ICONS.refresh,
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmwb2-iconbtn",
                title: "管理工作台",
                onClick: () => setManagerOpen(true),
              },
              ICONS.grid,
            ),
            props.renderActions?.() ?? null,
            h(
              "button",
              {
                type: "button",
                className: `pmwb2-iconbtn${meetingOpen ? " active" : ""}`,
                title: meetingOpen ? "收起会议侧栏" : "展开会议侧栏",
                "aria-label": meetingOpen ? "收起会议侧栏" : "展开会议侧栏",
                "aria-pressed": meetingOpen,
                onClick: () => window.__pluginmaxMeeting?.toggle?.(),
              },
              ICONS.meeting,
            ),
          ),
        ),
        editing
          ? h(
              "div",
              { className: "pmwb2-editbar" },
              h("strong", null, "正在布置工作台"),
              h("span", null, "拖动面板标题调整顺序；点击齿轮调整宽度和插件设置。"),
              h(
                "div",
                { className: "pmwb2-editbar-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb2-btn",
                    onClick: undo,
                    disabled: history.length === 0,
                  },
                  ICONS.undo,
                  "撤销",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb2-btn",
                    onClick: resetDraft,
                    disabled: !dirty,
                  },
                  ICONS.refresh,
                  "重置",
                ),
                h(
                  "button",
                  { type: "button", className: "pmwb2-btn", onClick: cancelEdit },
                  "取消",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb2-btn primary",
                    onClick: () => void saveEdit(),
                    disabled: busy,
                  },
                  ICONS.check,
                  busy ? "保存中…" : "保存布局",
                ),
              ),
            )
          : null,
        error !== "" ? h("div", { className: "pmwb2-error" }, error) : null,
        phase === "loading"
          ? h("div", { className: "pmwb2-loading" }, "正在加载工作台…")
          : panels.length === 0
            ? h(
                "div",
                { className: "pmwb2-empty" },
                h("div", { className: "pmwb2-empty-icon" }, ICONS.grid),
                h("h2", null, "这张工作台还是空的"),
                h(
                  "p",
                  null,
                  "从已安装插件中添加面板，或复制一套市场方案作为起点。",
                ),
                h(
                  "div",
                  { className: "pmwb2-empty-actions" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn primary",
                      onClick: () => void openLibrary(),
                    },
                    "从插件库添加面板",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn",
                      onClick: () =>
                        navigate("resource-market"),
                    },
                    "打开资源市场",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn ghost",
                      onClick: () => {
                        setStarter("copy");
                        setCopySourceId(active?.id ?? "");
                        setCreateName(`${active?.name ?? "工作台"} 副本`);
                        setCreateOpen(true);
                      },
                    },
                    "复制已有工作台",
                  ),
                ),
              )
            : canvas,
        switcherOpen
          ? h(WorkbenchSwitcher, {
              workbenches,
              activeId: active?.id,
              anchor: switcherAnchor,
              onSwitch: (id) => void switchWorkbench(id),
            })
          : null,
        libraryOpen
          ? h(
              "aside",
              { className: "pmwb2-drawer", "aria-label": "插件库" },
              h(
                "div",
                { className: "pmwb2-drawer-head" },
                h("strong", null, "插件库"),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmwb2-iconbtn",
                    onClick: () => setLibraryOpen(false),
                    "aria-label": "关闭",
                  },
                  ICONS.close,
                ),
              ),
              h(
                "div",
                { className: "pmwb2-drawer-body" },
                h("input", {
                  className: "pmwb2-input",
                  type: "search",
                  value: pluginQuery,
                  placeholder: "搜索已装配插件",
                  onChange: (event) => setPluginQuery(event.target.value),
                }),
                h(
                  "p",
                  { className: "pmwb2-plugin-hint" },
                  "启用：让当前账号获得插件能力；添加：在当前工作台创建一个新的面板实例。",
                ),
                h(
                  "div",
                  { className: "pmwb2-list", style: { marginTop: "10px" } },
                  ...visiblePlugins.map((plugin) =>
                    h(
                      "article",
                      { className: "pmwb2-plugin-card", key: plugin.id },
                      h(
                        "div",
                        { className: "pmwb2-plugin-card-top" },
                        h(
                          "div",
                          { className: "pmwb2-plugin-card-copy" },
                          h("strong", null, plugin.name),
                          h(
                            "small",
                            null,
                            `${plugin.category} · ${plugin.version} · ${plugin.providerPluginId}`,
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmwb2-plugin-actions" },
                          h(
                            "span",
                            {
                              className: `pmwb2-plugin-status${
                                plugin.status === "enabled"
                                  ? " enabled"
                                  : plugin.status === "not_packaged" ||
                                      plugin.status === "disabled"
                                    ? " warn"
                                    : ""
                              }`,
                            },
                            plugin.status === "enabled"
                              ? "已启用"
                              : plugin.status === "not_packaged"
                                ? "未装配"
                                : plugin.status === "disabled"
                                  ? "已禁用"
                                  : "未启用",
                          ),
                          h(
                            "button",
                            {
                              type: "button",
                              className: "pmwb2-btn",
                              disabled:
                                plugin.status === "not_packaged" ||
                                plugin.status === "disabled",
                              title:
                                plugin.status === "enabled"
                                  ? "插件已启用；点击后在当前工作台新增一个面板实例"
                                  : "先为当前账号启用插件，再新增一个面板实例",
                              onClick: () => void addPlugin(plugin),
                            },
                            plugin.status === "enabled"
                              ? "添加面板"
                              : plugin.status === "not_packaged"
                                ? "未装配"
                                : plugin.status === "disabled"
                                  ? "已禁用"
                                  : "启用并添加面板",
                          ),
                        ),
                      ),
                      h(PluginPreview, { pluginId: plugin.id }),
                    ),
                  ),
                ),
              ),
            )
          : null,
        createOpen
          ? h(
              "div",
              { className: "pmwb2-mask", onClick: (event) => {
                if (event.target === event.currentTarget) setCreateOpen(false);
              } },
              h(
                "div",
                { className: "pmwb2-modal" },
                h(
                  "div",
                  { className: "pmwb2-modal-head" },
                  h("h2", null, "新建工作台"),
                  h(
                    "button",
                    { type: "button", className: "pmwb2-iconbtn", onClick: () => setCreateOpen(false) },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-body" },
                  h(
                    "div",
                    { className: "pmwb2-starter-grid" },
                    h(
                      "button",
                      {
                        type: "button",
                        className: `pmwb2-starter${starter === "blank" ? " active" : ""}`,
                        onClick: () => setStarter("blank"),
                      },
                      h("strong", null, "空白工作台"),
                      h("span", null, "从插件库逐一添加面板。"),
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: `pmwb2-starter${starter === "market" ? " active" : ""}`,
                        onClick: () => {
                          setCreateOpen(false);
                          navigate("resource-market");
                        },
                      },
                      h("strong", null, "市场方案"),
                      h("span", null, "复制一套完整布局。"),
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: `pmwb2-starter${starter === "copy" ? " active" : ""}`,
                        onClick: () => {
                          setStarter("copy");
                          setCopySourceId(active?.id ?? "");
                          setCreateName(`${active?.name ?? "工作台"} 副本`);
                        },
                        disabled: active === undefined,
                      },
                      h("strong", null, "复制现有"),
                      h("span", null, "完整复制当前工作台。"),
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmwb2-field", style: { marginTop: "12px" } },
                    h("label", null, "名称"),
                    h("input", {
                      className: "pmwb2-input",
                      value: createName,
                      maxLength: 40,
                      placeholder: starter === "copy" ? `${copySource?.name ?? "工作台"} 副本` : "例如：本周经营复盘",
                      onChange: (event) => setCreateName(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === "Enter") void createWorkbench();
                      },
                    }),
                  ),
                  starter === "copy"
                    ? h(
                        "div",
                        { className: "pmwb2-field" },
                        h("label", null, "复制来源"),
                        h(
                          "select",
                          {
                            className: "pmwb2-select",
                            value: copySourceId,
                            onChange: (event) => {
                              const id = event.target.value;
                              setCopySourceId(id);
                              const source = workbenches.find(
                                (item) => item.id === id,
                              );
                              if (source !== undefined) {
                                setCreateName(`${source.name} 副本`);
                              }
                            },
                          },
                          ...workbenches.map((workbench) =>
                            h(
                              "option",
                              {
                                key: workbench.id,
                                value: workbench.id,
                              },
                              `${workbench.name} · ${workbench.panels.length} 个插件`,
                            ),
                          ),
                        ),
                      )
                    : null,
                  h(
                    "div",
                    { className: "pmwb2-field" },
                    h("label", null, "可见范围"),
                    h(
                      "div",
                      { className: "pmwb2-seg" },
                      h(
                        "button",
                        {
                          type: "button",
                          className: createVisibility === "private" ? "active" : "",
                          onClick: () => setCreateVisibility("private"),
                        },
                        "仅自己",
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          className: createVisibility === "team" ? "active" : "",
                          onClick: () => setCreateVisibility("team"),
                        },
                        "团队可见",
                      ),
                    ),
                    createVisibility === "team"
                      ? h(
                          "select",
                          {
                            className: "pmwb2-select",
                            value: createWorkspaceId,
                            "aria-label": "共享工作区",
                            onChange: (event) =>
                              setCreateWorkspaceId(event.target.value),
                          },
                          workspaces.length === 0
                            ? h("option", { value: "" }, "暂无可共享工作区")
                            : workspaces.map((workspace) =>
                                h(
                                  "option",
                                  { key: workspace.id, value: workspace.id },
                                  workspace.title ?? workspace.path ?? workspace.id,
                                ),
                              ),
                        )
                      : null,
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-foot" },
                  h("button", { type: "button", className: "pmwb2-btn", onClick: () => setCreateOpen(false) }, "取消"),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn primary",
                      disabled: busy || (starter === "market"),
                      onClick: () => void createWorkbench(),
                    },
                    busy ? "创建中…" : "创建工作台",
                  ),
                ),
              ),
            )
          : null,
        managerOpen
          ? h(
              "div",
              { className: "pmwb2-mask", onClick: (event) => {
                if (event.target === event.currentTarget) setManagerOpen(false);
              } },
              h(
                "div",
                { className: "pmwb2-modal", style: { width: "min(680px,100%)" } },
                h(
                  "div",
                  { className: "pmwb2-modal-head" },
                  h("h2", null, "管理工作台"),
                  h("button", { type: "button", className: "pmwb2-iconbtn", onClick: () => setManagerOpen(false) }, ICONS.close),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-body" },
                  h(
                    "div",
                    { className: "pmwb2-list" },
                    ...workbenches.map((workbench) =>
                      h(
                        "div",
                        { className: "pmwb2-list-row", key: workbench.id },
                        h(
                          "span",
                          null,
                          h(
                            "span",
                            { className: "pmwb2-name-row" },
                            h("strong", null, workbench.name),
                            preference?.defaultWorkbenchId === workbench.id
                              ? h(
                                  "span",
                                  {
                                    className: "pmwb2-star",
                                    title: "默认工作台",
                                    role: "img",
                                    "aria-label": "默认工作台",
                                  },
                                  ICONS.star,
                                )
                              : null,
                          ),
                          h(
                            "small",
                            null,
                            `${visibilityLabel(workbench.visibility)} · ${workbench.panels.length} 个插件 · revision ${workbench.revision} · 布局/设置更新 ${formatTime(workbench.updatedAt)} · 更新人 ${workbench.updatedByName || workbench.ownerId}`,
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmwb2-list-actions" },
                          h(
                            "button",
                            {
                              type: "button",
                              className: "pmwb2-btn",
                              onClick: () =>
                                void updatePreference({
                                  defaultWorkbenchId: workbench.id,
                                }),
                            },
                            preference?.defaultWorkbenchId === workbench.id ? "默认" : "设为默认",
                          ),
                          h(
                            "button",
                            {
                              type: "button",
                              className: "pmwb2-btn",
                              onClick: () => {
                                setRenameTarget(workbench.id);
                                setRenameValue(workbench.name);
                              },
                            },
                            "重命名",
                          ),
                          h(
                            "button",
                            {
                              type: "button",
                              className: "pmwb2-btn",
                              onClick: () => void duplicateWorkbench(workbench.id),
                            },
                            "复制",
                          ),
                          h(
                            "button",
                            {
                              type: "button",
                              className: "pmwb2-btn",
                              disabled: workbench.ownerId !== currentUserId,
                              onClick: () => void deleteWorkbench(workbench.id),
                            },
                            "删除",
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn primary",
                      onClick: () => {
                        setManagerOpen(false);
                        setStarter("blank");
                        setCreateName("");
                        setCreateVisibility("private");
                        setCreateOpen(true);
                      },
                    },
                    ICONS.plus,
                    "新建工作台",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn",
                      onClick: () => setManagerOpen(false),
                    },
                    "关闭",
                  ),
                ),
              ),
            )
          : null,
        renameTarget !== null
          ? h(
              "div",
              { className: "pmwb2-mask" },
              h(
                "div",
                { className: "pmwb2-modal", style: { width: "min(420px,100%)" } },
                h("div", { className: "pmwb2-modal-head" }, h("h2", null, "重命名工作台")),
                h(
                  "div",
                  { className: "pmwb2-modal-body" },
                  h("input", {
                    className: "pmwb2-input",
                    value: renameValue,
                    maxLength: 40,
                    autoFocus: true,
                    onChange: (event) => setRenameValue(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === "Enter") void renameWorkbench();
                    },
                  }),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-foot" },
                  h("button", { type: "button", className: "pmwb2-btn", onClick: () => setRenameTarget(null) }, "取消"),
                  h("button", { type: "button", className: "pmwb2-btn primary", onClick: () => void renameWorkbench() }, "保存"),
                ),
              ),
            )
          : null,
        briefSettings
          ? h(
              "div",
              {
                className: "pmwb2-mask",
                onClick: (event) => {
                  if (event.target === event.currentTarget && !busy) {
                    setBriefSettings(null);
                  }
                },
              },
              h(
                "div",
                {
                  className: "pmwb2-modal",
                  style: { width: "min(720px,100%)" },
                },
                h(
                  "div",
                  { className: "pmwb2-modal-head" },
                  h("h2", null, `${briefSettings.title} · 设置`),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-iconbtn",
                      disabled: busy,
                      onClick: () => setBriefSettings(null),
                    },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-body" },
                  h(
                    "section",
                    { className: "pmwb2-form-section" },
                    h("h3", { className: "pmwb2-section-title" }, "Brief 时间窗口"),
                    h(
                      "div",
                      { className: "pmwb2-seg" },
                      h(
                        "button",
                        {
                          type: "button",
                          className:
                            briefSettings.mode === "lastLeave" ? "active" : "",
                          onClick: () =>
                            setBriefSettings((current) => ({
                              ...current,
                              mode: "lastLeave",
                            })),
                        },
                        "从上次离开开始",
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          className:
                            briefSettings.mode === "manual" ? "active" : "",
                          onClick: () =>
                            setBriefSettings((current) => ({
                              ...current,
                              mode: "manual",
                              manualWindowFrom:
                                current.manualWindowFrom ||
                                toLocalDateTime(undefined),
                            })),
                        },
                        "指定起始时间",
                      ),
                    ),
                    briefSettings.mode === "manual"
                      ? h("input", {
                          className: "pmwb2-input",
                          type: "datetime-local",
                          value: briefSettings.manualWindowFrom,
                          onChange: (event) =>
                            setBriefSettings((current) => ({
                              ...current,
                              manualWindowFrom: event.target.value,
                            })),
                        })
                      : null,
                  ),
                  h(
                    "section",
                    { className: "pmwb2-form-section" },
                    h(
                      "div",
                      null,
                      h(
                        "h3",
                        { className: "pmwb2-section-title" },
                        "纳入 Brief 的类型",
                      ),
                      h(
                        "p",
                        { className: "pmwb2-field-hint" },
                        "已选中的平台事件会继续沿用原 Brief 的聚合、已读和跳转逻辑。",
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmwb2-check-grid" },
                      ...BRIEF_INCLUDE_OPTIONS.map(([type, label]) =>
                        h(
                          "label",
                          { className: "pmwb2-check", key: type },
                          h("input", {
                            type: "checkbox",
                            checked:
                              briefSettings.includeTypes.includes(type),
                            onChange: () => toggleBriefIncludeType(type),
                          }),
                          h("span", null, label),
                        ),
                      ),
                    ),
                  ),
                  h(
                    "section",
                    { className: "pmwb2-form-section" },
                    h(
                      "div",
                      null,
                      h(
                        "h3",
                        { className: "pmwb2-section-title" },
                        "自定义 Brief 项",
                      ),
                      h(
                        "p",
                        { className: "pmwb2-field-hint" },
                        "规则会匹配 Brief 时间窗口内的真实事项，并按规则聚合成一个 Brief 条目。",
                      ),
                    ),
                    briefSettings.customRules.length === 0
                      ? h(
                          "p",
                          { className: "pmwb2-field-hint" },
                          "尚未添加自定义规则。",
                        )
                      : h(
                          "div",
                          { className: "pmwb2-brief-rule-list" },
                          ...briefSettings.customRules.map((rule, index) =>
                            h(
                              "div",
                              {
                                className: "pmwb2-brief-rule",
                                key: rule.id,
                              },
                              h(
                                "div",
                                { className: "pmwb2-brief-rule-head" },
                                h("input", {
                                  className: "pmwb2-input",
                                  value: rule.name,
                                  maxLength: 80,
                                  "aria-label": `自定义 Brief 项 ${index + 1} 名称`,
                                  onChange: (event) =>
                                    updateBriefRule(rule.id, {
                                      name: event.target.value,
                                    }),
                                }),
                                h(
                                  "label",
                                  { className: "pmwb2-inline-check" },
                                  h("input", {
                                    type: "checkbox",
                                    checked: rule.enabled !== false,
                                    onChange: (event) =>
                                      updateBriefRule(rule.id, {
                                        enabled: event.target.checked,
                                      }),
                                  }),
                                  "启用",
                                ),
                                h(
                                  "button",
                                  {
                                    type: "button",
                                    className: "pmwb2-iconbtn",
                                    title: "删除自定义 Brief 项",
                                    "aria-label": "删除自定义 Brief 项",
                                    onClick: () => removeBriefRule(rule.id),
                                  },
                                  ICONS.trash,
                                ),
                              ),
                              h("textarea", {
                                className: "pmwb2-textarea",
                                value: rule.prompt,
                                maxLength: 4000,
                                "aria-label": `自定义 Brief 项 ${index + 1} 说明`,
                                onChange: (event) =>
                                  updateBriefRule(rule.id, {
                                    prompt: event.target.value,
                                  }),
                              }),
                            ),
                          ),
                        ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmwb2-btn pmwb2-add-rule",
                        disabled: briefSettings.customRules.length >= 20,
                        onClick: addBriefRule,
                      },
                      ICONS.plus,
                      "新增 Brief 项",
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn",
                      disabled: busy,
                      onClick: () => setBriefSettings(null),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn primary",
                      disabled:
                        busy || briefSettings.includeTypes.length === 0,
                      onClick: () => void saveBriefSettings(),
                    },
                    busy ? "保存中…" : "保存设置",
                  ),
                ),
              ),
            )
          : null,
        panelSettings
          ? h(
              "div",
              { className: "pmwb2-mask", onClick: (event) => {
                if (event.target === event.currentTarget) setPanelSettings(null);
              } },
              h(
                "div",
                { className: "pmwb2-modal", style: { width: "min(430px,100%)" } },
                h(
                  "div",
                  { className: "pmwb2-modal-head" },
                  h("h2", null, "面板设置"),
                  h("button", { type: "button", className: "pmwb2-iconbtn", onClick: () => setPanelSettings(null) }, ICONS.close),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-body" },
                  h(
                    "div",
                    { className: "pmwb2-field" },
                    h("label", null, "面板标题"),
                    h("input", {
                      className: "pmwb2-input",
                      value: panelSettings.title,
                      maxLength: 120,
                      onChange: (event) =>
                        setPanelSettings((current) => ({
                          ...current,
                          title: event.target.value,
                        })),
                    }),
                  ),
                  h("div", { className: "pmwb2-label" }, "宽度"),
                  h(
                    "div",
                    { className: "pmwb2-seg", style: { marginTop: "7px" } },
                    ...[1, 2, 3, 4, 5, 6].map((span) =>
                      h(
                        "button",
                        {
                          type: "button",
                          className: panelSettings.span === span ? "active" : "",
                          onClick: () =>
                            setPanelSettings((current) => ({
                              ...current,
                              span,
                            })),
                        },
                        `${span}/6`,
                      ),
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "pmwb2-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn",
                      onClick: () => {
                        const id = panelSettings.id;
                        setPanelSettings(null);
                        removePanel(id);
                      },
                    },
                    "移除面板",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn",
                      onClick: () => setPanelSettings(null),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn primary",
                      onClick: applyPanelSettings,
                    },
                    "应用设置",
                  ),
                ),
              ),
            )
          : null,
        leavePrompt
          ? h(
              "div",
              { className: "pmwb2-mask" },
              h(
                "div",
                { className: "pmwb2-modal", style: { width: "min(440px,100%)" } },
                h("div", { className: "pmwb2-modal-head" }, h("h2", null, leavePrompt.title)),
                h("div", { className: "pmwb2-modal-body" }, h("p", { style: { margin: 0, lineHeight: 1.65 } }, leavePrompt.message)),
                h(
                  "div",
                  { className: "pmwb2-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn",
                      onClick: () => resolveLeave(false),
                    },
                    "取消",
                  ),
                  leavePrompt.action === "navigate"
                    ? h(
                        "button",
                        {
                          type: "button",
                          className: "pmwb2-btn",
                          onClick: () => {
                            setEditing(false);
                            setDirty(false);
                            resolveLeave(true);
                          },
                        },
                        "放弃并离开",
                      )
                    : null,
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmwb2-btn primary",
                      disabled: busy,
                      onClick: () => {
                        if (leavePrompt.action === "navigate") void saveEdit(true);
                        else {
                          setEditing(false);
                          setDirty(false);
                          setDraftPanels([]);
                          resolveLeave(false);
                        }
                      },
                    },
                    busy
                      ? "保存中…"
                      : leavePrompt.action === "navigate"
                        ? "保存并继续"
                        : "放弃修改",
                  ),
                ),
              ),
            )
          : null,
        toast !== "" ? h("div", { className: "pmwb2-toast", role: "status" }, toast) : null,
      );
    }

    function pluginName(plugins, pluginId) {
      return (
        plugins.find((plugin) => plugin.id === pluginId)?.name ??
        PLUGIN_NAMES[pluginId] ??
        pluginId
      );
    }

    function WorkbenchV2GlobalPage(props) {
      const route = props?.useShellRoute?.((state) => state.route);
      return route === "workbench-new" ? h(WorkbenchPage, props) : null;
    }

    exports.inject = ["slots"];
    exports.__test = {
      visibilityLabel,
      formatTime,
      pluginName,
    };
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global",
            id: "pluginmax-workbench-v2",
            order: 21,
            children: {
              "workbench.canvas.panel": {
                kind: "keyed",
                scope: "root",
              },
            },
          },
          WorkbenchV2GlobalPage,
        ),
      );
    };

    return module.exports;
  },
});
