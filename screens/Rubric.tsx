import { Fragment, useState } from "react";
import type { ElementType } from "react";
import type { Embed } from "../components/embed";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useStore } from "../data/store";
import type { Criterion } from "../data/types";
import { QTYPE_LABEL } from "../data/selectors";
import AssessmentHeader, { useAssessmentParam } from "../components/AssessmentHeader";
import { Banner, Button, Dialog, EmptyState, Field, ICON, IconButton, Input, Meta, Page, Panel, Radio, Skeleton, StatStrip } from "../components/ui";
import { useScreenInit } from "../useScreenInit";

export default function Rubric({ embed }: { embed?: Embed }) {
  const params = useParams();
  const id = embed?.id ?? params.id;
  const Root: ElementType = embed ? Fragment : Page;
  const assessment = useAssessmentParam(id);
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const init = useScreenInit();
  const [error, setError] = useState(typeof init.approveError === "string" ? init.approveError : "");
  const [reevaluateOpen, setReevaluateOpen] = useState(!!init.reevaluateOpen);
  const [choice, setChoice] = useState<"none" | "unverified" | "all">("none");
  const [expanded, setExpanded] = useState<string[]>([]);

  if (!assessment) return <Page><EmptyState title="Exam not found" body="This exam may have been removed or the link may be out of date." action={<Button onClick={() => navigate("/assessments")}>View exams</Button>} /></Page>;
  const copies = state.sheets.filter((s) => s.assessmentId === assessment.id);
  const evaluatedCopies = copies.filter((s) => s.evaluation === "evaluated").length;
  const unverifiedCopies = copies.filter((s) => s.verification !== "verified").length;
  const approved = assessment.rubric.status === "approved";
  const mismatches = assessment.questions.filter((q) => q.criteria.reduce((sum, criterion) => sum + criterion.marks, 0) !== q.marks || q.criteria.length === 0);
  const allCriteriaMarks = assessment.questions.reduce((sum, q) => sum + q.marks, 0);
  const allCriteria = assessment.questions.reduce((sum, q) => sum + q.criteria.reduce((subtotal, c) => subtotal + c.marks, 0), 0);
  const setCriteria = (qid: string, criteria: Criterion[]) => actions.setCriteria(assessment.id, qid, criteria);
  const approve = (reevaluate: "none" | "unverified" | "all" = "none") => {
    const result = actions.approveRubric(assessment.id, reevaluate);
    if (!result.ok) { setError(result.error); setReevaluateOpen(false); return; }
    setError(""); setReevaluateOpen(false);
    actions.toast(`Rubric approved (v${assessment.rubric.version + 1})`, { tone: "success" });
    if (embed) embed.onNext(); else navigate(`/assessments/${assessment.id}`);
  };
  const goEdit = () => {
    actions.updateAssessment(assessment.id, { rubric: { ...assessment.rubric, status: "draft" } });
    setError("");
  };

  return <Root>
    {!embed && <AssessmentHeader assessment={assessment} tab="rubric" />}
    {assessment.answerKey.status !== "approved" ? <Panel className="max-w-3xl"><EmptyState title="Approve the answer key first" body="The rubric uses the approved answers as its marking reference. Complete the answer key step before generating criteria." action={<Button variant="primary" onClick={() => embed ? embed.goStep("answer-key") : navigate(`/assessments/${assessment.id}/setup/answer-key`)}>Go to answer key</Button>} /></Panel> : <>
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      {assessment.rubric.status === "none" && <Panel className="max-w-3xl" title="Create a marking rubric"><EmptyState title="No rubric yet" body="Generate criteria from the approved answer key, then adjust each question's marks before approval." action={<Button variant="primary" icon={<RefreshCw size={15} strokeWidth={ICON} />} onClick={() => { setError(""); actions.generateRubric(assessment.id); }}>Generate rubric</Button>} /></Panel>}
      {assessment.rubric.status === "generating" && <Panel title="Generating rubric" className="max-w-4xl"><div className="space-y-4" aria-live="polite"><p className="text-sm text-ink-2">Drafting criteria for {assessment.questions.length} questions…</p>{assessment.questions.map((q) => <div key={q.id} className="space-y-2 border-b border-border pb-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>)}</div></Panel>}
      {(assessment.rubric.status === "draft" || approved) && <>
        {approved && <Banner tone="info" className="mb-4" title={`Rubric v${assessment.rubric.version} is approved`}>Approved versions are immutable for evaluation runs. Editing creates a new version.</Banner>}
        <StatStrip className="mb-4" items={[{ label: "Questions", value: assessment.questions.length }, { label: "Question marks", value: `${allCriteriaMarks} / ${assessment.totalMarks}` }, { label: "Criteria marks", value: `${allCriteria} / ${allCriteriaMarks}`, tone: mismatches.length ? "danger" : "success" }, { label: "Mismatched questions", value: mismatches.length, tone: mismatches.length ? "danger" : "success" }]} />
        {approved && <Panel title="Approved version" className="mb-4" flush><dl className="grid px-4 py-2 sm:grid-cols-3"><Meta label="Version">v{assessment.rubric.version}</Meta><Meta label="Approved by">{state.users.find((u) => u.id === assessment.rubric.approvedBy)?.name ?? assessment.rubric.approvedBy ?? "—"}</Meta><Meta label="Approved at">{assessment.rubric.approvedAt ? new Date(assessment.rubric.approvedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</Meta></dl></Panel>}
        <ol className="space-y-3">{assessment.questions.map((q) => {
          const total = q.criteria.reduce((sum, c) => sum + c.marks, 0);
          const mismatch = total !== q.marks || q.criteria.length === 0;
          const isExpanded = expanded.includes(q.id);
          const setOne = (index: number, patch: Partial<Criterion>) => setCriteria(q.id, q.criteria.map((c, i) => i === index ? { ...c, ...patch } : c));
          return <li key={q.id}><Panel flush>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0"><h2 className="text-sm font-semibold text-ink">Q{q.number} <span className="font-normal text-ink-3">· {QTYPE_LABEL[q.type]} · {q.marks} {q.marks === 1 ? "mark" : "marks"}</span></h2><p className="mt-1 text-[13px] text-ink-3">{q.text}</p></div>
              <div className="flex items-center gap-2"><Button variant="ghost" size="sm" disabled={approved} icon={<RefreshCw size={14} strokeWidth={ICON} />} onClick={() => actions.regenerateRubricFor(assessment.id, q.id)}>Regenerate</Button><span className={`text-xs font-medium tabular-nums ${mismatch ? "text-danger" : "text-success"}`}>{total} of {q.marks} {q.marks === 1 ? "mark" : "marks"}</span></div>
            </div>
            <div className="px-4 py-3">
              <button className="flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink" aria-expanded={isExpanded} onClick={() => setExpanded((current) => isExpanded ? current.filter((qid) => qid !== q.id) : [...current, q.id])}>{isExpanded ? <ChevronDown size={14} strokeWidth={ICON} /> : <ChevronDown size={14} strokeWidth={ICON} className="-rotate-90" />}Answer key excerpt</button>
              {isExpanded && <div className="mt-2 rounded-md bg-subtle p-3 text-[13px] text-ink-2"><p>{q.answer || "No answer text"}</p>{q.steps?.length ? <ol className="mt-2 list-decimal pl-5">{q.steps.map((step, i) => <li key={i}>{step}</li>)}</ol> : null}</div>}
              <div className="mt-4 space-y-2">
                <div className="hidden grid-cols-[minmax(0,1fr)_88px_32px] gap-2 px-1 text-xs font-medium text-ink-3 sm:grid"><span>Criterion</span><span>Marks</span><span /></div>
                {q.criteria.map((criterion, index) => <div key={criterion.id} className="grid grid-cols-[minmax(0,1fr)_88px_32px] items-end gap-2">
                  <Field label={`Criterion ${index + 1}`} className="sm:[&>label]:sr-only"><Input aria-label={`Criterion ${index + 1} label for question ${q.number}`} value={criterion.label} readOnly={approved} onChange={(e) => setOne(index, { label: e.target.value })} /></Field>
                  <Field label="Marks" className="sm:[&>label]:sr-only"><Input aria-label={`Criterion ${index + 1} marks for question ${q.number}`} type="number" min="0" step="0.5" value={criterion.marks} readOnly={approved} onChange={(e) => setOne(index, { marks: Number(e.target.value) })} /></Field>
                  <IconButton label={`Remove criterion ${index + 1} from question ${q.number}`} disabled={approved} onClick={() => setCriteria(q.id, q.criteria.filter((_, i) => i !== index))}><Trash2 size={15} strokeWidth={ICON} /></IconButton>
                </div>)}
                {!approved && <Button variant="ghost" size="sm" icon={<Plus size={14} strokeWidth={ICON} />} onClick={() => setCriteria(q.id, [...q.criteria, { id: `${q.id}-c-${Date.now()}`, label: "", marks: 0 }])}>Add criterion</Button>}
                {mismatch && <p className="text-xs text-danger">Criteria must add up to the question's marks</p>}
              </div>
              {q.alternatives.length > 0 && <p className="mt-4 rounded-md bg-subtle px-3 py-2 text-xs text-ink-3">Alternative approaches accepted: {q.alternatives.join("; ")}</p>}
            </div>
          </Panel></li>;
        })}</ol>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {approved ? <><p className="mr-auto text-xs text-ink-3">Edits create a new version and do not change existing evaluation runs.</p><Button variant="secondary" onClick={goEdit}>Edit rubric</Button></> : <Button variant="primary" icon={<Check size={15} strokeWidth={ICON} />} onClick={() => {
            setError("");
            if (evaluatedCopies > 0 && assessment.rubric.version > 0) { setChoice("none"); setReevaluateOpen(true); }
            else approve();
          }}>Approve rubric</Button>}
        </div>
      </>}
    </>}
    <Dialog open={reevaluateOpen} onClose={() => setReevaluateOpen(false)} title={`Re-evaluate copies with rubric v${assessment.rubric.version + 1}?`} size="md" footer={<><Button variant="ghost" onClick={() => setReevaluateOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => approve(choice)}>Approve rubric</Button></>}>
      <p className="mb-4">Choose how the new rubric version applies to copies that already have results.</p>
      <div className="space-y-2"><Radio name="reevaluate-choice" checked={choice === "none"} onChange={() => setChoice("none")} label="Keep existing results" description="No copies will be re-evaluated." /><Radio name="reevaluate-choice" checked={choice === "unverified"} onChange={() => setChoice("unverified")} label="Re-evaluate copies not yet verified" description={`${unverifiedCopies} copies will be queued.`} /><Radio name="reevaluate-choice" checked={choice === "all"} onChange={() => setChoice("all")} label="Re-evaluate all copies" description={`${copies.length} copies will be queued. Verified copies reopen and need re-verification.`} /></div>
    </Dialog>
  </Root>;
}

