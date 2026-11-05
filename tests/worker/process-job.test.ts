import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const findUnique = vi.fn(async () => null);
  return {
    findUnique,
    prisma: {
      conversionJob: { findUnique, updateMany: vi.fn(), update: vi.fn() },
      processingEvent: { create: vi.fn() },
      mediaFile: { findMany: vi.fn() },
      conversionOutput: { create: vi.fn() },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/storage", () => ({ getStorage: vi.fn(() => ({})) }));
vi.mock("@/worker/active-jobs", () => ({
  registerActiveJob: vi.fn(), unregisterActiveJob: vi.fn(), cancelActiveJob: vi.fn(),
}));

import { processConversionJob } from "@/worker/process-job";

describe("worker job eligibility", () => {
  it("does not fabricate a result for a job missing from persistent storage", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    const result = await processConversionJob("22222222-2222-2222-2222-222222222222", "test-worker");
    expect(result.ok).toBe(false);
    expect(result.status).toBe("NOT_FOUND");
    expect(result.error).toMatch(/not eligible/);
  });
});
