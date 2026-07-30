import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
};

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "public/manifest.webmanifest"), "utf8"),
) as {
  start_url: string;
  scope: string;
  display: string;
  icons: ManifestIcon[];
};

describe("PWA manifest", () => {
  it("stays inside the North origin and opens standalone", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("provides installable PNG sizes and a maskable icon", () => {
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
  });

  it("does not declare shortcuts to authenticated routes", () => {
    expect(manifest).not.toHaveProperty("shortcuts");
  });
});
