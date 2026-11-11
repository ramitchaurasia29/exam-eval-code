import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, MoreHorizontal, Plus } from "lucide-react";
import { useStore } from "../data/store";
import { ASSESSMENT_STATUS, assessmentStatus, cohortOf, fmtDate, num } from "../data/selectors";
import { Avatar, ButtonLink, EmptyState, IconButton, Menu, Page, PageHeader, Panel, SearchInput, Select, SkeletonRows, StatusText, Table, TableFooter, Td, Th, Tr, useFakeLoading } from "../components/ui";
import type { AssessmentStatus } from "../data/types";

const SETUP: AssessmentStatus[] = ["draft", "answer_key_pending", "rubric_pending"];
const EVALUATING: AssessmentStatus[] = ["evaluating", "reviewing"];
type Filter = "all" | "setup" | "ready" | "evaluating" | "completed" | "archived";
const FILTERS: { id: Filter; label: string; matches: (s: AssessmentStatus) => boolean }[] = [
  { id: "all", label: "All", matches: () => true },
  { id: "setup", label: "Setup", matches: (s) => SETUP.includes(s) },
  { id: "ready", label: "Ready", matches: (s) => s === "ready" },
  { id: "evaluating", label: "In evaluation", matches: (s) => EVALUATING.includes(s) },
  { id: "completed", label: "Completed", matches: (s) => s === "completed" },
  { id: "archived", label: "Archived", matches: (s) => s === "archived" },
];

export default function AssessmentsList() {
  const { state, actions, me, role } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const teacherView = location.pathname.startsWith("/teacher/");
  const [tab, setTab] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const loading = useFakeLoading();
  const assessments = state.assessments.filter((a) => !teacherView || a.teacherIds.includes(me.id) || a.ownerId === me.id);
  const statusById = new Map(assessments.map((a) => [a.id, assessmentStatus(a, state.sheets)]));
  const counts = FILTERS.map((f) => assessments.filter((a) => f.matches(statusById.get(a.id)!)).length);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/\s+/g, " ");
    return assessments.filter((a) => {
      const status = statusById.get(a.id)!;
      const owner = state.users.find((u) => u.id === a.ownerId)?.name ?? "";
      return FILTERS.find((f) => f.id === tab)!.matches(status) &&
        (!term || `${a.name} class ${a.grade} ${a.sections.join(" ")} ${a.subject} ${a.type} ${owner}`.toLowerCase().replace(/\s+/g, " ").includes(term)) &&
        (!grade || a.grade === grade) && (!subject || a.subject === subject);
    }).sort((a, b) => b.examDate.localeCompare(a.examDate));
  }, [assessments, statusById, state.users, tab, search, grade, subject]);
  const filterCount = Number(!!search.trim()) + Number(!!grade) + Number(!!subject);
  const clearFilters = () => { setSearch(""); setGrade(""); setSubject(""); };
  const createTo = "/assessments/new";

  return (
    <Page>
      <PageHeader title={teacherView ? "My exams" : "Exam Evaluator"} meta={`${num(assessments.length)} ${assessments.length === 1 ? "exam" : "exams"}`} actions={<ButtonLink to={createTo} variant="primary" icon={<Plus size={16} />}>Create Exam</ButtonLink>} />
      <Panel flush>
        <div className="px-4 pt-2"><div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Exam status">
          {FILTERS.map((f, i) => <button key={f.id} role="tab" aria-selected={tab === f.id} onClick={() => setTab(f.id)} className={`-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm whitespace-nowrap ${tab === f.id ? "border-primary font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}>{f.label}<span className={`rounded-sm px-1.5 text-xs tabular-nums ${tab === f.id ? "bg-primary-soft text-primary-ink" : "bg-muted text-ink-3"}`}>{num(counts[i])}</span></button>)}
        </div></div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <SearchInput label="Search exams" value={search} onChange={setSearch} placeholder="Search exams" className="w-full sm:w-64" />
          <Select aria-label="Class" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-[140px]"><option value="">All classes</option>{Array.from(new Set(assessments.map((a) => a.grade))).sort((a,b)=>Number(a)-Number(b)).map((g) => <option key={g} value={g}>Class {g}</option>)}</Select>
          <Select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-[180px]"><option value="">All subjects</option>{Array.from(new Set(assessments.map((a) => a.subject))).sort().map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          {filterCount > 0 && <><span className="text-xs text-ink-3">{filterCount} {filterCount === 1 ? "filter" : "filters"} applied</span><button onClick={clearFilters} className="text-[13px] font-medium text-primary-ink hover:underline">Clear filters</button></>}
        </div>
        {loading ? <SkeletonRows rows={7} cols={8} /> : assessments.length === 0 ? (
          <EmptyState icon={<ClipboardList size={28} />} title="No exams yet" body="Create an exam to prepare question papers, answer keys and rubrics." action={<ButtonLink to={createTo} variant="primary">Create Exam</ButtonLink>} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No exams match these filters" body="Try another search or clear the applied filters." action={<button onClick={clearFilters} className="text-sm font-medium text-primary-ink hover:underline">Clear filters</button>} />
        ) : (
          <>
            <Table>
              <thead><tr><Th sticky>Exam</Th><Th>Subject</Th><Th>Type</Th><Th>Exam date</Th><Th>Status</Th><Th align="right">Copies</Th><Th align="right">Verified</Th><Th>Owner</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>{filtered.map((a) => {
                const status = statusById.get(a.id)!;
                const cohort = cohortOf(a, state.students).length;
                const copies = state.sheets.filter((s) => s.assessmentId === a.id);
                const verified = copies.filter((s) => s.verification === "verified").length;
                const owner = state.users.find((u) => u.id === a.ownerId);
                const canUpload = role === "admin" && a.answerKey.status === "approved" && a.rubric.status === "approved";
                const archive = () => { actions.archiveAssessment(a.id, !a.archived); actions.toast(a.archived ? "Exam restored" : "Exam archived", { undo: () => actions.archiveAssessment(a.id, !!a.archived) }); };
                return <Tr key={a.id} onClick={() => navigate(`/assessments/${a.id}`)}>
                  <Td sticky className="max-w-72"><Link to={`/assessments/${a.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-primary-ink">{a.name}</Link><span className="block text-xs text-ink-3">Class {a.grade} {a.sections.join(", ")}</span></Td>
                  <Td>{a.subject}</Td><Td>{a.type}</Td><Td>{fmtDate(a.examDate)}</Td><Td><StatusText {...ASSESSMENT_STATUS[status]} /></Td><Td align="right">{num(copies.length)}/{num(cohort)}</Td><Td align="right">{num(verified)}</Td><Td>{owner ? <span className="flex items-center gap-2"><Avatar name={owner.name} initials={owner.initials} size="sm" /><span>{owner.name}</span></span> : <span className="text-ink-4">—</span>}</Td>
                  <Td><Menu trigger={(open) => <IconButton label="Exam actions" size="sm" onClick={open}><MoreHorizontal size={17} /></IconButton>} items={[{ label: "Open", onSelect: () => navigate(`/assessments/${a.id}`) }, ...(canUpload ? [{ label: "Upload answer sheets", onSelect: () => navigate(`/assessments/${a.id}/students`) }] : []), { label: a.archived ? "Restore" : "Archive", onSelect: archive, danger: !a.archived }]} /></Td>
                </Tr>;
              })}</tbody>
            </Table>
            <TableFooter shown={filtered.length} total={counts[FILTERS.findIndex((f) => f.id === tab)]} />
          </>
        )}
      </Panel>
    </Page>
  );
}
