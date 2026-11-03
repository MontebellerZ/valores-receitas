import type {
  MarketItemsPatchRequest,
  ProductionDiscard,
  ProductionsPatchRequest,
  RecipesPatchRequest,
  SalesPatchRequest,
  StockLot,
  StockEntry,
  StockCorrection,
  WorkspaceRevision,
} from "../domain/models";
import { api } from "./http";

const requireRevision = (data: WorkspaceRevision | undefined) => {
  if (typeof data?.revision !== "number") throw new Error("A API não informou a nova revisão dos dados.");
  return { revision: data.revision };
};

const patchResource = async <TRequest,>(path: string, request: TRequest) => {
  const { data } = await api.patch<WorkspaceRevision>(path, request);
  return requireRevision(data);
};

export const workspaceService = {
  patchMarket: (request: MarketItemsPatchRequest) => patchResource("/market", request),
  patchRecipes: (request: RecipesPatchRequest) => patchResource("/recipes", request),
  patchProductions: (request: ProductionsPatchRequest) => patchResource("/productions", request),
  patchSales: (request: SalesPatchRequest) => patchResource("/sales", {
    ...request,
    changed: request.changed.map(({ salePointName, usesUnassignedStock, ...sale }) => {
      void salePointName;
      void usesUnassignedStock;
      return sale;
    }),
  }),
  async discardProduction(id: string, discard: ProductionDiscard, revision: number) {
    const { data } = await api.post<WorkspaceRevision>(`/productions/${encodeURIComponent(id)}/discard`, { ...discard, revision });
    return requireRevision(data);
  },
  async restoreProduction(id: string, revision: number) {
    const { data } = await api.delete<WorkspaceRevision>(`/productions/${encodeURIComponent(id)}/discard`, { params: { revision } });
    return requireRevision(data);
  },
  async addStock(entry: StockEntry, revision: number) {
    const { data } = await api.post<{ lot: StockLot; lots: StockLot[] | null; revision: number }>("/stock", { ...entry, revision }, { params: { compact: true } });
    return data;
  },
  async adjustStock(id: string, remainingQty: number, reason: string, revision: number) {
    const { data } = await api.patch<{ lot: StockLot; revision: number }>(`/stock/${encodeURIComponent(id)}`, {
      remainingQty, reason, revision,
    });
    return data;
  },
  async updateStock(correction: StockCorrection, revision: number) {
    const { data } = await api.put<{ lot: StockLot; lots: StockLot[] | null; revision: number }>("/stock", { ...correction, revision }, { params: { compact: true } });
    return data;
  },
  async deleteStock(id: string, revision: number) {
    const { data } = await api.delete<{ revision: number }>(`/stock/${encodeURIComponent(id)}`, { params: { revision } });
    if (typeof data?.revision !== "number") throw new Error("A API não informou a nova revisão dos dados.");
    return { revision: data.revision };
  },
};
