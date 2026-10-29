import type { WorkspaceData, WorkspacePatch, StockLot, StockEntry, StockCorrection } from "../domain/models";
import { api } from "./http";

const normalizeSnapshot = (data: WorkspaceData): WorkspaceData => ({
  ...data,
  productions: data.productions.map((production) => ({
    ...production,
    expectedSalePrice: production.expectedSalePrice ?? undefined,
  })),
});

export const workspaceService = {
  /** Explicit bulk read, used only by workbook export/import. */
  async load(signal?: AbortSignal) {
    const { data } = await api.get<WorkspaceData>("/data", { signal });
    return normalizeSnapshot(data);
  },
  /** Explicit bulk replacement; ordinary screens save through `patch`. */
  async save(snapshot: WorkspaceData, signal?: AbortSignal) {
    const { data } = await api.put<WorkspaceData>("/data", snapshot, { signal });
    return normalizeSnapshot(data);
  },
  /** Incremental save: only changed records and deleted ids; returns the canonical changed records. */
  async patch(changes: WorkspacePatch, signal?: AbortSignal) {
    const { data } = await api.patch<WorkspaceData>("/data", changes, { signal });
    if (typeof data?.revision !== "number") throw new Error("A API não informou a nova revisão dos dados.");
    return normalizeSnapshot({
      market: data.market ?? [], recipes: data.recipes ?? [], productions: data.productions ?? [],
      sales: data.sales ?? [], revision: data.revision,
    });
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
