import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import FormLayout from "../../../components/ui/FormLayout";
import Panel from "../../../components/ui/Panel";
import ProductionFields from "../../../components/production/ProductionFields";
import DataTable from "../../../components/ui/DataTable";
import styles from "./styles.module.scss";
import { useState } from "react";
import BackButton from "../../../components/ui/BackButton";
import { toast } from "react-toastify";
import Icon from "../../../components/ui/Icon";
import PageHeader from "../../../components/ui/PageHeader";
import type { Production, Recipe, Sale, StockConsumption } from "../../../domain/models";
import type { PendingDelete } from "../../../types/navigation";
import { calculateProduction } from "../../../domain/calculations";
import { money, number } from "../../../utils/format";
import SalePriceSimulation from "../../../components/production/SalePriceSimulation";
import RealizedSales from "../../../components/production/RealizedSales";
import ProductionHero from "../../../components/production/ProductionHero";
import PackageFlow from "../../../components/production/PackageFlow";
import ProductionYield from "../../../components/production/ProductionYield";
import ProductionFinance from "../../../components/production/ProductionFinance";
import ProductionCharts from "../../../components/production/ProductionCharts";
import { buildProductionReport, expirationDate } from "../../../domain/productionReport";

type Props = {
  production: Production;
  recipes: Recipe[];
  sales: Sale[];
  updateProduction: (id: string, patch: Partial<Production>) => void;
  saveProduction: (production: Production) => Promise<void>;
  consumptions: StockConsumption[];
  consumptionStatus: "loading" | "ready" | "error";
  onRequestDelete: (target: PendingDelete) => void;
  onBack: () => void;
  onViewSales: () => void;
};

export default function ProductionDetailPage({ production, recipes, sales, updateProduction, saveProduction, consumptions, consumptionStatus, onRequestDelete, onBack, onViewSales }: Props) {
  const [draft, setDraft] = useState<Production>(() => ({ ...production, quantity: production.quantity || 1 }));
  const [busy, setBusy] = useState(false);
  const saved = production.quantity > 0;
  const current = saved ? production : draft;
  const result = calculateProduction(current);
  const standalone = Boolean(current.isStandalone);
  const update = (patch: Partial<Production>) => {
    if (saved && "totalCost" in patch && (patch.totalCost == null || patch.totalCost < 0)) return;
    if (saved) updateProduction(production.id, patch);
    else setDraft((entry) => ({ ...entry, ...patch }));
  };

  const deleteButton = <IconButton danger aria-label="Excluir produção" onClick={() => onRequestDelete({
    kind: "production", id: production.id, label: `${production.recipeName} — ${production.date}`,
  })}><Icon name="trash" size={17} /></IconButton>;
  const fields = <ProductionFields value={current} recipes={recipes} locked={saved} disabled={busy} onChange={update} />;

  if (!saved) return <>
    <BackButton onClick={onBack}>Voltar para produção</BackButton>
    <PageHeader title="Nova produção" description={standalone
      ? "Produção avulsa: não consome estoque. O custo total é informado manualmente."
      : "Preencha os dados e salve para consumir o estoque. Se faltar um insumo, nenhuma baixa será feita."} />
    <Panel title={current.recipeName} action={deleteButton}>
      <FormLayout disabled={busy} onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void saveProduction(draft).then(() => toast.success("Produção salva e estoque atualizado."))
          .finally(() => setBusy(false)).catch(() => { /* The workspace reports API errors. */ });
      }}>
        {fields}
        <Button type="submit">{busy ? "Salvando..." : "Salvar produção e consumir estoque"}</Button>
      </FormLayout>
      <p className={styles["formula-note"]}>Rascunho: nenhum insumo foi consumido. O custo será calculado pelo servidor ao salvar.</p>
    </Panel>
  </>;

  const report = buildProductionReport(result, sales);
  const shelfLifeDays = recipes.find((recipe) => recipe.id === production.recipeId)?.shelfLifeDays;
  return <>
    <BackButton onClick={onBack}>Voltar para produção</BackButton>
    <ProductionHero production={result} report={report} expiresOn={expirationDate(production.date, shelfLifeDays)} actions={deleteButton} />
    <div className={styles.columns}>
      <PackageFlow production={result} report={report} onLostChange={(lostPackages) => update({ lostPackages })} />
      <ProductionFinance production={result} report={report} />
    </div>
    <div className={styles.charts}>
      <ProductionCharts days={report.daily} cost={result.cost} productionDate={production.date} />
    </div>
    <div className={styles.columns}>
      <ProductionYield production={result} report={report} />
      <Panel title="Dados da produção" description={standalone
        ? "Produção avulsa: não consome estoque. O custo total pode ser corrigido."
        : "As alterações são salvas automaticamente. Receita e lotes ficam travados após a baixa do estoque."}>
        <FormLayout onSubmit={(event) => event.preventDefault()}>{fields}</FormLayout>
      </Panel>
    </div>
    <Panel className={styles.section}>
      <SalePriceSimulation result={result} onPriceChange={(expectedSalePrice) => update({ expectedSalePrice })} />
    </Panel>
    <Panel className={styles.section}>
      <RealizedSales production={result} sales={sales} onViewSales={onViewSales} />
    </Panel>
    <Panel className={styles.section} title={standalone ? "Estoque" : "Lotes consumidos"}
      description={standalone ? undefined : `Custo total dos insumos: ${money(result.cost)}`}>
      {standalone ? <p className={styles["section-note"]}>Produção avulsa registrada sem vínculo com o estoque. Nenhum lote foi consumido.</p> : <>
        {consumptionStatus === "loading" && <p role="status">Carregando consumos...</p>}
        {consumptionStatus === "error" && <p role="alert">Falha ao consultar os lotes. Recarregue a página.</p>}
        {consumptions.length > 0 && <DataTable><thead><tr><th>Insumo / lote</th><th>Compra</th><th>Quantidade usada</th><th>Custo</th></tr></thead><tbody>{consumptions.map((item) => <tr key={item.stockLotId}>
            <td data-sort-value={item.itemName}>{item.itemName}<small className={styles["stock-lot-id"]}>{item.stockLotId}</small></td><td data-sort-value={item.entryDate}>{item.entryDate.split("-").reverse().join("/")}</td>
            <td data-sort-value={item.quantity}>{number(item.quantity, 4)} {item.unit}</td><td data-sort-value={item.cost}>{money(item.cost)}</td>
          </tr>)}</tbody></DataTable>}
        {consumptionStatus === "ready" && !consumptions.length && <p className={styles["section-note"]}>Produção histórica anterior ao controle de estoque. Seu custo original foi preservado, sem baixas retroativas.</p>}
        <p className={styles["formula-note"]}>Remover a produção apenas a oculta da lista. O consumo real e os vínculos com os lotes são preservados, sem devolver insumos ao estoque.</p>
      </>}
    </Panel>
  </>;
}
