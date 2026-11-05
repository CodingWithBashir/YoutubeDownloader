import Link from "next/link";
import { Brand } from "@/components/brand";

const groups = [
  {
    title: "Product",
    links: [
      { label: "Workspace", href: "/workspace" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Conversion history", href: "/history" },
      { label: "Settings", href: "/settings" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Copyright", href: "/legal/copyright" },
    ],
  },
  {
    title: "Operations",
    links: [
      { label: "Service health", href: "/api/health" },
      { label: "Admin", href: "/admin" },
      { label: "Supported formats", href: "/#formats" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line/80 bg-surface/50">
      <div className="container-shell grid gap-12 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Brand />
          <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
            A focused conversion studio for media you own or are explicitly licensed to process. Private by design, temporary by default.
          </p>
          <p className="mt-5 inline-flex rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
            No streaming-site extraction · No DRM circumvention
          </p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-ink">{group.title}</h3>
            <ul className="mt-5 space-y-3">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted transition hover:text-brand">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/70">
        <div className="container-shell flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Clearframe. Built for authorized media workflows.</span>
          <span>Guest sessions · signed downloads · automatic expiration</span>
        </div>
      </div>
    </footer>
  );
}
