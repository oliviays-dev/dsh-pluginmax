window.__ModuleLoader__.load({
  id: "dsh-collab-roles",
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

    function getToken() {
      return window.localStorage.getItem(TOKEN_KEY);
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

    const RolesSection = () => {
      const [phase, setPhase] = react.useState("loading");
      const [error, setError] = react.useState("");
      const [message, setMessage] = react.useState("");
      const [workspaceId, setWorkspaceId] = react.useState("main");
      const [personas, setPersonas] = react.useState([]);
      const [types, setTypes] = react.useState([]);
      const [config, setConfig] = react.useState(null);
      const [seats, setSeats] = react.useState([]);
      const [persona, setPersona] = react.useState({
        id: "",
        name: "",
        description: "",
        tags: "",
        soul: "",
      });
      const [type, setType] = react.useState({
        id: "",
        name: "",
        description: "",
        seatsJson:
          '[{"id":"leader","label":"负责人","participantKind":"human","permissions":["read","write","approve"]}]',
      });
      const [claimSeat, setClaimSeat] = react.useState("");

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
        const [personaResult, typeResult] = await Promise.all([
          request("/api/collab/roles/personas"),
          request("/api/collab/roles/types"),
        ]);
        setPersonas(personaResult.personas);
        setTypes(typeResult.types);
        try {
          const seatResult = await request(
            `/api/collab/roles/seats?workspaceId=${encodeURIComponent(workspaceId)}`,
          );
          setConfig(seatResult.config);
          setSeats(seatResult.seats);
        } catch {
          setConfig(null);
          setSeats([]);
        }
        setPhase("ready");
      }, [workspaceId]);

      react.useEffect(() => {
        let disposed = false;
        const controller = new AbortController();
        load({ signal: controller.signal }).catch((cause) => {
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

      const submitPersona = async (event) => {
        event.preventDefault();
        try {
          const result = await request("/api/collab/roles/personas", {
            method: "POST",
            body: JSON.stringify({
              ...persona,
              tags: persona.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag !== ""),
            }),
          });
          notify(`已创建 ${result.persona.name}`);
          setPersona({ id: "", name: "", description: "", tags: "", soul: "" });
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const submitType = async (event) => {
        event.preventDefault();
        try {
          const parsedSeats = JSON.parse(type.seatsJson);
          const result = await request("/api/collab/roles/types", {
            method: "POST",
            body: JSON.stringify({ ...type, seats: parsedSeats }),
          });
          notify(`已创建 ${result.type.name}`);
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const materialize = async (typeId) => {
        try {
          const result = await request("/api/collab/roles/materialize", {
            method: "POST",
            body: JSON.stringify({ workspaceId, typeId }),
          });
          setConfig(result.config);
          setSeats([]);
          notify(`已物化 ${result.config.typeName}`);
        } catch (cause) {
          fail(cause);
        }
      };

      const claim = async () => {
        if (claimSeat === "") return;
        try {
          const result = await request("/api/collab/roles/seats/claim", {
            method: "POST",
            body: JSON.stringify({ workspaceId, seatId: claimSeat }),
          });
          notify(`已认领 ${result.seat.seatLabel}`);
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

      const release = async (seatId) => {
        try {
          const result = await request("/api/collab/roles/seats/release", {
            method: "POST",
            body: JSON.stringify({ workspaceId, seatId }),
          });
          notify(`已释放 ${result.seat.seatLabel}`);
          await load();
        } catch (cause) {
          fail(cause);
        }
      };

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
            id: "pluginmax-roles-workspace",
            label: "工作区",
            value: workspaceId,
            onChange: (event) => setWorkspaceId(event.target.value),
          }),
          jsxRuntime.jsxs(Panel, {
            title: "人设",
            children: [
              jsxRuntime.jsxs("form", {
                style: { display: "grid", gap: 9 },
                onSubmit: submitPersona,
                children: [
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-persona-id",
                    label: "标识",
                    value: persona.id,
                    onChange: (event) =>
                      setPersona((current) => ({
                        ...current,
                        id: event.target.value,
                      })),
                    required: true,
                  }),
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-persona-name",
                    label: "名称",
                    value: persona.name,
                    onChange: (event) =>
                      setPersona((current) => ({
                        ...current,
                        name: event.target.value,
                      })),
                    required: true,
                  }),
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-persona-tags",
                    label: "标签",
                    value: persona.tags,
                    onChange: (event) =>
                      setPersona((current) => ({
                        ...current,
                        tags: event.target.value,
                      })),
                  }),
                  jsxRuntime.jsx(Area, {
                    id: "pluginmax-persona-description",
                    label: "描述",
                    value: persona.description,
                    rows: 2,
                    onChange: (event) =>
                      setPersona((current) => ({
                        ...current,
                        description: event.target.value,
                      })),
                  }),
                  jsxRuntime.jsx(Area, {
                    id: "pluginmax-persona-soul",
                    label: "SOUL",
                    value: persona.soul,
                    onChange: (event) =>
                      setPersona((current) => ({
                        ...current,
                        soul: event.target.value,
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
                headers: ["标识", "名称", "标签", "更新时间"],
                rows: personas.map((item) =>
                  jsxRuntime.jsxs(
                    "tr",
                    {
                      children: [
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.id,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.name,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.tags.join(", "),
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.updatedAt,
                        }),
                      ],
                    },
                    item.id,
                  ),
                ),
                empty: "暂无人设",
              }),
            ],
          }),
          jsxRuntime.jsxs(Panel, {
            title: "工作区类型",
            children: [
              jsxRuntime.jsxs("form", {
                style: { display: "grid", gap: 9 },
                onSubmit: submitType,
                children: [
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-type-id",
                    label: "标识",
                    value: type.id,
                    onChange: (event) =>
                      setType((current) => ({
                        ...current,
                        id: event.target.value,
                      })),
                    required: true,
                  }),
                  jsxRuntime.jsx(Field, {
                    id: "pluginmax-type-name",
                    label: "名称",
                    value: type.name,
                    onChange: (event) =>
                      setType((current) => ({
                        ...current,
                        name: event.target.value,
                      })),
                    required: true,
                  }),
                  jsxRuntime.jsx(Area, {
                    id: "pluginmax-type-seats",
                    label: "席位 JSON",
                    value: type.seatsJson,
                    rows: 5,
                    onChange: (event) =>
                      setType((current) => ({
                        ...current,
                        seatsJson: event.target.value,
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
                headers: ["标识", "名称", "席位数", "操作"],
                rows: types.map((item) =>
                  jsxRuntime.jsxs(
                    "tr",
                    {
                      children: [
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.id,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.name,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: item.seats.length,
                        }),
                        jsxRuntime.jsx("td", {
                          style: cellStyle,
                          children: jsxRuntime.jsx("button", {
                            type: "button",
                            style: secondaryButtonStyle,
                            onClick: () => materialize(item.id),
                            children: "物化",
                          }),
                        }),
                      ],
                    },
                    item.id,
                  ),
                ),
                empty: "暂无类型",
              }),
            ],
          }),
          jsxRuntime.jsxs(Panel, {
            title: "角色席位",
            action: jsxRuntime.jsxs("div", {
              style: { display: "flex", gap: 8 },
              children: [
                jsxRuntime.jsx("select", {
                  style: { ...inputStyle, width: 160 },
                  value: claimSeat,
                  onChange: (event) => setClaimSeat(event.target.value),
                  children: [
                    jsxRuntime.jsx("option", {
                      value: "",
                      children: "选择席位",
                    }),
                    ...(config?.seats ?? []).map((seat) =>
                      jsxRuntime.jsx(
                        "option",
                        { value: seat.id, children: seat.label },
                        seat.id,
                      ),
                    ),
                  ],
                }),
                jsxRuntime.jsx("button", {
                  type: "button",
                  style: buttonStyle,
                  onClick: claim,
                  children: "认领",
                }),
              ],
            }),
            children: [
              config === null
                ? jsxRuntime.jsx("p", { children: "当前工作区未物化" })
                : jsxRuntime.jsx(Table, {
                    headers: [
                      "席位",
                      "状态",
                      "担任者",
                      "人设",
                      "Leader",
                      "操作",
                    ],
                    rows: seats.map((item) =>
                      jsxRuntime.jsxs(
                        "tr",
                        {
                          children: [
                            jsxRuntime.jsx("td", {
                              style: cellStyle,
                              children: item.seatLabel,
                            }),
                            jsxRuntime.jsx("td", {
                              style: cellStyle,
                              children: item.status,
                            }),
                            jsxRuntime.jsx("td", {
                              style: cellStyle,
                              children: `${item.assigneeKind}/${item.assigneeId}`,
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
                              children: jsxRuntime.jsx("button", {
                                type: "button",
                                style: secondaryButtonStyle,
                                onClick: () => release(item.seatId),
                                children: "释放",
                              }),
                            }),
                          ],
                        },
                        item.id,
                      ),
                    ),
                    empty: "暂无在任者",
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
            id: "pluginmax-roles",
            order: 82,
            label: () => "角色",
            inject: () => ({}),
          },
          () => jsxRuntime.jsx(RolesSection, {}),
        ),
      );

    return module.exports;
  },
});
