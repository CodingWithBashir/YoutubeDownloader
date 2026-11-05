"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, FileVideo2, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { createDemoWavFile } from "@/lib/create-demo-wav";
import type { MediaDTO, PublicConfig } from "@/lib/types";

interface UploadDropzoneProps {
  config: PublicConfig | null;
  onSuccess: (media: MediaDTO[]) => void;
}

export function UploadDropzone({ config, onSuccess }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => xhrRef.current?.abort(), []);

  const startUpload = useCallback(
    (files: File[]) => {
      const maxFiles = config?.maxBatchFiles || 8;
      const maxBytes = config?.maxUploadBytes || 262_144_000;
      if (!files.length) return;
      if (files.length > maxFiles) {
        setError(`Select at most ${maxFiles} files per batch.`);
        return;
      }
      const oversized = files.find((file) => file.size > maxBytes);
      if (oversized) {
        setError(`${oversized.name} exceeds the ${formatBytes(maxBytes)} per-file limit.`);
        return;
      }
      if (files.some((file) => file.size === 0)) {
        setError("Empty files cannot be processed.");
        return;
      }

      setSelected(files);
      setError(null);
      setUploading(true);
      setProgress(0);
      setStage("Uploading bytes");

      const formData = new FormData();
      for (const file of files) formData.append("files", file, file.name);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", "/api/uploads");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onloadstart = () => setStage("Uploading bytes");
      xhr.upload.onload = () => {
        setProgress(100);
        setStage("Validating signatures, probing metadata and generating previews");
      };
      xhr.onerror = () => {
        setUploading(false);
        setError("The network connection was interrupted during upload.");
      };
      xhr.onabort = () => {
        setUploading(false);
        setStage("");
        setProgress(null);
      };
      xhr.onload = () => {
        setUploading(false);
        let payload: any = null;
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          payload = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && payload?.media) {
          setStage("Ready");
          onSuccess(payload.media as MediaDTO[]);
          return;
        }
        setError(payload?.error?.message || `Upload failed with HTTP ${xhr.status}.`);
        setStage("");
        setProgress(null);
      };
      xhr.send(formData);
    },
    [config, onSuccess],
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const files = Array.from(fileList || []);
      if (files.length) startUpload(files);
    },
    [startUpload],
  );

  return (
    <div>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "relative rounded-[28px] border-2 border-dashed p-8 text-center transition duration-300 sm:p-10",
          dragging ? "border-brand bg-brand-soft/60 scale-[1.005]" : "border-line bg-surface-2/40 hover:border-brand/40",
          uploading && "pointer-events-none opacity-80",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept="video/*,audio/*,.mp4,.webm,.mp3,.wav,.aac,.flac,.ogg,.oga,.m4a,.mov,.mkv,.avi,.ts"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-soft">
          {uploading ? <Loader2 className="h-7 w-7 animate-spin text-brand" /> : <UploadCloud className="h-7 w-7 text-brand" />}
        </div>
        <h3 className="font-display text-2xl font-medium tracking-tight text-ink">
          {uploading ? stage : "Drop your media files here"}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          {uploading
            ? "This is the real upload and server-side validation step. Conversion progress appears only after a job is queued."
            : "Video and audio files are checked by file signature, MIME type and FFprobe before any worker touches them."}
        </p>

        {progress !== null && (
          <div className="mx-auto mt-6 max-w-md">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
              <span>{stage.includes("Validating") ? "Upload complete" : "Upload"}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {!uploading && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => inputRef.current?.click()} size="sm">
              <FileVideo2 className="h-4 w-4" />
              Choose files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startUpload([createDemoWavFile()])}
              title="Generate an original 2.5-second WAV tone and process it"
            >
              <Sparkles className="h-4 w-4 text-teal" />
              Try a demo tone
            </Button>
          </div>
        )}

        {uploading && xhrRef.current && (
          <Button
            variant="ghost"
            size="sm"
            className="pointer-events-auto mt-5"
            onClick={() => xhrRef.current?.abort()}
          >
            <X className="h-4 w-4" />
            Cancel upload
          </Button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selected.map((file, index) => (
            <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted">
              {file.type.startsWith("audio/") ? <AudioLines className="h-3.5 w-3.5 text-teal" /> : <FileVideo2 className="h-3.5 w-3.5 text-brand" />}
              <span className="truncate font-medium text-ink">{file.name}</span>
              <span>{formatBytes(file.size)}</span>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          <p className="font-semibold">{error}</p>
          {selected.length > 0 && (
            <button type="button" onClick={() => startUpload(selected)} className="mt-2 text-xs font-bold underline underline-offset-4">
              Retry these files
            </button>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        Up to {config?.maxBatchFiles || 8} files · {formatBytes(config?.maxUploadBytes || 262_144_000)} per file · retained for {config?.retentionHours || 24}h
      </p>
    </div>
  );
}
