import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Barcode, Lifecycle } from "../components/booklet";
import { useStore } from "../data/store";
import { sheetTotal } from "../data/selectors";
import { Button, Drawer, EmptyState, ICON, Page, PageHeader, Panel, SearchInput, Select, StatusText, Switch, Table, Td, Th, Tr, Tag, cx } from "../components/ui";

const PAGE_SIZE = 50;
export default function Students() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [missingPhone, setMissingPhone] = useState(false);
  const [page, setPage] = useState(0);
  const [studentId, setStudentId] = useState("");
  const selected = state.students.find((s) => s.id === studentId);
  const grades = Array.from(new Set(state.students.map((s) => s.grade))).sort((a, b) => Number(a) - Number(b));
  const sections = Array.from(new Set(state.students.filter((s) => grade === "all" || s.grade === grade).map((s) => s.section))).sort();
  const filtered = useMemo(() => {
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const term = norm(query.trim());
    return state.students.filter((s) => (grade === "all" || s.grade === grade) && (section === "all" || s.section === section) && (!missingPhone || !s.guardian.phone) && (!term || [s.name, String(s.roll), s.admissionNo, s.barcode].some((v) => norm(v).includes(term))));
  }, [state.students, grade, section, missingPhone, query]);
  useEffect(() => { setPage(0); }, [query, grade, section, missingPhone]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const copies = selected ? state.sheets.filter((s) => s.studentId === selected.id) : [];
  const meta = selected ? [
    ["Class", `Class ${selected.grade} · Section ${selected.section}`], ["Roll", String(selected.roll)], ["Admission number", selected.admissionNo], ["Guardian", `${selected.guardian.name} · ${selected.guardian.relation}`], ["Phone", selected.guardian.phone ?? "Missing"],
  ] : [];
  return <Page wide>
    <PageHeader title="Students" meta={<span>{filtered.length.toLocaleString("en-IN")} students</span>} />
    <Panel flush>
      <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
        <SearchInput label="Search students" value={query} onChange={setQuery} placeholder="Name, roll, admission no or barcode" className="w-full lg:max-w-sm" />
        <Select aria-label="Filter by class" value={grade} onChange={(e) => { setGrade(e.target.value); setSection("all"); }} className="w-full lg:w-40"><option value="all">All classes</option>{grades.map((g) => <option key={g} value={g}>Class {g}</option>)}</Select>
        <Select aria-label="Filter by section" value={section} onChange={(e) => setSection(e.target.value)} className="w-full lg:w-40"><option value="all">All sections</option>{sections.map((s) => <option key={s} value={s}>Section {s}</option>)}</Select>
        <label className="flex h-9 items-center gap-2 whitespace-nowrap px-1 text-[13px] text-ink-2"><Switch checked={missingPhone} onChange={setMissingPhone} label="Missing guardian phone" />Missing guardian phone</label>
      </div>
      {visible.length === 0 ? <EmptyState title="No students match these filters" body="Try a different name, class or section." /> : <Table>
        <thead><tr><Th sticky>Name</Th><Th>Class</Th><Th>Roll</Th><Th>Admission no</Th><Th>Barcode</Th><Th>Guardian</Th><Th>Phone</Th><Th align="right">Copies</Th></tr></thead>
        <tbody>{visible.map((student) => {
          const count = state.sheets.filter((s) => s.studentId === student.id).length;
          return <Tr key={student.id} onClick={() => setStudentId(student.id)}><Td sticky className="font-medium text-ink">{student.name}</Td><Td>Class {student.grade}{student.section}</Td><Td>{student.roll}</Td><Td mono>{student.admissionNo}</Td><Td mono>{student.barcode}</Td><Td><span className="block">{student.guardian.name}</span><span className="text-xs text-ink-3">{student.guardian.relation}</span></Td><Td>{student.guardian.phone ?? <Tag tone="warning">Missing</Tag>}</Td><Td align="right">{count}</Td></Tr>;
        })}</tbody>
      </Table>}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] text-ink-3"><span>{filtered.length === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min(filtered.length, (page + 1) * PAGE_SIZE)}`} of {filtered.length.toLocaleString("en-IN")}</span><div className="flex items-center gap-2"><span className="text-xs">Page {page + 1} of {pages}</span><Button size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button><Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</Button></div></div>
    </Panel>
    <Drawer open={!!selected} onClose={() => setStudentId("")} title={selected?.name ?? "Student details"} subtitle={selected ? `Class ${selected.grade}${selected.section} · Roll ${selected.roll}` : undefined}>
      {selected && <div className="space-y-5 p-5">
        <Panel title="Student details"><dl className="divide-y divide-border">{meta.map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 first:pt-0 last:pb-0"><dt className="text-xs text-ink-3">{label}</dt><dd className={cx("text-[13px] text-ink-2", label === "Phone" && !selected.guardian.phone && "text-warning")}>{value}</dd></div>)}</dl></Panel>
        <Panel title="Barcode"><div className="flex justify-center py-2"><Barcode value={selected.barcode} height={34} /></div></Panel>
        <Panel title={`Answer sheets · ${copies.length}`} flush>
          {copies.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-ink-3">No copies uploaded for this student.</p> : <ul className="divide-y divide-border">{copies.map((sheet) => { const assessment = state.assessments.find((a) => a.id === sheet.assessmentId); return <li key={sheet.id} className="p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[13px] font-medium text-ink">{assessment?.name ?? "Assessment"}</p><p className="text-xs text-ink-3">Class {assessment?.grade} · {sheetTotal(sheet)}/{assessment?.totalMarks ?? 0} marks</p></div><StatusText tone={sheet.evaluation === "evaluated" ? "success" : sheet.evaluation === "failed" ? "danger" : sheet.evaluation === "needs_review" ? "warning" : "info"} label={sheet.evaluation === "evaluated" ? "Evaluated" : sheet.evaluation === "processing" ? "Processing" : sheet.evaluation === "queued" ? "Queued" : sheet.evaluation === "failed" ? "Failed" : "Needs review"} /></div><Lifecycle className="my-2" sheet={sheet} dists={state.distributions} /><Button size="sm" onClick={() => { setStudentId(""); navigate(`/review/${sheet.id}`); }}>Open copy</Button></li>; })}</ul>}
        </Panel>
      </div>}
    </Drawer>
  </Page>;
}
