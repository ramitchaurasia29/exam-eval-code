import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Pause, Play, ScanLine } from "lucide-react";
import { useStore } from "../data/store";
import { BATCH_STAGES, EVAL_STAGES, EVAL_STATUS, UNMATCHED_REASON, relTime } from "../data/selectors";
import { Lifecycle } from "../components/booklet";
import { Banner, Button, ButtonLink, EmptyState, ICON, Page, PageHeader, Panel, Progress, StatStrip, StatusText, Table, Td, Th, Tr, cx } from "../components/ui";

export default function BatchProgress() {
  const { batchId } = useParams();
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const batch = state.batches.find((b) => b.id === batchId);
  const assessment = batch && state.assessments.find((a) => a.id === batch.assessmentId);
  const sheets = useMemo(() => state.sheets.filter((s) => s.batchId === batchId), [state.sheets, batchId]);
  const unmatched = state.unmatched.filter((u) => u.batchId === batchId && u.status === "open");
  if (!batch || !assessment) return <Page><EmptyState className="py-24" title="Upload not found" body="This batch may have been removed or the link may be out of date." action={<ButtonLink to="/uploads">Back to uploads</ButtonLink>} /></Page>;
  const isRunning = batch.status === "processing";
  const status = batch.status === "completed" ? "Completed" : batch.status === "partial" ? "Needs mapping" : batch.status === "paused" ? "Paused" : batch.status === "failed" ? "Failed" : "Processing";
  const uploadedBy = state.users.find((u) => u.id === batch.uploadedBy)?.name ?? "Exam Cell";
  return <Page wide>
    <PageHeader title={batch.fileName} crumbs={[{ label: "Uploads", to: "/uploads" }, { label: batch.fileName }]} meta={<><span>{assessment.name} · Class {assessment.grade}</span><span>Uploaded by {uploadedBy} · {relTime(batch.uploadedAt)}</span><StatusText tone={batch.status === "completed" ? "success" : batch.status === "partial" ? "warning" : batch.status === "failed" ? "danger" : batch.status === "paused" ? "muted" : "info"} label={status} pulse={isRunning} /></>} actions={isRunning || batch.status === "paused" ? <Button onClick={() => actions.pauseBatch(batch.id, isRunning)} icon={isRunning ? <Pause size={15} strokeWidth={ICON} /> : <Play size={15} strokeWidth={ICON} />}>{isRunning ? "Pause processing" : "Resume processing"}</Button> : undefined}>
      <p className="mt-1 text-xs text-ink-3">{batch.sizeMb.toFixed(1)} MB · {batch.pages.toLocaleString("en-IN")} pages · Original PDF kept unchanged</p>
    </PageHeader>
    <Panel className="mb-4" title="Processing pipeline">
      <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {BATCH_STAGES.map((stage, i) => {
          const done = i < batch.stage || batch.status === "completed" || batch.status === "partial";
          const active = i === batch.stage && isRunning;
          return <li key={stage} className="min-w-0">
            <div className="mb-2 flex items-center gap-2"><span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", done ? "bg-success-soft text-success" : active ? "bg-primary-soft text-primary-ink" : "bg-muted text-ink-3")}>{done ? "✓" : i + 1}</span><span className={cx("truncate text-xs", active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-3")}>{stage}</span></div>
            {active ? <Progress value={batch.progress} label={`${stage} progress`} /> : <div className={cx("h-1.5 rounded-full", done ? "bg-success" : "bg-muted")} />}
          </li>;
        })}
      </ol>
      {batch.error && <p className="mt-3 text-xs text-danger">{batch.error}</p>}
    </Panel>
    <StatStrip className="mb-4" items={[{ label: "Pages", value: batch.pages.toLocaleString("en-IN") }, { label: "Booklets detected", value: batch.booklets.toLocaleString("en-IN") }, { label: "Mapped", value: batch.mapped.toLocaleString("en-IN") }, { label: "Need mapping", value: batch.unmatched.toLocaleString("en-IN"), tone: batch.unmatched ? "warning" : undefined }]} />
    {batch.status === "completed" && <Banner className="mb-4" tone="success" title={`${batch.mapped} booklets mapped and queued for evaluation`} action={<ButtonLink to="/queue" variant="primary" size="sm" iconRight={<ArrowRight size={14} strokeWidth={ICON} />}>View queue</ButtonLink>} />}
    {(batch.status === "partial" || unmatched.length > 0) && <Banner className="mb-4" tone="warning" title={`${unmatched.length || batch.unmatched} booklets need mapping. They stay out of evaluation until mapped.`} action={<ButtonLink to="/unmatched" variant="primary" size="sm">Map booklets</ButtonLink>} />}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Booklets" flush>
        {sheets.length + unmatched.length === 0 ? <EmptyState icon={<ScanLine size={24} strokeWidth={ICON} />} title={isRunning ? "Booklets are being identified" : "No booklets in this batch yet"} body={isRunning ? "Mapped copies will appear here as processing advances." : undefined} /> : <Table>
          <thead><tr><Th sticky>Student</Th><Th>Roll</Th><Th>Barcode</Th><Th align="right">Pages</Th><Th>Evaluation status</Th><Th>Lifecycle</Th></tr></thead>
          <tbody>
            {unmatched.map((u) => <Tr key={u.id} onClick={() => navigate(`/unmatched?figr_screen=unmatched_queue&itemId=${u.id}`)}><Td sticky><span className="font-medium text-ink">Unmatched booklet</span><span className="block text-xs text-warning">{UNMATCHED_REASON[u.reason].label}</span></Td><Td>Pages {u.pagesFrom}–{u.pagesTo}</Td><Td mono>{u.decoded ?? "No barcode"}</Td><Td align="right">{u.pagesTo - u.pagesFrom + 1}</Td><Td><StatusText tone="warning" label="Needs mapping" /></Td><Td><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/unmatched?figr_screen=unmatched_queue&itemId=${u.id}`); }}>Map</Button></Td></Tr>)}
            {sheets.map((sheet) => { const student = state.students.find((s) => s.id === sheet.studentId); return <Tr key={sheet.id} onClick={() => navigate(`/review/${sheet.id}`)}><Td sticky className="font-medium text-ink">{student?.name ?? "Student"}</Td><Td>{student?.roll}</Td><Td mono>{student?.barcode}</Td><Td align="right">{sheet.pages}</Td><Td><div><StatusText tone={EVAL_STATUS[sheet.evaluation].tone} label={EVAL_STATUS[sheet.evaluation].label} /><span className="mt-1 block text-[11px] text-ink-3">{sheet.evaluation === "processing" ? EVAL_STAGES[sheet.stage] ?? "Processing" : sheet.evaluation === "queued" ? "Queued for evaluation" : ""}</span></div></Td><Td><Lifecycle sheet={sheet} dists={state.distributions} /></Td></Tr>; })}
          </tbody>
        </Table>}
      </Panel>
      <Panel title="Page checks" className="h-fit" flush>
        {batch.pageIssues.length ? <ul className="divide-y divide-border">{batch.pageIssues.map((issue, i) => <li key={`${issue.page}-${i}`} className="flex items-start gap-2.5 px-4 py-3"><span className="mt-0.5 rounded-sm bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning">Page {issue.page}</span><span className="text-[13px] text-ink-2">{issue.issue}</span></li>)}</ul> : <p className="px-4 py-6 text-center text-[13px] text-ink-3">No page issues detected.</p>}
      </Panel>
    </div>
  </Page>;
}
