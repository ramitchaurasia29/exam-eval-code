import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileUp, Upload, X } from "lucide-react";
import { useStore, type UploadInput } from "../data/store";
import { cohortOf } from "../data/selectors";
import { Button, ButtonLink, Field, ICON, Page, PageHeader, Panel, Progress, SearchInput, Select, Segmented } from "../components/ui";

type Mode = "bulk" | "individual";
export default function BulkUpload() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const validAssessments = state.assessments.filter((a) => a.answerKey.status === "approved" && a.rubric.status === "approved");
  const [assessmentId, setAssessmentId] = useState(params.get("assessment") && validAssessments.some((a) => a.id === params.get("assessment")) ? params.get("assessment")! : validAssessments[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("bulk");
  const [section, setSection] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const a = state.assessments.find((x) => x.id === assessmentId);
  const cohort = useMemo(() => a ? cohortOf(a, state.students) : [], [a, state.students]);
  const matches = cohort.filter((s) => `${s.name} ${s.roll} ${s.admissionNo} ${s.barcode}`.toLowerCase().includes(studentQuery.trim().toLowerCase())).slice(0, 8);
  const onFile = (chosen?: File) => { setFile(chosen ?? null); setError(""); };
  const start = () => {
    setError("");
    if (!a) { setError("Choose an approved assessment"); return; }
    if (!file) { setError("Choose a PDF file"); return; }
    if (!/\.pdf$/i.test(file.name)) { setError("Upload a PDF file"); return; }
    if (file.size > 500 * 1024 * 1024) { setError("PDF files must be 500 MB or smaller"); return; }
    if (file.name.toLowerCase().includes("protected")) { setError("This PDF is password-protected. Remove the password and upload again"); return; }
    if (mode === "individual" && !studentId) { setError("Choose a student in this assessment cohort"); return; }
    if (mode === "bulk" && !section) { setError("Choose a section"); return; }
    setUploading(true); setPercent(0);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const value = Math.min(100, Math.round(((Date.now() - started) / 1500) * 100));
      setPercent(value);
      if (value >= 100) {
        window.clearInterval(timer);
        const input: UploadInput = { assessmentId: a.id, fileName: file.name, kind: mode, sizeMb: Math.max(0.1, file.size / (1024 * 1024)), ...(mode === "bulk" ? { section } : { studentId }) };
        const result = actions.startUpload(input);
        setUploading(false);
        if (!result.ok) setError(result.error);
        else { actions.toast("Upload started", { tone: "success" }); navigate(`/uploads/${result.id}`); }
      }
    }, 40);
  };
  return <Page>
    <PageHeader title="New upload" crumbs={[{ label: "Uploads", to: "/uploads" }, { label: "New upload" }]} />
    <div className="mx-auto max-w-[720px]">
      <Panel>
        <div className="mb-5"><Segmented items={[{ id: "bulk", label: "Bulk PDF" }, { id: "individual", label: "Individual copy" }]} value={mode} onChange={(v) => { setMode(v); setStudentId(""); setError(""); }} /></div>
        <div className="space-y-5">
          <Field label="Assessment" htmlFor="assessment" error={!assessmentId ? "Choose an approved assessment" : error && (error.toLowerCase().includes("assessment") || error.toLowerCase().includes("approved") ? error : undefined)}>
            <Select id="assessment" value={assessmentId} onChange={(e) => { setAssessmentId(e.target.value); setSection(""); setStudentId(""); setError(""); }}>
              <option value="">Choose assessment</option>{state.assessments.map((item) => { const approved = item.answerKey.status === "approved" && item.rubric.status === "approved"; return <option key={item.id} value={item.id} disabled={!approved}>{item.name} · Class {item.grade}{approved ? "" : " · Rubric not approved"}</option>; })}
            </Select>
          </Field>
          {mode === "bulk" ? <Field label="Section in this PDF" htmlFor="section" helper={a ? `One PDF with booklets for Class ${a.grade}` : undefined} error={error.toLowerCase().includes("section") ? error : undefined}>
            <Select id="section" value={section} onChange={(e) => setSection(e.target.value)}><option value="">Choose section</option>{a?.sections.map((s) => <option key={s} value={s}>Section {s}</option>)}</Select>
          </Field> : <Field label="Student" helper="Search this assessment's cohort by name, roll, admission number or barcode" error={error && (error.toLowerCase().includes("student") || error.toLowerCase().includes("class") || error.toLowerCase().includes("copy") || error.toLowerCase().includes("cohort") ? error : undefined)}>
            {studentId ? <div className="flex items-center justify-between rounded-md border border-primary bg-primary-soft px-3 py-2"><span className="text-sm font-medium text-ink">{state.students.find((s) => s.id === studentId)?.name} · Class {state.students.find((s) => s.id === studentId)?.grade}{state.students.find((s) => s.id === studentId)?.section}, roll {state.students.find((s) => s.id === studentId)?.roll}</span><Button size="sm" variant="ghost" onClick={() => setStudentId("")} icon={<X size={15} strokeWidth={ICON} />}>Change</Button></div> : <><SearchInput label="Search students" value={studentQuery} onChange={setStudentQuery} placeholder="Name, roll, admission no or barcode" />{studentQuery && <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface">{matches.map((s) => <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setStudentQuery(""); }} className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left last:border-0 hover:bg-subtle"><span className="text-sm font-medium text-ink">{s.name}</span><span className="text-xs text-ink-3">Class {s.grade}{s.section} · Roll {s.roll} · {s.admissionNo}</span></button>)}{matches.length === 0 && <p className="p-3 text-sm text-ink-3">No students in this cohort match.</p>}</div>}</>}</Field>}
          <Field label="PDF file" htmlFor="pdf-file" helper={mode === "bulk" ? `One PDF with many booklets · up to 500 MB · scan at ${state.settings.scanDpi} DPI with the barcode on the cover` : "One student's answer booklet in PDF format"} error={error && (error.includes("PDF") || error.includes("password") || error.includes("file") ? error : undefined)}>
            {!file ? <label htmlFor="pdf-file" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }} className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-subtle px-4 py-5 text-center hover:bg-muted"><Upload size={21} strokeWidth={ICON} className="mb-2 text-ink-3" /><span className="text-sm font-medium text-ink">Choose a PDF to upload</span><span className="mt-1 text-xs text-ink-3">PDF only · up to 500 MB</span><input id="pdf-file" type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /></label> : <div className="flex items-center gap-3 rounded-md border border-border bg-subtle px-3 py-2.5"><FileUp size={18} strokeWidth={ICON} className="shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink">{file.name}</span><span className="text-xs text-ink-3">{(file.size / (1024 * 1024)).toFixed(1)} MB</span></span><Button variant="ghost" size="sm" icon={<X size={15} strokeWidth={ICON} />} onClick={() => onFile()}>Remove</Button></div>}
          </Field>
          <p className="rounded-md bg-subtle px-3 py-2 text-xs text-ink-3">Sample filename: <span className="font-mono text-ink-2">{mode === "bulk" ? `Class${a?.grade ?? "{grade}"}_${a?.subject ?? "{Subject}"}_{type}_Sec${section || "{section}"}.pdf` : `${state.students.find((s) => s.id === studentId)?.name ?? "{Name}"}_${a?.name ?? "{assessment}"}.pdf`}</span> · {mode === "bulk" ? "about 72 MB" : "about 3.4 MB"}</p>
          {error && !["pdf", "password", "file", "student", "class", "copy", "cohort", "section", "assessment", "approved"].some((word) => error.toLowerCase().includes(word)) && <p className="text-xs text-danger" role="alert">{error}</p>}
          {uploading && <div className="space-y-1.5" role="status"><div className="flex justify-between text-xs text-ink-3"><span>Uploading {file?.name}…</span><span>{percent}%</span></div><Progress value={percent} label="Upload progress" /></div>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button onClick={() => navigate("/uploads")}>Cancel</Button><Button variant="primary" loading={uploading} icon={<FileUp size={15} strokeWidth={ICON} />} onClick={start}>Start processing</Button></div>
        </div>
      </Panel>
    </div>
  </Page>;
}
