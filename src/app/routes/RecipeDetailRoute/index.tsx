import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RecipeDetailPage from "../../../pages/recipes/RecipeDetailPage";
import NotFoundPage from "../../../pages/not-found/NotFoundPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useResource } from "../../../hooks/useResource";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { queryService, type ListRequest } from "../../../services/query";
import { paths } from "../../paths";
import { recipeIngredientSortColumns } from "../../../domain/sortColumns";

/** Recipe metadata plus its ingredients paged on the server; edits are kept as deltas until saved. */
export default function RecipeDetailRoute() {
  const workspace = useWorkspaceContext();
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const resource = useResource(queryService.recipeMetadata, recipeId, workspace.dataVersion, "Não foi possível carregar a receita.");
  const fetcher = useCallback((request: ListRequest, signal: AbortSignal) =>
    queryService.recipeIngredients(recipeId ?? "", request, signal), [recipeId]);
  const query = usePagedQuery({
    fetcher, filters: { search: debounced }, version: workspace.dataVersion,
    enabled: resource.status === "ready", errorMessage: "Não foi possível carregar os ingredientes.",
  });
  if (resource.status === "loading")
    return <div role="status">Carregando receita...</div>;
  if (resource.status === "error")
    return <div role="alert">Não foi possível carregar a receita. Recarregue a página para tentar novamente.</div>;
  if (resource.status === "missing")
    return (
      <NotFoundPage
        title="Receita não encontrada"
        backTo={paths.recipes}
        backLabel="Voltar para receitas"
      />
    );
  const saved = resource.data;
  const edit = workspace.drafts.recipes[saved.id];
  const ingredients = workspace.withDraft.ingredients(saved.id, query.items);
  return (
    <RecipeDetailPage
      recipe={workspace.withDraft.recipe(saved)}
      ingredients={ingredients}
      selectedIds={[...ingredients, ...edit?.recipe.ingredients ?? []].map((ingredient) => ingredient.marketItemId).filter(Boolean)}
      hasEmptyRow={edit?.recipe.ingredients.some((ingredient) => !ingredient.marketItemId) ?? false}
      search={search}
      onSearch={setSearch}
      {...listControls(query, recipeIngredientSortColumns)}
      marketCount={workspace.counts.market}
      version={workspace.dataVersion}
      updateRecipe={(patch) => workspace.updateRecipe(saved, patch)}
      updateIngredient={(ingredient, patch) => workspace.updateIngredient(saved, ingredient, patch)}
      addIngredient={() => workspace.addIngredient(saved)}
      onRequestDelete={workspace.setPendingDelete}
      onBack={() => navigate(paths.recipes)}
    />
  );
}
