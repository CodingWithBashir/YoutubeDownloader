import { spawn } from "node:child_process";
import { FFMPEG_PATH, FFPROBE_PATH } from "@/lib/media/binaries";

export interface RunBinaryOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  onLine?: (line: string) => void;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
}

export interface RunBinaryResult {
  stdout: string;
  stderr: string;
}

export function runBinary(binary: string, args: string[], options: RunBinaryOptions): Promise<RunBinaryResult> {
  const maxStdout = options.maxStdoutBytes || 4 * 1024 * 1024;
  const maxStderr = options.maxStderrBytes || 256 * 1024;
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let lineBuffer = "";
    let settled = false;
    let timedOut = false;

    const cleanup = () => {
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener("abort", onAbort);
    };
    const finish = (error: Error | null, result?: RunBinaryResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result!);
    };
    const onAbort = () => {
      if (settled) return;
      child.kill("SIGKILL");
      finish(new Error("The media process was canceled."));
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      finish(new Error(`The media process exceeded its ${Math.round(options.timeoutMs / 1000)}s timeout.`));
    }, options.timeoutMs);

    if (options.signal?.aborted) {
      child.kill("SIGKILL");
      finish(new Error("The media process was canceled."));
      return;
    }
    options.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > maxStdout) {
        child.kill("SIGKILL");
        finish(new Error("The media process produced too much diagnostic output."));
        return;
      }
      if (options.onLine) {
        lineBuffer += chunk;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || "";
        for (const line of lines) if (line.trim()) options.onLine(line.trim());
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr) < maxStderr) stderr += chunk;
    });

    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (options.onLine && lineBuffer.trim()) options.onLine(lineBuffer.trim());
      if (timedOut) return;
      if (code === 0) finish(null, { stdout, stderr });
      else finish(new Error(stderr.trim().slice(-1200) || `The media process exited with code ${code}.`));
    });
  });
}

export function runFfmpeg(args: string[], options: RunBinaryOptions) {
  return runBinary(FFMPEG_PATH, args, options);
}

export function runFfprobe(args: string[], timeoutMs: number) {
  return runBinary(FFPROBE_PATH, args, { timeoutMs, maxStdoutBytes: 8 * 1024 * 1024 });
}
