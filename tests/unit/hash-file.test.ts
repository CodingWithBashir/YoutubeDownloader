import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hashFile } from "@/lib/hash-file";
import { makeTestWav } from "../helpers/make-wav";

describe("file hashing", () => {
  it("streams a whole file into SHA-256 without stalling", async () => {
    const { directory, filePath, buffer } = await makeTestWav(0.5);
    expect(await hashFile(filePath)).toBe(createHash("sha256").update(buffer).digest("hex"));
    expect((await readFile(filePath)).length).toBe(buffer.length);
    await rm(directory, { recursive: true, force: true });
  }, 10_000);
});
