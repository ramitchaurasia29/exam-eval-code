/*
 * Single in-memory store for the whole prototype. Every count, status and list on
 * every screen derives from this state, so actions on one screen show up everywhere.
 *
 * Use:  const { state, actions, me, role } = useStore();
 * Helpers: useStudent(id), useAssessment(id) and the selectors in ./selectors.
 *
 * A background simulation advances upload batches (page extraction -> barcode ->
 * segmentation -> mapping) and the evaluation queue (extracting -> mapping ->
 * evaluating -> calculating) roughly once per second.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AnswerSheet,
  Assessment,
  AuditEvent,
  Criterion,
  Distribution,
  Notification,
  Question,
  QuestionEval,
  Role,
  Settings,
  Student,
  Guardian,
  Suggestion,
  Toast,
  UnmatchedItem,
  UploadBatch,
  User,
} from "./types";
import {
  MODEL_VERSION,
  SETTINGS,
  STUDENTS,
  USERS,
  evaluate,
  generalFeedbackFor,
  hash,
  makeAssessments,
  makeToken,
  seedAudit,
  seedNotifications,
  seedSheets,
} from "./seed";
import { MATHS_9_QUESTIONS, SCIENCE_9_AI_KEY, SCIENCE_9_QUESTIONS, SST_8_QUESTIONS } from "./questions";
import { cohortOf, now, nowIso, sheetTotal, shortCodeOf } from "./selectors";
import { useScreenInit } from "../useScreenInit";

export interface State {
  userId: string;
  users: User[];
  students: Student[];
  assessments: Assessment[];
  sheets: AnswerSheet[];
  batches: UploadBatch[];
  unmatched: UnmatchedItem[];
  distributions: Distribution[];
  audit: AuditEvent[];
  notifications: Notification[];
  suggestions: Suggestion[];
  settings: Settings;
  queuePaused: boolean;
  toast: Toast | null;
}

export type Result = { ok: boolean; id?: string; error?: string };

export interface NewAssessmentInput {
  name: string;
  academicYear: string;
  grade: string;
  sections: string[];
  subject: string;
  type: string;
  examDate: string;
  totalMarks: number;
  durationMin?: number;
  instructions?: string;
  teacherIds?: string[];
}

export interface UploadInput {
  assessmentId: string;
  fileName: string;
  kind: "bulk" | "individual";
  sizeMb: number;
  /** bulk: which section's booklets the PDF contains */
  section?: string;
  /** individual: the student this PDF belongs to */
  studentId?: string;
}

let idSeq = 1;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(idSeq++).toString(36)}`;

function initialState(seedState: Record<string, unknown>): State {
  const assessments = makeAssessments();
  const { sheets, batches, unmatched, distributions } = seedSheets(assessments);
  const role = seedState.role as Role | undefined;
  let userId = (seedState.userId as string | undefined) ?? (role === "teacher" ? "u-meera" : undefined);
  if (!userId) {
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
    userId = path.startsWith("/teacher") || path.startsWith("/review") ? "u-meera" : "u-admin";
  }
  const s: State = {
    userId,
    users: USERS,
    students: STUDENTS,
    assessments,
    sheets,
    batches,
    unmatched,
    distributions,
    audit: seedAudit(),
    notifications: seedNotifications(),
    suggestions: [],
    settings: { ...SETTINGS },
    queuePaused: !!seedState.queuePaused,
    toast: null,
  };
  // Scenario hooks used by screens.figr.json states
  if (seedState.emptyWorkspace) {
    s.sheets = [];
    s.batches = [];
    s.unmatched = [];
    s.distributions = [];
  }
  if (seedState.allMapped) s.unmatched = s.unmatched.map((u) => ({ ...u, status: "resolved" as const }));
  if (seedState.liveBatch) {
    const a = s.assessments.find((x) => x.id === "asm-mat10-ut2")!;
    const booklets = cohortOf(a, s.students).filter((x) => x.section === "A").length;
    s.batches = [
      {
        id: "bt-live",
        assessmentId: a.id,
        fileName: "Class10_Maths_UT2_SecA.pdf",
        kind: "bulk",
        uploadedBy: "u-admin",
        uploadedAt: nowIso(),
        sizeMb: 72.4,
        pages: booklets * 6,
        booklets,
        stage: 2,
        progress: 40,
        status: "processing",
        mapped: 0,
        unmatched: 0,
        pageIssues: [{ page: 41, issue: "Skewed 4°, auto-corrected" }],
        section: "A",
      } as UploadBatch & { section: string },
      ...s.batches,
    ];
  }
  return s;
}

/* -------------------------------------------------------------------------- */

function useStoreImpl() {
  const seedState = useScreenInit();
  const [state, setState] = useState<State>(() => initialState(seedState));
  const ref = useRef(state);
  ref.current = state;

  const me = state.users.find((u) => u.id === state.userId)!;
  const role: Role = me.role;

  /* ---------- small helpers ---------- */
  const audit = (s: State, e: Omit<AuditEvent, "id" | "at" | "actorId"> & { actorId?: string }): AuditEvent[] => [
    { id: uid("au"), at: nowIso(), actorId: e.actorId ?? s.userId, ...e },
    ...s.audit,
  ];
  const notify = (s: State, n: Omit<Notification, "id" | "at" | "read">): Notification[] => [
    { id: uid("nt"), at: nowIso(), read: false, ...n },
    ...s.notifications,
  ];
  const studentName = (s: State, id: string) => s.students.find((x) => x.id === id)?.name ?? "Unknown student";
  const asmName = (s: State, id: string) => s.assessments.find((x) => x.id === id)?.name ?? "Exam";
  const patchAsm = (s: State, id: string, fn: (a: Assessment) => Assessment): Assessment[] =>
    s.assessments.map((a) => (a.id === id ? fn(a) : a));
  const patchSheet = (s: State, id: string, fn: (x: AnswerSheet) => AnswerSheet): AnswerSheet[] =>
    s.sheets.map((x) => (x.id === id ? fn(x) : x));

  const showToast = useCallback((message: string, opts?: { undo?: () => void; tone?: Toast["tone"] }) => {
    setState((s) => ({ ...s, toast: { id: uid("t"), message, ...opts } }));
  }, []);
  const dismissToast = useCallback(() => setState((s) => ({ ...s, toast: null })), []);

  /* ---------- simulation tick ---------- */
  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => {
        const working =
          s.batches.some((b) => b.status === "processing") ||
          (!s.queuePaused && s.sheets.some((x) => x.evaluation === "queued" || x.evaluation === "processing")) ||
          s.distributions.some((d) => d.status === "sending");
        if (!working) return s;
        let next: State = { ...s };

        // 1. Upload batches
        next.batches = s.batches.map((b) => {
          if (b.status !== "processing") return b;
          let progress = b.progress + (b.kind === "individual" ? 60 : 30);
          let stage = b.stage;
          if (progress >= 100) {
            stage += 1;
            progress = 0;
          }
          if (stage >= 5) {
            // Mapping finished: create sheets + unmatched items
            const a = next.assessments.find((x) => x.id === b.assessmentId)!;
            const existing = new Set(next.sheets.filter((x) => x.assessmentId === a.id).map((x) => x.studentId));
            const section = (b as UploadBatch & { section?: string }).section;
            let targets: Student[] = [];
            if (b.kind === "individual") {
              const sid = (b as UploadBatch & { studentId?: string }).studentId;
              targets = next.students.filter((x) => x.id === sid);
            } else {
              targets = cohortOf(a, next.students).filter((x) => (!section || x.section === section) && !existing.has(x.id));
            }
            const unreadable = b.kind === "bulk" ? targets.find((x) => x.roll === 5) : undefined;
            const created: AnswerSheet[] = targets
              .filter((x) => x !== unreadable)
              .map((st) => ({
                id: `as-${a.id.replace("asm-", "")}-${st.id.replace("st-", "")}`,
                assessmentId: a.id,
                studentId: st.id,
                batchId: b.id,
                pages: 6,
                blankPages: [],
                missingPages: [],
                evaluation: "queued",
                stage: 0,
                attempts: 0,
                verification: "not_started",
                teacherId: null,
                version: 1,
                questions: [],
                generalFeedback: "",
                rubricVersion: a.rubric.version,
                answerKeyVersion: a.answerKey.version,
                model: MODEL_VERSION,
              }));
            const newUnmatched: UnmatchedItem[] = unreadable
              ? [
                  {
                    id: uid("um"),
                    batchId: b.id,
                    assessmentId: a.id,
                    pagesFrom: (unreadable.roll - 1) * 6 + 1,
                    pagesTo: unreadable.roll * 6,
                    decoded: null,
                    reason: "unreadable_barcode",
                    coverName: unreadable.name,
                    coverRoll: String(unreadable.roll),
                    suggestedStudentId: unreadable.id,
                    status: "open",
                  },
                ]
              : [];
            next.sheets = [...next.sheets, ...created];
            next.unmatched = [...newUnmatched, ...next.unmatched];
            next.notifications = notify(next, {
              userId: "u-admin",
              title: `${b.fileName} processed`,
              body: `${created.length} booklets mapped${newUnmatched.length ? `, ${newUnmatched.length} need mapping` : ""}`,
              href: `/assessments/${b.assessmentId}/students`,
              kind: "system",
            });
            next.audit = audit(next, {
              actorId: "system",
              category: "upload",
              action: "Processed upload",
              target: b.fileName,
              detail: `${created.length} mapped · ${newUnmatched.length} unmatched`,
              href: `/assessments/${b.assessmentId}/students`,
            });
            return {
              ...b,
              stage: 5,
              progress: 100,
              status: newUnmatched.length ? "partial" : "completed",
              mapped: created.length,
              unmatched: newUnmatched.length,
            };
          }
          return { ...b, stage, progress };
        });

        // 2. Evaluation queue
        if (!next.queuePaused) {
          const capacity = next.settings.workers;
          let running = next.sheets.filter((x) => x.evaluation === "processing").length;
          const finished: AnswerSheet[] = [];
          next.sheets = next.sheets.map((x) => {
            if (x.evaluation === "processing") {
              if (x.stage >= 3) {
                const a = next.assessments.find((y) => y.id === x.assessmentId)!;
                const questions = evaluate(a.questions, x.studentId, x.pages, x.version * 7);
                const done: AnswerSheet = {
                  ...x,
                  evaluation: "evaluated",
                  stage: 4,
                  questions,
                  generalFeedback: generalFeedbackFor(questions, a.totalMarks),
                  rubricVersion: a.rubric.version,
                  answerKeyVersion: a.answerKey.version,
                  error: undefined,
                };
                finished.push(done);
                return done;
              }
              return { ...x, stage: x.stage + 1 };
            }
            if (x.evaluation === "queued" && running < capacity) {
              running++;
              return { ...x, evaluation: "processing", stage: 0, attempts: x.attempts + 1 };
            }
            return x;
          });
          // Notify assigned teachers when their batch finishes
          const byTeacher = new Map<string, number>();
          finished.forEach((f) => f.teacherId && byTeacher.set(f.teacherId, (byTeacher.get(f.teacherId) ?? 0) + 1));
          byTeacher.forEach((n, tid) => {
            next.notifications = notify(next, {
              userId: tid,
              title: "AI evaluation completed",
              body: `${n} ${n === 1 ? "copy is" : "copies are"} ready for your review`,
              href: "/teacher/pending",
              kind: "evaluated",
            });
          });
        }

        // 3. SMS deliveries
        next.distributions = next.distributions.map((d) => {
          if (d.status !== "sending") return d;
          const fail = hash(d.id + d.attempts) % 19 === 0;
          return { ...d, status: fail ? "failed" : "delivered", reason: fail ? "Number unreachable" : undefined };
        });
        return next;
      });
    }, 1100);
    return () => clearInterval(t);
  }, []);

  /* ---------- actions ---------- */
  const actions = useMemo(() => {
    const set = setState;

    /* session */
    const signIn = (userId: string) => set((s) => ({ ...s, userId, audit: audit({ ...s, userId }, { category: "access", action: "Signed in", target: s.users.find((u) => u.id === userId)?.name ?? "" }) }));
    const switchRole = (r: Role) => set((s) => ({ ...s, userId: r === "admin" ? "u-admin" : "u-meera" }));

    /* assessments */
    const createAssessment = (input: NewAssessmentInput): string => {
      const id = uid("asm");
      set((s) => {
        const a: Assessment = {
          id,
          ...input,
          ownerId: s.userId,
          teacherIds: input.teacherIds?.length ? input.teacherIds : s.users.find((u) => u.id === s.userId)?.role === "teacher" ? [s.userId] : [],
          paper: null,
          paperHistory: [],
          questionsConfirmed: false,
          answerKey: { mode: null, status: "none", version: 0 },
          rubric: { status: "none", version: 0 },
          questions: [],
        };
        return {
          ...s,
          assessments: [a, ...s.assessments],
          audit: audit(s, { category: "assessment", action: "Created exam", target: `${a.name} · Class ${a.grade}`, href: `/assessments/${id}` }),
        };
      });
      return id;
    };
    const updateAssessment = (id: string, patch: Partial<Assessment>) => set((s) => ({ ...s, assessments: patchAsm(s, id, (a) => ({ ...a, ...patch })) }));
    const archiveAssessment = (id: string, archived: boolean) => {
      set((s) => ({
        ...s,
        assessments: patchAsm(s, id, (a) => ({ ...a, archived })),
        audit: audit(s, { category: "assessment", action: archived ? "Archived exam" : "Restored exam", target: asmName(s, id) }),
      }));
    };

    /** Upload or replace the question paper; extraction runs and needs confirming again. */
    const uploadPaper = (id: string, fileName: string, pages: number, customQuestions?: Question[]): Result => {
      const a = ref.current.assessments.find((x) => x.id === id);
      if (!a) return { ok: false, error: "Exam not found" };
      if (ref.current.sheets.some((x) => x.assessmentId === id))
        return { ok: false, error: "Copies are already uploaded for this exam. The paper can't be replaced after evaluation starts." };
      set((s) => {
        const version = (a.paper?.version ?? 0) + 1;
        const pv = { version, fileName, pages, uploadedAt: nowIso(), uploadedBy: s.userId };
        let questions = customQuestions && customQuestions.length > 0 ? customQuestions : a.questions;
        if (questions.length === 0) {
          const tpl = a.subject === "Mathematics" ? MATHS_9_QUESTIONS : a.subject === "Science" ? SCIENCE_9_QUESTIONS : SST_8_QUESTIONS;
          questions = tpl.map((qq, i) => ({
            ...qq,
            id: `${id}-q${String(i + 1).padStart(2, "0")}`,
            answer: "",
            keyPoints: [],
            alternatives: [],
            steps: undefined,
            aiNote: undefined,
            answerApproved: false,
            criteria: [],
            variants: [],
            extractionIssue: i === 2 ? "Marks not found next to the question. AI assumed the value from the section heading." : undefined,
          }));
        }
        return {
          ...s,
          assessments: patchAsm(s, id, (x) => ({
            ...x,
            paper: pv,
            paperHistory: [...x.paperHistory, pv],
            questions,
            questionsConfirmed: false,
            answerKey: x.answerKey.status === "approved" ? { ...x.answerKey, status: "draft" } : x.answerKey,
            rubric: x.rubric.status === "approved" ? { ...x.rubric, status: "draft" } : x.rubric,
          })),
          audit: audit(s, {
            category: "assessment",
            action: a.paper ? `Replaced question paper (v${version})` : "Uploaded question paper",
            target: asmName(s, id),
            detail: fileName,
            href: `/assessments/${id}/setup/paper`,
          }),
        };
      });
      return { ok: true };
    };

    const updateQuestion = (aid: string, qid: string, patch: Partial<Question>) =>
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, questions: a.questions.map((qq) => (qq.id === qid ? { ...qq, ...patch } : qq)) })) }));
    const addQuestion = (aid: string) => {
      set((s) => ({
        ...s,
        assessments: patchAsm(s, aid, (a) => ({
          ...a,
          questions: [
            ...a.questions,
            { id: `${aid}-q${uid("n")}`, number: String(a.questions.length + 1), text: "", type: "short", marks: 1, page: a.paper?.pages ?? 1, answer: "", keyPoints: [], alternatives: [], answerApproved: false, criteria: [], variants: [] },
          ],
        })),
      }));
    };
    const removeQuestion = (aid: string, qid: string) =>
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, questions: a.questions.filter((qq) => qq.id !== qid) })) }));

    const confirmQuestions = (aid: string): Result => {
      const a = ref.current.assessments.find((x) => x.id === aid)!;
      if (!a.paper) return { ok: false, error: "Upload a question paper first" };
      if (a.questions.length === 0) return { ok: false, error: "Add at least one question" };
      const nums = a.questions.map((qq) => qq.number.trim());
      const dup = nums.find((n, i) => nums.indexOf(n) !== i);
      if (dup) return { ok: false, error: `Question number ${dup} is used twice. Each question needs a unique number.` };
      if (nums.some((n) => !n || n === "?")) return { ok: false, error: "Every question needs a number" };
      if (a.questions.some((qq) => !qq.text.trim())) return { ok: false, error: "Every question needs its text" };
      const sum = a.questions.reduce((t, qq) => t + qq.marks, 0);
      if (sum !== a.totalMarks) return { ok: false, error: `Question marks add up to ${sum}, but the exam total is ${a.totalMarks}. Fix the marks or the total.` };
      set((s) => ({
        ...s,
        assessments: patchAsm(s, aid, (x) => ({ ...x, questionsConfirmed: true, questions: x.questions.map((qq) => ({ ...qq, extractionIssue: undefined })) })),
        audit: audit(s, { category: "assessment", action: "Confirmed question structure", target: asmName(s, aid), detail: `${a.questions.length} questions · ${sum} marks` }),
      }));
      return { ok: true };
    };

    /* answer key */
    const generateAnswerKey = (aid: string) => {
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, answerKey: { ...a.answerKey, mode: "ai", status: "generating" } })) }));
      setTimeout(() => {
        set((s) => ({
          ...s,
          assessments: patchAsm(s, aid, (a) => ({
            ...a,
            answerKey: { ...a.answerKey, mode: "ai", status: "draft" },
            questions: a.questions.map((qq, i) => {
              const tpl = SCIENCE_9_AI_KEY[qq.id];
              if (tpl) return { ...qq, ...tpl, answerApproved: false };
              const base = SCIENCE_9_QUESTIONS[i % SCIENCE_9_QUESTIONS.length];
              const t2 = SCIENCE_9_AI_KEY[base.id];
              return {
                ...qq,
                answer: qq.answer || (t2 && a.subject === "Science" ? t2.answer : `Model answer for question ${qq.number}, covering the expected points for ${qq.marks} ${qq.marks === 1 ? "mark" : "marks"}.`),
                keyPoints: qq.keyPoints.length ? qq.keyPoints : t2?.keyPoints ?? [],
                aiNote: i === 3 ? "The question wording allows more than one valid answer. Review the accepted alternatives." : undefined,
                answerApproved: false,
              };
            }),
          })),
        }));
      }, 1800);
    };
    const uploadManualKey = (aid: string, fileName: string) => {
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, answerKey: { ...a.answerKey, mode: "manual", status: "generating", manualFile: fileName } })) }));
      setTimeout(() => {
        set((s) => ({
          ...s,
          assessments: patchAsm(s, aid, (a) => ({
            ...a,
            answerKey: { ...a.answerKey, mode: "manual", status: "draft", manualFile: fileName },
            questions: a.questions.map((qq, i) => {
              const tpl = SCIENCE_9_AI_KEY[qq.id];
              const unmapped = i === a.questions.length - 1;
              return {
                ...qq,
                answer: unmapped ? "" : tpl?.answer ?? `Answer for question ${qq.number} from the uploaded key.`,
                keyPoints: unmapped ? [] : tpl?.keyPoints ?? [],
                steps: tpl?.steps,
                aiNote: unmapped ? "Couldn't find this answer in the uploaded key. Type it in or map it from the key." : undefined,
                answerApproved: false,
              };
            }),
          })),
        }));
      }, 1800);
    };
    const approveAnswerKey = (aid: string): Result => {
      const a = ref.current.assessments.find((x) => x.id === aid)!;
      const missing = a.questions.filter((qq) => !qq.answer.trim() && qq.type !== "mcq" && qq.type !== "truefalse");
      const missingObj = a.questions.filter((qq) => !qq.answer.trim() && (qq.type === "mcq" || qq.type === "truefalse"));
      if (missing.length || missingObj.length)
        return { ok: false, error: `Add an answer for question ${[...missing, ...missingObj].map((x) => x.number).join(", ")} before approving` };
      set((s) => ({
        ...s,
        assessments: patchAsm(s, aid, (x) => ({
          ...x,
          answerKey: { ...x.answerKey, status: "approved", version: x.answerKey.version + 1, approvedAt: nowIso(), approvedBy: s.userId },
          questions: x.questions.map((qq) => ({ ...qq, answerApproved: true, aiNote: undefined })),
        })),
        audit: audit(s, { category: "assessment", action: `Approved answer key v${a.answerKey.version + 1}`, target: asmName(s, aid), detail: a.answerKey.mode === "manual" ? "Teacher-prepared key" : "AI-generated key", href: `/assessments/${aid}/setup/answer-key` }),
      }));
      return { ok: true };
    };

    /* rubric */
    const draftCriteria = (qq: Question): Criterion[] => {
      if (qq.marks === 1 || qq.type === "mcq" || qq.type === "truefalse") return [{ id: "c1", label: qq.type === "fill" ? "Correct term" : "Correct option", marks: qq.marks }];
      const points = qq.keyPoints.length ? qq.keyPoints : qq.steps?.length ? qq.steps : ["Key concept", "Explanation", "Example or working", "Conclusion"];
      const n = Math.min(points.length, qq.marks);
      const base = Math.floor(qq.marks / n);
      let extra = qq.marks - base * n;
      return points.slice(0, n).map((p, i) => ({ id: `c${i + 1}`, label: p, marks: base + (extra-- > 0 ? 1 : 0) }));
    };
    const generateRubric = (aid: string) => {
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, rubric: { ...a.rubric, status: "generating" } })) }));
      setTimeout(() => {
        set((s) => ({
          ...s,
          assessments: patchAsm(s, aid, (a) => ({
            ...a,
            rubric: { ...a.rubric, status: "draft" },
            questions: a.questions.map((qq) => (qq.criteria.length ? qq : { ...qq, criteria: draftCriteria(qq) })),
          })),
        }));
      }, 1600);
    };
    const regenerateRubricFor = (aid: string, qid: string) =>
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, rubric: { ...a.rubric, status: a.rubric.status === "approved" ? "draft" : a.rubric.status }, questions: a.questions.map((qq) => (qq.id === qid ? { ...qq, criteria: draftCriteria(qq) } : qq)) })) }));
    const setCriteria = (aid: string, qid: string, criteria: Criterion[]) =>
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, rubric: { ...a.rubric, status: a.rubric.status === "approved" ? "draft" : a.rubric.status === "none" ? "draft" : a.rubric.status }, questions: a.questions.map((qq) => (qq.id === qid ? { ...qq, criteria } : qq)) })) }));
    /** reevaluate: "none" keeps existing results, "unverified" re-runs copies not yet verified, "all" re-runs every copy (verified ones reopen) */
    const approveRubric = (aid: string, reevaluate: "none" | "unverified" | "all" = "none"): Result => {
      const a = ref.current.assessments.find((x) => x.id === aid)!;
      const bad = a.questions.filter((qq) => qq.criteria.reduce((t, c) => t + c.marks, 0) !== qq.marks || qq.criteria.length === 0);
      if (bad.length) return { ok: false, error: `Criteria marks don't add up to the question total for question ${bad.map((b) => b.number).join(", ")}` };
      if (a.questions.some((qq) => qq.criteria.some((c) => c.marks < 0))) return { ok: false, error: "Negative marks aren't allowed for this school" };
      const version = a.rubric.version + 1;
      set((s) => {
        let sheets = s.sheets;
        let affected = 0;
        if (reevaluate !== "none") {
          sheets = s.sheets.map((x) => {
            if (x.assessmentId !== aid) return x;
            if (reevaluate === "unverified" && x.verification === "verified") return x;
            affected++;
            return { ...x, evaluation: "queued", stage: 0, version: x.version + 1, verification: x.verification === "verified" ? "reopened" : x.verification, reopenReason: x.verification === "verified" ? `Rubric v${version} re-evaluation` : x.reopenReason };
          });
        }
        return {
          ...s,
          sheets,
          assessments: patchAsm(s, aid, (x) => ({ ...x, rubric: { status: "approved", version, approvedAt: nowIso(), approvedBy: s.userId } })),
          audit: audit(s, { category: "assessment", action: `Approved rubric v${version}`, target: asmName(s, aid), detail: reevaluate === "none" ? "Existing results kept" : `${affected} copies queued for re-evaluation`, href: `/assessments/${aid}/setup/rubric` }),
        };
      });
      return { ok: true };
    };

    /* uploads */
    const startUpload = (input: UploadInput): Result => {
      const s0 = ref.current;
      const a = s0.assessments.find((x) => x.id === input.assessmentId);
      if (!a) return { ok: false, error: "Choose an exam" };
      if (a.answerKey.status !== "approved" || a.rubric.status !== "approved")
        return { ok: false, error: "Approve the answer key and rubric for this exam before uploading copies" };
      if (!/\.pdf$/i.test(input.fileName)) return { ok: false, error: "Upload a PDF file" };
      if (input.kind === "individual") {
        if (!input.studentId) return { ok: false, error: "Choose the student this copy belongs to" };
        const st = s0.students.find((x) => x.id === input.studentId)!;
        if (st.grade !== a.grade || !a.sections.includes(st.section)) return { ok: false, error: `${st.name} isn't in Class ${a.grade} ${a.sections.join(", ")}` };
        if (s0.sheets.some((x) => x.assessmentId === a.id && x.studentId === st.id))
          return { ok: false, error: `${st.name} already has a copy for this exam. Remove it before uploading another.` };
      }
      const id = uid("bt");
      const cohort = cohortOf(a, s0.students).filter((x) => !input.section || x.section === input.section);
      const booklets = input.kind === "individual" ? 1 : cohort.length;
      set((s) => ({
        ...s,
        batches: [
          {
            id,
            assessmentId: a.id,
            fileName: input.fileName,
            kind: input.kind,
            uploadedBy: s.userId,
            uploadedAt: nowIso(),
            sizeMb: input.sizeMb,
            pages: booklets * 6,
            booklets,
            stage: 0,
            progress: 0,
            status: "processing",
            mapped: 0,
            unmatched: 0,
            pageIssues: input.kind === "bulk" ? [{ page: 17, issue: "Skewed 4°, auto-corrected" }, { page: 58, issue: "Blank page" }] : [],
            section: input.section,
            studentId: input.studentId,
          } as UploadBatch,
          ...s.batches,
        ],
        audit: audit(s, { category: "upload", action: input.kind === "bulk" ? "Uploaded bulk PDF" : "Uploaded individual copy", target: input.fileName, detail: `${a.name} · Class ${a.grade}`, href: `/assessments/${input.assessmentId}/students` }),
      }));
      return { ok: true, id };
    };
    const pauseBatch = (id: string, paused: boolean) => set((s) => ({ ...s, batches: s.batches.map((b) => (b.id === id ? { ...b, status: paused ? "paused" : "processing" } : b)) }));

    /* unmatched */
    const resolveUnmatched = (itemId: string, studentId: string): Result => {
      const s0 = ref.current;
      const item = s0.unmatched.find((u) => u.id === itemId)!;
      const a = s0.assessments.find((x) => x.id === item.assessmentId)!;
      const st = s0.students.find((x) => x.id === studentId);
      if (!st) return { ok: false, error: "Student not found" };
      if (st.grade !== a.grade || !a.sections.includes(st.section)) return { ok: false, error: `${st.name} is in Class ${st.grade}${st.section}, which isn't part of this exam` };
      if (s0.sheets.some((x) => x.assessmentId === a.id && x.studentId === st.id))
        return { ok: false, error: `${st.name} already has a mapped copy. Discard this booklet as a duplicate, or remap the existing copy first.` };
      set((s) => ({
        ...s,
        unmatched: s.unmatched.map((u) => (u.id === itemId ? { ...u, status: "resolved", resolvedStudentId: st.id, resolvedBy: s.userId, resolvedAt: nowIso() } : u)),
        batches: s.batches.map((b) => (b.id === item.batchId ? { ...b, mapped: b.mapped + 1, unmatched: Math.max(0, b.unmatched - 1) } : b)),
        sheets: [
          ...s.sheets,
          {
            id: `as-${a.id.replace("asm-", "")}-${st.id.replace("st-", "")}`,
            assessmentId: a.id,
            studentId: st.id,
            batchId: item.batchId,
            pages: item.pagesTo - item.pagesFrom + 1,
            blankPages: [],
            missingPages: [],
            evaluation: "queued",
            stage: 0,
            attempts: 0,
            verification: "not_started",
            teacherId: a.teacherIds.length === 1 ? a.teacherIds[0] : (s.sheets.find((x) => x.assessmentId === a.id && s.students.find((y) => y.id === x.studentId)?.section === st.section && x.teacherId)?.teacherId ?? null),
            version: 1,
            questions: [],
            generalFeedback: "",
            rubricVersion: a.rubric.version,
            answerKeyVersion: a.answerKey.version,
            model: MODEL_VERSION,
          },
        ],
        audit: audit(s, { category: "mapping", action: "Mapped booklet to student", target: `${st.name} · Class ${st.grade}${st.section} roll no ${st.roll}`, detail: `Pages ${item.pagesFrom}–${item.pagesTo} · ${item.decoded ?? "no barcode"}`, href: "/unmatched" }),
      }));
      return { ok: true };
    };
    const addTeacher = (input: { name: string; email: string; subjects: string[]; grades?: string[]; title?: string }): Result & { teacher?: User } => {
      const email = input.email.trim().toLowerCase();
      if (ref.current.users.some((u) => u.email.toLowerCase() === email)) return { ok: false, error: "A user with this email already exists" };
      const initials = input.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const grades = input.grades?.length ? input.grades : ["9", "10"];
      const teacher: User = { id: uid("u"), name: input.name.trim(), initials, role: "teacher", email, title: input.title?.trim() || `${input.subjects.join(" & ")} teacher`, subjects: input.subjects, grades };
      set((s) => ({ ...s, users: [...s.users, teacher], audit: audit(s, { category: "access", action: "Added teacher", target: teacher.name, detail: `${teacher.email} · ${teacher.subjects.join(", ")} · Class ${grades.join(", ")}` }) }));
      return { ok: true, teacher };
    };
    const addStudent = (input: { name: string; grade: string; section: string; roll: number; city?: string; guardianName: string; relation: Guardian["relation"]; phone: string | null }): Result & { student?: Student } => {
      const cur = ref.current.students;
      if (cur.some((x) => x.grade === input.grade && x.section === input.section && x.roll === input.roll)) return { ok: false, error: `Roll no ${input.roll} is already used in Class ${input.grade}${input.section}` };
      const seq = cur.reduce((m, x) => Math.max(m, Number(x.barcode.slice(-5)) || 0), 0) + 1;
      const student: Student = { id: uid("st"), name: input.name, grade: input.grade, section: input.section, roll: input.roll, city: input.city || ref.current.settings.city || "Bengaluru", barcode: `GPS${input.grade.padStart(2, "0")}${input.section}${String(seq).padStart(5, "0")}`, guardian: { name: input.guardianName, relation: input.relation, phone: input.phone } };
      set((s) => ({ ...s, students: [...s.students, student], audit: audit(s, { category: "access", action: "Added student", target: `${student.name} · Class ${student.grade}${student.section} roll no ${student.roll}`, detail: `QR ${student.barcode}` }) }));
      return { ok: true, student };
    };
    const updateStudent = (id: string, patch: Partial<Student>): Result => {
      const cur = ref.current.students;
      const existing = cur.find((s) => s.id === id);
      if (!existing) return { ok: false, error: "Student not found" };
      const nextGrade = patch.grade ?? existing.grade;
      const nextSection = patch.section ?? existing.section;
      const nextRoll = patch.roll ?? existing.roll;
      if (cur.some((x) => x.id !== id && x.grade === nextGrade && x.section === nextSection && x.roll === nextRoll)) {
        return { ok: false, error: `Roll no ${nextRoll} is already taken in Class ${nextGrade}${nextSection}` };
      }
      set((s) => ({
        ...s,
        students: s.students.map((st) => (st.id === id ? { ...st, ...patch, guardian: patch.guardian ? { ...st.guardian, ...patch.guardian } : st.guardian } : st)),
        audit: audit(s, { category: "access", action: "Updated student", target: `${patch.name ?? existing.name} · Class ${nextGrade}${nextSection} roll no ${nextRoll}` }),
      }));
      return { ok: true };
    };
    const assignClassTeacher = (grade: string, section: string, subject: string, teacherId: string): Result => {
      const teacher = ref.current.users.find((u) => u.id === teacherId);
      if (!teacher) return { ok: false, error: "Teacher not found" };
      const studentIds = new Set(ref.current.students.filter((st) => st.grade === grade && st.section === section).map((st) => st.id));
      const assessments = ref.current.assessments.filter((a) => a.grade === grade && a.sections.includes(section) && (subject === "all" || a.subject === subject));
      const asmIds = new Set(assessments.map((a) => a.id));
      set((s) => {
        const nextSheets = s.sheets.map((sh) => {
          if (asmIds.has(sh.assessmentId) && studentIds.has(sh.studentId)) {
            return { ...sh, teacherId };
          }
          return sh;
        });
        const nextAsms = s.assessments.map((a) => {
          if (asmIds.has(a.id) && !a.teacherIds.includes(teacherId)) {
            return { ...a, teacherIds: [...a.teacherIds, teacherId] };
          }
          return a;
        });
        return {
          ...s,
          sheets: nextSheets,
          assessments: nextAsms,
          audit: audit(s, {
            category: "review",
            action: "Assigned class teacher",
            target: `Class ${grade}${section} · ${subject} to ${teacher.name}`,
          }),
        };
      });
      return { ok: true };
    };
    const lookupBarcode = (barcode: string): Student | undefined => {
      const norm = barcode.replace(/\s+/g, "").toUpperCase();
      if (!norm) return undefined;
      return ref.current.students.find(
        (x) =>
          x.barcode.toUpperCase() === norm ||
          shortCodeOf(x.barcode).toUpperCase() === norm ||
          x.id.toUpperCase() === norm ||
          `${x.grade}${x.section}-${x.roll}`.toUpperCase() === norm,
      );
    };
    const toggleAbsent = (assessmentId: string, studentId: string) =>
      set((s) => {
        const a = s.assessments.find((x) => x.id === assessmentId);
        if (!a) return s;
        const current = a.absentStudentIds ?? [];
        const isAbsent = current.includes(studentId);
        const updated = isAbsent ? current.filter((id) => id !== studentId) : [...current, studentId];
        const st = s.students.find((x) => x.id === studentId);
        return {
          ...s,
          assessments: patchAsm(s, assessmentId, (asm) => ({ ...asm, absentStudentIds: updated })),
          audit: audit(s, {
            category: "assessment",
            action: isAbsent ? "Marked student present" : "Marked student absent",
            target: `${st?.name ?? studentId} · ${a.name}`,
          }),
        };
      });
    const discardUnmatched = (itemId: string, note: string) =>
      set((s) => {
        const item = s.unmatched.find((u) => u.id === itemId)!;
        return {
          ...s,
          unmatched: s.unmatched.map((u) => (u.id === itemId ? { ...u, status: "discarded", note, resolvedBy: s.userId, resolvedAt: nowIso() } : u)),
          batches: s.batches.map((b) => (b.id === item.batchId ? { ...b, unmatched: Math.max(0, b.unmatched - 1) } : b)),
          audit: audit(s, { category: "mapping", action: "Discarded booklet", target: `Pages ${item.pagesFrom}–${item.pagesTo}`, detail: note, href: "/unmatched" }),
        };
      });
    const reopenUnmatched = (itemId: string) =>
      set((s) => {
        const item = s.unmatched.find((u) => u.id === itemId)!;
        return {
          ...s,
          unmatched: s.unmatched.map((u) => (u.id === itemId ? { ...u, status: "open", note: undefined } : u)),
          batches: s.batches.map((b) => (b.id === item.batchId ? { ...b, unmatched: b.unmatched + 1 } : b)),
        };
      });

    /* queue */
    const setQueuePaused = (paused: boolean) =>
      set((s) => ({ ...s, queuePaused: paused, audit: audit(s, { category: "evaluation", action: paused ? "Paused evaluation queue" : "Resumed evaluation queue", target: "Processing queue" }) }));
    const retryJobs = (sheetIds: string[]) =>
      set((s) => ({
        ...s,
        sheets: s.sheets.map((x) => (sheetIds.includes(x.id) && (x.evaluation === "failed" || x.evaluation === "needs_review") ? { ...x, evaluation: "queued", stage: 0, error: undefined } : x)),
        audit: audit(s, { category: "evaluation", action: `Retried ${sheetIds.length} ${sheetIds.length === 1 ? "job" : "jobs"}`, target: "Processing queue" }),
      }));

    /* assignment */
    const assign = (sheetIds: string[], teacherId: string | null) =>
      set((s) => {
        const t = s.users.find((u) => u.id === teacherId);
        const first = s.sheets.find((x) => x.id === sheetIds[0]);
        let next: State = {
          ...s,
          sheets: s.sheets.map((x) => (sheetIds.includes(x.id) ? { ...x, teacherId } : x)),
          assessments: first && teacherId ? patchAsm(s, first.assessmentId, (a) => (a.teacherIds.includes(teacherId) ? a : { ...a, teacherIds: [...a.teacherIds, teacherId] })) : s.assessments,
          audit: audit(s, { category: "review", action: teacherId ? "Assigned copies" : "Unassigned copies", target: `${first ? asmName(s, first.assessmentId) : ""} · ${sheetIds.length} copies${t ? ` to ${t.name}` : ""}`, href: "/teachers" }),
        };
        if (teacherId) next = { ...next, notifications: notify(next, { userId: teacherId, title: `${sheetIds.length} ${sheetIds.length === 1 ? "copy" : "copies"} assigned to you`, body: first ? asmName(s, first.assessmentId) : "", href: "/teacher/pending", kind: "assigned" }) };
        return next;
      });
    const setDeadline = (aid: string, deadline: string) =>
      set((s) => ({ ...s, assessments: patchAsm(s, aid, (a) => ({ ...a, deadline })), audit: audit(s, { category: "review", action: "Set verification deadline", target: asmName(s, aid), detail: deadline }) }));
    const remind = (teacherId: string, aid: string, pending: number) =>
      set((s) => ({ ...s, notifications: notify(s, { userId: teacherId, title: "Verification pending", body: `${asmName(s, aid)} · ${pending} copies waiting for you`, href: "/teacher/pending", kind: "pending" }) }));

    /* review */
    const touch = (x: AnswerSheet): AnswerSheet => ({ ...x, dirty: true, verification: x.verification === "not_started" ? "in_progress" : x.verification });
    const updateEval = (sheetId: string, qid: string, patch: Partial<QuestionEval>) =>
      set((s) => ({
        ...s,
        sheets: patchSheet(s, sheetId, (x) =>
          touch({
            ...x,
            questions: x.questions.map((qe) => {
              if (qe.qid !== qid) return qe;
              const n = { ...qe, ...patch };
              if (patch.awarded !== undefined) n.edited = patch.awarded !== qe.aiAwarded || !!patch.editReason;
              return n;
            }),
          }),
        ),
      }));
    const acceptQuestion = (sheetId: string, qid: string) =>
      set((s) => ({ ...s, sheets: patchSheet(s, sheetId, (x) => touch({ ...x, questions: x.questions.map((qe) => (qe.qid === qid ? { ...qe, accepted: true, awarded: qe.edited ? qe.awarded : qe.aiAwarded } : qe)) })) }));
    const acceptAllConfident = (sheetId: string) =>
      set((s) => ({ ...s, sheets: patchSheet(s, sheetId, (x) => touch({ ...x, questions: x.questions.map((qe) => (!qe.review ? { ...qe, accepted: true } : qe)) })) }));
    const setGeneralFeedback = (sheetId: string, generalFeedback: string) => set((s) => ({ ...s, sheets: patchSheet(s, sheetId, (x) => touch({ ...x, generalFeedback })) }));
    /** Discard unsaved edits: put back a snapshot taken at load or last save */
    const restoreSheet = (snapshot: AnswerSheet) => set((s) => ({ ...s, sheets: patchSheet(s, snapshot.id, () => ({ ...snapshot, dirty: false })) }));
    const saveDraft = (sheetId: string) =>
      set((s) => ({ ...s, sheets: patchSheet(s, sheetId, (x) => ({ ...x, dirty: false, draftSavedAt: nowIso() })) }));
    const verify = (sheetId: string): Result => {
      const x = ref.current.sheets.find((y) => y.id === sheetId)!;
      if (x.evaluation !== "evaluated") return { ok: false, error: "This copy hasn't finished AI evaluation" };
      const unresolved = x.questions.filter((qe) => qe.review && !qe.edited && !qe.accepted);
      if (unresolved.length) {
        const a = ref.current.assessments.find((y) => y.id === x.assessmentId)!;
        const nums = unresolved.map((u) => a.questions.find((qq) => qq.id === u.qid)?.number).join(", ");
        return { ok: false, error: `Resolve the flagged ${unresolved.length === 1 ? "question" : "questions"} first: Q${nums}. Accept the AI mark or edit it.` };
      }
      set((s) => {
        const st = s.students.find((y) => y.id === x.studentId)!;
        return {
          ...s,
          sheets: patchSheet(s, sheetId, (y) => ({ ...y, verification: "verified", verifiedAt: nowIso(), verifiedBy: s.userId, verifiedVersion: y.version, dirty: false, draftSavedAt: nowIso(), reopenReason: undefined })),
          audit: audit(s, { category: "verification", action: "Verified copy", target: `${st.name} · ${asmName(s, x.assessmentId)}`, detail: `Version ${x.version} · ${sheetTotal(x)} marks`, href: `/review/${sheetId}` }),
        };
      });
      return { ok: true };
    };
    const reopen = (sheetId: string, reason: string) =>
      set((s) => {
        const x = s.sheets.find((y) => y.id === sheetId)!;
        const st = s.students.find((y) => y.id === x.studentId)!;
        let next: State = {
          ...s,
          sheets: patchSheet(s, sheetId, (y) => ({ ...y, verification: "reopened", version: y.version + 1, reopenReason: reason })),
          audit: audit(s, { category: "verification", action: "Reopened copy", target: `${st.name} · ${asmName(s, x.assessmentId)}`, detail: reason, href: `/review/${sheetId}` }),
        };
        if (x.teacherId && x.teacherId !== s.userId)
          next = { ...next, notifications: notify(next, { userId: x.teacherId, title: "Re-verification required", body: `${asmName(s, x.assessmentId)} · ${st.name}`, href: `/review/${sheetId}`, kind: "reverify" }) };
        return next;
      });

    /* similar corrections */
    const findSimilar = (sheetId: string, qid: string): number => {
      const s0 = ref.current;
      const src = s0.sheets.find((x) => x.id === sheetId)!;
      const sq = src.questions.find((qe) => qe.qid === qid)!;
      if (!sq || sq.awarded === sq.aiAwarded) return 0;
      const existing = new Set(s0.suggestions.filter((g) => g.qid === qid && g.status === "pending").map((g) => g.targetSheetId));
      const targets = s0.sheets.filter((x) => {
        if (x.id === sheetId || x.assessmentId !== src.assessmentId || x.evaluation !== "evaluated" || existing.has(x.id)) return false;
        const tq = x.questions.find((qe) => qe.qid === qid);
        return !!tq && tq.extracted === sq.extracted && tq.awarded === sq.aiAwarded && !tq.edited;
      });
      const a = s0.assessments.find((x) => x.id === src.assessmentId)!;
      const qq = a.questions.find((x) => x.id === qid)!;
      const created: Suggestion[] = targets.map((x, i) => {
        const tq = x.questions.find((qe) => qe.qid === qid)!;
        return {
          id: uid("sg"),
          assessmentId: a.id,
          qid,
          sourceSheetId: sheetId,
          targetSheetId: x.id,
          fromMarks: tq.awarded,
          toMarks: sq.awarded,
          excerpt: tq.extracted,
          rationale: `Matches the same rubric criteria as the corrected answer (${qq.criteria.filter((c) => tq.matched.includes(c.id)).map((c) => c.label).join(", ") || "none matched"}).${sq.editReason ? ` Teacher's reason: ${sq.editReason}.` : ""}`,
          similarity: Math.round((0.97 - i * 0.012) * 100) / 100,
          status: "pending",
          createdAt: nowIso(),
          createdBy: s0.userId,
        };
      });
      set((s) => ({ ...s, suggestions: [...created, ...s.suggestions] }));
      return created.length;
    };
    const decideSuggestions = (ids: string[], decision: "approved" | "rejected") =>
      set((s) => {
        let sheets = s.sheets;
        const chosen = s.suggestions.filter((g) => ids.includes(g.id) && g.status === "pending");
        if (decision === "approved") {
          for (const g of chosen) {
            const srcSt = s.students.find((y) => y.id === s.sheets.find((x) => x.id === g.sourceSheetId)?.studentId);
            sheets = sheets.map((x) =>
              x.id !== g.targetSheetId
                ? x
                : {
                    ...x,
                    version: x.version + 1,
                    verification: x.verification === "verified" ? "reopened" : x.verification,
                    reopenReason: x.verification === "verified" ? "Similar correction applied" : x.reopenReason,
                    questions: x.questions.map((qe) => (qe.qid === g.qid ? { ...qe, awarded: g.toMarks, edited: true, editReason: `Applied from similar correction on ${srcSt?.name ?? "another copy"}` } : qe)),
                  },
            );
          }
        }
        return {
          ...s,
          sheets,
          suggestions: s.suggestions.map((g) => (ids.includes(g.id) && g.status === "pending" ? { ...g, status: decision } : g)),
          audit: chosen.length
            ? audit(s, { category: "review", action: decision === "approved" ? `Applied ${chosen.length} similar ${chosen.length === 1 ? "correction" : "corrections"}` : `Rejected ${chosen.length} similar ${chosen.length === 1 ? "suggestion" : "suggestions"}`, target: asmName(s, chosen[0].assessmentId) })
            : s.audit,
        };
      });
    /** Reverse an approved bulk correction */
    const revertSuggestions = (ids: string[]) =>
      set((s) => {
        let sheets = s.sheets;
        const chosen = s.suggestions.filter((g) => ids.includes(g.id) && g.status === "approved");
        for (const g of chosen) {
          sheets = sheets.map((x) => (x.id !== g.targetSheetId ? x : { ...x, version: x.version + 1, questions: x.questions.map((qe) => (qe.qid === g.qid ? { ...qe, awarded: g.fromMarks, edited: g.fromMarks !== qe.aiAwarded, editReason: undefined } : qe)) }));
        }
        return { ...s, sheets, suggestions: s.suggestions.map((g) => (ids.includes(g.id) && g.status === "approved" ? { ...g, status: "rejected" } : g)), audit: chosen.length ? audit(s, { category: "review", action: `Reverted ${chosen.length} similar corrections`, target: asmName(s, chosen[0].assessmentId) }) : s.audit };
      });

    /* distribution */
    const release = (sheetIds: string[]): { runId: string; queued: number; skipped: number; duplicates: number } => {
      const s0 = ref.current;
      const runId = uid("run");
      let queued = 0;
      let skipped = 0;
      let duplicates = 0;
      const created: Distribution[] = [];
      for (const id of sheetIds) {
        const x = s0.sheets.find((y) => y.id === id);
        if (!x || x.evaluation !== "evaluated") continue;
        const st = s0.students.find((y) => y.id === x.studentId)!;
        const prev = s0.distributions.filter((d) => d.sheetId === id).sort((p, q) => (p.sentAt < q.sentAt ? 1 : -1))[0];
        if (prev && (prev.status === "delivered" || prev.status === "sending") && prev.version === x.version && prev.verified === (x.verification === "verified")) {
          duplicates++;
          continue;
        }
        const phone = st.guardian.phone;
        if (!phone) skipped++;
        else queued++;
        created.push({
          id: uid("ds"),
          runId,
          sheetId: id,
          assessmentId: x.assessmentId,
          studentId: st.id,
          phone,
          status: phone ? "sending" : "skipped",
          reason: phone ? undefined : "No guardian phone on record",
          version: x.version,
          verified: x.verification === "verified",
          sentAt: nowIso(),
          token: makeToken(id + runId),
          expiresAt: new Date(now() + s0.settings.linkExpiryDays * 86400000).toISOString(),
          revoked: false,
          attempts: 1,
        });
      }
      const provisional = created.filter((d) => !d.verified).length;
      set((s) => ({
        ...s,
        distributions: [...created, ...s.distributions],
        audit: audit(s, {
          category: "distribution",
          action: "Sent results by SMS",
          target: `${created[0] ? asmName(s, created[0].assessmentId) : ""} · ${created.length} copies`,
          detail: `${queued} sending · ${skipped} skipped${provisional ? ` · ${provisional} not verified` : ""}`,
          href: "/distribution",
        }),
      }));
      return { runId, queued, skipped, duplicates };
    };
    const retryDelivery = (ids: string[]) =>
      set((s) => ({
        ...s,
        distributions: s.distributions.map((d) => (ids.includes(d.id) && d.status === "failed" ? { ...d, status: "sending", attempts: d.attempts + 1, reason: undefined, id: d.id } : d)),
        audit: audit(s, { category: "distribution", action: `Retried ${ids.length} SMS`, target: "Result distribution" }),
      }));
    const revokeLink = (id: string) =>
      set((s) => {
        const d = s.distributions.find((x) => x.id === id)!;
        return { ...s, distributions: s.distributions.map((x) => (x.id === id ? { ...x, revoked: true } : x)), audit: audit(s, { category: "access", action: "Revoked result link", target: `${studentName(s, d.studentId)} · ${asmName(s, d.assessmentId)}` }) };
      });
    const recordOpen = (token: string) =>
      set((s) => ({
        ...s,
        distributions: s.distributions.map((d) => (d.token === token && !d.openedAt ? { ...d, openedAt: nowIso() } : d)),
        audit: audit(s, { actorId: "guardian", category: "access", action: "Guardian opened result", target: (() => { const d = s.distributions.find((x) => x.token === token); return d ? `${studentName(s, d.studentId)} · ${asmName(s, d.assessmentId)}` : token; })() }),
      }));

    /* notifications / settings */
    const markRead = (id: string) => set((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    const markAllRead = () => set((s) => ({ ...s, notifications: s.notifications.map((n) => (n.userId === s.userId ? { ...n, read: true } : n)) }));
    const updateSettings = (patch: Partial<Settings>) =>
      set((s) => ({ ...s, settings: { ...s.settings, ...patch }, audit: audit(s, { category: "settings", action: "Updated settings", target: Object.keys(patch).join(", ") }) }));

    return {
      signIn, switchRole,
      createAssessment, updateAssessment, archiveAssessment, uploadPaper, updateQuestion, addQuestion, removeQuestion, confirmQuestions,
      generateAnswerKey, uploadManualKey, approveAnswerKey,
      generateRubric, regenerateRubricFor, setCriteria, approveRubric,
      startUpload, pauseBatch,
      resolveUnmatched, addStudent, updateStudent, addTeacher, assignClassTeacher, lookupBarcode, discardUnmatched, reopenUnmatched, toggleAbsent,
      setQueuePaused, retryJobs,
      assign, setDeadline, remind,
      updateEval, acceptQuestion, acceptAllConfident, setGeneralFeedback, saveDraft, restoreSheet, verify, reopen,
      findSimilar, decideSuggestions, revertSuggestions,
      release, retryDelivery, revokeLink, recordOpen,
      markRead, markAllRead, updateSettings,
      toast: showToast, dismissToast,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, actions, me, role };
}

type StoreValue = ReturnType<typeof useStoreImpl>;
const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreImpl();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

export type Actions = StoreValue["actions"];

export const useStudent = (id?: string | null) => {
  const { state } = useStore();
  return id ? state.students.find((s) => s.id === id) : undefined;
};
export const useAssessment = (id?: string) => {
  const { state } = useStore();
  return id ? state.assessments.find((a) => a.id === id) : undefined;
};
export const useUser = (id?: string | null) => {
  const { state } = useStore();
  return id ? state.users.find((u) => u.id === id) : undefined;
};
