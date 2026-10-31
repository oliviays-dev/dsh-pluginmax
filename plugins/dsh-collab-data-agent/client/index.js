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
      task: icon([
        "M9 6h11M9 12h11M9 18h11",
        "m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2",
      ], 13),
      chevron: icon(["m6 9 6 6 6-6"], 12),
      download: icon(["M12 3v12M7 10l5 5 5-5M4 21h16"]),
      shield: icon(["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-5"]),
      plus: icon(["M12 5v14M5 12h14"], 12),
      panel: icon(["M4 4h16v16H4Z", "M10 4v16"], 14),
    };

    const styles = `
.pmda-action{width:32px;height:32px;flex:none;display:grid;place-items:center;padding:0;border:0.5px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 44%,var(--dsw-alias-border-l3));border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-agent-primary,#8b7bf7);cursor:pointer;position:relative;}
.pmda-action:hover,.pmda-action.active{background:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 12%,var(--dsw-alias-bg-layer-1));}
.pmda-action.workspace{border-color:var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);margin-right:-12px;}
.pmda-action.workspace:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmda-action.workspace.active{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmda-action svg{width:15px;height:15px;}
.pmda-action-dot{position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-agent-primary,#8b7bf7);}
.pmda-selectable{transition:box-shadow .12s ease,border-color .12s ease;}
.pmda-selectable:hover{box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,transparent);}
.pmda-selected{box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 78%,transparent),0 0 0 5px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 10%,transparent)!important;}
.pmda-selection-actions{position:fixed;z-index:1200;display:flex;align-items:center;gap:6px;transform:translate(-50%,-100%);}
.pmda-selection-action{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 58%,transparent);border-radius:6px;background:var(--dsw-alias-agent-primary,#8b7bf7);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.24);font:inherit;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer;}
.pmda-selection-action.task{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 58%,transparent);background:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmda-selection-action svg{width:13px;height:13px;}
.pmda-panel-root{position:absolute;inset:0;z-index:21;display:flex;justify-content:flex-end;overflow:hidden;pointer-events:none;}
.pmda-panel{position:relative;width:100%;min-width:0;height:100%;display:flex;flex-direction:column;pointer-events:auto;overflow:hidden;border-left:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);}
.pmda-panel-root.expanded .pmda-panel{width:100%;border-left:0;}
.pmda-panel *{box-sizing:border-box;}
.pmda-tabs{display:flex;align-items:stretch;flex:none;gap:2px;height:49px;min-height:49px;padding:6px 8px 0 6px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
.pmda-tab-scroll{display:flex;align-items:stretch;gap:2px;min-width:0;flex:1;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.pmda-tab{--pmda-tab-width:100px;position:relative;width:var(--pmda-tab-width);min-width:100px;max-width:100px;flex:0 0 var(--pmda-tab-width);display:inline-flex;align-items:center;height:42px;overflow:hidden;color:var(--dsw-alias-label-secondary);cursor:grab;}
.pmda-tab.active{color:var(--dsw-alias-label-primary);border-radius:6px 6px 0 0;background:var(--dsw-alias-bg-layer-3);font-weight:600;}
.pmda-tab:hover:not(.active){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmda-tab-indicator{position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px 2px 0 0;background:transparent;pointer-events:none;}
.pmda-tab.active .pmda-tab-indicator{background:var(--dsw-alias-label-primary);}
.pmda-tab-main{min-width:0;flex:1;display:inline-flex;align-items:center;gap:5px;height:100%;padding:0 4px 0 9px;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer;}
.pmda-tab-main span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmda-tab-main:hover{color:inherit;}
.pmda-tab svg{width:13px;height:13px;flex:none;color:currentColor;}
.pmda-tab-close{width:18px;height:18px;flex:none;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);opacity:0;cursor:pointer;}
.pmda-tab.active .pmda-tab-close,.pmda-tab:hover .pmda-tab-close,.pmda-tab:focus-within .pmda-tab-close{opacity:.72;}
.pmda-tab-close:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);opacity:1;}
.pmda-tab-actions{display:flex;align-items:center;gap:2px;flex:none;margin-left:4px;padding-left:6px;border-left:1px solid var(--dsw-alias-border-l2);}
.pmda-tab-new-wrap{position:relative;flex:none;display:flex;align-items:center;}
.pmda-tab-new,.pmda-tab-action{width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;}
.pmda-tab-new:hover,.pmda-tab-action:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmda-tab-action svg{width:13px;height:13px;}
.pmda-tab-panel{width:32px;height:32px;transform:translateY(.5px);}
.pmda-tab-panel svg{width:15px;height:15px;}
.pmda-tab-new-menu{position:absolute;right:0;top:31px;z-index:8;min-width:150px;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 10px 28px rgba(0,0,0,.2);}
.pmda-tab-new-item{display:flex;align-items:center;gap:7px;width:100%;padding:8px 9px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;font-size:11px;line-height:1.4;cursor:pointer;}
.pmda-tab-new-item svg{width:13px;height:13px;flex:none;}
.pmda-tab-new-item:hover{background:var(--dsw-alias-bg-layer-2);}
.pmda-iconbtn{width:28px;height:28px;flex:none;display:grid;place-items:center;padding:0;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;}
.pmda-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.pmda-iconbtn svg{width:13px;height:13px;}
.pmda-context{display:block;flex:none;overflow:hidden;padding:6px 10px;border-bottom:0.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:10px;}
.pmda-context-controls{display:grid;grid-template-columns:minmax(70px,1fr) minmax(102px,1.25fr) auto auto;align-items:center;gap:6px;width:100%;min-width:0;}
.pmda-context-group{display:inline-flex;align-items:center;gap:5px;min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
.pmda-context-group>span{flex:none;}
.pmda-context select{width:100%;max-width:none;height:25px;min-width:0;padding:0 6px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;}
.pmda-context-new{padding:0 8px;}
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
.pmda-chat-md{display:grid;gap:7px;white-space:normal;}
.pmda-chat-md>:first-child{margin-top:0;}.pmda-chat-md>:last-child{margin-bottom:0;}
.pmda-chat-md p{margin:0;color:inherit;}
.pmda-chat-md h1,.pmda-chat-md h2,.pmda-chat-md h3,.pmda-chat-md h4,.pmda-chat-md h5,.pmda-chat-md h6{margin:3px 0 0;font-weight:700;line-height:1.4;}
.pmda-chat-md h1{font-size:15px;}.pmda-chat-md h2{font-size:13px;}.pmda-chat-md h3{font-size:12px;}.pmda-chat-md h4,.pmda-chat-md h5,.pmda-chat-md h6{font-size:11px;}
.pmda-chat-md ul,.pmda-chat-md ol{display:grid;gap:3px;margin:0;padding-left:20px;}
.pmda-chat-md strong{font-weight:700;color:var(--dsw-alias-label-primary);}
.pmda-chat-md a{color:var(--dsw-alias-accent-primary,#4f8ef7);text-decoration:underline;text-underline-offset:2px;}
.pmda-chat-md code{padding:1px 4px;border-radius:4px;background:var(--dsw-alias-bg-layer-3);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;}
.pmda-chat-md pre{max-width:100%;overflow:auto;margin:0;padding:8px;border-radius:6px;background:var(--dsw-alias-bg-layer-3);font-size:10px;line-height:1.55;white-space:pre;}
.pmda-chat-md pre code{padding:0;background:transparent;}
.pmda-chat-md table{width:100%;border-collapse:collapse;margin:0;font-size:10px;background:var(--dsw-alias-bg-layer-1);}
.pmda-chat-md th,.pmda-chat-md td{padding:5px 6px;border:0.5px solid var(--dsw-alias-border-l2);text-align:left;vertical-align:top;}
.pmda-chat-md th{background:var(--dsw-alias-bg-layer-3);font-weight:700;}
.pmda-chat-md img{display:block;max-width:100%;height:auto;border-radius:6px;}
.pmda-attachments{display:grid;gap:5px;width:100%;margin-bottom:5px;}
.pmda-attachment{display:grid;gap:3px;padding:7px 8px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 25%,var(--dsw-alias-border-l2));border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmda-attachment-head{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
.pmda-attachment-head code{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8.5px;}
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
.pmda-clarification{display:grid;gap:10px;margin:8px 0 12px;padding:11px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 34%,var(--dsw-alias-border-l2));border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmda-clarification-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.pmda-clarification-head h3{margin:0;font-size:12px;line-height:1.45;}
.pmda-clarification-head p{margin:3px 0 0;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.5;}
.pmda-clarification-question{display:grid;gap:6px;}
.pmda-clarification-question h4{margin:0;font-size:11px;line-height:1.5;}
.pmda-clarification-question p{margin:0;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.55;white-space:pre-wrap;}
.pmda-clarification-options{display:flex;flex-wrap:wrap;gap:5px;}
.pmda-clarification-option{min-height:26px;padding:4px 8px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;text-align:left;cursor:pointer;}
.pmda-clarification-option.selected{border-color:var(--dsw-alias-agent-primary,#8b7bf7);background:color-mix(in srgb,var(--dsw-alias-agent-primary,#8b7bf7) 12%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);}
.pmda-clarification-input{width:100%;min-height:30px;padding:6px 7px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;resize:vertical;}
.pmda-clarification-actions{display:flex;justify-content:flex-end;gap:6px;}
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
.pmda-teammate-config{display:grid;gap:10px;margin-top:12px;}
.pmda-teammate-config-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.pmda-teammate-config-head h3{margin:0;font-size:12.5px;line-height:1.45;}
.pmda-teammate-config-head p{margin:3px 0 0;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.6;}
.pmda-teammate-config-revision{flex:none;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmda-teammate-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.pmda-teammate-config-field{display:grid;gap:5px;min-width:0;padding:8px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10.5px;}
.pmda-teammate-config-field>span{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmda-teammate-config-field select,.pmda-teammate-config-field input{width:100%;min-width:0;height:29px;padding:0 7px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;}
.pmda-teammate-config-field.readonly strong{font-size:11px;font-weight:600;}
.pmda-teammate-config-field.readonly small{color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.5;}
.pmda-teammate-config-foot{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;}
.pmda-teammate-config-foot>span{margin-right:auto;color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
@media(max-width:640px){.pmda-panel{width:100%;}.pmda-selection-actions{max-width:calc(100vw - 24px);flex-wrap:wrap;justify-content:center;}.pmda-context{padding:6px 8px;}.pmda-context-controls{grid-template-columns:minmax(64px,1fr) minmax(92px,1.25fr) auto auto;}.pmda-report{padding:10px;}.pmda-report-toolbar{margin:-10px -10px 10px;padding:8px 10px;}}
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

    async function workspaceOptions() {
      const workspaceResult = await request("/api/collab/team/workspaces").catch(
        () => ({ workspaces: [] }),
      );
      const memberships = (workspaceResult.workspaces ?? [])
        .filter((workspace) => workspace.isMember !== false)
        .map((workspace) => ({
          id: workspace.id,
          title: workspace.title ?? workspace.path ?? workspace.id,
        }));
      if (memberships.length > 0) return memberships;

      // 平台管理员可能能访问项目，但没有独立的 team.members 行。
      // 项目 ID 就是工作区 ID，因此用项目目录兜底解析当前可分析范围。
      const projectResult = await request("/api/collab/projects").catch(() => ({
        projects: [],
      }));
      return (projectResult.projects ?? [])
        .map((project) => ({
          id: project.id ?? project.workspaceId,
          title: project.name ?? project.title ?? project.id,
        }))
        .filter((workspace) => typeof workspace.id === "string" && workspace.id);
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
        window.__pluginmaxSelectionContext?.workspaceId ||
        window.__pluginmaxDataAgentWorkspaceId ||
        window.localStorage.getItem(WORKSPACE_KEY) ||
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
          const matches = [];
          for (const adapter of adapters.values()) {
            const match = element?.closest?.(adapter.selector);
            if (match === null || match === undefined) continue;
            let depth = 0;
            let current = element;
            while (current !== null && current !== match) {
              depth += 1;
              current = current.parentElement;
            }
            matches.push({ adapter, match, depth });
          }
          matches.sort(
            (left, right) =>
              left.depth - right.depth ||
              right.adapter.selector.length - left.adapter.selector.length,
          );
          return matches[0]?.adapter.resolve(matches[0].match);
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
      registry.register({
        entityType: "workbench_card",
        schemaVersion: "workbench-card-selection-v1",
        selector: "[data-data-agent-card]",
        resolve(element) {
          return {
            kind: "component",
            title: titleOf(element),
            excerpt: excerptOf(element),
            source: {
              workspaceId: workspaceIdFor(element),
              page: "workbench",
            },
            snapshot: {
              text: excerptOf(element),
              componentSchemaVersion: "workbench-card-v1",
            },
          };
        },
      });
    }

    const entityRegistry = createSelectionRegistry();
    registerBuiltInAdapters(entityRegistry);
    const ambientWorkspacePromise = workspaceOptions()
      .then((workspaces) => {
        const workspace = workspaces[0];
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
              "[data-data-agent-panel='true'], .pmda-selection-actions, .pmda-selection-action, button, input, textarea, select, a, [role='button'][data-control], [data-data-agent-exclude]",
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
                  "[data-data-agent-panel='true'], textarea, input, button, a, select, [contenteditable='true']",
                )
              ) {
                return;
              }
              const range = textSelection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) return;
              const route = pageFromRoute(window.__pluginmaxShell?.router?.state?.route);
              const meetingMessage = node?.closest?.(
                "[data-meeting-message-id]",
              );
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
                  taskCapture:
                    meetingMessage === null || meetingMessage === undefined
                      ? undefined
                      : {
                          surface:
                            meetingMessage.getAttribute(
                              "data-meeting-surface",
                            ) ?? "",
                          sourceType:
                            meetingMessage.getAttribute("data-meeting-kind") ===
                            "ai"
                              ? "ai-chat"
                              : "meeting",
                          sourceId:
                            meetingMessage.getAttribute("data-meeting-id") ??
                            "",
                          sourceTitle:
                            meetingMessage.getAttribute(
                              "data-meeting-title",
                            ) ?? "",
                          workspaceId: workspaceIdFor(node),
                          messageId:
                            meetingMessage.getAttribute(
                              "data-meeting-message-id",
                            ) ?? "",
                          text: compact(text, 8000),
                        },
                },
                rect,
                null,
              );
            }
          }, 0);
        };
        const click = (event) => {
          const interactive = event.target.closest?.(
            ".pmda-selection-action, .pmda-panel, button, input, textarea, select, a, [data-data-agent-exclude]",
          );
          const selectionControl =
            interactive?.matches?.("[data-data-agent-select]") === true
              ? interactive
              : undefined;
          if (interactive !== null && interactive !== undefined && !selectionControl) {
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
          if (!selectionControl) {
            event.preventDefault();
            event.stopPropagation();
          }
          const host =
            event.target.closest(
              "[data-task-id],[data-workflow-id],[data-workflow-node-id],[data-data-agent-entity='meeting'],[data-metric-id],[data-data-agent-card],svg[data-chart],svg.sparkline,svg.insight-chart,.pmwf-overview,main img",
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
        "div",
        {
          className: "pmda-selection-actions",
          style: position,
        },
        h(
          "button",
          {
            ref: actionRef,
            type: "button",
            className: "pmda-selection-action",
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
        ),
        selection.taskCapture === undefined
          ? null
          : h(
              "button",
              {
                type: "button",
                className: "pmda-selection-action task",
                onClick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("pluginmax:task-capture-selection", {
                      detail: selection.taskCapture,
                    }),
                  );
                  clear();
                  window.getSelection()?.removeAllRanges();
                },
              },
              ICONS.selection,
              "创建对应任务",
            ),
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
      const [newTabOpen, setNewTabOpen] = react.useState(false);
      const [draggingTab, setDraggingTab] = react.useState("");
      const activeTabRef = react.useRef(null);
      const newTabWrapRef = react.useRef(null);
      const tabs = snapshot.openTabs ?? [];
      react.useEffect(() => {
        activeTabRef.current?.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
        });
      }, [snapshot.activeTab, tabs.length]);
      react.useEffect(() => {
        if (!newTabOpen) return undefined;
        const closeOnOutsidePointer = (event) => {
          if (!newTabWrapRef.current?.contains(event.target)) {
            setNewTabOpen(false);
          }
        };
        const closeOnEscape = (event) => {
          if (event.key === "Escape") setNewTabOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsidePointer, true);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
          document.removeEventListener(
            "pointerdown",
            closeOnOutsidePointer,
            true,
          );
          document.removeEventListener("keydown", closeOnEscape);
        };
      }, [newTabOpen]);
      if (tabs.length === 0) return null;
      const labels = {
        "data-agent": "spark",
        communication: "message",
        "task-drafts": "task",
      };
      const moveTabFocus = (event, index) => {
        if (
          !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        ) {
          return;
        }
        event.preventDefault();
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : event.key === "ArrowLeft"
                ? (index - 1 + tabs.length) % tabs.length
                : (index + 1) % tabs.length;
        const nextTab = tabs[nextIndex];
        window.__pluginmaxSidePanel?.openTab(nextTab);
        window.requestAnimationFrame(() => {
          const target = [...document.querySelectorAll("[data-tab]")]
            .find(
              (node) =>
                node.dataset.tab === nextTab &&
                node.getClientRects().length > 0,
            );
          target?.querySelector('button[role="tab"]')?.focus();
        });
      };
      return h(
        "div",
        { role: "tablist", "aria-label": "侧边工作区", className: "pmda-tabs" },
        h(
          "div",
          { className: "pmda-tab-scroll" },
          ...tabs.map((tab, tabIndex) => {
            const active = snapshot.activeTab === tab;
            const descriptor =
              window.__pluginmaxSidePanel?.describeTab?.(tab) ?? {
                type: tab,
                title: tab,
              };
            const iconName = labels[descriptor.type] ?? "message";
            const label = descriptor.title;
            return h(
              "div",
              {
                key: tab,
                className: `pmda-tab${active ? " active" : ""}`,
                "data-tab": tab,
                "data-tab-type": descriptor.type,
                ref: active ? activeTabRef : undefined,
                draggable: true,
                style: draggingTab === tab ? { opacity: 0.55 } : undefined,
                onDragStart: (event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", tab);
                  setDraggingTab(tab);
                },
                onDragOver: (event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                },
                onDrop: (event) => {
                  event.preventDefault();
                  const source =
                    event.dataTransfer.getData("text/plain") || draggingTab;
                  window.__pluginmaxSidePanel?.reorderTab?.(source, tab);
                  setDraggingTab("");
                },
                onDragEnd: () => setDraggingTab(""),
              },
              h(
                "button",
                {
                  type: "button",
                  role: "tab",
                  "aria-selected": active,
                  className: "pmda-tab-main",
                  onClick: () => window.__pluginmaxSidePanel?.openTab(tab),
                  onKeyDown: (event) => moveTabFocus(event, tabIndex),
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
              h("span", {
                className: "pmda-tab-indicator",
                "data-tab-indicator": "true",
                "aria-hidden": true,
              }),
            );
          }),
        ),
        h(
          "div",
          { className: "pmda-tab-actions" },
          h(
            "div",
            { className: "pmda-tab-new-wrap", ref: newTabWrapRef },
            h(
              "button",
              {
                type: "button",
                className: "pmda-tab-new",
                "aria-label": "新建侧栏标签",
                "data-new-tab-launcher": "true",
                title: "新建标签",
                "aria-haspopup": "menu",
                "aria-expanded": newTabOpen,
                onClick: () => setNewTabOpen((value) => !value),
              },
              ICONS.plus,
            ),
            newTabOpen
              ? h(
                  "div",
                  { className: "pmda-tab-new-menu", role: "menu" },
                  ...[
                    ["communication", "沟通"],
                    ["data-agent", "数据洞察"],
                    ["task-drafts", "任务草稿"],
                  ].map(([type, text]) =>
                    h(
                      "button",
                      {
                        key: type,
                        type: "button",
                        className: "pmda-tab-new-item",
                        role: "menuitem",
                        "data-new-tab-type": type,
                        onClick: () => {
                          window.__pluginmaxSidePanel?.openNewTab(type);
                          setNewTabOpen(false);
                        },
                      },
                      ICONS[labels[type]],
                      h("span", null, text),
                    ),
                  ),
                )
              : null,
          ),
          h(
            "button",
            {
              type: "button",
              className: "pmda-tab-action",
              title: snapshot.expanded ? "还原侧边栏" : "展开侧边栏",
              "aria-label": snapshot.expanded
                ? "还原侧边栏"
                : "展开侧边栏",
              onClick: () => window.__pluginmaxSidePanel?.toggleExpanded(),
            },
            snapshot.expanded ? ICONS.collapse : ICONS.expand,
          ),
          h(
            "button",
            {
              type: "button",
              className: "pmda-tab-action pmda-tab-panel",
              title: "关闭侧边栏",
              "aria-label": "关闭侧边栏",
              onClick: () => window.__pluginmaxSidePanel?.closeAll(),
            },
            ICONS.panel,
          ),
        ),
      );
    }

    function GlobalDataAgentAction() {
      const snapshot = useSidePanel();
      const active = snapshot.open === true;
      const openWorkspace = () => {
        const panel = window.__pluginmaxSidePanel;
        const tabs = ["communication", "data-agent", "task-drafts"];
        if (typeof panel?.openWorkspace === "function") {
          panel.openWorkspace(tabs, "communication");
          return;
        }
        panel?.openTab("communication");
        panel?.openTab("data-agent");
        panel?.openTab("task-drafts");
        panel?.openTab("communication");
      };
      if (active) return null;
      return h(
        "button",
        {
          type: "button",
          className: "pmda-action workspace",
          title: "打开侧边栏",
          "aria-label": "打开侧边栏",
          "aria-pressed": false,
          onClick: openWorkspace,
        },
        ICONS.panel,
      );
    }

    function inlineMarkdown(text, keyBase) {
      const nodes = [];
      const pattern =
        /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
      let cursor = 0;
      let index = 0;
      let match = pattern.exec(text);
      while (match !== null) {
        if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
        if (match[2] !== undefined) {
          nodes.push(h("strong", { key: `${keyBase}-b-${index}` }, match[2]));
        } else if (match[3] !== undefined) {
          nodes.push(h("code", { key: `${keyBase}-c-${index}` }, match[3]));
        } else if (match[4] !== undefined && match[5] !== undefined) {
          nodes.push(
            h(
              "a",
              {
                key: `${keyBase}-a-${index}`,
                href: match[5],
                target: "_blank",
                rel: "noreferrer",
              },
              match[4],
            ),
          );
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

    function renderMarkdownDocument(markdown, options = {}) {
      const lines = String(markdown ?? "").replace(/\r/g, "").split("\n");
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
          const src =
            options.resolveImage?.(name) ??
            (/^https?:\/\/[^\s]+$/i.test(name) ? name : undefined);
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
      return h(
        "div",
        { className: options.className ?? "pmda-chat-md" },
        ...blocks,
      );
    }

    function renderReportMarkdown(report) {
      return renderMarkdownDocument(report?.markdown, {
        className: "pmda-report-doc",
        resolveImage: (name) => reportImageData(report, name),
      });
    }

    function renderChatMarkdown(markdown) {
      return renderMarkdownDocument(markdown, {
        className: "pmda-chat-md",
      });
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
          h("span", null, "·"),
          attachment.entityId
            ? h("code", null, attachment.entityId)
            : h("span", null, "页面片段"),
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

    function ClarificationCard({ pending }) {
      const questions = Array.isArray(pending?.questions) ? pending.questions : [];
      const [drafts, setDrafts] = react.useState({});
      const [busy, setBusy] = react.useState("");
      const [error, setError] = react.useState("");

      react.useEffect(() => {
        setDrafts({});
        setBusy("");
        setError("");
      }, [pending?.key]);

      const draftFor = (id) =>
        drafts[id] ?? { selected: [], custom: "" };
      const updateDraft = (id, patch) => {
        setDrafts((current) => {
          const draft = current[id] ?? { selected: [], custom: "" };
          return {
            ...current,
            [id]: { ...draft, ...patch },
          };
        });
      };
      const toggleOption = (question, label) => {
        const draft = draftFor(question.id);
        if (question.multiSelect === true) {
          const selected = draft.selected.includes(label)
            ? draft.selected.filter((item) => item !== label)
            : [...draft.selected, label];
          updateDraft(question.id, { selected });
          return;
        }
        updateDraft(question.id, {
          selected: draft.selected.includes(label) ? [] : [label],
          custom: "",
        });
      };
      const completed = questions.every((question) => {
        const draft = draftFor(question.id);
        return draft.selected.length > 0 || draft.custom.trim() !== "";
      });
      const submit = async () => {
        if (!completed || busy !== "" || pending?.answer === undefined) return;
        setBusy("answer");
        setError("");
        try {
          await pending.answer({
            answers: questions.map((question) => {
              const draft = draftFor(question.id);
              const custom = draft.custom.trim();
              return {
                id: question.id,
                selected:
                  custom === "" || question.multiSelect === true
                    ? draft.selected
                    : [],
                ...(custom === "" ? {} : { custom }),
              };
            }),
          });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setBusy("");
        }
      };
      const cancel = async () => {
        if (busy !== "" || pending?.cancel === undefined) return;
        setBusy("cancel");
        setError("");
        try {
          await pending.cancel();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setBusy("");
        }
      };

      if (questions.length === 0) return null;
      return h(
        "section",
        {
          className: "pmda-clarification",
          "aria-label": "Data Agent 需要补充信息",
        },
        h(
          "div",
          { className: "pmda-clarification-head" },
          h(
            "div",
            null,
            h("h3", null, "需要你补充一点信息"),
            h("p", null, "回答后 Data Agent 会继续当前任务。"),
          ),
        ),
        ...questions.map((question) =>
          h(
            "div",
            { className: "pmda-clarification-question", key: question.id },
            h(
              "h4",
              null,
              question.header === undefined
                ? question.question
                : `${question.header}：${question.question}`,
            ),
            question.detail === undefined
              ? null
              : h("p", null, question.detail),
            (question.options ?? []).length === 0
              ? null
              : h(
                  "div",
                  {
                    className: "pmda-clarification-options",
                    role:
                      question.multiSelect === true ? "group" : "radiogroup",
                  },
                  ...question.options.map((option) => {
                    const selected = draftFor(question.id).selected.includes(
                      option.label,
                    );
                    return h(
                      "button",
                      {
                        key: option.label,
                        type: "button",
                        className: `pmda-clarification-option${selected ? " selected" : ""}`,
                        role:
                          question.multiSelect === true
                            ? "checkbox"
                            : "radio",
                        "aria-checked": selected,
                        title: option.description,
                        onClick: () => toggleOption(question, option.label),
                      },
                      option.label,
                    );
                  }),
                ),
            h("textarea", {
              className: "pmda-clarification-input",
              rows: 2,
              value: draftFor(question.id).custom,
              placeholder: "也可以直接输入补充说明",
              "aria-label": `回答：${question.question}`,
              onChange: (event) =>
                updateDraft(question.id, {
                  custom: event.target.value,
                  ...(question.multiSelect === true
                    ? {}
                    : { selected: [] }),
                }),
            }),
          ),
        ),
        error === "" ? null : h("div", { className: "pmda-error" }, error),
        h(
          "div",
          { className: "pmda-clarification-actions" },
          h(
            "button",
            {
              type: "button",
              className: "pmda-btn",
              disabled: busy !== "",
              onClick: () => void cancel(),
            },
            "取消",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pmda-btn primary",
              disabled: !completed || busy !== "",
              onClick: () => void submit(),
            },
            busy === "answer" ? "提交中…" : "继续",
          ),
        ),
      );
    }

    function ReportCard({ report, onOpen, onDownload }) {
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
            : null,
        ),
      );
    }

    function DataAgentTeammateSettings(props) {
      const enabled =
        props?.teammate?.systemKey === "data-agent" ||
        props?.teammate?.id === "data-agent";
      const [workspaceId, setWorkspaceId] = react.useState(
        props?.workspaceId ?? "",
      );
      const [phase, setPhase] = react.useState("loading");
      const [config, setConfig] = react.useState(null);
      const [access, setAccess] = react.useState(null);
      const [defaultTimeRange, setDefaultTimeRange] = react.useState("7d");
      const [clarificationMode, setClarificationMode] = react.useState("hybrid");
      const [maxRowsPerQuery, setMaxRowsPerQuery] = react.useState(500);
      const [resetConfirm, setResetConfirm] = react.useState(false);
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");

      react.useEffect(() => {
        if (!enabled) return undefined;
        let disposed = false;
        const load = async () => {
          setPhase("loading");
          setError("");
          try {
            const target =
              props?.workspaceId ||
              workspaceId ||
              (await workspaceOptions())[0]?.id ||
              "";
            if (target === "") {
              throw new Error("请先加入一个项目后再配置 Data Agent。");
            }
            const result = await request(
              `${API}?workspaceId=${encodeURIComponent(target)}`,
            );
            if (disposed) return;
            setWorkspaceId(target);
            setConfig(result.workspaceConfig);
            setAccess(result.access);
            setDefaultTimeRange(result.workspaceConfig.defaultTimeRange ?? "7d");
            setClarificationMode(
              result.workspaceConfig.clarificationMode ?? "hybrid",
            );
            setMaxRowsPerQuery(result.workspaceConfig.maxRowsPerQuery ?? 500);
            setPhase("ready");
          } catch (cause) {
            if (!disposed) {
              setError(cause instanceof Error ? cause.message : String(cause));
              setPhase("error");
            }
          }
        };
        void load();
        return () => {
          disposed = true;
        };
      }, [enabled, props?.workspaceId]);

      if (!enabled) return null;
      const save = async () => {
        setPhase("saving");
        setError("");
        setNotice("");
        try {
          const result = await request(`${API}/config`, {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              defaultTimeRange,
              clarificationMode,
              maxRowsPerQuery,
            }),
          });
          setConfig(result.workspaceConfig);
          setPhase("ready");
          setNotice("Data Agent 智能体配置已保存。");
          props?.onSaved?.(result.workspaceConfig);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setPhase("ready");
        }
      };
      const reset = async () => {
        setPhase("resetting");
        setError("");
        setNotice("");
        try {
          const result = await request(`${API}/reset`, {
            method: "POST",
            body: JSON.stringify({ workspaceId }),
          });
          setConfig(result.workspaceConfig);
          setDefaultTimeRange(result.workspaceConfig.defaultTimeRange);
          setClarificationMode(result.workspaceConfig.clarificationMode);
          setMaxRowsPerQuery(result.workspaceConfig.maxRowsPerQuery);
          setResetConfirm(false);
          setPhase("ready");
          setNotice("已恢复当前工作区的 Data Agent 默认配置。");
          props?.onSaved?.(result.workspaceConfig);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setPhase("ready");
        }
      };

      return h(
        "section",
        { className: "pmtm-block pmda-teammate-config" },
        h(
          "div",
          { className: "pmda-teammate-config-head" },
          h("div", null, h("h3", null, "智能体配置"), h(
            "p",
            null,
            "配置 Data Agent 在当前项目的查询默认值与澄清策略。执行方式和外部运行时使用上方 AI伙伴资料编辑及「运行时设置」页。",
          )),
          h(
            "span",
            { className: "pmda-teammate-config-revision" },
            `revision ${config?.revision ?? "-"}`,
          ),
        ),
        phase === "loading"
          ? h("div", { className: "pmtm-empty" }, "正在加载 Data Agent 配置…")
          : h(
              react.Fragment,
              null,
              error === "" ? null : h("div", { className: "pmda-error" }, error),
              notice === "" ? null : h("div", { className: "pmtm-notice" }, notice),
              h(
                "div",
                { className: "pmda-teammate-config-grid" },
                h(
                  "label",
                  { className: "pmda-teammate-config-field" },
                  h("span", null, "默认时间范围"),
                  h(
                    "select",
                    {
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
                  "label",
                  { className: "pmda-teammate-config-field" },
                  h("span", null, "澄清策略"),
                  h(
                    "select",
                    {
                      value: clarificationMode,
                      onChange: (event) =>
                        setClarificationMode(event.target.value),
                    },
                    h("option", { value: "hybrid" }, "自动 brief，必要时澄清"),
                    h("option", { value: "always-ask" }, "查询前先澄清"),
                    h("option", { value: "default-first" }, "优先使用默认范围"),
                  ),
                ),
                h(
                  "label",
                  { className: "pmda-teammate-config-field" },
                  h("span", null, "单次查询行数上限"),
                  h("input", {
                    type: "number",
                    min: 1,
                    max: 100000,
                    value: maxRowsPerQuery,
                    onChange: (event) =>
                      setMaxRowsPerQuery(
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                  }),
                ),
                h(
                  "div",
                  { className: "pmda-teammate-config-field readonly" },
                  h("span", null, "外部运行时"),
                  h(
                    "strong",
                    null,
                    (props?.teammate?.execution ?? "builtin") === "external"
                      ? props?.teammate?.externalRuntimeId ?? "未选择"
                      : "平台内置运行时",
                  ),
                  h("small", null, "在 AI伙伴资料编辑中切换，或在“运行时设置”页管理运行时。"),
                ),
              ),
              h(
                "div",
                { className: "pmda-teammate-config-foot" },
                h(
                  "span",
                  null,
                  `${config?.dataConnectionIds?.length ?? 0} 个只读连接`,
                ),
                resetConfirm
                  ? h(
                      react.Fragment,
                      null,
                      h("button", {
                        type: "button",
                        className: "pmtm-btn secondary small",
                        onClick: () => setResetConfirm(false),
                      }, "取消"),
                      h("button", {
                        type: "button",
                        className: "pmtm-btn secondary small",
                        disabled: phase === "resetting" || access?.canManage !== true,
                        onClick: () => void reset(),
                      }, phase === "resetting" ? "恢复中…" : "确认恢复"),
                    )
                  : h(
                      "button",
                      {
                        type: "button",
                        className: "pmtm-btn secondary small",
                        disabled: access?.canManage !== true,
                        onClick: () => setResetConfirm(true),
                      },
                      "恢复默认",
                    ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmtm-btn primary small",
                    disabled:
                      phase === "saving" ||
                      phase === "resetting" ||
                      access?.canManage !== true,
                    onClick: () => void save(),
                  },
                  phase === "saving" ? "保存中…" : "保存配置",
                ),
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
      const [taskCaptureOpen, setTaskCaptureOpen] = react.useState(false);
      const chatRef = react.useRef(null);
      const reportRef = react.useRef(null);
      const reportScroll = react.useRef(0);
      const inputRef = react.useRef(null);
      const activeRef = react.useRef(false);
      const focusOnOpenRef = react.useRef(false);
      const lastWorkspaceRef = react.useRef("");
      const newConversationRef = react.useRef(false);
      const loadingConversation = react.useRef("");
      const activeDataAgentTabRef = react.useRef("");
      const activeDescriptor =
        sidePanel.open === true && sidePanel.activeTab !== undefined
          ? window.__pluginmaxSidePanel?.describeTab?.(sidePanel.activeTab)
          : undefined;
      const activeDataAgentTab =
        activeDescriptor?.type === "data-agent"
          ? sidePanel.activeTab
          : "";
      activeDataAgentTabRef.current = activeDataAgentTab;
      const active = activeDataAgentTab !== "";
      react.useEffect(() => {
        setTaskCaptureOpen(false);
      }, [conversationId]);
      const pendingInteractions =
        props?.useSessionPendingInteraction?.((state) => state) ??
        new Map();

      const showToast = react.useCallback((message) => {
        setToast(message);
        window.setTimeout(() => setToast(""), 2600);
      }, []);

      const loadConversation = react.useCallback(async (id) => {
        if (id === "" || loadingConversation.current === id) return;
        const requestedTab = activeDataAgentTab;
        loadingConversation.current = id;
        try {
          const result = await request(
            `${API}/conversation?id=${encodeURIComponent(id)}`,
          );
          if (requestedTab !== "") {
            window.__pluginmaxSidePanel?.updateTab?.(requestedTab, {
              sessionId: result.conversation.id,
              title:
                result.conversation.title?.trim() ||
                "数据洞察会话",
            });
          }
          if (activeDataAgentTabRef.current !== requestedTab) return;
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
          if (activeDataAgentTabRef.current !== requestedTab) return;
          if (cause.code !== "not_found") setError(cause.message);
          setConversationId("");
          setPayload(null);
        } finally {
          loadingConversation.current = "";
        }
      }, [activeDataAgentTab, workspaceId]);

      react.useEffect(() => {
        if (activeDataAgentTab === "") return;
        const descriptor =
          window.__pluginmaxSidePanel?.describeTab?.(activeDataAgentTab);
        const sessionId = descriptor?.sessionId ?? "";
        if (sessionId !== "") {
          void loadConversation(sessionId);
          return;
        }
        setConversationId("");
        setPayload(null);
        setError("");
      }, [activeDataAgentTab, loadConversation]);

      react.useEffect(() => {
        if (!active) return;
        const pending = window.__pluginmaxPendingDataAgentConversation;
        if (
          pending === null ||
          typeof pending !== "object" ||
          typeof pending.conversationId !== "string" ||
          pending.conversationId === ""
        ) {
          return;
        }
        window.__pluginmaxPendingDataAgentConversation = null;
        if (
          typeof pending.workspaceId === "string" &&
          pending.workspaceId !== ""
        ) {
          setWorkspaceId(pending.workspaceId);
        }
        void loadConversation(pending.conversationId);
      }, [active, loadConversation]);

      const loadWorkspaceData = react.useCallback(async () => {
        if (workspaceId === "") return;
        setStatus("loading");
        try {
          const [bootstrap, identityResult, conversationResult] = await Promise.all([
            request(`${API}?workspaceId=${encodeURIComponent(workspaceId)}`),
            request(`/api/collab/teammates/detail?teammateId=data-agent`).catch(
              () => ({ teammate: null }),
            ),
            request(
              `${API}/conversations?workspaceId=${encodeURIComponent(workspaceId)}`,
            ),
          ]);
          setIdentity(identityResult.teammate ?? bootstrap.identity);
          setConfig(bootstrap.workspaceConfig);
          setAccess(bootstrap.access);
          setConversations(conversationResult.conversations ?? []);
          if (newConversationRef.current) {
            newConversationRef.current = false;
            setConversationId("");
            setPayload(null);
          } else {
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
          workspaceOptions(),
          request("/api/collab/auth/me").catch(() => ({ user: null })),
        ])
          .then(([memberships]) => {
            if (disposed) return;
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
        const becameActive = active && !activeRef.current;
        activeRef.current = active;
        if (becameActive) focusOnOpenRef.current = true;
      }, [active]);

      react.useEffect(() => {
        if (
          !active ||
          !focusOnOpenRef.current ||
          view !== "chat" ||
          status === "loading"
        ) {
          return undefined;
        }
        const timer = window.setTimeout(() => {
          inputRef.current?.focus();
          if (document.activeElement === inputRef.current) {
            focusOnOpenRef.current = false;
          }
        }, 0);
        return () => window.clearTimeout(timer);
      }, [active, status, view]);

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
            // A selection from another workspace must not inherit attachments
            // from the previous workspace's authorization scope.
            setPendingSelections([]);
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
      const pendingClarification =
        activeRun?.runtimeSessionId === undefined
          ? undefined
          : pendingInteractions.get(activeRun.runtimeSessionId);
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

      const createConversation = () => {
        newConversationRef.current = true;
        setConversationId("");
        setPayload(null);
        setPendingSelections([]);
        setDraft("");
        setView("chat");
        if (activeDataAgentTab !== "") {
          window.__pluginmaxSidePanel?.updateTab?.(activeDataAgentTab, {
            sessionId: "",
            title: "新数据洞察",
          });
        }
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
              : null,
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
                        onDownload: (item, format) =>
                          void downloadReport(item, format).catch((cause) =>
                            setError(cause.message),
                          ),
                      })
                    : h(
                        "div",
                        { className: "pmda-bubble" },
                        user
                          ? message.content
                          : renderChatMarkdown(message.content),
                      ),
                );
              }),
              pendingClarification
                ? h(ClarificationCard, {
                    pending: pendingClarification,
                  })
                : null,
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
                          ? "等待你回答澄清问题…"
                          : pendingClarification
                            ? "等待你回答澄清问题…"
                            : "正在处理你的问题…",
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
            conversationId !== "" && (payload?.messages ?? []).length > 0
              ? h(
                  "div",
                  { className: "pmda-note" },
                  h("span", null, "可从本次对话整理任务草稿"),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmda-btn",
                      onClick: () => {
                        const detail = {
                          sourceType: "data-agent",
                          sourceId: conversationId,
                          sourceTitle:
                            payload?.conversation?.title ?? "Data Agent 对话",
                          workspaceId,
                          messageIds: [],
                          selectionText: "",
                          messageOptions: (payload?.messages ?? []).map(
                            (message) => ({
                              id: message.id,
                              senderName:
                                message.role === "user" ? "我" : "Data Agent",
                              content: message.content,
                              createdAt: message.createdAt,
                            }),
                          ),
                          actionItemIds: [],
                        };
                        window.__pluginmaxTaskDraftContext = detail;
                        window.__pluginmaxSidePanel?.openTab("task-drafts");
                        window.dispatchEvent(
                          new CustomEvent("pluginmax:task-draft-open", {
                            detail,
                          }),
                        );
                      },
                    },
                    "整理任务",
                  ),
                )
              : null,
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
            className: `pmda-panel-root${sidePanel.expanded ? " expanded" : ""}`,
            style: active ? undefined : { display: "none" },
            "data-data-agent-panel": "true",
          },
          h(
            "aside",
            { className: "pmda-panel", "aria-label": "Data Agent" },
            h(SidePanelTabs),
            h(
              "div",
              { className: "pmda-context" },
              h(
                "div",
                { className: "pmda-context-controls" },
                h(
                  "label",
                  { className: "pmda-context-group pmda-context-workspace" },
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
                        setPendingSelections([]);
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
                ),
                h(
                  "label",
                  {
                    className:
                      "pmda-context-group pmda-context-conversation",
                  },
                  h("span", null, "会话："),
                  h(
                    "select",
                    {
                      value: conversationId,
                      "aria-label": "切换 Data Agent 会话",
                      disabled: conversations.length === 0,
                      onChange: (event) => {
                        const id = event.target.value;
                        if (id === "") createConversation();
                        else void loadConversation(id);
                      },
                    },
                    h("option", { value: "" }, "新会话"),
                    ...conversations.map((item) =>
                      h(
                        "option",
                        { key: item.id, value: item.id },
                        item.title,
                      ),
                    ),
                  ),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmda-btn pmda-context-new",
                    onClick: createConversation,
                  },
                  ICONS.plus,
                  "新会话",
                ),
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
            taskCaptureOpen &&
            conversationId !== "" &&
            typeof props?.renderSlot === "function"
              ? props.renderSlot("pluginmax.data-agent.task-capture", {
                  mode: "rail",
                  sourceType: "data-agent",
                  sourceId: conversationId,
                  sourceTitle:
                    payload?.conversation?.title ?? "Data Agent 对话",
                  workspaceId,
                  messageIds: [],
                  messageOptions: (payload?.messages ?? []).map((message) => ({
                    id: message.id,
                    senderName:
                      message.role === "user" ? "我" : "Data Agent",
                    content: message.content,
                    createdAt: message.createdAt,
                  })),
                  actionItemIds: [],
                  onClose: () => setTaskCaptureOpen(false),
                  onSaved: () => {
                    window.dispatchEvent(
                      new CustomEvent("pluginmax:task-capture-refresh"),
                    );
                  },
                })
              : null,
          ),
        ),
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
      window.__pluginmaxSidePanel?.registerType?.({
        type: "data-agent",
        defaultTitle: "数据洞察",
        newTabTitle: (ordinal) => `新数据洞察 ${ordinal}`,
        singleton: false,
        closable: true,
        draggable: true,
      });
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
            children: {
              "pluginmax.data-agent.task-capture": {
                kind: "single",
                scope: "root",
              },
            },
          },
          DataAgentPanel,
        ),
      );
      ctx.slots.inject("pluginmax.teammate.data-agent-settings", () =>
        ctx.slots.register(
          {
            name: "pluginmax.teammate.data-agent-settings",
            id: "pluginmax-data-agent-teammate-settings",
            order: 20,
          },
          DataAgentTeammateSettings,
        ),
      );
    };

    return module.exports;
  },
});
