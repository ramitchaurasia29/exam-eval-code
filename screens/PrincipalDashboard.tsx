import { useMemo, useState } from "react";
import { PublicFrame } from "../components/Shell";
import { useStore } from "../data/store";
import { QTYPE_LABEL, pct, sheetTotal } from "../data/selectors";
import type { Assessment, Question } from "../data/types";
import { Button, Drawer, EmptyState, Progress, Segmented, Select, Switch, Table, Td, Th, Tr, Tag, cx } from "../components/ui";

const PASS = 33; // same pass mark the Reports screen uses
const WEAK = 50; // below this an average is called out
const GAP = 15; // percentage-point difference between sections worth flagging
const MIN_N = 3; // fewest answers before a question/concept is ranked

interface Agg { sum: number; n: number }
interface QStat { key: string; asm: Assessment; q: Question; n: number; sum: number; full: number; zero: number; secs: Record<string, Agg>; crit: Record<string, { hit: number; secs: Record<string, Agg> }> }

const avgPct = (a?: Agg, max = 1) => (a && a.n > 0 && max > 0 ? Math.round((a.sum / (a.n * max)) * 100) : null);
const tone = (v: number | null) => (v === null ? "text-ink-4" : v < WEAK ? "bg-danger-soft font-medium text-danger" : v < 65 ? "bg-warning-soft text-warning" : "text-ink");
const Pct = ({ v }: { v: number | null }) => <span className={cx("inline-block min-w-[3rem] rounded-sm px-1.5 py-0.5 text-right tabular-nums", tone(v))}>{v === null ? "—" : `${v}%`}</span>;

export default function PrincipalDashboard() {
  const { state } = useStore();
  const [examId, setExamId] = useState("all");
  const [grade, setGrade] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [lens, setLens] = useState<"questions" | "concepts">("questions");
  const [order, setOrder] = useState<"weakest" | "paper">("weakest");
  const [openKey, setOpenKey] = useState("");

  const exams = state.assessments.filter((a) => !a.archived);
  const grades = Array.from(new Set(exams.map((a) => a.grade))).sort((a, b) => Number(a) - Number(b));
  const scope = exams.filter((a) => (examId === "all" || a.id === examId) && (grade === "all" || a.grade === grade));

  const data = useMemo(() => {
    const ids = new Set(scope.map((a) => a.id));
    const studentById = new Map(state.students.map((s) => [s.id, s]));
    const sheets = state.sheets.filter((s) => ids.has(s.assessmentId) && s.evaluation === "evaluated" && (!verifiedOnly || s.verification === "verified"));
    const sections = new Set<string>();
    const asmById = new Map(scope.map((a) => [a.id, a]));
    // section comparison rows
    const groups = new Map<string, { asm: Assessment; section: string; pcts: number[] }>();
    // question stats
    const qs = new Map<string, QStat>();
    for (const sh of sheets) {
      const asm = asmById.get(sh.assessmentId);
      const st = studentById.get(sh.studentId);
      if (!asm || !st) continue;
      sections.add(st.section);
      const gk = `${asm.id}|${st.section}`;
      const g = groups.get(gk) ?? { asm, section: st.section, pcts: [] };
      g.pcts.push(pct(sheetTotal(sh), asm.totalMarks));
      groups.set(gk, g);
      for (const qe of sh.questions) {
        const q = asm.questions.find((x) => x.id === qe.qid);
        if (!q || q.marks <= 0) continue;
        const key = `${asm.id}|${q.id}`;
        const s = qs.get(key) ?? { key, asm, q, n: 0, sum: 0, full: 0, zero: 0, secs: {}, crit: {} };
        s.n++; s.sum += qe.awarded;
        if (qe.awarded >= q.marks) s.full++;
        if (qe.awarded === 0) s.zero++;
        const sa = (s.secs[st.section] ??= { sum: 0, n: 0 }); sa.sum += qe.awarded; sa.n++;
        for (const c of q.criteria) {
          const cs = (s.crit[c.id] ??= { hit: 0, secs: {} });
          const hit = qe.matched.includes(c.id) ? 1 : 0;
          cs.hit += hit;
          const ca = (cs.secs[st.section] ??= { sum: 0, n: 0 }); ca.sum += hit; ca.n++;
        }
        qs.set(key, s);
      }
    }
    const sectionRows = [...groups.values()].map((g) => ({ ...g, copies: g.pcts.length, avg: Math.round(g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length), pass: pct(g.pcts.filter((p) => p >= PASS).length, g.pcts.length), high: Math.max(...g.pcts), low: Math.min(...g.pcts) })).sort((a, b) => a.avg - b.avg);
    const allPcts = [...groups.values()].flatMap((g) => g.pcts);
    return { sheets, sections: [...sections].sort(), sectionRows, stats: [...qs.values()], allPcts };
  }, [scope.map((a) => a.id).join(), state.sheets, state.students, verifiedOnly]);

  const { sections, sectionRows, stats, allPcts } = data;
  const overall = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : null;
  const passRate = allPcts.length ? pct(allPcts.filter((p) => p >= PASS).length, allPcts.length) : null;
  const ranked = stats.filter((s) => s.n >= MIN_N).map((s) => ({ s, avg: avgPct({ sum: s.sum, n: s.n }, s.q.marks) ?? 0 })).sort((a, b) => a.avg - b.avg);
  const weakestSection = sectionRows[0];
  const examLabel = (a: Assessment) => `${a.name} · Class ${a.grade}`;

  /* Weak-area rows for either lens */
  const weakRows = useMemo(() => {
    if (lens === "questions") return ranked.slice(0, 8).map(({ s, avg }) => ({ id: s.key, title: `Q${s.q.number} · ${s.q.text}`, sub: examLabel(s.asm), avg, secs: Object.fromEntries(sections.map((sec) => [sec, avgPct(s.secs[sec], s.q.marks)])) as Record<string, number | null>, open: s.key }));
    const out: { id: string; title: string; sub: string; avg: number; secs: Record<string, number | null>; open: string }[] = [];
    for (const s of stats) for (const c of s.q.criteria) {
      const cs = s.crit[c.id];
      if (!cs || s.n < MIN_N) continue;
      out.push({ id: `${s.key}|${c.id}`, title: c.label, sub: `Q${s.q.number} · ${examLabel(s.asm)}`, avg: Math.round((cs.hit / s.n) * 100), secs: Object.fromEntries(sections.map((sec) => [sec, avgPct(cs.secs[sec])])) as Record<string, number | null>, open: s.key });
    }
    return out.sort((a, b) => a.avg - b.avg).slice(0, 8);
  }, [lens, stats, sections]);

  const gapOf = (secs: Record<string, number | null>) => {
    const e = Object.entries(secs).filter((x): x is [string, number] => x[1] !== null);
    if (e.length < 2) return null;
    e.sort((a, b) => b[1] - a[1]);
    const d = e[0][1] - e[e.length - 1][1];
    return d >= GAP ? `${e[0][0]} ahead by ${d} pts` : null;
  };

  const single = examId !== "all" ? scope[0] : undefined;
  const qRows = (single ? stats.filter((s) => s.asm.id === single.id) : []).sort((a, b) => order === "paper" ? scope[0].questions.indexOf(a.q) - scope[0].questions.indexOf(b.q) : (avgPct({ sum: a.sum, n: a.n }, a.q.marks) ?? 0) - (avgPct({ sum: b.sum, n: b.n }, b.q.marks) ?? 0));
  const open = stats.find((s) => s.key === openKey);
  const verifiedCount = data.sheets.length;

  return <PublicFrame>
    <header className="border-b border-border bg-surface print:border-0">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{state.settings.schoolName} · {state.settings.academicYear}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-[22px]">Class and question-wise analysis</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center print:hidden">
          <Select aria-label="Exam" value={examId} onChange={(e) => setExamId(e.target.value)} className="w-full sm:w-64"><option value="all">All exams</option>{exams.filter((a) => grade === "all" || a.grade === grade).map((a) => <option key={a.id} value={a.id}>{examLabel(a)}</option>)}</Select>
          <Select aria-label="Class" value={grade} onChange={(e) => { setGrade(e.target.value); setExamId("all"); }} className="w-full sm:w-36"><option value="all">All classes</option>{grades.map((g) => <option key={g} value={g}>Class {g}</option>)}</Select>
          <label className="flex h-9 items-center gap-2 whitespace-nowrap text-[13px] text-ink-2"><Switch checked={verifiedOnly} onChange={setVerifiedOnly} label="Verified copies only" />Verified copies only</label>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6">
      {verifiedCount === 0 ? <div className="rounded-lg border border-border bg-surface"><EmptyState title="No evaluated copies match these filters" body={verifiedOnly ? "Try another exam or class, or include copies not yet verified by a teacher." : "Try another exam or class."} action={verifiedOnly ? <Button onClick={() => setVerifiedOnly(false)}>Include unverified copies</Button> : undefined} /></div> : <>
        <p className="text-[13px] text-ink-3">Based on {verifiedCount} {verifiedOnly ? "verified" : "evaluated"} {verifiedCount === 1 ? "copy" : "copies"} across {new Set(data.sheets.map((s) => s.assessmentId)).size} {new Set(data.sheets.map((s) => s.assessmentId)).size === 1 ? "exam" : "exams"}.{!verifiedOnly && " Includes provisional marks not yet confirmed by a teacher."}</p>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
          {[
            ["Average score", overall === null ? "—" : `${overall}%`, `${verifiedCount} copies`],
            ["Pass rate", passRate === null ? "—" : `${passRate}%`, `at ${PASS}% or above`],
            ["Weakest section", weakestSection ? `${weakestSection.asm.grade}${weakestSection.section}` : "—", weakestSection ? `${weakestSection.avg}% · ${weakestSection.asm.name}` : ""],
            ["Weakest question", ranked[0] ? `Q${ranked[0].s.q.number}` : "—", ranked[0] ? `${ranked[0].avg}% · ${ranked[0].s.asm.name}` : "Not enough answers"],
          ].map(([l, v, sub]) => <div key={l} className="bg-surface px-4 py-3.5"><dt className="text-xs text-ink-3">{l}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{v}</dd><p className="mt-0.5 truncate text-xs text-ink-3">{sub}</p></div>)}
        </dl>

        <section aria-labelledby="sec-h">
          <h2 id="sec-h" className="text-sm font-semibold text-ink">Class and section comparison</h2>
          <p className="mb-2 text-[13px] text-ink-3">Weakest first. Select a row to see its question-wise breakdown.</p>
          <div className="rounded-lg border border-border bg-surface shadow-xs">
            <Table>
              <thead><tr><Th sticky>Exam</Th><Th>Section</Th><Th align="right">Copies</Th><Th align="right">Average</Th><Th>Average, as a bar</Th><Th align="right">Pass rate</Th><Th align="right">Highest</Th><Th align="right">Lowest</Th></tr></thead>
              <tbody>{sectionRows.map((r) => <Tr key={`${r.asm.id}${r.section}`} onClick={() => setExamId(r.asm.id)}>
                <Td sticky className="font-medium text-ink"><button type="button" onClick={(e) => { e.stopPropagation(); setExamId(r.asm.id); }} className="text-left hover:underline">{r.asm.name}</button></Td>
                <Td>{r.asm.grade}{r.section}</Td><Td align="right">{r.copies}</Td><Td align="right"><Pct v={r.avg} /></Td>
                <Td><Progress className="w-32" value={r.avg} tone={r.avg < WEAK ? "danger" : "info"} label={`${r.asm.grade}${r.section} average`} /></Td>
                <Td align="right">{r.pass}%</Td><Td align="right">{r.high}%</Td><Td align="right">{r.low}%</Td>
              </Tr>)}</tbody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="weak-h">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="weak-h" className="text-sm font-semibold text-ink">Weak areas across sections</h2><p className="text-[13px] text-ink-3">Lowest-scoring {lens === "questions" ? "questions" : "rubric points"} (at least {MIN_N} answers), with each section side by side.</p></div>
            <Segmented size="sm" value={lens} onChange={setLens} items={[{ id: "questions", label: "Questions" }, { id: "concepts", label: "Rubric concepts" }]} />
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-xs">
            {weakRows.length === 0 ? <EmptyState title="Not enough answers to rank yet" body={`Needs at least ${MIN_N} evaluated answers per question.`} /> : <Table>
              <thead><tr><Th sticky>{lens === "questions" ? "Question" : "Rubric point"}</Th><Th align="right">Overall</Th>{sections.map((s) => <Th key={s} align="right">Section {s}</Th>)}<Th>Section gap</Th></tr></thead>
              <tbody>{weakRows.map((r) => { const gap = gapOf(r.secs); return <Tr key={r.id} onClick={() => setOpenKey(r.open)}>
                <Td sticky className="h-auto! min-w-[280px] max-w-[420px] whitespace-normal! py-2.5 align-top"><button type="button" onClick={(e) => { e.stopPropagation(); setOpenKey(r.open); }} className="block text-left font-medium text-ink hover:underline">{r.title}</button><span className="block text-xs text-ink-3">{r.sub}</span></Td>
                <Td align="right"><Pct v={r.avg} /></Td>
                {sections.map((s) => <Td key={s} align="right"><Pct v={r.secs[s]} /></Td>)}
                <Td>{gap ? <Tag tone="warning">{gap}</Tag> : <span className="text-ink-4">—</span>}</Td>
              </Tr>; })}</tbody>
            </Table>}
          </div>
        </section>

        <section aria-labelledby="q-h">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="q-h" className="text-sm font-semibold text-ink">Question-wise analysis</h2><p className="text-[13px] text-ink-3">{single ? examLabel(single) : "Choose one exam to see every question."}</p></div>
            {single && <Segmented size="sm" value={order} onChange={setOrder} items={[{ id: "weakest", label: "Weakest first" }, { id: "paper", label: "Paper order" }]} />}
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-xs">
            {!single ? <EmptyState title="Select an exam" body="Pick an exam in the filters above, or select a row in the comparison table." /> : <Table>
              <thead><tr><Th sticky>Question</Th><Th>Type</Th><Th align="right">Max</Th><Th align="right">Avg marks</Th><Th align="right">Average</Th><Th align="right">Full marks</Th><Th align="right">Zero</Th>{sections.map((s) => <Th key={s} align="right">Section {s}</Th>)}</tr></thead>
              <tbody>{qRows.map((s) => <Tr key={s.key} onClick={() => setOpenKey(s.key)}>
                <Td sticky className="h-auto! min-w-[280px] max-w-[420px] whitespace-normal! py-2.5 align-top"><button type="button" onClick={(e) => { e.stopPropagation(); setOpenKey(s.key); }} className="block text-left font-medium text-ink hover:underline">Q{s.q.number} · {s.q.text}</button></Td>
                <Td>{QTYPE_LABEL[s.q.type]}</Td><Td align="right">{s.q.marks}</Td><Td align="right" className="tabular-nums">{(s.sum / s.n).toFixed(1)}</Td>
                <Td align="right"><Pct v={avgPct({ sum: s.sum, n: s.n }, s.q.marks)} /></Td><Td align="right">{pct(s.full, s.n)}%</Td><Td align="right">{pct(s.zero, s.n)}%</Td>
                {sections.map((sec) => <Td key={sec} align="right"><Pct v={avgPct(s.secs[sec], s.q.marks)} /></Td>)}
              </Tr>)}</tbody>
            </Table>}
          </div>
        </section>

        <p className="text-xs text-ink-3">Questions carry no topic tag in the exam paper, so weak areas are read from question text and rubric points. Averages are marks awarded as a share of marks available. Red marks an average below {WEAK}%; amber below 65%.</p>
      </>}
    </main>

    <Drawer open={!!open} onClose={() => setOpenKey("")} title={open ? `Question ${open.q.number}` : "Question"} subtitle={open ? examLabel(open.asm) : undefined}>
      {open && <div className="space-y-6 p-5">
        <p className="text-[13px] leading-relaxed text-ink-2">{open.q.text}</p>
        <dl className="grid grid-cols-3 gap-3 text-[13px]">
          <div><dt className="text-xs text-ink-3">Average</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{avgPct({ sum: open.sum, n: open.n }, open.q.marks)}%</dd></div>
          <div><dt className="text-xs text-ink-3">Full marks</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{pct(open.full, open.n)}%</dd></div>
          <div><dt className="text-xs text-ink-3">Answers</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{open.n}</dd></div>
        </dl>
        <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">By section</h3><ul className="space-y-2">{Object.keys(open.secs).sort().map((sec) => { const v = avgPct(open.secs[sec], open.q.marks) ?? 0; return <li key={sec} className="grid grid-cols-[80px_1fr_44px] items-center gap-3 text-[13px]"><span className="text-ink-2">Section {sec}</span><Progress value={v} tone={v < WEAK ? "danger" : "info"} label={`Section ${sec}`} /><span className="text-right tabular-nums text-ink">{v}%</span></li>; })}</ul></div>
        {open.q.criteria.length > 0 && <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Rubric points students earned</h3><ul className="space-y-2.5">{open.q.criteria.map((c) => { const v = Math.round(((open.crit[c.id]?.hit ?? 0) / open.n) * 100); return <li key={c.id} className="text-[13px]"><div className="mb-1 flex items-baseline justify-between gap-3"><span className="text-ink-2">{c.label} <span className="text-ink-3">· {c.marks} {c.marks === 1 ? "mark" : "marks"}</span></span><span className={cx("tabular-nums", v < WEAK ? "font-medium text-danger" : "text-ink")}>{v}%</span></div><Progress value={v} tone={v < WEAK ? "danger" : "info"} label={c.label} /></li>; })}</ul></div>}
      </div>}
    </Drawer>
  </PublicFrame>;
}
