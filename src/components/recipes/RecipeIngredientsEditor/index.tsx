import type { Ingredient, MarketItem } from "../../../domain/models";
import Button from "../../ui/Button";
import DataTable from "../../ui/DataTable";
import EmptyState from "../../ui/EmptyState";
import FormControl from "../../ui/FormControl";
import Icon from "../../ui/Icon";
import IconButton from "../../ui/IconButton";
import Panel from "../../ui/Panel";
import SearchableSelect from "../../ui/SearchableSelect";
import styles from "./styles.module.scss";

type Props = {
  ingredients: (Omit<Ingredient, "id"> & { id?: string })[];
  market: MarketItem[];
  onChange: (index: number, patch: Partial<Omit<Ingredient, "id">>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export default function RecipeIngredientsEditor({ ingredients, market, onChange, onAdd, onRemove }: Props) {
  const sorted = [...market].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true }));
  const canAdd = market.some((item) => !ingredients.some((ingredient) => ingredient.marketItemId === item.id));
  return <Panel variant="inset" title="Ingredientes"
    action={<Button variant="inline" disabled={!canAdd} onClick={onAdd}>
      <Icon name="plus" size={14} /> Adicionar insumo
    </Button>}>
    <DataTable variant="compact">
      <thead><tr><th>Insumo</th><th>Quantidade</th><th>Unidade</th><th /></tr></thead>
      <tbody>{ingredients.map((ingredient, index) => {
        const selected = market.find((item) => item.id === ingredient.marketItemId);
        return <tr key={ingredient.id ?? index}>
          <td data-sort-value={selected?.name ?? ""}><SearchableSelect aria-label="Pesquisar insumo" required controlSize="compact"
            disabled={!market.length} placeholder={market.length ? "Buscar item..." : "Cadastre insumos"}
            value={ingredient.marketItemId}
            options={sorted.map((item) => ({
              value: item.id, label: item.name || "Insumo sem nome",
              disabled: ingredients.some((other, otherIndex) => otherIndex !== index && other.marketItemId === item.id),
            }))}
            onChange={(marketItemId) => onChange(index, { marketItemId })} /></td>
          <td data-sort-value={ingredient.quantity}><FormControl className={styles.quantity} aria-label="Quantidade usada por lote"
            required type="number" min="0" step="0.1" value={ingredient.quantity}
            onChange={(event) => onChange(index, { quantity: Math.max(0, Number(event.target.value)) })} /></td>
          <td data-sort-value={selected?.unit ?? ""}>{selected?.unit ?? "—"}</td>
          <td><IconButton size="small" aria-label="Remover ingrediente" title="Remover ingrediente" onClick={() => onRemove(index)}>
            <Icon name="close" size={15} />
          </IconButton></td>
        </tr>;
      })}</tbody>
    </DataTable>
    {!ingredients.length && <EmptyState>
      {market.length ? "Adicione insumos e informe a quantidade usada em cada receita." : "Cadastre insumos primeiro para incluí-los na receita."}
    </EmptyState>}
    {!canAdd && ingredients.length > 0 && <p className={styles.hint}>
      {market.length ? "Todos os insumos já estão nesta receita." : "Cadastre insumos para adicionar ingredientes."}
    </p>}
  </Panel>;
}
