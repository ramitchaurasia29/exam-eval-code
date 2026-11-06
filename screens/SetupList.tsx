import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../data/store";
import type { Assessment } from "../data/types";
import { fmtShortDate } from "../data/selectors";
import { Button, EmptyState, Page, PageHeader, StatusText, Table, Tabs, Td, Th, Tr } from "../components/ui";
import { useScreenInit } from "../useScreenInit";

type Kind = "answer-key" | "rubric";
type Tab = "needs" | "approved";

export default function SetupList({ kind }: { kind: Kind }) {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const init = useScreenInit();
  const [tab, setTab] = useState<Tab>(init.tab === "approved" ? "approved" : "needs");
  const owned = useMemo(() => state.assessments.filter((a) => me.role === "admin" || a.ownerId === me.id || a.teacherIds.includes(me.id)), [state.assessments, me]);
  const approvedOf = (a: Assessment) => (kind === "answer-key" ? a.answerKey.status : a.rubric.status) === "approved";
  const approvedCount = owned.filter(approvedOf).length;
  const needsCount = owned.length - approvedCount;
  const rows = owned.filter((a) => approvedOf(a) === (tab === "approved"));
  const title = kind === "answer-key" ? "Answer keys" : "Rubric management";
  const open = (a: Assessment) => navigate(`/assessments/${a.id}/setup/${kind}`);
  const statusFor = (a: Assessment) => kind === "answer-key" ? a.answerKey.status : a.rubric.status;
  const reasonFor = (a: Assessment) => {
    if (!a.paper || !a.questionsConfirmed) return "Confirm the question paper first";
    if (kind === "rubric" && a.answerKey.status !== "approved") return "Approve the answer key first";
    return "";
  };
  const source = (a: Assessment) => a.answerKey.mode === "ai" ? "AI" : a.answerKey.mode === "manual" ? "Teacher-prepared" : "—";
  const approvedBy = (a: Assessment) => {
    const id = kind === "answer-key" ? a.answerKey.approvedBy : a.rubric.approvedBy;
    const date = kind === "answer-key" ? a.answerKey.approvedAt : a.rubric.approvedAt;
    return id ? <><span className="block">{state.users.find((u) => u.id === id)?.name ?? id}</span><span className="block text-xs text-ink-3">{fmtShortDate(date)}</span></> : <span className="text-ink-4">—</span>;
  };

  return <Page>
    <PageHeader title={title} meta={<span>{kind === "answer-key" ? "Review and approve answer keys for your assessments." : "Manage marking criteria and approved rubric versions."}</span>} />
    <Tabs items={[{ id: "needs", label: "Needs action", count: needsCount }, { id: "approved", label: "Approved", count: approvedCount }]} value={tab} onChange={setTab} className="mb-4" />
    {!rows.length ? <div className="rounded-lg border border-border bg-surface"><EmptyState title={tab === "approved" ? "No approved items" : "Nothing needs action"} body={tab === "approved" ? "Approved setup items will appear here." : "All available setup items are approved."} /></div> : <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <Table><thead><tr><Th sticky>Assessment</Th><Th>Subject</Th><Th>Status</Th><Th>Version</Th>{kind === "answer-key" && <Th>Source</Th>}<Th align="right">Questions</Th><Th>Approved</Th><Th align="right">Action</Th></tr></thead>
        <tbody>{rows.map((a) => {
          const status = statusFor(a);
          const info = status === "approved" ? { label: "Approved", tone: "success" as const } : status === "draft" ? { label: "Draft", tone: "warning" as const } : status === "generating" ? { label: "Generating", tone: "info" as const } : { label: "None", tone: "muted" as const };
          const version = kind === "answer-key" ? a.answerKey.version : a.rubric.version;
          const blocked = reasonFor(a);
          return <Tr key={a.id} onClick={() => open(a)}><Td sticky className="max-w-64"><span className="block truncate font-medium text-ink">{a.name}</span><span className="block text-xs text-ink-3">Class {a.grade} · {a.sections.join(", ")}</span>{blocked && <span className="mt-0.5 block text-xs text-ink-4">{blocked}</span>}</Td><Td>{a.subject}</Td><Td><StatusText {...info} /></Td><Td>{version ? `v${version}` : "—"}</Td>{kind === "answer-key" && <Td>{source(a)}</Td>}<Td align="right">{a.questions.length}</Td><Td>{approvedBy(a)}</Td><Td align="right"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); open(a); }}>Open</Button></Td></Tr>;
        })}</tbody>
      </Table>
    </div>}
  </Page>;
}
