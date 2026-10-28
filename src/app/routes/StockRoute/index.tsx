import StockPage from "../../../pages/stock/StockPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";

export default function StockRoute() {
  const workspace = useWorkspaceContext();
  return <StockPage market={workspace.market} stock={workspace.stock}
    addStock={workspace.addStock} adjustStock={workspace.adjustStock} updateStock={workspace.updateStock}
    deleteStock={workspace.deleteStock}
    disabled={!workspace.canManageStock} />;
}
