import type {
  AnswerSheet,
  Assessment,
  AuditEvent,
  Distribution,
  Notification,
  Question,
  QuestionEval,
  Settings,
  Student,
  Suggestion,
  UnmatchedItem,
  UploadBatch,
  User,
} from "./types";
import {
  ENGLISH_10_QUESTIONS,
  MATHS_10_QUESTIONS,
  MATHS_9_QUESTIONS,
  SCIENCE_10_QUESTIONS,
  SCIENCE_9_QUESTIONS,
  SST_8_QUESTIONS,
} from "./questions";

/** The prototype's fixed "now". All relative times derive from it. */
export const NOW = new Date("2026-03-18T10:30:00+05:30").getTime();
export const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const MODEL_VERSION = "eval-v2.3 · prompt 14";

/* Deterministic RNG -------------------------------------------------- */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* Users -------------------------------------------------------------- */
export const USERS: User[] = [
  { id: "u-admin", name: "Priya Raman", initials: "PR", role: "admin", email: "priya.raman@greenfield.edu.in", title: "Exam Cell Admin", subjects: [], grades: ["8", "9", "10"] },
  { id: "u-meera", name: "Meera Iyer", initials: "MI", role: "teacher", email: "meera.iyer@greenfield.edu.in", title: "Science teacher", subjects: ["Science"], grades: ["9", "10"] },
  { id: "u-rahul", name: "Rahul Deshmukh", initials: "RD", role: "teacher", email: "rahul.deshmukh@greenfield.edu.in", title: "Science teacher", subjects: ["Science"], grades: ["10"] },
  { id: "u-ananya", name: "Ananya Sharma", initials: "AS", role: "teacher", email: "ananya.sharma@greenfield.edu.in", title: "Mathematics teacher", subjects: ["Mathematics"], grades: ["9", "10"] },
  { id: "u-farhan", name: "Farhan Qureshi", initials: "FQ", role: "teacher", email: "farhan.qureshi@greenfield.edu.in", title: "English teacher", subjects: ["English"], grades: ["10"] },
  { id: "u-kavita", name: "Kavita Nair", initials: "KN", role: "teacher", email: "kavita.nair@greenfield.edu.in", title: "Social Science teacher", subjects: ["Social Science"], grades: ["8"] },
  { id: "u-suresh", name: "Suresh Pillai", initials: "SP", role: "teacher", email: "suresh.pillai@greenfield.edu.in", title: "Science teacher", subjects: ["Science", "Mathematics"], grades: ["9", "10"] },
];

/* Students ----------------------------------------------------------- */
const FIRST_F = ["Aanya", "Diya", "Ishita", "Kavya", "Meghna", "Nisha", "Pooja", "Riya", "Saanvi", "Sneha", "Tanvi", "Zara", "Aditi", "Bhavya", "Fatima", "Gauri", "Harini", "Lavanya"];
const FIRST_M = ["Aarav", "Arjun", "Dev", "Ishaan", "Kabir", "Karthik", "Mohit", "Nikhil", "Rohan", "Sahil", "Varun", "Vihaan", "Yash", "Aditya", "Imran", "Omkar", "Pranav", "Siddharth"];
const LAST = ["Mehta", "Kulkarni", "Reddy", "Nair", "Sharma", "Iyer", "Patil", "Banerjee", "Khan", "Joshi", "Gupta", "Menon", "Rao", "Singh", "Chopra", "Das", "Pillai", "Verma", "Bhat", "Saxena", "Shetty", "Mishra"];
const FATHER = ["Rajesh", "Suresh", "Anil", "Vikram", "Manoj", "Sanjay", "Prakash", "Ravi", "Ashok", "Imtiaz"];
const MOTHER = ["Sunita", "Lakshmi", "Anjali", "Rekha", "Kavitha", "Shabana", "Deepa", "Geeta", "Usha", "Padma"];

function makeStudents(): Student[] {
  const out: Student[] = [];
  const cohorts: [string, string][] = [["10", "A"], ["10", "B"], ["9", "A"], ["9", "B"], ["8", "A"]];
  let adm = 312;
  cohorts.forEach(([grade, section], ci) => {
    const r = rng(1000 + ci * 77);
    for (let roll = 1; roll <= 32; roll++) {
      const female = r() > 0.5;
      const first = (female ? FIRST_F : FIRST_M)[Math.floor(r() * 18)];
      const last = LAST[Math.floor(r() * LAST.length)];
      const guardianMother = r() > 0.55;
      const gFirst = (guardianMother ? MOTHER : FATHER)[Math.floor(r() * 10)];
      const phone = `+91 9${String(Math.floor(100000000 + r() * 899999999)).slice(0, 4)} ${String(Math.floor(10000 + r() * 89999))}`;
      adm += 1 + Math.floor(r() * 3);
      const id = `st-${grade}${section.toLowerCase()}-${String(roll).padStart(2, "0")}`;
      out.push({
        id,
        name: `${first} ${last}`,
        grade,
        section,
        roll,
        city: "Bengaluru",
        barcode: `GPS${grade.padStart(2, "0")}${section}${String(adm).padStart(5, "0")}`,
        guardian: {
          name: `${gFirst} ${last}`,
          relation: guardianMother ? "Mother" : "Father",
          phone,
        },
      });
    }
  });
  // A guardian without a registered phone (drives "skipped" SMS state)
  const noPhone = out.find((s) => s.id === "st-10b-21");
  if (noPhone) noPhone.guardian.phone = null;
  return out;
}
export const STUDENTS = makeStudents();

/* Evaluation engine (mock) ------------------------------------------ */
/** Deterministically "evaluates" one student's booklet against an assessment's questions. */
export function evaluate(questions: Question[], studentId: string, pages: number, salt = 0): QuestionEval[] {
  const r = rng(hash(studentId) + salt);
  const ability = r(); // per-student skill
  const perPage: Record<number, number> = {};
  return questions.map((qq, idx) => {
    const vs = qq.variants;
    let vi = 0;
    if (vs.length > 0) {
      const roll = r() * 0.75 + (1 - ability) * 0.45;
      vi = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2;
      vi = Math.min(vi, vs.length - 1);
    }
    const fallbackHit = qq.criteria.slice(0, Math.max(1, Math.ceil(qq.criteria.length * (0.4 + ability * 0.6)))).map((x) => x.id);
    const variant = vs[vi] ?? {
      text: `Answer to question ${qq.number} as written in the booklet.`,
      hit: fallbackHit,
      confidence: 0.82,
      feedback: fallbackHit.length === qq.criteria.length ? "Complete answer." : "Cover every point in the rubric.",
      explanation: `${fallbackHit.length} of ${qq.criteria.length} rubric criteria matched.`,
    };
    const matched = variant.hit;
    const awarded = qq.criteria.filter((cr) => matched.includes(cr.id)).reduce((s, cr) => s + cr.marks, 0);
    const conf = Math.max(0.3, Math.min(0.995, variant.confidence + (r() - 0.5) * 0.06));
    const page = Math.min(pages, Math.max(1, Math.round(((idx + 0.5) / questions.length) * pages)));
    const slot = perPage[page] ?? 0;
    perPage[page] = slot + 1;
    const review = !!variant.flag || conf < 0.7;
    return {
      qid: qq.id,
      awarded,
      aiAwarded: awarded,
      extracted: variant.text,
      page,
      regionTop: 8 + slot * 30,
      regionHeight: qq.marks >= 4 ? 34 : qq.marks >= 3 ? 26 : 14,
      matched,
      explanation: variant.explanation,
      feedback: variant.feedback,
      confidence: Math.round(conf * 100) / 100,
      review,
      reason: variant.flag ?? (conf < 0.7 ? "low_confidence" : undefined),
      edited: false,
      flagged: false,
    };
  });
}

export function generalFeedbackFor(evals: QuestionEval[], total: number): string {
  const got = evals.reduce((s, e) => s + e.awarded, 0);
  const pct = got / total;
  if (pct >= 0.85) return "Strong, well-structured answers. Keep showing full working in numericals.";
  if (pct >= 0.65) return "Good grasp of most concepts. Revise the steps you skipped and label diagrams fully.";
  if (pct >= 0.45) return "Fair attempt. Focus on complete definitions and showing each step of the working.";
  return "Revise the core chapters and practise writing complete answers. Meet your teacher for a revision plan.";
}

/* Assessments -------------------------------------------------------- */
const sumMarks = (qs: Question[]) => qs.reduce((s, x) => s + x.marks, 0);

export function makeAssessments(): Assessment[] {
  return [
    {
      id: "asm-sci10-mid",
      name: "Science Midterm",
      academicYear: "2025–26",
      grade: "10",
      sections: ["A", "B"],
      subject: "Science",
      type: "Midterm",
      examDate: "2026-03-09",
      totalMarks: sumMarks(SCIENCE_10_QUESTIONS),
      durationMin: 120,
      instructions: "All questions are compulsory. Draw diagrams wherever necessary.",
      ownerId: "u-meera",
      teacherIds: ["u-meera", "u-rahul"],
      deadline: "2026-03-21",
      paper: { version: 2, fileName: "Class10_Science_Midterm_QP_v2.pdf", pages: 4, uploadedAt: iso(14 * DAY), uploadedBy: "u-meera" },
      paperHistory: [
        { version: 1, fileName: "Class10_Science_Midterm_QP.pdf", pages: 4, uploadedAt: iso(15 * DAY), uploadedBy: "u-meera" },
        { version: 2, fileName: "Class10_Science_Midterm_QP_v2.pdf", pages: 4, uploadedAt: iso(14 * DAY), uploadedBy: "u-meera" },
      ],
      questionsConfirmed: true,
      answerKey: { mode: "ai", status: "approved", version: 1, approvedAt: iso(13 * DAY), approvedBy: "u-meera" },
      rubric: { status: "approved", version: 2, approvedAt: iso(12 * DAY), approvedBy: "u-meera" },
      questions: SCIENCE_10_QUESTIONS,
    },
    {
      id: "asm-eng10-ut1",
      name: "English Unit Test 1",
      academicYear: "2025–26",
      grade: "10",
      sections: ["A", "B"],
      subject: "English",
      type: "Unit test",
      examDate: "2026-02-12",
      totalMarks: sumMarks(ENGLISH_10_QUESTIONS),
      durationMin: 60,
      ownerId: "u-farhan",
      teacherIds: ["u-farhan"],
      deadline: "2026-02-20",
      paper: { version: 1, fileName: "Class10_English_UT1.pdf", pages: 2, uploadedAt: iso(40 * DAY), uploadedBy: "u-farhan" },
      paperHistory: [{ version: 1, fileName: "Class10_English_UT1.pdf", pages: 2, uploadedAt: iso(40 * DAY), uploadedBy: "u-farhan" }],
      questionsConfirmed: true,
      answerKey: { mode: "manual", status: "approved", version: 1, approvedAt: iso(38 * DAY), approvedBy: "u-farhan", manualFile: "English_UT1_Key.pdf" },
      rubric: { status: "approved", version: 1, approvedAt: iso(38 * DAY), approvedBy: "u-farhan" },
      questions: ENGLISH_10_QUESTIONS,
    },
    {
      id: "asm-mat10-ut2",
      name: "Mathematics Unit Test 2",
      academicYear: "2025–26",
      grade: "10",
      sections: ["A", "B"],
      subject: "Mathematics",
      type: "Unit test",
      examDate: "2026-03-16",
      totalMarks: sumMarks(MATHS_10_QUESTIONS),
      durationMin: 60,
      ownerId: "u-ananya",
      teacherIds: ["u-ananya", "u-suresh"],
      deadline: "2026-03-25",
      paper: { version: 1, fileName: "Class10_Maths_UT2.pdf", pages: 2, uploadedAt: iso(6 * DAY), uploadedBy: "u-ananya" },
      paperHistory: [{ version: 1, fileName: "Class10_Maths_UT2.pdf", pages: 2, uploadedAt: iso(6 * DAY), uploadedBy: "u-ananya" }],
      questionsConfirmed: true,
      answerKey: { mode: "ai", status: "approved", version: 1, approvedAt: iso(5 * DAY), approvedBy: "u-ananya" },
      rubric: { status: "approved", version: 1, approvedAt: iso(5 * DAY), approvedBy: "u-ananya" },
      questions: MATHS_10_QUESTIONS,
    },
    {
      id: "asm-mat9-mid",
      name: "Mathematics Midterm",
      academicYear: "2025–26",
      grade: "9",
      sections: ["A", "B"],
      subject: "Mathematics",
      type: "Midterm",
      examDate: "2026-03-24",
      totalMarks: 13,
      durationMin: 90,
      ownerId: "u-ananya",
      teacherIds: ["u-ananya"],
      paper: { version: 1, fileName: "Class9_Maths_Midterm.pdf", pages: 3, uploadedAt: iso(3 * DAY), uploadedBy: "u-ananya" },
      paperHistory: [{ version: 1, fileName: "Class9_Maths_Midterm.pdf", pages: 3, uploadedAt: iso(3 * DAY), uploadedBy: "u-ananya" }],
      questionsConfirmed: true,
      answerKey: { mode: "ai", status: "approved", version: 1, approvedAt: iso(2 * DAY), approvedBy: "u-ananya" },
      rubric: { status: "draft", version: 0 },
      questions: MATHS_9_QUESTIONS,
    },
    {
      id: "asm-sci9-ut2",
      name: "Science Unit Test 2",
      academicYear: "2025–26",
      grade: "9",
      sections: ["A", "B"],
      subject: "Science",
      type: "Unit test",
      examDate: "2026-03-27",
      totalMarks: 15,
      durationMin: 45,
      ownerId: "u-meera",
      teacherIds: ["u-meera"],
      paper: { version: 1, fileName: "Class9_Science_UT2.pdf", pages: 2, uploadedAt: iso(1 * DAY), uploadedBy: "u-meera" },
      paperHistory: [{ version: 1, fileName: "Class9_Science_UT2.pdf", pages: 2, uploadedAt: iso(1 * DAY), uploadedBy: "u-meera" }],
      questionsConfirmed: true,
      answerKey: { mode: null, status: "none", version: 0 },
      rubric: { status: "none", version: 0 },
      questions: SCIENCE_9_QUESTIONS,
    },
    {
      id: "asm-sst8-ut2",
      name: "Social Science Unit Test 2",
      academicYear: "2025–26",
      grade: "8",
      sections: ["A"],
      subject: "Social Science",
      type: "Unit test",
      examDate: "2026-03-30",
      totalMarks: 16,
      durationMin: 45,
      ownerId: "u-kavita",
      teacherIds: ["u-kavita"],
      paper: { version: 1, fileName: "Class8_SST_UT2_scan.jpg", pages: 2, uploadedAt: iso(5 * HOUR), uploadedBy: "u-kavita" },
      paperHistory: [{ version: 1, fileName: "Class8_SST_UT2_scan.jpg", pages: 2, uploadedAt: iso(5 * HOUR), uploadedBy: "u-kavita" }],
      questionsConfirmed: false,
      answerKey: { mode: null, status: "none", version: 0 },
      rubric: { status: "none", version: 0 },
      questions: SST_8_QUESTIONS,
    },
  ];
}

/* Draft AI rubric for Class 9 Maths: Q3 criteria sum 5 vs 4 marks (blocked) */
MATHS_9_QUESTIONS[2].criteria = [
  { id: "c1", label: "Semi-perimeter", marks: 1 },
  { id: "c2", label: "Heron's formula", marks: 1 },
  { id: "c3", label: "Substitution and simplification", marks: 1 },
  { id: "c4", label: "Answer with unit", marks: 2 },
];

/* Answer sheets ------------------------------------------------------ */
interface SeedResult {
  sheets: AnswerSheet[];
  batches: UploadBatch[];
  unmatched: UnmatchedItem[];
  distributions: Distribution[];
}

function baseSheet(a: Assessment, st: Student, batchId: string, pages: number, teacherId: string | null): AnswerSheet {
  const questions = evaluate(a.questions, st.id, pages);
  return {
    id: `as-${a.id.replace("asm-", "")}-${st.id.replace("st-", "")}`,
    assessmentId: a.id,
    studentId: st.id,
    batchId,
    pages,
    blankPages: [],
    missingPages: [],
    evaluation: "evaluated",
    stage: 4,
    attempts: 1,
    verification: "not_started",
    teacherId,
    version: 1,
    questions,
    generalFeedback: generalFeedbackFor(questions, a.totalMarks),
    rubricVersion: a.rubric.version,
    answerKeyVersion: a.answerKey.version,
    model: MODEL_VERSION,
  };
}

export function makeToken(seed: string) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const r = rng(hash(seed));
  return Array.from({ length: 10 }, () => chars[Math.floor(r() * chars.length)]).join("");
}

export function seedSheets(assessments: Assessment[]): SeedResult {
  const sci = assessments.find((a) => a.id === "asm-sci10-mid")!;
  const eng = assessments.find((a) => a.id === "asm-eng10-ut1")!;
  const tenA = STUDENTS.filter((s) => s.grade === "10" && s.section === "A");
  const tenB = STUDENTS.filter((s) => s.grade === "10" && s.section === "B");
  const sheets: AnswerSheet[] = [];
  const distributions: Distribution[] = [];

  /* English: completed, all verified and released */
  [...tenA, ...tenB].forEach((st, i) => {
    const sh = baseSheet(eng, st, st.section === "A" ? "bt-eng-a" : "bt-eng-b", 4, "u-farhan");
    sh.verification = "verified";
    sh.verifiedAt = iso(30 * DAY - i * 20 * MIN);
    sh.verifiedBy = "u-farhan";
    sh.verifiedVersion = 1;
    sheets.push(sh);
    const failed = i === 9 || i === 40;
    const skipped = st.guardian.phone === null;
    distributions.push({
      id: `ds-eng-${i}`,
      runId: "run-eng-1",
      sheetId: sh.id,
      assessmentId: eng.id,
      studentId: st.id,
      phone: st.guardian.phone,
      status: skipped ? "skipped" : failed ? "failed" : "delivered",
      reason: skipped ? "No guardian phone on record" : failed ? (i === 9 ? "Number unreachable" : "Blocked by DND registry") : undefined,
      version: 1,
      verified: true,
      sentAt: iso(29 * DAY),
      token: makeToken(sh.id),
      expiresAt: new Date(NOW - 15 * DAY).toISOString(),
      revoked: false,
      attempts: failed ? 2 : 1,
      openedAt: !failed && !skipped && i % 3 !== 0 ? iso(28 * DAY) : undefined,
    });
  });

  /* Science 10A: Meera. Roll no 7 missing barcode (unmatched). Roll no 22 individual upload. */
  tenA.forEach((st, i) => {
    if (st.roll === 7) return;
    const batch = st.roll === 22 ? "bt-sci-ind" : "bt-sci-a";
    const sh = baseSheet(sci, st, batch, 8, "u-meera");
    sh.rubricVersion = 2;
    if (st.roll === 12) sh.blankPages = [6];
    if (st.roll <= 15) {
      sh.verification = "verified";
      sh.verifiedAt = iso((3 * DAY) - i * 40 * MIN);
      sh.verifiedBy = "u-meera";
      sh.verifiedVersion = 1;
      sh.draftSavedAt = sh.verifiedAt;
    } else if (st.roll <= 18) {
      sh.verification = "in_progress";
      sh.draftSavedAt = iso(2 * HOUR + i * MIN);
      const qe = sh.questions[5];
      if (qe) {
        qe.edited = true;
        qe.editReason = "Answer covers chlorophyll implicitly";
        qe.awarded = Math.min(5, qe.aiAwarded + 1);
      }
    } else if (st.roll === 19) {
      sh.verification = "reopened";
      sh.version = 2;
      sh.verifiedVersion = 1;
      sh.verifiedBy = "u-meera";
      sh.verifiedAt = iso(2 * DAY);
      sh.reopenReason = "Question 7 working was on page 5; marks recalculated";
    }
    sheets.push(sh);
  });

  /* Science 10B: Rahul. Roll no 15 unknown barcode (unmatched). Rolls 28–32 unassigned. */
  let processing = 0;
  tenB.forEach((st, i) => {
    if (st.roll === 15) return;
    const unassigned = st.roll >= 28;
    const sh = baseSheet(sci, st, "bt-sci-b", 8, unassigned ? null : "u-rahul");
    sh.rubricVersion = 2;
    if (st.roll === 9) sh.missingPages = [7];
    if (st.roll <= 10 && st.roll !== 9) {
      sh.verification = "verified";
      sh.verifiedAt = iso(2 * DAY - i * 30 * MIN);
      sh.verifiedBy = "u-rahul";
      sh.verifiedVersion = 1;
    } else if (st.roll === 9) {
      sh.evaluation = "needs_review";
      sh.error = "Page 7 missing from booklet. Questions 11 and 12 could not be located.";
    } else if (st.roll === 11 || st.roll === 12) {
      sh.verification = "in_progress";
      sh.draftSavedAt = iso(5 * HOUR);
    } else if (st.roll >= 24 && st.roll <= 27) {
      // live queue
      processing++;
      if (st.roll === 27) {
        sh.evaluation = "failed";
        sh.attempts = 3;
        sh.stage = 0;
        sh.error = "Handwriting extraction timed out after 3 attempts";
      } else if (st.roll === 26) {
        sh.evaluation = "queued";
        sh.stage = 0;
        sh.attempts = 0;
      } else {
        sh.evaluation = "processing";
        sh.stage = st.roll === 24 ? 2 : 1;
      }
    }
    sheets.push(sh);
  });

  /* Science releases: 10A verified rolls 1–10, 10B rolls 1–6, and one provisional (10B roll no 13) */
  const releaseSci = sheets.filter((s) => {
    if (s.assessmentId !== sci.id) return false;
    const st = STUDENTS.find((x) => x.id === s.studentId)!;
    return (st.section === "A" && st.roll <= 10) || (st.section === "B" && (st.roll <= 6 || st.roll === 13));
  });
  releaseSci.forEach((sh, i) => {
    const st = STUDENTS.find((x) => x.id === sh.studentId)!;
    const failed = st.section === "A" && st.roll === 4;
    distributions.push({
      id: `ds-sci-${i}`,
      runId: st.roll === 13 ? "run-sci-2" : "run-sci-1",
      sheetId: sh.id,
      assessmentId: sci.id,
      studentId: st.id,
      phone: st.guardian.phone,
      status: failed ? "failed" : "delivered",
      reason: failed ? "Number unreachable" : undefined,
      version: sh.version,
      verified: sh.verification === "verified",
      sentAt: st.roll === 13 ? iso(20 * HOUR) : iso(1 * DAY + 2 * HOUR),
      token: makeToken(sh.id),
      expiresAt: new Date(NOW + 13 * DAY).toISOString(),
      revoked: false,
      attempts: failed ? 2 : 1,
      openedAt: !failed && i % 2 === 0 ? iso(20 * HOUR) : undefined,
    });
  });

  const batches: UploadBatch[] = [
    { id: "bt-eng-a", assessmentId: eng.id, fileName: "Class10_English_UT1_SecA.pdf", kind: "bulk", uploadedBy: "u-admin", uploadedAt: iso(33 * DAY), sizeMb: 61.2, pages: 128, booklets: 32, stage: 5, progress: 100, status: "completed", mapped: 32, unmatched: 0, pageIssues: [] },
    { id: "bt-eng-b", assessmentId: eng.id, fileName: "Class10_English_UT1_SecB.pdf", kind: "bulk", uploadedBy: "u-admin", uploadedAt: iso(33 * DAY - 40 * MIN), sizeMb: 59.8, pages: 128, booklets: 32, stage: 5, progress: 100, status: "completed", mapped: 32, unmatched: 0, pageIssues: [] },
    { id: "bt-sci-a", assessmentId: sci.id, fileName: "Class10_Science_Midterm_SecA.pdf", kind: "bulk", uploadedBy: "u-admin", uploadedAt: iso(6 * DAY), sizeMb: 118.4, pages: 248, booklets: 31, stage: 5, progress: 100, status: "partial", mapped: 30, unmatched: 1, pageIssues: [{ page: 94, issue: "Blank page" }, { page: 131, issue: "Rotated 90°, auto-corrected" }] },
    { id: "bt-sci-b", assessmentId: sci.id, fileName: "Class10_Science_Midterm_SecB.pdf", kind: "bulk", uploadedBy: "u-admin", uploadedAt: iso(5 * DAY), sizeMb: 129.1, pages: 270, booklets: 34, stage: 5, progress: 100, status: "partial", mapped: 31, unmatched: 3, pageIssues: [{ page: 72, issue: "Missing page 7 in booklet" }, { page: 188, issue: "Low resolution (150 DPI)" }] },
    { id: "bt-sci-ind", assessmentId: sci.id, fileName: "Science_Midterm_10A_Roll22.pdf", kind: "individual", uploadedBy: "u-admin", uploadedAt: iso(4 * DAY), sizeMb: 3.6, pages: 8, booklets: 1, stage: 5, progress: 100, status: "completed", mapped: 1, unmatched: 0, pageIssues: [] },
  ];

  const s10a07 = STUDENTS.find((s) => s.id === "st-10a-07")!;
  const s10b15 = STUDENTS.find((s) => s.id === "st-10b-15")!;
  const s10b03 = STUDENTS.find((s) => s.id === "st-10b-03")!;
  const s9a11 = STUDENTS.find((s) => s.id === "st-9a-11")!;
  const unmatched: UnmatchedItem[] = [
    { id: "um-1", batchId: "bt-sci-a", assessmentId: sci.id, pagesFrom: 49, pagesTo: 56, decoded: null, reason: "missing_barcode", coverName: s10a07.name, coverRoll: "7", suggestedStudentId: s10a07.id, status: "open" },
    { id: "um-2", batchId: "bt-sci-b", assessmentId: sci.id, pagesFrom: 113, pagesTo: 120, decoded: s10b15.barcode.slice(0, -2) + "91", reason: "unknown_barcode", coverName: s10b15.name, coverRoll: "15", suggestedStudentId: s10b15.id, status: "open" },
    { id: "um-3", batchId: "bt-sci-b", assessmentId: sci.id, pagesFrom: 25, pagesTo: 32, decoded: s10b03.barcode, reason: "duplicate_barcode", coverName: s10b03.name, coverRoll: "3", conflictSheetId: `as-sci10-mid-10b-03`, status: "open" },
    { id: "um-4", batchId: "bt-sci-b", assessmentId: sci.id, pagesFrom: 263, pagesTo: 270, decoded: s9a11.barcode, reason: "not_in_cohort", coverName: s9a11.name, coverRoll: "11", suggestedStudentId: s9a11.id, status: "open" },
  ];

  return { sheets, batches, unmatched, distributions };
}

/* Audit ------------------------------------------------------------- */
export function seedAudit(): AuditEvent[] {
  const e = (msAgo: number, actorId: string, category: AuditEvent["category"], action: string, target: string, detail?: string, href?: string): AuditEvent => ({
    id: `au-${msAgo}-${action.length}`,
    at: iso(msAgo),
    actorId,
    category,
    action,
    target,
    detail,
    href,
  });
  return [
    e(20 * HOUR, "u-admin", "distribution", "Released provisional copy", "Science Midterm · 10B roll no 13", "Sent without teacher verification. Labelled Not verified.", "/distribution"),
    e(26 * HOUR, "u-admin", "distribution", "Sent results by SMS", "Science Midterm · 16 copies", "15 delivered, 1 failed", "/distribution"),
    e(2 * DAY, "u-meera", "verification", "Reopened copy", "Science Midterm · 10A roll no 19", "Question 7 working was on page 5; marks recalculated", "/review/as-sci10-mid-10a-19"),
    e(2 * DAY + 3 * HOUR, "u-rahul", "verification", "Verified 10 copies", "Science Midterm · Class 10B"),
    e(3 * DAY, "u-meera", "verification", "Verified 15 copies", "Science Midterm · Class 10A"),
    e(4 * DAY, "u-admin", "upload", "Uploaded individual copy", "Science Midterm · 10A roll no 22", "Science_Midterm_10A_Roll22.pdf", "/assessments/asm-sci10-mid/students"),
    e(4 * DAY + 2 * HOUR, "u-admin", "review", "Assigned copies", "Science Midterm · 26 copies to Rahul Deshmukh", undefined, "/teachers"),
    e(4 * DAY + 2 * HOUR + 5 * MIN, "u-admin", "review", "Assigned copies", "Science Midterm · 31 copies to Meera Iyer", undefined, "/teachers"),
    e(5 * DAY, "u-admin", "upload", "Uploaded bulk PDF", "Class10_Science_Midterm_SecB.pdf", "270 pages · 34 booklets", "/assessments/asm-sci10-mid/students"),
    e(6 * DAY, "u-admin", "upload", "Uploaded bulk PDF", "Class10_Science_Midterm_SecA.pdf", "248 pages · 31 booklets", "/assessments/asm-sci10-mid/students"),
    e(12 * DAY, "u-meera", "assessment", "Approved rubric v2", "Science Midterm", "Q6 criteria changed. No copies evaluated yet.", "/assessments/asm-sci10-mid/setup/rubric"),
    e(13 * DAY, "u-meera", "assessment", "Approved answer key v1", "Science Midterm", "AI-generated, 2 answers edited", "/assessments/asm-sci10-mid/setup/answer-key"),
    e(14 * DAY, "u-meera", "assessment", "Replaced question paper", "Science Midterm", "v1 → v2 (Q11 marks corrected)", "/assessments/asm-sci10-mid/setup/paper"),
    e(1 * DAY, "u-ananya", "assessment", "Approved answer key v1", "Mathematics Midterm · Class 9", undefined, "/assessments/asm-mat9-mid/setup/answer-key"),
    e(5 * HOUR, "u-kavita", "assessment", "Uploaded question paper", "Social Science Unit Test 2 · Class 8", "Class8_SST_UT2_scan.jpg", "/assessments/asm-sst8-ut2/setup/paper"),
    e(3 * HOUR, "u-admin", "access", "Signed in", "Exam Cell"),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function seedNotifications(): Notification[] {
  return [
    { id: "nt-1", userId: "u-meera", at: iso(40 * MIN), title: "Verification deadline in 3 days", body: "Science Midterm · 17 copies left to verify by 21 Mar", href: "/teacher/pending", read: false, kind: "deadline" },
    { id: "nt-2", userId: "u-meera", at: iso(2 * DAY), title: "Re-verification required", body: "Science Midterm · 10A roll no 19 was reopened", href: "/review/as-sci10-mid-10a-19", read: false, kind: "reverify" },
    { id: "nt-3", userId: "u-meera", at: iso(4 * DAY), title: "31 copies assigned to you", body: "Science Midterm · Class 10A", href: "/teacher/pending", read: true, kind: "assigned" },
    { id: "nt-4", userId: "u-meera", at: iso(4 * DAY + HOUR), title: "AI evaluation completed", body: "Science Midterm · Class 10A, 31 copies", href: "/assessments/asm-sci10-mid", read: true, kind: "evaluated" },
    { id: "nt-5", userId: "u-admin", at: iso(1 * HOUR), title: "1 evaluation job failed", body: "Science Midterm · 10B roll no 27: handwriting extraction timed out", href: "/assessments/asm-sci10-mid/students", read: false, kind: "system" },
    { id: "nt-6", userId: "u-admin", at: iso(5 * DAY), title: "4 booklets need mapping", body: "Science Midterm uploads have unmatched barcodes", href: "/unmatched", read: false, kind: "system" },
    { id: "nt-7", userId: "u-admin", at: iso(26 * HOUR), title: "1 SMS failed", body: "Science Midterm · 10A roll no 4: number unreachable", href: "/distribution", read: true, kind: "system" },
  ];
}

export const SETTINGS: Settings = {
  schoolName: "Greenfield Public School",
  city: "Bengaluru",
  academicYear: "2025–26",
  unverifiedRelease: "warn",
  verificationAuthority: "teacher",
  reviewPolicy: "all",
  linkExpiryDays: 14,
  workers: 6,
  rateLimitPerMin: 120,
  scanDpi: 300,
  barcodeFormat: "school",
  emailNotifications: true,
  smsSender: "GRNFLD",
};

export const SEED_SUGGESTIONS: Suggestion[] = [];

export { DAY, HOUR, MIN };
