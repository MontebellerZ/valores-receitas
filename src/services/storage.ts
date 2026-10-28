import type {
  MarketItem,
  Recipe,
  Production,
  Sale,
  WorkspaceData,
} from "../domain/models";
import { recipeCostPerBatch, type LegacyMarketItemCost } from "../domain/calculations";
import { makeId, localToday } from "../utils/format";

export const STORAGE_KEY = "doce-controle-v1";

export function writeSavedData(key: string, data: WorkspaceData) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function hasLegacyMigration() {
  return localStorage.getItem(`${STORAGE_KEY}:legacy-migrated`) === "true";
}

export function markLegacyMigrated() {
  localStorage.setItem(`${STORAGE_KEY}:legacy-migrated`, "true");
}

export function readSavedData(key = STORAGE_KEY): {
  market: MarketItem[];
  recipes: Recipe[];
  productions: Production[];
  sales: Sale[];
} {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved) as {
        market?: Array<MarketItem & LegacyMarketItemCost>;
        recipes?: Array<
          Recipe &
            Partial<{
              quantity: number;
              losses: number;
              margin: number;
              packageQty: number;
            }>
        >;
        productions?: Production[];
        sales?: Sale[];
      };
      if (Array.isArray(parsed.market) && Array.isArray(parsed.recipes)) {
        const legacyMarket = parsed.market;
        const market: MarketItem[] = legacyMarket.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          hasStockHistory: item.hasStockHistory,
        }));
        const recipes: Recipe[] = parsed.recipes.map((recipe) => ({
          id: recipe.id,
          name: recipe.name ?? "",
          category: recipe.category ?? "",
          yield: Number(recipe.yield) || 0,
          hoursPerBatch: Number(recipe.hoursPerBatch) || 0,
          shelfLifeDays:
            Number.isInteger(recipe.shelfLifeDays) && recipe.shelfLifeDays! >= 0
              ? recipe.shelfLifeDays
              : null,
          ingredients: Array.isArray(recipe.ingredients)
            ? recipe.ingredients
            : [],
        }));
        const productions: Production[] = Array.isArray(parsed.productions)
          ? parsed.productions.map((production) => ({
              ...production,
              lostPackages:
                Number.isInteger(production.lostPackages) && production.lostPackages! > 0
                  ? production.lostPackages
                  : 0,
              actualYield: Number.isFinite(production.actualYield)
                ? production.actualYield
                : (Number(production.yieldPerBatch) || 0) *
                  (Number(production.quantity) || 0),
              expectedSalePrice:
                typeof production.expectedSalePrice === "number" &&
                Number.isFinite(production.expectedSalePrice) &&
                production.expectedSalePrice >= 0
                  ? production.expectedSalePrice
                  : undefined,
            }))
          : parsed.recipes.flatMap((oldRecipe) => {
              if (!("quantity" in oldRecipe) || !Number(oldRecipe.quantity))
                return [];
              const recipe = recipes.find((entry) => entry.id === oldRecipe.id);
              if (!recipe) return [];
              return [
                {
                  id: makeId(),
                  date: localToday(),
                  recipeId: recipe.id,
                  recipeName: recipe.name,
                  quantity: Number(oldRecipe.quantity) || 0,
                  actualYield: recipe.yield * (Number(oldRecipe.quantity) || 0),
                  losses: Number(oldRecipe.losses) || 0,
                  margin: Number(oldRecipe.margin) || 0,
                  packageQty: Number(oldRecipe.packageQty) || 1,
                  yieldPerBatch: recipe.yield,
                  ingredientCostPerBatch: recipeCostPerBatch(recipe, legacyMarket),
                },
              ];
            });
        const sales = Array.isArray(parsed.sales)
          ? parsed.sales
              .filter(
                (sale) =>
                  sale &&
                  typeof sale.id === "string" &&
                  typeof sale.productionId === "string" &&
                  typeof sale.recipeName === "string" &&
                  typeof sale.date === "string" &&
                  /^\d{4}-\d{2}-\d{2}$/.test(sale.date) &&
                  Number.isFinite(
                    new Date(`${sale.date}T12:00:00`).getTime(),
                  ) &&
                  Number.isInteger(sale.packages) &&
                  sale.packages > 0 &&
                  Number.isFinite(sale.pricePerPackage) &&
                  sale.pricePerPackage >= 0 &&
                  Number.isFinite(sale.costPerPackage) &&
                  sale.costPerPackage >= 0,
              )
              .map((sale) => ({
                ...sale,
                customer: sale.customer ?? "",
                notes: sale.notes ?? "",
                paid: sale.paid === true,
                donated: sale.donated === true,
                productionDate: sale.productionDate ?? "",
              }))
          : [];
        return { market, recipes, productions, sales };
      }
    }
  } catch {
    // Dados inválidos são ignorados; sem dados salvos, a aplicação inicia vazia.
  }
  return { market: [], recipes: [], productions: [], sales: [] };
}

export function hasSavedData(data: {
  market: MarketItem[];
  recipes: Recipe[];
  productions: Production[];
  sales: Sale[];
}) {
  return (
    data.market.length +
      data.recipes.length +
      data.productions.length +
      data.sales.length >
    0
  );
}
