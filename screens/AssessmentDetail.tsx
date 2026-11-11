import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, FileUp, Send, ClipboardCheck } from "lucide-react";
import { QTYPE_LABEL, assessmentStatus, cohortOf, fmtDate, fmtDateTime, latestDistribution, num, pct, sheetTotal } from "../data/selectors";
import { useAssessmentParam, setupSteps } from "../components/AssessmentHeader";
import AssessmentHeader from "../components/AssessmentHeader";
import { Avatar, ButtonLink, EmptyState, Meta, Page, Panel, Progress, StatusText, Table, Td, Th, Tr } from "../components/ui";
import type { Assessment } from "../data/types";
import { useStore } from "../data/store";

function AssessmentSetup({ assessment }: { assessment: Assessment }) {
  const steps = setupSteps(assessment);
  const nextIndex = steps.findIndex((s) => !s.done);
  const to = (key: string) => `/assessments/${assessment.id}/setup/${key}`;
  const stepMeta = [
    { status: assessment.paper ? (assessment.questionsConfirmed ? "Question structure confirmed" : "Needs confirmation") : "Paper not uploaded", label: assessment.paper?.fileName },
    { status: assessment.answerKey.status === "approved" ? "Approved" : assessment.answerKey.status === "draft" ? "Draft ready" : "Not started", label: assessment.answerKey.mode ? `${assessment.answerKey.mode === "ai" ? "AI-generated" : "Manual"} answer key` : undefined },
    { status: assessment.rubric.status === "approved" ? "Approved" : assessment.rubric.status === "draft" ? "Draft ready" : "Not started", label: assessment.rubric.status === "draft" ? "Review criteria and marks" : undefined },
  ];
  return <Panel title="Setup">
    <ol className="space-y-3">
      {steps.map((step, i) => <li key={step.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-3 sm:flex-nowrap">
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-ink">{step.label}</span><span className="block truncate text-xs text-ink-3">{stepMeta[i].label ?? stepMeta[i].status}</span></span>
        <StatusText tone={step.done ? "success" : i === nextIndex ? "warning" : "muted"} label={step.done ? "Complete" : stepMeta[i].status} />
        <ButtonLink to={to(step.id)} variant={i === nextIndex ? "primary" : "secondary"} size="sm">{step.done ? "View" : i === nextIndex ? "Continue setup" : "Open"}</ButtonLink>
      </li>)}
    </ol>
  </Panel>;
}

export default function AssessmentDetail() {
  const { id } = useParams();
  const assessment = useAssessmentParam(id);
  const { state, role } = useStore();
  if (!assessment) return <EmptyState className="py-24" title="Exam not found" body="It may have been removed or the link may be out of date." action={<ButtonLink to={role === "admin" ? "/assessments" : "/teacher/assessments"}>Back to exams</ButtonLink>} />;
  const ready = assessmentStatus(assessment, state.sheets) !== "draft" && assessment.answerKey.status === "approved" && assessment.rubric.status === "approved";
  const ownSheets = state.sheets.filter((s) => s.assessmentId === assessment.id);
  const cohort = cohortOf(assessment, state.students);
  const unmatched = state.unmatched.filter((u) => u.assessmentId === assessment.id && u.status === "open");
  const evaluated = ownSheets.filter((s) => s.evaluation === "evaluated");
  const verified = ownSheets.filter((s) => s.verification === "verified");
  const released = ownSheets.filter((s) => latestDistribution(s.id, state.distributions)?.status === "delivered");
  const uploadBatches = state.batches.filter((b) => b.assessmentId === assessment.id);
  const teacherIds = Array.from(new Set([...assessment.teacherIds, ...ownSheets.map((s) => s.teacherId).filter((x): x is string => !!x)]));
  const bars = Array.from({ length: 10 }, (_, i) => ({ label: `${i * 10}–${(i + 1) * 10}%`, count: 0 }));
  evaluated.forEach((sheet) => {
    const scorePct = assessment.totalMarks ? Math.min(99.99, Math.max(0, (sheetTotal(sheet) / assessment.totalMarks) * 100)) : 0;
    bars[Math.min(9, Math.floor(scorePct / 10))].count += 1;
  });
  const approvedBy = (id?: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  const statusLabel: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "muted" }> = {
    processing: { label: "Processing", tone: "info" }, completed: { label: "Completed", tone: "success" }, partial: { label: "Partial", tone: "warning" }, failed: { label: "Failed", tone: "danger" }, paused: { label: "Paused", tone: "muted" },
  };
  const uploadReady = assessment.answerKey.status === "approved" && assessment.rubric.status === "approved";
  const headActions = role === "admin" ? <><ButtonLink to={`/distribution?assessment=${assessment.id}`} icon={<Send size={15} />}>Send results</ButtonLink>{uploadReady && <ButtonLink to={`/assessments/${assessment.id}/students`} variant="primary" icon={<FileUp size={15} />}>Upload answer sheets</ButtonLink>}</> : <ButtonLink to="/teacher/pending" variant="primary" icon={<ClipboardCheck size={15} />}>Review copies</ButtonLink>;

  return <Page wide>
    <AssessmentHeader assessment={assessment} tab="overview" actions={headActions} />
    {!ready ? <AssessmentSetup assessment={assessment} /> : <>
      <section aria-label="Exam pipeline" className="mb-5 overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
        <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Expected", value: cohort.length, note: `${assessment.sections.length ? `Class ${assessment.grade} ${assessment.sections.join(", ")}` : "No sections"}`, to: `/assessments/${assessment.id}/sheets` },
            { label: "Uploaded", value: ownSheets.length + unmatched.length, note: `${uploadBatches.length} ${uploadBatches.length === 1 ? "upload" : "uploads"}`, to: `/assessments/${assessment.id}/students` },
            { label: "Identified", value: ownSheets.length, note: unmatched.length ? `${num(unmatched.length)} need mapping` : "All identified", to: unmatched.length ? "/unmatched" : `/assessments/${assessment.id}/sheets`, warning: unmatched.length > 0 },
            { label: "AI evaluated", value: evaluated.length, note: `${num(ownSheets.filter((s) => s.evaluation === "queued" || s.evaluation === "processing").length)} in queue`, to: `/assessments/${assessment.id}/students` },
            { label: "Verified", value: verified.length, note: `${num(evaluated.length - verified.length)} not verified`, to: "/verification" },
            { label: "Distributed", value: released.length, note: "Latest SMS delivered", to: `/distribution?assessment=${assessment.id}` },
          ].map((f, i) => <li key={f.label} className={`relative border-border ${i > 0 ? "xl:border-l" : ""} ${i % 2 === 1 ? "border-l sm:border-l-0" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i >= 3 ? "sm:border-t xl:border-t-0" : ""} ${i % 3 !== 0 ? "sm:border-l" : ""}`}>
            <Link to={f.to} className="group flex h-full flex-col px-4 py-3.5 transition-colors hover:bg-subtle"><span className="text-xs text-ink-3">{f.label}</span><span className="mt-0.5 text-2xl font-semibold tabular-nums text-ink">{num(f.value)}</span><span className={`mt-0.5 text-xs ${f.warning ? "font-medium text-warning" : "text-ink-3"}`}>{f.note}</span></Link>{i < 5 && <ArrowRight size={14} className="absolute -right-[7px] top-1/2 z-10 -mt-[7px] hidden rounded-full bg-surface text-ink-4 xl:block" aria-hidden />}
          </li>)}
        </ol>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel title="Score distribution" actions={<span className="text-xs text-ink-3">{num(evaluated.length)} evaluated copies</span>}>
            {evaluated.length === 0 ? <p className="py-10 text-center text-[13px] text-ink-3">Scores will appear after copies are AI evaluated.</p> : <div className="h-[280px] w-full" role="img" aria-label="Histogram of final scores as a percentage of total marks">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={bars} margin={{ top: 8, right: 10, bottom: 24, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-28} textAnchor="end" label={{ value: "Score (% of total marks)", position: "insideBottom", offset: -18, fontSize: 11 }} />
                <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} label={{ value: "Copies", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} ${Number(value) === 1 ? "copy" : "copies"}`, "Evaluated"]} />
                <Bar dataKey="count" name="Copies" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart></ResponsiveContainer>
            </div>}
          </Panel>
          <Panel title="Questions" flush>
            <Table><thead><tr><Th>Question</Th><Th>Type</Th><Th align="right">Marks</Th><Th align="right">Average awarded</Th><Th align="right">Flagged</Th><Th align="right">Teacher edits</Th></tr></thead><tbody>
              {assessment.questions.map((q) => {
                const evals = evaluated.flatMap((s) => s.questions.filter((e) => e.qid === q.id));
                const average = evals.length ? evals.reduce((sum, e) => sum + e.awarded, 0) / evals.length : null;
                const flagged = evals.filter((e) => e.review && !e.edited && !e.accepted).length;
                const edited = evals.filter((e) => e.edited).length;
                return <Tr key={q.id}><Td className="font-medium text-ink">Q{q.number}</Td><Td>{QTYPE_LABEL[q.type]}</Td><Td align="right">{num(q.marks)}</Td><Td align="right">{average === null ? "—" : `${Math.round((average / q.marks) * 100)}%`}</Td><Td align="right">{num(flagged)}</Td><Td align="right">{num(edited)}</Td></Tr>;
              })}
            </tbody></Table>
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Teachers">
            {teacherIds.length === 0 ? <p className="text-[13px] text-ink-3">No teachers assigned.</p> : <ul className="space-y-4">{teacherIds.map((tid) => {
              const teacher = state.users.find((u) => u.id === tid);
              const assigned = ownSheets.filter((s) => s.teacherId === tid);
              const done = assigned.filter((s) => s.verification === "verified").length;
              return <li key={tid}><div className="mb-2 flex items-center gap-2"><Avatar name={teacher?.name ?? tid} initials={teacher?.initials} size="sm" /><span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{teacher?.name ?? tid}</span><span className="text-xs tabular-nums text-ink-3">{num(done)}/{num(assigned.length)}</span></div><Progress value={pct(done, assigned.length)} tone={assigned.length > 0 && done === assigned.length ? "success" : "info"} label={`${teacher?.name ?? tid} verified copies`} /><p className="mt-1.5 text-xs text-ink-3">{num(done)} verified · {num(assigned.length - done)} pending</p></li>;
            })}</ul>}
          </Panel>
          <Panel title="Uploads" flush>
            {uploadBatches.length === 0 ? <p className="px-4 py-5 text-[13px] text-ink-3">No answer sheets uploaded.</p> : <ul className="divide-y divide-border">{uploadBatches.map((b) => <li key={b.id}><Link to={`/assessments/${assessment.id}/students`} className="block px-4 py-3 hover:bg-subtle"><span className="block truncate text-[13px] font-medium text-ink">{b.fileName}</span><span className="mt-1 flex items-center justify-between gap-2"><span className="text-xs text-ink-3">{num(b.booklets)} booklets · {fmtDateTime(b.uploadedAt)}</span><StatusText {...statusLabel[b.status]} /></span></Link></li>)}</ul>}
          </Panel>
          <Panel title="Versions">
            <dl className="divide-y divide-border">
              {assessment.paperHistory.map((version) => <Meta key={`paper-${version.version}`} label={`Question paper v${version.version}`}><Link to={`/assessments/${assessment.id}/setup/paper`} className="max-w-40 truncate text-primary-ink hover:underline">{version.fileName}</Link></Meta>)}
              <Meta label={`Answer key v${assessment.answerKey.version || "—"}`}><span>{assessment.answerKey.mode ? `${assessment.answerKey.mode === "ai" ? "AI-generated" : "Manual"} · ` : ""}{assessment.answerKey.status === "approved" ? `Approved by ${approvedBy(assessment.answerKey.approvedBy)} · ${fmtDateTime(assessment.answerKey.approvedAt)}` : assessment.answerKey.status}</span></Meta>
              <Meta label={`Rubric v${assessment.rubric.version || "—"}`}><span>{assessment.rubric.status === "approved" ? `Approved by ${approvedBy(assessment.rubric.approvedBy)} · ${fmtDateTime(assessment.rubric.approvedAt)}` : assessment.rubric.status}</span></Meta>
              <Meta label="Verification deadline"><span>{assessment.deadline ? fmtDate(assessment.deadline) : "Not set"}</span></Meta>
            </dl>
          </Panel>
        </div>
      </div>
    </>}
  </Page>;
}
