import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { upsert: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111", guestId: "guest-security" })) },
    conversionOutput: { findFirst: vi.fn(async () => null) },
  },
}));

import { POST as postImports } from "@/app/api/imports/route";
import { POST as postJobs } from "@/app/api/jobs/route";
import { POST as postUploads } from "@/app/api/uploads/route";
import { GET as getDownload } from "@/app/api/outputs/[id]/download/route";
import { GET as getStorageObject } from "@/app/api/storage/[...key]/route";

const uuid = "6f1a13cb-7c0f-43c5-9b28-1ce4c7b1b7ba";

describe("API security boundaries", () => {
  it("rejects cross-origin state changes", async () => {
    const request = new NextRequest("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ authorized: true, items: [{ mediaId: uuid, targetFormat: "MP3" }] }),
    });
    const response = await postJobs(request);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("INVALID_ORIGIN");
  });

  it("rejects cross-origin uploads before reading the body", async () => {
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "localhost:3000" },
      body: "not-multipart",
    });
    expect((await postUploads(request)).status).toBe(403);
  });

  it("rejects private-network imports before a network fetch", async () => {
    const request = new NextRequest("http://localhost:3000/api/imports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/media.mp4", authorized: true }),
    });
    const response = await postImports(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("PRIVATE_IP");
  });

  it("never serves a download owned by another guest session", async () => {
    const response = await getDownload(
      new NextRequest(`http://localhost:3000/api/outputs/${uuid}/download`),
      { params: Promise.resolve({ id: uuid }) },
    );
    expect(response.status).toBe(404);
  });

  it("rejects a tampered signed storage URL before opening the object", async () => {
    const expires = Math.floor(Date.now() / 1000) + 300;
    const request = new NextRequest(
      `http://localhost:3000/api/storage/user/file/output.mp3?exp=${expires}&sig=tampered-signature&disp=attachment`,
    );
    const response = await getStorageObject(request, {
      params: Promise.resolve({ key: ["user", "file", "output.mp3"] }),
    });
    expect(response.status).toBe(404);
  });
});
