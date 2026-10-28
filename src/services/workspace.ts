import type { WorkspaceData, StockLot, StockEntry, StockConsumption, StockCorrection } from "../domain/models";
import { api } from "./http";

const normalizeSnapshot = (data: WorkspaceData): WorkspaceData => ({
  ...data,
  productions: data.productions.map((production) => ({
    ...production,
    expectedSalePrice: production.expectedSalePrice ?? undefined,
  })),
});

export const workspaceService = {
  async load(signal?: AbortSignal) {
    const { data } = await api.get<WorkspaceData>("/data", { signal });
    return normalizeSnapshot(data);
  },
  async save(snapshot: WorkspaceData, signal?: AbortSignal) {
    const { data } = await api.put<WorkspaceData>("/data", snapshot, { signal });
    return normalizeSnapshot(data);
  },
  async stock(signal?: AbortSignal) {
    const { data } = await api.get<StockLot[]>("/stock", { signal, params: { includeInactive: true } });
    return data;
  },
  async addStock(entry: StockEntry, revision: number) {
    const { data } = await api.post<{ lot: StockLot; lots: StockLot[]; revision: number }>("/stock", { ...entry, revision });
    return data;
  },
  async adjustStock(id: string, remainingQty: number, reason: string, revision: number) {
    const { data } = await api.patch<{ lot: StockLot; revision: number }>(`/stock/${encodeURIComponent(id)}`, {
      remainingQty, reason, revision,
    });
    return data;
  },
  async updateStock(correction: StockCorrection, revision: number) {
    const { data } = await api.put<{ lot: StockLot; lots: StockLot[]; revision: number }>("/stock", { ...correction, revision });
    return data;
  },
  async deleteStock(id: string, revision: number) {
    await api.delete(`/stock/${encodeURIComponent(id)}`, { params: { revision } });
    return { revision: revision + 1 };
  },
  async consumptions(id: string, signal?: AbortSignal) {
    const { data } = await api.get<StockConsumption[]>(`/productions/${encodeURIComponent(id)}/consumptions`, { signal });
    return data;
  },
};
