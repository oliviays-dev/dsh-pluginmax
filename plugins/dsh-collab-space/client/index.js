window.__ModuleLoader__.load({
  id: "dsh-collab-space",
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
      alignItems: "center",
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
    const formStyle = {
      alignItems: "end",
      display: "grid",
      gap: 9,
      gridTemplateColumns: "minmax(120px, 1fr) minmax(120px, 1fr)",
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
        error.code = body?.error?.code;
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

    function Area({ id, label, value, onChange, rows = 6 }) {
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
                  {
                    style: cellStyle,
                    children: header,
                  },
                  header,
                ),
              ),
            }),
          }),
          jsxRuntime.jsx("tbody", {
            children: rows,
          }),
        ],
      });
    }

    const SpaceSection = () => {
      const [phase, setPhase] = react.useState("loading");
      const [error, setError] = react.useState("");
      const [message, setMessage] = react.useState("");
      const [me, setMe] = react.useState(null);
      const [workspaceId, setWorkspaceId] = react.useState("main");
      const [workspaces, setWorkspaces] = react.useState([]);
      const [config, setConfig] = react.useState(null);
      const [files, setFiles] = react.useState([]);
      const [policies, setPolicies] = react.useState([]);
      const [locks, setLocks] = react.useState([]);
      const [digests, setDigests] = react.useState([]);
      const [events, setEvents] = react.useState([]);
      const [globalRequests, setGlobalRequests] = react.useState([]);
      const [fileContent, setFileContent] = react.useState("");
      const [upload, setUpload] = react.useState({
        path: "docs/readme.md",
        scope: "workspace",
        content: "",
      });
      const [policy, setPolicy] = react.useState({
        pattern: "workspace/docs/*.md",
        scope: "workspace",
        permissions: "read",
        effect: "allow",
      });
      const [lockPath, setLockPath] = react.useState("docs/readme.md");

      const notify = (text) => {
        setError("");
        setMessage(text);
      };

      const fail = (cause) => {
        setMessage("");
        setError(cause instanceof Error ? cause.message : String(cause));
      };

      const load = react.useCallback(async () => {
        const token = getToken();
        if (token === null) {
          setPhase("login");
          return;
        }
        const current = await request("/api/collab/auth/me");
        setMe(current.user);
        const workspaceResult = await request("/api/collab/space/workspaces");
        setWorkspaces(workspaceResult.workspaces);
        const selected = workspaceResult.workspaces.some(
          (item) => item.id === workspaceId,
        )
          ? workspaceId
          : (workspaceResult.workspaces[0]?.id ?? workspaceId);
        setWorkspaceId(selected);
        const query = `workspaceId=${encodeURIComponent(selected)}`;
        const [
          configResult,
          fileResult,
          policyResult,
          lockResult,
          digestResult,
          auditResult,
        ] = await Promise.all([
          request(`/api/collab/space/config?${query}`),
          request(`/api/collab/space/files?${query}`),
          request(`/api/collab/space/policies?${query}`),
          request(`/api/collab/space/locks?${query}`),
          request(`/api/collab/space/digests?${query}`),
          request(`/api/collab/space/audit?${query}&limit=100`),
        ]);
        setConfig(configResult.config);
        setFiles(fileResult.files);
        setPolicies(policyResult.policies);
        setLocks(lockResult.locks);
        setDigests(digestResult.digests);
        setEvents(auditResult.events);
        if (current.user.role === "admin") {
          const globalResult = await request(
            "/api/collab/space/global/requests",
          );
          setGlobalRequests(globalResult.requests);
        } else {
          setGlobalRequests([]);
        }
        setPhase("ready");
      }, [workspaceId]);

      react.useEffect(() => {
        let disposed = false;
        const controller = new AbortController();
        load({
          signal: controller.signal,
        }).catch((cause) => {
          if (disposed || cause.name === "AbortError") return;
          if (cause.status === 401) setPhase("login");
          fail(cause);
          setPhase("error");
        });
        return () => {
          disposed = true;
          controller.abort();
        };
      }, [load]);

      const submitUpload = async (event) => {
        event.preventDefault();
        try {
          const result = await request("/api/collab/space/files", {
            method: "POST",
            body: JSON.stringify({ workspaceId, ...upload }),
          });
          notify(
            result.request === undefined
              ? `已共享 ${result.file.path}`
              : `全局共享已提交审批 ${result.request.id}`,
          );
          setUpload((current) => ({ ...current, content: "" }));
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const readFile = async (path) => {
        try {
          const result = await request("/api/collab/space/file/read", {
            method: "POST",
            body: JSON.stringify({ workspaceId, path }),
          });
          setFileContent(result.content);
          notify(`已读取 ${path}`);
        } catch (cause) {
          fail(cause);
        }
      };

      const submitPolicy = async (event) => {
        event.preventDefault();
        try {
          await request("/api/collab/space/policies", {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              pattern: policy.pattern,
              scope: policy.scope,
              permissions: policy.permissions.split(","),
              effect: policy.effect,
            }),
          });
          notify("共享策略已添加");
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const lockAction = async (action) => {
        try {
          await request(`/api/collab/space/locks/${action}`, {
            method: "POST",
            body: JSON.stringify({ workspaceId, path: lockPath }),
          });
          notify(action === "acquire" ? "已获得咨询锁" : "已释放咨询锁");
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const decideGlobal = async (requestId, approve) => {
        try {
          await request("/api/collab/space/global/requests/decision", {
            method: "POST",
            body: JSON.stringify({ requestId, approve }),
          });
          notify(approve ? "全局共享已批准" : "全局共享已拒绝");
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      if (phase === "loading") {
        return jsxRuntime.jsx("p", {
          style: { color: "#52606d" },
          children: "正在加载共享区...",
        });
      }
      if (phase === "login") {
        return jsxRuntime.jsx("p", {
          style: { color: "#52606d" },
          children: "请先在「协作身份」登录。",
        });
      }

      return jsxRuntime.jsxs("div", {
        style: { display: "grid", gap: 12 },
        children: [
          error === ""
            ? null
            : jsxRuntime.jsx("p", {
                style: { color: "#b3261e", margin: 0 },
                children: error,
              }),
          message === ""
            ? null
            : jsxRuntime.jsx("p", {
                style: { color: "#1b6e3d", margin: 0 },
                children: message,
              }),
          jsxRuntime.jsxs("div", {
            style: {
              alignItems: "end",
              display: "flex",
              gap: 9,
              flexWrap: "wrap",
            },
            children: [
              jsxRuntime.jsx("label", {
                style: {
                  color: "#52606d",
                  display: "grid",
                  fontSize: 13,
                  gap: 5,
                },
                children: [
                  jsxRuntime.jsx("span", { children: "工作区" }),
                  jsxRuntime.jsx("select", {
                    style: { ...inputStyle, width: 180 },
                    value: workspaceId,
                    onChange: (event) => setWorkspaceId(event.target.value),
                    children: workspaces.map((workspace) =>
                      jsxRuntime.jsx(
                        "option",
                        {
                          value: workspace.id,
                          children: workspace.id,
                        },
                        workspace.id,
                      ),
                    ),
                  }),
                ],
              }),
              jsxRuntime.jsx("button", {
                type: "button",
                style: secondaryButtonStyle,
                onClick: () => load().catch(fail),
                children: "刷新",
              }),
            ],
          }),
          config === null
            ? null
            : jsxRuntime.jsxs("p", {
                style: { color: "#52606d", fontSize: 13, margin: 0 },
                children: [
                  `默认范围：${config.defaultScope}`,
                  config.enabled ? "，共享已启用" : "，共享已停用",
                ],
              }),
          jsxRuntime.jsxs(Panel, {
            title: "上传与文档",
            children: [
              jsxRuntime.jsxs("form", {
                style: formStyle,
                onSubmit: submitUpload,
                children: [
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-space-path",
                    label: "路径",
                    value: upload.path,
                    onChange: (event) =>
                      setUpload((current) => ({
                        ...current,
                        path: event.target.value,
                      })),
                  }),
                  jsxRuntime.jsx("label", {
                    style: {
                      color: "#52606d",
                      display: "grid",
                      fontSize: 13,
                      gap: 5,
                    },
                    children: [
                      jsxRuntime.jsx("span", { children: "范围" }),
                      jsxRuntime.jsx("select", {
                        style: inputStyle,
                        value: upload.scope,
                        onChange: (event) =>
                          setUpload((current) => ({
                            ...current,
                            scope: event.target.value,
                          })),
                        children: ["session", "workspace", "global"].map(
                          (scope) =>
                            jsxRuntime.jsx(
                              "option",
                              { value: scope, children: scope },
                              scope,
                            ),
                        ),
                      }),
                    ],
                  }),
                  jsxRuntime.jsx(Area, {
                    id: "pluginmax-space-content",
                    label: "内容",
                    value: upload.content,
                    onChange: (event) =>
                      setUpload((current) => ({
                        ...current,
                        content: event.target.value,
                      })),
                  }),
                  jsxRuntime.jsx("button", {
                    type: "submit",
                    style: buttonStyle,
                    children: "上传",
                  }),
                ],
              }),
              jsxRuntime.jsx(Table, {
                headers: ["路径", "范围", "大小", "更新时间", "来源", "操作"],
                rows: files.map((file) =>
                  jsxRuntime.jsxs(
                    "tr",
                    {
                      children: [
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: file.path,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: file.scope,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: file.size,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: file.updatedAt,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: file.source,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: jsxRuntime.jsx("button", {
                            type: "button",
                            style: secondaryButtonStyle,
                            onClick: () => readFile(file.path),
                            children: "读取",
                          }),
                        }),
                      ],
                    },
                    file.path,
                  ),
                ),
                empty: "暂无共享文档",
              }),
              fileContent === ""
                ? null
                : jsxRuntime.jsx("pre", {
                    style: {
                      background: "#f4f6f8",
                      border: "1px solid #d9dee4",
                      borderRadius: 6,
                      margin: 0,
                      maxHeight: 260,
                      overflow: "auto",
                      padding: 10,
                      whiteSpace: "pre-wrap",
                    },
                    children: fileContent,
                  }),
            ],
          }),
          jsxRuntime.jsxs(Panel, {
            title: "策略",
            children: [
              jsxRuntime.jsxs("form", {
                style: formStyle,
                onSubmit: submitPolicy,
                children: [
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-policy-pattern",
                    label: "匹配",
                    value: policy.pattern,
                    onChange: (event) =>
                      setPolicy((current) => ({
                        ...current,
                        pattern: event.target.value,
                      })),
                  }),
                  jsxRuntime.jsx("label", {
                    style: {
                      color: "#52606d",
                      display: "grid",
                      fontSize: 13,
                      gap: 5,
                    },
                    children: [
                      jsxRuntime.jsx("span", { children: "范围" }),
                      jsxRuntime.jsx("select", {
                        style: inputStyle,
                        value: policy.scope,
                        onChange: (event) =>
                          setPolicy((current) => ({
                            ...current,
                            scope: event.target.value,
                          })),
                        children: ["session", "workspace", "global"].map(
                          (scope) =>
                            jsxRuntime.jsx(
                              "option",
                              { value: scope, children: scope },
                              scope,
                            ),
                        ),
                      }),
                    ],
                  }),
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-policy-permissions",
                    label: "权限",
                    value: policy.permissions,
                    onChange: (event) =>
                      setPolicy((current) => ({
                        ...current,
                        permissions: event.target.value,
                      })),
                  }),
                  jsxRuntime.jsx("label", {
                    style: {
                      color: "#52606d",
                      display: "grid",
                      fontSize: 13,
                      gap: 5,
                    },
                    children: [
                      jsxRuntime.jsx("span", { children: "效果" }),
                      jsxRuntime.jsx("select", {
                        style: inputStyle,
                        value: policy.effect,
                        onChange: (event) =>
                          setPolicy((current) => ({
                            ...current,
                            effect: event.target.value,
                          })),
                        children: ["allow", "deny"].map((effect) =>
                          jsxRuntime.jsx(
                            "option",
                            { value: effect, children: effect },
                            effect,
                          ),
                        ),
                      }),
                    ],
                  }),
                  jsxRuntime.jsx("button", {
                    type: "submit",
                    style: buttonStyle,
                    children: "添加",
                  }),
                ],
              }),
              jsxRuntime.jsx(Table, {
                headers: ["匹配", "范围", "权限", "效果", "过期"],
                rows: policies.map((item) =>
                  jsxRuntime.jsxs(
                    "tr",
                    {
                      children: [
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.pattern,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.scope,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.permissions.join(","),
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.effect,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.expiresAt ?? "-",
                        }),
                      ],
                    },
                    item.id,
                  ),
                ),
                empty: "暂无策略",
              }),
            ],
          }),
          jsxRuntime.jsxs(Panel, {
            title: "咨询锁",
            action: jsxRuntime.jsxs("div", {
              style: { display: "flex", gap: 8 },
              children: [
                jsxRuntime.jsx("button", {
                  type: "button",
                  style: buttonStyle,
                  onClick: () => lockAction("acquire"),
                  children: "加锁",
                }),
                jsxRuntime.jsx("button", {
                  type: "button",
                  style: secondaryButtonStyle,
                  onClick: () => lockAction("release"),
                  children: "释放",
                }),
              ],
            }),
            children: [
              Field({
                id: "pluginmax-lock-path",
                label: "路径",
                value: lockPath,
                onChange: (event) => setLockPath(event.target.value),
              }),
              jsxRuntime.jsx(Table, {
                headers: ["路径", "持有者", "会话", "到期"],
                rows: locks.map((lock) =>
                  jsxRuntime.jsxs(
                    "tr",
                    {
                      children: [
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: lock.path,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: lock.ownerId,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: lock.ownerSessionId,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: lock.expiresAt,
                        }),
                      ],
                    },
                    lock.key,
                  ),
                ),
                empty: "当前没有活跃锁",
              }),
            ],
          }),
          me?.role === "admin"
            ? jsxRuntime.jsxs(Panel, {
                title: "全局审批",
                children: [
                  jsxRuntime.jsx(Table, {
                    headers: ["路径", "提交者", "大小", "状态", "操作"],
                    rows: globalRequests.map((item) =>
                      jsxRuntime.jsxs(
                        "tr",
                        {
                          children: [
                            jsxRuntime.jsx("td", {
                              style: cellStyle,
                              children: item.path,
                            }),
                            jsxRuntime.jsx("td", {
                              style: cellStyle,
                              children: item.submittedBy,
                            }),
                            jsxRuntime.jsx("td", {
                              style: cellStyle,
                              children: item.size,
                            }),
                            jsxRuntime.jsx("td", {
                              style: cellStyle,
                              children: item.status,
                            }),
                            jsxRuntime.jsxs("td", {
                              style: cellStyle,
                              children: [
                                jsxRuntime.jsx("button", {
                                  type: "button",
                                  style: secondaryButtonStyle,
                                  disabled: item.status !== "pending",
                                  onClick: () => decideGlobal(item.id, true),
                                  children: "批准",
                                }),
                                " ",
                                jsxRuntime.jsx("button", {
                                  type: "button",
                                  style: secondaryButtonStyle,
                                  disabled: item.status !== "pending",
                                  onClick: () => decideGlobal(item.id, false),
                                  children: "拒绝",
                                }),
                              ],
                            }),
                          ],
                        },
                        item.id,
                      ),
                    ),
                    empty: "暂无全局共享申请",
                  }),
                ],
              })
            : null,
          jsxRuntime.jsxs(Panel, {
            title: "摘要与审计",
            children: [
              jsxRuntime.jsx(Table, {
                headers: ["摘要", "更新时间", "大小"],
                rows: digests.map((item) =>
                  jsxRuntime.jsxs(
                    "tr",
                    {
                      children: [
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.path,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.updatedAt,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.size,
                        }),
                      ],
                    },
                    item.path,
                  ),
                ),
                empty: "暂无会话摘要",
              }),
              jsxRuntime.jsx(Table, {
                headers: ["时间", "操作者", "动作", "路径"],
                rows: events.map((event) =>
                  jsxRuntime.jsxs(
                    "tr",
                    {
                      children: [
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: event.at,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: event.actorId,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: event.action,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: event.path ?? "-",
                        }),
                      ],
                    },
                    event.id,
                  ),
                ),
                empty: "暂无共享审计",
              }),
            ],
          }),
        ],
      });
    };

    exports.inject = ["slots"];
    exports.apply = (ctx) =>
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "pluginmax-space",
            order: 81,
            label: () => "共享",
            inject: () => ({}),
          },
          () => jsxRuntime.jsx(SpaceSection, {}),
        ),
      );

    return module.exports;
  },
});
