import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

process.env.TZ = "UTC";
process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-random-characters";
process.env.ADMIN_TOKEN = "test-admin-key-with-at-least-16-characters";
process.env.DATABASE_URL = "postgresql://clearframe:clearframe@127.0.0.1:55432/clearframe?schema=public";
process.env.STORAGE_DRIVER = "filesystem";
process.env.LOCAL_STORAGE_ROOT = "/tmp/clearframe-test-storage";
process.env.MAX_UPLOAD_BYTES = "262144000";
process.env.MAX_IMPORT_BYTES = "262144000";
process.env.RETENTION_HOURS = "24";
process.env.DOWNLOAD_URL_TTL_SECONDS = "300";
process.env.FFMPEG_PATH = ffmpegInstaller.path;
process.env.FFPROBE_PATH = ffprobeInstaller.path;
delete process.env.REDIS_URL;

// jsdom 25 does not implement Blob.arrayBuffer(), which browser code uses.
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
  Object.defineProperty(Blob.prototype, "arrayBuffer", {
    writable: true,
    value: function arrayBuffer(this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    },
  });
}

// Tests mock the database at the boundary; never instantiate the generated client here.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
