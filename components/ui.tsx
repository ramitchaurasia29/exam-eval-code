/*
 * Shared UI kit. Every screen imports from here; do not hand-roll buttons, inputs,
 * tables, status labels, dialogs or empty states in screens.
 *
 * Register: compact, technical, light content on canvas grey; charcoal chrome; blue only
 * for the one primary action per region, focus and selection.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown, ChevronRight, CircleAlert, Info, Loader2, Search, X } from "lucide-react";
import type { Tone } from "../data/selectors";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export const ICON = 1.75; // lucide strokeWidth used app-wide

/* Buttons ------------------------------------------------------------ */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost" | "link";
type BtnSize = "sm" | "md";
const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-press shadow-xs",
  secondary: "bg-surface text-ink border border-border-strong hover:bg-subtle active:bg-muted shadow-xs",
  ghost: "text-ink-2 hover:bg-muted hover:text-ink active:bg-border",
  danger: "bg-danger text-on-primary hover:bg-danger-hover shadow-xs",
  "danger-ghost": "text-danger hover:bg-danger-soft",
  link: "text-primary hover:text-primary-hover hover:underline underline-offset-2 px-0",
};
const BTN_SIZE: Record<BtnSize, string> = { sm: "h-8 px-2.5 text-[13px]", md: "h-9 px-3.5 text-sm" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}
export function Button({ variant = "secondary", size = "md", icon, iconRight, loading, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(BTN_BASE, BTN_VARIANT[variant], variant === "link" ? "h-auto text-sm" : BTN_SIZE[size], className)}
    >
      {loading ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export function ButtonLink({ to, variant = "secondary", size = "md", icon, iconRight, children, className }: { to: string; variant?: BtnVariant; size?: BtnSize; icon?: ReactNode; iconRight?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx(BTN_BASE, BTN_VARIANT[variant], variant === "link" ? "h-auto text-sm" : BTN_SIZE[size], className)}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export function IconButton({ label, children, className, size = "md", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        "inline-flex items-center justify-center rounded-md text-ink-3 hover:bg-muted hover:text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring disabled:opacity-40 disabled:cursor-not-allowed",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* Status -------------------------------------------------------------- */
const DOT: Record<Tone, string> = {
  neutral: "bg-ink-3",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-ink-4",
};
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink-2",
  info: "text-primary-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-ink-3",
};
/** Dot + label. The default way to show a status in tables and headers. */
export function StatusText({ tone, label, className, pulse }: { tone: Tone; label: string; className?: string; pulse?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap", TONE_TEXT[tone], className)}>
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone], pulse && "animate-pulse-soft")} aria-hidden />
      {label}
    </span>
  );
}

const TAG: Record<Tone, string> = {
  neutral: "bg-muted text-ink-2",
  info: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  muted: "bg-muted text-ink-3",
};
/** Soft filled tag. Ration it: use for the exception (Not verified, Flagged), not every row. */
export function Tag({ tone = "neutral", children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", TAG[tone], className)}>{icon}{children}</span>;
}

/* Layout pieces --------------------------------------------------------- */
export function Panel({ children, className, title, actions, flush, id }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; flush?: boolean; id?: string }) {
  return (
    <section id={id} className={cx("rounded-lg border border-border bg-surface shadow-xs", className)}>
      {(title || actions) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink tracking-tight">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export interface Crumb { label: string; to?: string }
export function PageHeader({ title, crumbs, meta, actions, children }: { title: ReactNode; crumbs?: Crumb[]; meta?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-[13px] text-ink-3">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.to ? <Link to={c.to} className="hover:text-ink hover:underline underline-offset-2">{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <ChevronRight size={13} strokeWidth={ICON} className="text-ink-4" />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-[22px]">{title}</h1>
          {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cx("mx-auto w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-6", wide ? "max-w-none" : "max-w-[1440px]", className)}>{children}</div>;
}

/* Tabs ----------------------------------------------------------------- */
export interface TabItem<T extends string = any> { id: T; label: string; count?: number }
export function Tabs<T extends string = any>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: any) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("flex gap-1 overflow-x-auto border-b border-border", className)}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cx(
              "relative -mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring rounded-t-sm",
              active ? "border-primary font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx("rounded-sm px-1.5 text-xs tabular-nums", active ? "bg-primary-soft text-primary-ink" : "bg-muted text-ink-3")}>{t.count.toLocaleString("en-IN")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string = any>({ items, value, onChange, size = "md" }: { items: { id: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: any) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          aria-pressed={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring",
            size === "sm" ? "h-7 text-xs" : "h-8 text-[13px]",
            value === it.id ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink",
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* Table ---------------------------------------------------------------- */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className, align = "left", sticky }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center"; sticky?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        "sticky top-0 z-10 h-9 border-b border-border bg-subtle px-3 text-xs font-medium text-ink-3 whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        sticky && "left-0 z-20",
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({ children, className, align = "left", sticky, mono, title }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center"; sticky?: boolean; mono?: boolean; title?: string }) {
  return (
    <td
      title={title}
      className={cx(
        "h-10 border-b border-border px-3 whitespace-nowrap text-[13px] text-ink-2",
        align === "right" ? "text-right tabular-nums" : align === "center" ? "text-center" : "text-left",
        sticky && "sticky left-0 z-[1] bg-surface group-hover:bg-subtle",
        mono && "font-mono text-xs",
        className,
      )}
    >
      {children}
    </td>
  );
}
export function Tr({ children, onClick, selected, className }: { children: ReactNode; onClick?: () => void; selected?: boolean; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cx("group transition-colors duration-100", onClick && "cursor-pointer", selected ? "bg-primary-soft/60" : "hover:bg-subtle", className)}
    >
      {children}
    </tr>
  );
}
export function TableFooter({ shown, total, children }: { shown: number; total: number; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] text-ink-3">
      <span className="tabular-nums">{shown === 0 ? "0" : `1–${shown.toLocaleString("en-IN")}`} of {total.toLocaleString("en-IN")}</span>
      {children}
    </div>
  );
}

/* Selection bar --------------------------------------------------------- */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-primary-soft-2 bg-primary-soft px-4 py-2 animate-fade-in">
      <span className="text-sm font-medium text-primary-ink tabular-nums">{count} selected</span>
      <Button variant="link" size="sm" onClick={onClear} className="text-[13px]">Clear</Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/* Form -------------------------------------------------------------------- */
export function Field({ label, htmlFor, helper, error, optional, children, className }: { label: string; htmlFor?: string; helper?: ReactNode; error?: string; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-3"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-danger" role="alert"><CircleAlert size={13} strokeWidth={2} />{error}</p>
      ) : helper ? (
        <p className="text-xs text-ink-3">{helper}</p>
      ) : null}
    </div>
  );
}
const INPUT =
  "h-9 w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-4 shadow-xs transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-ring/60 focus:border-primary disabled:bg-muted disabled:text-ink-3";
export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: Ref<HTMLInputElement> }) {
  return <input {...rest} aria-invalid={invalid || undefined} className={cx(INPUT, invalid ? "border-danger" : "border-border-strong", className)} />;
}
export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea {...rest} aria-invalid={invalid || undefined} className={cx(INPUT, "h-auto min-h-20 py-2 leading-relaxed", invalid ? "border-danger" : "border-border-strong", className)} />;
}
export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; ref?: Ref<HTMLSelectElement> }) {
  return (
    <div className={cx("relative", className)}>
      <select {...rest} aria-invalid={invalid || undefined} className={cx(INPUT, "appearance-none pr-8", invalid ? "border-danger" : "border-border-strong")}>
        {children}
      </select>
      <ChevronDown size={15} strokeWidth={ICON} className="pointer-events-none absolute right-2.5 top-1/2 -mt-[7px] text-ink-3" />
    </div>
  );
}
export function SearchInput({ value, onChange, placeholder, className, label }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label: string }) {
  return (
    <div className={cx("relative", className)}>
      <Search size={15} strokeWidth={ICON} className="pointer-events-none absolute left-2.5 top-1/2 -mt-[7px] text-ink-3" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(INPUT, "border-border-strong pl-8")}
      />
    </div>
  );
}
export function Checkbox({ checked, onChange, label, indeterminate, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; indeterminate?: boolean; disabled?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.checked)}
      className={cx("h-4 w-4 cursor-pointer rounded-sm border-border-strong accent-primary disabled:cursor-not-allowed", className)}
    />
  );
}
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring disabled:opacity-50",
        checked ? "bg-primary" : "bg-border-strong",
      )}
    >
      <span className={cx("inline-block h-4 w-4 rounded-full bg-surface shadow-xs transition-[margin] duration-150", checked ? "ml-[18px]" : "ml-0.5")} />
    </button>
  );
}
export function Radio({ name, checked, onChange, label, description, disabled }: { name: string; checked: boolean; onChange: () => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors duration-100", checked ? "border-primary bg-primary-soft/50" : "border-border hover:bg-subtle", disabled && "cursor-not-allowed opacity-50")}>
      <input id={id} type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 h-4 w-4 accent-primary" />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description && <span className="text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  );
}

/* Feedback ------------------------------------------------------------------- */
const BANNER: Record<"info" | "warning" | "danger" | "success", { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-primary-soft-2 bg-primary-soft text-primary-ink", Icon: Info },
  warning: { cls: "border-warning/25 bg-warning-soft text-warning", Icon: AlertTriangle },
  danger: { cls: "border-danger/25 bg-danger-soft text-danger", Icon: CircleAlert },
  success: { cls: "border-success/25 bg-success-soft text-success", Icon: Check },
};
export function Banner({ tone = "info", title, children, action, className }: { tone?: keyof typeof BANNER; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { cls, Icon } = BANNER[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex flex-col gap-2 rounded-md border px-3.5 py-2.5 sm:flex-row sm:items-center", cls, className)}>
      <div className="flex flex-1 items-start gap-2.5">
        <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <div className="text-[13px] leading-relaxed">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cx(title ? "text-ink-2" : "")}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      {icon && <div className="mb-1 text-ink-4">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="max-w-sm text-[13px] text-ink-3">{body}</p>}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse-soft rounded-sm bg-muted", className)} />;
}
export function SkeletonRows({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-6 px-4">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className={cx("h-3", j === 0 ? "w-40" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Progress({ value, tone = "info", className, label }: { value: number; tone?: "info" | "success" | "warning" | "danger"; className?: string; label?: string }) {
  const bar = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-danger" : "bg-primary";
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx("h-full rounded-full transition-[width] duration-500 ease-out", bar)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Segmented stacked bar for a pipeline (identified -> evaluated -> verified -> released). */
export function StackBar({ parts, total, className }: { parts: { value: number; cls: string; label: string }[]; total: number; className?: string }) {
  return (
    <div className={cx("flex h-2 w-full overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      {parts.map((p, i) => (
        <div key={i} title={`${p.label}: ${p.value}`} className={cx("h-full transition-[width] duration-500 ease-out", p.cls)} style={{ width: `${total ? (p.value / total) * 100 : 0}%` }} />
      ))}
    </div>
  );
}

const AV_TINTS = ["bg-primary-soft text-primary-ink", "bg-success-soft text-success", "bg-warning-soft text-warning", "bg-muted text-ink-2", "bg-danger-soft text-danger"];
export function Avatar({ name, initials, size = "md", tone }: { name: string; initials?: string; size?: "sm" | "md" | "lg"; tone?: number }) {
  const ini = initials ?? name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const t = tone ?? name.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0) % AV_TINTS.length;
  return (
    <span aria-hidden className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", AV_TINTS[t], size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs")}>
      {ini}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-strong bg-subtle px-1 font-mono text-[11px] text-ink-3">{children}</kbd>;
}

/** Key-number strip: one panel, numbers separated by hairlines. Max 4–6 items. */
export function StatStrip({ items, className }: { items: { label: string; value: ReactNode; sub?: ReactNode; to?: string; tone?: Tone }[]; className?: string }) {
  return (
    <div className={cx("grid grid-cols-2 divide-border rounded-lg border border-border bg-surface shadow-xs sm:flex sm:divide-x", className)}>
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="text-xs text-ink-3">{it.label}</span>
            <span className={cx("mt-0.5 text-[22px] font-semibold tracking-tight tabular-nums", it.tone === "danger" ? "text-danger" : it.tone === "warning" ? "text-warning" : "text-ink")}>{it.value}</span>
            {it.sub && <span className="text-xs text-ink-3">{it.sub}</span>}
          </>
        );
        const cls = cx("flex min-w-0 flex-1 flex-col px-4 py-3", i % 2 === 1 && "border-l border-border sm:border-l-0", i >= 2 && "border-t border-border sm:border-t-0");
        return it.to ? (
          <Link key={i} to={it.to} className={cx(cls, "transition-colors duration-100 hover:bg-subtle first:rounded-l-lg last:rounded-r-lg")}>{inner}</Link>
        ) : (
          <div key={i} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}

/* Overlays ----------------------------------------------------------------- */
function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Dialog({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-charcoal/45 animate-fade-in" onClick={onClose} />
      <div className={cx("relative flex max-h-[92vh] w-full flex-col rounded-t-xl bg-surface shadow-lg animate-pop-in sm:rounded-xl", size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={17} strokeWidth={ICON} /></IconButton>
        </header>
        <div className="overflow-y-auto px-5 py-4 text-sm text-ink-2">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = "md" }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: "md" | "lg" }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-charcoal/30 animate-fade-in" onClick={onClose} />
      <aside className={cx("absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-lg animate-slide-in-right", width === "lg" ? "sm:max-w-[640px]" : "sm:max-w-[480px]")}>
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
          </div>
          <IconButton label="Close" onClick={onClose}><X size={17} strokeWidth={ICON} /></IconButton>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

/** Lightweight click-to-open menu. Items: { label, onSelect, danger?, shortcut? } */
export function Menu({ trigger, items, align = "right" }: { trigger: (open: () => void) => ReactNode; items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; shortcut?: string }[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEsc(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div role="menu" className={cx("absolute z-30 mt-1 min-w-48 rounded-md border border-border bg-surface py-1 shadow-md animate-fade-in", align === "right" ? "right-0" : "left-0")}>
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cx("flex h-8 w-full items-center justify-between gap-4 px-3 text-left text-[13px] disabled:opacity-40", it.danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-subtle")}
            >
              {it.label}
              {it.shortcut && <Kbd>{it.shortcut}</Kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal step indicator for setup flows. */
export function Stepper({ steps, current }: { steps: { label: string; to?: string; done: boolean }[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1 text-[13px]">
      {steps.map((s, i) => {
        const active = i === current;
        const content = (
          <span className={cx("flex items-center gap-2 whitespace-nowrap rounded-md px-1.5 py-1", s.to && !active && "hover:bg-muted")}>
            <span
              className={cx(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                s.done ? "bg-success text-on-primary" : active ? "bg-primary text-on-primary" : "border border-border-strong text-ink-3",
              )}
            >
              {s.done ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx(active ? "font-semibold text-ink" : s.done ? "text-ink-2" : "text-ink-3")}>{s.label}</span>
          </span>
        );
        return (
          <li key={i} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            {s.to ? <Link to={s.to}>{content}</Link> : content}
            {i < steps.length - 1 && <span className="h-px w-6 shrink-0 bg-border-strong sm:w-10" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** File drop zone (simulated; picks a sample file name on click or drop). */
export function DropZone({ onFile, accept, title, hint, disabled, sample }: { onFile: (name: string, sizeMb: number) => void; accept: string; title: string; hint: string; disabled?: boolean; sample: { name: string; sizeMb: number } }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f.name, Math.round((f.size / 1048576) * 10) / 10);
        else onFile(sample.name, sample.sizeMb);
      }}
      className={cx(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors duration-150",
        over ? "border-primary bg-primary-soft" : "border-border-strong bg-subtle",
        disabled && "opacity-50",
      )}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-xs text-ink-3">{hint}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>Choose file</Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onFile(sample.name, sample.sizeMb)}>Use sample: {sample.name}</Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f.name, Math.round((f.size / 1048576) * 10) / 10);
        }}
      />
    </div>
  );
}

/** Definition list row used in side panels and detail pages. */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Simulated first-load: true for `ms` after mount (skeletons), unless `skip`. */
export function useFakeLoading(ms = 450, skip = false) {
  const [loading, setLoading] = useState(!skip);
  useEffect(() => {
    if (skip) return;
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms, skip]);
  return loading;
}
