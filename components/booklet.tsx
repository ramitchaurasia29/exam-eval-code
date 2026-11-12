/*
 * Signature components: the scanned booklet and its traceability.
 *  - Barcode: deterministic Code-128-looking bars for a booklet barcode
 *  - ScanPage: a rendered page of a student's handwritten booklet, with the active
 *    question's answer region outlined so every mark points back to ink on paper
 *  - Lifecycle: the four separate status dimensions of a copy as one compact strip
 *  - VerificationSeal: the verified / not-verified label used on result documents
 */
import type { ReactNode } from "react";
import { BadgeCheck, CheckCircle2, FileWarning, ShieldAlert } from "lucide-react";
import type { AnswerSheet, Assessment, Distribution, Student } from "../data/types";
import { hash } from "../data/seed";
import { latestDistribution, shortCodeOf, sheetTotal, type Tone } from "../data/selectors";
import { QRCodeSVG } from "qrcode.react";
import { cx } from "./ui";

/* QR code ------------------------------------------------------------- */
export function Barcode({
  value,
  height = 28,
  className,
  showText = true,
  showShortCode = false,
}: {
  value: string;
  height?: number;
  className?: string;
  showText?: boolean;
  showShortCode?: boolean;
}) {
  const short = shortCodeOf(value);
  return (
    <span className={cx("inline-flex flex-col items-center", className)}>
      <QRCodeSVG value={value} size={height} level="M" marginSize={0} className="fill-ink" aria-label={`QR code ${value}`} role="img" />
      {showText && <span className="mt-0.5 font-mono text-[9px] tracking-wider text-ink-2">{value}</span>}
      {showShortCode && (
        <span className="mt-0.5 rounded border border-border bg-muted px-1 font-mono text-[9px] font-semibold text-ink" title="4-character manual matching code">
          {short}
        </span>
      )}
    </span>
  );
}

/* Lifecycle strip ------------------------------------------------------ */
type SegState = "done" | "active" | "pending" | "warn" | "error";
const SEG: Record<SegState, string> = {
  done: "bg-primary",
  active: "bg-primary/40 animate-pulse-soft",
  pending: "bg-border-strong",
  warn: "bg-warning",
  error: "bg-danger",
};

export interface LifecycleInfo {
  segments: { label: string; state: SegState; text: string }[];
  /** the one status worth reading in a row */
  summary: { label: string; tone: Tone };
}

export function lifecycleOf(s: AnswerSheet, dists: Distribution[]): LifecycleInfo {
  const d = latestDistribution(s.id, dists);
  const evalSeg: SegState = s.evaluation === "evaluated" ? "done" : s.evaluation === "processing" || s.evaluation === "queued" ? "active" : s.evaluation === "failed" ? "error" : "warn";
  const verSeg: SegState = s.verification === "verified" ? "done" : s.verification === "reopened" ? "warn" : s.verification === "in_progress" ? "active" : "pending";
  const relSeg: SegState = !d ? "pending" : d.status === "failed" ? "error" : d.status === "skipped" ? "warn" : d.status === "sending" ? "active" : d.verified ? "done" : "warn";
  const segments = [
    { label: "Identified", state: "done" as SegState, text: "Mapped to student" },
    { label: "AI evaluated", state: evalSeg, text: s.evaluation === "evaluated" ? "AI evaluated" : s.evaluation === "processing" ? "Processing" : s.evaluation === "queued" ? "Queued" : s.evaluation === "failed" ? "Evaluation failed" : "Needs review" },
    { label: "Verified", state: verSeg, text: s.verification === "verified" ? "Verified by teacher" : s.verification === "reopened" ? "Reopened" : s.verification === "in_progress" ? "Review in progress" : "Not verified" },
    { label: "Released", state: relSeg, text: !d ? "Not sent" : d.status === "failed" ? "SMS failed" : d.status === "skipped" ? "No guardian phone" : d.status === "sending" ? "Sending" : d.verified ? "Sent to guardian" : "Sent, not verified" },
  ];
  let summary: LifecycleInfo["summary"];
  if (s.evaluation === "failed") summary = { label: "Evaluation failed", tone: "danger" };
  else if (s.evaluation === "needs_review") summary = { label: "Needs review", tone: "warning" };
  else if (s.evaluation !== "evaluated") summary = { label: s.evaluation === "queued" ? "Queued" : "Evaluating", tone: "info" };
  else if (d && d.status === "failed") summary = { label: "SMS failed", tone: "danger" };
  else if (d && d.status === "delivered" && !d.verified && s.verification !== "verified") summary = { label: "Released, not verified", tone: "warning" };
  else if (s.verification === "reopened") summary = { label: "Reopened", tone: "warning" };
  else if (d && d.status === "delivered") summary = { label: "Released", tone: "success" };
  else if (s.verification === "verified") summary = { label: "Verified", tone: "success" };
  else if (s.verification === "in_progress") summary = { label: "Review in progress", tone: "info" };
  else summary = { label: "Pending verification", tone: "neutral" };
  return { segments, summary };
}

export function Lifecycle({ sheet, dists, className, size = "sm" }: { sheet: AnswerSheet; dists: Distribution[]; className?: string; size?: "sm" | "lg" }) {
  const info = lifecycleOf(sheet, dists);
  if (size === "lg") {
    return (
      <ol className={cx("grid grid-cols-4 gap-1.5", className)} aria-label="Copy lifecycle">
        {info.segments.map((s) => (
          <li key={s.label} className="min-w-0">
            <div className={cx("h-1 rounded-full", SEG[s.state])} />
            <p className="mt-1.5 truncate text-[11px] font-medium text-ink-3">{s.label}</p>
            <p className={cx("truncate text-xs", s.state === "error" ? "text-danger" : s.state === "warn" ? "text-warning" : s.state === "pending" ? "text-ink-3" : "text-ink")}>{s.text}</p>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <span className={cx("inline-flex items-center gap-[3px]", className)} title={info.segments.map((s) => `${s.label}: ${s.text}`).join("\n")} aria-label={info.segments.map((s) => `${s.label}: ${s.text}`).join(", ")} role="img">
      {info.segments.map((s) => (
        <span key={s.label} className={cx("h-[5px] w-3.5 rounded-full", SEG[s.state])} />
      ))}
    </span>
  );
}

/* Verification seal ----------------------------------------------------- */
export function VerificationSeal({ verified, teacher, at, className }: { verified: boolean; teacher?: string; at?: string; className?: string }) {
  if (verified)
    return (
      <div className={cx("flex items-center gap-2.5 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-success", className)}>
        <BadgeCheck size={18} strokeWidth={2} />
        <div className="text-[13px] leading-tight">
          <p className="font-semibold">Verified by teacher</p>
          {(teacher || at) && <p className="text-xs text-ink-2">{[teacher, at].filter(Boolean).join(" · ")}</p>}
        </div>
      </div>
    );
  return (
    <div className={cx("flex items-center gap-2.5 rounded-md border-2 border-warning bg-warning-soft px-3 py-2 text-warning", className)} role="note">
      <ShieldAlert size={18} strokeWidth={2} />
      <p className="text-[13px] font-bold leading-tight tracking-wide">NOT VERIFIED BY TEACHER · PROVISIONAL AI EVALUATION</p>
    </div>
  );
}

/* Scanned page ----------------------------------------------------------- */
function HeartSketch() {
  return (
    <svg viewBox="0 0 220 150" className="my-1 h-[7em] w-auto stroke-pen" fill="none" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      <path d="M110 140 C40 100 30 50 70 35 C90 28 105 40 110 55 C115 40 130 28 150 35 C190 50 180 100 110 140Z" />
      <path d="M110 55 L110 135" strokeDasharray="3 3" />
      <path d="M62 78 L158 78" strokeDasharray="3 3" />
      <path d="M95 30 C95 10 120 8 125 25" />
      <path d="M78 34 L70 8" />
      <path d="M150 60 L195 52" />
      <path d="M86 100 l8 8 m-8 0 l8 -8" />
    </svg>
  );
}
function RaySketch() {
  return (
    <svg viewBox="0 0 220 120" className="my-1 h-[6em] w-auto stroke-pen" fill="none" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      <rect x="60" y="30" width="100" height="60" />
      <path d="M20 5 L80 30 L130 90 L190 115" />
      <path d="M80 15 L80 50" strokeDasharray="3 3" />
      <path d="M130 75 L130 105" strokeDasharray="3 3" />
    </svg>
  );
}
function TriangleSketch() {
  return (
    <svg viewBox="0 0 200 120" className="my-1 h-[6em] w-auto stroke-pen" fill="none" strokeWidth={1.6} aria-hidden>
      <circle cx="70" cy="60" r="40" />
      <path d="M180 60 L70 20 M180 60 L70 100 M70 20 L70 100 M70 60 L180 60" />
    </svg>
  );
}

export type BookletViewMode = "checked" | "original";

export function ScanPage({
  sheet,
  student,
  assessment,
  page,
  activeQid,
  onSelect,
  zoom = 1,
  rotate = 0,
  thumb,
  viewMode = "checked",
}: {
  sheet: AnswerSheet;
  student: Student;
  assessment: Assessment;
  page: number;
  activeQid?: string;
  onSelect?: (qid: string) => void;
  zoom?: number;
  rotate?: number;
  thumb?: boolean;
  viewMode?: BookletViewMode;
}) {
  const blank = sheet.blankPages.includes(page);
  const missing = sheet.missingPages.includes(page);
  const evals = sheet.questions.filter((qe) => qe.page === page);
  const qOf = (qid: string) => assessment.questions.find((qq) => qq.id === qid);
  const fs = (thumb ? 3.2 : 13) * zoom;
  const isCheckedMode = viewMode === "checked";

  if (missing)
    return (
      <div className="flex aspect-[1/1.414] w-full flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-warning/60 bg-warning-soft/40 text-center text-warning" style={{ fontSize: thumb ? 8 : 13 }}>
        <FileWarning size={thumb ? 14 : 28} strokeWidth={1.75} />
        {!thumb && <p className="font-semibold">Page {page} missing from the scan</p>}
        {!thumb && <p className="max-w-[60%] text-xs text-ink-2">Answers expected on this page couldn't be located. Rescan the booklet or mark the questions as not attempted.</p>}
      </div>
    );

  const sketchFor = (qid: string): ReactNode => {
    const qq = qOf(qid);
    let sketch: ReactNode = null;
    if (!qq || qq.type !== "diagram") {
      if (qq?.id === "sci-q10") sketch = <RaySketch />;
      else if (qq?.id === "mat-q07" || qq?.id === "mat-q05") sketch = <TriangleSketch />;
    } else {
      sketch = <HeartSketch />;
    }
    if (!sketch) return null;
    return (
      <div className="relative inline-block">
        {sketch}
        {isCheckedMode && !thumb && (
          <span className="absolute -top-1 -right-2 rounded border border-red-300 bg-red-50/90 px-1 py-0.5 font-hand text-[0.8em] font-bold text-red-600 shadow-xs select-none">
            ✓ Diagram verified
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={cx("relative w-full overflow-hidden bg-paper shadow-page", thumb ? "rounded-[2px]" : "rounded-sm")}
      style={{ aspectRatio: "1 / 1.414", transform: rotate ? `rotate(${rotate}deg)` : undefined, transition: "transform 200ms ease-out" }}
      aria-label={`Booklet page ${page} of ${sheet.pages}`}
    >
      {/* ruling */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent calc(1.9em - 1px), var(--color-paper-line) calc(1.9em - 1px), var(--color-paper-line) 1.9em)",
          backgroundPosition: "0 4.5em",
          fontSize: fs,
        }}
      />
      <div aria-hidden className="absolute inset-y-0 w-px bg-paper-margin" style={{ left: "11%" }} />
      <div className="relative h-full" style={{ fontSize: fs, padding: "1.2em 1.4em 1.2em 13%" }}>
        {/* Booklet header strip */}
        <div className="mb-[0.6em] flex items-start justify-between gap-2 border-b border-ink/15 pb-[0.4em] font-sans text-ink-2" style={{ fontSize: "0.62em" }}>
          <div className="min-w-0">
            <p className="truncate font-semibold uppercase tracking-wide text-ink">Greenfield Public School · {student.city || "Bengaluru"}</p>
            <p className="truncate">{assessment.name} · Class {assessment.grade} {student.section}</p>
          </div>
          <div className="text-right">
            {page === 1 && !thumb ? <Barcode value={student.barcode} height={40} showShortCode /> : <span className="font-mono">Page {page}</span>}
          </div>
        </div>

        {page === 1 && (
          <div className="mb-[0.5em] grid grid-cols-2 gap-x-[1em] gap-y-[0.3em] font-sans text-ink-3" style={{ fontSize: "0.66em" }}>
            <p>Student name: <span className="font-hand text-pen" style={{ fontSize: "1.4em" }}>{student.name}</span></p>
            <p>Roll no: <span className="font-hand text-pen" style={{ fontSize: "1.4em" }}>{student.roll}</span></p>
            <p>Grade / Class: <span className="font-hand text-pen" style={{ fontSize: "1.4em" }}>Class {student.grade}</span></p>
            <p>Section: <span className="font-hand text-pen" style={{ fontSize: "1.4em" }}>{student.section}</span></p>
            <p>City: <span className="font-hand text-pen" style={{ fontSize: "1.4em" }}>{student.city || "Bengaluru"}</span></p>
            <p>Exam name: <span className="font-hand text-pen" style={{ fontSize: "1.4em" }}>{assessment.name}</span></p>
          </div>
        )}

        {/* Evaluation Seal / Original Header Banner */}
        {page === 1 && !thumb && (
          isCheckedMode ? (
            <div className="mb-[0.6em] flex items-center justify-between rounded border-2 border-red-600/80 bg-red-50/70 px-[0.7em] py-[0.4em] text-red-700 shadow-xs -rotate-0.5 select-none" style={{ fontSize: "0.68em" }}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-600 font-mono text-[9px] font-bold text-red-600">
                  AI✓
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-sans font-bold uppercase tracking-wider text-red-800">Checked Student Copy</span>
                    <span className="rounded bg-red-600 px-1 py-0.2 text-[9px] font-semibold text-white">EVALUATED</span>
                  </div>
                  <p className="font-sans text-[10px] text-red-600/90">
                    Greenfield Exam Cell · AI Evaluation Engine · {sheet.verification === "verified" ? "Verified by Teacher" : "Provisional AI Evaluation"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-sans text-[9px] uppercase tracking-wider text-red-600/80 block">Grand Total</span>
                <span className="font-hand text-[1.6em] font-bold text-red-600 leading-none">
                  {sheetTotal(sheet)} / {assessment.totalMarks}
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-[0.5em] flex items-center justify-between rounded border border-border/80 bg-subtle/80 px-[0.7em] py-[0.3em] text-ink-3 select-none" style={{ fontSize: "0.66em" }}>
              <span className="font-sans font-medium uppercase tracking-wider text-ink-2">📄 Original Student Script (Unmarked Raw Scan)</span>
              <span className="font-sans text-[10px] text-ink-3">As submitted · Pristine student ink</span>
            </div>
          )
        )}

        {blank ? (
          <div className="flex h-[70%] items-center justify-center">
            {!thumb && <span className="rounded-sm bg-surface/80 px-2 py-1 font-sans text-xs text-ink-3">Blank page · flagged, kept in the copy</span>}
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "0.5em" }}>
            {evals.map((qe) => {
              const qq = qOf(qe.qid);
              const active = qe.qid === activeQid;
              const unreadable = qe.reason === "unreadable";
              return (
                <button
                  key={qe.qid}
                  type="button"
                  tabIndex={thumb || !onSelect ? -1 : 0}
                  onClick={() => onSelect?.(qe.qid)}
                  className={cx(
                    "relative block w-full rounded-[3px] text-left font-hand leading-[1.9em] text-pen outline-none transition-colors duration-150",
                    onSelect && !thumb && "cursor-pointer hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary-ring",
                    active && "bg-primary/[0.07] ring-2 ring-region",
                    isCheckedMode && !thumb && "border-b border-dashed border-red-200/60 pb-2 mb-1",
                  )}
                  style={{ padding: "0 0.4em" }}
                  aria-label={qq ? `Answer region for question ${qq.number}` : undefined}
                >
                  {/* Active question indicator */}
                  {active && !thumb && (
                    <span className="absolute -left-[0.2em] -top-[0.9em] rounded-sm bg-region px-1 font-sans text-[10px] font-semibold leading-4 text-on-primary">
                      Q{qq?.number}
                    </span>
                  )}

                  {/* Right Margin Red Circled Score (CBSE / Evaluator Style) */}
                  {isCheckedMode && qq && !thumb && (
                    <div className="absolute right-1 top-0.5 flex flex-col items-center pointer-events-none select-none z-10">
                      <div className="flex items-center gap-1">
                        <div className="flex h-6 min-w-6 px-1 items-center justify-center rounded-full border-2 border-red-600 bg-red-50/90 font-hand text-[0.88em] font-bold text-red-600 shadow-xs -rotate-6 leading-none">
                          {qe.awarded}/{qq.marks}
                        </div>
                        {qe.awarded === qq.marks ? (
                          <span className="font-hand text-sm font-black text-red-600">✓</span>
                        ) : qe.awarded === 0 ? (
                          <span className="font-hand text-xs font-black text-red-600">✗</span>
                        ) : (
                          <span className="font-hand text-[10px] font-bold text-red-500">½✓</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Question Number & Student Answer */}
                  <span className="font-semibold">Q{qq?.number}.</span>{" "}
                  <span className={cx("whitespace-pre-line", unreadable && "blur-[0.6px]")}>
                    {qe.extracted.replace(/^\[(Diagram|Ray diagram|Figure|Formal letter|Letter|Figure only)\]\s?/, "")}
                  </span>
                  {sketchFor(qe.qid)}

                  {/* Checked Mode Red Evaluator Annotations & Criteria Hits */}
                  {isCheckedMode && qq && !thumb && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 pt-0.5" style={{ fontSize: "0.72em" }}>
                      {qq.criteria.map((c) => {
                        const matched = qe.matched.includes(c.id);
                        return (
                          <span
                            key={c.id}
                            className={cx(
                              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-sans leading-none select-none",
                              matched
                                ? "border border-red-300 bg-red-50/90 text-red-700"
                                : "border border-dashed border-red-200 bg-surface/90 text-red-400"
                            )}
                          >
                            <span className="font-hand text-[1.15em] font-bold text-red-600">
                              {matched ? "✓" : "✗"}
                            </span>
                            <span className="font-medium">
                              {matched ? `+${c.marks}` : `0/${c.marks}`} {c.label}
                            </span>
                          </span>
                        );
                      })}
                      {qe.editReason && (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-800 font-sans">
                          <span>✎ Revised:</span> {qe.editReason}
                        </span>
                      )}
                      {qe.comment && (
                        <span className="inline-flex items-center gap-1 font-hand text-[1.05em] text-red-600 italic">
                          Teacher: "{qe.comment}"
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
            {evals.length === 0 && !thumb && <p className="font-hand text-pen/60">(rough work)</p>}
          </div>
        )}
      </div>
    </div>
  );
}
