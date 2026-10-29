import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import FormField from "../../../components/ui/FormField";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import Pagination from "../../../components/ui/Pagination";
import styles from "./styles.module.scss";
import PageHeader from "../../../components/ui/PageHeader";
import Panel from "../../../components/ui/Panel";
import PaymentBadge from "../../../components/ui/PaymentBadge";
import PackageDestinationBar from "../../../components/ui/PackageDestinationBar";
import { money, number as count, dateLabel } from "../../../utils/format";
import { balance, type Period } from "../../../domain/overview";
import { ArrowRight, Eye, ShoppingBag, ChartNoAxesCombined, Wallet, Package, CircleAlert, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import type { ProductionBalance, Sale, SalesReport, WorkspaceSummary } from "../../../domain/models";
import type { Resource } from "../../../hooks/useResource";
import type { ListControls } from "../../../hooks/usePagedQuery";
import logoVertical from "../../../assets/brand/conta-de-chef-vertical.png";


type Props = {
  period: Period;
  onPeriodChange: (period: Period) => void;
  /** First and last day of the period (ISO); `start` is empty for "Desde sempre". */
  range: { start: string; end: string };
  /** Server totals for the period; `undefined` while loading. */
  summary?: WorkspaceSummary;
  summaryStatus: "loading" | "ready" | "error";
  financial: { data?: SalesReport; status: Resource<SalesReport>["status"] };
  /** Productions of the period with global sold/available and the sales of the period. */
  progress: ListControls & { items: ProductionBalance[] };
  productions: ListControls & { items: ProductionBalance[] };
  /** Sales of the period, most recent first. */
  recentSales: ListControls & { items: Sale[] };
  recipeCount: number;
  marketCount: number;
  importAction: ReactNode;
  onViewSales: () => void;
  onViewProduction: (id?: string) => void;
};

const emptySummary: WorkspaceSummary = {
  revision: 0,
  counts: { market: 0, recipes: 0, productions: 0, sales: 0 },
  sales: { count: 0, packages: 0, revenue: 0, received: 0, pending: 0, pendingCount: 0, cost: 0, profit: 0 },
  availablePackages: 0, productionCost: 0, producedPackages: 0, lostPackages: 0,
  productions: { count: 0, soldPackages: 0, donatedPackages: 0, losses: 0, remainingRevenue: 0, remainingCost: 0,
    expectedRevenue: 0, referenceRevenue: 0, referenceProfit: 0 },
};

export default function Overview({
  period,
  onPeriodChange: setPeriod,
  range: { start, end },
  summary: loadedSummary,
  summaryStatus,
  financial,
  progress,
  productions,
  recentSales: recent,
  recipeCount,
  marketCount,
  importAction,
  onViewSales,
  onViewProduction,
}: Props) {
  const summary = loadedSummary ?? emptySummary;
  const totals = financial.data?.totals;
  const actualProfit = totals ? balance(totals.revenue, totals.cost + totals.donationCost) : 0;
  const margin = totals && totals.revenue > 0 ? actualProfit / totals.revenue * 100 : null;
  const receivedPercent = totals && totals.revenue > 0 ? totals.received / totals.revenue * 100 : 0;
  const planning = {
    packages: summary.producedPackages,
    available: summary.availablePackages,
    cost: summary.productionCost,
    ...summary.productions,
  };
  const remainingProfit = balance(
    planning.remainingRevenue,
    planning.remainingCost,
  );
  const describe = (production: ProductionBalance) => {
    const hasSales = production.periodSales.count > 0;
    const price = production.expectedSalePrice ?? production.salePrice;
    return { ...production, realized: production.periodSales, hasSales, price, available: production.availablePackages };
  };
  const allocatedPercent =
    planning.packages > 0
      ? Math.min(100, ((planning.soldPackages + summary.lostPackages) / planning.packages) * 100)
      : 0;

  return (
    <div className={styles["overview-dashboard"]}>
      <PageHeader
        title={<>Visão geral</>}
        eyebrow="SEU NEGÓCIO, EM NÚMEROS"
        eyebrowDot
        description="Resultados, oportunidades e próximos passos para cuidar do seu negócio."
        action={
          <div className={styles["welcome-actions"]}>
            {importAction}
            <Button onClick={onViewSales}>
              <ShoppingBag size={17} aria-hidden="true" /> Vendas
            </Button>
          </div>
        }
      />
      <Panel className={styles.filters} title="Seu negócio em perspectiva"
        description="Vendas pela data da venda. Produções pela data de produção; seus saldos consideram todas as saídas registradas.">
      <div className={styles["overview-period-filter"]}>
        <FormField label="Período" variant="inline">
          <SearchableSelect<Period>
            className={styles["period-select"]}
            value={period}
            onChange={setPeriod}
            options={[
              { value: "week", label: "Últimos 7 dias" },
              { value: "month", label: "Último mês" },
              { value: "six-months", label: "Últimos 6 meses" },
              { value: "year", label: "Último ano" },
              { value: "all", label: "Desde sempre" },
            ]}
          />
        </FormField>
        <span>
          {start
            ? `${dateLabel(start)} a ${dateLabel(end)}`
            : `Todo o histórico até ${dateLabel(end)}`}
        </span>
      </div>
      </Panel>

      {financial.status === "error" || financial.status === "missing" ?
        <Panel><p role="alert">Não foi possível carregar os resultados do negócio. Recarregue a página para tentar novamente.</p></Panel>
        : !totals ? <Panel><p role="status">Carregando resultados do negócio...</p></Panel> : <>
        <section className={styles.hero} aria-label="Resultados do negócio">
          <div className={styles["hero-heading"]}>
            <div><span className={styles.eyebrow}><ChartNoAxesCombined size={16} aria-hidden="true" /> PANORAMA DO NEGÓCIO</span>
              <h2>Cada número, uma decisão melhor.</h2>
              <p>O que você vendeu, o que já entrou e o resultado que ficou.</p></div>
            <ChartNoAxesCombined size={48} className={styles["hero-icon"]} aria-hidden="true" />
          </div>
          <dl className={styles.kpis}>
            <div><dt>Faturamento vendido</dt><dd>{money(totals.revenue)}</dd><small>{count(totals.count)} venda(s) · {count(totals.packages)} pacotes</small></div>
            <div><dt>Resultado após doações</dt><dd className={actualProfit < 0 ? styles.negative : undefined}>{money(actualProfit)}</dd>
              <small>{margin === null ? "Sem faturamento para calcular a margem" : `${count(margin, 1)}% de margem sobre o faturamento`}</small></div>
            <div><dt>Dinheiro recebido</dt><dd>{money(totals.received)}</dd><small>{count(receivedPercent, 1)}% do faturamento recebido</small></div>
            <div><dt>A receber</dt><dd>{money(totals.pending)}</dd><small>{count(totals.pendingCount)} venda(s) com pagamento pendente</small></div>
          </dl>
          <p className={styles["hero-note"]}>Resultado = faturamento − custo dos vendidos − custo das doações. Não inclui outras despesas e não representa saldo em caixa.</p>
        </section>
        <div className={styles["business-grid"]}>
          <Panel title="No radar" description="Sinais para orientar seus próximos passos.">
            <div className={styles.radar}>
              {totals.pendingCount > 0 && <div><span className={styles["signal-icon"]}><Wallet size={19} aria-hidden="true" /></span>
                <div><strong>{money(totals.pending)} para acompanhar</strong><p>Confira os pagamentos de {count(totals.pendingCount)} venda(s) ainda não recebida(s).</p>
                  <Button variant="inline" onClick={onViewSales}>Consultar vendas <ArrowRight size={14} aria-hidden="true" /></Button></div></div>}
              {actualProfit < 0 && <div><span className={styles["signal-icon"]}><CircleAlert size={19} aria-hidden="true" /></span>
                <div><strong>O resultado está negativo</strong><p>Os custos dos pacotes vendidos e doados superam o faturamento. Revise custos e preços antes das próximas vendas.</p>
                  <Button variant="inline" onClick={() => onViewProduction()}>Revisar produções <ArrowRight size={14} aria-hidden="true" /></Button></div></div>}
              {summaryStatus === "ready" && planning.available > 0 && <div><span className={styles["signal-icon"]}><Package size={19} aria-hidden="true" /></span>
                <div><strong>{count(planning.available)} pacotes podem virar venda</strong><p>Saldo das produções do período, com potencial de {money(planning.remainingRevenue)} em faturamento.</p>
                  <Button variant="inline" onClick={onViewSales}>Ir para vendas <ArrowRight size={14} aria-hidden="true" /></Button></div></div>}
              {totals.count === 0 && <div><span className={styles["signal-icon"]}><ShoppingBag size={19} aria-hidden="true" /></span>
                <div><strong>A próxima venda começa aqui</strong><p>Não há vendas neste período. Consulte seu histórico em outro período ou registre uma venda.</p>
                  <Button variant="inline" onClick={onViewSales}>Explorar vendas <ArrowRight size={14} aria-hidden="true" /></Button></div></div>}
              {totals.count > 0 && totals.pendingCount === 0 && actualProfit >= 0 && <div><span className={styles["signal-icon"]}><TrendingUp size={19} aria-hidden="true" /></span>
                <div><strong>Pagamentos em dia neste período</strong><p>Não há vendas pendentes de recebimento. Continue acompanhando seus custos e resultados.</p></div></div>}
            </div>
          </Panel>
          <Panel title="O que movimenta o negócio" description="Indicadores de vendas de todo o período, não apenas da página exibida.">
            <dl className={styles.indicators}>
              <div><dt>Ticket médio<small>Valor por venda, sem doações</small></dt><dd>{totals.count ? money(totals.revenue / totals.count) : "—"}</dd></div>
              <div><dt>Clientes identificados<small>Compradores com nome informado</small></dt><dd>{count(totals.customers)}</dd></div>
              <div><dt>Pacotes doados<small>Custo registrado: {money(totals.donationCost)}</small></dt><dd>{count(totals.donatedPackages)}</dd></div>
            </dl>
            <h3 className={styles["product-title"]}>Produto com maior faturamento</h3>
            {financial.data?.topProducts[0] ? <div className={styles["featured-product"]}>
              <span className={styles["signal-icon"]}><TrendingUp size={19} aria-hidden="true" /></span>
              <div><strong>{financial.data.topProducts[0].name}</strong><p>{count(financial.data.topProducts[0].packages)} pacotes vendidos</p></div>
              <b>{money(financial.data.topProducts[0].revenue)}</b>
            </div> : <p className={styles.footnote}>Seus produtos em destaque aparecerão após as primeiras vendas.</p>}
          </Panel>
        </div>
      </>}

      {summaryStatus === "error" ? <Panel><p role="alert">Não foi possível carregar os indicadores de produção e estoque. Recarregue a página para tentar novamente.</p></Panel>
        : summaryStatus !== "ready" ? <Panel><p role="status">Carregando produção e estoque...</p></Panel> : <>
      <section className={styles["operations-band"]} aria-label="Produção e estoque do período">
        <div><Package size={21} aria-hidden="true" /><span>DA PRODUÇÃO À VENDA<small>{count(planning.count)} produções no período</small></span></div>
        <dl><div><dt>Pacotes produzidos</dt><dd>{count(planning.packages)}</dd></div>
          <div><dt>Disponíveis agora</dt><dd>{count(planning.available)}</dd></div>
          <div><dt>Custo de produção</dt><dd>{money(planning.cost)}</dd></div>
          <div><dt>Pacotes perdidos</dt><dd>{count(summary.lostPackages)}</dd></div></dl>
      </section>

      <div className={styles["overview-summary-grid"]}>
        <Panel className={styles["overview-section"]} title="Giro das produções" description="Produções do período, da mais recente à mais antiga. Destinos incluem vendas, doações e perdas de pacotes prontos, de qualquer data." action={
            <Button variant="inline" onClick={() => onViewProduction()}>
              Ver produção <ArrowRight size={14} aria-hidden="true" />
            </Button>
          }>
          {progress.status === "loading" && <p role="status">Atualizando giro das produções...</p>}
          {progress.status === "error" ? <EmptyState>Não foi possível carregar as produções do período.</EmptyState> : progress.items.length ? (
            <div className={styles["overview-production-progress"]} aria-busy={progress.status === "loading"}>
              {progress.items.map(describe).map((production) => {
                const percent =
                  production.packages > 0
                    ? Math.min(
                      100,
                      ((production.soldPackages + (production.lostPackages ?? 0)) / production.packages) *
                      100,
                    )
                    : 0;
                return (
                  <div key={production.id}>
                    <div className={styles["overview-progress-heading"]}>
                      <div>
                        <strong>{production.recipeName}</strong>
                        <small>{dateLabel(production.date)}</small>
                      </div>
                      <span>
                        {count(production.packages)} pacotes produzidos
                      </span>
                    </div>
                    <PackageDestinationBar
                      label={`Destino dos pacotes de ${production.recipeName} em ${production.date}`}
                      total={production.packages}
                      sold={production.soldPackages - production.donatedPackages}
                      donated={production.donatedPackages}
                      lost={production.lostPackages ?? 0}
                      available={production.available}
                    />
                    <div className={styles["overview-progress-footer"]}>
                      <Button variant="inline" onClick={() => onViewProduction(production.id)}>Ver produção <ArrowRight size={13} aria-hidden="true" /></Button>
                      <span>{count(percent, 1)}% com destino definido</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : progress.status === "ready" && (
            <EmptyState className={styles["overview-empty-brand"]}>
              <img src={logoVertical} alt="" width="548" height="309" />
              <p>Nenhuma produção registrada.</p>
            </EmptyState>
          )}
          {progress.pagination.totalCount > 0 && <Pagination {...progress.pagination} label="produções" />}
        </Panel>

        <Panel className={styles["overview-section"]} title="Oportunidade no estoque" description="Projeção dos pacotes ainda disponíveis das produções do período. Não é venda nem dinheiro recebido." action={
            <span className={styles["round-icon"]}>
              <ShoppingBag size={17} aria-hidden="true" />
            </span>
          }>
          <dl className={styles["overview-planning-values"]}>
            <div>
              <dt>Potencial do estoque restante</dt>
              <dd>{money(planning.remainingRevenue)}</dd>
            </div>
            <div>
              <dt>Resultado potencial restante</dt>
              <dd className={remainingProfit < 0 ? styles["text-negative"] : undefined}>
                {money(remainingProfit)}
              </dd>
            </div>
            <div>
              <dt>Custo dos pacotes disponíveis</dt>
              <dd>{money(planning.remainingCost)}</dd>
            </div>
            <div>
              <dt>Perdas no preparo</dt>
              <dd>{count(planning.losses)} unidades</dd>
            </div>
          </dl>
          <div className={styles["overview-stock-progress"]}>
            <span>
              {count(allocatedPercent, 1)}% dos pacotes com destino definido: vendidos, doados ou perdidos
            </span>
            <PackageDestinationBar
              label="Destino dos pacotes das produções do período"
              total={planning.packages}
              sold={planning.soldPackages - planning.donatedPackages}
              donated={planning.donatedPackages}
              lost={summary.lostPackages}
              available={planning.available}
            />
          </div>
          <details className={styles["overview-reference"]}>
            <summary>Referências do planejamento</summary>
            <dl>
              <div>
                <dt>Venda esperada de toda a produção</dt>
                <dd>{money(planning.expectedRevenue)}</dd>
              </div>
              <div>
                <dt>Faturamento original por acréscimo</dt>
                <dd>{money(planning.referenceRevenue)}</dd>
              </div>
              <div>
                <dt>Lucro original por acréscimo</dt>
                <dd>{money(planning.referenceProfit)}</dd>
              </div>
            </dl>
          </details>
        </Panel>
      </div>
      </>}

      <Panel className={styles["overview-section"]} title="Explore as produções" description="Valores realizados quando há vendas no período; caso contrário, valores esperados ou previstos. Não some projeções ao resultado realizado." action={
          <Button variant="inline" onClick={() => onViewProduction()}>
            Ver todas <ArrowRight size={14} aria-hidden="true" />
          </Button>
        }>
        {productions.status === "loading" && <p role="status">Atualizando produções...</p>}
        {productions.status === "error" ? <EmptyState>Não foi possível carregar as produções do período.</EmptyState> : productions.items.length ? (
          <DataTable variant="sales" serverSort={productions.serverSort} aria-busy={productions.status === "loading"}><thead>
                <tr>
                  <th>Produção</th>
                  <th>Vendidos</th>
                  <th>Disponíveis</th>
                  <th>Preço / pacote</th>
                  <th>Faturamento</th>
                  <th>Resultado</th>
                  <th />
                </tr>
              </thead><tbody>
                {productions.items.map(describe).map((production) => {
                  const source = production.hasSales
                    ? "Realizado"
                    : production.expectedSalePrice !== undefined
                      ? "Esperado"
                      : "Previsto";
                  const revenue = production.hasSales
                    ? production.realized.revenue
                    : production.price * production.packages;
                  const cost = production.hasSales
                    ? production.realized.cost
                    : production.cost;
                  const result = balance(revenue, cost);
                  return (
                    <tr key={production.id}>
                      <td>
                        <strong>{production.recipeName}</strong>
                        <small>{dateLabel(production.date)}</small>
                      </td>
                      <td>{count(production.realized.packages)}</td>
                      <td>{count(production.available)}</td>
                      <td>
                        {production.hasSales
                          ? production.realized.packages > 0
                            ? money(
                              production.realized.revenue /
                              production.realized.packages,
                            )
                            : "—"
                          : money(production.price)}
                        <small>
                          {production.hasSales
                            ? "Média realizada"
                            : production.expectedSalePrice !== undefined
                              ? "Preço desejado"
                              : "Preço sugerido"}
                        </small>
                      </td>
                      <td>
                        {money(revenue)}
                        <small>{source}</small>
                      </td>
                      <td>
                        <span
                          className={result < 0 ? styles["text-negative"] : undefined}
                        >
                          {production.hasSales || production.packages > 0
                            ? money(result)
                            : "—"}
                        </span>
                        <small>{source}</small>
                      </td>
                      <td>
                        <IconButton
                          
                          title="Visualizar produção"
                          aria-label={`Visualizar produção de ${production.recipeName} em ${production.date}`}
                          onClick={() => onViewProduction(production.id)}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody></DataTable>
        ) : productions.status === "ready" && (
          <EmptyState>Nenhuma produção registrada.</EmptyState>
        )}
        {productions.pagination.totalCount > 0 && <Pagination {...productions.pagination} label="produções" />}
      </Panel>

      <Panel className={styles["overview-section"]} title="Últimas movimentações" description="Vendas e doações do período. Para consultar pagamentos e registrar vendas, acesse Vendas." action={
          <Button variant="inline" onClick={onViewSales}>
            Ver vendas <ArrowRight size={14} aria-hidden="true" />
          </Button>
        }>
        {recent.status === "loading" && <p role="status">Atualizando movimentações...</p>}
        {recent.status === "error" ? <EmptyState>Não foi possível carregar as vendas do período.</EmptyState> : recent.items.length ? (
          <DataTable variant="sales" serverSort={recent.serverSort} aria-busy={recent.status === "loading"}><thead>
                <tr>
                  <th>Venda</th>
                  <th>Cliente</th>
                  <th>Pacotes</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                </tr>
              </thead><tbody>
                {recent.items.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <strong>{sale.recipeName}</strong>
                      <small>{dateLabel(sale.date)}</small>
                    </td>
                    <td>{sale.customer || "—"}</td>
                    <td>{count(sale.packages)}</td>
                    <td>{money(sale.packages * sale.pricePerPackage)}</td>
                    <td>
                      <PaymentBadge paid={sale.paid} donated={sale.donated} />
                    </td>
                  </tr>
                ))}
              </tbody></DataTable>
        ) : recent.status === "ready" && (
          <EmptyState>Nenhuma venda registrada.</EmptyState>
        )}
        {recent.pagination.totalCount > 0 && <Pagination {...recent.pagination} label="vendas" />}
      </Panel>
      <p className={styles.footnote}>Sua base de trabalho: {count(recipeCount)} receitas e {count(marketCount)} insumos cadastrados, independentemente do período.</p>
    </div>
  );
}
