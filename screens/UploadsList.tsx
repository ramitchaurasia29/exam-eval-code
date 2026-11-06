import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Search } from "lucide-react";
import { useStore } from "../data/store";
import { BATCH_STAGES, relTime } from "../data/selectors";
import { ButtonLink, EmptyState, ICON, Page, PageHeader, Panel, Progress, SearchInput, Select, SkeletonRows, StatusText, Tabs, Table, Td, Th, Tr, cx } from "../components/ui";

export default function UploadsList() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [assessmentId, setAssessmentId] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 280); return () => clearTimeout(timer); }, []);
  const openCount = state.unmatched.filter((u) => u.status === "open").length;
  const rows = useMemo(() => state.batches.filter((b) => assessmentId === "all" || b.assessmentId === assessmentId).filter((b) => {
    const a = state.assessments.find((x) => x.id === b.assessmentId);
    return `${b.fileName} ${a?.name ?? ""} ${a?.subject ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [state.batches, state.assessments, assessmentId, query]);
  const status = (batch: typeof state.batches[number]) => {
    if (batch.status === "processing") return <div className="min-w-28"><StatusText tone="info" label={BATCH_STAGES[batch.stage] ?? "Processing"} pulse /><Progress value={batch.progress} className="mt-1.5 w-24" label={`${BATCH_STAGES[batch.stage]} progress`} /></div>;
    if (batch.status === "completed") return <StatusText tone="success" label="Completed" />;
    if (batch.status === "partial") return <StatusText tone="warning" label="Needs mapping" />;
    if (batch.status === "paused") return <StatusText tone="muted" label="Paused" />;
    return <StatusText tone="danger" label="Failed" />;
  };
  return <Page wide>
    <PageHeader title="Answer sheet uploads" actions={<ButtonLink to="/uploads/new" variant="primary" icon={<FileUp size={16} strokeWidth={ICON} />}>Upload PDF</ButtonLink>} />
    <Tabs items={[{ id: "batches", label: "Batches" }, { id: "unmatched", label: "Unmatched booklets", count: openCount }]} value="batches" onChange={(v) => v === "unmatched" && navigate("/unmatched")} />
    <Panel className="mt-4" flush>
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
        <Select aria-label="Filter by assessment" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="w-full sm:w-64"><option value="all">All assessments</option>{state.assessments.map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>)}</Select>
        <SearchInput label="Search uploads" value={query} onChange={setQuery} placeholder="Search file or assessment" className="w-full sm:max-w-xs" />
        <span className="ml-auto text-xs text-ink-3">{rows.length} {rows.length === 1 ? "batch" : "batches"}</span>
      </div>
      {loading ? <SkeletonRows rows={6} cols={7} /> : rows.length === 0 ? <EmptyState icon={<Search size={24} strokeWidth={ICON} />} title={state.batches.length ? "No uploads match these filters" : "No uploads yet"} action={!state.batches.length ? <ButtonLink to="/uploads/new" variant="primary">Upload PDF</ButtonLink> : undefined} /> : <Table>
        <thead><tr><Th sticky>File</Th><Th>Assessment</Th><Th>Uploaded</Th><Th align="right">Pages</Th><Th align="right">Booklets</Th><Th align="right">Mapped</Th><Th align="right">Unmatched</Th><Th>Status</Th></tr></thead>
        <tbody>{rows.map((b) => {
          const a = state.assessments.find((x) => x.id === b.assessmentId);
          const uploader = state.users.find((u) => u.id === b.uploadedBy)?.name ?? "Exam Cell";
          return <Tr key={b.id} onClick={() => navigate(`/uploads/${b.id}`)}>
            <Td sticky className="max-w-64"><span className="block truncate font-medium text-ink">{b.fileName}</span><span className="text-xs text-ink-3">{b.kind === "bulk" ? "Bulk" : "Individual"} · {b.sizeMb.toFixed(1)} MB</span></Td>
            <Td><span className="block">{a?.name ?? "Assessment"}</span><span className="text-xs text-ink-3">Class {a?.grade} · {a?.subject}</span></Td>
            <Td><span className="block">{relTime(b.uploadedAt)}</span><span className="text-xs text-ink-3">{uploader}</span></Td>
            <Td align="right">{b.pages.toLocaleString("en-IN")}</Td><Td align="right">{b.booklets.toLocaleString("en-IN")}</Td><Td align="right">{b.mapped.toLocaleString("en-IN")}</Td>
            <Td align="right"><span className={cx(b.unmatched > 0 ? "font-medium text-warning" : "text-ink-3")}>{b.unmatched > 0 ? `${b.unmatched} need mapping` : "0"}</span></Td><Td>{status(b)}</Td>
          </Tr>;
        })}</tbody>
      </Table>}
    </Panel>
  </Page>;
}
