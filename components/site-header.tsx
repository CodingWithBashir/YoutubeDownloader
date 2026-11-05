"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, ShieldCheck, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const navigation = [
  { label: "Workspace", href: "/workspace" },
  { label: "History", href: "/history" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Formats", href: "/#formats" },
  { label: "FAQ", href: "/#faq" },
  { label: "Policies", href: "/legal/terms" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="hidden border-b border-line/60 bg-surface/40 py-1.5 text-center text-[11px] font-medium text-muted lg:block">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Authorized media only · No account required · Files expire automatically
        </span>
      </div>
      <div className="container-shell flex h-[68px] items-center justify-between gap-6">
        <Brand />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => {
            const active = item.href.startsWith("/#")
              ? pathname === "/" && item.href.includes("#")
              : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-[13px] font-medium transition",
                  active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface/70 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link href="/workspace" className="hidden sm:block">
            <Button size="sm" className="group">
              Open workspace
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface/60 text-ink lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="animate-fade-up border-t border-line/70 bg-surface/95 px-5 py-5 shadow-soft backdrop-blur-xl lg:hidden">
          <div className="grid gap-1">
            {navigation.map((item) => (
              <Link key={item.label} href={item.href} className="rounded-xl px-3 py-3 text-sm font-semibold text-ink hover:bg-surface-2">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
            <ThemeToggle expanded />
            <Link href="/workspace" className="flex-1">
              <Button className="w-full">Open workspace</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
