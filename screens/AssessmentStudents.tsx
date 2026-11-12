import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileUp, Upload } from "lucide-react";
import { useStore } from "../data/store";
import { BATCH_STAGES, EVAL_STAGES, EVAL_STATUS, VERIFY_STATUS, cohortOf, num, sheetTotal } from "../data/selectors";
import AssessmentHeader, { useAssessmentParam } from "../components/AssessmentHeader";
import { Banner, Button, ButtonLink, Drawer, EmptyState, ICON, Page, Panel, Progress, SearchInput, Select, StatStrip, StatusText, Table, Tag, Td, Th, Tr } from "../components/ui";
import BulkUpload from "./BulkUpload";

type Filter = "all" | "not_uploaded" | "absent" | "evaluating" | "evaluated" | "attention";

/** One assessment's students: who has uploaded, live evaluation progress, and bulk / single upload. */
export default function AssessmentStudents() {
  const { id } = useParams();
  const assessment = useAssessmentParam(id);
  const { state, actions, role, me } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [upload, setUpload] = useState<{ mode: "bulk" | "individual"; studentId?: string } | null>(null);

  const cohort = useMemo(() => assessment ? cohortOf(assessment, state.students).slice().sort((a, b) => a.section.localeCompare(b.section) || a.roll - b.roll) : [], [assessment, state.students]);
  if (!assessment) return <EmptyState className="py-24" title="Exam not found" body="It may have been removed or the link may be out of date." action={<ButtonLink to={role === "admin" ? "/assessments" : "/teacher/assessments"}>Back to exams</ButtonLink>} />;

  const sheetOf = new Map(state.sheets.filter((s) => s.assessmentId === assessment.id).map((s) => [s.studentId, s]));
  const absentSet = new Set(assessment.absentStudentIds ?? []);
  const ready = assessment.answerKey.status === "approved" && assessment.rubric.status === "approved";
  const activeBatches = state.batches.filter((b) => b.assessmentId === assessment.id && (b.status === "processing" || b.status === "paused"));
  const openUnmatched = state.unmatched.filter((u) => u.assessmentId === assessment.id && u.status === "open");
  const mine = (s?: { teacherId: string | null }) => role === "admin" || !s || s.teacherId === me.id || s.teacherId === null;

  const sheets = [...sheetOf.values()];
  const evaluating = sheets.filter((s) => s.evaluation === "queued" || s.evaluation === "processing").length;
  const evaluated = sheets.filter((s) => s.evaluation === "evaluated").length;
  const attention = sheets.filter((s) => s.evaluation === "failed" || s.evaluation === "needs_review").length;
  const absentCount = cohort.filter((st) => !sheetOf.has(st.id) && absentSet.has(st.id)).length;
  const notUploaded = Math.max(0, cohort.length - sheets.length - absentCount);

  const term = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const rows = cohort.filter((st) => {
    const sh = sheetOf.get(st.id);
    const isAbsent = !sh && absentSet.has(st.id);
    if (!mine(sh)) return false;
    if (section && st.section !== section) return false;
    if (term && ![st.name, String(st.roll), st.barcode].some((v) => v.toLowerCase().replace(/[^a-z0-9]/g, "").includes(term))) return false;
    if (filter === "not_uploaded") return !sh && !isAbsent;
    if (filter === "absent") return isAbsent;
    if (filter === "evaluating") return !!sh && (sh.evaluation === "queued" || sh.evaluation === "processing");
    if (filter === "evaluated") return sh?.evaluation === "evaluated";
    if (filter === "attention") return !!sh && (sh.evaluation === "failed" || sh.evaluation === "needs_review");
    return true;
  });

  const setupStep = assessment.questionsConfirmed ? (assessment.answerKey.status === "approved" ? "rubric" : "answer-key") : "paper";
  const uploadButtons = ready ? <>
    <Button icon={<FileUp size={15} strokeWidth={ICON} />} onClick={() => setUpload({ mode: "individual" })}>Upload single student</Button>
    <Button variant="primary" icon={<Upload size={15} strokeWidth={ICON} />} onClick={() => setUpload({ mode: "bulk" })}>Bulk upload</Button>
  </> : undefined;

  return <Page wide>
    <AssessmentHeader assessment={assessment} tab="students" actions={uploadButtons} />
    {!ready && <Banner tone="info" className="mb-4" title="Finish setup before uploading answer sheets" action={<ButtonLink size="sm" variant="secondary" to={`/assessments/${assessment.id}/create/${setupStep}`}>Continue setup</ButtonLink>}>The question paper, answer key and rubric need to be approved first.</Banner>}
    {activeBatches.map((b) => <Banner key={b.id} tone="info" className="mb-3" title={`${b.fileName} · ${b.status === "paused" ? "Paused" : BATCH_STAGES[Math.min(b.stage, BATCH_STAGES.length - 1)]}`}>
      <div className="mt-2 max-w-md"><Progress value={((b.stage + b.progress / 100) / BATCH_STAGES.length) * 100} label={`Upload ${b.fileName} progress`} /></div>
    </Banner>)}
    {openUnmatched.length > 0 && <Banner tone="warning" className="mb-4" title={`${num(openUnmatched.length)} unmatched ${openUnmatched.length === 1 ? "booklet" : "booklets"} are waiting for mapping`} action={<ButtonLink to="/unmatched" size="sm" variant="secondary">Map booklets</ButtonLink>}>Unmatched booklets are not evaluated until they are identified.</Banner>}
    <StatStrip className="mb-4" items={[
      { label: "Students", value: num(cohort.length) },
      { label: "Not uploaded", value: num(notUploaded), tone: notUploaded ? "danger" : "success" },
      { label: "Absent", value: num(absentCount), tone: absentCount ? "warning" : undefined },
      { label: "Evaluating", value: num(evaluating) },
      { label: "AI evaluated", value: num(evaluated), tone: evaluated ? "success" : undefined },
      { label: "Needs attention", value: num(attention), tone: attention ? "danger" : undefined },
    ]} />
    <Panel flush>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <SearchInput label="Search students" value={query} onChange={setQuery} placeholder="Name, roll no or QR ID" className="w-full sm:w-64" />
        <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-[150px]"><option value="">All sections</option>{assessment.sections.map((s) => <option key={s} value={s}>Section {s}</option>)}</Select>
        <Select aria-label="Status" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-[170px]">
          <option value="all">All statuses</option>
          <option value="not_uploaded">Not uploaded</option>
          <option value="absent">Absent</option>
          <option value="evaluating">Evaluating</option>
          <option value="evaluated">AI evaluated</option>
          <option value="attention">Needs attention</option>
        </Select>
        <span className="ml-auto text-xs text-ink-3">{num(rows.length)} of {num(cohort.length)}</span>
      </div>
      {rows.length === 0 ? <EmptyState title="No students match" body="Try another search or status." /> : <Table>
        <thead><tr><Th sticky>Student</Th><Th>QR ID</Th><Th>Evaluation</Th><Th>Teacher review</Th><Th align="right">Marks</Th><Th align="right">Action</Th></tr></thead>
        <tbody>{rows.map((st) => {
          const sh = sheetOf.get(st.id);
          const isAbsent = !sh && absentSet.has(st.id);
          const running = sh && (sh.evaluation === "queued" || sh.evaluation === "processing");
          return <Tr key={st.id} onClick={sh ? () => navigate(`/review/${sh.id}`) : undefined}>
            <Td sticky className="max-w-56"><span className="block truncate font-medium text-ink">{st.name}</span><span className="block text-xs text-ink-3">Roll no {st.roll} · Class {st.grade}{st.section}</span></Td>
            <Td mono>{st.barcode}</Td>
            <Td>{!sh ? (
              isAbsent ? <Tag tone="muted">Absent (AB)</Tag> : <Tag tone="warning">Not uploaded</Tag>
            ) : <div className="flex min-w-44 flex-col gap-1"><StatusText {...EVAL_STATUS[sh.evaluation]} />{running && <><Progress value={sh.evaluation === "queued" ? 0 : ((sh.stage + 1) / EVAL_STAGES.length) * 100} label={`${st.name} evaluation progress`} /><span className="text-xs text-ink-3">{sh.evaluation === "queued" ? "Waiting in queue" : EVAL_STAGES[Math.min(sh.stage, EVAL_STAGES.length - 1)]}</span></>}</div>}</Td>
            <Td>{sh && sh.evaluation === "evaluated" ? <StatusText {...VERIFY_STATUS[sh.verification]} /> : isAbsent ? <span className="text-xs text-ink-3">Exempt</span> : <span className="text-ink-3">–</span>}</Td>
            <Td align="right">{sh?.evaluation === "evaluated" ? `${num(sheetTotal(sh))}/${num(assessment.totalMarks)}` : isAbsent ? <span className="font-mono text-xs font-semibold text-ink-3">AB</span> : "–"}</Td>
            <Td align="right">{sh ? (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/review/${sh.id}`); }}>Open copy</Button>
            ) : isAbsent ? (
              <div className="flex items-center justify-end gap-1">
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); actions.toggleAbsent(assessment.id, st.id); actions.toast(`Marked ${st.name} present`); }}>Mark present</Button>
                {ready && <Button size="sm" icon={<Upload size={14} strokeWidth={ICON} />} onClick={(e) => { e.stopPropagation(); setUpload({ mode: "individual", studentId: st.id }); }}>Upload</Button>}
              </div>
            ) : (
              <div className="flex items-center justify-end gap-1">
                {ready && <Button size="sm" icon={<Upload size={14} strokeWidth={ICON} />} onClick={(e) => { e.stopPropagation(); setUpload({ mode: "individual", studentId: st.id }); }}>Upload</Button>}
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); actions.toggleAbsent(assessment.id, st.id); actions.toast(`Marked ${st.name} absent`); }} title="Mark student absent">Mark absent</Button>
              </div>
            )}</Td>
          </Tr>;
        })}</tbody>
      </Table>}
    </Panel>
    <Drawer open={!!upload} onClose={() => setUpload(null)} title="Upload answer sheets" subtitle={`${assessment.name} · Class ${assessment.grade}`} width="lg">
      {upload && <div className="p-5"><BulkUpload key={`${upload.mode}-${upload.studentId ?? ""}`} assessmentId={assessment.id} initialMode={upload.mode} initialStudentId={upload.studentId} onDone={() => setUpload(null)} onCancel={() => setUpload(null)} /></div>}
    </Drawer>
  </Page>;
}
