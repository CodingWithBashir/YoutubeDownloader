import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Ban,
  Boxes,
  Check,
  Clock3,
  Code2,
  FileSignature,
  Film,
  Fingerprint,
  Gauge,
  KeyRound,
  Layers3,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { ConversionLauncher } from "@/components/landing/conversion-launcher";
import { Faq } from "@/components/landing/faq";
import { Badge, Card, Container, SectionHeading } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  AUDIO_BITRATE_VALUES,
  OUTPUT_FORMAT_META,
  VIDEO_PRESETS,
  type OutputFormat,
} from "@/lib/presets";

export const metadata: Metadata = {
  title: "Clearframe — Authorized video & audio conversion",
  description:
    "A guest-first media conversion studio for files you own. Real FFmpeg jobs, signed downloads, metadata detection and automatic cleanup.",
};

const videoOutputs: OutputFormat[] = ["MP4", "WEBM"];
const audioOutputs: OutputFormat[] = ["MP3", "WAV", "AAC", "FLAC"];

const workflow = [
  {
    icon: FileSignature,
    step: "01",
    title: "Add authorized media",
    description: "Drag in files or import a direct media-file URL. Signatures, MIME types, size and duration are verified before storage.",
  },
  {
    icon: Layers3,
    step: "02",
    title: "Choose the output",
    description: "Inspect real FFprobe metadata, then select format, resolution and bitrate presets for each file in the batch.",
  },
  {
    icon: Workflow,
    step: "03",
    title: "Track real processing",
    description: "Persistent jobs move through Redis/BullMQ to a separate FFmpeg worker. Progress comes from FFmpeg, not a scripted animation.",
  },
  {
    icon: KeyRound,
    step: "04",
    title: "Download and expire",
    description: "Completed files are available through ownership-checked, short-lived signed links. Temporary objects are cleaned up automatically.",
  },
];

const safeguards = [
  { icon: FileSignature, title: "Signature-level validation", text: "Magic bytes, declared MIME, extension and FFprobe metadata must agree." },
  { icon: Network, title: "SSRF-resistant imports", text: "No private IPs, metadata endpoints, unsafe redirects, playlists or embedded URL credentials." },
  { icon: Code2, title: "No shell command strings", text: "FFmpeg and FFprobe arguments are fixed arrays built from validated numeric presets." },
  { icon: Fingerprint, title: "Guest ownership checks", text: "Signed anonymous sessions scope every media record, job, event and download." },
  { icon: TimerReset, title: "Bounded resources", text: "Configurable size, duration, resolution, concurrency, timeout and rate limits." },
  { icon: ShieldCheck, title: "Expiring capabilities", text: "Downloads use short-lived signed URLs; retention cleanup removes sources and outputs." },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-14 sm:pt-20 lg:pb-24">
        <div className="pointer-events-none absolute inset-0 ambient-grid opacity-45" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-teal/10 blur-3xl" aria-hidden="true" />

        <Container className="relative">
          <div className="grid items-center gap-14 lg:grid-cols-[1.03fr_0.97fr]">
            <div className="animate-fade-up">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand"><Sparkles className="h-3 w-3" /> Guest-first · no account</Badge>
                <Badge tone="teal"><ShieldCheck className="h-3 w-3" /> Authorized media only</Badge>
              </div>
              <h1 className="display-type mt-7 text-balance text-[3.4rem] font-medium leading-[0.94] text-ink sm:text-7xl lg:text-[5.4rem]">
                Your media, <span className="text-gradient">cleanly</span> transformed.
              </h1>
              <p className="mt-7 max-w-xl text-balance text-lg leading-8 text-muted">
                Clearframe is a focused conversion studio for video and audio you own, license or control. Upload a file, choose a precise output, and follow a real FFmpeg job from queue to signed download.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#start">
                  <Button size="lg" className="group">
                    Start a conversion
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </a>
                <Link href="/workspace">
                  <Button size="lg" variant="outline">Open workspace</Button>
                </Link>
              </div>

              <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 border-t border-line/80 pt-7 sm:grid-cols-4">
                {[
                  { label: "Video outputs", value: "MP4 · WebM" },
                  { label: "Audio outputs", value: "4 formats" },
                  { label: "Accounts", value: "None" },
                  { label: "Progress", value: "FFmpeg" },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{item.label}</dt>
                    <dd className="mt-1 text-sm font-bold text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative animate-scale-in lg:pl-6">
              <div className="absolute -inset-5 rounded-[42px] bg-gradient-to-br from-brand/15 via-transparent to-teal/15 blur-2xl" aria-hidden="true" />
              <Card className="relative overflow-hidden border-ink/10 bg-ink p-6 text-canvas shadow-lift sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-canvas/50">Processing path</p>
                    <p className="mt-2 font-display text-2xl font-medium tracking-tight">From bytes to a usable file</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-canvas/10">
                    <Play className="h-5 w-5" />
                  </div>
                </div>

                <div className="relative mt-8 space-y-3">
                  <div className="absolute bottom-5 left-[19px] top-5 w-px bg-canvas/15" aria-hidden="true" />
                  {[
                    { icon: FileSignature, label: "Signature & MIME", detail: "Container bytes verified", tone: "bg-brand" },
                    { icon: Activity, label: "FFprobe", detail: "Duration · codecs · dimensions", tone: "bg-gold" },
                    { icon: Boxes, label: "Persistent queue", detail: "PostgreSQL + Redis/BullMQ", tone: "bg-teal" },
                    { icon: Gauge, label: "FFmpeg worker", detail: "Real out_time progress", tone: "bg-success" },
                    { icon: KeyRound, label: "Signed output", detail: "Short-lived download link", tone: "bg-canvas/70" },
                  ].map((stage, index) => {
                    const Icon = stage.icon;
                    return (
                      <div key={stage.label} className="relative flex items-center gap-4 rounded-2xl border border-canvas/10 bg-canvas/[0.04] p-3.5">
                        <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stage.tone} text-ink`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{stage.label}</p>
                          <p className="truncate text-xs text-canvas/55">{stage.detail}</p>
                        </div>
                        <span className="font-mono text-[10px] text-canvas/35">0{index + 1}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-7 flex items-end gap-1.5 rounded-2xl bg-canvas/[0.05] p-4" aria-hidden="true">
                  {[18, 34, 24, 48, 30, 62, 44, 74, 38, 56, 28, 66, 42, 52, 22, 36, 18, 30, 16, 24].map((height, index) => (
                    <span key={index} className="flex-1 rounded-full bg-gradient-to-t from-brand/40 to-teal/80" style={{ height }} />
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="relative mt-16 lg:mt-20">
            <ConversionLauncher />
          </div>
        </Container>
      </section>

      <section id="formats" className="scroll-mt-24 border-y border-line/70 bg-surface/40 py-20">
        <Container>
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Supported conversions"
              title={<>Formats with intent, <span className="text-brand">not guesswork</span></>}
              description="Every selection is validated against the actual streams in your source. Audio extraction is offered only when an audio stream exists, and resolution presets never upscale."
            />
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral"><BadgeCheck className="h-3 w-3" /> MP4 / WebM</Badge>
              <Badge tone="neutral"><AudioLines className="h-3 w-3" /> MP3 / WAV / AAC / FLAC</Badge>
              <Badge tone="success"><Check className="h-3 w-3" /> Batch processing</Badge>
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Card className="p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Film className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-2xl font-medium tracking-tight text-ink">Video output</h3>
                  <p className="text-xs text-muted">H.264 and VP9 pipelines</p>
                </div>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {videoOutputs.map((format) => {
                  const meta = OUTPUT_FORMAT_META[format];
                  return (
                    <div key={format} className="rounded-2xl border border-line bg-surface-2/50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-ink">{meta.label}</span>
                        <span className="font-mono text-[10px] uppercase text-muted">.{meta.extension}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">{meta.description}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 border-t border-line pt-5">
                <p className="eyebrow">Resolution presets</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VIDEO_PRESETS.filter((preset) => preset.id !== "source").map((preset) => (
                    <span key={preset.id} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted">{preset.label.split(" · ")[1]}</span>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/10 text-teal"><AudioLines className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-2xl font-medium tracking-tight text-ink">Audio output & extraction</h3>
                  <p className="text-xs text-muted">Compressed and lossless options</p>
                </div>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {audioOutputs.map((format) => {
                  const meta = OUTPUT_FORMAT_META[format];
                  return (
                    <div key={format} className="rounded-2xl border border-line bg-surface-2/50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-ink">{meta.label}</span>
                        <span className="font-mono text-[10px] uppercase text-muted">.{meta.extension}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">{meta.description}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 border-t border-line pt-5">
                <p className="eyebrow">Bitrate presets</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {AUDIO_BITRATE_VALUES.map((bitrate) => (
                    <span key={bitrate} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted">{bitrate} kbps</span>
                  ))}
                  <span className="rounded-lg border border-success/20 bg-success/10 px-2.5 py-1.5 text-[11px] font-semibold text-success">Lossless WAV / FLAC</span>
                </div>
              </div>
            </Card>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Common authorized source containers include MP4, MOV, WebM/MKV, MP3, WAV, FLAC, AAC, Ogg and AVI — subject to signature and FFprobe validation.
          </p>
        </Container>
      </section>

      <section id="how" className="scroll-mt-24 py-20">
        <Container>
          <SectionHeading
            eyebrow="The workflow"
            title="A clear path from intake to download"
            description="No hidden browser tricks and no background mystery. Each stage writes durable records and visible processing events."
            align="center"
          />
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.step} className="group relative p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <span className="absolute right-5 top-4 font-mono text-xs text-line">{item.step}</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-brand transition group-hover:bg-brand-soft">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 font-display text-xl font-medium tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
                </Card>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="border-y border-line/70 bg-surface/40 py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <SectionHeading
                eyebrow="Legal boundary"
                title={<>Deliberately <span className="text-brand">narrow</span> by design</>}
                description="Clearframe processes files. It does not turn web pages into media, and it does not provide workarounds for rights or access controls."
              />
              <div className="mt-8 rounded-3xl border border-danger/20 bg-danger/[0.06] p-6">
                <div className="flex items-center gap-2 text-danger">
                  <TriangleAlert className="h-5 w-5" />
                  <h3 className="text-sm font-bold">What Clearframe will not do</h3>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-muted">
                  {[
                    "Download YouTube, Facebook, TikTok, Instagram, Vimeo or other streaming/social pages",
                    "Bypass DRM, paywalls, logins, geo-restrictions or access tokens",
                    "Scrape HLS/DASH playlists, manifests or third-party streaming services",
                    "Present a simulated conversion as a completed job",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Ban className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/legal/terms"><Button variant="outline" size="sm">Terms</Button></Link>
                <Link href="/legal/privacy"><Button variant="outline" size="sm">Privacy</Button></Link>
                <Link href="/legal/copyright"><Button variant="outline" size="sm">Copyright policy</Button></Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {safeguards.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10 text-teal">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <h3 className="mt-5 text-sm font-bold text-ink">{item.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-muted">{item.text}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <section id="faq" className="scroll-mt-24 py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <SectionHeading
                eyebrow="Questions"
                title="The useful details"
                description="Clear answers about scope, workflow and data handling."
              />
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Clock3 className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm font-semibold text-ink">Temporary by default</p>
                  <p className="text-xs text-muted">Sources, outputs and previews expire automatically.</p>
                </div>
              </div>
            </div>
            <Faq />
          </div>
        </Container>
      </section>

      <section className="pb-8">
        <Container>
          <Card className="relative overflow-hidden border-ink/10 bg-ink px-7 py-12 text-canvas sm:px-12">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/25 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 left-24 h-64 w-64 rounded-full bg-teal/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-canvas/50">Ready when your file is</p>
                <h2 className="display-type mt-3 max-w-2xl text-4xl font-medium leading-tight sm:text-5xl">Convert with a clear conscience and a clear job log.</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-canvas/65">No sign-up, no streaming-site extraction, no pretend progress. Just your media, a transparent pipeline and an expiring result.</p>
              </div>
              <a href="#start" className="shrink-0">
                <Button size="lg" className="group bg-canvas text-ink hover:brightness-95">
                  Start converting
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
            </div>
          </Card>
        </Container>
      </section>
    </>
  );
}
