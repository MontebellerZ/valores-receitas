import type { CalculatedProduction, Sale } from "./models";
import { remainingPackages } from "./calculations";
import { balance, summarizeSales } from "./overview";

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

export type ProductionDay = {
  date: string;
  sold: number;
  donated: number;
  total: number;
  revenue: number;
  /** Resultado acumulado ao fim do dia: faturamento acumulado menos o custo da produção. */
  result: number;
};

/**
 * Saídas e resultado por dia, da data de produção até a última venda. Períodos longos
 * mantêm apenas os dias com movimento para que os gráficos continuem legíveis.
 */
export function buildDailyTimeline(production: CalculatedProduction, linkedSales: Sale[]): ProductionDay[] {
  const byDate = new Map<string, Omit<ProductionDay, "date" | "result">>();
  for (const sale of linkedSales) {
    if (!sale.date) continue;
    const entry = byDate.get(sale.date) ?? { sold: 0, donated: 0, total: 0, revenue: 0 };
    if (sale.donated) entry.donated += sale.packages;
    else entry.sold += sale.packages;
    entry.total += sale.packages;
    entry.revenue += sale.packages * sale.pricePerPackage;
    byDate.set(sale.date, entry);
  }
  const saleDates = [...byDate.keys()].sort();
  if (!saleDates.length) return [];
  const first = production.date && production.date < saleDates[0] ? production.date : saleDates[0];
  const last = saleDates[saleDates.length - 1];
  const span = Math.round((toUtc(last) - toUtc(first)) / DAY) + 1;
  const dates = span <= MAX_CONTINUOUS_DAYS
    ? Array.from({ length: span }, (_, index) => fromUtc(toUtc(first) + index * DAY))
    : [...new Set([first, ...saleDates])];
  let revenue = 0;
  return dates.map((date) => {
    const entry = byDate.get(date) ?? { sold: 0, donated: 0, total: 0, revenue: 0 };
    revenue += entry.revenue;
    return { date, ...entry, result: balance(revenue, production.cost) };
  });
}

export function buildProductionReport(production: CalculatedProduction, sales: Sale[]) {
  const linkedSales = sales.filter((sale) => sale.productionId === production.id);
  const totals = summarizeSales(linkedSales);
  const donatedPackages = linkedSales
    .filter((sale) => sale.donated)
    .reduce((total, sale) => total + sale.packages, 0);
  const soldPackages = totals.packages - donatedPackages;
  const lostPackages = Math.min(production.lostPackages ?? 0, production.packages);
  const availablePackages = remainingPackages(production, totals.packages);
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
        : totals.packages === 0 ? "waiting" : "selling";

  return {
    linkedSales,
    salesCount: linkedSales.length,
    revenue: totals.revenue,
    received: totals.received,
    pending: totals.pending,
    soldCost: totals.cost,
    giveawayCost: (donatedPackages + lostPackages) * production.costPerPackage,
    missedRevenue: (donatedPackages + lostPackages) * price,
    soldPackages,
    donatedPackages,
    lostPackages,
    availablePackages,
    outPackages: totals.packages,
    soldShare: ratio(totals.packages, production.packages),
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
    daily: buildDailyTimeline(production, linkedSales),
  };
}

export type ProductionReport = ReturnType<typeof buildProductionReport>;
