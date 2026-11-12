import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, UserPlus, QrCode, Printer, Edit2, Trash2, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import QrPrintDialog from "../components/QrPrintDialog";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lifecycle } from "../components/booklet";
import { useStore } from "../data/store";
import { sheetTotal } from "../data/selectors";
import type { Student, Guardian } from "../data/types";
import { Button, Dialog, Drawer, Field, Input, EmptyState, ICON, Page, PageHeader, Panel, SearchInput, Select, StatusText, Switch, Table, Td, Th, Tr, Tag, cx } from "../components/ui";

const PAGE_SIZE = 50;

export default function Students() {
  const { state, actions } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Filters & Views
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [missingPhone, setMissingPhone] = useState(false);
  const [page, setPage] = useState(0);

  // Selection & Drawers
  const [studentId, setStudentId] = useState("");
  const selected = state.students.find((s) => s.id === studentId);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<Student | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState<{
    name: string;
    grade: string;
    section: string;
    roll: string;
    city: string;
    guardianName: string;
    relation: Guardian["relation"];
    phone: string;
  }>({
    name: "",
    grade: "",
    section: "",
    roll: "",
    city: "",
    guardianName: "",
    relation: "Mother",
    phone: "",
  });

  // Grade-wise Cohorts & Section Bifurcation Summary
  const gradeCohorts = useMemo(() => {
    const map = new Map<
      string,
      {
        grade: string;
        students: Student[];
        missingPhone: number;
        copies: number;
        sections: Map<string, { section: string; students: Student[]; missingPhone: number; copies: number }>;
      }
    >();

    state.students.forEach((st) => {
      let gEntry = map.get(st.grade);
      if (!gEntry) {
        gEntry = {
          grade: st.grade,
          students: [],
          missingPhone: 0,
          copies: 0,
          sections: new Map(),
        };
        map.set(st.grade, gEntry);
      }
      gEntry.students.push(st);
      if (!st.guardian.phone) gEntry.missingPhone += 1;
      const copyCount = state.sheets.filter((sh) => sh.studentId === st.id).length;
      gEntry.copies += copyCount;

      let secEntry = gEntry.sections.get(st.section);
      if (!secEntry) {
        secEntry = { section: st.section, students: [], missingPhone: 0, copies: 0 };
        gEntry.sections.set(st.section, secEntry);
      }
      secEntry.students.push(st);
      if (!st.guardian.phone) secEntry.missingPhone += 1;
      secEntry.copies += copyCount;
    });

    return Array.from(map.values())
      .map((g) => ({
        ...g,
        sectionList: Array.from(g.sections.values()).sort((a, b) => a.section.localeCompare(b.section)),
      }))
      .sort((a, b) => Number(a.grade) - Number(b.grade));
  }, [state.students, state.sheets]);

  const selectedGradeCohort = grade !== "all" ? gradeCohorts.find((g) => g.grade === grade) : null;

  const grades = Array.from(new Set(state.students.map((s) => s.grade))).sort((a, b) => Number(a) - Number(b));
  const sections = Array.from(new Set(state.students.filter((s) => grade === "all" || s.grade === grade).map((s) => s.section))).sort();

  const filtered = useMemo(() => {
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const term = norm(query.trim());
    return state.students.filter(
      (s) =>
        (grade === "all" || s.grade === grade) &&
        (section === "all" || s.section === section) &&
        (!missingPhone || !s.guardian.phone) &&
        (!term || [s.name, String(s.roll), s.barcode, s.city || ""].some((v) => norm(v).includes(term)))
    );
  }, [state.students, grade, section, missingPhone, query]);

  useEffect(() => { setPage(0); }, [query, grade, section, missingPhone]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const [printIds, setPrintIds] = useState<string[] | null>(null);

  // Add Student State
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", grade: "", section: "", roll: "", city: "", guardianName: "", relation: "Mother" as Guardian["relation"], phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<(typeof state.students)[number] | null>(null);

  const setF = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const openAdd = () => {
    setForm({
      name: "",
      grade: grade !== "all" ? grade : "10",
      section: section !== "all" ? section : "A",
      roll: "",
      city: state.settings.city || "Bengaluru",
      guardianName: "",
      relation: "Mother",
      phone: "",
    });
    setErrors({});
    setCreated(null);
    setAddOpen(true);
  };

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

    const res = actions.addStudent({
      name: form.name.trim(),
      grade: form.grade.trim(),
      section: form.section.trim().toUpperCase(),
      roll,
      city: form.city.trim() || state.settings.city || "Bengaluru",
      guardianName: form.guardianName.trim(),
      relation: form.relation,
      phone: phone || null,
    });
    if (!res.ok) { setErrors({ roll: res.error ?? "Could not add student" }); return; }
    if (!res.student) return;
    setCreated(res.student);
    actions.toast(`${res.student.name} added`, { tone: "success" });
  };

  // Edit Student Handlers
  const startEditStudent = (st: Student) => {
    setEditingStudent(st);
    setEditForm({
      name: st.name,
      grade: st.grade,
      section: st.section,
      roll: String(st.roll),
      city: st.city || state.settings.city || "Bengaluru",
      guardianName: st.guardian.name,
      relation: st.guardian.relation,
      phone: st.guardian.phone || "",
    });
    setEditErrors({});
  };

  const submitEditStudent = () => {
    if (!editingStudent) return;
    const e: Record<string, string> = {};
    if (!editForm.name.trim()) e.name = "Enter the student's full name";
    if (!/^\d{1,2}$/.test(editForm.grade.trim())) e.grade = "Enter a valid class (e.g. 10)";
    if (!/^[A-Za-z]$/.test(editForm.section.trim())) e.section = "Enter a single letter section";
    const roll = Number(editForm.roll);
    if (!Number.isInteger(roll) || roll < 1) e.roll = "Enter a valid roll number";
    if (!editForm.guardianName.trim()) e.guardianName = "Enter the guardian's name";
    const phone = editForm.phone.trim();
    if (phone && !/^\+?[\d\s-]{10,15}$/.test(phone)) e.phone = "Enter a valid phone number";
    setEditErrors(e);
    if (Object.keys(e).length) return;

    const res = actions.updateStudent(editingStudent.id, {
      name: editForm.name.trim(),
      grade: editForm.grade.trim(),
      section: editForm.section.trim().toUpperCase(),
      roll,
      city: editForm.city.trim() || "Bengaluru",
      guardian: {
        name: editForm.guardianName.trim(),
        relation: editForm.relation,
        phone: phone || null,
      },
    });

    if (!res.ok) {
      setEditErrors({ roll: res.error ?? "Failed to update student" });
      return;
    }

    actions.toast(`${editForm.name.trim()} updated successfully`, { tone: "success" });
    setEditingStudent(null);
  };

  const copies = selected ? state.sheets.filter((s) => s.studentId === selected.id) : [];
  const meta = selected
    ? [
        ["Class & Section", `Class ${selected.grade}${selected.section}`],
        ["Roll number", String(selected.roll)],
        ["City / Location", selected.city || state.settings.city || "Bengaluru"],
        ["QR Barcode ID", selected.barcode],
        ["Guardian", `${selected.guardian.name} (${selected.guardian.relation})`],
        ["Phone", selected.guardian.phone ?? "Missing"],
      ]
    : [];

  return (
    <Page wide>
      <PageHeader
        title="Students Registry"
        meta={<span>{state.students.length.toLocaleString("en-IN")} total enrolled students · Exam Cell</span>}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.toast(`Selected ${f.name} for student import`, { tone: "neutral" }); e.target.value = ""; }} />
            <Button variant="secondary" icon={<Printer size={16} strokeWidth={ICON} />} onClick={() => setPrintIds(filtered.map((x) => x.id))}>
              Print QR codes
            </Button>
            <Button variant="secondary" icon={<Upload size={16} strokeWidth={ICON} />} onClick={() => fileRef.current?.click()}>
              Upload multiple students
            </Button>
            <Button variant="primary" icon={<UserPlus size={16} strokeWidth={ICON} />} onClick={openAdd}>
              Add student
            </Button>
          </>
        }
      />

      {/* Grade-wise Dashboard with Section Bifurcation */}
      <section aria-label="Grade-wise Dashboard" className="mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink flex items-center gap-1.5">
              <Users size={16} className="text-primary" />
              Grade-wise Student Registry
            </h2>
            <p className="text-xs text-ink-3">Click on a grade to view its section bifurcation and student roster</p>
          </div>
          {(grade !== "all" || section !== "all") && (
            <button
              onClick={() => { setGrade("all"); setSection("all"); }}
              className="text-xs text-primary font-medium hover:underline"
            >
              Reset to All Grades
            </button>
          )}
        </div>

        {/* Level 1: Grade Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* All Grades Card */}
          <div
            onClick={() => { setGrade("all"); setSection("all"); }}
            className={cx(
              "cursor-pointer rounded-lg border p-3.5 transition-all shadow-xs",
              grade === "all"
                ? "border-primary bg-primary-soft/60 ring-2 ring-primary/40 shadow-sm"
                : "border-border bg-surface hover:border-border-strong hover:bg-subtle"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">All Grades</span>
              <span className="text-[11px] rounded bg-muted px-1.5 py-0.5 font-medium text-ink-3">Total</span>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{state.students.length}</p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
              <span>{gradeCohorts.length} grades</span>
              <span>{state.sheets.length} copies</span>
            </div>
          </div>

          {/* Individual Grade Cards */}
          {gradeCohorts.map((g) => {
            const active = grade === g.grade;
            return (
              <div
                key={g.grade}
                onClick={() => {
                  setGrade(g.grade);
                  setSection("all");
                }}
                className={cx(
                  "cursor-pointer rounded-lg border p-3.5 transition-all shadow-xs",
                  active
                    ? "border-primary bg-primary-soft/60 ring-2 ring-primary/40 shadow-sm"
                    : "border-border bg-surface hover:border-border-strong hover:bg-subtle"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">Class {g.grade}</span>
                  {g.missingPhone > 0 && (
                    <span className="text-[10px] rounded bg-warning-soft px-1.5 py-0.5 text-warning font-semibold" title={`${g.missingPhone} students missing guardian phone`}>
                      ⚠ {g.missingPhone}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{g.students.length}</p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
                  <span className="font-medium text-primary">{g.sectionList.length} {g.sectionList.length === 1 ? "section" : "sections"}</span>
                  <span>{g.copies} copies</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Level 2: Section Bifurcation (Displayed when a grade is clicked/selected) */}
        {selectedGradeCohort ? (
          <div className="rounded-lg border border-primary/30 bg-primary-soft/20 p-3.5 transition-all">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Class {selectedGradeCohort.grade} · Section Bifurcation
                </span>
                <span className="text-xs text-ink-3">({selectedGradeCohort.students.length} students in {selectedGradeCohort.sectionList.length} sections)</span>
              </div>
              <span className="text-xs text-ink-3">Click any section to filter</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* All sections of this grade */}
              <button
                type="button"
                onClick={() => setSection("all")}
                className={cx(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors shadow-xs",
                  section === "all"
                    ? "border-primary bg-primary text-on-primary font-semibold shadow-sm"
                    : "border-border bg-surface text-ink hover:bg-subtle"
                )}
              >
                <span>All Sections (Class {selectedGradeCohort.grade})</span>
                <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums", section === "all" ? "bg-white/20 text-white" : "bg-muted text-ink-2")}>
                  {selectedGradeCohort.students.length}
                </span>
              </button>

              {/* Each Section Card */}
              {selectedGradeCohort.sectionList.map((sec) => {
                const isSecActive = section === sec.section;
                const minRoll = sec.students.reduce((m, s) => Math.min(m, s.roll), Infinity);
                const maxRoll = sec.students.reduce((m, s) => Math.max(m, s.roll), -Infinity);
                return (
                  <button
                    key={sec.section}
                    type="button"
                    onClick={() => setSection(sec.section)}
                    className={cx(
                      "flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors shadow-xs",
                      isSecActive
                        ? "border-primary bg-primary text-on-primary font-semibold shadow-sm"
                        : "border-border bg-surface text-ink hover:bg-subtle"
                    )}
                  >
                    <span className="font-bold">Section {selectedGradeCohort.grade}{sec.section}</span>
                    <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums", isSecActive ? "bg-white/20 text-white" : "bg-muted text-ink-2")}>
                      {sec.students.length}
                    </span>
                    <span className={cx("text-[10px]", isSecActive ? "text-white/80" : "text-ink-3")}>
                      Roll {minRoll}–{maxRoll}
                    </span>
                    {sec.missingPhone > 0 && (
                      <span className={cx("text-[10px] font-semibold", isSecActive ? "text-warning-light" : "text-warning")}>
                        ⚠ {sec.missingPhone}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-subtle/50 px-4 py-2.5 text-xs text-ink-3 flex items-center justify-between">
            <span>Showing all grades across the school. Click on <strong>Class 10</strong>, <strong>Class 9</strong>, or <strong>Class 8</strong> above to reveal its section bifurcation.</span>
            <span className="text-[11px] text-ink-4">Multi-section drilldown enabled</span>
          </div>
        )}
      </section>

      {/* Main Students Table with Editable Rows */}
      <Panel flush>
        <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
          <SearchInput label="Search students" value={query} onChange={setQuery} placeholder="Name, roll no, city or QR ID" className="w-full lg:max-w-sm" />
          <Select aria-label="Filter by class" value={grade} onChange={(e) => { setGrade(e.target.value); setSection("all"); }} className="w-full lg:w-40">
            <option value="all">All classes</option>
            {grades.map((g) => <option key={g} value={g}>Class {g}</option>)}
          </Select>
          <Select aria-label="Filter by section" value={section} onChange={(e) => setSection(e.target.value)} className="w-full lg:w-40">
            <option value="all">All sections</option>
            {sections.map((s) => <option key={s} value={s}>Section {s}</option>)}
          </Select>
          <label className="flex h-9 items-center gap-2 whitespace-nowrap px-1 text-[13px] text-ink-2">
            <Switch checked={missingPhone} onChange={setMissingPhone} label="Missing guardian phone" />
            Missing phone
          </label>
          <span className="ml-auto text-xs text-ink-3 font-medium">
            Showing {filtered.length} students
          </span>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No students match these filters" body="Try a different name, class or section." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th sticky>Name</Th>
                <Th>Class</Th>
                <Th>Roll no</Th>
                <Th>City</Th>
                <Th>QR ID</Th>
                <Th>Guardian &amp; Phone</Th>
                <Th align="right">Copies</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((student) => {
                const count = state.sheets.filter((s) => s.studentId === student.id).length;
                return (
                  <Tr key={student.id} onClick={() => setStudentId(student.id)}>
                    <Td sticky className="font-medium text-ink">
                      <span className="block truncate">{student.name}</span>
                    </Td>
                    <Td>Class {student.grade}{student.section}</Td>
                    <Td>{student.roll}</Td>
                    <Td>{student.city || state.settings.city || "Bengaluru"}</Td>
                    <Td mono>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <QrCode size={13} strokeWidth={ICON} className="text-ink-3" />
                        {student.barcode}
                      </span>
                    </Td>
                    <Td>
                      <span className="block text-xs font-medium text-ink">{student.guardian.name} ({student.guardian.relation})</span>
                      <span className="text-xs text-ink-3">
                        {student.guardian.phone ? student.guardian.phone : <Tag tone="warning">Phone missing</Tag>}
                      </span>
                    </Td>
                    <Td align="right">{count}</Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Edit2 size={13} strokeWidth={ICON} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditStudent(student);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger-ghost"
                          icon={<Trash2 size={13} strokeWidth={ICON} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteStudent(student);
                          }}
                          title={`Delete ${student.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] text-ink-3">
          <span>{filtered.length === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min(filtered.length, (page + 1) * PAGE_SIZE)}`} of {filtered.length.toLocaleString("en-IN")}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Page {page + 1} of {pages}</span>
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</Button>
          </div>
        </div>
      </Panel>

      {/* Add Student Drawer */}
      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={created ? "Student added" : "Add student"}
        subtitle={created ? undefined : "A unique QR code is generated automatically"}
        footer={
          created ? (
            <div className="flex justify-end gap-2">
              <Button icon={<Printer size={15} strokeWidth={ICON} />} onClick={() => { setPrintIds([created.id]); setAddOpen(false); }}>Print QR code</Button>
              <Button onClick={openAdd}>Add another</Button>
              <Button variant="primary" onClick={() => { setQuery(created.barcode); setAddOpen(false); }}>Done</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={submitAdd}>Add student</Button>
            </div>
          )
        }
      >
        {created ? (
          <div className="space-y-5 p-5">
            <Panel title="Candidate QR code">
              <div className="flex flex-col items-center gap-2 py-3 text-center">
                <QRCodeSVG value={created.barcode} size={140} level="M" className="fill-ink" aria-label={`QR code ${created.barcode}`} />
                <span className="font-mono text-xs text-ink-3">{created.barcode}</span>
              </div>
            </Panel>
            <p className="text-[13px] text-ink-2">
              {created.name} · Class {created.grade}{created.section} · Roll no {created.roll} · {created.city || "Bengaluru"}.
            </p>
          </div>
        ) : (
          <form className="space-y-4 p-5" onSubmit={(ev) => { ev.preventDefault(); submitAdd(); }}>
            <Field label="Full name" htmlFor="st-name" error={errors.name}>
              <Input id="st-name" autoFocus value={form.name} invalid={!!errors.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Aarav Mehta" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Class / Grade" htmlFor="st-grade" error={errors.grade}>
                <Input id="st-grade" inputMode="numeric" value={form.grade} invalid={!!errors.grade} onChange={(e) => setF("grade", e.target.value)} placeholder="10" />
              </Field>
              <Field label="Section" htmlFor="st-section" error={errors.section}>
                <Input id="st-section" maxLength={1} value={form.section} invalid={!!errors.section} onChange={(e) => setF("section", e.target.value.toUpperCase())} placeholder="A" />
              </Field>
              <Field label="Roll no" htmlFor="st-roll" error={errors.roll} helper={classOk ? `Next free: ${nextRoll(form.grade.trim(), form.section.trim().toUpperCase())}` : undefined}>
                <Input id="st-roll" inputMode="numeric" value={form.roll} invalid={!!errors.roll} onChange={(e) => setF("roll", e.target.value)} placeholder="Auto" />
              </Field>
            </div>
            <Field label="City / Location" htmlFor="st-city">
              <Input id="st-city" value={form.city} onChange={(e) => setF("city", e.target.value)} placeholder="e.g. Bengaluru" />
            </Field>
            <Field label="Guardian name" htmlFor="st-guardian" error={errors.guardianName}>
              <Input id="st-guardian" value={form.guardianName} invalid={!!errors.guardianName} onChange={(e) => setF("guardianName", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Relation" htmlFor="st-relation">
                <Select id="st-relation" value={form.relation} onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value as typeof f.relation }))}>
                  <option>Mother</option>
                  <option>Father</option>
                  <option>Guardian</option>
                </Select>
              </Field>
              <Field label="Guardian phone" htmlFor="st-phone" optional error={errors.phone}>
                <Input id="st-phone" type="tel" value={form.phone} invalid={!!errors.phone} onChange={(e) => setF("phone", e.target.value)} placeholder="+91 98765 43210" />
              </Field>
            </div>
            <p className="flex items-center gap-2 rounded-md bg-subtle px-3 py-2 text-xs text-ink-3">
              <QrCode size={14} strokeWidth={ICON} />
              The QR code and barcode string are generated automatically when saved.
            </p>
          </form>
        )}
      </Drawer>

      {/* Edit Student Drawer (Keep Editable to Student Rows) */}
      <Drawer
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={`Edit Student: ${editingStudent?.name ?? ""}`}
        subtitle={editingStudent ? `QR ID: ${editingStudent.barcode}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingStudent(null)}>Cancel</Button>
            <Button variant="primary" onClick={submitEditStudent}>Save changes</Button>
          </div>
        }
      >
        {editingStudent && (
          <form className="space-y-4 p-5" onSubmit={(ev) => { ev.preventDefault(); submitEditStudent(); }}>
            <Field label="Full name" htmlFor="edit-st-name" error={editErrors.name}>
              <Input
                id="edit-st-name"
                value={editForm.name}
                invalid={!!editErrors.name}
                onChange={(e) => {
                  setEditForm((f) => ({ ...f, name: e.target.value }));
                  setEditErrors((err) => ({ ...err, name: "" }));
                }}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Class / Grade" htmlFor="edit-st-grade" error={editErrors.grade}>
                <Input
                  id="edit-st-grade"
                  value={editForm.grade}
                  invalid={!!editErrors.grade}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, grade: e.target.value }));
                    setEditErrors((err) => ({ ...err, grade: "" }));
                  }}
                />
              </Field>
              <Field label="Section" htmlFor="edit-st-section" error={editErrors.section}>
                <Input
                  id="edit-st-section"
                  value={editForm.section}
                  invalid={!!editErrors.section}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, section: e.target.value.toUpperCase() }));
                    setEditErrors((err) => ({ ...err, section: "" }));
                  }}
                />
              </Field>
              <Field label="Roll no" htmlFor="edit-st-roll" error={editErrors.roll}>
                <Input
                  id="edit-st-roll"
                  inputMode="numeric"
                  value={editForm.roll}
                  invalid={!!editErrors.roll}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, roll: e.target.value }));
                    setEditErrors((err) => ({ ...err, roll: "" }));
                  }}
                />
              </Field>
            </div>
            <Field label="City / Location" htmlFor="edit-st-city">
              <Input
                id="edit-st-city"
                value={editForm.city}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Bengaluru"
              />
            </Field>
            <Field label="Guardian name" htmlFor="edit-st-guardian" error={editErrors.guardianName}>
              <Input
                id="edit-st-guardian"
                value={editForm.guardianName}
                invalid={!!editErrors.guardianName}
                onChange={(e) => {
                  setEditForm((f) => ({ ...f, guardianName: e.target.value }));
                  setEditErrors((err) => ({ ...err, guardianName: "" }));
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Relation" htmlFor="edit-st-relation">
                <Select
                  id="edit-st-relation"
                  value={editForm.relation}
                  onChange={(e) => setEditForm((f) => ({ ...f, relation: e.target.value as Guardian["relation"] }))}
                >
                  <option>Mother</option>
                  <option>Father</option>
                  <option>Guardian</option>
                </Select>
              </Field>
              <Field label="Guardian phone" htmlFor="edit-st-phone" optional error={editErrors.phone}>
                <Input
                  id="edit-st-phone"
                  type="tel"
                  value={editForm.phone}
                  invalid={!!editErrors.phone}
                  onChange={(e) => {
                    setEditForm((f) => ({ ...f, phone: e.target.value }));
                    setEditErrors((err) => ({ ...err, phone: "" }));
                  }}
                />
              </Field>
            </div>
            <div className="rounded-md bg-subtle p-3 text-xs text-ink-3">
              <span>QR Code: </span>
              <span className="font-mono text-ink">{editingStudent.barcode}</span> (Linked to this student across all exams)
            </div>
          </form>
        )}
      </Drawer>

      {/* Student View Drawer */}
      <Drawer
        open={!!selected && !editingStudent}
        onClose={() => setStudentId("")}
        title={selected?.name ?? "Student details"}
        subtitle={selected ? `Class ${selected.grade}${selected.section} · Roll no ${selected.roll}` : undefined}
        footer={
          selected && (
            <div className="flex justify-between w-full">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  icon={<Edit2 size={14} strokeWidth={ICON} />}
                  onClick={() => {
                    const s = selected;
                    setStudentId("");
                    startEditStudent(s);
                  }}
                >
                  Edit Student Info
                </Button>
                <Button
                  variant="danger-ghost"
                  icon={<Trash2 size={14} strokeWidth={ICON} />}
                  onClick={() => {
                    const s = selected;
                    setStudentId("");
                    setConfirmDeleteStudent(s);
                  }}
                >
                  Delete Student
                </Button>
              </div>
              <Button onClick={() => setStudentId("")}>Done</Button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5 p-5">
            <Panel title="Student details">
              <dl className="divide-y divide-border">
                {meta.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-xs text-ink-3">{label}</dt>
                    <dd className={cx("text-[13px] text-ink-2 font-medium", label === "Phone" && !selected.guardian.phone && "text-warning")}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Candidate QR code">
              <div className="flex flex-col items-center gap-2 py-2">
                <QRCodeSVG value={selected.barcode} size={130} level="M" className="fill-ink" aria-label={`QR code ${selected.barcode}`} />
                <span className="font-mono text-xs text-ink-3">{selected.barcode}</span>
                <Button size="sm" icon={<Printer size={14} strokeWidth={ICON} />} onClick={() => setPrintIds([selected.id])}>
                  Print QR code
                </Button>
              </div>
            </Panel>
            <Panel title={`Answer sheets · ${copies.length}`} flush>
              {copies.length === 0 ? (
                <p className="px-4 py-5 text-center text-[13px] text-ink-3">No copies uploaded for this student.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {copies.map((sheet) => {
                    const assessment = state.assessments.find((a) => a.id === sheet.assessmentId);
                    return (
                      <li key={sheet.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{assessment?.name ?? "Exam"}</p>
                            <p className="text-xs text-ink-3">Class {assessment?.grade} · {sheetTotal(sheet)}/{assessment?.totalMarks ?? 0} marks</p>
                          </div>
                          <StatusText
                            tone={sheet.evaluation === "evaluated" ? "success" : sheet.evaluation === "failed" ? "danger" : sheet.evaluation === "needs_review" ? "warning" : "info"}
                            label={sheet.evaluation === "evaluated" ? "Evaluated" : sheet.evaluation === "processing" ? "Processing" : sheet.evaluation === "queued" ? "Queued" : sheet.evaluation === "failed" ? "Failed" : "Needs review"}
                          />
                        </div>
                        <Lifecycle className="my-2" sheet={sheet} dists={state.distributions} />
                        <Button size="sm" onClick={() => { setStudentId(""); navigate(`/review/${sheet.id}`); }}>
                          Open copy
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </Drawer>

      {printIds && <QrPrintDialog students={state.students} initialIds={printIds} onClose={() => setPrintIds(null)} />}

      {/* Delete Student Confirmation Dialog */}
      {confirmDeleteStudent && (
        <Dialog
          open={!!confirmDeleteStudent}
          onClose={() => setConfirmDeleteStudent(null)}
          title="Delete Student"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDeleteStudent(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const name = confirmDeleteStudent.name;
                  const res = actions.deleteStudent(confirmDeleteStudent.id);
                  if (res.ok) {
                    actions.toast(`Deleted student ${name}`, { tone: "success" });
                  } else {
                    actions.toast(res.error ?? "Failed to delete student", { tone: "danger" });
                  }
                  setConfirmDeleteStudent(null);
                  if (studentId === confirmDeleteStudent.id) setStudentId("");
                }}
              >
                Delete Student
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-ink">
              Are you sure you want to delete <strong>{confirmDeleteStudent.name}</strong> (Class {confirmDeleteStudent.grade}{confirmDeleteStudent.section}, Roll #{confirmDeleteStudent.roll})?
            </p>
            <p className="text-xs text-ink-3">
              This will permanently remove the student record and any associated answer sheets from the system. This action cannot be undone.
            </p>
          </div>
        </Dialog>
      )}
    </Page>
  );
}
