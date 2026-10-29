import { useState } from "react";
import { useMatch, useNavigate, useBlocker } from "react-router-dom";
import { toast } from "react-toastify";
import type {
  CalculatedProduction,
  Ingredient,
  MarketItem,
  Recipe,
  RecipeDraft,
  RecipeEdit,
  RecipeListItem,
  Production,
  SaleDraft,
} from "../domain/models";
import type { PendingDelete } from "../types/navigation";
import { paths } from "../app/paths";
import { makeId } from "../utils/format";
import { normalize } from "../utils/parsing";
import {
  prepareSale,
  prepareSales,
  validateProductionUpdate,
  type ProductionSalesStats,
  type SaleTarget,
} from "../domain/workspaceRules";
import { queryService } from "../services/query";
import * as recipeEdits from "../domain/recipeEdits";
import { getApiErrorMessage } from "../services/http";
import { useWorkspaceData, type ChangeSet } from "./useWorkspaceData";

export class SaveCancelledError extends Error {
  constructor() {
    super("Salvamento cancelado.");
    this.name = "SaveCancelledError";
  }
}

type PendingSave = { message: string; resolve: () => void; reject: (error: Error) => void };

/**
 * Checks recipe rows before they are sent: every row needs one distinct market item. Partial edits
 * only know the touched rows; duplicates against unloaded rows are rejected by the server.
 */
export function validateRecipeDrafts(recipes: Recipe[]) {
  for (const recipe of recipes) {
    const ids = recipe.ingredients.map((ingredient) => ingredient.marketItemId);
    if (ids.some((id) => !id)) return `Escolha o insumo de todos os ingredientes da receita "${recipe.name || "sem nome"}".`;
    if (new Set(ids).size !== ids.length) return `A receita "${recipe.name || "sem nome"}" repete um insumo.`;
  }
}

export function useWorkspace(userId: string) {
  const data = useWorkspaceData(userId);
  const { drafts, commitChange, isDirty, discardChanges, stage, stageMarketDelete } = data;
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const confirmSave = (message: string) =>
    new Promise<void>((resolve, reject) => setPendingSave({ message, resolve, reject }));
  const withConfirmation = <A extends unknown[], R>(message: string, action: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      await confirmSave(message);
      return action(...args);
    };
  const addStock = withConfirmation("Salvar esta entrada no estoque?", data.addStock);
  const updateStock = withConfirmation("Salvar a correção dos pacotes selecionados?", data.updateStock);
  const adjustStock = withConfirmation("Salvar a baixa deste pacote?", data.adjustStock);
  const deleteStock = data.deleteStock;
  const saveProduction = withConfirmation(
    "Salvar a produção? O estoque será consumido.",
    data.saveProduction,
  );
  const saveChanges = async () => {
    const error = validateRecipeDrafts(Object.values(drafts.recipes).map((edit) => edit.recipe));
    if (error) {
      toast.error(error);
      throw new SaveCancelledError();
    }
    await confirmSave("Salvar as alterações desta tela?");
    await data.saveChanges();
  };
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
  const confirmedCommit = async (message: string, changes: ChangeSet) => {
    try {
      const error = validateRecipeDrafts(Object.values(drafts.recipes).map((edit) => edit.recipe));
      if (error) {
        toast.error(error);
        return false;
      }
      await confirmSave(isDirty() ? `${message} As alterações pendentes desta tela também serão salvas.` : message);
      await commitChange(changes);
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
  const selectedProductionId = useMatch(paths.productionPattern)?.params.productionId;
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  /** Server record with this screen's unsaved edits applied. */
  const withDraft = {
    market: <T extends MarketItem>(item: T): T => ({ ...item, ...drafts.market[item.id] }),
    /** Recipe metadata with pending changes; the ingredient count accounts for created and removed rows. */
    recipe: (recipe: RecipeListItem): RecipeListItem => recipeEdits.editedRecipe(drafts.recipes, recipe),
    /** One page of saved ingredients with pending edits; rows created on this screen come first. */
    ingredients: (recipeId: string, page: Ingredient[]): Ingredient[] =>
      recipeEdits.editedIngredients(drafts.recipes, recipeId, page),
    production: (production: Production): Production => drafts.productions[production.id] ?? production,
  };

  // Always reads the latest pending edits, so changes made on different ingredient pages merge into one edit.
  const changeRecipe = (recipe: RecipeListItem, change: (edit: RecipeEdit) => RecipeEdit) =>
    stage("recipes", change(recipeEdits.startEdit(data.latestDrafts().recipes, recipe)));
  const updateRecipe = (recipe: RecipeListItem, patch: Omit<Partial<Recipe>, "ingredients" | "id">) =>
    changeRecipe(recipe, (edit) => recipeEdits.editRecipe(edit, patch));
  const updateMarket = (item: MarketItem, patch: Partial<MarketItem>) => {
    if (patch.unit !== undefined && item.hasStockHistory) {
      toast.error("Cadastre outro insumo para usar uma unidade diferente.");
      return;
    }
    const { hasStockHistory, ...current } = withDraft.market(item);
    void hasStockHistory;
    stage("market", { ...current, ...patch });
  };
  /** Upserts one displayed ingredient row (saved or created) into the recipe's pending edit. */
  const updateIngredient = (recipe: RecipeListItem, ingredient: Ingredient, patch: Partial<Omit<Ingredient, "id">>) =>
    changeRecipe(recipe, (edit) => recipeEdits.upsertIngredient(edit, ingredient, patch));
  const registerRecipe = async (draft: RecipeDraft) => {
    const recipe: Recipe = {
      ...draft,
      id: makeId(),
      ingredients: draft.ingredients.map((ingredient) => ({ ...ingredient, id: makeId() })),
    };
    const error = validateRecipeDrafts([recipe]);
    if (error) {
      toast.error(error);
      return false;
    }
    const saved = await confirmedCommit("Salvar o cadastro desta receita?", { recipes: [recipe] });
    if (!saved) return false;
    navigate(paths.recipe(recipe.id));
    toast.success("Receita cadastrada.");
    return true;
  };
  const addMarketItem = (draft: Pick<MarketItem, "name" | "unit">) => {
    stage("market", { ...draft, id: makeId() }, true);
    toast.info("Insumo adicionado. Clique em “Salvar alterações” para gravar.");
  };
  /** Adds an empty row; the remote selector picks the item and validation rejects empty rows. */
  const addIngredient = (recipe: RecipeListItem) => changeRecipe(recipe, (edit) => recipeEdits.addIngredient(edit, makeId()));
  const createProduction = async (draft: Omit<Production, "id">) => {
    const production: Production = { ...draft, id: makeId() };
    await saveProduction(production);
    return production;
  };
  const updateProduction = (production: Production, patch: Partial<Production>, stats: ProductionSalesStats) => {
    const current = withDraft.production(production);
    const error = validateProductionUpdate(current, patch, stats);
    if (error) {
      toast.error(error);
      return;
    }
    stage("productions", { ...current, ...patch });
  };

  const loadSaleTarget = async (productionId: string): Promise<SaleTarget | null> => {
    const balance = await queryService.balance(productionId);
    return balance && { production: balance as CalculatedProduction, soldPackages: balance.soldPackages };
  };

  const saveSale = async (draft: SaleDraft): Promise<string | undefined | null> => {
    let result;
    try {
      const [target, existing] = await Promise.all([
        loadSaleTarget(draft.productionId),
        draft.id ? queryService.sale(draft.id) : Promise.resolve(null),
      ]);
      const ownPackages = existing && existing.productionId === draft.productionId ? existing.packages : 0;
      result = prepareSale(draft, target?.production, (target?.soldPackages ?? 0) - ownPackages, existing);
    } catch (error) {
      return getApiErrorMessage(error, "Não foi possível conferir o saldo da produção.");
    }
    if (result.error !== undefined) return result.error;
    const saved = await confirmedCommit(draft.id ? "Salvar as alterações desta venda?" : "Salvar o registro desta venda?",
      { sales: [result.sale] });
    return saved ? undefined : null;
  };
  const saveSales = async (saleDrafts: SaleDraft[]): Promise<string | undefined | null> => {
    let result;
    try {
      const ids = [...new Set(saleDrafts.map((draft) => draft.productionId))];
      const targets = (await Promise.all(ids.map(loadSaleTarget))).filter((target) => target !== null);
      result = prepareSales(saleDrafts, targets);
    } catch (error) {
      return getApiErrorMessage(error, "Não foi possível conferir o saldo das produções.");
    }
    if (result.error !== undefined) return result.error;
    const saved = await confirmedCommit(`Salvar o registro de ${saleDrafts.length} venda(s) do carrinho?`,
      { sales: result.sales });
    return saved ? undefined : null;
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      if (target.kind === "recipe" || target.kind === "production" || target.kind === "sale") {
        if (target.kind === "production") {
          const linked = await queryService.sales({ page: 1, pageSize: 10, productionId: target.id });
          if (linked.totalCount > 0) {
            toast.error("Esta produção possui vendas. Exclua as vendas vinculadas antes de removê-la.");
            setPendingDelete(null);
            return;
          }
        }
        // The delete dialog is the confirmation; the removal is saved immediately.
        await commitChange({
          deleted: {
            recipes: target.kind === "recipe" ? [target.id] : [],
            productions: target.kind === "production" ? [target.id] : [],
            sales: target.kind === "sale" ? [target.id] : [],
          },
        });
        if (target.kind === "recipe" && selectedRecipeId === target.id) navigate(paths.recipes, { replace: true });
        if (target.kind === "production" && selectedProductionId === target.id) navigate(paths.productions, { replace: true });
      } else if (target.kind === "market") {
        if (target.hasStockHistory) {
          toast.error("Um insumo com histórico de estoque não pode ser excluído.");
          setPendingDelete(null);
          return;
        }
        stageMarketDelete(target.id);
      } else {
        const pending = data.latestDrafts().recipes[target.recipeId];
        const recipe = pending ? recipeEdits.editedRecipe({}, { ...pending.recipe, ingredientCount: 0 })
          : await queryService.recipeMetadata(target.recipeId);
        if (!recipe) throw new Error("Esta receita não está mais disponível.");
        // Only saved ingredients are sent as explicit deletions; unsaved rows are simply dropped.
        changeRecipe(recipe, (edit) => recipeEdits.removeIngredient(edit, target.id));
      }
    } catch (error) {
      // Save failures were already reported by the workspace.
      if (target.kind === "market" || target.kind === "ingredient")
        toast.error(getApiErrorMessage(error, "Não foi possível remover o item."));
      setPendingDelete(null);
      return;
    }
    const deletedLabels = {
      recipe: "Receita excluída.",
      production: "Produção excluída.",
      sale: "Venda excluída. Os pacotes voltaram ao saldo disponível.",
      market: "Insumo removido. Clique em “Salvar alterações” para gravar.",
      ingredient: "Ingrediente removido. Clique em “Salvar alterações” para gravar.",
    } as const;
    toast.success(deletedLabels[target.kind]);
    setPendingDelete(null);
  };

  /** Export is an explicit bulk operation: it is the only screen action that reads every record. */
  const exportWorkbook = async () => {
    try {
      const all = await data.loadAll();
      const { exportWorkbook: exportWorkbookFile } = await import("../services/workbook");
      await exportWorkbookFile(all);
      toast.success("Planilha exportada para conta-de-chef.xlsx.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível exportar a planilha."));
    }
  };

  /** Import reads the current records in bulk to merge by name and saves only what changed. */
  const importWorkbook = async (file: File) => {
    try {
      const { importWorkbook: importWorkbookFile } = await import("../services/workbook");
      const imported = await importWorkbookFile(file);
      const { market, recipes } = await data.loadAll();
      const idMap = new Map<string, string>();
      const changedMarket: MarketItem[] = [];
      for (const item of imported.market) {
        const existing = market.find((entry) => normalize(entry.name) === normalize(item.name));
        if (existing) {
          if (existing.hasStockHistory && existing.unit !== item.unit)
            throw new Error(`O insumo "${existing.name}" tem estoque e não pode mudar de unidade.`);
          idMap.set(item.id, existing.id);
          if (existing.name !== item.name || existing.unit !== item.unit)
            changedMarket.push({ id: existing.id, name: item.name, unit: item.unit });
        } else {
          idMap.set(item.id, item.id);
          changedMarket.push({ id: item.id, name: item.name, unit: item.unit });
        }
      }
      const changedRecipes = imported.recipes.map((recipe) => {
        const existing = recipes.find((entry) => normalize(entry.name) === normalize(recipe.name));
        return {
          ...recipe, id: existing?.id ?? recipe.id,
          ingredients: recipe.ingredients.map((ingredient) => ({
            ...ingredient, marketItemId: idMap.get(ingredient.marketItemId) ?? ingredient.marketItemId,
          })),
        };
      });
      const saved = await confirmedCommit("Salvar os dados importados da planilha?", {
        market: changedMarket, recipes: changedRecipes,
      });
      if (saved)
        toast.success(`Planilha importada: ${imported.market.length} insumos e ${imported.recipes.length} receitas.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível importar a planilha."));
    }
  };

  return {
    summary: data.summary,
    counts: data.summary?.counts ?? { market: 0, recipes: 0, productions: 0, sales: 0 },
    dataVersion: data.dataVersion,
    drafts,
    withDraft,
    apiStatus: data.apiStatus,
    isLoading: data.isLoading,
    addStock,
    updateStock,
    deleteStock,
    adjustStock,
    saveProduction,
    canManageStock: data.canManageStock,
    hasUnsavedChanges: data.hasUnsavedChanges,
    saveChanges,
    discardChanges,
    isDirty,
    leaveScreen,
    isLeavingBlocked: blocker.state === "blocked",
    pendingSaveMessage: pendingSave?.message ?? null,
    resolvePendingSave,
    pendingDelete,
    setPendingDelete,
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
