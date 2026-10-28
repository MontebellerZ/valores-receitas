import type {
  CalculatedProduction,
  Production,
  Recipe,
} from "./models";

export type LegacyMarketItemCost = { id: string; packageQty?: number; packagePrice?: number };

// Only used to recover costs from local backups created before stock lots existed.
export const unitCost = (item: LegacyMarketItemCost) =>
  item.packageQty && item.packageQty > 0 ? (item.packagePrice ?? 0) / item.packageQty : 0;

export function recipeCostPerBatch(recipe: Recipe, market: LegacyMarketItemCost[]) {
  return recipe.ingredients.reduce((total, ingredient) => {
    const item = market.find((entry) => entry.id === ingredient.marketItemId);
    return total + (item ? unitCost(item) * ingredient.quantity : 0);
  }, 0);
}

/** Pacotes que ainda podem ser vendidos, descontando os perdidos e os já vendidos. */
export const remainingPackages = (
  production: { packages: number; lostPackages?: number },
  sold = 0,
) => Math.max(0, production.packages - (production.lostPackages ?? 0) - sold);

export function calculateProduction(
  production: Production,
): CalculatedProduction {
  const cost = production.totalCost ?? production.ingredientCostPerBatch * production.quantity;
  const produced = production.quantity > 0 ? Math.max(0, production.actualYield - production.losses) : 0;
  const packages =
    production.packageQty > 0
      ? Math.floor(produced / production.packageQty)
      : 0;
  const costPerPackage = packages > 0 ? cost / packages : 0;
  const markupPercent = Math.max(production.margin, 0);
  const salePrice =
    costPerPackage > 0 ? costPerPackage * (1 + markupPercent / 100) : 0;
  const revenue = salePrice * remainingPackages({ packages, lostPackages: production.lostPackages });
  const profit = revenue - cost;
  return {
    ...production,
    cost,
    produced,
    packages,
    costPerPackage,
    salePrice,
    revenue,
    profit,
  };
}
