import BackButton from "../../../components/ui/BackButton";
import EmptyState from "../../../components/ui/EmptyState";
import Icon from "../../../components/ui/Icon";
import IconButton from "../../../components/ui/IconButton";
import PageHeader from "../../../components/ui/PageHeader";
import Panel from "../../../components/ui/Panel";
import RecipeFields from "../../../components/recipes/RecipeFields";
import RecipeIngredientsEditor from "../../../components/recipes/RecipeIngredientsEditor";
import type { Ingredient, Recipe, RecipeListItem } from "../../../domain/models";
import type { ListControls } from "../../../hooks/usePagedQuery";
import type { PendingDelete } from "../../../types/navigation";
import styles from "./styles.module.scss";

type Props = Partial<ListControls> & {
  /** Recipe metadata; ingredients come one page at a time in `ingredients`. */
  recipe?: RecipeListItem;
  /** Current page of ingredients with pending edits; rows created on this screen come first. */
  ingredients: Ingredient[];
  /** Market items used by the loaded and edited rows. */
  selectedIds?: string[];
  hasEmptyRow?: boolean;
  search?: string;
  onSearch?: (search: string) => void;
  marketCount: number;
  version?: number;
  updateRecipe: (patch: Omit<Partial<Recipe>, "ingredients">) => void;
  updateIngredient: (ingredient: Ingredient, patch: Partial<Omit<Ingredient, "id">>) => void;
  addIngredient: () => void;
  onRequestDelete: (target: PendingDelete) => void;
  onBack: () => void;
};

const noPaging: ListControls = {
  pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 0, busy: false, onPageChange: () => {}, onPageSizeChange: () => {} },
  serverSort: { columns: {}, descending: false, onSort: () => {} },
  status: "ready",
};

export default function RecipeDetailPage({
  recipe, ingredients, selectedIds, hasEmptyRow, search, onSearch, marketCount, version,
  updateRecipe, updateIngredient, addIngredient, onRequestDelete, onBack,
  pagination = noPaging.pagination, serverSort = noPaging.serverSort, status = noPaging.status,
}: Props) {
  return <>
    <BackButton onClick={onBack}>Voltar para receitas</BackButton>
    <PageHeader title={recipe?.name || "Receita sem nome"} eyebrow="FICHAS TÉCNICAS" eyebrowDot />
    {recipe ? <Panel title="Ficha técnica" action={
      <IconButton danger aria-label="Excluir receita" title="Excluir receita"
        onClick={() => onRequestDelete({ kind: "recipe", id: recipe.id, label: recipe.name || "Receita sem nome" })}>
        <Icon name="trash" size={17} />
      </IconButton>
    }>
      <RecipeFields value={recipe} onChange={updateRecipe} />
      <RecipeIngredientsEditor rows={ingredients} totalCount={recipe.ingredientCount} marketCount={marketCount}
        selectedIds={selectedIds ?? ingredients.map((ingredient) => ingredient.marketItemId).filter(Boolean)}
        hasEmptyRow={hasEmptyRow ?? ingredients.some((ingredient) => !ingredient.marketItemId)}
        pagination={pagination} serverSort={serverSort} status={status} search={search} onSearch={onSearch}
        version={version} onAdd={addIngredient}
        onChange={(index, patch) => updateIngredient(ingredients[index], patch)}
        onRemove={(index, name) => onRequestDelete({ kind: "ingredient", recipeId: recipe.id, id: ingredients[index].id, label: name })} />
      <p className={styles["formula-note"]}>
        Os ingredientes e quantidades formam a ficha de um lote. Os parâmetros de fabricação e resultados ficam registrados
        separadamente em Produção. O custo usa os lotes efetivamente consumidos do estoque.
      </p>
    </Panel> : <EmptyState variant="editor" title="Nenhuma receita cadastrada" icon={<Icon name="recipe" size={28} />}>
      <p>Cadastre uma receita para criar sua primeira ficha técnica.</p>
    </EmptyState>}
  </>;
}
