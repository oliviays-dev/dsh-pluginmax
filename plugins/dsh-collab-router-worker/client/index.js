window.__ModuleLoader__.load({
  id: "dsh-collab-router-worker",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;
    const stateByWorkspace = new Map();
    const planCache = new Map();
    const planListeners = new Set();
    const addNodeDrafts = new Map();
    const addNodeDraftListeners = new Set();
    function enabledKey(workspaceId) {
      return `pluginmax.router-worker.enabled.${workspaceId}`;
    }
    function locallyEnabled(workspaceId) {
      return window.localStorage.getItem(enabledKey(workspaceId)) === "true";
    }
    function publishPlan(taskId, value) {
      planCache.set(taskId, value);
      for (const listener of planListeners) listener();
    }
    function usePlan(taskId) {
      const [value, setValue] = react.useState(
        () => planCache.get(taskId) ?? null,
      );
      react.useEffect(() => {
        const listener = () => setValue(planCache.get(taskId) ?? null);
        planListeners.add(listener);
        listener();
        return () => planListeners.delete(listener);
      }, [taskId]);
      return value;
    }
    function defaultAddNodeDraft() {
      return {
        active: false,
        title: "",
        description: "完成新增任务节点并提交可验收结果。",
        taskType: "任务",
        initialStatus: "todo",
        receiverType: "human",
        receiverId: "",
        receiverName: "",
        priority: "P2",
        due: "",
        acceptance: "提交任务结果",
        autoSubmitReview: true,
        autoApproveReview: false,
        allowPublicWeb: false,
        requireToolApproval: true,
        requireToolEvents: false,
        runtimeId: "",
        model: "",
        reasoningEffort: "",
        saving: false,
        error: "",
      };
    }
    function updateAddNodeDraft(taskId, updater) {
      const current = addNodeDrafts.get(taskId) ?? defaultAddNodeDraft();
      const next =
        typeof updater === "function"
          ? updater(current)
          : { ...current, ...updater };
      addNodeDrafts.set(taskId, next);
      for (const listener of addNodeDraftListeners) listener(taskId);
      return next;
    }
    function useAddNodeDraft(taskId) {
      const [value, setValue] = react.useState(
        () => addNodeDrafts.get(taskId) ?? defaultAddNodeDraft(),
      );
      react.useEffect(() => {
        const listener = (changedTaskId) => {
          if (changedTaskId === taskId) {
            setValue(addNodeDrafts.get(taskId) ?? defaultAddNodeDraft());
          }
        };
        addNodeDraftListeners.add(listener);
        listener(taskId);
        return () => addNodeDraftListeners.delete(listener);
      }, [taskId]);
      return value;
    }
    const styles = `
      .pmrw-settings-trigger{position:relative;width:30px;height:30px;display:inline-grid;place-items:center;padding:0;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmrw-settings-trigger:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmrw-settings-trigger svg{width:14px;height:14px;}
      .pmrw-enabled-dot{position:absolute;right:3px;top:3px;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#34c78d);}
      .pmrw-task-actions{display:inline-flex;align-items:center;gap:5px;}
      .pmrw-plan-entry{height:30px;display:inline-flex;align-items:center;gap:6px;padding:0 9px;border:1px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 30%,var(--dsw-alias-border-l3));border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;}
      .pmrw-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.42);}
      .pmrw-unsaved-backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.48);}
      .pmrw-unsaved-dialog{width:min(420px,100%);display:grid;gap:14px;padding:18px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:0 18px 60px rgba(0,0,0,.32);}
      .pmrw-unsaved-head{display:grid;gap:5px;}
      .pmrw-unsaved-head h3{margin:0;font-size:15px;}
      .pmrw-unsaved-head p{margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.55;}
      .pmrw-unsaved-actions{display:flex;justify-content:flex-end;gap:7px;}
      .pmrw-button.danger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 38%,var(--dsw-alias-border-l3));color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmrw-modal{width:min(560px,100%);max-height:calc(100dvh - 40px);overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:0 18px 60px rgba(0,0,0,.28);}
      .pmrw-modal *{box-sizing:border-box;}
      .pmrw-modal-head{display:flex;align-items:flex-start;gap:12px;padding:16px 18px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmrw-modal-head>div{min-width:0;flex:1;}
      .pmrw-modal-head h2{margin:0;font-size:16px;}
      .pmrw-modal-head p{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;}
      .pmrw-icon-button{width:28px;height:28px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:18px;cursor:pointer;}
      .pmrw-icon-button:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmrw-modal-body{display:grid;gap:12px;padding:16px 18px;}
      .pmrw-field{display:grid;gap:5px;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmrw-field select{height:32px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);}
      .pmrw-settings-card{display:flex;align-items:flex-start;gap:12px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
      .pmrw-settings-card>div{min-width:0;flex:1;}
      .pmrw-settings-card strong{font-size:12px;}
      .pmrw-settings-card p{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.5;}
      .pmrw-state{flex:none;padding:2px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:9px;}
      .pmrw-state.enabled{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 13%,transparent);color:var(--dsw-alias-state-success-primary,#2f9b6d);}
      .pmrw-plan-persistence-note{margin:0;padding:0 2px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.55;}
      .pmrw-error{margin:0;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10.5px;}
      .pmrw-modal-foot{display:flex;justify-content:flex-end;gap:7px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmrw-button{height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer;}
      .pmrw-button.secondary{color:var(--dsw-alias-label-secondary);}
      .pmrw-button.primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);}
      .pmrw-button:disabled{opacity:.5;cursor:not-allowed;}
      .pmrw-task-plan-center{position:absolute;inset:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmrw-task-plan-center.graph-fullscreen{position:fixed;inset:0;z-index:100;}
      .pmrw-plan-head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmrw-plan-head>div:first-child{min-width:0;flex:1;display:grid;gap:3px;}
      .pmrw-plan-head strong{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmrw-plan-head span{color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmrw-plan-head small{color:var(--dsw-alias-label-secondary);font-size:9px;}
      .pmrw-plan-title-line{display:flex!important;align-items:center;gap:7px;min-width:0;}
      .pmrw-plan-title-line strong{min-width:0;}
      .pmrw-plan-title-meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary)!important;font-size:9.5px!important;}
      .pmrw-plan-tag{width:max-content;padding:1px 6px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 11%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7)!important;font-size:8.5px!important;}
      .pmrw-final-draft{margin:10px 14px 0;padding:10px 11px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 30%,var(--dsw-alias-border-l2));border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 5%,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.55;}
      .pmrw-final-draft.pending{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 30%,var(--dsw-alias-border-l2));}
      .pmrw-final-draft summary{color:var(--dsw-alias-label-primary);font-weight:650;cursor:pointer;}
      .pmrw-final-draft>p{margin:8px 0 0;white-space:pre-wrap;}
      .pmrw-final-draft section{display:grid;gap:3px;margin-top:9px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2);}
      .pmrw-final-draft section>strong{color:var(--dsw-alias-label-primary);}
      .pmrw-final-draft section>small{display:block;color:var(--dsw-alias-label-secondary);}
      .pmrw-final-draft-grid{display:grid;gap:5px;margin-top:8px;}
      .pmrw-final-draft-grid>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;padding:6px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-1);}
      .pmrw-final-draft-grid span{min-width:0;overflow-wrap:anywhere;}
      .pmrw-final-draft-grid strong{font-size:9px;}
      .pmrw-final-draft-grid strong.covered{color:var(--dsw-alias-state-success-primary,#34c78d);}
      .pmrw-final-draft-grid strong.partial{color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmrw-final-draft-grid strong.missing{color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmrw-final-draft-grid small{grid-column:1/-1;color:var(--dsw-alias-label-tertiary);}
      .pmrw-plan-toolbar{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmrw-segmented{display:inline-flex;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);}
      .pmrw-segmented button{height:24px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer;}
      .pmrw-segmented button.active{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmrw-plan-progress{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:10px;}
      .pmrw-plan-error{margin:10px 14px 0;padding:8px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 35%,transparent);border-radius:6px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:10.5px;}
      .pmrw-plan-content{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden;}
      .pmrw-plan-empty{min-height:260px;flex:1;display:grid;place-content:center;justify-items:center;gap:8px;padding:24px;text-align:center;}
      .pmrw-plan-empty strong{font-size:13px;}
      .pmrw-plan-empty p{max-width:360px;margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;}
      .pmrw-plan-start{place-content:center;align-content:center;}
      .pmrw-plan-start>strong{font-size:15px;}
      .pmrw-start-options{width:min(460px,100%);display:grid;gap:7px;margin-top:4px;}
      .pmrw-start-option{width:100%;min-width:0;display:grid;gap:3px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
      .pmrw-start-option:hover{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 45%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 6%,var(--dsw-alias-bg-layer-2));}
      .pmrw-start-option strong{font-size:11.5px;font-weight:650;}
      .pmrw-start-option span{color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.45;}
      .pmrw-start-config{width:min(460px,100%);display:grid;justify-items:stretch;gap:9px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);text-align:left;}
      .pmrw-start-config-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .pmrw-start-config-head>strong{font-size:12px;}
      .pmrw-start-config>p{max-width:none;}
      .pmrw-start-config>select{height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;}
      .pmrw-text-button{border:0;padding:2px 0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:9.5px;cursor:pointer;}
      .pmrw-text-button:hover{color:var(--dsw-alias-label-primary);}
      .pmrw-text-button:disabled{opacity:.45;cursor:not-allowed;}
      .pmrw-router-picker{min-width:260px;display:grid;gap:5px;text-align:left;color:var(--dsw-alias-label-tertiary);font-size:9px;}
      .pmrw-router-picker select{height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;}
      .pmrw-router-progress{display:grid;gap:5px;padding:8px 0;text-align:center;}
      .pmrw-router-progress strong{font-size:12px;color:var(--dsw-alias-label-primary);}
      .pmrw-router-progress small{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.5;}
      .pmrw-router-progress-track{height:4px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-layer-3);}
      .pmrw-router-progress-track span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--dsw-alias-accent-primary,#4f8ef7),color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 55%,white));transition:width .45s ease;box-shadow:0 0 12px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 45%,transparent);}
      .pmrw-router-empty-hint{max-width:360px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;line-height:1.5;}
      .pmrw-plan-nodes{min-height:0;flex:1;overflow:auto;padding:14px;}
      .pmrw-plan-nodes.graph{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));align-content:start;gap:10px;}
      .pmrw-plan-nodes.list{display:grid;align-content:start;gap:6px;}
      .pmrw-graph-viewport{position:relative;min-height:0;flex:1;overflow:hidden;background:radial-gradient(circle at center,color-mix(in srgb,var(--dsw-alias-border-l2) 34%,transparent) 1px,transparent 1px) 0 0/24px 24px,var(--dsw-alias-bg-layer-1);cursor:grab;touch-action:none;}
      .pmrw-graph-viewport.panning{cursor:grabbing;}
      .pmrw-graph-stage{position:relative;min-width:100%;min-height:300px;transform-origin:0 0;will-change:transform;}
      .pmrw-graph-edges{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;}
      .pmrw-graph-edges path{fill:none;stroke:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 44%,var(--dsw-alias-border-l3));stroke-width:1.5;}
      .pmrw-graph-edge-hit{stroke:transparent!important;stroke-width:14!important;pointer-events:stroke;cursor:grab;}
      .pmrw-graph-edge-hit.dragging{cursor:grabbing;}
      .pmrw-graph-controls{position:absolute;right:14px;bottom:14px;z-index:6;display:flex;align-items:center;gap:6px;}
      .pmrw-graph-icon-button{width:34px;height:34px;display:grid;place-items:center;padding:0;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);box-shadow:0 8px 22px rgba(0,0,0,.2);cursor:pointer;}
      .pmrw-graph-icon-button:hover{border-color:var(--dsw-alias-accent-primary,#4f8ef7);color:var(--dsw-alias-label-primary);}
      .pmrw-graph-icon-button svg{width:15px;height:15px;fill:none;stroke:currentColor;}
      .pmrw-graph-node{position:absolute;align-content:start;box-shadow:0 8px 24px rgba(0,0,0,.12);cursor:grab;touch-action:none;user-select:none;}
      .pmrw-graph-node.dragging{cursor:grabbing;z-index:3;box-shadow:0 0 0 1px var(--dsw-alias-accent-primary,#4f8ef7),0 14px 34px rgba(0,0,0,.24);}
      .pmrw-graph-node.selected{box-shadow:0 0 0 1px var(--dsw-alias-accent-primary,#4f8ef7),0 10px 28px rgba(30,90,200,.16);}
      .pmrw-plan-node{min-width:0;display:grid;gap:5px;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
      .pmrw-plan-node:hover,.pmrw-plan-node.selected{border-color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmrw-plan-node strong{font-size:11.5px;line-height:1.4;}
      .pmrw-plan-node p{margin:0;color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .pmrw-plan-node-meta,.pmrw-plan-node-deps{color:var(--dsw-alias-label-tertiary);font-size:9px;}
      .pmrw-graph-title-row{display:flex;align-items:flex-start;gap:6px;min-width:0;}
      .pmrw-graph-title-row strong{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmrw-graph-title-row .pmrw-plan-status-pill{flex:none;min-height:18px;padding:0 5px;font-size:8px;line-height:18px;}
      .pmrw-graph-meta-line{display:flex;align-items:center;gap:5px;min-width:0;}
      .pmrw-graph-meta-line .pmrw-plan-node-meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmrw-plan-list-node{display:grid;gap:7px;padding:12px 14px;}
      .pmrw-list-node-title{font-size:12.5px!important;line-height:1.45;}
      .pmrw-list-node-title.status-waiting{color:var(--dsw-alias-label-secondary);}
      .pmrw-list-node-title.status-ready{color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmrw-list-node-title.status-dispatching,.pmrw-list-node-title.status-running{color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmrw-list-node-title.status-submitted,.pmrw-list-node-title.status-review{color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 68%,#c58cff);}
      .pmrw-list-node-title.status-accepted{color:var(--dsw-alias-state-success-primary,#34c78d);}
      .pmrw-list-node-title.status-needs_input{color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmrw-list-node-title.status-blocked,.pmrw-list-node-title.status-failed{color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmrw-list-node-title.status-cancelled{color:var(--dsw-alias-label-tertiary);text-decoration:line-through;}
      .pmrw-list-node-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmrw-list-node-field{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%;}
      .pmrw-list-node-field em{font-style:normal;color:var(--dsw-alias-label-tertiary);}
      .pmrw-list-node-field b{min-width:0;max-width:min(300px,34vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-weight:560;}
      .pmrw-executor-ai-tag{flex:none;padding:0 4px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);font-size:8px;font-style:normal;font-weight:650;line-height:1.55;}
      .pmrw-plan-table{min-height:0;flex:1;overflow:auto;padding:8px 14px 14px;}
      .pmrw-plan-table-head,.pmrw-plan-table-row{display:grid;grid-template-columns:minmax(300px,1.75fr) minmax(150px,.62fr) minmax(230px,1fr);gap:12px;align-items:start;min-width:720px;}
      .pmrw-plan-table-head{position:sticky;top:-8px;z-index:2;padding:7px 11px 8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
      .pmrw-plan-table-row{width:100%;padding:9px 11px;border:1px solid transparent;border-bottom-color:var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
      .pmrw-plan-table-row:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmrw-plan-table-row.selected{border-color:var(--dsw-alias-accent-primary,#4f8ef7);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,var(--dsw-alias-bg-layer-2));}
      .pmrw-plan-table-task{min-width:0;display:flex;align-items:flex-start;gap:7px;}
      .pmrw-plan-table-copy{min-width:0;flex:1;}
      .pmrw-plan-table-title-row{display:flex;align-items:center;gap:6px;min-width:0;}
      .pmrw-plan-table-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:11px;font-weight:650;line-height:1.5;}
      .pmrw-list-priority{flex:none;padding:0 4px;border-radius:3px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary);font-size:8px;line-height:1.55;}
      .pmrw-plan-table-subtitle{display:-webkit-box;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:8.5px;line-height:1.45;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .pmrw-plan-table-cell{min-width:0;min-height:26px;display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:9px;line-height:1.45;}
      .pmrw-plan-owner{display:flex;align-items:center;gap:6px;min-width:0;}
      .pmrw-plan-owner-avatar{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 18%,transparent);color:var(--dsw-alias-state-success-primary,#34c78d);font-size:8px;font-weight:700;}
      .pmrw-plan-owner-avatar.agent{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 17%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmrw-plan-owner-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:9.5px;}
      .pmrw-plan-status-pill{display:inline-flex;align-items:center;min-height:22px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:8.5px;white-space:nowrap;}
      .pmrw-plan-status-pill.blue{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 28%,transparent);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 10%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmrw-plan-status-pill.green{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 28%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#34c78d) 10%,transparent);color:var(--dsw-alias-state-success-primary,#34c78d);}
      .pmrw-plan-status-pill.amber{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 9%,transparent);color:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmrw-plan-status-pill.coral{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 9%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmrw-plan-status-pill.violet{border-color:color-mix(in srgb,#b58cff 35%,transparent);background:color-mix(in srgb,#b58cff 10%,transparent);color:#c7a8ff;}
      .pmrw-plan-deps{display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,24px);grid-auto-columns:max-content;align-items:center;gap:5px;min-width:max-content;}
      .pmrw-plan-dep-chip{max-width:180px;min-height:24px;display:inline-flex;align-items:center;gap:5px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:8.5px;}
      .pmrw-plan-dep-chip>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmrw-plan-dep-dot{width:6px;height:6px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary);}
      .pmrw-plan-dep-dot.green{background:var(--dsw-alias-state-success-primary,#34c78d);}
      .pmrw-plan-dep-dot.blue{background:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmrw-plan-dep-dot.amber{background:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmrw-plan-dep-dot.coral{background:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmrw-plan-dep-empty{color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
      .pmrw-plan-policy{margin:0 14px 12px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.5;}
      .pmrw-task-plan-side{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmrw-task-plan-side-embedded{min-width:0;overflow:hidden;}
      .pmrw-task-plan-side-embedded>.pmrw-embedded-task-detail{min-height:0;flex:1;}
      .pmrw-plan-side-head{display:grid;gap:6px;padding:14px 16px 11px;border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmrw-plan-side-head span{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmrw-plan-side-head h2{margin:0;font-size:16px;line-height:1.35;}
      .pmrw-plan-side-head code{color:var(--dsw-alias-label-tertiary);font-size:9.5px;}
      .pmrw-plan-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--dsw-alias-border-l2);}
      .pmrw-plan-tabs button{height:36px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:9.5px;cursor:pointer;}
      .pmrw-plan-tabs button.active{border-bottom-color:var(--dsw-alias-accent-primary,#4f8ef7);color:var(--dsw-alias-label-primary);}
      .pmrw-plan-side-body{min-height:0;flex:1;overflow:auto;padding:14px 16px;}
      .pmrw-plan-side-empty{display:grid;place-content:center;gap:6px;flex:1;padding:24px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmrw-plan-info-grid{display:grid;grid-template-columns:88px minmax(0,1fr);gap:8px 10px;font-size:10.5px;}
      .pmrw-plan-info-grid span{color:var(--dsw-alias-label-tertiary);}
      .pmrw-plan-info-grid strong{overflow-wrap:anywhere;font-weight:550;}
      .pmrw-plan-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
      .pmrw-plan-settings-page{min-height:0;flex:1;align-content:start;overflow:auto;padding:18px 20px;border-bottom:0;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmrw-plan-settings label{display:grid;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
      .pmrw-plan-settings input,.pmrw-plan-settings select,.pmrw-plan-settings textarea{min-width:0;padding:6px 7px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;}
      .pmrw-plan-settings input,.pmrw-plan-settings select{height:28px;}
      .pmrw-plan-settings textarea{min-height:54px;resize:vertical;}
      .pmrw-plan-policy-inline{grid-column:1/-1;color:var(--dsw-alias-label-secondary);font-size:9px;}
      .pmrw-setting-check{display:flex!important;grid-template-columns:none!important;align-items:center;gap:5px!important;color:var(--dsw-alias-label-secondary)!important;font-size:9.5px!important;}
      .pmrw-setting-check input{height:auto!important;}
      .pmrw-worker-types{grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:9px;}
      .pmrw-worker-types label{display:flex;align-items:center;gap:4px;}
      .pmrw-worker-types input{height:auto;}
      .pmrw-node-form{display:grid;gap:9px;}
      .pmrw-node-form>label{display:grid;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
      .pmrw-node-form input,.pmrw-node-form textarea,.pmrw-node-form select,.pmrw-dependency-editor input{min-width:0;padding:6px 7px;border:1px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;}
      .pmrw-node-form textarea{min-height:62px;resize:vertical;}
      .pmrw-add-status{margin:10px 14px 0;padding:8px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 26%,var(--dsw-alias-border-l2));border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 5%,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.55;}
      .pmrw-add-draft-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:4px;}
      .pmrw-dependency-editor{display:grid;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:9px;}
      .pmrw-dependency-chips{display:flex;gap:5px;flex-wrap:wrap;min-height:24px;align-items:center;}
      .pmrw-dependency-chip{max-width:100%;display:inline-flex;align-items:center;gap:5px;padding:3px 4px 3px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:9px;}
      .pmrw-dependency-chip>span{min-width:0;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmrw-dependency-chip button{width:18px;height:18px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;}
      .pmrw-dependency-chip button:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmrw-dependency-empty{display:flex;min-height:24px;align-items:center;color:var(--dsw-alias-label-tertiary);font-size:9px;}
      .pmrw-dependency-combo{position:relative;display:flex;align-items:center;gap:4px;}
      .pmrw-dependency-combo input{flex:1 1 auto;padding-right:28px!important;}
      .pmrw-dependency-toggle{position:absolute;right:4px;width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;}
      .pmrw-dependency-toggle:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);}
      .pmrw-dependency-options{display:grid;gap:4px;max-height:190px;overflow:auto;padding:5px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 8px 22px rgba(0,0,0,.2);}
      .pmrw-dependency-options button{min-height:34px;display:grid;gap:2px;padding:5px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:9px;text-align:left;cursor:pointer;}
      .pmrw-dependency-options button strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:9.5px;font-weight:550;}
      .pmrw-dependency-options button small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
      .pmrw-dependency-options button:disabled{opacity:.45;cursor:not-allowed;}
      .pmrw-dependency-option-empty{padding:8px;color:var(--dsw-alias-label-tertiary);font-size:9px;text-align:center;}
      .pmrw-dependency-hint{padding:2px 4px 0;color:var(--dsw-alias-label-tertiary);font-size:8px;line-height:1.5;}
      .pmrw-plan-record-list{display:grid;gap:7px;}
      .pmrw-plan-record{display:grid;gap:4px;padding:8px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmrw-plan-record strong{font-size:10px;}
      .pmrw-plan-record p{margin:0;color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.5;white-space:pre-wrap;}
      .pmrw-plan-record.error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 35%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 6%,var(--dsw-alias-bg-layer-2));}
      .pmrw-plan-record.error strong{color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmrw-plan-record-meta{display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--dsw-alias-label-tertiary);font-size:8.5px;}
    `;

    function token() {
      return (
        window.localStorage.getItem("pluginmax.collab.token") ??
        window.localStorage.getItem("collab-token")
      );
    }

    async function request(url, options = {}) {
      const headers = { ...options.headers };
      const current = token();
      if (current !== null) headers.authorization = `Bearer ${current}`;
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
      const response = await fetch(url, { ...options, headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      return body;
    }

    function SettingsIcon() {
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
        h("path", { d: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" }),
        h("path", {
          d: "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.36.34.7.6 1 .3.3.7.46 1.1.46H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z",
        }),
      );
    }

    function GraphOrganizeIcon() {
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
        h("rect", { x: 3, y: 3, width: 7, height: 7, rx: 1 }),
        h("rect", { x: 14, y: 3, width: 7, height: 7, rx: 1 }),
        h("rect", { x: 14, y: 14, width: 7, height: 7, rx: 1 }),
        h("rect", { x: 3, y: 14, width: 7, height: 7, rx: 1 }),
      );
    }

    function GraphExpandIcon(props) {
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
        props.expanded
          ? h(
              react.Fragment,
              null,
              h("path", { d: "M8 3v3a2 2 0 0 1-2 2H3" }),
              h("path", { d: "M21 8h-3a2 2 0 0 1-2-2V3" }),
              h("path", { d: "M16 21v-3a2 2 0 0 1 2-2h3" }),
              h("path", { d: "M3 16h3a2 2 0 0 1 2 2v3" }),
            )
          : h(
              react.Fragment,
              null,
              h("path", { d: "M8 3H5a2 2 0 0 0-2 2v3" }),
              h("path", { d: "M21 8V5a2 2 0 0 0-2-2h-3" }),
              h("path", { d: "M16 21h3a2 2 0 0 0 2-2v-3" }),
              h("path", { d: "M3 16v3a2 2 0 0 0 2 2h3" }),
            ),
      );
    }

    function ExtensionSettings(props) {
      const workspaceIds = Array.isArray(props.workspaceIds)
        ? props.workspaceIds.filter(Boolean)
        : [];
      const initialWorkspace = props.workspaceId || workspaceIds[0] || "";
      const [open, setOpen] = react.useState(false);
      const [workspaceId, setWorkspaceId] = react.useState(initialWorkspace);
      const [settings, setSettings] = react.useState(null);
      const [routerAgents, setRouterAgents] = react.useState([]);
      const [defaultRouterId, setDefaultRouterId] = react.useState("");
      const [busy, setBusy] = react.useState(false);
      const [error, setError] = react.useState("");

      react.useEffect(() => {
        if (!open) return;
        setWorkspaceId(initialWorkspace);
        setSettings(stateByWorkspace.get(initialWorkspace) ?? null);
      }, [open, initialWorkspace]);

      const load = async (targetWorkspaceId) => {
        if (!targetWorkspaceId) return;
        setBusy(true);
        setError("");
        try {
          const [settingsBody, routerBody] = await Promise.all([
            request(
              `/api/collab/router-worker/settings?workspaceId=${encodeURIComponent(targetWorkspaceId)}`,
            ),
            request(
              `/api/collab/router-worker/router-agents?workspaceId=${encodeURIComponent(targetWorkspaceId)}`,
            ),
          ]);
          stateByWorkspace.set(targetWorkspaceId, settingsBody.settings);
          setSettings(settingsBody.settings);
          const agents = Array.isArray(routerBody.result?.agents)
            ? routerBody.result.agents
            : [];
          setRouterAgents(agents);
          setDefaultRouterId(
            routerBody.result?.defaultRouterAgentId ??
              settingsBody.settings.defaultRouterAgentId ??
              agents.find((agent) => agent.isDefault)?.id ??
              agents[0]?.id ??
              "",
          );
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "加载失败");
        } finally {
          setBusy(false);
        }
      };

      const openSettings = () => {
        const target = initialWorkspace || workspaceIds[0] || "";
        setOpen(true);
        setWorkspaceId(target);
        void load(target);
      };

      const save = async (nextEnabled = settings?.enabled !== true) => {
        if (!workspaceId) return;
        setBusy(true);
        setError("");
        try {
          const result = await request(
            "/api/collab/router-worker/settings/update",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId,
                enabled: nextEnabled,
                defaultRouterAgentId: defaultRouterId || null,
                ...(settings === null
                  ? {}
                  : { expectedRevision: settings.revision }),
              }),
            },
          );
          stateByWorkspace.set(workspaceId, result.settings);
          window.localStorage.setItem(
            enabledKey(workspaceId),
            String(result.settings.enabled === true),
          );
          setSettings(result.settings);
          window.dispatchEvent(
            new CustomEvent("pluginmax:router-worker-gate", {
              detail: result.settings,
            }),
          );
          setOpen(false);
          if (nextEnabled === true) props.onOpenPlan?.();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "保存失败");
        } finally {
          setBusy(false);
        }
      };

      const enabled = settings?.enabled === true;
      const willEnable = settings?.enabled !== true;
      const localEnabled = enabled || locallyEnabled(workspaceId);
      return h(
        react.Fragment,
        null,
        h("style", null, styles),
        h(
          "span",
          { className: "pmrw-task-actions" },
          localEnabled && typeof props.onOpenPlan === "function"
            ? h(
                "button",
                {
                  className: "pmrw-plan-entry",
                  type: "button",
                  onClick: props.onOpenPlan,
                },
                "任务规划",
              )
            : null,
          h(
            "button",
            {
              className: "pmrw-settings-trigger",
              type: "button",
              title: "扩展设置",
              "aria-label": "扩展设置",
              onClick: openSettings,
            },
            h(SettingsIcon),
            localEnabled ? h("span", { className: "pmrw-enabled-dot" }) : null,
          ),
        ),
        open
          ? h(
              "div",
              {
                className: "pmrw-modal-backdrop",
                role: "presentation",
                onMouseDown: (event) => {
                  if (event.target === event.currentTarget) setOpen(false);
                },
              },
              h(
                "section",
                {
                  className: "pmrw-modal",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": "扩展设置",
                },
                h(
                  "header",
                  { className: "pmrw-modal-head" },
                  h("div", null, h("h2", null, "扩展设置")),
                  h(
                    "button",
                    {
                      className: "pmrw-icon-button",
                      type: "button",
                      onClick: () => setOpen(false),
                      "aria-label": "关闭",
                    },
                    "×",
                  ),
                ),
                h(
                  "div",
                  { className: "pmrw-modal-body" },
                  workspaceIds.length > 1
                    ? h(
                        "label",
                        { className: "pmrw-field" },
                        "Workspace",
                        h(
                          "select",
                          {
                            value: workspaceId,
                            onChange: (event) => {
                              const next = event.target.value;
                              setWorkspaceId(next);
                              setSettings(stateByWorkspace.get(next) ?? null);
                              void load(next);
                            },
                          },
                          ...workspaceIds.map((id) =>
                            h("option", { key: id, value: id }, id),
                          ),
                        ),
                      )
                    : null,
                  h(
                    "div",
                    { className: "pmrw-settings-card" },
                    h(
                      "div",
                      null,
                      h("strong", null, "Router / Worker 任务规划"),
                      h(
                        "p",
                        null,
                        "在现有任务详情中增加执行计划、人工与 AI Worker 协作。关闭后保留数据并停止新派发。",
                      ),
                    ),
                    h(
                      "span",
                      {
                        className: `pmrw-state ${enabled ? "enabled" : ""}`,
                      },
                      enabled ? "已启用" : "未启用",
                    ),
                  ),
                  h(
                    "label",
                    { className: "pmrw-field" },
                    "默认 Router Agent",
                    routerAgents.length === 0
                      ? h(
                          "span",
                          { className: "pmrw-router-empty-hint" },
                          "当前 Workspace 没有可用的 Router 类型 Agent。启用会自动创建通用任务 Router。",
                        )
                      : h(
                          "select",
                          {
                            value: defaultRouterId,
                            onChange: (event) =>
                              setDefaultRouterId(event.target.value),
                          },
                          ...routerAgents.map((agent) =>
                            h(
                              "option",
                              { key: agent.id, value: agent.id },
                              `${agent.name} · Router 类型${agent.isDefault ? " · 当前默认" : ""}`,
                            ),
                          ),
                        ),
                  ),
                  h(
                    "p",
                    { className: "pmrw-plan-persistence-note" },
                    "计划创建后会固化 Router Agent；修改这里只影响新计划。已有计划需要显式迁移，不能运行中途临时切换。",
                  ),
                  error ? h("p", { className: "pmrw-error" }, error) : null,
                ),
                h(
                  "footer",
                  { className: "pmrw-modal-foot" },
                  h(
                    "button",
                    {
                      className: "pmrw-button secondary",
                      type: "button",
                      onClick: () => setOpen(false),
                    },
                    "取消",
                  ),
                  enabled
                    ? h(
                        "button",
                        {
                          className: "pmrw-button secondary",
                          type: "button",
                          disabled: busy || !workspaceId || !defaultRouterId,
                          onClick: () => void save(true),
                        },
                        busy ? "保存中..." : "保存 Router 设置",
                      )
                    : null,
                  h(
                    "button",
                    {
                      className: "pmrw-button primary",
                      type: "button",
                      disabled:
                        busy ||
                        !workspaceId ||
                        (willEnable && !defaultRouterId),
                      onClick: () => void save(enabled ? false : true),
                    },
                    busy ? "处理中..." : enabled ? "关闭扩展" : "启用扩展",
                  ),
                ),
              ),
            )
          : null,
      );
    }

    async function fetchPlan(taskId, workspaceId) {
      const body = await request(
        `/api/collab/router-worker/plans/root?workspaceId=${encodeURIComponent(workspaceId)}&rootTaskId=${encodeURIComponent(taskId)}`,
      );
      publishPlan(taskId, body.result);
      return body.result;
    }

    async function waitForRouterPlan(
      taskId,
      workspaceId,
      cycleId,
      shouldContinue,
    ) {
      const timeoutMs = 10 * 60_000;
      const intervalMs = 750;
      const startedAt = Date.now();
      let latest = null;
      while (Date.now() - startedAt < timeoutMs) {
        if (shouldContinue !== undefined && !shouldContinue()) return latest;
        latest = await fetchPlan(taskId, workspaceId);
        if (latest?.plan?.source === "router") return latest;
        const cycle = (
          await request(
            `/api/collab/router-worker/plans/router/status?cycleId=${encodeURIComponent(cycleId)}`,
          )
        ).result;
        if (cycle?.runStatus === "waiting_input") {
          throw new Error(
            "Router 正在等待补充信息，当前自动解析页面不支持交互提问。请点击重新解析。",
          );
        }
        if (cycle?.status === "failed") {
          throw new Error(cycle.error ?? "Router Cycle 执行失败");
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      throw new Error(
        "Router 仍在解析，已超过当前页面等待时间。请稍后重新打开计划查看结果。",
      );
    }

    async function waitForRouterRegeneration(
      taskId,
      workspaceId,
      cycleId,
      previousVersion,
      shouldContinue,
    ) {
      const timeoutMs = 10 * 60_000;
      const intervalMs = 750;
      const startedAt = Date.now();
      let latest = null;
      while (Date.now() - startedAt < timeoutMs) {
        if (shouldContinue !== undefined && !shouldContinue()) return latest;
        latest = await fetchPlan(taskId, workspaceId);
        if (
          latest?.plan !== null &&
          latest?.plan?.currentVersion > previousVersion &&
          ["draft", "proposed"].includes(latest.plan.status)
        ) {
          return latest;
        }
        const cycle = (
          await request(
            `/api/collab/router-worker/plans/router/status?cycleId=${encodeURIComponent(cycleId)}`,
          )
        ).result;
        if (cycle?.status === "failed") {
          throw new Error(cycle.error ?? "Router 重新生成失败");
        }
        if (cycle?.status === "submitted") return latest;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      throw new Error("Router 仍在重新生成，请稍后重新打开计划查看结果");
    }

    async function createDefaultPlan(props) {
      const receiverId = props.receiverId;
      const graph = {
        nodes: [
          {
            id: "work",
            title: props.taskTitle || "执行任务",
            description: "完成主任务要求并提交可验收结果。",
            type: "task",
            receiverType: props.receiverType || "human",
            ...(receiverId === undefined ? {} : { receiverId }),
            ...(props.receiverName === undefined
              ? {}
              : { receiverName: props.receiverName }),
            ...(props.receiverPrincipalId === undefined
              ? {}
              : { receiverPrincipalId: props.receiverPrincipalId }),
            priority: props.taskPriority || "P2",
            ...(props.taskDue === undefined ? {} : { due: props.taskDue }),
            acceptance:
              Array.isArray(props.acceptance) && props.acceptance.length > 0
                ? props.acceptance
                : ["提交任务结果"],
            dependencies: [],
            reviewMode: "human",
            maxAttempts: 2,
            timeoutSeconds: 86400,
          },
        ],
      };
      await request("/api/collab/router-worker/plans/create", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          rootTaskId: props.taskId,
          source: "manual",
          graph,
        }),
      });
      return fetchPlan(props.taskId, props.workspaceId);
    }

    async function savePlanGraph(props, detail, graph, settings, reason) {
      await request("/api/collab/router-worker/plans/save", {
        method: "POST",
        body: JSON.stringify({
          planId: detail.plan.id,
          expectedRevision: detail.plan.revision,
          graph,
          ...(settings === undefined ? {} : { settings }),
          reason,
        }),
      });
      return fetchPlan(props.taskId, props.workspaceId);
    }

    function dependencyCreatesCycle(nodes, nodeId, dependencyId) {
      if (nodeId === dependencyId) return true;
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const seen = new Set();
      const reaches = (current) => {
        if (current === nodeId) return true;
        if (seen.has(current)) return false;
        seen.add(current);
        return (byId.get(current)?.dependencies ?? []).some(reaches);
      };
      return reaches(dependencyId);
    }

    function planGraphLayout(nodes) {
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const levels = new Map();
      const visiting = new Set();
      const level = (id) => {
        if (levels.has(id)) return levels.get(id);
        if (visiting.has(id)) return 0;
        visiting.add(id);
        const dependencies = byId.get(id)?.dependencies ?? [];
        const value =
          dependencies.length === 0
            ? 0
            : Math.max(...dependencies.map((dependency) => level(dependency))) +
              1;
        visiting.delete(id);
        levels.set(id, value);
        return value;
      };
      nodes.forEach((node) => level(node.id));
      const groups = new Map();
      for (const node of nodes) {
        const value = levels.get(node.id) ?? 0;
        const group = groups.get(value) ?? [];
        group.push(node);
        groups.set(value, group);
      }
      const width = Math.max(760, (Math.max(...levels.values(), 0) + 1) * 280);
      const maxCount = Math.max(
        ...[...groups.values()].map((group) => group.length),
        1,
      );
      const height = Math.max(300, maxCount * 150 + 60);
      const positions = new Map();
      for (const [value, group] of groups) {
        const total = group.length * 140 + Math.max(0, group.length - 1) * 18;
        let y = Math.max(30, (height - total) / 2);
        for (const node of group) {
          positions.set(node.id, {
            x: 30 + value * 280,
            y,
            width: 228,
            height: 124,
          });
          y += 158;
        }
      }
      return { positions, width, height };
    }

    function planNodeStatusMeta(status) {
      return (
        {
          waiting: { label: "等待前置", tone: "neutral" },
          ready: { label: "待执行", tone: "blue" },
          dispatching: { label: "派发中", tone: "amber" },
          running: { label: "执行中", tone: "blue" },
          submitted: { label: "已提交", tone: "violet" },
          review: { label: "待验收", tone: "amber" },
          accepted: { label: "已完成", tone: "green" },
          needs_input: { label: "待补充", tone: "coral" },
          blocked: { label: "已阻塞", tone: "coral" },
          failed: { label: "失败", tone: "coral" },
          cancelled: { label: "已取消", tone: "neutral" },
        }[status] ?? { label: status, tone: "neutral" }
      );
    }

    function planConfirmationMeta(status) {
      if (status === "draft" || status === "proposed") {
        return {
          key: "pending",
          label: "计划待确认",
          tone: "amber",
          pending: true,
        };
      }
      if (status === "cancelled") {
        return {
          key: "cancelled",
          label: "计划已取消",
          tone: "neutral",
          pending: false,
        };
      }
      if (status === "failed") {
        return {
          key: "failed",
          label: "计划失败",
          tone: "coral",
          pending: false,
        };
      }
      if (status === "approved") {
        return {
          key: "publishing",
          label: "派发未完成",
          tone: "amber",
          pending: true,
        };
      }
      if (status !== undefined) {
        return {
          key: "confirmed",
          label: "已派发",
          tone: "green",
          pending: false,
        };
      }
      return {
        key: "",
        label: "",
        tone: "neutral",
        pending: false,
      };
    }

    function taskStatusLabel(status) {
      return (
        {
          todo: "待处理",
          progress: "进行中",
          review: "待验收",
          done: "已完成",
          cancelled: "已取消",
        }[status] ?? status
      );
    }

    function planSideNotice(title, body, key = title, tone = "") {
      return h(
        "article",
        {
          key,
          className: `pmrw-plan-record${tone === "error" ? " error" : ""}`,
        },
        h("strong", null, title),
        h("p", null, body),
      );
    }

    function planSideStageCopy(planStatus, ownerName) {
      if (planStatus === "draft" || planStatus === "proposed") {
        return "计划尚未确认，确认并派发后才会创建子任务和执行记录。";
      }
      if (planStatus === "approved") {
        return "第二步“确认并派发”尚未完成，请重试；成功后会创建全部子任务。";
      }
      if (planStatus === "paused" || planStatus === "resume_required") {
        return "计划当前暂停；显式恢复前不会继续创建或推进子任务。";
      }
      if (planStatus === "completed") {
        return "计划已完成，未找到该节点对应的任务详情。";
      }
      if (planStatus === "cancelled" || planStatus === "failed") {
        return "计划已停止，该节点不会再创建新的执行记录。";
      }
      if (ownerName) {
        return `计划已进入执行阶段，正在同步 ${ownerName} 的子任务信息。`;
      }
      return "计划已进入执行阶段，正在同步子任务信息。";
    }

    function planNodePreviewStatus(nodeState) {
      return (
        {
          waiting: "todo",
          ready: "todo",
          dispatching: "progress",
          running: "progress",
          submitted: "review",
          review: "review",
          accepted: "done",
          needs_input: "progress",
          blocked: "progress",
          failed: "progress",
          cancelled: "cancelled",
        }[nodeState] ?? "todo"
      );
    }

    function planNodePreviewTask(result, node, nodeState) {
      const plan = result?.plan;
      const status = planNodePreviewStatus(nodeState?.status);
      const accepted = status === "done";
      const at =
        nodeState?.updatedAt ?? plan?.updatedAt ?? new Date().toISOString();
      return {
        id: `${plan?.id ?? "plan"}:${node.id}`,
        workspaceId: plan?.workspaceId ?? "",
        title: node.title,
        type: node.taskType ?? "任务",
        status,
        priority: node.priority,
        receiverType: node.receiverType,
        ...(node.receiverId === undefined
          ? {}
          : { receiverId: node.receiverId }),
        ...(node.receiverName === undefined
          ? {}
          : { receiverName: node.receiverName }),
        createdBy: plan?.createdBy ?? "system",
        createdByName: plan?.owner ?? plan?.createdBy ?? "任务规划",
        description: node.description,
        attachments: [],
        acceptance:
          Array.isArray(node.acceptance) && node.acceptance.length > 0
            ? node.acceptance
            : ["按任务描述完成并提交结果"],
        ...(node.due === undefined ? {} : { due: node.due }),
        ...(node.executionPolicy === undefined
          ? {}
          : { executionPolicy: node.executionPolicy }),
        links: [],
        progress: accepted ? 100 : status === "review" ? 86 : 0,
        sessionEpoch: 0,
        autoSubmitReview: node.autoSubmitReview ?? true,
        autoApproveReview: node.autoApproveReview ?? false,
        steps: (Array.isArray(node.acceptance) && node.acceptance.length > 0
          ? node.acceptance
          : ["按任务描述完成并提交结果"]
        ).map((label, index) => ({
          id: `step-${index + 1}`,
          label,
          done: accepted,
        })),
        agentRunIds: [],
        messages: [],
        comments: [],
        events: [],
        queueState: nodeState?.status === "waiting" ? "blocked" : "idle",
        dependsOn: Array.isArray(node.dependencies) ? node.dependencies : [],
        autoRunEligible: true,
        needsInput: nodeState?.status === "needs_input",
        createdAt: plan?.createdAt ?? at,
        updatedAt: at,
      };
    }

    function formatPlanTime(value) {
      if (typeof value !== "string" || value === "") return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }

    function PlanEntry(props) {
      const [recoveredEnabled, setRecoveredEnabled] = react.useState(false);
      const plan = usePlan(props.taskId);
      const localFlag = window.localStorage.getItem(
        enabledKey(props.workspaceId),
      );
      const workspaceSettings = stateByWorkspace.get(props.workspaceId);
      const knownDisabled =
        localFlag === "false" || workspaceSettings?.enabled === false;
      const enabled =
        !knownDisabled &&
        (localFlag === "true" ||
          workspaceSettings?.enabled === true ||
          recoveredEnabled ||
          (plan?.plan !== undefined && plan.plan !== null));
      const canRecoverPlan =
        !enabled &&
        !knownDisabled &&
        Array.isArray(props.task?.messages) &&
        props.task.messages.some(
          (message) =>
            message.kind === "agent" &&
            typeof message.content === "string" &&
            (message.content.includes("Plan Draft") ||
              message.content.includes("计划草案已提交")),
        );
      const shouldLoadPlan = canRecoverPlan || (enabled && plan === null);
      react.useEffect(() => {
        if (!shouldLoadPlan) return undefined;
        void fetchPlan(props.taskId, props.workspaceId)
          .then((result) => {
            if (result?.plan === undefined || result.plan === null) return;
            if (!enabled) {
              window.localStorage.setItem(
                enabledKey(props.workspaceId),
                "true",
              );
              setRecoveredEnabled(true);
            }
          })
          .catch(() => undefined);
        return undefined;
      }, [enabled, props.taskId, props.workspaceId, shouldLoadPlan]);
      if (!enabled) return null;
      const confirmation = planConfirmationMeta(plan?.plan?.status);
      const pendingConfirmation = confirmation.pending;
      const planHint =
        confirmation.key === "publishing"
          ? "任务规划派发未完成，打开继续处理"
          : pendingConfirmation
            ? "任务规划待确认，打开任务规划图"
            : "打开任务规划";
      return h(
        "button",
        {
          className: `pmtask-detail-action neutral pmrw-detail-plan-entry${pendingConfirmation ? " pending" : ""}`,
          style: { position: "relative" },
          type: "button",
          title: planHint,
          "aria-label": planHint,
          "aria-pressed": props.planOpen === true,
          onClick: props.onOpenPlan,
        },
        "任务规划",
        pendingConfirmation
          ? h("span", {
              className: "pmrw-plan-unread-dot",
              "aria-hidden": "true",
              style: {
                position: "absolute",
                top: "-3px",
                right: "-3px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--dsw-alias-state-error-primary,#e5534b)",
                boxShadow: "0 0 0 1px var(--dsw-alias-bg-layer-1)",
                pointerEvents: "none",
              },
            })
          : null,
      );
    }

    function PlanCenter(props) {
      const plan = usePlan(props.taskId);
      const addNodeDraft = useAddNodeDraft(props.taskId);
      const addOpen = addNodeDraft.active;
      const [view, setView] = react.useState("graph");
      const [busy, setBusy] = react.useState("");
      const [error, setError] = react.useState("");
      const [settingsOpen, setSettingsOpen] = react.useState(false);
      const [settingsDraft, setSettingsDraft] = react.useState(null);
      const [templates, setTemplates] = react.useState([]);
      const [templateId, setTemplateId] = react.useState("");
      const [routerAgents, setRouterAgents] = react.useState([]);
      const [routerAgentsLoading, setRouterAgentsLoading] =
        react.useState(false);
      const [selectedRouterId, setSelectedRouterId] = react.useState("");
      const [startMode, setStartMode] = react.useState("");
      const [routerProgress, setRouterProgress] = react.useState(0);
      const [routerElapsedSeconds, setRouterElapsedSeconds] =
        react.useState(0);
      const [regenerateOpen, setRegenerateOpen] = react.useState(false);
      const [regenerateMode, setRegenerateMode] = react.useState("router");
      const [regenerateRouterId, setRegenerateRouterId] = react.useState("");
      const [regenerateTemplateId, setRegenerateTemplateId] =
        react.useState("");
      const [graphPositionState, setGraphPositionState] = react.useState({
        key: "",
        positions: {},
      });
      const [graphEdgeState, setGraphEdgeState] = react.useState({
        key: "",
        edges: {},
      });
      const [canvasPan, setCanvasPan] = react.useState({ x: 0, y: 0 });
      const [canvasPanning, setCanvasPanning] = react.useState(false);
      const [graphFullscreen, setGraphFullscreen] = react.useState(false);
      const [draggingGraphNodeId, setDraggingGraphNodeId] = react.useState("");
      const [draggingGraphEdgeKey, setDraggingGraphEdgeKey] =
        react.useState("");
      const mountedRef = react.useRef(true);
      const graphPositionsRef = react.useRef({});
      const graphEdgesRef = react.useRef({});
      const graphDragRef = react.useRef(null);
      const graphEdgeDragRef = react.useRef(null);
      const canvasPanRef = react.useRef({ x: 0, y: 0 });
      const canvasPanDragRef = react.useRef(null);
      const suppressGraphClickRef = react.useRef("");
      react.useEffect(() => {
        mountedRef.current = true;
        return () => {
          mountedRef.current = false;
        };
      }, []);
      react.useEffect(() => {
        if (busy !== "router") {
          setRouterProgress(0);
          setRouterElapsedSeconds(0);
          return undefined;
        }
        const startedAt = performance.now();
        setRouterProgress(4);
        setRouterElapsedSeconds(0);
        let frame = 0;
        let lastUpdate = 0;
        const tick = (now) => {
          if (now - lastUpdate >= 750) {
            lastUpdate = now;
            const elapsedSeconds = (now - startedAt) / 1000;
            setRouterElapsedSeconds(Math.floor(elapsedSeconds));
            setRouterProgress(
              Math.min(92, Math.round(4 + Math.sqrt(elapsedSeconds) * 13)),
            );
          }
          frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
      }, [busy]);
      react.useEffect(() => {
        if (!props.open) return;
        if (plan === null) setBusy("loading");
        setRouterAgentsLoading(true);
        void Promise.all([
          fetchPlan(props.taskId, props.workspaceId),
          request(
            `/api/collab/router-worker/router-agents?workspaceId=${encodeURIComponent(props.workspaceId)}`,
          ),
        ])
          .then(([, routerBody]) => {
            const agents = Array.isArray(routerBody.result?.agents)
              ? routerBody.result.agents
              : [];
            setRouterAgents(agents);
            const defaultId =
              routerBody.result?.defaultRouterAgentId ??
              agents.find((agent) => agent.isDefault)?.id ??
              agents[0]?.id ??
              "";
            setSelectedRouterId(defaultId);
          })
          .catch((cause) =>
            setError(cause instanceof Error ? cause.message : "加载计划失败"),
          )
          .finally(() => {
            setRouterAgentsLoading(false);
            setBusy("");
          });
      }, [props.open, props.taskId, props.workspaceId]);
      const detail = plan?.plan
        ? plan
        : plan?.result?.plan
          ? plan.result
          : null;
      const result = detail?.plan ? detail : null;
      const canManagePlan = result?.permissions?.canManage === true;
      const planConfirmation = planConfirmationMeta(result?.plan?.status);
      const finalDraft = result?.finalDraft ?? null;
      const nodes = result?.version?.graph?.nodes ?? [];
      const layout = planGraphLayout(nodes);
      const states = new Map(
        (result?.nodeStates ?? []).map((state) => [state.nodeId, state]),
      );
      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const orderedListNodes = nodes
        .map((node, index) => ({
          node,
          index,
          position: layout.positions.get(node.id),
        }))
        .sort(
          (left, right) =>
            (left.position?.x ?? 0) - (right.position?.x ?? 0) ||
            (left.position?.y ?? 0) - (right.position?.y ?? 0) ||
            left.index - right.index,
        )
        .map((entry) => entry.node);
      const planEditable =
        result?.plan !== undefined &&
        canManagePlan &&
        ["draft", "proposed", "approved"].includes(result.plan.status);
      const selected = nodes.find((node) => node.id === props.nodeId);
      const graphPositionsKey =
        result?.plan === undefined
          ? ""
          : [
              "pluginmax.router-worker.graph-positions",
              props.workspaceId,
              props.taskId,
              result.plan.id,
              result.plan.currentVersion,
            ].join(":");
      const graphEdgesKey =
        graphPositionsKey === "" ? "" : `${graphPositionsKey}:edges:v2`;
      react.useEffect(() => {
        let positions = {};
        if (graphPositionsKey !== "") {
          try {
            const stored = JSON.parse(
              window.localStorage.getItem(graphPositionsKey) ?? "{}",
            );
            if (stored !== null && typeof stored === "object") {
              positions = Object.fromEntries(
                Object.entries(stored).filter(
                  ([, value]) =>
                    value !== null &&
                    typeof value === "object" &&
                    Number.isFinite(value.x) &&
                    Number.isFinite(value.y),
                ),
              );
            }
          } catch {
            positions = {};
          }
        }
        graphPositionsRef.current = positions;
        setGraphPositionState({ key: graphPositionsKey, positions });
        canvasPanRef.current = { x: 0, y: 0 };
        setCanvasPan({ x: 0, y: 0 });
      }, [graphPositionsKey]);
      react.useEffect(() => {
        let edges = {};
        if (graphEdgesKey !== "") {
          try {
            const stored = JSON.parse(
              window.localStorage.getItem(graphEdgesKey) ?? "{}",
            );
            if (stored !== null && typeof stored === "object") {
              edges = Object.fromEntries(
                Object.entries(stored).filter(
                  ([, value]) =>
                    value !== null &&
                    typeof value === "object" &&
                    Number.isFinite(value.x) &&
                    Number.isFinite(value.y),
                ),
              );
            }
          } catch {
            edges = {};
          }
        }
        graphEdgesRef.current = edges;
        setGraphEdgeState({ key: graphEdgesKey, edges });
      }, [graphEdgesKey]);
      react.useEffect(() => {
        if (!graphFullscreen) return undefined;
        const onKeyDown = (event) => {
          if (event.key === "Escape") setGraphFullscreen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [graphFullscreen]);
      const activeGraphPositions =
        graphPositionState.key === graphPositionsKey
          ? graphPositionState.positions
          : {};
      const activeGraphEdges =
        graphEdgeState.key === graphEdgesKey ? graphEdgeState.edges : {};
      const graphPositions = new Map(layout.positions);
      for (const [nodeId, position] of Object.entries(activeGraphPositions)) {
        const base = layout.positions.get(nodeId);
        if (base === undefined) continue;
        graphPositions.set(nodeId, { ...base, x: position.x, y: position.y });
      }
      let graphWidth = layout.width;
      let graphHeight = layout.height;
      for (const position of graphPositions.values()) {
        graphWidth = Math.max(graphWidth, position.x + position.width + 36);
        graphHeight = Math.max(graphHeight, position.y + position.height + 36);
      }
      react.useEffect(() => {
        if (result?.plan?.settings) setSettingsDraft(result.plan.settings);
      }, [result?.plan?.updatedAt]);
      const approveAndDispatch = async () => {
        if (result === null) return;
        setBusy("publish");
        setError("");
        try {
          if (["draft", "proposed"].includes(result.plan.status)) {
            await request("/api/collab/router-worker/plans/approve", {
              method: "POST",
              body: JSON.stringify({
                planId: result.plan.id,
                expectedRevision: result.plan.revision,
              }),
            });
          }
          await request("/api/collab/router-worker/plans/materialize", {
            method: "POST",
            body: JSON.stringify({ planId: result.plan.id }),
          });
          await fetchPlan(props.taskId, props.workspaceId);
        } catch (cause) {
          await fetchPlan(props.taskId, props.workspaceId).catch(
            () => undefined,
          );
          setError(
            cause instanceof Error
              ? cause.message
              : "确认并派发未完成，请修复问题后重试",
          );
        } finally {
          setBusy("");
        }
      };
      const lifecycle = async (action) => {
        if (result === null) return;
        setBusy(action);
        setError("");
        try {
          await request(`/api/collab/router-worker/plans/${action}`, {
            method: "POST",
            body: JSON.stringify({ planId: result.plan.id }),
          });
          await fetchPlan(props.taskId, props.workspaceId);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "操作失败");
        } finally {
          setBusy("");
        }
      };
      const deleteSelected = async () => {
        if (!result || !selected) return;
        if (
          result.version.graph.nodes.some((node) =>
            node.dependencies.includes(selected.id),
          )
        ) {
          setError("当前节点仍被其他节点依赖，不能删除");
          return;
        }
        setBusy("delete");
        setError("");
        try {
          await savePlanGraph(
            props,
            result,
            {
              ...result.version.graph,
              nodes: result.version.graph.nodes.filter(
                (node) => node.id !== selected.id,
              ),
            },
            result.plan.settings,
            "删除任务节点",
          );
          props.onSelectNode("");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "删除节点失败");
        } finally {
          setBusy("");
        }
      };
      const startRouter = async (routerAgentId) => {
        if (!routerAgentId) {
          setError("请先在工作区扩展设置中指定 Router Agent");
          return;
        }
        setBusy("router");
        setError("");
        try {
          const started = await request(
            "/api/collab/router-worker/plans/router/start",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: props.workspaceId,
                rootTaskId: props.taskId,
                routerAgentId,
              }),
            },
          );
          const planned = await waitForRouterPlan(
            props.taskId,
            props.workspaceId,
            started.result.id,
            () =>
              mountedRef.current &&
              props.open &&
              locallyEnabled(props.workspaceId),
          );
          if (mountedRef.current && planned?.plan?.source !== "router") {
            setError("Router 解析已中断，请重新解析");
          }
        } catch (cause) {
          if (mountedRef.current) {
            setError(
              cause instanceof Error ? cause.message : "Router 启动失败",
            );
          }
        } finally {
          if (mountedRef.current) setBusy("");
        }
      };
      const beginAutoParse = () => {
        const routerAgentId =
          selectedRouterId ||
          routerAgents.find((agent) => agent.isDefault)?.id ||
          routerAgents[0]?.id ||
          "";
        setStartMode("auto");
        void startRouter(routerAgentId);
      };
      const updateGraphPosition = (nodeId, position) => {
        const next = {
          ...graphPositionsRef.current,
          [nodeId]: {
            x: Math.round(position.x),
            y: Math.round(position.y),
          },
        };
        graphPositionsRef.current = next;
        setGraphPositionState({ key: graphPositionsKey, positions: next });
      };
      const beginGraphNodeDrag = (event, node) => {
        if (event.button !== 0) return;
        const position = graphPositions.get(node.id);
        if (position === undefined) return;
        graphDragRef.current = {
          nodeId: node.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: position.x,
          originY: position.y,
          moved: false,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDraggingGraphNodeId(node.id);
      };
      const moveGraphNodeDrag = (event) => {
        const drag = graphDragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        drag.moved = true;
        event.preventDefault();
        event.stopPropagation();
        updateGraphPosition(drag.nodeId, {
          x: drag.originX + dx,
          y: drag.originY + dy,
        });
      };
      const endGraphNodeDrag = (event) => {
        const drag = graphDragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        if (drag.moved) {
          event.preventDefault();
          event.stopPropagation();
          suppressGraphClickRef.current = drag.nodeId;
          if (graphPositionsKey !== "") {
            window.localStorage.setItem(
              graphPositionsKey,
              JSON.stringify(graphPositionsRef.current),
            );
          }
        }
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        graphDragRef.current = null;
        setDraggingGraphNodeId("");
      };
      const updateGraphEdge = (edgeKey, point) => {
        const next = {
          ...graphEdgesRef.current,
          [edgeKey]: {
            x: Math.round(point.x),
            y: Math.round(point.y),
          },
        };
        graphEdgesRef.current = next;
        setGraphEdgeState({ key: graphEdgesKey, edges: next });
      };
      const beginGraphEdgeDrag = (event, edgeKey, point) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        graphEdgeDragRef.current = {
          edgeKey,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: point.x,
          originY: point.y,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDraggingGraphEdgeKey(edgeKey);
      };
      const moveGraphEdgeDrag = (event) => {
        const drag = graphEdgeDragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        updateGraphEdge(drag.edgeKey, {
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY,
        });
      };
      const endGraphEdgeDrag = (event) => {
        const drag = graphEdgeDragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        if (graphEdgesKey !== "") {
          window.localStorage.setItem(
            graphEdgesKey,
            JSON.stringify(graphEdgesRef.current),
          );
        }
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        graphEdgeDragRef.current = null;
        setDraggingGraphEdgeKey("");
      };
      const beginCanvasPan = (event) => {
        if (event.button !== 0) return;
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest(
            ".pmrw-graph-node,.pmrw-graph-edge-hit,.pmrw-graph-controls",
          ) !== null
        ) {
          return;
        }
        event.preventDefault();
        canvasPanDragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: canvasPanRef.current.x,
          originY: canvasPanRef.current.y,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setCanvasPanning(true);
      };
      const moveCanvasPan = (event) => {
        const drag = canvasPanDragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const next = {
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY,
        };
        canvasPanRef.current = next;
        setCanvasPan(next);
      };
      const endCanvasPan = (event) => {
        const drag = canvasPanDragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        canvasPanDragRef.current = null;
        setCanvasPanning(false);
      };
      const organizeGraph = () => {
        graphPositionsRef.current = {};
        graphEdgesRef.current = {};
        setGraphPositionState({ key: graphPositionsKey, positions: {} });
        setGraphEdgeState({ key: graphEdgesKey, edges: {} });
        canvasPanRef.current = { x: 0, y: 0 };
        setCanvasPan({ x: 0, y: 0 });
        if (graphPositionsKey !== "") {
          window.localStorage.removeItem(graphPositionsKey);
        }
        if (graphEdgesKey !== "") {
          window.localStorage.removeItem(graphEdgesKey);
        }
      };
      const loadTemplates = async () => {
        setBusy("templates");
        setError("");
        try {
          const body = await request(
            `/api/collab/workflow/definitions?workspaceId=${encodeURIComponent(props.workspaceId)}`,
          );
          setTemplates(body.definitions ?? []);
          setTemplateId(body.definitions?.[0]?.id ?? "");
          setRegenerateTemplateId(body.definitions?.[0]?.id ?? "");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "加载模板失败");
        } finally {
          setBusy("");
        }
      };
      const createFromTemplate = async () => {
        if (!templateId) return;
        setBusy("template");
        setError("");
        try {
          await request("/api/collab/router-worker/plans/from-template", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: props.workspaceId,
              rootTaskId: props.taskId,
              definitionId: templateId,
            }),
          });
          await fetchPlan(props.taskId, props.workspaceId);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "创建模板实例失败");
        } finally {
          setBusy("");
        }
      };
      const regeneratePlan = async () => {
        if (result === null) return;
        setError("");
        if (regenerateMode === "router") {
          const routerAgentId =
            regenerateRouterId ||
            selectedRouterId ||
            routerAgents.find((agent) => agent.isDefault)?.id ||
            routerAgents[0]?.id ||
            "";
          if (routerAgentId === "") {
            setError("没有可用的 Router Agent");
            return;
          }
          setBusy("regenerate-router");
          try {
            const started = await request(
              "/api/collab/router-worker/plans/regenerate/router",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId: props.workspaceId,
                  rootTaskId: props.taskId,
                  routerAgentId,
                }),
              },
            );
            await waitForRouterRegeneration(
              props.taskId,
              props.workspaceId,
              started.result.id,
              result.plan.currentVersion,
              () =>
                mountedRef.current &&
                props.open &&
                locallyEnabled(props.workspaceId),
            );
            setRegenerateOpen(false);
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Router 重新生成失败",
            );
          } finally {
            setBusy("");
          }
          return;
        }
        const definitionId = regenerateTemplateId || templates[0]?.id || "";
        if (definitionId === "") {
          setError("请选择工作流模板");
          return;
        }
        setBusy("regenerate-template");
        try {
          await request("/api/collab/router-worker/plans/regenerate/template", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: props.workspaceId,
              rootTaskId: props.taskId,
              definitionId,
            }),
          });
          await fetchPlan(props.taskId, props.workspaceId);
          setRegenerateOpen(false);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "模板重新生成失败");
        } finally {
          setBusy("");
        }
      };
      return h(
        "section",
        {
          className: `pmrw-task-plan-center${graphFullscreen ? " graph-fullscreen" : ""}`,
        },
        h("style", null, styles),
        h(
          "header",
          { className: "pmrw-plan-head" },
          h(
            "div",
            null,
            h(
              "div",
              { className: "pmrw-plan-title-line" },
              h("strong", null, props.taskTitle || "执行计划"),
              h("span", { className: "pmrw-plan-tag" }, "任务规划"),
              h(
                "span",
                { className: "pmrw-plan-title-meta" },
                result?.plan
                  ? `${result.plan.rootTaskId} · v${result.plan.currentVersion}`
                  : "尚未生成计划",
              ),
            ),
            result?.plan
              ? h(
                  "small",
                  null,
                  [
                    result.plan.owner ? `责任人 ${result.plan.owner}` : "",
                    result.plan.reviewer
                      ? `验收人 ${result.plan.reviewer}`
                      : "",
                    `优先级 ${result.plan.priority}`,
                    result.plan.due ? `DDL ${result.plan.due}` : "",
                    result.plan.routerAgentId
                      ? `任务规划 ${
                          routerAgents.find(
                            (agent) => agent.id === result.plan.routerAgentId,
                          )?.name ?? result.plan.routerAgentId
                        }`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                )
              : null,
          ),
          h(
            "div",
            { className: "pmrw-plan-head-actions" },
            h(
              "button",
              {
                className: "pmrw-button secondary",
                type: "button",
                onClick: props.onClosePlan,
              },
              "返回对话",
            ),
          ),
        ),
        result?.plan?.status === "finalizing"
          ? h(
              "div",
              { className: "pmrw-final-draft pending" },
              h("strong", null, "Router 正在生成交付草稿"),
              h(
                "p",
                null,
                "所有必做节点已经完成。Router 正在整理结果，完成前不会推进 Master Task 状态。",
              ),
            )
          : finalDraft
            ? h(
                "details",
                { className: "pmrw-final-draft", open: true },
                h(
                  "summary",
                  null,
                  result.plan.finalizationMode === "router_managed"
                    ? "最终交付汇总 · 已提交主任务人工验收"
                    : "交付草稿 · 等待主任务负责人确认",
                ),
                h("p", null, finalDraft.summary),
                finalDraft.acceptance.length > 0
                  ? h(
                      "div",
                      { className: "pmrw-final-draft-grid" },
                      ...finalDraft.acceptance.map((item, index) =>
                        h(
                          "div",
                          { key: `${item.criterion}:${String(index)}` },
                          h("span", null, item.criterion),
                          h(
                            "strong",
                            { className: item.status },
                            item.status === "covered"
                              ? "已覆盖"
                              : item.status === "partial"
                                ? "部分覆盖"
                                : "未覆盖",
                          ),
                          item.evidence
                            ? h("small", null, item.evidence)
                            : null,
                        ),
                      ),
                    )
                  : null,
                finalDraft.risks.length > 0
                  ? h(
                      "section",
                      null,
                      h("strong", null, "风险"),
                      ...finalDraft.risks.map((risk, index) =>
                        h("small", { key: `${risk}:${String(index)}` }, risk),
                      ),
                    )
                  : null,
                finalDraft.openQuestions.length > 0
                  ? h(
                      "section",
                      null,
                      h("strong", null, "待确认"),
                      ...finalDraft.openQuestions.map((question, index) =>
                        h(
                          "small",
                          { key: `${question}:${String(index)}` },
                          question,
                        ),
                      ),
                    )
                  : null,
              )
            : null,
        h(
          "div",
          { className: "pmrw-plan-toolbar" },
          h(
            "div",
            { className: "pmrw-segmented" },
            h(
              "button",
              {
                className: view === "graph" ? "active" : "",
                type: "button",
                onClick: () => setView("graph"),
              },
              "图",
            ),
            h(
              "button",
              {
                className: view === "list" ? "active" : "",
                type: "button",
                onClick: () => setView("list"),
              },
              "列表",
            ),
          ),
          result?.plan &&
            canManagePlan &&
            ["draft", "proposed", "approved"].includes(result.plan.status)
            ? h(
                "button",
                {
                  className: "pmrw-button secondary",
                  type: "button",
                  onClick: () => {
                    const next = !addOpen;
                    updateAddNodeDraft(
                      props.taskId,
                      next
                        ? { ...defaultAddNodeDraft(), active: true }
                        : defaultAddNodeDraft(),
                    );
                    props.onSelectNode(next ? "__add-task__" : "");
                  },
                },
                addOpen ? "取消添加" : "添加任务",
              )
            : null,
          result?.plan &&
            canManagePlan &&
            selected &&
            ["draft", "proposed", "approved"].includes(result.plan.status)
            ? h(
                "button",
                {
                  className: "pmrw-button secondary",
                  type: "button",
                  disabled: busy !== "",
                  onClick: () => void deleteSelected(),
                },
                busy === "delete" ? "删除中..." : "删除任务",
              )
            : null,
          planConfirmation.key !== ""
            ? h(
                "span",
                {
                  className: `pmrw-plan-status-pill ${planConfirmation.tone}`,
                  "data-plan-confirmation": planConfirmation.key,
                },
                planConfirmation.label,
              )
            : null,
          result?.plan
            ? h(
                "span",
                { className: "pmrw-plan-progress" },
                `${result?.nodeStates?.filter((state) => state.status === "accepted").length ?? 0}/${nodes.length} 完成`,
              )
            : null,
          result?.plan &&
            canManagePlan &&
            !["cancelled", "completed"].includes(result.plan.status)
            ? h(
                "button",
                {
                  className: "pmrw-button secondary",
                  type: "button",
                  disabled: busy !== "",
                  onClick: () => {
                    setRegenerateMode("router");
                    setRegenerateRouterId(
                      selectedRouterId ||
                        routerAgents.find((agent) => agent.isDefault)?.id ||
                        routerAgents[0]?.id ||
                        "",
                    );
                    setRegenerateTemplateId(templates[0]?.id ?? "");
                    setError("");
                    setRegenerateOpen(true);
                  },
                },
                "重新生成",
              )
            : null,
          result?.plan && canManagePlan
            ? h(
                "button",
                {
                  className: "pmrw-button secondary",
                  type: "button",
                  onClick: () => setSettingsOpen(!settingsOpen),
                },
                "计划设置",
              )
            : null,
          canManagePlan &&
            ["draft", "proposed", "approved"].includes(result?.plan?.status)
            ? h(
                "button",
                {
                  className: "pmrw-button primary",
                  type: "button",
                  disabled: busy !== "",
                  onClick: () => void approveAndDispatch(),
                },
                busy === "publish" ? "确认并派发中..." : "确认并派发",
              )
            : null,
          canManagePlan &&
            ["paused", "resume_required"].includes(result?.plan?.status)
            ? h(
                "button",
                {
                  className: "pmrw-button primary",
                  type: "button",
                  disabled: busy !== "",
                  onClick: () => void lifecycle("resume"),
                },
                busy === "resume" ? "恢复中..." : "显式恢复",
              )
            : null,
          canManagePlan &&
            ["active", "finalizing"].includes(result?.plan?.status)
            ? h(
                "button",
                {
                  className: "pmrw-button secondary",
                  type: "button",
                  disabled: busy !== "",
                  onClick: () => void lifecycle("pause"),
                },
                busy === "pause" ? "暂停中..." : "暂停",
              )
            : null,
        ),
        error ? h("div", { className: "pmrw-plan-error" }, error) : null,
        h(
          "div",
          { className: "pmrw-plan-content" },
          settingsOpen && canManagePlan && result?.plan
            ? h(
                "div",
                { className: "pmrw-plan-settings pmrw-plan-settings-page" },
                h(
                  "div",
                  { className: "pmrw-plan-policy-inline" },
                  planEditable
                    ? "计划派发前可以调整执行策略。"
                    : "计划已进入执行阶段，当前设置为只读。",
                ),
                h(
                  "label",
                  null,
                  "推进方式",
                  h(
                    "select",
                    {
                      value: settingsDraft?.advanceMode ?? "auto",
                      disabled: !planEditable,
                      onChange: (event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          advanceMode: event.target.value,
                        })),
                    },
                    h("option", { value: "auto" }, "自动推进"),
                    h("option", { value: "manual" }, "人工确认推进"),
                  ),
                ),
                h(
                  "label",
                  null,
                  "最大并发",
                  h("input", {
                    type: "number",
                    min: 1,
                    max: 20,
                    value: settingsDraft?.maxConcurrency ?? 3,
                    disabled: !planEditable,
                    onChange: (event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        maxConcurrency: Number(event.target.value),
                      })),
                  }),
                ),
                h(
                  "label",
                  null,
                  "失败策略",
                  h(
                    "select",
                    {
                      value: settingsDraft?.failurePolicy ?? "pause",
                      disabled: !planEditable,
                      onChange: (event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          failurePolicy: event.target.value,
                        })),
                    },
                    h("option", { value: "pause" }, "暂停计划"),
                    h("option", { value: "retry" }, "自动重试"),
                    h("option", { value: "block" }, "标记阻塞"),
                  ),
                ),
                h(
                  "label",
                  null,
                  "单节点超时（秒）",
                  h("input", {
                    type: "number",
                    min: 1,
                    value: settingsDraft?.timeoutSeconds ?? 86400,
                    disabled: !planEditable,
                    onChange: (event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        timeoutSeconds: Number(event.target.value),
                      })),
                  }),
                ),
                h(
                  "label",
                  null,
                  "自动重试次数",
                  h("input", {
                    type: "number",
                    min: 0,
                    max: 10,
                    value: settingsDraft?.retryLimit ?? 2,
                    disabled: !planEditable,
                    onChange: (event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        retryLimit: Number(event.target.value),
                      })),
                  }),
                ),
                h(
                  "label",
                  null,
                  "Router 汇总者",
                  h("input", {
                    value: settingsDraft?.routerAgentId ?? "",
                    placeholder: "人工路线图未绑定 Router",
                    readOnly: true,
                  }),
                ),
                h(
                  "label",
                  { className: "pmrw-setting-check" },
                  h("input", {
                    type: "checkbox",
                    checked: settingsDraft?.finalReview !== false,
                    disabled: !planEditable,
                    onChange: (event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        finalReview: event.target.checked,
                      })),
                  }),
                  "汇总前强制人工验收",
                ),
                h(
                  "label",
                  { className: "pmrw-setting-check" },
                  h("input", {
                    type: "checkbox",
                    checked: settingsDraft?.pauseOnInput !== false,
                    disabled: !planEditable,
                    onChange: (event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        pauseOnInput: event.target.checked,
                      })),
                  }),
                  "澄清时暂停下游依赖",
                ),
                h(
                  "div",
                  { className: "pmrw-worker-types" },
                  ...["human", "agent", "role"].map((type) =>
                    h(
                      "label",
                      { key: type },
                      h("input", {
                        type: "checkbox",
                        disabled: !planEditable,
                        checked:
                          settingsDraft?.allowedWorkers?.includes(type) ?? true,
                        onChange: (event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            allowedWorkers: event.target.checked
                              ? [
                                  ...new Set([
                                    ...(current?.allowedWorkers ?? []),
                                    type,
                                  ]),
                                ]
                              : (current?.allowedWorkers ?? []).filter(
                                  (worker) => worker !== type,
                                ),
                          })),
                      }),
                      type === "human"
                        ? "人类 Worker"
                        : type === "agent"
                          ? "AI Worker"
                          : "项目角色",
                    ),
                  ),
                ),
                planEditable
                  ? h(
                      "button",
                      {
                        className: "pmrw-button primary",
                        type: "button",
                        disabled: busy === "settings",
                        onClick: () => {
                          setBusy("settings");
                          void savePlanGraph(
                            props,
                            result,
                            result.version.graph,
                            settingsDraft,
                            "更新计划设置",
                          )
                            .then(() => setSettingsOpen(false))
                            .catch((cause) =>
                              setError(
                                cause instanceof Error
                                  ? cause.message
                                  : "保存计划设置失败",
                              ),
                            )
                            .finally(() => setBusy(""));
                        },
                      },
                      busy === "settings" ? "保存中..." : "保存设置",
                    )
                  : null,
                h(
                  "div",
                  { className: "pmrw-plan-policy-inline" },
                  "有效权限始终为项目权限范围 ∩ 任务负责人权限范围。",
                ),
              )
            : null,
          !settingsOpen && addOpen && result?.plan
            ? h(
                "div",
                { className: "pmrw-add-status", role: "status" },
                "正在右侧编辑新任务。填写完成后点击「创建任务」加入计划。",
              )
            : null,
          !settingsOpen && busy === "loading"
            ? h("div", { className: "pmrw-plan-empty" }, "正在加载执行计划...")
            : !settingsOpen && result === null
              ? h(
                  "div",
                  { className: "pmrw-plan-empty pmrw-plan-start" },
                  startMode === "auto"
                    ? null
                    : h("strong", null, "尚未生成执行计划"),
                  startMode === ""
                    ? h(
                        react.Fragment,
                        null,
                        h("p", null, "选择执行计划的创建方式。"),
                        h(
                          "div",
                          { className: "pmrw-start-options" },
                          h(
                            "button",
                            {
                              className: "pmrw-start-option",
                              type: "button",
                              onClick: beginAutoParse,
                            },
                            h("strong", null, "自动解析执行计划"),
                            h(
                              "span",
                              null,
                              "由 Router Agent 解析目标并生成任务规划",
                            ),
                          ),
                          h(
                            "button",
                            {
                              className: "pmrw-start-option",
                              type: "button",
                              onClick: () => setStartMode("manual"),
                            },
                            h("strong", null, "人工创建执行计划"),
                            h("span", null, "从当前任务手动搭建可编辑计划"),
                          ),
                          h(
                            "button",
                            {
                              className: "pmrw-start-option",
                              type: "button",
                              onClick: () => {
                                setStartMode("template");
                                if (templates.length === 0) {
                                  void loadTemplates();
                                }
                              },
                            },
                            h("strong", null, "按预置工作流执行"),
                            h("span", null, "选择已有工作流模板生成执行计划"),
                          ),
                        ),
                      )
                    : h(
                        "div",
                        { className: "pmrw-start-config" },
                        h(
                          "div",
                          { className: "pmrw-start-config-head" },
                          h(
                            "strong",
                            null,
                            startMode === "auto"
                              ? "自动解析执行计划"
                              : startMode === "manual"
                                ? "人工创建执行计划"
                                : "按预置工作流执行",
                          ),
                          h(
                            "button",
                            {
                              className: "pmrw-text-button",
                              type: "button",
                              disabled: busy !== "",
                              onClick: () => {
                                setStartMode("");
                                setError("");
                              },
                            },
                            "返回",
                          ),
                        ),
                        startMode === "auto"
                          ? h(
                              react.Fragment,
                              null,
                              busy === "router"
                                ? h(
                                    "div",
                                    {
                                      className: "pmrw-router-progress",
                                      role: "status",
                                      "aria-live": "polite",
                                    },
                                    h("strong", null, "正在解析执行计划"),
                                    h(
                                      "div",
                                      {
                                        className: "pmrw-router-progress-track",
                                        role: "progressbar",
                                        "aria-label": "Router 解析进度",
                                        "aria-valuemin": 0,
                                        "aria-valuemax": 100,
                                        "aria-valuenow": routerProgress,
                                      },
                                      h("span", {
                                        style: {
                                          width: `${routerProgress}%`,
                                        },
                                      }),
                                    ),
                                    h(
                                      "small",
                                      null,
                                      `${routerProgress}% · 已等待 ${routerElapsedSeconds} 秒 · ${routerAgents.find((agent) => agent.id === selectedRouterId)?.name ?? "Router Agent"} 正在读取主任务并生成可编辑草稿（通常需要 20–60 秒）`,
                                    ),
                                  )
                                : h(
                                    react.Fragment,
                                    null,
                                    h(
                                      "p",
                                      null,
                                      routerAgents.length === 0
                                        ? "尚未配置可用的 Router Agent，请先在任务看板右上角的扩展设置中指定。"
                                        : "自动解析未能启动，请重试或返回选择其他创建方式。",
                                    ),
                                    routerAgents.length > 0
                                      ? h(
                                          "button",
                                          {
                                            className: "pmrw-button primary",
                                            type: "button",
                                            onClick: beginAutoParse,
                                          },
                                          "重新解析",
                                        )
                                      : null,
                                  ),
                            )
                          : startMode === "manual"
                            ? h(
                                react.Fragment,
                                null,
                                h(
                                  "p",
                                  null,
                                  "从当前任务生成一个可编辑的基础执行计划，不调用 Router Agent。",
                                ),
                                h(
                                  "button",
                                  {
                                    className: "pmrw-button primary",
                                    type: "button",
                                    disabled: busy !== "",
                                    onClick: () => {
                                      setBusy("create");
                                      setError("");
                                      void createDefaultPlan(props)
                                        .catch((cause) =>
                                          setError(
                                            cause instanceof Error
                                              ? cause.message
                                              : "创建计划失败",
                                          ),
                                        )
                                        .finally(() => setBusy(""));
                                    },
                                  },
                                  busy === "create"
                                    ? "创建中..."
                                    : "创建人工执行计划",
                                ),
                              )
                            : h(
                                react.Fragment,
                                null,
                                h(
                                  "p",
                                  null,
                                  "选择一个预置工作流模板，按模板生成执行计划。",
                                ),
                                templates.length === 0
                                  ? h(
                                      "button",
                                      {
                                        className: "pmrw-button secondary",
                                        type: "button",
                                        disabled: busy !== "",
                                        onClick: () => void loadTemplates(),
                                      },
                                      busy === "templates"
                                        ? "加载中..."
                                        : "加载预置工作流",
                                    )
                                  : h(
                                      react.Fragment,
                                      null,
                                      h(
                                        "select",
                                        {
                                          value: templateId,
                                          onChange: (event) =>
                                            setTemplateId(event.target.value),
                                        },
                                        ...templates.map((template) =>
                                          h(
                                            "option",
                                            {
                                              key: template.id,
                                              value: template.id,
                                            },
                                            template.name,
                                          ),
                                        ),
                                      ),
                                      h(
                                        "button",
                                        {
                                          className: "pmrw-button primary",
                                          type: "button",
                                          disabled: busy !== "",
                                          onClick: () =>
                                            void createFromTemplate(),
                                        },
                                        busy === "template"
                                          ? "创建中..."
                                          : "按预置工作流执行",
                                      ),
                                    ),
                              ),
                      ),
                )
              : view === "list"
                ? h(
                    "div",
                    { className: "pmrw-plan-table" },
                    h(
                      "div",
                      { className: "pmrw-plan-table-head" },
                      h("span", null, "任务"),
                      h("span", null, "负责人"),
                      h("span", null, "前置任务"),
                    ),
                    ...orderedListNodes.map((node) => {
                      const state = states.get(node.id);
                      const status = state?.status ?? "waiting";
                      const statusMeta = planNodeStatusMeta(status);
                      const receiver =
                        node.receiverName || node.receiverId || "待指派";
                      const dependencies = node.dependencies
                        .map((dependencyId) => ({
                          node: nodesById.get(dependencyId),
                          status: states.get(dependencyId)?.status ?? "waiting",
                        }))
                        .filter((item) => item.node !== undefined);
                      return h(
                        "div",
                        {
                          className: `pmrw-plan-table-row${props.nodeId === node.id ? " selected" : ""}`,
                          key: node.id,
                          role: "button",
                          tabIndex: 0,
                          "data-status": status,
                          title: `状态：${statusMeta.label}`,
                          onClick: () => props.onSelectNode(node.id),
                          onKeyDown: (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              props.onSelectNode(node.id);
                            }
                          },
                        },
                        h(
                          "div",
                          { className: "pmrw-plan-table-task" },
                          h(
                            "span",
                            {
                              className: `pmrw-plan-status-pill ${statusMeta.tone}`,
                            },
                            statusMeta.label,
                          ),
                          h(
                            "div",
                            { className: "pmrw-plan-table-copy" },
                            h(
                              "div",
                              { className: "pmrw-plan-table-title-row" },
                              h(
                                "strong",
                                {
                                  className: "pmrw-plan-table-title",
                                },
                                node.title,
                              ),
                              h(
                                "span",
                                { className: "pmrw-list-priority" },
                                node.priority,
                              ),
                            ),
                            h(
                              "span",
                              { className: "pmrw-plan-table-subtitle" },
                              `${node.receiverType === "agent" ? "AI 执行" : "人工处理"} · ${node.acceptance[0] || "任务结果"}`,
                            ),
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmrw-plan-table-cell" },
                          h(
                            "span",
                            { className: "pmrw-plan-owner" },
                            h(
                              "span",
                              {
                                className: `pmrw-plan-owner-avatar${node.receiverType === "agent" ? " agent" : ""}`,
                              },
                              receiver.trim().slice(0, 1),
                            ),
                            h(
                              "span",
                              { className: "pmrw-plan-owner-name" },
                              receiver,
                            ),
                            node.receiverType === "agent"
                              ? h(
                                  "i",
                                  { className: "pmrw-executor-ai-tag" },
                                  "AI",
                                )
                              : null,
                          ),
                        ),
                        h(
                          "div",
                          { className: "pmrw-plan-table-cell" },
                          h(
                            "div",
                            { className: "pmrw-plan-deps" },
                            ...(dependencies.length > 0
                              ? dependencies.map((item) =>
                                  h(
                                    "span",
                                    {
                                      className: "pmrw-plan-dep-chip",
                                      key: item.node.id,
                                      title: item.node.title,
                                    },
                                    h("span", {
                                      className: `pmrw-plan-dep-dot ${planNodeStatusMeta(item.status).tone}`,
                                    }),
                                    h("span", null, item.node.title),
                                  ),
                                )
                              : [
                                  h(
                                    "span",
                                    {
                                      className: "pmrw-plan-dep-empty",
                                      key: "empty",
                                    },
                                    "无前置任务",
                                  ),
                                ]),
                          ),
                        ),
                      );
                    }),
                  )
                : !settingsOpen &&
                  h(
                    "div",
                    {
                      className: `pmrw-graph-viewport${canvasPanning ? " panning" : ""}`,
                      onPointerDown: beginCanvasPan,
                      onPointerMove: moveCanvasPan,
                      onPointerUp: endCanvasPan,
                      onPointerCancel: endCanvasPan,
                    },
                    h(
                      "div",
                      {
                        className: "pmrw-graph-stage",
                        style: {
                          width: `${graphWidth}px`,
                          height: `${graphHeight}px`,
                          transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
                        },
                      },
                      h(
                        "svg",
                        {
                          className: "pmrw-graph-edges",
                          viewBox: `0 0 ${graphWidth} ${graphHeight}`,
                          role: "group",
                          "aria-label": "计划依赖连线",
                        },
                        ...nodes.flatMap((node) => {
                          const child = graphPositions.get(node.id);
                          return node.dependencies.flatMap((dependencyId) => {
                            const parent = graphPositions.get(dependencyId);
                            if (!child || !parent) return [];
                            const childOnRight =
                              child.x + child.width / 2 >=
                              parent.x + parent.width / 2;
                            const sx = childOnRight
                              ? parent.x + parent.width
                              : parent.x;
                            const sy = parent.y + parent.height / 2;
                            const ex = childOnRight
                              ? child.x
                              : child.x + child.width;
                            const ey = child.y + child.height / 2;
                            const edgeKey = `${dependencyId}:${node.id}`;
                            const savedBend = activeGraphEdges[edgeKey];
                            const bend = savedBend ?? {
                              x: (sx + ex) / 2,
                              y:
                                (sy + ey) / 2 +
                                (Math.abs(sy - ey) < 8 ? 18 : 0),
                            };
                            const direction = ex >= sx ? 1 : -1;
                            const curve = Math.max(
                              48,
                              Math.min(
                                180,
                                Math.abs(ex - sx) * 0.36 +
                                  Math.abs(ey - sy) * 0.16,
                              ),
                            );
                            const bow =
                              Math.abs(sy - ey) < 8 &&
                              nodes.findIndex((item) => item.id === node.id) %
                                2 ===
                                0
                                ? 18
                                : 0;
                            const path =
                              savedBend === undefined
                                ? `M ${sx} ${sy} C ${sx + direction * curve} ${sy + bow}, ${ex - direction * curve} ${ey + bow}, ${ex} ${ey}`
                                : `M ${sx} ${sy} Q ${savedBend.x} ${savedBend.y} ${ex} ${ey}`;
                            return [
                              h("path", {
                                key: `${edgeKey}:line`,
                                d: path,
                              }),
                              h("path", {
                                key: `${edgeKey}:hit`,
                                className: `pmrw-graph-edge-hit${draggingGraphEdgeKey === edgeKey ? " dragging" : ""}`,
                                d: path,
                                onPointerDown: (event) =>
                                  beginGraphEdgeDrag(event, edgeKey, bend),
                                onPointerMove: moveGraphEdgeDrag,
                                onPointerUp: endGraphEdgeDrag,
                                onPointerCancel: endGraphEdgeDrag,
                              }),
                            ];
                          });
                        }),
                      ),
                      ...nodes.map((node) => {
                        const state = states.get(node.id);
                        const status = state?.status ?? "waiting";
                        const statusMeta = planNodeStatusMeta(status);
                        const position = graphPositions.get(node.id);
                        if (position === undefined) return null;
                        return h(
                          "button",
                          {
                            className: `pmrw-plan-node pmrw-graph-node${props.nodeId === node.id ? " selected" : ""}${draggingGraphNodeId === node.id ? " dragging" : ""}`,
                            key: node.id,
                            type: "button",
                            title: "拖动调整位置",
                            style: {
                              left: `${position.x}px`,
                              top: `${position.y}px`,
                              width: `${position.width}px`,
                              minHeight: `${position.height}px`,
                            },
                            onPointerDown: (event) =>
                              beginGraphNodeDrag(event, node),
                            onPointerMove: moveGraphNodeDrag,
                            onPointerUp: endGraphNodeDrag,
                            onPointerCancel: endGraphNodeDrag,
                            onClick: () => {
                              if (suppressGraphClickRef.current === node.id) {
                                suppressGraphClickRef.current = "";
                                return;
                              }
                              props.onSelectNode(node.id);
                            },
                          },
                          h(
                            "div",
                            { className: "pmrw-graph-title-row" },
                            h("strong", null, node.title),
                            h(
                              "span",
                              {
                                className: `pmrw-plan-status-pill ${statusMeta.tone}`,
                              },
                              statusMeta.label,
                            ),
                          ),
                          h("p", null, node.description),
                          h(
                            "div",
                            { className: "pmrw-graph-meta-line" },
                            h(
                              "span",
                              { className: "pmrw-plan-node-meta" },
                              `${status} · ${node.receiverName || node.receiverId || "待指派"}`,
                            ),
                            node.receiverType === "agent"
                              ? h(
                                  "i",
                                  { className: "pmrw-executor-ai-tag" },
                                  "AI",
                                )
                              : null,
                          ),
                          node.dependencies.length > 0
                            ? h(
                                "span",
                                { className: "pmrw-plan-node-deps" },
                                `前置 ${node.dependencies.length} 项`,
                              )
                            : null,
                        );
                      }),
                    ),
                    h(
                      "div",
                      { className: "pmrw-graph-controls" },
                      h(
                        "button",
                        {
                          className: "pmrw-graph-icon-button",
                          type: "button",
                          title: "一键整理",
                          "aria-label": "一键整理",
                          onClick: organizeGraph,
                        },
                        h(GraphOrganizeIcon),
                      ),
                      h(
                        "button",
                        {
                          className: "pmrw-graph-icon-button",
                          type: "button",
                          title: graphFullscreen ? "退出全屏" : "全屏显示",
                          "aria-label": graphFullscreen
                            ? "退出全屏"
                            : "全屏显示",
                          onClick: () =>
                            setGraphFullscreen((current) => !current),
                        },
                        h(GraphExpandIcon, { expanded: graphFullscreen }),
                      ),
                    ),
                  ),
        ),
        regenerateOpen && result?.plan
          ? h(
              "div",
              {
                className: "pmrw-modal-backdrop",
                role: "presentation",
                onMouseDown: (event) => {
                  if (event.target === event.currentTarget && busy === "") {
                    setRegenerateOpen(false);
                  }
                },
              },
              h(
                "section",
                {
                  className: "pmrw-modal",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": "重新生成任务规划",
                },
                h(
                  "header",
                  { className: "pmrw-modal-head" },
                  h(
                    "div",
                    null,
                    h("h2", null, "重新生成任务规划"),
                    h(
                      "p",
                      null,
                      "将创建新的计划版本；旧版本和已派发子任务会保留。",
                    ),
                  ),
                  h(
                    "button",
                    {
                      className: "pmrw-icon-button",
                      type: "button",
                      disabled: busy !== "",
                      onClick: () => setRegenerateOpen(false),
                      "aria-label": "关闭",
                    },
                    "×",
                  ),
                ),
                h(
                  "div",
                  { className: "pmrw-modal-body" },
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      },
                    },
                    h(
                      "label",
                      null,
                      h("input", {
                        type: "radio",
                        name: "regenerate-mode",
                        checked: regenerateMode === "router",
                        onChange: () => setRegenerateMode("router"),
                      }),
                      " 由 Router Agent 重新生成",
                    ),
                    h(
                      "label",
                      null,
                      h("input", {
                        type: "radio",
                        name: "regenerate-mode",
                        checked: regenerateMode === "template",
                        onChange: () => {
                          setRegenerateMode("template");
                          if (templates.length === 0) void loadTemplates();
                        },
                      }),
                      " 按工作流模板重新生成",
                    ),
                  ),
                  regenerateMode === "router"
                    ? routerAgentsLoading
                      ? h(
                          "p",
                          { className: "pmrw-plan-policy-inline" },
                          "正在加载 Router Agent...",
                        )
                      : routerAgents.length === 0
                        ? h(
                            "p",
                            { className: "pmrw-error" },
                            "当前 Workspace 没有可用的 Router Agent",
                          )
                        : h(
                            "label",
                            { className: "pmrw-field" },
                            "Router Agent",
                            h(
                              "select",
                              {
                                value:
                                  regenerateRouterId ||
                                  selectedRouterId ||
                                  routerAgents[0]?.id ||
                                  "",
                                onChange: (event) =>
                                  setRegenerateRouterId(event.target.value),
                              },
                              ...routerAgents.map((agent) =>
                                h(
                                  "option",
                                  { key: agent.id, value: agent.id },
                                  agent.name,
                                ),
                              ),
                            ),
                          )
                    : templates.length === 0
                      ? h(
                          "button",
                          {
                            className: "pmrw-button secondary",
                            type: "button",
                            disabled: busy !== "",
                            onClick: () => void loadTemplates(),
                          },
                          busy === "templates" ? "加载中..." : "加载工作流模板",
                        )
                      : h(
                          "label",
                          { className: "pmrw-field" },
                          "工作流模板",
                          h(
                            "select",
                            {
                              value:
                                regenerateTemplateId || templates[0]?.id || "",
                              onChange: (event) =>
                                setRegenerateTemplateId(event.target.value),
                            },
                            ...templates.map((template) =>
                              h(
                                "option",
                                { key: template.id, value: template.id },
                                template.name,
                              ),
                            ),
                          ),
                        ),
                  error ? h("p", { className: "pmrw-error" }, error) : null,
                ),
                h(
                  "footer",
                  { className: "pmrw-modal-foot" },
                  h(
                    "button",
                    {
                      className: "pmrw-button secondary",
                      type: "button",
                      disabled: busy !== "",
                      onClick: () => setRegenerateOpen(false),
                    },
                    "取消",
                  ),
                  h(
                    "button",
                    {
                      className: "pmrw-button primary",
                      type: "button",
                      disabled:
                        busy !== "" ||
                        (regenerateMode === "router"
                          ? routerAgentsLoading || routerAgents.length === 0
                          : templates.length === 0),
                      onClick: () => void regeneratePlan(),
                    },
                    busy === "regenerate-router"
                      ? "Router 生成中..."
                      : busy === "regenerate-template"
                        ? "模板生成中..."
                        : "开始重新生成",
                  ),
                ),
              ),
            )
          : null,
        selected ? null : null,
      );
    }

    function PlanSide(props) {
      const plan = usePlan(props.taskId);
      const addDraft = useAddNodeDraft(props.taskId);
      const result = plan?.plan ? plan : (plan?.result ?? null);
      const canManagePlan = result?.permissions?.canManage === true;
      const fieldKit = window.__pluginmaxTaskFieldKit;
      const node = result?.version?.graph?.nodes?.find(
        (item) => item.id === props.nodeId,
      );
      const initialPolicy =
        typeof fieldKit?.executionPolicyForm === "function"
          ? fieldKit.executionPolicyForm(node ?? {})
          : {
              allowPublicWeb: false,
              requireToolApproval: false,
              requireToolEvents: false,
              runtimeId: "",
              model: "",
              reasoningEffort: "",
            };
      const [tab, setTab] = react.useState("basic");
      const [title, setTitle] = react.useState(node?.title ?? "");
      const [taskType, setTaskType] = react.useState(node?.taskType ?? "任务");
      const [initialStatus, setInitialStatus] = react.useState(
        node?.initialStatus ?? "todo",
      );
      const [description, setDescription] = react.useState(
        node?.description ?? "",
      );
      const [receiverType, setReceiverType] = react.useState(
        node?.receiverType ?? "human",
      );
      const [receiverId, setReceiverId] = react.useState(
        node?.receiverId ?? "",
      );
      const [receiverName, setReceiverName] = react.useState(
        node?.receiverName ?? "",
      );
      const [priority, setPriority] = react.useState(node?.priority ?? "P2");
      const [due, setDue] = react.useState(node?.due ?? "");
      const [acceptance, setAcceptance] = react.useState(
        (node?.acceptance ?? []).join("\n"),
      );
      const [autoSubmitReview, setAutoSubmitReview] = react.useState(
        node?.autoSubmitReview ?? true,
      );
      const [autoApproveReview, setAutoApproveReview] = react.useState(
        node?.autoApproveReview ?? false,
      );
      const [allowPublicWeb, setAllowPublicWeb] = react.useState(
        initialPolicy.allowPublicWeb,
      );
      const [requireToolApproval, setRequireToolApproval] = react.useState(
        initialPolicy.requireToolApproval,
      );
      const [requireToolEvents, setRequireToolEvents] = react.useState(
        initialPolicy.requireToolEvents,
      );
      const [runtimeId, setRuntimeId] = react.useState(initialPolicy.runtimeId);
      const [model, setModel] = react.useState(initialPolicy.model);
      const [reasoningEffort, setReasoningEffort] = react.useState(
        initialPolicy.reasoningEffort,
      );
      const [directory, setDirectory] = react.useState({
        humans: [],
        agents: [],
        roles: [],
      });
      const [externalRuntimes, setExternalRuntimes] = react.useState([]);
      const [dependencies, setDependencies] = react.useState(
        node?.dependencies ?? [],
      );
      const [dependencyQuery, setDependencyQuery] = react.useState("");
      const [dependencyOpen, setDependencyOpen] = react.useState(false);
      const dependencyEditorRef = react.useRef(null);
      const [saving, setSaving] = react.useState(false);
      const [savePromptOpen, setSavePromptOpen] = react.useState(false);
      const [savePromptSaving, setSavePromptSaving] = react.useState(false);
      const [creating, setCreating] = react.useState(false);
      const [ensuringTask, setEnsuringTask] = react.useState(false);
      const [error, setError] = react.useState("");
      const [detailError, setDetailError] = react.useState("");
      const [taskDetail, setTaskDetail] = react.useState(null);
      const [taskDocuments, setTaskDocuments] = react.useState([]);
      const binding = result?.bindings?.find(
        (item) =>
          item.planId === result?.plan?.id &&
          item.version === result?.plan?.currentVersion &&
          item.nodeId === node?.id,
      );
      const nodeState = result?.nodeStates?.find(
        (state) =>
          state.nodeId === node?.id &&
          state.version === result?.plan?.currentVersion,
      );
      const resolvedTaskId = binding?.taskId ?? nodeState?.taskId;
      const dependencyNodes = (node?.dependencies ?? [])
        .map((dependencyId) =>
          result?.version?.graph?.nodes?.find(
            (candidate) => candidate.id === dependencyId,
          ),
        )
        .filter((dependency) => dependency !== undefined);
      const ownerName = node?.receiverName || node?.receiverId || "负责人";
      const planStatus = result?.plan?.status;
      const nodeStatus =
        nodeState?.status ??
        (planStatus === "draft" || planStatus === "proposed"
          ? node?.dependencies?.length
            ? "waiting"
            : "ready"
          : "waiting");
      const nodeStatusMeta = planNodeStatusMeta(nodeStatus);
      const receiverValue =
        receiverType === "unassigned"
          ? "unassigned:"
          : `${receiverType}:${receiverId}`;
      const selectedAgent =
        receiverType === "agent"
          ? directory.agents.find(
              (agent) =>
                agent.id === receiverId || agent.employeeId === receiverId,
            )
          : undefined;
      const selectedRuntime =
        typeof fieldKit?.runtimeForAgent === "function"
          ? fieldKit.runtimeForAgent(selectedAgent, runtimeId, externalRuntimes)
          : undefined;
      const runtimeLabel =
        selectedAgent === undefined
          ? "未指派 AI 伙伴"
          : selectedAgent.execution === "external"
            ? (selectedRuntime?.name ??
              selectedAgent.externalRuntimeId ??
              "外部 Runtime 未绑定")
            : "内置执行";
      const modelOptions = [
        ...new Set([
          ...(selectedRuntime?.supportedModels ?? []),
          ...(selectedRuntime?.defaultModel === undefined
            ? []
            : [selectedRuntime.defaultModel]),
        ]),
      ];
      const externalRuntimeUnavailable =
        receiverType === "agent" &&
        selectedAgent?.execution === "external" &&
        selectedRuntime?.status !== "active";
      const chooseReceiver = (value) => {
        const separator = value.indexOf(":");
        const type = value.slice(0, separator);
        const id = value.slice(separator + 1);
        const item =
          type === "human"
            ? directory.humans.find((candidate) => candidate.id === id)
            : type === "agent"
              ? directory.agents.find(
                  (candidate) =>
                    candidate.id === id || candidate.employeeId === id,
                )
              : type === "role"
                ? directory.roles.find((candidate) => candidate.id === id)
                : undefined;
        setReceiverType(type);
        setReceiverId(id);
        setReceiverName(item?.name ?? "");
        setRuntimeId(
          type === "agent" && item?.execution === "external"
            ? (item.externalRuntimeId ?? "")
            : "",
        );
        setModel("");
        setReasoningEffort("");
      };
      react.useEffect(() => {
        let disposed = false;
        void Promise.all([
          request(
            `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(props.workspaceId)}`,
          ),
          request(
            `/api/collab/agent/external-runtimes?workspaceId=${encodeURIComponent(props.workspaceId)}`,
          ).catch(() => ({ runtimes: [] })),
        ])
          .then(([bootstrap, runtimeResult]) => {
            if (disposed) return;
            setDirectory(
              bootstrap.directory ?? { humans: [], agents: [], roles: [] },
            );
            setExternalRuntimes(runtimeResult.runtimes ?? []);
          })
          .catch(() => undefined);
        return () => {
          disposed = true;
        };
      }, [props.workspaceId]);
      react.useEffect(() => {
        const policy =
          typeof fieldKit?.executionPolicyForm === "function"
            ? fieldKit.executionPolicyForm(node ?? {})
            : {
                allowPublicWeb: false,
                requireToolApproval: false,
                requireToolEvents: false,
                runtimeId: "",
                model: "",
                reasoningEffort: "",
              };
        setTitle(node?.title ?? "");
        setTaskType(node?.taskType ?? "任务");
        setInitialStatus(node?.initialStatus ?? "todo");
        setDescription(node?.description ?? "");
        setReceiverType(node?.receiverType ?? "human");
        setReceiverId(node?.receiverId ?? "");
        setReceiverName(node?.receiverName ?? "");
        setPriority(node?.priority ?? "P2");
        setDue(node?.due ?? "");
        setAcceptance((node?.acceptance ?? []).join("\n"));
        setAutoSubmitReview(node?.autoSubmitReview ?? true);
        setAutoApproveReview(node?.autoApproveReview ?? false);
        setAllowPublicWeb(policy.allowPublicWeb);
        setRequireToolApproval(policy.requireToolApproval);
        setRequireToolEvents(policy.requireToolEvents);
        setRuntimeId(policy.runtimeId);
        setModel(policy.model);
        setReasoningEffort(policy.reasoningEffort);
        setDependencies(node?.dependencies ?? []);
        setDependencyQuery("");
        setDependencyOpen(false);
        setError("");
        setSavePromptOpen(false);
        setSavePromptSaving(false);
        setDetailError("");
        setTaskDetail(null);
        setTaskDocuments([]);
      }, [
        node?.acceptance?.join("|"),
        node?.dependencies?.join("|"),
        node?.description,
        node?.due,
        node?.id,
        node?.initialStatus,
        node?.priority,
        node?.receiverId,
        node?.receiverName,
        node?.receiverType,
        node?.taskType,
        node?.title,
        node?.autoApproveReview,
        node?.autoSubmitReview,
        JSON.stringify(node?.executionPolicy ?? null),
        result?.plan?.updatedAt,
      ]);
      react.useEffect(() => {
        if (resolvedTaskId === undefined) {
          setTaskDetail(null);
          setTaskDocuments([]);
          setDetailError("");
          return undefined;
        }
        let disposed = false;
        setDetailError("");
        void Promise.all([
          request(
            `/api/collab/tasks/detail?taskId=${encodeURIComponent(resolvedTaskId)}`,
          ),
          request(
            `/api/collab/tasks/documents?taskId=${encodeURIComponent(resolvedTaskId)}`,
          ),
        ])
          .then(([detail, documents]) => {
            if (disposed) return;
            setTaskDetail(detail.task);
            setTaskDocuments(documents.documents ?? []);
          })
          .catch((cause) => {
            if (!disposed) {
              setDetailError(
                cause instanceof Error ? cause.message : "加载子任务数据失败",
              );
            }
          });
        return () => {
          disposed = true;
        };
      }, [
        resolvedTaskId,
        node?.acceptance?.join("|"),
        node?.description,
        node?.priority,
        node?.receiverId,
        node?.receiverName,
        node?.title,
      ]);
      react.useEffect(() => {
        if (
          resolvedTaskId !== undefined ||
          node === undefined ||
          result?.plan === undefined ||
          !["active", "paused", "resume_required"].includes(
            result.plan.status,
          ) ||
          node.receiverType === "unassigned" ||
          node.receiverId === undefined
        ) {
          return undefined;
        }
        let disposed = false;
        setEnsuringTask(true);
        setError("");
        void request("/api/collab/router-worker/plans/nodes/ensure-task", {
          method: "POST",
          body: JSON.stringify({
            planId: result.plan.id,
            nodeId: node.id,
          }),
        })
          .then(() => fetchPlan(props.taskId, props.workspaceId))
          .catch((cause) => {
            if (!disposed) {
              setDetailError(
                cause instanceof Error ? cause.message : "加载子任务失败",
              );
            }
          })
          .finally(() => {
            if (!disposed) setEnsuringTask(false);
          });
        return () => {
          disposed = true;
        };
      }, [
        resolvedTaskId,
        node?.id,
        node?.receiverId,
        node?.receiverType,
        props.taskId,
        props.workspaceId,
        result?.plan?.id,
        result?.plan?.status,
      ]);
      const planEditable =
        result?.plan !== undefined &&
        canManagePlan &&
        ["draft", "proposed", "approved"].includes(result.plan.status);
      const materializedTask = resolvedTaskId === undefined ? null : taskDetail;
      const editable =
        resolvedTaskId === undefined
          ? planEditable
          : materializedTask !== null &&
            materializedTask.archivedAt === undefined &&
            materializedTask.status !== "cancelled" &&
            materializedTask.workflow === undefined;
      const editLockedReason =
        resolvedTaskId === undefined
          ? !canManagePlan
            ? "你没有编辑或确认该任务规划的权限"
            : planEditable
              ? ""
              : "当前计划状态下不可编辑子任务"
          : materializedTask === null
            ? "正在加载子任务状态"
            : materializedTask.archivedAt !== undefined
              ? "子任务已归档，复原后可编辑"
              : materializedTask.status === "cancelled"
                ? "子任务已取消，不可编辑"
                : materializedTask.workflow !== undefined
                  ? "工作流子任务由工作流节点同步"
                  : "";
      const editorSnapshot = JSON.stringify({
        title,
        taskType,
        initialStatus,
        description,
        receiverType,
        receiverId,
        receiverName,
        priority,
        due,
        acceptance,
        autoSubmitReview,
        autoApproveReview,
        allowPublicWeb,
        requireToolApproval,
        requireToolEvents,
        runtimeId,
        model,
        reasoningEffort,
        dependencies,
      });
      const nodeSnapshot = JSON.stringify({
        title: node?.title ?? "",
        taskType: node?.taskType ?? "任务",
        initialStatus: node?.initialStatus ?? "todo",
        description: node?.description ?? "",
        receiverType: node?.receiverType ?? "human",
        receiverId: node?.receiverId ?? "",
        receiverName: node?.receiverName ?? "",
        priority: node?.priority ?? "P2",
        due: node?.due ?? "",
        acceptance: (node?.acceptance ?? []).join("\n"),
        autoSubmitReview: node?.autoSubmitReview ?? true,
        autoApproveReview: node?.autoApproveReview ?? false,
        allowPublicWeb: initialPolicy.allowPublicWeb,
        requireToolApproval: initialPolicy.requireToolApproval,
        requireToolEvents: initialPolicy.requireToolEvents,
        runtimeId: initialPolicy.runtimeId,
        model: initialPolicy.model,
        reasoningEffort: initialPolicy.reasoningEffort,
        dependencies: node?.dependencies ?? [],
      });
      const hasUnsavedChanges =
        editable && node !== undefined && editorSnapshot !== nodeSnapshot;
      const saveNode = async () => {
        if (!node || !result) return;
        setSaving(true);
        setError("");
        try {
          const acceptanceList = acceptance
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean);
          if (resolvedTaskId !== undefined) {
            if (materializedTask === null) {
              throw new Error("子任务状态尚未加载完成");
            }
            const dependenciesChanged =
              dependencies.length !== node.dependencies.length ||
              dependencies.some(
                (dependencyId, index) =>
                  dependencyId !== node.dependencies[index],
              );
            const dependencyTaskIds = dependencies
              .map(
                (dependencyId) =>
                  result.bindings.find(
                    (item) =>
                      item.planId === result.plan.id &&
                      item.version === result.plan.currentVersion &&
                      item.nodeId === dependencyId,
                  )?.taskId ??
                  result.nodeStates.find(
                    (item) =>
                      item.nodeId === dependencyId &&
                      item.version === result.plan.currentVersion,
                  )?.taskId,
              )
              .filter((taskId) => taskId !== undefined);
            if (dependenciesChanged && dependencyTaskIds.length > 1) {
              throw new Error(
                "任务详情编辑仅支持一个前置任务；请先移除多余依赖",
              );
            }
            const updated = await request("/api/collab/tasks/update", {
              method: "POST",
              body: JSON.stringify({
                taskId: resolvedTaskId,
                title: title.trim() || materializedTask.title,
                description: description.trim() || materializedTask.description,
                priority,
                acceptance:
                  acceptanceList.length > 0
                    ? acceptanceList
                    : materializedTask.acceptance,
                ...(materializedTask.due === undefined
                  ? {}
                  : { due: materializedTask.due }),
                ...(dependenciesChanged
                  ? { dependsOn: dependencyTaskIds }
                  : {}),
              }),
            });
            const receiverChanged =
              materializedTask.receiverType !== receiverType ||
              (materializedTask.receiverId ?? "") !== receiverId.trim();
            if (receiverChanged) {
              const assigned = await request("/api/collab/tasks/assign", {
                method: "POST",
                body: JSON.stringify({
                  taskId: resolvedTaskId,
                  receiverType,
                  ...(receiverId.trim() === ""
                    ? {}
                    : { receiverId: receiverId.trim() }),
                  ...(receiverName.trim() === ""
                    ? {}
                    : { receiverName: receiverName.trim() }),
                }),
              });
              setTaskDetail(assigned.task);
            } else {
              setTaskDetail(updated.task);
            }
            await fetchPlan(props.taskId, props.workspaceId);
            return true;
          }
          const executionPolicy =
            typeof fieldKit?.buildExecutionPolicy === "function"
              ? fieldKit.buildExecutionPolicy({
                  allowPublicWeb,
                  requireToolApproval,
                  requireToolEvents,
                  runtimeId,
                  model,
                  reasoningEffort,
                })
              : undefined;
          const graph = {
            ...result.version.graph,
            nodes: result.version.graph.nodes.map((item) =>
              item.id === node.id
                ? {
                    ...item,
                    title: title.trim() || item.title,
                    description: description.trim() || item.description,
                    taskType,
                    initialStatus,
                    receiverType,
                    ...(receiverId.trim() === ""
                      ? { receiverId: undefined }
                      : { receiverId: receiverId.trim() }),
                    ...(receiverName.trim() === ""
                      ? { receiverName: undefined }
                      : { receiverName: receiverName.trim() }),
                    priority,
                    ...(due.trim() === ""
                      ? { due: undefined }
                      : { due: due.trim() }),
                    acceptance: acceptanceList,
                    autoSubmitReview,
                    autoApproveReview,
                    ...(executionPolicy === undefined
                      ? {}
                      : { executionPolicy }),
                    dependencies,
                  }
                : item,
            ),
          };
          await savePlanGraph(
            props,
            result,
            graph,
            result.plan.settings,
            "编辑任务节点",
          );
          return true;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "保存节点失败");
          return false;
        } finally {
          setSaving(false);
        }
      };
      const discardNodeChanges = () => {
        setTitle(node?.title ?? "");
        setTaskType(node?.taskType ?? "任务");
        setInitialStatus(node?.initialStatus ?? "todo");
        setDescription(node?.description ?? "");
        setReceiverType(node?.receiverType ?? "human");
        setReceiverId(node?.receiverId ?? "");
        setReceiverName(node?.receiverName ?? "");
        setPriority(node?.priority ?? "P2");
        setDue(node?.due ?? "");
        setAcceptance((node?.acceptance ?? []).join("\n"));
        setAutoSubmitReview(node?.autoSubmitReview ?? true);
        setAutoApproveReview(node?.autoApproveReview ?? false);
        setAllowPublicWeb(initialPolicy.allowPublicWeb);
        setRequireToolApproval(initialPolicy.requireToolApproval);
        setRequireToolEvents(initialPolicy.requireToolEvents);
        setRuntimeId(initialPolicy.runtimeId);
        setModel(initialPolicy.model);
        setReasoningEffort(initialPolicy.reasoningEffort);
        setDependencies(node?.dependencies ?? []);
        setDependencyQuery("");
        setError("");
        setSavePromptOpen(false);
      };
      const cancelAdd = () => {
        updateAddNodeDraft(props.taskId, defaultAddNodeDraft());
        props.onSelectNode("");
      };
      const createNode = async () => {
        if (result === null) return;
        if (addDraft.title.trim() === "") {
          updateAddNodeDraft(props.taskId, {
            error: "请填写任务标题",
          });
          return;
        }
        const acceptance = addDraft.acceptance
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean);
        const executionPolicy =
          typeof fieldKit?.buildExecutionPolicy === "function"
            ? fieldKit.buildExecutionPolicy(addDraft)
            : undefined;
        const node = {
          id: `node-${Date.now().toString(36)}`,
          title: addDraft.title.trim(),
          description:
            addDraft.description.trim() || "完成新增任务节点并提交结果。",
          taskType: addDraft.taskType,
          initialStatus: addDraft.initialStatus,
          type: "task",
          receiverType: addDraft.receiverType,
          ...(addDraft.receiverId.trim() === ""
            ? {}
            : { receiverId: addDraft.receiverId.trim() }),
          ...(addDraft.receiverName.trim() === ""
            ? {}
            : { receiverName: addDraft.receiverName.trim() }),
          priority: addDraft.priority,
          ...(addDraft.due.trim() === "" ? {} : { due: addDraft.due.trim() }),
          acceptance: acceptance.length === 0 ? ["提交任务结果"] : acceptance,
          dependencies: [],
          reviewMode: "human",
          autoSubmitReview: addDraft.autoSubmitReview,
          autoApproveReview: addDraft.autoApproveReview,
          ...(executionPolicy === undefined ? {} : { executionPolicy }),
          maxAttempts: 2,
          timeoutSeconds: 86400,
        };
        setCreating(true);
        updateAddNodeDraft(props.taskId, { saving: true, error: "" });
        try {
          await savePlanGraph(
            props,
            result,
            {
              ...result.version.graph,
              nodes: [...result.version.graph.nodes, node],
            },
            result.plan.settings,
            "新增任务节点",
          );
          updateAddNodeDraft(props.taskId, defaultAddNodeDraft());
          props.onSelectNode(node.id);
        } catch (cause) {
          updateAddNodeDraft(props.taskId, {
            saving: false,
            error: cause instanceof Error ? cause.message : "创建任务失败",
          });
        } finally {
          setCreating(false);
        }
      };
      react.useEffect(() => {
        if (!dependencyOpen) return undefined;
        const closeDependencyMenu = (event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            dependencyEditorRef.current?.contains(target)
          ) {
            return;
          }
          setDependencyOpen(false);
        };
        window.addEventListener("pointerdown", closeDependencyMenu, true);
        return () =>
          window.removeEventListener("pointerdown", closeDependencyMenu, true);
      }, [dependencyOpen]);
      react.useEffect(() => {
        if (!editable || !hasUnsavedChanges || savePromptOpen) {
          return undefined;
        }
        const guardOutsideEdit = (event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            (target.closest(".pmrw-task-plan-side") !== null ||
              target.closest(".pmrw-unsaved-backdrop") !== null)
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setSavePromptOpen(true);
        };
        window.addEventListener("pointerdown", guardOutsideEdit, true);
        return () =>
          window.removeEventListener("pointerdown", guardOutsideEdit, true);
      }, [editable, hasUnsavedChanges, savePromptOpen]);
      const addSelectedAgent =
        addDraft.receiverType === "agent"
          ? directory.agents.find(
              (agent) =>
                agent.id === addDraft.receiverId ||
                agent.employeeId === addDraft.receiverId,
            )
          : undefined;
      const addSelectedRuntime =
        typeof fieldKit?.runtimeForAgent === "function"
          ? fieldKit.runtimeForAgent(
              addSelectedAgent,
              addDraft.runtimeId,
              externalRuntimes,
            )
          : undefined;
      const addRuntimeLabel =
        addSelectedAgent === undefined
          ? "未指派 AI 伙伴"
          : addSelectedAgent.execution === "external"
            ? (addSelectedRuntime?.name ??
              addSelectedAgent.externalRuntimeId ??
              "外部 Runtime 未绑定")
            : "内置执行";
      const addModelOptions = [
        ...new Set([
          ...(addSelectedRuntime?.supportedModels ?? []),
          ...(addSelectedRuntime?.defaultModel === undefined
            ? []
            : [addSelectedRuntime.defaultModel]),
        ]),
      ];
      const addExternalRuntimeUnavailable =
        addDraft.receiverType === "agent" &&
        addSelectedAgent?.execution === "external" &&
        addSelectedRuntime?.status !== "active";
      const chooseAddReceiver = (value) => {
        const separator = value.indexOf(":");
        const type = value.slice(0, separator);
        const id = value.slice(separator + 1);
        const item =
          type === "human"
            ? directory.humans.find((candidate) => candidate.id === id)
            : type === "agent"
              ? directory.agents.find(
                  (candidate) =>
                    candidate.id === id || candidate.employeeId === id,
                )
              : type === "role"
                ? directory.roles.find((candidate) => candidate.id === id)
                : undefined;
        updateAddNodeDraft(props.taskId, {
          receiverType: type,
          receiverId: id,
          receiverName: item?.name ?? "",
          runtimeId:
            type === "agent" && item?.execution === "external"
              ? (item.externalRuntimeId ?? "")
              : "",
          model: "",
          reasoningEffort: "",
        });
      };
      if (addDraft.active && canManagePlan) {
        return h(
          "aside",
          { className: "pmrw-task-plan-side" },
          h("style", null, styles),
          h(
            "header",
            { className: "pmrw-plan-side-head" },
            h("span", null, "添加任务"),
            h("h2", null, "新建子任务"),
            h("code", null, "填写任务信息后加入当前执行计划"),
          ),
          h(
            "div",
            { className: "pmrw-plan-side-body" },
            h(
              "div",
              { className: "pmrw-node-form" },
              h(
                "label",
                null,
                "任务标题",
                h("input", {
                  value: addDraft.title,
                  placeholder: "例如：补充供应商访谈",
                  onChange: (event) =>
                    updateAddNodeDraft(props.taskId, {
                      title: event.target.value,
                      error: "",
                    }),
                }),
              ),
              h(
                "label",
                null,
                "任务描述",
                h("textarea", {
                  value: addDraft.description,
                  onChange: (event) =>
                    updateAddNodeDraft(props.taskId, {
                      description: event.target.value,
                    }),
                }),
              ),
              h(
                "div",
                { className: "pmrw-plan-settings" },
                h(
                  "label",
                  null,
                  "类型",
                  h(
                    "select",
                    {
                      value: addDraft.taskType,
                      onChange: (event) =>
                        updateAddNodeDraft(props.taskId, {
                          taskType: event.target.value,
                        }),
                    },
                    h("option", { value: "任务" }, "任务"),
                    h("option", { value: "缺陷" }, "缺陷"),
                    h("option", { value: "评审" }, "评审"),
                  ),
                ),
                h(
                  "label",
                  null,
                  "优先级",
                  h(
                    "select",
                    {
                      value: addDraft.priority,
                      onChange: (event) =>
                        updateAddNodeDraft(props.taskId, {
                          priority: event.target.value,
                        }),
                    },
                    h("option", { value: "P1" }, "P0"),
                    h("option", { value: "P2" }, "P1"),
                    h("option", { value: "P3" }, "P2"),
                  ),
                ),
                h(
                  "label",
                  null,
                  "初始状态",
                  h(
                    "select",
                    {
                      value: addDraft.initialStatus,
                      onChange: (event) =>
                        updateAddNodeDraft(props.taskId, {
                          initialStatus: event.target.value,
                        }),
                    },
                    h("option", { value: "todo" }, "待处理"),
                    h("option", { value: "progress" }, "进行中"),
                    h("option", { value: "review" }, "待验收"),
                    h("option", { value: "done" }, "已完成"),
                  ),
                ),
                h(
                  "label",
                  null,
                  "责任人",
                  h(
                    "select",
                    {
                      value:
                        addDraft.receiverType === "unassigned"
                          ? "unassigned:"
                          : `${addDraft.receiverType}:${addDraft.receiverId}`,
                      onChange: (event) =>
                        chooseAddReceiver(event.target.value),
                    },
                    h("option", { value: "unassigned:" }, "待指派"),
                    directory.humans.length
                      ? h(
                          "optgroup",
                          { label: "人员" },
                          ...directory.humans.map((item) =>
                            h(
                              "option",
                              { value: `human:${item.id}`, key: item.id },
                              item.name,
                            ),
                          ),
                        )
                      : null,
                    directory.agents.length
                      ? h(
                          "optgroup",
                          { label: "AI 伙伴" },
                          ...directory.agents.map((item) =>
                            h(
                              "option",
                              { value: `agent:${item.id}`, key: item.id },
                              item.name,
                            ),
                          ),
                        )
                      : null,
                    directory.roles.length
                      ? h(
                          "optgroup",
                          { label: "角色" },
                          ...directory.roles.map((item) =>
                            h(
                              "option",
                              { value: `role:${item.id}`, key: item.id },
                              item.name,
                            ),
                          ),
                        )
                      : null,
                  ),
                ),
                h(
                  "label",
                  null,
                  "到期时间",
                  h("input", {
                    type: "date",
                    value: addDraft.due,
                    onChange: (event) =>
                      updateAddNodeDraft(props.taskId, {
                        due: event.target.value,
                      }),
                  }),
                ),
              ),
              h(
                "div",
                { className: "pmrw-plan-policy-inline" },
                `归属项目：${props.workspaceId}（沿用当前计划，不可变更）`,
              ),
              addDraft.receiverType === "agent"
                ? h(
                    "div",
                    { className: "pmrw-plan-policy" },
                    h("strong", null, "Review 设置"),
                    h(
                      "label",
                      { className: "pmrw-setting-check" },
                      h("input", {
                        type: "checkbox",
                        checked: addDraft.autoSubmitReview,
                        onChange: (event) =>
                          updateAddNodeDraft(props.taskId, {
                            autoSubmitReview: event.target.checked,
                          }),
                      }),
                      h("span", null, "完成后自动提交 Review"),
                    ),
                    h(
                      "label",
                      { className: "pmrw-setting-check" },
                      h("input", {
                        type: "checkbox",
                        checked: addDraft.autoApproveReview,
                        onChange: (event) =>
                          updateAddNodeDraft(props.taskId, {
                            autoApproveReview: event.target.checked,
                          }),
                      }),
                      h("span", null, "Review 自动通过"),
                    ),
                  )
                : null,
              addDraft.receiverType === "agent" &&
                typeof fieldKit?.ExecutionRuntimeFields === "function"
                ? h(fieldKit.ExecutionRuntimeFields, {
                    runtimeLabel: addRuntimeLabel,
                    runtimeUnavailable: addExternalRuntimeUnavailable,
                    model: addDraft.model,
                    modelOptions: addModelOptions,
                    defaultModelLabel: addSelectedRuntime?.defaultModel,
                    modelPlaceholder: "沿用平台默认模型",
                    reasoningEffort: addDraft.reasoningEffort,
                    defaultReasoningLabel: "沿用 Runtime 默认值",
                    onModelChange: (value) =>
                      updateAddNodeDraft(props.taskId, { model: value }),
                    onReasoningChange: (value) =>
                      updateAddNodeDraft(props.taskId, {
                        reasoningEffort: value,
                      }),
                  })
                : null,
              h(
                "div",
                { className: "pmrw-plan-policy" },
                h("strong", null, "执行策略"),
                h(
                  "label",
                  { className: "pmrw-setting-check" },
                  h("input", {
                    type: "checkbox",
                    checked: addDraft.allowPublicWeb,
                    onChange: (event) =>
                      updateAddNodeDraft(props.taskId, {
                        allowPublicWeb: event.target.checked,
                      }),
                  }),
                  h("span", null, "允许公开网页与监管文件"),
                ),
                h(
                  "label",
                  { className: "pmrw-setting-check" },
                  h("input", {
                    type: "checkbox",
                    checked: addDraft.requireToolApproval,
                    onChange: (event) =>
                      updateAddNodeDraft(props.taskId, {
                        requireToolApproval: event.target.checked,
                      }),
                  }),
                  h("span", null, "写文件、执行命令和外部发布前需要人工确认"),
                ),
                h(
                  "label",
                  { className: "pmrw-setting-check" },
                  h("input", {
                    type: "checkbox",
                    checked: addDraft.requireToolEvents,
                    onChange: (event) =>
                      updateAddNodeDraft(props.taskId, {
                        requireToolEvents: event.target.checked,
                      }),
                  }),
                  h("span", null, "要求记录实际工具调用事件"),
                ),
              ),
              h(
                "label",
                null,
                "验收标准（每行一条）",
                h("textarea", {
                  value: addDraft.acceptance,
                  onChange: (event) =>
                    updateAddNodeDraft(props.taskId, {
                      acceptance: event.target.value,
                    }),
                }),
              ),
              addDraft.error
                ? h("p", { className: "pmrw-error" }, addDraft.error)
                : null,
              h(
                "div",
                { className: "pmrw-add-draft-actions" },
                h(
                  "button",
                  {
                    className: "pmrw-button secondary",
                    type: "button",
                    disabled: creating,
                    onClick: cancelAdd,
                  },
                  "取消",
                ),
                h(
                  "button",
                  {
                    className: "pmrw-button primary",
                    type: "button",
                    disabled: creating || addDraft.saving,
                    onClick: () => void createNode(),
                  },
                  creating || addDraft.saving ? "创建中..." : "创建任务",
                ),
              ),
            ),
          ),
        );
      }
      if (!node) {
        return h(
          "aside",
          { className: "pmrw-task-plan-side" },
          h("style", null, styles),
          h(
            "div",
            { className: "pmrw-plan-side-empty" },
            h("strong", null, props.taskTitle || "任务规划"),
            h("p", null, "选择图或列表中的节点查看详情。"),
          ),
        );
      }
      if (
        resolvedTaskId !== undefined &&
        taskDetail !== null &&
        typeof window.__pluginmaxTaskDetailSide === "function"
      ) {
        return h(
          "div",
          {
            className: "pmrw-task-plan-side pmrw-task-plan-side-embedded",
          },
          h(window.__pluginmaxTaskDetailSide, {
            key: resolvedTaskId,
            taskId: resolvedTaskId,
            initialTask: taskDetail,
            workspaceId: props.workspaceId,
            onTaskUpdated: (nextTask) => {
              if (nextTask !== undefined) setTaskDetail(nextTask);
              void fetchPlan(props.taskId, props.workspaceId).catch(() => {
                // The embedded task surface keeps its own failure state.
              });
            },
          }),
        );
      }
      if (
        !canManagePlan &&
        typeof window.__pluginmaxTaskDetailSide === "function"
      ) {
        const previewTask = planNodePreviewTask(result, node, nodeState);
        return h(
          "div",
          {
            className: "pmrw-task-plan-side pmrw-task-plan-side-embedded",
          },
          h(window.__pluginmaxTaskDetailSide, {
            key: previewTask.id,
            taskId: previewTask.id,
            initialTask: previewTask,
            additionalTasks: dependencyNodes.map((dependency) => ({
              id: dependency.id,
              workspaceId: props.workspaceId,
              title: dependency.title,
              status:
                planNodePreviewStatus(
                  result?.nodeStates?.find(
                    (state) => state.nodeId === dependency.id,
                  )?.status,
                ) === "done"
                  ? "done"
                  : "todo",
            })),
            workspaceId: props.workspaceId,
            readOnlyPreview: true,
          }),
        );
      }
      const detailLoading =
        resolvedTaskId !== undefined &&
        taskDetail === null &&
        detailError === "";
      const agentMessages = (taskDetail?.messages ?? []).filter(
        (message) => message.kind === "agent",
      );
      const taskEvents = [...(taskDetail?.events ?? [])].reverse().slice(0, 20);
      const stageCopy = planSideStageCopy(planStatus, ownerName);
      const sideProblem = detailError || error;
      const sideProblemTitle = detailError ? "子任务详情加载失败" : "操作失败";
      const acceptanceItems =
        materializedTask?.acceptance ??
        (Array.isArray(node.acceptance) ? node.acceptance : []);
      const dependencySummary = dependencyNodes.length
        ? dependencyNodes
            .map((dependency) => {
              const dependencyStatus = result?.nodeStates?.find(
                (state) => state.nodeId === dependency.id,
              )?.status;
              return `${dependency.title}（${
                planNodeStatusMeta(dependencyStatus).label
              }）`;
            })
            .join("、")
        : "无";
      const dependencySearchTerms = dependencyQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const dependencyCandidates = (result?.version?.graph?.nodes ?? [])
        .filter((candidate) => candidate.id !== node.id)
        .filter((candidate) => !dependencies.includes(candidate.id))
        .filter((candidate) => {
          if (dependencySearchTerms.length === 0) return true;
          const haystack = [
            candidate.title,
            candidate.id,
            candidate.receiverName,
            candidate.receiverId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return dependencySearchTerms.every((term) => haystack.includes(term));
        })
        .map((candidate) => ({
          candidate,
          invalid: dependencyCreatesCycle(
            result?.version?.graph?.nodes ?? [],
            node.id,
            candidate.id,
          ),
          limitReached:
            resolvedTaskId !== undefined && dependencies.length >= 1,
        }));
      const firstAvailableDependency = dependencyCandidates.find(
        (item) => !item.invalid && !item.limitReached,
      );
      const addDependency = (candidate) => {
        setDependencies((current) =>
          current.includes(candidate.id) ? current : [...current, candidate.id],
        );
        setDependencyQuery("");
        setDependencyOpen(false);
      };
      return h(
        "aside",
        { className: "pmrw-task-plan-side" },
        h("style", null, styles),
        h(
          "header",
          { className: "pmrw-plan-side-head" },
          h("span", null, "已选子任务"),
          h("h2", null, node.title),
          h("code", null, node.id),
        ),
        h(
          "div",
          { className: "pmrw-plan-tabs" },
          ...[
            ["basic", "基础信息"],
            ["records", "AI执行记录"],
            ["outputs", "产出文档"],
            ["activity", "任务动态"],
          ].map(([key, label]) =>
            h(
              "button",
              {
                key,
                className: tab === key ? "active" : "",
                type: "button",
                onClick: () => setTab(key),
              },
              label,
            ),
          ),
        ),
        h(
          "div",
          { className: "pmrw-plan-side-body" },
          tab === "basic"
            ? editable
              ? h(
                  "div",
                  { className: "pmrw-node-form" },
                  h(
                    "div",
                    { className: "pmrw-plan-policy-inline" },
                    `子任务状态：${
                      materializedTask === null
                        ? planConfirmationMeta(planStatus).label
                        : taskStatusLabel(materializedTask.status)
                    }`,
                  ),
                  h(
                    "label",
                    null,
                    "任务标题",
                    h("input", {
                      value: title,
                      onChange: (event) => setTitle(event.target.value),
                    }),
                  ),
                  h(
                    "label",
                    null,
                    "任务描述",
                    h("textarea", {
                      value: description,
                      onChange: (event) => setDescription(event.target.value),
                    }),
                  ),
                  h(
                    "div",
                    { className: "pmrw-plan-settings" },
                    h(
                      "label",
                      null,
                      "类型",
                      h(
                        "select",
                        {
                          value: taskType,
                          onChange: (event) => setTaskType(event.target.value),
                        },
                        h("option", { value: "任务" }, "任务"),
                        h("option", { value: "缺陷" }, "缺陷"),
                        h("option", { value: "评审" }, "评审"),
                      ),
                    ),
                    h(
                      "label",
                      null,
                      "优先级",
                      h(
                        "select",
                        {
                          value: priority,
                          onChange: (event) => setPriority(event.target.value),
                        },
                        h("option", { value: "P1" }, "P0"),
                        h("option", { value: "P2" }, "P1"),
                        h("option", { value: "P3" }, "P2"),
                      ),
                    ),
                    h(
                      "label",
                      null,
                      "初始状态",
                      h(
                        "select",
                        {
                          value: initialStatus,
                          onChange: (event) =>
                            setInitialStatus(event.target.value),
                        },
                        h("option", { value: "todo" }, "待处理"),
                        h("option", { value: "progress" }, "进行中"),
                        h("option", { value: "review" }, "待验收"),
                        h("option", { value: "done" }, "已完成"),
                      ),
                    ),
                    h(
                      "label",
                      null,
                      "责任人",
                      h(
                        "select",
                        {
                          value: receiverValue,
                          onChange: (event) =>
                            chooseReceiver(event.target.value),
                        },
                        h("option", { value: "unassigned:" }, "待指派"),
                        receiverType !== "unassigned" &&
                          receiverId !== "" &&
                          !(
                            receiverType === "human"
                              ? directory.humans
                              : receiverType === "agent"
                                ? directory.agents
                                : directory.roles
                          ).some((item) => item.id === receiverId)
                          ? h(
                              "option",
                              { value: receiverValue },
                              `${receiverName || receiverId}（当前负责人不可用）`,
                            )
                          : null,
                        directory.humans.length
                          ? h(
                              "optgroup",
                              { label: "人员" },
                              ...directory.humans.map((item) =>
                                h(
                                  "option",
                                  { value: `human:${item.id}`, key: item.id },
                                  item.name,
                                ),
                              ),
                            )
                          : null,
                        directory.agents.length
                          ? h(
                              "optgroup",
                              { label: "AI 伙伴" },
                              ...directory.agents.map((item) =>
                                h(
                                  "option",
                                  { value: `agent:${item.id}`, key: item.id },
                                  item.name,
                                ),
                              ),
                            )
                          : null,
                        directory.roles.length
                          ? h(
                              "optgroup",
                              { label: "角色" },
                              ...directory.roles.map((item) =>
                                h(
                                  "option",
                                  { value: `role:${item.id}`, key: item.id },
                                  item.name,
                                ),
                              ),
                            )
                          : null,
                      ),
                    ),
                    h(
                      "label",
                      null,
                      "到期时间",
                      h("input", {
                        type: "date",
                        value: due,
                        onChange: (event) => setDue(event.target.value),
                      }),
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmrw-plan-policy-inline" },
                    `归属项目：${props.workspaceId}（沿用当前计划，不可变更）`,
                  ),
                  receiverType === "agent"
                    ? h(
                        "div",
                        { className: "pmrw-plan-policy" },
                        h("strong", null, "Review 设置"),
                        h(
                          "label",
                          { className: "pmrw-setting-check" },
                          h("input", {
                            type: "checkbox",
                            checked: autoSubmitReview,
                            onChange: (event) =>
                              setAutoSubmitReview(event.target.checked),
                          }),
                          h("span", null, "完成后自动提交 Review"),
                        ),
                        h(
                          "label",
                          { className: "pmrw-setting-check" },
                          h("input", {
                            type: "checkbox",
                            checked: autoApproveReview,
                            onChange: (event) =>
                              setAutoApproveReview(event.target.checked),
                          }),
                          h("span", null, "Review 自动通过"),
                        ),
                      )
                    : null,
                  receiverType === "agent" &&
                    typeof fieldKit?.ExecutionRuntimeFields === "function"
                    ? h(fieldKit.ExecutionRuntimeFields, {
                        runtimeLabel,
                        runtimeUnavailable: externalRuntimeUnavailable,
                        model,
                        modelOptions,
                        defaultModelLabel: selectedRuntime?.defaultModel,
                        modelPlaceholder: "沿用平台默认模型",
                        reasoningEffort,
                        defaultReasoningLabel: "沿用 Runtime 默认值",
                        onModelChange: setModel,
                        onReasoningChange: setReasoningEffort,
                      })
                    : null,
                  h(
                    "div",
                    { className: "pmrw-plan-policy" },
                    h("strong", null, "执行策略"),
                    h(
                      "label",
                      { className: "pmrw-setting-check" },
                      h("input", {
                        type: "checkbox",
                        checked: allowPublicWeb,
                        onChange: (event) =>
                          setAllowPublicWeb(event.target.checked),
                      }),
                      h("span", null, "允许公开网页与监管文件"),
                    ),
                    h(
                      "label",
                      { className: "pmrw-setting-check" },
                      h("input", {
                        type: "checkbox",
                        checked: requireToolApproval,
                        onChange: (event) =>
                          setRequireToolApproval(event.target.checked),
                      }),
                      h(
                        "span",
                        null,
                        "写文件、执行命令和外部发布前需要人工确认",
                      ),
                    ),
                    h(
                      "label",
                      { className: "pmrw-setting-check" },
                      h("input", {
                        type: "checkbox",
                        checked: requireToolEvents,
                        onChange: (event) =>
                          setRequireToolEvents(event.target.checked),
                      }),
                      h("span", null, "要求记录实际工具调用事件"),
                    ),
                  ),
                  h(
                    "label",
                    null,
                    "验收标准（每行一条）",
                    h("textarea", {
                      value: acceptance,
                      onChange: (event) => setAcceptance(event.target.value),
                    }),
                  ),
                  h(
                    "div",
                    {
                      className: "pmrw-dependency-editor",
                      ref: dependencyEditorRef,
                    },
                    h("span", null, "前置任务"),
                    dependencies.length > 0
                      ? h(
                          "div",
                          { className: "pmrw-dependency-chips" },
                          ...dependencies.map((dependencyId) => {
                            const dependency =
                              result?.version?.graph?.nodes?.find(
                                (candidate) => candidate.id === dependencyId,
                              );
                            return h(
                              "span",
                              {
                                className: "pmrw-dependency-chip",
                                key: dependencyId,
                                title: dependency?.title ?? dependencyId,
                              },
                              h(
                                "span",
                                null,
                                dependency?.title ?? dependencyId,
                              ),
                              h(
                                "button",
                                {
                                  type: "button",
                                  "aria-label": `移除前置任务 ${dependency?.title ?? dependencyId}`,
                                  onClick: () =>
                                    setDependencies((current) =>
                                      current.filter(
                                        (value) => value !== dependencyId,
                                      ),
                                    ),
                                },
                                "×",
                              ),
                            );
                          }),
                        )
                      : h(
                          "span",
                          { className: "pmrw-dependency-empty" },
                          "暂无前置任务",
                        ),
                    h(
                      "div",
                      { className: "pmrw-dependency-combo" },
                      h("input", {
                        value: dependencyQuery,
                        placeholder: "搜索并添加前置任务",
                        role: "combobox",
                        "aria-expanded": dependencyOpen,
                        onFocus: () => setDependencyOpen(true),
                        onClick: () => setDependencyOpen(true),
                        onKeyDown: (event) => {
                          if (event.key === "Escape") {
                            setDependencyOpen(false);
                            return;
                          }
                          if (
                            event.key === "Enter" &&
                            firstAvailableDependency !== undefined
                          ) {
                            event.preventDefault();
                            addDependency(firstAvailableDependency.candidate);
                          }
                        },
                        onChange: (event) => {
                          setDependencyQuery(event.target.value);
                          setDependencyOpen(true);
                        },
                      }),
                      h(
                        "button",
                        {
                          className: "pmrw-dependency-toggle",
                          type: "button",
                          "aria-label": dependencyOpen
                            ? "收起前置任务"
                            : "展开前置任务",
                          onClick: () =>
                            setDependencyOpen((current) => !current),
                        },
                        dependencyOpen ? "⌃" : "⌄",
                      ),
                    ),
                    dependencyOpen
                      ? h(
                          "div",
                          {
                            className: "pmrw-dependency-options",
                            role: "listbox",
                            "aria-label": "前置任务候选",
                          },
                          dependencyCandidates.length === 0
                            ? h(
                                "div",
                                { className: "pmrw-dependency-option-empty" },
                                dependencyQuery.trim() === ""
                                  ? "没有更多可添加任务"
                                  : "没有匹配任务",
                              )
                            : dependencyCandidates.map(
                                ({ candidate, invalid, limitReached }) =>
                                  h(
                                    "button",
                                    {
                                      type: "button",
                                      key: candidate.id,
                                      disabled: invalid || limitReached,
                                      title: limitReached
                                        ? "已派发子任务与任务详情一致，仅支持一个前置任务"
                                        : invalid
                                          ? "该依赖会形成循环"
                                          : `添加 ${candidate.title}`,
                                      onClick: () => addDependency(candidate),
                                    },
                                    h("strong", null, candidate.title),
                                    h(
                                      "small",
                                      null,
                                      `${candidate.id}${candidate.receiverName ? ` · ${candidate.receiverName}` : ""}${invalid ? " · 会形成循环" : ""}`,
                                    ),
                                  ),
                              ),
                          h(
                            "div",
                            { className: "pmrw-dependency-hint" },
                            "输入关键词模糊搜索；按 Enter 添加首个可用任务",
                          ),
                        )
                      : null,
                  ),
                  error ? h("p", { className: "pmrw-error" }, error) : null,
                  h(
                    "button",
                    {
                      className: "pmrw-button primary",
                      type: "button",
                      disabled: saving,
                      onClick: () => void saveNode(),
                    },
                    saving ? "保存中..." : "保存节点",
                  ),
                )
              : h(
                  react.Fragment,
                  null,
                  h(
                    "div",
                    { className: "pmrw-plan-info-grid" },
                    h("span", null, "状态"),
                    h(
                      "strong",
                      null,
                      materializedTask === null
                        ? planNodeStatusMeta(
                            result?.nodeStates?.find(
                              (state) => state.nodeId === node.id,
                            )?.status,
                          ).label
                        : taskStatusLabel(materializedTask.status),
                    ),
                    h("span", null, "类型"),
                    h("strong", null, node.taskType ?? "任务"),
                    h("span", null, "任务初始状态"),
                    h(
                      "strong",
                      null,
                      taskStatusLabel(node.initialStatus ?? "todo"),
                    ),
                    h("span", null, "负责人"),
                    h(
                      "strong",
                      null,
                      node.receiverName || node.receiverId || "待指派",
                    ),
                    h("span", null, "优先级"),
                    h("strong", null, node.priority),
                    h("span", null, "到期时间"),
                    h("strong", null, node.due || "不限"),
                    h("span", null, "Review"),
                    h("strong", null, node.reviewMode),
                    h("span", null, "预期交付"),
                    h("strong", null, node.acceptance.join("、")),
                  ),
                  editLockedReason !== ""
                    ? h(
                        "div",
                        { className: "pmrw-plan-policy" },
                        editLockedReason,
                      )
                    : null,
                  h(
                    "div",
                    { className: "pmrw-plan-policy" },
                    `前置任务：${node.dependencies.length ? node.dependencies.join("、") : "无"}`,
                  ),
                )
            : tab === "records"
              ? h(
                  "div",
                  { className: "pmrw-plan-record-list" },
                  ...(sideProblem
                    ? [
                        planSideNotice(
                          sideProblemTitle,
                          sideProblem,
                          "records-error",
                          "error",
                        ),
                      ]
                    : []),
                  ...(agentMessages.length
                    ? agentMessages.map((message) =>
                        h(
                          "article",
                          { key: message.id, className: "pmrw-plan-record" },
                          h(
                            "strong",
                            null,
                            `${message.authorName} · ${message.state ?? "run"}`,
                          ),
                          h("p", null, message.content),
                        ),
                      )
                    : [
                        detailLoading || ensuringTask
                          ? planSideNotice(
                              "正在读取执行记录",
                              "正在加载该子任务的 Agent Run 和执行状态。",
                              "records-loading",
                            )
                          : resolvedTaskId !== undefined
                            ? node.receiverType === "human"
                              ? planSideNotice(
                                  "该节点由人工执行",
                                  `${ownerName} 负责完成这个子任务，因此不会产生 Agent Run。任务协作和状态变化可查看「任务动态」。`,
                                  "records-human",
                                )
                              : planSideNotice(
                                  "暂无 Agent 执行记录",
                                  `子任务已创建，${ownerName} 尚未产生可读取的执行记录。`,
                                  "records-empty",
                                )
                            : node.receiverType === "unassigned"
                              ? planSideNotice(
                                  "节点尚未指派负责人",
                                  "请先在「基础信息」中设置负责人，再确认并派发计划。",
                                  "records-unassigned",
                                )
                              : node.receiverType === "human"
                                ? planSideNotice(
                                    "该节点由人工执行",
                                    `${ownerName} 负责完成这个子任务，不会产生 Agent Run。${stageCopy}`,
                                    "records-human-plan",
                                  )
                                : node.receiverType === "agent"
                                  ? planSideNotice(
                                      "AI 执行尚未开始",
                                      `${ownerName} 将在节点具备执行条件后启动。${stageCopy}`,
                                      "records-agent-plan",
                                    )
                                  : planSideNotice(
                                      "角色执行尚未开始",
                                      `该节点由项目角色执行。${stageCopy}`,
                                      "records-role-plan",
                                    ),
                      ]),
                )
              : tab === "outputs"
                ? h(
                    "div",
                    { className: "pmrw-plan-record-list" },
                    ...(sideProblem
                      ? [
                          planSideNotice(
                            sideProblemTitle,
                            sideProblem,
                            "outputs-error",
                            "error",
                          ),
                        ]
                      : []),
                    ...(taskDocuments.length
                      ? taskDocuments.map((entry) =>
                          h(
                            "article",
                            {
                              key: entry.document?.id ?? entry.id,
                              className: "pmrw-plan-record",
                            },
                            h(
                              "strong",
                              null,
                              entry.document?.name ?? entry.name ?? "产出文档",
                            ),
                            h(
                              "p",
                              null,
                              entry.document?.kind === "uploaded"
                                ? "上传附件"
                                : "任务产出",
                            ),
                          ),
                        )
                      : [
                          detailLoading || ensuringTask
                            ? planSideNotice(
                                "正在读取产出文档",
                                "正在加载该子任务的交付物和附件。",
                                "outputs-loading",
                              )
                            : resolvedTaskId !== undefined
                              ? planSideNotice(
                                  "当前节点暂无产出文档",
                                  node.receiverType === "human"
                                    ? `${ownerName} 提交任务结果或上传附件后，文档会显示在这里。`
                                    : "子任务开始执行并提交产出后，文档会显示在这里。",
                                  "outputs-empty",
                                )
                              : planSideNotice(
                                  "计划阶段暂无产出文档",
                                  `产出文档会在子任务开始执行并提交后出现在这里。${stageCopy}`,
                                  "outputs-plan",
                                ),
                        ]),
                    acceptanceItems.length
                      ? planSideNotice(
                          "验收要求",
                          acceptanceItems
                            .map((item, index) => `${index + 1}. ${item}`)
                            .join("\n"),
                          "outputs-acceptance",
                        )
                      : null,
                  )
                : h(
                    "div",
                    { className: "pmrw-plan-record-list" },
                    ...(sideProblem
                      ? [
                          planSideNotice(
                            sideProblemTitle,
                            sideProblem,
                            "activity-error",
                            "error",
                          ),
                        ]
                      : []),
                    ...(taskEvents.length
                      ? taskEvents.map((event) =>
                          h(
                            "article",
                            { key: event.id, className: "pmrw-plan-record" },
                            h("strong", null, event.actorName),
                            h("p", null, event.message),
                            event.at
                              ? h(
                                  "div",
                                  { className: "pmrw-plan-record-meta" },
                                  formatPlanTime(event.at),
                                )
                              : null,
                          ),
                        )
                      : [
                          detailLoading || ensuringTask
                            ? planSideNotice(
                                "正在读取任务动态",
                                "正在加载该子任务的状态事件。",
                                "activity-loading",
                              )
                            : resolvedTaskId !== undefined
                              ? planSideNotice(
                                  "子任务已创建",
                                  "当前还没有状态事件。后续派发、执行和验收变化会记录在这里。",
                                  "activity-empty",
                                )
                              : planSideNotice(
                                  `节点状态 · ${nodeStatusMeta.label}`,
                                  `${stageCopy}\n负责人：${ownerName}${
                                    nodeState?.updatedAt
                                      ? `\n更新时间：${formatPlanTime(nodeState.updatedAt)}`
                                      : ""
                                  }`,
                                  "activity-plan-state",
                                ),
                          dependencyNodes.length
                            ? planSideNotice(
                                "前置任务",
                                dependencySummary,
                                "activity-dependencies",
                              )
                            : null,
                        ]),
                  ),
          savePromptOpen
            ? h(
                "div",
                {
                  className: "pmrw-unsaved-backdrop",
                  role: "presentation",
                  onMouseDown: (event) => event.stopPropagation(),
                },
                h(
                  "section",
                  {
                    className: "pmrw-unsaved-dialog",
                    role: "dialog",
                    "aria-modal": "true",
                    "aria-labelledby": "pmrw-unsaved-title",
                  },
                  h(
                    "div",
                    { className: "pmrw-unsaved-head" },
                    h("h3", { id: "pmrw-unsaved-title" }, "保存节点修改？"),
                    h("p", null, "右侧有未保存的修改。离开前是否保存？"),
                  ),
                  error ? h("p", { className: "pmrw-error" }, error) : null,
                  h(
                    "div",
                    { className: "pmrw-unsaved-actions" },
                    h(
                      "button",
                      {
                        className: "pmrw-button secondary",
                        type: "button",
                        disabled: savePromptSaving,
                        onClick: () => setSavePromptOpen(false),
                      },
                      "继续编辑",
                    ),
                    h(
                      "button",
                      {
                        className: "pmrw-button secondary danger",
                        type: "button",
                        disabled: savePromptSaving,
                        onClick: discardNodeChanges,
                      },
                      "不保存",
                    ),
                    h(
                      "button",
                      {
                        className: "pmrw-button primary",
                        type: "button",
                        disabled: savePromptSaving || saving,
                        onClick: async () => {
                          setSavePromptSaving(true);
                          const saved = await saveNode();
                          setSavePromptSaving(false);
                          if (saved) setSavePromptOpen(false);
                        },
                      },
                      savePromptSaving || saving ? "保存中..." : "保存",
                    ),
                  ),
                ),
              )
            : null,
        ),
      );
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.task.settings", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.settings",
            id: "pluginmax-router-worker-settings",
            order: 30,
          },
          ExtensionSettings,
        ),
      );
      ctx.slots.inject("pluginmax.task.detail.actions", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.detail.actions",
            id: "pluginmax-router-worker-plan-entry",
            order: 25,
          },
          PlanEntry,
        ),
      );
      ctx.slots.inject("pluginmax.task.detail.main", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.detail.main",
            id: "pluginmax-router-worker-plan-main",
            order: 20,
            select: (owner) =>
              owner.open === true && locallyEnabled(owner.workspaceId)
                ? owner
                : null,
          },
          PlanCenter,
        ),
      );
      ctx.slots.inject("pluginmax.task.detail.side", () =>
        ctx.slots.register(
          {
            name: "pluginmax.task.detail.side",
            id: "pluginmax-router-worker-plan-side",
            order: 20,
            select: (owner) =>
              owner.open === true &&
              locallyEnabled(owner.workspaceId) &&
              typeof owner.nodeId === "string" &&
              owner.nodeId !== ""
                ? owner
                : null,
          },
          PlanSide,
        ),
      );
    };

    return module.exports;
  },
});
