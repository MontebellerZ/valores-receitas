import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductionsPage from "../../../pages/production/ProductionsPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { calculateProduction } from "../../../domain/calculations";
import { queryService } from "../../../services/query";
import { paths } from "../../paths";

const loadFirstRecipe = async () =>
  (await queryService.recipes({ page: 1, pageSize: 10, sortBy: "name", descending: false })).items[0];

export default function ProductionsRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const query = usePagedQuery({
    fetcher: queryService.productions, filters: { search: debounced }, version: workspace.dataVersion,
    defaultSort: { sortBy: "date", descending: true }, errorMessage: "Não foi possível carregar as produções.",
  });
  const { pagination, status } = listControls(query);
  return (
    <ProductionsPage
      productions={query.items.map((production) => calculateProduction(workspace.withDraft.production(production)))}
      totalCount={workspace.counts.productions}
      recipeCount={workspace.counts.recipes}
      search={search}
      onSearch={setSearch}
      loadFirstRecipe={loadFirstRecipe}
      pagination={pagination}
      status={status}
      onCreate={async (production) => {
        const created = await workspace.createProduction(production);
        navigate(paths.production(created.id));
        return created;
      }}
      onView={(id) => navigate(paths.production(id))}
      onViewRecipes={() => navigate(paths.recipes)}
    />
  );
}
