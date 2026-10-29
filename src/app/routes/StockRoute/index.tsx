import { useState } from "react";
import StockPage from "../../../pages/stock/StockPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { stockSortColumns } from "../../../domain/sortColumns";
import { queryService } from "../../../services/query";

const loadPurchase = async (entryOrder: number) => {
  const { lots, totalCount } = await queryService.purchaseLots(entryOrder);
  if (totalCount > lots.length) throw new Error("A compra tem mais de 1.000 pacotes.");
  return lots;
};

export default function StockRoute() {
  const workspace = useWorkspaceContext();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const debounced = useDebouncedValue(search.trim());
  const filters = { search: debounced, includeInactive: showInactive };
  const lots = usePagedQuery({
    fetcher: queryService.stock, filters, version: workspace.dataVersion,
    defaultSort: { sortBy: "entryOrder", descending: true }, errorMessage: "Não foi possível carregar o estoque.",
  });
  const totals = usePagedQuery({
    fetcher: queryService.stockTotals, filters, version: workspace.dataVersion,
    defaultSort: { sortBy: "name", descending: false }, errorMessage: "Não foi possível carregar os saldos do estoque.",
  });
  const totalControls = listControls(totals);
  return <StockPage
    lots={{ ...listControls(lots, stockSortColumns), items: lots.items }}
    totals={{ pagination: totalControls.pagination, status: totalControls.status, items: totals.items }}
    marketCount={workspace.counts.market}
    search={search} onSearch={setSearch}
    showInactive={showInactive} onShowInactive={setShowInactive}
    loadPurchase={loadPurchase}
    addStock={workspace.addStock} adjustStock={workspace.adjustStock} updateStock={workspace.updateStock}
    deleteStock={workspace.deleteStock}
    disabled={!workspace.canManageStock} />;
}
