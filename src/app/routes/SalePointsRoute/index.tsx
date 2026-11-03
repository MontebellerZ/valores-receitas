import { useState } from "react";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { useSalePointData } from "../../../hooks/useSalePointData";
import SalePointsPage from "../../../pages/sale-points/SalePointsPage";
import { localToday } from "../../../utils/format";

export default function SalePointsRoute() {
  const workspace = useWorkspaceContext();
  const [range, setRange] = useState({ from: "", to: localToday() });
  const data = useSalePointData(workspace.dataVersion, { from: range.from || undefined, to: range.to || undefined });
  return <SalePointsPage {...data} range={range} onRangeChange={setRange}
    canManage={workspace.canManageSalePoints} onSave={workspace.saveSalePoint}
    onDelete={workspace.deleteSalePoint} onAllocate={workspace.allocateSalePoint} />;
}
