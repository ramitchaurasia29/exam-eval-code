import { Fragment, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import type { Embed } from "../components/embed";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Trash2, Upload, WandSparkles } from "lucide-react";
import { useStore } from "../data/store";
import type { Question, QType } from "../data/types";
import { fmtDateTime, QTYPE_LABEL } from "../data/selectors";
import { MATHS_9_QUESTIONS, SCIENCE_9_QUESTIONS, SST_8_QUESTIONS } from "../data/questions";
import AssessmentHeader, { useAssessmentParam } from "../components/AssessmentHeader";
import { Banner, Button, Dialog, DropZone, EmptyState, Field, ICON, IconButton, Input, Page, Panel, Select, Skeleton, Textarea, cx } from "../components/ui";
import { useScreenInit } from "../useScreenInit";

const SYLLABUS_TOPICS: Record<string, string[]> = {
  Mathematics: [
    "Rational Numbers & Real Number Systems",
    "Linear Equations in One & Two Variables",
    "Understanding Quadrilaterals & Geometry",
    "Algebraic Expressions & Identities",
    "Mensuration, Surface Areas & Volumes",
    "Exponents, Powers & Factorisation",
    "Probability and Data Handling",
  ],
  Science: [
    "Nutrition in Plants & Animals",
    "Acids, Bases, and Salts",
    "Physical and Chemical Changes",
    "Respiration & Cellular Metabolism",
    "Motion, Speed and Time Calculations",
    "Electric Current and Chemical Effects",
    "Light: Reflection, Refraction & Lenses",
  ],
  English: [
    "Reading Comprehension (Factual & Discursive Passages)",
    "Formal Letter Writing & Analytical Paragraphs",
    "Grammar: Tenses, Modals & Subject-Verb Concord",
    "Literature: Prose Comprehension & Character Sketches",
    "Poetry Analysis & Poetic Devices",
  ],
  "Social Science": [
    "Resources and Sustainable Development",
    "The Making of the National Movement (1870s–1947)",
    "Judiciary, Law and Social Justice",
    "Agriculture, Industries & Human Resources",
    "Our Constitution & Democratic Rights",
  ],
  "Computer Science": [
    "Computer Systems & Architecture Fundamentals",
    "Computational Thinking & Python Programming",
    "Data Representation & Boolean Logic",
    "Cyber Safety, Ethics & Emerging Technologies",
    "Database Management Systems & SQL Basics",
  ],
  Hindi: [
    "अपठित गद्यांश एवं काव्यांश बोध",
    "व्यावहारिक व्याकरण: पदबंध, समास, वाक्य-भेद",
    "रचनात्मक लेखन: अनुच्छेद, पत्र, सूचना एवं विज्ञापन",
    "पाठ्यपुस्तक: गद्य एवं पद्य खंड भावार्थ",
  ],
};

export default function QuestionPaper({ embed }: { embed?: Embed }) {
  const params = useParams();
  const id = embed?.id ?? params.id;
  const Root: ElementType = embed ? Fragment : Page;
  const assessment = useAssessmentParam(id);
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const init = useScreenInit();
  const [editing, setEditing] = useState(false);
  const [originalQuestions, setOriginalQuestions] = useState<Question[] | null>(null);
  const [page, setPage] = useState(typeof init.page === "number" ? init.page : 1);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(typeof init.confirmError === "string" ? init.confirmError : "");
  const [replaceOpen, setReplaceOpen] = useState(!!init.replaceOpen);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [replaceFile, setReplaceFile] = useState<{ name: string; size: number } | null>(null);
  const [replaceError, setReplaceError] = useState("");
  const [sourceMode, setSourceMode] = useState<"generator" | "upload">("generator");
  const [generating, setGenerating] = useState(false);
  const [generatorStep, setGeneratorStep] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<"balanced" | "foundational" | "advanced">("balanced");
  const sheets = state.sheets.filter((s) => s.assessmentId === id);
  const locked = sheets.length > 0;

  const topicsList = useMemo(() => {
    return (
      (assessment ? SYLLABUS_TOPICS[assessment.subject] : null) || [
        `Core Principles of ${assessment?.subject ?? "Subject"}`,
        `Theoretical Framework & Definitions`,
        `Application Problems & Real-World Case Studies`,
        `Analytical Reasoning & Data Interpretation`,
        `Advanced Synthesis & Problem Solving`,
      ]
    );
  }, [assessment?.subject]);

  useEffect(() => {
    if (selectedTopics.length === 0 && topicsList.length > 0) {
      setSelectedTopics(topicsList.slice(0, 4));
    }
  }, [topicsList]);

  if (!assessment) return <Page><EmptyState title="Exam not found" body="This exam may have been removed or the link may be out of date." action={<Button onClick={() => navigate("/assessments")}>View exams</Button>} /></Page>;

  const questions = assessment.questions;
  const marks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const pages = assessment.paper?.pages ?? 1;
  const visibleQuestions = questions.filter((q) => q.page === page);
  const sampleName = `${assessment.subject.replace(/\s+/g, "_")}_question_paper.pdf`;
  const update = (q: Question, patch: Partial<Question>) => actions.updateQuestion(assessment.id, q.id, { ...patch, extractionIssue: undefined });
  const onPaper = (name: string) => {
    setError(""); setExtracting(true);
    window.setTimeout(() => {
      const result = actions.uploadPaper(assessment.id, name, 2);
      setExtracting(false);
      if (!result.ok) setError(result.error);
      else actions.toast("Question paper uploaded");
    }, 1200);
  };

  const generateWithTool = () => {
    setError("");
    setGenerating(true);
    setGeneratorStep(1);

    window.setTimeout(() => setGeneratorStep(2), 450);
    window.setTimeout(() => setGeneratorStep(3), 850);

    window.setTimeout(() => {
      const baseTpl =
        assessment.subject === "Mathematics"
          ? MATHS_9_QUESTIONS
          : assessment.subject === "Science"
          ? SCIENCE_9_QUESTIONS
          : SST_8_QUESTIONS;

      const targetMarks = assessment.totalMarks || 40;
      let runningSum = 0;
      const genQuestions: Question[] = [];

      baseTpl.forEach((qItem, i) => {
        if (runningSum + qItem.marks <= targetMarks || genQuestions.length < 4) {
          runningSum += qItem.marks;
          genQuestions.push({
            ...qItem,
            id: `${assessment.id}-gen-q${String(i + 1).padStart(2, "0")}`,
            extractionIssue: undefined,
          });
        }
      });

      if (genQuestions.length > 0 && runningSum !== targetMarks) {
        const last = genQuestions[genQuestions.length - 1];
        const diff = targetMarks - runningSum;
        last.marks = Math.max(1, last.marks + diff);
      }

      const fileName = `${assessment.subject.replace(/\s+/g, "_")}_AI_Generated_Paper.pdf`;
      actions.uploadPaper(assessment.id, fileName, 2, genQuestions);
      setGenerating(false);
      actions.toast("Question paper generated with assessment generator tool!", { tone: "success" });
    }, 1300);
  };
  const confirm = () => {
    const unresolved = questions.filter((q) => q.extractionIssue);
    if (unresolved.length) { setError("Resolve each extraction warning before confirming the question structure."); return; }
    const result = actions.confirmQuestions(assessment.id);
    if (!result.ok) { setError(result.error); return; }
    if (originalQuestions && JSON.stringify(originalQuestions) !== JSON.stringify(questions)) {
      actions.updateAssessment(assessment.id, {
        answerKey: assessment.answerKey.status === "approved" ? { ...assessment.answerKey, status: "draft" } : assessment.answerKey,
        rubric: assessment.rubric.status === "approved" ? { ...assessment.rubric, status: "draft" } : assessment.rubric,
      });
    }
    setEditing(false); setOriginalQuestions(null);
    actions.toast("Questions confirmed", { tone: "success" });
    if (embed) embed.onNext(); else navigate(`/assessments/${assessment.id}/setup/answer-key`);
  };
  const remove = (q: Question) => {
    const previous = questions;
    actions.removeQuestion(assessment.id, q.id);
    actions.toast(`Question ${q.number} removed`, { undo: () => actions.updateAssessment(assessment.id, { questions: previous }) });
  };
  const uploadReplacement = () => {
    if (!replaceFile) return;
    setReplaceError("");
    const result = actions.uploadPaper(assessment.id, replaceFile.name, 2);
    if (!result.ok) { setReplaceError(result.error); return; }
    setReplaceOpen(false); setReplaceConfirm(false); setReplaceFile(null);
    actions.toast(`Question paper replaced (v${(assessment.paper?.version ?? 0) + 1})`, { tone: "success" });
  };

  return <Root>
    {!embed && <AssessmentHeader assessment={assessment} tab="paper" />}
    {!assessment.paper ? (
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Source Mode Switcher: 2 Distinct Options */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          {/* Option 1: Assessment Generator Tool */}
          <div
            onClick={() => setSourceMode("generator")}
            className={cx(
              "cursor-pointer rounded-xl border p-4 transition-all shadow-xs",
              sourceMode === "generator"
                ? "border-primary bg-primary-soft/40 ring-2 ring-primary/40 shadow-sm"
                : "border-border bg-surface hover:border-border-strong hover:bg-subtle"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cx("flex h-9 w-9 items-center justify-center rounded-lg shadow-xs", sourceMode === "generator" ? "bg-primary text-on-primary" : "bg-muted text-ink-2")}>
                  <WandSparkles size={18} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Use assessment generator tool</h3>
                  <span className="text-[11px] font-semibold text-primary">AI Blueprint &amp; Syllabus Aligned</span>
                </div>
              </div>
              <input type="radio" name="paper-source" checked={sourceMode === "generator"} onChange={() => setSourceMode("generator")} className="mt-1 h-4 w-4 text-primary" />
            </div>
            <p className="mt-2.5 text-xs text-ink-3 leading-relaxed">
              Auto-generate a balanced, board-aligned question paper with customizable chapter coverage, difficulty distribution, and cognitive levels.
            </p>
          </div>

          {/* Option 2: Upload Teacher-Made Paper */}
          <div
            onClick={() => setSourceMode("upload")}
            className={cx(
              "cursor-pointer rounded-xl border p-4 transition-all shadow-xs",
              sourceMode === "upload"
                ? "border-primary bg-primary-soft/40 ring-2 ring-primary/40 shadow-sm"
                : "border-border bg-surface hover:border-border-strong hover:bg-subtle"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cx("flex h-9 w-9 items-center justify-center rounded-lg shadow-xs", sourceMode === "upload" ? "bg-primary text-on-primary" : "bg-muted text-ink-2")}>
                  <Upload size={18} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Upload teacher-made question paper</h3>
                  <span className="text-[11px] font-medium text-ink-3">Upload PDF, Scan or Image File</span>
                </div>
              </div>
              <input type="radio" name="paper-source" checked={sourceMode === "upload"} onChange={() => setSourceMode("upload")} className="mt-1 h-4 w-4 text-primary" />
            </div>
            <p className="mt-2.5 text-xs text-ink-3 leading-relaxed">
              Upload your own prepared physical or digital question paper. Questions, marks, diagrams, and sub-parts are automatically parsed by OCR.
            </p>
          </div>
        </div>

        {error && <Banner tone="danger">{error}</Banner>}

        {/* Panel for Option 1: Assessment Generator Tool */}
        {sourceMode === "generator" && (
          <Panel
            title={
              <div className="flex items-center gap-2">
                <WandSparkles size={16} className="text-primary" />
                <span>Assessment Generator Tool</span>
              </div>
            }
          >
            {generating ? (
              <div className="space-y-4 py-8 text-center" aria-live="polite">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary animate-pulse">
                  <WandSparkles size={24} />
                </div>
                <p className="text-sm font-semibold text-ink">
                  {generatorStep === 1 && `Analyzing ${assessment.subject} syllabus & chapter weightage…`}
                  {generatorStep === 2 && `Calibrating question blueprint to ${assessment.totalMarks} marks…`}
                  {generatorStep === 3 && `Synthesizing marking schemes & diagram questions…`}
                </p>
                <div className="mx-auto max-w-sm space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5 mx-auto" />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Context Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-subtle px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-ink-2">
                    <span className="font-semibold text-ink">{assessment.name}</span>
                    <span>·</span>
                    <span>Class {assessment.grade}</span>
                    <span>·</span>
                    <span>{assessment.subject}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                      Target: {assessment.totalMarks} Total Marks
                    </span>
                    {assessment.durationMin && (
                      <span className="text-xs text-ink-3">{assessment.durationMin} mins</span>
                    )}
                  </div>
                </div>

                {/* 1. Syllabus & Chapters */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink-2">
                      1. Select Syllabus Chapters to Cover:
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedTopics([...topicsList])}
                        className="text-primary hover:underline font-medium"
                      >
                        Select All
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTopics([])}
                        className="text-ink-3 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {topicsList.map((topic) => {
                      const isChecked = selectedTopics.includes(topic);
                      return (
                        <label
                          key={topic}
                          className={cx(
                            "flex items-center gap-2.5 rounded-lg border p-2.5 text-xs transition-colors cursor-pointer",
                            isChecked
                              ? "border-primary/40 bg-primary-soft/30 text-ink font-medium"
                              : "border-border bg-surface text-ink-3 hover:bg-subtle"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedTopics((curr) =>
                                isChecked ? curr.filter((t) => t !== topic) : [...curr, topic]
                              );
                            }}
                            className="h-3.5 w-3.5 rounded text-primary"
                          />
                          <span className="truncate">{topic}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Difficulty Blueprint */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-2">
                    2. Cognitive &amp; Difficulty Blueprint (Bloom's Taxonomy):
                  </label>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div
                      onClick={() => setDifficulty("balanced")}
                      className={cx(
                        "cursor-pointer rounded-lg border p-3 text-xs transition-all",
                        difficulty === "balanced"
                          ? "border-primary bg-primary-soft/50 ring-1 ring-primary font-semibold text-ink"
                          : "border-border bg-surface text-ink-3 hover:bg-subtle"
                      )}
                    >
                      <p className="font-bold text-ink">Balanced (Recommended)</p>
                      <p className="mt-1 text-[11px] text-ink-3">30% Easy · 50% Medium · 20% Hard</p>
                    </div>

                    <div
                      onClick={() => setDifficulty("foundational")}
                      className={cx(
                        "cursor-pointer rounded-lg border p-3 text-xs transition-all",
                        difficulty === "foundational"
                          ? "border-primary bg-primary-soft/50 ring-1 ring-primary font-semibold text-ink"
                          : "border-border bg-surface text-ink-3 hover:bg-subtle"
                      )}
                    >
                      <p className="font-bold text-ink">Foundational Focus</p>
                      <p className="mt-1 text-[11px] text-ink-3">50% Easy · 35% Medium · 15% Hard</p>
                    </div>

                    <div
                      onClick={() => setDifficulty("advanced")}
                      className={cx(
                        "cursor-pointer rounded-lg border p-3 text-xs transition-all",
                        difficulty === "advanced"
                          ? "border-primary bg-primary-soft/50 ring-1 ring-primary font-semibold text-ink"
                          : "border-border bg-surface text-ink-3 hover:bg-subtle"
                      )}
                    >
                      <p className="font-bold text-ink">Advanced / HOTS</p>
                      <p className="mt-1 text-[11px] text-ink-3">20% Easy · 40% Medium · 40% Hard</p>
                    </div>
                  </div>
                </div>

                {/* 3. Section Blueprint */}
                <div className="rounded-lg border border-border bg-subtle p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-ink">
                    <span>3. Auto-Calibrated Section Blueprint:</span>
                    <span className="text-primary">{assessment.totalMarks} Marks Total</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded bg-surface p-2 border border-border text-center">
                      <p className="font-bold text-ink">Section A (MCQs)</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Objective · 1m each</p>
                    </div>
                    <div className="rounded bg-surface p-2 border border-border text-center">
                      <p className="font-bold text-ink">Section B (Short)</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Short Answer · 2–3m each</p>
                    </div>
                    <div className="rounded bg-surface p-2 border border-border text-center">
                      <p className="font-bold text-ink">Section C (Long)</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Long Answer · 4–5m each</p>
                    </div>
                    <div className="rounded bg-surface p-2 border border-border text-center">
                      <p className="font-bold text-ink">Section D (Applied)</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Diagram &amp; Case Study</p>
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <p className="text-xs text-ink-3">
                    Questions can be reviewed, edited, or reordered before final confirmation.
                  </p>
                  <Button
                    variant="primary"
                    icon={<WandSparkles size={16} strokeWidth={ICON} />}
                    onClick={generateWithTool}
                    disabled={selectedTopics.length === 0}
                  >
                    Generate Question Paper
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* Panel for Option 2: Upload Teacher-Made Paper */}
        {sourceMode === "upload" && (
          <Panel title="Upload teacher-made question paper">
            {extracting ? (
              <div className="space-y-4" aria-live="polite">
                <p className="text-sm font-medium text-ink">Extracting questions from teacher paper…</p>
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <DropZone
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                title="Drop the question paper here"
                hint="PDF, JPG or PNG · multiple pages supported"
                sample={{ name: sampleName, sizeMb: 2.4 }}
                onFile={(name) => onPaper(name)}
              />
            )}
          </Panel>
        )}
      </div>
    ) : <>
      {assessment.questionsConfirmed && !editing && <Banner tone="success" className="mb-4" title="Question structure confirmed">The extracted structure is read-only. Stable question IDs are retained for answer keys and marking.</Banner>}
      {locked && <Banner tone="info" className="mb-4" title="Question structure and paper versions are locked">Copies have already been uploaded for this exam. Editing or replacing the question paper is unavailable.</Banner>}
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 shadow-xs">
        <div className={cx("text-sm font-medium tabular-nums", marks !== assessment.totalMarks ? "text-danger" : "text-ink-2")}>{questions.length} questions · {marks} of {assessment.totalMarks} marks</div>
        <div className="flex flex-wrap gap-2">
          {assessment.questionsConfirmed && !editing && <Button variant="secondary" disabled={locked} icon={<Pencil size={15} strokeWidth={ICON} />} onClick={() => { setOriginalQuestions(questions); setEditing(true); }}>Edit questions</Button>}
          {editing && <><Button onClick={() => { if (originalQuestions) actions.updateAssessment(assessment.id, { questions: originalQuestions }); setOriginalQuestions(null); setEditing(false); setError(""); }}>Cancel</Button><Button variant="primary" onClick={confirm}>Save and confirm</Button></>}
          {!assessment.questionsConfirmed && <Button variant="primary" onClick={confirm} icon={<Check size={15} strokeWidth={ICON} />}>Confirm questions</Button>}
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
        <Panel title="Paper preview" actions={pages > 1 ? <div className="flex items-center gap-1"><IconButton label="Previous page" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} strokeWidth={ICON} /></IconButton><span className="min-w-16 text-center text-xs text-ink-3">Page {page} of {pages}</span><IconButton label="Next page" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={16} strokeWidth={ICON} /></IconButton></div> : <span className="text-xs text-ink-3">Page 1</span>}>
          <div className="mx-auto min-h-[560px] max-w-[520px] border border-border bg-paper p-5 shadow-page sm:p-8">
            <div className="border-b border-border pb-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">{state.settings.schoolName}</p>
              <h2 className="mt-2 text-base font-semibold text-ink">{assessment.name}</h2>
              <p className="mt-1 text-xs text-ink-3">Class {assessment.grade} · {assessment.subject} · {assessment.academicYear}</p>
              <p className="mt-2 text-xs text-ink-2">Maximum marks: {assessment.totalMarks}{assessment.durationMin ? ` · Duration: ${assessment.durationMin} minutes` : ""}</p>
            </div>
            {assessment.instructions && <p className="mt-4 text-xs italic text-ink-2">{assessment.instructions}</p>}
            <div className="mt-5 space-y-5">
              {visibleQuestions.length ? visibleQuestions.map((q) => <div key={q.id} className="grid grid-cols-[2rem_1fr_auto] gap-2 text-[13px] leading-relaxed text-ink"><span className="font-medium">{q.number}.</span><span>{q.text || "Question text will appear here"}</span><span className="whitespace-nowrap text-xs text-ink-3">[{q.marks}]</span></div>) : <p className="text-center text-xs text-ink-3">No questions on this page.</p>}
            </div>
            <div className="mt-12 border-t border-border pt-2 text-center text-[10px] text-ink-4">{assessment.paper.fileName}</div>
          </div>
        </Panel>
        <Panel title="Extracted questions" actions={assessment.questionsConfirmed && <span className="text-xs text-ink-3">{editing ? "Editing" : "Read only"}</span>} flush>
          {!questions.length ? <EmptyState title="No questions extracted" body="Add questions to build the exam structure." /> : <ol className="divide-y divide-border">
            {questions.map((q) => <li key={q.id} className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[72px_minmax(100px,1fr)_84px_72px_auto] sm:items-end">
                <Field label="Number"><Input aria-label={`Question ${q.number} number`} className="max-w-20" value={q.number} disabled={!editing && assessment.questionsConfirmed || locked} onChange={(e) => update(q, { number: e.target.value })} /></Field>
                <Field label="Type"><Select aria-label={`Question ${q.number} type`} value={q.type} disabled={!editing && assessment.questionsConfirmed || locked} onChange={(e) => update(q, { type: e.target.value as QType })}>{Object.entries(QTYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
                <Field label="Marks"><Input aria-label={`Question ${q.number} marks`} type="number" min="0" step="0.5" value={q.marks} disabled={!editing && assessment.questionsConfirmed || locked} onChange={(e) => update(q, { marks: Number(e.target.value) })} /></Field>
                <Field label="Page"><Input aria-label={`Question ${q.number} page`} type="number" min="1" value={q.page} disabled={!editing && assessment.questionsConfirmed || locked} onChange={(e) => update(q, { page: Number(e.target.value) })} /></Field>
                {(editing || !assessment.questionsConfirmed) && !locked && <IconButton label={`Remove question ${q.number}`} className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => remove(q)}><Trash2 size={16} strokeWidth={ICON} /></IconButton>}
              </div>
              <Field label={`Question ${q.number} text`}><Textarea aria-label={`Question ${q.number} text`} rows={2} value={q.text} disabled={!editing && assessment.questionsConfirmed || locked} onChange={(e) => update(q, { text: e.target.value })} /></Field>
              {q.extractionIssue && <Banner tone="warning" title="Check extracted question">{q.extractionIssue}</Banner>}
              {assessment.questionsConfirmed && <p className="font-mono text-[11px] text-ink-4">ID {q.id}</p>}
            </li>)}
          </ol>}
          {(editing || !assessment.questionsConfirmed) && !locked && <div className="border-t border-border p-3"><Button variant="ghost" size="sm" icon={<Plus size={15} strokeWidth={ICON} />} onClick={() => actions.addQuestion(assessment.id)}>Add question</Button></div>}
        </Panel>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Paper versions" actions={<Button variant="secondary" size="sm" disabled={locked} onClick={() => { setReplaceOpen(true); setReplaceError(""); }} icon={<Upload size={14} strokeWidth={ICON} />}>Replace paper</Button>} flush>
          <ol className="divide-y divide-border">{assessment.paperHistory.slice().reverse().map((version) => <li key={version.version} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]"><div className="flex min-w-0 items-center gap-2"><FileText size={16} strokeWidth={ICON} className="shrink-0 text-ink-3" /><div className="min-w-0"><p className="truncate font-medium text-ink">v{version.version} · {version.fileName}</p><p className="text-xs text-ink-3">{state.users.find((u) => u.id === version.uploadedBy)?.name ?? version.uploadedBy} · {fmtDateTime(version.uploadedAt)} · {version.pages} pages</p></div></div>{version.version === assessment.paper?.version && <span className="text-xs text-success">Current</span>}</li>)}</ol>
        </Panel>
        <Panel title="Question structure"><dl className="divide-y divide-border text-[13px]"><div className="flex justify-between py-2"><dt className="text-ink-3">Questions</dt><dd className="tabular-nums">{questions.length}</dd></div><div className="flex justify-between py-2"><dt className="text-ink-3">Question marks</dt><dd className={cx("tabular-nums", marks !== assessment.totalMarks && "text-danger")}>{marks} / {assessment.totalMarks}</dd></div><div className="flex justify-between py-2"><dt className="text-ink-3">Paper pages</dt><dd>{pages}</dd></div></dl></Panel>
      </div>
    </>}
    <Dialog open={replaceOpen} onClose={() => { setReplaceOpen(false); setReplaceConfirm(false); setReplaceFile(null); }} title="Replace question paper" size="md" footer={replaceConfirm ? <><Button variant="ghost" onClick={() => setReplaceConfirm(false)}>Back</Button><Button variant="primary" disabled={!replaceFile} onClick={uploadReplacement}>Record new version</Button></> : <Button variant="ghost" onClick={() => setReplaceOpen(false)}>Close</Button>}>
      {replaceConfirm ? <div className="space-y-3"><Banner tone="warning" title="A new paper version will be recorded">Replacing creates v{(assessment.paper?.version ?? 0) + 1}. The extracted questions must be confirmed again before setup can continue.</Banner><p className="text-[13px]">Selected file: <span className="font-medium text-ink">{replaceFile?.name}</span></p>{replaceError && <Banner tone="danger">{replaceError}</Banner>}</div> : <div className="space-y-3">{replaceError && <Banner tone="danger">{replaceError}</Banner>}<DropZone accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" title="Choose a new question paper" hint="PDF, JPG or PNG · multiple pages supported" sample={{ name: sampleName, sizeMb: 2.4 }} onFile={(name, size) => { setReplaceFile({ name, size }); setReplaceConfirm(true); }} /></div>}
    </Dialog>
  </Root>;
}
