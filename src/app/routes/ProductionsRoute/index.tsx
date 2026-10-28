import { useNavigate } from "react-router-dom";
import ProductionsPage from "../../../pages/production/ProductionsPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { paths } from "../../paths";

export default function ProductionsRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  return (
    <ProductionsPage
      productions={workspace.calculated}
      recipes={workspace.recipes}
      onCreate={async (production) => {
        const created = await workspace.createProduction(production);
        navigate(paths.production(created.id));
        return created;
      }}
      onView={(id) => navigate(paths.production(id))}
      onViewRecipes={() => navigate(paths.recipes)}
    />
  );
}
