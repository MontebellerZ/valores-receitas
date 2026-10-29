import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProductionDetailPage from "../../../pages/production/ProductionDetailPage";
import NotFoundPage from "../../../pages/not-found/NotFoundPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useResource } from "../../../hooks/useResource";
import { useProductionReport } from "../../../hooks/useProductionReport";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { queryService, type ListRequest } from "../../../services/query";
import { realizedSalesSortColumns, consumptionSortColumns } from "../../../domain/sortColumns";
import { paths } from "../../paths";

const loadRecipeSummary = async (id: string, signal: AbortSignal) =>
  (await queryService.recipesByIds([id], signal))[0] ?? null;

export default function ProductionDetailRoute() {
  const workspace = useWorkspaceContext();
  const { productionId } = useParams();
  const navigate = useNavigate();
  const resource = useResource(queryService.production, productionId, workspace.dataVersion,
    "Não foi possível carregar a produção.");
  const production = resource.data && workspace.withDraft.production(resource.data);
  const saved = Boolean(production && production.quantity > 0);
  const recipe = useResource(loadRecipeSummary, production?.recipeId, 0, "Não foi possível carregar a receita da produção.");
  const report = useProductionReport(saved ? productionId : undefined, workspace.dataVersion);
  const fetchSales = useCallback((request: ListRequest, signal: AbortSignal) =>
    queryService.productionSales(productionId ?? "", request, signal), [productionId]);
  const sales = usePagedQuery({
    fetcher: fetchSales, enabled: saved, version: workspace.dataVersion,
    defaultSort: { sortBy: "date", descending: false }, errorMessage: "Não foi possível carregar as vendas da produção.",
  });
  const fetchConsumptions = useCallback((request: ListRequest, signal: AbortSignal) =>
    queryService.consumptions(productionId ?? "", request, signal), [productionId]);
  const consumptions = usePagedQuery({
    fetcher: fetchConsumptions, enabled: saved && !production?.isStandalone, version: workspace.dataVersion,
    defaultSort: { sortBy: "entryDate", descending: false }, errorMessage: "Não foi possível carregar os lotes consumidos.",
  });
  if (resource.status === "loading")
    return <div role="status">Carregando produção...</div>;
  if (resource.status === "error")
    return <p role="alert">Não foi possível carregar a produção. Recarregue a página.</p>;
  if (!production)
    return (
      <NotFoundPage
        title="Produção não encontrada"
        backTo={paths.productions}
        backLabel="Voltar para produção"
      />
    );
  return (
    <ProductionDetailPage
      key={production.id}
      production={production}
      shelfLifeDays={recipe.data?.shelfLifeDays}
      report={{ data: report.report, status: report.status, pagination: report.pagination }}
      sales={{ ...listControls(sales, realizedSalesSortColumns), items: sales.items }}
      consumptions={{ ...listControls(consumptions, consumptionSortColumns), items: consumptions.items }}
      updateProduction={(patch, stats) => workspace.updateProduction(production, patch, stats)}
      saveProduction={workspace.saveProduction}
      onRequestDelete={workspace.setPendingDelete}
      onBack={() => navigate(paths.productions)}
      onViewSales={() => navigate(paths.sales)}
    />
  );
}
