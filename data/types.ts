// Shared domain types for the AI-Powered Assessment Evaluation Platform prototype.
// Status dimensions are kept separate on purpose (PRD §12): mapping, evaluation,
// verification and distribution are never collapsed into one field.

export type Role = "admin" | "teacher";

export interface User {
  id: string;
  name: string;
  initials: string;
  role: Role;
  email: string;
  title: string; // "Exam Cell Admin", "Science teacher"
  subjects: string[];
}

export type QType =
  | "mcq"
  | "short"
  | "long"
  | "numerical"
  | "diagram"
  | "fill"
  | "truefalse"
  | "passage";

export interface Criterion {
  id: string;
  label: string;
  marks: number;
}

export type ReviewReason =
  | "low_confidence"
  | "unreadable"
  | "ambiguous_mapping"
  | "out_of_syllabus"
  | "missing_page";

/** A sample student answer used by the mock evaluator. `hit` = criterion ids satisfied. */
export interface Variant {
  text: string;
  hit: string[];
  confidence: number;
  feedback: string;
  explanation: string;
  flag?: ReviewReason;
}

export interface Question {
  id: string; // stable id, independent of displayed number
  number: string; // displayed numbering "1", "5(a)"
  text: string;
  type: QType;
  marks: number;
  page: number; // page of question paper
  /** Extraction warning shown during paper review; cleared when teacher confirms/fixes */
  extractionIssue?: string;
  // Answer key
  answer: string;
  keyPoints: string[];
  alternatives: string[];
  steps?: string[];
  aiNote?: string; // AI flagged uncertainty on its generated answer
  answerApproved: boolean;
  // Rubric
  criteria: Criterion[];
  variants: Variant[];
}

export type AssessmentStatus =
  | "draft"
  | "answer_key_pending"
  | "rubric_pending"
  | "ready"
  | "evaluating"
  | "reviewing"
  | "completed"
  | "archived";

export interface PaperVersion {
  version: number;
  fileName: string;
  pages: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Assessment {
  id: string;
  name: string;
  academicYear: string;
  grade: string;
  sections: string[];
  subject: string;
  type: string; // Unit test, Midterm, Final, ...
  examDate: string; // ISO date
  totalMarks: number;
  durationMin?: number;
  instructions?: string;
  ownerId: string; // teacher who created it
  teacherIds: string[];
  archived?: boolean;
  deadline?: string; // verification deadline ISO date
  paper: PaperVersion | null;
  paperHistory: PaperVersion[];
  questionsConfirmed: boolean;
  answerKey: {
    mode: "ai" | "manual" | null;
    status: "none" | "generating" | "draft" | "approved";
    version: number;
    approvedAt?: string;
    approvedBy?: string;
    manualFile?: string;
  };
  rubric: {
    status: "none" | "generating" | "draft" | "approved";
    version: number;
    approvedAt?: string;
    approvedBy?: string;
  };
  questions: Question[];
}

export interface Guardian {
  name: string;
  relation: "Mother" | "Father" | "Guardian";
  phone: string | null;
}

export interface Student {
  id: string;
  name: string;
  admissionNo: string;
  grade: string;
  section: string;
  roll: number;
  barcode: string;
  guardian: Guardian;
}

export interface QuestionEval {
  qid: string;
  awarded: number;
  aiAwarded: number;
  extracted: string;
  page: number; // 1-based page of the student booklet
  regionTop: number; // % from page top
  regionHeight: number; // % of page height
  matched: string[]; // criterion ids
  explanation: string;
  feedback: string;
  confidence: number; // 0..1 calibrated
  review: boolean; // review-required flag
  reason?: ReviewReason;
  edited: boolean;
  editReason?: string;
  flagged: boolean;
  comment?: string;
  /** Teacher accepted the AI mark as-is */
  accepted?: boolean;
}

export type EvalStatus = "queued" | "processing" | "evaluated" | "failed" | "needs_review";
export type VerificationStatus = "not_started" | "in_progress" | "verified" | "reopened";

export interface AnswerSheet {
  id: string;
  assessmentId: string;
  studentId: string;
  batchId: string;
  pages: number;
  blankPages: number[];
  missingPages: number[];
  evaluation: EvalStatus;
  stage: number; // index into EVAL_STAGES while processing
  attempts: number;
  error?: string;
  verification: VerificationStatus;
  teacherId: string | null;
  version: number; // evaluation version
  questions: QuestionEval[];
  generalFeedback: string;
  draftSavedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedVersion?: number;
  reopenReason?: string;
  rubricVersion: number;
  answerKeyVersion: number;
  model: string;
  /** Unsaved teacher edits since the last draft save */
  dirty?: boolean;
  /** Teacher currently holding the edit lock (concurrency) */
  lockedBy?: string;
}

export type BatchStatus = "processing" | "completed" | "partial" | "failed" | "paused";

export interface UploadBatch {
  id: string;
  assessmentId: string;
  fileName: string;
  kind: "bulk" | "individual";
  uploadedBy: string;
  uploadedAt: string;
  sizeMb: number;
  pages: number;
  booklets: number;
  stage: number; // index into BATCH_STAGES
  progress: number; // 0..100 within stage
  status: BatchStatus;
  mapped: number;
  unmatched: number;
  error?: string;
  /** pages flagged during page checks */
  pageIssues: { page: number; issue: string }[];
  /** bulk: section contained in the PDF */
  section?: string;
  /** individual: target student */
  studentId?: string;
}

export type UnmatchedReason =
  | "missing_barcode"
  | "unreadable_barcode"
  | "unknown_barcode"
  | "duplicate_barcode"
  | "not_in_cohort";

export interface UnmatchedItem {
  id: string;
  batchId: string;
  assessmentId: string;
  pagesFrom: number;
  pagesTo: number;
  decoded: string | null;
  reason: UnmatchedReason;
  /** student whose writing/cover page most likely matches (cover-page name OCR) */
  coverName?: string;
  coverRoll?: string;
  suggestedStudentId?: string;
  conflictSheetId?: string; // duplicate barcode: existing sheet
  status: "open" | "resolved" | "discarded";
  resolvedStudentId?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  note?: string;
}

export type DeliveryStatus = "sending" | "delivered" | "failed" | "skipped";

export interface Distribution {
  id: string;
  runId: string;
  sheetId: string;
  assessmentId: string;
  studentId: string;
  phone: string | null;
  status: DeliveryStatus;
  reason?: string;
  version: number;
  verified: boolean;
  sentAt: string;
  token: string;
  expiresAt: string;
  revoked: boolean;
  attempts: number;
  openedAt?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string; // user id or "system"
  action: string; // "Verified copy"
  category: "assessment" | "upload" | "mapping" | "evaluation" | "review" | "verification" | "distribution" | "settings" | "access";
  target: string; // human label "Aarav Mehta · Science Midterm"
  detail?: string;
  href?: string;
}

export interface Notification {
  id: string;
  userId: string;
  at: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  kind: "assigned" | "evaluated" | "pending" | "deadline" | "reverify" | "reopened" | "system";
}

export interface Suggestion {
  id: string;
  assessmentId: string;
  qid: string;
  sourceSheetId: string;
  targetSheetId: string;
  fromMarks: number;
  toMarks: number;
  excerpt: string;
  rationale: string;
  similarity: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  createdBy: string;
}

export interface Settings {
  schoolName: string;
  academicYear: string;
  unverifiedRelease: "prohibited" | "warn" ; // allowed with warning (admin only)
  verificationAuthority: "teacher" | "teacher_admin";
  reviewPolicy: "all" | "low_confidence";
  linkExpiryDays: number;
  workers: number;
  rateLimitPerMin: number;
  scanDpi: number;
  barcodeFormat: "school" | "platform" | "both";
  emailNotifications: boolean;
  smsSender: string;
}

export interface Toast {
  id: string;
  message: string;
  undo?: () => void;
  tone?: "neutral" | "success" | "danger";
}
