/*
 * Shared header for every assessment page: breadcrumb, title, meta, status and the
 * assessment's section tabs (Overview, Students, Question paper, Answer key, Rubric).
 * Setup tabs show a check when that step is approved, so progress reads from the tabs.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, CircleDashed } from "lucide-react";
import type { Assessment } from "../data/types";
import { useStore } from "../data/store";
import { ASSESSMENT_STATUS, assessmentStatus, fmtDate } from "../data/selectors";
import { PageHeader, StatusText, cx } from "./ui";

export type AssessmentTab = "overview" | "students" | "paper" | "answer-key" | "rubric";

export function setupSteps(a: Assessment) {
  return [
    { id: "paper" as const, label: "Question paper", done: !!a.paper && a.questionsConfirmed },
    { id: "answer-key" as const, label: "Answer key", done: a.answerKey.status === "approved" },
    { id: "rubric" as const, label: "Rubric", done: a.rubric.status === "approved" },
  ];
}

export default function AssessmentHeader({ assessment: a, tab, actions, children }: { assessment: Assessment; tab: AssessmentTab; actions?: ReactNode; children?: ReactNode }) {
  const { state, role } = useStore();
  const status = assessmentStatus(a, state.sheets);
  const st = ASSESSMENT_STATUS[status];
  const sheetCount = state.sheets.filter((s) => s.assessmentId === a.id).length;
  const steps = setupSteps(a);
  const tabs: { id: AssessmentTab; label: string; to: string; done?: boolean; count?: number }[] = [
    { id: "overview", label: "Overview", to: `/assessments/${a.id}` },
    { id: "students", label: "Students", to: `/assessments/${a.id}/students`, count: sheetCount },
    { id: "paper", label: "Question paper", to: `/assessments/${a.id}/setup/paper`, done: steps[0].done },
    { id: "answer-key", label: "Answer key", to: `/assessments/${a.id}/setup/answer-key`, done: steps[1].done },
    { id: "rubric", label: "Rubric", to: `/assessments/${a.id}/setup/rubric`, done: steps[2].done },
  ];
  return (
    <>
      <PageHeader
        crumbs={[{ label: role === "admin" ? "Exam Evaluator" : "My exams", to: role === "admin" ? "/assessments" : "/teacher/assessments" }, { label: `${a.name} · Class ${a.grade}` }]}
        title={
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center rounded-md bg-primary-soft px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary border border-primary/20">
                {a.type || "Exam"}
              </span>
              <span className="text-xs font-medium text-ink-3">Class {a.grade} · {a.subject}</span>
            </div>
            <span>{a.name}</span>
          </div>
        }
        meta={
          <>
            <StatusText tone={st.tone} label={st.label} />
            <span>Sections {a.sections.join(", ")}</span>
            <span>Exam {fmtDate(a.examDate)}</span>
            <span className="tabular-nums font-medium text-ink">{a.totalMarks} marks</span>
          </>
        }
        actions={actions}
      />
      <nav className="-mt-1 mb-5 flex gap-1 overflow-x-auto border-b border-border" aria-label="Exam sections">
        {tabs.map((t) => {
          const active = t.id === tab;
          const isSetup = t.done !== undefined;
          return (
            <Link
              key={t.id}
              to={t.to}
              aria-current={active ? "page" : undefined}
              className={cx(
                "-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm whitespace-nowrap",
                active ? "border-primary font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              {isSetup && (t.done ? <Check size={14} strokeWidth={2.5} className="text-success" aria-label="Approved" /> : <CircleDashed size={14} strokeWidth={2} className="text-ink-4" aria-label="Not approved yet" />)}
              {t.label}
              {t.count !== undefined && <span className={cx("rounded-sm px-1.5 text-xs tabular-nums", active ? "bg-primary-soft text-primary-ink" : "bg-muted text-ink-3")}>{t.count}</span>}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}

/** Lookup + not-found guard for assessment routes. */
export function useAssessmentParam(id?: string) {
  const { state } = useStore();
  return state.assessments.find((a) => a.id === id);
}
