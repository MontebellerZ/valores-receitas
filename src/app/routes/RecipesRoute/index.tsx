import { useNavigate } from "react-router-dom";
import RecipesPage from "../../../pages/recipes/RecipesPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { paths } from "../../paths";

export default function RecipesRoute() {
  const workspace = useWorkspaceContext();
  const navigate = useNavigate();
  return (
    <RecipesPage
      recipes={workspace.recipes}
      market={workspace.market}
      onCreate={workspace.registerRecipe}
      onView={(id) => navigate(paths.recipe(id))}
    />
  );
}
