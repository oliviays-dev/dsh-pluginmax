export type DispatchCandidateStatus = "ready" | "risk" | "blocker";
export type DispatchAssigneeKind = "human" | "agent";

export interface DispatchTaskLike {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly type?: string | undefined;
  readonly description?: string | undefined;
  readonly acceptance?: readonly string[] | undefined;
  readonly status: string;
  readonly priority: string;
  readonly receiverType: string;
  readonly receiverId?: string | undefined;
  readonly queueState?: "idle" | "blocked" | "paused" | undefined;
  readonly workflow?: unknown;
  readonly executionPolicy?: unknown;
  readonly updatedAt?: string | undefined;
  readonly archivedAt?: string | undefined;
  readonly needsInput?: boolean | undefined;
}

export interface DispatchSkillLike {
  readonly id: string;
  readonly name: string;
  readonly triggers?: readonly string[] | undefined;
  readonly scenes?: readonly string[] | undefined;
}

export interface DispatchTeammateProfile {
  readonly id: string;
  readonly kind: DispatchAssigneeKind;
  readonly name: string;
  readonly role: string;
  readonly roleGroup?: string | undefined;
  readonly ownerName: string;
  readonly ownerUserId: string;
  readonly employeeId?: string | undefined;
  readonly avatar?: string | undefined;
  readonly source?: "personal" | "platform" | undefined;
  readonly roleSeatIds?: readonly string[] | undefined;
  readonly projectBound: boolean;
  readonly available: boolean;
  readonly availabilityReason?: string | undefined;
  readonly skills: readonly DispatchSkillLike[];
  readonly queue: {
    readonly planned: number;
    readonly running: number;
    readonly review: number;
    readonly blocked: number;
    readonly needsInput: number;
  };
  readonly successRate?: number | undefined;
  readonly experienceCount?: number | undefined;
}

export interface DispatchCandidate {
  readonly teammateId: string;
  readonly kind: DispatchAssigneeKind;
  readonly name: string;
  readonly role: string;
  readonly roleGroup?: string | undefined;
  readonly ownerName: string;
  readonly employeeId?: string | undefined;
  readonly avatar?: string | undefined;
  readonly source?: "personal" | "platform" | undefined;
  readonly roleSeatIds?: readonly string[] | undefined;
  readonly score: number;
  readonly status: DispatchCandidateStatus;
  readonly blockers: readonly string[];
  readonly risks: readonly string[];
  readonly matchedSkills: readonly string[];
  readonly signals: {
    readonly projectBound: boolean;
    readonly available: boolean;
    readonly skillEvidence: "matched" | "insufficient" | "not_applicable";
    readonly planned: number;
    readonly running: number;
    readonly review: number;
    readonly blocked: number;
    readonly needsInput: number;
    readonly successRate?: number | undefined;
    readonly experienceCount?: number | undefined;
  };
}

function normalizedText(value: string): string {
  return value
    .toLocaleLowerCase("zh-Hans-CN")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function cjkBigrams(value: string): Set<string> {
  const normalized = normalizedText(value);
  const chars = [...normalized];
  const result = new Set<string>();
  for (let index = 0; index < chars.length - 1; index += 1) {
    const pair = `${chars[index]}${chars[index + 1]}`;
    if (/^[\u4e00-\u9fff]{2}$/.test(pair)) result.add(pair);
  }
  return result;
}

function taskText(task: DispatchTaskLike): string {
  return [
    task.title,
    task.type,
    task.description,
    ...(task.acceptance ?? []),
    task.executionPolicy === undefined
      ? ""
      : JSON.stringify(task.executionPolicy),
  ]
    .filter((value) => value !== undefined && value !== "")
    .join("\n");
}

function skillEvidence(
  task: DispatchTaskLike,
  skills: readonly DispatchSkillLike[],
): { readonly score: number; readonly matched: readonly string[] } {
  const text = normalizedText(taskText(task));
  const textPairs = cjkBigrams(taskText(task));
  const matched: string[] = [];
  let score = 0;
  for (const skill of skills) {
    const name = normalizedText(skill.name);
    const triggers = (skill.triggers ?? []).map(normalizedText);
    const scenes = (skill.scenes ?? []).map(normalizedText);
    const exactName =
      name.length >= 2 && (text.includes(name) || name.includes(text));
    const exactTrigger = triggers.some(
      (trigger) =>
        trigger.length >= 2 &&
        (text.includes(trigger) || trigger.includes(text)),
    );
    const namePairs = cjkBigrams(skill.name);
    const overlap = [...namePairs].filter((pair) => textPairs.has(pair)).length;
    const overlapRatio = namePairs.size === 0 ? 0 : overlap / namePairs.size;
    const sceneMatch = scenes.some(
      (scene) =>
        scene.length >= 2 && (text.includes(scene) || scene.includes(text)),
    );
    if (exactName) {
      score += 28;
      matched.push(skill.name);
    } else if (exactTrigger || overlapRatio >= 0.34 || sceneMatch) {
      score += 20;
      matched.push(skill.name);
    }
  }
  return {
    score: Math.min(35, score),
    matched: [...new Set(matched)].slice(0, 5),
  };
}

function queueScore(input: {
  readonly running: number;
  readonly planned: number;
  readonly blocked: number;
  readonly needsInput: number;
}): number {
  let score = 20;
  score -= Math.min(8, input.running * 6);
  score -= Math.min(8, input.planned * 2);
  score -= Math.min(8, input.blocked * 4);
  score -= Math.min(6, input.needsInput * 3);
  return Math.max(0, score);
}

export function evaluateTaskForTeammate(
  task: DispatchTaskLike,
  profile: DispatchTeammateProfile,
): DispatchCandidate {
  const isHuman = profile.kind === "human";
  const evidence = isHuman
    ? { score: 20, matched: [] as string[] }
    : skillEvidence(task, profile.skills);
  const blockers: string[] = [];
  const risks: string[] = [];

  if (task.status !== "todo") {
    blockers.push("任务当前不在待启动状态");
  }
  if (task.workflow !== undefined) {
    blockers.push("工作流任务由节点链路派发");
  }
  if (!profile.available) {
    blockers.push(
      profile.availabilityReason ??
        (isHuman ? "成员当前不可执行" : "AI伙伴当前不可执行"),
    );
  }
  if (!profile.projectBound) {
    risks.push(
      isHuman
        ? "成员不在当前项目范围，仅可人工确认后指派"
        : "AI伙伴未绑定当前项目，仅可人工确认后指派",
    );
  }
  if (!isHuman && evidence.matched.length === 0) {
    risks.push("缺少可直接验证的 Skill 证据");
  }
  if (profile.queue.running > 0) {
    risks.push(`当前已有 ${profile.queue.running} 个运行中任务`);
  }
  if (profile.queue.planned >= 3) {
    risks.push(`待启动队列已有 ${profile.queue.planned} 项`);
  }
  if (profile.queue.blocked > 0) {
    risks.push(`队列中存在 ${profile.queue.blocked} 项阻塞`);
  }
  if (profile.queue.needsInput > 0) {
    risks.push(`有 ${profile.queue.needsInput} 项等待人工补充`);
  }

  const status: DispatchCandidateStatus =
    blockers.length > 0 ? "blocker" : risks.length > 0 ? "risk" : "ready";
  let score =
    16 +
    evidence.score +
    (profile.projectBound ? 20 : 4) +
    (profile.available ? 18 : 0) +
    queueScore(profile.queue) +
    Math.round(Math.max(0, (profile.successRate ?? 80) - 80) / 4);
  if (status === "blocker") score = Math.min(score, 39);
  else if (status === "risk") score = Math.min(score, 79);
  score = Math.max(8, Math.min(99, score));

  return {
    teammateId: profile.id,
    kind: profile.kind,
    name: profile.name,
    role: profile.role,
    ...(profile.roleGroup === undefined
      ? {}
      : { roleGroup: profile.roleGroup }),
    ownerName: profile.ownerName,
    ...(profile.avatar === undefined ? {} : { avatar: profile.avatar }),
    ...(profile.source === undefined ? {} : { source: profile.source }),
    ...(profile.roleSeatIds === undefined
      ? {}
      : { roleSeatIds: profile.roleSeatIds }),
    ...(profile.employeeId === undefined
      ? {}
      : { employeeId: profile.employeeId }),
    score,
    status,
    blockers,
    risks,
    matchedSkills: evidence.matched,
    signals: {
      projectBound: profile.projectBound,
      available: profile.available,
      skillEvidence: isHuman
        ? "not_applicable"
        : evidence.matched.length > 0
          ? "matched"
          : "insufficient",
      planned: profile.queue.planned,
      running: profile.queue.running,
      review: profile.queue.review,
      blocked: profile.queue.blocked,
      needsInput: profile.queue.needsInput,
      ...(profile.successRate === undefined
        ? {}
        : { successRate: profile.successRate }),
      ...(profile.experienceCount === undefined
        ? {}
        : { experienceCount: profile.experienceCount }),
    },
  };
}

export function rankCandidates(
  task: DispatchTaskLike,
  profiles: readonly DispatchTeammateProfile[],
): DispatchCandidate[] {
  return profiles
    .map((profile) => evaluateTaskForTeammate(task, profile))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.name.localeCompare(right.name, "zh-Hans-CN"),
    );
}
