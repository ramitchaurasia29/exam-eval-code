import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../data/store";
import { pct, sheetTotal } from "../data/selectors";
import { Button, EmptyState, Page, PageHeader, Panel, SearchInput, Select, StatStrip, Table, Td, Th, Tr, Tabs } from "../components/ui";
import type { AnswerSheet } from "../data/types";

type TabId = "results" | "classes" | "students" | "teachers" | "corrections" | "exceptions" | "sms";
type Row = Record<string, string | number>;
function downloadCsv(rows: Row[], filename: string) {
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function Reports() {
  const { state, me, role } = useStore();
  const location = useLocation();
  const teacher = location.pathname.startsWith("/teacher/") || role === "teacher";
  const [scope, setScope] = useState("all");
  const [tab, setTab] = useState<TabId>("results");
  const [query, setQuery] = useState("");
  const assessments = state.assessments.filter((a) => !a.archived && (!teacher || a.teacherIds.includes(me.id)));
  const selected = assessments.filter((a) => scope === "all" || a.id === scope);
  const ids = new Set(selected.map((a) => a.id));
  const sheets = state.sheets.filter((s) => ids.has(s.assessmentId));
  const sheetTotalPct = (s: AnswerSheet) => { const a = state.assessments.find((x) => x.id === s.assessmentId); return a ? pct(sheetTotal(s), a.totalMarks) : 0; };
  const resultRows = selected.map((a) => {
    const own = sheets.filter((s) => s.assessmentId === a.id && s.evaluation === "evaluated");
    const values = own.map((s) => sheetTotalPct(s));
    return { Assessment: a.name, Class: a.grade, Subject: a.subject, "Copies evaluated": own.length, "Average %": values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0, Highest: values.length ? Math.max(...values) : 0, Lowest: values.length ? Math.min(...values) : 0, "Pass rate ≥33%": values.length ? pct(values.filter((v) => v >= 33).length, values.length) : 0, "Verified %": own.length ? pct(own.filter((s) => s.verification === "verified").length, own.length) : 0 };
  });
  const classGroups = new Map<string, { sum: number; count: number }>();
  sheets.filter((s) => s.evaluation === "evaluated").forEach((s) => { const st = state.students.find((x) => x.id === s.studentId); const a = selected.find((x) => x.id === s.assessmentId); if (!st || !a) return; const key = `Class ${st.grade}${st.section} · ${a.subject}`; const g = classGroups.get(key) ?? { sum: 0, count: 0 }; g.sum += sheetTotalPct(s); g.count++; classGroups.set(key, g); });
  const classData = [...classGroups].map(([label, v]) => ({ label, average: Math.round(v.sum / v.count) })).sort((a, b) => b.average - a.average || a.label.localeCompare(b.label));
  const studentRows = sheets.filter((s) => s.evaluation === "evaluated").map((s) => { const st = state.students.find((x) => x.id === s.studentId); const a = selected.find((x) => x.id === s.assessmentId); const d = state.distributions.filter((x) => x.sheetId === s.id).sort((x, y) => y.sentAt.localeCompare(x.sentAt))[0]; return { Student: st?.name ?? "Unknown", Class: st ? `${st.grade}${st.section}` : "", Roll: st?.roll ?? 0, Assessment: a?.name ?? "", Marks: sheetTotal(s), Total: a?.totalMarks ?? 0, "Percent %": sheetTotalPct(s), Verification: s.verification, _id: s.id, _teacher: s.teacherId, _d: d?.verified ? "Verified" : "Provisional" }; }).filter((r) => `${r.Student} ${r.Class} ${r.Roll} ${r.Assessment}`.toLowerCase().includes(query.toLowerCase()));
  const teachers = state.users.filter((u) => u.role === "teacher" && selected.some((a) => a.teacherIds.includes(u.id)));
  const teacherRows = teachers.map((u) => { const assigned = sheets.filter((s) => s.teacherId === u.id); const verified = assigned.filter((s) => s.verification === "verified").length; return { Teacher: u.name, Assigned: assigned.length, Verified: verified, Pending: assigned.filter((s) => s.evaluation === "evaluated" && s.verification !== "verified").length, Reopened: assigned.filter((s) => s.verification === "reopened").length, "Completion %": assigned.length ? pct(verified, assigned.length) : 0 }; });
  const correctionRows: Row[] = [];
  selected.forEach((a) => a.questions.forEach((q) => { const evals = sheets.flatMap((s) => s.assessmentId === a.id ? s.questions.filter((e) => e.qid === q.id) : []); correctionRows.push({ Assessment: a.name, Question: q.number, "AI average": evals.length ? (evals.reduce((n, e) => n + e.aiAwarded, 0) / evals.length).toFixed(1) : "0.0", "Final average": evals.length ? (evals.reduce((n, e) => n + e.awarded, 0) / evals.length).toFixed(1) : "0.0", "Copies edited": evals.filter((e) => e.edited).length, "Most common reason": (() => { const reasons = evals.filter((e) => e.editReason).map((e) => e.editReason!); return reasons.sort((x, y) => reasons.filter((z) => z === y).length - reasons.filter((z) => z === x).length)[0] ?? "—"; })() }); }));
  const correctionEvals = sheets.flatMap((s) => s.questions);
  const correctionTotals = { copies: correctionEvals.length, ai: correctionEvals.reduce((sum, e) => sum + e.aiAwarded, 0), final: correctionEvals.reduce((sum, e) => sum + e.awarded, 0), edited: correctionEvals.filter((e) => e.edited).length };
  const exceptionRows = sheets.filter((s) => s.evaluation === "failed" || s.evaluation === "needs_review").map((s) => ({ Type: s.evaluation === "failed" ? "Failed copy" : "Needs review", Student: state.students.find((x) => x.id === s.studentId)?.name ?? "Unknown", Assessment: state.assessments.find((x) => x.id === s.assessmentId)?.name ?? "", Reason: s.error ?? "Review required", Link: `/review/${s.id}` }));
  state.unmatched.filter((u) => u.status === "open" && ids.has(u.assessmentId)).forEach((u) => exceptionRows.push({ Type: "Unmatched booklet", Student: u.coverName ?? "Unidentified", Assessment: state.assessments.find((x) => x.id === u.assessmentId)?.name ?? "", Reason: u.reason.replace(/_/g, " "), Link: "/unmatched" }));
  const smsRows = selected.map((a) => { const dists = state.distributions.filter((d) => d.assessmentId === a.id); const latest = dists.filter((d) => state.distributions.every((x) => x.sheetId !== d.sheetId || x.sentAt <= d.sentAt)); return { Assessment: a.name, Delivered: latest.filter((d) => d.status === "delivered").length, Failed: latest.filter((d) => d.status === "failed").length, Skipped: latest.filter((d) => d.status === "skipped").length, Opened: latest.filter((d) => !!d.openedAt).length }; });
  const tabItems = [{ id: "results" as const, label: "Assessment results" }, { id: "classes" as const, label: "Class & subject" }, { id: "students" as const, label: "Student marks" }, ...(!teacher ? [{ id: "teachers" as const, label: "Teacher progress" }] : []), { id: "corrections" as const, label: "AI corrections" }, { id: "exceptions" as const, label: "Processing exceptions" }, { id: "sms" as const, label: "SMS delivery" }];
  const activeRows: Row[] = useMemo((): Row[] => tab === "results" ? resultRows : tab === "students" ? studentRows.map(({ _id, _teacher, _d, ...r }) => r) : tab === "classes" ? classData.map((d) => ({ "Class & subject": d.label, "Average %": d.average })) : tab === "teachers" ? teacherRows : tab === "corrections" ? correctionRows : tab === "exceptions" ? exceptionRows : smsRows, [tab, scope, query, state]);
  const visible = activeRows;
  const columns = visible[0] ? Object.keys(visible[0]) : [];
  return <Page wide><PageHeader title={teacher ? "Reports" : "Reports & analytics"} actions={<><Select aria-label="Assessment scope" value={scope} onChange={(e) => setScope(e.target.value)} className="w-full sm:w-64"><option value="all">All assessments</option>{assessments.map((a) => <option key={a.id} value={a.id}>{a.name} · Class {a.grade}</option>)}</Select><Button onClick={() => downloadCsv(visible, `report-${tab}.csv`)}>Export CSV</Button><Button onClick={() => window.print()}>Export PDF</Button></>} />
    <Tabs items={tabItems} value={tab} onChange={(v) => setTab(v)} className="mb-4" />
    {tab === "students" && <SearchInput label="Search students" value={query} onChange={setQuery} placeholder="Search name, class, roll or assessment" className="mb-3 max-w-sm" />}
    {tab === "corrections" && <StatStrip className="mb-4" items={[{ label: "Question evaluations", value: correctionTotals.copies }, { label: "AI marks", value: correctionTotals.ai }, { label: "Final marks", value: correctionTotals.final }, { label: "Edited evaluations", value: correctionTotals.edited }]} />}
    {tab === "classes" && <Panel title="Average marks by class and subject" className="mb-4"><div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={classData} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: "var(--color-ink-3)", fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={55} /><YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "var(--color-ink-3)", fontSize: 11 }} /><Tooltip formatter={(v) => [`${v}%`, "Average"]} /><Bar dataKey="average" fill="var(--color-primary)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>}
    {tab === "students" ? visible.length ? <Panel flush><Table><thead><tr>{columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead><tbody>{visible.map((row, i) => <Tr key={i}>{columns.map((c) => <Td key={c}>{c === "Link" ? <Link className="text-primary hover:underline" to={String(row[c])}>Open</Link> : String(row[c] ?? "")}</Td>)}</Tr>)}</tbody></Table></Panel> : <EmptyState title="No student marks found" body="Try another search or assessment scope." /> : visible.length ? <Panel flush><Table><thead><tr>{columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead><tbody>{visible.map((row, i) => <Tr key={i}>{columns.map((c) => <Td key={c}>{c === "Link" ? <Link className="text-primary hover:underline" to={String(row[c])}>Open</Link> : String(row[c] ?? "")}</Td>)}</Tr>)}</tbody></Table></Panel> : <EmptyState title="No report data available" body="Results will appear here as copies are evaluated and released." />}
    {tab === "classes" && classData.length > 0 && <Panel title="Class summary" className="mt-4" flush><Table><thead><tr><Th>Class & subject</Th><Th align="right">Average %</Th></tr></thead><tbody>{classData.map((r) => <Tr key={r.label}><Td>{r.label}</Td><Td align="right">{r.average}%</Td></Tr>)}</tbody></Table></Panel>}
  </Page>;
}
