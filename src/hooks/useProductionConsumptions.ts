import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { StockConsumption } from "../domain/models";
import { workspaceService } from "../services/workspace";
import { getApiErrorMessage } from "../services/http";

export function useProductionConsumptions(id: string | undefined, totalCost: number | null | undefined) {
  const [result, setResult] = useState<{
    id: string; totalCost: number | null | undefined;
    consumptions: StockConsumption[]; consumptionStatus: "ready" | "error";
  }>();
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void workspaceService.consumptions(id, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setResult({ id, totalCost, consumptions: items, consumptionStatus: "ready" });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setResult({ id, totalCost, consumptions: [], consumptionStatus: "error" });
      toast.error(getApiErrorMessage(error, "Não foi possível carregar os lotes consumidos."));
    });
    return () => controller.abort();
  }, [id, totalCost]);
  return result?.id === id && result?.totalCost === totalCost && result
    ? result
    : { consumptions: [], consumptionStatus: "loading" as const };
}
