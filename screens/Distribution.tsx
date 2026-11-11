import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { useStore } from "../data/store";
import { DIST_STATUS, fmtDateTime, fmtShortDate, releaseEligibility } from "../data/selectors";
import { useScreenInit } from "../useScreenInit";
import { Banner, BulkBar, Button, Checkbox, Dialog, EmptyState, Menu, Page, PageHeader, Panel, SearchInput, Select, StatStrip, StatusText, Switch, Tabs, Table, Td, Th, Tr, Tag, IconButton, ICON } from "../components/ui";

const maskPhone = (phone?: string | null) => {
  if (!phone) return "–";
  const digits = phone.replace(/\D/g, "");
  return `+91 ${digits.slice(2, 4)}•• ••${digits.slice(-3)}`;
};

export default function Distribution() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const init = useScreenInit();
  const firstAssessment = params.get("assessment") ?? state.assessments.find((a) => state.sheets.some((s) => s.assessmentId === a.id && s.evaluation === "evaluated"))?.id ?? state.assessments[0]?.id ?? "";
  const [tab, setTab] = useState<"send" | "report">((init.tab as "send" | "report") ?? "send");
  const [assessmentId, setAssessmentId] = useState(firstAssessment);
  const [includeUnverified, setIncludeUnverified] = useState(!!init.includeUnverified);
  const [selected, setSelected] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(!!init.previewOpen);
  const [runId, setRunId] = useState("");
  const [reportAssessment, setReportAssessment] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [reportSearch, setReportSearch] = useState("");
  const [reportSelected, setReportSelected] = useState<string[]>([]);
  const [revokeId, setRevokeId] = useState("");
  const selectedAssessment = state.assessments.find((a) => a.id === assessmentId);
  const policyProhibited = state.settings.unverifiedRelease === "prohibited";
  const eligibleRows = state.sheets.filter((s) => s.assessmentId === assessmentId).map((sheet) => {
    const student = state.students.find((x) => x.id === sheet.studentId);
    const eligibility = releaseEligibility(sheet, student, state.distributions);
    const blockedByPolicy = policyProhibited && eligibility.provisional;
    return { sheet, student, eligibility, blockedByPolicy, reason: blockedByPolicy ? "School policy allows verified copies only" : eligibility.reason };
  });
  const canSelect = (row: typeof eligibleRows[number]) => row.eligibility.ok && !row.blockedByPolicy && (!row.eligibility.provisional || includeUnverified);
  useEffect(() => {
    setSelected(eligibleRows.filter((row) => row.eligibility.ok && !row.eligibility.provisional).map((row) => row.sheet.id));
  }, [assessmentId]);
  const sendRows = eligibleRows;
  const selectedSheets = sendRows.filter((r) => selected.includes(r.sheet.id));
  const selectedProvisional = selectedSheets.filter((r) => r.eligibility.provisional).length;
  const skippedCount = sendRows.filter((r) => !r.eligibility.ok || r.blockedByPolicy).length;
  const sample = selectedSheets[0] ?? sendRows.find((r) => r.student);
  const previewToken = sample ? sample.sheet.id.replace(/[^a-z0-9]/gi, "").slice(-10).toLowerCase() : "result-link";
  const previewMessage = sample && selectedAssessment ? `Dear Parent,\nThe evaluated answer sheet for your child is available.\nStudent: ${sample.student?.name ?? "Student"}\nClass: ${sample.student?.grade ?? selectedAssessment.grade}${sample.student?.section ?? ""}\nSubject: ${selectedAssessment.subject}\nAssessment: ${selectedAssessment.name}\nView the copy: https://gps.results.in/r/${previewToken}\nVerification status is displayed on the result document.\nRegards, Examination Cell` : "Select an exam with evaluated copies to preview the message.";
  const reports = useMemo(() => {
    return state.distributions.filter((d) => {
      if (runId && reportAssessment === "all" && d.runId !== runId) return false;
      if (reportAssessment !== "all" && d.assessmentId !== reportAssessment) return false;
      if (reportStatus !== "all" && d.status !== reportStatus) return false;
      const student = state.students.find((s) => s.id === d.studentId);
      const a = state.assessments.find((x) => x.id === d.assessmentId);
      const term = reportSearch.trim().toLowerCase();
      return !term || `${student?.name} ${a?.name} ${d.phone ?? ""}`.toLowerCase().includes(term);
    });
  }, [state.distributions, state.students, state.assessments, runId, reportAssessment, reportStatus, reportSearch]);
  const failed = reports.filter((d) => d.status === "failed");
  const statuses = ["delivered", "sending", "failed", "skipped"] as const;
  const sendNow = () => {
    const result = actions.release(selectedSheets.map((row) => row.sheet.id));
    setRunId(result.runId);
    setReportAssessment("all"); setReportStatus("all"); setReportSearch(""); setTab("report"); setPreviewOpen(false); setSelected([]);
    actions.toast(`Sending ${result.queued} SMS${result.duplicates ? ` · ${result.duplicates} duplicates skipped` : ""}`);
  };
  const doRetry = (ids: string[]) => { actions.retryDelivery(ids); actions.toast(`Retrying ${ids.length} failed SMS`); setReportSelected([]); };
  return <Page wide>
    <PageHeader title="Result distribution" />
    <Panel flush>
      <div className="px-4 pt-2"><Tabs value={tab} onChange={(v) => setTab(v)} items={[{ id: "send", label: "Send results" }, { id: "report", label: "Delivery report", count: state.distributions.length }]} /></div>
      {tab === "send" ? <div className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div className="w-full lg:max-w-sm"><label className="mb-1.5 block text-[13px] font-medium text-ink">Exam</label><Select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>{state.assessments.map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>)}</Select></div>
          {policyProhibited ? <p className="text-[13px] text-ink-3">School policy allows verified copies only.</p> : <div className="flex items-center gap-2 text-[13px] text-ink-2"><Switch label="Include copies not verified by teacher" checked={includeUnverified} onChange={(checked) => { setIncludeUnverified(checked); if (!checked) setSelected((ids) => ids.filter((id) => !eligibleRows.find((row) => row.sheet.id === id)?.eligibility.provisional)); }} />Include copies not verified by teacher</div>}
        </div>
        {selectedProvisional > 0 && <Banner tone="warning" title="Provisional results selected">These copies will carry NOT VERIFIED BY TEACHER · PROVISIONAL AI EVALUATION on the result.</Banner>}
        <div className="overflow-hidden rounded-md border border-border"><Table><thead><tr><Th /><Th sticky>Student</Th><Th>Guardian</Th><Th>Phone</Th><Th>Verification</Th><Th>Status</Th></tr></thead><tbody>{sendRows.map(({ sheet, student, eligibility, blockedByPolicy, reason }) => {
          const selectable = canSelect({ sheet, student, eligibility, blockedByPolicy, reason });
          return <Tr key={sheet.id} selected={selected.includes(sheet.id)}><Td><Checkbox label={`Select ${student?.name ?? "student"}`} checked={selected.includes(sheet.id)} disabled={!selectable} onChange={(checked) => setSelected((ids) => checked ? [...ids, sheet.id] : ids.filter((id) => id !== sheet.id))} /></Td><Td sticky><span className="block font-medium text-ink">{student?.name ?? "Unknown student"}</span><span className="text-xs text-ink-3">Class {student?.grade}{student?.section} · Roll no {student?.roll}</span></Td><Td>{student ? `${student.guardian.name} · ${student.guardian.relation}` : "–"}</Td><Td className="font-mono text-xs">{student?.guardian.phone ? maskPhone(student.guardian.phone) : <span className="font-sans text-ink-4">–</span>}</Td><Td>{sheet.verification === "verified" ? <StatusText tone="success" label="Verified" /> : <Tag tone="warning">Not verified</Tag>}</Td><Td>{reason ? <span className="text-xs text-ink-3">{reason}</span> : <span className="text-xs text-success">Eligible</span>}</Td></Tr>;
        })}</tbody></Table></div>
        <div className="flex flex-col gap-3 rounded-md border border-border bg-subtle px-4 py-3 sm:flex-row sm:items-center"><p className="flex-1 text-[13px] text-ink-2"><span className="font-semibold text-ink">{selectedSheets.length} guardians</span> · {selectedProvisional} not verified · {skippedCount} skipped</p><Button variant="primary" disabled={!selected.length} onClick={() => setPreviewOpen(true)}>Review and send</Button></div>
      </div> : <div className="space-y-4 p-4">
        <StatStrip items={statuses.map((status) => ({ label: DIST_STATUS[status].label, value: reports.filter((d) => d.status === status).length, tone: status === "failed" && reports.some((d) => d.status === "failed") ? "danger" : undefined }))} />
        {failed.length > 0 && <Banner tone="warning" title={`${failed.length} SMS failed`} action={<Button size="sm" variant="secondary" onClick={() => doRetry(failed.map((d) => d.id))}>Retry {failed.length} failed</Button>}>Some guardians have not received the result link yet.</Banner>}
        <div className="flex flex-col gap-2 sm:flex-row"><Select aria-label="Filter by exam" value={reportAssessment} onChange={(e) => { setReportAssessment(e.target.value); setRunId(""); }} className="sm:w-56"><option value="all">All exams</option>{state.assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select><Select aria-label="Filter by status" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} className="sm:w-40"><option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{DIST_STATUS[s].label}</option>)}</Select><SearchInput label="Search delivery report" value={reportSearch} onChange={setReportSearch} placeholder="Search student or phone" className="sm:ml-auto sm:w-64" /></div>
        {reportSelected.filter((id) => reports.some((d) => d.id === id && d.status === "failed")).length > 0 && <BulkBar count={reportSelected.filter((id) => reports.some((d) => d.id === id && d.status === "failed")).length} onClear={() => setReportSelected([])}><Button size="sm" onClick={() => doRetry(reportSelected.filter((id) => reports.some((d) => d.id === id && d.status === "failed")))}>Retry failed</Button></BulkBar>}
        {reports.length ? <Table><thead><tr><Th><Checkbox label="Select failed deliveries" checked={failed.length > 0 && failed.every((d) => reportSelected.includes(d.id))} indeterminate={reportSelected.length > 0} onChange={(checked) => setReportSelected(checked ? failed.map((d) => d.id) : [])} /></Th><Th sticky>Student</Th><Th>Exam</Th><Th>Phone</Th><Th>Version</Th><Th>Verification at send</Th><Th>Sent</Th><Th>Status</Th><Th>Attempts</Th><Th>Opened</Th><Th>Link</Th><Th /></tr></thead><tbody>{reports.map((d) => {
          const student = state.students.find((s) => s.id === d.studentId);
          const assessment = state.assessments.find((a) => a.id === d.assessmentId);
          return <Tr key={d.id} selected={reportSelected.includes(d.id)}><Td><Checkbox label={`Select failed delivery for ${student?.name ?? "student"}`} checked={reportSelected.includes(d.id)} disabled={d.status !== "failed"} onChange={(checked) => setReportSelected((ids) => checked ? [...ids, d.id] : ids.filter((id) => id !== d.id))} /></Td><Td sticky><span className="font-medium text-ink">{student?.name ?? "Unknown student"}</span></Td><Td>{assessment?.name}</Td><Td className="font-mono text-xs">{maskPhone(d.phone)}</Td><Td>v{d.version}</Td><Td>{d.verified ? <StatusText tone="success" label="Verified" /> : <Tag tone="warning">Not verified</Tag>}</Td><Td>{fmtDateTime(d.sentAt)}</Td><Td><StatusText {...DIST_STATUS[d.status]} /></Td><Td>{d.attempts}</Td><Td>{d.openedAt ? fmtDateTime(d.openedAt) : <span className="text-ink-4">Not opened</span>}</Td><Td><span className="flex items-center gap-1">{fmtShortDate(d.expiresAt)}{d.revoked && <Tag tone="danger">Revoked</Tag>}</span></Td><Td><Menu trigger={(openMenu) => <IconButton label="Delivery actions" size="sm" onClick={openMenu}><MoreHorizontal size={16} strokeWidth={ICON} /></IconButton>} items={[
            { label: "Open guardian link", onSelect: () => navigate(`/r/${d.token}`) },
            { label: "Download PDF", onSelect: () => navigate(`/result/${d.sheetId}`) },
            { label: "Retry delivery", disabled: d.status !== "failed", onSelect: () => doRetry([d.id]) },
            { label: "Revoke link", danger: true, disabled: d.revoked, onSelect: () => setRevokeId(d.id) },
          ]} /></Td></Tr>;
        })}</tbody></Table> : <EmptyState title="No delivery records" body="SMS delivery records matching these filters will appear here." />}
      </div>}
    </Panel>
    <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Review SMS before sending" size="md" footer={<><Button variant="ghost" onClick={() => setPreviewOpen(false)}>Cancel</Button><Button variant="primary" disabled={!selected.length} onClick={sendNow}>Send to {selectedSheets.length} guardians</Button></>}>
      <div className="space-y-4"><div className="grid grid-cols-2 gap-3 rounded-md bg-subtle p-3 text-[13px]"><div><span className="block text-xs text-ink-3">Recipients</span><span className="font-semibold text-ink">{selectedSheets.length}</span></div><div><span className="block text-xs text-ink-3">Provisional</span><span className="font-semibold text-ink">{selectedProvisional}</span></div><div><span className="block text-xs text-ink-3">Link expiry</span><span className="font-medium text-ink">{state.settings.linkExpiryDays} days</span></div><div><span className="block text-xs text-ink-3">Sender ID</span><span className="font-medium text-ink">{state.settings.smsSender}</span></div></div><pre className="whitespace-pre-wrap rounded-md border border-border bg-subtle p-3 font-sans text-[13px] leading-relaxed text-ink-2">{previewMessage}</pre></div>
    </Dialog>
    <Dialog open={!!revokeId} onClose={() => setRevokeId("")} title="Revoke this link?" size="sm" footer={<><Button variant="ghost" onClick={() => setRevokeId("")}>Cancel</Button><Button variant="danger" onClick={() => { actions.revokeLink(revokeId); actions.toast("Guardian link revoked"); setRevokeId(""); }}>Revoke link</Button></>}>
      <p>The guardian can no longer open the result. You can send a new link later.</p>
    </Dialog>
  </Page>;
}
