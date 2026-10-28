import type { Production, Recipe } from "../../../domain/models";
import { number } from "../../../utils/format";
import FormField from "../../ui/FormField";
import FormControl from "../../ui/FormControl";
import { FormGrid } from "../../ui/FormLayout";
import SearchableSelect from "../../ui/SearchableSelect";
import styles from "./styles.module.scss";

type Draft = Omit<Production, "id">;
type Props = {
  value: Draft;
  recipes: Recipe[];
  onChange: (patch: Partial<Draft>) => void;
  locked?: boolean;
  disabled?: boolean;
  variant?: "default" | "registration";
  autoFocus?: boolean;
};

export default function ProductionFields({
  value, recipes, onChange, locked = false, disabled = false, variant = "default", autoFocus = false,
}: Props) {
  return <FormGrid variant={variant === "registration" ? "grid" : "wrap"} className={styles.fields}>
    <FormField variant={variant} label="Data da produção">
      <FormControl autoFocus={autoFocus} required disabled={disabled} type="date" value={value.date}
        onChange={(event) => onChange({ date: event.target.value })} />
    </FormField>
    <FormField variant={variant} label="Receita">
      <SearchableSelect required disabled={locked || disabled} value={value.recipeId}
        options={[
          ...(!recipes.some((recipe) => recipe.id === value.recipeId)
            ? [{ value: value.recipeId, label: `${value.recipeName} (ficha removida)` }] : []),
          ...recipes.map((recipe) => ({ value: recipe.id, label: recipe.name || "Receita sem nome" })),
        ]}
        onChange={(recipeId) => {
          const recipe = recipes.find((item) => item.id === recipeId);
          if (recipe && !locked) onChange({
            recipeId: recipe.id, recipeName: recipe.name || "Receita sem nome",
            yieldPerBatch: recipe.yield, actualYield: recipe.yield * value.quantity,
          });
        }} />
    </FormField>
    <FormField variant={variant} label="Quantidade de lotes">
      <FormControl required disabled={locked || disabled} type="number" min="0.0001" step="0.0001" value={value.quantity}
        onChange={(event) => {
          if (locked) return;
          const quantity = Number(event.target.value);
          onChange({ quantity, actualYield: value.yieldPerBatch * quantity });
        }} />
      <small>Esperado: {number(value.yieldPerBatch * value.quantity)} unidades</small>
    </FormField>
    <FormField variant={variant} label="Rendimento obtido">
      <FormControl required disabled={disabled} type="number" min="0" step="0.0001" value={value.actualYield}
        onChange={(event) => onChange({ actualYield: Number(event.target.value) })} />
    </FormField>
    <FormField variant={variant} label="Perdas">
      <FormControl required disabled={disabled} type="number" min="0" max={value.actualYield} step="0.0001" value={value.losses}
        onChange={(event) => onChange({ losses: Number(event.target.value) })} />
    </FormField>
    <FormField variant={variant} label="Quantidade por pacote">
      <FormControl required disabled={disabled} type="number" min="0.0001" step="0.0001" value={value.packageQty}
        onChange={(event) => onChange({ packageQty: Number(event.target.value) })} />
    </FormField>
    <FormField variant={variant} label="Lucro desejado sobre custo (%)">
      <FormControl required disabled={disabled} type="number" min="0" step="0.01" value={value.margin}
        onChange={(event) => onChange({ margin: Number(event.target.value) })} />
    </FormField>
    {locked && <FormField variant={variant} label="Pacotes perdidos">
      <FormControl disabled={disabled} type="number" min="0" step="1" value={value.lostPackages ?? 0}
        onChange={(event) => onChange({ lostPackages: event.target.value === "" ? 0 : Number(event.target.value) })} />
      <small>Pacotes prontos que venceram, foram roubados ou descartados. Não ficam disponíveis para venda.</small>
    </FormField>}
    {value.isStandalone && <FormField variant={variant} label="Custo total da produção (R$)">
      <FormControl required disabled={disabled} type="number" min="0" step="0.01" value={value.totalCost ?? ""}
        onChange={(event) => onChange({ totalCost: event.target.value === "" ? null : Number(event.target.value) })} />
      <small>Informado manualmente; não consome itens do estoque.</small>
    </FormField>}
  </FormGrid>;
}
