import { useMemo, useRef, useState } from "react";
import { Upload, UserPlus, Edit2, Trash2 } from "lucide-react";
import { useStore } from "../data/store";
import { now, pct, relTime } from "../data/selectors";
import type { AnswerSheet, Assessment, User } from "../data/types";
import { Avatar, Banner, Button, Checkbox, Dialog, Drawer, EmptyState, Field, ICON, Input, Page, PageHeader, Panel, Progress, Radio, Select, Table, Tabs, Td, Th, Tr, cx } from "../components/ui";

const SUBJECTS = ["Science", "Mathematics", "English", "Social Science", "Hindi", "Computer Science"];
const ALL_GRADES = ["6", "7", "8", "9", "10", "11", "12"];
type Scope = "unassigned" | "section" | "reassign";
type ViewTab = "directory" | "progress";

export default function TeacherAssignment() {
  const { state, actions } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("directory");

  // Add Teacher State (with Grades)
  const [addOpen, setAddOpen] = useState(false);
  const [tForm, setTForm] = useState({ name: "", email: "", title: "", subjects: [] as string[], grades: [] as string[] });
  const [tErrors, setTErrors] = useState<Record<string, string>>({});
  const [addedTeacher, setAddedTeacher] = useState<User | null>(null);

  const setT = (k: "name" | "email" | "title", v: string) => { setTForm((f) => ({ ...f, [k]: v })); setTErrors((e) => ({ ...e, [k]: "" })); };
  
  const openAddTeacher = () => {
    setTForm({ name: "", email: "", title: "", subjects: [], grades: ["10"] });
    setTErrors({});
    setAddedTeacher(null);
    setAddOpen(true);
  };

  const submitTeacher = () => {
    const e: Record<string, string> = {};
    if (!tForm.name.trim()) e.name = "Enter the teacher's full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tForm.email.trim())) e.email = "Enter a valid email address";
    if (tForm.subjects.length === 0) e.subjects = "Select at least one subject";
    if (tForm.grades.length === 0) e.grades = "Select at least one grade taught";
    setTErrors(e);
    if (Object.keys(e).length) return;

    const res = actions.addTeacher({
      name: tForm.name,
      email: tForm.email,
      subjects: tForm.subjects,
      grades: tForm.grades,
      title: tForm.title,
    });
    if (!res.ok || !res.teacher) { setTErrors({ email: res.error ?? "Could not add teacher" }); return; }
    setAddedTeacher(res.teacher);
    actions.toast(`${res.teacher.name} added with grades Class ${tForm.grades.join(", ")}`, { tone: "success" });
  };

  // Edit Teacher State
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [editTeacherForm, setEditTeacherForm] = useState({ name: "", email: "", title: "", subjects: [] as string[], grades: [] as string[] });
  const [editTeacherErrors, setEditTeacherErrors] = useState<Record<string, string>>({});

  const startEditTeacher = (t: User) => {
    setEditingTeacher(t);
    setEditTeacherForm({
      name: t.name,
      email: t.email,
      title: t.title,
      subjects: [...t.subjects],
      grades: t.grades ? [...t.grades] : ["9", "10"],
    });
    setEditTeacherErrors({});
  };

  const submitEditTeacher = () => {
    if (!editingTeacher) return;
    const e: Record<string, string> = {};
    if (!editTeacherForm.name.trim()) e.name = "Enter the teacher's full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editTeacherForm.email.trim())) e.email = "Enter a valid email address";
    if (editTeacherForm.subjects.length === 0) e.subjects = "Select at least one subject";
    if (editTeacherForm.grades.length === 0) e.grades = "Select at least one grade taught";
    setEditTeacherErrors(e);
    if (Object.keys(e).length) return;

    const res = actions.updateTeacher(editingTeacher.id, {
      name: editTeacherForm.name.trim(),
      email: editTeacherForm.email.trim().toLowerCase(),
      title: editTeacherForm.title.trim() || `${editTeacherForm.subjects.join(" & ")} teacher`,
      subjects: editTeacherForm.subjects,
      grades: editTeacherForm.grades,
    });
    if (!res.ok) {
      setEditTeacherErrors({ email: res.error ?? "Could not update teacher" });
      return;
    }
    actions.toast(`${editTeacherForm.name.trim()} updated successfully`, { tone: "success" });
    setEditingTeacher(null);
  };

  // Delete Teacher Confirmation State
  const [confirmDeleteTeacher, setConfirmDeleteTeacher] = useState<User | null>(null);

  // Assign Copies Drawer State
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("unassigned");
  const [assessmentId, setAssessmentId] = useState("");
  const [section, setSection] = useState("A");
  const [sourceTeacher, setSourceTeacher] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [deadline, setDeadlineValue] = useState("");
  const [selectedTeacherRow, setSelectedTeacherRow] = useState<{ teacher: User; assessment: Assessment } | null>(null);
  const [error, setError] = useState("");

  const assessments = state.assessments.filter((a) => state.sheets.some((s) => s.assessmentId === a.id));
  const activeAssessment = assessments.find((a) => a.id === assessmentId) ?? assessments[0];
  const teachers = state.users.filter((u) => u.role === "teacher" && (!activeAssessment || u.subjects.includes(activeAssessment.subject)));

  const eligible = (sheet: AnswerSheet) => {
    if (!activeAssessment || sheet.assessmentId !== activeAssessment.id || sheet.evaluation !== "evaluated") return false;
    if (scope === "unassigned") return sheet.teacherId === null;
    if (scope === "section") return sheet.teacherId === null && state.students.find((s) => s.id === sheet.studentId)?.section === section;
    return sheet.teacherId === sourceTeacher && sheet.verification !== "verified";
  };

  const selectedIds = state.sheets.filter(eligible).map((s) => s.id);

  const openDrawer = (preset?: { assessmentId?: string; sourceTeacher?: string }) => {
    const aid = preset?.assessmentId ?? assessments[0]?.id ?? "";
    const a = assessments.find((x) => x.id === aid);
    const filteredTeachers = state.users.filter((u) => u.role === "teacher" && (!a || u.subjects.includes(a.subject)));
    setAssessmentId(aid);
    setTeacherId(filteredTeachers[0]?.id ?? "");
    setDeadlineValue(a?.deadline ?? "");
    setScope(preset?.sourceTeacher ? "reassign" : "unassigned");
    setSourceTeacher(preset?.sourceTeacher ?? "");
    setSection(a?.sections[0] ?? "A");
    setError("");
    setOpen(true);
  };

  // Teacher Progress rows
  const teacherRows = useMemo(() => state.users.filter((u) => u.role === "teacher").flatMap((teacher) => state.assessments.filter((a) => !a.archived && a.teacherIds.includes(teacher.id)).map((assessment) => {
    const all = state.sheets.filter((s) => s.assessmentId === assessment.id && s.teacherId === teacher.id);
    const evaluated = all.filter((s) => s.evaluation === "evaluated");
    const pending = evaluated.filter((s) => s.verification !== "verified");
    const verified = evaluated.filter((s) => s.verification === "verified");
    const reopened = evaluated.filter((s) => s.verification === "reopened");
    const overdue = pending.filter(() => assessment.deadline && new Date(assessment.deadline).getTime() < now()).length;
    const dates = [
      ...state.audit.filter((e) => e.actorId === teacher.id).map((e) => e.at),
      ...all.flatMap((s) => [s.draftSavedAt, s.verifiedAt].filter((v): v is string => !!v)),
    ].sort((a, b) => b.localeCompare(a));
    return { teacher, assessment, assigned: all.length, pending: pending.length, verified: verified.length, reopened: reopened.length, overdue, completion: pct(verified.length, all.length), lastActivity: dates[0] };
  })).filter((r) => r.assigned > 0 || r.assessment.teacherIds.includes(r.teacher.id)), [state.users, state.assessments, state.sheets, state.audit]);

  const unassigned = state.sheets.filter((s) => s.evaluation === "evaluated" && !s.teacherId);

  return (
    <Page wide>
      <PageHeader
        title="Teacher Assignments &amp; Class Coverage"
        meta={<span>{state.users.filter((u) => u.role === "teacher").length} faculty members · Exam Cell</span>}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.toast(`Selected ${f.name} for teacher import`, { tone: "neutral" }); e.target.value = ""; }} />
            <Button variant="primary" icon={<UserPlus size={16} strokeWidth={ICON} />} onClick={openAddTeacher}>
              Add teacher
            </Button>
            <Button variant="secondary" icon={<Upload size={16} strokeWidth={ICON} />} onClick={() => fileRef.current?.click()}>
              Upload multiple teachers
            </Button>
            <Button variant="secondary" onClick={() => openDrawer()}>
              Assign copies
            </Button>
          </>
        }
      />

      {unassigned.length > 0 && (
        <Banner className="mb-4" tone="warning" title={`${unassigned.length} evaluated ${unassigned.length === 1 ? "copy is" : "copies are"} unassigned`} action={<Button size="sm" variant="secondary" onClick={() => openDrawer()}>Assign copies</Button>}>
          These copies need a teacher before verification can begin.
        </Banner>
      )}

      {/* Tabs: Teacher Directory first, then Evaluation Progress & Deadlines */}
      <Tabs
        className="mb-4"
        items={[
          { id: "directory", label: "Teacher Directory", count: state.users.filter((u) => u.role === "teacher").length },
          { id: "progress", label: "Evaluation Progress & Deadlines", count: teacherRows.length },
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as ViewTab)}
      />

      {/* Tab 1: Directory */}
      {activeTab === "directory" && (
        <Panel title="All teachers" flush>
          <Table>
            <thead>
              <tr>
                <Th sticky>Teacher</Th>
                <Th>Email</Th>
                <Th>Subjects</Th>
                <Th>Grades Taught</Th>
                <Th align="right">Active Exams</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {state.users.filter((u) => u.role === "teacher").map((t) => (
                <Tr key={t.id}>
                  <Td sticky>
                    <span className="flex items-center gap-2">
                      <Avatar name={t.name} initials={t.initials} size="sm" />
                      <span>
                        <span className="block font-medium text-ink">{t.name}</span>
                        <span className="text-xs text-ink-3">{t.title}</span>
                      </span>
                    </span>
                  </Td>
                  <Td>{t.email}</Td>
                  <Td>{t.subjects.join(", ")}</Td>
                  <Td>
                    {t.grades?.length ? (
                      <span className="inline-flex flex-wrap gap-1">
                        {t.grades.map((g) => (
                          <span key={g} className="rounded bg-subtle px-1.5 py-0.5 text-xs font-semibold text-ink-2">Class {g}</span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-ink-4">General</span>
                    )}
                  </Td>
                  <Td align="right">{state.assessments.filter((a) => !a.archived && a.teacherIds.includes(t.id)).length}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Edit2 size={13} strokeWidth={ICON} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditTeacher(t);
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
                          setConfirmDeleteTeacher(t);
                        }}
                        title={`Delete ${t.name}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {/* Tab 2: Progress & Workload */}
      {activeTab === "progress" && (
        <Panel title="Assignments and progress" flush>
          {teacherRows.length ? (
            <Table>
              <thead>
                <tr>
                  <Th sticky>Teacher</Th>
                  <Th>Exam</Th>
                  <Th align="right">Assigned</Th>
                  <Th align="right">Pending</Th>
                  <Th align="right">Verified</Th>
                  <Th align="right">Reopened</Th>
                  <Th className="w-36">Completion</Th>
                  <Th>Last activity</Th>
                  <Th align="right">Overdue</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {teacherRows.map((row) => (
                  <Tr key={`${row.teacher.id}-${row.assessment.id}`} onClick={() => setSelectedTeacherRow({ teacher: row.teacher, assessment: row.assessment })}>
                    <Td sticky>
                      <span className="flex items-center gap-2">
                        <Avatar name={row.teacher.name} initials={row.teacher.initials} size="sm" />
                        <span>
                          <span className="block font-medium text-ink">{row.teacher.name}</span>
                          <span className="text-xs text-ink-3">Class {row.teacher.grades?.join(", ") ?? "All"} · {row.teacher.subjects.join(", ")}</span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      {row.assessment.name}
                      <span className="block text-xs text-ink-3">Class {row.assessment.grade}</span>
                    </Td>
                    <Td align="right">{row.assigned}</Td>
                    <Td align="right">{row.pending}</Td>
                    <Td align="right">{row.verified}</Td>
                    <Td align="right">{row.reopened}</Td>
                    <Td>
                      <Progress value={row.completion} tone={row.completion === 100 ? "success" : "info"} label={`${row.completion}% complete`} />
                      <span className="mt-1 block text-xs text-ink-3">{row.completion}%</span>
                    </Td>
                    <Td>{row.lastActivity ? relTime(row.lastActivity) : <span className="text-ink-4">No activity</span>}</Td>
                    <Td align="right"><span className={row.overdue ? "font-medium text-danger" : "text-ink-3"}>{row.overdue || "–"}</span></Td>
                    <Td>
                      <Button size="sm" variant="ghost" disabled={!row.pending} onClick={(e) => { e.stopPropagation(); actions.remind(row.teacher.id, row.assessment.id, row.pending); actions.toast(`Reminder sent to ${row.teacher.name}`); }}>
                        Send reminder
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No teacher assignments" body="Assign evaluated copies to teachers to start verification." action={<Button variant="primary" onClick={() => openDrawer()}>Assign copies</Button>} />
          )}
        </Panel>
      )}

      {/* Add Teacher Drawer (with Grade selection) */}
      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={addedTeacher ? "Teacher added" : "Add teacher"}
        subtitle={addedTeacher ? undefined : "Specify subjects and classes taught by this teacher"}
        footer={
          addedTeacher ? (
            <>
              <Button onClick={openAddTeacher}>Add another</Button>
              <Button variant="primary" onClick={() => setAddOpen(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={submitTeacher}>Add teacher</Button>
            </>
          )
        }
      >
        {addedTeacher ? (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={addedTeacher.name} initials={addedTeacher.initials} size="lg" />
              <div>
                <p className="font-medium text-ink">{addedTeacher.name}</p>
                <p className="text-xs text-ink-3">{addedTeacher.title}</p>
              </div>
            </div>
            <dl className="divide-y divide-border rounded-md border border-border px-3 text-[13px]">
              <div className="flex justify-between py-2">
                <dt className="text-ink-3">Email</dt>
                <dd className="text-ink">{addedTeacher.email}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-ink-3">Subjects</dt>
                <dd className="text-ink">{addedTeacher.subjects.join(", ")}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-ink-3">Grades Taught</dt>
                <dd className="text-ink font-semibold">Class {addedTeacher.grades?.join(", ") ?? "All"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <form className="space-y-4 p-5" onSubmit={(ev) => { ev.preventDefault(); submitTeacher(); }}>
            <Field label="Full name" htmlFor="t-name" error={tErrors.name}>
              <Input id="t-name" autoFocus value={tForm.name} invalid={!!tErrors.name} onChange={(e) => setT("name", e.target.value)} placeholder="e.g. Meera Iyer" />
            </Field>
            <Field label="Email" htmlFor="t-email" error={tErrors.email}>
              <Input id="t-email" type="email" value={tForm.email} invalid={!!tErrors.email} onChange={(e) => setT("email", e.target.value)} placeholder="name@greenfield.edu.in" />
            </Field>

            {/* Requirement: Add Grade in Teacher Addition */}
            <Field label="Grades / Classes Taught" error={tErrors.grades} helper="Select the grades/classes this teacher instructs">
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_GRADES.map((g) => {
                  const on = tForm.grades.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setTForm((f) => ({
                          ...f,
                          grades: on ? f.grades.filter((x) => x !== g) : [...f.grades, g].sort((a, b) => Number(a) - Number(b)),
                        }));
                        setTErrors((er) => ({ ...er, grades: "" }));
                      }}
                      className={cx(
                        "rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors",
                        on ? "bg-primary text-white border-primary shadow-xs" : "bg-surface text-ink-2 border-border hover:bg-subtle"
                      )}
                    >
                      Class {g}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Subjects" error={tErrors.subjects} helper="Subjects matched to question papers and evaluation">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                {SUBJECTS.map((sub) => (
                  <label key={sub} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <Checkbox
                      checked={tForm.subjects.includes(sub)}
                      onChange={(on) => {
                        setTForm((f) => ({ ...f, subjects: on ? [...f.subjects, sub] : f.subjects.filter((x) => x !== sub) }));
                        setTErrors((er) => ({ ...er, subjects: "" }));
                      }}
                      label={sub}
                    />
                    {sub}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Designation / Title" htmlFor="t-title" optional>
              <Input id="t-title" value={tForm.title} onChange={(e) => setT("title", e.target.value)} placeholder="e.g. Senior Science teacher" />
            </Field>
          </form>
        )}
      </Drawer>

      {/* Edit Teacher Drawer */}
      <Drawer
        open={!!editingTeacher}
        onClose={() => setEditingTeacher(null)}
        title="Edit Teacher"
        subtitle={editingTeacher?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingTeacher(null)}>Cancel</Button>
            <Button variant="primary" onClick={submitEditTeacher}>Save Changes</Button>
          </div>
        }
      >
        {editingTeacher && (
          <form className="space-y-4 p-5" onSubmit={(ev) => { ev.preventDefault(); submitEditTeacher(); }}>
            <Field label="Full name" htmlFor="edit-t-name" error={editTeacherErrors.name}>
              <Input
                id="edit-t-name"
                value={editTeacherForm.name}
                invalid={!!editTeacherErrors.name}
                onChange={(e) => {
                  setEditTeacherForm((f) => ({ ...f, name: e.target.value }));
                  setEditTeacherErrors((err) => ({ ...err, name: "" }));
                }}
              />
            </Field>
            <Field label="Email" htmlFor="edit-t-email" error={editTeacherErrors.email}>
              <Input
                id="edit-t-email"
                type="email"
                value={editTeacherForm.email}
                invalid={!!editTeacherErrors.email}
                onChange={(e) => {
                  setEditTeacherForm((f) => ({ ...f, email: e.target.value }));
                  setEditTeacherErrors((err) => ({ ...err, email: "" }));
                }}
              />
            </Field>

            <Field label="Grades / Classes Taught" error={editTeacherErrors.grades} helper="Select the grades/classes this teacher instructs">
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_GRADES.map((g) => {
                  const on = editTeacherForm.grades.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setEditTeacherForm((f) => ({
                          ...f,
                          grades: on ? f.grades.filter((x) => x !== g) : [...f.grades, g].sort((a, b) => Number(a) - Number(b)),
                        }));
                        setEditTeacherErrors((er) => ({ ...er, grades: "" }));
                      }}
                      className={cx(
                        "rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors",
                        on ? "bg-primary text-white border-primary shadow-xs" : "bg-surface text-ink-2 border-border hover:bg-subtle"
                      )}
                    >
                      Class {g}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Subjects" error={editTeacherErrors.subjects} helper="Subjects taught by this teacher">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                {SUBJECTS.map((sub) => (
                  <label key={sub} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <Checkbox
                      checked={editTeacherForm.subjects.includes(sub)}
                      onChange={(on) => {
                        setEditTeacherForm((f) => ({
                          ...f,
                          subjects: on ? [...f.subjects, sub] : f.subjects.filter((x) => x !== sub),
                        }));
                        setEditTeacherErrors((er) => ({ ...er, subjects: "" }));
                      }}
                      label={sub}
                    />
                    {sub}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Designation / Title" htmlFor="edit-t-title" optional>
              <Input
                id="edit-t-title"
                value={editTeacherForm.title}
                onChange={(e) => setEditTeacherForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Senior Science teacher"
              />
            </Field>
          </form>
        )}
      </Drawer>

      {/* Delete Teacher Confirmation Dialog */}
      {confirmDeleteTeacher && (
        <Dialog
          open={!!confirmDeleteTeacher}
          onClose={() => setConfirmDeleteTeacher(null)}
          title="Delete Teacher"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDeleteTeacher(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const name = confirmDeleteTeacher.name;
                  const res = actions.deleteTeacher(confirmDeleteTeacher.id);
                  if (res.ok) {
                    actions.toast(`Deleted teacher ${name}`, { tone: "success" });
                  } else {
                    actions.toast(res.error ?? "Failed to delete teacher", { tone: "danger" });
                  }
                  setConfirmDeleteTeacher(null);
                }}
              >
                Delete Teacher
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-ink">
              Are you sure you want to delete <strong>{confirmDeleteTeacher.name}</strong> ({confirmDeleteTeacher.email})?
            </p>
            <p className="text-xs text-ink-3">
              Any exam answer sheets currently assigned to this teacher will be unassigned so they can be reassigned to another faculty member.
            </p>
          </div>
        </Dialog>
      )}

      {/* Copy Assignment Drawer */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Assign copies"
        subtitle="Choose the exam, copy scope and teacher."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!selectedIds.length || !teacherId}
              onClick={() => {
                const a = assessments.find((x) => x.id === assessmentId);
                const teacher = state.users.find((u) => u.id === teacherId);
                if (!a || !teacher) return;
                actions.assign(selectedIds, teacherId);
                if (deadline && deadline !== a.deadline) actions.setDeadline(a.id, deadline);
                actions.toast(`${selectedIds.length} copies assigned to ${teacher.name}`);
                setOpen(false);
              }}
            >
              Assign {selectedIds.length} copies
            </Button>
          </>
        }
      >
        <div className="space-y-5 p-5">
          <Field label="Exam">
            <Select
              value={assessmentId || activeAssessment?.id || ""}
              onChange={(e) => {
                const a = assessments.find((x) => x.id === e.target.value);
                setAssessmentId(e.target.value);
                setDeadlineValue(a?.deadline ?? "");
                setSection(a?.sections[0] ?? "A");
                setTeacherId(state.users.find((u) => u.role === "teacher" && a?.subject && u.subjects.includes(a.subject))?.id ?? "");
              }}
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>{a.name} · Class {a.grade} · {a.subject}</option>
              ))}
            </Select>
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[13px] font-medium text-ink">Copy scope</legend>
            <Radio
              name="scope"
              checked={scope === "unassigned"}
              onChange={() => setScope("unassigned")}
              label={`All unassigned copies (${state.sheets.filter((s) => s.assessmentId === (activeAssessment?.id ?? assessmentId) && s.evaluation === "evaluated" && !s.teacherId).length})`}
            />
            <Radio name="scope" checked={scope === "section"} onChange={() => setScope("section")} label="A section" description="Assign unassigned copies from one section." />
            {scope === "section" && (
              <Field label="Section">
                <Select value={section} onChange={(e) => setSection(e.target.value)}>
                  {(activeAssessment?.sections ?? []).map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            )}
            <Radio name="scope" checked={scope === "reassign"} onChange={() => setScope("reassign")} label="Reassign pending copies from a teacher" description="Verified copies stay with their current teacher." />
            {scope === "reassign" && (
              <Field label="Current teacher">
                <Select value={sourceTeacher} onChange={(e) => setSourceTeacher(e.target.value)}>
                  <option value="">Choose teacher</option>
                  {state.users.filter((u) => u.role === "teacher" && u.subjects.includes(activeAssessment?.subject ?? "")).map((t) => (
                    <option key={t.id} value={t.id}>{t.name} · {t.subjects.join(", ")}</option>
                  ))}
                </Select>
              </Field>
            )}
          </fieldset>
          <div className="rounded-md bg-subtle px-3 py-2.5">
            <p className="text-xs text-ink-3">Copies to assign</p>
            <p className="text-xl font-semibold tabular-nums text-ink">{selectedIds.length}</p>
          </div>
          <Field label="Teacher">
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Choose teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name} (Class {t.grades?.join(", ") ?? "All"}) · {t.subjects.join(", ")}</option>
              ))}
            </Select>
          </Field>
          <Field label="Verification deadline">
            <input type="date" value={deadline} onChange={(e) => setDeadlineValue(e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-ink" />
          </Field>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </Drawer>

      {/* Selected Teacher Details Drawer */}
      <Drawer
        open={!!selectedTeacherRow}
        onClose={() => setSelectedTeacherRow(null)}
        title={selectedTeacherRow?.teacher.name ?? "Teacher details"}
        subtitle={selectedTeacherRow ? `${selectedTeacherRow.assessment.name} · Class ${selectedTeacherRow.assessment.grade}` : undefined}
      >
        {selectedTeacherRow && (
          <div className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={selectedTeacherRow.teacher.name} initials={selectedTeacherRow.teacher.initials} size="lg" />
              <div>
                <p className="font-medium text-ink">{selectedTeacherRow.teacher.name}</p>
                <p className="text-xs text-ink-3">{selectedTeacherRow.teacher.subjects.join(", ")} · Class {selectedTeacherRow.teacher.grades?.join(", ") ?? "All"}</p>
              </div>
            </div>
            <dl className="divide-y divide-border rounded-md border border-border px-3">
              {(["Assigned", "Pending", "Verified", "Reopened"] as const).map((label) => {
                const copies = state.sheets.filter((s) => s.assessmentId === selectedTeacherRow.assessment.id && s.teacherId === selectedTeacherRow.teacher.id);
                const val = label === "Assigned" ? copies.length : label === "Pending" ? copies.filter((s) => s.evaluation === "evaluated" && s.verification !== "verified").length : label === "Verified" ? copies.filter((s) => s.verification === "verified").length : copies.filter((s) => s.verification === "reopened").length;
                return (
                  <div key={label} className="flex justify-between py-2 text-[13px]">
                    <dt className="text-ink-3">{label}</dt>
                    <dd className="font-medium tabular-nums text-ink">{val}</dd>
                  </div>
                );
              })}
            </dl>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                disabled={!state.sheets.some((s) => s.assessmentId === selectedTeacherRow.assessment.id && s.teacherId === selectedTeacherRow.teacher.id && s.verification !== "verified" && s.evaluation === "evaluated")}
                onClick={() => {
                  const r = selectedTeacherRow;
                  setSelectedTeacherRow(null);
                  openDrawer({ assessmentId: r.assessment.id, sourceTeacher: r.teacher.id });
                }}
              >
                Reassign pending copies
              </Button>
              <Button
                variant="danger-ghost"
                icon={<Trash2 size={14} strokeWidth={ICON} />}
                onClick={() => {
                  const t = selectedTeacherRow.teacher;
                  setSelectedTeacherRow(null);
                  setConfirmDeleteTeacher(t);
                }}
              >
                Delete faculty member
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  );
}
