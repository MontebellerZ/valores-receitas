import Button from "../../../components/ui/Button";
import FormActions from "../../../components/ui/FormActions";
import FormLayout from "../../../components/ui/FormLayout";
import ProductionFields from "../../../components/production/ProductionFields";
import { useState, type FormEvent } from "react";
import Icon from "../../../components/ui/Icon";
import PageHeader from "../../../components/ui/PageHeader";
import SummaryItem, { SummaryList } from "../../../components/ui/SummaryItem";
import EmptyState from "../../../components/ui/EmptyState";
import RegistrationModal from "../../../components/ui/RegistrationModal";
import SplitButton from "../../../components/ui/SplitButton";
import type { CalculatedProduction, Production, Recipe } from "../../../domain/models";
import { remainingPackages } from "../../../domain/calculations";
import { localToday, money, number } from "../../../utils/format";
import { toast } from "react-toastify";

type Props = {
  productions: CalculatedProduction[];
  recipes: Recipe[];
  onCreate: (production: Omit<Production, "id">) => Promise<Production>;
  onView: (id: string) => void;
  onViewRecipes: () => void;
};

export default function ProductionsPage({
  productions: calculated,
  recipes,
  onCreate,
  onView,
  onViewRecipes,
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Omit<Production, "id"> | null>(null);
  const startCreating = (isStandalone = false) => {
    const recipe = recipes[0];
    if (!recipe) {
      onViewRecipes();
      toast.info("Cadastre uma receita antes de registrar uma produção.");
      return;
    }
    setDraft({
      date: localToday(),
      recipeId: recipe.id,
      recipeName: recipe.name || "Receita sem nome",
      quantity: 1,
      actualYield: recipe.yield,
      losses: 0,
      margin: 0,
      packageQty: 1,
      yieldPerBatch: recipe.yield,
      ingredientCostPerBatch: 0,
      ...(isStandalone ? { isStandalone: true, totalCost: null } : {}),
    });
    setIsAdding(true);
  };
  const submitProduction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await onCreate(draft);
      setIsAdding(false);
      setDraft(null);
      toast.success(draft.isStandalone
        ? "Produção avulsa cadastrada com o custo informado."
        : "Produção cadastrada e estoque atualizado.");
    } catch (error) {
      if (error instanceof Error && error.name === "SaveCancelledError") return;
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a produção.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Produção"
        eyebrow="REGISTRO E RESULTADOS"
        eyebrowDot
        description={`${calculated.length} registros de produção`}
        action={
          <SplitButton
            onClick={() => startCreating()}
            disabled={!recipes.length}
            menuLabel="Mais opções de registro de produção"
            options={[
              { label: "Registrar produção", description: "Calcula o custo consumindo o estoque.",
                onSelect: () => startCreating() },
              { label: "Registrar produção avulsa", description: "Sem estoque; informe o custo manualmente.",
                onSelect: () => startCreating(true) },
            ]}
          >
            <Icon name="plus" size={17} /> Registrar produção
          </SplitButton>
        }
      />
      {calculated.length > 0 ? (
        <SummaryList aria-label="Lista de produção">
          {calculated
            .slice()
            .sort((first, second) => second.date.localeCompare(first.date))
            .map((production) => {
              const hasExpectedPrice =
                production.expectedSalePrice !== undefined;
              const revenue =
                (production.expectedSalePrice ?? production.salePrice) *
                remainingPackages(production);
              const balance = revenue - production.cost;
              const profit = hasExpectedPrice
                ? Math.abs(balance) <=
                  Number.EPSILON *
                    Math.max(1, Math.abs(revenue), Math.abs(production.cost))
                  ? 0
                  : balance
                : production.profit;
              return (
                <SummaryItem key={production.id} name={production.recipeName}
                  title={<>{production.recipeName}{production.quantity === 0 ? " (rascunho)" : ""}{production.isStandalone ? " (avulsa)" : ""}</>}
                  description={<>{production.date
                          ? new Intl.DateTimeFormat("pt-BR").format(
                              new Date(`${production.date}T12:00:00`),
                            )
                          : "Data não informada"}{" "}
                        · {number(production.quantity, 4)} lotes
                  </>}
                  metrics={[
                    { label: "Pacotes", value: number(production.packages) },
                    { label: "Custo registrado", value: money(production.cost) },
                    { label: hasExpectedPrice ? "Lucro esperado" : "Lucro previsto",
                      value: hasExpectedPrice && production.packages === 0 ? "—" : money(profit) },
                  ]}
                  viewLabel={`Visualizar produção de ${production.recipeName} em ${production.date}`}
                  viewTitle="Visualizar produção" onView={() => onView(production.id)} />
              );
            })}
        </SummaryList>
      ) : !recipes.length ? (
        <EmptyState variant="editor" title="Cadastre uma receita primeiro"
          icon={<Icon name="recipe" size={28} />}
          action={<Button onClick={onViewRecipes}>
            <Icon name="recipe" size={16} /> Ir para receitas
          </Button>}>
          <p>
            As fichas técnicas serão selecionadas ao criar cada registro de
            produção.
          </p>
        </EmptyState>
      ) : (
        <EmptyState variant="editor" title="Nenhuma produção registrada"
          icon={<Icon name="chart" size={28} />}
          action={<Button onClick={() => startCreating()}>
            <Icon name="plus" size={16} /> Registrar primeira produção
          </Button>}>
          <p>
            Crie um registro para informar qual receita foi feita, em que
            quantidade e quais foram os resultados.
          </p>
        </EmptyState>
      )}
      {isAdding && draft && (
        <RegistrationModal
          title={draft.isStandalone ? "Cadastrar produção avulsa" : "Cadastrar produção"}
          busy={busy}
          onClose={() => setIsAdding(false)}
        >
          <FormLayout disabled={busy} onSubmit={(event) => void submitProduction(event)}>
            <ProductionFields value={draft} recipes={recipes} variant="registration" autoFocus disabled={busy}
              onChange={(patch) => setDraft({ ...draft, ...patch })} />
            <FormActions onCancel={() => setIsAdding(false)} disabled={busy} cancelDisabled={busy}
              submitLabel={busy ? "Cadastrando..." : "Cadastrar"} />
          </FormLayout>
        </RegistrationModal>
      )}
    </>
  );
}
