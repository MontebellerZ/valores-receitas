import { useNavigate, useParams } from "react-router-dom";
import RecipeDetailPage from "../../../pages/recipes/RecipeDetailPage";
import NotFoundPage from "../../../pages/not-found/NotFoundPage";
import { useWorkspaceContext } from "../../../hooks/useWorkspaceContext";
import { paths } from "../../paths";

export default function RecipeDetailRoute() {
  const workspace = useWorkspaceContext();
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const recipe = workspace.recipes.find((entry) => entry.id === recipeId);
  if (workspace.isLoading)
    return <div role="status">Carregando receita...</div>;
  if (!recipe)
    return (
      <NotFoundPage
        title="Receita não encontrada"
        backTo={paths.recipes}
        backLabel="Voltar para receitas"
      />
    );
  return (
    <RecipeDetailPage
      recipe={recipe}
      market={workspace.market}
      updateRecipe={workspace.updateRecipe}
      updateIngredient={workspace.updateIngredient}
      addIngredient={workspace.addIngredient}
      onRequestDelete={workspace.setPendingDelete}
      onBack={() => navigate(paths.recipes)}
    />
  );
}
