import Button from "../../../components/ui/Button";
import SearchField from "../../../components/ui/SearchField";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import FormField from "../../../components/ui/FormField";
import FormActions from "../../../components/ui/FormActions";
import FormControl from "../../../components/ui/FormControl";
import styles from "./styles.module.scss";
import { useState } from "react";
import Pagination from "../../../components/ui/Pagination";
import type { ListControls } from "../../../hooks/usePagedQuery";
import Icon from "../../../components/ui/Icon";
import PageHeader from "../../../components/ui/PageHeader";
import type { MarketItem, MarketListItem } from "../../../domain/models";
import type { PendingDelete } from "../../../types/navigation";
import RegistrationModal from "../../../components/ui/RegistrationModal";
import FormLayout, { FormGrid } from "../../../components/ui/FormLayout";
import Panel from "../../../components/ui/Panel";
import { toast } from "react-toastify";

type Props = ListControls & {
  /** Current page with this screen's unsaved edits applied. */
  items: MarketListItem[];
  /** Items created on this screen and not saved yet; shown before the page. */
  created: MarketListItem[];
  totalCount: number;
  search: string;
  onSearch: (search: string) => void;
  updateMarket: (item: MarketItem, patch: Partial<MarketItem>) => void;
  addMarketItem: (item: Pick<MarketItem, "name" | "unit">) => void;
  onRequestDelete: (target: PendingDelete) => void;
};


export default function MarketPage({
  items: pageItems, created, totalCount, search, onSearch, updateMarket, addMarketItem, onRequestDelete,
  pagination, serverSort, status,
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", unit: "" });
  const items = [...created, ...pageItems];
  return <>
    <PageHeader title="Insumos" description="Cadastre os itens usados nas receitas. Preços de compra e saldos ficam no Estoque."
      action={<Button onClick={() => setIsAdding(true)}><Icon name="plus" size={17} /> Novo insumo</Button>} />
    <Panel title={`${totalCount} insumos cadastrados`}
      description="Cadastre nome e unidade. Informe a quantidade e o preço de cada pacote no Estoque."
      action={
        <SearchField
          aria-label="Buscar insumo"
          placeholder="Buscar insumo..."
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className={styles["search-box"]}
          
        />
      }>
      <DataTable className={styles["market-table"]} serverSort={serverSort} aria-busy={status === "loading"}><thead><tr><th>Insumo</th><th>Unidade</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
          <td data-sort-value={item.name}><FormControl aria-label="Nome do insumo" value={item.name} onChange={(event) => updateMarket(item, { name: event.target.value })} /></td>
          <td data-sort-value={item.unit}><FormControl aria-label="Unidade de medida" disabled={item.hasStockHistory} value={item.unit} onChange={(event) => updateMarket(item, { unit: event.target.value })} /></td>
          <td><IconButton size="small" danger disabled={item.hasStockHistory} title={item.hasStockHistory ? "Insumo com histórico de estoque" : "Excluir insumo"} aria-label={`Excluir ${item.name || "insumo"}`}
            onClick={() => onRequestDelete({
              kind: "market", id: item.id, label: item.name || "Insumo sem nome",
              ingredientCount: item.ingredientCount, hasStockHistory: item.hasStockHistory,
            })}>
            <Icon name="trash" size={16} /></IconButton></td>
        </tr>)}</tbody></DataTable>
      {status === "error" ? <EmptyState>Não foi possível carregar os insumos.</EmptyState>
        : !items.length && status === "ready" && <EmptyState>Nenhum insumo encontrado.</EmptyState>}
      <Pagination {...pagination} label="insumos" />
      <p className={styles["formula-note"]}>Insumos com histórico de estoque não podem ser excluídos nem mudar de unidade. Um mesmo insumo pode ter compras com tamanhos e preços de pacote diferentes.</p>
    </Panel>
    {isAdding && <RegistrationModal title="Cadastrar insumo" onClose={() => setIsAdding(false)}>
      <FormLayout onSubmit={(event) => {
        event.preventDefault();
        const name = newItem.name.trim();
        const unit = newItem.unit.trim();
        if (!name || !unit) {
          toast.error("Informe o nome e a unidade do insumo.");
          return;
        }
        addMarketItem({ name, unit });
        setNewItem({ name: "", unit: "" });
        setIsAdding(false);
      }}>
        <FormGrid>
          <FormField variant="registration" label="Nome do insumo">
            <FormControl autoFocus required maxLength={120} placeholder="Ex.: Farinha de trigo" value={newItem.name}
              onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} />
          </FormField>
          <FormField variant="registration" label="Unidade de medida">
            <FormControl required maxLength={30} placeholder="Ex.: g, ml, un." value={newItem.unit}
              onChange={(event) => setNewItem({ ...newItem, unit: event.target.value })} />
          </FormField>
        </FormGrid>
        <FormActions onCancel={() => setIsAdding(false)}   />
      </FormLayout>
    </RegistrationModal>}
  </>;
}
