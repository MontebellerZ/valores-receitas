import { useState } from "react";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import SalesPage from "../../../pages/sales/SalesPage";
import NotFoundPage from "../../../pages/not-found/NotFoundPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { paths } from "../../paths";
import SaleForm from "../../../components/sales/SaleForm";

export default function SalesRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  const { saleId } = useParams();
  const isNewRoute = useMatch(paths.saleNew) !== null;
  const [isCreating, setIsCreating] = useState(false);
  const editingSale = saleId ? workspace.sales.find((entry) => entry.id === saleId) : undefined;
  if (saleId && !editingSale && !workspace.isLoading)
    return (
      <NotFoundPage
        title="Venda não encontrada"
        backTo={paths.sales}
        backLabel="Voltar para vendas"
      />
    );
  const closeCreate = () => {
    setIsCreating(false);
    if (isNewRoute) navigate(paths.sales);
  };
  return (
    <>
      <SalesPage
        productions={workspace.calculated}
        sales={workspace.sales}
        onCreate={() => setIsCreating(true)}
        onEdit={(sale) => navigate(paths.saleEdit(sale.id))}
        onDelete={(sale) =>
          workspace.setPendingDelete({
            kind: "sale",
            id: sale.id,
            label: `${sale.recipeName} — ${sale.date}`,
          })
        }
        onViewProduction={(id) =>
          navigate(id ? paths.production(id) : paths.productions)
        }
      />
      {(isCreating || isNewRoute) && !editingSale && (
        <SaleForm
          key="new-sale"
          productions={workspace.calculated}
          sales={workspace.sales}
          onSave={workspace.saveSale}
          onSaveSales={workspace.saveSales}
          isModal
          onCancel={closeCreate}
        />
      )}
      {editingSale && (
        <SaleForm
          key={editingSale.id}
          productions={workspace.calculated}
          sales={workspace.sales}
          sale={editingSale}
          onSave={workspace.saveSale}
          onSaveSales={workspace.saveSales}
          isModal
          onCancel={() => navigate(paths.sales)}
        />
      )}
    </>
  );
}
