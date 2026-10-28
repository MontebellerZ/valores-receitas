import Button from "../../../components/ui/Button";
import SearchField from "../../../components/ui/SearchField";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import EmptyState from "../../../components/ui/EmptyState";
import FormField from "../../../components/ui/FormField";
import FormActions from "../../../components/ui/FormActions";
import FormControl from "../../../components/ui/FormControl";
import styles from "./styles.module.scss";
import { useMemo, useState } from "react";
import Icon from "../../../components/ui/Icon";
import PageHeader from "../../../components/ui/PageHeader";
import type { MarketItem, Recipe } from "../../../domain/models";
import type { PendingDelete } from "../../../types/navigation";
import RegistrationModal from "../../../components/ui/RegistrationModal";
import FormLayout, { FormGrid } from "../../../components/ui/FormLayout";
import Panel from "../../../components/ui/Panel";
import { toast } from "react-toastify";

type Props = {
  market: MarketItem[];
  recipes: Recipe[];
  updateMarket: (id: string, patch: Partial<MarketItem>) => void;
  addMarketItem: (item: Pick<MarketItem, "name" | "unit">) => void;
  onRequestDelete: (target: PendingDelete) => void;
};

export default function MarketPage({ market, recipes, updateMarket, addMarketItem, onRequestDelete }: Props) {
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", unit: "" });
  const items = useMemo(() => [...market]
    .filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true })), [market, search]);
  return <>
    <PageHeader title="Insumos" description="Cadastre os itens usados nas receitas. Preços de compra e saldos ficam no Estoque."
      action={<Button onClick={() => setIsAdding(true)}><Icon name="plus" size={17} /> Novo insumo</Button>} />
    <Panel title={`${market.length} insumos cadastrados`}
      description="Cadastre nome e unidade. Informe a quantidade e o preço de cada pacote no Estoque."
      action={
        <SearchField
          aria-label="Buscar insumo"
          placeholder="Buscar insumo..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles["search-box"]}
          
        />
      }>
      <DataTable  className={styles["market-table"]}  ><thead><tr><th>Insumo</th><th>Unidade</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
          <td data-sort-value={item.name}><FormControl aria-label="Nome do insumo" value={item.name} onChange={(event) => updateMarket(item.id, { name: event.target.value })} /></td>
          <td data-sort-value={item.unit}><FormControl aria-label="Unidade de medida" disabled={item.hasStockHistory} value={item.unit} onChange={(event) => updateMarket(item.id, { unit: event.target.value })} /></td>
          <td><IconButton size="small" danger disabled={item.hasStockHistory} title={item.hasStockHistory ? "Insumo com histórico de estoque" : "Excluir insumo"} aria-label={`Excluir ${item.name || "insumo"}`}
            onClick={() => onRequestDelete({
              kind: "market", id: item.id, label: item.name || "Insumo sem nome",
              ingredientCount: recipes.reduce((sum, recipe) => sum + recipe.ingredients.filter((ingredient) => ingredient.marketItemId === item.id).length, 0)
            })}>
            <Icon name="trash" size={16} /></IconButton></td>
        </tr>)}</tbody></DataTable>
      {!items.length && <EmptyState>Nenhum insumo encontrado.</EmptyState>}
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
