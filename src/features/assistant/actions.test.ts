import { describe, expect, it } from "vitest";
import { canUndo, describeAction, payloadSchemas } from "./actions";

const instrumentId = "5d1c1a4e-5c53-4c8e-9a0e-5a1d3f6a2b10";
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

describe("describeAction", () => {
  it("mostra um aporte de caixinha com valor, ativo e data", () => {
    const payload = {
      data: {
        instrumentId, transactionType: "aporte", quantity: "500", unitPrice: "1.00",
        fees: "0", cashAmount: "0", tradeDate: today,
      },
      instrumentLabel: "Nubank › Caixinhas",
    };
    expect(payloadSchemas.record_transaction.safeParse(payload).success).toBe(true);
    const view = describeAction("record_transaction", payload);
    expect(view?.title).toBe("Registrar aporte");
    expect(view?.rows.find((row) => row.label === "Ativo")?.value).toBe("Nubank › Caixinhas");
    expect(view?.rows.find((row) => row.label === "Valor")?.value).toMatch(/500,00/);
    expect(view?.rows.find((row) => row.label === "Taxas")).toBeUndefined();
  });

  it("usa o valor em dinheiro para rendimento", () => {
    const view = describeAction("record_transaction", {
      data: {
        instrumentId, transactionType: "rendimento", quantity: "0", unitPrice: "0",
        fees: "0", cashAmount: "12.34", tradeDate: today,
      },
      instrumentLabel: "Nubank › Caixinhas",
    });
    expect(view?.title).toBe("Registrar rendimento");
    expect(view?.rows.find((row) => row.label === "Valor")?.value).toMatch(/12,34/);
  });

  it("descreve a criação de um ativo com o total", () => {
    const view = describeAction("create_asset", {
      data: {
        institutionName: "Nubank", symbol: "CAIXINHAS", name: "Caixinhas",
        assetClass: "renda_fixa", quantity: "500", unitPrice: "1.00", fees: "0", tradeDate: today,
      },
    });
    expect(view?.rows.find((row) => row.label === "Classe")?.value).toBe("Renda fixa");
    expect(view?.rows.find((row) => row.label === "Valor")?.value).toMatch(/500,00/);
  });

  it("recusa payload fora do formato (dados que a IA não pode inventar)", () => {
    expect(describeAction("record_transaction", { data: { instrumentId: "x" } })).toBeNull();
    expect(payloadSchemas.record_transaction.safeParse({
      data: {
        instrumentId, transactionType: "aporte", quantity: "500", unitPrice: "1.00",
        fees: "0", cashAmount: "0", tradeDate: "2099-01-01",
      },
      instrumentLabel: "x",
    }).success).toBe(false);
  });
});

describe("fase 4: estorno e meta", () => {
  const txId = "5d1c1a4e-5c53-4c8e-9a0e-5a1d3f6a2b10";

  it("descreve o estorno de um lançamento", () => {
    const view = describeAction("reverse_transaction", {
      data: { transactionId: txId, reason: "valor digitado errado" },
      label: "aporte de R$ 500,00 em Caixinhas (16/11/2026)",
    });
    expect(view?.title).toBe("Estornar lançamento");
    expect(view?.rows.find((row) => row.label === "Motivo")?.value).toBe("valor digitado errado");
  });

  it("descreve a criação de meta com valor, data e aporte mensal", () => {
    const view = describeAction("create_goal", {
      data: { name: "Viagem", kind: "viagem", targetAmount: "10000.00", targetDate: "2099-12-01", plannedMonthlyAmount: "500" },
    });
    expect(view?.title).toBe("Criar meta");
    expect(view?.rows.find((row) => row.label === "Valor alvo")?.value).toMatch(/10\.000,00/);
    expect(view?.rows.find((row) => row.label === "Aporte mensal")?.value).toMatch(/500,00/);
  });

  it("recusa meta com data passada e estorno sem motivo", () => {
    expect(describeAction("create_goal", {
      data: { name: "Viagem", kind: "viagem", targetAmount: "10000", targetDate: "2020-01-01", plannedMonthlyAmount: "0" },
    })).toBeNull();
    expect(describeAction("reverse_transaction", { data: { transactionId: txId, reason: "" }, label: "x" })).toBeNull();
  });

  it("só registros simples têm Desfazer", () => {
    expect(canUndo("record_transaction")).toBe(true);
    expect(canUndo("create_asset")).toBe(true);
    expect(canUndo("goal_contribution")).toBe(true);
    expect(canUndo("reverse_transaction")).toBe(false);
    expect(canUndo("create_goal")).toBe(false);
  });
});
