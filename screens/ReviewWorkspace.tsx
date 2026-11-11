/*
 * UI-15 Teacher PDF review workspace, UI-16 question-level marks, UI-17 feedback,
 * UI-18 similar correction suggestions.
 * Split view: the scanned booklet on the left, marking on the right. The active
 * question's answer region is outlined on the page so every mark traces to ink.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flag,
  History,
  Lock,
  Minus,
  Plus,
  RotateCw,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useStore } from "../data/store";
import type { AnswerSheet, QuestionEval } from "../data/types";
import {
  EVAL_STAGES,
  QTYPE_LABEL,
  REVIEW_REASON,
  fmtDateTime,
  relTime,
  sheetAiTotal,
  sheetTotal,
} from "../data/selectors";
import { Barcode, Lifecycle, ScanPage } from "../components/booklet";
import { useGuardedNavigate, useNavGuard } from "../components/Shell";
import {
  Banner,
  Button,
  Checkbox,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  ICON,
  IconButton,
  Kbd,
  Segmented,
  Tag,
  Textarea,
  cx,
} from "../components/ui";
import { useScreenInit } from "../useScreenInit";

type Pane = "sheet" | "marking";
type RightTab = "questions" | "history";

export default function ReviewWorkspace() {
  const { sheetId } = useParams();
  const init = useScreenInit();
  const { state, actions, me } = useStore();
  const go = useGuardedNavigate();
  const sheet = state.sheets.find((s) => s.id === sheetId);
  const assessment = sheet ? state.assessments.find((a) => a.id === sheet.assessmentId) : undefined;
  const student = sheet ? state.students.find((s) => s.id === sheet.studentId) : undefined;

  const [activeQid, setActiveQid] = useState<string>(() => (init.activeQid as string) ?? "");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [pane, setPane] = useState<Pane>("marking");
  const [tab, setTab] = useState<RightTab>((init.tab as RightTab) ?? "questions");
  const [verifyOpen, setVerifyOpen] = useState(!!init.verifyOpen);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [similarOpen, setSimilarOpen] = useState(!!init.similarOpen);
  const [justVerified, setJustVerified] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Snapshot for "discard changes"
  const snapshot = useRef<AnswerSheet | null>(null);
  useEffect(() => {
    if (sheet && (!snapshot.current || snapshot.current.id !== sheet.id)) snapshot.current = sheet;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id]);

  // Default the active question to the first flagged one, else the first
  useEffect(() => {
    if (!sheet || !assessment) return;
    if (activeQid && sheet.questions.some((q) => q.qid === activeQid)) return;
    const firstFlag = sheet.questions.find((q) => q.review && !q.edited && !q.accepted);
    const qid = firstFlag?.qid ?? sheet.questions[0]?.qid ?? "";
    setActiveQid(qid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id, sheet?.questions.length]);

  // Follow the active question to its page
  const activeEval = sheet?.questions.find((q) => q.qid === activeQid);
  useEffect(() => {
    if (activeEval) setPage(activeEval.page);
  }, [activeEval?.qid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset per-copy UI when moving between copies
  useEffect(() => {
    setJustVerified(false);
    setVerifyError("");
    setRotate(0);
  }, [sheetId]);

  const isAssigned = sheet?.teacherId === me.id;
  const adminCanEdit = me.role === "admin" && state.settings.verificationAuthority === "teacher_admin";
  const lockedByOther = !!sheet?.lockedBy && sheet.lockedBy !== me.id;
  const verified = sheet?.verification === "verified";
  const canEdit = !!sheet && sheet.evaluation === "evaluated" && (isAssigned || adminCanEdit) && !lockedByOther && !verified;

  const save = useCallback(() => {
    if (!sheet) return;
    actions.saveDraft(sheet.id);
    snapshot.current = { ...sheet, dirty: false };
  }, [actions, sheet]);
  const discard = useCallback(() => {
    if (snapshot.current) actions.restoreSheet(snapshot.current);
  }, [actions]);
  useNavGuard(!!sheet?.dirty, save, discard);

  // Queue for prev / next copy
  const queue = useMemo(() => {
    if (!sheet) return [] as AnswerSheet[];
    const pool = state.sheets.filter((s) => s.assessmentId === sheet.assessmentId && (me.role === "admin" || s.teacherId === me.id || s.teacherId === null));
    const roll = (s: AnswerSheet) => {
      const st = state.students.find((x) => x.id === s.studentId)!;
      return `${st.section}${String(st.roll).padStart(3, "0")}`;
    };
    return pool.sort((a, b) => (roll(a) < roll(b) ? -1 : 1));
  }, [state.sheets, state.students, sheet, me]);
  const idx = sheet ? queue.findIndex((s) => s.id === sheet.id) : -1;
  const nextPending = queue.slice(idx + 1).concat(queue.slice(0, Math.max(0, idx))).find((s) => s.evaluation === "evaluated" && s.verification !== "verified" && s.id !== sheet?.id);

  // Keyboard shortcuts
  const qIndex = sheet ? sheet.questions.findIndex((q) => q.qid === activeQid) : -1;
  const moveQ = useCallback(
    (d: number) => {
      if (!sheet) return;
      const n = Math.max(0, Math.min(sheet.questions.length - 1, qIndex + d));
      setActiveQid(sheet.questions[n].qid);
    },
    [sheet, qIndex],
  );
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canEdit) {
          save();
          actions.toast("Draft saved");
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        moveQ(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        moveQ(-1);
      } else if (e.key === "a" && canEdit && activeQid && sheet) {
        actions.acceptQuestion(sheet.id, activeQid);
        moveQ(1);
      } else if (e.key === "f" && canEdit && activeEval && sheet) {
        actions.updateEval(sheet.id, activeQid, { flagged: !activeEval.flagged });
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [moveQ, canEdit, activeQid, activeEval, sheet, actions, save]);

  /* ---------------- Not found / not ready ---------------- */
  if (!sheet || !assessment || !student) {
    return (
      <EmptyState
        className="py-24"
        title="Copy not found"
        body="It may have been remapped to another student or removed from this assessment."
        action={<Button variant="primary" onClick={() => go(me.role === "admin" ? "/verification" : "/teacher/pending")}>Back to copies</Button>}
      />
    );
  }

  const total = sheetTotal(sheet);
  const aiTotal = sheetAiTotal(sheet);
  const unresolved = sheet.questions.filter((q) => q.review && !q.edited && !q.accepted);
  const backTo = `/assessments/${sheet.assessmentId}/students`;
  const pendingSuggestions = state.suggestions.filter((g) => g.sourceSheetId === sheet.id && g.status === "pending");
  const verifier = state.users.find((u) => u.id === sheet.verifiedBy);
  const assignedTeacher = state.users.find((u) => u.id === sheet.teacherId);

  const doVerify = () => {
    const r = actions.verify(sheet.id);
    if (!r.ok) {
      setVerifyError(r.error);
      return;
    }
    snapshot.current = null;
    setVerifyOpen(false);
    setJustVerified(true);
    actions.toast(`${student.name}'s copy verified`);
  };

  /* ---------------- Header ---------------- */
  const saveState = sheet.dirty ? (
    <span className="flex items-center gap-1.5 text-xs font-medium text-warning"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Unsaved changes</span>
  ) : sheet.draftSavedAt ? (
    <span className="flex items-center gap-1.5 text-xs text-ink-3"><Check size={13} strokeWidth={2.5} className="text-success" />Saved {relTime(sheet.draftSavedAt)}</span>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border bg-surface px-3 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <IconButton label="Back to copies" onClick={() => go(backTo)}><ArrowLeft size={18} strokeWidth={ICON} /></IconButton>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <h1 className="truncate text-base font-semibold tracking-tight text-ink">{student.name}</h1>
              <span className="text-[13px] text-ink-3">Class {student.grade}{student.section} · Roll no {student.roll}</span>
              <span className="hidden font-mono text-xs text-ink-3 md:inline">{student.barcode}</span>
            </div>
            <p className="truncate text-xs text-ink-3">{assessment.name} · {assessment.subject} · Version {sheet.version} · Rubric v{sheet.rubricVersion}</p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="Previous copy" disabled={idx <= 0} onClick={() => go(`/review/${queue[idx - 1].id}`)}><ChevronLeft size={18} strokeWidth={ICON} /></IconButton>
            <span className="min-w-14 text-center text-xs tabular-nums text-ink-3">{idx + 1} of {queue.length}</span>
            <IconButton label="Next copy" disabled={idx < 0 || idx >= queue.length - 1} onClick={() => go(`/review/${queue[idx + 1].id}`)}><ChevronRight size={18} strokeWidth={ICON} /></IconButton>
          </div>
          <div className="flex items-center gap-2">
            {saveState}
            {verified ? (
              <Button variant="secondary" onClick={() => setReopenOpen(true)} disabled={!(isAssigned || me.role === "admin")}>Reopen copy</Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled={!canEdit || !sheet.dirty}
                  onClick={() => {
                    save();
                    actions.toast("Draft saved");
                  }}
                  title="Save draft (Ctrl+S)"
                >
                  Save draft
                </Button>
                <Button variant="primary" disabled={!canEdit} onClick={() => { setVerifyError(""); setVerifyOpen(true); }}>
                  Verify copy
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* State banners */}
      <div className="shrink-0 space-y-2 px-3 empty:hidden sm:px-5 [&>*:first-child]:mt-3">
        {justVerified && (
          <Banner
            tone="success"
            title={`Verified · ${total}/${assessment.totalMarks} marks locked`}
            action={nextPending ? <Button variant="primary" size="sm" onClick={() => go(`/review/${nextPending.id}`)} iconRight={<ChevronRight size={15} strokeWidth={2} />}>Next copy: {state.students.find((s) => s.id === nextPending.studentId)?.name}</Button> : <Button size="sm" onClick={() => go(backTo)}>Back to copies</Button>}
          >
            {nextPending ? "Ready for the next copy in your queue." : "That was the last copy waiting in this assessment."}
          </Banner>
        )}
        {verified && !justVerified && (
          <Banner tone="success" title={`Verified by ${verifier?.name ?? "teacher"} · ${fmtDateTime(sheet.verifiedAt)}`}>
            Marks are locked for version {sheet.verifiedVersion}. Reopen the copy to make a material change; it will need verifying again.
          </Banner>
        )}
        {sheet.verification === "reopened" && (
          <Banner tone="warning" title="Reopened · needs re-verification">{sheet.reopenReason ?? "A change was made after verification."}</Banner>
        )}
        {lockedByOther && <Banner tone="warning" title="Another teacher is editing this copy">You can view it. Editing unlocks when they close it.</Banner>}
        {me.role === "admin" && !adminCanEdit && !verified && sheet.evaluation === "evaluated" && (
          <Banner tone="info" title={`Assigned to ${assignedTeacher?.name ?? "no one yet"}`}>Only the assigned teacher can edit and verify. Change this in Settings under verification authority.</Banner>
        )}
        {(sheet.blankPages.length > 0 || sheet.missingPages.length > 0) && (
          <Banner tone="warning" title={sheet.missingPages.length ? `Page ${sheet.missingPages.join(", ")} missing` : `Blank page ${sheet.blankPages.join(", ")} kept in the copy`}>
            {sheet.missingPages.length ? "Questions expected on the missing page need your judgement before verifying." : "Blank pages are flagged, never removed."}
          </Banner>
        )}
      </div>

      {sheet.evaluation !== "evaluated" ? (
        <NotEvaluated sheet={sheet} isAdmin={me.role === "admin"} onRetry={() => actions.retryJobs([sheet.id])} />
      ) : (
        <>
          {/* Mobile pane switch */}
          <div className="flex shrink-0 justify-center px-3 pt-3 lg:hidden">
            <Segmented items={[{ id: "sheet", label: "Answer sheet" }, { id: "marking", label: `Marking · ${total}/${assessment.totalMarks}` }]} value={pane} onChange={setPane} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
            {/* ---------------- Left: booklet ---------------- */}
            <section aria-label="Scanned answer sheet" className={cx("min-h-0 flex-col border-border bg-muted lg:flex lg:w-[52%] lg:border-r", pane === "sheet" ? "flex flex-1" : "hidden")}>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-1.5">
                <div className="flex items-center gap-1">
                  <IconButton size="sm" label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} strokeWidth={ICON} /></IconButton>
                  <span className="min-w-20 text-center text-xs tabular-nums text-ink-2">Page {page} of {sheet.pages}</span>
                  <IconButton size="sm" label="Next page" disabled={page >= sheet.pages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={16} strokeWidth={ICON} /></IconButton>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton size="sm" label="Zoom out" disabled={zoom <= 0.8} onClick={() => setZoom((z) => Math.round((z - 0.1) * 10) / 10)}><ZoomOut size={16} strokeWidth={ICON} /></IconButton>
                  <button onClick={() => setZoom(1)} className="min-w-11 rounded-sm px-1 text-xs tabular-nums text-ink-2 hover:bg-muted" title="Reset zoom">{Math.round(zoom * 100)}%</button>
                  <IconButton size="sm" label="Zoom in" disabled={zoom >= 1.6} onClick={() => setZoom((z) => Math.round((z + 0.1) * 10) / 10)}><ZoomIn size={16} strokeWidth={ICON} /></IconButton>
                  <span className="mx-1 h-4 w-px bg-border" />
                  <IconButton size="sm" label="Rotate page" onClick={() => setRotate((r) => (r + 90) % 360)}><RotateCw size={15} strokeWidth={ICON} /></IconButton>
                </div>
              </div>
              <div className="flex min-h-0 flex-1">
                {/* Thumbnails */}
                <ol className="hidden w-[76px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-surface p-2 xl:flex" aria-label="Pages">
                  {Array.from({ length: sheet.pages }).map((_, i) => {
                    const p = i + 1;
                    const flagged = sheet.questions.some((q) => q.page === p && q.review && !q.edited && !q.accepted) || sheet.missingPages.includes(p) || sheet.blankPages.includes(p);
                    return (
                      <li key={p}>
                        <button onClick={() => setPage(p)} aria-label={`Page ${p}`} aria-current={p === page ? "page" : undefined} className={cx("relative block w-full rounded-[3px] p-0.5", p === page ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border-strong")}>
                          <ScanPage sheet={sheet} student={student} assessment={assessment} page={p} thumb />
                          <span className="mt-0.5 flex items-center justify-center gap-1 text-[10px] tabular-nums text-ink-3">
                            {p}
                            {flagged && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="Has flags" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                  <div className="mx-auto" style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: Math.round(680 * zoom) }}>
                    <ScanPage
                      sheet={sheet}
                      student={student}
                      assessment={assessment}
                      page={page}
                      activeQid={activeQid}
                      onSelect={(qid) => {
                        setActiveQid(qid);
                        setPane("marking");
                      }}
                      zoom={zoom}
                      rotate={rotate}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ---------------- Right: marking ---------------- */}
            <section aria-label="Marking" className={cx("min-h-0 flex-col bg-surface lg:flex lg:flex-1", pane === "marking" ? "flex flex-1" : "hidden")}>
              <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 sm:px-4">
                {(["questions", "history"] as RightTab[]).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cx("-mb-px h-10 border-b-2 px-2.5 text-[13px]", tab === t ? "border-primary font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
                  >
                    {t === "questions" ? `Questions` : "History"}
                    {t === "questions" && unresolved.length > 0 && <span className="ml-1.5 rounded-sm bg-warning-soft px-1.5 text-xs text-warning tabular-nums">{unresolved.length} flagged</span>}
                  </button>
                ))}
                <div className="ml-auto hidden items-center gap-3 sm:flex">
                  <Lifecycle sheet={sheet} dists={state.distributions} />
                </div>
              </div>

              {tab === "questions" && (
                <>
                  <QuestionStrip sheet={sheet} activeQid={activeQid} onPick={setActiveQid} numberOf={(qid) => assessment.questions.find((q) => q.id === qid)?.number ?? ""} />
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {activeEval && (
                      <QuestionPanel
                        key={activeEval.qid}
                        sheetId={sheet.id}
                        qe={activeEval}
                        canEdit={canEdit}
                        showKey={showKey}
                        setShowKey={setShowKey}
                        onFindSimilar={() => {
                          const n = actions.findSimilar(sheet.id, activeEval.qid);
                          setSimilarOpen(true);
                          if (n === 0 && !state.suggestions.some((g) => g.sourceSheetId === sheet.id && g.qid === activeEval.qid && g.status === "pending")) actions.toast("No similar answers found in other copies");
                        }}
                        onPrev={() => moveQ(-1)}
                        onNext={() => moveQ(1)}
                        isFirst={qIndex === 0}
                        isLast={qIndex === sheet.questions.length - 1}
                      />
                    )}
                  </div>
                </>
              )}
              {tab === "history" && <CopyHistory sheet={sheet} />}

              {/* Totals footer */}
              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-subtle px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-ink-3">Total</span>
                  <span className="text-xl font-semibold tracking-tight tabular-nums text-ink">{total}</span>
                  <span className="text-sm tabular-nums text-ink-3">/ {assessment.totalMarks}</span>
                  {total !== aiTotal && <span className="text-xs tabular-nums text-ink-3">AI {aiTotal}</span>}
                </div>
                <div className="hidden items-center gap-3 text-[11px] text-ink-3 md:flex">
                  <span className="flex items-center gap-1"><Kbd>J</Kbd><Kbd>K</Kbd> question</span>
                  <span className="flex items-center gap-1"><Kbd>A</Kbd> accept</span>
                  <span className="flex items-center gap-1"><Kbd>F</Kbd> flag</span>
                </div>
              </footer>
            </section>
          </div>
        </>
      )}

      {/* Verify */}
      <Dialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title="Verify this copy?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={doVerify}>Verify copy</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-baseline justify-between rounded-md bg-subtle px-3 py-2.5">
            <span className="text-[13px] text-ink-2">{student.name} · Version {sheet.version}</span>
            <span className="text-lg font-semibold tabular-nums text-ink">{total}<span className="text-sm text-ink-3">/{assessment.totalMarks}</span></span>
          </div>
          <p>Final marks lock against ordinary edits. Reopening needs a reason and is recorded in the audit log.</p>
          {verifyError && <Banner tone="danger">{verifyError}</Banner>}
        </div>
      </Dialog>

      {/* Reopen */}
      <Dialog
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        title="Reopen this copy?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReopenOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!reopenReason.trim()) {
                  setReopenError("Add a reason so the change is traceable");
                  return;
                }
                actions.reopen(sheet.id, reopenReason.trim());
                snapshot.current = null;
                setReopenOpen(false);
                setReopenReason("");
                setReopenError("");
                setJustVerified(false);
                actions.toast("Copy reopened");
              }}
            >
              Reopen copy
            </Button>
          </>
        }
      >
        <p className="mb-3">Verification is revoked and a new version starts. You'll need to verify it again{state.distributions.some((d) => d.sheetId === sheet.id) ? ". The guardian keeps the version already sent until you send again" : ""}.</p>
        <Field label="Reason" htmlFor="reopen-reason" error={reopenError}>
          <Textarea id="reopen-reason" rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} invalid={!!reopenError} />
        </Field>
      </Dialog>

      {/* Similar corrections */}
      {activeEval && (
        <SimilarDrawer
          open={similarOpen}
          onClose={() => setSimilarOpen(false)}
          sheet={sheet}
          qid={activeEval.qid}
        />
      )}
      {pendingSuggestions.length > 0 && !similarOpen && tab === "questions" && (
        <div className="pointer-events-none fixed bottom-20 right-6 z-30 hidden lg:block">
          <button onClick={() => setSimilarOpen(true)} className="pointer-events-auto flex items-center gap-2 rounded-md border border-primary-soft-2 bg-primary-soft px-3 py-2 text-[13px] font-medium text-primary-ink shadow-md animate-fade-up hover:bg-primary-soft-2">
            <Search size={14} strokeWidth={2} />
            {pendingSuggestions.length} similar {pendingSuggestions.length === 1 ? "answer" : "answers"} to review
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function NotEvaluated({ sheet, isAdmin, onRetry }: { sheet: AnswerSheet; isAdmin: boolean; onRetry: () => void }) {
  if (sheet.evaluation === "failed" || sheet.evaluation === "needs_review")
    return (
      <EmptyState
        className="flex-1"
        title={sheet.evaluation === "failed" ? "AI evaluation failed for this copy" : "This copy needs review before evaluation"}
        body={`${sheet.error ?? ""} The original pages are safe and no marks were saved.`}
        action={isAdmin ? <Button variant="primary" onClick={onRetry}>Retry evaluation</Button> : <span className="text-[13px] text-ink-3">The Exam Cell has been notified.</span>}
      />
    );
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[15px] font-semibold text-ink">{sheet.evaluation === "queued" ? "Waiting in the evaluation queue" : `${EVAL_STAGES[Math.min(sheet.stage, 3)]}…`}</p>
      <ol className="flex flex-wrap justify-center gap-2 text-xs">
        {EVAL_STAGES.map((s, i) => (
          <li key={s} className={cx("flex items-center gap-1.5 rounded-sm px-2 py-1", sheet.evaluation === "processing" && i < sheet.stage ? "bg-primary-soft text-primary-ink" : sheet.evaluation === "processing" && i === sheet.stage ? "bg-primary text-on-primary" : "bg-muted text-ink-3")}>
            {sheet.evaluation === "processing" && i < sheet.stage && <Check size={12} strokeWidth={3} />}
            {s}
          </li>
        ))}
      </ol>
      <p className="max-w-sm text-[13px] text-ink-3">This page updates when marks are ready. Other copies keep processing in parallel.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function QuestionStrip({ sheet, activeQid, onPick, numberOf }: { sheet: AnswerSheet; activeQid: string; onPick: (qid: string) => void; numberOf: (qid: string) => string }) {
  return (
    <div className="shrink-0 border-b border-border px-3 py-2 sm:px-4">
      <ol className="flex flex-wrap gap-1" aria-label="Questions">
        {sheet.questions.map((qe) => {
          const active = qe.qid === activeQid;
          const flagged = qe.review && !qe.edited && !qe.accepted;
          const done = qe.accepted || qe.edited;
          return (
            <li key={qe.qid}>
              <button
                onClick={() => onPick(qe.qid)}
                aria-current={active ? "true" : undefined}
                aria-label={`Question ${numberOf(qe.qid)}${flagged ? ", flagged" : qe.edited ? ", edited" : qe.accepted ? ", accepted" : ""}`}
                className={cx(
                  "relative flex h-8 min-w-9 items-center justify-center gap-1 rounded-md border px-1.5 text-xs font-medium tabular-nums transition-colors duration-100",
                  active ? "border-primary bg-primary text-on-primary" : flagged ? "border-warning/40 bg-warning-soft text-warning hover:border-warning" : done ? "border-border bg-subtle text-ink-2 hover:border-border-strong" : "border-border bg-surface text-ink-2 hover:border-border-strong",
                )}
              >
                {numberOf(qe.qid)}
                {!active && qe.edited && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
                {!active && !qe.edited && qe.accepted && <Check size={11} strokeWidth={3} className="text-success" aria-hidden />}
                {qe.flagged && <Flag size={10} strokeWidth={2.5} className={active ? "text-on-primary" : "text-danger"} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function QuestionPanel({
  sheetId,
  qe,
  canEdit,
  showKey,
  setShowKey,
  onFindSimilar,
  onPrev,
  onNext,
  isFirst,
  isLast,
}: {
  sheetId: string;
  qe: QuestionEval;
  canEdit: boolean;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  onFindSimilar: () => void;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { state, actions } = useStore();
  const sheet = state.sheets.find((s) => s.id === sheetId)!;
  const a = state.assessments.find((x) => x.id === sheet.assessmentId)!;
  const qq = a.questions.find((q) => q.id === qe.qid)!;
  const [marksText, setMarksText] = useState(String(qe.awarded));
  const [marksError, setMarksError] = useState("");
  useEffect(() => setMarksText(String(qe.awarded)), [qe.awarded]);

  const setMarks = (v: number) => {
    if (Number.isNaN(v)) return setMarksError("Enter a number");
    if (v < 0) return setMarksError("Marks can't be negative");
    if (v > qq.marks) return setMarksError(`Maximum is ${qq.marks}`);
    if (Math.round(v * 2) !== v * 2) return setMarksError("Use whole or half marks");
    setMarksError("");
    actions.updateEval(sheetId, qe.qid, { awarded: v });
  };
  const toggleCriterion = (cid: string, on: boolean) => {
    const matched = on ? [...qe.matched, cid] : qe.matched.filter((x) => x !== cid);
    const awarded = qq.criteria.filter((c) => matched.includes(c.id)).reduce((t, c) => t + c.marks, 0);
    actions.updateEval(sheetId, qe.qid, { matched, awarded });
  };
  const changed = qe.awarded !== qe.aiAwarded;
  const flaggedNow = qe.review && !qe.edited && !qe.accepted;
  const confTone = qe.confidence >= 0.85 ? "text-ink-2" : qe.confidence >= 0.7 ? "text-ink-2" : "text-warning";
  const pendingForQ = state.suggestions.filter((g) => g.sourceSheetId === sheetId && g.qid === qe.qid && g.status === "pending").length;

  return (
    <div className="animate-fade-in px-4 py-4 sm:px-5">
      {/* Question head */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3">Question {qq.number} · {QTYPE_LABEL[qq.type]} · Page {qe.page}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{qq.text}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton size="sm" label="Previous question (K)" disabled={isFirst} onClick={onPrev}><ChevronUp size={16} strokeWidth={ICON} /></IconButton>
          <IconButton size="sm" label="Next question (J)" disabled={isLast} onClick={onNext}><ChevronDown size={16} strokeWidth={ICON} /></IconButton>
        </div>
      </div>

      {flaggedNow && (
        <Banner tone="warning" className="mt-3" title={qe.reason ? REVIEW_REASON[qe.reason] : "Needs review"}>
          {qe.explanation}
        </Banner>
      )}

      {/* Marks */}
      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-border py-3">
        <div>
          <label htmlFor="marks" className="text-xs text-ink-3">Marks</label>
          <div className="mt-1 flex items-center gap-1">
            <IconButton label="Decrease by half a mark" disabled={!canEdit || qe.awarded <= 0} onClick={() => setMarks(Math.max(0, qe.awarded - 0.5))} className="border border-border-strong"><Minus size={14} strokeWidth={2} /></IconButton>
            <input
              id="marks"
              inputMode="decimal"
              value={marksText}
              disabled={!canEdit}
              onChange={(e) => setMarksText(e.target.value)}
              onBlur={() => setMarks(parseFloat(marksText))}
              onKeyDown={(e) => e.key === "Enter" && setMarks(parseFloat(marksText))}
              aria-invalid={!!marksError || undefined}
              className={cx("h-8 w-14 rounded-md border bg-surface text-center text-base font-semibold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-primary-ring/60 disabled:bg-muted", marksError ? "border-danger" : "border-border-strong")}
            />
            <IconButton label="Increase by half a mark" disabled={!canEdit || qe.awarded >= qq.marks} onClick={() => setMarks(Math.min(qq.marks, qe.awarded + 0.5))} className="border border-border-strong"><Plus size={14} strokeWidth={2} /></IconButton>
            <span className="ml-1 text-sm tabular-nums text-ink-3">/ {qq.marks}</span>
          </div>
          {marksError && <p className="mt-1 text-xs text-danger" role="alert">{marksError}</p>}
        </div>
        <div className="text-[13px]">
          <p className="text-xs text-ink-3">AI mark</p>
          <p className="mt-1 tabular-nums text-ink-2">{qe.aiAwarded} / {qq.marks} {changed && <span className="text-xs text-primary-ink">· changed</span>}</p>
        </div>
        <div className="text-[13px]">
          <p className="text-xs text-ink-3">Confidence</p>
          <p className={cx("mt-1 tabular-nums", confTone)}>{Math.round(qe.confidence * 100)}%</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!canEdit}
            icon={<Flag size={14} strokeWidth={2} className={qe.flagged ? "text-danger" : ""} />}
            onClick={() => actions.updateEval(sheetId, qe.qid, { flagged: !qe.flagged })}
            title="Flag question (F)"
          >
            {qe.flagged ? "Flagged" : "Flag"}
          </Button>
          {qe.accepted && !changed ? (
            <span className="flex items-center gap-1 text-[13px] font-medium text-success"><Check size={15} strokeWidth={2.5} />Accepted</span>
          ) : !changed ? (
            <Button size="sm" variant={flaggedNow ? "primary" : "secondary"} disabled={!canEdit} onClick={() => { actions.acceptQuestion(sheetId, qe.qid); if (!isLast) onNext(); }} title="Accept AI mark (A)">
              Accept AI mark
            </Button>
          ) : null}
        </div>
      </div>

      {changed && (
        <div className="mt-3 rounded-md bg-primary-soft/60 px-3 py-3">
          <Field label="Reason for change" htmlFor="edit-reason" helper="Recorded with the correction and used to find similar answers in other copies">
            <Textarea id="edit-reason" rows={2} disabled={!canEdit} value={qe.editReason ?? ""} onChange={(e) => actions.updateEval(sheetId, qe.qid, { editReason: e.target.value })} className="min-h-0" />
          </Field>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Search size={14} strokeWidth={2} />} disabled={!canEdit} onClick={onFindSimilar}>
              {pendingForQ ? `Review ${pendingForQ} similar answers` : "Find similar answers"}
            </Button>
            <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => actions.updateEval(sheetId, qe.qid, { awarded: qe.aiAwarded, matched: qe.matched, editReason: undefined })}>Restore AI mark</Button>
          </div>
        </div>
      )}

      {/* Extracted answer */}
      <h3 className="mt-5 text-xs font-medium text-ink-3">Student's answer, as read</h3>
      <p className={cx("mt-1.5 whitespace-pre-line rounded-md border border-border bg-subtle px-3 py-2.5 text-[13px] leading-relaxed text-ink", qe.reason === "unreadable" && "italic text-ink-2")}>{qe.extracted || "No answer found"}</p>

      {/* Rubric */}
      <div className="mt-5 flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-ink-3">Rubric v{sheet.rubricVersion}</h3>
        <span className="text-xs text-ink-3">Tick criteria to recalculate</span>
      </div>
      <ul className="mt-1.5 divide-y divide-border rounded-md border border-border">
        {qq.criteria.map((c) => {
          const on = qe.matched.includes(c.id);
          return (
            <li key={c.id}>
              <label className={cx("flex items-center gap-3 px-3 py-2", canEdit ? "cursor-pointer hover:bg-subtle" : "")}>
                <Checkbox checked={on} disabled={!canEdit} onChange={(v) => toggleCriterion(c.id, v)} label={c.label} />
                <span className={cx("flex-1 text-[13px]", on ? "text-ink" : "text-ink-3")}>{c.label}</span>
                <span className="text-xs tabular-nums text-ink-3">{c.marks} {c.marks === 1 ? "mark" : "marks"}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* AI explanation */}
      <h3 className="mt-5 text-xs font-medium text-ink-3">Why the AI gave {qe.aiAwarded}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{qe.explanation}</p>

      {/* Answer key */}
      <button onClick={() => setShowKey(!showKey)} aria-expanded={showKey} className="mt-5 flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink">
        {showKey ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
        Answer key v{sheet.answerKeyVersion}
      </button>
      {showKey && (
        <div className="mt-1.5 animate-fade-in rounded-md border border-border px-3 py-2.5 text-[13px] text-ink-2">
          <p className="text-ink">{qq.answer}</p>
          {qq.steps && (
            <ol className="mt-2 list-decimal space-y-0.5 pl-5">
              {qq.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          {qq.alternatives.length > 0 && <p className="mt-2 text-xs text-ink-3">Also accepted: {qq.alternatives.join("; ")}</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function SimilarDrawer({ open, onClose, sheet, qid }: { open: boolean; onClose: () => void; sheet: AnswerSheet; qid: string }) {
  const { state, actions } = useStore();
  const a = state.assessments.find((x) => x.id === sheet.assessmentId)!;
  const qq = a.questions.find((q) => q.id === qid)!;
  const src = sheet.questions.find((q) => q.qid === qid)!;
  const items = state.suggestions.filter((g) => g.sourceSheetId === sheet.id && g.qid === qid);
  const pending = items.filter((g) => g.status === "pending");
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => setSel(pending.map((p) => p.id)), [open, pending.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = (ids: string[], d: "approved" | "rejected") => {
    const verifiedAffected = ids.filter((id) => {
      const g = state.suggestions.find((x) => x.id === id)!;
      return state.sheets.find((s) => s.id === g.targetSheetId)?.verification === "verified";
    }).length;
    actions.decideSuggestions(ids, d);
    setSel([]);
    if (d === "approved")
      actions.toast(`${ids.length} ${ids.length === 1 ? "copy" : "copies"} updated${verifiedAffected ? `, ${verifiedAffected} need re-verification` : ""}`, { undo: () => actions.revertSuggestions(ids) });
    else actions.toast(`${ids.length} ${ids.length === 1 ? "suggestion" : "suggestions"} rejected`);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title={`Similar answers · Question ${qq.number}`}
      subtitle={`You changed ${src.aiAwarded} → ${src.awarded} of ${qq.marks}${src.editReason ? ` · ${src.editReason}` : ""}`}
      footer={
        pending.length > 0 ? (
          <>
            <span className="mr-auto text-xs text-ink-3">Only approved changes apply. Verified copies that change need re-verification.</span>
            <Button variant="ghost" disabled={!sel.length} onClick={() => decide(sel, "rejected")}>Reject {sel.length || ""}</Button>
            <Button variant="primary" disabled={!sel.length} onClick={() => decide(sel, "approved")}>Apply to {sel.length} {sel.length === 1 ? "copy" : "copies"}</Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState title="No similar answers" body="No other copy has an answer that meets the same rubric criteria with the original AI mark." />
      ) : (
        <>
          {pending.length > 0 && (
            <div className="flex items-center gap-3 border-b border-border bg-subtle px-5 py-2">
              <Checkbox checked={sel.length === pending.length} indeterminate={sel.length > 0 && sel.length < pending.length} onChange={(v) => setSel(v ? pending.map((p) => p.id) : [])} label="Select all suggestions" />
              <span className="text-xs text-ink-3">{pending.length} suggestions · matched on rubric criteria, not wording alone</span>
            </div>
          )}
          <ul className="divide-y divide-border">
            {items.map((g) => {
              const t = state.sheets.find((s) => s.id === g.targetSheetId)!;
              const st = state.students.find((s) => s.id === t.studentId)!;
              const isPending = g.status === "pending";
              return (
                <li key={g.id} className={cx("flex gap-3 px-5 py-3.5", !isPending && "opacity-70")}>
                  {isPending ? (
                    <Checkbox className="mt-0.5" checked={sel.includes(g.id)} onChange={(v) => setSel((s) => (v ? [...s, g.id] : s.filter((x) => x !== g.id)))} label={`Select ${st.name}`} />
                  ) : (
                    <span className="w-4" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-medium text-ink">{st.name}</span>
                      <span className="text-xs text-ink-3">Class {st.grade}{st.section} · Roll no {st.roll}</span>
                      {t.verification === "verified" && isPending && <Tag tone="warning">Verified, will reopen</Tag>}
                      {!isPending && <Tag tone={g.status === "approved" ? "success" : "muted"}>{g.status === "approved" ? "Applied" : "Rejected"}</Tag>}
                    </div>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-line rounded-sm border-l-2 border-border-strong pl-2.5 font-hand text-[15px] leading-snug text-pen">{g.excerpt}</p>
                    <p className="mt-1.5 text-xs text-ink-3">{g.rationale}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink">{g.fromMarks} → {g.toMarks}</p>
                    <p className="text-xs tabular-nums text-ink-3">{Math.round(g.similarity * 100)}% similar</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
function CopyHistory({ sheet }: { sheet: AnswerSheet }) {
  const { state } = useStore();
  const st = state.students.find((s) => s.id === sheet.studentId)!;
  const events = state.audit.filter((e) => e.href === `/review/${sheet.id}` || e.target.startsWith(st.name));
  const batch = state.batches.find((b) => b.id === sheet.batchId);
  const rows: { at?: string; label: string; detail?: string }[] = [
    ...events.map((e) => ({ at: e.at, label: e.action, detail: [state.users.find((u) => u.id === e.actorId)?.name, e.detail].filter(Boolean).join(" · ") })),
    ...(sheet.verifiedAt && !events.some((e) => e.action === "Verified copy") ? [{ at: sheet.verifiedAt, label: `Verified version ${sheet.verifiedVersion}`, detail: state.users.find((u) => u.id === sheet.verifiedBy)?.name }] : []),
    { at: batch?.uploadedAt, label: "Uploaded and mapped", detail: `${batch?.fileName ?? ""} · ${sheet.pages} pages` },
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-4 rounded-md border border-border px-3 py-2.5">
        <Barcode value={st.barcode} height={48} />
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-ink-3">Evaluation version</dt><dd className="text-ink">{sheet.version}</dd>
          <dt className="text-ink-3">Model</dt><dd className="truncate text-ink">{sheet.model}</dd>
          <dt className="text-ink-3">Answer key / rubric</dt><dd className="text-ink">v{sheet.answerKeyVersion} / v{sheet.rubricVersion}</dd>
        </dl>
      </div>
      <ol className="relative ml-1.5 border-l border-border">
        {rows.map((r, i) => (
          <li key={i} className="mb-4 ml-4">
            <span className="absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full bg-border-strong" aria-hidden />
            <p className="text-[13px] font-medium text-ink">{r.label}</p>
            <p className="text-xs text-ink-3">{[r.at ? fmtDateTime(r.at) : "", r.detail].filter(Boolean).join(" · ")}</p>
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-1.5 text-xs text-ink-3"><History size={13} strokeWidth={ICON} />Earlier versions are kept; nothing is overwritten.</p>
      {sheet.verification === "verified" && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Lock size={13} strokeWidth={ICON} />Locked at version {sheet.verifiedVersion}</p>}
    </div>
  );
}
