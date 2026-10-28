import { useMemo, useState } from "react";
import { useMatch, useNavigate, useBlocker } from "react-router-dom";
import { toast } from "react-toastify";
import type {
  Ingredient,
  MarketItem,
  Recipe,
  RecipeDraft,
  Production,
  SaleDraft,
} from "../domain/models";
import type { PendingDelete } from "../types/navigation";
import { paths } from "../app/paths";
import { calculateProduction } from "../domain/calculations";
import { makeId } from "../utils/format";
import { normalize } from "../utils/parsing";
import {
  prepareSale,
  prepareSales,
  validateProductionUpdate,
} from "../domain/workspaceRules";
import {
  exportWorkbook as exportWorkbookFile,
  importWorkbook as importWorkbookFile,
} from "../services/workbook";
import { useWorkspaceData } from "./useWorkspaceData";

export class SaveCancelledError extends Error {
  constructor() {
    super("Salvamento cancelado.");
    this.name = "SaveCancelledError";
  }
}

type PendingSave = { message: string; resolve: () => void; reject: (error: Error) => void };

export function useWorkspace(userId: string) {
  const {
    market,
    setMarket,
    recipes,
    setRecipes,
    productions,
    setProductions,
    sales,
    apiStatus,
    isLoading,
    stock,
    addStock: addStockNow,
    updateStock: updateStockNow,
    deleteStock: deleteStockNow,
    adjustStock: adjustStockNow,
    saveProduction: saveProductionNow,
    canManageStock,
    hasUnsavedChanges,
    saveChanges: saveChangesNow,
    isDirty,
    discardChanges,
    commitChange,
  } = useWorkspaceData(userId);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const confirmSave = (message: string) =>
    new Promise<void>((resolve, reject) => setPendingSave({ message, resolve, reject }));
  const withConfirmation = <A extends unknown[], R>(message: string, action: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      await confirmSave(message);
      return action(...args);
    };
  const addStock = withConfirmation("Salvar esta entrada no estoque?", addStockNow);
  const updateStock = withConfirmation("Salvar a correção dos pacotes selecionados?", updateStockNow);
  const adjustStock = withConfirmation("Salvar a baixa deste pacote?", adjustStockNow);
  const deleteStock = deleteStockNow;
  const saveProduction = withConfirmation(
    "Salvar a produção? O estoque será consumido.",
    saveProductionNow,
  );
  const saveChanges = withConfirmation("Salvar as alterações desta tela?", saveChangesNow);
  // Edits belong to the screen where they were made: leaving it asks for confirmation and discards them.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty() && currentLocation.pathname !== nextLocation.pathname,
  );
  const leaveScreen = (stay: boolean) => {
    if (blocker.state !== "blocked") return;
    if (stay) {
      blocker.reset();
      return;
    }
    discardChanges();
    blocker.proceed();
  };
  // Runs an explicit action that is saved immediately, after the user confirms it.
  const confirmedCommit = async (message: string, mutate: Parameters<typeof commitChange>[0]) => {
    try {
      await confirmSave(isDirty() ? `${message} As alterações pendentes desta tela também serão salvas.` : message);
      await commitChange(mutate);
      return true;
    } catch {
      return false;
    }
  };
  const resolvePendingSave = (confirmed: boolean) => {
    if (!pendingSave) return;
    if (confirmed) pendingSave.resolve();
    else pendingSave.reject(new SaveCancelledError());
    setPendingSave(null);
  };
  const navigate = useNavigate();
  const selectedRecipeId = useMatch(paths.recipePattern)?.params.recipeId;
  const selectedProductionId = useMatch(paths.productionPattern)?.params
    .productionId;
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );

  const calculated = useMemo(
    () => productions.map(calculateProduction),
    [productions],
  );
  const activeRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId);
  const sortedMarket = useMemo(
    () =>
      [...market].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", {
          sensitivity: "base",
          numeric: true,
        }),
      ),
    [market],
  );
  const availableMarketItems = activeRecipe
    ? sortedMarket.filter(
        (item) =>
          !activeRecipe.ingredients.some(
            (ingredient) => ingredient.marketItemId === item.id,
          ),
      )
    : sortedMarket;

  const updateRecipe = (id: string, patch: Partial<Recipe>) =>
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === id ? { ...recipe, ...patch } : recipe,
      ),
    );
  const updateMarket = (id: string, patch: Partial<MarketItem>) => {
    if (patch.unit !== undefined && market.find((item) => item.id === id)?.hasStockHistory) {
      toast.error("Cadastre outro insumo para usar uma unidade diferente.");
      return;
    }
    setMarket((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };
  const updateIngredient = (
    recipeId: string,
    ingredientId: string,
    patch: Partial<Ingredient>,
  ) => {
    setRecipes((current) =>
      current.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              ingredients: recipe.ingredients.map((ingredient) =>
                ingredient.id === ingredientId
                  ? { ...ingredient, ...patch }
                  : ingredient,
              ),
            }
          : recipe,
      ),
    );
  };
  const registerRecipe = async (draft: RecipeDraft) => {
    const recipe: Recipe = {
      ...draft,
      id: makeId(),
      ingredients: draft.ingredients.map((ingredient) => ({
        ...ingredient,
        id: makeId(),
      })),
    };
    const saved = await confirmedCommit("Salvar o cadastro desta receita?", (current) => ({
      ...current,
      recipes: [...current.recipes, recipe],
    }));
    if (!saved) return false;
    navigate(paths.recipe(recipe.id));
    toast.success("Receita cadastrada.");
    return true;
  };
  const addMarketItem = (draft: Pick<MarketItem, "name" | "unit">) => {
    setMarket((current) => [
      ...current,
      { ...draft, id: makeId() },
    ]);
    toast.info("Insumo adicionado. Clique em “Salvar alterações” para gravar.");
  };
  const addIngredient = () => {
    if (!activeRecipe || availableMarketItems.length === 0) return;
    updateRecipe(activeRecipe.id, {
      ingredients: [
        ...activeRecipe.ingredients,
        { id: makeId(), marketItemId: availableMarketItems[0].id, quantity: 0 },
      ],
    });
  };
  const createProduction = async (draft: Omit<Production, "id">) => {
    const production: Production = { ...draft, id: makeId() };
    await saveProduction(production);
    return production;
  };
  const updateProduction = (id: string, patch: Partial<Production>) => {
    const production = productions.find((entry) => entry.id === id);
    if (!production) return;
    const error = validateProductionUpdate(production, patch, sales);
    if (error) {
      toast.error(error);
      return;
    }
    setProductions((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  };
  const saveSale = async (draft: SaleDraft): Promise<string | undefined | null> => {
    const result = prepareSale(draft, calculated, sales);
    if (result.error !== undefined) return result.error;
    const sale = result.sale;
    const saved = await confirmedCommit(draft.id ? "Salvar as alterações desta venda?" : "Salvar o registro desta venda?", (current) => ({
      ...current,
      sales: draft.id
        ? current.sales.map((entry) => (entry.id === sale.id ? sale : entry))
        : [sale, ...current.sales],
    }));
    return saved ? undefined : null;
  };
  const saveSales = async (drafts: SaleDraft[]): Promise<string | undefined | null> => {
    const result = prepareSales(drafts, calculated, sales);
    if (result.error !== undefined) return result.error;
    const saved = await confirmedCommit(
      `Salvar o registro de ${drafts.length} venda(s) do carrinho?`,
      (current) => ({ ...current, sales: [...result.sales, ...current.sales] }),
    );
    return saved ? undefined : null;
  };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    if (target.kind === "recipe" || target.kind === "production" || target.kind === "sale") {
      if (target.kind === "production" && sales.some((sale) => sale.productionId === target.id)) {
        toast.error(
          "Esta produção possui vendas. Exclua as vendas vinculadas antes de removê-la.",
        );
        setPendingDelete(null);
        return;
      }
      // The delete dialog is the confirmation; the removal is saved immediately.
      try {
        await commitChange((current) => ({
          ...current,
          recipes: target.kind === "recipe" ? current.recipes.filter((recipe) => recipe.id !== target.id) : current.recipes,
          productions: target.kind === "production" ? current.productions.filter((production) => production.id !== target.id) : current.productions,
          sales: target.kind === "sale" ? current.sales.filter((sale) => sale.id !== target.id) : current.sales,
        }));
      } catch {
        setPendingDelete(null);
        return;
      }
      if (target.kind === "recipe" && selectedRecipeId === target.id) {
        navigate(paths.recipes, { replace: true });
      }
      if (target.kind === "production" && selectedProductionId === target.id) {
        navigate(paths.productions, { replace: true });
      }
    } else if (target.kind === "market") {
      if (market.find((item) => item.id === target.id)?.hasStockHistory) {
        toast.error("Um insumo com histórico de estoque não pode ser excluído.");
        setPendingDelete(null);
        return;
      }
      setMarket((current) =>
        current.filter((item) => item.id !== target.id),
      );
      setRecipes((current) =>
        current.map((recipe) => ({
          ...recipe,
          ingredients: recipe.ingredients.filter(
            (ingredient) => ingredient.marketItemId !== target.id,
          ),
        })),
      );
    } else {
      setRecipes((current) =>
        current.map((recipe) =>
          recipe.id === target.recipeId
            ? {
                ...recipe,
                ingredients: recipe.ingredients.filter(
                  (ingredient) => ingredient.id !== target.id,
                ),
              }
            : recipe,
        ),
      );
    }
    const deletedLabels = {
      recipe: "Receita excluída.",
      production: "Produção excluída.",
      sale: "Venda excluída. Os pacotes voltaram ao saldo disponível.",
      market: "Insumo removido. Clique em “Salvar alterações” para gravar.",
      ingredient: "Ingrediente removido. Clique em “Salvar alterações” para gravar.",
    } as const;
    toast.success(deletedLabels[pendingDelete.kind]);
    setPendingDelete(null);
  };
  const exportWorkbook = () => {
    try {
      exportWorkbookFile({ market, recipes, productions, sales });
      toast.success("Planilha exportada para conta-de-chef.xlsx.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível exportar a planilha.",
      );
    }
  };

  const importWorkbook = async (file: File) => {
    try {
      const imported = await importWorkbookFile(file);
      const idMap = new Map<string, string>();
      const mergedMarket = [...market];
      for (const item of imported.market) {
        const existing = market.find((entry) => normalize(entry.name) === normalize(item.name));
        if (existing) {
          if (existing.hasStockHistory && existing.unit !== item.unit)
            throw new Error(`O insumo "${existing.name}" tem estoque e não pode mudar de unidade.`);
          idMap.set(item.id, existing.id);
          mergedMarket[mergedMarket.findIndex((entry) => entry.id === existing.id)] = { ...existing, name: item.name, unit: item.unit };
        } else {
          idMap.set(item.id, item.id);
          mergedMarket.push(item);
        }
      }
      const mergedRecipes = [...recipes];
      for (const recipe of imported.recipes) {
        const existing = recipes.find((entry) => normalize(entry.name) === normalize(recipe.name));
        const next = { ...recipe, id: existing?.id ?? recipe.id,
          ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient, marketItemId: idMap.get(ingredient.marketItemId) ?? ingredient.marketItemId })) };
        const index = mergedRecipes.findIndex((entry) => entry.id === next.id);
        if (index >= 0) mergedRecipes[index] = next;
        else mergedRecipes.push(next);
      }
      const saved = await confirmedCommit("Salvar os dados importados da planilha?", (current) => ({
        ...current,
        market: mergedMarket,
        recipes: mergedRecipes,
      }));
      if (saved)
        toast.success(
          `Planilha importada: ${imported.market.length} insumos e ${imported.recipes.length} receitas.`,
        );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível importar a planilha.",
      );
    }
  };

  return {
    market,
    recipes,
    productions,
    sales,
    apiStatus,
    isLoading,
    stock,
    addStock,
    updateStock,
    deleteStock,
    adjustStock,
    saveProduction,
    canManageStock,
    hasUnsavedChanges,
    saveChanges,
    discardChanges,
    isDirty,
    leaveScreen,
    isLeavingBlocked: blocker.state === "blocked",
    pendingSaveMessage: pendingSave?.message ?? null,
    resolvePendingSave,
    pendingDelete,
    setPendingDelete,
    calculated,
    activeRecipe,
    updateRecipe,
    updateMarket,
    updateIngredient,
    registerRecipe,
    addMarketItem,
    addIngredient,
    createProduction,
    updateProduction,
    saveSale,
    saveSales,
    confirmDelete,
    exportWorkbook,
    importWorkbook,
  };
}
