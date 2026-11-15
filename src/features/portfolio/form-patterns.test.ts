import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Regressão: dentro de um atributo JSX, "\\d" vira uma barra literal e o
// navegador passa a recusar qualquer número válido.
const forms = [
  "add-asset-form.tsx",
  "add-transaction-form.tsx",
  "../goals/contribution-form.tsx",
];

const valid = ["10", "10,5", "0.25", "37,50", "8000,00", "9.85", "0,00", "12,3"];

function patterns(file: string): string[] {
  const source = readFileSync(path.join(__dirname, file), "utf8");
  return [...source.matchAll(/pattern="([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("padrões de validação dos formulários numéricos", () => {
  for (const file of forms) {
    it(`${file}: não usa barra invertida em dobro`, () => {
      const found = patterns(file);
      expect(found.length).toBeGreaterThan(0);
      for (const pattern of found) expect(pattern).not.toContain("\\\\");
    });

    it(`${file}: aceita ao menos um valor monetário válido e recusa texto`, () => {
      for (const pattern of patterns(file)) {
        const regex = new RegExp(`^(?:${pattern})$`, "v");
        expect(valid.some((value) => regex.test(value)), pattern).toBe(true);
        expect(regex.test("abc"), pattern).toBe(false);
      }
    });
  }
});
