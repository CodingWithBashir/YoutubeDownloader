import type { HTMLAttributes, ReactNode } from "react";
import { ArrowUpRight, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import type { JobStatus } from "@/lib/types";

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("container-shell", className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-line/80 bg-surface/80 shadow-soft", className)} {...props} />;
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "brand" | "teal" | "success" | "warning" | "danger";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-surface-2 text-muted",
    brand: "border-brand/20 bg-brand-soft text-brand",
    teal: "border-teal/20 bg-teal/10 text-teal",
    success: "border-success/20 bg-success/10 text-success",
    warning: "border-gold/30 bg-gold/10 text-gold",
    danger: "border-danger/20 bg-danger/10 text-danger",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, tone = "brand", indeterminate = false }: { value: number; tone?: "brand" | "success" | "danger" | "teal"; indeterminate?: boolean }) {
  const tones = { brand: "bg-brand", success: "bg-success", danger: "bg-danger", teal: "bg-teal" };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : Math.round(value)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-swift", tones[tone], indeterminate && "w-1/3 animate-pulse")}
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

const STATUS_STYLES: Record<JobStatus, { label: string; tone: "neutral" | "brand" | "teal" | "success" | "danger" | "warning" }> = {
  QUEUED: { label: "Queued", tone: "neutral" },
  PROCESSING: { label: "Processing", tone: "teal" },
  COMPLETED: { label: "Completed", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELED: { label: "Canceled", tone: "warning" },
};

export function StatusPill({ status }: { status: JobStatus }) {
  const config = STATUS_STYLES[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="font-display text-2xl font-medium tracking-tight text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, align = "left" }: { eyebrow: string; title: ReactNode; description?: string; align?: "left" | "center" }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display-type mt-3 text-4xl font-medium leading-[1.08] text-ink sm:text-5xl">{title}</h2>
      {description && <p className="mt-5 text-base leading-7 text-muted">{description}</p>}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 font-semibold text-brand transition hover:gap-2">
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}
