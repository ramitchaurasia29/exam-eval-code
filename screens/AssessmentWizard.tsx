import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useStore } from "../data/store";
import { Button, EmptyState, ICON, Page, PageHeader, Panel, Stepper } from "../components/ui";
import type { Embed } from "../components/embed";
import AssessmentCreate from "./AssessmentCreate";
import QuestionPaper from "./QuestionPaper";
import AnswerKey from "./AnswerKey";
import Rubric from "./Rubric";
import BulkUpload from "./BulkUpload";

const STEPS = ["details", "paper", "answer-key", "rubric", "sheets"] as const;
type Step = (typeof STEPS)[number];
const LABELS: Record<Step, string> = { details: "Details", paper: "Question paper", "answer-key": "Answer key", rubric: "Rubric", sheets: "Answer sheets" };
const SUBTITLE: Record<Step, string> = {
  details: "Tell us about the exam. The next steps unlock once this is saved.",
  paper: "Upload the question paper, then confirm the extracted questions and marks.",
  "answer-key": "Generate the key with AI, or upload the key you prepared. Approve it to continue.",
  rubric: "Review the marking criteria for each question and approve the rubric.",
  sheets: "Upload students' answer sheets. Evaluation starts as soon as copies are mapped.",
};

/** The whole create-assessment journey in one place: details → paper → key → rubric → answer sheets. */
export default function AssessmentWizard() {
  const { id, step: stepParam } = useParams();
  const { state, role } = useStore();
  const navigate = useNavigate();
  const assessment = state.assessments.find((a) => a.id === id);
  const listPath = role === "admin" ? "/assessments" : "/teacher/assessments";
  const step: Step = id ? ((STEPS as readonly string[]).includes(stepParam ?? "") ? (stepParam as Step) : "paper") : "details";
  const base = id ? `/assessments/${id}/create` : "";
  const go = (s: Step) => navigate(s === "details" ? "/assessments/new" : `${base}/${s}`);

  if (id && !assessment) return <Page><EmptyState title="Exam not found" body="This exam may have been removed or the link may be out of date." action={<Button onClick={() => navigate(listPath)}>View exams</Button>} /></Page>;

  const hasSheets = !!assessment && state.sheets.some((s) => s.assessmentId === assessment.id);
  const done: boolean[] = [
    !!assessment,
    !!assessment?.paper && !!assessment.questionsConfirmed,
    assessment?.answerKey.status === "approved",
    assessment?.rubric.status === "approved",
    hasSheets,
  ];
  const idx = STEPS.indexOf(step);
  // A step is reachable once every step before it is done.
  const reachable = (i: number) => done.slice(0, i).every(Boolean);
  if (assessment && !reachable(idx)) {
    const first = STEPS[done.findIndex((d) => !d)] ?? "paper";
    return <Navigate to={`${base}/${first}`} replace />;
  }

  const embed: Embed | undefined = assessment ? { id: assessment.id, onNext: () => go(STEPS[Math.min(STEPS.length - 1, idx + 1)]), goStep: (s) => go(s) } : undefined;
  const steps = STEPS.map((s, i) => ({ label: LABELS[s], done: done[i], to: assessment && i > 0 && i !== idx && (done[i] || reachable(i)) ? `${base}/${s}` : undefined }));

  return <Page>
    <PageHeader
      title={assessment ? assessment.name : "Create Exam"}
      meta={assessment ? <span>Class {assessment.grade} · {assessment.subject} · Sections {assessment.sections.join(", ")}</span> : undefined}
      crumbs={[{ label: role === "admin" ? "Exam Evaluator" : "My exams", to: listPath }, { label: "Create Exam" }]}
    />
    <div className="mx-auto max-w-[920px]">
      <div className="mb-1 overflow-x-auto"><Stepper current={idx} steps={steps} /></div>
      <p className="mb-4 mt-2 text-[13px] text-ink-3">{SUBTITLE[step]}</p>

      {step === "details" && <div className="mx-auto max-w-[640px]"><AssessmentCreate onCreated={(newId) => navigate(`/assessments/${newId}/create/paper`)} /></div>}
      {assessment && embed && step === "paper" && <QuestionPaper embed={embed} />}
      {assessment && embed && step === "answer-key" && <AnswerKey embed={embed} />}
      {assessment && embed && step === "rubric" && <Rubric embed={embed} />}
      {assessment && step === "sheets" && <div className="mx-auto max-w-[720px]"><Panel title="Add students' answer sheets">
        {hasSheets && <p className="mb-4 rounded-md bg-subtle px-3 py-2 text-[13px] text-ink-2">Copies are already uploaded for this exam. You can add more, or go to the Students view to follow evaluation.</p>}
        <BulkUpload assessmentId={assessment.id} onDone={() => navigate(`/assessments/${assessment.id}/students`)} />
      </Panel></div>}

      {assessment && <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="ghost" icon={<ArrowLeft size={15} strokeWidth={ICON} />} disabled={idx <= 1} onClick={() => go(STEPS[idx - 1])}>Back</Button>
        {step === "sheets"
          ? <Button variant={hasSheets ? "primary" : "secondary"} iconRight={<ArrowRight size={15} strokeWidth={ICON} />} onClick={() => navigate(`/assessments/${assessment.id}/students`)}>{hasSheets ? "Go to students" : "Skip for now"}</Button>
          : <Button variant="primary" iconRight={<ArrowRight size={15} strokeWidth={ICON} />} disabled={!done[idx]} onClick={() => go(STEPS[idx + 1])}>Continue</Button>}
      </div>}
    </div>
  </Page>;
}
