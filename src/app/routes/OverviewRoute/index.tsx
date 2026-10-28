import { useNavigate } from "react-router-dom";
import OverviewPage from "../../../pages/overview/OverviewPage";
import ImportWorkbookButton from "../../../components/workbook/ImportWorkbookButton";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { paths } from "../../paths";

export default function OverviewRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  return (
    <OverviewPage
      productions={workspace.calculated}
      sales={workspace.sales}
      recipeCount={workspace.recipes.length}
      marketCount={workspace.market.length}
      onViewSales={() => navigate(paths.sales)}
      onViewProduction={(id) =>
        navigate(id ? paths.production(id) : paths.productions)
      }
      importAction={
        <ImportWorkbookButton onImport={workspace.importWorkbook} />
      }
    />
  );
}
