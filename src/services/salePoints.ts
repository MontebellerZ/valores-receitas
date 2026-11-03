import type { SalePoint, SalePointAllocation, SalePointInventory, SalePointSummary, WorkspaceRevision } from "../domain/models";
import { api } from "./http";
import { ApiContractError, queryService, type DateRange } from "./query";

export function toSalePoints(value: unknown): SalePointSummary[] {
  if (!Array.isArray(value) || !value.some((row) => row?.id === null && row.name === "Sem ponto") ||
    value.some((row) => !row || (row.id !== null && typeof row.id !== "string") || typeof row.name !== "string" ||
      ["availablePackages", "soldPackages", "donatedPackages", "revenue", "cost"].some((key) =>
        typeof row[key] !== "number" || !Number.isFinite(row[key]))))
    throw new ApiContractError("indicadores dos pontos de venda inválidos.");
  return value;
}

export function toSalePointInventory(value: unknown): SalePointInventory[] {
  if (!Array.isArray(value) || value.some((row) => !row || typeof row.productionId !== "string" ||
    typeof row.recipeName !== "string" || typeof row.date !== "string" ||
    (row.salePointId !== null && typeof row.salePointId !== "string") ||
    typeof row.salePointName !== "string" || !Number.isSafeInteger(row.packages) || row.packages <= 0))
    throw new ApiContractError("estoque dos pontos de venda inválido.");
  return value;
}

export const salePointsService = {
  async list(range: DateRange = {}, signal?: AbortSignal) {
    return toSalePoints((await api.get("/sale-points", { params: range, signal })).data);
  },
  async inventory(productionId?: string, signal?: AbortSignal) {
    return toSalePointInventory((await api.get("/sale-points/inventory", { params: { productionId }, signal })).data);
  },
  async save(point: { id?: string; name: string }, revision: number) {
    const body = { name: point.name.trim(), revision };
    const response = point.id
      ? await api.put<WorkspaceRevision>(`/sale-points/${encodeURIComponent(point.id)}`, body)
      : await api.post<SalePoint & WorkspaceRevision>("/sale-points", body);
    return response.data;
  },
  async remove(id: string, revision: number) {
    await api.delete(`/sale-points/${encodeURIComponent(id)}`, { params: { revision } });
    // DELETE returns 204; obtain the new workspace revision before the next queued write.
    return { revision: (await queryService.summary()).revision };
  },
  async allocate(productionId: string, allocations: SalePointAllocation[], revision: number) {
    return (await api.put<WorkspaceRevision>(`/sale-points/allocations/${encodeURIComponent(productionId)}`,
      { revision, allocations })).data;
  },
};
