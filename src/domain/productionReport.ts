import type { CalculatedProduction, Sale } from "./models";
import { remainingPackages } from "./calculations";
import { balance, summarizeSales } from "./overview";

export type ProductionStatus = "no-packages" | "waiting" | "selling" | "closed";

const ratio = (part: number, total: number) => (total > 0 ? part / total : 0);

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
  };
}

export type ProductionReport = ReturnType<typeof buildProductionReport>;
