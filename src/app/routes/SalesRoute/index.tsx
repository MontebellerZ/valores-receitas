import { useState } from "react";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import SalesPage from "../../../pages/sales/SalesPage";
import NotFoundPage from "../../../pages/not-found/NotFoundPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { listControls, usePagedQuery } from "../../../hooks/usePagedQuery";
import { useResource } from "../../../hooks/useResource";
import { queryService } from "../../../services/query";
import { balanceSortColumns, salesSortColumns } from "../../../domain/sortColumns";
import { paths } from "../../paths";
import SaleForm from "../../../components/sales/SaleForm";

/** Most recent production that still has packages to sell. */
const loadFirstAvailable = async (_scope: string, signal: AbortSignal) =>
  (await queryService.balances({ available: true, page: 1, pageSize: 10, sortBy: "date", descending: true }, signal)).items[0] ?? null;

export default function SalesRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  const { saleId } = useParams();
  const isNewRoute = useMatch(paths.saleNew) !== null;
  const [isCreating, setIsCreating] = useState(false);
  const [productionFilter, setProductionFilter] = useState<{ id: string; label?: string }>({ id: "" });
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const creating = (isCreating || isNewRoute) && !saleId;

  const balances = usePagedQuery({
    fetcher: queryService.balances, version: workspace.dataVersion,
    defaultSort: { sortBy: "date", descending: true }, errorMessage: "Não foi possível carregar o saldo das produções.",
  });
  const sales = usePagedQuery({
    fetcher: queryService.sales, filters: { productionId: productionFilter.id || undefined, search: debounced },
    version: workspace.dataVersion, defaultSort: { sortBy: "date", descending: true },
    errorMessage: "Não foi possível carregar as vendas.",
  });
  const editing = useResource(queryService.sale, saleId, 0, "Não foi possível carregar a venda.");
  const editingBalance = useResource(queryService.balance, editing.data?.productionId, 0,
    "Não foi possível carregar o saldo da produção desta venda.");
  const firstAvailable = useResource(loadFirstAvailable, creating ? "first-available" : undefined, workspace.dataVersion,
    "Não foi possível carregar as produções disponíveis.");

  if (saleId && editing.status === "missing")
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
  const editingReady = editing.status === "ready" && editingBalance.status !== "loading";
  return (
    <>
      <SalesPage
        summary={workspace.summary}
        balances={{ ...listControls(balances, balanceSortColumns), items: balances.items }}
        sales={{ ...listControls(sales, salesSortColumns), items: sales.items }}
        productionFilter={productionFilter}
        onProductionFilter={(id, label) => setProductionFilter({ id, label })}
        search={search}
        onSearch={setSearch}
        version={workspace.dataVersion}
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
      {saleId && editing.status === "loading" && <div role="status">Carregando venda...</div>}
      {saleId && editing.status === "error" && <p role="alert">Não foi possível carregar a venda. Recarregue a página.</p>}
      {creating && firstAvailable.status === "loading" && <div role="status">Carregando produções disponíveis...</div>}
      {creating && firstAvailable.status !== "loading" && (
        <SaleForm
          key="new-sale"
          initialBalance={firstAvailable.data}
          totalAvailable={workspace.summary?.availablePackages ?? 0}
          onSave={workspace.saveSale}
          onSaveSales={workspace.saveSales}
          isModal
          onCancel={closeCreate}
        />
      )}
      {editingReady && editing.data && (
        <SaleForm
          key={editing.data.id}
          initialBalance={editingBalance.data}
          totalAvailable={workspace.summary?.availablePackages ?? 0}
          sale={editing.data}
          onSave={workspace.saveSale}
          onSaveSales={workspace.saveSales}
          isModal
          onCancel={() => navigate(paths.sales)}
        />
      )}
    </>
  );
}
