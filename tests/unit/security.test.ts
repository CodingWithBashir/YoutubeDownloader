import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertSameOrigin, safeContentDisposition, safeStorageKey, trustedRequestOrigin } from "@/lib/security";

describe("request and storage safety", () => {
  it("builds signed redirects from the trusted request host, not the bind address", () => {
    const request = new NextRequest("http://0.0.0.0:3000/api/outputs/example/download", {
      headers: { host: "127.0.0.1:3000", "x-forwarded-proto": "https" },
    });
    expect(trustedRequestOrigin(request)).toBe("https://127.0.0.1:3000");
  });

  it("rejects cross-origin state changes and unsafe storage keys", () => {
    const request = new NextRequest("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).toThrow();
    expect(() => safeStorageKey("../private/output.mp3")).toThrow();
    expect(safeContentDisposition('song\r\n"inject".mp3')).not.toMatch(/[\r\n]/);
  });
});
