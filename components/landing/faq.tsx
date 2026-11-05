"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

const questions = [
  {
    question: "Do I need an account?",
    answer:
      "No. Clearframe creates a signed, HttpOnly guest-session cookie when you add media. That session owns the files, jobs and history on this device. You can clear it from Settings at any time.",
  },
  {
    question: "Can I paste a YouTube, TikTok, Instagram or other streaming link?",
    answer:
      "No. Clearframe does not extract media from protected streaming pages, bypass DRM, scrape playlists or circumvent access controls. URL import accepts direct media-file URLs that you own or are explicitly licensed to process, and screens hosts, redirects, DNS results and response signatures.",
  },
  {
    question: "Which output formats are supported?",
    answer:
      "Video sources can be converted to MP4 or WebM, and audio can be extracted to MP3, WAV, AAC or FLAC. Audio-only sources support the four audio formats. Resolution and bitrate presets are validated against the source so files are never silently upscaled.",
  },
  {
    question: "Is the progress real?",
    answer:
      "Yes. Jobs are persisted in PostgreSQL and processed by a separate FFmpeg worker. Progress is derived from FFmpeg's actual out_time output and stored with processing events. If the queue or worker is unavailable, jobs fail visibly instead of showing simulated completion.",
  },
  {
    question: "How long are files kept?",
    answer:
      "The deployment configures a retention window (24 hours by default). Source files, previews and outputs are marked expired and a scheduled cleanup removes the objects. Download links are separately signed and expire in minutes.",
  },
  {
    question: "What happens to previews and thumbnails?",
    answer:
      "For video, the server generates a still frame and a short low-resolution preview. For audio, it generates a waveform image and a short audio preview. These are real FFmpeg-generated assets, not placeholders.",
  },
  {
    question: "How are downloads protected?",
    answer:
      "Each download is checked against the guest session and job ownership, then redirected to a short-lived signed object URL. With S3-compatible storage the signature is a pre-signed S3 URL; with local development storage it is an HMAC-signed application URL.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line/80 overflow-hidden rounded-3xl border border-line/80 bg-surface/70">
      {questions.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : index)}
              className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left transition hover:bg-surface-2/50 sm:px-7"
              aria-expanded={expanded}
            >
              <span className="text-sm font-semibold text-ink sm:text-base">{item.question}</span>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line transition", expanded && "border-brand/40 bg-brand-soft text-brand")}>
                {expanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>
            <div className={cn("grid transition-all duration-300 ease-swift", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <p className="px-5 pb-6 text-sm leading-7 text-muted sm:px-7">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
