/*
 * App shell: charcoal sidebar (collapsible to a rail, a drawer on mobile), slim top bar
 * with global search and notifications, the toast host and the unsaved-changes guard.
 * Rendered as a layout route; screens render inside <Outlet />.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpenCheck,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePlus2,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  ScrollText,
  Send,
  Settings as SettingsIcon,
  Users,
  Repeat,
  X,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { useStore } from "../data/store";
import { classLabel, flaggedCount } from "../data/selectors";
import { Avatar, Button, Dialog, ICON, cx } from "./ui";

/* ------------------------------------------------------------------ */
/* Unsaved-changes guard                                                */
/* ------------------------------------------------------------------ */
interface Guard { message: string; onSave: () => void; onDiscard: () => void }
const GuardCtx = createContext<{ setGuard: (g: Guard | null) => void; go: (to: string) => void } | null>(null);

/** Screens with unsaved edits call this; in-app navigation then asks before leaving. */
export function useNavGuard(active: boolean, onSave: () => void, onDiscard: () => void, message = "You have unsaved changes on this copy.") {
  const ctx = useContext(GuardCtx);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const discardRef = useRef(onDiscard);
  discardRef.current = onDiscard;
  useEffect(() => {
    if (!ctx) return;
    ctx.setGuard(active ? { message, onSave: () => saveRef.current(), onDiscard: () => discardRef.current() } : null);
    return () => ctx.setGuard(null);
  }, [active, message, ctx]);
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active]);
}
/** navigate() that respects the unsaved-changes guard */
export function useGuardedNavigate() {
  const ctx = useContext(GuardCtx);
  const navigate = useNavigate();
  return useCallback((to: string) => (ctx ? ctx.go(to) : navigate(to)), [ctx, navigate]);
}

/* ------------------------------------------------------------------ */
/* Navigation model                                                     */
/* ------------------------------------------------------------------ */
interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; badge?: number; match?: string[]; end?: boolean }
interface NavGroup { title?: string; items: NavItem[] }

function useNav(): NavGroup[] {
  const { state, me, role } = useStore();
  return useMemo(() => {
    const unread = state.notifications.filter((n) => n.userId === me.id && !n.read).length;
    if (role === "admin") {
      return [
        { items: [{ to: "/admin", label: "Overview", icon: LayoutDashboard, end: true }] },
        {
          title: "Examinations",
          items: [
            { to: "/assessments", label: "Exam Evaluator", icon: ClipboardList, match: ["/assessments"] },
          ],
        },
        {
          title: "People",
          items: [
            { to: "/students", label: "Students", icon: GraduationCap },
            { to: "/teachers", label: "Teachers", icon: Users },
          ],
        },
        {
          title: "Results",
          items: [
            { to: "/verification", label: "Evaluation & verification", icon: ClipboardCheck, match: ["/verification", "/review"] },
            { to: "/distribution", label: "Result distribution", icon: Send },
            { to: "/reports", label: "Reports & analytics", icon: BarChart3 },
          ],
        },
        {
          title: "System",
          items: [
            { to: "/notifications", label: "Notifications", icon: Bell, badge: unread },
            { to: "/audit", label: "Audit log", icon: ScrollText },
            { to: "/settings", label: "Settings", icon: SettingsIcon },
          ],
        },
      ];
    }
    const mine = state.sheets.filter((s) => s.teacherId === me.id && s.evaluation === "evaluated");
    const pending = mine.filter((s) => s.verification !== "verified").length;
    return [
      { items: [{ to: "/teacher", label: "Dashboard", icon: LayoutDashboard, end: true }] },
      {
        title: "Exam Evaluator",
        items: [
          { to: "/teacher/assessments", label: "My exams", icon: ClipboardList, match: ["/teacher/assessments", "/assessments/asm"] },
          { to: "/assessments/new", label: "Create Exam", icon: FilePlus2, end: true },
          { to: "/teacher/answer-keys", label: "Answer keys", icon: KeyRound },
          { to: "/teacher/rubrics", label: "Rubric management", icon: ListChecks },
        ],
      },
      {
        title: "Evaluation",
        items: [
          { to: "/teacher/pending", label: "Pending verification", icon: BookOpenCheck, badge: pending, match: ["/teacher/pending", "/review"] },
          { to: "/teacher/verified", label: "Verified copies", icon: FileCheck2 },
        ],
      },
      {
        items: [
          { to: "/notifications", label: "Notifications", icon: Bell, badge: unread },
          { to: "/teacher/reports", label: "Reports", icon: BarChart3 },
        ],
      },
    ];
  }, [state.unmatched, state.sheets, state.notifications, me.id, role]);
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                              */
/* ------------------------------------------------------------------ */
function Sidebar({ collapsed, onToggle, onNavigate, mobile }: { collapsed: boolean; onToggle: () => void; onNavigate: (to: string) => void; mobile?: boolean }) {
  const nav = useNav();
  const { pathname } = useLocation();
  const { me, actions, state } = useStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const rail = collapsed && !mobile;

  const isActive = (it: NavItem) => {
    if (it.end) return pathname === it.to;
    if (it.match) return it.match.some((m) => pathname.startsWith(m)) && !(it.to === "/teacher/assessments" && pathname === "/assessments/new");
    return pathname.startsWith(it.to);
  };

  return (
    <div className={cx("flex h-full flex-col bg-charcoal text-on-charcoal", rail ? "w-16" : "w-64")}>
      {/* Workspace */}
      <div className={cx("flex h-14 shrink-0 items-center gap-2.5 border-b border-charcoal-3", rail ? "justify-center px-0" : "px-4")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold tracking-tight text-on-primary" aria-hidden>
          GP
        </span>
        {!rail && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold">{state.settings.schoolName}</p>
            <p className="truncate text-[11px] text-on-charcoal-2">Evaluation · {state.settings.academicYear}</p>
          </div>
        )}
        {mobile && (
          <button onClick={onToggle} aria-label="Close menu" className="flex h-8 w-8 items-center justify-center rounded-md text-on-charcoal-2 hover:bg-charcoal-3 hover:text-on-charcoal">
            <X size={18} strokeWidth={ICON} />
          </button>
        )}
      </div>

      {/* Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
        {nav.map((g, gi) => (
          <div key={gi} className={cx(gi > 0 && "mt-4")}>
            {g.title && (rail ? <div className="mx-3 mb-2 h-px bg-charcoal-3" /> : <p className="mb-1 px-2.5 text-[11px] font-medium text-on-charcoal-2">{g.title}</p>)}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const active = isActive(it);
                return (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(it.to);
                      }}
                      title={rail ? it.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "group relative flex h-9 items-center gap-2.5 rounded-md text-[13px] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring",
                        rail ? "justify-center px-0" : "px-2.5",
                        active ? "bg-charcoal-3 font-medium text-on-charcoal" : "text-on-charcoal-2 hover:bg-charcoal-2 hover:text-on-charcoal",
                      )}
                    >
                      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-primary" aria-hidden />}
                      <Icon size={17} strokeWidth={ICON} className={cx("shrink-0", active ? "text-on-charcoal" : "")} />
                      {!rail && <span className="flex-1 truncate">{it.label}</span>}
                      {!!it.badge && it.badge > 0 && (
                        rail ? (
                          <span className="absolute right-2.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-label={`${it.badge} items`} />
                        ) : (
                          <span className="rounded-sm bg-charcoal-4 px-1.5 text-[11px] font-medium tabular-nums text-on-charcoal">{it.badge}</span>
                        )
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="relative border-t border-charcoal-3 p-2">
        {profileOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 min-w-52 rounded-md border border-charcoal-4 bg-charcoal-2 py-1 shadow-md animate-fade-in" role="menu">
            <button
              role="menuitem"
              onClick={() => {
                setProfileOpen(false);
                const r = me.role === "admin" ? "teacher" : "admin";
                actions.switchRole(r);
                onNavigate(r === "admin" ? "/admin" : "/teacher");
              }}
              className="flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] text-on-charcoal hover:bg-charcoal-3"
            >
              <Repeat size={15} strokeWidth={ICON} />
              {me.role === "admin" ? "Switch to teacher view" : "Switch to Exam Cell view"}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setProfileOpen(false);
                onNavigate("/login");
              }}
              className="flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] text-on-charcoal hover:bg-charcoal-3"
            >
              <LogOut size={15} strokeWidth={ICON} />
              Sign out
            </button>
          </div>
        )}
        <div className={cx("flex items-center gap-1", rail && "flex-col")}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            aria-expanded={profileOpen}
            className={cx("flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-charcoal-2", rail && "justify-center")}
            title={rail ? me.name : undefined}
          >
            <Avatar name={me.name} initials={me.initials} size="sm" tone={0} />
            {!rail && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium">{me.name}</span>
                <span className="block truncate text-[11px] text-on-charcoal-2">{me.title}</span>
              </span>
            )}
            {!rail && <ChevronsUpDown size={14} strokeWidth={ICON} className="text-on-charcoal-2" />}
          </button>
          {!mobile && (
            <button onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-charcoal-2 hover:bg-charcoal-2 hover:text-on-charcoal">
              {collapsed ? <PanelLeftOpen size={16} strokeWidth={ICON} /> : <PanelLeftClose size={16} strokeWidth={ICON} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Global search                                                        */
/* ------------------------------------------------------------------ */
function GlobalSearch({ onNavigate }: { onNavigate: (to: string) => void }) {
  const { state, me, role } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/\s+/g, " ");
    if (term.length < 2) return [];
    const out: { label: string; sub: string; to: string; kind: string }[] = [];
    state.assessments
      .filter((a) => role === "admin" || a.teacherIds.includes(me.id))
      .filter((a) => `${a.name} class ${a.grade} ${a.subject}`.toLowerCase().includes(term))
      .slice(0, 4)
      .forEach((a) => out.push({ label: a.name, sub: `Class ${a.grade} · ${a.subject}`, to: `/assessments/${a.id}`, kind: "Exam" }));
    const visibleSheets = role === "admin" ? state.sheets : state.sheets.filter((s) => s.teacherId === me.id);
    const sids = new Set(visibleSheets.map((s) => s.studentId));
    state.students
      .filter((s) => role === "admin" || sids.has(s.id))
      .filter((s) => s.name.toLowerCase().includes(term) || s.barcode.toLowerCase().includes(term.replace(/ /g, "")))
      .slice(0, 6)
      .forEach((s) => {
        const sh = visibleSheets.find((x) => x.studentId === s.id && x.evaluation === "evaluated");
        out.push({ label: s.name, sub: `${classLabel(s.grade, s.section)} · Roll no ${s.roll} · ${s.barcode}`, to: sh ? `/review/${sh.id}` : role === "admin" ? `/students?q=${encodeURIComponent(s.name)}` : "/teacher/pending", kind: "Student" });
      });
    return out;
  }, [q, state.assessments, state.students, state.sheets, role, me.id]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={15} strokeWidth={ICON} className="pointer-events-none absolute left-2.5 top-1/2 -mt-[7px] text-ink-3" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            onNavigate(results[0].to);
            setOpen(false);
            setQ("");
          }
          if (e.key === "Escape") setOpen(false);
        }}
        aria-label="Search students, QR IDs and exams"
        placeholder="Search students, QR IDs, exams"
        className="h-8 w-full rounded-md border border-border bg-subtle pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-4 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-ring/60"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-surface shadow-md animate-fade-in">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-ink-3">No students or exams match "{q.trim()}"</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      onNavigate(r.to);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">{r.label}</span>
                      <span className="block truncate text-xs text-ink-3">{r.sub}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-3">{r.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast host                                                           */
/* ------------------------------------------------------------------ */
function ToastHost() {
  const { state, actions } = useStore();
  const t = state.toast;
  const [hover, setHover] = useState(false);
  const duration = t ? (t.undo ? Math.max(3000, t.message.split(" ").length * 1000 + 2000) : 5000) : 0;
  useEffect(() => {
    if (!t || hover) return;
    const h = setTimeout(() => actions.dismissToast(), duration);
    return () => clearTimeout(h);
  }, [t, hover, duration, actions]);
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex justify-center sm:left-auto sm:right-6 sm:bottom-6 sm:justify-end" aria-live="polite">
      <div
        key={t.id}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="pointer-events-auto flex min-h-11 max-w-md items-center gap-3 rounded-lg bg-charcoal px-4 py-2.5 text-[13px] text-on-charcoal shadow-lg animate-fade-up"
      >
        <span className="flex-1">{t.message}</span>
        {t.undo && (
          <button
            onClick={() => {
              t.undo?.();
              actions.dismissToast();
            }}
            className="font-semibold text-primary-ring hover:text-on-primary"
          >
            Undo
          </button>
        )}
        <button onClick={actions.dismissToast} aria-label="Dismiss" className="relative flex h-6 w-6 items-center justify-center rounded-full text-on-charcoal-2 hover:text-on-charcoal">
          {t.undo && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="63" className="animate-sweep" style={{ animationDuration: `${duration}ms`, animationPlayState: hover ? "paused" : "running" }} />
            </svg>
          )}
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                                */
/* ------------------------------------------------------------------ */
export default function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, me } = useStore();
  const unread = state.notifications.filter((n) => n.userId === me.id && !n.read).length;
  const mainRef = useRef<HTMLElement>(null);

  const go = useCallback(
    (to: string) => {
      setMobileOpen(false);
      if (guard && to !== pathname) setPending(to);
      else navigate(to);
    },
    [guard, navigate, pathname],
  );
  const ctx = useMemo(() => ({ setGuard, go }), [go]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Focus-mode routes (review workspace) hide the top bar search on small screens
  const focus = pathname.startsWith("/review/");
  const flaggedForMe = state.sheets.filter((s) => s.teacherId === me.id && s.evaluation === "evaluated" && s.verification !== "verified" && flaggedCount(s) > 0).length;

  return (
    <GuardCtx.Provider value={ctx}>
      <div className="flex h-screen overflow-hidden bg-canvas">
        {/* Desktop sidebar */}
        <aside className={cx("hidden shrink-0 transition-[width] duration-200 ease-out lg:block", collapsed ? "w-16" : "w-64")}>
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onNavigate={go} />
        </aside>
        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-charcoal/50 animate-fade-in" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 animate-slide-in-left shadow-lg">
              <Sidebar collapsed={false} mobile onToggle={() => setMobileOpen(false)} onNavigate={go} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar: app tools only */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-5">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-muted lg:hidden">
              <MenuIcon size={19} strokeWidth={ICON} />
            </button>
            <Link to={me.role === "admin" ? "/admin" : "/teacher"} className="text-[13px] font-semibold text-ink lg:hidden">
              GPS Evaluation
            </Link>
            <div className={cx("flex-1", focus ? "hidden md:flex" : "hidden sm:flex")}>
              <GlobalSearch onNavigate={go} />
            </div>
            <div className="ml-auto flex items-center gap-1 sm:ml-0">
              <button
                onClick={() => go("/notifications")}
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                title="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-muted"
              >
                <Bell size={18} strokeWidth={ICON} />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-primary">{unread}</span>}
              </button>
            </div>
          </header>
          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <ToastHost />
      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title="Leave without saving?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>Stay</Button>
            <Button
              variant="secondary"
              onClick={() => {
                guard?.onDiscard();
                const to = pending!;
                setGuard(null);
                setPending(null);
                navigate(to);
              }}
            >
              Discard changes
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                guard?.onSave();
                const to = pending!;
                setGuard(null);
                setPending(null);
                navigate(to);
              }}
            >
              Save draft and leave
            </Button>
          </>
        }
      >
        <p>{guard?.message} Saved drafts stay on the copy until you verify it.</p>
      </Dialog>
    </GuardCtx.Provider>
  );
}

/** Wrapper for pages outside the shell (login, student and parent result views). */
export function PublicFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
