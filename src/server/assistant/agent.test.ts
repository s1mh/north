import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/assistant/context", () => ({ loadAssistantContext: vi.fn() }));

const { buildTools, normalizeDecimal } = await import("./agent");

const instrumentId = "5d1c1a4e-5c53-4c8e-9a0e-5a1d3f6a2b10";

function fakeSupabase() {
  const created: Array<{ kind: string; payload: unknown }> = [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({
      data: { name: "Caixinhas", symbol: "CAIXINHAS", portfolio_institutions: { name: "Nubank" } },
    }),
  };
  return {
    created,
    client: {
      from: () => builder,
      rpc: async (name: string, args: { p_kind: string; p_payload: unknown }) => {
        if (name === "create_assistant_action") created.push({ kind: args.p_kind, payload: args.p_payload });
        return { data: "0b3c2d4e-1111-4222-8333-444455556666", error: null };
      },
    },
  };
}

const run = (tool: unknown, input: unknown) =>
  (tool as { execute: (input: unknown, options: unknown) => Promise<unknown> }).execute(input, {});

describe("normalizeDecimal", () => {
  it("aceita vírgula, ponto e milhar", () => {
    expect(normalizeDecimal("500,00")).toBe("500.00");
    expect(normalizeDecimal("1.234,56")).toBe("1234.56");
    expect(normalizeDecimal("37.5")).toBe("37.5");
  });
});

describe("ferramentas de proposta", () => {
  it("propor_movimentacao cria uma proposta e não grava na carteira", async () => {
    const { client, created } = fakeSupabase();
    const collected = { actionIds: [] as string[] };
    const tools = buildTools(client as never, collected);
    const result = await run(tools.propor_movimentacao, {
      instrumentId, transactionType: "aporte", quantity: "500", unitPrice: "1.00", fees: "0", cashAmount: "0",
    });
    expect(result).toMatchObject({ ok: true });
    expect(collected.actionIds).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(created[0]?.kind).toBe("record_transaction");
    expect(JSON.stringify(created[0]?.payload)).toContain("Nubank › Caixinhas");
  });

  it("recusa data futura e valor inválido sem criar proposta", async () => {
    const { client, created } = fakeSupabase();
    const collected = { actionIds: [] as string[] };
    const tools = buildTools(client as never, collected);
    expect(await run(tools.propor_movimentacao, {
      instrumentId, transactionType: "aporte", quantity: "500", unitPrice: "1.00", fees: "0", cashAmount: "0",
      tradeDate: "2099-01-01",
    })).toHaveProperty("erro");
    expect(await run(tools.propor_movimentacao, {
      instrumentId, transactionType: "aporte", quantity: "abc", unitPrice: "1.00", fees: "0", cashAmount: "0",
    })).toHaveProperty("erro");
    expect(created).toHaveLength(0);
    expect(collected.actionIds).toHaveLength(0);
  });

  it("propor_novo_ativo normaliza o símbolo e cria a proposta", async () => {
    const { client, created } = fakeSupabase();
    const tools = buildTools(client as never, { actionIds: [] });
    await run(tools.propor_novo_ativo, {
      institutionName: "Nubank", name: "Caixinhas", symbol: "caixinhas",
      assetClass: "renda_fixa", quantity: "500,00", unitPrice: "1,00", fees: "0",
    });
    expect(created[0]?.kind).toBe("create_asset");
    expect(JSON.stringify(created[0]?.payload)).toContain("CAIXINHAS");
  });
});
