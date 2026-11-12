import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../data/store";
import { VERIFY_STATUS, flaggedCount, fmtDateTime, sheetAiTotal, sheetTotal } from "../data/selectors";
import { Lifecycle } from "../components/booklet";
import { Banner, BulkBar, Button, Checkbox, Dialog, EmptyState, Input, Page, PageHeader, Panel, SearchInput, Select, StatStrip, StatusText, Tabs, Table, Td, Th, Tr, Tag } from "../components/ui";

export default function Verification() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState("pending");
  const [assessment, setAssessment] = useState("all");
  const [teacher, setTeacher] = useState("all");
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [assignTeacher, setAssignTeacher] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const evaluated = state.sheets.filter((s) => s.evaluation === "evaluated");
  const editedCopies = evaluated.filter((s) => s.questions.some((q) => q.edited));
  const edits = evaluated.reduce((n, s) => n + s.questions.filter((q) => q.edited).length, 0);
  const averageChange = evaluated.length ? evaluated.reduce((n, s) => n + sheetTotal(s) - sheetAiTotal(s), 0) / evaluated.length : 0;
  const counts = {
    pending: evaluated.filter((s) => s.verification === "not_started").length,
    in_progress: evaluated.filter((s) => s.verification === "in_progress").length,
    reopened: evaluated.filter((s) => s.verification === "reopened").length,
    verified: evaluated.filter((s) => s.verification === "verified").length,
  };
  const rows = useMemo(() => state.sheets.filter((sheet) => {
    if (assessment !== "all" && sheet.assessmentId !== assessment) return false;
    if (teacher === "unassigned" ? !!sheet.teacherId : teacher !== "all" && sheet.teacherId !== teacher) return false;
    const student = state.students.find((s) => s.id === sheet.studentId);
    const a = state.assessments.find((x) => x.id === sheet.assessmentId);
    if (section !== "all" && student?.section !== section) return false;
    if (tab === "pending" && !(sheet.evaluation === "evaluated" && sheet.verification === "not_started")) return false;
    if (tab === "in_progress" && !(sheet.evaluation === "evaluated" && sheet.verification === "in_progress")) return false;
    if (tab === "reopened" && !(sheet.evaluation === "evaluated" && sheet.verification === "reopened")) return false;
    if (tab === "verified" && sheet.verification !== "verified") return false;
    const term = search.trim().toLowerCase();
    return !term || `${student?.name} ${student?.roll} ${a?.name} ${student?.grade}${student?.section}`.toLowerCase().includes(term);
  }).sort((a, b) => (a.verification === "reopened" ? -1 : 0) - (b.verification === "reopened" ? -1 : 0)), [state.sheets, state.students, state.assessments, assessment, teacher, section, tab, search]);
  const visibleSelected = rows.filter((s) => selected.includes(s.id));
  const verifiedSelected = visibleSelected.filter((s) => s.verification === "verified");
  const allChecked = rows.length > 0 && rows.every((s) => selected.includes(s.id));
  const reopen = () => {
    if (!reason.trim()) { setError("Add a reason so the change is traceable."); return; }
    verifiedSelected.forEach((s) => actions.reopen(s.id, reason.trim()));
    actions.toast(`${verifiedSelected.length} ${verifiedSelected.length === 1 ? "copy" : "copies"} reopened`);
    setSelected((ids) => ids.filter((id) => !verifiedSelected.some((s) => s.id === id)));
    setReason(""); setError(""); setReopenOpen(false);
  };
  const authority = state.settings.verificationAuthority === "teacher_admin" ? "Verification by teacher or Exam Cell" : "Verification by assigned teacher only";
  const reminderGroups = new Map<string, { aid: string; teacherId: string; count: number }>();
  visibleSelected.filter((s) => s.teacherId && s.verification !== "verified").forEach((s) => { const k = `${s.teacherId}-${s.assessmentId}`; const old = reminderGroups.get(k); reminderGroups.set(k, { teacherId: s.teacherId!, aid: s.assessmentId, count: (old?.count ?? 0) + 1 }); });
  return <Page wide>
    <PageHeader title="Evaluation & verification" meta={<>{authority} · <Link to="/settings" className="text-primary hover:underline">Settings</Link></>} />
    <StatStrip className="mb-5" items={[
      { label: "Copies AI evaluated", value: evaluated.length },
      { label: "Copies with teacher edits", value: editedCopies.length },
      { label: "Questions edited", value: edits },
      { label: "Average mark change", value: `${averageChange >= 0 ? "+" : ""}${averageChange.toFixed(1)}`, sub: "Final − AI" },
    ]} />
    <Panel flush>
      <div className="px-4 pt-2"><Tabs value={tab} onChange={setTab} items={[{ id: "pending", label: "Pending verification", count: counts.pending }, { id: "in_progress", label: "In progress", count: counts.in_progress }, { id: "reopened", label: "Reopened", count: counts.reopened }, { id: "verified", label: "Verified", count: counts.verified }, { id: "all", label: "All", count: state.sheets.length }]} /></div>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:flex-wrap"><Select aria-label="Exam" value={assessment} onChange={(e) => setAssessment(e.target.value)} className="sm:w-56"><option value="all">All exams</option>{state.assessments.map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>)}</Select><Select aria-label="Teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)} className="sm:w-56"><option value="all">All teachers</option><option value="unassigned">Unassigned</option>{state.users.filter((u) => u.role === "teacher").map((u) => <option key={u.id} value={u.id}>{u.name}{u.grades?.length ? ` (Class ${u.grades.join(",")})` : ""}{u.subjects.length ? ` · ${u.subjects.join(", ")}` : ""}</option>)}</Select><Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="sm:w-36"><option value="all">All sections</option>{[...new Set(state.students.map((s) => s.section))].sort().map((x) => <option key={x}>{x}</option>)}</Select><SearchInput label="Search copies" value={search} onChange={setSearch} placeholder="Search student or exam" className="sm:ml-auto sm:w-60" /></div>
      {visibleSelected.length > 0 && <BulkBar count={visibleSelected.length} onClear={() => setSelected([])}>
        <Select aria-label="Assign selected copies" value={assignTeacher} onChange={(e) => setAssignTeacher(e.target.value)} className="w-56"><option value="">Choose teacher</option>{state.users.filter((u) => u.role === "teacher").map((u) => <option key={u.id} value={u.id}>{u.name}{u.grades?.length ? ` (Class ${u.grades.join(",")})` : ""}{u.subjects.length ? ` · ${u.subjects.join(", ")}` : ""}</option>)}</Select><Button size="sm" disabled={!assignTeacher} onClick={() => { actions.assign(visibleSelected.map((s) => s.id), assignTeacher); actions.toast(`${visibleSelected.length} copies reassigned`); setSelected([]); }}>Reassign</Button>
        <Button size="sm" variant="ghost" disabled={!reminderGroups.size} onClick={() => { reminderGroups.forEach((g) => actions.remind(g.teacherId, g.aid, g.count)); actions.toast(`Reminder sent to ${reminderGroups.size} ${reminderGroups.size === 1 ? "teacher" : "teachers"}`); }}>Send reminder</Button>
        <Button size="sm" variant="danger-ghost" disabled={!verifiedSelected.length} onClick={() => { setError(""); setReopenOpen(true); }}>Reopen verified</Button>
      </BulkBar>}
      {rows.length ? <Table><thead><tr><Th><Checkbox label="Select all visible copies" checked={allChecked} indeterminate={visibleSelected.length > 0 && !allChecked} onChange={(checked) => setSelected((ids) => checked ? [...new Set([...ids, ...rows.map((s) => s.id)])] : ids.filter((id) => !rows.some((s) => s.id === id)))} /></Th><Th sticky>Student</Th><Th>Exam</Th><Th>Teacher</Th><Th>AI marks</Th><Th>Final marks</Th><Th>Flags</Th><Th>Edited questions</Th><Th>Status</Th><Th>Verified</Th><Th>Version</Th><Th>Lifecycle</Th></tr></thead><tbody>{rows.map((sheet) => {
        const student = state.students.find((s) => s.id === sheet.studentId)!;
        const a = state.assessments.find((x) => x.id === sheet.assessmentId)!;
        const verifier = state.users.find((u) => u.id === sheet.verifiedBy);
        const edited = sheet.questions.filter((q) => q.edited).length;
        return <Tr key={sheet.id} onClick={() => navigate(`/review/${sheet.id}`)} selected={selected.includes(sheet.id)}><Td><Checkbox label={`Select ${student.name}`} checked={selected.includes(sheet.id)} onChange={(checked) => setSelected((ids) => checked ? [...ids, sheet.id] : ids.filter((id) => id !== sheet.id))} /></Td><Td sticky><span className="block font-medium text-ink">{student.name}</span><span className="text-xs text-ink-3">Class {student.grade}{student.section} · Roll no {student.roll}</span></Td><Td>{a.name}</Td><Td>{sheet.teacherId ? state.users.find((u) => u.id === sheet.teacherId)?.name : <span className="text-ink-4">Unassigned</span>}</Td><Td>{sheetAiTotal(sheet)}/{a.totalMarks}</Td><Td>{sheetTotal(sheet)}/{a.totalMarks}</Td><Td>{flaggedCount(sheet) ? <Tag tone="warning">{flaggedCount(sheet)}</Tag> : <span className="text-ink-4">–</span>}</Td><Td>{edited}</Td><Td><StatusText {...VERIFY_STATUS[sheet.verification]} /></Td><Td>{sheet.verifiedAt ? <span>{verifier?.name ?? "Teacher"}<span className="block text-xs text-ink-3">{fmtDateTime(sheet.verifiedAt)}</span></span> : <span className="text-ink-4">–</span>}</Td><Td>v{sheet.version}</Td><Td><Lifecycle sheet={sheet} dists={state.distributions} /></Td></Tr>;
      })}</tbody></Table> : <EmptyState title="No copies match these filters" body="Try changing the exam, teacher, section or search." />}
    </Panel>
    <Dialog open={reopenOpen} onClose={() => setReopenOpen(false)} title="Reopen verified copies" size="sm" footer={<><Button variant="ghost" onClick={() => setReopenOpen(false)}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} onClick={reopen}>Reopen {verifiedSelected.length} copies</Button></>}>
      <div className="space-y-3"><p>Reopening creates a new version and requires verification again.</p><Input aria-label="Reason for reopening" value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="Reason for reopening" />{error && <Banner tone="danger">{error}</Banner>}</div>
    </Dialog>
  </Page>;
}
