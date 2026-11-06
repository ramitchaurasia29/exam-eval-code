import { useMemo, useState } from "react";
import { useStore } from "../data/store";
import { now, pct, relTime } from "../data/selectors";
import type { AnswerSheet, Assessment, User } from "../data/types";
import { Avatar, Banner, Button, Drawer, EmptyState, Field, Page, PageHeader, Panel, Progress, Radio, Select, Table, Td, Th, Tr } from "../components/ui";

type Scope = "unassigned" | "section" | "reassign";
export default function TeacherAssignment() {
  const { state, actions } = useStore();
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
  return <Page wide>
    <PageHeader title="Teachers" actions={<Button variant="primary" onClick={() => openDrawer()}>Assign copies</Button>} />
    {unassigned.length > 0 && <Banner className="mb-4" title={`${unassigned.length} evaluated ${unassigned.length === 1 ? "copy is" : "copies are"} unassigned`} action={<Button size="sm" variant="secondary" onClick={() => openDrawer()}>Assign copies</Button>}>These copies need a teacher before verification can begin.</Banner>}
    <Panel flush>
      {teacherRows.length ? <Table><thead><tr><Th sticky>Teacher</Th><Th>Assessment</Th><Th align="right">Assigned</Th><Th align="right">Pending</Th><Th align="right">Verified</Th><Th align="right">Reopened</Th><Th className="w-36">Completion</Th><Th>Last activity</Th><Th align="right">Overdue</Th><Th /></tr></thead><tbody>{teacherRows.map((row) => <Tr key={`${row.teacher.id}-${row.assessment.id}`} onClick={() => setSelectedTeacherRow({ teacher: row.teacher, assessment: row.assessment })}>
        <Td sticky><span className="flex items-center gap-2"><Avatar name={row.teacher.name} initials={row.teacher.initials} size="sm" /><span><span className="block font-medium text-ink">{row.teacher.name}</span><span className="text-xs text-ink-3">{row.teacher.subjects.join(", ")}</span></span></span></Td><Td>{row.assessment.name}<span className="block text-xs text-ink-3">Class {row.assessment.grade}</span></Td><Td align="right">{row.assigned}</Td><Td align="right">{row.pending}</Td><Td align="right">{row.verified}</Td><Td align="right">{row.reopened}</Td><Td><Progress value={row.completion} tone={row.completion === 100 ? "success" : "info"} label={`${row.completion}% complete`} /><span className="mt-1 block text-xs text-ink-3">{row.completion}%</span></Td><Td>{row.lastActivity ? relTime(row.lastActivity) : <span className="text-ink-4">No activity</span>}</Td><Td align="right"><span className={row.overdue ? "font-medium text-danger" : "text-ink-3"}>{row.overdue || "–"}</span></Td><Td><Button size="sm" variant="ghost" disabled={!row.pending} onClick={(e) => { e.stopPropagation(); actions.remind(row.teacher.id, row.assessment.id, row.pending); actions.toast(`Reminder sent to ${row.teacher.name}`); }}>Send reminder</Button></Td>
      </Tr>)}</tbody></Table> : <EmptyState title="No teacher assignments" body="Assign evaluated copies to teachers to start verification." action={<Button variant="primary" onClick={() => openDrawer()}>Assign copies</Button>} />}
    </Panel>

    <Drawer open={open} onClose={() => setOpen(false)} title="Assign copies" subtitle="Choose the assessment, copy scope and teacher." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!selectedIds.length || !teacherId} onClick={() => {
      const a = assessments.find((x) => x.id === assessmentId);
      const teacher = state.users.find((u) => u.id === teacherId);
      if (!a || !teacher) return;
      actions.assign(selectedIds, teacherId);
      if (deadline && deadline !== a.deadline) actions.setDeadline(a.id, deadline);
      actions.toast(`${selectedIds.length} copies assigned to ${teacher.name}`);
      setOpen(false);
    }}>Assign {selectedIds.length} copies</Button></>}>
      <div className="space-y-5 p-5">
        <Field label="Assessment"><Select value={assessmentId || activeAssessment?.id || ""} onChange={(e) => { const a = assessments.find((x) => x.id === e.target.value); setAssessmentId(e.target.value); setDeadlineValue(a?.deadline ?? ""); setSection(a?.sections[0] ?? "A"); setTeacherId(state.users.find((u) => u.role === "teacher" && a?.subject && u.subjects.includes(a.subject))?.id ?? ""); }}>{assessments.map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade} · {a.subject}</option>)}</Select></Field>
        <fieldset className="space-y-2"><legend className="mb-2 text-[13px] font-medium text-ink">Copy scope</legend>
          <Radio name="scope" checked={scope === "unassigned"} onChange={() => setScope("unassigned")} label={`All unassigned copies (${state.sheets.filter((s) => s.assessmentId === (activeAssessment?.id ?? assessmentId) && s.evaluation === "evaluated" && !s.teacherId).length})`} />
          <Radio name="scope" checked={scope === "section"} onChange={() => setScope("section")} label="A section" description="Assign unassigned copies from one section." />
          {scope === "section" && <Field label="Section"><Select value={section} onChange={(e) => setSection(e.target.value)}>{(activeAssessment?.sections ?? []).map((s) => <option key={s}>{s}</option>)}</Select></Field>}
          <Radio name="scope" checked={scope === "reassign"} onChange={() => setScope("reassign")} label="Reassign pending copies from a teacher" description="Verified copies stay with their current teacher." />
          {scope === "reassign" && <Field label="Current teacher"><Select value={sourceTeacher} onChange={(e) => setSourceTeacher(e.target.value)}><option value="">Choose teacher</option>{state.users.filter((u) => u.role === "teacher" && u.subjects.includes(activeAssessment?.subject ?? "")).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>}
        </fieldset>
        <div className="rounded-md bg-subtle px-3 py-2.5"><p className="text-xs text-ink-3">Copies to assign</p><p className="text-xl font-semibold tabular-nums text-ink">{selectedIds.length}</p></div>
        <Field label="Teacher"><Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}><option value="">Choose teacher</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.subjects.join(", ")}</option>)}</Select></Field>
        <Field label="Verification deadline"><input type="date" value={deadline} onChange={(e) => setDeadlineValue(e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-ink" /></Field>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Drawer>
    <Drawer open={!!selectedTeacherRow} onClose={() => setSelectedTeacherRow(null)} title={selectedTeacherRow?.teacher.name ?? "Teacher details"} subtitle={selectedTeacherRow ? `${selectedTeacherRow.assessment.name} · Class ${selectedTeacherRow.assessment.grade}` : undefined}>
      {selectedTeacherRow && <div className="space-y-5 p-5">
        <div className="flex items-center gap-3"><Avatar name={selectedTeacherRow.teacher.name} initials={selectedTeacherRow.teacher.initials} size="lg" /><div><p className="font-medium text-ink">{selectedTeacherRow.teacher.name}</p><p className="text-xs text-ink-3">{selectedTeacherRow.teacher.subjects.join(", ")}</p></div></div>
        <dl className="divide-y divide-border rounded-md border border-border px-3">{(["Assigned", "Pending", "Verified", "Reopened"] as const).map((label) => {
          const copies = state.sheets.filter((s) => s.assessmentId === selectedTeacherRow.assessment.id && s.teacherId === selectedTeacherRow.teacher.id);
          const val = label === "Assigned" ? copies.length : label === "Pending" ? copies.filter((s) => s.evaluation === "evaluated" && s.verification !== "verified").length : label === "Verified" ? copies.filter((s) => s.verification === "verified").length : copies.filter((s) => s.verification === "reopened").length;
          return <div key={label} className="flex justify-between py-2 text-[13px]"><dt className="text-ink-3">{label}</dt><dd className="font-medium tabular-nums text-ink">{val}</dd></div>;
        })}</dl>
        <Button variant="secondary" disabled={!state.sheets.some((s) => s.assessmentId === selectedTeacherRow.assessment.id && s.teacherId === selectedTeacherRow.teacher.id && s.verification !== "verified" && s.evaluation === "evaluated")} onClick={() => { const r = selectedTeacherRow; setSelectedTeacherRow(null); openDrawer({ assessmentId: r.assessment.id, sourceTeacher: r.teacher.id }); }}>Reassign pending copies</Button>
      </div>}
    </Drawer>
  </Page>;
}
