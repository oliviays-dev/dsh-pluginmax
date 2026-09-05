window.__ModuleLoader__.load({
  id: "dsh-collab-meeting",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const jsxRuntime = require("react/jsx-runtime");

    const TOKEN_KEY = "pluginmax.collab.token";
    const inputStyle = {
      border: "1px solid #c9cfd6",
      borderRadius: 6,
      color: "#1f2933",
      font: "inherit",
      minWidth: 0,
      padding: "7px 9px",
      width: "100%",
    };
    const buttonStyle = {
      border: "1px solid #243746",
      borderRadius: 6,
      background: "#243746",
      color: "#fff",
      cursor: "pointer",
      display: "inline-flex",
      font: "inherit",
      gap: 6,
      justifyContent: "center",
      padding: "7px 12px",
      whiteSpace: "nowrap",
    };
    const secondaryButtonStyle = {
      ...buttonStyle,
      background: "#fff",
      color: "#243746",
    };
    const panelStyle = {
      borderTop: "1px solid #d9dee4",
      display: "grid",
      gap: 12,
      paddingTop: 16,
    };
    const tableStyle = {
      borderCollapse: "collapse",
      fontSize: 13,
      minWidth: "100%",
      width: "max-content",
    };
    const cellStyle = {
      borderBottom: "1px solid #e3e7eb",
      padding: "7px 9px",
      textAlign: "left",
      verticalAlign: "top",
      whiteSpace: "nowrap",
    };
    const contentCellStyle = {
      ...cellStyle,
      whiteSpace: "pre-wrap",
    };

    function getToken() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const token = getToken();
      const headers = { ...options.headers };
      if (options.body !== undefined) {
        headers["content-type"] = "application/json";
      }
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
        error.status = response.status;
        throw error;
      }
      return body;
    }

    function Field({ id, label, value, onChange, ...rest }) {
      return jsxRuntime.jsxs("label", {
        htmlFor: id,
        style: { color: "#52606d", display: "grid", fontSize: 13, gap: 5 },
        children: [
          jsxRuntime.jsx("span", { children: label }),
          jsxRuntime.jsx("input", {
            id,
            name: id,
            style: inputStyle,
            value,
            onChange,
            ...rest,
          }),
        ],
      });
    }

    function Area({ id, label, value, onChange, rows = 4 }) {
      return jsxRuntime.jsxs("label", {
        htmlFor: id,
        style: { color: "#52606d", display: "grid", fontSize: 13, gap: 5 },
        children: [
          jsxRuntime.jsx("span", { children: label }),
          jsxRuntime.jsx("textarea", {
            id,
            name: id,
            rows,
            style: { ...inputStyle, resize: "vertical" },
            value,
            onChange,
          }),
        ],
      });
    }

    function Panel({ title, action, children }) {
      return jsxRuntime.jsxs("section", {
        style: panelStyle,
        children: [
          jsxRuntime.jsxs("div", {
            style: {
              alignItems: "center",
              display: "flex",
              gap: 10,
              justifyContent: "space-between",
            },
            children: [
              jsxRuntime.jsx("h3", {
                style: { fontSize: 15, margin: 0 },
                children: title,
              }),
              action,
            ],
          }),
          children,
        ],
      });
    }

    function Table({ headers, rows, empty }) {
      if (rows.length === 0) {
        return jsxRuntime.jsx("p", {
          style: { color: "#52606d", fontSize: 13, margin: 0 },
          children: empty,
        });
      }
      return jsxRuntime.jsxs("table", {
        style: tableStyle,
        children: [
          jsxRuntime.jsx("thead", {
            children: jsxRuntime.jsx("tr", {
              children: headers.map((header) =>
                jsxRuntime.jsx(
                  "th",
                  { style: cellStyle, children: header },
                  header,
                ),
              ),
            }),
          }),
          jsxRuntime.jsx("tbody", { children: rows }),
        ],
      });
    }

    const MeetingSection = () => {
      const [phase, setPhase] = react.useState("loading");
      const [error, setError] = react.useState("");
      const [message, setMessage] = react.useState("");
      const [workspaceId, setWorkspaceId] = react.useState("main");
      const [meetings, setMeetings] = react.useState([]);
      const [selectedMeetingId, setSelectedMeetingId] = react.useState("");
      const [detail, setDetail] = react.useState(null);
      const [meeting, setMeeting] = react.useState({
        title: "",
        agenda: "",
      });
      const joinName = useStateFromStorage("pluginmax.meeting.name", "");
      const [content, setContent] = react.useState("");
      const [summary, setSummary] = react.useState("");

      const notify = (text) => {
        setError("");
        setMessage(text);
      };

      const fail = (cause) => {
        setMessage("");
        setError(cause instanceof Error ? cause.message : String(cause));
      };

      const load = react.useCallback(async () => {
        if (getToken() === null) {
          setPhase("login");
          return;
        }
        const listResult = await request(
          `/api/collab/meetings?workspaceId=${encodeURIComponent(workspaceId)}`,
        );
        setMeetings(listResult.meetings);
        if (selectedMeetingId === "") {
          setDetail(null);
        } else {
          const detailResult = await request(
            `/api/collab/meeting?meetingId=${encodeURIComponent(selectedMeetingId)}`,
          );
          setDetail(detailResult);
        }
        setPhase("ready");
      }, [selectedMeetingId, workspaceId]);

      react.useEffect(() => {
        let disposed = false;
        load().catch((cause) => {
          if (disposed) return;
          if (cause.status === 401) setPhase("login");
          fail(cause);
          setPhase("error");
        });
        return () => {
          disposed = true;
        };
      }, [load]);

      const submitMeeting = async (event) => {
        event.preventDefault();
        try {
          const result = await request("/api/collab/meetings", {
            method: "POST",
            body: JSON.stringify({ workspaceId, ...meeting }),
          });
          setSelectedMeetingId(result.meeting.id);
          setMeeting({ title: "", agenda: "" });
          notify(`已创建 ${result.meeting.title}`);
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const action = async (path, body, text, refresh = true) => {
        if (selectedMeetingId === "") return;
        try {
          await request(path, {
            method: "POST",
            body: JSON.stringify({ meetingId: selectedMeetingId, ...body }),
          });
          notify(text);
          if (refresh) await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const active = detail?.meeting?.status === "active";

      if (phase === "login") {
        return jsxRuntime.jsx("p", {
          style: { color: "#52606d", fontSize: 13 },
          children: "请先登录 Pluginmax",
        });
      }
      if (phase !== "ready" && phase !== "error") return null;

      return jsxRuntime.jsxs("div", {
        style: { display: "grid", gap: 12 },
        children: [
          message === "" ? null : jsxRuntime.jsx("p", { children: message }),
          error === ""
            ? null
            : jsxRuntime.jsx("p", {
                style: { color: "#b3261e" },
                children: error,
              }),
          jsxRuntime.jsx(Field, {
            id: "pluginmax-meeting-workspace",
            label: "工作区",
            value: workspaceId,
            onChange: (event) => {
              setWorkspaceId(event.target.value);
              setSelectedMeetingId("");
            },
          }),
          jsxRuntime.jsxs(
            Panel,
            {
              title: "会议",
              action: jsxRuntime.jsx("button", {
                type: "button",
                style: secondaryButtonStyle,
                onClick: () => load().catch(fail),
                children: "刷新",
              }),
              children: [
                jsxRuntime.jsxs("form", {
                  style: { display: "grid", gap: 9 },
                  onSubmit: submitMeeting,
                  children: [
                    jsxRuntime.jsx(Field, {
                      id: "pluginmax-meeting-title",
                      label: "标题",
                      value: meeting.title,
                      onChange: (event) =>
                        setMeeting((current) => ({
                          ...current,
                          title: event.target.value,
                        })),
                      required: true,
                    }),
                    jsxRuntime.jsx(Area, {
                      id: "pluginmax-meeting-agenda",
                      label: "议程",
                      value: meeting.agenda,
                      rows: 3,
                      onChange: (event) =>
                        setMeeting((current) => ({
                          ...current,
                          agenda: event.target.value,
                        })),
                    }),
                    jsxRuntime.jsx("button", {
                      type: "submit",
                      style: buttonStyle,
                      children: "创建",
                    }),
                  ],
                }),
                jsxRuntime.jsx(Table, {
                  headers: ["标题", "状态", "创建时间", "操作"],
                  rows: meetings.map((item) =>
                    jsxRuntime.jsxs(
                      "tr",
                      {
                        children: [
                          jsxRuntime.jsx("td", {
                            style: cellStyle,
                            children: item.title,
                          }),
                          jsxRuntime.jsx("td", {
                            style: cellStyle,
                            children:
                              item.status === "active" ? "进行中" : "已关闭",
                          }),
                          jsxRuntime.jsx("td", {
                            style: cellStyle,
                            children: item.createdAt,
                          }),
                          jsxRuntime.jsx("td", {
                            style: cellStyle,
                            children: jsxRuntime.jsx("button", {
                              type: "button",
                              style: secondaryButtonStyle,
                              onClick: () => setSelectedMeetingId(item.id),
                              children: "查看",
                            }),
                          }),
                        ],
                      },
                      item.id,
                    ),
                  ),
                  empty: "暂无会议",
                }),
              ],
            },
            "meetings",
          ),
          detail === null
            ? null
            : jsxRuntime.jsxs(
                Panel,
                {
                  title: detail.meeting.title,
                  action: jsxRuntime.jsx("span", {
                    style: {
                      color: "#52606d",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    },
                    children:
                      detail.meeting.status === "active"
                        ? "进行中"
                        : `已关闭 ${detail.meeting.closedAt ?? ""}`,
                  }),
                  children: [
                    detail.meeting.agenda === ""
                      ? null
                      : jsxRuntime.jsx("p", {
                          style: {
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            color: "#52606d",
                          },
                          children: detail.meeting.agenda,
                        }),
                    detail.meeting.summary === undefined
                      ? null
                      : jsxRuntime.jsxs("div", {
                          style: { display: "grid", gap: 4 },
                          children: [
                            jsxRuntime.jsx("strong", { children: "关闭摘要" }),
                            jsxRuntime.jsx("p", {
                              style: {
                                margin: 0,
                                whiteSpace: "pre-wrap",
                              },
                              children: detail.meeting.summary,
                            }),
                          ],
                        }),
                    jsxRuntime.jsx(Table, {
                      headers: [
                        "参与者",
                        "类型",
                        "状态",
                        "席位",
                        "人设",
                        "Leader",
                        "提示",
                      ],
                      rows: detail.participants.map((item) =>
                        jsxRuntime.jsxs(
                          "tr",
                          {
                            children: [
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.displayName,
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children:
                                  item.kind === "human" ? "真人" : "Agent",
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children:
                                  item.status === "active"
                                    ? "在任"
                                    : item.status === "pending"
                                      ? "待认领"
                                      : "已离开",
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.seatId ?? "-",
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.personaId ?? "-",
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.leader ? "是" : "否",
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.hint ?? "-",
                              }),
                            ],
                          },
                          item.id,
                        ),
                      ),
                      empty: "暂无参与者",
                    }),
                    jsxRuntime.jsx(Table, {
                      headers: ["序号", "发送者", "内容", "时间"],
                      rows: detail.transcript.map((item) =>
                        jsxRuntime.jsxs(
                          "tr",
                          {
                            children: [
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.sequence,
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.senderName,
                              }),
                              jsxRuntime.jsx("td", {
                                style: contentCellStyle,
                                children: item.content,
                              }),
                              jsxRuntime.jsx("td", {
                                style: cellStyle,
                                children: item.createdAt,
                              }),
                            ],
                          },
                          item.id,
                        ),
                      ),
                      empty: "暂无发言",
                    }),
                    active
                      ? jsxRuntime.jsxs("div", {
                          style: { display: "grid", gap: 9 },
                          children: [
                            jsxRuntime.jsxs("div", {
                              style: {
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                alignItems: "end",
                              },
                              children: [
                                jsxRuntime.jsx("div", {
                                  style: { flex: "1 1 180px" },
                                  children: jsxRuntime.jsx(Field, {
                                    id: "pluginmax-meeting-name",
                                    label: "入会名称",
                                    value: joinName.value,
                                    onChange: (event) =>
                                      joinName.setValue(event.target.value),
                                    required: true,
                                  }),
                                }),
                                jsxRuntime.jsx("button", {
                                  type: "button",
                                  style: buttonStyle,
                                  onClick: () =>
                                    action(
                                      "/api/collab/meeting/join",
                                      { displayName: joinName.value },
                                      "已加入会议",
                                    ),
                                  children: "加入",
                                }),
                                jsxRuntime.jsx("button", {
                                  type: "button",
                                  style: secondaryButtonStyle,
                                  onClick: () =>
                                    action(
                                      "/api/collab/meeting/seats/pull",
                                      {},
                                      "已同步角色席位",
                                    ),
                                  children: "同步席位",
                                }),
                                jsxRuntime.jsx("button", {
                                  type: "button",
                                  style: secondaryButtonStyle,
                                  onClick: () =>
                                    action(
                                      "/api/collab/meeting/leave",
                                      {},
                                      "已离开会议",
                                    ),
                                  children: "离开",
                                }),
                              ],
                            }),
                            jsxRuntime.jsxs("form", {
                              style: { display: "grid", gap: 9 },
                              onSubmit: async (event) => {
                                event.preventDefault();
                                await action(
                                  "/api/collab/meeting/message",
                                  { content },
                                  "发言已记录",
                                );
                                setContent("");
                              },
                              children: [
                                jsxRuntime.jsx(Area, {
                                  id: "pluginmax-meeting-content",
                                  label: "发言",
                                  value: content,
                                  rows: 3,
                                  onChange: (event) =>
                                    setContent(event.target.value),
                                  required: true,
                                }),
                                jsxRuntime.jsx("button", {
                                  type: "submit",
                                  style: buttonStyle,
                                  children: "发送",
                                }),
                              ],
                            }),
                            jsxRuntime.jsxs("form", {
                              style: { display: "grid", gap: 9 },
                              onSubmit: async (event) => {
                                event.preventDefault();
                                await action(
                                  "/api/collab/meeting/close",
                                  { summary },
                                  "会议已关闭",
                                );
                                setSummary("");
                              },
                              children: [
                                jsxRuntime.jsx(Area, {
                                  id: "pluginmax-meeting-summary",
                                  label: "关闭摘要",
                                  value: summary,
                                  rows: 3,
                                  onChange: (event) =>
                                    setSummary(event.target.value),
                                  required: true,
                                }),
                                jsxRuntime.jsx("button", {
                                  type: "submit",
                                  style: buttonStyle,
                                  children: "关闭会议",
                                }),
                              ],
                            }),
                          ],
                        })
                      : null,
                  ],
                },
                "detail",
              ),
        ],
      });
    };

    function useStateFromStorage(key, initial) {
      const [value, setValue] = react.useState(
        () => window.localStorage.getItem(key) ?? initial,
      );
      const update = react.useCallback(
        (next) => {
          setValue(next);
          if (next === "") window.localStorage.removeItem(key);
          else window.localStorage.setItem(key, next);
        },
        [key],
      );
      return { value, setValue: update };
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) =>
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "pluginmax-meetings",
            order: 83,
            label: () => "会议",
            inject: () => ({}),
          },
          () => jsxRuntime.jsx(MeetingSection, {}),
        ),
      );

    return module.exports;
  },
});
