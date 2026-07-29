type GoalProgressInput = {
  targetAmount: string | number;
  targetDate: string;
  contributions: Array<string | number>;
  plannedMonthlyAmount?: string | number | null;
  today?: string;
};

type ContributionPlan = {
  amount: string | number;
  status: string;
};

export function getActiveContributionPlan(
  relation: ContributionPlan | ContributionPlan[] | null,
) {
  if (!relation) return undefined;
  if (Array.isArray(relation)) {
    return relation.find((item) => item.status === "active");
  }
  return relation.status === "active" ? relation : undefined;
}

export function goalMoneyToCents(value: string | number) {
  const normalized = String(value).trim().replace(",", ".");
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole || "0") * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

function monthDistance(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return Math.max(1, (toYear! - fromYear!) * 12 + toMonth! - fromMonth!);
}

function ceilDivide(value: bigint, divisor: bigint) {
  if (value <= 0n) return 0n;
  return (value + divisor - 1n) / divisor;
}

export function deriveGoalProgress({
  targetAmount,
  targetDate,
  contributions,
  plannedMonthlyAmount = null,
  today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date()),
}: GoalProgressInput) {
  const targetCents = goalMoneyToCents(targetAmount);
  const contributedCents = contributions.reduce(
    (total, amount) => total + goalMoneyToCents(amount),
    0n,
  );
  const remainingCents = contributedCents >= targetCents ? 0n : targetCents - contributedCents;
  const monthsRemaining = monthDistance(today, targetDate);
  const requiredMonthlyCents = ceilDivide(remainingCents, BigInt(monthsRemaining));
  const plannedMonthlyCents = plannedMonthlyAmount === null
    ? 0n
    : goalMoneyToCents(plannedMonthlyAmount);
  const percentageTenths = targetCents === 0n
    ? 0
    : Number((contributedCents * 1000n) / targetCents);

  return {
    targetCents,
    contributedCents,
    remainingCents,
    monthsRemaining,
    requiredMonthlyCents,
    plannedMonthlyCents,
    monthlyGapCents: requiredMonthlyCents > plannedMonthlyCents
      ? requiredMonthlyCents - plannedMonthlyCents
      : 0n,
    percentage: Math.min(100, percentageTenths / 10),
    completed: contributedCents >= targetCents,
  };
}
