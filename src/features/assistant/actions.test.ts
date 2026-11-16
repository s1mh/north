import { describe, expect, it } from "vitest";
import { describeAction, payloadSchemas } from "./actions";

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
