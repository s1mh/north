import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const worker = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

describe("PWA service worker policy", () => {
  it("keeps authenticated navigation network-first with neutral fallback", () => {
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain('fetch(request).catch(() => caches.match("/offline"))');
  });

  it("only caches versioned Next assets and explicit public shell files", () => {
    expect(worker).toContain('url.pathname.startsWith("/_next/static/")');
    expect(worker).toContain("PUBLIC_SHELL.includes(url.pathname)");
    expect(worker).not.toContain('"/inicio"');
    expect(worker).not.toContain('"/api/');
    expect(worker).not.toContain("supabase");
  });

  it("supports version cleanup and explicit logout cleanup", () => {
    expect(worker).toContain("north-static-v1");
    expect(worker).toContain("CLEAR_NORTH_CACHES");
    expect(worker).toContain("caches.delete(key)");
  });
});
