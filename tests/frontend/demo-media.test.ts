import { describe, expect, it } from "vitest";
import { createDemoWavFile } from "@/lib/create-demo-wav";
import { validateMediaSignature } from "@/lib/signatures";

describe("browser-generated demo media", () => {
  it("creates a real RIFF/WAVE file that passes server-side signature rules", async () => {
    const file = createDemoWavFile(0.5);
    const head = Buffer.from(await file.arrayBuffer()).subarray(0, 64);
    const validated = validateMediaSignature({ head, filename: file.name, declaredMime: file.type });
    expect(validated.container).toBe("wav");
    expect(file.size).toBeGreaterThan(44);
  });
});
