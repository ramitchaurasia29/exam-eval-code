import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause, Workflow } from "lucide-react";
import { useStore } from "../data/store";
import { EVAL_STAGES, EVAL_STATUS } from "../data/selectors";
import { Banner, BulkBar, Button, Checkbox, EmptyState, ICON, Page, PageHeader, Panel, Select, SkeletonRows, StatStrip, StatusText, Tabs, Table, Td, Th, Tr, cx } from "../components/ui";

type QueueTab = "active" | "failed" | "needs_review" | "completed";
export default function ProcessingQueue() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<QueueTab>("active");
  const [assessmentId, setAssessmentId] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 250); return () => clearTimeout(timer); }, []);
  const totals = {
    processing: state.sheets.filter((s) => s.evaluation === "processing").length,
    queued: state.sheets.filter((s) => s.evaluation === "queued").length,
    failed: state.sheets.filter((s) => s.evaluation === "failed").length,
    needs: state.sheets.filter((s) => s.evaluation === "needs_review").length,
    completed: state.sheets.filter((s) => s.evaluation === "evaluated").length,
  };
  const counts: Record<QueueTab, number> = { active: totals.queued + totals.processing, failed: totals.failed, needs_review: totals.needs, completed: totals.completed };
  const rows = useMemo(() => state.sheets.filter((s) => assessmentId === "all" || s.assessmentId === assessmentId).filter((s) => tab === "active" ? s.evaluation === "queued" || s.evaluation === "processing" : tab === "failed" ? s.evaluation === "failed" : tab === "needs_review" ? s.evaluation === "needs_review" : s.evaluation === "evaluated"), [state.sheets, assessmentId, tab]);
  const retryable = rows.filter((s) => s.evaluation === "failed" || s.evaluation === "needs_review");
  const selectedRetryable = selected.filter((id) => retryable.some((s) => s.id === id));
  const statusLabel = state.queuePaused ? "Paused" : `Running · ${state.settings.workers} workers`;
  const selectAll = (checked: boolean) => setSelected(checked ? retryable.map((s) => s.id) : []);
  return <Page wide>
    <PageHeader title="Processing queue" meta={<StatusText tone={state.queuePaused ? "warning" : "success"} label={statusLabel} pulse={!state.queuePaused} />} actions={<Button onClick={() => actions.setQueuePaused(!state.queuePaused)} icon={state.queuePaused ? <Play size={15} strokeWidth={ICON} /> : <Pause size={15} strokeWidth={ICON} />}>{state.queuePaused ? "Resume queue" : "Pause queue"}</Button>} />
    {state.queuePaused && <Banner className="mb-4" tone="warning" title="Evaluation is paused">Queued copies will wait until the queue resumes.</Banner>}
    <StatStrip className="mb-4" items={[{ label: "Processing", value: totals.processing }, { label: "Queued", value: totals.queued }, { label: "Failed", value: totals.failed, tone: totals.failed ? "danger" : undefined }, { label: "Needs review", value: totals.needs, tone: totals.needs ? "warning" : undefined }, { label: "Completed", value: totals.completed }]} />
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Tabs items={[{ id: "active", label: "Active", count: counts.active }, { id: "failed", label: "Failed", count: counts.failed }, { id: "needs_review", label: "Needs review", count: counts.needs_review }, { id: "completed", label: "Completed", count: counts.completed }]} value={tab} onChange={(v) => { setTab(v); setSelected([]); }} /><Select aria-label="Filter by assessment" value={assessmentId} onChange={(e) => { setAssessmentId(e.target.value); setSelected([]); }} className="w-full sm:w-64"><option value="all">All assessments</option>{state.assessments.map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>)}</Select></div>
    <Panel flush>
      {tab !== "active" && tab !== "completed" && selectedRetryable.length > 0 && <BulkBar count={selectedRetryable.length} onClear={() => setSelected([])}><Button variant="primary" size="sm" onClick={() => { actions.retryJobs(selectedRetryable); setSelected([]); }}>Retry {selectedRetryable.length} jobs</Button></BulkBar>}
      {loading ? <SkeletonRows rows={6} cols={6} /> : rows.length === 0 ? <EmptyState icon={<Workflow size={24} strokeWidth={ICON} />} title={tab === "active" ? "Queue is empty" : tab === "failed" ? "No failed jobs" : tab === "needs_review" ? "No copies need review" : "No completed copies"} body={tab === "active" ? "Newly mapped copies will appear here." : undefined} /> : <Table>
        <thead><tr><Th sticky>{tab !== "active" && tab !== "completed" ? <Checkbox label="Select all retryable jobs" checked={retryable.length > 0 && selectedRetryable.length === retryable.length} indeterminate={selectedRetryable.length > 0 && selectedRetryable.length < retryable.length} onChange={selectAll} /> : "Student"}</Th>{tab !== "active" && tab !== "completed" && <Th>Student</Th>}<Th>Assessment</Th><Th>Stage</Th><Th align="right">Attempts</Th><Th>Status</Th><Th>Error</Th><Th /></tr></thead>
        <tbody>{rows.map((sheet) => {
          const student = state.students.find((s) => s.id === sheet.studentId);
          const assessment = state.assessments.find((a) => a.id === sheet.assessmentId);
          const canRetry = sheet.evaluation === "failed" || sheet.evaluation === "needs_review";
          return <Tr key={sheet.id} onClick={() => sheet.evaluation === "evaluated" && navigate(`/review/${sheet.id}`)}>
            <Td sticky>{canRetry ? <Checkbox label={`Select ${student?.name ?? "student"}`} checked={selected.includes(sheet.id)} onChange={(checked) => setSelected((old) => checked ? [...old, sheet.id] : old.filter((id) => id !== sheet.id))} /> : <span className="font-medium text-ink">{student?.name ?? "Student"}</span>}</Td>
            {tab !== "active" && tab !== "completed" && <Td><span className="font-medium text-ink">{student?.name ?? "Student"}</span><span className="block text-xs text-ink-3">Class {student?.grade}{student?.section} · Roll {student?.roll}</span></Td>}
            <Td><span className="block">{assessment?.name ?? "Assessment"}</span><span className="text-xs text-ink-3">Class {assessment?.grade}</span></Td>
            <Td><div className="w-40"><div className="flex gap-1" aria-label={`Stage: ${EVAL_STAGES[Math.min(sheet.stage, 3)] ?? "Completed"}`} title={EVAL_STAGES[Math.min(sheet.stage, 3)] ?? "Completed"}>{EVAL_STAGES.map((stage, i) => <span key={stage} className={cx("h-1.5 flex-1 rounded-full", sheet.evaluation === "evaluated" || i < sheet.stage ? "bg-primary" : i === sheet.stage && sheet.evaluation === "processing" ? "bg-primary/50 animate-pulse-soft" : "bg-muted")} />)}</div><span className="mt-1 block text-[11px] text-ink-3">{sheet.evaluation === "evaluated" ? "Complete" : EVAL_STAGES[sheet.stage] ?? "Waiting"}</span></div></Td>
            <Td align="right">{sheet.attempts}</Td><Td><StatusText tone={EVAL_STATUS[sheet.evaluation].tone} label={EVAL_STATUS[sheet.evaluation].label} pulse={sheet.evaluation === "processing"} /></Td>
            <Td className="max-w-56"><span className="block max-w-56 truncate text-xs text-ink-3" title={sheet.error ?? ""}>{sheet.error ?? "None"}</span></Td><Td>{canRetry ? <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); actions.retryJobs([sheet.id]); }}>Retry</Button> : sheet.evaluation === "evaluated" ? <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/review/${sheet.id}`); }}>Open</Button> : null}</Td>
          </Tr>;
        })}</tbody>
      </Table>}
      {!loading && rows.length > 0 && <div className="border-t border-border px-4 py-2.5 text-[13px] text-ink-3">One failed copy never blocks others.</div>}
    </Panel>
  </Page>;
}
