import type { ReactNode } from "react";
import type { MarketListItem, StockEntry, StockField } from "../../../domain/models";
import { queryService } from "../../../services/query";
import FormField from "../../ui/FormField";
import FormControl from "../../ui/FormControl";
import { FormGrid } from "../../ui/FormLayout";
import RemoteSelect from "../../ui/RemoteSelect";
import styles from "./styles.module.scss";

export type StockItemRef = { id: string; name: string; unit: string };

type Props = {
  value: StockEntry;
  /** Name and unit of the chosen market item, kept by the parent because options are loaded on demand. */
  selectedItem?: StockItemRef;
  disabled?: boolean;
  onChange: (patch: Partial<StockEntry>, item?: StockItemRef) => void;
  enabledFields?: Record<StockField, boolean>;
  onToggleField?: (field: StockField, enabled: boolean) => void;
};

const label = (item: StockItemRef) => `${item.name || "Insumo sem nome"} (${item.unit})`;

export default function StockEntryFields({ value, selectedItem, disabled, onChange, enabledFields, onToggleField }: Props) {
  const item = selectedItem?.id === value.marketItemId ? selectedItem : undefined;
  const enabled = (field: StockField) => !disabled && (!enabledFields || enabledFields[field]);
  const field = (key: StockField, label: string, control: ReactNode) => <div className={styles.field}>
    {enabledFields && <FormField variant="inline" label={`Alterar ${label.toLocaleLowerCase("pt-BR")}`}><input type="checkbox" checked={enabledFields[key]}
      disabled={disabled} onChange={(event) => onToggleField?.(key, event.target.checked)} /></FormField>}
    <FormField label={label}>{control}</FormField>
  </div>;
  return <FormGrid variant="wrap">
    {field("marketItemId", "Insumo", <RemoteSelect required disabled={!enabled("marketItemId")} value={value.marketItemId}
      placeholder="Selecione um insumo" selectedLabel={item && label(item)}
      fetcher={queryService.market} sortBy="name" toOption={(entry: MarketListItem) => ({ value: entry.id, label: label(entry) })}
      onChange={(marketItemId, entry) => onChange({ marketItemId }, entry && { id: entry.id, name: entry.name, unit: entry.unit })} />)}
    {field("entryDate", "Data da compra", <FormControl autoFocus={!enabledFields} type="date" required disabled={!enabled("entryDate")}
      value={value.entryDate} onChange={(event) => onChange({ entryDate: event.target.value })} />)}
    {value.packageCount !== undefined && <FormField label="Quantidade de pacotes"><FormControl required disabled={disabled}
      type="number" min="1" max="2147483647" step="1" value={value.packageCount}
      onChange={(event) => onChange({ packageCount: Number(event.target.value) })} /></FormField>}
    {field("packageQty", `Quantidade no pacote${item ? ` (${item.unit})` : ""}`, <FormControl required disabled={!enabled("packageQty")}
      type="number" min="0.0001" max="99999999999999" step="0.0001" value={value.packageQty}
      onChange={(event) => onChange({ packageQty: Number(event.target.value) })} />)}
    {field("packagePrice", "Preço do pacote (R$)", <FormControl required disabled={!enabled("packagePrice")}
      type="number" min="0" max="9999999999999999" step="0.01" value={value.packagePrice}
      onChange={(event) => onChange({ packagePrice: Number(event.target.value) })} />)}
  </FormGrid>;
}
