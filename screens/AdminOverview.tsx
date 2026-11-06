/* UI-02 Admin dashboard: the exam pipeline, what needs attention, assessments in flight. */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, ChevronRight, FileUp, MessageSquareWarning, ScanLine, ShieldAlert, Timer, Workflow } from "lucide-react";
import { useStore } from "../data/store";
import {
  ASSESSMENT_STATUS,
  assessmentStatus,
  cohortOf,
  countsFor,
  fmtShortDate,
  latestDistribution,
  num,
  pct,
  relTime,
} from "../data/selectors";
import { Button, ButtonLink, ICON, Page, PageHeader, Panel, Select, StackBar, StatusText, Table, Td, Th, Tr, cx } from "../components/ui";

export default function AdminOverview() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [scope, setScope] = useState("all");

  const active = state.assessments.filter((a) => !a.archived);
  const scoped = scope === "all" ? active : active.filter((a) => a.id === scope);
  const ids = new Set(scoped.map((a) => a.id));
  const sheets = state.sheets.filter((s) => ids.has(s.assessmentId));
  const openUnmatched = state.unmatched.filter((u) => u.status === "open" && ids.has(u.assessmentId));
  const c = countsFor(sheets, state.distributions, state.students, openUnmatched.length, scoped);

  const funnel = [
    { label: "Expected students", value: c.expected, note: `${scoped.filter((a) => a.paper && a.questionsConfirmed).length} assessments`, to: "/assessments" },
    { label: "Uploaded copies", value: c.uploaded, note: c.unmatched ? `${c.unmatched} need mapping` : "All mapped", warn: c.unmatched > 0, to: c.unmatched ? "/unmatched" : "/uploads" },
    { label: "Identified", value: c.identified, note: `${pct(c.identified, c.uploaded)}% of uploaded`, to: "/uploads" },
    { label: "AI evaluated", value: c.aiEvaluated, note: c.failed + c.needsReview ? `${c.pendingEvaluation} in queue · ${c.failed + c.needsReview} exceptions` : `${c.pendingEvaluation} in queue`, warn: c.failed + c.needsReview > 0, to: "/queue" },
    { label: "Verified", value: c.verified, note: `${c.pendingVerification} pending verification`, to: "/verification" },
    { label: "Distributed", value: c.distributed, note: c.smsFailed ? `${c.smsFailed} SMS failed` : c.provisional ? `${c.provisional} not verified` : "No failures", warn: c.smsFailed > 0, to: "/distribution" },
  ];

  /* Needs attention: derived from the same data */
  const attention = useMemo(() => {
    const items: { icon: typeof AlertTriangle; tone: "danger" | "warning" | "info"; title: string; body: string; to: string; action: string }[] = [];
    if (openUnmatched.length)
      items.push({ icon: ScanLine, tone: "warning", title: `${openUnmatched.length} booklets can't be identified`, body: "They stay out of evaluation until each is mapped to a student", to: "/unmatched", action: "Map booklets" });
    const failed = sheets.filter((s) => s.evaluation === "failed");
    const nr = sheets.filter((s) => s.evaluation === "needs_review");
    if (failed.length || nr.length)
      items.push({ icon: Workflow, tone: "danger", title: `${failed.length + nr.length} evaluation ${failed.length + nr.length === 1 ? "job needs" : "jobs need"} action`, body: [failed.length && `${failed.length} failed`, nr.length && `${nr.length} with missing pages`].filter(Boolean).join(" · "), to: "/queue", action: "Open queue" });
    const smsFailed = state.distributions.filter((d) => ids.has(d.assessmentId) && d.status === "failed" && latestDistribution(d.sheetId, state.distributions)?.id === d.id);
    if (smsFailed.length) items.push({ icon: MessageSquareWarning, tone: "danger", title: `${smsFailed.length} SMS not delivered`, body: "Guardians haven't received these results", to: "/distribution", action: "Retry" });
    const unassigned = sheets.filter((s) => !s.teacherId && s.evaluation === "evaluated");
    if (unassigned.length) items.push({ icon: FileUp, tone: "info", title: `${unassigned.length} evaluated copies unassigned`, body: "No teacher can verify them yet", to: "/teachers", action: "Assign" });
    const reopened = sheets.filter((s) => s.verification === "reopened");
    if (reopened.length) items.push({ icon: ShieldAlert, tone: "warning", title: `${reopened.length} ${reopened.length === 1 ? "copy" : "copies"} reopened`, body: "Waiting for re-verification", to: "/verification", action: "View" });
    const soon = scoped.filter((a) => a.deadline && new Date(a.deadline).getTime() - Date.now() < 9e15 && sheets.some((s) => s.assessmentId === a.id && s.verification !== "verified" && s.evaluation === "evaluated"));
    soon.slice(0, 1).forEach((a) => {
      const left = sheets.filter((s) => s.assessmentId === a.id && s.evaluation === "evaluated" && s.verification !== "verified").length;
      items.push({ icon: Timer, tone: "info", title: `${a.name} · Class ${a.grade} due ${fmtShortDate(a.deadline)}`, body: `${left} copies still to verify`, to: "/teachers", action: "Teachers" });
    });
    return items;
  }, [openUnmatched.length, sheets, state.distributions, ids, scoped]);

  const inFlight = scoped
    .map((a) => {
      const own = state.sheets.filter((s) => s.assessmentId === a.id);
      const expected = cohortOf(a, state.students).length;
      const evaluated = own.filter((s) => s.evaluation === "evaluated").length;
      const verified = own.filter((s) => s.verification === "verified").length;
      const released = own.filter((s) => latestDistribution(s.id, state.distributions)?.status === "delivered").length;
      return { a, status: assessmentStatus(a, state.sheets), expected, uploaded: own.length, evaluated, verified, released };
    })
    .sort((x, y) => (x.a.examDate < y.a.examDate ? 1 : -1));

  const recent = state.audit.slice(0, 6);
  const userName = (id: string) => (id === "system" ? "System" : id === "guardian" ? "Guardian" : state.users.find((u) => u.id === id)?.name ?? id);

  return (
    <Page>
      <PageHeader
        title="Overview"
        actions={
          <>
            <Select aria-label="Assessment scope" value={scope} onChange={(e) => setScope(e.target.value)} className="w-56">
              <option value="all">All assessments</option>
              {active.map((a) => (
                <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>
              ))}
            </Select>
            <ButtonLink to="/uploads/new" variant="primary" icon={<FileUp size={16} strokeWidth={ICON} />}>Upload answer sheets</ButtonLink>
          </>
        }
      />

      {/* Pipeline */}
      <section aria-label="Evaluation pipeline" className="mb-5 overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
        <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          {funnel.map((f, i) => (
            <li key={f.label} className={cx("relative border-border", i > 0 && "xl:border-l", i % 2 === 1 && "border-l sm:border-l-0", i >= 2 && "border-t sm:border-t-0", i >= 3 && "sm:border-t xl:border-t-0", i % 3 !== 0 && "sm:border-l")}>
              <Link to={f.to} className="group flex h-full flex-col px-4 py-3.5 transition-colors duration-100 hover:bg-subtle">
                <span className="flex items-center gap-1 text-xs text-ink-3">
                  {f.label}
                  <ChevronRight size={12} strokeWidth={ICON} className="opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-ink">{num(f.value)}</span>
                <span className={cx("mt-0.5 text-xs", f.warn ? "font-medium text-warning" : "text-ink-3")}>{f.note}</span>
              </Link>
              {i < funnel.length - 1 && (
                <ArrowRight size={14} strokeWidth={ICON} className="absolute -right-[7px] top-1/2 z-10 -mt-[7px] hidden rounded-full bg-surface text-ink-4 xl:block" aria-hidden />
              )}
            </li>
          ))}
        </ol>
        <div className="border-t border-border px-4 py-2.5">
          <StackBar
            total={Math.max(c.expected, c.uploaded)}
            parts={[
              { value: c.distributed, cls: "bg-primary", label: "Distributed" },
              { value: Math.max(0, c.verified - c.distributed + c.provisional), cls: "bg-primary/60", label: "Verified, not sent" },
              { value: Math.max(0, c.aiEvaluated - c.verified - c.provisional), cls: "bg-primary/25", label: "AI evaluated, not verified" },
              { value: c.pendingEvaluation + c.failed + c.needsReview, cls: "bg-ink-4/50", label: "In queue or exceptions" },
              { value: c.unmatched, cls: "bg-warning", label: "Unmatched" },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
            <Legend cls="bg-primary" label="Distributed" />
            <Legend cls="bg-primary/60" label="Verified" />
            <Legend cls="bg-primary/25" label="AI evaluated" />
            <Legend cls="bg-ink-4/50" label="In queue" />
            <Legend cls="bg-warning" label="Unmatched" />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Assessments in flight */}
        <Panel title="Assessments" actions={<ButtonLink to="/assessments" variant="ghost" size="sm">View all</ButtonLink>} flush>
          <Table>
            <thead>
              <tr>
                <Th sticky>Assessment</Th>
                <Th>Status</Th>
                <Th className="w-52">Progress</Th>
                <Th align="right">Uploaded</Th>
                <Th align="right">Verified</Th>
                <Th align="right">Released</Th>
                <Th align="right">Deadline</Th>
              </tr>
            </thead>
            <tbody>
              {inFlight.map(({ a, status, expected, uploaded, evaluated, verified, released }) => (
                <Tr key={a.id} onClick={() => navigate(`/assessments/${a.id}`)}>
                  <Td sticky className="max-w-72">
                    <span className="block truncate font-medium text-ink">{a.name}</span>
                    <span className="block text-xs text-ink-3">Class {a.grade} {a.sections.join(", ")} · {a.subject}</span>
                  </Td>
                  <Td><StatusText {...ASSESSMENT_STATUS[status]} /></Td>
                  <Td>
                    {uploaded ? (
                      <StackBar
                        total={expected}
                        parts={[
                          { value: released, cls: "bg-primary", label: "Released" },
                          { value: Math.max(0, verified - released), cls: "bg-primary/60", label: "Verified" },
                          { value: Math.max(0, evaluated - verified), cls: "bg-primary/25", label: "AI evaluated" },
                          { value: uploaded - evaluated, cls: "bg-ink-4/50", label: "In queue" },
                        ]}
                      />
                    ) : (
                      <span className="text-xs text-ink-3">{status === "ready" ? "Waiting for upload" : "Setup in progress"}</span>
                    )}
                  </Td>
                  <Td align="right">{uploaded}/{expected}</Td>
                  <Td align="right">{verified}</Td>
                  <Td align="right">{released}</Td>
                  <Td align="right">{a.deadline ? fmtShortDate(a.deadline) : <span className="text-ink-4">None</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Needs attention" flush>
            {attention.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">Nothing needs attention. Every copy is mapped and moving.</p>
            ) : (
              <ul className="divide-y divide-border">
                {attention.map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <li key={i} className="flex items-start gap-3 px-4 py-3">
                      <Icon size={17} strokeWidth={ICON} className={cx("mt-0.5 shrink-0", it.tone === "danger" ? "text-danger" : it.tone === "warning" ? "text-warning" : "text-primary")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink">{it.title}</p>
                        <p className="text-xs text-ink-3">{it.body}</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate(it.to)}>{it.action}</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity" actions={<ButtonLink to="/audit" variant="ghost" size="sm">Audit log</ButtonLink>} flush>
            <ul className="divide-y divide-border">
              {recent.map((e) => (
                <li key={e.id} className="px-4 py-2.5">
                  <p className="text-[13px] text-ink">
                    <span className="font-medium">{userName(e.actorId)}</span> <span className="text-ink-2">{e.action.charAt(0).toLowerCase() + e.action.slice(1)}</span>
                  </p>
                  <p className="truncate text-xs text-ink-3">{e.target} · {relTime(e.at)}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("h-2 w-2 rounded-sm", cls)} aria-hidden />
      {label}
    </span>
  );
}
