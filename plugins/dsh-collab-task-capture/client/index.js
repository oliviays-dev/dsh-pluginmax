window.__ModuleLoader__.load({
  id: "dsh-collab-task-capture",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";

    const styles = `
      .pmtc-overlay{position:fixed;inset:42px 0 0 auto;z-index:70;display:flex;flex-direction:column;width:min(560px,100vw);background:var(--dsw-alias-bg-layer-1,#fff);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:-18px 0 42px rgba(0,0,0,.14);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.45;}
      .pmtc-overlay.is-context{position:absolute;inset:0;width:auto;border-left:0;box-shadow:none;background:var(--dsw-alias-bg-layer-1,#fff);}
      .pmtc-overlay.is-side{position:relative;inset:auto;width:100%;height:100%;border-left:0;box-shadow:none;background:var(--dsw-alias-bg-layer-1,#fff);}
      .pmtc-side-root{position:absolute;inset:0;z-index:23;display:flex;justify-content:flex-end;pointer-events:none;}
      .pmtc-side-panel{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-width:0;overflow:hidden;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);pointer-events:auto;}
      .pmtc-side-tabs{display:flex;align-items:stretch;flex:none;gap:2px;height:49px;min-height:49px;padding:6px 8px 0 6px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
      .pmtc-side-tab-scroll{display:flex;align-items:stretch;gap:2px;min-width:0;flex:1;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
      .pmtc-side-tab{position:relative;display:inline-flex;align-items:center;height:42px;width:100px;min-width:100px;max-width:100px;flex:0 0 100px;color:var(--dsw-alias-label-secondary);cursor:grab;}
      .pmtc-side-tab.is-active{color:var(--dsw-alias-label-primary);border-radius:6px 6px 0 0;background:var(--dsw-alias-bg-layer-3);font-weight:600;}
      .pmtc-side-tab-indicator{position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px 2px 0 0;background:transparent;pointer-events:none;}
      .pmtc-side-tab.is-active .pmtc-side-tab-indicator{background:var(--dsw-alias-label-primary);}
      .pmtc-side-tab-main{display:inline-flex;align-items:center;gap:5px;min-width:0;flex:1;height:100%;padding:0 4px 0 8px;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer;}
      .pmtc-side-tab-main span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtc-side-tab-close{display:grid;place-items:center;width:18px;height:18px;flex:none;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer;opacity:0;}
      .pmtc-side-tab.is-active .pmtc-side-tab-close,.pmtc-side-tab:hover .pmtc-side-tab-close,.pmtc-side-tab:focus-within .pmtc-side-tab-close{opacity:.72;}
      .pmtc-side-tab-close:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);opacity:1;}
      .pmtc-side-tab-actions{display:flex;align-items:center;gap:2px;flex:none;margin-left:4px;padding-left:6px;border-left:1px solid var(--dsw-alias-border-l2);}
      .pmtc-side-tab-new-wrap{position:relative;display:flex;align-items:center;flex:none;}
      .pmtc-side-tab-new,.pmtc-side-tab-action{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;}
      .pmtc-side-tab-new:hover,.pmtc-side-tab-action:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtc-side-tab-action svg{width:13px;height:13px;}
      .pmtc-side-tab-panel{width:32px;height:32px;transform:translateY(.5px);}
      .pmtc-side-tab-panel svg{width:15px;height:15px;}
      .pmtc-side-tab-new-menu{position:absolute;right:0;top:31px;z-index:8;min-width:150px;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 10px 28px rgba(0,0,0,.2);}
      .pmtc-side-tab-new-item{display:flex;align-items:center;gap:7px;width:100%;padding:8px 9px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;font-size:11px;line-height:1.4;cursor:pointer;}
      .pmtc-side-tab-new-item svg{width:13px;height:13px;flex:none;}
      .pmtc-side-tab-new-item:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmtc-side-body{flex:1;min-height:0;display:flex;overflow:hidden;}
      .pmtc-side-empty{display:grid;place-content:center;gap:6px;width:100%;padding:24px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtc-manual-card{display:grid;align-content:center;gap:12px;width:100%;max-width:340px;margin:auto;padding:20px;}
      .pmtc-manual-card h3{margin:0;color:var(--dsw-alias-label-primary);font-size:15px;text-align:left;}
      .pmtc-manual-card p{margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;text-align:left;}
      .pmtc-manual-form{display:grid;gap:10px;}
      .pmtc-manual-form textarea{min-height:120px;resize:vertical;}
      .pmtc-manual-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;}
      .pmtc-manual-empty{display:grid;place-content:center;justify-items:center;grid-auto-rows:max-content;gap:10px;width:100%;padding:24px;text-align:center;}
      .pmtc-manual-empty strong{color:var(--dsw-alias-label-primary);font-size:14px;}
      .pmtc-manual-empty span{max-width:260px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6;}
      .pmtc-head{display:flex;align-items:flex-start;gap:10px;padding:16px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmtc-head-copy{min-width:0;flex:1;}
      .pmtc-title{margin:0;font-size:16px;font-weight:650;}
      .pmtc-subtitle{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtc-close{display:grid;place-items:center;width:30px;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:inherit;cursor:pointer;}
      .pmtc-body{min-height:0;flex:1;overflow:auto;padding:14px 16px;display:grid;gap:12px;align-content:start;}
      .pmtc-note{padding:9px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtc-picker{display:grid;gap:10px;min-height:0;}
      .pmtc-picker-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .pmtc-picker-head strong{display:block;font-size:13px;}
      .pmtc-picker-head span{display:block;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:11px;}
      .pmtc-picker-list{display:grid;gap:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;}
      .pmtc-picker-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;padding:10px 11px;border-bottom:1px solid var(--dsw-alias-border-l2);cursor:pointer;}
      .pmtc-picker-item:last-child{border-bottom:0;}
      .pmtc-picker-item.is-checked{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f86e8) 6%,transparent);}
      .pmtc-picker-item input{margin-top:2px;}
      .pmtc-picker-meta{display:block;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmtc-picker-item p{margin:3px 0 0;font-size:12px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
      .pmtc-list{display:grid;gap:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
      .pmtc-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding:12px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}
      .pmtc-row:last-child{border-bottom:0;}
      .pmtc-row.is-unchecked{opacity:.56;}
      .pmtc-row input{margin-top:2px;}
      .pmtc-row-main{display:grid;gap:8px;min-width:0;}
      .pmtc-row-editor{display:grid;grid-template-columns:minmax(130px,1fr) minmax(88px,.6fr);gap:8px;align-items:center;}
      .pmtc-row-description{min-height:60px;resize:vertical;font-size:12.5px;line-height:1.45;}
      .pmtc-row p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
      .pmtc-fields{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}
      .pmtc-field{padding:2px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmtc-field.missing{background:rgba(212,145,36,.12);color:#b06c14;}
      .pmtc-chip{padding:2px 7px;border-radius:999px;background:rgba(65,140,95,.12);color:#32805a;font-size:10.5px;font-weight:600;}
      .pmtc-chip.needs{background:rgba(212,145,36,.12);color:#a76a16;}
      .pmtc-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmtc-foot-actions{justify-content:flex-end;}
      .pmtc-foot-copy{color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmtc-btn{min-height:32px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit;}
      .pmtc-btn.primary{border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);font-weight:600;}
      .pmtc-btn:disabled{opacity:.5;cursor:not-allowed;}
      .pmtc-error{padding:9px 10px;border-radius:7px;background:rgba(220,70,60,.1);color:#b43b32;font-size:12px;}
      .pmtc-success{display:grid;gap:12px;padding:16px;border:1px solid rgba(55,145,95,.35);border-radius:8px;background:rgba(55,145,95,.08);}
      .pmtc-success h3{margin:0;font-size:14px;}
      .pmtc-success p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtc-inline-actions{display:flex;gap:8px;flex-wrap:wrap;}
      .pmtc-cap-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;}
      .pmtc-cap-content{min-height:100%;display:flex;flex-direction:column;}
      .pmtc-cap-list{display:grid;}
      .pmtc-cap-row{position:relative;display:grid;grid-template-columns:16px minmax(0,1fr) 48px;gap:7px;padding:10px 10px 10px 11px;border-bottom:1px solid var(--dsw-alias-border-l2);background:transparent;}
      .pmtc-cap-row:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 1.5%,transparent);}
      .pmtc-cap-row.is-selected{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8def) 3%,transparent);}
      .pmtc-cap-row.is-saved{opacity:.72;}
      .pmtc-cap-row.is-created{opacity:.82;box-shadow:inset 2px 0 0 var(--dsw-alias-accent-primary,#5b8def);}
      .pmtc-cap-row.is-unassigned{box-shadow:inset 2px 0 0 var(--dsw-alias-state-warning-primary,#dda34d);}
      .pmtc-cap-check{padding-top:1px;}
      .pmtc-cap-check input{width:14px;height:14px;margin:0;accent-color:var(--dsw-alias-accent-primary,#5b8def);cursor:pointer;}
      .pmtc-cap-main{min-width:0;}
      .pmtc-cap-title-line{display:flex;align-items:flex-start;gap:5px;}
      .pmtc-cap-title{min-width:0;flex:1;width:100%;height:23px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;font-size:11px;font-weight:610;line-height:1.42;overflow-wrap:anywhere;}
      .pmtc-cap-title:hover{border-color:var(--dsw-alias-border-l2);}
      .pmtc-cap-title:focus{border-color:var(--dsw-alias-accent-primary,#5b8def);background:var(--dsw-alias-bg-base);}
      .pmtc-cap-chip{height:17px;display:inline-flex;align-items:center;padding:0 4px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 11%,transparent);color:var(--dsw-alias-state-success-primary,#34a875);font-size:8px;white-space:nowrap;}
      .pmtc-cap-chip.is-created{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8def) 12%,transparent);color:var(--dsw-alias-accent-primary,#5b8def);}
      .pmtc-cap-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:8.8px;}
      .pmtc-cap-assignee{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);}
      .pmtc-cap-avatar{width:16px;height:16px;display:grid;place-items:center;border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 14%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);font-size:6.5px;font-weight:700;}
      .pmtc-cap-unassigned .pmtc-cap-assignee{color:var(--dsw-alias-state-warning-primary,#c98522);}
      .pmtc-cap-dot{width:2px;height:2px;border-radius:50%;background:var(--dsw-alias-label-tertiary);}
      .pmtc-cap-due.is-missing{color:var(--dsw-alias-state-warning-primary,#c98522);}
      .pmtc-cap-priority{height:17px;display:inline-flex;align-items:center;padding:0 4px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:8px;}
      .pmtc-cap-source{height:18px;max-width:176px;min-width:0;display:inline-flex;align-items:center;gap:3px;padding:0 3px;border:0;border-radius:3px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:8.4px;white-space:nowrap;cursor:pointer;}
      .pmtc-cap-source span{min-width:0;overflow:hidden;text-overflow:ellipsis;}
      .pmtc-cap-source:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);}
      .pmtc-cap-source-detail{margin-top:6px;padding:7px 8px;border-left:2px solid var(--dsw-alias-border-l3);border-radius:0 5px 5px 0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:9px;line-height:1.55;}
      .pmtc-cap-source-detail strong{display:block;margin-bottom:2px;color:var(--dsw-alias-label-tertiary);font-size:8.3px;font-weight:500;}
      .pmtc-cap-fields{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:6px;}
      .pmtc-cap-field{height:18px;display:inline-flex;align-items:center;gap:3px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font-size:8px;}
      .pmtc-cap-field.is-good{color:var(--dsw-alias-state-success-primary,#2f9b6d);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 11%,transparent);}
      .pmtc-cap-edit{align-self:end;justify-self:end;min-width:44px;height:24px;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 4px;margin-bottom:1px;border:1px solid transparent;border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:8.4px;white-space:nowrap;cursor:pointer;}
      .pmtc-cap-edit:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);}
      .pmtc-cap-add{width:100%;min-height:34px;display:flex;align-items:center;gap:5px;padding:5px 11px;border:0;border-bottom:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-tertiary);text-align:left;font:inherit;font-size:9.2px;cursor:pointer;}
      .pmtc-cap-add:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 1.5%,transparent);color:var(--dsw-alias-label-secondary);}
      .pmtc-cap-banner{margin:10px 11px 2px;display:flex;align-items:center;gap:8px;padding:8px 9px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 23%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 10%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);font-size:9.2px;}
      .pmtc-cap-banner span{min-width:0;flex:1;}
      .pmtc-cap-banner button{padding:0;border:0;background:transparent;color:inherit;font:inherit;font-size:8.8px;white-space:nowrap;cursor:pointer;}
      .pmtc-cap-footer{flex:none;min-height:60px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
      .pmtc-cap-selection{min-width:0;color:var(--dsw-alias-label-secondary);font-size:10px;white-space:nowrap;}
      .pmtc-cap-footer-actions{display:flex;align-items:center;gap:8px;}
      .pmtc-cap-btn{min-width:110px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;white-space:nowrap;cursor:pointer;}
      .pmtc-cap-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3);}
      .pmtc-cap-btn.primary{min-width:124px;border-color:transparent;background:var(--dsw-alias-accent-primary,#5b8def);color:#fff;}
      .pmtc-cap-btn:disabled{opacity:.45;cursor:not-allowed;}
      .pmtc-cap-empty{display:grid;place-content:center;justify-items:center;gap:7px;min-height:220px;padding:24px;text-align:center;color:var(--dsw-alias-label-secondary);}
      .pmtc-cap-empty strong{color:var(--dsw-alias-label-primary);font-size:11px;}
      .pmtc-cap-empty span{max-width:260px;font-size:9.5px;line-height:1.55;}
      .pmtc-cap-drawer-mask{position:fixed;inset:0;z-index:100;background:rgba(4,7,10,.5);}
      .pmtc-cap-drawer{width:min(470px,96vw);height:100%;margin-left:auto;display:flex;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);box-shadow:-20px 0 52px rgba(0,0,0,.38);}
      .pmtc-cap-drawer-head{flex:none;min-height:55px;display:flex;align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmtc-cap-drawer-head-copy{min-width:0;flex:1;}
      .pmtc-cap-drawer-head h2{margin:0;font-size:13.5px;font-weight:680;}
      .pmtc-cap-drawer-head p{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:9.2px;}
      .pmtc-cap-drawer-close{width:28px;height:28px;display:grid;place-items:center;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtc-cap-drawer-body{flex:1;min-height:0;overflow:auto;padding:12px;}
      .pmtc-cap-fieldset{display:grid;gap:5px;margin-bottom:10px;}
      .pmtc-cap-fieldset>span{color:var(--dsw-alias-label-secondary);font-size:9.5px;}
      .pmtc-cap-fieldset input,.pmtc-cap-fieldset select,.pmtc-cap-fieldset textarea{width:100%;min-height:33px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:10.5px;}
      .pmtc-cap-fieldset textarea{min-height:72px;resize:vertical;line-height:1.5;}
      .pmtc-cap-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .pmtc-cap-form-note{display:flex;align-items:flex-start;gap:6px;margin-top:2px;padding:8px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8def) 10%,transparent);color:var(--dsw-alias-label-secondary);font-size:9.2px;line-height:1.5;}
      .pmtc-cap-source-preview{margin-top:11px;padding:9px;border-left:2px solid var(--dsw-alias-border-l3);border-radius:0 5px 5px 0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.58;}
      .pmtc-cap-source-preview strong{display:block;margin-bottom:3px;color:var(--dsw-alias-label-tertiary);font-size:8.5px;font-weight:500;}
      .pmtc-cap-drawer-footer{flex:none;min-height:54px;display:flex;justify-content:flex-end;gap:6px;padding:9px 12px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);}
      .pmtc-cap-error{margin:10px 11px;padding:8px 9px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 10%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10px;}
      .pmtask-btn.pmtc-launcher{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 12px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12.5px;font-weight:400;white-space:nowrap;}
      .pmtc-launcher:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l4);}
      .pmtc-launcher .pmtask-btn-count{min-width:18px;height:18px;display:inline-grid;place-items:center;padding:0 4px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10.5px;font-variant-numeric:tabular-nums;line-height:1;}
      .pmtd-root{min-width:0;max-width:100%;min-height:calc(100vh - 118px);display:flex;flex-direction:column;container-type:inline-size;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.45;}
      .pmtd-root *{box-sizing:border-box;}
      .pmtd-back{width:max-content;height:28px;display:inline-flex;align-items:center;gap:5px;margin:0 0 10px;padding:0 7px 0 4px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
      .pmtd-back:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtd-back svg{width:14px;height:14px;}
      .pmtd-head{display:flex;align-items:center;gap:10px;min-width:0;margin-bottom:14px;flex-wrap:wrap;}
      .pmtd-title{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 230px;}
      .pmtd-title h1{margin:0;font-size:19px;line-height:1.3;font-weight:680;}
      .pmtd-total{min-width:22px;height:20px;display:inline-grid;place-items:center;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8def) 12%,transparent);color:var(--dsw-alias-accent-primary,#5b8def);font-size:10.5px;font-variant-numeric:tabular-nums;}
      .pmtd-head-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0;flex:1 1 auto;margin-left:auto;flex-wrap:nowrap;}
      .pmtd-search{position:relative;width:270px;min-width:170px;max-width:270px;flex:0 1 270px;}
      .pmtd-search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:13px;height:13px;color:var(--dsw-alias-label-tertiary);pointer-events:none;}
      .pmtd-input,.pmtd-select,.pmtd-textarea{width:100%;min-height:32px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;}
      .pmtd-search .pmtd-input{height:32px;padding-left:28px;}
      .pmtd-textarea{min-height:76px;resize:vertical;line-height:1.5;}
      .pmtd-btn{min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 11px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;font-weight:560;white-space:nowrap;cursor:pointer;}
      .pmtd-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}
      .pmtd-btn.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-accent-primary,#5b8def));color:var(--dsw-alias-label-primary-foreground,#fff);}
      .pmtd-btn.danger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 42%,transparent);background:transparent;color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtd-btn:disabled,.pmtd-icon-btn:disabled{opacity:.45;cursor:not-allowed;}
      .pmtd-btn svg,.pmtd-icon-btn svg{width:13px;height:13px;}
      .pmtd-icon-btn{width:32px;height:32px;display:grid;place-items:center;padding:0;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtd-icon-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtd-alert{display:flex;align-items:flex-start;gap:7px;margin-bottom:10px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 32%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 8%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-size:11.5px;}
      .pmtd-notice{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 30%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 8%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);font-size:11.5px;}
      .pmtd-notice span{min-width:0;flex:1;}
      .pmtd-workspace{min-width:0;flex:1;display:grid;grid-template-columns:248px minmax(0,1fr);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
      .pmtd-projects{min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,var(--dsw-alias-bg-layer-1));}
      .pmtd-projects-head{padding:11px 12px 8px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:650;}
      .pmtd-project-list{min-height:0;overflow:auto;padding:0 6px 8px;display:grid;align-content:start;gap:2px;}
      .pmtd-project{width:100%;min-width:0;display:grid;gap:5px;padding:9px 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;}
      .pmtd-project:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);}
      .pmtd-project.is-active{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8def) 10%,transparent);box-shadow:inset 2px 0 0 var(--dsw-alias-accent-primary,#5b8def);}
      .pmtd-project-top{display:flex;align-items:center;gap:6px;min-width:0;}
      .pmtd-project-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:620;}
      .pmtd-project-time{color:var(--dsw-alias-label-tertiary);font-size:9.5px;white-space:nowrap;}
      .pmtd-project-counts{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;white-space:nowrap;}
      .pmtd-project-counts .warn{color:var(--dsw-alias-state-warning-primary,#c98522);}
      .pmtd-detail{min-width:0;min-height:520px;display:flex;flex-direction:column;}
      .pmtd-detail-head{display:flex;align-items:flex-start;gap:10px;padding:13px 14px 11px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmtd-detail-copy{min-width:0;flex:1;}
      .pmtd-detail-copy h2{margin:0;font-size:14.5px;font-weight:680;line-height:1.35;overflow-wrap:anywhere;}
      .pmtd-detail-copy p{margin:3px 0 0;color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtd-mobile-project{display:none;min-width:170px;}
      .pmtd-list{min-width:0;flex:1;}
      .pmtd-row{display:grid;grid-template-columns:18px minmax(0,1fr) 78px;gap:9px;padding:11px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}
      .pmtd-row:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 1.5%,transparent);}
      .pmtd-row.is-created{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 4%,transparent);}
      .pmtd-row-check{padding-top:3px;}
      .pmtd-row-check input{width:14px;height:14px;margin:0;accent-color:var(--dsw-alias-accent-primary,#5b8def);cursor:pointer;}
      .pmtd-row-main{min-width:0;display:grid;gap:6px;}
      .pmtd-title-input{width:100%;height:25px;min-width:0;padding:0 5px;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:650;line-height:1.4;text-align:left;}
      .pmtd-title-input:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);}
      .pmtd-title-input:focus{border-color:var(--dsw-alias-accent-primary,#5b8def);background:var(--dsw-alias-bg-base);}
      .pmtd-title-input:disabled{opacity:1;cursor:default;}
      .pmtd-desc{margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.48;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;}
      .pmtd-meta{display:flex;align-items:center;gap:5px 9px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.4;}
      .pmtd-meta-item{display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:100%;}
      .pmtd-meta-item strong{color:var(--dsw-alias-label-secondary);font-weight:560;}
      .pmtd-meta-item.is-missing strong{color:var(--dsw-alias-state-warning-primary,#c98522);}
      .pmtd-default{height:18px;display:inline-flex;align-items:center;gap:3px;padding:0 5px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 10%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);font-size:9px;}
      .pmtd-source{min-width:0;max-width:190px;height:18px;display:inline-flex;align-items:center;gap:4px;padding:0 5px;border:0;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:9px;cursor:pointer;}
      .pmtd-source:hover{color:var(--dsw-alias-label-primary);}
      .pmtd-source span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtd-source:disabled{cursor:default;opacity:.75;}
      .pmtd-actions{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:5px;min-width:0;}
      .pmtd-action{width:78px;height:25px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid transparent;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;line-height:1;text-align:center;white-space:nowrap;cursor:default;}
      .pmtd-action.status.ready{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 11%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmtd-action.status.needs{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#dda34d) 12%,transparent);color:var(--dsw-alias-state-warning-primary,#b9791f);}
      .pmtd-action.status.done{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8def) 11%,transparent);color:var(--dsw-alias-accent-primary,#5b8def);}
      .pmtd-action.edit{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);cursor:pointer;}
      .pmtd-action.edit:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtd-action.edit:disabled{cursor:not-allowed;opacity:.45;}
      .pmtd-duplicate-row{grid-column:2 / -1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 8px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning-primary,#dda34d) 34%,transparent);border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#dda34d) 8%,transparent);color:var(--dsw-alias-state-warning-primary,#a76a16);font-size:10px;}
      .pmtd-duplicate-copy{min-width:0;}
      .pmtd-duplicate-actions{display:flex;gap:5px;flex-wrap:wrap;}
      .pmtd-mini-btn{height:24px;padding:0 7px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning-primary,#dda34d) 38%,transparent);border-radius:4px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-warning-primary,#a76a16);font:inherit;font-size:9.5px;white-space:nowrap;cursor:pointer;}
      .pmtd-mini-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);}
      .pmtd-task-link{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-accent-primary,#5b8def);font-size:9.5px;}
      .pmtd-task-link button{padding:0;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;}
      .pmtd-footer{position:sticky;bottom:0;z-index:2;min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-top:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 84%,var(--dsw-alias-bg-layer-1));}
      .pmtd-footer-copy{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;}
      .pmtd-empty{display:grid;place-content:center;justify-items:center;gap:8px;min-height:300px;padding:24px;text-align:center;color:var(--dsw-alias-label-secondary);}
      .pmtd-empty strong{color:var(--dsw-alias-label-primary);font-size:13px;}
      .pmtd-empty span{max-width:320px;font-size:11px;line-height:1.55;}
      .pmtd-loading{display:flex;align-items:center;justify-content:center;gap:8px;min-height:320px;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmtd-spinner{width:14px;height:14px;border:2px solid color-mix(in srgb,var(--dsw-alias-label-tertiary) 40%,transparent);border-top-color:var(--dsw-alias-accent-primary,#5b8def);border-radius:50%;animation:pmtd-spin .8s linear infinite;}
      @keyframes pmtd-spin{to{transform:rotate(360deg);}}
      .pmtd-drawer-mask{position:fixed;inset:0;z-index:120;background:rgba(5,8,12,.5);}
      .pmtd-drawer{width:min(548px,100vw);height:100dvh;margin-left:auto;display:flex;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:-18px 0 48px rgba(0,0,0,.28);}
      .pmtd-drawer-head{flex:none;min-height:58px;display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmtd-drawer-head-copy{min-width:0;flex:1;}
      .pmtd-drawer-head h2{margin:0;font-size:14px;font-weight:680;}
      .pmtd-drawer-head p{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtd-drawer-close{width:30px;height:30px;display:grid;place-items:center;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtd-drawer-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmtd-drawer-body{flex:1;min-height:0;overflow:auto;padding:14px;display:grid;align-content:start;gap:12px;scrollbar-gutter:stable;}
      .pmtd-form-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;}
      .pmtd-field{display:grid;gap:5px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmtd-field.full{grid-column:1 / -1;}
      .pmtd-readonly{min-height:32px;display:flex;align-items:center;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;overflow-wrap:anywhere;}
      .pmtd-readonly-group{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmtd-readonly-group .pmtd-field{gap:3px;}
      .pmtd-tag-select{position:relative;min-width:0;}
      .pmtd-tag-trigger{width:100%;min-height:32px;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;text-align:left;cursor:pointer;}
      .pmtd-tag-trigger:hover{border-color:var(--dsw-alias-border-l4);}
      .pmtd-tag-trigger span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtd-tags{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0;}
      .pmtd-tag{display:inline-flex;align-items:center;gap:4px;max-width:100%;height:23px;padding:0 5px 0 7px;border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#5b8def) 9%,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:9.5px;}
      .pmtd-tag span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtd-tag button{width:16px;height:16px;display:grid;place-items:center;padding:0;border:0;border-radius:3px;background:transparent;color:inherit;font:inherit;cursor:pointer;}
      .pmtd-tag button:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmtd-tag-menu{position:absolute;z-index:8;left:0;right:0;top:calc(100% + 5px);max-height:230px;overflow:auto;padding:5px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 12px 30px rgba(0,0,0,.22);}
      .pmtd-tag-option{width:100%;min-height:29px;display:flex;align-items:center;gap:7px;padding:5px 7px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:10.5px;text-align:left;cursor:pointer;}
      .pmtd-tag-option:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmtd-tag-option input{width:13px;height:13px;margin:0;accent-color:var(--dsw-alias-accent-primary,#5b8def);pointer-events:none;}
      .pmtd-tag-empty{padding:12px;color:var(--dsw-alias-label-tertiary);font-size:10px;text-align:center;}
      .pmtd-form-note{display:flex;align-items:flex-start;gap:6px;padding:8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.5;}
      .pmtd-drawer-foot{flex:none;min-height:56px;display:flex;align-items:center;justify-content:flex-end;gap:7px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}
      .pmtd-drawer-error{margin:0;padding:8px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 9%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10.5px;line-height:1.5;}
      .pmtd-create-list{display:grid;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;overflow:hidden;}
      .pmtd-create-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmtd-create-item:last-child{border-bottom:0;}
      .pmtd-create-item strong{display:block;font-size:11px;font-weight:620;line-height:1.45;overflow-wrap:anywhere;}
      .pmtd-create-item span{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmtd-create-item code{align-self:center;color:var(--dsw-alias-label-tertiary);font-size:9px;}
      .pmtd-advanced{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
      .pmtd-advanced summary{padding:9px 10px;color:var(--dsw-alias-label-primary);font-size:11px;font-weight:600;cursor:pointer;list-style:none;}
      .pmtd-advanced summary::-webkit-details-marker{display:none;}
      .pmtd-advanced summary::before{content:"›";display:inline-block;width:14px;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease;}
      .pmtd-advanced[open] summary::before{transform:rotate(90deg);}
      .pmtd-advanced-body{display:grid;gap:7px;padding:0 10px 10px;}
      .pmtd-check{display:flex;align-items:flex-start;gap:7px;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.5;cursor:pointer;}
      .pmtd-check input{width:13px;height:13px;flex:none;margin:2px 0 0;accent-color:var(--dsw-alias-accent-primary,#5b8def);}
      .pmtd-check.is-disabled{opacity:.5;cursor:not-allowed;}
      .pmtd-result{display:grid;gap:7px;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);font-size:10.5px;}
      .pmtd-result strong{font-size:11px;}
      .pmtd-result span{color:var(--dsw-alias-label-secondary);}
      @container (max-width:760px){
        .pmtd-workspace{grid-template-columns:1fr;}
        .pmtd-projects{display:none;}
        .pmtd-detail-head{align-items:stretch;flex-direction:column;}
        .pmtd-mobile-project{display:block;width:100%;min-width:0;flex:none;}
        .pmtd-head-actions{width:100%;margin-left:0;}
        .pmtd-head-actions{flex-wrap:wrap;}
        .pmtd-search{order:3;width:100%;max-width:none;flex-basis:100%;}
        .pmtd-row{grid-template-columns:18px minmax(0,1fr) 72px;padding:10px;}
        .pmtd-action{width:72px;}
        .pmtd-duplicate-row{align-items:flex-start;flex-direction:column;}
        .pmtd-footer{align-items:flex-start;flex-wrap:wrap;}
        .pmtd-footer .pmtd-btn{width:100%;}
      }
      @media(max-width:560px){
        .pmtd-form-grid,.pmtd-readonly-group{grid-template-columns:1fr;}
        .pmtd-drawer{width:100vw;max-width:100vw;}
        .pmtd-drawer-head,.pmtd-drawer-body,.pmtd-drawer-foot{padding-left:12px;padding-right:12px;}
      }
      .pmtc-inbox{position:fixed;inset:42px 0 0 0;z-index:75;display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);background:var(--dsw-alias-bg-base,#f7f8fa);color:var(--dsw-alias-label-primary);}
      .pmtc-inbox-side{border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;min-width:0;}
      .pmtc-inbox-head{padding:16px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:10px;}
      .pmtc-inbox-head h2{margin:0;font-size:17px;flex:1;}
      .pmtc-inbox-list{overflow:auto;padding:10px;display:grid;gap:8px;align-content:start;}
      .pmtc-batch{text-align:left;padding:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:inherit;cursor:pointer;font:inherit;}
      .pmtc-batch.is-active{border-color:var(--dsw-alias-accent-primary,#4f86e8);background:rgba(79,134,232,.07);}
      .pmtc-batch strong{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtc-batch span{display:block;margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:11px;}
      .pmtc-inbox-main{min-width:0;overflow:auto;padding:20px;}
      .pmtc-panel{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
      .pmtc-panel-head{padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;gap:10px;align-items:flex-start;}
      .pmtc-panel-head h3{margin:0;font-size:15px;flex:1;}
      .pmtc-panel-body{padding:14px 16px;display:grid;gap:10px;}
      .pmtc-draft{display:grid;gap:8px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
      .pmtc-draft-head{display:flex;align-items:center;gap:8px;}
      .pmtc-draft-head h4{margin:0;font-size:13px;flex:1;}
      .pmtc-draft p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtc-draft-actions{display:flex;gap:6px;flex-wrap:wrap;}
      .pmtc-input,.pmtc-textarea,.pmtc-select{width:100%;padding:7px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;}
      .pmtc-textarea{min-height:80px;resize:vertical;}
      .pmtc-form{display:grid;gap:8px;padding:12px;border:1px dashed var(--dsw-alias-border-l3);border-radius:8px;}
      .pmtc-empty{padding:40px 20px;text-align:center;color:var(--dsw-alias-label-secondary);}
      .pmtc-origin{display:grid;gap:7px;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
      .pmtc-origin small{color:var(--dsw-alias-label-secondary);}
      @media(max-width:760px){.pmtc-overlay{position:fixed;inset:42px 0 0 0;width:auto}.pmtc-row-editor{grid-template-columns:1fr 1fr}.pmtc-inbox{grid-template-columns:1fr}.pmtc-inbox-side{max-height:42vh;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2)}.pmtc-cap-two{grid-template-columns:1fr}.pmtc-cap-footer{align-items:flex-start;flex-wrap:wrap}.pmtc-cap-footer-actions{width:100%;justify-content:flex-end}.pmtc-cap-btn{min-width:0}.pmtc-cap-btn.primary{min-width:0}}
    `;

    function commandId(prefix) {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }

    async function request(path, options = {}) {
      const token = window.localStorage.getItem(TOKEN_KEY);
      const headers = { ...options.headers };
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
      if (token !== null) headers.authorization = `Bearer ${token}`;
      const response = await fetch(path, {
        ...options,
        headers,
        cache: "no-store",
      });
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
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

    function fieldNode(label, value, missing) {
      return h(
        "span",
        { className: `pmtc-field${missing ? " missing" : ""}` },
        `${label}${value === undefined || value === "" ? "待补充" : value}`,
      );
    }

    function captureIcon(kind, size = 13) {
      const paths = {
        message: [
          "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z",
        ],
        spark: [
          "m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z",
          "M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z",
        ],
        task: [
          "M9 6h11M9 12h11M9 18h11",
          "m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2",
        ],
        plus: ["M12 5v14M5 12h14"],
        inbox: ["M4 4h16v16H4z", "M4 13h4l2 3h4l2-3h4"],
        checkSquare: [
          "M9 11l3 3L22 4",
          "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
        ],
        edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"],
        arrowLeft: ["m15 18-6-6 6-6", "M9 12h12"],
        search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
        refresh: ["M21 12a9 9 0 1 1-3-6.7", "M21 3v6h-6"],
        alert: ["M12 3 2 21h20Z", "M12 9v5", "M12 17h.01"],
        link: [
          "M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2",
          "M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2",
        ],
        clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"],
        chevronDown: ["m6 9 6 6 6-6"],
        x: ["M18 6 6 18", "M6 6l12 12"],
        users: [
          "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
          "M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
          "M22 21v-2a4 4 0 0 0-3-3.87",
        ],
        calendar: ["M3 5h18v16H3z", "M16 3v4M8 3v4M3 10h18"],
        check: ["m5 12 4 4L19 6"],
      };
      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        ...(paths[kind] ?? paths.message).map((path, index) =>
          h("path", { key: index, d: path }),
        ),
      );
    }

    function TaskCapturePanel(props) {
      const manualOnly = props.manualOnly === true;
      const [loading, setLoading] = react.useState(!manualOnly);
      const [saving, setSaving] = react.useState(false);
      const [error, setError] = react.useState("");
      const [projection, setProjection] = react.useState(null);
      const [selected, setSelected] = react.useState([]);
      const [saved, setSaved] = react.useState(null);
      const [edits, setEdits] = react.useState({});
      const [manualCandidates, setManualCandidates] = react.useState([]);
      const [savedDraftsByCandidate, setSavedDraftsByCandidate] =
        react.useState({});
      const [createdTasksByCandidate, setCreatedTasksByCandidate] =
        react.useState({});
      const [sideBanner, setSideBanner] = react.useState(null);
      const [sideAction, setSideAction] = react.useState("");
      const [expandedCandidateId, setExpandedCandidateId] = react.useState("");
      const [editorCandidateId, setEditorCandidateId] = react.useState("");
      const [editorDraft, setEditorDraft] = react.useState(null);
      const incomingMessageIds = Array.isArray(props.messageIds)
        ? props.messageIds
        : [];
      const incomingSelectionText =
        typeof props.selectionText === "string"
          ? props.selectionText.trim()
          : "";
      const [pickedMessageIds, setPickedMessageIds] =
        react.useState(incomingMessageIds);
      const [selectionReady, setSelectionReady] = react.useState(
        manualOnly || incomingSelectionText !== "",
      );
      const [directory, setDirectory] = react.useState({
        humans: [],
        agents: [],
        roles: [],
      });
      const prepareCommand = react.useRef(commandId("tc-prepare"));
      const saveCommand = react.useRef("");
      const messageOptions = Array.isArray(props.messageOptions)
        ? props.messageOptions
        : [];

      react.useEffect(() => {
        setPickedMessageIds(incomingMessageIds);
        setSelectionReady(manualOnly || incomingSelectionText !== "");
        setLoading(!manualOnly && incomingSelectionText !== "");
        setProjection(null);
        setSelected([]);
        setSaved(null);
        setManualCandidates([]);
        setSavedDraftsByCandidate({});
        setCreatedTasksByCandidate({});
        setSideBanner(null);
        setSideAction("");
        setExpandedCandidateId("");
        setEditorCandidateId("");
        setEditorDraft(null);
        setError("");
        saveCommand.current = "";
      }, [
        manualOnly,
        props.sourceId,
        incomingSelectionText,
        incomingMessageIds.join(":"),
      ]);

      react.useEffect(() => {
        if (manualOnly) {
          setLoading(false);
          return undefined;
        }
        if (!selectionReady) {
          setLoading(false);
          return undefined;
        }
        let disposed = false;
        prepareCommand.current = commandId("tc-prepare");
        setLoading(true);
        setError("");
        setSaved(null);
        void (async () => {
          try {
            const result = await request("/api/collab/task-capture/prepare", {
              method: "POST",
              body: JSON.stringify({
                sourceRef: {
                  sourceType: props.sourceType,
                  sourceId: props.sourceId,
                  ...(props.sourceTitle === undefined
                    ? {}
                    : { sourceTitle: props.sourceTitle }),
                },
                selection: {
                  messageIds: pickedMessageIds,
                  actionItemIds: props.actionItemIds ?? [],
                  reportSectionIds: [],
                  ...(incomingSelectionText === ""
                    ? {}
                    : { text: incomingSelectionText }),
                },
                commandId: prepareCommand.current,
              }),
            });
            if (disposed) return;
            setProjection(result);
            setSelected((result.candidates ?? []).map((item) => item.id));
            setEdits(
              Object.fromEntries(
                (result.candidates ?? []).map((candidate) => [
                  candidate.id,
                  {
                    title: candidate.title,
                    description: candidate.description || candidate.title,
                    priority: candidate.priorityHint ?? "P2",
                    due: candidate.dueHint ?? "",
                    acceptance: (candidate.acceptanceHints ?? []).join("\n"),
                    receiverKey:
                      candidate.receiverHint === undefined
                        ? ""
                        : `${candidate.receiverHint.kind}:${candidate.receiverHint.id}`,
                  },
                ]),
              ),
            );
            if (result.session?.workspaceId) {
              const bootstrap = await request(
                `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(result.session.workspaceId)}`,
              ).catch(() => null);
              if (!disposed) {
                setDirectory(
                  bootstrap?.directory ?? {
                    humans: [],
                    agents: [],
                    roles: [],
                  },
                );
              }
            }
            setLoading(false);
          } catch (cause) {
            if (disposed) return;
            setError(cause instanceof Error ? cause.message : String(cause));
            setLoading(false);
          }
        })();
        return () => {
          disposed = true;
        };
      }, [
        manualOnly,
        props.sourceType,
        props.sourceId,
        selectionReady,
        pickedMessageIds.join(":"),
        incomingSelectionText,
        (props.actionItemIds ?? []).join(":"),
      ]);

      const candidates = projection?.candidates ?? [];
      const allCandidates = [...candidates, ...manualCandidates];
      const receiverOptions = [
        ...directory.humans.map((item) => ({
          ...item,
          kind: "human",
        })),
        ...directory.agents.map((item) => ({
          ...item,
          kind: "agent",
        })),
        ...directory.roles.map((item) => ({
          ...item,
          kind: "role",
        })),
      ];
      const candidateEdit = (candidate) =>
        edits[candidate.id] ?? {
          title: candidate.title,
          description: candidate.description || candidate.title,
          priority: candidate.priorityHint ?? "P2",
          due: candidate.dueHint ?? "",
          acceptance: (candidate.acceptanceHints ?? []).join("\n"),
          receiverKey:
            candidate.receiverHint === undefined
              ? ""
              : `${candidate.receiverHint.kind}:${candidate.receiverHint.id}`,
        };
      const updateCandidateEdit = (candidate, patch) =>
        setEdits((current) => ({
          ...current,
          [candidate.id]: { ...candidateEdit(candidate), ...patch },
        }));
      const receiverForKey = (key) => {
        const separator = String(key ?? "").indexOf(":");
        if (separator < 0) return undefined;
        const kind = key.slice(0, separator);
        const id = key.slice(separator + 1);
        return receiverOptions.find(
          (item) => item.kind === kind && item.id === id,
        );
      };
      const initialsFor = (name) => {
        const value = String(name ?? "").trim();
        if (value === "") return "?";
        if (/^[A-Za-z]/.test(value)) {
          return value
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
        }
        return value.slice(0, 1);
      };
      const sourceKind = manualOnly
        ? "手工"
        : props.sourceType === "data-agent"
          ? "数据洞察"
          : props.sourceType === "workbench" ||
              props.sourceType === "workbench-v2"
            ? "工作台"
            : "沟通";
      const sourceLabel = manualOnly
        ? "手工添加"
        : `${sourceKind} · ${props.sourceTitle ?? "当前会话"}`;
      const openCandidateEditor = (candidate) => {
        setEditorCandidateId(candidate.id);
        setEditorDraft({ ...candidateEdit(candidate) });
      };
      const closeCandidateEditor = () => {
        setEditorCandidateId("");
        setEditorDraft(null);
      };
      const applyCandidateEditor = () => {
        if (editorCandidateId === "" || editorDraft === null) return;
        if (String(editorDraft.title ?? "").trim() === "") {
          setError("待办标题不能为空");
          return;
        }
        setEdits((current) => ({
          ...current,
          [editorCandidateId]: { ...editorDraft },
        }));
        closeCandidateEditor();
      };
      const addManualCandidate = () => {
        const id = `manual:${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const candidate = {
          id,
          title: "未命名待办",
          description: "",
          sourceItemKey: id,
          priorityHint: "P2",
          dueHint: "",
          acceptanceHints: [],
          collaboratorHints: [],
          evidenceRefs: [],
          confidence: "medium",
          sourceExcerpt: "手动添加",
          missingFields: ["description", "acceptance"],
          status: "proposed",
          manual: true,
        };
        setManualCandidates((current) => [...current, candidate]);
        setEdits((current) => ({
          ...current,
          [id]: {
            title: candidate.title,
            description: "",
            priority: "P2",
            due: "",
            acceptance: "",
            receiverKey: "",
          },
        }));
        setSelected((current) => [...current, id]);
      };
      const togglePickedMessage = (id) => {
        setPickedMessageIds((current) =>
          current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id],
        );
      };
      const toggleAllMessages = () => {
        setPickedMessageIds((current) =>
          current.length === messageOptions.length
            ? []
            : messageOptions.map((message) => message.id),
        );
      };
      const toggle = (id) => {
        setSelected((current) =>
          current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id],
        );
      };
      const openInbox = (result = saved) => {
        window.__pluginmaxPendingTaskCapture = {
          workspaceId: result?.batch?.workspaceId,
          batchId: result?.batch?.id,
        };
        window.__pluginmaxShell?.setRoute?.("task");
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-open", {
              detail: {
                workspaceId: result?.batch?.workspaceId,
                batchId: result?.batch?.id,
              },
            }),
          );
        }, 120);
        props.onClose?.();
      };
      const save = async () => {
        if (projection === null || selected.length === 0) return;
        if (
          selected.some(
            (candidateId) =>
              (edits[candidateId]?.description ?? "").trim() === "",
          )
        ) {
          setError("任务描述不能为空");
          return;
        }
        setSaving(true);
        setError("");
        saveCommand.current = saveCommand.current || commandId("tc-save");
        try {
          const result = await request("/api/collab/task-capture/save", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: projection.session.workspaceId,
              sessionId: projection.session.id,
              candidateIds: selected,
              candidateOverrides: selected.map((candidateId) => {
                const edit = edits[candidateId];
                const description = (edit?.description ?? "").trim();
                const separator = (edit?.receiverKey ?? "").indexOf(":");
                const kind =
                  separator < 0 ? "" : edit.receiverKey.slice(0, separator);
                const id =
                  separator < 0 ? "" : edit.receiverKey.slice(separator + 1);
                const item = [
                  ...directory.humans.map((value) => ({
                    ...value,
                    kind: "human",
                  })),
                  ...directory.agents.map((value) => ({
                    ...value,
                    kind: "agent",
                  })),
                  ...directory.roles.map((value) => ({
                    ...value,
                    kind: "role",
                  })),
                ].find((value) => value.kind === kind && value.id === id);
                return {
                  candidateId,
                  title: (edit?.title ?? candidate.title).trim(),
                  description,
                  ...(edit?.priority === undefined
                    ? {}
                    : { priority: edit.priority }),
                  due: edit?.due ? edit.due : null,
                  receiverHint: item
                    ? { kind: item.kind, id: item.id, name: item.name }
                    : null,
                };
              }),
              commandId: saveCommand.current,
              expectedRevision: projection.session.revision,
            }),
          });
          setSaved(result);
          props.onSaved?.(result);
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-refresh"),
          );
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setSaving(false);
        }
      };
      const undoSaved = async () => {
        if (saved?.batch === undefined) return;
        try {
          await request("/api/collab/task-capture/batch/undo", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: saved.batch.workspaceId,
              batchId: saved.batch.id,
              commandId: commandId("tc-undo"),
            }),
          });
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-refresh"),
          );
          props.onClose?.();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const saveSideSelection = async (createFormalTasks) => {
        if (projection === null && !manualOnly) return;
        const chosen = allCandidates.filter(
          (candidate) =>
            selected.includes(candidate.id) &&
            savedDraftsByCandidate[candidate.id] === undefined &&
            createdTasksByCandidate[candidate.id] === undefined,
        );
        if (chosen.length === 0) return;
        const invalid = chosen.find(
          (candidate) =>
            String(candidateEdit(candidate).title ?? "").trim() === "",
        );
        if (invalid !== undefined) {
          setError("待办标题不能为空");
          return;
        }
        setSideAction(createFormalTasks ? "create" : "save");
        setError("");
        try {
          let workspaceId = projection?.session?.workspaceId ?? "";
          if (workspaceId === "") {
            if (
              typeof window.__pluginmaxDataAgentWorkspaceId === "string" &&
              window.__pluginmaxDataAgentWorkspaceId !== ""
            ) {
              workspaceId = window.__pluginmaxDataAgentWorkspaceId;
            } else {
              const workspaceResult = await request(
                "/api/collab/team/workspaces",
              );
              workspaceId = workspaceResult.workspaces?.[0]?.id ?? "";
            }
          }
          if (workspaceId === "") throw new Error("未找到可用工作区");
          const records = [];
          const sourceCandidates = chosen.filter(
            (candidate) => candidate.manual !== true,
          );
          if (sourceCandidates.length > 0) {
            const savedProjection = await request(
              "/api/collab/task-capture/save",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId: projection.session.workspaceId,
                  sessionId: projection.session.id,
                  candidateIds: sourceCandidates.map(
                    (candidate) => candidate.id,
                  ),
                  candidateOverrides: sourceCandidates.map((candidate) => {
                    const edit = candidateEdit(candidate);
                    const receiver = receiverForKey(edit.receiverKey);
                    return {
                      candidateId: candidate.id,
                      title: edit.title.trim(),
                      description: edit.description.trim() || edit.title.trim(),
                      priority: edit.priority,
                      due: edit.due.trim() === "" ? null : edit.due.trim(),
                      receiverHint:
                        receiver === undefined
                          ? null
                          : {
                              kind: receiver.kind,
                              id: receiver.id,
                              name: receiver.name,
                            },
                    };
                  }),
                  commandId: saveCommand.current || commandId("tc-save"),
                  expectedRevision: projection.session.revision,
                }),
              },
            );
            saveCommand.current = saveCommand.current || commandId("tc-save");
            const draftsBySource = new Map(
              savedProjection.drafts.map((draft) => [
                draft.sourceItemKey,
                draft,
              ]),
            );
            for (const candidate of sourceCandidates) {
              const draft = draftsBySource.get(candidate.sourceItemKey);
              if (draft === undefined) {
                throw new Error("任务草稿保存结果不完整");
              }
              records.push({
                candidate,
                draft,
                batch: savedProjection.batch,
              });
            }
          }
          for (const candidate of chosen.filter(
            (item) => item.manual === true,
          )) {
            const edit = candidateEdit(candidate);
            const savedProjection = await request(
              "/api/collab/task-capture/manual",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId,
                  description: edit.description.trim() || edit.title.trim(),
                  priority: edit.priority,
                  commandId: commandId("tc-manual"),
                }),
              },
            );
            records.push({
              candidate,
              draft: savedProjection.drafts[0],
              batch: savedProjection.batch,
            });
          }

          const updatedRecords = [];
          for (const record of records) {
            const edit = candidateEdit(record.candidate);
            const receiver = receiverForKey(edit.receiverKey);
            const updatedResponse = await request(
              "/api/collab/task-capture/draft/update",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId: record.draft.workspaceId,
                  draftId: record.draft.id,
                  expectedRevision: record.draft.revision,
                  commandId: commandId("tc-update"),
                  patch: {
                    title: edit.title.trim(),
                    description: edit.description.trim() || edit.title.trim(),
                    receiverType: receiver?.kind ?? "unassigned",
                    receiverId: receiver?.id ?? null,
                    receiverName: receiver?.name ?? null,
                    priority: edit.priority,
                    due: edit.due.trim() === "" ? null : edit.due.trim(),
                    acceptance: edit.acceptance
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  },
                }),
              },
            );
            const updatedDraft = updatedResponse?.draft ?? updatedResponse;
            if (
              updatedDraft === null ||
              typeof updatedDraft !== "object" ||
              typeof updatedDraft.id !== "string"
            ) {
              throw new Error("任务草稿更新结果不完整");
            }
            updatedRecords.push({ ...record, draft: updatedDraft });
          }

          setSavedDraftsByCandidate((current) => ({
            ...current,
            ...Object.fromEntries(
              updatedRecords.map((record) => [
                record.candidate.id,
                record.draft,
              ]),
            ),
          }));
          setSelected((current) =>
            current.filter(
              (candidateId) =>
                !chosen.some((candidate) => candidate.id === candidateId),
            ),
          );
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-refresh"),
          );

          if (!createFormalTasks) {
            const result = {
              batch: updatedRecords[0]?.batch,
              drafts: updatedRecords.map((record) => record.draft),
            };
            setSideBanner({
              kind: "draft",
              count: updatedRecords.length,
              result,
            });
            props.onSaved?.(result);
            return;
          }

          const byBatch = new Map();
          for (const record of updatedRecords) {
            const group = byBatch.get(record.batch.id) ?? {
              batch: record.batch,
              records: [],
            };
            group.records.push(record);
            byBatch.set(record.batch.id, group);
          }
          let createdCount = 0;
          let skippedCount = 0;
          let lastResult;
          const createdByCandidate = {};
          for (const group of byBatch.values()) {
            const batchProjection = await request(
              `/api/collab/task-capture/batch?workspaceId=${encodeURIComponent(group.batch.workspaceId)}&batchId=${encodeURIComponent(group.batch.id)}`,
            );
            const result = await request("/api/collab/task-capture/commit", {
              method: "POST",
              body: JSON.stringify({
                workspaceId: group.batch.workspaceId,
                batchId: group.batch.id,
                draftIds: group.records.map((record) => record.draft.id),
                commandId: commandId("tc-create"),
                expectedRevision: batchProjection.batch.revision,
                createMode: "create-only",
              }),
            });
            createdCount +=
              result.summary.created + result.summary.deduplicated;
            skippedCount += result.summary.failed + result.summary.skipped;
            lastResult = result;
            for (const record of group.records) {
              const item = result.items.find(
                (candidate) => candidate.draftId === record.draft.id,
              );
              if (item?.taskId !== undefined) {
                createdByCandidate[record.candidate.id] = item.taskId;
              }
            }
          }
          setCreatedTasksByCandidate((current) => ({
            ...current,
            ...createdByCandidate,
          }));
          setSideBanner({
            kind: "created",
            count: createdCount,
            skipped: skippedCount,
            result: lastResult,
          });
          props.onSaved?.(lastResult);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setSideAction("");
        }
      };

      if (props.mode === "side" && selectionReady) {
        const selectableCount = selected.filter((candidateId) => {
          const candidate = allCandidates.find(
            (item) => item.id === candidateId,
          );
          return (
            candidate !== undefined &&
            savedDraftsByCandidate[candidateId] === undefined &&
            createdTasksByCandidate[candidateId] === undefined
          );
        }).length;
        const editorCandidate =
          editorCandidateId === ""
            ? undefined
            : allCandidates.find(
                (candidate) => candidate.id === editorCandidateId,
              );
        return h(
          "section",
          {
            className: "pmtc-overlay is-side",
            "aria-label": "任务草稿侧边栏",
          },
          h("style", null, styles),
          h(
            "div",
            { className: "pmtc-cap-scroll" },
            h(
              "div",
              { className: "pmtc-cap-content" },
              sideBanner !== null
                ? h(
                    "div",
                    { className: "pmtc-cap-banner", role: "status" },
                    captureIcon(
                      sideBanner.kind === "created" ? "checkSquare" : "check",
                      13,
                    ),
                    h(
                      "span",
                      null,
                      sideBanner.kind === "created"
                        ? `已批量创建 ${sideBanner.count} 个正式任务，未自动派发。${sideBanner.skipped > 0 ? ` ${sideBanner.skipped} 条未满足创建条件。` : ""}`
                        : `已保存 ${sideBanner.count} 条任务草稿，可在任务草稿箱继续完善。`,
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => openInbox(sideBanner.result),
                      },
                      sideBanner.kind === "created" ? "查看任务" : "查看草稿",
                    ),
                  )
                : null,
              error === ""
                ? null
                : h("div", { className: "pmtc-cap-error" }, error),
              loading
                ? h(
                    "div",
                    { className: "pmtc-cap-empty" },
                    h("strong", null, "正在整理候选事项…"),
                    h("span", null, "请稍候，生成后会直接进入任务清单。"),
                  )
                : h(
                    react.Fragment,
                    null,
                    allCandidates.length === 0
                      ? h(
                          "div",
                          { className: "pmtc-cap-empty" },
                          captureIcon("checkSquare", 16),
                          h("strong", null, "本次待办已处理"),
                          h(
                            "span",
                            null,
                            "可以手动添加一条，或继续查看其他沟通来源。",
                          ),
                        )
                      : h(
                          "div",
                          { className: "pmtc-cap-list" },
                          ...allCandidates.map((candidate) => {
                            const edit = candidateEdit(candidate);
                            const receiver = receiverForKey(edit.receiverKey);
                            const checked = selected.includes(candidate.id);
                            const savedDraft =
                              savedDraftsByCandidate[candidate.id];
                            const createdTaskId =
                              createdTasksByCandidate[candidate.id];
                            const frozen =
                              savedDraft !== undefined ||
                              createdTaskId !== undefined;
                            const expanded =
                              expandedCandidateId === candidate.id;
                            const unassigned = receiver === undefined;
                            const due = edit.due.trim();
                            return h(
                              "article",
                              {
                                key: candidate.id,
                                className: `pmtc-cap-row${
                                  checked ? " is-selected" : ""
                                }${savedDraft ? " is-saved" : ""}${
                                  createdTaskId ? " is-created" : ""
                                }${unassigned ? " is-unassigned" : ""}`,
                                "data-task-row": candidate.id,
                              },
                              h(
                                "label",
                                {
                                  className: "pmtc-cap-check",
                                  "aria-label": `选择${edit.title}`,
                                },
                                h("input", {
                                  type: "checkbox",
                                  checked,
                                  disabled: frozen,
                                  onChange: () => toggle(candidate.id),
                                }),
                              ),
                              h(
                                "div",
                                { className: "pmtc-cap-main" },
                                h(
                                  "div",
                                  { className: "pmtc-cap-title-line" },
                                  h("input", {
                                    className: "pmtc-cap-title",
                                    value: edit.title,
                                    disabled: frozen,
                                    "aria-label": "编辑待办标题",
                                    onChange: (event) =>
                                      updateCandidateEdit(candidate, {
                                        title: event.target.value,
                                      }),
                                  }),
                                  createdTaskId
                                    ? h(
                                        "span",
                                        {
                                          className: "pmtc-cap-chip is-created",
                                        },
                                        `已创建 ${createdTaskId}`,
                                      )
                                    : savedDraft
                                      ? h(
                                          "span",
                                          { className: "pmtc-cap-chip" },
                                          "已存草稿",
                                        )
                                      : null,
                                ),
                                h(
                                  "div",
                                  {
                                    className: `pmtc-cap-meta${
                                      unassigned ? " pmtc-cap-unassigned" : ""
                                    }`,
                                  },
                                  h(
                                    "span",
                                    { className: "pmtc-cap-assignee" },
                                    h(
                                      "span",
                                      { className: "pmtc-cap-avatar" },
                                      initialsFor(
                                        receiver?.name ??
                                          (unassigned ? "" : "?"),
                                      ),
                                    ),
                                    receiver?.name ?? "未指定负责人",
                                  ),
                                  h("span", {
                                    className: "pmtc-cap-dot",
                                  }),
                                  h(
                                    "span",
                                    {
                                      className: `pmtc-cap-due${
                                        due === "" ? " is-missing" : ""
                                      }`,
                                    },
                                    due === "" ? "未定截止" : due,
                                  ),
                                  h(
                                    "span",
                                    { className: "pmtc-cap-priority" },
                                    edit.priority,
                                  ),
                                  h(
                                    "button",
                                    {
                                      type: "button",
                                      className: "pmtc-cap-source",
                                      "aria-label": "查看待办来源",
                                      onClick: () =>
                                        setExpandedCandidateId(
                                          expanded ? "" : candidate.id,
                                        ),
                                    },
                                    captureIcon("message", 11),
                                    h("span", null, sourceLabel),
                                  ),
                                ),
                                expanded
                                  ? h(
                                      "div",
                                      {
                                        className: "pmtc-cap-source-detail",
                                      },
                                      h("strong", null, "来源摘录"),
                                      candidate.sourceExcerpt ??
                                        incomingSelectionText ??
                                        sourceLabel,
                                      h(
                                        "div",
                                        { className: "pmtc-cap-fields" },
                                        h(
                                          "span",
                                          {
                                            className: "pmtc-cap-field is-good",
                                          },
                                          captureIcon("check", 10),
                                          "已识别标题",
                                        ),
                                        h(
                                          "span",
                                          {
                                            className: `pmtc-cap-field${
                                              unassigned ? "" : " is-good"
                                            }`,
                                          },
                                          captureIcon("users", 10),
                                          unassigned
                                            ? "负责人待补充"
                                            : "建议负责人",
                                        ),
                                        h(
                                          "span",
                                          {
                                            className: `pmtc-cap-field${
                                              due === "" ? "" : " is-good"
                                            }`,
                                          },
                                          captureIcon("calendar", 10),
                                          due === ""
                                            ? "截止日期待补充"
                                            : "建议截止日期",
                                        ),
                                      ),
                                    )
                                  : null,
                              ),
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "pmtc-cap-edit",
                                  "aria-label": "编辑待办",
                                  disabled: frozen,
                                  onClick: () => openCandidateEditor(candidate),
                                },
                                captureIcon("edit", 11),
                                "编辑",
                              ),
                            );
                          }),
                        ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmtc-cap-add",
                        onClick: addManualCandidate,
                      },
                      captureIcon("plus", 11),
                      "手动添加一条待办",
                    ),
                  ),
            ),
          ),
          h(
            "footer",
            { className: "pmtc-cap-footer" },
            h(
              "span",
              { className: "pmtc-cap-selection" },
              `已选中 ${selectableCount} 项`,
            ),
            h(
              "span",
              { className: "pmtc-cap-footer-actions" },
              h(
                "button",
                {
                  type: "button",
                  className: "pmtc-cap-btn",
                  disabled:
                    sideAction !== "" || selectableCount === 0 || loading,
                  onClick: () => void saveSideSelection(false),
                },
                captureIcon("inbox", 12),
                sideAction === "save" ? "保存中…" : "保存到草稿箱",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pmtc-cap-btn primary",
                  disabled:
                    sideAction !== "" || selectableCount === 0 || loading,
                  onClick: () => void saveSideSelection(true),
                },
                captureIcon("checkSquare", 12),
                sideAction === "create" ? "创建中…" : "批量创建任务",
              ),
            ),
          ),
          editorCandidate !== undefined && editorDraft !== null
            ? h(
                "div",
                {
                  className: "pmtc-cap-drawer-mask",
                  onClick: (event) => {
                    if (event.target === event.currentTarget) {
                      closeCandidateEditor();
                    }
                  },
                },
                h(
                  "aside",
                  {
                    className: "pmtc-cap-drawer",
                    role: "dialog",
                    "aria-modal": "true",
                    "aria-label": "完善任务草稿",
                  },
                  h(
                    "header",
                    { className: "pmtc-cap-drawer-head" },
                    h(
                      "div",
                      { className: "pmtc-cap-drawer-head-copy" },
                      h("h2", null, "完善任务草稿"),
                      h("p", null, `来源：${sourceLabel}`),
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmtc-cap-drawer-close",
                        "aria-label": "关闭",
                        onClick: closeCandidateEditor,
                      },
                      captureIcon("x", 13),
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmtc-cap-drawer-body" },
                    h(
                      "label",
                      { className: "pmtc-cap-fieldset" },
                      h("span", null, "标题"),
                      h("input", {
                        value: editorDraft.title,
                        onChange: (event) =>
                          setEditorDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "label",
                      { className: "pmtc-cap-fieldset" },
                      h("span", null, "描述"),
                      h("textarea", {
                        value: editorDraft.description,
                        placeholder: "说明要完成的结果",
                        onChange: (event) =>
                          setEditorDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "div",
                      { className: "pmtc-cap-two" },
                      h(
                        "label",
                        { className: "pmtc-cap-fieldset" },
                        h("span", null, "负责人"),
                        h(
                          "select",
                          {
                            value: editorDraft.receiverKey,
                            onChange: (event) =>
                              setEditorDraft((current) => ({
                                ...current,
                                receiverKey: event.target.value,
                              })),
                          },
                          h("option", { value: "" }, "未指派"),
                          ...receiverOptions.map((item) =>
                            h(
                              "option",
                              {
                                key: `${item.kind}:${item.id}`,
                                value: `${item.kind}:${item.id}`,
                              },
                              item.name,
                            ),
                          ),
                        ),
                      ),
                      h(
                        "label",
                        { className: "pmtc-cap-fieldset" },
                        h("span", null, "截止日期"),
                        h("input", {
                          value: editorDraft.due,
                          placeholder: "例如 10月30日",
                          onChange: (event) =>
                            setEditorDraft((current) => ({
                              ...current,
                              due: event.target.value,
                            })),
                        }),
                      ),
                    ),
                    h(
                      "label",
                      { className: "pmtc-cap-fieldset" },
                      h("span", null, "优先级"),
                      h(
                        "select",
                        {
                          value: editorDraft.priority,
                          onChange: (event) =>
                            setEditorDraft((current) => ({
                              ...current,
                              priority: event.target.value,
                            })),
                        },
                        h("option", { value: "P1" }, "P1"),
                        h("option", { value: "P2" }, "P2"),
                        h("option", { value: "P3" }, "P3"),
                      ),
                    ),
                    h(
                      "label",
                      { className: "pmtc-cap-fieldset" },
                      h("span", null, "验收标准"),
                      h("textarea", {
                        value: editorDraft.acceptance,
                        placeholder: "每行一条验收标准",
                        onChange: (event) =>
                          setEditorDraft((current) => ({
                            ...current,
                            acceptance: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "p",
                      { className: "pmtc-cap-form-note" },
                      captureIcon("inbox", 12),
                      "保存草稿不会创建正式任务或派发 Agent。",
                    ),
                    h(
                      "div",
                      { className: "pmtc-cap-source-preview" },
                      h(
                        "strong",
                        null,
                        sourceKind === "沟通" ? "沟通原话" : "来源摘录",
                      ),
                      editorCandidate.sourceExcerpt ??
                        incomingSelectionText ??
                        sourceLabel,
                    ),
                  ),
                  h(
                    "footer",
                    { className: "pmtc-cap-drawer-footer" },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmtc-cap-btn",
                        onClick: closeCandidateEditor,
                      },
                      "取消",
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmtc-cap-btn primary",
                        onClick: applyCandidateEditor,
                      },
                      "保存修改",
                    ),
                  ),
                ),
              )
            : null,
        );
      }

      return h(
        "section",
        {
          className: `pmtc-overlay${props.mode === "context" ? " is-context" : props.mode === "side" ? " is-side" : ""}`,
          "aria-label": "任务草稿确认",
        },
        h("style", null, styles),
        props.mode !== "side"
          ? h(
              "div",
              { className: "pmtc-head" },
              h(
                "div",
                { className: "pmtc-head-copy" },
                h("h2", { className: "pmtc-title" }, "从本次沟通整理任务草稿"),
                h(
                  "p",
                  { className: "pmtc-subtitle" },
                  "轻量确认留在沟通里；复杂编辑再去任务管理。",
                ),
              ),
              h(
                "button",
                {
                  className: "pmtc-close",
                  type: "button",
                  "aria-label": "关闭任务草稿确认",
                  onClick: () => props.onClose?.(),
                },
                "×",
              ),
            )
          : null,
        h(
          "div",
          { className: "pmtc-body" },
          !selectionReady
            ? h(
                "div",
                { className: "pmtc-picker" },
                h(
                  "div",
                  { className: "pmtc-picker-head" },
                  h(
                    "div",
                    null,
                    h("strong", null, "选择用于生成任务的对话"),
                    h(
                      "span",
                      null,
                      `已选 ${pickedMessageIds.length} / ${messageOptions.length}`,
                    ),
                  ),
                  h(
                    "button",
                    {
                      className: "pmtc-btn",
                      type: "button",
                      disabled: messageOptions.length === 0,
                      onClick: toggleAllMessages,
                    },
                    pickedMessageIds.length === messageOptions.length
                      ? "取消全选"
                      : "全选",
                  ),
                ),
                messageOptions.length === 0
                  ? h("div", { className: "pmtc-empty" }, "暂无可选择的对话")
                  : h(
                      "div",
                      { className: "pmtc-picker-list" },
                      ...messageOptions.map((message) =>
                        h(
                          "label",
                          {
                            key: message.id,
                            className: `pmtc-picker-item${pickedMessageIds.includes(message.id) ? " is-checked" : ""}`,
                          },
                          h("input", {
                            type: "checkbox",
                            checked: pickedMessageIds.includes(message.id),
                            onChange: () => togglePickedMessage(message.id),
                          }),
                          h(
                            "div",
                            null,
                            h(
                              "span",
                              { className: "pmtc-picker-meta" },
                              `${message.senderName ?? "未知发送人"}${message.createdAt === undefined ? "" : ` · ${message.createdAt}`}`,
                            ),
                            h(
                              "p",
                              null,
                              message.content ?? message.excerpt ?? "",
                            ),
                          ),
                        ),
                      ),
                    ),
              )
            : null,
          selectionReady && props.mode !== "side"
            ? h(
                "div",
                { className: "pmtc-note" },
                incomingSelectionText === ""
                  ? `来源：${props.sourceTitle ?? "当前沟通"}。已带入 ${pickedMessageIds.length} 条对话。`
                  : `来源：${props.sourceTitle ?? "当前沟通"}。已带入当前选中文本。`,
              )
            : null,
          loading
            ? h("div", { className: "pmtc-empty" }, "正在整理候选事项…")
            : null,
          error === "" ? null : h("div", { className: "pmtc-error" }, error),
          saved !== null
            ? h(
                "div",
                { className: "pmtc-success" },
                h("h3", null, `已保存 ${saved.drafts.length} 条任务草稿`),
                h("p", null, "草稿没有创建正式任务，也不会派发 Agent。"),
                h(
                  "div",
                  { className: "pmtc-inline-actions" },
                  h(
                    "button",
                    {
                      className: "pmtc-btn primary",
                      type: "button",
                      onClick: () => openInbox(saved),
                    },
                    "去任务管理继续完善",
                  ),
                  h(
                    "button",
                    {
                      className: "pmtc-btn",
                      type: "button",
                      onClick: () => props.onClose?.(),
                    },
                    "保持当前沟通",
                  ),
                  h(
                    "button",
                    {
                      className: "pmtc-btn",
                      type: "button",
                      onClick: () => void undoSaved(),
                    },
                    "撤销本次保存",
                  ),
                ),
              )
            : null,
          selectionReady && saved === null && !loading
            ? h(
                "div",
                { className: "pmtc-list" },
                ...candidates.map((candidate) => {
                  const checked = selected.includes(candidate.id);
                  const edit = edits[candidate.id] ?? {
                    description: candidate.description || candidate.title,
                    priority: candidate.priorityHint ?? "P2",
                    due: candidate.dueHint ?? "",
                    receiverKey:
                      candidate.receiverHint === undefined
                        ? ""
                        : `${candidate.receiverHint.kind}:${candidate.receiverHint.id}`,
                  };
                  const updateEdit = (patch) =>
                    setEdits((current) => ({
                      ...current,
                      [candidate.id]: { ...edit, ...patch },
                    }));
                  return h(
                    "div",
                    {
                      className: `pmtc-row${checked ? "" : " is-unchecked"}`,
                      key: candidate.id,
                    },
                    h("input", {
                      type: "checkbox",
                      checked,
                      "aria-label": `选择${candidate.title}`,
                      onChange: () => toggle(candidate.id),
                    }),
                    h(
                      "div",
                      { className: "pmtc-row-main" },
                      h("textarea", {
                        className: "pmtc-textarea pmtc-row-description",
                        value: edit.description,
                        placeholder: "任务描述",
                        "aria-label": `编辑${candidate.title}任务描述`,
                        onChange: (event) =>
                          updateEdit({ description: event.target.value }),
                      }),
                      h(
                        "div",
                        { className: "pmtc-row-editor" },
                        h(
                          "select",
                          {
                            className: "pmtc-select",
                            value: edit.receiverKey,
                            "aria-label": "任务执行人",
                            onChange: (event) =>
                              updateEdit({ receiverKey: event.target.value }),
                          },
                          h("option", { value: "" }, "未指派"),
                          ...directory.humans.map((item) =>
                            h(
                              "option",
                              {
                                key: `human:${item.id}`,
                                value: `human:${item.id}`,
                              },
                              `人 · ${item.name}`,
                            ),
                          ),
                          ...directory.agents.map((item) =>
                            h(
                              "option",
                              {
                                key: `agent:${item.id}`,
                                value: `agent:${item.id}`,
                              },
                              `AI · ${item.name}`,
                            ),
                          ),
                          ...directory.roles.map((item) =>
                            h(
                              "option",
                              {
                                key: `role:${item.id}`,
                                value: `role:${item.id}`,
                              },
                              `角色 · ${item.name}`,
                            ),
                          ),
                        ),
                        h(
                          "select",
                          {
                            className: "pmtc-select",
                            value: edit.priority,
                            "aria-label": "任务优先级",
                            onChange: (event) =>
                              updateEdit({ priority: event.target.value }),
                          },
                          h("option", { value: "P1" }, "P0"),
                          h("option", { value: "P2" }, "P1"),
                          h("option", { value: "P3" }, "P2"),
                        ),
                      ),
                    ),
                  );
                }),
              )
            : null,
        ),
        saved === null
          ? h(
              "div",
              {
                className: `pmtc-foot${
                  selectionReady ? " pmtc-foot-actions" : ""
                }`,
              },
              !selectionReady
                ? h(
                    react.Fragment,
                    null,
                    h(
                      "div",
                      { className: "pmtc-foot-copy" },
                      `已选择 ${pickedMessageIds.length} 条对话`,
                    ),
                    h(
                      "button",
                      {
                        className: "pmtc-btn primary",
                        type: "button",
                        disabled: loading || pickedMessageIds.length === 0,
                        onClick: () => {
                          setLoading(true);
                          setSelectionReady(true);
                        },
                      },
                      "生成任务",
                    ),
                  )
                : h(
                    "button",
                    {
                      className: "pmtc-btn primary",
                      type: "button",
                      disabled: loading || saving || selected.length === 0,
                      onClick: () => void save(),
                    },
                    saving ? "保存中…" : `保存 ${selected.length} 条草稿`,
                  ),
            )
          : null,
      );
    }

    function sidePanelIcon(kind) {
      const paths =
        kind === "spark"
          ? [
              "m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z",
              "M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z",
            ]
          : kind === "task"
            ? [
                "M9 6h11M9 12h11M9 18h11",
                "m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2",
              ]
            : kind === "expand"
              ? ["M8 3H3v5", "M16 3h5v5", "M8 21H3v-5", "M16 21h5v-5"]
              : kind === "collapse"
                ? ["M3 8h5V3", "M21 8h-5V3", "M3 16h5v5", "M21 16h-5v5"]
                : kind === "panel"
                  ? ["M4 4h16v16H4Z", "M10 4v16"]
                  : [
                      "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z",
                    ];
      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 13,
          height: 13,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        ...paths.map((path, index) => h("path", { key: index, d: path })),
      );
    }

    function useSharedSidePanel() {
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

    function TaskDraftSidePanel() {
      const sidePanel = useSharedSidePanel();
      const [newTabOpen, setNewTabOpen] = react.useState(false);
      const [draggingTab, setDraggingTab] = react.useState("");
      const activeTabRef = react.useRef(null);
      const newTabWrapRef = react.useRef(null);
      const [source, setSource] = react.useState(
        () => window.__pluginmaxTaskDraftContext ?? null,
      );
      const [manualOpen, setManualOpen] = react.useState(false);
      const [manualDescription, setManualDescription] = react.useState("");
      const [manualPriority, setManualPriority] = react.useState("P2");
      const [manualSaving, setManualSaving] = react.useState(false);
      const [manualError, setManualError] = react.useState("");
      const [manualResult, setManualResult] = react.useState(null);
      const activeDescriptor =
        sidePanel.open === true && sidePanel.activeTab !== undefined
          ? window.__pluginmaxSidePanel?.describeTab?.(sidePanel.activeTab)
          : undefined;
      const active = activeDescriptor?.type === "task-drafts";
      const tabs = sidePanel.openTabs ?? [];

      react.useEffect(() => {
        activeTabRef.current?.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
        });
      }, [sidePanel.activeTab, tabs.length]);
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

      react.useEffect(() => {
        const receive = (event) => {
          const detail = event?.detail;
          if (detail === null || typeof detail !== "object") return;
          window.__pluginmaxTaskDraftContext = detail;
          setSource(detail);
          setManualOpen(false);
          setManualResult(null);
        };
        window.addEventListener("pluginmax:task-draft-open", receive);
        return () =>
          window.removeEventListener("pluginmax:task-draft-open", receive);
      }, []);

      const openManualDraftManagement = (result) => {
        window.__pluginmaxPendingTaskCapture = {
          workspaceId: result.batch.workspaceId,
          batchId: result.batch.id,
        };
        window.__pluginmaxShell?.setRoute?.("task");
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-open", {
              detail: {
                workspaceId: result.batch.workspaceId,
                batchId: result.batch.id,
              },
            }),
          );
        }, 120);
      };

      const manualWorkspaceId = async () => {
        if (
          typeof source?.workspaceId === "string" &&
          source.workspaceId !== ""
        )
          return source.workspaceId;
        if (
          typeof window.__pluginmaxDataAgentWorkspaceId === "string" &&
          window.__pluginmaxDataAgentWorkspaceId !== ""
        )
          return window.__pluginmaxDataAgentWorkspaceId;
        const result = await request("/api/collab/team/workspaces");
        const workspaceId = result.workspaces?.[0]?.id;
        if (typeof workspaceId !== "string" || workspaceId === "")
          throw new Error("未找到可用工作区");
        return workspaceId;
      };

      const saveManualDraft = async () => {
        const description = manualDescription.trim();
        if (description === "" || manualSaving) return;
        setManualSaving(true);
        setManualError("");
        try {
          const workspaceId = await manualWorkspaceId();
          const result = await request("/api/collab/task-capture/manual", {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              description,
              priority: manualPriority,
              commandId: commandId("tc-manual"),
            }),
          });
          setManualResult(result);
          setManualOpen(false);
          setManualDescription("");
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-refresh"),
          );
        } catch (cause) {
          setManualError(
            cause instanceof Error ? cause.message : String(cause),
          );
        } finally {
          setManualSaving(false);
        }
      };

      if (!active) return null;
      const labels = {
        "data-agent": "spark",
        communication: "message",
        "task-drafts": "task",
      };
      const moveTabFocus = (event, index) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
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
          const target = [...document.querySelectorAll("[data-tab]")].find(
            (node) =>
              node.dataset.tab === nextTab && node.getClientRects().length > 0,
          );
          target?.querySelector('button[role="tab"]')?.focus();
        });
      };
      return h(
        "div",
        { className: "pmtc-side-root" },
        h("style", null, styles),
        h(
          "section",
          { className: "pmtc-side-panel", "aria-label": "任务草稿侧边栏" },
          h(
            "div",
            {
              className: "pmtc-side-tabs",
              role: "tablist",
              "aria-label": "侧边工作区",
            },
            h(
              "div",
              { className: "pmtc-side-tab-scroll" },
              ...tabs.map((tab, tabIndex) => {
                const selected = sidePanel.activeTab === tab;
                const descriptor = window.__pluginmaxSidePanel?.describeTab?.(
                  tab,
                ) ?? {
                  type: tab,
                  title: tab,
                };
                const icon = labels[descriptor.type] ?? "message";
                const label = descriptor.title;
                return h(
                  "div",
                  {
                    key: tab,
                    className: `pmtc-side-tab${selected ? " is-active" : ""}`,
                    "data-tab": tab,
                    "data-tab-type": descriptor.type,
                    ref: selected ? activeTabRef : undefined,
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
                      "aria-selected": selected,
                      className: "pmtc-side-tab-main",
                      onClick: () => window.__pluginmaxSidePanel?.openTab(tab),
                      onKeyDown: (event) => moveTabFocus(event, tabIndex),
                    },
                    sidePanelIcon(icon),
                    h("span", null, label),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtc-side-tab-close",
                      "aria-label": `关闭${label}`,
                      onClick: () => window.__pluginmaxSidePanel?.closeTab(tab),
                    },
                    "×",
                  ),
                  h("span", {
                    className: "pmtc-side-tab-indicator",
                    "data-tab-indicator": "true",
                    "aria-hidden": true,
                  }),
                );
              }),
            ),
            h(
              "div",
              { className: "pmtc-side-tab-actions" },
              h(
                "div",
                {
                  className: "pmtc-side-tab-new-wrap",
                  ref: newTabWrapRef,
                },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmtc-side-tab-new",
                    "aria-label": "新建侧栏标签",
                    "data-new-tab-launcher": "true",
                    title: "新建标签",
                    "aria-haspopup": "menu",
                    "aria-expanded": newTabOpen,
                    onClick: () => setNewTabOpen((value) => !value),
                  },
                  "+",
                ),
                newTabOpen
                  ? h(
                      "div",
                      {
                        className: "pmtc-side-tab-new-menu",
                        role: "menu",
                      },
                      ...[
                        ["communication", "沟通"],
                        ["data-agent", "数据洞察"],
                        ["task-drafts", "任务草稿"],
                      ].map(([type, label]) =>
                        h(
                          "button",
                          {
                            key: type,
                            type: "button",
                            className: "pmtc-side-tab-new-item",
                            role: "menuitem",
                            "data-new-tab-type": type,
                            onClick: () => {
                              window.__pluginmaxSidePanel?.openNewTab(type);
                              setNewTabOpen(false);
                            },
                          },
                          sidePanelIcon(labels[type]),
                          h("span", null, label),
                        ),
                      ),
                    )
                  : null,
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pmtc-side-tab-action",
                  title: sidePanel.expanded ? "还原侧边栏" : "展开侧边栏",
                  "aria-label": sidePanel.expanded
                    ? "还原侧边栏"
                    : "展开侧边栏",
                  onClick: () => window.__pluginmaxSidePanel?.toggleExpanded(),
                },
                sidePanelIcon(sidePanel.expanded ? "collapse" : "expand"),
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pmtc-side-tab-action pmtc-side-tab-panel",
                  title: "关闭侧边栏",
                  "aria-label": "关闭侧边栏",
                  onClick: () => window.__pluginmaxSidePanel?.closeAll(),
                },
                sidePanelIcon("panel"),
              ),
            ),
          ),
          h(
            "div",
            { className: "pmtc-side-body" },
            false
              ? manualResult !== null
                ? h(
                    "div",
                    { className: "pmtc-manual-card" },
                    h("h3", null, "任务草稿已创建"),
                    h(
                      "p",
                      null,
                      manualResult.drafts?.[0]?.description ?? "手工任务草稿",
                    ),
                    h(
                      "div",
                      { className: "pmtc-manual-actions" },
                      h(
                        "button",
                        {
                          className: "pmtc-btn",
                          type: "button",
                          onClick: () => {
                            setManualResult(null);
                            setManualOpen(true);
                          },
                        },
                        "继续新建",
                      ),
                      h(
                        "button",
                        {
                          className: "pmtc-btn primary",
                          type: "button",
                          onClick: () =>
                            openManualDraftManagement(manualResult),
                        },
                        "去任务管理继续完善",
                      ),
                    ),
                  )
                : manualOpen
                  ? h(
                      "form",
                      {
                        className: "pmtc-manual-card pmtc-manual-form",
                        onSubmit: (event) => {
                          event.preventDefault();
                          void saveManualDraft();
                        },
                      },
                      h("h3", null, "新建任务草稿"),
                      h("textarea", {
                        className: "pmtc-textarea",
                        value: manualDescription,
                        placeholder: "任务描述",
                        "aria-label": "手工任务草稿描述",
                        autoFocus: true,
                        onChange: (event) =>
                          setManualDescription(event.target.value),
                      }),
                      h(
                        "select",
                        {
                          className: "pmtc-select",
                          value: manualPriority,
                          "aria-label": "手工任务草稿优先级",
                          onChange: (event) =>
                            setManualPriority(event.target.value),
                        },
                        h("option", { value: "P1" }, "P0"),
                        h("option", { value: "P2" }, "P1"),
                        h("option", { value: "P3" }, "P2"),
                      ),
                      manualError === ""
                        ? null
                        : h("div", { className: "pmtc-error" }, manualError),
                      h(
                        "div",
                        { className: "pmtc-manual-actions" },
                        h(
                          "button",
                          {
                            className: "pmtc-btn",
                            type: "button",
                            disabled: manualSaving,
                            onClick: () => {
                              setManualOpen(false);
                              setManualError("");
                            },
                          },
                          "取消",
                        ),
                        h(
                          "button",
                          {
                            className: "pmtc-btn primary",
                            type: "submit",
                            disabled:
                              manualSaving || manualDescription.trim() === "",
                          },
                          manualSaving ? "保存中…" : "保存草稿",
                        ),
                      ),
                    )
                  : h(
                      "div",
                      { className: "pmtc-manual-empty" },
                      h("strong", null, "暂无任务草稿"),
                      h(
                        "span",
                        null,
                        "可以从沟通中整理，也可以手工创建一条草稿。",
                      ),
                      h(
                        "button",
                        {
                          className: "pmtc-btn primary",
                          type: "button",
                          onClick: () => {
                            setManualError("");
                            setManualOpen(true);
                          },
                        },
                        "新建任务草稿",
                      ),
                    )
              : h(TaskCapturePanel, {
                  ...(source ?? {}),
                  mode: "side",
                  manualOnly: source === null,
                  onClose: () =>
                    window.__pluginmaxSidePanel?.closeTab("task-drafts"),
                }),
          ),
        ),
      );
    }

    function LegacyTaskCaptureInboxLauncher(props) {
      const workspaceIds = (props.workspaceIds ?? []).filter(Boolean);
      const [open, setOpen] = react.useState(false);
      const [summaryCount, setSummaryCount] = react.useState(0);
      const [items, setItems] = react.useState([]);
      const [selected, setSelected] = react.useState(null);
      const [detail, setDetail] = react.useState(null);
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [lastCommit, setLastCommit] = react.useState(null);
      const [directory, setDirectory] = react.useState({
        humans: [],
        agents: [],
        roles: [],
      });
      const [editDraftId, setEditDraftId] = react.useState("");
      const [form, setForm] = react.useState({
        title: "",
        description: "",
        receiverKey: "",
        collaboratorKeys: [],
        priority: "P2",
        due: "",
        acceptance: "",
      });

      const loadSummary = react.useCallback(async () => {
        if (workspaceIds.length === 0) {
          setSummaryCount(0);
          return;
        }
        try {
          const results = await Promise.all(
            workspaceIds.map((workspaceId) =>
              request(
                `/api/collab/task-capture/summary?workspaceId=${encodeURIComponent(workspaceId)}`,
              ),
            ),
          );
          setSummaryCount(
            results.reduce((sum, result) => sum + (result.draftCount ?? 0), 0),
          );
        } catch {
          setSummaryCount(0);
        }
      }, [workspaceIds.join(":")]);

      const loadInbox = react.useCallback(async () => {
        setError("");
        try {
          const results = await Promise.all(
            workspaceIds.map((workspaceId) =>
              request(
                `/api/collab/task-capture/inbox?workspaceId=${encodeURIComponent(workspaceId)}`,
              ),
            ),
          );
          const next = results.flatMap((result) => result.items ?? []);
          setItems(next);
          setSummaryCount(
            next.reduce((sum, item) => sum + (item.draftCount ?? 0), 0),
          );
          return next;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          return [];
        }
      }, [workspaceIds.join(":")]);

      const loadBatch = async (batchId, workspaceId) => {
        setError("");
        try {
          const [result, taskBootstrap] = await Promise.all([
            request(
              `/api/collab/task-capture/batch?workspaceId=${encodeURIComponent(workspaceId)}&batchId=${encodeURIComponent(batchId)}`,
            ),
            request(
              `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`,
            ).catch(() => null),
          ]);
          setSelected({ batchId, workspaceId });
          setDetail(result);
          setDirectory(
            taskBootstrap?.directory ?? {
              humans: [],
              agents: [],
              roles: [],
            },
          );
          setEditDraftId("");
          setLastCommit(null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      react.useEffect(() => {
        void loadSummary();
      }, [loadSummary]);
      react.useEffect(() => {
        const pending = window.__pluginmaxPendingTaskCapture;
        if (pending === null || typeof pending !== "object") return;
        window.__pluginmaxPendingTaskCapture = null;
        setOpen(true);
        void (async () => {
          await loadInbox();
          if (
            typeof pending.workspaceId === "string" &&
            pending.workspaceId !== "" &&
            typeof pending.batchId === "string" &&
            pending.batchId !== ""
          ) {
            await loadBatch(pending.batchId, pending.workspaceId);
          }
        })();
      }, [loadInbox]);
      react.useEffect(() => {
        const refresh = () => {
          void loadSummary();
          if (open) void loadInbox();
        };
        const openEvent = (event) => {
          const workspaceId = event?.detail?.workspaceId;
          const batchId = event?.detail?.batchId;
          setOpen(true);
          void (async () => {
            await loadInbox();
            if (
              typeof workspaceId === "string" &&
              workspaceId !== "" &&
              typeof batchId === "string" &&
              batchId !== ""
            ) {
              await loadBatch(batchId, workspaceId);
            }
          })();
        };
        window.addEventListener("pluginmax:task-capture-refresh", refresh);
        window.addEventListener("pluginmax:task-capture-open", openEvent);
        return () => {
          window.removeEventListener("pluginmax:task-capture-refresh", refresh);
          window.removeEventListener("pluginmax:task-capture-open", openEvent);
        };
      }, [loadSummary, loadInbox, open]);

      const openInbox = async () => {
        setOpen(true);
        setError("");
        setNotice("");
        const next = await loadInbox();
        if (next[0] !== undefined) {
          await loadBatch(next[0].batch.id, next[0].batch.workspaceId);
        }
      };

      const startEdit = (draft) => {
        setEditDraftId(draft.id);
        setForm({
          title: draft.title,
          description: draft.description,
          receiverKey:
            draft.receiverId === undefined ||
            draft.receiverType === "unassigned"
              ? ""
              : `${draft.receiverType}:${draft.receiverId}`,
          collaboratorKeys: draft.collaboratorHints.map(
            (item) => `${item.kind}:${item.id}`,
          ),
          priority: draft.priority,
          due: draft.due ?? "",
          acceptance: draft.acceptance.join("\n"),
        });
      };

      const saveEdit = async (draft) => {
        if (selected === null) return;
        const receiverSeparator = form.receiverKey.indexOf(":");
        const receiverType =
          receiverSeparator < 0
            ? "unassigned"
            : form.receiverKey.slice(0, receiverSeparator);
        const receiverId =
          receiverSeparator < 0
            ? null
            : form.receiverKey.slice(receiverSeparator + 1);
        const receiverOptions = [
          ...directory.humans.map((item) => ({
            ...item,
            type: "human",
          })),
          ...directory.agents.map((item) => ({
            ...item,
            type: "agent",
          })),
          ...directory.roles.map((item) => ({
            ...item,
            type: "role",
          })),
        ];
        const receiverName =
          receiverId === null
            ? null
            : (receiverOptions.find(
                (item) => item.type === receiverType && item.id === receiverId,
              )?.name ?? receiverId);
        const collaboratorHints = form.collaboratorKeys
          .map((key) => {
            const separator = key.indexOf(":");
            const kind = key.slice(0, separator);
            const id = key.slice(separator + 1);
            const item = receiverOptions.find(
              (candidate) => candidate.type === kind && candidate.id === id,
            );
            return item === undefined
              ? undefined
              : {
                  kind,
                  id,
                  name: item.name,
                };
          })
          .filter(Boolean);
        try {
          await request("/api/collab/task-capture/draft/update", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selected.workspaceId,
              draftId: draft.id,
              expectedRevision: draft.revision,
              commandId: commandId("tc-update"),
              patch: {
                title: form.title.trim(),
                description: form.description.trim(),
                receiverType,
                receiverId,
                receiverName,
                collaboratorHints,
                priority: form.priority,
                due: form.due.trim() === "" ? null : form.due.trim(),
                acceptance: form.acceptance
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              },
            }),
          });
          setEditDraftId("");
          setNotice("草稿已更新");
          await loadBatch(selected.batchId, selected.workspaceId);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const ignoreDraft = async (draft) => {
        if (selected === null) return;
        try {
          await request("/api/collab/task-capture/draft/ignore", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selected.workspaceId,
              draftId: draft.id,
              commandId: commandId("tc-ignore"),
            }),
          });
          setNotice("草稿已忽略");
          await loadBatch(selected.batchId, selected.workspaceId);
          await loadInbox();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const dismissBatch = async () => {
        if (selected === null) return;
        try {
          await request("/api/collab/task-capture/batch/dismiss", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selected.workspaceId,
              batchId: selected.batchId,
              commandId: commandId("tc-dismiss"),
            }),
          });
          setNotice("本批草稿已归档");
          setSelected(null);
          setDetail(null);
          await loadInbox();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const commitReady = async () => {
        if (detail === null || selected === null) return;
        const ready = detail.drafts.filter(
          (draft) => draft.status === "active" && draft.readiness === "ready",
        );
        if (ready.length === 0) {
          setError("当前没有满足最小任务契约的草稿。");
          return;
        }
        try {
          const result = await request("/api/collab/task-capture/commit", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selected.workspaceId,
              batchId: selected.batchId,
              draftIds: ready.map((draft) => draft.id),
              commandId: commandId("tc-commit"),
              expectedRevision: detail.batch.revision,
              createMode: "create-only",
            }),
          });
          setNotice(
            `已创建 ${result.summary.created} 条任务，跳过 ${result.summary.failed + result.summary.skipped} 条`,
          );
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-refresh"),
          );
          await loadBatch(selected.batchId, selected.workspaceId);
          setLastCommit(result);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const commitAndDispatch = async () => {
        if (detail === null || selected === null) return;
        const ready = detail.drafts.filter(
          (draft) =>
            draft.status === "active" &&
            draft.readiness === "ready" &&
            draft.receiverType === "agent",
        );
        if (ready.length === 0) {
          setError("当前没有已指派给 AI 伙伴且满足最小契约的草稿。");
          return;
        }
        try {
          const draftIds = ready.map((draft) => draft.id);
          const confirmation = await request(
            "/api/collab/task-capture/commit/confirmation",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selected.workspaceId,
                batchId: selected.batchId,
                draftIds,
                commandId: commandId("tc-confirm-dispatch"),
              }),
            },
          );
          const result = await request("/api/collab/task-capture/commit", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selected.workspaceId,
              batchId: selected.batchId,
              draftIds,
              commandId: commandId("tc-commit-dispatch"),
              expectedRevision: detail.batch.revision,
              createMode: "create-and-dispatch",
              confirmationId: confirmation.confirmationId,
            }),
          });
          setNotice(
            `已创建 ${result.summary.created} 条任务，已派发 ${result.summary.dispatched} 条，派发失败 ${result.summary.dispatchFailed} 条`,
          );
          await loadBatch(selected.batchId, selected.workspaceId);
          setLastCommit(result);
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-capture-refresh"),
          );
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const retryFailed = async () => {
        if (selected === null || detail === null || lastCommit === null) return;
        const failed = lastCommit.items
          .filter((item) => item.status === "failed")
          .map((item) => item.draftId);
        if (failed.length === 0) return;
        try {
          const result = await request(
            "/api/collab/task-capture/conversion/retry",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selected.workspaceId,
                batchId: selected.batchId,
                draftIds: failed,
                commandId: commandId("tc-retry"),
                expectedRevision: detail.batch.revision,
                createMode: "create-only",
              }),
            },
          );
          setNotice(
            `重试完成：成功 ${result.summary.created} 条，失败 ${result.summary.failed} 条`,
          );
          await loadBatch(selected.batchId, selected.workspaceId);
          await loadInbox();
          setLastCommit(result);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const retryDispatch = async () => {
        if (selected === null || detail === null || lastCommit === null) return;
        const failed = lastCommit.items
          .filter((item) => item.dispatchStatus === "failed")
          .map((item) => item.draftId);
        if (failed.length === 0) return;
        try {
          const confirmation = await request(
            "/api/collab/task-capture/commit/confirmation",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selected.workspaceId,
                batchId: selected.batchId,
                draftIds: failed,
                commandId: commandId("tc-confirm-retry-dispatch"),
              }),
            },
          );
          const result = await request("/api/collab/task-capture/commit", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selected.workspaceId,
              batchId: selected.batchId,
              draftIds: failed,
              commandId: commandId("tc-retry-dispatch"),
              expectedRevision: detail.batch.revision,
              createMode: "create-and-dispatch",
              confirmationId: confirmation.confirmationId,
            }),
          });
          setNotice(
            `派发重试完成：成功 ${result.summary.dispatched} 条，失败 ${result.summary.dispatchFailed} 条`,
          );
          await loadBatch(selected.batchId, selected.workspaceId);
          setLastCommit(result);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      return h(
        react.Fragment,
        null,
        h("style", null, styles),
        h(
          "button",
          {
            className: "pmtc-launcher",
            type: "button",
            onClick: () => void openInbox(),
          },
          "草稿箱",
          summaryCount > 0 ? h("strong", null, summaryCount) : null,
        ),
        open
          ? h(
              "div",
              {
                className: "pmtc-inbox",
                role: "dialog",
                "aria-modal": "true",
                "aria-label": "任务草稿箱",
              },
              h(
                "aside",
                { className: "pmtc-inbox-side" },
                h(
                  "div",
                  { className: "pmtc-inbox-head" },
                  h("h2", null, "任务 / 草稿箱"),
                  h(
                    "button",
                    {
                      className: "pmtc-close",
                      type: "button",
                      "aria-label": "关闭草稿箱",
                      onClick: () => setOpen(false),
                    },
                    "×",
                  ),
                ),
                h(
                  "div",
                  { className: "pmtc-inbox-list" },
                  ...(items.length === 0
                    ? [h("div", { className: "pmtc-empty" }, "暂无任务草稿")]
                    : items.map((item) =>
                        h(
                          "button",
                          {
                            type: "button",
                            className: `pmtc-batch${selected?.batchId === item.batch.id ? " is-active" : ""}`,
                            key: item.batch.id,
                            onClick: () =>
                              void loadBatch(
                                item.batch.id,
                                item.batch.workspaceId,
                              ),
                          },
                          h("strong", null, item.batch.source.sourceTitle),
                          h(
                            "span",
                            null,
                            `${item.draftCount} 条 · 可创建 ${item.readyCount} · 待完善 ${item.needsInfoCount}`,
                          ),
                        ),
                      )),
                ),
              ),
              h(
                "main",
                { className: "pmtc-inbox-main" },
                error === ""
                  ? null
                  : h("div", { className: "pmtc-error" }, error),
                notice === ""
                  ? null
                  : h("div", { className: "pmtc-note" }, notice),
                lastCommit !== null && lastCommit.summary.failed > 0
                  ? h(
                      "button",
                      {
                        className: "pmtc-btn primary",
                        type: "button",
                        onClick: () => void retryFailed(),
                      },
                      `重试 ${lastCommit.summary.failed} 条失败项`,
                    )
                  : null,
                lastCommit !== null && lastCommit.summary.dispatchFailed > 0
                  ? h(
                      "button",
                      {
                        className: "pmtc-btn",
                        type: "button",
                        onClick: () => void retryDispatch(),
                      },
                      `重试 ${lastCommit.summary.dispatchFailed} 条派发失败`,
                    )
                  : null,
                detail === null
                  ? h("div", { className: "pmtc-empty" }, "选择一组任务草稿")
                  : h(
                      "section",
                      { className: "pmtc-panel" },
                      h(
                        "div",
                        { className: "pmtc-panel-head" },
                        h(
                          "div",
                          { style: { flex: 1, minWidth: 0 } },
                          h("h3", null, detail.batch.source.sourceTitle),
                          h(
                            "div",
                            { className: "pmtc-subtitle" },
                            `${detail.drafts.length} 条草稿 · 来源快照已保留`,
                          ),
                        ),
                        h(
                          "button",
                          {
                            className: "pmtc-btn primary",
                            type: "button",
                            disabled: !detail.canEdit,
                            onClick: () => void commitReady(),
                          },
                          "确认创建可创建项",
                        ),
                        h(
                          "button",
                          {
                            className: "pmtc-btn",
                            type: "button",
                            disabled:
                              !detail.canEdit ||
                              !detail.drafts.some(
                                (draft) =>
                                  draft.status === "active" &&
                                  draft.readiness === "ready" &&
                                  draft.receiverType === "agent",
                              ),
                            onClick: () => void commitAndDispatch(),
                          },
                          "创建并派发",
                        ),
                        h(
                          "button",
                          {
                            className: "pmtc-btn",
                            type: "button",
                            disabled: !detail.canEdit,
                            onClick: () => void dismissBatch(),
                          },
                          "归档整批",
                        ),
                      ),
                      h(
                        "div",
                        { className: "pmtc-panel-body" },
                        ...detail.drafts.map((draft) =>
                          h(
                            "article",
                            { className: "pmtc-draft", key: draft.id },
                            h(
                              "div",
                              { className: "pmtc-draft-head" },
                              h("h4", null, draft.title),
                              h(
                                "span",
                                {
                                  className: `pmtc-chip${draft.readiness === "ready" ? "" : " needs"}`,
                                },
                                draft.status === "converted"
                                  ? "已创建"
                                  : draft.readiness === "ready"
                                    ? "可创建"
                                    : "待完善",
                              ),
                            ),
                            h(
                              "p",
                              null,
                              draft.description || "尚未填写任务描述",
                            ),
                            h(
                              "div",
                              { className: "pmtc-fields" },
                              fieldNode(
                                "负责人：",
                                draft.receiverName,
                                draft.receiverId === undefined,
                              ),
                              fieldNode(
                                "截止：",
                                draft.due,
                                draft.due === undefined,
                              ),
                              fieldNode(
                                "验收：",
                                draft.acceptance.length > 0
                                  ? `${draft.acceptance.length} 条`
                                  : undefined,
                                draft.acceptance.length === 0,
                              ),
                              draft.duplicate
                                ? h(
                                    "span",
                                    { className: "pmtc-field missing" },
                                    draft.duplicate.message,
                                  )
                                : null,
                            ),
                            editDraftId === draft.id
                              ? h(
                                  "div",
                                  { className: "pmtc-form" },
                                  h("input", {
                                    className: "pmtc-input",
                                    value: form.title,
                                    placeholder: "任务标题",
                                    onChange: (event) =>
                                      setForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                      })),
                                  }),
                                  h("textarea", {
                                    className: "pmtc-textarea",
                                    value: form.description,
                                    placeholder: "任务描述",
                                    onChange: (event) =>
                                      setForm((current) => ({
                                        ...current,
                                        description: event.target.value,
                                      })),
                                  }),
                                  h(
                                    "div",
                                    {
                                      style: {
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 8,
                                      },
                                    },
                                    h(
                                      "select",
                                      {
                                        className: "pmtc-select",
                                        value: form.priority,
                                        onChange: (event) =>
                                          setForm((current) => ({
                                            ...current,
                                            priority: event.target.value,
                                          })),
                                      },
                                      h(
                                        "option",
                                        { value: "P1" },
                                        "P0（最高）",
                                      ),
                                      h("option", { value: "P2" }, "P1"),
                                      h("option", { value: "P3" }, "P2"),
                                    ),
                                    h("input", {
                                      className: "pmtc-input",
                                      value: form.due,
                                      placeholder: "截止日期",
                                      onChange: (event) =>
                                        setForm((current) => ({
                                          ...current,
                                          due: event.target.value,
                                        })),
                                    }),
                                  ),
                                  h(
                                    "select",
                                    {
                                      className: "pmtc-select",
                                      style: { gridColumn: "1 / -1" },
                                      value: form.receiverKey,
                                      "aria-label": "选择任务负责人",
                                      onChange: (event) =>
                                        setForm((current) => ({
                                          ...current,
                                          receiverKey: event.target.value,
                                        })),
                                    },
                                    h("option", { value: "" }, "未指派"),
                                    ...directory.humans.map((item) =>
                                      h(
                                        "option",
                                        {
                                          key: `human:${item.id}`,
                                          value: `human:${item.id}`,
                                        },
                                        `人 · ${item.name}`,
                                      ),
                                    ),
                                    ...directory.agents.map((item) =>
                                      h(
                                        "option",
                                        {
                                          key: `agent:${item.id}`,
                                          value: `agent:${item.id}`,
                                        },
                                        `AI · ${item.name}`,
                                      ),
                                    ),
                                    ...directory.roles.map((item) =>
                                      h(
                                        "option",
                                        {
                                          key: `role:${item.id}`,
                                          value: `role:${item.id}`,
                                        },
                                        `角色 · ${item.name}`,
                                      ),
                                    ),
                                  ),
                                  h(
                                    "select",
                                    {
                                      className: "pmtc-select",
                                      style: {
                                        gridColumn: "1 / -1",
                                        minHeight: 72,
                                      },
                                      multiple: true,
                                      value: form.collaboratorKeys,
                                      "aria-label": "选择任务协作方",
                                      onChange: (event) =>
                                        setForm((current) => ({
                                          ...current,
                                          collaboratorKeys: Array.from(
                                            event.target.selectedOptions,
                                            (option) => option.value,
                                          ),
                                        })),
                                    },
                                    ...directory.humans.map((item) =>
                                      h(
                                        "option",
                                        {
                                          key: `human:${item.id}`,
                                          value: `human:${item.id}`,
                                        },
                                        `人 · ${item.name}`,
                                      ),
                                    ),
                                    ...directory.agents.map((item) =>
                                      h(
                                        "option",
                                        {
                                          key: `agent:${item.id}`,
                                          value: `agent:${item.id}`,
                                        },
                                        `AI · ${item.name}`,
                                      ),
                                    ),
                                    ...directory.roles.map((item) =>
                                      h(
                                        "option",
                                        {
                                          key: `role:${item.id}`,
                                          value: `role:${item.id}`,
                                        },
                                        `角色 · ${item.name}`,
                                      ),
                                    ),
                                  ),
                                  h("textarea", {
                                    className: "pmtc-textarea",
                                    value: form.acceptance,
                                    placeholder: "每行一条验收标准",
                                    onChange: (event) =>
                                      setForm((current) => ({
                                        ...current,
                                        acceptance: event.target.value,
                                      })),
                                  }),
                                  h(
                                    "div",
                                    { className: "pmtc-inline-actions" },
                                    h(
                                      "button",
                                      {
                                        className: "pmtc-btn primary",
                                        type: "button",
                                        onClick: () => void saveEdit(draft),
                                      },
                                      "保存草稿",
                                    ),
                                    h(
                                      "button",
                                      {
                                        className: "pmtc-btn",
                                        type: "button",
                                        onClick: () => setEditDraftId(""),
                                      },
                                      "取消",
                                    ),
                                  ),
                                )
                              : h(
                                  "div",
                                  { className: "pmtc-draft-actions" },
                                  draft.status === "active"
                                    ? h(
                                        "button",
                                        {
                                          className: "pmtc-btn",
                                          type: "button",
                                          disabled: !detail.canEdit,
                                          onClick: () => startEdit(draft),
                                        },
                                        "编辑草稿",
                                      )
                                    : null,
                                  draft.status === "active"
                                    ? h(
                                        "button",
                                        {
                                          className: "pmtc-btn",
                                          type: "button",
                                          disabled: !detail.canEdit,
                                          onClick: () =>
                                            void ignoreDraft(draft),
                                        },
                                        "忽略草稿",
                                      )
                                    : null,
                                ),
                          ),
                        ),
                      ),
                    ),
              ),
            )
          : null,
      );
    }

    const DRAFT_PRIORITY_LABEL = { P1: "P0", P2: "P1", P3: "P2" };
    const DEFAULT_ACCEPTANCE_TEXT = "按任务描述完成，并同步交付结果";
    const UNASSIGNED_PROJECT = "__unassigned__";

    function draftProjectId(entry) {
      return entry.draft.projectId ?? entry.batch.projectId ?? "";
    }

    function draftProjectKey(entry) {
      return draftProjectId(entry) || UNASSIGNED_PROJECT;
    }

    function projectTitle(projectId, projects) {
      if (projectId === "" || projectId === UNASSIGNED_PROJECT) {
        return "未归属项目";
      }
      return (
        projects.find((project) => project.id === projectId)?.title ?? projectId
      );
    }

    function draftStatus(entry) {
      const draft = entry.draft;
      if (draft.status === "converted") {
        return { key: "done", label: "已创建" };
      }
      if (draft.status === "linked") {
        return { key: "done", label: "已关联" };
      }
      if (draft.status === "ignored") {
        return { key: "needs", label: "已忽略" };
      }
      if (draft.status === "conversion-failed") {
        return { key: "needs", label: "待完善" };
      }
      if (
        draft.status === "active" &&
        draft.readiness === "ready" &&
        draft.duplicate === undefined
      ) {
        return { key: "ready", label: "待创建" };
      }
      return { key: "needs", label: "待完善" };
    }

    function selectableReady(entry) {
      return (
        entry.canEdit &&
        entry.draft.status === "active" &&
        entry.draft.readiness === "ready" &&
        entry.draft.duplicate === undefined
      );
    }

    function receiverKey(draft) {
      return draft.receiverType === "unassigned" ||
        draft.receiverId === undefined
        ? ""
        : `${draft.receiverType}:${draft.receiverId}`;
    }

    function formatDraftTime(value) {
      if (value === undefined || value === "") return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString([], {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    function directoryOptions(directory) {
      return [
        ...(directory?.humans ?? []).map((item) => ({
          ...item,
          key: `human:${item.id}`,
          kind: "human",
          group: "人员",
        })),
        ...(directory?.agents ?? []).map((item) => ({
          ...item,
          key: `agent:${item.id}`,
          kind: "agent",
          group: "AI伙伴",
        })),
        ...(directory?.roles ?? []).map((item) => ({
          ...item,
          key: `role:${item.id}`,
          kind: "role",
          group: "角色",
        })),
      ];
    }

    function receiverDisplayForDraft(draft, options) {
      if (
        draft.receiverType === "unassigned" ||
        draft.receiverId === undefined
      ) {
        return { label: "待完善", missing: true, unavailable: false };
      }
      const option = options.find(
        (item) =>
          item.kind === draft.receiverType && item.id === draft.receiverId,
      );
      if (option === undefined) {
        return {
          label: draft.receiverName ?? "负责人不可用",
          missing: false,
          unavailable: true,
        };
      }
      return { label: option.name, missing: false, unavailable: false };
    }

    function defaultFilledForDraft(draft) {
      return (
        draft.priority === "P2" ||
        (draft.acceptance.length === 1 &&
          draft.acceptance[0] === DEFAULT_ACCEPTANCE_TEXT)
      );
    }

    function TagMultiSelect(props) {
      const [open, setOpen] = react.useState(false);
      const options = props.options ?? [];
      const value = props.value ?? [];
      const selected = options.filter((option) => value.includes(option.key));
      const labels = new Map(
        options.map((option) => [option.key, option.label]),
      );
      const toggle = (key) => {
        props.onChange(
          value.includes(key)
            ? value.filter((item) => item !== key)
            : [...value, key],
        );
      };
      return h(
        "div",
        { className: "pmtd-tag-select" },
        h(
          "button",
          {
            type: "button",
            className: "pmtd-tag-trigger",
            "aria-expanded": open,
            "aria-haspopup": "listbox",
            onClick: () => setOpen((current) => !current),
            onBlur: (event) => {
              if (
                !event.currentTarget.parentElement?.contains(
                  event.relatedTarget,
                )
              ) {
                setOpen(false);
              }
            },
          },
          h(
            "span",
            null,
            selected.length === 0
              ? (props.placeholder ?? "未选择")
              : `已选 ${selected.length} 项`,
          ),
          captureIcon("chevronDown", 12),
        ),
        selected.length === 0
          ? null
          : h(
              "div",
              { className: "pmtd-tags" },
              ...selected.map((option) =>
                h(
                  "span",
                  { className: "pmtd-tag", key: option.key },
                  h("span", null, option.label),
                  h(
                    "button",
                    {
                      type: "button",
                      "aria-label": `移除${option.label}`,
                      onClick: () =>
                        props.onChange(
                          value.filter((item) => item !== option.key),
                        ),
                    },
                    "×",
                  ),
                ),
              ),
            ),
        open
          ? h(
              "div",
              {
                className: "pmtd-tag-menu",
                role: "listbox",
                "aria-multiselectable": "true",
              },
              options.length === 0
                ? h(
                    "div",
                    { className: "pmtd-tag-empty" },
                    props.emptyText ?? "暂无可选项",
                  )
                : h(
                    react.Fragment,
                    null,
                    ...options.map((option) =>
                      h(
                        "button",
                        {
                          type: "button",
                          role: "option",
                          "aria-selected": value.includes(option.key),
                          className: "pmtd-tag-option",
                          key: option.key,
                          onClick: () => toggle(option.key),
                        },
                        h("input", {
                          type: "checkbox",
                          checked: value.includes(option.key),
                          readOnly: true,
                          tabIndex: -1,
                        }),
                        h("span", null, option.label),
                      ),
                    ),
                  ),
            )
          : null,
        value
          .filter((key) => !labels.has(key))
          .map((key) =>
            h(
              "span",
              { className: "pmtd-tag", key },
              h("span", null, key),
              h(
                "button",
                {
                  type: "button",
                  "aria-label": `移除${key}`,
                  onClick: () =>
                    props.onChange(value.filter((item) => item !== key)),
                },
                "×",
              ),
            ),
          ),
      );
    }

    function InlineDraftTitle({ entry, disabled, onSave }) {
      const [value, setValue] = react.useState(entry.draft.title);
      const [saving, setSaving] = react.useState(false);
      react.useEffect(() => {
        setValue(entry.draft.title);
      }, [entry.draft.title, entry.draft.revision]);
      const save = async () => {
        const next = value.trim();
        if (next === "" || next === entry.draft.title || saving) {
          setValue(entry.draft.title);
          return;
        }
        setSaving(true);
        try {
          await onSave(next);
        } catch {
          // The page-level error keeps the edited title available for retry.
        } finally {
          setSaving(false);
        }
      };
      return h("input", {
        className: "pmtd-title-input",
        value,
        disabled: disabled || saving,
        "aria-label": "直接编辑草稿标题",
        onChange: (event) => setValue(event.target.value),
        onBlur: () => void save(),
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setValue(entry.draft.title);
            event.currentTarget.blur();
          }
        },
      });
    }

    function DraftEditorDrawer(props) {
      const { entry, projects, directory, tasksByWorkspace } = props;
      const isNew = entry === null;
      const initialProject =
        entry === null
          ? (props.initialProjectId ?? projects[0]?.id ?? "")
          : (entry.draft.projectId ?? entry.draft.workspaceId ?? "");
      const [form, setForm] = react.useState({
        title: entry?.draft.title ?? "",
        projectId: initialProject,
        receiverKey: entry === null ? "" : receiverKey(entry.draft),
        priority: entry?.draft.priority ?? "P2",
        due: entry?.draft.due ?? "",
        description: entry?.draft.description ?? "",
        acceptance: (entry?.draft.acceptance ?? []).join("\n"),
        collaboratorKeys: (entry?.draft.collaboratorHints ?? []).map(
          (item) => `${item.kind}:${item.id}`,
        ),
        dependsOn: entry?.draft.dependsOn ?? [],
      });
      const [saving, setSaving] = react.useState(false);
      const [error, setError] = react.useState("");
      const options = directoryOptions(directory);
      const workspaceId = entry?.batch.workspaceId ?? initialProject;
      const taskOptions = (tasksByWorkspace[workspaceId] ?? []).map((task) => ({
        key: task.id,
        label: `${task.id} · ${task.title}`,
      }));
      const projectOptions =
        form.projectId !== "" &&
        !projects.some((project) => project.id === form.projectId)
          ? [
              ...projects,
              {
                id: form.projectId,
                title: form.projectId,
              },
            ]
          : projects;
      const update = (patch) =>
        setForm((current) => ({ ...current, ...patch }));
      const receiverPatch = () => {
        const separator = form.receiverKey.indexOf(":");
        if (separator < 0) {
          return {
            receiverType: "unassigned",
            receiverId: null,
            receiverName: null,
          };
        }
        const receiverType = form.receiverKey.slice(0, separator);
        const receiverId = form.receiverKey.slice(separator + 1);
        const option = options.find(
          (item) => item.kind === receiverType && item.id === receiverId,
        );
        return {
          receiverType,
          receiverId,
          receiverName: option?.name ?? receiverId,
        };
      };
      const collaboratorHints = () => {
        const existing = new Map(
          (entry?.draft.collaboratorHints ?? []).map((item) => [
            `${item.kind}:${item.id}`,
            item,
          ]),
        );
        return form.collaboratorKeys
          .map((key) => {
            const separator = key.indexOf(":");
            const kind = key.slice(0, separator);
            const id = key.slice(separator + 1);
            const option = options.find(
              (item) => item.kind === kind && item.id === id,
            );
            if (option !== undefined) return { kind, id, name: option.name };
            return existing.get(key);
          })
          .filter(Boolean);
      };
      const save = async () => {
        if (form.title.trim() === "") {
          setError("标题不能为空");
          return;
        }
        if (form.description.trim() === "") {
          setError("描述不能为空");
          return;
        }
        const acceptance = form.acceptance
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
        if (acceptance.length === 0) {
          setError("至少需要一条验收标准");
          return;
        }
        setSaving(true);
        setError("");
        try {
          if (isNew) {
            const result = await request("/api/collab/task-capture/manual", {
              method: "POST",
              body: JSON.stringify({
                workspaceId: form.projectId || initialProject,
                title: form.title.trim(),
                description: form.description.trim(),
                ...(form.projectId === "" ? {} : { projectId: form.projectId }),
                ...receiverPatch(),
                priority: form.priority,
                ...(form.due.trim() === "" ? {} : { due: form.due.trim() }),
                acceptance,
                collaboratorHints: collaboratorHints(),
                dependsOn: form.dependsOn,
                commandId: commandId("tc-manual"),
              }),
            });
            props.onSaved?.(result.drafts?.[0]);
          } else {
            const response = await request(
              "/api/collab/task-capture/draft/update",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId: entry.draft.workspaceId,
                  draftId: entry.draft.id,
                  expectedRevision: entry.draft.revision,
                  commandId: commandId("tc-update"),
                  patch: {
                    title: form.title.trim(),
                    description: form.description.trim(),
                    projectId: form.projectId || null,
                    ...receiverPatch(),
                    priority: form.priority,
                    due: form.due.trim() === "" ? null : form.due.trim(),
                    acceptance,
                    collaboratorHints: collaboratorHints(),
                    dependsOn: form.dependsOn,
                  },
                }),
              },
            );
            props.onSaved?.(response.draft ?? response);
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setSaving(false);
        }
      };
      return h(
        "div",
        {
          className: "pmtd-drawer-mask",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget && !saving) {
              props.onClose?.();
            }
          },
        },
        h(
          "aside",
          {
            className: "pmtd-drawer",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": isNew ? "新建任务草稿" : "编辑任务草稿",
          },
          h(
            "header",
            { className: "pmtd-drawer-head" },
            h(
              "div",
              { className: "pmtd-drawer-head-copy" },
              h("h2", null, isNew ? "新建任务草稿" : "编辑任务草稿"),
              h(
                "p",
                null,
                isNew ? "保存后进入当前项目草稿箱" : `草稿 ${entry.draft.id}`,
              ),
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmtd-drawer-close",
                "aria-label": "关闭草稿编辑",
                disabled: saving,
                onClick: props.onClose,
              },
              captureIcon("x", 14),
            ),
          ),
          h(
            "div",
            { className: "pmtd-drawer-body" },
            error === ""
              ? null
              : h("p", { className: "pmtd-drawer-error" }, error),
            h(
              "label",
              { className: "pmtd-field full" },
              "标题",
              h("input", {
                className: "pmtd-input",
                value: form.title,
                autoFocus: isNew,
                onChange: (event) => update({ title: event.target.value }),
              }),
            ),
            h(
              "div",
              { className: "pmtd-form-grid" },
              h(
                "label",
                { className: "pmtd-field" },
                "项目",
                h(
                  "select",
                  {
                    className: "pmtd-select",
                    value: form.projectId,
                    onChange: (event) =>
                      update({ projectId: event.target.value }),
                  },
                  h("option", { value: "" }, "未归属项目"),
                  ...projectOptions.map((project) =>
                    h(
                      "option",
                      { key: project.id, value: project.id },
                      project.title ?? project.id,
                    ),
                  ),
                ),
              ),
              h(
                "label",
                { className: "pmtd-field" },
                "负责人",
                h(
                  "select",
                  {
                    className: "pmtd-select",
                    value: form.receiverKey,
                    onChange: (event) =>
                      update({ receiverKey: event.target.value }),
                  },
                  h("option", { value: "" }, "待指派"),
                  ...["人员", "AI伙伴", "角色"].map((group) => {
                    const items = options.filter(
                      (item) => item.group === group,
                    );
                    return items.length === 0
                      ? null
                      : h(
                          "optgroup",
                          { label: group, key: group },
                          ...items.map((item) =>
                            h(
                              "option",
                              { key: item.key, value: item.key },
                              item.name,
                            ),
                          ),
                        );
                  }),
                  !isNew &&
                    form.receiverKey !== "" &&
                    !options.some((item) => item.key === form.receiverKey)
                    ? h(
                        "option",
                        { value: form.receiverKey },
                        `${entry.draft.receiverName ?? form.receiverKey}（负责人不可用）`,
                      )
                    : null,
                ),
              ),
              h(
                "label",
                { className: "pmtd-field" },
                "优先级",
                h(
                  "select",
                  {
                    className: "pmtd-select",
                    value: form.priority,
                    onChange: (event) =>
                      update({ priority: event.target.value }),
                  },
                  h("option", { value: "P1" }, "P0"),
                  h("option", { value: "P2" }, "P1"),
                  h("option", { value: "P3" }, "P2"),
                ),
              ),
              h(
                "label",
                { className: "pmtd-field" },
                "截止日期",
                h("input", {
                  className: "pmtd-input",
                  type: "date",
                  value: form.due,
                  onChange: (event) => update({ due: event.target.value }),
                }),
              ),
            ),
            h(
              "div",
              { className: "pmtd-field full" },
              "协作方",
              h(TagMultiSelect, {
                value: form.collaboratorKeys,
                options: options.map((item) => ({
                  key: item.key,
                  label: `${item.group} · ${item.name}`,
                })),
                onChange: (value) => update({ collaboratorKeys: value }),
                placeholder: "选择协作方",
                emptyText: "暂无可选协作方",
              }),
            ),
            h(
              "div",
              { className: "pmtd-field full" },
              "前置任务",
              h(TagMultiSelect, {
                value: form.dependsOn,
                options: taskOptions,
                onChange: (value) => update({ dependsOn: value }),
                placeholder: "选择当前项目中的任务",
                emptyText: "当前项目暂无可选任务",
              }),
            ),
            h(
              "label",
              { className: "pmtd-field full" },
              "描述",
              h("textarea", {
                className: "pmtd-textarea",
                rows: 5,
                value: form.description,
                onChange: (event) =>
                  update({ description: event.target.value }),
              }),
            ),
            h(
              "label",
              { className: "pmtd-field full" },
              "验收标准（每行一条）",
              h("textarea", {
                className: "pmtd-textarea",
                rows: 4,
                value: form.acceptance,
                onChange: (event) => update({ acceptance: event.target.value }),
              }),
            ),
            h(
              "div",
              { className: "pmtd-readonly-group" },
              h(
                "div",
                { className: "pmtd-field" },
                "工作区",
                h(
                  "div",
                  { className: "pmtd-readonly" },
                  isNew
                    ? projectTitle(form.projectId, projects) || "未归属"
                    : (projects.find(
                        (project) => project.id === entry.batch.workspaceId,
                      )?.title ?? entry.batch.workspaceId),
                ),
              ),
              h(
                "div",
                { className: "pmtd-field" },
                "草稿状态",
                h(
                  "div",
                  { className: "pmtd-readonly" },
                  isNew ? "待创建" : draftStatus(entry).label,
                ),
              ),
              h(
                "div",
                { className: "pmtd-field", style: { gridColumn: "1 / -1" } },
                "来源",
                h(
                  "div",
                  { className: "pmtd-readonly" },
                  isNew
                    ? "手工新建"
                    : `${entry.batch.source.sourceTitle} · ${entry.batch.source.sourceType}`,
                ),
              ),
            ),
            h(
              "div",
              { className: "pmtd-form-note" },
              captureIcon("inbox", 12),
              "保存草稿只更新 Draft，不会创建任务、派发 Agent 或产生 Run。",
            ),
          ),
          h(
            "footer",
            { className: "pmtd-drawer-foot" },
            h(
              "button",
              {
                type: "button",
                className: "pmtd-btn",
                disabled: saving,
                onClick: props.onClose,
              },
              "取消",
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmtd-btn primary",
                disabled: saving,
                onClick: () => void save(),
              },
              saving ? "保存中…" : "保存草稿",
            ),
          ),
        ),
      );
    }

    function buildDraftExecutionPolicy(form) {
      const allowPublicWeb = form.allowPublicWeb === true;
      return {
        schemaVersion: 1,
        runtime: {
          selection: "recommended",
          allowedRuntimeIds: [],
          requiredCapabilities: allowPublicWeb
            ? [{ key: "search", necessity: "required" }]
            : [],
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
          requireToolEvents: form.requireToolEvents === true,
          requireCitations: allowPublicWeb,
          requireStructuredSubagents: false,
        },
        humanGates: [],
        budget: {},
      };
    }

    function CreateTasksDrawer(props) {
      const [advancedOpen, setAdvancedOpen] = react.useState(false);
      const [form, setForm] = react.useState({
        autoSubmitReview: true,
        requireToolApproval: true,
        allowPublicWeb: false,
        requireToolEvents: false,
      });
      const [busy, setBusy] = react.useState(false);
      const [error, setError] = react.useState("");
      const [result, setResult] = react.useState(null);
      const options = directoryOptions(props.directory);
      const hasAgent = props.entries.some(
        (entry) => entry.draft.receiverType === "agent",
      );
      const runtimeGaps = [];
      for (const entry of props.entries) {
        if (entry.draft.receiverType !== "agent") continue;
        const agent = options.find(
          (item) => item.kind === "agent" && item.id === entry.draft.receiverId,
        );
        if (agent === undefined) {
          runtimeGaps.push(`「${entry.draft.title}」的负责人不可用`);
          continue;
        }
        if (agent.execution !== "external") continue;
        const runtime = (props.externalRuntimes ?? []).find(
          (item) => item.id === agent.externalRuntimeId,
        );
        if (runtime === undefined || runtime.status !== "active") {
          runtimeGaps.push(`「${entry.draft.title}」绑定的 Runtime 不可用`);
          continue;
        }
        if (
          form.allowPublicWeb &&
          Array.isArray(runtime.supportedTools) &&
          !runtime.supportedTools.includes("web_search")
        ) {
          runtimeGaps.push(
            `「${entry.draft.title}」的 Runtime 不支持公开网页检索`,
          );
        }
      }
      const create = async (activeEntries = props.entries) => {
        if (activeEntries.length === 0 || busy || runtimeGaps.length > 0)
          return;
        setBusy(true);
        setError("");
        try {
          const fresh = await props.refreshEntries();
          const freshById = new Map(
            fresh.map((entry) => [entry.draft.id, entry]),
          );
          const checked = [];
          for (const original of activeEntries) {
            const current = freshById.get(original.draft.id);
            if (
              current === undefined ||
              !current.canEdit ||
              current.draft.status !== "active" ||
              current.draft.readiness !== "ready"
            ) {
              throw new Error(
                `「${original.draft.title}」已变化或当前不可创建，请刷新后重试`,
              );
            }
            if (
              current.draft.duplicate !== undefined &&
              !props.allowDuplicateIds.includes(current.draft.id)
            ) {
              throw new Error(
                `「${current.draft.title}」仍存在重复风险，请先确认处理方式`,
              );
            }
            if (
              current.draft.receiverType !== "unassigned" &&
              current.draft.receiverId !== undefined &&
              !options.some(
                (item) =>
                  item.kind === current.draft.receiverType &&
                  item.id === current.draft.receiverId,
              )
            ) {
              throw new Error(
                `「${current.draft.title}」的负责人当前不可用，请改派后重试`,
              );
            }
            checked.push(current);
          }
          const groups = new Map();
          for (const entry of checked) {
            const group = groups.get(entry.batch.id) ?? {
              batch: entry.batch,
              entries: [],
            };
            group.entries.push(entry);
            groups.set(entry.batch.id, group);
          }
          const executionPolicy = buildDraftExecutionPolicy(form);
          const itemResults = [];
          const summaries = [];
          for (const group of groups.values()) {
            const response = await request("/api/collab/task-capture/commit", {
              method: "POST",
              body: JSON.stringify({
                workspaceId: group.batch.workspaceId,
                batchId: group.batch.id,
                draftIds: group.entries.map((entry) => entry.draft.id),
                commandId: commandId("tc-batch-create"),
                expectedRevision: group.batch.revision,
                createMode: "create-only",
                allowDuplicateDraftIds: group.entries
                  .map((entry) => entry.draft.id)
                  .filter((id) => props.allowDuplicateIds.includes(id)),
                executionPolicy,
                autoSubmitReview: hasAgent && form.autoSubmitReview,
              }),
            });
            summaries.push(response.summary);
            itemResults.push(
              ...response.items.map((item) => ({
                ...item,
                workspaceId: group.batch.workspaceId,
                title:
                  group.entries.find((entry) => entry.draft.id === item.draftId)
                    ?.draft.title ?? item.draftId,
              })),
            );
          }
          const combined = {
            items: itemResults,
            summary: summaries.reduce(
              (total, summary) => ({
                created: total.created + summary.created,
                deduplicated: total.deduplicated + summary.deduplicated,
                failed: total.failed + summary.failed,
                skipped: total.skipped + summary.skipped,
              }),
              { created: 0, deduplicated: 0, failed: 0, skipped: 0 },
            ),
          };
          setResult(combined);
          props.onCreated?.(combined);
          const failures = itemResults.filter(
            (item) => item.status === "failed" || item.status === "skipped",
          );
          if (failures.length === 0) {
            props.onClose?.();
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setBusy(false);
        }
      };
      const failedEntries = [];
      if (result !== null) {
        for (const item of result.items) {
          if (item.status !== "failed" && item.status !== "skipped") continue;
          const entry = props.entries.find(
            (candidate) => candidate.draft.id === item.draftId,
          );
          if (entry !== undefined) failedEntries.push(entry);
        }
      }
      return h(
        "div",
        {
          className: "pmtd-drawer-mask",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget && !busy) {
              props.onClose?.();
            }
          },
        },
        h(
          "aside",
          {
            className: "pmtd-drawer",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "批量创建任务",
          },
          h(
            "header",
            { className: "pmtd-drawer-head" },
            h(
              "div",
              { className: "pmtd-drawer-head-copy" },
              h("h2", null, `创建 ${props.entries.length} 条任务`),
              h("p", null, "确认后创建正式任务，不自动派发 Agent"),
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmtd-drawer-close",
                "aria-label": "关闭创建任务",
                disabled: busy,
                onClick: props.onClose,
              },
              captureIcon("x", 14),
            ),
          ),
          h(
            "div",
            { className: "pmtd-drawer-body" },
            error === ""
              ? null
              : h("p", { className: "pmtd-drawer-error" }, error),
            h(
              "div",
              { className: "pmtd-create-list" },
              ...props.entries.map((entry) =>
                h(
                  "div",
                  { className: "pmtd-create-item", key: entry.draft.id },
                  h(
                    "div",
                    null,
                    h("strong", null, entry.draft.title),
                    h(
                      "span",
                      null,
                      projectTitle(draftProjectId(entry), props.projects),
                    ),
                  ),
                  h("code", null, entry.draft.id),
                ),
              ),
            ),
            h(
              "div",
              { className: "pmtd-readonly-group" },
              h(
                "div",
                { className: "pmtd-field" },
                "初始状态",
                h("div", { className: "pmtd-readonly" }, "待处理"),
              ),
              h(
                "div",
                { className: "pmtd-field" },
                "创建方式",
                h("div", { className: "pmtd-readonly" }, "只创建，不派发"),
              ),
            ),
            h(
              "details",
              {
                className: "pmtd-advanced",
                "aria-label": "执行策略高级设置",
                open: advancedOpen,
                onToggle: (event) => setAdvancedOpen(event.currentTarget.open),
              },
              h("summary", null, "高级执行设置"),
              h(
                "div",
                { className: "pmtd-advanced-body" },
                h(
                  "label",
                  {
                    className: `pmtd-check${hasAgent ? "" : " is-disabled"}`,
                  },
                  h("input", {
                    type: "checkbox",
                    checked: form.autoSubmitReview,
                    disabled: !hasAgent,
                    onChange: (event) =>
                      setForm((current) => ({
                        ...current,
                        autoSubmitReview: event.target.checked,
                      })),
                  }),
                  h(
                    "span",
                    null,
                    "Agent 完成后自动提交 Review",
                    hasAgent
                      ? null
                      : h("span", null, "（仅 AI伙伴负责人生效）"),
                  ),
                ),
                h(
                  "label",
                  { className: "pmtd-check" },
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
                  { className: "pmtd-check" },
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
                  { className: "pmtd-check" },
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
            runtimeGaps.length === 0
              ? null
              : h(
                  "p",
                  { className: "pmtd-drawer-error" },
                  runtimeGaps.join("；"),
                ),
            result === null
              ? null
              : h(
                  "div",
                  { className: "pmtd-result" },
                  h("strong", null, "创建结果"),
                  h(
                    "span",
                    null,
                    `已创建 ${result.summary.created} 条，去重 ${result.summary.deduplicated} 条，失败 ${result.summary.failed} 条，跳过 ${result.summary.skipped} 条`,
                  ),
                  ...result.items
                    .filter((item) => item.errorMessage !== undefined)
                    .map((item) =>
                      h(
                        "span",
                        { key: item.draftId },
                        `${item.title}：${item.errorMessage}`,
                      ),
                    ),
                ),
          ),
          h(
            "footer",
            { className: "pmtd-drawer-foot" },
            h(
              "button",
              {
                type: "button",
                className: "pmtd-btn",
                disabled: busy,
                onClick: props.onClose,
              },
              result === null ? "取消" : "关闭",
            ),
            failedEntries.length > 0
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pmtd-btn",
                    disabled: busy || runtimeGaps.length > 0,
                    onClick: () => void create(failedEntries),
                  },
                  busy ? "重试中…" : `重试失败 ${failedEntries.length} 条`,
                )
              : null,
            result === null || failedEntries.length > 0
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pmtd-btn primary",
                    disabled:
                      busy ||
                      runtimeGaps.length > 0 ||
                      props.entries.length === 0,
                    onClick: () => void create(),
                  },
                  busy ? "创建中…" : `创建 ${props.entries.length} 条任务`,
                )
              : null,
          ),
        ),
      );
    }

    function TaskCaptureInboxLauncher(props) {
      const workspaceIds = (props.workspaceIds ?? []).filter(Boolean);
      const [count, setCount] = react.useState(0);
      const load = react.useCallback(async () => {
        if (workspaceIds.length === 0) {
          setCount(0);
          return;
        }
        try {
          const results = await Promise.all(
            workspaceIds.map((workspaceId) =>
              request(
                `/api/collab/task-capture/summary?workspaceId=${encodeURIComponent(workspaceId)}`,
              ),
            ),
          );
          setCount(
            results.reduce((sum, item) => sum + (item.draftCount ?? 0), 0),
          );
        } catch {
          setCount(0);
        }
      }, [workspaceIds.join(":")]);
      react.useEffect(() => {
        void load();
      }, [load]);
      react.useEffect(() => {
        window.addEventListener("pluginmax:task-capture-refresh", load);
        return () =>
          window.removeEventListener("pluginmax:task-capture-refresh", load);
      }, [load]);
      return h(
        "button",
        {
          type: "button",
          className: "pmtask-btn secondary pmtc-launcher",
          title: "查看任务草稿箱",
          "aria-label":
            count > 0
              ? `查看任务草稿箱，当前 ${count} 条草稿`
              : "查看任务草稿箱",
          onClick: () => props.onOpenDrafts?.(),
        },
        "草稿箱",
        count > 0
          ? h("strong", { className: "pmtask-btn-count" }, count)
          : null,
      );
    }

    function TaskDraftInboxPage(props) {
      const projects = Array.isArray(props.projects) ? props.projects : [];
      const projectIds = projects.map((project) => project.id).filter(Boolean);
      const [items, setItems] = react.useState([]);
      const [loading, setLoading] = react.useState(true);
      const [refreshing, setRefreshing] = react.useState(false);
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [search, setSearch] = react.useState("");
      const [selectedProject, setSelectedProject] = react.useState("");
      const [selectedIds, setSelectedIds] = react.useState([]);
      const [allowedDuplicates, setAllowedDuplicates] = react.useState({});
      const [editorEntry, setEditorEntry] = react.useState(undefined);
      const [createOpen, setCreateOpen] = react.useState(false);
      const [lastCreated, setLastCreated] = react.useState(null);
      const [tasksByWorkspace, setTasksByWorkspace] = react.useState({});
      const selectedProjectRef = react.useRef("");
      const itemsRef = react.useRef([]);
      react.useEffect(() => {
        selectedProjectRef.current = selectedProject;
      }, [selectedProject]);
      react.useEffect(() => {
        itemsRef.current = items;
      }, [items]);
      const receiverOptions = directoryOptions(props.directory);
      const fetchEntries = react.useCallback(async () => {
        if (projectIds.length === 0) return [];
        const results = await Promise.all(
          projectIds.map((workspaceId) =>
            request(
              `/api/collab/task-capture/library?workspaceId=${encodeURIComponent(workspaceId)}`,
            ),
          ),
        );
        return results
          .flatMap((result) => result.items ?? [])
          .sort((left, right) =>
            right.draft.updatedAt.localeCompare(left.draft.updatedAt),
          );
      }, [projectIds.join(":")]);
      const defaultSelection = (entries, projectKey) =>
        entries
          .filter(
            (entry) =>
              draftProjectKey(entry) === projectKey && selectableReady(entry),
          )
          .map((entry) => entry.draft.id);
      const loadLibrary = react.useCallback(
        async (options = {}) => {
          if (!options.silent) setLoading(true);
          if (options.manual) setRefreshing(true);
          setError("");
          try {
            const next = await fetchEntries();
            setItems(next);
            const projectKeys = [
              ...new Set(next.map((entry) => draftProjectKey(entry))),
            ].sort((left, right) => {
              const leftTime =
                next.find((entry) => draftProjectKey(entry) === left)?.draft
                  .updatedAt ?? "";
              const rightTime =
                next.find((entry) => draftProjectKey(entry) === right)?.draft
                  .updatedAt ?? "";
              return rightTime.localeCompare(leftTime);
            });
            const current = selectedProjectRef.current;
            const nextProject =
              current !== "" && projectKeys.includes(current)
                ? current
                : (projectKeys[0] ?? UNASSIGNED_PROJECT);
            if (options.preserve === true && current === nextProject) {
              const selectable = new Set(
                next
                  .filter(
                    (entry) =>
                      draftProjectKey(entry) === nextProject &&
                      (selectableReady(entry) ||
                        entry.draft.readiness === "needs-info"),
                  )
                  .map((entry) => entry.draft.id),
              );
              setSelectedIds((selected) =>
                selected.filter((id) => selectable.has(id)),
              );
            } else {
              setSelectedIds(defaultSelection(next, nextProject));
            }
            setSelectedProject(nextProject);
            return next;
          } catch (cause) {
            setError(
              cause?.status === 403
                ? "项目无权限，无法读取该项目的任务草稿"
                : cause instanceof Error
                  ? cause.message
                  : String(cause),
            );
            return [];
          } finally {
            setLoading(false);
            setRefreshing(false);
          }
        },
        [fetchEntries],
      );
      react.useEffect(() => {
        void loadLibrary();
      }, [loadLibrary]);
      react.useEffect(() => {
        let disposed = false;
        void (async () => {
          const results = await Promise.all(
            projectIds.map((workspaceId) =>
              request(
                `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`,
              ).catch(() => ({ tasks: [] })),
            ),
          );
          if (disposed) return;
          setTasksByWorkspace(
            Object.fromEntries(
              projectIds.map((workspaceId, index) => [
                workspaceId,
                results[index]?.tasks ?? [],
              ]),
            ),
          );
        })();
        return () => {
          disposed = true;
        };
      }, [projectIds.join(":")]);
      react.useEffect(() => {
        const refresh = () =>
          void loadLibrary({ silent: true, preserve: true });
        window.addEventListener("pluginmax:task-capture-refresh", refresh);
        window.addEventListener("pluginmax:task-capture-open", refresh);
        return () => {
          window.removeEventListener("pluginmax:task-capture-refresh", refresh);
          window.removeEventListener("pluginmax:task-capture-open", refresh);
        };
      }, [loadLibrary]);
      const selectProject = (projectKey) => {
        setSelectedProject(projectKey);
        setSelectedIds(defaultSelection(itemsRef.current, projectKey));
      };
      const replaceEntry = (draft) =>
        setItems((current) =>
          current.map((entry) =>
            entry.draft.id === draft.id ? { ...entry, draft } : entry,
          ),
        );
      const saveTitle = async (entry, title) => {
        setError("");
        try {
          const response = await request(
            "/api/collab/task-capture/draft/update",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: entry.draft.workspaceId,
                draftId: entry.draft.id,
                expectedRevision: entry.draft.revision,
                commandId: commandId("tc-title"),
                patch: { title },
              }),
            },
          );
          replaceEntry(response.draft ?? response);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          throw cause;
        }
      };
      const linkDuplicate = async (entry) => {
        const taskId = entry.draft.duplicate?.candidateTaskId;
        if (taskId === undefined) {
          setError("重复项没有可关联的任务 ID");
          return;
        }
        try {
          await request("/api/collab/task-capture/draft/link", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: entry.draft.workspaceId,
              draftId: entry.draft.id,
              taskId,
              expectedRevision: entry.draft.revision,
              commandId: commandId("tc-link"),
            }),
          });
          setNotice("草稿已关联到已有任务");
          await loadLibrary({ silent: true, preserve: true });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };
      const acknowledgeDuplicate = (entry) => {
        setAllowedDuplicates((current) => ({
          ...current,
          [entry.draft.id]: true,
        }));
        if (entry.draft.readiness === "ready") {
          setSelectedIds((current) =>
            current.includes(entry.draft.id)
              ? current
              : [...current, entry.draft.id],
          );
        }
      };
      const openSource = (entry) => {
        const source = entry.batch.source;
        if (source.sourceType === "meeting") {
          window.__pluginmaxShell?.setRoute?.("meetings");
          window.dispatchEvent(
            new CustomEvent("pluginmax:collab-navigate", {
              detail: {
                plugin: "meeting",
                meetingId: source.sourceId,
                workspaceId: source.workspaceId,
              },
            }),
          );
          return;
        }
        if (source.sourceType === "data-agent") {
          window.__pluginmaxPendingDataAgentConversation = {
            workspaceId: source.workspaceId,
            conversationId: source.sourceId,
          };
          window.__pluginmaxSidePanel?.openTab("data-agent");
          return;
        }
        if (source.sourceType === "ai-chat" || source.sourceType === "chat") {
          window.__pluginmaxSidePanel?.openTab("communication");
          return;
        }
        setError("来源入口暂不可用，草稿内容仍可继续编辑");
      };
      const toggleSelected = (entry) => {
        if (
          entry.draft.status !== "active" ||
          !entry.canEdit ||
          (entry.draft.duplicate !== undefined &&
            allowedDuplicates[entry.draft.id] !== true)
        ) {
          return;
        }
        setSelectedIds((current) =>
          current.includes(entry.draft.id)
            ? current.filter((id) => id !== entry.draft.id)
            : [...current, entry.draft.id],
        );
      };
      const searchValue = search.trim().toLowerCase();
      const visibleItems = items.filter((entry) => {
        if (searchValue === "") return true;
        return [
          entry.draft.title,
          entry.draft.description,
          entry.draft.receiverName ?? "",
          entry.batch.source.sourceTitle,
          projectTitle(draftProjectId(entry), projects),
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchValue);
      });
      const projectStats = new Map();
      for (const entry of visibleItems) {
        const key = draftProjectKey(entry);
        const current = projectStats.get(key) ?? {
          total: 0,
          ready: 0,
          needs: 0,
          updatedAt: "",
        };
        current.total += 1;
        current.updatedAt =
          current.updatedAt > entry.draft.updatedAt
            ? current.updatedAt
            : entry.draft.updatedAt;
        if (
          entry.draft.status === "active" &&
          entry.draft.readiness === "ready" &&
          entry.draft.duplicate === undefined
        ) {
          current.ready += 1;
        }
        if (
          entry.draft.status === "active" &&
          (entry.draft.readiness === "needs-info" ||
            entry.draft.duplicate !== undefined)
        ) {
          current.needs += 1;
        }
        projectStats.set(key, current);
      }
      const currentEntries = visibleItems.filter(
        (entry) => draftProjectKey(entry) === selectedProject,
      );
      const selectedEntries = items.filter(
        (entry) =>
          draftProjectKey(entry) === selectedProject &&
          selectedIds.includes(entry.draft.id),
      );
      const readySelectedEntries = selectedEntries.filter(
        (entry) =>
          entry.draft.status === "active" &&
          entry.draft.readiness === "ready" &&
          (entry.draft.duplicate === undefined ||
            allowedDuplicates[entry.draft.id] === true),
      );
      const projectUpdatedAt = currentEntries.reduce(
        (latest, entry) =>
          entry.draft.updatedAt > latest ? entry.draft.updatedAt : latest,
        "",
      );
      if (loading) {
        return h(
          "section",
          { className: "pmtd-root", "data-page": "task-drafts" },
          h("style", null, styles),
          h(
            "div",
            { className: "pmtd-loading" },
            h("span", { className: "pmtd-spinner" }),
            "正在加载任务草稿",
          ),
        );
      }
      return h(
        "section",
        { className: "pmtd-root", "data-page": "task-drafts" },
        h("style", null, styles),
        h(
          "button",
          {
            type: "button",
            className: "pmtd-back",
            onClick: props.onBack,
          },
          captureIcon("arrowLeft", 14),
          "返回任务管理",
        ),
        h(
          "header",
          { className: "pmtd-head" },
          h(
            "div",
            { className: "pmtd-title" },
            h("h1", null, "任务草稿箱"),
            h("span", { className: "pmtd-total" }, items.length),
          ),
          h(
            "div",
            { className: "pmtd-head-actions" },
            h(
              "button",
              {
                type: "button",
                className: "pmtd-btn",
                onClick: () => setEditorEntry(null),
              },
              captureIcon("plus", 13),
              "新建草稿",
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmtd-icon-btn",
                title: "刷新",
                "aria-label": "刷新任务草稿",
                disabled: refreshing,
                onClick: () =>
                  void loadLibrary({ manual: true, preserve: true }),
              },
              captureIcon("refresh", 14),
            ),
            h(
              "label",
              { className: "pmtd-search" },
              captureIcon("search", 13),
              h("input", {
                className: "pmtd-input",
                value: search,
                placeholder: "搜索草稿",
                "aria-label": "搜索任务草稿",
                onChange: (event) => setSearch(event.target.value),
              }),
            ),
          ),
        ),
        error === ""
          ? null
          : h(
              "div",
              { className: "pmtd-alert", role: "alert" },
              captureIcon("alert", 13),
              h("span", null, error),
            ),
        notice === ""
          ? null
          : h(
              "div",
              { className: "pmtd-notice", role: "status" },
              captureIcon("check", 13),
              h("span", null, notice),
            ),
        lastCreated !== null
          ? h(
              "div",
              { className: "pmtd-notice", role: "status" },
              captureIcon("checkSquare", 13),
              h(
                "span",
                null,
                `已创建 ${lastCreated.summary.created + lastCreated.summary.deduplicated} 条正式任务，草稿保留为来源历史。`,
              ),
              ...lastCreated.items
                .filter((item) => item.taskId !== undefined)
                .map((item) =>
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtd-mini-btn",
                      key: item.taskId,
                      onClick: () =>
                        props.onOpenTask?.(item.taskId, item.workspaceId),
                    },
                    item.taskId,
                  ),
                ),
            )
          : null,
        h(
          "div",
          { className: "pmtd-workspace" },
          h(
            "aside",
            { className: "pmtd-projects", "aria-label": "按项目查看草稿" },
            h("div", { className: "pmtd-projects-head" }, "项目"),
            h(
              "div",
              { className: "pmtd-project-list" },
              projectStats.size === 0
                ? h(
                    "div",
                    { className: "pmtd-tag-empty" },
                    searchValue === "" ? "暂无项目草稿" : "搜索无结果",
                  )
                : [...projectStats.entries()].map(([projectKey, stats]) =>
                    h(
                      "button",
                      {
                        type: "button",
                        className: `pmtd-project${selectedProject === projectKey ? " is-active" : ""}`,
                        key: projectKey,
                        "aria-pressed": selectedProject === projectKey,
                        onClick: () => selectProject(projectKey),
                      },
                      h(
                        "span",
                        { className: "pmtd-project-top" },
                        h(
                          "span",
                          { className: "pmtd-project-name" },
                          projectKey === UNASSIGNED_PROJECT
                            ? "未归属项目"
                            : projectTitle(projectKey, projects),
                        ),
                        h(
                          "time",
                          { className: "pmtd-project-time" },
                          formatDraftTime(stats.updatedAt),
                        ),
                      ),
                      h(
                        "span",
                        { className: "pmtd-project-counts" },
                        h("span", null, `全部 ${stats.total}`),
                        h("span", null, `待创建 ${stats.ready}`),
                        h(
                          "span",
                          { className: "warn" },
                          `待完善 ${stats.needs}`,
                        ),
                      ),
                    ),
                  ),
            ),
          ),
          h(
            "main",
            { className: "pmtd-detail" },
            h(
              "div",
              { className: "pmtd-detail-head" },
              h(
                "div",
                { className: "pmtd-detail-copy" },
                h(
                  "h2",
                  null,
                  selectedProject === UNASSIGNED_PROJECT
                    ? "未归属项目"
                    : projectTitle(selectedProject, projects),
                ),
                h(
                  "p",
                  null,
                  `${currentEntries.length} 条草稿${projectUpdatedAt === "" ? "" : ` · 更新于 ${formatDraftTime(projectUpdatedAt)}`}`,
                ),
              ),
              h(
                "select",
                {
                  className: "pmtd-select pmtd-mobile-project",
                  value: selectedProject,
                  "aria-label": "切换项目",
                  onChange: (event) => selectProject(event.target.value),
                },
                ...[...projectStats.entries()].map(([projectKey, stats]) =>
                  h(
                    "option",
                    { value: projectKey, key: projectKey },
                    `${projectKey === UNASSIGNED_PROJECT ? "未归属项目" : projectTitle(projectKey, projects)}（${stats.total}）`,
                  ),
                ),
              ),
            ),
            currentEntries.length === 0
              ? h(
                  "div",
                  { className: "pmtd-empty" },
                  h(
                    "strong",
                    null,
                    searchValue === "" ? "暂无任务草稿" : "当前搜索下没有草稿",
                  ),
                  h(
                    "span",
                    null,
                    searchValue === ""
                      ? "从沟通来源保存草稿，或直接新建一条草稿。"
                      : "清除搜索条件后查看当前项目草稿。",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtd-btn",
                      onClick: () =>
                        searchValue === ""
                          ? setEditorEntry(null)
                          : setSearch(""),
                    },
                    searchValue === "" ? "新建草稿" : "清除搜索",
                  ),
                )
              : h(
                  "div",
                  { className: "pmtd-list" },
                  ...currentEntries.map((entry) => {
                    const status = draftStatus(entry);
                    const receiver = receiverDisplayForDraft(
                      entry.draft,
                      receiverOptions,
                    );
                    const duplicateAcknowledged =
                      allowedDuplicates[entry.draft.id] === true;
                    const frozen =
                      entry.draft.status === "converted" ||
                      entry.draft.status === "linked" ||
                      entry.draft.status === "ignored";
                    const checked = selectedIds.includes(entry.draft.id);
                    return h(
                      "article",
                      {
                        className: `pmtd-row${status.key === "done" ? " is-created" : ""}`,
                        key: entry.draft.id,
                        "data-draft-id": entry.draft.id,
                      },
                      h(
                        "label",
                        { className: "pmtd-row-check" },
                        h("input", {
                          type: "checkbox",
                          checked,
                          disabled:
                            !entry.canEdit ||
                            entry.draft.status !== "active" ||
                            (entry.draft.duplicate !== undefined &&
                              !duplicateAcknowledged),
                          "aria-label": `选择${entry.draft.title}`,
                          onChange: () => toggleSelected(entry),
                        }),
                      ),
                      h(
                        "div",
                        { className: "pmtd-row-main" },
                        h(InlineDraftTitle, {
                          entry,
                          disabled: !entry.canEdit || frozen,
                          onSave: (title) => saveTitle(entry, title),
                        }),
                        h(
                          "p",
                          { className: "pmtd-desc" },
                          entry.draft.description || "任务描述待完善",
                        ),
                        h(
                          "div",
                          { className: "pmtd-meta" },
                          h(
                            "span",
                            {
                              className: `pmtd-meta-item${receiver.missing || receiver.unavailable ? " is-missing" : ""}`,
                            },
                            h("strong", null, "负责人"),
                            receiver.label,
                          ),
                          h(
                            "span",
                            {
                              className: `pmtd-meta-item${entry.draft.due === undefined ? " is-missing" : ""}`,
                            },
                            h("strong", null, "截止"),
                            entry.draft.due ?? "待完善",
                          ),
                          h(
                            "span",
                            { className: "pmtd-meta-item" },
                            h("strong", null, "优先级"),
                            DRAFT_PRIORITY_LABEL[entry.draft.priority] ??
                              entry.draft.priority,
                          ),
                          h(
                            "span",
                            { className: "pmtd-meta-item" },
                            h("strong", null, "验收"),
                            `${entry.draft.acceptance.length} 条`,
                          ),
                          h(
                            "span",
                            { className: "pmtd-meta-item" },
                            h("strong", null, "协作方"),
                            entry.draft.collaboratorHints.length,
                          ),
                          h(
                            "span",
                            { className: "pmtd-meta-item" },
                            h("strong", null, "前置任务"),
                            entry.draft.dependsOn.length,
                          ),
                          defaultFilledForDraft(entry.draft)
                            ? h(
                                "span",
                                { className: "pmtd-default" },
                                captureIcon("check", 10),
                                "默认补齐",
                              )
                            : null,
                          h(
                            "button",
                            {
                              type: "button",
                              className: "pmtd-source",
                              title: entry.batch.source.deepLink
                                ? "打开来源"
                                : "来源入口不可用",
                              onClick: () => openSource(entry),
                            },
                            captureIcon("message", 10),
                            h("span", null, entry.batch.source.sourceTitle),
                          ),
                          entry.taskId === undefined
                            ? null
                            : h(
                                "span",
                                { className: "pmtd-task-link" },
                                captureIcon("link", 10),
                                h(
                                  "button",
                                  {
                                    type: "button",
                                    onClick: () =>
                                      props.onOpenTask?.(
                                        entry.taskId,
                                        entry.batch.workspaceId,
                                      ),
                                  },
                                  entry.taskId,
                                ),
                              ),
                        ),
                        entry.draft.duplicate === undefined
                          ? null
                          : h(
                              "div",
                              { className: "pmtd-duplicate-row" },
                              h(
                                "span",
                                { className: "pmtd-duplicate-copy" },
                                entry.draft.duplicate.message,
                              ),
                              h(
                                "span",
                                { className: "pmtd-duplicate-actions" },
                                entry.draft.status === "linked"
                                  ? h(
                                      "span",
                                      { className: "pmtd-task-link" },
                                      `已关联 ${entry.taskId ?? entry.draft.duplicate.candidateTaskId ?? ""}`,
                                    )
                                  : [
                                      h(
                                        "button",
                                        {
                                          type: "button",
                                          className: "pmtd-mini-btn",
                                          key: "link",
                                          disabled:
                                            !entry.canEdit ||
                                            entry.draft.duplicate
                                              .candidateTaskId === undefined,
                                          onClick: () =>
                                            void linkDuplicate(entry),
                                        },
                                        "关联已有任务",
                                      ),
                                      h(
                                        "button",
                                        {
                                          type: "button",
                                          className: "pmtd-mini-btn",
                                          key: "keep",
                                          disabled:
                                            !entry.canEdit ||
                                            duplicateAcknowledged,
                                          onClick: () =>
                                            acknowledgeDuplicate(entry),
                                        },
                                        duplicateAcknowledged
                                          ? "已确认仍然创建"
                                          : "仍然创建",
                                      ),
                                    ],
                              ),
                            ),
                      ),
                      h(
                        "div",
                        { className: "pmtd-actions" },
                        h(
                          "span",
                          {
                            className: `pmtd-action status ${status.key}`,
                          },
                          status.label,
                        ),
                        h(
                          "button",
                          {
                            type: "button",
                            className: "pmtd-action edit",
                            disabled: !entry.canEdit || frozen,
                            onClick: () => setEditorEntry(entry),
                          },
                          "编辑",
                        ),
                      ),
                    );
                  }),
                ),
            h(
              "footer",
              { className: "pmtd-footer" },
              h(
                "span",
                { className: "pmtd-footer-copy" },
                `已选 ${selectedEntries.length} 条`,
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pmtd-btn primary",
                  disabled: readySelectedEntries.length === 0,
                  onClick: () => setCreateOpen(true),
                },
                captureIcon("checkSquare", 13),
                `批量创建任务（${readySelectedEntries.length}）`,
              ),
            ),
          ),
        ),
        editorEntry !== undefined
          ? h(DraftEditorDrawer, {
              key: editorEntry?.draft.id ?? "new-draft",
              entry: editorEntry,
              initialProjectId:
                selectedProject === UNASSIGNED_PROJECT
                  ? (projects[0]?.id ?? "")
                  : selectedProject,
              projects,
              directory: props.directory,
              tasksByWorkspace,
              onClose: () => setEditorEntry(undefined),
              onSaved: async () => {
                setEditorEntry(undefined);
                setNotice("草稿已保存");
                await loadLibrary({ silent: true, preserve: true });
              },
            })
          : null,
        createOpen
          ? h(CreateTasksDrawer, {
              entries: readySelectedEntries,
              projects,
              directory: props.directory,
              externalRuntimes: props.externalRuntimes,
              allowDuplicateIds: Object.keys(allowedDuplicates).filter(
                (id) => allowedDuplicates[id] === true,
              ),
              refreshEntries: () =>
                loadLibrary({ silent: true, preserve: true }),
              onClose: () => setCreateOpen(false),
              onCreated: async (created) => {
                setLastCreated(created);
                setNotice("");
                await loadLibrary({ silent: true, preserve: true });
              },
            })
          : null,
      );
    }

    function TaskOriginCard(props) {
      const [origin, setOrigin] = react.useState(null);
      const [error, setError] = react.useState("");
      react.useEffect(() => {
        let disposed = false;
        void (async () => {
          try {
            const result = await request(
              `/api/collab/task-capture/origin?workspaceId=${encodeURIComponent(props.workspaceId)}&taskId=${encodeURIComponent(props.taskId)}`,
            );
            if (!disposed) setOrigin(result.origin ?? null);
          } catch (cause) {
            if (!disposed) {
              setError(cause instanceof Error ? cause.message : String(cause));
            }
          }
        })();
        return () => {
          disposed = true;
        };
      }, [props.taskId, props.workspaceId]);
      if (origin === null && error === "") return null;
      return h(
        "div",
        { className: "pmtc-origin" },
        h("style", null, styles),
        h("strong", null, "任务来源"),
        error === ""
          ? [
              h("span", { key: "source" }, origin.sourceTitle),
              h(
                "small",
                { key: "kind" },
                `${origin.sourceType} · 来源快照已保留`,
              ),
              h(
                "button",
                {
                  key: "open",
                  className: "pmtc-btn",
                  type: "button",
                  onClick: () => {
                    if (
                      origin.sourceType === "meeting" ||
                      origin.sourceType === "ai-chat"
                    ) {
                      window.__pluginmaxShell?.setRoute?.("meetings");
                      window.dispatchEvent(
                        new CustomEvent("pluginmax:collab-navigate", {
                          detail: {
                            plugin: "meeting",
                            meetingId: origin.sourceId,
                            workspaceId: origin.workspaceId,
                          },
                        }),
                      );
                    } else if (origin.sourceType === "data-agent") {
                      window.__pluginmaxPendingDataAgentConversation = {
                        workspaceId: origin.workspaceId,
                        conversationId: origin.sourceId,
                      };
                      window.__pluginmaxSidePanel?.openTab("data-agent");
                    }
                  },
                },
                "打开来源",
              ),
            ]
          : h("small", null, `来源暂不可读：${error}`),
      );
    }

    function RailCapturePanel(props) {
      return h(TaskCapturePanel, { ...props, mode: "rail" });
    }

    function ContextCapturePanel(props) {
      return h(TaskCapturePanel, { ...props, mode: "context" });
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      window.__pluginmaxSidePanel?.registerType?.({
        type: "task-drafts",
        defaultTitle: "任务草稿",
        singleton: true,
        closable: true,
        draggable: true,
      });
      ctx.slots.inject("pluginmax.communication.rail.task-capture", () =>
        ctx.slots.register(
          {
            name: "pluginmax.communication.rail.task-capture",
            id: "pluginmax-task-capture-rail",
            order: 20,
          },
          RailCapturePanel,
        ),
      );
      ctx.slots.inject("pluginmax.communication.context.task-capture", () =>
        ctx.slots.register(
          {
            name: "pluginmax.communication.context.task-capture",
            id: "pluginmax-task-capture-context",
            order: 20,
          },
          ContextCapturePanel,
        ),
      );
      ctx.slots.inject("pluginmax.data-agent.task-capture", () =>
        ctx.slots.register(
          {
            name: "pluginmax.data-agent.task-capture",
            id: "pluginmax-task-capture-data-agent",
            order: 20,
          },
          RailCapturePanel,
        ),
      );
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: "pluginmax-task-draft-side-panel",
            order: 24,
          },
          TaskDraftSidePanel,
        ),
      );
      ctx.slots.inject("pluginmax.task.capture-launcher", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.capture-launcher",
            id: "pluginmax-task-capture-launcher",
            order: 20,
          },
          TaskCaptureInboxLauncher,
        ),
      );
      ctx.slots.inject("pluginmax.task.draft-inbox", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.draft-inbox",
            id: "pluginmax-task-draft-inbox",
            order: 20,
          },
          TaskDraftInboxPage,
        ),
      );
      ctx.slots.inject("pluginmax.task.detail.capture-origin", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.detail.capture-origin",
            id: "pluginmax-task-capture-origin",
            order: 20,
          },
          TaskOriginCard,
        ),
      );
    };

    return module.exports;
  },
});
