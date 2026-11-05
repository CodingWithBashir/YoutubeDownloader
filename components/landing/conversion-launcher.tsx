"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Link2, LockKeyhole } from "lucide-react";
import { UploadDropzone } from "@/components/landing/upload-dropzone";
import { UrlImportForm } from "@/components/landing/url-import-form";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api-client";
import type { MediaDTO, PublicConfig } from "@/lib/types";

type Tab = "upload" | "url";

export function ConversionLauncher() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upload");
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<PublicConfig>("/api/config")
      .then((value) => active && setConfig(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const onSuccess = (media: MediaDTO[]) => {
    if (!media.length) return;
    router.push(`/workspace?media=${media.map((item) => item.id).join(",")}`);
  };

  return (
    <section id="start" className="scroll-mt-28">
      <div className="overflow-hidden rounded-[36px] border border-line/90 bg-surface/85 shadow-lift backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b border-line/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="eyebrow">Conversion intake</p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">Start with files you control</h2>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
            <LockKeyhole className="h-3.5 w-3.5" />
            Guest session · no sign-up
          </div>
        </div>

        <div className="px-6 pt-6 sm:px-8">
          <div className="inline-flex w-full rounded-2xl border border-line bg-surface-2/70 p-1 sm:w-auto" role="tablist" aria-label="Conversion source">
            {(
              [
                { id: "upload", label: "Upload files", icon: FileUp },
                { id: "url", label: "Direct file URL", icon: Link2 },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:flex-none",
                    tab === item.id ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {tab === "upload" ? <UploadDropzone config={config} onSuccess={onSuccess} /> : <UrlImportForm config={config} onSuccess={onSuccess} />}
        </div>

        <div className="flex flex-col gap-2 border-t border-line/80 bg-surface-2/40 px-6 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>After intake you choose format, resolution and bitrate in the workspace.</span>
          <a href="/legal/copyright" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            Read the copyright policy <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
