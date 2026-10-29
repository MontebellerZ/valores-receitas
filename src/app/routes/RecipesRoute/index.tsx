import { useState } from "react";
import { useNavigate } from "react-router-dom";
import RecipesPage from "../../../pages/recipes/RecipesPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { queryService } from "../../../services/query";
import { paths } from "../../paths";

export default function RecipesRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const query = usePagedQuery({
    fetcher: queryService.recipes, filters: { search: debounced }, version: workspace.dataVersion,
    defaultSort: { sortBy: "name", descending: false }, errorMessage: "Não foi possível carregar as receitas.",
  });
  const { pagination, status } = listControls(query);
  return (
    <RecipesPage
      recipes={query.items.map(workspace.withDraft.recipe)}
      totalCount={workspace.counts.recipes}
      marketCount={workspace.counts.market}
      search={search}
      onSearch={setSearch}
      pagination={pagination}
      status={status}
      onCreate={workspace.registerRecipe}
      onView={(id) => navigate(paths.recipe(id))}
    />
  );
}
