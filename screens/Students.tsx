import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, UserPlus, QrCode, Printer } from "lucide-react";
import QrPrintDialog from "../components/QrPrintDialog";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lifecycle } from "../components/booklet";
import { useStore } from "../data/store";
import { sheetTotal } from "../data/selectors";
import { Button, Drawer, Field, Input, EmptyState, ICON, Page, PageHeader, Panel, SearchInput, Select, StatusText, Switch, Table, Td, Th, Tr, Tag, cx } from "../components/ui";

const PAGE_SIZE = 50;
export default function Students() {
  const { state, actions } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
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
    return state.students.filter((s) => (grade === "all" || s.grade === grade) && (section === "all" || s.section === section) && (!missingPhone || !s.guardian.phone) && (!term || [s.name, String(s.roll), s.barcode].some((v) => norm(v).includes(term))));
  }, [state.students, grade, section, missingPhone, query]);
  useEffect(() => { setPage(0); }, [query, grade, section, missingPhone]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const [printIds, setPrintIds] = useState<string[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", grade: "", section: "", roll: "", guardianName: "", relation: "Mother" as "Mother" | "Father" | "Guardian", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<(typeof state.students)[number] | null>(null);
  const setF = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const openAdd = () => { setForm({ name: "", grade: grade !== "all" ? grade : "", section: section !== "all" ? section : "", roll: "", guardianName: "", relation: "Mother", phone: "" }); setErrors({}); setCreated(null); setAddOpen(true); };
  const nextRoll = (g: string, sec: string) => state.students.filter((x) => x.grade === g && x.section === sec).reduce((m, x) => Math.max(m, x.roll), 0) + 1;
  const classOk = /^\d{1,2}$/.test(form.grade.trim()) && /^[A-Za-z]$/.test(form.section.trim());
  const submitAdd = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Enter the student's full name";
    if (!/^\d{1,2}$/.test(form.grade.trim())) e.grade = "Enter a class, e.g. 10";
    if (!/^[A-Za-z]$/.test(form.section.trim())) e.section = "Enter one letter, e.g. A";
    const roll = Number(form.roll || (classOk ? nextRoll(form.grade.trim(), form.section.trim().toUpperCase()) : 0));
    if (!Number.isInteger(roll) || roll < 1) e.roll = "Enter a roll number of 1 or more";
    if (!form.guardianName.trim()) e.guardianName = "Enter the guardian's name";
    const phone = form.phone.trim();
    if (phone && !/^\+?[\d\s-]{10,15}$/.test(phone)) e.phone = "Enter a valid phone number";
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = actions.addStudent({ name: form.name.trim(), grade: form.grade.trim(), section: form.section.trim().toUpperCase(), roll, guardianName: form.guardianName.trim(), relation: form.relation, phone: phone || null });
    if (!res.ok) { setErrors({ roll: res.error ?? "Could not add student" }); return; }
    if (!res.student) return;
    setCreated(res.student);
    actions.toast(`${res.student.name} added`, { tone: "success" });
  };
  const copies = selected ? state.sheets.filter((s) => s.studentId === selected.id) : [];
  const meta = selected ? [
    ["Class", `Class ${selected.grade} · Section ${selected.section}`], ["Roll no", String(selected.roll)], ["Guardian", `${selected.guardian.name} · ${selected.guardian.relation}`], ["Phone", selected.guardian.phone ?? "Missing"],
  ] : [];
  return <Page wide>
    <PageHeader title="Students" meta={<span>{filtered.length.toLocaleString("en-IN")} students</span>} actions={<>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.toast(`Selected ${f.name} for student import`, { tone: "neutral" }); e.target.value = ""; }} />
      <Button variant="secondary" icon={<Printer size={16} strokeWidth={ICON} />} onClick={() => setPrintIds(filtered.map((x) => x.id))}>Print QR codes</Button>
      <Button variant="secondary" icon={<Upload size={16} strokeWidth={ICON} />} onClick={() => fileRef.current?.click()}>Upload multiple students</Button>
      <Button variant="primary" icon={<UserPlus size={16} strokeWidth={ICON} />} onClick={openAdd}>Add student</Button>
    </>} />
    <Panel flush>
      <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
        <SearchInput label="Search students" value={query} onChange={setQuery} placeholder="Name, roll no or QR ID" className="w-full lg:max-w-sm" />
        <Select aria-label="Filter by class" value={grade} onChange={(e) => { setGrade(e.target.value); setSection("all"); }} className="w-full lg:w-40"><option value="all">All classes</option>{grades.map((g) => <option key={g} value={g}>Class {g}</option>)}</Select>
        <Select aria-label="Filter by section" value={section} onChange={(e) => setSection(e.target.value)} className="w-full lg:w-40"><option value="all">All sections</option>{sections.map((s) => <option key={s} value={s}>Section {s}</option>)}</Select>
        <label className="flex h-9 items-center gap-2 whitespace-nowrap px-1 text-[13px] text-ink-2"><Switch checked={missingPhone} onChange={setMissingPhone} label="Missing guardian phone" />Missing guardian phone</label>
      </div>
      {visible.length === 0 ? <EmptyState title="No students match these filters" body="Try a different name, class or section." /> : <Table>
        <thead><tr><Th sticky>Name</Th><Th>Class</Th><Th>Roll no</Th><Th>QR ID</Th><Th>Guardian</Th><Th>Phone</Th><Th align="right">Copies</Th></tr></thead>
        <tbody>{visible.map((student) => {
          const count = state.sheets.filter((s) => s.studentId === student.id).length;
          return <Tr key={student.id} onClick={() => setStudentId(student.id)}><Td sticky className="font-medium text-ink">{student.name}</Td><Td>Class {student.grade}{student.section}</Td><Td>{student.roll}</Td><Td mono><span className="inline-flex items-center gap-1.5"><QrCode size={14} strokeWidth={ICON} className="text-ink-3" />{student.barcode}</span></Td><Td><span className="block">{student.guardian.name}</span><span className="text-xs text-ink-3">{student.guardian.relation}</span></Td><Td>{student.guardian.phone ?? <Tag tone="warning">Missing</Tag>}</Td><Td align="right">{count}</Td></Tr>;
        })}</tbody>
      </Table>}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] text-ink-3"><span>{filtered.length === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min(filtered.length, (page + 1) * PAGE_SIZE)}`} of {filtered.length.toLocaleString("en-IN")}</span><div className="flex items-center gap-2"><span className="text-xs">Page {page + 1} of {pages}</span><Button size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button><Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</Button></div></div>
    </Panel>
    <Drawer open={addOpen} onClose={() => setAddOpen(false)} title={created ? "Student added" : "Add student"} subtitle={created ? undefined : "A unique QR code is generated automatically"}
      footer={created ? <div className="flex justify-end gap-2"><Button icon={<Printer size={15} strokeWidth={ICON} />} onClick={() => { setPrintIds([created.id]); setAddOpen(false); }}>Print QR code</Button><Button onClick={openAdd}>Add another</Button><Button variant="primary" onClick={() => { setQuery(created.barcode); setAddOpen(false); }}>Done</Button></div> : <div className="flex justify-end gap-2"><Button onClick={() => setAddOpen(false)}>Cancel</Button><Button variant="primary" onClick={submitAdd}>Add student</Button></div>}>
      {created ? <div className="space-y-5 p-5">
        <Panel title="QR code"><div className="flex flex-col items-center gap-2 py-2"><QRCodeSVG value={created.barcode} size={140} level="M" className="fill-ink" aria-label={`QR code ${created.barcode}`} /><span className="font-mono text-xs text-ink-3">{created.barcode}</span></div></Panel>
        <p className="text-[13px] text-ink-2">{created.name} · Class {created.grade}{created.section} · Roll no {created.roll}. Print this QR code on the student's booklet cover so scans map to them.</p>
      </div> : <form className="space-y-4 p-5" onSubmit={(ev) => { ev.preventDefault(); submitAdd(); }}>
        <Field label="Full name" htmlFor="st-name" error={errors.name}><Input id="st-name" autoFocus value={form.name} invalid={!!errors.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Aarav Mehta" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Class" htmlFor="st-grade" error={errors.grade}><Input id="st-grade" inputMode="numeric" value={form.grade} invalid={!!errors.grade} onChange={(e) => setF("grade", e.target.value)} placeholder="10" /></Field>
          <Field label="Section" htmlFor="st-section" error={errors.section}><Input id="st-section" maxLength={1} value={form.section} invalid={!!errors.section} onChange={(e) => setF("section", e.target.value.toUpperCase())} placeholder="A" /></Field>
          <Field label="Roll no" htmlFor="st-roll" error={errors.roll} helper={classOk ? `Next free: ${nextRoll(form.grade.trim(), form.section.trim().toUpperCase())}` : undefined}><Input id="st-roll" inputMode="numeric" value={form.roll} invalid={!!errors.roll} onChange={(e) => setF("roll", e.target.value)} placeholder="Auto" /></Field>
        </div>
        <Field label="Guardian name" htmlFor="st-guardian" error={errors.guardianName}><Input id="st-guardian" value={form.guardianName} invalid={!!errors.guardianName} onChange={(e) => setF("guardianName", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Relation" htmlFor="st-relation"><Select id="st-relation" value={form.relation} onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value as typeof f.relation }))}><option>Mother</option><option>Father</option><option>Guardian</option></Select></Field>
          <Field label="Guardian phone" htmlFor="st-phone" optional error={errors.phone}><Input id="st-phone" type="tel" value={form.phone} invalid={!!errors.phone} onChange={(e) => setF("phone", e.target.value)} placeholder="+91 98765 43210" /></Field>
        </div>
        <p className="flex items-center gap-2 rounded-md bg-subtle px-3 py-2 text-xs text-ink-3"><QrCode size={14} strokeWidth={ICON} />The QR code is generated when you save.</p>
      </form>}
    </Drawer>
    <Drawer open={!!selected} onClose={() => setStudentId("")} title={selected?.name ?? "Student details"} subtitle={selected ? `Class ${selected.grade}${selected.section} · Roll no ${selected.roll}` : undefined}>
      {selected && <div className="space-y-5 p-5">
        <Panel title="Student details"><dl className="divide-y divide-border">{meta.map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 first:pt-0 last:pb-0"><dt className="text-xs text-ink-3">{label}</dt><dd className={cx("text-[13px] text-ink-2", label === "Phone" && !selected.guardian.phone && "text-warning")}>{value}</dd></div>)}</dl></Panel>
        <Panel title="QR code"><div className="flex flex-col items-center gap-2 py-2"><QRCodeSVG value={selected.barcode} size={120} level="M" className="fill-ink" aria-label={`QR code ${selected.barcode}`} /><span className="font-mono text-xs text-ink-3">{selected.barcode}</span><Button size="sm" icon={<Printer size={14} strokeWidth={ICON} />} onClick={() => setPrintIds([selected.id])}>Print QR code</Button></div></Panel>
        <Panel title={`Answer sheets · ${copies.length}`} flush>
          {copies.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-ink-3">No copies uploaded for this student.</p> : <ul className="divide-y divide-border">{copies.map((sheet) => { const assessment = state.assessments.find((a) => a.id === sheet.assessmentId); return <li key={sheet.id} className="p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[13px] font-medium text-ink">{assessment?.name ?? "Exam"}</p><p className="text-xs text-ink-3">Class {assessment?.grade} · {sheetTotal(sheet)}/{assessment?.totalMarks ?? 0} marks</p></div><StatusText tone={sheet.evaluation === "evaluated" ? "success" : sheet.evaluation === "failed" ? "danger" : sheet.evaluation === "needs_review" ? "warning" : "info"} label={sheet.evaluation === "evaluated" ? "Evaluated" : sheet.evaluation === "processing" ? "Processing" : sheet.evaluation === "queued" ? "Queued" : sheet.evaluation === "failed" ? "Failed" : "Needs review"} /></div><Lifecycle className="my-2" sheet={sheet} dists={state.distributions} /><Button size="sm" onClick={() => { setStudentId(""); navigate(`/review/${sheet.id}`); }}>Open copy</Button></li>; })}</ul>}
        </Panel>
      </div>}
    </Drawer>
  {printIds && <QrPrintDialog students={state.students} initialIds={printIds} onClose={() => setPrintIds(null)} />}
  </Page>;
}
