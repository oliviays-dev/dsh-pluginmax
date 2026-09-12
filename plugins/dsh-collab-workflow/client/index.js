window.__ModuleLoader__.load({
  id: "dsh-collab-workflow",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const jsxRuntime = require("react/jsx-runtime");

    const TOKEN_KEY = "pluginmax.collab.token";
    const css = `
.pmwf{color:var(--dsw-alias-label-primary);font-family:inherit}
.pmwf *{box-sizing:border-box}
.pmwf-page{max-width:880px;margin:0 auto;padding:22px 20px 34px}
.pmwf-context{display:flex;align-items:center;gap:8px;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
.pmwf-context strong{overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-weight:600}
.pmwf-context span{overflow:hidden;text-overflow:ellipsis}
.pmwf-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin:22px 0 14px}
.pmwf-heading h1{margin:0;font-size:19px;line-height:1.25}
.pmwf-filter{flex:none;border-radius:5px;padding:4px 7px;color:#4c9aff;background:#172a40;font-size:11px;white-space:nowrap}
.pmwf-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pmwf-search{min-width:170px;flex:1 1 190px}
.pmwf-select,.pmwf-input,.pmwf-area{border:0.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;padding:7px 9px;font:inherit;font-size:13px;min-width:0;width:100%}
.pmwf-select{width:auto;min-width:112px}
.pmwf-btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;min-height:33px;padding:7px 11px;font:inherit;font-size:13px;cursor:pointer;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.pmwf-btn.secondary{background:transparent;border:0.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
.pmwf-btn.small{min-height:27px;padding:4px 8px;font-size:12px}
.pmwf-btn:disabled{opacity:.45;cursor:not-allowed}
.pmwf-list{display:flex;flex-direction:column;gap:8px}
.pmwf-flow{overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base))}
.pmwf-summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;align-items:center;width:100%;min-height:52px;padding:9px 12px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.pmwf-summary:hover{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}
.pmwf-dot{width:8px;height:8px;border-radius:50%;flex:none}
.pmwf-dot.running{background:#37b76a}.pmwf-dot.blocked,.pmwf-dot.failed{background:#e26d6d}.pmwf-dot.waiting{background:#d99a26}.pmwf-dot.completed{background:#4c9aff}
.pmwf-name{min-width:0}.pmwf-name strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px}
.pmwf-name span{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px}
.pmwf-time{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}
.pmwf-pill{min-width:48px;border-radius:4px;padding:3px 6px;text-align:center;font-size:10.5px;white-space:nowrap}
.pmwf-pill.running{color:#37b76a;background:#16301f}.pmwf-pill.blocked,.pmwf-pill.failed{color:#e26d6d;background:#3d2222}.pmwf-pill.waiting{color:#d99a26;background:#372c14}.pmwf-pill.completed,.pmwf-pill.cancelled{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.pmwf-detail{border-top:1px solid var(--dsw-alias-border-l2);padding:4px 12px 12px}
.pmwf-nodes{margin:0;padding:0;list-style:none}
.pmwf-node{display:grid;grid-template-columns:58px minmax(0,1fr);gap:4px 10px;align-items:start;padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.pmwf-node:last-child{border-bottom:0}
.pmwf-node.branch{margin-left:9px;padding-left:10px;border-left:2px solid var(--dsw-alias-border-l2)}
.pmwf-state{border-radius:4px;padding:2px 4px;text-align:center;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);font-size:10px;white-space:nowrap}
.pmwf-node.completed .pmwf-state{color:#37b76a;background:#16301f}
.pmwf-node.current .pmwf-state{color:#4c9aff;background:#172a40}
.pmwf-node.blocked .pmwf-state,.pmwf-node.failed .pmwf-state{color:#e26d6d;background:#3d2222}
.pmwf-node-main{min-width:0}.pmwf-node-main strong{display:block;font-size:12.5px}.pmwf-node-main span{display:block;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.4}
.pmwf-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.pmwf-nested{margin-top:9px;background:var(--dsw-alias-bg-base)}
.pmwf-nested-summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:8px;align-items:center}
.pmwf-nested-summary span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px}
.pmwf-form{display:grid;gap:7px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l3)}
.pmwf-deliverables{display:grid;gap:8px;margin-top:9px;padding-top:9px;border-top:1px dashed var(--dsw-alias-border-l3)}
.pmwf-deliverable-heading{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.02em}
.pmwf-deliverable{display:grid;gap:5px;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}
.pmwf-deliverable-title{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}.pmwf-deliverable-title strong{font-size:12.5px}.pmwf-deliverable-title span{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}
.pmwf-deliverable-state{border-radius:4px;padding:2px 5px !important;background:var(--dsw-alias-bg-base)}.pmwf-deliverable-state.submitted{color:#37b76a;background:#16301f}.pmwf-deliverable-state.rejected{color:#e26d6d;background:#3d2222}
.pmwf-deliverable-description,.pmwf-deliverable-value,.pmwf-deliverable-meta{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45;overflow-wrap:anywhere}
.pmwf-deliverable-value{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.pmwf-deliverable-form{display:grid;gap:6px}.pmwf-file{font:inherit;font-size:12px;color:var(--dsw-alias-label-primary)}
.pmwf-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pmwf-note{padding:8px 10px;border-radius:6px;font-size:12px;line-height:1.45;overflow-wrap:anywhere}
.pmwf-note.success{color:#37b76a;background:#16301f}.pmwf-note.error{color:#e26d6d;background:#3d2222}.pmwf-note.warning{color:#d99a26;background:#372c14}.pmwf-note.info{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.pmwf-empty{padding:34px 16px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;line-height:1.6}
.pmwf-section{border-top:0.5px solid var(--dsw-alias-border-l2);padding-top:16px;display:grid;gap:12px}
.pmwf-card{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:11px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));display:grid;gap:9px}
.pmwf-title{margin:0;font-size:15px}.pmwf-label{color:var(--dsw-alias-label-secondary);font-size:12px}
.pmwf-grid{display:grid;gap:9px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.pmwf-issues{margin:0;padding-left:18px;font-size:12px;line-height:1.55}
.pmwf-graph{display:grid;gap:6px}.pmwf-graph-node{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);font-size:12px}
.pmwf-graph-node.branch{margin-left:16px}.pmwf-type{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:10.5px}
.pmwf-definition-list{display:grid;gap:9px}
.pmwf-definition{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:9px;padding:9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base))}
.pmwf-definition strong{font-size:13px}.pmwf-definition span{color:var(--dsw-alias-label-secondary);font-size:11px}
.pmwf-definition-main{min-width:0}.pmwf-definition-main>div{margin-top:3px;line-height:1.45;overflow-wrap:anywhere}.pmwf-actions-right{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}
@media(max-width:560px){.pmwf-page{padding:18px 12px 28px}.pmwf-heading{flex-direction:column;gap:8px}.pmwf-summary{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"name name pill" "meta meta time" "spacer spacer spacer";align-items:start;row-gap:6px}.pmwf-name{grid-area:name}.pmwf-name span{white-space:normal}.pmwf-time{grid-area:time}.pmwf-pill{grid-area:pill}.pmwf-select{width:100%}}
`;

    function getToken() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const token = getToken();
      const headers = { ...options.headers };
      if (options.body instanceof FormData) {
        if (token !== null) headers.authorization = `Bearer ${token}`;
        const response = await fetch(path, {
          ...options,
          headers,
          cache: "no-store",
        });
        return await parseJsonResponse(response);
      }
      if (options.body !== undefined)
        headers["content-type"] = "application/json";
      if (token !== null) headers.authorization = `Bearer ${token}`;
      const response = await fetch(path, {
        ...options,
        headers,
        cache: "no-store",
      });
      return await parseJsonResponse(response);
    }

    async function parseJsonResponse(response) {
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

    async function startWorkflowFromTab(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest(".pmwf-start-submit");
      if (!button || button.disabled) return;
      const form = button.closest(".pmwf-form");
      if (!form) return;
      const workspaceId = form.getAttribute("data-workspace-id") ?? "";
      const sessionId = form.getAttribute("data-session-id") ?? "";
      const definitionId = form.querySelector("select")?.value ?? "";
      const title = form.querySelector(".pmwf-start-title")?.value.trim() ?? "";
      if (!workspaceId || !definitionId || !title) return;

      const original = button.textContent;
      button.disabled = true;
      button.textContent = "启动中";
      try {
        await request("/api/collab/workflow/instances/start", {
          method: "POST",
          body: JSON.stringify({
            workspaceId,
            definitionId,
            title,
            sessionId: sessionId || undefined,
            relatedSessionIds: [],
          }),
        });
        form.querySelector(".pmwf-start-title").value = "";
        window.dispatchEvent(
          new CustomEvent("pluginmax:workflow-refresh", {
            detail: { kind: "success", message: "已启动工作流" },
          }),
        );
      } catch (cause) {
        window.dispatchEvent(
          new CustomEvent("pluginmax:workflow-refresh", {
            detail: { kind: "error", message: friendly(cause) },
          }),
        );
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }

    function friendly(cause) {
      if (cause instanceof Error) {
        if (
          cause.code === "conflict" &&
          /^definition version already exists:/i.test(cause.message)
        ) {
          return "该模板版本已存在。请把 Markdown 元信息里的 version 改成新版本号，或换一个流程 key。";
        }
        return cause.message;
      }
      return String(cause);
    }

    function statusText(value) {
      return (
        {
          running: "运行中",
          waiting: "等待",
          blocked: "阻塞",
          completed: "完成",
          failed: "失败",
          cancelled: "已取消",
          delegated: "已转交",
          ready: "可执行",
          skipped: "跳过",
        }[value] ?? value
      );
    }

    function pillClass(value) {
      return [
        "running",
        "waiting",
        "blocked",
        "completed",
        "failed",
        "cancelled",
      ].includes(value)
        ? value
        : "cancelled";
    }

    function timeShort(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const sameYear = date.getFullYear() === new Date().getFullYear();
      return date.toLocaleString(undefined, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        ...(sameYear ? {} : { year: "numeric" }),
      });
    }

    function nodeTypeLabel(value) {
      return (
        {
          task: "任务",
          service: "服务",
          approval: "审批",
          decision: "判断",
          subworkflow: "子流程",
        }[value] ?? value
      );
    }

    function workspaceLabel(workspace) {
      const title = workspace.title?.trim();
      const path = workspace.path?.trim();
      if (title && path) return `${title} · ${path}`;
      if (path) return path;
      if (title) return title;
      return "未命名工作区";
    }

    function executorLabel(node) {
      const kind =
        { system: "系统", user: "用户", agent: "Agent" }[node.executor.kind] ??
        node.executor.kind;
      return `${kind} · ${node.executor.label ?? node.executor.id}`;
    }

    function approverLabel(approver, memberNames) {
      const name = memberNames.get(approver.id) ?? approver.name ?? approver.id;
      return `${approver.kind === "agent" ? "Agent" : "用户"} · ${name}`;
    }

    function deliverableTypeLabel(value) {
      return { file: "文件", text: "文本", link: "链接" }[value] ?? value;
    }

    function deliverableStatusLabel(value) {
      return (
        { pending: "待提交", submitted: "已提交", rejected: "已退回" }[value] ??
        "待提交"
      );
    }

    function missingDeliverables(node, state) {
      return (node.deliverables ?? []).filter((requirement) => {
        if (!requirement.required) return false;
        const current = state?.deliverables?.[requirement.key];
        return current?.status !== "submitted";
      });
    }

    function canSubmitDeliverable(node, actor, manager) {
      if (!actor || (actor.kind !== "user" && !actor.id)) return false;
      if (manager) return true;
      if (node.type === "service" || node.type === "subworkflow") return false;
      const responsibleId =
        node.executor.kind === "agent"
          ? node.responsible?.id
          : (node.responsible?.id ?? node.executor.id);
      if (node.executor.kind === "user" && node.executor.id === actor.id)
        return true;
      return responsibleId === actor.id;
    }

    function canCompleteNode(node, actor, manager) {
      if (!actor || actor.kind !== "user") return false;
      if (manager) return true;
      if (node.type === "service" || node.type === "subworkflow") return false;
      const responsible = node.responsible;
      if (node.executor.kind === "agent") {
        return responsible?.kind === "user" && responsible.id === actor.id;
      }
      if (node.executor.kind === "user" && node.executor.id === actor.id) {
        return true;
      }
      return responsible?.kind === "user" && responsible.id === actor.id;
    }

    function completeButtonLabel(node, actor, manager, memberNames) {
      const missing = missingDeliverables(node, {});
      if (missing.length > 0) return `缺少 ${missing.length} 项交付物`;
      if (canCompleteNode(node, actor, manager)) return "完成";
      if (node.executor.kind === "agent" && node.responsible === undefined) {
        return "Owner/Admin 可完成";
      }
      const responsibleId =
        node.executor.kind === "agent"
          ? node.responsible?.id
          : (node.responsible?.id ?? node.executor.id);
      const name = memberNames.get(responsibleId) ?? responsibleId;
      return name ? `由 ${name} 完成` : "无完成权限";
    }

    function DeliverablePanel(props) {
      const { node, state, detail, instance } = props;
      if ((node.deliverables ?? []).length === 0) return null;
      const manager = props.isManager;
      const editable =
        ["ready", "running", "waiting"].includes(state?.status) &&
        canSubmitDeliverable(node, detail.actor, manager);
      return jsxRuntime.jsxs("div", {
        className: "pmwf-deliverables",
        children: [
          node.executor.kind === "agent"
            ? jsxRuntime.jsx("div", {
                className: "pmwf-note info",
                children: "本节点暂不自动运行；当前由人类代交交付物。",
              })
            : null,
          jsxRuntime.jsx("div", {
            className: "pmwf-deliverable-heading",
            children: "交付要求",
          }),
          node.deliverables.map((requirement) => {
            const key = `${instance.id}:${node.id}:${requirement.key}`;
            const currentState = state?.deliverables?.[requirement.key];
            const submissions = (detail.submissions ?? []).filter(
              (item) =>
                item.nodeId === node.id &&
                item.requirementKey === requirement.key,
            );
            const latest =
              submissions.find(
                (item) => item.id === currentState?.latestSubmissionId,
              ) ?? submissions.at(-1);
            const draft = props.drafts[key] ?? "";
            const selected = props.files[key] ?? [];
            const submitDisabled =
              props.busy !== "" ||
              !editable ||
              (requirement.type === "text" &&
                draft.trim().length < (requirement.minTextLength ?? 1)) ||
              (requirement.type === "link" && draft.trim() === "") ||
              (requirement.type === "file" && selected.length === 0);
            return jsxRuntime.jsxs(
              "div",
              {
                className: "pmwf-deliverable",
                children: [
                  jsxRuntime.jsxs("div", {
                    className: "pmwf-deliverable-title",
                    children: [
                      jsxRuntime.jsx("strong", { children: requirement.title }),
                      jsxRuntime.jsxs("span", {
                        children: [
                          requirement.required ? "必交" : "选交",
                          " · ",
                          deliverableTypeLabel(requirement.type),
                        ],
                      }),
                      jsxRuntime.jsx("span", {
                        className: `pmwf-deliverable-state ${currentState?.status ?? "pending"}`,
                        children: deliverableStatusLabel(
                          currentState?.status ?? "pending",
                        ),
                      }),
                    ],
                  }),
                  requirement.description
                    ? jsxRuntime.jsx("span", {
                        className: "pmwf-deliverable-description",
                        children: requirement.description,
                      })
                    : null,
                  latest
                    ? jsxRuntime.jsxs("span", {
                        className: "pmwf-deliverable-value",
                        children: [
                          latest.type === "file"
                            ? (latest.artifacts ?? [])
                                .map((artifact) => artifact.fileName)
                                .join("、") || "文件已提交"
                            : latest.value,
                          jsxRuntime.jsx("span", {
                            className: "pmwf-deliverable-meta",
                            children: ` · ${latest.submittedByName}${
                              latest.onBehalfOf
                                ? ` 代 ${latest.onBehalfOf}`
                                : ""
                            } · ${timeShort(latest.submittedAt)}`,
                          }),
                          latest.type === "file" &&
                          (latest.artifacts ?? []).length > 0
                            ? jsxRuntime.jsx("button", {
                                type: "button",
                                className: "pmwf-btn secondary small",
                                onClick: () =>
                                  props.onDownload(
                                    latest.id,
                                    latest.artifacts[0]?.id,
                                  ),
                                children: "下载",
                              })
                            : null,
                        ],
                      })
                    : null,
                  editable
                    ? jsxRuntime.jsxs("div", {
                        className: "pmwf-deliverable-form",
                        children: [
                          requirement.type === "text"
                            ? jsxRuntime.jsx("textarea", {
                                className: "pmwf-area",
                                rows: 3,
                                value: draft,
                                placeholder: requirement.description,
                                onChange: (event) =>
                                  props.onDraft(key, event.target.value),
                              })
                            : null,
                          requirement.type === "link"
                            ? jsxRuntime.jsx("input", {
                                className: "pmwf-input",
                                value: draft,
                                placeholder: "https://...",
                                onChange: (event) =>
                                  props.onDraft(key, event.target.value),
                              })
                            : null,
                          requirement.type === "file"
                            ? jsxRuntime.jsx("input", {
                                className: "pmwf-file",
                                type: "file",
                                multiple: requirement.maxFiles > 1,
                                accept: requirement.accept.join(","),
                                onChange: (event) =>
                                  props.onFile(
                                    key,
                                    Array.from(event.target.files ?? []),
                                  ),
                              })
                            : null,
                          jsxRuntime.jsxs("div", {
                            className: "pmwf-row",
                            children: [
                              jsxRuntime.jsx("button", {
                                type: "button",
                                className: "pmwf-btn secondary small",
                                disabled: submitDisabled,
                                onClick: () =>
                                  props.onSubmit(node, requirement),
                                children:
                                  props.busy === `deliverable:${key}`
                                    ? "提交中"
                                    : "提交交付物",
                              }),
                              requirement.type === "text"
                                ? jsxRuntime.jsxs("span", {
                                    className: "pmwf-label",
                                    children: [
                                      draft.trim().length,
                                      "/",
                                      requirement.minTextLength,
                                      " 字",
                                    ],
                                  })
                                : null,
                            ],
                          }),
                        ],
                      })
                    : null,
                ],
              },
              requirement.key,
            );
          }),
        ],
      });
    }

    function currentStates(instance) {
      return Object.values(instance.nodes).filter((node) =>
        ["ready", "running", "blocked"].includes(node.status),
      );
    }

    function currentSummary(instance, definition) {
      if (["completed", "cancelled"].includes(instance.status)) {
        return statusText(instance.status);
      }
      const states = currentStates(instance);
      if (states.length === 0) {
        return instance.status === "blocked"
          ? "数据状态异常，请联系管理员检查"
          : "无可执行节点";
      }
      if (definition?.graph.nodes?.length) {
        const currentNodeId = states[0].nodeId;
        return definition.graph.nodes
          .map((node) =>
            node.id === currentNodeId ? `【${node.name}】` : node.name,
          )
          .join("-");
      }
      return `当前：${states
        .map(
          (state) =>
            definition?.graph.nodes.find((node) => node.id === state.nodeId)
              ?.name ?? state.nodeId,
        )
        .join("、")}`;
    }

    function statusBadgeText(instance, definition) {
      if (["completed", "cancelled"].includes(instance.status)) {
        return statusText(instance.status);
      }
      const current = currentStates(instance)[0];
      if (!current) {
        return instance.status === "blocked"
          ? `${statusText(instance.status)} · 数据状态异常`
          : statusText(instance.status);
      }
      const name =
        definition?.graph.nodes.find((node) => node.id === current.nodeId)
          ?.name ?? current.nodeId;
      return `${statusText(instance.status)} · ${name}`;
    }

    function isBranch(definition, nodeId) {
      return (
        definition?.graph.edges.filter((edge) => edge.to === nodeId).length > 1
      );
    }

    function parseLoopLimit(expression) {
      const match =
        /^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*(>=|<=|>|<|==|===)\s*(\d+)\s*$/.exec(
          expression ?? "",
        );
      if (match === null) return null;
      if (match[2] !== ">=" && match[2] !== "===") return null;
      const limit = Number(match[3]);
      return Number.isFinite(limit) && limit > 0 ? limit : null;
    }

    function loopRules(definition) {
      return (definition?.graph.edges ?? [])
        .filter((edge) => edge.breakCondition !== undefined)
        .map((edge) => {
          const nodeById = (id) =>
            definition?.graph.nodes.find((node) => node.id === id);
          return {
            edge,
            source: nodeById(edge.from),
            target: nodeById(edge.to),
            limit: parseLoopLimit(edge.breakCondition),
          };
        });
    }

    function loopHint(rule, instance) {
      const targetName = rule.target?.name ?? rule.edge.to;
      const sourceName = rule.source?.name ?? rule.edge.from;
      const current = Number(instance?.nodes?.[rule.edge.to]?.attempts ?? 1);
      if (rule.limit === null) {
        return `循环保护：${sourceName}未通过时返回「${targetName}」。触发条件：${rule.edge.breakCondition}`;
      }
      return `循环保护：${sourceName}未通过时返回「${targetName}」，最多尝试 ${rule.limit} 次；超出后流程阻断。当前第 ${current} / ${rule.limit} 次。`;
    }

    function triggeredLoopRule(rules, nodeId, state) {
      if (state?.note?.startsWith("已触发 break") !== true) return undefined;
      return rules.find((rule) => rule.edge.to === nodeId);
    }

    function nodeClass(state) {
      if (state.status === "ready" || state.status === "running")
        return "current";
      if (state.status === "waiting") return "waiting";
      if (["blocked", "failed"].includes(state.status)) return state.status;
      if (state.status === "completed") return "completed";
      return "waiting";
    }

    function Feedback({ error, notice }) {
      if (error)
        return jsxRuntime.jsx("div", {
          className: "pmwf-note error",
          role: "alert",
          children: error,
        });
      if (notice)
        return jsxRuntime.jsx("div", {
          className: "pmwf-note success",
          children: notice,
        });
      return null;
    }

    function WorkflowTab(props) {
      const sessionId = props.sessionId;
      const workspaceSnapshot = props.useWorkspaces?.((state) => state);
      const sessionSnapshot = props.useSessions?.((state) => state);
      const nativeWorkspace = workspaceSnapshot?.items?.find((item) =>
        item.sessionIds.includes(sessionId),
      );
      const sessionTitle =
        sessionSnapshot?.byId?.[sessionId]?.displayTitle ??
        sessionSnapshot?.byId?.[sessionId]?.title ??
        "当前会话";

      const [phase, setPhase] = react.useState("loading");
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [me, setMe] = react.useState(null);
      const [members, setMembers] = react.useState([]);
      const [workspaceId, setWorkspaceId] = react.useState("");
      const [workspaceOptions, setWorkspaceOptions] = react.useState([]);
      const [definitions, setDefinitions] = react.useState([]);
      const [instances, setInstances] = react.useState([]);
      const [sessionOnly, setSessionOnly] = react.useState(true);
      const [statusFilter, setStatusFilter] = react.useState("all");
      const [query, setQuery] = react.useState("");
      const [openId, setOpenId] = react.useState("");
      const [detail, setDetail] = react.useState(null);
      const [nestedDetails, setNestedDetails] = react.useState({});
      const [busy, setBusy] = react.useState("");
      const [decisionValues, setDecisionValues] = react.useState("{}");
      const [gateForm, setGateForm] = react.useState(null);
      const [tokenVersion, setTokenVersion] = react.useState(0);
      const [deliverableDrafts, setDeliverableDrafts] = react.useState({});
      const [deliverableFiles, setDeliverableFiles] = react.useState({});
      const [startDefinitionId, setStartDefinitionId] = react.useState("");

      const notify = (text) => {
        setError("");
        setNotice(text);
      };
      const fail = (cause) => {
        setNotice("");
        setError(friendly(cause));
      };
      const memberNames = react.useMemo(
        () =>
          new Map(
            members.map((item) => [item.userId, item.name ?? item.userId]),
          ),
        [members],
      );
      const effectiveWorkspaceId = nativeWorkspace?.workspaceId ?? workspaceId;
      const selectedDefinition =
        definitions.find(
          (item) =>
            item.id === startDefinitionId && item.status === "active",
        ) ??
        definitions.find(
          (item) => item.status === "active",
        );
      const canStart = Boolean(
        (selectedDefinition &&
          ["owner", "member"].includes(me?.workspaceRole ?? "")) ||
        me?.role === "admin",
      );

      react.useEffect(() => {
        if (getToken() === null) {
          setPhase("login");
          return;
        }
        let disposed = false;
        (async () => {
          try {
            const [meResult, workspaceResult] = await Promise.all([
              request("/api/collab/auth/me"),
              request("/api/collab/team/workspaces"),
            ]);
            if (disposed) return;
            setMe(meResult.user);
            const options = workspaceResult.workspaces ?? [];
            setWorkspaceOptions(options);
            const nativeId = workspaceSnapshot?.items?.find((item) =>
              item.sessionIds.includes(sessionId),
            )?.workspaceId;
            const initial =
              options.find((item) => item.id === nativeId)?.id ??
              options.find((item) => item.isMember)?.id ??
              options[0]?.id ??
              "";
            setWorkspaceId(initial);
            setPhase("ready");
          } catch (cause) {
            if (!disposed) {
              fail(cause);
              if (cause.status === 401) setPhase("login");
              else setPhase("error");
            }
          }
        })();
        return () => {
          disposed = true;
        };
      }, [tokenVersion]);

      react.useEffect(() => {
        const synchronize = () => setTokenVersion((version) => version + 1);
        window.addEventListener("pluginmax:collab-token", synchronize);
        return () =>
          window.removeEventListener("pluginmax:collab-token", synchronize);
      }, []);

      const load = react.useCallback(
        async (silent = true) => {
          if (!effectiveWorkspaceId) return;
          try {
            const querySession =
              sessionOnly && sessionId
                ? `&sessionId=${encodeURIComponent(sessionId)}`
                : "";
            const results = await Promise.allSettled([
              request(
                `/api/collab/workflow/definitions?workspaceId=${encodeURIComponent(effectiveWorkspaceId)}`,
              ),
              request(
                `/api/collab/workflow/instances?workspaceId=${encodeURIComponent(effectiveWorkspaceId)}${querySession}`,
              ),
              request(
                `/api/collab/team/members?workspaceId=${encodeURIComponent(effectiveWorkspaceId)}`,
              ),
            ]);
            const definitionResult =
              results[0].status === "fulfilled" ? results[0].value : null;
            const instanceResult =
              results[1].status === "fulfilled" ? results[1].value : null;
            const memberResult =
              results[2].status === "fulfilled" ? results[2].value : null;
            if (definitionResult === null || instanceResult === null) {
              throw results[0].status === "rejected"
                ? results[0].reason
                : results[1].reason;
            }
            setDefinitions(definitionResult.definitions ?? []);
            setInstances(instanceResult.instances ?? []);
            if (memberResult !== null) {
              setMembers(memberResult.members ?? []);
              setMe((current) => {
                if (!current) return current;
                const workspaceRole = (memberResult.members ?? []).find(
                  (member) => member.userId === current.id,
                )?.memberRole;
                return workspaceRole ? { ...current, workspaceRole } : current;
              });
            }
            if (!silent) notify("已刷新");
          } catch (cause) {
            if (cause.status === 401) setPhase("login");
            if (!silent) fail(cause);
          }
        },
        [effectiveWorkspaceId, sessionOnly, sessionId],
      );

      react.useEffect(() => {
        const synchronize = async (event) => {
          const detail = event.detail ?? {};
          if (detail.kind === "error") {
            setNotice("");
            setError(detail.message ?? "操作失败");
          } else {
            setError("");
            setNotice(detail.message ?? "已刷新");
          }
          await load();
        };
        window.addEventListener("pluginmax:workflow-refresh", synchronize);
        return () =>
          window.removeEventListener("pluginmax:workflow-refresh", synchronize);
      }, [load]);

      const loadDetail = react.useCallback(
        async (instanceId) => {
          if (!instanceId || !effectiveWorkspaceId) return;
          try {
            const result = await request(
              `/api/collab/workflow/instances/detail?workspaceId=${encodeURIComponent(effectiveWorkspaceId)}&instanceId=${encodeURIComponent(instanceId)}`,
              );
            setDetail(result);
            return result;
          } catch (cause) {
            fail(cause);
          }
        },
        [effectiveWorkspaceId],
      );

      const loadNestedDetail = react.useCallback(
        async (instanceId) => {
          if (!instanceId || !effectiveWorkspaceId) return null;
          try {
            const result = await request(
              `/api/collab/workflow/instances/detail?workspaceId=${encodeURIComponent(effectiveWorkspaceId)}&instanceId=${encodeURIComponent(instanceId)}`,
            );
            setNestedDetails((current) => ({
              ...current,
              [instanceId]: result,
            }));
            return result;
          } catch (cause) {
            fail(cause);
            return null;
          }
        },
        [effectiveWorkspaceId],
      );

      react.useEffect(() => {
        if (phase !== "ready" || !effectiveWorkspaceId) return;
        load();
        const timer = setInterval(() => {
          if (document.visibilityState === "visible") load();
        }, 8000);
        return () => clearInterval(timer);
      }, [load, phase, effectiveWorkspaceId]);

      react.useEffect(() => {
        setDetail(null);
        setGateForm(null);
      }, [effectiveWorkspaceId]);

      const expand = async (instanceId) => {
        const next = openId === instanceId ? "" : instanceId;
        setOpenId(next);
        setDetail(null);
        setGateForm(null);
        if (next) {
          const loaded = await loadDetail(next);
          const childIds = Object.values(loaded?.instance?.nodes ?? {})
            .map((state) => state.childInstanceId)
            .filter(Boolean);
          await Promise.all(childIds.map((childId) => loadNestedDetail(childId)));
        }
      };

      const act = async (key, path, body, message) => {
        if (busy) return;
        setBusy(key);
        try {
          await request(path, { method: "POST", body: JSON.stringify(body) });
          notify(message);
          await load();
          const loaded = openId ? await loadDetail(openId) : null;
          if (loaded) {
            const childIds = Object.values(loaded.instance.nodes ?? {})
              .map((state) => state.childInstanceId)
              .filter(Boolean);
            await Promise.all(
              childIds.map((childId) => loadNestedDetail(childId)),
            );
          }
          setGateForm(null);
          setDecisionValues("{}");
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const setDeliverableDraft = (key, value) =>
        setDeliverableDrafts((current) => ({ ...current, [key]: value }));
      const setDeliverableFile = (key, files) =>
        setDeliverableFiles((current) => ({ ...current, [key]: files }));
      const submitDeliverable = async (node, requirement) => {
        const key = `${openId}:${node.id}:${requirement.key}`;
        if (busy !== "") return;
        setBusy(`deliverable:${key}`);
        try {
          if (requirement.type === "file") {
            const form = new FormData();
            form.append("instanceId", openId);
            form.append("nodeId", node.id);
            form.append("requirementKey", requirement.key);
            for (const file of deliverableFiles[key] ?? [])
              form.append("files", file, file.name);
            await request("/api/collab/workflow/deliverables/file", {
              method: "POST",
              body: form,
            });
            setDeliverableFile(key, []);
          } else {
            await request(
              `/api/collab/workflow/deliverables/${requirement.type}`,
              {
                method: "POST",
                body: JSON.stringify({
                  instanceId: openId,
                  nodeId: node.id,
                  requirementKey: requirement.key,
                  value: (deliverableDrafts[key] ?? "").trim(),
                }),
              },
            );
          }
          setDeliverableDraft(key, "");
          notify(`已提交「${requirement.title}」`);
          await load();
          await loadDetail(openId);
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };
      const downloadDeliverable = async (submissionId, artifactId) => {
        if (busy !== "") return;
        setBusy(`download:${submissionId}`);
        try {
          const token = getToken();
          const query = new URLSearchParams({ submissionId });
          if (artifactId) query.set("artifactId", artifactId);
          const response = await fetch(
            `/api/collab/workflow/deliverables/download?${query}`,
            {
              cache: "no-store",
              headers: token ? { authorization: `Bearer ${token}` } : {},
            },
          );
          if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
              const body = await response.json();
              message = body.error?.message ?? message;
            } catch {
              // Keep the HTTP status as the fallback message.
            }
            throw new Error(message);
          }
          const blob = await response.blob();
          const disposition = response.headers.get("content-disposition") ?? "";
          const utfName =
            /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1] ?? "";
          const asciiName =
            /filename="([^"]+)"/.exec(disposition)?.[1] ?? "deliverable";
          const fileName = utfName ? decodeURIComponent(utfName) : asciiName;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
          notify("已下载交付物");
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const pendingApproverKey = (state, actor) =>
        Object.keys(state.approvals ?? {}).find((key) => {
          const approval = state.approvals[key];
          return (
            approval.status === "pending" &&
            approval.approver.kind === "user" &&
            approval.approver.id === actor?.id
          );
        });
      const isManager = me?.role === "admin" || me?.workspaceRole === "owner";

      const nestedChildCard = (childInstanceId) => {
        const childDetail = nestedDetails[childInstanceId];
        const childInstance = childDetail?.instance;
        const childDefinition = childInstance
          ? definitions.find((item) => item.id === childInstance.definitionId)
          : definitions.find(
              (item) =>
                instances.find((instance) => instance.id === childInstanceId)
                  ?.definitionId === item.id,
            );
        const childStatus =
          childInstance?.status ??
          instances.find((instance) => instance.id === childInstanceId)
            ?.status ??
          "running";
        return jsxRuntime.jsxs("div", {
          className: "pmwf-card pmwf-nested",
          children: [
            jsxRuntime.jsxs("div", {
              className: "pmwf-nested-summary",
              children: [
                jsxRuntime.jsx("span", {
                  className: `pmwf-dot ${pillClass(childStatus)}`,
                }),
                jsxRuntime.jsxs("strong", {
                  children:
                    childInstance?.title ?? "子流程实例加载中…",
                }),
                jsxRuntime.jsx("span", {
                  children: childDefinition
                    ? `${childDefinition.name} v${childDefinition.version}`
                    : "",
                }),
                jsxRuntime.jsx("span", {
                  className: `pmwf-pill ${pillClass(childStatus)}`,
                  children: statusText(childStatus),
                }),
              ],
            }),
            childInstance === undefined
              ? jsxRuntime.jsx("div", {
                  className: "pmwf-note info",
                  children: "加载子流程详情…",
                })
              : jsxRuntime.jsx("ol", {
                  className: "pmwf-nodes",
                  children: (childDefinition?.graph.nodes ?? []).map((node) => {
                    const state = childInstance.nodes[node.id];
                    const approvalKey = pendingApproverKey(state, detail.actor);
                    const actionable =
                      state?.status === "ready" ||
                      (approvalKey !== undefined &&
                        ["ready", "waiting"].includes(state?.status));
                    const pendingApproverNames =
                      node.type === "approval"
                        ? Object.values(state?.approvals ?? {})
                            .filter(
                              (approval) => approval.status === "pending",
                            )
                            .map((approval) =>
                              approverLabel(approval.approver, memberNames),
                            )
                            .join("、")
                        : "";
                    return jsxRuntime.jsxs(
                      "li",
                      {
                        className: `pmwf-node ${nodeClass(state)}`,
                        children: [
                          jsxRuntime.jsx("span", {
                            className: "pmwf-state",
                            children: statusText(state?.status ?? "waiting"),
                          }),
                          jsxRuntime.jsxs("div", {
                            className: "pmwf-node-main",
                            children: [
                              jsxRuntime.jsx("strong", { children: node.name }),
                              jsxRuntime.jsx("span", {
                                children: executorLabel(node),
                              }),
                              node.type === "approval"
                                ? jsxRuntime.jsx("span", {
                                    children: Object.values(
                                      state?.approvals ?? {},
                                    )
                                      .map(
                                        (approval) =>
                                          `${approverLabel(approval.approver, memberNames)}：${statusText(approval.status)}`,
                                      )
                                      .join("；"),
                                  })
                                : null,
                              node.type === "approval" &&
                              actionable &&
                              !approvalKey &&
                              pendingApproverNames
                                ? jsxRuntime.jsx("div", {
                                    className: "pmwf-note info",
                                    children: `当前账号不是该审批的审批人。请切换到 ${pendingApproverNames} 登录，或由当前审批人加签给你。`,
                                  })
                                : null,
                              node.type === "approval" &&
                              actionable &&
                              approvalKey
                                ? jsxRuntime.jsxs("div", {
                                    className: "pmwf-actions",
                                    children: [
                                      jsxRuntime.jsx("button", {
                                        type: "button",
                                        className: "pmwf-btn small",
                                        disabled: busy !== "",
                                        onClick: () =>
                                          act(
                                            `approve:${childInstanceId}:${node.id}`,
                                            "/api/collab/workflow/approvals/decide",
                                            {
                                              instanceId: childInstanceId,
                                              nodeId: node.id,
                                              decision: "approved",
                                            },
                                            `已通过「${node.name}」`,
                                          ),
                                        children: "通过",
                                      }),
                                      jsxRuntime.jsx("button", {
                                        type: "button",
                                        className: "pmwf-btn secondary small",
                                        disabled: busy !== "",
                                        onClick: () =>
                                          act(
                                            `reject:${childInstanceId}:${node.id}`,
                                            "/api/collab/workflow/approvals/decide",
                                            {
                                              instanceId: childInstanceId,
                                              nodeId: node.id,
                                              decision: "rejected",
                                            },
                                            `已否决「${node.name}」`,
                                          ),
                                        children: "否决",
                                      }),
                                    ],
                                  })
                                : null,
                            ],
                          }),
                        ],
                      },
                      node.id,
                    );
                  }),
                }),
          ],
        });
      };

      const filtered = instances.filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter)
          return false;
        if (query.trim() === "") return true;
        const needle = query.trim().toLowerCase();
        return (
          item.title.toLowerCase().includes(needle) ||
          item.definitionKey.toLowerCase().includes(needle)
        );
      });

      if (phase === "login") {
        return jsxRuntime.jsx("div", {
          className: "pmwf",
          children: jsxRuntime.jsx("div", {
            className: "pmwf-empty",
            children: "请先在「协作身份」登录。",
          }),
        });
      }
      if (phase === "error") {
        return jsxRuntime.jsx("div", {
          className: "pmwf",
          children: jsxRuntime.jsxs("div", {
            className: "pmwf-empty",
            children: [
              error,
              jsxRuntime.jsx("div", {
                style: { marginTop: 10 },
                children: jsxRuntime.jsx("button", {
                  type: "button",
                  className: "pmwf-btn secondary small",
                  onClick: () => {
                    setPhase("loading");
                    setWorkspaceId("");
                    setPhase("ready");
                  },
                  children: "重试",
                }),
              }),
            ],
          }),
        });
      }

      return jsxRuntime.jsxs("div", {
        className: "pmwf",
        children: [
          jsxRuntime.jsx("style", { children: css }),
          jsxRuntime.jsxs("div", {
            className: "pmwf-page",
            children: [
              jsxRuntime.jsxs("div", {
                className: "pmwf-context",
                children: [
                  jsxRuntime.jsx("strong", {
                    children: workspaceOptions.find(
                      (item) => item.id === effectiveWorkspaceId,
                    )
                      ? workspaceLabel(
                          workspaceOptions.find(
                            (item) => item.id === effectiveWorkspaceId,
                          ),
                        )
                      : (nativeWorkspace?.title ?? "工作区加载中"),
                  }),
                  jsxRuntime.jsx("span", { children: `/ ${sessionTitle}` }),
                ],
              }),
              jsxRuntime.jsxs("div", {
                className: "pmwf-heading",
                children: [
                  jsxRuntime.jsx("h1", { children: "项目工作流" }),
                  jsxRuntime.jsxs("div", {
                    className: "pmwf-filter",
                    children: [
                      sessionOnly ? "当前会话相关" : "工作区全部",
                      " · ",
                      filtered.length,
                      " 条",
                    ],
                  }),
                ],
              }),
              jsxRuntime.jsxs("div", {
                className: "pmwf-toolbar",
                children: [
                  jsxRuntime.jsxs("button", {
                    type: "button",
                    className: "pmwf-btn secondary",
                    "aria-pressed": sessionOnly,
                    onClick: () => setSessionOnly(!sessionOnly),
                    children: [sessionOnly ? "查看工作区全部" : "只看当前会话"],
                  }),
                  jsxRuntime.jsxs("select", {
                    className: "pmwf-select",
                    value: statusFilter,
                    onChange: (event) => setStatusFilter(event.target.value),
                    "aria-label": "按状态过滤",
                    children: [
                      jsxRuntime.jsx("option", {
                        value: "all",
                        children: "全部状态",
                      }),
                      ...[
                        "running",
                        "waiting",
                        "blocked",
                        "completed",
                        "cancelled",
                      ].map((value) =>
                        jsxRuntime.jsx(
                          "option",
                          { value, children: statusText(value) },
                          value,
                        ),
                      ),
                    ],
                  }),
                  jsxRuntime.jsx("input", {
                    className: "pmwf-input pmwf-search",
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                    placeholder: "搜索流程标题或模板",
                  }),
                  jsxRuntime.jsx("button", {
                    type: "button",
                    className: "pmwf-btn secondary",
                    onClick: () => load(false),
                    disabled: busy !== "",
                    children: "刷新",
                  }),
                ],
              }),
              !canStart
                ? jsxRuntime.jsx("div", {
                    className: "pmwf-note info",
                    children:
                      "访客不能发起流程；需要工作区成员、负责人或管理员权限。",
                  })
                : null,
              canStart
                ? jsxRuntime.jsxs("div", {
                    "data-workspace-id": effectiveWorkspaceId,
                    "data-session-id": sessionId ?? "",
                    className: "pmwf-form",
                    children: [
                      jsxRuntime.jsxs("div", {
                        className: "pmwf-row",
                        children: [
                          jsxRuntime.jsxs("select", {
                            className: "pmwf-select",
                            value: selectedDefinition?.id ?? "",
                            required: true,
                            onChange: (event) =>
                              setStartDefinitionId(event.target.value),
                            children: [
                              jsxRuntime.jsx("option", {
                                value: "",
                                children: "选择流程模板",
                              }),
                              ...definitions
                                .filter((item) => item.status === "active")
                                .map((item) =>
                                  jsxRuntime.jsx(
                                    "option",
                                    {
                                      value: item.id,
                                      children: `${item.name} v${item.version}`,
                                    },
                                    item.id,
                                  ),
                                ),
                            ],
                          }),
                          jsxRuntime.jsx("input", {
                            className: "pmwf-input pmwf-start-title",
                            style: { flex: 1, minWidth: 180 },
                            defaultValue: "",
                            placeholder: "例如：订单导出功能",
                            required: true,
                          }),
                          jsxRuntime.jsx("button", {
                            type: "button",
                            className: "pmwf-btn pmwf-start-submit",
                            disabled: busy === "start" || !selectedDefinition?.id,
                            children: busy === "start" ? "启动中" : "启动",
                          }),
                        ],
                      }),
                    ],
                  })
                : null,
              jsxRuntime.jsx(Feedback, { error, notice }),
              filtered.length === 0
                ? jsxRuntime.jsx("div", {
                    className: "pmwf-empty",
                    children: sessionOnly
                      ? "当前会话没有相关流程实例。\n可切换到工作区全部，或发起新流程。"
                      : "当前工作区暂无流程实例。",
                  })
                : jsxRuntime.jsx("div", {
                    className: "pmwf-list",
                    children: filtered.map((instance) => {
                      const definition =
                        definitions.find(
                          (item) => item.definitionId === instance.definitionId,
                        ) ??
                        definitions.find(
                          (item) => item.id === instance.definitionId,
                        );
                      const isOpen = openId === instance.id;
                      return jsxRuntime.jsxs(
                        "article",
                        {
                          className: "pmwf-flow",
                          children: [
                            jsxRuntime.jsxs("button", {
                              type: "button",
                              className: "pmwf-summary",
                              "aria-expanded": isOpen,
                              onClick: () => expand(instance.id),
                              children: [
                                jsxRuntime.jsx("span", {
                                  className: `pmwf-dot ${pillClass(instance.status)}`,
                                }),
                                jsxRuntime.jsxs("span", {
                                  className: "pmwf-name",
                                  children: [
                                    jsxRuntime.jsx("strong", {
                                      children: instance.title,
                                    }),
                                    jsxRuntime.jsxs("span", {
                                      children: [
                                        `${instance.definitionKey} v${instance.definitionVersion} · `,
                                        currentSummary(instance, definition),
                                      ],
                                    }),
                                  ],
                                }),
                                jsxRuntime.jsx("span", {
                                  className: "pmwf-time",
                                  children: timeShort(instance.updatedAt),
                                }),
                                jsxRuntime.jsx("span", {
                                  className: `pmwf-pill ${pillClass(instance.status)}`,
                                  children: statusBadgeText(
                                    instance,
                                    definition,
                                  ),
                                }),
                              ],
                            }),
                            jsxRuntime.jsxs("div", {
                              className: "pmwf-detail",
                              style: { display: isOpen ? "block" : "none" },
                              children: [
                                detail?.instance?.id !== instance.id
                                  ? jsxRuntime.jsx("div", {
                                      className: "pmwf-note info",
                                      children: "加载节点详情…",
                                    })
                                  : jsxRuntime.jsxs(react.Fragment, {
                                      children: [
                                        jsxRuntime.jsx("ol", {
                                          className: "pmwf-nodes",
                                          children: (
                                            definition?.graph.nodes ?? []
                                          ).map((node) => {
                                            const state =
                                              detail.instance.nodes[node.id];
                                            const approvalKey =
                                              pendingApproverKey(
                                                state,
                                                detail.actor,
                                              );
                                            const actionable =
                                              state?.status === "ready" ||
                                              (approvalKey !== undefined &&
                                                ["ready", "waiting"].includes(
                                                  state?.status,
                                                ));
                                            const canCountersign =
                                              node.type === "approval" &&
                                              approvalKey !== undefined;
                                            const pendingApproverNames =
                                              node.type === "approval"
                                                ? Object.values(
                                                    state?.approvals ?? {},
                                                  )
                                                    .filter(
                                                      (approval) =>
                                                        approval.status ===
                                                        "pending",
                                                    )
                                                    .map((approval) =>
                                                      approverLabel(
                                                        approval.approver,
                                                        memberNames,
                                                      ),
                                                    )
                                                    .join("、")
                                                : "";
                                            const activeLoopRules =
                                              loopRules(definition);
                                            const outgoingLoopRule =
                                              activeLoopRules.find(
                                                (rule) =>
                                                  rule.edge.from === node.id,
                                              );
                                            const blockedLoopRule =
                                              triggeredLoopRule(
                                                activeLoopRules,
                                                node.id,
                                                state,
                                              );
                                            return jsxRuntime.jsxs(
                                              "li",
                                              {
                                                className: `pmwf-node ${nodeClass(state)} ${isBranch(definition, node.id) ? "branch" : ""}`,
                                                children: [
                                                  jsxRuntime.jsx("span", {
                                                    className: "pmwf-state",
                                                    children: statusText(
                                                      state?.status ??
                                                        "waiting",
                                                    ),
                                                  }),
                                                  jsxRuntime.jsxs("div", {
                                                    className: "pmwf-node-main",
                                                    children: [
                                                      jsxRuntime.jsx("strong", {
                                                        children: node.name,
                                                      }),
                                                      jsxRuntime.jsxs("span", {
                                                        children: [
                                                          executorLabel(node),
                                                          state?.enteredAt
                                                            ? ` · 进入 ${timeShort(state.enteredAt)}`
                                                            : "",
                                                          state?.note
                                                          ? ` · ${state.note}`
                                                          : "",
                                                        ],
                                                      }),
                                                      outgoingLoopRule
                                                        ? jsxRuntime.jsx(
                                                            "div",
                                                            {
                                                              className:
                                                                "pmwf-note warning",
                                                              children: loopHint(
                                                                outgoingLoopRule,
                                                                detail.instance,
                                                              ),
                                                            },
                                                          )
                                                        : null,
                                                      blockedLoopRule
                                                        ? jsxRuntime.jsx(
                                                            "div",
                                                            {
                                                              className:
                                                                "pmwf-note error",
                                                              children:
                                                                blockedLoopRule.limit ===
                                                                null
                                                                  ? `循环保护已触发，后续流程阻断。触发条件：${blockedLoopRule.edge.breakCondition}`
                                                                  : `已达到尝试上限：最多尝试 ${blockedLoopRule.limit} 次，后续流程已阻断。`,
                                                            },
                                                          )
                                                        : null,
                                                      node.type ===
                                                        "subworkflow" &&
                                                      state?.childInstanceId
                                                        ? nestedChildCard(
                                                            state.childInstanceId,
                                                          )
                                                        : null,
                                                      node.type === "approval"
                                                        ? jsxRuntime.jsx(
                                                            "span",
                                                            {
                                                              children:
                                                                Object.values(
                                                                  state?.approvals ??
                                                                    {},
                                                                )
                                                                  .map(
                                                                    (
                                                                      approval,
                                                                    ) =>
                                                                      `${approverLabel(approval.approver, memberNames)}：${statusText(approval.status)}`,
                                                                  )
                                                                  .join("；"),
                                                            },
                                                          )
                                                        : null,
                                                      node.type ===
                                                        "approval" &&
                                                      actionable &&
                                                      !approvalKey &&
                                                      pendingApproverNames
                                                        ? jsxRuntime.jsx(
                                                            "div",
                                                            {
                                                              className:
                                                                "pmwf-note info",
                                                              children: `当前账号不是该审批的审批人。请切换到 ${pendingApproverNames} 登录，或由当前审批人加签给你。`,
                                                            },
                                                          )
                                                        : null,
                                                      DeliverablePanel({
                                                        node,
                                                        state,
                                                        detail,
                                                        instance,
                                                        isManager,
                                                        busy,
                                                        drafts:
                                                          deliverableDrafts,
                                                        files: deliverableFiles,
                                                        onDraft:
                                                          setDeliverableDraft,
                                                        onFile:
                                                          setDeliverableFile,
                                                        onSubmit:
                                                          submitDeliverable,
                                                        onDownload:
                                                          downloadDeliverable,
                                                      }),
                                                      actionable
                                                        ? jsxRuntime.jsxs(
                                                            "div",
                                                            {
                                                              className:
                                                                "pmwf-actions",
                                                              children: [
                                                                [
                                                                  "task",
                                                                  "service",
                                                                ].includes(
                                                                  node.type,
                                                                )
                                                                  ? jsxRuntime.jsx(
                                                                      "button",
                                                                      {
                                                                        type: "button",
                                                                        className:
                                                                          "pmwf-btn small",
                                                                        disabled:
                                                                          busy !==
                                                                            "" ||
                                                                          missingDeliverables(
                                                                            node,
                                                                            state,
                                                                          )
                                                                            .length >
                                                                            0 ||
                                                                          !canCompleteNode(
                                                                            node,
                                                                            detail.actor,
                                                                            isManager,
                                                                          ),
                                                                        onClick:
                                                                          () =>
                                                                            act(
                                                                              `complete:${node.id}`,
                                                                              "/api/collab/workflow/nodes/complete",
                                                                              {
                                                                                instanceId:
                                                                                  instance.id,
                                                                                nodeId:
                                                                                  node.id,
                                                                              },
                                                                              `已完成「${node.name}」`,
                                                                            ),
                                                                        children: completeButtonLabel(
                                                                          node,
                                                                          detail.actor,
                                                                          isManager,
                                                                          memberNames,
                                                                        ),
                                                                      },
                                                                    )
                                                                  : null,
                                                                node.type ===
                                                                  "approval" &&
                                                                approvalKey
                                                                  ? [
                                                                      jsxRuntime.jsx(
                                                                        "button",
                                                                        {
                                                                          type: "button",
                                                                          className:
                                                                            "pmwf-btn small",
                                                                          disabled:
                                                                            busy !==
                                                                            "",
                                                                          onClick:
                                                                            () =>
                                                                              act(
                                                                                `approve:${node.id}`,
                                                                                "/api/collab/workflow/approvals/decide",
                                                                                {
                                                                                  instanceId:
                                                                                    instance.id,
                                                                                  nodeId:
                                                                                    node.id,
                                                                                  decision:
                                                                                    "approved",
                                                                                },
                                                                                "已通过审批",
                                                                              ),
                                                                          children:
                                                                            "通过",
                                                                        },
                                                                        "approve",
                                                                      ),
                                                                      jsxRuntime.jsx(
                                                                        "button",
                                                                        {
                                                                          type: "button",
                                                                          className:
                                                                            "pmwf-btn secondary small",
                                                                          disabled:
                                                                            busy !==
                                                                            "",
                                                                          onClick:
                                                                            () =>
                                                                              act(
                                                                                `reject:${node.id}`,
                                                                                "/api/collab/workflow/approvals/decide",
                                                                                {
                                                                                  instanceId:
                                                                                    instance.id,
                                                                                  nodeId:
                                                                                    node.id,
                                                                                  decision:
                                                                                    "rejected",
                                                                                },
                                                                                "已否决审批",
                                                                              ),
                                                                          children:
                                                                            "否决",
                                                                        },
                                                                        "reject",
                                                                      ),
                                                                      jsxRuntime.jsx(
                                                                        "button",
                                                                        {
                                                                          type: "button",
                                                                          className:
                                                                            "pmwf-btn secondary small",
                                                                          onClick:
                                                                            () =>
                                                                              setGateForm(
                                                                                {
                                                                                  mode: "delegate",
                                                                                  instanceId:
                                                                                    instance.id,
                                                                                  nodeId:
                                                                                    node.id,
                                                                                  toId: "",
                                                                                },
                                                                              ),
                                                                          children:
                                                                            "转交",
                                                                        },
                                                                        "delegate",
                                                                      ),
                                                                    ]
                                                                  : null,
                                                                node.type ===
                                                                  "approval" &&
                                                                canCountersign
                                                                  ? jsxRuntime.jsx(
                                                                      "button",
                                                                      {
                                                                        type: "button",
                                                                        className:
                                                                          "pmwf-btn secondary small",
                                                                        onClick:
                                                                          () =>
                                                                            setGateForm(
                                                                              {
                                                                                mode: "countersign",
                                                                                instanceId:
                                                                                  instance.id,
                                                                                nodeId:
                                                                                  node.id,
                                                                                toId: "",
                                                                              },
                                                                            ),
                                                                        children:
                                                                          "加签",
                                                                      },
                                                                    )
                                                                  : null,
                                                                node.type ===
                                                                "decision"
                                                                  ? jsxRuntime.jsx(
                                                                      "button",
                                                                      {
                                                                        type: "button",
                                                                        className:
                                                                          "pmwf-btn small",
                                                                        onClick:
                                                                          () => {
                                                                            setDecisionValues(
                                                                              JSON.stringify(
                                                                                detail
                                                                                  .instance
                                                                                  .context ??
                                                                                  {},
                                                                                null,
                                                                                2,
                                                                              ),
                                                                            );
                                                                            setGateForm(
                                                                              {
                                                                                mode: "decision",
                                                                                instanceId:
                                                                                  instance.id,
                                                                                nodeId:
                                                                                  node.id,
                                                                              },
                                                                            );
                                                                          },
                                                                        children:
                                                                          "录入判断",
                                                                      },
                                                                    )
                                                                  : null,
                                                              ],
                                                            },
                                                          )
                                                        : null,
                                                      gateForm?.instanceId ===
                                                        instance.id &&
                                                      gateForm.nodeId ===
                                                        node.id
                                                        ? jsxRuntime.jsxs(
                                                            "form",
                                                            {
                                                              className:
                                                                "pmwf-form",
                                                              onSubmit: (
                                                                event,
                                                              ) => {
                                                                event.preventDefault();
                                                                if (
                                                                  gateForm.mode ===
                                                                  "decision"
                                                                ) {
                                                                  let values;
                                                                  try {
                                                                    values =
                                                                      JSON.parse(
                                                                        decisionValues,
                                                                      );
                                                                  } catch {
                                                                    setError(
                                                                      '判断结果必须是 JSON，例如 {"complexity":8}',
                                                                    );
                                                                    return;
                                                                  }
                                                                  act(
                                                                    `decision:${node.id}`,
                                                                    "/api/collab/workflow/decisions/resolve",
                                                                    {
                                                                      instanceId:
                                                                        instance.id,
                                                                      nodeId:
                                                                        node.id,
                                                                      values,
                                                                    },
                                                                    "已记录判断",
                                                                  );
                                                                } else {
                                                                  const target =
                                                                    members.find(
                                                                      (item) =>
                                                                        item.userId ===
                                                                        gateForm.toId,
                                                                    );
                                                                  act(
                                                                    `${gateForm.mode}:${node.id}`,
                                                                    `/api/collab/workflow/approvals/${gateForm.mode === "delegate" ? "delegate" : "countersign"}`,
                                                                    {
                                                                      instanceId:
                                                                        instance.id,
                                                                      nodeId:
                                                                        node.id,
                                                                      toId: gateForm.toId,
                                                                      toName:
                                                                        target?.name ??
                                                                        gateForm.toId,
                                                                    },
                                                                    gateForm.mode ===
                                                                      "delegate"
                                                                      ? "已转交审批"
                                                                      : "已加签审批",
                                                                  );
                                                                }
                                                              },
                                                              children: [
                                                                gateForm.mode ===
                                                                "decision"
                                                                  ? jsxRuntime.jsx(
                                                                      "textarea",
                                                                      {
                                                                        className:
                                                                          "pmwf-area",
                                                                        rows: 3,
                                                                        value:
                                                                          decisionValues,
                                                                        onChange:
                                                                          (
                                                                            event,
                                                                          ) =>
                                                                            setDecisionValues(
                                                                              event
                                                                                .target
                                                                                .value,
                                                                            ),
                                                                        placeholder:
                                                                          '{"complexity": 8}',
                                                                      },
                                                                    )
                                                                  : jsxRuntime.jsxs(
                                                                      "div",
                                                                      {
                                                                        className:
                                                                          "pmwf-row",
                                                                        children:
                                                                          [
                                                                            jsxRuntime.jsx(
                                                                              "span",
                                                                              {
                                                                                className:
                                                                                  "pmwf-label",
                                                                                children:
                                                                                  gateForm.mode ===
                                                                                  "delegate"
                                                                                    ? "转交给"
                                                                                    : "加签人",
                                                                              },
                                                                            ),
                                                                            jsxRuntime.jsxs(
                                                                              "select",
                                                                              {
                                                                                className:
                                                                                  "pmwf-select",
                                                                                value:
                                                                                  gateForm.toId,
                                                                                onChange:
                                                                                  (
                                                                                    event,
                                                                                  ) =>
                                                                                    setGateForm(
                                                                                      {
                                                                                        ...gateForm,
                                                                                        toId: event
                                                                                          .target
                                                                                          .value,
                                                                                      },
                                                                                    ),
                                                                                required: true,
                                                                                children:
                                                                                  [
                                                                                    jsxRuntime.jsx(
                                                                                      "option",
                                                                                      {
                                                                                        value:
                                                                                          "",
                                                                                        children:
                                                                                          "选择成员",
                                                                                      },
                                                                                    ),
                                                                                    ...members.map(
                                                                                      (
                                                                                        item,
                                                                                      ) =>
                                                                                        jsxRuntime.jsx(
                                                                                          "option",
                                                                                          {
                                                                                            value:
                                                                                              item.userId,
                                                                                            children:
                                                                                              item.name ??
                                                                                              item.userId,
                                                                                          },
                                                                                          item.userId,
                                                                                        ),
                                                                                    ),
                                                                                  ],
                                                                              },
                                                                            ),
                                                                          ],
                                                                      },
                                                                    ),
                                                                jsxRuntime.jsxs(
                                                                  "div",
                                                                  {
                                                                    className:
                                                                      "pmwf-row",
                                                                    children: [
                                                                      jsxRuntime.jsx(
                                                                        "button",
                                                                        {
                                                                          type: "submit",
                                                                          className:
                                                                            "pmwf-btn small",
                                                                          disabled:
                                                                            busy !==
                                                                            "",
                                                                          children:
                                                                            "确认",
                                                                        },
                                                                      ),
                                                                      jsxRuntime.jsx(
                                                                        "button",
                                                                        {
                                                                          type: "button",
                                                                          className:
                                                                            "pmwf-btn secondary small",
                                                                          onClick:
                                                                            () =>
                                                                              setGateForm(
                                                                                null,
                                                                              ),
                                                                          children:
                                                                            "取消",
                                                                        },
                                                                      ),
                                                                    ],
                                                                  },
                                                                ),
                                                              ],
                                                            },
                                                          )
                                                        : null,
                                                    ],
                                                  }),
                                                ],
                                              },
                                              node.id,
                                            );
                                          }),
                                        }),
                                        (detail.events ?? []).length > 0
                                          ? jsxRuntime.jsxs("div", {
                                              className: "pmwf-note info",
                                              children: [
                                                "最近：",
                                                detail.events
                                                  .slice(-3)
                                                  .reverse()
                                                  .map(
                                                    (event) =>
                                                      `${event.message}（${timeShort(event.at)}）`,
                                                  )
                                                  .join("；"),
                                              ],
                                            })
                                          : null,
                                        instance.status !== "completed" &&
                                        instance.status !== "cancelled"
                                          ? jsxRuntime.jsx("div", {
                                              className: "pmwf-actions",
                                              children: jsxRuntime.jsx(
                                                "button",
                                                {
                                                  type: "button",
                                                  className:
                                                    "pmwf-btn secondary small",
                                                  disabled: busy !== "",
                                                  onClick: () =>
                                                    act(
                                                      `cancel:${instance.id}`,
                                                      "/api/collab/workflow/instances/cancel",
                                                      {
                                                        instanceId: instance.id,
                                                      },
                                                      "已取消流程",
                                                    ),
                                                  children: "取消流程",
                                                },
                                              ),
                                            })
                                          : null,
                                      ],
                                    }),
                              ],
                            }),
                          ],
                        },
                        instance.id,
                      );
                    }),
                  }),
            ],
          }),
        ],
      });
    }

    function WorkflowSettings() {
      const [phase, setPhase] = react.useState("loading");
      const [error, setError] = react.useState("");
      const [notice, setNotice] = react.useState("");
      const [currentUser, setCurrentUser] = react.useState(null);
      const [workspaces, setWorkspaces] = react.useState([]);
      const [workspaceId, setWorkspaceId] = react.useState("");
      const [definitions, setDefinitions] = react.useState([]);
      const [sourceMd, setSourceMd] = react.useState("");
      const [validation, setValidation] = react.useState(null);
      const [activate, setActivate] = react.useState(true);
      const [startTitle, setStartTitle] = react.useState("");
      const [busy, setBusy] = react.useState("");
      const [showArchived, setShowArchived] = react.useState(false);
      const notify = (text) => {
        setError("");
        setNotice(text);
      };
      const fail = (cause) => {
        setNotice("");
        setError(friendly(cause));
      };
      const canManage =
        currentUser?.role === "admin" ||
        workspaces.find((item) => item.id === workspaceId)?.memberRole ===
          "owner";
      const activeDefinition = definitions.find(
        (item) => item.status === "active",
      );
      const activeDefinitions = definitions.filter(
        (item) => item.status === "active",
      );
      const archivedDefinitions = definitions.filter(
        (item) => item.status === "archived",
      );
      const visibleDefinitions = showArchived ? definitions : activeDefinitions;

      const load = react.useCallback(
        async (silent = false) => {
          if (getToken() === null) {
            setPhase("login");
            return;
          }
          try {
            const [meResult, workspaceResult] = await Promise.all([
              request("/api/collab/auth/me"),
              request("/api/collab/team/workspaces"),
            ]);
            setCurrentUser(meResult.user);
            const options = workspaceResult.workspaces ?? [];
            setWorkspaces(options);
            const selected = options.some((item) => item.id === workspaceId)
              ? workspaceId
              : (options[0]?.id ?? "");
            setWorkspaceId(selected);
            if (selected) {
              const result = await request(
                `/api/collab/workflow/definitions?workspaceId=${encodeURIComponent(selected)}`,
              );
              setDefinitions(result.definitions ?? []);
            } else setDefinitions([]);
            if (!silent) notify("已刷新");
            setPhase("ready");
          } catch (cause) {
            if (cause.status === 401) setPhase("login");
            fail(cause);
            setPhase("error");
          }
        },
        [workspaceId],
      );

      react.useEffect(() => {
        load();
      }, [load]);

      const validate = async () => {
        setBusy("validate");
        try {
          const result = await request(
            "/api/collab/workflow/definitions/validate",
            {
              method: "POST",
              body: JSON.stringify({ workspaceId, sourceMd }),
            },
          );
          setValidation(result);
          if (result.issues.some((issue) => issue.level === "error")) {
            setNotice("");
            setError("校验发现错误");
          } else {
            notify("校验通过");
          }
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const importDefinition = async (event) => {
        event.preventDefault();
        setBusy("import");
        try {
          const result = await request(
            "/api/collab/workflow/definitions/import",
            {
              method: "POST",
              body: JSON.stringify({ workspaceId, sourceMd, activate }),
            },
          );
          setValidation({ graph: result.definition.graph, issues: [] });
          notify(
            `已保存「${result.definition.name}」v${result.definition.version}`,
          );
          await load(true);
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const chooseFile = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setSourceMd(String(reader.result ?? ""));
        reader.readAsText(file);
      };

      if (phase === "login")
        return jsxRuntime.jsx("p", {
          style: { color: "var(--dsw-alias-label-secondary)" },
          children: "请先在「协作身份」登录。",
        });
      if (phase === "loading")
        return jsxRuntime.jsx("p", {
          style: { color: "var(--dsw-alias-label-secondary)" },
          children: "加载中…",
        });

      return jsxRuntime.jsxs("section", {
        className: "pmwf-section",
        children: [
          jsxRuntime.jsx("style", { children: css }),
          jsxRuntime.jsx("h3", { className: "pmwf-title", children: "工作流" }),
          jsxRuntime.jsxs("div", {
            className: "pmwf-row",
            children: [
              jsxRuntime.jsx("span", {
                className: "pmwf-label",
                children: "工作区",
              }),
              jsxRuntime.jsxs("select", {
                className: "pmwf-select",
                value: workspaceId,
                onChange: (event) => {
                  setWorkspaceId(event.target.value);
                  setValidation(null);
                  setShowArchived(false);
                },
                children: workspaces.map((item) =>
                  jsxRuntime.jsx(
                    "option",
                    { value: item.id, children: workspaceLabel(item) },
                    item.id,
                  ),
                ),
              }),
              jsxRuntime.jsx("button", {
                type: "button",
                className: "pmwf-btn secondary small",
                onClick: () => load(),
                children: "刷新",
              }),
            ],
          }),
          !canManage
            ? jsxRuntime.jsx("div", {
                className: "pmwf-note info",
                children:
                  "流程模板由工作区负责人或全局管理员管理；你可以查看当前工作区模板。",
              })
            : null,
          jsxRuntime.jsx(Feedback, { error, notice }),
          jsxRuntime.jsx("div", {
            className: "pmwf-definition-list",
            children: visibleDefinitions.map((item) =>
              jsxRuntime.jsxs(
                "div",
                {
                  className: "pmwf-definition",
                  children: [
                    jsxRuntime.jsxs("div", {
                      className: "pmwf-definition-main",
                      children: [
                        jsxRuntime.jsxs("strong", {
                          children: [item.name, ` v${item.version}`],
                        }),
                        jsxRuntime.jsx("div", {
                          children: `${item.key} · ${item.status === "active" ? "启用" : "归档"} · ${timeShort(item.updatedAt)}`,
                        }),
                      ],
                    }),
                    canManage
                      ? jsxRuntime.jsxs("div", {
                          className: "pmwf-actions-right",
                          children: [
                            jsxRuntime.jsx("button", {
                              type: "button",
                              className: "pmwf-btn secondary small",
                              disabled: busy !== "" || item.status === "active",
                              onClick: async () => {
                                setBusy(`status:${item.id}`);
                                try {
                                  await request(
                                    "/api/collab/workflow/definitions/status",
                                    {
                                      method: "POST",
                                      body: JSON.stringify({
                                        workspaceId,
                                        definitionId: item.id,
                                        status: "active",
                                      }),
                                    },
                                  );
                                  notify("已启用模板");
                                  await load(true);
                                } catch (cause) {
                                  fail(cause);
                                } finally {
                                  setBusy("");
                                }
                              },
                              children: "启用",
                            }),
                            jsxRuntime.jsx("button", {
                              type: "button",
                              className: "pmwf-btn secondary small",
                              disabled:
                                busy !== "" || item.status === "archived",
                              onClick: async () => {
                                setBusy(`status:${item.id}`);
                                try {
                                  await request(
                                    "/api/collab/workflow/definitions/status",
                                    {
                                      method: "POST",
                                      body: JSON.stringify({
                                        workspaceId,
                                        definitionId: item.id,
                                        status: "archived",
                                      }),
                                    },
                                  );
                                  notify("已归档模板");
                                  await load(true);
                                } catch (cause) {
                                  fail(cause);
                                } finally {
                                  setBusy("");
                                }
                              },
                              children: "归档",
                            }),
                          ],
                        })
                      : null,
                  ],
                },
                item.id,
              ),
            ),
          }),
          definitions.length === 0
            ? jsxRuntime.jsx("p", {
                className: "pmwf-label",
                children: "当前工作区还没有流程模板。",
              })
            : null,
          archivedDefinitions.length > 0
            ? jsxRuntime.jsx("button", {
                type: "button",
                className: "pmwf-btn secondary small",
                onClick: () => setShowArchived(!showArchived),
                children: showArchived
                  ? "仅显示启用模板"
                  : `查看全部（${archivedDefinitions.length} 个已归档模板）`,
              })
            : null,
          jsxRuntime.jsxs("form", {
            className: "pmwf-card",
            onSubmit: importDefinition,
            children: [
              jsxRuntime.jsx("h4", {
                style: { margin: 0 },
                children: "导入 Markdown 模板",
              }),
              jsxRuntime.jsxs("div", {
                className: "pmwf-row",
                children: [
                  jsxRuntime.jsx("input", {
                    type: "file",
                    accept: ".md,.markdown,text/markdown",
                    onChange: chooseFile,
                  }),
                  jsxRuntime.jsxs("label", {
                    className: "pmwf-label",
                    children: [
                      jsxRuntime.jsx("input", {
                        type: "checkbox",
                        checked: activate,
                        onChange: (event) => setActivate(event.target.checked),
                      }),
                      " 保存后启用",
                    ],
                  }),
                ],
              }),
              jsxRuntime.jsx("textarea", {
                className: "pmwf-area",
                rows: 10,
                value: sourceMd,
                onChange: (event) => setSourceMd(event.target.value),
                placeholder: "# 工作流：产品交付",
              }),
              jsxRuntime.jsxs("div", {
                className: "pmwf-row",
                children: [
                  jsxRuntime.jsx("button", {
                    type: "button",
                    className: "pmwf-btn secondary",
                    disabled: !canManage || busy !== "" || sourceMd === "",
                    onClick: validate,
                    children: busy === "validate" ? "校验中" : "校验",
                  }),
                  jsxRuntime.jsx("button", {
                    type: "submit",
                    className: "pmwf-btn",
                    disabled: !canManage || busy !== "" || sourceMd === "",
                    children: busy === "import" ? "保存中" : "保存新版本",
                  }),
                ],
              }),
              validation
                ? jsxRuntime.jsxs(react.Fragment, {
                    children: [
                      validation.issues.length === 0
                        ? jsxRuntime.jsx("div", {
                            className: "pmwf-note success",
                            children: "没有校验错误或警告。",
                          })
                        : jsxRuntime.jsx("ul", {
                            className: "pmwf-issues",
                            children: validation.issues.map((issue, index) =>
                              jsxRuntime.jsx(
                                "li",
                                {
                                  style: {
                                    color:
                                      issue.level === "error"
                                        ? "#e26d6d"
                                        : "#d99a26",
                                  },
                                  children: issue.message,
                                },
                                `${issue.level}:${index}`,
                              ),
                            ),
                          }),
                      validation.graph
                        ? jsxRuntime.jsxs("div", {
                            className: "pmwf-graph",
                            children: [
                              validation.graph.nodes.map((node) =>
                                jsxRuntime.jsxs(
                                  "div",
                                  {
                                    className: "pmwf-graph-node",
                                    children: [
                                      jsxRuntime.jsx("strong", {
                                        children: node.name,
                                      }),
                                      jsxRuntime.jsx("span", {
                                        className: "pmwf-type",
                                        children: nodeTypeLabel(node.type),
                                      }),
                                    ],
                                  },
                                  node.id,
                                ),
                              ),
                            ],
                          })
                        : null,
                    ],
                  })
                : null,
            ],
          }),
          activeDefinition
            ? jsxRuntime.jsxs("form", {
                className: "pmwf-card",
                onSubmit: async (event) => {
                  event.preventDefault();
                  setBusy("start");
                  try {
                    await request("/api/collab/workflow/instances/start", {
                      method: "POST",
                      body: JSON.stringify({
                        workspaceId,
                        definitionId: activeDefinition.id,
                        title: startTitle,
                      }),
                    });
                    notify("已启动工作流");
                    setStartTitle("");
                  } catch (cause) {
                    fail(cause);
                  } finally {
                    setBusy("");
                  }
                },
                children: [
                  jsxRuntime.jsx("h4", {
                    style: { margin: 0 },
                    children: "从启用模板发起",
                  }),
                  jsxRuntime.jsx("input", {
                    className: "pmwf-input",
                    value: startTitle,
                    onChange: (event) => setStartTitle(event.target.value),
                    placeholder: "实例标题",
                    required: true,
                  }),
                  jsxRuntime.jsx("button", {
                    type: "submit",
                    className: "pmwf-btn",
                    disabled: busy === "start",
                    children: busy === "start" ? "启动中" : "启动",
                  }),
                ],
              })
            : null,
        ],
      });
    }

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      if (!window.__pluginmaxWorkflowStartBound) {
        window.__pluginmaxWorkflowStartBound = true;
        document.addEventListener("click", startWorkflowFromTab);
      }
      ctx.slots.inject("conversation.view", () =>
        ctx.slots.register(
          {
            name: "conversation.view",
            id: "pluginmax-workflow",
            order: 30,
            label: () => "工作流",
          },
          WorkflowTab,
        ),
      );
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "pluginmax-workflow",
            order: 84,
            label: () => "工作流",
            inject: () => ({}),
          },
          () => jsxRuntime.jsx(WorkflowSettings, {}),
        ),
      );
    };

    return module.exports;
  },
});
