import { useState } from "react";
import type { Ingredient, MarketListItem } from "../../../domain/models";
import { queryService } from "../../../services/query";
import { useMarketLookup } from "../../../hooks/useMarketLookup";
import type { ListControls, QueryStatus } from "../../../hooks/usePagedQuery";
import Button from "../../ui/Button";
import DataTable, { type ServerSort } from "../../ui/DataTable";
import EmptyState from "../../ui/EmptyState";
import FormControl from "../../ui/FormControl";
import Icon from "../../ui/Icon";
import IconButton from "../../ui/IconButton";
import Pagination from "../../ui/Pagination";
import Panel from "../../ui/Panel";
import RemoteSelect from "../../ui/RemoteSelect";
import SearchField from "../../ui/SearchField";
import styles from "./styles.module.scss";

export type IngredientRow = Omit<Ingredient, "id"> & { id?: string };

type Props = {
  /** Rows of the current page, already ordered. */
  rows: IngredientRow[];
  /** Ingredients of the whole recipe, including rows not loaded. */
  totalCount: number;
  /** Total of registered market items, from the workspace summary. */
  marketCount: number;
  /** Market items known to be used by the recipe; they are disabled in the item picker. */
  selectedIds: string[];
  /** A created row still has no market item. */
  hasEmptyRow: boolean;
  onChange: (index: number, patch: Partial<Omit<Ingredient, "id">>) => void;
  onAdd: () => void;
  onRemove: (index: number, name: string) => void;
  pagination: ListControls["pagination"];
  serverSort: ServerSort;
  status?: QueryStatus;
  search?: string;
  onSearch?: (search: string) => void;
  version?: number;
};

const toOption = (item: MarketListItem) => ({ value: item.id, label: item.name || "Insumo sem nome" });

/**
 * Ingredients of one recipe, one page at a time. Names and units of the visible rows are resolved by
 * id (up to 100 per request) and the item picker searches on the server.
 */
export default function RecipeIngredientsEditor({
  rows, totalCount, marketCount, selectedIds, hasEmptyRow, onChange, onAdd, onRemove,
  pagination, serverSort, status = "ready", search, onSearch, version,
}: Props) {
  const lookup = useMarketLookup(rows.map((ingredient) => ingredient.marketItemId), version);
  const [picked, setPicked] = useState<Record<string, MarketListItem>>({});
  const itemOf = (id: string) => picked[id] ?? lookup.items.get(id);
  const canAdd = marketCount > totalCount && !hasEmptyRow;
  return <Panel variant="inset" title="Ingredientes"
    action={<div className={styles.actions}>
      {onSearch && <SearchField aria-label="Buscar ingrediente" placeholder="Buscar ingrediente..."
        value={search ?? ""} onChange={(event) => onSearch(event.target.value)} />}
      <Button variant="inline" disabled={!canAdd} onClick={onAdd}>
        <Icon name="plus" size={14} /> Adicionar insumo
      </Button>
    </div>}>
    <DataTable variant="compact" serverSort={serverSort}>
      <thead><tr><th>Insumo</th><th>Quantidade</th><th>Unidade</th><th /></tr></thead>
      <tbody>{rows.map((ingredient, index) => {
        const selected = itemOf(ingredient.marketItemId);
        return <tr key={ingredient.id ?? index}>
          <td><RemoteSelect aria-label="Pesquisar insumo" required controlSize="compact"
            disabled={!marketCount} placeholder={marketCount ? "Buscar item..." : "Cadastre insumos"}
            value={ingredient.marketItemId}
            selectedLabel={selected ? selected.name || "Insumo sem nome"
              : lookup.status === "loading" ? "Carregando..." : ingredient.marketItemId ? "Insumo indisponível" : undefined}
            fetcher={queryService.market} sortBy="name" toOption={toOption} version={version}
            disabledValues={selectedIds}
            onChange={(marketItemId, item) => {
              if (item) setPicked({ ...picked, [item.id]: item });
              onChange(index, { marketItemId });
            }} /></td>
          <td><FormControl className={styles.quantity} aria-label="Quantidade usada por lote"
            required type="number" min="0" step="0.1" value={ingredient.quantity}
            onChange={(event) => onChange(index, { quantity: Math.max(0, Number(event.target.value)) })} /></td>
          <td>{selected?.unit ?? "—"}</td>
          <td><IconButton size="small" aria-label="Remover ingrediente" title="Remover ingrediente"
            onClick={() => onRemove(index, selected?.name || "Ingrediente")}>
            <Icon name="close" size={15} />
          </IconButton></td>
        </tr>;
      })}</tbody>
    </DataTable>
    {!rows.length && <EmptyState>
      {status === "loading" ? "Carregando ingredientes..."
        : status === "error" ? "Não foi possível carregar os ingredientes."
          : search ? "Nenhum ingrediente encontrado."
            : marketCount ? "Adicione insumos e informe a quantidade usada em cada receita." : "Cadastre insumos primeiro para incluí-los na receita."}
    </EmptyState>}
    {(pagination.totalCount > 10 || pagination.page > 1) && <Pagination {...pagination} label="ingredientes" />}
    {!canAdd && totalCount > 0 && <p className={styles.hint}>
      {hasEmptyRow ? "Escolha o insumo da linha adicionada antes de incluir outra."
        : marketCount ? "Todos os insumos já estão nesta receita." : "Cadastre insumos para adicionar ingredientes."}
    </p>}
  </Panel>;
}
