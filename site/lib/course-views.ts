import { pick } from "./content";
import type { Course, CourseGlobalView, CourseMode, Locale, OutlineLesson, ProjectArchetype } from "./types";

const DEFAULT_VIEWS: CourseGlobalView[] = ["timeline", "layers", "compare", "source-map", "practice-lab"];

export function getCourseViews(course: Course): CourseGlobalView[] {
  const views = course.outline.course.globalViews;
  return views?.length ? views : DEFAULT_VIEWS;
}

export function getCourseArchetype(course: Course): ProjectArchetype {
  if (course.outline.course.projectArchetype) return course.outline.course.projectArchetype;
  const haystack = [
    course.outline.course.repo.name,
    course.outline.course.title.en,
    course.outline.course.title.zh,
    ...course.outline.lessons.flatMap((l) => [l.title.en, l.title.zh, ...(l.tags ?? [])]),
  ].join(" ").toLowerCase();
  if (/(agent|claude|codex|tool_use|mcp|subagent|prompt)/.test(haystack)) return "agent";
  if (/(next|react|vue|svelte|page|component|route)/.test(haystack)) return "web-app";
  if (/(api|server|service|handler|controller|database|queue)/.test(haystack)) return "backend-service";
  if (/(cli|command|terminal|shell)/.test(haystack)) return "cli-tool";
  if (/(sdk|protocol|client|integration)/.test(haystack)) return "protocol-sdk";
  return "unknown";
}

export function getCourseModes(course: Course): CourseMode[] {
  const primary = course.outline.course.primaryMode;
  const secondary = course.outline.course.secondaryModes ?? [];
  if (primary) return [primary, ...secondary.filter((m) => m !== primary)];
  const archetype = getCourseArchetype(course);
  if (archetype === "agent" || archetype === "cli-tool") return ["progressive-builder", "source-walkthrough"];
  if (archetype === "web-app" || archetype === "backend-service") return ["runtime-trace", "source-walkthrough"];
  if (archetype === "library-framework" || archetype === "protocol-sdk") return ["architecture-map", "task-cookbook"];
  return ["source-walkthrough", "architecture-map"];
}

export function archetypeLabel(archetype: ProjectArchetype, locale: Locale): string {
  const labels: Record<ProjectArchetype, { zh: string; en: string }> = {
    agent: { zh: "Agent 系统", en: "Agent System" },
    "web-app": { zh: "Web 应用", en: "Web App" },
    "backend-service": { zh: "后端服务", en: "Backend Service" },
    "library-framework": { zh: "库/框架", en: "Library / Framework" },
    "cli-tool": { zh: "CLI 工具", en: "CLI Tool" },
    "data-ml-pipeline": { zh: "数据/ML 流水线", en: "Data / ML Pipeline" },
    "desktop-mobile-app": { zh: "桌面/移动应用", en: "Desktop / Mobile App" },
    "infra-operator": { zh: "基础设施控制器", en: "Infra Operator" },
    "protocol-sdk": { zh: "协议/SDK", en: "Protocol / SDK" },
    unknown: { zh: "通用项目", en: "General Project" },
  };
  return labels[archetype][locale];
}

export function modeLabel(mode: CourseMode, locale: Locale): string {
  const labels: Record<CourseMode, { zh: string; en: string }> = {
    "progressive-builder": { zh: "渐进构建", en: "Progressive Builder" },
    "source-walkthrough": { zh: "源码导览", en: "Source Walkthrough" },
    "architecture-map": { zh: "架构地图", en: "Architecture Map" },
    "task-cookbook": { zh: "任务手册", en: "Task Cookbook" },
    "runtime-trace": { zh: "运行链路", en: "Runtime Trace" },
    "production-ops": { zh: "生产运维", en: "Production Ops" },
  };
  return labels[mode][locale];
}

export function viewLabel(view: CourseGlobalView, locale: Locale): string {
  const labels: Record<CourseGlobalView, { zh: string; en: string }> = {
    timeline: { zh: "时间线", en: "Timeline" },
    layers: { zh: "分层", en: "Layers" },
    compare: { zh: "对比", en: "Compare" },
    "source-map": { zh: "源码地图", en: "Source Map" },
    "practice-lab": { zh: "练习室", en: "Practice Lab" },
  };
  return labels[view][locale];
}

export function getConceptInventory(course: Course, locale: Locale): string[] {
  const explicit = course.outline.course.conceptInventory?.map((c) => pick(c, locale)).filter(Boolean) ?? [];
  if (explicit.length) return explicit;
  const seen = new Set<string>();
  for (const lesson of course.outline.lessons) {
    const body = course.lessons[lesson.id];
    for (const value of [lesson.mechanism ? pick(lesson.mechanism, locale) : "", ...(lesson.tags ?? []), ...(body?.badges?.concepts ?? [])]) {
      const clean = value.trim();
      if (clean) seen.add(clean);
      if (seen.size >= 12) break;
    }
    if (seen.size >= 12) break;
  }
  return [...seen];
}

export function getLessonMetrics(course: Course, lesson: OutlineLesson) {
  const body = course.lessons[lesson.id];
  const sourceFiles = new Set<string>();
  for (const file of lesson.keyFiles ?? []) sourceFiles.add(file);
  for (const step of body?.howItWorks ?? []) {
    if (step.code?.file && step.code.isSpine !== true) sourceFiles.add(step.code.file);
  }
  return {
    loc: body?.badges?.loc ?? body?.loc ?? 0,
    concepts: body?.badges?.concepts ?? lesson.tags ?? [],
    sourceFiles: [...sourceFiles],
    hasRunnableSpine: Boolean(body?.spine?.runCmd),
    hasPractice: Boolean(body?.practice?.length || body?.tryIt?.commands?.length),
  };
}

export function collectSourceMap(course: Course) {
  const byFile = new Map<string, { file: string; lessons: OutlineLesson[]; symbols: string[] }>();
  for (const lesson of course.outline.lessons) {
    const body = course.lessons[lesson.id];
    const entries = [
      ...(lesson.keyFiles ?? []).map((file) => ({ file, symbol: "" })),
      ...(body?.howItWorks ?? [])
        .filter((step) => step.code?.file && step.code.isSpine !== true)
        .map((step) => ({ file: step.code!.file, symbol: step.code!.symbol ?? "" })),
    ];
    for (const entry of entries) {
      if (!entry.file) continue;
      const current = byFile.get(entry.file) ?? { file: entry.file, lessons: [], symbols: [] };
      if (!current.lessons.some((l) => l.id === lesson.id)) current.lessons.push(lesson);
      if (entry.symbol && !current.symbols.includes(entry.symbol)) current.symbols.push(entry.symbol);
      byFile.set(entry.file, current);
    }
  }
  return [...byFile.values()].sort((a, b) => b.lessons.length - a.lessons.length || a.file.localeCompare(b.file));
}
