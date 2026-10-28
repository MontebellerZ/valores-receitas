import BackButton from "../../../components/ui/BackButton";
import EmptyState from "../../../components/ui/EmptyState";
import Icon from "../../../components/ui/Icon";
import IconButton from "../../../components/ui/IconButton";
import PageHeader from "../../../components/ui/PageHeader";
import Panel from "../../../components/ui/Panel";
import RecipeFields from "../../../components/recipes/RecipeFields";
import RecipeIngredientsEditor from "../../../components/recipes/RecipeIngredientsEditor";
import type { Ingredient, MarketItem, Recipe } from "../../../domain/models";
import type { PendingDelete } from "../../../types/navigation";
import styles from "./styles.module.scss";

type Props = {
  recipe?: Recipe;
  market: MarketItem[];
  updateRecipe: (id: string, patch: Partial<Recipe>) => void;
  updateIngredient: (recipeId: string, id: string, patch: Partial<Ingredient>) => void;
  addIngredient: () => void;
  onRequestDelete: (target: PendingDelete) => void;
  onBack: () => void;
};

export default function RecipeDetailPage({ recipe, market, updateRecipe, updateIngredient, addIngredient, onRequestDelete, onBack }: Props) {
  return <>
    <BackButton onClick={onBack}>Voltar para receitas</BackButton>
    <PageHeader title={recipe?.name || "Receita sem nome"} eyebrow="FICHAS TÉCNICAS" eyebrowDot />
    {recipe ? <Panel title="Ficha técnica" action={
      <IconButton danger aria-label="Excluir receita" title="Excluir receita"
        onClick={() => onRequestDelete({ kind: "recipe", id: recipe.id, label: recipe.name || "Receita sem nome" })}>
        <Icon name="trash" size={17} />
      </IconButton>
    }>
      <RecipeFields value={recipe} onChange={(patch) => updateRecipe(recipe.id, patch)} />
      <RecipeIngredientsEditor ingredients={recipe.ingredients} market={market} onAdd={addIngredient}
        onChange={(index, patch) => updateIngredient(recipe.id, recipe.ingredients[index].id, patch)}
        onRemove={(index) => {
          const ingredient = recipe.ingredients[index];
          const item = market.find((entry) => entry.id === ingredient.marketItemId);
          onRequestDelete({ kind: "ingredient", recipeId: recipe.id, id: ingredient.id, label: item?.name || "Ingrediente" });
        }} />
      <p className={styles["formula-note"]}>
        Os ingredientes e quantidades formam a ficha de um lote. Os parâmetros de fabricação e resultados ficam registrados
        separadamente em Produção. O custo usa os lotes efetivamente consumidos do estoque.
      </p>
    </Panel> : <EmptyState variant="editor" title="Nenhuma receita cadastrada" icon={<Icon name="recipe" size={28} />}>
      <p>Cadastre uma receita para criar sua primeira ficha técnica.</p>
    </EmptyState>}
  </>;
}
