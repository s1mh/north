export type PortfolioTransaction = {
  transaction_type: "compra" | "venda" | "aporte" | "resgate" | "rendimento" | "taxa" | "ajuste";
  quantity: string | number;
  unit_price: string | number;
  fees: string | number;
};

const QUANTITY_SCALE = 8;
const PRICE_SCALE = 6;

function parseFixed(value: string | number, scale: number) {
  const normalized = String(value).trim().replace(",", ".");
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  const padded = `${fraction}${"0".repeat(scale)}`.slice(0, scale);
  const result = BigInt(whole || "0") * 10n ** BigInt(scale) + BigInt(padded || "0");
  return negative ? -result : result;
}

function roundDivide(numerator: bigint, denominator: bigint) {
  if (denominator === 0n) return 0n;
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  return sign * ((absolute + denominator / 2n) / denominator);
}

function marketValueCents(quantity: bigint, price: bigint) {
  return roundDivide(quantity * price * 100n, 10n ** BigInt(QUANTITY_SCALE + PRICE_SCALE));
}

export function derivePosition(
  transactions: PortfolioTransaction[],
  latestPrice: string | number | null,
) {
  let quantity = 0n;
  let costBasisCents = 0n;

  for (const transaction of transactions) {
    const transactionQuantity = parseFixed(transaction.quantity, QUANTITY_SCALE);
    const unitPrice = parseFixed(transaction.unit_price, PRICE_SCALE);
    const feesCents = parseFixed(transaction.fees, 2);

    if (transaction.transaction_type === "compra" || transaction.transaction_type === "aporte") {
      quantity += transactionQuantity;
      costBasisCents += marketValueCents(transactionQuantity, unitPrice) + feesCents;
    } else if (transaction.transaction_type === "venda" || transaction.transaction_type === "resgate") {
      if (transactionQuantity > quantity) throw new Error("insufficient position");
      costBasisCents -= roundDivide(costBasisCents * transactionQuantity, quantity);
      quantity -= transactionQuantity;
    } else if (transaction.transaction_type === "ajuste") {
      if (transactionQuantity > 0n) {
        quantity += transactionQuantity;
        costBasisCents += marketValueCents(transactionQuantity, unitPrice);
      } else {
        const removed = -transactionQuantity;
        if (removed > quantity) throw new Error("insufficient position");
        costBasisCents -= roundDivide(costBasisCents * removed, quantity);
        quantity -= removed;
      }
    }
  }

  const currentValueCents = latestPrice === null
    ? null
    : marketValueCents(quantity, parseFixed(latestPrice, PRICE_SCALE));

  return { quantity, costBasisCents, currentValueCents };
}

export function formatMoneyFromCents(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const cents = (absolute % 100n).toString().padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "−" : ""}R$ ${grouped},${cents}`;
}

export function formatQuantity(value: bigint) {
  const divisor = 10n ** BigInt(QUANTITY_SCALE);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(QUANTITY_SCALE, "0").replace(/0+$/, "");
  return fraction ? `${whole},${fraction}` : whole.toString();
}
