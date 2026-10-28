import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import type { MarketItem, Recipe, Production, Sale, StockLot, StockEntry, StockCorrection, WorkspaceData } from "../domain/models";
import { workspaceService } from "../services/workspace";
import { getApiErrorMessage } from "../services/http";

const emptyData: WorkspaceData = { market: [], recipes: [], productions: [], sales: [] };

// hasStockHistory is server-derived, so it must not count as an unsaved edit.
const contentKey = ({ market, recipes, productions, sales }: WorkspaceData) =>
  JSON.stringify({
    market: market.map((item) => ({ ...item, hasStockHistory: undefined })),
    recipes, productions, sales,
  });

export function useWorkspaceData(userId: string) {
  const [data, setData] = useState<WorkspaceData>(emptyData);
  const [stock, setStock] = useState<StockLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canManageStock, setCanManageStock] = useState(false);
  const [apiStatus, setApiStatus] = useState<"connecting" | "saving" | "connected" | "error">("connecting");
  const latest = useRef(data);
  const revision = useRef<number | undefined>(undefined);
  const lastSaved = useRef("");
  const queue = useRef(Promise.resolve());
  const active = useRef(true);
  const blocked = useRef(false);
  const [savedKey, setSavedKey] = useState("");
  const savedData = useRef<WorkspaceData>(emptyData);

  const enqueue = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(async () => {
      if (!active.current) throw new Error("A sessão foi encerrada.");
      return action();
    });
    // Preserve a usable queue; each caller handles its own rejection.
    queue.current = next.then(() => undefined, () => undefined);
    return next;
  }, []);

  const reportError = useCallback((error: unknown) => {
    if (!active.current) return;
    blocked.current = !isAxiosError(error) || !error.response || error.response.status >= 500 || error.response.data?.code === "workspace_conflict";
    if (blocked.current) setCanManageStock(false);
    setApiStatus("error");
    toast.error(getApiErrorMessage(error, "Não foi possível salvar. As alterações continuam na tela; recarregue para conferir o servidor."), { toastId: "api-save" });
    console.error("Falha na sincronização do workspace.", error);
  }, []);

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const server = await workspaceService.load(controller.signal);
        const lots = await workspaceService.stock(controller.signal);
        if (controller.signal.aborted) return;
        revision.current = server.revision;
        lastSaved.current = contentKey(server);
        setSavedKey(lastSaved.current);
        savedData.current = server;
        latest.current = server;
        setData(server);
        setStock(lots);
        blocked.current = false;
        setCanManageStock(true);
        setApiStatus("connected");
      } catch (error) {
        if (!controller.signal.aborted) reportError(error);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [userId, reportError]);

  const persist = useCallback((snapshot: WorkspaceData = latest.current, explicit = false) => enqueue(async () => {
    if (blocked.current || revision.current === undefined)
      throw new Error("Recarregue os dados do servidor antes de salvar.");
    if (!explicit && snapshot !== latest.current) return latest.current;
    if (contentKey(snapshot) === lastSaved.current) return snapshot;
    setApiStatus("saving");
    const server = await workspaceService.save({ ...snapshot, revision: revision.current });
    revision.current = server.revision;
    lastSaved.current = contentKey(server);
    setSavedKey(lastSaved.current);
    savedData.current = server;
    if (!active.current) return server;
    if (contentKey(latest.current) === contentKey(snapshot)) {
      latest.current = server;
      setData(server);
    } else {
      // Later local edits must not be replaced by an earlier server response.
      setData((current) => {
        const productions = [...current.productions];
        for (const saved of server.productions) {
          if (
            snapshot.productions.some((item) => item.id === saved.id) &&
            !productions.some((item) => item.id === saved.id)
          ) {
            productions.unshift(saved);
          }
        }
        const merged = {
          ...current,
          productions: productions.map((production) => {
            const saved = server.productions.find((item) => item.id === production.id);
            if (explicit && production.quantity === 0 && saved && saved.quantity > 0) return saved;
            return saved && saved.quantity === production.quantity && saved.recipeId === production.recipeId
              ? { ...production, totalCost: saved.totalCost, ingredientCostPerBatch: saved.ingredientCostPerBatch }
              : production;
          }),
        };
        latest.current = merged;
        return merged;
      });
    }
    setStock(await workspaceService.stock());
    setApiStatus("connected");
    return server;
  }), [enqueue]);

  const hasUnsavedChanges = !isLoading && savedKey !== "" && contentKey(data) !== savedKey;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  const saveChanges = async () => {
    try {
      await persist(latest.current, true);
    } catch (error) {
      reportError(error);
      throw error;
    }
  };

  const update = <K extends "market" | "recipes" | "productions" | "sales">(key: K, action: SetStateAction<WorkspaceData[K]>) => {
    const current = latest.current;
    const value = typeof action === "function" ? action(current[key]) : action;
    const next = { ...current, [key]: value };
    latest.current = next;
    setData(next);
  };

  const isDirty = () => contentKey(latest.current) !== lastSaved.current;

  const discardChanges = () => {
    latest.current = savedData.current;
    setData(savedData.current);
  };

  // Applies an explicit, already-confirmed change and persists it right away; rolls back on failure.
  const commitChange = async (mutate: (current: WorkspaceData) => WorkspaceData) => {
    const previous = latest.current;
    const next = mutate(previous);
    latest.current = next;
    setData(next);
    try {
      await persist(next, true);
    } catch (error) {
      latest.current = previous;
      setData(previous);
      reportError(error);
      throw error;
    }
  };

  const stockMutation = async (action: (version: number) => Promise<{ revision: number }>) => {
    try {
      await enqueue(async () => {
        if (blocked.current || revision.current === undefined) throw new Error("Recarregue a página antes de alterar o estoque.");
        setApiStatus("saving");
        const result = await action(revision.current);
        revision.current = result.revision;
        const lots = await workspaceService.stock();
        setStock(lots);
        setData((current) => {
          const itemIds = new Set(lots.map((lot) => lot.marketItemId));
          const next = { ...current, market: current.market.map((item) => ({ ...item, hasStockHistory: itemIds.has(item.id) })) };
          latest.current = next;
          return next;
        });
        setApiStatus("connected");
      });
    } catch (error) {
      reportError(error);
      throw error;
    }
  };

  const saveProduction = async (production: Production) => {
    const exists = latest.current.productions.some((item) => item.id === production.id);
    const snapshot = {
      ...latest.current,
      productions: exists
        ? latest.current.productions.map((item) => item.id === production.id ? production : item)
        : [production, ...latest.current.productions],
    };
    try {
      await persist(snapshot, true);
    } catch (error) {
      if (!isAxiosError(error) || !error.response || error.response.status >= 500 || error.response.data?.code === "workspace_conflict")
        reportError(error);
      // Business rejections keep the draft editable without blocking unrelated work.
      else {
        setApiStatus("connected");
        toast.error(getApiErrorMessage(error, "Não foi possível salvar a produção."));
      }
      throw error;
    }
  };

  return {
    ...data, stock, apiStatus, isLoading, hasUnsavedChanges, saveChanges, isDirty, discardChanges, commitChange,
    canManageStock: !isLoading && canManageStock,
    setMarket: (action: SetStateAction<MarketItem[]>) => update("market", action),
    setRecipes: (action: SetStateAction<Recipe[]>) => update("recipes", action),
    setProductions: (action: SetStateAction<Production[]>) => update("productions", action),
    setSales: (action: SetStateAction<Sale[]>) => update("sales", action),
    addStock: (entry: StockEntry) => stockMutation((version) => workspaceService.addStock(entry, version)),
    updateStock: (correction: StockCorrection) => stockMutation((version) => workspaceService.updateStock(correction, version)),
    deleteStock: (id: string) => stockMutation((version) => workspaceService.deleteStock(id, version)),
    adjustStock: (id: string, remaining: number, reason: string) =>
      stockMutation((version) => workspaceService.adjustStock(id, remaining, reason, version)),
    saveProduction,
  };
}
