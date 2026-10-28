import { useNavigate, useParams } from "react-router-dom";
import ProductionDetailPage from "../../../pages/production/ProductionDetailPage";
import NotFoundPage from "../../../pages/not-found/NotFoundPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useProductionConsumptions } from "../../../hooks/useProductionConsumptions";
import { paths } from "../../paths";

export default function ProductionDetailRoute() {
  const workspace = useWorkspaceContext();
  const { productionId } = useParams();
  const navigate = useNavigate();
  const production = workspace.productions.find(
    (entry) => entry.id === productionId,
  );
  const consumption = useProductionConsumptions(productionId, production?.totalCost);
  if (workspace.isLoading)
    return <div role="status">Carregando produção...</div>;
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
      recipes={workspace.recipes}
      sales={workspace.sales}
      updateProduction={workspace.updateProduction}
      saveProduction={workspace.saveProduction}
      {...consumption}
      onRequestDelete={workspace.setPendingDelete}
      onBack={() => navigate(paths.productions)}
      onViewSales={() => navigate(paths.sales)}
    />
  );
}
