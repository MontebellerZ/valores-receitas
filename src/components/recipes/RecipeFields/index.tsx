import type { Recipe } from "../../../domain/models";
import FormField from "../../ui/FormField";
import FormControl from "../../ui/FormControl";
import { FormGrid } from "../../ui/FormLayout";
import styles from "./styles.module.scss";

type Values = Pick<Recipe, "name" | "category" | "yield" | "hoursPerBatch">;
type Props = {
  value: Values;
  onChange: (patch: Partial<Values>) => void;
  variant?: "default" | "registration";
  autoFocus?: boolean;
};

export default function RecipeFields({ value, onChange, variant = "default", autoFocus = false }: Props) {
  return <FormGrid className={styles.fields}>
    <FormField variant={variant} label="Nome da receita">
      <FormControl autoFocus={autoFocus} required maxLength={120} placeholder="Ex.: Bolo de cenoura"
        value={value.name} onChange={(event) => onChange({ name: event.target.value })} />
    </FormField>
    <FormField variant={variant} label="Categoria">
      <FormControl maxLength={80} placeholder="Ex.: Bolos"
        value={value.category} onChange={(event) => onChange({ category: event.target.value })} />
    </FormField>
    <FormField variant={variant} label="Rendimento por lote">
      <FormControl required type="number" min="0" step="1" suffix="un./lote" value={value.yield}
        onChange={(event) => onChange({ yield: Math.max(0, Number(event.target.value)) })} />
    </FormField>
    <FormField variant={variant} label="Horas por receita">
      <FormControl required type="number" min="0" step="0.1" suffix="horas" value={value.hoursPerBatch}
        onChange={(event) => onChange({ hoursPerBatch: Math.max(0, Number(event.target.value)) })} />
    </FormField>
  </FormGrid>;
}
