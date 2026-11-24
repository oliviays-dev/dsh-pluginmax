window.__ModuleLoader__.load({
  id: "dsh-collab-task-dispatch",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";
    const PRIORITY_LABEL = { P1: "P0", P2: "P1", P3: "P2" };
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

    const styles = `
      .pmd{--pmd-fs-title:12px;--pmd-fs-body:11px;--pmd-fs-helper:10px;--pmd-fs-meta:9.5px;min-width:0;height:auto;min-height:0;display:flex;flex-direction:column;gap:10px;color:var(--dsw-alias-label-primary);font-size:var(--pmd-fs-body);container-type:inline-size;}
      .pmd *{box-sizing:border-box;}
      .pmd-btn{min-height:30px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:var(--pmd-fs-body);font-weight:550;white-space:nowrap;cursor:pointer;}
      .pmd-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);}
      .pmd-btn.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:600;}
      .pmd-btn.active{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 42%,var(--dsw-alias-border-l3));background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmd-btn:disabled{opacity:.45;cursor:not-allowed;}
      .pmd-btn svg{width:13px;height:13px;}
      .pmd-layout{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,32%);gap:10px;align-items:start;}
      .pmd-left{min-width:0;display:flex;flex-direction:column;gap:10px;}
      .pmd-left>.pmd-lanes{flex:1;}
      .pmd-panel{min-width:0;min-height:0;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));overflow:hidden;}
      .pmd-pending{position:sticky;top:0;z-index:30;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 8px 18px rgba(0,0,0,.14);}
      .pmd-pending .pmd-shelf{flex:1;min-height:0;}
      .pmd-pending .pmd-empty{min-height:0;flex:1;padding:16px;}
      .pmd-section-head{flex:none;min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border-bottom:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
      .pmd-section-title{display:flex;align-items:center;gap:6px;font-size:var(--pmd-fs-title);font-weight:650;}
      .pmd-section-title svg{width:14px;height:14px;color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmd-hint{color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-helper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .pmd-head-actions{display:flex;align-items:center;gap:6px;flex:none;}
      .pmd-filter{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);}
      .pmd-filter button{min-height:24px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--pmd-fs-meta);font-weight:600;white-space:nowrap;cursor:pointer;}
      .pmd-filter button:hover{color:var(--dsw-alias-label-primary);}
      .pmd-filter button.active{background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);box-shadow:0 0 0 0.5px var(--dsw-alias-border-l2);}
      .pmd-shelf{display:flex;align-items:stretch;gap:8px;padding:9px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scrollbar-width:thin;}
      .pmd-task{min-width:0;width:240px;flex:0 0 240px;display:grid;gap:7px;padding:10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
      .pmd-task:hover{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);}
      .pmd-task.selected{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,var(--dsw-alias-bg-layer-1));}
      .pmd-task.planned{border-style:dashed;}
      .pmd-task.planned.ready{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9b6d) 58%,var(--dsw-alias-border-l2));box-shadow:inset 3px 0 0 var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-task.planned.risk{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#f0c86a) 58%,var(--dsw-alias-border-l2));box-shadow:inset 3px 0 0 var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-task.planned.blocker{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 58%,var(--dsw-alias-border-l2));box-shadow:inset 3px 0 0 var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-task-top{min-width:0;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px;}
      .pmd-task-id{min-width:0;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-helper);font-weight:500;line-height:1.4;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums;}
      .pmd-task-actions{display:flex;align-items:center;gap:4px;flex:none;}
      .pmd-task-detail{height:22px;padding:0 7px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:var(--pmd-fs-meta);cursor:pointer;}
      .pmd-task-detail:hover{border-color:var(--dsw-alias-border-l4);color:var(--dsw-alias-label-primary);}
      .pmd-task-title{min-width:0;display:block;overflow:hidden;font-size:13px;font-weight:650;line-height:1.35;text-overflow:ellipsis;white-space:nowrap;}
      .pmd-task-desc{display:-webkit-box;margin:0;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-helper);line-height:1.5;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2;}
      .pmd-task-meta{min-width:0;width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-meta);}
      .pmd-task-meta-main{min-width:0;display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
      .pmd-task-meta-main>span{min-width:0;}
      .pmd-pill{display:inline-flex;height:20px;flex:none;align-items:center;padding:0 6px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));font-size:10.5px;line-height:1;white-space:nowrap;}
      .pmd-pill.p1{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmd-lanes{display:flex;flex:1;flex-direction:column;min-height:0;}
      .pmd-lane-list{display:block;}
      .pmd-lane{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:stretch;padding:9px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
      .pmd-lane.drop{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,transparent);}
      .pmd-lane.target{box-shadow:inset 3px 0 0 var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmd-lane.ready{box-shadow:inset 3px 0 0 var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-lane.risk{box-shadow:inset 3px 0 0 var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-lane.blocker{box-shadow:inset 3px 0 0 var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-teammate{display:flex;flex-direction:column;justify-content:space-between;gap:8px;min-width:0;padding-right:8px;border-right:0.5px solid var(--dsw-alias-border-l2);}
      .pmd-teammate-row{display:flex;align-items:center;gap:7px;min-width:0;}
      .pmd-avatar{display:grid;width:28px;height:28px;flex:none;place-items:center;padding:2px;border-radius:50%;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.26),0 0 14px rgba(79,142,247,.12);color:#fff;font-size:8px;font-weight:700;}
      .pmd-avatar.platform{background:#63b8ff;box-shadow:0 0 0 1px rgba(99,184,255,.55);}
      .pmd-avatar.small{width:24px;height:24px;font-size:7px;}
      .pmd-avatar-art{width:100%;height:100%;display:block;overflow:hidden;border:2px solid var(--dsw-alias-bg-layer-1);border-radius:50%;background:#20242a;object-fit:cover;}
      .pmd-human-avatar{display:grid;width:28px;height:28px;flex:none;place-items:center;border-radius:7px;background:#2f9e66;color:#fff;font-size:10px;font-weight:700;}
      .pmd-human-avatar.small{width:24px;height:24px;font-size:9px;}
      .pmd-teammate-copy{display:block;min-width:0;}
      .pmd-teammate-copy strong,.pmd-teammate-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmd-teammate-copy strong{font-size:var(--pmd-fs-body);}
      .pmd-teammate-copy span{color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-meta);}
      .pmd-load{display:flex;gap:5px;flex-wrap:wrap;color:var(--dsw-alias-state-warning-primary,#e2a737);font-size:var(--pmd-fs-meta);font-weight:600;}
      .pmd-teammate-footer{display:grid;gap:4px;margin-top:auto;padding-top:6px;border-top:0.5px solid var(--dsw-alias-border-l2);}
      .pmd-lane-summary{min-width:0;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-meta);line-height:1.4;text-overflow:ellipsis;white-space:nowrap;}
      .pmd-drop-area{display:grid;place-items:center;min-height:62px;padding:8px;border:1px dashed var(--dsw-alias-border-l3);border-radius:6px;color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-helper);text-align:center;}
      .pmd-drop-area.has-plan{border:0;background:transparent;padding:0;min-height:0;color:var(--dsw-alias-label-primary);}
      .pmd-lane-plans{display:flex;align-items:stretch;gap:8px;width:100%;min-width:0;align-self:stretch;overflow-x:auto;overflow-y:hidden;padding-bottom:2px;scrollbar-width:thin;}
      .pmd-lane-plan{position:relative;min-width:0;width:240px;max-width:100%;flex:0 0 240px;display:grid;gap:5px;align-content:start;padding:8px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);text-align:left;cursor:grab;}
      .pmd-lane-plan:active{cursor:grabbing;}
      .pmd-lane-plan.drop-before::before,.pmd-lane-plan.drop-after::after{position:absolute;top:4px;bottom:4px;width:2px;border-radius:2px;background:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 18%,transparent);content:"";pointer-events:none;}
      .pmd-lane-plan.drop-before::before{left:-5px;}
      .pmd-lane-plan.drop-after::after{right:-5px;}
      .pmd-lane-plan.assigned{cursor:grab;}
      .pmd-lane-plan.assigned:active{cursor:grabbing;}
      .pmd-lane-plan.risk{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#f0c86a) 48%,var(--dsw-alias-border-l2));}
      .pmd-lane-plan.blocker{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 48%,var(--dsw-alias-border-l2));}
      .pmd-lane-plan.ready{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9b6d) 48%,var(--dsw-alias-border-l2));}
      .pmd-lane-plan.just-added{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 11%,var(--dsw-alias-bg-layer-1));animation:pmd-focus-card 2.2s ease-out both;}
      .pmd-lane-plan-state{display:inline-flex;height:20px;flex:none;align-items:center;padding:0 6px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1;white-space:nowrap;}
      .pmd-lane-plan-state.todo{background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);}
      .pmd-lane-plan-state.progress{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmd-lane-plan-state.abnormal{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 15%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmd-lane-plan-state.review{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 14%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmd-lane-plan-state.done{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 14%,transparent);color:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmd-lane-plan-state.cancelled{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 14%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmd-running-spinner{width:10px;height:10px;flex:none;display:inline-block;margin-right:4px;border-radius:50%;border:2px solid color-mix(in srgb,currentColor 28%,transparent);border-top-color:currentColor;animation:pmd-spin .8s linear infinite;}
      @keyframes pmd-spin{to{transform:rotate(360deg);}}
      @keyframes pmd-focus-card{0%{box-shadow:inset 3px 0 0 var(--dsw-alias-accent-primary,#4f8ef7),0 0 0 0 color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 38%,transparent);}35%{box-shadow:inset 3px 0 0 var(--dsw-alias-accent-primary,#4f8ef7),0 0 0 4px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 18%,transparent);}100%{box-shadow:inset 3px 0 0 var(--dsw-alias-accent-primary,#4f8ef7),0 0 0 0 transparent;}}
      .pmd-plan-remove{width:20px;height:20px;flex:none;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;line-height:1;cursor:pointer;}
      .pmd-plan-remove:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 10%,transparent);color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-preview{position:sticky;top:0;display:flex;flex-direction:column;min-height:0;height:calc(100dvh - 20px);align-self:start;}
      .pmd-preview-head{flex:none;padding:10px;border-bottom:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
      .pmd-preview-head strong{display:block;font-size:var(--pmd-fs-title);}
      .pmd-preview-body{min-height:0;flex:1;display:flex;flex-direction:column;overflow-y:auto;scrollbar-gutter:stable;}
      .pmd-empty{display:grid;min-height:220px;place-items:center;padding:24px;color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-body);text-align:center;}
      .pmd-block{padding:10px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
      .pmd-block h3{margin:0;font-size:var(--pmd-fs-title);font-weight:650;overflow-wrap:anywhere;}
      .pmd-block p{margin:3px 0 0;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-helper);line-height:1.55;}
      .pmd-context{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px;}
      .pmd-tag{display:inline-flex;min-height:20px;align-items:center;padding:0 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-meta);}
      .pmd-tag.ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9b6d) 12%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-tag.warn{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#f0c86a) 11%,transparent);color:var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-tag.bad{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-candidates{display:grid;gap:7px;padding:9px;}
      .pmd-candidate{display:grid;gap:6px;width:100%;padding:8px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
      .pmd-candidate:hover{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);}
      .pmd-candidate-head{display:flex;align-items:center;gap:7px;min-width:0;}
      .pmd-candidate-copy{min-width:0;flex:1;}
      .pmd-candidate-copy strong,.pmd-candidate-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmd-candidate-copy strong{font-size:var(--pmd-fs-body);}
      .pmd-candidate-copy span{color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-meta);}
      .pmd-score{flex:none;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;}
      .pmd-score.high{color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-score.medium{color:var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-score.low{color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-reason{color:var(--dsw-alias-label-primary);font-size:var(--pmd-fs-helper);font-weight:500;line-height:1.55;}
      .pmd-checks{display:grid;gap:6px;}
      .pmd-check{display:grid;grid-template-columns:16px minmax(0,1fr);gap:6px;align-items:start;}
      .pmd-check-icon{display:grid;width:16px;height:16px;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9b6d) 12%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-check-icon.warn{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#f0c86a) 12%,transparent);color:var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-check-icon.bad{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-check-icon svg{width:9px;height:9px;}
      .pmd-check strong{display:block;font-size:var(--pmd-fs-helper);}
      .pmd-check span{display:block;margin-top:1px;color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-meta);line-height:1.5;}
      .pmd-warning{display:grid;grid-template-columns:16px minmax(0,1fr);gap:6px;padding:8px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-warning-primary,#f0c86a) 34%,transparent);border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#f0c86a) 7%,transparent);color:var(--dsw-alias-state-warning-primary,#f0c86a);font-size:var(--pmd-fs-meta);line-height:1.5;}
      .pmd-warning.bad{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 9%,transparent);color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-warning.info{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmd-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;flex:none;margin-top:auto;padding:10px;border-top:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
      .pmd-batch-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:8px;}
      .pmd-stat{display:grid;gap:1px;padding:6px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1);text-align:center;}
      .pmd-stat strong{font-size:15px;}
      .pmd-stat span{color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-meta);}
      .pmd-stat.blocker strong{color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-stat.risk strong{color:var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-stat.ready strong{color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-batch-list{display:grid;gap:6px;padding:9px;}
      .pmd-batch-item{display:grid;gap:5px;padding:8px;border:0.5px solid var(--dsw-alias-border-l2);border-left-width:3px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);}
      .pmd-batch-item.blocker{border-left-color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-batch-item.risk{border-left-color:var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-batch-item.ready{border-left-color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-batch-head{display:flex;align-items:center;justify-content:space-between;gap:7px;}
      .pmd-batch-head strong{min-width:0;overflow:hidden;font-size:var(--pmd-fs-helper);text-overflow:ellipsis;white-space:nowrap;}
      .pmd-batch-copy{margin:0;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-meta);line-height:1.5;}
      .pmd-suggestion{display:grid;grid-template-columns:14px minmax(0,1fr);gap:6px;align-items:start;padding:6px;border:1px dashed color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 38%,var(--dsw-alias-border-l2));border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 5%,transparent);cursor:pointer;}
      .pmd-suggestion input{margin:1px 0 0;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmd-suggestion strong{display:block;font-size:var(--pmd-fs-meta);}
      .pmd-suggestion span{display:block;margin-top:1px;color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-meta);line-height:1.45;}
      .pmd-no-suggestion{color:var(--dsw-alias-state-success-primary,#2f9b6d);font-size:var(--pmd-fs-meta);}
      .pmd-error,.pmd-notice{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:6px;font-size:10px;}
      .pmd-error>span,.pmd-notice>span{min-width:0;flex:1;overflow-wrap:anywhere;}
      .pmd-status-close{width:18px;height:18px;flex:none;display:grid;place-items:center;margin:-2px -3px 0 0;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;font:inherit;font-size:13px;line-height:1;cursor:pointer;opacity:.78;}
      .pmd-status-close:hover{background:color-mix(in srgb,currentColor 12%,transparent);opacity:1;}
      .pmd-error{border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b50) 7%,transparent);color:var(--dsw-alias-state-error-primary,#d94b50);}
      .pmd-notice{border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9b6d) 42%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9b6d) 7%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmd-confirm-mask{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.5);}
      .pmd-confirm-dialog{width:min(440px,100%);display:grid;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:9px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:0 22px 54px rgba(0,0,0,.32);}
      .pmd-confirm-head{display:flex;align-items:center;gap:8px;}
      .pmd-confirm-head svg{width:16px;height:16px;color:var(--dsw-alias-state-warning-primary,#f0c86a);}
      .pmd-confirm-head h2{margin:0;font-size:14px;font-weight:700;}
      .pmd-confirm-task{display:grid;gap:4px;padding:9px 10px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmd-confirm-task strong{min-width:0;overflow:hidden;font-size:var(--pmd-fs-body);text-overflow:ellipsis;white-space:nowrap;}
      .pmd-confirm-route{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-meta);}
      .pmd-confirm-route span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmd-confirm-section{display:grid;gap:7px;padding-top:11px;border-top:0.5px solid var(--dsw-alias-border-l2);}
      .pmd-confirm-section h3{display:flex;align-items:center;gap:6px;margin:0;color:var(--dsw-alias-label-primary);font-size:var(--pmd-fs-helper);font-weight:650;}
      .pmd-confirm-section h3 svg{width:13px;height:13px;color:var(--dsw-alias-label-secondary);}
      .pmd-confirm-list{display:grid;gap:5px;margin:0;padding:0;list-style:none;}
      .pmd-confirm-list li{position:relative;padding-left:11px;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-meta);line-height:1.55;}
      .pmd-confirm-list li::before{position:absolute;left:0;top:.62em;width:3px;height:3px;border-radius:50%;background:var(--dsw-alias-label-tertiary);content:"";}
      .pmd-confirm-checklist{display:grid;gap:6px;}
      .pmd-confirm-check{display:grid;grid-template-columns:13px minmax(0,1fr);gap:7px;align-items:start;color:var(--dsw-alias-label-secondary);font-size:var(--pmd-fs-meta);line-height:1.5;cursor:pointer;}
      .pmd-confirm-check input{margin:1px 0 0;accent-color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmd-confirm-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:var(--pmd-fs-meta);}
      .pmd-confirm-tools button{padding:0;border:0;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:var(--pmd-fs-meta);font-weight:600;cursor:pointer;}
      .pmd-confirm-actions{display:flex;justify-content:flex-end;gap:7px;}
      @media(max-width:1050px){.pmd-layout{grid-template-columns:1fr;overflow:visible;}.pmd{height:auto;}.pmd-left{overflow:visible;}.pmd-preview{position:static;height:auto;min-height:420px;}}
      @media(max-width:700px){.pmd-lane{grid-template-columns:1fr;}.pmd-teammate{border-right:0;border-bottom:0.5px solid var(--dsw-alias-border-l2);padding-bottom:7px;}}
      @container (max-width:900px){.pmd-layout{grid-template-columns:1fr;overflow:visible;}.pmd-left{overflow:visible;}.pmd-preview{position:static;height:auto;min-height:420px;}}
      @container (max-width:760px){.pmd-lane{grid-template-columns:1fr;}.pmd-teammate{border-right:0;border-bottom:0.5px solid var(--dsw-alias-border-l2);padding-bottom:7px;}.pmd-lane-plans>.pmd-task{width:100%;flex-basis:100%;}}
      @container (max-width:560px){.pmd-task{width:100%;flex-basis:100%;}.pmd-lane-plan{width:100%;flex-basis:100%;}}
    `;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const headers = { "cache-control": "no-store" };
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
      const current = token();
      if (current !== null) headers.authorization = `Bearer ${current}`;
      const response = await fetch(path, {
        method: options.method ?? "GET",
        headers,
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok === false) {
        throw new Error(
          result?.error?.message ?? `请求失败（HTTP ${response.status}）`,
        );
      }
      return result;
    }

    function avatarHairMarkup(preset) {
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

    function avatarArt(value) {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        return h("img", {
          className: "pmd-avatar-art",
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
        ...avatarHairMarkup(preset),
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
          className: "pmd-avatar-art",
          viewBox: "0 0 64 64",
          "aria-hidden": "true",
        },
        children,
      );
    }

    function MemberAvatar({ candidate, small = false }) {
      if (candidate.kind === "human") {
        return h(
          "span",
          {
            className: `pmd-human-avatar${small ? " small" : ""}`,
            role: "img",
            "aria-label": `${candidate.name} 的头像`,
            title: candidate.name,
          },
          initials(candidate.name),
        );
      }
      return h(
        "span",
        {
          className: `pmd-avatar ${candidate.source ?? ""}${small ? " small" : ""}`,
          role: "img",
          "aria-label": `${candidate.name} 的头像`,
          title: candidate.name,
        },
        avatarArt(candidate.avatar),
      );
    }

    function priorityLabel(priority) {
      return PRIORITY_LABEL[priority] ?? priority;
    }

    const ACTIVE_TASK_STATUSES = new Set([
      "todo",
      "progress",
      "abnormal",
      "review",
    ]);
    const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2 };

    function taskStatusLabel(status) {
      return (
        {
          todo: "待处理",
          progress: "进行中",
          abnormal: "异常",
          review: "待验收",
        }[status] ?? status
      );
    }

    function compareActiveTasks(left, right) {
      const leftSeq = left.queueSeq;
      const rightSeq = right.queueSeq;
      if (leftSeq !== undefined && rightSeq !== undefined) {
        return leftSeq - rightSeq;
      }
      if (leftSeq !== undefined) return -1;
      if (rightSeq !== undefined) return 1;
      return (
        (PRIORITY_RANK[left.priority] ?? 9) -
          (PRIORITY_RANK[right.priority] ?? 9) ||
        String(left.due ?? "9999-99-99").localeCompare(
          String(right.due ?? "9999-99-99"),
        ) ||
        String(left.id).localeCompare(String(right.id))
      );
    }

    function taskBelongsToAssignee(task, assignee) {
      if (task.receiverId === undefined) return false;
      if (task.receiverType === "human") {
        return (
          assignee.kind === "human" && task.receiverId === assignee.teammateId
        );
      }
      if (task.receiverType === "agent") {
        return (
          assignee.kind === "agent" &&
          (task.receiverId === assignee.teammateId ||
            task.receiverId === assignee.employeeId)
        );
      }
      if (task.receiverType === "role") {
        return (assignee.roleSeatIds ?? []).includes(task.receiverId);
      }
      return false;
    }

    function statusLabel(status) {
      return status === "ready"
        ? "可派发"
        : status === "risk"
          ? "有风险"
          : "阻断";
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

    function createdAtLabel(value) {
      const date = new Date(String(value ?? ""));
      if (Number.isNaN(date.getTime())) return "—";
      const parts = new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const part = (type) =>
        parts.find((item) => item.type === type)?.value ?? "";
      return `${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
    }

    function dueLabel(value) {
      if (typeof value !== "string" || value.trim() === "") return "不限";
      const match = value.match(/^\d{4}-(\d{2})-(\d{2})/u);
      return match === null ? value : `${match[1]}-${match[2]}`;
    }

    function suggestionFor(item) {
      const candidate = item.candidate;
      if (candidate.status === "ready") return null;
      if (item.alternatives.length > 0) {
        const target = item.alternatives[0];
        return {
          kind: "reroute",
          teammateId: target.teammateId,
          label: `改派到「${target.name}」`,
          detail: `综合分 ${target.score}，待启动 ${target.signals.planned}，运行中 ${target.signals.running}。`,
        };
      }
      return {
        kind: "remove",
        label: "移出派发方案",
        detail:
          candidate.blockers[0] ??
          candidate.risks[0] ??
          "当前项目内没有满足约束的候选成员。",
      };
    }

    function TaskDispatchView(props) {
      const tasks = Array.isArray(props.tasks) ? props.tasks : [];
      const workspaces = Array.isArray(props.workspaces)
        ? props.workspaces
        : [];
      const workspaceId = props.workspaceFilter || "";
      const workspaceIds = react.useMemo(
        () =>
          workspaceId === ""
            ? workspaces.map((workspace) => workspace.id)
            : [workspaceId],
        [workspaceId, workspaces],
      );
      const eligibleTasks = react.useMemo(
        () =>
          tasks.filter(
            (task) =>
              workspaceIds.includes(task.workspaceId) &&
              task.status === "todo" &&
              task.archivedAt === undefined &&
              task.workflow === undefined &&
              task.receiverType === "unassigned",
          ),
        [tasks, workspaceIds],
      );
      const [selectedTaskId, setSelectedTaskId] = react.useState("");
      const [candidates, setCandidates] = react.useState([]);
      const [assignees, setAssignees] = react.useState([]);
      const [assigneeFilter, setAssigneeFilter] = react.useState("all");
      const [assigneesLoading, setAssigneesLoading] = react.useState(false);
      const [selectedTeammateId, setSelectedTeammateId] = react.useState("");
      const [mode, setMode] = react.useState("recommend");
      const [drafts, setDrafts] = react.useState([]);
      const [pendingDispatchIds, setPendingDispatchIds] = react.useState([]);
      const [dispatchSelectionIds, setDispatchSelectionIds] = react.useState(
        [],
      );
      const [laneDropTarget, setLaneDropTarget] = react.useState(null);
      const [focusedLaneTask, setFocusedLaneTask] = react.useState(null);
      const [batch, setBatch] = react.useState(null);
      const [suggestionIds, setSuggestionIds] = react.useState([]);
      const [busy, setBusy] = react.useState(false);
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [commitResults, setCommitResults] = react.useState(null);
      const [pendingReceiverChange, setPendingReceiverChange] =
        react.useState(null);
      const [reassignChecks, setReassignChecks] = react.useState({
        pause: false,
        context: false,
        notify: false,
      });
      const modeRef = react.useRef(mode);
      modeRef.current = mode;
      const laneElementRefs = react.useRef(new Map());
      const laneCardRefs = react.useRef(new Map());
      const refreshedTokenRef = react.useRef(0);
      const validationIntentRef = react.useRef(null);

      react.useEffect(() => {
        if (notice === "") return undefined;
        const timer = window.setTimeout(() => setNotice(""), 3000);
        return () => window.clearTimeout(timer);
      }, [notice]);

      react.useEffect(() => {
        if (focusedLaneTask === null) return undefined;
        const timer = window.setTimeout(() => setFocusedLaneTask(null), 2200);
        return () => window.clearTimeout(timer);
      }, [focusedLaneTask]);

      react.useLayoutEffect(() => {
        if (focusedLaneTask === null) return undefined;
        const laneElement = laneElementRefs.current.get(
          focusedLaneTask.teammateId,
        );
        const cardElement = laneCardRefs.current.get(focusedLaneTask.taskId);
        if (laneElement === undefined || cardElement === undefined) {
          return undefined;
        }
        const frame = window.requestAnimationFrame(() => {
          laneElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
          const plans = cardElement.closest(".pmd-lane-plans");
          if (plans instanceof HTMLElement) {
            const plansRect = plans.getBoundingClientRect();
            const cardRect = cardElement.getBoundingClientRect();
            const targetLeft =
              plans.scrollLeft +
              cardRect.left -
              plansRect.left -
              (plans.clientWidth - cardRect.width) / 2;
            plans.scrollTo({
              left: Math.max(0, targetLeft),
              behavior: "smooth",
            });
          }
        });
        return () => window.cancelAnimationFrame(frame);
      }, [focusedLaneTask]);

      react.useEffect(() => {
        setSelectedTaskId("");
        setCandidates([]);
        setAssignees([]);
        setSelectedTeammateId("");
        setMode("recommend");
        setDrafts([]);
        setPendingDispatchIds([]);
        setDispatchSelectionIds([]);
        setLaneDropTarget(null);
        setFocusedLaneTask(null);
        setBatch(null);
        setSuggestionIds([]);
        setCommitResults(null);
        setPendingReceiverChange(null);
        setReassignChecks({ pause: false, context: false, notify: false });
      }, [workspaceId]);

      react.useEffect(() => {
        if (eligibleTasks.length === 0) {
          setSelectedTaskId("");
          setCandidates([]);
          setSelectedTeammateId("");
          setMode("recommend");
          return;
        }
        if (!eligibleTasks.some((task) => task.id === selectedTaskId)) {
          setSelectedTaskId(eligibleTasks[0].id);
        }
      }, [eligibleTasks, selectedTaskId]);

      const loadAssignees = react.useCallback(async () => {
        if (workspaceIds.length === 0) return null;
        setAssigneesLoading(true);
        try {
          const results = await Promise.all(
            workspaceIds.map((targetWorkspaceId) =>
              request("/api/collab/tasks/dispatch/assignees", {
                method: "POST",
                body: { workspaceId: targetWorkspaceId },
              }),
            ),
          );
          const merged = new Map();
          for (const result of results) {
            for (const assignee of result.assignees ?? []) {
              merged.set(`${assignee.kind}:${assignee.teammateId}`, assignee);
            }
          }
          const next = [...merged.values()].sort((left, right) => {
            const leftGroup =
              left.roleGroup?.trim() ||
              left.role.split("/")[0]?.trim() ||
              "未分组角色";
            const rightGroup =
              right.roleGroup?.trim() ||
              right.role.split("/")[0]?.trim() ||
              "未分组角色";
            return (
              leftGroup.localeCompare(rightGroup, "zh-Hans-CN") ||
              (left.kind === right.kind ? 0 : left.kind === "human" ? -1 : 1) ||
              left.name.localeCompare(right.name, "zh-Hans-CN")
            );
          });
          setAssignees(next);
          return { assignees: next };
        } catch (cause) {
          setAssignees([]);
          setError(cause instanceof Error ? cause.message : "读取承接成员失败");
          return null;
        } finally {
          setAssigneesLoading(false);
        }
      }, [workspaceIds]);

      react.useEffect(() => {
        void loadAssignees();
      }, [loadAssignees]);

      const loadCandidates = react.useCallback(
        async (taskId) => {
          if (taskId === "") return null;
          const task = tasks.find((item) => item.id === taskId);
          const targetWorkspaceId = task?.workspaceId ?? workspaceId;
          if (targetWorkspaceId === "") return null;
          setBusy(true);
          setError("");
          try {
            const result = await request(
              "/api/collab/tasks/dispatch/candidates",
              {
                method: "POST",
                body: { workspaceId: targetWorkspaceId, taskId },
              },
            );
            setCandidates(result.candidates ?? []);
            if (Array.isArray(result.assignees)) {
              setAssignees(result.assignees);
            }
            return result;
          } catch (cause) {
            setCandidates([]);
            setError(
              cause instanceof Error ? cause.message : "读取承接建议失败",
            );
            return null;
          } finally {
            setBusy(false);
          }
        },
        [tasks, workspaceId],
      );

      react.useEffect(() => {
        if (selectedTaskId === "") return;
        // Background task refreshes must not pull the user out of a confirmation view.
        if (modeRef.current === "dispatch" || modeRef.current === "batch") {
          return;
        }
        const pendingTask = eligibleTasks.some(
          (task) => task.id === selectedTaskId,
        );
        if (!pendingTask) {
          setCandidates([]);
          return;
        }
        const intent = validationIntentRef.current;
        if (intent?.taskId === selectedTaskId) {
          validationIntentRef.current = null;
          setSelectedTeammateId(intent.teammateId);
          setMode("validation");
        } else {
          setSelectedTeammateId("");
          setMode("recommend");
        }
        void loadCandidates(selectedTaskId);
      }, [selectedTaskId, loadCandidates]);

      const selectedTask =
        tasks.find(
          (task) =>
            workspaceIds.includes(task.workspaceId) &&
            task.id === selectedTaskId,
        ) ?? null;
      const selectedTaskIsPending =
        selectedTask !== null &&
        eligibleTasks.some((task) => task.id === selectedTask.id);
      const selectedCandidate =
        candidates.find(
          (candidate) => candidate.teammateId === selectedTeammateId,
        ) ??
        assignees.find(
          (candidate) => candidate.teammateId === selectedTeammateId,
        ) ??
        null;
      const matchesAssigneeFilter = (candidate) =>
        assigneeFilter === "all" || candidate.kind === assigneeFilter;
      const filteredCandidates = candidates.filter(matchesAssigneeFilter);
      const filteredAssignees = assignees.filter(matchesAssigneeFilter);
      const activeWorkspaceTasks = tasks.filter(
        (task) =>
          workspaceIds.includes(task.workspaceId) &&
          ACTIVE_TASK_STATUSES.has(task.status) &&
          task.archivedAt === undefined &&
          task.deletedAt === undefined,
      );
      const assignedTasksFor = (assignee) =>
        activeWorkspaceTasks
          .filter((task) => taskBelongsToAssignee(task, assignee))
          .sort(compareActiveTasks);
      const inspectAssignedTask = (task, candidate) => {
        setSelectedTaskId(task.id);
        setSelectedTeammateId(candidate.teammateId);
        setCandidates([]);
        setBatch(null);
        setMode("validation");
      };
      const laneDropTargetAt = (laneElement, candidate, clientX) => {
        const plans = laneElement.querySelector(".pmd-lane-plans");
        if (!(plans instanceof HTMLElement)) return null;
        const plansRect = plans.getBoundingClientRect();
        const edgeTolerance = 8;
        if (
          clientX < plansRect.left - edgeTolerance ||
          clientX > plansRect.right + edgeTolerance
        ) {
          return null;
        }
        let closest = null;
        for (const card of plans.querySelectorAll("[data-lane-task-id]")) {
          const targetTaskId = card.getAttribute("data-lane-task-id");
          if (targetTaskId === null) continue;
          const rect = card.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const distance = Math.abs(clientX - center);
          if (closest === null || distance < closest.distance) {
            closest = { targetTaskId, center, distance };
          }
        }
        if (closest === null) return null;
        return {
          assigneeId: candidate.teammateId,
          targetTaskId: closest.targetTaskId,
          after: clientX >= closest.center,
        };
      };
      const handleLaneDragOver = (event, candidate) => {
        event.preventDefault();
        event.currentTarget.classList.add("drop");
        setLaneDropTarget(
          laneDropTargetAt(event.currentTarget, candidate, event.clientX),
        );
      };
      const handleLaneCardDragOver = (event, candidate, targetTaskId) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setLaneDropTarget({
          assigneeId: candidate.teammateId,
          targetTaskId,
          after: event.clientX >= rect.left + rect.width / 2,
        });
      };
      const reorderLaneItem = async (
        draggedTaskId,
        candidate,
        targetTaskId,
        after,
      ) => {
        const laneTasks = assignedTasksFor(candidate);
        const draggedIndex = laneTasks.findIndex(
          (task) => task.id === draggedTaskId,
        );
        const targetIndex = laneTasks.findIndex(
          (task) => task.id === targetTaskId,
        );
        if (draggedIndex >= 0 && targetIndex >= 0) {
          const next = laneTasks.filter((task) => task.id !== draggedTaskId);
          const nextTargetIndex = next.findIndex(
            (task) => task.id === targetTaskId,
          );
          next.splice(
            nextTargetIndex + (after ? 1 : 0),
            0,
            laneTasks[draggedIndex],
          );
          const taskIds = next.map((task) => task.id);
          setBusy(true);
          setError("");
          try {
            await request("/api/collab/tasks/queue/reorder", {
              method: "POST",
              body: {
                workspaceId: laneTasks[0].workspaceId,
                orderedTaskIds: taskIds,
              },
            });
            setNotice("队列顺序已更新");
            await props.onTasksChanged?.();
            await loadAssignees();
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "调整队列顺序失败",
            );
          } finally {
            setBusy(false);
          }
          return true;
        }
        const draggedDraft = drafts.find(
          (draft) => draft.taskId === draggedTaskId,
        );
        const targetDraft = drafts.find(
          (draft) => draft.taskId === targetTaskId,
        );
        if (
          draggedDraft !== undefined &&
          targetDraft !== undefined &&
          draggedDraft.teammateId === candidate.teammateId &&
          targetDraft.teammateId === candidate.teammateId
        ) {
          const laneDrafts = drafts.filter(
            (draft) => draft.teammateId === candidate.teammateId,
          );
          const next = laneDrafts.filter(
            (draft) => draft.taskId !== draggedTaskId,
          );
          const nextTargetIndex = next.findIndex(
            (draft) => draft.taskId === targetTaskId,
          );
          next.splice(nextTargetIndex + (after ? 1 : 0), 0, draggedDraft);
          setDrafts([
            ...drafts.filter(
              (draft) => draft.teammateId !== candidate.teammateId,
            ),
            ...next,
          ]);
          return true;
        }
        return false;
      };
      const handleLaneCardDrop = async (event, candidate, targetTaskId) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const after = event.clientX >= rect.left + rect.width / 2;
        setLaneDropTarget(null);
        const draggedTaskId = event.dataTransfer?.getData("text/plain") ?? "";
        if (draggedTaskId === "" || draggedTaskId === targetTaskId) return;
        if (
          await reorderLaneItem(draggedTaskId, candidate, targetTaskId, after)
        ) {
          return;
        }
        const assignedTask = activeWorkspaceTasks.find(
          (task) => task.id === draggedTaskId,
        );
        if (assignedTask !== undefined) {
          reassignAssignedTask(assignedTask, candidate);
          return;
        }
        assignToLane(draggedTaskId, candidate.teammateId);
      };
      const handleLaneDrop = async (event, candidate) => {
        event.preventDefault();
        event.currentTarget.classList.remove("drop");
        setLaneDropTarget(null);
        const draggedTaskId = event.dataTransfer?.getData("text/plain") ?? "";
        if (draggedTaskId === "") return;
        const target = laneDropTargetAt(
          event.currentTarget,
          candidate,
          event.clientX,
        );
        if (
          target !== null &&
          (await reorderLaneItem(
            draggedTaskId,
            candidate,
            target.targetTaskId,
            target.after,
          ))
        ) {
          return;
        }
        const assignedTask = activeWorkspaceTasks.find(
          (task) => task.id === draggedTaskId,
        );
        if (assignedTask !== undefined) {
          reassignAssignedTask(assignedTask, candidate);
          return;
        }
        assignToLane(draggedTaskId, candidate.teammateId);
      };
      const draftOf = (taskId) =>
        drafts.find((draft) => draft.taskId === taskId) ?? null;
      const pendingDispatchTasks = tasks.filter(
        (task) =>
          workspaceIds.includes(task.workspaceId) &&
          pendingDispatchIds.includes(task.id) &&
          task.status === "todo" &&
          task.receiverType !== "unassigned",
      );
      const allDispatchTasksSelected =
        pendingDispatchTasks.length > 0 &&
        pendingDispatchTasks.every((task) =>
          dispatchSelectionIds.includes(task.id),
        );

      react.useEffect(() => {
        const validIds = new Set(pendingDispatchTasks.map((task) => task.id));
        setPendingDispatchIds((current) => {
          const next = current.filter((taskId) => validIds.has(taskId));
          return next.length === current.length ? current : next;
        });
        setDispatchSelectionIds((current) =>
          current.filter((taskId) => validIds.has(taskId)),
        );
      }, [tasks, workspaceId]);

      const openDispatchQueue = () => {
        if (pendingDispatchTasks.length === 0) return;
        setDispatchSelectionIds(pendingDispatchTasks.map((task) => task.id));
        setMode("dispatch");
      };

      const confirmDispatch = async () => {
        const selected = pendingDispatchTasks.filter((task) =>
          dispatchSelectionIds.includes(task.id),
        );
        if (selected.length === 0 || busy) return;
        const allPendingDispatched =
          selected.length === pendingDispatchTasks.length;
        setBusy(true);
        setError("");
        let aiStarted = 0;
        let humanPending = 0;
        try {
          for (const task of selected) {
            if (task.receiverType !== "agent") {
              humanPending += 1;
              continue;
            }
            await request("/api/collab/tasks/dispatch/execute", {
              method: "POST",
              body: { taskId: task.id },
            });
            aiStarted += 1;
          }
          const selectedIds = new Set(selected.map((task) => task.id));
          setPendingDispatchIds((current) =>
            current.filter((taskId) => !selectedIds.has(taskId)),
          );
          setDispatchSelectionIds((current) =>
            current.filter((taskId) => !selectedIds.has(taskId)),
          );
          setNotice(
            `已确认派发 ${selected.length} 项：${aiStarted} 项 AI 执行已启动，${humanPending} 项等待人工处理`,
          );
          await props.onTasksChanged?.();
          await loadAssignees();
          if (allPendingDispatched) {
            setMode("recommend");
            setSelectedTaskId("");
            setSelectedTeammateId("");
            setCandidates([]);
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "确认派发失败");
        } finally {
          setBusy(false);
        }
      };

      const draftsByWorkspace = (items) => {
        const groups = new Map();
        for (const item of items) {
          const task = tasks.find((candidate) => candidate.id === item.taskId);
          if (task === undefined) continue;
          const current = groups.get(task.workspaceId) ?? [];
          current.push(item);
          groups.set(task.workspaceId, current);
        }
        return groups;
      };

      const validateDrafts = async (nextDrafts = drafts) => {
        if (nextDrafts.length === 0) {
          setBatch(null);
          setMode("recommend");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const results = await Promise.all(
            [...draftsByWorkspace(nextDrafts)].map(
              ([targetWorkspaceId, items]) =>
                request("/api/collab/tasks/dispatch/validate", {
                  method: "POST",
                  body: { workspaceId: targetWorkspaceId, items },
                }),
            ),
          );
          setBatch({
            summary: results.reduce(
              (summary, result) => ({
                total: summary.total + result.summary.total,
                blockers: summary.blockers + result.summary.blockers,
                risks: summary.risks + result.summary.risks,
                ready: summary.ready + result.summary.ready,
              }),
              { total: 0, blockers: 0, risks: 0, ready: 0 },
            ),
            items: results.flatMap((result) => result.items),
          });
          setSuggestionIds([]);
          setMode("batch");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "批量校验失败");
        } finally {
          setBusy(false);
        }
      };

      const selectTask = (taskId) => {
        if (taskId === selectedTaskId) return;
        validationIntentRef.current = null;
        setSelectedTaskId(taskId);
        setBatch(null);
      };

      const assignToLane = (taskId, teammateId) => {
        if (taskId === "" || teammateId === "") return;
        setDrafts((current) => [
          ...current.filter((draft) => draft.taskId !== taskId),
          { taskId, teammateId },
        ]);
        setBatch(null);
        setCommitResults(null);
        validationIntentRef.current = { taskId, teammateId };
        if (selectedTaskId !== taskId) {
          setSelectedTaskId(taskId);
          return;
        }
        validationIntentRef.current = null;
        setSelectedTeammateId(teammateId);
        setMode("validation");
      };

      const chooseCandidate = (candidate) => {
        if (!selectedTask || !candidate) return;
        setDrafts((current) => [
          ...current.filter((draft) => draft.taskId !== selectedTask.id),
          {
            taskId: selectedTask.id,
            teammateId: candidate.teammateId,
          },
        ]);
        setBatch(null);
        setCommitResults(null);
        setMode("recommend");
        setFocusedLaneTask({
          taskId: selectedTask.id,
          teammateId: candidate.teammateId,
        });
        setNotice(`${selectedTask.title} 已排入 ${candidate.name} 的甬道`);
      };

      const removeDraft = (taskId) => {
        setDrafts((current) =>
          current.filter((draft) => draft.taskId !== taskId),
        );
        setSuggestionIds((current) =>
          current.filter((item) => item !== taskId),
        );
        setBatch(null);
        setCommitResults(null);
        if (selectedTaskId === taskId) {
          setSelectedTeammateId("");
          setMode("recommend");
        }
      };

      const executeAssignedTaskReceiverChange = async ({
        task,
        receiverType,
        receiverId,
        receiverName,
        message,
      }) => {
        if (task === undefined || busy) return;
        setBusy(true);
        setError("");
        try {
          await request("/api/collab/tasks/dispatch/reassign", {
            method: "POST",
            body: {
              workspaceId: task.workspaceId,
              taskId: task.id,
              receiverType,
              ...(receiverId === undefined ? {} : { receiverId }),
              ...(receiverName === undefined ? {} : { receiverName }),
            },
          });
          setPendingDispatchIds((current) =>
            receiverType === "unassigned"
              ? current.filter((taskId) => taskId !== task.id)
              : [...new Set([...current, task.id])],
          );
          setNotice(message);
          await props.onTasksChanged?.();
          await loadAssignees();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "调整负责人失败");
        } finally {
          setBusy(false);
        }
      };

      const changeAssignedTaskReceiver = (change) => {
        if (change === undefined || change.task === undefined || busy) {
          return;
        }
        if (
          change.task.status === "progress" ||
          change.task.status === "abnormal"
        ) {
          setReassignChecks({ pause: false, context: false, notify: false });
          setPendingReceiverChange(change);
          return;
        }
        void executeAssignedTaskReceiverChange(change);
      };

      const confirmReceiverChange = () => {
        const change = pendingReceiverChange;
        setPendingReceiverChange(null);
        if (change !== null) void executeAssignedTaskReceiverChange(change);
      };

      const reassignAssignedTask = (task, candidate) => {
        if (task === undefined || candidate === undefined) return;
        if (taskBelongsToAssignee(task, candidate)) return;
        changeAssignedTaskReceiver({
          task,
          receiverType: candidate.kind,
          receiverId: candidate.teammateId,
          receiverName: candidate.name,
          message: `${task.title} 已改派给 ${candidate.name}`,
        });
      };

      const unassignAssignedTask = (task) => {
        if (task === undefined) return;
        changeAssignedTaskReceiver({
          task,
          receiverType: "unassigned",
          message: `${task.title} 已移出甬道，恢复为待指派`,
        });
      };

      const stageDraft = () => {
        if (!selectedTask || !selectedCandidate) return;
        assignToLane(selectedTask.id, selectedCandidate.teammateId);
        setNotice(
          `${selectedTask.title} 已加入 ${selectedCandidate.name} 的派发方案`,
        );
        setCommitResults(null);
      };

      const applySuggestions = async () => {
        if (!batch || suggestionIds.length === 0) return;
        let nextDrafts = [...drafts];
        for (const item of batch.items) {
          if (!suggestionIds.includes(item.task.id)) continue;
          const suggestion = suggestionFor(item);
          if (suggestion === null) continue;
          if (suggestion.kind === "remove") {
            nextDrafts = nextDrafts.filter(
              (draft) => draft.taskId !== item.task.id,
            );
          } else {
            nextDrafts = nextDrafts.map((draft) =>
              draft.taskId === item.task.id
                ? { ...draft, teammateId: suggestion.teammateId }
                : draft,
            );
          }
        }
        setDrafts(nextDrafts);
        setNotice(`已应用 ${suggestionIds.length} 项调整建议`);
        await validateDrafts(nextDrafts);
      };

      const commitPlan = async () => {
        if (!batch || batch.summary.blockers > 0 || drafts.length === 0) return;
        setBusy(true);
        setError("");
        setCommitResults(null);
        try {
          const results = await Promise.all(
            [...draftsByWorkspace(drafts)].map(([targetWorkspaceId, items]) =>
              request("/api/collab/tasks/dispatch/commit", {
                method: "POST",
                body: { workspaceId: targetWorkspaceId, items },
              }),
            ),
          );
          const result = {
            queued: results.reduce((sum, item) => sum + item.queued, 0),
            failed: results.reduce((sum, item) => sum + item.failed, 0),
            results: results.flatMap((item) => item.results),
          };
          setCommitResults(result);
          setNotice(
            result.failed > 0
              ? `已入队 ${result.queued} 项，${result.failed} 项失败`
              : `已入队 ${result.queued} 项任务`,
          );
          if (result.failed === 0) {
            setDrafts([]);
            setBatch(null);
            setSuggestionIds([]);
            setMode("recommend");
            setCandidates([]);
            setSelectedTeammateId("");
          }
          await props.onTasksChanged?.();
          await loadAssignees();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "批量入队失败");
        } finally {
          setBusy(false);
        }
      };

      const refresh = react.useCallback(async () => {
        await props.onTasksChanged?.();
        await loadAssignees();
        if (selectedTaskId !== "") await loadCandidates(selectedTaskId);
      }, [loadAssignees, loadCandidates, props.onTasksChanged, selectedTaskId]);

      react.useEffect(() => {
        const nextToken = props.refreshToken ?? 0;
        if (nextToken <= refreshedTokenRef.current) return;
        refreshedTokenRef.current = nextToken;
        void refresh();
      }, [props.refreshToken, refresh]);

      react.useEffect(() => {
        globalThis.lucide?.createIcons?.({ attrs: { width: 14, height: 14 } });
      });

      const detailButton = (task) =>
        h(
          "button",
          {
            className: "pmd-task-detail",
            type: "button",
            draggable: false,
            "aria-label": `查看任务详情：${task.title}`,
            onClick: (event) => {
              event.stopPropagation();
              props.onOpenTask?.(task.id);
            },
          },
          "详情",
        );

      const taskCardContent = (
        task,
        statusNode = null,
        actions = null,
        order = null,
      ) => {
        const description =
          typeof task.description === "string" ? task.description.trim() : "";
        return [
          h(
            "span",
            { className: "pmd-task-top", key: "top" },
            h(
              "span",
              { className: "pmd-task-id" },
              order === null ? task.id : `${order}. ${task.id}`,
            ),
            actions === null
              ? null
              : h("span", { className: "pmd-task-actions" }, actions),
          ),
          h(
            "div",
            { className: "pmd-task-title", key: "title", title: task.title },
            task.title,
          ),
          description === ""
            ? null
            : h(
                "p",
                {
                  className: "pmd-task-desc",
                  key: "description",
                  title: description,
                },
                description,
              ),
          h(
            "span",
            { className: "pmd-task-meta", key: "meta" },
            h(
              "span",
              { className: "pmd-task-meta-main" },
              h(
                "span",
                {
                  className: `pmd-pill${task.priority === "P1" ? " p1" : ""}`,
                },
                priorityLabel(task.priority),
              ),
              h("span", null, `创建人：${task.createdByName || "未知"}`),
              h("span", null, dueLabel(task.due)),
            ),
            statusNode,
          ),
        ].filter((item) => item !== null);
      };

      const taskCard = (task) => {
        const draft = draftOf(task.id);
        const candidate = draft
          ? candidates.find((item) => item.teammateId === draft.teammateId)
          : null;
        const batchItem = batch?.items.find((item) => item.task.id === task.id);
        const state = batchItem?.candidate.status ?? candidate?.status;
        return h(
          "div",
          {
            key: task.id,
            "data-task-id": task.id,
            draggable: true,
            role: "button",
            tabIndex: 0,
            title: task.description || task.title,
            className: `pmd-task${selectedTaskId === task.id ? " selected" : ""}${state ? ` planned ${state}` : ""}`,
            onClick: () => selectTask(task.id),
            onKeyDown: (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              selectTask(task.id);
            },
            onDragStart: (event) => {
              event.dataTransfer?.setData("text/plain", task.id);
              event.dataTransfer.effectAllowed = "move";
            },
          },
          ...taskCardContent(task, null, detailButton(task)),
        );
      };

      const lane = (candidate) => {
        const laneDrafts = drafts.filter(
          (draft) => draft.teammateId === candidate.teammateId,
        );
        const assignedTasks = assignedTasksFor(candidate);
        const laneTaskMap = new Map(
          [
            ...assignedTasks,
            ...laneDrafts
              .map((draft) =>
                eligibleTasks.find((task) => task.id === draft.taskId),
              )
              .filter((task) => task !== undefined),
          ].map((task) => [task.id, task]),
        );
        const laneTasks = [...laneTaskMap.values()];
        const laneStatusCounts = laneTasks.reduce(
          (counts, task) => ({
            ...counts,
            [task.status]: (counts[task.status] ?? 0) + 1,
          }),
          {},
        );
        const laneSummary = [
          `总计 ${laneTasks.length}`,
          ...["todo", "progress", "review", "abnormal"]
            .filter((status) => (laneStatusCounts[status] ?? 0) > 0)
            .map(
              (status) =>
                `${taskStatusLabel(status)} ${laneStatusCounts[status]}`,
            ),
        ].join(" · ");
        const hasLaneContent =
          assignedTasks.length > 0 || laneDrafts.length > 0;
        const queueAlerts = [
          ...(candidate.signals.blocked > 0
            ? [`阻塞 ${candidate.signals.blocked}`]
            : []),
          ...(candidate.signals.needsInput > 0
            ? [`待补充 ${candidate.signals.needsInput}`]
            : []),
        ];
        const laneItems =
          batch?.items.filter(
            (item) => item.teammateId === candidate.teammateId,
          ) ?? [];
        const laneStatus = laneItems.some(
          (item) => item.candidate.status === "blocker",
        )
          ? "blocker"
          : laneItems.some((item) => item.candidate.status === "risk")
            ? "risk"
            : laneItems.length > 0
              ? "ready"
              : "";
        const targeted =
          mode === "validation" &&
          selectedCandidate?.teammateId === candidate.teammateId;
        return h(
          "div",
          {
            key: candidate.teammateId,
            ref: (node) => {
              if (node === null) {
                laneElementRefs.current.delete(candidate.teammateId);
              } else {
                laneElementRefs.current.set(candidate.teammateId, node);
              }
            },
            className: `pmd-lane${targeted ? " target" : ""}${laneStatus ? ` ${laneStatus}` : ""}`,
            onDragOver: (event) => handleLaneDragOver(event, candidate),
            onDragLeave: (event) => {
              event.currentTarget.classList.remove("drop");
              if (
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              ) {
                return;
              }
              setLaneDropTarget(null);
            },
            onDrop: (event) => void handleLaneDrop(event, candidate),
          },
          h(
            "div",
            { className: "pmd-teammate" },
            h(
              "div",
              { className: "pmd-teammate-row" },
              h(MemberAvatar, { candidate }),
              h(
                "span",
                { className: "pmd-teammate-copy" },
                h("strong", null, candidate.name),
                h("span", null, candidate.role || "项目成员"),
              ),
            ),
            h(
              "div",
              { className: "pmd-teammate-footer" },
              queueAlerts.length > 0
                ? h(
                    "div",
                    { className: "pmd-load" },
                    ...queueAlerts.map((label) =>
                      h("span", { key: label }, label),
                    ),
                  )
                : null,
              h("div", { className: "pmd-lane-summary" }, laneSummary),
            ),
          ),
          h(
            "div",
            {
              className: `pmd-drop-area${hasLaneContent ? " has-plan" : ""}`,
            },
            hasLaneContent
              ? h(
                  "div",
                  { className: "pmd-lane-plans" },
                  ...assignedTasks.map((task, taskIndex) => {
                    const statusNode = h(
                      "span",
                      {
                        className: `pmd-lane-plan-state ${task.status}`,
                      },
                      task.status === "progress" && candidate.kind === "agent"
                        ? h("span", {
                            className: "pmd-running-spinner",
                            "aria-hidden": "true",
                          })
                        : null,
                      taskStatusLabel(task.status),
                    );
                    const actions = [
                      detailButton(task),
                      h(
                        "button",
                        {
                          className: "pmd-plan-remove",
                          type: "button",
                          title: "移出车道，改为待指派",
                          "aria-label": `移出车道并改为待指派：${task.title}`,
                          draggable: false,
                          onClick: (event) => {
                            event.stopPropagation();
                            unassignAssignedTask(task);
                          },
                        },
                        "×",
                      ),
                    ];
                    return h(
                      "div",
                      {
                        key: `assigned:${task.id}`,
                        "data-lane-task-id": task.id,
                        ref: (node) => {
                          if (node === null) {
                            laneCardRefs.current.delete(task.id);
                          } else {
                            laneCardRefs.current.set(task.id, node);
                          }
                        },
                        className: `pmd-task pmd-lane-plan assigned${
                          laneDropTarget?.assigneeId === candidate.teammateId &&
                          laneDropTarget.targetTaskId === task.id
                            ? laneDropTarget.after
                              ? " drop-after"
                              : " drop-before"
                            : ""
                        }${
                          focusedLaneTask?.taskId === task.id &&
                          focusedLaneTask.teammateId === candidate.teammateId
                            ? " just-added"
                            : ""
                        }`,
                        role: "button",
                        tabIndex: 0,
                        draggable: true,
                        onClick: () => inspectAssignedTask(task, candidate),
                        onPointerUp: (event) => {
                          if (
                            event.button !== 0 ||
                            event.target.closest("button") !== null
                          ) {
                            return;
                          }
                          inspectAssignedTask(task, candidate);
                        },
                        onKeyDown: (event) => {
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          inspectAssignedTask(task, candidate);
                        },
                        onDragStart: (event) => {
                          setLaneDropTarget(null);
                          event.dataTransfer?.setData("text/plain", task.id);
                          event.dataTransfer.effectAllowed = "move";
                        },
                        onDragEnd: () => setLaneDropTarget(null),
                        onDragOver: (event) =>
                          handleLaneCardDragOver(event, candidate, task.id),
                        onDrop: (event) =>
                          void handleLaneCardDrop(event, candidate, task.id),
                      },
                      ...taskCardContent(
                        task,
                        statusNode,
                        actions,
                        taskIndex + 1,
                      ),
                    );
                  }),
                  ...laneDrafts.map((draft, draftIndex) => {
                    const task = eligibleTasks.find(
                      (item) => item.id === draft.taskId,
                    );
                    const validation = laneItems.find(
                      (item) => item.task.id === draft.taskId,
                    );
                    const state =
                      validation?.candidate.status ??
                      (selectedTaskId === draft.taskId &&
                      selectedCandidate?.teammateId === draft.teammateId
                        ? selectedCandidate.status
                        : "pending");
                    const actions = [
                      ...(task === undefined ? [] : [detailButton(task)]),
                      h(
                        "button",
                        {
                          className: "pmd-plan-remove",
                          type: "button",
                          title: "移出车道",
                          "aria-label": `移出 ${task?.title ?? draft.taskId}`,
                          draggable: false,
                          onClick: (event) => {
                            event.stopPropagation();
                            removeDraft(draft.taskId);
                          },
                        },
                        "×",
                      ),
                    ];
                    return h(
                      "div",
                      {
                        key: draft.taskId,
                        "data-lane-task-id": draft.taskId,
                        ref: (node) => {
                          if (node === null) {
                            laneCardRefs.current.delete(draft.taskId);
                          } else {
                            laneCardRefs.current.set(draft.taskId, node);
                          }
                        },
                        className: `pmd-task pmd-lane-plan ${state}${
                          laneDropTarget?.assigneeId === candidate.teammateId &&
                          laneDropTarget.targetTaskId === draft.taskId
                            ? laneDropTarget.after
                              ? " drop-after"
                              : " drop-before"
                            : ""
                        }${
                          focusedLaneTask?.taskId === draft.taskId &&
                          focusedLaneTask.teammateId === candidate.teammateId
                            ? " just-added"
                            : ""
                        }`,
                        draggable: true,
                        role: "button",
                        tabIndex: 0,
                        onClick: () => {
                          validationIntentRef.current = draft;
                          if (selectedTaskId === draft.taskId) {
                            setSelectedTeammateId(draft.teammateId);
                            setMode("validation");
                          } else {
                            setSelectedTaskId(draft.taskId);
                          }
                        },
                        onPointerUp: (event) => {
                          if (
                            event.button !== 0 ||
                            event.target.closest("button") !== null
                          ) {
                            return;
                          }
                          validationIntentRef.current = draft;
                          setSelectedTaskId(draft.taskId);
                          setSelectedTeammateId(draft.teammateId);
                          setMode("validation");
                        },
                        onKeyDown: (event) => {
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          event.currentTarget.click();
                        },
                        onDragStart: (event) => {
                          setLaneDropTarget(null);
                          event.dataTransfer?.setData(
                            "text/plain",
                            draft.taskId,
                          );
                          event.dataTransfer.effectAllowed = "move";
                        },
                        onDragEnd: () => setLaneDropTarget(null),
                        onDragOver: (event) =>
                          handleLaneCardDragOver(
                            event,
                            candidate,
                            draft.taskId,
                          ),
                        onDrop: (event) =>
                          void handleLaneCardDrop(
                            event,
                            candidate,
                            draft.taskId,
                          ),
                      },
                      ...(task === undefined
                        ? [
                            h(
                              "span",
                              { className: "pmd-task-top", key: "top" },
                              h(
                                "strong",
                                { className: "pmd-task-title" },
                                draft.taskId,
                              ),
                              h(
                                "span",
                                { className: "pmd-task-actions" },
                                ...actions,
                              ),
                            ),
                            h(
                              "span",
                              { className: "pmd-task-meta", key: "meta" },
                              h("span", null, "任务详情不可用"),
                            ),
                          ]
                        : taskCardContent(
                            task,
                            null,
                            actions,
                            assignedTasks.length + draftIndex + 1,
                          )),
                    );
                  }),
                )
              : h("span", null, "拖入任务或选择此成员"),
          ),
        );
      };

      const candidateList = h(
        "div",
        { className: "pmd-candidates" },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              color: "var(--dsw-alias-label-tertiary)",
              fontSize: 8,
            },
          },
          h("span", null, "候选承接成员"),
          h("span", null, "综合分"),
        ),
        filteredCandidates.length === 0
          ? h(
              "div",
              {
                style: {
                  padding: "18px 8px",
                  color: "var(--dsw-alias-label-tertiary)",
                  fontSize: 9.5,
                  textAlign: "center",
                },
              },
              "当前筛选下没有承接成员",
            )
          : filteredCandidates.map((candidate) => {
              const queueCount =
                candidate.signals.planned +
                candidate.signals.running +
                candidate.signals.review;
              const roleText = String(candidate.role ?? "").toLocaleLowerCase(
                "zh-Hans-CN",
              );
              const nameText = String(candidate.name ?? "").toLocaleLowerCase(
                "zh-Hans-CN",
              );
              const visibleSkills = candidate.matchedSkills.filter((skill) => {
                const value = skill.toLocaleLowerCase("zh-Hans-CN");
                return value !== roleText && value !== nameText;
              });
              return h(
                "button",
                {
                  key: candidate.teammateId,
                  type: "button",
                  className: "pmd-candidate",
                  onClick: () => chooseCandidate(candidate),
                },
                h(
                  "span",
                  { className: "pmd-candidate-head" },
                  h(MemberAvatar, { candidate, small: true }),
                  h(
                    "span",
                    { className: "pmd-candidate-copy" },
                    h("strong", null, candidate.name),
                    h(
                      "span",
                      null,
                      `${candidate.role || "项目成员"} · ${statusLabel(candidate.status)}`,
                    ),
                  ),
                  h(
                    "span",
                    {
                      className: `pmd-score ${candidate.score >= 80 ? "high" : candidate.score >= 60 ? "medium" : "low"}`,
                    },
                    candidate.score,
                    h("small", null, "分"),
                  ),
                ),
                h(
                  "span",
                  { className: "pmd-context" },
                  h(
                    "span",
                    {
                      className: `pmd-tag${queueCount > 0 ? " warn" : ""}`,
                      title: `待启动 ${candidate.signals.planned}，运行中 ${candidate.signals.running}，待验收 ${candidate.signals.review}`,
                    },
                    `前方队列 ${queueCount}`,
                  ),
                  candidate.kind === "human"
                    ? h("span", { className: "pmd-tag ok" }, "人工承接")
                    : h(
                        "span",
                        {
                          className: `pmd-tag ${visibleSkills.length > 0 ? "ok" : "warn"}`,
                        },
                        visibleSkills.length > 0
                          ? visibleSkills.join("、")
                          : "Skill 证据不足",
                      ),
                  h(
                    "span",
                    {
                      className: `pmd-tag ${candidate.signals.available ? "ok" : "bad"}`,
                    },
                    candidate.signals.available ? "执行可用" : "不可执行",
                  ),
                  (candidate.signals.experienceCount ?? 0) > 0
                    ? h(
                        "span",
                        { className: "pmd-tag ok" },
                        `过往经验 ${candidate.signals.experienceCount}`,
                      )
                    : null,
                ),
                h(
                  "span",
                  { className: "pmd-reason" },
                  candidate.blockers.length > 0
                    ? candidate.blockers.join("；")
                    : candidate.risks.length > 0
                      ? candidate.risks.join("；")
                      : candidate.kind === "human"
                        ? "项目参与、执行可用性与队列负载均满足。"
                        : "项目、Skill、执行可用性与队列负载均满足。",
                ),
              );
            }),
      );

      const dispatchView =
        pendingDispatchTasks.length === 0
          ? h("div", { className: "pmd-empty" }, "当前没有等待确认派发的任务")
          : h(
              "div",
              null,
              h(
                "div",
                { className: "pmd-block" },
                h("h3", null, "待确认派发"),
                h(
                  "p",
                  null,
                  "只包含本次调整过负责人的任务。AI 任务确认后会进入进行中并启动执行；人类任务保持待处理。",
                ),
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 8,
                      color: "var(--dsw-alias-label-tertiary)",
                      fontSize: 10,
                    },
                  },
                  h(
                    "button",
                    {
                      className: "pmd-btn",
                      type: "button",
                      onClick: () =>
                        setDispatchSelectionIds(
                          allDispatchTasksSelected
                            ? []
                            : pendingDispatchTasks.map((task) => task.id),
                        ),
                    },
                    allDispatchTasksSelected ? "取消全选" : "全选",
                  ),
                  h(
                    "span",
                    null,
                    `已选 ${dispatchSelectionIds.length} / ${pendingDispatchTasks.length}`,
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmd-batch-list" },
                pendingDispatchTasks.map((task) =>
                  h(
                    "label",
                    {
                      className: "pmd-suggestion",
                      key: task.id,
                    },
                    h("input", {
                      type: "checkbox",
                      checked: dispatchSelectionIds.includes(task.id),
                      onChange: (event) =>
                        setDispatchSelectionIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, task.id])]
                            : current.filter((taskId) => taskId !== task.id),
                        ),
                    }),
                    h(
                      "span",
                      null,
                      h("strong", null, task.title),
                      h(
                        "span",
                        null,
                        `${task.receiverName || "待指派"} · ${task.receiverType === "agent" ? "AI 任务" : "人类任务"}`,
                      ),
                    ),
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmd-actions" },
                h(
                  "button",
                  {
                    className: "pmd-btn",
                    type: "button",
                    onClick: () => setMode("recommend"),
                  },
                  "取消",
                ),
                h(
                  "button",
                  {
                    className: "pmd-btn primary",
                    type: "button",
                    disabled: busy || dispatchSelectionIds.length === 0,
                    onClick: () => void confirmDispatch(),
                  },
                  busy
                    ? "正在派发..."
                    : `确认派发 ${dispatchSelectionIds.length}`,
                ),
              ),
            );

      const validation =
        selectedTask && selectedCandidate
          ? h(
              "div",
              null,
              h(
                "div",
                { className: "pmd-block" },
                h("h3", null, selectedTask.title),
                h("p", null, `目标成员：${selectedCandidate.name}`),
              ),
              h(
                "div",
                { className: "pmd-block" },
                h("h3", { style: { marginBottom: 7 } }, "实时校验"),
                h(
                  "div",
                  { className: "pmd-checks" },
                  h(
                    "div",
                    { className: "pmd-check" },
                    h(
                      "span",
                      {
                        className: `pmd-check-icon${selectedCandidate.signals.projectBound ? "" : " warn"}`,
                      },
                      h("i", {
                        "data-lucide": selectedCandidate.signals.projectBound
                          ? "check"
                          : "triangle-alert",
                      }),
                    ),
                    h(
                      "span",
                      null,
                      h(
                        "strong",
                        null,
                        selectedCandidate.signals.projectBound
                          ? "项目参与"
                          : "项目未绑定",
                      ),
                      h(
                        "span",
                        null,
                        selectedCandidate.signals.projectBound
                          ? "成员可进入当前项目执行"
                          : "需要人工确认项目范围",
                      ),
                    ),
                  ),
                  selectedCandidate.kind === "human"
                    ? null
                    : h(
                        "div",
                        { className: "pmd-check" },
                        h(
                          "span",
                          {
                            className: `pmd-check-icon${selectedCandidate.signals.skillEvidence === "matched" ? "" : " warn"}`,
                          },
                          h("i", {
                            "data-lucide":
                              selectedCandidate.signals.skillEvidence ===
                              "matched"
                                ? "check"
                                : "help-circle",
                          }),
                        ),
                        h(
                          "span",
                          null,
                          h(
                            "strong",
                            null,
                            selectedCandidate.signals.skillEvidence ===
                              "matched"
                              ? "Skill 证据"
                              : "Skill 证据不足",
                          ),
                          h(
                            "span",
                            null,
                            selectedCandidate.matchedSkills.length > 0
                              ? `匹配：${selectedCandidate.matchedSkills.join("、")}`
                              : "任务未声明可直接匹配的 Skill",
                          ),
                        ),
                      ),
                  h(
                    "div",
                    { className: "pmd-check" },
                    h(
                      "span",
                      {
                        className: `pmd-check-icon${selectedCandidate.signals.available ? "" : " bad"}`,
                      },
                      h("i", {
                        "data-lucide": selectedCandidate.signals.available
                          ? "check"
                          : "octagon-alert",
                      }),
                    ),
                    h(
                      "span",
                      null,
                      h(
                        "strong",
                        null,
                        selectedCandidate.signals.available
                          ? "执行身份可用"
                          : "执行身份不可用",
                      ),
                      h(
                        "span",
                        null,
                        selectedCandidate.signals.available
                          ? "Runtime 与执行身份可承接"
                          : selectedCandidate.kind === "human"
                            ? "需要确认成员账号状态"
                            : "需要先修复 AI伙伴执行配置",
                      ),
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmd-check" },
                    h(
                      "span",
                      {
                        className: `pmd-check-icon${selectedCandidate.signals.running > 0 || selectedCandidate.signals.planned >= 3 ? " warn" : ""}`,
                      },
                      h("i", { "data-lucide": "list-checks" }),
                    ),
                    h(
                      "span",
                      null,
                      h("strong", null, "队列负载"),
                      h(
                        "span",
                        null,
                        `待启动 ${selectedCandidate.signals.planned}，运行中 ${selectedCandidate.signals.running}，阻塞 ${selectedCandidate.signals.blocked}`,
                      ),
                    ),
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmd-block" },
                h(
                  "div",
                  {
                    className: `pmd-warning${selectedCandidate.status === "blocker" ? " bad" : selectedCandidate.status === "risk" ? "" : " info"}`,
                  },
                  h("i", {
                    "data-lucide":
                      selectedCandidate.status === "blocker"
                        ? "octagon-alert"
                        : selectedCandidate.status === "risk"
                          ? "triangle-alert"
                          : "info",
                  }),
                  h(
                    "span",
                    null,
                    selectedCandidate.blockers[0] ??
                      selectedCandidate.risks[0] ??
                      "当前方案可加入队列，不打断已有 Run。",
                  ),
                ),
              ),
              selectedTaskIsPending
                ? h(
                    "div",
                    { className: "pmd-actions" },
                    h(
                      "button",
                      {
                        className: "pmd-btn",
                        type: "button",
                        onClick: () => setMode("recommend"),
                      },
                      h("i", { "data-lucide": "arrow-left" }),
                      "查看其他建议",
                    ),
                    h(
                      "button",
                      {
                        className: "pmd-btn primary",
                        type: "button",
                        onClick: stageDraft,
                      },
                      h("i", {
                        "data-lucide": draftOf(selectedTask.id)
                          ? "refresh-cw"
                          : "list-plus",
                      }),
                      "确认任务指派",
                    ),
                  )
                : null,
            )
          : h(
              "div",
              { className: "pmd-empty" },
              busy ? "正在读取承接建议..." : "选择成员查看实时校验",
            );

      const batchView = batch
        ? h(
            "div",
            null,
            h(
              "div",
              { className: "pmd-block" },
              h("h3", null, "本次派发方案"),
              h(
                "p",
                null,
                `共 ${batch.summary.total} 项，按阻断、风险、可执行排序。`,
              ),
              h(
                "div",
                { className: "pmd-batch-stats" },
                h(
                  "div",
                  { className: "pmd-stat blocker" },
                  h("strong", null, batch.summary.blockers),
                  h("span", null, "阻断"),
                ),
                h(
                  "div",
                  { className: "pmd-stat risk" },
                  h("strong", null, batch.summary.risks),
                  h("span", null, "风险"),
                ),
                h(
                  "div",
                  { className: "pmd-stat ready" },
                  h("strong", null, batch.summary.ready),
                  h("span", null, "可派发"),
                ),
              ),
            ),
            h(
              "div",
              { className: "pmd-batch-list" },
              batch.items.map((item) => {
                const suggestion = suggestionFor(item);
                const checked = suggestionIds.includes(item.task.id);
                return h(
                  "article",
                  {
                    key: item.task.id,
                    className: `pmd-batch-item ${item.candidate.status}`,
                  },
                  h(
                    "div",
                    { className: "pmd-batch-head" },
                    h("strong", null, item.task.title),
                    h(
                      "span",
                      {
                        className: `pmd-tag ${item.candidate.status === "blocker" ? "bad" : item.candidate.status === "risk" ? "warn" : "ok"}`,
                      },
                      statusLabel(item.candidate.status),
                    ),
                  ),
                  h(
                    "p",
                    { className: "pmd-batch-copy" },
                    `${item.candidate.name} · 待启动 ${item.candidate.signals.planned} · 运行中 ${item.candidate.signals.running}`,
                  ),
                  h(
                    "p",
                    { className: "pmd-batch-copy" },
                    item.candidate.blockers[0] ??
                      item.candidate.risks[0] ??
                      (item.candidate.kind === "human"
                        ? "项目参与、执行可用性与队列负载均满足。"
                        : "项目、Skill 证据、执行可用性与队列负载均满足。"),
                  ),
                  suggestion
                    ? h(
                        "label",
                        { className: "pmd-suggestion" },
                        h("input", {
                          type: "checkbox",
                          checked,
                          onChange: (event) =>
                            setSuggestionIds((current) =>
                              event.target.checked
                                ? [...current, item.task.id]
                                : current.filter((id) => id !== item.task.id),
                            ),
                        }),
                        h(
                          "span",
                          null,
                          h("strong", null, `建议：${suggestion.label}`),
                          h("span", null, suggestion.detail),
                        ),
                      )
                    : h(
                        "span",
                        { className: "pmd-no-suggestion" },
                        "当前方案无需调整",
                      ),
                );
              }),
            ),
            h(
              "div",
              { className: "pmd-actions" },
              h(
                "button",
                {
                  className: "pmd-btn",
                  type: "button",
                  disabled: suggestionIds.length === 0 || busy,
                  onClick: () => void applySuggestions(),
                },
                h("i", { "data-lucide": "check-check" }),
                `应用已选建议 (${suggestionIds.length})`,
              ),
              h(
                "button",
                {
                  className: "pmd-btn primary",
                  type: "button",
                  disabled: batch.summary.blockers > 0 || busy,
                  onClick: () => void commitPlan(),
                },
                h("i", { "data-lucide": "send" }),
                batch.summary.blockers > 0
                  ? "存在阻断，暂不可入队"
                  : busy
                    ? "正在入队..."
                    : "确认批量入队",
              ),
            ),
          )
        : h(
            "div",
            { className: "pmd-empty" },
            drafts.length === 0
              ? "还没有派发方案。选择任务和承接成员后加入方案。"
              : "正在校验派发方案...",
          );

      const title =
        mode === "dispatch"
          ? "确认派发"
          : mode === "batch"
            ? "派发前校验"
            : mode === "validation"
              ? "实时派发校验"
              : "承接建议";

      const pendingUnassign =
        pendingReceiverChange?.receiverType === "unassigned";
      const reassignImpactItems = pendingUnassign
        ? [
            "任务将恢复为「待处理」，当前执行可能暂停。",
            "已有产物、评论和执行记录仍保留在本任务中。",
            "重新选择负责人前，任务不会继续推进执行或验收。",
          ]
        : [
            `任务状态仍保持「${taskStatusLabel(pendingReceiverChange?.task.status ?? "")}」，负责人会切换为新成员。`,
            "已有产物、评论和执行记录仍保留在本任务中。",
            "后续执行、异常处理和验收责任由新负责人承担。",
          ];
      const reassignChecklistItems = pendingUnassign
        ? [
            ["pause", "已确认当前执行可以安全暂停"],
            ["context", "已记录当前进展和待办事项"],
            ["notify", "已准备后续重新指派负责人"],
          ]
        : [
            ["pause", "已确认当前执行可以安全暂停或交接"],
            ["context", "已将交接背景补充到任务描述或评论"],
            ["notify", "已通知原负责人和新的负责人"],
          ];
      const reassignCheckedCount = reassignChecklistItems.filter(
        ([key]) => reassignChecks[key] === true,
      ).length;
      const allReassignChecksSelected =
        reassignCheckedCount === reassignChecklistItems.length;

      const receiverChangeDialog =
        pendingReceiverChange === null
          ? null
          : h(
              "div",
              {
                className: "pmd-confirm-mask",
                onClick: (event) => {
                  if (event.target === event.currentTarget) {
                    setPendingReceiverChange(null);
                  }
                },
                onKeyDown: (event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setPendingReceiverChange(null);
                  }
                },
              },
              h(
                "section",
                {
                  className: "pmd-confirm-dialog",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-labelledby": "pmd-reassign-confirm-title",
                },
                h(
                  "div",
                  { className: "pmd-confirm-head" },
                  h("i", { "data-lucide": "triangle-alert" }),
                  h(
                    "h2",
                    { id: "pmd-reassign-confirm-title" },
                    pendingUnassign
                      ? "确认移出进行中的任务？"
                      : "确认改派进行中的任务？",
                  ),
                ),
                h(
                  "div",
                  { className: "pmd-confirm-task" },
                  h("strong", null, pendingReceiverChange.task.title),
                  h(
                    "div",
                    { className: "pmd-confirm-route" },
                    h(
                      "span",
                      null,
                      pendingReceiverChange.task.receiverName ||
                        pendingReceiverChange.task.receiverId ||
                        "当前负责人",
                    ),
                    h("span", { "aria-hidden": "true" }, "→"),
                    h(
                      "span",
                      null,
                      pendingReceiverChange.receiverType === "unassigned"
                        ? "待指派"
                        : pendingReceiverChange.receiverName || "目标成员",
                    ),
                    h(
                      "span",
                      null,
                      `· ${taskStatusLabel(pendingReceiverChange.task.status)}`,
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "pmd-confirm-section" },
                  h(
                    "h3",
                    null,
                    h("i", { "data-lucide": "workflow" }),
                    pendingUnassign ? "移出后的变化" : "改派可能造成的影响",
                  ),
                  h(
                    "ul",
                    { className: "pmd-confirm-list" },
                    ...reassignImpactItems.map((item) =>
                      h("li", { key: item }, item),
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "pmd-confirm-section" },
                  h(
                    "h3",
                    null,
                    h("i", { "data-lucide": "clipboard-check" }),
                    "改派前建议完成",
                  ),
                  h(
                    "div",
                    { className: "pmd-confirm-checklist" },
                    ...reassignChecklistItems.map(([key, label]) =>
                      h(
                        "label",
                        { className: "pmd-confirm-check", key },
                        h("input", {
                          type: "checkbox",
                          checked: reassignChecks[key] === true,
                          onChange: (event) =>
                            setReassignChecks((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            })),
                        }),
                        h("span", null, label),
                      ),
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmd-confirm-tools" },
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () =>
                          setReassignChecks((current) => ({
                            ...current,
                            ...Object.fromEntries(
                              reassignChecklistItems.map(([key]) => [
                                key,
                                !allReassignChecksSelected,
                              ]),
                            ),
                          })),
                      },
                      allReassignChecksSelected ? "取消全选" : "勾选全部",
                    ),
                    h(
                      "span",
                      null,
                      `已勾选 ${reassignCheckedCount} / ${reassignChecklistItems.length}`,
                    ),
                  ),
                ),
                h(
                  "div",
                  { className: "pmd-confirm-actions" },
                  h(
                    "button",
                    {
                      className: "pmd-btn",
                      type: "button",
                      autoFocus: true,
                      onClick: () => setPendingReceiverChange(null),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      className: "pmd-btn primary",
                      type: "button",
                      disabled: busy,
                      onClick: confirmReceiverChange,
                    },
                    pendingReceiverChange.receiverType === "unassigned"
                      ? "确认移出"
                      : "确认改派",
                  ),
                ),
              ),
            );

      const draftTaskIds = new Set(drafts.map((draft) => draft.taskId));
      const shelfTasks = eligibleTasks.filter(
        (task) => !draftTaskIds.has(task.id),
      );
      const pendingPanel = h(
        "section",
        { className: "pmd-panel pmd-pending" },
        h(
          "div",
          { className: "pmd-section-head" },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              },
            },
            h(
              "span",
              { className: "pmd-section-title" },
              h("i", { "data-lucide": "package-open" }),
              "待派发任务",
            ),
            h(
              "span",
              { className: "pmd-hint" },
              "点击查看承接建议，拖入成员车道进行实时校验",
            ),
          ),
          h(
            "div",
            { className: "pmd-head-actions" },
            h(
              "button",
              {
                className: `pmd-btn${mode === "batch" ? " active" : ""}`,
                type: "button",
                disabled: busy || drafts.length === 0,
                onClick: () => void validateDrafts(),
              },
              h("i", { "data-lucide": "shield-check" }),
              `全局校验 ${drafts.length}`,
            ),
            h(
              "button",
              {
                className: `pmd-btn${mode === "dispatch" ? " active" : ""}`,
                type: "button",
                disabled: busy || pendingDispatchTasks.length === 0,
                onClick: openDispatchQueue,
              },
              h("i", { "data-lucide": "send" }),
              `确认派发 ${pendingDispatchTasks.length}`,
            ),
          ),
        ),
        shelfTasks.length === 0
          ? h(
              "div",
              { className: "pmd-empty" },
              eligibleTasks.length === 0
                ? "当前项目没有待派发任务"
                : "待派发任务已全部排入成员车道",
            )
          : h("div", { className: "pmd-shelf" }, shelfTasks.map(taskCard)),
      );

      return h(
        "section",
        { className: "pmd" },
        h("style", null, styles),
        error !== ""
          ? h(
              "div",
              { className: "pmd-error", role: "alert" },
              h("span", null, error),
              h(
                "button",
                {
                  className: "pmd-status-close",
                  type: "button",
                  title: "关闭提示",
                  "aria-label": "关闭错误提示",
                  onClick: () => setError(""),
                },
                "×",
              ),
            )
          : null,
        notice !== ""
          ? h(
              "div",
              { className: "pmd-notice", role: "status" },
              h("span", null, notice),
              h(
                "button",
                {
                  className: "pmd-status-close",
                  type: "button",
                  title: "关闭提示",
                  "aria-label": "关闭状态提示",
                  onClick: () => setNotice(""),
                },
                "×",
              ),
            )
          : null,
        receiverChangeDialog,
        h(
          "div",
          { className: "pmd-layout" },
          h(
            "div",
            { className: "pmd-left" },
            pendingPanel,
            h(
              "section",
              { className: "pmd-panel pmd-lanes" },
              h(
                "div",
                { className: "pmd-section-head" },
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    },
                  },
                  h(
                    "span",
                    { className: "pmd-section-title" },
                    h("i", { "data-lucide": "route" }),
                    "承接成员",
                  ),
                  h(
                    "span",
                    { className: "pmd-hint" },
                    "包含人类员工与 AI伙伴，负载来自当前项目真实任务",
                  ),
                ),
                h(
                  "div",
                  {
                    className: "pmd-filter",
                    role: "group",
                    "aria-label": "承接成员筛选",
                  },
                  ...[
                    ["all", "全部"],
                    ["agent", "AI伙伴"],
                    ["human", "人类员工"],
                  ].map(([value, label]) =>
                    h(
                      "button",
                      {
                        key: value,
                        type: "button",
                        className: assigneeFilter === value ? "active" : "",
                        "aria-pressed": assigneeFilter === value,
                        onClick: () => setAssigneeFilter(value),
                      },
                      label,
                    ),
                  ),
                ),
              ),
              h(
                "div",
                { className: "pmd-lane-list" },
                filteredAssignees.length === 0
                  ? h(
                      "div",
                      { className: "pmd-empty" },
                      assigneesLoading
                        ? "正在读取承接成员..."
                        : assigneeFilter === "all"
                          ? "当前项目没有可承接成员"
                          : "当前筛选下没有承接成员",
                    )
                  : filteredAssignees.map(lane),
              ),
            ),
          ),
          h(
            "aside",
            { className: "pmd-panel pmd-preview" },
            h(
              "div",
              { className: "pmd-preview-head" },
              h("strong", null, title),
            ),
            h(
              "div",
              { className: "pmd-preview-body" },
              mode === "dispatch"
                ? dispatchView
                : mode === "batch"
                  ? batchView
                  : mode === "validation"
                    ? validation
                    : selectedTask
                      ? h(
                          "div",
                          null,
                          h(
                            "div",
                            { className: "pmd-block" },
                            h("h3", null, selectedTask.title),
                            h(
                              "p",
                              null,
                              selectedTask.description ||
                                selectedTask.type ||
                                "任务",
                            ),
                            h(
                              "div",
                              { className: "pmd-context" },
                              h(
                                "span",
                                {
                                  className: `pmd-tag ${selectedTask.priority === "P1" ? "bad" : selectedTask.priority === "P2" ? "warn" : "ok"}`,
                                },
                                priorityLabel(selectedTask.priority),
                              ),
                              h(
                                "span",
                                { className: "pmd-tag" },
                                selectedTask.type || "任务",
                              ),
                              h(
                                "span",
                                { className: "pmd-tag" },
                                `${filteredCandidates.length} 位候选`,
                              ),
                            ),
                          ),
                          candidateList,
                        )
                      : h(
                          "div",
                          { className: "pmd-empty" },
                          "选择待派发任务查看承接建议",
                        ),
              commitResults !== null
                ? h(
                    "div",
                    { className: "pmd-block" },
                    h("h3", null, "入队结果"),
                    ...commitResults.results.map((result) =>
                      h(
                        "p",
                        { key: result.taskId },
                        `${result.taskId} · ${result.ok ? "已入队" : `失败：${result.error ?? "未知错误"}`}`,
                      ),
                    ),
                  )
                : null,
            ),
          ),
        ),
      );
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      window.__pluginmaxTaskDispatchReady = true;
      window.dispatchEvent(new CustomEvent("pluginmax:task-dispatch-ready"));
      ctx.slots.inject("pluginmax.task.dispatch-view", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.dispatch-view",
            id: "pluginmax-task-dispatch-view",
            order: 20,
          },
          TaskDispatchView,
        ),
      );
    };

    return module.exports;
  },
});
