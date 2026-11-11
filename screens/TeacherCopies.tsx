import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useStore } from "../data/store";
import { DIST_STATUS, VERIFY_STATUS, flaggedCount, fmtDateTime, relTime, sheetAiTotal, sheetTotal, distributionKey } from "../data/selectors";
import { Banner, Button, EmptyState, ICON, Page, PageHeader, Panel, SearchInput, Select, StatusText, Tabs, Table, Td, Th, Tr, ButtonLink, Tag } from "../components/ui";

export default function TeacherCopies({ view }: { view: "pending" | "verified" }) {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [assessmentId, setAssessmentId] = useState("all");
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const mine = state.sheets.filter((s) => me.role === "admin" || s.teacherId === me.id || (view === "verified" && s.verifiedBy === me.id));
  const base = view === "pending" ? mine.filter((s) => s.evaluation === "evaluated" && s.verification !== "verified") : mine.filter((s) => s.verification === "verified" && (me.role === "admin" || s.verifiedBy === me.id || s.teacherId === me.id));
  const processing = mine.filter((s) => s.evaluation === "queued" || s.evaluation === "processing").length;
  const counts = {
    all: base.length,
    flagged: base.filter((s) => flaggedCount(s) > 0).length,
    reopened: base.filter((s) => s.verification === "reopened").length,
    in_progress: base.filter((s) => s.verification === "in_progress").length,
    not_started: base.filter((s) => s.verification === "not_started").length,
  };
  const rows = useMemo(() => base.filter((sheet) => {
    const student = state.students.find((s) => s.id === sheet.studentId);
    const assessment = state.assessments.find((a) => a.id === sheet.assessmentId);
    if (assessmentId !== "all" && sheet.assessmentId !== assessmentId) return false;
    if (section !== "all" && student?.section !== section) return false;
    if (view === "pending" && tab === "flagged" && flaggedCount(sheet) === 0) return false;
    if (view === "pending" && ["reopened", "in_progress", "not_started"].includes(tab) && sheet.verification !== tab) return false;
    const term = search.trim().toLowerCase();
    return !term || `${student?.name} ${student?.roll} ${assessment?.name} ${student?.grade}${student?.section}`.toLowerCase().includes(term);
  }).sort((a, b) => {
    const sa = state.students.find((s) => s.id === a.studentId);
    const sb = state.students.find((s) => s.id === b.studentId);
    if (view === "pending") {
      const rank = (s: typeof a) => s.verification === "reopened" ? 0 : flaggedCount(s) ? 1 : s.verification === "in_progress" ? 2 : 3;
      return rank(a) - rank(b) || (sa?.roll ?? 0) - (sb?.roll ?? 0);
    }
    return (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? "");
  }), [base, state.students, state.assessments, assessmentId, section, search, tab, view]);
  const title = view === "pending" ? "Pending verification" : "Verified copies";
  return <Page wide>
    <PageHeader title={title} actions={view === "pending" && rows[0] ? <ButtonLink to={`/review/${rows[0].id}`} variant="primary" iconRight={<ArrowRight size={15} strokeWidth={ICON} />}>Review next copy</ButtonLink> : undefined} />
    {view === "pending" ? <>
      {processing > 0 && <Banner className="mb-4">{processing} {processing === 1 ? "copy is" : "copies are"} still being evaluated. They'll appear here when marks are ready.</Banner>}
      <Panel flush>
        <div className="px-4 pt-2"><Tabs value={tab} onChange={setTab} items={[{ id: "all", label: "All", count: counts.all }, { id: "flagged", label: "Flagged", count: counts.flagged }, { id: "reopened", label: "Reopened", count: counts.reopened }, { id: "in_progress", label: "In progress", count: counts.in_progress }, { id: "not_started", label: "Not started", count: counts.not_started }]} /></div>
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row"><Select aria-label="Assessment" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="sm:w-64"><option value="all">All assessments</option>{state.assessments.filter((a) => mine.some((s) => s.assessmentId === a.id)).map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>)}</Select><Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="sm:w-40"><option value="all">All sections</option>{[...new Set(state.students.map((s) => s.section))].sort().map((s) => <option key={s}>{s}</option>)}</Select><SearchInput label="Search copies" value={search} onChange={setSearch} placeholder="Search student or assessment" className="sm:ml-auto sm:w-64" /></div>
        {rows.length ? <Table><thead><tr><Th sticky>Student</Th><Th>Assessment</Th><Th>AI marks</Th><Th>Current marks</Th><Th>Flags</Th><Th>Status</Th><Th>Last saved</Th><Th /></tr></thead><tbody>{rows.map((sheet) => {
          const student = state.students.find((s) => s.id === sheet.studentId)!;
          const assessment = state.assessments.find((a) => a.id === sheet.assessmentId)!;
          const flags = flaggedCount(sheet);
          return <Tr key={sheet.id} onClick={() => navigate(`/review/${sheet.id}`)}><Td sticky><span className="block font-medium text-ink">{student.name}</span><span className="text-xs text-ink-3">Class {student.grade}{student.section} · Roll no {student.roll}</span></Td><Td>{assessment.name}</Td><Td>{sheetAiTotal(sheet)}/{assessment.totalMarks}</Td><Td>{sheetTotal(sheet) !== sheetAiTotal(sheet) ? <span className="font-medium text-ink">{sheetTotal(sheet)}/{assessment.totalMarks}</span> : <span className="text-ink-4">–</span>}</Td><Td>{flags ? <Tag tone="warning">{flags}</Tag> : <span className="text-ink-4">–</span>}</Td><Td><StatusText {...VERIFY_STATUS[sheet.verification]} /></Td><Td>{sheet.draftSavedAt ? relTime(sheet.draftSavedAt) : <span className="text-ink-4">–</span>}</Td><Td><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/review/${sheet.id}`); }}>Review</Button></Td></Tr>;
        })}</tbody></Table> : <EmptyState title="All caught up" body="There are no copies matching these filters." />}
      </Panel>
    </> : <Panel flush>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row"><Select aria-label="Assessment" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="sm:w-64"><option value="all">All assessments</option>{state.assessments.filter((a) => base.some((s) => s.assessmentId === a.id)).map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>)}</Select><Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="sm:w-40"><option value="all">All sections</option>{[...new Set(state.students.map((s) => s.section))].sort().map((s) => <option key={s}>{s}</option>)}</Select><SearchInput label="Search copies" value={search} onChange={setSearch} placeholder="Search student or assessment" className="sm:ml-auto sm:w-64" /></div>
      {rows.length ? <Table><thead><tr><Th sticky>Student</Th><Th>Assessment</Th><Th>Verified</Th><Th>Version</Th><Th>Final marks</Th><Th>Edited questions</Th><Th>Released</Th><Th /></tr></thead><tbody>{rows.map((sheet) => {
        const student = state.students.find((s) => s.id === sheet.studentId)!;
        const assessment = state.assessments.find((a) => a.id === sheet.assessmentId)!;
        const edited = sheet.questions.filter((q) => q.edited).length;
        const status = DIST_STATUS[distributionKey(sheet.id, state.distributions)];
        return <Tr key={sheet.id} onClick={() => navigate(`/review/${sheet.id}`)}><Td sticky><span className="block font-medium text-ink">{student.name}</span><span className="text-xs text-ink-3">Class {student.grade}{student.section} · Roll no {student.roll}</span></Td><Td>{assessment.name}</Td><Td>{fmtDateTime(sheet.verifiedAt)}</Td><Td>v{sheet.verifiedVersion ?? sheet.version}</Td><Td>{sheetTotal(sheet)}/{assessment.totalMarks}</Td><Td>{edited}</Td><Td><StatusText {...status} /></Td><Td><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/review/${sheet.id}`); }}>View</Button></Td></Tr>;
      })}</tbody></Table> : <EmptyState title="No verified copies yet" body="Copies you verify will appear here." />}
    </Panel>}
  </Page>;
}
