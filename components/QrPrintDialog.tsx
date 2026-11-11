import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Student } from "../data/types";
import { Button, Checkbox, ICON, SearchInput, Select, Switch, cx } from "./ui";

/* A4 at 96dpi so the on-screen preview and the printed page are the same markup. */
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 40;
const LAYOUTS = { 2: { rows: 5, qr: 150 }, 3: { rows: 6, qr: 120 }, 4: { rows: 8, qr: 88 } } as const;
type Cols = keyof typeof LAYOUTS;
type Opts = { cols: Cols; name: boolean; classRoll: boolean; code: boolean };

function Sheet({ students, opts, index, pages }: { students: Student[]; opts: Opts; index: number; pages: number }) {
  const { rows, qr } = LAYOUTS[opts.cols];
  return (
    <div className="relative bg-white text-black" style={{ width: PAGE_W, height: PAGE_H, padding: PAD, breakAfter: "page" }}>
      <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${opts.cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {students.map((s) => (
          <div key={s.id} className="flex flex-col items-center justify-center gap-1 border border-dashed border-neutral-300 p-2 text-center">
            <QRCodeSVG value={s.barcode} size={qr} level="M" marginSize={0} fgColor="#000" bgColor="#fff" />
            {opts.name && <p className="max-w-full truncate text-[13px] font-semibold leading-tight">{s.name}</p>}
            {opts.classRoll && <p className="text-[11px] leading-tight text-neutral-600">Class {s.grade}{s.section} · Roll no {s.roll}</p>}
            {opts.code && <p className="font-mono text-[10px] leading-tight tracking-wider text-neutral-700">{s.barcode}</p>}
          </div>
        ))}
      </div>
      <span className="absolute bottom-3 right-5 text-[9px] text-neutral-400">Page {index + 1} of {pages}</span>
    </div>
  );
}

export default function QrPrintDialog({ students, initialIds, onClose }: { students: Student[]; initialIds: string[]; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds));
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [opts, setOpts] = useState<Opts>({ cols: 3, name: true, classRoll: true, code: true });
  const [scale, setScale] = useState(0.5);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, Math.max(0.3, (el.clientWidth - 40) / PAGE_W))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const grades = Array.from(new Set(students.map((s) => s.grade))).sort((a, b) => Number(a) - Number(b));
  const sections = Array.from(new Set(students.filter((s) => grade === "all" || s.grade === grade).map((s) => s.section))).sort();
  const list = useMemo(() => {
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const t = norm(query.trim());
    return students.filter((s) => (grade === "all" || s.grade === grade) && (section === "all" || s.section === section) && (!t || [s.name, String(s.roll), s.barcode].some((v) => norm(v).includes(t))));
  }, [students, query, grade, section]);

  const chosen = useMemo(() => students.filter((s) => selected.has(s.id)), [students, selected]);
  const perPage = LAYOUTS[opts.cols].rows * opts.cols;
  const pages = Math.max(1, Math.ceil(chosen.length / perPage));
  const pageSlices = Array.from({ length: chosen.length ? pages : 0 }, (_, i) => chosen.slice(i * perPage, (i + 1) * perPage));
  const allVisible = list.length > 0 && list.every((s) => selected.has(s.id));
  const someVisible = list.some((s) => selected.has(s.id));
  const toggle = (id: string, on: boolean) => setSelected((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  const toggleAll = (on: boolean) => setSelected((p) => { const n = new Set(p); list.forEach((s) => (on ? n.add(s.id) : n.delete(s.id))); return n; });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface print:hidden" role="dialog" aria-modal="true" aria-label="Print QR codes">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">Print QR codes</h2>
          <p className="text-[13px] text-ink-3">Choose students, check the sheet preview, then print. Stick each QR code on the booklet cover.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={<Printer size={16} strokeWidth={ICON} />} disabled={chosen.length === 0} onClick={() => window.print()}>Print {chosen.length > 0 ? `${chosen.length} QR code${chosen.length === 1 ? "" : "s"}` : ""}</Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[400px_1fr]">
        <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="space-y-2 border-b border-border p-3">
            <SearchInput label="Search students" value={query} onChange={setQuery} placeholder="Name, roll no or QR ID" className="w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Select aria-label="Filter by class" value={grade} onChange={(e) => { setGrade(e.target.value); setSection("all"); }}><option value="all">All classes</option>{grades.map((g) => <option key={g} value={g}>Class {g}</option>)}</Select>
              <Select aria-label="Filter by section" value={section} onChange={(e) => setSection(e.target.value)}><option value="all">All sections</option>{sections.map((s) => <option key={s} value={s}>Section {s}</option>)}</Select>
            </div>
            <div className="flex items-center justify-between pt-1 text-[13px]">
              <Checkbox checked={allVisible} indeterminate={someVisible && !allVisible} onChange={toggleAll} label={`Select all ${list.length} shown`} />
              <span className="text-ink-3">{chosen.length} selected{chosen.length > 0 && <button type="button" className="ml-2 text-primary hover:underline" onClick={() => setSelected(new Set())}>Clear</button>}</span>
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {list.length === 0 && <li className="px-4 py-8 text-center text-[13px] text-ink-3">No students match these filters.</li>}
            {list.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-subtle">
                <Checkbox checked={selected.has(s.id)} onChange={(v) => toggle(s.id, v)} label={`Select ${s.name}`} />
                <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-ink">{s.name}</p><p className="text-xs text-ink-3">Class {s.grade}{s.section} · Roll no {s.roll}</p></div>
                <span className="font-mono text-[11px] text-ink-3">{s.barcode}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col bg-subtle">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface px-4 py-2.5 text-[13px] text-ink-2">
            <label className="flex items-center gap-2">QR codes per row
              <Select aria-label="QR codes per row" className="w-20" value={opts.cols} onChange={(e) => setOpts((o) => ({ ...o, cols: Number(e.target.value) as Cols }))}><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></Select>
            </label>
            <label className="flex items-center gap-2"><Switch checked={opts.name} onChange={(v) => setOpts((o) => ({ ...o, name: v }))} label="Show name" />Name</label>
            <label className="flex items-center gap-2"><Switch checked={opts.classRoll} onChange={(v) => setOpts((o) => ({ ...o, classRoll: v }))} label="Show class and roll no" />Class &amp; roll no</label>
            <label className="flex items-center gap-2"><Switch checked={opts.code} onChange={(v) => setOpts((o) => ({ ...o, code: v }))} label="Show QR ID" />QR ID</label>
            <span className="ml-auto text-xs text-ink-3">A4 · {chosen.length} on {chosen.length ? pages : 0} {pages === 1 ? "page" : "pages"}</span>
          </div>
          <div ref={previewRef} className="min-h-0 flex-1 overflow-y-auto p-5">
            {chosen.length === 0 ? (
              <div className="flex h-full min-h-60 flex-col items-center justify-center text-center"><p className="text-sm font-medium text-ink">No students selected</p><p className="mt-1 text-[13px] text-ink-3">Tick students on the left to preview the printed sheet.</p></div>
            ) : pageSlices.map((slice, i) => (
              <div key={i} className="mx-auto mb-5 overflow-hidden rounded-sm shadow-md ring-1 ring-border" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_W, height: PAGE_H }}><Sheet students={slice} opts={opts} index={i} pages={pages} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Print-only copy at true page size, outside the app shell. */}
      {createPortal(
        <div className={cx("qr-print-root")}>{pageSlices.map((slice, i) => <Sheet key={i} students={slice} opts={opts} index={i} pages={pages} />)}</div>,
        document.body,
      )}
    </div>
  );
}
