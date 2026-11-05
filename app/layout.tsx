import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans/index.css";
import "@fontsource-variable/newsreader/index.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Clearframe — Authorized media conversion",
    template: "%s · Clearframe",
  },
  description:
    "Convert your own video and audio files to MP4, WebM, MP3, WAV, AAC and FLAC with real background processing, signed downloads and automatic cleanup. No account required.",
  applicationName: "Clearframe",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#080d17" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <div className="relative flex min-h-screen flex-col overflow-x-hidden">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
