import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { upsert: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111", guestId: "guest-test" })) },
  },
}));

import { GET as getConfig } from "@/app/api/config/route";
import { POST as postImports } from "@/app/api/imports/route";
import { POST as postJobs } from "@/app/api/jobs/route";
import { POST as postUploads } from "@/app/api/uploads/route";
import { GET as getAdmin } from "@/app/api/admin/overview/route";

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API route integration", () => {
  it("serves public runtime configuration without secrets", async () => {
    const response = await getConfig();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.appName).toBe("Clearframe");
    expect(payload.storageDriver).toBe("filesystem");
    expect(payload).not.toHaveProperty("sessionSecret");
    expect(payload).not.toHaveProperty("adminToken");
  });

  it("rejects private-network URL imports before making a network request", async () => {
    const response = await postImports(jsonRequest("/api/imports", {
      url: "http://127.0.0.1/private-file.mp4",
      authorized: true,
    }));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("PRIVATE_IP");
  });

  it("rejects known streaming-page URLs", async () => {
    const response = await postImports(jsonRequest("/api/imports", {
      url: "https://www.youtube.com/watch?v=abc",
      authorized: true,
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("STREAMING_PAGE");
  });

  it("rejects unsupported or injected output formats at the job API boundary", async () => {
    const response = await postJobs(jsonRequest("/api/jobs", {
      authorized: true,
      items: [{ mediaId: "6f1a13cb-7c0f-43c5-9b28-1ce4c7b1b7ba", targetFormat: "MP4; rm -rf /" }],
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("requires multipart form data for uploads", async () => {
    const response = await postUploads(jsonRequest("/api/uploads", { hello: "world" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toMatch(/multipart/);
  });

  it("requires a valid admin key for operational data", async () => {
    const response = await getAdmin(new NextRequest("http://localhost/api/admin/overview"));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("ADMIN_UNAUTHORIZED");
  });
});
