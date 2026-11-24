window.__ModuleLoader__.load({
  id: "dsh-collab-project",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    const h = react.createElement;
    const Fragment = react.Fragment;

    const TOKEN_KEY = "pluginmax.collab.token";
    const PROJECT_STATUSES = ["进行中", "规划中", "已完成", "已暂停", "风险"];
    const PROJECT_HEALTHS = ["健康", "关注", "风险"];
    const ROLE_CATEGORIES = [
      "管理",
      "执行",
      "评审",
      "审批",
      "计划",
      "采购",
      "支持",
    ];
    const PERMISSION_OPTIONS = [
      { key: "read", label: "查看" },
      { key: "write", label: "编辑" },
      { key: "approve", label: "审批" },
      { key: "manage_members", label: "成员管理" },
      { key: "manage_roles", label: "角色管理" },
    ];
    const TASK_STATUS_LABEL = {
      todo: "待处理",
      progress: "进行中",
      review: "待验收",
      abnormal: "异常",
      done: "已完成",
      cancelled: "已取消",
    };
    const WORKFLOW_NODE_STATUS_LABEL = {
      waiting: "未开始",
      ready: "待执行",
      running: "进行中",
      blocked: "阻塞",
      completed: "已完成",
      skipped: "已跳过",
      failed: "失败",
    };
    const WORKFLOW_BLOCKING_EVENT_KINDS = new Set([
      "agent.ticket_denied",
      "agent.failed",
      "agent.dispatch_failed",
      "agent.output_invalid",
      "agent.cancelled",
      "approval.rejected",
      "loop.break",
      "subworkflow.blocked",
      "subworkflow.missing",
      "task.create_failed",
    ]);
    const WORKFLOW_EVENT_LABEL = {
      "agent.ticket_denied": "执行权限被拒",
      "agent.failed": "AI 伙伴执行失败",
      "agent.dispatch_failed": "AI 伙伴派发失败",
      "agent.output_invalid": "节点输出不合规",
      "agent.cancelled": "AI 执行已取消",
      "approval.rejected": "审批未通过",
      "loop.break": "流程触发回退",
      "subworkflow.blocked": "子流程阻塞",
      "subworkflow.missing": "子流程缺失",
      "task.create_failed": "节点任务创建失败",
    };
    const PROGRESS_ZOOM_MIN = 0.8;
    const PROGRESS_ZOOM_MAX = 1.4;
    const PROGRESS_ZOOM_STEP = 0.1;
    const PROGRESS_EVENT_CATEGORY_LABEL = {
      order: "订单变更",
      supply: "供给变更",
      external: "外部影响",
    };
    const WORKFLOW_STATUS_LABEL = {
      running: "进行中",
      waiting: "等待中",
      blocked: "阻塞",
      completed: "已完成",
      cancelled: "已取消",
      failed: "失败",
    };
    const WORKFLOW_STATUS_TONE = {
      blocked: "warn",
      failed: "warn",
      completed: "done",
    };
    const REPORT_TYPE_LABELS = {
      daily: "项目日报",
      weekly: "项目周报",
      progress: "进度汇报",
    };
    const REPORT_SCHEDULE_FREQUENCY_LABELS = {
      daily: "每天",
      weekdays: "每个工作日",
      weekly: "每周",
      monthly: "每月",
    };
    const REPORT_WEEKDAY_LABELS = [
      "周日",
      "周一",
      "周二",
      "周三",
      "周四",
      "周五",
      "周六",
    ];
    const DEFAULT_REPORT_SCHEDULE = {
      enabled: true,
      frequency: "daily",
      time: "08:00",
      timezone: "Asia/Shanghai",
      weekday: 1,
      dayOfMonth: 1,
    };
    const MEMBER_POOL_STICKY_EXIT_GAP = 24;
    const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2 };
    const PRIORITY_DISPLAY = { P1: "P0", P2: "P1", P3: "P2" };
    const priorityLabel = (value) => PRIORITY_DISPLAY[value] ?? value;
    const AUDIT_CATEGORY_LABELS = {
      all: "全部",
      project: "项目设置",
      member: "成员权限",
      role: "项目角色",
      template: "关联模版",
      report: "项目日报",
      identity: "账号与权限",
    };
    const PLATFORM_ROLE_LABELS = {
      admin: "平台管理员",
      owner: "平台负责人",
      member: "平台成员",
      guest: "平台访客",
    };
    const WORKSPACE_ROLE_LABELS = {
      owner: "负责人",
      member: "成员",
      guest: "访客",
    };

    /** 客户端上下文：新建项目需要调用宿主的目录选择与工作区控制器。 */
    let clientCtx = null;

    function token() {
      return window.localStorage.getItem(TOKEN_KEY);
    }

    async function request(path, options = {}) {
      const { timeoutMs, signal: callerSignal, ...fetchOptions } = options;
      const headers = { ...fetchOptions.headers };
      if (fetchOptions.body !== undefined) {
        headers["content-type"] = "application/json";
      }
      const current = token();
      if (current !== null) headers.authorization = `Bearer ${current}`;
      const controller =
        timeoutMs === undefined && callerSignal === undefined
          ? undefined
          : new AbortController();
      const abortFromCaller = () => controller?.abort();
      if (callerSignal !== undefined && controller !== undefined) {
        if (callerSignal.aborted) {
          controller.abort();
        } else {
          callerSignal.addEventListener("abort", abortFromCaller, {
            once: true,
          });
        }
      }
      const timer =
        timeoutMs === undefined || controller === undefined
          ? undefined
          : window.setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetch(path, {
          ...fetchOptions,
          headers,
          cache: "no-store",
          ...(controller === undefined ? {} : { signal: controller.signal }),
        });
      } catch (cause) {
        if (
          controller?.signal.aborted === true &&
          callerSignal?.aborted !== true
        ) {
          throw new Error(
            `请求超时（${Math.max(1, Math.round((timeoutMs ?? 0) / 1_000))} 秒）`,
          );
        }
        throw cause;
      } finally {
        if (timer !== undefined) window.clearTimeout(timer);
        if (callerSignal !== undefined) {
          callerSignal.removeEventListener("abort", abortFromCaller);
        }
      }
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
        error.code = body?.error?.code;
        error.details = body?.error;
        throw error;
      }
      return body;
    }

    function initials(name) {
      const value = String(name ?? "").trim();
      if (value === "") return "—";
      const first = value.slice(0, 1);
      const words = value.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
      }
      return first.toUpperCase();
    }

    const MEMBER_AVATAR_PRESETS = [
      {
        id: "sky",
        bg: "#d9efff",
        shirt: "#568fd8",
        skin: "#f1c5a3",
        hair: "#244d77",
        accent: "#ffd166",
      },
      {
        id: "sunset",
        bg: "#ffe5d8",
        shirt: "#db6d65",
        skin: "#d99a76",
        hair: "#743d2d",
        accent: "#ff8d7a",
      },
      {
        id: "forest",
        bg: "#def6e8",
        shirt: "#3f9d73",
        skin: "#e3b08d",
        hair: "#245543",
        accent: "#67d4a1",
      },
      {
        id: "berry",
        bg: "#f1e2ff",
        shirt: "#7d59c6",
        skin: "#efb38f",
        hair: "#533275",
        accent: "#c06cff",
      },
      {
        id: "lemon",
        bg: "#fff3c9",
        shirt: "#d7a62e",
        skin: "#d49974",
        hair: "#414554",
        accent: "#f2cb45",
      },
      {
        id: "ocean",
        bg: "#d9f4ff",
        shirt: "#2f84a8",
        skin: "#ce9874",
        hair: "#164f6f",
        accent: "#4fc3e8",
      },
    ];

    function memberAvatarArt(value, key) {
      if (typeof value === "string" && value.startsWith("data:image/")) {
        return h("img", {
          key,
          className: "pmproj-avatar-art",
          src: value,
          alt: "",
        });
      }
      const preset =
        MEMBER_AVATAR_PRESETS.find((item) => item.id === value) ??
        MEMBER_AVATAR_PRESETS[
          Math.abs(String(value ?? "").charCodeAt(0) || 0) %
            MEMBER_AVATAR_PRESETS.length
        ];
      return h(
        "svg",
        {
          key,
          className: "pmproj-avatar-art",
          viewBox: "0 0 64 64",
          "aria-hidden": "true",
        },
        h("rect", { key: "bg", width: 64, height: 64, fill: preset.bg }),
        h("circle", {
          key: "accent",
          cx: 52,
          cy: 12,
          r: 11,
          fill: preset.accent,
          opacity: 0.3,
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
        h("path", {
          key: "hair",
          d: "M16 29c0-12 7-19 17-19 10 0 16 7 16 19-4-2-7-6-9-10-5 6-14 9-24 10Z",
          fill: preset.hair,
        }),
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
      );
    }

    function MemberAvatar({ member }) {
      if (member.kind === "agent") {
        const source = member.source === "personal" ? "personal" : "platform";
        return h(
          "span",
          {
            className: `pmproj-avatar-ring ${source}`,
            role: "img",
            "aria-label": `${member.name} 的头像`,
            title: member.name,
          },
          memberAvatarArt(member.avatar ?? "", "avatar"),
        );
      }
      return h(
        "span",
        {
          className: "pmproj-avatar human",
          role: "img",
          "aria-label": `${member.name} 的头像`,
          title: member.name,
        },
        initials(member.name),
      );
    }

    function MemberSubtitle({ member }) {
      if (member.kind === "agent") {
        return h(
          "small",
          null,
          h("span", { className: "pmproj-member-kind agent" }, "AI"),
          member.ownerName ? ` · Owner ${member.ownerName}` : "",
        );
      }
      return h(
        "small",
        null,
        member.joinedAt
          ? `Human · 加入 ${new Date(member.joinedAt).toLocaleDateString(
              "zh-CN",
            )}`
          : "Human",
      );
    }

    function statusTone(status) {
      if (status === "风险" || status === "阻塞") return "warn";
      if (status === "已完成") return "done";
      if (status === "已取消") return "cancelled";
      if (status === "已归档") return "archived";
      if (status === "关注" || status === "规划中") return "notice";
      return "progress";
    }

    function permissionLabels(permissions) {
      const labels = [];
      for (const permission of permissions ?? []) {
        const option = PERMISSION_OPTIONS.find(
          (candidate) => candidate.key === permission,
        );
        const label = option === undefined ? permission : option.label;
        if (!labels.includes(label)) labels.push(label);
      }
      return labels.length === 0 ? "未分配" : labels.join("、");
    }

    function platformUserOptionLabel(member, kind) {
      if (kind === "agent") {
        const ownerName = String(member.ownerName ?? "").trim();
        return `${member.name}·AI（by ${ownerName || "实例 Owner"}）`;
      }
      return `${member.name}（${member.platformRole ?? "平台成员"}）`;
    }

    function auditCategoryLabel(category) {
      return AUDIT_CATEGORY_LABELS[category] ?? category ?? "其他";
    }

    function workspaceRoleLabel(role) {
      return WORKSPACE_ROLE_LABELS[role] ?? "不适用";
    }

    function resolveMemberPoolStuck({
      current,
      sentinelTop,
      containerTop,
      poolBottom,
      atScrollEnd = false,
    }) {
      if (poolBottom <= containerTop) return false;
      if (current && atScrollEnd) return true;
      const threshold = current ? MEMBER_POOL_STICKY_EXIT_GAP : 1;
      return sentinelTop <= containerTop + threshold;
    }

    function isSystemAgentCandidate(candidate) {
      const name = String(candidate?.name ?? "")
        .replace(/\s+/g, "")
        .toLowerCase();
      return (
        candidate?.systemKey !== undefined ||
        candidate?.templateId === "sys-data-agent" ||
        candidate?.templateId === "sys-meeting-facilitator" ||
        candidate?.templateId === "tpl-instance-meeting-facilitator" ||
        candidate?.id === "data-agent" ||
        candidate?.id === "meeting-facilitator" ||
        name === "dataagent" ||
        name === "会议facilitator" ||
        name === "demo会议facilitator"
      );
    }

    function filterMemberDirectoryLocally(
      directory,
      members,
      keyword,
      limit = 30,
    ) {
      const value = String(keyword ?? "")
        .trim()
        .toLowerCase();
      if (value === "") return { humans: [], agents: [] };
      const matches = (candidate) =>
        `${candidate?.name ?? ""} ${candidate?.id ?? ""}`
          .toLowerCase()
          .includes(value);
      const humans = (directory?.humans ?? []).filter(matches).slice(0, limit);
      const matchingHumans = [
        ...humans,
        ...(members ?? []).filter(
          (member) => member.kind === "human" && matches(member),
        ),
      ];
      const ownerIds = new Set(
        matchingHumans
          .map((member) => member.id)
          .filter((id) => id !== undefined && id !== ""),
      );
      const ownerNames = new Set(
        matchingHumans
          .map((member) =>
            String(member.name ?? "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );
      const agents = (directory?.agents ?? [])
        .filter((candidate) => !isSystemAgentCandidate(candidate))
        .filter(
          (candidate) =>
            matches(candidate) ||
            (candidate.ownerUserId !== undefined &&
              ownerIds.has(candidate.ownerUserId)) ||
            ownerNames.has(
              String(candidate.ownerName ?? "")
                .trim()
                .toLowerCase(),
            ),
        )
        .slice(0, limit);
      return { humans, agents };
    }

    function isProjectOwner(member, ownerId) {
      const projectOwnerId = String(ownerId ?? "").trim();
      if (member?.kind !== "human") return false;
      return projectOwnerId === ""
        ? member.workspaceRole === "owner"
        : member.id === projectOwnerId;
    }

    function compactWorkspacePath(path, segmentCount = 3) {
      const value = String(path ?? "").trim();
      if (value === "") return "未知";
      const parts = value.split(/[\\/]+/).filter(Boolean);
      if (parts.length === 0) return value;
      return `.../${parts.slice(-segmentCount).join("/")}`;
    }

    function auditMatches(event, keyword, category) {
      if (category !== "all" && event.category !== category) return false;
      const value = String(keyword ?? "")
        .trim()
        .toLowerCase();
      if (value === "") return true;
      const detail = Object.entries(event.detail ?? {})
        .map(([key, item]) => `${key} ${item}`)
        .join(" ");
      return `${event.summary ?? ""} ${event.actorName ?? ""} ${
        event.actorRole ?? ""
      } ${event.targetName ?? ""} ${event.action ?? ""} ${detail}`
        .toLowerCase()
        .includes(value);
    }

    function memberScopeForRoles(roles, roleIds) {
      const permissions = [];
      for (const roleId of roleIds ?? []) {
        const role = (roles ?? []).find((item) => item.id === roleId);
        for (const permission of role?.permissions ?? []) {
          permissions.push(permission);
        }
      }
      return permissionLabels(permissions);
    }

    function groupMembersByProjectRole(roles, members) {
      return (roles ?? []).map((role) => ({
        role,
        members: (members ?? []).filter((member) =>
          (member.roleIds ?? []).includes(role.id),
        ),
      }));
    }

    function projectMatches(project, keyword) {
      const value = String(keyword ?? "")
        .trim()
        .toLowerCase();
      if (value === "") return true;
      return `${project.name} ${project.code} ${project.ownerName} ${project.status} ${project.health}`
        .toLowerCase()
        .includes(value);
    }

    function roleCodeKey(role) {
      return String(role?.code ?? "")
        .trim()
        .toUpperCase();
    }

    function roleFieldsDiffer(left, right) {
      const leftPermissions = [...(left.permissions ?? [])].sort().join(",");
      const rightPermissions = [...(right.permissions ?? [])].sort().join(",");
      return (
        left.name !== right.name ||
        left.category !== right.category ||
        (left.description ?? "") !== (right.description ?? "") ||
        leftPermissions !== rightPermissions
      );
    }

    /** 草稿差异：code 是业务身份；name/权限等变化不算新增/移除。 */
    function computeRoleDiff(effective, draft) {
      const effectiveByCode = new Map(
        effective.map((role) => [roleCodeKey(role), role]),
      );
      const draftByCode = new Map(
        draft.map((role) => [roleCodeKey(role), role]),
      );
      return {
        added: draft.filter((role) => !effectiveByCode.has(roleCodeKey(role))),
        updated: draft.filter((role) => {
          const original = effectiveByCode.get(roleCodeKey(role));
          return original !== undefined && roleFieldsDiffer(original, role);
        }),
        removed: effective.filter(
          (role) => !draftByCode.has(roleCodeKey(role)),
        ),
      };
    }

    /**
     * 另存项目角色时生成新的业务 code：不覆盖原角色，
     * 依次尝试 <CODE>_COPY、<CODE>_COPY_2 ...
     */
    function nextRoleCopyCode(baseCode, roles) {
      const used = new Set(roles.map((role) => roleCodeKey(role)));
      const base = `${roleCodeKey({ code: baseCode })}_COPY`;
      if (!used.has(base)) return base;
      let index = 2;
      while (used.has(`${base}_${index}`)) index += 1;
      return `${base}_${index}`;
    }

    function sortProjectTasks(tasks) {
      return [...tasks].sort((left, right) => {
        const gap =
          (PRIORITY_RANK[left.priority] ?? 9) -
          (PRIORITY_RANK[right.priority] ?? 9);
        if (gap !== 0) return gap;
        return String(right.createdAt).localeCompare(String(left.createdAt));
      });
    }

    function preferredProgressWorkflow(workflows) {
      const rank = {
        blocked: 0,
        failed: 1,
        running: 2,
        waiting: 3,
        completed: 4,
        cancelled: 5,
      };
      return [...(workflows ?? [])].sort(
        (left, right) =>
          (rank[left.status] ?? 9) - (rank[right.status] ?? 9) ||
          String(right.updatedAt ?? "").localeCompare(
            String(left.updatedAt ?? ""),
          ),
      )[0];
    }

    function clampProgressZoom(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 1;
      return Math.min(
        PROGRESS_ZOOM_MAX,
        Math.max(PROGRESS_ZOOM_MIN, Math.round(numeric * 10) / 10),
      );
    }

    function nextProgressZoom(value, direction) {
      return clampProgressZoom(
        value + Math.sign(direction) * PROGRESS_ZOOM_STEP,
      );
    }

    function progressNodeStatusLabel(status) {
      return WORKFLOW_NODE_STATUS_LABEL[status] ?? status ?? "未开始";
    }

    function progressNodeTone(status) {
      if (status === "completed") return "done";
      if (status === "blocked" || status === "failed") return "warn";
      if (status === "running" || status === "ready") return "progress";
      if (status === "waiting") return "notice";
      return undefined;
    }

    function progressTaskAnomaly(task) {
      return (
        task?.status === "abnormal" ||
        task?.executionAnomaly !== undefined ||
        task?.receiverState === "needs_reassignment" ||
        task?.queueState === "blocked"
      );
    }

    function progressTaskAnomalyText(task) {
      if (task?.executionAnomaly?.message) {
        return task.executionAnomaly.message;
      }
      if (task?.reassignmentReason) return task.reassignmentReason;
      if (task?.queueState === "blocked") return "依赖未满足";
      if (task?.needsInput === true) return "等待补充信息";
      if (task?.status === "abnormal") return "任务状态异常";
      return "";
    }

    function stableProgressKey(value) {
      let hash = 2166136261;
      for (const character of String(value ?? "")) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(36);
    }

    function normalizeBusinessChainBindings(value) {
      return [...(value ?? [])]
        .map((item) => ({
          nodeId: String(item?.nodeId ?? ""),
          externalRefs: [...(item?.externalRefs ?? [])]
            .map((ref) => ({
              system: String(ref?.system ?? "").trim(),
              objectType: String(ref?.objectType ?? "").trim(),
              objectId: String(ref?.objectId ?? "").trim(),
              required: ref?.required !== false,
            }))
            .sort(
              (left, right) =>
                left.system.localeCompare(right.system) ||
                left.objectType.localeCompare(right.objectType) ||
                left.objectId.localeCompare(right.objectId),
            ),
        }))
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    }

    function missingBusinessChainRoleMembers(nodes, roles) {
      const countByCode = new Map(
        (roles ?? []).map((role) => [
          String(role.code ?? "").toUpperCase(),
          Number(role.memberCount ?? 0),
        ]),
      );
      return (nodes ?? [])
        .filter((node) => {
          const code = String(node.executor?.roleCode ?? "").toUpperCase();
          return code !== "" && countByCode.get(code) === 0;
        })
        .map((node) => ({
          nodeName: String(node.name ?? node.nodeId ?? ""),
          roleCode: String(node.executor?.roleCode ?? "").toUpperCase(),
          roleName:
            String(node.executor?.label ?? "").trim() ||
            String(node.executor?.roleCode ?? "").toUpperCase(),
        }));
    }

    function businessChainNoticeClass(message) {
      return /(不存在|缺少|失败|不支持|仅支持|已存在|冲突|错误|无效|至少需要|候选成员)/.test(
        String(message ?? ""),
      )
        ? "pmproj-notice pmproj-notice-error"
        : "pmproj-notice";
    }

    function businessChainConfigToMarkdown(content) {
      const parsed = JSON.parse(String(content ?? ""));
      if (parsed === null || typeof parsed !== "object") {
        throw new Error("业务链路配置文件必须是 JSON 对象");
      }
      const workflow =
        parsed.workflow !== null && typeof parsed.workflow === "object"
          ? parsed.workflow
          : parsed;
      const businessChain =
        parsed.businessChain !== null &&
        typeof parsed.businessChain === "object"
          ? parsed.businessChain
          : parsed;
      const key = String(workflow.key ?? businessChain.key ?? "").trim();
      const version = Number(workflow.version ?? 1);
      const name = String(
        workflow.name ?? businessChain.displayName ?? "",
      ).trim();
      const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
      const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
      if (key === "" || name === "" || nodes.length === 0) {
        throw new Error("业务链路配置缺少 key、name 或 nodes");
      }
      const templateId = String(
        businessChain.templateId ?? parsed.templateId ?? `chain-${key}`,
      ).trim();
      const executorText = (value, fallback = "role:role-owner") => {
        if (typeof value === "string" && value.trim() !== "") {
          return value.trim();
        }
        if (value !== null && typeof value === "object") {
          const kind = String(value.kind ?? "").trim();
          const id = String(value.id ?? "").trim();
          if (kind !== "" && id !== "") return `${kind}:${id}`;
        }
        return fallback;
      };
      const lines = [
        `# 工作流：${name}`,
        "",
        "## 元信息",
        "",
        `- key: ${key}`,
        `- version: ${Number.isInteger(version) ? version : 1}`,
        "- kind: business-chain",
        `- business-chain-template-id: ${templateId}`,
        `- business-chain-key: ${String(businessChain.chainKey ?? key).trim()}`,
        `- business-chain-name: ${String(
          businessChain.displayName ?? name,
        ).trim()}`,
        `- project-type-codes: ${(
          businessChain.projectTypeCodes ??
          workflow.projectTypeCodes ??
          []
        ).join(",")}`,
        `- business-chain-snapshot-policy: ${
          businessChain.snapshotPolicy ?? "pin-at-project-create"
        }`,
        `- business-chain-allow-unbound: ${
          businessChain.allowUnboundExternalNodes === true ? "true" : "false"
        }`,
        ...(String(workflow.description ?? parsed.description ?? "").trim() ===
        ""
          ? []
          : [
              `- description: ${String(
                workflow.description ?? parsed.description,
              ).trim()}`,
            ]),
        "",
        "## 节点",
        "",
      ];
      for (const [index, node] of nodes.entries()) {
        if (node === null || typeof node !== "object") continue;
        const nodeId = String(node.id ?? "").trim();
        if (nodeId === "") {
          throw new Error(`第 ${index + 1} 个节点缺少 id`);
        }
        lines.push(
          `### ${String(node.name ?? nodeId).trim()}`,
          "",
          `- id: ${nodeId}`,
          `- type: ${String(node.type ?? "task").trim()}`,
          `- executor: ${executorText(node.executor)}`,
          `- stage-code: ${String(node.stageCode ?? nodeId.toUpperCase()).trim()}`,
          `- sequence: ${Number(node.sequence ?? index + 1)}`,
          `- summary-metric: ${String(node.summaryMetric ?? "status").trim()}`,
        );
        const ownerRole =
          typeof node.ownerRole === "string"
            ? node.ownerRole.trim()
            : typeof node.ownerRole?.name === "string"
              ? node.ownerRole.name.trim()
              : "";
        const ownerRoleCode =
          typeof node.ownerRoleCode === "string"
            ? node.ownerRoleCode.trim()
            : typeof node.ownerRole?.code === "string"
              ? node.ownerRole.code.trim()
              : "";
        if (ownerRole !== "") lines.push(`- owner-role: ${ownerRole}`);
        if (ownerRoleCode !== "") {
          lines.push(`- owner-role-code: ${ownerRoleCode}`);
        }
        for (const ref of node.externalRefs ?? []) {
          lines.push(
            `- external-ref: ${String(ref.system).trim()}|${String(
              ref.objectType,
            ).trim()}|${String(ref.objectId).trim()}|${
              ref.required === false ? "false" : "true"
            }`,
          );
        }
        for (const field of node.fields ?? []) {
          const bindings = field.bindings ?? [];
          if (bindings.length === 0) continue;
          const first = bindings[0];
          if (
            bindings.some(
              (binding) =>
                String(binding.system) !== String(first.system) ||
                String(binding.objectId) !== String(first.objectId),
            )
          ) {
            throw new Error(
              `字段「${field.label ?? field.key}」只能绑定同一个来源对象`,
            );
          }
          lines.push(
            `- field: ${String(field.key).trim()}|${String(
              field.label,
            ).trim()}|${String(first.system).trim()}|${String(
              first.objectId,
            ).trim()}|${bindings
              .map((binding) => String(binding.path).trim())
              .join(",")}`,
          );
        }
        lines.push("");
      }
      lines.push("## 连接", "");
      for (const edge of edges) {
        if (
          edge === null ||
          typeof edge !== "object" ||
          String(edge.from ?? "").trim() === "" ||
          String(edge.to ?? "").trim() === ""
        ) {
          continue;
        }
        const attributes = [
          edge.condition === undefined
            ? ""
            : `condition: ${String(edge.condition)}`,
          edge.breakCondition === undefined
            ? ""
            : `break: ${String(edge.breakCondition)}`,
          edge.result === undefined ? "" : `result: ${String(edge.result)}`,
          edge.default === true ? "default" : "",
        ].filter(Boolean);
        lines.push(
          `- ${String(edge.from).trim()} -> ${String(edge.to).trim()}${
            attributes.length === 0 ? "" : ` [${attributes.join(",")}]`
          }`,
        );
      }
      return lines.join("\n");
    }

    function progressTimeLabel(value) {
      const text = String(value ?? "").trim();
      const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
      if (match !== null) return `${match[1]} ${match[2]}`;
      return text === "" ? "时间未记录" : text;
    }

    function formatProjectUpdatedAt(value, reportDate) {
      const text = String(value ?? "").trim();
      if (text === "") return "暂无";
      const legacy = text.match(/^(\d{2})-(\d{2})[T ](\d{2}:\d{2})$/);
      if (legacy !== null) {
        const date = String(reportDate ?? "").match(/^(\d{4})-\d{2}-\d{2}/);
        if (date !== null) {
          return `${date[1]}-${legacy[1]}-${legacy[2]} ${legacy[3]}`;
        }
      }
      const time = Date.parse(text);
      if (!Number.isFinite(time)) return progressTimeLabel(text);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(time));
      const part = (type) =>
        parts.find((item) => item.type === type)?.value ?? "";
      return `${part("year")}-${part("month")}-${part("day")} ${part(
        "hour",
      )}:${part("minute")}`;
    }

    function progressDateLabel(value) {
      const text = String(value ?? "").trim();
      const match = text.match(/^\d{4}-\d{2}-\d{2}/);
      return match === null ? text : match[0];
    }

    function progressFirstValue(...values) {
      for (const value of values) {
        if (value !== undefined && value !== null && value !== "") {
          return value;
        }
      }
      return undefined;
    }

    function valueAtObjectPath(source, path) {
      let current = source;
      for (const segment of String(path ?? "")
        .split(".")
        .filter(Boolean)) {
        if (Array.isArray(current)) {
          const index = Number(segment);
          if (!Number.isInteger(index)) return undefined;
          current = current[index];
          continue;
        }
        if (current === null || typeof current !== "object") {
          return undefined;
        }
        current = current[segment];
      }
      return current;
    }

    function progressFieldValue(value) {
      if (value === undefined || value === null || value === "") {
        return "未记录";
      }
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      return JSON.stringify(value);
    }

    function progressFactFrom(source, kind) {
      if (source === null || typeof source !== "object") {
        return { quantity: undefined, date: undefined };
      }
      const nestedKeys = {
        planned: ["planned", "original", "plan", "originalPlan"],
        revised: ["revised", "changed", "revisedPlan", "changedPlan"],
        actual: ["actual", "result"],
      }[kind];
      const nested = nestedKeys
        .map((key) => source[key])
        .find((value) => value !== null && typeof value === "object");
      const quantityKeys = {
        planned: [
          "plannedQuantity",
          "originalQuantity",
          "planQuantity",
          "plannedQty",
          "quantity",
        ],
        revised: [
          "revisedQuantity",
          "changedQuantity",
          "adjustedQuantity",
          "quantity",
        ],
        actual: [
          "actualQuantity",
          "completedQuantity",
          "deliveredQuantity",
          "quantity",
        ],
      }[kind];
      const dateKeys = {
        planned: [
          "plannedDate",
          "originalDate",
          "planDate",
          "plannedCompletionDate",
          "originalCompletionDate",
          "completionDate",
          "date",
        ],
        revised: [
          "revisedDate",
          "changedDate",
          "adjustedDate",
          "revisedCompletionDate",
          "completionDate",
          "date",
        ],
        actual: [
          "actualDate",
          "actualCompletionDate",
          "completedAt",
          "completionDate",
          "date",
        ],
      }[kind];
      const nestedQuantity = nested?.["quantity"];
      const nestedDate = progressFirstValue(
        nested?.["date"],
        nested?.["completedAt"],
        nested?.["completionDate"],
      );
      return {
        quantity: progressFirstValue(
          nestedQuantity,
          ...quantityKeys.map((key) => source[key]),
        ),
        date: progressFirstValue(
          nestedDate,
          ...dateKeys.map((key) => source[key]),
        ),
      };
    }

    function progressNodeFacts(node, state) {
      const factSource = state?.progress ?? node?.progress ?? {};
      const planned = progressFactFrom(factSource, "planned");
      const revised = progressFactFrom(factSource, "revised");
      const actual = progressFactFrom(factSource, "actual");
      if (actual.date === undefined) {
        actual.date = progressFirstValue(
          state?.completedAt,
          state?.actualCompletedAt,
        );
      }
      return { planned, revised, actual };
    }

    function progressFactText(fact) {
      const quantity =
        fact.quantity === undefined ? "数量未记录" : String(fact.quantity);
      const date =
        fact.date === undefined ? "日期未记录" : progressDateLabel(fact.date);
      return `${quantity} · ${date}`;
    }

    function progressRevisedText(plannedLabel, revisedLabel) {
      const revised = String(revisedLabel ?? "").trim();
      if (revised === "" || revised === "--") return "--";
      const planned = String(plannedLabel ?? "").trim();
      return revised === planned ? "--" : revised;
    }

    function progressActualText(status, fact) {
      if (status === "completed") {
        return progressFactText(fact);
      }
      const quantity = fact.quantity === undefined ? "" : `${fact.quantity} · `;
      return `${quantity}${
        status === "skipped" ? "未完成（已跳过）" : "未完成"
      }`;
    }

    function progressEventCategory(event) {
      const data =
        event?.data !== null && typeof event?.data === "object"
          ? event.data
          : {};
      const explicit = String(
        progressFirstValue(
          data.progressEventType,
          data.impactType,
          data.category,
          event?.kind,
          "",
        ),
      ).toLowerCase();
      if (/(^|[._\-\s])(order|订单)([._\-\s]|$)/u.test(explicit)) {
        return "order";
      }
      if (
        /(^|[._\-\s])(supply|procurement|supplier|gpu|inventory|供给|供应|库存)([._\-\s]|$)/u.test(
          explicit,
        )
      ) {
        return "supply";
      }
      if (
        /(^|[._\-\s])(external|impact|oms|外部|同步)([._\-\s]|$)/u.test(
          explicit,
        )
      ) {
        return "external";
      }
      return undefined;
    }

    function buildProgressChangeEvents(events) {
      return (events ?? [])
        .map((event) => {
          const category = progressEventCategory(event);
          if (category === undefined) return undefined;
          const data =
            event?.data !== null && typeof event?.data === "object"
              ? event.data
              : {};
          const categoryLabel = PROGRESS_EVENT_CATEGORY_LABEL[category];
          const description = String(
            progressFirstValue(
              event?.message,
              data.description,
              data.summary,
              categoryLabel,
            ),
          ).trim();
          const source = String(
            progressFirstValue(
              data.sourceName,
              data.source,
              event?.actorName,
              "工作流",
            ),
          ).trim();
          return {
            id:
              event?.id ??
              `change-${stableProgressKey(
                `${category}:${event?.at}:${description}`,
              )}`,
            category,
            categoryLabel,
            at: String(event?.at ?? ""),
            time: progressTimeLabel(event?.at),
            description,
            source,
          };
        })
        .filter((event) => event !== undefined)
        .sort(
          (left, right) =>
            left.at.localeCompare(right.at) ||
            left.description.localeCompare(right.description),
        );
    }

    function formatProgressChangeEvent(event) {
      return `${event.time} 【${event.categoryLabel}】${event.description}（来自：${event.source}）`;
    }

    function buildProgressAlerts(workflowDetail, tasks) {
      const instance = workflowDetail?.instance ?? {};
      const definition = workflowDetail?.definition;
      const graphNodes =
        definition?.graph?.nodes ??
        Object.keys(instance.nodes ?? {}).map((nodeId) => ({
          id: nodeId,
          name: nodeId,
          executor: { kind: "system" },
        }));
      const nodeNameById = new Map(
        graphNodes.map((node) => [node.id, node.name]),
      );
      const alerts = [];
      const tasksByNode = new Map();
      for (const task of tasks ?? []) {
        if (task?.workflow?.instanceId !== instance.id) continue;
        const nodeId = task.workflow?.nodeId;
        if (nodeId === undefined || nodeId === "") continue;
        const current = tasksByNode.get(nodeId) ?? [];
        current.push(task);
        tasksByNode.set(nodeId, current);
      }
      const addAlert = (alert) => {
        const taskIds = [
          ...new Set([
            ...(alert.taskIds ?? []),
            ...(tasksByNode.get(alert.nodeId) ?? []).map((task) => task.id),
          ]),
        ];
        alerts.push({
          ...alert,
          taskIds,
          id:
            alert.id ??
            `A-${stableProgressKey(
              `${instance.id}:${alert.nodeId}:${alert.kind}:${alert.title}:${alert.at}`,
            )}`,
        });
      };
      const nodeHasEventAlert = new Set();
      for (const event of workflowDetail?.events ?? []) {
        if (!WORKFLOW_BLOCKING_EVENT_KINDS.has(event?.kind)) continue;
        if (event?.nodeId === undefined) continue;
        nodeHasEventAlert.add(event.nodeId);
        const label = WORKFLOW_EVENT_LABEL[event.kind] ?? event.kind;
        addAlert({
          nodeId: event.nodeId,
          kind: "workflow-event",
          type: "流程异常",
          title: `${nodeNameById.get(event.nodeId) ?? event.nodeId} · ${label}`,
          description: String(event.message ?? label),
          source: `工作流·${instance.title ?? "未命名流程"}`,
          at: String(event.at ?? instance.updatedAt ?? ""),
          severity:
            event.kind === "agent.ticket_denied" ||
            event.kind === "approval.rejected"
              ? "P0"
              : "P1",
          stateLabel: "待处理",
          taskIds: [],
        });
      }
      for (const node of graphNodes) {
        const state = instance.nodes?.[node.id];
        if (
          (state?.status === "blocked" || state?.status === "failed") &&
          !nodeHasEventAlert.has(node.id)
        ) {
          addAlert({
            nodeId: node.id,
            kind: "workflow-status",
            type: "流程异常",
            title: `${node.name} · ${progressNodeStatusLabel(state.status)}`,
            description:
              state.note ??
              `${node.name}节点当前${progressNodeStatusLabel(state.status)}，需要确认解除条件。`,
            source: `工作流·${instance.title ?? "未命名流程"}`,
            at: String(state.enteredAt ?? instance.updatedAt ?? ""),
            severity: state.status === "failed" ? "P0" : "P1",
            stateLabel: progressNodeStatusLabel(state.status),
            taskIds: state.taskIds ?? [],
          });
        }
      }
      for (const task of tasks ?? []) {
        if (task?.workflow?.instanceId !== instance.id) continue;
        if (task.workflow.nodeId === undefined) continue;
        if (!progressTaskAnomaly(task)) continue;
        addAlert({
          nodeId: task.workflow.nodeId,
          kind: "task-anomaly",
          type: "任务异常",
          title: task.title,
          description:
            progressTaskAnomalyText(task) || "任务需要人工确认后续处理。",
          source: `任务·${task.id}`,
          at: String(task.executionAnomaly?.at ?? task.updatedAt ?? ""),
          severity: priorityLabel(task.priority),
          stateLabel: TASK_STATUS_LABEL[task.status] ?? task.status ?? "待处理",
          taskIds: [task.id],
        });
      }
      return alerts.sort((left, right) => {
        const severityRank = { P0: 0, P1: 1, P2: 2 };
        const severity =
          (severityRank[left.severity] ?? 9) -
          (severityRank[right.severity] ?? 9);
        if (severity !== 0) return severity;
        return String(right.at).localeCompare(String(left.at));
      });
    }

    function progressNodeOwner(node, state, memberNames, binding) {
      const candidate = progressFirstValue(
        state?.assignedTo === undefined
          ? undefined
          : (memberNames?.[state.assignedTo] ?? state.assignedTo),
        state?.receiverOverride?.name,
        binding?.primaryAssignee?.name,
        binding?.source?.label,
        node?.responsible?.label,
        node?.executor?.label,
        node?.executor?.id === undefined
          ? undefined
          : (memberNames?.[node.executor.id] ?? node.executor.id),
      );
      return candidate === undefined ? "未指派" : String(candidate);
    }

    function buildProgressOverview(input) {
      const workflowDetail = input?.workflowDetail ?? null;
      const instance = workflowDetail?.instance;
      if (instance === undefined || instance === null) {
        return {
          instance: null,
          definition: null,
          nodes: [],
          alerts: [],
          changeEvents: [],
          tasksByNode: {},
        };
      }
      const tasks = input?.tasks ?? [];
      const alerts = buildProgressAlerts(workflowDetail, tasks);
      const definition = workflowDetail.definition;
      const graphNodes =
        definition?.graph?.nodes ??
        Object.keys(instance.nodes ?? {}).map((nodeId) => ({
          id: nodeId,
          name: nodeId,
          executor: { kind: "system" },
        }));
      const edges = definition?.graph?.edges ?? [];
      const stateByNode = instance.nodes ?? {};
      const tasksByNode = {};
      for (const task of tasks) {
        if (task?.workflow?.instanceId !== instance.id) continue;
        const nodeId = task.workflow?.nodeId;
        if (nodeId === undefined || nodeId === "") continue;
        tasksByNode[nodeId] = [...(tasksByNode[nodeId] ?? []), task];
      }
      const nodeNameById = new Map(
        graphNodes.map((node) => [node.id, node.name]),
      );
      const nodes = graphNodes.map((node, index) => {
        const state = stateByNode[node.id] ?? { status: "waiting" };
        const binding = instance.assignmentBindings?.[node.id];
        const facts = progressNodeFacts(node, state);
        const nodeAlerts = alerts.filter((alert) => alert.nodeId === node.id);
        const nodeTasks = [
          ...new Map(
            [
              ...(tasksByNode[node.id] ?? []),
              ...(state.taskIds ?? [])
                .map((taskId) => tasks.find((task) => task.id === taskId))
                .filter(Boolean),
            ].map((task) => [task.id, task]),
          ).values(),
        ];
        const dependencyAlerts = edges
          .filter((edge) => edge.to === node.id)
          .filter((edge) => {
            const dependency = stateByNode[edge.from];
            return (
              dependency?.status === "blocked" ||
              dependency?.status === "failed"
            );
          })
          .map(
            (edge) => `依赖阻塞：${nodeNameById.get(edge.from) ?? edge.from}`,
          );
        const exceptions = [
          ...nodeAlerts.map((alert) => alert.title),
          ...dependencyAlerts,
        ];
        const fields = (node.businessChain?.fields ?? []).map((field) => ({
          key: field.key,
          label: field.label,
          value: (field.bindings ?? [])
            .map((binding) =>
              progressFieldValue(
                valueAtObjectPath(state.progress ?? {}, binding.path),
              ),
            )
            .join(" · "),
        }));
        return {
          id: node.id,
          code: String(index + 1),
          name: node.name,
          type: node.type,
          status: state.status ?? "waiting",
          statusLabel: progressNodeStatusLabel(state.status),
          tone: progressNodeTone(state.status),
          owner: progressNodeOwner(node, state, input?.memberNames, binding),
          plannedLabel: progressFactText(facts.planned),
          revisedLabel: progressFactText(facts.revised),
          actualLabel: progressActualText(state.status, facts.actual),
          alertCount: nodeAlerts.length,
          taskCount: nodeTasks.length,
          exceptionText:
            exceptions.length === 0
              ? "无"
              : [...new Set(exceptions)].join(" · "),
          isAnomaly:
            nodeAlerts.length > 0 ||
            state.status === "blocked" ||
            state.status === "failed",
          taskIds: nodeTasks.map((task) => task.id),
          alerts: nodeAlerts,
          fields,
        };
      });
      return {
        instance,
        definition,
        nodes,
        alerts,
        changeEvents: buildProgressChangeEvents(workflowDetail.events),
        tasksByNode,
      };
    }

    function progressNodeIsAnomaly(node) {
      const status = String(node?.status ?? "");
      if (status === "blocked" || status === "failed") return true;
      return Number(node?.alertCount ?? 0) > 0;
    }

    function resolveProgressSelection(overview, nodeId, alertId) {
      const node =
        (overview?.nodes ?? []).find((item) => item.id === nodeId) ?? null;
      if (node === null) {
        return { node: null, alerts: [], tasks: [], highlightedTaskIds: [] };
      }
      const alerts = (overview?.alerts ?? []).filter(
        (alert) => alert.nodeId === node.id,
      );
      const tasks = overview?.tasksByNode?.[node.id] ?? [];
      const selectedAlert =
        alertId === undefined || alertId === ""
          ? undefined
          : alerts.find((alert) => alert.id === alertId);
      return {
        node,
        alerts,
        tasks,
        highlightedTaskIds: selectedAlert?.taskIds ?? [],
        selectedAlert: selectedAlert ?? null,
      };
    }

    /** 日报 Markdown → 结构化块；供渲染与测试共用。 */
    function parseReportBlocks(content) {
      const blocks = [];
      let list = null;
      for (const rawLine of String(content ?? "").split("\n")) {
        const line = rawLine.trimEnd();
        if (line.trim() === "") continue;
        if (line.startsWith("## ")) {
          list = null;
          blocks.push({ type: "heading", text: line.slice(3).trim() });
          continue;
        }
        if (line.startsWith("- ")) {
          if (list === null) {
            list = { type: "list", items: [] };
            blocks.push(list);
          }
          list.items.push(line.slice(2).trim());
          continue;
        }
        list = null;
        blocks.push({ type: "paragraph", text: line.trim() });
      }
      return blocks;
    }

    function reportProgressSection(content, headings) {
      const wanted = new Set(headings);
      let collecting = false;
      const items = [];
      for (const block of parseReportBlocks(content)) {
        if (block.type === "heading") {
          collecting = wanted.has(block.text);
          continue;
        }
        if (!collecting) continue;
        if (block.type === "list") {
          items.push(
            ...block.items.map((item) =>
              String(item)
                .replace(/`([^`]+)`/g, "$1")
                .replace(/\*\*([^*]+)\*\*/g, "$1")
                .trim(),
            ),
          );
        }
      }
      return items.filter(Boolean);
    }

    function substantiveProgressItems(items) {
      return items.filter(
        (item) =>
          !/(未捕获|无可引用|均为空|数据缺口|规则层面|未覆盖|无法(?:区分|在|评估|对齐)|未设置|本期暂无)/.test(
            item,
          ),
      );
    }

    function projectReportProgress(reports) {
      const items = [...(reports ?? [])].sort(
        (left, right) =>
          String(right.createdAt ?? "").localeCompare(
            String(left.createdAt ?? ""),
          ) ||
          String(right.date).localeCompare(String(left.date)) ||
          String(right.generatedAt).localeCompare(String(left.generatedAt)),
      );
      const latest = items.find((report) => report.generationMode === "agent");
      if (latest === undefined) {
        return {
          latest: null,
          progress: [],
          attention: [],
        };
      }
      return {
        latest,
        progress: substantiveProgressItems(
          reportProgressSection(latest.content, [
            "关键结果",
            "关键进展",
            "已完成",
            "正在推进",
            "目标与里程碑进展",
          ]),
        ),
        attention: substantiveProgressItems(
          reportProgressSection(latest.content, [
            "推进异常",
            "业务数据异常",
            "阻塞、依赖与需决策事项",
            "风险与依赖",
            "风险与异常",
            "需要关注",
            "风险",
          ]),
        ),
      };
    }

    function applyProgressDemoData(overview, demoConfig) {
      if (
        overview === null ||
        demoConfig?.data === null ||
        demoConfig?.data === undefined
      ) {
        return overview;
      }
      const data = demoConfig.data;
      const demoNodes =
        data.nodes !== null && typeof data.nodes === "object" ? data.nodes : {};
      const categoryLabels = {
        order: "订单变更",
        supply: "供给变更",
        external: "外部影响",
        capacity: "产能变更",
        quality: "质量变更",
      };
      const displayValue = (value) => {
        if (value === undefined || value === null || value === "") {
          return "未记录";
        }
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return String(value);
        }
        return JSON.stringify(value);
      };
      const nodes = (overview.nodes ?? []).map((node) => {
        const demoNode = demoNodes[node.id];
        if (demoNode === null || typeof demoNode !== "object") return node;
        const status = demoNode.status ?? node.status;
        const demoFields =
          demoNode.fields !== null && typeof demoNode.fields === "object"
            ? demoNode.fields
            : {};
        const fields = (node.fields ?? []).map((field) =>
          demoFields[field.key] === undefined
            ? field
            : { ...field, value: displayValue(demoFields[field.key]) },
        );
        const exception =
          demoNode.exception === undefined
            ? node.exceptionText
            : String(demoNode.exception ?? "").trim() || "无";
        const nextNode = {
          ...node,
          status,
          statusLabel: progressNodeStatusLabel(status),
          tone: progressNodeTone(status),
          owner:
            demoNode.owner === undefined ? node.owner : String(demoNode.owner),
          fields,
          exceptionText: exception,
          ...(demoNode.exception === undefined
            ? {}
            : { exceptionFromDemoData: true }),
        };
        return {
          ...nextNode,
          isAnomaly: progressNodeIsAnomaly(nextNode),
        };
      });
      const changeEvents = Array.isArray(data.changeEvents)
        ? data.changeEvents.map((event, index) => ({
            id: event.id ?? `local-demo:${index}`,
            category: event.category ?? "external",
            categoryLabel:
              event.categoryLabel ??
              categoryLabels[event.category ?? "external"] ??
              "外部影响",
            at: event.at ?? "",
            time: progressTimeLabel(event.at),
            description: event.description ?? "",
            source: event.source ?? "演示数据",
            linkedNodeIds: Array.isArray(event.linkedNodeIds)
              ? event.linkedNodeIds
              : [],
          }))
        : overview.changeEvents;
      return {
        ...overview,
        nodes,
        changeEvents,
      };
    }

    function applyProjectRoleMembers(overview, roles, members) {
      if (overview === null || overview.definition === null) return overview;
      const roleByCode = new Map(
        (roles ?? []).map((role) => [
          String(role.code ?? "").toUpperCase(),
          role,
        ]),
      );
      const membersByRoleId = new Map();
      for (const member of members ?? []) {
        for (const roleId of member.roleIds ?? []) {
          const current = membersByRoleId.get(roleId) ?? [];
          current.push(String(member.name ?? member.id ?? "").trim());
          membersByRoleId.set(roleId, current);
        }
      }
      const definitionNodes = new Map(
        (overview.definition.graph?.nodes ?? []).map((node) => [node.id, node]),
      );
      return {
        ...overview,
        nodes: (overview.nodes ?? []).map((node) => {
          const definitionNode = definitionNodes.get(node.id);
          const roleCode = String(
            definitionNode?.executor?.roleCode ?? "",
          ).toUpperCase();
          const role = roleCode === "" ? undefined : roleByCode.get(roleCode);
          if (role === undefined) return node;
          const names = [
            ...new Set(
              (membersByRoleId.get(role.id) ?? []).filter(
                (name) => name !== "",
              ),
            ),
          ];
          return {
            ...node,
            owner: names.length === 0 ? "暂无成员" : names.join("、"),
          };
        }),
      };
    }

    function renderInline(text, keyPrefix) {
      const parts = String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
      return parts
        .filter((part) => part !== "")
        .map((part, index) => {
          const key = `${keyPrefix}-${index}`;
          if (part.startsWith("`") && part.endsWith("`")) {
            return h("code", { key }, part.slice(1, -1));
          }
          if (part.startsWith("**") && part.endsWith("**")) {
            return h("strong", { key }, part.slice(2, -2));
          }
          return h(Fragment, { key }, part);
        });
    }

    function markdownBlocks(content) {
      return parseReportBlocks(content).map((block, index) => {
        if (block.type === "heading") {
          return h("h3", { key: `b${index}` }, block.text);
        }
        if (block.type === "list") {
          return h(
            "ul",
            { key: `b${index}` },
            block.items.map((item, itemIndex) =>
              h(
                "li",
                { key: `i${itemIndex}` },
                renderInline(item, `i${itemIndex}`),
              ),
            ),
          );
        }
        return h(
          "p",
          { key: `b${index}` },
          renderInline(block.text, `p${index}`),
        );
      });
    }

    const styles = `
      .pmproj{min-height:100%;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);}
      .pmproj *{box-sizing:border-box;}
      .pmproj-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;}
      .pmproj-head h1{margin:0;font-size:19px;line-height:1.3;}
      .pmproj-sub{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;}
      .pmproj-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .pmproj-btn{height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:6px;padding:0 12px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;}
      .pmproj-btn:not(:disabled):hover{filter:brightness(1.06);}
      .pmproj-btn.secondary{background:transparent;border:0.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);font-weight:500;}
      .pmproj-btn.secondary:not(:disabled):hover{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);filter:none;}
      .pmproj-btn.danger{background:transparent;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 45%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);font-weight:500;}
      .pmproj-btn.subtle{height:28px;padding:0 7px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-weight:400;}
      .pmproj-btn.subtle:not(:disabled):hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);}
      .pmproj-btn.small{height:28px;padding:0 10px;font-size:12px;}
      .pmproj-role-actions .pmproj-btn.small{height:30px;min-height:30px;padding:0 12px;font-size:12.5px;font-weight:500;line-height:1;}
      .pmproj-btn:disabled{opacity:.5;cursor:not-allowed;}
      .pmproj-follow-star{width:32px;height:32px;flex:none;padding:0;border-radius:999px;color:var(--dsw-alias-label-secondary);}
      .pmproj-follow-star.active{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 10%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmproj-layout{display:grid;grid-template-columns:minmax(248px,292px) minmax(0,1fr);gap:12px;align-items:stretch;min-height:calc(100vh - 170px);transition:grid-template-columns .16s ease;}
      .pmproj-layout.collapsed{grid-template-columns:46px minmax(0,1fr);}
      .pmproj-directory{display:flex;flex-direction:column;gap:0;min-width:0;height:auto;min-height:0;align-self:stretch;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-directory.collapsed{align-self:start;align-items:stretch;gap:10px;height:auto;overflow:visible;border-color:transparent;background:transparent;}
      .pmproj-directory.collapsed .pmproj-directory-head{flex-direction:column;align-items:center;gap:8px;margin-top:0;padding:0;}
      .pmproj-directory.collapsed .pmproj-directory-heading{justify-content:center;width:100%;}
      .pmproj-directory.collapsed .pmproj-directory-label,.pmproj-directory.collapsed .pmproj-directory-title,.pmproj-directory.collapsed .pmproj-search,.pmproj-directory.collapsed .pmproj-list{display:none;}
      .pmproj-search{display:flex;align-items:center;gap:7px;height:32px;margin:0 12px 10px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);}
      .pmproj-search:focus-within{border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:var(--focus-ring);}
      .pmproj-search svg{width:13px;height:13px;flex:none;color:var(--dsw-alias-label-secondary);}
      .pmproj-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;}
      .pmproj-directory-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:0;padding:13px 12px 9px;color:var(--dsw-alias-label-secondary);font-size:12.5px;font-weight:650;line-height:1.4;}
      .pmproj-directory-heading{display:inline-flex;align-items:center;gap:6px;min-width:0;}
      .pmproj-directory-count{min-width:22px;height:22px;display:inline-grid;place-items:center;padding:0 7px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:5px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-weight:500;line-height:1;}
      .pmproj-directory-toggle{width:32px;height:32px;flex:none;display:inline-grid;place-items:center;padding:0;border:0.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
      .pmproj-directory-toggle:hover{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmproj-directory-toggle svg{width:15px;height:15px;transition:transform .16s ease;}
      .pmproj-directory.collapsed .pmproj-directory-toggle{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);}
      .pmproj-directory.collapsed .pmproj-directory-count{min-width:30px;height:30px;padding:0 8px;border-radius:6px;font-size:13px;font-weight:600;}
      .pmproj-directory.collapsed .pmproj-directory-toggle{order:-1;}
      .pmproj-list{flex:1;min-height:0;display:grid;align-content:start;gap:4px;padding:0 8px 10px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;}
      .pmproj-list-item{display:flex;align-items:center;gap:8px;width:100%;min-width:0;min-height:72px;padding:8px 9px;border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .12s ease,border-color .12s ease,box-shadow .12s ease;}
      .pmproj-list-item:hover{border-color:transparent;background:var(--dsw-alias-bg-layer-2);}
      .pmproj-list-item.active{border-color:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 28%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 9%,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base)));box-shadow:inset 2px 0 0 var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmproj-list-item .pmproj-pill{flex:none;}
      .pmproj-list-mark{width:24px;height:24px;flex:none;display:grid;place-items:center;border-radius:6px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:700;}
      .pmproj-list-copy{flex:1;min-width:0;}
      .pmproj-list-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:12px;white-space:nowrap;}
      .pmproj-list-copy small{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary);font-size:10.5px;white-space:nowrap;}
      .pmproj-detail{min-width:0;display:flex;flex-direction:column;gap:8px;}
      .pmproj-summary{display:grid;gap:5px;min-width:0;padding:12px 14px 10px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0;}
      .pmproj-title-line{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;}
      .pmproj-title-line h2{margin:0;font-size:17px;line-height:1.3;overflow-wrap:anywhere;}
      .pmproj-meta{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:11px;}
      .pmproj-desc{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.55;}
      .pmproj-workspace-meta{align-items:center;gap:12px;margin-top:0;line-height:1.5;}
      .pmproj-workspace-value{display:inline-flex;align-items:center;gap:3px;min-width:0;max-width:100%;}
      .pmproj-workspace-value code{min-width:0;overflow-wrap:anywhere;font:inherit;}
      .pmproj-copy-icon{width:22px;height:22px;flex:none;display:inline-grid;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;}
      .pmproj-copy-icon:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmproj-copy-icon svg{width:12px;height:12px;}
      .pmproj-facts{display:flex;align-items:center;flex-wrap:wrap;gap:0;min-width:0;padding-top:0;}
      .pmproj-fact{min-width:0;display:flex;align-items:baseline;gap:6px;padding:3px 16px 3px 0;}
      .pmproj-fact + .pmproj-fact{padding-left:16px;border-left:0.5px solid var(--dsw-alias-border-l2);}
      .pmproj-fact span{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;}
      .pmproj-fact strong{min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:600;line-height:1.35;}
      .pmproj-fact small{min-width:0;color:var(--dsw-alias-label-secondary);font-size:11px;overflow-wrap:anywhere;}
      .pmproj-tabs{display:flex;align-items:center;gap:4px;flex-wrap:wrap;border-bottom:0.5px solid var(--dsw-alias-border-l3);padding-bottom:5px;}
      .pmproj-settings-nav{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;border-bottom:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-settings-nav .pmproj-tabs{flex:1;min-width:0;border-bottom:0;padding-bottom:4px;}
      .pmproj-settings-template{flex:none;margin-bottom:4px;color:var(--dsw-alias-accent-primary,#4f8ef7);font-weight:500;}
      .pmproj-settings-template:not(:disabled):hover{background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 12%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmproj-tab{border:0;border-radius:6px;padding:6px 10px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;}
      .pmproj-tab:hover{color:var(--dsw-alias-label-primary);}
      .pmproj-tab.active{background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);font-weight:600;}
      .pmproj-progress-overview{display:grid;gap:10px;min-width:0;}
      .pmproj-key-progress{overflow:hidden;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-key-progress-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-key-progress-title{display:flex;align-items:center;gap:7px;min-width:0;}
      .pmproj-key-progress-title h3{margin:0;font-size:13px;line-height:1.4;}
      .pmproj-key-progress-actions{display:flex;align-items:center;gap:6px;}
      .pmproj-key-progress-updated{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;white-space:nowrap;font-variant-numeric:tabular-nums;}
      .pmproj-key-progress-body{display:grid;padding:0 12px;}
      .pmproj-key-progress-row{display:grid;grid-template-columns:78px minmax(0,1fr);gap:10px;padding:10px 0;border-bottom:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-key-progress-row:last-child{border-bottom:0;}
      .pmproj-key-progress-label{display:inline-flex;align-items:flex-start;gap:6px;color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:1.55;}
      .pmproj-key-progress-label::before{content:"";width:6px;height:6px;margin-top:7px;flex:none;border-radius:999px;background:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmproj-key-progress-row.attention .pmproj-key-progress-label::before{background:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmproj-key-progress-copy{margin:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.65;overflow-wrap:anywhere;}
      .pmproj-key-progress-copy.muted{color:var(--dsw-alias-label-secondary);}
      .pmproj-progress-section{position:relative;display:grid;gap:9px;min-width:0;padding:12px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-progress-section:fullscreen{width:100%;height:100%;overflow:auto;padding:16px;border:0;border-radius:0;background:var(--dsw-alias-bg-base);}
      .pmproj-progress-section.is-fullscreen{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;overflow:auto;padding:16px;border:0;border-radius:0;background:var(--dsw-alias-bg-base);box-shadow:none;}
      .pmproj-progress-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0;}
      .pmproj-progress-head-main{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;}
      .pmproj-progress-head-main h3{margin:0;font-size:13px;line-height:1.4;}
      .pmproj-progress-workflow-picker{height:30px;max-width:min(320px,100%);border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:0 8px;min-width:0;}
      .pmproj-progress-toolbar{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap;min-width:0;}
      .pmproj-progress-legend{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:11px;}
      .pmproj-progress-legend span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}
      .pmproj-progress-legend i{width:6px;height:6px;display:inline-block;border-radius:999px;background:var(--dsw-alias-label-tertiary);}
      .pmproj-progress-legend i.done{background:var(--dsw-alias-state-success-primary,#34d47e);}
      .pmproj-progress-legend i.running{background:var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmproj-progress-legend i.warning{background:var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmproj-progress-legend i.danger{background:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmproj-progress-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
      .pmproj-progress-anomaly{color:var(--dsw-alias-state-error-primary,#e5534b);font-size:11px;font-weight:600;white-space:nowrap;}
      .pmproj-progress-tool{width:28px;height:28px;flex:none;display:inline-grid;place-items:center;padding:0;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmproj-progress-tool:hover:not(:disabled){border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmproj-progress-tool:disabled{opacity:.42;cursor:not-allowed;}
      .pmproj-progress-tool svg{width:14px;height:14px;}
      .pmproj-progress-tool.is-spinning svg{animation:pmproj-progress-spin .85s linear infinite;}
      @keyframes pmproj-progress-spin{to{transform:rotate(360deg);}}
      @media (prefers-reduced-motion:reduce){.pmproj-progress-tool.is-spinning svg{animation:none;}}
      .pmproj-progress-zoom{min-width:38px;color:var(--dsw-alias-label-secondary);font-size:11px;text-align:center;font-variant-numeric:tabular-nums;}
      .pmproj-flow-viewport{min-width:0;overflow:auto;overscroll-behavior:contain;padding:2px 0 4px;}
      .pmproj-progress-section.is-fullscreen .pmproj-flow-viewport{display:flex;align-items:center;justify-content:center;flex:none;min-height:310px;padding:18px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background-color:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));background-image:radial-gradient(circle,color-mix(in srgb,var(--dsw-alias-border-l4) 48%,transparent) 1px,transparent 1px);background-size:20px 20px;}
      .pmproj-flow-stage{min-width:1080px;transform-origin:top left;transition:transform .14s ease;}
      .pmproj-progress-section.is-fullscreen .pmproj-flow-stage{min-width:max-content;}
      .pmproj-flow{display:flex;align-items:stretch;min-width:0;}
      .pmproj-flow-node{width:220px;min-width:220px;max-width:260px;flex:0 0 220px;display:flex;flex-direction:column;align-items:stretch;padding:10px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;transition:border-color .12s ease,background .12s ease;}
      .pmproj-flow-node:hover{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));}
      .pmproj-flow-node.selected.tone-done{border-color:var(--dsw-alias-state-success-primary,#34d47e);box-shadow:0 0 0 1px var(--dsw-alias-state-success-primary,#34d47e);}
      .pmproj-flow-node.selected.tone-progress{border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 1px var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmproj-flow-node.selected.tone-notice{border-color:var(--dsw-alias-state-warning-primary,#e2a737);box-shadow:0 0 0 1px var(--dsw-alias-state-warning-primary,#e2a737);}
      .pmproj-flow-node.selected.tone-warn{border-color:var(--dsw-alias-state-error-primary,#e5534b);box-shadow:0 0 0 1px var(--dsw-alias-state-error-primary,#e5534b);}
      .pmproj-flow-node.selected:not(.tone-done):not(.tone-progress):not(.tone-notice):not(.tone-warn){border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 1px var(--dsw-alias-accent-primary,#4f8ef7);}
      .pmproj-flow-node-top{display:flex;align-items:flex-start;justify-content:space-between;gap:7px;min-width:0;}
      .pmproj-flow-node-heading{display:flex;align-items:flex-start;gap:7px;flex:1;min-width:0;}
      .pmproj-flow-node-code{width:20px;height:20px;display:inline-grid;place-items:center;flex:none;border-radius:5px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;}
      .pmproj-flow-node-title{margin-top:1px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:650;line-height:1.45;overflow-wrap:anywhere;}
      .pmproj-flow-node-owner{display:block;margin-top:5px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45;}
      .pmproj-flow-node-owner strong{color:var(--dsw-alias-label-primary);font-weight:500;}
      .pmproj-flow-node-facts{display:grid;gap:5px;margin-top:9px;padding-top:8px;border-top:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-flow-node-fact{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start;font-size:11px;line-height:1.45;}
      .pmproj-flow-node-fact span{min-width:0;color:var(--dsw-alias-label-tertiary);white-space:normal;overflow-wrap:anywhere;}
      .pmproj-flow-node-fact strong{min-width:0;color:var(--dsw-alias-label-primary);font-weight:500;white-space:nowrap;}
      .pmproj-flow-node-fact strong.is-placeholder{color:var(--dsw-alias-label-tertiary);font-weight:400;}
      .pmproj-flow-node-exception{display:flex;align-items:flex-start;gap:5px;margin-top:auto;padding-top:9px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45;}
      .pmproj-flow-node-exception span{flex:none;color:var(--dsw-alias-label-tertiary);}
      .pmproj-flow-node-exception strong{min-width:0;color:var(--dsw-alias-label-secondary);font-weight:500;overflow-wrap:anywhere;}
      .pmproj-flow-arrow{width:20px;flex:0 0 20px;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);}
      .pmproj-flow-arrow::before{content:"→";}
      .pmproj-progress-events{display:grid;min-width:0;padding-top:8px;border-top:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-progress-events-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;}
      .pmproj-progress-events-toggle{width:100%;display:flex;align-items:center;gap:8px;padding:0;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left;}
      .pmproj-progress-events-toggle:hover{color:var(--dsw-alias-label-primary);}
      .pmproj-progress-events-toggle .pmproj-count{margin-left:auto;}
      .pmproj-progress-events-toggle svg{flex:none;}
      .pmproj-progress-events.is-collapsed .pmproj-progress-events-head{margin-bottom:0;}
      .pmproj-progress-event{display:grid;grid-template-columns:132px 78px minmax(0,1fr);gap:9px;align-items:start;padding:7px 0;border-bottom:0.5px solid var(--dsw-alias-border-l3);font-size:11px;line-height:1.55;}
      .pmproj-progress-event:last-child{border-bottom:0;}
      .pmproj-progress-event time{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap;}
      .pmproj-progress-event-tag{color:var(--dsw-alias-label-primary);font-weight:500;white-space:nowrap;}
      .pmproj-progress-event-copy{min-width:0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;}
      .pmproj-progress-event-source{margin-left:3px;color:var(--dsw-alias-label-tertiary);}
      .pmproj-progress-empty{padding:24px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:7px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center;line-height:1.6;}
      .pmproj-node-detail{display:grid;min-width:0;overflow:hidden;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-node-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-node-detail-title{min-width:0;}
      .pmproj-node-detail-title strong{font-size:12px;line-height:1.45;}
      .pmproj-node-detail-title p{margin:2px 0 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;overflow-wrap:anywhere;}
      .pmproj-node-links{display:grid;min-width:0;}
      .pmproj-node-links-section{display:grid;gap:7px;min-width:0;padding:10px 12px 12px;}
      .pmproj-node-links-section + .pmproj-node-links-section{border-top:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-node-links-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;}
      .pmproj-progress-alert,.pmproj-progress-task{display:grid;gap:7px;min-width:0;padding:10px 11px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-2);}
      .pmproj-node-links .pmproj-progress-task strong{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:1.5;overflow-wrap:anywhere;}
      .pmproj-node-links .pmproj-progress-task small{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;overflow-wrap:anywhere;}
      .pmproj-progress-alert{cursor:pointer;}
      .pmproj-progress-alert:hover,.pmproj-progress-alert.active{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 52%,var(--dsw-alias-border-l3));background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 6%,var(--dsw-alias-bg-layer-2));}
      .pmproj-progress-task.linked{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 58%,var(--dsw-alias-border-l3));background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e2a737) 7%,var(--dsw-alias-bg-layer-2));}
      .pmproj-progress-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0;}
      .pmproj-progress-card-copy{min-width:0;}
      .pmproj-progress-card-title{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}
      .pmproj-progress-card-title strong{min-width:0;font-size:13px;line-height:1.45;overflow-wrap:anywhere;}
      .pmproj-progress-type{display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 13%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);font-size:11px;line-height:1.45;white-space:nowrap;}
      .pmproj-progress-card-actions{display:flex;align-items:center;gap:6px;flex:none;}
      .pmproj-progress-card-actions .pmproj-btn{height:28px;padding:0 9px;font-size:11px;}
      .pmproj-progress-card-description{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55;overflow-wrap:anywhere;}
      .pmproj-progress-card-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:11px;}
      .pmproj-progress-card-meta-main{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;}
      .pmproj-progress-card-tags{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
      .pmproj-progress-task-id{color:var(--dsw-alias-label-secondary);font-size:11px;}
      .pmproj-progress-linked{display:flex;align-items:center;gap:5px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:11px;}
      .pmproj-progress-mini-chip{display:inline-flex;align-items:center;padding:1px 6px;border:0;border-radius:4px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;white-space:nowrap;cursor:pointer;}
      .pmproj-progress-mini-chip:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmproj-panel{display:flex;flex-direction:column;gap:8px;min-width:0;}
      .pmproj-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
      .pmproj-panel-title{display:flex;align-items:center;gap:8px;min-width:0;}
      .pmproj-panel-head h3{margin:0;font-size:13.5px;}
      .pmproj-count{color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmproj-view-switch{display:inline-flex;align-items:center;gap:2px;padding:2px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);}
      .pmproj-view-switch button{height:26px;padding:0 9px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;}
      .pmproj-view-switch button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
      .pmproj-view-switch button.active{background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);font-weight:600;}
      .pmproj-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;}
      .pmproj-table{display:grid;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;overflow:hidden;}
      .pmproj-row{display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(130px,1.2fr) minmax(90px,.7fr) minmax(120px,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border-bottom:0.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-row:last-child{border-bottom:0;}
      .pmproj-row:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmproj-role-view{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;min-width:0;width:100%;max-width:100%;overflow-x:clip;}
      .pmproj-member-pool-sentinel{height:0;}
      .pmproj-role-view-group{min-width:0;max-width:100%;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;overflow:clip;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-role-view-members{position:sticky;top:0;z-index:6;background:Canvas;box-shadow:0 3px 12px rgba(0,0,0,.22);}
      .pmproj-role-view-head{position:sticky;top:var(--pmproj-member-pool-offset,0px);z-index:4;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-bottom:0.5px solid var(--dsw-alias-border-l3);background:Canvas;}
      .pmproj-role-view-members .pmproj-role-view-head{top:0;}
      button.pmproj-role-view-head{width:100%;border-top:0;border-right:0;border-left:0;color:inherit;font:inherit;text-align:left;cursor:pointer;}
      button.pmproj-role-view-head:hover{background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));}
      .pmproj-role-view-title{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap;}
      .pmproj-role-view-title strong{font-size:12.5px;}
      .pmproj-role-view-scope{display:flex;align-items:center;gap:5px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:10.5px;text-align:right;}
      .pmproj-role-view-scope strong{color:var(--dsw-alias-label-primary);font-weight:500;}
      .pmproj-role-view-toggle{display:inline-flex;align-items:center;margin-left:4px;color:var(--dsw-alias-label-tertiary);}
      .pmproj-member-pool-toggle{width:24px;height:24px;flex:none;display:inline-grid;place-items:center;margin-left:4px;padding:0;border:0.5px solid transparent;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
      .pmproj-member-pool-toggle:hover{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmproj-role-view-row{display:grid;grid-template-columns:minmax(180px,1.3fr) minmax(110px,.7fr) auto;gap:10px;align-items:center;min-height:55px;padding:8px 10px;border-bottom:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-role-view-row:last-child{border-bottom:0;}
      .pmproj-role-view-row:hover{background:var(--dsw-alias-bg-layer-2);}
      .pmproj-role-view-empty{display:flex;align-items:center;justify-content:center;padding:16px 10px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;}
      .pmproj-role-view-group.drop-active{border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 7%,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base)));}
      .pmproj-member-card-grid,.pmproj-role-slot-members{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;min-width:0;width:100%;max-width:100%;padding:10px;align-items:start;}
      .pmproj-member-role-card{position:relative;width:100%;min-width:0;min-height:0;display:grid;align-content:start;gap:6px;padding:10px 44px 10px 10px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);cursor:grab;}
      .pmproj-member-role-card.pending{border-style:dashed;}
      .pmproj-member-role-card.compact{min-height:0;padding-bottom:10px;}
      .pmproj-member-role-card.no-tools{padding-right:10px;}
      .pmproj-member-role-card.dragging{opacity:.5;cursor:grabbing;}
      .pmproj-member-role-card.no-drag{cursor:default;}
      .pmproj-member-role-card:hover{border-color:var(--dsw-alias-border-l4);}
      .pmproj-member-card-tools{position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:6px;}
      .pmproj-role-count{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:999px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-size:11px;font-weight:700;line-height:1;}
      .pmproj-role-count.empty{background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);border:0.5px dashed var(--dsw-alias-border-l3);}
      .pmproj-member-card-tools .pmproj-actions{gap:5px;}
      .pmproj-role-remove{width:22px;height:22px;flex:none;display:grid;place-items:center;padding:0;border:0.5px solid var(--dsw-alias-border-l3);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmproj-role-remove:hover{color:var(--dsw-alias-state-error-primary,#e5534b);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 10%,transparent);}
      .pmproj-member-card-roles{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;min-width:0;}
      .pmproj-member-card-roles .pmproj-label{flex:none;}
      .pmproj-member-card-roles .pmproj-chips{display:contents;}
      .pmproj-role-view-members.stuck .pmproj-member-card-grid{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(220px,1fr);overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:8px 10px;}
      .pmproj-role-view-members.stuck .pmproj-member-card-roles{display:none;}
      .pmproj-role-view-members.stuck .pmproj-member-role-card{padding-top:8px;padding-bottom:8px;}
      .pmproj-role-row{display:grid;grid-template-columns:minmax(160px,1.4fr) minmax(140px,1.2fr) 90px 190px;gap:10px;align-items:center;min-height:58px;padding:9px 10px;border-bottom:0.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-role-row:last-child{border-bottom:0;}
      .pmproj-role-row:not(.removed):hover{background:var(--dsw-alias-bg-layer-2);}
      .pmproj-role-row.draft{background:color-mix(in srgb,var(--dsw-alias-button-primary-fill) 7%,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base)));}
      .pmproj-role-row.removed{opacity:.62;}
      .pmproj-role-row.removed .pmproj-member-copy strong{text-decoration:line-through;}
      .pmproj-member{display:flex;align-items:center;gap:8px;min-width:0;}
      .pmproj-avatar{width:26px;height:26px;flex:none;display:grid;place-items:center;border-radius:7px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;}
      .pmproj-avatar.human{background:#2f9e66;color:#fff;}
      .pmproj-avatar-ring{width:26px;height:26px;flex:none;display:grid;place-items:center;padding:2px;border-radius:50%;background:conic-gradient(from 210deg,#8b6cff,#4f8ef7,#7ed0ff,#ff79c9,#8b6cff);box-shadow:0 0 0 1px rgba(139,108,255,.26);}
      .pmproj-avatar-ring.platform{background:#63b8ff;box-shadow:0 0 0 1px rgba(99,184,255,.55);}
      .pmproj-avatar-art{width:100%;height:100%;display:block;overflow:hidden;border:2px solid var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));border-radius:50%;background:#20242a;object-fit:cover;}
      .pmproj-member-copy{min-width:0;}
      .pmproj-member-name{display:flex;align-items:center;gap:6px;min-width:0;}
      .pmproj-member-name strong{min-width:0;}
      .pmproj-member-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:12px;white-space:nowrap;}
      .pmproj-member-copy small{display:block;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:10px;}
      .pmproj-member-kind.agent{color:var(--dsw-alias-agent-primary,#8b7bf7);font-weight:600;}
      .pmproj-owner-tag{flex:none;border-radius:4px;padding:1px 5px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 14%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);font-size:9.5px;font-weight:600;line-height:1.5;letter-spacing:0;}
      .pmproj-label{display:block;color:var(--dsw-alias-label-secondary);font-size:10px;}
      .pmproj-value{display:block;margin-top:2px;font-size:11.5px;line-height:1.45;overflow-wrap:anywhere;}
      .pmproj-subvalue{display:block;margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.4;}
      .pmproj-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;}
      .pmproj-chip{border:0.5px solid var(--dsw-alias-border-l3);border-radius:4px;padding:1px 6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:10px;white-space:nowrap;}
      .pmproj-chip.agent{color:#8b7bf7;background:color-mix(in srgb,#8b7bf7 14%,transparent);border-color:transparent;}
      .pmproj-chip.empty{border-style:dashed;color:var(--dsw-alias-label-secondary);background:transparent;}
      .pmproj-actions{display:flex;justify-content:flex-end;gap:6px;}
      .pmproj-pill{display:inline-flex;align-items:center;border-radius:999px;padding:1px 7px;font-size:10.5px;white-space:nowrap;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-secondary);}
      .pmproj-pill.progress{color:#4f8ef7;background:color-mix(in srgb,#4f8ef7 14%,transparent);}
      .pmproj-pill.notice{color:#c99a2e;background:color-mix(in srgb,#c99a2e 16%,transparent);}
      .pmproj-pill.warn{color:#e5534b;background:color-mix(in srgb,#e5534b 16%,transparent);}
      .pmproj-pill.done{color:#3fa46a;background:color-mix(in srgb,#3fa46a 16%,transparent);}
      .pmproj-pill.cancelled{color:#c48b71;background:color-mix(in srgb,#c48b71 15%,transparent);}
      .pmproj-pill.archived{color:#8f96a3;background:color-mix(in srgb,#8f96a3 16%,transparent);}
      .pmproj-pill.input{color:#9aa4b2;background:color-mix(in srgb,#9aa4b2 16%,transparent);}
      .pmproj-pill.output{color:#4d9f78;background:color-mix(in srgb,#4d9f78 16%,transparent);}
      .pmproj-items{display:grid;gap:8px;}
      .pmproj-item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:9px 10px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-item[role="button"]{cursor:pointer;}
      .pmproj-item[role="button"]:hover{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);}
      .pmproj-item-main{min-width:0;}
      .pmproj-item-title{display:flex;align-items:center;gap:6px;min-width:0;}
      .pmproj-item-title .id{color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmproj-item-title strong{overflow:hidden;text-overflow:ellipsis;font-size:12.5px;white-space:nowrap;}
      .pmproj-item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:5px;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmproj-empty{padding:28px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:7px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:12px;}
      .pmproj-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;}
      .pmproj-history-search{width:min(360px,100%);}
      .pmproj-toolbar input[type="date"],.pmproj-toolbar input[type="search"]{height:30px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:0 8px;min-width:0;}
      .pmproj-report-tab-head{display:flex;align-items:center;gap:10px;min-height:32px;min-width:0;}
      .pmproj-report-tab-head h3{flex:none;margin:0;font-size:13.5px;line-height:1.4;}
      .pmproj-report-filters{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:1;min-width:0;flex-wrap:wrap;}
      .pmproj-report-filters>select{height:30px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;padding:0 7px;}
      .pmproj-report-filters>.pmproj-btn{flex:none;}
      .pmproj-report-dates{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;white-space:nowrap;min-width:0;}
      .pmproj-report-dates input{width:122px;height:30px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;padding:0 7px;min-width:0;}
      .pmproj-report-search{display:inline-flex;align-items:center;gap:6px;flex:1 1 180px;min-width:130px;max-width:340px;height:30px;padding:0 9px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);}
      .pmproj-report-search:focus-within{border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:var(--focus-ring);}
      .pmproj-report-search svg{width:13px;height:13px;flex:none;}
      .pmproj-report-search input{flex:1;min-width:0;height:28px;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;padding:0;}
      .pmproj-report-setup{width:30px;height:30px;flex:none;margin-left:auto;padding:0;}
      .pmproj-output-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
      .pmproj-output-search{display:flex;align-items:center;gap:6px;flex:1 1 260px;min-width:180px;height:30px;padding:0 8px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);}
      .pmproj-output-search svg{width:13px;height:13px;flex:none;color:var(--dsw-alias-label-secondary);}
      .pmproj-output-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;}
      .pmproj-output-toolbar input[type="date"],.pmproj-output-toolbar select{height:30px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;padding:0 7px;min-width:0;}
      .pmproj-output-range{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);font-size:11px;}
      .pmproj-output-timeline{display:grid;gap:12px;}
      .pmproj-output-day{display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:start;}
      .pmproj-output-date{position:sticky;top:8px;padding-top:4px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;line-height:1.4;}
      .pmproj-output-date small{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:400;}
      .pmproj-output-list{display:grid;gap:7px;min-width:0;}
      .pmproj-output-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 11px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-output-item:hover{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);}
      .pmproj-output-main{min-width:0;}
      .pmproj-output-title{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap;}
      .pmproj-output-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12.5px;white-space:nowrap;}
      .pmproj-output-meta,.pmproj-output-links{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmproj-output-source{padding:0;border:0;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:10.5px;cursor:pointer;text-align:left;}
      .pmproj-output-source:hover{text-decoration:underline;}
      .pmproj-output-node{padding:1px 7px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 35%,transparent);border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-accent-primary,#4f8ef7) 8%,transparent);color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:10px;cursor:pointer;}
      .pmproj-output-actions{display:flex;align-items:flex-start;gap:6px;}
      .pmproj-output-download{display:inline-flex;align-items:center;gap:5px;}
      .pmproj-output-empty{padding:28px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:7px;color:var(--dsw-alias-label-secondary);text-align:center;font-size:12px;}
      .pmproj-report{display:flex;flex-direction:column;gap:8px;padding:12px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-report-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;}
      .pmproj-report-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;}
      .pmproj-report-head h3{margin:0;font-size:13px;}
      .pmproj-report-head small{color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmproj-history{display:grid;gap:8px;}
      .pmproj-history-event{display:grid;grid-template-columns:8px minmax(0,1fr);gap:10px;padding:10px 11px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-history-dot{width:7px;height:7px;margin-top:5px;border-radius:999px;background:var(--dsw-alias-button-primary-fill);}
      .pmproj-history-event.identity .pmproj-history-dot{background:#8b7bf7;}
      .pmproj-history-event.template .pmproj-history-dot{background:#c99a2e;}
      .pmproj-history-event.member .pmproj-history-dot{background:#3fa46a;}
      .pmproj-history-body{min-width:0;}
      .pmproj-history-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;}
      .pmproj-history-title{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap;}
      .pmproj-history-title strong{font-size:12.5px;line-height:1.5;overflow-wrap:anywhere;}
      .pmproj-history-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:10.5px;}
      .pmproj-history-detail{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 10px;margin-top:7px;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.5;}
      .pmproj-history-detail dt{color:var(--dsw-alias-label-secondary);}
      .pmproj-history-detail dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;}
      .pmproj-markdown{font-size:12.5px;line-height:1.7;}
      .pmproj-markdown h3{margin:10px 0 6px;font-size:12.5px;color:var(--dsw-alias-label-primary);}
      .pmproj-markdown h3:first-child{margin-top:0;}
      .pmproj-markdown p{margin:4px 0;}
      .pmproj-markdown ul{margin:4px 0;padding-left:18px;display:grid;gap:3px;}
      .pmproj-markdown code{border-radius:4px;padding:0 4px;background:var(--dsw-alias-bg-layer-2);font-size:11.5px;}
      .pmproj-section{display:flex;flex-direction:column;gap:8px;margin-top:4px;}
      .pmproj-section-title{display:flex;align-items:center;justify-content:space-between;color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmproj-upload{cursor:pointer;}
      .pmproj-upload input{display:none;}
      .pmproj-form-grid.pmproj-business-chain-policy-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
      .pmproj-business-chain-config-row{display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:8px;align-items:end;margin-top:8px;}
      .pmproj-link-button{height:32px;padding:0 4px;border:0;background:transparent;color:var(--dsw-alias-accent-primary,#4f8ef7);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;}
      .pmproj-link-button:disabled{opacity:.5;cursor:not-allowed;}
      .pmproj-business-chain-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;}
      .pmproj-business-chain-toolbar-label{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5;white-space:nowrap;}
      .pmproj-business-chain-toolbar-name{display:inline-flex;align-items:baseline;gap:6px;min-width:0;color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:1.5;overflow-wrap:anywhere;}
      .pmproj-business-chain-toolbar .pmproj-head-actions{margin-left:8px;}
      .pmproj-business-chain-toolbar-action{width:64px;height:28px;flex:none;padding:0;justify-content:center;}
      .pmproj-business-chain-preview{margin-top:8px;}
      .pmproj-business-chain-source-row{display:flex;align-items:center;gap:12px;min-width:0;margin-top:4px;padding-top:8px;border-top:0.5px solid var(--dsw-alias-border-l3);}
      .pmproj-business-chain-source-label{flex:none;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;line-height:1.6;white-space:nowrap;}
      .pmproj-business-chain-source-row .pmproj-source-health{flex:0 1 auto;min-width:0;flex-wrap:nowrap;overflow-x:auto;}
      .pmproj-business-chain-source-row .pmproj-btn{flex:none;}
      .pmproj-source-health{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.6;}
      .pmproj-source-health strong{color:var(--dsw-alias-label-primary);font-size:11.5px;font-weight:600;}
      .pmproj-inline-form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;}
      .pmproj-inline-form select,.pmproj-inline-form input{flex:1;min-width:140px;height:30px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:0 8px;}
      .pmproj-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
      .pmproj-form-grid .wide{grid-column:1 / -1;}
      .pmproj-settings-basics{gap:8px 14px;margin-top:2px;}
      .pmproj-settings-basics .pmproj-field{gap:4px;}
      .pmproj-settings-basics .pmproj-footer{margin-top:2px;padding-top:8px;}
      .pmproj-other-settings{display:grid;gap:14px;padding-top:14px;}
      .pmproj-other-settings:empty{display:none;}
      .pmproj-field{display:grid;gap:5px;min-width:0;}
      .pmproj-field .label{color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmproj-field input,.pmproj-field select,.pmproj-field textarea{width:100%;height:32px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:0 9px;min-width:0;}
      .pmproj-field textarea{height:auto;min-height:78px;padding:8px 9px;resize:vertical;}
      .pmproj-field input:disabled,.pmproj-field select:disabled{opacity:.7;}
      .pmproj-member-picker{position:relative;min-width:0;}
      .pmproj-member-search{display:flex;align-items:center;gap:7px;height:32px;padding:0 8px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);}
      .pmproj-member-search:focus-within{border-color:var(--dsw-alias-accent-primary,#4f8ef7);box-shadow:var(--focus-ring);}
      .pmproj-member-search svg{width:13px;height:13px;flex:none;color:var(--dsw-alias-label-secondary);}
      .pmproj-member-search input{flex:1;width:auto;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:0;}
      .pmproj-member-search-clear{width:20px;height:20px;flex:none;display:grid;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
      .pmproj-member-search-clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .pmproj-member-search-clear svg{width:11px;height:11px;}
      .pmproj-member-results{position:absolute;z-index:70;top:calc(100% + 4px);right:0;left:0;max-height:260px;overflow:auto;padding:4px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 12px 30px rgba(0,0,0,.28);}
      .pmproj-member-result-group{display:block;padding:5px 7px 3px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:600;}
      .pmproj-member-result{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:7px;border:0;border-radius:5px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;}
      .pmproj-member-result:hover,.pmproj-member-result.active{background:var(--dsw-alias-bg-layer-2);}
      .pmproj-member-result-copy{min-width:0;}
      .pmproj-member-result-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;font-size:12px;white-space:nowrap;}
      .pmproj-member-result-copy small{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary);font-size:10px;white-space:nowrap;}
      .pmproj-member-result-kind{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;}
      .pmproj-member-search-status{padding:12px 8px;color:var(--dsw-alias-label-secondary);font-size:11.5px;text-align:center;}
      .pmproj-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}
      .pmproj-checkboxes{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;}
      .pmproj-checkbox{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;cursor:pointer;}
      .pmproj-checkbox:has(input:checked){border-color:color-mix(in srgb,var(--dsw-alias-button-primary-fill) 50%,transparent);color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-button-primary-fill) 12%,transparent);}
      .pmproj-checkbox input{margin:0;}
      .pmproj-field>.pmproj-checkbox{justify-self:start;width:auto;}
      .pmproj-field .pmproj-checkbox input{width:14px;height:14px;padding:0;flex:none;}
      .pmproj-modal-mask{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(8,10,14,.55);}
      .pmproj-modal-mask.open{display:flex;}
      .pmproj-modal{width:min(680px,100%);max-height:86vh;overflow:auto;padding:16px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));box-shadow:0 18px 48px rgba(0,0,0,.35);}
      .pmproj-modal.wide{position:relative;width:min(960px,100%);height:min(760px,86vh);display:flex;flex-direction:column;overflow:hidden;}
      .pmproj-modal.wide .pmproj-modal-head{margin-bottom:8px;}
      .pmproj-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
      .pmproj-modal-head h2{margin:0;font-size:14.5px;}
      .pmproj-settings-sticky{position:relative;z-index:12;flex:none;margin:-16px -16px 0;padding:16px 16px 8px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-settings-sticky .pmproj-modal-head{margin-bottom:8px;}
      .pmproj-settings-body-scroll{flex:1;min-height:0;overflow:auto;padding:12px 2px 0 0;}
      .pmproj-settings-footer{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;min-height:60px;margin:0 -16px -16px;padding:12px 16px 16px;border-top:0.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));}
      .pmproj-settings-footer-message{margin-right:auto;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.45;}
      .pmproj-settings-footer-message.is-error{color:var(--dsw-alias-state-error-primary,#e5534b);}
      .pmproj-error{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 45%,transparent);border-radius:6px;color:var(--dsw-alias-state-error-primary,#e5534b);font-size:12px;}
      .pmproj-notice{padding:8px 10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#34d47e) 38%,transparent);border-radius:6px;color:var(--dsw-alias-state-success-primary,#34d47e);font-size:12px;line-height:1.55;}
      .pmproj-notice.pmproj-notice-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 48%,transparent);color:var(--dsw-alias-state-error-primary,#e5534b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5534b) 7%,transparent);}
      .pmproj-template-summary{display:grid;gap:6px;margin-top:12px;padding:9px 10px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-2);font-size:11.5px;}
      .pmproj-template-summary>div{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .pmproj-template-summary span{color:var(--dsw-alias-label-secondary);}
      .pmproj-template-summary strong{color:var(--dsw-alias-label-primary);font-weight:600;text-align:right;}
      .pmproj-draft-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-button-primary-fill) 40%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-button-primary-fill) 8%,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base)));color:var(--dsw-alias-label-secondary);font-size:11.5px;}
      .pmproj-loading{padding:32px;color:var(--dsw-alias-label-secondary);font-size:12.5px;text-align:center;}
      .pmproj-readonly{padding:8px 9px;border:0.5px dashed var(--dsw-alias-border-l3);border-radius:6px;color:var(--dsw-alias-label-secondary);font-size:12px;}
      @media (max-width:1100px){
        .pmproj-member-card-grid,.pmproj-role-slot-members{grid-template-columns:repeat(2,minmax(0,1fr));}
      }
      @media (max-width:900px){
        .pmproj-layout{grid-template-columns:minmax(0,1fr);min-height:0;}
        .pmproj-layout.collapsed{grid-template-columns:46px minmax(0,1fr);min-height:0;}
        .pmproj-directory{height:min(420px,60vh);max-height:60vh;}
        .pmproj-directory.collapsed{height:auto;max-height:none;}
        .pmproj-row{grid-template-columns:minmax(0,1fr);}
        .pmproj-role-row{grid-template-columns:minmax(0,1fr);}
        .pmproj-role-view-row{grid-template-columns:minmax(0,1fr);}
        .pmproj-role-view-head{align-items:flex-start;flex-direction:column;}
        .pmproj-role-view-scope{text-align:left;}
        .pmproj-member-card-grid,.pmproj-role-slot-members{grid-template-columns:minmax(0,1fr);}
        .pmproj-member-role-card{min-height:0;min-width:0;padding-right:44px;}
        .pmproj-member-card-tools{flex-wrap:wrap;justify-content:flex-end;}
        .pmproj-role-editor .pmproj-role-row{grid-template-columns:minmax(130px,1.3fr) minmax(110px,1fr) 70px 170px;}
        .pmproj-facts{flex-direction:column;align-items:stretch;gap:5px;}
        .pmproj-fact{padding:2px 0;}
        .pmproj-fact + .pmproj-fact{padding-left:0;border-left:0;}
        .pmproj-progress-event{grid-template-columns:minmax(0,1fr);gap:2px;}
        .pmproj-progress-event time,.pmproj-progress-event-tag{white-space:normal;}
        .pmproj-form-grid{grid-template-columns:1fr;}
        .pmproj-form-grid.pmproj-business-chain-policy-grid{grid-template-columns:1fr;}
        .pmproj-business-chain-config-row{grid-template-columns:1fr;align-items:stretch;}
        .pmproj-history-detail{grid-template-columns:1fr;}
        .pmproj-output-day{grid-template-columns:1fr;}
        .pmproj-output-date{position:static;display:flex;align-items:center;gap:7px;}
        .pmproj-output-date small{display:inline;margin:0;}
      }
      @media (max-width:640px){
        .pmproj-settings-nav{align-items:stretch;flex-direction:column;}
        .pmproj-settings-nav .pmproj-tabs{width:100%;}
        .pmproj-settings-template{align-self:flex-end;margin:0 0 4px;}
        .pmproj-template-summary>div{align-items:flex-start;flex-direction:column;gap:2px;}
        .pmproj-template-summary strong{text-align:left;}
        .pmproj-role-editor .pmproj-role-row{grid-template-columns:minmax(0,1fr);}
        .pmproj-summary{padding:10px;}
        .pmproj-detail-head{flex-direction:column;}
        .pmproj-head-actions{width:100%;}
        .pmproj-key-progress-row{grid-template-columns:minmax(0,1fr);gap:4px;}
        .pmproj-progress-section,.pmproj-progress-section.is-fullscreen{padding:10px;}
        .pmproj-flow-stage{min-width:0;}
        .pmproj-flow{flex-direction:column;}
        .pmproj-flow-node{width:100%;min-width:0;max-width:none;flex:0 0 auto;}
        .pmproj-flow-arrow{width:100%;height:18px;flex-basis:18px;}
        .pmproj-flow-arrow::before{content:"↓";}
        .pmproj-progress-card-head{align-items:stretch;flex-direction:column;}
        .pmproj-progress-card-actions{justify-content:flex-end;}
      }
    `;

    const SearchIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
        },
        h("circle", { cx: 11, cy: 11, r: 7, key: "c" }),
        h("path", { d: "m20 20-3.6-3.6", key: "p" }),
      );

    const CopyIcon = () =>
      h(
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
        h("rect", { x: 8, y: 8, width: 13, height: 13, rx: 2, key: "r" }),
        h("path", {
          d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
          key: "p",
        }),
      );

    const StarIcon = ({ filled = false }) =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 14,
          height: 14,
          fill: filled ? "currentColor" : "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
        },
        h("path", {
          d: "m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.1 6.4 20l1.2-6.2L3 9.5l6.3-.8L12 3Z",
        }),
      );

    const DownloadIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 13,
          height: 13,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
        },
        h("path", { d: "M12 3v12", key: "line" }),
        h("path", { d: "m7 10 5 5 5-5", key: "arrow" }),
        h("path", { d: "M5 21h14", key: "base" }),
      );

    const SettingsIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 14,
          height: 14,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
        },
        h("path", {
          d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z",
          key: "path",
        }),
        h("circle", { cx: 12, cy: 12, r: 3, key: "circle" }),
      );

    const ChevronDownIcon = ({ expanded = false }) =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 13,
          height: 13,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          style: {
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          },
        },
        h("path", { d: "m6 9 6 6 6-6", key: "chevron" }),
      );

    const CloseIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 12,
          height: 12,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          "aria-hidden": "true",
        },
        h("path", { d: "m6 6 12 12M18 6 6 18", key: "close" }),
      );

    const ZoomOutIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          "aria-hidden": "true",
        },
        h("path", { d: "M5 12h14", key: "line" }),
      );

    const ZoomInIcon = () =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          "aria-hidden": "true",
        },
        h("path", { d: "M5 12h14", key: "line" }),
        h("path", { d: "M12 5v14", key: "vertical" }),
      );

    const ResetIcon = () =>
      h(
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
        h("path", { d: "M4 4v6h6", key: "corner" }),
        h("path", {
          d: "M5.5 15a7 7 0 1 0 .5-7.5L4 10",
          key: "loop",
        }),
      );

    const FullscreenIcon = ({ exit = false }) =>
      h(
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
        ...(exit
          ? [
              h("path", {
                d: "M8 8H5a2 2 0 0 1-2-2V3",
                key: "tl",
              }),
              h("path", {
                d: "M16 8h3a2 2 0 0 0 2-2V3",
                key: "tr",
              }),
              h("path", {
                d: "M8 16H5a2 2 0 0 0-2 2v3",
                key: "bl",
              }),
              h("path", {
                d: "M16 16h3a2 2 0 0 1 2 2v3",
                key: "br",
              }),
            ]
          : [
              h("path", {
                d: "M8 3H5a2 2 0 0 0-2 2v3",
                key: "tl",
              }),
              h("path", {
                d: "M16 3h3a2 2 0 0 1 2 2v3",
                key: "tr",
              }),
              h("path", {
                d: "M8 21H5a2 2 0 0 1-2-2v-3",
                key: "bl",
              }),
              h("path", {
                d: "M16 21h3a2 2 0 0 0 2-2v-3",
                key: "br",
              }),
            ]),
      );

    const DemoDataUploadIcon = () =>
      h(
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
        h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
        h("path", { d: "m17 8-5-5-5 5" }),
        h("path", { d: "M12 3v12" }),
      );

    const PanelToggleIcon = ({ collapsed = false }) =>
      h(
        "svg",
        {
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          style: {
            transform: collapsed ? "rotate(180deg)" : "none",
          },
        },
        h("rect", {
          x: 3,
          y: 4,
          width: 18,
          height: 16,
          rx: 2,
          key: "rect",
        }),
        h("path", { d: "M9 4v16", key: "divider" }),
        h("path", { d: "m14 9-3 3 3 3", key: "chevron" }),
      );

    function Pill({ tone, children, title }) {
      return h(
        "span",
        {
          className: `pmproj-pill ${tone ?? ""}`.trim(),
          ...(title === undefined ? {} : { title }),
        },
        children,
      );
    }

    function ProgressFollowButton({ type, id, label }) {
      const shared = window.__pluginmaxFollow?.FollowButton;
      const [busy, setBusy] = react.useState(false);
      const [localFollowed, setLocalFollowed] = react.useState(false);
      if (typeof shared === "function") {
        return h(shared, {
          type,
          id,
          subjectLabel: label,
          compact: true,
        });
      }
      return h(
        "button",
        {
          className: "pmproj-progress-tool",
          type: "button",
          disabled: busy,
          "aria-pressed": localFollowed ? "true" : "false",
          "aria-label": localFollowed ? `取消关注${label}` : `关注${label}`,
          title: localFollowed ? `取消关注${label}` : `关注${label}`,
          onClick: async (event) => {
            event.stopPropagation();
            setBusy(true);
            try {
              const result = await request(
                "/api/collab/workbench/follows/toggle",
                {
                  method: "POST",
                  body: JSON.stringify({ type, targetId: id }),
                },
              );
              setLocalFollowed(result.followed === true);
              window.dispatchEvent(
                new CustomEvent("pluginmax:follow-change", {
                  detail: {
                    type,
                    targetId: id,
                    followed: result.followed === true,
                  },
                }),
              );
            } catch (cause) {
              window.dispatchEvent(
                new CustomEvent("pluginmax:workbench-toast", {
                  detail: {
                    message: `关注操作失败：${
                      cause instanceof Error ? cause.message : String(cause)
                    }`,
                  },
                }),
              );
            } finally {
              setBusy(false);
            }
          },
        },
        StarIcon({ filled: localFollowed }),
      );
    }

    function normalizeReportMarkdown(content) {
      return String(content ?? "").replace(
        /^## RAG 结论[ \t]*$/gm,
        "## 一句话结论",
      );
    }

    function Markdown({ content }) {
      return h(
        "div",
        { className: "pmproj-markdown" },
        markdownBlocks(normalizeReportMarkdown(content)),
      );
    }

    /** 任务详情：复用任务模块的 pending task 深链约定。 */
    function openTask(taskId, workspaceId) {
      window.__pluginmaxPendingTask = { taskId, workspaceId };
      // Let the shell change route and announce route-select in the same turn.
      // Calling setRoute first can mount the task page, consume the pending task,
      // and then let the subsequent route-select event clear it again.
      window.dispatchEvent(
        new CustomEvent("pluginmax:navigate", { detail: { route: "task" } }),
      );
    }

    /** 工作流详情：复用工作流模块的 collab-navigate 约定。 */
    function openWorkflow(instanceId, workspaceId, nodeId) {
      if (typeof window.__pluginmaxShell?.setRoute === "function") {
        window.__pluginmaxShell.setRoute("workflow");
      }
      window.dispatchEvent(
        new CustomEvent("pluginmax:collab-navigate", {
          detail: { plugin: "workflow", instanceId, workspaceId, nodeId },
        }),
      );
    }

    /** 会议文件与纪要统一回到对应会议详情。 */
    function openMeeting(meetingId, workspaceId, tab) {
      if (typeof window.__pluginmaxShell?.setRoute === "function") {
        window.__pluginmaxShell.setRoute("meetings");
      }
      window.dispatchEvent(
        new CustomEvent("pluginmax:collab-navigate", {
          detail: {
            plugin: "meeting",
            meetingId,
            workspaceId,
            ...(tab === undefined ? {} : { tab }),
          },
        }),
      );
    }

    /** Data Agent 报告回到生成它的数据洞察会话。 */
    function openDataAgent(conversationId, workspaceId) {
      window.__pluginmaxPendingDataAgentConversation = {
        conversationId,
        workspaceId,
      };
      if (typeof window.__pluginmaxSidePanel?.openTab === "function") {
        window.__pluginmaxSidePanel.openTab("data-agent");
      } else if (typeof window.__pluginmaxShell?.setRoute === "function") {
        window.__pluginmaxShell.setRoute("workbench");
      }
    }

    const OUTPUT_SOURCE_LABELS = {
      task: "任务",
      workflow: "工作流",
      meeting: "会议",
      "data-agent": "Data Agent",
    };

    function outputSourceLabel(sourceKind) {
      return OUTPUT_SOURCE_LABELS[sourceKind] ?? "来源";
    }

    const OUTPUT_TYPE_LABELS = {
      pdf: "PDF",
      word: "Word",
      spreadsheet: "表格",
      presentation: "演示文稿",
      markdown: "Markdown",
      text: "文本",
      image: "图片",
      archive: "压缩包",
      other: "其他",
    };

    function outputDay(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const pad = (number) => String(number).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )}`;
    }

    function outputMatches(item, keyword, type, fromDate, toDate) {
      const day = outputDay(item.updatedAt);
      if (type !== "all" && item.documentType !== type) return false;
      if (fromDate !== "" && day < fromDate) return false;
      if (toDate !== "" && day > toDate) return false;
      const needle = String(keyword ?? "")
        .trim()
        .toLowerCase();
      if (needle === "") return true;
      return [
        item.name,
        item.workflowNodeName,
        item.workflowInstanceTitle,
        item.sourceName,
        item.authorName,
      ]
        .filter((value) => value !== undefined)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    }

    function groupOutputsByDay(items) {
      const groups = [];
      for (const item of [...items].sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.name.localeCompare(right.name),
      )) {
        const day = outputDay(item.updatedAt) || "日期未知";
        let group = groups.at(-1);
        if (group === undefined || group.date !== day) {
          group = { date: day, items: [] };
          groups.push(group);
        }
        group.items.push(item);
      }
      return groups;
    }

    function formatFileSize(value) {
      const size = Number(value);
      if (!Number.isFinite(size) || size < 0) return "—";
      if (size < 1_024) return `${size} B`;
      if (size < 1_024 * 1_024) return `${(size / 1_024).toFixed(1)} KB`;
      return `${(size / (1_024 * 1_024)).toFixed(1)} MB`;
    }

    function outputLoadErrorMessage(cause) {
      if (
        typeof cause === "object" &&
        cause !== null &&
        "status" in cause &&
        cause.status === 404
      ) {
        return "产出物服务未加载，请重启当前服务后重试。";
      }
      return cause instanceof Error ? cause.message : String(cause);
    }

    function normalizeReportSchedule(value) {
      const schedule = value ?? {};
      return {
        enabled: schedule.enabled !== false,
        frequency:
          REPORT_SCHEDULE_FREQUENCY_LABELS[schedule.frequency] === undefined
            ? DEFAULT_REPORT_SCHEDULE.frequency
            : schedule.frequency,
        time:
          typeof schedule.time === "string" &&
          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)
            ? schedule.time
            : DEFAULT_REPORT_SCHEDULE.time,
        timezone:
          typeof schedule.timezone === "string" && schedule.timezone !== ""
            ? schedule.timezone
            : DEFAULT_REPORT_SCHEDULE.timezone,
        weekday:
          Number.isInteger(schedule.weekday) &&
          schedule.weekday >= 0 &&
          schedule.weekday <= 6
            ? schedule.weekday
            : DEFAULT_REPORT_SCHEDULE.weekday,
        dayOfMonth:
          Number.isInteger(schedule.dayOfMonth) &&
          schedule.dayOfMonth >= 1 &&
          schedule.dayOfMonth <= 28
            ? schedule.dayOfMonth
            : DEFAULT_REPORT_SCHEDULE.dayOfMonth,
      };
    }

    function reportScheduleSummary(value) {
      const schedule = normalizeReportSchedule(value);
      if (!schedule.enabled) return "自动生成已停用";
      if (schedule.frequency === "weekdays") {
        return `每个工作日 ${schedule.time}`;
      }
      if (schedule.frequency === "weekly") {
        return `每${REPORT_WEEKDAY_LABELS[schedule.weekday]} ${schedule.time}`;
      }
      if (schedule.frequency === "monthly") {
        return `每月 ${schedule.dayOfMonth} 日 ${schedule.time}`;
      }
      return `每天 ${schedule.time}`;
    }

    function ProjectGlobalPage(props) {
      const route = props.useShellRoute?.((state) => state.route);
      if (route !== "projects") return null;
      return h(ProjectWorkspace, props);
    }

    function ProjectWorkspace(props) {
      const [phase, setPhase] = react.useState("loading");
      const [error, setError] = react.useState("");
      const [projects, setProjects] = react.useState([]);
      const [viewer, setViewer] = react.useState(null);
      const [selectedId, setSelectedId] = react.useState("");
      const [search, setSearch] = react.useState("");
      const [directoryCollapsed, setDirectoryCollapsed] = react.useState(false);
      const [tab, setTab] = react.useState("progress");
      const [view, setView] = react.useState("detail");
      const [progressWorkflowId, setProgressWorkflowId] = react.useState("");
      const [progressWorkflowDetail, setProgressWorkflowDetail] =
        react.useState(null);
      const [progressWorkflowLoading, setProgressWorkflowLoading] =
        react.useState(false);
      const [progressWorkflowError, setProgressWorkflowError] =
        react.useState("");
      const [progressSelectedNodeId, setProgressSelectedNodeId] =
        react.useState("");
      const [progressSelectedAlertId, setProgressSelectedAlertId] =
        react.useState("");
      const [progressZoom, setProgressZoom] = react.useState(1);
      const [progressFullscreen, setProgressFullscreen] = react.useState(false);
      const [progressChangeEventsExpanded, setProgressChangeEventsExpanded] =
        react.useState(null);
      const [progressDemoDataConfig, setProgressDemoDataConfig] =
        react.useState(null);
      const progressViewportRef = react.useRef(null);
      const [memberManageMode, setMemberManageMode] = react.useState(false);
      const [memberView, setMemberView] = react.useState("members");
      const [memberPoolCollapsed, setMemberPoolCollapsed] =
        react.useState(false);
      const [expandedEmptyRoles, setExpandedEmptyRoles] = react.useState(
        () => new Set(),
      );
      const [draggedMember, setDraggedMember] = react.useState(null);
      const [dropRoleId, setDropRoleId] = react.useState("");
      const memberPoolRef = react.useRef(null);
      const memberPoolSentinelRef = react.useRef(null);
      const memberPoolStuckRef = react.useRef(false);
      const [memberPoolStuck, setMemberPoolStuck] = react.useState(false);
      const [memberPoolStickyHeight, setMemberPoolStickyHeight] =
        react.useState(0);
      const [detail, setDetail] = react.useState(null);
      const [detailLoading, setDetailLoading] = react.useState(false);
      const [followed, setFollowed] = react.useState(() => new Set());
      const [editOpen, setEditOpen] = react.useState(false);
      const [editDraft, setEditDraft] = react.useState(null);
      const [editTab, setEditTab] = react.useState("basics");
      const [otherSettingsFooter, setOtherSettingsFooter] =
        react.useState(null);
      const [leaveOpen, setLeaveOpen] = react.useState(false);
      const [memberModal, setMemberModal] = react.useState(null);
      const [memberSearchQuery, setMemberSearchQuery] = react.useState("");
      const [memberSearchResults, setMemberSearchResults] = react.useState({
        humans: [],
        agents: [],
      });
      const [memberSearchLoading, setMemberSearchLoading] =
        react.useState(false);
      const [memberSearchError, setMemberSearchError] = react.useState("");
      const [memberSearchOpen, setMemberSearchOpen] = react.useState(false);
      const [memberSearchActiveIndex, setMemberSearchActiveIndex] =
        react.useState(0);
      const [roleModal, setRoleModal] = react.useState(null);
      const [roleSourcesOpen, setRoleSourcesOpen] = react.useState(false);
      const [roleSources, setRoleSources] = react.useState([]);
      const [roleSourcesLoading, setRoleSourcesLoading] = react.useState(false);
      const [roleSourceId, setRoleSourceId] = react.useState("");
      const [roleSourceRoleIds, setRoleSourceRoleIds] = react.useState([]);
      const [createOpen, setCreateOpen] = react.useState(false);
      const [createDraft, setCreateDraft] = react.useState({
        name: "",
        path: "",
        templateId: "",
      });
      /** 项目角色草稿：null 表示未进入编辑，展示当前有效集。 */
      const [roleDraft, setRoleDraft] = react.useState(null);
      const [roleDraftRevision, setRoleDraftRevision] = react.useState(null);
      const [businessChainData, setBusinessChainData] = react.useState(null);
      const [businessChainLoading, setBusinessChainLoading] =
        react.useState(false);
      const [businessChainError, setBusinessChainError] = react.useState("");
      const [businessChainDraft, setBusinessChainDraft] = react.useState(null);
      const [businessChainValidation, setBusinessChainValidation] =
        react.useState(null);
      const [
        businessChainValidationExpanded,
        setBusinessChainValidationExpanded,
      ] = react.useState(false);
      const [businessChainNotice, setBusinessChainNotice] = react.useState("");
      const [businessChainUploadedFileName, setBusinessChainUploadedFileName] =
        react.useState("");
      const [businessChainPreviewNodeId, setBusinessChainPreviewNodeId] =
        react.useState("");
      const [businessChainPreviewZoom, setBusinessChainPreviewZoom] =
        react.useState(1);
      const [
        businessChainPreviewFullscreen,
        setBusinessChainPreviewFullscreen,
      ] = react.useState(false);
      const businessChainPreviewViewportRef = react.useRef(null);
      const [progressOverview, setProgressOverview] = react.useState(null);
      const [templateLoadOpen, setTemplateLoadOpen] = react.useState(false);
      const [memberImpact, setMemberImpact] = react.useState(null);
      const [workflowBlock, setWorkflowBlock] = react.useState(null);
      const [roleNotice, setRoleNotice] = react.useState("");
      const [draftGuard, setDraftGuard] = react.useState(null);
      const [busy, setBusy] = react.useState("");
      const [templatePane, setTemplatePane] = react.useState("templates");
      const [templateTab, setTemplateTab] = react.useState("basics");
      const [templateData, setTemplateData] = react.useState(null);
      const [templateSearch, setTemplateSearch] = react.useState("");
      const [selectedTemplateId, setSelectedTemplateId] = react.useState("");
      const [selectedRoleId, setSelectedRoleId] = react.useState("");
      const [templateDraft, setTemplateDraft] = react.useState(null);
      const [catalogRoleDraft, setCatalogRoleDraft] = react.useState(null);
      const businessChainFileRef = react.useRef(null);
      const demoDataFileRef = react.useRef(null);
      const [projectTemplateSaveOpen, setProjectTemplateSaveOpen] =
        react.useState(false);
      const [projectTemplateSaveDraft, setProjectTemplateSaveDraft] =
        react.useState({ name: "", type: "" });
      const [projectTemplateSaveNotice, setProjectTemplateSaveNotice] =
        react.useState("");
      const [projectTemplateSaveError, setProjectTemplateSaveError] =
        react.useState("");
      const [reports, setReports] = react.useState([]);
      const [reportsLoading, setReportsLoading] = react.useState(false);
      const [reportFrom, setReportFrom] = react.useState("");
      const [reportTo, setReportTo] = react.useState("");
      const [reportSearch, setReportSearch] = react.useState("");
      const [reportSearchDraft, setReportSearchDraft] = react.useState("");
      const [reportType, setReportType] = react.useState("daily");
      const [reportScheduleOpen, setReportScheduleOpen] = react.useState(false);
      const [reportScheduleDraft, setReportScheduleDraft] = react.useState({
        ...DEFAULT_REPORT_SCHEDULE,
      });
      const [reportNotice, setReportNotice] = react.useState("");
      const [history, setHistory] = react.useState([]);
      const [historyLoading, setHistoryLoading] = react.useState(false);
      const [historySearch, setHistorySearch] = react.useState("");
      const [historyCategory, setHistoryCategory] = react.useState("all");
      const [outputs, setOutputs] = react.useState([]);
      const [outputsFor, setOutputsFor] = react.useState("");
      const [outputsLoading, setOutputsLoading] = react.useState(false);
      const [outputsError, setOutputsError] = react.useState("");
      const [outputSearch, setOutputSearch] = react.useState("");
      const [outputType, setOutputType] = react.useState("all");
      const [outputFrom, setOutputFrom] = react.useState("");
      const [outputTo, setOutputTo] = react.useState("");
      const fail = (cause) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
      };

      const copyWorkspaceValue = async (value, label) => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          fail(new Error(`复制${label}失败`));
        }
      };

      react.useEffect(() => {
        if (error === "") return undefined;
        const timer = window.setTimeout(() => setError(""), 4_000);
        return () => window.clearTimeout(timer);
      }, [error]);
      react.useEffect(() => {
        if (roleNotice === "") return undefined;
        const timer = window.setTimeout(() => setRoleNotice(""), 6_000);
        return () => window.clearTimeout(timer);
      }, [roleNotice]);
      react.useEffect(() => {
        if (reportNotice === "") return undefined;
        const timer = window.setTimeout(() => setReportNotice(""), 4_000);
        return () => window.clearTimeout(timer);
      }, [reportNotice]);
      react.useEffect(() => {
        if (businessChainNotice === "") return undefined;
        const timer = window.setTimeout(
          () => setBusinessChainNotice(""),
          6_000,
        );
        return () => window.clearTimeout(timer);
      }, [businessChainNotice]);

      const loadProjects = react.useCallback(async () => {
        if (token() === null) {
          setError("请先在「账号与权限 → 登录账号」中登录。");
          setPhase("ready");
          return;
        }
        try {
          setPhase("loading");
          const result = await request("/api/collab/projects");
          const items = result.projects ?? [];
          setProjects(items);
          setViewer(result.viewer ?? null);
          window.dispatchEvent(
            new CustomEvent("pluginmax:project-scope-refresh"),
          );
          setSelectedId((current) =>
            items.some((project) => project.workspaceId === current)
              ? current
              : (items[0]?.workspaceId ?? ""),
          );
          setPhase("ready");
        } catch (cause) {
          setPhase("ready");
          fail(cause);
        }
      }, []);

      const loadFollows = react.useCallback(async () => {
        try {
          const result = await request("/api/collab/workbench/follows");
          const ids = (result.follows ?? [])
            .filter((record) => record.type === "project")
            .map((record) => record.targetId);
          setFollowed(new Set(ids));
        } catch {
          // 关注状态不可用不影响项目管理主体功能。
        }
      }, []);

      react.useEffect(() => {
        void loadProjects();
        void loadFollows();
        const synchronize = () => {
          setPhase("loading");
          setError("");
          setProjects([]);
          setViewer(null);
          setSelectedId("");
          setSearch("");
          setDirectoryCollapsed(false);
          setTab("progress");
          setView("detail");
          setProgressWorkflowId("");
          setProgressWorkflowDetail(null);
          setProgressWorkflowLoading(false);
          setProgressWorkflowError("");
          setProgressSelectedNodeId("");
          setProgressSelectedAlertId("");
          setProgressZoom(1);
          setProgressFullscreen(false);
          setMemberManageMode(false);
          setMemberView("members");
          setExpandedEmptyRoles(new Set());
          setDraggedMember(null);
          setDropRoleId("");
          setDetail(null);
          setFollowed(new Set());
          setEditOpen(false);
          setEditDraft(null);
          setLeaveOpen(false);
          setMemberModal(null);
          setMemberSearchQuery("");
          setMemberSearchResults({ humans: [], agents: [] });
          setMemberSearchError("");
          setMemberSearchOpen(false);
          setRoleModal(null);
          setRoleSourcesOpen(false);
          setRoleSources([]);
          setRoleSourceRoleIds([]);
          setCreateOpen(false);
          setRoleDraft(null);
          setRoleDraftRevision(null);
          setProjectTemplateSaveOpen(false);
          setProjectTemplateSaveDraft({ name: "", type: "" });
          setProjectTemplateSaveNotice("");
          setProjectTemplateSaveError("");
          setBusinessChainData(null);
          setBusinessChainLoading(false);
          setBusinessChainError("");
          setBusinessChainDraft(null);
          setBusinessChainValidation(null);
          setBusinessChainNotice("");
          setBusinessChainUploadedFileName("");
          setProgressOverview(null);
          setTemplateLoadOpen(false);
          setMemberImpact(null);
          setWorkflowBlock(null);
          setRoleNotice("");
          setDraftGuard(null);
          setReports([]);
          setReportsLoading(false);
          setReportSearch("");
          setReportSearchDraft("");
          setReportScheduleOpen(false);
          setReportScheduleDraft({ ...DEFAULT_REPORT_SCHEDULE });
          setReportNotice("");
          setHistory([]);
          setOutputs([]);
          setOutputsFor("");
          setOutputsLoading(false);
          setOutputsError("");
          setOutputSearch("");
          setOutputType("all");
          setOutputFrom("");
          setOutputTo("");
          void loadProjects();
          void loadFollows();
        };
        window.addEventListener("pluginmax:collab-token", synchronize);
        return () =>
          window.removeEventListener("pluginmax:collab-token", synchronize);
      }, [loadProjects, loadFollows]);

      const loadDetail = react.useCallback(
        async (workspaceId, silent = false) => {
          if (workspaceId === "") {
            setDetail(null);
            return;
          }
          try {
            if (!silent) setDetailLoading(true);
            const result = await request(
              `/api/collab/projects/detail?workspaceId=${encodeURIComponent(
                workspaceId,
              )}`,
            );
            setDetail(result);
            setReportScheduleDraft(
              normalizeReportSchedule(result.project?.reportSchedule),
            );
            setDetailLoading(false);
          } catch (cause) {
            setDetailLoading(false);
            fail(cause);
          }
        },
        [],
      );

      react.useEffect(() => {
        void loadDetail(selectedId);
      }, [selectedId, loadDetail]);

      react.useEffect(() => {
        const receiveCreatedTasks = (event) => {
          const createdTasks = Array.isArray(event?.detail?.tasks)
            ? event.detail.tasks
            : [];
          if (createdTasks.length === 0) return;
          setDetail((current) => {
            if (current === null) return current;
            const workspaceId = current.project?.workspaceId ?? selectedId;
            const scoped = createdTasks.filter(
              (task) => task?.workspaceId === workspaceId,
            );
            if (scoped.length === 0) return current;
            const createdIds = new Set(scoped.map((task) => task.id));
            return {
              ...current,
              tasks: [
                ...scoped,
                ...(current.tasks ?? []).filter(
                  (task) => !createdIds.has(task.id),
                ),
              ],
            };
          });
        };
        window.addEventListener("pluginmax:tasks-created", receiveCreatedTasks);
        return () =>
          window.removeEventListener(
            "pluginmax:tasks-created",
            receiveCreatedTasks,
          );
      }, [selectedId]);

      const loadReports = react.useCallback(async (workspaceId) => {
        if (workspaceId === "") return;
        try {
          setReportsLoading(true);
          const result = await request(
            `/api/collab/projects/reports?workspaceId=${encodeURIComponent(
              workspaceId,
            )}`,
          );
          setReports(result.reports ?? []);
        } catch (cause) {
          fail(cause);
        } finally {
          setReportsLoading(false);
        }
      }, []);

      const loadProgressWorkflow = react.useCallback(
        async (workspaceId, instanceId) => {
          if (workspaceId === "" || instanceId === "") {
            setProgressWorkflowDetail(null);
            return;
          }
          try {
            setProgressWorkflowLoading(true);
            setProgressWorkflowError("");
            const result = await request(
              `/api/collab/workflow/instances/detail?workspaceId=${encodeURIComponent(
                workspaceId,
              )}&instanceId=${encodeURIComponent(instanceId)}`,
            );
            setProgressWorkflowDetail(result);
          } catch (cause) {
            setProgressWorkflowError(
              cause instanceof Error ? cause.message : String(cause),
            );
            setProgressWorkflowDetail(null);
          } finally {
            setProgressWorkflowLoading(false);
          }
        },
        [],
      );

      const loadHistory = react.useCallback(async (workspaceId) => {
        if (workspaceId === "") return;
        try {
          setHistoryLoading(true);
          const result = await request(
            `/api/collab/projects/history?workspaceId=${encodeURIComponent(
              workspaceId,
            )}&limit=500`,
          );
          setHistory(result.events ?? []);
        } catch (cause) {
          fail(cause);
        } finally {
          setHistoryLoading(false);
        }
      }, []);

      const loadOutputs = react.useCallback(async (workspaceId) => {
        if (workspaceId === "") return;
        try {
          setOutputsLoading(true);
          setOutputsError("");
          const result = await request(
            `/api/collab/projects/outputs?workspaceId=${encodeURIComponent(
              workspaceId,
            )}`,
          );
          setOutputs(result.outputs ?? []);
          setOutputsFor(workspaceId);
        } catch (cause) {
          setOutputsError(outputLoadErrorMessage(cause));
        } finally {
          setOutputsLoading(false);
        }
      }, []);

      const loadBusinessChain = react.useCallback(async (workspaceId) => {
        if (workspaceId === "") {
          setBusinessChainData(null);
          return;
        }
        try {
          setBusinessChainLoading(true);
          setBusinessChainError("");
          const result = await request(
            `/api/collab/projects/business-chain?workspaceId=${encodeURIComponent(
              workspaceId,
            )}`,
          );
          setBusinessChainData(result.businessChain ?? null);
          setBusinessChainDraft((current) => {
            if (current !== null) return current;
            const data = result.businessChain ?? null;
            const definitionId =
              data?.current?.workflowDefinitionId ??
              data?.candidates?.[0]?.definitionId ??
              "";
            const nodes = data?.current
              ? (data.nodes ?? [])
              : (data?.candidates?.[0]?.nodes ?? []);
            return definitionId === ""
              ? null
              : {
                  definitionId,
                  nodeBindings: normalizeBusinessChainBindings(nodes),
                };
          });
        } catch (cause) {
          setBusinessChainError(
            cause instanceof Error ? cause.message : String(cause),
          );
          setBusinessChainData(null);
        } finally {
          setBusinessChainLoading(false);
        }
      }, []);

      const probeBusinessChainSources = async () => {
        if (selectedProject === null) return;
        setBusy("business-chain-source-probe");
        try {
          await loadBusinessChain(selectedProject.workspaceId);
        } catch (cause) {
          setBusinessChainNotice(
            cause instanceof Error ? cause.message : String(cause),
          );
        } finally {
          setBusy("");
        }
      };

      const loadProgressOverview = react.useCallback(async (workspaceId) => {
        if (workspaceId === "") {
          setProgressOverview(null);
          return;
        }
        try {
          const result = await request(
            `/api/collab/projects/progress-overview?workspaceId=${encodeURIComponent(
              workspaceId,
            )}`,
          );
          const overview = result.overview ?? null;
          setProgressOverview(
            overview?.businessChain === null ? null : overview,
          );
        } catch {
          setProgressOverview(null);
        }
      }, []);

      const uploadProgressDemoData = async (file) => {
        if (file === undefined || selectedProject === null) return;
        setBusy("demo-data-upload");
        try {
          if (!file.name.toLowerCase().endsWith(".json")) {
            throw new Error("演示数据配置必须是 .json 文件");
          }
          const data = JSON.parse(await file.text());
          try {
            await request("/api/collab/projects/demo-data/upload", {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selectedProject.workspaceId,
                fileName: file.name,
                data,
              }),
            });
          } catch (cause) {
            if (cause.status !== 404) throw cause;
          }
          const localConfig = { fileName: file.name, data };
          window.localStorage.setItem(
            `pluginmax.project-demo-data.${selectedProject.workspaceId}`,
            JSON.stringify(localConfig),
          );
          setProgressDemoDataConfig(localConfig);
          await loadProgressOverview(selectedProject.workspaceId);
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
          if (demoDataFileRef.current !== null) {
            demoDataFileRef.current.value = "";
          }
        }
      };

      const downloadOutput = async (item) => {
        try {
          const current = token();
          const response = await fetch(item.downloadUrl, {
            headers:
              current === null ? {} : { authorization: `Bearer ${current}` },
            cache: "no-store",
          });
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(
              body?.error?.message ?? `下载失败（HTTP ${response.status}）`,
            );
          }
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = objectUrl;
          anchor.download = item.name;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(objectUrl);
        } catch (cause) {
          setOutputsError(
            cause instanceof Error ? cause.message : String(cause),
          );
        }
      };

      react.useEffect(() => {
        if (tab !== "reports" && tab !== "progress") return;
        void loadReports(selectedId);
      }, [tab, selectedId, loadReports]);

      react.useEffect(() => {
        if (tab !== "progress") return;
        void loadProgressOverview(selectedId);
      }, [tab, selectedId, loadProgressOverview]);

      react.useEffect(() => {
        if (!editOpen || editTab !== "business-chain") return;
        if (businessChainData !== null) return;
        void loadBusinessChain(selectedId);
      }, [editOpen, editTab, businessChainData, selectedId, loadBusinessChain]);

      react.useEffect(() => {
        const workflows = detail?.workflows ?? [];
        if (workflows.length === 0) {
          setProgressWorkflowId("");
          setProgressWorkflowDetail(null);
          return;
        }
        setProgressWorkflowId((current) =>
          workflows.some((workflow) => workflow.id === current)
            ? current
            : (preferredProgressWorkflow(workflows)?.id ?? ""),
        );
      }, [detail?.workflows]);

      react.useEffect(() => {
        if (tab !== "progress") return;
        if (selectedId === "" || progressWorkflowId === "") return;
        if (
          progressWorkflowDetail?.instance?.id === progressWorkflowId &&
          progressWorkflowDetail?.instance?.workspaceId === selectedId
        ) {
          return;
        }
        void loadProgressWorkflow(selectedId, progressWorkflowId);
      }, [
        tab,
        selectedId,
        progressWorkflowId,
        progressWorkflowDetail?.instance?.id,
        progressWorkflowDetail?.instance?.workspaceId,
        loadProgressWorkflow,
      ]);

      react.useEffect(() => {
        if (tab !== "progress" || progressWorkflowDetail === null) return;
        const overview = buildProgressOverview({
          workflowDetail: progressWorkflowDetail,
          tasks: detail?.tasks ?? [],
        });
        if (
          progressSelectedNodeId !== "" &&
          !overview.nodes.some((node) => node.id === progressSelectedNodeId)
        ) {
          setProgressSelectedNodeId("");
          setProgressSelectedAlertId("");
        }
      }, [tab, detail?.tasks, progressWorkflowDetail, progressSelectedNodeId]);

      react.useEffect(() => {
        if (tab !== "progress" || progressOverview === null) return;
        if (
          progressSelectedNodeId !== "" &&
          !(progressOverview.nodes ?? []).some(
            (node) => node.id === progressSelectedNodeId,
          )
        ) {
          setProgressSelectedNodeId("");
          setProgressSelectedAlertId("");
        }
      }, [tab, progressOverview, progressSelectedNodeId]);

      react.useEffect(() => {
        if (!progressFullscreen && !businessChainPreviewFullscreen) {
          return undefined;
        }
        const close = (event) => {
          if (event.key !== "Escape") return;
          setProgressFullscreen(false);
          setBusinessChainPreviewFullscreen(false);
        };
        window.addEventListener("keydown", close);
        return () => window.removeEventListener("keydown", close);
      }, [progressFullscreen, businessChainPreviewFullscreen]);

      react.useEffect(() => {
        if (tab !== "history") return;
        void loadHistory(selectedId);
      }, [tab, selectedId, loadHistory]);

      react.useEffect(() => {
        setTab("progress");
        setProgressWorkflowDetail(null);
        setProgressWorkflowError("");
        setProgressSelectedNodeId("");
        setProgressSelectedAlertId("");
        setProgressZoom(1);
        setProgressFullscreen(false);
        setProgressChangeEventsExpanded(null);
        setMemberManageMode(false);
        setMemberView("members");
        setExpandedEmptyRoles(new Set());
        setDraggedMember(null);
        setDropRoleId("");
        setReports([]);
        setReportsLoading(false);
        setReportSearch("");
        setReportSearchDraft("");
        setReportScheduleOpen(false);
        setReportScheduleDraft({ ...DEFAULT_REPORT_SCHEDULE });
        setReportNotice("");
        setOutputs([]);
        setOutputsFor("");
        setOutputsLoading(false);
        setOutputsError("");
        setOutputSearch("");
        setOutputType("all");
        setOutputFrom("");
        setOutputTo("");
        setBusinessChainData(null);
        setBusinessChainError("");
        setBusinessChainDraft(null);
        setBusinessChainValidation(null);
        setBusinessChainPreviewNodeId("");
        setBusinessChainPreviewZoom(1);
        setBusinessChainPreviewFullscreen(false);
        setProjectTemplateSaveOpen(false);
        setProjectTemplateSaveNotice("");
        setProjectTemplateSaveError("");
        setProgressOverview(null);
      }, [selectedId]);

      react.useEffect(() => {
        if (selectedId === "") {
          setProgressDemoDataConfig(null);
          return;
        }
        try {
          const stored = window.localStorage.getItem(
            `pluginmax.project-demo-data.${selectedId}`,
          );
          setProgressDemoDataConfig(
            stored === null ? null : JSON.parse(stored),
          );
        } catch {
          setProgressDemoDataConfig(null);
        }
      }, [selectedId]);

      react.useEffect(() => {
        if (selectedId === "") return;
        if (outputsFor === selectedId) return;
        void loadOutputs(selectedId);
      }, [selectedId, outputsFor, loadOutputs]);

      const loadTemplates = react.useCallback(async () => {
        try {
          const result = await request("/api/collab/projects/templates");
          setTemplateData(result);
          setSelectedTemplateId((current) =>
            (result.templates ?? []).some((item) => item.id === current)
              ? current
              : ((result.templates ?? [])[0]?.id ?? ""),
          );
          setSelectedRoleId((current) =>
            (result.roles ?? []).some((item) => item.id === current)
              ? current
              : ((result.roles ?? [])[0]?.id ?? ""),
          );
        } catch (cause) {
          fail(cause);
        }
      }, []);

      react.useEffect(() => {
        if (view !== "templates" || templateData !== null) return;
        void loadTemplates();
      }, [view, templateData, loadTemplates]);

      const selectedProject =
        projects.find((project) => project.workspaceId === selectedId) ??
        projects[0] ??
        null;
      const canManage =
        detail?.viewer?.canManage === true || viewer?.role === "admin";
      const visibleProjects = projects.filter((project) =>
        projectMatches(project, search),
      );
      const effectiveRoles = (detail?.roles ?? []).filter(
        (role) => role.system !== true,
      );
      const systemRoles = (detail?.roles ?? []).filter(
        (role) => role.system === true,
      );
      const draftRoles = roleDraft ?? effectiveRoles;
      const roleDiff = computeRoleDiff(effectiveRoles, draftRoles);
      const roleDraftDirty =
        roleDiff.added.length +
          roleDiff.updated.length +
          roleDiff.removed.length >
        0;
      const businessChainDirty =
        businessChainDraft !== null &&
        (businessChainDraft.definitionId !==
          (businessChainData?.current?.workflowDefinitionId ?? "") ||
          JSON.stringify(
            normalizeBusinessChainBindings(
              businessChainDraft.nodeBindings ?? [],
            ),
          ) !==
            JSON.stringify(
              normalizeBusinessChainBindings(businessChainData?.nodes ?? []),
            ));
      const settingsDraftDirty = roleDraftDirty || businessChainDirty;

      react.useEffect(() => {
        const keyword = memberSearchQuery.trim();
        if (
          memberModal?.mode !== "add" ||
          selectedProject === null ||
          keyword === ""
        ) {
          setMemberSearchLoading(false);
          setMemberSearchError("");
          setMemberSearchResults({ humans: [], agents: [] });
          return undefined;
        }
        const controller = new AbortController();
        setMemberSearchLoading(true);
        setMemberSearchError("");
        const timer = window.setTimeout(() => {
          void request(
            `/api/collab/projects/members/search?workspaceId=${encodeURIComponent(
              selectedProject.workspaceId,
            )}&q=${encodeURIComponent(keyword)}&limit=30`,
            { signal: controller.signal },
          )
            .then((result) => {
              if (controller.signal.aborted) return;
              setMemberSearchResults({
                humans: result.humans ?? [],
                agents: result.agents ?? [],
              });
              setMemberSearchActiveIndex(0);
            })
            .catch((cause) => {
              if (controller.signal.aborted) return;
              if (cause?.status === 404) {
                setMemberSearchResults(
                  filterMemberDirectoryLocally(
                    detail?.directory,
                    detail?.members,
                    keyword,
                  ),
                );
                setMemberSearchError("");
                return;
              }
              setMemberSearchError(
                cause instanceof Error ? cause.message : String(cause),
              );
              setMemberSearchResults({ humans: [], agents: [] });
            })
            .finally(() => {
              if (!controller.signal.aborted) setMemberSearchLoading(false);
            });
        }, 220);
        return () => {
          window.clearTimeout(timer);
          controller.abort();
        };
      }, [
        detail?.directory,
        detail?.members,
        memberModal?.mode,
        memberSearchQuery,
        selectedProject?.workspaceId,
      ]);

      react.useEffect(() => {
        if (view !== "detail" || tab !== "members" || memberView !== "roles") {
          memberPoolStuckRef.current = false;
          setMemberPoolStuck(false);
          setMemberPoolStickyHeight(0);
          return undefined;
        }
        const sentinel = memberPoolSentinelRef.current;
        const pool = memberPoolRef.current;
        if (sentinel === null || pool === null) return undefined;
        const scrollContainer = sentinel.closest(".pmx-stage");
        const updateStuckState = () => {
          const containerTop =
            scrollContainer?.getBoundingClientRect().top ?? 0;
          const sentinelRect = sentinel.getBoundingClientRect();
          const poolRect = pool.getBoundingClientRect();
          const atScrollEnd =
            scrollContainer !== null &&
            scrollContainer.scrollTop >=
              scrollContainer.scrollHeight - scrollContainer.clientHeight - 1;
          const stuck = resolveMemberPoolStuck({
            current: memberPoolStuckRef.current,
            sentinelTop: sentinelRect.top,
            containerTop,
            poolBottom: poolRect.bottom,
            atScrollEnd,
          });
          if (stuck === memberPoolStuckRef.current) return;
          memberPoolStuckRef.current = stuck;
          setMemberPoolStuck(stuck);
          if (!stuck) setMemberPoolStickyHeight(0);
        };
        let frame = 0;
        const onScroll = () => {
          if (frame !== 0) return;
          frame = window.requestAnimationFrame(() => {
            frame = 0;
            updateStuckState();
          });
        };
        const target = scrollContainer ?? window;
        target.addEventListener("scroll", onScroll, {
          passive: true,
        });
        updateStuckState();
        return () => {
          target.removeEventListener("scroll", onScroll);
          if (frame !== 0) window.cancelAnimationFrame(frame);
        };
      }, [detail?.project?.workspaceId, memberView, tab, view]);

      react.useLayoutEffect(() => {
        const node = memberPoolRef.current;
        if (node === null || !memberPoolStuck) {
          setMemberPoolStickyHeight(0);
          return undefined;
        }
        const syncHeight = () => {
          const next = node.offsetHeight;
          setMemberPoolStickyHeight((current) =>
            current === next ? current : next,
          );
        };
        syncHeight();
        const observer = new ResizeObserver(syncHeight);
        observer.observe(node);
        return () => observer.disconnect();
      }, [detail?.members?.length, memberPoolStuck, memberView, tab, view]);

      const refreshDetail = async () => {
        await Promise.all([loadProjects(), loadDetail(selectedId, true)]);
      };

      const toggleFollow = async () => {
        if (selectedProject === null) return;
        try {
          const sharedFollow = window.__pluginmaxFollow;
          const result =
            typeof sharedFollow?.toggle === "function"
              ? await sharedFollow.toggle(
                  "project",
                  selectedProject.workspaceId,
                )
              : await request("/api/collab/workbench/follows/toggle", {
                  method: "POST",
                  body: JSON.stringify({
                    type: "project",
                    targetId: selectedProject.workspaceId,
                  }),
                });
          const isFollowed =
            typeof result === "boolean" ? result : result.followed === true;
          const next = new Set(followed);
          if (isFollowed) next.add(selectedProject.workspaceId);
          else next.delete(selectedProject.workspaceId);
          setFollowed(next);
          window.dispatchEvent(
            new CustomEvent("pluginmax:follow-change", {
              detail: {
                type: "project",
                targetId: selectedProject.workspaceId,
                followed: isFollowed,
              },
            }),
          );
        } catch (cause) {
          fail(cause);
        }
      };

      const leaveProject = async () => {
        if (selectedProject === null) return;
        setBusy("leave");
        try {
          await request("/api/collab/projects/leave", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selectedProject.workspaceId,
            }),
          });
          setLeaveOpen(false);
          setDetail(null);
          setTab("progress");
          await loadProjects();
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const openEdit = () => {
        if (selectedProject === null) return;
        setRoleNotice("");
        setProjectTemplateSaveOpen(false);
        setProjectTemplateSaveDraft({ name: "", type: "" });
        setProjectTemplateSaveNotice("");
        setProjectTemplateSaveError("");
        setEditDraft({
          name: selectedProject.name,
          ownerId: selectedProject.ownerId ?? "",
          status: selectedProject.status,
          health: selectedProject.health,
          progress: String(selectedProject.progress ?? 0),
          startDate: selectedProject.startDate ?? "",
          targetDate: selectedProject.targetDate ?? "",
          description: selectedProject.description ?? "",
        });
        setEditTab("basics");
        setBusinessChainData(null);
        setBusinessChainDraft(null);
        setBusinessChainValidation(null);
        setBusinessChainError("");
        setBusinessChainNotice("");
        setBusinessChainUploadedFileName("");
        setOtherSettingsFooter(null);
        setEditOpen(true);
      };

      const closeEditModal = () => {
        if (settingsDraftDirty) {
          setDraftGuard({ kind: "edit-close" });
          return;
        }
        setRoleDraft(null);
        setRoleDraftRevision(null);
        setBusinessChainDraft(null);
        setBusinessChainValidation(null);
        setBusinessChainUploadedFileName("");
        setOtherSettingsFooter(null);
        setEditOpen(false);
      };

      const saveEdit = async () => {
        if (selectedProject === null || editDraft === null) return;
        setBusy("edit");
        try {
          await request("/api/collab/projects/update", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selectedProject.workspaceId,
              ...(editDraft.ownerId === ""
                ? {}
                : { ownerId: editDraft.ownerId }),
              status: editDraft.status,
              health: editDraft.health,
              progress: Number(editDraft.progress || 0),
              startDate: editDraft.startDate,
              targetDate: editDraft.targetDate,
              description: editDraft.description,
            }),
          });
          if (settingsDraftDirty) {
            setRoleNotice("基础信息已保存；其他设置草稿尚未生效。");
            setEditTab(roleDraftDirty ? "roles" : "business-chain");
          } else {
            setRoleDraft(null);
            setRoleDraftRevision(null);
            setBusinessChainDraft(null);
            setEditOpen(false);
          }
          await refreshDetail();
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const openMemberModal = (mode, member) => {
        if (detail === null) return;
        setMemberSearchQuery("");
        setMemberSearchResults({ humans: [], agents: [] });
        setMemberSearchError("");
        setMemberSearchOpen(false);
        setMemberSearchActiveIndex(0);
        setMemberModal({
          mode,
          memberId: member?.principalId ?? member?.id ?? "",
          memberKind: member?.kind ?? "human",
          roleIds: [...(member?.roleIds ?? [])],
          workspaceRole: member?.workspaceRole ?? "member",
          addKind: "human",
          addId: "",
        });
      };

      const selectMemberCandidate = (kind, candidate) => {
        if (memberModal === null || memberModal.mode !== "add") return;
        setMemberModal({
          ...memberModal,
          addKind: kind,
          addId: candidate.principalId ?? candidate.id,
        });
        setMemberSearchQuery(candidate.name);
        setMemberSearchOpen(false);
      };

      const memberModalMember = (() => {
        if (memberModal === null || detail === null) return null;
        if (memberModal.mode === "add") {
          if (memberModal.addKind === "human") {
            const candidate = (memberSearchResults.humans ?? []).find(
              (item) =>
                item.principalId === memberModal.addId ||
                item.id === memberModal.addId,
            );
            return candidate === undefined
              ? null
              : {
                  id: candidate.id,
                  principalId: candidate.principalId,
                  name: candidate.name,
                  kind: "human",
                  kindLabel: "Human Principal",
                  platformRole: candidate.platformRole,
                  workspaceRole: "member",
                  roleIds: [],
                };
          }
          const candidate = (memberSearchResults.agents ?? []).find(
            (item) =>
              item.principalId === memberModal.addId ||
              item.id === memberModal.addId,
          );
          return candidate === undefined
            ? null
            : {
                id: candidate.id,
                principalId: candidate.principalId,
                name: candidate.name,
                kind: "agent",
                kindLabel: candidate.kindLabel ?? "AI伙伴",
                platformRole: candidate.platformRole ?? "未分配",
                workspaceRole: undefined,
                roleIds: [],
              };
        }
        return (
          (detail.members ?? []).find(
            (member) =>
              member.principalId === memberModal.memberId ||
              member.id === memberModal.memberId,
          ) ?? null
        );
      })();

      const memberSearchOptions = [
        ...(memberSearchResults.humans ?? []).map((candidate) => ({
          kind: "human",
          candidate,
        })),
        ...(memberSearchResults.agents ?? []).map((candidate) => ({
          kind: "agent",
          candidate,
        })),
      ];

      const memberModalScope =
        memberModal === null || detail === null
          ? "未分配"
          : memberScopeForRoles(detail.roles ?? [], memberModal.roleIds);

      const saveMember = async () => {
        if (detail === null || memberModal === null) return;
        const memberId =
          memberModal.mode === "add" ? memberModal.addId : memberModal.memberId;
        const memberKind =
          memberModal.mode === "add"
            ? memberModal.addKind
            : memberModal.memberKind;
        if (memberId === "") {
          fail(new Error("请选择要添加的成员"));
          return;
        }
        setBusy("member");
        try {
          await request("/api/collab/projects/members/save", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selectedProject.workspaceId,
              memberKind,
              memberId,
              roleIds: memberModal.roleIds,
              ...(memberKind === "human"
                ? { workspaceRole: memberModal.workspaceRole }
                : {}),
            }),
          });
          setMemberModal(null);
          await refreshDetail();
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const removeMember = async (memberKind, memberId) => {
        if (selectedProject === null) return;
        setBusy("member");
        try {
          await request("/api/collab/projects/members/remove", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selectedProject.workspaceId,
              memberKind,
              memberId,
            }),
          });
          setMemberModal(null);
          await refreshDetail();
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      /** 打开项目角色的新增/编辑弹窗（角色定义只属于当前项目）。 */
      const openRoleModal = (mode, role) => {
        const stamp = Date.now().toString(36);
        setRoleModal(
          mode === "edit" && role !== undefined && role !== null
            ? {
                mode: "edit",
                id: role.id,
                name: role.name,
                code: role.code,
                category: role.category || "执行",
                description: role.description ?? "",
                permissions: [...(role.permissions ?? ["read", "write"])],
                prefillId: "",
                copyMode: false,
                effective: effectiveRoles.some(
                  (item) => roleCodeKey(item) === roleCodeKey(role),
                ),
                originalId: role.id,
                originalName: role.name,
                originalCode: role.code,
              }
            : {
                mode: "add",
                id: `role-${stamp}`,
                name: "",
                code: "",
                category: "执行",
                description: "",
                permissions: ["read", "write"],
                prefillId: "",
                copyMode: false,
                effective: false,
                originalId: "",
                originalName: "",
                originalCode: "",
              },
        );
      };

      /** 编辑弹窗内切换「调整原角色 / 另存为新角色」。 */
      const switchRoleCopyMode = (copyMode) => {
        if (roleModal === null) return;
        if (copyMode) {
          const base = currentRoleDraft();
          const code = nextRoleCopyCode(
            roleModal.originalCode || roleModal.code,
            base,
          );
          setRoleModal({
            ...roleModal,
            copyMode: true,
            id: `role-${Date.now().toString(36)}`,
            name:
              roleModal.originalName !== "" &&
              roleModal.name === roleModal.originalName
                ? `${roleModal.originalName}（副本）`
                : roleModal.name,
            code,
          });
          return;
        }
        setRoleModal({
          ...roleModal,
          copyMode: false,
          id: roleModal.originalId || roleModal.id,
          code: roleModal.originalCode || roleModal.code,
          name:
            roleModal.originalName !== "" &&
            roleModal.name === `${roleModal.originalName}（副本）`
              ? roleModal.originalName
              : roleModal.name,
        });
      };

      /** 从全局角色库预填表单，但保存时仍生成该项目的独立角色 id。 */
      const prefillRole = (catalogId) => {
        if (roleModal === null) return;
        const role = (detail?.roleLibrary ?? []).find(
          (item) => item.id === catalogId,
        );
        if (role === undefined) {
          setRoleModal({ ...roleModal, prefillId: catalogId });
          return;
        }
        const usedCodes = new Set(draftRoles.map((item) => roleCodeKey(item)));
        let code = role.code;
        let index = 2;
        while (usedCodes.has(roleCodeKey({ code }))) {
          code = `${role.code}_${index}`;
          index += 1;
        }
        setRoleModal({
          ...roleModal,
          prefillId: catalogId,
          name: role.name,
          code,
          category: role.category,
          description: role.description ?? "",
          permissions: [...(role.permissions ?? ["read", "write"])],
        });
      };

      const saveRoleModal = () => {
        if (roleModal === null || selectedProject === null) return;
        if (roleModal.name.trim() === "") {
          fail(new Error("请填写角色名称"));
          return;
        }
        if (roleModal.permissions.length === 0) {
          fail(new Error("请至少选择一个角色权限"));
          return;
        }
        const base = currentRoleDraft();
        const copyMode = roleModal.copyMode === true;
        const timestamp = Date.now().toString(36);
        const rawName = roleModal.name.trim();
        const name =
          copyMode && rawName === roleModal.originalName
            ? `${rawName}（副本）`
            : rawName;
        const code = copyMode
          ? nextRoleCopyCode(roleModal.originalCode, base)
          : roleModal.code.trim().toUpperCase() ||
            name
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "") ||
            `ROLE_${timestamp.toUpperCase()}`;
        const id = copyMode ? `role-${timestamp}` : roleModal.id;
        const nameKey = name.toLowerCase();
        const duplicateCode = base.some(
          (role) =>
            (copyMode || role.id !== id) &&
            roleCodeKey(role) === roleCodeKey({ code }),
        );
        const duplicateName = base.some(
          (role) =>
            (copyMode || role.id !== id) &&
            String(role.name).trim().toLowerCase() === nameKey,
        );
        if (duplicateCode) {
          fail(new Error(`角色标识已存在：${code}`));
          return;
        }
        if (duplicateName) {
          fail(new Error(`角色名称已存在：${roleModal.name.trim()}`));
          return;
        }
        const nextRole = {
          id,
          name,
          code,
          category: roleModal.category,
          description: roleModal.description,
          permissions: [...roleModal.permissions],
        };
        const index = copyMode ? -1 : base.findIndex((role) => role.id === id);
        const next =
          index < 0
            ? [...base, nextRole]
            : base.map((role, position) =>
                position === index ? nextRole : role,
              );
        setRoleDraft(next);
        if (roleDraft === null) {
          setRoleDraftRevision(detail?.project?.rolesRevision ?? 1);
        }
        setRoleModal(null);
      };

      const deleteRoleModal = () => {
        if (roleModal === null || selectedProject === null) return;
        const base = currentRoleDraft();
        const next = base.filter(
          (role) =>
            role.id !== roleModal.id &&
            roleCodeKey(role) !== roleCodeKey(roleModal),
        );
        setRoleDraft(next);
        if (roleDraft === null) {
          setRoleDraftRevision(detail?.project?.rolesRevision ?? 1);
        }
        setRoleModal(null);
      };

      const cloneRole = (role) => ({
        ...role,
        permissions: [...(role.permissions ?? [])],
      });

      /** 当前草稿；未进入草稿时从有效集复制。 */
      const currentRoleDraft = () =>
        roleDraft === null
          ? effectiveRoles.map(cloneRole)
          : roleDraft.map(cloneRole);

      const markDraft = (next) => {
        setRoleDraft(next);
        if (roleDraft === null) {
          setRoleDraftRevision(detail?.project?.rolesRevision ?? 1);
        }
      };

      const resetRoleDraft = () => {
        setRoleDraft(null);
        setRoleDraftRevision(null);
        setMemberImpact(null);
        setWorkflowBlock(null);
        setDraftGuard(null);
      };

      const removeDraftRole = (role) => {
        markDraft(
          currentRoleDraft().filter(
            (item) => roleCodeKey(item) !== roleCodeKey(role),
          ),
        );
      };

      const restoreDraftRole = (role) => {
        const base = currentRoleDraft();
        if (base.some((item) => roleCodeKey(item) === roleCodeKey(role))) {
          return;
        }
        markDraft([...base, cloneRole(role)]);
      };

      const openTemplateLoad = () => {
        setTemplateLoadOpen(true);
      };

      /** 选中模版即写入草稿；已有同 code 角色保留原 id/成员指派。 */
      const applyTemplateToDraft = (templateId) => {
        if (detail === null) return;
        const template = (detail.templates ?? []).find(
          (item) => item.id === templateId,
        );
        if (template === undefined) return;
        const stamp = Date.now().toString(36);
        let index = 0;
        const next = template.roleIds
          .map((roleId) =>
            (detail.roleLibrary ?? []).find((role) => role.id === roleId),
          )
          .filter(Boolean)
          .map((role) => {
            const existing = effectiveRoles.find(
              (item) => roleCodeKey(item) === roleCodeKey(role),
            );
            index += 1;
            return {
              id: existing?.id ?? `role-${stamp}-${index}`,
              name: role.name,
              code: roleCodeKey(role),
              category: role.category,
              description: role.description ?? "",
              permissions: [...(role.permissions ?? [])],
            };
          });
        setRoleDraft(next);
        setRoleDraftRevision(detail.project?.rolesRevision ?? 1);
        setTemplateLoadOpen(false);
        setDraftGuard(null);
        setRoleNotice(
          `已加载模版「${template.name}」的 ${next.length} 个角色，确认后生效`,
        );
      };

      /**
       * 选择模版之后才判断草稿覆盖：先让用户看到并选中模版，
       * 再由确认弹窗决定是否放弃当前草稿。
       */
      const loadTemplateToDraft = (templateId) => {
        if (roleDraftDirty) {
          const template = (detail?.templates ?? []).find(
            (item) => item.id === templateId,
          );
          setTemplateLoadOpen(false);
          setDraftGuard({
            kind: "template",
            templateId,
            templateName: template?.name ?? "",
          });
          return;
        }
        applyTemplateToDraft(templateId);
      };

      /** 打开「复用其他项目角色」弹窗并加载可访问的来源项目。 */
      const openRoleSources = async () => {
        if (selectedProject === null) return;
        setRoleSourcesOpen(true);
        setRoleSourcesLoading(true);
        try {
          const result = await request(
            `/api/collab/projects/role-sources?workspaceId=${encodeURIComponent(
              selectedProject.workspaceId,
            )}`,
          );
          const sources = result.sources ?? [];
          setRoleSources(sources);
          const first = sources[0];
          setRoleSourceId(first?.workspaceId ?? "");
          setRoleSourceRoleIds(
            first === undefined ? [] : first.roles.map((role) => role.id),
          );
        } catch (cause) {
          fail(cause);
        } finally {
          setRoleSourcesLoading(false);
        }
      };

      const selectRoleSource = (workspaceId) => {
        const source = roleSources.find(
          (item) => item.workspaceId === workspaceId,
        );
        setRoleSourceId(workspaceId);
        setRoleSourceRoleIds(
          source === undefined ? [] : source.roles.map((role) => role.id),
        );
      };

      const importSourceRoles = () => {
        if (
          selectedProject === null ||
          roleSourceId === "" ||
          roleSourceRoleIds.length === 0
        ) {
          return;
        }
        const source = roleSources.find(
          (item) => item.workspaceId === roleSourceId,
        );
        if (source === undefined) return;
        const base = currentRoleDraft();
        const existingCodes = new Set(base.map((role) => roleCodeKey(role)));
        const stamp = Date.now().toString(36);
        let added = 0;
        let skipped = 0;
        const next = [...base];
        for (const role of source.roles) {
          if (!roleSourceRoleIds.includes(role.id)) continue;
          const code = roleCodeKey(role);
          if (existingCodes.has(code)) {
            skipped += 1;
            continue;
          }
          existingCodes.add(code);
          added += 1;
          next.push({
            id: `role-${stamp}-${added}`,
            name: role.name,
            code,
            category: role.category,
            description: role.description ?? "",
            permissions: [...(role.permissions ?? [])],
          });
        }
        markDraft(next);
        setRoleSourcesOpen(false);
        setRoleNotice(
          `已加入 ${added} 个角色${skipped === 0 ? "" : `，跳过 ${skipped} 个重复角色`}，确认后生效`,
        );
      };

      const confirmRoleDraft = async (acknowledgeMemberLoss = false) => {
        if (selectedProject === null || detail === null || roleDraft === null) {
          return;
        }
        setBusy("role-confirm");
        try {
          const result = await request("/api/collab/projects/roles/confirm", {
            method: "POST",
            body: JSON.stringify({
              workspaceId: selectedProject.workspaceId,
              expectedRevision:
                roleDraftRevision ?? detail.project?.rolesRevision ?? 1,
              roles: roleDraft.map((role) => ({
                id: role.id,
                name: role.name,
                code: role.code,
                category: role.category,
                description: role.description ?? "",
                permissions: role.permissions,
              })),
              ackMemberLoss: acknowledgeMemberLoss,
            }),
          });
          const diff = result.diff ?? {};
          setRoleNotice(
            [
              `角色已生效（v${result.revision}）`,
              diff.added?.length ? `新增 ${diff.added.length}` : "",
              diff.updated?.length ? `修改 ${diff.updated.length}` : "",
              diff.removed?.length ? `移除 ${diff.removed.length}` : "",
              result.tasksNeedingReassignment
                ? `${result.tasksNeedingReassignment} 个任务需改派`
                : "",
              result.warning ?? "",
            ]
              .filter(Boolean)
              .join(" · "),
          );
          resetRoleDraft();
          await refreshDetail();
        } catch (cause) {
          if (cause.code === "member_impact") {
            setMemberImpact(cause.details ?? null);
            return;
          }
          if (cause.code === "workflow_template_blocked") {
            setWorkflowBlock(cause.details?.templates ?? []);
            return;
          }
          if (cause.code === "revision_conflict") {
            fail(new Error("项目角色已被其他人更新，请刷新后重新编辑"));
            return;
          }
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const requestSelectProject = (projectId) => {
        if (settingsDraftDirty) {
          setDraftGuard({ kind: "switch", projectId });
          return;
        }
        setSelectedId(projectId);
        setMemberManageMode(false);
        setHistory([]);
        setView("detail");
      };

      const resolveDraftGuard = (discard) => {
        const guard = draftGuard;
        setDraftGuard(null);
        if (!discard || guard === null) return;
        setRoleDraft(null);
        setRoleDraftRevision(null);
        setBusinessChainDraft(null);
        setBusinessChainValidation(null);
        setMemberImpact(null);
        setWorkflowBlock(null);
        if (guard.kind === "switch") {
          setSelectedId(guard.projectId);
          setMemberManageMode(false);
          setMemberView("members");
          setExpandedEmptyRoles(new Set());
          setDraggedMember(null);
          setDropRoleId("");
          setHistory([]);
          setView("detail");
        } else if (guard.kind === "edit-close") {
          setEditOpen(false);
        } else if (guard.kind === "edit-tab") {
          setEditTab(guard.tab);
          setBusinessChainDraft(null);
          setBusinessChainValidation(null);
        } else if (guard.kind === "template") {
          applyTemplateToDraft(guard.templateId);
        }
      };

      const requestEditTab = (nextTab) => {
        if (nextTab === editTab) return;
        if (settingsDraftDirty) {
          setDraftGuard({ kind: "edit-tab", tab: nextTab });
          return;
        }
        setEditTab(nextTab);
      };

      const pickDirectory = async () => {
        const uiWorkspace = clientCtx?.get?.("uiWorkspace");
        if (uiWorkspace?.pickDirectory === undefined) {
          fail(new Error("当前环境不支持目录选择，请从左侧栏添加项目。"));
          return;
        }
        try {
          const path = await uiWorkspace.pickDirectory();
          if (typeof path === "string" && path !== "") {
            setCreateDraft((current) => ({
              ...current,
              path,
              name:
                current.name === ""
                  ? (path.split(/[\\/]/).filter(Boolean).pop() ?? "")
                  : current.name,
            }));
          }
        } catch (cause) {
          fail(cause);
        }
      };

      const submitCreate = async () => {
        if (createDraft.name.trim() === "") {
          fail(new Error("请填写项目名称"));
          return;
        }
        if (createDraft.path === "") {
          fail(new Error("请选择项目目录"));
          return;
        }
        setBusy("create");
        try {
          const result = await request("/api/collab/projects/create", {
            method: "POST",
            body: JSON.stringify({
              path: createDraft.path,
              name: createDraft.name.trim(),
              ...(createDraft.templateId === ""
                ? {}
                : { templateId: createDraft.templateId }),
            }),
          });
          setCreateOpen(false);
          setCreateDraft({ name: "", path: "", templateId: "" });
          await loadProjects();
          if (typeof result.workspaceId === "string") {
            setSelectedId(result.workspaceId);
          }
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const generateReport = async (overrideReportType) => {
        if (selectedProject === null) return;
        setBusy("report");
        const refreshProgressData = async () => {
          const workflow =
            (detail?.workflows ?? []).find(
              (item) => item.id === progressWorkflowId,
            ) ?? preferredProgressWorkflow(detail?.workflows ?? []);
          await Promise.all([
            loadReports(selectedProject.workspaceId),
            loadProgressOverview(selectedProject.workspaceId),
            ...(workflow === undefined
              ? []
              : [
                  loadProgressWorkflow(
                    selectedProject.workspaceId,
                    workflow.id,
                  ),
                ]),
          ]);
        };
        try {
          await request("/api/collab/projects/reports/generate", {
            method: "POST",
            timeoutMs: 120_000,
            body: JSON.stringify({
              workspaceId: selectedProject.workspaceId,
              reportType: overrideReportType ?? reportType,
              triggerSource: "button",
            }),
          });
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
        void refreshProgressData();
      };

      const openReportSchedule = () => {
        setReportScheduleDraft(
          normalizeReportSchedule(detail?.project?.reportSchedule),
        );
        setReportScheduleOpen(true);
      };

      const saveReportSchedule = async () => {
        if (selectedProject === null) return;
        setBusy("report-schedule");
        try {
          const result = await request(
            "/api/collab/projects/reports/schedule",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selectedProject.workspaceId,
                schedule: normalizeReportSchedule(reportScheduleDraft),
              }),
            },
          );
          const schedule = normalizeReportSchedule(
            result.reportSchedule ?? reportScheduleDraft,
          );
          setReportScheduleDraft(schedule);
          setDetail((current) =>
            current === null
              ? current
              : {
                  ...current,
                  project: {
                    ...current.project,
                    reportSchedule: schedule,
                  },
                },
          );
          setReportScheduleOpen(false);
          setReportNotice(
            `项目日报生成设置已保存：${reportScheduleSummary(schedule)}`,
          );
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const validateBusinessChainDraft = async () => {
        if (selectedProject === null || businessChainDraft === null) {
          return null;
        }
        setBusy("business-chain-validate");
        try {
          const result = await request(
            "/api/collab/projects/business-chain/validate",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selectedProject.workspaceId,
                definitionId: businessChainDraft.definitionId,
                nodeBindings: normalizeBusinessChainBindings(
                  businessChainDraft.nodeBindings,
                ),
              }),
            },
          );
          setBusinessChainValidationExpanded(false);
          setBusinessChainValidation(result);
          setBusinessChainNotice(
            result.blocking?.length
              ? `校验发现 ${result.blocking.length} 项阻断`
              : result.warnings?.length
                ? `校验通过，有 ${result.warnings.length} 项提醒`
                : "绑定校验通过",
          );
          return result;
        } catch (cause) {
          setBusinessChainNotice(
            cause instanceof Error ? cause.message : String(cause),
          );
          return null;
        } finally {
          setBusy("");
        }
      };

      const cancelBusinessChainSettings = () => {
        setBusinessChainValidation(null);
        setBusinessChainNotice("");
        setBusinessChainUploadedFileName("");
        setEditOpen(false);
      };

      const enableBusinessChain = async () => {
        if (
          selectedProject === null ||
          businessChainData === null ||
          businessChainDraft === null
        ) {
          return;
        }
        const definitionId = businessChainDraft.definitionId;
        let current = businessChainData.current;
        const needsBind =
          current === null || current.workflowDefinitionId !== definitionId;
        const validation = needsBind
          ? businessChainValidation?.digest === undefined
            ? await validateBusinessChainDraft()
            : businessChainValidation
          : businessChainValidation;
        if (
          needsBind &&
          (validation === null ||
            (validation?.blocking ?? []).length > 0 ||
            typeof validation?.digest !== "string")
        ) {
          return;
        }
        setBusinessChainNotice("");
        setBusy("business-chain-enable");
        try {
          let data = businessChainData;
          if (needsBind) {
            const result = await request(
              "/api/collab/projects/business-chain/bind",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId: selectedProject.workspaceId,
                  definitionId,
                  nodeBindings: normalizeBusinessChainBindings(
                    businessChainDraft.nodeBindings,
                  ),
                  revision: businessChainData.revision,
                  validationDigest: validation.digest,
                }),
              },
            );
            data = result.businessChain ?? data;
            current = data.current ?? null;
          }
          if (current !== null && current.workflowInstanceId === undefined) {
            const latestDetail = await request(
              `/api/collab/projects/detail?workspaceId=${encodeURIComponent(
                selectedProject.workspaceId,
              )}`,
            );
            const missingRoles = missingBusinessChainRoleMembers(
              data.nodes,
              latestDetail.roles ?? detail?.roles,
            );
            if (missingRoles.length > 0) {
              setBusinessChainData(data);
              setBusinessChainNotice(
                `业务链路配置已保存；以下角色暂未指定成员：${[
                  ...new Set(missingRoles.map((item) => item.roleName)),
                ].join("、")}。分配成员后可再次启用。`,
              );
              await Promise.all([
                loadBusinessChain(selectedProject.workspaceId),
                loadProgressOverview(selectedProject.workspaceId),
                refreshDetail(),
              ]);
              return;
            }
            const candidate = (data.candidates ?? []).find(
              (item) => item.definitionId === definitionId,
            );
            const started = await request(
              "/api/collab/workflow/instances/start",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId: selectedProject.workspaceId,
                  definitionId,
                  title: candidate?.name ?? current.name,
                  context: {
                    projectCode: selectedProject.code,
                    businessChainKey: current.chainKey ?? "",
                  },
                }),
              },
            );
            const attached = await request(
              "/api/collab/projects/business-chain/instance",
              {
                method: "POST",
                body: JSON.stringify({
                  workspaceId: selectedProject.workspaceId,
                  instanceId: started.instance.id,
                  revision: data.revision,
                }),
              },
            );
            data = attached.businessChain ?? data;
          }
          setBusinessChainData(data);
          setBusinessChainNotice("业务链路已启用");
          await Promise.all([
            loadBusinessChain(selectedProject.workspaceId),
            loadProgressOverview(selectedProject.workspaceId),
            refreshDetail(),
          ]);
          setEditOpen(false);
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : String(cause);
          const missingClaimNodes = [
            ...message.matchAll(/节点「([^」]+)」使用 claim/g),
          ].map((match) => match[1]);
          const claimNodesHaveMembers = missingClaimNodes.every((nodeName) => {
            const node = (businessChainData.nodes ?? []).find(
              (candidate) =>
                candidate.name === nodeName || candidate.nodeId === nodeName,
            );
            const roleCode = String(
              node?.executor?.roleCode ?? "",
            ).toUpperCase();
            const role = (detail?.roles ?? []).find(
              (candidate) =>
                String(candidate.code ?? "").toUpperCase() === roleCode,
            );
            return role !== undefined && Number(role.memberCount ?? 0) > 0;
          });
          setBusinessChainNotice(
            /PROJECT_OWNER.*不存在/.test(message)
              ? "当前项目仍绑定旧版业务链路，请重新上传最新业务链路配置后再启用。"
              : /候选池成员/.test(message)
                ? claimNodesHaveMembers
                  ? "节点对应角色已有成员，但当前运行中的工作流服务尚未加载 AI 伙伴 Claim 支持。请重启服务后再次启用。"
                  : `以下节点的负责角色暂无候选成员：${[
                      ...new Set(missingClaimNodes),
                    ].join("、")}。请先在「项目角色」中为对应角色指派成员。`
                : message,
          );
        } finally {
          setBusy("");
        }
      };

      const templateDraftFrom = (template) => ({
        id: template?.id ?? "",
        name: template?.name ?? "",
        code: template?.code ?? "",
        type: template?.type ?? "",
        status: template?.status ?? "启用",
        description: template?.description ?? "",
        roleIds: [...(template?.roleIds ?? [])],
        workflowTemplateIds: [...(template?.workflowTemplateIds ?? [])],
        businessChainMode: template?.businessChainMode ?? "none",
        allowedBusinessChainTemplateIds: [
          ...(template?.allowedBusinessChainTemplateIds ?? []),
        ],
        defaultBusinessChainTemplateId:
          template?.defaultBusinessChainTemplateId ?? "",
        versionPolicy: template?.versionPolicy ?? "pin-at-project-create",
      });

      const catalogRoleDraftFrom = (role) => ({
        id: role?.id ?? "",
        name: role?.name ?? "",
        code: role?.code ?? "",
        category: role?.category ?? "执行",
        description: role?.description ?? "",
        permissions: [...(role?.permissions ?? ["read", "write"])],
      });

      /** 模版数据首次到达（或选中项被删除）时，补齐编辑草稿。 */
      react.useEffect(() => {
        if (templateData === null) return;
        if (templateDraft === null) {
          const first = (templateData.templates ?? [])[0];
          if (first !== undefined) setTemplateDraft(templateDraftFrom(first));
        }
        if (catalogRoleDraft === null) {
          const role = (templateData.roles ?? [])[0];
          if (role !== undefined) {
            setCatalogRoleDraft(catalogRoleDraftFrom(role));
          }
        }
      }, [templateData, templateDraft, catalogRoleDraft]);

      const openTemplateView = () => {
        setView(view === "templates" ? "detail" : "templates");
        if (view !== "templates" && templateData !== null) {
          const template = (templateData.templates ?? []).find(
            (item) => item.id === selectedTemplateId,
          );
          setTemplateDraft(templateDraftFrom(template));
          const role = (templateData.roles ?? []).find(
            (item) => item.id === selectedRoleId,
          );
          setCatalogRoleDraft(catalogRoleDraftFrom(role));
        }
      };

      const selectTemplate = (templateId) => {
        setSelectedTemplateId(templateId);
        const template = (templateData?.templates ?? []).find(
          (item) => item.id === templateId,
        );
        setTemplateDraft(templateDraftFrom(template));
        setTemplateTab("basics");
      };

      const selectRole = (roleId) => {
        setSelectedRoleId(roleId);
        const role = (templateData?.roles ?? []).find(
          (item) => item.id === roleId,
        );
        setCatalogRoleDraft(catalogRoleDraftFrom(role));
      };

      const saveTemplate = async (override) => {
        const draft = override ?? templateDraft;
        if (draft === null) return;
        setBusy("template");
        try {
          await request("/api/collab/projects/templates/save", {
            method: "POST",
            body: JSON.stringify({
              id: draft.id,
              name: draft.name,
              code: draft.code,
              type: draft.type,
              status: draft.status,
              description: draft.description,
              roleIds: draft.roleIds,
              workflowTemplateIds: draft.workflowTemplateIds,
              businessChainMode: draft.businessChainMode ?? "none",
              allowedBusinessChainTemplateIds:
                draft.allowedBusinessChainTemplateIds ?? [],
              defaultBusinessChainTemplateId:
                draft.defaultBusinessChainTemplateId ?? "",
              versionPolicy: draft.versionPolicy ?? "pin-at-project-create",
            }),
          });
          await loadTemplates();
          setTemplateDraft(draft);
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const uploadBusinessChainConfig = async (file) => {
        if (file === undefined || templateDraft === null) return;
        setBusy("business-chain-upload");
        try {
          const content = await file.text();
          const sourceMd = file.name.toLowerCase().endsWith(".json")
            ? businessChainConfigToMarkdown(content)
            : content;
          const result = await request(
            "/api/collab/workflow/definitions/import",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: "platform",
                sourceMd,
                scope: "platform",
                activate: true,
              }),
            },
          );
          const businessChainTemplateId =
            result.definition?.businessChain?.templateId ??
            result.definition?.id;
          const allowed = [
            ...new Set([
              ...(templateDraft.allowedBusinessChainTemplateIds ?? []),
              businessChainTemplateId,
            ]),
          ];
          const next = {
            ...templateDraft,
            businessChainMode:
              templateDraft.businessChainMode === "none"
                ? "optional"
                : templateDraft.businessChainMode,
            allowedBusinessChainTemplateIds: allowed,
            defaultBusinessChainTemplateId:
              templateDraft.defaultBusinessChainTemplateId ||
              businessChainTemplateId,
          };
          setTemplateDraft(next);
          await saveTemplate(next);
          await loadTemplates();
          setRoleNotice(
            `已导入业务链路「${
              result.definition?.businessChain?.displayName ??
              result.definition?.name ??
              ""
            }」并加入当前模版候选`,
          );
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
          if (businessChainFileRef.current !== null) {
            businessChainFileRef.current.value = "";
          }
        }
      };

      const uploadProjectBusinessChain = async (file) => {
        if (file === undefined || selectedProject === null || !canManage) {
          return;
        }
        setBusy("business-chain-upload");
        setBusinessChainNotice(`正在导入「${file.name}」…`);
        try {
          if (
            !file.name.toLowerCase().endsWith(".md") &&
            !file.name.toLowerCase().endsWith(".json")
          ) {
            throw new Error("仅支持 .md 或 .json 业务链路配置文件");
          }
          const content = await file.text();
          const sourceMd = file.name.toLowerCase().endsWith(".json")
            ? businessChainConfigToMarkdown(content)
            : content;
          const imported = await request(
            "/api/collab/workflow/definitions/import",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selectedProject.workspaceId,
                sourceMd,
                scope: "project",
                activate: true,
              }),
            },
          );
          const definition = imported.definition;
          const nodeBindings = (definition?.graph?.nodes ?? []).map((node) => ({
            nodeId: node.id,
            externalRefs: [...(node.businessChain?.externalRefs ?? [])],
          }));
          const revision =
            businessChainData?.revision ??
            selectedProject.businessChainRevision ??
            1;
          const result = await request(
            "/api/collab/projects/business-chain/custom",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selectedProject.workspaceId,
                definitionId: definition.id,
                nodeBindings,
                revision,
              }),
            },
          );
          setBusinessChainData(result.businessChain ?? null);
          setBusinessChainDraft({
            definitionId: definition.id,
            nodeBindings: normalizeBusinessChainBindings(nodeBindings),
          });
          setBusinessChainUploadedFileName(file.name);
          setBusinessChainValidation(null);
          setBusinessChainNotice("");
          setBusinessChainPreviewNodeId(nodeBindings[0]?.nodeId ?? "");
          setBusinessChainPreviewZoom(1);
          await Promise.all([
            loadBusinessChain(selectedProject.workspaceId),
            loadProgressOverview(selectedProject.workspaceId),
          ]);
        } catch (cause) {
          setBusinessChainNotice(
            cause instanceof Error ? cause.message : String(cause),
          );
        } finally {
          setBusy("");
          if (businessChainFileRef.current !== null) {
            businessChainFileRef.current.value = "";
          }
        }
      };

      const saveRole = async () => {
        if (catalogRoleDraft === null) return;
        setBusy("role");
        try {
          await request("/api/collab/projects/roles/save", {
            method: "POST",
            body: JSON.stringify(catalogRoleDraft),
          });
          await loadTemplates();
          await loadDetail(selectedId, true);
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const removeRole = async () => {
        if (catalogRoleDraft === null) return;
        setBusy("role");
        try {
          await request("/api/collab/projects/roles/remove", {
            method: "POST",
            body: JSON.stringify({ id: catalogRoleDraft.id }),
          });
          setSelectedRoleId("");
          setCatalogRoleDraft(null);
          await loadTemplates();
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const removeTemplate = async () => {
        if (templateDraft === null) return;
        setBusy("template");
        try {
          await request("/api/collab/projects/templates/remove", {
            method: "POST",
            body: JSON.stringify({ id: templateDraft.id }),
          });
          setSelectedTemplateId("");
          setTemplateDraft(null);
          await loadTemplates();
        } catch (cause) {
          fail(cause);
        } finally {
          setBusy("");
        }
      };

      const duplicateTemplate = () => {
        if (templateDraft === null) return;
        const copy = {
          ...templateDraft,
          id: `${templateDraft.id}-copy-${Date.now().toString(36)}`,
          name: `${templateDraft.name}（副本）`,
          code: `${templateDraft.code}-COPY`,
        };
        setTemplateDraft(copy);
        void saveTemplate(copy);
      };

      const createTemplate = () => {
        const stamp = Date.now().toString(36);
        const draft = {
          id: `tpl-${stamp}`,
          name: "新建项目模版",
          code: `TPL-${stamp.toUpperCase()}`,
          type: "研发类",
          status: "启用",
          description: "",
          roleIds: [],
          workflowTemplateIds: [],
          businessChainMode: "none",
          allowedBusinessChainTemplateIds: [],
          defaultBusinessChainTemplateId: "",
          versionPolicy: "pin-at-project-create",
        };
        setTemplateDraft(draft);
        setSelectedTemplateId(draft.id);
        setTemplateTab("basics");
        void saveTemplate(draft);
      };

      const openProjectTemplateSave = () => {
        if (selectedProject === null) return;
        setProjectTemplateSaveError("");
        setProjectTemplateSaveNotice("");
        if (settingsDraftDirty) {
          setProjectTemplateSaveNotice(
            "请先确认当前角色和业务链路草稿，再保存为项目模版。",
          );
          return;
        }
        if (effectiveRoles.length === 0) {
          setProjectTemplateSaveNotice(
            "当前项目还没有可保存的自定义项目角色。",
          );
          return;
        }
        const sourceTemplate = (detail?.templates ?? []).find(
          (template) => template.id === detail?.project?.templateId,
        );
        setProjectTemplateSaveDraft({
          name: "",
          type: sourceTemplate?.type ?? "",
        });
        setProjectTemplateSaveOpen(true);
      };

      const saveProjectAsTemplate = async () => {
        if (
          selectedProject === null ||
          projectTemplateSaveDraft.name.trim() === "" ||
          projectTemplateSaveDraft.type.trim() === ""
        ) {
          return;
        }
        setBusy("template-save");
        setProjectTemplateSaveError("");
        try {
          const result = await request(
            "/api/collab/projects/templates/from-project",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selectedProject.workspaceId,
                name: projectTemplateSaveDraft.name.trim(),
                type: projectTemplateSaveDraft.type.trim(),
              }),
            },
          );
          setProjectTemplateSaveOpen(false);
          setProjectTemplateSaveDraft({ name: "", type: "" });
          setProjectTemplateSaveNotice(
            `已保存项目模版「${result.template?.name ?? ""}」。其他项目可从「从模版加载」中复用。`,
          );
          await loadTemplates();
          await loadDetail(selectedProject.workspaceId, true);
        } catch (cause) {
          setProjectTemplateSaveError(
            cause instanceof Error ? cause.message : String(cause),
          );
        } finally {
          setBusy("");
        }
      };

      const createRole = () => {
        const stamp = Date.now().toString(36);
        const draft = {
          id: `role-${stamp}`,
          name: "新建项目角色",
          code: `ROLE_${stamp.toUpperCase()}`,
          category: "执行",
          description: "",
          permissions: ["read", "write"],
        };
        setCatalogRoleDraft(draft);
        setSelectedRoleId(draft.id);
        void (async () => {
          setBusy("role");
          try {
            await request("/api/collab/projects/roles/save", {
              method: "POST",
              body: JSON.stringify(draft),
            });
            await loadTemplates();
          } catch (cause) {
            fail(cause);
          } finally {
            setBusy("");
          }
        })();
      };

      // ------------------------------------------------------------ rendering

      const renderError = () =>
        error === ""
          ? null
          : h(
              "div",
              { className: "pmproj-error" },
              h("span", null, error),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setError(""),
                },
                "关闭",
              ),
            );

      const renderProjectList = () =>
        h(
          "aside",
          {
            className: `pmproj-directory${
              directoryCollapsed ? " collapsed" : ""
            }`,
            "aria-label": "项目清单",
          },
          h(
            "div",
            { className: "pmproj-directory-head" },
            h(
              "div",
              { className: "pmproj-directory-heading" },
              h("span", { className: "pmproj-directory-label" }, "项目列表"),
              h(
                "span",
                { className: "pmproj-directory-count" },
                visibleProjects.length,
              ),
            ),
            h(
              "button",
              {
                className: "pmproj-directory-toggle",
                type: "button",
                "aria-expanded": directoryCollapsed ? "false" : "true",
                "aria-label": directoryCollapsed
                  ? "展开项目列表"
                  : "折叠项目列表",
                title: directoryCollapsed ? "展开项目列表" : "折叠项目列表",
                onClick: () => setDirectoryCollapsed((current) => !current),
              },
              PanelToggleIcon({ collapsed: directoryCollapsed }),
            ),
          ),
          h(
            "label",
            { className: "pmproj-search" },
            SearchIcon(),
            h("input", {
              value: search,
              placeholder: "搜索项目",
              "aria-label": "搜索项目",
              onChange: (event) => setSearch(event.target.value),
            }),
          ),
          h(
            "div",
            { className: "pmproj-list" },
            visibleProjects.length === 0
              ? h("div", { className: "pmproj-empty" }, "没有匹配的项目。")
              : visibleProjects.map((project) =>
                  h(
                    "button",
                    {
                      key: project.workspaceId,
                      type: "button",
                      className: `pmproj-list-item ${
                        project.workspaceId === selectedProject?.workspaceId
                          ? "active"
                          : ""
                      }`.trim(),
                      onClick: () => requestSelectProject(project.workspaceId),
                    },
                    h(
                      "span",
                      { className: "pmproj-list-copy" },
                      h("strong", null, project.name),
                      h(
                        "small",
                        null,
                        `${project.code || "未编号"} · 负责人 ${
                          project.ownerName || "未指定"
                        }`,
                      ),
                    ),
                    h(
                      Pill,
                      { tone: statusTone(project.status) },
                      project.status,
                    ),
                  ),
                ),
          ),
        );

      const renderFacts = () => {
        if (selectedProject === null) return null;
        const counts = selectedProject.counts ?? {};
        const members = detail?.members ?? [];
        const humans =
          members.length === 0
            ? (counts.humans ?? 0)
            : members.filter((member) => member.kind === "human").length;
        const aiPartners =
          members.length === 0
            ? (counts.aiPartners ?? 0)
            : members.filter((member) => member.kind === "agent").length;
        const tasks = detail?.tasks ?? [];
        const openTasks = tasks.filter(
          (task) => task.status !== "done" && task.status !== "cancelled",
        );
        const today = new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Shanghai",
        });
        const overdueTasks = openTasks.filter(
          (task) =>
            task.due !== undefined && String(task.due).slice(0, 10) < today,
        );
        const workflows = detail?.workflows ?? [];
        const abnormalWorkflows = workflows.filter(
          (workflow) =>
            workflow.status === "blocked" || workflow.status === "failed",
        );
        return h(
          "div",
          { className: "pmproj-facts" },
          h(
            "div",
            { className: "pmproj-fact" },
            h("span", null, "项目成员"),
            h("strong", null, `${humans + aiPartners} 位`),
            h("small", null, `（真人 x${humans}，AI 伙伴 x${aiPartners}）`),
          ),
          h(
            "div",
            { className: "pmproj-fact" },
            h("span", null, "活跃任务"),
            h("strong", null, `${openTasks.length} 项`),
            h(
              "small",
              null,
              overdueTasks.length === 0
                ? "（无逾期）"
                : `（${overdueTasks.length} 项逾期）`,
            ),
          ),
          h(
            "div",
            { className: "pmproj-fact" },
            h("span", null, "关联工作流"),
            h("strong", null, `${workflows.length} 个`),
            h(
              "small",
              null,
              abnormalWorkflows.length === 0
                ? "（无异常）"
                : `（${abnormalWorkflows.length} 个异常）`,
            ),
          ),
        );
      };

      const renderWorkspaceInfo = () => {
        if (selectedProject === null) return null;
        return h(
          "div",
          { className: "pmproj-meta pmproj-workspace-meta" },
          h("span", null, "工作区："),
          h(
            "span",
            { className: "pmproj-workspace-value" },
            h(
              "code",
              { title: selectedProject.path || "未知" },
              compactWorkspacePath(selectedProject.path),
            ),
            h(
              "button",
              {
                className: "pmproj-copy-icon",
                type: "button",
                disabled: !selectedProject.path,
                title: "复制工作区路径",
                "aria-label": "复制工作区路径",
                onClick: () =>
                  void copyWorkspaceValue(selectedProject.path, "工作区路径"),
              },
              CopyIcon(),
            ),
          ),
          h(
            "span",
            { className: "pmproj-workspace-value" },
            h(
              "code",
              { title: selectedProject.workspaceId },
              selectedProject.workspaceId,
            ),
            h(
              "button",
              {
                className: "pmproj-copy-icon",
                type: "button",
                title: "复制工作区 ID",
                "aria-label": "复制工作区 ID",
                onClick: () =>
                  void copyWorkspaceValue(
                    selectedProject.workspaceId,
                    "工作区 ID",
                  ),
              },
              CopyIcon(),
            ),
          ),
        );
      };

      const renderMembersRoleAssignmentTab = () => {
        if (detail === null) return null;
        const members = detail.members ?? [];
        const roles = detail.roles ?? [];
        const roleGroups = groupMembersByProjectRole(roles, members);
        const renderMemberActions = (member) =>
          canManage && memberManageMode
            ? h(
                Fragment,
                null,
                h(
                  "button",
                  {
                    className: "pmproj-btn secondary small",
                    type: "button",
                    onClick: () => openMemberModal("edit", member),
                  },
                  "变更",
                ),
                h(
                  "button",
                  {
                    className: "pmproj-btn danger small",
                    type: "button",
                    disabled: busy === "member",
                    onClick: () =>
                      void removeMember(
                        member.kind,
                        member.principalId ?? member.id,
                      ),
                  },
                  "移除",
                ),
              )
            : canManage
              ? h(
                  "button",
                  {
                    className: "pmproj-btn secondary small",
                    type: "button",
                    onClick: () => openMemberModal("edit", member),
                  },
                  "管理",
                )
              : null;
        const updateMemberRolesLocally = (member, nextRoleIds) => {
          setDetail((current) => {
            if (current === null) return current;
            const roleNameById = new Map(
              (current.roles ?? []).map((role) => [role.id, role.name]),
            );
            const nextMembers = (current.members ?? []).map((candidate) => {
              if (
                candidate.kind !== member.kind ||
                (candidate.principalId ?? candidate.id) !==
                  (member.principalId ?? member.id)
              ) {
                return candidate;
              }
              return {
                ...candidate,
                roleIds: [...nextRoleIds],
                roleNames: nextRoleIds.map(
                  (roleId) => roleNameById.get(roleId) ?? roleId,
                ),
              };
            });
            return {
              ...current,
              members: nextMembers,
              roles: (current.roles ?? []).map((role) => ({
                ...role,
                memberCount: nextMembers.filter((candidate) =>
                  (candidate.roleIds ?? []).includes(role.id),
                ).length,
              })),
            };
          });
        };
        const persistMemberRoles = async (member, nextRoleIds) => {
          if (detail === null || selectedProject === null || !canManage) return;
          const currentRoleIds = member.roleIds ?? [];
          if (
            currentRoleIds.length === nextRoleIds.length &&
            currentRoleIds.every((roleId) => nextRoleIds.includes(roleId))
          ) {
            setDraggedMember(null);
            setDropRoleId("");
            return;
          }
          setBusy("member-role");
          updateMemberRolesLocally(member, nextRoleIds);
          try {
            await request("/api/collab/projects/members/save", {
              method: "POST",
              body: JSON.stringify({
                workspaceId: selectedProject.workspaceId,
                memberKind: member.kind,
                memberId: member.principalId ?? member.id,
                roleIds: nextRoleIds,
                ...(member.kind === "human"
                  ? { workspaceRole: member.workspaceRole ?? "member" }
                  : {}),
              }),
            });
          } catch (cause) {
            updateMemberRolesLocally(member, currentRoleIds);
            fail(cause);
          } finally {
            setBusy("");
            setDraggedMember(null);
            setDropRoleId("");
          }
        };
        const assignMemberToRole = async (role, member) => {
          const currentRoleIds = member.roleIds ?? [];
          if (currentRoleIds.includes(role.id)) {
            setDraggedMember(null);
            setDropRoleId("");
            return;
          }
          await persistMemberRoles(member, [...currentRoleIds, role.id]);
        };
        const removeMemberFromRole = async (role, member) => {
          setExpandedEmptyRoles((current) => {
            const next = new Set(current);
            next.add(role.id);
            return next;
          });
          await persistMemberRoles(
            member,
            (member.roleIds ?? []).filter((roleId) => roleId !== role.id),
          );
        };
        const handleRoleDragOver = (event, role) => {
          if (!canManage) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDropRoleId(role.id);
        };
        const handleRoleDrop = (event, role) => {
          event.preventDefault();
          if (!canManage) return;
          const [kind, ...idParts] = event.dataTransfer
            .getData("text/plain")
            .split(":");
          const member =
            draggedMember ??
            members.find(
              (candidate) =>
                candidate.kind === kind && candidate.id === idParts.join(":"),
            );
          if (member === undefined) return;
          void assignMemberToRole(role, member);
        };
        const renderMemberRoleCard = (member, options = {}) => {
          const memberRoleIds = member.roleIds ?? [];
          const roleNames = member.roleNames ?? [];
          const showRoles = options.showRoles !== false;
          const showCount = options.showCount !== false;
          const removeRole = options.removeRole;
          const canDrag = canManage && options.draggable !== false;
          return h(
            "article",
            {
              className: `pmproj-member-role-card${
                memberRoleIds.length === 0 ? " pending" : ""
              }${
                draggedMember?.kind === member.kind &&
                draggedMember?.id === member.id
                  ? " dragging"
                  : ""
              }${showRoles ? "" : " compact"}${
                showCount || removeRole !== undefined ? "" : " no-tools"
              }${canDrag ? "" : " no-drag"}`,
              key: `${member.kind}:${member.id}`,
              draggable: canDrag && busy !== "member-role",
              onDragStart: (event) => {
                if (!canDrag) {
                  event.preventDefault();
                  return;
                }
                setDraggedMember(member);
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(
                  "text/plain",
                  `${member.kind}:${member.id}`,
                );
              },
              onDragEnd: () => {
                setDraggedMember(null);
                setDropRoleId("");
              },
            },
            showCount || removeRole !== undefined
              ? h(
                  "div",
                  { className: "pmproj-member-card-tools" },
                  removeRole === undefined
                    ? null
                    : h(
                        "button",
                        {
                          className: "pmproj-role-remove",
                          type: "button",
                          disabled: busy === "member-role",
                          title: `从「${removeRole.name}」移除`,
                          "aria-label": `从「${removeRole.name}」移除`,
                          onClick: (event) => {
                            event.stopPropagation();
                            void removeMemberFromRole(removeRole, member);
                          },
                        },
                        CloseIcon(),
                      ),
                  showCount
                    ? h(
                        "span",
                        {
                          className: `pmproj-role-count${
                            memberRoleIds.length === 0 ? " empty" : ""
                          }`,
                          title: `已承担 ${memberRoleIds.length} 个项目角色`,
                        },
                        String(memberRoleIds.length),
                      )
                    : null,
                )
              : null,
            h(
              "div",
              { className: "pmproj-member" },
              h(MemberAvatar, { member }),
              h(
                "div",
                { className: "pmproj-member-copy" },
                h(
                  "div",
                  { className: "pmproj-member-name" },
                  h("strong", null, member.name),
                  isProjectOwner(member, selectedProject.ownerId)
                    ? h(
                        "span",
                        {
                          className: "pmproj-owner-tag",
                          title: "项目负责人",
                        },
                        "Owner",
                      )
                    : null,
                ),
                h(MemberSubtitle, { member }),
              ),
            ),
            showRoles
              ? h(
                  "div",
                  { className: "pmproj-member-card-roles" },
                  h("span", { className: "pmproj-label" }, "项目角色"),
                  roleNames.length === 0
                    ? h("span", { className: "pmproj-chip empty" }, "待指派")
                    : roleNames.map((roleName) =>
                        h(
                          "span",
                          { key: roleName, className: "pmproj-chip" },
                          roleName,
                        ),
                      ),
                )
              : null,
          );
        };
        return h(
          "div",
          { className: "pmproj-panel" },
          h(
            "div",
            { className: "pmproj-panel-head" },
            h(
              "div",
              { className: "pmproj-panel-title" },
              h("h3", null, "项目成员 · 角色管理"),
              h(
                "div",
                {
                  className: "pmproj-view-switch",
                  role: "group",
                  "aria-label": "成员权限视角",
                },
                h(
                  "button",
                  {
                    type: "button",
                    className: memberView === "members" ? "active" : "",
                    "aria-pressed": memberView === "members",
                    onClick: () => setMemberView("members"),
                  },
                  "项目成员",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: memberView === "roles" ? "active" : "",
                    "aria-pressed": memberView === "roles",
                    onClick: () => setMemberView("roles"),
                  },
                  "角色指派",
                ),
              ),
            ),
            h(
              "div",
              { className: "pmproj-head-actions" },
              h(
                "span",
                { className: "pmproj-count" },
                memberView === "roles"
                  ? `${roles.length} 个项目角色`
                  : `${members.length} 个成员`,
              ),
              canManage
                ? h(
                    "button",
                    {
                      className: "pmproj-btn secondary small",
                      type: "button",
                      onClick: () => setMemberManageMode((current) => !current),
                    },
                    memberManageMode ? "完成" : "管理成员",
                  )
                : null,
              canManage && memberManageMode
                ? h(
                    "button",
                    {
                      className: "pmproj-btn small",
                      type: "button",
                      onClick: () => openMemberModal("add", null),
                    },
                    "添加成员",
                  )
                : null,
            ),
          ),
          memberView === "members"
            ? members.length === 0
              ? h("div", { className: "pmproj-empty" }, "当前项目还没有成员。")
              : h(
                  "div",
                  { className: "pmproj-member-card-grid" },
                  members.map((member) =>
                    h(
                      "div",
                      { key: `${member.kind}:${member.id}` },
                      renderMemberRoleCard(member),
                      canManage
                        ? h(
                            "div",
                            {
                              className: "pmproj-actions",
                              style: { marginTop: "6px" },
                            },
                            renderMemberActions(member),
                          )
                        : null,
                    ),
                  ),
                )
            : h(
                "div",
                {
                  className: "pmproj-role-view",
                  style: {
                    "--pmproj-member-pool-offset": `${memberPoolStickyHeight}px`,
                  },
                },
                h("div", {
                  ref: memberPoolSentinelRef,
                  className: "pmproj-member-pool-sentinel",
                  "aria-hidden": "true",
                }),
                h(
                  "section",
                  {
                    ref: memberPoolRef,
                    className: `pmproj-role-view-group pmproj-role-view-members${
                      memberPoolStuck ? " stuck" : ""
                    }`,
                  },
                  h(
                    "div",
                    { className: "pmproj-role-view-head" },
                    h(
                      "div",
                      { className: "pmproj-role-view-title" },
                      h("strong", null, "全部成员"),
                      h(
                        "span",
                        { className: "pmproj-count" },
                        `${members.length} 个成员`,
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmproj-role-view-scope" },
                      h("span", null, "拖拽成员卡片到角色槽位"),
                      h(
                        "button",
                        {
                          className: "pmproj-member-pool-toggle",
                          type: "button",
                          title: memberPoolCollapsed
                            ? "展开全部成员"
                            : "收起全部成员",
                          "aria-label": memberPoolCollapsed
                            ? "展开全部成员"
                            : "收起全部成员",
                          "aria-expanded": memberPoolCollapsed
                            ? "false"
                            : "true",
                          "aria-controls": "pmproj-all-members-grid",
                          onClick: () =>
                            setMemberPoolCollapsed((current) => !current),
                        },
                        ChevronDownIcon({
                          expanded: !memberPoolCollapsed,
                        }),
                      ),
                    ),
                  ),
                  memberPoolCollapsed
                    ? null
                    : h(
                        "div",
                        {
                          id: "pmproj-all-members-grid",
                          className: "pmproj-member-card-grid",
                        },
                        members.map((member) => renderMemberRoleCard(member)),
                      ),
                ),
                roleGroups.map(({ role, members: roleMembers }) => {
                  const isEmpty = roleMembers.length === 0;
                  const expanded = !isEmpty || expandedEmptyRoles.has(role.id);
                  const toggleEmptyRole = () => {
                    if (!isEmpty) return;
                    setExpandedEmptyRoles((current) => {
                      const next = new Set(current);
                      if (next.has(role.id)) next.delete(role.id);
                      else next.add(role.id);
                      return next;
                    });
                  };
                  return h(
                    "section",
                    {
                      key: role.id,
                      className: `pmproj-role-view-group${
                        isEmpty ? " empty" : ""
                      }${dropRoleId === role.id ? " drop-active" : ""}`,
                      onDragOver: (event) => handleRoleDragOver(event, role),
                      onDragLeave: (event) => {
                        if (event.currentTarget.contains(event.relatedTarget)) {
                          return;
                        }
                        setDropRoleId((current) =>
                          current === role.id ? "" : current,
                        );
                      },
                      onDrop: (event) => handleRoleDrop(event, role),
                    },
                    h(
                      isEmpty ? "button" : "div",
                      {
                        className: "pmproj-role-view-head",
                        ...(isEmpty
                          ? {
                              type: "button",
                              "aria-expanded": expanded,
                              "aria-controls": `project-role-${role.id}`,
                              onClick: toggleEmptyRole,
                            }
                          : {}),
                      },
                      h(
                        "div",
                        { className: "pmproj-role-view-title" },
                        h("strong", null, role.name),
                        role.system
                          ? h(Pill, { tone: "notice" }, "系统")
                          : null,
                        h(
                          "span",
                          { className: "pmproj-count" },
                          `${roleMembers.length} 个成员`,
                        ),
                      ),
                      h(
                        "div",
                        { className: "pmproj-role-view-scope" },
                        h("span", null, "授权范围"),
                        h("strong", null, permissionLabels(role.permissions)),
                        isEmpty
                          ? h(
                              "span",
                              { className: "pmproj-role-view-toggle" },
                              ChevronDownIcon({ expanded }),
                            )
                          : null,
                      ),
                    ),
                    !expanded
                      ? null
                      : isEmpty
                        ? h(
                            "div",
                            {
                              className: "pmproj-role-view-empty",
                              id: `project-role-${role.id}`,
                            },
                            "暂未分配人员或 AI伙伴",
                          )
                        : h(
                            "div",
                            { className: "pmproj-role-slot-members" },
                            roleMembers.map((member) =>
                              renderMemberRoleCard(member, {
                                showRoles: false,
                                showCount: false,
                                removeRole: role,
                                draggable: false,
                              }),
                            ),
                          ),
                  );
                }),
              ),
        );
      };

      const renderMembersTab = () => {
        if (detail === null) return null;
        if (memberView === "roles") {
          return renderMembersRoleAssignmentTab();
        }
        const members = detail.members ?? [];
        return h(
          "div",
          { className: "pmproj-panel" },
          h(
            "div",
            { className: "pmproj-panel-head" },
            h(
              "div",
              { className: "pmproj-panel-title" },
              h("h3", null, "成员权限"),
              h(
                "div",
                {
                  className: "pmproj-view-switch",
                  role: "group",
                  "aria-label": "成员权限视角",
                },
                h(
                  "button",
                  {
                    type: "button",
                    className: memberView === "members" ? "active" : "",
                    "aria-pressed": memberView === "members",
                    onClick: () => setMemberView("members"),
                  },
                  "项目成员",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: memberView === "roles" ? "active" : "",
                    "aria-pressed": memberView === "roles",
                    onClick: () => setMemberView("roles"),
                  },
                  "角色指派",
                ),
              ),
              h(
                "span",
                { className: "pmproj-count" },
                `${members.length} 个成员`,
              ),
            ),
            h(
              "div",
              { className: "pmproj-head-actions" },
              canManage
                ? h(
                    "button",
                    {
                      className: "pmproj-btn secondary small",
                      type: "button",
                      onClick: () => setMemberManageMode((current) => !current),
                    },
                    memberManageMode ? "完成" : "管理成员",
                  )
                : null,
              memberManageMode && canManage
                ? h(
                    "button",
                    {
                      className: "pmproj-btn small",
                      type: "button",
                      onClick: () => openMemberModal("add", null),
                    },
                    "添加成员",
                  )
                : null,
            ),
          ),
          members.length === 0
            ? h("div", { className: "pmproj-empty" }, "当前项目还没有成员。")
            : h(
                "div",
                { className: "pmproj-table" },
                members.map((member) =>
                  h(
                    "div",
                    {
                      className: "pmproj-row",
                      key: `${member.kind}:${member.id}`,
                    },
                    h(
                      "div",
                      { className: "pmproj-member" },
                      h(MemberAvatar, { member }),
                      h(
                        "div",
                        { className: "pmproj-member-copy" },
                        h(
                          "div",
                          { className: "pmproj-member-name" },
                          h("strong", null, member.name),
                          isProjectOwner(member, selectedProject.ownerId)
                            ? h(
                                "span",
                                {
                                  className: "pmproj-owner-tag",
                                  title: "项目负责人",
                                },
                                "Owner",
                              )
                            : null,
                        ),
                        h(MemberSubtitle, { member }),
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "项目角色"),
                      h(
                        "div",
                        { className: "pmproj-chips" },
                        (member.roleNames ?? []).length === 0
                          ? h(
                              "span",
                              { className: "pmproj-chip empty" },
                              "未分配",
                            )
                          : member.roleNames.map((roleName) =>
                              h(
                                "span",
                                { key: roleName, className: "pmproj-chip" },
                                roleName,
                              ),
                            ),
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "平台角色"),
                      h(
                        "span",
                        { className: "pmproj-value" },
                        member.platformRole,
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "授权范围"),
                      h("span", { className: "pmproj-value" }, member.scope),
                    ),
                    h(
                      "div",
                      { className: "pmproj-actions" },
                      canManage && memberManageMode
                        ? h(
                            Fragment,
                            null,
                            h(
                              "button",
                              {
                                className: "pmproj-btn secondary small",
                                type: "button",
                                onClick: () => openMemberModal("edit", member),
                              },
                              "变更",
                            ),
                            h(
                              "button",
                              {
                                className: "pmproj-btn danger small",
                                type: "button",
                                disabled: busy === "member",
                                onClick: () =>
                                  void removeMember(
                                    member.kind,
                                    member.principalId ?? member.id,
                                  ),
                              },
                              "移除",
                            ),
                          )
                        : canManage
                          ? h(
                              "button",
                              {
                                className: "pmproj-btn secondary small",
                                type: "button",
                                onClick: () => openMemberModal("edit", member),
                              },
                              "管理",
                            )
                          : null,
                    ),
                  ),
                ),
              ),
        );
      };

      const renderProjectRoleEditor = () =>
        h(
          "div",
          { className: "pmproj-section pmproj-role-editor" },
          h(
            "div",
            { className: "pmproj-panel-head" },
            h(
              "div",
              { className: "pmproj-panel-title" },
              h("h3", null, "项目角色清单"),
              h(
                "span",
                { className: "pmproj-count" },
                `${draftRoles.length} 个角色${roleDraftDirty ? "（草稿）" : ""}`,
              ),
            ),
            h(
              "div",
              { className: "pmproj-head-actions pmproj-role-actions" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: openTemplateLoad,
                },
                "从模版加载",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => void openRoleSources(),
                },
                "复用其他项目",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn small",
                  type: "button",
                  onClick: () => openRoleModal("add"),
                },
                "添加角色",
              ),
            ),
          ),
          h(
            "p",
            { className: "pmproj-hint" },
            "每个项目持有自己的一份项目角色定义。从模版加载或复用其他项目只写入草稿，确认后整组覆盖生效；已启动的工作流实例按启动时快照继续运行。",
          ),
          roleNotice !== ""
            ? h("div", { className: "pmproj-notice" }, roleNotice)
            : null,
          draftRoles.length === 0 &&
            roleDiff.removed.length === 0 &&
            systemRoles.length === 0
            ? h(
                "div",
                { className: "pmproj-empty" },
                "当前项目还没有项目角色。可以从模版加载、复用其他项目，或手动添加角色。",
              )
            : h(
                "div",
                { className: "pmproj-table" },
                draftRoles.map((role) => {
                  const added = roleDiff.added.some(
                    (item) => roleCodeKey(item) === roleCodeKey(role),
                  );
                  const updated = roleDiff.updated.some(
                    (item) => roleCodeKey(item) === roleCodeKey(role),
                  );
                  const effective = effectiveRoles.find(
                    (item) => roleCodeKey(item) === roleCodeKey(role),
                  );
                  return h(
                    "div",
                    {
                      className: `pmproj-role-row ${
                        added || updated ? "draft" : ""
                      }`.trim(),
                      key: `${role.id}:${role.code}`,
                    },
                    h(
                      "div",
                      { className: "pmproj-member-copy" },
                      h("strong", null, role.name),
                      h(
                        "small",
                        null,
                        `${role.code} · ${role.category || "未分类"}`,
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "授权范围"),
                      h(
                        "span",
                        { className: "pmproj-value" },
                        permissionLabels(role.permissions),
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "成员"),
                      h(
                        "span",
                        { className: "pmproj-value" },
                        added
                          ? "新增角色"
                          : `${effective?.memberCount ?? 0} 人`,
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmproj-actions" },
                      added
                        ? h(Pill, { tone: "notice" }, "新增")
                        : updated
                          ? h(Pill, { tone: "notice" }, "已修改")
                          : null,
                      h(
                        "button",
                        {
                          className: "pmproj-btn secondary small",
                          type: "button",
                          onClick: () => openRoleModal("edit", role),
                        },
                        "编辑",
                      ),
                      h(
                        "button",
                        {
                          className: "pmproj-btn danger small",
                          type: "button",
                          onClick: () => removeDraftRole(role),
                        },
                        "移除",
                      ),
                    ),
                  );
                }),
                roleDiff.removed.map((role) =>
                  h(
                    "div",
                    {
                      className: "pmproj-role-row removed",
                      key: `removed:${role.id}`,
                    },
                    h(
                      "div",
                      { className: "pmproj-member-copy" },
                      h("strong", null, role.name),
                      h(
                        "small",
                        null,
                        `${role.code} · ${role.category || "未分类"}`,
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "授权范围"),
                      h(
                        "span",
                        { className: "pmproj-value" },
                        permissionLabels(role.permissions),
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "成员"),
                      h(
                        "span",
                        { className: "pmproj-value" },
                        `${role.memberCount ?? 0} 人`,
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmproj-actions" },
                      h(Pill, { tone: "warn" }, "待移除"),
                      h(
                        "button",
                        {
                          className: "pmproj-btn secondary small",
                          type: "button",
                          onClick: () => restoreDraftRole(role),
                        },
                        "撤销移除",
                      ),
                    ),
                  ),
                ),
                systemRoles.map((role) =>
                  h(
                    "div",
                    { className: "pmproj-role-row", key: role.id },
                    h(
                      "div",
                      { className: "pmproj-member-copy" },
                      h("strong", null, role.name),
                      h("small", null, `${role.code} · 平台系统席位`),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "授权范围"),
                      h(
                        "span",
                        { className: "pmproj-value" },
                        permissionLabels(role.permissions),
                      ),
                    ),
                    h(
                      "div",
                      null,
                      h("span", { className: "pmproj-label" }, "成员"),
                      h(
                        "span",
                        { className: "pmproj-value" },
                        `${role.memberCount ?? 0} 人`,
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmproj-actions" },
                      h(Pill, null, "系统"),
                    ),
                  ),
                ),
              ),
        );

      const renderTasksTab = () => {
        if (detail === null || selectedProject === null) return null;
        const tasks = sortProjectTasks(detail.tasks ?? []);
        const openTaskCreate = () => {
          window.dispatchEvent(
            new CustomEvent("pluginmax:task-create-open", {
              detail: {
                workspaceId: selectedProject.workspaceId,
                preserveCurrentView: true,
                receiverType:
                  viewer?.id === undefined || viewer.id === ""
                    ? undefined
                    : "human",
                receiverId: viewer?.id,
                receiverName: viewer?.name,
              },
            }),
          );
        };
        return h(
          "div",
          { className: "pmproj-panel" },
          h(
            "div",
            { className: "pmproj-panel-head" },
            h("h3", null, "任务清单"),
            h(
              "div",
              { className: "pmproj-head-actions" },
              h("span", { className: "pmproj-count" }, `${tasks.length} 项`),
              h(
                "button",
                {
                  className: "pmproj-btn small",
                  type: "button",
                  onClick: openTaskCreate,
                },
                "新建任务",
              ),
            ),
          ),
          tasks.length === 0
            ? h("div", { className: "pmproj-empty" }, "当前项目没有活跃任务。")
            : h(
                "div",
                { className: "pmproj-items" },
                tasks.map((task) =>
                  h(
                    "article",
                    {
                      className: "pmproj-item",
                      key: task.id,
                      role: "button",
                      tabIndex: 0,
                      onClick: () =>
                        openTask(task.id, selectedProject.workspaceId),
                      onKeyDown: (event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        openTask(task.id, selectedProject.workspaceId);
                      },
                    },
                    h(
                      "div",
                      { className: "pmproj-item-main" },
                      h(
                        "div",
                        { className: "pmproj-item-title" },
                        h("span", { className: "id" }, task.id),
                        h("strong", null, task.title),
                      ),
                      h(
                        "div",
                        { className: "pmproj-item-meta" },
                        h(
                          Pill,
                          { tone: task.priority === "P1" ? "warn" : undefined },
                          priorityLabel(task.priority),
                        ),
                        h(
                          Pill,
                          { tone: statusTone(TASK_STATUS_LABEL[task.status]) },
                          TASK_STATUS_LABEL[task.status] ?? task.status,
                        ),
                        task.receiverState === "needs_reassignment"
                          ? h(Pill, { tone: "warn" }, "需改派")
                          : null,
                        h("span", null, selectedProject.name),
                        h(
                          "span",
                          null,
                          task.receiverName ||
                            (task.receiverType === "role"
                              ? "待认领（项目角色）"
                              : "待指派"),
                        ),
                        task.receiverState === "needs_reassignment"
                          ? h(
                              "span",
                              { title: task.reassignmentReason ?? "" },
                              task.reassignmentReason ??
                                `原角色：${task.previousReceiver?.name ?? "未知"}`,
                            )
                          : null,
                        h(
                          "span",
                          null,
                          `截止 ${task.due ? task.due.slice(5, 10) : "不限"}`,
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmproj-actions" },
                      h(
                        "button",
                        {
                          className: "pmproj-btn secondary small",
                          type: "button",
                          onClick: () =>
                            openTask(task.id, selectedProject.workspaceId),
                        },
                        "详情",
                      ),
                    ),
                  ),
                ),
              ),
        );
      };

      const renderWorkflowsTab = () => {
        if (detail === null || selectedProject === null) return null;
        const workflows = detail.workflows ?? [];
        return h(
          "div",
          { className: "pmproj-panel" },
          h(
            "div",
            { className: "pmproj-panel-head" },
            h("h3", null, "工作流"),
            h(
              "span",
              { className: "pmproj-count" },
              `${workflows.length} 个流程`,
            ),
          ),
          workflows.length === 0
            ? h(
                "div",
                { className: "pmproj-empty" },
                "当前项目没有关联工作流。",
              )
            : h(
                "div",
                { className: "pmproj-items" },
                workflows.map((workflow) =>
                  h(
                    "article",
                    { className: "pmproj-item", key: workflow.id },
                    h(
                      "div",
                      { className: "pmproj-item-main" },
                      h(
                        "div",
                        { className: "pmproj-item-title" },
                        h("span", { className: "id" }, workflow.definitionKey),
                        h("strong", null, workflow.title),
                      ),
                      h(
                        "div",
                        { className: "pmproj-item-meta" },
                        h(
                          Pill,
                          { tone: WORKFLOW_STATUS_TONE[workflow.status] },
                          WORKFLOW_STATUS_LABEL[workflow.status] ??
                            workflow.status,
                        ),
                        h("span", null, selectedProject.name),
                        h(
                          "span",
                          null,
                          `更新于 ${workflow.updatedAt.slice(0, 16).replace("T", " ")}`,
                        ),
                      ),
                    ),
                    h(
                      "div",
                      { className: "pmproj-actions" },
                      h(
                        "button",
                        {
                          className: "pmproj-btn secondary small",
                          type: "button",
                          onClick: () =>
                            openWorkflow(
                              workflow.id,
                              selectedProject.workspaceId,
                            ),
                        },
                        "查看流程",
                      ),
                    ),
                  ),
                ),
              ),
        );
      };

      const renderBusinessChainEditor = () => {
        const uploadControl = h(
          Fragment,
          null,
          h(
            "button",
            {
              className:
                "pmproj-btn pmproj-business-chain-upload pmproj-business-chain-toolbar-action",
              type: "button",
              disabled: busy === "business-chain-upload",
              onClick: () => businessChainFileRef.current?.click(),
            },
            busy === "business-chain-upload" ? "上传中…" : "上传",
          ),
          h("input", {
            ref: businessChainFileRef,
            className: "pmproj-business-chain-file-input",
            type: "file",
            accept: ".md,.json,text/markdown,application/json",
            disabled: busy === "business-chain-upload",
            style: { display: "none" },
            onChange: (event) =>
              void uploadProjectBusinessChain(event.target.files?.[0]),
          }),
        );
        if (businessChainLoading) {
          return h(
            "div",
            { className: "pmproj-loading" },
            "正在读取业务链路配置…",
          );
        }
        if (businessChainError !== "") {
          return h(
            "div",
            { className: "pmproj-progress-empty" },
            h("div", null, `业务链路加载失败：${businessChainError}`),
            h(
              "button",
              {
                className: "pmproj-btn secondary small",
                type: "button",
                onClick: () => void loadBusinessChain(selectedId),
              },
              "重试",
            ),
          );
        }
        if (businessChainData === null) {
          return h(
            "div",
            { className: "pmproj-empty" },
            "当前项目还没有业务链路。请先在项目模版中配置。",
          );
        }
        if (
          businessChainData.mode === "none" &&
          businessChainData.configured !== true
        ) {
          return h(
            Fragment,
            null,
            h(
              "div",
              { className: "pmproj-empty" },
              "当前项目模版未配置业务链路。可以上传项目级配置文件，或前往「项目模版 → 业务链路」完成配置。",
            ),
            h("div", { className: "pmproj-head-actions" }, uploadControl),
          );
        }
        const candidates = businessChainData.candidates ?? [];
        const draft = businessChainDraft;
        const selectedCandidate = candidates.find(
          (item) => item.definitionId === draft?.definitionId,
        );
        const current = businessChainData.current;
        const nodeDefinitions = new Map(
          (
            selectedCandidate?.nodes ??
            candidates.find(
              (item) => item.definitionId === current?.workflowDefinitionId,
            )?.nodes ??
            businessChainData.nodes ??
            []
          ).map((node) => [node.nodeId, node]),
        );
        const bindings = [
          ...(draft?.nodeBindings ??
            normalizeBusinessChainBindings(businessChainData.nodes)),
        ].sort(
          (left, right) =>
            (nodeDefinitions.get(left.nodeId)?.sequence ??
              Number.MAX_SAFE_INTEGER) -
              (nodeDefinitions.get(right.nodeId)?.sequence ??
                Number.MAX_SAFE_INTEGER) ||
            left.nodeId.localeCompare(right.nodeId),
        );
        const statusLabel = {
          fresh: "正常",
          stale: "延迟",
          error: "异常",
          missing: "未接入",
        };
        const previewNodes = bindings.map((binding) => {
          const node = nodeDefinitions.get(binding.nodeId) ?? {};
          return {
            ...node,
            ...binding,
            fields: node.fields ?? [],
          };
        });
        const effectivePreviewNodeId = previewNodes.some(
          (node) => node.nodeId === businessChainPreviewNodeId,
        )
          ? businessChainPreviewNodeId
          : (previewNodes[0]?.nodeId ?? "");
        const configName =
          current?.name ??
          selectedCandidate?.name ??
          candidates[0]?.name ??
          "未上传配置文件";
        const configVersion =
          current?.workflowDefinitionVersion ??
          selectedCandidate?.version ??
          candidates[0]?.version;
        const configLabel = `${
          configVersion === undefined
            ? configName
            : `${configName} · v${configVersion}`
        }${
          businessChainUploadedFileName === ""
            ? ""
            : `（${businessChainUploadedFileName}）`
        }`;
        const resetPreviewViewport = () => {
          setBusinessChainPreviewZoom(1);
          businessChainPreviewViewportRef.current?.scrollTo?.({
            left: 0,
            top: 0,
            behavior: "smooth",
          });
        };
        return h(
          Fragment,
          null,
          h(
            "div",
            { className: "pmproj-business-chain-toolbar" },
            h(
              "span",
              { className: "pmproj-business-chain-toolbar-label" },
              "上传配置：",
            ),
            h(
              "strong",
              { className: "pmproj-business-chain-toolbar-name" },
              configLabel,
            ),
            h(
              "div",
              { className: "pmproj-head-actions" },
              uploadControl,
              h(
                "button",
                {
                  className:
                    "pmproj-btn secondary pmproj-business-chain-toolbar-action",
                  type: "button",
                  disabled: busy === "business-chain-validate",
                  onClick: () => void validateBusinessChainDraft(),
                },
                "校验",
              ),
            ),
          ),
          h(
            "section",
            {
              className: `pmproj-progress-section pmproj-business-chain-preview${
                businessChainPreviewFullscreen ? " is-fullscreen" : ""
              }`,
              "aria-label": "项目业务链路配置预览",
            },
            h(
              "div",
              { className: "pmproj-progress-head" },
              h(
                "div",
                { className: "pmproj-progress-head-main" },
                h("h3", null, "业务链路图预览"),
                h(
                  "span",
                  { className: "pmproj-count" },
                  `${previewNodes.length} 个节点`,
                ),
              ),
              h(
                "div",
                { className: "pmproj-progress-actions" },
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    disabled: businessChainPreviewZoom <= PROGRESS_ZOOM_MIN,
                    "aria-label": "缩小业务链路预览",
                    title: "缩小",
                    onClick: () =>
                      setBusinessChainPreviewZoom((current) =>
                        nextProgressZoom(current, -1),
                      ),
                  },
                  ZoomOutIcon(),
                ),
                h(
                  "span",
                  { className: "pmproj-progress-zoom" },
                  `${Math.round(businessChainPreviewZoom * 100)}%`,
                ),
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    disabled: businessChainPreviewZoom >= PROGRESS_ZOOM_MAX,
                    "aria-label": "放大业务链路预览",
                    title: "放大",
                    onClick: () =>
                      setBusinessChainPreviewZoom((current) =>
                        nextProgressZoom(current, 1),
                      ),
                  },
                  ZoomInIcon(),
                ),
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    "aria-label": "复位业务链路预览",
                    title: "一键复位",
                    onClick: resetPreviewViewport,
                  },
                  ResetIcon(),
                ),
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    "aria-label": businessChainPreviewFullscreen
                      ? "退出全屏业务链路预览"
                      : "全屏展示业务链路预览",
                    title: businessChainPreviewFullscreen
                      ? "退出全屏"
                      : "全屏展示",
                    "aria-pressed": businessChainPreviewFullscreen
                      ? "true"
                      : "false",
                    onClick: () =>
                      setBusinessChainPreviewFullscreen((current) => !current),
                  },
                  FullscreenIcon({ exit: businessChainPreviewFullscreen }),
                ),
              ),
            ),
            previewNodes.length === 0
              ? h(
                  "div",
                  { className: "pmproj-progress-empty" },
                  "选择或上传业务链路后可预览节点图。",
                )
              : h(
                  Fragment,
                  null,
                  h(
                    "div",
                    {
                      className: "pmproj-flow-viewport",
                      ref: businessChainPreviewViewportRef,
                    },
                    h(
                      "div",
                      {
                        className: "pmproj-flow-stage",
                        style: { zoom: businessChainPreviewZoom },
                      },
                      h(
                        "div",
                        {
                          className: "pmproj-flow",
                          "aria-label": "业务链路配置节点图",
                        },
                        previewNodes.flatMap((node, index) => {
                          const parts = [];
                          if (index > 0) {
                            parts.push(
                              h("span", {
                                key: `preview-arrow-${node.nodeId}`,
                                className: "pmproj-flow-arrow",
                                "aria-hidden": "true",
                              }),
                            );
                          }
                          parts.push(
                            h(
                              "button",
                              {
                                key: node.nodeId,
                                type: "button",
                                className: `pmproj-flow-node tone-${
                                  node.nodeId === effectivePreviewNodeId
                                    ? "progress"
                                    : "neutral"
                                } ${
                                  node.nodeId === effectivePreviewNodeId
                                    ? "selected"
                                    : ""
                                }`.trim(),
                                "data-business-chain-preview-node": node.nodeId,
                                onClick: () =>
                                  setBusinessChainPreviewNodeId(node.nodeId),
                              },
                              h(
                                "span",
                                { className: "pmproj-flow-node-top" },
                                h(
                                  "span",
                                  { className: "pmproj-flow-node-heading" },
                                  h(
                                    "span",
                                    { className: "pmproj-flow-node-code" },
                                    String(node.sequence ?? index + 1),
                                  ),
                                  h(
                                    "span",
                                    { className: "pmproj-flow-node-title" },
                                    node.name ?? node.nodeId,
                                  ),
                                ),
                                h(Pill, { tone: "notice" }, "配置预览"),
                              ),
                              h(
                                "span",
                                { className: "pmproj-flow-node-owner" },
                                "负责 ",
                                h(
                                  "strong",
                                  null,
                                  node.executor?.label ?? "待解析",
                                ),
                              ),
                              (node.fields ?? []).length === 0
                                ? null
                                : h(
                                    "span",
                                    { className: "pmproj-flow-node-facts" },
                                    node.fields.map((field) =>
                                      h(
                                        "span",
                                        {
                                          className: "pmproj-flow-node-fact",
                                          key: field.key,
                                        },
                                        h("span", null, field.label),
                                        h("strong", null, "已配置"),
                                      ),
                                    ),
                                  ),
                              h(
                                "span",
                                { className: "pmproj-flow-node-exception" },
                                h("span", null, "异常"),
                                h("strong", null, "未执行"),
                              ),
                            ),
                          );
                          return parts;
                        }),
                      ),
                    ),
                  ),
                ),
          ),
          h(
            "div",
            { className: "pmproj-business-chain-source-row" },
            h(
              "span",
              { className: "pmproj-business-chain-source-label" },
              "数据源健康",
            ),
            h(
              "div",
              { className: "pmproj-source-health" },
              (businessChainData.sources ?? []).length === 0
                ? h(
                    "span",
                    { className: "pmproj-value" },
                    "当前节点未声明外部来源。",
                  )
                : businessChainData.sources.map((source) =>
                    h(
                      "span",
                      { key: source.system },
                      h("strong", null, source.system),
                      ` ${statusLabel[source.status] ?? source.status}`,
                    ),
                  ),
            ),
            h(
              "button",
              {
                className: "pmproj-btn secondary small",
                type: "button",
                disabled:
                  busy === "business-chain-source-probe" ||
                  businessChainLoading,
                onClick: () => void probeBusinessChainSources(),
              },
              busy === "business-chain-source-probe" ? "探测中…" : "链接探测",
            ),
          ),
          businessChainValidation === null
            ? null
            : h(
                "div",
                { className: "pmproj-section" },
                h(
                  "div",
                  { className: "pmproj-section-title" },
                  h(
                    "button",
                    {
                      className: "pmproj-progress-events-toggle",
                      type: "button",
                      "aria-expanded": businessChainValidationExpanded
                        ? "true"
                        : "false",
                      onClick: () =>
                        setBusinessChainValidationExpanded(
                          (current) => !current,
                        ),
                    },
                    h("span", null, "校验结果"),
                    h(
                      "span",
                      { className: "pmproj-count" },
                      `${
                        (businessChainValidation.blocking ?? []).length
                      } 阻断 · ${
                        (businessChainValidation.warnings ?? []).length
                      } 提醒`,
                    ),
                    ChevronDownIcon({
                      expanded: businessChainValidationExpanded,
                    }),
                  ),
                ),
                businessChainValidationExpanded
                  ? [
                      ...(businessChainValidation.blocking ?? []).map(
                        (item) => ({
                          tone: "warn",
                          text: item.message,
                        }),
                      ),
                      ...(businessChainValidation.warnings ?? []).map(
                        (item) => ({
                          tone: "notice",
                          text: item.message,
                        }),
                      ),
                      ...(businessChainValidation.passed ?? []).map((text) => ({
                        tone: "done",
                        text,
                      })),
                    ].map((item, index) =>
                      h(
                        "div",
                        { className: "pmproj-inline-form", key: index },
                        h(Pill, { tone: item.tone }, item.text),
                      ),
                    )
                  : [],
              ),
        );
      };

      const renderOutputsTab = () => {
        if (detail === null || selectedProject === null) return null;
        const visible = outputs.filter((item) =>
          outputMatches(item, outputSearch, outputType, outputFrom, outputTo),
        );
        const groups = groupOutputsByDay(visible);
        const loading =
          outputsLoading ||
          (outputsFor !== selectedProject.workspaceId && outputsError === "");
        return h(
          "div",
          { className: "pmproj-panel pmproj-outputs" },
          h(
            "div",
            { className: "pmproj-panel-head" },
            h(
              "div",
              { className: "pmproj-panel-title" },
              h("h3", null, "产出物"),
              h(
                "span",
                { className: "pmproj-count" },
                outputsFor === selectedProject.workspaceId
                  ? `${visible.length} / ${outputs.length} 项`
                  : "加载中",
              ),
            ),
            h(
              "button",
              {
                className: "pmproj-btn secondary small",
                type: "button",
                disabled: loading,
                onClick: () => void loadOutputs(selectedProject.workspaceId),
              },
              "刷新",
            ),
          ),
          h(
            "div",
            { className: "pmproj-output-toolbar" },
            h(
              "label",
              { className: "pmproj-output-search" },
              SearchIcon(),
              h("input", {
                value: outputSearch,
                placeholder: "搜索文档名称、工作流、节点或任务名称",
                "aria-label": "搜索产出物",
                onChange: (event) => setOutputSearch(event.target.value),
              }),
            ),
            h(
              "div",
              { className: "pmproj-output-range" },
              h("span", null, "时间"),
              h("input", {
                type: "date",
                value: outputFrom,
                "aria-label": "产出物开始日期",
                onChange: (event) => setOutputFrom(event.target.value),
              }),
              h("span", null, "至"),
              h("input", {
                type: "date",
                value: outputTo,
                "aria-label": "产出物结束日期",
                onChange: (event) => setOutputTo(event.target.value),
              }),
            ),
            h(
              "select",
              {
                value: outputType,
                "aria-label": "按文档类型筛选产出物",
                onChange: (event) => setOutputType(event.target.value),
              },
              h("option", { value: "all" }, "全部文档类型"),
              Object.entries(OUTPUT_TYPE_LABELS).map(([value, label]) =>
                h("option", { key: value, value }, label),
              ),
            ),
            outputSearch !== "" ||
              outputType !== "all" ||
              outputFrom !== "" ||
              outputTo !== ""
              ? h(
                  "button",
                  {
                    className: "pmproj-btn subtle",
                    type: "button",
                    onClick: () => {
                      setOutputSearch("");
                      setOutputType("all");
                      setOutputFrom("");
                      setOutputTo("");
                    },
                  },
                  "清除筛选",
                )
              : null,
          ),
          outputsError !== ""
            ? h(
                "div",
                { className: "pmproj-output-empty", role: "alert" },
                outputsError,
              )
            : loading
              ? h("div", { className: "pmproj-loading" }, "正在加载产出物…")
              : groups.length === 0
                ? h(
                    "div",
                    { className: "pmproj-output-empty" },
                    outputs.length === 0
                      ? "当前项目还没有产出物。"
                      : "没有匹配的产出物。",
                  )
                : h(
                    "div",
                    { className: "pmproj-output-timeline" },
                    groups.map((group) =>
                      h(
                        "section",
                        {
                          className: "pmproj-output-day",
                          key: group.date,
                        },
                        h(
                          "div",
                          { className: "pmproj-output-date" },
                          group.date,
                          h("small", null, `${group.items.length} 项`),
                        ),
                        h(
                          "div",
                          { className: "pmproj-output-list" },
                          group.items.map((item) =>
                            h(
                              "article",
                              {
                                className: "pmproj-output-item",
                                key: item.id,
                              },
                              h(
                                "div",
                                { className: "pmproj-output-main" },
                                h(
                                  "div",
                                  { className: "pmproj-output-title" },
                                  h("strong", { title: item.name }, item.name),
                                  h(
                                    Pill,
                                    { tone: item.contentRole },
                                    item.contentRole === "input"
                                      ? "输入"
                                      : "产出",
                                  ),
                                  h(
                                    Pill,
                                    null,
                                    OUTPUT_TYPE_LABELS[item.documentType] ??
                                      "其他",
                                  ),
                                ),
                                h(
                                  "div",
                                  { className: "pmproj-output-meta" },
                                  h("span", null, item.authorName || "未知"),
                                  h("span", null, "·"),
                                  h("span", null, formatFileSize(item.size)),
                                  h("span", null, "·"),
                                  h(
                                    "span",
                                    null,
                                    item.updatedAt
                                      .slice(0, 16)
                                      .replace("T", " "),
                                  ),
                                ),
                                h(
                                  "div",
                                  { className: "pmproj-output-links" },
                                  h(
                                    "button",
                                    {
                                      className: "pmproj-output-source",
                                      type: "button",
                                      title: "打开来源",
                                      onClick: () => {
                                        if (
                                          item.sourceKind === "task" &&
                                          item.taskId !== undefined
                                        ) {
                                          openTask(
                                            item.taskId,
                                            selectedProject.workspaceId,
                                          );
                                          return;
                                        }
                                        if (
                                          item.sourceKind === "meeting" &&
                                          item.meetingId !== undefined
                                        ) {
                                          openMeeting(
                                            item.meetingId,
                                            selectedProject.workspaceId,
                                            item.minuteVersionId === undefined
                                              ? undefined
                                              : "minutes",
                                          );
                                          return;
                                        }
                                        if (
                                          item.sourceKind === "data-agent" &&
                                          item.dataAgentConversationId !==
                                            undefined
                                        ) {
                                          openDataAgent(
                                            item.dataAgentConversationId,
                                            selectedProject.workspaceId,
                                          );
                                          return;
                                        }
                                        if (
                                          item.sourceKind === "workflow" &&
                                          item.workflowInstanceId !== undefined
                                        ) {
                                          openWorkflow(
                                            item.workflowInstanceId,
                                            selectedProject.workspaceId,
                                          );
                                        }
                                      },
                                    },
                                    `${outputSourceLabel(item.sourceKind)} · ${item.sourceName}`,
                                  ),
                                  item.workflowNodeName === undefined ||
                                    item.workflowInstanceId === undefined
                                    ? null
                                    : h(
                                        "button",
                                        {
                                          className: "pmproj-output-node",
                                          type: "button",
                                          title: "打开对应工作流节点",
                                          onClick: () =>
                                            openWorkflow(
                                              item.workflowInstanceId,
                                              selectedProject.workspaceId,
                                              item.workflowNodeId,
                                            ),
                                        },
                                        `节点 · ${item.workflowNodeName}`,
                                      ),
                                ),
                              ),
                              h(
                                "div",
                                { className: "pmproj-output-actions" },
                                h(
                                  "button",
                                  {
                                    className:
                                      "pmproj-btn secondary small pmproj-output-download",
                                    type: "button",
                                    onClick: () => void downloadOutput(item),
                                  },
                                  DownloadIcon(),
                                  "下载",
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
        );
      };

      const renderReportsTab = () => {
        const keywords = reportSearch
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        const visible = reports
          .filter((report) => {
            if ((report.reportType ?? "daily") !== reportType) return false;
            if (reportFrom !== "" && report.date < reportFrom) return false;
            if (reportTo !== "" && report.date > reportTo) return false;
            if (keywords.length === 0) return true;
            return keywords.every((keyword) =>
              `${report.date} ${report.content}`
                .toLowerCase()
                .includes(keyword),
            );
          })
          .sort((left, right) => right.date.localeCompare(left.date));
        const latest = visible[0] ?? null;
        const history = visible.slice(1);
        return h(
          "div",
          { className: "pmproj-panel" },
          h(
            "div",
            { className: "pmproj-report-tab-head" },
            h("h3", null, "项目日报"),
            h(
              "div",
              { className: "pmproj-report-filters" },
              h(
                "select",
                {
                  value: reportType,
                  "aria-label": "项目汇报类型",
                  onChange: (event) => setReportType(event.target.value),
                },
                h("option", { value: "daily" }, "项目日报"),
                h("option", { value: "weekly" }, "项目周报"),
                h("option", { value: "progress" }, "进度汇报"),
              ),
              h(
                "label",
                { className: "pmproj-report-dates" },
                h("input", {
                  type: "date",
                  value: reportFrom,
                  "aria-label": "项目日报开始日期",
                  onChange: (event) => setReportFrom(event.target.value),
                }),
                h("span", null, "至"),
                h("input", {
                  type: "date",
                  value: reportTo,
                  "aria-label": "项目日报结束日期",
                  onChange: (event) => setReportTo(event.target.value),
                }),
              ),
              h(
                "label",
                { className: "pmproj-report-search" },
                SearchIcon(),
                h("input", {
                  type: "search",
                  value: reportSearchDraft,
                  placeholder: "关键词",
                  "aria-label": "搜索项目日报",
                  onChange: (event) => setReportSearchDraft(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setReportSearch(reportSearchDraft);
                    }
                  },
                }),
              ),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setReportSearch(reportSearchDraft),
                },
                "搜索",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn small",
                  type: "button",
                  disabled: busy === "report" || !canManage,
                  title: canManage
                    ? `按当前类型生成${
                        REPORT_TYPE_LABELS[reportType] ?? "项目日报"
                      }`
                    : "仅项目负责人或平台管理员可以更新日报",
                  onClick: () => void generateReport(),
                },
                busy === "report" ? "更新中…" : "更新日报",
              ),
            ),
            h(
              "button",
              {
                className: "pmproj-btn secondary small pmproj-report-setup",
                type: "button",
                "aria-label": "项目日报生成设置",
                title: `项目日报生成设置 · ${reportScheduleSummary(
                  detail?.project?.reportSchedule ?? reportScheduleDraft,
                )}`,
                onClick: openReportSchedule,
              },
              SettingsIcon(),
            ),
          ),
          reportNotice === ""
            ? null
            : h(
                "div",
                {
                  className: "pmproj-notice",
                  role: "status",
                  "aria-live": "polite",
                },
                reportNotice,
              ),
          latest === null
            ? h("div", { className: "pmproj-empty" }, "没有匹配的项目日报。")
            : h(
                "div",
                { className: "pmproj-report" },
                h(
                  "div",
                  { className: "pmproj-report-head" },
                  h(
                    "div",
                    { className: "pmproj-report-title" },
                    h(
                      "h3",
                      null,
                      `${latest.date} ${
                        REPORT_TYPE_LABELS[latest.reportType ?? "daily"] ??
                        "项目日报"
                      }`,
                    ),
                    latest.generationMode === "agent"
                      ? h(
                          Pill,
                          {
                            tone: "done",
                            title: `资源市场 Skill ${latest.skillId ?? "skill-project-reporting"}`,
                          },
                          `PM Agent · Skill v${latest.skillVersion ?? "未知"}`,
                        )
                      : h(
                          Pill,
                          {
                            tone: "notice",
                            title:
                              latest.generationError ?? "未记录具体回退原因",
                          },
                          "模板回退",
                        ),
                  ),
                  h(
                    "small",
                    null,
                    `撰写人：${latest.generatedBy} · 撰写时间：${formatProjectUpdatedAt(
                      latest.generatedAt,
                      latest.date,
                    )}`,
                  ),
                ),
                h(Markdown, { content: latest.content }),
              ),
          h(
            "div",
            { className: "pmproj-section" },
            h(
              "div",
              { className: "pmproj-section-title" },
              h("span", null, "历史记录"),
              h("span", null, String(history.length)),
            ),
            history.length === 0
              ? h(
                  "div",
                  { className: "pmproj-empty" },
                  "没有更早的项目日报快照。",
                )
              : history.map((report) =>
                  h(
                    "div",
                    { className: "pmproj-report", key: report.date },
                    h(
                      "div",
                      { className: "pmproj-report-head" },
                      h(
                        "div",
                        { className: "pmproj-report-title" },
                        h(
                          "h3",
                          null,
                          `${report.date} ${
                            REPORT_TYPE_LABELS[report.reportType ?? "daily"] ??
                            "项目日报"
                          }`,
                        ),
                        report.generationMode === "agent"
                          ? h(
                              Pill,
                              {
                                tone: "done",
                                title: `资源市场 Skill ${
                                  report.skillId ?? "skill-project-reporting"
                                }`,
                              },
                              `PM Agent · Skill v${
                                report.skillVersion ?? "未知"
                              }`,
                            )
                          : h(
                              Pill,
                              {
                                tone: "notice",
                                title:
                                  report.generationError ??
                                  "未记录具体回退原因",
                              },
                              "模板回退",
                            ),
                      ),
                      h(
                        "small",
                        null,
                        `撰写人：${report.generatedBy} · 撰写时间：${formatProjectUpdatedAt(
                          report.generatedAt,
                          report.date,
                        )}`,
                      ),
                    ),
                    h(Markdown, { content: report.content }),
                  ),
                ),
          ),
        );
      };

      const renderHistoryTab = () => {
        if (detail === null || selectedProject === null) return null;
        const events = history.filter((event) =>
          auditMatches(event, historySearch, historyCategory),
        );
        return h(
          "div",
          { className: "pmproj-panel" },
          h(
            "div",
            { className: "pmproj-panel-head" },
            h(
              "div",
              { className: "pmproj-panel-title" },
              h("h3", null, "历史记录"),
              h("span", { className: "pmproj-count" }, `${events.length} 条`),
            ),
            h(
              "button",
              {
                className: "pmproj-btn secondary small",
                type: "button",
                disabled: historyLoading,
                onClick: () => void loadHistory(selectedProject.workspaceId),
              },
              historyLoading ? "刷新中…" : "刷新",
            ),
          ),
          h(
            "p",
            { className: "pmproj-hint" },
            "记录项目设置、成员权限、项目角色、关联模版和项目日报的变更；账号与权限中的项目成员操作也会合并展示。历史记录仅追加，不随当前配置覆盖。",
          ),
          h(
            "div",
            { className: "pmproj-toolbar" },
            h(
              "div",
              { className: "pmproj-search pmproj-history-search" },
              SearchIcon(),
              h("input", {
                value: historySearch,
                placeholder: "搜索操作人、对象或变更内容",
                "aria-label": "搜索历史记录",
                onChange: (event) => setHistorySearch(event.target.value),
              }),
            ),
          ),
          h(
            "div",
            {
              className: "pmproj-tabs",
              role: "tablist",
              "aria-label": "历史记录分类",
            },
            Object.entries(AUDIT_CATEGORY_LABELS).map(([key, label]) =>
              h(
                "button",
                {
                  key,
                  type: "button",
                  role: "tab",
                  "aria-selected": historyCategory === key ? "true" : "false",
                  className: `pmproj-tab ${
                    historyCategory === key ? "active" : ""
                  }`.trim(),
                  onClick: () => setHistoryCategory(key),
                },
                label,
              ),
            ),
          ),
          historyLoading && history.length === 0
            ? h("div", { className: "pmproj-loading" }, "正在加载历史记录…")
            : events.length === 0
              ? h(
                  "div",
                  { className: "pmproj-empty" },
                  history.length === 0
                    ? "当前项目还没有历史记录。"
                    : "没有匹配的历史记录。",
                )
              : h(
                  "div",
                  { className: "pmproj-history" },
                  events.map((event) =>
                    h(
                      "article",
                      {
                        className: `pmproj-history-event ${event.category}`,
                        key: event.id,
                      },
                      h("span", { className: "pmproj-history-dot" }),
                      h(
                        "div",
                        { className: "pmproj-history-body" },
                        h(
                          "div",
                          { className: "pmproj-history-head" },
                          h(
                            "div",
                            null,
                            h(
                              "div",
                              { className: "pmproj-history-title" },
                              h("strong", null, event.summary),
                              h(
                                Pill,
                                {
                                  tone:
                                    event.category === "member"
                                      ? "done"
                                      : undefined,
                                },
                                auditCategoryLabel(event.category),
                              ),
                              event.source === "identity"
                                ? h(Pill, { tone: "notice" }, "账号与权限")
                                : null,
                            ),
                            h(
                              "div",
                              { className: "pmproj-history-meta" },
                              h(
                                "span",
                                null,
                                `${event.actorName || event.actorId || "系统"}${
                                  event.actorRole
                                    ? ` · ${
                                        PLATFORM_ROLE_LABELS[event.actorRole] ??
                                        event.actorRole
                                      }`
                                    : ""
                                }`,
                              ),
                              h("span", null, "·"),
                              h(
                                "span",
                                null,
                                new Date(event.at).toLocaleString("zh-CN", {
                                  hour12: false,
                                }),
                              ),
                            ),
                          ),
                        ),
                        Object.keys(event.detail ?? {}).length === 0
                          ? null
                          : h(
                              "dl",
                              { className: "pmproj-history-detail" },
                              Object.entries(event.detail).flatMap(
                                ([key, value]) => [
                                  h("dt", { key: `${key}:label` }, key),
                                  h("dd", { key: `${key}:value` }, value),
                                ],
                              ),
                            ),
                      ),
                    ),
                  ),
                ),
        );
      };

      const renderProgressTab = () => {
        if (detail === null || selectedProject === null) return null;
        const workflows = detail.workflows ?? [];
        const selectedWorkflow =
          workflows.find((workflow) => workflow.id === progressWorkflowId) ??
          preferredProgressWorkflow(workflows);
        const serverOverview =
          progressOverview?.businessChain !== null &&
          progressOverview?.businessChain !== undefined
            ? progressOverview
            : null;
        const progressFacts = projectReportProgress(reports);
        const progressUpdatedAt =
          serverOverview?.keyProgress?.latestReportAt ??
          progressFacts.latest?.generatedAt ??
          serverOverview?.generatedAt ??
          "";
        const progressText =
          progressFacts.progress.length === 0
            ? "暂无"
            : progressFacts.progress.slice(0, 3).join("；");
        const attentionText =
          progressFacts.attention.length === 0
            ? "暂无"
            : progressFacts.attention.slice(0, 3).join("；");
        const keyProgress = h(
          "section",
          { className: "pmproj-key-progress" },
          h(
            "div",
            { className: "pmproj-key-progress-head" },
            h(
              "div",
              { className: "pmproj-key-progress-title" },
              h("h3", null, "项目关键进展"),
            ),
            h(
              "div",
              { className: "pmproj-key-progress-actions" },
              h(
                "span",
                {
                  className: "pmproj-key-progress-updated",
                  title: "关键进展更新时间",
                },
                `更新于 ${formatProjectUpdatedAt(
                  progressUpdatedAt,
                  progressFacts.latest?.date,
                )}`,
              ),
              h(
                "button",
                {
                  className: `pmproj-progress-tool${
                    busy === "report" ? " is-spinning" : ""
                  }`,
                  type: "button",
                  title:
                    busy === "report"
                      ? "正在重新生成项目关键进展"
                      : "重新生成项目关键进展",
                  "aria-label": "重新生成项目关键进展",
                  "aria-busy": busy === "report",
                  disabled: busy === "report",
                  onClick: () => void generateReport("progress"),
                },
                ResetIcon(),
              ),
            ),
          ),
          h(
            "div",
            { className: "pmproj-key-progress-body" },
            h(
              "div",
              { className: "pmproj-key-progress-row" },
              h("span", { className: "pmproj-key-progress-label" }, "关键进展"),
              h(
                "p",
                {
                  className: `pmproj-key-progress-copy${
                    progressFacts.latest === null ? " muted" : ""
                  }`,
                },
                reportsLoading ? "正在读取最新项目进展…" : progressText,
              ),
            ),
            h(
              "div",
              {
                className: "pmproj-key-progress-row attention",
              },
              h("span", { className: "pmproj-key-progress-label" }, "需要关注"),
              h(
                "p",
                {
                  className: `pmproj-key-progress-copy${
                    progressFacts.latest === null ? " muted" : ""
                  }`,
                },
                reportsLoading ? "正在读取最新项目进展…" : attentionText,
              ),
            ),
          ),
        );

        if (selectedWorkflow === undefined && serverOverview === null) {
          return h(
            "div",
            { className: "pmproj-progress-overview" },
            keyProgress,
            h(
              "div",
              { className: "pmproj-empty" },
              "当前项目还没有关联工作流。关联工作流后会在这里展示核心节点。",
            ),
          );
        }

        const loaded =
          serverOverview !== null ||
          (progressWorkflowDetail?.instance?.id === selectedWorkflow?.id &&
            progressWorkflowDetail?.instance?.workspaceId ===
              selectedProject.workspaceId);
        if (progressWorkflowError !== "" && !loaded) {
          return h(
            "div",
            { className: "pmproj-progress-overview" },
            keyProgress,
            h(
              "div",
              { className: "pmproj-progress-empty" },
              h("div", null, `工作流节点加载失败：${progressWorkflowError}`),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () =>
                    void loadProgressWorkflow(
                      selectedProject.workspaceId,
                      selectedWorkflow?.id ?? "",
                    ),
                },
                "重试",
              ),
            ),
          );
        }
        if (!loaded) {
          return h(
            "div",
            { className: "pmproj-progress-overview" },
            keyProgress,
            h(
              "div",
              { className: "pmproj-loading" },
              progressWorkflowLoading
                ? "正在加载核心节点…"
                : "准备加载核心节点…",
            ),
          );
        }

        const memberNames = {};
        for (const member of detail.members ?? []) {
          memberNames[member.id] = member.name;
          if (member.principalId !== undefined) {
            memberNames[member.principalId] = member.name;
          }
        }
        const overview = applyProjectRoleMembers(
          applyProgressDemoData(
            serverOverview ??
              buildProgressOverview({
                workflowDetail: progressWorkflowDetail,
                tasks: detail.tasks ?? [],
                memberNames,
              }),
            progressDemoDataConfig,
          ),
          detail.roles,
          detail.members,
        );
        if (overview.nodes.length === 0) {
          return h(
            "div",
            { className: "pmproj-progress-overview" },
            keyProgress,
            h(
              "div",
              { className: "pmproj-empty" },
              serverOverview === null
                ? "该工作流没有可展示的节点定义。"
                : `业务链路暂不可展示：${
                    serverOverview.coverage.sources?.[0]?.message ??
                    "来源缺失或定义不可用"
                  }`,
            ),
          );
        }
        const effectiveNodeId = overview.nodes.some(
          (node) => node.id === progressSelectedNodeId,
        )
          ? progressSelectedNodeId
          : "";
        const selection = resolveProgressSelection(
          overview,
          effectiveNodeId,
          progressSelectedAlertId,
        );
        const selectedNode = selection.node;
        const anomalousNodes = overview.nodes.filter(progressNodeIsAnomaly);
        const changeEventsExpanded =
          progressChangeEventsExpanded ?? overview.changeEvents.length > 0;
        const resetProgressView = () => {
          setProgressZoom(1);
          progressViewportRef.current?.scrollTo?.({
            left: 0,
            top: 0,
            behavior: "smooth",
          });
        };
        const selectNode = (nodeId) => {
          setProgressSelectedNodeId((current) =>
            current === nodeId ? "" : nodeId,
          );
          setProgressSelectedAlertId("");
        };
        const selectedAlert = selection.selectedAlert ?? null;
        const highlightedTaskIds = selection.highlightedTaskIds ?? [];
        const openAlertDetail = (alert) => {
          const taskId = alert.taskIds?.[0];
          if (taskId !== undefined) {
            openTask(taskId, selectedProject.workspaceId);
            return;
          }
          const instanceId = overview.instance?.id ?? selectedWorkflow?.id;
          if (instanceId !== undefined) {
            openWorkflow(instanceId, selectedProject.workspaceId, alert.nodeId);
          }
        };

        return h(
          "div",
          { className: "pmproj-progress-overview" },
          keyProgress,
          h(
            "section",
            {
              className: `pmproj-progress-section${
                progressFullscreen ? " is-fullscreen" : ""
              }`,
              "aria-label": "项目核心节点流程图",
            },
            h(
              "div",
              { className: "pmproj-progress-head" },
              h(
                "div",
                { className: "pmproj-progress-head-main" },
                h("h3", null, "核心节点"),
                h(
                  "span",
                  { className: "pmproj-count" },
                  `${overview.nodes.length} 个节点`,
                ),
                workflows.length > 1
                  ? h(
                      "select",
                      {
                        className: "pmproj-progress-workflow-picker",
                        value: selectedWorkflow?.id ?? progressWorkflowId,
                        "aria-label": "选择核心工作流",
                        onChange: (event) => {
                          setProgressWorkflowId(event.target.value);
                          setProgressWorkflowDetail(null);
                          setProgressWorkflowError("");
                          setProgressSelectedNodeId("");
                          setProgressSelectedAlertId("");
                          setProgressZoom(1);
                          setProgressFullscreen(false);
                        },
                      },
                      workflows.map((workflow) =>
                        h(
                          "option",
                          {
                            key: workflow.id,
                            value: workflow.id,
                          },
                          `${workflow.title} · ${
                            WORKFLOW_STATUS_LABEL[workflow.status] ??
                            workflow.status
                          }`,
                        ),
                      ),
                    )
                  : null,
              ),
              h(
                "div",
                { className: "pmproj-progress-actions" },
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    disabled: progressZoom <= PROGRESS_ZOOM_MIN,
                    "aria-label": "缩小节点图",
                    title: "缩小",
                    onClick: () =>
                      setProgressZoom((current) =>
                        nextProgressZoom(current, -1),
                      ),
                  },
                  ZoomOutIcon(),
                ),
                h(
                  "span",
                  { className: "pmproj-progress-zoom" },
                  `${Math.round(progressZoom * 100)}%`,
                ),
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    disabled: progressZoom >= PROGRESS_ZOOM_MAX,
                    "aria-label": "放大节点图",
                    title: "放大",
                    onClick: () =>
                      setProgressZoom((current) =>
                        nextProgressZoom(current, 1),
                      ),
                  },
                  ZoomInIcon(),
                ),
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    "aria-label": "复位节点图",
                    title: "一键复位",
                    onClick: resetProgressView,
                  },
                  ResetIcon(),
                ),
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    "aria-label": progressFullscreen
                      ? "退出全屏节点图"
                      : "全屏展示节点图",
                    title: progressFullscreen ? "退出全屏" : "全屏展示",
                    "aria-pressed": progressFullscreen ? "true" : "false",
                    onClick: () => setProgressFullscreen((current) => !current),
                  },
                  FullscreenIcon({ exit: progressFullscreen }),
                ),
              ),
            ),
            h(
              "div",
              { className: "pmproj-progress-toolbar" },
              h(
                "div",
                {
                  className: "pmproj-progress-legend",
                  "aria-label": "节点状态图例",
                },
                [
                  ["done", "已完成"],
                  ["running", "进行中"],
                  ["warning", "风险"],
                  ["danger", "阻塞"],
                  ["", "未开始"],
                ].map(([tone, label]) =>
                  h("span", { key: label }, h("i", { className: tone }), label),
                ),
              ),
              h(
                "div",
                { className: "pmproj-progress-actions" },
                anomalousNodes.length === 0
                  ? null
                  : h(
                      "span",
                      { className: "pmproj-progress-anomaly" },
                      `${anomalousNodes.length} 个异常节点`,
                    ),
                h(
                  "button",
                  {
                    className: "pmproj-progress-tool",
                    type: "button",
                    title: "上传演示数据配置",
                    "aria-label": "上传演示数据配置",
                    disabled: busy === "demo-data-upload",
                    onClick: () => demoDataFileRef.current?.click(),
                  },
                  DemoDataUploadIcon(),
                ),
                h("input", {
                  ref: demoDataFileRef,
                  className: "pmproj-demo-data-file-input",
                  type: "file",
                  accept: ".json,application/json",
                  style: { display: "none" },
                  onChange: (event) =>
                    void uploadProgressDemoData(event.target.files?.[0]),
                }),
              ),
            ),
            h(
              "div",
              {
                className: "pmproj-flow-viewport",
                ref: progressViewportRef,
              },
              h(
                "div",
                {
                  className: "pmproj-flow-stage",
                  style: { zoom: progressZoom },
                },
                h(
                  "div",
                  {
                    className: "pmproj-flow",
                    "aria-label": "项目核心节点流程",
                  },
                  overview.nodes.flatMap((node, index) => {
                    const parts = [];
                    const fields = node.fields ?? [];
                    const plannedFieldValue = fields.find(
                      (field) =>
                        field.label === "原计划" || field.label === "计划",
                    )?.value;
                    if (index > 0) {
                      parts.push(
                        h("span", {
                          key: `arrow-${node.id}`,
                          className: "pmproj-flow-arrow",
                          "aria-hidden": "true",
                        }),
                      );
                    }
                    parts.push(
                      h(
                        "button",
                        {
                          key: node.id,
                          type: "button",
                          className:
                            `pmproj-flow-node tone-${node.tone ?? "neutral"} ${
                              progressNodeIsAnomaly(node) ? "is-anomaly" : ""
                            } ${
                              node.id === effectiveNodeId ? "selected" : ""
                            }`.trim(),
                          "aria-pressed":
                            node.id === effectiveNodeId ? "true" : "false",
                          "data-workflow-id": overview.instance?.id ?? "",
                          "data-workflow-node-id": node.id,
                          "data-workspace-id": selectedProject.workspaceId,
                          onClick: () => selectNode(node.id),
                        },
                        h(
                          "span",
                          { className: "pmproj-flow-node-top" },
                          h(
                            "span",
                            { className: "pmproj-flow-node-heading" },
                            h(
                              "span",
                              { className: "pmproj-flow-node-code" },
                              node.code,
                            ),
                            h(
                              "span",
                              { className: "pmproj-flow-node-title" },
                              node.name,
                            ),
                          ),
                          h(Pill, { tone: node.tone }, node.statusLabel),
                        ),
                        h(
                          "span",
                          { className: "pmproj-flow-node-owner" },
                          "负责 ",
                          h("strong", null, node.owner),
                        ),
                        fields.length === 0
                          ? null
                          : h(
                              "span",
                              { className: "pmproj-flow-node-facts" },
                              fields.map((field) => {
                                const value =
                                  field.label === "变更后"
                                    ? progressRevisedText(
                                        plannedFieldValue,
                                        field.value,
                                      )
                                    : field.value;
                                return h(
                                  "span",
                                  {
                                    className: "pmproj-flow-node-fact",
                                    key: field.key,
                                  },
                                  h("span", null, field.label),
                                  h(
                                    "strong",
                                    {
                                      className:
                                        value === "--"
                                          ? "is-placeholder"
                                          : undefined,
                                    },
                                    value,
                                  ),
                                );
                              }),
                            ),
                        h(
                          "span",
                          { className: "pmproj-flow-node-exception" },
                          h("span", null, "异常"),
                          h("strong", null, node.exceptionText),
                        ),
                      ),
                    );
                    return parts;
                  }),
                ),
              ),
            ),
            h(
              "section",
              {
                className: `pmproj-progress-events${
                  changeEventsExpanded ? "" : " is-collapsed"
                }`,
              },
              h(
                "div",
                { className: "pmproj-progress-events-head" },
                h(
                  "button",
                  {
                    className: "pmproj-progress-events-toggle",
                    type: "button",
                    "aria-expanded": changeEventsExpanded ? "true" : "false",
                    onClick: () =>
                      setProgressChangeEventsExpanded(!changeEventsExpanded),
                  },
                  h("span", null, "关键变更与外部影响"),
                  h(
                    "span",
                    { className: "pmproj-count" },
                    `${overview.changeEvents.length} 条记录`,
                  ),
                  ChevronDownIcon({ expanded: changeEventsExpanded }),
                ),
              ),
              changeEventsExpanded
                ? overview.changeEvents.length === 0
                  ? h(
                      "div",
                      { className: "pmproj-progress-empty" },
                      "当前还没有订单变更、供给变更或外部影响记录。",
                    )
                  : h(
                      "div",
                      null,
                      overview.changeEvents.map((event) =>
                        h(
                          "div",
                          {
                            className: "pmproj-progress-event",
                            key: event.id,
                          },
                          h("time", { dateTime: event.at }, event.time),
                          h(
                            "span",
                            { className: "pmproj-progress-event-tag" },
                            `【${event.categoryLabel}】`,
                          ),
                          h(
                            "span",
                            { className: "pmproj-progress-event-copy" },
                            event.description,
                            h(
                              "span",
                              { className: "pmproj-progress-event-source" },
                              `（来自：${event.source}）`,
                            ),
                          ),
                        ),
                      ),
                    )
                : null,
            ),
            selectedNode === null
              ? null
              : h(
                  "section",
                  {
                    className: "pmproj-node-detail",
                    "aria-live": "polite",
                    "aria-label": `${selectedNode.name}关联 Alert 与任务`,
                  },
                  h(
                    "div",
                    { className: "pmproj-node-detail-head" },
                    h(
                      "div",
                      { className: "pmproj-node-detail-title" },
                      h(
                        "strong",
                        null,
                        `${selectedNode.code} · ${selectedNode.name}`,
                      ),
                      h(
                        "p",
                        null,
                        `负责 ${selectedNode.owner} · ${selectedNode.statusLabel}`,
                      ),
                    ),
                  ),
                  h(
                    "div",
                    { className: "pmproj-node-links" },
                    h(
                      "div",
                      { className: "pmproj-node-links-section" },
                      h(
                        "div",
                        { className: "pmproj-node-links-head" },
                        h("span", null, "关联 Alert"),
                        h(
                          "span",
                          { className: "pmproj-count" },
                          `${selection.alerts.length} 项`,
                        ),
                      ),
                      selection.alerts.length === 0
                        ? h(
                            "div",
                            { className: "pmproj-progress-empty" },
                            "该节点暂无未解决 Alert。",
                          )
                        : selection.alerts.map((alert) =>
                            h(
                              "article",
                              {
                                key: alert.id,
                                className: `pmproj-progress-alert ${
                                  selectedAlert?.id === alert.id ? "active" : ""
                                }`.trim(),
                                "aria-pressed":
                                  selectedAlert?.id === alert.id
                                    ? "true"
                                    : "false",
                                "data-alert-id": alert.id,
                                tabIndex: 0,
                                role: "group",
                                onClick: () =>
                                  setProgressSelectedAlertId((current) =>
                                    current === alert.id ? "" : alert.id,
                                  ),
                                onKeyDown: (event) => {
                                  if (
                                    event.key !== "Enter" &&
                                    event.key !== " "
                                  ) {
                                    return;
                                  }
                                  event.preventDefault();
                                  setProgressSelectedAlertId((current) =>
                                    current === alert.id ? "" : alert.id,
                                  );
                                },
                              },
                              h(
                                "div",
                                { className: "pmproj-progress-card-head" },
                                h(
                                  "div",
                                  { className: "pmproj-progress-card-copy" },
                                  h(
                                    "div",
                                    { className: "pmproj-progress-card-title" },
                                    h("strong", null, alert.title),
                                    h(
                                      "span",
                                      { className: "pmproj-progress-type" },
                                      alert.type,
                                    ),
                                  ),
                                ),
                                h(
                                  "div",
                                  {
                                    className: "pmproj-progress-card-actions",
                                  },
                                  h(ProgressFollowButton, {
                                    type: "brief",
                                    id: alert.id,
                                    label: ` Alert ${alert.title}`,
                                  }),
                                  h(
                                    "button",
                                    {
                                      className: "pmproj-btn secondary",
                                      type: "button",
                                      onClick: (event) => {
                                        event.stopPropagation();
                                        openAlertDetail(alert);
                                      },
                                    },
                                    "详情",
                                  ),
                                ),
                              ),
                              h(
                                "p",
                                {
                                  className: "pmproj-progress-card-description",
                                },
                                alert.description,
                              ),
                              h(
                                "div",
                                { className: "pmproj-progress-card-meta" },
                                h(
                                  "span",
                                  {
                                    className: "pmproj-progress-card-meta-main",
                                  },
                                  h("span", null, alert.id),
                                  h("span", null, "·"),
                                  h("span", null, `来源 ${alert.source}`),
                                  h("span", null, "·"),
                                  h("span", null, progressTimeLabel(alert.at)),
                                ),
                                h(
                                  "span",
                                  { className: "pmproj-progress-card-tags" },
                                  h(Pill, { tone: "warn" }, alert.severity),
                                  h(Pill, null, alert.stateLabel),
                                ),
                              ),
                              alert.taskIds.length === 0
                                ? null
                                : h(
                                    "div",
                                    { className: "pmproj-progress-linked" },
                                    h("span", null, "关联任务"),
                                    alert.taskIds.map((taskId) =>
                                      h(
                                        "button",
                                        {
                                          key: taskId,
                                          type: "button",
                                          className:
                                            "pmproj-progress-mini-chip",
                                          onClick: (event) => {
                                            event.stopPropagation();
                                            openTask(
                                              taskId,
                                              selectedProject.workspaceId,
                                            );
                                          },
                                        },
                                        taskId,
                                      ),
                                    ),
                                  ),
                            ),
                          ),
                    ),
                    h(
                      "div",
                      { className: "pmproj-node-links-section" },
                      h(
                        "div",
                        { className: "pmproj-node-links-head" },
                        h("span", null, "关联任务"),
                        h(
                          "span",
                          { className: "pmproj-count" },
                          `${selection.tasks.length} 项`,
                        ),
                      ),
                      selection.tasks.length === 0
                        ? h(
                            "div",
                            { className: "pmproj-progress-empty" },
                            "该节点暂无异常关联任务。",
                          )
                        : selection.tasks.map((task) =>
                            h(
                              "article",
                              {
                                key: task.id,
                                className: `pmproj-progress-task ${
                                  highlightedTaskIds.includes(task.id)
                                    ? "linked"
                                    : ""
                                }`.trim(),
                                "data-task-id": task.id,
                              },
                              h(
                                "div",
                                { className: "pmproj-progress-card-head" },
                                h(
                                  "div",
                                  { className: "pmproj-progress-card-copy" },
                                  h(
                                    "div",
                                    { className: "pmproj-progress-card-title" },
                                    h("strong", null, task.title),
                                  ),
                                  h(
                                    "div",
                                    { className: "pmproj-progress-task-id" },
                                    task.id,
                                  ),
                                ),
                                h(
                                  "div",
                                  {
                                    className: "pmproj-progress-card-actions",
                                  },
                                  h(ProgressFollowButton, {
                                    type: "task",
                                    id: task.id,
                                    label: `任务 ${task.id}`,
                                  }),
                                  h(
                                    "button",
                                    {
                                      className: "pmproj-btn secondary",
                                      type: "button",
                                      onClick: () =>
                                        openTask(
                                          task.id,
                                          selectedProject.workspaceId,
                                        ),
                                    },
                                    "详情",
                                  ),
                                ),
                              ),
                              task.description
                                ? h(
                                    "p",
                                    {
                                      className:
                                        "pmproj-progress-card-description",
                                    },
                                    task.description,
                                  )
                                : null,
                              h(
                                "div",
                                { className: "pmproj-progress-card-meta" },
                                h(
                                  "span",
                                  {
                                    className: "pmproj-progress-card-meta-main",
                                  },
                                  h(
                                    Pill,
                                    {
                                      tone:
                                        task.priority === "P1"
                                          ? "warn"
                                          : undefined,
                                    },
                                    priorityLabel(task.priority),
                                  ),
                                  h(
                                    "span",
                                    null,
                                    task.receiverName ||
                                      (task.receiverType === "role"
                                        ? "待认领（项目角色）"
                                        : "待指派"),
                                  ),
                                  h(
                                    Pill,
                                    {
                                      tone: statusTone(
                                        TASK_STATUS_LABEL[task.status],
                                      ),
                                    },
                                    TASK_STATUS_LABEL[task.status] ??
                                      task.status,
                                  ),
                                ),
                                h(
                                  "span",
                                  null,
                                  `截止 ${
                                    task.due
                                      ? String(task.due).slice(0, 10)
                                      : "不限"
                                  }`,
                                ),
                              ),
                            ),
                          ),
                    ),
                  ),
                ),
          ),
        );
      };

      const renderDetail = () => {
        if (selectedProject === null) {
          return h("div", { className: "pmproj-empty" }, "还没有项目。");
        }
        if (detailLoading && detail === null) {
          return h("div", { className: "pmproj-loading" }, "正在加载项目详情…");
        }
        const progressAnomalyCount = (progressOverview?.nodes ?? []).filter(
          progressNodeIsAnomaly,
        ).length;
        const tabs = [
          {
            key: "progress",
            label: "项目概览",
            count: progressAnomalyCount,
          },
          { key: "reports", label: "项目日报", count: reports.length },
          {
            key: "members",
            label: "成员·角色",
            count: (detail?.members ?? []).length,
          },
          {
            key: "tasks",
            label: "任务清单",
            count: (detail?.tasks ?? []).length,
          },
          {
            key: "workflows",
            label: "工作流",
            count: (detail?.workflows ?? []).length,
          },
          {
            key: "outputs",
            label: "产出物",
            count:
              outputsFor === selectedProject.workspaceId
                ? outputs.length
                : undefined,
          },
          ...(canManage
            ? [{ key: "history", label: "历史记录", count: history.length }]
            : []),
        ];
        const body =
          tab === "progress"
            ? renderProgressTab()
            : tab === "reports"
              ? renderReportsTab()
              : tab === "tasks"
                ? renderTasksTab()
                : tab === "workflows"
                  ? renderWorkflowsTab()
                  : tab === "outputs"
                    ? renderOutputsTab()
                    : tab === "history"
                      ? renderHistoryTab()
                      : renderMembersTab();
        const followedNow = followed.has(selectedProject.workspaceId);
        return h(
          Fragment,
          null,
          h(
            "div",
            { className: "pmproj-summary" },
            h(
              "div",
              { className: "pmproj-detail-head" },
              h(
                "div",
                null,
                h(
                  "div",
                  { className: "pmproj-title-line" },
                  h("h2", null, selectedProject.name),
                  h(
                    Pill,
                    { tone: statusTone(selectedProject.status) },
                    selectedProject.status,
                  ),
                ),
                h(
                  "div",
                  { className: "pmproj-meta" },
                  h("span", null, selectedProject.code || "未编号"),
                  h("span", null, "·"),
                  h(
                    "span",
                    null,
                    `负责人 ${selectedProject.ownerName || "未指定"}`,
                  ),
                  h("span", null, "·"),
                  h(
                    "span",
                    null,
                    `${selectedProject.startDate || "未设置"} 至 ${
                      selectedProject.targetDate || "未设置"
                    }`,
                  ),
                  h("span", null, "·"),
                  h("span", null, `进度 ${selectedProject.progress}%`),
                ),
                selectedProject.description
                  ? h(
                      "p",
                      { className: "pmproj-desc" },
                      selectedProject.description,
                    )
                  : null,
              ),
              h(
                "div",
                { className: "pmproj-head-actions" },
                h(
                  "button",
                  {
                    className: `pmproj-btn secondary small pmproj-follow-star ${
                      followedNow ? "active" : ""
                    }`.trim(),
                    type: "button",
                    "aria-pressed": followedNow ? "true" : "false",
                    "aria-label": followedNow ? "取消关注" : "关注",
                    title: followedNow ? "取消关注" : "关注",
                    onClick: () => void toggleFollow(),
                  },
                  StarIcon({ filled: followedNow }),
                ),
                canManage
                  ? h(
                      "button",
                      {
                        className: "pmproj-btn secondary small",
                        type: "button",
                        onClick: openEdit,
                      },
                      "项目设置",
                    )
                  : null,
                detail?.viewer?.workspaceRole
                  ? h(
                      "button",
                      {
                        className: "pmproj-btn subtle",
                        type: "button",
                        onClick: () => setLeaveOpen(true),
                      },
                      "退出项目",
                    )
                  : null,
              ),
            ),
            renderFacts(),
            renderWorkspaceInfo(),
          ),
          h(
            "div",
            {
              className: "pmproj-tabs",
              role: "tablist",
              "aria-label": "项目详情内容",
            },
            tabs.map((item) =>
              h(
                "button",
                {
                  key: item.key,
                  type: "button",
                  role: "tab",
                  "aria-selected": tab === item.key ? "true" : "false",
                  className:
                    `pmproj-tab ${tab === item.key ? "active" : ""}`.trim(),
                  onClick: () => {
                    setTab(item.key);
                    if (item.key !== "progress") {
                      setProgressFullscreen(false);
                    }
                    if (item.key !== "members") setMemberManageMode(false);
                  },
                },
                item.count === undefined
                  ? item.label
                  : `${item.label} ${item.count}`,
              ),
            ),
          ),
          body,
        );
      };

      const renderTemplateList = () => {
        const keyword = templateSearch.trim().toLowerCase();
        if (templatePane === "roles") {
          const roles = (templateData?.roles ?? []).filter(
            (role) =>
              keyword === "" ||
              `${role.name} ${role.code} ${role.category} ${role.description}`
                .toLowerCase()
                .includes(keyword),
          );
          return roles.length === 0
            ? h("div", { className: "pmproj-empty" }, "没有匹配的项目角色。")
            : roles.map((role) =>
                h(
                  "button",
                  {
                    key: role.id,
                    type: "button",
                    className: `pmproj-list-item ${
                      role.id === selectedRoleId ? "active" : ""
                    }`.trim(),
                    onClick: () => selectRole(role.id),
                  },
                  h(
                    "span",
                    { className: "pmproj-list-mark" },
                    initials(role.name),
                  ),
                  h(
                    "span",
                    { className: "pmproj-list-copy" },
                    h("strong", null, role.name),
                    h("small", null, `${role.code} · ${role.category}`),
                  ),
                  h(
                    "span",
                    { className: "pmproj-count" },
                    `${
                      (templateData?.templates ?? []).filter((template) =>
                        template.roleIds.includes(role.id),
                      ).length
                    } 模版`,
                  ),
                ),
              );
        }
        const templates = (templateData?.templates ?? []).filter(
          (template) =>
            keyword === "" ||
            `${template.name} ${template.code} ${template.type} ${template.description}`
              .toLowerCase()
              .includes(keyword),
        );
        return templates.length === 0
          ? h("div", { className: "pmproj-empty" }, "没有匹配的项目模版。")
          : templates.map((template) =>
              h(
                "button",
                {
                  key: template.id,
                  type: "button",
                  className: `pmproj-list-item ${
                    template.id === selectedTemplateId ? "active" : ""
                  }`.trim(),
                  onClick: () => selectTemplate(template.id),
                },
                h(
                  "span",
                  { className: "pmproj-list-mark" },
                  initials(template.name),
                ),
                h(
                  "span",
                  { className: "pmproj-list-copy" },
                  h("strong", null, template.name),
                  h("small", null, `${template.code} · ${template.type}`),
                ),
                h(
                  "span",
                  { className: "pmproj-count" },
                  `${template.roleIds.length} 角色`,
                ),
              ),
            );
      };

      const renderTemplateDetail = () => {
        if (templateData === null) {
          return h("div", { className: "pmproj-loading" }, "正在加载项目模版…");
        }
        if (templatePane === "roles") {
          if (catalogRoleDraft === null) {
            return h("div", { className: "pmproj-empty" }, "还没有项目角色。");
          }
          const usedBy = (templateData.templates ?? []).filter((template) =>
            template.roleIds.includes(catalogRoleDraft.id),
          );
          return h(
            Fragment,
            null,
            h(
              "div",
              { className: "pmproj-detail-head" },
              h(
                "div",
                null,
                h(
                  "div",
                  { className: "pmproj-title-line" },
                  h("h2", null, catalogRoleDraft.name || "项目角色"),
                  h(Pill, null, catalogRoleDraft.category),
                ),
                h(
                  "div",
                  { className: "pmproj-meta" },
                  h("span", null, catalogRoleDraft.code || "未设置标识"),
                  h("span", null, "·"),
                  h("span", null, `${usedBy.length} 个模版引用`),
                ),
                h(
                  "p",
                  { className: "pmproj-desc" },
                  catalogRoleDraft.description ||
                    "项目内用于任务指派与工作流流转的角色。",
                ),
              ),
            ),
            h(
              "div",
              { className: "pmproj-form-grid" },
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "角色名称"),
                h("input", {
                  value: catalogRoleDraft.name,
                  onChange: (event) =>
                    setCatalogRoleDraft({
                      ...catalogRoleDraft,
                      name: event.target.value,
                    }),
                }),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "角色标识"),
                h("input", {
                  value: catalogRoleDraft.code,
                  onChange: (event) =>
                    setCatalogRoleDraft({
                      ...catalogRoleDraft,
                      code: event.target.value,
                    }),
                }),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "角色分类"),
                h(
                  "select",
                  {
                    value: catalogRoleDraft.category,
                    onChange: (event) =>
                      setCatalogRoleDraft({
                        ...catalogRoleDraft,
                        category: event.target.value,
                      }),
                  },
                  ROLE_CATEGORIES.map((category) =>
                    h("option", { key: category, value: category }, category),
                  ),
                ),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "使用场景"),
                h("input", { value: "任务指派 · 工作流流转", disabled: true }),
              ),
              h(
                "div",
                { className: "pmproj-field wide" },
                h("span", { className: "label" }, "角色权限（授权范围的来源）"),
                h(
                  "div",
                  { className: "pmproj-checkboxes" },
                  PERMISSION_OPTIONS.map((option) =>
                    h(
                      "label",
                      { key: option.key, className: "pmproj-checkbox" },
                      h("input", {
                        type: "checkbox",
                        checked: catalogRoleDraft.permissions.includes(
                          option.key,
                        ),
                        onChange: (event) => {
                          const next = new Set(catalogRoleDraft.permissions);
                          if (event.target.checked) next.add(option.key);
                          else next.delete(option.key);
                          setCatalogRoleDraft({
                            ...catalogRoleDraft,
                            permissions: [...next],
                          });
                        },
                      }),
                      h("span", null, option.label),
                    ),
                  ),
                ),
              ),
              h(
                "label",
                { className: "pmproj-field wide" },
                h("span", { className: "label" }, "角色说明"),
                h("textarea", {
                  value: catalogRoleDraft.description,
                  onChange: (event) =>
                    setCatalogRoleDraft({
                      ...catalogRoleDraft,
                      description: event.target.value,
                    }),
                }),
              ),
              h(
                "div",
                { className: "pmproj-footer wide" },
                h(
                  "button",
                  {
                    className: "pmproj-btn danger",
                    type: "button",
                    disabled: busy === "role",
                    onClick: () => void removeRole(),
                  },
                  "删除角色",
                ),
                h(
                  "button",
                  {
                    className: "pmproj-btn",
                    type: "button",
                    disabled: busy === "role",
                    onClick: () => void saveRole(),
                  },
                  "保存角色",
                ),
              ),
            ),
            h(
              "div",
              { className: "pmproj-section" },
              h(
                "div",
                { className: "pmproj-section-title" },
                h("span", null, "引用该角色的项目模版"),
                h("span", null, String(usedBy.length)),
              ),
              usedBy.length === 0
                ? h(
                    "div",
                    { className: "pmproj-empty" },
                    "暂无模版引用该角色。",
                  )
                : usedBy.map((template) =>
                    h(
                      "div",
                      { className: "pmproj-item", key: template.id },
                      h(
                        "div",
                        { className: "pmproj-item-main" },
                        h(
                          "div",
                          { className: "pmproj-item-title" },
                          h("strong", null, template.name),
                        ),
                        h(
                          "div",
                          { className: "pmproj-item-meta" },
                          h(
                            "span",
                            null,
                            `${template.code} · ${template.type}`,
                          ),
                        ),
                      ),
                      h(Pill, null, "模版"),
                    ),
                  ),
            ),
          );
        }
        if (templateDraft === null) {
          return h(
            "div",
            { className: "pmproj-empty" },
            "没有可展示的项目模版。",
          );
        }
        const availableRoles = (templateData.roles ?? []).filter(
          (role) => !templateDraft.roleIds.includes(role.id),
        );
        const selectedRoles = templateDraft.roleIds
          .map((roleId) =>
            (templateData.roles ?? []).find((role) => role.id === roleId),
          )
          .filter(Boolean);
        const selectedWorkflows = templateDraft.workflowTemplateIds
          .map((id) =>
            (templateData.workflowTemplates ?? []).find(
              (item) => item.id === id,
            ),
          )
          .filter(Boolean);
        const availableWorkflows = (
          templateData.workflowTemplates ?? []
        ).filter(
          (item) => !templateDraft.workflowTemplateIds.includes(item.id),
        );
        const tabs = [
          { key: "basics", label: "基本信息" },
          {
            key: "roles",
            label: `预定义项目角色 ${selectedRoles.length}`,
          },
          {
            key: "workflows",
            label: `预定义工作流模版 ${selectedWorkflows.length}`,
          },
          {
            key: "business-chain",
            label: `业务链路 ${
              (templateDraft.allowedBusinessChainTemplateIds ?? []).length
            }`,
          },
        ];
        return h(
          Fragment,
          null,
          h(
            "div",
            { className: "pmproj-detail-head" },
            h(
              "div",
              null,
              h(
                "div",
                { className: "pmproj-title-line" },
                h("h2", null, templateDraft.name || "项目模版"),
                h(Pill, null, templateDraft.type || "未设置类型"),
                h(
                  Pill,
                  { tone: templateDraft.status === "启用" ? "done" : "notice" },
                  templateDraft.status,
                ),
              ),
              h(
                "div",
                { className: "pmproj-meta" },
                h("span", null, templateDraft.code || "未设置标识"),
                h("span", null, "·"),
                h("span", null, `${templateDraft.roleIds.length} 个角色`),
                h("span", null, "·"),
                h(
                  "span",
                  null,
                  `业务链路 ${
                    templateDraft.allowedBusinessChainTemplateIds?.length ?? 0
                  }`,
                ),
              ),
              templateDraft.description
                ? h(
                    "p",
                    { className: "pmproj-desc" },
                    templateDraft.description,
                  )
                : null,
            ),
            h(
              "div",
              { className: "pmproj-head-actions" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  disabled: busy === "template",
                  onClick: duplicateTemplate,
                },
                "复制",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn danger small",
                  type: "button",
                  disabled: busy === "template",
                  onClick: () => void removeTemplate(),
                },
                "删除",
              ),
            ),
          ),
          h(
            "div",
            { className: "pmproj-tabs" },
            tabs.map((item) =>
              h(
                "button",
                {
                  key: item.key,
                  type: "button",
                  className: `pmproj-tab ${
                    templateTab === item.key ? "active" : ""
                  }`.trim(),
                  onClick: () => setTemplateTab(item.key),
                },
                item.label,
              ),
            ),
          ),
          templateTab === "roles"
            ? h(
                Fragment,
                null,
                h(
                  "p",
                  { className: "pmproj-hint" },
                  "这里是模版素材：项目创建或应用该模版时，会把这批角色复制成项目自己的角色清单，之后项目可独立增删改，不会反向修改模版。",
                ),
                h(
                  "div",
                  { className: "pmproj-table" },
                  selectedRoles.length === 0
                    ? h(
                        "div",
                        { className: "pmproj-row" },
                        h(
                          "div",
                          { className: "pmproj-value" },
                          "尚未预定义项目角色。",
                        ),
                      )
                    : selectedRoles.map((role) =>
                        h(
                          "div",
                          { className: "pmproj-row", key: role.id },
                          h(
                            "div",
                            { className: "pmproj-member-copy" },
                            h("strong", null, role.name),
                            h(
                              "small",
                              null,
                              `${role.code} · ${role.category} · ${
                                role.description || "无说明"
                              }`,
                            ),
                          ),
                          h(
                            "div",
                            null,
                            h(
                              "span",
                              { className: "pmproj-label" },
                              "授权范围",
                            ),
                            h(
                              "span",
                              { className: "pmproj-value" },
                              permissionLabels(role.permissions),
                            ),
                          ),
                          h(Fragment, null),
                          h(Fragment, null),
                          h(
                            "div",
                            { className: "pmproj-actions" },
                            h(
                              "button",
                              {
                                className: "pmproj-btn secondary small",
                                type: "button",
                                onClick: () =>
                                  void saveTemplate({
                                    ...templateDraft,
                                    roleIds: templateDraft.roleIds.filter(
                                      (roleId) => roleId !== role.id,
                                    ),
                                  }),
                              },
                              "移除",
                            ),
                          ),
                        ),
                      ),
                ),
                h(
                  "div",
                  { className: "pmproj-inline-form" },
                  h(
                    "select",
                    {
                      value: "",
                      "aria-label": "选择要添加的项目角色",
                      onChange: (event) => {
                        if (event.target.value === "") return;
                        void saveTemplate({
                          ...templateDraft,
                          roleIds: [
                            ...templateDraft.roleIds,
                            event.target.value,
                          ],
                        });
                      },
                    },
                    h("option", { value: "" }, "添加项目角色…"),
                    availableRoles.map((role) =>
                      h(
                        "option",
                        { key: role.id, value: role.id },
                        `${role.name} · ${role.category}`,
                      ),
                    ),
                  ),
                ),
              )
            : templateTab === "workflows"
              ? h(
                  Fragment,
                  null,
                  h(
                    "p",
                    { className: "pmproj-hint" },
                    "这里只做引用：工作流模版本体统一在「工作流 → 工作流模版管理」维护。",
                  ),
                  h(
                    "div",
                    { className: "pmproj-table" },
                    selectedWorkflows.length === 0
                      ? h(
                          "div",
                          { className: "pmproj-row" },
                          h(
                            "div",
                            { className: "pmproj-value" },
                            "尚未引用工作流模版。",
                          ),
                        )
                      : selectedWorkflows.map((workflow) =>
                          h(
                            "div",
                            { className: "pmproj-row", key: workflow.id },
                            h(
                              "div",
                              { className: "pmproj-member-copy" },
                              h("strong", null, workflow.name),
                              h(
                                "small",
                                null,
                                `${workflow.key} v${workflow.version}`,
                              ),
                            ),
                            h(Pill, null, workflow.status),
                            h(Fragment, null),
                            h(Fragment, null),
                            h(
                              "div",
                              { className: "pmproj-actions" },
                              h(
                                "button",
                                {
                                  className: "pmproj-btn secondary small",
                                  type: "button",
                                  onClick: () =>
                                    void saveTemplate({
                                      ...templateDraft,
                                      workflowTemplateIds:
                                        templateDraft.workflowTemplateIds.filter(
                                          (id) => id !== workflow.id,
                                        ),
                                    }),
                                },
                                "移除",
                              ),
                            ),
                          ),
                        ),
                  ),
                  h(
                    "div",
                    { className: "pmproj-inline-form" },
                    h(
                      "select",
                      {
                        value: "",
                        "aria-label": "选择要引用的工作流模版",
                        onChange: (event) => {
                          if (event.target.value === "") return;
                          void saveTemplate({
                            ...templateDraft,
                            workflowTemplateIds: [
                              ...templateDraft.workflowTemplateIds,
                              event.target.value,
                            ],
                          });
                        },
                      },
                      h("option", { value: "" }, "引用工作流模版…"),
                      availableWorkflows.map((workflow) =>
                        h(
                          "option",
                          { key: workflow.id, value: workflow.id },
                          `${workflow.name} v${workflow.version}`,
                        ),
                      ),
                    ),
                  ),
                )
              : templateTab === "business-chain"
                ? (() => {
                    const candidates = (
                      templateData.businessChainTemplates ?? []
                    ).filter((item) => item.status === "active");
                    const allowedIds =
                      templateDraft.allowedBusinessChainTemplateIds ?? [];
                    const allowed = allowedIds
                      .map((id) => candidates.find((item) => item.id === id))
                      .filter(Boolean);
                    const available = candidates.filter(
                      (item) => !allowedIds.includes(item.id),
                    );
                    const mode = templateDraft.businessChainMode ?? "none";
                    const selectedCandidate =
                      candidates.find(
                        (item) =>
                          item.id ===
                          templateDraft.defaultBusinessChainTemplateId,
                      ) ??
                      allowed[0] ??
                      null;
                    const previewNodes = [
                      ...(selectedCandidate?.nodes ?? []),
                    ].sort(
                      (left, right) =>
                        (left.sequence ?? Number.MAX_SAFE_INTEGER) -
                          (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
                        left.nodeId.localeCompare(right.nodeId),
                    );
                    const effectivePreviewNodeId = previewNodes.some(
                      (node) => node.nodeId === businessChainPreviewNodeId,
                    )
                      ? businessChainPreviewNodeId
                      : (previewNodes[0]?.nodeId ?? "");
                    const previewNode =
                      previewNodes.find(
                        (node) => node.nodeId === effectivePreviewNodeId,
                      ) ?? null;
                    return h(
                      Fragment,
                      null,
                      h(
                        "div",
                        {
                          className:
                            "pmproj-form-grid pmproj-business-chain-policy-grid",
                        },
                        h(
                          "label",
                          { className: "pmproj-field" },
                          h("span", { className: "label" }, "链路模式"),
                          h(
                            "select",
                            {
                              value: mode,
                              onChange: (event) => {
                                const nextMode = event.target.value;
                                const fallbackDefault =
                                  templateDraft.defaultBusinessChainTemplateId ||
                                  allowedIds[0] ||
                                  candidates[0]?.id ||
                                  "";
                                if (
                                  nextMode === "required" &&
                                  fallbackDefault === ""
                                ) {
                                  return;
                                }
                                void saveTemplate({
                                  ...templateDraft,
                                  businessChainMode: nextMode,
                                  ...(nextMode === "none"
                                    ? {
                                        allowedBusinessChainTemplateIds: [],
                                        defaultBusinessChainTemplateId: "",
                                      }
                                    : nextMode === "required"
                                      ? {
                                          allowedBusinessChainTemplateIds:
                                            allowedIds.includes(fallbackDefault)
                                              ? allowedIds
                                              : [
                                                  ...allowedIds,
                                                  fallbackDefault,
                                                ],
                                          defaultBusinessChainTemplateId:
                                            fallbackDefault,
                                        }
                                      : {}),
                                });
                              },
                            },
                            h("option", { value: "none" }, "不使用"),
                            h("option", { value: "optional" }, "可选"),
                            h("option", { value: "required" }, "必须绑定"),
                          ),
                        ),
                        h(
                          "label",
                          { className: "pmproj-field" },
                          h("span", { className: "label" }, "版本策略"),
                          h(
                            "select",
                            {
                              value:
                                templateDraft.versionPolicy ??
                                "pin-at-project-create",
                              disabled: mode === "none",
                              onChange: (event) =>
                                void saveTemplate({
                                  ...templateDraft,
                                  versionPolicy: event.target.value,
                                }),
                            },
                            h(
                              "option",
                              { value: "pin-at-project-create" },
                              "创建时固定",
                            ),
                            h(
                              "option",
                              { value: "latest-active" },
                              "显式应用最新启用版本",
                            ),
                          ),
                        ),
                        h(
                          "label",
                          { className: "pmproj-field" },
                          h("span", { className: "label" }, "默认业务链路"),
                          h(
                            "select",
                            {
                              value:
                                templateDraft.defaultBusinessChainTemplateId ??
                                "",
                              disabled: mode === "none",
                              onChange: (event) =>
                                void saveTemplate({
                                  ...templateDraft,
                                  defaultBusinessChainTemplateId:
                                    event.target.value,
                                  allowedBusinessChainTemplateIds:
                                    event.target.value === "" ||
                                    allowedIds.includes(event.target.value)
                                      ? allowedIds
                                      : [...allowedIds, event.target.value],
                                }),
                            },
                            h(
                              "option",
                              { value: "" },
                              mode === "required"
                                ? "请选择默认链路"
                                : "无默认链路",
                            ),
                            allowed.map((item) =>
                              h(
                                "option",
                                { key: item.id, value: item.id },
                                `${item.name} v${item.version}`,
                              ),
                            ),
                          ),
                        ),
                      ),
                      h(
                        "div",
                        {
                          className: "pmproj-business-chain-config-row",
                        },
                        h(
                          "label",
                          { className: "pmproj-field" },
                          h("span", { className: "label" }, "已有业务链路配置"),
                          h(
                            "select",
                            {
                              value: "",
                              disabled:
                                mode === "none" || candidates.length === 0,
                              "aria-label": "复用已有业务链路配置",
                              onChange: (event) => {
                                if (event.target.value === "") return;
                                void saveTemplate({
                                  ...templateDraft,
                                  businessChainMode:
                                    mode === "none" ? "optional" : mode,
                                  allowedBusinessChainTemplateIds: [
                                    ...new Set([
                                      ...allowedIds,
                                      event.target.value,
                                    ]),
                                  ],
                                  defaultBusinessChainTemplateId:
                                    event.target.value,
                                });
                              },
                            },
                            h(
                              "option",
                              { value: "" },
                              candidates.length === 0
                                ? "暂无可复用的业务链路"
                                : "选择已有业务链路…",
                            ),
                            candidates.map((item) =>
                              h(
                                "option",
                                { key: item.id, value: item.id },
                                `${item.name} v${item.version}${
                                  allowedIds.includes(item.id)
                                    ? " · 已添加"
                                    : ""
                                }`,
                              ),
                            ),
                          ),
                        ),
                        h(
                          "button",
                          {
                            className: "pmproj-link-button",
                            type: "button",
                            disabled: busy === "business-chain-upload",
                            onClick: () =>
                              businessChainFileRef.current?.click(),
                          },
                          busy === "business-chain-upload"
                            ? "上传中…"
                            : "上传配置",
                        ),
                        h("input", {
                          ref: businessChainFileRef,
                          className: "pmproj-business-chain-file-input",
                          type: "file",
                          accept: ".md,.json,text/markdown,application/json",
                          disabled: busy === "business-chain-upload",
                          style: { display: "none" },
                          onChange: (event) =>
                            void uploadBusinessChainConfig(
                              event.target.files?.[0],
                            ),
                        }),
                      ),
                      h(
                        "section",
                        {
                          className: `pmproj-progress-section pmproj-business-chain-preview${
                            businessChainPreviewFullscreen
                              ? " is-fullscreen"
                              : ""
                          }`,
                          "aria-label": "项目模版业务链路预览",
                        },
                        h(
                          "div",
                          { className: "pmproj-progress-head" },
                          h(
                            "div",
                            { className: "pmproj-progress-head-main" },
                            h("h3", null, "业务链路图预览"),
                            h(
                              "span",
                              { className: "pmproj-progress-count" },
                              `${previewNodes.length} 个节点`,
                            ),
                          ),
                          h(
                            "div",
                            { className: "pmproj-progress-actions" },
                            h(
                              "button",
                              {
                                className: "pmproj-progress-tool",
                                type: "button",
                                disabled:
                                  businessChainPreviewZoom <= PROGRESS_ZOOM_MIN,
                                "aria-label": "缩小模版业务链路预览",
                                onClick: () =>
                                  setBusinessChainPreviewZoom((current) =>
                                    nextProgressZoom(current, -1),
                                  ),
                              },
                              ZoomOutIcon(),
                            ),
                            h(
                              "span",
                              { className: "pmproj-progress-zoom" },
                              `${Math.round(businessChainPreviewZoom * 100)}%`,
                            ),
                            h(
                              "button",
                              {
                                className: "pmproj-progress-tool",
                                type: "button",
                                disabled:
                                  businessChainPreviewZoom >= PROGRESS_ZOOM_MAX,
                                "aria-label": "放大模版业务链路预览",
                                onClick: () =>
                                  setBusinessChainPreviewZoom((current) =>
                                    nextProgressZoom(current, 1),
                                  ),
                              },
                              ZoomInIcon(),
                            ),
                            h(
                              "button",
                              {
                                className: "pmproj-progress-tool",
                                type: "button",
                                "aria-label": "复位模版业务链路预览",
                                onClick: () => {
                                  setBusinessChainPreviewZoom(1);
                                  businessChainPreviewViewportRef.current?.scrollTo?.(
                                    { left: 0, top: 0, behavior: "smooth" },
                                  );
                                },
                              },
                              ResetIcon(),
                            ),
                            h(
                              "button",
                              {
                                className: "pmproj-progress-tool",
                                type: "button",
                                "aria-label": businessChainPreviewFullscreen
                                  ? "退出全屏模版业务链路预览"
                                  : "全屏展示模版业务链路预览",
                                "aria-pressed": businessChainPreviewFullscreen
                                  ? "true"
                                  : "false",
                                onClick: () =>
                                  setBusinessChainPreviewFullscreen(
                                    (current) => !current,
                                  ),
                              },
                              FullscreenIcon({
                                exit: businessChainPreviewFullscreen,
                              }),
                            ),
                          ),
                        ),
                        previewNodes.length === 0
                          ? h(
                              "div",
                              { className: "pmproj-progress-empty" },
                              "选择或上传业务链路配置后显示节点图预览。",
                            )
                          : h(
                              Fragment,
                              null,
                              h(
                                "div",
                                {
                                  className: "pmproj-flow-viewport",
                                  ref: businessChainPreviewViewportRef,
                                },
                                h(
                                  "div",
                                  {
                                    className: "pmproj-flow-stage",
                                    style: { zoom: businessChainPreviewZoom },
                                  },
                                  h(
                                    "div",
                                    { className: "pmproj-flow" },
                                    previewNodes.flatMap((node, index) => {
                                      const parts = [];
                                      if (index > 0) {
                                        parts.push(
                                          h("span", {
                                            key: `template-arrow-${node.nodeId}`,
                                            className: "pmproj-flow-arrow",
                                          }),
                                        );
                                      }
                                      parts.push(
                                        h(
                                          "button",
                                          {
                                            key: node.nodeId,
                                            type: "button",
                                            className: `pmproj-flow-node tone-${
                                              node.nodeId ===
                                              effectivePreviewNodeId
                                                ? "progress"
                                                : "neutral"
                                            } ${
                                              node.nodeId ===
                                              effectivePreviewNodeId
                                                ? "selected"
                                                : ""
                                            }`.trim(),
                                            "data-business-chain-preview-node":
                                              node.nodeId,
                                            onClick: () =>
                                              setBusinessChainPreviewNodeId(
                                                node.nodeId,
                                              ),
                                          },
                                          h(
                                            "span",
                                            {
                                              className: "pmproj-flow-node-top",
                                            },
                                            h(
                                              "span",
                                              {
                                                className:
                                                  "pmproj-flow-node-heading",
                                              },
                                              h(
                                                "span",
                                                {
                                                  className:
                                                    "pmproj-flow-node-code",
                                                },
                                                String(
                                                  node.sequence ?? index + 1,
                                                ),
                                              ),
                                              h(
                                                "span",
                                                {
                                                  className:
                                                    "pmproj-flow-node-title",
                                                },
                                                node.name,
                                              ),
                                            ),
                                            h(
                                              Pill,
                                              { tone: "notice" },
                                              "配置预览",
                                            ),
                                          ),
                                          h(
                                            "span",
                                            {
                                              className:
                                                "pmproj-flow-node-owner",
                                            },
                                            "负责 ",
                                            h(
                                              "strong",
                                              null,
                                              node.executor?.label ??
                                                node.executor?.id ??
                                                "待解析",
                                            ),
                                          ),
                                          (node.fields ?? []).length === 0
                                            ? null
                                            : h(
                                                "span",
                                                {
                                                  className:
                                                    "pmproj-flow-node-facts",
                                                },
                                                node.fields.map((field) =>
                                                  h(
                                                    "span",
                                                    {
                                                      className:
                                                        "pmproj-flow-node-fact",
                                                      key: field.key,
                                                    },
                                                    h(
                                                      "span",
                                                      null,
                                                      field.label,
                                                    ),
                                                    h("strong", null, "已配置"),
                                                  ),
                                                ),
                                              ),
                                          h(
                                            "span",
                                            {
                                              className:
                                                "pmproj-flow-node-exception",
                                            },
                                            h("span", null, "异常"),
                                            h("strong", null, "未执行"),
                                          ),
                                        ),
                                      );
                                      return parts;
                                    }),
                                  ),
                                ),
                              ),
                              previewNode === null
                                ? null
                                : h(
                                    "div",
                                    {
                                      className: "pmproj-node-detail",
                                      "aria-live": "polite",
                                    },
                                    h(
                                      "div",
                                      { className: "pmproj-node-detail-head" },
                                      h(
                                        "div",
                                        {
                                          className: "pmproj-node-detail-title",
                                        },
                                        h(
                                          "strong",
                                          null,
                                          `${previewNode.sequence ?? "-"} · ${
                                            previewNode.name
                                          }`,
                                        ),
                                        h(
                                          "p",
                                          null,
                                          `${previewNode.stageCode} · ${
                                            (previewNode.fields ?? []).length
                                          } 个自定义字段`,
                                        ),
                                      ),
                                    ),
                                    h(
                                      "div",
                                      { className: "pmproj-node-links" },
                                      h(
                                        "div",
                                        {
                                          className:
                                            "pmproj-node-links-section",
                                        },
                                        h(
                                          "div",
                                          {
                                            className: "pmproj-node-links-head",
                                          },
                                          h("span", null, "字段逻辑"),
                                        ),
                                        h(
                                          "div",
                                          { className: "pmproj-progress-task" },
                                          h("strong", null, "负责人、异常"),
                                          h(
                                            "small",
                                            null,
                                            "由平台固定提供，不需要业务链路配置",
                                          ),
                                        ),
                                        (previewNode.fields ?? []).map(
                                          (field) =>
                                            h(
                                              "div",
                                              {
                                                className:
                                                  "pmproj-progress-task",
                                                key: field.key,
                                              },
                                              h("strong", null, field.label),
                                              (field.bindings ?? []).map(
                                                (binding) =>
                                                  h(
                                                    "small",
                                                    {
                                                      key: `${binding.system}:${binding.objectId}:${binding.path}`,
                                                    },
                                                    `${binding.system}:${binding.objectId} → ${binding.path}`,
                                                  ),
                                              ),
                                            ),
                                        ),
                                      ),
                                    ),
                                  ),
                            ),
                      ),
                      h(
                        "div",
                        {
                          className: "pmproj-table",
                          style: { display: "none" },
                        },
                        allowed.length === 0
                          ? h(
                              "div",
                              { className: "pmproj-empty" },
                              "当前模版还没有候选业务链路。请先在工作流中发布 kind=business-chain 的定义。",
                            )
                          : allowed.map((item) =>
                              h(
                                "div",
                                { className: "pmproj-row", key: item.id },
                                h(
                                  "div",
                                  { className: "pmproj-member-copy" },
                                  h("strong", null, item.name),
                                  h(
                                    "small",
                                    null,
                                    `${item.key} v${item.version} · ${item.stageCount} 个阶段`,
                                  ),
                                ),
                                h(
                                  "span",
                                  { className: "pmproj-value" },
                                  item.projectTypeCodes?.join("、") ||
                                    "适用全部项目类型",
                                ),
                                h(
                                  "div",
                                  { className: "pmproj-actions" },
                                  templateDraft.defaultBusinessChainTemplateId ===
                                    item.id
                                    ? h(Pill, { tone: "done" }, "默认")
                                    : null,
                                  h(
                                    "button",
                                    {
                                      className: "pmproj-btn secondary small",
                                      type: "button",
                                      onClick: () =>
                                        void saveTemplate({
                                          ...templateDraft,
                                          allowedBusinessChainTemplateIds:
                                            allowedIds.filter(
                                              (id) => id !== item.id,
                                            ),
                                          defaultBusinessChainTemplateId:
                                            templateDraft.defaultBusinessChainTemplateId ===
                                            item.id
                                              ? ""
                                              : templateDraft.defaultBusinessChainTemplateId,
                                        }),
                                    },
                                    "移除",
                                  ),
                                ),
                              ),
                            ),
                      ),
                      h(
                        "div",
                        {
                          className: "pmproj-inline-form",
                          style: { display: "none" },
                        },
                        h(
                          "label",
                          {
                            className:
                              "pmproj-btn secondary small pmproj-upload",
                          },
                          busy === "business-chain-upload"
                            ? "导入中…"
                            : "上传配置",
                          h("input", {
                            ref: businessChainFileRef,
                            className: "pmproj-business-chain-file-input",
                            type: "file",
                            accept: ".md,.json,text/markdown,application/json",
                            disabled: busy === "business-chain-upload",
                            onChange: (event) =>
                              void uploadBusinessChainConfig(
                                event.target.files?.[0],
                              ),
                          }),
                        ),
                        h(
                          "select",
                          {
                            value: "",
                            disabled: mode === "none" || available.length === 0,
                            "aria-label": "添加候选业务链路",
                            onChange: (event) => {
                              if (event.target.value === "") return;
                              void saveTemplate({
                                ...templateDraft,
                                businessChainMode:
                                  mode === "none" ? "optional" : mode,
                                allowedBusinessChainTemplateIds: [
                                  ...allowedIds,
                                  event.target.value,
                                ],
                                defaultBusinessChainTemplateId:
                                  templateDraft.defaultBusinessChainTemplateId ||
                                  event.target.value,
                              });
                            },
                          },
                          h("option", { value: "" }, "添加候选业务链路…"),
                          available.map((item) =>
                            h(
                              "option",
                              { key: item.id, value: item.id },
                              `${item.name} v${item.version}`,
                            ),
                          ),
                        ),
                      ),
                    );
                  })()
                : h(
                    "div",
                    { className: "pmproj-form-grid" },
                    h(
                      "label",
                      { className: "pmproj-field" },
                      h("span", { className: "label" }, "模版名称"),
                      h("input", {
                        value: templateDraft.name,
                        onChange: (event) =>
                          setTemplateDraft({
                            ...templateDraft,
                            name: event.target.value,
                          }),
                      }),
                    ),
                    h(
                      "label",
                      { className: "pmproj-field" },
                      h("span", { className: "label" }, "模版标识"),
                      h("input", {
                        value: templateDraft.code,
                        onChange: (event) =>
                          setTemplateDraft({
                            ...templateDraft,
                            code: event.target.value,
                          }),
                      }),
                    ),
                    h(
                      "label",
                      { className: "pmproj-field" },
                      h("span", { className: "label" }, "项目类型"),
                      h("input", {
                        value: templateDraft.type,
                        onChange: (event) =>
                          setTemplateDraft({
                            ...templateDraft,
                            type: event.target.value,
                          }),
                      }),
                    ),
                    h(
                      "label",
                      { className: "pmproj-field" },
                      h("span", { className: "label" }, "状态"),
                      h(
                        "select",
                        {
                          value: templateDraft.status,
                          onChange: (event) =>
                            setTemplateDraft({
                              ...templateDraft,
                              status: event.target.value,
                            }),
                        },
                        h("option", { value: "启用" }, "启用"),
                        h("option", { value: "停用" }, "停用"),
                      ),
                    ),
                    h(
                      "label",
                      { className: "pmproj-field wide" },
                      h("span", { className: "label" }, "模版说明"),
                      h("textarea", {
                        value: templateDraft.description,
                        onChange: (event) =>
                          setTemplateDraft({
                            ...templateDraft,
                            description: event.target.value,
                          }),
                      }),
                    ),
                    h(
                      "div",
                      { className: "pmproj-footer wide" },
                      h(
                        "button",
                        {
                          className: "pmproj-btn",
                          type: "button",
                          disabled: busy === "template",
                          onClick: () => void saveTemplate(),
                        },
                        "保存模版",
                      ),
                    ),
                  ),
        );
      };

      const renderTemplateView = () =>
        h(
          Fragment,
          null,
          h(
            "div",
            { className: "pmproj-head" },
            h(
              "div",
              null,
              h("h1", null, "项目模版维护"),
              h(
                "div",
                { className: "pmproj-sub" },
                "按项目类型预置「项目角色清单」与「工作流模版清单」；工作流模版本体统一在工作流 → 工作流模版管理维护。",
              ),
            ),
            h(
              "div",
              { className: "pmproj-head-actions" },
              h(
                "div",
                { className: "pmproj-tabs" },
                h(
                  "button",
                  {
                    type: "button",
                    className: `pmproj-tab ${
                      templatePane === "templates" ? "active" : ""
                    }`.trim(),
                    onClick: () => setTemplatePane("templates"),
                  },
                  "项目模版",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: `pmproj-tab ${
                      templatePane === "roles" ? "active" : ""
                    }`.trim(),
                    onClick: () => setTemplatePane("roles"),
                  },
                  "角色库（模版素材）",
                ),
              ),
              h(
                "button",
                {
                  className: "pmproj-btn small",
                  type: "button",
                  onClick: () =>
                    templatePane === "roles" ? createRole() : createTemplate(),
                },
                templatePane === "roles" ? "新建角色" : "新建模版",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setView("detail"),
                },
                "关闭",
              ),
            ),
          ),
          h(
            "div",
            { className: "pmproj-layout" },
            h(
              "aside",
              { className: "pmproj-directory", "aria-label": "项目模版列表" },
              h(
                "label",
                { className: "pmproj-search" },
                SearchIcon(),
                h("input", {
                  value: templateSearch,
                  placeholder:
                    templatePane === "roles"
                      ? "搜索角色名称、标识或分类"
                      : "搜索模版名称、类型或角色",
                  onChange: (event) => setTemplateSearch(event.target.value),
                }),
              ),
              h("div", { className: "pmproj-list" }, renderTemplateList()),
            ),
            h("main", { className: "pmproj-detail" }, renderTemplateDetail()),
          ),
        );

      const renderReportScheduleModal = () =>
        h(
          "div",
          {
            className: `pmproj-modal-mask ${
              reportScheduleOpen ? "open" : ""
            }`.trim(),
          },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "项目日报生成设置"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setReportScheduleOpen(false),
                },
                "关闭",
              ),
            ),
            h(
              "div",
              { className: "pmproj-form-grid" },
              h(
                "label",
                { className: "pmproj-field wide" },
                h("span", { className: "label" }, "自动生成"),
                h(
                  "label",
                  { className: "pmproj-checkbox" },
                  h("input", {
                    type: "checkbox",
                    checked: reportScheduleDraft.enabled,
                    disabled: !canManage,
                    onChange: (event) =>
                      setReportScheduleDraft((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      })),
                  }),
                  reportScheduleDraft.enabled
                    ? "已启用，按计划生成项目日报"
                    : "已停用自动生成",
                ),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "生成频次"),
                h(
                  "select",
                  {
                    value: reportScheduleDraft.frequency,
                    disabled: !canManage,
                    onChange: (event) =>
                      setReportScheduleDraft((current) => ({
                        ...current,
                        frequency: event.target.value,
                      })),
                  },
                  Object.entries(REPORT_SCHEDULE_FREQUENCY_LABELS).map(
                    ([value, label]) =>
                      h("option", { key: value, value }, label),
                  ),
                ),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "生成时间"),
                h("input", {
                  type: "time",
                  value: reportScheduleDraft.time,
                  disabled: !canManage,
                  onChange: (event) =>
                    setReportScheduleDraft((current) => ({
                      ...current,
                      time: event.target.value,
                    })),
                }),
              ),
              reportScheduleDraft.frequency === "weekly"
                ? h(
                    "label",
                    { className: "pmproj-field" },
                    h("span", { className: "label" }, "每周生成日"),
                    h(
                      "select",
                      {
                        value: reportScheduleDraft.weekday,
                        disabled: !canManage,
                        onChange: (event) =>
                          setReportScheduleDraft((current) => ({
                            ...current,
                            weekday: Number(event.target.value),
                          })),
                      },
                      REPORT_WEEKDAY_LABELS.map((label, value) =>
                        h("option", { key: value, value }, label),
                      ),
                    ),
                  )
                : null,
              reportScheduleDraft.frequency === "monthly"
                ? h(
                    "label",
                    { className: "pmproj-field" },
                    h("span", { className: "label" }, "每月生成日"),
                    h(
                      "select",
                      {
                        value: reportScheduleDraft.dayOfMonth,
                        disabled: !canManage,
                        onChange: (event) =>
                          setReportScheduleDraft((current) => ({
                            ...current,
                            dayOfMonth: Number(event.target.value),
                          })),
                      },
                      Array.from({ length: 28 }, (_, index) => index + 1).map(
                        (day) =>
                          h("option", { key: day, value: day }, `${day} 日`),
                      ),
                    ),
                  )
                : null,
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "时区"),
                h("input", {
                  value: reportScheduleDraft.timezone,
                  readOnly: true,
                }),
              ),
              h(
                "p",
                { className: "pmproj-hint wide" },
                canManage
                  ? `默认每天 08:00 自动生成。当前计划：${reportScheduleSummary(
                      reportScheduleDraft,
                    )}。同一日期已有项目日报时不会重复覆盖。`
                  : `当前计划：${reportScheduleSummary(
                      reportScheduleDraft,
                    )}。仅项目负责人或平台管理员可以修改生成设置。`,
              ),
              h(
                "div",
                { className: "pmproj-footer wide" },
                h(
                  "button",
                  {
                    className: "pmproj-btn secondary",
                    type: "button",
                    onClick: () => setReportScheduleOpen(false),
                  },
                  canManage ? "取消" : "关闭",
                ),
                canManage
                  ? h(
                      "button",
                      {
                        className: "pmproj-btn",
                        type: "button",
                        disabled: busy === "report-schedule",
                        onClick: () => void saveReportSchedule(),
                      },
                      busy === "report-schedule" ? "保存中…" : "保存设置",
                    )
                  : null,
              ),
            ),
          ),
        );

      const renderCreateModal = () =>
        h(
          "div",
          { className: `pmproj-modal-mask ${createOpen ? "open" : ""}`.trim() },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "新建项目"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setCreateOpen(false),
                },
                "关闭",
              ),
            ),
            h(
              "div",
              { className: "pmproj-form-grid" },
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "项目名称"),
                h("input", {
                  value: createDraft.name,
                  placeholder: "例如：供应链韧性专项",
                  onChange: (event) =>
                    setCreateDraft({
                      ...createDraft,
                      name: event.target.value,
                    }),
                }),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "项目模版（可选）"),
                h(
                  "select",
                  {
                    value: createDraft.templateId,
                    onChange: (event) =>
                      setCreateDraft({
                        ...createDraft,
                        templateId: event.target.value,
                      }),
                  },
                  h("option", { value: "" }, "暂不套用模版"),
                  (templateData?.templates ?? [])
                    .filter((template) => template.status === "启用")
                    .map((template) =>
                      h(
                        "option",
                        { key: template.id, value: template.id },
                        template.name,
                      ),
                    ),
                ),
              ),
              h(
                "div",
                { className: "pmproj-field wide" },
                h("span", { className: "label" }, "项目目录"),
                h(
                  "div",
                  { className: "pmproj-inline-form" },
                  h("input", {
                    value: createDraft.path,
                    readOnly: true,
                    placeholder: "选择一个已存在的本地目录",
                    "aria-label": "项目目录",
                  }),
                  h(
                    "button",
                    {
                      className: "pmproj-btn secondary small",
                      type: "button",
                      onClick: () => void pickDirectory(),
                    },
                    "选择目录",
                  ),
                ),
                h(
                  "p",
                  { className: "pmproj-hint" },
                  "项目即 DSH 工作区：模块只注册目录，不会改动磁盘内容；创建者会成为项目负责人。",
                ),
              ),
              h(
                "div",
                { className: "pmproj-footer wide" },
                h(
                  "button",
                  {
                    className: "pmproj-btn secondary",
                    type: "button",
                    onClick: () => setCreateOpen(false),
                  },
                  "取消",
                ),
                h(
                  "button",
                  {
                    className: "pmproj-btn",
                    type: "button",
                    disabled: busy === "create",
                    onClick: () => void submitCreate(),
                  },
                  "创建项目",
                ),
              ),
            ),
          ),
        );

      const renderLeaveModal = () =>
        h(
          "div",
          {
            className: `pmproj-modal-mask ${leaveOpen ? "open" : ""}`.trim(),
          },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "退出项目？"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setLeaveOpen(false),
                },
                "关闭",
              ),
            ),
            h(
              "p",
              { className: "pmproj-hint" },
              `退出「${selectedProject?.name ?? "当前项目"}」后，你将不再是该项目（工作区）的成员，当前持有的项目角色会被清空。平台账号和全局平台角色不受影响。`,
            ),
            detail?.viewer?.workspaceRole === "owner"
              ? h(
                  "p",
                  { className: "pmproj-notice" },
                  "你当前是工作区负责人。退出后该项目可能没有工作区负责人，平台管理员仍可继续维护。",
                )
              : null,
            h(
              "div",
              { className: "pmproj-footer" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary",
                  type: "button",
                  disabled: busy === "leave",
                  onClick: () => setLeaveOpen(false),
                },
                "取消",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn danger",
                  type: "button",
                  disabled: busy === "leave",
                  onClick: () => void leaveProject(),
                },
                busy === "leave" ? "退出中…" : "确认退出",
              ),
            ),
          ),
        );

      const renderProjectTemplateSaveModal = () => {
        if (!projectTemplateSaveOpen) return null;
        const binding = detail?.project?.businessChainBinding;
        const chainName =
          businessChainData?.current?.name ??
          (binding === undefined ? "" : "已应用业务链路");
        const canSave =
          projectTemplateSaveDraft.name.trim() !== "" &&
          projectTemplateSaveDraft.type.trim() !== "" &&
          busy !== "template-save";
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "保存为项目模版"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setProjectTemplateSaveOpen(false),
                },
                "关闭",
              ),
            ),
            h(
              "p",
              { className: "pmproj-hint" },
              "保存当前已生效的项目角色定义和业务链路；成员、任务与运行实例不会写入模版。",
            ),
            projectTemplateSaveError === ""
              ? null
              : h(
                  "div",
                  { className: "pmproj-error" },
                  h("span", null, projectTemplateSaveError),
                ),
            h(
              "div",
              { className: "pmproj-form-grid" },
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "模版名称"),
                h("input", {
                  value: projectTemplateSaveDraft.name,
                  maxLength: 80,
                  placeholder: "例如：供应链交付标准模版",
                  onChange: (event) =>
                    setProjectTemplateSaveDraft({
                      ...projectTemplateSaveDraft,
                      name: event.target.value,
                    }),
                }),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "项目类型"),
                h("input", {
                  value: projectTemplateSaveDraft.type,
                  maxLength: 40,
                  placeholder: "例如：采购类、研发类",
                  onChange: (event) =>
                    setProjectTemplateSaveDraft({
                      ...projectTemplateSaveDraft,
                      type: event.target.value,
                    }),
                }),
              ),
            ),
            h(
              "div",
              { className: "pmproj-template-summary" },
              h(
                "div",
                null,
                h("span", null, "项目角色"),
                h("strong", null, `${effectiveRoles.length} 个自定义角色`),
              ),
              h(
                "div",
                null,
                h("span", null, "业务链路"),
                h("strong", null, chainName || "不包含"),
              ),
            ),
            h(
              "div",
              { className: "pmproj-footer" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary",
                  type: "button",
                  onClick: () => setProjectTemplateSaveOpen(false),
                },
                "取消",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn",
                  type: "button",
                  disabled: !canSave,
                  onClick: () => void saveProjectAsTemplate(),
                },
                busy === "template-save" ? "保存中…" : "保存模版",
              ),
            ),
          ),
        );
      };

      const renderEditFooter = () => {
        if (editDraft === null) return null;
        if (editTab === "basics") {
          return h(
            "div",
            { className: "pmproj-settings-footer" },
            h(
              "button",
              {
                className: "pmproj-btn secondary",
                type: "button",
                onClick: closeEditModal,
              },
              "取消",
            ),
            h(
              "button",
              {
                className: "pmproj-btn",
                type: "button",
                disabled: busy === "edit",
                onClick: () => void saveEdit(),
              },
              "保存",
            ),
          );
        }
        if (editTab === "roles" && roleDraftDirty) {
          return h(
            "div",
            { className: "pmproj-settings-footer" },
            h(
              "span",
              { className: "pmproj-settings-footer-message" },
              `新增 ${roleDiff.added.length} · 修改 ${roleDiff.updated.length} · 移除 ${roleDiff.removed.length}`,
            ),
            h(
              "button",
              {
                className: "pmproj-btn secondary",
                type: "button",
                disabled: busy === "role-confirm",
                onClick: resetRoleDraft,
              },
              "取消编辑",
            ),
            h(
              "button",
              {
                className: "pmproj-btn",
                type: "button",
                disabled: busy === "role-confirm",
                onClick: () => void confirmRoleDraft(false),
              },
              "确认生效",
            ),
          );
        }
        if (editTab === "business-chain") {
          return h(
            "div",
            { className: "pmproj-settings-footer" },
            businessChainNotice === ""
              ? null
              : h(
                  "span",
                  {
                    className: `pmproj-settings-footer-message${
                      businessChainNoticeClass(businessChainNotice).includes(
                        "pmproj-notice-error",
                      )
                        ? " is-error"
                        : ""
                    }`,
                  },
                  businessChainNotice,
                ),
            h(
              "button",
              {
                className: "pmproj-btn secondary",
                type: "button",
                disabled: busy === "business-chain-enable",
                onClick: cancelBusinessChainSettings,
              },
              "取消",
            ),
            h(
              "button",
              {
                className: "pmproj-btn",
                type: "button",
                disabled:
                  busy === "business-chain-enable" ||
                  businessChainDraft === null,
                onClick: () => void enableBusinessChain(),
              },
              busy === "business-chain-enable" ? "启用中…" : "启用",
            ),
          );
        }
        if (editTab === "other" && otherSettingsFooter !== null) {
          return h(
            "div",
            { className: "pmproj-settings-footer" },
            otherSettingsFooter,
          );
        }
        return null;
      };

      const renderEditModal = () =>
        h(
          "div",
          { className: `pmproj-modal-mask ${editOpen ? "open" : ""}`.trim() },
          h(
            "div",
            {
              className: "pmproj-modal wide",
              role: "dialog",
              "aria-modal": "true",
            },
            h(
              "div",
              { className: "pmproj-settings-sticky" },
              h(
                "div",
                { className: "pmproj-modal-head" },
                h("h2", null, "项目设置"),
                h(
                  "button",
                  {
                    className: "pmproj-btn secondary small",
                    type: "button",
                    onClick: closeEditModal,
                  },
                  "关闭",
                ),
              ),
              h(
                "div",
                { className: "pmproj-settings-nav" },
                h(
                  "div",
                  {
                    className: "pmproj-tabs",
                    role: "tablist",
                    "aria-label": "项目编辑内容",
                  },
                  h(
                    "button",
                    {
                      className: `pmproj-tab ${
                        editTab === "basics" ? "active" : ""
                      }`.trim(),
                      type: "button",
                      role: "tab",
                      "aria-selected": editTab === "basics" ? "true" : "false",
                      onClick: () => requestEditTab("basics"),
                    },
                    "基础信息",
                  ),
                  h(
                    "button",
                    {
                      className: `pmproj-tab ${
                        editTab === "roles" ? "active" : ""
                      }`.trim(),
                      type: "button",
                      role: "tab",
                      "aria-selected": editTab === "roles" ? "true" : "false",
                      onClick: () => requestEditTab("roles"),
                    },
                    `项目角色 ${effectiveRoles.length}${
                      roleDraftDirty ? " · 草稿" : ""
                    }`,
                  ),
                  h(
                    "button",
                    {
                      className: `pmproj-tab ${
                        editTab === "business-chain" ? "active" : ""
                      }`.trim(),
                      type: "button",
                      role: "tab",
                      "aria-selected":
                        editTab === "business-chain" ? "true" : "false",
                      onClick: () => requestEditTab("business-chain"),
                    },
                    `业务链路${businessChainDirty ? " · 草稿" : ""}`,
                  ),
                  h(
                    "button",
                    {
                      className: `pmproj-tab ${
                        editTab === "other" ? "active" : ""
                      }`.trim(),
                      type: "button",
                      role: "tab",
                      "aria-selected": editTab === "other" ? "true" : "false",
                      onClick: () => requestEditTab("other"),
                    },
                    "其它设置",
                  ),
                ),
                viewer?.role === "admin" && editTab !== "other"
                  ? h(
                      "button",
                      {
                        className: "pmproj-btn subtle pmproj-settings-template",
                        type: "button",
                        onClick: openProjectTemplateSave,
                      },
                      "保存为项目模版",
                    )
                  : null,
              ),
            ),
            h(
              "div",
              { className: "pmproj-settings-body-scroll" },
              projectTemplateSaveNotice === ""
                ? null
                : h(
                    "div",
                    { className: "pmproj-notice" },
                    projectTemplateSaveNotice,
                  ),
              editDraft === null
                ? null
                : editTab === "roles"
                  ? renderProjectRoleEditor()
                  : editTab === "business-chain"
                    ? renderBusinessChainEditor()
                    : editTab === "other"
                      ? h(
                          "div",
                          { className: "pmproj-other-settings" },
                          props.renderSlot?.(
                            "pluginmax.project.settings.other",
                            {
                              workspaceId: selectedProject?.workspaceId ?? "",
                              projectName: editDraft.name,
                              canManage,
                              readOnly: !canManage,
                              onFooterChange: setOtherSettingsFooter,
                            },
                          ) ??
                            h(
                              "div",
                              { className: "pmproj-hint" },
                              "当前没有可配置的其它项目设置。",
                            ),
                        )
                      : h(
                          "div",
                          {
                            className:
                              "pmproj-form-grid pmproj-settings-basics",
                          },
                          h(
                            "label",
                            { className: "pmproj-field" },
                            h(
                              "span",
                              { className: "label" },
                              "项目名称（与左侧项目保持一致）",
                            ),
                            h("input", {
                              value: editDraft.name,
                              disabled: true,
                            }),
                          ),
                          h(
                            "label",
                            { className: "pmproj-field" },
                            h("span", { className: "label" }, "项目负责人"),
                            h(
                              "select",
                              {
                                value: editDraft.ownerId,
                                onChange: (event) =>
                                  setEditDraft({
                                    ...editDraft,
                                    ownerId: event.target.value,
                                  }),
                              },
                              h("option", { value: "" }, "未指定"),
                              (detail?.members ?? [])
                                .filter((member) => member.kind === "human")
                                .map((member) =>
                                  h(
                                    "option",
                                    { key: member.id, value: member.id },
                                    member.name,
                                  ),
                                ),
                            ),
                          ),
                          h(
                            "label",
                            { className: "pmproj-field" },
                            h("span", { className: "label" }, "运行状态"),
                            h(
                              "select",
                              {
                                value: editDraft.status,
                                onChange: (event) =>
                                  setEditDraft({
                                    ...editDraft,
                                    status: event.target.value,
                                  }),
                              },
                              PROJECT_STATUSES.map((status) =>
                                h(
                                  "option",
                                  { key: status, value: status },
                                  status,
                                ),
                              ),
                            ),
                          ),
                          h(
                            "label",
                            { className: "pmproj-field" },
                            h("span", { className: "label" }, "项目健康度"),
                            h(
                              "select",
                              {
                                value: editDraft.health,
                                onChange: (event) =>
                                  setEditDraft({
                                    ...editDraft,
                                    health: event.target.value,
                                  }),
                              },
                              PROJECT_HEALTHS.map((health) =>
                                h(
                                  "option",
                                  { key: health, value: health },
                                  health,
                                ),
                              ),
                            ),
                          ),
                          h(
                            "label",
                            { className: "pmproj-field" },
                            h("span", { className: "label" }, "整体进度 %"),
                            h("input", {
                              type: "number",
                              min: 0,
                              max: 100,
                              value: editDraft.progress,
                              onChange: (event) =>
                                setEditDraft({
                                  ...editDraft,
                                  progress: event.target.value,
                                }),
                            }),
                          ),
                          h(
                            "label",
                            { className: "pmproj-field" },
                            h("span", { className: "label" }, "开始日期"),
                            h("input", {
                              type: "date",
                              value: editDraft.startDate,
                              onChange: (event) =>
                                setEditDraft({
                                  ...editDraft,
                                  startDate: event.target.value,
                                }),
                            }),
                          ),
                          h(
                            "label",
                            { className: "pmproj-field" },
                            h("span", { className: "label" }, "目标日期"),
                            h("input", {
                              type: "date",
                              value: editDraft.targetDate,
                              onChange: (event) =>
                                setEditDraft({
                                  ...editDraft,
                                  targetDate: event.target.value,
                                }),
                            }),
                          ),
                          h(
                            "label",
                            { className: "pmproj-field wide" },
                            h("span", { className: "label" }, "项目说明"),
                            h("textarea", {
                              value: editDraft.description,
                              onChange: (event) =>
                                setEditDraft({
                                  ...editDraft,
                                  description: event.target.value,
                                }),
                            }),
                          ),
                        ),
            ),
            renderEditFooter(),
          ),
        );

      const renderMemberModal = () => {
        if (memberModal === null || detail === null) return null;
        const member = memberModalMember;
        const roleOptions = (detail.roles ?? []).filter(
          (role) => role.system !== true,
        );
        const selectedKind =
          memberModal.mode === "add"
            ? memberModal.addKind
            : memberModal.memberKind;
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h(
                "h2",
                null,
                memberModal.mode === "add"
                  ? "添加项目成员"
                  : "编辑项目成员权限",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setMemberModal(null),
                },
                "关闭",
              ),
            ),
            h(
              "div",
              { className: "pmproj-form-grid" },
              h(
                "div",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "成员"),
                memberModal.mode === "add"
                  ? h(
                      "div",
                      { className: "pmproj-member-picker" },
                      h(
                        "div",
                        {
                          className: "pmproj-member-search",
                        },
                        SearchIcon(),
                        h("input", {
                          role: "combobox",
                          value:
                            memberModal.addId === ""
                              ? memberSearchQuery
                              : (member?.name ?? memberSearchQuery),
                          placeholder: "搜索用户名或 AI 伙伴",
                          "aria-label": "搜索用户名或 AI 伙伴名称",
                          "aria-autocomplete": "list",
                          "aria-expanded": memberSearchOpen,
                          "aria-controls": "pmproj-member-search-results",
                          "aria-activedescendant":
                            memberSearchOpen && memberSearchOptions.length > 0
                              ? `pmproj-member-option-${
                                  memberSearchOptions[memberSearchActiveIndex]
                                    ?.kind
                                }-${
                                  memberSearchOptions[memberSearchActiveIndex]
                                    ?.candidate.id
                                }`
                              : undefined,
                          onFocus: () => setMemberSearchOpen(true),
                          onBlur: () => setMemberSearchOpen(false),
                          onKeyDown: (event) => {
                            if (event.key === "Escape") {
                              setMemberSearchOpen(false);
                              return;
                            }
                            if (
                              event.key === "ArrowDown" &&
                              memberSearchOptions.length > 0
                            ) {
                              event.preventDefault();
                              setMemberSearchOpen(true);
                              setMemberSearchActiveIndex(
                                (current) =>
                                  (current + 1) % memberSearchOptions.length,
                              );
                              return;
                            }
                            if (
                              event.key === "ArrowUp" &&
                              memberSearchOptions.length > 0
                            ) {
                              event.preventDefault();
                              setMemberSearchOpen(true);
                              setMemberSearchActiveIndex(
                                (current) =>
                                  (current - 1 + memberSearchOptions.length) %
                                  memberSearchOptions.length,
                              );
                              return;
                            }
                            if (
                              event.key === "Enter" &&
                              memberSearchOpen &&
                              memberSearchOptions[memberSearchActiveIndex]
                            ) {
                              event.preventDefault();
                              const option =
                                memberSearchOptions[memberSearchActiveIndex];
                              selectMemberCandidate(
                                option.kind,
                                option.candidate,
                              );
                            }
                          },
                          onChange: (event) => {
                            const value = event.target.value;
                            setMemberSearchQuery(value);
                            setMemberSearchOpen(true);
                            setMemberSearchActiveIndex(0);
                            if (memberModal.addId !== "") {
                              setMemberModal({
                                ...memberModal,
                                addKind: "human",
                                addId: "",
                              });
                            }
                          },
                        }),
                        memberSearchQuery !== "" || memberModal.addId !== ""
                          ? h(
                              "button",
                              {
                                className: "pmproj-member-search-clear",
                                type: "button",
                                "aria-label": "清除成员搜索",
                                onMouseDown: (event) => event.preventDefault(),
                                onClick: () => {
                                  setMemberSearchQuery("");
                                  setMemberSearchResults({
                                    humans: [],
                                    agents: [],
                                  });
                                  setMemberSearchOpen(false);
                                  setMemberModal({
                                    ...memberModal,
                                    addKind: "human",
                                    addId: "",
                                  });
                                },
                              },
                              h(
                                "svg",
                                {
                                  viewBox: "0 0 24 24",
                                  fill: "none",
                                  stroke: "currentColor",
                                  strokeWidth: 2,
                                  strokeLinecap: "round",
                                  "aria-hidden": true,
                                },
                                h("path", {
                                  d: "M6 6l12 12",
                                  key: "first",
                                }),
                                h("path", {
                                  d: "M18 6 6 18",
                                  key: "second",
                                }),
                              ),
                            )
                          : null,
                      ),
                      memberSearchOpen && memberSearchQuery.trim() !== ""
                        ? h(
                            "div",
                            {
                              id: "pmproj-member-search-results",
                              className: "pmproj-member-results",
                              role: "listbox",
                              "aria-label": "成员搜索结果",
                            },
                            memberSearchLoading
                              ? h(
                                  "div",
                                  { className: "pmproj-member-search-status" },
                                  "搜索中…",
                                )
                              : memberSearchError !== ""
                                ? h(
                                    "div",
                                    {
                                      className: "pmproj-member-search-status",
                                    },
                                    memberSearchError,
                                  )
                                : memberSearchOptions.length === 0
                                  ? h(
                                      "div",
                                      {
                                        className:
                                          "pmproj-member-search-status",
                                      },
                                      "未找到可添加的成员",
                                    )
                                  : memberSearchOptions.map((option, index) => {
                                      const previous =
                                        memberSearchOptions[index - 1];
                                      const showGroup =
                                        previous?.kind !== option.kind;
                                      const optionId = `pmproj-member-option-${option.kind}-${option.candidate.id}`;
                                      return h(
                                        Fragment,
                                        {
                                          key: `${option.kind}:${option.candidate.id}`,
                                        },
                                        showGroup
                                          ? h(
                                              "span",
                                              {
                                                className:
                                                  "pmproj-member-result-group",
                                              },
                                              option.kind === "human"
                                                ? "人类用户"
                                                : "AI 伙伴",
                                            )
                                          : null,
                                        h(
                                          "button",
                                          {
                                            id: optionId,
                                            role: "option",
                                            type: "button",
                                            "aria-selected":
                                              index === memberSearchActiveIndex,
                                            className: `pmproj-member-result ${
                                              index === memberSearchActiveIndex
                                                ? "active"
                                                : ""
                                            }`.trim(),
                                            onMouseDown: (event) =>
                                              event.preventDefault(),
                                            onClick: () =>
                                              selectMemberCandidate(
                                                option.kind,
                                                option.candidate,
                                              ),
                                          },
                                          h(
                                            "span",
                                            {
                                              className:
                                                "pmproj-member-result-copy",
                                            },
                                            h(
                                              "strong",
                                              null,
                                              option.candidate.name,
                                            ),
                                            h(
                                              "small",
                                              null,
                                              option.kind === "human"
                                                ? option.candidate.platformRole
                                                : option.candidate.kindLabel,
                                            ),
                                          ),
                                          h(
                                            "span",
                                            {
                                              className:
                                                "pmproj-member-result-kind",
                                            },
                                            option.kind === "human"
                                              ? "人类"
                                              : "AI",
                                          ),
                                        ),
                                      );
                                    }),
                          )
                        : null,
                    )
                  : h("input", {
                      value: member?.name ?? "",
                      disabled: true,
                    }),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "项目角色"),
                roleOptions.length === 0
                  ? h(
                      "select",
                      { value: "", disabled: true },
                      h("option", null, "暂无可用项目角色"),
                    )
                  : h(
                      "select",
                      {
                        value: memberModal.roleIds[0] ?? "",
                        onChange: (event) =>
                          setMemberModal({
                            ...memberModal,
                            roleIds:
                              event.target.value === ""
                                ? []
                                : [event.target.value],
                          }),
                      },
                      h("option", { value: "" }, "未分配"),
                      roleOptions.map((role) =>
                        h(
                          "option",
                          { key: role.id, value: role.id },
                          role.name,
                        ),
                      ),
                    ),
              ),
              memberModal.mode === "add" &&
                selectedKind === "agent" &&
                memberModal.roleIds.length === 0
                ? h(
                    "p",
                    { className: "pmproj-hint wide" },
                    "AI 伙伴需要选择项目角色后才能加入项目。",
                  )
                : null,
              selectedKind === "human"
                ? h(
                    "label",
                    { className: "pmproj-field" },
                    h("span", { className: "label" }, "工作区角色"),
                    h(
                      "select",
                      {
                        value: memberModal.workspaceRole ?? "member",
                        onChange: (event) =>
                          setMemberModal({
                            ...memberModal,
                            workspaceRole: event.target.value,
                          }),
                      },
                      h("option", { value: "owner" }, "负责人"),
                      h("option", { value: "member" }, "成员"),
                      h("option", { value: "guest" }, "访客"),
                    ),
                  )
                : null,
              selectedKind === "human"
                ? h(
                    "label",
                    { className: "pmproj-field" },
                    h("span", { className: "label" }, "加入时间"),
                    h("input", {
                      value:
                        member?.joinedAt === undefined
                          ? memberModal.mode === "add"
                            ? "保存后记录"
                            : "未知"
                          : new Date(member.joinedAt).toLocaleString("zh-CN", {
                              hour12: false,
                            }),
                      disabled: true,
                    }),
                  )
                : null,
              h(
                "label",
                { className: "pmproj-field wide" },
                h(
                  "span",
                  { className: "label" },
                  "授权范围（按项目角色只读汇总）",
                ),
                h("input", { value: memberModalScope, disabled: true }),
              ),
              h(
                "p",
                { className: "pmproj-hint wide" },
                "工作区角色只属于当前项目（工作区）成员关系，不是平台账号的全局角色；平台账号、平台角色与启停用状态仍只在平台设置中维护。",
              ),
              h(
                "div",
                { className: "pmproj-footer wide" },
                memberModal.mode === "edit" && canManage
                  ? h(
                      "button",
                      {
                        className: "pmproj-btn danger",
                        type: "button",
                        disabled: busy === "member",
                        onClick: () =>
                          void removeMember(
                            memberModal.memberKind,
                            memberModal.memberId,
                          ),
                      },
                      "移除成员",
                    )
                  : null,
                h(
                  "button",
                  {
                    className: "pmproj-btn secondary",
                    type: "button",
                    onClick: () => setMemberModal(null),
                  },
                  "取消",
                ),
                h(
                  "button",
                  {
                    className: "pmproj-btn",
                    type: "button",
                    disabled:
                      busy === "member" ||
                      (memberModal.mode === "add" &&
                        selectedKind === "agent" &&
                        memberModal.roleIds.length === 0),
                    onClick: () => void saveMember(),
                  },
                  memberModal.mode === "add" ? "添加成员" : "保存变更",
                ),
              ),
            ),
          ),
        );
      };

      const renderRoleModal = () => {
        if (roleModal === null || detail === null) return null;
        /**
         * 不依赖打开弹窗时缓存的 effective 标记：直接按当前有效集判断，
         * 避免旧数据/草稿状态导致“调整 / 新建”选择器不出现。
         */
        const isEffectiveRole =
          roleModal.mode === "edit" &&
          effectiveRoles.some(
            (role) =>
              roleCodeKey(role) ===
              roleCodeKey({ code: roleModal.originalCode || roleModal.code }),
          );
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h(
                "h2",
                null,
                roleModal.copyMode
                  ? "创建新角色"
                  : roleModal.mode === "add"
                    ? "添加项目角色"
                    : "编辑项目角色",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setRoleModal(null),
                },
                "关闭",
              ),
            ),
            h(
              "div",
              { className: "pmproj-form-grid" },
              roleModal.mode === "add"
                ? h(
                    "label",
                    { className: "pmproj-field wide" },
                    h("span", { className: "label" }, "从角色库预填（可选）"),
                    h(
                      "select",
                      {
                        value: roleModal.prefillId,
                        onChange: (event) => prefillRole(event.target.value),
                      },
                      h("option", { value: "" }, "从空白开始…"),
                      (detail.roleLibrary ?? []).map((role) =>
                        h(
                          "option",
                          { key: role.id, value: role.id },
                          `${role.name} · ${role.category}`,
                        ),
                      ),
                    ),
                  )
                : null,
              isEffectiveRole
                ? h(
                    "div",
                    { className: "pmproj-field wide" },
                    h("span", { className: "label" }, "保存方式"),
                    h(
                      "div",
                      { className: "pmproj-checkboxes" },
                      h(
                        "label",
                        { className: "pmproj-checkbox" },
                        h("input", {
                          type: "radio",
                          name: "roleSaveMode",
                          checked: !roleModal.copyMode,
                          onChange: () => switchRoleCopyMode(false),
                        }),
                        h("span", null, "调整原有角色"),
                      ),
                      h(
                        "label",
                        { className: "pmproj-checkbox" },
                        h("input", {
                          type: "radio",
                          name: "roleSaveMode",
                          checked: roleModal.copyMode,
                          onChange: () => switchRoleCopyMode(true),
                        }),
                        h("span", null, "创建新角色"),
                      ),
                    ),
                    h(
                      "p",
                      { className: "pmproj-hint" },
                      roleModal.copyMode
                        ? "将另存为新的项目角色，系统自动生成新的角色标识，原角色保持不变。"
                        : "修改会更新当前角色；角色标识保持不变，上下游引用不受影响。",
                    ),
                  )
                : null,
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "角色名称"),
                h("input", {
                  value: roleModal.name,
                  onChange: (event) =>
                    setRoleModal({ ...roleModal, name: event.target.value }),
                }),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "角色标识"),
                h("input", {
                  value: roleModal.code,
                  readOnly:
                    roleModal.copyMode ||
                    (roleModal.mode === "edit" && isEffectiveRole),
                  title: roleModal.copyMode
                    ? "系统自动生成的新角色标识"
                    : roleModal.mode === "edit" && isEffectiveRole
                      ? "角色标识是上下游业务键，创建后不可修改"
                      : undefined,
                  onChange: (event) =>
                    setRoleModal({ ...roleModal, code: event.target.value }),
                }),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "角色分类"),
                h(
                  "select",
                  {
                    value: roleModal.category,
                    onChange: (event) =>
                      setRoleModal({
                        ...roleModal,
                        category: event.target.value,
                      }),
                  },
                  ROLE_CATEGORIES.map((category) =>
                    h("option", { key: category, value: category }, category),
                  ),
                ),
              ),
              h(
                "label",
                { className: "pmproj-field" },
                h("span", { className: "label" }, "使用场景"),
                h("input", { value: "任务指派 · 工作流流转", disabled: true }),
              ),
              h(
                "div",
                { className: "pmproj-field wide" },
                h("span", { className: "label" }, "角色权限（授权范围的来源）"),
                h(
                  "div",
                  { className: "pmproj-checkboxes" },
                  PERMISSION_OPTIONS.map((option) =>
                    h(
                      "label",
                      { key: option.key, className: "pmproj-checkbox" },
                      h("input", {
                        type: "checkbox",
                        checked: roleModal.permissions.includes(option.key),
                        onChange: (event) => {
                          const next = new Set(roleModal.permissions);
                          if (event.target.checked) next.add(option.key);
                          else next.delete(option.key);
                          setRoleModal({
                            ...roleModal,
                            permissions: [...next],
                          });
                        },
                      }),
                      h("span", null, option.label),
                    ),
                  ),
                ),
              ),
              h(
                "label",
                { className: "pmproj-field wide" },
                h("span", { className: "label" }, "角色说明"),
                h("textarea", {
                  value: roleModal.description,
                  onChange: (event) =>
                    setRoleModal({
                      ...roleModal,
                      description: event.target.value,
                    }),
                }),
              ),
              h(
                "p",
                { className: "pmproj-hint wide" },
                "该角色只属于本项目；修改或删除不会影响项目模版、全局角色库或其他项目。删除角色会同时释放该角色的成员指派。",
              ),
              h(
                "div",
                { className: "pmproj-footer wide" },
                roleModal.mode === "edit" && !roleModal.copyMode
                  ? h(
                      "button",
                      {
                        className: "pmproj-btn danger",
                        type: "button",
                        disabled: busy === "role",
                        onClick: () => void deleteRoleModal(),
                      },
                      "删除角色",
                    )
                  : null,
                h(
                  "button",
                  {
                    className: "pmproj-btn secondary",
                    type: "button",
                    onClick: () => setRoleModal(null),
                  },
                  "取消",
                ),
                h(
                  "button",
                  {
                    className: "pmproj-btn",
                    type: "button",
                    disabled: busy === "role",
                    onClick: () => void saveRoleModal(),
                  },
                  "保存角色",
                ),
              ),
            ),
          ),
        );
      };

      const renderRoleSourcesModal = () => {
        if (!roleSourcesOpen) return null;
        const source =
          roleSources.find((item) => item.workspaceId === roleSourceId) ?? null;
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "复用其他项目的角色"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setRoleSourcesOpen(false),
                },
                "关闭",
              ),
            ),
            roleSourcesLoading
              ? h("div", { className: "pmproj-loading" }, "正在加载可复用项目…")
              : roleSources.length === 0
                ? h(
                    "div",
                    { className: "pmproj-empty" },
                    "暂无可复用的项目角色。请确认其他项目已有角色，并且你有访问权限。",
                  )
                : h(
                    Fragment,
                    null,
                    h(
                      "div",
                      { className: "pmproj-form-grid" },
                      h(
                        "label",
                        { className: "pmproj-field wide" },
                        h("span", { className: "label" }, "来源项目"),
                        h(
                          "select",
                          {
                            value: roleSourceId,
                            onChange: (event) =>
                              selectRoleSource(event.target.value),
                          },
                          roleSources.map((item) =>
                            h(
                              "option",
                              {
                                key: item.workspaceId,
                                value: item.workspaceId,
                              },
                              `${item.name} · ${item.roles.length} 角色`,
                            ),
                          ),
                        ),
                      ),
                      source === null
                        ? null
                        : h(
                            "div",
                            { className: "pmproj-field wide" },
                            h(
                              "span",
                              { className: "label" },
                              "选择要复用的角色",
                            ),
                            h(
                              "div",
                              { className: "pmproj-checkboxes" },
                              source.roles.map((role) =>
                                h(
                                  "label",
                                  {
                                    key: role.id,
                                    className: "pmproj-checkbox",
                                  },
                                  h("input", {
                                    type: "checkbox",
                                    checked: roleSourceRoleIds.includes(
                                      role.id,
                                    ),
                                    onChange: (event) => {
                                      const next = new Set(roleSourceRoleIds);
                                      if (event.target.checked)
                                        next.add(role.id);
                                      else next.delete(role.id);
                                      setRoleSourceRoleIds([...next]);
                                    },
                                  }),
                                  h("span", null, role.name),
                                ),
                              ),
                            ),
                          ),
                    ),
                    h(
                      "p",
                      { className: "pmproj-hint" },
                      "角色会以副本形式合并进当前项目；id 或标识重复的角色会自动跳过。来源项目不受影响。",
                    ),
                    h(
                      "div",
                      { className: "pmproj-footer" },
                      h(
                        "button",
                        {
                          className: "pmproj-btn secondary",
                          type: "button",
                          onClick: () => setRoleSourcesOpen(false),
                        },
                        "取消",
                      ),
                      h(
                        "button",
                        {
                          className: "pmproj-btn",
                          type: "button",
                          disabled:
                            busy === "import" ||
                            roleSourceId === "" ||
                            roleSourceRoleIds.length === 0,
                          onClick: () => void importSourceRoles(),
                        },
                        `引入所选角色（${roleSourceRoleIds.length}）`,
                      ),
                    ),
                  ),
          ),
        );
      };

      const renderTemplateLoadModal = () => {
        if (!templateLoadOpen) return null;
        const templates = detail?.templates ?? [];
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "从模版加载项目角色"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setTemplateLoadOpen(false),
                },
                "关闭",
              ),
            ),
            h(
              "p",
              { className: "pmproj-hint" },
              "选择后会替换当前角色草稿；在点「确认生效」前，不会影响已生效角色与成员指派。",
            ),
            templates.length === 0
              ? h(
                  "div",
                  { className: "pmproj-empty" },
                  "还没有可用的项目模版。",
                )
              : h(
                  "div",
                  { className: "pmproj-items" },
                  templates
                    .filter((template) => template.status === "启用")
                    .map((template) =>
                      h(
                        "button",
                        {
                          key: template.id,
                          className: "pmproj-list-item",
                          type: "button",
                          onClick: () => loadTemplateToDraft(template.id),
                        },
                        h(
                          "span",
                          { className: "pmproj-list-mark" },
                          initials(template.name),
                        ),
                        h(
                          "span",
                          { className: "pmproj-list-copy" },
                          h("strong", null, template.name),
                          h(
                            "small",
                            null,
                            `${template.type} · ${template.roleIds.length} 个角色`,
                          ),
                        ),
                        h(Pill, null, "加载"),
                      ),
                    ),
                ),
            h(
              "div",
              { className: "pmproj-footer" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary",
                  type: "button",
                  onClick: () => setTemplateLoadOpen(false),
                },
                "取消",
              ),
            ),
          ),
        );
      };

      const renderMemberImpactModal = () => {
        if (memberImpact === null) return null;
        const impacts = memberImpact.impacts ?? [];
        const removedRoles = memberImpact.removedRoles ?? [];
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "确认删除项目角色"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setMemberImpact(null),
                },
                "关闭",
              ),
            ),
            h(
              "p",
              { className: "pmproj-hint" },
              `本次将移除 ${removedRoles.length} 个角色；以下成员在这些角色上的项目角色会被清空，成员仍保留在项目中。`,
            ),
            h(
              "div",
              { className: "pmproj-items" },
              impacts.map((impact) =>
                h(
                  "div",
                  {
                    className: "pmproj-item",
                    key: `${impact.memberKind}:${impact.memberId}`,
                  },
                  h(
                    "div",
                    { className: "pmproj-item-main" },
                    h(
                      "div",
                      { className: "pmproj-item-title" },
                      h("strong", null, impact.memberName),
                    ),
                    h(
                      "div",
                      { className: "pmproj-item-meta" },
                      h(
                        "span",
                        null,
                        impact.memberKind === "agent" ? "AI伙伴" : "人员",
                      ),
                      h(
                        "span",
                        null,
                        `将清空：${impact.roles
                          .map((role) => role.roleName)
                          .join("、")}`,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            h(
              "div",
              { className: "pmproj-footer" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary",
                  type: "button",
                  onClick: () => setMemberImpact(null),
                },
                "取消",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn danger",
                  type: "button",
                  disabled: busy === "role-confirm",
                  onClick: () => {
                    setMemberImpact(null);
                    void confirmRoleDraft(true);
                  },
                },
                "确认删除并生效",
              ),
            ),
          ),
        );
      };

      const renderWorkflowBlockModal = () => {
        if (workflowBlock === null) return null;
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "角色不能下线"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setWorkflowBlock(null),
                },
                "关闭",
              ),
            ),
            h(
              "p",
              { className: "pmproj-hint" },
              "以下角色仍被项目已加载的工作流模版引用。请先在工作流模版管理中失效或编辑对应模版，再回来确认。",
            ),
            h(
              "div",
              { className: "pmproj-items" },
              workflowBlock.map((block, index) =>
                h(
                  "div",
                  {
                    className: "pmproj-item",
                    key: `${block.templateId}:${block.nodeId}:${index}`,
                  },
                  h(
                    "div",
                    { className: "pmproj-item-main" },
                    h(
                      "div",
                      { className: "pmproj-item-title" },
                      h("strong", null, block.templateName),
                    ),
                    h(
                      "div",
                      { className: "pmproj-item-meta" },
                      h("span", null, `节点：${block.nodeName}`),
                      h(
                        "span",
                        null,
                        `角色：${block.roleName}${block.roleCode ? `（${block.roleCode}）` : ""}`,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            h(
              "div",
              { className: "pmproj-footer" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary",
                  type: "button",
                  onClick: () => setWorkflowBlock(null),
                },
                "知道了",
              ),
            ),
          ),
        );
      };

      const renderDraftGuardModal = () => {
        if (draftGuard === null) return null;
        const message =
          draftGuard.kind === "switch"
            ? "当前项目有尚未应用的设置草稿，切换项目会丢弃草稿。"
            : draftGuard.kind === "edit-close"
              ? "当前项目有尚未应用的设置草稿，关闭项目设置会丢弃草稿。"
              : draftGuard.kind === "edit-tab"
                ? "当前页签有尚未应用的修改，切换页签会丢弃这些修改。"
                : `加载模版「${draftGuard.templateName || "所选模版"}」会覆盖当前角色草稿。`;
        return h(
          "div",
          { className: "pmproj-modal-mask open" },
          h(
            "div",
            { className: "pmproj-modal", role: "dialog", "aria-modal": "true" },
            h(
              "div",
              { className: "pmproj-modal-head" },
              h("h2", null, "放弃未应用修改？"),
              h(
                "button",
                {
                  className: "pmproj-btn secondary small",
                  type: "button",
                  onClick: () => setDraftGuard(null),
                },
                "关闭",
              ),
            ),
            h("p", { className: "pmproj-hint" }, message),
            h(
              "div",
              { className: "pmproj-footer" },
              h(
                "button",
                {
                  className: "pmproj-btn secondary",
                  type: "button",
                  onClick: () => setDraftGuard(null),
                },
                "继续编辑",
              ),
              h(
                "button",
                {
                  className: "pmproj-btn danger",
                  type: "button",
                  onClick: () => resolveDraftGuard(true),
                },
                draftGuard.kind === "template"
                  ? "放弃草稿并加载模版"
                  : draftGuard.kind === "edit-close"
                    ? "放弃草稿并关闭"
                    : draftGuard.kind === "edit-tab"
                      ? "放弃草稿并切换"
                      : "放弃草稿并继续",
              ),
            ),
          ),
        );
      };

      if (view === "templates") {
        return h(
          "section",
          { className: "pmproj", "data-page": "projects" },
          h("style", null, styles),
          renderError(),
          renderTemplateView(),
        );
      }

      return h(
        "section",
        {
          className: "pmproj",
          "data-page": "projects",
          "data-workspace-id": selectedProject?.workspaceId ?? "",
          "data-data-agent-title": selectedProject?.name ?? "项目",
        },
        h("style", null, styles),
        h(
          "div",
          { className: "pmproj-head" },
          h("div", null, h("h1", null, "项目")),
          h(
            "div",
            { className: "pmproj-head-actions" },
            viewer?.role === "admin"
              ? h(
                  "button",
                  {
                    className: "pmproj-btn secondary",
                    type: "button",
                    "aria-pressed": "false",
                    onClick: openTemplateView,
                  },
                  "项目模版",
                )
              : null,
            h(
              "button",
              {
                className: "pmproj-btn",
                type: "button",
                onClick: () => setCreateOpen(true),
              },
              "新建项目",
            ),
            props.renderActions?.() ?? null,
          ),
        ),
        renderError(),
        phase === "loading"
          ? h("div", { className: "pmproj-loading" }, "正在加载项目…")
          : h(
              "div",
              {
                className: `pmproj-layout${
                  directoryCollapsed ? " collapsed" : ""
                }`,
              },
              renderProjectList(),
              h(
                "main",
                {
                  className: "pmproj-detail",
                  "aria-label": "项目详情",
                  "data-workspace-id": selectedProject?.workspaceId ?? "",
                  "data-data-agent-text-surface": "project",
                  "data-data-agent-title": selectedProject?.name ?? "项目",
                },
                renderDetail(),
              ),
            ),
        renderCreateModal(),
        renderReportScheduleModal(),
        renderLeaveModal(),
        renderEditModal(),
        renderProjectTemplateSaveModal(),
        renderMemberModal(),
        renderRoleModal(),
        renderRoleSourcesModal(),
        renderTemplateLoadModal(),
        renderMemberImpactModal(),
        renderWorkflowBlockModal(),
        renderDraftGuardModal(),
      );
    }

    exports.__test = {
      statusTone,
      priorityLabel,
      permissionLabels,
      platformUserOptionLabel,
      memberScopeForRoles,
      groupMembersByProjectRole,
      workspaceRoleLabel,
      resolveMemberPoolStuck,
      filterMemberDirectoryLocally,
      isProjectOwner,
      compactWorkspacePath,
      auditCategoryLabel,
      auditMatches,
      projectMatches,
      sortProjectTasks,
      preferredProgressWorkflow,
      clampProgressZoom,
      nextProgressZoom,
      progressNodeStatusLabel,
      progressNodeTone,
      progressNodeIsAnomaly,
      progressTaskAnomaly,
      normalizeBusinessChainBindings,
      missingBusinessChainRoleMembers,
      businessChainConfigToMarkdown,
      buildProgressChangeEvents,
      formatProgressChangeEvent,
      buildProgressOverview,
      progressRevisedText,
      resolveProgressSelection,
      projectReportProgress,
      formatProjectUpdatedAt,
      applyProgressDemoData,
      applyProjectRoleMembers,
      outputMatches,
      groupOutputsByDay,
      formatFileSize,
      outputLoadErrorMessage,
      normalizeReportSchedule,
      reportScheduleSummary,
      normalizeReportMarkdown,
      parseReportBlocks,
      roleCodeKey,
      roleFieldsDiffer,
      computeRoleDiff,
      nextRoleCopyCode,
      openTask,
      openWorkflow,
    };

    exports.inject = ["slots"];
    exports.apply = (ctx) => {
      clientCtx = ctx;
      ctx.slots.inject("pluginmax.global", () =>
        ctx.slots.register(
          {
            name: "pluginmax.global",
            id: "pluginmax-project",
            order: 32,
            children: {
              "pluginmax.project.settings.other": {
                kind: "single",
                scope: "root",
              },
            },
          },
          ProjectGlobalPage,
        ),
      );
    };

    return module.exports;
  },
});
