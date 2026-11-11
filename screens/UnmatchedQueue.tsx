import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ScanLine } from "lucide-react";
import { useStore } from "../data/store";
import { UNMATCHED_REASON, cohortOf, fmtDateTime } from "../data/selectors";
import { Barcode } from "../components/booklet";
import { Button, ButtonLink, Dialog, EmptyState, Field, ICON, Input, Panel, SearchInput, Segmented, Tabs, Textarea, cx } from "../components/ui";
import { useScreenInit } from "../useScreenInit";

type QueueView = "open" | "resolved";
export default function UnmatchedQueue() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const init = useScreenInit();
  const [searchParams] = useSearchParams();
  const openCount = state.unmatched.filter((u) => u.status === "open").length;
  const resolvedCount = state.unmatched.filter((u) => u.status !== "open").length;
  const [view, setView] = useState<QueueView>("open");
  const items = useMemo(() => state.unmatched.filter((u) => view === "open" ? u.status === "open" : u.status !== "open"), [state.unmatched, view]);
  const requested = String(init.itemId ?? searchParams.get("itemId") ?? "");
  const [selectedId, setSelectedId] = useState(requested);
  const [barcode, setBarcode] = useState("");
  const [lookupStudentId, setLookupStudentId] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardNote, setDiscardNote] = useState("");
  const [discardError, setDiscardError] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);
  useEffect(() => { if (requested) { setSelectedId(requested); setView(state.unmatched.some((x) => x.id === requested && x.status === "open") ? "open" : "resolved"); } }, [requested]);
  useEffect(() => { if (!items.some((x) => x.id === selectedId)) setSelectedId(items[0]?.id ?? ""); }, [items, selectedId]);
  const item = state.unmatched.find((x) => x.id === selectedId);
  const assessment = item && state.assessments.find((a) => a.id === item.assessmentId);
  const batch = item && state.batches.find((b) => b.id === item.batchId);
  const cohort = assessment ? cohortOf(assessment, state.students) : [];
  const studentMatches = cohort.filter((s) => `${s.name} ${s.roll} `.toLowerCase().includes(studentQuery.trim().toLowerCase())).slice(0, 6);
  const suggested = item?.suggestedStudentId ? state.students.find((s) => s.id === item.suggestedStudentId) : undefined;
  const decodedStudent = item?.decoded ? actions.lookupBarcode(item.decoded) : undefined;
  const mappedStudent = item?.resolvedStudentId ? state.students.find((s) => s.id === item.resolvedStudentId) : undefined;
  const onSelect = (id: string, nextView = view) => { setView(nextView); setSelectedId(id); setMobileDetail(true); setActionError(""); setBarcodeError(""); setLookupStudentId(""); setStudentQuery(""); };
  const mapTo = (studentId: string) => {
    if (!item) return;
    setActionError("");
    const result = actions.resolveUnmatched(item.id, studentId);
    if (!result.ok) { setActionError(result.error); return; }
    const name = state.students.find((s) => s.id === studentId)?.name ?? "student";
    actions.toast(`Booklet mapped to ${name} · queued for evaluation`, { tone: "success" });
    const next = state.unmatched.find((u) => u.status === "open" && u.id !== item.id);
    if (next) onSelect(next.id, "open"); else { setSelectedId(""); setMobileDetail(false); }
  };
  const findBarcode = () => {
    setBarcodeError(""); setLookupStudentId("");
    const found = actions.lookupBarcode(barcode.trim());
    if (!found) setBarcodeError(`No student has barcode ${barcode.trim() || "entered value"}`);
    else setLookupStudentId(found.id);
  };
  const discard = () => {
    if (!item || !discardNote.trim()) { setDiscardError("Add a note explaining why this booklet is discarded"); return; }
    actions.discardUnmatched(item.id, discardNote.trim());
    actions.toast("Booklet discarded"); setDiscardOpen(false); setDiscardNote(""); setDiscardError("");
    const next = state.unmatched.find((u) => u.status === "open" && u.id !== item.id);
    if (next) onSelect(next.id, "open"); else { setSelectedId(""); setMobileDetail(false); }
  };
  const list = <Panel className="min-h-[460px]" title={view === "open" ? "Open booklets" : "Resolved booklets"} flush>
    {items.length === 0 ? <EmptyState icon={<ScanLine size={23} strokeWidth={ICON} />} title={view === "open" ? "All booklets identified" : "No resolved booklets"} body={view === "open" ? "No unidentified copy enters evaluation." : "Mapped and discarded booklets will appear here."} action={view === "open" ? <ButtonLink to="/assessments" variant="primary">Back to assessments</ButtonLink> : undefined} /> : <ul className="divide-y divide-border">{items.map((u) => {
      const a = state.assessments.find((x) => x.id === u.assessmentId);
      const b = state.batches.find((x) => x.id === u.batchId);
      return <li key={u.id}><button onClick={() => onSelect(u.id)} aria-current={selectedId === u.id ? "true" : undefined} className={cx("w-full px-3 py-3 text-left transition-colors hover:bg-subtle", selectedId === u.id && "bg-primary-soft/60")}><span className="flex items-start justify-between gap-2"><span className={cx("text-xs font-medium", u.status === "discarded" ? "text-ink-3" : u.status === "resolved" ? "text-success" : "text-warning")}>{u.status === "open" ? UNMATCHED_REASON[u.reason].label : u.status === "discarded" ? "Discarded" : "Mapped"}</span><span className="text-[11px] text-ink-3">Pages {u.pagesFrom}–{u.pagesTo}</span></span><span className="mt-1 block truncate text-[13px] font-medium text-ink">{a?.name ?? "Assessment"} · Class {a?.grade}</span><span className="mt-0.5 block truncate text-xs text-ink-3">{b?.fileName}</span><span className="mt-1 block truncate font-mono text-[11px] text-ink-2">{u.decoded ?? "No barcode"}</span></button></li>;
    })}</ul>}
  </Panel>;
  const detail = !item ? <Panel className="min-h-[460px]"><EmptyState icon={<ScanLine size={24} strokeWidth={ICON} />} title={view === "open" ? "All booklets identified" : "Select a booklet"} body="Choose a booklet from the list to view its mapping details." action={view === "open" ? <ButtonLink to="/assessments" variant="primary">Back to assessments</ButtonLink> : undefined} /></Panel> : <Panel className="min-h-[460px]" title={<div className="flex items-center gap-2"><span>{UNMATCHED_REASON[item.reason].label}</span><span className="text-xs font-normal text-ink-3">Pages {item.pagesFrom}–{item.pagesTo}</span></div>} flush>
    <div className="space-y-4 p-4">
      <div className="rounded-md border border-border bg-muted p-3">
        <div className="mx-auto max-w-[270px] rounded-sm bg-paper p-4 shadow-page">
          <p className="mb-3 border-b border-border pb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-3">Answer booklet · Class {assessment?.grade}</p>
          <p className="text-xs text-ink-3">Name: <span className="font-hand text-base text-pen">{item.coverName ?? "________________"}</span></p>
          <p className="mt-1 text-xs text-ink-3">Roll no: <span className="font-hand text-base text-pen">{item.coverRoll ?? "________"}</span></p>
          <div className="mt-4 flex min-h-14 items-center justify-center border-t border-border pt-3">{item.decoded ? <Barcode value={item.decoded} height={56} /> : <div className="flex h-12 w-full items-center justify-center rounded-sm border border-dashed border-border-strong text-xs text-ink-4"><ScanLine size={15} strokeWidth={ICON} className="mr-1.5" />QR code not detected</div>}</div>
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-3">{batch?.fileName ?? "Source PDF"}</p>
      </div>
      {item.status !== "open" ? <div className="space-y-3 rounded-md border border-border p-3"><p className="text-[13px] font-medium text-ink">{item.status === "discarded" ? "Booklet discarded" : `Mapped to ${mappedStudent?.name ?? "student"}`}</p><p className="text-xs text-ink-3">{item.resolvedBy ? state.users.find((u) => u.id === item.resolvedBy)?.name : "Exam Cell"} · {fmtDateTime(item.resolvedAt)}</p>{mappedStudent && <p className="text-xs text-ink-3">Class {mappedStudent.grade}{mappedStudent.section} · Roll no {mappedStudent.roll} · {mappedStudent.barcode}</p>}{item.note && <p className="rounded bg-subtle p-2 text-xs text-ink-2">{item.note}</p>}{item.status === "discarded" && <Button variant="secondary" onClick={() => { actions.reopenUnmatched(item.id); actions.toast("Booklet returned to open mapping"); }}>Undo discard</Button>}</div> : <>
        <p className="text-[13px] leading-relaxed text-ink-2">{UNMATCHED_REASON[item.reason].help}{item.reason === "not_in_cohort" && item.decoded && <span className="mt-1 block">{decodedStudent ? `This barcode belongs to ${decodedStudent.name}, Class ${decodedStudent.grade}${decodedStudent.section}.` : `The decoded barcode is outside Class ${assessment?.grade} and its sections.`} Map it to a student in this assessment cohort or discard the booklet.</span>}</p>
        {suggested && item.reason !== "duplicate_barcode" && <div className="rounded-md border border-border bg-subtle p-3"><p className="text-xs text-ink-3">Cover reads {item.coverName ?? suggested.name}{item.coverRoll ? `, roll no ${item.coverRoll}` : ""}</p><p className="mt-1 text-[13px] font-medium text-ink">{suggested.name} · Class {suggested.grade}{suggested.section} · Roll no {suggested.roll}</p><p className="font-mono text-[11px] text-ink-3">{suggested.barcode}</p><Button className="mt-2" variant="primary" size="sm" onClick={() => mapTo(suggested.id)}>Map to {suggested.name}</Button></div>}
        {item.reason === "duplicate_barcode" && <div className="rounded-md border border-warning/30 bg-warning-soft p-3"><p className="text-[13px] font-medium text-warning">A copy with this barcode is already mapped.</p>{item.conflictSheetId && <Link className="mt-1 inline-block text-[13px] text-primary hover:underline" to={`/review/${item.conflictSheetId}`}>Open existing copy</Link>}<div className="mt-2"><Button variant="danger-ghost" onClick={() => { setDiscardOpen(true); setDiscardError(""); }}>Discard this booklet</Button></div></div>}
        <div className="space-y-2 rounded-md border border-border p-3"><Field label="Enter or correct barcode" htmlFor="barcode" error={barcodeError}><div className="flex gap-2"><Input id="barcode" value={barcode} onChange={(e) => { setBarcode(e.target.value); setBarcodeError(""); setLookupStudentId(""); }} placeholder="Type barcode" /><Button onClick={findBarcode}>Look up</Button></div></Field>{lookupStudentId && (() => { const found = state.students.find((s) => s.id === lookupStudentId)!; return <div className="mt-2 rounded bg-success-soft p-2"><p className="text-[13px] font-medium text-success">{found.name} · Class {found.grade}{found.section} · Roll no {found.roll}</p><Button className="mt-2" variant="secondary" size="sm" onClick={() => mapTo(found.id)}>Map to {found.name}</Button></div>; })()}</div>
        <div className="space-y-2 rounded-md border border-border p-3"><Field label="Find student"><SearchInput label="Find student" value={studentQuery} onChange={setStudentQuery} placeholder="Name, roll or admission number" /></Field>{studentQuery && <div className="max-h-36 overflow-y-auto rounded border border-border">{studentMatches.map((s) => <button key={s.id} onClick={() => setLookupStudentId(s.id)} className={cx("flex w-full items-center justify-between px-2.5 py-2 text-left text-xs hover:bg-subtle", lookupStudentId === s.id && "bg-primary-soft")}><span className="font-medium text-ink">{s.name}</span><span className="text-ink-3">{s.grade}{s.section} · {s.roll}</span></button>)}</div>}{lookupStudentId && !barcode && (() => { const found = state.students.find((s) => s.id === lookupStudentId)!; return <Button variant="secondary" size="sm" onClick={() => mapTo(found.id)}>Map to {found.name}</Button>; })()}</div>
        {item.reason !== "duplicate_barcode" && <Button variant="danger-ghost" onClick={() => { setDiscardOpen(true); setDiscardError(""); }}>Discard this booklet</Button>}
        {actionError && <p className="text-xs text-danger" role="alert">{actionError}</p>}
      </>}
    </div>
  </Panel>;
  return <>
    <div className="mx-auto w-full max-w-none px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-1.5 flex items-center gap-1 text-[13px] text-ink-3"><Link to="/assessments" className="hover:underline">Assessments</Link><span>›</span><span>Unmatched booklets</span></div><h1 className="text-xl font-semibold tracking-tight text-ink sm:text-[22px]">Answer sheet uploads</h1></div><ButtonLink to="/uploads/new" variant="primary">Upload PDF</ButtonLink></div>
      <Tabs items={[{ id: "batches", label: "Batches" }, { id: "unmatched", label: "Unmatched booklets", count: openCount }]} value="unmatched" onChange={(v) => v === "batches" && navigate("/uploads")} />
      <div className="my-4 flex items-center justify-between gap-3"><Segmented items={[{ id: "open", label: `Open · ${openCount}` }, { id: "resolved", label: `Resolved · ${resolvedCount}` }]} value={view} onChange={(v) => { setView(v); setSelectedId(""); setMobileDetail(false); }} /><span className="text-xs text-ink-3">{items.length} {items.length === 1 ? "booklet" : "booklets"}</span></div>
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]"><div className={cx(mobileDetail && "hidden lg:block")}>{list}</div><div className={cx(!mobileDetail && "hidden lg:block")}><div className="mb-2 lg:hidden"><Button variant="ghost" size="sm" onClick={() => setMobileDetail(false)}><ArrowLeft size={15} strokeWidth={ICON} />Back to list</Button></div>{detail}</div></div>
    </div>
    <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)} title="Discard this booklet?" size="sm" footer={<><Button variant="ghost" onClick={() => setDiscardOpen(false)}>Cancel</Button><Button variant="danger" onClick={discard}>Discard booklet</Button></>}><div className="space-y-3"><p>This booklet will remain in the audit trail and will not enter evaluation.</p><Field label="Required note" htmlFor="discard-note" error={discardError}><Textarea id="discard-note" value={discardNote} onChange={(e) => setDiscardNote(e.target.value)} placeholder="Why is this booklet being discarded?" /></Field></div></Dialog>
  </>;
}
