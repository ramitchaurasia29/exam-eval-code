import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileUp, RefreshCw, Send } from "lucide-react";
import { useStore } from "../data/store";
import { DIST_STATUS, EVAL_STATUS, VERIFY_STATUS, distributionKey, latestDistribution, num, sheetTotal } from "../data/selectors";
import { Lifecycle, lifecycleOf } from "../components/booklet";
import AssessmentHeader, { useAssessmentParam } from "../components/AssessmentHeader";
import { Banner, BulkBar, Button, ButtonLink, Checkbox, EmptyState, Page, Panel, SearchInput, Select, SkeletonRows, StatusText, Table, TableFooter, Td, Th, Tr, useFakeLoading } from "../components/ui";
import type { AnswerSheet } from "../data/types";

type SheetTab = "all" | "evaluating" | "pending" | "verified" | "released" | "exceptions";
const TAB_LABELS: { id: SheetTab; label: string }[] = [{ id: "all", label: "All" }, { id: "evaluating", label: "Evaluating" }, { id: "pending", label: "Pending verification" }, { id: "verified", label: "Verified" }, { id: "released", label: "Released" }, { id: "exceptions", label: "Exceptions" }];

export default function AnswerSheetList() {
  const { id } = useParams();
  const assessment = useAssessmentParam(id);
  const { state, actions, me, role } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SheetTab>("all");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [teacherId, setTeacherId] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const loading = useFakeLoading();
  if (!assessment) return <EmptyState className="py-24" title="Assessment not found" body="It may have been removed or the link may be out of date." action={<ButtonLink to={role === "admin" ? "/assessments" : "/teacher/assessments"}>Back to assessments</ButtonLink>} />;

  const own = state.sheets.filter((s) => s.assessmentId === assessment.id && (role === "admin" || s.teacherId === me.id));
  const openUnmatched = state.unmatched.filter((u) => u.assessmentId === assessment.id && u.status === "open");
  const isException = (s: AnswerSheet) => s.evaluation === "failed" || s.evaluation === "needs_review" || latestDistribution(s.id, state.distributions)?.status === "failed";
  const matches = (s: AnswerSheet, key: SheetTab) => key === "all" ||
    (key === "evaluating" && (s.evaluation === "queued" || s.evaluation === "processing")) ||
    (key === "pending" && s.evaluation === "evaluated" && s.verification !== "verified") ||
    (key === "verified" && s.verification === "verified") ||
    (key === "released" && latestDistribution(s.id, state.distributions)?.status === "delivered") ||
    (key === "exceptions" && isException(s));
  const tabCounts = TAB_LABELS.map((t) => own.filter((s) => matches(s, t.id)).length);
  const term = search.trim().toLowerCase().replace(/\s+/g, " ");
  const barcodeTerm = term.replace(/\s/g, "");
  const filtered = own.filter((s) => {
    const student = state.students.find((x) => x.id === s.studentId);
    const searchable = `${student?.name ?? ""} roll ${student?.roll ?? ""} ${student?.barcode ?? ""}`.toLowerCase().replace(/\s+/g, " ");
    return matches(s, tab) && (!term || searchable.includes(term) || (student?.barcode ?? "").toLowerCase().replace(/\s/g, "").includes(barcodeTerm)) &&
      (!section || student?.section === section) && (teacherId === "all" || (teacherId === "unassigned" ? !s.teacherId : s.teacherId === teacherId));
  }).sort((a, b) => {
    const sa = state.students.find((x) => x.id === a.studentId)!;
    const sb = state.students.find((x) => x.id === b.studentId)!;
    return sa.section.localeCompare(sb.section) || sa.roll - sb.roll;
  });
  const activeFilterCount = Number(!!search.trim()) + Number(!!section) + Number(teacherId !== "all");
  const clearFilters = () => { setSearch(""); setSection(""); setTeacherId("all"); };
  const selectedRows = own.filter((s) => selected.includes(s.id));
  const retryIds = selectedRows.filter((s) => s.evaluation === "failed" || s.evaluation === "needs_review").map((s) => s.id);
  const visibleSelected = filtered.length > 0 && filtered.every((s) => selected.includes(s.id));
  const setAll = (checked: boolean) => setSelected(checked ? Array.from(new Set([...selected, ...filtered.map((s) => s.id)])) : selected.filter((id) => !filtered.some((s) => s.id === id)));
  const toggle = (sheetId: string, checked: boolean) => setSelected((current) => checked ? [...new Set([...current, sheetId])] : current.filter((x) => x !== sheetId));
  const exportCsv = () => {
    const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [["Student", "Roll", "Barcode", "Lifecycle", "Evaluation", "Teacher review", "Distribution", "Marks", "Teacher"], ...filtered.map((s) => {
      const student = state.students.find((x) => x.id === s.studentId)!;
      const teacher = state.users.find((u) => u.id === s.teacherId);
      const lifecycle = lifecycleOf(s, state.distributions).summary.label;
      return [student.name, student.roll, student.barcode, lifecycle, EVAL_STATUS[s.evaluation].label, VERIFY_STATUS[s.verification].label, DIST_STATUS[distributionKey(s.id, state.distributions)].label, s.evaluation === "evaluated" ? `${sheetTotal(s)}/${assessment.totalMarks}` : "–", teacher?.name ?? "Unassigned"];
    })];
    const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${assessment.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-answer-sheets.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <Page wide>
    <AssessmentHeader assessment={assessment} tab="sheets" actions={role === "admin" && assessment.answerKey.status === "approved" && assessment.rubric.status === "approved" ? <ButtonLink to={`/uploads/new?assessment=${assessment.id}`} variant="primary" icon={<FileUp size={15} />}>Upload answer sheets</ButtonLink> : undefined} />
    {openUnmatched.length > 0 && <Banner tone="warning" title={`${num(openUnmatched.length)} unmatched ${openUnmatched.length === 1 ? "booklet" : "booklets"} are waiting for mapping`} action={<ButtonLink to="/unmatched" size="sm" variant="secondary">Map booklets</ButtonLink>} className="mb-4">Unmatched booklets are not included in evaluation until they are identified.</Banner>}
    <Panel flush>
      <div className="px-4 pt-2"><div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Answer sheet status">{TAB_LABELS.map((t, i) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm whitespace-nowrap ${tab === t.id ? "border-primary font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}>{t.label}<span className={`rounded-sm px-1.5 text-xs tabular-nums ${tab === t.id ? "bg-primary-soft text-primary-ink" : "bg-muted text-ink-3"}`}>{num(tabCounts[i])}</span></button>)}</div></div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <SearchInput label="Search answer sheets" value={search} onChange={setSearch} placeholder="Student, roll or barcode" className="w-full sm:w-64" />
        <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-[150px]"><option value="">All sections</option>{assessment.sections.map((s) => <option key={s} value={s}>Section {s}</option>)}</Select>
        <Select aria-label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-[190px]"><option value="all">All teachers</option><option value="unassigned">Unassigned</option>{state.users.filter((u) => u.role === "teacher").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        {activeFilterCount > 0 && <><span className="text-xs text-ink-3">{activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"} applied</span><button onClick={clearFilters} className="text-[13px] font-medium text-primary-ink hover:underline">Clear filters</button></>}
      </div>
      {selected.length > 0 ? <BulkBar count={selected.length} onClear={() => setSelected([])}>
        <Select aria-label="Assign selected copies to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-[190px]"><option value="">Assign to teacher</option>{state.users.filter((u) => u.role === "teacher").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        <Button size="sm" disabled={!assignTo} onClick={() => { actions.assign(selected, assignTo || null); actions.toast("Copies assigned"); setSelected([]); setAssignTo(""); }}>Assign</Button>
        {role === "admin" && retryIds.length > 0 && <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => { actions.retryJobs(retryIds); actions.toast(`${num(retryIds.length)} evaluation ${retryIds.length === 1 ? "job queued" : "jobs queued"}`); setSelected([]); }}>Retry evaluation</Button>}
        <Button size="sm" icon={<Send size={14} />} onClick={() => navigate(`/distribution?assessment=${assessment.id}`)}>Send results</Button>
      </BulkBar> : <div className="flex justify-end border-b border-border px-4 py-2"><Button size="sm" onClick={exportCsv}>Export CSV</Button></div>}
      {loading ? <SkeletonRows rows={8} cols={9} /> : own.length === 0 ? <EmptyState title="No answer sheets yet" body="Upload a PDF to identify copies and start evaluation." action={role === "admin" && assessment.answerKey.status === "approved" && assessment.rubric.status === "approved" ? <ButtonLink to={`/uploads/new?assessment=${assessment.id}`} variant="primary">Upload answer sheets</ButtonLink> : undefined} /> : filtered.length === 0 ? <EmptyState title="No answer sheets match these filters" body="Try another search or clear the applied filters." action={<button onClick={clearFilters} className="text-sm font-medium text-primary-ink hover:underline">Clear filters</button>} /> : <>
        <Table>
          <thead><tr><Th><Checkbox checked={visibleSelected} indeterminate={selected.some((x) => filtered.some((s) => s.id === x)) && !visibleSelected} onChange={setAll} label="Select all visible answer sheets" /></Th><Th sticky>Student</Th><Th>Barcode</Th><Th>Lifecycle</Th><Th>Evaluation</Th><Th>Teacher review</Th><Th>Distribution</Th><Th align="right">Marks</Th><Th>Teacher</Th></tr></thead>
          <tbody>{filtered.map((sheet) => {
            const student = state.students.find((s) => s.id === sheet.studentId)!;
            const teacher = state.users.find((u) => u.id === sheet.teacherId);
            const lifecycle = lifecycleOf(sheet, state.distributions);
            const distKey = distributionKey(sheet.id, state.distributions);
            return <Tr key={sheet.id} selected={selected.includes(sheet.id)} onClick={() => navigate(`/review/${sheet.id}`)}>
              <Td><Checkbox checked={selected.includes(sheet.id)} onChange={(checked) => toggle(sheet.id, checked)} label={`Select ${student.name}'s answer sheet`} /></Td>
              <Td sticky className="max-w-56"><span className="block truncate font-medium text-ink">{student.name}</span><span className="block text-xs text-ink-3">Roll {student.roll} · Class {student.grade}{student.section}</span></Td>
              <Td mono>{student.barcode}</Td>
              <Td><div className="flex min-w-40 flex-col gap-1"><Lifecycle sheet={sheet} dists={state.distributions} /><StatusText {...lifecycle.summary} /></div></Td>
              <Td><StatusText {...EVAL_STATUS[sheet.evaluation]} /></Td><Td><StatusText {...VERIFY_STATUS[sheet.verification]} /></Td><Td><StatusText {...DIST_STATUS[distKey]} /></Td>
              <Td align="right">{sheet.evaluation === "evaluated" ? `${num(sheetTotal(sheet))}/${num(assessment.totalMarks)}` : "–"}</Td><Td>{teacher?.name ?? <span className="text-ink-3">Unassigned</span>}</Td>
            </Tr>;
          })}</tbody>
        </Table>
        <TableFooter shown={filtered.length} total={own.length} />
      </>}
    </Panel>
  </Page>;
}
