import { Fragment, useState } from "react";
import type { ElementType } from "react";
import type { Embed } from "../components/embed";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Plus, Trash2, WandSparkles } from "lucide-react";
import { useStore } from "../data/store";
import type { Question } from "../data/types";
import AssessmentHeader, { useAssessmentParam } from "../components/AssessmentHeader";
import { Banner, Button, Dialog, DropZone, EmptyState, Field, ICON, IconButton, Input, Meta, Page, Panel, Radio, Skeleton, Textarea } from "../components/ui";
import { useScreenInit } from "../useScreenInit";

function EditableList({ title, values, disabled, onChange }: { title: string; values: string[]; disabled: boolean; onChange: (next: string[]) => void }) {
  const setAt = (index: number, value: string) => onChange(values.map((item, i) => i === index ? value : item));
  return <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-[13px] font-medium text-ink">{title}</p><Button size="sm" variant="ghost" disabled={disabled} icon={<Plus size={14} strokeWidth={ICON} />} onClick={() => onChange([...values, ""])}>Add</Button></div>{values.length === 0 && <p className="text-xs text-ink-4">No items added</p>}{values.map((value, index) => <div key={`${title}-${index}`} className="flex items-center gap-2"><Input aria-label={`${title} ${index + 1}`} value={value} disabled={disabled} onChange={(e) => setAt(index, e.target.value)} /><IconButton label={`Remove ${title.toLowerCase()} ${index + 1}`} disabled={disabled} onClick={() => onChange(values.filter((_, i) => i !== index))}><Trash2 size={15} strokeWidth={ICON} /></IconButton></div>)}</div>;
}

export default function AnswerKey({ embed }: { embed?: Embed }) {
  const params = useParams();
  const id = embed?.id ?? params.id;
  const Root: ElementType = embed ? Fragment : Page;
  const assessment = useAssessmentParam(id);
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const init = useScreenInit();
  const [mode, setMode] = useState<"ai" | "manual">(init.mode === "manual" ? "manual" : "ai");
  const [error, setError] = useState(typeof init.approveError === "string" ? init.approveError : "");
  const [editOpen, setEditOpen] = useState(!!init.editOpen);

  if (!assessment) return <Page><EmptyState title="Exam not found" body="This exam may have been removed or the link may be out of date." action={<Button onClick={() => navigate("/assessments")}>View exams</Button>} /></Page>;
  const copies = state.sheets.filter((s) => s.assessmentId === assessment.id);
  const evaluating = copies.some((s) => s.evaluation === "queued" || s.evaluation === "processing");
  const readonly = assessment.answerKey.status === "approved";
  const generatingLabel = assessment.answerKey.mode === "manual" ? `Mapping answers from ${assessment.answerKey.manualFile ?? "uploaded key"}…` : `Generating answers for ${assessment.questions.length} questions…`;
  const approve = () => {
    const result = actions.approveAnswerKey(assessment.id);
    if (!result.ok) { setError(result.error); return; }
    setError(""); actions.toast(`Answer key approved (v${assessment.answerKey.version + 1})`, { tone: "success" });
    if (embed) embed.onNext(); else navigate(`/assessments/${assessment.id}/setup/rubric`);
  };
  const startEdit = () => {
    actions.updateAssessment(assessment.id, { answerKey: { ...assessment.answerKey, status: "draft" } });
    setEditOpen(false); setError("");
  };
  const patchQuestion = (q: Question, patch: Partial<Question>) => actions.updateQuestion(assessment.id, q.id, patch);

  return <Root>
    {!embed && <AssessmentHeader assessment={assessment} tab="answer-key" />}
    {!assessment.questionsConfirmed ? <Panel className="max-w-3xl"><EmptyState title="Confirm the question paper first" body="The answer key is mapped to stable question IDs. Confirm the question structure before drafting or uploading answers." action={<Button variant="primary" onClick={() => embed ? embed.goStep("paper") : navigate(`/assessments/${assessment.id}/setup/paper`)}>Go to question paper</Button>} /></Panel> : <>
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
      {assessment.answerKey.status === "none" && <div className="max-w-4xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Radio name="key-mode" checked={mode === "ai"} onChange={() => setMode("ai")} label="Generate with AI" description="Drafts answers, steps for numericals and key points. You approve every answer." />
          <Radio name="key-mode" checked={mode === "manual"} onChange={() => setMode("manual")} label="Upload teacher's key" description="Upload a PDF or image. Answers are mapped to question IDs for your review." />
        </div>
        {mode === "ai" ? <Panel title="AI answer key draft"><p className="mb-4 text-[13px] text-ink-3">AI drafts a response for every question using its type, wording and marks. You can edit the content before approval.</p><Button variant="primary" icon={<WandSparkles size={15} strokeWidth={ICON} />} onClick={() => { setError(""); actions.generateAnswerKey(assessment.id); }}>Generate answer key</Button></Panel> : <Panel title="Upload teacher's answer key"><DropZone accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" title="Drop the answer key here" hint="PDF, JPG or PNG · answers will be mapped to question IDs" sample={{ name: "Answer_key.pdf", sizeMb: 1.8 }} onFile={(name) => { setError(""); actions.uploadManualKey(assessment.id, name); }} /></Panel>}
      </div>}
      {assessment.answerKey.status === "generating" && <Panel title="Preparing answer key" className="max-w-4xl"><div className="space-y-4" aria-live="polite"><p className="text-sm text-ink-2">{generatingLabel}</p>{assessment.questions.map((q) => <div key={q.id} className="space-y-2 border-b border-border pb-4"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-16 w-full" /></div>)}</div></Panel>}
      {(assessment.answerKey.status === "draft" || readonly) && <>
        {assessment.answerKey.status === "draft" && assessment.answerKey.mode === "ai" && <Banner tone="info" className="mb-4" title="AI output is a draft">Nothing is used for marking until you approve it.</Banner>}
        {readonly && <Panel title="Answer key version" className="mb-4" flush><dl className="grid gap-x-6 px-4 py-2 sm:grid-cols-2"><Meta label="Version">v{assessment.answerKey.version}</Meta><Meta label="Source">{assessment.answerKey.mode === "ai" ? "AI-generated" : "Teacher-prepared"}</Meta><Meta label="Approved by">{state.users.find((u) => u.id === assessment.answerKey.approvedBy)?.name ?? assessment.answerKey.approvedBy ?? "—"}</Meta><Meta label="Approved at">{assessment.answerKey.approvedAt ? new Date(assessment.answerKey.approvedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</Meta>{assessment.answerKey.manualFile && <Meta label="Uploaded file">{assessment.answerKey.manualFile}</Meta>}</dl></Panel>}
        <Panel title="Answers by question" actions={<span className="text-xs text-ink-3">{assessment.questions.length} questions</span>} flush>
          <ol className="divide-y divide-border">{assessment.questions.map((q) => <li key={q.id} className="space-y-3 p-4">
            <div><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold text-ink">Q{q.number} <span className="font-normal text-ink-3">· {q.type} · {q.marks} {q.marks === 1 ? "mark" : "marks"}</span></p><span className="font-mono text-[11px] text-ink-4">{q.id}</span></div><p className="mt-1 text-[13px] text-ink-3">{q.text}</p></div>
            <Field label={`Answer for question ${q.number}`}><Textarea aria-label={`Answer for question ${q.number}`} rows={3} value={q.answer} readOnly={readonly} onChange={(e) => patchQuestion(q, { answer: e.target.value })} /></Field>
            <div className="grid gap-4 md:grid-cols-2"><EditableList title="Key points" values={q.keyPoints} disabled={readonly} onChange={(keyPoints) => patchQuestion(q, { keyPoints })} />{q.type === "numerical" && <EditableList title="Steps" values={q.steps ?? []} disabled={readonly} onChange={(steps) => patchQuestion(q, { steps })} />}</div>
            <EditableList title="Accepted alternatives" values={q.alternatives} disabled={readonly} onChange={(alternatives) => patchQuestion(q, { alternatives })} />
            {q.aiNote && <Banner tone="warning" title="Review this answer">{q.aiNote}</Banner>}
          </li>)}</ol>
        </Panel>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {readonly ? <><p className="mr-auto text-xs text-ink-3">Approved versions are retained for existing evaluation runs.</p><Button variant="secondary" disabled={evaluating} onClick={() => setEditOpen(true)}>Edit answer key</Button></> : <Button variant="primary" icon={<Check size={15} strokeWidth={ICON} />} onClick={approve}>Approve answer key</Button>}
        </div>
        {readonly && evaluating && <p className="mt-2 text-right text-xs text-ink-3">Editing is unavailable while copies are queued or being evaluated.</p>}
      </>}
    </>}
    <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit answer key" size="sm" footer={<><Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button><Button variant="primary" disabled={evaluating} onClick={startEdit}>Create draft version</Button></>}>
      <p>Editing creates version {assessment.answerKey.version + 1}. Copies already evaluated keep v{assessment.answerKey.version}.</p>{evaluating && <Banner tone="warning" className="mt-3">Editing is unavailable while copies are queued or being evaluated.</Banner>}
    </Dialog>
  </Root>;
}

