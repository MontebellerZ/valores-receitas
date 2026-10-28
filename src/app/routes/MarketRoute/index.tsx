import MarketPage from "../../../pages/market/MarketPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";

export default function MarketRoute() {
  const workspace = useWorkspaceContext();
  return (
    <MarketPage
      market={workspace.market}
      recipes={workspace.recipes}
      updateMarket={workspace.updateMarket}
      addMarketItem={workspace.addMarketItem}
      onRequestDelete={workspace.setPendingDelete}
    />
  );
}
