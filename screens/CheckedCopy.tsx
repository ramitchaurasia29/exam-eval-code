import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-react";
import { useStore } from "../data/store";
import { fmtDate, fmtDateTime, pct, sheetTotal } from "../data/selectors";
import { ScanPage, VerificationSeal } from "../components/booklet";
import { Banner, Button, EmptyState, ICON, Page, PageHeader, Panel, Progress, Tag, cx } from "../components/ui";

/** Read-only, parent-style checked copy: where every mark was earned or lost, with feedback. */
export default function CheckedCopy() {
  const { studentId, sheetId } = useParams();
  const { state } = useStore();
  const navigate = useNavigate();
  const sheet = state.sheets.find((s) => s.id === sheetId && s.studentId === studentId);
  const student = state.students.find((s) => s.id === studentId);
  const assessment = sheet && state.assessments.find((a) => a.id === sheet.assessmentId);
  const [page, setPage] = useState(1);
  const [activeQid, setActiveQid] = useState<string | undefined>();

  const rows = useMemo(() => {
    if (!sheet || !assessment) return [];
    return sheet.questions.map((qe) => {
      const q = assessment.questions.find((x) => x.id === qe.qid);
      const max = q?.marks ?? 0;
      return { qe, q, max, lost: Math.max(0, max - qe.awarded) };
    });
  }, [sheet, assessment]);

  if (!sheet || !student || !assessment) {
    return <Page><EmptyState title="Copy not found" body="This answer sheet may have been removed or belongs to a different student." action={<Button variant="primary" onClick={() => navigate("/students")}>Back to students</Button>} /></Page>;
  }

  const evaluated = sheet.evaluation === "evaluated";
  const total = sheetTotal(sheet);
  const lostRows = rows.filter((r) => r.lost > 0).sort((a, b) => b.lost - a.lost);
  const lostTotal = lostRows.reduce((t, r) => t + r.lost, 0);
  const verified = sheet.verification === "verified";
  const teacher = state.users.find((u) => u.id === sheet.verifiedBy)?.name;
  const jump = (qid: string, qPage: number) => {
    setActiveQid(qid);
    setPage(qPage);
    document.getElementById(`cq-${qid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return <Page wide className="print:p-0">
    <PageHeader
      crumbs={[{ label: "Students", to: "/students" }, { label: student.name, to: `/students?q=${encodeURIComponent(student.barcode)}` }, { label: "Checked copy" }]}
      title={`${assessment.name} · checked copy`}
      meta={<><span>{student.name}</span><span>Class {student.grade}{student.section} · Roll no {student.roll}</span><span>{assessment.subject} · {fmtDate(assessment.examDate)}</span></>}
      actions={<span className="print:hidden flex flex-wrap items-center gap-2">
        <Button icon={<ExternalLink size={15} strokeWidth={ICON} />} onClick={() => navigate(`/review/${sheet.id}`)}>Open in review workspace</Button>
        <Button variant="primary" icon={<Download size={15} strokeWidth={ICON} />} onClick={() => window.print()}>Download PDF</Button>
      </span>}
    />

    {!evaluated ? <Banner tone="info" title="Evaluation in progress">Marks and feedback appear here once this copy has been evaluated.</Banner> : <div className="space-y-5">
      <Panel>
        <div className="space-y-4">
          <VerificationSeal verified={verified} teacher={teacher} at={sheet.verifiedAt ? fmtDateTime(sheet.verifiedAt) : undefined} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-subtle px-4 py-3"><p className="text-xs text-ink-3">Marks scored</p><p className="mt-0.5 text-3xl font-semibold tabular-nums text-ink">{total}<span className="text-lg font-normal text-ink-3"> / {assessment.totalMarks}</span></p><p className="text-sm font-semibold tabular-nums text-primary">{pct(total, assessment.totalMarks)}%</p></div>
            <div className="rounded-md bg-subtle px-4 py-3"><p className="text-xs text-ink-3">Marks lost</p><p className={cx("mt-0.5 text-3xl font-semibold tabular-nums", lostTotal > 0 ? "text-danger" : "text-success")}>{lostTotal}</p><p className="text-sm text-ink-3">{lostRows.length === 0 ? "No marks lost" : `across ${lostRows.length} question${lostRows.length === 1 ? "" : "s"}`}</p></div>
          </div>
        </div>
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        <div className="min-w-0 space-y-5">
          <Panel title="Where marks were lost" flush>
            {lostRows.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-success">Full marks — no marks were lost on this copy.</p> : <ul className="divide-y divide-border">{lostRows.map(({ qe, q, max, lost }) => <li key={qe.qid}>
              <button type="button" onClick={() => jump(qe.qid, qe.page)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none">
                <span className="min-w-0"><span className="block text-[13px] font-medium text-ink">Question {q?.number ?? qe.qid}</span><span className="block truncate text-xs text-ink-3">{qe.feedback || qe.explanation || "See feedback below"}</span></span>
                <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums text-danger">−{lost}</span><span className="block text-xs tabular-nums text-ink-3">{qe.awarded} / {max}</span></span>
              </button>
            </li>)}</ul>}
          </Panel>

          <Panel title="Question-wise feedback" flush>
            <ul className="divide-y divide-border">{rows.map(({ qe, q, max, lost }) => {
              const full = lost === 0;
              const zero = qe.awarded === 0 && max > 0;
              const tone = full ? "success" : zero ? "danger" : "warning";
              return <li key={qe.qid} id={`cq-${qe.qid}`} className={cx("space-y-3 px-4 py-4 transition-colors", activeQid === qe.qid && "bg-primary/[0.04]")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-[13px] font-semibold text-ink">Question {q?.number ?? qe.qid}</p>{q && <p className="mt-0.5 text-[13px] text-ink-2">{q.text}</p>}</div>
                  <div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums text-ink">{qe.awarded} / {max}</p><Tag tone={tone}>{full ? "Full marks" : zero ? "No marks" : `−${lost} lost`}</Tag></div>
                </div>
                <Progress value={max ? (qe.awarded / max) * 100 : 0} tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"} label={`Question ${q?.number} score`} />
                {qe.extracted && <div className="rounded-md bg-subtle px-3 py-2"><p className="text-xs font-medium text-ink-3">Student's answer · page {qe.page}</p><p className="mt-0.5 whitespace-pre-line text-[13px] text-ink-2">{qe.extracted}</p></div>}
                {q && q.criteria.length > 0 && <ul className="space-y-1.5">{q.criteria.map((c) => { const met = qe.matched.includes(c.id); return <li key={c.id} className="flex items-start gap-2 text-[13px]">
                  <span className={cx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", met ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{met ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2.5} />}</span>
                  <span className={cx("flex-1", met ? "text-ink-2" : "text-ink")}>{c.label}</span>
                  <span className={cx("shrink-0 tabular-nums", met ? "text-success" : "text-danger")}>{met ? `+${c.marks}` : `−${c.marks}`}</span>
                </li>; })}</ul>}
                {(qe.feedback || qe.explanation || qe.comment) && <div className="space-y-1 border-l-2 border-primary/40 pl-3 text-[13px]">
                  {qe.feedback && <p className="text-ink"><span className="font-medium">Feedback: </span>{qe.feedback}</p>}
                  {qe.explanation && <p className="text-ink-2"><span className="font-medium">Why: </span>{qe.explanation}</p>}
                  {qe.comment && <p className="text-ink-2"><span className="font-medium">Teacher's note: </span>{qe.comment}</p>}
                </div>}
                <Button size="sm" className="print:hidden" onClick={() => jump(qe.qid, qe.page)}>View on page {qe.page}</Button>
              </li>;
            })}</ul>
          </Panel>

          {sheet.generalFeedback && <Panel title="Overall feedback"><p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{sheet.generalFeedback}</p></Panel>}
        </div>

        <div className="print:hidden lg:sticky lg:top-4">
          <Panel title="Answer sheet" actions={<span className="text-xs tabular-nums text-ink-3">Page {page} of {sheet.pages}</span>}>
            <div className="mb-3 flex items-center justify-between"><Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft size={15} strokeWidth={ICON} />}>Previous</Button><Button size="sm" disabled={page >= sheet.pages} onClick={() => setPage((p) => p + 1)} iconRight={<ChevronRight size={15} strokeWidth={ICON} />}>Next</Button></div>
            <div className="mx-auto max-w-[460px] rounded-md bg-muted p-3"><ScanPage sheet={sheet} student={student} assessment={assessment} page={page} activeQid={activeQid} onSelect={(qid) => { setActiveQid(qid); document.getElementById(`cq-${qid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} /></div>
          </Panel>
        </div>
      </div>
    </div>}
  </Page>;
}
