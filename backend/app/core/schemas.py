from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Difficulty = Literal["beginner", "intermediate", "advanced"]
JobStatus = Literal["running", "done", "error"]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)


class Bi(ApiModel):
    zh: str
    en: str


class Diagram(ApiModel):
    kind: Literal["mermaid"]
    caption: Bi
    diagram: str


class SpineArtifact(ApiModel):
    lessonId: str
    path: str
    language: str
    code: str
    runCmd: str | None = None
    addedLines: list[int] | None = None
    prevLessonId: str | None = None


class LessonBadges(ApiModel):
    loc: int
    difficulty: Difficulty
    concepts: list[str]


class TryIt(ApiModel):
    setup: list[Bi] | None = None
    commands: list[Bi]
    observe: list[Bi]


class Reference(ApiModel):
    title: str
    url: str
    kind: Literal["official", "spec", "paper", "blog", "other"] | None = None
    whyUsed: Bi | None = None


class SourceCompareGap(ApiModel):
    dimension: Bi
    simplified: Bi
    real: Bi
    whySimplified: Bi


class SourceCompare(ApiModel):
    simplified: Bi | None = None
    real: Bi | None = None
    gaps: list[SourceCompareGap]


class CodeBlock(ApiModel):
    file: str
    language: str
    snippet: str
    highlightLines: list[int]
    before: str | None = None
    isSpine: bool | None = None
    symbol: str | None = None


class HowItWorksStep(ApiModel):
    title: Bi
    desc: Bi
    code: CodeBlock | None = None
    beforeCode: CodeBlock | None = None
    anatomy: Bi | None = None


class CompareRow(ApiModel):
    label: Bi
    a: str
    b: str


class Compare(ApiModel):
    rows: list[CompareRow]


class ZhDiagram(ApiModel):
    kind: Literal["mermaid"]
    caption: str
    diagram: str


class ZhTryIt(ApiModel):
    setup: list[str] | None = None
    commands: list[str]
    observe: list[str]


class ZhReference(ApiModel):
    title: str
    url: str
    kind: Literal["official", "spec", "paper", "blog", "other"] | None = None
    whyUsed: str | None = None


class ZhSourceCompareGap(ApiModel):
    dimension: str
    simplified: str
    real: str
    whySimplified: str


class ZhSourceCompare(ApiModel):
    simplified: str | None = None
    real: str | None = None
    gaps: list[ZhSourceCompareGap]


class ZhCodeBlock(ApiModel):
    file: str
    language: str
    snippet: str
    highlightLines: list[int]
    before: str | None = None
    isSpine: bool | None = None
    symbol: str | None = None


class ZhHowItWorksStep(ApiModel):
    title: str
    desc: str
    code: ZhCodeBlock | None = None
    beforeCode: ZhCodeBlock | None = None
    anatomy: str | None = None


class ZhCompareRow(ApiModel):
    label: str
    a: str
    b: str


class ZhCompare(ApiModel):
    rows: list[ZhCompareRow]


class OutlineLesson(ApiModel):
    id: str
    title: Bi
    difficulty: Difficulty
    theProblem: Bi
    objective: Bi
    mechanism: Bi | None = None
    whyNow: Bi | None = None
    missingBefore: Bi | None = None
    nextPressure: Bi | None = None
    keyFiles: list[str]
    prereq: list[str]
    tags: list[str]


class OutlineSection(ApiModel):
    id: str
    title: Bi
    summary: Bi
    spine: Bi | None = None
    role: Bi | None = None
    transitionIn: Bi | None = None
    transitionOut: Bi | None = None
    lessons: list[OutlineLesson]


class RepoInfo(ApiModel):
    url: str
    name: str
    sha: str


class CourseInfo(ApiModel):
    title: Bi
    tagline: Bi
    repo: RepoInfo
    spine: Bi | None = None
    thesis: Bi | None = None
    audience: Bi | None = None
    whyThisOrder: Bi | None = None


class Outline(ApiModel):
    course: CourseInfo
    archDiagram: Diagram | None = None
    sections: list[OutlineSection] = Field(default_factory=list)
    lessons: list[OutlineLesson] = Field(default_factory=list)


class Lesson(ApiModel):
    id: str
    principle: Bi | None = None
    teachingScope: Bi | None = None
    problem: Bi
    solution: Bi | None = None
    diagram: Diagram | None = None
    spine: SpineArtifact | None = None
    howItWorks: list[HowItWorksStep]
    deepDive: Bi
    deepSource: Bi | None = None
    sourceCompare: SourceCompare | None = None
    tryIt: TryIt | None = None
    whatsNext: Bi | None = None
    references: list[Reference]
    compare: Compare
    loc: int
    badges: LessonBadges | None = None
    status: Literal["ok", "failed"] = "ok"
    error: str | None = None


class Course(ApiModel):
    outline: Outline
    lessons: dict[str, Lesson]


class ZhOutlineLesson(ApiModel):
    id: str
    title: str
    difficulty: Difficulty
    theProblem: str
    objective: str
    mechanism: str | None = None
    whyNow: str | None = None
    missingBefore: str | None = None
    nextPressure: str | None = None
    filesToRead: list[str] = Field(default_factory=list)
    prereq: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class ZhOutlineSection(ApiModel):
    id: str
    title: str
    summary: str
    spine: str | None = None
    role: str | None = None
    transitionIn: str | None = None
    transitionOut: str | None = None
    lessons: list[ZhOutlineLesson]


class ZhCourseInfo(ApiModel):
    title: str
    tagline: str
    repo: RepoInfo
    spine: str | None = None
    thesis: str | None = None
    audience: str | None = None
    whyThisOrder: str | None = None


class ZhOutline(ApiModel):
    course: ZhCourseInfo
    archDiagram: ZhDiagram | None = None
    sections: list[ZhOutlineSection] = Field(default_factory=list)
    lessons: list[ZhOutlineLesson] = Field(default_factory=list)


class ZhLesson(ApiModel):
    id: str
    principle: str | None = None
    teachingScope: str | None = None
    problem: str
    solution: str | None = None
    diagram: ZhDiagram | None = None
    spine: SpineArtifact | None = None
    howItWorks: list[ZhHowItWorksStep]
    deepDive: str
    deepSource: str | None = None
    sourceCompare: ZhSourceCompare | None = None
    tryIt: ZhTryIt | None = None
    whatsNext: str | None = None
    references: list[ZhReference]
    compare: ZhCompare
    loc: int
    badges: LessonBadges | None = None
    filesUsed: list[str] = Field(default_factory=list)
    status: Literal["ok", "failed"] = "ok"
    error: str | None = None


class CourseMeta(ApiModel):
    repoId: str
    url: str
    name: str
    title: str
    createdAt: str
    lessonCount: int


class JobRecord(ApiModel):
    id: str
    repoUrl: str
    repoId: str
    status: JobStatus
    stage: str
    lessonsDone: int
    lessonsTotal: int
    repoTitle: str | None = None
    error: str | None = None
    startedAt: int
    updatedAt: int


class PlanLesson(ApiModel):
    id: str
    title: Bi
    difficulty: Difficulty


class StageEvent(ApiModel):
    type: Literal["stage"]
    stage: Literal[
        "queued",
        "ingest",
        "analyze",
        "curriculum",
        "spine",
        "lessons",
        "validate1",
        "validate2",
        "translate",
        "render",
        "done",
    ]
    label: str | None = None


class PlanEvent(ApiModel):
    type: Literal["plan"]
    total: int
    lessons: list[PlanLesson]


class LessonEvent(ApiModel):
    type: Literal["lesson"]
    id: str
    status: Literal["start", "ok", "failed"]
    label: str | None = None


class SpineEvent(ApiModel):
    type: Literal["spine"]
    id: str
    status: Literal["start", "ok", "failed"]
    label: str | None = None


class ValidationEvent(ApiModel):
    type: Literal["validation"]
    round: Literal[1, 2]
    passed: bool
    issueCount: int


class LogEvent(ApiModel):
    type: Literal["log"]
    level: Literal["info", "warn", "error"]
    message: str


class LessonDraftEvent(ApiModel):
    type: Literal["lessonDraft"]
    id: str
    body: Any


class ErrorEvent(ApiModel):
    type: Literal["error"]
    message: str


ProgressEvent = (
    StageEvent
    | PlanEvent
    | LessonEvent
    | SpineEvent
    | ValidationEvent
    | LogEvent
    | LessonDraftEvent
    | ErrorEvent
)


class JobState(JobRecord):
    events: list[dict[str, Any]] = Field(default_factory=list)


class GenerateRequest(ApiModel):
    repoUrl: str | None = None
