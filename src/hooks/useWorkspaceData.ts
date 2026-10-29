import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import type {
  MarketItem, Recipe, RecipeEdit, Production, Sale, StockEntry, StockCorrection, WorkspaceData, WorkspacePatch, WorkspaceSummary,
} from "../domain/models";
import { workspaceService } from "../services/workspace";
import { recipePatch } from "../domain/recipeEdits";
import { queryService } from "../services/query";
import { getApiErrorMessage } from "../services/http";

export type DraftKind = "market" | "recipes" | "productions";

/** Unsaved edits of the current screen, keyed by record id. Nothing else is kept in memory. */
export type Drafts = {
  market: Record<string, MarketItem>;
  recipes: Record<string, RecipeEdit>;
  productions: Record<string, Production>;
  deletedMarket: string[];
  /** Market items created on this screen and not saved yet. */
  createdMarket: string[];
};

export type ChangeSet = {
  market?: MarketItem[];
  /** Whole recipes (registration and import): their ingredient lists replace the saved ones. */
  recipes?: Recipe[];
  productions?: Production[];
  sales?: Sale[];
  deleted?: { market?: string[]; recipes?: string[]; productions?: string[]; sales?: string[] };
};

const emptyDrafts: Drafts = { market: {}, recipes: {}, productions: {}, deletedMarket: [], createdMarket: [] };

const isEmptyDrafts = (drafts: Drafts) =>
  !Object.keys(drafts.market).length && !Object.keys(drafts.recipes).length &&
  !Object.keys(drafts.productions).length && !drafts.deletedMarket.length;

const byId = <T extends { id: string }>(...lists: (T[] | undefined)[]) => {
  const map = new Map<string, T>();
  for (const list of lists) for (const item of list ?? []) map.set(item.id, item);
  return [...map.values()];
};

const unique = (...lists: (string[] | undefined)[]) => [...new Set(lists.flatMap((list) => list ?? []))];

// hasStockHistory is server-derived and must not be sent back as part of an edit.
const stripMarket = ({ hasStockHistory: _derived, ...item }: MarketItem & { ingredientCount?: number }) => {
  void _derived;
  const { ingredientCount: _count, ...rest } = item;
  void _count;
  return rest;
};

const isBlockingError = (error: unknown) =>
  !isAxiosError(error) || !error.response || error.response.status >= 500 ||
  error.response.data?.code === "workspace_conflict";

export function useWorkspaceData(userId: string) {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [drafts, setDraftsState] = useState<Drafts>(emptyDrafts);
  const [dataVersion, setDataVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [apiStatus, setApiStatus] = useState<"connecting" | "saving" | "connected" | "error">("connecting");
  const latest = useRef(drafts);
  const revision = useRef<number | undefined>(undefined);
  const queue = useRef(Promise.resolve());
  const active = useRef(true);
  const blocked = useRef(false);

  const setDrafts = useCallback((next: Drafts) => {
    latest.current = next;
    setDraftsState(next);
  }, []);

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
    blocked.current = isBlockingError(error);
    if (blocked.current) setCanManage(false);
    setApiStatus("error");
    toast.error(getApiErrorMessage(error, "Não foi possível salvar. As alterações continuam na tela; recarregue para conferir o servidor."), { toastId: "api-save" });
    console.error("Falha na sincronização do workspace.", error);
  }, []);

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const loaded = await queryService.summary({}, controller.signal);
        if (controller.signal.aborted) return;
        revision.current = loaded.revision;
        setSummary(loaded);
        blocked.current = false;
        setCanManage(true);
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

  /** Reloads the global counts after a write; the revision only advances through our own writes. */
  const afterWrite = useCallback(async () => {
    setDataVersion((version) => version + 1);
    try {
      const loaded = await queryService.summary();
      if (active.current) setSummary({ ...loaded, revision: revision.current ?? loaded.revision });
    } catch (error) {
      console.error("Falha ao atualizar o resumo.", error);
      toast.error(getApiErrorMessage(error, "Os dados foram salvos, mas o resumo não pôde ser atualizado."), { toastId: "summary" });
    }
  }, []);

  /** Sends the pending edits plus `changes` as one atomic PATCH /data. */
  const persist = useCallback((changes: ChangeSet) => enqueue(async () => {
    if (blocked.current || revision.current === undefined)
      throw new Error("Recarregue os dados do servidor antes de salvar.");
    const pending = latest.current;
    const deletedMarket = unique(pending.deletedMarket, changes.deleted?.market);
    const edits = Object.values(pending.recipes).filter((edit) => !changes.deleted?.recipes?.includes(edit.recipe.id));
    const body: WorkspacePatch = {
      market: byId(Object.values(pending.market), changes.market)
        .filter((item) => !deletedMarket.includes(item.id)).map(stripMarket),
      ...recipePatch(edits, changes.recipes),
      productions: byId(Object.values(pending.productions), changes.productions)
        .filter((production) => !changes.deleted?.productions?.includes(production.id)),
      sales: changes.sales ?? [],
      deleted: {
        market: deletedMarket,
        recipes: unique(changes.deleted?.recipes),
        productions: unique(changes.deleted?.productions),
        sales: unique(changes.deleted?.sales),
      },
      revision: revision.current,
    };
    const nothing = !body.market.length && !body.recipes.length && !body.productions.length && !body.sales.length &&
      !Object.values(body.deleted).some((ids) => ids.length);
    if (nothing) return null;
    setApiStatus("saving");
    const saved = await workspaceService.patch(body);
    revision.current = saved.revision;
    // Edits made while the request was in flight stay pending.
    if (latest.current === pending) setDrafts(emptyDrafts);
    else setDrafts({
      market: Object.fromEntries(Object.entries(latest.current.market).filter(([id, item]) => pending.market[id] !== item)),
      recipes: Object.fromEntries(Object.entries(latest.current.recipes).filter(([id, item]) => pending.recipes[id] !== item)),
      productions: Object.fromEntries(Object.entries(latest.current.productions).filter(([id, item]) => pending.productions[id] !== item)),
      deletedMarket: latest.current.deletedMarket.filter((id) => !deletedMarket.includes(id)),
      createdMarket: latest.current.createdMarket.filter((id) => !(id in pending.market)),
    });
    setApiStatus("connected");
    await afterWrite();
    return saved;
  }), [enqueue, afterWrite, setDrafts]);

  const hasUnsavedChanges = !isLoading && !isEmptyDrafts(drafts);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  const saveChanges = async () => {
    try {
      await persist({});
    } catch (error) {
      reportError(error);
      throw error;
    }
  };

  /** Applies an explicit, already-confirmed change and saves it right away. */
  const commitChange = async (changes: ChangeSet) => {
    try {
      return await persist(changes);
    } catch (error) {
      reportError(error);
      throw error;
    }
  };

  const stage = <K extends DraftKind>(kind: K, record: Drafts[K][string], created = false) => {
    const current = latest.current;
    const id = "recipe" in record ? record.recipe.id : record.id;
    setDrafts({
      ...current, [kind]: { ...current[kind], [id]: record },
      createdMarket: created ? unique(current.createdMarket, [id]) : current.createdMarket,
    });
  };

  const stageMarketDelete = (id: string) => {
    const current = latest.current;
    const { [id]: _removed, ...market } = current.market;
    void _removed;
    // The server removes saved references to a deleted item; pending rows using it are dropped here.
    const recipes = Object.fromEntries(Object.entries(current.recipes).map(([recipeId, edit]) => {
      const removed = edit.recipe.ingredients.filter((ingredient) => ingredient.marketItemId === id).map((ingredient) => ingredient.id);
      return [recipeId, removed.length ? {
        ...edit,
        recipe: { ...edit.recipe, ingredients: edit.recipe.ingredients.filter((ingredient) => !removed.includes(ingredient.id)) },
        createdIngredients: edit.createdIngredients.filter((ingredientId) => !removed.includes(ingredientId)),
      } : edit];
    }));
    // An item that never reached the server is simply dropped from the pending edits.
    const created = current.createdMarket.includes(id);
    setDrafts({
      ...current, market, recipes,
      deletedMarket: created ? current.deletedMarket : unique(current.deletedMarket, [id]),
      createdMarket: current.createdMarket.filter((entry) => entry !== id),
    });
  };

  const isDirty = () => !isEmptyDrafts(latest.current);
  const latestDrafts = () => latest.current;
  const discardChanges = () => setDrafts(emptyDrafts);

  const stockMutation = async (action: (version: number) => Promise<{ revision: number }>) => {
    try {
      await enqueue(async () => {
        if (blocked.current || revision.current === undefined) throw new Error("Recarregue a página antes de alterar o estoque.");
        setApiStatus("saving");
        const result = await action(revision.current);
        if (typeof result?.revision !== "number") throw new Error("A API não informou a nova revisão dos dados.");
        revision.current = result.revision;
        setApiStatus("connected");
        await afterWrite();
      });
    } catch (error) {
      reportError(error);
      throw error;
    }
  };

  const saveProduction = async (production: Production) => {
    try {
      await persist({ productions: [production] });
    } catch (error) {
      if (isBlockingError(error)) reportError(error);
      // Business rejections keep the draft editable without blocking unrelated work.
      else {
        setApiStatus("connected");
        toast.error(getApiErrorMessage(error, "Não foi possível salvar a produção."));
      }
      throw error;
    }
  };

  /** Explicit bulk read for workbook export/import only. */
  const loadAll = (): Promise<WorkspaceData> => workspaceService.load();

  return {
    summary, drafts, dataVersion, apiStatus, isLoading, hasUnsavedChanges, saveChanges, isDirty, discardChanges,
    commitChange, stage, stageMarketDelete, loadAll, latestDrafts,
    canManageStock: !isLoading && canManage,
    canSave: !isLoading && canManage,
    addStock: (entry: StockEntry) => stockMutation((version) => workspaceService.addStock(entry, version)),
    updateStock: (correction: StockCorrection) => stockMutation((version) => workspaceService.updateStock(correction, version)),
    deleteStock: (id: string) => stockMutation((version) => workspaceService.deleteStock(id, version)),
    adjustStock: (id: string, remaining: number, reason: string) =>
      stockMutation((version) => workspaceService.adjustStock(id, remaining, reason, version)),
    saveProduction,
  };
}
