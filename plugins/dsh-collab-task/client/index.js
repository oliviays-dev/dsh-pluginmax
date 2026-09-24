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
    ];
    const STATUS_LABEL = Object.fromEntries(
      STATUSES.map((status) => [status.key, status.label]),
    );

    const styles = `
      .pmtask{min-height:100%;display:flex;flex-direction:column;padding:18px 20px 30px;color:var(--dsw-alias-label-primary);}
      .pmtask *{box-sizing:border-box;}
      .pmtask-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;}
      .pmtask-head h1{margin:0;font-size:19px;line-height:1.3;}
      .pmtask-sub{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtask-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .pmtask-select,.pmtask-input,.pmtask-area{height:34px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:0 9px;min-width:0;}
      .pmtask-area{height:auto;padding:8px 9px;resize:vertical;}
      .pmtask-btn{height:34px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:6px;padding:0 12px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;}
      .pmtask-btn.secondary{background:transparent;border:0.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);}
      .pmtask-btn.danger{background:transparent;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 45%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-btn:disabled{opacity:.45;cursor:not-allowed;}
      .pmtask-icon-btn:disabled,.pmtask-tool-btn:disabled,.pmtask-assign-trigger:disabled,.pmtask-input:disabled,.pmtask-composer-input:disabled{opacity:.5;cursor:not-allowed;}
      .pmtask-locked-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;}
      .pmtask-filter{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:14px;padding:10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-notice{flex:none;min-height:38px;padding:8px 10px;}
      .pmtask-search{display:flex;align-items:center;gap:6px;flex:1 1 260px;min-width:220px;}
      .pmtask-search .pmtask-input{flex:1 1 auto;}
      .pmtask-token{height:28px;border:0;border-radius:6px;padding:0 9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
      .pmtask-token.active{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:stretch;flex:1;min-height:max(420px,calc(100vh - 255px));}
      .pmtask-column{min-width:0;min-height:100%;display:flex;flex-direction:column;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmtask-column.drop-ready{border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 1px var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-column-head{display:grid;grid-template-columns:8px minmax(0,1fr) auto auto;align-items:center;gap:7px;padding:10px 10px 8px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
      .pmtask-column-head strong{font-size:12.5px;}
      .pmtask-column-count{color:var(--dsw-alias-label-tertiary);font-size:11px;}
      .pmtask-column-add{width:24px;height:24px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtask-column-add:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtask-column-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary);}
      .pmtask-column-dot.progress{background:#4f8ef7}.pmtask-column-dot.review{background:#e2a737}.pmtask-column-dot.done{background:#34d47e}
      .pmtask-cards{flex:1;display:grid;gap:7px;align-content:start;padding:8px;}
      .pmtask-card{display:grid;gap:7px;padding:10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;}
      .pmtask-card:hover{border-color:var(--dsw-alias-border-l4);}
      .pmtask-card.dragging{opacity:.55;}
      .pmtask-card.running{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 38%,transparent);}
      .pmtask-card.archived{opacity:.72;border-style:dashed;}
      .pmtask-card.highlighted{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 10%,var(--dsw-alias-bg-layer-2));}
      .pmtask-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:14px;}
      .pmtask-id{color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-spinner{width:14px;height:14px;flex:none;display:inline-block;border-radius:50%;border:2px solid color-mix(in srgb,var(--dsw-alias-label-tertiary) 38%,transparent);border-top-color:var(--dsw-alias-accent-primary,#4f8ef7);animation:pmtask-spin .8s linear infinite;}
      .pmtask-spinner.lg{width:16px;height:16px;}
      @keyframes pmtask-spin{to{transform:rotate(360deg);}}
      .pmtask-title{font-size:13px;font-weight:650;line-height:1.35;}
      .pmtask-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.45;}
      .pmtask-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmtask-pill{display:inline-flex;align-items:center;height:20px;border-radius:6px;padding:0 6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-base));white-space:nowrap;}
      .pmtask-pill.p1{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtask-pill.progress{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmtask-pill.review{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 14%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmtask-pill.done{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 14%,transparent);color:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmtask-pill.archived{background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 18%,transparent);color:var(--dsw-alias-label-secondary);}
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
      .pmtask-steps{display:grid;gap:6px;}
      .pmtask-step{display:flex;align-items:flex-start;gap:8px;font-size:12px;}
      .pmtask-messages{max-height:360px;overflow:auto;display:grid;gap:8px;padding:2px;}
      .pmtask-message{border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;padding:8px;background:var(--dsw-alias-bg-layer-2);}
      .pmtask-message.agent{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,transparent);}
      .pmtask-message.streaming{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 65%,transparent);}
      .pmtask-message-head{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--dsw-alias-label-secondary);}
      .pmtask-message-head strong{font-size:12.5px;font-weight:700;}
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
      .pmtask-mention-item{width:100%;display:grid;grid-template-columns:26px minmax(0,1fr);align-items:center;gap:8px;border:0;border-radius:6px;padding:7px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;}
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
      .pmtask-assign-trigger-content{min-width:0;display:flex;align-items:center;gap:7px;}
      .pmtask-assign-trigger-copy{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-menu-list{position:absolute;right:auto;left:0;top:calc(100% + 5px);z-index:20;min-width:200px;max-height:300px;overflow-y:auto;display:grid;gap:2px;padding:4px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 14px 34px rgba(0,0,0,.28);}
      .pmtask-menu-list button{min-height:28px;text-align:left;border:0;border-radius:4px;padding:5px 7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;}
      .pmtask-menu-list button:hover{background:var(--dsw-alias-bg-layer-3);}
      .pmtask-receiver-option{display:flex;align-items:center;gap:8px;min-width:220px;}
      .pmtask-receiver-option-copy{min-width:0;display:grid;gap:1px;}
      .pmtask-receiver-option-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtask-receiver-option-meta{color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtask-receiver-option .pmtask-avatar,.pmtask-receiver-option .pmtask-ring{width:24px;height:24px;}
      .pmtask-detail{display:block;}
      .pmtask-detail-page,.pmtask-detail-page *{box-sizing:border-box;}
      .pmtask-detail-page{overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));font-size:14px;line-height:1.5;}
      .pmtask-detail-top{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent);margin-bottom:0;}
      .pmtask-back-btn{height:auto;min-height:30px;padding:4px 9px;font-size:11px;border-width:1px;}
      .pmtask-detail-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,36%);min-height:520px;}
      .pmtask-detail-main{min-width:0;display:block;padding:16px;border-right:1px solid var(--dsw-alias-border-l2);}
      .pmtask-detail-side{min-width:0;display:flex;flex-direction:column;gap:0;padding-left:18px;background:transparent;}
      .pmtask-side-section{margin-top:18px;padding:14px 0 0;border-top:1px solid var(--dsw-alias-border-l2);}
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
      .pmtask-composer .pmtask-mention-menu{left:72px;top:38px;bottom:auto;width:min(320px,calc(100% - 84px));}
      .pmtask-detail-section{margin-top:18px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtask-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}
      .pmtask-history-head h3{margin:0 0 8px;font-size:13px;}
      .pmtask-history-head span{color:var(--dsw-alias-label-tertiary);font-size:10.5px;white-space:nowrap;}
      .pmtask-history{display:grid;gap:12px;max-height:240px;overflow-y:auto;padding-right:3px;}
      .pmtask-history-message,.pmtask-history-event{display:grid;grid-template-columns:28px minmax(0,1fr);gap:9px;align-items:start;}
      .pmtask-history-message .pmtask-avatar,.pmtask-history-event .pmtask-event-avatar{width:28px;height:28px;border-radius:50%;}
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
      .pmtask-comment-list>.pmtask-empty,.pmtask-history>.pmtask-empty{padding:36px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:13px;}
      .pmtask-detail-section>.pmtask-empty{padding:28px 10px;}
      .pmtask-mask{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.24);backdrop-filter:blur(2px);}
      .pmtask-modal{width:min(620px,calc(100vw - 40px));max-height:min(720px,calc(100vh - 40px));overflow:auto;display:grid;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 22px 54px rgba(0,0,0,.22);}
      .pmtask-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .pmtask-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
      .pmtask-span-2{grid-column:1 / -1;}
      .pmtask-modal.pmtask-confirm{width:min(440px,calc(100vw - 40px));gap:10px;}
      .pmtask-modal.pmtask-confirm h2{margin:0;font-size:15px;font-weight:700;}
      .pmtask-confirm-text{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.65;overflow-wrap:anywhere;}
      .pmtask-confirm-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;}
      .pmtask-confirm-actions .pmtask-btn{height:32px;padding:0 12px;font-size:12px;}
      .pmtask-btn.danger-solid{background:var(--dsw-alias-state-error-primary,#e5534b);color:#fff;}
      .pmtask-empty{padding:46px 18px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12.5px;}
      @media(max-width:1100px){.pmtask-board{grid-template-columns:repeat(4,260px);overflow-x:auto;}}
      @media(max-width:900px){.pmtask-detail-layout{grid-template-columns:1fr}.pmtask-detail-main{border-right:0;border-bottom:0.5px solid var(--dsw-alias-border-l2);}.pmtask-detail-top .pmtask-crumb{flex-basis:100%;order:3}.pmtask-grid-demo{grid-template-columns:repeat(2,minmax(0,1fr));}}
      @media(max-width:700px){.pmtask{padding:14px}.pmtask-head{flex-direction:column}.pmtask-modal-grid{grid-template-columns:1fr}.pmtask-board{grid-template-columns:repeat(4,240px)}}
    `;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const headers = { ...options.headers };
      const current = token();
      if (current !== null) headers.authorization = `Bearer ${current}`;
      if (options.body !== undefined) headers["content-type"] = "application/json";
      const response = await fetch(path, {
        ...options,
        headers,
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(body?.error?.message ?? `HTTP ${response.status}`);
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
      { id: "sky", bg: "#d9efff", shirt: "#568fd8", skin: "#f1c5a3", hair: "#244d77", accent: "#ffd166", hairStyle: "wave", glasses: false },
      { id: "sunset", bg: "#ffe5d8", shirt: "#db6d65", skin: "#d99a76", hair: "#743d2d", accent: "#ff8d7a", hairStyle: "bun", glasses: false },
      { id: "forest", bg: "#def6e8", shirt: "#3f9d73", skin: "#e3b08d", hair: "#245543", accent: "#67d4a1", hairStyle: "side", glasses: false },
      { id: "berry", bg: "#f1e2ff", shirt: "#7d59c6", skin: "#efb38f", hair: "#533275", accent: "#c06cff", hairStyle: "bob", glasses: false },
      { id: "lemon", bg: "#fff3c9", shirt: "#d7a62e", skin: "#d49974", hair: "#414554", accent: "#f2cb45", hairStyle: "wave", glasses: true },
      { id: "ocean", bg: "#d9f4ff", shirt: "#2f84a8", skin: "#ce9874", hair: "#164f6f", accent: "#4fc3e8", hairStyle: "bun", glasses: true },
    ];

    function avatarHair(preset) {
      const fill = preset.hair;
      if (preset.hairStyle === "bun") {
        return [
          h("circle", { key: "bun", cx: 47, cy: 14, r: 6, fill }),
          h("path", { key: "bun-body", d: "M16 29c0-12 7-19 16-19 9 0 16 7 16 19-5-3-8-8-9-12-5 7-14 11-23 12Z", fill }),
        ];
      }
      if (preset.hairStyle === "side") {
        return [
          h("path", { key: "side", d: "M17 27c1-11 8-17 17-17 8 0 14 5 15 15-7-1-11-5-14-10-4 6-11 10-18 12Z", fill }),
        ];
      }
      if (preset.hairStyle === "bob") {
        return [
          h("path", { key: "bob", d: "M16 28c0-12 7-18 16-18s16 7 16 18v13h-6V30c-7 1-13-1-19-6-1 5-3 8-7 10Z", fill }),
        ];
      }
      return [
        h("path", { key: "wave", d: "M16 29c0-12 7-19 17-19 10 0 16 7 16 19-4-2-7-6-9-10-5 6-14 9-24 10Z", fill }),
      ];
    }

    function avatarArt(value, key) {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        return h("img", { key, className: "pmtask-avatar-art", src: value, alt: "" });
      }
      const preset =
        AVATAR_PRESETS.find((item) => item.id === value) ?? AVATAR_PRESETS[0];
      const children = [
        h("rect", { key: "bg", width: 64, height: 64, fill: preset.bg }),
        h("circle", { key: "a1", cx: 52, cy: 12, r: 10, fill: preset.accent, opacity: 0.28 }),
        h("circle", { key: "a2", cx: 10, cy: 52, r: 14, fill: preset.accent, opacity: 0.18 }),
        h("rect", { key: "neck", x: 28, y: 39, width: 8, height: 11, rx: 4, fill: preset.skin }),
        h("path", { key: "shirt", d: "M9 64c2-13 11-20 23-20s21 7 23 20Z", fill: preset.shirt }),
        h("circle", { key: "ear-l", cx: 18, cy: 30, r: 4, fill: preset.skin }),
        h("circle", { key: "ear-r", cx: 46, cy: 30, r: 4, fill: preset.skin }),
        h("circle", { key: "face", cx: 32, cy: 29, r: 16, fill: preset.skin }),
        ...avatarHair(preset),
        h("circle", { key: "eye-l", cx: 25.5, cy: 31, r: 1.8, fill: "#20232a" }),
        h("circle", { key: "eye-r", cx: 38.5, cy: 31, r: 1.8, fill: "#20232a" }),
        h("path", { key: "mouth", d: "M27 38c3 3 7 3 10 0", fill: "none", stroke: "#9a5c52", strokeWidth: 1.8, strokeLinecap: "round" }),
      ];
      if (preset.glasses) {
        children.push(
          h("g", { key: "glasses", fill: "none", stroke: preset.hair, strokeWidth: 1.8 }, [
            h("circle", { key: "g1", cx: 25.5, cy: 31, r: 4 }),
            h("circle", { key: "g2", cx: 38.5, cy: 31, r: 4 }),
            h("path", { key: "g3", d: "M29.5 31h5" }),
          ]),
        );
      }
      children.push(
        h("circle", { key: "shine", cx: 42, cy: 24, r: 3, fill: "#fff", opacity: 0.2 }),
      );
      return h(
        "svg",
        { key, className: "pmtask-avatar-art", viewBox: "0 0 64 64", "aria-hidden": "true" },
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

    const RUNNING_MESSAGE_STATES = ["queued", "running", "waiting_input"];

    function latestRunState(task) {
      const messages = task?.messages ?? [];
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.runId !== undefined && message.state !== undefined) {
          return message.state;
        }
      }
      return undefined;
    }

    function taskHasActiveRun(task) {
      // 只看最近一次 run 的状态：历史里旧的 running 消息不代表现在还在跑。
      return RUNNING_MESSAGE_STATES.includes(latestRunState(task));
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

    function receiverDisplay(task, directory) {
      if (task.receiverType === "unassigned") return "待指派";
      if (task.receiverType === "role" && task.status === "todo") {
        return `角色待认领（${task.receiverName ?? task.receiverId ?? "角色"}）`;
      }
      const name = task.receiverName ?? task.receiverId ?? "待指派";
      const receiver =
        task.receiverType === "agent"
          ? directory?.agents.find((item) => item.id === task.receiverId)
          : undefined;
      return receiver?.source === "personal" && receiver.ownerName
        ? `${name}（${receiver.ownerName}）`
        : name;
    }

    function receiverKindLabel(type) {
      return type === "agent" ? "DE / 分身" : type === "role" ? "角色认领" : "人员";
    }

    function receiverOptionLabel(item) {
      const name = item?.name ?? "";
      return item?.type === "agent" && item?.source === "personal" && item?.ownerName
        ? `${name}（${item.ownerName}）`
        : name;
    }

    function taskBelongsTo(task, currentUser, directory) {
      if (currentUser === null) return false;
      if (task.receiverType === "human") {
        return task.receiverId === currentUser.id;
      }
      if (task.receiverType === "agent") {
        const receiver = directory.agents.find(
          (item) => item.id === task.receiverId,
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
          nodes.push(h(RichText, { text: value.slice(cursor, match.index), key: `text-${index}` }));
        }
        const token = match[0];
        if (token.startsWith("`")) {
          nodes.push(h("code", { className: "pmtask-md-code", key: `code-${index}` }, token.slice(1, -1)));
        } else if (token.startsWith("**") || token.startsWith("__")) {
          nodes.push(h("strong", { key: `strong-${index}` }, ...renderInlineMarkdown(token.slice(2, -2))));
        } else if (token.startsWith("~~")) {
          nodes.push(h("del", { key: `del-${index}` }, ...renderInlineMarkdown(token.slice(2, -2))));
        } else if (token.startsWith("[")) {
          const separator = token.lastIndexOf("](");
          const label = token.slice(1, separator);
          const href = token.slice(separator + 2, -1);
          let safeHref = null;
          try {
            const url = new URL(href);
            if (url.protocol === "http:" || url.protocol === "https:") safeHref = url.href;
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
          nodes.push(h("em", { key: `em-${index}` }, ...renderInlineMarkdown(token.slice(1, -1))));
        }
        cursor = match.index + token.length;
        index += 1;
        match = pattern.exec(value);
      }
      if (cursor < value.length) {
        nodes.push(h(RichText, { text: value.slice(cursor), key: `text-${index}` }));
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
              { className: "pmtask-md-table-wrap", key: `table-${blocks.length}` },
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
          blocks.push(h("hr", { className: "pmtask-md-hr", key: `hr-${blocks.length}` }));
          index += 1;
          continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
        if (heading !== null) {
          const level = Math.min(6, heading[1].length + 2);
          blocks.push(
            h(
              `h${level}`,
              { className: "pmtask-md-heading", key: `heading-${blocks.length}` },
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
                h("li", { key: `li-${itemIndex}` }, ...renderInlineMarkdown(item)),
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
                h("li", { key: `li-${itemIndex}` }, ...renderInlineMarkdown(item)),
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
                : [h("br", { key: `br-${itemIndex}` }), ...renderInlineMarkdown(item)],
            ),
          ),
        );
      }
      return h("div", { className: "pmtask-markdown" }, ...blocks);
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
                onClick: () => onPick(item.name),
              },
              h(
                "span",
                { className: `pmtask-avatar ${group.key}` },
                group.key === "roles" ? "R" : initials(item.name),
              ),
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

    function byId(items, id) {
      return items.find((item) => item.id === id);
    }

    function TaskGlobalPage(props) {
      const route = props.useShellRoute?.((state) => state.route);
      if (route !== "task") return null;
      return h(TaskWorkspace, props);
    }

    function TaskWorkspace() {
      const [workspaces, setWorkspaces] = react.useState([]);
      const [workspaceFilter, setWorkspaceFilter] = react.useState("");
      const [tasks, setTasks] = react.useState([]);
      const [directory, setDirectory] = react.useState({
        humans: [],
        agents: [],
        roles: [],
      });
      const [currentUser, setCurrentUser] = react.useState(null);
      const [ownership, setOwnership] = react.useState("mine");
      const [search, setSearch] = react.useState("");
      const [searchDraft, setSearchDraft] = react.useState("");
      const [priority, setPriority] = react.useState("");
      const [receiver, setReceiver] = react.useState("");
      const [selectedId, setSelectedId] = react.useState("");
      const [highlightedId, setHighlightedId] = react.useState("");
      const [archivedOnly, setArchivedOnly] = react.useState(false);
      const [createOpen, setCreateOpen] = react.useState(false);
      const [createStatus, setCreateStatus] = react.useState("todo");
      const [assignOpen, setAssignOpen] = react.useState(false);
      const [pendingAssignee, setPendingAssignee] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [error, setError] = react.useState("");
      const dragId = react.useRef("");
      const returnRef = react.useRef(null);
      const suppressOpenUntil = react.useRef(0);

      const notify = () => {
        setError("");
      };
      const fail = (cause, options = {}) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (selectedId !== "" && options.global !== true) {
          setError("");
          setTasks((current) =>
            current.map((task) =>
              task.id === selectedId
                ? {
                    ...task,
                    events: [
                      ...task.events,
                      {
                        id: `local-error-${Date.now()}`,
                        at: new Date().toISOString(),
                        actorId: "system",
                        actorName: "系统",
                        kind: "error",
                        message,
                      },
                    ],
                  }
                : task,
            ),
          );
          return;
        }
        setError(message);
      };

      const load = react.useCallback(async (silent = false) => {
        if (token() === null) {
          setError("请先在账号管理中登录。");
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
          const accessibleOptions = options.filter(
            (workspace) =>
              meResult.user?.role === "admin" || workspace.isMember === true,
          );
          setCurrentUser(meResult.user);
          setWorkspaces(accessibleOptions);
          const activeWorkspaceFilter = accessibleOptions.some(
            (workspace) => workspace.id === workspaceFilter,
          )
            ? workspaceFilter
            : "";
          if (activeWorkspaceFilter !== workspaceFilter) {
            setWorkspaceFilter(activeWorkspaceFilter);
          }
          const requested = accessibleOptions.filter(
            (workspace) =>
              activeWorkspaceFilter === "" ||
              workspace.id === activeWorkspaceFilter,
          );
          const target =
            requested.length === 0 ? accessibleOptions : requested;
          const results = await Promise.all(
            target.map((workspace) =>
              request(
                `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(workspace.id)}`,
              ),
            ),
          );
          const mergedTasks = results.flatMap((result) => result.tasks ?? []);
          const mergedDirectory = {
            humans: [],
            agents: [],
            roles: [],
          };
          for (const result of results) {
            for (const key of ["humans", "agents", "roles"]) {
              for (const item of result.directory?.[key] ?? []) {
                if (!mergedDirectory[key].some((candidate) => candidate.id === item.id)) {
                  mergedDirectory[key].push(item);
                }
              }
            }
          }
          setTasks(mergedTasks);
          setDirectory(mergedDirectory);
          setError("");
          if (!silent) setLoading(false);
        } catch (cause) {
          setLoading(false);
          fail(cause, { global: true });
        }
      }, [workspaceFilter]);

      react.useEffect(() => {
        void load();
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
                tab: pending.returnTab === "definition" ? "definition" : "runtime",
              }
            : null;
        if (typeof pending.workspaceId === "string" && pending.workspaceId !== "") {
          setWorkspaceFilter(pending.workspaceId);
        }
        setArchivedOnly(false);
        setSelectedId(pending.taskId);
        setHighlightedId(pending.taskId);
      }, []);

      const mutate = async (path, body, message, options = {}) => {
        const result = await request(path, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (result.task !== undefined) {
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
        const belongsToMe = taskBelongsTo(task, currentUser, directory);
        const sentByMe =
          currentUser !== null && task.createdBy === currentUser.id;
        if (archivedOnly !== isArchived(task)) return false;
        if (ownership === "mine" && !belongsToMe) return false;
        if (ownership === "sent" && !sentByMe) return false;
        if (priority !== "" && task.priority !== priority) return false;
        if (receiver !== "" && task.receiverId !== receiver) return false;
        if (search.trim() !== "") {
          const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
          const haystack = [
            task.title,
            task.id,
            task.description,
            task.type,
            task.priority,
            receiverDisplay(task),
            statusLabel(task.status),
          ]
            .join(" ")
            .toLowerCase();
          if (!terms.every((term) => haystack.includes(term))) return false;
        }
        return true;
      });

      const selected = byId(tasks, selectedId);
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
        };
        window.addEventListener("pluginmax:route-select", onRouteSelect);
        return () =>
          window.removeEventListener("pluginmax:route-select", onRouteSelect);
      }, []);
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
        return h("section", { className: "pmtask" }, h("style", null, styles), h("div", { className: "pmtask-empty" }, "正在加载任务..."));
      }

      return h(
        "section",
        { className: "pmtask", "data-task-management": true },
        h("style", null, styles),
        error !== "" ? h("div", { className: "pmtask-filter pmtask-notice" }, h("span", { style: { color: "var(--dsw-alias-state-error-primary,#e5534b)" } }, error)) : null,
        h(TaskPageHeader, {
          workspaces,
          workspaceFilter,
          setWorkspaceFilter,
          onRefresh: () => load(true),
          onCreate: (status = "todo") => {
            setCreateStatus(status);
            setCreateOpen(true);
          },
        }),
        selectedId !== "" && selected !== undefined
          ? h(TaskDetail, {
              task: selected,
              workspaceTitle:
                workspaces.find((workspace) => workspace.id === selected.workspaceId)?.title ??
                selected.workspaceId,
              directory,
              currentUser,
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
            })
          : h(TaskBoard, {
              tasks: visibleTasks,
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
              directoryOptions,
              onCreate: (status = "todo") => {
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
              currentWorkspaceId: workspaceFilter,
              initialStatus: createStatus,
              onClose: () => setCreateOpen(false),
              onCreated: async (input) => {
                try {
                  const task = await mutate(
                    "/api/collab/tasks/create",
                    input,
                    "任务已派发",
                  );
                  setCreateOpen(false);
                  setSelectedId("");
                  if (task?.id !== undefined) setHighlightedId(task.id);
                  if (task?.workspaceId !== undefined) {
                    setWorkspaceFilter(task.workspaceId);
                    setOwnership("sent");
                  }
                } catch (cause) {
                  fail(cause);
                }
              },
            })
          : null,
      );
    }

    function TaskPageHeader({
      workspaces,
      workspaceFilter,
      setWorkspaceFilter,
      onRefresh,
      onCreate,
    }) {
      return h(
        "header",
        { className: "pmtask-head" },
        h(
          "div",
          null,
          h("h1", null, "任务管理"),
          h(
            "div",
            { className: "pmtask-sub" },
            "看板、派发、认领、执行记录与验收统一管理",
          ),
        ),
        h(
          "div",
          { className: "pmtask-head-actions" },
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
              h("option", { value: workspace.id, key: workspace.id }, workspace.title),
            ),
          ),
          h(
            "button",
            {
              className: "pmtask-btn secondary",
              type: "button",
              onClick: onRefresh,
            },
            "刷新",
          ),
          h(
            "button",
            {
              className: "pmtask-btn",
              type: "button",
              onClick: () => onCreate("todo"),
            },
            "新建任务",
          ),
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
        directoryOptions,
        onCreate,
        onOpen,
        onDrop,
        dragId,
        onDragStart,
        highlightedId,
      } = props;
      return h(
        Fragment,
        null,
        h(
          "div",
          { className: "pmtask-filter", role: "search" },
          h(
            "select",
            {
              className: "pmtask-select",
              value: ownership,
              onChange: (event) => setOwnership(event.target.value),
              "aria-label": "按派出方筛选任务",
            },
            h("option", { value: "all" }, "全部派出方"),
            h("option", { value: "sent" }, "我派出的"),
            h("option", { value: "mine" }, "我接收的"),
          ),
          h(
            "select",
            { className: "pmtask-select", value: priority, onChange: (event) => setPriority(event.target.value) },
            h("option", { value: "" }, "全部优先级"),
            h("option", { value: "P1" }, "P1"),
            h("option", { value: "P2" }, "P2"),
            h("option", { value: "P3" }, "P3"),
          ),
          h(
            "select",
            { className: "pmtask-select", value: receiver, onChange: (event) => setReceiver(event.target.value) },
            h("option", { value: "" }, "全部接收方"),
            directoryOptions.some((item) => item.type === "human")
              ? h(
                  "optgroup",
                  { label: "人员" },
                  ...directoryOptions
                    .filter((item) => item.type === "human")
                    .map((item) =>
                      h(
                        "option",
                        { value: item.id, key: `${item.type}:${item.id}` },
                        item.name,
                      ),
                    ),
                )
              : null,
            directoryOptions.some((item) => item.type === "agent")
              ? h(
                  "optgroup",
                  { label: "DE / 分身" },
                  ...directoryOptions
                    .filter((item) => item.type === "agent")
                    .map((item) =>
                      h(
                        "option",
                        { value: item.id, key: `${item.type}:${item.id}` },
                        item.ownerName
                          ? receiverOptionLabel({ ...item, type: "agent" })
                          : item.name,
                      ),
                    ),
                )
              : null,
            directoryOptions.some((item) => item.type === "role")
              ? h(
                  "optgroup",
                  { label: "角色" },
                  ...directoryOptions
                    .filter((item) => item.type === "role")
                    .map((item) =>
                      h(
                        "option",
                        { value: item.id, key: `${item.type}:${item.id}` },
                        item.name,
                      ),
                    ),
                )
              : null,
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
              placeholder: "搜索任务标题、ID、描述或接收方",
            }),
            h(
              "button",
              { className: "pmtask-btn secondary", type: "button", onClick: applySearch },
              "搜索",
            ),
          ),
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
          ...STATUSES.map((status) =>
            h(TaskColumn, {
              key: status.key,
              status,
              tasks: tasks.filter((task) => task.status === status.key),
              onOpen,
              onCreate,
              onDrop,
              dragId,
              onDragStart,
              highlightedId,
              directoryOptions,
            }),
          ),
        ),
      );
    }

    function TaskColumn({
      status,
      tasks,
      onOpen,
      onCreate,
      onDrop,
      dragId,
      onDragStart,
      highlightedId,
      directoryOptions,
    }) {
      const [dropReady, setDropReady] = react.useState(false);
      return h(
        "section",
        {
          className: `pmtask-column ${dropReady ? "drop-ready" : ""}`,
          onDragOver: (event) => {
            event.preventDefault();
            setDropReady(true);
          },
          onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDropReady(false);
          },
          onDrop: (event) => {
            event.preventDefault();
            setDropReady(false);
            const taskId = event.dataTransfer.getData("text/plain") || dragId.current;
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
              title: `在${status.label}新建任务`,
              "aria-label": `在${status.label}新建任务`,
              onClick: () => onCreate(status.key),
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
                draggable: !isArchived(task),
                tabIndex: 0,
                role: "button",
                onClick: () => onOpen(task.id),
                onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " ") onOpen(task.id);
                },
                onDragStart: (event) => {
                  if (isArchived(task)) return;
                  dragId.current = task.id;
                  onDragStart();
                  event.dataTransfer.setData("text/plain", task.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.currentTarget.classList.add("dragging");
                },
                onDragEnd: (event) => event.currentTarget.classList.remove("dragging"),
              },
              h(
                "div",
                { className: "pmtask-card-top" },
                h("span", { className: "pmtask-id" }, task.id),
                taskHasActiveRun(task)
                  ? h("span", {
                      className: "pmtask-spinner",
                      role: "status",
                      title: "Agent 正在执行",
                      "aria-label": "Agent 正在执行",
                    })
                  : null,
              ),
              h("div", { className: "pmtask-title" }, task.title),
              h("div", { className: "pmtask-desc" }, task.description),
              h(
                "div",
                { className: "pmtask-meta" },
                h("span", { className: `pmtask-pill ${task.priority === "P1" ? "p1" : ""}` }, task.priority),
                isArchived(task)
                  ? h("span", { className: "pmtask-pill archived" }, "已归档")
                  : null,
                task.receiverType === "unassigned"
                  ? h("span", { className: "pmtask-pill" }, "待指派")
                  : h(
                      "span",
                      { className: "pmtask-assignee" },
                      h(ReceiverAvatar, {
                        option: directoryOptions.find(
                          (item) =>
                            item.type === task.receiverType &&
                            item.id === task.receiverId,
                        ),
                        kind: task.receiverType,
                        name: task.receiverName ?? task.receiverId ?? "待指派",
                      }),
                      h(
                        "span",
                        { className: "pmtask-assignee-name" },
                        receiverDisplay(task),
                      ),
                    ),
                h("span", null, task.due ? task.due.slice(5) : "不限"),
              ),
            ),
          ),
          tasks.length === 0 ? h("div", { className: "pmtask-empty", style: { padding: "20px 8px" } }, "暂无任务") : null,
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
          h(
            "div",
            { className: "pmtask-modal-head" },
            h("h2", null, title),
          ),
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

    function TaskDetail(props) {
      const {
        task,
        workspaceTitle,
        directory,
        currentUser,
        pendingAssignee,
        setPendingAssignee,
        assignOpen,
        setAssignOpen,
        onBack,
        onRestored,
        mutate,
        fail,
      } = props;
      const receiverOption =
        task.receiverType === "agent"
          ? directory.agents.find((item) => item.id === task.receiverId)
          : task.receiverType === "role"
            ? directory.roles.find((item) => item.id === task.receiverId)
            : directory.humans.find((item) => item.id === task.receiverId);
      const [editing, setEditing] = react.useState(false);
      const [message, setMessage] = react.useState("");
      const [attachments, setAttachments] = react.useState([]);
      const [mentionOpen, setMentionOpen] = react.useState(false);
      const [mentionQuery, setMentionQuery] = react.useState("");
      const [comment, setComment] = react.useState("");
      const [replyDrafts, setReplyDrafts] = react.useState({});
      const [executionLive, setExecutionLive] = react.useState(null);
      const [confirmArchive, setConfirmArchive] = react.useState(false);
      const [documents, setDocuments] = react.useState([]);
      const [documentsReady, setDocumentsReady] = react.useState(true);
      const messageRef = react.useRef(null);
      const liveOutputRef = react.useRef(null);
      const directoryOptions = [
        ...directory.humans.map((item) => ({ ...item, type: "human" })),
        ...directory.agents.map((item) => ({ ...item, type: "agent" })),
        ...directory.roles.map((item) => ({ ...item, type: "role" })),
      ];
      const mine = taskBelongsTo(task, currentUser, directory);
      const sent = currentUser !== null && task.createdBy === currentUser.id;
      const archived = isArchived(task);
      const canClaim = task.receiverType === "role" && task.status === "todo";
      const insertMention = (name) => {
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
        const nextCursor =
          (token?.index ?? before.length) + replacement.length;
        setMessage(next);
        setMentionOpen(false);
        requestAnimationFrame(() => {
          input?.focus();
          input?.setSelectionRange(nextCursor, nextCursor);
        });
      };
      const focusComposer = () => {
        const input = messageRef.current;
        if (input === null) return;
        if (message.trim() === "" && task.receiverType === "agent") {
          setMessage(`@${receiverDisplay(task)} `);
        }
        input.scrollIntoView({ block: "center", behavior: "smooth" });
        window.requestAnimationFrame(() => {
          input.focus();
          const end = input.value.length;
          input.setSelectionRange(end, end);
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
      const sendMessage = async () => {
        const content =
          message.trim() === "" && attachments.length > 0
            ? `已上传附件：${attachments.map((file) => file.name).join("、")}`
            : message.trim();
        if (archived || content === "") return;
        try {
          const uploaded = [];
          for (const file of attachments) {
            uploaded.push(await uploadAttachment(file));
          }
          await mutate(
            "/api/collab/tasks/message",
            {
              taskId: task.id,
              content,
              attachments: uploaded,
            },
            task.receiverType === "agent" ? "执行指令已发送" : `已发送给 ${receiverDisplay(task)}`,
          );
          setMessage("");
          setAttachments([]);
          setMentionOpen(false);
        } catch (cause) {
          fail(cause);
        }
      };
      const latestRunId = task.agentRunIds.at(-1);
      react.useEffect(() => {
        if (latestRunId === undefined) {
          setExecutionLive(null);
          return undefined;
        }
        let disposed = false;
        const loadExecution = async () => {
          try {
            const result = await request(
              `/api/collab/agent/runs/detail?workspaceId=${encodeURIComponent(task.workspaceId)}&runId=${encodeURIComponent(latestRunId)}`,
            );
            if (!disposed) setExecutionLive(result);
          } catch {
            // The task history remains authoritative if live detail is unavailable.
          }
        };
        void loadExecution();
        const timer = window.setInterval(() => void loadExecution(), 1_200);
        return () => {
          disposed = true;
          window.clearInterval(timer);
        };
      }, [latestRunId, task.workspaceId]);
      const latestAgentMessage = [...task.messages]
        .reverse()
        .find((item) => item.kind === "agent");
      const executionText =
        executionLive?.progress?.text?.trim() ||
        latestAgentMessage?.content ||
        "等待 DE 执行输出…";
      const executionStatus =
        executionLive?.run?.status ?? latestAgentMessage?.state ?? "idle";
      const executionRunning = RUNNING_MESSAGE_STATES.includes(executionStatus);
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
          await mutate(
            "/api/collab/tasks/action",
            { taskId: task.id, action: name, ...extra },
            label,
          );
        } catch (cause) {
          fail(cause);
        }
      };

      const resetSession = async () => {
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
      const lockedTip = archived ? "任务已归档，复原后可操作" : undefined;
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
        const item = directoryOptions.find((candidate) => candidate.type === type && candidate.id === id);
        setPendingAssignee({
          type,
          id: type === "unassigned" ? "" : id,
          name: type === "unassigned" ? "待指派" : item?.name ?? id,
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
            pendingAssignee.type === "unassigned" ? "接收方已恢复为待指派" : `已确认指派给 ${pendingAssignee.name}`,
          );
          setPendingAssignee(null);
        } catch (cause) {
          fail(cause);
        }
      };

      const myAgent =
        currentUser === null
          ? undefined
          : directory.agents.find(
              (item) => item.ownerAuthUserId === currentUser.id,
            );
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
      const composerHint =
        archived
          ? "任务已归档 · 复原后可继续发送指令"
          : task.receiverType === "unassigned"
            ? "暂无接收方 · 任务待指派"
            : task.receiverType === "agent"
              ? `发送给 ${receiverDisplay(task)}${task.status === "progress" ? " · Agent 执行中" : ""}`
              : `发送给 ${receiverDisplay(task)}`;
      const history = [
        ...task.messages.map((item) => ({ kind: "message", at: item.at, item })),
        ...task.events
          .filter((event) => event.kind !== "message")
          .map((event) => ({ kind: "event", at: event.at, event })),
      ].sort(
        (left, right) =>
          right.at.localeCompare(left.at) ||
          (left.kind === right.kind ? 0 : left.kind === "message" ? -1 : 1),
      );
      return h(
        "div",
        { className: "pmtask-detail" },
        h(
          "section",
          { className: "pmtask-detail-page" },
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
              "任务管理 / ",
              h("b", null, `${task.id} ${task.title}`),
            ),
            h(
              "div",
              { className: "pmtask-menu pmtask-assign-select" },
              h(
                "button",
                {
                  className: `pmtask-assign-trigger${pendingAssignee === null ? "" : " pending"}`,
                  type: "button",
                  disabled: archived,
                  title: archived
                    ? "任务已归档，复原后可调整接收方"
                    : "调整接收方",
                  "aria-haspopup": "listbox",
                  "aria-expanded": assignOpen,
                  onClick: () => {
                    if (archived) return;
                    setAssignOpen(!assignOpen);
                  },
                },
                h(
                  "span",
                  { className: "pmtask-assign-trigger-content" },
                  previewKind === "unassigned"
                    ? h("span", { className: "pmtask-avatar system" }, "—")
                    : h(ReceiverAvatar, {
                        option: previewOption,
                        kind: previewKind,
                        name: previewLabel,
                      }),
                  h(
                    "span",
                    { className: "pmtask-assign-trigger-copy" },
                    `${previewLabel}${pendingAssignee === null ? "" : "（待确认）"}`,
                  ),
                ),
                h("span", { "aria-hidden": "true" }, "⌄"),
              ),
              assignOpen && !archived
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
                      h("span", { className: "pmtask-avatar system" }, "—"),
                      h(
                        "span",
                        { className: "pmtask-receiver-option-copy" },
                        h("span", { className: "pmtask-receiver-option-name" }, "待指派"),
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
                        h(ReceiverAvatar, {
                          option: item,
                          kind: item.type,
                          name: receiverOptionLabel(item),
                        }),
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
            h(
              "span",
              { className: `pmtask-pill ${task.status}` },
              statusLabel(task.status),
            ),
            archived
              ? h("span", { className: "pmtask-pill archived" }, "已归档")
              : null,
          ),
          h(
            "div",
            { className: "pmtask-detail-layout" },
            h(
              "div",
              { className: "pmtask-detail-main" },
              editing
                ? h(EditTaskForm, {
                    task,
                    onCancel: () => setEditing(false),
                    onSave: async (input) => {
                      try {
                        await mutate(
                          "/api/collab/tasks/update",
                          { taskId: task.id, ...input },
                          "任务内容已更新",
                        );
                        setEditing(false);
                      } catch (cause) {
                        fail(cause);
                      }
                    },
                  })
                : h(
                    "div",
                    { className: "pmtask-intro" },
                    h(
                      "div",
                      { className: "pmtask-intro-head" },
                      h("h2", null, task.title),
                      h(
                        "span",
                        {
                          className: `pmtask-pill ${task.priority === "P1" ? "p1" : ""}`,
                        },
                        task.priority,
                      ),
                      h(
                        "button",
                        {
                          className: "pmtask-icon-btn",
                          type: "button",
                          disabled: archived,
                          title: archived
                            ? "任务已归档，复原后可编辑"
                            : "编辑标题、优先级和描述",
                          "aria-label": archived
                            ? "任务已归档，复原后可编辑"
                            : "编辑标题、优先级和描述",
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
                        "接收方",
                        h(
                          "strong",
                          { className: "pmtask-assignee" },
                          h(ReceiverAvatar, {
                            option: receiverOption,
                            kind: task.receiverType,
                            name:
                              task.receiverName ?? task.receiverId ?? "待指派",
                            className: "lg",
                          }),
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
                          h(ReceiverAvatar, {
                            option: directory.humans.find(
                              (item) => item.id === task.createdBy,
                            ),
                            kind: "human",
                            name: task.createdByName,
                          }),
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
                         `${task.priority} · ${task.due || "不限"}`,
                        ),
                      ),
                      task.receiverType === "agent"
                        ? h(
                            "div",
                            { className: "pmtask-field" },
                            "完成后自动提交Review",
                            h(
                              "strong",
                              null,
                              task.autoSubmitReview !== false ? "已开启" : "已关闭",
                            ),
                          )
                        : null,
                    ),
                    archived
                      ? h(
                          "p",
                          { className: "pmtask-locked-hint" },
                          "任务已归档：内容、状态、回复与执行指令均已锁定，点「复原」后可继续操作。",
                        )
                      : null,
                    h(
                      "div",
                      { className: "pmtask-actions" },
                      canClaim
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: lockedTip,
                              onClick: () => void action("claim", "已认领任务"),
                            },
                            "认领",
                          )
                        : null,
                      mine && task.status === "todo"
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: lockedTip,
                              onClick: () => void action("start", "任务已开始"),
                            },
                            "开始",
                          )
                        : null,
                      mine && task.status === "progress"
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: lockedTip,
                              onClick: () => void action("submit", "已提交验收"),
                            },
                            "提交验收",
                          )
                        : null,
                      task.status === "review"
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: lockedTip,
                              onClick: () => void action("approve", "任务已完成"),
                            },
                            "通过",
                          )
                        : null,
                      task.status === "review"
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: lockedTip,
                              onClick: () => void action("reject", "已退回"),
                            },
                            "退回",
                          )
                        : null,
                      sent &&
                      task.status !== "done" &&
                      task.receiverType !== "unassigned"
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: lockedTip,
                              onClick: () => void action("nudge", "已提醒接收方"),
                            },
                            "催办",
                          )
                        : null,
                      mine &&
                      task.receiverType === "human" &&
                      task.status !== "done" &&
                      myAgent !== undefined
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: lockedTip,
                              onClick: async () => {
                                try {
                                  await mutate(
                                    "/api/collab/tasks/assign",
                                    {
                                      taskId: task.id,
                                      receiverType: "agent",
                                      receiverId: myAgent.id,
                                      receiverName: myAgent.name,
                                    },
                                    "已派给我的分身",
                                  );
                                } catch (cause) {
                                  fail(cause);
                                }
                              },
                            },
                            "派我的分身执行",
                          )
                        : null,
                      task.receiverType === "agent"
                        ? h(
                            "button",
                            {
                              className: "pmtask-btn secondary",
                              type: "button",
                              disabled: archived,
                              title: archived
                                ? "任务已归档，复原后可回复"
                                : "直接在下方输入框补充指令，发送给执行本任务的 Agent",
                              onClick: () => focusComposer(),
                            },
                            "人工回复",
                          )
                        : null,
                      task.receiverType === "agent" && !archived
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
              h(
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
                      disabled: archived,
                      title: archived ? "任务已归档，复原后可编辑" : "插入表情",
                      "aria-label": "插入表情",
                      onClick: () =>
                        setMessage((current) => `${current}☺`),
                    },
                    "☺",
                  ),
                  h(
                    "label",
                    {
                      className: "pmtask-tool-btn",
                      title: archived
                        ? "任务已归档，复原后可上传附件"
                        : "上传附件",
                      style: archived
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
                      disabled: archived,
                      onChange: (event) => {
                        const picked = Array.from(event.target.files ?? []);
                        event.target.value = "";
                        if (picked.length === 0) return;
                        setAttachments((current) => [...current, ...picked]);
                      },
                    }),
                  ),
                  h(
                    "button",
                    {
                      className: "pmtask-tool-btn",
                      type: "button",
                      disabled: archived,
                      title: archived ? "任务已归档，复原后可 @ 成员" : "插入 @ 提及",
                      "aria-haspopup": "listbox",
                      "aria-expanded": mentionOpen,
                      onClick: () => {
                        if (archived) return;
                        setMentionQuery("");
                        setMentionOpen((value) => !value);
                      },
                    },
                    "@",
                  ),
                  mentionOpen
                    ? h(MentionMenu, {
                        directory,
                        query: mentionQuery,
                        onPick: insertMention,
                      })
                    : null,
                ),
                h("textarea", {
                  ref: messageRef,
                  className: "pmtask-composer-input",
                  rows: 4,
                  value: message,
                  readOnly: archived,
                  placeholder:
                    archived
                      ? "任务已归档，复原后可继续发送指令"
                      : "输入 / 补充给执行 Agent 的指令，或反馈任务进展。可 @ 人员、DE 和分身",
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
                  { className: "pmtask-composer-footer" },
                  h("span", { className: "pmtask-compose-hint" }, composerHint),
                  h(
                    "div",
                    { className: "pmtask-compose-actions" },
                    h(
                      "button",
                      {
                        className: "pmtask-btn secondary",
                        type: "button",
                        onClick: () => {
                          setMessage("");
                          setAttachments([]);
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
                          archived ||
                          (message.trim() === "" && attachments.length === 0) ||
                          task.receiverType === "unassigned",
                        onClick: () => void sendMessage(),
                      },
                      "发送",
                    ),
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmtask-detail-section" },
                h(
                  "div",
                  { className: "pmtask-history-head" },
                  h("h3", null, "执行历史"),
                  h(
                    "span",
                    null,
                    `${task.messages.length} 条交互记录 · 执行人 ${receiverDisplay(task)}`,
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
                            className: "pmtask-history-message",
                            key: `message:${entry.item.id}`,
                          },
                          h(
                            "span",
                            { className: `pmtask-avatar ${entry.item.kind}` },
                            initials(entry.item.authorName),
                          ),
                          h(
                            "div",
                            { className: "pmtask-message-body" },
                            h(
                              "div",
                              { className: "pmtask-message-head" },
                              h("strong", null, entry.item.authorName),
                              h(
                                "span",
                                null,
                                `${localTime(entry.item.at)}${entry.item.kind === "agent" ? " · Agent" : ""}`,
                              ),
                            ),
                            h(
                              "div",
                              { className: "pmtask-bubble" },
                              h(MarkdownText, { text: entry.item.content }),
                              ["queued", "running", "waiting_input"].includes(
                                entry.item.state,
                              )
                                ? h("span", { className: "pmtask-stream-caret" })
                                : null,
                            ),
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
                            entry.event.message,
                            h("time", null, localTime(entry.event.at)),
                          ),
                        ),
                  ),
                  history.length === 0
                    ? h(
                        "div",
                        { className: "pmtask-empty" },
                        "执行人还没有回复记录。",
                      )
                    : null,
                ),
              ),
              h(
                "div",
                { className: "pmtask-detail-section" },
                h("h3", null, "评论与回复"),
                h(
                  "div",
                  { className: "pmtask-comment-list" },
                  ...task.comments.map((item) =>
                    h(
                      "article",
                      { className: "pmtask-history-comment", key: item.id },
                      h(
                        "div",
                        { className: "pmtask-message-head" },
                        h(
                          "span",
                          { className: `pmtask-avatar ${item.kind}` },
                          initials(item.authorName),
                        ),
                        h("strong", null, item.authorName),
                        h("span", null, localTime(item.at)),
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
                                  h(
                                    "span",
                                    {
                                      className: `pmtask-avatar ${reply.kind}`,
                                    },
                                    initials(reply.authorName),
                                  ),
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
                            if (archived) return;
                            const content = (
                              replyDrafts[item.id] ?? ""
                            ).trim();
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
                          disabled: archived,
                          placeholder: `回复 ${item.authorName}`,
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
                              archived ||
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
                      if (archived) return;
                      const content = comment.trim();
                      if (content === "") return;
                      try {
                        await mutate(
                          "/api/collab/tasks/comment",
                          { taskId: task.id, content },
                          "评论已添加",
                        );
                        setComment("");
                      } catch (cause) {
                        fail(cause);
                      }
                    },
                  },
                  h("input", {
                    className: "pmtask-input",
                    value: comment,
                    disabled: archived,
                    placeholder: archived
                      ? "任务已归档，复原后可评论"
                      : "写下评论，或回复协作成员（评论只有 @ 执行人才会触发执行）",
                    onChange: (event) => setComment(event.target.value),
                  }),
                  h(
                    "button",
                    {
                      className: "pmtask-btn secondary",
                      type: "submit",
                      disabled: archived || comment.trim() === "",
                    },
                    "评论",
                  ),
                ),
              ),
            ),
            h(
              "aside",
              { className: "pmtask-detail-side" },
              h(
                "div",
                { className: "pmtask-side-section" },
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
                                new CustomEvent("pluginmax:collab-navigate", {
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
                                }),
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
              h(
                "div",
                { className: "pmtask-side-section" },
                h("h3", null, "任务动态"),
                h(
                  "div",
                  { className: "pmtask-timeline" },
                  ...task.events
                    .slice(-5)
                    .reverse()
                    .map((event) =>
                      h(
                        "div",
                        { className: "pmtask-timeline-event", key: event.id },
                        h("time", null, localTime(event.at)),
                        h("span", null, event.message),
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmtask-side-section" },
                h(
                  "div",
                  { className: "pmtask-live-head" },
                  executionRunning
                    ? h("span", { className: "pmtask-spinner", role: "status", "aria-label": "正在执行" })
                    : h("span", { className: "pmtask-live-dot" }),
                  h("h3", null, "DE 执行过程"),
                  h(
                    "span",
                    { className: "pmtask-side-empty" },
                    executionStatus,
                  ),
                ),
                h(
                  "div",
                  { className: "pmtask-live-output", ref: liveOutputRef },
                  h(MarkdownText, { text: executionText }),
                ),
              ),
              h(
                "div",
                { className: "pmtask-side-section" },
                h(
                  "div",
                  { className: "pmtask-live-head" },
                  h("span", { className: "pmtask-live-dot" }),
                  h("h3", null, "产出文档"),
                  h(
                    "span",
                    { className: "pmtask-side-empty" },
                    documents.length === 0 ? "" : `${documents.length} 个文件`,
                  ),
                ),
                documents.length === 0
                  ? h(
                      "div",
                      { className: "pmtask-doc-empty" },
                      documentsReady ? "暂无产出文档" : "任务工作区不可用",
                    )
                  : h(
                      "div",
                      { className: "pmtask-doc-list" },
                      ...documents.map((document) =>
                        h(
                          "div",
                          { className: "pmtask-doc", key: document.id },
                          h(
                            "div",
                            { className: "pmtask-doc-info" },
                            h(
                              "button",
                              {
                                className: "pmtask-doc-name",
                                type: "button",
                                disabled: !document.available,
                                title: document.available
                                  ? `下载 ${document.name}`
                                  : "该附件未存储到工作区",
                                onClick: () => void downloadDocument(document),
                              },
                              h(
                                "span",
                                { className: "pmtask-doc-kind" },
                                document.kind === "uploaded" ? "上传" : "产出",
                              ),
                              h("span", null, document.name),
                            ),
                            h(
                              "div",
                              { className: "pmtask-doc-meta" },
                              `${document.updatedBy} · ${localTime(document.updatedAt)}`,
                            ),
                          ),
                          document.available
                            ? h(
                                "button",
                                {
                                  className: "pmtask-tool-btn",
                                  type: "button",
                                  title: "在本地文件夹中显示",
                                  "aria-label": "在本地文件夹中显示",
                                  onClick: () => void revealDocument(document),
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
            ),
            ),
          ),
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
        ),
      );
    }

    function EditTaskForm({ task, onCancel, onSave }) {
      const [form, setForm] = react.useState({
        title: task.title,
        priority: task.priority,
        description: task.description,
        acceptance: task.acceptance.join("\n"),
        due: task.due ?? "",
        autoSubmitReview: task.autoSubmitReview !== false,
      });
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
              acceptance: form.acceptance.split("\n").map((item) => item.trim()).filter(Boolean),
              due: form.due || undefined,
              ...(task.receiverType === "agent"
                ? { autoSubmitReview: form.autoSubmitReview }
                : {}),
            });
          },
        },
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
                setForm((current) => ({ ...current, title: event.target.value })),
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
              h("option", null, "P1"),
              h("option", null, "P2"),
              h("option", null, "P3"),
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
        task.receiverType === "agent"
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
            { className: "pmtask-btn secondary", type: "button", onClick: onCancel },
            "取消",
          ),
          h("button", { className: "pmtask-btn", type: "submit" }, "保存内容"),
        ),
      );
    }

    function CreateTaskModal({
      workspaces,
      directory,
      currentWorkspaceId,
      initialStatus,
      onClose,
      onCreated,
    }) {
      const initialReceiverType = directory.humans.length > 0
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
      const [form, setForm] = react.useState({
        workspaceId: currentWorkspaceId || workspaces[0]?.id || "",
        title: "",
        type: "任务",
        priority: "P2",
        status: initialStatus || "todo",
        receiverType: initialReceiverType,
        receiverId: initialReceiver?.id ?? "",
        receiverName: initialReceiver?.name ?? "",
        description: "",
        acceptance: "",
        due: "",
        autoSubmitReview: true,
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
        }));
      };
      return h(
        "div",
        { className: "pmtask-mask", onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h(
          "form",
          {
            className: "pmtask-modal",
            onSubmit: (event) => {
              event.preventDefault();
              const acceptance = form.acceptance.split("\n").map((item) => item.trim()).filter(Boolean);
              void onCreated({
                ...form,
                title: form.title.trim(),
                description: form.description.trim(),
                acceptance: acceptance.length ? acceptance : ["按描述完成并自查"],
                receiverId: form.receiverType === "unassigned" ? undefined : form.receiverId,
                receiverName: form.receiverType === "unassigned" ? undefined : form.receiverName,
              });
            },
          },
          h("div", { className: "pmtask-modal-head" }, h("h2", null, "派发任务 / Issue"), h("button", { className: "pmtask-btn secondary", type: "button", onClick: onClose }, "关闭")),
          h(
            "div",
            { className: "pmtask-modal-grid" },
            h("label", { className: "pmtask-field" }, "标题", h("input", { className: "pmtask-input", value: form.title, required: true, onChange: (event) => setForm((current) => ({ ...current, title: event.target.value })) })),
            h("label", { className: "pmtask-field" }, "类型", h("select", { className: "pmtask-select", value: form.type, onChange: (event) => setForm((current) => ({ ...current, type: event.target.value })) }, h("option", null, "任务"), h("option", null, "缺陷"), h("option", null, "评审"))),
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
                    setForm((current) => ({ ...current, workspaceId: event.target.value })),
                },
                h(
                  "option",
                  { value: "" },
                  workspaces.length === 0 ? "暂无可用项目" : "请选择项目",
                ),
                ...workspaces.map((workspace) =>
                  h("option", { value: workspace.id, key: workspace.id }, workspace.title),
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
            h("label", { className: "pmtask-field" }, "优先级", h("select", { className: "pmtask-select", value: form.priority, onChange: (event) => setForm((current) => ({ ...current, priority: event.target.value })) }, h("option", null, "P1"), h("option", null, "P2"), h("option", null, "P3"))),
            h("label", { className: "pmtask-field" }, "初始状态", h("select", { className: "pmtask-select", value: form.status, onChange: (event) => setForm((current) => ({ ...current, status: event.target.value })) }, ...STATUSES.map((status) => h("option", { value: status.key, key: status.key }, status.label)))),
            h(
              "label",
              { className: "pmtask-field" },
              "接收人",
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
                          { value: `human:${item.id}`, key: `human:${item.id}` },
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
                          { value: `agent:${item.id}`, key: `agent:${item.id}` },
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
            h("label", { className: "pmtask-field" }, "到期时间", h("input", { className: "pmtask-input", type: "date", value: form.due, onChange: (event) => setForm((current) => ({ ...current, due: event.target.value })) })),
            form.receiverType === "agent"
              ? h(
                  "label",
                  { className: "pmtask-check pmtask-span-2" },
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
          ),
          h("label", { className: "pmtask-field" }, "描述", h("textarea", { className: "pmtask-area", rows: 4, value: form.description, required: true, placeholder: "补充背景、期望结果、边界和风险。", onChange: (event) => setForm((current) => ({ ...current, description: event.target.value })) })),
          h("label", { className: "pmtask-field" }, "验收标准（每行一条）", h("textarea", { className: "pmtask-area", rows: 4, value: form.acceptance, placeholder: "例如：失败任务能在 3 次内自动重试", onChange: (event) => setForm((current) => ({ ...current, acceptance: event.target.value })) })),
          h("div", { className: "pmtask-compose-actions" }, h("button", { className: "pmtask-btn secondary", type: "button", onClick: onClose }, "取消"), h("button", { className: "pmtask-btn", type: "submit", disabled: form.title.trim() === "" || form.description.trim() === "" || form.workspaceId === "" || (form.receiverType !== "unassigned" && form.receiverId === "") }, "派发")),
        ),
      );
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global",
            id: "pluginmax-task",
            order: 25,
          },
          TaskGlobalPage,
        ),
      );
    };

    return module.exports;
  },
});
