import { isAxiosError } from "axios";
import type {
  MarketListItem,
  Page,
  PageSize,
  Production,
  ProductionBalance,
  ProductionDayRow,
  ProductionReportPage,
  ProductionSale,
  RecipeListItem,
  Ingredient,
  Sale,
  SalesReport,
  StockConsumption,
  StockLotItem,
  StockTotal,
  WorkspaceSummary,
} from "../domain/models";
import { PAGE_SIZES } from "../domain/models";
import { calculateProduction } from "../domain/calculations";
import { api } from "./http";

export type ParamValue = string | number | boolean | undefined;
export type PageRequest = {
  page: number;
  pageSize: PageSize;
  search?: string;
  sortBy?: string;
  descending?: boolean;
};
export type ListRequest = PageRequest & Record<string, ParamValue>;
export type DateRange = { from?: string; to?: string };

/** Raised when the API answers with a shape the screens cannot interpret. */
export class ApiContractError extends Error {
  constructor(message: string) {
    super(`Resposta inesperada da API: ${message}`);
    this.name = "ApiContractError";
  }
}

const MAX_LOOKUP_IDS = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireNumber = (value: unknown, context: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiContractError(`${context} deve ser numérico.`);
  return value;
};

function requireNumbers<K extends string>(source: unknown, keys: readonly K[], context: string): Record<K, number> {
  if (!isRecord(source)) throw new ApiContractError(`${context} ausente.`);
  return Object.fromEntries(keys.map((key) => [key, requireNumber(source[key], `${context}.${key}`)])) as Record<K, number>;
}

export function cleanParams(params: Record<string, ParamValue>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && !(typeof value === "string" && value.trim() === "")),
  ) as Record<string, string | number | boolean>;
}

export function assertPage<T>(data: unknown, context: string): Page<T> {
  if (!isRecord(data) || !Array.isArray(data.items))
    throw new ApiContractError(`${context} deve retornar uma página com items.`);
  const meta = requireNumbers(data, ["page", "pageSize", "totalCount", "totalPages"] as const, context);
  return { items: data.items as T[], ...meta };
}

export const isPageSize = (value: number): value is PageSize =>
  (PAGE_SIZES as readonly number[]).includes(value);

const normalizeProduction = (production: Production): Production => ({
  ...production,
  expectedSalePrice: production.expectedSalePrice ?? undefined,
  lostPackages: production.lostPackages ?? 0,
});

const mapPage = <T, R>(page: Page<T>, map: (item: T) => R): Page<R> => ({ ...page, items: page.items.map(map) });

async function list<T>(path: string, params: Record<string, ParamValue>, signal?: AbortSignal) {
  if (typeof params.pageSize === "number" && !isPageSize(params.pageSize))
    throw new Error("Tamanho de página inválido.");
  const { data } = await api.get<unknown>(path, { params: cleanParams(params), signal });
  return assertPage<T>(data, path);
}

/** Detail lookups resolve to null only for a 404; any other failure is propagated. */
async function detail<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const { data } = await api.get<T>(path, { signal });
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

function lookupIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length > MAX_LOOKUP_IDS) throw new Error(`Consulte no máximo ${MAX_LOOKUP_IDS} registros por vez.`);
  return unique;
}

export function toBalance(raw: unknown): ProductionBalance {
  if (!isRecord(raw) || !isRecord(raw.production)) throw new ApiContractError("saldo sem production.");
  const totals = requireNumbers(raw, ["soldPackages", "packages", "availablePackages"] as const, "saldo");
  const periodSales = requireNumbers(raw.periodSales, ["count", "packages", "revenue", "cost"] as const, "saldo.periodSales");
  const calculated = calculateProduction(normalizeProduction(raw.production as Production));
  return { ...calculated, packages: totals.packages, soldPackages: totals.soldPackages,
    availablePackages: totals.availablePackages, periodSales };
}

export function toSummary(raw: unknown): WorkspaceSummary {
  if (!isRecord(raw)) throw new ApiContractError("resumo ausente.");
  return {
    revision: requireNumber(raw.revision, "resumo.revision"),
    counts: requireNumbers(raw.counts, ["market", "recipes", "productions", "sales"] as const, "resumo.counts"),
    sales: requireNumbers(raw.sales, ["count", "packages", "revenue", "received", "pending", "pendingCount", "cost", "profit"] as const, "resumo.sales"),
    ...requireNumbers(raw, ["availablePackages", "productionCost", "producedPackages", "lostPackages"] as const, "resumo"),
    productions: requireNumbers(raw.productions, ["count", "soldPackages", "losses", "remainingRevenue", "remainingCost",
      "expectedRevenue", "referenceRevenue", "referenceProfit"] as const, "resumo.productions"),
  };
}

export function toReport(raw: unknown): ProductionReportPage {
  if (!isRecord(raw)) throw new ApiContractError("relatório ausente.");
  const totals = requireNumbers(raw, ["salesCount", "outPackages", "donatedPackages", "revenue", "received", "pending", "soldCost"] as const, "relatório");
  if (raw.firstSaleDate !== null && typeof raw.firstSaleDate !== "string")
    throw new ApiContractError("relatório.firstSaleDate deve ser data ou null.");
  const daily = assertPage<unknown>(raw.daily, "relatório.daily");
  if (!Array.isArray(raw.topBuyers) || raw.topBuyers.length > 5)
    throw new ApiContractError("relatório.topBuyers deve conter até cinco compradores.");
  const topBuyers = raw.topBuyers.map((buyer: unknown) => {
    if (!isRecord(buyer) || typeof buyer.customer !== "string")
      throw new ApiContractError("comprador do relatório sem nome.");
    return {
      customer: buyer.customer,
      ...requireNumbers(buyer, ["packages", "spent"] as const, "relatório.topBuyers"),
    };
  });
  return {
    ...totals,
    topBuyers,
    firstSaleDate: typeof raw.firstSaleDate === "string" && raw.firstSaleDate ? raw.firstSaleDate.slice(0, 10) : null,
    daily: mapPage(daily, (day) => {
      if (!isRecord(day) || typeof day.date !== "string") throw new ApiContractError("dia do relatório sem data.");
      return {
        date: day.date.slice(0, 10),
        ...requireNumbers(day, ["sold", "donated", "total", "revenue", "cumulativeRevenue"] as const, "relatório.daily"),
      } satisfies ProductionDayRow;
    }),
  };
}

export function toSalesReport(raw: unknown): SalesReport {
  if (!isRecord(raw)) throw new ApiContractError("relatório de vendas ausente.");
  const totals = requireNumbers(raw.totals, ["count", "packages", "donatedPackages", "pendingCount", "customers",
    "revenue", "received", "pending", "cost", "donationCost"] as const, "vendas.totals");
  if (!Array.isArray(raw.topProducts) || raw.topProducts.length > 5 ||
      !Array.isArray(raw.topBuyers) || raw.topBuyers.length > 5)
    throw new ApiContractError("rankings de vendas devem conter até cinco itens.");
  return {
    totals,
    daily: mapPage(assertPage<unknown>(raw.daily, "vendas.daily"), (day) => {
      if (!isRecord(day) || typeof day.date !== "string") throw new ApiContractError("dia de vendas sem data.");
      return { date: day.date.slice(0, 10), ...requireNumbers(day, ["packages", "revenue"] as const, "vendas.daily") };
    }),
    topProducts: raw.topProducts.map((item: unknown) => {
      if (!isRecord(item) || typeof item.name !== "string") throw new ApiContractError("produto sem nome.");
      return { name: item.name, ...requireNumbers(item, ["packages", "revenue", "cost"] as const, "vendas.produto") };
    }),
    topBuyers: raw.topBuyers.map((item: unknown) => {
      if (!isRecord(item) || typeof item.customer !== "string") throw new ApiContractError("cliente sem nome.");
      return { customer: item.customer, ...requireNumbers(item, ["packages", "spent"] as const, "vendas.cliente") };
    }),
  };
}

function toMarketItem(raw: MarketListItem): MarketListItem {
  return { ...raw, ingredientCount: requireNumber(raw.ingredientCount, "insumo.ingredientCount") };
}

function toRecipeItem(raw: RecipeListItem): RecipeListItem {
  return { ...raw, ingredients: [], ingredientCount: requireNumber(raw.ingredientCount, "receita.ingredientCount") };
}

function toStockLot(raw: StockLotItem): StockLotItem {
  if (typeof raw.purchaseMixedItems !== "boolean") throw new ApiContractError("lote.purchaseMixedItems deve ser booleano.");
  return { ...raw, purchaseLotCount: requireNumber(raw.purchaseLotCount, "lote.purchaseLotCount") };
}

export const queryService = {
  async salesReport(params: ListRequest, signal?: AbortSignal) {
    const { data } = await api.get<unknown>("/query/sales-report", { params: cleanParams(params), signal });
    return toSalesReport(data);
  },
  async summary(range: DateRange = {}, signal?: AbortSignal) {
    const { data } = await api.get<unknown>("/query/summary", { params: cleanParams(range), signal });
    return toSummary(data);
  },
  async market(params: ListRequest, signal?: AbortSignal) {
    return mapPage(await list<MarketListItem>("/query/market", params, signal), toMarketItem);
  },
  async marketByIds(ids: string[], signal?: AbortSignal) {
    const unique = lookupIds(ids);
    if (!unique.length) return [];
    const page = await list<MarketListItem>("/query/market", { page: 1, pageSize: 100, ids: unique.join(",") }, signal);
    return page.items.map(toMarketItem);
  },
  async marketItem(id: string, signal?: AbortSignal) {
    const item = await detail<MarketListItem>(`/query/market/${encodeURIComponent(id)}`, signal);
    return item && toMarketItem(item);
  },
  /** Lean list: ingredients come empty and only ingredientCount is informed. */
  async recipes(params: ListRequest, signal?: AbortSignal) {
    return mapPage(await list<RecipeListItem>("/query/recipes", params, signal), toRecipeItem);
  },
  async recipesByIds(ids: string[], signal?: AbortSignal) {
    const unique = lookupIds(ids);
    if (!unique.length) return [];
    const page = await list<RecipeListItem>("/query/recipes", { page: 1, pageSize: 100, ids: unique.join(",") }, signal);
    return page.items.map(toRecipeItem);
  },
  recipeIngredients: (id: string, params: ListRequest, signal?: AbortSignal) =>
    list<Ingredient>(`/query/recipes/${encodeURIComponent(id)}/ingredients`, params, signal),
  /** Lean recipe for editing: metadata and ingredientCount; ingredients are paged separately. */
  async recipeMetadata(id: string, signal?: AbortSignal) {
    const recipe = await detail<RecipeListItem>(`/query/recipes/${encodeURIComponent(id)}/metadata`, signal);
    return recipe && toRecipeItem(recipe);
  },
  async productions(params: ListRequest, signal?: AbortSignal) {
    return mapPage(await list<Production>("/query/productions", params, signal), normalizeProduction);
  },
  async production(id: string, signal?: AbortSignal) {
    const production = await detail<Production>(`/query/productions/${encodeURIComponent(id)}`, signal);
    return production && normalizeProduction(production);
  },
  async report(id: string, params: Pick<PageRequest, "page" | "pageSize">, signal?: AbortSignal) {
    const { data } = await api.get<unknown>(`/query/productions/${encodeURIComponent(id)}/report`, { params, signal });
    return toReport(data);
  },
  consumptions: (id: string, params: ListRequest, signal?: AbortSignal) =>
    list<StockConsumption>(`/query/productions/${encodeURIComponent(id)}/consumptions`, params, signal),
  sales: (params: ListRequest, signal?: AbortSignal) => list<Sale>("/query/sales", params, signal),
  /** Sales of one production; each item must carry the production's accumulated revenue. */
  async productionSales(productionId: string, params: ListRequest, signal?: AbortSignal) {
    if (!productionId) throw new Error("Informe a produção das vendas.");
    const page = await list<Sale & { cumulativeRevenue?: unknown }>("/query/sales", { ...params, productionId }, signal);
    return mapPage(page, (sale): ProductionSale =>
      ({ ...sale, cumulativeRevenue: requireNumber(sale.cumulativeRevenue, "venda.cumulativeRevenue") }));
  },
  sale: (id: string, signal?: AbortSignal) => detail<Sale>(`/query/sales/${encodeURIComponent(id)}`, signal),
  async balances(params: ListRequest, signal?: AbortSignal) {
    return mapPage(await list<unknown>("/query/balances", params, signal), toBalance);
  },
  async balance(id: string, signal?: AbortSignal) {
    const raw = await detail<unknown>(`/query/balances/${encodeURIComponent(id)}`, signal);
    return raw === null ? null : toBalance(raw);
  },
  async stock(params: ListRequest, signal?: AbortSignal) {
    return mapPage(await list<StockLotItem>("/query/stock", params, signal), toStockLot);
  },
  stockTotals: (params: ListRequest, signal?: AbortSignal) => list<StockTotal>("/query/stock-totals", params, signal),
  /** Explicit bulk read used only when the user edits a whole purchase (up to 1.000 packages). */
  async purchaseLots(entryOrder: number, signal?: AbortSignal) {
    const lots: StockLotItem[] = [];
    for (let page = 1; ; page++) {
      const result = await queryService.stock({ page, pageSize: 100, entryOrder, includeInactive: true, sortBy: "entryOrder" }, signal);
      lots.push(...result.items);
      if (page >= result.totalPages || lots.length >= 1000) return { lots, totalCount: result.totalCount };
    }
  },
};