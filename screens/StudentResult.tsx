import { useParams } from "react-router-dom";
import { useStore } from "../data/store";
import { latestDistribution } from "../data/selectors";
import { PublicFrame } from "../components/Shell";
import { EmptyState } from "../components/ui";
import ResultDocument from "../components/ResultDocument";

export default function StudentResult() {
  const { sheetId } = useParams();
  const { state } = useStore();
  const sheet = state.sheets.find((s) => s.id === sheetId);
  const student = sheet && state.students.find((s) => s.id === sheet.studentId);
  const assessment = sheet && state.assessments.find((a) => a.id === sheet.assessmentId);
  const distribution = sheet && latestDistribution(sheet.id, state.distributions);
  return <PublicFrame><header className="border-b border-border bg-surface"><div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6"><span className="text-sm font-semibold text-ink">{state.settings.schoolName}</span><span className="text-xs text-ink-3">Student view{student ? ` · ${student.name}` : ""}</span></div></header><main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">{!sheet || !student || !assessment ? <EmptyState title="Result not found" body="Check the result link or contact your school." /> : distribution?.status !== "delivered" ? <EmptyState title="Your result isn't released yet" body="The Examination Cell will send you a link when your result is ready." /> : <ResultDocument sheet={sheet} distribution={distribution} audience="student" assessment={assessment} student={student} schoolName={state.settings.schoolName} users={state.users} />}</main></PublicFrame>;
}
