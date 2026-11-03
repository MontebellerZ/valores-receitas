import { useResource } from "./useResource";
import { salePointsService } from "../services/salePoints";
import type { DateRange } from "../services/query";

const loadPoints = (key: string, signal: AbortSignal) => salePointsService.list(JSON.parse(key) as DateRange, signal);
const loadInventory = (_key: string, signal: AbortSignal) => salePointsService.inventory(undefined, signal);

export function useSalePoints(version: number, range: DateRange = {}) {
  return useResource(loadPoints, JSON.stringify(range), version, "Não foi possível carregar os pontos de venda.");
}

export function useSalePointData(version: number, range: DateRange = {}) {
  const points = useSalePoints(version, range);
  const inventory = useResource(loadInventory, "all", version, "Não foi possível carregar o estoque por ponto de venda.");
  return { points, inventory };
}
