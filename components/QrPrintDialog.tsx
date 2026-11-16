import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, FileText, Grid } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Student } from "../data/types";
import { useStore } from "../data/store";
import { examTypeLabel } from "../data/selectors";
import { Button, Checkbox, ICON, SearchInput, Select, cx } from "./ui";

/* A4 at 96dpi so the on-screen preview and the printed page are the same markup. */
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 40;
const LAYOUTS = { 2: { rows: 5, qr: 130 }, 3: { rows: 6, qr: 100 }, 4: { rows: 8, qr: 75 } } as const;
type Cols = keyof typeof LAYOUTS;
type PrintMode = "single" | "stickers";

interface PrintOptions {
  mode: PrintMode;
  cols: Cols;
  examName: string;
  schoolName: string;
  city: string;
}

/** 1 Student per page Booklet Cover Sheet (Standard Indian School / Board Exam Format) */
function SingleCoverSheet({ student, opts, index, total }: { student: Student; opts: PrintOptions; index: number; total: number }) {
  const city = student.city || opts.city || "Bengaluru";
  return (
    <div
      className="relative flex flex-col justify-between bg-white text-black print:m-0"
      style={{ width: PAGE_W, height: PAGE_H, padding: PAD, breakAfter: "page", boxSizing: "border-box" }}
    >
      {/* Outer Border */}
      <div className="flex h-full flex-col justify-between rounded-lg border-2 border-neutral-900 p-8">
        {/* Header */}
        <div className="border-b-2 border-neutral-900 pb-5 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-neutral-600">Official Examination Cell</p>
          <h1 className="mt-1 text-2xl font-bold uppercase tracking-tight text-neutral-900">{opts.schoolName}</h1>
          <p className="text-sm font-medium text-neutral-700">{city} · Academic Year 2025–26</p>
          <div className="mt-3 inline-block rounded-md bg-neutral-100 px-4 py-1 text-sm font-semibold tracking-wide uppercase text-neutral-900">
            {opts.examName}
          </div>
        </div>

        {/* Student Identification Grid */}
        <div className="my-6 rounded-md border border-neutral-800 bg-neutral-50/50 p-6">
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
            <div className="border-b border-neutral-300 pb-2">
              <span className="text-xs uppercase tracking-wider text-neutral-500">Student Name</span>
              <p className="mt-0.5 text-lg font-bold text-neutral-900">{student.name}</p>
            </div>
            <div className="border-b border-neutral-300 pb-2">
              <span className="text-xs uppercase tracking-wider text-neutral-500">Roll Number</span>
              <p className="mt-0.5 text-lg font-bold text-neutral-900">{student.roll}</p>
            </div>
            <div className="border-b border-neutral-300 pb-2">
              <span className="text-xs uppercase tracking-wider text-neutral-500">Class &amp; Section</span>
              <p className="mt-0.5 text-base font-semibold text-neutral-900">Class {student.grade} - Section {student.section}</p>
            </div>
            <div className="border-b border-neutral-300 pb-2">
              <span className="text-xs uppercase tracking-wider text-neutral-500">City / Centre</span>
              <p className="mt-0.5 text-base font-semibold text-neutral-900">{city}</p>
            </div>
          </div>
        </div>

        {/* Only QR Code with Candidate Code (Code: A313 removed) */}
        <div className="my-auto flex flex-col items-center justify-center p-6 text-center">
          <div className="rounded-lg border-2 border-neutral-900 p-4 bg-white shadow-xs">
            <QRCodeSVG value={student.barcode} size={220} level="M" marginSize={0} fgColor="#000" bgColor="#fff" />
          </div>
          <div className="mt-4 flex items-center justify-center">
            <span className="font-mono text-base font-bold tracking-widest text-neutral-900">{student.barcode}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sticker Sheet (Multiple Stickers per A4 Page - with short code removed) */
function StickerSheet({ students, opts, index, pages }: { students: Student[]; opts: PrintOptions; index: number; pages: number }) {
  const { rows, qr } = LAYOUTS[opts.cols];
  return (
    <div className="relative bg-white text-black print:m-0" style={{ width: PAGE_W, height: PAGE_H, padding: PAD, breakAfter: "page", boxSizing: "border-box" }}>
      <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${opts.cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {students.map((s) => {
          const city = s.city || opts.city || "Bengaluru";
          return (
            <div key={s.id} className="flex flex-col items-center justify-center gap-0.5 border border-dashed border-neutral-300 p-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-tight text-neutral-800 truncate max-w-full">{opts.schoolName}</p>
              <QRCodeSVG value={s.barcode} size={qr} level="M" marginSize={0} fgColor="#000" bgColor="#fff" />
              <p className="max-w-full truncate text-[12px] font-bold leading-tight mt-0.5">{s.name}</p>
              <p className="text-[10px] leading-tight text-neutral-700">Class {s.grade}{s.section} · Roll {s.roll} · {city}</p>
              <p className="text-[9px] font-medium text-neutral-600 truncate max-w-full">{opts.examName}</p>
              <p className="font-mono text-[9px] leading-tight tracking-wider text-neutral-800 font-semibold">{s.barcode}</p>
            </div>
          );
        })}
      </div>
      <span className="absolute bottom-3 right-5 text-[9px] text-neutral-400">Page {index + 1} of {pages}</span>
    </div>
  );
}

export default function QrPrintDialog({ students, initialIds, onClose }: { students: Student[]; initialIds: string[]; onClose: () => void }) {
  const { state } = useStore();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds));
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<PrintMode>("single");
  const [cols, setCols] = useState<Cols>(3);

  // Four Filters: 1. Exam Type, 2. Subject, 3. Class, 4. Section
  const [examType, setExamType] = useState("all");
  const [subject, setSubject] = useState("all");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");

  // Available unique Exam Types and Subjects from state.assessments
  const availableExamTypes = useMemo(() => {
    const types = new Set<string>();
    state.assessments.forEach((a) => {
      types.add(examTypeLabel(a));
    });
    return Array.from(types).sort();
  }, [state.assessments]);

  const availableSubjects = useMemo(() => {
    const subs = new Set<string>();
    state.assessments.forEach((a) => {
      if (a.subject) subs.add(a.subject);
    });
    return Array.from(subs).sort();
  }, [state.assessments]);

  // Dynamic Exam Name for Cover based on selected filters
  const activeExamName = useMemo(() => {
    // 1. Direct match with assessment
    const matched = state.assessments.find((a) => {
      if (examType !== "all" && examTypeLabel(a) !== examType && a.type !== examType) return false;
      if (subject !== "all" && a.subject !== subject) return false;
      if (grade !== "all" && a.grade !== grade) return false;
      return true;
    });
    if (matched) return matched.name;

    // 2. Synthesized title if filters are chosen
    if (subject !== "all" && examType !== "all") return `${subject} ${examType}`;
    if (examType !== "all") return `${examType} Examination`;
    if (subject !== "all") return `${subject} Examination`;

    return state.assessments[0]?.name || "Midterm Examination 2025–26";
  }, [state.assessments, examType, subject, grade]);

  const schoolName = state.settings.schoolName || "Greenfield Public School";
  const city = state.settings.city || "Bengaluru";

  const opts: PrintOptions = {
    mode,
    cols,
    examName: activeExamName,
    schoolName,
    city,
  };

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
  
  // Filter students based on: Query, Grade, Section, and Exam/Subject scope
  const list = useMemo(() => {
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const t = norm(query.trim());

    // Determine target grades if examType or subject is explicitly chosen
    const targetGrades = (examType !== "all" || subject !== "all")
      ? new Set(
          state.assessments
            .filter((a) => {
              if (examType !== "all" && examTypeLabel(a) !== examType && a.type !== examType) return false;
              if (subject !== "all" && a.subject !== subject) return false;
              return true;
            })
            .map((a) => a.grade)
        )
      : null;

    return students.filter((s) => {
      if (grade !== "all" && s.grade !== grade) return false;
      if (grade === "all" && targetGrades && !targetGrades.has(s.grade)) return false;
      if (section !== "all" && s.section !== section) return false;
      if (t && ![s.name, String(s.roll), s.barcode, s.city || ""].some((v) => norm(v).includes(t))) return false;
      return true;
    });
  }, [students, query, grade, section, examType, subject, state.assessments]);

  const chosen = useMemo(() => students.filter((s) => selected.has(s.id)), [students, selected]);
  const perPage = mode === "single" ? 1 : cols * LAYOUTS[cols].rows;
  const pages = Math.max(1, Math.ceil(chosen.length / perPage));

  const pageSlices = useMemo(() => {
    if (mode === "single") return [];
    const res: Student[][] = [];
    for (let i = 0; i < chosen.length; i += perPage) {
      res.push(chosen.slice(i, i + perPage));
    }
    return res;
  }, [chosen, mode, perPage]);

  const allVisible = list.length > 0 && list.every((s) => selected.has(s.id));
  const someVisible = list.some((s) => selected.has(s.id));
  const toggle = (id: string, on: boolean) => setSelected((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  const toggleAll = (on: boolean) => setSelected((p) => { const n = new Set(p); list.forEach((s) => (on ? n.add(s.id) : n.delete(s.id))); return n; });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface print:hidden" role="dialog" aria-modal="true" aria-label="Print QR codes">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 bg-surface">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">Print Candidate QR Codes</h2>
          <p className="text-[13px] text-ink-3">
            Contains School name, Student name, Grade, Section, City, Exam name, Roll no &amp; QR code.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={<Printer size={16} strokeWidth={ICON} />} disabled={chosen.length === 0} onClick={() => window.print()}>
            Print {chosen.length > 0 ? `${pages} ${mode === "single" ? (pages === 1 ? "Cover Page" : "Cover Pages") : (pages === 1 ? "Sticker Page" : "Sticker Pages")}` : ""}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
        {/* Left: Student Selector with 4 Filters (Exam Type, Subject, Class, Section) */}
        <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r bg-surface">
          <div className="space-y-2.5 border-b border-border p-3">
            <SearchInput label="Search students" value={query} onChange={setQuery} placeholder="Name, roll no, city or QR ID" className="w-full" />
            
            {/* Filter Row 1: Exam Type & Subject */}
            <div className="grid grid-cols-2 gap-2">
              <Select
                aria-label="Filter by exam type"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="text-xs"
              >
                <option value="all">All Exam Types</option>
                {availableExamTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>

              <Select
                aria-label="Filter by subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-xs"
              >
                <option value="all">All Subjects</option>
                {availableSubjects.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </Select>
            </div>

            {/* Filter Row 2: Class & Section */}
            <div className="grid grid-cols-2 gap-2">
              <Select
                aria-label="Filter by class"
                value={grade}
                onChange={(e) => { setGrade(e.target.value); setSection("all"); }}
                className="text-xs"
              >
                <option value="all">All classes</option>
                {grades.map((g) => <option key={g} value={g}>Class {g}</option>)}
              </Select>

              <Select
                aria-label="Filter by section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="text-xs"
              >
                <option value="all">All sections</option>
                {sections.map((s) => <option key={s} value={s}>Section {s}</option>)}
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1 text-[13px]">
              <Checkbox checked={allVisible} indeterminate={someVisible && !allVisible} onChange={toggleAll} label={`Select all ${list.length} shown`} />
              <span className="text-ink-3">
                {chosen.length} selected
                {chosen.length > 0 && <button type="button" className="ml-2 text-primary hover:underline font-medium" onClick={() => setSelected(new Set())}>Clear</button>}
              </span>
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {list.length === 0 && <li className="px-4 py-8 text-center text-[13px] text-ink-3">No students match these filters.</li>}
            {list.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-subtle transition-colors">
                <Checkbox checked={selected.has(s.id)} onChange={(v) => toggle(s.id, v)} label={`Select ${s.name}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-ink-3">Class {s.grade}{s.section} · Roll {s.roll} · {s.city || city}</p>
                </div>
                <span className="font-mono text-[11px] text-ink-3">{s.barcode}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Right: Preview & Format Options */}
        <section className="flex min-h-0 flex-col bg-subtle">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2.5 text-[13px]">
            {/* Mode Selector */}
            <div className="flex items-center gap-1 rounded-md bg-subtle p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={cx("flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors", mode === "single" ? "bg-primary text-white shadow-xs" : "text-ink-2 hover:text-ink")}
              >
                <FileText size={13} strokeWidth={ICON} />
                1 Student Per Page (Booklet Cover)
              </button>
              <button
                type="button"
                onClick={() => setMode("stickers")}
                className={cx("flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors", mode === "stickers" ? "bg-primary text-white shadow-xs" : "text-ink-2 hover:text-ink")}
              >
                <Grid size={13} strokeWidth={ICON} />
                Sticker Sheet (Multi per page)
              </button>
            </div>

            {mode === "stickers" && (
              <label className="flex items-center gap-1.5 text-xs text-ink-2">
                Cols:
                <Select aria-label="Stickers per row" className="w-16 text-xs" value={cols} onChange={(e) => setCols(Number(e.target.value) as Cols)}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </Select>
              </label>
            )}

            <span className="ml-auto text-xs text-ink-3 font-medium">
              {chosen.length} {chosen.length === 1 ? "student" : "students"} · {pages} {pages === 1 ? "A4 page" : "A4 pages"}
            </span>
          </div>

          {/* Interactive Document Preview */}
          <div ref={previewRef} className="min-h-0 flex-1 overflow-y-auto p-5">
            {chosen.length === 0 ? (
              <div className="flex h-full min-h-60 flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-ink">No students selected</p>
                <p className="mt-1 text-[13px] text-ink-3">Select students on the left to preview the printed document.</p>
              </div>
            ) : mode === "single" ? (
              chosen.map((student, i) => (
                <div key={student.id} className="mx-auto mb-6 overflow-hidden rounded-sm shadow-md ring-1 ring-border" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_W, height: PAGE_H }}>
                    <SingleCoverSheet student={student} opts={opts} index={i} total={chosen.length} />
                  </div>
                </div>
              ))
            ) : (
              pageSlices.map((slice, i) => (
                <div key={i} className="mx-auto mb-6 overflow-hidden rounded-sm shadow-md ring-1 ring-border" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_W, height: PAGE_H }}>
                    <StickerSheet students={slice} opts={opts} index={i} pages={pages} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Print-only copy at true page size, outside the app shell */}
      {createPortal(
        <div className={cx("qr-print-root")}>
          {mode === "single" 
            ? chosen.map((student, i) => <SingleCoverSheet key={student.id} student={student} opts={opts} index={i} total={chosen.length} />)
            : pageSlices.map((slice, i) => <StickerSheet key={i} students={slice} opts={opts} index={i} pages={pages} />)}
        </div>,
        document.body,
      )}
    </div>
  );
}
