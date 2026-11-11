import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { AnswerSheet, Assessment, Distribution, Student, User } from "../data/types";
import { fmtDate, fmtDateTime, pct, sheetTotal } from "../data/selectors";
import { ScanPage, VerificationSeal } from "./booklet";
import { Button, ICON, Panel } from "./ui";

export default function ResultDocument({ sheet, distribution, audience, assessment, student, schoolName, users }: { sheet: AnswerSheet; distribution?: Distribution; audience: "student" | "guardian"; assessment: Assessment; student: Student; schoolName: string; users: User[] }) {
  const [showBooklet, setShowBooklet] = useState(false);
  const [page, setPage] = useState(1);
  const total = sheetTotal(sheet);
  const verified = distribution ? distribution.verified : sheet.verification === "verified";
  const teacher = users.find((u) => u.id === sheet.verifiedBy)?.name;
  return <article className="mx-auto w-full max-w-[860px] space-y-4">
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <header className="border-b border-border bg-subtle px-5 py-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{schoolName}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Examination Cell</h1>
        <p className="mt-1 text-sm text-ink-3">Official assessment result · {audience === "student" ? "Student copy" : "Guardian copy"}</p>
      </header>
      <div className="space-y-6 px-5 py-5 sm:px-8 sm:py-7">
        <VerificationSeal verified={verified} teacher={teacher} at={sheet.verifiedAt ? fmtDateTime(sheet.verifiedAt) : undefined} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Student</h2><p className="text-lg font-semibold text-ink">{student.name}</p><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]"><dt className="text-ink-3">Class / Section</dt><dd className="text-ink-2">{student.grade} / {student.section}</dd><dt className="text-ink-3">Roll number</dt><dd className="text-ink-2">{student.roll}</dd></dl></div>
          <div><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Assessment</h2><p className="text-lg font-semibold text-ink">{assessment.name}</p><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]"><dt className="text-ink-3">Subject</dt><dd className="text-ink-2">{assessment.subject}</dd><dt className="text-ink-3">Exam date</dt><dd className="text-ink-2">{fmtDate(assessment.examDate)}</dd><dt className="text-ink-3">Maximum marks</dt><dd className="text-ink-2">{assessment.totalMarks}</dd></dl></div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-md bg-subtle px-4 py-4 sm:px-5">
          <div><p className="text-xs text-ink-3">Final score</p><p className="mt-0.5 text-4xl font-semibold tracking-tight tabular-nums text-ink">{total}<span className="text-xl font-normal text-ink-3"> / {assessment.totalMarks}</span></p></div>
          <p className="text-2xl font-semibold tabular-nums text-primary">{pct(total, assessment.totalMarks)}%</p>
        </div>
      </div>
    </section>
    <Panel title="Question-wise marks" flush>
      <div className="hidden sm:block"><table className="w-full border-collapse text-sm"><thead><tr className="bg-subtle text-left text-xs text-ink-3"><th className="px-4 py-2.5 font-medium">Question</th><th className="px-4 py-2.5 text-right font-medium">Marks</th></tr></thead><tbody>{sheet.questions.map((qe) => { const q = assessment.questions.find((x) => x.id === qe.qid); return <tr key={qe.qid} className="border-t border-border"><td className="px-4 py-3 font-medium text-ink">Q{q?.number ?? qe.qid}</td><td className="px-4 py-3 text-right tabular-nums text-ink-2">{qe.awarded} / {q?.marks ?? 0}</td></tr>; })}</tbody></table></div>
      <div className="divide-y divide-border sm:hidden">{sheet.questions.map((qe) => { const q = assessment.questions.find((x) => x.id === qe.qid); return <div key={qe.qid} className="space-y-1.5 px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="font-medium text-ink">Question {q?.number ?? qe.qid}</span><span className="shrink-0 text-sm font-medium tabular-nums text-ink-2">{qe.awarded} / {q?.marks ?? 0}</span></div></div>; })}</div>
    </Panel>
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <button onClick={() => setShowBooklet((v) => !v)} aria-expanded={showBooklet} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"><span><span className="block text-sm font-semibold text-ink">View answer sheet</span><span className="mt-0.5 block text-xs text-ink-3">{sheet.pages} scanned pages · Read only</span></span><span className="text-sm font-medium text-primary">{showBooklet ? "Hide pages" : "Open pages"}</span></button>
      {showBooklet && <div className="border-t border-border bg-muted p-3 sm:p-5"><div className="mb-3 flex items-center justify-between"><Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft size={15} strokeWidth={ICON} />}>Previous page</Button><span className="text-xs tabular-nums text-ink-3">Page {page} of {sheet.pages}</span><Button size="sm" disabled={page >= sheet.pages} onClick={() => setPage((p) => p + 1)} iconRight={<ChevronRight size={15} strokeWidth={ICON} />}>Next page</Button></div><div className="mx-auto max-w-[520px]"><ScanPage sheet={sheet} student={student} assessment={assessment} page={page} /></div></div>}
    </section>
    <footer className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4 text-xs text-ink-3"><span>Result version {distribution?.version ?? sheet.version} · Sent {distribution ? fmtDate(distribution.sentAt) : "Not sent"}</span><Button onClick={() => window.print()} icon={<Download size={15} strokeWidth={ICON} />}>Download PDF</Button></footer>
  </article>;
}
