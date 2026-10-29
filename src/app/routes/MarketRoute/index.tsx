import { useState } from "react";
import MarketPage from "../../../pages/market/MarketPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { marketSortColumns } from "../../../domain/sortColumns";
import { queryService } from "../../../services/query";

export default function MarketRoute() {
  const workspace = useWorkspaceContext();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const query = usePagedQuery({
    fetcher: queryService.market, filters: { search: debounced }, version: workspace.dataVersion,
    defaultSort: { sortBy: "name", descending: false }, errorMessage: "Não foi possível carregar os insumos.",
  });
  const { drafts } = workspace;
  const deleted = new Set(drafts.deletedMarket);
  const created = drafts.createdMarket.flatMap((id) => drafts.market[id]
    ? [{ ...drafts.market[id], hasStockHistory: false, ingredientCount: 0 }] : []);
  const items = query.items.filter((item) => !deleted.has(item.id)).map(workspace.withDraft.market);
  return (
    <MarketPage
      {...listControls(query, marketSortColumns)}
      items={items}
      created={created}
      totalCount={workspace.counts.market}
      search={search}
      onSearch={setSearch}
      updateMarket={workspace.updateMarket}
      addMarketItem={workspace.addMarketItem}
      onRequestDelete={workspace.setPendingDelete}
    />
  );
}
