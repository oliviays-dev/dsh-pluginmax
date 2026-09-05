window.__ModuleLoader__.load({
  id: "dsh-collab-identity",
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
    };
    const secondaryButtonStyle = {
      ...buttonStyle,
      background: "#fff",
      color: "#243746",
    };
    const panelStyle = {
      borderTop: "1px solid #d9dee4",
      display: "grid",
      gap: 14,
      paddingTop: 16,
    };
    const formStyle = {
      display: "grid",
      gap: 9,
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
    };

    function getToken() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
      if (token === undefined) window.localStorage.removeItem(TOKEN_KEY);
      else window.localStorage.setItem(TOKEN_KEY, token);
    }

    async function request(path, options = {}) {
      const token = getToken();
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

    function Field({ id, label, type = "text", value, onChange, ...rest }) {
      return jsxRuntime.jsxs("label", {
        htmlFor: id,
        style: { color: "#52606d", display: "grid", fontSize: 13, gap: 5 },
        children: [
          jsxRuntime.jsx("span", { children: label }),
          jsxRuntime.jsx("input", {
            id,
            name: id,
            style: inputStyle,
            type,
            value,
            onChange,
            ...rest,
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

    const IdentitySection = () => {
      const [phase, setPhase] = react.useState("loading");
      const [message, setMessage] = react.useState("");
      const [error, setError] = react.useState("");
      const [me, setMe] = react.useState(null);
      const [users, setUsers] = react.useState([]);
      const [members, setMembers] = react.useState([]);
      const [events, setEvents] = react.useState([]);
      const [workspaceId, setWorkspaceId] = react.useState("main");
      const [account, setAccount] = react.useState({
        userId: "",
        name: "",
        password: "",
      });
      const [passwordForm, setPasswordForm] = react.useState({
        currentPassword: "",
        newPassword: "",
      });
      const [newUser, setNewUser] = react.useState({
        userId: "",
        name: "",
        password: "",
        role: "member",
      });
      const [memberForm, setMemberForm] = react.useState({
        userId: "",
        role: "member",
      });

      const notify = (text) => {
        setError("");
        setMessage(text);
      };

      const fail = (cause) => {
        setMessage("");
        setError(cause instanceof Error ? cause.message : String(cause));
      };

      const loadAdmin = react.useCallback(
        async (user = me) => {
          if (user?.role !== "admin") return;
          const [userResult, memberResult, auditResult] = await Promise.all([
            request("/api/collab/team/users"),
            request(
              `/api/collab/team/members?workspaceId=${encodeURIComponent(workspaceId)}`,
            ),
            request("/api/collab/team/audit?limit=100"),
          ]);
          setUsers(userResult.users);
          setMembers(memberResult.members);
          setEvents(auditResult.events);
        },
        [me, workspaceId],
      );

      react.useEffect(() => {
        let disposed = false;
        const controller = new AbortController();
        async function load() {
          try {
            const status = await request("/api/collab/auth/status", {
              signal: controller.signal,
            });
            if (disposed) return;
            const token = getToken();
            if (token === null) {
              setPhase(status.initialized ? "login" : "bootstrap");
              return;
            }
            const current = await request("/api/collab/auth/me", {
              signal: controller.signal,
            });
            if (disposed) return;
            setMe(current.user);
            setPhase("ready");
            await loadAdmin(current.user);
          } catch (cause) {
            if (cause.name === "AbortError" || disposed) return;
            if (cause.status === 401) {
              setToken(undefined);
              setPhase("login");
            }
            fail(cause);
          }
        }
        load();
        return () => {
          disposed = true;
          controller.abort();
        };
      }, [loadAdmin]);

      react.useEffect(() => {
        if (me?.role !== "admin") return;
        loadAdmin(me).catch(fail);
      }, [loadAdmin, me]);

      const submitBootstrap = async (event) => {
        event.preventDefault();
        try {
          const result = await request("/api/collab/auth/bootstrap", {
            method: "POST",
            body: JSON.stringify(account),
          });
          setToken(result.token);
          setMe(result.user);
          setPhase("ready");
          notify(`已创建管理员 ${result.user.id}`);
          await loadAdmin(result.user);
        } catch (cause) {
          fail(cause);
        }
      };

      const submitLogin = async (event) => {
        event.preventDefault();
        try {
          const result = await request("/api/collab/auth/login", {
            method: "POST",
            body: JSON.stringify({
              userId: account.userId,
              password: account.password,
            }),
          });
          setToken(result.token);
          setMe(result.user);
          setPhase("ready");
          notify(`已登录 ${result.user.name}`);
          await loadAdmin(result.user);
        } catch (cause) {
          fail(cause);
        }
      };

      const submitPassword = async (event) => {
        event.preventDefault();
        try {
          await request("/api/collab/auth/change-password", {
            method: "POST",
            body: JSON.stringify(passwordForm),
          });
          setPasswordForm({ currentPassword: "", newPassword: "" });
          notify("密码已更新");
        } catch (cause) {
          fail(cause);
        }
      };

      const submitUser = async (event) => {
        event.preventDefault();
        try {
          await request("/api/collab/team/users/create", {
            method: "POST",
            body: JSON.stringify(newUser),
          });
          setNewUser({ userId: "", name: "", password: "", role: "member" });
          notify("成员账号已创建");
          await loadAdmin();
        } catch (cause) {
          fail(cause);
        }
      };

      const submitMember = async (event) => {
        event.preventDefault();
        try {
          await request("/api/collab/team/members/set", {
            method: "PUT",
            body: JSON.stringify({
              workspaceId,
              userId: memberForm.userId,
              role: memberForm.role,
            }),
          });
          setMemberForm({ userId: "", role: "member" });
          notify("工作区成员已保存");
          await loadAdmin();
        } catch (cause) {
          fail(cause);
        }
      };

      const removeMember = async (userId) => {
        try {
          await request("/api/collab/team/members/remove", {
            method: "POST",
            body: JSON.stringify({ workspaceId, userId }),
          });
          notify("成员已移出工作区");
          await loadAdmin();
        } catch (cause) {
          fail(cause);
        }
      };

      const logout = async () => {
        try {
          await request("/api/collab/auth/logout", { method: "POST" });
        } finally {
          setToken(undefined);
          setMe(null);
          setUsers([]);
          setMembers([]);
          setEvents([]);
          setPhase("login");
          notify("已退出");
        }
      };

      const accountFields = jsxRuntime.jsxs(jsxRuntime.Fragment, {
        children: [
          jsxRuntime.jsx(Field, {
            id: "pluginmax-user-id",
            label: "用户 ID",
            value: account.userId,
            onChange: (event) =>
              setAccount((current) => ({
                ...current,
                userId: event.target.value,
              })),
            autoComplete: "username",
          }),
          jsxRuntime.jsx(Field, {
            id: "pluginmax-user-name",
            label: "显示名称",
            value: account.name,
            onChange: (event) =>
              setAccount((current) => ({
                ...current,
                name: event.target.value,
              })),
            autoComplete: "name",
          }),
          jsxRuntime.jsx(Field, {
            id: "pluginmax-user-password",
            label: "密码",
            type: "password",
            value: account.password,
            onChange: (event) =>
              setAccount((current) => ({
                ...current,
                password: event.target.value,
              })),
            autoComplete: "new-password",
          }),
        ],
      });

      if (phase === "loading") {
        return jsxRuntime.jsx("section", {
          "data-pluginmax-identity": true,
          style: { display: "grid", gap: 12, padding: 4 },
          children: jsxRuntime.jsx("p", { children: "正在加载身份..." }),
        });
      }

      return jsxRuntime.jsxs("section", {
        "data-pluginmax-identity": true,
        style: { color: "#1f2933", display: "grid", gap: 16, padding: 4 },
        children: [
          jsxRuntime.jsxs("div", {
            style: {
              alignItems: "center",
              display: "flex",
              gap: 10,
              justifyContent: "space-between",
            },
            children: [
              jsxRuntime.jsx("h2", {
                style: { fontSize: 18, margin: 0 },
                children: "协作身份",
              }),
              me === null
                ? null
                : jsxRuntime.jsx("button", {
                    type: "button",
                    style: secondaryButtonStyle,
                    onClick: logout,
                    children: "退出",
                  }),
            ],
          }),
          message === ""
            ? null
            : jsxRuntime.jsx("p", {
                style: { color: "#087443", margin: 0 },
                children: message,
              }),
          error === ""
            ? null
            : jsxRuntime.jsx("p", {
                style: { color: "#b42318", margin: 0 },
                children: error,
              }),
          phase === "bootstrap"
            ? jsxRuntime.jsxs("form", {
                onSubmit: submitBootstrap,
                style: formStyle,
                children: [
                  accountFields,
                  jsxRuntime.jsx("button", {
                    type: "submit",
                    style: {
                      ...buttonStyle,
                      gridColumn: "1 / -1",
                      justifySelf: "start",
                    },
                    children: "创建管理员",
                  }),
                ],
              })
            : null,
          phase === "login"
            ? jsxRuntime.jsxs("form", {
                onSubmit: submitLogin,
                style: formStyle,
                children: [
                  accountFields,
                  jsxRuntime.jsx("button", {
                    type: "submit",
                    style: {
                      ...buttonStyle,
                      gridColumn: "1 / -1",
                      justifySelf: "start",
                    },
                    children: "登录",
                  }),
                ],
              })
            : null,
          phase !== "ready" || me === null
            ? null
            : jsxRuntime.jsxs(jsxRuntime.Fragment, {
                children: [
                  jsxRuntime.jsxs("div", {
                    style: {
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    },
                    children: [
                      jsxRuntime.jsx("strong", { children: me.name }),
                      jsxRuntime.jsx("span", { children: me.id }),
                      jsxRuntime.jsx("span", { children: me.role }),
                    ],
                  }),
                  jsxRuntime.jsxs("form", {
                    onSubmit: submitPassword,
                    style: formStyle,
                    children: [
                      jsxRuntime.jsx(Field, {
                        id: "pluginmax-current-password",
                        label: "当前密码",
                        type: "password",
                        value: passwordForm.currentPassword,
                        onChange: (event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          })),
                        autoComplete: "current-password",
                      }),
                      jsxRuntime.jsx(Field, {
                        id: "pluginmax-new-password",
                        label: "新密码",
                        type: "password",
                        value: passwordForm.newPassword,
                        onChange: (event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            newPassword: event.target.value,
                          })),
                        autoComplete: "new-password",
                      }),
                      jsxRuntime.jsx("button", {
                        type: "submit",
                        style: { ...buttonStyle, justifySelf: "start" },
                        children: "更新密码",
                      }),
                    ],
                  }),
                ],
              }),
          me?.role !== "admin"
            ? null
            : jsxRuntime.jsxs(jsxRuntime.Fragment, {
                children: [
                  jsxRuntime.jsxs(Panel, {
                    title: "账号",
                    action: jsxRuntime.jsx("button", {
                      type: "button",
                      style: secondaryButtonStyle,
                      onClick: () => loadAdmin().catch(fail),
                      children: "刷新",
                    }),
                    children: [
                      jsxRuntime.jsxs("form", {
                        onSubmit: submitUser,
                        style: formStyle,
                        children: [
                          jsxRuntime.jsx(Field, {
                            id: "pluginmax-new-user-id",
                            label: "用户 ID",
                            value: newUser.userId,
                            onChange: (event) =>
                              setNewUser((current) => ({
                                ...current,
                                userId: event.target.value,
                              })),
                          }),
                          jsxRuntime.jsx(Field, {
                            id: "pluginmax-new-user-name",
                            label: "显示名称",
                            value: newUser.name,
                            onChange: (event) =>
                              setNewUser((current) => ({
                                ...current,
                                name: event.target.value,
                              })),
                          }),
                          jsxRuntime.jsx(Field, {
                            id: "pluginmax-new-user-password",
                            label: "初始密码",
                            type: "password",
                            value: newUser.password,
                            onChange: (event) =>
                              setNewUser((current) => ({
                                ...current,
                                password: event.target.value,
                              })),
                          }),
                          jsxRuntime.jsx("label", {
                            htmlFor: "pluginmax-new-user-role",
                            style: {
                              color: "#52606d",
                              display: "grid",
                              fontSize: 13,
                              gap: 5,
                            },
                            children: [
                              jsxRuntime.jsx("span", { children: "全局角色" }),
                              jsxRuntime.jsx("select", {
                                id: "pluginmax-new-user-role",
                                style: inputStyle,
                                value: newUser.role,
                                onChange: (event) =>
                                  setNewUser((current) => ({
                                    ...current,
                                    role: event.target.value,
                                  })),
                                children: [
                                  "admin",
                                  "owner",
                                  "member",
                                  "guest",
                                ].map((role) =>
                                  jsxRuntime.jsx(
                                    "option",
                                    { value: role, children: role },
                                    role,
                                  ),
                                ),
                              }),
                            ],
                          }),
                          jsxRuntime.jsx("button", {
                            type: "submit",
                            style: { ...buttonStyle, justifySelf: "start" },
                            children: "创建",
                          }),
                        ],
                      }),
                      jsxRuntime.jsxs("table", {
                        style: tableStyle,
                        children: [
                          jsxRuntime.jsx("thead", {
                            children: jsxRuntime.jsx("tr", {
                              children: [
                                "用户",
                                "名称",
                                "角色",
                                "创建时间",
                              ].map((title) =>
                                jsxRuntime.jsx(
                                  "th",
                                  { style: cellStyle, children: title },
                                  title,
                                ),
                              ),
                            }),
                          }),
                          jsxRuntime.jsx("tbody", {
                            children: users.map((user) =>
                              jsxRuntime.jsxs(
                                "tr",
                                {
                                  children: [
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: user.id,
                                    }),
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: user.name,
                                    }),
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: user.role,
                                    }),
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: user.createdAt,
                                    }),
                                  ],
                                },
                                user.id,
                              ),
                            ),
                          }),
                        ],
                      }),
                    ],
                  }),
                  jsxRuntime.jsxs(Panel, {
                    title: "工作区成员",
                    children: [
                      jsxRuntime.jsx(Field, {
                        id: "pluginmax-workspace-id",
                        label: "工作区 ID",
                        value: workspaceId,
                        onChange: (event) => setWorkspaceId(event.target.value),
                      }),
                      jsxRuntime.jsxs("form", {
                        onSubmit: submitMember,
                        style: formStyle,
                        children: [
                          jsxRuntime.jsx(Field, {
                            id: "pluginmax-member-user-id",
                            label: "用户 ID",
                            value: memberForm.userId,
                            onChange: (event) =>
                              setMemberForm((current) => ({
                                ...current,
                                userId: event.target.value,
                              })),
                          }),
                          jsxRuntime.jsx("label", {
                            htmlFor: "pluginmax-member-role",
                            style: {
                              color: "#52606d",
                              display: "grid",
                              fontSize: 13,
                              gap: 5,
                            },
                            children: [
                              jsxRuntime.jsx("span", { children: "成员角色" }),
                              jsxRuntime.jsx("select", {
                                id: "pluginmax-member-role",
                                style: inputStyle,
                                value: memberForm.role,
                                onChange: (event) =>
                                  setMemberForm((current) => ({
                                    ...current,
                                    role: event.target.value,
                                  })),
                                children: ["owner", "member", "guest"].map(
                                  (role) =>
                                    jsxRuntime.jsx(
                                      "option",
                                      { value: role, children: role },
                                      role,
                                    ),
                                ),
                              }),
                            ],
                          }),
                          jsxRuntime.jsx("button", {
                            type: "submit",
                            style: { ...buttonStyle, justifySelf: "start" },
                            children: "保存成员",
                          }),
                        ],
                      }),
                      jsxRuntime.jsxs("table", {
                        style: tableStyle,
                        children: [
                          jsxRuntime.jsx("thead", {
                            children: jsxRuntime.jsx("tr", {
                              children: [
                                "用户",
                                "名称",
                                "角色",
                                "加入时间",
                                "",
                              ].map((title, index) =>
                                jsxRuntime.jsx(
                                  "th",
                                  { style: cellStyle, children: title },
                                  index,
                                ),
                              ),
                            }),
                          }),
                          jsxRuntime.jsx("tbody", {
                            children: members.map((member) =>
                              jsxRuntime.jsxs(
                                "tr",
                                {
                                  children: [
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: member.userId,
                                    }),
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: member.name,
                                    }),
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: member.memberRole,
                                    }),
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: member.addedAt,
                                    }),
                                    jsxRuntime.jsx("td", {
                                      style: cellStyle,
                                      children: jsxRuntime.jsx("button", {
                                        type: "button",
                                        style: secondaryButtonStyle,
                                        onClick: () =>
                                          removeMember(member.userId),
                                        children: "移出",
                                      }),
                                    }),
                                  ],
                                },
                                member.userId,
                              ),
                            ),
                          }),
                        ],
                      }),
                    ],
                  }),
                  jsxRuntime.jsx(Panel, {
                    title: "审计时间线",
                    children: jsxRuntime.jsxs("table", {
                      style: tableStyle,
                      children: [
                        jsxRuntime.jsx("thead", {
                          children: jsxRuntime.jsx("tr", {
                            children: [
                              "时间",
                              "操作者",
                              "动作",
                              "对象",
                              "工作区",
                            ].map((title) =>
                              jsxRuntime.jsx(
                                "th",
                                { style: cellStyle, children: title },
                                title,
                              ),
                            ),
                          }),
                        }),
                        jsxRuntime.jsx("tbody", {
                          children: events.map((event) =>
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
                                    children: event.targetId ?? "-",
                                  }),
                                  jsxRuntime.jsx("td", {
                                    style: cellStyle,
                                    children: event.workspaceId ?? "-",
                                  }),
                                ],
                              },
                              event.id,
                            ),
                          ),
                        }),
                      ],
                    }),
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
            id: "pluginmax-identity",
            order: 80,
            label: () => "协作身份",
            inject: () => ({}),
          },
          () => jsxRuntime.jsx(IdentitySection, {}),
        ),
      );

    return module.exports;
  },
});
