/* UI-02 Admin dashboard: Leadership view with Principal Academic Analysis & Exam Cell Operations */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileUp,
  Filter,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  MessageSquareWarning,
  Percent,
  ScanLine,
  Search,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../data/store";
import {
  ASSESSMENT_STATUS,
  assessmentStatus,
  cohortOf,
  countsFor,
  examTypeLabel,
  fmtShortDate,
  latestDistribution,
  num,
  pct,
  QTYPE_LABEL,
  relTime,
  sheetTotal,
} from "../data/selectors";
import type { Question, QuestionEval } from "../data/types";
import {
  Button,
  ButtonLink,
  Dialog,
  ICON,
  Input,
  Page,
  PageHeader,
  Panel,
  Segmented,
  Select,
  StackBar,
  StatusText,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  cx,
} from "../components/ui";

// Topic mapper for curriculum chapters across subjects
function getQuestionTopic(q: Question, subject: string): string {
  const text = (q.text + " " + q.answer + " " + (q.keyPoints || []).join(" ")).toLowerCase();

  if (subject === "Science") {
    if (text.includes("photosynthesis") || text.includes("chlorophyll") || text.includes("glucose"))
      return "Life Processes: Photosynthesis";
    if (text.includes("ph ") || text.includes("ph of") || text.includes("acid") || text.includes("base") || text.includes("zinc") || text.includes("hcl"))
      return "Acids, Bases & Chemical Reactions";
    if (text.includes("kidney") || text.includes("nephron") || text.includes("heart") || text.includes("circulation") || text.includes("blood"))
      return "Life Processes: Circulation & Excretion";
    if (text.includes("rusting") || text.includes("physical change") || text.includes("chemical change"))
      return "Chemical Reactions & Changes";
    if (text.includes("ohm") || text.includes("resistance") || text.includes("wire") || text.includes("potential difference"))
      return "Electricity: Resistance & Ohm's Law";
    if (text.includes("mirror") || text.includes("refraction") || text.includes("lens") || text.includes("glass slab") || text.includes("ray diagram"))
      return "Light: Reflection & Refraction";
    if (text.includes("biodegradable") || text.includes("waste") || text.includes("environment") || text.includes("polythene"))
      return "Our Environment & Waste Management";
    return "General Science Core";
  }

  if (subject === "Mathematics") {
    if (text.includes("hcf") || text.includes("lcm") || text.includes("prime") || text.includes("real number"))
      return "Real Numbers & Number Systems";
    if (text.includes("zeroes") || text.includes("polynomial") || text.includes("roots") || text.includes("factorisation") || text.includes("quadratic"))
      return "Polynomials & Quadratic Equations";
    if (text.includes("ap") || text.includes("arithmetic progression") || text.includes("term"))
      return "Arithmetic Progressions";
    if (text.includes("pythagoras") || text.includes("ladder") || text.includes("triangle"))
      return "Triangles & Coordinate Geometry";
    if (text.includes("circle") || text.includes("tangent") || text.includes("sector") || text.includes("radius"))
      return "Circles & Areas Related to Circles";
    if (text.includes("trigonometr") || text.includes("sin") || text.includes("cos") || text.includes("tan"))
      return "Trigonometry & Heights";
    return "General Mathematics Core";
  }

  if (subject === "English") {
    if (text.includes("letter") || text.includes("editor") || text.includes("writing"))
      return "Formal Writing: Letters & Articles";
    if (text.includes("passage") || text.includes("unseen") || text.includes("comprehension"))
      return "Reading Comprehension & Analysis";
    if (text.includes("verb") || text.includes("tense") || text.includes("grammar") || text.includes("fill in"))
      return "Applied Grammar & Syntax";
    if (text.includes("lencho") || text.includes("god") || text.includes("mandela") || text.includes("courage"))
      return "Literature: Prose & Textual Insights";
    return "General English Core";
  }

  if (subject === "Social Science") {
    if (text.includes("revolt") || text.includes("history") || text.includes("british") || text.includes("1857") || text.includes("plassey"))
      return "History: Freedom Struggle & Colonial Rule";
    if (text.includes("soil") || text.includes("resource") || text.includes("climate") || text.includes("geography"))
      return "Geography: Resources & Development";
    if (text.includes("constitution") || text.includes("democracy") || text.includes("rights") || text.includes("civics"))
      return "Civics: Democratic Institutions";
    return "General Social Science";
  }

  return "Curriculum Core Concepts";
}

// Diagnostic student error summary for question insights
function getQuestionDiagnostic(q: Question, accuracyPct: number): string {
  // Check if variants contain flagged or error-specific student feedback
  const errorVariants = q.variants.filter((v) => v.hit.length < q.criteria.length);
  if (errorVariants.length > 0) {
    const primaryError = errorVariants[0];
    if (primaryError.feedback && !primaryError.feedback.toLowerCase().includes("complete answer")) {
      return primaryError.feedback;
    }
    if (primaryError.explanation) {
      return primaryError.explanation;
    }
  }

  // Fallback diagnostic based on question type & accuracy
  if (accuracyPct < 45) {
    return `High cohort difficulty: Multiple criteria missed. Students struggled to apply key formulas and technical terms accurately.`;
  }
  if (accuracyPct < 70) {
    return `Partial credit trend: Most students grasped the basic concept but missed secondary rubric points or units.`;
  }
  return `Strong mastery: Students consistently met all primary criteria with accurate steps and terminology.`;
}

export default function AdminOverview() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // View mode: "principal" (Academic, Class & Question analysis) vs "examcell" (Operations, Pipeline funnel)
  const initialView = searchParams.get("view") === "examcell" ? "examcell" : "principal";
  const [viewMode, setViewMode] = useState<"principal" | "examcell">(initialView);

  // Synchronize view mode with URL query param
  const handleViewChange = (mode: "principal" | "examcell") => {
    setViewMode(mode);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("view", mode);
      return next;
    });
  };

  // Filters: 1. Exam Type -> 2. Class -> 3. Subject
  const [scope, setScope] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  // Principal View interactive controls
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [healthFilter, setHealthFilter] = useState<"all" | "critical" | "moderate" | "mastered">("all");
  const [questionSearch, setQuestionSearch] = useState("");
  const [onlyDisparity, setOnlyDisparity] = useState(false);
  const [inspectQuestion, setInspectQuestion] = useState<{ q: Question; subject: string; asmName: string } | null>(null);

  const active = state.assessments.filter((a) => !a.archived);

  // Available subjects and grades
  const subjects = useMemo(() => Array.from(new Set(active.map((a) => a.subject))).sort(), [active]);
  const grades = useMemo(() => Array.from(new Set(active.map((a) => a.grade))).sort((a, b) => Number(a) - Number(b)), [active]);

  // Available exams filtered by selected Subject and Class filters
  const filteredExams = useMemo(() => {
    return active.filter((a) => {
      if (subjectFilter !== "all" && a.subject !== subjectFilter) return false;
      if (gradeFilter !== "all" && a.grade !== gradeFilter) return false;
      return true;
    });
  }, [active, subjectFilter, gradeFilter]);

  // Unique clean exam types
  const availableExamTypes = useMemo(() => {
    const types = new Set<string>();
    filteredExams.forEach((a) => {
      types.add(examTypeLabel(a));
    });
    return Array.from(types).sort();
  }, [filteredExams]);

  // Reset exam scope to "all" if chosen exam type is excluded by subject/grade
  useEffect(() => {
    if (scope !== "all" && !availableExamTypes.includes(scope) && !filteredExams.some((a) => a.id === scope)) {
      setScope("all");
    }
  }, [availableExamTypes, filteredExams, scope]);

  // Apply filters to assessments
  const scoped = useMemo(() => {
    return active.filter((a) => {
      if (scope !== "all" && a.id !== scope && examTypeLabel(a) !== scope && a.type !== scope) return false;
      if (subjectFilter !== "all" && a.subject !== subjectFilter) return false;
      if (gradeFilter !== "all" && a.grade !== gradeFilter) return false;
      return true;
    });
  }, [active, scope, subjectFilter, gradeFilter]);

  const ids = useMemo(() => new Set(scoped.map((a) => a.id)), [scoped]);
  const sheets = useMemo(() => state.sheets.filter((s) => ids.has(s.assessmentId)), [state.sheets, ids]);
  const openUnmatched = useMemo(() => state.unmatched.filter((u) => u.status === "open" && ids.has(u.assessmentId)), [state.unmatched, ids]);
  const c = countsFor(sheets, state.distributions, state.students, openUnmatched.length, scoped);

  // Evaluated copies in scope
  const evaluatedSheets = useMemo(() => sheets.filter((s) => s.evaluation === "evaluated"), [sheets]);

  // Pass rate & school average calculations
  const scorePercentages = useMemo(() => {
    return evaluatedSheets.map((s) => {
      const a = state.assessments.find((x) => x.id === s.assessmentId);
      return a && a.totalMarks ? (sheetTotal(s) / a.totalMarks) * 100 : 0;
    });
  }, [evaluatedSheets, state.assessments]);

  const avgSchoolScore = scorePercentages.length ? Math.round(scorePercentages.reduce((a, b) => a + b, 0) / scorePercentages.length) : 0;
  const passRate = scorePercentages.length ? Math.round((scorePercentages.filter((p) => p >= 33).length / scorePercentages.length) * 100) : 0;
  const masteryRate = scorePercentages.length ? Math.round((scorePercentages.filter((p) => p >= 75).length / scorePercentages.length) * 100) : 0;
  const verificationCompletion = c.aiEvaluated ? pct(c.verified, c.aiEvaluated) : 0;

  // -------------------------------------------------------------------------
  // PRINCIPAL ANALYSIS 1: Class & Section-Wise Performance Matrix
  // -------------------------------------------------------------------------
  const sectionAnalytics = useMemo(() => {
    // Map section key -> aggregate scores
    const map = new Map<
      string,
      {
        section: string;
        grade: string;
        count: number;
        totalScorePct: number;
        scores: number[];
        passCount: number;
        masteryCount: number;
        topicScores: Map<string, { awarded: number; max: number }>;
      }
    >();

    evaluatedSheets.forEach((s) => {
      const student = state.students.find((st) => st.id === s.studentId);
      const a = state.assessments.find((x) => x.id === s.assessmentId);
      if (!student || !a || !a.totalMarks) return;

      const secKey = `Class ${student.grade}${student.section}`;
      const cur = map.get(secKey) || {
        section: `${student.grade}${student.section}`,
        grade: student.grade,
        count: 0,
        totalScorePct: 0,
        scores: [],
        passCount: 0,
        masteryCount: 0,
        topicScores: new Map(),
      };

      const scorePct = (sheetTotal(s) / a.totalMarks) * 100;
      cur.count += 1;
      cur.totalScorePct += scorePct;
      cur.scores.push(scorePct);
      if (scorePct >= 33) cur.passCount += 1;
      if (scorePct >= 75) cur.masteryCount += 1;

      // Track topic scores for this section
      s.questions.forEach((qe) => {
        const q = a.questions.find((x) => x.id === qe.qid);
        if (!q) return;
        const topic = getQuestionTopic(q, a.subject);
        const topStat = cur.topicScores.get(topic) || { awarded: 0, max: 0 };
        topStat.awarded += qe.awarded;
        topStat.max += q.marks;
        cur.topicScores.set(topic, topStat);
      });

      map.set(secKey, cur);
    });

    return Array.from(map.entries())
      .map(([secKey, d]) => {
        const avg = Math.round(d.totalScorePct / d.count);
        const pRate = Math.round((d.passCount / d.count) * 100);
        const mRate = Math.round((d.masteryCount / d.count) * 100);
        const minScore = Math.round(Math.min(...d.scores));
        const maxScore = Math.round(Math.max(...d.scores));

        // Find weakest and strongest topic in this section
        let weakestTopic = "None";
        let weakestPct = 100;
        let strongestTopic = "None";
        let strongestPct = 0;

        d.topicScores.forEach((v, t) => {
          if (v.max > 0) {
            const p = Math.round((v.awarded / v.max) * 100);
            if (p < weakestPct) {
              weakestPct = p;
              weakestTopic = `${t} (${p}%)`;
            }
            if (p > strongestPct) {
              strongestPct = p;
              strongestTopic = `${t} (${p}%)`;
            }
          }
        });

        return {
          key: secKey,
          sectionName: d.section,
          grade: d.grade,
          count: d.count,
          average: avg,
          passRate: pRate,
          masteryRate: mRate,
          minScore,
          maxScore,
          weakestTopic,
          strongestTopic,
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [evaluatedSheets, state.students, state.assessments]);

  // -------------------------------------------------------------------------
  // PRINCIPAL ANALYSIS 2: Weak Topics Across Sections (Action Matrix)
  // -------------------------------------------------------------------------
  const topicMatrix = useMemo(() => {
    // Map topic name -> aggregate stats and section breakdowns
    const map = new Map<
      string,
      {
        topic: string;
        subject: string;
        questionCount: number;
        totalMaxMarks: number;
        cohortAwarded: number;
        cohortPossible: number;
        sectionStats: Map<string, { awarded: number; max: number; count: number }>;
      }
    >();

    // Accumulate marks across evaluated sheets
    evaluatedSheets.forEach((s) => {
      const student = state.students.find((st) => st.id === s.studentId);
      const a = state.assessments.find((x) => x.id === s.assessmentId);
      if (!student || !a) return;

      const secLabel = `${student.grade}${student.section}`;

      s.questions.forEach((qe) => {
        const q = a.questions.find((x) => x.id === qe.qid);
        if (!q) return;
        const topic = getQuestionTopic(q, a.subject);

        const cur = map.get(topic) || {
          topic,
          subject: a.subject,
          questionCount: 0,
          totalMaxMarks: 0,
          cohortAwarded: 0,
          cohortPossible: 0,
          sectionStats: new Map(),
        };

        cur.cohortAwarded += qe.awarded;
        cur.cohortPossible += q.marks;

        const secStat = cur.sectionStats.get(secLabel) || { awarded: 0, max: 0, count: 0 };
        secStat.awarded += qe.awarded;
        secStat.max += q.marks;
        secStat.count += 1;
        cur.sectionStats.set(secLabel, secStat);

        map.set(topic, cur);
      });
    });

    // Populate question counts and weightage from distinct scoped assessments
    scoped.forEach((a) => {
      a.questions.forEach((q) => {
        const topic = getQuestionTopic(q, a.subject);
        const cur = map.get(topic);
        if (cur) {
          cur.questionCount += 1;
          cur.totalMaxMarks += q.marks;
        }
      });
    });

    return Array.from(map.values())
      .map((t) => {
        const cohortAccuracy = t.cohortPossible > 0 ? Math.round((t.cohortAwarded / t.cohortPossible) * 100) : 0;

        const sections = Array.from(t.sectionStats.entries())
          .map(([sec, st]) => ({
            section: sec,
            accuracy: st.max > 0 ? Math.round((st.awarded / st.max) * 100) : 0,
            samples: st.count,
          }))
          .sort((a, b) => a.section.localeCompare(b.section));

        const accuracies = sections.map((s) => s.accuracy);
        const disparity = accuracies.length > 1 ? Math.max(...accuracies) - Math.min(...accuracies) : 0;

        let status: "critical" | "moderate" | "mastered" = "mastered";
        if (cohortAccuracy < 50) status = "critical";
        else if (cohortAccuracy < 70) status = "moderate";

        // AI Pedagogical diagnosis and recommendation
        let recommendation = "";
        if (disparity >= 15 && sections.length >= 2) {
          const highest = sections.reduce((p, c) => (c.accuracy > p.accuracy ? c : p), sections[0]);
          const lowest = sections.reduce((p, c) => (c.accuracy < p.accuracy ? c : p), sections[0]);
          recommendation = `High Section Disparity (${disparity}% gap): Section ${lowest.section} (${lowest.accuracy}%) trailed behind Section ${highest.section} (${highest.accuracy}%). Recommend teacher coordination & co-teaching remediation.`;
        } else if (cohortAccuracy < 50) {
          recommendation = `Cohort Conceptual Block: Over ${100 - cohortAccuracy}% marks lost school-wide. Schedule a 2-period structured revision session focusing on fundamentals & step-by-step problem sets.`;
        } else if (cohortAccuracy < 70) {
          recommendation = `Moderate Learning Gap: Students grasped definitions but struggled with application and reasoning. Assign targeted homework worksheets.`;
        } else {
          recommendation = `Concept Mastered: Consistent high performance across all sections. Proceed to advanced application problems.`;
        }

        return {
          topic: t.topic,
          subject: t.subject,
          questionCount: Math.max(1, Math.round(t.questionCount / Math.max(1, scoped.length))),
          weightageMarks: Math.max(1, Math.round(t.totalMaxMarks / Math.max(1, scoped.length))),
          cohortAccuracy,
          sections,
          disparity,
          status,
          recommendation,
        };
      })
      .sort((a, b) => a.cohortAccuracy - b.cohortAccuracy); // Sort weakest topics first
  }, [evaluatedSheets, state.students, state.assessments, scoped]);

  // Unique topics list for filter dropdown
  const allTopicNames = useMemo(() => {
    return Array.from(new Set(topicMatrix.map((t) => t.topic))).sort();
  }, [topicMatrix]);

  // -------------------------------------------------------------------------
  // PRINCIPAL ANALYSIS 3: Question-by-Question Deep Dive Analysis
  // -------------------------------------------------------------------------
  const questionAnalytics = useMemo(() => {
    // Map question ID -> aggregate statistics across evaluated copies
    const map = new Map<
      string,
      {
        question: Question;
        assessment: (typeof scoped)[0];
        topic: string;
        totalAwarded: number;
        totalMax: number;
        attempts: number;
        sectionStats: Map<string, { awarded: number; max: number; count: number }>;
      }
    >();

    // Iterate through scoped assessments and their questions
    scoped.forEach((a) => {
      a.questions.forEach((q) => {
        const topic = getQuestionTopic(q, a.subject);
        map.set(`${a.id}-${q.id}`, {
          question: q,
          assessment: a,
          topic,
          totalAwarded: 0,
          totalMax: 0,
          attempts: 0,
          sectionStats: new Map(),
        });
      });
    });

    // Aggregate student performance on each question
    evaluatedSheets.forEach((s) => {
      const student = state.students.find((st) => st.id === s.studentId);
      const a = state.assessments.find((x) => x.id === s.assessmentId);
      if (!student || !a) return;

      const secLabel = `${student.grade}${student.section}`;

      s.questions.forEach((qe) => {
        const entry = map.get(`${a.id}-${qe.qid}`);
        if (!entry) return;

        entry.totalAwarded += qe.awarded;
        entry.totalMax += entry.question.marks;
        entry.attempts += 1;

        const secStat = entry.sectionStats.get(secLabel) || { awarded: 0, max: 0, count: 0 };
        secStat.awarded += qe.awarded;
        secStat.max += entry.question.marks;
        secStat.count += 1;
        entry.sectionStats.set(secLabel, secStat);
      });
    });

    return Array.from(map.values())
      .filter((entry) => entry.attempts > 0)
      .map((entry) => {
        const cohortAccuracy = entry.totalMax > 0 ? Math.round((entry.totalAwarded / entry.totalMax) * 100) : 0;
        const avgAwarded = entry.attempts > 0 ? Number((entry.totalAwarded / entry.attempts).toFixed(1)) : 0;

        const sections = Array.from(entry.sectionStats.entries())
          .map(([sec, st]) => ({
            section: sec,
            accuracy: st.max > 0 ? Math.round((st.awarded / st.max) * 100) : 0,
            avgScore: st.count > 0 ? Number((st.awarded / st.count).toFixed(1)) : 0,
          }))
          .sort((a, b) => a.section.localeCompare(b.section));

        const accuracies = sections.map((s) => s.accuracy);
        const disparity = accuracies.length > 1 ? Math.max(...accuracies) - Math.min(...accuracies) : 0;

        let status: "critical" | "moderate" | "mastered" = "mastered";
        if (cohortAccuracy < 50) status = "critical";
        else if (cohortAccuracy < 70) status = "moderate";

        const diagnostic = getQuestionDiagnostic(entry.question, cohortAccuracy);

        return {
          id: `${entry.assessment.id}-${entry.question.id}`,
          question: entry.question,
          assessment: entry.assessment,
          topic: entry.topic,
          marks: entry.question.marks,
          attempts: entry.attempts,
          cohortAccuracy,
          avgAwarded,
          sections,
          disparity,
          status,
          diagnostic,
        };
      })
      .sort((a, b) => a.cohortAccuracy - b.cohortAccuracy);
  }, [scoped, evaluatedSheets, state.students]);

  // Filtered Questions for the table
  const filteredQuestions = useMemo(() => {
    return questionAnalytics.filter((qa) => {
      if (selectedTopic !== "all" && qa.topic !== selectedTopic) return false;
      if (healthFilter !== "all" && qa.status !== healthFilter) return false;
      if (onlyDisparity && qa.disparity < 15) return false;
      if (questionSearch.trim()) {
        const term = questionSearch.toLowerCase();
        const matchesQ =
          qa.question.text.toLowerCase().includes(term) ||
          qa.question.number.toLowerCase().includes(term) ||
          qa.topic.toLowerCase().includes(term) ||
          qa.diagnostic.toLowerCase().includes(term);
        if (!matchesQ) return false;
      }
      return true;
    });
  }, [questionAnalytics, selectedTopic, healthFilter, onlyDisparity, questionSearch]);

  // High section disparities count
  const criticalWeakTopicCount = topicMatrix.filter((t) => t.status === "critical").length;
  const highDisparityCount = topicMatrix.filter((t) => t.disparity >= 15).length;

  // -------------------------------------------------------------------------
  // EXAM CELL VIEW: Operations Pipeline Funnel & Alert Feed
  // -------------------------------------------------------------------------
  const funnel = [
    { label: "Expected students", value: c.expected, note: `${scoped.filter((a) => a.paper && a.questionsConfirmed).length} exams`, to: "/assessments" },
    { label: "Uploaded copies", value: c.uploaded, note: c.unmatched ? `${c.unmatched} need mapping` : "All mapped", warn: c.unmatched > 0, to: c.unmatched ? "/unmatched" : "/assessments" },
    { label: "Identified", value: c.identified, note: `${pct(c.identified, c.uploaded)}% of uploaded`, to: "/assessments" },
    { label: "AI evaluated", value: c.aiEvaluated, note: c.failed + c.needsReview ? `${c.pendingEvaluation} in queue · ${c.failed + c.needsReview} exceptions` : `${c.pendingEvaluation} in queue`, warn: c.failed + c.needsReview > 0, to: "/queue" },
    { label: "Verified", value: c.verified, note: `${c.pendingVerification} pending verification`, to: "/verification" },
    { label: "Distributed", value: c.distributed, note: c.smsFailed ? `${c.smsFailed} SMS failed` : c.provisional ? `${c.provisional} not verified` : "No failures", warn: c.smsFailed > 0, to: "/distribution" },
  ];

  const attention = useMemo(() => {
    const items: { icon: typeof AlertTriangle; tone: "danger" | "warning" | "info"; title: string; body: string; to: string; action: string }[] = [];
    if (openUnmatched.length)
      items.push({ icon: ScanLine, tone: "warning", title: `${openUnmatched.length} booklets can't be identified`, body: "They stay out of evaluation until mapped to students", to: "/unmatched", action: "Map booklets" });
    const failed = sheets.filter((s) => s.evaluation === "failed");
    const nr = sheets.filter((s) => s.evaluation === "needs_review");
    if (failed.length || nr.length)
      items.push({ icon: Workflow, tone: "danger", title: `${failed.length + nr.length} evaluation ${failed.length + nr.length === 1 ? "job needs" : "jobs need"} action`, body: [failed.length && `${failed.length} failed`, nr.length && `${nr.length} with missing pages`].filter(Boolean).join(" · "), to: "/assessments", action: "Open exams" });
    const smsFailed = state.distributions.filter((d) => ids.has(d.assessmentId) && d.status === "failed" && latestDistribution(d.sheetId, state.distributions)?.id === d.id);
    if (smsFailed.length) items.push({ icon: MessageSquareWarning, tone: "danger", title: `${smsFailed.length} SMS not delivered`, body: "Guardians haven't received these results", to: "/distribution", action: "Retry" });
    const unassigned = sheets.filter((s) => !s.teacherId && s.evaluation === "evaluated");
    if (unassigned.length) items.push({ icon: FileUp, tone: "info", title: `${unassigned.length} evaluated copies unassigned`, body: "No teacher assigned to verify them yet", to: "/teachers", action: "Assign" });
    const reopened = sheets.filter((s) => s.verification === "reopened");
    if (reopened.length) items.push({ icon: ShieldAlert, tone: "warning", title: `${reopened.length} ${reopened.length === 1 ? "copy" : "copies"} reopened`, body: "Waiting for re-verification", to: "/verification", action: "View" });
    const soon = scoped.filter((a) => a.deadline && new Date(a.deadline).getTime() - Date.now() < 9e15 && sheets.some((s) => s.assessmentId === a.id && s.verification !== "verified" && s.evaluation === "evaluated"));
    soon.slice(0, 1).forEach((a) => {
      const left = sheets.filter((s) => s.assessmentId === a.id && s.evaluation === "evaluated" && s.verification !== "verified").length;
      items.push({ icon: Timer, tone: "info", title: `${a.name} · Class ${a.grade} due ${fmtShortDate(a.deadline)}`, body: `${left} copies still to verify`, to: "/teachers", action: "Teachers" });
    });
    return items;
  }, [openUnmatched.length, sheets, state.distributions, ids, scoped]);

  const inFlight = scoped
    .map((a) => {
      const own = state.sheets.filter((s) => s.assessmentId === a.id);
      const expected = cohortOf(a, state.students).length;
      const evaluated = own.filter((s) => s.evaluation === "evaluated").length;
      const verified = own.filter((s) => s.verification === "verified").length;
      const released = own.filter((s) => latestDistribution(s.id, state.distributions)?.status === "delivered").length;
      return { a, status: assessmentStatus(a, state.sheets), expected, uploaded: own.length, evaluated, verified, released };
    })
    .sort((x, y) => (x.a.examDate < y.a.examDate ? 1 : -1));

  const recent = state.audit.slice(0, 6);
  const userName = (id: string) => (id === "system" ? "System" : id === "guardian" ? "Guardian" : state.users.find((u) => u.id === id)?.name ?? id);

  return (
    <Page wide>
      {/* Page Header */}
      <PageHeader
        title={viewMode === "principal" ? "Principal Academic Analytics" : "Exam Cell Operations Overview"}
        meta={
          <span>
            {viewMode === "principal"
              ? "Academic & Question-Wise Diagnostic · "
              : "Scanning Pipeline & Evaluation Operations · "}
            {state.settings.schoolName}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Exam Type Filter */}
            <Select aria-label="Exam type" value={scope} onChange={(e) => setScope(e.target.value)} className="w-44">
              <option value="all">All Exams</option>
              {availableExamTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>

            {/* 2. Class Filter */}
            <Select aria-label="Filter by class" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="w-32">
              <option value="all">All Classes</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </Select>

            {/* 3. Subject Filter */}
            <Select aria-label="Filter by subject" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="w-36">
              <option value="all">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </Select>

            <ButtonLink
              to={scoped.length === 1 ? `/assessments/${scoped[0].id}/students` : "/assessments"}
              variant="primary"
              icon={<FileUp size={16} strokeWidth={ICON} />}
            >
              Upload sheets
            </ButtonLink>
          </div>
        }
      />

      {/* Role View Switcher Segmented Control */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-2 shadow-xs">
        <div className="flex items-center gap-2">
          <Segmented
            value={viewMode}
            onChange={(val) => handleViewChange(val as "principal" | "examcell")}
            items={[
              {
                id: "principal",
                label: "Principal View (Class & Questions)",
                icon: <GraduationCap size={15} strokeWidth={ICON} className="text-primary" />,
              },
              {
                id: "examcell",
                label: "Exam Cell View (Operations & Funnel)",
                icon: <Workflow size={15} strokeWidth={ICON} className="text-ink-3" />,
              },
            ]}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-3">
          {viewMode === "principal" ? (
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <Sparkles size={14} /> Section comparisons & AI error diagnostics active
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Workflow size={14} /> Funnel bottlenecks & verification throughput active
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PRINCIPAL VIEW (ACADEMIC, CLASS & QUESTION-WISE ANALYSIS)        */}
      {/* ========================================================================= */}
      {viewMode === "principal" && (
        <div className="space-y-6">
          {/* Executive Academic Health KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Class Average</span>
                <TrendingUp size={16} className="text-primary" />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{evaluatedSheets.length ? `${avgSchoolScore}%` : "—"}</p>
              <p className="mt-0.5 text-xs text-ink-3">Target: 75% ({evaluatedSheets.length} evaluated)</p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Pass Rate</span>
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{evaluatedSheets.length ? `${passRate}%` : "—"}</p>
              <p className="mt-0.5 text-xs text-ink-3">Passing mark $\ge 33\%$</p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Concept Mastery</span>
                <Sparkles size={16} className="text-warning" />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{evaluatedSheets.length ? `${masteryRate}%` : "—"}</p>
              <p className="mt-0.5 text-xs text-ink-3">High achievers ($\ge 75\%$ score)</p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Weak Topics</span>
                <AlertTriangle size={16} className={criticalWeakTopicCount > 0 ? "text-danger" : "text-ink-4"} />
              </div>
              <p className={cx("mt-1 text-2xl font-bold tracking-tight", criticalWeakTopicCount > 0 ? "text-danger" : "text-ink")}>
                {criticalWeakTopicCount}
              </p>
              <p className="mt-0.5 text-xs text-ink-3">&lt; 50% cohort accuracy</p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Section Disparity</span>
                <TrendingDown size={16} className={highDisparityCount > 0 ? "text-warning" : "text-ink-4"} />
              </div>
              <p className={cx("mt-1 text-2xl font-bold tracking-tight", highDisparityCount > 0 ? "text-warning" : "text-ink")}>
                {highDisparityCount}
              </p>
              <p className="mt-0.5 text-xs text-ink-3">&ge; 15% delta between sections</p>
            </div>
          </div>

          {/* Class & Section-Wise Performance Matrix */}
          <Panel
            title={
              <div className="flex items-center gap-2">
                <Layers size={17} className="text-primary" />
                <span>Class & Section-Wise Performance Comparison</span>
              </div>
            }
            actions={<span className="text-xs text-ink-3">{sectionAnalytics.length} sections analyzed</span>}
          >
            {sectionAnalytics.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-3">No evaluated answer sheets matching the filter criteria.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionAnalytics.map((sec) => (
                    <div key={sec.key} className="rounded-lg border border-border bg-surface-muted/30 p-4 transition-all hover:border-primary/40">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex items-center rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                            Section {sec.sectionName}
                          </span>
                          <h3 className="mt-1.5 text-base font-semibold text-ink">{sec.key}</h3>
                          <p className="text-xs text-ink-3">{sec.count} students evaluated</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold tracking-tight text-ink">{sec.average}%</p>
                          <span className="text-xs font-medium text-ink-3">Section Avg</span>
                        </div>
                      </div>

                      {/* Section Progress Bar */}
                      <div className="mt-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                          <div
                            className={cx(
                              "h-full rounded-full transition-all",
                              sec.average >= 75 ? "bg-success" : sec.average >= 60 ? "bg-primary" : "bg-warning",
                            )}
                            style={{ width: `${sec.average}%` }}
                          />
                        </div>
                      </div>

                      {/* Metrics grid */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-xs">
                        <div>
                          <span className="text-ink-3">Pass Rate ($\ge 33\%$):</span>
                          <p className="font-semibold text-ink">{sec.passRate}%</p>
                        </div>
                        <div>
                          <span className="text-ink-3">Mastery ($\ge 75\%$):</span>
                          <p className="font-semibold text-ink">{sec.masteryRate}%</p>
                        </div>
                        <div>
                          <span className="text-ink-3">Score Range:</span>
                          <p className="font-semibold text-ink">
                            {sec.minScore}% – {sec.maxScore}%
                          </p>
                        </div>
                        <div>
                          <span className="text-ink-3">Vs Cohort Mean:</span>
                          <p
                            className={cx(
                              "font-semibold",
                              sec.average >= avgSchoolScore ? "text-success" : "text-danger",
                            )}
                          >
                            {sec.average >= avgSchoolScore ? `+${sec.average - avgSchoolScore}%` : `${sec.average - avgSchoolScore}%`}
                          </p>
                        </div>
                      </div>

                      {/* Section topic insight */}
                      <div className="mt-3 rounded-md bg-surface p-2 text-[11px] border border-border/80">
                        <div className="flex items-center gap-1 text-danger font-medium">
                          <TrendingDown size={12} /> Weakest: <span className="font-normal text-ink-2 truncate">{sec.weakestTopic}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-success font-medium">
                          <TrendingUp size={12} /> Strongest: <span className="font-normal text-ink-2 truncate">{sec.strongestTopic}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Section Disparity Insight Banner */}
                {sectionAnalytics.length >= 2 && (
                  <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-soft/30 p-3.5 text-xs text-ink-2">
                    <Lightbulb size={18} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <span className="font-semibold text-ink">Principal Cross-Section Insight: </span>
                      {(() => {
                        const topSec = sectionAnalytics.reduce((p, c) => (c.average > p.average ? c : p), sectionAnalytics[0]);
                        const lowSec = sectionAnalytics.reduce((p, c) => (c.average < p.average ? c : p), sectionAnalytics[0]);
                        const diff = topSec.average - lowSec.average;
                        if (diff >= 5) {
                          return `Section ${topSec.sectionName} (${topSec.average}%) is leading Section ${lowSec.sectionName} (${lowSec.average}%) by a delta of ${diff}%. Check the weak topics breakdown below to identify specific chapter concepts requiring teacher alignment between sections.`;
                        }
                        return `Both sections are performing within a balanced margin (delta of ${diff}%). Focus on cohort-wide weak topics highlighted in the matrix below.`;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* Weak Topics Across Sections (Action Matrix) */}
          <Panel
            title={
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} className="text-warning" />
                <span>Weak Topics Across Sections (Action Matrix)</span>
              </div>
            }
            actions={<span className="text-xs text-ink-3">Ranked by lowest cohort accuracy</span>}
            flush
          >
            {topicMatrix.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-3">No topic data available for the selected filters.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th sticky>Topic / Syllabus Concept</Th>
                    <Th>Coverage & Weightage</Th>
                    <Th className="w-48">Cohort Accuracy</Th>
                    <Th>Section Breakdown</Th>
                    <Th>Section Disparity</Th>
                    <Th>Health Status</Th>
                    <Th className="min-w-64">AI Pedagogical Diagnosis & Recommendation</Th>
                  </tr>
                </thead>
                <tbody>
                  {topicMatrix.map((t) => (
                    <Tr key={t.topic}>
                      <Td sticky className="font-medium text-ink">
                        <span className="block">{t.topic}</span>
                        <span className="text-xs text-ink-3">{t.subject}</span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-2">
                          {t.questionCount} {t.questionCount === 1 ? "question" : "questions"} · {t.weightageMarks} marks
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                            <div
                              className={cx(
                                "h-full rounded-full",
                                t.status === "critical" ? "bg-danger" : t.status === "moderate" ? "bg-warning" : "bg-success",
                              )}
                              style={{ width: `${t.cohortAccuracy}%` }}
                            />
                          </div>
                          <span
                            className={cx(
                              "text-xs font-semibold tabular-nums",
                              t.status === "critical" ? "text-danger" : t.status === "moderate" ? "text-warning" : "text-success",
                            )}
                          >
                            {t.cohortAccuracy}%
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.sections.map((s) => (
                            <span
                              key={s.section}
                              className={cx(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
                                s.accuracy < 50
                                  ? "bg-danger-soft text-danger"
                                  : s.accuracy < 70
                                    ? "bg-warning-soft text-warning"
                                    : "bg-success-soft text-success",
                              )}
                            >
                              <span className="text-ink-3">{s.section}:</span> {s.accuracy}%
                            </span>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        {t.disparity >= 15 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning">
                            <AlertTriangle size={12} /> Δ {t.disparity}% gap
                          </span>
                        ) : (
                          <span className="text-xs text-ink-3">Δ {t.disparity}% (balanced)</span>
                        )}
                      </Td>
                      <Td>
                        {t.status === "critical" && (
                          <Tag tone="danger" className="font-semibold">
                            Critical Weakness
                          </Tag>
                        )}
                        {t.status === "moderate" && (
                          <Tag tone="warning" className="font-semibold">
                            Needs Focus
                          </Tag>
                        )}
                        {t.status === "mastered" && (
                          <Tag tone="success" className="font-semibold">
                            Mastered
                          </Tag>
                        )}
                      </Td>
                      <Td className="max-w-xs text-xs text-ink-2 whitespace-normal leading-relaxed">
                        {t.recommendation}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>

          {/* Question-Wise Deep Dive Analysis */}
          <Panel
            title={
              <div className="flex items-center gap-2">
                <BookOpen size={17} className="text-primary" />
                <span>Question-by-Question Deep Dive Analysis</span>
              </div>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {/* Search in questions */}
                <div className="relative w-48 sm:w-60">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
                  <Input
                    placeholder="Search question, concept..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                {/* Filter by Topic */}
                <Select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="h-8 w-44 text-xs"
                >
                  <option value="all">All Topics ({allTopicNames.length})</option>
                  {allTopicNames.map((top) => (
                    <option key={top} value={top}>
                      {top}
                    </option>
                  ))}
                </Select>

                {/* Filter by Health */}
                <Select
                  value={healthFilter}
                  onChange={(e) => setHealthFilter(e.target.value as any)}
                  className="h-8 w-32 text-xs"
                >
                  <option value="all">All Health</option>
                  <option value="critical">Critical (&lt; 50%)</option>
                  <option value="moderate">Needs Focus</option>
                  <option value="mastered">Mastered (&ge; 70%)</option>
                </Select>

                {/* Disparity Toggle */}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-subtle">
                  <input
                    type="checkbox"
                    checked={onlyDisparity}
                    onChange={(e) => setOnlyDisparity(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>High gap (Δ &ge; 15%)</span>
                </label>
              </div>
            }
            flush
          >
            {filteredQuestions.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-3">
                <p>No questions match the active search and filter settings.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setSelectedTopic("all");
                    setHealthFilter("all");
                    setQuestionSearch("");
                    setOnlyDisparity(false);
                  }}
                >
                  Reset question filters
                </Button>
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th sticky>Q# & Type</Th>
                    <Th>Topic Concept</Th>
                    <Th className="max-w-md">Question Snippet</Th>
                    <Th align="right">Marks</Th>
                    <Th className="w-40">Cohort Accuracy</Th>
                    <Th>Section Breakdown</Th>
                    <Th>Health</Th>
                    <Th className="min-w-64">Identified Student Error Pattern / AI Insight</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((qa) => (
                    <Tr key={qa.id}>
                      <Td sticky className="font-semibold text-ink">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm">Q{qa.question.number}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-3 uppercase">
                            {QTYPE_LABEL[qa.question.type] || qa.question.type}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="inline-block rounded bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-2">
                          {qa.topic}
                        </span>
                      </Td>
                      <Td className="max-w-md whitespace-normal">
                        <p className="line-clamp-2 text-xs text-ink leading-relaxed">{qa.question.text}</p>
                      </Td>
                      <Td align="right" className="font-mono text-xs">
                        {qa.marks}m
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                            <div
                              className={cx(
                                "h-full rounded-full",
                                qa.status === "critical" ? "bg-danger" : qa.status === "moderate" ? "bg-warning" : "bg-success",
                              )}
                              style={{ width: `${qa.cohortAccuracy}%` }}
                            />
                          </div>
                          <span
                            className={cx(
                              "text-xs font-semibold tabular-nums",
                              qa.status === "critical" ? "text-danger" : qa.status === "moderate" ? "text-warning" : "text-success",
                            )}
                          >
                            {qa.cohortAccuracy}%
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-3">Avg {qa.avgAwarded} / {qa.marks}</span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          {qa.sections.map((sec) => (
                            <span
                              key={sec.section}
                              className={cx(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                sec.accuracy < 50
                                  ? "bg-danger-soft text-danger"
                                  : sec.accuracy < 70
                                    ? "bg-warning-soft text-warning"
                                    : "bg-success-soft text-success",
                              )}
                            >
                              {sec.section}: {sec.accuracy}%
                            </span>
                          ))}
                          {qa.disparity >= 15 && (
                            <span className="rounded bg-warning-soft px-1 text-[10px] font-bold text-warning" title={`Delta: ${qa.disparity}%`}>
                              Δ {qa.disparity}%
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        {qa.status === "critical" && <Tag tone="danger">Critical</Tag>}
                        {qa.status === "moderate" && <Tag tone="warning">Focus</Tag>}
                        {qa.status === "mastered" && <Tag tone="success">Mastered</Tag>}
                      </Td>
                      <Td className="max-w-xs text-xs text-ink-2 whitespace-normal leading-relaxed">
                        <span className="italic">{qa.diagnostic}</span>
                      </Td>
                      <Td align="right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={13} />}
                          onClick={() =>
                            setInspectQuestion({
                              q: qa.question,
                              subject: qa.assessment.subject,
                              asmName: qa.assessment.name,
                            })
                          }
                        >
                          Inspect
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: EXAM CELL OPERATIONS (PIPELINE FUNNEL, BOTTLENECKS, AUDIT)       */}
      {/* ========================================================================= */}
      {viewMode === "examcell" && (
        <div className="space-y-6">
          {/* Operations KPI Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Overall Pass Rate</span>
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{evaluatedSheets.length ? `${passRate}%` : "—"}</p>
              <p className="mt-0.5 text-xs text-ink-3">Score $\ge 33\%$ ({evaluatedSheets.length} evaluated)</p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>School Average</span>
                <TrendingUp size={16} className="text-primary" />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{evaluatedSheets.length ? `${avgSchoolScore}%` : "—"}</p>
              <p className="mt-0.5 text-xs text-ink-3">Across all filtered exams</p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Verification Rate</span>
                <GraduationCap size={16} className="text-info" />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{verificationCompletion}%</p>
              <p className="mt-0.5 text-xs text-ink-3">
                {c.verified} of {c.aiEvaluated} copies verified
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-medium text-ink-3">
                <span>Active Bottlenecks</span>
                <AlertTriangle size={16} className={c.unmatched + c.failed > 0 ? "text-warning" : "text-ink-4"} />
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{c.unmatched + c.failed}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                {c.unmatched} unmapped · {c.failed} failed
              </p>
            </div>
          </div>

          {/* Pipeline Funnel Strip */}
          <section aria-label="Evaluation pipeline" className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
            <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
              {funnel.map((f, i) => (
                <li
                  key={f.label}
                  className={cx(
                    "relative border-border",
                    i > 0 && "xl:border-l",
                    i % 2 === 1 && "border-l sm:border-l-0",
                    i >= 2 && "border-t sm:border-t-0",
                    i >= 3 && "sm:border-t xl:border-t-0",
                    i % 3 !== 0 && "sm:border-l",
                  )}
                >
                  <Link to={f.to} className="group flex h-full flex-col px-4 py-3.5 transition-colors duration-100 hover:bg-subtle">
                    <span className="flex items-center gap-1 text-xs text-ink-3">
                      {f.label}
                      <ChevronRight size={12} strokeWidth={ICON} className="opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-ink">{num(f.value)}</span>
                    <span className={cx("mt-0.5 text-xs", f.warn ? "font-medium text-warning" : "text-ink-3")}>{f.note}</span>
                  </Link>
                  {i < funnel.length - 1 && (
                    <ArrowRight
                      size={14}
                      strokeWidth={ICON}
                      className="absolute -right-[7px] top-1/2 z-10 -mt-[7px] hidden rounded-full bg-surface text-ink-4 xl:block"
                      aria-hidden
                    />
                  )}
                </li>
              ))}
            </ol>
            <div className="border-t border-border px-4 py-2.5">
              <StackBar
                total={Math.max(c.expected, c.uploaded)}
                parts={[
                  { value: c.distributed, cls: "bg-primary", label: "Distributed" },
                  { value: Math.max(0, c.verified - c.distributed + c.provisional), cls: "bg-primary/60", label: "Verified, not sent" },
                  { value: Math.max(0, c.aiEvaluated - c.verified - c.provisional), cls: "bg-primary/25", label: "AI evaluated, not verified" },
                  { value: c.pendingEvaluation + c.failed + c.needsReview, cls: "bg-ink-4/50", label: "In queue or exceptions" },
                  { value: c.unmatched, cls: "bg-warning", label: "Unmatched" },
                ]}
              />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
                <Legend cls="bg-primary" label="Distributed" />
                <Legend cls="bg-primary/60" label="Verified" />
                <Legend cls="bg-primary/25" label="AI evaluated" />
                <Legend cls="bg-ink-4/50" label="In queue" />
                <Legend cls="bg-warning" label="Unmatched" />
              </div>
            </div>
          </section>

          {/* Operational Exams in flight & Attention Feed */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Exams list */}
            <Panel title={`Exams in Scope (${inFlight.length})`} actions={<ButtonLink to="/assessments" variant="ghost" size="sm">Manage all</ButtonLink>} flush>
              <Table>
                <thead>
                  <tr>
                    <Th sticky>Exam</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th className="w-44">Progress</Th>
                    <Th align="right">Uploaded</Th>
                    <Th align="right">Verified</Th>
                    <Th align="right">Released</Th>
                    <Th align="right">Deadline</Th>
                  </tr>
                </thead>
                <tbody>
                  {inFlight.map(({ a, status, expected, uploaded, evaluated, verified, released }) => (
                    <Tr key={a.id} onClick={() => navigate(`/assessments/${a.id}`)}>
                      <Td sticky className="max-w-64">
                        <span className="block truncate font-medium text-ink">{a.name}</span>
                        <span className="block text-xs text-ink-3">
                          Class {a.grade} {a.sections.join(", ")} · {a.subject}
                        </span>
                      </Td>
                      <Td>
                        <span className="inline-block rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          {a.type || "Exam"}
                        </span>
                      </Td>
                      <Td>
                        <StatusText {...ASSESSMENT_STATUS[status]} />
                      </Td>
                      <Td>
                        {uploaded ? (
                          <StackBar
                            total={expected}
                            parts={[
                              { value: released, cls: "bg-primary", label: "Released" },
                              { value: Math.max(0, verified - released), cls: "bg-primary/60", label: "Verified" },
                              { value: Math.max(0, evaluated - verified), cls: "bg-primary/25", label: "AI evaluated" },
                              { value: uploaded - evaluated, cls: "bg-ink-4/50", label: "In queue" },
                            ]}
                          />
                        ) : (
                          <span className="text-xs text-ink-3">{status === "ready" ? "Ready for copies" : "Setup in progress"}</span>
                        )}
                      </Td>
                      <Td align="right">
                        {uploaded}/{expected}
                      </Td>
                      <Td align="right">{verified}</Td>
                      <Td align="right">{released}</Td>
                      <Td align="right">{a.deadline ? fmtShortDate(a.deadline) : <span className="text-ink-4">None</span>}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>

            {/* Needs Attention alerts & Audit Activity */}
            <div className="flex flex-col gap-5">
              <Panel title="Needs Attention" flush>
                {attention.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-ink-3">No bottlenecks. All exam pipelines are healthy.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {attention.map((it, i) => {
                      const Icon = it.icon;
                      return (
                        <li key={i} className="flex items-start gap-3 px-4 py-3">
                          <Icon
                            size={17}
                            strokeWidth={ICON}
                            className={cx(
                              "mt-0.5 shrink-0",
                              it.tone === "danger" ? "text-danger" : it.tone === "warning" ? "text-warning" : "text-primary",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink">{it.title}</p>
                            <p className="text-xs text-ink-3">{it.body}</p>
                          </div>
                          <Button variant="secondary" size="sm" onClick={() => navigate(it.to)}>
                            {it.action}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel title="Recent Exam Activity" actions={<ButtonLink to="/audit" variant="ghost" size="sm">Audit log</ButtonLink>} flush>
                <ul className="divide-y divide-border">
                  {recent.map((e) => (
                    <li key={e.id} className="px-4 py-2.5">
                      <p className="text-[13px] text-ink">
                        <span className="font-medium">{userName(e.actorId)}</span>{" "}
                        <span className="text-ink-2">{e.action.charAt(0).toLowerCase() + e.action.slice(1)}</span>
                      </p>
                      <p className="truncate text-xs text-ink-3">
                        {e.target} · {relTime(e.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* Question Inspection Dialog for Principal */}
      {inspectQuestion && (
        <Dialog
          open={!!inspectQuestion}
          onClose={() => setInspectQuestion(null)}
          title={`Question ${inspectQuestion.q.number} Analysis · ${inspectQuestion.asmName}`}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setInspectQuestion(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">Target Concept:</span>
                <span className="rounded bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                  {getQuestionTopic(inspectQuestion.q, inspectQuestion.subject)}
                </span>
                <span className="text-xs text-ink-3">
                  · {inspectQuestion.q.marks} Marks · {QTYPE_LABEL[inspectQuestion.q.type]}
                </span>
              </div>
              <p className="mt-2 rounded-md bg-subtle p-3 text-ink leading-relaxed font-medium">
                {inspectQuestion.q.text}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Model Answer Key</h4>
              <p className="mt-1 rounded-md border border-border bg-surface p-3 text-ink-2 leading-relaxed">
                {inspectQuestion.q.answer || "No approved model answer key recorded."}
              </p>
            </div>

            {inspectQuestion.q.criteria && inspectQuestion.q.criteria.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Rubric Scoring Criteria ({inspectQuestion.q.criteria.length})
                </h4>
                <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-surface">
                  {inspectQuestion.q.criteria.map((cr) => (
                    <li key={cr.id} className="flex items-center justify-between p-2.5 text-xs">
                      <span className="text-ink">{cr.label}</span>
                      <span className="rounded bg-muted px-2 py-0.5 font-mono font-medium text-ink-2">
                        {cr.marks} {cr.marks === 1 ? "mark" : "marks"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inspectQuestion.q.variants && inspectQuestion.q.variants.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Observed Student Responses & Error Patterns
                </h4>
                <div className="mt-2 space-y-2">
                  {inspectQuestion.q.variants.map((v, i) => (
                    <div
                      key={i}
                      className={cx(
                        "rounded-md border p-3 text-xs",
                        v.hit.length === inspectQuestion.q.criteria.length
                          ? "border-success/30 bg-success-soft/20"
                          : "border-warning/30 bg-warning-soft/20",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">
                          {v.hit.length === inspectQuestion.q.criteria.length ? "✓ Exemplary Student Answer" : "⚠️ Frequent Student Error Pattern"}
                        </span>
                        <span className="text-ink-3 font-mono">Confidence: {Math.round(v.confidence * 100)}%</span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-ink whitespace-pre-wrap">{v.text}</p>
                      <p className="mt-1.5 text-ink-2">
                        <span className="font-medium">Feedback: </span>
                        {v.feedback}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </Page>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("h-2 w-2 rounded-sm", cls)} aria-hidden />
      {label}
    </span>
  );
}
