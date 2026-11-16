import { describe, expect, it, vi } from "vitest";
import { buildTesouroIndicators, fetchTesouroSnapshot, parseTesouroLine } from "@/features/market/tesouro";

const HEADER = "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha";
const lines = [
  "Tesouro Selic;01/03/2027;13/11/2026;0,03;0,04;20302,53;20291,56;20291,56",
  "Tesouro Selic;01/03/2031;13/11/2026;0,11;0,12;20211,26;20192,26;20192,26",
  "Tesouro Prefixado;01/01/2029;13/11/2026;14,85;14,97;746,95;744,90;744,90",
  "Tesouro Prefixado;01/01/2031;13/11/2026;15,21;15,33;559,99;557,29;557,29",
  "Tesouro IPCA+;15/08/2030;13/11/2026;8,20;8,30;2100,10;2090,00;2090,00",
  "Tesouro IPCA+ com Juros Semestrais;15/05/2035;13/11/2026;8,00;8,10;4000,00;3990,00;3990,00",
  "Tesouro Selic;01/03/2031;12/11/2026;0,10;0,11;20100,00;20090,00;20090,00",
];

function csvResponse(body: string) {
  return new Response(body, { status: 200, headers: { "content-type": "text/csv" } });
}

describe("Tesouro Transparente", () => {
  it("interpreta uma linha do arquivo oficial", () => {
    expect(parseTesouroLine(lines[3]!)).toEqual({
      type: "Tesouro Prefixado", maturity: "2031-01-01", base: "2026-11-13", rateBuy: 15.21, puBuy: 559.99,
    });
  });

  it("escolhe o vencimento mais próximo de 5 anos para cada tipo", () => {
    const indicators = buildTesouroIndicators(lines.map(parseTesouroLine), new Date("2026-11-16T12:00:00Z"));
    expect(indicators.map((item) => [item.code, item.value, item.observedOn])).toEqual([
      ["tesouro_selic_preco", 20211.26, "2026-11-13"],
      ["tesouro_prefixado_taxa", 15.21, "2026-11-13"],
      ["tesouro_ipca_taxa", 8.2, "2026-11-13"],
    ]);
    expect(indicators[1]?.label).toBe("Tesouro Prefixado 2031 · taxa");
  });

  it("lê só o dia mais recente e ignora o resto do arquivo", async () => {
    const fetcher = vi.fn().mockResolvedValue(csvResponse([HEADER, ...lines].join("\n")));
    const indicators = await fetchTesouroSnapshot({ fetcher, now: new Date("2026-11-16T12:00:00Z") });
    expect(indicators.every((item) => item.observedOn === "2026-11-13")).toBe(true);
    expect(indicators).toHaveLength(3);
  });

  it("recusa arquivo com cabeçalho diferente", async () => {
    const fetcher = vi.fn().mockResolvedValue(csvResponse("a;b;c\n1;2;3"));
    await expect(fetchTesouroSnapshot({ fetcher })).rejects.toThrow("tesouro_invalid_payload");
  });

  it("recusa data no futuro e valor fora do intervalo", () => {
    expect(() => buildTesouroIndicators([parseTesouroLine("Tesouro Selic;01/03/2031;13/11/2030;0,1;0,1;20000,0;20000,0;1")], new Date("2026-11-16T12:00:00Z")))
      .toThrow("tesouro_invalid_date");
    expect(() => buildTesouroIndicators([parseTesouroLine("Tesouro Prefixado;01/01/2031;13/11/2026;99,0;99,0;1,0;1,0;1")], new Date("2026-11-16T12:00:00Z")))
      .toThrow("tesouro_value_out_of_range");
  });

  it("falha quando o serviço está indisponível", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("erro", { status: 503 }));
    await expect(fetchTesouroSnapshot({ fetcher })).rejects.toThrow("tesouro_unavailable");
  });
});
