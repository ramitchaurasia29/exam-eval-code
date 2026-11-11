import type {
  AnswerSheet,
  Assessment,
  AssessmentStatus,
  Distribution,
  EvalStatus,
  QType,
  ReviewReason,
  Student,
  UnmatchedReason,
  VerificationStatus,
} from "./types";
import { NOW } from "./seed";

/* Clock: seeded "now" that keeps ticking in the session -------------- */
const BOOT = Date.now();
export const now = () => NOW + (Date.now() - BOOT);
export const nowIso = () => new Date(now()).toISOString();

/* Formatting ---------------------------------------------------------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(isoStr?: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtShortDate(isoStr?: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function fmtTime(isoStr?: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
export function fmtDateTime(isoStr?: string) {
  if (!isoStr) return "";
  return `${fmtShortDate(isoStr)}, ${fmtTime(isoStr)}`;
}
export function relTime(isoStr?: string) {
  if (!isoStr) return "";
  const diff = now() - new Date(isoStr).getTime();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const future = diff < 0;
  const w = (s: string) => (future ? `in ${s}` : `${s} ago`);
  if (m < 1) return "just now";
  if (m < 60) return w(`${m} min`);
  const h = Math.round(m / 60);
  if (h < 24) return w(`${h} h`);
  const d = Math.round(h / 24);
  if (d < 14) return w(`${d} ${d === 1 ? "day" : "days"}`);
  return fmtDate(isoStr);
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
export const num = (n: number) => n.toLocaleString("en-IN");
export const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

/* Labels --------------------------------------------------------------- */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

export const QTYPE_LABEL: Record<QType, string> = {
  mcq: "MCQ",
  short: "Short answer",
  long: "Long answer",
  numerical: "Numerical",
  diagram: "Diagram",
  fill: "Fill in the blank",
  truefalse: "True/False",
  passage: "Passage-based",
};

export const ASSESSMENT_STATUS: Record<AssessmentStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "muted" },
  answer_key_pending: { label: "Answer key pending", tone: "warning" },
  rubric_pending: { label: "Rubric pending", tone: "warning" },
  ready: { label: "Ready for evaluation", tone: "info" },
  evaluating: { label: "Evaluation in progress", tone: "info" },
  reviewing: { label: "Review in progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  archived: { label: "Archived", tone: "muted" },
};

export const EVAL_STATUS: Record<EvalStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "muted" },
  processing: { label: "Processing", tone: "info" },
  evaluated: { label: "AI evaluated", tone: "neutral" },
  failed: { label: "Evaluation failed", tone: "danger" },
  needs_review: { label: "Needs review", tone: "warning" },
};

export const VERIFY_STATUS: Record<VerificationStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not verified", tone: "muted" },
  in_progress: { label: "Review in progress", tone: "info" },
  verified: { label: "Verified", tone: "success" },
  reopened: { label: "Reopened", tone: "warning" },
};

export const DIST_STATUS: Record<"not_sent" | "sending" | "delivered" | "failed" | "skipped", { label: string; tone: Tone }> = {
  not_sent: { label: "Not sent", tone: "muted" },
  sending: { label: "Sending", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "SMS failed", tone: "danger" },
  skipped: { label: "No guardian phone", tone: "warning" },
};

export const UNMATCHED_REASON: Record<UnmatchedReason, { label: string; help: string }> = {
  missing_barcode: { label: "Missing QR code", help: "No QR code found on the cover page. Identify the student from the cover details." },
  unreadable_barcode: { label: "Unreadable QR code", help: "A QR code was found but couldn't be decoded. Enter it manually or map the student." },
  unknown_barcode: { label: "Unknown QR code", help: "The QR code decoded but isn't in the school registry. Correct it or map the student." },
  duplicate_barcode: { label: "Duplicate QR code", help: "Another booklet with this QR code is already mapped. Keep one and discard the other." },
  not_in_cohort: { label: "Student not in this exam", help: "The QR code belongs to a student outside this class and section. Check the booklet was filed correctly." },
};

export const REVIEW_REASON: Record<ReviewReason, string> = {
  low_confidence: "Low confidence",
  unreadable: "Unreadable handwriting",
  ambiguous_mapping: "Unclear question mapping",
  out_of_syllabus: "Beyond the answer key",
  missing_page: "Missing page",
};

export const EVAL_STAGES = ["Extracting answers", "Mapping questions", "Evaluating", "Calculating marks"];
export const BATCH_STAGES = ["Uploaded", "Extracting pages", "Identifying barcodes", "Segmenting booklets", "Mapping students", "Queued for evaluation"];

/* Derived data --------------------------------------------------------- */
export const sheetTotal = (s: AnswerSheet) => s.questions.reduce((t, q) => t + q.awarded, 0);
export const sheetAiTotal = (s: AnswerSheet) => s.questions.reduce((t, q) => t + q.aiAwarded, 0);
/** Questions still needing a teacher decision. A verified copy has none left. */
export const flaggedCount = (s: AnswerSheet) => (s.verification === "verified" ? 0 : s.questions.filter((q) => q.review && !q.edited && !q.accepted).length);
export const isEvaluated = (s: AnswerSheet) => s.evaluation === "evaluated";

export function latestDistribution(sheetId: string, dists: Distribution[]): Distribution | undefined {
  let latest: Distribution | undefined;
  for (const d of dists) {
    if (d.sheetId !== sheetId) continue;
    if (!latest || d.sentAt > latest.sentAt) latest = d;
  }
  return latest;
}

export type DistKey = keyof typeof DIST_STATUS;
export function distributionKey(sheetId: string, dists: Distribution[]): DistKey {
  const d = latestDistribution(sheetId, dists);
  return d ? d.status : "not_sent";
}

/** Eligibility for release; mirrors the PRD release rules. */
export function releaseEligibility(
  s: AnswerSheet,
  student: Student | undefined,
  dists: Distribution[],
): { ok: boolean; provisional: boolean; reason?: string } {
  if (!isEvaluated(s)) return { ok: false, provisional: false, reason: "Not evaluated yet" };
  if (!student?.guardian.phone) return { ok: false, provisional: false, reason: "No guardian phone on record" };
  const d = latestDistribution(s.id, dists);
  if (d && (d.status === "delivered" || d.status === "sending") && d.version === s.version && d.verified === (s.verification === "verified"))
    return { ok: false, provisional: false, reason: "Already sent" };
  if (s.verification === "verified") return { ok: true, provisional: false };
  return { ok: true, provisional: true, reason: "Not verified by teacher" };
}

export function assessmentStatus(a: Assessment, sheets: AnswerSheet[]): AssessmentStatus {
  if (a.archived) return "archived";
  if (!a.paper || !a.questionsConfirmed) return "draft";
  if (a.answerKey.status !== "approved") return "answer_key_pending";
  if (a.rubric.status !== "approved") return "rubric_pending";
  const own = sheets.filter((s) => s.assessmentId === a.id);
  if (own.length === 0) return "ready";
  if (own.some((s) => s.evaluation === "queued" || s.evaluation === "processing")) return "evaluating";
  if (own.every((s) => s.verification === "verified")) return "completed";
  return "reviewing";
}

export interface Counts {
  expected: number;
  uploaded: number;
  identified: number;
  unmatched: number;
  aiEvaluated: number;
  pendingEvaluation: number;
  failed: number;
  needsReview: number;
  pendingVerification: number;
  inReview: number;
  verified: number;
  reopened: number;
  distributed: number;
  provisional: number;
  smsFailed: number;
}

export function countsFor(
  sheets: AnswerSheet[],
  dists: Distribution[],
  students: Student[],
  unmatchedOpen: number,
  assessments: Assessment[],
): Counts {
  const expected = assessments
    .filter((a) => a.paper && a.questionsConfirmed && !a.archived)
    .reduce((t, a) => t + students.filter((s) => s.grade === a.grade && a.sections.includes(s.section)).length, 0);
  const c: Counts = {
    expected,
    uploaded: sheets.length + unmatchedOpen,
    identified: sheets.length,
    unmatched: unmatchedOpen,
    aiEvaluated: 0,
    pendingEvaluation: 0,
    failed: 0,
    needsReview: 0,
    pendingVerification: 0,
    inReview: 0,
    verified: 0,
    reopened: 0,
    distributed: 0,
    provisional: 0,
    smsFailed: 0,
  };
  for (const s of sheets) {
    if (s.evaluation === "evaluated") c.aiEvaluated++;
    if (s.evaluation === "queued" || s.evaluation === "processing") c.pendingEvaluation++;
    if (s.evaluation === "failed") c.failed++;
    if (s.evaluation === "needs_review") c.needsReview++;
    if (s.evaluation === "evaluated" && s.verification !== "verified") c.pendingVerification++;
    if (s.verification === "in_progress") c.inReview++;
    if (s.verification === "verified") c.verified++;
    if (s.verification === "reopened") c.reopened++;
    const d = latestDistribution(s.id, dists);
    if (d && d.status === "delivered") {
      c.distributed++;
      if (!d.verified) c.provisional++;
    }
    if (d && d.status === "failed") c.smsFailed++;
  }
  return c;
}

export const cohortOf = (a: Assessment, students: Student[]) =>
  students.filter((s) => s.grade === a.grade && a.sections.includes(s.section));

export const classLabel = (grade: string, section?: string) => `Class ${grade}${section ?? ""}`;
export const assessmentLabel = (a: Assessment) => `${a.name} · Class ${a.grade}`;
