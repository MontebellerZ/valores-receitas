import type { CalculatedProduction, ProductionDayRow, ProductionSalesTotals } from "./models";
import { remainingPackages } from "./calculations";
import { balance } from "./overview";

export type ProductionStatus = "no-packages" | "waiting" | "selling" | "closed";

const ratio = (part: number, total: number) => (total > 0 ? part / total : 0);

const MAX_CONTINUOUS_DAYS = 62;

const toUtc = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};
const fromUtc = (time: number) => new Date(time).toISOString().slice(0, 10);
const DAY = 86_400_000;

/** Data de vencimento (ISO) a partir da data de produção e da validade em dias. */
export function expirationDate(date: string, shelfLifeDays?: number | null) {
  if (!date || shelfLifeDays == null || !Number.isFinite(shelfLifeDays) || shelfLifeDays < 0) return null;
  return fromUtc(toUtc(date) + Math.round(shelfLifeDays) * DAY);
}

export type ProductionDay = ProductionDayRow;

/**
 * Completa os dias sem movimento entre as linhas de uma página do relatório diário quando o
 * intervalo é curto; períodos longos mantêm apenas os dias com movimento para que os gráficos
 * continuem legíveis. O resultado acumulado de um dia vazio repete o do dia anterior.
 */
export function fillDailyGaps(rows: ProductionDayRow[]): ProductionDay[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return sorted;
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const span = Math.round((toUtc(last) - toUtc(first)) / DAY) + 1;
  if (span > MAX_CONTINUOUS_DAYS) return sorted;
  const byDate = new Map(sorted.map((row) => [row.date, row]));
  let previous = sorted[0];
  return Array.from({ length: span }, (_, index) => {
    const date = fromUtc(toUtc(first) + index * DAY);
    const row = byDate.get(date) ?? { date, sold: 0, donated: 0, total: 0, revenue: 0, cumulativeRevenue: previous.cumulativeRevenue };
    previous = row;
    return row;
  });
}

export function buildProductionReport(production: CalculatedProduction, totals: ProductionSalesTotals) {
  const { donatedPackages, salesCount } = totals;
  const soldPackages = totals.outPackages - donatedPackages;
  const lostPackages = Math.min(production.lostPackages ?? 0, production.packages);
  const availablePackages = remainingPackages(production, totals.outPackages);
  const expectedYield = production.yieldPerBatch * production.quantity;
  const leftoverUnits = Math.max(0, production.produced - production.packages * production.packageQty);
  const price = production.expectedSalePrice ?? production.salePrice;
  const result = balance(totals.revenue, production.cost);
  const projectedRevenue = totals.revenue + availablePackages * price;
  const projectedResult = balance(projectedRevenue, production.cost);
  const expectedRevenue = production.packages * price;
  const expectedProfit = balance(expectedRevenue, production.cost);
  const status: ProductionStatus =
    production.packages === 0 ? "no-packages"
      : availablePackages === 0 ? "closed"
        : totals.outPackages === 0 ? "waiting" : "selling";

  return {
    salesCount,
    firstSaleDate: totals.firstSaleDate,
    revenue: totals.revenue,
    received: totals.received,
    pending: totals.pending,
    soldCost: totals.soldCost,
    giveawayCost: (donatedPackages + lostPackages) * production.costPerPackage,
    missedRevenue: (donatedPackages + lostPackages) * price,
    soldPackages,
    donatedPackages,
    lostPackages,
    availablePackages,
    outPackages: totals.outPackages,
    soldShare: ratio(totals.outPackages, production.packages),
    expectedYield,
    yieldEfficiency: ratio(production.actualYield, expectedYield),
    lossRate: ratio(production.losses, production.actualYield),
    leftoverUnits,
    averagePrice: soldPackages > 0 ? totals.revenue / soldPackages : 0,
    costRecovery: ratio(totals.revenue, production.cost),
    result,
    margin: ratio(result, totals.revenue),
    price,
    expectedRevenue,
    expectedProfit,
    revenueGap: balance(totals.revenue, expectedRevenue),
    profitGap: balance(result, expectedProfit),
    projectedRevenue,
    projectedResult,
    status,
  };
}

export type ProductionReport = ReturnType<typeof buildProductionReport>;