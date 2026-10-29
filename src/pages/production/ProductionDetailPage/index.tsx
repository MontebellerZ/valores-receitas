import Button from "../../../components/ui/Button";
import IconButton from "../../../components/ui/IconButton";
import FormLayout from "../../../components/ui/FormLayout";
import Panel from "../../../components/ui/Panel";
import ProductionFields from "../../../components/production/ProductionFields";
import DataTable from "../../../components/ui/DataTable";
import Pagination from "../../../components/ui/Pagination";
import styles from "./styles.module.scss";
import { useState } from "react";
import BackButton from "../../../components/ui/BackButton";
import { toast } from "react-toastify";
import Icon from "../../../components/ui/Icon";
import PageHeader from "../../../components/ui/PageHeader";
import type { Production, ProductionReportPage, ProductionSale, StockConsumption } from "../../../domain/models";
import type { ListControls, QueryStatus } from "../../../hooks/usePagedQuery";
import type { ProductionSalesStats } from "../../../domain/workspaceRules";
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
import { buildProductionReport, expirationDate, fillDailyGaps } from "../../../domain/productionReport";


type Props = {
  production: Production;
  /** Shelf life of the production's recipe, when the recipe still exists. */
  shelfLifeDays?: number | null;
  /** Server totals plus the current page of the daily report. */
  report: { data?: ProductionReportPage; status: QueryStatus; pagination: ListControls["pagination"] };
  /** Current page of the production's sales history. */
  sales: ListControls & { items: ProductionSale[] };
  /** Current page of the stock lots consumed by the production. */
  consumptions: ListControls & { items: StockConsumption[] };
  updateProduction: (patch: Partial<Production>, stats: ProductionSalesStats) => void;
  saveProduction: (production: Production) => Promise<void>;
  onRequestDelete: (target: PendingDelete) => void;
  onBack: () => void;
  onViewSales: () => void;
};

export default function ProductionDetailPage({ production, shelfLifeDays, report: reportPage, sales, consumptions, updateProduction, saveProduction, onRequestDelete, onBack, onViewSales }: Props) {
  const [draft, setDraft] = useState<Production>(() => ({ ...production, quantity: production.quantity || 1 }));
  const [busy, setBusy] = useState(false);
  const saved = production.quantity > 0;
  const current = saved ? production : draft;
  const result = calculateProduction(current);
  const standalone = Boolean(current.isStandalone);
  const update = (patch: Partial<Production>) => {
    if (saved && "totalCost" in patch && (patch.totalCost == null || patch.totalCost < 0)) return;
    if (saved) {
      if (!reportPage.data) {
        toast.error("Aguarde o carregamento das vendas desta produção para alterá-la.");
        return;
      }
      updateProduction(patch, { salesCount: reportPage.data.salesCount, soldPackages: reportPage.data.outPackages,
        firstSaleDate: reportPage.data.firstSaleDate });
    } else setDraft((entry) => ({ ...entry, ...patch }));
  };

  const deleteButton = <IconButton danger aria-label="Excluir produção" onClick={() => onRequestDelete({
    kind: "production", id: production.id, label: `${production.recipeName} — ${production.date}`,
  })}><Icon name="trash" size={17} /></IconButton>;
  const fields = <ProductionFields value={current} locked={saved} disabled={busy} onChange={update} />;

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

  if (!reportPage.data) return <>
    <BackButton onClick={onBack}>Voltar para produção</BackButton>
    {reportPage.status === "error"
      ? <p role="alert">Não foi possível carregar o relatório desta produção. Recarregue a página.</p>
      : <div role="status">Carregando relatório da produção...</div>}
  </>;
  const report = buildProductionReport(result, reportPage.data);
  const daily = reportPage.data.daily;
  const days = fillDailyGaps(daily.items);
  return <>
    <BackButton onClick={onBack}>Voltar para produção</BackButton>
    <ProductionHero production={result} report={report} expiresOn={expirationDate(production.date, shelfLifeDays)} actions={deleteButton} />
    <div className={styles.columns}>
      <PackageFlow production={result} report={report} topBuyers={reportPage.data.topBuyers}
        onLostChange={(lostPackages) => update({ lostPackages })} />
      <ProductionFinance production={result} report={report} />
    </div>
    <div className={styles.charts}>
      <ProductionCharts days={days} cost={result.cost} productionDate={production.date}
        includeStart={daily.page === 1} status={reportPage.status}
        pagination={daily.totalCount > 0 && <Pagination {...reportPage.pagination} label="dias com vendas" />} />
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
      <RealizedSales report={report} sales={sales} onViewSales={onViewSales} />
    </Panel>
    <Panel className={styles.section} title={standalone ? "Estoque" : "Lotes consumidos"}
      description={standalone ? undefined : `Custo total dos insumos: ${money(result.cost)}`}>
      {standalone ? <p className={styles["section-note"]}>Produção avulsa registrada sem vínculo com o estoque. Nenhum lote foi consumido.</p> : <>
        {consumptions.status === "loading" && !consumptions.items.length && <p role="status">Carregando consumos...</p>}
        {consumptions.status === "error" && <p role="alert">Falha ao consultar os lotes. Recarregue a página.</p>}
        {consumptions.items.length > 0 && <DataTable serverSort={consumptions.serverSort} aria-busy={consumptions.status === "loading"}><thead><tr><th>Insumo / lote</th><th>Compra</th><th>Quantidade usada</th><th>Custo</th></tr></thead><tbody>{consumptions.items.map((item) => <tr key={item.stockLotId}>
            <td>{item.itemName}<small className={styles["stock-lot-id"]}>{item.stockLotId}</small></td><td>{item.entryDate.split("-").reverse().join("/")}</td>
            <td>{number(item.quantity, 4)} {item.unit}</td><td>{money(item.cost)}</td>
          </tr>)}</tbody></DataTable>}
        {consumptions.pagination.totalCount > 0 && <Pagination {...consumptions.pagination} label="lotes consumidos" />}
        {consumptions.status === "ready" && !consumptions.pagination.totalCount && <p className={styles["section-note"]}>Produção histórica anterior ao controle de estoque. Seu custo original foi preservado, sem baixas retroativas.</p>}
        <p className={styles["formula-note"]}>Remover a produção apenas a oculta da lista. O consumo real e os vínculos com os lotes são preservados, sem devolver insumos ao estoque.</p>
      </>}
    </Panel>
  </>;
}
