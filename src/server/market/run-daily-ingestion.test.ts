import { describe, expect, it } from "vitest";
import { settleSequentially } from "@/server/market/settle-sequentially";

describe("market ingestion orchestration", () => {
  it("does not overlap authenticated source requests", async () => {
    let active = 0;
    let maximumActive = 0;
    const order: string[] = [];

    const results = await settleSequentially(["bcb", "b3"], async (source) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      order.push(`start:${source}`);
      await Promise.resolve();
      order.push(`finish:${source}`);
      active -= 1;
      return source;
    });

    expect(maximumActive).toBe(1);
    expect(order).toEqual(["start:bcb", "finish:bcb", "start:b3", "finish:b3"]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  });

  it("still attempts the next source after a failure", async () => {
    const attempted: string[] = [];
    const results = await settleSequentially(["bcb", "b3"], async (source) => {
      attempted.push(source);
      if (source === "bcb") throw new Error("unavailable");
      return source;
    });

    expect(attempted).toEqual(["bcb", "b3"]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "fulfilled"]);
  });
});
