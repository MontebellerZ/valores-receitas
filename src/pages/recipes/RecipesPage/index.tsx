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
import type { MarketItem, Recipe, RecipeDraft } from "../../../domain/models";
import { number } from "../../../utils/format";

type Props = {
  recipes: Recipe[];
  market: MarketItem[];
  onCreate: (draft: RecipeDraft) => Promise<boolean>;
  onView: (id: string) => void;
};

export default function RecipesPage({ recipes, market, onCreate, onView }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft>({
    name: "", category: "", yield: 1, hoursPerBatch: 0, ingredients: [],
  });
  const startCreating = () => {
    setDraft({
      name: "", category: "", yield: 1, hoursPerBatch: 0,
      ingredients: market.length ? [{ marketItemId: market[0].id, quantity: 0 }] : [],
    });
    setIsAdding(true);
  };
  const addIngredient = () => {
    const item = market.find((candidate) => !draft.ingredients.some((ingredient) => ingredient.marketItemId === candidate.id));
    if (item) setDraft({ ...draft, ingredients: [...draft.ingredients, { marketItemId: item.id, quantity: 0 }] });
  };
  return <>
    <PageHeader title="Receitas" eyebrow="FICHAS TÉCNICAS" eyebrowDot
      description={`${recipes.length} receitas cadastradas`}
      action={<Button onClick={startCreating}><Icon name="plus" size={17} /> Nova receita</Button>} />
    <SummaryList aria-label="Lista de receitas">
      {recipes.map((recipe) => <SummaryItem key={recipe.id} name={recipe.name}
        title={recipe.name || "Receita sem nome"} description={recipe.category || "Sem categoria"}
        metrics={[
          { label: "Rendimento / lote", value: <>{number(recipe.yield)} un.</> },
          { label: "Ingredientes", value: number(recipe.ingredients.length) },
        ]}
        viewLabel={`Visualizar receita ${recipe.name || "sem nome"}`}
        viewTitle="Visualizar receita" onView={() => onView(recipe.id)} />)}
      {!recipes.length && <EmptyState>Cadastre uma receita para criar sua primeira ficha técnica.</EmptyState>}
    </SummaryList>
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
        <RecipeIngredientsEditor ingredients={draft.ingredients} market={market} onAdd={addIngredient}
          onChange={(index, patch) => setDraft({
            ...draft, ingredients: draft.ingredients.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry),
          })}
          onRemove={(index) => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, entryIndex) => entryIndex !== index) })} />
        <FormActions onCancel={() => setIsAdding(false)} />
      </FormLayout>
    </RegistrationModal>}
  </>;
}
