import { describe, expect, it } from "vitest";
import { createSessionValue, verifySessionValue } from "@/lib/session";
import { localObjectUrl, verifyObjectRequest } from "@/lib/signed-url";

describe("signed guest sessions and object links", () => {
  it("verifies a fresh session and rejects tampering", () => {
    const value = createSessionValue("guest-123");
    expect(verifySessionValue(value)?.guestId).toBe("guest-123");
    const parts = value.split(".");
    expect(verifySessionValue(`${parts[0]}.${parts[1]}.tampered`)).toBeNull();
    expect(verifySessionValue("not-a-session")).toBeNull();
  });

  it("creates an expiring local object URL with a verifiable signature", () => {
    const signed = localObjectUrl("user/job/output.mp3", 300, "attachment");
    const url = new URL(signed.url, "http://localhost");
    const key = decodeURIComponent(url.pathname.replace("/api/storage/", ""));
    const expiry = url.searchParams.get("exp")!;
    const signature = url.searchParams.get("sig")!;
    expect(verifyObjectRequest(key, expiry, signature)).toBe(true);
    expect(verifyObjectRequest("user/job/other.mp3", expiry, signature)).toBe(false);
    expect(verifyObjectRequest(key, "1", signature)).toBe(false);
  });
});
