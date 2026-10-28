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
};
