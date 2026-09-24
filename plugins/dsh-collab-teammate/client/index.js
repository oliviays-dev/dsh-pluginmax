window.__ModuleLoader__.load({
  id: "dsh-collab-teammate",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;

    const TOKEN_KEY = "pluginmax.collab.token";
    const ACCENT = "var(--dsw-alias-accent-primary,#4f8ef7)";
    const STATE_LABEL = {
      draft: "草稿",
      active: "已生效",
      paused: "已暂停",
      inactive: "已失效",
      archived: "已归档",
    };
    const SOURCE_LABEL = { platform: "平台归属", personal: "个人归属" };
    const STATUS_LABEL = {
      todo: "待处理",
      progress: "进行中",
      review: "待验收",
      done: "已完成",
    };
    const RUN_STATUS_LABEL = {
      queued: "排队中",
      running: "运行中",
      waiting_input: "等待补充",
      succeeded: "已成功",
      failed: "失败",
      timeout: "超时",
      cancelled: "已取消",
      interrupted: "已中断",
    };
    const AVATAR_PRESETS = [
      { id: "sky", name: "晴空", bg: "#d9efff", shirt: "#568fd8", skin: "#f1c5a3", hair: "#244d77", accent: "#ffd166", hairStyle: "wave", glasses: false },
      { id: "sunset", name: "晚霞", bg: "#ffe5d8", shirt: "#db6d65", skin: "#d99a76", hair: "#743d2d", accent: "#ff8d7a", hairStyle: "bun", glasses: false },
      { id: "forest", name: "森屿", bg: "#def6e8", shirt: "#3f9d73", skin: "#e3b08d", hair: "#245543", accent: "#67d4a1", hairStyle: "side", glasses: false },
      { id: "berry", name: "莓果", bg: "#f1e2ff", shirt: "#7d59c6", skin: "#efb38f", hair: "#533275", accent: "#c06cff", hairStyle: "bob", glasses: false },
      { id: "lemon", name: "柠光", bg: "#fff3c9", shirt: "#d7a62e", skin: "#d49974", hair: "#414554", accent: "#f2cb45", hairStyle: "wave", glasses: true },
      { id: "ocean", name: "海盐", bg: "#d9f4ff", shirt: "#2f84a8", skin: "#ce9874", hair: "#164f6f", accent: "#4fc3e8", hairStyle: "bun", glasses: true },
    ];

    const styles = `
      .pmtm{min-height:100%;flex:1 1 auto;display:flex;flex-direction:column;padding:18px 20px 30px;color:var(--dsw-alias-label-primary);}
      .pmtm *{box-sizing:border-box;}
      .pmtm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
      .pmtm-head h1{margin:0;font-size:19px;line-height:1.3;}
      .pmtm-sub{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmtm-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .pmtm-badge{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border:0.5px solid color-mix(in srgb,${ACCENT} 40%,transparent);border-radius:999px;background:color-mix(in srgb,${ACCENT} 12%,transparent);color:${ACCENT};font-size:10.5px;white-space:nowrap;}
      .pmtm-badge svg{width:12px;height:12px;}
      .pmtm-btn{height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:6px;padding:0 12px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;}
      .pmtm-btn.secondary{background:transparent;border:0.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);font-weight:500;}
      .pmtm-btn.danger{background:transparent;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 45%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmtm-btn.small{height:26px;padding:0 9px;font-size:11px;}
      .pmtm-btn:disabled{opacity:.45;cursor:not-allowed;}
      .pmtm-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:16px;}
      .pmtm-tabs{display:inline-flex;align-items:center;gap:3px;padding:3px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
      .pmtm-tab{min-height:30px;padding:5px 11px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;}
      .pmtm-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
      .pmtm-tab.active{color:#fff;background:${ACCENT};}
      .pmtm-toolbar-note{max-width:460px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:1.5;text-align:right;}
      .pmtm-layout{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(230px,280px) minmax(0,1fr);gap:14px;align-items:stretch;margin-top:12px;}
      .pmtm-panel{min-width:0;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);}
      .pmtm-directory{padding:9px;align-self:start;}
      .pmtm-group + .pmtm-group{margin-top:12px;padding-top:11px;border-top:0.5px solid var(--dsw-alias-border-l2);}
      .pmtm-group-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 5px 7px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-weight:700;}
      .pmtm-group-title span{font-weight:500;}
      .pmtm-item{width:100%;display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border:0.5px solid transparent;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;font:inherit;}
      .pmtm-item:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
      .pmtm-item.active{color:var(--dsw-alias-label-primary);border-color:color-mix(in srgb,${ACCENT} 34%,transparent);background:color-mix(in srgb,${ACCENT} 12%,transparent);}
      .pmtm-item-copy{min-width:0;}
      .pmtm-item-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;}
      .pmtm-item-copy small{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmtm-state-text{flex:none;font-size:10.5px;white-space:nowrap;}
      .pmtm-state-text.active{color:#34d47e;}
      .pmtm-state-text.paused{color:#e8a33d;}
      .pmtm-state-text.inactive,.pmtm-state-text.archived{color:var(--dsw-alias-label-tertiary);}
      .pmtm-state-text.draft{color:${ACCENT};}
      .pmtm-tick{width:12px;height:12px;flex:none;border-radius:50%;border:2px solid color-mix(in srgb,${ACCENT} 22%,transparent);border-top-color:${ACCENT};animation:pmtmSpin .72s linear infinite;}
      .pmtm-avatar{width:32px;height:32px;display:grid;place-items:center;padding:2px;border-radius:50%;flex:none;color:#fff;font-size:10px;font-weight:800;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.26),0 0 14px rgba(79,142,247,.12);}
      .pmtm-avatar.platform{background:#63b8ff;box-shadow:0 0 0 1px rgba(99,184,255,.55);}
      .pmtm-avatar.large{width:42px;height:42px;font-size:12px;}
      .pmtm-avatar-art{width:100%;height:100%;display:block;overflow:hidden;border:2px solid var(--dsw-alias-bg-layer-1);border-radius:50%;background:#20242a;object-fit:cover;}
      .pmtm-editor{padding:16px;min-height:420px;}
      .pmtm-editor-head{display:flex;align-items:flex-start;gap:12px;}
      .pmtm-editor-head h2{margin:0;font-size:18px;line-height:1.3;overflow-wrap:anywhere;}
      .pmtm-editor-main{flex:1;min-width:0;}
      .pmtm-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
      .pmtm-state{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;font-size:10px;}
      .pmtm-state.active{color:#34d47e;background:rgba(52,212,126,.13);}
      .pmtm-state.paused{color:#e8a33d;background:rgba(232,163,61,.14);}
      .pmtm-state.inactive,.pmtm-state.archived{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);}
      .pmtm-state.draft{color:${ACCENT};background:color-mix(in srgb,${ACCENT} 14%,transparent);}
      .pmtm-notice{display:flex;gap:8px;margin-top:13px;padding:10px 11px;border:0.5px solid rgba(232,163,61,.3);border-radius:7px;color:#e9c68c;background:rgba(232,163,61,.14);font-size:11.5px;line-height:1.6;}
      .pmtm-notice.info{border-color:color-mix(in srgb,${ACCENT} 30%,transparent);color:color-mix(in srgb,${ACCENT} 70%,var(--dsw-alias-label-primary));background:color-mix(in srgb,${ACCENT} 12%,transparent);}
      .pmtm-notice svg{flex:none;width:15px;height:15px;margin-top:1px;}
      .pmtm-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px;}
      .pmtm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px;}
      .pmtm-grid.wide-gap{gap:12px;}
      .pmtm-grid .wide{grid-column:1 / -1;}
      .pmtm-field{display:grid;gap:4px;min-width:0;}
      .pmtm-field > .label{color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
      .pmtm-field.card{padding:9px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);}
      .pmtm-field .value{color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.55;overflow-wrap:anywhere;white-space:pre-wrap;}
      .pmtm-input,.pmtm-area,.pmtm-select{width:100%;min-width:0;min-height:34px;padding:7px 9px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;}
      .pmtm-area{min-height:92px;resize:vertical;}
      .pmtm-area.soul{min-height:210px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.55;}
      .pmtm-block{padding:12px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);min-width:0;}
      .pmtm-block h3{margin:0 0 8px;font-size:12.5px;}
      .pmtm-block pre{margin:0;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.55;}
      .pmtm-rules{margin:0;padding:0;list-style:none;display:grid;gap:6px;}
      .pmtm-rules li{display:flex;gap:6px;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmtm-rules li::before{content:"";flex:none;width:5px;height:5px;margin-top:6px;border-radius:50%;background:${ACCENT};}
      .pmtm-timeline{display:grid;gap:7px;}
      .pmtm-event{display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmtm-event time{color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
      .pmtm-runtime{display:grid;gap:8px;margin-top:14px;}
      .pmtm-runtime-item{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;padding:11px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);}
      .pmtm-runtime-item > :last-child{grid-row:1;grid-column:2;align-self:start;white-space:nowrap;}
      .pmtm-runtime-item.status-progress{border-left:3px solid ${ACCENT};}
      .pmtm-runtime-item.status-review{border-left:3px solid #a48bff;}
      .pmtm-runtime-item.status-done{border-left:3px solid #34d47e;}
      .pmtm-runtime-item.status-archived{border-left:3px dashed var(--dsw-alias-label-tertiary);opacity:.68;}
      .pmtm-runtime-main{min-width:0;}
      .pmtm-runtime-main strong{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtm-runtime-main small{display:block;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
      .pmtm-runtime-body{grid-column:1 / -1;min-width:0;}
      .pmtm-runtime-body .pmtm-latest{margin-top:0;}
      .pmtm-latest{min-width:0;display:flex;align-items:flex-start;gap:6px;margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.45;}
      .pmtm-latest .label{flex:none;color:var(--dsw-alias-label-tertiary);}
      .pmtm-latest .text{min-width:0;flex:1 1 auto;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;}
      .pmtm-latest .text.expanded{display:block;overflow:visible;}
      .pmtm-latest-toggle{flex:none;border:0;padding:0;background:transparent;color:${ACCENT};font:inherit;font-size:11.5px;cursor:pointer;}
      .pmtm-latest-toggle:hover{text-decoration:underline;}
      .pmtm-latest.streaming .text{color:transparent;background:linear-gradient(90deg,#73839a 0%,#dcecff 42%,#9cb9dc 65%,#73839a 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;animation:pmtmStream 2.2s linear infinite,pmtmReveal 3.2s ease-in-out infinite;}
      .pmtm-caret{flex:none;width:2px;height:12px;border-radius:2px;background:${ACCENT};animation:pmtmBlink .75s step-end infinite;}
      .pmtm-spinner{position:absolute;top:10px;right:10px;width:13px;height:13px;border:2px solid color-mix(in srgb,${ACCENT} 20%,transparent);border-top-color:${ACCENT};border-radius:50%;animation:pmtmSpin .72s linear infinite;}
      @keyframes pmtmSpin{to{transform:rotate(360deg);}}
      @keyframes pmtmStream{to{background-position:-220% 0;}}
      @keyframes pmtmBlink{50%{opacity:0;}}
      @keyframes pmtmReveal{0%,8%{clip-path:inset(0 100% 0 0);}58%,88%{clip-path:inset(0 0 0 0);}100%{clip-path:inset(0 0 0 0);}}
      .pmtm-pill{display:inline-flex;align-items:center;padding:2px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;white-space:nowrap;}
      .pmtm-pill.progress{color:${ACCENT};background:color-mix(in srgb,${ACCENT} 14%,transparent);}
      .pmtm-pill.review{color:#a48bff;background:rgba(164,139,255,.14);}
      .pmtm-pill.done{color:#34d47e;background:rgba(52,212,126,.13);}
      .pmtm-pill.todo{color:var(--dsw-alias-label-secondary);}
      .pmtm-count{min-width:20px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;text-align:center;}
      .pmtm-empty{padding:28px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:7px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:12.5px;}
      .pmtm-avatar-editor{display:flex;gap:12px;align-items:flex-start;}
      .pmtm-avatar-preview{width:64px;height:64px;display:grid;place-items:center;padding:3px;border-radius:50%;flex:none;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.26),0 0 14px rgba(79,142,247,.12);}
      .pmtm-avatar-preview.platform{background:#63b8ff;box-shadow:0 0 0 1px rgba(99,184,255,.55);}
      .pmtm-presets{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;}
      .pmtm-preset{display:grid;justify-items:center;gap:4px;padding:6px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;cursor:pointer;}
      .pmtm-preset:hover{border-color:var(--dsw-alias-border-l4);}
      .pmtm-preset.active{border-color:color-mix(in srgb,${ACCENT} 55%,transparent);background:color-mix(in srgb,${ACCENT} 12%,transparent);color:var(--dsw-alias-label-primary);}
      .pmtm-preset .pmtm-avatar{width:38px;height:38px;}
      .pmtm-error{margin-top:12px;padding:9px 11px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 40%,transparent);border-radius:7px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:11.5px;}
      .pmtm-notice-bar{margin-top:12px;padding:9px 11px;border:0.5px solid color-mix(in srgb,${ACCENT} 30%,transparent);border-radius:7px;background:color-mix(in srgb,${ACCENT} 10%,transparent);color:var(--dsw-alias-label-primary);font-size:11.5px;}
      .pmtm-mask{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:24px;background:rgba(8,10,14,.55);}
      .pmtm-dialog{width:min(980px,100%);max-height:min(84vh,900px);display:flex;flex-direction:column;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 24px 60px rgba(0,0,0,.35);}
      .pmtm-dialog-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:0.5px solid var(--dsw-alias-border-l2);}
      .pmtm-dialog-head h2{flex:1;min-width:0;margin:0;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pmtm-dialog-body{flex:1;min-height:0;overflow:auto;display:grid;gap:12px;align-content:start;padding:14px 16px;}
      .pmtm-dialog-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-top:0.5px solid var(--dsw-alias-border-l2);}
      .pmtm-search-row{display:flex;align-items:center;gap:8px;}
      .pmtm-search-row input{flex:1;min-width:0;height:36px;padding:0 11px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;}
      .pmtm-search-btn{width:36px;height:36px;flex:none;display:grid;place-items:center;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmtm-search-btn:hover{border-color:var(--dsw-alias-border-l4);color:var(--dsw-alias-label-primary);}
      .pmtm-filter-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .pmtm-filter-row select{height:34px;min-width:150px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;}
      .pmtm-result-count{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:11.5px;}
      .pmtm-assign-list{display:grid;gap:10px;}
      .pmtm-assign-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;text-align:left;cursor:pointer;}
      .pmtm-assign-item:hover{border-color:var(--dsw-alias-border-l4);}
      .pmtm-assign-item.selected{border-color:color-mix(in srgb,${ACCENT} 55%,transparent);background:color-mix(in srgb,${ACCENT} 10%,transparent);}
      .pmtm-assign-item strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}
      .pmtm-assign-meta{display:flex;align-items:center;gap:6px;margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:11px;}
      .pmtm-assign-trailing{display:flex;align-items:center;gap:8px;}
      .pmtm-check{width:18px;height:18px;display:grid;place-items:center;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;color:transparent;font-size:11px;}
      .pmtm-assign-item.selected .pmtm-check{border-color:${ACCENT};background:${ACCENT};color:#fff;}
      @media (max-width:1080px){
        .pmtm-layout{grid-template-columns:1fr;}
        .pmtm-grid{grid-template-columns:1fr;}
        .pmtm-grid .wide{grid-column:auto;}
        .pmtm-toolbar{flex-direction:column;align-items:flex-start;}
        .pmtm-toolbar-note{max-width:none;text-align:left;}
        .pmtm-presets{grid-template-columns:repeat(3,minmax(0,1fr));}
      }
    `;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const headers = { "cache-control": "no-store" };
      if (options.body !== undefined) headers["content-type"] = "application/json";
      const current = token();
      if (current !== null) headers.authorization = `Bearer ${current}`;
      const response = await fetch(path, {
        ...options,
        headers: { ...headers, ...options.headers },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      }
      return payload;
    }

    function timeShort(value) {
      if (typeof value !== "string" || value.trim() === "") return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      const pad = (input) => String(input).padStart(2, "0");
      return `${pad(parsed.getMonth() + 1)}/${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
    }

    function hairMarkup(preset) {
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

    function avatarArt(value, key) {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        return h("img", { key, className: "pmtm-avatar-art", src: value, alt: "" });
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
        ...hairMarkup(preset),
        h("circle", { key: "eye-l", cx: 25.5, cy: 31, r: 1.8, fill: "#20232a" }),
        h("circle", { key: "eye-r", cx: 38.5, cy: 31, r: 1.8, fill: "#20232a" }),
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
            { key: "glasses", fill: "none", stroke: preset.hair, strokeWidth: 1.8 },
            [
              h("circle", { key: "g1", cx: 25.5, cy: 31, r: 4 }),
              h("circle", { key: "g2", cx: 38.5, cy: 31, r: 4 }),
              h("path", { key: "g3", d: "M29.5 31h5" }),
            ],
          ),
        );
      }
      children.push(
        h("circle", { key: "shine", cx: 42, cy: 24, r: 3, fill: "#fff", opacity: 0.2 }),
      );
      return h(
        "svg",
        { key, className: "pmtm-avatar-art", viewBox: "0 0 64 64", "aria-hidden": "true" },
        children,
      );
    }

    function TeammateAvatar({ teammate, className, label }) {
      return h(
        "span",
        {
          className: `pmtm-avatar ${teammate.source} ${className ?? ""}`,
          role: "img",
          "aria-label": label ?? `${teammate.name} 的头像`,
          title: label ?? teammate.name,
        },
        avatarArt(teammate.avatar, "art"),
      );
    }

    function LatestProgressText({ task, expanded, onToggle }) {
      const textRef = react.useRef(null);
      const [overflowing, setOverflowing] = react.useState(false);

      react.useLayoutEffect(() => {
        const element = textRef.current;
        if (element === null) return undefined;
        const measure = () => {
          if (!expanded) {
            setOverflowing(element.scrollHeight > element.clientHeight + 1);
          }
        };
        measure();
        if (typeof ResizeObserver === "undefined") {
          window.addEventListener("resize", measure);
          return () => window.removeEventListener("resize", measure);
        }
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
      }, [task.latestProgress, expanded]);

      return h(
        react.Fragment,
        null,
        h(
          "span",
          {
            ref: textRef,
            className: `text${expanded ? " expanded" : ""}`,
          },
          task.latestProgress,
        ),
        overflowing
          ? h(
              "button",
              {
                type: "button",
                className: "pmtm-latest-toggle",
                onClick: onToggle,
                "aria-expanded": expanded,
              },
              expanded ? "折叠" : "展开",
            )
          : null,
      );
    }

    function AiTeammatesPage() {
      const [teammates, setTeammates] = react.useState([]);
      const [canManagePlatform, setCanManagePlatform] = react.useState(false);
      const [runningIds, setRunningIds] = react.useState([]);
      const [identity, setIdentity] = react.useState(null);
      const [assignOpen, setAssignOpen] = react.useState(false);
      const [assignTasks, setAssignTasks] = react.useState([]);
      const [assignQuery, setAssignQuery] = react.useState("");
      const [assignStatus, setAssignStatus] = react.useState("");
      const [assignPriority, setAssignPriority] = react.useState("");
      const [assignProject, setAssignProject] = react.useState("");
      const [assignSelected, setAssignSelected] = react.useState([]);
      const [assignBusy, setAssignBusy] = react.useState(false);
      const [expandedProgressIds, setExpandedProgressIds] = react.useState([]);
      const [expandedRunIds, setExpandedRunIds] = react.useState([]);
      const [selectedId, setSelectedId] = react.useState("");
      const [detail, setDetail] = react.useState(null);
      const [events, setEvents] = react.useState([]);
      const [runtimeTasks, setRuntimeTasks] = react.useState([]);
      const [tab, setTab] = react.useState("runtime");
      const [editing, setEditing] = react.useState(false);
      const [form, setForm] = react.useState(null);
      const [busy, setBusy] = react.useState(false);
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [loading, setLoading] = react.useState(true);

      const fail = (cause) => {
        setNotice("");
        setError(cause instanceof Error ? cause.message : String(cause));
      };
      const succeed = (message) => {
        setError("");
        setNotice(message);
      };

      const loadList = react.useCallback(async (targetId) => {
        if (token() === null) {
          setError("请先在账号管理中登录。");
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const result = await request("/api/collab/teammates");
          const list = result.teammates ?? [];
          setTeammates(list);
          setCanManagePlatform(result.canManagePlatform === true);
          setRunningIds(result.runningTeammateIds ?? []);
          setSelectedId((current) => {
            if (targetId !== undefined && list.some((item) => item.id === targetId)) {
              return targetId;
            }
            if (list.some((item) => item.id === current)) return current;
            const personal = list.find((item) => item.source === "personal");
            return (personal ?? list[0])?.id ?? "";
          });
          setError("");
        } catch (cause) {
          fail(cause);
        } finally {
          setLoading(false);
        }
      }, []);

      const loadDetail = react.useCallback(async (teammateId) => {
        if (teammateId === "") {
          setDetail(null);
          setEvents([]);
          return;
        }
        try {
          const result = await request(
            `/api/collab/teammates/detail?teammateId=${encodeURIComponent(teammateId)}`,
          );
          setDetail(result.teammate ?? null);
          setEvents(result.events ?? []);
        } catch (cause) {
          fail(cause);
        }
      }, []);

      const loadRuntime = react.useCallback(async (teammateId) => {
        if (teammateId === "") {
          setRuntimeTasks([]);
          return;
        }
        try {
          const result = await request(
            `/api/collab/teammates/runtime?teammateId=${encodeURIComponent(teammateId)}`,
          );
          setRuntimeTasks(result.tasks ?? []);
        } catch (cause) {
          fail(cause);
        }
      }, []);

      const loadIdentity = react.useCallback(async (teammateId) => {
        if (teammateId === "") {
          setIdentity(null);
          return;
        }
        try {
          const result = await request(
            `/api/collab/teammates/identity?teammateId=${encodeURIComponent(teammateId)}`,
          );
          setIdentity(result.identity ?? null);
        } catch {
          setIdentity(null);
        }
      }, []);

      react.useEffect(() => {
        void loadList();
      }, [loadList]);

      // 从任务详情返回时恢复到原来的 Teammate 与页签。
      react.useEffect(() => {
        const pending = window.__pluginmaxPendingTeammate;
        if (pending === null || typeof pending !== "object") return;
        window.__pluginmaxPendingTeammate = null;
        if (
          typeof pending.teammateId === "string" &&
          pending.teammateId !== ""
        ) {
          setSelectedId(pending.teammateId);
        }
        if (pending.tab === "definition" || pending.tab === "runtime") {
          setTab(pending.tab);
        }
        setEditing(false);
        setForm(null);
      }, []);

      // 目录里的运行中转圈需要保持实时，所以列表也定期刷新。
      react.useEffect(() => {
        const timer = window.setInterval(() => void loadList(), 8_000);
        return () => window.clearInterval(timer);
      }, [loadList]);

      react.useEffect(() => {
        void loadDetail(selectedId);
        void loadIdentity(selectedId);
        if (tab === "runtime") void loadRuntime(selectedId);
      }, [selectedId, tab, loadDetail, loadIdentity, loadRuntime]);

      const selected = detail ?? teammates.find((item) => item.id === selectedId) ?? null;

      const selectTeammate = (teammateId) => {
        setSelectedId(teammateId);
        setEditing(false);
        setForm(null);
        setError("");
        setNotice("");
      };

      const createTeammate = async (source) => {
        try {
          setBusy(true);
          const result = await request("/api/collab/teammates/create", {
            method: "POST",
            body: { source },
          });
          const teammate = result.teammate;
          await loadList(teammate.id);
          setSelectedId(teammate.id);
          setTab("definition");
          setEditing(true);
          setForm({
            source: teammate.source,
            name: teammate.name,
            role: teammate.role,
            description: teammate.description,
            soul: teammate.soul,
            scenarios: teammate.scenarios.join("\n"),
            goals: teammate.goals.join("\n"),
            avatar: teammate.avatar,
          });
          succeed(
            source === "platform"
              ? "已创建平台归属草稿，保存后才会对全平台生效。"
              : "已创建个人归属草稿，保存后才会生效。",
          );
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy(false);
        }
      };

      const startEdit = () => {
        if (selected === null) return;
        setForm({
          source: selected.source,
          name: selected.name,
          role: selected.role,
          description: selected.description,
          soul: selected.soul,
          scenarios: selected.scenarios.join("\n"),
          goals: selected.goals.join("\n"),
          avatar: selected.avatar,
        });
        setEditing(true);
        setError("");
        setNotice("");
      };

      const cancelEdit = () => {
        setEditing(false);
        setForm(null);
      };

      const saveEdit = async () => {
        if (selected === null || form === null) return;
        try {
          setBusy(true);
          if (
            form.source === "platform" &&
            !window.confirm(
              "这是平台归属定义。保存后会影响全平台该 DE 的所有实例行为。确认继续？",
            )
          ) {
            return;
          }
          const result = await request("/api/collab/teammates/update", {
            method: "POST",
            body: {
              teammateId: selected.id,
              name: form.name,
              source: form.source,
              role: form.role,
              description: form.description,
              soul: form.soul,
              scenarios: form.scenarios
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
              goals: form.goals
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
              avatar: form.avatar,
            },
          });
          setEditing(false);
          setForm(null);
          await loadList(result.teammate.id);
          await loadDetail(result.teammate.id);
          succeed("定义已保存。");
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy(false);
        }
      };

      const changeState = async (nextState) => {
        if (selected === null) return;
        const label =
          nextState === "active"
            ? selected.state === "paused"
              ? "重启"
              : "生效"
            : nextState === "paused"
              ? "暂停"
              : nextState === "inactive"
                ? selected.source === "platform"
                  ? "全局失效"
                  : "失效"
                : "归档";
        if (
          selected.source === "platform" &&
          !window.confirm(
            `这是平台归属定义。确认${label}后，变更会应用到全平台的所有实例。`,
          )
        ) {
          return;
        }
        try {
          setBusy(true);
          const result = await request("/api/collab/teammates/state", {
            method: "POST",
            body: { teammateId: selected.id, state: nextState },
          });
          await loadList(result.teammate.id);
          await loadDetail(result.teammate.id);
          succeed(`${result.teammate.name} 已${label}`);
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy(false);
        }
      };

      const toggleIdentity = async () => {
        if (selected === null || identity === null) return;
        const next = identity.agentStatus === "active" ? "disabled" : "active";
        try {
          setBusy(true);
          const result = await request(
            "/api/collab/teammates/identity/status",
            {
              method: "POST",
              body: { teammateId: selected.id, status: next },
            },
          );
          setIdentity(result.identity ?? null);
          await loadList(selected.id);
          await loadDetail(selected.id);
          succeed(next === "active" ? "执行身份已启用" : "执行身份已停用");
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy(false);
        }
      };

      const openTask = (task) => {
        window.__pluginmaxPendingTask = {
          taskId: task.id,
          workspaceId: task.workspaceId,
          returnRoute: "teammates",
          returnTeammateId: selected?.id ?? "",
          returnTab: tab,
        };
        window.dispatchEvent(
          new CustomEvent("pluginmax:navigate", { detail: { route: "task" } }),
        );
      };

      const openAssign = async () => {
        setAssignQuery("");
        setAssignStatus("");
        setAssignPriority("");
        setAssignProject("");
        setAssignSelected([]);
        setAssignOpen(true);
        try {
          const workspaceResult = await request("/api/collab/team/workspaces");
          const accessible = (workspaceResult.workspaces ?? []).filter(
            (workspace) =>
              workspace.isMember === true || canManagePlatform === true,
          );
          const results = await Promise.all(
            accessible.map((workspace) =>
              request(
                `/api/collab/tasks/bootstrap?workspaceId=${encodeURIComponent(workspace.id)}`,
              ).then((result) => ({ workspace, result })),
            ),
          );
          const merged = [];
          for (const entry of results) {
            for (const task of entry.result.tasks ?? []) {
              merged.push({
                ...task,
                workspaceTitle: entry.workspace.title ?? entry.workspace.id,
              });
            }
          }
          setAssignTasks(merged);
        } catch (cause) {
          fail(cause);
        }
      };

      const confirmAssign = async () => {
        if (selected === null || assignSelected.length === 0) return;
        try {
          setAssignBusy(true);
          for (const taskId of assignSelected) {
            await request("/api/collab/tasks/assign", {
              method: "POST",
              body: {
                taskId,
                receiverType: "agent",
                receiverId: selected.id,
                receiverName: selected.name,
              },
            });
          }
          const count = assignSelected.length;
          setAssignOpen(false);
          setAssignSelected([]);
          await loadList(selected.id);
          await loadDetail(selected.id);
          if (tab === "runtime") await loadRuntime(selected.id);
          succeed(`已将 ${count} 个任务安排给 ${selected.name}，执行已开始。`);
        } catch (cause) {
          fail(cause);
        } finally {
          setAssignBusy(false);
        }
      };

      const readFile = (file, onLoad) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => onLoad(String(reader.result ?? "")));
        reader.readAsText(file);
      };

      const readImage = (file, onLoad) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => onLoad(String(reader.result ?? "")));
        reader.readAsDataURL(file);
      };

      const directoryGroups = [
        {
          key: "platform",
          label: SOURCE_LABEL.platform,
          items: teammates.filter((item) => item.source === "platform"),
        },
        {
          key: "personal",
          label: SOURCE_LABEL.personal,
          items: teammates.filter((item) => item.source === "personal"),
        },
      ];

      const directory = h(
        "aside",
        { className: "pmtm-panel pmtm-directory", "aria-label": "AI Teammates 列表" },
        directoryGroups.map((group) =>
          h(
            "section",
            { className: "pmtm-group", key: group.key },
            h(
              "div",
              { className: "pmtm-group-title" },
              group.label,
              h("span", null, String(group.items.length)),
            ),
            group.items.length === 0
              ? h(
                  "div",
                  { className: "pmtm-empty", style: { padding: "14px", fontSize: 11.5 } },
                  "暂无定义",
                )
              : group.items.map((item) =>
                  h(
                    "button",
                    {
                      key: item.id,
                      type: "button",
                      className: `pmtm-item${item.id === selectedId ? " active" : ""}`,
                      onClick: () => selectTeammate(item.id),
                    },
                    h(TeammateAvatar, { teammate: item }),
                    h(
                      "span",
                      { className: "pmtm-item-copy" },
                      h("strong", null, item.name),
                      h(
                        "small",
                        null,
                        `${item.role || "待定义"} · ${item.ownerName}`,
                      ),
                    ),
                    h(
                      "span",
                      {
                        style: {
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        },
                      },
                      runningIds.includes(item.id)
                        ? h("span", {
                            className: "pmtm-tick",
                            role: "status",
                            title: "有任务正在执行",
                            "aria-label": "有任务正在执行",
                          })
                        : null,
                      h(
                        "span",
                        {
                          className: `pmtm-state-text ${item.state}`,
                          title: STATE_LABEL[item.state] ?? item.state,
                        },
                        STATE_LABEL[item.state] ?? item.state,
                      ),
                    ),
                  ),
                ),
          ),
        ),
      );

      const renderRuntime = (teammate) => {
        const current = runtimeTasks.filter((task) => !task.archived);
        const archived = runtimeTasks.filter((task) => task.archived);
        const item = (task, isArchived) =>
          h(
            "article",
            {
              key: task.id,
              className: `pmtm-runtime-item status-${isArchived ? "archived" : task.status}`,
            },
            task.running ? h("span", { className: "pmtm-spinner", "aria-label": "Agent 正在运行" }) : null,
            h(
              "div",
              { className: "pmtm-runtime-main" },
              h("strong", null, task.title),
              h(
                "small",
                null,
                `${task.id} · 更新 ${timeShort(task.updatedAt)}`,
              ),
            ),
            h(
              "div",
              { className: "pmtm-runtime-body" },
              h(
                "div",
                { className: `pmtm-latest${task.running ? " streaming" : ""}` },
                h("span", { className: "label" }, "最新进展"),
                h(LatestProgressText, {
                  task,
                  expanded: expandedProgressIds.includes(task.id),
                  onToggle: () =>
                    setExpandedProgressIds((current) =>
                      current.includes(task.id)
                        ? current.filter((id) => id !== task.id)
                        : [...current, task.id],
                    ),
                }),
                task.running ? h("span", { className: "pmtm-caret", "aria-hidden": "true" }) : null,
              ),
              (task.runs ?? []).length > 0
                ? h(
                    "div",
                    {
                      style: {
                        marginTop: 8,
                        paddingTop: 6,
                        display: "grid",
                        gap: 4,
                        borderTop: "0.5px solid var(--dsw-alias-border-l2)",
                      },
                    },
                    h(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        },
                      },
                      h(
                        "span",
                        {
                          style: {
                            color: "var(--dsw-alias-label-tertiary)",
                            fontSize: 10.5,
                          },
                        },
                        `运行明细（${String((task.runs ?? []).length)}）`,
                      ),
                      (task.runs ?? []).length > 1
                        ? h(
                            "button",
                            {
                              type: "button",
                              className: "pmtm-latest-toggle",
                              onClick: () =>
                                setExpandedRunIds((current) =>
                                  current.includes(task.id)
                                    ? current.filter((id) => id !== task.id)
                                    : [...current, task.id],
                                ),
                            },
                            expandedRunIds.includes(task.id)
                              ? "折叠"
                              : "展开",
                          )
                        : null,
                    ),
                    ...(expandedRunIds.includes(task.id)
                      ? (task.runs ?? [])
                      : (task.runs ?? []).slice(0, 1)
                    ).map((run) =>
                      h(
                        "div",
                        {
                          key: run.id,
                          style: {
                            display: "grid",
                            gap: 2,
                            fontSize: 11,
                            color: "var(--dsw-alias-label-secondary)",
                          },
                        },
                        h(
                          "span",
                          null,
                          [
                            `第 ${String(run.runSeq)} 次`,
                            RUN_STATUS_LABEL[run.status] ?? run.status,
                            run.startedAt === undefined
                              ? undefined
                              : `开始 ${timeShort(run.startedAt)}`,
                            run.endedAt === undefined
                              ? undefined
                              : `结束 ${timeShort(run.endedAt)}`,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        ),
                        run.error === undefined
                          ? null
                          : h(
                              "span",
                              {
                                style: {
                                  color:
                                    "var(--dsw-alias-state-error-primary,#e5534b)",
                                  overflowWrap: "anywhere",
                                },
                              },
                              run.error,
                            ),
                        run.summary === undefined
                          ? null
                          : h(
                              "span",
                              {
                                style: {
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                },
                              },
                              run.summary,
                            ),
                      ),
                    ),
                  )
                : null,
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" } },
              h(
                "span",
                { className: `pmtm-pill ${task.status}` },
                STATUS_LABEL[task.status] ?? task.status,
              ),
              isArchived ? h("span", { className: "pmtm-pill" }, "已归档") : null,
              h(
                "button",
                {
                  type: "button",
                  className: "pmtm-btn secondary small",
                  onClick: () => openTask(task),
                },
                "查看详情",
              ),
            ),
          );
        return h(
          "div",
          null,
          h(
            "div",
            { className: "pmtm-editor-head" },
            h(TeammateAvatar, { teammate, className: "large" }),
            h(
              "div",
              { className: "pmtm-editor-main" },
              h("h2", null, teammate.name),
              h(
                "div",
                { className: "pmtm-meta" },
                h("span", { className: `pmtm-state ${teammate.state}` }, STATE_LABEL[teammate.state] ?? teammate.state),
                h("span", null, teammate.role || "待定义"),
                h("span", null, `最近同步于 ${timeShort(teammate.updatedAt)}`),
              ),
            ),
            h(
              "button",
              {
                type: "button",
                className: "pmtm-btn secondary small",
                onClick: () => setTab("definition"),
              },
              teammate.source === "platform" ? "查看 DE 定义" : "查看 Avatar 定义",
            ),
          ),
          h(
            "div",
            { style: { marginTop: 16 } },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
              h("h3", { style: { margin: 0, fontSize: 13 } }, "当前跟进事项"),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 8 } },
                h("span", { className: "pmtm-count" }, String(current.length)),
                h(
                  "button",
                  {
                    type: "button",
                    className: "pmtm-btn small",
                    onClick: () => void openAssign(),
                  },
                  "安排任务",
                ),
              ),
            ),
            current.length === 0
              ? h(
                  "div",
                  { className: "pmtm-empty", style: { marginTop: 10 } },
                  "当前没有进行或已完成的任务。",
                )
              : h(
                  "div",
                  { className: "pmtm-runtime" },
                  current.map((task) => item(task, false)),
                ),
          ),
          archived.length === 0
            ? null
            : h(
                "div",
                { style: { marginTop: 16, paddingTop: 14, borderTop: "0.5px solid var(--dsw-alias-border-l2)" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
                  h("h3", { style: { margin: 0, fontSize: 13 } }, "已归档"),
                  h("span", { className: "pmtm-count" }, String(archived.length)),
                ),
                h(
                  "div",
                  { className: "pmtm-runtime" },
                  archived.map((task) => item(task, true)),
                ),
              ),
          h(
            "div",
            { style: { marginTop: 16 } },
            h("h3", { style: { margin: "0 0 10px", fontSize: 13 } }, "最近活动"),
            events.length === 0
              ? h("div", { className: "pmtm-empty" }, "暂无运行记录。")
              : h(
                  "div",
                  { className: "pmtm-timeline" },
                  events.map((event) =>
                    h(
                      "div",
                      { className: "pmtm-event", key: event.id },
                      h("time", null, timeShort(event.at)),
                      h("span", null, event.message),
                    ),
                  ),
                ),
          ),
        );
      };

      const renderActions = (teammate) => {
        const manageable =
          teammate.source === "personal" || canManagePlatform === true;
        if (!manageable) return null;
        const buttons = [
          h(
            "button",
            { key: "edit", type: "button", className: "pmtm-btn secondary small", onClick: startEdit },
            "编辑定义",
          ),
        ];
        if (teammate.state === "archived") {
          buttons.push(
            h(
              "button",
              {
                key: "restore",
                type: "button",
                className: "pmtm-btn secondary small",
                onClick: () => changeState("inactive"),
              },
              "复原",
            ),
          );
          return h("div", { className: "pmtm-actions" }, buttons);
        }
        if (teammate.state === "active") {
          buttons.push(
            h(
              "button",
              {
                key: "deactivate",
                type: "button",
                className: "pmtm-btn secondary small",
                onClick: () =>
                  changeState(teammate.source === "personal" ? "paused" : "inactive"),
              },
              teammate.source === "personal" ? "暂停" : "全局失效",
            ),
          );
        } else {
          buttons.push(
            h(
              "button",
              {
                key: "activate",
                type: "button",
                className: "pmtm-btn secondary small",
                onClick: () => changeState("active"),
              },
              teammate.state === "paused" ? "重启" : "生效",
            ),
          );
        }
        if (
          teammate.source === "personal" &&
          !["inactive", "archived", "draft"].includes(teammate.state)
        ) {
          buttons.push(
            h(
              "button",
              {
                key: "invalidate",
                type: "button",
                className: "pmtm-btn secondary small",
                onClick: () => changeState("inactive"),
              },
              "失效",
            ),
          );
        }
        buttons.push(
          h(
            "button",
            {
              key: "archive",
              type: "button",
              className: "pmtm-btn secondary small",
              onClick: () => changeState("archived"),
            },
            "归档",
          ),
        );
        return h("div", { className: "pmtm-actions" }, buttons);
      };

      const renderEditor = (teammate) => {
        const setField = (key, value) =>
          setForm((current) => (current === null ? current : { ...current, [key]: value }));
        return h(
          "div",
          null,
          h(
            "div",
            { className: "pmtm-editor-head" },
            h(TeammateAvatar, { teammate: { ...teammate, avatar: form.avatar }, className: "large" }),
            h(
              "div",
              { className: "pmtm-editor-main" },
              h(
                "h2",
                null,
                teammate.state === "draft" ? "新建 AI Teammate" : `编辑 ${teammate.name}`,
              ),
              h(
                "div",
                { className: "pmtm-meta" },
                `归属：${form.source === "platform" ? "平台" : "本人"} · ${teammate.version}`,
              ),
            ),
          ),
          teammate.source === "platform" || form.source === "platform"
            ? h(
                "div",
                { className: "pmtm-notice" },
                h(
                  "svg",
                  {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: 2,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  },
                  h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" }),
                  h("path", { d: "M12 8v4M12 16h.01" }),
                ),
                h(
                  "span",
                  null,
                  "平台归属定义会共享给全平台，只有平台管理员可以维护；会议里的额外要求写在该次派遣的「本次嘱咐」上，不会改动这份定义。",
                ),
              )
            : null,
          h(
            "div",
            { className: "pmtm-grid" },
            h(
              "div",
              { className: "pmtm-field wide" },
              h("span", { className: "label" }, "头像"),
              h(
                "div",
                { className: "pmtm-avatar-editor" },
                h(
                  "span",
                  {
                    className: `pmtm-avatar-preview${form.source === "platform" ? " platform" : ""}`,
                  },
                  avatarArt(form.avatar, "preview"),
                ),
                h(
                  "div",
                  { style: { flex: 1, minWidth: 0 } },
                  h(
                    "div",
                    { className: "pmtm-presets" },
                    AVATAR_PRESETS.map((preset) =>
                      h(
                        "button",
                        {
                          key: preset.id,
                          type: "button",
                          className: `pmtm-preset${form.avatar === preset.id ? " active" : ""}`,
                          onClick: () => setField("avatar", preset.id),
                        },
                        h(TeammateAvatar, { teammate: { source: teammate.source, avatar: preset.id, name: preset.name } }),
                        h("span", null, preset.name),
                      ),
                    ),
                  ),
                  h(
                    "label",
                    { className: "pmtm-btn secondary small", style: { marginTop: 8, cursor: "pointer" } },
                    "上传图片",
                    h("input", {
                      type: "file",
                      accept: "image/*",
                      style: { display: "none" },
                      onChange: (event) => {
                        const file = event.target.files?.[0];
                        if (file !== undefined) {
                          readImage(file, (value) => {
                            setField("avatar", value);
                            succeed(`已载入头像 ${file.name}`);
                          });
                        }
                      },
                    }),
                  ),
                ),
              ),
            ),
            h(
              "label",
              { className: "pmtm-field" },
              h("span", { className: "label" }, "名称"),
              h("input", {
                className: "pmtm-input",
                value: form.name,
                onChange: (event) => setField("name", event.target.value),
              }),
            ),
            h(
              "label",
              { className: "pmtm-field" },
              h("span", { className: "label" }, "专业角色"),
              h("input", {
                className: "pmtm-input",
                value: form.role,
                onChange: (event) => setField("role", event.target.value),
              }),
            ),
            h(
              "label",
              { className: "pmtm-field" },
              h("span", { className: "label" }, "归属"),
              teammate.state === "draft"
                ? h(
                    "select",
                    {
                      className: "pmtm-select",
                      value: form.source,
                      onChange: (event) => setField("source", event.target.value),
                    },
                    h("option", { value: "personal" }, "个人归属 · 本人"),
                    canManagePlatform
                      ? h("option", { value: "platform" }, "平台归属 · 全平台共享")
                      : null,
                  )
                : h("input", {
                    className: "pmtm-input",
                    value: teammate.source === "platform" ? "平台" : teammate.ownerName,
                    disabled: true,
                  }),
            ),
            h(
              "label",
              { className: "pmtm-field" },
              h("span", { className: "label" }, "当前版本"),
              h("input", { className: "pmtm-input", value: teammate.version, disabled: true }),
            ),
            h(
              "label",
              { className: "pmtm-field wide" },
              h("span", { className: "label" }, "基础说明"),
              h("textarea", {
                className: "pmtm-area",
                value: form.description,
                onChange: (event) => setField("description", event.target.value),
              }),
            ),
            h(
              "div",
              { className: "pmtm-field wide" },
              h(
                "div",
                { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
                h("span", { className: "label" }, "SOUL.md"),
                h(
                  "label",
                  { className: "pmtm-btn secondary small", style: { cursor: "pointer" } },
                  "上传 .md",
                  h("input", {
                    type: "file",
                    accept: ".md,text/markdown,text/plain",
                    style: { display: "none" },
                    onChange: (event) => {
                      const file = event.target.files?.[0];
                      if (file !== undefined) {
                        readFile(file, (value) => {
                          setField("soul", value);
                          succeed(`已载入 ${file.name}`);
                        });
                      }
                    },
                  }),
                ),
              ),
              h("textarea", {
                className: "pmtm-area soul",
                value: form.soul,
                onChange: (event) => setField("soul", event.target.value),
              }),
            ),
            h(
              "label",
              { className: "pmtm-field" },
              h("span", { className: "label" }, "场景行为（每行一项）"),
              h("textarea", {
                className: "pmtm-area",
                value: form.scenarios,
                onChange: (event) => setField("scenarios", event.target.value),
              }),
            ),
            h(
              "label",
              { className: "pmtm-field" },
              h("span", { className: "label" }, "工作目标（每行一项）"),
              h("textarea", {
                className: "pmtm-area",
                value: form.goals,
                onChange: (event) => setField("goals", event.target.value),
              }),
            ),
            h(
              "div",
              { className: "pmtm-actions wide", style: { gridColumn: "1 / -1" } },
              h(
                "button",
                { type: "button", className: "pmtm-btn secondary small", onClick: cancelEdit },
                "取消",
              ),
              h(
                "button",
                {
                  type: "button",
                  className: "pmtm-btn small",
                  disabled: busy || form.name.trim() === "",
                  onClick: () => void saveEdit(),
                },
                form.source === "platform" ? "保存全局定义" : "保存定义",
              ),
            ),
          ),
        );
      };

      const renderDefinition = (teammate) => {
        if (editing && form !== null) return renderEditor(teammate);
        return h(
          "div",
          null,
          h(
            "div",
            { className: "pmtm-editor-head" },
            h(TeammateAvatar, { teammate, className: "large" }),
            h(
              "div",
              { className: "pmtm-editor-main" },
              h("h2", null, teammate.name),
              h(
                "div",
                { className: "pmtm-meta" },
                h("span", { className: `pmtm-state ${teammate.state}` }, STATE_LABEL[teammate.state] ?? teammate.state),
                h("span", null, `归属：${teammate.source === "platform" ? "平台" : teammate.ownerName}`),
                h("span", null, teammate.role || "待定义"),
                h("span", null, teammate.version),
              ),
            ),
          ),
          renderActions(teammate),
          teammate.source === "platform"
            ? h(
                "div",
                { className: "pmtm-notice" },
                h(
                  "svg",
                  {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: 2,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  },
                  h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" }),
                  h("path", { d: "M12 8v4M12 16h.01" }),
                ),
                h(
                  "span",
                  null,
                  "平台归属定义会共享给全平台。编辑、生效或失效将作用于该 DE 的全平台实例行为，仅平台管理员可操作。",
                ),
              )
            : h(
                "div",
                { className: "pmtm-notice info" },
                h(
                  "svg",
                  {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: 2,
                    strokeLinecap: "round",
                  },
                  h("circle", { cx: 12, cy: 12, r: 9 }),
                  h("path", { d: "M12 8h.01M11 12h1v5h1" }),
                ),
                h(
                  "span",
                  null,
                  "这份定义会被你在会议、任务和评审中的该分身复用。针对某次会议的额外要求，在派遣时填写「本次嘱咐」，不会改动这份定义。",
                ),
              ),
          h(
            "section",
            { className: "pmtm-block", style: { marginTop: 14 } },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                },
              },
              h("h3", { style: { margin: 0 } }, "执行身份"),
              identity === null
                ? null
                : h(
                    "button",
                    {
                      type: "button",
                      className: "pmtm-btn secondary small",
                      disabled: busy,
                      onClick: () => void toggleIdentity(),
                    },
                    identity.agentStatus === "active" ? "停用" : "启用",
                  ),
            ),
            identity === null
              ? h(
                  "div",
                  {
                    style: {
                      marginTop: 8,
                      color: "var(--dsw-alias-label-tertiary)",
                      fontSize: 11.5,
                    },
                  },
                  "尚未开通执行身份；首次派发任务时会自动创建。",
                )
              : h(
                  "div",
                  { className: "pmtm-grid", style: { marginTop: 8 } },
                  ...[
                    ["项目", identity.workspaceId],
                    [
                      "Agent Profile",
                      `${identity.profileName} · ${identity.profileId}`,
                    ],
                    ["执行类型", identity.runtimeKind],
                    ["Persona", identity.personaId ?? "未设置"],
                    [
                      "工具白名单",
                      identity.allowedTools.length === 0
                        ? "无（不允许工具调用）"
                        : identity.allowedTools.join("、"),
                    ],
                    [
                      "Profile 状态",
                      identity.agentStatus === "active" ? "启用" : "停用",
                    ],
                  ].map(([label, value]) =>
                    h(
                      "div",
                      { className: "pmtm-field card", key: label },
                      h("span", { className: "label" }, label),
                      h("span", { className: "value" }, value),
                    ),
                  ),
                ),
          ),
          h(
            "div",
            { className: "pmtm-grid" },
            h(
              "div",
              { className: "pmtm-field card" },
              h("span", { className: "label" }, "归属"),
              h("span", { className: "value" }, teammate.source === "platform" ? "平台" : teammate.ownerName),
            ),
            h(
              "div",
              { className: "pmtm-field card" },
              h("span", { className: "label" }, "定义版本"),
              h("span", { className: "value" }, `${teammate.version} · ${timeShort(teammate.updatedAt)} 更新`),
            ),
            h(
              "div",
              { className: "pmtm-field card wide" },
              h("span", { className: "label" }, "基础说明"),
              h("span", { className: "value" }, teammate.description || "尚未填写。"),
            ),
          ),
          h(
            "div",
            { className: "pmtm-grid wide-gap" },
            h(
              "section",
              { className: "pmtm-block" },
              h("h3", null, "SOUL.md"),
              h("pre", null, teammate.soul || "尚未填写。"),
            ),
            h(
              "section",
              { className: "pmtm-block" },
              h("h3", null, "场景行为"),
              teammate.scenarios.length === 0
                ? h("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11.5 } }, "尚未填写。")
                : h(
                    "ul",
                    { className: "pmtm-rules" },
                    teammate.scenarios.map((item, index) => h("li", { key: index }, item)),
                  ),
              h("h3", { style: { marginTop: 12 } }, "工作目标"),
              teammate.goals.length === 0
                ? h("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11.5 } }, "尚未填写。")
                : h(
                    "ul",
                    { className: "pmtm-rules" },
                    teammate.goals.map((item, index) => h("li", { key: index }, item)),
                  ),
            ),
            h(
              "section",
              { className: "pmtm-block", style: { gridColumn: "1 / -1" } },
              h("h3", null, "最近变更"),
              events.length === 0
                ? h("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11.5 } }, "暂无变更记录。")
                : h(
                    "div",
                    { className: "pmtm-timeline" },
                    events.map((event) =>
                      h(
                        "div",
                        { className: "pmtm-event", key: event.id },
                        h("time", null, timeShort(event.at)),
                        h("span", null, `${event.actorName} · ${event.message}`),
                      ),
                    ),
                  ),
            ),
          ),
        );
      };

      const assignCandidates = assignTasks
        .filter((task) => task.archivedAt === undefined)
        .filter((task) => task.status !== "done")
        .filter((task) => task.receiverId !== selected?.id)
        .filter((task) => assignStatus === "" || task.status === assignStatus)
        .filter(
          (task) => assignPriority === "" || task.priority === assignPriority,
        )
        .filter(
          (task) =>
            assignProject === "" || task.workspaceTitle === assignProject,
        )
        .filter((task) => {
          const keyword = assignQuery.trim().toLowerCase();
          if (keyword === "") return true;
          return [
            task.id,
            task.title,
            task.description,
            task.workspaceTitle,
            task.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        })
        .sort(
          (left, right) =>
            left.priority.localeCompare(right.priority) ||
            left.id.localeCompare(right.id),
        );

      return h(
        "div",
        { className: "pmtm" },
        h("style", null, styles),
        h(
          "div",
          { className: "pmtm-head" },
          h(
            "div",
            null,
            h("h1", null, "AI Teammates"),
          ),
          h(
            "div",
            { className: "pmtm-head-actions" },
            canManagePlatform
              ? h(
                  "span",
                  { className: "pmtm-badge" },
                  h(
                    "svg",
                    {
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    },
                    h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" }),
                    h("path", { d: "m9 12 2 2 4-4" }),
                  ),
                  "平台管理员",
                )
              : null,
            canManagePlatform
              ? h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 8 } },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtm-btn secondary",
                      disabled: busy,
                      onClick: () => void createTeammate("personal"),
                    },
                    "新建个人 Teammate",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtm-btn",
                      disabled: busy,
                      onClick: () => void createTeammate("platform"),
                    },
                    "新建平台 Teammate",
                  ),
                )
              : h(
                  "button",
                  {
                    type: "button",
                    className: "pmtm-btn",
                    disabled: busy,
                    onClick: () => void createTeammate("personal"),
                  },
                  "新建 Teammate",
                ),
          ),
        ),
        h(
          "div",
          { className: "pmtm-toolbar" },
          h(
            "div",
            { className: "pmtm-tabs", role: "tablist", "aria-label": "AI Teammates 查看方式" },
            h(
              "button",
              {
                type: "button",
                role: "tab",
                className: `pmtm-tab${tab === "runtime" ? " active" : ""}`,
                "aria-selected": tab === "runtime",
                onClick: () => {
                  setTab("runtime");
                  setEditing(false);
                  setForm(null);
                },
              },
              "运行态管理",
            ),
            h(
              "button",
              {
                type: "button",
                role: "tab",
                className: `pmtm-tab${tab === "definition" ? " active" : ""}`,
                "aria-selected": tab === "definition",
                onClick: () => {
                  setTab("definition");
                  setEditing(false);
                  setForm(null);
                },
              },
              "定义态管理",
            ),
          ),
        ),
        error !== "" ? h("div", { className: "pmtm-error" }, error) : null,
        notice !== "" ? h("div", { className: "pmtm-notice-bar" }, notice) : null,
        h(
          "div",
          { className: "pmtm-layout" },
          directory,
          h(
            "section",
            { className: "pmtm-panel pmtm-editor", "aria-label": "AI Teammate 详情" },
            loading && teammates.length === 0
              ? h("div", { className: "pmtm-empty" }, "加载中…")
              : selected === null
                ? h("div", { className: "pmtm-empty" }, "还没有 AI Teammate。")
                : tab === "runtime"
                  ? renderRuntime(selected)
                  : renderDefinition(selected),
          ),
        ),
        assignOpen
          ? h(
              "div",
              {
                className: "pmtm-mask",
                onClick: (event) => {
                  if (event.target === event.currentTarget) setAssignOpen(false);
                },
              },
              h(
                "div",
                {
                  className: "pmtm-dialog",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": `选择任务安排给 ${selected?.name ?? ""}`,
                },
                h(
                  "div",
                  { className: "pmtm-dialog-head" },
                  h("h2", null, `选择任务安排给 ${selected?.name ?? ""}`),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtm-btn small",
                      onClick: () => {
                        setAssignOpen(false);
                        window.dispatchEvent(
                          new CustomEvent("pluginmax:navigate", {
                            detail: { route: "task" },
                          }),
                        );
                      },
                    },
                    "新建任务",
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtm-btn secondary small",
                      "aria-label": "关闭",
                      onClick: () => setAssignOpen(false),
                    },
                    "×",
                  ),
                ),
                h(
                  "div",
                  { className: "pmtm-dialog-body" },
                  h(
                    "div",
                    { className: "pmtm-search-row" },
                    h("input", {
                      value: assignQuery,
                      placeholder: "搜索任务、编号、项目、接收方或状态",
                      onChange: (event) => setAssignQuery(event.target.value),
                    }),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "pmtm-search-btn",
                        "aria-label": "搜索任务",
                      },
                      "⌕",
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmtm-filter-row" },
                    h(
                      "select",
                      {
                        "aria-label": "任务状态",
                        value: assignStatus,
                        onChange: (event) => setAssignStatus(event.target.value),
                      },
                      h("option", { value: "" }, "任务状态"),
                      h("option", { value: "todo" }, "待处理"),
                      h("option", { value: "progress" }, "进行中"),
                      h("option", { value: "review" }, "待验收"),
                    ),
                    h(
                      "select",
                      {
                        "aria-label": "优先级",
                        value: assignPriority,
                        onChange: (event) => setAssignPriority(event.target.value),
                      },
                      h("option", { value: "" }, "优先级"),
                      h("option", { value: "P1" }, "P1"),
                      h("option", { value: "P2" }, "P2"),
                      h("option", { value: "P3" }, "P3"),
                    ),
                    h(
                      "select",
                      {
                        "aria-label": "项目名称",
                        value: assignProject,
                        onChange: (event) => setAssignProject(event.target.value),
                      },
                      h("option", { value: "" }, "项目名称"),
                      ...[
                        ...new Set(
                          assignTasks.map((task) => task.workspaceTitle),
                        ),
                      ].map((title) => h("option", { value: title, key: title }, title)),
                    ),
                    h(
                      "span",
                      { className: "pmtm-result-count" },
                      `${String(assignCandidates.length)} 个可选任务`,
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmtm-assign-list" },
                    assignCandidates.length === 0
                      ? h(
                          "div",
                          { className: "pmtm-empty" },
                          "没有可安排的现有任务。",
                        )
                      : assignCandidates.map((task) => {
                          const checked = assignSelected.includes(task.id);
                          return h(
                            "button",
                            {
                              key: task.id,
                              type: "button",
                              className: `pmtm-assign-item${checked ? " selected" : ""}`,
                              "aria-pressed": checked,
                              onClick: () =>
                                setAssignSelected((current) =>
                                  current.includes(task.id)
                                    ? current.filter((id) => id !== task.id)
                                    : [...current, task.id],
                                ),
                            },
                            h(
                              "span",
                              null,
                              h("strong", null, `${task.id} · ${task.title}`),
                              h(
                                "span",
                                { className: "pmtm-assign-meta" },
                                h(
                                  "span",
                                  null,
                                  `${task.workspaceTitle ?? task.workspaceId} · 更新 ${timeShort(task.updatedAt)}`,
                                ),
                                h(
                                  "span",
                                  { className: `pmtm-pill ${task.status}` },
                                  STATUS_LABEL[task.status] ?? task.status,
                                ),
                              ),
                            ),
                            h(
                              "span",
                              { className: "pmtm-assign-trailing" },
                              h("span", { className: "pmtm-pill" }, task.priority),
                              h(
                                "span",
                                { className: "pmtm-check", "aria-hidden": "true" },
                                "✓",
                              ),
                            ),
                          );
                        }),
                  ),
                ),
                h(
                  "div",
                  { className: "pmtm-dialog-foot" },
                  h(
                    "span",
                    {
                      style: {
                        color: "var(--dsw-alias-label-secondary)",
                        fontSize: 12,
                      },
                    },
                    assignSelected.length === 0
                      ? "未选择任务"
                      : `已选择 ${String(assignSelected.length)} 个任务`,
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "pmtm-btn small",
                      disabled: assignSelected.length === 0 || assignBusy,
                      onClick: () => void confirmAssign(),
                    },
                    assignBusy ? "指派中…" : "确认指派",
                  ),
                ),
              ),
            )
          : null,
      );
    }

    function TeammateGlobalPage(props) {
      const route = props.useShellRoute?.((state) => state.route);
      if (route !== "teammates") return null;
      return h(AiTeammatesPage, props);
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global",
            id: "pluginmax-teammates",
            order: 36,
          },
          TeammateGlobalPage,
        ),
      );
    };

    return module.exports;
  },
});
