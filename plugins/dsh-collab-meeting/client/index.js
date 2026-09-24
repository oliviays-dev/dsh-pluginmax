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
      openPanel() { this.open = true; this.emit(); },
      toggle() { this.open = !this.open; this.emit(); },
      close() { this.open = false; this.emit(); },
      subscribe(fn) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; },
      emit() {
        window.__pluginmaxShell?.setMeetingOpen(this.open);
        for (const fn of this.listeners) fn(this.open);
      },
    };

    window.__pluginmaxMeeting = store;

    function usePanelOpen() {
      const [open, setOpen] = react.useState(store.open);
      react.useEffect(() => store.subscribe(setOpen), []);
      return open;
    }

    /* ── styles ── */

    const panelRootStyle = {
      alignItems: "stretch",
      display: "flex",
      inset: 0,
      justifyContent: "flex-end",
      overflow: "hidden",
      pointerEvents: "none",
      position: "absolute",
      zIndex: 20,
    };

    const panelStyle = {
      background: "var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base))",
      borderLeft: "0.5px solid var(--dsw-alias-border-l2)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      pointerEvents: "auto",
      width: `min(${PANEL_WIDTH}px, 100%)`,
    };

    const headerStyle = {
      alignItems: "center",
      borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
      display: "flex",
      flexShrink: 0,
      gap: 8,
      padding: "12px 14px 10px",
    };

    const titleStyle = {
      color: "var(--dsw-alias-label-primary)",
      flex: 1,
      fontSize: 14,
      fontWeight: 600,
      margin: 0,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    };

    const iconBtnStyle = {
      alignItems: "center",
      background: "transparent",
      border: 0,
      borderRadius: 5,
      color: "var(--dsw-alias-label-secondary)",
      cursor: "pointer",
      display: "flex",
      flexShrink: 0,
      height: 28,
      justifyContent: "center",
      width: 28,
    };

    const wsBarStyle = {
      borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
      display: "grid",
      flexShrink: 0,
      gap: 7,
      padding: "8px 14px 10px",
    };

    const wsRowStyle = {
      alignItems: "center",
      display: "flex",
      gap: 5,
      minWidth: 0,
    };

    const wsLabelStyle = {
      color: "var(--dsw-alias-label-secondary)",
      flexShrink: 0,
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: "nowrap",
    };

    const selectStyle = {
      appearance: "none",
      background: "var(--dsw-alias-bg-layer-2)",
      border: "0.5px solid var(--dsw-alias-border-l3)",
      borderRadius: 5,
      color: "var(--dsw-alias-label-primary)",
      flex: 1,
      font: "inherit",
      fontSize: 12,
      minWidth: 0,
      padding: "5px 8px",
    };

    const createBarStyle = {
      borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
      display: "grid",
      flexShrink: 0,
      gap: 8,
      padding: "12px 14px 8px",
    };

    const createToggleStyle = {
      background: "transparent",
      border: 0,
      color: "var(--dsw-alias-accent-primary, #4f8ef7)",
      cursor: "pointer",
      font: "inherit",
      fontSize: 12,
      fontWeight: 500,
      justifySelf: "start",
      padding: 0,
    };

    const createFormStyle = {
      display: "grid",
      gap: 6,
    };

    const inputStyle = {
      background: "var(--dsw-alias-bg-layer-2)",
      border: "0.5px solid var(--dsw-alias-border-l3)",
      borderRadius: 5,
      color: "var(--dsw-alias-label-primary)",
      font: "inherit",
      fontSize: 12,
      minWidth: 0,
      padding: "6px 8px",
      width: "100%",
    };

    const primaryBtnStyle = {
      background: "var(--dsw-alias-button-primary-fill)",
      border: 0,
      borderRadius: 5,
      color: "var(--dsw-alias-label-primary-foreground)",
      cursor: "pointer",
      font: "inherit",
      fontSize: 12,
      fontWeight: 500,
      justifySelf: "start",
      padding: "6px 10px",
      whiteSpace: "nowrap",
    };

    const ghostBtnStyle = {
      background: "transparent",
      border: "0.5px solid var(--dsw-alias-border-l3)",
      borderRadius: 4,
      color: "var(--dsw-alias-label-secondary)",
      cursor: "pointer",
      font: "inherit",
      fontSize: 11,
      fontWeight: 500,
      padding: "3px 9px",
      whiteSpace: "nowrap",
    };

    const listStyle = {
      display: "flex",
      flex: 1,
      flexDirection: "column",
      gap: 5,
      overflowY: "auto",
      padding: "6px 10px",
    };

    const cardStyle = {
      background: "var(--dsw-alias-bg-layer-2)",
      border: "0.5px solid var(--dsw-alias-border-l2)",
      borderRadius: 7,
      cursor: "pointer",
      padding: "10px 12px",
    };

    const cardTitleStyle = {
      color: "var(--dsw-alias-label-primary)",
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 3,
    };

    const cardMetaStyle = {
      alignItems: "center",
      color: "var(--dsw-alias-label-secondary)",
      display: "flex",
      fontSize: 11,
      gap: 7,
      marginBottom: 7,
    };

    const pillOnStyle = {
      background: "rgba(52, 212, 126, 0.14)",
      borderRadius: 8,
      color: "var(--dsw-alias-state-success-primary, #34d47e)",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.3px",
      padding: "2px 7px",
    };

    const pillOffStyle = {
      background: "rgba(100, 116, 139, 0.12)",
      borderRadius: 8,
      color: "var(--dsw-alias-label-tertiary, #5a6478)",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.3px",
      padding: "2px 7px",
    };

    const participantsStyle = {
      borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
      display: "grid",
      flexShrink: 0,
    };

    const participantHeadStyle = {
      alignItems: "center",
      background: "transparent",
      border: 0,
      color: "var(--dsw-alias-label-secondary)",
      cursor: "pointer",
      display: "flex",
      font: "inherit",
      fontSize: 11,
      fontWeight: 600,
      gap: 7,
      justifyContent: "space-between",
      padding: "8px 14px",
      textAlign: "left",
      width: "100%",
    };

    const participantListStyle = {
      display: "grid",
      gap: 5,
      maxHeight: 136,
      overflowY: "auto",
      padding: "0 10px 9px",
    };

    const participantRowStyle = {
      alignItems: "center",
      background: "var(--dsw-alias-bg-layer-2)",
      border: "0.5px solid var(--dsw-alias-border-l2)",
      borderRadius: 7,
      color: "var(--dsw-alias-label-primary)",
      display: "grid",
      fontSize: 11,
      gap: 7,
      gridTemplateColumns: "18px minmax(0, 1fr) auto",
      minHeight: 32,
      padding: "4px 7px",
    };

    const participantNameStyle = {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    };

    const participantTagStyle = {
      borderRadius: 7,
      color: "var(--dsw-alias-label-tertiary)",
      flexShrink: 0,
      fontSize: 9,
      padding: "1px 5px",
      whiteSpace: "nowrap",
    };

    const removeParticipantBtnStyle = {
      ...participantTagStyle,
      background: "rgba(239, 68, 68, 0.10)",
      border: 0,
      color: "var(--dsw-alias-state-danger-primary, #ef4444)",
      cursor: "pointer",
      fontFamily: "inherit",
      fontWeight: 700,
    };

    const selfParticipantRowStyle = {
      ...participantRowStyle,
      borderColor: "var(--dsw-alias-accent-primary, #4f8ef7)",
    };

    const selfParticipantTagStyle = {
      background: "rgba(79, 142, 247, 0.14)",
      borderRadius: 7,
      color: "var(--dsw-alias-accent-primary, #4f8ef7)",
      flexShrink: 0,
      fontSize: 9,
      fontWeight: 700,
      padding: "1px 5px",
      whiteSpace: "nowrap",
    };

    const seatSecStyle = {
      background: "var(--dsw-alias-bg-layer-2)",
      borderTop: "0.5px solid var(--dsw-alias-border-l2)",
      display: "flex",
      flexShrink: 0,
      flexDirection: "column",
      gap: 7,
      maxHeight: 216,
      overflowY: "auto",
      padding: "8px 10px 10px",
    };

    const seatRowStyle = {
      alignItems: "flex-start",
      background: "var(--dsw-alias-bg-layer-3)",
      border: "0.5px solid var(--dsw-alias-border-l2)",
      borderRadius: 7,
      display: "grid",
      gap: 6,
      gridTemplateColumns: "auto minmax(0, 1fr)",
      opacity: 1,
      padding: "7px 8px",
    };

    const seatLabelStyle = {
      color: "var(--dsw-alias-label-primary)",
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.35,
      overflowWrap: "anywhere",
    };

    const seatMetaStyle = {
      color: "var(--dsw-alias-label-tertiary)",
      fontSize: 10,
      lineHeight: 1.4,
      marginTop: 1,
      overflowWrap: "anywhere",
    };

    const seatActionsStyle = {
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: 5,
      justifyContent: "space-between",
    };

    const checkboxStyle = {
      accentColor: "var(--dsw-alias-accent-primary, #4f8ef7)",
      height: 13,
      margin: 0,
      width: 13,
    };

    const avatarStyle = {
      alignItems: "center",
      borderRadius: "50%",
      color: "#ffffff",
      display: "flex",
      flexShrink: 0,
      fontSize: 8,
      fontWeight: 700,
      height: 18,
      justifyContent: "center",
      width: 18,
    };

    const messagesStyle = {
      display: "flex",
      flex: 1,
      flexDirection: "column",
      gap: 2,
      overflowY: "auto",
      padding: "10px 14px",
    };

    const bubbleOtherStyle = {
      background: "var(--dsw-alias-bg-layer-3)",
      border: "0.5px solid var(--dsw-alias-border-l2)",
      borderRadius: "11px 11px 11px 3px",
      color: "var(--dsw-alias-label-primary)",
      fontSize: 12,
      lineHeight: 1.5,
      maxWidth: "100%",
      overflowWrap: "break-word",
      padding: "7px 10px",
    };

    const bubbleSelfStyle = {
      ...bubbleOtherStyle,
      background: "var(--dsw-alias-button-primary-fill)",
      border: 0,
      borderRadius: "11px 11px 3px 11px",
      color: "var(--dsw-alias-label-primary-foreground)",
    };

    const metaStyle = {
      color: "var(--dsw-alias-label-tertiary)",
      fontSize: 9,
      marginTop: 2,
    };

    const agentSecStyle = {
      borderTop: "0.5px solid var(--dsw-alias-border-l2)",
      display: "grid",
      flexShrink: 0,
      gap: 7,
      padding: "7px 14px",
    };

    const agentHeadStyle = {
      alignItems: "center",
      display: "flex",
      gap: 8,
      justifyContent: "space-between",
    };

    const agentLabelStyle = {
      alignItems: "center",
      color: "var(--dsw-alias-label-secondary)",
      display: "flex",
      fontSize: 11,
      fontWeight: 600,
      gap: 5,
    };

    const badgeStyle = {
      borderRadius: 4,
      display: "inline-flex",
      flexShrink: 0,
      fontSize: 9,
      fontWeight: 700,
      padding: "1px 4px",
    };

    const mentionChipStyle = {
      alignItems: "center",
      background: "var(--dsw-alias-bg-layer-3)",
      border: "0.5px solid var(--dsw-alias-border-l3)",
      borderRadius: 5,
      color: "var(--dsw-alias-label-primary)",
      display: "inline-flex",
      fontSize: 10,
      gap: 3,
      padding: "2px 4px",
    };

    const mentionMenuStyle = {
      background: "var(--dsw-alias-bg-layer-2)",
      border: "0.5px solid var(--dsw-alias-border-l2)",
      borderRadius: 6,
      boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
      display: "grid",
      gap: 3,
      maxHeight: 140,
      overflowY: "auto",
      padding: 5,
      position: "absolute",
      right: 10,
      bottom: "calc(100% + 4px)",
      zIndex: 2,
    };

    const inputSecStyle = {
      borderTop: "0.5px solid var(--dsw-alias-border-l2)",
      display: "flex",
      flexShrink: 0,
      gap: 5,
      padding: "7px 10px",
    };

    const msgInputStyle = {
      ...inputStyle,
      borderRadius: 7,
      flex: 1,
      fontSize: 12,
      maxHeight: 80,
      minHeight: 32,
      resize: "none",
    };

    const sendBtnStyle = {
      alignItems: "center",
      background: "var(--dsw-alias-button-primary-fill)",
      border: 0,
      borderRadius: 7,
      color: "var(--dsw-alias-label-primary-foreground)",
      cursor: "pointer",
      display: "flex",
      flexShrink: 0,
      height: 32,
      justifyContent: "center",
      width: 32,
    };

    const actionBarStyle = {
      alignItems: "center",
      borderTop: "0.5px solid var(--dsw-alias-border-l2)",
      display: "flex",
      flexShrink: 0,
      flexWrap: "wrap",
      gap: 5,
      padding: "5px 14px",
    };

    const hintStyle = {
      color: "var(--dsw-alias-label-tertiary)",
      flex: 1,
      fontSize: 10,
    };

    const infoPopStyle = {
      background: "var(--dsw-alias-bg-layer-3)",
      border: "0.5px solid var(--dsw-alias-border-l2)",
      borderRadius: 5,
      display: "grid",
      fontSize: 11,
      gap: 3,
      padding: "8px 10px",
    };

    const infoRowStyle = {
      alignItems: "center",
      display: "flex",
      gap: 8,
      justifyContent: "space-between",
      minWidth: 0,
    };

    /* ── icons ── */

    function InfoCircle() {
      return jsxRuntime.jsxs("svg", {
        "aria-hidden": true,
        fill: "none",
        height: 15,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 1.8,
        viewBox: "0 0 24 24",
        width: 15,
        children: [
          jsxRuntime.jsx("circle", { cx: 12, cy: 12, r: 9 }),
          jsxRuntime.jsx("path", { d: "M12 11v5" }),
          jsxRuntime.jsx("path", { d: "M12 8h.01" }),
        ],
      });
    }

    function CloseIcon() {
      return jsxRuntime.jsxs("svg", {
        "aria-hidden": true,
        fill: "none",
        height: 15,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 1.8,
        viewBox: "0 0 24 24",
        width: 15,
        children: [
          jsxRuntime.jsx("path", { d: "M18 6 6 18" }),
          jsxRuntime.jsx("path", { d: "M6 6l12 12" }),
        ],
      });
    }

    function BackIcon() {
      return jsxRuntime.jsxs("svg", {
        "aria-hidden": true,
        fill: "none",
        height: 15,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 1.8,
        viewBox: "0 0 24 24",
        width: 15,
        children: [
          jsxRuntime.jsx("path", { d: "M19 12H5" }),
          jsxRuntime.jsx("path", { d: "M12 19l-7-7 7-7" }),
        ],
      });
    }

    function SendIcon() {
      return jsxRuntime.jsxs("svg", {
        "aria-hidden": true,
        fill: "none",
        height: 14,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 1.8,
        viewBox: "0 0 24 24",
        width: 14,
        children: [
          jsxRuntime.jsx("path", { d: "m22 2-7 20-4-9-9-4Z" }),
          jsxRuntime.jsx("path", { d: "M22 2 11 13" }),
        ],
      });
    }

    function BotIcon() {
      return jsxRuntime.jsxs("svg", {
        "aria-hidden": true,
        fill: "none",
        height: 13,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 1.8,
        viewBox: "0 0 24 24",
        width: 13,
        children: [
          jsxRuntime.jsx("rect", { height: 16, rx: 2, width: 16, x: 4, y: 4 }),
          jsxRuntime.jsx("path", { d: "M9 9h.01" }),
          jsxRuntime.jsx("path", { d: "M15 9h.01" }),
          jsxRuntime.jsx("path", { d: "M8 14s1 2 4 2 4-2 4-2" }),
        ],
      });
    }

    function CopyIcon() {
      return jsxRuntime.jsxs("svg", {
        "aria-hidden": true,
        fill: "none",
        height: 12,
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 1.8,
        viewBox: "0 0 24 24",
        width: 12,
        children: [
          jsxRuntime.jsx("rect", { height: 12, rx: 2, width: 12, x: 9, y: 9 }),
          jsxRuntime.jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }),
        ],
      });
    }

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
      const path = workspace.path?.trim();
      if (title && path) return `${title} (${path})`;
      if (title) return title;
      if (path) return path;
      return `未知工作区 (${workspace.id.slice(0, 8)})`;
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

    /* ── meeting panel (shell.overlay slot) ── */

    const typedMentionIds = (text, participants = []) => {
      const ids = new Set();
      if (!text.includes("@")) return ids;
      const haystack = text.toLowerCase();
      for (let at = haystack.indexOf("@"); at >= 0; at = haystack.indexOf("@", at + 1)) {
        let matched;
        for (const participant of participants) {
          if (participant.status !== "active") continue;
          const displayName = participant.displayName ?? "";
          const candidates = new Set([
            displayName,
            displayName.split("·")[0].trim(),
          ]);
          for (const candidate of candidates) {
            const needle = candidate.toLowerCase();
            if (needle.length > 0 && haystack.startsWith(needle, at + 1)) {
              if (matched === undefined || needle.length > matched.needle.length) {
                matched = { id: participant.id, needle };
              }
            }
          }
        }
        if (matched !== undefined) ids.add(matched.id);
      }
      return ids;
    };

    const mentionTokenAt = (text, caret = text.length) => {
      for (let index = Math.min(caret, text.length) - 1; index >= 0; index -= 1) {
        const char = text[index];
        if (/\s/.test(char)) return undefined;
        if (char !== "@") continue;
        if (index > 0 && !/\s/.test(text[index - 1])) return undefined;
        return { from: index, end: caret, query: text.slice(index + 1, caret) };
      }
      return undefined;
    };

    const mentionInsertName = (participant) =>
      (participant.displayName ?? "").split("·")[0].trim() ||
      participant.displayName ||
      participant.id;

    const markdownBlockStyle = {
      color: "inherit",
      display: "grid",
      fontSize: "inherit",
      gap: 5,
      lineHeight: "inherit",
      minWidth: 0,
    };

    const markdownParagraphStyle = {
      margin: 0,
      overflowWrap: "anywhere",
      whiteSpace: "pre-wrap",
    };

    const markdownCodeStyle = {
      background: "rgba(127, 127, 127, 0.16)",
      borderRadius: 3,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.92em",
      overflowWrap: "anywhere",
      padding: "1px 4px",
    };

    const markdownPreStyle = {
      background: "rgba(127, 127, 127, 0.14)",
      border: "0.5px solid rgba(127, 127, 127, 0.24)",
      borderRadius: 5,
      margin: 0,
      overflowX: "auto",
      padding: "6px 8px",
    };

    const markdownQuoteStyle = {
      borderLeft: "2px solid rgba(127, 127, 127, 0.44)",
      color: "inherit",
      margin: 0,
      opacity: 0.88,
      paddingLeft: 8,
    };

    const markdownListStyle = {
      margin: 0,
      overflowWrap: "anywhere",
      paddingLeft: 17,
    };

    function safeMarkdownLink(href) {
      try {
        const url = new URL(href);
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
      } catch {
        return null;
      }
    }

    function renderInlineMarkdown(text) {
      const nodes = [];
      const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
      let cursor = 0;
      let match = pattern.exec(text);
      let index = 0;

      while (match !== null) {
        if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
        const token = match[0];
        if (token.startsWith("`")) {
          nodes.push(jsxRuntime.jsx("code", { style: markdownCodeStyle, children: token.slice(1, -1) }, `code-${index}`));
        } else if (token.startsWith("**") || token.startsWith("__")) {
          nodes.push(jsxRuntime.jsx("strong", { children: token.slice(2, -2) }, `strong-${index}`));
        } else if (token.startsWith("~~")) {
          nodes.push(jsxRuntime.jsx("del", { children: token.slice(2, -2) }, `del-${index}`));
        } else if (token.startsWith("[")) {
          const separator = token.lastIndexOf("](");
          const label = token.slice(1, separator);
          const href = token.slice(separator + 2, -1);
          const safeHref = safeMarkdownLink(href);
          nodes.push(safeHref === null
            ? label
            : jsxRuntime.jsx("a", {
                href: safeHref,
                rel: "noopener noreferrer",
                target: "_blank",
                children: label,
              }, `link-${index}`));
        } else {
          nodes.push(jsxRuntime.jsx("em", { children: token.slice(1, -1) }, `em-${index}`));
        }
        cursor = match.index + token.length;
        index += 1;
        match = pattern.exec(text);
      }

      if (cursor < text.length) nodes.push(text.slice(cursor));
      return nodes;
    }

    function renderMarkdownParagraph(lines) {
      return jsxRuntime.jsx("p", {
        style: markdownParagraphStyle,
        children: lines.flatMap((line, index) => index === 0
          ? renderInlineMarkdown(line)
          : [jsxRuntime.jsx("br", {}, `line-${index}`), ...renderInlineMarkdown(line)]),
      });
    }

    function renderMarkdown(content) {
      const lines = String(content ?? "").split(/\r?\n/);
      const blocks = [];
      let index = 0;

      while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === "") {
          index += 1;
          continue;
        }

        const codeFence = line.match(/^```(.*)$/);
        if (codeFence !== null) {
          const codeLines = [];
          index += 1;
          while (index < lines.length && !/^```\s*$/.test(lines[index])) {
            codeLines.push(lines[index]);
            index += 1;
          }
          index += 1;
          blocks.push(jsxRuntime.jsx("pre", {
            style: markdownPreStyle,
            children: jsxRuntime.jsx("code", {
              style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, whiteSpace: "pre" },
              children: codeLines.join("\n"),
            }),
          }, `pre-${blocks.length}`));
          continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
        if (heading !== null) {
          const level = heading[1].length;
          blocks.push(jsxRuntime.jsx("div", {
            style: {
              fontWeight: 700,
              fontSize: level <= 1 ? 14 : level === 2 ? 13 : 12,
              lineHeight: 1.4,
              margin: "2px 0 0",
            },
            children: renderInlineMarkdown(heading[2]),
          }, `heading-${blocks.length}`));
          index += 1;
          continue;
        }

        const quote = line.match(/^>\s?(.*)$/);
        if (quote !== null) {
          const quoteLines = [quote[1]];
          index += 1;
          while (index < lines.length) {
            const nextQuote = lines[index].match(/^>\s?(.*)$/);
            if (nextQuote === null) break;
            quoteLines.push(nextQuote[1]);
            index += 1;
          }
          blocks.push(jsxRuntime.jsx("blockquote", {
            style: markdownQuoteStyle,
            children: renderMarkdownParagraph(quoteLines),
          }, `quote-${blocks.length}`));
          continue;
        }

        const unordered = line.match(/^\s*[-*]\s+(.*)$/);
        if (unordered !== null) {
          const items = [];
          while (index < lines.length) {
            const item = lines[index].match(/^\s*[-*]\s+(.*)$/);
            if (item === null) break;
            items.push(item[1]);
            index += 1;
          }
          blocks.push(jsxRuntime.jsx("ul", {
            style: markdownListStyle,
            children: items.map((item, itemIndex) => jsxRuntime.jsx("li", {
              children: renderInlineMarkdown(item),
            }, `ul-${itemIndex}`)),
          }, `ul-block-${blocks.length}`));
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
          blocks.push(jsxRuntime.jsx("ol", {
            style: markdownListStyle,
            children: items.map((item, itemIndex) => jsxRuntime.jsx("li", {
              children: renderInlineMarkdown(item),
            }, `ol-${itemIndex}`)),
          }, `ol-block-${blocks.length}`));
          continue;
        }

        const paragraphLines = [];
        while (index < lines.length && lines[index].trim() !== "" &&
          !lines[index].startsWith("```") &&
          !/^(#{1,6})\s+/.test(lines[index]) &&
          !/^>\s?/.test(lines[index]) &&
          !/^\s*[-*]\s+/.test(lines[index]) &&
          !/^\s*\d+[.)]\s+/.test(lines[index])) {
          paragraphLines.push(lines[index]);
          index += 1;
        }
        if (paragraphLines.length > 0) {
          blocks.push(renderMarkdownParagraph(paragraphLines));
        }
      }

      return jsxRuntime.jsx("div", { style: markdownBlockStyle, children: blocks });
    }

    const MeetingPanel = () => {
      const open = usePanelOpen();

      const [view, setView] = react.useState("list");
      const [phase, setPhase] = react.useState("loading");
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");

      const [workspaces, setWorkspaces] = react.useState([]);
      const [workspaceId, setWorkspaceId] = react.useState("");
      const [wsInfoOpen, setWsInfoOpen] = react.useState(false);
      const [accountName, setAccountName] = react.useState("");

      const [meetings, setMeetings] = react.useState([]);
      const [meetingId, setMeetingId] = react.useState("");
      const [detail, setDetail] = react.useState(null);

      const [createOpen, setCreateOpen] = react.useState(false);
      const [newTitle, setNewTitle] = react.useState("");
      const [newAgenda, setNewAgenda] = react.useState("");
      const [content, setContent] = react.useState("");
      const [summary, setSummary] = react.useState("");
      const [summaryOpen, setSummaryOpen] = react.useState(false);

      const [agentOpen, setAgentOpen] = react.useState(false);
      const [personas, setPersonas] = react.useState([]);
      const [personaId, setPersonaId] = react.useState("");
      const [teammates, setTeammates] = react.useState([]);
      const [teammateId, setTeammateId] = react.useState("");
      const [agentBusy, setAgentBusy] = react.useState(false);
      const [delegationNoticeBusy, setDelegationNoticeBusy] = react.useState("");
      const [autoSpeak, setAutoSpeak] = react.useState("mentions");
      const [initialGreeting, setInitialGreeting] = react.useState(true);
      const [avatarNickname, setAvatarNickname] = react.useState("");
      const [mentionIds, setMentionIds] = react.useState(() => new Set());
      const [mentionOpen, setMentionOpen] = react.useState(false);
      const [mentionCaret, setMentionCaret] = react.useState(0);
      const [participantsOpen, setParticipantsOpen] = react.useState(true);
      const [removingParticipantId, setRemovingParticipantId] = react.useState("");

      const [seatOpen, setSeatOpen] = react.useState(false);
      const [seats, setSeats] = react.useState([]);
      const [selectedSeatIds, setSelectedSeatIds] = react.useState(() => new Set());
      const [seatBusy, setSeatBusy] = react.useState(false);
      const [people, setPeople] = react.useState([]);
      const [selectedPeople, setSelectedPeople] = react.useState(() => new Set());
      const [peopleSeatIds, setPeopleSeatIds] = react.useState({});
      const [editingSeat, setEditingSeat] = react.useState(false);
      const [editingSeatFor, setEditingSeatFor] = react.useState("");
      const [seatIdDraft, setSeatIdDraft] = react.useState("");
      const [seatManageOpen, setSeatManageOpen] = react.useState(false);
      const [newSeatLabel, setNewSeatLabel] = react.useState("");
      const [editingSeatDefinitionId, setEditingSeatDefinitionId] = react.useState("");
      const [seatDefinitionDraft, setSeatDefinitionDraft] = react.useState("");

      const loadingDataRef = react.useRef(false);
      const messagesRef = react.useRef(null);
      const messageInputRef = react.useRef(null);

      const notify = (text) => { setError(""); setNotice(text); };
      const fail = (cause) => { setNotice(""); setError(cause instanceof Error ? cause.message : String(cause)); };

      const currentWs = workspaces.find((ws) => ws.id === workspaceId);
      const active = detail?.meeting?.status === "active";
      const myExpiredAvatars = (detail?.participants ?? []).filter((p) =>
        p.kind === "agent" && p.ownerId === detail?.actorId && p.delegationStatus === "expired",
      );
      const typedIds = typedMentionIds(content, detail?.participants);
      const mentionToken = mentionTokenAt(content, mentionCaret);
      const mentionOptions = (detail?.participants ?? [])
        .filter((p) => p.status === "active" && p.refId !== detail.actorId)
        .filter((p) => {
          if (!mentionToken || mentionToken.query === "") return true;
          const label = mentionInsertName(p).toLowerCase();
          return label.includes(mentionToken.query.toLowerCase());
        });
      const activeOthers = (detail?.participants ?? []).filter(
        (p) => p.status === "active" && p.refId !== detail.actorId,
      );
      const isMentioningAll =
        activeOthers.length > 0 &&
        activeOthers.every((p) => mentionIds.has(p.id));
      const selectAllMentions = () => {
        setMentionIds(new Set(activeOthers.map((p) => p.id)));
        setMentionOpen(false);
      };
      const clearAllMentions = () => {
        setMentionIds(new Set());
      };
      const myParticipant = detail?.participants?.find(
        (p) => p.kind === "human" && p.status === "active" && p.refId === detail.actorId,
      );
      const joined = myParticipant !== undefined;
      const isLeader = myParticipant?.leader === true;
      const participantById = new Map(
        (detail?.participants ?? []).map((p) => [p.id, p.displayName ?? p.id]),
      );
      const personaNameById = new Map(
        personas.map((persona) => [persona.id, persona.name ?? persona.id]),
      );
      const senderParticipantFor = (message) =>
        (detail?.participants ?? []).find(
          (participant) =>
            participant.kind === message.senderKind &&
            participant.refId === message.senderId,
        );
      const agentIdentity = (message) => {
        const participant = senderParticipantFor(message);
        const persona = participant?.personaId === undefined
          ? undefined
          : personaNameById.get(participant.personaId) ?? participant.personaId;
        if (
          participant?.source === "spawned" ||
          participant?.ownerName !== undefined
        ) {
          const owner = participant?.ownerName ?? "未标明 owner";
          return {
            header: `AI 分身 · ${message.senderName} · ${owner} 的分身`,
            metaPrefix: `${owner} 的分身 · `,
          };
        }
        return {
          header: [
            `数字员工 · ${message.senderName}`,
            persona === undefined ? "" : ` · 角色 ${persona}`,
            participant?.seatId === undefined ? "" : ` · 席位 ${participant.seatId}`,
          ].join(""),
          metaPrefix: "数字员工 · ",
        };
      };
      const meetingSeats = detail?.meeting?.seats ?? [];
      const canManageSeats = detail?.canManageSeats === true;
      const humanSeatOptions = [
        ...meetingSeats.map((seat) => ({
          value: `seat:${seat.id}`,
          label: seat.label,
          meetingSeat: true,
        })),
        ...seats
          .filter((seat) => seat.participantKind !== "agent")
          .map((seat) => ({
            value: `seat:${seat.seatId}`,
            label: `${seat.label}（工作区）`,
            meetingSeat: false,
          })),
      ];
      const usedSeatValues = new Set(
        (detail?.participants ?? [])
          .filter((p) => p.kind === "human" && p.status !== "left")
          .flatMap((p) => {
            if (p.seatId !== undefined) return [`seat:${p.seatId}`];
            if (p.seatLabel === undefined) return [];
            return [
              `label:${p.seatLabel}`,
              ...humanSeatOptions
                .filter((seat) => seat.label === p.seatLabel)
                .map((seat) => seat.value),
            ];
          })
        );
      const mySeatValue = myParticipant?.seatId !== undefined
        ? `seat:${myParticipant.seatId}`
          : myParticipant?.seatLabel !== undefined &&
              humanSeatOptions.some((seat) => seat.label === myParticipant.seatLabel)
            ? humanSeatOptions.find((seat) => seat.label === myParticipant.seatLabel)?.value ?? ""
            : myParticipant?.seatLabel !== undefined
              ? `label:${myParticipant.seatLabel}`
              : "";
      const ownSeatOptions = [
        { value: "", label: "不指定席位", disabled: false },
        ...humanSeatOptions,
        ...(myParticipant?.seatLabel !== undefined &&
        !humanSeatOptions.some((seat) => seat.label === myParticipant.seatLabel)
          ? [{
              value: `label:${myParticipant.seatLabel}`,
              label: `${myParticipant.seatLabel}（当前）`,
              disabled: false,
            }]
          : []),
      ].map((choice) => ({
        ...choice,
        disabled: choice.value !== "" &&
          choice.value !== mySeatValue &&
          usedSeatValues.has(choice.value),
      }));

      /* load workspaces when panel opens */
      react.useEffect(() => {
        if (!open) return;
        let disposed = false;
        (async () => {
          if (getToken() === null) { setPhase("login"); return; }
          try {
            const [result, me] = await Promise.all([
              request("/api/collab/team/workspaces"),
              request("/api/collab/auth/me"),
            ]);
            if (disposed) return;
            const list = result.workspaces ?? [];
            setAccountName(me.user?.name ?? "");
            setWorkspaces(list);
            setWorkspaceId((cur) => {
              if (cur !== "" && list.find((ws) => ws.id === cur)?.isMember) return cur;
              return list.find((ws) => ws.isMember)?.id ?? list[0]?.id ?? "";
            });
            setPhase("ready");
          } catch (cause) {
            if (!disposed) { fail(cause); setPhase("error"); }
          }
        })();
        return () => { disposed = true; };
      }, [open]);

      react.useEffect(() => {
        const navigate = (event) => {
          const target = event.detail ?? {};
          if (target.plugin !== "meeting" || !target.meetingId) return;
          if (target.workspaceId) setWorkspaceId(target.workspaceId);
          setView("chat");
          setMeetingId(target.meetingId);
          store.openPanel();
        };
        window.addEventListener("pluginmax:collab-navigate", navigate);
        return () => window.removeEventListener("pluginmax:collab-navigate", navigate);
      }, []);

      /* load meetings + detail; silent polling keeps conversations current */
      const load = react.useCallback(async (silent = false) => {
        if (workspaceId === "") return;
        if (loadingDataRef.current) return;
        loadingDataRef.current = true;
        try {
          const listResult = await request(
            `/api/collab/meetings?workspaceId=${encodeURIComponent(workspaceId)}`,
          );
          setMeetings(listResult.meetings ?? []);
          if (meetingId === "") { setDetail(null); return; }
          const detailResult = await request(
            `/api/collab/meeting?meetingId=${encodeURIComponent(meetingId)}`,
          );
          setDetail(detailResult);
        } catch (cause) {
          if (cause.status === 401) setPhase("login");
          if (!silent) fail(cause);
        }
        finally { loadingDataRef.current = false; }
      }, [meetingId, workspaceId]);

      react.useEffect(() => {
        if (!open || phase !== "ready") return;
        load();
        const interval = setInterval(() => {
          if (document.visibilityState === "visible") load(view === "chat");
        }, view === "chat" ? 2500 : 8000);
        return () => clearInterval(interval);
      }, [load, open, phase, view]);

      react.useEffect(() => {
        if (view !== "chat") return;
        messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
      }, [detail?.transcript?.length, view]);

      react.useEffect(() => {
        if (!active || !joined || meetingId === "") return;
        let disposed = false;
        (async () => {
          try {
            const result = await request(
              `/api/collab/meeting/seats?meetingId=${encodeURIComponent(meetingId)}`,
            );
            if (!disposed) setSeats(result.seats ?? []);
          } catch {
            if (!disposed) setSeats([]);
          }
        })();
        return () => { disposed = true; };
      }, [active, joined, meetingId]);

      react.useEffect(() => {
        setMentionIds(new Set());
        setMentionOpen(false);
        setPeople([]);
        setSelectedPeople(new Set());
        setPeopleSeatIds({});
        setEditingSeat(false);
        setSeatIdDraft("");
        setSeatManageOpen(false);
        setNewSeatLabel("");
        setEditingSeatDefinitionId("");
        setSeatDefinitionDraft("");
      }, [meetingId]);

      /* load personas for agent dispatch */
      react.useEffect(() => {
        if (!agentOpen || workspaceId === "") return;
        let disposed = false;
        (async () => {
          try {
            const result = await request(
              `/api/collab/roles/personas?workspaceId=${encodeURIComponent(workspaceId)}`,
            );
            if (!disposed) setPersonas(result.personas ?? []);
          } catch { setPersonas([]); }
          try {
            const result = await request("/api/collab/teammates");
            if (!disposed) {
              setTeammates(
                (result.teammates ?? []).filter(
                  (item) => item.state === "active",
                ),
              );
            }
          } catch { setTeammates([]); }
        })();
        return () => { disposed = true; };
      }, [agentOpen, workspaceId]);

      const submitMeeting = async (event) => {
        event.preventDefault();
        try {
          const result = await request("/api/collab/meetings", {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              title: newTitle,
              agenda: newAgenda,
            }),
          });
          setMeetingId(result.meeting.id);
          setNewTitle("");
          setNewAgenda("");
          setCreateOpen(false);
          setView("chat");
          notify(`已创建「${result.meeting.title}」`);
          await load();
        } catch (cause) { fail(cause); }
      };

      const action = async (path, body, text) => {
        if (meetingId === "") return;
        try {
          await request(path, {
            method: "POST",
            body: JSON.stringify({ meetingId, ...body }),
          });
          notify(text);
          await load();
        } catch (cause) { fail(cause); }
      };

      const sendMessage = async (event) => {
        event.preventDefault();
        if (content.trim() === "") return;
        const text = content;
        const mentions = [...new Set([...mentionIds, ...typedIds])];
        setContent("");
        await action("/api/collab/meeting/message", {
          content: text,
          mentions,
        }, "已发送");
        setMentionIds(new Set());
        setMentionOpen(false);
      };

      const syncMentionCaret = (element) => {
        setMentionCaret(element.selectionStart ?? element.value.length);
      };

      const changeMessage = (event) => {
        const next = event.target.value;
        const caret = event.target.selectionStart ?? next.length;
        setContent(next);
        setMentionCaret(caret);
        setMentionOpen(mentionTokenAt(next, caret) !== undefined);
      };

      const selectMention = (participant) => {
        const name = mentionInsertName(participant);
        const before = mentionToken
          ? content.slice(0, mentionToken.from)
          : content.trimEnd() === "" ? "" : `${content.trimEnd()} `;
        const after = mentionToken ? content.slice(mentionToken.end) : "";
        const next = `${before}@${name} ${after}`;
        const caret = before.length + name.length + 2;
        setContent(next);
        setMentionCaret(caret);
        setMentionIds((cur) => new Set(cur).add(participant.id));
        setMentionOpen(false);
        requestAnimationFrame(() => {
          const element = messageInputRef.current;
          if (element === null) return;
          element.focus();
          element.setSelectionRange(caret, caret);
        });
      };

      const dispatchAgent = async () => {
        if ((personaId === "" && teammateId === "") || meetingId === "" || agentBusy) return;
        const persona = personas.find((p) => p.id === personaId);
        const teammate = teammates.find((item) => item.id === teammateId);
        setAgentBusy(true);
        try {
          await request("/api/collab/meeting/agent/dispatch", {
            method: "POST",
            body: JSON.stringify({
              meetingId,
              ...(teammateId === ""
                ? { personaId }
                : {
                    teammateId,
                    teammateName: teammate?.name ?? teammateId,
                  }),
              ...(avatarNickname.trim() !== "" ? { displayName: avatarNickname.trim() } : {}),
              autoSpeak,
              initialGreeting,
            }),
          });
          notify(`已派遣分身「${teammate?.name ?? persona?.name ?? personaId}」`);
          setAvatarNickname("");
          await load();
        } catch (cause) { fail(cause); }
        finally { setAgentBusy(false); }
      };

      const triggerAgent = async (participant) => {
        try {
          await request("/api/collab/meeting/agent/trigger", {
            method: "POST",
            body: JSON.stringify({ meetingId, participantId: participant.id }),
          });
          notify(`已触发「${participant.displayName}」`);
          await load();
        } catch (cause) { fail(cause); }
      };

      const resumeExpiredAvatar = async (participant) => {
        if (!participant.delegationId || delegationNoticeBusy !== "") return;
        setDelegationNoticeBusy(participant.id);
        try {
          await request("/api/collab/delegation/status", {
            method: "POST",
            body: JSON.stringify({ delegationId: participant.delegationId, status: "active" }),
          });
          notify(`已恢复「${participant.displayName}」的委托`);
          await load(true);
        } catch (cause) { fail(cause); }
        finally { setDelegationNoticeBusy(""); }
      };

      const extendExpiredAvatar = async (participant) => {
        if (!participant.delegationId || delegationNoticeBusy !== "") return;
        const value = window.prompt("延长多少分钟？", "30");
        const minutes = Number(value);
        if (!Number.isInteger(minutes) || minutes <= 0) return;
        setDelegationNoticeBusy(participant.id);
        try {
          await request("/api/collab/delegation/extend", {
            method: "POST",
            body: JSON.stringify({ delegationId: participant.delegationId, durationMinutes: minutes }),
          });
          notify(`已延期并恢复「${participant.displayName}」`);
          await load(true);
        } catch (cause) { fail(cause); }
        finally { setDelegationNoticeBusy(""); }
      };

      const removeParticipant = async (participant) => {
        if (removingParticipantId !== "") return;
        if (!window.confirm(`将「${participant.displayName ?? participant.id}」移出会议？`)) return;
        setRemovingParticipantId(participant.id);
        try {
          await request("/api/collab/meeting/participant/remove", {
            method: "POST",
            body: JSON.stringify({
              meetingId,
              participantId: participant.id,
            }),
          });
          notify(`已移出「${participant.displayName ?? participant.id}」`);
          await load();
        } catch (cause) { fail(cause); }
        finally { setRemovingParticipantId(""); }
      };

      const openSeatPicker = async () => {
        setSeatOpen(true);
        setSeatBusy(true);
        try {
          const [peopleResult, seatResult] = await Promise.allSettled([
            request(`/api/collab/meeting/people?meetingId=${encodeURIComponent(meetingId)}`),
            request(`/api/collab/meeting/seats?meetingId=${encodeURIComponent(meetingId)}`),
          ]);
          if (peopleResult.status === "rejected") throw peopleResult.reason;
          setPeople(peopleResult.value.people ?? []);
          setSeats(seatResult.status === "fulfilled" ? seatResult.value.seats ?? [] : []);
          setSelectedSeatIds(new Set());
          setPeopleSeatIds({});
        } catch (cause) {
          fail(cause);
        } finally {
          setSeatBusy(false);
        }
      };

      const togglePerson = (personId) => {
        setSelectedPeople((current) => {
          const next = new Set(current);
          if (next.has(personId)) next.delete(personId);
          else next.add(personId);
          return next;
        });
      };

      const setPersonSeatId = (personId, seatValue) => {
        setPeopleSeatIds((current) => ({ ...current, [personId]: seatValue }));
      };

      const inviteSelectedPeople = async () => {
        if (selectedPeople.size === 0 || seatBusy) return;
        const chosenSeatValues = [...selectedPeople]
          .map((personId) => peopleSeatIds[personId] ?? "")
          .filter((value) => value !== "");
        if (new Set(chosenSeatValues).size !== chosenSeatValues.length) {
          fail(new Error("不同成员不能选择同一个席位"));
          return;
        }
        const selected = people
          .filter((person) => selectedPeople.has(person.id))
          .map((person) => {
            const seatValue = peopleSeatIds[person.id] ?? "";
            if (!seatValue.startsWith("seat:")) {
              return { targetId: person.id };
            }
            const meetingSeat = meetingSeats.find((candidate) => `seat:${candidate.id}` === seatValue);
            const workspaceSeat = seats.find((candidate) => `seat:${candidate.seatId}` === seatValue);
            const seatLabel = meetingSeat?.label ?? workspaceSeat?.label;
            return {
              targetId: person.id,
              ...(seatLabel === undefined ? {} : { seatLabel }),
              ...(meetingSeat === undefined ? {} : { seatId: meetingSeat.id }),
            };
          });
        setSeatBusy(true);
        try {
          await request("/api/collab/meeting/participants/invite", {
            method: "POST",
            body: JSON.stringify({ meetingId, people: selected }),
          });
          notify(`已拉入 ${selected.length} 位成员`);
          setSeatOpen(false);
          setSelectedPeople(new Set());
          setPeopleSeatIds({});
          await load();
        } catch (cause) {
          fail(cause);
        } finally {
          setSeatBusy(false);
        }
      };

      const openSeatEditor = (participantId) => {
        setEditingSeatFor(participantId ?? "");
        setSeatIdDraft(mySeatValue);
        setEditingSeat(true);
      };

      const saveOwnSeat = async (event) => {
        event.preventDefault();
        if (seatBusy) return;
        const seatValue = seatIdDraft;
        let nextSeatLabel;
        if (seatValue.startsWith("seat:")) {
          const meetingSeat = meetingSeats.find((candidate) => `seat:${candidate.id}` === seatValue);
          const workspaceSeat = seats.find((candidate) => `seat:${candidate.seatId}` === seatValue);
          const seat = meetingSeat === undefined
            ? workspaceSeat
            : { label: meetingSeat.label };
          if (seat === undefined) {
            fail(new Error("所选席位不存在，请重新打开后重试"));
            return;
          }
          nextSeatLabel = seat.label;
        } else if (seatValue.startsWith("label:")) {
          nextSeatLabel = seatValue.slice("label:".length);
        }
        setSeatBusy(true);
        try {
          await request("/api/collab/meeting/participant/change-seat", {
            method: "POST",
            body: JSON.stringify({
              meetingId,
              ...(editingSeatFor !== "" ? { participantId: editingSeatFor } : {}),
              seatLabel: nextSeatLabel,
              ...(meetingSeats.some((candidate) => `seat:${candidate.id}` === seatValue)
                ? { seatId: seatValue.slice("seat:".length) }
                : {}),
            }),
          });
          notify(nextSeatLabel === undefined ? "已设为不指定席位" : "已更新席位");
          setEditingSeat(false);
          await load();
        } catch (cause) {
          fail(cause);
        } finally {
          setSeatBusy(false);
        }
      };

      const createManagedSeat = async (event) => {
        event.preventDefault();
        if (!canManageSeats || seatBusy || newSeatLabel.trim() === "") return;
        setSeatBusy(true);
        try {
          await request("/api/collab/meeting/seats/manage", {
            method: "POST",
            body: JSON.stringify({ meetingId, label: newSeatLabel.trim() }),
          });
          notify("已新增会议席位");
          setNewSeatLabel("");
          await load();
        } catch (cause) {
          fail(cause);
        } finally {
          setSeatBusy(false);
        }
      };

      const renameManagedSeat = async (seat) => {
        if (!canManageSeats || seatBusy || seatDefinitionDraft.trim() === "") return;
        setSeatBusy(true);
        try {
          await request("/api/collab/meeting/seats/manage", {
            method: "PATCH",
            body: JSON.stringify({
              meetingId,
              seatId: seat.id,
              label: seatDefinitionDraft.trim(),
            }),
          });
          notify("已更新会议席位");
          setEditingSeatDefinitionId("");
          setSeatDefinitionDraft("");
          await load();
        } catch (cause) {
          fail(cause);
        } finally {
          setSeatBusy(false);
        }
      };

      const removeManagedSeat = async (seat) => {
        if (!canManageSeats || seatBusy) return;
        if (!window.confirm(`删除席位「${seat.label}」？已占用该席位的成员会改为未设置席位。`)) return;
        setSeatBusy(true);
        try {
          await request("/api/collab/meeting/seats/manage", {
            method: "DELETE",
            body: JSON.stringify({ meetingId, seatId: seat.id }),
          });
          notify("已删除会议席位");
          await load();
        } catch (cause) {
          fail(cause);
        } finally {
          setSeatBusy(false);
        }
      };

      const toggleSeat = (seatId) => {
        setSelectedSeatIds((current) => {
          const next = new Set(current);
          if (next.has(seatId)) next.delete(seatId);
          else next.add(seatId);
          return next;
        });
      };

      const selectAvailableSeats = () => {
        setSelectedSeatIds(new Set(
          seats.filter((seat) => seat.availability === "selectable").map((seat) => seat.seatId),
        ));
      };

      const pullSelectedSeats = async () => {
        if (selectedSeatIds.size === 0 || seatBusy) return;
        setSeatBusy(true);
        try {
          await request("/api/collab/meeting/seats/pull", {
            method: "POST",
            body: JSON.stringify({
              meetingId,
              seatIds: [...selectedSeatIds],
            }),
          });
          notify(`已拉入 ${selectedSeatIds.size} 个席位`);
          setSeatOpen(false);
          setSelectedSeatIds(new Set());
          await load();
        } catch (cause) {
          fail(cause);
        } finally {
          setSeatBusy(false);
        }
      };

      if (!open) return null;

      if (phase === "login") {
        return jsxRuntime.jsx("div", { style: panelRootStyle, children:
          jsxRuntime.jsxs("div", { style: panelStyle, children: [
            jsxRuntime.jsx("div", { style: headerStyle, children: jsxRuntime.jsx("h2", { style: titleStyle, children: "会议" }) }),
            jsxRuntime.jsx("p", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 13, padding: "16px 14px" }, children: "请先在「协作身份」登录。" }),
          ] }),
        });
      }

      /* ── list view ── */
      const listView = jsxRuntime.jsxs(react.Fragment, { children: [
        jsxRuntime.jsxs("div", { style: headerStyle, children: [
          jsxRuntime.jsx("h2", { style: titleStyle, children: "会议" }),
          jsxRuntime.jsx("button", { type: "button", style: iconBtnStyle, "aria-label": "关闭面板", onClick: () => store.close(), children: jsxRuntime.jsx(CloseIcon, {}) }),
        ] }),
        jsxRuntime.jsxs("div", { style: wsBarStyle, children: [
          jsxRuntime.jsxs("div", { style: wsRowStyle, children: [
            jsxRuntime.jsx("span", { style: wsLabelStyle, children: "工作区" }),
            jsxRuntime.jsx("select", {
              style: selectStyle,
              value: workspaceId,
              onChange: (event) => { setWorkspaceId(event.target.value); setMeetingId(""); setView("list"); },
              children: workspaces.map((ws) => jsxRuntime.jsx("option", { value: ws.id, children: workspaceLabel(ws) }, ws.id)),
            }),
            jsxRuntime.jsx("button", { type: "button", style: iconBtnStyle, "aria-label": "工作区信息", onClick: () => setWsInfoOpen(!wsInfoOpen), children: jsxRuntime.jsx(InfoCircle, {}) }),
          ] }),
          wsInfoOpen && currentWs !== undefined ? jsxRuntime.jsxs("div", { style: infoPopStyle, children: [
            jsxRuntime.jsxs("div", { style: infoRowStyle, children: [jsxRuntime.jsx("span", { style: wsLabelStyle, children: "名称" }), jsxRuntime.jsx("span", { style: { overflowWrap: "anywhere" }, children: currentWs.title || "未命名" })] }),
            jsxRuntime.jsxs("div", { style: infoRowStyle, children: [jsxRuntime.jsx("span", { style: wsLabelStyle, children: "路径" }), jsxRuntime.jsx("span", { style: { overflowWrap: "anywhere" }, children: currentWs.path || "未知" })] }),
            jsxRuntime.jsxs("div", { style: infoRowStyle, children: [jsxRuntime.jsx("span", { style: wsLabelStyle, children: "工作区 ID" }), jsxRuntime.jsx("span", { style: { fontSize: 10, overflowWrap: "anywhere" }, children: currentWs.id })] }),
            jsxRuntime.jsxs("button", { type: "button", style: { ...ghostBtnStyle, justifyContent: "center", justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 4 }, onClick: () => { navigator.clipboard.writeText(currentWs.id).then(() => notify("已复制工作区 ID")).catch(fail); }, children: [jsxRuntime.jsx(CopyIcon, {}), "复制 ID"] }),
          ] }) : null,
        ] }),
        jsxRuntime.jsxs("div", { style: createBarStyle, children: [
          jsxRuntime.jsx("button", { type: "button", style: createToggleStyle, onClick: () => setCreateOpen(!createOpen), children: createOpen ? "− 收起" : "+ 新会议" }),
          createOpen ? jsxRuntime.jsxs("form", { style: createFormStyle, onSubmit: submitMeeting, children: [
            jsxRuntime.jsx("input", { style: inputStyle, value: newTitle, onChange: (event) => setNewTitle(event.target.value), placeholder: "会议标题", required: true }),
            jsxRuntime.jsx("textarea", { style: { ...inputStyle, minHeight: 40, resize: "vertical" }, value: newAgenda, onChange: (event) => setNewAgenda(event.target.value), placeholder: "议程（可选）", rows: 2 }),
            jsxRuntime.jsx("button", { type: "submit", style: primaryBtnStyle, children: "创建" }),
          ] }) : null,
        ] }),
        jsxRuntime.jsx("div", { style: listStyle, children:
          meetings.length === 0
            ? jsxRuntime.jsx("p", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, lineHeight: 1.6, padding: "32px 16px", textAlign: "center", whiteSpace: "pre-line" }, children: "当前工作区暂无会议。\n点击上方按钮发起一个。" })
            : meetings.map((item) => jsxRuntime.jsxs("div", {
                style: { ...cardStyle, opacity: item.status === "closed" ? 0.55 : 1 },
                onClick: () => { setMeetingId(item.id); setView("chat"); },
                children: [
                  jsxRuntime.jsx("div", { style: cardTitleStyle, children: item.title }),
                  jsxRuntime.jsxs("div", { style: cardMetaStyle, children: [
                    jsxRuntime.jsx("span", { style: item.status === "active" ? pillOnStyle : pillOffStyle, children: item.status === "active" ? "进行中" : "已关闭" }),
                    item.createdAt !== undefined ? jsxRuntime.jsx("span", { children: timeShort(item.createdAt) }) : null,
                  ] }),
                ],
              }, item.id)),
        }),
      ] });

      /* ── chat view ── */
      const chatView = jsxRuntime.jsxs(react.Fragment, { children: [
        jsxRuntime.jsxs("div", { style: headerStyle, children: [
          jsxRuntime.jsx("button", { type: "button", style: iconBtnStyle, "aria-label": "返回列表", onClick: () => { setView("list"); setMeetingId(""); setDetail(null); }, children: jsxRuntime.jsx(BackIcon, {}) }),
          jsxRuntime.jsx("h2", { style: titleStyle, children: detail?.meeting?.title ?? "…" }),
          detail?.meeting !== undefined ? jsxRuntime.jsx("span", { style: active ? pillOnStyle : pillOffStyle, children: active ? "进行中" : "已关闭" }) : null,
        ] }),
        detail === null
          ? jsxRuntime.jsx("div", { style: { alignItems: "center", color: "var(--dsw-alias-label-tertiary)", display: "grid", flex: 1, fontSize: 12, justifyContent: "center" }, children: "加载中…" })
          : jsxRuntime.jsxs(react.Fragment, { children: [
              myExpiredAvatars.length > 0 ? jsxRuntime.jsx("div", { style: { background: "rgba(226,167,55,0.15)", borderBottom: "0.5px solid rgba(226,167,55,0.35)", color: "var(--dsw-alias-label-primary)", display: "grid", flexShrink: 0, fontSize: 12, gap: 8, padding: "8px 14px" }, children:
                myExpiredAvatars.map((participant) => jsxRuntime.jsxs("div", { style: { display: "grid", gap: 6 }, children: [
                  jsxRuntime.jsxs("div", { children: [
                    jsxRuntime.jsx("strong", { children: `「${participant.displayName}」已到期。` }),
                    " 本会议的自动发言已暂停，需要你跟进、延期恢复，或另派分身接手。",
                  ] }),
                  jsxRuntime.jsxs("div", { style: { display: "flex", gap: 5 }, children: [
                    jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, disabled: delegationNoticeBusy !== "", onClick: () => extendExpiredAvatar(participant), children: delegationNoticeBusy === participant.id ? "处理中…" : "延期并恢复" }),
                    jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, disabled: delegationNoticeBusy !== "", onClick: () => resumeExpiredAvatar(participant), children: "恢复" }),
                  ] }),
                ] }, participant.id)) }) : null,
              jsxRuntime.jsxs("div", { style: participantsStyle, children: [
                jsxRuntime.jsxs("button", {
                  type: "button",
                  style: participantHeadStyle,
                  "aria-expanded": participantsOpen,
                  onClick: () => setParticipantsOpen(!participantsOpen),
                  children: [
                    jsxRuntime.jsxs("span", { children: [
                      "参与者（",
                      (detail.participants ?? []).filter((p) => p.status !== "left").length,
                      "）",
                    ] }),
                    jsxRuntime.jsx("span", { style: { transform: participantsOpen ? "none" : "rotate(-90deg)" }, children: "▾" }),
                  ],
                }),
                participantsOpen ? jsxRuntime.jsx("div", {
                  style: editingSeat
                    ? {
                        ...participantListStyle,
                        maxHeight: "none",
                        overflowY: "visible",
                        paddingBottom: 14,
                      }
                    : participantListStyle,
                  children:
                  (detail.participants ?? []).filter((p) => p.status !== "left").map((p) => {
                    const isMe = p.refId === detail.actorId && p.kind === "human";
                    const isPending = p.status === "pending";
                    const avatarExpired = p.delegationStatus === "expired";
                    const participantType = p.kind === "agent"
                      ? (p.principalType === "delegation" || p.ownerName !== undefined || p.delegationId !== undefined ? "分身" : "数字员工")
                      : "真人";
                    return jsxRuntime.jsxs("div", {
                      style: {
                        ...(isMe ? selfParticipantRowStyle : participantRowStyle),
                        ...(avatarExpired ? { opacity: 0.64 } : {}),
                      },
                      children: [
                        jsxRuntime.jsx("div", { style: { ...avatarStyle, background: p.kind === "agent" ? "var(--dsw-alias-accent-primary, #4f8ef7)" : "var(--dsw-alias-state-success-primary, #34d47e)" }, children: p.kind === "agent" ? "AI" : (p.displayName ?? "?").slice(0, 1) }),
                        jsxRuntime.jsxs("div", { style: participantNameStyle, children: [
                          p.displayName ?? "未知",
                          p.seatLabel !== undefined || (isMe && p.kind === "human") ? jsxRuntime.jsx("div", {
                            style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 9, marginTop: 1 },
                            children: p.seatLabel === undefined ? "席位：未设置" : `席位：${p.seatLabel}`,
                          }) : null,
                          p.kind === "agent" && p.ownerName !== undefined ? jsxRuntime.jsxs("div", {
                            style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 9, marginTop: 1 },
                            children: [p.ownerName, "的分身 · ", p.autoSpeak === "all" ? "全部回复" : p.autoSpeak === "manual" ? "手动触发" : "被@回复"],
                          }) : null,
                        ] }),
                        jsxRuntime.jsxs("div", { style: { alignItems: "center", display: "flex", gap: 3 }, children: [
                          isMe ? jsxRuntime.jsx("span", { style: selfParticipantTagStyle, children: "我" }) : null,
                          p.kind === "agent" ? jsxRuntime.jsx("span", { style: { ...badgeStyle, background: "rgba(79,142,247,0.18)", color: "var(--dsw-alias-accent-primary, #4f8ef7)" }, children: participantType }) : null,
                          p.kind === "agent" && p.personaId !== undefined ? jsxRuntime.jsx("span", { style: participantTagStyle, children: `角色 ${personaNameById.get(p.personaId) ?? p.personaId}` }) : null,
                          avatarExpired ? jsxRuntime.jsx("span", { style: { ...participantTagStyle, color: "var(--dsw-alias-state-error-primary, #e5534b)" }, children: "已到期" }) : null,
                          p.leader ? jsxRuntime.jsx("span", { style: { ...participantTagStyle, color: "var(--dsw-alias-state-warning-primary, #e2a737)" }, children: "Leader" }) : null,
                          isPending ? jsxRuntime.jsx("span", { style: participantTagStyle, children: "待认领" }) : null,
                          (() => {
                            const isAvatarOwner = p.kind === "agent" && p.ownerId === detail.actorId;
                            const canChangeSeat = active && (isMe || (isLeader && !isMe) || isAvatarOwner);
                            return canChangeSeat ? jsxRuntime.jsx("button", {
                            type: "button",
                            style: removeParticipantBtnStyle,
                            disabled: seatBusy,
                            onClick: () => openSeatEditor(isMe ? undefined : p.id),
                            children: "改席位",
                          }) : null;
                          })(),
                          detail.canRemove === true && !isMe ? jsxRuntime.jsx("button", {
                            type: "button",
                            style: removeParticipantBtnStyle,
                            disabled: removingParticipantId === p.id,
                            onClick: () => removeParticipant(p),
                            children: removingParticipantId === p.id ? "移出中…" : "移出",
                          }) : null,
                        ] }),
                        editingSeat && active && (isMe || editingSeatFor === p.id) ? jsxRuntime.jsxs("form", {
                          style: { display: "flex", gap: 4, gridColumn: "1 / -1", marginTop: 4 },
                          onSubmit: saveOwnSeat,
                          children: [
                            jsxRuntime.jsx("select", {
                              style: { ...inputStyle, flex: 1, fontSize: 11, padding: "4px 6px" },
                              value: seatIdDraft,
                              disabled: seatBusy,
                              onChange: (event) => setSeatIdDraft(event.target.value),
                              children: ownSeatOptions.map((choice) => jsxRuntime.jsx("option", {
                                value: choice.value,
                                disabled: choice.disabled,
                                children: choice.label,
                              }, choice.value)),
                            }),
                            jsxRuntime.jsx("button", { type: "submit", style: primaryBtnStyle, disabled: seatBusy, children: "保存" }),
                            jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, disabled: seatBusy, onClick: () => setEditingSeat(false), children: "取消" }),
                          ],
                        }) : null,
                      ],
                    }, p.id);
                  }),
                }) : null,
              ] }),
              jsxRuntime.jsx("div", { style: messagesStyle, ref: messagesRef, children:
                (detail.transcript ?? []).length === 0
                  ? jsxRuntime.jsx("p", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, marginTop: 24, textAlign: "center" }, children: "暂无发言" })
	                  : (detail.transcript ?? []).map((msg) => {
	                    const isSelf = msg.senderKind === "human" && msg.senderId === detail.actorId;
	                    const mentions = msg.mentions ?? [];
	                    const mentionNames = mentions.map((id) => participantById.get(id) ?? id);
	                    const directedToMe = mentions.includes(myParticipant?.id);
	                    const identity = msg.senderKind === "agent" ? agentIdentity(msg) : undefined;
	                      return jsxRuntime.jsxs("div", {
	                        style: { alignSelf: isSelf ? "flex-end" : "flex-start", maxWidth: "88%" },
	                        children: [
	                          jsxRuntime.jsxs("div", { style: {
	                            ...(msg.senderKind === "agent" ? { ...bubbleOtherStyle, borderColor: "var(--dsw-alias-accent-primary, #4f8ef7)" } : isSelf ? bubbleSelfStyle : bubbleOtherStyle),
	                            ...(directedToMe ? { boxShadow: "0 0 0 1px var(--dsw-alias-accent-primary, #4f8ef7)" } : {}),
	                          }, children: [
	                            identity !== undefined ? jsxRuntime.jsx("div", { style: { color: "var(--dsw-alias-accent-primary, #4f8ef7)", fontSize: 9, fontWeight: 700, marginBottom: 3 }, children: identity.header }) : null,
	                            renderMarkdown(msg.content),
	                          ] }),
	                          jsxRuntime.jsx("div", { style: { ...metaStyle, textAlign: isSelf ? "right" : "left" }, children: [
	                            identity?.metaPrefix ?? "",
	                            msg.senderName,
	                            mentions.length === 0 ? " · 群发" : directedToMe ? " · 定向给我" : mentions.length >= activeOthers.length && activeOthers.length > 0 ? " · @所有人" : ` · 定向给${mentionNames.join("、")}`,
	                            ` · ${timeShort(msg.createdAt)}`,
	                          ].join("") }),
	                        ],
	                      }, msg.id);
                    }),
              }),
              active ? jsxRuntime.jsxs(react.Fragment, { children: [
                joined ? jsxRuntime.jsxs("div", { style: agentSecStyle, children: [
                  jsxRuntime.jsxs("div", { style: agentHeadStyle, children: [
                    jsxRuntime.jsx("span", { style: agentLabelStyle, children: [jsxRuntime.jsx(BotIcon, {}), "会议分身"] }),
                    jsxRuntime.jsx("button", {
                      type: "button",
                      style: { ...ghostBtnStyle, padding: "3px 8px" },
                      disabled: !active,
                      title: "选择一个人设并派遣分身",
                      onClick: () => setAgentOpen(!agentOpen),
                      children: agentOpen ? "收起" : "+ 添加分身",
                    }),
                  ] }),
                  (detail.participants ?? []).some((p) => p.source === "spawned" && p.status === "active") ? jsxRuntime.jsxs("div", { style: { display: "grid", gap: 4 }, children: [
                    jsxRuntime.jsx("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 10 }, children: "已派遣" }),
                    (detail.participants ?? []).filter((p) => p.source === "spawned" && p.status === "active").map((p) => jsxRuntime.jsxs("div", {
                      style: { alignItems: "center", display: "flex", gap: 5 },
                      children: [
                        jsxRuntime.jsx("span", { style: { ...badgeStyle, background: "rgba(79,142,247,0.18)", color: "var(--dsw-alias-accent-primary, #4f8ef7)" }, children: "AI" }),
                        jsxRuntime.jsxs("span", { style: { color: "var(--dsw-alias-label-primary)", flex: 1, fontSize: 11, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                          p.displayName,
                          " · ",
                          p.autoSpeak === "all" ? "全部回复" : p.autoSpeak === "manual" ? "手动触发" : "被@回复",
                        ] }),
                        p.delegationStatus === "expired" ? jsxRuntime.jsx("span", { style: { color: "var(--dsw-alias-state-error-primary, #e5534b)", fontSize: 10 }, children: "已到期" }) : jsxRuntime.jsx("span", { style: { color: "var(--dsw-alias-state-success-primary, #34d47e)", fontSize: 10 }, children: "已接入" }),
                        p.autoSpeak === "manual" && p.delegationStatus !== "expired" ? jsxRuntime.jsx("button", {
                          type: "button",
                          style: { ...ghostBtnStyle, padding: "2px 6px", fontSize: 10 },
                          onClick: () => triggerAgent(p),
                          children: "发言",
                        }) : null,
                      ],
                    }, p.id)),
                  ] }) : null,
                  agentOpen ? jsxRuntime.jsxs("div", { style: { display: "grid", gap: 5 }, children: [
                    jsxRuntime.jsxs("select", {
                      style: selectStyle,
                      value: teammateId,
                      onChange: (event) => setTeammateId(event.target.value),
                      children: [
                        jsxRuntime.jsx("option", { value: "", children: "选择 AI Teammate（可选，优先于人设）" }),
                        ...teammates.map((item) => jsxRuntime.jsx("option", { value: item.id, children: `${item.name} · ${item.ownerName}` }, item.id)),
                      ],
                    }),
                    jsxRuntime.jsxs("select", {
                      style: selectStyle,
                      value: personaId,
                      disabled: teammateId !== "",
                      onChange: (event) => setPersonaId(event.target.value),
                      children: [
                        jsxRuntime.jsx("option", { value: "", children: teammateId === "" ? "选择人设…" : "已由 AI Teammate 提供人设" }),
                        ...personas.map((p) => jsxRuntime.jsx("option", { value: p.id, children: p.name ?? p.id }, p.id)),
                      ],
                    }),
                    jsxRuntime.jsx("input", {
                      type: "text",
                      style: { ...selectStyle, fontSize: 11 },
                      placeholder: "分身名称（可选，默认用主人名+会议名）",
                      value: avatarNickname,
                      onChange: (event) => setAvatarNickname(event.target.value),
                      maxLength: 40,
                    }),
                    personas.length <= 1 ? jsxRuntime.jsx("div", { style: seatMetaStyle, children: "目前只有一个可选人设；更多角色请到「设置 > 角色」创建。" }) : null,
                    jsxRuntime.jsxs("select", {
                      style: selectStyle,
                      value: autoSpeak,
                      onChange: (event) => setAutoSpeak(event.target.value),
                      children: [
                        jsxRuntime.jsx("option", { value: "mentions", children: "被@时回复" }),
                        jsxRuntime.jsx("option", { value: "all", children: "所有消息都回复" }),
                        jsxRuntime.jsx("option", { value: "manual", children: "手动触发，不自动回复" }),
                      ],
                    }),
                    jsxRuntime.jsxs("label", { style: { alignItems: "center", color: "var(--dsw-alias-label-secondary)", display: "flex", fontSize: 11, gap: 5 }, children: [
                      jsxRuntime.jsx("input", { type: "checkbox", checked: initialGreeting, onChange: (event) => setInitialGreeting(event.target.checked) }),
                      "派遣后先自我介绍",
                    ] }),
                    jsxRuntime.jsx("button", { type: "button", style: primaryBtnStyle, disabled: (personaId === "" && teammateId === "") || agentBusy, onClick: dispatchAgent, children: agentBusy ? "正在派遣…" : "派遣分身" }),
                  ] }) : null,
                ] }) : null,
                joined ? jsxRuntime.jsxs("form", { style: { ...inputSecStyle, flexDirection: "column", position: "relative" }, onSubmit: sendMessage, children: [
                  typedIds.size > 0 ? jsxRuntime.jsx("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 10 }, children: [...typedIds].map((id) => `已识别 @${participantById.get(id) ?? id}`).join("、") }) : null,
                  isMentioningAll ? jsxRuntime.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 3 }, children: jsxRuntime.jsxs("span", {
                    style: mentionChipStyle,
                    children: [
                      "@所有人",
                      jsxRuntime.jsx("button", { type: "button", "aria-label": "移除所有接收人", style: { background: "transparent", border: 0, color: "var(--dsw-alias-label-tertiary)", cursor: "pointer", font: "inherit", padding: 0 }, onClick: clearAllMentions, children: "×" }),
                    ],
                  }) }) : mentionIds.size > 0 ? jsxRuntime.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 3 }, children: [...mentionIds].map((id) => jsxRuntime.jsxs("span", {
                    style: mentionChipStyle,
                    children: [
                      `@${participantById.get(id) ?? id}`,
                      jsxRuntime.jsx("button", { type: "button", "aria-label": "移除接收人", style: { background: "transparent", border: 0, color: "var(--dsw-alias-label-tertiary)", cursor: "pointer", font: "inherit", padding: 0 }, onClick: () => setMentionIds((cur) => { const next = new Set(cur); next.delete(id); return next; }), children: "×" }),
                    ],
                  }, id)) }) : null,
                  mentionOpen ? jsxRuntime.jsxs("div", { style: mentionMenuStyle, children: [
                    jsxRuntime.jsx("button", {
                      type: "button",
                      style: { ...ghostBtnStyle, justifyContent: "flex-start", padding: "3px 6px", fontWeight: 600 },
                      onClick: selectAllMentions,
                      children: "@所有人",
                    }),
                    mentionOptions.map((p) => jsxRuntime.jsx("button", {
                      type: "button",
                      style: { ...ghostBtnStyle, justifyContent: "flex-start", padding: "3px 6px" },
                      onClick: () => selectMention(p),
                      children: `${p.kind === "agent" ? "@AI " : "@ "}${p.displayName}`,
                    }, p.id)),
                  ] }) : null,
                  jsxRuntime.jsxs("div", { style: { display: "flex", gap: 5 }, children: [
                    jsxRuntime.jsx("button", { type: "button", style: { ...iconBtnStyle, border: "0.5px solid var(--dsw-alias-border-l3)" }, "aria-label": "选择接收人", title: "选择接收人；不选则群发", onClick: () => setMentionOpen(!mentionOpen), children: "@" }),
                    jsxRuntime.jsx("textarea", {
                      ref: messageInputRef,
                      style: msgInputStyle,
                      rows: 1,
                      value: content,
                      onChange: changeMessage,
                      onClick: (event) => syncMentionCaret(event.currentTarget),
                      onKeyUp: (event) => syncMentionCaret(event.currentTarget),
                      placeholder: typedIds.size + mentionIds.size === 0 ? "输入消息（不选@则群发）…" : "输入定向消息…",
                      disabled: !joined,
                    }),
                    jsxRuntime.jsx("button", { type: "submit", style: sendBtnStyle, disabled: !joined || content.trim() === "", children: jsxRuntime.jsx(SendIcon, {}) }),
                  ] }),
                ] }) : jsxRuntime.jsxs("form", { style: inputSecStyle, onSubmit: sendMessage, children: [
                  jsxRuntime.jsx("textarea", { style: msgInputStyle, rows: 1, value: content, onChange: (event) => setContent(event.target.value), placeholder: "加入会议后可发言…", disabled: true }),
                  jsxRuntime.jsx("button", { type: "submit", style: sendBtnStyle, disabled: true, children: jsxRuntime.jsx(SendIcon, {}) }),
                ] }),
                jsxRuntime.jsxs("div", { style: actionBarStyle, children: [
                  joined
                    ? jsxRuntime.jsx("span", { style: hintStyle, children: isLeader ? "你是会议 Leader" : "已加入会议" })
                    : jsxRuntime.jsx("button", { type: "button", style: primaryBtnStyle, onClick: () => action("/api/collab/meeting/join", { displayName: accountName || `用户-${detail.actorId.slice(0, 6)}` }, "已加入会议"), children: "加入会议" }),
                  joined ? jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, onClick: openSeatPicker, children: "拉人入会" }) : null,
                  joined && canManageSeats && active ? jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, onClick: () => setSeatManageOpen(!seatManageOpen), children: seatManageOpen ? "收起席位管理" : "席位管理" }) : null,
                  joined ? jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, onClick: () => action("/api/collab/meeting/leave", {}, "已离开会议"), children: "离开会议" }) : null,
                  isLeader ? jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, onClick: () => setSummaryOpen(!summaryOpen), children: summaryOpen ? "收起摘要" : "关闭会议" }) : null,
                ] }),
                seatOpen && joined ? jsxRuntime.jsxs("div", { style: seatSecStyle, children: [
                  jsxRuntime.jsxs("div", { style: { alignItems: "center", display: "flex", gap: 6 }, children: [
                    jsxRuntime.jsx("div", { style: { color: "var(--dsw-alias-label-primary)", flex: 1, fontSize: 12, fontWeight: 600 }, children: "拉人入会" }),
                    jsxRuntime.jsx("button", { type: "button", style: iconBtnStyle, "aria-label": "关闭席位选择", onClick: () => setSeatOpen(false), children: jsxRuntime.jsx(CloseIcon, {}) }),
                  ] }),
                  jsxRuntime.jsx("div", { style: seatMetaStyle, children: "先勾选成员直接拉入，并从下拉列表选择席位；下方角色席位是可选方式。" }),
                  people.length === 0
                    ? jsxRuntime.jsx("div", { style: seatMetaStyle, children: seatBusy ? "正在读取成员…" : "当前工作区没有可选成员。" })
                    : jsxRuntime.jsx("div", { style: { display: "grid", gap: 5 }, children: people.map((person) => {
                        const selectable = person.state !== "active" && person.state !== "pending";
                        const selectedSeatValue = peopleSeatIds[person.id] ?? "";
                        const otherSelectedSeatValues = [...selectedPeople]
                          .filter((personId) => personId !== person.id)
                          .map((personId) => peopleSeatIds[personId] ?? "");
                        const personSeatOptions = [
                          { value: "", label: "不指定席位", disabled: false },
                          ...humanSeatOptions,
                        ].map((choice) => ({
                          ...choice,
                          disabled: choice.value !== "" &&
                            (usedSeatValues.has(choice.value) ||
                              otherSelectedSeatValues.includes(choice.value)),
                        }));
                        return jsxRuntime.jsxs("div", {
                          style: { ...seatRowStyle, cursor: "default", opacity: selectable ? 1 : 0.52 },
                          children: [
                            jsxRuntime.jsx("input", {
                              type: "checkbox",
                              style: checkboxStyle,
                              checked: selectedPeople.has(person.id),
                              disabled: !selectable || seatBusy,
                              onChange: () => togglePerson(person.id),
                            }),
                            jsxRuntime.jsxs("div", { style: { minWidth: 0 }, children: [
                              jsxRuntime.jsx("div", { style: seatLabelStyle, children: `${person.name} · 真人` }),
                              jsxRuntime.jsx("div", { style: seatMetaStyle, children:
                                person.state === "active" ? "已在会" :
                                person.state === "pending" ? "待认领" :
                                person.state === "left" ? "曾退出，可再次拉入" : "未入会"
                              }),
                            ] }),
                            jsxRuntime.jsx("select", {
                              style: { ...selectStyle, fontSize: 10, padding: "3px 5px", width: 96 },
                              value: selectedSeatValue,
                              disabled: !selectable || !selectedPeople.has(person.id) || seatBusy,
                              onChange: (event) => setPersonSeatId(person.id, event.target.value),
                              children: personSeatOptions.map((choice) => jsxRuntime.jsx("option", {
                                value: choice.value,
                                disabled: !selectable || !selectedPeople.has(person.id) || choice.disabled,
                                children: choice.label,
                              }, choice.value)),
                            }),
                          ],
                        }, person.id);
                      }) }),
                  jsxRuntime.jsx("div", { style: seatActionsStyle, children:
                    jsxRuntime.jsx("button", {
                      type: "button",
                      style: primaryBtnStyle,
                      disabled: seatBusy || selectedPeople.size === 0,
                      onClick: inviteSelectedPeople,
                      children: `拉入选中成员（${selectedPeople.size}）`,
                    })
                  }),
                  seats.length > 0 ? jsxRuntime.jsxs("div", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 11, fontWeight: 600, marginTop: 3 }, children: [
                    "角色席位",
                    jsxRuntime.jsx("span", { style: seatMetaStyle, children: " · 已退出或已在会的席位不可选择" }),
                  ] }) : null,
                  seats.length > 0 ? jsxRuntime.jsx("div", { style: { display: "grid", gap: 5 }, children: seats.map((seat) => {
                        const selectable = seat.availability === "selectable";
                        const occupant = seat.assigneeName === undefined
                          ? "待认领"
                          : `${seat.assigneeName}${seat.leader ? " · Leader" : ""}`;
                        return jsxRuntime.jsxs("label", {
                          style: { ...seatRowStyle, cursor: selectable ? "pointer" : "not-allowed", opacity: selectable ? 1 : 0.52 },
                          children: [
                            jsxRuntime.jsx("input", {
                              type: "checkbox",
                              style: checkboxStyle,
                              checked: selectedSeatIds.has(seat.seatId),
                              disabled: !selectable || seatBusy,
                              onChange: () => toggleSeat(seat.seatId),
                            }),
                            jsxRuntime.jsxs("div", { style: { minWidth: 0 }, children: [
                              jsxRuntime.jsxs("div", { style: seatLabelStyle, children: [
                                seat.label,
                                " · ",
                                seat.participantKind === "agent" ? "Agent" : "真人",
                              ] }),
                              jsxRuntime.jsxs("div", { style: seatMetaStyle, children: [
                                occupant,
                                seat.availability === "joined" ? " · 已在会" : "",
                                seat.availability === "left" ? " · 已退出" : "",
                                seat.occupancy === "pending" ? " · 待认领占位" : "",
                              ] }),
                            ] }),
                          ],
                        }, seat.seatId);
                      }) }) : null,
                  seats.length > 0 ? jsxRuntime.jsxs("div", { style: seatActionsStyle, children: [
                    jsxRuntime.jsxs("div", { style: { display: "flex", gap: 5 }, children: [
                      jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, disabled: seatBusy, onClick: selectAvailableSeats, children: "全选可选" }),
                      jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, disabled: seatBusy || selectedSeatIds.size === 0, onClick: () => setSelectedSeatIds(new Set()), children: "清空" }),
                    ] }),
                    jsxRuntime.jsx("button", {
                      type: "button",
                      style: primaryBtnStyle,
                      disabled: seatBusy || selectedSeatIds.size === 0,
                      onClick: pullSelectedSeats,
                      children: `拉入选中（${selectedSeatIds.size}）`,
                    }),
                  ] }) : null,
                ] }) : null,
                seatManageOpen && joined && canManageSeats && active ? jsxRuntime.jsxs("div", { style: seatSecStyle, children: [
                  jsxRuntime.jsxs("div", { style: { alignItems: "center", display: "flex", gap: 6 }, children: [
                    jsxRuntime.jsx("div", { style: { color: "var(--dsw-alias-label-primary)", flex: 1, fontSize: 12, fontWeight: 600 }, children: "席位管理" }),
                    jsxRuntime.jsx("button", { type: "button", style: iconBtnStyle, "aria-label": "关闭席位管理", onClick: () => setSeatManageOpen(false), children: jsxRuntime.jsx(CloseIcon, {}) }),
                  ] }),
                  jsxRuntime.jsx("form", { style: { display: "flex", gap: 5 }, onSubmit: createManagedSeat, children: [
                    jsxRuntime.jsx("input", {
                      style: inputStyle,
                      value: newSeatLabel,
                      onChange: (event) => setNewSeatLabel(event.target.value),
                      placeholder: "新席位名称，例如 后端",
                      disabled: seatBusy,
                      maxLength: 80,
                      required: true,
                    }),
                    jsxRuntime.jsx("button", { type: "submit", style: primaryBtnStyle, disabled: seatBusy, children: "新增" }),
                  ] }),
                  meetingSeats.length === 0
                    ? jsxRuntime.jsx("div", { style: seatMetaStyle, children: "本会议还没有自定义席位。新增后会出现在拉人和改席位的下拉列表中。" })
                    : jsxRuntime.jsx("div", { style: { display: "grid", gap: 5 }, children: meetingSeats.map((seat) => jsxRuntime.jsxs("div", {
                        style: seatRowStyle,
                        children: [
                          editingSeatDefinitionId === seat.id ? jsxRuntime.jsxs(react.Fragment, { children: [
                            jsxRuntime.jsx("input", {
                              style: inputStyle,
                              value: seatDefinitionDraft,
                              autoFocus: true,
                              disabled: seatBusy,
                              maxLength: 80,
                              onChange: (event) => setSeatDefinitionDraft(event.target.value),
                            }),
                            jsxRuntime.jsx("button", { type: "button", style: primaryBtnStyle, disabled: seatBusy, onClick: () => renameManagedSeat(seat), children: "保存" }),
                            jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, disabled: seatBusy, onClick: () => setEditingSeatDefinitionId(""), children: "取消" }),
                          ] }) : jsxRuntime.jsxs(react.Fragment, { children: [
                            jsxRuntime.jsx("div", { style: { color: "var(--dsw-alias-label-primary)", flex: 1, fontSize: 11, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: seat.label }),
                            jsxRuntime.jsx("button", { type: "button", style: ghostBtnStyle, disabled: seatBusy, onClick: () => { setEditingSeatDefinitionId(seat.id); setSeatDefinitionDraft(seat.label); }, children: "改名" }),
                            jsxRuntime.jsx("button", { type: "button", style: removeParticipantBtnStyle, disabled: seatBusy, onClick: () => removeManagedSeat(seat), children: "删除" }),
                          ] }),
                        ],
                      }, seat.id)) }),
                  jsxRuntime.jsx("div", { style: seatMetaStyle, children: "删除席位不会移出成员；已占用成员会改为「未设置席位」。" }),
                ] }) : null,
                summaryOpen && isLeader ? jsxRuntime.jsxs("form", { style: { borderTop: "0.5px solid var(--dsw-alias-border-l2)", display: "grid", flexShrink: 0, gap: 6, padding: "7px 14px" }, onSubmit: async (event) => { event.preventDefault(); await action("/api/collab/meeting/close", { summary }, "会议已关闭"); setSummaryOpen(false); setSummary(""); }, children: [
                  jsxRuntime.jsx("textarea", { style: { ...inputStyle, minHeight: 48, resize: "vertical" }, value: summary, onChange: (event) => setSummary(event.target.value), placeholder: "关闭摘要（必填）", required: true }),
                  jsxRuntime.jsx("button", { type: "submit", style: primaryBtnStyle, children: "确认关闭" }),
                ] }) : null,
              ] }) : jsxRuntime.jsx("div", { style: actionBarStyle, children: jsxRuntime.jsx("span", { style: hintStyle, children: "会议已关闭" }) }),
            ] }),
      ] });

      return jsxRuntime.jsx("div", { style: panelRootStyle, children:
        jsxRuntime.jsxs("div", { style: panelStyle, children: [
          notice !== "" ? jsxRuntime.jsx("div", { style: { background: "rgba(52, 212, 126, 0.12)", color: "var(--dsw-alias-state-success-primary, #34d47e)", flexShrink: 0, fontSize: 12, padding: "6px 14px" }, children: notice }) : null,
          error !== "" ? jsxRuntime.jsx("div", { style: { background: "rgba(229, 83, 75, 0.12)", color: "var(--dsw-alias-state-error-primary, #e5534b)", flexShrink: 0, fontSize: 12, padding: "6px 14px" }, children: error }) : null,
          view === "list" ? listView : chatView,
        ] }),
      });
    };

    /* ── apply: register slots ── */

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
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
