import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

export function Select<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  className,
  hint,
}: {
  id: string;
  label: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={String(value)}
          onChange={(event) => {
            const selected = options.find((option) => String(option.value) === event.target.value);
            if (selected) onChange(selected.value);
          }}
          className="h-11 w-full appearance-none rounded-xl border border-line bg-surface px-3.5 pr-9 text-sm font-medium text-ink transition focus:border-brand focus:outline-none"
        >
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</p>}
    </div>
  );
}
