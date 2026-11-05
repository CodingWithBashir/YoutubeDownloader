import Link from "next/link";
import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-9 w-9 shrink-0 items-center justify-center", className)} aria-hidden="true">
      <svg viewBox="0 0 40 40" className="h-full w-full">
        <defs>
          <linearGradient id="cf-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--brand))" />
            <stop offset="100%" stopColor="rgb(var(--gold))" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#cf-brand)" />
        <path d="M14 12.5 27 20l-13 7.5V12.5Z" fill="white" fillOpacity="0.96" />
        <path d="M10 29h20" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
        <circle cx="31" cy="9" r="3" fill="rgb(var(--teal))" />
      </svg>
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Clearframe home">
      <BrandMark className="transition-transform duration-300 group-hover:-rotate-6" />
      {!compact && (
        <span className="text-[17px] font-bold tracking-[-0.04em] text-ink">
          clear<span className="text-brand">frame</span>
        </span>
      )}
    </Link>
  );
}
