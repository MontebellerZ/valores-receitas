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
import type { Production, ProductionDiscard, ProductionReportPage, ProductionSale, StockConsumption } from "../../../domain/models";
import type { ListControls, QueryStatus } from "../../../hooks/usePagedQuery";
import type { ProductionSalesStats } from "../../../domain/workspaceRules";
import type { PendingDelete } from "../../../types/navigation";
import { calculateProduction, isDiscarded } from "../../../domain/calculations";
import { dateLabel, money, number } from "../../../utils/format";
import DiscardProductionModal from "../../../components/production/DiscardProductionModal";
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
  /** Saves a total discard; resolves true when it was confirmed and saved. */
  discardProduction: (production: Production, discard: ProductionDiscard, salesCount?: number) => Promise<boolean>;
  /** Undoes the discard; resolves true when it was confirmed and saved. */
  restoreProduction: (production: Production) => Promise<boolean>;
  onRequestDelete: (target: PendingDelete) => void;
  onBack: () => void;
  onViewSales: () => void;
};

export default function ProductionDetailPage({ production, shelfLifeDays, report: reportPage, sales, consumptions, updateProduction, saveProduction, discardProduction, restoreProduction, onRequestDelete, onBack, onViewSales }: Props) {
  const [draft, setDraft] = useState<Production>(() => ({ ...production, quantity: production.quantity || 1 }));
  const [busy, setBusy] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const saved = production.quantity > 0;
  const discarded = isDiscarded(production);
  const current = saved ? production : draft;
  const result = calculateProduction(current);
  const standalone = Boolean(current.isStandalone);
  const update = (patch: Partial<Production>) => {
    if (saved && discarded) {
      toast.error("Produções descartadas não podem ser alteradas. Desfaça o descarte para editá-la.");
      return;
    }
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

  const deleteButton = <IconButton danger aria-label="Excluir produção" disabled={saved && discarded}
    title={saved && discarded ? "Produções descartadas não podem ser excluídas. Desfaça o descarte antes de removê-la." : undefined}
    onClick={() => onRequestDelete({
    kind: "production", id: production.id, label: `${production.recipeName} — ${production.date}`,
  })}><Icon name="trash" size={17} /></IconButton>;
  const fields = <ProductionFields value={current} locked={saved} disabled={busy || discarded} onChange={update} />;

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
  const salesCount = reportPage.data.salesCount;
  const runAction = (action: () => Promise<boolean>, onDone?: () => void) => {
    setBusy(true);
    void action().then((done) => { if (done) onDone?.(); }).finally(() => setBusy(false));
  };
  const heroActions = <>
    {discarded
      ? <Button variant="secondary" size="small" disabled={busy}
        onClick={() => runAction(() => restoreProduction(production))}>Desfazer descarte</Button>
      : <Button variant="secondary" size="small" disabled={busy || salesCount > 0}
        title={salesCount > 0 ? "Produções com vendas não podem ser descartadas. Informe os pacotes perdidos." : undefined}
        onClick={() => setIsDiscarding(true)}>Descartar produção</Button>}
    {deleteButton}
  </>;
  return <>
    <BackButton onClick={onBack}>Voltar para produção</BackButton>
    <ProductionHero production={result} report={report} expiresOn={expirationDate(production.date, shelfLifeDays)} actions={heroActions} />
    {discarded && <Panel className={styles.section} title="Produção descartada"
      description={`Descartada em ${dateLabel(production.discardedAt ?? "")}. O custo e o consumo de estoque foram mantidos; nenhum pacote está disponível para venda. Para excluir uma produção cadastrada por engano, desfaça o descarte antes.`}>
      <p className={styles["section-note"]}><strong>Motivo:</strong> {production.discardReason || "Não informado."}</p>
    </Panel>}
    <div className={styles.columns}>
      <PackageFlow production={result} report={report} topBuyers={reportPage.data.topBuyers} disabled={discarded}
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
      <Panel title="Dados da produção" description={discarded
        ? "Produção descartada: desfaça o descarte para alterar os dados."
        : standalone
          ? "Produção avulsa: não consome estoque. O custo total pode ser corrigido."
          : "As alterações são salvas automaticamente. Receita e lotes ficam travados após a baixa do estoque."}>
        <FormLayout onSubmit={(event) => event.preventDefault()}>{fields}</FormLayout>
      </Panel>
    </div>
    <Panel className={styles.section}>
      <SalePriceSimulation result={result} disabled={discarded} onPriceChange={(expectedSalePrice) => update({ expectedSalePrice })} />
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
        <p className={styles["formula-note"]}>Excluir a produção apaga o registro e devolve os insumos consumidos ao estoque. Se ela foi realmente feita e perdida, use "Descartar produção" para manter o custo e o consumo.</p>
      </>}
    </Panel>
    {isDiscarding && <DiscardProductionModal productionDate={production.date} busy={busy}
      onClose={() => setIsDiscarding(false)}
      onSubmit={(discard) => runAction(() => discardProduction(production, discard, salesCount), () => setIsDiscarding(false))} />}
  </>;
}
