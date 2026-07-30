import { describe, expect, it } from "vitest";
import {
  institutionResearchSchema,
  institutionSelectionSchema,
} from "@/features/institutions/submission";

const id = "00000000-0000-4000-8000-000000000001";

describe("institution submission", () => {
  it("accepts a bounded unique selection", () => {
    expect(institutionSelectionSchema.safeParse({ institutionIds: [id] }).success).toBe(true);
  });

  it("rejects duplicate or empty selections", () => {
    expect(institutionSelectionSchema.safeParse({ institutionIds: [] }).success).toBe(false);
    expect(institutionSelectionSchema.safeParse({ institutionIds: [id, id] }).success).toBe(false);
  });

  it("accepts a plain institution name", () => {
    expect(institutionResearchSchema.parse({ name: "Banco Exemplo" }).name)
      .toBe("Banco Exemplo");
  });

  it.each(["https://example.com", "www.example.com", "banco@example.com", "<script>"])(
    "rejects address or markup input: %s",
    (name) => {
      expect(institutionResearchSchema.safeParse({ name }).success).toBe(false);
    },
  );
});
