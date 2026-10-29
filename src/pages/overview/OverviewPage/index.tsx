import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import IconButton from "../../../components/ui/IconButton";
import DataTable from "../../../components/ui/DataTable";
import FormField from "../../../components/ui/FormField";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import Pagination from "../../../components/ui/Pagination";
import styles from "./styles.module.scss";
import PageHeader from "../../../components/ui/PageHeader";
import MetricCard, { MetricGrid } from "../../../components/ui/MetricCard";
import Panel from "../../../components/ui/Panel";
import PaymentBadge from "../../../components/ui/PaymentBadge";
import { money, number as count, dateLabel } from "../../../utils/format";
import { balance, type Period } from "../../../domain/overview";
import { ArrowRight, Eye, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import type { ProductionBalance, Sale, WorkspaceSummary } from "../../../domain/models";
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
  productions: { count: 0, soldPackages: 0, losses: 0, remainingRevenue: 0, remainingCost: 0,
    expectedRevenue: 0, referenceRevenue: 0, referenceProfit: 0 },
};

export default function Overview({
  period,
  onPeriodChange: setPeriod,
  range: { start, end },
  summary: loadedSummary,
  summaryStatus,
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
  const actual = summary.sales;
  const actualProfit = balance(actual.revenue, actual.cost);
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
  const soldPercent =
    planning.packages > 0
      ? Math.min(100, (planning.soldPackages / planning.packages) * 100)
      : 0;

  return (
    <div className={styles["overview-dashboard"]}>
      <PageHeader
        variant="welcome"
        title={<>Visão geral</>}
        eyebrow="SEU NEGÓCIO, EM NÚMEROS"
        eyebrowDot
        description={loadedSummary
          ? `${summary.productions.count} produções · ${summary.sales.count} vendas · ${recipeCount} receitas · ${marketCount} insumos`
          : summaryStatus === "error" ? "Não foi possível carregar o resumo do período." : "Carregando resumo do período..."}
        action={
          <div className={styles["welcome-actions"]}>
            {importAction}
            <Button onClick={onViewSales}>
              <ShoppingBag size={17} aria-hidden="true" /> Vendas
            </Button>
          </div>
        }
      />
      <div className={styles["overview-period-filter"]}>
        <FormField label="Período" variant="inline">
          <SearchableSelect<Period>
            className={styles["period-select"]}
            value={period}
            onChange={setPeriod}
            options={[
              { value: "week", label: "Última semana" },
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
            : `Até ${dateLabel(end)}`}
        </span>
      </div>

      <MetricGrid aria-label="Resultados reais" aria-busy={summaryStatus === "loading"}>
        <MetricCard
          variant="overview"
          label="Faturamento vendido"
          value={<>{money(actual.revenue)}</>}
          caption={`${count(actual.packages)} pacotes vendidos`}
        />
        <MetricCard
          variant="overview"
          label="Recebido"
          value={<>{money(actual.received)}</>}
          caption={<>Valores recebidos</>}
        />
        <MetricCard
          variant="overview"
          label="A receber"
          value={<>{money(actual.pending)}</>}
          caption={`${count(actual.pendingCount)} vendas pendentes`}
        />
        <MetricCard
          variant="overview"
          label="Resultado das vendas"
          value={<>{money(actualProfit)}</>}
          caption={<>Ingredientes vendidos: {money(actual.cost)}</>}
          negative={actualProfit < 0}
        />
      </MetricGrid>

      <MetricGrid variant="band" aria-label="Produção e estoque">
        <MetricCard variant="compact" label="Pacotes produzidos" value={count(planning.packages)} />
        <MetricCard variant="compact" label="Pacotes disponíveis" value={count(planning.available)} />
        <MetricCard variant="compact" label="Custo total registrado" value={money(planning.cost)} />
        <MetricCard variant="compact" label="Perdas registradas" value={<>{count(planning.losses)} un.</>} />
      </MetricGrid>

      <div className={styles["overview-summary-grid"]}>
        <Panel variant="plain" className={styles["overview-section"]} title="Vendas por produção" action={
            <Button variant="inline" onClick={() => onViewProduction()}>
              Ver produção <ArrowRight size={14} aria-hidden="true" />
            </Button>
          }>
          {progress.items.length ? (
            <div className={styles["overview-production-progress"]} aria-busy={progress.status === "loading"}>
              {progress.items.map(describe).map((production) => {
                const percent =
                  production.packages > 0
                    ? Math.min(
                      100,
                      (production.realized.packages / production.packages) *
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
                        {count(production.realized.packages)} /{" "}
                        {count(production.packages)} pacotes
                      </span>
                    </div>
                    <progress
                      aria-label={`Pacotes vendidos de ${production.recipeName} em ${production.date}`}
                      value={production.realized.packages}
                      max={Math.max(1, production.packages)}
                    />
                    <div className={styles["overview-progress-footer"]}>
                      <span>{money(production.realized.revenue)} vendidos</span>
                      <span>{count(percent, 1)}% vendido</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : progress.status === "error" ? (
            <EmptyState>Não foi possível carregar as produções do período.</EmptyState>
          ) : progress.status === "ready" && (
            <EmptyState className={styles["overview-empty-brand"]}>
              <img src={logoVertical} alt="" width="548" height="309" />
              <p>Nenhuma produção registrada.</p>
            </EmptyState>
          )}
          {progress.pagination.totalCount > 0 && <Pagination {...progress.pagination} label="produções" />}
        </Panel>

        <Panel variant="plain" className={styles["overview-section"]} title="Planejamento do estoque" action={
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
              <dt>Vendido + potencial restante</dt>
              <dd>{money(actual.revenue + planning.remainingRevenue)}</dd>
            </div>
            <div>
              <dt>Resultado vendido + potencial</dt>
              <dd
                className={
                  actualProfit + remainingProfit < 0
                    ? styles["text-negative"]
                    : undefined
                }
              >
                {money(actualProfit + remainingProfit)}
              </dd>
            </div>
          </dl>
          <div className={styles["overview-stock-progress"]}>
            <span>
              {count(soldPercent, 1)}% dos pacotes dessas produções já vendidos
            </span>
            <progress
              aria-label="Percentual de pacotes vendidos"
              value={planning.soldPackages}
              max={Math.max(1, planning.packages)}
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

      <Panel variant="plain" className={styles["overview-section"]} title="Resumo das produções" action={
          <Button variant="inline" onClick={() => onViewProduction()}>
            Ver todas <ArrowRight size={14} aria-hidden="true" />
          </Button>
        }>
        {productions.items.length ? (
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
        ) : productions.status === "error" ? (
          <EmptyState>Não foi possível carregar as produções do período.</EmptyState>
        ) : productions.status === "ready" && (
          <EmptyState>Nenhuma produção registrada.</EmptyState>
        )}
        {productions.pagination.totalCount > 0 && <Pagination {...productions.pagination} label="produções" />}
      </Panel>

      <Panel variant="plain" className={styles["overview-section"]} title="Vendas recentes" action={
          <Button variant="inline" onClick={onViewSales}>
            Ver vendas <ArrowRight size={14} aria-hidden="true" />
          </Button>
        }>
        {recent.items.length ? (
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
        ) : recent.status === "error" ? (
          <EmptyState>Não foi possível carregar as vendas do período.</EmptyState>
        ) : recent.status === "ready" && (
          <EmptyState>Nenhuma venda registrada.</EmptyState>
        )}
        {recent.pagination.totalCount > 0 && <Pagination {...recent.pagination} label="vendas" />}
      </Panel>
    </div>
  );
}
