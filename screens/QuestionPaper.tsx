import { Fragment, useState } from "react";
import type { ElementType } from "react";
import type { Embed } from "../components/embed";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useStore } from "../data/store";
import type { Question, QType } from "../data/types";
import { fmtDateTime, QTYPE_LABEL } from "../data/selectors";
import AssessmentHeader, { useAssessmentParam } from "../components/AssessmentHeader";
import { Banner, Button, Dialog, DropZone, EmptyState, Field, ICON, IconButton, Input, Page, Panel, Select, Skeleton, Textarea, cx } from "../components/ui";
import { useScreenInit } from "../useScreenInit";

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
  const sheets = state.sheets.filter((s) => s.assessmentId === id);
  const locked = sheets.length > 0;

  if (!assessment) return <Page><EmptyState title="Assessment not found" body="This assessment may have been removed or the link may be out of date." action={<Button onClick={() => navigate("/assessments")}>View assessments</Button>} /></Page>;

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
      <Panel title="Upload question paper" className="max-w-3xl">
        {extracting ? <div className="space-y-4" aria-live="polite"><p className="text-sm font-medium text-ink">Extracting questions…</p><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : <>
          {error && <Banner tone="danger" className="mb-4">{error}</Banner>}
          <DropZone accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" title="Drop the question paper here" hint="PDF, JPG or PNG · multiple pages supported" sample={{ name: sampleName, sizeMb: 2.4 }} onFile={(name) => onPaper(name)} />
        </>}
      </Panel>
    ) : <>
      {assessment.questionsConfirmed && !editing && <Banner tone="success" className="mb-4" title="Question structure confirmed">The extracted structure is read-only. Stable question IDs are retained for answer keys and marking.</Banner>}
      {locked && <Banner tone="info" className="mb-4" title="Question structure and paper versions are locked">Copies have already been uploaded for this assessment. Editing or replacing the question paper is unavailable.</Banner>}
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
          {!questions.length ? <EmptyState title="No questions extracted" body="Add questions to build the assessment structure." /> : <ol className="divide-y divide-border">
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
