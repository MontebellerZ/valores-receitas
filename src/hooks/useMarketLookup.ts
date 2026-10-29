import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { MarketListItem } from "../domain/models";
import { queryService } from "../services/query";
import { getApiErrorMessage } from "../services/http";

/** Loads only the market items referenced on screen (up to 100 ids per request). */
export function useMarketLookup(ids: string[], version = 0) {
  const key = JSON.stringify([[...new Set(ids.filter(Boolean))].sort(), version]);
  const [result, setResult] = useState<{ key: string; items: Map<string, MarketListItem>; error?: true }>();
  useEffect(() => {
    const [wanted] = JSON.parse(key) as [string[]];
    if (!wanted.length) return;
    const controller = new AbortController();
    const chunks = Array.from({ length: Math.ceil(wanted.length / 100) }, (_, index) => wanted.slice(index * 100, index * 100 + 100));
    Promise.all(chunks.map((chunk) => queryService.marketByIds(chunk, controller.signal))).then((pages) => {
      if (controller.signal.aborted) return;
      setResult({ key, items: new Map(pages.flat().map((item) => [item.id, item])) });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setResult({ key, items: new Map(), error: true });
      toast.error(getApiErrorMessage(error, "Não foi possível carregar os insumos."), { toastId: "market-lookup" });
    });
    return () => controller.abort();
  }, [key]);
  const ready = result?.key === key;
  return {
    // While other ids load, names already resolved stay visible instead of flashing as loading.
    items: result?.items ?? new Map<string, MarketListItem>(),
    status: (JSON.parse(key) as [string[]])[0].length === 0 ? "ready" as const
      : !ready ? "loading" as const : result.error ? "error" as const : "ready" as const,
  };
}
