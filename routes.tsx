import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import Shell from "./components/Shell";
import { useStore } from "./data/store";
import { ButtonLink, EmptyState } from "./components/ui";

// Public
import Login from "./screens/Login";
import StudentResult from "./screens/StudentResult";
import ParentResult from "./screens/ParentResult";
import PrincipalDashboard from "./screens/PrincipalDashboard";
// Admin + teacher
import AdminOverview from "./screens/AdminOverview";
import TeacherDashboard from "./screens/TeacherDashboard";
import AssessmentsList from "./screens/AssessmentsList";
import AssessmentDetail from "./screens/AssessmentDetail";
import AssessmentStudents from "./screens/AssessmentStudents";
import AssessmentWizard from "./screens/AssessmentWizard";
import QuestionPaper from "./screens/QuestionPaper";
import AnswerKey from "./screens/AnswerKey";
import Rubric from "./screens/Rubric";
import SetupList from "./screens/SetupList";
import UnmatchedQueue from "./screens/UnmatchedQueue";
import Students from "./screens/Students";
import CheckedCopy from "./screens/CheckedCopy";
import TeacherAssignment from "./screens/TeacherAssignment";
import Verification from "./screens/Verification";
import Distribution from "./screens/Distribution";
import ReviewWorkspace from "./screens/ReviewWorkspace";
import TeacherCopies from "./screens/TeacherCopies";
import Notifications from "./screens/Notifications";
import Reports from "./screens/Reports";
import AuditLog from "./screens/AuditLog";
import Settings from "./screens/Settings";

function Home() {
  const { role } = useStore();
  return <Navigate to={role === "admin" ? "/admin" : "/teacher"} replace />;
}

/** Old upload / processing URLs now live inside each assessment. */
function UploadsRedirect() {
  const [params] = useSearchParams();
  const asm = params.get("assessment");
  return <Navigate to={asm ? `/assessments/${asm}/students` : "/assessments"} replace />;
}
function SheetsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/assessments/${id}/students`} replace />;
}

function NotFound() {
  const { role } = useStore();
  return (
    <EmptyState
      className="py-24"
      title="Page not found"
      body="The link may be out of date, or you may not have access to it."
      action={<ButtonLink to={role === "admin" ? "/admin" : "/teacher"} variant="primary">Go to dashboard</ButtonLink>}
    />
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/result/:sheetId" element={<StudentResult />} />
      <Route path="/r/:token" element={<ParentResult />} />
      <Route path="/principal" element={<PrincipalDashboard />} />

      <Route element={<Shell />}>
        {/* Exam Cell */}
        <Route path="/admin" element={<AdminOverview />} />
        <Route path="/assessments" element={<AssessmentsList />} />
        <Route path="/assessments/new" element={<AssessmentWizard />} />
        <Route path="/assessments/:id/create/:step" element={<AssessmentWizard />} />
        <Route path="/assessments/:id" element={<AssessmentDetail />} />
        <Route path="/assessments/:id/students" element={<AssessmentStudents />} />
        <Route path="/assessments/:id/sheets" element={<SheetsRedirect />} />
        <Route path="/assessments/:id/setup/paper" element={<QuestionPaper />} />
        <Route path="/assessments/:id/setup/answer-key" element={<AnswerKey />} />
        <Route path="/assessments/:id/setup/rubric" element={<Rubric />} />
        <Route path="/uploads" element={<UploadsRedirect />} />
        <Route path="/uploads/new" element={<UploadsRedirect />} />
        <Route path="/uploads/:batchId" element={<UploadsRedirect />} />
        <Route path="/unmatched" element={<UnmatchedQueue />} />
        <Route path="/queue" element={<UploadsRedirect />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/:studentId/copies/:sheetId" element={<CheckedCopy />} />
        <Route path="/teachers" element={<TeacherAssignment />} />
        <Route path="/verification" element={<Verification />} />
        <Route path="/distribution" element={<Distribution />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* Teacher */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/assessments" element={<AssessmentsList />} />
        <Route path="/teacher/answer-keys" element={<SetupList kind="answer-key" />} />
        <Route path="/teacher/rubrics" element={<SetupList kind="rubric" />} />
        <Route path="/teacher/pending" element={<TeacherCopies view="pending" />} />
        <Route path="/teacher/verified" element={<TeacherCopies view="verified" />} />
        <Route path="/teacher/reports" element={<Reports />} />
        <Route path="/review/:sheetId" element={<ReviewWorkspace />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
