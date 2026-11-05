window.__ModuleLoader__.load({
  id: "dsh-collab-resource-market",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const react = require("react");
    const h = react.createElement;
    const TOKEN_KEY = "pluginmax.collab.token";
    const RESOURCE_CATEGORIES = [
      "全部",
      "AI办公",
      "计划",
      "采购",
      "生产",
      "质量",
      "仓配",
      "供应商",
      "履约",
      "自定义",
    ];
    const PREVIEW_LEGACY_MODULE = {
      "pluginmax.kpi-overview": "metrics",
      "pluginmax.daily-brief": "brief",
      "pluginmax.task-focus": "todo",
      "pluginmax.following": "focus",
      "pluginmax.meeting-insights": "meeting-minutes",
      "pluginmax.supply-exceptions": "control",
      "pluginmax.supplier-risk": "supplier",
    };

    const ICONS = {
      search: icon(
        "M21 21l-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z",
      ),
      close: icon("M18 6 6 18M6 6l12 12"),
      store: icon("M3 9l2-5h14l2 5M4 9v11h16V9M9 20v-6h6v6"),
      plus: icon("M12 5v14M5 12h14"),
      arrow: icon("M5 12h14M13 6l6 6-6 6"),
      shield: icon("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"),
      check: icon("m5 12 4 4L19 6"),
      alert: icon(
        "M12 9v4M12 17h.01M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z",
      ),
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
.pmrm-global-actions{display:flex;align-items:center;gap:6px;flex:none;}
.pmrm-iconbtn,.pmrm-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer;}
.pmrm-iconbtn{width:32px;height:32px;padding:0;}.pmrm-btn{min-height:28px;padding:2px 10px;}
.pmrm-btn.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:650;}
.pmrm-btn.danger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 42%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 10%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-state-error-primary,#e5534b);}
.pmrm-btn:disabled{opacity:.5;cursor:not-allowed;}
.pmrm-iconbtn svg,.pmrm-btn svg{width:13px;height:13px;}
.pmrm-main{min-width:0;min-height:0;display:block;overflow:hidden;}
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
.pmrm-category-strip{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 15px;padding-bottom:13px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmrm-category-strip .pmrm-chip{min-height:27px;padding:3px 11px;font-size:10px;}
.pmrm-category-strip .pmrm-custom-action{margin-left:auto;}
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
.pmrm-card-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end;}
.pmrm-skill-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;}
.pmrm-skill-card{display:flex;flex-direction:column;gap:9px;min-width:0;min-height:0;padding:11px;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-skill-card:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l3));}
.pmrm-skill-card[role="button"]{cursor:pointer;}
.pmrm-skill-card[role="button"]:focus-visible{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 55%,var(--dsw-alias-border-l3));outline:none;}
.pmrm-skill-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:9px;min-width:0;}
.pmrm-skill-body{display:flex;flex-direction:column;gap:5px;min-width:0;padding-top:1px;}
.pmrm-skill-name{min-width:0;margin:0;color:var(--dsw-alias-label-primary);font-size:12px;font-weight:650;line-height:1.4;overflow-wrap:anywhere;}
.pmrm-skill-desc{margin:0;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.pmrm-skill-tags{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.pmrm-skill-tag{min-width:0;padding:2px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1.4;overflow-wrap:anywhere;}
.pmrm-skill-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;align-self:start;}
.pmrm-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
.pmrm-resource{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:9px;padding:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-resource .pmrm-mark{width:36px;height:36px;}
.pmrm-resource-title{display:flex;align-items:center;gap:6px;min-width:0;}
.pmrm-resource-title h3{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmrm-resource-title .pmrm-status{flex:none;}
.pmrm-resource-actions{display:grid;justify-items:end;align-content:start;gap:6px;min-width:74px;}
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
.pmrm-modal-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:18px;background:rgba(5,9,16,.42);}
.pmrm-modal{width:min(980px,94vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-base);box-shadow:0 24px 70px rgba(0,0,0,.34);}
.pmrm-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.pmrm-modal-head h2{margin:0;font-size:17px;}.pmrm-modal-head p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
.pmrm-modal-body{min-height:0;flex:1;overflow:auto;padding:14px 16px;}
.pmrm-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:11px 16px;border-top:1px solid var(--dsw-alias-border-l2);}
.pmrm-preview-canvas{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;align-items:start;}
.pmrm-preview-panel{grid-column:span var(--preview-span,3);min-width:0;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-preview-panel header{display:flex;justify-content:space-between;gap:8px;margin-bottom:7px;font-size:11px;}
.pmrm-preview-panel header span{color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
.pmrm-preview-lines{display:grid;gap:5px;}
.pmrm-preview-line{display:flex;justify-content:space-between;gap:8px;padding:6px 7px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);font-size:9.5px;line-height:1.45;}
.pmrm-preview-line strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;}
.pmrm-preview-line span{flex:none;color:var(--dsw-alias-label-tertiary);}
.pmrm-custom-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.pmrm-custom-form label{display:grid;gap:5px;color:var(--dsw-alias-label-secondary);font-size:10px;}
.pmrm-custom-form label.full{grid-column:1/-1;}
.pmrm-custom-form input,.pmrm-custom-form textarea,.pmrm-custom-form select{width:100%;min-height:32px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:10.5px;}
.pmrm-custom-form textarea{min-height:72px;resize:vertical;}
.pmrm-custom-note{padding:9px;border:1px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 26%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,transparent);color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.55;}
.pmrm-custom-grid{display:grid;gap:8px;margin-top:10px;}
.pmrm-install-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);}
.pmrm-install-summary strong{font-size:11.5px;}
.pmrm-install-summary span{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
.pmrm-install-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:13px 0 7px;}
.pmrm-install-toolbar strong{font-size:11px;}
.pmrm-install-toolbar-actions{display:flex;align-items:center;gap:6px;}
.pmrm-install-agents{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:280px;overflow:auto;}
.pmrm-install-agent{display:flex;align-items:center;gap:8px;min-width:0;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;}
.pmrm-install-agent.selected{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 50%,var(--dsw-alias-border-l3));background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,var(--dsw-alias-bg-layer-1));}
.pmrm-install-agent input{width:14px;height:14px;flex:none;margin:0;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
.pmrm-install-agent-copy{display:grid;gap:2px;min-width:0;}
.pmrm-install-agent-copy strong,.pmrm-install-agent-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pmrm-install-agent-copy strong{font-size:10.5px;}
.pmrm-install-agent-copy small{color:var(--dsw-alias-label-tertiary);font-size:9px;}
.pmrm-toast{position:fixed;left:50%;bottom:28px;z-index:80;transform:translateX(-50%);padding:8px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 12px 30px rgba(0,0,0,.24);font-size:11px;}
@media(max-width:1000px){.pmrm-grid,.pmrm-skill-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.pmrm-list{grid-template-columns:1fr;}}
@media(max-width:700px){.pmrm{margin:-14px;}.pmrm-content{padding:14px;}.pmrm-grid,.pmrm-skill-grid,.pmrm-install-agents{grid-template-columns:1fr;}.pmrm-search{width:100%;order:5;margin:0;}.pmrm-detail{top:0;width:100vw;}.pmrm-brand small{display:none;}.pmrm-preview-canvas{grid-template-columns:1fr;}.pmrm-preview-panel{grid-column:span 1;}.pmrm-custom-form{grid-template-columns:1fr;}.pmrm-category-strip .pmrm-custom-action{margin-left:0;}.pmrm-modal{width:100%;max-height:94vh;}}
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
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
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
        h(
          "span",
          {
            className: "pmrm-block",
            key: panel.pluginId + index,
            style: {
              "--span": panel.span,
              "--height": `${22 + (index % 3) * 7}px`,
            },
          },
          h("i"),
          h("b"),
        ),
      );
    }

    function previewRows(panel) {
      const payload = panel?.payload;
      const data = payload?.data ?? payload ?? {};
      const items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.metrics)
          ? data.metrics
          : Array.isArray(data.rows)
            ? data.rows
            : [];
      return items.slice(0, 4).map((item, index) => {
        const title =
          item?.label ??
          item?.title ??
          item?.name ??
          item?.id ??
          `数据项 ${index + 1}`;
        const detail =
          item?.value !== undefined
            ? `${item.value}${item.unit ?? ""}`
            : (item?.statusLabel ??
              item?.status ??
              item?.level ??
              item?.role ??
              item?.note ??
              "");
        return { title: String(title), detail: String(detail).slice(0, 48) };
      });
    }

    function sourceLabel(source) {
      if (source === "provider") return "治理服务";
      if (source === "user") return "我的资源";
      return "种子目录";
    }

    function customTypeLabel(value) {
      if (value === "mcp") return "MCP";
      if (value === "workbench-template") return "工作台方案";
      if (value === "panel-plugin") return "功能插件";
      return "Skill";
    }

    function cleanSkillName(name) {
      return String(name ?? "")
        .replace(
          /\s*[（(](?:平台基线|我的扩展|平台集成|企业指定|自定义扩展|用户扩展|平台预装)[)）]\s*$/g,
          "",
        )
        .trim();
    }

    function u16(bytes, offset) {
      return bytes[offset] | (bytes[offset + 1] << 8);
    }

    function u32(bytes, offset) {
      return (
        (bytes[offset] |
          (bytes[offset + 1] << 8) |
          (bytes[offset + 2] << 16) |
          (bytes[offset + 3] << 24)) >>>
        0
      );
    }

    async function inflateZipEntry(bytes) {
      if (typeof DecompressionStream !== "function") {
        throw new Error("当前浏览器不支持 ZIP 解压");
      }
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function readSkillZip(file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let eocd = -1;
      for (
        let offset = bytes.length - 22;
        offset >= Math.max(0, bytes.length - 65_557);
        offset -= 1
      ) {
        if (u32(bytes, offset) === 0x06054b50) {
          eocd = offset;
          break;
        }
      }
      if (eocd < 0) throw new Error("ZIP 目录不完整");
      const entryCount = u16(bytes, eocd + 10);
      const centralOffset = u32(bytes, eocd + 16);
      if (entryCount === 0 || entryCount > 500) {
        throw new Error("ZIP 中没有可读取的 Skill 文件");
      }
      const decoder = new TextDecoder();
      const entries = new Map();
      let offset = centralOffset;
      for (let index = 0; index < entryCount; index += 1) {
        if (u32(bytes, offset) !== 0x02014b50) {
          throw new Error("ZIP 中央目录格式不正确");
        }
        const method = u16(bytes, offset + 10);
        const compressedSize = u32(bytes, offset + 20);
        const nameLength = u16(bytes, offset + 28);
        const extraLength = u16(bytes, offset + 30);
        const commentLength = u16(bytes, offset + 32);
        const localOffset = u32(bytes, offset + 42);
        const name = decoder.decode(
          bytes.slice(offset + 46, offset + 46 + nameLength),
        );
        if (u32(bytes, localOffset) !== 0x04034b50) {
          throw new Error(`ZIP 文件头损坏：${name}`);
        }
        const localNameLength = u16(bytes, localOffset + 26);
        const localExtraLength = u16(bytes, localOffset + 28);
        const dataOffset =
          localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(
          dataOffset,
          dataOffset + compressedSize,
        );
        const content =
          method === 0
            ? compressed
            : method === 8
              ? await inflateZipEntry(compressed)
              : undefined;
        if (content !== undefined && !name.endsWith("/")) {
          entries.set(name, decoder.decode(content));
        }
        offset += 46 + nameLength + extraLength + commentLength;
      }
      const byBaseName = (target) =>
        [...entries.entries()].find(
          ([name]) =>
            name === target ||
            name.endsWith(`/${target}`) ||
            name.endsWith(`\\${target}`),
        )?.[1];
      const manifestText = byBaseName("skill.json");
      const markdown = byBaseName("SKILL.md");
      if (manifestText === undefined && markdown === undefined) {
        throw new Error("ZIP 中必须包含 skill.json 或 SKILL.md");
      }
      if (manifestText !== undefined) {
        const parsed = JSON.parse(manifestText);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("skill.json 必须是 JSON 对象");
        }
        return { manifest: parsed, markdown: markdown ?? "" };
      }
      return {
        manifest: {
          schemaVersion: 1,
          kind: "agent-skill",
          instructions: markdown,
          triggers: ["work-report"],
        },
        markdown,
      };
    }

    async function parseSkillFile(file) {
      if (/\.zip$/i.test(file.name)) return readSkillZip(file);
      const text = await file.text();
      const markdown = /\.(md|markdown)$/i.test(file.name) ||
        !text.trim().startsWith("{");
      if (!markdown) {
        const parsed = JSON.parse(text);
        return { manifest: parsed, markdown: "" };
      }
      return {
        manifest: {
          schemaVersion: 1,
          kind: "agent-skill",
          instructions: text,
          triggers: ["work-report"],
        },
        markdown: text,
      };
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

    function SkillMarketCard({
      item,
      custom = false,
      onOpen,
      onInstall,
      onUninstall,
      actionDisabled = false,
    }) {
      const installed = item.status === "enabled";
      const developer = custom ? item.publisherName : item.publisher?.name;
      const category = custom ? "自定义" : item.category;
      const usage =
        custom || item.usage === "自定义 Skill"
          ? "未统计"
          : item.usage || "未统计";
      return h(
        "article",
        {
          className: "pmrm-skill-card",
          "data-skill-id": item.id,
          role: "button",
          tabIndex: 0,
          onClick: () => onOpen?.(item),
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onOpen?.(item);
          },
        },
        h(
          "div",
          { className: "pmrm-skill-head" },
          h(
            "div",
            { className: "pmrm-skill-body" },
            h(
              "h3",
              { className: "pmrm-skill-name" },
              cleanSkillName(item.name),
            ),
            h(
              "p",
              { className: "pmrm-skill-desc" },
              item.description || "暂无 Skill 说明。",
            ),
          ),
          onInstall || onUninstall
            ? h(
                "div",
                { className: "pmrm-skill-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    className: installed ? "pmrm-btn" : "pmrm-btn primary",
                    disabled:
                      actionDisabled ||
                      (installed ? onUninstall === undefined : onInstall === undefined),
                    onClick: (event) => {
                      event.stopPropagation();
                      if (installed) onUninstall?.(item);
                      else onInstall?.(item);
                    },
                  },
                  installed ? "卸载" : "安装",
                ),
              )
            : null,
        ),
        h(
          "div",
          { className: "pmrm-skill-tags" },
          h(
            "span",
            { className: "pmrm-skill-tag", "data-skill-tag": "version" },
            `v${item.version}`,
          ),
          h(
            "span",
            { className: "pmrm-skill-tag", "data-skill-tag": "category" },
            category || "未分类",
          ),
          h(
            "span",
            { className: "pmrm-skill-tag", "data-skill-tag": "usage" },
            usage,
          ),
          h(
            "span",
            { className: "pmrm-skill-tag", "data-skill-tag": "developer" },
            developer || "未知",
          ),
        ),
      );
    }

    function ResourceAssetCard({
      kind,
      item,
      onOpen,
      onAction,
      actionDisabled = false,
    }) {
      const permissions = item.permissions ?? [];
      const mcpActionLabel =
        item.status === "connected"
          ? "断开连接"
          : item.status === "pending"
            ? "等待验证"
            : "连接";
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
          h(
            "div",
            { className: "pmrm-resource-title" },
            h("h3", null, item.name),
            h(
              "span",
              {
                className: `pmrm-status${assetStatusClass(kind, item.status)}`,
              },
              assetStatusLabel(kind, item.status),
            ),
          ),
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
          { className: "pmrm-resource-actions" },
          kind === "mcp"
            ? h(
                "button",
                {
                  type: "button",
                  className:
                    item.status === "connected"
                      ? "pmrm-btn"
                      : "pmrm-btn primary",
                  disabled: actionDisabled || item.status === "pending",
                  onClick: () => onAction?.(item),
                },
                mcpActionLabel,
              )
            : null,
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

    function CustomResourceCard({ item, onOpen, onAction }) {
      return h(
        "article",
        { className: "pmrm-resource" },
        h(
          "span",
          {
            className: "pmrm-mark",
            style: { "--asset-color": "#8a6fd6" },
          },
          ICONS.plus,
        ),
        h(
          "div",
          { style: { minWidth: 0 } },
          h(
            "div",
            { className: "pmrm-resource-title" },
            h("h3", null, item.name),
            h(
              "span",
              {
                className: `pmrm-status${item.status === "enabled" ? " ok" : ""}`,
              },
              item.status === "enabled" ? "已安装" : "已注册",
            ),
          ),
          h("p", null, item.description || "用户注册的自定义资源"),
          h(
            "div",
            { className: "pmrm-card-meta" },
            h("span", null, customTypeLabel(item.type)),
            h("span", null, `v${item.version}`),
            h("span", null, item.publisherName),
            h("span", null, sourceLabel("user")),
            h("span", null, item.permissions.join(" · ") || "未声明额外权限"),
          ),
        ),
        h(
          "div",
          { className: "pmrm-resource-actions" },
            item.type === "skill"
              ? h(
                  "button",
                  {
                    type: "button",
                    className:
                      item.status === "enabled"
                        ? "pmrm-btn"
                        : "pmrm-btn primary",
                    disabled: item.status === "enabled",
                    onClick: () => onAction?.(item),
                  },
                  item.status === "enabled" ? "已安装" : "安装",
                )
              : null,
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
      const [customResources, setCustomResources] = react.useState([]);
      const [detail, setDetail] = react.useState(null);
      const [preview, setPreview] = react.useState(null);
      const [installTarget, setInstallTarget] = react.useState(null);
      const [installAgents, setInstallAgents] = react.useState([]);
      const [installAgentIds, setInstallAgentIds] = react.useState([]);
      const [installLoading, setInstallLoading] = react.useState(false);
      const [installError, setInstallError] = react.useState("");
      const [uninstallTarget, setUninstallTarget] = react.useState(null);
      const [uninstallAgents, setUninstallAgents] = react.useState([]);
      const [uninstallLoading, setUninstallLoading] = react.useState(false);
      const [uninstallError, setUninstallError] = react.useState("");
      const [registerOpen, setRegisterOpen] = react.useState(false);
      const [registerManifest, setRegisterManifest] = react.useState(null);
      const [registerForm, setRegisterForm] = react.useState({
        name: "",
        description: "",
        version: "1.0.0",
        publisherName: "",
        permissions: "",
      });
      const [activeWorkbench, setActiveWorkbench] = react.useState(null);
      const [currentUserId, setCurrentUserId] = react.useState("");
      const [toast, setToast] = react.useState("");
      const timer = react.useRef(0);

      const showToast = (message) => {
        setToast(message);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setToast(""), 2500);
      };

      const loadSkills = react.useCallback(
        async (search = "", selectedCategory = "全部") => {
          setLoading(true);
          try {
            const params = new URLSearchParams({ q: search });
            if (selectedCategory !== "全部" && selectedCategory !== "自定义") {
              params.set("category", selectedCategory);
            }
            const result = await request(
              `/api/collab/resources/skills?${params.toString()}`,
            );
            setSkills(
              selectedCategory === "自定义" ? [] : (result.skills ?? []),
            );
            setError("");
          } catch (cause) {
            setError(cause.message);
          } finally {
            setLoading(false);
          }
        },
        [],
      );

      const loadMcps = react.useCallback(
        async (search = "", selectedCategory = "全部") => {
          setLoading(true);
          try {
            const params = new URLSearchParams({ q: search });
            if (selectedCategory !== "全部" && selectedCategory !== "自定义") {
              params.set("category", selectedCategory);
            }
            const result = await request(
              `/api/collab/resources/mcps?${params.toString()}`,
            );
            setMcps(selectedCategory === "自定义" ? [] : (result.mcps ?? []));
            setError("");
          } catch (cause) {
            setError(cause.message);
          } finally {
            setLoading(false);
          }
        },
        [],
      );

      const loadCustomResources = react.useCallback(
        async (type, search = "", selectedCategory = "自定义") => {
          if (selectedCategory !== "自定义") {
            setCustomResources([]);
            return;
          }
          try {
            const params = new URLSearchParams({
              type,
              q: search,
              category: selectedCategory,
            });
            const result = await request(
              `/api/collab/resources/custom?${params.toString()}`,
            );
            setCustomResources(result.resources ?? []);
          } catch (cause) {
            setError(cause.message);
          }
        },
        [],
      );

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
            ) ??
            workbenches[0] ??
            null;
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

      const currentCustomType =
        tab === "skill"
          ? "skill"
          : tab === "mcp"
            ? "mcp"
            : assetTab === "templates"
              ? "workbench-template"
              : "panel-plugin";

      react.useEffect(() => {
        if (route !== "resource-market") return;
        setDetail(null);
        setCategory("全部");
        setPublisher("all");
        setCompatibility("all");
        setSort("recommended");
        setPagination({ page: 1, pageCount: 1, total: 0 });
        setCustomResources([]);
        setQuery("");
        if (tab === "skill") void loadSkills("", "全部");
        if (tab === "mcp") void loadMcps("", "全部");
        if (tab === "workbench") {
          void loadWorkbenchContext();
          if (assetTab === "templates") void loadTemplates();
          else void loadPlugins();
        }
      }, [route, tab, assetTab]);

      react.useEffect(() => {
        if (route !== "resource-market") return undefined;
        const onKey = (event) => {
          if (event.key === "Escape") {
            setDetail(null);
            setPreview(null);
            setInstallTarget(null);
            setUninstallTarget(null);
            setRegisterOpen(false);
          }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [route]);

      if (route !== "resource-market") return null;

      const updateSearch = (value) => {
        setQuery(value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          if (tab === "skill") {
            void loadSkills(value, category);
            void loadCustomResources("skill", value, category);
          } else if (tab === "mcp") {
            void loadMcps(value, category);
            void loadCustomResources("mcp", value, category);
          } else if (assetTab === "templates") {
            void loadTemplates(
              value,
              category,
              publisher,
              compatibility,
              sort,
              1,
            );
            void loadCustomResources("workbench-template", value, category);
          } else {
            void loadPlugins(
              value,
              category,
              publisher,
              compatibility,
              sort,
              1,
            );
            void loadCustomResources("panel-plugin", value, category);
          }
        }, 280);
      };

      const chooseCategory = (value) => {
        setCategory(value);
        setPagination((current) => ({ ...current, page: 1 }));
        if (tab === "skill") {
          void loadSkills(query, value);
          void loadCustomResources("skill", query, value);
        } else if (tab === "mcp") {
          void loadMcps(query, value);
          void loadCustomResources("mcp", query, value);
        } else if (tab === "workbench") {
          if (assetTab === "templates") {
            void loadTemplates(query, value, publisher, compatibility, sort, 1);
            void loadCustomResources("workbench-template", query, value);
          } else {
            void loadPlugins(query, value, publisher, compatibility, sort, 1);
            void loadCustomResources("panel-plugin", query, value);
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
          void loadTemplates(
            query,
            category,
            publisher,
            compatibility,
            value,
            1,
          );
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
        setCustomResources([]);
        void loadWorkbenchContext();
      };

      const openInstallDialog = async (skill, custom = false) => {
        if (busy) return;
        setInstallTarget({ skill, custom });
        setInstallAgentIds([]);
        setInstallAgents([]);
        setInstallError("");
        setInstallLoading(true);
        try {
          const [current, listing] = await Promise.all([
            request("/api/collab/auth/me"),
            request("/api/collab/teammates"),
          ]);
          const userId = current?.user?.id ?? "";
          setCurrentUserId(userId);
          setInstallAgents(
            (listing.teammates ?? [])
              .filter(
                (item) =>
                  item.ownerUserId === userId &&
                  item.state === "active" &&
                  item.archived !== true,
              )
              .sort((left, right) => left.name.localeCompare(right.name)),
          );
        } catch (cause) {
          setInstallError(
            cause instanceof Error ? cause.message : String(cause),
          );
        } finally {
          setInstallLoading(false);
        }
      };

      const confirmInstall = async () => {
        if (busy || installTarget === null) return;
        setBusy(true);
        setInstallError("");
        try {
          const skill = installTarget.skill;
          await request("/api/collab/resources/skills", {
            method: "POST",
            body: JSON.stringify({ skillId: skill.id }),
          });
          if (installTarget.custom) {
            setCustomResources((items) =>
              items.map((item) =>
                item.id === skill.id ? { ...item, status: "enabled" } : item,
              ),
            );
            setDetail((current) =>
              current?.kind === "custom" && current.value.id === skill.id
                ? {
                    ...current,
                    value: { ...current.value, status: "enabled" },
                  }
                : current,
            );
          } else {
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
          }

          const scenes =
            (installTarget.custom
              ? skill.manifest?.triggers
              : skill.triggers) ?? ["general"];
          const results = await Promise.allSettled(
            installAgentIds.map((teammateId) =>
              request("/api/collab/teammates/skills/extend", {
                method: "POST",
                body: JSON.stringify({
                  teammateId,
                  skillId: skill.id,
                  mode: "additive",
                  scenes:
                    Array.isArray(scenes) && scenes.length > 0
                      ? scenes
                      : ["general"],
                }),
              }),
            ),
          );
          const succeeded = results.filter(
            (result) => result.status === "fulfilled",
          ).length;
          const failed = results.length - succeeded;
          setInstallTarget(null);
          if (installAgentIds.length === 0) {
            showToast(`已将「${cleanSkillName(skill.name)}」安装到 Skill 资源库`);
          } else if (failed === 0) {
            showToast(
              `已安装，并添加到 ${String(succeeded)} 个 AI 伙伴`,
            );
          } else {
            showToast(
              `已安装；${String(succeeded)} 个 AI 伙伴成功，${String(failed)} 个失败`,
            );
          }
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : String(cause);
          setInstallError(message);
          showToast(message);
        } finally {
          setBusy(false);
        }
      };

      const openUninstallDialog = async (skill, custom = false) => {
        if (busy) return;
        setUninstallTarget({ skill, custom });
        setUninstallAgents([]);
        setUninstallError("");
        setUninstallLoading(true);
        try {
          const [current, listing] = await Promise.all([
            request("/api/collab/auth/me"),
            request("/api/collab/teammates"),
          ]);
          const userId = current?.user?.id ?? "";
          const agents = (listing.teammates ?? []).filter(
            (item) =>
              item.ownerUserId === userId &&
              item.state === "active" &&
              item.archived !== true,
          );
          const configs = await Promise.all(
            agents.map((agent) =>
              request(
                `/api/collab/teammates/skills?teammateId=${encodeURIComponent(agent.id)}`,
              ),
            ),
          );
          setUninstallAgents(
            agents.filter((_, index) =>
              (configs[index]?.extensions ?? []).some(
                (extension) => extension.skillId === skill.id,
              ),
            ),
          );
        } catch (cause) {
          setUninstallError(
            cause instanceof Error ? cause.message : String(cause),
          );
        } finally {
          setUninstallLoading(false);
        }
      };

      const confirmUninstall = async () => {
        if (busy || uninstallTarget === null) return;
        setBusy(true);
        setUninstallError("");
        try {
          const skill = uninstallTarget.skill;
          const removals = await Promise.allSettled(
            uninstallAgents.map((agent) =>
              request("/api/collab/teammates/skills/remove", {
                method: "POST",
                body: JSON.stringify({
                  teammateId: agent.id,
                  skillId: skill.id,
                }),
              }),
            ),
          );
          const failedRemovals = removals.filter(
            (result) => result.status === "rejected",
          );
          if (failedRemovals.length > 0) {
            throw new Error(
              `有 ${String(failedRemovals.length)} 个 AI 伙伴移除失败，资源库保留未卸载`,
            );
          }
          await request(
            `/api/collab/resources/skills?id=${encodeURIComponent(skill.id)}`,
            { method: "DELETE" },
          );
          if (uninstallTarget.custom) {
            setCustomResources((items) =>
              items.map((item) =>
                item.id === skill.id ? { ...item, status: "available" } : item,
              ),
            );
            setDetail((current) =>
              current?.kind === "custom" && current.value.id === skill.id
                ? {
                    ...current,
                    value: { ...current.value, status: "available" },
                  }
                : current,
            );
          } else {
            setSkills((items) =>
              items.map((item) =>
                item.id === skill.id ? { ...item, status: "available" } : item,
              ),
            );
            setDetail((current) =>
              current?.kind === "skill" && current.value.id === skill.id
                ? {
                    ...current,
                    value: { ...current.value, status: "available" },
                  }
                : current,
            );
          }
          const count = uninstallAgents.length;
          setUninstallTarget(null);
          showToast(
            count === 0
              ? `已卸载「${cleanSkillName(skill.name)}」`
              : `已从 ${String(count)} 个 AI 伙伴移除，并卸载「${cleanSkillName(skill.name)}」`,
          );
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : String(cause);
          setUninstallError(message);
          showToast(message);
        } finally {
          setBusy(false);
        }
      };

      const connectMcp = async (mcp) => {
        if (busy) return;
        setBusy(true);
        try {
          const result = await request("/api/collab/resources/mcps/connect", {
            method: "POST",
            body: JSON.stringify({ mcpId: mcp.id }),
          });
          const status = result.install?.status ?? "pending";
          setMcps((items) =>
            items.map((item) =>
              item.id === mcp.id ? { ...item, status } : item,
            ),
          );
          setDetail((current) =>
            current?.kind === "mcp" && current.value.id === mcp.id
              ? {
                  ...current,
                  value: { ...current.value, status },
                }
              : current,
          );
          showToast(
            status === "connected"
              ? `已连接「${mcp.name}」`
              : "连接请求已登记为待验证，不会伪造已连接状态",
          );
        } catch (cause) {
          showToast(cause.message);
        } finally {
          setBusy(false);
        }
      };

      const disconnectMcp = async (mcp) => {
        if (busy) return;
        setBusy(true);
        try {
          await request("/api/collab/resources/mcps/disconnect", {
            method: "POST",
            body: JSON.stringify({ mcpId: mcp.id }),
          });
          setMcps((items) =>
            items.map((item) =>
              item.id === mcp.id ? { ...item, status: "off" } : item,
            ),
          );
          setDetail((current) =>
            current?.kind === "mcp" && current.value.id === mcp.id
              ? {
                  ...current,
                  value: { ...current.value, status: "off" },
                }
              : current,
          );
          showToast(`已断开「${mcp.name}」`);
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
          setPreview(null);
          showToast(`已复制「${result.workbench.name}」`);
          window.__pluginmaxShell?.setRoute("workbench-new");
        } catch (cause) {
          showToast(cause.message);
        } finally {
          setBusy(false);
        }
      };

      const openPreview = async (template) => {
        setPreview({
          template,
          panels: [],
          loading: true,
          error: "",
        });
        try {
          const [detailResult, summary] = await Promise.all([
            request(
              `/api/collab/workbench-market/templates/detail?id=${encodeURIComponent(template.id)}&version=${encodeURIComponent(template.version)}`,
            ),
            request(
              `/api/collab/workbench/summary?tzOffset=${-new Date().getTimezoneOffset()}`,
            ),
          ]);
          const templateDetail = detailResult.template ?? template;
          const panelPlan = templateDetail.panels ?? template.panelPlan ?? [];
          const livePanels = new Map();
          await Promise.all(
            panelPlan
              .filter(
                (panel) => PREVIEW_LEGACY_MODULE[panel.pluginId] === undefined,
              )
              .map(async (panel) => {
                try {
                  const result = await request(
                    `/api/collab/workbench-v2/panel?pluginId=${encodeURIComponent(panel.pluginId)}`,
                  );
                  livePanels.set(panel.pluginId, result.panel);
                } catch {
                  livePanels.set(panel.pluginId, null);
                }
              }),
          );
          const panels = panelPlan.map((panel, index) => {
            const moduleId = PREVIEW_LEGACY_MODULE[panel.pluginId];
            const legacyPayload =
              moduleId === undefined ? undefined : summary.modules?.[moduleId];
            return {
              ...panel,
              title:
                panel.title ??
                legacyPayload?.title ??
                livePanels.get(panel.pluginId)?.title ??
                panel.pluginId,
              order: panel.order ?? index,
              payload: legacyPayload ?? livePanels.get(panel.pluginId) ?? null,
            };
          });
          setPreview({
            template: templateDetail,
            panels,
            loading: false,
            error: "",
          });
        } catch (cause) {
          setPreview({
            template,
            panels: [],
            loading: false,
            error: cause.message,
          });
        }
      };

      const openRegister = () => {
        setRegisterForm({
          name: "",
          description: "",
          version: "1.0.0",
          publisherName: currentUserId,
          permissions: "",
        });
        setRegisterManifest(null);
        setRegisterOpen(true);
      };

      const submitCustomResource = async (event) => {
        event.preventDefault();
        if (busy || registerForm.name.trim() === "") return;
        setBusy(true);
        try {
          const result = await request("/api/collab/resources/custom", {
            method: "POST",
            body: JSON.stringify({
              type: currentCustomType,
              name: registerForm.name,
              description: registerForm.description,
              version: registerForm.version,
              ...(registerForm.publisherName.trim() === "" &&
              currentUserId === ""
                ? {}
                : {
                    publisherName:
                      registerForm.publisherName.trim() || currentUserId,
                  }),
              permissions: registerForm.permissions
                .split(/[\n,，]/)
                .map((item) => item.trim())
                .filter(Boolean),
              ...(registerManifest === null
                ? {}
                : { manifest: registerManifest }),
            }),
          });
          setCustomResources((items) => [
            result.resource,
            ...items.filter((item) => item.id !== result.resource.id),
          ]);
          setRegisterOpen(false);
          showToast(`已注册「${result.resource.name}」`);
        } catch (cause) {
          showToast(cause.message);
        } finally {
          setBusy(false);
        }
      };

      const deleteCustomResource = async (resource) => {
        if (busy) return;
        if (!window.confirm(`删除自定义资源「${resource.name}」？`)) return;
        setBusy(true);
        try {
          await request(
            `/api/collab/resources/custom?id=${encodeURIComponent(resource.id)}`,
            { method: "DELETE" },
          );
          setCustomResources((items) =>
            items.filter((item) => item.id !== resource.id),
          );
          setDetail(null);
          showToast(`已删除「${resource.name}」`);
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

      const customCards = customResources.map((item) =>
        item.type === "skill"
          ? h(SkillMarketCard, {
              item,
              custom: true,
              key: item.id,
              actionDisabled: busy,
              onOpen: (resource) =>
                setDetail({ kind: "custom", value: resource }),
              onInstall: (resource) =>
                void openInstallDialog(resource, true),
              onUninstall: (resource) =>
                void openUninstallDialog(resource, true),
            })
          : h(CustomResourceCard, {
              item,
              key: item.id,
              onOpen: (resource) =>
                setDetail({ kind: "custom", value: resource }),
              onAction: (resource) =>
                void openInstallDialog(resource, true),
            }),
      );
      const customSection =
        category === "自定义"
          ? h(
              "div",
              { className: "pmrm-section" },
              h("h3", null, "我的自定义资源"),
              h(
                "p",
                null,
                "仅登记资源元数据和清单，不会执行上传内容，也不会修改 DSH 插件图。",
              ),
              h(
                "div",
                {
                  className:
                    currentCustomType === "skill"
                      ? "pmrm-skill-grid"
                      : "pmrm-list pmrm-custom-grid",
                },
                ...customCards,
                customCards.length === 0
                  ? h(
                      "div",
                      { className: "pmrm-empty" },
                      "还没有自定义资源，点击上方“注册资源”添加。",
                    )
                  : null,
              ),
            )
          : null;

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
          { className: "pmrm-skill-grid" },
          ...skills.map((skill) =>
            h(SkillMarketCard, {
              item: skill,
              key: skill.id,
              actionDisabled: busy,
              onOpen: (item) => setDetail({ kind: "skill", value: item }),
              onInstall: (item) => void openInstallDialog(item, false),
              onUninstall: (item) =>
                void openUninstallDialog(item, false),
            }),
          ),
          skills.length === 0 && !loading && category !== "自定义"
            ? h("div", { className: "pmrm-empty" }, "没有匹配的 Skill")
            : null,
        ),
        customSection,
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
              actionDisabled: busy,
              onAction: (item) =>
                void (item.status === "connected"
                  ? disconnectMcp(item)
                  : connectMcp(item)),
              onOpen: (item) => setDetail({ kind: "mcp", value: item }),
            }),
          ),
          mcps.length === 0 && !loading && category !== "自定义"
            ? h("div", { className: "pmrm-empty" }, "没有匹配的 MCP")
            : null,
        ),
        customSection,
      );

      const templateCards = templates.map((template) =>
        h(
          "article",
          { className: "pmrm-card", key: template.id },
          h(
            "div",
            {
              className: "pmrm-preview",
              style: { "--template-color": template.color },
            },
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
                {
                  className: "pmrm-mark",
                  style: { "--asset-color": template.color },
                },
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
                "div",
                { className: "pmrm-card-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmrm-btn",
                    onClick: () => void openPreview(template),
                  },
                  "预览",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmrm-btn",
                    onClick: () => void openTemplate(template),
                  },
                  "查看方案",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmrm-btn primary",
                    disabled: busy || template.compatibility === "incompatible",
                    onClick: () => void copyTemplate(template),
                  },
                  "应用",
                ),
              ),
            ),
          ),
        ),
      );

      const pluginCards = plugins.map((plugin) =>
        h(
          "article",
          { className: "pmrm-resource", key: plugin.id },
          h(
            "span",
            { className: "pmrm-mark", style: { "--asset-color": "#7057ca" } },
            ICONS.plus,
          ),
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
        category !== "自定义"
          ? h(
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
                    onChange: (event) =>
                      chooseCompatibility(event.target.value),
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
              h(
                "span",
                { className: "pmrm-filter-total" },
                `${pagination.total} 项`,
              ),
            )
          : null,
        assetTab === "templates"
          ? h(
              "div",
              { className: "pmrm-grid" },
              ...templateCards,
              templateCards.length === 0 && !loading && category !== "自定义"
                ? h("div", { className: "pmrm-empty" }, "没有匹配的工作台方案")
                : null,
            )
          : h(
              "div",
              { className: "pmrm-list" },
              ...pluginCards,
              pluginCards.length === 0 && !loading && category !== "自定义"
                ? h("div", { className: "pmrm-empty" }, "没有匹配的功能插件")
                : null,
            ),
        customSection,
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
              : detail.kind === "custom"
                ? "我的资源"
                : detail.kind === "skill"
                  ? "Skill 详情"
                  : "MCP 详情";
      const activeReadOnly =
        activeWorkbench !== null && activeWorkbench.ownerId !== currentUserId;
      let actionLabel = "";
      let actionDisabled = busy;
      let action = () => {};
      if (detail?.kind === "template") {
        actionLabel =
          detail.loading === true
            ? "正在校验依赖…"
            : detail.value.compatibility === "incompatible"
              ? "依赖不可用，暂时无法复制"
              : "应用到我的工作台";
        actionDisabled ||=
          detail.loading === true ||
          detail.error !== undefined ||
          detail.value.compatibility === "incompatible";
        action = () => void copyTemplate(detail.value);
      } else if (detail?.kind === "skill") {
        actionLabel =
          detail.value.status === "enabled" ? "卸载 Skill" : "安装 Skill";
        action = () =>
          void (detail.value.status === "enabled"
            ? openUninstallDialog(detail.value, false)
            : openInstallDialog(detail.value, false));
      } else if (detail?.kind === "mcp") {
        actionLabel =
          detail.value.status === "connected"
            ? "断开连接"
            : detail.value.status === "pending"
              ? "等待治理验证"
              : "连接";
        actionDisabled ||= detail.value.status === "pending";
        action = () =>
          void (detail.value.status === "connected"
            ? disconnectMcp(detail.value)
            : connectMcp(detail.value));
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
      } else if (detail?.kind === "custom") {
        if (detail.value.type === "skill") {
          actionLabel =
            detail.value.status === "enabled" ? "卸载 Skill" : "安装";
          actionDisabled = busy;
          action = () =>
            void (detail.value.status === "enabled"
              ? openUninstallDialog(detail.value, true)
              : openInstallDialog(detail.value, true));
        } else {
          actionLabel = "删除资源";
          actionDisabled = busy;
          action = () => void deleteCustomResource(detail.value);
        }
      }

      const detailBody =
        detail === null
          ? null
          : h(
              react.Fragment,
              null,
              h(
                "div",
                { className: "pmrm-card-title" },
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
                  h(
                    "strong",
                    null,
                    cleanSkillName(detail.value.name),
                  ),
                  h(
                    "p",
                    null,
                    `${detail.kind === "custom" ? detail.value.publisherName : detail.value.publisher.name} · v${detail.value.version}`,
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
                  : detail.kind === "custom"
                    ? [
                        h(
                          "div",
                          { className: "pmrm-fact", key: "type" },
                          h("span", null, "资源类型"),
                          h("strong", null, customTypeLabel(detail.value.type)),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "version" },
                          h("span", null, "版本"),
                          h("strong", null, `v${detail.value.version}`),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "publisher" },
                          h("span", null, "注册人"),
                          h("strong", null, detail.value.publisherName),
                        ),
                        h(
                          "div",
                          { className: "pmrm-fact", key: "source" },
                          h("span", null, "来源"),
                          h("strong", null, "我的资源"),
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
                              assetStatusLabel(
                                detail.kind,
                                detail.value.status,
                              ),
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
                      ...(
                        detail.value.panels ??
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
                              ...(detail.value.dependencies ?? []).map(
                                (dependency) => {
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
                                },
                              ),
                            ),
                    ),
                  )
                : [],
              detail.kind === "mcp" &&
                detail.value.connectionMode === "request_only"
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
                  ...(
                    detail.value.permissions ??
                    detail.value.dataScopes ??
                    []
                  ).map((permission) =>
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

      const previewModal =
        preview === null
          ? null
          : h(
              "div",
              { className: "pmrm-modal-backdrop" },
              h(
                "div",
                {
                  className: "pmrm-modal",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": `${preview.template.name} 预览`,
                },
                h(
                  "div",
                  { className: "pmrm-modal-head" },
                  h(
                    "div",
                    null,
                    h("h2", null, preview.template.name),
                    h("p", null, "基于当前账号可访问的数据生成只读预览。"),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-iconbtn",
                      onClick: () => setPreview(null),
                      "aria-label": "关闭预览",
                    },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-body" },
                  preview.loading === true
                    ? h(
                        "div",
                        { className: "pmrm-empty" },
                        "正在读取当前账号数据…",
                      )
                    : preview.error !== ""
                      ? h("div", { className: "pmrm-error" }, preview.error)
                      : h(
                          "div",
                          { className: "pmrm-preview-canvas" },
                          ...preview.panels.map((panel) => {
                            const rows = previewRows(panel);
                            return h(
                              "article",
                              {
                                className: "pmrm-preview-panel",
                                key: `${panel.pluginId}-${panel.order}`,
                                style: {
                                  "--preview-span": Math.min(
                                    6,
                                    Math.max(1, panel.span ?? 3),
                                  ),
                                },
                              },
                              h(
                                "header",
                                null,
                                h("strong", null, panel.title),
                                h("span", null, `${panel.span ?? 3}/6`),
                              ),
                              rows.length === 0
                                ? h(
                                    "div",
                                    { className: "pmrm-card-meta" },
                                    "当前数据范围内暂无可展示条目",
                                  )
                                : h(
                                    "div",
                                    { className: "pmrm-preview-lines" },
                                    ...rows.map((row, index) =>
                                      h(
                                        "div",
                                        {
                                          className: "pmrm-preview-line",
                                          key: `${panel.pluginId}-${index}`,
                                        },
                                        h("strong", null, row.title),
                                        row.detail
                                          ? h("span", null, row.detail)
                                          : null,
                                      ),
                                    ),
                                  ),
                            );
                          }),
                        ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-btn",
                      onClick: () => setPreview(null),
                    },
                    "关闭",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-btn primary",
                      disabled:
                        busy ||
                        preview.loading === true ||
                        preview.error !== "" ||
                        preview.template.compatibility === "incompatible",
                      onClick: () => void copyTemplate(preview.template),
                    },
                    "应用到我的工作台",
                  ),
                ),
              ),
            );

      const installModal =
        installTarget === null
          ? null
          : h(
              "div",
              {
                className: "pmrm-modal-backdrop",
                onClick: (event) => {
                  if (event.target === event.currentTarget && !busy)
                    setInstallTarget(null);
                },
              },
              h(
                "div",
                {
                  className: "pmrm-modal",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": "安装 Skill",
                },
                h(
                  "div",
                  { className: "pmrm-modal-head" },
                  h(
                    "div",
                    null,
                    h("h2", null, "安装 Skill"),
                    h(
                      "p",
                      null,
                      cleanSkillName(installTarget.skill.name),
                    ),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-iconbtn",
                      disabled: busy,
                      onClick: () => setInstallTarget(null),
                      "aria-label": "关闭安装窗口",
                    },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-body" },
                  installError === ""
                    ? null
                    : h("div", { className: "pmrm-error" }, installError),
                  h(
                    "div",
                    { className: "pmrm-install-summary" },
                    h(
                      "div",
                      null,
                      h("strong", null, "我的 Skill 资源库"),
                      h("span", null, "始终安装到当前账号"),
                    ),
                    h("span", null, "已包含"),
                  ),
                  h(
                    "div",
                    { className: "pmrm-install-toolbar" },
                    h("strong", null, "同时添加到 AI 伙伴（可选）"),
                    h(
                      "div",
                      { className: "pmrm-install-toolbar-actions" },
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pmrm-btn",
                          disabled: installLoading || installAgents.length === 0,
                          onClick: () =>
                            setInstallAgentIds(
                              installAgents.map((agent) => agent.id),
                            ),
                        },
                        "全选",
                      ),
                      h(
                        "button",
                        {
                          type: "button",
                          className: "pmrm-btn",
                          disabled:
                            installLoading || installAgentIds.length === 0,
                          onClick: () => setInstallAgentIds([]),
                        },
                        "清空",
                      ),
                    ),
                  ),
                  installLoading
                    ? h(
                        "div",
                        { className: "pmrm-card-meta" },
                        "正在读取可管理的 AI 伙伴…",
                      )
                    : installAgents.length === 0
                      ? h(
                          "div",
                          { className: "pmrm-panel-row" },
                          h(
                            "span",
                            null,
                            "当前没有可管理的 AI 伙伴，将仅安装到 Skill 资源库。",
                          ),
                        )
                      : h(
                          "div",
                          { className: "pmrm-install-agents" },
                          ...installAgents.map((agent) => {
                            const checked = installAgentIds.includes(agent.id);
                            return h(
                              "label",
                              {
                                key: agent.id,
                                className: `pmrm-install-agent${checked ? " selected" : ""}`,
                              },
                              h("input", {
                                type: "checkbox",
                                checked,
                                onChange: (event) =>
                                  setInstallAgentIds((current) =>
                                    event.target.checked
                                      ? [...new Set([...current, agent.id])]
                                      : current.filter(
                                          (id) => id !== agent.id,
                                        ),
                                  ),
                              }),
                              h(
                                "span",
                                { className: "pmrm-install-agent-copy" },
                                h("strong", null, agent.name),
                                h(
                                  "small",
                                  null,
                                  `${agent.role || "未设置角色"} · ${agent.templateName || agent.templateSource || "AI伙伴"}`,
                                ),
                              ),
                            );
                          }),
                        ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-foot" },
                  h(
                    "span",
                    {
                      className: "pmrm-card-meta",
                      style: { marginRight: "auto" },
                    },
                    installAgentIds.length === 0
                      ? "仅安装到资源库"
                      : `安装到资源库，并添加到 ${String(installAgentIds.length)} 个 AI 伙伴`,
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-btn",
                      disabled: busy,
                      onClick: () => setInstallTarget(null),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-btn primary",
                      disabled: busy || installLoading,
                      onClick: () => void confirmInstall(),
                    },
                    busy
                      ? "安装中…"
                      : installAgentIds.length === 0
                        ? "确认安装"
                        : "安装并添加",
                  ),
                ),
              ),
            );

      const uninstallModal =
        uninstallTarget === null
          ? null
          : h(
              "div",
              {
                className: "pmrm-modal-backdrop",
                onClick: (event) => {
                  if (event.target === event.currentTarget && !busy)
                    setUninstallTarget(null);
                },
              },
              h(
                "div",
                {
                  className: "pmrm-modal",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": "卸载 Skill",
                },
                h(
                  "div",
                  { className: "pmrm-modal-head" },
                  h(
                    "div",
                    null,
                    h("h2", null, "卸载 Skill"),
                    h(
                      "p",
                      null,
                      cleanSkillName(uninstallTarget.skill.name),
                    ),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-iconbtn",
                      disabled: busy,
                      onClick: () => setUninstallTarget(null),
                      "aria-label": "关闭卸载窗口",
                    },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-body" },
                  uninstallError === ""
                    ? null
                    : h("div", { className: "pmrm-error" }, uninstallError),
                  h(
                    "div",
                    { className: "pmrm-custom-note" },
                    "卸载会移除当前账号的 Skill 安装。若该 Skill 正在 AI 伙伴中使用，将先从对应实例移除，再卸载资源库安装。",
                  ),
                  uninstallLoading
                    ? h(
                        "div",
                        { className: "pmrm-card-meta" },
                        "正在检查 AI 伙伴引用…",
                      )
                    : uninstallAgents.length === 0
                      ? h(
                          "div",
                          { className: "pmrm-panel-row" },
                          h("span", null, "当前没有 AI 伙伴使用该 Skill。"),
                        )
                      : h(
                          react.Fragment,
                          null,
                          h(
                            "div",
                            { className: "pmrm-install-toolbar" },
                            h(
                              "strong",
                              null,
                              `将从 ${String(uninstallAgents.length)} 个 AI 伙伴移除`,
                            ),
                          ),
                          h(
                            "div",
                            { className: "pmrm-install-agents" },
                            ...uninstallAgents.map((agent) =>
                              h(
                                "div",
                                {
                                  key: agent.id,
                                  className: "pmrm-install-agent selected",
                                },
                                h(
                                  "span",
                                  { className: "pmrm-install-agent-copy" },
                                  h("strong", null, agent.name),
                                  h(
                                    "small",
                                    null,
                                    `${agent.role || "未设置角色"} · ${agent.templateName || agent.templateSource || "AI伙伴"}`,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-btn",
                      disabled: busy,
                      onClick: () => setUninstallTarget(null),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-btn danger",
                      disabled:
                        busy ||
                        uninstallLoading ||
                        uninstallError !== "",
                      onClick: () => void confirmUninstall(),
                    },
                    busy ? "卸载中…" : "确认卸载",
                  ),
                ),
              ),
            );

      const registerModal =
        registerOpen === false
          ? null
          : h(
              "div",
              { className: "pmrm-modal-backdrop" },
              h(
                "form",
                {
                  className: "pmrm-modal",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": "注册自定义资源",
                  onSubmit: (event) => void submitCustomResource(event),
                },
                h(
                  "div",
                  { className: "pmrm-modal-head" },
                  h(
                    "div",
                    null,
                    h("h2", null, "注册自定义资源"),
                    h(
                      "p",
                      null,
                      `${customTypeLabel(currentCustomType)} · 仅登记元数据与 JSON 清单`,
                    ),
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-iconbtn",
                      onClick: () => setRegisterOpen(false),
                      "aria-label": "关闭注册",
                    },
                    ICONS.close,
                  ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-body" },
                  h(
                    "div",
                    { className: "pmrm-custom-note" },
                    currentCustomType === "skill"
                      ? "Skill 只包含指令、输出约定与触发场景，不执行脚本。上传后安装到当前账号，再由智能体定义或 AI 伙伴实例引用。"
                      : "平台不会执行上传的 JavaScript，也不会修改 DSH Client Modules 图。注册内容用于后续治理审核与资产登记。",
                  ),
                  h(
                    "div",
                    {
                      className: "pmrm-custom-form",
                      style: { marginTop: "12px" },
                    },
                    h(
                      "label",
                      null,
                      "名称",
                      h("input", {
                        required: true,
                        maxLength: 120,
                        value: registerForm.name,
                        onChange: (event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            name: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "label",
                      null,
                      "版本",
                      h("input", {
                        value: registerForm.version,
                        onChange: (event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            version: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "label",
                      null,
                      "注册人",
                      h("input", {
                        value: registerForm.publisherName,
                        onChange: (event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            publisherName: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "label",
                      null,
                      "数据权限",
                      h("input", {
                        placeholder: "多个权限用逗号分隔",
                        value: registerForm.permissions,
                        onChange: (event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            permissions: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "label",
                      { className: "full" },
                      "说明",
                      h("textarea", {
                        maxLength: 1000,
                        value: registerForm.description,
                        onChange: (event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            description: event.target.value,
                          })),
                      }),
                    ),
                    h(
                      "label",
                      { className: "full" },
                      currentCustomType === "skill"
                        ? "上传 Skill ZIP、SKILL.md 或 .skill.json"
                        : "上传 JSON 清单（可选）",
                      h("input", {
                        type: "file",
                        accept:
                          currentCustomType === "skill"
                            ? ".zip,.json,.md,.markdown,application/zip,application/json,text/markdown,text/plain"
                            : "application/json,.json",
                        onChange: async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file === undefined) return;
                          if (file.size > 2 * 1024 * 1024) {
                            showToast("Skill 包 / 清单文件不能超过 2MB");
                            return;
                          }
                          try {
                            const { manifest: parsed, markdown } =
                              await parseSkillFile(file);
                            if (
                              parsed === null ||
                              typeof parsed !== "object" ||
                              Array.isArray(parsed)
                            ) {
                              throw new Error("清单必须是 JSON 对象");
                            }
                            setRegisterManifest(parsed);
                            const heading =
                              markdown === ""
                                ? ""
                                : /^#\s+(.+)$/m
                                    .exec(markdown)?.[1]
                                    ?.trim();
                            if (typeof parsed.name === "string" || heading) {
                              setRegisterForm((current) => ({
                                ...current,
                                name: current.name || parsed.name || heading,
                              }));
                            }
                            if (typeof parsed.description === "string") {
                              setRegisterForm((current) => ({
                                ...current,
                                description:
                                  current.description || parsed.description,
                              }));
                            }
                            if (typeof parsed.version === "string") {
                              setRegisterForm((current) => ({
                                ...current,
                                version: parsed.version,
                              }));
                            }
                            if (
                              typeof parsed.publisherName === "string" &&
                              parsed.publisherName.trim() !== ""
                            ) {
                              setRegisterForm((current) => ({
                                ...current,
                                publisherName: parsed.publisherName,
                              }));
                            }
                            if (Array.isArray(parsed.permissions)) {
                              setRegisterForm((current) => ({
                                ...current,
                                permissions: parsed.permissions
                                  .filter((item) => typeof item === "string")
                                  .join(", "),
                              }));
                            }
                            showToast(`已读取 Skill 文件「${file.name}」`);
                          } catch (cause) {
                            setRegisterManifest(null);
                            showToast(`清单读取失败：${cause.message}`);
                          }
                        },
                      }),
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "pmrm-modal-foot" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmrm-btn",
                      onClick: () => setRegisterOpen(false),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      type: "submit",
                      className: "pmrm-btn primary",
                      disabled: busy || registerForm.name.trim() === "",
                    },
                    busy ? "注册中…" : "注册资源",
                  ),
                ),
              ),
            );

      return h(
        "section",
        {
          className: "pmrm",
          "data-resource-market-page": "true",
          style: { position: "relative" },
        },
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
            {
              className: "pmrm-tabs",
              role: "tablist",
              "aria-label": "资源类型",
            },
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
          h(
            "div",
            { className: "pmrm-global-actions" },
            props?.renderActions?.(),
          ),
        ),
        h(
          "div",
          { className: "pmrm-main" },
          h(
            "main",
            { className: "pmrm-content" },
            h(
              "div",
              { className: "pmrm-content-inner" },
              error !== ""
                ? h("div", { className: "pmrm-error" }, error)
                : null,
              h(
                "div",
                {
                  className: "pmrm-category-strip",
                  "aria-label": "资源类型分类",
                },
                ...RESOURCE_CATEGORIES.map((item) =>
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
                category === "自定义"
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "pmrm-btn primary pmrm-custom-action",
                        onClick: openRegister,
                      },
                      ICONS.plus,
                      "注册资源",
                    )
                  : null,
              ),
              loading
                ? h(
                    "div",
                    {
                      style: {
                        padding: "20px",
                        color: "var(--dsw-alias-label-tertiary)",
                        fontSize: "11px",
                      },
                    },
                    "正在加载…",
                  )
                : content,
            ),
          ),
        ),
        detailView,
        previewModal,
        installModal,
        uninstallModal,
        registerModal,
        toast !== ""
          ? h("div", { className: "pmrm-toast", role: "status" }, toast)
          : null,
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
