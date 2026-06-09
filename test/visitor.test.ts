import { describe, it, expect } from "vitest";
import { visitorHash, dayKey, parseUserAgent } from "../src/lib/visitor";

describe("visitorHash", () => {
  it("is stable for same inputs and differs across days", async () => {
    const a = await visitorHash("1.1.1.1", "UA", "salt", "2026-06-06");
    const b = await visitorHash("1.1.1.1", "UA", "salt", "2026-06-06");
    const c = await visitorHash("1.1.1.1", "UA", "salt", "2026-06-07");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("dayKey", () => {
  it("returns the UTC date portion", () => {
    expect(dayKey(Date.parse("2026-06-06T23:30:00Z"))).toBe("2026-06-06");
  });
});

describe("parseUserAgent", () => {
  it("classifies Chrome desktop", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML) Chrome/120 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ device: "desktop", browser: "Chrome" });
  });
  it("classifies mobile Safari", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ device: "mobile", browser: "Safari" });
  });
  it("classifies an iPad (whose UA also contains 'Mobile') as tablet", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ device: "tablet", browser: "Safari" });
  });
  it("classifies an Android tablet (no 'Mobile' token) as tablet", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; SM-T500) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ device: "tablet", browser: "Chrome" });
  });
  it("still classifies an Android phone (with 'Mobile') as mobile", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ device: "mobile", browser: "Chrome" });
  });
});
