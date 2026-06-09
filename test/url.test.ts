import { describe, it, expect } from "vitest";
import { isValidSlug, buildTarget } from "../src/lib/url";

describe("isValidSlug", () => {
  it("accepts lowercase alphanumerics and hyphens", () => {
    expect(isValidSlug("react-talk-2026")).toBe(true);
  });
  it("rejects empty, uppercase, spaces, and leading hyphen", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("React")).toBe(false);
    expect(isValidSlug("a b")).toBe(false);
    expect(isValidSlug("-x")).toBe(false);
  });
});

describe("buildTarget", () => {
  it("merges incoming UTM params, incoming wins", () => {
    const incoming = new URLSearchParams("utm_source=slides&foo=bar");
    const out = buildTarget("https://ex.com/p?utm_source=old&a=1", incoming);
    const u = new URL(out);
    expect(u.searchParams.get("utm_source")).toBe("slides");
    expect(u.searchParams.get("a")).toBe("1");
    expect(u.searchParams.get("foo")).toBe(null); // only UTM keys merged
  });
});
