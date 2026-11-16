/** Ganho = valor atual − custo, em centavos; percentual com uma casa (null sem custo). */
export function gainFromCents(costCents: bigint, valueCents: bigint) {
  const gainCents = valueCents - costCents;
  const percent = costCents > 0n
    ? Number((gainCents * 10_000n) / costCents) / 100
    : null;
  return { gainCents, percent };
}

/** Quantidade de "cotas" que um valor em reais compra ao preço atual (8 casas, como o livro). */
export function quantityForAmount(amount: string, price: string | number) {
  const amountNumber = Number(amount.replace(",", "."));
  const priceNumber = Number(price);
  if (!Number.isFinite(amountNumber) || !Number.isFinite(priceNumber) || amountNumber <= 0 || priceNumber <= 0) {
    return null;
  }
  return (amountNumber / priceNumber).toFixed(8);
}

export function daysBetween(fromIso: string, to: Date = new Date()) {
  const from = new Date(`${fromIso}T12:00:00-03:00`).getTime();
  return Math.max(0, Math.floor((to.getTime() - from) / 86_400_000));
}
