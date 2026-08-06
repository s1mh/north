export function formatBrazilianMoneyInput(value: string) {
  const sanitized = value.replace(/[^\d,.]/g, "");
  if (!sanitized) return "";

  const commaIndex = sanitized.indexOf(",");
  const hasComma = commaIndex >= 0;
  const lastDotIndex = sanitized.lastIndexOf(".");
  const dotLooksDecimal = !hasComma
    && lastDotIndex >= 0
    && sanitized.length - lastDotIndex - 1 <= 2
    && sanitized.length - lastDotIndex - 1 > 0;
  const separatorIndex = hasComma ? commaIndex : dotLooksDecimal ? lastDotIndex : -1;
  const wholeDigits = (separatorIndex >= 0 ? sanitized.slice(0, separatorIndex) : sanitized)
    .replace(/\D/g, "")
    .slice(0, 15);
  const fractionDigits = separatorIndex >= 0
    ? sanitized.slice(separatorIndex + 1).replace(/\D/g, "").slice(0, 2)
    : "";
  const groupedWhole = (wholeDigits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (separatorIndex >= 0) return `R$ ${groupedWhole},${fractionDigits}`;
  return `R$ ${groupedWhole}`;
}

export function completeBrazilianMoneyInput(value: string) {
  const formatted = formatBrazilianMoneyInput(value);
  if (!formatted) return "";
  if (!formatted.includes(",")) return `${formatted},00`;
  const [whole, fraction = ""] = formatted.split(",");
  return `${whole},${fraction.padEnd(2, "0")}`;
}

export function brazilianMoneySubmissionValue(value: string) {
  return completeBrazilianMoneyInput(value).replace(/^R\$\s*/, "");
}
