import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../data/store";
import type { NewAssessmentInput } from "../data/store";
import { Avatar, Button, Checkbox, Field, Input, Panel, Select, Textarea, cx } from "../components/ui";
import { useScreenInit } from "../useScreenInit";

const subjects = ["Science", "Mathematics", "English", "Social Science", "Hindi", "Computer Science"];
const types = ["Unit test", "Midterm", "Final", "Pre-board", "Practice test"];
const sections = ["A", "B", "C", "D"];
type FormValues = { name: string; academicYear: string; grade: string; sections: string[]; subject: string; type: string; examDate: string; totalMarks: string; durationMin: string; instructions: string; teacherIds: string[] };
type Errors = Partial<Record<keyof FormValues, string>>;

export default function AssessmentCreate({ onCreated }: { onCreated: (id: string) => void }) {
  const { state, actions, me, role } = useStore();
  const init = useScreenInit();
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>({ name: "", academicYear: state.settings.academicYear, grade: "", sections: [], subject: "", type: "", examDate: "", totalMarks: "", durationMin: "", instructions: "", teacherIds: role === "teacher" ? [me.id] : [] });
  const [errors, setErrors] = useState<Errors>(() => init.showErrors ? { name: "Enter an exam name", grade: "Choose a class", sections: "Select at least one section", subject: "Choose a subject", type: "Choose an exam type", examDate: "Choose an exam date", totalMarks: "Enter a total greater than zero" } : {});
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const set = (key: keyof FormValues, value: string | string[]) => setValues((v) => ({ ...v, [key]: value }));
  const validate = (): Errors => ({
    ...(!values.name.trim() ? { name: "Enter an exam name" } : {}),
    ...(!values.academicYear.trim() ? { academicYear: "Enter an academic year" } : {}),
    ...(!values.grade ? { grade: "Choose a class" } : {}),
    ...(values.sections.length === 0 ? { sections: "Select at least one section" } : {}),
    ...(!values.subject ? { subject: "Choose a subject" } : {}),
    ...(!values.type ? { type: "Choose an exam type" } : {}),
    ...(!values.examDate ? { examDate: "Choose an exam date" } : {}),
    ...(!values.totalMarks || Number(values.totalMarks) <= 0 || !Number.isFinite(Number(values.totalMarks)) ? { totalMarks: "Enter a total greater than zero" } : {}),
    ...(values.durationMin && (Number(values.durationMin) <= 0 || !Number.isFinite(Number(values.durationMin))) ? { durationMin: "Enter a duration greater than zero" } : {}),
  });
  const submit = () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    const first = ["type", "name", "academicYear", "grade", "sections", "subject", "examDate", "totalMarks", "durationMin"].find((key) => nextErrors[key as keyof FormValues]);
    if (first) { window.setTimeout(() => refs.current[first]?.focus(), 0); return; }
    const input: NewAssessmentInput = {
      name: values.name.trim(), academicYear: values.academicYear.trim(), grade: values.grade, sections: values.sections,
      subject: values.subject, type: values.type, examDate: values.examDate, totalMarks: Number(values.totalMarks),
      ...(values.durationMin ? { durationMin: Number(values.durationMin) } : {}), ...(values.instructions.trim() ? { instructions: values.instructions.trim() } : {}),
      ...(role === "admin" ? { teacherIds: values.teacherIds } : { teacherIds: [me.id] }),
    };
    const id = actions.createAssessment(input);
    actions.toast("Exam created", { tone: "success" });
    onCreated(id);
  };
  const toggle = (key: keyof FormValues, val: string) => {
    const current = values[key] as string[];
    set(key, current.includes(val) ? current.filter((x) => x !== val) : [...current, val]);
  };
  const assignRef = (key: string) => (el: HTMLElement | null) => { refs.current[key] = el; };

  return <>
      <Panel title="Exam details">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <Field label="Exam type" htmlFor="assessment-type" error={errors.type}><Select id="assessment-type" ref={assignRef("type")} value={values.type} invalid={!!errors.type} onChange={(e) => set("type", e.target.value)}><option value="">Select type</option>{types.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Exam name" htmlFor="assessment-name" error={errors.name}><Input id="assessment-name" ref={assignRef("name")} value={values.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Science Midterm" /></Field>
          <Field label="Academic year" htmlFor="academic-year" error={errors.academicYear}><Input id="academic-year" ref={assignRef("academicYear")} value={values.academicYear} invalid={!!errors.academicYear} onChange={(e) => set("academicYear", e.target.value)} /></Field>
          <Field label="Class" htmlFor="grade" error={errors.grade}><Select id="grade" ref={assignRef("grade")} value={values.grade} invalid={!!errors.grade} onChange={(e) => set("grade", e.target.value)}><option value="">Select class</option>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={String(g)}>Class {g}</option>)}</Select></Field>
          <Field label="Sections" error={errors.sections}><div ref={assignRef("sections")} tabIndex={-1} className="flex flex-wrap gap-x-5 gap-y-2 pt-1">{sections.map((s) => <label key={s} className="flex items-center gap-2 text-[13px] text-ink-2"><Checkbox checked={values.sections.includes(s)} onChange={() => toggle("sections", s)} label={`Section ${s}`} />Section {s}</label>)}</div></Field>
          <Field label="Subject" htmlFor="subject" error={errors.subject}><Select id="subject" ref={assignRef("subject")} value={values.subject} invalid={!!errors.subject} onChange={(e) => set("subject", e.target.value)}><option value="">Select subject</option>{subjects.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exam date" htmlFor="exam-date" error={errors.examDate}><Input id="exam-date" ref={assignRef("examDate")} type="date" value={values.examDate} invalid={!!errors.examDate} onChange={(e) => set("examDate", e.target.value)} /></Field>
            <Field label="Total marks" htmlFor="total-marks" error={errors.totalMarks}><Input id="total-marks" ref={assignRef("totalMarks")} type="number" min="1" step="1" value={values.totalMarks} invalid={!!errors.totalMarks} onChange={(e) => set("totalMarks", e.target.value)} placeholder="e.g. 40" /></Field>
          </div>
          <Field label="Duration in minutes" htmlFor="duration" optional error={errors.durationMin}><Input id="duration" ref={assignRef("durationMin")} type="number" min="1" step="1" value={values.durationMin} invalid={!!errors.durationMin} onChange={(e) => set("durationMin", e.target.value)} placeholder="e.g. 90" /></Field>
          <Field label="Instructions" htmlFor="instructions" optional><Textarea id="instructions" rows={3} value={values.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Instructions shown with the question paper" /></Field>
          <Field label="Teachers" helper={role === "admin" ? "Select teachers who will review answer sheets." : undefined}>
            {role === "admin" ? (
              <div className="space-y-1.5 rounded-md border border-border p-3">
                {state.users
                  .filter((u) => u.role === "teacher")
                  .map((u) => {
                    const isSelected = values.teacherIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={cx(
                          "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors cursor-pointer",
                          isSelected ? "bg-primary-soft/40" : "hover:bg-subtle"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox checked={isSelected} onChange={() => toggle("teacherIds", u.id)} label={`Assign ${u.name}`} />
                          <Avatar name={u.name} initials={u.initials} size="sm" />
                          <div className="min-w-0 truncate">
                            <span className="font-medium text-ink">{u.name}</span>
                            {u.grades && u.grades.length > 0 && (
                              <span className="ml-2 text-xs text-ink-3">
                                Class {u.grades.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {u.grades && u.grades.length > 0 && (
                            <span
                              className={cx(
                                "rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                                values.grade && u.grades.includes(values.grade)
                                  ? "border-primary/40 bg-primary-soft text-primary font-semibold"
                                  : "border-border bg-subtle text-ink-3"
                              )}
                              title={`Teaches Class ${u.grades.join(", ")}`}
                            >
                              Class {u.grades.join(", ")}
                            </span>
                          )}
                          {u.subjects.map((sub) => {
                            const isMatch = values.subject === sub;
                            return (
                              <span
                                key={sub}
                                className={cx(
                                  "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
                                  isMatch
                                    ? "bg-primary text-on-primary shadow-xs"
                                    : "bg-muted text-ink-2"
                                )}
                              >
                                {sub}
                              </span>
                            );
                          })}
                        </div>
                      </label>
                    );
                  })}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md border border-border bg-subtle px-3 py-2 text-[13px] text-ink-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={me.name} initials={me.initials} size="sm" />
                  <span className="font-medium text-ink">{me.name}</span>
                  {me.grades && me.grades.length > 0 && (
                    <span className="text-xs text-ink-3">· Class {me.grades.join(", ")}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {me.grades && me.grades.length > 0 && (
                    <span className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
                      Class {me.grades.join(", ")}
                    </span>
                  )}
                  {me.subjects.map((sub) => (
                    <span key={sub} className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-ink-2">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Field>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => navigate(role === "admin" ? "/assessments" : "/teacher/assessments")}>Cancel</Button>
            <Button variant="primary" type="submit">Save and continue</Button>
          </div>
        </form>
      </Panel>
  </>;
}
