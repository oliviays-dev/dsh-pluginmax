window.__ModuleLoader__.load({
  id: "dsh-collab-meeting",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const jsxRuntime = require("react/jsx-runtime");

    /* ── constants ── */

    const TOKEN_KEY = "pluginmax.collab.token";
    const PANEL_WIDTH = 380;

    /* ── module-level store (open/close shared by toggle + panel) ── */

    const store = {
      open: false,
      listeners: new Set(),
      // 跨视图数据联动：右侧栏与会议页各自持有一份会议数据，
      // 任一侧改完数据后通知另一侧重新拉取，避免两处显示不一致。
      changeListeners: new Set(),
      openPanel() { this.open = true; this.emit(); },
      toggle() { this.open = !this.open; this.emit(); },
      close() { this.open = false; this.emit(); },
      subscribe(fn) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; },
      bumpChange(source) {
        for (const fn of this.changeListeners) fn(source);
      },
      subscribeChange(fn) {
        this.changeListeners.add(fn);
        return () => { this.changeListeners.delete(fn); };
      },
      emit() {
        window.__pluginmaxShell?.setMeetingOpen(this.open);
        for (const fn of this.listeners) fn(this.open);
      },
    };

    window.__pluginmaxMeeting = store;

    /*
     * 「仅看已加入 / 平台全量」是跨模块偏好：任务、会议、工作流、Teammate
     * 与工作台共用同一个 window store，点击跨模块跳转时沿用用户当前选择。
     * 这里幂等创建，谁先加载谁初始化。
     */
    function ensureScopeStore() {
      if (window.__pluginmaxScope) return window.__pluginmaxScope;
      let all = false;
      const listeners = new Set();
      window.__pluginmaxScope = {
        getSnapshot: () => all,
        setAll: (next) => {
          const value = next === true;
          if (value === all) return;
          all = value;
          for (const listener of listeners) listener();
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
      return window.__pluginmaxScope;
    }
    const scopeStore = ensureScopeStore();

    function usePanelOpen() {
      const [open, setOpen] = react.useState(store.open);
      react.useEffect(() => store.subscribe(setOpen), []);
      return open;
    }

    /* ── element helper ── */

    const h = (type, props, ...children) =>
      jsxRuntime.jsxs(
        type,
        Object.assign({}, props, {
          // 兼容两种写法：子节点既可通过展开参数传入，也可写成 props.children。
          // 否则 `h("h1", { children: "会议" })` 会被覆盖成 undefined，文本丢失。
          children:
            children.length === 0
              ? (props ? props.children : undefined)
              : children.length === 1
                ? children[0]
                : children,
        }),
      );

    /**
     * 展示层清理：模型偶尔会把思考过程或工具调用标记写进正文
     * （例如 `<|DSML| calls>` / `<|DSML| invoke name="Bash">`）。
     * 这里隐去这类块，并在正文含 Markdown 标题时只保留标题之后的正文，
     * 避免群聊里出现工具调用乱码。
     */
    function displayContent(raw) {
      if (typeof raw !== "string") return raw;
      let text = raw;
      // 注意：模型输出的是全角竖线「｜」，这里同时兼容半角「|」。
      const start = text.search(/<[|｜]+\s*[|｜]?\s*DSML/i);
      if (start >= 0) text = text.slice(0, start);
      text = text.replace(/<[|｜]+\s*[|｜]?[^>\n]*>/g, "");
      const match = /^#{1,6}\s/m.exec(text);
      if (match !== null && match.index > 0) text = text.slice(match.index);
      const cleaned = text.trim();
      // 纪要消息（「会议纪要 vN …」）如果清理后没有结构化标题，
      // 说明该版本只有思考过程/工具调用，直接给占位说明，避免误导。
      if (/^会议纪要 v\d/.test(raw) && !/^#{1,6}\s/m.test(cleaned)) {
        return "（该版本未生成结构化纪要）";
      }
      return cleaned === "" ? "（本次未生成可用内容）" : cleaned;
    }

    /**
     * 会议聊天里的轻量 Markdown 渲染：支持 # 标题、有序/无序列表、
     * **加粗**、`行内代码` 与 ``` 代码块。会议消息（尤其纪要）本身是 MD，
     * 直接当纯文本显示会把 `##` 这类标记露出来。
     */
    function renderChatMarkdown(raw) {
      const text = typeof raw === "string" ? raw : "";
      if (text.trim() === "") return null;
      const blocks = [];
      let listItems = [];
      let ordered = false;
      let inCode = false;
      let codeLines = [];
      let seq = 0;
      const inline = (source, keyBase) => {
        const parts = [];
        const pattern = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
        let last = 0;
        let match;
        let i = 0;
        while ((match = pattern.exec(source)) !== null) {
          if (match.index > last) parts.push(source.slice(last, match.index));
          if (match[2] !== undefined) {
            parts.push(h("strong", { key: `${keyBase}-b${i}` }, match[2]));
          } else if (match[3] !== undefined) {
            parts.push(
              h(
                "code",
                {
                  key: `${keyBase}-c${i}`,
                  style: {
                    background: "var(--dsw-alias-bg-layer-2)",
                    borderRadius: 4,
                    fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
                    fontSize: "0.92em",
                    padding: "1px 4px",
                  },
                },
                match[3],
              ),
            );
          }
          last = pattern.lastIndex;
          i += 1;
        }
        if (last < source.length) parts.push(source.slice(last));
        return parts;
      };
      const flushList = () => {
        if (listItems.length === 0) return;
        const Tag = ordered ? "ol" : "ul";
        const key = `list-${seq}`;
        blocks.push(
          h(
            Tag,
            { key, style: { margin: "2px 0", paddingLeft: 18 } },
            ...listItems.map((item, i) =>
              h("li", { key: `li-${seq}-${i}` }, ...inline(item, i)),
            ),
          ),
        );
        listItems = [];
        seq += 1;
      };
      for (const line of text.split("\n")) {
        if (line.trim().startsWith("```")) {
          if (inCode) {
            blocks.push(
              h(
                "pre",
                {
                  key: `code-${seq}`,
                  style: {
                    background: "var(--dsw-alias-bg-base)",
                    borderRadius: 6,
                    fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
                    fontSize: 12,
                    overflowX: "auto",
                    padding: "8px 10px",
                  },
                },
                codeLines.join("\n"),
              ),
            );
            seq += 1;
            codeLines = [];
            inCode = false;
          } else {
            flushList();
            inCode = true;
          }
          continue;
        }
        if (inCode) {
          codeLines.push(line);
          continue;
        }
        const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
          flushList();
          const level = Math.min(headingMatch[1].length, 6);
          blocks.push(
            h(
              `h${level}`,
              {
                key: `h-${seq}`,
                style: {
                  fontSize: level <= 2 ? 14 : 13,
                  fontWeight: 650,
                  margin: "6px 0 2px",
                },
              },
              ...inline(headingMatch[2], seq),
            ),
          );
          seq += 1;
          continue;
        }
        const unorderedMatch = line.match(/^\s*[-·*]\s+(.*)/);
        const orderedMatch = line.match(/^\s*\d+[.．]\s+(.*)/);
        if (unorderedMatch) {
          if (ordered) flushList();
          ordered = false;
          listItems.push(unorderedMatch[1]);
          continue;
        }
        if (orderedMatch) {
          if (!ordered) flushList();
          ordered = true;
          listItems.push(orderedMatch[1]);
          continue;
        }
        if (line.trim() === "") {
          flushList();
          continue;
        }
        flushList();
        blocks.push(
          h(
            "p",
            { key: `p-${seq}`, style: { margin: "2px 0" } },
            ...inline(line, seq),
          ),
        );
        seq += 1;
      }
      flushList();
      if (inCode && codeLines.length > 0) {
        blocks.push(
          h(
            "pre",
            {
              key: `code-${seq}`,
              style: {
                background: "var(--dsw-alias-bg-base)",
                borderRadius: 6,
                fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
                fontSize: 12,
                overflowX: "auto",
                padding: "8px 10px",
              },
            },
            codeLines.join("\n"),
          ),
        );
      }
      return h("div", null, ...blocks);
    }

    /* ── meeting panel (shell.overlay slot): list + group chat only ── */

    const svgIcon = (paths, size = 15) =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.7,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        ...paths.map((d, index) => h("path", { key: index, d })),
      );

    const backArrowIcon = () =>
      svgIcon(["M19 12H5", "m12 19-7-7 7-7"]);

    /** 会议切换操作位：只用放大镜图标，不加矩形边线。 */
    const searchIcon = (size = 14) =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.7,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        h("circle", { cx: 11, cy: 11, r: 7.5 }),
        h("path", { d: "m21 21-4.3-4.3" }),
      );

    const gearIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 15,
          height: 15,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.7,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        h("circle", { cx: 12, cy: 12, r: 3 }),
        h("path", {
          d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.33.4.6.73.75H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
        }),
      );

    const clipIcon = () =>
      svgIcon(
        [
          "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
        ],
        11,
      );

    const atIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 11,
          height: 11,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.7,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        h("circle", { cx: 12, cy: 12, r: 4 }),
        h("path", { d: "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" }),
      );

    const videoIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 15,
          height: 15,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.7,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        h("path", {
          d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",
        }),
        h("rect", { x: 2, y: 6, width: 14, height: 12, rx: 2 }),
      );

    /** 姓名缩写：与任务管理页同一套规则（按空格分词，取前两段首字母）。 */
    const initials = (value) =>
      String(value ?? "?")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    /* ── 头像：与 AI Teammates / 任务管理页同一套 ── */

    const AVATAR_PRESETS = [
      { id: "sky", bg: "#d9efff", shirt: "#568fd8", skin: "#f1c5a3", hair: "#244d77", accent: "#ffd166", hairStyle: "wave", glasses: false },
      { id: "sunset", bg: "#ffe5d8", shirt: "#db6d65", skin: "#d99a76", hair: "#743d2d", accent: "#ff8d7a", hairStyle: "bun", glasses: false },
      { id: "forest", bg: "#def6e8", shirt: "#3f9d73", skin: "#e3b08d", hair: "#245543", accent: "#67d4a1", hairStyle: "side", glasses: false },
      { id: "berry", bg: "#f1e2ff", shirt: "#7d59c6", skin: "#efb38f", hair: "#533275", accent: "#c06cff", hairStyle: "bob", glasses: false },
      { id: "lemon", bg: "#fff3c9", shirt: "#d7a62e", skin: "#d49974", hair: "#414554", accent: "#f2cb45", hairStyle: "wave", glasses: true },
      { id: "ocean", bg: "#d9f4ff", shirt: "#2f84a8", skin: "#ce9874", hair: "#164f6f", accent: "#4fc3e8", hairStyle: "bun", glasses: true },
    ];

    const avatarHair = (preset) => {
      const fill = preset.hair;
      if (preset.hairStyle === "bun")
        return [
          h("circle", { key: "bun", cx: 47, cy: 14, r: 6, fill }),
          h("path", {
            key: "bun-body",
            d: "M16 29c0-12 7-19 16-19 9 0 16 7 16 19-5-3-8-8-9-12-5 7-14 11-23 12Z",
            fill,
          }),
        ];
      if (preset.hairStyle === "side")
        return [
          h("path", {
            key: "side",
            d: "M17 27c1-11 8-17 17-17 8 0 14 5 15 15-7-1-11-5-14-10-4 6-11 10-18 12Z",
            fill,
          }),
        ];
      if (preset.hairStyle === "bob")
        return [
          h("path", {
            key: "bob",
            d: "M16 28c0-12 7-18 16-18s16 7 16 18v13h-6V30c-7 1-13-1-19-6-1 5-3 8-7 10Z",
            fill,
          }),
        ];
      return [
        h("path", {
          key: "wave",
          d: "M16 29c0-12 7-19 17-19 10 0 16 7 16 19-4-2-7-6-9-10-5 6-14 9-24 10Z",
          fill,
        }),
      ];
    };

    const AVATAR_ART_STYLE = {
      background: "#20242a",
      border: "2px solid var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base))",
      borderRadius: "50%",
      display: "block",
      height: "100%",
      objectFit: "cover",
      overflow: "hidden",
      width: "100%",
    };

    const avatarArt = (value) => {
      if (typeof value === "string" && value.startsWith("data:image/"))
        return h("img", { style: AVATAR_ART_STYLE, src: value, alt: "" });
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
            h("circle", { cx: 25.5, cy: 31, r: 5.4 }),
            h("circle", { cx: 38.5, cy: 31, r: 5.4 }),
            h("path", { d: "M31 31h2" }),
          ),
        );
      }
      return h(
        "svg",
        { viewBox: "0 0 64 64", style: AVATAR_ART_STYLE, "aria-hidden": true },
        ...children,
      );
    };

    /** 人类头像：与任务管理页同款 26px 圆角方块 + 姓名缩写（自己显示「我」）。 */
    const initialsAvatarStyle = {
      alignItems: "center",
      background: "#2f9e66",
      borderRadius: 7,
      color: "#fff",
      display: "grid",
      flexShrink: 0,
      fontSize: 10,
      fontWeight: 700,
      height: 26,
      placeItems: "center",
      width: 26,
    };

    /** AI teammate 头像：渐变光环 + 生成式头像（平台实例用蓝色光环）。 */
    const teammateRingStyle = (platform) => ({
      alignItems: "center",
      background: platform
        ? "#63b8ff"
        : "conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff)",
      borderRadius: "50%",
      boxShadow: platform
        ? "0 0 0 1px rgba(99,184,255,.55)"
        : "0 0 0 1px rgba(139,108,255,.26)",
      display: "grid",
      flexShrink: 0,
      height: 26,
      padding: 2,
      placeItems: "center",
      width: 26,
    });

    /**
     * 会话头像：系统=灰底、人类=缩写圆角方块、AI=光环 + 生成式头像。
     * 中间沟通区与右侧栏共用，样式与 AI Teammates / 任务管理页一致。
     */
    const chatAvatar = (message, mine, teammates) => {
      if (message.senderKind === "system")
        return h(
          "span",
          {
            style: Object.assign({}, initialsAvatarStyle, {
              background: "var(--dsw-alias-bg-layer-3)",
              color: "var(--dsw-alias-label-secondary)",
            }),
          },
          "系",
        );
      if (message.senderKind === "human")
        return h(
          "span",
          { style: initialsAvatarStyle },
          mine ? "我" : initials(message.senderName),
        );
      const list = teammates ?? [];
      const teammate =
        list.find((item) => item.id === message.senderId) ??
        list.find((item) => item.name === message.senderName);
      return h(
        "span",
        {
          style: teammateRingStyle(teammate?.source === "platform"),
          title: message.senderName,
        },
        avatarArt(teammate?.avatar),
      );
    };

    const panelStyles = {
      root: {
        alignItems: "stretch",
        display: "flex",
        inset: 0,
        justifyContent: "flex-end",
        overflow: "hidden",
        pointerEvents: "none",
        position: "absolute",
        zIndex: 20,
      },
      panel: {
        background: "var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base))",
        borderLeft: "0.5px solid var(--dsw-alias-border-l2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "auto",
        width: `min(${PANEL_WIDTH}px, 100%)`,
      },
      head: {
        alignItems: "center",
        borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
        display: "flex",
        flexShrink: 0,
        gap: 8,
        padding: "12px 14px 10px",
      },
      title: {
        flex: 1,
        fontSize: 14,
        fontWeight: 600,
        margin: 0,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      select: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        fontSize: 12,
        padding: "5px 7px",
      },
      btn: {
        background: "transparent",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        fontSize: 12,
        padding: "5px 9px",
      },
      list: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflowY: "auto",
        padding: 8,
      },
      item: {
        background: "transparent",
        border: "none",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        display: "block",
        padding: "8px 10px",
        textAlign: "left",
        width: "100%",
      },
      itemActive: { background: "var(--dsw-alias-bg-layer-2)" },
      meta: { color: "var(--dsw-alias-label-secondary)", fontSize: 11 },
      chat: {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
      },
      stream: {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        gap: 8,
        overflowY: "auto",
        padding: 10,
      },
      bubble: {
        background: "var(--dsw-alias-bg-layer-1)",
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.6,
        maxWidth: "86%",
        padding: "6px 9px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      },
      form: {
        borderTop: "0.5px solid var(--dsw-alias-border-l2)",
        display: "flex",
        gap: 6,
        padding: 8,
      },
      textarea: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        flex: 1,
        fontFamily: "inherit",
        fontSize: 12,
        // 默认多留一行高度，避免刚打开就只能看到一行。
        minHeight: 52,
        padding: "6px 8px",
        resize: "vertical",
      },
      error: {
        background: "rgba(220,60,60,0.14)",
        borderRadius: 6,
        color: "#e06a6a",
        fontSize: 11,
        margin: "0 10px 8px",
        padding: "6px 8px",
      },
      notice: {
        background: "rgba(52,212,126,0.12)",
        borderRadius: 6,
        color: "#34d47e",
        fontSize: 11,
        margin: "0 10px 8px",
        padding: "6px 8px",
      },
      picker: {
        alignItems: "center",
        display: "flex",
        flexShrink: 0,
        gap: 6,
        padding: "8px 10px 0",
      },
      search: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        flex: 1,
        fontFamily: "inherit",
        fontSize: 12,
        minWidth: 0,
        padding: "6px 8px",
      },
      dialogOverlay: {
        alignItems: "center",
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        position: "absolute",
        zIndex: 30,
      },
      dialog: {
        background: "var(--dsw-alias-bg-layer-1)",
        borderRadius: 8,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: "80%",
        padding: 14,
        width: 340,
      },
      dialogTitle: { fontSize: 14, fontWeight: 600 },
      dialogBody: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflowY: "auto",
      },
      dialogActions: {
        display: "flex",
        gap: 6,
        justifyContent: "flex-end",
        marginTop: 4,
      },
      checkRow: {
        alignItems: "center",
        display: "flex",
        fontSize: 12,
        gap: 8,
        padding: "6px 0",
      },
      block: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
      },
      divider: {
        borderTop: "0.5px solid var(--dsw-alias-border-l2)",
        margin: "2px 0",
      },
      // 头像样式对齐任务管理页：26px 圆角方块 + 姓名缩写。
      chip: {
        background: "var(--dsw-alias-bg-layer-3)",
        borderRadius: 4,
        color: "var(--dsw-alias-label-secondary)",
        flexShrink: 0,
        fontSize: 10,
        padding: "1px 5px",
      },
      name: {
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      btnPrimary: {
        background: "var(--dsw-alias-accent-fill, #2f6feb)",
        border: "none",
        borderRadius: 6,
        color: "#fff",
        cursor: "pointer",
        fontSize: 12,
        padding: "6px 12px",
      },
      titleWrap: {
        alignItems: "center",
        display: "flex",
        flex: 1,
        gap: 6,
        minWidth: 0,
      },
      // 会议切换操作位：无边框，只用图标表达（放大镜）。
      iconGhost: {
        alignItems: "center",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        color: "var(--dsw-alias-label-secondary)",
        cursor: "pointer",
        display: "grid",
        flexShrink: 0,
        height: 22,
        placeItems: "center",
        width: 22,
      },
      titleText: {
        flex: "0 1 auto",
        fontSize: 14,
        fontWeight: 600,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      aiBadge: {
        background: "linear-gradient(135deg,#6f53d6,#2f6feb)",
        borderRadius: 4,
        color: "#fff",
        flexShrink: 0,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.4,
        padding: "1px 4px",
      },
      // 输入框上方的附件 / @ 操作位：浅背景、无边框、图标更小。
      composerBtn: {
        alignItems: "center",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "none",
        borderRadius: 6,
        color: "var(--dsw-alias-label-secondary)",
        cursor: "pointer",
        display: "grid",
        flexShrink: 0,
        height: 22,
        placeItems: "center",
        width: 22,
      },
      iconBtn: {
        alignItems: "center",
        background: "transparent",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        display: "grid",
        flexShrink: 0,
        height: 26,
        placeItems: "center",
        width: 26,
      },
      dropdown: {
        borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        gap: 6,
        padding: "8px 10px",
      },
      dropdownList: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 220,
        overflowY: "auto",
      },
      dropdownItem: {
        alignItems: "center",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        display: "flex",
        fontSize: 12,
        gap: 8,
        justifyContent: "space-between",
        padding: "6px 8px",
        textAlign: "left",
      },
      dropdownItemActive: {
        background: "var(--dsw-alias-bg-layer-2)",
      },
      settings: {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        gap: 14,
        minHeight: 0,
        overflowY: "auto",
        padding: 12,
      },
      composer: {
        alignItems: "center",
        display: "flex",
        flexShrink: 0,
        gap: 6,
        padding: "6px 8px 0",
      },
      groupTitle: {
        color: "var(--dsw-alias-label-secondary)",
        fontSize: 11,
        fontWeight: 600,
      },
    };

    const MeetingPanel = () => {
      const open = usePanelOpen();
      const [accountName, setAccountName] = react.useState("");
      const [meetings, setMeetings] = react.useState([]);
      const [query, setQuery] = react.useState("");
      const [meetingId, setMeetingId] = react.useState("");
      const [detail, setDetail] = react.useState(null);
      const [minutes, setMinutes] = react.useState(null);
      const [teammates, setTeammates] = react.useState([]);
      const [content, setContent] = react.useState("");
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [busy, setBusy] = react.useState("");
      const [refreshKey, setRefreshKey] = react.useState(0);
      const [view, setView] = react.useState("chat");
      // 状态反馈条 3 秒后自动消失。
      react.useEffect(() => {
        if (notice === "" && error === "") return undefined;
        const timer = window.setTimeout(() => {
          setNotice("");
          setError("");
        }, 3_000);
        return () => window.clearTimeout(timer);
      }, [notice, error]);
      const [pickerOpen, setPickerOpen] = react.useState(false);
      const [people, setPeople] = react.useState([]);
      const [inviteOpen, setInviteOpen] = react.useState(false);
      const [inviteQuery, setInviteQuery] = react.useState("");
      const [inviteSelected, setInviteSelected] = react.useState([]);
      const [titleDraft, setTitleDraft] = react.useState("");
      const [mentionOpen, setMentionOpen] = react.useState(false);
      const [mentionIds, setMentionIds] = react.useState([]);
      const messagesRef = react.useRef(null);
      // 会话区默认贴底；用户主动上翻看历史时不强行拉回底部。
      const pinnedRef = react.useRef(true);
      const fileRef = react.useRef(null);

      react.useEffect(
        () =>
          store.subscribeChange((source) => {
            if (source !== "panel") setRefreshKey((key) => key + 1);
          }),
        [],
      );

      const fail = (cause) =>
        setError(cause instanceof Error ? cause.message : String(cause));

      react.useEffect(() => {
        if (!open) return undefined;
        let disposed = false;
        (async () => {
          try {
            const [ws, me, team] = await Promise.all([
              request("/api/collab/team/workspaces"),
              request("/api/collab/auth/me").catch(() => ({})),
              request("/api/collab/teammates").catch(() => ({ teammates: [] })),
            ]);
            if (disposed) return;
            setAccountName(me.user?.name ?? "");
            setTeammates(team.teammates ?? []);
            // 抽屉顶部的会议选择器跨项目：把当前用户已加入项目的会议合并。
            const joined = (ws.workspaces ?? []).filter(
              (workspace) => workspace.isMember === true,
            );
            const lists = await Promise.all(
              joined.map((workspace) =>
                request(
                  `/api/collab/meetings?workspaceId=${encodeURIComponent(workspace.id)}`,
                )
                  .then((result) => result.meetings ?? [])
                  .catch(() => []),
              ),
            );
            if (disposed) return;
            const merged = lists
              .flat()
              .sort((left, right) =>
                String(right.updatedAt).localeCompare(String(left.updatedAt)),
              );
            setMeetings(merged);
            setMeetingId((current) =>
              merged.some((item) => item.id === current)
                ? current
                : merged[0]?.id ?? "",
            );
          } catch (cause) {
            if (!disposed) fail(cause);
          }
        })();
        return () => {
          disposed = true;
        };
      }, [open, refreshKey]);

      react.useEffect(() => {
        if (!open || meetingId === "") {
          setDetail(null);
          setMinutes(null);
          return undefined;
        }
        let disposed = false;
        (async () => {
          try {
            const [result, minuteResult] = await Promise.all([
              request(
                `/api/collab/meeting?meetingId=${encodeURIComponent(meetingId)}`,
              ),
              request(
                `/api/collab/meeting/minutes?meetingId=${encodeURIComponent(meetingId)}`,
              ).catch(() => null),
            ]);
            if (disposed) return;
            setDetail(result);
            setMinutes(minuteResult);
          } catch (cause) {
            if (!disposed) fail(cause);
          }
        })();
        return () => {
          disposed = true;
        };
      }, [open, meetingId, refreshKey]);

      react.useEffect(() => {
        if ((view !== "settings" && !inviteOpen) || meetingId === "") return undefined;
        let disposed = false;
        request(
          `/api/collab/meeting/people?meetingId=${encodeURIComponent(meetingId)}`,
        )
          .then((result) => {
            if (!disposed) setPeople(result.people ?? []);
          })
          .catch(() => undefined);
        return () => {
          disposed = true;
        };
      }, [view, inviteOpen, meetingId]);

      // 切换会议时回到常规会话视图并收起下拉。
      react.useEffect(() => {
        setView("chat");
        setPickerOpen(false);
        setInviteOpen(false);
      }, [meetingId]);

      // 会议名称默认处于可编辑态：进入设置视图或标题变化时同步草稿。
      react.useEffect(() => {
        if (view !== "settings") return;
        setTitleDraft(detail?.meeting?.title ?? "");
      }, [view, detail?.meeting?.title]);

      react.useEffect(() => {
        if (!open || meetingId === "") return undefined;
        const versions = minutes?.versions ?? [];
        const generating = versions.some(
          (version) =>
            version.status === "generating" || version.status === "pending",
        );
        if (!generating) return undefined;
        const timer = window.setInterval(
          () => setRefreshKey((key) => key + 1),
          4_000,
        );
        return () => window.clearInterval(timer);
      }, [open, meetingId, minutes]);

      react.useEffect(() => {
        // 切会议时重置贴底状态。
        pinnedRef.current = true;
      }, [meetingId]);

      react.useEffect(() => {
        // 默认贴底；用户上翻看历史时（pinned=false）不强行拉回。
        if (pinnedRef.current && messagesRef.current)
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }, [detail]);

      if (!open) return null;

      const meeting = detail?.meeting;
      const transcript = detail?.transcript ?? [];
      const actorId = detail?.actorId ?? "";
      const joined = (detail?.participants ?? []).some(
        (participant) =>
          participant.kind === "human" &&
          participant.status === "active" &&
          participant.refId === actorId,
      );
      const participants = detail?.participants ?? [];
      // 未启用时接口返回 null，统一收敛成 undefined，避免后续判空遗漏。
      const facilitator = minutes?.facilitator ?? undefined;
      // 会议成员 = 启用的 AI Facilitator（如果有）+ 普通参会人。
      // 两者共用一张列表，保证「成员里有它 = facilitator 已启用」。
      // 平台 Facilitator 实例只以「席位」形态出现，历史遗留的
      // `participant/ai` 记录不再重复展示，避免同一 AI 出现两行。
      const memberRows = [
        ...(facilitator === undefined
          ? []
          : [
              {
                id: `facilitator:${facilitator.id}`,
                label: "会议 Facilitator",
                kind: "ai",
                teammateId: "meeting-facilitator",
                tag: "会议服务",
                facilitator: true,
                active: true,
              },
            ]),
        ...participants
          .filter(
            (participant) =>
              !(
                participant.kind === "ai_teammate" &&
                participant.refId === "meeting-facilitator"
              ),
          )
          .map((participant) => ({
            id: participant.id,
            label: participant.displayName,
            kind: participant.kind === "human" ? "human" : "ai",
            teammateId: participant.refId,
            facilitator: false,
            active: participant.status === "active",
            participantId: participant.id,
          })),
      ];
      const keyword = query.trim().toLowerCase();
      const matched = meetings.filter(
        (item) =>
          keyword === "" ||
          `${item.title} ${item.id}`.toLowerCase().includes(keyword),
      );
      const myTeammates = teammates.filter((item) => item.state !== "archived");
      // 邀请对象不分人类/AI：一起列在一个可搜索的清单里。
      const inviteKeyword = inviteQuery.trim().toLowerCase();
      const inviteCandidates = [
        ...people.map((person) => ({
          key: `human:${person.id}`,
          kind: "human",
          name: person.name,
          inMeeting: person.state === "active",
        })),
        ...myTeammates.map((item) => ({
          key: `ai:${item.id}`,
          kind: "ai",
          name: item.name,
          avatar: item.avatar,
          source: item.source,
          // 平台「会议 Facilitator」实例就是会议里的 Facilitator 席位：
          // facilitator 已启用 ⇔ 它已在会议中，两者是同一件事。
          inMeeting:
            facilitator !== undefined && item.id === "meeting-facilitator",
        })),
      ].filter(
        (candidate) =>
          inviteKeyword === "" ||
          candidate.name.toLowerCase().includes(inviteKeyword),
      );
      const post = (path, body) =>
        request(path, { method: "POST", body: JSON.stringify(body) });
      const run = async (action) => {
        setBusy("run");
        setError("");
        setNotice("");
        try {
          await action();
          setRefreshKey((key) => key + 1);
          store.bumpChange("panel");
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };
      const uploadFile = async (file) => {
        if (file === undefined) return;
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(String(reader.result ?? "").split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("读取文件失败"));
          reader.readAsDataURL(file);
        });
        await run(() =>
          post("/api/collab/meeting/file", {
            meetingId,
            name: file.name,
            mime: file.type || "application/octet-stream",
            data,
          }),
        );
      };
      const saveTitle = async () => {
        const next = titleDraft.trim();
        if (next === "") return;
        await run(async () => {
          await post("/api/collab/meeting/update", { meetingId, title: next });
          setNotice("会议名称已更新");
        });
      };
      const confirmInvite = async () => {
        const humans = inviteSelected
          .filter((key) => key.startsWith("human:"))
          .map((key) => key.slice("human:".length));
        const instances = inviteSelected
          .filter((key) => key.startsWith("ai:"))
          .map((key) => key.slice("ai:".length));
        await run(async () => {
          if (humans.length > 0) {
            await post("/api/collab/meeting/participants/invite", {
              meetingId,
              people: humans.map((id) => ({ targetId: id })),
            });
          }
          for (const instanceId of instances) {
            if (instanceId === "meeting-facilitator") {
              // 邀请平台 Facilitator 实例 = 启用会议 AI Facilitator（同一状态）。
              if (facilitator === undefined) {
                await post("/api/collab/meeting/facilitator/open", { meetingId });
              }
              continue;
            }
            const teammate = teammates.find((item) => item.id === instanceId);
            await post("/api/collab/meeting/participant/ai", {
              meetingId,
              teammateInstanceId: instanceId,
              displayName: teammate?.name ?? instanceId,
              speechMode: "mention",
            });
          }
          setInviteSelected([]);
          setInviteOpen(false);
          setNotice("已发送邀请");
        });
      };

      return h("div", { style: panelStyles.root }, h("div", { style: panelStyles.panel }, [
        // 第一行只有会议标题：标题自身是下拉框，右侧一个设置图标（= 会议设置）。
        // 会议设置视图下这一行不展示，设置页自己的第一行是「← 会议设置」。
        view === "chat"
          ? h("div", { style: panelStyles.head }, [
          h("div", { style: panelStyles.titleWrap },
            h("span", {
              style: panelStyles.titleText,
              title: meeting ? meeting.title : "选择会议",
              children: meeting ? meeting.title : "请选择会议",
            }),
            // 顺序：会议名称 → 下拉操作位（放大镜，无边框）→ AI 标识。
            h("button", {
              type: "button",
              style: panelStyles.iconGhost,
              "aria-label": "选择会议",
              title: "搜索 / 切换会议",
              onClick: () => {
                setPickerOpen((value) => !value);
                setRefreshKey((key) => key + 1);
              },
            },
              searchIcon(),
            ),
            meeting && facilitator
              ? h("span", { style: panelStyles.aiBadge, children: "AI" })
              : null,
          ),
          meeting
            ? h("button", {
                type: "button",
                style: panelStyles.iconBtn,
                title: "会议设置",
                "aria-label": "会议设置",
                onClick: () => {
                  setInviteOpen(false);
                  setNotice("");
                  setView("settings");
                },
              },
                gearIcon(),
              )
            : null,
            ])
          : null,
        error ? h("div", { style: panelStyles.error, children: error }) : null,
        notice ? h("div", { style: panelStyles.notice, children: notice }) : null,
        // 点击标题下拉：搜索 + 动态加载的会议列表（跨项目）。
        view === "chat" && pickerOpen
          ? h("div", { style: panelStyles.dropdown },
              h("input", {
                style: panelStyles.search,
                value: query,
                placeholder: "搜索会议名称",
                "aria-label": "搜索会议",
                onChange: (event) => setQuery(event.target.value),
              }),
              h("div", { style: panelStyles.dropdownList },
                ...(matched.length === 0
                  ? [h("div", { style: panelStyles.meta, children: "无匹配会议" })]
                  : matched.map((item) =>
                      h("button", {
                        type: "button",
                        key: item.id,
                        style: Object.assign(
                          {},
                          panelStyles.dropdownItem,
                          item.id === meetingId ? panelStyles.dropdownItemActive : {},
                        ),
                        onClick: () => {
                          setMeetingId(item.id);
                          setPickerOpen(false);
                        },
                      },
                        h("span", { children: item.title }),
                        h("span", {
                          style: panelStyles.meta,
                          children:
                            item.status === "archived"
                              ? "已归档"
                              : item.status === "closed"
                                ? "已结束"
                                : "进行中",
                        }),
                      ),
                    )),
              ),
            )
          : null,
        view === "settings" && meeting
          ? h("div", { style: panelStyles.settings }, [
              h("div", { style: { alignItems: "center", display: "flex", gap: 6 } },
                h("button", {
                  type: "button",
                  style: panelStyles.iconBtn,
                  title: "返回会议",
                  "aria-label": "返回会议",
                  onClick: () => setView("chat"),
                },
                  backArrowIcon(),
                ),
                h("span", { style: { fontSize: 13, fontWeight: 600 }, children: "会议设置" }),
              ),
              // 会议名称默认就是可编辑态，不需要先点一下才能改。
              h("div", { style: panelStyles.block }, [
                h("div", { style: panelStyles.groupTitle, children: "会议名称" }),
                h("div", { style: { alignItems: "center", display: "flex", gap: 8 } },
                  h("input", {
                    style: Object.assign({}, panelStyles.search, { flex: 1 }),
                    value: titleDraft,
                    placeholder: "会议名称",
                    "aria-label": "会议名称",
                    onChange: (event) => setTitleDraft(event.target.value),
                    onKeyDown: (event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveTitle();
                      }
                    },
                  }),
                  h("button", {
                    type: "button",
                    style: Object.assign(
                      {},
                      panelStyles.btnPrimary,
                      busy !== "" ||
                        titleDraft.trim() === "" ||
                        titleDraft.trim() === meeting.title
                        ? { cursor: "default", opacity: 0.5 }
                        : {},
                    ),
                    disabled:
                      busy !== "" ||
                      titleDraft.trim() === "" ||
                      titleDraft.trim() === meeting.title,
                    onClick: () => void saveTitle(),
                    children: "保存",
                  }),
                ),
              ]),
              h("div", { style: panelStyles.divider }),
              h("div", { style: panelStyles.block }, [
                h("div", { style: panelStyles.groupTitle, children: "AI 会议 Facilitator" }),
                h("div", { style: { alignItems: "center", display: "flex", gap: 8 } },
                  h("span", {
                    style: panelStyles.meta,
                    children: facilitator ? "已启用" : "未启用",
                  }),
                  meeting.status !== "archived"
                    ? h("button", {
                        type: "button",
                        style: panelStyles.btn,
                        disabled: busy !== "",
                        onClick: () =>
                          void run(() =>
                            facilitator
                              ? post("/api/collab/meeting/facilitator/close", { meetingId })
                              : post("/api/collab/meeting/facilitator/open", { meetingId }),
                          ),
                        children: facilitator ? "停用" : "启用",
                      })
                    : null,
                ),
              ]),
              h("div", { style: panelStyles.divider }),
              h("div", { style: panelStyles.block }, [
                h("div", { style: { alignItems: "center", display: "flex", gap: 8 } },
                  h("span", { style: panelStyles.groupTitle, children: "会议成员" }),
                  h("span", { style: { flex: 1 } }),
                  h("button", {
                    type: "button",
                    style: panelStyles.btn,
                    disabled: busy !== "",
                    onClick: () => {
                      setInviteQuery("");
                      setInviteSelected([]);
                      setInviteOpen(true);
                    },
                    children: "邀请成员",
                  }),
                ),
                ...memberRows.map((row) => {
                  const teammate =
                    row.kind === "ai"
                      ? teammates.find((item) => item.id === row.teammateId)
                      : undefined;
                  return h("div", { key: row.id, style: panelStyles.checkRow },
                    row.kind === "ai"
                      ? h(
                          "span",
                          { style: teammateRingStyle(teammate?.source === "platform") },
                          avatarArt(teammate?.avatar),
                        )
                      : h("span", { style: initialsAvatarStyle }, initials(row.label)),
                    h("span", { style: panelStyles.name, children: row.label }),
                    row.tag
                      ? h("span", { style: panelStyles.chip, children: row.tag })
                      : null,
                    row.active
                      ? h("button", {
                          type: "button",
                          style: panelStyles.btn,
                          disabled: busy !== "",
                          onClick: () =>
                            void run(() =>
                              row.facilitator
                                ? // 从成员里移除 Facilitator = 停用该 AI 实例
                                  post("/api/collab/meeting/facilitator/close", {
                                    meetingId,
                                  })
                                : post("/api/collab/meeting/participant/remove", {
                                    meetingId,
                                    participantId: row.participantId,
                                  }),
                            ),
                          children: "移除",
                        })
                      : h("span", {
                          style: panelStyles.meta,
                          children: "已离会",
                        }),
                  );
                }),
              ]),
            ])
          : !meeting
          ? h("div", { style: panelStyles.meta, children: "请选择会议" })
          : h("div", { style: panelStyles.chat }, [
              h("div", {
                ref: messagesRef,
                style: panelStyles.stream,
                onScroll: () => {
                  const node = messagesRef.current;
                  if (node === null) return;
                  pinnedRef.current =
                    node.scrollHeight - node.scrollTop - node.clientHeight < 80;
                },
              },
                ...transcript.map((message) => {
                  const mine =
                    message.senderKind === "human" && message.senderId === actorId;
                  const label =
                    message.provenance?.role === "representative"
                      ? `${message.senderName} · AI 参会代表`
                      : message.senderKind === "agent"
                        ? `${message.senderName} · AI`
                        : mine
                          ? "我"
                          : message.senderName;
                  return h("div", {
                    key: message.id,
                    style: {
                      alignItems: "flex-start",
                      display: "flex",
                      flexDirection: mine ? "row-reverse" : "row",
                      gap: 8,
                    },
                  },
                    chatAvatar(message, mine, teammates),
                    h("div", {
                      style: {
                        alignItems: mine ? "flex-end" : "flex-start",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        maxWidth: "82%",
                        minWidth: 0,
                      },
                    },
                      h("div", {
                        style: panelStyles.meta,
                        children: `${label} · ${timeShort(message.createdAt)}`,
                      }),
                      h("div", { style: panelStyles.bubble },
                        h("div", null, renderChatMarkdown(displayContent(message.content))),
                      ),
                    ),
                  );
                }),
                transcript.length === 0 ? h("div", { style: panelStyles.meta, children: "暂无消息" }) : null,
              ),
              meeting.status === "active"
                ? joined
                  ? h("form", {
                      style: {
                        borderTop: "0.5px solid var(--dsw-alias-border-l2)",
                        flexShrink: 0,
                        padding: 8,
                      },
                      onSubmit: async (event) => {
                        event.preventDefault();
                        const text = content.trim();
                        if (text === "") return;
                        setContent("");
                        setMentionOpen(false);
                        await run(() =>
                          post("/api/collab/meeting/message", {
                            meetingId,
                            content: text,
                            mentions: mentionIds,
                          }),
                        );
                        setMentionIds([]);
                      },
                    },
                      h("div", { style: panelStyles.composer },
                        h("button", {
                          type: "button",
                          style: panelStyles.composerBtn,
                          title: "上传文件",
                          "aria-label": "上传文件",
                          onClick: () => fileRef.current?.click(),
                        },
                          clipIcon(),
                        ),
                        h("button", {
                          type: "button",
                          style: panelStyles.composerBtn,
                          title: "提及成员",
                          "aria-label": "提及成员",
                          onClick: () => setMentionOpen((value) => !value),
                        },
                          atIcon(),
                        ),
                        h("input", {
                          ref: fileRef,
                          type: "file",
                          style: { display: "none" },
                          onChange: (event) => {
                            const file = event.target.files?.[0];
                            if (file !== undefined) void uploadFile(file);
                            event.target.value = "";
                          },
                        }),
                        mentionOpen
                          ? h("div", { style: panelStyles.mentionMenu },
                              ...participants
                                .filter((participant) => participant.status === "active")
                                .map((participant) =>
                                  h("button", {
                                    type: "button",
                                    key: participant.id,
                                    style: panelStyles.mentionItem,
                                    onClick: () => {
                                      setContent((current) =>
                                        `${current}@${participant.displayName} `,
                                      );
                                      setMentionIds((current) => [
                                        ...new Set([...current, participant.id]),
                                      ]);
                                      setMentionOpen(false);
                                    },
                                  },
                                    `${participant.displayName}${
                                      participant.kind === "human" ? "" : "（AI）"
                                    }`,
                                  ),
                                ),
                            )
                          : null,
                      ),
                      h("div", { style: { display: "flex", gap: 6, marginTop: 6 } },
                        h("textarea", {
                          style: panelStyles.textarea,
                          value: content,
                          placeholder: "输入消息…",
                          onChange: (event) => setContent(event.target.value),
                        }),
                        h("button", { type: "submit", style: panelStyles.btn, disabled: busy !== "", children: "发送" }),
                      ),
                    )
                  : h("div", { style: { padding: 10 } },
                      h("button", {
                        type: "button",
                        style: panelStyles.btn,
                        disabled: busy !== "",
                        onClick: () =>
                          run(() =>
                            post("/api/collab/meeting/join", {
                              meetingId,
                              displayName: accountName || `用户-${actorId.slice(0, 6)}`,
                            }),
                          ),
                        children: "加入会议",
                      }),
                    )
                : null,
            ]),
        inviteOpen && meeting
          ? h("div", { style: panelStyles.dialogOverlay }, h("div", { style: panelStyles.dialog }, [
              h("div", { style: panelStyles.dialogTitle, children: "邀请成员" }),
              h("input", {
                style: Object.assign({}, panelStyles.search, { flex: "none" }),
                value: inviteQuery,
                placeholder: "搜索成员或 AI Teammate",
                "aria-label": "搜索邀请对象",
                onChange: (event) => setInviteQuery(event.target.value),
              }),
              h("div", {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  maxHeight: 260,
                  overflowY: "auto",
                },
              },
                ...(inviteCandidates.length === 0
                  ? [h("div", { style: panelStyles.meta, children: "无匹配成员" })]
                  : inviteCandidates.map((candidate) =>
                      h("label", {
                        key: candidate.key,
                        style: Object.assign(
                          {},
                          panelStyles.checkRow,
                          candidate.inMeeting ? { opacity: 0.7 } : {},
                        ),
                      },
                        h("input", {
                          type: "checkbox",
                          // 已在会议中的成员直接勾选 + 禁用，不再写「（已在会议中）」。
                          checked:
                            candidate.inMeeting ||
                            inviteSelected.includes(candidate.key),
                          disabled: candidate.inMeeting,
                          onChange: (event) =>
                            setInviteSelected((current) =>
                              event.target.checked
                                ? [...current, candidate.key]
                                : current.filter((key) => key !== candidate.key),
                            ),
                        }),
                        // 头像样式参考任务管理页；AI 成员直接用 AI 图标表达身份。
                        candidate.kind === "ai"
                          ? h(
                              "span",
                              {
                                style: teammateRingStyle(
                                  candidate.source === "platform",
                                ),
                              },
                              avatarArt(candidate.avatar),
                            )
                          : h(
                              "span",
                              { style: initialsAvatarStyle },
                              initials(candidate.name),
                            ),
                        h("span", {
                          style: panelStyles.name,
                          children: candidate.name,
                        }),
                      ),
                    )),
              ),
              h("div", { style: panelStyles.dialogActions },
                h("button", { type: "button", style: panelStyles.btn, onClick: () => setInviteOpen(false), children: "取消" }),
                h("button", {
                  type: "button",
                  style: Object.assign(
                    {},
                    panelStyles.btnPrimary,
                    busy !== "" || inviteSelected.length === 0
                      ? { cursor: "default", opacity: 0.5 }
                      : {},
                  ),
                  disabled: busy !== "" || inviteSelected.length === 0,
                  onClick: () => void confirmInvite(),
                  children: busy !== "" ? "处理中…" : "确认",
                }),
              ),
            ]))
          : null,
      ]));
    };

    /* ── helpers ── */

    function getToken() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const token = getToken();
      const headers = { ...options.headers };
      if (options.body !== undefined) headers["content-type"] = "application/json";
      if (token !== null) headers.authorization = `Bearer ${token}`;
      const response = await fetch(path, { ...options, headers, cache: "no-store" });
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      if (!response.ok) {
        const error = new Error(body?.error?.message ?? `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return body;
    }

    function workspaceLabel(workspace) {
      const title = workspace.title?.trim();
      if (title) return title;
      // 项目名缺失时才回退路径；右侧只展示项目名称，不展示完整路径。
      const path = workspace.path?.trim();
      if (path) return path;
      return `未知项目 (${workspace.id.slice(0, 8)})`;
    }

    /**
     * 会议关注按钮由 dsh-collab-workbench 提供：服务端持久化、跨页面同步。
     * 该插件未安装时按钮不渲染，会议面板保持原样。
     */
    function MeetingFollowButton(props) {
      const [ready, setReady] = react.useState(
        () => typeof window.__pluginmaxFollow?.FollowButton === "function",
      );
      react.useEffect(() => {
        if (ready) return undefined;
        const onReady = () => setReady(true);
        window.addEventListener("pluginmax:follow-ready", onReady);
        return () =>
          window.removeEventListener("pluginmax:follow-ready", onReady);
      }, [ready]);
      const Button = window.__pluginmaxFollow?.FollowButton;
      if (!ready || typeof Button !== "function") return null;
      return jsxRuntime.jsx(Button, {
        type: "meeting",
        id: props.meetingId,
        iconOnly: true,
        compact: true,
      });
    }

    function timeShort(iso) {
      const time = new Date(iso);
      if (Number.isNaN(time.getTime())) return iso ?? "";
      const now = new Date();
      const sameDay =
        time.getFullYear() === now.getFullYear() &&
        time.getMonth() === now.getMonth() &&
        time.getDate() === now.getDate();
      if (sameDay) {
        return time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
      }
      return time.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    /* ── meetings page (pluginmax.global slot) ── */

    const PS = {
      root: {
        background: "var(--dsw-alias-bg-base)",
        color: "var(--dsw-alias-label-primary)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        // 壳层页面高度是 auto（只设了 min-height），`height:100%` 解析不到，
        // 于是整页随消息一起被撑高、输入框被推走。用视口上限把高度兜住，
        // 中间沟通列改为内部滚动，输入框自然吸底。
        maxHeight: "calc(100vh - 46px)",
        minHeight: 0,
        padding: 16,
      },
      top: { alignItems: "center", display: "flex", flexShrink: 0, gap: 10 },
      title: { fontSize: 16, fontWeight: 600, margin: 0 },
      select: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        fontSize: 13,
        padding: "6px 8px",
      },
      primaryBtn: {
        // 与任务管理「新建任务」保持同一套主按钮样式。
        alignItems: "center",
        background:
          "var(--dsw-alias-button-primary-fill, var(--dsw-alias-accent-fill, #2f6feb))",
        border: "none",
        borderRadius: 6,
        color: "var(--dsw-alias-label-primary-foreground, #fff)",
        cursor: "pointer",
        display: "inline-flex",
        fontSize: 12.5,
        fontWeight: 600,
        gap: 6,
        height: 34,
        justifyContent: "center",
        padding: "0 12px",
        whiteSpace: "nowrap",
      },
      sidebarBtn: {
        alignItems: "center",
        background: "transparent",
        border: "0.5px solid var(--dsw-alias-border-l3)",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        display: "grid",
        flexShrink: 0,
        height: 34,
        placeItems: "center",
        width: 34,
      },
      ghostBtn: {
        background: "transparent",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        fontSize: 12,
        padding: "5px 9px",
      },
      body: { display: "flex", flex: 1, gap: 12, minHeight: 0 },
      list: {
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        gap: 4,
        overflowY: "auto",
        padding: 8,
        width: 250,
      },
      item: {
        background: "transparent",
        border: "none",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        display: "block",
        padding: "8px 10px",
        textAlign: "left",
        width: "100%",
      },
      itemActive: { background: "var(--dsw-alias-bg-layer-2)" },
      meta: { color: "var(--dsw-alias-label-secondary)", fontSize: 11 },
      chat: {
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
      },
      chatHead: {
        alignItems: "center",
        borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
        display: "flex",
        flexShrink: 0,
        gap: 8,
        padding: "10px 12px",
      },
      stream: {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        gap: 10,
        overflowY: "auto",
        padding: 12,
      },
      bubble: {
        background: "var(--dsw-alias-bg-layer-1)",
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.6,
        maxWidth: "82%",
        padding: "7px 10px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      },
      inputRow: {
        borderTop: "0.5px solid var(--dsw-alias-border-l2)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        gap: 6,
        padding: 10,
      },
      // 输入框上方的附件 / @ 操作位：小图标、浅背景、无边框（与右侧栏一致）。
      composerTools: { alignItems: "center", display: "flex", gap: 6 },
      composerBtn: {
        alignItems: "center",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "none",
        borderRadius: 6,
        color: "var(--dsw-alias-label-secondary)",
        cursor: "pointer",
        display: "grid",
        flexShrink: 0,
        height: 22,
        placeItems: "center",
        width: 22,
      },
      composerRow: { alignItems: "flex-end", display: "flex", gap: 8 },
      mentionMenu: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        bottom: "100%",
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        left: 10,
        maxHeight: 200,
        overflowY: "auto",
        position: "absolute",
        zIndex: 5,
      },
      mentionItem: {
        background: "transparent",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        fontSize: 12,
        padding: "6px 10px",
        textAlign: "left",
      },
      textarea: {
        background: "var(--dsw-alias-bg-layer-1)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        flex: 1,
        fontFamily: "inherit",
        fontSize: 13,
        minHeight: 38,
        padding: "8px 10px",
        resize: "vertical",
      },
      side: {
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        width: 300,
      },
      tabs: {
        borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
        display: "flex",
        flexShrink: 0,
      },
      tab: {
        background: "transparent",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        flex: 1,
        fontSize: 13,
        padding: "9px 0",
      },
      tabActive: {
        boxShadow: "inset 0 -2px 0 var(--dsw-alias-accent-fill, #2f6feb)",
        fontWeight: 600,
      },
      sideBody: { display: "flex", flex: 1, flexDirection: "column", gap: 10, overflowY: "auto", padding: 12 },
      group: { display: "flex", flexDirection: "column", gap: 4 },
      groupTitle: { color: "var(--dsw-alias-label-secondary)", fontSize: 11, fontWeight: 600 },
      row: { alignItems: "center", display: "flex", gap: 6, fontSize: 13 },
      tag: {
        background: "var(--dsw-alias-bg-layer-2)",
        borderRadius: 4,
        color: "var(--dsw-alias-label-secondary)",
        fontSize: 10,
        padding: "1px 5px",
      },
      pre: {
        background: "var(--dsw-alias-bg-layer-1)",
        borderRadius: 6,
        fontFamily: "inherit",
        fontSize: 12,
        margin: 0,
        maxHeight: 320,
        overflow: "auto",
        padding: 10,
        whiteSpace: "pre-wrap",
      },
      overlay: {
        alignItems: "center",
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        position: "fixed",
        zIndex: 60,
      },
      modal: {
        background: "var(--dsw-alias-bg-layer-1)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: "86vh",
        overflowY: "auto",
        padding: 18,
        width: "min(560px, 92vw)",
      },
      field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12 },
      input: {
        background: "var(--dsw-alias-bg-base)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        fontFamily: "inherit",
        fontSize: 13,
        padding: "7px 9px",
      },
      // Fixed toast: never participates in layout, so showing/hiding a notice
      // cannot reflow the page under a pointer mid-click.
      banner: {
        borderRadius: 6,
        bottom: 16,
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        fontSize: 12,
        maxWidth: "50vw",
        padding: "7px 10px",
        position: "fixed",
        right: 16,
        zIndex: 70,
      },
      error: { background: "rgba(220,60,60,0.14)", color: "#e06a6a" },
      notice: { background: "rgba(60,180,120,0.14)", color: "#4fb783" },
      picker: { display: "flex", flexDirection: "column", gap: 6 },
      pickerTrigger: {
        alignItems: "center",
        background: "var(--dsw-alias-bg-base)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        minHeight: 34,
        padding: "5px 9px",
        width: "100%",
      },
      pickerPlaceholder: {
        color: "var(--dsw-alias-label-secondary)",
        fontSize: 12,
      },
      pickerCaret: {
        color: "var(--dsw-alias-label-secondary)",
        fontSize: 10,
        marginLeft: "auto",
      },
      chips: { display: "flex", flexWrap: "wrap", gap: 4 },
      chip: {
        alignItems: "center",
        background: "var(--dsw-alias-bg-layer-2)",
        borderRadius: 4,
        display: "inline-flex",
        fontSize: 11,
        gap: 4,
        padding: "2px 6px",
      },
      chipRemove: { cursor: "pointer", opacity: 0.7 },
      pickerPanel: {
        background: "var(--dsw-alias-bg-base)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 6,
      },
      pickerSearch: {
        background: "var(--dsw-alias-bg-base)",
        border: "0.5px solid var(--dsw-alias-border-l2)",
        borderRadius: 6,
        color: "inherit",
        fontFamily: "inherit",
        fontSize: 12,
        padding: "6px 8px",
      },
      // 默认可见 10 行（10 × 32 + 9 × 2 间距），超出滚动。
      pickerList: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 338,
        overflowY: "auto",
      },
      pickerOption: {
        alignItems: "center",
        background: "transparent",
        border: "none",
        borderRadius: 5,
        color: "inherit",
        cursor: "pointer",
        display: "flex",
        gap: 8,
        minHeight: 32,
        padding: "0 8px",
        width: "100%",
      },
      pickerOptionOn: {
        background:
          "color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent)",
      },
      pickerOptionOff: { cursor: "not-allowed", opacity: 0.55 },
      check: {
        alignItems: "center",
        border: "1px solid var(--dsw-alias-border-l3)",
        borderRadius: 4,
        display: "inline-flex",
        flexShrink: 0,
        fontSize: 11,
        height: 16,
        justifyContent: "center",
        width: 16,
      },
      checkOn: {
        background: "var(--dsw-alias-accent-fill, #2f6feb)",
        borderColor: "var(--dsw-alias-accent-fill, #2f6feb)",
        color: "#fff",
      },
    };

    /**
     * 简单模糊匹配：优先子串命中，其次按顺序子序列命中，用于下拉框内搜索。
     */
    function fuzzyMatch(text, query) {
      const haystack = String(text ?? "").toLowerCase();
      const needle = String(query ?? "")
        .trim()
        .toLowerCase();
      if (needle === "") return true;
      if (haystack.includes(needle)) return true;
      let cursor = 0;
      for (const char of haystack) {
        if (char === needle[cursor]) cursor += 1;
        if (cursor === needle.length) return true;
      }
      return false;
    }

    /**
     * 邀请成员用的多选下拉：默认展开、可见 5 行，超出滚动，框内支持模糊搜索。
     */
    function InviteMemberPicker(props) {
      const [open, setOpen] = react.useState(true);
      const [query, setQuery] = react.useState("");
      const rootRef = react.useRef(null);

      react.useEffect(() => {
        if (!open || typeof document === "undefined") return undefined;
        // 两个坑都要绕开：
        // 1) 在 mousedown 收起会让面板下方内容上移，同一次点击的 mouseup 落到别的元素上，
        //    从而吞掉「发送邀请」的首击 —— 所以监听 click（等按钮的 click 先跑完再收起）。
        // 2) click 又会在「打开弹窗」那一下冒泡到 document，导致刚展开的面板立刻收起 ——
        //    所以本轮事件循环内先不生效（armed）。
        let armed = false;
        const arm = () => {
          armed = true;
        };
        // 用全局 setTimeout：测试环境里 window 桩可能没有它。
        const timer = setTimeout(arm, 0);
        const onDocumentClick = (event) => {
          if (!armed) return;
          const node = rootRef.current;
          if (node && typeof node.contains === "function" && node.contains(event.target))
            return;
          setOpen(false);
        };
        document.addEventListener("click", onDocumentClick);
        return () => {
          clearTimeout(timer);
          document.removeEventListener("click", onDocumentClick);
        };
      }, [open]);

      const items = props.items ?? [];
      const selectedIds = props.selectedIds ?? new Set();
      const selected = items.filter((item) => selectedIds.has(item.id));
      const list = items.filter((item) => fuzzyMatch(item.name, query));
      // agent 参会方在名字后面直接标「（AI）」，和人类成员区分开。
      const displayName = (item) =>
        item.kind === "ai" ? `${item.name}（AI）` : item.name;

      return h("div", { ref: rootRef, style: PS.picker }, [
        h(
          "div",
          {
            role: "button",
            tabIndex: 0,
            "aria-expanded": open,
            "aria-label": "选择邀请成员",
            style: PS.pickerTrigger,
            onClick: () => setOpen((value) => !value),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen((value) => !value);
              }
            },
          },
          [
            selected.length === 0
              ? h("span", { style: PS.pickerPlaceholder, children: "选择成员…" })
              : h(
                  "div",
                  { style: PS.chips },
                  selected.map((item) =>
                    h("span", { key: item.id, style: PS.chip }, [
                      h("span", { children: displayName(item) }),
                      h("span", {
                        role: "button",
                        "aria-label": `移除 ${item.name}`,
                        style: PS.chipRemove,
                        onClick: (event) => {
                          event.stopPropagation();
                          props.onToggle(item.id);
                        },
                        children: "×",
                      }),
                    ]),
                  ),
                ),
            h("span", { style: PS.pickerCaret, children: open ? "▲" : "▼" }),
          ],
        ),
        open
          ? h("div", { style: PS.pickerPanel }, [
              h("input", {
                style: PS.pickerSearch,
                value: query,
                placeholder: "搜索成员",
                "aria-label": "搜索邀请成员",
                onChange: (event) => setQuery(event.target.value),
              }),
              h(
                "div",
                { style: PS.pickerList },
                list.length === 0
                  ? [
                      h("div", {
                        key: "empty",
                        style: PS.meta,
                        children: "没有匹配的成员",
                      }),
                    ]
                  : list.map((item) => {
                      const inMeeting = item.state === "active";
                      // 已在会议中的参会方默认勾选，且不能再取消/重复邀请。
                      const checked =
                        selectedIds.has(item.id) || inMeeting;
                      return h(
                        "button",
                        {
                          type: "button",
                          key: item.id,
                          disabled: inMeeting,
                          "aria-pressed": checked,
                          style: Object.assign(
                            {},
                            PS.pickerOption,
                            checked ? PS.pickerOptionOn : {},
                            inMeeting ? PS.pickerOptionOff : {},
                          ),
                          onClick: () => {
                            if (!inMeeting) props.onToggle(item.id);
                          },
                        },
                        [
                          h("span", {
                            style: Object.assign(
                              {},
                              PS.check,
                              checked ? PS.checkOn : {},
                            ),
                            children: checked ? "✓" : "",
                          }),
                          h("span", {
                            style: { flex: 1, textAlign: "left" },
                            children: displayName(item),
                          }),
                          inMeeting
                            ? h("span", {
                                style: PS.meta,
                                children: "已在会议中",
                              })
                            : null,
                        ],
                      );
                    }),
              ),
            ])
          : null,
      ]);
    }

    const SPEECH_MODE_OPTIONS = [
      { id: "mention", label: "被点名" },
      { id: "key_topic", label: "关键议题" },
      { id: "observe", label: "观察" },
      { id: "active", label: "主动参与" },
    ];

    const splitLines = (text) =>
      String(text ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "");

    const errText = (cause) =>
      cause instanceof Error ? cause.message : String(cause);

    const participantGroup = (participant, facilitatorId) => {
      if (
        participant.kind === "facilitator" ||
        (facilitatorId !== undefined && participant.id === facilitatorId)
      )
        return "service";
      if (
        participant.kind === "ai_teammate" ||
        participant.kind === "ai_representative" ||
        participant.kind === "agent" ||
        participant.principalUserId !== undefined ||
        participant.teammateInstanceId !== undefined
      )
        return "ai";
      return "human";
    };

    function MeetingsPage(props) {
      const route = props.useShellRoute?.((state) => state.route);
      // 右侧栏打开时，中间区域不再并排渲染「成员 / 纪要」窄栏：
      // 三栏挤在剩余宽度里会把沟通列压到几十像素。
      const sidePanelOpen = usePanelOpen();
      const [workspaces, setWorkspaces] = react.useState([]);
      // 顶部项目下拉默认「全部」：它是筛选器，不再等同于「当前项目」。
      const [workspaceFilter, setWorkspaceFilter] = react.useState("all");
      /**
       * 方案 B：项目清单默认只看"已加入"；平台管理员可切全量视图。
       * 状态来自跨模块共享 store，跳转前后保持同一选择。
       */
      const [allWorkspaces, setAllWorkspaces] = react.useState([]);
      const showAllWorkspaces = react.useSyncExternalStore(
        scopeStore.subscribe,
        scopeStore.getSnapshot,
        scopeStore.getSnapshot,
      );
      const showAllWorkspacesRef = react.useRef(showAllWorkspaces);
      react.useEffect(() => {
        showAllWorkspacesRef.current = showAllWorkspaces;
      }, [showAllWorkspaces]);
      const [isPlatformAdmin, setIsPlatformAdmin] = react.useState(false);
      // 新建会议落到哪个项目：默认取当前可用的项目。
      const [createWorkspaceId, setCreateWorkspaceId] = react.useState("");
      const [accountName, setAccountName] = react.useState("");
      const [accountId, setAccountId] = react.useState("");
      const [meetings, setMeetings] = react.useState([]);
      const [meetingId, setMeetingId] = react.useState("");
      const [detail, setDetail] = react.useState(null);
      const [minutes, setMinutes] = react.useState(null);
      const [delegates, setDelegates] = react.useState([]);
      const [tasks, setTasks] = react.useState([]);
      const [teammates, setTeammates] = react.useState([]);
      const [tab, setTab] = react.useState("members");
      const [content, setContent] = react.useState("");
      const fileRef = react.useRef(null);
      // 沟通区默认贴底：切换会议强制贴底；有新消息时，只要用户还在底部附近
      // 就继续跟随（回看历史时不打扰）。
      const streamRef = react.useRef(null);
      const streamPinnedRef = react.useRef(true);
      const streamMeetingRef = react.useRef("");
      const [search, setSearch] = react.useState("");
      const [mentionIds, setMentionIds] = react.useState(() => new Set());
      const [mentionOpen, setMentionOpen] = react.useState(false);
      const [mentionQuery, setMentionQuery] = react.useState("");
      const [busy, setBusy] = react.useState("");
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [refreshKey, setRefreshKey] = react.useState(0);
      const [createOpen, setCreateOpen] = react.useState(false);
      // 状态反馈条 3 秒后自动消失。
      react.useEffect(() => {
        if (notice === "" && error === "") return undefined;
        const timer = window.setTimeout(() => {
          setNotice("");
          setError("");
        }, 3_000);
        return () => window.clearTimeout(timer);
      }, [notice, error]);
      const [newTitle, setNewTitle] = react.useState("");
      const [newAgenda, setNewAgenda] = react.useState("");
      const [delegateOpen, setDelegateOpen] = react.useState(false);
      const [inviteOpen, setInviteOpen] = react.useState(false);
      const [invitePeople, setInvitePeople] = react.useState([]);
      const [inviteIds, setInviteIds] = react.useState(() => new Set());
      const [dform, setDform] = react.useState({
        teammateInstanceId: "",
        speechMode: "mention",
        goal: "",
        stance: "",
        mustSay: "",
        focusPoints: "",
      });
      const [minutesDraft, setMinutesDraft] = react.useState("");
      const [editingMinutes, setEditingMinutes] = react.useState(false);
      const [closeOpen, setCloseOpen] = react.useState(false);
      const [closeSummary, setCloseSummary] = react.useState("");
      // 「已有纪要时再点生成」的覆盖确认弹窗。
      const [minutesOverwriteOpen, setMinutesOverwriteOpen] = react.useState(false);

      react.useEffect(() => {
        const pending = window.__pluginmaxPendingMeeting;
        if (pending === null || typeof pending !== "object") return;
        window.__pluginmaxPendingMeeting = null;
        if (
          typeof pending.workspaceId === "string" &&
          pending.workspaceId !== ""
        ) {
          setWorkspaceFilter(pending.workspaceId);
        }
        if (typeof pending.meetingId === "string" && pending.meetingId !== "") {
          setMeetingId(pending.meetingId);
        }
      }, []);

      react.useEffect(() => {
        const onNavigate = (event) => {
          const detail = event?.detail;
          if (detail?.plugin !== "meeting") return;
          if (
            typeof detail.workspaceId === "string" &&
            detail.workspaceId !== ""
          ) {
            setWorkspaceFilter(detail.workspaceId);
          }
          if (typeof detail.meetingId === "string" && detail.meetingId !== "") {
            setMeetingId(detail.meetingId);
          }
        };
        window.addEventListener("pluginmax:collab-navigate", onNavigate);
        return () =>
          window.removeEventListener("pluginmax:collab-navigate", onNavigate);
      }, []);

      react.useEffect(
        () =>
          store.subscribeChange((source) => {
            if (source !== "page") setRefreshKey((key) => key + 1);
          }),
        [],
      );

      react.useEffect(() => {
        if (route !== "meetings") return undefined;
        let disposed = false;
        (async () => {
          try {
            const [workspaceResult, me, teammateResult] = await Promise.all([
              request("/api/collab/team/workspaces"),
              request("/api/collab/auth/me"),
              request("/api/collab/teammates").catch(() => ({ teammates: [] })),
            ]);
            if (disposed) return;
            const list = workspaceResult.workspaces ?? [];
            const admin = me.user?.role === "admin";
            setIsPlatformAdmin(admin);
            setAllWorkspaces(list);
            setWorkspaces(
              admin && showAllWorkspacesRef.current
                ? list
                : list.filter((workspace) => workspace.isMember === true),
            );
            setAccountName(me.user?.name ?? "");
            setAccountId(me.user?.id ?? "");
            setTeammates(
              (teammateResult.teammates ?? []).filter(
                (item) => item.state === "active",
              ),
            );
            // 平台管理员对全部项目都有建会权限，可选项不止“已加入”的项目；
            // 否则管理员在未加入任何项目时「新建会议」会一直被禁用。
            const creatable = admin
              ? list
              : list.filter((workspace) => workspace.isMember === true);
            setCreateWorkspaceId((current) =>
              current &&
              creatable.some((workspace) => workspace.id === current)
                ? current
                : (creatable[0]?.id ?? ""),
            );
          } catch (cause) {
            if (!disposed) setError(errText(cause));
          }
        })();
        return () => {
          disposed = true;
        };
      }, [route, showAllWorkspaces]);

      react.useEffect(() => {
        if (route !== "meetings") return undefined;
        // 「全部」= 并列拉取所有可见项目后合并，其余取单个项目。
        // 平台管理员能对全部项目建会，因此默认「仅看已加入」视图也要把
        // 自己在未加入项目里创建/主持的会议带出来，否则建完会议列表反而为空。
        const aggregated =
          workspaceFilter === "all"
            ? isPlatformAdmin
              ? allWorkspaces
              : workspaces
            : [];
        const targets =
          workspaceFilter === "all"
            ? aggregated.map((workspace) => workspace.id)
            : [workspaceFilter];
        if (targets.length === 0) return undefined;
        const joinedIds = new Set(
          workspaces.map((workspace) => workspace.id),
        );
        const keep = (meeting) =>
          workspaceFilter !== "all" ||
          showAllWorkspaces ||
          joinedIds.has(meeting.workspaceId) ||
          (accountId !== "" &&
            (meeting.createdBy === accountId ||
              meeting.ownerUserId === accountId));
        let disposed = false;
        (async () => {
          try {
            const lists = await Promise.all(
              targets.map((id) =>
                request(
                  `/api/collab/meetings?workspaceId=${encodeURIComponent(id)}`,
                )
                  .then((result) => result.meetings ?? [])
                  .catch(() => []),
              ),
            );
            if (disposed) return;
            setMeetings(
              lists
                .flat()
                .filter(keep)
                .sort((left, right) =>
                  String(right.updatedAt).localeCompare(
                    String(left.updatedAt),
                  ),
                ),
            );
          } catch (cause) {
            if (!disposed) setError(errText(cause));
          }
        })();
        return () => {
          disposed = true;
        };
      }, [
        route,
        workspaceFilter,
        workspaces,
        allWorkspaces,
        isPlatformAdmin,
        showAllWorkspaces,
        accountId,
        refreshKey,
      ]);

      react.useEffect(() => {
        if (route !== "meetings" || meetingId === "") {
          setDetail(null);
          setMinutes(null);
          setDelegates([]);
          return undefined;
        }
        let disposed = false;
        (async () => {
          try {
            const [detailResult, minutesResult, delegateResult, taskResult] =
              await Promise.all([
                request(
                  `/api/collab/meeting?meetingId=${encodeURIComponent(meetingId)}`,
                ),
                request(
                  `/api/collab/meeting/minutes?meetingId=${encodeURIComponent(meetingId)}`,
                ).catch(() => null),
                request(
                  `/api/collab/meeting/delegates?meetingId=${encodeURIComponent(meetingId)}`,
                ).catch(() => ({ delegates: [] })),
                request(
                  `/api/collab/meeting/tasks?meetingId=${encodeURIComponent(meetingId)}`,
                ).catch(() => ({ tasks: [] })),
              ]);
            if (disposed) return;
            setDetail(detailResult);
            setMinutes(minutesResult);
            setDelegates(delegateResult.delegates ?? []);
            setTasks(taskResult.tasks ?? []);
            const lastSeq =
              (detailResult?.transcript ?? []).at?.(-1)?.sequence ?? 0;
            if (lastSeq > 0)
              request("/api/collab/meeting/read", {
                method: "POST",
                body: JSON.stringify({ meetingId, lastReadSeq: lastSeq }),
              }).catch(() => undefined);
          } catch (cause) {
            if (!disposed) setError(errText(cause));
          }
        })();
        return () => {
          disposed = true;
        };
      }, [route, meetingId, refreshKey]);

      // 纪要生成是异步的：只要还有生成中的版本，就轮询刷新，
      // 否则界面会一直停在「generating」，看不到待确认或生效状态。
      react.useEffect(() => {
        if (route !== "meetings" || meetingId === "") return undefined;
        const versions = minutes?.versions ?? [];
        const generating = versions.some(
          (version) =>
            version.status === "generating" || version.status === "pending",
        );
        if (!generating) return undefined;
        const timer = window.setInterval(
          () => setRefreshKey((key) => key + 1),
          4_000,
        );
        return () => window.clearInterval(timer);
      }, [route, meetingId, minutes]);

      // 会议成员变动签名：邀请/移除后详情刷新时，同时刷新邀请弹窗里的候选列表，
      // 避免弹窗沿用打开时那份过期名单。
      const rosterKey = (detail?.participants ?? [])
        .map(
          (participant) =>
            `${participant.id}:${participant.refId}:${participant.status}`,
        )
        .join(",");

      react.useEffect(() => {
        if (!inviteOpen || meetingId === "") return undefined;
        let disposed = false;
        (async () => {
          try {
            const result = await request(
              `/api/collab/meeting/people?meetingId=${encodeURIComponent(meetingId)}`,
            );
            if (!disposed) setInvitePeople(result.people ?? []);
          } catch (cause) {
            if (!disposed) setError(errText(cause));
          }
        })();
        return () => {
          disposed = true;
        };
      }, [inviteOpen, meetingId, refreshKey, rosterKey]);

      const run = async (label, action) => {
        setBusy(label);
        setError("");
        try {
          await action();
          setRefreshKey((key) => key + 1);
          store.bumpChange("page");
        } catch (cause) {
          setError(errText(cause));
        } finally {
          setBusy("");
        }
      };

      const post = (path, body) =>
        request(path, { method: "POST", body: JSON.stringify(body) });

      if (route !== "meetings") return null;

      const visibleMeetings = meetings.filter(
        (item) =>
          search.trim() === "" ||
          item.title.toLowerCase().includes(search.trim().toLowerCase()),
      );
      // 可见项目：管理员可用全部项目，普通成员仅限已加入的项目。
      const visibleWorkspaces = isPlatformAdmin ? allWorkspaces : workspaces;
      // 「全部」视图里同一屏会混着多个项目，列表项补上项目名便于区分；
      // 管理员会看到未加入项目里的会议，项目名要按可见项目解析。
      const workspaceNameById = new Map(
        (allWorkspaces.length > 0 ? allWorkspaces : workspaces).map(
          (workspace) => [workspace.id, workspaceLabel(workspace)],
        ),
      );
      // 邀请弹窗只用一个控件：人和 AI Teammate 合成同一份候选清单。
      // 已在会议中的参会方在清单里保持勾选（禁用），提交时只处理新增的那些。
      const inMeetingAgentIds = new Set(
        (detail?.participants ?? [])
          .filter((participant) => participant.kind !== "human")
          .map(
            (participant) =>
              participant.teammateInstanceId ?? participant.refId,
          ),
      );
      const inviteCandidates = [
        ...invitePeople.map((person) => ({
          id: person.id,
          name: person.name,
          kind: "human",
          state: person.state,
        })),
        ...teammates.map((item) => ({
          id: item.id,
          name: item.name,
          kind: "ai",
          state: inMeetingAgentIds.has(item.id) ? "active" : undefined,
        })),
      ];
      const participants = detail?.participants ?? [];
      const transcript = detail?.transcript ?? [];
      // 新消息到达（或刚切会议）后把沟通区贴到底部。
      react.useEffect(() => {
        const node = streamRef.current;
        if (node === null) return;
        const switched = streamMeetingRef.current !== meetingId;
        streamMeetingRef.current = meetingId;
        if (switched) streamPinnedRef.current = true;
        if (streamPinnedRef.current) node.scrollTop = node.scrollHeight;
      }, [meetingId, transcript.length]);
      const meeting = detail?.meeting;
      const actorId = detail?.actorId ?? "";
      const joined = participants.some(
        (participant) =>
          participant.kind === "human" &&
          participant.status === "active" &&
          participant.refId === actorId,
      );
      const facilitatorId = minutes?.facilitator?.id;
      const bucket = { human: [], ai: [], service: [] };
      // Facilitator 只占一个「服务成员」席位：启用时合成一行，
      // 同时隐藏历史遗留的同实例 participant 记录，避免重复。
      const activeFacilitator = minutes?.facilitator ?? undefined;
      const facilitatorSeat =
        activeFacilitator === undefined
          ? undefined
          : {
              id: `facilitator:${activeFacilitator.id}`,
              kind: "facilitator",
              refId: "meeting-facilitator",
              displayName: "会议 Facilitator（AI）",
              status: "active",
            };
      for (const participant of [
        ...(facilitatorSeat === undefined ? [] : [facilitatorSeat]),
        ...participants.filter(
          (participant) =>
            !(
              participant.kind === "ai_teammate" &&
              participant.refId === "meeting-facilitator"
            ),
        ),
      ])
        bucket[participantGroup(participant, facilitatorId)].push(participant);
      const delegateByPrincipal = new Map(
        delegates.map((delegate) => [delegate.principalUserId, delegate]),
      );
      const canConfirm =
        meeting !== undefined &&
        actorId !== "" &&
        (meeting.ownerUserId ?? meeting.createdBy) === actorId;
      // 以「最近更新」为准：不再走「待确认 / 确认生效」流程。
      // （服务端仍会保留 pending_confirm 状态，但不再作为展示门槛。）
      const pending = undefined;
      const latestVersion = (minutes?.versions ?? []).at(-1);
      const canEditMinutes =
        canConfirm && meeting?.status !== "archived";

      const banner = error
        ? h("div", { style: Object.assign({}, PS.banner, PS.error), children: error })
        : notice
          ? h("div", {
              style: Object.assign({}, PS.banner, PS.notice),
              children: notice,
            })
          : null;

      const memberGroup = (label, list, extra) =>
        h(
          "div",
          { style: PS.group },
          h("div", { style: PS.groupTitle, children: label }),
          // 在会成员排前面，已离会（含历史清理打的墓碑）统一沉到分组末尾。
          ...[...list]
            .sort(
              (left, right) =>
                (left.status === "active" ? 0 : 1) -
                  (right.status === "active" ? 0 : 1) ||
                String(left.displayName ?? left.refId ?? "").localeCompare(
                  String(right.displayName ?? right.refId ?? ""),
                  "zh-Hans-CN",
                ),
            )
            .map((participant) =>
            h(
              "div",
              { style: PS.row, key: participant.id },
              h("span", { children: participant.displayName ?? participant.refId }),
              participant.status !== "active"
                ? h("span", { style: PS.tag, children: "已离会" })
                : null,
              extra ? extra(participant) : null,
            ),
            ),
          list.length === 0 ? h("div", { style: PS.meta, children: "暂无" }) : null,
        );

      const membersTab = h(
        "div",
        { style: PS.sideBody },
        memberGroup("人类成员", bucket.human, (participant) => {
          const delegate = delegateByPrincipal.get(participant.refId);
          if (delegate === undefined) return null;
          return h("span", {
            style: PS.tag,
            children: `已委托 · ${delegate.speechMode}`,
          });
        }),
        memberGroup("AI 成员", bucket.ai, (participant) =>
          h("span", {
            style: PS.tag,
            children: participant.principalName
              ? `代表 ${participant.principalName}`
              : "AI",
          }),
        ),
        memberGroup("服务成员", bucket.service, () =>
          h("span", { style: PS.tag, children: "会议服务" }),
        ),
      );

      const minutesTab = h(
        "div",
        { style: PS.sideBody },
        meeting?.status === "archived"
          ? h("div", {
              style: PS.meta,
              children: "会议已归档，纪要进入只读状态。",
            })
          : minutes?.facilitator
          ? h("button", {
              type: "button",
              style: PS.ghostBtn,
              disabled: busy !== "" || !joined,
              onClick: () => {
                // 已有内容时先弹窗告知：重新生成会覆盖现有纪要。
                if (String(latestVersion?.content ?? "").trim() !== "") {
                  setMinutesOverwriteOpen(true);
                  return;
                }
                void run("minutes", () =>
                  post("/api/collab/meeting/minutes/trigger", { meetingId }),
                );
              },
              children: busy === "minutes" ? "生成中…" : "生成/更新纪要",
            })
          : h("div", {
              style: PS.meta,
              children:
                "会议 Facilitator 未在会：用「邀请成员」把它拉进会议后即可生成纪要。",
            }),
        latestVersion === undefined || String(latestVersion.content ?? "").trim() === ""
          ? h("div", { style: PS.meta, children: "暂无会议纪要" })
          : h("div", { style: PS.group }, [
              h("div", {
                style: PS.groupTitle,
                children: `会议纪要 v${latestVersion.version}`,
              }),
              editingMinutes
                ? h("textarea", {
                    style: Object.assign({}, PS.textarea, { minHeight: 160 }),
                    value: minutesDraft,
                    onChange: (event) => setMinutesDraft(event.target.value),
                  })
                : h(
                    "div",
                    { style: PS.pre },
                    renderChatMarkdown(latestVersion.content) ??
                      h("span", null, "（空）"),
                  ),
              canEditMinutes && minutes?.facilitator
                ? h("div", { style: { display: "flex", gap: 6 } }, [
                    h("button", {
                      type: "button",
                      style: PS.ghostBtn,
                      disabled: busy !== "",
                      onClick: () => {
                        if (editingMinutes) {
                          setEditingMinutes(false);
                          return;
                        }
                        setMinutesDraft(latestVersion.content ?? "");
                        setEditingMinutes(true);
                      },
                      children: editingMinutes ? "取消" : "编辑",
                    }),
                    editingMinutes
                      ? h("button", {
                          type: "button",
                          style: PS.primaryBtn,
                          disabled: busy !== "",
                          onClick: () =>
                            run("confirm", async () => {
                              await post("/api/collab/meeting/minutes/confirm", {
                                meetingId,
                                versionId: latestVersion.id,
                                content: minutesDraft,
                              });
                              setEditingMinutes(false);
                            }),
                          children: busy === "confirm" ? "保存中…" : "保存",
                        })
                      : null,
                  ])
                : null,
            ]),
        pending
          ? h("div", { style: PS.group }, [
              h("div", {
                style: PS.groupTitle,
                children: `待确认 v${pending.version}`,
              }),
              canConfirm
                ? h("div", { style: { display: "grid", gap: 6 } }, [
                    editingMinutes
                      ? h("textarea", {
                          style: Object.assign({}, PS.textarea, {
                            minHeight: 120,
                          }),
                          value: minutesDraft,
                          onChange: (event) => setMinutesDraft(event.target.value),
                        })
                      : null,
                    h("div", { style: { display: "flex", gap: 6 } }, [
                      h("button", {
                        type: "button",
                        style: PS.ghostBtn,
                        onClick: () => {
                          setEditingMinutes((value) => !value);
                          setMinutesDraft(pending.content ?? "");
                        },
                        children: editingMinutes ? "取消编辑" : "编辑",
                      }),
                      h("button", {
                        type: "button",
                        style: PS.primaryBtn,
                        disabled: busy !== "",
                        onClick: () =>
                          run("confirm", () =>
                            post("/api/collab/meeting/minutes/confirm", {
                              meetingId,
                              versionId: pending.id,
                              ...(editingMinutes
                                ? { content: minutesDraft }
                                : {}),
                            }),
                          ),
                        children: "确认生效",
                      }),
                    ]),
                  ])
                : h("div", { style: PS.meta, children: "等待会议负责人确认" }),
            ])
          : null,
      );

      const stream = h(
        "div",
        {
          ref: streamRef,
          style: PS.stream,
          onScroll: () => {
            const node = streamRef.current;
            if (node === null) return;
            streamPinnedRef.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 80;
          },
        },
        // 与右侧栏会话保持同一套排版：头像 + 名称/时间 + 气泡，
        // 自己的消息头像与内容一起靠右，名称显示「我」。
        ...transcript.map((message) => {
          const mine =
            message.senderKind === "human" && message.senderId === actorId;
          const label =
            message.provenance?.role === "representative"
              ? `${message.senderName} · AI 参会代表`
              : message.senderKind === "agent"
                ? `${message.senderName} · AI`
                : mine
                  ? "我"
                  : message.senderName;
          return h(
            "div",
            {
              key: message.id,
              style: {
                alignItems: "flex-start",
                display: "flex",
                flexDirection: mine ? "row-reverse" : "row",
                gap: 8,
              },
            },
            chatAvatar(message, mine, teammates),
            h(
              "div",
              {
                style: {
                  alignItems: mine ? "flex-end" : "flex-start",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  maxWidth: "82%",
                  minWidth: 0,
                },
              },
              h("div", {
                style: PS.meta,
                children: `${label} · ${timeShort(message.createdAt)}`,
              }),
              h(
                "div",
                { style: Object.assign({}, PS.bubble, { maxWidth: "100%" }) },
                h("div", null, renderChatMarkdown(displayContent(message.content))),
                (message.attachments ?? []).length > 0
                  ? h(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 4 } },
                      ...(message.attachments ?? []).map((attachment) =>
                        h(
                          "button",
                          {
                            key: attachment.id,
                            type: "button",
                            style: PS.ghostBtn,
                            onClick: () => void openAttachment(attachment),
                          },
                          `${attachment.name}（${Math.max(1, Math.round(attachment.size / 1024))}KB）`,
                        ),
                      ),
                    )
                  : null,
              ),
            ),
          );
        }),
        transcript.length === 0
          ? h("div", { style: PS.meta, children: "暂无消息" })
          : null,
      );

      const mentionOptions = participants.filter(
        (participant) =>
          participant.status === "active" &&
          !(participant.kind === "human" && participant.refId === actorId) &&
          (mentionQuery === "" ||
            (participant.displayName ?? "")
              .toLowerCase()
              .includes(mentionQuery.toLowerCase())),
      );
      const pickMention = (participant) => {
        setContent((value) =>
          value.replace(/@([^\s@]*)$/, `@${participant.displayName} `),
        );
        setMentionIds((ids) => new Set(ids).add(participant.id));
        setMentionOpen(false);
        setMentionQuery("");
      };

      async function openAttachment(attachment) {
        try {
          const result = await request(
            `/api/collab/meeting/file?fileId=${encodeURIComponent(attachment.id)}`,
          );
          const file = result.file;
          const binary = atob(file.data ?? "");
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1)
            bytes[index] = binary.charCodeAt(index);
          const url = URL.createObjectURL(
            new Blob([bytes], {
              type: file.mime || attachment.mime || "application/octet-stream",
            }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = file.name || attachment.name || "file";
          link.click();
          URL.revokeObjectURL(url);
        } catch (cause) {
          setError(errText(cause));
        }
      }

      async function uploadFile(file) {
        if (file === undefined) return;
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(String(reader.result ?? "").split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("读取文件失败"));
          reader.readAsDataURL(file);
        });
        await run("upload", () =>
          post("/api/collab/meeting/file", {
            meetingId,
            name: file.name,
            mime: file.type || "application/octet-stream",
            data,
          }),
        );
      }

      const chat = meeting
        ? h("div", { style: PS.chat }, [
            h("div", { style: PS.chatHead }, [
              h("div", { style: { flex: 1, minWidth: 0 } }, [
                h("div", { style: { fontSize: 14, fontWeight: 600 }, children: meeting.title }),
                h("div", {
                  style: PS.meta,
                  children: `${meeting.status === "archived" ? "已归档" : meeting.status === "closed" ? "已结束" : "进行中"} · ${participants.filter((participant) => participant.status === "active").length} 人 · ${bucket.ai.length} 个 AI`,
                }),
              ]),
              joined
                ? h("button", {
                    type: "button",
                    style: PS.ghostBtn,
                    disabled: busy !== "",
                    onClick: () => setInviteOpen(true),
                    children: "邀请成员",
                  })
                : null,
              joined
                ? h("button", {
                    type: "button",
                    style: PS.ghostBtn,
                    disabled: busy !== "",
                    onClick: () => setDelegateOpen(true),
                    children: "指派 AI 参会",
                  })
                : null,
              !joined
                ? h("button", {
                    type: "button",
                    style: PS.primaryBtn,
                    disabled: busy !== "",
                    onClick: () =>
                      run("join", () =>
                        post("/api/collab/meeting/join", {
                          meetingId,
                          displayName: accountName || `用户-${actorId.slice(0, 6)}`,
                        }),
                      ),
                    children: "加入会议",
                  })
                : null,
              joined && meeting.status === "active"
                ? h("button", {
                    type: "button",
                    style: PS.ghostBtn,
                    disabled: busy !== "",
                    onClick: () => {
                      setCloseOpen(true);
                      setCloseSummary("");
                    },
                    children: "关闭会议",
                  })
                : null,
              meeting.status === "closed"
                ? h("button", {
                    type: "button",
                    style: PS.ghostBtn,
                    disabled: busy !== "",
                    onClick: () =>
                      run("archive", () =>
                        post("/api/collab/meeting/archive", { meetingId }),
                      ),
                    children: "归档会议",
                  })
                : null,
            ]),
            stream,
            meeting.status === "active" && joined
              ? h("div", { style: { flexShrink: 0, position: "relative" } }, [
                  mentionOpen && mentionOptions.length > 0
                    ? h("div", { style: PS.mentionMenu },
                        ...mentionOptions.map((participant) =>
                          h("button", {
                            type: "button",
                            key: participant.id,
                            style: PS.mentionItem,
                            onMouseDown: (event) => {
                              event.preventDefault();
                              pickMention(participant);
                            },
                            children: `${participant.displayName}${
                              participant.kind === "human" ? "" : "（AI）"
                            }`,
                          }),
                        ),
                      )
                    : null,
                  h(
                  "form",
                  { style: PS.inputRow, onSubmit: async (event) => {
                      event.preventDefault();
                      const text = content.trim();
                      if (text === "") return;
                      setContent("");
                      setMentionOpen(false);
                      await run("send", () =>
                        post("/api/collab/meeting/message", {
                          meetingId,
                          content: text,
                          mentions: [...mentionIds],
                        }),
                      );
                      setMentionIds(new Set());
                    } },
                  // 附件 / @ 收成小图标，放在输入框上方（与右侧栏一致）。
                  h("div", { style: PS.composerTools }, [
                    h("button", {
                      type: "button",
                      style: PS.composerBtn,
                      title: "上传文件",
                      "aria-label": "上传文件",
                      onClick: () => fileRef.current?.click(),
                    }, clipIcon()),
                    h("button", {
                      type: "button",
                      style: PS.composerBtn,
                      title: "提及成员",
                      "aria-label": "提及成员",
                      onClick: () => setMentionOpen((value) => !value),
                    }, atIcon()),
                    h("input", {
                      ref: fileRef,
                      type: "file",
                      style: { display: "none" },
                      onChange: (event) => {
                        void uploadFile(event.target.files?.[0]);
                        event.target.value = "";
                      },
                    }),
                  ]),
                  h("div", { style: PS.composerRow }, [
                    h("textarea", {
                      style: Object.assign({}, PS.textarea, { minHeight: 72 }),
                      rows: 3,
                      value: content,
                      placeholder: "输入消息，@ 成员…",
                      onChange: (event) => {
                        const value = event.target.value;
                        setContent(value);
                        const match = /@([^\s@]*)$/.exec(value);
                        if (match) {
                          setMentionOpen(true);
                          setMentionQuery(match[1]);
                        } else {
                          setMentionOpen(false);
                        }
                      },
                    }),
                    h("button", {
                      type: "submit",
                      style: PS.primaryBtn,
                      disabled: busy !== "",
                      children: "发送",
                    }),
                  ]),
                  ),
                ])
              : null,
          ])
        : h(
            "div",
            { style: Object.assign({}, PS.chat, { alignItems: "center", justifyContent: "center" }) },
            h("div", { style: PS.meta, children: "选择或创建一个会议" }),
          );

      const side = h("div", { style: PS.side }, [
        h("div", { style: PS.tabs }, [
          h("button", {
            type: "button",
            style: Object.assign({}, PS.tab, tab === "members" ? PS.tabActive : {}),
            onMouseDown: () => setTab("members"),
            onClick: () => setTab("members"),
            children: "成员",
          }),
          h("button", {
            type: "button",
            style: Object.assign({}, PS.tab, tab === "minutes" ? PS.tabActive : {}),
            onMouseDown: () => setTab("minutes"),
            onClick: () => setTab("minutes"),
            children: "纪要",
          }),
        ]),
        tab === "members" ? membersTab : minutesTab,
      ]);

      /** 方案 B：在"只看已加入项目"与"全量（管理员）"之间切换。 */
      const setShowAllProjects = (next) => {
        showAllWorkspacesRef.current = next;
        scopeStore.setAll(next);
        setWorkspaceFilter("all");
      };

      return h("div", { style: PS.root }, [
        h("div", { style: PS.top }, [
          h("h1", { style: PS.title, children: "会议" }),
          // 项目下拉与搜索框一起右对齐，紧贴「新建会议」左侧。
          h("div", { style: { flex: 1 } }),
          isPlatformAdmin
            ? h(
                "div",
                {
                  role: "group",
                  "aria-label": "项目范围",
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                    padding: 2,
                    border: "0.5px solid var(--dsw-alias-border-l2)",
                    borderRadius: 8,
                    background:
                      "var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base))",
                  },
                },
                h(
                  "button",
                  {
                    type: "button",
                    style: Object.assign({}, PS.select, {
                      cursor: "pointer",
                      padding: "4px 9px",
                      border: "none",
                      background: showAllWorkspaces
                        ? "transparent"
                        : "color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent)",
                      color: showAllWorkspaces
                        ? "var(--dsw-alias-label-secondary)"
                        : "var(--dsw-alias-accent-primary,#4f8ef7)",
                    }),
                    "aria-pressed": !showAllWorkspaces,
                    title: "只看我已加入的项目（默认视图）",
                    onClick: () => {
                      if (showAllWorkspaces) setShowAllProjects(false);
                    },
                  },
                  "仅看已加入",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    style: Object.assign({}, PS.select, {
                      cursor: "pointer",
                      padding: "4px 9px",
                      border: "none",
                      background: showAllWorkspaces
                        ? "color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent)"
                        : "transparent",
                      color: showAllWorkspaces
                        ? "var(--dsw-alias-accent-primary,#4f8ef7)"
                        : "var(--dsw-alias-label-secondary)",
                    }),
                    "aria-pressed": showAllWorkspaces,
                    title: "平台管理员全量视图：显示全部项目",
                    onClick: () => {
                      if (!showAllWorkspaces) setShowAllProjects(true);
                    },
                  },
                  "平台全量",
                ),
              )
            : null,
          h(
            "select",
            {
              style: PS.select,
              value: workspaceFilter,
              "aria-label": "项目筛选",
              title: "项目筛选",
              onChange: (event) => {
                setWorkspaceFilter(event.target.value);
                setMeetingId("");
              },
            },
            h("option", { value: "all", children: "全部" }),
            ...visibleWorkspaces.map((workspace) =>
              h("option", {
                key: workspace.id,
                value: workspace.id,
                children: workspaceLabel(workspace),
              }),
            ),
          ),
          h("input", {
            style: Object.assign({}, PS.select, { width: 260 }),
            value: search,
            placeholder: "搜索会议标题",
            "aria-label": "搜索会议标题",
            onChange: (event) => setSearch(event.target.value),
          }),
          h("button", {
            type: "button",
            style: PS.primaryBtn,
            disabled: visibleWorkspaces.length === 0,
            onClick: () => setCreateOpen(true),
            children: "新建会议",
          }),
          // 会议页右上角也提供侧边栏开关（与中间区域的会议图标等价）。
          h("button", {
            type: "button",
            style: PS.sidebarBtn,
            title: "会议侧边栏",
            "aria-label": "会议侧边栏",
            onClick: () => window.__pluginmaxMeeting?.toggle(),
          },
            videoIcon(),
          ),
        ]),
        banner,
        closeOpen
          ? h(
              "div",
              { style: Object.assign({}, PS.banner, PS.notice) },
              h("div", {
                style: { marginBottom: 6 },
                children: "散会摘要（可留空）",
              }),
              h("textarea", {
                style: PS.textarea,
                value: closeSummary,
                "aria-label": "散会摘要",
                onChange: (event) => setCloseSummary(event.target.value),
              }),
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    marginTop: 6,
                  },
                },
                h("button", {
                  type: "button",
                  style: PS.ghostBtn,
                  onClick: () => setCloseOpen(false),
                  children: "取消",
                }),
                h("button", {
                  type: "button",
                  style: PS.primaryBtn,
                  disabled: busy !== "",
                  onClick: () => {
                    void run("close", async () => {
                      await post("/api/collab/meeting/close", {
                        meetingId,
                        summary: closeSummary,
                      });
                      setCloseOpen(false);
                    });
                  },
                  children: "确认散会",
                }),
              ),
            )
          : null,
        minutesOverwriteOpen
          ? h("div", { style: PS.overlay }, h("form", {
              style: PS.modal,
              onSubmit: (event) => {
                event.preventDefault();
                setMinutesOverwriteOpen(false);
                void run("minutes", () =>
                  post("/api/collab/meeting/minutes/trigger", { meetingId }),
                );
              },
            }, [
              h("div", { style: PS.title, children: "重新生成会议纪要？" }),
              h("div", {
                style: PS.meta,
                children: "当前会议纪要已有内容，重新生成会覆盖原有内容。",
              }),
              h("div", {
                style: { display: "flex", gap: 8, justifyContent: "flex-end" },
              }, [
                h("button", {
                  type: "button",
                  style: PS.ghostBtn,
                  onClick: () => setMinutesOverwriteOpen(false),
                  children: "取消",
                }),
                h("button", {
                  type: "submit",
                  style: PS.primaryBtn,
                  disabled: busy !== "",
                  children: "覆盖生成",
                }),
              ]),
            ]))
          : null,
        h("div", { style: PS.body }, [
          h(
            "div",
            { style: PS.list },
            ...visibleMeetings.map((item) =>
              h(
                "button",
                {
                  type: "button",
                  key: item.id,
                  style: Object.assign(
                    {},
                    PS.item,
                    item.id === meetingId ? PS.itemActive : {},
                  ),
                  onMouseDown: () => setMeetingId(item.id),
                  onClick: () => setMeetingId(item.id),
                },
                h("div", { style: { fontSize: 13, fontWeight: 500 }, children: item.title }),
                h("div", {
                  style: PS.meta,
                  children: [
                    workspaceFilter === "all"
                      ? workspaceNameById.get(item.workspaceId)
                      : undefined,
                    `${item.status === "archived" ? "已归档" : item.status === "closed" ? "已结束" : "进行中"} · ${timeShort(item.updatedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }),
              ),
            ),
            visibleMeetings.length === 0
              ? h("div", { style: PS.meta, children: "暂无会议" })
              : null,
          ),
          chat,
          sidePanelOpen ? null : side,
        ]),
        createOpen
          ? h("div", { style: PS.overlay }, h("form", {
              style: PS.modal,
              onSubmit: async (event) => {
                event.preventDefault();
                if (newTitle.trim() === "") return;
                await run("create", async () => {
                  const result = await post("/api/collab/meetings", {
                    workspaceId: createWorkspaceId,
                    title: newTitle.trim(),
                    agenda: newAgenda,
                  });
                  setCreateOpen(false);
                  setNewTitle("");
                  setNewAgenda("");
                  if (result?.meeting?.id) setMeetingId(result.meeting.id);
                });
              },
            }, [
              h("div", { style: PS.title, children: "新建会议" }),
              h("label", { style: PS.field }, [
                h("span", { children: "项目" }),
                h(
                  "select",
                  {
                    style: PS.input,
                    value: createWorkspaceId,
                    "aria-label": "新建会议所属项目",
                    onChange: (event) =>
                      setCreateWorkspaceId(event.target.value),
                  },
                  ...visibleWorkspaces.map((workspace) =>
                    h("option", {
                      key: workspace.id,
                      value: workspace.id,
                      children: workspaceLabel(workspace),
                    }),
                  ),
                ),
              ]),
              h("label", { style: PS.field }, [
                h("span", { children: "会议主题" }),
                h("input", {
                  style: PS.input,
                  value: newTitle,
                  onChange: (event) => setNewTitle(event.target.value),
                }),
              ]),
              h("label", { style: PS.field }, [
                h("span", { children: "议程（可选）" }),
                h("textarea", {
                  style: PS.textarea,
                  value: newAgenda,
                  onChange: (event) => setNewAgenda(event.target.value),
                }),
              ]),
              h("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } }, [
                h("button", {
                  type: "button",
                  style: PS.ghostBtn,
                  onClick: () => setCreateOpen(false),
                  children: "取消",
                }),
                h("button", { type: "submit", style: PS.primaryBtn, children: "创建" }),
              ]),
            ]))
          : null,
        inviteOpen
          ? h("div", { style: PS.overlay }, h("form", {
              style: PS.modal,
              onSubmit: async (event) => {
                event.preventDefault();
                await run("invite", async () => {
                  // 一次性提交：人和 AI 在同一份清单里选好后一起发。
                  const picked = inviteCandidates.filter(
                    (item) =>
                      inviteIds.has(item.id) && item.state !== "active",
                  );
                  const people = picked.filter((item) => item.kind === "human");
                  const agents = picked.filter((item) => item.kind === "ai");
                  if (people.length > 0) {
                    await post("/api/collab/meeting/participants/invite", {
                      meetingId,
                      people: people.map((item) => ({
                        targetId: item.id,
                      })),
                    });
                  }
                  for (const agent of agents) {
                    await post("/api/collab/meeting/participant/ai", {
                      meetingId,
                      teammateInstanceId: agent.id,
                      displayName: agent.name,
                      speechMode: dform.speechMode,
                    });
                  }
                  setInviteOpen(false);
                  setInviteIds(new Set());
                  setNotice("已发送邀请");
                });
              },
            }, [
              h("div", { style: PS.title, children: "邀请成员" }),
              h("div", { style: PS.group }, [
                h("div", {
                  style: PS.groupTitle,
                  children: "选择参会成员（人 / AI）",
                }),
                inviteCandidates.length === 0
                  ? h("div", { style: PS.meta, children: "暂无可邀请成员" })
                  : h(InviteMemberPicker, {
                      items: inviteCandidates,
                      selectedIds: inviteIds,
                      onToggle: (id) =>
                        setInviteIds((ids) => {
                          const next = new Set(ids);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        }),
                    }),
              ]),
              h(
                "div",
                { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
                [
                  h("button", {
                    type: "button",
                    style: PS.ghostBtn,
                    onClick: () => setInviteOpen(false),
                    children: "取消",
                  }),
                  h("button", {
                    type: "submit",
                    style: PS.primaryBtn,
                    disabled: busy !== "",
                    children: busy === "invite" ? "发送中…" : "发送邀请",
                  }),
                ],
              ),
            ]))
          : null,
        delegateOpen
          ? h("div", { style: PS.overlay }, h("form", {
              style: PS.modal,
              onSubmit: async (event) => {
                event.preventDefault();
                if (dform.teammateInstanceId === "") {
                  setError("请选择一个 AI Teammate");
                  return;
                }
                await run("assign", async () => {
                  await post("/api/collab/meeting/delegate/assign", {
                    meetingId,
                    teammateInstanceId: dform.teammateInstanceId,
                    speechMode: dform.speechMode,
                    instruction: {
                      goal: dform.goal,
                      stance: dform.stance,
                      mustSay: splitLines(dform.mustSay),
                      focusPoints: splitLines(dform.focusPoints),
                    },
                  });
                  setDelegateOpen(false);
                  setNotice("已指派 AI 参会代表");
                });
              },
            }, [
              h("div", { style: PS.title, children: "指派 AI 参会代表" }),
              h("label", { style: PS.field }, [
                h("span", { children: "选择我的 AI Teammate" }),
                h(
                  "select",
                  {
                    style: PS.input,
                    value: dform.teammateInstanceId,
                    onChange: (event) =>
                      setDform((form) => Object.assign({}, form, {
                        teammateInstanceId: event.target.value,
                      })),
                  },
                  h("option", { value: "", children: "请选择" }),
                  ...teammates.map((item) =>
                    h("option", {
                      key: item.id,
                      value: item.id,
                      children: `${item.name} · ${item.ownerName ?? ""}`,
                    }),
                  ),
                ),
              ]),
              h("label", { style: PS.field }, [
                h("span", { children: "发言模式" }),
                h(
                  "select",
                  {
                    style: PS.input,
                    value: dform.speechMode,
                    onChange: (event) =>
                      setDform((form) => Object.assign({}, form, {
                        speechMode: event.target.value,
                      })),
                  },
                  ...SPEECH_MODE_OPTIONS.map((option) =>
                    h("option", {
                      key: option.id,
                      value: option.id,
                      children: option.label,
                    }),
                  ),
                ),
              ]),
              h("label", { style: PS.field }, [
                h("span", { children: "参会目标" }),
                h("textarea", {
                  style: PS.textarea,
                  value: dform.goal,
                  onChange: (event) =>
                    setDform((form) => Object.assign({}, form, { goal: event.target.value })),
                }),
              ]),
              h("label", { style: PS.field }, [
                h("span", { children: "核心立场" }),
                h("textarea", {
                  style: PS.textarea,
                  value: dform.stance,
                  onChange: (event) =>
                    setDform((form) => Object.assign({}, form, { stance: event.target.value })),
                }),
              ]),
              h("label", { style: PS.field }, [
                h("span", { children: "必须表达的要点（每行一条）" }),
                h("textarea", {
                  style: PS.textarea,
                  value: dform.mustSay,
                  onChange: (event) =>
                    setDform((form) => Object.assign({}, form, { mustSay: event.target.value })),
                }),
              ]),
              h("label", { style: PS.field }, [
                h("span", { children: "把控点（每行一条）" }),
                h("textarea", {
                  style: PS.textarea,
                  value: dform.focusPoints,
                  onChange: (event) =>
                    setDform((form) => Object.assign({}, form, { focusPoints: event.target.value })),
                }),
              ]),
              h("div", { style: PS.meta, children: "委托正文仅你本人与该 AI Teammate 可见。" }),
              h("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } }, [
                h("button", {
                  type: "button",
                  style: PS.ghostBtn,
                  onClick: () => setDelegateOpen(false),
                  children: "取消",
                }),
                h("button", {
                  type: "submit",
                  style: PS.primaryBtn,
                  disabled: busy !== "",
                  children: busy === "assign" ? "指派中…" : "确认指派",
                }),
              ]),
            ]))
          : null,
      ]);
    }

    function MeetingsGlobalPage(props) {
      const route = props.useShellRoute?.((state) => state.route);
      if (route !== "meetings") return null;
      return h(MeetingsPage, props);
    }

    /* ── apply: register slots ── */

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          { name: "pluginmax.global", id: "pluginmax-meetings", order: 34 },
          MeetingsGlobalPage,
        ),
      );
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          { name: "shell.overlay", id: "pluginmax-meeting-panel", order: 10 },
          MeetingPanel,
        ),
      );
    };

    return module.exports;
  },
});
