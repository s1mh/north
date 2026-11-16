"use client";

import { useMemo, useRef, useState } from "react";
import { track } from "@/features/analytics/track";
import { deriveProjection } from "@/features/investment/calculation";

const brl = (cents: bigint) => (Number(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PublicSimulator() {
  const [amount, setAmount] = useState(300);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(10);
  const [inflation, setInflation] = useState(4.5);
  const reported = useRef(false);
  const used = () => { if (!reported.current) { reported.current = true; track("simulator_used"); } };

  const result = useMemo(() => {
    try {
      return deriveProjection({ contributionAmount: String(amount), frequency: "monthly", horizonMonths: years * 12, annualReturnRate: rate, annualInflationRate: inflation, annualFeeRate: 0 });
    } catch { return null; }
  }, [amount, years, rate, inflation]);

  const invested = result?.contributedCents ?? 0n;
  const gain = result ? result.projectedNominalCents - invested : 0n;

  return <div className="sim">
    <div className="sim-controls">
      <label>Quanto você guarda por mês<output>{amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</output>
        <input type="range" min={50} max={5000} step={50} value={amount} onChange={(e) => { used(); setAmount(Number(e.target.value)); }} /></label>
      <label>Por quanto tempo<output>{years} {years === 1 ? "ano" : "anos"}</output>
        <input type="range" min={1} max={30} step={1} value={years} onChange={(e) => { used(); setYears(Number(e.target.value)); }} /></label>
      <label>Rentabilidade que você quer testar, ao ano<output>{rate.toLocaleString("pt-BR")}%</output>
        <input type="range" min={0} max={20} step={0.5} value={rate} onChange={(e) => { used(); setRate(Number(e.target.value)); }} /></label>
      <label>Inflação ao ano<output>{inflation.toLocaleString("pt-BR")}%</output>
        <input type="range" min={0} max={12} step={0.5} value={inflation} onChange={(e) => { used(); setInflation(Number(e.target.value)); }} /></label>
      <p className="sim-hint">Esses números são exemplos que você pode mudar. Ninguém sabe a rentabilidade futura: teste cenários melhores e piores.</p>
    </div>
    <div className="sim-result" aria-live="polite">
      <small>Com essas premissas, você teria</small>
      <strong>{result ? brl(result.projectedNominalCents) : "—"}</strong>
      <dl>
        <div><dt>Você guardou</dt><dd>{brl(invested)}</dd></div>
        <div><dt>Rendimento da simulação</dt><dd>{result ? brl(gain) : "—"}</dd></div>
        <div><dt>Em poder de compra de hoje</dt><dd>{result ? brl(result.projectedRealCents) : "—"}</dd></div>
      </dl>
    </div>
  </div>;
}
