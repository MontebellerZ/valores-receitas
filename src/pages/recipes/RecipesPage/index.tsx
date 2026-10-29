import { useState } from "react";
import { toast } from "react-toastify";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import FormActions from "../../../components/ui/FormActions";
import FormLayout from "../../../components/ui/FormLayout";
import Icon from "../../../components/ui/Icon";
import PageHeader from "../../../components/ui/PageHeader";
import RegistrationModal from "../../../components/ui/RegistrationModal";
import SummaryItem, { SummaryList } from "../../../components/ui/SummaryItem";
import RecipeFields from "../../../components/recipes/RecipeFields";
import RecipeIngredientsEditor from "../../../components/recipes/RecipeIngredientsEditor";
import Pagination from "../../../components/ui/Pagination";
import Panel from "../../../components/ui/Panel";
import SearchField from "../../../components/ui/SearchField";
import type { RecipeDraft, RecipeListItem } from "../../../domain/models";
import type { ListControls } from "../../../hooks/usePagedQuery";
import { useLocalIngredients } from "../../../hooks/useLocalIngredients";
import styles from "./styles.module.scss";
import { number } from "../../../utils/format";

type Props = Omit<ListControls, "serverSort"> & {
  recipes: RecipeListItem[];
  totalCount: number;
  marketCount: number;
  search: string;
  onSearch: (search: string) => void;
  onCreate: (draft: RecipeDraft) => Promise<boolean>;
  onView: (id: string) => void;
};

export default function RecipesPage({
  recipes, totalCount, marketCount, search, onSearch, onCreate, onView, pagination, status,
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft>({
    name: "", category: "", yield: 1, hoursPerBatch: 0, shelfLifeDays: null, ingredients: [],
  });
  const startCreating = () => {
    setDraft({
      name: "", category: "", yield: 1, hoursPerBatch: 0, shelfLifeDays: null,
      ingredients: marketCount ? [{ marketItemId: "", quantity: 0 }] : [],
    });
    setIsAdding(true);
  };
  const local = useLocalIngredients(draft.ingredients);
  const addIngredient = () => {
    setDraft({ ...draft, ingredients: [...draft.ingredients, { marketItemId: "", quantity: 0 }] });
    local.showLast(draft.ingredients.length + 1);
  };
  return <>
    <PageHeader title="Receitas" eyebrow="FICHAS TÉCNICAS" eyebrowDot
      description={`${totalCount} receitas cadastradas`}
      action={<Button onClick={startCreating}><Icon name="plus" size={17} /> Nova receita</Button>} />
    <Panel title="Fichas técnicas" action={<SearchField aria-label="Buscar receita" placeholder="Buscar receita..."
      value={search} onChange={(event) => onSearch(event.target.value)} className={styles.search} />}>
    <SummaryList aria-label="Lista de receitas">
      {recipes.map((recipe) => <SummaryItem key={recipe.id} name={recipe.name}
        title={recipe.name || "Receita sem nome"} description={recipe.category || "Sem categoria"}
        metrics={[
          { label: "Rendimento / lote", value: <>{number(recipe.yield)} un.</> },
          { label: "Ingredientes", value: number(recipe.ingredientCount) },
        ]}
        viewLabel={`Visualizar receita ${recipe.name || "sem nome"}`}
        viewTitle="Visualizar receita" onView={() => onView(recipe.id)} />)}
      {status === "error" ? <EmptyState>Não foi possível carregar as receitas.</EmptyState>
        : !recipes.length && status === "ready" && <EmptyState>
          {search ? "Nenhuma receita encontrada." : "Cadastre uma receita para criar sua primeira ficha técnica."}
        </EmptyState>}
    </SummaryList>
    <Pagination {...pagination} label="receitas" />
    </Panel>
    {isAdding && <RegistrationModal title="Cadastrar receita" onClose={() => setIsAdding(false)}>
      <FormLayout onSubmit={(event) => {
        event.preventDefault();
        const name = draft.name.trim();
        if (!name) {
          toast.error("Informe o nome da receita.");
          return;
        }
        void onCreate({ ...draft, name, category: draft.category.trim() }).then((created) => {
          if (created) setIsAdding(false);
        });
      }}>
        <RecipeFields value={draft} variant="registration" autoFocus onChange={(patch) => setDraft({ ...draft, ...patch })} />
        <RecipeIngredientsEditor rows={local.rows} totalCount={draft.ingredients.length} marketCount={marketCount}
          selectedIds={draft.ingredients.map((entry) => entry.marketItemId).filter(Boolean)}
          hasEmptyRow={draft.ingredients.some((entry) => !entry.marketItemId)}
          pagination={local.pagination} serverSort={local.serverSort} status={local.status} onAdd={addIngredient}
          onChange={(index, patch) => setDraft({
            ...draft, ingredients: draft.ingredients.map((entry, entryIndex) => entryIndex === local.indexes[index] ? { ...entry, ...patch } : entry),
          })}
          onRemove={(index) => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, entryIndex) => entryIndex !== local.indexes[index]) })} />
        <FormActions onCancel={() => setIsAdding(false)} />
      </FormLayout>
    </RegistrationModal>}
  </>;
}
