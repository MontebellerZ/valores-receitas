import type { ReactNode } from "react";
import type { MarketItem, StockEntry, StockField } from "../../../domain/models";
import FormField from "../../ui/FormField";
import FormControl from "../../ui/FormControl";
import { FormGrid } from "../../ui/FormLayout";
import SearchableSelect from "../../ui/SearchableSelect";
import styles from "./styles.module.scss";

type Props = {
  value: StockEntry;
  market: MarketItem[];
  disabled?: boolean;
  onChange: (patch: Partial<StockEntry>) => void;
  enabledFields?: Record<StockField, boolean>;
  onToggleField?: (field: StockField, enabled: boolean) => void;
};

export default function StockEntryFields({ value, market, disabled, onChange, enabledFields, onToggleField }: Props) {
  const item = market.find((item) => item.id === value.marketItemId);
  const enabled = (field: StockField) => !disabled && (!enabledFields || enabledFields[field]);
  const field = (key: StockField, label: string, control: ReactNode) => <div className={styles.field}>
    {enabledFields && <FormField variant="inline" label={`Alterar ${label.toLocaleLowerCase("pt-BR")}`}><input type="checkbox" checked={enabledFields[key]}
      disabled={disabled} onChange={(event) => onToggleField?.(key, event.target.checked)} /></FormField>}
    <FormField label={label}>{control}</FormField>
  </div>;
  return <FormGrid variant="wrap">
    {field("marketItemId", "Insumo", <SearchableSelect required disabled={!enabled("marketItemId")} value={value.marketItemId}
      placeholder="Selecione um insumo" options={market.map((item) => ({ value: item.id, label: `${item.name || "Insumo sem nome"} (${item.unit})` }))}
      onChange={(marketItemId) => onChange({ marketItemId })} />)}
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
