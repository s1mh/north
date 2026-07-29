export type ContributionFrequency = "once" | "monthly";

export type ProjectionInput = {
  contributionAmount: string | number;
  frequency: ContributionFrequency;
  horizonMonths: number;
  annualReturnRate: number;
  annualInflationRate: number;
  annualFeeRate: number;
};

export function investmentMoneyToCents(value: string | number) {
  const normalized = String(value).trim().replace(",", ".");
  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

function roundedCents(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("projection outside supported range");
  }
  return BigInt(Math.round(value));
}

export function monthsUntilDate(targetDate: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new RangeError("invalid date");
  }
  const [targetYear, targetMonth] = targetDate.split("-").map(Number);
  const [currentYear, currentMonth] = today.split("-").map(Number);
  const difference = (targetYear! - currentYear!) * 12 + targetMonth! - currentMonth!;
  return Math.max(1, difference);
}

export function deriveProjection(input: ProjectionInput) {
  const amountCents = investmentMoneyToCents(input.contributionAmount);
  const {
    frequency,
    horizonMonths,
    annualReturnRate,
    annualInflationRate,
    annualFeeRate,
  } = input;

  if (
    amountCents <= 0n
    || !Number.isInteger(horizonMonths)
    || horizonMonths < 1
    || horizonMonths > 600
    || annualReturnRate < 0
    || annualReturnRate > 30
    || annualInflationRate < 0
    || annualInflationRate > 20
    || annualFeeRate < 0
    || annualFeeRate > 10
    || annualFeeRate > annualReturnRate
  ) {
    throw new RangeError("invalid projection assumptions");
  }

  const annualNetRate = (annualReturnRate - annualFeeRate) / 100;
  const monthlyRate = Math.pow(1 + annualNetRate, 1 / 12) - 1;
  const amount = Number(amountCents);
  const growth = Math.pow(1 + monthlyRate, horizonMonths);
  const nominal = frequency === "once"
    ? amount * growth
    : monthlyRate === 0
      ? amount * horizonMonths
      : amount * ((growth - 1) / monthlyRate);
  const inflationFactor = Math.pow(1 + annualInflationRate / 100, horizonMonths / 12);
  const contributedCents = frequency === "once"
    ? amountCents
    : amountCents * BigInt(horizonMonths);

  return {
    contributedCents,
    projectedNominalCents: roundedCents(nominal),
    projectedRealCents: roundedCents(nominal / inflationFactor),
    annualNetRate,
  };
}

export function allocationAmounts(
  contributionAmount: string | number,
  allocation: Readonly<Record<string, number>>,
) {
  const amountCents = investmentMoneyToCents(contributionAmount);
  const entries = Object.entries(allocation);
  if (
    entries.length === 0
    || entries.some(([, value]) => !Number.isInteger(value) || value < 0 || value > 100)
    || entries.reduce((total, [, value]) => total + value, 0) !== 100
  ) {
    throw new RangeError("allocation must total 100");
  }

  let allocatedCents = 0n;
  return entries.map(([label, percentage], index) => {
    const cents = index === entries.length - 1
      ? amountCents - allocatedCents
      : (amountCents * BigInt(percentage)) / 100n;
    allocatedCents += cents;
    return { label, percentage, cents };
  });
}
