export type MarketItem = {
  id: string;
  name: string;
  unit: string;
  hasStockHistory?: boolean;
};

export type Ingredient = { id: string; marketItemId: string; quantity: number };

export type Recipe = {
  id: string;
  name: string;
  category: string;
  yield: number;
  hoursPerBatch: number;
  /** Validade em dias após a data de produção; vazio quando não informada. */
  shelfLifeDays?: number | null;
  ingredients: Ingredient[];
};

export type RecipeDraft = Omit<Recipe, "id" | "ingredients"> & {
  ingredients: Omit<Ingredient, "id">[];
};

export type Production = {
  id: string;
  date: string;
  recipeId: string;
  recipeName: string;
  quantity: number;
  actualYield: number;
  losses: number;
  margin: number;
  packageQty: number;
  yieldPerBatch: number;
  ingredientCostPerBatch: number;
  expectedSalePrice?: number;
  totalCost?: number | null;
  /** Pacotes prontos que não podem mais ser vendidos (vencidos, roubados ou descartados). */
  lostPackages?: number;
  /** Produção avulsa: não consome estoque e usa custo total informado manualmente. */
  isStandalone?: boolean;
};

export type StockLot = {
  id: string;
  marketItemId: string;
  itemName: string;
  unit: string;
  entryDate: string;
  entryOrder: number;
  packageQty: number;
  packagePrice: number;
  remainingQty: number;
  isActive: boolean;
};

export type StockConsumption = {
  stockLotId: string;
  itemName: string;
  unit: string;
  entryDate: string;
  quantity: number;
  cost: number;
  packageQty: number;
  packagePrice: number;
};

export type StockEntry = Pick<StockLot, "marketItemId" | "entryDate" | "packageQty" | "packagePrice"> & {
  packageCount?: number;
};

export type StockField = "marketItemId" | "entryDate" | "packageQty" | "packagePrice";
export type StockCorrection = Partial<Pick<StockLot, StockField>> & {
  lotIds: string[];
  reason: string;
};

export type CalculatedProduction = Production & {
  cost: number;
  produced: number;
  packages: number;
  costPerPackage: number;
  salePrice: number;
  revenue: number;
  profit: number;
};

export type Sale = {
  id: string;
  productionId: string;
  productionDate: string;
  recipeName: string;
  date: string;
  packages: number;
  pricePerPackage: number;
  costPerPackage: number;
  customer: string;
  paid: boolean;
  donated?: boolean;
  notes: string;
};

export type SaleDraft = Pick<
  Sale,
  | "productionId"
  | "date"
  | "packages"
  | "pricePerPackage"
  | "customer"
  | "paid"
  | "donated"
  | "notes"
> & { id?: string };
export type UserSession = { id: string; email: string };
export type WorkspaceData = {
  market: MarketItem[];
  recipes: Recipe[];
  productions: Production[];
  sales: Sale[];
  revision?: number;
};
export type SyncStatus = "connecting" | "saving" | "connected" | "error";
export type SalesProduction = {
  id: string;
  date: string;
  recipeName: string;
  packages: number;
  lostPackages?: number;
  salePrice: number;
  expectedSalePrice?: number;
  /** Pacotes já vendidos ou doados em todas as vendas desta produção. */
  soldPackages: number;
};

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type MarketListItem = MarketItem & { ingredientCount: number };

/** Item enxuto da listagem de receitas: os ingredientes vêm só no detalhe. */
export type RecipeListItem = Recipe & { ingredientCount: number };

export type StockLotItem = StockLot & {
  purchaseLotCount: number;
  purchaseMixedItems: boolean;
};

export type StockTotal = { id: string; name: string; unit: string; quantity: number };

export type PeriodSales = { count: number; packages: number; revenue: number; cost: number };

export type ProductionBalance = CalculatedProduction & {
  soldPackages: number;
  donatedPackages: number;
  availablePackages: number;
  periodSales: PeriodSales;
};

export type WorkspaceSummary = {
  revision: number;
  counts: { market: number; recipes: number; productions: number; sales: number };
  sales: {
    count: number;
    packages: number;
    revenue: number;
    received: number;
    pending: number;
    pendingCount: number;
    cost: number;
    profit: number;
  };
  availablePackages: number;
  productionCost: number;
  producedPackages: number;
  lostPackages: number;
  productions: {
    count: number;
    soldPackages: number;
    donatedPackages: number;
    losses: number;
    remainingRevenue: number;
    remainingCost: number;
    expectedRevenue: number;
    referenceRevenue: number;
    referenceProfit: number;
  };
};

export type ProductionSalesTotals = {
  salesCount: number;
  outPackages: number;
  donatedPackages: number;
  revenue: number;
  received: number;
  pending: number;
  soldCost: number;
  firstSaleDate: string | null;
};

/** Sale of a production listing with the revenue of the production's sales up to it (date, then id). */
export type ProductionSale = Sale & { cumulativeRevenue: number };

export type ProductionDayRow = {
  date: string;
  sold: number;
  donated: number;
  total: number;
  revenue: number;
  /** Faturamento acumulado desde a primeira venda até o fim do dia; null quando a API não informa. */
  /** Revenue of every sale of the production up to and including this day. */
  cumulativeRevenue: number;
};

export type ProductionBuyer = { customer: string; packages: number; spent: number };

export type SalesReport = {
  totals: {
    count: number; packages: number; donatedPackages: number; pendingCount: number; customers: number;
    revenue: number; received: number; pending: number; cost: number; donationCost: number;
  };
  daily: Page<{ date: string; packages: number; revenue: number }>;
  topProducts: { name: string; packages: number; revenue: number; cost: number }[];
  topBuyers: ProductionBuyer[];
};

export type ProductionReportPage = ProductionSalesTotals & {
  daily: Page<ProductionDayRow>;
  topBuyers: ProductionBuyer[];
};

export type WorkspacePatch = {
  market: MarketItem[];
  recipes: Recipe[];
  productions: Production[];
  sales: Sale[];
  deleted: { market: string[]; recipes: string[]; productions: string[]; sales: string[] };
  revision: number;
  /** When true, each recipe's `ingredients` are upserts: unsent ingredients are preserved on the server. */
  partialRecipeIngredients?: true;
  /** Ingredient ids removed from the submitted recipes; only sent with `partialRecipeIngredients`. */
  deletedIngredients?: string[];
};

/**
 * Unsaved edit of a saved recipe. `recipe` holds the metadata and only the touched ingredients
 * (changed or created); ingredients never loaded stay untouched on the server.
 */
export type RecipeEdit = {
  recipe: Recipe;
  /** Saved ingredient ids removed on this screen. */
  deletedIngredients: string[];
  /** Ingredient ids created on this screen and not saved yet. */
  createdIngredients: string[];
};
