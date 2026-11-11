import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, CircleCheck, FilePlus2, Flag } from "lucide-react";
import { useStore } from "../data/store";
import { ASSESSMENT_STATUS, assessmentStatus, flaggedCount, fmtShortDate, relTime, sheetAiTotal, sheetTotal } from "../data/selectors";
import { ButtonLink, EmptyState, ICON, Page, PageHeader, Panel, StackBar, StatStrip, StatusText, Table, Td, Th, Tr } from "../components/ui";

export default function TeacherDashboard() {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const mine = state.sheets.filter((s) => s.teacherId === me.id && s.evaluation === "evaluated");
  const pending = mine.filter((s) => s.verification !== "verified");
  const priority = (s: typeof mine[number]) => s.verification === "reopened" ? 0 : flaggedCount(s) > 0 ? 1 : s.verification === "in_progress" ? 2 : 3;
  const nextCopies = [...pending].sort((a, b) => priority(a) - priority(b) || (state.students.find((x) => x.id === a.studentId)?.roll ?? 0) - (state.students.find((x) => x.id === b.studentId)?.roll ?? 0)).slice(0, 5);
  const assignedAssessments = state.assessments.filter((a) => a.teacherIds.includes(me.id) && !a.archived);
  const ownedSetup = state.assessments.filter((a) => a.ownerId === me.id && (a.answerKey.status !== "approved" || a.rubric.status !== "approved"));
  const editedQuestions = mine.reduce((n, s) => n + s.questions.filter((q) => q.edited).length, 0);
  const verified = mine.filter((s) => s.verification === "verified").length;
  const unreadNotifications = state.notifications.filter((n) => n.userId === me.id && !n.read);
  const recentNotifications = state.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  const statItems = [
    { label: "Assigned assessments", value: assignedAssessments.length, to: "/teacher/assessments" },
    { label: "Assigned copies", value: mine.length + state.sheets.filter((s) => s.teacherId === me.id && s.evaluation !== "evaluated").length, to: "/teacher/pending" },
    { label: "AI evaluated", value: mine.length, to: "/teacher/pending" },
    { label: "Pending verification", value: pending.length, to: "/teacher/pending", tone: pending.length ? "warning" as const : undefined },
    { label: "Verified", value: verified, to: "/teacher/verified" },
    { label: "Flagged copies", value: mine.filter((s) => flaggedCount(s) > 0).length, to: "/teacher/pending" },
    { label: "Corrections made", value: editedQuestions, to: "/teacher/verified" },
  ];
  return (
    <Page>
      <PageHeader title="Dashboard" actions={<ButtonLink to="/assessments/new" variant="secondary" icon={<FilePlus2 size={16} strokeWidth={ICON} />}>Create assessment</ButtonLink>} />
      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Continue reviewing" actions={<ButtonLink to="/teacher/pending" variant="ghost" size="sm">View all</ButtonLink>} flush>
          {nextCopies.length === 0 ? (
            <EmptyState icon={<CircleCheck size={30} strokeWidth={ICON} />} title="All caught up" body={`${verified} ${verified === 1 ? "copy is" : "copies are"} verified.`} />
          ) : (
            <>
              <Table>
                <thead><tr><Th sticky>Student</Th><Th>Assessment</Th><Th>AI marks</Th><Th>Flags</Th><Th>Status</Th><Th /></tr></thead>
                <tbody>{nextCopies.map((sheet) => {
                  const student = state.students.find((s) => s.id === sheet.studentId)!;
                  const assessment = state.assessments.find((a) => a.id === sheet.assessmentId)!;
                  return <Tr key={sheet.id} onClick={() => navigate(`/review/${sheet.id}`)}>
                    <Td sticky><span className="block font-medium text-ink">{student.name}</span><span className="text-xs text-ink-3">Class {student.grade}{student.section} · Roll no {student.roll}</span></Td>
                    <Td>{assessment.name}</Td><Td>{sheetAiTotal(sheet)}/{assessment.totalMarks}</Td>
                    <Td>{flaggedCount(sheet) ? <span className="inline-flex items-center gap-1 text-warning"><Flag size={13} strokeWidth={ICON} />{flaggedCount(sheet)}</span> : <span className="text-ink-4">–</span>}</Td>
                    <Td><StatusText {...(sheet.verification === "reopened" ? { label: "Reopened", tone: "warning" as const } : sheet.verification === "in_progress" ? { label: "In progress", tone: "info" as const } : flaggedCount(sheet) ? { label: "Flagged", tone: "warning" as const } : { label: "Not started", tone: "muted" as const })} /></Td>
                    <Td><Link to={`/review/${sheet.id}`} onClick={(e) => e.stopPropagation()} className="text-[13px] font-medium text-primary hover:underline">Review</Link></Td>
                  </Tr>;
                })}</tbody>
              </Table>
              <div className="border-t border-border px-4 py-3"><ButtonLink to={`/review/${nextCopies[0].id}`} variant="primary" iconRight={<ArrowRight size={15} strokeWidth={ICON} />}>Start reviewing</ButtonLink></div>
            </>
          )}
        </Panel>
        <Panel title="Notifications" actions={<ButtonLink to="/notifications" variant="ghost" size="sm">View all</ButtonLink>} flush>
          {recentNotifications.length ? <ul className="divide-y divide-border">{recentNotifications.map((item) => <li key={item.id}><Link to={item.href} className="flex gap-2.5 px-4 py-3 hover:bg-subtle">
            <span className="mt-1.5 w-2 shrink-0">{!item.read && <span className="block h-2 w-2 rounded-full bg-primary" />}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-ink">{item.title}</span><span className="block text-xs text-ink-3">{item.body}</span></span><span className="shrink-0 text-[11px] text-ink-3">{relTime(item.at)}</span>
          </Link></li>)}</ul> : <EmptyState icon={<Bell size={26} strokeWidth={ICON} />} title="No notifications" />}
          {unreadNotifications.length > 0 && <p className="border-t border-border px-4 py-2 text-xs text-ink-3">{unreadNotifications.length} unread</p>}
        </Panel>
      </div>
      <StatStrip items={statItems} className="mb-5" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="My assessments" actions={<ButtonLink to="/teacher/assessments" variant="ghost" size="sm">View all</ButtonLink>} flush>
          {assignedAssessments.length ? <Table><thead><tr><Th sticky>Assessment</Th><Th>Status</Th><Th className="w-48">My copy progress</Th><Th>Deadline</Th></tr></thead><tbody>
            {assignedAssessments.map((assessment) => {
              const copies = state.sheets.filter((s) => s.assessmentId === assessment.id && s.teacherId === me.id);
              const evaluated = copies.filter((s) => s.evaluation === "evaluated").length;
              const done = copies.filter((s) => s.verification === "verified").length;
              return <Tr key={assessment.id} onClick={() => navigate(`/assessments/${assessment.id}`)}><Td sticky><span className="font-medium text-ink">{assessment.name}</span><span className="block text-xs text-ink-3">Class {assessment.grade} · {assessment.subject}</span></Td><Td><StatusText {...ASSESSMENT_STATUS[assessmentStatus(assessment, state.sheets)]} /></Td><Td><StackBar total={Math.max(copies.length, 1)} parts={[{ value: done, cls: "bg-primary", label: "Verified" }, { value: Math.max(0, evaluated - done), cls: "bg-primary/30", label: "AI evaluated" }, { value: copies.length - evaluated, cls: "bg-ink-4/50", label: "Processing" }]} /><span className="mt-1 block text-xs text-ink-3">{done} of {copies.length} verified</span></Td><Td>{assessment.deadline ? fmtShortDate(assessment.deadline) : <span className="text-ink-4">Not set</span>}</Td></Tr>;
            })}
          </tbody></Table> : <EmptyState title="No assigned assessments" body="Assessments assigned to you will appear here." />}
        </Panel>
        <Panel title="Setup to finish" flush>
          {ownedSetup.length ? <ul className="divide-y divide-border">{ownedSetup.map((assessment) => {
            const step = assessment.answerKey.status !== "approved" ? "answer-key" : "rubric";
            const label = step === "answer-key" ? "Answer key needs approval" : "Rubric needs approval";
            return <li key={assessment.id}><Link to={`/assessments/${assessment.id}/setup/${step}`} className="block px-4 py-3 hover:bg-subtle"><span className="block text-[13px] font-medium text-ink">{assessment.name}</span><span className="text-xs text-warning">{label} · Class {assessment.grade}</span></Link></li>;
          })}</ul> : <p className="px-4 py-6 text-center text-[13px] text-ink-3">Your assessment setup is up to date.</p>}
        </Panel>
      </div>
    </Page>
  );
}
