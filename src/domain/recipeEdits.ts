import type { Ingredient, Recipe, RecipeEdit, RecipeListItem, WorkspacePatch } from "./models";

/**
 * Pending edits of saved recipes, keyed by recipe id. Every change to one recipe, on any ingredient
 * page, is merged into the same edit so the save sends each recipe once with all its touched rows.
 */
export type RecipeEdits = Record<string, RecipeEdit>;

export function startEdit(edits: RecipeEdits, recipe: RecipeListItem): RecipeEdit {
  const existing = edits[recipe.id];
  if (existing) return existing;
  const { ingredientCount: _count, ...metadata } = recipe;
  void _count;
  return { recipe: { ...metadata, ingredients: [] }, deletedIngredients: [], createdIngredients: [] };
}

export function editRecipe(edit: RecipeEdit, patch: Omit<Partial<Recipe>, "ingredients" | "id">): RecipeEdit {
  return { ...edit, recipe: { ...edit.recipe, ...patch } };
}

/** Upserts one displayed row (saved or created), keeping the other touched rows. */
export function upsertIngredient(edit: RecipeEdit, ingredient: Ingredient, patch: Partial<Omit<Ingredient, "id">>): RecipeEdit {
  const current = edit.recipe.ingredients.find((entry) => entry.id === ingredient.id) ?? ingredient;
  return {
    ...edit,
    recipe: { ...edit.recipe, ingredients: [
      ...edit.recipe.ingredients.filter((entry) => entry.id !== ingredient.id), { ...current, ...patch },
    ] },
  };
}

export function addIngredient(edit: RecipeEdit, id: string): RecipeEdit {
  return {
    ...edit,
    recipe: { ...edit.recipe, ingredients: [...edit.recipe.ingredients, { id, marketItemId: "", quantity: 0 }] },
    createdIngredients: [id, ...edit.createdIngredients],
  };
}

/** Unsaved rows are dropped; saved rows become explicit deletions. */
export function removeIngredient(edit: RecipeEdit, id: string): RecipeEdit {
  const created = edit.createdIngredients.includes(id);
  return {
    recipe: { ...edit.recipe, ingredients: edit.recipe.ingredients.filter((ingredient) => ingredient.id !== id) },
    createdIngredients: edit.createdIngredients.filter((entry) => entry !== id),
    deletedIngredients: created || edit.deletedIngredients.includes(id) ? edit.deletedIngredients : [...edit.deletedIngredients, id],
  };
}

/** Recipe metadata with the pending edit; the count accounts for created and removed rows. */
export function editedRecipe(edits: RecipeEdits, recipe: RecipeListItem): RecipeListItem {
  const edit = edits[recipe.id];
  if (!edit) return recipe;
  return { ...edit.recipe, ingredients: [],
    ingredientCount: recipe.ingredientCount + edit.createdIngredients.length - edit.deletedIngredients.length };
}

/** One page of saved ingredients with the pending edit; rows created on this screen come first. */
export function editedIngredients(edits: RecipeEdits, recipeId: string, page: Ingredient[]): Ingredient[] {
  const edit = edits[recipeId];
  if (!edit) return page;
  const touched = new Map(edit.recipe.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return [
    ...edit.createdIngredients.flatMap((id) => touched.get(id) ?? []),
    ...page.filter((ingredient) => !edit.deletedIngredients.includes(ingredient.id))
      .map((ingredient) => touched.get(ingredient.id) ?? ingredient),
  ];
}

/**
 * Recipe part of PATCH /data. Partial edits send only touched rows with `partialRecipeIngredients`;
 * whole recipes (registration, import) replace the ingredient lists and cannot be mixed with them.
 */
export function recipePatch(edits: RecipeEdit[], whole: Recipe[] = []):
  Pick<WorkspacePatch, "recipes" | "partialRecipeIngredients" | "deletedIngredients"> {
  if (!edits.length) return { recipes: whole };
  if (whole.length) throw new Error("Salve ou descarte as alterações das receitas antes de continuar.");
  const byRecipe = new Map<string, RecipeEdit>();
  for (const edit of edits) {
    if (byRecipe.has(edit.recipe.id)) throw new Error("A mesma receita foi editada em duplicidade.");
    byRecipe.set(edit.recipe.id, edit);
  }
  return {
    recipes: edits.map((edit) => edit.recipe),
    partialRecipeIngredients: true,
    deletedIngredients: [...new Set(edits.flatMap((edit) => edit.deletedIngredients))],
  };
}
