import { describe, expect, it } from "vitest";
import { assertDirectMediaUrl, isPublicIpAddress, UrlImportError } from "@/lib/url-guard";

describe("authorized URL import guard", () => {
  it("rejects private, loopback, metadata and reserved IPs", () => {
    for (const address of ["127.0.0.1", "10.0.0.4", "169.254.169.254", "192.168.1.2", "::1", "fc00::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
  });

  it("rejects streaming pages, private hosts, playlists and nonstandard ports", () => {
    const unsafe = [
      "https://www.youtube.com/watch?v=authorized-looking-id", "https://youtu.be/abc123",
      "http://localhost:8080/file.mp4", "http://127.0.0.1/file.mp4",
      "https://assets.example.com/stream.m3u8", "https://assets.example.com:8443/file.mp4",
      "ftp://assets.example.com/file.mp4", "https://user:pass@assets.example.com/file.mp4",
    ];
    for (const url of unsafe) expect(() => assertDirectMediaUrl(url), url).toThrow(UrlImportError);
  });

  it("accepts a plain direct media URL and returns a normalized hostname", () => {
    const result = assertDirectMediaUrl("https://ASSETS.example.org./licensed/clip.mp4");
    expect(result.hostname).toBe("assets.example.org");
    expect(result.url.pathname).toBe("/licensed/clip.mp4");
  });
});
